# RUSH_ORDER_AUDIT.md
## AFS — Rush Order Flag: Entry → Storage → Machine Bridge → Command Center UI
**Audit only. No application code changed.**

Read in full: `specs/SPEC_RUSH_ORDER.md`, `app/quote/page.tsx`,
`app/api/quote-requests/route.ts`, `SCHEMA.md`'s `quote_requests`/
`machine_jobs` definitions, and every `is_rush`/`isRush` reference in
`app/admin/command-center/**`, `components/admin/**`,
`app/admin/quote-requests/**`, `app/admin/orders/**`,
`app/account/orders/[id]/page.tsx`, `app/account/quotes/[id]/page.tsx`,
`app/configure/page.tsx`, `app/studio/draft/page.tsx`, `lib/data/orders.ts`,
`lib/data/admin.ts`, `lib/data/pending-quote-requests.ts`,
`lib/data/machine-jobs.ts`, `lib/data/command-center-crm.ts`,
`lib/data/command-center-dashboard.ts`, `lib/admin/pricing.ts`, and
`components/admin/QuoteEstimatorForm.tsx`.

---

## VERDICT — SHORT ANSWER

| Question | Answer |
|---|---|
| Does the quote wizard let a customer flag rush? | **Only one of the three entry points SPEC_RUSH_ORDER.md §1 requires.** `/quote` has a real toggle. `/configure` and `/studio/draft` (FlashDraft) both hardcode `isRush: false` with no UI control at all. |
| Does the flag reach `quote_requests.is_rush` correctly? | **Yes**, for any caller that actually sends `isRush: true` — the API route persists it verbatim. |
| Does it reach `machine_jobs.is_rush` on approval? | **Yes.** The one route that creates `machine_jobs` rows copies it through exactly. |
| Is it visibly surfaced in the Command Center so an admin can prioritize? | **Partially.** RUSH badges exist on the Pending Approval and Sent/Completed job cards, and `/admin/quote-requests` + `/admin/orders` both sort rush-to-top with a highlighted row. But the Command Center's own **default landing dashboard** (`/admin/command-center` with no `?tab`) has **zero rush visibility** — no badge, no sort, no data even threaded through — and neither Command Center machine-queue tab sorts rush to the top the way the two older admin list pages do. |

---

## 1. RUSH FLAG ENTRY POINTS — SPEC §1 vs REALITY

SPEC_RUSH_ORDER.md §1 requires three entry points, all setting
`is_rush = true` on submission:

1. **Quote wizard Step 3** — `app/quote/page.tsx:554-578` has a real
   toggle button (`toggleRush`, `form.rush` state) with a visible
   "Rush requested" / "Standard timeline" label and a review-step summary
   row (`app/quote/page.tsx:676-685`). On submit it sends
   `isRush: form.rush` (`app/quote/page.tsx:252`) to
   `POST /api/quote-requests`. **Works as specced.**

2. **Custom configurator ("Rush toggle in controls panel")** — does not
   exist. `app/configure/page.tsx:327` sends `isRush: false` as a literal
   hardcoded value inside `submitQuoteRequest`. There is no rush-related
   state, checkbox, or toggle anywhere in this file (confirmed by
   searching the whole file for `rush`/`Rush` — the only hit is this one
   hardcoded `false`). **A customer using the configurator can never flag
   a request as rush, and the UI gives no indication this capability is
   missing.**

3. **Drawing tool ("Rush toggle in TakeoffActions area")** — does not
   exist. `app/studio/draft/page.tsx:1985` sends `isRush: false` as a
   literal hardcoded value inside the FlashDraft submit handler. Same
   search result as above — the only `rush` occurrence in this
   ~2000-line file is this one hardcoded `false`. **Same gap as the
   configurator.**

**Net effect:** two of the three documented rush entry points are
silently no-ops. Any customer who builds a rush job through
`/configure` or `/studio/draft` instead of the `/quote` wizard has no way
to communicate urgency to AFS at all — the request is submitted as
standard with no error, warning, or visual cue that rush isn't available
on that path.

---

## 2. DOES THE FLAG REACH `quote_requests.is_rush` CORRECTLY?

Yes, for whichever caller actually sends `isRush: true`.
`app/api/quote-requests/route.ts:101` reads `const isRush = body.isRush
=== true;` (strict boolean coercion — any non-`true` value, including
`undefined`, becomes `false`, which is correct/safe) and
`app/api/quote-requests/route.ts:116` writes it straight into the
`quote_requests` insert as `is_rush: isRush`. No transformation, no loss.
This part of the pipe is correctly wired — the only actual gap is Part 1
above (two of three UIs never send `true` in the first place).

---

## 3. DOES IT REACH `machine_jobs.is_rush` ON APPROVAL?

Yes. The only code path that creates a `machine_jobs` row from a
`quote_requests` row is
`app/api/admin/command-center/approve-quote-request/route.ts` (confirmed
by grep — no other route inserts into `machine_jobs`). It:

- Selects `is_rush` as part of the `quote_requests` row
  (`approve-quote-request/route.ts:167`).
- Copies it straight through on insert:
  `is_rush: qr.is_rush` (`approve-quote-request/route.ts:228`).

`lib/data/machine-jobs.ts:59,160` (`getMachineJobs`) reads
`machine_jobs.is_rush` back out and maps it to `MachineJobRow.isRush`
without alteration. This matches STATE_OF_THE_BUILD.md's afs-mj-001
audit finding — the approval flow is real, single-item-only, and this
one field passes through it untouched. **No gap here.**

---

## 4. IS IT VISIBLY SURFACED IN THE COMMAND CENTER?

This is the mixed answer. Breaking it down by surface:

### Surfaces that show it correctly (with sort-to-top)
- **`/admin/quote-requests`** (`app/admin/quote-requests/page.tsx:106,
  119,134-138`, sourced from `lib/data/admin.ts:147`
  `.order('is_rush', { ascending: false }).order('submitted_at', {
  ascending: true })`) — RUSH badge, red-tinted row, **and rush rows sort
  to the top of the queue**, exactly per SPEC §2.
- **`/admin/quote-requests/[id]`** (`app/admin/quote-requests/[id]/page.tsx:106-108`)
  — RUSH badge next to the status badge.
- **`/admin/orders`** production queue (`lib/data/orders.ts:244,291`
  `.order('is_rush', { ascending: false })`, rendered by
  `components/admin/ProductionQueueTable.tsx:86,101-105`) — RUSH badge,
  red-tinted row, **sorted to top**, exactly per SPEC §3.
- **`/admin/orders/[id]`** (`app/admin/orders/[id]/page.tsx:73-74`) — RUSH
  badge at the top of the order detail header.
- **Command Center KPI stats** (`lib/data/command-center-crm.ts:16-29,50`)
  — a `{N} rush` badge in the day/production/ready-for-pickup/pending
  stat tiles.
- **Customer-facing views** — `app/account/orders/[id]/page.tsx:191` and
  `app/account/quotes/[id]/page.tsx:336-339` both show the customer their
  own rush status. Not in scope for admin prioritization but confirms the
  flag isn't hidden from the customer either.

### Surfaces inside Command Center that show it, but don't prioritize it
- **Pending Approval tab** (`components/admin/PendingQuoteRequestCard.tsx:56`
  shows a `Badge variant="warning"` RUSH tag) — but
  `lib/data/pending-quote-requests.ts:58-63`'s query only has
  `.order('submitted_at', { ascending: false })`, **no `is_rush` sort at
  all**. A rush request sits wherever its submit timestamp puts it, mixed
  in with standard requests, unlike `/admin/quote-requests`'s identical
  underlying data which does sort rush-first.
- **Sent to Machine / Completed tabs** (`components/admin/CommandCenterJobCard.tsx:78`
  shows the same RUSH badge) — `lib/data/machine-jobs.ts:71-78`'s
  `getMachineJobs()` query only has `.order('created_at', { ascending:
  false })`, again **no `is_rush` sort**.

  Net effect: an admin scrolling either Command Center machine-queue tab
  has to read every card's badge to find rush jobs — they are not floated
  to the top the way the spec's language ("always float to top") and the
  older `/admin/orders`/`/admin/quote-requests` pages both already
  establish as the pattern in this codebase.

### Surface with no rush visibility at all
- **The Command Center default landing page** — `/admin/command-center`
  with no `?tab` query param (`app/admin/command-center/page.tsx:72-173`,
  `showDashboard` branch) — is what an admin sees first when they open
  Command Center. It builds a unified `queueItems: QueueItem[]` list from
  both `pendingRequests` and `sentJobs`
  (`app/admin/command-center/page.tsx:84-107`), but the `QueueItem`
  interface itself
  (`components/admin/CommandCenterDashboard.tsx:18-26`) has **no
  `isRush` field** — `id`, `kind`, `requestNumber`, `customerName`,
  `profileName`, `status`, `submittedAt` only. The mapping code at
  `app/admin/command-center/page.tsx:85-107` has `r.isRush`/`j.isRush`
  available on the source objects and simply never copies it over. A
  full-file search of `components/admin/CommandCenterDashboard.tsx`
  confirms zero occurrences of "rush" anywhere — not in the type, not in
  the rendered JSX. The same applies to the dashboard's other
  quote-request feed, `getRecentQuoteRequests()`
  (`lib/data/command-center-dashboard.ts` — zero `rush`/`is_rush`
  matches).

  **This is the sharpest gap in the audit: the one screen designed as
  the "at-a-glance" admin landing view cannot show a rush job at all,
  even though every other list-based admin surface in the app can.**

---

## 5. TWO RELATED SPEC ITEMS THAT ARE ENTIRELY UNBUILT (found while tracing this flow)

Not part of the four questions this task asked, but discovered directly
while reading the cited files and worth flagging since they're both
inside SPEC_RUSH_ORDER.md:

- **§2 "Admin notified immediately via email (subject: 🔴 RUSH Quote
  Request)"** — `app/api/quote-requests/route.ts` sends exactly one
  email on submission, a **customer** confirmation
  (`app/api/quote-requests/route.ts:139-160`, subject "We've Received
  Your Quote Request..."). There is no admin-facing notification email at
  all on this route — rush or otherwise (a plain "New Quote Request"
  admin email is also specced elsewhere, in SPEC_QUOTE_BUILDER.md, and is
  equally absent). An admin only ever learns about a new rush request by
  opening `/admin/quote-requests` or Command Center themselves.
- **§3 StatusAdvancer rush context ("⚠ RUSH ORDER — Priority scheduling
  required")** — `components/admin/StatusAdvancer.tsx` (full file read)
  has no rush-related text, prop, or conditional anywhere. The order
  detail page it lives on does show a RUSH badge elsewhere in the header
  (`app/admin/orders/[id]/page.tsx:73-74`), so the information reaches
  the page, just not into this specific component as specced.
- **§4 rush surcharge** — confirmed genuinely `BLOCKED` per the spec's
  own header (checklist #36, surcharge % not received) and per
  DATA BLOCKERS in CLAUDE.md — not treated as a gap. Noting for
  completeness: `rush_surcharge_pct` exists only in `pricing_rules`
  (schema + `PricingRulesEditorTable.tsx`) and `orders`/`quotes` both
  carry a `rush_surcharge` column that's displayed if non-zero
  (`components/admin/OrdersCrmTab.tsx:133-139`,
  `app/admin/orders/[id]/page.tsx:228-233`,
  `app/account/quotes/[id]/page.tsx:190-193`) — but nothing ever writes a
  non-zero value into it. `components/admin/QuoteEstimatorForm.tsx` (full
  file read) has zero rush-related fields, inputs, or logic — the
  estimator that turns a `quote_requests` row into a formal `quotes` row
  never sees or applies `is_rush` at all, manually or automatically. This
  is consistent with the spec's own "BLOCKED" framing, so it is not
  scored as a defect above, only recorded here as the actual current
  state.

---

## 6. WHAT THE NEXT PROMPT SHOULD BUILD

In priority order, scoped tightly to what this audit actually found —
not a redesign:

1. **Add rush toggles to `/configure` and `/studio/draft`.** Mirror
   `app/quote/page.tsx`'s `toggleRush`/`form.rush` pattern (state +
   toggle button + review-step display) in both files, and replace each
   file's hardcoded `isRush: false` (`app/configure/page.tsx:327`,
   `app/studio/draft/page.tsx:1985`) with the real state value. This is
   the highest-priority fix — it's the only one where the feature is
   completely inaccessible to a customer, not just under-surfaced to an
   admin.
2. **Sort rush-to-top in both Command Center machine-queue tabs.** Add
   `.order('is_rush', { ascending: false })` before the existing
   timestamp `.order(...)` in `lib/data/pending-quote-requests.ts:58-63`
   and `lib/data/machine-jobs.ts:71-78`'s `getMachineJobs()`, matching
   the pattern already proven in `lib/data/admin.ts:147` and
   `lib/data/orders.ts:244,291`.
3. **Thread `isRush` into the Command Center dashboard's `QueueItem`.**
   Add `isRush: boolean` to
   `components/admin/CommandCenterDashboard.tsx:18-26`'s `QueueItem`
   interface, populate it from `r.isRush`/`j.isRush` in
   `app/admin/command-center/page.tsx:85-107`'s mapping, sort the merged
   `queueItems` array rush-first before the existing `submittedAt` sort
   (`app/admin/command-center/page.tsx:107`), and render a RUSH badge in
   whatever component renders each `QueueItem` row inside
   `CommandCenterDashboard.tsx`. Do the equivalent for
   `getRecentQuoteRequests()` in `lib/data/command-center-dashboard.ts` if
   that widget is meant to carry the same signal.
4. **(Smaller, optional) Admin rush-request notification email** and
   **(smaller, optional) StatusAdvancer rush banner** — both real spec
   gaps per §5 above, but lower urgency since the information is already
   visible elsewhere on the same pages; bundle only if the next prompt is
   scoped as a general SPEC_RUSH_ORDER.md completion pass rather than
   just the Command Center visibility gap this task was asked about.

Do **not** bundle the rush-surcharge pricing engine (§4/§5 above) into
this work — it is correctly blocked on missing business data per
CLAUDE.md's DATA BLOCKERS table, not a code defect.

---

*RUSH_ORDER_AUDIT.md | AFS | audit only, no code changed | 2026-07-31*
