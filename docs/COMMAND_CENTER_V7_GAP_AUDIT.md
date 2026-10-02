# COMMAND_CENTER_V7_GAP_AUDIT.md
## Prototype v7 vs. the live app — gap audit and phased build plan

**Branch `command-center-v7`, cut from `main` at `256eca1`. 2026-10-01.
READ-ONLY audit — no application code was changed in this run.**

**Prototype:** `ARCHITECTURAL FLASHING SUPPLY WEBSITE\cc-compare\Claude outputs\AFS_Command_Center_Prototype_v7.html`
(2,225 lines, 303 KB, modified 2026-10-01 18:06). *Note: the brief gave the path
without the `Claude outputs\` subfolder; this is the file that exists.*

v7 routes, from its own `render()` dispatcher (line 1207): `workbench`, `job`,
`source`, `shop`, `op`, `deliveries`, `search`, `quotes`, `orders`, `newquote`,
`customers`, `pricing`, `settings`.

---

## ✔ RESOLVED 2026-10-01 — THE ADDRESS, AND WHICH SPELLING WON

This audit originally flagged v7 line 850
(`var TRICIA = 'trica@architecturalflashingsupply.com';`) as a misspelling,
because three governance records said so.

**Reid reversed that on 2026-10-01: `trica@` is the real mailbox.** The v7
prototype was right all along, and the 2026-09-30 decision — which had rewritten
31 occurrences across code, docs and tests to `tricia@` — was the error.

Phase 0 of this build put all 31 back to `trica@` and rewrote the stale prose in
`lib/data/office.ts`, `docs/COMMAND_CENTER_V2_SPEC.md` and `CLAUDE.md` so none of
them still calls `trica` a misspelling. The address is still named **once**, in
`lib/data/office.ts`; everything else reads `officeInvoiceEmail()` and never a
literal. Owner question #1 below is therefore closed.

---

## (a) STATUS TABLE

Legend: **Built** = works as v7 describes · **Partial** = some of it exists ·
**Different** = exists but behaves differently · **Missing** = no code at all.
Every Built/Partial/Different claim carries a file path.

### 1. Header: nav, "+ New quote", type-ahead search — **BUILT (v7 Phase 2, 2026-10-01)**

> Built on branch `command-center-v7`. Nav is the seven v7 items in order
> (`lib/data/admin-nav.ts` `TOP_LEVEL_NAV`), Credit Applications and Bid Monitor
> moved to `MORE_NAV`, the red "+ New quote" button is in
> `components/layout/AdminTopBar.tsx` on every admin page pointing at
> `NEW_QUOTE_HREF`, and the type-ahead is
> `app/api/admin/command-center/typeahead/route.ts` +
> `lib/data/header-typeahead.ts` (companies first, then token-AND job rows).
> Verified by `tests/e2e/command-center-v7-nav.spec.ts` and
> `tests/e2e/phase2-fidelity.spec.ts`. Original audit below.

#### Original audit

| Piece | Status | Evidence |
|---|---|---|
| Header shell, dark, with nav | Built | `components/layout/AdminTopBar.tsx`; `lib/data/admin-nav.ts` |
| Workbench / Shop View / Deliveries in nav | Built | `lib/data/admin-nav.ts` `TOP_LEVEL_NAV` |
| Customers, Settings | Partial — live has them under **More**, v7 has Customers top-level | `lib/data/admin-nav.ts` `MORE_NAV` |
| **Quotes** in nav | Missing — no `/admin/quotes` route exists at all | — |
| **Orders** in nav | Partial — page exists but is **not linked** | `app/admin/orders/page.tsx` (96 lines); absent from `admin-nav.ts` |
| **Pricing** in nav | Partial — page exists but is **not linked** | `app/admin/pricing/page.tsx` (69 lines); absent from `admin-nav.ts` |
| **"+ New quote" button** | Missing | no match for `New quote` in `app/admin/**`, `components/admin/**` |
| Header search | Partial — a **submit** form that navigates to `/admin/search`, not a type-ahead dropdown | `components/layout/AdminTopBar.tsx:141` (`role="search"`, `handleSearchSubmit` :88) |
| Type-ahead, company first then profile words | Missing | v7 builds a `#hsd` dropdown (CSS :756); live has no equivalent |

**Supports it today:** `lib/data/admin-nav.ts` (+ `admin-nav.test.ts`),
`app/api/admin/command-center/profile-search/route.ts`, `admin_profile_search`
(migrations 029/038).
**Needs:** one new route `/admin/quotes`; a type-ahead API that returns customers
*and* profiles. **No migration. Not Microsoft-dependent.**

### 2. Separate Quotes and Orders lists (search, stage, date, sort) — **BUILT (v7 Phase 2, 2026-10-01)**

> `app/admin/quotes/page.tsx` (new) and `app/admin/orders/page.tsx` (rebuilt),
> both rendering one shared `components/admin/QuoteOrderList.tsx`, over
> `lib/data/quote-order-rows.ts` with pure filter/sort/match in
> `lib/data/quote-order-list.ts` (32 unit tests). Stage, date and sort options
> are asserted character-for-character against the prototype by
> `tests/e2e/phase2-fidelity.spec.ts`. **No schema change was needed** — the
> quote total comes from the existing `quote_requests.quote_id -> quotes.total_cents`.
> Original audit below.

#### Original audit

| Piece | Status | Evidence |
|---|---|---|
| Orders list | Partial | `app/admin/orders/page.tsx`, `lib/data/orders.ts`, `components/admin/OrdersCrmTab.tsx` |
| Sort controls | Built | `components/admin/SortControls.tsx` |
| Quotes list | **Missing** — no route; `lib/data/quotes.ts` is data only | `lib/data/quotes.ts` exists, no page consumes it as a list |
| Stage + date-range filters | Missing on both | v7 `LSTAGES`/`RANGES`/`SORTS` (line 1736-1739) have no live counterpart |

**Needs:** `/admin/quotes` page + a shared list component; filter params on both.
**No migration. Not Microsoft-dependent.**

### 3. New quote page, customer-first — **MISSING**

No route, no component. v7's `pageNewQuote()` (line 1761) is: find-a-customer,
recent customers with last-order date, **reorder last order**, saved profile
cards, draw-new-in-FlashDraft, new-customer form.

**Supports it today:** `lib/data/customers.ts`, `components/admin/CustomersCrmTab.tsx`,
`lib/data/profile-passport.ts`, the FlashDraft handoff
(`afs-flashdraft-canonical-points` + `/studio/draft?loadCanonical=1`,
`components/studio/CanonicalProfileBrowser.tsx`), `components/admin/LazyProfileThumb.tsx`.
**Needs:** one page, one "recent customers + last order" query, a reorder action
that clones a past quote's line items. **No migration. Not Microsoft-dependent.**

### 4. Search page over all past quotes and orders — **PARTIAL; the Orders/Quotes half is now BUILT**

> v7 Phase 2 delivered searching over quotes and orders as the two LIST pages
> (`/admin/quotes`, `/admin/orders`), each with v7's search, stage, date and
> sort. What remains is the dedicated `/admin/search` PAGE, which still searches
> profiles only, and the Reorder button. Original audit below.

#### Original audit

| Piece | Status | Evidence |
|---|---|---|
| Search page | Built | `app/admin/search/page.tsx` (55 lines) |
| Panel with material filter + shortcuts | Built | `components/admin/ProfileSearchPanel.tsx:423-428` (material), `:163` (shortcuts) |
| Scope | **Different** — searches **profiles**, not quotes and orders | `admin_profile_search` (migration 029, extended 038) |
| Date filter, sort, **Reorder** button | Missing | no counterpart to v7 `pageSearch()` (line 1667) |

**Needs:** either widen `admin_profile_search` or add a sibling query over
`quotes` + `orders`. CLAUDE.md rule #27 says **one** profile search — so this must
be a *separate* quote/order query, not a second profile function.
**Migration: likely one new SQL function. Not Microsoft-dependent.**

### 5. Deliveries split view + tracking map — **PARTIAL**

| Piece | Status | Evidence |
|---|---|---|
| Schedule list, by day, with windows | Built | `app/admin/deliveries/page.tsx`, `components/admin/DeliveriesWeek.tsx` |
| Scheduling / reschedule / mark delivered | Built | `lib/delivery/business-days.ts`, `lib/delivery/windows.ts`, `app/api/admin/command-center/mark-delivered/route.ts` |
| **Tracking map** | **Missing** — `DeliveriesWeek.tsx` has no map; every `map` hit is `Array.map` | grep: only `.map(` at :60,:124,:135,:161,:203 |
| Split view, each half expandable to full page | Missing | v7 `S.dv.full` + `mapSVG()` (line ~1800) |

**Supports it today:** driver position already exists —
`app/api/driver/location/route.ts`, `lib/delivery/tracking-url.ts`,
`driver_locations` table. The homepage already draws a real map
(`components/home/NationwideMapLeaflet.tsx`), so the technique is in-repo.
**Needs:** a map component + stop coordinates. **Geocoding is an open question
(see §d). Not Microsoft-dependent.**

### 6. Estimate emailed to Tricia when a quote is sent — **MISSING**

`app/api/admin/command-center/send-quote/route.ts` contains **no reference** to
`officeInvoiceEmail`, the office, or Tricia. It builds the single-use Approve
link, emails the customer, and moves the job to Quoted (file header, lines 12-14).

**Supports it today:** `lib/data/office.ts` (`officeInvoiceEmail()`),
`lib/email/outbound.ts` (`sendTrackedEmail`, `outbound_emails`, the `E2E-TEST-`
capture rule), `lib/resend/templates/base.ts`.
**Needs:** one extra send inside that route, plus a "pending approval" marker so
Tricia's copy can move pending → approved (v7 lines 1390, 1398).
**Migration: a small status column or an `outbound_emails` convention.
NOT Microsoft-dependent — this is Resend, which already works.**

### 7. Invoice on shop-finish + reconciliation to Tricia — **DIFFERENT (important)**

| Piece | Status | Evidence |
|---|---|---|
| Invoice **row created** | **Different** — created at **customer approval**, not at shop-finish | `app/api/quote-approve/[token]/route.ts:210` → `lib/invoices/create.ts` |
| Office copy of the invoice | Built | `lib/invoices/create.ts:23,77` (`officeInvoiceEmail()`) |
| Invoice **emailed to customer** at shop-finish | Built | `lib/utils/shop-job-completion.ts:134` → `lib/utils/invoice-email.ts` |
| **Reconciliation** (estimate vs final + difference) to Tricia at that moment | **Missing** | no `reconcil*` anywhere in `app/`, `lib/`, `components/`; `lib/utils/invoice-email.ts` has no office copy |

So the live app already invoices and already copies the office — but **at a
different moment from v7**, and with **no reconciliation**. v7 (line 1504, 2106)
expects: at shop-finish, customer gets the invoice **and** Tricia gets final +
estimate + difference, explained by any changes or addenda.

**This is a decision, not just a gap — see §d question 2.**
**Not Microsoft-dependent.**

### 8. Change order before the machine — **MISSING**

Zero matches for `change_order` / `changeOrder` in `app/`, `lib/`, `components/`.
`lib/data/quotes.ts` has no revision/version concept.

v7 (lines 1931, 2028-2030) does: re-quote, **revised quote v2** emailed with a
**new Approve link**, **earlier approval void**, job back to **Quoted**, revised
estimate to Tricia.

**Supports it today:** the whole approve-token machinery —
`app/api/quote-approve/[token]/route.ts` (HMAC, single-use via a conditional
`UPDATE ... WHERE used_at IS NULL`, expiring, hash-only storage);
`app/api/admin/command-center/send-quote/route.ts`;
`app/api/admin/command-center/request-changes/route.ts` (**a different feature** —
admin asking the customer for changes).
**Needs:** `quotes.revision` + supersede/void semantics + a new route.
**Migration: yes. Not Microsoft-dependent.**
**Safety note:** CLAUDE.md rule #14 — voiding an approval must not strand a job
whose approval the single-door guard already read.

### 9. Addendum after the job started — **MISSING**

Zero matches for `addendum` anywhere in `app/`, `lib/`, `components/`.

v7 (lines 1938-1942, 2038-2044, 1860) does: addendum **A1** on the same job,
customer approval, **shop note "do not run it yet"**, its **own invoice line**,
and it feeds the reconciliation.

**Needs:** an `addenda` table (or a typed `quote_revisions` row), a customer
approval link reusing the token machinery, a shop-visible flag on
`shop_profile_library` / the shop queue, and an invoice line type.
**Migration: yes. Not Microsoft-dependent.**

### 10. Workbench cards, flag pills, stage panes, one red, light theme — **PARTIAL**

| Piece | Status | Evidence |
|---|---|---|
| Five lanes, newest-first, Done auto-archive | Built | `lib/data/workbench.ts` (header lines 2-21), `lib/data/workbench.test.ts` |
| Summary chips above the lanes | Built | `lib/data/workbench.ts:295,305` |
| Job card | Built | `components/admin/CommandCenterJobCard.tsx` |
| **Flag pills** | **Partial — exactly ONE** (`RUSH`) | `CommandCenterJobCard.tsx:112` (`job.isRush`) |
| Stage-specific action pane | Built | `components/admin/JobActionPanel.tsx`, `lib/data/job-screen.ts` |
| Light working area + dark header | Built | `components/admin/LightWorkingArea.tsx`, `lib/data/admin-working-area.ts` (5 screens listed) |
| One red action colour | Built, and enforced | `tailwind.config.js` `afs-crimson`; contrast gate `scripts/audit/contrast-check.mjs` (prebuild) |

v7 pills the live card does not have (`flagPills`, line 1705): **Revised v2**,
**Addendum waiting**, plus profile-state pills. Those depend on items 8 and 9.
**No migration for the pills themselves. Not Microsoft-dependent.**

---

### Condensed

| # | Feature | Status |
|---|---|---|
| 1 | Header nav + New quote + type-ahead | **Partial** |
| 2 | Quotes & Orders lists | **Partial** (Orders unlinked; Quotes absent) |
| 3 | New quote page | **Missing** |
| 4 | Search over quotes & orders | **Partial** (searches profiles) |
| 5 | Deliveries split + map | **Partial** (list built, no map) |
| 6 | Estimate → Tricia on quote send | **Missing** |
| 7 | Invoice on finish + reconciliation | **Different** + reconciliation missing |
| 8 | Change order before machine | **Missing** |
| 9 | Addendum after start | **Missing** |
| 10 | Cards, pills, panes, theme | **Partial** (1 of N pills) |

---

## (b) PHASED BUILD PLAN

Ordered by value to Steve (gets work moving) and Tricia (gets the money right).
Each phase is sized to **one Claude Code run of roughly 1-2 hours**. Phases 1-2
are two days' work; 3-5 are the follow-on.

### Phase 1 — Tricia's money trail (highest value, no new UI)
**Why first:** it is the only gap where the business is currently *missing
information it is supposed to have*, and it needs no new screens.
- **Files:** `app/api/admin/command-center/send-quote/route.ts`,
  `lib/utils/invoice-email.ts`, `lib/utils/shop-job-completion.ts`,
  `lib/invoices/reconciliation.ts` *(new)*, `lib/data/office.ts` (read only).
- **Schema:** one migration — an estimate-sent marker (`quotes.estimate_sent_at`,
  `quotes.estimate_office_status`) so Tricia's copy can move pending → approved.
- **Tests:** unit on the reconciliation maths (estimate vs final vs difference,
  including the no-difference case); e2e that a sent quote writes an
  `outbound_emails` row addressed to `officeInvoiceEmail()`; the `E2E-TEST-`
  prefix must still capture rather than send (rule #21).
- **Risks:** live money. Must use `officeInvoiceEmail()`, never a literal — and
  **never v7's misspelling**. Double-send on retry; guard the same way
  `invoices.quote_id UNIQUE` already guards double-billing.

### Phase 2 — Quotes list, Orders in the nav, and the header
**Why second:** Steve's daily navigation; cheap, visible, zero schema.
- **Files:** `lib/data/admin-nav.ts` (+ its test), `components/layout/AdminTopBar.tsx`,
  `app/admin/quotes/page.tsx` *(new)*, `app/admin/orders/page.tsx`,
  `components/admin/QuoteOrderList.tsx` *(new, shared)`, `lib/data/quotes.ts`,
  `lib/data/orders.ts`.
- **Schema:** none.
- **Tests:** `admin-nav.test.ts` updated for the new entries; e2e that both lists
  filter by stage/date and sort; the contrast gate (rule #28) picks up the new
  screens automatically — do not add a skip list.
- **Risks:** low. Watch that adding screens to `admin-working-area.ts` keeps the
  light/dark theming consistent, or the build gate will fail (correctly).

### Phase 3 — New quote, customer-first (incl. reorder)
**Why third:** the biggest single time-saver for Steve on repeat business.
- **Files:** `app/admin/quotes/new/page.tsx` *(new)*,
  `components/admin/NewQuoteCustomerPicker.tsx` *(new)*,
  `lib/data/customers.ts`, `lib/data/profile-passport.ts`,
  `lib/data/new-quote.ts` *(new — recent customers + last order)*.
- **Schema:** none expected (reads existing tables).
- **Tests:** unit on "recent customers, newest order first"; e2e that Reorder
  clones the previous line items and lands on a draft quote; e2e that
  Draw-in-FlashDraft uses the **existing** handoff and does not invent a route.
- **Risks:** the FlashDraft handoff is load-bearing (rule #13/#27) — reuse
  `afs-flashdraft-canonical-points`, do not add a second key.

### Phase 4 — Change orders before the machine
**Why fourth:** correctness-critical and it unlocks two of the missing pills.
- **Files:** `app/api/admin/command-center/revise-quote/route.ts` *(new)*,
  `lib/data/quotes.ts`, `components/admin/JobActionPanel.tsx`,
  `components/admin/CommandCenterJobCard.tsx` (the "Revised v2" pill).
- **Schema:** migration — `quotes.revision int NOT NULL DEFAULT 1`,
  `quotes.superseded_by uuid`, and an approval-void marker.
- **Tests:** the old Approve token must be **dead** after a revision (assert the
  old link 4xx/expired); job returns to `quoted`; a revised estimate reaches
  Tricia; append-only ledger still refuses updates (rule #20).
- **Risks:** **highest in this plan.** Rule #14 — the single-door guard reads
  `status='submitted'` + an approval record. Voiding an approval must not let a
  job reach catalog 20115 on a stale approval, nor strand one mid-flight. The
  static single-door test must stay green and the new route must **not** be added
  to its allow-list.

### Phase 5 — Addenda after the job started
**Why fifth:** depends on Phase 4's revision model and Phase 1's reconciliation.
- **Files:** `app/api/admin/command-center/addendum/route.ts` *(new)*,
  `lib/data/addenda.ts` *(new)*, `components/admin/JobActionPanel.tsx`,
  `lib/data/shop-queue.ts` (the shop's "do not run yet" note),
  `lib/invoices/create.ts` (the extra line).
- **Schema:** migration — `addenda` table (job, number `A1…`, text, qty, unit
  cents, approval state, approved_at).
- **Tests:** an unapproved addendum must **not** appear on an invoice; the shop
  queue shows the hold note; the reconciliation explains the difference.
- **Risks:** an addendum that reaches the machine before the customer approves
  it. The shop-visible flag and the single-door guard both have to agree.

### Phase 6 — Deliveries map + split view
**Why last:** genuinely useful but the schedule list already works, so it is the
least urgent, and it carries an unanswered data question (§d).
- **Files:** `app/admin/deliveries/page.tsx`, `components/admin/DeliveriesWeek.tsx`,
  `components/admin/DeliveryRouteMap.tsx` *(new)*, `lib/delivery/tracking-url.ts`.
- **Schema:** possibly `deliveries.lat/lng` (or a geocode cache) — see §d.
- **Tests:** stop order matches the window order; a day with no stops renders
  empty rather than crashing; map is not fetched on a hidden tab (rule #26).
- **Risks:** the homepage map is Leaflet with a **static local** GeoJSON and no
  runtime dependency (rule #11). Do not introduce a paid tile or geocoding
  dependency without Reid's sign-off.

---

## (c) BLOCKED ON MICROSOFT (tenant separation, 2026-10-02)

Only **one** v7 feature is Microsoft-dependent, and it is **not** in the ten
audited items:

- **The Workbench "Email inbox" rail** — v7 `railPanels()` renders
  *"Connected to Outlook · read 20 sec ago"*, an inbox list, and a **Check now**
  button, with per-message actions (Draft quote / Apply / Log it). That needs
  Microsoft Graph and the inbound mail parser. `docs/COMMAND_CENTER_V2_SPEC.md`
  §2.4 records there is **no Graph code at all** in the repo, and spec Phase 4 is
  deferred pending the Entra app registration and admin consent.
- The v7 header counter that includes "N new emails" depends on the same rail.

**Everything else is clear of Microsoft.** Items 6, 7, 8 and 9 all send through
**Resend**, which is already wired (`lib/email/outbound.ts`, `lib/resend/send.ts`,
`outbound_emails`). None of Phases 1-6 above touches Graph, and none of them
should be delayed for 2026-10-02.

---

## (d) OPEN QUESTIONS — OWNER ONLY

1. ~~**Tricia's address in v7 is misspelled.**~~ **CLOSED 2026-10-01.** The
   opposite was true: `trica@` is the real mailbox and v7 was correct. All 31
   occurrences were reverted in Phase 0 of this build. See the banner at the top
   of this document.
2. **When should the invoice be created — at customer approval (live today) or at
   shop-finish (v7)?** These are different moments and they bill differently if a
   change or addendum lands in between. The live behaviour was deliberate
   (rule #21: the quote *becomes* the invoice with no retyping). Changing it is a
   money decision, not a UI one.
3. **Does Tricia's "pending approval" step gate anything?** In v7 her estimate
   copy moves pending → approved, but nothing waits on it. Is her approval
   advisory, or must a quote not go to the customer until she has approved it?
4. **Addendum pricing authority** — can Steve set an addendum's unit price freely,
   or must it come from the price book (rule #19, which refuses a quote built on
   an unset price)?
5. **Change order after the machine has started but before bending** — v7 splits
   at "before the machine". The real boundary in the live system is the
   single-door approval (rule #14). Which moment is the cutover in the shop's
   eyes?
6. **Deliveries map** — v7 uses hardcoded demo coordinates per customer. Real
   stops need geocoding. Is there an existing address source we should use, and
   is a geocoding call acceptable, or should the map stay schematic?
7. **Should Customers be promoted to top-level nav** (v7) or stay under More
   (live)? And should Credit Applications / Bid Monitor — which v7 has no
   equivalent for — remain in More?
8. **Is `/admin/pricing` meant to be Steve-facing?** It exists and is unlinked.
   v7 puts Pricing in the main nav. Customers must never see pricing (rule #1);
   confirm this is admin-only by intent.

---

*docs/COMMAND_CENTER_V7_GAP_AUDIT.md · branch `command-center-v7` · 2026-10-01 ·
read-only audit, no application code changed.*
