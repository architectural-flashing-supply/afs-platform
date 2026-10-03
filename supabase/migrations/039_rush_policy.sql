-- 039_rush_policy.sql
--
-- ovn item 10-rush-order — THE RUSH POLICY. The mechanism, with none of the
-- numbers in it.
--
-- SPEC_RUSH_ORDER.md marks the rush surcharge percentage (checklist #36) and
-- the rush definition and timing (checklist #32) BLOCKED, and CLAUDE.md's DATA
-- BLOCKERS table still lists both. So this migration builds the place a rush
-- surcharge and a minimum lead time will live, and puts NOTHING in it. There is
-- not one INSERT in this file and not one DEFAULT on a value column.
--
-- WHAT RUSH ALREADY HAS, AND WHAT THIS ADDS.
--   Already built (migration 034, CLAUDE.md rule #15): `quote_requests.is_rush`,
--   `rush_source`, `rush_set_by`, `rush_set_at`, the
--   `quote_requests_rush_needs_explicit_source` CHECK, and the two explicit
--   writers. A job's requested-by date is already
--   `quote_requests.requested_delivery` (migration 001, populated at intake).
--   NONE of that is touched here.
--   New here: what a rush job COSTS and how much notice AFS needs — a
--   decision, made by an admin, with a date on it.
--
-- A BLANK IS NEVER A ZERO (CLAUDE.md rule #19). Every money and rate column is
-- NULLABLE with NO DEFAULT. There is no `DEFAULT 0` anywhere, because a zero is
-- a price and a made-up one. An empty table means "nobody has decided yet", and
-- `lib/pricing/rush-policy.ts` reports that in plain English instead of adding
-- nought pounds of surcharge as though it had been chosen.
--
--   NOTE, for anyone comparing this with `pricing_rules.rush_surcharge_pct`
--   (migration 001 line 281, `DECIMAL(5,4) NOT NULL DEFAULT 0.25`): that
--   column is a per-product legacy field carrying a seeded, invented 25% that
--   NOTHING on the quote path reads. This table does not replace it, does not
--   read it, and is not derived from it. Whether that default should be
--   removed is PENDING REID — dropping a DEFAULT from a live table is a
--   separate, applied migration.
--
-- NOT APPLIED. This file was written by an unattended run that is forbidden
-- from touching the live database. Until somebody applies it, every read of
-- `rush_policies` fails, and `lib/pricing/db.ts`'s `getRushPolicyBook` is
-- written to return "the rush policy table is not in the database yet —
-- migration 039_rush_policy.sql has not been applied" rather than throwing. The
-- admin screen says exactly that and disables its form; quoting carries on with
-- no surcharge. That is designed for, not hoped for.
--
-- IDEMPOTENT: every object is created IF NOT EXISTS, every constraint is added
-- only when pg_constraint does not already have it, and the policy is dropped
-- before it is created. Safe to re-run.

-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================
--
-- ONE TABLE, EFFECTIVE-DATED, APPEND-ONLY — the same shape as
-- `price_book_versions` and for the same reason. Changing the rush policy
-- INSERTS a new row with a new `effective_from`; it never updates one. A quote
-- issued last month therefore keeps the surcharge it was built on, which is
-- upheld twice over: by the append-only trigger below, and by the quote's own
-- `quotes.rush_surcharge` / `quotes.total_cents` snapshot.
--
-- NO company_id, AND THAT IS DELIBERATE. This is AFS back-office
-- configuration, exactly like `price_book_items`, which also has none. A
-- `company_id` here would mean per-contractor rush pricing — a business
-- decision nobody has asked for, and not one a schema should invent. The Six
-- Laws' company_id requirement is about customer-scoped data; this row belongs
-- to the shop.

CREATE TABLE IF NOT EXISTS rush_policies (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What Steve calls this policy, in his own words. Shown on the admin screen
  -- and in the audit trail so a change is identifiable by a human.
  name                    text NOT NULL,

  -- 'percent'    — a share of the quote subtotal
  -- 'flat'       — one fee per job
  -- 'per_piece'  — a fee for every piece quoted
  -- 'none'       — rush costs nothing extra. An explicit DECISION, which is
  --                why it is a type and not the absence of a policy. "Rush is
  --                free but still needs five working days" is a real answer,
  --                and it is not the same fact as "nobody has decided".
  surcharge_type          text NOT NULL,

  -- BASIS POINTS, integer. 250 = 2.50%. Integers throughout, for the same
  -- reason every money column in this schema is cents: a DECIMAL rate drags
  -- float comparison into the arithmetic and into its tests.
  surcharge_percent_bp    integer,

  -- CENTS, integer. Used by 'flat' and by 'per_piece'.
  surcharge_cents         bigint,

  -- BUSINESS days, not calendar days — the shop does not fabricate at the
  -- weekend, so Friday-to-Monday is one working day of notice and not three.
  -- `lib/delivery/business-days.ts` is the only place that decides that
  -- (CLAUDE.md rule #24). NULL means Steve has not set a minimum; it is never
  -- read as nought days.
  minimum_lead_time_days  integer,

  -- The day this policy starts. A policy dated tomorrow is NOT in force today,
  -- which is what makes "the new rush fee starts on the first" safe to enter in
  -- advance.
  effective_from          date NOT NULL,

  note                    text,
  created_by              uuid REFERENCES profiles(id),
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- 2. THE CONSTRAINTS — each one is a sentence the database enforces
-- ===========================================================================

DO $$ BEGIN
  -- There is no 'inferred' and no 'auto', for exactly the reason
  -- `quote_requests.rush_source` has no third value: a future change that
  -- wanted to work a surcharge out by itself would need a migration and a
  -- review to say so.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rush_policies_surcharge_type_check') THEN
    ALTER TABLE rush_policies ADD CONSTRAINT rush_policies_surcharge_type_check CHECK (
      surcharge_type IN ('percent', 'flat', 'per_piece', 'none')
    );
  END IF;

  -- THE VALUE MUST MATCH THE TYPE, AND THE OTHER ONE MUST BE EMPTY.
  -- Without this, a 'percent' row with a NULL percentage is storable, and
  -- anything reading it has to choose between refusing to quote and treating
  -- the blank as nought. Refusing the shape at the door is better than both.
  -- The other half — a 'flat' row carrying a stray percentage as well — would
  -- be a row with two answers in it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rush_policies_value_matches_type') THEN
    ALTER TABLE rush_policies ADD CONSTRAINT rush_policies_value_matches_type CHECK (
      (surcharge_type = 'none'
         AND surcharge_percent_bp IS NULL AND surcharge_cents IS NULL)
      OR (surcharge_type = 'percent'
         AND surcharge_percent_bp IS NOT NULL AND surcharge_cents IS NULL)
      OR (surcharge_type IN ('flat', 'per_piece')
         AND surcharge_cents IS NOT NULL AND surcharge_percent_bp IS NULL)
    );
  END IF;

  -- A TYPO GUARD, NOT A BUSINESS OPINION. 100000 bp is 1000%, so 2500 typed
  -- where 25 was meant is accepted as 25% and nobody is second-guessed, while
  -- 250000 — a decimal point lost twice — is refused. The upper bound is
  -- deliberately far above any plausible rush fee so that it only ever catches
  -- a mistake.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rush_policies_percent_range') THEN
    ALTER TABLE rush_policies ADD CONSTRAINT rush_policies_percent_range CHECK (
      surcharge_percent_bp IS NULL OR (surcharge_percent_bp >= 0 AND surcharge_percent_bp <= 100000)
    );
  END IF;

  -- A negative surcharge is a discount, and a discount reached through the rush
  -- policy would be a surprise on a customer's quote.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rush_policies_cents_non_negative') THEN
    ALTER TABLE rush_policies ADD CONSTRAINT rush_policies_cents_non_negative CHECK (
      surcharge_cents IS NULL OR surcharge_cents >= 0
    );
  END IF;

  -- 0 is meaningful (a rush job can go out same-day); a year is the outer bound
  -- a "minimum lead time" could sanely mean, and it bounds
  -- `addBusinessDays`'s walk at the other end of the system.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rush_policies_lead_time_range') THEN
    ALTER TABLE rush_policies ADD CONSTRAINT rush_policies_lead_time_range CHECK (
      minimum_lead_time_days IS NULL
      OR (minimum_lead_time_days >= 0 AND minimum_lead_time_days <= 365)
    );
  END IF;
END $$;

-- DELIBERATELY NO `UNIQUE (effective_from)`, unlike
-- `price_book_versions_item_effective_key`. Two rows may share a start date,
-- and the later-written one wins — because this table is append-only, so
-- correcting a policy entered with the wrong figure has no other route. It is
-- also what makes the `created_at` tiebreak inside `versionInForce`
-- (lib/pricing/price-book.ts) load-bearing here rather than decorative: on
-- `price_book_versions` that branch is unreachable, because the UNIQUE
-- constraint refuses the second same-day row before the resolver ever sees it.
CREATE INDEX IF NOT EXISTS idx_rush_policies_effective_from
  ON rush_policies (effective_from DESC, created_at DESC);

COMMENT ON TABLE rush_policies IS
  'What a rush job costs and how much notice AFS needs. Effective-dated and append-only: a change INSERTS a new row, so an already-issued quote keeps the surcharge it was built on. SHIPPED EMPTY -- the surcharge and the lead time are business decisions (checklist #32, #36) and no value is invented here.';
COMMENT ON COLUMN rush_policies.surcharge_type IS
  'percent | flat | per_piece | none. "none" is an explicit decision that rush costs nothing extra, which is NOT the same fact as an empty table.';
COMMENT ON COLUMN rush_policies.surcharge_percent_bp IS
  'Basis points, integer. 250 = 2.50%. Required when surcharge_type = percent and refused otherwise.';
COMMENT ON COLUMN rush_policies.surcharge_cents IS
  'Cents, integer. Required when surcharge_type is flat or per_piece and refused otherwise. NULL is never read as 0.';
COMMENT ON COLUMN rush_policies.minimum_lead_time_days IS
  'BUSINESS days of notice AFS needs for a rush job, compared against quote_requests.requested_delivery. NULL means not set, never 0. A business day is decided only by lib/delivery/business-days.ts.';
COMMENT ON COLUMN rush_policies.effective_from IS
  'The day this policy starts. A policy dated in the future is not in force today -- see versionInForce in lib/pricing/price-book.ts.';

-- ===========================================================================
-- 3. APPEND-ONLY, ENFORCED BY THE DATABASE
-- ===========================================================================
--
-- Reuses migration 035's `afs_append_only()` UNCHANGED. That function is
-- already column-agnostic — it reads `to_jsonb(OLD) ->> 'test_tag'` rather than
-- `OLD.test_tag` precisely so one trigger function can guard tables that do not
-- all have that column (035 records how a direct column reference failed with
-- 42703 on the table that lacked it).
--
-- `rush_policies` has NO `test_tag` column, so that expression is always NULL
-- here and the function's one escape hatch cannot fire: every UPDATE and every
-- DELETE is refused, including from the service role and the table owner. Same
-- treatment `price_book_versions` gets, and for the same reason — a quote
-- already sent must not have its surcharge changed underneath it.
DROP TRIGGER IF EXISTS rush_policies_append_only ON rush_policies;
CREATE TRIGGER rush_policies_append_only
  BEFORE UPDATE OR DELETE ON rush_policies
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

-- ===========================================================================
-- 4. RLS — ADMIN ONLY, WITH NO CUSTOMER POLICY AT ALL
-- ===========================================================================
--
-- A rush surcharge is a price. CLAUDE.md's business model says a customer sees
-- a dollar amount only on a formal AFS-generated quote or invoice delivered to
-- them, so there is no customer-readable policy here and must not be one: the
-- surcharge reaches a customer as a line on their quote, never as a rate they
-- could look up and apply to their own job before AFS has priced it.
--
-- `is_admin()` is this codebase's existing helper (SCHEMA.md), the same one
-- every policy in migration 035 uses.
ALTER TABLE rush_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_rush_policies ON rush_policies;
CREATE POLICY admin_all_rush_policies ON rush_policies FOR ALL USING (is_admin());

-- ===========================================================================
-- 5. WHAT THIS FILE DOES NOT DO
-- ===========================================================================
--
-- No INSERT. No seed row. No DEFAULT on surcharge_type's value columns or on
-- minimum_lead_time_days. No change to quote_requests, quotes, invoices,
-- pricing_rules, pricing_ledger or any existing table, constraint, index,
-- policy or trigger. Nothing is dropped and nothing is renamed, so there is no
-- transition state and no backfill.
--
-- DOWN SQL, for a rollback (not run here, and never needed for a forward
-- deploy — this migration only adds):
--
--   DROP TRIGGER IF EXISTS rush_policies_append_only ON rush_policies;
--   DROP POLICY  IF EXISTS admin_all_rush_policies   ON rush_policies;
--   DROP INDEX   IF EXISTS idx_rush_policies_effective_from;
--   DROP TABLE   IF EXISTS rush_policies;
--
-- `afs_append_only()` is NOT dropped by that: migration 035 owns it and
-- `price_book_versions` and `pricing_ledger` still need it.
