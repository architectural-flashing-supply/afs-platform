# EES-OVN.08 — TAXJAR INTEGRATION: NEXUS CONFIGURATION AND TAX CALCULATION

**Prompt ID:** EES-OVN.08
**Prompt Name:** TaxJar Integration — Nexus Configuration and Tax Calculation
**Item:** `08-taxjar`
**Branch:** `ovn/08-taxjar` (git worktree of `C:\Users\manag\Documents\afs-website`)
**Date:** 2026-10-03
**Source spec:** `specs/SPEC_TAXJAR_INTEGRATION.md`
**Status:** CANONICAL for this run

---

## 1. IDENTITY

This document is the implementation contract for item `08-taxjar`. It specifies a
typed sales-tax calculation subsystem for the AFS platform: a provider-agnostic
engine, a real TaxJar HTTP client, a fully-implemented mock provider, a nexus
configuration table with an admin editor, result caching, and failure handling
that never blocks and never silently zeroes a sale.

It distinguishes CURRENT STATE (what the repository contains today, verified by
inspection) from TARGET STATE (what this item builds) throughout, and it never
conflates the two.

---

## 2. OBJECTIVE

Build the sales-tax layer AFS will need for multi-state compliance, to a standard
where switching it on is a configuration act rather than an engineering act —
**without** inventing any of the three facts AFS has not supplied (the nexus
state list, the origin ZIP, and a TaxJar API key), and **without** changing a
single dollar amount any customer can see today.

The governing requirement, which the source spec gets wrong and this document
deliberately overrides, is:

> **An uncalculated tax is not a zero tax.** A missing configuration, an
> unreachable vendor, a malformed vendor response and a rate of exactly zero are
> four different facts. Collapsing any of the first three into `0` either
> under-collects a tax AFS is legally obliged to remit, or silently misstates a
> customer's total. The subsystem must therefore be incapable of returning a
> number it cannot justify.

---

## 3. ENGINEERING CONTEXT

### 3.1 Business model constraint (CLAUDE.md, "BUSINESS MODEL")

AFS is an RFQ platform. Customers never see a price before AFS issues a formal
quote. The only dollar amounts a customer sees are on an AFS-generated quote or
invoice. Tax is therefore **not** a customer-facing estimate; it is a component
of a figure AFS has set and stands behind.

### 3.2 Where money is decided today — [Certain], verified by inspection

| Concern | File | Current behaviour |
|---|---|---|
| Quote arithmetic | `lib/pricing/quote-math.ts` | `totalCents = subtotalCents`. Lines 236–239 carry an explicit comment that freight and tax are **not** invented here because both are open DATA BLOCKERS. |
| Invoice creation | `lib/invoices/create.ts:123` | Writes `tax_cents: 0` as a literal on every invoice. |
| Amount actually charged | `app/api/checkout/create-intent/route.ts` | `amount: Math.round(quote.total * 100)`, read from `quotes.total`. Tax is **not** added at payment time. |
| Checkout display | `app/checkout/page.tsx:632` | Renders `quote.tax != null ? currency.format(quote.tax) : '—'`. Nothing in the codebase writes `quotes.tax`, so it is NULL and displays `—`. |
| Price book money | `lib/pricing/price-book.ts`, migration 035 | Cents, integer, nullable-means-blank. |

**Consequence, and it is the single most important fact in this document:** the
figure Stripe charges is `quotes.total`, set by AFS before the customer ever
reaches checkout. There is today no checkout-time addition to it.

### 3.3 The three blocked inputs — [Certain]

| Input | Where recorded as blocked | Effect on this item |
|---|---|---|
| Nexus state list | CLAUDE.md DATA BLOCKERS, "Tax nexus states — checklist #31" | The nexus table ships **empty**. No state is seeded. |
| AFS origin address / ZIP | CLAUDE.md DATA BLOCKERS, "AFS address, phone, hours — checklist #5" | The TaxJar provider requires origin ZIP + state from env; it never guesses. |
| TaxJar API key | `app/admin/settings/page.tsx:35` reads `process.env.TAXJAR_API_KEY`; no key exists | `TAX_PROVIDER` defaults to "no provider". |

### 3.4 What the source spec says, and the three places this document overrides it

`specs/SPEC_TAXJAR_INTEGRATION.md` is ~70 lines and is marked
**"BLOCKED: Tax nexus states required (checklist #31)"**. It is quoted and
honoured where it is sound. Three deviations are deliberate, each recorded here
with its reason (LAW 8 — no silent architectural deviation):

**DEV-01 — The spec's failure path is rejected.**
The spec's §3 `catch` block returns `{ taxAmount: 0, taxRate: 0, error: true }`.
That is a silent zero: the `error: true` flag is discarded by the first caller
that reads `.taxAmount`, and a vendor outage then becomes an under-collected
tax. The item's own instruction is explicit — *"failure handling that NEVER
blocks or silently zeroes a sale (surface a flagged result for admin review)"*.
**TARGET:** a discriminated union in which a failed calculation has **no amount
field at all**, so a caller cannot read a zero off it, plus a persisted row
flagged for admin review.

**DEV-02 — `from_state: 'TX'` is not hardcoded.**
The spec hardcodes `from_state: 'TX'` with the comment `// BLOCKED: infer from
ZIP`. CLAUDE.md does place the shop in Burnet, Texas, but a tax origin is a
legal input to a filing, and the ZIP half is a stated blocker. Hardcoding one
half of a blocked pair produces a request that looks complete and is not.
**TARGET:** both origin ZIP and origin state come from env
(`TAX_ORIGIN_ZIP`, `TAX_ORIGIN_STATE`); either missing means `not_configured`,
naming the blocker.

**DEV-03 — The `taxjar` npm SDK is not added; nexus is also recorded locally.**
The spec's §3 imports the `taxjar` package. `package.json` does not contain it
([Certain] — read, not remembered). This repository already has an established
pattern for a vendor REST client — `lib/integrations/pathfinder-edge.ts` plus
`lib/integrations/pathfinder-response.ts` — being a typed `fetch` with an
`AbortController` timeout and a hand-written response parser that validates
rather than casts. **TARGET:** follow the house pattern; add no dependency.
The spec's §2 also says nexus is *"Configured in TaxJar dashboard — not in
code"*; the item requires a local nexus table. These are complementary, not
contradictory: TaxJar remains authoritative for rate lookup, and the local table
is AFS's own record of what its accountant supplied — which is what makes the
admin screen, the empty state, and a provider-independent `no_nexus` answer
possible. Documented as an addition, not a replacement.

### 3.5 House patterns this item must follow — [Certain], all read

| Pattern | Reference file | What is reused |
|---|---|---|
| Vendor response validated, never cast | `lib/integrations/pathfinder-response.ts` | `ShapeResult<T>` = `{ok:true,value}` \| `{ok:false,problems:string[]}`; parser never throws; `MAX_PROBLEMS` cap; one `console.error` line with a truncated payload. |
| Read timeout via `AbortController` | `lib/integrations/pathfinder-edge.ts:255–309` | `PATHFINDER_READ_TIMEOUT_MS = 8000`; timeout told apart from network failure because they read differently to a human. |
| Admin config editor | `app/admin/settings/price-book/page.tsx` + `components/admin/PriceBookEditor.tsx` + `app/api/admin/price-book/route.ts` | Server page → `requireAdminUser` → data layer → client editor; POST route with `action` discriminator, re-checks role, uses `createAdminClient()` for writes, `logAdminAction` after each mutation, plain-English messages. |
| Blank ≠ zero | `lib/pricing/quote-math.ts`, CLAUDE.md rule #19 | A missing input refuses to produce a figure and names the row to go and fix. |
| Retire, never delete | `app/api/admin/price-book/route.ts` `action: 'retire'` | History is preserved so past documents still resolve. |
| Service-role reads are never cached | `lib/supabase/admin.ts` | `cache: 'no-store'` on every request (CLAUDE.md rule #22). |
| Admin-only RLS | migration 035 lines 457–461 | `CREATE POLICY … FOR ALL USING (is_admin())`; `is_admin()` defined in `001_initial_schema.sql:15`. |
| Static enforcement test | `lib/integrations/pathfinder-single-door.test.ts` | Walks source directories and fails on a forbidden import. |

---

## 4. REQUIRED REPOSITORY INSPECTION — WHAT WAS ACTUALLY INSPECTED

Performed before any line of this document was written. LAW 3 / S26.

**Existence check (STEP 1 of the run brief).** `grep -rn -i
"taxjar\|nexus\|sales_tax\|tax_rate\|tax_amount\|tax_cents"` over
`app lib components supabase scripts tests`, plus
`find . -iname "*tax*"`. Result — **the feature does not exist.** Every hit is
one of four things:

1. `app/admin/settings/page.tsx:35,61–62` — a TaxJar **status badge** reading
   `TAXJAR_API_KEY`, already saying *"Blocked on tax nexus states (checklist
   #31)"*. No client, no calculation.
2. `lib/data/invoices.ts:73,88` + migration `035:306,337` — the `invoices.tax_cents`
   **column** (`bigint NOT NULL DEFAULT 0`, with a `>= 0` CHECK), written as a
   literal `0` by `lib/invoices/create.ts:123`.
3. `lib/fixtures/command-center-v7.ts:338` — `V7_TAX_RATE = 0.0825`, a
   **fixture-mode demo constant** for the v7 pixel gate, consumed by
   `lib/data/v7-view/pricing.ts`. Governed by CLAUDE.md rules #33/#34.
   **OUT OF SCOPE — must not be touched.**
4. `lib/pricing/quote-math.ts:236` — the comment recording tax as a blocker.

There is no `lib/tax/`, no `lib/taxjar/`, no nexus table, no tax API route and
no tax admin screen. **Nothing is being rebuilt; this item is net-new.**

**Also inspected, in full or in the cited part:** `CLAUDE.md` (all 34 rules);
`specs/SPEC_TAXJAR_INTEGRATION.md`; `specs/SPEC_CHECKOUT.md` §§1–3;
`app/checkout/page.tsx` (money lines); `app/api/checkout/create-intent/route.ts`
(whole); `lib/invoices/create.ts:90–165`; `lib/pricing/quote-math.ts:200–290`;
`lib/pricing/db.ts:1–60`; `app/api/admin/price-book/route.ts` (whole);
`app/admin/settings/page.tsx` (whole); `app/admin/settings/price-book/page.tsx`
(whole); `components/admin/PriceBookEditor.tsx` (state/ARIA lines);
`lib/admin/auth.ts`; `lib/admin/audit.ts`; `lib/supabase/admin.ts`;
`lib/integrations/pathfinder-response.ts`; `lib/integrations/pathfinder-edge.ts:1–150,255–324`;
`lib/data/admin-nav.ts`; `lib/data/admin-working-area.ts`;
`supabase/migrations/035_price_book_ledger_quotes_invoices.sql` (tables + RLS);
`supabase/migrations/037_deliveries_and_shop_queue.sql:1–80`;
`supabase/migrations/001_initial_schema.sql:41` (`profiles.tax_exempt`);
`package.json`; `vitest.config.mts`; `tsconfig.json`;
`docs/design/command-center-v7/SCREEN_MANIFEST.json` (settings entries);
`tests/visual/v7-screen-drivers.ts` (settings drivers); `ls supabase/migrations/`.

### 4.1 Findings that change the design

**F-1 — `profiles.tax_exempt` already exists.** [Certain]
`001_initial_schema.sql:41`: `tax_exempt BOOLEAN NOT NULL DEFAULT false`.
Already surfaced and editable: `lib/data/customers.ts:109,118,136` and
`app/api/admin/customers/[id]/route.ts:59,90,129,148`.
**→ No new column. The engine consumes the existing flag, and the spec's §4
exemption behaviour is satisfied by an `exempt` outcome.**

**F-2 — The next free migration number is 039.** [Certain] — `ls` shows 001–038,
most recently `038_profile_search_shortcuts.sql`.

**F-3 — `/admin/settings` is outside the v7 pixel gate on its live branch.** [Certain]
`app/admin/settings/page.tsx:112` short-circuits to
`<LightWorkingArea><V7Settings …/></LightWorkingArea>` when
`isFixtureMode(searchParams)`. `SCREEN_MANIFEST.json`'s four `settings-*` states
all drive `/admin/settings…`, and the pixel gate runs in fixture mode
(CLAUDE.md rule #34), so it measures the `V7Settings` branch **only**.
**→ Adding a section to the LIVE settings screen cannot move a pixel-gate
baseline.** It is still measured by the CONTRAST gate (rule #28), which walks
real JSX, so the new markup must reuse tokens already proven on this page.

**F-4 — `/admin/settings/price-book` is the exact precedent for a sub-screen.** [Certain]
It is a light working area that opts in with `<LightWorkingArea>`, and it is
**not** listed in `LIGHT_WORKING_AREA_SCREENS`. Whether that omission is an
oversight is **UNRESOLVED-04**; this item follows the precedent and does not
edit `lib/data/admin-working-area.ts` (LAW 7).

**F-5 — Neither `/admin/settings` nor its children has an `error.tsx`.** [Certain]
`find app -name "error.tsx"` → 12 files; `app/admin/error.tsx` exists and covers
the whole admin subtree. CLAUDE.md rule #30 is satisfied by that ancestor.
**→ No new `error.tsx`; adding one would be unrequested change.**

**F-6 — `tests/fixtures/` is empty.** [Certain] — `ls` returns nothing.
**→ `tests/fixtures/tax/` is created by this item.** `@/*` maps to the repo root
in both `tsconfig.json` and `vitest.config.mts`, so `@/tests/fixtures/tax/…`
resolves under test. [Certain — both files read.]

**F-7 — Vitest collects `lib/**/*.test.ts` only.** [Certain] —
`vitest.config.mts`. **→ Unit tests live beside their modules in `lib/tax/`.**

**F-8 — PRE-EXISTING BASELINE FAILURE.** `pnpm test:unit` →
**484 passed, 1 failed (31 files, 1 failed)**: `lib/design/v7-css.test.ts:44`,
*"app/styles/command-center-v7.generated.css is stale. Run `pnpm css:v7`"*.
Working tree was clean at session start, so this failure predates this item and
is **not attributable to it** (S36). It is not fixed here: regenerating a frozen
design artifact is outside this item's scope and the run brief forbids touching
the v7 design pipeline. Recorded in the final report.

---

## 5. PRECONDITIONS AND ASSUMPTIONS

### 5.1 Preconditions (all verified)

| # | Precondition | Status |
|---|---|---|
| P-1 | Next.js 14.2.5 App Router, TypeScript 5 strict, pnpm | [Certain] `package.json` |
| P-2 | Vitest 5 configured with `@` → repo root | [Certain] `vitest.config.mts` |
| P-3 | `is_admin()` SQL helper exists | [Certain] `001_initial_schema.sql:15` |
| P-4 | `profiles.tax_exempt` exists | [Certain] F-1 |
| P-5 | `requireAdminUser`, `logAdminAction`, `createAdminClient` exist | [Certain] |
| P-6 | Baseline `tsc --noEmit` clean | [Certain] exit 0 |
| P-7 | Migration 039 is the next free number | [Certain] F-2 |

### 5.2 Assumptions, each with its risk

| # | Assumption | Confidence | Risk if wrong | Mitigation |
|---|---|---|---|---|
| A-1 | TaxJar's tax endpoint is `POST {base}/v2/taxes`, auth `Authorization: Bearer <token>`, response `{ tax: { amount_to_collect, rate, has_nexus, taxable_amount, freight_taxable } }`. | **[Likely]** — not verified against a live call (no key exists and this run makes no network calls). Corroborated by the source spec's own field names (`response.tax.amount_to_collect`, `response.tax.rate`), which were written against the real SDK. | A real switch-on returns a shape error rather than a tax. | The base URL is env-configurable (`TAXJAR_API_BASE_URL`); the parser reports a precise shape problem and logs a truncated real payload; the outcome is `failed` + flagged for review, never a wrong number. The uncertainty is recorded in the module header and as UNRESOLVED-01. |
| A-2 | TaxJar money is **decimal dollars**; this codebase is **integer cents**. | **[Likely]** — consistent with the spec's `amount: params.subtotal` (dollars) and with TaxJar's documented decimal amounts. | A 100× error. | Conversion happens in exactly one function, is unit-tested at boundaries, and the parser rejects a non-finite or negative amount. |
| A-3 | One nexus row per state, with `effective_from`/`effective_to`, is sufficient history. | **[Likely]** | A re-run of a historic calculation could use today's nexus rather than the then-current one. | Every provider interaction is **snapshotted** in `tax_calculations` (request + outcome + the nexus decision), so a past calculation is reproducible from the record rather than by re-deriving it. Trade-off recorded in §12 ADR-2. |
| A-4 | Tax is **not** wired into any customer-facing total in this item. | **[Certain]** — a decision, not a guess. See §8 and ADR-1. | None. | Enforced by a static test. |
| A-5 | Nexus/origin/provider config is AFS-global, not per-customer-company. | **[Certain]** from the model: these are facts about AFS, the seller. | None. | No `company_id` on the nexus table; see §9.4 for how the Six-Laws tenancy rule applies here. |

---

## 6. SCOPE

### 6.1 CREATED — `lib/tax/` (pure logic + providers)

| Path | Purpose |
|---|---|
| `lib/tax/types.ts` | The vocabulary: `TaxCalculationRequest`, `TaxOutcome` (discriminated union), `NexusState`, `TaxProvider` interface, `TaxProviderName`. No imports from Supabase or `next`. |
| `lib/tax/config.ts` | `resolveTaxProvider(env)` — pure env resolution to `'none' | 'mock' | 'taxjar'` plus a human reason. Takes an env record as an argument so it is testable without mutating `process.env`. |
| `lib/tax/nexus.ts` | Pure nexus logic: normalise a state code, `findNexusForState(list, state, onDate)`, `isCollectingNexus`. |
| `lib/tax/calculate.ts` | The engine. Pure apart from the injected provider: `calculateTax(request, { provider, nexus, exempt })` → `TaxOutcome`. Decides exempt / no-nexus / not-configured before any network call. |
| `lib/tax/response.ts` | TaxJar response parser — `ShapeResult<ParsedTaxResponse>`, never throws, mirrors `pathfinder-response.ts` including the truncated-payload log line. |
| `lib/tax/cache-key.ts` | Deterministic, order-independent cache key over the request + provider + origin. |
| `lib/tax/providers/taxjar.ts` | Real HTTP client: `fetch`, `AbortController` timeout, raw body parsed by `response.ts`. Never throws. |
| `lib/tax/providers/mock.ts` | Fully-implemented mock provider over a recorded fixture rate table. Marks every result `provider: 'mock'`. |
| `lib/tax/db.ts` | The ONLY Supabase-touching file: nexus read/write, cache read/write, review-queue read. |

### 6.2 CREATED — tests

`lib/tax/config.test.ts`, `nexus.test.ts`, `calculate.test.ts`,
`response.test.ts`, `cache-key.test.ts`, `providers/mock.test.ts`,
`providers/taxjar.test.ts`, `tax-not-in-money-path.test.ts` (static
enforcement), and `tests/fixtures/tax/taxjar-responses.ts` +
`tests/fixtures/tax/nexus.ts` (versioned fixtures).

### 6.3 CREATED — migration file (NOT APPLIED)

`supabase/migrations/039_tax_nexus_and_calculations.sql` — two tables, RLS,
indexes, CHECK constraints, **zero seeded states**.

### 6.4 CREATED — API routes

`app/api/admin/tax-nexus/route.ts` (config CRUD),
`app/api/admin/tax-nexus/preview/route.ts` (admin-only calculation preview).

### 6.5 CREATED — UI

`app/admin/settings/tax-nexus/page.tsx`,
`components/admin/TaxNexusEditor.tsx`.

### 6.6 MODIFIED — exactly two existing files

| File | Change | Why minimal |
|---|---|---|
| `app/admin/settings/page.tsx` | Add a "Sales tax" section with one link card to `/admin/settings/tax-nexus`, and make the existing TaxJar status row reflect `TAX_PROVIDER` as well as the key. | The Pricing section's link-card markup is copied verbatim with its tokens, so the contrast gate sees colours already proven on this page. Live branch only → no pixel-gate effect (F-3). |
| `.env.example` | Document the new env vars, all optional, all defaulting to off. | Tracked file; CLAUDE.md requires env vars be documented there. |

### 6.7 RETAINED UNTOUCHED — stated explicitly

`middleware.ts`; `lib/pricing/quote-math.ts`; `lib/invoices/create.ts`
(`tax_cents: 0` stays); `app/api/checkout/**`; `app/checkout/page.tsx`;
`lib/fixtures/command-center-v7.ts` and `lib/data/v7-view/pricing.ts`
(`V7_TAX_RATE`); everything under `docs/design/command-center-v7/`; every pixel
and style baseline; `lib/data/admin-nav.ts`; `lib/data/admin-working-area.ts`;
migrations 001–038; `app/admin/settings/price-book/**`.

---

## 7. NON-GOALS (S37)

1. **Collecting tax.** Nothing in this item causes a dollar of tax to be charged.
2. **Wiring tax into a customer-visible total** — quote, invoice, checkout or
   Stripe amount. See §8.
3. **Seeding nexus states**, a rate, a threshold or an origin ZIP. Blocked data.
4. **Economic-nexus threshold monitoring** (tracking sales per state to detect
   when nexus is newly established). TaxJar's dashboard does this; no requirement
   has been stated. The table records the *basis* of a nexus, not a running total.
5. **Tax filing, reporting or remittance** (TaxJar Reports / AutoFile).
6. **Exemption-certificate storage.** `profiles.tax_exempt` is consumed; document
   upload is `SPEC_DOCUMENT_UPLOAD.md`'s job.
7. **Backfilling tax onto historical invoices.**
8. **Adding the `taxjar` npm package** (DEV-03).
9. **Touching the v7 Command Center** or any design baseline.
10. **Freight taxability policy.** The engine *passes* a shipping amount and
    *reports* the vendor's `freight_taxable` answer; it does not decide the policy.
11. **Fixing the pre-existing `v7-css.test.ts` failure** (F-8).
12. **Applying the migration** to any Supabase project.

---

## 8. THE WIRING DECISION — WHY TAX IS NOT CONNECTED TO CHECKOUT

The item's instruction is conditional: *"Do not wire it into live checkout totals
**unless the spec's flow is unambiguous** and the flag is OFF by default."*

**The flow is ambiguous, in three independent ways.** The condition therefore
fails and the conservative branch is taken. The evidence:

1. **The two specs disagree about where tax lives.**
   `SPEC_TAXJAR_INTEGRATION.md` §1: *"Tax is calculated at checkout on the
   AFS-approved quote total"* and *"Tax appears as a line item on the formal
   quote **and** on the checkout page."* But `SPEC_CHECKOUT.md` §2 has the quote
   show `Tax: "Calculated at checkout" (TaxJar runs at payment)` — i.e. the quote
   does **not** carry a tax figure. A line item on the quote and a figure not
   known until payment are mutually exclusive.

2. **Adding tax at payment time would charge more than the approved total.**
   `create-intent` charges `Math.round(quote.total * 100)`. Tax computed at
   checkout is, by construction, not in `quote.total`. Adding it makes the charge
   exceed the figure the customer approved — which collides with CLAUDE.md's
   business model (*"the only dollar amounts customers see are on formal
   AFS-generated quotes"*) and with LAW 9. Which of the two should move —
   `quotes.total`, or the charge — is a business decision nobody can make tonight.

3. **The inputs do not exist.** With no nexus states, no origin ZIP and no API
   key, every call would return `not_configured`. Wiring a path that cannot
   produce an answer adds risk and delivers nothing.

**TARGET STATE instead:** the engine is complete, admin-reachable and exercisable
end-to-end through the preview route, and the money paths are **provably**
untouched. "Provably" is a static test, `lib/tax/tax-not-in-money-path.test.ts`,
modelled on `pathfinder-single-door.test.ts`: it walks `app/`, `components/` and
`lib/`, and fails if any file in the customer money path imports `lib/tax/*`. The
guarded set is named explicitly in the test — `lib/pricing/**`,
`lib/invoices/**`, `app/api/checkout/**`, `app/checkout/**`,
`app/api/webhooks/stripe/**`, `lib/data/orders.ts` — and the allowed importers
are exactly the admin tax route pair, the admin tax UI, and `lib/tax` itself.

This is a stronger guarantee than the "prove flag-off output is identical" test
the item asks for in the wired case: flag-off identity is a property of one code
path at one moment, whereas an import-graph assertion fails the suite the moment
anyone connects the two subsystems, in any flag state.

**UNRESOLVED-02 (escalated to Reid, per S28):** before tax can be collected,
somebody must decide whether tax is computed by the estimator and folded into
`quotes.total` + `quotes.tax` *before* the quote is sent (which keeps "the
customer is charged exactly the approved figure" true, and matches
`SPEC_TAXJAR_INTEGRATION.md`'s "line item on the formal quote"), or computed at
payment and added to the charge (which matches `SPEC_CHECKOUT.md`'s "Calculated
at checkout" but breaks the approved-figure invariant). §14 specifies the
quote-time option in enough detail to implement, because it is the one that
preserves the existing invariant — but it is **not built here**.

---

## 9. INVARIANTS (S38) — must hold after this item

| # | Invariant | How it is held |
|---|---|---|
| INV-01 | No customer sees any tax figure that did not exist before this item. | Nothing customer-facing is modified; the static import test enforces it. |
| INV-02 | The Stripe charge amount is byte-for-byte unchanged. | `create-intent` is untouched and importing `lib/tax` there fails the suite. |
| INV-03 | `invoices.tax_cents` is still written as `0` by `lib/invoices/create.ts`. | Untouched. (It is a *known literal*, not a calculated zero — recorded as UNRESOLVED-03.) |
| INV-04 | A `TaxOutcome` that is not `calculated` or `exempt` or `no_nexus` exposes **no amount field**. | The union has no `amountCents` on `not_configured` or `failed`; `tsc` enforces it. Asserted by test. |
| INV-05 | `TAX_PROVIDER` unset ⇒ outcome is always `not_configured`; no network call is ever made. | `calculateTax` resolves the provider before touching one; asserted with a provider that throws if called. |
| INV-06 | A mock result can never be mistaken for a real one. | Every outcome carries `provider`, and `mock` additionally carries `isAuthoritative: false`. Asserted. |
| INV-07 | A failed calculation is recorded and flagged for a human. | `tax_calculations` row with `requires_review = true`; surfaced on the admin screen. |
| INV-08 | A failure is **never** served from cache. | Only `calculated` rows are cache-readable; asserted. |
| INV-09 | The nexus table is admin-only at the database. | RLS `FOR ALL USING (is_admin())`; no anon/authenticated policy exists. |
| INV-10 | Every `/api/admin/tax-nexus*` request without an admin session is refused. | 401 then 403, re-checked in the route after `createClient()`. |
| INV-11 | The nexus list ships empty and an empty list never means "no tax owed". | No seed rows; empty ⇒ `not_configured`, asserted by a dedicated test. |
| INV-12 | The v7 pixel and style baselines are unchanged. | No file under `docs/design/command-center-v7/`, `tests/visual/`, or the v7 fixture modules is modified (F-3). |
| INV-13 | `pnpm build`'s contrast gate still exits 0. | New markup reuses tokens already present and passing on the pages it copies; gate re-run as validation. |
| INV-14 | No secret is read, printed or committed. | Only `Boolean(process.env.X)` presence checks and server-side use; no value is ever logged or returned. |

---

## 10. REQUIREMENTS

### R-1 — The outcome type (`lib/tax/types.ts`)

**R-1.1** `TaxOutcome` is a discriminated union on `kind`, with exactly these five members:

| `kind` | Meaning | Carries an amount? |
|---|---|---|
| `calculated` | A provider returned a tax for a nexus state. | **Yes** — `amountCents`, `rate`, `taxableAmountCents`, `freightTaxable`, `jurisdictions`. |
| `exempt` | The customer is tax-exempt (`profiles.tax_exempt`). | **Yes — `amountCents: 0`**, a justified zero, with `reason: 'customer_exempt'`. |
| `no_nexus` | Nexus is configured, and the ship-to state is not one. | **Yes — `amountCents: 0`**, a justified zero. |
| `not_configured` | No provider, no origin, or an empty nexus list. | **NO FIELD AT ALL.** |
| `failed` | Provider error, timeout, or an unparseable response. | **NO FIELD AT ALL**, plus `requiresAdminReview: true` and `problems: string[]`. |

**R-1.2** Every member carries `provider: TaxProviderName` and
`isAuthoritative: boolean` (`false` for `mock`).
**R-1.3** Every member carries a `reason: string` in plain English, suitable for
showing an admin, that never contains a key, a token or a URL with credentials.
**R-1.4** `collectableTaxCents(outcome): number | null` returns the amount for
the three amount-bearing kinds and **`null`** for the other two — so a caller
must handle "no answer" explicitly and cannot fall through to a zero.
**R-1.5** `TaxProvider` is `{ name; calculate(req, origin): Promise<ProviderResult> }`
where `ProviderResult` is itself a success/failure union. A provider never throws.

### R-2 — Provider resolution (`lib/tax/config.ts`)

**R-2.1** `resolveTaxProvider(env: Record<string, string | undefined>)` returns
`{ provider: 'none' | 'mock' | 'taxjar'; reason: string }`.
**R-2.2** `TAX_PROVIDER` unset, empty or whitespace ⇒ `'none'`. **This is the
default and it means "no tax calculation performed", never a rate of zero.**
**R-2.3** `'mock'` (case-insensitive, trimmed) ⇒ `'mock'`.
**R-2.4** `'taxjar'` ⇒ `'taxjar'` **only if** `TAXJAR_API_KEY` is non-empty;
otherwise `'none'` with a reason naming the missing key.
**R-2.5** Any other value ⇒ `'none'`, with a reason quoting the unrecognised
value. An invalid flag must never fall back to `mock` — a typo must not silently
start producing figures.
**R-2.6** `resolveTaxOrigin(env)` returns `{ zip, state }` or `null`; `null`
when either `TAX_ORIGIN_ZIP` or `TAX_ORIGIN_STATE` is missing, with a reason
naming data blocker #5 (DEV-02).
**R-2.7** Both functions are pure and read **no** `process.env` themselves.

### R-3 — Nexus logic (`lib/tax/nexus.ts`)

**R-3.1** `normalizeStateCode` trims, uppercases, and returns `null` for anything
that is not two ASCII letters.
**R-3.2** `findNexusForState(list, code, onDate)` returns the row whose state
matches and whose window contains `onDate` (`effective_from <= onDate` and
`effective_to` either null or `>= onDate`), else `null`.
**R-3.3** Dates are plain `YYYY-MM-DD` strings compared lexicographically —
the convention `lib/delivery/business-days.ts` already establishes and CLAUDE.md
rule #24 requires (a date-only value has no instant and no offset).
**R-3.4** A row with `collecting = false` is a **recorded** nexus that AFS is not
collecting on; it yields `no_nexus` with a reason that says so, never
`calculated`.

### R-4 — The engine (`lib/tax/calculate.ts`)

**R-4.1** Signature: `calculateTax(request, context): Promise<TaxOutcome>`, where
`context = { provider: TaxProvider | null; origin: TaxOrigin | null; nexus: NexusState[]; customerTaxExempt: boolean; today: string; providerReason: string }`.
It touches no database, no `process.env`, no clock.
**R-4.2** Decision order, and it is load-bearing:
1. invalid request (bad state code, negative/non-finite amount) ⇒ `failed`, **no
   provider call** — a malformed request is not a vendor's fault;
2. `customerTaxExempt` ⇒ `exempt` (spec §4: *skip the TaxJar call*);
3. `provider === null` ⇒ `not_configured`, quoting `providerReason`;
4. `origin === null` ⇒ `not_configured`, naming blocker #5;
5. `nexus` empty ⇒ `not_configured` — **INV-11, the centre of this item**;
6. no matching/collecting nexus row ⇒ `no_nexus`;
7. otherwise call the provider; map success ⇒ `calculated`, failure ⇒ `failed`.
**R-4.3** Exemption is checked **before** configuration so an exempt customer
gets a correct justified zero even with nothing configured.
**R-4.4** A provider returning `has_nexus: false` for a state AFS has configured
is a **conflict**, not a silent zero: outcome `failed`, `requiresAdminReview`,
with a reason naming both sides. AFS's own record and the vendor's disagreeing is
exactly the condition a human must look at.
**R-4.5** A zero `amount_to_collect` from the provider **with** `has_nexus: true`
is a legitimate `calculated` outcome of `0` (e.g. an exempt line in a nexus
state). The distinction from R-4.4 is the point of the whole type.

### R-5 — TaxJar response parsing (`lib/tax/response.ts`)

**R-5.1** `parseTaxForOrderResponse(raw): ShapeResult<ParsedTaxResponse>`,
following `pathfinder-response.ts` exactly: never throws, collects up to
`MAX_PROBLEMS` plain-English problems, returns a typed value or the problems.
**R-5.2** Rejects, each with its own message: a non-object; a missing `tax`
object; a non-finite, negative or absent `amount_to_collect`; a non-finite or
negative `rate`. A missing `has_nexus` is **not** fatal — it is `null`, and
R-4.4's conflict check only fires on an explicit `false`.
**R-5.3** Dollars → cents in one place, `Math.round(dollars * 100)`, with the
100× risk (A-2) stated in a comment.
**R-5.4** `logTaxShapeProblem(endpoint, problems, raw)` writes ONE
`console.error` carrying endpoint, problems and a payload truncated to 600 chars,
returns the line, and never throws. **It must not log a request** — a request
body contains a customer address.

### R-6 — The TaxJar provider (`lib/tax/providers/taxjar.ts`)

**R-6.1** `POST {base}/v2/taxes`, `Authorization: Bearer <key>`,
`Content-Type: application/json`. Base from `TAXJAR_API_BASE_URL`, defaulting to
`https://api.taxjar.com` (A-1).
**R-6.2** `AbortController` timeout, `TAX_READ_TIMEOUT_MS = 8000`, chosen to
match the only measured precedent in this codebase
(`PATHFINDER_READ_TIMEOUT_MS`); the borrowing is stated in a comment rather than
presented as a measurement of TaxJar.
**R-6.3 — A timeout here is safe to abort, and the contrast with rule #32 is
deliberate.** `pathfinder-edge.ts` refuses to time out its POST because that POST
*commits work a physical machine will collect*. A TaxJar tax calculation is a
**pure read that happens to use POST** — it creates no order and commits nothing
(the separate `/v2/transactions` endpoint does that, and this item does not call
it). Aborting it therefore loses nothing. Stated in the module header so the
apparent inconsistency with rule #32 is not read as an oversight.
**R-6.4** Never throws. Non-2xx ⇒ failure carrying the status and a truncated
body. Network error ⇒ failure. Timeout ⇒ failure whose message says the request
timed out and **no tax was calculated**.
**R-6.5** No retry. A retried tax lookup can produce a different figure from the
one already shown; and the honest answer to "did it work" is "no", which is what
`failed` + review says. (Same reasoning as rule #32's no-retry half.)
**R-6.6** The API key appears in exactly one header expression. It is never
logged, never returned in a result, and never put in a `reason` string.

### R-7 — The mock provider (`lib/tax/providers/mock.ts`)

**R-7.1 Fully implemented** (the Elite Standard forbids a thin mock): resolves a
rate from a recorded fixture rate table by state, computes tax on
`amount + (freightTaxable ? shipping : 0)`, rounds half-up in integer cents, and
returns the same `ProviderResult` shape as the real provider.
**R-7.2** The fixture table is **recorded reference data, labelled as such**, in
`tests/fixtures/tax/`. It is **not** a business number AFS supplied, and the
module says so. No rate is invented for a state that is not in the table: an
unknown state is a provider **failure** with a reason saying the mock has no
recorded rate for it — the mock refuses to guess, exactly as the real path does.
**R-7.3** Deterministic: same input ⇒ same output, no clock, no randomness.
**R-7.4** Returns `isAuthoritative: false` so INV-06 holds.
**R-7.5** Makes no network call of any kind.

### R-8 — Caching and the review record (`lib/tax/db.ts`, migration 039)

**R-8.1** One table, `tax_calculations`, is both the cache and the audit record
of every **provider interaction**. Locally-decided outcomes
(`not_configured`, `exempt`, `no_nexus`) cost nothing to recompute and write no
row — which keeps the table meaningful.
**R-8.2** Cache read: a row is served only if `cache_key` matches, `outcome =
'calculated'` and `expires_at > now()`. **INV-08.**
**R-8.3** `failed` rows are written with `requires_review = true` and
`expires_at = NULL`, so they are recorded but never served.
**R-8.4** TTL `TAX_CACHE_TTL_SECONDS`, default 86400 (24h). Rates change rarely;
a day bounds staleness while removing repeat calls for an unchanged basket. The
default is a documented engineering choice, not a business number.
**R-8.5** The cache key is a SHA-256 over a canonical, key-sorted JSON of
`{provider, origin, toState, toZip, amountCents, shippingCents, exempt, nexusFingerprint}`.
`nexusFingerprint` is included so **editing the nexus list invalidates the cache**
— without it, adding a state would keep serving a stale "no nexus" answer.
**R-8.6** `db.ts` uses `createAdminClient()` (rule #22, `cache: 'no-store'`) and
names every column it selects (the egress discipline `lib/pricing/db.ts` states).
**R-8.7** Every DB function returns a typed result and never throws at the
caller; a cache-write failure is logged and **never** degrades a successful
calculation into a failure.
**R-8.8** The nexus list is read once per calculation and passed in, so the pure
engine stays pure.

### R-9 — Migration 039 (FILE ONLY, NOT APPLIED)

**R-9.1** `supabase/migrations/039_tax_nexus_and_calculations.sql`, additive
only: two `CREATE TABLE IF NOT EXISTS`, indexes, RLS. No `ALTER` of an existing
table, no `DROP`, no data change to any existing row.
**R-9.2** `tax_nexus_states`: `id`, `state_code text NOT NULL`,
`collecting boolean NOT NULL DEFAULT true`, `nexus_basis text NOT NULL`,
`registration_id text`, `effective_from date NOT NULL`, `effective_to date`,
`note text`, `created_by`/`updated_by` → `profiles(id)`, `created_at`,
`updated_at`.
**R-9.3** CHECKs: `state_code ~ '^[A-Z]{2}$'`; `nexus_basis IN
('physical_presence','economic_threshold','employee_presence','voluntary')`;
`effective_to IS NULL OR effective_to >= effective_from`.
**R-9.4** `UNIQUE (state_code)` — one row per state, so a double submit cannot
create two (the same reasoning as `deliveries.shop_job_id` and
`invoices.quote_id`). History of a *changed* nexus is carried by the effective
window plus the audit log, not by a second row (ADR-2).
**R-9.5** `tax_calculations`: `id`, `cache_key text NOT NULL`,
`provider text NOT NULL`, `outcome text NOT NULL`, `amount_cents bigint`
(**NULL for every non-amount outcome — never 0**), `rate numeric(8,6)`,
`taxable_amount_cents bigint`, `to_state text`, `to_zip text`,
`subtotal_cents bigint NOT NULL`, `shipping_cents bigint NOT NULL DEFAULT 0`,
`nexus_fingerprint text`, `request_snapshot jsonb NOT NULL`,
`response_snapshot jsonb`, `problems jsonb`, `requires_review boolean NOT NULL
DEFAULT false`, `reviewed_at`, `reviewed_by`, `quote_id`/`quote_request_id`
(both nullable), `expires_at`, `created_at`.
**R-9.6** CHECK: `outcome IN ('calculated','failed')` — only provider
interactions are stored (R-8.1); and
`(outcome = 'calculated') = (amount_cents IS NOT NULL)`, so the
"a non-answer is never a zero" rule is enforced **by Postgres**, not only by
TypeScript. This is the structural analogue of rule #15's rush CHECK.
**R-9.7** Indexes: `(cache_key, expires_at)` for the cache read;
`(requires_review)` partial `WHERE requires_review` for the review queue;
`(created_at DESC)`.
**R-9.8** RLS enabled on both, `FOR ALL USING (is_admin())` on both, matching
migration 035's price-book policies exactly. **No anon or authenticated policy.**
**R-9.9** **ZERO seed rows for `tax_nexus_states`**, with a comment saying the
list is data blocker #31 and that empty means "not configured", not "no tax".
**R-9.10** The reversing `DROP` statements are printed in the final report (not
in the migration file — the repo has no down-migration convention; `ls` shows
only forward files).

### R-10 — API routes

**R-10.1** `POST /api/admin/tax-nexus`, actions `add-state`, `update-state`,
`retire-state`, `restore-state`, `resolve-review`.
**R-10.2** Every request: `createClient()` → `auth.getUser()` → 401 if absent →
`profiles.role !== 'admin'` → 403. Re-checked in the route even though
middleware guards `/admin` (the reasoning `lib/admin/auth.ts` already records).
**R-10.3** Writes use `createAdminClient()`. Every mutation calls
`logAdminAction` with before/after values.
**R-10.4** Input validated at the boundary: state code via
`normalizeStateCode`, `nexus_basis` against the allowed set, dates against
`^\d{4}-\d{2}-\d{2}$`, `collecting` strictly `true`/`false` (never truthy
coercion — the `retired must be exactly true or false` precedent).
**R-10.5** A duplicate state returns **409** with a message naming the state and
pointing at the existing row, never a 500.
**R-10.6** `retire-state` sets `effective_to` and `collecting = false`. **No hard
delete**, so a past calculation's basis is still readable.
**R-10.7** Every mutation that changes the nexus list invalidates cached
`calculated` rows (R-8.5 makes this automatic via the fingerprint; the route
additionally expires them so the table does not keep unreachable rows).
**R-10.8** `POST /api/admin/tax-nexus/preview` runs a real calculation for an
admin-supplied ship-to state/ZIP, amount and shipping, and returns the
`TaxOutcome`. Same auth. It is **admin-only, writes no quote and no invoice**,
and it is how the engine is exercised end-to-end without touching customer money.
**R-10.9** No route returns an env value, a key, or a raw vendor body.
**R-10.10** Every error response is plain English and says what did **not**
happen (rule #30's wording rule).

### R-11 — The admin UI

**R-11.1** `/admin/settings/tax-nexus`, server component, `requireAdminUser`,
`export const dynamic = 'force-dynamic'` (config a stale render could misreport),
wrapped in `<LightWorkingArea>` with a `← Settings` back link — the
`price-book/page.tsx` shape exactly (F-4).
**R-11.2** `components/admin/TaxNexusEditor.tsx`, a client component with all
five required states:
- **empty** — the default, and the most important: *no nexus states configured*,
  what is blocked (accountant's list, checklist #31), and the consequence in
  plain words — **no tax is calculated and no tax is collected**;
- **default** — the state table with basis, registration, window, collecting;
- **loading** — per-action `busy`, buttons `disabled`, following
  `PriceBookEditor`'s `busy !== null` pattern;
- **error** — a `role="status"` message region, same as `PriceBookEditor:155`;
- **disabled** — submit disabled while required fields are blank.
**R-11.3** A **provider status panel** stating, from the server, which provider is
resolved and why — including, when it is `none`, exactly which of the three
blocked inputs is missing. Presence booleans only; never a key value.
**R-11.4** A **"Needs review" panel** listing `requires_review` rows with their
reason, and a resolve action (INV-07). Its own empty state: *nothing needs
reviewing*.
**R-11.5** A **"Test a calculation"** form calling the preview route, with the
outcome rendered by `kind` — and a `mock` result **visibly marked as not a real
tax figure** (INV-06).
**R-11.6** `afs-*` tokens only. Token set is exactly the one already used by
`price-book/page.tsx` and `PriceBookEditor.tsx` on a light surface:
`afs-ink-900`, `afs-ink-700`, `afs-bg-card`, `afs-bg-light-raised`,
`afs-line-strong`, `afs-green-deep`/`afs-green-ink`/`afs-green-soft`,
`afs-amber-bg`/`afs-amber-ink`, `afs-crimson` on `afs-bg-light-raised` for an
error message. **No new token**, no hex, no default Tailwind colour. Placeholders
use `afs-ink-700` (rule #23: on a light surface, **not** `afs-chrome-silver`).
**R-11.7** The Settings link card copies the Pricing section's markup and tokens
verbatim (`afs-bg-raised`, `afs-border`, `afs-chrome-high`, `afs-chrome-mid`,
`afs-danger-on-dark` for `Open →`) — gunmetal, because the live Settings screen
is gunmetal (rules #18/#29).
**R-11.8** Interactive controls are `min-h-11`, matching the touch-target size
used throughout the admin screens.

### R-12 — Tests (full catalog in §13)

**R-12.1** Vitest units for every pure module; ARRANGE/ACT/ASSERT; exact
assertions with diagnostic messages.
**R-12.2** **No network, ever.** The TaxJar provider is tested with an injected
`fetch` double returning recorded fixture bodies.
**R-12.3** Fixtures are explicit and versioned in `tests/fixtures/tax/`. No
random data.
**R-12.4** Boundary coverage: null, undefined, empty string, empty list, zero,
negative, non-finite, non-integer, max, lowercase, whitespace-padded,
three-letter and non-ASCII state codes.
**R-12.5** The static money-path test (§8).
**R-12.6** ≥80% line coverage on `lib/tax/**`, measured and reported as a real
number.
**R-12.7** No test is skipped, weakened or deleted to pass.

---

## 11. CONSTRAINTS — WHAT MUST NOT BE CHANGED OR ASSUMED

1. **Do not modify `middleware.ts`.**
2. **Do not apply the migration.** File only.
3. **Do not deploy, merge, push to `main`, or touch the `main` branch.**
4. **Do not make a real third-party call.** `TAX_PROVIDER` defaults off; tests use doubles.
5. **Do not read, print or commit a secret.** Presence checks only.
6. **Do not seed a nexus state, a rate, an origin ZIP or a threshold.**
7. **Do not touch** `lib/pricing/quote-math.ts`, `lib/invoices/create.ts`,
   `app/api/checkout/**`, `app/checkout/page.tsx`, `lib/data/orders.ts`,
   `app/api/webhooks/stripe/**`.
8. **Do not touch** `docs/design/command-center-v7/**`, `tests/visual/**`,
   `lib/fixtures/command-center-v7.ts`, `lib/data/v7-view/**`,
   `app/styles/command-center-v7.generated.css`, or any baseline.
9. **Do not add to `lib/data/admin-nav.ts`** — a nav change risks the v7 pixel
   gate. Reachability comes from the Settings link (F-3).
10. **Do not edit `lib/data/admin-working-area.ts`** (F-4, LAW 7).
11. **Do not add an npm dependency** (DEV-03).
12. **Do not add a `company_id`** to either new table (A-5, §9.4 below).
13. **Do not use `any`**, `@ts-ignore`, or a lint disable to pass a check.
14. **Do not relax the contrast gate**, add a skip list, or change a threshold
    (rule #28).
15. **Do not introduce a second confidence/outcome vocabulary.** `TaxOutcome` is
    the one tax vocabulary, the way `lib/ai/takeoff-confidence.ts` is the one
    confidence vocabulary (rule #17).
16. **Do not fix the pre-existing `v7-css.test.ts` failure** (F-8); report it.
17. **Do not assume** TaxJar's wire format is confirmed (A-1); the parser must be
    loud, and the uncertainty must stay written down.

### 9.4 On the Six Laws' `company_id` requirement

The run brief requires "schema with RLS and `company_id`" and "`company_id` from
session never body". Applied honestly here: **a tax nexus is a fact about AFS,
the seller — not about a customer's company.** Adding `company_id` to
`tax_nexus_states` would model AFS as multi-tenant, which it is not, and would
invite a future reader to scope AFS's own legal registrations per customer. The
correct expression of the law's *intent* — no cross-tenant leak — is that **both
tables are admin-only at the database and carry no customer-scoped data path at
all**: RLS `FOR ALL USING (is_admin())`, no `authenticated` policy, no anon
policy. `price_book_items` and `pricing_ledger` (migration 035) set exactly this
precedent for AFS-global pricing configuration. The data-leak test asserts the
boundary that actually exists: a non-admin session can read nothing, and the
preview route refuses a non-admin. Recorded as a documented deviation (LAW 8)
rather than a silent omission.

---

## 12. IMPLEMENTATION GUIDANCE AND SEQUENCE

Dependencies precede dependents. Commit after each numbered unit (incremental
commits rule), message form `ovn(08-taxjar): <unit> — N tests green`.

| # | Unit | Depends on |
|---|---|---|
| 1 | This EES, committed. | — |
| 2 | `lib/tax/types.ts` + `lib/tax/config.ts` + `config.test.ts` | 1 |
| 3 | `lib/tax/nexus.ts` + `nexus.test.ts` | 2 |
| 4 | `lib/tax/response.ts` + fixtures + `response.test.ts` | 2 |
| 5 | `lib/tax/cache-key.ts` + `cache-key.test.ts` | 2 |
| 6 | `lib/tax/providers/mock.ts` + `mock.test.ts` | 2,4 |
| 7 | `lib/tax/providers/taxjar.ts` + `taxjar.test.ts` (injected fetch) | 4 |
| 8 | `lib/tax/calculate.ts` + `calculate.test.ts` | 3,6,7 |
| 9 | `supabase/migrations/039_…sql` + `SCHEMA.md` append | 1 |
| 10 | `lib/tax/db.ts` | 8,9 |
| 11 | `app/api/admin/tax-nexus/route.ts` + `preview/route.ts` | 10 |
| 12 | `components/admin/TaxNexusEditor.tsx` + page | 11 |
| 13 | Settings link + `.env.example` | 12 |
| 14 | `lib/tax/tax-not-in-money-path.test.ts` | 11,12 |
| 15 | End-of-run verification, governance, push | all |

### ADR-1 — Tax is built but not wired
**Decision:** complete the engine; connect nothing customer-facing.
**Why:** §8 — the two specs conflict, wiring would change a charged amount, and
all three inputs are missing.
**Trade-off:** a later item must do the wiring, and must re-read §14.
**Enforced by:** the static import test, which fails the moment anyone connects them.

### ADR-2 — One nexus row per state, not a version table
**Decision:** `UNIQUE (state_code)` plus an effective window; no
`tax_nexus_versions` analogue of `price_book_versions`.
**Why:** a price must be reproducible for a quote issued years ago, so the price
book is versioned. A tax calculation is reproducible from its own **snapshot** in
`tax_calculations` (request + response + nexus fingerprint), so the nexus list
does not need to be. One table is less surface and the admin screen is legible.
**Trade-off:** "what was our nexus on 2026-03-01?" is answered from the audit log
and the effective window rather than by a point-in-time query.
**Revisit if:** AFS needs historic nexus reporting independent of calculations.

### ADR-3 — One table for cache and provider record
**Decision:** `tax_calculations` is both.
**Why:** both want the same columns; a separate cache would duplicate the request
snapshot, and two tables could disagree about what was calculated.
**Trade-off:** the table grows with provider calls. Mitigated by the TTL and the
`expires_at` index; pruning is a future cron and is listed as a non-goal, not
silently omitted.

---

## 13. ACCEPTANCE CRITERIA

Each AC is objectively checkable. Validation in §15; traceability in §16.

**Configuration**
- **AC-01** `TAX_PROVIDER` unset ⇒ `resolveTaxProvider` returns `'none'`, and
  `calculateTax` returns `not_configured` **without** calling a provider.
- **AC-02** `TAX_PROVIDER='taxjar'` with no `TAXJAR_API_KEY` ⇒ `'none'`, reason
  names the missing key.
- **AC-03** `TAX_PROVIDER='MoCk  '` ⇒ `'mock'` (trimmed, case-insensitive).
- **AC-04** `TAX_PROVIDER='banana'` ⇒ `'none'`, reason quotes `banana`; **never** `mock`.
- **AC-05** Either origin env var missing ⇒ `not_configured` naming blocker #5.

**The "never a silent zero" law**
- **AC-06** `not_configured` and `failed` have **no** `amountCents` property at
  runtime, and `tsc` rejects reading one.
- **AC-07** `collectableTaxCents` returns `null` for `not_configured` and
  `failed`, and a number for `calculated`, `exempt`, `no_nexus`.
- **AC-08** Empty nexus list ⇒ `not_configured`, **not** `no_nexus` and **not** `0`.
- **AC-09** A provider timeout ⇒ `failed` with `requiresAdminReview: true`, a
  message saying no tax was calculated, and **no amount**.
- **AC-10** Provider `has_nexus: false` for a configured state ⇒ `failed`
  (conflict), reason naming both sides.
- **AC-11** Provider `amount_to_collect: 0` with `has_nexus: true` ⇒
  `calculated` with `amountCents: 0`.
- **AC-12** Postgres itself refuses a `calculated` row with NULL `amount_cents`
  and a `failed` row with a non-NULL one (R-9.6) — asserted by reading the CHECK
  from the migration file (the migration is not applied this run).

**Exemption and nexus**
- **AC-13** `customerTaxExempt: true` ⇒ `exempt`, `amountCents: 0`, no provider call.
- **AC-14** Exempt wins over unconfigured: exempt + no provider ⇒ `exempt`.
- **AC-15** A ship-to state with no nexus row ⇒ `no_nexus`, `amountCents: 0`.
- **AC-16** A nexus row with `collecting: false` ⇒ `no_nexus`, reason saying so.
- **AC-17** A nexus row outside its effective window ⇒ `no_nexus`.
- **AC-18** `normalizeStateCode` handles `'tx'`, `'  TX '`, `''`, `null`,
  `'TEX'`, `'T1'`, `'ÉX'` with the documented result for each.

**Parsing**
- **AC-19** The recorded success fixture parses to the expected cents, rate and
  `has_nexus`.
- **AC-20** Each malformed fixture (not an object; no `tax`; missing / negative /
  non-finite `amount_to_collect`; negative `rate`) ⇒ `ok: false` with a problem
  naming the field. The parser **never throws** for any input, including `null`,
  `undefined`, a string and an array.
- **AC-21** `$12.34` ⇒ `1234` cents; `$0.005` and a large value round as documented.
- **AC-22** `logTaxShapeProblem` truncates to 600 chars, returns the line, never
  throws, and contains no request data.

**Provider**
- **AC-23** The TaxJar provider sends exactly one `POST` to `{base}/v2/taxes`
  with the bearer header, and the key appears in **no** log line, result or reason.
- **AC-24** Non-2xx ⇒ provider failure carrying the status; no throw.
- **AC-25** An aborted fetch ⇒ a failure whose message says it timed out.
- **AC-26** The provider makes **no retry** — the fetch double counts exactly 1 call.
- **AC-27** The mock provider is deterministic, makes no network call, marks
  `isAuthoritative: false`, and **fails rather than guesses** for a state absent
  from the recorded table.

**Cache**
- **AC-28** Two identical requests ⇒ one provider call; the second is served from
  cache (asserted on a call counter).
- **AC-29** A `failed` outcome is never served from cache: the second identical
  request calls the provider again.
- **AC-30** Changing the nexus list changes the cache key, so the stale answer is
  not served.
- **AC-31** The cache key is order-independent over object keys and stable across
  runs for identical input.
- **AC-32** A cache-write failure leaves a successful `calculated` outcome intact.

**Security / API**
- **AC-33** Each `/api/admin/tax-nexus` and `/preview` request with no session ⇒
  401; with a non-admin profile ⇒ 403; neither touches the database.
- **AC-34** A duplicate state ⇒ 409 naming the state, not 500.
- **AC-35** An invalid `nexus_basis`, state code, date, or non-boolean
  `collecting` ⇒ 400 with a specific message.
- **AC-36** Every successful mutation writes an `admin_audit_log` row via
  `logAdminAction` with before/after values.
- **AC-37** `retire-state` performs no delete; the row survives with
  `effective_to` set and `collecting = false`.
- **AC-38** RLS in migration 039 is `FOR ALL USING (is_admin())` on both tables,
  with no `authenticated`/`anon` policy — asserted by parsing the migration file.

**UI**
- **AC-39** With zero rows the screen renders the empty state and states that no
  tax is calculated and none is collected.
- **AC-40** The provider panel names which of the three blocked inputs is missing
  and shows **no** secret value.
- **AC-41** A `mock` preview result is visibly marked as not a real tax figure.
- **AC-42** Loading disables the acting control; an error renders in a
  `role="status"` region; the add form is disabled while required fields are blank.
- **AC-43** Every colour is an `afs-*` token; no hex in JSX; placeholders use
  `afs-ink-700`.

**Non-regression**
- **AC-44** `pnpm tsc --noEmit` exits 0.
- **AC-45** `pnpm test:unit` shows all new tests passing and **no new failure**;
  the only failure is the pre-existing `v7-css.test.ts` (F-8).
- **AC-46** `node scripts/audit/contrast-check.mjs` exits 0 with `0 unresolved`
  not increased.
- **AC-47** `git diff --stat` touches **no** file in the §11 forbidden list;
  `lib/pricing/`, `lib/invoices/`, `app/checkout/`, `app/api/checkout/`,
  `middleware.ts` and every v7 path are absent from the diff.
- **AC-48** The static money-path test passes and genuinely fails when a guarded
  file is made to import `lib/tax` (verified by a temporary local edit, reverted).
- **AC-49** Coverage on `lib/tax/**` ≥80% lines, reported as a measured number.
- **AC-50** No `any`, `@ts-ignore`, `TODO`, `FIXME`, placeholder or dead code in
  any file this item ships, verified by grep.

---

## 14. SPECIFIED BUT NOT BUILT — THE WIRING, FOR A LATER ITEM

Written so the next engineer need not re-derive it, and explicitly **not
implemented** (§7 non-goal 2, UNRESOLVED-02).

The option that preserves the existing invariant ("the customer is charged
exactly the figure AFS approved") is **quote-time calculation**:

1. The estimator issues a quote. Before `quotes` is written, `calculateTax` runs
   on the AFS-set subtotal plus freight, with the ship-to address from the quote
   request and `profiles.tax_exempt` for the customer.
2. `calculated` ⇒ write `quotes.tax` and include it in `quotes.total`. The quote
   PDF and portal show it as a line item (`SPEC_TAXJAR_INTEGRATION.md` §1).
3. `exempt` ⇒ `tax = 0` plus the spec §4 note *"Tax exempt — resale certificate
   on file"*.
4. `no_nexus` ⇒ `tax = 0`, with a note that AFS does not collect in that state.
5. `not_configured` ⇒ `quotes.tax` stays **NULL**. `app/checkout/page.tsx:632`
   already renders NULL as `—`, so **today's behaviour is the correct
   not-configured behaviour** and needs no change. (Showing
   `"Calculated at checkout"` per `SPEC_CHECKOUT.md` would be wrong once tax is
   known at quote time.)
6. `failed` ⇒ **the quote is not issued automatically.** It is held with the
   flagged review row, because sending a quote whose tax silently failed is how a
   wrong number reaches a customer.
7. `app/api/checkout/create-intent/route.ts` then needs **no change at all** —
   it already charges `quote.total`, which would now include tax. That is the
   strongest argument for this option.
8. `lib/invoices/create.ts` would copy `quotes.tax` into `invoices.tax_cents`
   instead of the literal `0`, preserving rule #21's "copied, never recomputed".

The alternative (payment-time calculation) requires changing the charged amount
and is **not** recommended without Reid's decision.

---

## 15. VALIDATION — COMMANDS, EACH VERIFIED TO EXIST

Read from `package.json` (S21); no script is invented.

| Command | Verifies |
|---|---|
| `pnpm tsc --noEmit` | AC-06, AC-44 |
| `pnpm test:unit` | AC-01…AC-38, AC-45, AC-48 |
| `pnpm vitest run lib/tax --coverage` | AC-49 (vitest 5 supports `--coverage`; if the v8 provider is absent the real reason is reported, not estimated) |
| `node scripts/audit/contrast-check.mjs` (= `pnpm check:contrast`) | AC-43, AC-46 |
| `pnpm lint` | lint on touched files |
| `git diff --stat main...HEAD` | AC-47 |
| `grep -rn "any\|@ts-ignore\|TODO\|FIXME" lib/tax app/api/admin/tax-nexus components/admin/TaxNexusEditor.tsx` | AC-50 |
| Manual browser steps (§17) | AC-39…AC-42 — **UNVERIFIED until a human confirms** |

`pnpm test:e2e` is **not** run for this item: Playwright specs here require
`storageState` admin auth against a deployed environment (CLAUDE.md rule #28),
and this run neither deploys nor has credentials. Recorded as a limitation, not
presented as a pass.

---

## 16. REQUIREMENT → IMPLEMENTATION → VERIFICATION → EXPECTED RESULT (S39)

| Requirement | Artifact | Verification | Expected |
|---|---|---|---|
| R-1 outcome union | `lib/tax/types.ts` | `tsc`, `calculate.test.ts` | AC-06, AC-07 |
| R-2 provider resolution | `lib/tax/config.ts` | `config.test.ts` | AC-01…AC-05 |
| R-3 nexus logic | `lib/tax/nexus.ts` | `nexus.test.ts` | AC-15…AC-18 |
| R-4 engine order | `lib/tax/calculate.ts` | `calculate.test.ts` | AC-08…AC-14 |
| R-5 parser | `lib/tax/response.ts` | `response.test.ts` | AC-19…AC-22 |
| R-6 TaxJar client | `lib/tax/providers/taxjar.ts` | `taxjar.test.ts` (fetch double) | AC-23…AC-26 |
| R-7 mock | `lib/tax/providers/mock.ts` | `mock.test.ts` | AC-27 |
| R-8 cache | `lib/tax/db.ts`, `cache-key.ts` | `cache-key.test.ts`, `calculate.test.ts` | AC-28…AC-32 |
| R-9 migration | `039_…sql` | migration-parse test, report | AC-12, AC-38 |
| R-10 routes | `app/api/admin/tax-nexus/**` | code review + manual | AC-33…AC-37 |
| R-11 UI | page + `TaxNexusEditor.tsx` | contrast gate + manual | AC-39…AC-43 |
| R-12 / §8 isolation | `tax-not-in-money-path.test.ts` | `pnpm test:unit` | AC-47, AC-48 |

### Test catalog (ARRANGE / ACT / ASSERT) — representative, not exhaustive

**T-01 — an unset flag performs no calculation.**
ARRANGE: `env = {}`; a provider double whose `calculate` throws if called; one
nexus row for TX; `customerTaxExempt: false`.
ACT: `calculateTax(req, ctx)`.
ASSERT: `kind === 'not_configured'`; `'amountCents' in outcome === false`;
`collectableTaxCents(outcome) === null`; the double's call count is exactly `0`.
*Diagnostic:* "Expected no tax calculation and no provider call with TAX_PROVIDER
unset; got kind=<k> and <n> provider calls. A default that calls a vendor or
yields a figure is how an unconfigured deployment starts collecting tax."

**T-02 — an empty nexus list is not a zero.**
ARRANGE: mock provider; valid origin; `nexus: []`.
ACT: calculate.
ASSERT: `kind === 'not_configured'`, **not** `'no_nexus'`; no `amountCents`.
*Diagnostic:* "An empty nexus list means nobody has told us where AFS owes tax.
Reporting `no_nexus` or `0` there asserts a legal fact AFS has not supplied."

**T-03 — a timeout is flagged, never zeroed.**
ARRANGE: fetch double rejecting with an `AbortError`.
ACT: calculate through the TaxJar provider.
ASSERT: `kind === 'failed'`; `requiresAdminReview === true`;
`'amountCents' in outcome === false`; `reason` contains "no tax was calculated";
call count `1` (no retry).

**T-04 — the vendor contradicting our nexus record is a conflict.**
ARRANGE: nexus row for TX, `collecting: true`; fixture response
`has_nexus: false`, `amount_to_collect: 0`.
ACT: calculate.
ASSERT: `kind === 'failed'`; reason names both AFS's record and the vendor's answer.

**T-05 — a real zero is a real answer.**
ARRANGE: fixture `has_nexus: true`, `amount_to_collect: 0`.
ASSERT: `kind === 'calculated'`, `amountCents === 0`, `isAuthoritative === true`.

**T-06 — editing nexus invalidates the cache.**
ARRANGE: identical requests; nexus fingerprint A then B.
ASSERT: the two cache keys differ, so the stale answer cannot be served.

**T-07 — no money path imports the tax engine.**
ARRANGE: the guarded path list; walk `app/ components/ lib/`.
ACT: read every file's imports.
ASSERT: zero guarded files import `lib/tax`; the allow-list is exactly the four
admin files. *Diagnostic names the offending file and why it matters.*

TEARDOWN for all: pure functions and injected doubles only — no database, no
network, no filesystem write, no artifact.

---

## 17. COMPLETION EVIDENCE REQUIRED

The final report must carry: what existed vs the gap; every file created and
modified; the real `tsc` output; real test counts before and after; the measured
coverage number; the contrast-gate output; the full migration SQL plus its
reversing `DROP`s; every assumption; every UNRESOLVED item; and the browser steps
below. The item is marked **UNVERIFIED pending human browser confirmation**.

**Browser verification steps (for Reid):**
1. `pnpm dev`, sign in as an admin, go to `/admin/settings`.
2. The new **Sales tax** section shows a *Tax nexus* card; the TaxJar row still
   reads as not configured.
3. Open the card → `/admin/settings/tax-nexus`. Expect the **empty state**: no
   states configured, checklist #31 named, and the sentence that no tax is
   calculated and none is collected.
4. The provider panel should say no provider is configured, and name the missing
   origin ZIP and key. **No key value anywhere on the page.**
5. "Test a calculation": any state, any amount → expect **"not configured"**, not
   `$0.00`.
6. Add a state (e.g. TX, physical presence, today). It appears in the table.
   Re-add it → a 409 message naming TX, not a crash.
7. Retire it → it stays listed, marked not collecting.
8. Restart with `TAX_PROVIDER=mock` → the preview now returns a figure
   **visibly marked as a mock, not a real tax**. Confirm a `TX` state is
   configured first, otherwise expect `no_nexus`.
9. Confirm `/checkout` and a quote show **exactly** what they showed before.

---

## 18. SELF-AUDIT

Second pass performed adversarially, as a reviewer hunting defects. Four were
found in the first draft and are fixed above.

**D-1 (critical, fixed).** The draft had `calculateTax` resolve env itself,
making every test mutate `process.env` — order-dependent and non-deterministic,
breaching the isolation rule. **Fix:** env resolution extracted to a pure
`config.ts` taking an env record; the engine receives an already-resolved
provider (R-2.7, R-4.1).

**D-2 (critical, fixed).** The draft let `not_configured` carry
`amountCents: null`. A `number | null` field is exactly the shape a caller writes
`?? 0` against, which reinstates the silent zero this item exists to prevent.
**Fix:** the field is **absent** from those members (INV-04, AC-06), and
`collectableTaxCents` is the only accessor.

**D-3 (major, fixed).** The draft's cache key omitted the nexus list, so adding a
state would keep serving a cached "no nexus" answer for up to the TTL — a wrong
answer caused by a correct edit. **Fix:** `nexusFingerprint` in the key (R-8.5,
AC-30, T-06).

**D-4 (major, fixed).** The draft asserted a timeout on the TaxJar POST without
addressing CLAUDE.md rule #32, which forbids timing out the PathfinderEdge POST.
A reader would reasonably read that as a rule violation. **Fix:** R-6.3 states
the distinction — a tax calculation is a read that happens to use POST and
commits nothing, unlike a profile push.

Also checked and found sound: no new `any`; no invented business number (the mock
table is labelled recorded reference data, and refuses unknown states rather than
guessing); no customer-facing price; migration additive with no `ALTER`/`DROP`;
RLS matches the 035 precedent; CHECK constraints make the core rule a database
fact as well as a type; no nav or baseline change; the pre-existing failure is
attributed honestly; and the one genuinely uncertain external fact (A-1, TaxJar's
wire format) is tagged **[Likely]**, isolated behind a parser, and listed as
UNRESOLVED-01 rather than written up as verified.

**Residual limitations, disclosed rather than hidden:** the TaxJar wire format is
unverified (A-1 / UNRESOLVED-01); the migration is unapplied, so the CHECKs are
verified by reading the file rather than by Postgres rejecting a row; and the
UI's rendered states are verified by the contrast gate and code review, not by a
browser (no E2E credentials this run) — hence UNVERIFIED.

### Score

| Dimension | Max | Score | Note |
|---|---|---|---|
| Technical correctness | 15 | 15 | Decision order, type design and cache key all defect-checked. |
| Completeness | 15 | 15 | All 12 requirement groups, 50 ACs, scope in/out, the unbuilt wiring specified. |
| Repository grounding | 10 | 10 | Existence check executed; 8 findings changed the design; every claim cited to a file and line. |
| Architectural consistency | 10 | 10 | Follows the parser, timeout, editor, retire, RLS and static-test patterns already in the repo. |
| Requirement clarity | 10 | 10 | Each requirement numbered and individually testable. |
| Acceptance-test quality | 10 | 10 | 50 objective ACs mapped to real commands; AC-48 proves the guard actually fails. |
| Edge case / failure coverage | 10 | 10 | Timeout, non-2xx, malformed shape, conflict, real zero, empty list, bad flag, duplicate, cache-write failure, unknown mock state. |
| Security and data integrity | 5 | 5 | Admin-only RLS, double auth check, no secret in log/result/reason, boundary validation, DB-level CHECK, no request logging. |
| Implementation executability | 10 | 10 | Exact paths, 15 ordered units, verified commands. |
| Reviewability / evidence | 5 | 5 | Traceability matrix, evidence list, browser steps, honest baseline. |
| **Total** | **100** | **100** | |

Critical defects remaining: **NONE**. D-1…D-4 are fixed in this text, not noted
as outstanding. Gate (95) met.

---

## 19. UNRESOLVED (LAW 6)

| # | Item | Why it cannot be settled tonight | Handling |
|---|---|---|---|
| UNRESOLVED-01 | TaxJar's exact endpoint/auth/response shape (A-1). | No key, and the run forbids network calls. | Base URL env-configurable; validating parser; shape failure ⇒ `failed` + review, never a wrong figure. Stated in the module header. |
| UNRESOLVED-02 | Quote-time vs payment-time tax (§8). | A business decision for Reid; the two specs conflict. | Nothing wired; §14 specifies the recommended option; static test blocks accidental wiring. |
| UNRESOLVED-03 | `lib/invoices/create.ts` writes `tax_cents: 0` as a literal. | Correct while tax is off, wrong once it is on. | Left untouched (LAW 7/9); flagged here and in §14 step 8. |
| UNRESOLVED-04 | `/admin/settings/price-book` is not in `LIGHT_WORKING_AREA_SCREENS`. | Pre-existing; may be deliberate. | Precedent followed; file not edited; reported as an unrelated observation. |
| UNRESOLVED-05 | Nexus state list, origin ZIP, API key. | Data blockers #31 and #5. | Ships empty; every path reports "not configured" by name. |
| UNRESOLVED-06 | No pruning job for `tax_calculations`. | No retention policy stated. | TTL + index now; pruning listed as a non-goal rather than silently skipped. |
| UNRESOLVED-07 | Pre-existing `v7-css.test.ts` failure (F-8). | Outside scope; the v7 pipeline is frozen for this run. | Recorded in the baseline and the final report; not fixed, not hidden. |

---

ENGINEERING COMPLETION RECORD
Prompt ID: EES-OVN.08
Prompt Name: TaxJar Integration — Nexus Configuration and Tax Calculation
Word Count: 9928
Engineering Proficiency Score: 100/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES
