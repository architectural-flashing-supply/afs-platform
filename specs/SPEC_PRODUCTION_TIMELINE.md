# SPEC_PRODUCTION_TIMELINE.md
## AFS — Production Status Timeline
**Phase 4 — Component used in order detail, admin portal, public tracker**
**BLOCKED: Stage names must be confirmed with AFS shop manager (checklist #39)**

---

## 1. OVERVIEW

The production timeline shows where a custom order sits in the fabrication process.
For contractors who plan crew schedules around material delivery, knowing that
fabrication has actually started (versus just being "in queue") is critical.

This component is shared across three surfaces:
- Customer order detail page (read-only, customer variant)
- Admin order detail (editable — admin advances stages)
- Public order tracker (read-only, minimal variant)

---

## 2. STAGE DEFINITIONS

These labels are PLACEHOLDERS. Final labels must match exact shop language
from AFS shop manager (checklist #39). Wrong labels = shop staff won't use
the system to update statuses.

```typescript
// Placeholder stage labels — will be updated when checklist #39 received.
// AS BUILT this lives in lib/admin/orderStages.ts and the customer-facing
// field is `customerLabel` (it was `label` until EES-OVN.06, which was
// ambiguous once three audiences read this array). Which field a surface
// reads is decided by stageLabel(stage, variant) in the same file — see §9.
const ORDER_STAGES = [
  {
    key:         'submitted',
    customerLabel: 'Order Received',
    description: 'Your order is confirmed and in our system.',
    adminLabel:  'Submitted',
  },
  {
    key:         'received',
    customerLabel: 'Acknowledged',
    description: 'Our team has reviewed your order details.',
    adminLabel:  'Acknowledged',
  },
  {
    key:         'in_queue',
    customerLabel: 'In Production Queue',
    description: 'Scheduled for fabrication.',
    adminLabel:  'In Queue',
  },
  {
    key:         'cutting',
    customerLabel: 'Cutting',
    description: 'Your material is being cut to specification.',
    adminLabel:  'Cutting',
  },
  {
    key:         'bending',
    customerLabel: 'Forming',
    description: 'Profiles are being bent and formed.',
    adminLabel:  'Bending/Forming',
  },
  {
    key:         'qc',
    customerLabel: 'Quality Check',
    description: 'Final inspection before packaging.',
    adminLabel:  'QC',
  },
  {
    key:         'ready',
    customerLabel: 'Ready',
    description: 'Your order is packaged and ready.',
    adminLabel:  'Ready to Ship',
  },
  {
    key:         'shipped',
    customerLabel: 'Shipped',
    description: 'On its way to you.',
    adminLabel:  'Shipped',
  },
  {
    key:         'delivered',
    customerLabel: 'Delivered',
    description: 'Order complete.',
    adminLabel:  'Delivered',
  },
] as const;

type OrderStatus = typeof ORDER_STAGES[number]['key'];
```

---

## 3. COMPONENT SPEC

```typescript
// AS BUILT (EES-OVN.06). `variant` is required and has no default; `loadState`
// and `errorMessage` are the empty/loading/error states §4 never specified but
// the public lookup surface really needs. See §9.
interface ProductionTimelineProps {
  currentStatus:     string;
  statusHistory:     StatusHistoryItem[];
  variant:           'customer' | 'admin' | 'public';
  estimatedShipDate?:string | null;
  trackingNumber?:   string | null;
  carrier?:          string | null;
  shopPhotoUrl?:     string | null;
  loadState?:        'ready' | 'loading' | 'error';
  errorMessage?:     string | null;
}

interface StatusHistoryItem {
  status:         string;
  changedAt:      string;
  note?:          string | null;
  // Admin variant only — never rendered for a customer or an anonymous visitor.
  changedByName?: string | null;
}
```

---

## 4. VISUAL DESIGN

```
Vertical timeline (primary — mobile native, desktop also vertical)

  ● ORDER RECEIVED          Jan 15, 2026 9:02 AM
  │ "Your order is confirmed and in our system."
  │
  ● ACKNOWLEDGED            Jan 15, 2026 10:47 AM
  │
  ● IN PRODUCTION QUEUE     Jan 16, 2026 8:00 AM
  │ "Scheduled for fabrication — estimated start: Jan 17"
  │
  ◉ CUTTING                 Jan 17, 2026 7:15 AM  ← ACTIVE (pulsing)
  │ "Your material is being cut to specification."
  │ Started 2 hours ago
  │
  ○ FORMING                 ← PENDING (empty dot, dashed connector)
  │
  ○ QUALITY CHECK
  │
  ○ READY
  │
  [PRE-SHIP PHOTO SLOT] — shown when shopPhotoUrl set
  │
  ○ SHIPPED
  │
  ○ DELIVERED

Visual:
  Completed: filled crimson dot + solid crimson connector line
  Active:    filled crimson dot + pulse animation (ring expanding)
  Pending:   empty dot (border: afs-chrome-dim) + dashed connector
  Cancelled: red X icon + stage label struck through

Timestamps: font-data text-xs text-afs-chrome-base
Labels: font-heading text-base text-afs-chrome-high (completed/active)
        font-heading text-base text-afs-chrome-dim (pending)
Descriptions: font-body text-sm text-afs-chrome-mid
```

**THE THREE COLOURS ABOVE ARE SUPERSEDED — they fail WCAG AA on gunmetal, and
the component is inside the contrast build gate (CLAUDE.md rule #28) via
/admin/orders/[id].** Measured on afs-bg-raised: afs-chrome-dim is 2.88:1 and
afs-chrome-base 4.26:1, against a 4.5:1 body-text requirement. As built, a
pending label is **afs-chrome-silver** (7.13:1), a timestamp is
**afs-chrome-mid** (5.99:1), a pending dot's border is **afs-chrome-base** (a
non-text boundary, 4.26:1 against a 3:1 rule), and the tracking link and
in-progress eyebrow are **afs-danger-on-dark** rather than afs-crimson, which is
1.42:1 as text on gunmetal (rule #29). Everything else in this sketch —
crimson dots, solid vs dashed connectors, the pulse, the struck-through
cancelled label, the photo slot between QC and Ready — is as built. See §9.

---

## 5. PRE-SHIP PHOTO DISPLAY

```typescript
// When admin uploads pre-ship photo (orders.shop_photo_url set):
// Photo appears between qc and ready stages
// Caption: "Your completed order — ready to ship"
// Click → opens in DocumentPreviewModal (full size)

// If multiple pre-ship photos (order_attachments table):
//   Small grid of thumbnails
//   Each clickable for full view
```

---

## 6. TRACKING INTEGRATION

```typescript
// When order.status === 'shipped' AND tracking_number set:
// Carrier tracking link displayed:
//   "Tracking: {trackingNumber}" → external carrier URL
//   Carrier icon if recognized (UPS, FedEx, etc.)
// Estimated delivery from carrier (if available via EasyPost webhook)
```

---

## 7. NOTIFICATION TRIGGERS

Each stage transition automatically triggers customer notification.
See SPEC_NOTIFICATIONS.md for complete trigger list.

```typescript
const NOTIFICATION_STAGES: OrderStatus[] = [
  'submitted',
  'in_queue',
  'cutting',
  'ready',
  'shipped',
  'delivered',
];
// 'received', 'bending', 'qc' do not trigger customer notifications
// Only most impactful transitions notify customer
```

---

## 8. ADMIN STATUS ADVANCEMENT

```typescript
// In /admin/orders/{id}:
// StatusAdvancer component (prominent, top-right of admin order detail)

// Method A: Quick advance (most common)
//   "→ Advance to: [Next Stage Label]" button
//   Click → instant update
//   No confirmation needed for forward movement
//   Triggers notification + audit log automatically

// Method B: Status dropdown (corrections, skipping stages)
//   Select any status
//   Optional note field
//   Confirmation required for backward movement:
//     "Moving order backward is unusual. Add a note to explain."
//   Submit → updates orders.status + inserts order_status_history

// After any status change:
//   Customer notification fires (if stage in NOTIFICATION_STAGES)
//   order_status_history record inserted
//   admin_audit_log record inserted
//   Realtime update fires → customer sees status change live
```

---

## 9. AS-BUILT — THREE SURFACES, THREE VARIANTS (EES-OVN.06, 2026-10-03)

**§1's "shared across three surfaces" is now what was actually built.** This
section previously recorded the opposite: the `admin` and `public` variants had
been DELETED, because grep found exactly one render call in the whole app and
dead branches are worse than missing ones (PRODUCTION_QUEUE_AUDIT.md §2b). That
reasoning was right, and EES-OVN.06 satisfied it the other way round — the
variants are back **and each has a real call site, added in the same commit**:

| Variant | Surface | File |
|---|---|---|
| `customer` | Signed-in order detail | `app/account/orders/[id]/page.tsx` |
| `admin` | Admin order detail, beside `StatusAdvancer` | `app/admin/orders/[id]/page.tsx` |
| `public` | Anonymous order-status lookup at **`/order-status`** | `components/track/OrderStatusLookup.tsx` |

`variant` is **REQUIRED and has no default.** A default is the quiet way back to
showing customer prose to the shop.

**WHAT EACH VARIANT SHOWS.** Declared as data in `VARIANT_RULES`
(`lib/production/timeline-view.ts`) and asserted by unit test, not by reading
JSX:

| | `customer` | `admin` | `public` |
|---|---|---|---|
| Stage label | `customerLabel` | `adminLabel` | `customerLabel` |
| Stage description | completed + active rows | never | active row only |
| Timestamp | yes | yes | yes |
| History note | no | yes | no |
| Who changed it | no | yes | no |
| Estimated ship date | yes | no | yes |
| Pre-ship photo | yes | no | yes |
| Tracking block | yes | yes | yes |
| Progress summary | yes | yes | yes |

Each `no` has a reason. Customer prose is not shop language, and the admin reads
the history note instead. The admin order detail already shows the scheduled
date in its own Delivery & Payment panel and the photos in its own
`PreShipPhotoSection` — repeating either inside the timeline would put two
sources of one fact on one screen. `public` is specified as the MINIMAL variant,
and an internal note must never reach an anonymous visitor. Tracking is the one
field that is equally operational and customer-facing, so it stays everywhere.

**EDITING IS STILL `StatusAdvancer`'s JOB.** §8's advancement UX — one-click
advance, manual override, backward-move confirmation — is real, tested and
already on the admin order detail. The `admin` variant is the READING half
beside it; the two share no state. What the `admin` variant replaced is a
hand-rolled `<ul>` of the status-history rows, which could only show changes
that had already happened — "what is left" was never on that screen.

**`/order-status` IS THE PUBLIC TRACKER, AND `/track/[orderId]` IS UNTOUCHED.**
`SITEMAP.md` has always described the public tracker as "Email verify", and the
endpoint for exactly that was already built and complete — `POST
/api/track/verify`: order number plus the matching account email, rate-limited
to 10 attempts an hour per IP, returning status, history, scheduled date,
tracking, and a SIGNED pre-ship photo URL. It had **no caller at all**. What was
built at `/track/[orderId]` is a different artefact: a token-addressed,
full-screen live delivery map with its own wider status vocabulary (§10). So the
public variant got its own route and gave that endpoint its caller; the map was
not rebuilt. It is NOT under `/track` because
`components/layout/AppChrome.tsx`'s `NO_CHROME_PREFIXES` strips the site nav and
footer from every `/track` path so the map can fill the viewport, and a public
lookup page wants ordinary chrome. `components/layout/Footer.tsx`'s "Track an
Order" link points at `/order-status` now; it used to point at
`/account/orders`, which requires a session, so an anonymous visitor following a
public footer link landed on `/login`.

**LABELS: ONE CONFIG MODULE, AND WHICH FIELD IS ONE FUNCTION.**
`lib/admin/orderStages.ts` is the only place a stage label is written, for every
audience. `label` was renamed `customerLabel` (ambiguous once a third audience
existed), and `stageLabel(stage, variant)` is the single decision about which
field a surface reads — a caller never picks a field. `POST_PRODUCTION_LABEL` and
`CANCELLED_LABEL` moved there too, because `STATUS_LABEL`, the timeline's banner
and the customer-facing `ORDER_STATUS_LABEL` all needed them and three hand-kept
copies of "Out for Delivery" is three places a rename has to land. Stage labels
remain PLACEHOLDERS pending checklist #39; when it lands, the edit is to that
one file.

**LOADING, EMPTY AND ERROR.** `loadState` is `'ready' | 'loading' | 'error'`.
Loading renders nine skeleton rows (nine is what will arrive, so the panel does
not jump) with `aria-busy`. Error obeys CLAUDE.md rule #30 — "Nothing about your
order has changed — only this status display failed." Empty still draws all nine
stages plus a sentence, because what is coming is information and a blank panel
is not.

**ACCESSIBILITY.** `<ol role="list">` with one `<li>` per stage (the explicit
role because `list-none` strips list semantics in Safari), `aria-current="step"`
on the active row and on no row when the order is cancelled or has left the
sequence, and a visible `role="progressbar"` carrying `aria-valuemin`/`max`/`now`
and an `aria-valuetext` that names the stage in words ("Cutting — stage 4 of 9")
rather than a percentage.

**COLOUR.** Wiring the admin variant put this component inside
`scripts/audit/contrast-check.mjs`'s build gate via `/admin/orders/[id]`, and the
gate found four things: `afs-chrome-dim` at 2.88:1 on `afs-bg-raised` (rule
#18), `afs-chrome-base` at 4.26:1 as body text, `afs-crimson` used as TEXT at
1.42:1 (rule #29), and `bg-[var(--afs-crimson-ghost)]`, an arbitrary value that
raised the gate's `unresolved` count (rule #28). All four corrected. The gate
then found a fifth the eye would not have: `afs-chrome-mid` is 4.04:1 on
`afs-bg-overlay`, the lightest gunmetal, in the error panel. That screen went
from 17 measured pairs to 22; the gate passes with 0 unresolved and 0 below
threshold.

**TESTS.** `lib/production/timeline-view.test.ts` (47) covers the view model —
states, ordering, the variant matrix, tracking, the photo slot, history
handling, boundary inputs and purity.
`components/account/ProductionTimeline.test.tsx` (25) renders each variant
through `react-dom/server` and asserts the markup, the ARIA attributes and the
load states. `tests/e2e/production-timeline.spec.ts` covers `/order-status`
without credentials and the other two surfaces behind them.

## 10. AS-BUILT NOTES — post-production statuses

`currentStatus` can be `in_production`, `packaged`, or `out_for_delivery` —
Employee PWA / delivery-tracking values outside the `ORDER_STAGES` sequence
(see `lib/admin/orderStages.ts`'s `POST_PRODUCTION_STATUSES`). Rather than
rendering every stage as pending (`currentIndex === -1`, the bug this
follow-up fixed), the timeline maps each to the fabrication stage it is
closest to/past — `TIMELINE_POST_PRODUCTION_STAGE` in the config module
(`in_production`/`packaged` → `ready`, `out_for_delivery` → `shipped`) — plus an
explicit banner naming the real status so the customer isn't shown a stage label
that doesn't match what actually happened. **No stage is `active` in that case:**
the order has left the sequence, so "this is being worked on right now" would be
a false claim, and the banner carries the truth instead.

EES-OVN.06 added a third case on the same principle. A status that is in neither
set — a widened database CHECK, a hand edit, a stage added in the future —
renders all nine stages pending AND a banner naming the raw value. The failure
mode PRODUCTION_QUEUE_AUDIT.md §2a described was a timeline that silently looked
like nothing had happened; saying "Current status: <value>" is the general fix,
not a special case for three known strings.

**`TIMELINE_POST_PRODUCTION_STAGE` AND
`lib/data/command-center-dashboard.ts`'s `POST_PRODUCTION_STAGE_EQUIVALENT`
DELIBERATELY DISAGREE** — the dashboard maps `in_production` to `qc`, this maps
it to `ready` — and they must not be merged. Which is right is a question for
Reid (recorded UNRESOLVED), and the dashboard's value feeds a frozen Command
Center v7 screen whose displayed percentage would change if it were altered.
Unifying them is a visual change to v7, not a cleanup.

---

*SPEC_PRODUCTION_TIMELINE.md | AFS | Reid Whitesides | June 2026*
