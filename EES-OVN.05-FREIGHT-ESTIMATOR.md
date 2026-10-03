# EES-OVN.05 — FREIGHT ESTIMATOR (MANUAL-ENTRY-FIRST, CONFIGURABLE RATE TABLE)

**Prompt ID:** EES-OVN.05
**Prompt Name:** Freight Estimator — manual-entry-first, admin-configurable rate table, override with audit trail
**Item:** `05-freight-estimator`
**Branch:** `ovn/05-freight-estimator` (git worktree of `C:\Users\manag\Documents\afs-website`)
**Date:** 2026-10-03
**Author:** FORGE overnight run, unattended

---

## 1. IDENTITY

This is the Engineering Execution Specification for queue item `05-freight-estimator`.
It governs the implementation that follows it in the same run. It is written
before any implementation code, per ELITE ENGINEERING METHODOLOGY LAW 1.

---

## 2. OBJECTIVE

Give an AFS estimator an **admin-only** freight estimator on the quote screen that
produces a freight figure from a **rate table AFS itself configures**, shows that
figure to the estimator only, lets the estimator **override** it, records both the
computed figure and the override in an **append-only audit trail**, and puts the
final number on the formal quote as the single customer-visible freight line.

The estimator ships with an **empty rate table**. Not one dollar figure is invented
by this work. Until Steve fills the table in, the screen says so in plain English and
the existing manual dollar entry remains the whole of the feature — which is
`SPEC_FREIGHT_ESTIMATOR.md` §3's own documented interim behaviour.

---

## 3. ENGINEERING CONTEXT

### 3.1 Source-of-truth precedence applied here

Per the Canonical Laws' SOURCE-OF-TRUTH PRECEDENCE, this specification was built from
(1) the functioning repository, (2) the migrations, and only then (4) the project
specifications. Where they conflict, §3.4 records the conflict rather than silently
picking one.

### 3.2 What the specifications say

`specs/SPEC_FREIGHT_ESTIMATOR.md` (the canonical spec; the queue item names it as
`SPEC_FREIGHT_ESTIMATOR.md`, and it exists at `specs/SPEC_FREIGHT_ESTIMATOR.md` —
there is no root-level file of that name):

- §2 places a `FreightCalculatorPanel` in `/admin/quote-requests/[id]`, below line-item
  pricing, with inputs **destination ZIP, estimated weight, longest piece, residential
  toggle, liftgate toggle**; a **Calculate Freight** action; a result showing estimated
  freight, freight class, residential adder, liftgate adder, free-freight threshold;
  an **editable override**; and an **Add to Quote** action that "applies freight amount
  to formal quote as a line item" where "estimator can override the amount before adding".
- §3 lists six data blockers (#5 origin ZIP, #27–28 carrier and rate structures, #80 own
  truck vs third party, #30 free-freight threshold, #29 residential surcharge, #88
  liftgate upcharge) and states the interim behaviour: *"estimator enters freight amount
  manually until data received."*
- §4 gives, in full and requiring no client data, the NMFC-style class table
  (`≤8 → 85`, `≤12 → 92.5`, `≤16 → 100`, else `110`) and the rule that pieces
  **over 24 ft** may need flatbed service and an oversize permit, with
  *"Admin manual entry required — no auto-calculation for extreme lengths."*

`PRICING_ENGINE.md` §7 repeats §4's class function verbatim and defines `FreightInput`
(`destinationZip`, `orderWeightLbs`, `longestPieceFt`, `isResidential`,
`requiresLiftgate`) and `FreightResult` (`estimatedCost`, `carrier`, `freightClass`,
`residentialAdder`, `liftgateAdder`, `notes`, `isManualRequired`). It names
`lib/pricing/freight.ts` as the location and EasyPost as a future integration.

`CLAUDE.md` DATA BLOCKERS confirms "Carrier / freight method | #27–28, #80 | Freight
calculation" is still blocked, and "AFS address, phone, hours | #5, #6 | …freight
origin".

### 3.3 What the repository actually contains (verified by reading, not memory)

| Thing | State | Evidence |
|---|---|---|
| `lib/freight/` | **does not exist** | `ls lib/freight` → no such directory |
| `lib/pricing/freight.ts` | **does not exist** | `ls lib/pricing/` lists 11 files, none named `freight.ts` |
| `getFreightClass(longestPieceFt)` | **EXISTS, correct, matches spec §4 exactly** | `lib/admin/pricing.ts` |
| `estimateShipmentWeight(items, reference)` | **EXISTS**, best-effort match against seeded `gauges.weight_lbs_sqft`, returns `{ totalLbs, matchedCount, totalCount }` | `lib/admin/pricing.ts` |
| Manual freight dollar entry | **EXISTS** — one `<input type="number">` "Freight Amount ($)" | `components/admin/QuoteEstimatorForm.tsx:233-247` |
| Freight class + estimated weight shown read-only beside it | **EXISTS** | `components/admin/QuoteEstimatorForm.tsx:249-262` |
| Freight written to the quote | **EXISTS** — `freight` in the POST body → `quotes.freight` | `app/api/admin/quote-requests/[id]/send/route.ts` |
| `quotes.freight` | `DECIMAL(10,2)`, **nullable, dollars** | `supabase/migrations/001_initial_schema.sql:478` |
| `invoices.freight_cents` | `bigint NOT NULL DEFAULT 0`, **cents** | `supabase/migrations/035_…sql` §4 |
| `orders.carrier` | exists, free-text, populated only post-shipment | `lib/data/orders.ts` |
| Destination ZIP | **not available as structured data** — `quote_requests.jobsite_address` is one opaque string | `app/admin/quote-requests/[id]/page.tsx` |
| Any freight rate table | **does not exist** in any migration | grep over `supabase/migrations/` |
| `FreightCalculatorPanel` | **does not exist** | grep over `components/` |
| `/api/admin/pricing/freight` | **does not exist** | grep over `app/api/` |
| Residential / liftgate toggles | **do not exist** anywhere | grep for `liftgate` → only `lib/data/faq.ts` prose |
| Highest migration number | **038** → next free is **039** | `ls supabase/migrations/` |
| `is_admin()` | EXISTS, SQL helper | `supabase/migrations/001_initial_schema.sql:15` |
| `afs_append_only()` trigger function | EXISTS, column-agnostic via `to_jsonb(OLD)` | `supabase/migrations/035_…sql` §2 |
| `logAdminAction()` | EXISTS, service-role write to `admin_audit_log`, never throws | `lib/admin/audit.ts` |
| `appendLedger()` | EXISTS, `pricing_ledger` writer | `lib/pricing/ledger.ts` |
| `parseDollarsToCents` / `formatCents` | EXIST | `lib/pricing/quote-math.ts` |
| `requireAdminUser(supabase)` | EXISTS, redirects non-admins | `lib/admin/auth.ts` |
| `LightWorkingArea` | EXISTS, the opt-in light-surface wrapper | `components/admin/LightWorkingArea.tsx` |

### 3.4 THE SPECIFICATION/REPOSITORY/INSTRUCTION DISCREPANCY, STATED PLAINLY

`FREIGHT_ESTIMATOR_SCOPE.md` (repo root, dated 2026-07-30) is a prior audit of this
same feature. Its §4 **"Do not build"** section forbids most of what this item asks for:

> *"Any dollar output. No `/api/admin/pricing/freight` route, no 'Estimated freight:
> $X.XX via {carrier}' display, no residential/liftgate dollar adders, no
> free-freight-threshold check — all six items in §2 above are needed first and none
> exist."*
> *"Residential-delivery and liftgate toggles, even as informational (non-priced)
> flags."*

The queue item for this run instructs the opposite, and does so explicitly:

> *"build it as a MANUAL-ENTRY-FIRST estimator: an admin-only freight entry and
> estimate component on the estimator/quote screen with a configurable rate table
> (zones or weight/length bands) stored in the database via an additive migration
> FILE… Deliver: typed lib (lib/freight/), rate-table admin editor, estimate shown to
> admin only, saved to the quote as a line item the admin can override with an audit
> trail… ship with an empty rate table and a clear admin empty state rather than
> invented rates."*

**Resolution, and why it is not a contradiction.** The scope document's stated reason
for forbidding dollar output was fabrication: *"Building a 'Calculate Freight' button…
that returns a dollar figure right now would mean fabricating a number that looks
authoritative but isn't backed by any real rate data."* The queue item removes that
objection at the root by making every rate **admin-entered and shipping the table
empty**. No rate in this work originates anywhere but Steve's keyboard. The forbidden
thing was an invented number; a blank table that refuses to produce a number is the
opposite of one.

Two of the scope document's prohibitions are nevertheless **upheld verbatim**, because
their reasoning is about fragility rather than fabrication and the queue item does not
overrule them:

- **No ZIP extracted from free text.** `quote_requests.jobsite_address` stays the
  read-only display string it already is. The spec's `destinationZip` input is replaced
  by an **explicit admin-chosen zone** (§7, R-07). Nothing is inferred from an address.
- **No carrier API.** No EasyPost, no outbound request of any kind. See R-25.

This resolution is recorded, per LAW 8, in the governance append and in the final report.
`FREIGHT_ESTIMATOR_SCOPE.md` is **not edited** — it is a dated audit and rewriting
history is not this item's job; the superseding decision is dated and recorded alongside it.

### 3.5 The three numbers this work is allowed to hardcode, and why each is not a business number

| Constant | Value | Source | Why it is not client data |
|---|---|---|---|
| Freight class table | 85 / 92.5 / 100 / 110 | `SPEC_FREIGHT_ESTIMATOR.md` §4, `PRICING_ENGINE.md` §7 | NMFC-style classification given in full by the spec. Already implemented and in use. Not a price. |
| Oversize manual-entry threshold | 24 ft | `SPEC_FREIGHT_ESTIMATOR.md` §4 comment | A length, given by the spec, above which the spec itself **forbids** auto-calculation. Refusing to calculate invents nothing. |
| Sheet width / strip geometry | — | not used here | Not applicable: freight does not touch sheet geometry. |

**Every monetary value is NULL until an admin types it.** There is no `DEFAULT 0` on any
money column introduced by this work, and no default rate, adder or threshold anywhere
in the code.

---

## 4. REQUIRED REPOSITORY INSPECTION — WHAT WAS ACTUALLY READ

Read in full: `CLAUDE.md`; `specs/SPEC_FREIGHT_ESTIMATOR.md`;
`FREIGHT_ESTIMATOR_SCOPE.md`; `PRICING_ENGINE.md` §§1–2 and §§6–8;
`lib/admin/pricing.ts`; `lib/pricing/quote-math.ts`; `lib/pricing/types.ts`;
`lib/pricing/price-book.ts`; `lib/pricing/db.ts`; `lib/admin/audit.ts`;
`lib/admin/auth.ts`; `lib/pricing/ledger.ts` (header + exports);
`components/admin/QuoteEstimatorForm.tsx`; `components/admin/PriceBookEditor.tsx`
(header + save path); `app/admin/settings/price-book/page.tsx`;
`app/admin/settings/page.tsx`; `app/api/admin/price-book/route.ts`;
`app/api/admin/quote-requests/[id]/send/route.ts`;
`supabase/migrations/035_price_book_ledger_quotes_invoices.sql`;
`lib/data/admin-nav.ts`; `vitest.config.mts`; `package.json`.

Inspected by targeted grep: `quotes` DDL in `001_initial_schema.sql`; `is_admin()`
definition site; every file matching `freight|liftgate` across
`app/ components/ lib/ supabase/ tests/ scripts/`; `company_id` usage across the repo;
`scripts/audit/contrast-check.mjs` screen-discovery logic.

### 4.1 Baseline measurements (BEFORE any change in this run)

```
git status                → clean (worktree, branch ovn/05-freight-estimator at 75118cb)
pnpm tsc --noEmit         → exit 0, no output. CLEAN.
pnpm test:unit            → Test Files  1 failed | 30 passed (31)
                            Tests       1 failed | 484 passed (485)
                            FAILING: lib/design/v7-css.test.ts — "app/styles/
                            command-center-v7.generated.css is stale."
                            PRE-EXISTING. The worktree was clean; this run has
                            changed nothing yet. NOT attributable to this item and
                            NOT fixed by it (CLAUDE.md rule #33 governs that file,
                            and regenerating it is outside this item's scope —
                            Canonical LAW 7).
node scripts/audit/contrast-check.mjs
                          → PASS. 24 screens · 248 colour pairs · 0 unresolved ·
                            0 below threshold.
```

---

## 5. PRECONDITIONS AND ASSUMPTIONS

### 5.1 Preconditions

- P-01 Node + pnpm available; `node_modules` installed (verified: `pnpm tsc` ran).
- P-02 `is_admin()` and `afs_append_only()` already exist in the live database
  (migrations 001 and 035, both recorded as applied in `MIGRATIONS_STATUS.md`'s
  lineage). Migration 039 depends on both and does **not** redefine either.
- P-03 `profiles`, `quotes`, `quote_requests` exist. 039 references all three.
- P-04 Migration 039 is **written as a file and NOT applied** (hard rule of this run).
  Therefore at completion the freight tables **do not exist** in any deployed database.

### 5.2 Assumptions, each explicitly documented per LAW 6

- **A-01 [Certain]** The queue item's instruction supersedes
  `FREIGHT_ESTIMATOR_SCOPE.md` §4's "Do not build" list, for the reason in §3.4.
- **A-02 [Certain]** No monetary default is permissible. Direct instruction:
  *"ship with an empty rate table and a clear admin empty state rather than invented
  rates."*
- **A-03 [Likely]** A **flat charge per (zone × weight band)** is the rate structure to
  build. Rationale: checklist #80 (own truck vs third-party) is unresolved, so whether
  AFS bills LTL per-hundredweight, a flat zone price, or its own truck's cost is
  **unknown**. A flat-per-band table can express any of the three given enough bands;
  a per-cwt-with-minimum table cannot express flat zone pricing without inventing
  structure. Recorded as **UNRESOLVED-01**: if Steve's real tariff is per-cwt, the table
  gains a `per_cwt_cents` column in a later additive migration. Choosing the structure
  that cannot mis-state the others is the conservative choice this run is told to make.
- **A-04 [Certain]** Destination is an **admin-selected zone**, never a ZIP parsed from
  `jobsite_address`. See §3.4.
- **A-05 [Likely]** A **blank free-freight threshold means the rule is not applied**,
  not "everything qualifies". Rationale: not applying a discount can only over-quote,
  and the estimator reviews and overrides every figure before it is sent; applying an
  unconfigured discount would silently under-quote. The estimate states in words that
  no threshold is configured, so the non-application is visible rather than silent.
- **A-06 [Certain]** A **toggle switched on whose adder is blank is a refusal, not a
  zero.** Directly implied by CLAUDE.md rule #19 ("A BLANK IS NEVER A ZERO") and by
  A-02.
- **A-07 [Likely]** Band weights are matched on the **estimated shipment weight rounded
  to the nearest whole pound**, because freight tariffs are published in whole pounds.
  Documented in code at the rounding site and tested at the boundary.
- **A-08 [Certain]** The freight **rate table is AFS-wide, not `company_id`-scoped.**
  Rationale: it is AFS's own cost of shipping, in exactly the same category as
  `price_book_items` / `pricing_ledger`, which migration 035 scopes with `is_admin()`
  and no `company_id`. `company_id` in this schema scopes **customer** data (`projects`,
  `templates`, `profile_passport`, `credit`). Scoping AFS's own carrier rates by customer
  company would be wrong, not merely unnecessary. The run's Six-Laws instruction
  ("schema with RLS and company_id") is satisfied in substance by the stricter
  admin-only policy: see §9 INV-06 and §12 AC-18 for the data-leak proof.
- **A-09 [Certain]** No E2E test may create rows in the freight tables, because the
  migration is not applied. The E2E therefore asserts the **not-installed** state and
  the preserved manual path — which is the real state of every environment at
  completion.

---

## 6. SCOPE

### 6.1 CREATED

| Path | What |
|---|---|
| `supabase/migrations/039_freight_rate_table_and_estimates.sql` | Additive migration **FILE ONLY, NOT APPLIED**: 5 tables, RLS, append-only triggers, indexes, comments. Zero seeded rates. |
| `lib/freight/types.ts` | Every freight type, field label and required-field list. Money is cents, `null` is not zero. |
| `lib/freight/bands.ts` | Pure: band boundary resolution, table coverage validation, rate-version-in-force resolution. |
| `lib/freight/estimate.ts` | Pure: the estimator. Produces an estimate or an enumerated refusal. |
| `lib/freight/override.ts` | Pure: the estimate/override audit record and its old→new delta. |
| `lib/freight/db.ts` | The only `lib/freight` file that touches Supabase. Returns an installed/not-installed discriminated result. |
| `lib/freight/bands.test.ts` | Vitest. Band boundaries, coverage faults, version-in-force. |
| `lib/freight/estimate.test.ts` | Vitest. Oversize, surcharges, threshold, blanks, refusals, totals. |
| `lib/freight/override.test.ts` | Vitest. Override audit record, delta, basis, rounding. |
| `lib/freight/fixtures.ts` | Explicit, versioned, shared test fixtures (no random data). |
| `app/api/admin/freight-rates/route.ts` | Admin-only rate-table writer. Actions: `add-zone`, `retire-zone`, `add-band`, `retire-band`, `set-rate`, `set-surcharges`. |
| `app/admin/settings/freight/page.tsx` | Server page, `LightWorkingArea`, renders the editor. |
| `components/admin/FreightRateEditor.tsx` | The rate-table admin editor: zones, bands, rates, surcharges, empty state, not-installed state. |
| `components/admin/FreightEstimatePanel.tsx` | The admin-only estimate panel inside the quote screen: zone, toggles, weight, longest piece, live estimate, override. |
| `tests/e2e/freight-estimator.spec.ts` | Playwright: the admin editor's not-installed/empty state and the preserved manual entry path. |

### 6.2 MODIFIED

| Path | Change | Why minimal |
|---|---|---|
| `components/admin/QuoteEstimatorForm.tsx` | The bare "Freight Amount ($)" input is **replaced in place** by `FreightEstimatePanel`, which **still contains that same input** as the override field. Send body gains `freightInputs` and `freightBasis`. | The existing single write path is kept; no new door, no second freight writer. |
| `app/api/admin/quote-requests/[id]/send/route.ts` | Accepts `freightInputs`; **re-computes** the estimate server-side from the database; decides the final freight; writes one `freight_estimates` audit row; writes one `admin_audit_log` row. Existing `freight` dollar field remains accepted and authoritative when the basis is manual/override. | Server never trusts a client-sent amount as an estimate (S13, S40). |
| `app/admin/quote-requests/[id]/page.tsx` | Passes the resolved freight table + zones down to the form. | The page already loads the weight estimate; this is the same kind of read. |
| `app/admin/settings/page.tsx` | One `Link` added to the existing **Pricing** section, pointing at `/admin/settings/freight`. | Mirrors the price-book link exactly. Wiring, per the Six Laws. |
| `SCHEMA.md` | Append a dated `FREIGHT` section documenting all 5 tables, columns, constraints and RLS. | Required: schema files were added. |
| `STATE_OF_THE_BUILD.md` | Append a dated entry + Elite Compliance checklist. | Governance. |
| `SESSION_STATE.md` | Append a dated session entry + compliance report. | Governance. |
| `queue.yaml` | Mark item `05-freight-estimator` per its existing convention. | Governance. |

### 6.3 LEFT UNTOUCHED (explicitly)

`middleware.ts`; `main`; every file under `docs/design/command-center-v7/`; every
pixel-gate baseline and `tests/visual/**`; `app/styles/command-center-v7.generated.css`;
`lib/data/admin-nav.ts` (the new page is discovered by the contrast gate automatically
as a `page.tsx` beneath `/admin/settings`, so no nav edit is needed — LAW 7);
`lib/pricing/**` (reused, not edited, except that nothing in it is edited at all);
`lib/admin/pricing.ts`'s `getFreightClass` and `estimateShipmentWeight` (**reused as-is**,
re-exported from `lib/freight` for discoverability — never reimplemented);
`pricing_ledger`'s `event_type` CHECK constraint (see ADR-3);
`FREIGHT_ESTIMATOR_SCOPE.md` (see §3.4).

---

## 7. NON-GOALS

- NG-01 No carrier API. No EasyPost, no rate shopping, no outbound HTTP of any kind.
- NG-02 No ZIP-based distance or lane calculation. No regex over `jobsite_address`.
- NG-03 No invented rate, adder, threshold or carrier name. Not even a commented-out one.
- NG-04 No customer-facing change. The customer sees exactly what they see today: a
  freight figure on a formal AFS quote. The estimator, the table, the bands, the class,
  the weight and the audit trail are all admin-only.
- NG-05 No migration applied. No deploy. No merge. No real email/SMS/charge.
- NG-06 No change to `pricing_ledger`'s event vocabulary (ADR-3).
- NG-07 No Command Center v7 screen touched, and no pixel-gate baseline regenerated.
- NG-08 The pre-existing `lib/design/v7-css.test.ts` failure is not fixed here.
- NG-09 No `orders.carrier` behaviour change; it remains post-shipment free text.
- NG-10 Nesting/consolidating pieces to reduce freight is not modelled (that is
  `SPEC_TRIM_LENGTH_OPTIMIZER.md`'s job, exactly as `quote-math.ts` reasons about strips).

---

## 8. INVARIANTS

- INV-01 **No customer ever sees an estimate, a rate, a band, a class, a weight or an
  override.** Only the final freight dollar figure on a formal AFS quote.
- INV-02 **A blank is never a zero.** No money column gets a default; no code path
  substitutes 0 for an unset rate, adder or threshold.
- INV-03 **An issued quote keeps the freight it was issued with.** Rate versions are
  append-only in the database; the quote stores its own figure; the
  `freight_estimates` row stores the version ids it used.
- INV-04 **The server never accepts a client-computed estimate.** The client sends
  inputs; the server re-resolves and re-computes. An override is accepted as an
  override and recorded as one, never as a computed estimate.
- INV-05 **`getFreightClass` has exactly one implementation.** `lib/admin/pricing.ts`'s.
- INV-06 **No cross-company leak is possible**: every freight table is `is_admin()`-only
  for all operations and has no customer-readable policy at all.
- INV-07 **The existing manual path keeps working with the rate table empty or absent.**
  This is the shipping state.
- INV-08 `pnpm tsc --noEmit` stays clean; zero `any`; the contrast gate stays at
  `0 unresolved · 0 below`.
- INV-09 The 484 currently-passing unit tests keep passing.

---

## 9. REQUIREMENTS

### 9.1 Data model — migration 039 (FILE ONLY)

**R-01 `freight_zones`** — the identity of a destination zone.
`id uuid pk`, `name text NOT NULL`, `note text`, `display_order integer NOT NULL DEFAULT 0`,
`retired_at timestamptz`, `retired_by uuid REFERENCES profiles(id)`,
`created_by uuid REFERENCES profiles(id)`, `created_at timestamptz NOT NULL DEFAULT now()`.
`UNIQUE (name)`. **Zero rows seeded** — there is no carrier, so there is no zone map.

**R-02 `freight_rate_bands`** — the identity of a weight band within a zone.
`id uuid pk`, `zone_id uuid NOT NULL REFERENCES freight_zones(id) ON DELETE RESTRICT`,
`min_weight_lbs integer NOT NULL`, `max_weight_lbs integer` (**NULL = open-ended top
band**), `display_order integer NOT NULL DEFAULT 0`, `retired_at`, `retired_by`,
`created_by`, `created_at`.
Constraints: `min_weight_lbs >= 0`; `max_weight_lbs IS NULL OR max_weight_lbs > min_weight_lbs`;
`UNIQUE (zone_id, min_weight_lbs)`. **Zero rows seeded.**

**R-03 `freight_rate_versions`** — what a band costs, from when. Append-only.
`id uuid pk`, `band_id uuid NOT NULL REFERENCES freight_rate_bands(id) ON DELETE RESTRICT`,
`rate_cents integer` (**NULLABLE, NO DEFAULT** — NULL means not filled in),
`effective_from date NOT NULL`, `note text`, `created_by`, `created_at`.
`UNIQUE (band_id, effective_from)`; `rate_cents IS NULL OR rate_cents >= 0`.
`BEFORE UPDATE OR DELETE` trigger → `afs_append_only()`. **Zero rows seeded.**

**R-04 `freight_surcharge_versions`** — the adders and the threshold, versioned
together because they are read together. Append-only.
`id uuid pk`, `residential_cents integer`, `liftgate_cents integer`,
`free_freight_threshold_cents bigint` — **all three NULLABLE, NO DEFAULT** —
`effective_from date NOT NULL`, `note text`, `created_by`, `created_at`.
`UNIQUE (effective_from)`; each money column `IS NULL OR >= 0`.
`BEFORE UPDATE OR DELETE` trigger → `afs_append_only()`. **Zero rows seeded.**

**R-05 `freight_estimates`** — THE AUDIT TRAIL. Append-only. One row per freight
decision recorded on a quote.
Identity/links: `id uuid pk`, `quote_id uuid REFERENCES quotes(id)`,
`quote_request_id uuid REFERENCES quote_requests(id)`.
Inputs as used: `zone_id uuid REFERENCES freight_zones(id)`, `zone_name text`,
`weight_lbs numeric`, `weight_lbs_matched integer`, `weight_lbs_total_items integer`,
`longest_piece_ft numeric`, `freight_class text`, `is_residential boolean NOT NULL`,
`requires_liftgate boolean NOT NULL`, `merchandise_subtotal_cents bigint`.
Outcome: `basis text NOT NULL CHECK (basis IN ('estimate','override','manual'))`,
`computed_cents bigint` (NULL when no estimate was possible),
`override_cents bigint` (NULL when not overridden),
`final_cents bigint NOT NULL`,
`band_id uuid REFERENCES freight_rate_bands(id)`,
`rate_version_ids uuid[]`, `surcharge_version_id uuid REFERENCES freight_surcharge_versions(id)`,
`breakdown jsonb`, `refusals jsonb`, `notes text`, `override_reason text`.
Actor: `actor_id uuid REFERENCES profiles(id)`, `actor_email text`,
`created_at timestamptz NOT NULL DEFAULT now()`.
Integrity CHECKs, all three load-bearing:
- `basis = 'estimate'` ⇒ `computed_cents IS NOT NULL AND override_cents IS NULL AND final_cents = computed_cents`
- `basis = 'override'` ⇒ `override_cents IS NOT NULL AND final_cents = override_cents`
- `basis = 'manual'`   ⇒ `computed_cents IS NULL AND override_cents IS NOT NULL AND final_cents = override_cents`
plus `final_cents >= 0`.
`BEFORE UPDATE OR DELETE` trigger → `afs_append_only()`.

**R-06 RLS.** All five tables `ENABLE ROW LEVEL SECURITY`.
`freight_zones`, `freight_rate_bands`, `freight_rate_versions`,
`freight_surcharge_versions`: `FOR ALL USING (is_admin())`.
`freight_estimates`: **SELECT and INSERT policies only**, both `is_admin()` — no UPDATE
policy and no DELETE policy exists at all, so the append-only trigger and the policy set
are two independent refusals (the pattern migration 035 establishes for `pricing_ledger`).
**No table gets any customer-readable policy.**

**R-07 Idempotency.** Every object `IF NOT EXISTS`; every constraint added inside a
`DO $$ … pg_constraint …$$` guard; every policy `DROP POLICY IF EXISTS` before
`CREATE POLICY`; every trigger `DROP TRIGGER IF EXISTS` before create. Safe to re-run.
Mirrors 035 exactly.

### 9.2 The library — `lib/freight/`

**R-08 `types.ts`.** Money is **integer cents**; `null` means blank and never zero.
Exports `FreightZone`, `FreightRateBand`, `FreightRateVersion`,
`ResolvedFreightBand` (band + version-in-force + `isPriced`), `FreightRateTable`
(zones + resolved bands + resolved surcharges + `asOf`), `FreightSurcharges`,
`FreightInput`, `FreightBreakdown`, `FreightEstimate`, `FreightRefusal`,
`FreightEstimateResult` (discriminated on `ok`), `FreightBasis`,
`FreightEstimateRecord`, `BandCoverageProblem`, plus plain-English label maps used by
both the editor and every refusal message. Zero `any`.

**R-09 Band boundaries — `bandForWeight(bands, weightLbs)`.**
A band covers `min_weight_lbs <= w < max_weight_lbs`; **inclusive floor, exclusive
ceiling**, so adjacent bands `[0,500)` and `[500,1000)` are contiguous with neither gap
nor overlap and a shipment of exactly 500 lb lands in exactly one band. A band with
`max_weight_lbs = NULL` covers `w >= min_weight_lbs` without upper limit. Retired bands
are excluded. Returns `null` when no band covers the weight — never a nearest-match
guess.

**R-10 Weight rounding — A-07.** `bandForWeight` rounds the incoming weight to the
nearest whole pound (`Math.round`) **before** comparing, because tariff bands are
published in whole pounds. `499.5 → 500` (upper band); `499.4 → 499` (lower band). The
rounding happens in exactly one place and is documented there.

**R-11 Coverage validation — `validateBandCoverage(bands)`.** Returns every structural
fault in a zone's bands, each with the band ids involved and a plain-English message:
`overlap`, `gap`, `max-not-above-min`, `negative-min`, `multiple-open-ended`,
`duplicate-min`. An **overlapping or gapped table is a refusal**, not a
first-match-wins lookup — a table that silently picks a band is exactly the
looks-complete-but-isn't logic this item must not produce. A zone with no bands at all
is reported as `no-bands` rather than as a gap.

**R-12 Version in force — `rateVersionInForce(versions, asOf)`.** The latest
`effective_from` not after `asOf`; a version dated tomorrow is not in force today; on a
tie of `effective_from`, the later `created_at` wins (that is the same-day correction).
Returns `null` when none. Same contract as `lib/pricing/price-book.ts`'s
`versionInForce`, deliberately, so the two behave identically.

**R-13 `surchargesInForce(versions, asOf)`.** Same rule as R-12 over
`freight_surcharge_versions`. Returns `null` when nothing has ever been set — which is
the shipping state, and is distinct from "set to zero".

**R-14 The estimator — `estimateFreight(input, table)`.** Pure. Returns
`{ ok: true, estimate }` or `{ ok: false, refusals, freightClass, requiresManualEntry }`.
It **always reports `freightClass`**, on both branches, because the class needs no rate
data (§3.5). Refusal kinds, each with a message naming what to go and fix:

| kind | condition |
|---|---|
| `rate-table-empty` | **STRUCTURAL emptiness only**: no live zone, or no live zone with a live band |
| `no-zone-selected` | `input.zoneId` is null |
| `zone-not-found` | the id does not resolve |
| `zone-retired` | resolves but is retired |
| `zone-has-no-bands` | the zone exists and has no live bands |
| `band-coverage` | R-11 found a structural fault in the zone's bands |
| `no-band-for-weight` | weight is positive but outside every band |
| `bad-weight` | weight is not a finite number greater than 0 |
| `band-rate-blank` | the matched band's version-in-force has `rate_cents = NULL`, or the band has no version at all |
| `residential-adder-blank` | `isResidential` is true and `residential_cents` is NULL |
| `liftgate-adder-blank` | `requiresLiftgate` is true and `liftgate_cents` is NULL |
| `oversize-manual-entry` | `longestPieceFt > 24` (R-15) |

All applicable refusals are returned **together**, not just the first, so the estimator
fixes everything in one pass.

**R-15 Oversize — spec §4.** `longestPieceFt > 24` ⇒ refusal
`oversize-manual-entry` with `requiresManualEntry: true` and **no dollar amount**,
whatever the rate table says. The message states that a piece over 24 ft may need
flatbed service and an oversize permit and must be priced by hand. Exactly 24.0 ft
auto-calculates; 24.01 ft does not. The threshold is a named exported constant with the
spec citation beside it.

**R-16 Surcharges.** A toggle that is **off** never applies its adder, set or not. A
toggle that is **on** with a NULL adder is a refusal (R-14), never a zero (A-06,
INV-02). A toggle on with an adder applies it exactly once.

**R-17 Free-freight threshold.** When `free_freight_threshold_cents` is set **and**
`input.merchandiseSubtotalCents >= threshold`, freight is **0** and the breakdown says
why. `>=` — a subtotal exactly equal to the threshold qualifies. When the threshold is
NULL the rule is **not applied** and the estimate carries a note saying no threshold is
configured (A-05). The free-freight zero **is** a legitimate AFS-set price and is the
one case where `final_cents = 0` is correct rather than a blank.
Interaction with R-15/R-16: a refusal **outranks** the threshold — the estimator never
reports "free" as a way of avoiding a figure it could not compute. Qualifying for free
freight does **not** excuse a blank surcharge, because the adders are exactly what a
free-freight promise would and would not cover, and guessing is not this code's job.

**R-18 Breakdown and totals.** `FreightBreakdown` carries `baseRateCents`,
`residentialCents` (0 when not applied), `liftgateCents` (0 when not applied),
`freeFreightApplied: boolean`, `totalCents`, and the ids actually used
(`bandId`, `rateVersionId`, `surchargeVersionId`). `totalCents` is the integer sum; all
inputs are already integer cents, so **no rounding occurs in the sum** and none is
introduced. The one rounding rule in the whole library is R-10's, and the one
dollars↔cents conversion is `lib/pricing/quote-math.ts`'s existing
`parseDollarsToCents` / `formatCents`, reused rather than rewritten.

**R-19 The override record — `override.ts`.**
`buildFreightEstimateRecord({ result, input, overrideCents, overrideReason, actor, … })`
returns the `freight_estimates` row shape, deciding `basis` by this exact rule:

| computed | override | basis | final |
|---|---|---|---|
| present | `null` | `estimate` | computed |
| present | present (**including 0**) | `override` | override |
| absent | present (**including 0**) | `manual` | override |
| absent | `null` | — | **refuses to build a record**: there is nothing to put on the quote |

An override of **0** is a real override (freight waived by hand), not an absent one —
the shape therefore distinguishes `null` from `0` throughout and never uses a falsy
test on an amount. An override numerically equal to the computed figure is still
recorded as `basis = 'override'`, because the estimator typed it and the audit trail
records what happened rather than what was redundant. `auditDelta(record)` returns
`{ old, new }` for `logAdminAction`, with `old` = what the estimator computed and
`new` = what was sent.

**R-20 `db.ts` — installed vs not installed.** `getFreightRateTable(supabase, asOf)`
returns a **discriminated** result: `{ installed: false, reason }` when PostgREST
reports the relation does not exist (PostgreSQL `42P01` / PostgREST `PGRST205`), and
`{ installed: true, table }` otherwise. This is the honest shipping state —
migration 039 is deliberately unapplied — and it is **surfaced in the UI, never
swallowed** (R-22, R-24). Selects name their columns explicitly. Any other error is
propagated, not flattened into "empty": "empty" and "broken" are different facts.

**R-21 Re-export, never reimplement.** `lib/freight/index.ts` re-exports
`getFreightClass` and `estimateShipmentWeight` from `lib/admin/pricing.ts` so
`lib/freight` is the discoverable entry point without creating a second
implementation (INV-05).

### 9.3 The API

**R-22 `POST /api/admin/freight-rates`.** Auth: `supabase.auth.getUser()` then
`profiles.role === 'admin'` — 401 / 403, the exact shape
`app/api/admin/price-book/route.ts` uses. Writes through `createAdminClient()`.
Actions and their validation:
- `add-zone { name, note? }` — name required and trimmed; a retired zone of the same
  name is **un-retired** rather than reported as a duplicate (the price-book route's
  established behaviour); a live duplicate is 409.
- `retire-zone { zoneId, retired: true|false }` — `retired` must be exactly `true` or
  `false`. Retiring never deletes.
- `add-band { zoneId, minWeightLbs, maxWeightLbs? }` — integers; `min >= 0`;
  `max > min` when present; rejects a second open-ended band in the same zone and a
  duplicate `min`, each with the reason.
- `retire-band { bandId, retired }`.
- `set-rate { bandId, rateCents?, effectiveFrom?, note? }` — **INSERTS a version**.
  `rateCents` omitted/null/`''` stores NULL (a blank, never 0); anything else must be a
  non-negative integer or it is a 400 naming the field. A duplicate
  `(band_id, effective_from)` returns 409 saying an existing price is never overwritten
  and to pick another start date.
- `set-surcharges { residentialCents?, liftgateCents?, freeFreightThresholdCents?, effectiveFrom?, note? }`
  — **INSERTS a version**, same blank rule per field.
Every successful action writes `logAdminAction`. Every response is
`{ ok: true, message }` in plain English, or `{ error }`. A missing relation
(039 unapplied) returns **503** with a message naming the migration, never a 500.

**R-23 `POST /api/admin/quote-requests/[id]/send` — the one change that matters for
security.** The client may send `freightInputs` (zone id, residential, liftgate, weight,
longest piece) and `freight` (the dollar figure in the box, as today). The server:
1. re-reads the freight table from the database as of today;
2. re-computes the estimate itself — **the client's estimate is never read**;
3. decides `basis` by R-19 against the figure actually in the box;
4. writes `quotes.freight` from `final_cents` (dollars, matching the existing
   `DECIMAL(10,2)` column);
5. inserts exactly one `freight_estimates` row;
6. writes one `admin_audit_log` row via `logAdminAction` with R-19's delta.
Steps 5 and 6 **never block the quote**: a failure there is logged and the quote still
sends (the pattern this route already uses for notifications), because an audit write
failing must not strand a customer's quote. Step 4's figure is therefore always
recoverable from `quotes.freight` even if step 5 failed. If the freight tables are not
installed, steps 1–3 are skipped, `basis` is `manual`, and step 5 is skipped with a
logged line — the quote sends with the typed figure, exactly as today.

### 9.4 The UI

**R-24 `components/admin/FreightRateEditor.tsx`** — zones, their bands, each band's
rate with its start date, and the surcharge panel. Every required UI state is real:
- **not installed** — a bordered notice naming migration 039 and stating that manual
  entry on the quote screen is unaffected. No controls pretend to work.
- **empty** — zero zones: *"No freight zones yet. Add the zones your carrier actually
  bills, then the weight bands inside each one. Nothing here is filled in for you —
  a guessed freight rate would end up on a customer's quote."* plus the add-zone form.
- **unpriced band** — the **"Not set"** chip on `afs-amber-bg`/`afs-amber-ink` with a
  screen-reader label, exactly as `PriceBookEditor` renders a blank. Never `$0.00`.
- **loading / busy** — the acting button disabled and labelled.
- **error** — the server's own sentence, shown verbatim.
- **coverage warning** — R-11's faults listed per zone in plain English, because a
  gapped table is the one thing that makes the estimator refuse at quote time, and the
  estimator should learn that here rather than there.
Light working area, `afs-*` tokens only, placeholders `afs-ink-700` (CLAUDE.md rule #23,
**not** `afs-chrome-silver`, which measures 1.55:1 on `afs-bg-card`).

**R-25 `components/admin/FreightEstimatePanel.tsx`** — inside the quote screen's
existing Freight panel. Destination address stays read-only display text (A-04).
Adds: zone `<select>` (with an explicit "Not selected" option), **estimated weight**
(pre-filled from `estimateShipmentWeight`, editable, with the "n of m items matched"
caveat it already shows), **longest piece ft** (pre-filled, editable), **residential**
and **liftgate** checkboxes, the **live estimate** with its full breakdown, and the
**override field — which is the existing "Freight Amount ($)" input, kept**.
Behaviour:
- Estimate recomputes live from the table passed down by the server; the server
  re-computes authoritatively on send (R-23).
- On refusal the panel prints every reason in plain English and shows **no dollar
  figure**, and the override field is the way forward. For `oversize-manual-entry` it
  says so explicitly.
- Pressing **Use this estimate** copies the computed figure into the override field,
  which is what "estimator can override the amount before adding" means in practice.
- A one-line statement of what the customer will see: the final figure as a single
  freight line, and nothing else.
- The panel is rendered only inside `/admin/**`, which `middleware.ts` and
  `requireAdminUser` both gate. **Nothing in it is reachable by a customer** (INV-01).

**R-26 Wiring.** `/admin/settings` gains one link to `/admin/settings/freight` in its
existing Pricing section, worded like the price-book link and stating how many zones
and how many unpriced bands there are.

### 9.5 Tests

**R-27** Unit tests per §11, ARRANGE/ACT/ASSERT/TEARDOWN, fixtures explicit and shared
from `lib/freight/fixtures.ts`, every assertion exact and carrying a message that states
expected vs actual and why it matters. No random data, no conditional assertions, no bare
truthy checks.

**R-28** Playwright `tests/e2e/freight-estimator.spec.ts` asserting the **real** current
environment state: the editor renders its not-installed/empty state without crashing,
the Settings link reaches it, and the quote screen's manual freight entry still works.
It must not attempt to write freight rows — the tables do not exist (A-09).

---

## 10. CONSTRAINTS — WHAT MUST NOT BE CHANGED, INFERRED OR WEAKENED

- C-01 Do not modify `middleware.ts`. Do not deploy, merge, or touch `main`.
- C-02 Do not apply migration 039, or any migration, to any Supabase project.
- C-03 Do not invent a rate, adder, threshold, carrier name or zone. Not as a default,
  not as a seed, not as a placeholder, not in a comment presented as real.
- C-04 Do not add `DEFAULT 0` to any money column introduced here.
- C-05 Do not parse a ZIP, city or state out of `quote_requests.jobsite_address`.
- C-06 Do not make any outbound network request to a carrier or rate service.
- C-07 Do not reimplement `getFreightClass` or `estimateShipmentWeight` (INV-05).
- C-08 Do not alter `pricing_ledger`'s `event_type` CHECK (ADR-3).
- C-09 Do not touch anything under `docs/design/command-center-v7/`, `tests/visual/**`,
  or `app/styles/command-center-v7.generated.css`.
- C-10 Do not weaken, skip, delete or `.todo` any test — existing or new. Do not add
  `any`, `@ts-ignore`, or a lint disable to make something pass.
- C-11 Do not add a skip list to the contrast gate or relax a threshold (CLAUDE.md #28).
- C-12 Do not read, print or copy any value from `.env*`.
- C-13 Do not rewrite existing text in `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md`,
  `SCHEMA.md` or `queue.yaml` — append dated sections only.
- C-14 Do not use a default Tailwind colour or a literal hex in JSX.
- C-15 Do not let an audit-write failure block a quote from sending (R-23).
- C-16 Do not trust a client-supplied computed estimate (INV-04).

---

## 11. IMPLEMENTATION GUIDANCE AND SEQUENCE

Dependencies precede dependents; each numbered unit is committed separately so that a
dead session loses at most one unit.

1. **This EES**, committed.
2. **`supabase/migrations/039_…sql`** — file only. Printed in the final report.
3. **`lib/freight/types.ts` + `lib/freight/fixtures.ts`** — no behaviour yet.
4. **`lib/freight/bands.ts` + `bands.test.ts`** — run; must be green.
5. **`lib/freight/estimate.ts` + `estimate.test.ts`** — run; must be green.
6. **`lib/freight/override.ts` + `override.test.ts`** — run; must be green.
7. **`lib/freight/db.ts` + `lib/freight/index.ts`** — typecheck.
8. **`app/api/admin/freight-rates/route.ts`** — typecheck.
9. **`components/admin/FreightRateEditor.tsx` + `app/admin/settings/freight/page.tsx`
   + the Settings link** — typecheck, then **run the contrast gate**; it must stay
   `0 unresolved · 0 below`.
10. **`components/admin/FreightEstimatePanel.tsx` + `QuoteEstimatorForm.tsx` +
    `app/admin/quote-requests/[id]/page.tsx` + the send route** — typecheck.
11. **`tests/e2e/freight-estimator.spec.ts`** — run if an admin `storageState` is
    available in this environment; report honestly either way.
12. **END-OF-RUN VERIFICATION** — `pnpm tsc --noEmit`, lint on touched files,
    `pnpm test:unit`, coverage on the new code, the contrast gate. Real printed output.
13. **GOVERNANCE** — append to `SCHEMA.md`, `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md`,
    `queue.yaml`.
14. **Move the engineering documents to the project root**, verify placement, commit,
    `git push -u origin HEAD`.

### Architecture decision records

- **ADR-1 Flat charge per (zone × weight band), not per-hundredweight.** Checklist #80
  is unresolved, so whether AFS bills LTL, flat zone pricing, or its own truck is
  unknown. Flat-per-band can express all three given enough bands; per-cwt-with-minimum
  cannot express flat zone pricing without inventing structure. Trade-off: a per-cwt
  tariff needs more band rows than it would otherwise. Recorded as **UNRESOLVED-01**;
  the fix, when the real tariff arrives, is one additive column.
- **ADR-2 A dedicated `freight_estimates` table rather than reusing `pricing_ledger`.**
  Reusing it would require either extending its `event_type` CHECK (a change to an
  existing constraint that CLAUDE.md rule #20 governs) or overloading `'estimate'` with
  a different meaning. A separate append-only table makes "every freight decision we
  ever made" one query, and leaves the ledger's vocabulary intact.
  Trade-off: one more table, and freight history is not in the ledger's CSV export.
- **ADR-3 Inclusive floor / exclusive ceiling for bands, with explicit coverage
  validation.** Any other convention makes "exactly 500 lb" ambiguous and makes
  gap/overlap detection arithmetic rather than a simple adjacency check. Validating and
  **refusing** on a faulty table, rather than first-match-wins, is the difference
  between a wrong number and a visible problem.
- **ADR-4 The server re-computes on send.** The client computes only for live display.
  A client-sent amount accepted as "the estimate" would let a crafted request record a
  rate the table never contained, which is a data-integrity hole in the dataset dynamic
  pricing will one day learn from.
- **ADR-5 `db.ts` reports not-installed as a first-class state.** The migration is
  deliberately unapplied, so this is the real state at completion. Reporting it in words
  is honest; treating a missing table as an empty table would make a configuration
  problem indistinguishable from a blank rate book.

---

## 12. ACCEPTANCE CRITERIA

| # | Criterion |
|---|---|
| **AC-01** | `supabase/migrations/039_freight_rate_table_and_estimates.sql` exists, creates exactly the five tables of R-01…R-05 with the stated columns and CHECKs, is fully idempotent (R-07), and **seeds no monetary value and no zone, band or rate row at all**. |
| **AC-02** | No money column introduced by 039 has a `DEFAULT`. Verified by grep for `DEFAULT` on every `_cents` column in the file. |
| **AC-03** | 039 applies `ENABLE ROW LEVEL SECURITY` to all five tables; the four configuration tables have `FOR ALL USING (is_admin())`; `freight_estimates` has **exactly** a SELECT and an INSERT policy, both `is_admin()`, and no UPDATE or DELETE policy; **no table has any customer-readable policy**. |
| **AC-04** | 039 attaches a `BEFORE UPDATE OR DELETE … afs_append_only()` trigger to `freight_rate_versions`, `freight_surcharge_versions` and `freight_estimates`. |
| **AC-05** | 039 is **not applied**: `supabase/.temp` / migration history untouched, and no `apply_migration`/`execute_sql` call was made in this run. |
| **AC-06** | `bandForWeight` treats a band as `[min, max)`: weight exactly `max` lands in the next band and weight exactly `min` lands in this one. Asserted at both boundaries. |
| **AC-07** | A `NULL` `max_weight_lbs` band covers every weight at or above its min; a weight above a closed top band returns `null`; a weight below the lowest min returns `null`. |
| **AC-08** | `bandForWeight` rounds to the nearest whole pound first: `499.5` resolves to the `[500,…)` band and `499.4` to the `[…,500)` band. |
| **AC-09** | `validateBandCoverage` reports `overlap`, `gap`, `max-not-above-min`, `negative-min`, `multiple-open-ended`, `duplicate-min` and `no-bands`, and reports **nothing** for a contiguous priced table. |
| **AC-10** | `rateVersionInForce` ignores a version dated after `asOf`; on equal `effective_from` the later `created_at` wins; returns `null` when there is none. |
| **AC-11** | `estimateFreight` with `longestPieceFt = 24` produces an amount; with `24.01` and with `30` it refuses with `oversize-manual-entry`, `requiresManualEntry: true`, and **no amount**. |
| **AC-12** | `estimateFreight` reports the correct `freightClass` on **both** the ok and the refusal branch, for all four class bands (8/12/16/>16). |
| **AC-13** | A band whose version-in-force has `rate_cents = NULL`, or which has no version, refuses with `band-rate-blank` and produces no amount. **No code path substitutes 0.** |
| **AC-14** | `isResidential: true` with `residential_cents = NULL` refuses with `residential-adder-blank`; with the adder set, the adder is added exactly once; with the toggle off, it is never added. Same three for liftgate. |
| **AC-15** | Free freight: subtotal **above** the threshold → `totalCents = 0` and `freeFreightApplied: true`; **exactly equal** → qualifies; **below** → full freight; threshold `NULL` → not applied, with a note saying so. A refusal outranks the threshold. |
| **AC-16** | `estimateFreight` on an empty table refuses with `rate-table-empty` (distinct from `no-zone-selected`), so the UI can tell "nothing configured" from "you didn't pick one". |
| **AC-17** | `estimateFreight` returns **every** applicable refusal, not just the first. Asserted with a case that triggers three at once. |
| **AC-18** | `buildFreightEstimateRecord` yields `basis` exactly per R-19's four-row table; an override of **0** is `override`/`manual` (never treated as absent); an override equal to the computed figure is still `override`; the no-computed-no-override case refuses to build a record. |
| **AC-19** | `auditDelta` returns `old` = computed and `new` = final, including when computed is `null`. |
| **AC-20** | `getFreightRateTable` returns `{ installed: false }` on PostgreSQL `42P01` / PostgREST `PGRST205` and **propagates** any other error rather than reporting an empty table. |
| **AC-21** | `POST /api/admin/freight-rates` returns 401 unauthenticated, 403 for a non-admin `profiles.role`, 400 naming the field for every malformed input, 409 for a duplicate `(band_id, effective_from)` with the "never overwritten" sentence, 503 naming migration 039 when the relation is absent, and writes `logAdminAction` on every success. |
| **AC-22** | `set-rate` with `rateCents` omitted, `null` or `''` stores **NULL**; with a non-integer or negative value returns 400. It **INSERTs** a version and never UPDATEs one. |
| **AC-23** | The send route **re-computes** the estimate server-side and ignores any client-supplied computed amount; the recorded `computed_cents` comes only from the server's own computation. Verified by reading the route: the request body is never a source for `computed_cents`. |
| **AC-24** | An audit-write failure in the send route does not prevent the quote being created (`try`/`catch` around steps 5–6, logged). |
| **AC-25** | `/admin/settings/freight` renders, admin-gated by `requireAdminUser`, inside `LightWorkingArea`, and shows the **not-installed** notice in the current environment. |
| **AC-26** | The rate editor renders a real **empty state**, a real **not-installed state**, a real **busy state**, a real **error state**, and the **"Not set"** amber chip for an unpriced band. No state shows `$0.00` for a blank. |
| **AC-27** | The quote screen's **"Freight Amount ($)"** input still exists, is still editable, and still sends `freight` — the manual path is unbroken with the table empty or absent (INV-07). |
| **AC-28** | No customer-facing surface shows a rate, band, class, weight, estimate or override. Verified by grep: the new components are imported only from `app/admin/**`. |
| **AC-29** | `pnpm tsc --noEmit` exits 0 with no output. Zero `any` in every file added or modified (grep). |
| **AC-30** | `pnpm test:unit`: all 484 previously-passing tests still pass, plus every new test. The **only** failure is the pre-existing `lib/design/v7-css.test.ts`. |
| **AC-31** | `node scripts/audit/contrast-check.mjs` → **PASS**, with `0 unresolved` and `0 below threshold`, with the new screen included in its count. |
| **AC-32** | Coverage on the new `lib/freight/**` logic is **≥ 80 % lines**, measured and reported as a real number. |
| **AC-33** | No TODO, FIXME, placeholder, commented-out or dead code in any shipped file. Verified by grep over the diff. |
| **AC-34** | `SCHEMA.md`, `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md` and `queue.yaml` have dated **appended** sections; no existing text rewritten. |
| **AC-35** | `middleware.ts`, `main`, `docs/design/command-center-v7/**`, `tests/visual/**` and the generated v7 CSS are unmodified. Verified by `git diff --stat`. |
| **AC-36** | The item is recorded **UNVERIFIED pending human browser confirmation**, with the exact steps to verify. |

---

## 13. VALIDATION — MAPPED TO THE ACCEPTANCE CRITERIA

| Validation | Command / method | Covers |
|---|---|---|
| V-1 Migration content | Read `039_…sql`; `grep -n "DEFAULT" supabase/migrations/039_*.sql`; `grep -c "IF NOT EXISTS"` | AC-01, AC-02, AC-03, AC-04, AC-07 |
| V-2 Migration not applied | No `mcp__…Supabase__apply_migration` / `execute_sql` call in the run; stated in the report | AC-05 |
| V-3 Unit tests | `pnpm test:unit` | AC-06…AC-20, AC-22, AC-30 |
| V-4 Typecheck | `pnpm tsc --noEmit` | AC-29 |
| V-5 Lint | `pnpm lint` (next lint) | AC-29, AC-33 |
| V-6 Contrast gate | `node scripts/audit/contrast-check.mjs` | AC-31 |
| V-7 Coverage | `pnpm vitest run --coverage lib/freight` | AC-32 |
| V-8 Route review | Read the send route and the rate route; grep that `computed_cents` has no body-derived source | AC-21, AC-23, AC-24 |
| V-9 Customer-surface grep | `grep -rn "FreightEstimatePanel\|FreightRateEditor" app components` → only `app/admin/**` | AC-28, INV-01 |
| V-10 E2E | `pnpm test:e2e tests/e2e/freight-estimator.spec.ts` (requires admin `storageState`; reported honestly if unavailable) | AC-25, AC-26, AC-27 |
| V-11 Diff discipline | `git diff --stat`; `git status` | AC-34, AC-35 |
| V-12 Cleanliness | `grep -rn "TODO\|FIXME\|XXX\|placeholder"` over the diff | AC-33 |
| V-13 Governance | Read the appended sections | AC-34, AC-36 |

---

## 14. REQUIRED TESTS — CLASS, BEHAVIOUR, AND EXACT ASSERTIONS

Fixtures live in `lib/freight/fixtures.ts`: a two-zone table (`ZONE_LOCAL`,
`ZONE_REGIONAL`), contiguous bands `[0,500)`, `[500,1000)`, `[1000,∞)`, priced versions
with explicit cents, a surcharge version with explicit cents, and deliberately faulty
variants (overlapping, gapped, unpriced, retired). All values are fixture constants
invented **for tests only** and are never shipped as defaults.

### 14.1 Unit — `lib/freight/bands.test.ts` (class: unit, pure)

| # | ARRANGE | ACT | ASSERT (exact) |
|---|---|---|---|
| B-01 | contiguous 3-band table | `bandForWeight(bands, 0)` | band `[0,500)` — a zero-weight band floor is inclusive |
| B-02 | same | `bandForWeight(bands, 499)` | band `[0,500)` |
| B-03 | same | `bandForWeight(bands, 500)` | band `[500,1000)` — **exclusive ceiling** |
| B-04 | same | `bandForWeight(bands, 999)` | band `[500,1000)` |
| B-05 | same | `bandForWeight(bands, 1000)` | open band `[1000,∞)` |
| B-06 | same | `bandForWeight(bands, 99999)` | open band `[1000,∞)` |
| B-07 | bands `[0,500)`,`[500,1000)` only (closed top) | `bandForWeight(bands, 1000)` | `null` — no nearest-match guess |
| B-08 | bands starting at 100 | `bandForWeight(bands, 50)` | `null` |
| B-09 | contiguous | `bandForWeight(bands, 499.5)` | band `[500,1000)` — rounds up first (R-10) |
| B-10 | contiguous | `bandForWeight(bands, 499.4)` | band `[0,500)` — rounds down first |
| B-11 | contiguous | `bandForWeight(bands, 0)` / `-1` / `NaN` / `Infinity` | `[0,500)` for 0; `null` for the other three |
| B-12 | one band retired | `bandForWeight(bands, w in retired range)` | `null` — retired bands never match a new estimate |
| B-13 | contiguous priced | `validateBandCoverage(bands)` | `[]` — exact empty array |
| B-14 | `[0,600)` and `[500,1000)` | `validateBandCoverage` | one `overlap` problem naming both band ids |
| B-15 | `[0,500)` and `[600,1000)` | `validateBandCoverage` | one `gap` problem naming the uncovered 500–600 |
| B-16 | `[500,500)` | `validateBandCoverage` | `max-not-above-min` |
| B-17 | `[-100,500)` | `validateBandCoverage` | `negative-min` |
| B-18 | two bands with `max = null` | `validateBandCoverage` | `multiple-open-ended` |
| B-19 | two bands with the same `min` | `validateBandCoverage` | `duplicate-min` |
| B-20 | zero bands | `validateBandCoverage([])` | one `no-bands` problem, **not** a `gap` |
| B-21 | versions dated `2026-01-01` and `2026-12-01` | `rateVersionInForce(v, '2026-06-01')` | the January version |
| B-22 | same | `rateVersionInForce(v, '2026-12-01')` | the December version — `effective_from` equal to `asOf` **is** in force |
| B-23 | same | `rateVersionInForce(v, '2025-12-31')` | `null` |
| B-24 | two versions, same `effective_from`, different `created_at` | `rateVersionInForce` | the later `created_at` — the same-day correction wins |
| B-25 | `[]` | `rateVersionInForce([], today)` | `null` |
| B-26 | surcharge versions, one future | `surchargesInForce(v, today)` | the current one; the future one ignored |
| B-27 | `[]` | `surchargesInForce([], today)` | `null` — distinct from "set to zero" |

### 14.2 Unit — `lib/freight/estimate.test.ts` (class: unit, pure)

| # | ARRANGE | ACT | ASSERT (exact) |
|---|---|---|---|
| E-01 | priced table, zone chosen, 600 lb, 10 ft, no toggles, no threshold | `estimateFreight` | `ok: true`; `totalCents` = the `[500,1000)` rate exactly; `freightClass = '92.5'`; `residentialCents = 0`; `liftgateCents = 0`; `freeFreightApplied = false` |
| E-02 | as E-01, `longestPieceFt = 8` | | `freightClass = '85'` |
| E-03 | as E-01, `12` | | `'92.5'` |
| E-04 | as E-01, `16` | | `'100'` |
| E-05 | as E-01, `16.5` | | `'110'` |
| E-06 | as E-01, `24` | | `ok: true` — exactly 24 ft still auto-calculates |
| E-07 | as E-01, `24.01` | | `ok: false`; refusal kinds **contain** `oversize-manual-entry`; `requiresManualEntry = true`; result carries **no** `estimate` |
| E-08 | as E-01, `30` | | same as E-07, and `freightClass = '110'` is still reported |
| E-09 | priced table, `isResidential = true`, residential adder set | | `totalCents` = rate + adder; `residentialCents` = the adder |
| E-10 | priced table, `isResidential = true`, residential adder `null` | | `ok: false`; kinds contain `residential-adder-blank`; **no** amount |
| E-11 | priced table, `isResidential = false`, adder set | | adder **not** added; `residentialCents = 0` |
| E-12 | liftgate equivalents of E-09/E-10/E-11 | | same three shapes for `liftgate-adder-blank` / `liftgateCents` |
| E-13 | both toggles on, both adders set | | `totalCents` = rate + residential + liftgate, each counted once |
| E-14 | threshold set to 500000, subtotal 600000 | | `totalCents = 0`; `freeFreightApplied = true`; breakdown note states the threshold |
| E-15 | threshold 500000, subtotal **exactly** 500000 | | qualifies — `>=` |
| E-16 | threshold 500000, subtotal 499999 | | full freight; `freeFreightApplied = false` |
| E-17 | threshold `null`, any subtotal | | full freight; note says no threshold is configured |
| E-18 | threshold qualifying **and** `longestPieceFt = 30` | | `ok: false` with `oversize-manual-entry` — a refusal outranks free freight |
| E-19 | threshold qualifying **and** residential on with a blank adder | | `ok: false` with `residential-adder-blank` |
| E-20 | matched band's version has `rate_cents = null` | | `ok: false`; kinds contain `band-rate-blank`; **no** amount |
| E-21 | matched band has no versions at all | | same as E-20 |
| E-22 | table with zero zones | | `ok: false`; kinds contain `rate-table-empty` |
| E-23 | table with zones but no **band** anywhere | | `ok: false`; kinds contain `rate-table-empty` |
| E-23b | table with bands whose **rates** are all blank | | `ok: false`; kinds are **exactly** `['band-rate-blank']` — **NOT** `rate-table-empty` |
| E-24 | priced table, `zoneId = null` | | `ok: false`; kinds contain `no-zone-selected`, **not** `rate-table-empty` |
| E-25 | priced table, unknown `zoneId` | | `zone-not-found` |
| E-26 | priced table, retired zone chosen | | `zone-retired` |
| E-27 | zone with no live bands | | `zone-has-no-bands` |
| E-28 | zone whose bands overlap | | `band-coverage`, and the problems are carried through for display |
| E-29 | weight 2000 lb, closed top band at 1000 | | `no-band-for-weight`, message naming 2000 |
| E-30 | weight `0` / `-5` / `NaN` | | `bad-weight` for each |
| E-31 | zone chosen but blank rate **and** residential blank **and** 30 ft | | `ok: false` and refusal kinds contain **all three** of `band-rate-blank`, `residential-adder-blank`, `oversize-manual-entry` — every applicable reason, not the first |
| E-32 | priced table, integer cents throughout | | `totalCents` is an integer and equals `baseRateCents + residentialCents + liftgateCents` exactly — no rounding drift |
| E-33 | `OVERSIZE_MANUAL_ENTRY_FT` | read the constant | `=== 24`, matching `SPEC_FREIGHT_ESTIMATOR.md` §4 |

### 14.3 Unit — `lib/freight/override.test.ts` (class: unit, pure)

| # | ARRANGE | ACT | ASSERT (exact) |
|---|---|---|---|
| O-01 | ok estimate, `overrideCents = null` | `buildFreightEstimateRecord` | `basis = 'estimate'`; `computedCents` = the estimate; `overrideCents = null`; `finalCents = computedCents` |
| O-02 | ok estimate, `overrideCents = 25000` | | `basis = 'override'`; `computedCents` preserved; `finalCents = 25000` |
| O-03 | ok estimate, `overrideCents = 0` | | `basis = 'override'`; `finalCents = 0` — **0 is a real override**, not an absent one |
| O-04 | ok estimate, override **equal** to computed | | `basis = 'override'` — the estimator typed it, so it is recorded |
| O-05 | refused estimate, `overrideCents = 18000` | | `basis = 'manual'`; `computedCents = null`; `finalCents = 18000`; `refusals` carried onto the record |
| O-06 | refused estimate, `overrideCents = 0` | | `basis = 'manual'`; `finalCents = 0` |
| O-07 | refused estimate, `overrideCents = null` | | refuses to build a record — there is nothing to put on the quote |
| O-08 | ok estimate, no override | `auditDelta` | `old.freightCents` = computed, `new.freightCents` = computed, `new.basis = 'estimate'` |
| O-09 | refused estimate + override | `auditDelta` | `old.freightCents = null`, `new.freightCents = 18000`, `new.basis = 'manual'` |
| O-10 | a record from O-02 | inspect | the three R-05 CHECK conditions hold for the produced row — the shape can never violate the database |
| O-11 | `overrideCents = 12.5` (non-integer cents) | | refuses — cents are integers |
| O-12 | `overrideCents = -1` | | refuses — freight is never negative |
| O-13 | record from O-01 | inspect | `rateVersionIds` contains the version actually used, and `surchargeVersionId` the surcharge version actually read |

### 14.4 Boundary / null / empty coverage (explicit, per the Elite standard)

Null: `zoneId = null` (E-24), `rate_cents = null` (E-20), each adder `null`
(E-10, E-12), threshold `null` (E-17), no surcharge version at all (B-27), no rate
version at all (E-21, B-25), `overrideCents = null` (O-01, O-07).
Empty: empty table (E-22), zone with no bands (E-27, B-20), empty version array (B-25).
Zero: weight 0 (E-30), band floor 0 (B-01), override 0 (O-03, O-06), free-freight
total 0 (E-14).
Max/extreme: 99999 lb (B-06), 30 ft (E-08), `Infinity`/`NaN` (B-11, E-30).
Negative: `-1` lb (B-11), `-100` band min (B-17), `-1` override (O-12).
Non-integer: 499.5 lb (B-09), 12.5 cents (O-11), 24.01 ft (E-07).

### 14.5 E2E — `tests/e2e/freight-estimator.spec.ts` (class: E2E, UI)

| # | ARRANGE | ACT | ASSERT |
|---|---|---|---|
| X-01 | admin `storageState` | open `/admin/settings/freight` | the page renders; the heading is present; the **not-installed** notice names migration 039; nothing throws |
| X-02 | same | open `/admin/settings` | a link to `/admin/settings/freight` is present and navigates there |
| X-03 | same | open a quote request's estimator | the **"Freight Amount ($)"** input is present and accepts a value — the manual path is unbroken |

**No E2E writes to the freight tables** (A-09): they do not exist in any deployed
database at completion, by design.

---

## 15. OBSERVABILITY

- Every rate-table mutation writes an `admin_audit_log` row (`logAdminAction`) with
  before/after values; actions are named `freight_add_zone`, `freight_retire_zone`,
  `freight_add_band`, `freight_retire_band`, `freight_set_rate`,
  `freight_set_surcharges`.
- Every freight decision on a quote writes one append-only `freight_estimates` row
  carrying its inputs, the computed figure, the override, the basis, the version ids used
  and the refusals — so "why is the freight on this quote this number" is answerable
  from one row.
- Server-side failures log one structured console line with a bracketed tag
  (`[Freight Rates Error]`, `[Freight Estimate Audit Error]`), matching this codebase's
  existing convention, and never include a secret.
- A missing relation is reported as a **503 naming migration 039**, which is a
  diagnosable configuration message rather than a generic 500.

---

## 16. COMPLETION EVIDENCE REQUIRED

The final report must print: every file created and modified; the full SQL of migration
039; the real output of `pnpm tsc --noEmit`, `pnpm lint` on touched files,
`pnpm test:unit` (with counts), the coverage number for `lib/freight/**`, and the
contrast gate; the E2E result or the exact reason it could not run; the acceptance-criteria
status table; the pre-existing failure restated as pre-existing; every assumption
(A-01…A-09) and every unresolved item; and the browser verification steps.

---

## 17. UNRESOLVED

- **UNRESOLVED-01** The real rate structure (flat per band vs per-hundredweight with a
  minimum) is unknown until checklist #27–28/#80 arrive. ADR-1 records the choice and the
  one-column additive fix.
- **UNRESOLVED-02** Zone definition. There is no carrier, so there is no zone map;
  zones are whatever Steve enters. No zone is seeded.
- **UNRESOLVED-03** Whether a free-freight promise is meant to cover the residential and
  liftgate adders. This code refuses rather than guesses (R-17).
- **UNRESOLVED-04** AFS origin (#5) is still missing. Nothing here needs it, because
  nothing here computes distance.
- **UNRESOLVED-05** `quotes.freight` is `DECIMAL(10,2)` dollars while every new table is
  cents. This work converts at the boundary and does **not** migrate the legacy column —
  altering a customer-facing money column that five other modules read is outside this
  item (LAW 7). Recorded for a future item.
- **UNRESOLVED-06** Migration 039 is unapplied, so nothing here is live. The item is
  **UNVERIFIED** until a human applies it and confirms in a browser.

---

## 18. SELF-AUDIT

Performed after drafting, reviewing this document as another senior engineer's work and
actively looking for defects.

**Defects found and corrected during the audit:**
1. The first draft let a toggle that was on with a blank adder contribute 0. That is a
   direct violation of CLAUDE.md rule #19. Corrected to a refusal (R-16, A-06, E-10).
2. The first draft had the free-freight threshold short-circuit before the oversize and
   blank-adder checks, which would have reported "free" for a shipment the code could not
   price. Corrected: a refusal outranks the threshold (R-17, E-18, E-19).
3. The first draft treated a missing table as an empty table, which would make an
   unapplied migration indistinguishable from an unfilled rate book. Corrected to a
   discriminated installed/not-installed result that is surfaced in the UI (R-20, ADR-5,
   AC-20).
4. The first draft accepted the client's computed estimate on send. Corrected to a
   mandatory server re-computation (R-23, ADR-4, INV-04, AC-23).
5. The first draft used first-match-wins for band lookup. On an overlapping table that
   silently returns a wrong rate. Corrected to explicit coverage validation and refusal
   (R-11, ADR-3, E-28).
6. The first draft's override shape used a falsy test, which would have made an override
   of `0` indistinguishable from no override. Corrected to strict `null` checks and an
   explicit test (R-19, O-03, O-06).
7. The first draft proposed extending `pricing_ledger`'s `event_type` CHECK. That edits
   an existing constraint CLAUDE.md rule #20 governs. Corrected to a dedicated table
   (ADR-2, C-08).
8. The first draft did not state the `FREIGHT_ESTIMATOR_SCOPE.md` conflict. That is
   exactly the silent-convenient-reading LAW 3 and S27 forbid. Corrected: §3.4.

**DEVIATION FOUND DURING IMPLEMENTATION, recorded per LAW 8 rather than silently
applied.** R-14's first definition of `rate-table-empty` was "no zones at all, **or no
zone has a single priced band**". Writing the test for E-31 — the case that must report
three refusals at once — exposed it as wrong: a zone whose bands exist but whose *rates*
are blank would have been reported as an empty table, which would send the estimator to
build bands that are already there, and would have swallowed the `band-rate-blank`
refusal that names the exact row to fill in. `rate-table-empty` now means **structural**
emptiness only — no live zone, or no live zone with a live band — and an unpriced band
reports `band-rate-blank` naming the band. E-23 was split into E-23 and a new **E-23b**
asserting the kinds are *exactly* `['band-rate-blank']`, so the old behaviour cannot
come back. Strictly more useful to the estimator; no requirement was weakened.

**Score, per PART VIII's rubric:**

| Dimension | Max | Score | Note |
|---|---|---|---|
| Technical correctness | 15 | 15 | Band algebra, version resolution, refusal ordering and basis table all specified unambiguously and all boundary-tested. |
| Completeness | 15 | 15 | Schema, library, API, both UIs, wiring, tests, governance, migration, observability, unresolved items. |
| Repository grounding | 10 | 10 | Every claim in §3.3 read from source; the two existing helpers reused rather than rebuilt; baseline measured, including the pre-existing failure. |
| Architectural consistency | 10 | 10 | Mirrors migration 035 and `lib/pricing/**` deliberately: versioned + append-only, `is_admin()`, blanks never zero, pure core + one db file. |
| Requirement clarity | 10 | 10 | 28 numbered requirements; the basis table and the refusal table remove the two places ambiguity could survive. |
| Acceptance-test quality | 10 | 10 | 36 criteria, each mapped to a command or a named test in §13. |
| Edge case / failure coverage | 10 | 10 | §14.4 enumerates null/empty/zero/max/negative/non-integer explicitly; 73 specified tests. |
| Security and data integrity | 5 | 5 | Admin-only RLS with no customer policy, two independent append-only refusals, server-side re-computation, no client-trusted amount, database CHECKs that the record builder cannot violate. |
| Implementation executability | 10 | 10 | 14 ordered units with the gate to run after each; exact paths; exact existing helpers to reuse. |
| Reviewability / evidence | 5 | 5 | §16 names every artefact the report must print, including the real coverage number and the honest E2E outcome. |
| **Total** | **100** | **100** | |

**Critical-defect check:** no materially ambiguous requirement; no unverified repository
assumption where verification was possible (§3.3 is all read-from-source, and every
remaining uncertainty is tagged in §5.2 and §17); no missing critical acceptance
criterion; no contradictory requirement (the one genuine conflict is resolved and dated
in §3.4); no unsafe security requirement; no destructive migration behaviour — 039 is
purely additive, idempotent, and not applied; schema and API contracts stated
column-by-column; completion is objectively determinable from §12; the data-integrity
risks (a fabricated rate, a blank read as zero, a client-set estimate, an editable audit
trail) are each closed by a named mechanism. **None present.**

---

## ENGINEERING COMPLETION RECORD

Prompt ID: EES-OVN.05
Prompt Name: Freight Estimator — manual-entry-first, admin-configurable rate table, override with audit trail
Word Count: 10276 (body, measured with wc -w)
Engineering Proficiency Score: 100/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES
