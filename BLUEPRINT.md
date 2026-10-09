# BLUEPRINT.md
## AFS — FORGE Master Build Document
**Read by FORGE on every prompt execution. The operational rulebook.**

---

## 1. PROJECT IDENTITY

| Field | Value |
|---|---|
| Client | AFS — Architectural Flashing Supply |
| Developer | Reid Whitesides — Visual AI Method |
| Platform | Full-stack B2B SaaS — RFQ commerce, architect resources, AI quoting, production tracking |
| Build system | FORGE autonomous prompt queue |
| Repo | GitHub private — Reid64 org |
| Deployment | Vercel |
| Domain | Pending DNS access |

---

## 2. TECH STACK — LOCKED

```
Framework:        Next.js 14+ App Router (TypeScript strict)
Package manager:  pnpm — NEVER npm or yarn
Styling:          Tailwind CSS + CSS custom properties (afs-* token system)
Database:         Supabase — PostgreSQL, RLS, Auth, Realtime, Storage
Auth:             Supabase Auth (email/password, magic link — no OAuth providers)
Storage:          Supabase Storage (blueprints, documents, CAD, order photos)
Payments:         Stripe (cards, ACH, deposit flows)
Email:            Resend (all transactional email)
SMS:              Twilio (production update notifications)
AI:               Anthropic Claude API — claude-sonnet-4-6 exclusively
Tax:              TaxJar (multi-state nexus compliance)
Maps:             Google Maps API (delivery tracking, address autocomplete)
Testing:          Playwright (end-to-end — required gate on every UI prompt)
Deployment:       Vercel
Source control:   GitHub
```

---

## 3. DESIGN SYSTEM — LOCKED FROM LOGO ANALYSIS

The AFS logo is a dimensional chrome-beveled shield with crimson letterforms on a
deep graphite background. The design system is derived from the tonal zones of that
logo. See DESIGN_TOKENS.md for complete specification.

**Theme:** Single fixed gunmetal theme. Not dark mode. Not light mode.
The interior of the shield is the site.

**Locked means locked — confirmed by a real reversal, not just this
document's original wording.** A site-wide light silver rebrand was built
and shipped (`b3512f1`) per an explicit instruction, then fully reverted
(`git revert b3512f1` → `6903d00`) one session later per an equally
explicit instruction that the light theme had been "applied in error."
Dark gunmetal is canonical. Two narrow, deliberately-scoped exceptions
remain layered on top of the reverted dark theme — they are not a
design-system change and do not reopen the light-theme question:
  - `app/(public)/products/page.tsx`, `app/configure/page.tsx`,
    `app/quote/page.tsx` each have one inline `#B8BEC8` background on their
    main content div, plus crimson/black bold titles — per an explicit
    instruction naming exactly these files and forbidding any other change.
  - `afs-ink-900`/`afs-ink-700` were re-added as real afs-* tokens (not the
    rest of the light theme) because FlashDraft's 2D canvas needs dark
    dimension-label text on its light drawing surface.
See DESIGN_TOKENS.md and STATE_OF_THE_BUILD.md for the full afs-027 →
afs-028 → afs-029 sequence.

**Background scale (darkest to mid-tone):**
```
#14151A  — depressed states, code blocks
#1A1A1E  — page background (shield interior)
#22242A  — cards, nav, dropdowns
#2A2D35  — table rows, sidebars
#32363F  — hover states, input fields
```

**Chrome type hierarchy (from bevel gradient):**
```
#D8E0EC  — headlines
#A0AABC  — subheadings, labels
#6B7A94  — body text
#48526A  — borders, dividers
```

**Fixed accent:**
```
#C0001A  — crimson — the only warm tone — CTAs, logo, alerts
#B87333  — copper — architect portal only
```

**Typography:**
```
Bebas Neue      — display, hero headlines, stat numbers
Barlow Condensed — page headings, product names
Barlow          — navigation, buttons, labels
Inter           — all body text
JetBrains Mono  — part numbers, dimensions, data fields
```

**Signature element — The Metal Edge:**
A 1px diagonal-cut rule at 12° skew applied via `.metal-edge` CSS class.
References the bevel geometry of the AFS shield logo.
Applied to hero sections, feature cards, primary CTA containers.

---

## 4. DIRECTORY STRUCTURE

```
afs-web/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    /
│   │   ├── products/[category]/[slug]/ /products/...
│   │   ├── quote/                      /quote
│   │   ├── configure/                  /configure
│   │   ├── upload/                     /upload
│   │   ├── track/[orderId]/            /track/[id]
│   │   ├── architects/                 /architects/...
│   │   ├── about/                      /about
│   │   ├── contact/                    /contact
│   │   └── legal/                      /legal/...
│   ├── (auth)/
│   │   ├── login/                      /login
│   │   ├── register/                   /register
│   │   ├── forgot-password/            /forgot-password
│   │   ├── reset-password/             /reset-password
│   │   └── invite/[token]/             /invite/[token]
│   ├── auth/callback/                  /auth/callback
│   ├── account/                        /account/...
│   ├── checkout/                       /checkout
│   ├── studio/                         /studio/... (Design Studio — primary
│   │   ├── page.tsx                    nav destination, see NavBar.tsx)
│   │   ├── draft/                      /studio/draft (FlashDraft canvas tool)
│   │   └── profile-viewer/[profileId]/ /studio/profile-viewer/[id] (3D viewer,
│   │                                    standalone shareable route)
│   ├── admin/                          /admin/... (includes command-center,
│   │                                    quickbooks, pathfinder — see SITEMAP.md)
│   └── api/                            All server-side routes
├── components/
│   ├── ui/                             Primitive components
│   ├── layout/                         NavBar, Footer, shells
│   ├── upload/                         Blueprint + document upload
│   ├── drawing/                        Drawing tool components
│   ├── quote/                          Quote request wizard
│   ├── configurator/                   Flashing configurator
│   ├── product/                        Catalog components
│   ├── account/                        Customer portal
│   ├── architects/                     Architect portal
│   ├── admin/                          Admin portal
│   └── ai/                             AI feature components
├── lib/
│   ├── supabase/                       client.ts, server.ts, middleware.ts
│   ├── anthropic/                      quote.ts, spec.ts, takeoff.ts, chat.ts
│   ├── stripe/                         client.ts, checkout.ts, webhooks.ts
│   ├── pricing/                        engine.ts, freight.ts, trends.ts
│   ├── resend/                         client.ts, send.ts, templates/
│   ├── twilio/                         client.ts, sms.ts
│   ├── taxjar/                         calculate.ts
│   └── utils/                          profile-svg.ts, file-validation.ts, format.ts
├── types/
│   ├── database.types.ts               Generated from Supabase schema
│   ├── quote.types.ts
│   ├── upload.types.ts
│   └── order.types.ts
├── public/
│   └── assets/
│       └── afs-logo.png                AFS shield logo (2404×1080 PNG)
├── middleware.ts                        Auth enforcement
├── tailwind.config.ts
├── next.config.ts
└── .env.local
```

**Not part of this tree — a separate service.** The Thalmann DS2801
bending machine is fed by `afs-machine-bridge`, a standalone Node.js
project with its own `package.json` and its own git repository — not a
directory inside this repo, not a Next.js route. Its dev-machine working
copy lives at `C:\Users\manag\Documents\afs-machine-bridge`; its own
README documents installing a copy at `C:\afs-machine-bridge` on the
shop-floor computer (`DESKTOP-MB7AMMP`) as a Windows service. It
authenticates to this repo's `app/api/machine-bridge/*` routes via a
shared `AFS_BRIDGE_SECRET` Bearer token instead of Supabase session auth.
See ARCHITECTURE.md §11 and STATE_OF_THE_BUILD.md for its current audited
status.

---

## 5. BUILD PHASES

### Phase 0 — Scaffold + Design System
Next.js project init, pnpm install, Tailwind config with afs-* tokens, Google
Fonts via next/font, CSS custom properties, layout shell, NavBar, Footer,
PageShell, Button, Badge, Card primitives. Directory structure created.
No features. Pure foundation.

### Phase 1 — Drawing Tool + Document Upload (BUILT FIRST)
Blueprint Takeoff AI interface. File upload pipeline. AI extraction flow.
Three-context document system (vault, CAD library, order attachments).
This phase is first because it is the highest complexity, surfaces integration
problems early, and gives an immediately demonstrable client artifact.

### Phase 2 — Quote Request System
Multi-step quote request wizard (no prices — RFQ model). Custom Flashing
Configurator with live SVG diagram. Auto Material Calculator (quantities only).
Photo-to-Quote AI. AI Order Validator. Trim Length Optimizer.

### Phase 3 — Product Catalog + Auth + Checkout
Product catalog with filters. Product detail pages (no pricing). Auth system
(register, login, magic link, password reset, team invitations). Checkout
flow that collects payment after AFS delivers a formal quote.

**Catalog source data, as of 2026-10-01 (branch `products-manifest`, not yet
merged):** `lib/data/product-renders.manifest.json` holds 64 reviewed entries
built from the 75 Drexel Metals renderings, with the images themselves in
`public/images/products/`. 27 entries carry a real `ProfileType` and can offer
Select & Design plus the 3D rotation; 37 get Request a Quote only.

**`/products` is BUILT against that data (branch `products-page`, cut from
`products-manifest`, 2026-10-01 — not merged, not deployed).** It shows 35
entries in 8 categories: the publishable set, `type === "product"` and not
`needsReview`. 17 of them offer **Select & Design** (which opens FlashDraft on
that profile through its existing `?loadCanonical=1` handoff) plus one slow 18-
second 3D rotation that never loops; 18 offer **Request a Quote** only. The data
layer is `lib/data/products-page.ts` — one filter, one name derivation, one
display-only category mapping that renames nothing in
`lib/data/profile-categories.ts`. Roofing is pinned last; `Standing Seam` folds
into `Roofing Panels`. No prices, no cart, no Configurator, no RUSH badge, and
an e2e that fails if any of those reappear. Full detail:
`docs/PRODUCT_PAGE_NOTES.md`.

**The catalog's remaining hard blocker is PRODUCT COPY, and it is unchanged.**
Every one of the 75 renderings is wordless — the descriptions are not printed in
the images, contrary to what was assumed. `description` is empty on all 64
entries and `nameSource` is `"filename"` on all 64, so **every name on the live
page is a filename derivation that nobody has verified**. Corrections go in
`lib/data/product-name-overrides.ts` (ships empty) — not in a component.

**Also still deferred:** material and gauge filters (the manifest has no
material data at all, and a filter matching nothing is worse than none); the
per-product detail pages at `/products/[category]/[slug]`, which still run on
the older `lib/data/catalog.ts` content; and the 26 flagged entries plus the two
category-vocabulary questions, both PENDING REID in `docs/PRODUCT_MANIFEST.md`.


### Phase 4 — Customer Portal
Dashboard. Order detail with production timeline. Quote approval and order flow.
Delivery scheduler. Invoice portal. Multi-project management. Team accounts.
Saved templates. Notification preferences. Automated email and SMS.

### Phase 5 — Architect Portal
Portal landing. AI Spec Writer (CSI Division 07). CAD/BIM library. Finish
palette. Custom profile library. Material specification library. Installation
guides. Architectural resource center. Design consultation requests.

### Phase 6 — Admin + Operations
Admin dashboard. Production queue with status advancement. Quote request
management. Internal pricing engine and estimator UI. Customer management.
Freight calculation tool. Rush order queue.

### Phase 7 — AI Layer
Customer support chatbot. AI Product Finder. AI Material Recommendations.
AI Installation Advisor. AI Cross-Sell recommendations.

### Phase 8 — Integrations + QA + Deploy
QuickBooks sync (conditional). Vercel Cron jobs for commodity pricing.
Full Playwright test suite. Vercel production deploy. DNS configuration.

### Phase 9 (beyond the original queue) — Design Studio + Machine Integration
Not part of the original 9-phase plan — added after Phase 0–8 shipped.
Built: the Design Studio (`/studio`, a primary NavBar destination alongside
Products/Quote/Configure/Upload/Architects), FlashDraft (`/studio/draft` —
2D bend-profile canvas tool with drag-to-draw, snapping, undo/redo, and
per-bend radius handles), the 3D Profile Viewer
(`components/studio/ProfileViewer3D.tsx`, integrated into FlashDraft, the
upload results page, and a standalone shareable route at
`/studio/profile-viewer/[profileId]`), the Thalmann DS2801 machine profile
library import (911 real shop profiles, 70 public / 841 private — see
SCHEMA.md), a **live, working PathfinderEdge integration** (this line
previously read "integration stub (no discoverable REST API)" — that was
wrong, from a probe using the wrong auth format, and is corrected here
2026-09-24 against live evidence: `GET /api/v1/catalogs` returns 200 with
real catalog data, and real profiles have been pushed from FlashDraft.
Note the API has no way to trigger or expedite a machine sync, and no
`syncDate`/`forceSyncDate` fields — machines pull on their own schedule.
See `lib/integrations/pathfinder-edge.ts` and STATE_OF_THE_BUILD.md's
2026-09-24 audit entry), and the AFS Machine Bridge + admin Command Center
(`/admin/command-center`) for routing admin-approved jobs to a `.ds1` bend
program file. See STATE_OF_THE_BUILD.md for exact build status and the
Machine Bridge's current audited (not yet fully working) state.

**FlashDraft UI, as of the afs-jf-006/007/008 remedial pass:** the sidebar's
"Profile Match" list was removed (the split-screen 3D exact-match view it
fed is unaffected — see `showSplit`/`MatchedProfile3DModal`). The upper-left
canvas overlay reads "Name your profile" (was "Untitled Profile") and has
its own X to dismiss it (a small "Profile Info" pill reopens it). Job Info
(Business Name/Client Name/PO Number/Job Name/Requested Delivery Date, all
optional) — **as of Phase 3b, reverted from afs-jf-006's right-side
slide-out drawer back to a left-side pop-down**, rendered inline inside
the same translucent "Profile Info" overlay box (grows it downward when
open) instead of a separate opaque full-height panel; closing it from
either X still clears all five fields (afs-jf-006's fix for the old
close-doesn't-clear persist bug — kept, only the position/style reverted).
Business Name auto-populates from
`profiles.company` on login, without overwriting a value already restored
from autosave or already typed. The "Load" button ("Load Profiles") now
reads the signed-in user's own Profile Passport rows
(`saved_configurations`, `dimensions->>kind = 'flashdraft'`) instead of the
shop's `machine_profiles` library, with Profile Name/Date Created/Job Name
columns and a hover quick-view thumbnail
(`components/studio/CanonicalProfileDiagram.tsx`) — sign-in is required, an
unauthenticated user sees a sign-in prompt. The Thalmann machine-profile
library is real shop history (SCHEMA.md) and was deliberately NOT deleted;
see STATE_OF_THE_BUILD.md for that discrepancy.

**FlashDraft — Phase 3b (Command Center integration):** "Send to
PathfinderEdge" no longer shows just because the signed-in user has the
admin role — it now also requires `adminContext` (a new state flag set
only by `?admin=1` on the URL), so a customer or an admin who happens to
open the otherwise-public `/studio/draft` directly never sees it.
`AdminTopBar.tsx` gained a direct "FlashDraft" nav link
(`/studio/draft?admin=1`), and `CommandCenterJobCard.tsx` (the Sent/
Completed jobs list) gained an "Open in FlashDraft →" link under its
bend-sequence diagram for any job with real bends, handing off that job's
geometry via a new shared localStorage pattern
(`lib/flashdraft/admin-job-handoff.ts`, same approach as the existing
canonical-profile handoff) rather than a new API route. See
STATE_OF_THE_BUILD.md for the real mm-vs-inches bug this surfaced and
fixed, and for which two sub-items still need Reid's own admin-account
verification.

### Phase 9 addendum — Command Center redesign (afs-cc-001, "FORGE 2.0 Phase 2")
A separate build queue outside this file's own Phase 0–9 numbering — named
"Phase 2" by that queue, not this document's Phase 2 (Quote Request System,
already shipped). Referenced here as afs-cc-001 to avoid the collision.
Rebuilt `/admin/command-center`'s dashboard and the whole admin nav shell
against a spec that assumed some things about this codebase that weren't
true (a `customers`/`invoices`/`production_queue` table set that doesn't
exist — see STATE_OF_THE_BUILD.md's matching entry for exactly how each was
reconciled against the real schema).

**Nav (`components/layout/AdminShell.tsx` + new `AdminTopBar.tsx`):** left
sidebar simplified from 13 links across 3 titled sections down to exactly 6
(Dashboard, Quote Requests, Production Queue, Orders, Customers, Settings).
A new sticky top bar (`fixed`, spans right of the sidebar) duplicates 5 of
those as tabs (Dashboard/Quote Requests/Production/Orders/Customers) plus a
customer-search box, `MachineBridgeStatusDot` (moved here from the old
dashboard), and a Settings gear popover (QuickBooks + Dynamic Pricing
Engine, both "Coming Soon" — the real pages behind both are still live at
`/admin/quickbooks` and `/admin/pricing`, just no longer directly in the
sidebar; `/admin/settings` links to Pricing too). Consultations, Bid
Monitor, Shop View, Employee App, Credit Apps, Building Codes, and the old
Command Center CRM "Bids" tab all lost their nav links but NOT their
routes/components — all still load at their existing URLs, matching this
codebase's pre-existing pattern for unlinked admin tools (see
`app/admin/geometry-test/page.tsx`'s own comment). "Orders" is a new route,
`/admin/orders-crm` (customer record/dispatch/invoicing — promoted out of
the old `?tab=orders` Command Center tab), kept distinct from
`/admin/orders` ("Production Queue"/"Production" — real-time fabrication
stage tracking, unchanged) since that URL was already taken.

**Dashboard (`app/admin/command-center/page.tsx` when no `?tab=` is
present, composed by `components/admin/CommandCenterDashboard.tsx`):**
- 4 metric cards (`components/admin/dashboard/MetricCard.tsx`) — Quote-to-
  Order Conversion (3-month sparkline), Average Order Value (vs. last
  month), Production Cycle Time (vs. a target — see below), Revenue This
  Month (vs. a goal — see below). All backed by real `quotes`/`orders`/
  `order_status_history` queries in `lib/data/command-center-dashboard.ts`.
- Order Pipeline funnel (`OrderPipelineFunnel.tsx`) — Quotes → Orders → In
  Production → Ready → Delivered, 90-day rolling window, proportional bar
  widths, hover shows stage-over-stage %.
- Production Status table (`ProductionStatusTable.tsx`) — reuses
  `getProductionQueue` (the same data `/admin/orders` shows), re-sorted
  overdue/at-risk first, click a row to expand.
- Pending Actions (`PendingActionsPanel.tsx`) — Quotes Awaiting Approval
  (→ the real approve-and-send-to-Thalmann queue at `?tab=pending`), Orders
  Awaiting Material Pickup, Invoices Past 30 Days (reuses `getCrmInvoices`'
  existing overdue derivation).
- Customer Health (`CustomerHealthSection.tsx`) — top 5 customers by
  calendar-YTD order value, 5 most recent orders.
- Two placeholder constants have no configured value anywhere in the schema
  and are named/documented in `lib/data/command-center-dashboard.ts` rather
  than buried in JSX, pending real numbers from Steve:
  `PRODUCTION_CYCLE_TARGET_DAYS` (3.5, matching the spec author's own
  example) and `REVENUE_GOAL_MONTHLY` ($150,000, same).
- Old dashboard fully deleted: the "Pending Approval"/"Sent to Machine"
  status-strip cards, the Quote Requests/Machine Queue preview feeds, the
  Outstanding Invoices box, Recent Customers box, and the GBP Photo
  Queue/Active Deliveries bottom strip. `getOrderStatusCounts`/
  `getGbpPendingCount`/`getRecentQuoteRequests` were deleted from
  `lib/data/command-center-dashboard.ts` as a result — each had exactly one
  caller, this page, and nothing else needed them.

Not independently confirmed by Reid against a real signed-in admin
session — see STATE_OF_THE_BUILD.md's verification-standard caveat on this
same entry.

### Phase 9 addendum — Profile Passport (afs-pp-001, "Phase 3")
A customer-facing (not admin) unified hub at `/app/profile-passport` — an
unusual route prefix next to this codebase's `/account`/`/admin`/`/studio`
convention, but the requesting spec repeats it consistently across all 3
entry points (main nav, FlashDraft, the dashboard itself), so it's followed
literally rather than "corrected" to `/account/profile-passport`.

**Schema change — NOT YET LIVE:** `saved_configurations` gained
`company_id`/`is_locked`/`job_info`/`category`/`subcategory` columns and
company-aware RLS via
`supabase/migrations/024_profile_passport_company_scope.sql`, written but
never applied (no Supabase access to the real project this session — see
STATE_OF_THE_BUILD.md's matching entry for the exact blast radius: this
also breaks FlashDraft's existing Save/Lock until applied). Naming
collision, not a duplicate: `023_profile_passport.sql` already existed
under the same feature name for a different, also-unapplied table
(`custom_profiles`) — 024 doesn't touch it.

**Role model:** no new role column. Maps onto the existing, already-shipped
`profiles.company_role` enum (owner/admin/estimator/pm/accounting/viewer —
the real Team Accounts feature, `/account/team`) via
`lib/data/team.ts`'s `getPassportRole`: owner/admin → Admin, estimator/pm/
accounting → Editor, viewer → Viewer, no company at all → Admin (full
control of one's own solo profiles, matching pre-Phase-3 behavior).

**Structure:**
- `app/app/profile-passport/{layout,page}.tsx` — auth-gated, `?tab=`
  query-param tabs (Profiles/Account/Settings), same pattern as
  `/admin/command-center`'s own tab handling.
- `components/profile-passport/` — `ProfilesTab.tsx` (sortable/paginated
  table over `saved_configurations`, RLS-scoped to own-or-company rows),
  `AccountTab.tsx` (company info + team list, Admin-only edit/manage),
  `SettingsTab.tsx` (display preference, Danger Zone), plus
  `ProfilePreviewModal.tsx` (reuses `CanonicalProfileDiagram`) and
  `ManageTeamModal.tsx` (reuses/extends the Team Accounts API).
- `app/api/profile-passport/*` — profiles CRUD + PDF export
  (`lib/utils/profile-pdf.ts`, pdf-lib-based, renders the actual geometry)
  + account read/update/delete.
- `app/api/team/[userId]/route.ts` — the one real gap in the
  existing Team Accounts feature (invite/cancel-invite existed;
  change-role/remove-member didn't) — added here rather than as a
  parallel passport-specific team system.
- FlashDraft (`app/studio/draft/page.tsx`): "Lock Profile & Save to
  Passport" is now zero-friction (no modal, auto-generated name) instead
  of the modal-based flow from earlier this session; "Load Profiles" now
  redirects here instead of opening its own in-canvas modal (deleted, not
  left dead); a new `?loadPassport=<id>` query param loads a saved row back
  into the canvas as the actively-editing profile.

Not independently confirmed by Reid against a real signed-in session, and
can't be until migration 024 is applied — see STATE_OF_THE_BUILD.md's
matching entry.

**Addendum — real canvas thumbnails (afs-pp-003):** Profile Passport's
generic vector-shape thumbnail is replaced by an actual screenshot of the
FlashDraft canvas, captured via the browser-native
`HTMLCanvasElement.toDataURL('image/png')` (no library — a request to use
Playwright for this was corrected; Playwright is a Node-side test tool
that cannot run inside client-side page code) and stored as
`saved_configurations.thumbnail_image` TEXT
(`supabase/migrations/025_profile_passport_thumbnail.sql`, unapplied, same
blocker as 024). `performSave` captures it on every save; `ProfilesTab`
renders it (see afs-pp-004 addendum below for that component's current
form) with a graceful fallback to the original vector-shape rendering for
rows with no thumbnail. FlashDraft also gained a "← Back to Profiles" link
and a locked/view-only banner
(`viewingFromPassport` state) for profiles opened via `?loadPassport=`.
Not independently confirmed against a real signed-in session — see
STATE_OF_THE_BUILD.md's matching entry.

**Addendum — sidebar redesign + full-page modal (afs-pp-004):**
`ProfilesTab`'s layout changed from a wide table to a permanent 300px-wide
left sidebar of 120×120 thumbnails (real screenshot or vector-shape
fallback), with sort/pagination/the actions menu (Edit Name/Download PDF/
Delete) all carried over unchanged. Clicking a thumbnail opens
`FullPageProfileModal.tsx` (replaces the deleted `ProfilePreviewModal.tsx`)
— a genuine full-viewport takeover (`fixed inset-0 z-[100]`) with no
"View in FlashDraft" link (deliberately removed). A request to relocate
these components to `/app/components/profile-passport/` and reduce
`AccountTab`/`SettingsTab` to stubs was declined after confirming with
Reid — both stay at `components/profile-passport/` with their full
existing functionality intact. Not independently confirmed against a real
signed-in session — see STATE_OF_THE_BUILD.md's matching entry.

**Addendum — table layout, PO column (afs-pp-005):** `ProfilesTab` is a
table again (third layout in three passes — see afs-pp-001 and afs-pp-004
above), now with an explicit column order: Profile Name (+ LOCKED badge,
+ "Saved by" subtext on company accounts) | Job Name | PO | Date |
Thumbnail (far right, 120×120, `text-center`). The actions menu (Edit
Name/Download PDF/Delete) now only appears on row hover, a change from
afs-pp-004's always-visible version. New: a PO Number column, sourced from
`job_info.poNumber` (`lib/data/profile-passport.ts`'s `getPassportProfiles`
never read this field back out before, even though FlashDraft's Job Info
drawer has always captured it). Not independently confirmed against a real
signed-in session — see STATE_OF_THE_BUILD.md's matching entry.

### Phase 9 addendum — HailView homepage section
New `app/components/home/HailViewSection.tsx`, the homepage's new last
section (`app/page.tsx`, after `final-cta`) — left-column heading/copy on
hail damage + insurance replacement value, right-column full-height video
(`object-contain`) with "Start a Quote"/"Talk to AFS" CTAs beneath it. No
hail-strike footage exists in this repo; the component's optional
`videoUrl` prop is currently unset on the real homepage and it renders a
static placeholder panel instead — a real DATA BLOCKER (see CLAUDE.md's
table and this file's top-level entry), not a stub, and no code change is
needed once real footage lands. Verified via temp preview
route/Playwright specs (deleted before commit); full detail in
STATE_OF_THE_BUILD.md's 2026-09-17 session entry.

### Phase 9 addendum — 2026-09-19 revision pass (12 items)
The HailView DATA BLOCKER above is resolved — real portrait (490×940)
video/webm/poster wired in, section rewritten with new copy and a single
"Check My Address" CTA, own top-level nav item (was inside Resources).
`PhoneMockupVideo.tsx` converted from one continuous clip to a real
3-clip crossfading playlist (`field-app.mp4` → `field-step-2.mp4` →
`field-step-3.mp4` → loop), step overlays synced directly to the active
clip index. New shared `InstallFieldAppButton.tsx` (+ `lib/pwa/
install-prompt.ts`, `lib/pwa/platform.ts`) replaces the old breakpoint-
split "Open the Field App"/"Install App" links — branches on real
platform (native install prompt on Android/Chrome via a hard-nav handoff
to `/field/contractor?install=1` so the correct manifest is linked; an
iOS Safari instructional sheet; a QR modal, generated with the `qrcode`
package, on desktop). Most homepage sections (all except hero, HailView,
footer, and `ShopFloorProof` — video-background, not flat-color)
converted from dark gunmetal to a new light palette (`afs-bg-light`
`#F7F7F5`, `afs-bg-light-raised`, `afs-border-light`), reusing the
existing `afs-ink-900`/`afs-ink-700` text tokens rather than adding new
ones. New `RevealOnScroll.tsx` (framer-motion isn't installed — a small
IntersectionObserver + CSS component instead) adds viewport-triggered,
staggered entrance animations to 5 sections. New `lib/site-url.ts`
(`getSiteUrl()`) replaces 7 hardcoded `afs-website-alpha.vercel.app`
fallbacks across order/driver/pickup/dispatch API routes — real finding:
that URL is a live deployment of what looks like this same site, but does
not belong to this project's own Vercel account scope at all. One
sub-item (moving "the hero's bottom image") held — `HeroSection.tsx` has
never had a third image in its real git history, so this needs Reid's
clarification rather than a guess. Full item-by-item PASS/FAIL detail:
STATE_OF_THE_BUILD.md's 2026-09-19 session entry.

**Revision Pass #2 (2026-09-19, same day):** the held hero item resolved
(`rf2.jpeg`/`shop1.png` `SectionImageBreak`s swapped, confirmed by direct
photo inspection first). `RevealOnScroll.tsx` extended with optional
per-instance `durationMs`/`staggerMs` props and wired into every remaining
homepage section (`CredibilityStrip`, `DesignStudioHub`, `DesignToDelivery`
intro block, `CustomerPathways`, `ProfilePassportExplainer`,
`NationwideMap`, plus filling gaps in `ShopFloorProof` and `FinalCTA` that
only partially animated) — 14 reveal-group instances total, all verified
reaching `opacity: 1` with CLS 0.0034. `NationwideMapLeaflet.tsx`'s old
radius `Circle` replaced with a real contiguous-US polygon
(`public/data/us-contiguous.geojson`, 70.7KB, generated once from the free
`us-atlas` package — see CLAUDE.md's new delivery-area rule). The
`afs-website-alpha.vercel.app` finding from the prior pass is now fully
resolved: it's a second real Vercel project,
`steveharyckis-projects/afs-website`, connected to this same GitHub repo
since a 2026-07-01 multi-project setup and still auto-deploying today
under Reid's own Vercel identity — not an unknown third party. Full detail:
STATE_OF_THE_BUILD.md's 2026-09-19 (Pass #2) session entry.

**Environment hygiene — one canonical Vercel project (lr-01, 2026-09-29).**
The two-project ambiguity narrated above is settled, and the conclusion the
2026-09-19 passes reached is **inverted**. The canonical environment is
`https://afs-website-alpha.vercel.app`, the production alias of
`steveharyckis-projects/afs-website` (`prj_In4blcKRV8BoeaYg9y3nsskdOCpD`),
which tracks `main` — verified against the Vercel API
(`targets.production.alias[0]`, `githubCommitRef=main`) and corroborated by
`vercel alias ls`. The local `.vercel/project.json` is linked to it. The other
project, `reids-projects-b3405b97/afs-website` (alias
`afs-website-eight.vercel.app`), has been **disconnected from GitHub — not
deleted**; the Vercel API now reports no Git link for it, and a push of commit
`1f50497` produced a production deployment on the team project only. `main`
auto-deploys to alpha; never run a production deploy from the working tree.
Full inventory, the env-var name/coverage comparison, and the two Supabase Auth
/ auth-callback fixes that made login work on alpha: STATE_OF_THE_BUILD.md's
lr-01 entry.

**FlashDraft geometry — extend from either endpoint + signed 3D bends
(lr-02, 2026-09-29).** Two behavior changes, both directly on `main`.

*Canvas gesture.* Press-and-drag on **either** free endpoint now extends
the profile from that end — the FIRST point prepends a leg, the LAST point
appends one (unchanged). Neither can create a closing last→first leg. Both
free ends get a `grab` cursor and a visible hollow ring handle drawn by
`drawProfileScene`. **afs-sv-005's Shift+drag prepend is removed in full**
(gesture, `shiftPressed` ref, keydown/keyup wiring, hover branch, and the
on-screen hint text) — it only existed because point 0 was a
directly-draggable vertex with no free hit-radius for an unambiguous
"extend" press, and point 0 is now excluded from `hitTestVertex` the way
the last point always has been. afs-sv-003 is not regressed: its own
follow-up already routes a leg-0 body drag to point 0, so both free ends
stay reshapeable by the same gesture at both ends. Prepend renumbers every
point and leg, so `commitPrepend` shifts the selection (and with it the
typed leg length and typed angle, which key off it) and pushes exactly one
undo entry.

*Hem blocks extension — DESIGN DECISION PENDING REID.* An end carrying a
hem refuses to extend, with the tooltip "Remove the hem to extend from
this end." The alternative — silently dropping the hem and extending
anyway — is a destructive edit nobody approved, so this pass took the
non-destructive branch and flagged it. Reid's call.

*3D bend direction.* The 2D canvas has always labelled bends with the
SIGNED interior angle; the 3D path fed `computeProfilePoints` the UNSIGNED
one, so every bend turned the same way and Reid's "W" rendered as a curled
triangle. `lib/flashdraft/geometry.ts` now owns the shared contract
(`bendTurnDegrees`, `signedInteriorAngleDeg`, `formatBendAngleLabel`,
`buildCrossSectionPoints`); `ProfileViewer3D` and the two modals built on
it reconstruct through it. For any angle ≥ 0 the new turn rule is
bit-for-bit the old `180 - angle`, so unsigned callers are untouched. Full
contract, including which consumers stay unsigned on purpose and why the
PathfinderEdge encoder is a separate already-signed path: ARCHITECTURE.md
§13.

---

## 6. ENVIRONMENT VARIABLES

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TAXJAR_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
METALS_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Machine integration — see CLAUDE.md's MACHINE INTEGRATION section and
# ARCHITECTURE.md §11
AFS_BRIDGE_SECRET=
PATHFINDER_EDGE_API_KEY=
PATHFINDER_EDGE_BASE_URL=
PATHFINDER_EDGE_MACHINE_SERIAL=
```

---

## 7. AUTH AND ROLE ARCHITECTURE

```
Roles:      admin | contractor | architect | customer
Default:    customer (on registration)
Elevation:  Manual by admin, except architect (self-identified, admin reviews)

Protected routes (middleware.ts):
  /account/*  → any authenticated user
  /checkout   → any authenticated user
  /admin/*    → admin role only (server-side check, not client-only)

Gated features (component-level):
  /architects/spec-writer    → architect or admin
  CAD library downloads      → any authenticated user
  Custom profile library     → any authenticated user
```

---

## 8. SUPABASE CLIENT PATTERN

Three clients — never mix them:

```typescript
// 1. Browser client — React client components only
// lib/supabase/client.ts — uses NEXT_PUBLIC_ keys

// 2. Server client — server components, API routes
// lib/supabase/server.ts — uses cookies() for session

// 3. Admin client — webhooks, scripts, admin operations only
// Uses SUPABASE_SERVICE_ROLE_KEY
// NEVER used to serve user data
// NEVER imported into client bundle
```

---

## 9. AI RULES — NON-NEGOTIABLE

```
Model:         claude-sonnet-4-6 on every AI call — no exceptions
Client calls:  Never. All AI calls through app/api/ routes
Pricing:       Never return a price from model output — always from pricing_rules table
Grounding:     All AI responses grounded in Supabase data injected at runtime
Escalation:    Disputes, complaints, engineering questions → human always
Validation:    Every AI response validated against expected schema before returning
Streaming:     Use Anthropic streaming SDK for chat — never buffer full response
```

---

## 10. SIX LAWS OF FEATURE COMPLETION

A feature is complete only when all six pass:

```
1. SCHEMA      — Tables exist in real database. RLS policies applied and tested.
2. API         — Routes exist, authenticate, derive context from session.
3. UI          — Real components. No placeholders. Empty states handled.
4. DATA        — Real Supabase calls. Zero mock data in production code.
5. WIRING      — Navigation linked. Role gates correct. All actions persist.
6. VERIFICATION — Playwright tests pass. UNVERIFIED until this passes.
```

---

## 11. QUALITY GATES — REQUIRED ON EVERY PROMPT

```
pnpm tsc --noEmit          → 0 errors required
pnpm run build             → succeeds required
pnpm lint                  → 0 warnings required
Playwright                 → passes on all UI feature prompts
```

No prompt is considered complete until all applicable gates pass.

### THE PREBUILD GATES — `pnpm run build` RUNS THEM, SO VERCEL CANNOT SKIP THEM

`prebuild` chains four scripts. A failure in any of them stops the build, which
is the point: each one exists because the defect it catches is invisible to the
compiler and plausible in a screenshot.

```
scripts/design/scope-v7-css.mjs        derives the scoped v7 CSS (rule #33)
scripts/design/scope-v8-css.mjs        derives the scoped v8 CSS from the FROZEN
                                       contract, reusing the v7 transform rather
                                       than carrying a second copy of it
scripts/audit/contrast-check.mjs       WCAG AA on every Command Center screen (rule #28)
scripts/audit/contract-check.mjs       the V8 design contract is unchanged (rule #36)
scripts/audit/single-drawing-path.mjs  every admin profile drawing goes through
                                       components/admin/v8/ProfileViewer.tsx (rule #37)
```

### TWO MORE GATES THAT ARE NOT IN `prebuild`, AND MUST STILL RUN

Neither can run in `prebuild` because both need a browser and a live server, but
a phase is not finished until both pass:

```
the "nothing dropped at any size" test   lib/flashdraft/viewer-scene.test.ts —
                                         the drawn-label set must be IDENTICAL
                                         at thumbnail, hover, enlarged and full
                                         size. Reid's rule 4. It exists because
                                         a previous pass dropped the hem caption
                                         from the enlarged view to make it fit.

the photo-appears-within-seconds test    tests/e2e/field-photo-arrives.spec.ts —
                                         submits a REAL photo through the real
                                         field routes and watches it arrive on an
                                         already-open Workbench. A test that
                                         inserted the row directly would pass
                                         while the upload path was broken, which
                                         is most of what broke.
```

Three standing prohibitions, all recorded in CLAUDE.md and all load-bearing:

- **Never relax a threshold, widen a mask, or add a skip list** to make a gate
  pass. Fix the colour, fix the screen.
- **Never regenerate a V8 baseline.** The contract's hashes are rewritten only by
  `scripts/design/rebaseline-v8-contract.mjs`, which requires
  `CONTRACT_APPROVED_BY_REID=1` — **a variable no Claude Code session may set.**
  The five baseline PNGs are re-derived from the committed HTML on every run and
  have no update mode.
- **Never add to the single-drawing-path allowlist, and never raise a count.**
  Its counts are exact in BOTH directions: fewer than allowlisted also fails,
  asking for the number to be lowered, so a conversion has to be written down
  rather than happening invisibly.

### NOTHING IS MARKED DONE WHILE UNVERIFIED

A passing gate is evidence to bring to Reid, not his confirmation. Anything
visual or interactive stays **IMPLEMENTED, UNCONFIRMED** in
STATE_OF_THE_BUILD.md until he has checked the behaviour himself — the standard
that file and SESSION_STATE.md already set, and the standard the V8 phase 0
audit applies to every item in it, including a component that typechecks, passes
its unit tests and has never been rendered in a browser.

---

## 12. GOVERNANCE UPDATE — REQUIRED LAST ACTION

The final action of every FORGE prompt:
1. Read the actual file tree and relevant source files
2. Update STATE_OF_THE_BUILD.md with what was built — from reality, not from memory
3. Update SESSION_STATE.md with what was built and what runs next
4. Commit all changes: `git add -A && git commit -m '[FORGE] {promptId}: {description}'`

---

*BLUEPRINT.md | AFS | Reid Whitesides | Visual AI Method | June 2026*
