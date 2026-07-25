# SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md
## AFS — Delivery Tracking, Employee PWA, and Command Center CRM Expansion
**Phase: Post-Launch Feature Block**
**Routes:** `/track/[orderId]`, `/admin/command-center` (expanded), `/admin/crm/**`, `/employee/**` (PWA)
**Auth:** Customer tracking = order token (no login required). Employee PWA = operator role. CRM = admin/operator role.

---

## 1. OVERVIEW

Four systems built as one FORGE run:

| System | Who Uses It | What It Does |
|---|---|---|
| Delivery Tracking Map | Customers | Real-time GPS map of their delivery driver |
| Employee PWA | Steve + Christian | Mark orders complete, trigger invoices, queue GBP photos |
| Command Center CRM | Steve + Trica + Christian | Customer accounts, order completion, invoice trigger |
| GBP Photo Queue | Steve + Christian | Queue photos for Google Business Profile upload |

---

## 2. DELIVERY TRACKING MAP

### Route
`/track/[orderId]` — public, no login required, accessed via unique token in SMS/email link

### What the customer sees
- Full-screen Google Map centered on Burnet, TX
- **Static red pulsating dot** at AFS shop: 209 Shurcast Drive, Burnet, TX 78611 (lat: 30.7584, lng: -98.2328)
  - Label: "AFS Architectural Flashing Supply"
  - Always visible regardless of delivery status
- **Live blue pulsating dot** — their delivery driver's real-time GPS position
  - Only visible when order status = `out_for_delivery`
  - Updates every 30 seconds from Supabase realtime
  - Label: "Your Delivery"
- **Destination marker** — customer's jobsite address (from order record)
- Order status bar at top: "Your order is on the way — estimated arrival soon"
- No other customers' drivers visible — scoped strictly to this order token

### GPS Data Flow
```
Employee PWA (background geolocation)
  → POST /api/driver/location every 30 seconds
  → Supabase driver_locations table
  → Supabase Realtime broadcast
  → Customer map updates live
```

### Database — driver_locations table
```sql
CREATE TABLE driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES profiles(id),
  order_id uuid REFERENCES orders(id),
  lat decimal(10, 7) NOT NULL,
  lng decimal(10, 7) NOT NULL,
  recorded_at timestamptz DEFAULT now()
);

-- RLS: only readable if order token matches
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
```

### 10-Mile SMS Trigger
- Background job checks distance between driver_location and order jobsite_address every 60 seconds
- When distance ≤ 10 miles: fire Twilio SMS to customer
- Message: "Your AFS delivery is about 10 miles away. Track your driver: {trackingUrl}"
- Fire once per order — set delivery_notifications.ten_mile_sent = true after firing

### ENV VARS REQUIRED
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # Must be added — not currently in .env.local
GOOGLE_MAPS_API_KEY=               # Server-side
```

---

## 3. EMPLOYEE PWA

### What it is
A Progressive Web App — installable from Chrome on Android. No App Store. Separate from the customer-facing site. Distinct icon and branding.

**URL:** `/employee` — separate PWA manifest, separate icon

**Authorized users:** profiles with role = `operator` (Steve + Christian)
- Steve: 512-965-9609
- Christian: 512-588-4704

### PWA Manifest
```json
{
  "name": "AFS Operations",
  "short_name": "AFS Ops",
  "start_url": "/employee",
  "display": "standalone",
  "background_color": "#1C1F26",
  "theme_color": "#C0001A",
  "icons": [
    { "src": "/employee-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/employee-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Icon: AFS shield on black background — distinct from main site favicon.

### Employee PWA Screens

#### Screen 1 — Home (bottom nav)
Two tabs: **Orders** | **Photos**

#### Screen 2 — Orders Tab
- List of active orders with status IN (in_production, ready, packaged)
- Each order card: customer name, order number, profile summary, status badge
- Tap order → Order Detail screen

#### Screen 3 — Order Detail
- Order summary (customer, items, address)
- Status advancement buttons:
  - [Mark as Packaged] → sets status = `packaged`, timestamps packaged_at
  - [Dispatch for Delivery] → sets status = `out_for_delivery`, triggers:
    1. Customer SMS via Twilio: "Your AFS order {orderNumber} is on the way. Track your delivery: {trackingUrl}"
    2. Customer email via Resend: delivery notification with tracking link
    3. Final invoice email to customer (PDF generated from order data)
    4. Starts GPS background location reporting for this driver
  - [Mark Delivered] → sets status = `delivered`, stops GPS reporting

#### Screen 4 — Photos Tab
- [Take Photo] button → opens device camera
- Photo preview with caption field
- [Queue for Upload] → saves to gbp_photo_queue table with status = `pending_review`
- Queue list: photos pending review, approved, posted
- NO automatic posting — human review required before GBP upload

### Background GPS
- Starts when driver taps [Dispatch for Delivery]
- Uses browser Geolocation API with watchPosition()
- Posts to /api/driver/location every 30 seconds
- Stops when driver taps [Mark Delivered]
- Requires location permission grant on PWA install

---

## 4. COMMAND CENTER CRM EXPANSION

### New tabs inside /admin/command-center

Current tabs (existing): Queue | Approvals

New tabs to add:

#### Tab: Customers
- Searchable customer list: name, company, email, order count, total spend, last order date
- Click customer → Customer Detail drawer/panel
- Customer Detail shows:
  - Contact info
  - Order history (all orders, all statuses)
  - Quote requests
  - Outstanding invoices
  - Credit application status
  - Notes field (internal AFS notes, not visible to customer)

#### Tab: Orders (CRM view)
- All orders across all statuses
- Filter by: status, date range, customer, driver
- Order row: order number | customer | items summary | status | driver assigned | delivery date
- Click order → Order Detail panel
- Actions per order:
  - Assign driver (Steve or Christian)
  - Set delivery date
  - [Mark Packaged] — same as PWA action
  - [Dispatch] — same as PWA action, triggers same notifications
  - [View Tracking Map] — opens /track/[orderId] in new tab

#### Tab: Invoices
- All invoices: invoice number | order number | customer | amount | status | due date
- Status: draft | sent | paid | overdue
- [Send Invoice] → emails PDF to customer via Resend
- [Mark Paid] → updates invoice status
- Invoice PDF generated server-side from order line items

#### Tab: GBP Photo Queue
- Photos queued from employee PWA
- Each photo: thumbnail | caption | queued by | queued at | status
- Actions: [Approve] | [Reject] | [Post to Google Business]
- [Post to Google Business] → calls GBP API with OAuth
- Approved photos require manual click to post — no automation

---

## 5. GBP PHOTO UPLOAD

### Database
```sql
CREATE TABLE gbp_photo_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queued_by uuid REFERENCES profiles(id),
  storage_key text NOT NULL,
  caption text,
  status text DEFAULT 'pending_review', -- pending_review | approved | rejected | posted
  queued_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES profiles(id),
  posted_at timestamptz
);
```

### GBP API
- OAuth 2.0 with Google — admin configures once via /admin/settings/integrations
- POST to Google My Business API v4.9: `accounts/{accountId}/locations/{locationId}/media`
- Human must click [Post to Google Business] in the CRM photo queue — never automatic

### ENV VARS REQUIRED
```
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=
GOOGLE_BUSINESS_LOCATION_ID=
```

---

## 6. NEW DATABASE MIGRATIONS

### Migration 007 — Delivery Tracking + Employee PWA
```sql
-- Driver locations
CREATE TABLE driver_locations ( ... );

-- Delivery notifications log
CREATE TABLE delivery_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  ten_mile_sent boolean DEFAULT false,
  ten_mile_sent_at timestamptz,
  dispatch_sms_sent boolean DEFAULT false,
  dispatch_email_sent boolean DEFAULT false,
  invoice_sent boolean DEFAULT false
);

-- GBP photo queue
CREATE TABLE gbp_photo_queue ( ... );

-- Add operator role to profiles role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operator';

-- Add packaged_at, dispatched_at, delivered_at to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS packaged_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE DEFAULT gen_random_uuid()::text;
```

---

## 7. NEW API ROUTES

| Route | Method | Auth | Purpose |
|---|---|---|---|
| /api/driver/location | POST | operator | Receive GPS ping from PWA |
| /api/orders/[id]/dispatch | POST | operator | Trigger dispatch notifications + invoice |
| /api/orders/[id]/delivered | POST | operator | Mark delivered, stop GPS |
| /api/track/[token] | GET | public | Return order + driver location for tracking map |
| /api/gbp/queue | POST | operator | Queue photo for GBP upload |
| /api/gbp/post/[id] | POST | admin/operator | Post approved photo to GBP |
| /api/invoices/[id]/send | POST | admin/operator | Email invoice PDF to customer |

---

## 8. NAV ADDITIONS

### Customer-facing
- No new nav items — tracking is accessed via link in SMS/email only

### Admin sidebar (Command Center)
Add to Operations section:
- 🚚 Deliveries → /admin/command-center?tab=orders
- 📸 GBP Photos → /admin/command-center?tab=gbp

### Employee PWA
Standalone bottom nav — not shared with main site nav

---

## 9. REQUIRED ENV VARS SUMMARY

```env
# Google Maps (MISSING — must add before this feature works)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_API_KEY=

# Google Business Profile (new)
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=
GOOGLE_BUSINESS_LOCATION_ID=

# Twilio (already stubbed — verify configured)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# AFS Shop coordinates (static — hardcode in config)
AFS_SHOP_LAT=30.7584
AFS_SHOP_LNG=-98.2328
```

---

## 10. OPERATOR ACCOUNTS TO CREATE POST-BUILD

After migration 007 is applied, set role = 'operator' for:
- Steve Harycki — 512-965-9609
- Christian — 512-588-4704

Run in Supabase SQL editor:
```sql
UPDATE profiles SET role = 'operator'
WHERE email IN ('steve@architecturalflashingsupply.com', 'christian@architecturalflashingsupply.com');
```

---

## 11. IMPLEMENTATION NOTES (as built — d-007, 2026-07-24)

This feature block was built across 7 FORGE prompts (d-001–d-007) in
several sessions; this section is the as-built record d-007 was asked to
add, written from the real files on disk rather than the individual
per-prompt logs (most of d-001–d-006 landed uncommitted across multiple
sessions and were bundled into one recovery commit, `725b591`, before
being individually written up — see SESSION_STATE.md for that history).

### What actually exists on disk

**Migrations** (none applied to the live Supabase project yet — see
`supabase/README.md`, updated this session to list `009` for the first
time):
- `007_delivery_tracking.sql` — `driver_locations`, `delivery_notifications`,
  `gbp_photo_queue`; `orders.packaged_at/dispatched_at/delivered_at/
  assigned_driver_id/tracking_token`; widens `profiles.role`'s CHECK to
  include `'operator'` (the spec's literal `ALTER TYPE ... ADD VALUE`
  doesn't apply — `profiles.role` is a plain `TEXT` + `CHECK`, not an enum,
  confirmed against the real schema before writing); widens `orders.status`'s
  CHECK to add `'packaged'`, `'out_for_delivery'`, `'in_production'`
  (needed for the Employee PWA / dispatch flow to reach those statuses at
  all — flagged in the migration's own comments as a deliberate addition
  beyond the original column list); adds `get_tracking_data(token)` and
  `is_order_out_for_delivery(uuid)` SECURITY DEFINER functions so an
  anonymous tracking-page visitor and a public Realtime subscription can
  both read scoped data without a standing anon SELECT grant on
  `driver_locations`.
- `008_order_geocoding.sql` — `orders.geocoded_lat/lng`, a cache so the
  10-mile SMS check in `app/api/driver/location` doesn't re-geocode the
  same jobsite address on every 30-second GPS ping.
- `009_command_center_crm.sql` — `profiles.internal_notes` (freeform CRM
  note field, distinct from the existing `admin_audit_log`-based note
  history), `orders.invoice_paid_at` (manual "Mark Paid" timestamp — there
  is no standalone `invoices` table; every invoice is derived 1:1 from its
  order, see `lib/data/invoices.ts`'s header comment).

**API routes actually built** (vs. §7's table — all present, one method
differs from an unstated assumption):
| Route | Method | Notes |
|---|---|---|
| `/api/driver/location` | POST | Inline operator-or-admin check (not `requireOperatorApi`, written earlier); geocodes + caches on first ping per order, fires the 10-mile SMS once via `delivery_notifications.ten_mile_sent` |
| `/api/orders/[id]/packaged` | **PATCH** | Spec's route table didn't state a method; PATCH was chosen as a partial-state-transition on an existing resource, consistent with this codebase's other status-transition routes |
| `/api/orders/[id]/dispatch` | POST | SMS (opt-in gated) + transactional email (not opt-in gated, per ARCHITECTURE.md §9) + invoice email, in that order; failures in any one never block the others or the status update |
| `/api/orders/[id]/delivered` | POST | No dedicated Realtime broadcast — PWA/tracking page both already key off `orders.status` directly |
| `/api/track/[token]` | GET | Calls `get_tracking_data()`; also exists: `/api/track/verify` (not in the original §7 table — added for the tracking page's own needs) |
| `/api/gbp/queue` | POST | Records a queue row for a photo the client already uploaded to the `gbp-photos` Storage bucket |
| `/api/gbp/post/[id]` | POST | **Rewritten this session (d-007) — see below** |
| `/api/invoices/[id]/send` | POST | Emails the invoice PDF; also exists: `/api/invoices/[id]/pdf` and `/api/invoices/statement` (not in the original §7 table) |

**Employee PWA** (`app/employee/**`, `components/employee/**`,
`lib/employee/orderStatus.ts`): layout + bottom nav (Orders/Photos),
orders list + detail with Package/Dispatch/Deliver actions, photo
uploader that queues into `gbp_photo_queue`. `public/employee-manifest.json`
matches §3's manifest exactly. **Gap found, not fixed this session:**
`scripts/generate-employee-icons.js` exists but has not been run —
`public/employee-icon-192.png`/`employee-icon-512.png` do not exist on
disk yet, so the manifest currently 404s on both icon entries. Run
`pnpm run generate:employee-icons` before shipping the PWA for real
installation (a missing icon doesn't break the web app itself, only the
"Add to Home Screen" experience).

**Command Center CRM tabs** (`app/admin/command-center/page.tsx` +
`components/admin/{CustomersCrmTab,CustomerDetailDrawer,CustomerNotesLog,
CustomerAccountSettingsForm,ExportCustomersCsvButton,OrdersCrmTab,
InvoicesCrmTab,GbpPhotosTab}.tsx`, `lib/data/command-center-crm.ts`):
all four new tabs (Customers/Orders/Invoices/GBP Photos) exist alongside
the original Queue/Approvals tabs, addressable via `?tab=customers`,
`?tab=orders`, `?tab=invoices`, `?tab=gbp`.

### d-007 (this prompt) — what changed

1. **`app/api/gbp/post/[id]/route.ts` rewritten.** The route already
   existed from an earlier prompt but as a full stub matching the
   QuickBooks/PathfinderEdge precedent (never called the real GBP API,
   returned `{ status: 'posted' }` not `{ posted: true }`, 400 not 503 when
   unconfigured). Rewrote to match this prompt's literal spec: checks
   `gbp_photo_queue[id].status = 'approved'` (409 otherwise), generates a
   Storage-signed URL for `storage_key` from the `gbp-photos` bucket (this
   *is* "downloading the photo" in a form Google's Media API can actually
   fetch — the API takes a `sourceUrl` it retrieves server-side, not a
   byte upload), and now really calls
   `POST https://mybusiness.googleapis.com/v4/accounts/{GOOGLE_BUSINESS_LOCATION_ID}/locations/-/media`
   with `{ mediaFormat: 'PHOTO', sourceUrl, category: 'ADDITIONAL' }`. On
   success, updates `status='posted'`/`posted_at` and returns `{ posted: true }`
   exactly as specified. When `isGbpConfigured()` is false, returns exactly
   `{ error: "Google Business Profile not configured. Add credentials in
   /admin/settings/integrations." }` at **503**, per this prompt's literal
   text (this codebase's other stubs, e.g. QuickBooks, use 400 — 503 was
   kept here since the prompt was explicit).

   **Real gap surfaced, not silently papered over:** `GOOGLE_BUSINESS_CLIENT_ID`/
   `_CLIENT_SECRET` are OAuth *app* credentials, not a per-request bearer
   access token — actually calling the v4 Media API needs a real
   authorization-code exchange + refresh-token flow, which only exists once
   `/admin/settings/integrations` (not built) does it. `isGbpConfigured()`
   still only checks CLIENT_ID/SECRET/LOCATION_ID (matching the Command
   Center's existing "is GBP set up at all" UI signal and this prompt's
   literal 503 condition), but `postPhotoToGbp()` separately checks a new
   `GOOGLE_BUSINESS_ACCESS_TOKEN` env var and reports that specific gap by
   name if CLIENT_ID/SECRET/LOCATION_ID are set but the token isn't — added
   to `.env.example` as a documented manual stand-in, not a real OAuth
   implementation. Whoever wires the real OAuth flow should also confirm
   the v4 Media API endpoint shape against current Google docs — Google's
   Business Profile APIs have been consolidated/versioned since v4.9, and
   this route implements this prompt's literal endpoint text rather than
   re-verifying it live (no real credentials exist to test against).

2. **`components/layout/AdminShell.tsx`** — added `🚚 Deliveries` →
   `/admin/command-center?tab=orders` and `📸 GBP Photos` →
   `/admin/command-center?tab=gbp` to the existing Operations section, and
   a new "Employee" section with `📱 Employee App` → `/employee` opening
   in a new tab (`target="_blank"`, added an `openInNewTab` field to the
   `NavItem` type for this). Both new Operations links carry a `?tab=`
   query string, so `isActive()`'s plain `pathname.startsWith(href)` check
   never highlights them as active (it compares against `pathname`, which
   never includes the query string) — a pre-existing minor cosmetic gap in
   how this file's active-state check works, not something this prompt's
   scope asked to fix, and not a functional bug (the links still navigate
   correctly).

3. **`supabase/README.md`** — `009_command_center_crm.sql` existed on disk
   but was completely missing from the migration list and the Dashboard
   apply-order steps (a real staleness bug, not part of this prompt's
   literal ask, fixed anyway since accurately answering "what migrations
   need to be applied" is exactly what this prompt's closing instruction
   asked for). Now lists all three of 007/008/009 with an explicit
   not-yet-applied-to-production note.

### Still needed before this feature block is live

- Apply `007_delivery_tracking.sql`, `008_order_geocoding.sql`,
  `009_command_center_crm.sql` to the live Supabase project, in that order
  (see `supabase/README.md`).
- Set `profiles.role = 'operator'` for Steve and Christian (§10 — requires
  007 applied first).
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / `GOOGLE_MAPS_API_KEY` — confirmed
  still absent from `.env.local` as of this session; the tracking map
  (`components/track/DeliveryTrackingMap.tsx`) cannot render without them.
- `GOOGLE_BUSINESS_CLIENT_ID` / `_CLIENT_SECRET` / `_LOCATION_ID` — none
  set; GBP posting returns 503 until they are.
- `GOOGLE_BUSINESS_ACCESS_TOKEN` (new, this session) — a real OAuth
  exchange flow behind `/admin/settings/integrations` doesn't exist yet;
  until it's built, this env var is the only way to actually post a photo.
- Run `pnpm run generate:employee-icons` to produce the two PWA icon PNGs
  the manifest already references.
- `pnpm tsc --noEmit` / `pnpm run build` could not be run this session —
  the tool-approval gate denied every `pnpm`/`node_modules/.bin` invocation
  with no interactive prompt surfacing (the same recurring blocker logged
  throughout SESSION_STATE.md). This prompt's 3 changed files were
  hand-reviewed line-by-line against this codebase's existing,
  gate-verified patterns (`requireOperatorApi`, `logAdminAction`,
  `createAdminClient().storage.createSignedUrl`, plain global `fetch`) and
  are expected to pass cleanly; run both gates for real before treating
  d-007 as fully verified.

---

*SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md | AFS | Reid Whitesides | July 2026*
