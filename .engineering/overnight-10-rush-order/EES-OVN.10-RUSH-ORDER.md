# EES-OVN.10-RUSH-ORDER.md
## Engineering Execution Specification — Rush Order: the mechanism, not the numbers

---

## 1. IDENTITY

| Field | Value |
|---|---|
| Prompt ID | EES-OVN.10 |
| Prompt Name | Rush Order — rush request with a requested-by date, an admin-configurable rush policy shipped empty, and a formal quote that decides the surcharge |
| Item | `10-rush-order` |
| Branch | `ovn/10-rush-order` (worktree of `C:\Users\manag\Documents\afs-website`) |
| Source spec | `specs/SPEC_RUSH_ORDER.md` |
| Prior audit | `RUSH_ORDER_AUDIT.md` (2026-07-31 — pre-dates Command Center V2 and the v7 port; re-verified below rather than trusted) |
| Date | 2026-10-03 |

---

## 2. OBJECTIVE

Build the **mechanism** by which a rush order is requested, priced and
prioritised — and build **none of the numbers**, because the rush surcharge and
the minimum rush lead time are Steve's business decisions and have not been
supplied (CLAUDE.md DATA BLOCKERS; `SPEC_RUSH_ORDER.md`'s own header marks
checklist #32 and #36 BLOCKED).

Concretely, five things:

1. A customer can **request rush AND give a requested-by date** on the intake
   surface that has the rush toggle.
2. A new **`rush_policies` table** — admin-configurable, holding *surcharge
   type*, *surcharge value* and *minimum lead time* — delivered as an
   **additive migration FILE that is NOT applied**, and **shipped EMPTY**.
3. An **admin screen** to set and read that policy, with a **clear empty
   state** that distinguishes "no policy has been set" from "the table is not
   in the database yet".
4. The **formal quote decides the surcharge** — AFS-side, never customer-side,
   and never from an unfilled cell.
5. Rush jobs carry a **visible badge** in the admin queue lists that already
   exist, **without changing any Command Center v7 layout**.

---

## 3. ENGINEERING CONTEXT (only what bears on this work)

### 3.1 The governing rules this item sits inside

- **CLAUDE.md rule #15 — RUSH IS NEVER INFERRED.** Two writers only
  (`app/api/quote-requests/route.ts`'s customer checkbox,
  `app/api/admin/command-center/set-rush/route.ts`'s admin toggle), a Postgres
  CHECK (`quote_requests_rush_needs_explicit_source`, migration 034) and a
  static test (`lib/data/rush-explicit-only.test.ts`) that fails if any other
  file assigns `is_rush` or if a writer's assignment line gains an
  inference-shaped expression. **A requested-by date must therefore never,
  anywhere, cause `is_rush` to become true.**
- **CLAUDE.md rule #19 — THE PRICE BOOK IS VERSIONED AND NEVER OVERWRITTEN,
  AND A BLANK IS NEVER A ZERO.** `lib/pricing/` is the single home for the
  formula, the blank-handling and the version resolution; "do not put a second
  copy of ... the version resolution anywhere else."
- **CLAUDE.md rule #24 — `lib/delivery/business-days.ts` is the ONLY place that
  decides what a business day is.** A lead time measured in days is a business-day
  question, so it is answered there.
- **CLAUDE.md rule #28 — contrast is a build gate.** The gate discovers screens
  from `lib/data/admin-nav.ts` *plus* the `page.tsx` files that really exist
  under those routes — verified: `/admin/settings/price-book` is already in the
  gate's output as `Settings: /price-book`. A new `/admin/settings/rush-policy`
  therefore comes under the gate automatically.
- **CLAUDE.md rules #33 / #34 — the Command Center UI is a frozen port of v7,
  authority is the whole-screen pixel gate.** The item says: if a v7 screen
  would need to change, skip it and record the gap.
- **The RFQ model.** No customer-facing price before the formal quote. The
  rush surcharge is decided by AFS and appears only on the formal quote and the
  invoice that is copied from it.

### 3.2 What the pixel gate actually measures — and why that frees the live panels

`tests/visual/v7-pixel-gate.spec.ts` renders screens in **fixture mode**, which
`lib/fixtures/mode.ts` gates behind three locks including `?fixture=v7`. Every
admin page with a fixture branch returns its **`V7*` component early**:

```
app/admin/command-center/job/[id]/page.tsx   if (isFixtureMode(...)) return <V7Job .../>
app/admin/settings/page.tsx                  if (isFixtureMode(...)) return <V7Settings .../>
```

[Certain — read in both files.] The **live** `JobActionPanel` and the **live**
Settings body are therefore *never rendered during the pixel gate*. Changing
them cannot move a pixel-gate number. Changing anything under
`components/admin/v7/**`, `docs/design/command-center-v7/**`,
`app/styles/command-center-v7.generated.css` or `SCREEN_MANIFEST.json` **would**,
and this item changes none of them.

### 3.3 Baseline, measured before any edit

| Check | Command | Result |
|---|---|---|
| Working tree | `git status --short` | clean |
| Types | `pnpm tsc --noEmit` | **exit 0, zero errors** |
| Unit tests | `pnpm test:unit` | **484 passed, 1 failed (31 files, 1 failed)** |
| Contrast gate | `node scripts/audit/contrast-check.mjs` | **PASS — 24 screens, 248 pairs, 0 unresolved, 0 below** |

**The one failing test is PRE-EXISTING and is not touched by this item:**
`lib/design/v7-css.test.ts` — "`app/styles/command-center-v7.generated.css` is
stale. Run `pnpm css:v7`". It failed on a clean tree before any edit in this
run. Regenerating it is a v7 design-system action outside this item's scope and
the run's hard rules forbid touching v7 artifacts, so it is **reported, not
absorbed, and not fixed here**.

---

## 4. REQUIRED REPOSITORY INSPECTION — WHAT WAS ACTUALLY READ

Read in full (not skimmed): `CLAUDE.md`, `specs/SPEC_RUSH_ORDER.md`,
`RUSH_ORDER_AUDIT.md`, `lib/data/rush-explicit-only.test.ts`,
`app/api/admin/command-center/set-rush/route.ts`,
`app/api/quote-requests/route.ts` (rush + date block),
`lib/pricing/types.ts`, `lib/pricing/quote-math.ts`, `lib/pricing/price-book.ts`
(head), `lib/pricing/db.ts` (head + exports), `lib/quotes/issue.ts`,
`lib/quotes/email-template.ts`, `lib/invoices/create.ts`,
`app/api/admin/command-center/send-quote/route.ts`,
`app/api/admin/price-book/route.ts`, `app/admin/settings/page.tsx`,
`app/admin/settings/price-book/page.tsx`, `lib/delivery/business-days.ts`,
`lib/data/admin-working-area.ts`, `lib/data/workbench.test.ts` (light-area
block), `components/admin/JobActionPanel.tsx` (quote table + rush block),
`lib/data/job-screen.ts` (preview + columns), `playwright.config.ts`,
`vitest.config.mts`, `tests/e2e/helpers/db.ts`,
`supabase/migrations/034_command_center_v2_workbench.sql` (rush block),
`supabase/migrations/035_price_book_ledger_quotes_invoices.sql` (price-book
tables, append-only trigger, RLS), `app/api/quote-approve/[token]/route.ts`
(quote select), `app/quote/page.tsx` (step 3 + review), `app/studio/draft/page.tsx`
(submit body + afs-fl-026 comment).

### 4.1 CURRENT STATE — what already exists (verified, not assumed)

| Capability | State | Evidence |
|---|---|---|
| `quote_requests.is_rush` + `rush_source` + `rush_set_at` + `rush_set_by` | **EXISTS** | `001_initial_schema.sql`, `034_command_center_v2_workbench.sql` |
| Postgres CHECK refusing an unsourced rush | **EXISTS** | `034` `quote_requests_rush_needs_explicit_source` |
| Customer rush checkbox at intake | **EXISTS** | `app/quote/page.tsx:636-658` toggle → `isRush: form.rush` (line 285) |
| Admin rush toggle | **EXISTS** | `components/admin/JobActionPanel.tsx:474-500` → `POST /api/admin/command-center/set-rush` |
| Static test: rush is never inferred | **EXISTS** | `lib/data/rush-explicit-only.test.ts` |
| `quote_requests.requested_delivery` (DATE) | **EXISTS**, written by the intake route | `001:441`; `app/api/quote-requests/route.ts:188` |
| Requested-by date collected by FlashDraft | **EXISTS** | `app/studio/draft/page.tsx:4747-4755`, sent as `requestedDelivery` (line 3766) |
| Requested-by date collected by the **quote wizard** | **MISSING** | zero `requestedDelivery` occurrences in `app/quote/page.tsx` |
| Rush pinned to top of the shop queues | **EXISTS** | `lib/data/machine-jobs.ts`, `lib/data/orders.ts`, `lib/data/shop-queue.ts` |
| Rush badge in admin lists | **EXISTS, comprehensively** | `WorkbenchLanes.tsx:232`, `QuoteOrderList.tsx:214`, `ShopQueueBoard.tsx:272`, `ProductionQueueTable.tsx:110`, `DeliveriesWeek.tsx:313,387`, `dashboard/ProductionStatusTable.tsx:64`, `CommandCenterJobCard.tsx:112`, `PendingQuoteRequestCard.tsx:102`, `OrdersCrmTab.tsx:221` |
| `quotes.rush_surcharge` / `orders.rush_surcharge` columns | **EXIST** | `001:479`, `001:559` (`DECIMAL(10,2) NOT NULL DEFAULT 0`) |
| Anything that writes a non-zero rush surcharge | **MISSING** | `lib/quotes/issue.ts:195` hardcodes `rush_surcharge: 0` |
| Rush policy table (surcharge type / value / minimum lead time) | **MISSING** | no migration, no table, no module |
| Admin screen to configure a rush policy | **MISSING** | — |
| Minimum-lead-time evaluation against the requested-by date | **MISSING** | — |
| `pricing_rules.rush_surcharge_pct` | **EXISTS, and is a made-up number** | `001:281` `DECIMAL(5,4) NOT NULL DEFAULT 0.25` — a seeded 25%, read by nothing on the quote path |

**The prior audit's four "gaps" are all closed by work done since.** Its
recommendations #1-#3 (rush toggles on `/configure` and `/studio/draft`,
rush-to-top in the Command Center tabs, `isRush` on the dashboard `QueueItem`)
have been **superseded by explicit decisions, not left undone**:

- `/configure` **no longer exists** (the Configurator was eliminated —
  standing decision, `lib/data/quote-request-source-tool.ts` keeps only its
  historical token).
- FlashDraft's rush toggle **was removed deliberately by Reid**:
  `app/studio/draft/page.tsx:3755-3759` — *"afs-fl-026: the Rush Order toggle
  was removed from this page's sidebar (Reid: 'they have notes') — isRush is
  intentionally omitted here rather than hardcoded false."* **This item must not
  reintroduce it.**
- Rush-to-top is now governed by **CLAUDE.md rule #15**, which states the
  opposite of the audit's recommendation on purpose: rush pins to the top of the
  **shop queues only**; the Workbench, the office lists and Deliveries stay
  newest-first and rush changes nothing but the badge. Asserted in
  `lib/data/shop-queue.test.ts` and `lib/data/rush-explicit-only.test.ts`.

**Conclusion of the existence check: the FLAG is built and the BADGE is built.
The POLICY, its ADMIN UI, the LEAD-TIME RULE, the SURCHARGE ON THE FORMAL QUOTE
and the REQUESTED-BY DATE ON THE WIZARD are the gap.**

---

## 5. PRECONDITIONS AND ASSUMPTIONS

| # | Assumption | Basis | Risk if wrong |
|---|---|---|---|
| A1 | Migration 039 is the next free number | `ls supabase/migrations` ends at `038_profile_search_shortcuts.sql` | file collision; none, the number is checked at write time |
| A2 | The migration will **not** be applied in this run | run's hard rule | **`rush_policies` does not exist in the live database when this ships.** Every read of it must degrade to "no policy" and say so. This is designed for, not hoped for — see R-07. |
| A3 | `is_admin()` is the codebase's RLS admin helper | used by every policy in `035` | RLS would not compile; mitigated by copying `035`'s exact spelling |
| A4 | `afs_append_only()` exists and is column-agnostic | `035` lines 113-127, reads `to_jsonb(OLD) ->> 'test_tag'` | a `rush_policies` UPDATE would error 42703 instead of 42501; mitigated because the function is already column-agnostic for exactly this reason |
| A5 | A rush surcharge belongs in `quotes.total_cents`, not in `quotes.line_items` | `line_items` is typed `QuoteLine[]` and is copied verbatim onto the invoice and read by the email templates and the PDF; a surcharge has no material, no blank width, no strips-per-sheet and no price-book version id | fabricating those fields would put invented data on a customer's document |
| A6 | `quotes.rush_surcharge` (dollars) is the right existing home for the figure | it already exists, is already displayed when non-zero by `app/account/quotes/[id]/page.tsx:190`, `components/admin/OrdersCrmTab.tsx` and `lib/utils/invoice-pdf.ts:101` | none; using it needs no migration and lights up three existing displays |
| A7 | Minimum lead time is measured in **business** days | the shop does not fabricate at the weekend, and rule #24 already owns that definition | a lead time that silently counts Saturdays |
| A8 | The percent value is stored in **basis points** (integer) | money and rates in this codebase are integers to avoid float drift (`price_book_versions`' cents columns, `pricing_ledger`'s "money is CENTS in this table, everywhere") | a `DECIMAL` rate would reintroduce float comparison in tests |

**UNRESOLVED (recorded, not guessed):**

- **U1 — the surcharge percentage and the minimum lead time themselves.**
  BLOCKED on checklist #32 and #36. The table ships empty; nothing in this item
  writes a value.
- **U2 — whether `pricing_rules.rush_surcharge_pct`'s seeded `DEFAULT 0.25`
  should be removed.** It is a made-up 25% sitting in the database on every
  product row. Nothing on the quote path reads it. Removing a `DEFAULT` from a
  live table is a migration applied to production and is outside this item.
  **PENDING REID.**
- **U3 — whether a rush job whose requested-by date is inside the minimum lead
  time should be refused, or quoted with a warning.** This item implements
  **warn, never refuse**: AFS decides what it will accept, and a quote the
  estimator is looking at is the moment to decide it. Recorded for Reid.
- **U4 — holidays.** Not modelled, for exactly the reason
  `lib/delivery/business-days.ts` already records: no holiday calendar has been
  supplied.

---

## 6. SCOPE

### 6.1 CREATED

| Path | What |
|---|---|
| `supabase/migrations/039_rush_policy.sql` | **FILE ONLY, NOT APPLIED.** `rush_policies` + CHECKs + index + append-only trigger + admin-only RLS. No seed rows. |
| `lib/pricing/rush-policy.ts` | Pure: types, the in-force resolver (delegating to `price-book.ts`'s `versionInForce`), the surcharge evaluator, the lead-time evaluator, the labels. |
| `lib/pricing/rush-policy.test.ts` | Unit tests: surcharge boundaries, empty-policy, blank-value, percent rounding, version resolution by date, lead time. |
| `app/api/admin/rush-policy/route.ts` | `POST { action: 'set-policy' }` — admin-only, validated, audited, ledgered. |
| `app/admin/settings/rush-policy/page.tsx` | The admin screen. Light working area, same as its `price-book` sibling. |
| `components/admin/RushPolicyEditor.tsx` | The form + the history + **the empty state**. |
| `tests/e2e/rush-order.spec.ts` | Flag + date persistence, badge render, the admin empty state, no customer-facing price. |

### 6.2 MODIFIED

| Path | Change | Why |
|---|---|---|
| `lib/delivery/business-days.ts` | **+3 pure functions**: `calendarDaysBetween`, `businessDaysBetween`, `addBusinessDays`. No existing function touched. | rule #24 — a business day is decided in exactly one file |
| `lib/delivery/business-days.test.ts` | tests for the three new functions | |
| `lib/pricing/price-book.ts` | `versionInForce` widened from `PriceBookVersion` to a structural `{ effectiveFrom, createdAt }` **generic**. Body unchanged. | rule #19 — "do not put a second copy of the version resolution anywhere else". Widening keeps ONE copy. Return type becomes *narrower* for existing callers, so no call site changes. |
| `lib/pricing/db.ts` | `+getRushPolicyBook(supabase)` → `{ policies, unavailable }` | the only file in `lib/pricing` allowed to touch Supabase (its own header) |
| `lib/quotes/issue.ts` | `JobForQuote` gains `requested_delivery`; `+rushContextForJob()`; the `quotes` insert writes the real `rush_surcharge` and a total that includes it; the email gets the surcharge; the ledger payload records it | deliverable 4 |
| `lib/quotes/email-template.ts` | `QuoteEmailInput` / `InvoiceEmailInput` gain optional `surchargeCents` + `surchargeLabel`; a surcharge row renders before Total **only when > 0** | the total must add up from what is shown |
| `lib/invoices/create.ts` | `QuoteForInvoice` gains `rush_surcharge`; both invoice emails get the surcharge row | the invoice is a copy of the quote; it must read the same |
| `app/api/quote-approve/[token]/route.ts` | `+rush_surcharge` in the `quotes` select | feeds the line above |
| `app/api/admin/command-center/send-quote/route.ts` | `+requested_delivery` in the `quote_requests` select | feeds the lead-time check |
| `lib/data/job-screen.ts` | `JOB_COLUMNS` already has `requested_delivery`; `JobScreenData` gains `rushQuote`; populated only when the job is rush | the estimator sees the policy and the lead time where the decision is made |
| `components/admin/JobActionPanel.tsx` | the quote table gains a surcharge row and a surcharge-aware Total; the rush block gains the policy sentence and the lead-time sentence | not measured by the pixel gate (§3.2) |
| `app/admin/settings/page.tsx` | one link card to the new screen, in the existing **Pricing** section | discoverability; live branch only, not `V7Settings` |
| `app/quote/page.tsx` | `+neededBy` field: state, a date input beside the Rush toggle, a review row, `requestedDelivery` in the submit body, and the spec's placeholder promise | deliverables 1 + 3 |

### 6.3 LEFT UNTOUCHED — DELIBERATELY

`middleware.ts`; every file under `docs/design/command-center-v7/`;
`app/styles/command-center-v7.generated.css`; every `components/admin/v7/*`;
`SCREEN_MANIFEST.json`; `tests/visual/**`; `app/studio/draft/page.tsx` (the
removed rush toggle stays removed — afs-fl-026); `app/api/quote-requests/route.ts`
(already correct — it reads the checkbox and the date and infers nothing);
`app/api/admin/command-center/set-rush/route.ts`; `lib/data/rush-explicit-only.test.ts`;
`lib/data/machine-jobs.ts` / `lib/data/orders.ts` / `lib/data/shop-queue.ts`
(rush ordering is settled by rule #15); every list component that already
renders a rush badge; `pricing_rules` and its editor; `lib/pricing/quote-math.ts`
(the line formula is unchanged — a surcharge is not a line).

---

## 7. NON-GOALS

- **NG1** Supplying a surcharge percentage, a flat fee or a lead time. BLOCKED
  (U1). The table ships empty and the UI says so.
- **NG2** Applying the migration. File only.
- **NG3** Reintroducing a rush toggle to FlashDraft (afs-fl-026) or building a
  Configurator (eliminated).
- **NG4** Changing rush **ordering** anywhere. Rule #15 settled it.
- **NG5** Showing any customer a rush price before the formal quote.
- **NG6** Touching a Command Center v7 layout, the pixel gate, or any baseline.
- **NG7** Freight, tax, or a rush tab/filter on the production queue
  (`SPEC_RUSH_ORDER.md` §3's last line — the queue already pins rush to the top
  and badges every row; a filter is additive UI with no policy content and is
  recorded as a gap rather than bolted on).
- **NG8** The admin "🔴 RUSH Quote Request" notification email
  (`SPEC_RUSH_ORDER.md` §2). There is still **no admin notification email at
  all** on the intake route, rush or otherwise; building one is a notifications
  item, not a rush item, and would be the only outbound-mail change in a run
  forbidden from sending mail. Recorded as a gap.
- **NG9** `StatusAdvancer`'s rush banner (`SPEC_RUSH_ORDER.md` §3). The order
  detail page already badges rush in its header; this is cosmetic and sits on a
  pre-v7 screen. Recorded as a gap.

---

## 8. INVARIANTS — must still be true afterwards

| # | Invariant | How it is held |
|---|---|---|
| I-01 | `is_rush` is still written by exactly the five allowed files, and never inferred | nothing in this item assigns `is_rush` or `rush_source`; `lib/data/rush-explicit-only.test.ts` is the proof and must stay green |
| I-02 | A requested-by date never makes a job rush | the date is a separate, independent field; the static test's `requested_delivery` inference shape already guards the assignment line |
| I-03 | With an **empty** policy table, every total is **byte-identical to today's** | `evaluateRushSurcharge` returns `surchargeCents: 0` for `no-policy`, so `rush_surcharge` stays `0` and `total_cents` stays `subtotalCents` |
| I-04 | A blank is never a zero | a policy row whose value for its type is NULL yields `unpriced/blank-value`, never 0-as-a-price; the DB CHECK refuses that shape too |
| I-05 | An already-issued quote never changes | the quote snapshots `rush_surcharge`, `subtotal_cents` and `total_cents`; the invoice copies them and recomputes nothing |
| I-06 | The invoice total still equals the approved quote total | `createInvoiceFromQuote` is unchanged in that respect — it still copies `quote.total_cents` |
| I-07 | No customer sees a rush price before the formal quote | the wizard shows a date field and a prose promise; the only money is on the quote email, the invoice and the portal |
| I-08 | Pixel gate and style gate numbers are unmoved | no v7 file, no fixture component, no baseline touched; the live panels changed are not rendered in fixture mode (§3.2) |
| I-09 | Contrast gate still PASSes with `0 unresolved` | the new screen uses existing light-area tokens; the gate is re-run and its numbers recorded |
| I-10 | Quoting still works when `rush_policies` does not exist | `getRushPolicyBook` never throws; it returns `unavailable` in plain English |
| I-11 | `rush_policies` can never be silently rewritten | append-only trigger + no UPDATE/DELETE policy |

---

## 9. REQUIREMENTS

### R-01 — `rush_policies`, additive, empty, append-only, admin-only

`supabase/migrations/039_rush_policy.sql` creates exactly one table:

```
id                      uuid PK default gen_random_uuid()
name                    text NOT NULL                 -- what Steve calls it
surcharge_type          text NOT NULL                 -- percent | flat | per_piece | none
surcharge_percent_bp    integer                       -- basis points; 250 = 2.50%
surcharge_cents         bigint                        -- cents
minimum_lead_time_days  integer                       -- BUSINESS days; NULL = not set
effective_from          date NOT NULL
note                    text
created_by              uuid REFERENCES profiles(id)
created_at              timestamptz NOT NULL default now()
```

Constraints, each with its reason written in the file:

1. `rush_policies_surcharge_type_check` — `surcharge_type IN ('percent','flat','per_piece','none')`.
   There is no `'inferred'` and no `'auto'`, for the same reason
   `rush_source` has no third value.
2. `rush_policies_value_matches_type` — the value column that the type needs is
   `NOT NULL` and the other is `NULL`:
   - `none` → both NULL
   - `percent` → `surcharge_percent_bp NOT NULL` and `surcharge_cents NULL`
   - `flat` / `per_piece` → `surcharge_cents NOT NULL` and `surcharge_percent_bp NULL`
3. `rush_policies_percent_range` — `surcharge_percent_bp IS NULL OR (>= 0 AND <= 100000)`.
   The bound is a **typo guard**, not a business opinion: 100000 bp is 1000%, so
   `2500` typed where `25` was meant is accepted (25%) but `250000` is refused.
4. `rush_policies_cents_non_negative` — `surcharge_cents IS NULL OR >= 0`.
5. `rush_policies_lead_time_range` — `minimum_lead_time_days IS NULL OR (>= 0 AND <= 365)`.

**No `UNIQUE (effective_from)`** — deliberately unlike
`price_book_versions_item_effective_key`, and the file says why: a same-day
correction has to be possible, and it is what makes the `created_at` tiebreak in
`versionInForce` load-bearing rather than decorative.

**Append-only**, reusing `035`'s `afs_append_only()` trigger function
unchanged. `rush_policies` has no `test_tag` column, so the function's one
escape hatch cannot fire on it and every UPDATE and DELETE is refused — the
same treatment `price_book_versions` gets.

**RLS**: `ENABLE ROW LEVEL SECURITY` + `admin_all_rush_policies ... FOR ALL
USING (is_admin())`. **No customer policy of any kind** — a rush surcharge is a
price, and rule: a customer sees a price only on a formal quote or invoice.

**No `company_id`, and the file states why**: this is AFS back-office
configuration, exactly like `price_book_items`, which also has none. The Six
Laws' `company_id` requirement is about customer-scoped data; a company_id here
would imply per-contractor rush pricing, which nobody has asked for and which
would be a business decision, not a schema one.

**ZERO SEED ROWS.** `SELECT count(*) FROM rush_policies` is 0 after the
migration, by construction.

Idempotent throughout (`IF NOT EXISTS`, `pg_constraint` guards, `DROP POLICY IF
EXISTS` before `CREATE POLICY`), matching `035`.

### R-02 — the pure policy module, `lib/pricing/rush-policy.ts`

Exports:

- `type RushSurchargeType = 'percent' | 'flat' | 'per_piece' | 'none'`
- `RUSH_SURCHARGE_TYPES`, `RUSH_SURCHARGE_TYPE_LABELS`, `isRushSurchargeType`
- `MAX_RUSH_PERCENT_BP = 100_000`, `MAX_RUSH_LEAD_TIME_DAYS = 365` — the same
  bounds the CHECKs use, so the route and the database agree by construction.
- `interface RushPolicy` — camelCase mirror of the row.
- `rushPolicyInForce(policies, asOf): RushPolicy | null` — **delegates to
  `versionInForce`**, so there is exactly one copy of the resolution rule
  (rule #19). A policy dated tomorrow is not in force today.
- `evaluateRushSurcharge({ isRush, subtotalCents, pieceCount }, policy): RushSurcharge`
- `evaluateRushLeadTime({ isRush, requestedDelivery, today }, policy): RushLeadTime`
- `formatRushPolicySentence(policy | null, unavailable): string` — the one place
  the admin-facing description of a policy is worded.

`RushSurcharge` is a discriminated union, because these are genuinely different
situations and each gets a different sentence:

| `kind` | meaning | `surchargeCents` |
|---|---|---|
| `not-rush` | the job is not a rush job | `0` |
| `unpriced` + `reason:'no-policy'` | rush, but no policy is in force | `0`, and `unpriced` is on the object |
| `unpriced` + `reason:'blank-value'` | a policy is in force but the value its type needs is NULL | `0`, and `unpriced` is on the object |
| `applied` | a real decision, including an explicit `'none'` | the computed cents (may legitimately be `0` for `'none'`) |

`'none'` is **not** a blank: it is Steve saying "rush costs nothing extra, but it
still needs N days". That distinction is the whole reason `kind` and `reason`
are separate fields.

The arithmetic, stated exactly:

- `percent` → `Math.round(subtotalCents * surchargePercentBp / 10000)`.
  Rounded **once**, at the end, on the whole subtotal — never per line, for the
  same reason `quote-math.ts` rounds once per line and not once per piece.
- `flat` → `surchargeCents`.
- `per_piece` → `surchargeCents * pieceCount`. `pieceCount` is the sum of the
  quoted quantities.
- `none` → `0`.

Defensive refusals (each returns `unpriced/blank-value`, never a number):
a `percent` policy with a NULL `surchargePercentBp`; a `flat`/`per_piece`
policy with a NULL `surchargeCents`; a non-finite or negative subtotal or piece
count. The database CHECK already refuses the first two shapes — keeping the
evaluator's refusal as well is deliberate belt-and-braces, documented as such,
because rule #19's "a blank is never a zero" is the exact mistake a `?? 0`
would make and because **the migration is not applied**, so the CHECK is not
yet protecting anything.

`RushLeadTime`, also a union, one state per sentence:

| `status` | meaning |
|---|---|
| `not-rush` | not a rush job |
| `no-policy` | rush, no policy in force |
| `not-set` | a policy is in force but `minimumLeadTimeDays` is NULL |
| `no-date` | the customer gave no requested-by date |
| `meets` | the requested date is at or beyond the minimum |
| `too-soon` | it is inside the minimum; carries `earliest`, the first date that would meet it |

Both `meets` and `too-soon` carry `minimumDays`, `businessDays` (what the
customer actually asked for), `requestedDate` and `earliest`, so the UI never
recomputes anything.

A `requestedDelivery` that is not a valid `YYYY-MM-DD` is treated as
**`no-date`**, not as an error: a malformed date is the absence of a usable one,
and a thrown exception here would take out the Job screen.

### R-03 — business days, extended in the one file that owns them

`lib/delivery/business-days.ts` gains three pure functions and **no existing
function changes**:

- `calendarDaysBetween(from, to): number` — signed, `Date.UTC`-based, so no
  zone can creep into a date-only value.
- `businessDaysBetween(from, to): number` — business days in the half-open
  interval `(from, to]`. Monday→Tuesday is 1; **Friday→Monday is 1**;
  Monday→Monday is 0; `to < from` is the negation. Implemented as
  `floor(days/7) * 5` plus at most **6** single-day checks, so a customer who
  types the year 9999 costs six iterations, not three million.
- `addBusinessDays(from, n): DateOnly` — `n` business days strictly after
  `from`; `n = 0` returns `from` unchanged. Refuses `n < 0` or `n > 3650`.

### R-04 — reading the policy, `lib/pricing/db.ts`

```ts
export interface RushPolicyBook { policies: RushPolicy[]; unavailable: string | null }
export async function getRushPolicyBook(supabase): Promise<RushPolicyBook>
```

**It never throws.** On a query error it returns `{ policies: [], unavailable:
<plain English> }` and logs **one** `console.warn` carrying the real Postgres
error. The two cases are worded differently because they are different facts:

- the table is not in the database yet (`42P01` / PostgREST `PGRST205`) →
  *"The rush policy table is not in the database yet — migration
  039_rush_policy.sql has not been applied. No rush surcharge will be added to
  any quote until it is."*
- anything else → *"The rush policy could not be read, so no rush surcharge was
  added. ..."* plus the error.

This is **not** silent swallowing: the sentence is returned to the caller and
rendered on both the admin settings screen and the Job screen. The alternative —
throwing — would take down quoting entirely for a table that does not exist yet.

Columns are named explicitly (the file's own EGRESS rule).

### R-05 — the write path, `app/api/admin/rush-policy/route.ts`

`POST { action: 'set-policy', name, surchargeType, surchargePercentBp?,
surchargeCents?, minimumLeadTimeDays?, effectiveFrom?, note? }`

- 401 without a session; 403 unless `profiles.role === 'admin'`. Identical
  shape to `app/api/admin/price-book/route.ts`.
- **Validation mirrors the CHECKs exactly**, and every refusal is a 400 naming
  the field in plain English:
  - `name` required, trimmed, non-empty, ≤ 120 chars.
  - `surchargeType` must be one of the four (`isRushSurchargeType`).
  - the value its type needs must be an **integer ≥ 0** within bounds; the one
    it does not need must be absent. A blank where a value is required is a 400,
    **not** a stored NULL — the UI must not be able to create an unpriced policy.
  - `minimumLeadTimeDays` optional; when given, integer `0..365`.
  - `effectiveFrom` defaults to today via `toEffectiveDate(new Date())`.
- **INSERT ONLY.** No UPDATE, no DELETE, no upsert. Changing the policy means a
  new row with a new effective date, exactly like the price book.
- Writes an `admin_audit_log` row via `logAdminAction` and a
  `price_book_change`-shaped **pricing ledger** row via `appendLedger` carrying
  old → new, so a rush-policy change lands in the dataset dynamic pricing will
  learn from (rule #20). `event_type` reuses `'price_book_change'` — a rush
  surcharge **is** a price change, and inventing a new event type would need a
  migration to `pricing_ledger`'s CHECK, which this run may not apply.
  `old_value`/`new_value` carry `{ rushPolicy: ... }` so the row is
  unambiguous. *(To be verified against `pricing_ledger`'s real `event_type`
  CHECK before relying on it; if the CHECK does not permit it, the ledger write
  is dropped and the audit-log row stands alone — recorded either way.)*
- A failure to write the ledger or audit row must not undo a saved policy: both
  are after the insert and their failure is reported in the message, never by a
  500 that implies nothing was saved.

### R-06 — the admin screen and its empty state

`app/admin/settings/rush-policy/page.tsx` — server component,
`requireAdminUser`, `export const dynamic = 'force-dynamic'`, wrapped in
`LightWorkingArea`, a "← Settings" back link, and the same voice as
`price-book/page.tsx`. It renders `components/admin/RushPolicyEditor.tsx` with
the whole `RushPolicyBook` plus the server's own `today`.

The component renders exactly one of **three** states, and they are three
because they are three different facts an admin needs told apart:

1. **`unavailable` is set** — the table is not there. Says so, names the
   migration file, states plainly that **no rush surcharge is being added to any
   quote**, and **disables the form** (a form that cannot save is worse than no
   form).
2. **`unavailable` is null and `policies` is empty** — *the shipped state.*
   "No rush policy has been set yet." Explains, in Steve's words, that rush jobs
   are flagged, badged and pinned to the top of the shop queue today, and that
   **no surcharge is added to any quote** until a policy is set here. The form
   is live.
3. **a policy is in force** — shows it in words
   (`formatRushPolicySentence`), the date it started, the full history
   newest-first with each row's effective date, and the form for the next one,
   captioned so it is obvious that saving **adds** a policy rather than editing
   this one.

The form: name, surcharge type (a `<select>` of the four), a value input that
switches between a percent box and a dollars box with the type, a minimum
lead-time box, a start date defaulted to the server's today, and a note. The
dollars box uses `parseDollarsToCents` from `lib/pricing/quote-math.ts` — the
one place a typed dollar string becomes cents.

Colour: `afs-ink-900` body text, `afs-ink-700` for secondary text **and for
every placeholder** (rule #23 — `afs-chrome-silver` measures 1.55:1 on
`afs-bg-card` and is a gunmetal token), `afs-bg-card` / `afs-bg-lane` /
`afs-line-strong` surfaces, `afs-amber-bg` / `afs-amber-ink` for the
not-set/unavailable notices. No new token. The contrast gate is re-run and its
numbers recorded.

One link card is added to `app/admin/settings/page.tsx`'s existing **Pricing**
section (the live branch only — `V7Settings` is untouched), worded from the real
state: how many policies exist, or that none has been set.

### R-07 — the formal quote decides the surcharge

In `lib/quotes/issue.ts`:

```ts
export interface RushQuoteContext {
  policy: RushPolicy | null;
  policyUnavailable: string | null;
  surcharge: RushSurcharge;
  leadTime: RushLeadTime;
}
export async function rushContextForJob(supabase, job, priced, now): Promise<RushQuoteContext>
```

`issueQuoteForJob` then:

- computes the context after a successful pricing and before the insert;
- writes `rush_surcharge: surchargeCents / 100` (the existing DECIMAL column, in
  dollars), `subtotal_cents: priced.subtotalCents` (**unchanged** — the subtotal
  is the lines), `total_cents: priced.subtotalCents + surchargeCents`, and the
  legacy `subtotal`/`total` dollars to match;
- passes `surchargeCents` and the customer-facing label to `quoteEmailHtml`;
- records `rushSurchargeCents`, `rushPolicyId` and `rushLeadTime.status` in the
  existing ledger `payload` JSON — **no new ledger column**;
- returns `rushSurchargeCents` and `rushLeadTime` on the success outcome so the
  route's message and the audit row can name them.

**The customer-facing label is `SPEC_RUSH_ORDER.md` §4's own wording, verbatim:
"Rush fabrication — priority scheduling".** The admin-facing basis string
("2.50% of $1,000.00", "$150.00 flat", "$25.00 × 8 pieces") appears only in the
Command Center.

**With an empty table the surcharge is 0 and every figure is identical to
today's** (I-03). That is the single most important property of this
requirement and it gets its own unit test.

`app/api/admin/command-center/send-quote/route.ts` adds `requested_delivery` to
its `quote_requests` select — nothing else.

### R-08 — the surcharge is visible wherever the total is

- `lib/quotes/email-template.ts`: both `quoteEmailHtml` and `invoiceEmailHtml`
  take optional `surchargeCents` + `surchargeLabel` and render one row between
  the lines and Total **only when `surchargeCents > 0`**. A `$0.00` row on a
  customer's document is noise, and an explicit `'none'` policy has nothing to
  show.
- `lib/invoices/create.ts`: `QuoteForInvoice` gains `rush_surcharge: number | null`;
  the figure is converted once (`Math.round(rush_surcharge * 100)`) and passed to
  both invoice emails. `invoices.subtotal_cents` and `total_cents` are still
  **copied, never recomputed**; their difference *is* the surcharge, which is why
  no new invoice column is needed.
- `app/api/quote-approve/[token]/route.ts`: `rush_surcharge` added to the select
  that feeds `QuoteForInvoice`.

### R-09 — the estimator sees the policy and the lead time

`lib/data/job-screen.ts`: `JobScreenData` gains

```ts
rushQuote: {
  policy: RushPolicy | null;
  policyUnavailable: string | null;
  leadTime: RushLeadTime;
} | null;
```

populated **only when the job is rush** (`row.is_rush === true`), so a standard
job costs zero extra queries. It carries the **policy**, not a computed
surcharge, because `JobActionPanel` re-totals in the browser as the estimator
edits Qty — so the browser must recompute the surcharge with the **same
`evaluateRushSurcharge`** the server uses on Send. One function, both sides, no
drift. The lead time is computed on the **server**, where `today` is the shop's
date (`shopDateOnly`), never the browser's.

`components/admin/JobActionPanel.tsx`:

- the quote table gains a surcharge row (label = the admin basis string) before
  Total when the recomputed surcharge is `> 0`, and the Total becomes
  `editedTotalCents + surchargeCents`;
- when the surcharge is `unpriced`, a `note` under the table says so in one
  sentence and the Send button stays **enabled** — a missing rush policy does
  not block a quote (U3);
- the existing rush block gains the policy sentence and the lead-time sentence.
  `too-soon` reads, e.g., *"They asked for Oct 7. A rush job needs 5 working
  days, so the earliest is Oct 12."*
- v7's own classes (`note`, `n`, `pstrip`) only. No new CSS, no new token.

### R-10 — the customer can request rush **and a date**

`app/quote/page.tsx` Step 3, immediately under the existing Rush Order toggle:

- a `neededBy` field on `QuoteFormData` (default `''`), a `<label>` + `<input
  type="date">`, `min` = today;
- the field is sent as `requestedDelivery: form.neededBy || null` — a field the
  intake route **already** reads and persists (`route.ts:188`), so **no route
  change and no migration**;
- a review-step row, beside the existing Rush row;
- the spec's own placeholder promise, verbatim: *"Rush orders receive priority
  scheduling. AFS will confirm turnaround in your formal quote."*
- and, in one short sentence, the thing rule #15 depends on being true in the
  user's head as well as in the code: **a date on its own is not a rush
  request.** No price, no estimate, no dollar sign anywhere on the page.

### R-11 — the badge

Already built, in nine components (§4.1). This item **adds no badge** and
changes no list. It **proves** the badge, end to end, in
`tests/e2e/rush-order.spec.ts`: a rush job submitted through the real wizard
renders a rush pill on the Workbench. Recorded as *pre-existing, verified*, not
as new work.

---

## 10. CONSTRAINTS — what must not be changed, inferred or weakened

1. **Do not assign `is_rush` or `rush_source` in any new or modified file.**
   `lib/data/rush-explicit-only.test.ts` asserts the writer list by equality and
   must stay green untouched.
2. **Do not derive rush from the requested-by date**, from a note, from a
   keyword or from waiting time — in code, in SQL, or in a UI default.
3. **Do not apply any migration.** File only.
4. **Do not seed `rush_policies`.** Not one row, not a comment suggesting one,
   not a `DEFAULT`.
5. **Do not add `DEFAULT 0` to any money or rate column.** A zero is a price.
6. **Do not touch** `middleware.ts`, `docs/design/command-center-v7/**`,
   `components/admin/v7/**`, `app/styles/command-center-v7.generated.css`,
   `SCREEN_MANIFEST.json`, `tests/visual/**`, or any pixel-gate baseline.
7. **Do not reintroduce FlashDraft's rush toggle** (afs-fl-026) or a Configurator.
8. **Do not change rush ordering** in any query (rule #15).
9. **Do not put a second copy of the version resolution** anywhere — widen
   `versionInForce`, do not clone it.
10. **Do not relax a gate threshold, add a skip list, or weaken an assertion**
    to make anything pass.
11. **Do not recompute an invoice** from the price book or from the policy. It
    copies the quote.
12. **No `any`.** TypeScript strict stays clean.
13. **Do not send a real email, SMS or charge**, and do not add a
    deployment-wide test-mode flag (rule #21).

---

## 11. IMPLEMENTATION GUIDANCE — ordering (dependencies first)

1. `lib/delivery/business-days.ts` + its tests. *(No dependents yet; green first.)*
2. `lib/pricing/price-book.ts` — widen `versionInForce`. Re-run the price-book
   tests: they must pass **unchanged**.
3. `supabase/migrations/039_rush_policy.sql`.
4. `lib/pricing/rush-policy.ts` + `lib/pricing/rush-policy.test.ts`. Full green
   before anything consumes it.
5. `lib/pricing/db.ts` — `getRushPolicyBook`.
6. `app/api/admin/rush-policy/route.ts`.
7. `app/admin/settings/rush-policy/page.tsx` + `components/admin/RushPolicyEditor.tsx`
   + the Settings link card. Run the contrast gate here.
8. `lib/quotes/issue.ts`, `lib/quotes/email-template.ts`,
   `lib/invoices/create.ts`, `app/api/quote-approve/[token]/route.ts`,
   `app/api/admin/command-center/send-quote/route.ts`.
9. `lib/data/job-screen.ts` + `components/admin/JobActionPanel.tsx`.
10. `app/quote/page.tsx`.
11. `tests/e2e/rush-order.spec.ts`.
12. End-of-run verification, governance append, commit, push.

Commit after each numbered unit (`ovn(10-rush-order): <unit> — N tests green`).

---

## 12. ACCEPTANCE CRITERIA

| # | Criterion |
|---|---|
| **AC-01** | `supabase/migrations/039_rush_policy.sql` exists, creates `rush_policies` with the nine columns of R-01, five named CHECK constraints, an index on `effective_from DESC`, an append-only trigger bound to `afs_append_only()`, RLS enabled and exactly one admin-only policy — and contains **no INSERT and no DEFAULT on any value column**. |
| **AC-02** | The migration is **not applied**: `supabase/migrations/` is the only place `rush_policies` is created, and no `apply_migration`/`execute_sql` call is made in this run. |
| **AC-03** | `evaluateRushSurcharge` returns `surchargeCents: 0` and `kind: 'unpriced', reason: 'no-policy'` when the policy is `null`, for any subtotal and any piece count. |
| **AC-04** | `evaluateRushSurcharge` returns `kind: 'unpriced', reason: 'blank-value'` — never a number — for a `percent` policy with `surchargePercentBp: null` and for a `flat`/`per_piece` policy with `surchargeCents: null`. |
| **AC-05** | Percent boundaries: `0 bp → 0`; `250 bp` on `100000¢ → 2500¢`; `10000 bp` on `123457¢ → 123457¢`; `250 bp` on `1¢ → 0¢` (`Math.round(0.025)`); `250 bp` on `20¢ → 1¢` (`Math.round(0.5)` rounds up). Each asserted exactly. |
| **AC-06** | `flat` returns its cents regardless of subtotal and piece count. `per_piece` returns `cents × pieceCount`, and `pieceCount: 0 → 0`. `none` returns `kind: 'applied', surchargeCents: 0` — **not** `unpriced`. |
| **AC-07** | `rushPolicyInForce` returns the latest policy whose `effectiveFrom <= asOf`; a policy dated **after** `asOf` is never returned; two policies on the same date resolve to the one with the later `createdAt`. |
| **AC-08** | `businessDaysBetween`: Mon→Tue `1`; Fri→Mon `1`; Fri→Sat `0`; Mon→Mon `0`; Mon→next Mon `5`; Mon→Mon+28d `20`; Tue→previous Mon `-1`. `addBusinessDays(Fri, 1)` is the following Monday; `addBusinessDays(d, 0)` is `d`; a negative `n` throws. |
| **AC-09** | `evaluateRushLeadTime` returns `not-rush` / `no-policy` / `not-set` / `no-date` / `meets` / `too-soon` for each of those six situations, and `too-soon`'s `earliest` equals `addBusinessDays(today, minimumDays)`. A malformed `requestedDelivery` yields `no-date` and throws nothing. |
| **AC-10** | With an empty policy book, `issueQuoteForJob` writes `rush_surcharge: 0` and `total_cents === subtotalCents` — **identical to the pre-change behaviour** — for a rush job and for a standard one. Asserted as a unit test over the pure evaluator plus a read of the insert payload's construction. |
| **AC-11** | `getRushPolicyBook` returns `{ policies: [], unavailable: <non-null sentence naming 039_rush_policy.sql> }` when the table does not exist, and **throws nothing**. |
| **AC-12** | `POST /api/admin/rush-policy` answers 401 unauthenticated, 403 non-admin, 400 for each of: missing `name`, unknown `surchargeType`, a `percent` type with no percent value, a `flat` type with no cents value, a percent above `MAX_RUSH_PERCENT_BP`, a negative value, a non-integer value, a lead time above 365. Every 400 body carries a sentence naming the field. |
| **AC-13** | The route contains **no** `update(`, `delete(` or `upsert(` against `rush_policies`. |
| **AC-14** | `/admin/settings/rush-policy` renders the **empty state** when no policy exists, naming that no surcharge is added to any quote, and the **unavailable state** (form disabled, migration named) when the table is absent. Verified in a browser by Playwright against a local build. |
| **AC-15** | `/admin/settings` links to it from the Pricing section. |
| **AC-16** | `/quote` collects a requested-by date, sends it as `requestedDelivery`, shows it on the review step, shows the spec's placeholder promise, states that a date alone is not a rush request, and **displays no dollar amount anywhere**. |
| **AC-17** | A quote request submitted with the rush toggle ON and a date persists `is_rush = true`, `rush_source = 'customer_checkbox'`, `rush_set_at` non-null and `requested_delivery = <the date>`. Asserted against the database. |
| **AC-18** | That rush job renders a rush badge in an existing admin queue list (the Workbench lane). Asserted in a real browser. |
| **AC-19** | `lib/data/rush-explicit-only.test.ts` passes **unmodified** — the writer list is still exactly five files and no new inference exists. |
| **AC-20** | `pnpm tsc --noEmit` exits 0 with zero errors. |
| **AC-21** | `pnpm test:unit` shows **no new failure** versus the 1 pre-existing `v7-css` failure, and the new test files pass in full with their counts printed. |
| **AC-22** | `node scripts/audit/contrast-check.mjs` PASSes with `0 unresolved` and `0 below`, and the new screen appears in its output. |
| **AC-23** | `git status` shows no change to `middleware.ts`, `docs/design/command-center-v7/**`, `components/admin/v7/**`, `app/styles/command-center-v7.generated.css`, `SCREEN_MANIFEST.json` or `tests/visual/**`. |
| **AC-24** | `STATE_OF_THE_BUILD.md` and `SESSION_STATE.md` carry a dated **appended** section; `SCHEMA.md` documents `rush_policies`; `queue.yaml` records the item. No existing text rewritten. |

---

## 13. VALIDATION — mapped to the acceptance criteria

| Criterion | Verification |
|---|---|
| AC-01, AC-02 | read the migration file; `grep -c "INSERT INTO rush_policies"` → 0; `git log`/`git status` show no DB call; `grep -rn "rush_policies" --include=*.sql` → one file |
| AC-03 … AC-07 | `pnpm vitest run lib/pricing/rush-policy.test.ts` |
| AC-08 | `pnpm vitest run lib/delivery/business-days.test.ts` |
| AC-09 | `pnpm vitest run lib/pricing/rush-policy.test.ts` |
| AC-10 | `pnpm vitest run lib/pricing/rush-policy.test.ts` (the empty-book invariant) + reading `lib/quotes/issue.ts`'s insert |
| AC-11 | `pnpm vitest run lib/pricing/rush-policy.test.ts` (fake client returning `42P01`) |
| AC-12, AC-13 | `pnpm vitest run` on the route's validator (pure, extracted) + `grep -n "update(\|delete(\|upsert(" app/api/admin/rush-policy/route.ts` |
| AC-14, AC-15 | `pnpm build && pnpm start`, then `pnpm test:e2e tests/e2e/rush-order.spec.ts` |
| AC-16 … AC-18 | same Playwright spec, with `tests/e2e/helpers/db.ts`'s SQL path for the database assertions |
| AC-19, AC-21 | `pnpm test:unit` |
| AC-20 | `pnpm tsc --noEmit` |
| AC-22 | `node scripts/audit/contrast-check.mjs` |
| AC-23 | `git status --short` / `git diff --name-only` |
| AC-24 | read the appended sections |

---

## 14. REQUIRED TESTS — class and behaviour

### 14.1 Unit (vitest) — `lib/pricing/rush-policy.test.ts`

ARRANGE from **explicit, versioned fixtures declared in the file** (no random
data, no `Date.now()`): a frozen `TODAY = '2026-10-05'` (a Monday) and named
policy objects `PERCENT_250BP`, `FLAT_15000`, `PER_PIECE_2500`, `NONE_5DAY`,
`PERCENT_BLANK`, `FLAT_BLANK`, `FUTURE_POLICY`, `SAME_DAY_CORRECTION`.

- **happy** — each of the four types produces its exact cents.
- **empty** — `null` policy ⇒ `unpriced/no-policy`, `surchargeCents === 0`.
- **blank** — `PERCENT_BLANK` / `FLAT_BLANK` ⇒ `unpriced/blank-value`.
- **boundary** — percent `0`, `MAX_RUSH_PERCENT_BP`; subtotal `0`, `1`, `20`;
  `pieceCount` `0`, `1`; `none` ⇒ `applied` with `0`.
- **error** — non-finite / negative subtotal or piece count ⇒ `unpriced`, never
  `NaN`, never a throw.
- **resolution** — `FUTURE_POLICY` is not in force; `SAME_DAY_CORRECTION` wins
  on `createdAt`; empty list ⇒ `null`.
- **lead time** — all six statuses; `earliest` crosses a weekend; a malformed
  date ⇒ `no-date`.
- **the empty-book invariant** — for every one of nine (subtotal, pieceCount)
  pairs, `evaluateRushSurcharge(..., null).surchargeCents === 0`, so an empty
  table cannot change a total.
- **`getRushPolicyBook`** against a hand-written fake Supabase client: a
  `42P01` error, a `PGRST205` error, a generic error, and a happy read — the
  first three return `unavailable` and throw nothing.
- **the route's validator**, extracted as a pure function so every 400 in AC-12
  is a unit test rather than a live HTTP call.

Every `expect` carries a diagnostic message stating expected vs actual and why
it matters. Isolated, order-independent, deterministic, no shared state, no
network, no clock.

### 14.2 Unit (vitest) — `lib/delivery/business-days.test.ts` (extended)

The AC-08 table, plus: a month boundary, a leap day (`2028-02-28` → `2028-03-01`
is 2 business days), `addBusinessDays` across two weekends, and the throw on a
negative `n`.

### 14.3 Regression (vitest)

`lib/pricing/price-book.test.ts` and `lib/pricing/quote-math.test.ts` must pass
**unmodified** after `versionInForce` is widened — that is the regression proof
for the one shared-code change in this item.

### 14.4 End-to-end (Playwright) — `tests/e2e/rush-order.spec.ts`

Against a **local** `pnpm build && pnpm start` (`playwright.config.ts`'s
`baseURL` defaults to `http://localhost:3000`), because the change is not
deployed and asserting it against alpha would be asserting the old code.

- **flag + date persistence** — fill the wizard with a job name carrying the
  reserved `E2E-TEST-` prefix (rule #21: outbound mail is captured, not sent),
  rush ON, a date; submit; read the row back through
  `tests/e2e/helpers/db.ts`'s `sql()` and assert `is_rush`, `rush_source`,
  `rush_set_at` and `requested_delivery` exactly. TEARDOWN deletes the row with
  `deleteJob`.
- **badge render** — open the Workbench as an admin and assert the rush pill on
  that job's card.
- **the admin empty state** — `/admin/settings/rush-policy` shows the
  table-not-applied state, names `039_rush_policy.sql`, and the form is
  disabled.
- **no customer-facing price** — the wizard's rush step and review step contain
  no `$`.

Credential-gated steps skip (not fail) when `E2E_TEST_EMAIL` /
`SUPABASE_ACCESS_TOKEN` are absent, matching this repo's existing convention —
and the run reports which skipped and why.

### 14.5 Coverage

`vitest@5.0.0` is installed; **`@vitest/coverage-v8` is not** (`node_modules/@vitest/`
does not contain it) and `vitest.config.mts` configures no coverage provider.
Installing one would add a dependency outside this item. **The measured number
will therefore be reported as unavailable, with the reason and the exact
per-file test counts in its place**, rather than estimated. Recorded as a known
limitation, not hidden.

---

## 15. COMPLETION EVIDENCE — to be produced

Files created / modified / untouched; the full migration SQL **printed**, with
its down SQL; every command run with its **real output** (`tsc`, `test:unit`,
the new vitest files, the contrast gate, `build`, Playwright); pass/fail counts
before and after; the pre-existing `v7-css` failure named and shown to be
pre-existing by a clean-tree run; every assumption A1-A8 and every unresolved
U1-U4; and the browser steps a human needs to confirm it.

The item is **UNVERIFIED** until a human has looked at it in a browser — this
project's standard, and a Playwright pass is evidence to bring to that
confirmation, not a substitute for it.

---

## 16. SELF-AUDIT

To be completed after implementation, against the 100-point scale, with
deficiencies fixed and re-scored until ≥ 95.

---

*EES-OVN.10-RUSH-ORDER.md | AFS — Architectural Flashing Supply | Reid Whitesides | 2026-10-03*
