# PICKUP_SCHEDULING_SCOPE.md
## AFS — Pickup Scheduling: Current State + What pickup-002 Should Build

Prepared per request to read `specs/SPEC_PICKUP_SCHEDULING.md` in full, grep the
repo for existing pickup code, check `SCHEMA.md`'s `orders` table for
pickup-related columns, and determine what pickup-002 should actually build.
Sourced from a live read of the spec, `app/checkout/page.tsx`,
`lib/data/orders.ts`, `app/account/orders/[id]/page.tsx`,
`app/admin/orders/[id]/page.tsx`, `app/api/admin/orders/[id]/crm/route.ts`,
`components/admin/OrdersCrmTab.tsx`, `app/api/orders/[id]/dispatch/route.ts`,
`supabase/migrations/007_delivery_tracking.sql`, `SITEMAP.md`, and
`lib/bid-monitor/alerts.ts` — not from memory.

This is explicitly scoped separately from delivery dispatch
(`app/api/orders/[id]/dispatch`, `OrdersCrmTab`'s Assign Driver/Dispatch
controls) — that whole pipeline is AFS driving product *to* the customer.
Pickup scheduling is the customer coming *to* AFS. The two are already
declared distinct at the schema level (`delivery_method IN ('ship','pickup')`).

---

## 1. WHAT EXISTS TODAY

Grepping the repo for `pickup` (case-insensitive) confirms a **capture-only,
dead-end implementation**. Nothing writes a real pickup date anywhere.

- **Checkout (`app/checkout/page.tsx`)** — the "Pickup" radio (line 367–383)
  captures `contactName` + `contactPhone` only. No date field, no
  morning/afternoon window. The copy literally says *"You'll receive pickup
  scheduling instructions in your order confirmation"* (line 430) — a promise
  nothing in the codebase fulfills.
- **`lib/data/orders.ts` `createOrderFromQuote()`** (lines 117–122) — for
  `deliveryMethod === 'pickup'`, stores `{ contactName, contactPhone }` as
  `orders.delivery_address` JSONB. `delivery_scheduled_at` and
  `delivery_window` are never set at order creation for either delivery
  method.
- **Customer order detail (`app/account/orders/[id]/page.tsx`, lines
  264–284)** — already renders a full "Pickup" section: Pickup Date, Window,
  and "Facility: Contact AFS for pickup address." All three are **read-only**
  and permanently show "Not yet scheduled" / "—", because nothing ever
  populates the two columns they read. This is UI for a feature that doesn't
  exist yet, already built and waiting.
- **Admin order detail (`app/admin/orders/[id]/page.tsx`, lines 216–251)** —
  same story: a "Scheduled" field that reads `deliveryScheduledAt`/
  `deliveryWindow`, always blank for pickup orders, no way to set either.
- **Command Center Orders/CRM tab (`components/admin/OrdersCrmTab.tsx`,
  `lib/data/command-center-crm.ts`)** — the only place in the entire codebase
  that ever *writes* `delivery_scheduled_at`
  (`app/api/admin/orders/[id]/crm/route.ts`, PATCH), via a plain
  `<input type="date">` next to an "Assign Driver" dropdown and
  "Dispatch"/"Mark Delivered" buttons. **This tab never selects or checks
  `delivery_method`** — a pickup order sitting at `ready` shows the exact same
  Assign Driver / Dispatch controls as a ship order. Clicking "Dispatch" on a
  pickup order would mark it `out_for_delivery` and fire the customer SMS/
  email that says *"is on the way"* with a `/track/[token]` link — which
  `008_order_geocoding.sql`'s own comments confirm is meaningless for pickup
  orders ("pickup orders have no jobsite to geocode/track"). Nothing in
  `dispatch/route.ts` blocks this. This is a **pre-existing correctness gap**,
  not something pickup-002 introduces — worth fixing alongside, flagged
  separately in §4.
- **`SITEMAP.md` (line 200)** already documents this honestly: `/api/pickup/**`
  is listed under *"Routes described in earlier drafts of this document that
  were never built and do not exist."* No route directory `app/api/pickup/`
  exists at all (confirmed via glob).

**Verdict: the spec's entire FLOW (§2) and API (§4) are unbuilt.** What
exists is the checkout contact-info capture (arguably in scope for a prior
checkout prompt, not this spec) and two read-only display panels that were
built ahead of the data that should feed them.

---

## 2. SCHEMA CHECK — does this need new columns?

**No new columns are needed.** `SCHEMA.md` TABLE 18 (`orders`) already has
everything the spec's `PickupSchedule` interface needs, because they're
shared, generically-named columns already used by the ship-delivery path:

| Spec field | Existing column | Notes |
|---|---|---|
| `pickupDate` | `delivery_scheduled_at TIMESTAMPTZ` | Already read/displayed by both account and admin order pages. Only ever written today via the CRM tab's ship-oriented date input. |
| `pickupWindow` | `delivery_window TEXT` | Column exists, unused — no writer anywhere in the repo currently sets it, for either delivery method. |
| `contactName` / `contactPhone` | `delivery_address JSONB` | Already populated at order creation for pickup orders (`lib/data/orders.ts:121`). |
| Which delivery method | `delivery_method TEXT CHECK IN ('ship','pickup')` | Already exists, already set correctly at order creation. |

There is **no `pickup_confirmed_by`, `pickup_confirmed_at`, or
`picked_up_at`** anywhere in the schema, and none should be added purely for
scheduling — reuse `delivery_scheduled_at`/`delivery_window` exactly as the
account/admin order pages already assume, rather than inventing parallel
`pickup_*` columns that would duplicate columns already wired into two
existing UIs.

**The one real gap in `orders.status`:** the CHECK constraint (widened by
`007_delivery_tracking.sql` to `submitted, received, in_queue, cutting,
bending, qc, ready, shipped, delivered, cancelled, packaged,
out_for_delivery, in_production`) has **no terminal state for "customer
picked this up."** A pickup order that reaches `ready` has nowhere correct to
go — `shipped`/`out_for_delivery`/`delivered` all imply AFS moved the
product. This needs a decision (§4), not necessarily a migration.

---

## 3. WHAT'S BLOCKED vs. WHAT'S BUILDABLE

The spec header itself flags **"BLOCKED: Pickup process, dock details
(checklist #47)"**, and CLAUDE.md's Data Blockers table separately lists AFS
address/phone/hours (#5, #6) as blocked. Splitting the spec's own FLOW (§2)
against those blockers line by line:

**Genuinely blocked (do not build):**
- Facility **address** for "Get Directions" → Google Maps (§2) — blocked on
  #5. The account order page already has the correct placeholder for this:
  *"Contact AFS for pickup address."* Leave it.
- **"Business days within AFS hours"** as a real constraint on the date
  picker (§2) — blocked on #6 (exact hours unknown).
- **Dock/staging instructions** text (§2's "Special staging instructions") —
  blocked on #47 directly.

**Not actually blocked (buildable now):**
- The **morning/afternoon window** choice — this isn't third-party data like
  freight rates; the spec *itself* defines the two values (§3:
  `pickupWindow: 'morning' | 'afternoon'`). It's AFS's own two-bucket
  scheduling convention, already fully specified. No blocker applies.
- **Weekday-only date constraint** — "business days" (Mon–Fri, excluding
  today/past dates) doesn't require knowing AFS's exact opening/closing
  hours, only which days AFS is open at all, which every version of this
  business (M–F) can safely assume without #6's precise data. This is a
  reasonable, conservative default, not a fabricated number the way a
  freight rate would be.
- Contact name/phone — already built, unaffected by any blocker.
- The **notification pattern** ("Notifies: AFS admin", §4) — the "AFS
  address/phone/hours" blocker in CLAUDE.md is about the *physical* address,
  not a notification inbox. `lib/bid-monitor/alerts.ts:40` already has a live
  precedent for "notify AFS of an event via email" —
  `process.env.BID_MONITOR_ALERT_EMAIL || 'tricia@architecturalflashingsupply.com'`
  — a working, already-used fallback address. Reuse that pattern; it is not
  blocked.

---

## 4. WHAT pickup-002 SHOULD BUILD

**1. `PickupScheduler` — customer-facing, on the order detail page, not
inside checkout.** Checkout is a high-risk, already-complex payment flow
(`ORDER_LIFECYCLE_DECISION.md` documents how fragile its order-creation path
already is); the order doesn't even exist as a row until *after* payment
succeeds, so writing a pickup date into it synchronously during checkout adds
avoidable coupling. The spec's own §4 API comment — *"Validates: order status
is 'ready' OR sets pending-pickup flag on confirmed order"* — already
anticipates scheduling happening **after** order placement, against a real
order row. Build it there instead:
   - Replace the read-only "Pickup Date" / "Window" block in
     `app/account/orders/[id]/page.tsx` (lines 268–284) with a client
     component when `delivery_method === 'pickup'` and the order isn't yet
     `delivered`/`cancelled`: a weekday-only date input + Morning/Afternoon
     radio (mirror the plain `<input type="date">` pattern already used in
     `OrdersCrmTab.tsx`'s `toDateInputValue` — no new date-picker dependency
     needed) and a `[Schedule Pickup]` button. Once `delivery_scheduled_at`
     is set, show it read-only as today, with a "Reschedule" link back to
     the form.

**2. `POST /api/pickup/schedule`** — new route, per spec §4:
   - Body: `{ orderId, pickupDate, pickupWindow }`.
   - Auth: session user must own the order (`orders.user_id = auth.uid()`)
     and `orders.delivery_method === 'pickup'` — reject otherwise (400/403).
   - Writes `delivery_scheduled_at` (from `pickupDate`) and `delivery_window`
     (`'morning' | 'afternoon'`) directly — the same two columns the CRM
     tab's PATCH already writes to, so both admin and customer views stay
     consistent without new columns.
   - Inserts an `order_status_history` row (status unchanged, `note: "Pickup
     scheduled — {date} {window}"`) so the change is visible in both order
     detail pages' existing history list — reuses the pattern
     `dispatch/route.ts` already establishes for non-status audit trail
     entries.
   - **Notify AFS admin**: email via `lib/resend/send.ts`'s `sendEmail()` to
     `process.env.PICKUP_ALERT_EMAIL || 'tricia@architecturalflashingsupply.com'`
     (mirroring `lib/bid-monitor/alerts.ts`'s exact fallback pattern) —
     "Pickup scheduled — Order {order_number} — {date} {window}."
   - **Customer confirmation email**: reuse `baseEmailTemplate`/`ctaButton`
     (the same helpers `dispatch/route.ts` already uses) with the same
     "Contact AFS for pickup address" placeholder line already shown in the
     UI — do not invent an address here either.

**3. Fix the adjacent Command Center gap** (found in §1, not introduced by
this spec but directly collided with by it): `OrdersCrmTab.tsx` and
`command-center-crm.ts` need to select `delivery_method` and hide
Assign-Driver/Dispatch/Delivery-Date controls for `delivery_method ===
'pickup'` rows, replacing them with the pickup date/window (read-only,
sourced from the same columns pickup-002 now populates) and a **"Mark Picked
Up"** action once `status === 'ready'`. This closes the loop the spec's flow
otherwise leaves open — without it, a scheduled pickup order has no way to
ever leave `ready`.

**4. Status decision needed before #3 can be built: reuse `delivered`,
don't add `picked_up`.** `orders.status`'s CHECK constraint has already been
widened once (`007_delivery_tracking.sql`) for the delivery/PWA pipeline;
widening it again for one more terminal value is possible but adds a second
migration + another `ACTIVE_ORDER_STATUSES`/`NOTIFICATION_STAGES` edge case
to maintain. `delivered` already means "customer has the product, order is
closed" for the ship path and is already excluded from every active-orders
query (`app/account/page.tsx:83`, `getProductionQueue`). Recommend treating
"picked up" as `status = 'delivered'` with an `order_status_history` note of
`"Picked up by {contactName}"` — no schema change, and it slots into every
existing "is this order done" check for free. Flag this as a decision point
for pickup-002 to confirm rather than assuming, since it's a modeling choice,
not a pure gap-fill.

**Do not build:**
- Any facility address, "Get Directions" link, or dock/staging instructions
  — all three remain blocked on #5/#47 exactly as the spec's own header
  says. Keep the existing "Contact AFS for pickup address" placeholder.
- A pickup date/window selector inside `app/checkout/page.tsx` itself — see
  the reasoning in item 1. Checkout's existing contact-name/phone capture is
  sufficient and should not change.
- A new `pickup_confirmed_by`/`pickup_confirmed_at`/`picked_up_at` column set
  — §2 above shows the existing generic columns already cover this without
  duplication.

---

*PICKUP_SCHEDULING_SCOPE.md | AFS | prepared from live codebase audit, 2026-07-30*
