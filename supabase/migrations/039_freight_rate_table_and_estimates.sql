-- 039_freight_rate_table_and_estimates.sql
--
-- THE FREIGHT ESTIMATOR — a rate table AFS configures itself, and an
-- append-only record of every freight decision that reached a quote.
--
-- SPEC_FREIGHT_ESTIMATOR.md wants a freight calculator on the quote screen and
-- lists six things it cannot have until the client supplies them: the origin ZIP
-- (#5), the carrier and its rate structures (#27-28), own-truck vs third-party
-- (#80), the free-freight threshold (#30), the residential surcharge (#29) and
-- the liftgate upcharge (#88). Its own §3 therefore records the interim
-- behaviour as "estimator enters freight amount manually until data received",
-- which is exactly what components/admin/QuoteEstimatorForm.tsx has always done.
--
-- THIS MIGRATION DOES NOT GUESS AT ANY OF THE SIX. It creates the SHAPE Steve
-- fills in, and it creates it EMPTY: no zone, no band, no rate, no adder, no
-- threshold, and not one monetary DEFAULT anywhere below. A freight figure is
-- either one a human at AFS typed or it does not exist. Everything the
-- estimator shows beyond that is derived from data this repo already has —
-- the NMFC-style freight class from the longest piece (spec §4, a pure
-- classification the spec states in full) and the estimated shipment weight
-- from seeded gauges.weight_lbs_sqft.
--
-- ===========================================================================
-- WHY FIVE TABLES AND NOT ONE
-- ===========================================================================
--
-- The same reason migration 035 split the price book in two: A RATE HAS A
-- LIFETIME. A zone is an identity, a weight band inside it is an identity, and
-- what that band COSTS is a dated version of which there may be many. Editing a
-- rate INSERTS a version; it never overwrites one, and the database refuses the
-- update anyway. A quote issued last spring therefore keeps the freight it was
-- built on even after the carrier raises its tariff — the same promise
-- price_book_versions makes about material, stated the same way, enforced by
-- the same trigger.
--
--   freight_zones              identity: a destination zone Steve bills by
--   freight_rate_bands         identity: a weight band inside one zone
--   freight_rate_versions      what a band costs, from when   (APPEND-ONLY)
--   freight_surcharge_versions the adders and the threshold   (APPEND-ONLY)
--   freight_estimates          every freight decision on a quote (APPEND-ONLY)
--
-- MONEY IS CENTS, INTEGER, EVERYWHERE IN HERE — like price_book_versions,
-- pricing_ledger and invoices. The legacy quotes.freight column is
-- DECIMAL(10,2) dollars and is left exactly as it is; the application converts
-- at that one boundary rather than altering a customer-facing money column
-- five other modules already read.
--
-- ===========================================================================
-- A FLAT CHARGE PER BAND, AND WHY NOT PER HUNDREDWEIGHT
-- ===========================================================================
--
-- Checklist #80 — own truck or third-party carrier — is UNRESOLVED. So whether
-- AFS will bill an LTL rate per hundredweight with a minimum charge, a flat
-- price per zone, or its own truck's cost is genuinely unknown. A flat charge
-- per (zone x weight band) can express ALL THREE given enough bands. A
-- per-cwt-with-minimum table cannot express flat zone pricing without
-- inventing structure, so it is the shape that can mis-state the others, and
-- this one is not. If the real tariff turns out to be per-cwt, that is one
-- additive nullable column on freight_rate_versions in a later migration — not
-- a redesign. Recorded as UNRESOLVED-01 in EES-OVN.05.
--
-- ===========================================================================
-- IDEMPOTENT
-- ===========================================================================
--
-- Every object IF NOT EXISTS, every constraint added only when pg_constraint
-- does not already have it, every policy dropped before it is created, every
-- trigger dropped before it is created. Safe to re-run. Same construction as
-- migration 035, deliberately.
--
-- DEPENDS ON, and does not redefine: is_admin() (migration 001) and
-- afs_append_only() (migration 035).

-- ===========================================================================
-- 1. ZONES — the identity of a destination Steve bills by
-- ===========================================================================
--
-- NOT A ZIP CODE, AND DELIBERATELY SO. quote_requests.jobsite_address is a
-- single opaque free-text string; regex-extracting a ZIP from it to drive a
-- lane lookup is precisely the fragile looks-complete-but-isn't logic this
-- feature must not contain. The estimator PICKS a zone. Nothing is inferred
-- from an address, and the address stays the read-only display text it is.
--
-- No zone is seeded, because there is no carrier yet and therefore no zone map.

CREATE TABLE IF NOT EXISTS freight_zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  note          text,
  display_order integer NOT NULL DEFAULT 0,
  -- Retiring never deletes: a quote issued against this zone still has to
  -- resolve, and freight_estimates keeps a foreign key to it forever.
  retired_at    timestamptz,
  retired_by    uuid REFERENCES profiles(id),
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_zones_name_key') THEN
    ALTER TABLE freight_zones ADD CONSTRAINT freight_zones_name_key UNIQUE (name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_freight_zones_order ON freight_zones (display_order, name);

COMMENT ON TABLE freight_zones IS
  'Destination zones AFS bills freight by. Admin-entered, never seeded and never derived from a customer address — quote_requests.jobsite_address is one opaque string and parsing a ZIP out of it would be a guess dressed as a lookup.';

-- ===========================================================================
-- 2. WEIGHT BANDS — the identity of a band inside one zone
-- ===========================================================================
--
-- A BAND IS [min, max) — INCLUSIVE FLOOR, EXCLUSIVE CEILING. That is the whole
-- reason the boundaries are unambiguous: bands [0,500) and [500,1000) are
-- contiguous with neither a gap nor an overlap, and a shipment of exactly
-- 500 lb lands in exactly one of them. max_weight_lbs IS NULL means the
-- OPEN-ENDED TOP BAND, covering everything at or above its min.
--
-- The CHECKs below stop the two faults a single row can carry (a max at or
-- below its min, a negative min). The faults that span rows — an overlap, a
-- gap, a second open-ended band — are detected in
-- lib/freight/bands.ts's validateBandCoverage and REFUSED at estimate time
-- with the offending bands named, because a table like that must not quietly
-- return whichever band happened to sort first.
--
-- No band is seeded.

CREATE TABLE IF NOT EXISTS freight_rate_bands (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id         uuid NOT NULL REFERENCES freight_zones(id) ON DELETE RESTRICT,
  min_weight_lbs  integer NOT NULL,
  -- NULL = open-ended top band. There may be at most one per zone, which is a
  -- cross-row rule and so lives in validateBandCoverage, not in a CHECK.
  max_weight_lbs  integer,
  display_order   integer NOT NULL DEFAULT 0,
  retired_at      timestamptz,
  retired_by      uuid REFERENCES profiles(id),
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_rate_bands_zone_min_key') THEN
    ALTER TABLE freight_rate_bands ADD CONSTRAINT freight_rate_bands_zone_min_key UNIQUE (zone_id, min_weight_lbs);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_rate_bands_min_non_negative') THEN
    ALTER TABLE freight_rate_bands ADD CONSTRAINT freight_rate_bands_min_non_negative CHECK (min_weight_lbs >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_rate_bands_max_above_min') THEN
    ALTER TABLE freight_rate_bands ADD CONSTRAINT freight_rate_bands_max_above_min CHECK (
      max_weight_lbs IS NULL OR max_weight_lbs > min_weight_lbs
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_freight_rate_bands_zone
  ON freight_rate_bands (zone_id, min_weight_lbs);

COMMENT ON TABLE freight_rate_bands IS
  'Weight bands inside a zone. A band covers [min_weight_lbs, max_weight_lbs) — inclusive floor, exclusive ceiling — so adjacent bands are contiguous and a weight exactly on a boundary belongs to exactly one band. max_weight_lbs NULL is the open-ended top band.';
COMMENT ON COLUMN freight_rate_bands.max_weight_lbs IS
  'EXCLUSIVE upper bound in pounds. NULL means no upper bound (the top band). At most one NULL per zone — a cross-row rule enforced in lib/freight/bands.ts, which refuses an estimate rather than guessing which open band to use.';

-- ===========================================================================
-- 3. WHAT A BAND COSTS, FROM WHEN — APPEND-ONLY
-- ===========================================================================
--
-- rate_cents IS NULLABLE WITH NO DEFAULT, and that is the single most important
-- line in this file. NULL means Steve has not filled it in. It renders as a
-- marked "Not set" chip and lib/freight/estimate.ts REFUSES to produce a
-- freight figure that needs it, naming the band to go and fix. There is
-- deliberately no DEFAULT 0, because a zero is a price, and a made-up one — and
-- a made-up freight price lands on a customer's formal quote.

CREATE TABLE IF NOT EXISTS freight_rate_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id        uuid NOT NULL REFERENCES freight_rate_bands(id) ON DELETE RESTRICT,
  -- NULLABLE ON PURPOSE. NULL = blank, never 0, never a guess.
  rate_cents     integer,
  effective_from date NOT NULL,
  note           text,
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_rate_versions_band_effective_key') THEN
    ALTER TABLE freight_rate_versions ADD CONSTRAINT freight_rate_versions_band_effective_key UNIQUE (band_id, effective_from);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_rate_versions_non_negative') THEN
    ALTER TABLE freight_rate_versions ADD CONSTRAINT freight_rate_versions_non_negative CHECK (
      rate_cents IS NULL OR rate_cents >= 0
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_freight_rate_versions_band_effective
  ON freight_rate_versions (band_id, effective_from DESC);

COMMENT ON TABLE freight_rate_versions IS
  'Versioned band rates. An edit INSERTS a row with a new effective_from; it never updates one, and the freight_rate_versions_append_only trigger refuses the update regardless. A quote already sent keeps the freight it was built on.';
COMMENT ON COLUMN freight_rate_versions.rate_cents IS
  'Flat charge for a shipment in this band, in cents. NULL means not filled in: it renders as a marked blank and blocks the estimate. Never defaulted to 0.';

-- ===========================================================================
-- 4. THE ADDERS AND THE THRESHOLD — APPEND-ONLY
-- ===========================================================================
--
-- One versioned row rather than three separate tables, because the estimator
-- reads all three together and "what were the surcharges on the day we quoted"
-- is one question.
--
-- ALL THREE ARE NULLABLE WITH NO DEFAULT, and each NULL means something precise:
--
--   residential_cents NULL  — the residential surcharge (#29) is unknown. A
--     quote with the residential toggle ON is then REFUSED, not charged 0. A
--     toggle switched on whose adder is blank is a question nobody has
--     answered; answering it with zero would under-quote every residential
--     delivery AFS ever makes.
--   liftgate_cents NULL     — same, for the liftgate upcharge (#88).
--   free_freight_threshold_cents NULL — the free-freight threshold (#30) is
--     unknown, so the RULE IS NOT APPLIED. Not applying a discount can only
--     ever over-quote, and the estimator reviews and can override every figure
--     before it is sent; applying an unconfigured discount would silently
--     under-quote. The estimate says in words that no threshold is configured,
--     so the non-application is visible rather than assumed.
--
-- No row is seeded, so surchargesInForce() returns null, which is a THIRD
-- distinct state: nothing has ever been set. That is not the same fact as
-- "set to zero", and the code keeps them apart.

CREATE TABLE IF NOT EXISTS freight_surcharge_versions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- All three NULLABLE ON PURPOSE. See the block comment above: each NULL means
  -- a different specific thing, and none of them means zero.
  residential_cents             integer,
  liftgate_cents                integer,
  free_freight_threshold_cents  bigint,
  effective_from                date NOT NULL,
  note                          text,
  created_by                    uuid REFERENCES profiles(id),
  created_at                    timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_surcharge_versions_effective_key') THEN
    ALTER TABLE freight_surcharge_versions ADD CONSTRAINT freight_surcharge_versions_effective_key UNIQUE (effective_from);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_surcharge_versions_non_negative') THEN
    ALTER TABLE freight_surcharge_versions ADD CONSTRAINT freight_surcharge_versions_non_negative CHECK (
      (residential_cents IS NULL OR residential_cents >= 0)
      AND (liftgate_cents IS NULL OR liftgate_cents >= 0)
      AND (free_freight_threshold_cents IS NULL OR free_freight_threshold_cents >= 0)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_freight_surcharge_versions_effective
  ON freight_surcharge_versions (effective_from DESC);

COMMENT ON TABLE freight_surcharge_versions IS
  'Residential adder (#29), liftgate adder (#88) and free-freight threshold (#30), versioned together because the estimator reads them together. All three NULLABLE with no default: a blank adder with its toggle on REFUSES the estimate, and a blank threshold means the rule is simply not applied.';

-- ===========================================================================
-- 5. THE AUDIT TRAIL — EVERY FREIGHT DECISION, APPEND-ONLY
-- ===========================================================================
--
-- One row per freight figure that reached a quote, carrying the inputs as they
-- were, what the table computed, what the estimator typed instead, which of the
-- two went on the quote, and the exact rate-version ids it was all resolved
-- from. "Why is the freight on this quote this number" is one row, forever.
--
-- NOT pricing_ledger, and that is a decision rather than an oversight.
-- Recording freight there would mean either extending its event_type CHECK — a
-- change to an existing constraint CLAUDE.md rule #20 governs — or overloading
-- its 'estimate' event with a second meaning. A dedicated table leaves the
-- ledger's vocabulary intact and makes "every freight decision we ever made"
-- one query. Recorded as ADR-2 in EES-OVN.05.
--
-- THE THREE BASIS CHECKS BELOW ARE LOAD-BEARING. basis is the answer to "where
-- did this number come from", and without them the three cases could disagree
-- with the amounts beside them:
--
--   'estimate' — the table produced it and nobody changed it.
--   'override' — the table produced one and the estimator typed a different
--                figure. BOTH are kept. An override of 0 is a real override
--                (freight waived by hand), which is why every amount here is
--                checked against NULL and never against falsiness.
--   'manual'   — the table could NOT produce a figure (blank rate, no band,
--                oversize piece, nothing configured at all) and the estimator
--                typed one. computed_cents is NULL and the refusals that
--                blocked the estimate are kept in `refusals`, so the record
--                says why there was nothing to compare against.

CREATE TABLE IF NOT EXISTS freight_estimates (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHAT IT IS ABOUT
  quote_id                  uuid REFERENCES quotes(id),
  quote_request_id          uuid REFERENCES quote_requests(id),

  -- THE INPUTS, AS THEY WERE AT THE MOMENT OF THE DECISION. Stored rather than
  -- re-derived: the line items can change afterwards, and then a recomputation
  -- would no longer explain the figure that was actually sent.
  zone_id                   uuid REFERENCES freight_zones(id),
  zone_name                 text,
  weight_lbs                numeric,
  -- From lib/admin/pricing.ts's estimateShipmentWeight: how many line items
  -- matched seeded gauge weights and how many there were. A weight derived from
  -- 2 of 5 items is a different fact from one derived from 5 of 5, and the
  -- estimator sees that caveat, so the record keeps it too.
  weight_lbs_matched        integer,
  weight_lbs_total_items    integer,
  longest_piece_ft          numeric,
  -- SPEC_FREIGHT_ESTIMATOR.md §4's NMFC-style class. Derived, needs no rate
  -- data, and stored because it is part of why the figure is what it is.
  freight_class             text,
  is_residential            boolean NOT NULL,
  requires_liftgate         boolean NOT NULL,
  merchandise_subtotal_cents bigint,

  -- THE OUTCOME
  basis                     text NOT NULL,
  computed_cents            bigint,
  override_cents            bigint,
  final_cents               bigint NOT NULL,

  -- EXACTLY WHAT IT WAS RESOLVED FROM
  band_id                   uuid REFERENCES freight_rate_bands(id),
  rate_version_ids          uuid[],
  surcharge_version_id      uuid REFERENCES freight_surcharge_versions(id),
  breakdown                 jsonb,
  refusals                  jsonb,
  notes                     text,
  override_reason           text,

  -- WHO
  actor_id                  uuid REFERENCES profiles(id),
  actor_email               text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_estimates_basis_check') THEN
    ALTER TABLE freight_estimates ADD CONSTRAINT freight_estimates_basis_check CHECK (
      basis IN ('estimate', 'override', 'manual')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_estimates_final_non_negative') THEN
    ALTER TABLE freight_estimates ADD CONSTRAINT freight_estimates_final_non_negative CHECK (
      final_cents >= 0
      AND (computed_cents IS NULL OR computed_cents >= 0)
      AND (override_cents IS NULL OR override_cents >= 0)
    );
  END IF;
  -- 'estimate': the table produced it and nobody changed it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_estimates_basis_estimate') THEN
    ALTER TABLE freight_estimates ADD CONSTRAINT freight_estimates_basis_estimate CHECK (
      basis <> 'estimate'
      OR (computed_cents IS NOT NULL AND override_cents IS NULL AND final_cents = computed_cents)
    );
  END IF;
  -- 'override': the table produced one, a human typed another, both are kept.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_estimates_basis_override') THEN
    ALTER TABLE freight_estimates ADD CONSTRAINT freight_estimates_basis_override CHECK (
      basis <> 'override'
      OR (computed_cents IS NOT NULL AND override_cents IS NOT NULL AND final_cents = override_cents)
    );
  END IF;
  -- 'manual': the table could not produce one at all.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freight_estimates_basis_manual') THEN
    ALTER TABLE freight_estimates ADD CONSTRAINT freight_estimates_basis_manual CHECK (
      basis <> 'manual'
      OR (computed_cents IS NULL AND override_cents IS NOT NULL AND final_cents = override_cents)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_freight_estimates_quote   ON freight_estimates (quote_id);
CREATE INDEX IF NOT EXISTS idx_freight_estimates_request ON freight_estimates (quote_request_id);
CREATE INDEX IF NOT EXISTS idx_freight_estimates_created ON freight_estimates (created_at DESC);

COMMENT ON TABLE freight_estimates IS
  'APPEND-ONLY. One row per freight figure that reached a quote: the inputs as they were, what the rate table computed, what the estimator typed instead, which of the two was sent, and the rate-version ids it was resolved from. Enforced by the freight_estimates_append_only trigger and by having no UPDATE or DELETE policy at all.';
COMMENT ON COLUMN freight_estimates.basis IS
  'Where the figure came from: estimate (the table produced it, unchanged), override (the table produced one and a human typed another — both kept), manual (the table could not produce one; refusals says why). An override of 0 is a real override, so every amount here is tested against NULL and never against falsiness.';

-- ===========================================================================
-- 6. APPEND-ONLY, ENFORCED BY THE DATABASE
-- ===========================================================================
--
-- afs_append_only() is migration 035's, reused unchanged. It binds the table
-- owner and the service role too, which a REVOKE would not: this is a refusal
-- rather than a permission a privileged connection can step around.
--
-- Its test_tag escape hatch does not apply to any of these three tables —
-- none of them has that column, and the function reads it through
-- `to_jsonb(OLD) ->> 'test_tag'` precisely so that it is column-agnostic and
-- raises the right error on a table that lacks it.

DROP TRIGGER IF EXISTS freight_rate_versions_append_only ON freight_rate_versions;
CREATE TRIGGER freight_rate_versions_append_only
  BEFORE UPDATE OR DELETE ON freight_rate_versions
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

DROP TRIGGER IF EXISTS freight_surcharge_versions_append_only ON freight_surcharge_versions;
CREATE TRIGGER freight_surcharge_versions_append_only
  BEFORE UPDATE OR DELETE ON freight_surcharge_versions
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

DROP TRIGGER IF EXISTS freight_estimates_append_only ON freight_estimates;
CREATE TRIGGER freight_estimates_append_only
  BEFORE UPDATE OR DELETE ON freight_estimates
  FOR EACH ROW EXECUTE FUNCTION afs_append_only();

-- ===========================================================================
-- 7. RLS — ADMIN ONLY, AND NO CUSTOMER POLICY ON ANY OF THEM
-- ===========================================================================
--
-- CLAUDE.md's business model: a customer sees a dollar amount only on a formal
-- AFS-generated quote or invoice. The freight rate table, the bands, the adders,
-- the class, the estimated weight and the audit trail are all BACK OFFICE. The
-- customer sees the resulting figure on their quote (quotes.freight, which has
-- its own long-standing policy) and nothing else — so there is deliberately no
-- customer-readable policy on any table in this migration, not even a
-- read-your-own one.
--
-- NOT company_id-SCOPED, and that is correct rather than lazy. company_id in
-- this schema scopes CUSTOMER data — projects, templates, profile_passport,
-- credit applications. These five tables are AFS's own cost of shipping, in the
-- same category as price_book_items and pricing_ledger, which migration 035
-- scopes with is_admin() and no company_id. Scoping AFS's carrier rates by
-- customer company would be wrong, not merely unnecessary.

ALTER TABLE freight_zones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_rate_bands          ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_rate_versions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_surcharge_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_estimates           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_freight_zones ON freight_zones;
CREATE POLICY admin_all_freight_zones ON freight_zones FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_all_freight_rate_bands ON freight_rate_bands;
CREATE POLICY admin_all_freight_rate_bands ON freight_rate_bands FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_all_freight_rate_versions ON freight_rate_versions;
CREATE POLICY admin_all_freight_rate_versions ON freight_rate_versions FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_all_freight_surcharge_versions ON freight_surcharge_versions;
CREATE POLICY admin_all_freight_surcharge_versions ON freight_surcharge_versions FOR ALL USING (is_admin());

-- freight_estimates gets SELECT and INSERT ONLY. There is deliberately no
-- UPDATE policy and no DELETE policy at all, so even an admin session has no
-- policy that would let one through if the trigger above were ever dropped —
-- two independent refusals rather than one. Same construction as
-- pricing_ledger in migration 035. Do not add one.
DROP POLICY IF EXISTS admin_read_freight_estimates ON freight_estimates;
CREATE POLICY admin_read_freight_estimates ON freight_estimates FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS admin_insert_freight_estimates ON freight_estimates;
CREATE POLICY admin_insert_freight_estimates ON freight_estimates FOR INSERT WITH CHECK (is_admin());

-- ===========================================================================
-- 8. NOTHING IS SEEDED. ON PURPOSE.
-- ===========================================================================
--
-- There is no INSERT in this file. Not a zone, not a band, not a rate, not an
-- adder, not a threshold, not a carrier name. The carrier and its rate
-- structures are checklist #27-28 and have not arrived; the residential
-- surcharge is #29, the free-freight threshold #30, the liftgate upcharge #88,
-- and own-truck-vs-third-party is #80. Every one of them is still open.
--
-- So the freight estimator ships with an empty table and says so in plain
-- English on its own screen, and the manual dollar entry that has always been
-- on the quote screen remains the whole of the feature until Steve fills the
-- table in. That is SPEC_FREIGHT_ESTIMATOR.md §3's own documented interim
-- behaviour, not a shortfall against it.
--
-- Compare migration 035 §9, which DOES seed 24 price-book rows — but only their
-- material and gauge IDENTITIES, and not one price. Same principle: seed the
-- shape when the shape is known from data the repo already has, and never seed
-- a number a human has to supply. Here not even the identities are known,
-- because a zone map is carrier-specific.
