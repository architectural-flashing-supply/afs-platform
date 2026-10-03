-- 039_tax_nexus_and_calculations.sql
--
-- Overnight item 08-taxjar — SALES TAX NEXUS AND TAX CALCULATIONS.
-- Specified by EES-OVN.08-TAXJAR-NEXUS-AND-TAX-CALCULATION.md.
--
-- ADDITIVE ONLY. Two new tables, their indexes and their RLS. No ALTER of an
-- existing table, no DROP, no UPDATE of any existing row. Nothing in this file
-- changes a figure on any quote, order or invoice that already exists.
--
-- ===========================================================================
-- THE RULE THIS MIGRATION PUTS IN THE DATABASE
-- ===========================================================================
--
-- AN UNCALCULATED TAX IS NOT A ZERO TAX.
--
-- lib/tax/types.ts enforces that in TypeScript by giving the two non-answers no
-- amount field at all. TypeScript is erased at runtime, so the same rule is
-- enforced here as a CHECK constraint (see tax_calculations below): a row that
-- claims to be a calculated tax must carry an amount, and a row that records a
-- failure must not. Two independent refusals, the same way CLAUDE.md rule #15
-- backs "rush is never inferred" with a Postgres CHECK rather than trusting the
-- writers.
--
-- ===========================================================================
-- 1. tax_nexus_states — WHERE AFS COLLECTS SALES TAX
-- ===========================================================================
--
-- THIS TABLE SHIPS EMPTY, AND THAT IS THE POINT. AFS's nexus state list is an
-- open DATA BLOCKER — CLAUDE.md DATA BLOCKERS, "Tax nexus states", checklist
-- #31. It has to come from AFS's accountant: nexus is established by physical
-- presence, economic thresholds and employee presence, and not one of those is
-- derivable from this codebase. So there is NO seed data in this file, not one
-- state, and an empty table means "nobody has told us yet" — which
-- lib/tax/calculate.ts reports as `not_configured`, never as "no tax owed".
--
-- Inventing a starter list here would be the single most damaging thing this
-- migration could do: it would look configured, calculate confidently, and
-- collect the wrong tax in the wrong states.
--
-- WHY THIS TABLE EXISTS AT ALL, when specs/SPEC_TAXJAR_INTEGRATION.md §2 says
-- nexus is "Configured in TaxJar dashboard — not in code". The two are
-- complementary: TaxJar stays authoritative for RATE LOOKUP, and this table is
-- AFS's own record of what its accountant supplied. It is what makes the admin
-- screen, the empty state, and a provider-independent "we do not collect there"
-- answer possible — and it means the app can refuse to calculate before spending
-- a vendor call, rather than after.
--
-- WHY NO company_id. A tax nexus is a fact about AFS, the SELLER — not about a
-- customer's company. Adding company_id would model AFS as multi-tenant, which
-- it is not, and would invite a future reader to scope AFS's own legal
-- registrations per customer. The tenancy boundary that actually exists here is
-- enforced instead by RLS being admin-only with no authenticated or anon policy
-- at all, exactly as migration 035 does for price_book_items and pricing_ledger.
--
-- ONE ROW PER STATE, with an effective window. A changed nexus is an UPDATE of
-- the window plus an admin_audit_log entry, not a second row — unlike the price
-- book, which is versioned because an old quote must resolve the price it was
-- built on. A past tax calculation does not need to re-derive its nexus: it is
-- snapshotted whole in tax_calculations below. (EES-OVN.08 ADR-2.)

CREATE TABLE IF NOT EXISTS tax_nexus_states (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Two uppercase letters. Normalised by lib/tax/nexus.ts's normalizeStateCode
  -- before it ever gets here; the CHECK is the second line of defence.
  state_code      text NOT NULL,

  -- Whether AFS actually collects here. FALSE is a real and meaningful state:
  -- the accountant has reported nexus but registration is not complete. A row
  -- like that must never produce a calculated tax, and lib/tax/calculate.ts
  -- returns `no_nexus` with a reason that says exactly that.
  collecting      boolean NOT NULL DEFAULT true,

  -- Why nexus exists. The four values mirror the bases named in
  -- SPEC_TAXJAR_INTEGRATION.md §2 plus voluntary registration, and they are the
  -- same four as lib/tax/types.ts's NexusBasis union, so the type and the
  -- constraint cannot drift.
  nexus_basis     text NOT NULL,

  -- The state's own registration number. NULL until AFS supplies it — a blank
  -- here is "not supplied", never a placeholder.
  registration_id text,

  -- Plain YYYY-MM-DD `date`, matching deliveries.scheduled_date's type and the
  -- string convention lib/delivery/business-days.ts established (CLAUDE.md rule
  -- #24): a date-only value has no instant and no offset.
  effective_from  date NOT NULL,
  -- NULL means "still current".
  effective_to    date,

  note            text,

  created_by      uuid REFERENCES profiles(id),
  updated_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  -- ONE ROW PER STATE. A double click on "Add state" cannot create two, the same
  -- reason deliveries.shop_job_id and invoices.quote_id are unique.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_nexus_states_state_code_key') THEN
    ALTER TABLE tax_nexus_states ADD CONSTRAINT tax_nexus_states_state_code_key UNIQUE (state_code);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_nexus_states_code_format') THEN
    ALTER TABLE tax_nexus_states ADD CONSTRAINT tax_nexus_states_code_format
      CHECK (state_code ~ '^[A-Z]{2}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_nexus_states_basis_known') THEN
    ALTER TABLE tax_nexus_states ADD CONSTRAINT tax_nexus_states_basis_known
      CHECK (nexus_basis IN ('physical_presence', 'economic_threshold', 'employee_presence', 'voluntary'));
  END IF;

  -- A window that ends before it starts is a data-entry slip that would silently
  -- make the row apply on no day at all.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_nexus_states_window_ordered') THEN
    ALTER TABLE tax_nexus_states ADD CONSTRAINT tax_nexus_states_window_ordered
      CHECK (effective_to IS NULL OR effective_to >= effective_from);
  END IF;
END $$;

-- ===========================================================================
-- 2. tax_calculations — THE CACHE AND THE RECORD, IN ONE TABLE
-- ===========================================================================
--
-- ONE TABLE DOES BOTH JOBS (EES-OVN.08 ADR-3). Both want the same columns; a
-- separate cache table would duplicate the request snapshot, and two tables
-- could disagree about what was calculated.
--
-- ONLY PROVIDER INTERACTIONS ARE STORED. `not_configured`, `exempt` and
-- `no_nexus` are decided locally, cost nothing to recompute, and write no row —
-- which is what keeps this table meaningful: every row here is a real
-- conversation with a tax service. Hence the outcome CHECK admits exactly two
-- values.
--
-- A FAILURE IS RECORDED BUT NEVER CACHED. A failed row gets expires_at = NULL
-- and requires_review = true, so it shows up on the admin screen and is never
-- served to a later request. Serving a cached failure would turn one vendor
-- blip into a day of refusals.
--
-- THE SNAPSHOT IS WHAT MAKES A PAST CALCULATION REPRODUCIBLE, and it is why the
-- nexus table does not need to be versioned: request_snapshot, response_snapshot
-- and nexus_fingerprint together record what was asked, what came back, and what
-- AFS's nexus list looked like at that moment.
--
-- MONEY IS CENTS, as everywhere in this codebase (migration 035's money
-- columns, lib/pricing/*).

CREATE TABLE IF NOT EXISTS tax_calculations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SHA-256 hex from lib/tax/cache-key.ts. Hashed rather than raw JSON because
  -- this column is indexed and appears in query plans, and a raw key would put
  -- a customer's ZIP there.
  cache_key            text NOT NULL,

  provider             text NOT NULL,

  -- Exactly two values — see the header. 'calculated' or 'failed'.
  outcome              text NOT NULL,

  -- NULL FOR A FAILURE, AND THE CHECK BELOW ENFORCES IT. Never 0: a zero here
  -- would be a tax figure, and a made-up one. This is the same discipline
  -- migration 035 applies to the price book's nullable money columns.
  amount_cents         bigint,
  rate                 numeric(8, 6),
  taxable_amount_cents bigint,
  freight_taxable      boolean,
  jurisdictions        jsonb,

  -- What was asked. to_state/to_zip are duplicated out of request_snapshot so
  -- the admin review list can be read without parsing JSON.
  to_state             text,
  to_zip               text,
  subtotal_cents       bigint NOT NULL,
  shipping_cents       bigint NOT NULL DEFAULT 0,
  customer_tax_exempt  boolean NOT NULL DEFAULT false,

  -- From lib/tax/nexus.ts's nexusFingerprint. Recorded as well as hashed into
  -- cache_key so a human can see which nexus list produced a figure.
  nexus_fingerprint    text,

  request_snapshot     jsonb NOT NULL,
  -- The vendor's raw body on success, or NULL. Never contains the API key — the
  -- key is only ever a request header (lib/tax/providers/taxjar.ts).
  response_snapshot    jsonb,
  -- One entry per thing that was wrong, on a failure.
  problems             jsonb,

  -- The review queue. A failure is surfaced to a person rather than swallowed.
  requires_review      boolean NOT NULL DEFAULT false,
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES profiles(id),
  review_note          text,

  -- Optional links to whatever the calculation was for. Both nullable: the admin
  -- preview on the Tax nexus screen belongs to neither.
  quote_id             uuid REFERENCES quotes(id) ON DELETE SET NULL,
  quote_request_id     uuid REFERENCES quote_requests(id) ON DELETE SET NULL,

  -- NULL on a failure, which is how a failure is kept out of the cache.
  expires_at           timestamptz,
  created_by           uuid REFERENCES profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_calculations_outcome_known') THEN
    ALTER TABLE tax_calculations ADD CONSTRAINT tax_calculations_outcome_known
      CHECK (outcome IN ('calculated', 'failed'));
  END IF;

  -- ===================== THE LOAD-BEARING CONSTRAINT =====================
  --
  -- A calculated row MUST carry an amount; a failed row MUST NOT. Written as an
  -- equality of two booleans so both directions hold in one expression and
  -- neither can be satisfied by accident.
  --
  -- NOTE THE ABSENCE OF A NULL HAZARD HERE, and why it is worth saying. CLAUDE.md
  -- rule #15 records that the naive rush CHECK was ACCEPTED by Postgres for a
  -- NULL source, because `false OR UNKNOWN` is UNKNOWN and a CHECK accepts
  -- UNKNOWN. This expression cannot go UNKNOWN: `outcome` is NOT NULL, so the
  -- left side is always a real boolean, and `amount_cents IS NOT NULL` is always
  -- a real boolean by construction. Do not rewrite it into a form that compares
  -- amount_cents with = or <>, which WOULD go UNKNOWN on a NULL and would
  -- silently accept exactly the rows this forbids.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_calculations_amount_matches_outcome') THEN
    ALTER TABLE tax_calculations ADD CONSTRAINT tax_calculations_amount_matches_outcome
      CHECK ((outcome = 'calculated') = (amount_cents IS NOT NULL));
  END IF;

  -- A negative tax is not a thing, and a negative basis is a data error.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_calculations_amounts_non_negative') THEN
    ALTER TABLE tax_calculations ADD CONSTRAINT tax_calculations_amounts_non_negative
      CHECK (
        (amount_cents IS NULL OR amount_cents >= 0)
        AND (taxable_amount_cents IS NULL OR taxable_amount_cents >= 0)
        AND (rate IS NULL OR rate >= 0)
        AND subtotal_cents >= 0
        AND shipping_cents >= 0
      );
  END IF;

  -- A FAILURE IS NEVER CACHEABLE. Expressed as a constraint rather than left to
  -- the writer, so a future caller cannot make a failure servable by setting an
  -- expiry on it.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_calculations_failure_never_cached') THEN
    ALTER TABLE tax_calculations ADD CONSTRAINT tax_calculations_failure_never_cached
      CHECK (outcome <> 'failed' OR expires_at IS NULL);
  END IF;
END $$;

-- The cache read: lib/tax/db.ts looks up by cache_key with an unexpired row.
CREATE INDEX IF NOT EXISTS idx_tax_calculations_cache
  ON tax_calculations (cache_key, expires_at);

-- The review queue. Partial, because the rows that need review are a small
-- minority and a full index would be mostly wasted.
CREATE INDEX IF NOT EXISTS idx_tax_calculations_review
  ON tax_calculations (created_at DESC)
  WHERE requires_review;

CREATE INDEX IF NOT EXISTS idx_tax_calculations_created
  ON tax_calculations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tax_calculations_quote
  ON tax_calculations (quote_id)
  WHERE quote_id IS NOT NULL;

-- ===========================================================================
-- 3. RLS — ADMIN ONLY, BOTH TABLES
-- ===========================================================================
--
-- Identical to migration 035's price_book_items / price_book_versions policies,
-- for the same reason: this is AFS's own internal configuration and AFS's own
-- record of vendor conversations. A customer has no business reading either.
--
-- THERE IS DELIBERATELY NO `authenticated` POLICY AND NO `anon` POLICY. With RLS
-- enabled and no policy matching a role, that role can read nothing — which is
-- the tenancy boundary that actually exists for AFS-global configuration (see
-- the company_id note on tax_nexus_states above). `is_admin()` is defined in
-- 001_initial_schema.sql.

ALTER TABLE tax_nexus_states  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_calculations  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_tax_nexus_states ON tax_nexus_states;
CREATE POLICY admin_all_tax_nexus_states ON tax_nexus_states FOR ALL USING (is_admin());

DROP POLICY IF EXISTS admin_all_tax_calculations ON tax_calculations;
CREATE POLICY admin_all_tax_calculations ON tax_calculations FOR ALL USING (is_admin());

-- ===========================================================================
-- 4. NO SEED DATA
-- ===========================================================================
--
-- Deliberate, and the most important four lines in this file. tax_nexus_states
-- stays EMPTY until AFS's accountant supplies the real list (checklist #31).
-- An empty table means "not configured", which the application reports as such
-- and which stops it calculating anything. It does NOT mean "no tax is owed".
