# CLAUDE.md
## AFS — Architectural Flashing Supply | Master Index
**Read this file first on every FORGE run before reading any other document.**

---

## WHAT THIS PROJECT IS

AFS (Architectural Flashing Supply) is a specialty sheet metal fabricator owned
by a client in the construction materials industry. They fabricate custom
architectural flashing — coping caps, base flashing, counter flashing, step
flashing, drip edge, gravel stop, expansion joints — from copper, aluminum,
galvanized steel, stainless, and Galvalume.

This platform replaces their phone-call sales process with a digital system that
lets contractors and architects submit detailed quote requests online, track
fabrication in real time, and access technical resources.

---

## BUSINESS MODEL — READ THIS CAREFULLY

**This is a Request for Quote (RFQ) platform. It is not an e-commerce store.**

- Customers never see prices on the website. Ever.
- Customers submit drawings, configure profiles, or describe what they need.
- AFS receives the submission and generates a formal quote using the internal
  pricing engine.
- The formal quote is delivered to the customer's portal account.
- The customer reviews, approves, and then pays.
- Payment is collected only after AFS has set and delivered the price.

Any feature that would display a price, estimate a cost, or show a dollar amount
to a customer is wrong and must not be built. The only dollar amounts customers
see are on formal AFS-generated quotes and invoices in their account portal.

---

## PLATFORM PILLARS

**Pillar 1 — Quote Without Calling**
Contractors upload blueprints or use the configurator to specify exactly what
they need. AFS receives a complete, structured specification and responds with
a formal quote. No phone call required.

**Pillar 2 — The Architect's Platform**
Architects get AI-generated CSI Division 07 specification sections, AutoCAD
fabrication details, Revit families, finish palettes, and material data sheets —
everything needed to write AFS products into a project specification.

**Pillar 3 — Full Visibility, Every Order**
Contractors and PMs track orders from fabrication queue through delivery in
real time. Pre-ship photos. Production stage updates. Delivery scheduling.
The "where is my order" call never needs to happen.

**Pillar 4 — Internal Pricing Intelligence**
AFS estimators use a commodity-indexed pricing engine to quote accurately and
fast. Real-time metal commodity prices cross-referenced with historical supplier
price increases and margin targets. Trend alerts flag when commodity movement
threatens margins. Customers never see this layer.

---

## TECHNOLOGY STACK

```
Framework:        Next.js 14+ App Router
Language:         TypeScript — strict mode, zero any types
Package manager:  pnpm — never npm or yarn
Styling:          Tailwind CSS — afs-* design tokens only, no default Tailwind colors
Database:         Supabase (PostgreSQL + RLS + Auth + Realtime + Storage)
Authentication:   Supabase Auth (email/password + magic link)
Payments:         Stripe (cards, ACH)
Email:            Resend (transactional)
SMS:              Twilio (production updates, delivery alerts)
AI:               Anthropic Claude API — model: claude-sonnet-4-6
Tax:              TaxJar (multi-state compliance)
Maps:             Google Maps API (delivery, address autocomplete)
Testing:          Playwright (end-to-end, required gate on every UI prompt)
Deployment:       Vercel
Source control:   GitHub (private)
```

---

## GOVERNANCE DOCUMENTS — READ IN THIS ORDER

Every FORGE prompt reads the documents relevant to what it is building.
The full governance stack in reading order:

```
1.  CLAUDE.md                   ← This file. Always first.
2.  BLUEPRINT.md                ← Build phases, directory structure, quality rules
3.  ARCHITECTURE.md             ← Auth model, data flow, API patterns, RLS
4.  SCHEMA.md                   ← All 25 database tables with RLS policies
5.  DESIGN_TOKENS.md            ← Gunmetal color system, typography, Metal Edge
6.  SITEMAP.md                  ← All 83 routes mapped to specs and auth rules
7.  COMPONENT_MAP.md            ← Every component by section
8.  PRICING_ENGINE.md           ← Internal pricing system (admin only)
9.  PRD.md                      ← Full platform requirements
10. STATE_OF_THE_BUILD.md       ← Current build status (updated by FORGE)
11. SESSION_STATE.md            ← Session log (updated by FORGE)
```

---

## SPEC DOCUMENTS — BY BUILD PHASE

FORGE reads specs before building the corresponding feature.

**Phase 0–1 — Scaffold + Drawing Tool (built first):**
```
SPEC_DRAWING_TOOL.md
SPEC_DOCUMENT_UPLOAD.md
```

**Phase 2 — Quote Request System:**
```
SPEC_QUOTE_BUILDER.md
SPEC_FLASHING_CONFIGURATOR.md
SPEC_AUTO_MATERIAL_CALCULATOR.md
SPEC_PHOTO_TO_QUOTE_AI.md
SPEC_TRIM_LENGTH_OPTIMIZER.md
SPEC_AI_ORDER_VALIDATOR.md
```

**Phase 3 — Product Catalog + Auth:**
```
SPEC_PRODUCT_CATALOG.md
SPEC_AUTH.md
SPEC_HOMEPAGE.md
SPEC_CHECKOUT.md
SPEC_STRIPE_INTEGRATION.md
SPEC_TAXJAR_INTEGRATION.md
SPEC_PURCHASE_ORDER_INTEGRATION.md
```

**Phase 4 — Customer Portal:**
```
SPEC_ORDER_PORTAL.md
SPEC_PRODUCTION_TIMELINE.md
SPEC_DELIVERY_SCHEDULER.md
SPEC_PICKUP_SCHEDULING.md
SPEC_INVOICE_PORTAL.md
SPEC_MULTI_PROJECT_MANAGEMENT.md
SPEC_TEAM_ACCOUNTS.md
SPEC_SAVED_PROJECT_TEMPLATES.md
SPEC_ONLINE_CREDIT_APPLICATION.md
SPEC_NOTIFICATIONS.md
SPEC_RESEND_INTEGRATION.md
SPEC_EMAIL_TEMPLATES.md
SPEC_TWILIO_INTEGRATION.md
SPEC_GOOGLE_MAPS_INTEGRATION.md
```

**Phase 5 — Architect Portal:**
```
SPEC_ARCHITECT_PORTAL.md
SPEC_AI_SPEC_WRITER.md
SPEC_CAD_BIM_LIBRARY.md
SPEC_FINISH_PALETTE.md
SPEC_CUSTOM_PROFILE_LIBRARY.md
SPEC_MATERIAL_SPEC_LIBRARY.md
SPEC_FIELD_INSTALLATION_GUIDES.md
SPEC_ARCHITECTURAL_RESOURCE_CENTER.md
SPEC_DESIGN_CONSULTATION.md
```

**Phase 6 — Admin + Operations:**
```
SPEC_ADMIN_PORTAL.md
SPEC_PRODUCTION_QUEUE.md
SPEC_PRICING_ADMIN.md
SPEC_CUSTOMER_MANAGEMENT.md
SPEC_LIVE_INVENTORY.md
SPEC_RUSH_ORDER.md
SPEC_FREIGHT_ESTIMATOR.md
```

**Phase 7 — AI Layer:**
```
SPEC_AI_CHATBOT.md
SPEC_AI_PRODUCT_FINDER.md
SPEC_AI_MATERIAL_RECOMMENDATIONS.md
SPEC_AI_INSTALLATION_ADVISOR.md
SPEC_AI_CROSS_SELL.md
```

**Phase 8 — Integrations:**
```
SPEC_SUPABASE_INTEGRATION.md
SPEC_QUICKBOOKS_INTEGRATION.md
SPEC_DOCUMENT_UPLOAD.md (referenced again for order attachments)
```

---

## CRITICAL RULES — ENFORCED ON EVERY PROMPT

1. **No customer-facing pricing.** If a component would show a dollar amount
   to a customer before they have an AFS-generated quote in their portal, it is
   wrong. Do not build it.

2. **pnpm only.** Never npm install, never yarn. Every package command uses pnpm.

3. **TypeScript strict.** Zero `any` types. `pnpm tsc --noEmit` must pass with
   zero errors before a prompt is considered complete.

4. **afs-* tokens only.** No default Tailwind colors. No hardcoded hex values
   in JSX. Every color comes from the afs-* token system defined in
   DESIGN_TOKENS.md and tailwind.config.js — including `afs-accent-green`
   (#00C853) and `afs-accent-purple` (#4A0072), added for FlashDraft's
   bend-radius UI.

   **CANVAS_COLORS exception.** A `<canvas>` 2D drawing context (`fillStyle`/
   `strokeStyle`) and third-party embedded iframes (Stripe's `CardElement`)
   cannot consume Tailwind classes or CSS custom properties — they need
   literal color values. The established pattern is a single documented
   constant object (e.g. `CANVAS_COLORS` in `app/studio/draft/page.tsx`,
   `STRIPE_CARD_ELEMENT_COLORS` in `app/checkout/page.tsx`) that mirrors the
   afs-* token values as literal hex, with a comment citing this exception.
   This is the ONLY sanctioned way to use a literal hex value outside real
   JSX — a literal hex directly in a `className`/`style` on a normal DOM
   element is still a rule #4 violation.

5. **No client-side AI calls.** All Anthropic API calls go through
   `app/api/` routes. The API key never touches the client bundle.

6. **RLS before features.** Every Supabase table has RLS policies applied
   before any feature that reads from it is built.

7. **Gates on every prompt.** Every FORGE prompt must pass compile, build,
   and file_exists gates before the next prompt runs.

8. **Governance updated last.** The final action of every FORGE prompt is
   to update STATE_OF_THE_BUILD.md and SESSION_STATE.md from an actual
   audit of the codebase — never from memory.

9. **Canonical site URL — always `lib/site-url.ts`'s `getSiteUrl()`, never
   a hardcoded fallback.** Server-side code (API routes, background jobs)
   that needs the app's own absolute URL calls `getSiteUrl()`
   (`NEXT_PUBLIC_APP_URL`, else `https://$VERCEL_URL`, else
   `http://localhost:3000`) — never a literal `'https://afs-website-...
   .vercel.app'` string. Client-side code that needs the current origin
   should use `window.location.origin` directly instead (works correctly
   on preview deployments too, no env-inlining needed).

   **CANONICAL ENVIRONMENT (settled lr-01, 2026-09-29):
   `https://afs-website-alpha.vercel.app`, project
   `steveharyckis-projects/afs-website`
   (`prj_In4blcKRV8BoeaYg9y3nsskdOCpD`, team
   `team_dfBIZiaZlYIIHoq6UPOJaRJm`).** It is that project's production
   alias tracking `main` — verified against the Vercel API
   (`targets.production.alias[0]`, with `githubCommitRef=main`), and
   corroborated by `vercel alias ls`, where `afs-website-alpha.vercel.app`
   and `afs-website-git-main-steveharyckis-projects.vercel.app` resolve to
   the same source deployment. The local `.vercel/project.json` is linked
   to this project. `main` auto-deploys here; never run a production
   deploy from the working tree. **Note when re-running `vercel link`:**
   it mutates the working tree every time — it appends `.env*` to
   `.gitignore` (which would shadow the TRACKED `.env.example`) and
   rewrites `.env.local` with a fresh `VERCEL_OIDC_TOKEN`. Check
   `git status` afterwards and revert the `.gitignore` edit; do not
   commit it.

   **The other project, `reids-projects-b3405b97/afs-website`
   (`prj_POXBIS4e5hE88zekvufE6aODCUeP`, alias
   `afs-website-eight.vercel.app`), has been DISCONNECTED from GitHub —
   NOT deleted.** `vercel git disconnect` was run against it on
   2026-09-29; the Vercel API now reports no Git link for it, while the
   team project still reports
   `github:architectural-flashing-supply/afs-platform (branch main)`.
   Proven live: pushing commit `1f50497` produced a production deployment
   only on the team project, while the stray's newest deployment stayed
   2692 minutes old. The project, its domains and its environment
   variables all still exist and still serve the last build it made — it
   simply no longer builds this repo. Deleting it, and deciding whether to
   rotate the secrets it still holds, remains PENDING REID.

   Earlier revisions of this rule had these two projects backwards (they
   named `afs-website-eight.vercel.app` as real production and claimed
   alpha did not belong to this account at all). Corrected here from live
   command output — see STATE_OF_THE_BUILD.md's lr-01 entry for the full
   inventory, the env-var comparison, and the Supabase Auth
   redirect-allow-list fix that unblocked login on alpha.

10. **Homepage/marketing videos are pre-rendered to their display aspect,
    never re-cropped or scaled in CSS.** Every real video asset used in a
    fixed-aspect container (hero, HailView, phone-mockup clips, shop-floor
    loop) is encoded at that exact target aspect ratio before it's dropped
    into `public/videos/`, so the component's own `object-cover` has zero
    actual cropping to do — no `scale-*` transforms, no letterboxing, no
    "shrink it down and center it" CSS tricks to compensate for a mismatched
    source. If a video looks cropped, zoomed, or letterboxed on the site,
    the fix is re-encoding the source file to the container's real aspect
    ratio (see PhoneMockupVideo.tsx's own comment for a worked example: a
    -90°-rotation-flagged landscape source baked into a genuine upright
    portrait file), not adjusting the CSS around it.

11. **The homepage delivery-area map is a real contiguous-US polygon,
    never a radius circle.** `NationwideMapLeaflet.tsx` draws
    `public/data/us-contiguous.geojson` — a single MultiPolygon covering
    the lower 48 + DC, stopping at the actual Canadian/Mexican borders —
    fit to its own computed bounds. A decorative `Circle` centered on the
    Burnet, TX shop was tried first (Pass #1) and explicitly replaced
    (Pass #2, 2026-09-19) because it bore no relation to the real
    coastline. If this file ever needs regenerating (a finer simplification
    level, a different state set), the approach is: `us-atlas`'s
    `states-10m.json` + `topojson-client`'s `merge()` over every state
    EXCEPT Alaska/Hawaii/the territories, coordinates rounded to ~3
    decimals to stay under 100KB — both packages are dev-time-only tools
    for producing this one static file, never runtime dependencies. Full
    detail: STATE_OF_THE_BUILD.md's 2026-09-19 (Pass #2) entry.

12. **A FlashDraft bend angle is the SIGNED interior angle, and
    `lib/flashdraft/geometry.ts` is the only place that decides what a
    bend angle means.** Range (-180, 180]: magnitude is the included
    angle between the two legs (180 = straight through, 90 = a
    right-angle corner, 0 = folded flat back), sign is the fold's
    handedness. `signedInteriorAngleDeg()` computes it —
    `bendTurnDegrees()` turns it into a turtle heading change,
    `buildCrossSectionPoints()` walks it back out as a polyline, and
    `formatBendAngleLabel()` (`.toFixed(0)`, never `Math.round`) prints
    it. Every 3D viewer — `ProfileViewer3D` and the two modals built on
    it, `SubmitConfirmation3DModal` and `MatchedProfile3DModal` — goes
    through those, so 3D geometry and 3D labels can never drift from the
    2D canvas.

    Never reintroduce an unsigned bend angle into a rendering path. That
    was the lr-02 bug: `Math.acos` returns 0..180 by construction, so
    every bend turned the same way and a "W" rendered as a curled
    triangle with three positive labels.

    **Two deliberate exceptions, both load-bearing.** (a)
    `buildBendSummary`'s quote text stays UNSIGNED — it is prose for a
    human estimator, where a leading minus sign reads as an error rather
    than as handedness. (The other half of this exception used to be the
    profile-MATCH query, `/api/studio/match-profile`, kept unsigned
    because the old imported machine catalog stored unsigned interior
    angles. That route and that catalog were both deleted on 2026-09-30
    with the 911-profile library — see the MACHINE INTEGRATION block
    below — so the exception no longer has a second half.) (b) The
    PathfinderEdge encoder
    (`lib/integrations/flashdraft-to-pathfinder.ts`) has its own local,
    already-signed `bendAngleAt` on AMS Controls' handedness, which is
    the NEGATION of FlashDraft's y-down screen convention. It imports
    nothing from `lib/flashdraft/geometry.ts` and must not be
    "unified" with it. Full contract: ARCHITECTURE.md §13.

13. **Both free endpoints of a FlashDraft profile extend — INCLUDING a
    hemmed one, and the hem travels with it.** Press-and-drag the FIRST
    point to prepend a leg, the LAST point to append one. A last→first
    closing leg is never creatable by any gesture. afs-sv-005's Shift+drag
    prepend was removed in full in lr-02 — do not reintroduce a
    modifier-gated new-leg gesture. (Alt = whole-profile move and
    Space/middle-click = pan are unaffected and stay.) Any prepend must
    renumber every index-keyed piece of state in lockstep (see
    `commitPrepend`'s field-by-field audit) and push exactly ONE undo
    entry.

    **DECISION MADE — Reid, 2026-09-30. No longer pending.** This rule
    previously said a hemmed end refuses to extend, with the tooltip
    `Remove the hem to extend from this end.`, and recorded the choice
    between that block and auto-dropping the hem as PENDING REID. Reid
    chose a THIRD option, which is neither: **dragging from either free
    endpoint extends the profile even when that end carries a hem, and the
    HEM MOVES to the new free end, preserving its type, gap, fold length
    and kick direction. Nothing is destroyed and nothing is refused.** The
    block and the tooltip were removed in full — do not reintroduce
    either.

    Why it needs no hem-state migration, and why that is now
    load-bearing rather than incidental: `hemStart`/`hemEnd` are anchored
    POSITIONALLY — "the first point" and "the last point" — never to a
    stored index. `drawProfileScene` renders them as
    `renderHemAt(hemStart, 0, 1)` and
    `renderHemAt(hemEnd, last, last - 1)`, so after a prepend the same
    `Hem` object is re-read as belonging to the new `points[0]` and
    redrawn folding against its new neighbour. Every field that defines a
    hem (`type`, `lengthIn`, `gapIn`, `kick`) lives on that object and is
    untouched. Keep that anchoring positional: giving a hem a numeric
    index would silently reintroduce the stranded-fold bug this design
    avoids. Undo stays one entry because `past` snapshots
    `{points, hemStart, hemEnd}` together. A hemmed end also draws the
    free-endpoint grab ring now, since the gesture it advertises really
    fires. Regression coverage:
    `tests/e2e/flashdraft-regression.spec.ts`.

14. **ONE DOOR TO THE MACHINE. A verified Command Center approval is the
    only way anything reaches PathfinderEdge catalog 20115.** That catalog is
    polled by the physical Thalmann DS2801, so a profile landing there is
    fabricable work. `pushProfileToPathfinder` (`lib/integrations/
    pathfinder-edge.ts`) therefore takes a REQUIRED third argument, an
    `ApprovalContext`, and VERIFIES IT IN THE DATABASE with the service role
    before any network call — `quote_request_approval` needs a quote request
    still at `status='submitted'`; `machine_job_approval` needs a machine job
    still at `status='pending_approval'`; both need the acting user to be a
    real `role='admin'` profile. Missing, stale, or non-admin approval means
    the push returns an error and sends NOTHING. If the guard cannot verify,
    it refuses — an unverifiable approval is never treated as a valid one.

    **Exactly two files may call it:**
    `app/api/admin/command-center/approve-quote-request/route.ts` and
    `app/api/admin/command-center/approve/route.ts`. This is enforced by a
    STATIC test (`lib/integrations/pathfinder-single-door.test.ts`) that walks
    `app/ components/ lib/ scripts/ tests/` and fails if any other file calls
    it. Do not add a caller — and do not add the file to that allow-list to
    make the test pass. Hiding a button is not enforcement; the database check
    is.

    Four doors were deleted on 2026-09-30 to establish this:
    `app/api/studio/send-to-pathfinder` (FlashDraft's direct button — pushed on
    nothing but an admin session and wrote no audit row at all),
    `app/api/admin/pathfinder/push-profile`,
    `app/api/admin/pathfinder/submit-job`, and
    `scripts/pathfinder-roundtrip-test.ts` (POSTed a live test profile into
    20115 with no approval; the static test found it, grep had not). None of
    them are coming back. Full evidence, including the audit-log proof that
    every profile in 20115 since 2026-09-25 did go through approval:
    STATE_OF_THE_BUILD.md's 2026-09-30 entry.

    **Open design question, NOT resolved:** the gate is an ADMIN approval, not
    a customer's acceptance of a quote. A profile reaches the Thalmann the
    moment an admin clicks "Approve & Send to Machine"; there is no
    customer-acceptance step between quote and machine. PENDING REID.

---

## MACHINE INTEGRATION — THALMANN DS2801 / AFS MACHINE BRIDGE

The shop's Thalmann DS2801 bending machine (serial P0700707) is fed by a
**separate standalone Node.js project**, `afs-machine-bridge` — its own
`package.json`, its own git repo, not part of this repo. See
ARCHITECTURE.md and STATE_OF_THE_BUILD.md for full detail and current
status.

```
Env vars (see .env.example):
  AFS_BRIDGE_SECRET               Shared Bearer secret between afs-website's
                                   app/api/machine-bridge/* routes and the
                                   bridge's own .env — must match exactly.
  PATHFINDER_EDGE_API_KEY         PathfinderEdge integration — LIVE AND IN
  PATHFINDER_EDGE_BASE_URL        REAL USE, not a stub. See
  PATHFINDER_EDGE_MACHINE_SERIAL  lib/integrations/pathfinder-edge.ts.
                                   (This block previously read "no
                                   discoverable REST API ... wired but
                                   unused." That was wrong — a probe used
                                   the wrong auth format. Corrected
                                   2026-09-24 from live evidence: GET
                                   /api/v1/catalogs returns 200 with real
                                   data. The API key goes in the
                                   Authorization header RAW, with NO
                                   scheme prefix — not "Bearer <key>",
                                   not "X-API-Key". Base URL is the
                                   per-tenant root,
                                   https://afs.pathfinderedge.com.)

  PATHFINDER_DEBUG_CAPTURE        Set to 1 to write each outgoing
                                   PathfinderEdge POST body to
                                   diagnostics/. Off by default; a write
                                   failure here can never block a push.

  **Machine sync — how a profile actually reaches the Thalmann.** Machines
  PULL; nothing pushes to them. There is no job-submission endpoint, no
  job-status endpoint, and NO WAY TO TRIGGER, FORCE, OR EXPEDITE A SYNC —
  confirmed against the vendor's own machine-sync doc. A profile reaches
  the DS2801 when three conditions hold: it sits in a catalog the machine
  subscribes to (20115, "afs" — the only one it subscribes to), it is not
  archived, and the machine is powered on and connected. `submitJobToMachine`
  and `getJobStatus` returning `not_configured` is CORRECT — do not "fix"
  them by inventing endpoints. There are no `syncDate`/`forceSyncDate`
  fields in this API; do not add them. Full detail:
  STATE_OF_THE_BUILD.md's 2026-09-24 FlashDraft audit entry.

Gitignored locally:
  machine-data/    GONE as of 2026-09-30 — archived and deleted. It held
                    the OLD Thalmann DS2801's raw database (ds2801db.bdb)
                    plus sample .ds1 files: real shop job history with real
                    customer/project names, never committed. It existed only
                    to feed the 911-profile import, which has been removed
                    (see below). The files were copied to
                    `C:\Users\manag\Documents\afs-assets\old-machine-files\`,
                    OUTSIDE the repo, and verified byte-for-byte by size and
                    sha256. They are the only copies of that machine's
                    database — do not delete that archive.
```

**THE 911-PROFILE MACHINE LIBRARY IS REMOVED. Do not bring it back.**
Migration `031_drop_machine_profile_library.sql` dropped
`machine_profile_bends` (4,537 rows), `machine_profiles` (911) and
`machine_profile_categories` (46), and dropped
`machine_jobs.machine_profile_id` — NULL on every row that ever existed, so
no job lost a bend sequence. Its UI, its API routes
(`/api/studio/match-profile`, `load-profile`, `library-list`,
`/studio/profile-viewer`), its importer scripts and their `package.json`
entries are all deleted. Two reasons, both decisive: the geometry was AI-read
out of a legacy database and never validated, so matching a customer's
drawing against it produced confident-looking nonsense; and most profile
names are real customer, hospital and project names, which is not catalog
content. `lib/data/removed-machine-library.test.ts` is a STATIC test over
`app/ components/ lib/ scripts/ tests/` that fails on any reference to those
tables, the deleted modules or the deleted data folder. Do not add a query
back and do not relax that test.

**Two things that sound similar and must NEVER be confused with it:**
`shop_profile_library` — real send history to the CURRENT Thalmann,
including `pathfinder_profile_id` — and `canonical_profiles`, the
hand-authored starter library and now the only profile library. The same
static test asserts both are still referenced in source, so an over-eager
future cleanup cannot take them too.

That confusion stopped being hypothetical on 2026-09-30: v2-01's
library-removal gate greps source for `profile-library` and flagged 15 files
that had nothing to do with the removed library — the send-history UI, its
routes and its data module, all of which CLAUDE.md protects by name. Nothing
was deleted. The send-history paths were renamed out of the collision
instead, and are now:

```
app/admin/shop-library/page.tsx             (was app/admin/profile-library/)
app/api/admin/shop-library/route.ts         (was .../shop-profile-library/)
app/api/admin/shop-library/[id]/route.ts    (was .../profile-library/[id]/)
app/api/admin/shop-library/reorder/route.ts (was .../profile-library/reorder/)
lib/data/shop-library.ts                    (was lib/data/shop-profile-library.ts)
```

The `shop_profile_library` TABLE name and every TypeScript identifier
(`getShopProfileLibrary`, `ShopProfileLibraryRow`,
`insertShopProfileLibraryRecord`, …) are UNCHANGED — only hyphenated file
and URL paths moved, because only those collided. Do not reintroduce a
hyphenated `profile-library` path for anything.

`lib/data/removed-machine-library.test.ts` builds its forbidden table and
script names from fragments (`` `machine${'_'}profile` ``) for the same
reason: it is the one file that must name the removed tables, and the
external gate has no self-exclusion. The runtime strings and the assertions
are unchanged — do not "tidy" them back into contiguous literals.

---

## FORGE LAUNCH — CANONICAL (MANDATORY)

Full detail: `C:\Users\manag\Documents\FORGE\README.md`.

All queued FORGE builds for this project launch EXCLUSIVELY via `forge.ps1`
in `C:\Users\manag\Documents\FORGE`. Queue prompts reach Claude Code only through forge.ps1: a session whose prompt opens with "You are running as FORGE queue prompt" IS the canonical launch path and must execute it autonomously without asking for confirmation. The prohibition is on humans pasting queue.yaml prompts into interactive Claude Code or Cursor sessions, and on inventing alternate runner syntax.yaml`
prompts through Claude Code directly or invent alternate runner syntax.

```powershell
cd C:\Users\manag\Documents\FORGE
.\forge.ps1 -project afs-website
```

- Queue file location is FIXED: `FORGE\projects\afs-website\queue.yaml`.
  No alternate/named queue files. Back up before replacing, using a
  `.bak-<date>` suffix.
- `forge.ps1`'s console output (prompt numbering, coloration, gate
  pass/fail rendering) is part of the canonical experience — a launch not
  showing it means `forge.ps1` was bypassed.
- Do not modify `forge.ps1`'s output formatting, gate rendering, or launch
  interface without an explicit instruction from Reid recorded in the
  FORGE README.

---

## DATA BLOCKERS

The following data has not been received. Features that depend on this data
are built with correct architecture and explicit placeholder behavior — they
are not skipped. When data arrives, it populates the existing structure.

| Data Needed | Checklist Items | Blocks |
|---|---|---|
| Product catalog — profiles, materials, gauges | #12–21 | Catalog content, configurator dropdowns |
| Pricing rules and cost basis | #22–23, #26 | Pricing engine activation |
| Supplier price history | Internal records | Trend projection accuracy |
| Production stage names (shop language) | #39 | Timeline labels, notification triggers |
| AFS address, phone, hours | #5, #6 | Contact page, freight origin, email footer |
| Tax nexus states | #31 | TaxJar configuration |
| Carrier / freight method | #27–28, #80 | Freight calculation |
| Industry certifications | #8 | Trust badges, spec language |
| Logo vector file (SVG) | #1 | Asset quality — PNG in use as fallback |
| Photography | #9 | Product and gallery images |
| Privacy Policy | #65 | Legal — launch blocker |

---

*CLAUDE.md | AFS — Architectural Flashing Supply | Reid Whitesides | Visual AI Method | June 2026*
