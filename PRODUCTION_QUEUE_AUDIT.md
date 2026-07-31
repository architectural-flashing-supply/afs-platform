# PRODUCTION_QUEUE_AUDIT.md
## Production Queue + Production Timeline — real data vs. UI shell
**Investigation only — no other files modified.**
**Files read in full:** `specs/SPEC_PRODUCTION_QUEUE.md`, `specs/SPEC_PRODUCTION_TIMELINE.md`,
`components/admin/ProductionQueueTable.tsx`, `components/admin/ProductionQueueRealtime.tsx`,
`components/account/ProductionTimeline.tsx`, `lib/admin/orderStages.ts`, plus every file
those six import from or are imported by (`app/admin/orders/page.tsx`,
`app/admin/orders/[id]/page.tsx`, `app/api/admin/orders/[id]/status/route.ts`,
`app/api/admin/orders/[id]/photos/route.ts`, `components/admin/StatusAdvancer.tsx`,
`components/admin/QuickAdvanceButton.tsx`, `app/account/orders/[id]/page.tsx`,
`lib/data/orders.ts`, `lib/data/machine-jobs.ts`, `app/track/[orderId]/page.tsx`,
`supabase/migrations/007_delivery_tracking.sql`).

---

## 1. WHAT'S REAL — wired end to end, no mocks

- **`getProductionQueue()` / `getProductionQueueCounts()`** (`lib/data/orders.ts:235-322`) —
  real Supabase query against `orders` joined to `profiles` and `order_line_items`, real
  rush-first/oldest-first sort, real per-tab filtering via `ACTIVE_ORDER_STATUSES`. No mock data.
- **`ProductionQueueTable`** renders exactly these rows; `QuickAdvanceButton`
  (`components/admin/QuickAdvanceButton.tsx`) `PATCH`es
  `app/api/admin/orders/[id]/status/route.ts`, which is a real, fully-wired handler: updates
  `orders.status`, inserts `order_status_history`, sends a real Resend email through
  `sendEmail()` for stages in `NOTIFICATION_STAGES`, inserts a `notifications` row, and calls
  `logAdminAction()` for `admin_audit_log` — all six of SPEC_PRODUCTION_QUEUE.md §4's claimed
  side effects are real (route.ts:65-135).
- **`ProductionQueueRealtime`** (`components/admin/ProductionQueueRealtime.tsx:12-30`) — a real
  Supabase Realtime subscription (`postgres_changes` on `orders` `UPDATE`) that calls
  `router.refresh()`, not a fake/simulated listener.
- **`StatusAdvancer`** (`components/admin/StatusAdvancer.tsx`) on `/admin/orders/[id]` — both
  the one-click "Advance to next stage" path and the manual-override dropdown +
  backward-move confirmation modal (§8 of SPEC_PRODUCTION_TIMELINE.md) are real, hit the same
  real status route, and match the spec's UX exactly.
- **`lib/admin/orderStages.ts`** — `getNextStage`, `isBackwardMove`, `isOrderStatus`,
  `STATUS_LABEL`, `STATUS_VARIANT` are real logic, actually imported and enforced by the status
  API route (not decorative).
- **Customer `ProductionTimeline`** (`components/account/ProductionTimeline.tsx`), rendered at
  `app/account/orders/[id]/page.tsx:255-262` with `variant="customer"` — `currentStatus` and
  `statusHistory` come from a real query against `orders` + `order_status_history`
  (`app/account/orders/[id]/page.tsx:96-126`). Not a placeholder.
- **Admin order detail's Status History panel** (`app/admin/orders/[id]/page.tsx:288-308`) reads
  real `order_status_history` via `getOrderStatusHistory()`.

Nothing in the queue-to-status-change path is mocked. The gaps below are about **missing
wiring and spec-vs-build drift**, not fake data.

---

## 2. WHAT'S A SHELL, BROKEN, OR UNWIRED

### 2a. Two incompatible order-status vocabularies share `orders.status` — real correctness bug

`supabase/migrations/007_delivery_tracking.sql:328-332` widened the `orders_status_check`
constraint to accept **12** values: the 9 keys in `ORDER_STAGES` (`lib/admin/orderStages.ts:7-17`)
+ `cancelled`, plus three more added for the Employee PWA / delivery-tracking flow:
`in_production`, `packaged`, `out_for_delivery`. `ORDER_STAGES` and `OrderStageKey` were never
updated to know about these three. Concretely, once an order's status is set to one of them:

- `ACTIVE_ORDER_STATUSES` (`lib/admin/orderStages.ts:22-24`, filters `ORDER_STAGES` only) does
  not include them, so `getProductionQueue()`'s `'all'` filter (`lib/data/orders.ts:249-250`)
  and `getProductionQueueCounts()` (`lib/data/orders.ts:307-322`) **silently drop the order from
  every tab and every count** in the admin production queue — it just disappears, with no
  filter tab that shows it.
- `components/account/ProductionTimeline.tsx:142` does
  `ORDER_STAGES.findIndex((s) => s.key === currentStatus)`, which returns `-1` for these three
  statuses. With `currentIndex = -1`, every stage's computed `state` (lines 183-191) evaluates
  to `'pending'` — **the customer-facing timeline renders as if nothing has happened yet**, for
  an order that has actually reached packaging or is out for delivery.
- `STATUS_LABEL`/`STATUS_VARIANT` lookups elsewhere fall back to the raw DB value (e.g. the
  literal string `"packaged"`) via `?? row.status` fallbacks, instead of a formatted label.

This is the one finding in this audit that is an active correctness bug on real data paths
today, not a missing feature.

### 2b. `variant="admin"` and `variant="public"` of `ProductionTimeline` are dead code

`grep` for every import of `components/account/ProductionTimeline` and every `variant=` prop
found exactly one render call in the whole app —
`app/account/orders/[id]/page.tsx:255` with `variant="customer"`. SPEC_PRODUCTION_TIMELINE.md
§1 describes this component as shared across three surfaces (customer, admin, public). In
reality:
- The admin order detail page (`app/admin/orders/[id]/page.tsx`) uses a separate,
  purpose-built `StatusAdvancer` component instead — it never renders `ProductionTimeline`, so
  `variant="admin"` (and the `adminLabel`/note-display branches that depend on it,
  `ProductionTimeline.tsx:195,227-229`) is unreachable code.
- The actual public order tracker, `app/track/[orderId]/page.tsx`, is a completely separate,
  hand-rolled page with its own duplicated `STATUS_LABEL`/`STATUS_VARIANT`/`STATUS_MESSAGE`
  maps (lines 24-65) built for the wider delivery-tracking status set (`in_production`,
  `packaged`, `out_for_delivery` — see 2a). It does not import or render `ProductionTimeline`
  at all, so `variant="public"` is also unreachable.

### 2c. Pre-ship photo on the customer timeline is very likely a broken image

`app/api/admin/orders/[id]/photos/route.ts:82` writes the **raw Supabase Storage object key**
(e.g. `orders/{orderId}/{photoId}-{filename}`) into `orders.shop_photo_url`. That value flows
unmodified into `ProductionTimeline` (`app/account/orders/[id]/page.tsx:260`,
`shopPhotoUrl={order.shop_photo_url}`) and is rendered directly as `<img src={shopPhotoUrl}>`
(`ProductionTimeline.tsx:261-265`) — no `createSignedUrl()` call anywhere on this path. Every
other file that displays a file from this same `orders` bucket signs it first (e.g. the same
`photos/route.ts:109` signs its own upload response; `app/admin/orders/[id]/page.tsx`'s
customer-attachments list renders `att.signedUrl`, never a raw key). No migration or setup
script in `supabase/` creates the `orders` bucket as `public`, so a raw key is not a working
image URL. `app/api/track/verify/route.ts:100` has the identical bug
(`shopPhotoUrl: order.shop_photo_url`, unsigned) for the token-verified tracking flow.

### 2d. `ProductionQueueTable` is missing the "Expected" column and `SortControls` from spec

SPEC_PRODUCTION_QUEUE.md §1 specifies an `Expected` column ("Jan 20" / "Not set") and
`SortControls` letting the admin re-sort by expected ship date or status, in addition to the
default rush-then-oldest sort. `ProductionQueueTable.tsx:53-125` has 7 columns (Order #,
Customer, Profiles, Created, Rush, Status, Advance) — no Expected column, no sort control of
any kind. `ProductionQueueRow` (`lib/data/orders.ts:199-207`) has no expected-ship-date field
to source it from — `orders` has `delivery_scheduled_at` (delivery/pickup date, set post-QC)
but nothing that represents an *estimated* ship date while still in fabrication.

### 2e. `estimatedShipDate` prop is real but never passed at the one real call site

`ProductionTimeline` has full support for showing "Estimated ship date: ..."
(`ProductionTimeline.tsx:176-180`) when `estimatedShipDate` is set and the order hasn't shipped.
`app/account/orders/[id]/page.tsx:255-262` is the only place that renders this component and it
does not pass `estimatedShipDate` — even though `order.delivery_scheduled_at` is already
fetched on the same page and used in the page header two lines above
(`app/account/orders/[id]/page.tsx:144-146`). This line of the spec never renders.

### 2f. `machine_jobs` and `orders.status` are completely decoupled — no signal from the shop floor

Traced every write to both tables (`app/api/admin/command-center/*`,
`app/api/machine-bridge/*`, `app/api/admin/orders/[id]/status/route.ts`). `machine_jobs` runs
its own independent lifecycle — `pending_approval → approved_for_machine → staged_for_review →
sent_to_machine → completed / rejected / changes_requested` — driven entirely by Command
Center and the machine-bridge callback routes. **Nothing anywhere updates `orders.status` when
a linked `machine_jobs` row changes, and nothing updates `machine_jobs.status` when
`orders.status` changes.** The two tables are joined only for display (`machine_jobs.order_id`
lets Command Center show which order a job belongs to,
`lib/data/machine-jobs.ts:86-95,147`). Practical effect: an admin can click
`QuickAdvanceButton` to mark an order "Cutting" or "Bending/Forming" in the production queue
while its linked `machine_jobs` row is still sitting at `pending_approval` (or `machine_error`)
— the mid-fabrication stages are 100% a manual admin assertion, carrying no actual signal about
whether the Thalmann has received or run the job. This may be intentional (an estimator's
production-queue status vs. a machine operator's job status are legitimately different things),
but nothing in SPEC_PRODUCTION_QUEUE.md or SPEC_PRODUCTION_TIMELINE.md says so explicitly, and
Pillar 3 ("Full Visibility, Every Order") implies these stages should reflect real progress.

### 2g. No Playwright coverage exists for this feature at all

SPEC_PRODUCTION_QUEUE.md §5 specifies 4 tests. `tests/e2e/` contains
`auth.setup.ts, checkout.spec.ts, command-center.spec.ts, flashdraft.spec.ts,
quote-request.spec.ts` — no production-queue or order-tracking spec file. All the `data-testid`
hooks the spec's tests need already exist in the real components (`queue-row-{index}`,
`order-status-{index}`, `quick-advance-{index}`, `status-advancer`, `production-timeline`), so
this is a pure test-authoring gap, not missing instrumentation. CLAUDE.md's FORGE governance
requires Playwright as "a required gate on every UI prompt" — this feature has never had that
gate run against it.

### 2h. Stage labels are still explicit placeholders (already known, not new)

Both `lib/admin/orderStages.ts:1-2` and `components/account/ProductionTimeline.tsx` (via
`specs/SPEC_PRODUCTION_TIMELINE.md:23-25`) are labeled placeholder pending checklist #39. Noted
for completeness, not a new finding — CLAUDE.md's own DATA BLOCKERS table already tracks this.
Related but distinct: **the stage list is hand-duplicated in two files** —
`lib/admin/orderStages.ts:7-17` (admin-facing, no `description`) and
`components/account/ProductionTimeline.tsx:3-58` (customer-facing, has `description`) — same 9
keys, same order, maintained independently. Nothing enforces they stay in sync; when checklist
#39 lands, both need editing by hand.

### 2i. Minor type-safety hole

`ProductionQueueCounts` (`lib/data/orders.ts:305`) types `delivered` as a required `number` via
`Record<'all' | 'rush' | OrderStageKey, number>`, but `getProductionQueueCounts()`
(lines 307-322) explicitly `continue`s past `stage.key === 'delivered'` and never sets it — so
`counts.delivered` is `undefined` at runtime despite the type claiming `number`. Nothing reads
`counts.delivered` today (no "Delivered" tab in `TABS`), so it's latent, not currently
triggered.

---

## 3. EXACTLY WHAT THE NEXT PROMPT SHOULD BUILD

Priority order — 1 and 2 are real bugs affecting what customers/admins see today; 3-6 are
spec-vs-build gaps and cleanup.

1. **Fix §2a — reconcile the two status vocabularies.** Decide: are `in_production`,
   `packaged`, `out_for_delivery` additional production-queue stages, or a genuinely separate
   post-production phase this queue/timeline should treat as explicitly out of its scope?
   - If additional stages: extend `ORDER_STAGES`/`OrderStageKey`, `ACTIVE_ORDER_STATUSES`,
     `STATUS_LABEL`, `STATUS_VARIANT` in `lib/admin/orderStages.ts`, and the duplicate array in
     `components/account/ProductionTimeline.tsx`, so the admin queue and customer timeline both
     render them correctly instead of dropping/misrendering the order.
   - If separate: give `ProductionTimeline` an explicit branch for these three statuses (e.g.
     "this order has left production, see delivery tracking at `/track/{id}`") instead of
     silently falling through to `currentIndex = -1` → all-pending.
2. **Fix §2c — sign the pre-ship photo URL.** In `app/account/orders/[id]/page.tsx`, resolve
   `order.shop_photo_url` (and the object key returned by `/api/track/verify`) to a signed URL
   server-side before passing it as `shopPhotoUrl`, mirroring the `createSignedUrl()` pattern
   already used for `order_attachments` elsewhere on the same page and in
   `photos/route.ts:109`.
3. **Resolve §2b — the dead `admin`/`public` variants.** Either wire
   `app/admin/orders/[id]/page.tsx` to render `ProductionTimeline` (as SPEC_PRODUCTION_TIMELINE.md
   §1 originally specified, likely alongside or replacing part of `StatusAdvancer`), and build
   the public tracker on top of it too — or delete the unreachable `admin`/`public` branches and
   update SPEC_PRODUCTION_TIMELINE.md to document what was actually built (purpose-built admin
   `StatusAdvancer` + a separately-implemented delivery-tracking public tracker with its own
   wider status set).
4. **Add §2d/§2e — Expected column, SortControls, and wire `estimatedShipDate`.** Confirm with
   AFS whether `delivery_scheduled_at` is the right field for "expected ship date" while an
   order is still mid-fabrication, or whether a new column is needed; then add the column +
   sort UI to `ProductionQueueTable`, and pass `estimatedShipDate` into the one real
   `ProductionTimeline` call site.
5. **Decide and document §2f.** Either explicitly state in SPEC_PRODUCTION_QUEUE.md /
   SPEC_PRODUCTION_TIMELINE.md that production-queue stages are an independent admin assertion
   from `machine_jobs` progress (and this is fine), or wire a real signal (e.g. auto-advance to
   "Cutting" when the linked `machine_jobs` row hits `sent_to_machine`, revert/flag on
   `machine_error`).
6. **Write `tests/e2e/production-queue.spec.ts`** covering SPEC_PRODUCTION_QUEUE.md §5's 4 test
   cases against the existing `data-testid` hooks — closes §2g, satisfies CLAUDE.md's
   Playwright gate for this feature for the first time.
7. **Low priority:** consolidate the two hand-duplicated `ORDER_STAGES` arrays (§2h) into one
   source of truth before checklist #39 lands, to avoid an update landing in only one of the two
   files; fix the `ProductionQueueCounts` type (§2i) to make `delivered` optional or compute it.

---

*PRODUCTION_QUEUE_AUDIT.md | AFS | Investigation record | 2026-07-31*
