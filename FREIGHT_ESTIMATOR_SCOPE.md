# FREIGHT_ESTIMATOR_SCOPE.md
## AFS — Freight Estimator: Current State + What's Actually Buildable

Prepared per request to read `specs/SPEC_FREIGHT_ESTIMATOR.md` in full, grep
the repo for any existing freight/carrier code, and determine honestly
whether the remaining work is a real code gap or a genuine data blocker.
Sourced from a live read of the spec, `STATE_OF_THE_BUILD.md`'s DATA
BLOCKERS table, `components/admin/QuoteEstimatorForm.tsx`,
`app/admin/quote-requests/[id]/page.tsx`, `lib/data/orders.ts`, and
`supabase/migrations/002_seed_afs_data.sql` — not from memory.

**Verdict: both, split cleanly down the middle.** Part of the spec is
genuinely blocked on missing client data and has zero code to write. A
smaller, separate part is a real code gap that can be built today without
inventing anything. This document keeps the two apart rather than blending
them into one "build the freight estimator" ticket.

---

## 1. WHAT EXISTS TODAY

Grepping the repo for `freight|carrier|liftgate` (case-insensitive, all
`.ts`/`.tsx`) turns up exactly one real implementation: a **manual dollar
entry field**.

`components/admin/QuoteEstimatorForm.tsx` (rendered at
`/admin/quote-requests/[id]`) has a "Freight" panel with:
- The jobsite address, read-only, for context (`jobsiteAddress` prop)
- A single `<input type="number">` — "Freight Amount ($)" — the estimator
  types a number
- That number flows straight into `POST /api/admin/quote-requests/[id]/send`
  as `freight`, gets stored on `quotes.freight`, and later copied to
  `orders.freight` (`lib/data/orders.ts`)

That's it. There is no `FreightCalculatorPanel`, no
`/api/admin/pricing/freight` route, no `getFreightClass()` function, no
weight calculation, no ZIP-based logic, and no residential/liftgate
toggles anywhere in the codebase. `orders.carrier` exists as a column
(`lib/data/orders.ts:384`) but is only ever populated as free-text
tracking info after shipment — never computed.

**This matches SPEC_FREIGHT_ESTIMATOR.md §3's own documented fallback
exactly:** *"Current behavior: estimator enters freight amount manually
until data received."* The interim behavior the spec describes as
acceptable is precisely what's built. Nothing here is missing by
oversight — the manual field is the spec's own intended placeholder.

---

## 2. WHAT'S GENUINELY BLOCKED (no code to write)

`STATE_OF_THE_BUILD.md`'s DATA BLOCKERS table lists "Carrier/freight
method | #27–28, #80 | Freight calculation" as blocked, and the spec's own
§3 lists six blockers before the dollar-calculation half of the feature
can activate:

- AFS origin ZIP (#5) — needed to compute origin→destination distance/lane
- Carrier name and rate structures (#27–28) — there is no rate table, no
  carrier contract, no LTL pricing matrix anywhere in this repo or in
  client-supplied data
- Own truck vs. third-party carrier decision (#80)
- Free freight threshold (#30)
- Residential delivery surcharge amount (#29)
- Liftgate upcharge (#88)

None of this is derivable from code, the schema, or anything already in
the repo. There is no commodity-price-style external API to substitute
(unlike `commodity_prices`, which pulls real metal spot prices) — LTL
freight rates are carrier-negotiated and specific to AFS's actual shipping
contracts. **Building a "Calculate Freight" button or a
`/api/admin/pricing/freight` route that returns a dollar figure right now
would mean fabricating a number that looks authoritative but isn't backed
by any real rate data.** That is out of scope and should not be built
until #27–28/#80 (and #5, #29, #30, #88) arrive. The spec itself
anticipated this and defined the manual-entry fallback for exactly this
reason — which is already built (§1).

---

## 3. WHAT'S A REAL CODE GAP (buildable now, no invented data)

Two small pieces of the spec's algorithm section (§4) don't depend on
carrier rates at all — they're geometry and reference-data lookups the
codebase already has the raw material for, and neither is built:

1. **Freight class from longest piece length.** SPEC §4's
   `getFreightClass(longestPieceFt)` is a pure function — an NMFC-style
   classification table (≤8ft → 85, ≤12ft → 92.5, ≤16ft → 100, >16ft →
   110), explicitly given in the spec, no external data needed. It isn't
   implemented anywhere in the repo.

2. **Estimated weight from the submitted line items.** Every gauge in
   `supabase/migrations/002_seed_afs_data.sql` carries a real, seeded
   `weight_lbs_sqft` value (industry-standard sheet weights, e.g. 26 GA
   galvanized = 0.7310 lbs/sqft, 16 oz copper = 1.0047 lbs/sqft — not
   placeholders). Combined with each line item's width/height/quantity/
   length already present on `quote_requests.line_items`, a real total
   weight is computable today.

Both are legitimate, verifiable numbers — not fabricated prices — and
match what SPEC §2's mock UI calls "auto-filled when products set."

**One real wrinkle:** `quote_requests.line_items` stores `material` and
`gauge` as free-text labels typed/selected during quote submission (e.g.
`"Copper"`, `"16 oz"`), not foreign keys to the `materials`/`gauges`
tables. Matching those labels back to a seeded `weight_lbs_sqft` row
requires string matching, which won't always resolve cleanly (typos,
unusual capitalization, a material/gauge combo not in the seed data).
Build this as **best-effort with a visible fallback** — if no confident
match is found for a line item, show "—" for that item's weight
contribution and let the estimator eyeball it, rather than silently
guessing or defaulting to some hardcoded average weight.

---

## 4. RECOMMENDED SCOPE

**Where it fits:** No new route or page. This extends the existing
Freight panel inside `components/admin/QuoteEstimatorForm.tsx` — admin-only,
already gated the same way the rest of `/admin/quote-requests/[id]` is.
Do not build the spec's `/api/admin/pricing/freight` endpoint or a
standalone `FreightCalculatorPanel` component that implies a "Calculate"
button producing a dollar figure — there is nothing honest for it to
return yet.

**Build:**
- A pure `getFreightClass(longestPieceFt: number): string` helper
  (`lib/admin/pricing.ts`, alongside the existing `computeLineTotal` /
  `computeBilledQuantity` freight-adjacent helpers), implementing SPEC
  §4's table exactly.
- A best-effort weight estimator that looks up each line item's
  `material`/`gauge` against seeded `materials`/`gauges` data, sums
  `weight_lbs_sqft × (width_in × height_in / 144) × quantity` per item
  (falling back to leg dimensions where width/height aren't set — mirror
  whatever geometry `formatDimensions()` already uses), and reports a
  total plus any items it couldn't confidently match.
- Surface both as **read-only reference numbers** in the existing Freight
  panel — "Longest piece: 14 ft → Class 100", "Estimated weight: ~340
  lbs (2 of 3 items matched)" — next to the manual `$` input that's
  already there. These exist to help the estimator type a more informed
  number into the field that already exists, not to replace it.

**Do not build:**
- Any dollar output. No `/api/admin/pricing/freight` route, no "Estimated
  freight: $X.XX via {carrier}" display, no residential/liftgate dollar
  adders, no free-freight-threshold check — all six items in §2 above are
  needed first and none exist.
- Destination-ZIP-based logic. `quote_requests.jobsite_address` is stored
  as a single opaque string (confirmed in
  `app/admin/quote-requests/[id]/page.tsx:74` — `typeof ... === 'string'`),
  not a structured address with a discrete ZIP field. Regex-extracting a
  ZIP from free text to feed a distance/lane calculation would be exactly
  the kind of fragile, looks-complete-but-isn't logic this task says not
  to invent. Leave the address as the read-only display text it already
  is until there's a structured address field to build on.
- Residential-delivery and liftgate **toggles**, even as informational
  (non-priced) flags. The spec ties them directly to dollar adders (§2:
  "Residential adder: $X.XX," "Liftgate adder: $X.XX") that don't exist;
  adding the toggles now would be UI with no defined behavior behind it.

---

*FREIGHT_ESTIMATOR_SCOPE.md | AFS | prepared from live codebase audit, 2026-07-30*
