# ARCHITECTURE.md
## AFS — System Architecture
**The technical foundation. Every architectural decision is locked here.**

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL CDN / EDGE                        │
├─────────────────────────────────────────────────────────────────┤
│                     NEXT.JS 14 APP ROUTER                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Server Components│  │   API Routes     │  │  Middleware  │  │
│  │  (SSR / SSG)     │  │   /app/api/**    │  │  Auth gates  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                    │          │
├───────────┼─────────────────────┼────────────────────┼──────────┤
│           ▼                     ▼                    ▼          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                        SUPABASE                            │ │
│  │  PostgreSQL + RLS | Auth | Realtime | Storage              │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │              EXTERNAL SERVICES                             │  │
│  │  Anthropic API | Stripe | Resend | Twilio | TaxJar        │  │
│  │  Google Maps | Metals API | Vercel Cron                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. NEXT.JS APP ROUTER PATTERNS

### Route Groups

```
(public)/   — No auth. All public pages. Cached aggressively at edge.
(auth)/     — Redirect to /account if user already authenticated.
account/    — Requires auth. Server components fetch data server-side.
checkout/   — Requires auth. Stripe Elements loaded client-side.
admin/      — Requires admin role. Verified server-side in middleware AND in API routes.
api/        — Never accessible client-side for auth-sensitive operations.
auth/       — Supabase auth callback handler.
```

### Server vs Client Components

```typescript
// DEFAULT: Server Components
// Fetch data, render HTML, no JavaScript shipped unless needed
// Use for: all page layouts, data display, static content

// Client Components ('use client' directive)
// Use ONLY when needed:
//   — useState, useEffect, event handlers
//   — Stripe Elements
//   — Supabase Realtime subscriptions
//   — File upload with progress
//   — SVG diagram animations

// NEVER use client components for:
//   — Data fetching that can be done server-side
//   — Auth state reading (use server client + cookies)
//   — AI API calls (always server-side)
```

### AppChrome Portal Exclusion Pattern

`components/layout/AppChrome.tsx` wraps every route from the root
`app/layout.tsx` and decides which global chrome (public `NavBar`,
`Footer`, `ChatWidget`) a route gets. It is the single place this
decision is made — individual route `layout.tsx` files (e.g.
`app/admin/layout.tsx`, `app/account/layout.tsx`) never import `NavBar`
themselves.

```typescript
const NO_CHROME_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/invite'];
const PORTAL_PREFIXES = ['/admin', '/account'];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = NO_CHROME_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  const isPortalRoute = PORTAL_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  if (hideChrome || isPortalRoute) {
    return <>{children}</>;              // no NavBar, no Footer, no ChatWidget
  }

  return (
    <>
      <NavBar />
      <div className="ml-48 pt-11">{children}<Footer /></div>
      <ChatWidget />
    </>
  );
}
```

`/admin/**` and `/account/**` render bare `{children}` — no public nav, no
footer, no chat widget — because their own `layout.tsx` already renders a
complete shell (`AdminShell.tsx` / `AccountShell.tsx`) with its own
sidebar, sign-out, and content area. Those shells' `<aside>` elements are
positioned `fixed top-0 left-0`, since there is no public NavBar reserving
space above or to the left of them on these routes. Adding a new
auth-gated portal in the future means adding its prefix to
`PORTAL_PREFIXES` — forgetting this step is exactly what caused the
double-nav bug fixed in afs-036 (public NavBar rendering on top of the
portal's own sidebar).

### Data Fetching Pattern

```typescript
// Server component — fetch directly, no useEffect
export default async function OrderPage({ params }: { params: { id: string } }) {
  const supabase = await createClient(); // server client
  const { data: order, error } = await supabase
    .from('orders')
    .select(`*, order_line_items(*), order_status_history(*)`)
    .eq('id', params.id)
    .single();

  if (error || !order) notFound();
  return <OrderDetail order={order} />;
}

// Never use useEffect + fetch for initial page data
// Never use SWR or React Query for initial data (use for real-time only)
```

---

## 3. AUTHENTICATION ARCHITECTURE

### Supabase Auth Configuration
```
Providers:         Email/password, magic link (OTP)
No OAuth:          No Google, GitHub, or other OAuth at launch
Email confirmation: Enabled — user must confirm before first login
JWT expiry:        1 hour access token, auto-refreshed by middleware
```

### Middleware Auth Flow

```typescript
// middleware.ts — runs on every request to protected routes
// MUST use Supabase SSR client — NOT browser client

export async function middleware(request: NextRequest) {
  // 1. Create SSR Supabase client with cookie access
  // 2. Call supabase.auth.getUser() — this refreshes session if needed
  // 3. If /account/* or /checkout and no user: redirect to /login
  // 4. If /admin/* and no user: redirect to /login
  // 5. If /admin/* and user role !== 'admin': redirect to /account
  // 6. Return response (with refreshed session cookies)
}

// Route protection matrix:
// /account/**   → any authenticated user
// /checkout     → any authenticated user
// /admin/**     → admin role ONLY (checked server-side)
// /api/admin/** → admin role ONLY (checked in route handler too)
// Everything else → public
```

### Role Hierarchy

```
admin       → full access to everything including admin portal
contractor  → account portal, quote requests, orders
architect   → account portal + full architect portal (spec writer, downloads)
customer    → account portal, quote requests, orders (same as contractor)

Note: 'contractor' and 'customer' have identical permissions at launch.
The distinction is for internal AFS context and future pricing tier logic.
```

### Profile Creation on Registration

```typescript
// Triggered by Supabase Auth webhook after successful registration
// OR called directly from registration server action

// Role mapping from registration form account_type:
const roleMap = {
  contractor:  'contractor',
  architect:   'architect',   // Admin review flagged, access granted immediately
  pm_gc:       'customer',
  other:       'customer',
};

// Profile record links to auth.users.id
// ALWAYS created with service role client — bypasses RLS for this insert
```

---

## 4. API ROUTE PATTERNS

### Standard Route Handler

```typescript
// app/api/[resource]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    // validate with zod schema

    // 2. Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Business logic
    // ...

    // 4. Return response
    return NextResponse.json({ result });

  } catch (error) {
    // Log server-side — never expose stack traces to client
    console.error('[API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Admin Route Handler

```typescript
// Additional check for admin routes — never rely on middleware alone
async function requireAdmin(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  if (profile?.role !== 'admin') throw new Error('Forbidden');
  return user;
}
```

### AI Route Handler (Streaming)

```typescript
// app/api/chat/route.ts — streaming response pattern
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  });

  return new Response(stream.toReadableStream());
}
// NEVER: call Anthropic from client components
// NEVER: return API key to client
// NEVER: use a different model than claude-sonnet-4-6
```

---

## 5. DATABASE ARCHITECTURE

### RLS Enforcement Strategy

```sql
-- EVERY table has RLS enabled before any feature uses it
-- Pattern for user-owned data:
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_orders" ON orders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "admin_all_orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Pattern for public read / admin write (products, materials):
CREATE POLICY "authenticated_read" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "admin_write" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### Supabase Storage Buckets

```
blueprints          private   50MB/file    Uploaded drawings for AI takeoff
documents           private   100MB/file   Project document vault
cad-library         private   250MB/file   CAD/BIM files (browse public, download auth)
orders              private   25MB/file    Pre-ship photos, delivery confirmations
```

**Per Supabase's own docs** (`/docs/guides/storage/uploads/file-limits`),
these per-bucket numbers are only reachable if the project's *global* Storage
file size limit (Dashboard → Storage → Settings) is raised to match — a
bucket limit can never exceed the global one, and the global one itself
maxes out at **50MB on the Free plan**; Pro/Team allow up to 500GB. That
means:
- The `blueprints` bucket's 50MB is exactly the Free-plan ceiling — it only
  works if the global limit has been explicitly raised to 50MB (nothing in
  this repo does that; it's a dashboard setting). A fresh/default project
  may be lower.
- `documents` (100MB) and `cad-library` (250MB) are **not possible on the
  Free plan at all** — they require Pro or higher.
No MCP/CLI access to this project's actual Supabase dashboard config was
available to confirm the current setting — verify in Storage Settings before
relying on any of the above.

### Realtime Subscriptions

Used selectively — only where real-time updates materially improve UX:

```
orders table:        Customer order detail page (status changes appear instantly)
Production queue:    Admin production queue (status changes from shop floor)
```

Not used for: everything else. Server-side polling is acceptable for non-critical updates.

---

## 6. ORDER LIFECYCLE

```
quote_request submitted
  ↓
quote_request.status = 'submitted'
Admin notified
  ↓
Estimator opens in admin portal
quote_request.status = 'reviewing'
Pricing engine pre-populates line item prices
Estimator reviews, adjusts, approves
  ↓
Formal quote created: quotes.status = 'sent'
Customer notified: "Your quote is ready"
  ↓
Customer views quote in /account/quotes/[id]
Customer clicks "Approve & Pay"
  ↓
Checkout: delivery info + payment
Stripe PaymentIntent created from quotes.total
Payment succeeds → webhook fires (payment_intent.succeeded)
  ↓ (client also calls POST /api/checkout/confirm-order as a synchronous
     fallback right after stripe.confirmCardPayment resolves — whichever of
     {webhook, confirm-order} runs first creates the order via the shared,
     idempotent createOrderFromQuote(); the second call is a no-op. See
     ORDER_LIFECYCLE_DECISION.md.)
order created: orders.status = 'submitted'
quote.status = 'converted'
order_status_history record inserted
Customer confirmation email + SMS
Admin notified: new order in production queue
  ↓
Admin advances order through production stages:
submitted → received → in_queue → cutting → bending → qc → ready → shipped → delivered
Each stage transition:
  - order_status_history record inserted
  - Customer notified (email + SMS if opted in)
  - Realtime update fires on customer's order detail page
  ↓
orders.status = 'delivered'
Customer follow-up email
```

### Machine Job Lifecycle (Parallel to Order Lifecycle)

A `machine_jobs` row tracks whether an order/quote request's bend program
has been approved, generated, and delivered to the Thalmann DS2801 — a
separate lifecycle from `orders.status`, which only tracks physical
fabrication stage and has no machine-delivery states. Nothing currently
auto-creates `machine_jobs` rows from real `orders`/`quote_requests` — an
admin (or a future feature) creates them; the Command Center at
`/admin/command-center` is where they're reviewed. See ARCHITECTURE.md §11
for the bridge that consumes `approved_for_machine` jobs.

```
machine_jobs.status:
  pending_approval      → awaiting admin review in Command Center
  approved_for_machine  → admin approved; the Machine Bridge will pick it up
       ↓ (Machine Bridge polls, generates a .ds1 file)
  staged_for_review     → .ds1 written to the bridge's local review/ folder —
                           NOT yet in the machine's live folder; the format is
                           only partially verified, so a human must check it
       ↓ (admin manually verifies + copies the file, clicks "Mark as Sent")
  sent_to_machine       → confirmed in the machine's live folder
       ↓
  completed             → fabrication finished
  machine_error          bridge failed to generate/stage the file
  rejected                admin rejected (rejection_reason set)
  changes_requested       admin asked the customer to revise something
```

---

## 7. PRICING ARCHITECTURE (INTERNAL ONLY)

The pricing engine runs server-side in the admin context only. It is never
invoked from customer-facing routes.

```typescript
// ADMIN ONLY — /api/admin/pricing/* routes

// Flow:
// 1. Estimator opens quote request in admin portal
// 2. calculateLineItemPrice() called for each line item
// 3. Function reads: pricing_rules, commodity_prices, contractor_pricing
// 4. Returns: suggested price, margin, trend risk
// 5. Estimator reviews, overrides if needed
// 6. Estimator sends formal quote to customer
// 7. Formal quote stored in quotes table with AFS-approved prices
// 8. Customer sees prices ONLY in /account/quotes/[id]

// See PRICING_ENGINE.md for complete implementation spec
```

---

## 8. FILE PROCESSING PIPELINE (PHASE 1)

**Revised (2026-08-03) — direct-to-Storage upload.** Vercel serverless
functions have a hard, unconfigurable 4.5MB request body limit
(`FUNCTION_PAYLOAD_TOO_LARGE`, plain text not JSON) — well under this app's
50MB business limit. No file's raw bytes may ever be sent to an `app/api/*`
route. The file goes browser → Supabase Storage directly, authorized by a
short-lived signed upload URL; API routes only ever see metadata or the
already-uploaded bytes (fetched server-side via the admin client, not
received from the client's request body).

```
Client → POST /api/upload { filename, fileSize }   (JSON, no file bytes)
  Server validates: extension, claimed size (a friendly pre-check only —
    not authoritative; see step below)
  Server calls admin.storage.from('blueprints').createSignedUploadUrl(path)
  Server inserts takeoff_uploads record, status: 'pending'
  Returns: { uploadId, storageKey, token }
  ↓
Client → supabase.storage.from('blueprints').uploadToSignedUrl(storageKey, token, file)
  Browser PUTs the file directly to Supabase Storage. Never touches this
  app's servers — this is the request that actually carries the bytes.
  ↓
Client → POST /api/takeoff { uploadId, storageKey, fileType, scopeDirective }
  Server downloads file from Storage (admin client — this is the first
    point in the pipeline holding the real bytes)
  Enforces real size (50MB) and, for PDFs, real page count (100) here —
    the authoritative check, since nothing upstream saw true bytes
  Converts to base64, calls claude-sonnet-4-6 with file + TAKEOFF_SYSTEM_PROMPT
  Parses structured JSON response
  Updates takeoff_uploads.result_items
  Returns: { items: TakeoffItem[], confidence, status }
  ↓
Client displays TakeoffResultsTable (user edits/confirms)
  ↓
Client → POST /api/quote-requests { uploadId, confirmedItems, ... }
  Server creates quote_requests record
  Notifies admin
  Returns: { requestId, requestNumber }
```

Photo-to-Quote AI (not yet built — see SPEC_PHOTO_TO_QUOTE_AI.md) will face
the identical 4.5MB wall on any real multi-photo upload and must use this
same direct-to-Storage pattern from the start, not the old multipart-through-
serverless approach.

---

## 9. NOTIFICATION ARCHITECTURE

```
Trigger source:    Supabase database trigger OR API route after status change
Email channel:     Resend SDK — lib/resend/send.ts
SMS channel:       Twilio SDK — lib/twilio/sms.ts
Storage:           notifications table (every send attempt logged)
Failure policy:    Log and continue — notification failure must NEVER block order flow

Order of operations in every notification function:
1. Fetch order + user + preferences from DB
2. Check user's email/SMS opt-in flags
3. Build template variables
4. Send email (if opted in or transactional)
5. Send SMS (if phone set AND sms_opt_in = true)
6. Insert notifications record (success or failure)
7. Never throw — catch and log all errors
```

---

## 10. CRON JOBS (VERCEL CRON)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/commodity-prices",
      "schedule": "0 22 * * 1-5"
    },
    {
      "path": "/api/cron/pricing-trends",
      "schedule": "0 4 * * *"
    }
  ]
}
```

Both routes verify `Authorization: Bearer {CRON_SECRET}` header before executing.

---

## 11. MACHINE BRIDGE ARCHITECTURE

The Thalmann DS2801 bending machine (serial P0700707) is fed by **AFS
Machine Bridge**, a standalone Node.js polling service that afs-website's
team built and owns.

> **Corrected 2026-09-24 (FlashDraft audit).** This paragraph previously
> stated the machine "is not integrated via any third-party API" because
> PathfinderEdge "turned out to have no discoverable integration surface."
> That is **wrong and contradicts §12 of this same file.** PathfinderEdge
> has a real, working, documented REST API which this codebase uses in
> production — the original probe simply used the wrong auth format (the
> key goes in `Authorization` RAW, with no `Bearer`/`X-API-Key` prefix).
> Re-confirmed live during the audit: `GET /api/v1/catalogs` → 200 in
> 2.46s. So the machine now has **two** independent paths to a job: this
> Bridge's human-reviewed `.ds1` file, and a direct push to
> PathfinderEdge catalog 20115, which the machine polls automatically
> (§12, and `lib/integrations/pathfinder-edge.ts`). What PathfinderEdge
> genuinely lacks is a *job-submission/job-status* surface and any way to
> trigger or expedite a sync — not an API altogether.

This is a
**separate project, not part of this repo**: own `package.json`, own git
repository. Dev-machine copy: `C:\Users\manag\Documents\afs-machine-bridge`.
Its own README documents installing a copy at `C:\afs-machine-bridge` on
the shop-floor computer (`DESKTOP-MB7AMMP`) as a Windows service via
`npm run install-service`.

```
┌──────────────────────┐        Bearer AFS_BRIDGE_SECRET        ┌─────────────────────────┐
│   AFS Machine Bridge  │ ───── GET  /api/machine-bridge/ ─────▶ │                         │
│  (shop-floor Windows  │        pending-jobs (every 30s)        │   afs-website (Vercel)  │
│   service, or dev     │                                        │                         │
│   machine for now)    │ ───── POST /api/machine-bridge/ ─────▶ │  machine_jobs table     │
│                       │        job-delivered                   │  machine_bridge_status  │
└──────────┬────────────┘                                        └─────────────────────────┘
           │ generates
           ▼
   review/{requestNumber}_{profileName}.ds1   ← NEVER written directly to
           │                                     THALMANN_DS2801_PATH
           │ human verifies + manually copies
           ▼
   Thalmann DS2801's watched live folder
```

### DS1 Binary File Generation Pipeline

`.ds1` is the Thalmann DS2801's bend-program file format. No official
format documentation exists — the generator (`src/ds1-generator.js` in
the bridge project) was reverse-engineered by byte-level analysis of two
real sample files (`machine-data/AFS_Profile_A-Profiles.ds1`,
`AFS_Profile_Breast_plates.ds1`):

- **Verified with reasonable confidence:** the string header — four
  Pascal-style length-prefixed strings (magic `DS2801ProfileV301`,
  version, profile name, material name).
- **NOT verified — best-effort placeholder:** everything after the
  header. The numeric/bend-step region does not follow a simple
  fixed-size repeating structure, and neither sample file corresponds to
  a known record in the imported `ds2801db.bdb` data, so there was no
  independent way to confirm field order, count, or meaning.

Because of this, **the bridge never writes directly into the machine's
live folder.** Every generated file lands in the bridge's local `review/`
directory. A human must open each file, confirm it loads correctly in the
real Thalmann DS2801 software, and manually copy it into the live folder
before that job is actually sent to the machine — this gate must not be
removed until someone with real Thalmann format knowledge confirms a
generated file is correct. See STATE_OF_THE_BUILD.md for the current
audited status of this pipeline (as of 2026-07-13, it is not yet
successfully delivering jobs — see that document for detail).

### Machine Bridge Authentication

The bridge is a service, not a logged-in Supabase user, so it
authenticates with a shared Bearer secret instead of session auth:

```typescript
// lib/machine-bridge/auth.ts
export function isAuthorizedBridgeRequest(request: NextRequest): boolean {
  const secret = process.env.AFS_BRIDGE_SECRET;
  // ...timing-safe comparison against the Authorization: Bearer header
}
```

`AFS_BRIDGE_SECRET` must be set identically in afs-website's deployed
environment and in the bridge's own `.env` — a mismatch produces an HTTP
401 on every poll (the bridge logs, but does not crash, on auth failure).

---

## 12. PATHFINDEREDGE INTEGRATION (LIVE)

**Real as of 2026-08-18.** An earlier discovery pass found no REST API at
conventional paths against `https://afs.pathfinderedge.com` (all 404,
`/` redirects to session-based `/login`) and concluded no API existed.
That conclusion was wrong — the probe tried `Bearer`-prefixed auth; the
real API (documented at
https://docs.amscontrols.com/pathfinderEdge/publicapi and
https://docs.amscontrols.com/pathfinderEdge/profile-object) requires the
key raw, unprefixed, in the `Authorization` header. Confirmed live both
via `GET /api/v1/catalogs` (200, real catalog data) and a full
create → resolve-id → read-back → delete round-trip
(`scripts/pathfinder-roundtrip-test.ts`).

```
lib/integrations/pathfinder-edge.ts
  getPathfinderCatalogs()               real GET /api/v1/catalogs
  pushProfileToPathfinder(profile, id)   real POST /api/v1/profiles, then a
                                         follow-up GET /api/v1/profiles?catalog=
                                         to resolve the created profileId (the
                                         POST response never echoes it — see
                                         the file's own comment)
  discoverApiEndpoints()                 real connectivity check (GET /api/v1/catalogs)
  submitJobToMachine() / getJobStatus()  still not_configured — PathfinderEdge's
                                         API has no job-submission/status
                                         endpoint at all (confirmed via
                                         https://docs.amscontrols.com/pathfinderEdge/machine-sync),
                                         not a gap in this client
```

**Machine sync model:** `POST /api/v1/profiles` writes to the tenant's
profile LIBRARY only. There is no "push to machine" call. Catalog 20115
("afs") is the only catalog the Thalmann DS2801 subscribes to (confirmed
by Seth Oliver) — a profile POSTed there is picked up by the machine
automatically on its own polling schedule.

**Units:** confirmed empirically as inches (not documented explicitly by
AMS) — `scripts/pathfinder-roundtrip-test.ts`'s "unit plausibility check"
against 10 real existing catalog-20115 profiles (blankWidth 2.375-23.5,
plausible only as inches for real flashing parts) plus a known 6"
create/read-back both agree. `mmToIn()` in pathfinder-edge.ts implements
this.

**Wired to the live approve flow:**
`app/api/admin/command-center/approve/route.ts` now calls
`pushProfileToPathfinder` with the job's real bend data before
transitioning `machine_jobs.status` to `approved_for_machine` — if the
push fails, the job stays `pending_approval` and the admin sees the real
PathfinderEdge error, rather than the status flag silently flipping with
no real API call (its prior behavior).

**Known gap — no hem data.** Neither `machine_profile_bends` nor
`machine_jobs.custom_bends` stores any hem information (see SCHEMA.md) —
`buildFeatures()` in pathfinder-edge.ts only ever emits `Straight`/
`Angle`/`Radius` features, never `OpenHem`/`TearDropHem`, even for a job
that has real hems. Fixing this needs a data-model change (a new column
or table), not a client-side fix — flagged, not silently dropped.

**Open, not empirically confirmed:** the bend-angle sign/interior-angle
convention passed to PathfinderEdge's `Angle`/`Radius` features
(`bendAngleDegrees` passed straight through — see pathfinder-edge.ts's own
comment) and the `radiusQuality: 'Medium'` placeholder default (no real
per-bend quality data exists anywhere in this schema). The round-trip
test only exercised a bendless profile, deliberately, to isolate the
units question — a real bend push has not yet been visually confirmed
against the machine/PathfinderEdge's own rendering.

**Relationship to the Machine Bridge (§11) — flagged, not resolved this
pass.** The separate `afs-machine-bridge` project still polls
`approved_for_machine` jobs and generates `.ds1` files for a human to
manually review and copy to the machine's live folder. Approving a job
now ALSO pushes it to PathfinderEdge's catalog 20115, which the machine
polls automatically per the machine-sync model above. That means an
approved job may now reach the machine via two independent paths — the
Machine Bridge's human-reviewed `.ds1` copy AND PathfinderEdge's
automatic catalog poll. Whether one of these should be disabled, and
which, is a real open question this pass did not resolve — it was out of
scope for the prompt that wired the approve button, and needs a decision,
not a default.

---

*ARCHITECTURE.md | AFS | Reid Whitesides | June 2026*
