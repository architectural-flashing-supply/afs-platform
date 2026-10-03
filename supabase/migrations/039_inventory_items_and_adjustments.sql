-- 039_inventory_items_and_adjustments.sql
--
-- OVERNIGHT ITEM 09 — LIVE INVENTORY: what material AFS physically has in the
-- shop, an APPEND-ONLY ledger of every change to it, and the low-stock signal
-- derived from both.
--
-- SPEC: specs/SPEC_LIVE_INVENTORY.md. Read §2.1 of EES-OVN.09 before changing
-- anything here: that spec governs the three-value CUSTOMER-FACING stock SIGNAL
-- (`products.stock_type`), which is already built and is NOT touched by this
-- migration. These two tables are the AFS-internal, admin-only quantity record
-- the spec defers to its §4 "WHEN ERP INTEGRATION ARRIVES". They are built as
-- structure, EMPTY, per CLAUDE.md's DATA BLOCKERS rule: a blocked feature gets
-- correct architecture and explicit placeholder behaviour, never a guessed
-- number. Nothing here is visible to a customer.
--
-- =========================== NOT APPLIED =============================
-- This file was written during an unattended run whose rules forbid applying a
-- migration. It has NOT been run against any Supabase project. Everything in it
-- is therefore verified by lib/inventory/migration-rls.test.ts, a static test
-- over this file's TEXT, and the app is built to render an honest "the database
-- part of this has not been applied yet" state rather than to assume the tables
-- exist. See lib/data/inventory.ts.
--
-- IDEMPOTENT, the same way 035 is: every object is created IF NOT EXISTS or
-- CREATE OR REPLACE, every constraint is added only when pg_constraint does not
-- already have it, and every policy is dropped before it is created. Safe to
-- re-run.
--
-- ADDITIVE ONLY. There is no DROP, no ALTER ... DROP COLUMN, no DELETE, no
-- UPDATE of existing data, and no TRUNCATE anywhere in this file. Nothing that
-- exists today changes.
--
-- WHY THERE IS NO `company_id`, AND WHY THAT IS THE SAFE CHOICE.
-- In THIS schema `companies` (SCHEMA.md TABLE 2) is the CUSTOMER's organisation
-- — a contractor or architecture firm — reached through `profiles.company_id`.
-- Migration 023's own header says so, and `orders` references `profiles(id)`
-- rather than `companies(id)`. Coil and sheet stock sitting in the Burnet, Texas
-- shop belongs to AFS. A `company_id` here could only ever be NULL (a dead
-- column) or else assert that a contractor owns AFS's metal, which would make
-- the RLS policy wrong in the dangerous direction. The tenancy boundary for an
-- AFS-internal back-office table in this codebase is `is_admin()` — exactly what
-- `price_book_items`, `price_book_versions` and `pricing_ledger` use (035). That
-- is the precedent followed, and the static test asserts BOTH halves: the
-- is_admin() policies are present, and `company_id` is absent.
--
-- ===========================================================================

-- ===========================================================================
-- 1. inventory_items — THE IDENTITY OF A THING AFS STOCKS
-- ===========================================================================
--
-- One row per distinct stockable thing: a material + gauge + finish + coil
-- width, counted in one unit. `material_id` and `gauge_id` are real foreign
-- keys into the vocabulary this codebase already has (001_initial_schema.sql's
-- `materials` and `gauges`) — the same pair migration 035 seeds the price book
-- from — so there is no second, drifting list of materials.
--
-- A BLANK IS NEVER A ZERO. This is CLAUDE.md rule #19 applied to quantities
-- instead of prices, and it is the whole reason this table can ship empty
-- without lying:
--
--   qty_on_hand   NULLABLE, NO DEFAULT. NULL means NOBODY HAS COUNTED THIS YET.
--                 It renders as a marked "Not counted" chip. It is never 0,
--                 because 0 is a measurement and a made-up one.
--   reorder_point NULLABLE, NO DEFAULT. NULL means nobody has said what "low"
--                 means for this item, so no low-stock judgement is made and
--                 none is shown.
--   qty_reserved  NOT NULL DEFAULT 0 — the ONE deliberate exception, for the
--                 same reason `extras` is the exception in rule #19: a new row
--                 with nothing reserved against it genuinely has zero reserved.
--                 Zero reservations is a fact; zero metal is a guess.

CREATE TABLE IF NOT EXISTS inventory_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id    uuid NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  gauge_id       uuid NOT NULL REFERENCES gauges(id)    ON DELETE RESTRICT,
  -- The PRINTED COLOUR NAME, or NULL for a mill finish. Free text on purpose:
  -- lib/data/metal-colors.ts states in its own header that the NAME is the
  -- source of truth for fabrication and ordering and that its hex values are
  -- display approximations. There is no metal_colors TABLE, and a CHECK over
  -- the 69 names in two vendor colour charts would go stale and then silently
  -- refuse real stock. The admin UI offers the known names as a datalist, so
  -- the common case is a pick and the unusual case is still possible.
  finish         text,
  -- NULL for a unit that has no coil width (a `sheet` row's size is the sheet).
  coil_width_in  numeric(6,2),
  -- NO DEFAULT: a quantity without a unit is not a fact. All three quantities
  -- on a row share this row's unit, which is what lets the math be
  -- unit-agnostic (lib/inventory/stock-math.ts).
  stock_unit     text NOT NULL,
  qty_on_hand    numeric(12,2),
  qty_reserved   numeric(12,2) NOT NULL DEFAULT 0,
  reorder_point  numeric(12,2),
  -- RETIRE, NEVER DELETE. inventory_adjustments references this table
  -- ON DELETE RESTRICT, and deleting the thing an append-only history is about
  -- would orphan that history. Same shape as price_book_items (035).
  retired_at     timestamptz,
  retired_by     uuid REFERENCES profiles(id),
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_stock_unit_check') THEN
    -- Four units, and no fifth is guessed. These are the units the repository
    -- itself implies: the price book is built on a 10 ft x 4 ft SHEET
    -- (CLAUDE.md rule #19), the queue item names COIL width, and coil is bought
    -- by the linear foot or by the pound. Adding a unit is a visible migration.
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_stock_unit_check
      CHECK (stock_unit IN ('sheet','coil','linear_foot','pound'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_quantities_non_negative') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_quantities_non_negative
      CHECK (
        (qty_on_hand   IS NULL OR qty_on_hand   >= 0)
        AND qty_reserved >= 0
        AND (reorder_point IS NULL OR reorder_point >= 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_coil_width_positive') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_coil_width_positive
      CHECK (coil_width_in IS NULL OR coil_width_in > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_finish_length') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_finish_length
      CHECK (finish IS NULL OR (length(btrim(finish)) > 0 AND length(finish) <= 120));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_retired_pair') THEN
    -- Retired is retired BY somebody, AT a time, or not at all. A half-set pair
    -- is a bug that would otherwise be invisible.
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_retired_pair
      CHECK ((retired_at IS NULL AND retired_by IS NULL) OR (retired_at IS NOT NULL AND retired_by IS NOT NULL));
  END IF;
END $$;

-- DELIBERATELY NOT CONSTRAINED: `qty_on_hand >= qty_reserved`.
-- A physical count that comes in BELOW what is reserved is a real event —
-- shrinkage, a mis-count, metal that walked. The count is the truth, and
-- refusing it would force somebody to record a number they did not measure. The
-- shortfall surfaces as a NEGATIVE available quantity, which the UI names in
-- words. See lib/inventory/stock-math.ts's `availableQty`.

-- THE IDENTITY INDEX, AND WHY IT IS AN EXPRESSION INDEX RATHER THAN A UNIQUE
-- CONSTRAINT. PostgreSQL's default is NULLS DISTINCT, so a plain
-- UNIQUE (material_id, gauge_id, finish, coil_width_in, stock_unit) would let an
-- unlimited number of duplicate mill-finish rows (finish IS NULL) coexist —
-- which is precisely the row shape AFS has most of. COALESCE makes the NULLs
-- comparable. PARTIAL on `retired_at IS NULL` so retiring a row frees its
-- identity slot and the same item can be created again later.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_identity
  ON inventory_items (
    material_id,
    gauge_id,
    COALESCE(finish, ''),
    COALESCE(coil_width_in, -1),
    stock_unit
  )
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_material ON inventory_items (material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active   ON inventory_items (retired_at) WHERE retired_at IS NULL;

COMMENT ON TABLE inventory_items IS
  'What raw material AFS physically has in the shop. ADMIN ONLY — no customer sees a quantity, ever. Ships EMPTY: no stock number is invented (specs/SPEC_LIVE_INVENTORY.md, CLAUDE.md DATA BLOCKERS).';
COMMENT ON COLUMN inventory_items.qty_on_hand IS
  'NULL means NEVER COUNTED, and renders as "Not counted". It is never defaulted to 0, because 0 is a measurement. CLAUDE.md rule #19 applied to quantities.';
COMMENT ON COLUMN inventory_items.qty_reserved IS
  'Quantity promised to work in progress. NOT NULL DEFAULT 0 is deliberate: nothing reserved is a fact, unlike no metal, which would be a guess. Changed only through inventory_adjustments.';
COMMENT ON COLUMN inventory_items.reorder_point IS
  'NULL means nobody has said what "low" means for this item, so no low-stock judgement is made. 0 is a real threshold ("tell me when it is out") and is NOT the same as NULL.';
COMMENT ON COLUMN inventory_items.stock_unit IS
  'The unit all three quantities on this row are counted in. No default: a quantity without a unit is not a fact.';

-- ===========================================================================
-- 2. inventory_adjustments — THE APPEND-ONLY LEDGER
-- ===========================================================================
--
-- Every change to a quantity, with WHAT changed, WHY, and WHO. A quantity can
-- change in no other way: `inventory_apply_adjustment()` (§4) is the only writer
-- of qty_on_hand / qty_reserved, and it inserts the ledger row in the SAME
-- transaction, so there is no path that moves a number without recording it.
--
-- FIVE KINDS, and the shape constraints below make each one mean exactly one
-- thing:
--   count       a physical count. Sets on hand ABSOLUTELY.
--   receipt     material arrived. Adds to on hand.
--   consumption material was used or scrapped. Subtracts from on hand.
--   reserve     metal promised to a job. Adds to reserved.
--   release     a promise let go. Subtracts from reserved.
--
-- `on_hand_after` / `reserved_after` are a SNAPSHOT of the result, so the log is
-- auditable by reading rather than by replaying every delta from the beginning.
--
-- THREE SOURCES ARE DESIGNED FOR, and two do not exist yet. 'admin_ui' is today.
-- 'erp_sync' is SPEC_LIVE_INVENTORY.md §4's deferred ERP writer: when #55/#56
-- unblock, it becomes one more caller writing adjustments, and the ledger, the
-- math, the low-stock signal and the UI need no change — which is what that
-- section's "architecture already supports this, no refactor needed" means here.
-- 'import' is a historical spreadsheet load. Same shape as pricing_ledger's four
-- designed-for writers (035).

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  kind              text NOT NULL,
  source            text NOT NULL DEFAULT 'admin_ui',
  delta_on_hand     numeric(12,2),
  counted_on_hand   numeric(12,2),
  delta_reserved    numeric(12,2),
  on_hand_after     numeric(12,2),
  reserved_after    numeric(12,2) NOT NULL,
  -- REQUIRED, and not blank. "An append-only adjustment log with reason and
  -- who" is only true if the reason cannot be skipped.
  reason            text NOT NULL,
  adjusted_by       uuid NOT NULL REFERENCES profiles(id),
  -- The idempotency key. See §4: a double-clicked Apply, or a fetch the browser
  -- retried, must not apply a delta twice.
  client_request_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_adjustments_kind_check') THEN
    ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_kind_check
      CHECK (kind IN ('count','receipt','consumption','reserve','release'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_adjustments_source_check') THEN
    ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_source_check
      CHECK (source IN ('admin_ui','erp_sync','import'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_adjustments_reason_not_blank') THEN
    ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_reason_not_blank
      CHECK (length(btrim(reason)) >= 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_adjustments_shape') THEN
    -- Exactly the fields the kind MEANS are present, and the others are NULL.
    -- Without this a row could claim to be a count and carry a reserved delta,
    -- and the log would stop being readable.
    ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_shape
      CHECK (
        (kind = 'count'
           AND counted_on_hand IS NOT NULL
           AND delta_on_hand   IS NULL
           AND delta_reserved  IS NULL)
        OR (kind IN ('receipt','consumption')
           AND delta_on_hand   IS NOT NULL
           AND counted_on_hand IS NULL
           AND delta_reserved  IS NULL)
        OR (kind IN ('reserve','release')
           AND delta_reserved  IS NOT NULL
           AND delta_on_hand   IS NULL
           AND counted_on_hand IS NULL)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_adjustments_sign') THEN
    -- A "receipt" of a negative amount is a mis-keyed consumption, and the
    -- database says so rather than quietly recording the wrong event.
    ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_sign
      CHECK (
        (kind = 'count'       AND counted_on_hand >= 0)
        OR (kind = 'receipt'     AND delta_on_hand  > 0)
        OR (kind = 'consumption' AND delta_on_hand  < 0)
        OR (kind = 'reserve'     AND delta_reserved > 0)
        OR (kind = 'release'     AND delta_reserved < 0)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_adjustments_after_non_negative') THEN
    ALTER TABLE inventory_adjustments ADD CONSTRAINT inventory_adjustments_after_non_negative
      CHECK ((on_hand_after IS NULL OR on_hand_after >= 0) AND reserved_after >= 0);
  END IF;
END $$;

-- The idempotency guarantee, as a constraint rather than as a convention. A
-- repeated POST carrying the same client_request_id cannot insert a second row,
-- so it cannot apply the delta twice even if §4's early return were removed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_adjustments_client_request
  ON inventory_adjustments (item_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_item_created
  ON inventory_adjustments (item_id, created_at DESC);

COMMENT ON TABLE inventory_adjustments IS
  'APPEND ONLY. Every change to an inventory quantity, with its reason and the admin who made it. A row is never changed or removed once written — enforced twice over: a BEFORE UPDATE OR DELETE trigger that raises, and RLS with SELECT and INSERT policies only.';
COMMENT ON COLUMN inventory_adjustments.source IS
  'admin_ui today. erp_sync is SPEC_LIVE_INVENTORY.md §4''s deferred ERP writer and needs no schema change to arrive. import is a historical load.';
COMMENT ON COLUMN inventory_adjustments.client_request_id IS
  'Idempotency key. A double-clicked Apply or a retried fetch returns the original row instead of applying the delta again.';

-- ===========================================================================
-- 3. APPEND-ONLY, ENFORCED BY THE DATABASE — TWICE
-- ===========================================================================
--
-- Two INDEPENDENT refusals, the same belt-and-braces CLAUDE.md rule #20 requires
-- of the pricing ledger, and for the same reason:
--
--   (a) This trigger. It binds the table owner and the SERVICE ROLE too, which a
--       missing policy would not — RLS does not apply to the service role at
--       all. This is not a permission a privileged connection can step around;
--       it is a refusal.
--   (b) RLS with SELECT and INSERT policies and nothing else (§5). That binds a
--       session even if some future migration dropped the trigger.
--
-- A SEPARATE FUNCTION FROM 035's `afs_append_only()`, ON PURPOSE. That one's
-- message says "This table is the pricing history", which would be a misleading
-- error on an inventory row, and it carries a `test_tag` escape hatch that is
-- specific to the pricing ledger's E2E cleanup. This ledger has NO escape hatch
-- at all: there is nothing to clean up, because no inventory row is created by
-- any test. 035's function is not modified here — rule #20 says do not simplify
-- that trigger away, and LAW 7 says do not touch what the task does not need.
CREATE OR REPLACE FUNCTION afs_inventory_append_only() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION
    'APPEND ONLY: % on % is refused. This is the inventory adjustment history; a row is never changed or removed once written. Record a correcting adjustment instead.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = '42501';
END $fn$;

DROP TRIGGER IF EXISTS inventory_adjustments_append_only ON inventory_adjustments;
CREATE TRIGGER inventory_adjustments_append_only
  BEFORE UPDATE OR DELETE ON inventory_adjustments
  FOR EACH ROW EXECUTE FUNCTION afs_inventory_append_only();

-- ===========================================================================
-- 4. ONE TRANSACTION: inventory_apply_adjustment()
-- ===========================================================================
--
-- Two writes have to happen together — the item's quantities move, and the
-- ledger row is inserted — and doing them as two PostgREST calls has two real
-- failure modes: the item moves and the log row is lost, or the log row claims a
-- change that was rejected. Both are unacceptable for an append-only history.
--
-- So: one function, one transaction, with the item row LOCKED.
--
-- IT DOES NOT RECOMPUTE THE BUSINESS MATH, AND THAT IS THE POINT.
-- lib/inventory/stock-math.ts is the ONE place that decides what available
-- means, what counts as low, and which adjustments are legal. This function is
-- handed the already-computed p_on_hand_after / p_reserved_after and enforces
-- only the four things SQL is the right place for: atomicity, the row lock, the
-- caller's expectation, and the table's own CHECK constraints. A second copy of
-- the math in PL/pgSQL would be a competing source of truth, and the two would
-- drift. The CHECKs remain the independent backstop: if the TypeScript ever
-- computed a negative result, the database refuses it.
--
-- SECURITY INVOKER, NOT DEFINER. The caller's RLS still applies, so the
-- admin-only policies in §5 are the real boundary. A SECURITY DEFINER function
-- here would be a documented way around them.
--
-- `IS NOT DISTINCT FROM` for the expectation check, not `=`: qty_on_hand is
-- NULL for a never-counted item, and `NULL = NULL` is UNKNOWN, so `=` would
-- report a conflict on every first count — the one case that is guaranteed to
-- happen.
CREATE OR REPLACE FUNCTION inventory_apply_adjustment(
  p_item_id            uuid,
  p_kind               text,
  p_delta_on_hand      numeric,
  p_counted_on_hand    numeric,
  p_delta_reserved     numeric,
  p_expected_on_hand   numeric,
  p_expected_reserved  numeric,
  p_on_hand_after      numeric,
  p_reserved_after     numeric,
  p_reason             text,
  p_adjusted_by        uuid,
  p_client_request_id  uuid,
  p_source             text DEFAULT 'admin_ui'
) RETURNS inventory_adjustments
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_existing inventory_adjustments;
  v_item     inventory_items;
  v_row      inventory_adjustments;
BEGIN
  -- IDEMPOTENCY FIRST, before the lock: a retry of a request that already
  -- succeeded returns the original row and changes nothing.
  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM inventory_adjustments
     WHERE item_id = p_item_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % does not exist.', p_item_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_item.retired_at IS NOT NULL THEN
    RAISE EXCEPTION 'This item has been retired, so its quantities cannot change.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- OPTIMISTIC CONCURRENCY. Another admin may have moved the number between the
  -- read that produced p_on_hand_after and this write. Refusing is the only
  -- correct answer: the delta was computed against a quantity that no longer
  -- exists.
  IF NOT (v_item.qty_on_hand IS NOT DISTINCT FROM p_expected_on_hand)
     OR NOT (v_item.qty_reserved IS NOT DISTINCT FROM p_expected_reserved) THEN
    RAISE EXCEPTION 'This item changed while you were working on it. Reload and try again.'
      USING ERRCODE = 'serialization_failure';
  END IF;

  UPDATE inventory_items
     SET qty_on_hand  = p_on_hand_after,
         qty_reserved = p_reserved_after,
         updated_at   = now()
   WHERE id = p_item_id;

  INSERT INTO inventory_adjustments (
    item_id, kind, source, delta_on_hand, counted_on_hand, delta_reserved,
    on_hand_after, reserved_after, reason, adjusted_by, client_request_id
  ) VALUES (
    p_item_id, p_kind, p_source, p_delta_on_hand, p_counted_on_hand, p_delta_reserved,
    p_on_hand_after, p_reserved_after, p_reason, p_adjusted_by, p_client_request_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END $fn$;

COMMENT ON FUNCTION inventory_apply_adjustment IS
  'The ONLY writer of inventory_items.qty_on_hand / qty_reserved. One transaction: locks the item, enforces the caller''s expectation, writes the quantities and inserts the ledger row. It does NOT recompute the business math — lib/inventory/stock-math.ts is the one place that decides it.';

-- ===========================================================================
-- 5. RLS — ADMIN ONLY, AND THE LEDGER HAS NO WAY TO BE CHANGED
-- ===========================================================================
--
-- `is_admin()` is this codebase's existing helper (001_initial_schema.sql:15).
-- No customer, and no authenticated non-admin, can read or write either table:
-- a quantity is back-office, and CLAUDE.md's RFQ rule means a customer never
-- sees one.
--
-- NOTE THE ASYMMETRY, AND KEEP IT. inventory_items gets FOR ALL — an item is
-- created, edited and retired. inventory_adjustments gets SELECT and INSERT and
-- NOTHING ELSE: there is no UPDATE policy and no DELETE policy, so a session
-- has no route to either operation even before the §3 trigger is consulted. Do
-- not add one.

ALTER TABLE inventory_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_inventory_items ON inventory_items;
CREATE POLICY admin_all_inventory_items ON inventory_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_read_inventory_adjustments ON inventory_adjustments;
CREATE POLICY admin_read_inventory_adjustments ON inventory_adjustments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS admin_insert_inventory_adjustments ON inventory_adjustments;
CREATE POLICY admin_insert_inventory_adjustments ON inventory_adjustments
  FOR INSERT WITH CHECK (is_admin());

-- ===========================================================================
-- 6. NO SEED. NOT ONE ROW.
-- ===========================================================================
--
-- Migration 035 seeds 24 price-book ITEMS with no prices, because the identity
-- of a price-book line is derivable from materials x gauges while the price is
-- not. Inventory is different: WHICH material, gauge, finish, coil width and
-- unit AFS actually keeps in the shop, and how much of each, is not derivable
-- from anything in this repository. Seeding the cartesian product would create
-- rows for stock AFS may never carry, and every one would read "Not counted"
-- forever — clutter that looks like data.
--
-- So this table starts genuinely empty, the screen says so in plain words, and
-- Steve adds the rows that are real. Per the queue item: "Ship with an empty
-- table and a clear empty state; no invented stock numbers."
--
-- ===========================================================================
-- ROLLBACK (for the record — this file is additive and applies nothing)
-- ===========================================================================
--
--   DROP FUNCTION IF EXISTS inventory_apply_adjustment(
--     uuid, text, numeric, numeric, numeric, numeric, numeric,
--     numeric, numeric, text, uuid, uuid, text);
--   DROP TRIGGER  IF EXISTS inventory_adjustments_append_only ON inventory_adjustments;
--   DROP FUNCTION IF EXISTS afs_inventory_append_only();
--   DROP TABLE    IF EXISTS inventory_adjustments;
--   DROP TABLE    IF EXISTS inventory_items;
--
-- Reversible because nothing outside these two tables is altered: no existing
-- column is added to, renamed or dropped, and no existing row is touched. The
-- down path is left as a comment rather than as runnable SQL on purpose —
-- dropping inventory_adjustments destroys an append-only history, which should
-- never be a command somebody can run by accident.
