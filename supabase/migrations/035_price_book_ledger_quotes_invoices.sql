-- 035_price_book_ledger_quotes_invoices.sql
--
-- Command Center V2 prompt v2-03 — THE PRICE BOOK, THE PRICING HISTORY LEDGER,
-- QUOTES AND INVOICES AS REAL RECORDS, and the signed single-use Approve link.
--
-- Everything here is ADMIN-ONLY except `invoices`, where the customer who owns
-- the invoice may read their own row. CLAUDE.md's business rule stands: a
-- customer never sees a price except on a formal AFS-generated quote or
-- invoice delivered to them. The price book and the ledger are back-office.
--
-- IDEMPOTENT: every object is created IF NOT EXISTS, every constraint is added
-- only when pg_constraint does not already have it, and every policy is dropped
-- before it is created. Safe to re-run, and it was.
--
-- ===========================================================================
-- 1. THE PRICE BOOK — TWO TABLES, BECAUSE A PRICE HAS A LIFETIME
-- ===========================================================================
--
-- `price_book_items` is the IDENTITY of a line in Steve's price book: one
-- material + gauge. It can be added and it can be RETIRED, and retiring it
-- never deletes anything, because a quote issued last year was built on it.
--
-- `price_book_versions` is WHAT IT COST, FROM WHEN. Editing a price does not
-- overwrite the old one — it INSERTS a new version with a new effective date.
-- The version rows are append-only in the database (see §2's trigger, reused
-- here), so "an old quote keeps the prices it was built on, forever" is not a
-- convention that a future UPDATE could quietly break.
--
-- PRICES START EMPTY. Every cents column is NULLABLE with NO DEFAULT. NULL
-- means "Steve has not filled this in", it renders as a marked blank, and
-- lib/pricing/price-book.ts refuses to issue a quote that needs it. There is
-- deliberately no 0 default: a zero is a price, and a made-up one.

CREATE TABLE IF NOT EXISTS price_book_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material      text NOT NULL,
  gauge         text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  retired_at    timestamptz,
  retired_by    uuid REFERENCES profiles(id),
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_book_items_material_gauge_key') THEN
    ALTER TABLE price_book_items ADD CONSTRAINT price_book_items_material_gauge_key UNIQUE (material, gauge);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS price_book_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          uuid NOT NULL REFERENCES price_book_items(id) ON DELETE RESTRICT,
  -- All four are NULLABLE ON PURPOSE. NULL = blank, never 0, never a guess.
  sheet_cost_cents integer,   -- one 10 ft x 4 ft sheet
  per_bend_cents   integer,
  per_hem_cents    integer,
  extras_cents     integer,
  extras_note      text,
  effective_from   date NOT NULL,
  note             text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_book_versions_item_effective_key') THEN
    ALTER TABLE price_book_versions ADD CONSTRAINT price_book_versions_item_effective_key UNIQUE (item_id, effective_from);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_book_versions_non_negative') THEN
    ALTER TABLE price_book_versions ADD CONSTRAINT price_book_versions_non_negative CHECK (
      (sheet_cost_cents IS NULL OR sheet_cost_cents >= 0)
      AND (per_bend_cents IS NULL OR per_bend_cents >= 0)
      AND (per_hem_cents  IS NULL OR per_hem_cents  >= 0)
      AND (extras_cents   IS NULL OR extras_cents   >= 0)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_price_book_versions_item_effective
  ON price_book_versions (item_id, effective_from DESC);

COMMENT ON TABLE price_book_versions IS
  'Versioned prices. An edit INSERTS a new row with a new effective_from; it never updates an existing one. Append-only is enforced by the afs_append_only trigger, so an already-issued quote can never have its prices changed underneath it.';
COMMENT ON COLUMN price_book_versions.sheet_cost_cents IS
  'Cost of ONE 10 ft x 4 ft sheet, in cents. NULL means Steve has not filled it in: it renders as a marked blank and blocks quote issuance. It is never defaulted to 0.';

-- ===========================================================================
-- 2. APPEND-ONLY, ENFORCED BY THE DATABASE
-- ===========================================================================
--
-- A BEFORE UPDATE OR DELETE trigger that raises. It binds the table owner and
-- the service role too, which a REVOKE would not: this is not a permission
-- that a privileged connection can step around, it is a refusal.
--
-- THE ONE EXCEPTION, AND WHY IT IS NOT A HOLE. A pricing_ledger row whose
-- `test_tag` IS NOT NULL may be deleted. `test_tag` is written by exactly one
-- code path — lib/pricing/ledger.ts's `ledgerTestTag()`, which returns a tag
-- ONLY for a job whose name starts with the reserved literal prefix
-- 'E2E-TEST-' — and a tagged row is EXCLUDED from the pricing_ledger_real view
-- and from the CSV export, so it can never reach the dataset the future pricing
-- engine learns from. Marking test data at the point of insert is what makes
-- both rules true at once: real history is immutable, and a test cleans up
-- after itself.
--
-- `to_jsonb(OLD) ->> 'test_tag'` rather than `OLD.test_tag`: this one function
-- guards two tables and only one of them has that column. PL/pgSQL compiles an
-- IF condition into a single SQL expression and plans the WHOLE thing, so
-- `TG_TABLE_NAME = 'pricing_ledger' AND OLD.test_tag IS NOT NULL` does NOT
-- short-circuit — it fails with 42703 undefined_column on price_book_versions,
-- turning the refusal into the wrong error. Found by the unit test, not by
-- reading. Going through jsonb is column-agnostic and cannot regress that way.
CREATE OR REPLACE FUNCTION afs_append_only() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' AND (to_jsonb(OLD) ->> 'test_tag') IS NOT NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'APPEND ONLY: % on % is refused. This table is the pricing history; a row is never changed or removed once written.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '42501';
END $fn$;

-- ===========================================================================
-- 3. THE PRICING HISTORY LEDGER
-- ===========================================================================
--
-- The dataset the future dynamic pricing engine learns from. ONE table, so a
-- question like "what did we quote, what did it cost us, and did they say yes"
-- is one query and not a join across six places.
--
-- FOUR WRITERS ARE DESIGNED FOR, and two of them do not exist yet:
--   source='admin_ui'       — Steve, today, through the Command Center.
--   source='customer_link'  — the signed Approve button in the quote email.
--   source='mail_parser'    — DEFERRED Phase 4. The Outlook mail parser writes
--                             supplier price-change notices straight in here.
--                             Nothing about this table needs to change for it:
--                             it sets event_type='supplier_price_change',
--                             source='mail_parser', and external_ref to the
--                             Graph internetMessageId so a notice is imported
--                             exactly once (uq_pricing_ledger_external_ref).
--   source='import'         — historical spreadsheets and QuickBooks exports.
--                             import_batch_id groups one file's rows so a bad
--                             import is identifiable (it cannot be deleted —
--                             it is superseded by a corrected batch). The
--                             column-by-column import format is documented in
--                             SCHEMA.md and ARCHITECTURE.md.

CREATE TABLE IF NOT EXISTS pricing_ledger (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        text NOT NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  recorded_at       timestamptz NOT NULL DEFAULT now(),

  -- WHO
  actor_id          uuid REFERENCES profiles(id),
  actor_email       text,
  actor_role        text,
  source            text NOT NULL DEFAULT 'admin_ui',

  -- WHAT IT IS ABOUT
  quote_request_id  uuid,
  quote_id          uuid,
  invoice_id        uuid,
  customer_id       uuid REFERENCES profiles(id),
  customer_label    text,

  -- THE SHAPE THAT WAS PRICED (one row per quote/estimate/revision)
  material          text,
  gauge             text,
  blank_width_in    numeric,
  bend_count        integer,
  hem_count         integer,
  length_ft         numeric,
  quantity          integer,
  is_rush           boolean,

  -- THE PRICES USED, AND THE PRICE-BOOK VERSION THEY CAME FROM
  price_book_version_ids uuid[],
  prices_used       jsonb,
  amount_cents      bigint,
  revision          integer,

  -- THE OUTCOME
  outcome           text,
  outcome_reason    text,
  time_to_decision_seconds integer,

  -- A CHANGE: OLD VALUE -> NEW VALUE
  old_value         jsonb,
  new_value         jsonb,

  -- A SUPPLIER PRICE-CHANGE NOTICE
  supplier_name     text,
  old_cost_cents    bigint,
  new_cost_cents    bigint,
  effective_date    date,
  attachment_path   text,

  note              text,
  payload           jsonb,

  -- IMPORT / DEDUPLICATION (Phase 4 mail parser + spreadsheet/QBO import)
  import_batch_id   text,
  external_ref      text,

  -- See afs_append_only() above. NULL on every row any production path writes.
  test_tag          text
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_ledger_event_type_check') THEN
    ALTER TABLE pricing_ledger ADD CONSTRAINT pricing_ledger_event_type_check CHECK (event_type IN (
      'estimate',
      'quote_issued',
      'quote_revised',
      'quote_outcome',
      'invoice_issued',
      'invoice_paid',
      'price_book_change',
      'supplier_price_change'
    ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_ledger_source_check') THEN
    ALTER TABLE pricing_ledger ADD CONSTRAINT pricing_ledger_source_check CHECK (source IN (
      'admin_ui', 'customer_link', 'mail_parser', 'import', 'system'
    ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_ledger_outcome_check') THEN
    ALTER TABLE pricing_ledger ADD CONSTRAINT pricing_ledger_outcome_check CHECK (
      outcome IS NULL OR outcome IN ('approved', 'declined', 'expired')
    );
  END IF;
  -- An outcome event has to SAY what the outcome was. Nothing else may.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_ledger_outcome_belongs_to_outcome_event') THEN
    ALTER TABLE pricing_ledger ADD CONSTRAINT pricing_ledger_outcome_belongs_to_outcome_event CHECK (
      (event_type = 'quote_outcome' AND outcome IS NOT NULL)
      OR (event_type <> 'quote_outcome' AND outcome IS NULL)
    );
  END IF;
  -- An imported row must name its batch, so a bad import is identifiable.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_ledger_import_needs_batch') THEN
    ALTER TABLE pricing_ledger ADD CONSTRAINT pricing_ledger_import_needs_batch CHECK (
      source <> 'import' OR import_batch_id IS NOT NULL
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pricing_ledger_occurred    ON pricing_ledger (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_ledger_event_type  ON pricing_ledger (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_ledger_quote       ON pricing_ledger (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_ledger_request     ON pricing_ledger (quote_request_id) WHERE quote_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_ledger_material    ON pricing_ledger (material, gauge) WHERE material IS NOT NULL;
-- One inbound notice imports exactly once, however many times the parser runs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_ledger_external_ref
  ON pricing_ledger (source, external_ref) WHERE external_ref IS NOT NULL;

DROP TRIGGER IF EXISTS pricing_ledger_append_only ON pricing_ledger;
CREATE TRIGGER pricing_ledger_append_only
  BEFORE UPDATE OR DELETE ON pricing_ledger
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

DROP TRIGGER IF EXISTS price_book_versions_append_only ON price_book_versions;
CREATE TRIGGER price_book_versions_append_only
  BEFORE UPDATE OR DELETE ON price_book_versions
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

COMMENT ON TABLE pricing_ledger IS
  'APPEND-ONLY pricing history: every estimate, quote and revision, every outcome, every invoice, every price-book change and every supplier notice. Enforced by the pricing_ledger_append_only trigger, not by convention. Admin-only. This is the dataset dynamic pricing will learn from.';

-- The analytics surface and the CSV export both read THIS, not the table, so a
-- test-tagged row can never reach either.
CREATE OR REPLACE VIEW pricing_ledger_real AS
  SELECT * FROM pricing_ledger WHERE test_tag IS NULL;

-- ===========================================================================
-- 4. INVOICES — the table five already-built routes were missing
-- ===========================================================================
--
-- docs/COMMAND_CENTER_V2_SPEC.md §2.5 records this as the build's top risk.
-- What the audit for this migration actually found is narrower and worth
-- writing down: those routes are not broken, they are built against `orders`
-- (lib/data/invoices.ts derives an invoice 1:1 from an order). What did not
-- exist was an invoice as a RECORD IN ITS OWN RIGHT — one that a quote becomes
-- on approval, with the quote's own figures frozen onto it.
--
-- THE QUOTE BECOMES THE INVOICE WITH NO RETYPING: line_items, the totals and
-- the price-book snapshot are COPIED from the quote row. There is no form, no
-- second entry, and no opportunity for the two to disagree.
CREATE TABLE IF NOT EXISTS invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text NOT NULL UNIQUE,
  quote_id          uuid REFERENCES quotes(id),
  quote_request_id  uuid REFERENCES quote_requests(id),
  order_id          uuid REFERENCES orders(id),

  user_id           uuid REFERENCES profiles(id),
  customer_email    text,
  customer_name     text,
  customer_company  text,

  status            text NOT NULL DEFAULT 'issued',

  -- Cents, because that is what the price book and the ledger speak.
  subtotal_cents    bigint NOT NULL,
  tax_cents         bigint NOT NULL DEFAULT 0,
  freight_cents     bigint NOT NULL DEFAULT 0,
  total_cents       bigint NOT NULL,

  -- Frozen at creation. Copied from the quote, never re-derived.
  line_items            jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_book_snapshot   jsonb,

  issued_at         timestamptz NOT NULL DEFAULT now(),
  due_date          date,
  net_terms         integer NOT NULL DEFAULT 0,
  paid_at           timestamptz,
  po_number         text,

  -- The automatic copy to the office (CLAUDE.md / spec §1: Tricia).
  office_emailed_to text,
  office_emailed_at timestamptz,

  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_check') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (
      status IN ('issued', 'sent', 'paid', 'void')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_totals_non_negative') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_totals_non_negative CHECK (
      subtotal_cents >= 0 AND tax_cents >= 0 AND freight_cents >= 0 AND total_cents >= 0
    );
  END IF;
  -- One invoice per quote. Clicking Approve twice cannot bill twice.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_quote_id_key') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_quote_id_key UNIQUE (quote_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_user    ON invoices (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_request ON invoices (quote_request_id);

-- ===========================================================================
-- 5. QUOTES — the columns a V2 quote needs
-- ===========================================================================
--
-- The `quotes` table already existed (quote_number, request_id, totals,
-- status). These add the three things a price-book quote has that the old one
-- did not: the PRICED LINE ITEMS as they were sent, the PRICE-BOOK VERSION
-- SNAPSHOT that produced them, and the REVISION chain.
--
-- user_id loses its NOT NULL: a quote request can be a guest (quote_requests
-- .guest_email), and a guest still gets a quote. customer_email carries the
-- address in both cases.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS line_items          jsonb,
  ADD COLUMN IF NOT EXISTS price_book_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS subtotal_cents      bigint,
  ADD COLUMN IF NOT EXISTS total_cents         bigint,
  ADD COLUMN IF NOT EXISTS revision            integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id       uuid REFERENCES quotes(id),
  ADD COLUMN IF NOT EXISTS customer_email      text,
  ADD COLUMN IF NOT EXISTS customer_name       text,
  ADD COLUMN IF NOT EXISTS declined_at         timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason      text,
  ADD COLUMN IF NOT EXISTS expires_at          timestamptz;

ALTER TABLE quotes ALTER COLUMN user_id DROP NOT NULL;

-- ===========================================================================
-- 6. THE APPROVE LINK — signed, single-use, expiring
-- ===========================================================================
--
-- The link in the quote email. Clicking it CREATES the same database-verified
-- approval record the PathfinderEdge single-door guard already requires
-- (CLAUDE.md rule #14) — quote_requests.job_stage='approved',
-- approval_channel='email'. IT IS NOT A BYPASS: it pushes nothing, it imports
-- nothing from lib/integrations/pathfinder-edge.ts, and it deliberately leaves
-- quote_requests.status='submitted' alone so the guard's own condition still
-- holds when an admin later presses "Send to machine". Same contract as
-- approve-by-phone, and for the same reason.
--
-- ONLY THE HASH IS STORED. The token itself lives in the email and nowhere
-- else, so a reader of this table cannot approve anything.
CREATE TABLE IF NOT EXISTS quote_approval_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id         uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_request_id uuid REFERENCES quote_requests(id),
  token_hash       text NOT NULL UNIQUE,
  expires_at       timestamptz NOT NULL,
  used_at          timestamptz,
  used_from        text,
  issued_to        text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_approval_tokens_quote ON quote_approval_tokens (quote_id);

-- ===========================================================================
-- 7. OUTBOUND EMAIL LOG — and the TEST MODE capture
-- ===========================================================================
--
-- `notifications` records that a send was attempted; it has nowhere to put what
-- was in it, and its status CHECK is ('sent','delivered','failed') only. This
-- records the message itself, which is what makes "the invoice was emailed to
-- Tricia" a verifiable claim instead of an assertion.
--
-- status='captured_test_mode' is the E2E's safety net: with
-- AFS_EMAIL_TEST_MODE=1 the message is written here and NO PROVIDER CALL IS
-- MADE, so a test can prove exactly what would have been sent, to whom, without
-- a real customer ever receiving anything.
CREATE TABLE IF NOT EXISTS outbound_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL,
  recipient        text NOT NULL,
  subject          text NOT NULL,
  body_html        text,
  status           text NOT NULL,
  provider_id      text,
  error            text,
  quote_id         uuid REFERENCES quotes(id) ON DELETE SET NULL,
  quote_request_id uuid REFERENCES quote_requests(id) ON DELETE SET NULL,
  invoice_id       uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbound_emails_status_check') THEN
    ALTER TABLE outbound_emails ADD CONSTRAINT outbound_emails_status_check CHECK (
      status IN ('sent', 'failed', 'captured_test_mode', 'not_configured')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_outbound_emails_created ON outbound_emails (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_emails_request ON outbound_emails (quote_request_id);

-- ===========================================================================
-- 8. RLS ON EVERY NEW TABLE
-- ===========================================================================
ALTER TABLE price_book_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_ledger          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_approval_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_emails         ENABLE ROW LEVEL SECURITY;

-- ADMIN ONLY. is_admin() is this codebase's existing helper (SCHEMA.md).
DROP POLICY IF EXISTS admin_all_price_book_items ON price_book_items;
CREATE POLICY admin_all_price_book_items ON price_book_items FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_all_price_book_versions ON price_book_versions;
CREATE POLICY admin_all_price_book_versions ON price_book_versions FOR ALL USING (is_admin());

-- The ledger is admin-only, and it has SELECT and INSERT policies ONLY. There
-- is deliberately no UPDATE or DELETE policy at all, so even an admin session
-- has no policy that would let one through if the trigger were ever dropped.
-- Two independent refusals, not one.
DROP POLICY IF EXISTS admin_read_pricing_ledger ON pricing_ledger;
CREATE POLICY admin_read_pricing_ledger ON pricing_ledger FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS admin_insert_pricing_ledger ON pricing_ledger;
CREATE POLICY admin_insert_pricing_ledger ON pricing_ledger FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_all_quote_approval_tokens ON quote_approval_tokens;
CREATE POLICY admin_all_quote_approval_tokens ON quote_approval_tokens FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_all_outbound_emails ON outbound_emails;
CREATE POLICY admin_all_outbound_emails ON outbound_emails FOR ALL USING (is_admin());

-- Invoices: admin everything; the customer reads their OWN, and only once it
-- has actually been issued to them. A voided invoice is not shown.
DROP POLICY IF EXISTS admin_all_invoices ON invoices;
CREATE POLICY admin_all_invoices ON invoices FOR ALL USING (is_admin());
DROP POLICY IF EXISTS users_own_invoices ON invoices;
CREATE POLICY users_own_invoices ON invoices FOR SELECT
  USING (auth.uid() = user_id AND status <> 'void');

-- ===========================================================================
-- 9. SEED THE PRICE BOOK'S ROWS — AND NOT ONE PRICE
-- ===========================================================================
--
-- One row per real material + active gauge, from the catalog that already
-- exists. NO price_book_versions rows are created, so every cell starts as a
-- marked blank for Steve to fill in, which is exactly what the prompt requires.
INSERT INTO price_book_items (material, gauge, display_order)
SELECT m.name, g.label, (row_number() OVER (ORDER BY m.name, g.sort_order))::int
FROM materials m
JOIN gauges g ON g.material_id = m.id AND g.is_active
ON CONFLICT (material, gauge) DO NOTHING;
