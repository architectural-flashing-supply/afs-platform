
---

# 2026-10-03 — ovn 10-rush-order: RUSH ORDER, THE MECHANISM WITH NONE OF THE NUMBERS IN IT

**Item:** `10-rush-order` · **Branch:** `ovn/10-rush-order` (worktree) ·
**Spec:** `specs/SPEC_RUSH_ORDER.md` · **EES:** `EES-OVN.10-RUSH-ORDER.md`
**STATUS: UNVERIFIED pending Reid's own confirmation in a browser.**

## WHAT ALREADY EXISTED, CHECKED AGAINST THE CODE RATHER THAN THE AUDIT

`RUSH_ORDER_AUDIT.md` dates from 2026-07-31 — before Command Center V2 and
before the v7 port — so it was re-verified line by line rather than trusted.
**The flag and the badge are built. The policy, its admin screen, the lead-time
rule, the surcharge on the formal quote and the requested-by date on the wizard
were the gap.**

Built, and untouched by this item: `quote_requests.is_rush` / `rush_source` /
`rush_set_by` / `rush_set_at`; migration 034's
`quote_requests_rush_needs_explicit_source` CHECK; the customer checkbox at
intake; the admin toggle on the Job screen;
`lib/data/rush-explicit-only.test.ts`; rush pinned to the top of the shop
queues; and a RUSH badge in **nine** list components — `WorkbenchLanes`,
`QuoteOrderList`, `ShopQueueBoard`, `ProductionQueueTable`, `DeliveriesWeek`,
`dashboard/ProductionStatusTable`, `CommandCenterJobCard`,
`PendingQuoteRequestCard`, `OrdersCrmTab`, plus `v7-view/from-live.ts`'s
`flagPills`. **This item added no badge anywhere**; it asserted the existing one
instead.

**THE OLD AUDIT'S THREE RECOMMENDATIONS WERE ALL SUPERSEDED BY DECISIONS, NOT
LEFT UNDONE**, and acting on them would have been a regression:

- *"Add a rush toggle to `/configure`"* — **`/configure` no longer exists.** The
  Configurator was eliminated; only its historical `source_tool` token remains.
- *"Add a rush toggle to `/studio/draft`"* — **Reid removed it on purpose.**
  `app/studio/draft/page.tsx:3755` records afs-fl-026: *"the Rush Order toggle
  was removed from this page's sidebar (Reid: 'they have notes')."* Not
  reintroduced.
- *"Sort rush to the top of the Command Center tabs"* — **CLAUDE.md rule #15 now
  says the opposite deliberately.** Rush pins to the top of the **shop queues
  only**; the Workbench, the office lists and Deliveries stay newest-first and
  rush changes nothing but the badge. No ordering was touched.

## WHAT WAS BUILT

### 1. `rush_policies` — migration FILE 039, NOT APPLIED, SHIPPED EMPTY

Surcharge **type** (`percent` | `flat` | `per_piece` | `none`), surcharge
**value** (basis points or cents), and **minimum lead time** in business days.
Effective-dated and append-only through migration 035's own
`afs_append_only()` trigger; admin-only RLS with no customer policy at all; no
`company_id` (back-office config, exactly like `price_book_items`); five named
CHECK constraints; **zero INSERTs and no `DEFAULT` on any value column.**

Full column list, every constraint and the DOWN SQL: SCHEMA.md's 2026-10-03
entry. The migration was **not** run, and that was verified rather than
asserted — `select to_regclass('public.rush_policies') is not null` returns
**false** on the live project.

**`'none'` is a type, not the absence of one.** "Rush is free but still needs
five working days" is a real answer Steve might give, and it is not the same
fact as "nobody has decided". That distinction is the whole reason the
evaluator has both a `kind` and a `reason`.

### 2. `lib/pricing/rush-policy.ts` — the pure rule, four states that must never be conflated

| state | meaning | cents added |
|---|---|---|
| `not-rush` | the job is not rush | 0 |
| `unpriced` / `no-policy` | rush, nothing in force. **Nobody has decided.** | 0 |
| `unpriced` / `blank-value` | a policy exists, the figure it needs is missing | 0 |
| `applied` | a real decision, including an explicit `'none'` | the figure |

The last two look identical if you only look at the number. `unpriced` means
"do not treat this as priced"; `applied` with `0` means "it is priced, and the
price is nothing". Only one of them should send somebody to go and fill
something in.

Percent is `Math.round(subtotal * bp / 10000)` — **rounded once, at the end, on
the whole subtotal**, never per line, because rounding a percentage line by line
and adding the results drifts away from the percentage of the total, which is
the figure the policy actually names.

### 3. The lead-time rule, in the one file allowed to decide what a business day is

`lib/delivery/business-days.ts` gained `calendarDaysBetween`,
`businessDaysBetween` and `addBusinessDays`, per CLAUDE.md rule #24. **No
existing function changed.**

**Friday to Monday is ONE working day of notice, not three.** Counting the
weekend is how a rush job gets accepted that the shop has one day to make, and
it is the case a naive calendar subtraction gets wrong every single week.
`businessDaysBetween` is `floor(days/7)*5` plus at most **six** single-day
checks, so a customer who types the year 9999 into a date picker costs six
iterations rather than three million inside a page render.

`addBusinessDays` is asserted to be the **exact inverse** of
`businessDaysBetween` over four start days and six day counts — so the
"earliest we could do it" date an estimator is shown really does carry the
notice the policy asked for.

**WARNS, NEVER REFUSES.** A requested date inside the minimum is a sentence on
the Job screen, not a blocked quote: AFS decides what work it will take on, and
the moment to decide is when an estimator is looking at the job. *(Recorded as
an open question for Reid — see PENDING below.)*

### 4. One copy of the version resolution, not two

`versionInForce` in `lib/pricing/price-book.ts` was **widened** from
`PriceBookVersion` to a structural `EffectiveDated` generic rather than
copied — CLAUDE.md rule #19 says the version resolution lives in one place and
nowhere else. Every existing call site resolves to a narrower type than before,
so none changed, and `lib/pricing/price-book.test.ts` and
`quote-math.test.ts` pass **unmodified**, which is the regression proof for the
one shared-code change in this item.

A side effect worth recording: on `rush_policies` the `createdAt` tiebreak
inside that function is **genuinely reachable**, because this table has no
UNIQUE on `effective_from` (append-only means a same-day correction has no other
route). On `price_book_versions` that branch is unreachable — the UNIQUE refuses
the second same-day row before the resolver sees it.

### 5. Reading the policy without ever throwing

`getRushPolicyBook` (`lib/pricing/db.ts`) returns
`{ policies, unavailable }` and **never throws**. On a deployment without
migration 039 applied — which is every deployment today — `unavailable` carries
*"The rush policy table is not in the database yet — migration
039_rush_policy.sql has not been applied. No rush surcharge is being added to
any quote until it is."* That sentence is **returned**, not swallowed: both the
admin screen and the Job screen print it, and one `console.warn` carries the
real Postgres error.

Throwing would have taken down quoting entirely for the sake of a surcharge
that is blocked on business data anyway. `42P01` and PostgREST's `PGRST205` are
reported as a missing table; anything else is reported as a fault with its real
message, because those are different facts.

### 6. The formal quote decides the surcharge

`lib/quotes/issue.ts` stops writing `rush_surcharge: 0`. `subtotal_cents` stays
the lines, `total_cents` carries the surcharge, and `rush_surcharge` (an
existing `DECIMAL(10,2)` column from migration 001) carries the figure in
dollars — lighting up three screens that already displayed it when non-zero.

**WITH AN EMPTY POLICY TABLE EVERY FIGURE IS IDENTICAL TO WHAT IT WAS BEFORE
THIS CODE EXISTED.** That is the invariant the whole item rests on and it has
its own test, over a grid of six subtotals × four piece counts: an empty
`rush_policies` must add exactly 0 cents, or shipping this would silently change
the value of every rush quote in the system.

The surcharge is **not** a `QuoteLine`. A fee has no material, no blank width,
no strips-per-sheet and no price-book version id, and fabricating those would
put invented geometry on a customer's quote and then copy it onto their invoice.
It is a row of its own in both email templates, rendered **only when the figure
is above zero** — a `$0.00` line reads as a decision somebody made, and an
unpriced rush must never look like a free one.

**The customer-facing label is SPEC_RUSH_ORDER.md §4's own wording, verbatim —
"Rush fabrication — priority scheduling" — and carries no rate.** The amount is
AFS's; the formula is not the customer's to apply. The admin-facing basis
string ("2.5% of $1,000.00", "$150.00 flat", "$25.00 × 8 pieces") appears only
in the Command Center.

**The invoice COPIES it and recomputes nothing.** `invoices` needs no rush
column: `total_cents - subtotal_cents` already carries the figure, and the row
it prints is read from the quote's own `rush_surcharge`. Recomputing from a
policy that may have moved since the quote went out would bill a different
number from the one the customer approved, which is the worst bug this area
could have.

### 7. The admin screen, and an empty state that tells three facts apart

`/admin/settings/rush-policy` renders exactly **one** of three states, and they
are three because they are three different things to act on:

1. **the table is not there** — names `039_rush_policy.sql`, states that no
   surcharge reaches any quote, and **disables the form**. A save that cannot
   possibly land is worse than no button.
2. **the table is empty** — the shipped state. Says plainly that no surcharge is
   added until a policy is set, and says what rush **does** already do (flagged,
   badged, pinned to the top of the shop queue) so "no policy" does not read as
   "rush does nothing".
3. **a policy is in force** — in words, with its start date, the full history
   newest-first, and the form for the next one.

The e2e spec asserts that **exactly one** of the three renders, and that the
percentage and lead-time boxes start **empty** in every state — a pre-filled
rate would become a price Steve never chose the first time somebody pressed
Save.

`POST /api/admin/rush-policy` is **INSERT ONLY** — no `update(`, `delete(` or
`upsert(` appears in the file, and the append-only trigger would refuse them
anyway. Admin-only twice over (403 in the route, `is_admin()` in RLS). A blank
where a value is required is a **400 naming the box**, not a stored NULL. Every
change writes an `admin_audit_log` row and a `pricing_ledger` row as old → new
(`event_type = 'price_book_change'`, which migration 035's CHECK already
permits — verified live; a rush surcharge **is** a price change, and inventing
a new event type would need a migration applied to `pricing_ledger`).

### 8. The customer can request rush AND a date

The Quote Builder's rush step gained a "When do you need it?" date, sent as
`requestedDelivery` — a field `quote_requests.requested_delivery` and the
intake route **already** supported, so no migration and no route change. Plus
SPEC_RUSH_ORDER.md §2's placeholder promise verbatim, and one sentence a
database constraint cannot enforce: **a date on its own is not a rush
request.** Rule #15 is held in Postgres and in a static test, but neither of
those stops a customer from *believing* a date is a rush request, and that part
only the UI can do.

**No dollar amount appears anywhere on the wizard**, asserted by regex over the
rendered text of both the rush step and the review step.

### 9. What the estimator sees

The Job screen's action panel gained the policy sentence, the lead-time sentence
and a rush-surcharge row in the quote table. It is handed the **policy**, not a
computed figure, and re-runs `evaluateRushSurcharge` in the browser from the
edited subtotal — a percentage moves when Qty is edited, and a figure that
stopped tracking the subtotal above it would be a wrong number sitting beside a
right one. **One pure function, both sides**, so what is shown and what is
emailed cannot drift. The lead time is computed on the **server**, where "today"
is the shop's date (`shopDateOnly`), never the browser's.

## COMMAND CENTER v7 WAS NOT TOUCHED, AND HERE IS WHY THAT IS A FACT

`git diff --name-only` over this item's four commits touches **no** file under
`docs/design/command-center-v7/`, **no** `components/admin/v7/*`, **not**
`app/styles/command-center-v7.generated.css`, **not** `SCREEN_MANIFEST.json`,
**nothing** under `tests/visual/`, and **not** `middleware.ts`.

The three live screens whose bodies did change all **early-return their V7
component in fixture mode**, which is the only mode the pixel gate renders:
`app/admin/command-center/job/[id]/page.tsx` returns `<V7Job>` at line 119 and
mounts `JobActionPanel` only on the live path at 405;
`app/admin/settings/page.tsx` returns `<V7Settings>` at 119 and renders the
body this item edited only below it. So the edits are outside what rule #34's
gate measures by construction, not by hope.

**A correction worth recording, because the first version of the e2e spec was
wrong about it:** `/admin/command-center` mounts `V7Workbench` in **both** live
and fixture mode, fed by `lib/data/v7-view/from-live.ts`, whose rush pill text
is the literal `'RUSH'`. `components/admin/WorkbenchLanes.tsx` spells it
`'Rush'` and is **not** what that route renders. The badge test failed on that
and now matches case-insensitively, since what this item needs is that the badge
is there.

## ELITE STANDARD COMPLIANCE CHECKLIST

| Check | | Evidence |
|---|---|---|
| `tsc --noEmit` clean | **YES** | exit 0, zero errors |
| lint zero warnings on touched files | **PARTIAL** | `pnpm lint` is `next lint`, which has no per-file mode in this repo's setup; `pnpm build` (which runs the full Next.js lint/type pass) exits 0 |
| no TODO/FIXME/placeholder/dead code | **YES** | grep of the 20 changed files: zero `TODO`, `FIXME`, `XXX`, `HACK`, `placeholder` |
| tests pass (counts) | **YES** | vitest **580 passed, 1 failed** — the 1 is pre-existing, see below. Playwright `rush-order.spec.ts` **9/9** |
| coverage on new code ≥80% (measured) | **NO — NOT MEASURABLE** | `@vitest/coverage-v8` is not installed and `vitest.config.mts` configures no provider. Installing one is a dependency change outside this item. Reported as unavailable with the per-file counts in its place rather than estimated |
| edge cases null/empty/boundary/error tested | **YES** | empty policy, blank value, negative value, NaN/Infinity subtotal, 0 bp, 100%, 1000%, half-cent rounding, 0 pieces, malformed date, past date, Friday→Monday, leap day, month boundary |
| assertions exact with messages | **YES** | every `expect` in the three new/extended test files carries a diagnostic naming expected vs actual and why it matters |
| APIs authenticated, scoped, RLS present, leak test | **YES / N-A** | `POST /api/admin/rush-policy` is 401→403→400 gated and `rush_policies` is `is_admin()`-only with no customer policy. **No cross-company leak test, because the table has no `company_id` by design** — it is AFS back-office config like `price_book_items`, so there is no tenant boundary on it to leak across |
| no hardcoded business values | **YES** | zero surcharge figures, zero lead times, zero seed rows. Every number in the tests is a declared fixture |
| migrations additive and reversible | **YES** | 039 only adds; DOWN SQL in the file and in SCHEMA.md |
| governance files updated | **YES** | this entry, SESSION_STATE.md, SCHEMA.md, queue.yaml |
| item marked UNVERIFIED pending human browser confirmation | **YES** | stated at the top |

## GATES, ALL RUN IN THIS SESSION

```
pnpm tsc --noEmit                exit 0, zero errors
pnpm test:unit                   580 passed, 1 failed (32 files)
  new/extended in this item      business-days 43 · rush-policy 76
pnpm build                       exit 0, with the full prebuild chain
node scripts/audit/contrast-check.mjs
                                 PASS — 25 screens · 261 pairs ·
                                 0 unresolved · 0 below threshold
                                 (/admin/settings/rush-policy is now IN the
                                 gate automatically, at worst 3.11:1)
pnpm exec playwright test tests/e2e/rush-order.spec.ts
                                 9 passed
```

**THE ONE FAILING UNIT TEST IS PRE-EXISTING, AND IT IS A WINDOWS LINE-ENDING
ARTEFACT — NOT STALE CSS.** `lib/design/v7-css.test.ts` reported
*"app/styles/command-center-v7.generated.css is stale. Run `pnpm css:v7`"* on a
**clean tree, before any edit in this run**. It was then diagnosed rather than
worked around: running `pnpm css:v7` produces a file whose `git diff` is
**empty** — the content is byte-identical and only the line endings differ. The
committed file has **1081 CRLF and 0 LF-only** line endings, this worktree has
`core.autocrlf=true`, and the generator emits LF, so the test's exact string
comparison can never pass on Windows with that setting. **The committed CSS is
correct and nothing is stale.** The test was left untouched (fixing it means
changing a v7 artefact, a `.gitattributes`, or the test itself — all outside
this item) and is recorded as a finding below.

## PENDING REID — DECISIONS THIS ITEM DELIBERATELY DID NOT MAKE

1. **The surcharge figure and the minimum lead time.** Checklist #36 and #32.
   The table ships empty and nothing in this item writes a value. This is the
   whole reason the item built a mechanism.
2. **Should a requested date inside the minimum lead time REFUSE the quote, or
   warn?** Built as **warn**. If it should refuse, the refusal belongs in
   `send-quote`, not in the pure rule.
3. **`pricing_rules.rush_surcharge_pct` still carries a seeded, invented
   `DEFAULT 0.25`** (migration 001 line 281) on every product row. **Nothing on
   the quote path reads it.** Removing a DEFAULT from a live table is an applied
   migration and was out of scope. The new `rush_policies` does not read it,
   does not replace it, and is not derived from it.
4. **`/admin/settings/price-book` and `/admin/settings/rush-policy` are both
   LIGHT working areas but neither is listed in
   `lib/data/admin-working-area.ts`'s `LIGHT_WORKING_AREA_SCREENS`.** The
   price-book omission is pre-existing. Adding them would change an
   exact-equality assertion in `lib/data/workbench.test.ts` **and** add two
   routes to `tests/e2e/contrast-live.spec.ts`, which measures against alpha and
   could not be run tonight — so nothing was changed and the gap is recorded
   instead. Rule #18 wants that list to be the answer to "which screens are
   light", so it is worth closing deliberately.
5. **Three SPEC_RUSH_ORDER.md items still unbuilt, each for a stated reason:**
   the admin "🔴 RUSH Quote Request" notification email (§2 — there is still no
   admin notification email at all on the intake route, rush or otherwise;
   building one is a notifications item and would be the only outbound-mail
   change in a run forbidden from sending mail); `StatusAdvancer`'s rush banner
   (§3 — the order detail page already badges rush in its header, so this is
   cosmetic on a pre-v7 screen); and a rush-only filter tab on the production
   queue (§3's last line — the queue already pins rush to the top and badges
   every row).

## UNRELATED FINDINGS, RECORDED NOT FIXED

- **`lib/design/v7-css.test.ts` cannot pass on Windows with
  `core.autocrlf=true`.** Diagnosed above. The committed CSS is byte-identical
  to what the generator produces. A `.gitattributes` entry forcing LF on that
  one file, or normalising both sides in the test, would fix it.
- **The intake route stores `requestedDelivery` verbatim into a `DATE`
  column** with no format validation, so a malformed string from any client
  produces a 500 rather than a 400. Pre-existing (FlashDraft has sent this field
  since migration 019). The new date input is `type="date"`, and
  `evaluateRushLeadTime` treats an unusable date as "no date" rather than
  throwing, so nothing downstream of this item is exposed — but the route itself
  should validate.
