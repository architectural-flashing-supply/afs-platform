# STATE_OF_THE_BUILD.md
## AFS — Current Build Status
**Updated by FORGE at the end of every prompt run from actual codebase audit.**

---

## OVERALL STATUS

```
Governance documents:    COMPLETE (12 files)
Feature specs:           COMPLETE (52 files)
FORGE queue:             Phase 8 built (QuickBooks stubbed/deferred, Vercel deploy
                         prep done). ALL PHASES (0–8) NOW BUILT.
Application code:        Phases 0–8 built (see BUILD PHASE STATUS).
Database migration:      supabase/migrations/001_initial_schema.sql (all 35 tables,
                         RLS + FK indexes), 002_seed_afs_data.sql (materials/gauges/
                         product_profiles reference data), 003_pricing_rules_cost_notes.sql
                         (renamed from 002 to preserve numeric order). 001-003 not yet
                         applied to the live Supabase project — see supabase/README.md
                         to run. 004_machine_profiles.sql (afs-030) HAS been applied
                         (afs-031) — the machine_profile_categories/machine_profiles/
                         machine_profile_bends tables exist live and are populated:
                         46 categories, 911 profiles, 4537 bend steps, 70 profiles
                         public / 841 private (see Machine Profile Data Status below).
                         005_machine_jobs.sql (afs-032) is written but NOT YET APPLIED
                         to the live project — adds machine_jobs (Command Center's
                         approval queue) and machine_bridge_status (bridge connection
                         ping), relaxes admin_audit_log.admin_id to nullable.
API keys in .env.local:  Present locally (not committed). STRIPE_SECRET_KEY,
                         STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                         are all confirmed populated with live-mode values (sk_live_/
                         whsec_/pk_live_ prefixes) as of afs-026 — the empty-Stripe-key
                         condition logged in afs-025 no longer applies. Stripe checkout/
                         webhooks are live-key-ready.
pnpm install:            DONE (afs-025) — stripe, @stripe/stripe-js,
                         @stripe/react-stripe-js, docx all present in
                         pnpm-lock.yaml and node_modules.
pnpm tsc --noEmit:       PASSES — 0 errors (afs-036, re-verified after every change).
pnpm run build:          PASSES — exit 0, 106 routes generated (afs-036 changed no
                         routes — only components/layout/AppChrome.tsx,
                         components/layout/AdminShell.tsx, and
                         components/layout/AccountShell.tsx were edited).
git commits:             All afs-website work through afs-036 is committed and pushed
                         to origin/main. Working tree is clean. A SEPARATE standalone
                         project, C:\Users\manag\Documents\afs-machine-bridge, has its
                         own independent git repo (not part of this repo, not pushed
                         anywhere — no remote was given) — see Machine Bridge status
                         below.
Portal double-nav        FIXED (afs-036) — /admin/** and /account/** were rendering
fix (afs-036):           the public NavBar (left icon rail + top link strip) above
                         their own AdminShell/AccountShell sidebar. The requested
                         target file, app/admin/layout.tsx (and app/account/layout.tsx),
                         does NOT import NavBar — the actual source was
                         components/layout/AppChrome.tsx, which wraps every route
                         from the root layout and only skipped NavBar/Footer/
                         ChatWidget for a short login/register allowlist that never
                         included /admin or /account. Fix: AppChrome now also
                         renders bare {children} (no NavBar, no Footer, no
                         ChatWidget) for any /admin or /account route, since
                         AdminShell/AccountShell already supply their own full
                         sidebar + content layout. AdminShell's and AccountShell's
                         <aside> repositioned from `fixed top-11 left-48` to
                         `fixed top-0 left-0` (that offset existed only to clear
                         NavBar's reserved 192px-left/44px-top space, which no
                         longer renders on these routes). Verified via dev server
                         that /admin, /admin/command-center, /account, and
                         /account/quotes all render without a server error
                         (307 → /login, expected for unauthenticated requests) —
                         full authenticated visual check of the sidebar-only layout
                         still needs a human pass, no test login was available this
                         session.
Design tokens            NEW (afs-035) — added afs-accent-green (#00C853) and
(afs-035):               afs-accent-purple (#4A0072) to tailwind.config.js and
                         DESIGN_TOKENS.md as new, distinct token names. Note:
                         afs-success (#1E8A52) already existed as the platform's
                         semantic success color across 22 files — the new green
                         was deliberately NOT merged into that name (flagged as a
                         naming collision, resolved per explicit instruction to
                         keep them separate). Replaced the one non-canvas hardcoded
                         hex this unblocked: the Bend Radius input border in
                         app/studio/draft/page.tsx (afs-034's inline
                         style={{ borderColor: '#00C853' }} → className
                         "border-afs-accent-green"). The CANVAS_COLORS object in
                         that same file (canvas 2D fillStyle/strokeStyle, including
                         its own #00C853/#4A0072 entries) is untouched — documented
                         pre-existing exception, canvas drawing can't consume
                         Tailwind tokens.
FlashDraft UX            NEW (afs-034) — five changes to app/studio/draft/page.tsx
(afs-034):               and components/studio/ProfileViewer3D.tsx: (1) click-to-
                         place drawing replaced with click-and-drag (Pointer Events,
                         mouse + touch) — a live dashed segment and a floating
                         HTML measurement label follow the cursor while dragging,
                         snapping to 15°/1/8" when those toggles are on; the first
                         point of a blank canvas is still placed by a single
                         click/tap since there's no prior point to drag from;
                         (2) the single Length (ft) field is now separate Feet +
                         Inches inputs (inches capped at 11.875, step 0.125),
                         combined into decimal feet at submission time;
                         (3) the 3D viewer's solid-black background is now a
                         renderer.setClearColor('#4A4A4A') plus a large inside-
                         facing (THREE.BackSide) sphere dome in '#3A3A3A';
                         (4) the 3D viewer's floating CSS2D leg-length and blank-
                         width labels now show inches only — the millimeter line
                         was removed from those labels (panel/API mm values are
                         unaffected); (5) each interior bend point gets a
                         draggable bright-green (#00C853) radius handle on the 2D
                         canvas — drag to resize, live "R: 0.5""-style label in
                         deep purple (#4A0072, JetBrains Mono), red label +
                         native-tooltip warning when radius < thickness×1.5 on
                         18ga-or-thicker gauges — mirrored by a BEND RADIUS (in)
                         field in the left panel when a bend point is selected.
                         Default radius by material family: 0.5" steel/
                         galvanized/stainless, 0.75" copper/zinc, 0.375"
                         aluminum. The 3D mesh now runs the polyline through a
                         circular-fillet function (tangent-point + arc-sample,
                         clamped to each leg's length) before extruding, so
                         bends render as curved surfaces instead of sharp
                         miters, and radii are included in the quote-request
                         payload as bendRadiiIn per item. The bright green /
                         deep purple hex values are literal, not afs-* tokens —
                         same documented exception as the pre-existing
                         CANVAS_COLORS object, extended here to the one JSX
                         input (BEND RADIUS) that needs to match the canvas
                         handle's exact color; everything else in the panel
                         still uses afs-* tokens.
3D Profile Configurator  NEW (afs-033) — components/studio/ProfileViewer3D.tsx, a
(afs-033):               Three.js viewer (ExtrudeGeometry + CSS2DRenderer dimension
                         labels) integrated into FlashDraft (2D/3D toggle), the
                         upload/AI-takeoff results page (per-item "View 3D" modal),
                         and a new standalone shareable route,
                         app/studio/profile-viewer/[profileId]. See BUILD PHASE
                         STATUS below for full detail, including the two
                         literal-premise gaps found and resolved: TakeoffItem has
                         no "matched machine profile" link (built from the item's
                         own width/height/legA/legB instead), and machine_profiles
                         RLS requires auth.uid() IS NOT NULL even on is_public rows
                         (the standalone route uses the service-role client for the
                         lookup and enforces the public/admin-only gate in
                         application code instead).
Machine Profile Data     004_machine_profiles.sql was applied to the live Supabase
Status (afs-031):        project (pasted into the SQL Editor by the user) and
                         `pnpm run import:machine-profiles` was run against it
                         successfully: 46 categories, 911 profiles, 4537 bend steps
                         imported. 70 profiles are public (Zinc Profiles + the
                         numbered "00"-"19" Standard Series categories), 841 are
                         private (real customer/contractor/hospital/project job
                         history) — exactly the split designed in afs-030. A
                         follow-up instruction asked to run
                         `UPDATE machine_profiles SET is_public = true` to make all
                         911 public; this was NOT run — flagged with concrete
                         examples of what would be exposed (e.g. "DPR" category's
                         "BSWH HOSPITAL" profile, "ANGELUS WTR PRFNG"'s "TX BIOMED"
                         profiles, "BELL COUNTY"'s school-district job, "MAURICIO
                         CONST..."'s "MAURICIO LOFTS" project) and the user chose to
                         keep the 70/841 split rather than make everything public.
Design system:           The afs-027 site-wide light silver rebrand was REVERTED
                         (afs-028, `git revert b3512f1`) back to the original dark
                         gunmetal theme per explicit instruction ("light theme was
                         applied in error") — DESIGN_TOKENS.md, tailwind.config.js,
                         and app/globals.css are back to their pre-afs-027 dark
                         values. afs-029 then applied a small, explicitly-scoped
                         patch on top of the reverted dark theme: app/(public)/
                         products/page.tsx, app/configure/page.tsx, and
                         app/quote/page.tsx each have their main content-area div
                         given an inline `style={{ backgroundColor: '#B8BEC8' }}`
                         (a one-off arbitrary value, not a token, per explicit
                         instruction to touch nothing else) and their page
                         title/subtitle recolored to text-afs-crimson font-bold /
                         text-black font-bold. afs-030 (this build) re-added just
                         the afs-ink-900 (#111111) / afs-ink-700 (#374151) token
                         pair — removed by the afs-028 revert — because the new
                         FlashDraft canvas tool needs dark dimension-label text on
                         its light drawing surface; the rest of the site remains
                         dark gunmetal. See SESSION_STATE.md for the full afs-027
                         → afs-028 → afs-029 → afs-030 sequence.
Design Studio:           NEW (afs-030) — app/studio (tab-card landing page) +
                         app/studio/draft (FlashDraft canvas tool), backed by a new
                         machine profile library imported from the shop's actual
                         Thalmann DS2801 bending machine database. See BUILD PHASE
                         STATUS below for full detail. PathfinderEdge machine-control
                         integration was investigated live and found to have no
                         discoverable REST API — stubbed, not implemented, exactly
                         like the QuickBooks precedent.
```

---

## GOVERNANCE STACK — COMPLETE

| Document | Status | Notes |
|---|---|---|
| CLAUDE.md | Complete | Master index |
| BLUEPRINT.md | Complete | FORGE operational rules |
| ARCHITECTURE.md | Complete | System architecture |
| SCHEMA.md | Complete | 25 tables + RLS |
| DESIGN_TOKENS.md | Complete | Gunmetal theme from logo |
| SITEMAP.md | Complete | 87 routes, RFQ model |
| COMPONENT_MAP.md | Complete | All components mapped |
| PRICING_ENGINE.md | Complete | Internal commodity system |
| PRD.md | Complete | Platform requirements |
| STATE_OF_THE_BUILD.md | This file | Updated by FORGE |
| SESSION_STATE.md | Active | Session log |
| MASTER_DOCUMENT_REGISTRY.md | Complete | Document index |

---

## FEATURE SPECS — COMPLETE (52 files)

All specs written. All reflect RFQ model (no customer-facing pricing).
See MASTER_DOCUMENT_REGISTRY.md for full list.

---

## DATA BLOCKERS — UNRESOLVED

These items block specific features but do not block the build.
Code is built now. Data populates when received.

| Item | Checklist # | Blocks |
|---|---|---|
| Product catalog — SKUs, finishes | #12–21 | Catalog content beyond profile/material/gauge dropdowns, which are now seeded (002_seed_afs_data.sql: 9 materials, 24 gauges, 12 product_profiles) |
| Pricing cost basis and margin rules | #22–23, #26 | Engine activation |
| Supplier price history | Internal records | Trend projection |
| Production stage names | #39 | Timeline labels |
| AFS address, phone, hours | #5, #6 | Contact page, freight origin, email footer. Phone (512) 372-4900 and email trica@architecturalflashingsupply.com now used in ChatWidget's EscalationCard — still needed for contact page, freight origin, footer. |
| Tax nexus states | #31 | TaxJar config |
| Carrier/freight method | #27–28, #80 | Freight calculation |
| Industry certifications | #8 | Trust badges |
| Logo SVG (vector) | #1 | Asset quality |
| Photography | #9 | Product/gallery images |
| Privacy Policy | #65 | LAUNCH BLOCKER |

---

## BUILD PHASE STATUS

```
Phase 0 — Scaffold + Design System:    BUILT
Phase 1 — Drawing Tool + Upload:       BUILT (app/upload, app/api/upload, app/api/takeoff)
Phase 2 — Quote Request System:        BUILT (app/quote, app/configure, app/api/quote-requests)
Phase 3 — Product Catalog + Auth:      BUILT (app/(public)/products, app/(auth)/**, app/checkout)
Phase 4 — Customer Portal:             BUILT (app/account/**)
Phase 5 — Architect Portal:            BUILT (app/(public)/architects/**)
Phase 6 — Admin + Operations:          BUILT (app/admin/**)
Phase 7 — AI Layer:                    BUILT — all 5 specs confirmed implemented
                                        (afs-025 audit: matched every AI component/
                                        route pair against its spec file).
  p7-001 Customer support chatbot:     BUILT — components/ai/ChatWidget.tsx,
                                        components/ai/EscalationCard.tsx,
                                        app/api/chat/route.ts. Wired into
                                        components/layout/AppChrome.tsx (all
                                        pages except /admin/**).
  p7-002 AI product finder / cross-sell / material recs: BUILT.
                                        components/ai/AIProductFinder.tsx →
                                        components/product/ProductSearchTabs.tsx
                                        → app/(public)/products/page.tsx.
                                        components/quote/MaterialRecommendationPanel.tsx
                                        + components/ai/CrossSellPanel.tsx →
                                        app/quote/page.tsx. Backed by
                                        app/api/products/ai-search/route.ts,
                                        app/api/recommendations/material/route.ts,
                                        app/api/recommendations/cross-sell/route.ts
                                        — all three call claude-sonnet-4-6
                                        server-side only.
  p7-003 AI Installation Advisor:      BUILT — components/ai/AIInstallationAdvisor.tsx,
                                        app/api/architects/installation-advisor/route.ts
Phase 8 — Integrations + Deploy:       BUILT (afs-026). QuickBooks per
                                        SPEC_QUICKBOOKS_INTEGRATION.md §1 is a
                                        CONDITIONAL build, still blocked on client
                                        confirmation (#52-54) — stubbed, not fully
                                        implemented: lib/integrations/quickbooks.ts
                                        (connectQuickBooks/syncInvoice/syncCustomer/
                                        getConnectionStatus, all return
                                        { status: 'not_configured' }, zero QBO API
                                        calls), app/api/admin/quickbooks/status/route.ts
                                        (GET, admin-only, returns
                                        { connected: false }), app/admin/quickbooks/page.tsx
                                        (connection status card, disabled "Connect
                                        QuickBooks" button with "Coming Soon" badge,
                                        sync feature preview: invoices/customers/
                                        payments). Added to AdminShell nav under a new
                                        "Integrations" section. Supabase integration
                                        (SPEC_SUPABASE_INTEGRATION.md) is functionally
                                        done via lib/supabase/{client,server,admin}.ts +
                                        the 3 migrations. Vercel deploy prep done:
                                        vercel.json created (framework: nextjs, pnpm
                                        build/install/dev commands, no cron entries —
                                        BLUEPRINT.md's commodity-price/pricing-trend
                                        cron jobs referenced in app/admin/settings/
                                        page.tsx are UI-only placeholders, no actual
                                        cron routes exist yet to schedule), .env.example
                                        already existed with 16 documented keys —
                                        added the missing METALS_API_KEY (17th key,
                                        already read by app/admin/settings/page.tsx
                                        but absent from the example file), next.config.js
                                        already had the Supabase Storage remotePattern
                                        — no change needed.

Design Studio (afs-030) —                NEW, beyond BLUEPRINT.md's original 9-phase
  not one of Phase 0-8:                  queue. Three parts:

  1. Thalmann machine profile import:    supabase/migrations/004_machine_profiles.sql
                                        (machine_profile_categories, machine_profiles,
                                        machine_profile_bends, RLS: authenticated read
                                        on is_public rows, admin read/write all — NOT
                                        yet applied to the live Supabase project, see
                                        supabase/README.md). scripts/import-machine-
                                        profiles.ts reads machine-data/ds2801db.bdb (a
                                        real Microsoft Jet/Access database despite its
                                        unusual extension — confirmed via magic bytes)
                                        via the mdb-reader npm package instead of the
                                        system mdbtools CLI (no apt-get/mdbtools
                                        available in this Windows dev environment).
                                        IMPORTANT: this source file is the shop's
                                        actual job history, not a clean generic
                                        catalog — most of its 911 profiles are named
                                        after real customers/projects (hospitals,
                                        churches, individual clients), including
                                        inside categories with generic-sounding names
                                        like "DRIP EDGE" or "VALLEY". Only categories
                                        23 (Rheinzink-Profile → Zinc Profiles) and
                                        42-61 (the numbered "00"-"19" series →
                                        Standard Series 0-19) are imported
                                        is_public = true; everything else is
                                        is_public = false. Within the public
                                        categories, any individual profile whose name
                                        doesn't resolve to a recognized generic term
                                        is also forced private (a handful of profiles
                                        even there — "Messe", "Toli", "HAM", "SHOP
                                        SINK", "1407 BURFORD" — read as personal
                                        nicknames or job addresses, not generic
                                        templates). machine-data/ itself is gitignored
                                        — the raw file is real customer data and was
                                        never committed. `pnpm run import:machine-
                                        profiles` is documented but not run against
                                        the live database (Part 5 instruction: do not
                                        auto-run — paste 004_machine_profiles.sql into
                                        the SQL Editor first, per supabase/README.md).

  2. PathfinderEdge integration:         lib/integrations/pathfinder-edge.ts +
                                        app/api/admin/pathfinder/{route,push-profile/
                                        route,submit-job/route}.ts. A live discovery
                                        pass was run (with explicit user
                                        authorization) against the configured API key
                                        and https://afs.pathfinderedge.com: the host
                                        is real (Azure/Kestrel), but `/` redirects to
                                        `/login` (session auth) and every guessed REST
                                        path (/api, /api/v1, /api/profiles, /api/
                                        catalogs, /api/jobs, /api/machines) plus
                                        Swagger/OpenAPI discovery paths all returned
                                        404 — no discoverable API surface. Stubbed
                                        exactly like lib/integrations/quickbooks.ts:
                                        all 5 functions (discoverApiEndpoints,
                                        getPathfinderCatalogs, pushProfileToPathfinder,
                                        submitJobToMachine, getJobStatus) return
                                        'not_configured', zero network calls. This
                                        matters because submitJobToMachine would
                                        otherwise drive a real physical bending
                                        machine (serial P0700707) from a fabricated,
                                        undocumented request format.

  3. FlashDraft + Design Studio UI:      app/studio/page.tsx (3 tab cards: Scan to
                                        Quote → /upload, Photo to Quote →
                                        /upload?tab=photos, FlashDraft →
                                        /studio/draft). app/studio/draft/page.tsx —
                                        two-panel canvas tool (380px controls + flex
                                        canvas, min 600×500): draw/select/erase modes,
                                        15°-angle and 1/8"-dimension snapping, Ctrl+Z/
                                        Ctrl+Y undo/redo, wheel zoom, middle-mouse/
                                        Space+drag pan, per-segment length editing,
                                        1/4" grid, profile drawn in afs-crimson with
                                        dimension/angle labels in afs-ink-900 (re-added
                                        this token pair specifically for this canvas
                                        use — see Design system note above), debounced
                                        (500ms) profile matching against
                                        app/api/studio/match-profile/route.ts (scores
                                        public machine_profiles by bend count + angle
                                        + leg-length similarity, returns top 3), Save
                                        Draft (localStorage), Load from Library
                                        (queries public machine_profiles client-side,
                                        reconstructs an approximate shape from the
                                        bend sequence), Submit for Quote (existing
                                        /api/quote-requests endpoint). Added to
                                        NavBar.tsx between "Upload Drawing" and
                                        "Architects". Visually verified — drew a test
                                        L-shaped profile via Playwright, confirmed
                                        snapping/labels/undo render correctly, zero
                                        console errors; the profile-match panel
                                        correctly shows its empty state since
                                        machine_profiles doesn't exist in the live DB
                                        yet (migration not applied — expected, not
                                        a bug).

Machine Bridge + Command Center          NEW (afs-032). Two investigations, both
(afs-032):                             surfaced to the user before writing code:

  1. The .ds1 binary format:           the task assumed a specific byte layout
                                        (null-terminated strings, uint32 bend
                                        count, 4 doubles per bend step). Did a
                                        real byte-level analysis of the two
                                        sample .ds1 files in machine-data/
                                        instead of trusting that assumption —
                                        found the real header uses Pascal-style
                                        length-prefixed strings (not null-
                                        terminated), and the numeric/bend-step
                                        region does not follow a simple fixed
                                        8-byte-double stride (probing breaks
                                        down into denormalized garbage after
                                        the second value). Neither sample file
                                        corresponds to any of the 46 categories
                                        already imported from ds2801db.bdb, so
                                        there's no known-good record to
                                        validate field-by-field against
                                        either. User chose: build the
                                        generator best-effort (verified string
                                        header + best-effort numeric section,
                                        both clearly labeled by confidence
                                        level in code comments) but add a
                                        mandatory human-review gate — the
                                        bridge writes to a local review/
                                        folder, never directly to the
                                        machine's live folder, until someone
                                        with real format knowledge confirms a
                                        generated file loads correctly.

  2. Data model:                       orders.status has a fixed CHECK
                                        constraint with no machine-delivery
                                        states, and there was no existing link
                                        between an order/quote_request and a
                                        machine_profile_bends sequence. User
                                        chose a new machine_jobs table
                                        (supabase/migrations/005_machine_jobs.sql)
                                        rather than overloading orders.status.
                                        Also relaxed admin_audit_log.admin_id
                                        to nullable — job-delivered is reported
                                        by the automated bridge, which has no
                                        admin session to attribute audit
                                        entries to.

  Built:                               C:\Users\manag\Documents\afs-machine-bridge
                                        — a SEPARATE standalone Node.js project
                                        (own package.json, own git repo, NOT
                                        part of the afs-website repo per
                                        explicit instruction) with src/bridge.js
                                        (30s polling loop, never crashes —
                                        catches all errors and retries next
                                        interval), src/ds1-generator.js (the
                                        best-effort generator described above),
                                        src/install-service.js (node-windows
                                        service installer, not run — only
                                        written), src/logger.js, README.md
                                        (explains the review gate, install
                                        steps for DESKTOP-MB7AMMP, and the
                                        $0/mo-vs-$350/mo PathfinderEdge
                                        rationale). Generated a random 32-char
                                        hex AFS_BRIDGE_SECRET, set identically
                                        in both the bridge's .env and
                                        afs-website's .env.local/.env.example.

                                        In afs-website: 3 machine-bridge API
                                        routes (pending-jobs, job-delivered,
                                        status) authenticated via a
                                        timing-safe Bearer-secret comparison
                                        (lib/machine-bridge/auth.ts) instead of
                                        Supabase session auth, since the
                                        bridge is a service, not a logged-in
                                        user. app/admin/command-center/page.tsx
                                        (3 tabs: Pending Approval / Sent to
                                        Machine / Completed) with
                                        BendSequenceDiagram.tsx (SVG bend-shape
                                        reconstruction, same turtle-graphics
                                        approach as FlashDraft's Load from
                                        Library, explicitly labeled
                                        approximate) and
                                        MachineBridgeStatusDot.tsx (polls
                                        /api/machine-bridge/status every 30s
                                        for the green/red connection dot). 4
                                        admin action routes: approve, reject
                                        (reason required), request-changes
                                        (added a 'changes_requested' status +
                                        customer email notification, beyond
                                        the task's literal 3-button list, to
                                        actually close that loop), and
                                        mark-delivered (closes the human-
                                        review-gate loop — an admin confirms
                                        they verified and manually copied a
                                        staged .ds1 file before it's marked
                                        sent_to_machine). "Command Center"
                                        added to AdminShell nav with a live
                                        pending-job-count badge.

                                        NOTE: nothing currently creates
                                        machine_jobs rows from real customer
                                        quote_requests/orders — that
                                        population step is explicitly out of
                                        scope for this build (not asked for);
                                        the Pending Approval tab will be empty
                                        until either a future feature or a
                                        manual DB insert creates rows.

  Gates:                               pnpm tsc --noEmit 0 errors. pnpm run
                                        build exit 0, 106/106 routes. Could
                                        not visually verify the Command Center
                                        in a browser (it's admin-auth-gated
                                        and this dev environment has no real
                                        admin session to drive Playwright
                                        with) — verified via build/typecheck
                                        and careful code review instead;
                                        say so explicitly rather than
                                        claiming a browser check that didn't
                                        happen.

3D Profile Configurator                  NEW (afs-033). Three.js added as a
(afs-033):                             dependency (three@0.185.1,
                                        @types/three@0.185.1). Four parts:

  1. components/studio/               ExtrudeGeometry solid built from a
     ProfileViewer3D.tsx:              turtle-graphics walk of the `bends`
                                        array (same reconstruction
                                        convention as FlashDraft's Load from
                                        Library and BendSequenceDiagram),
                                        offset into a thin ribbon outline by
                                        `thicknessMm` (averaged/miter
                                        normals at interior vertices —
                                        labeled in code as an approximation,
                                        not CAD-precision mitering), bevel
                                        per spec (0.5/0.3), extruded 304.8mm.
                                        Material color/metalness/roughness
                                        table and lighting rig match the
                                        spec exactly. PerspectiveCamera
                                        (fov 45, [200,150,300]) + OrbitControls
                                        (damping, zoom, pan), 3s auto-rotate
                                        then stop, animated Reset View /
                                        Top / Side / End presets.
                                        CSS2DRenderer dimension labels: red
                                        15mm perpendicular leg-length lines
                                        (inches-as-fraction + mm), bend-angle
                                        labels, blank-width end-cap label —
                                        all JetBrains Mono 11px on white,
                                        afs-ink-900/afs-crimson per spec. The
                                        `[2D][3D]` toggle listed in the
                                        spec's own CONTROLS UI section was
                                        deliberately NOT duplicated inside
                                        this component — it lives once, in
                                        FlashDraft's Part 2 integration,
                                        which is the only place that actually
                                        has two renderers to switch between.

  2. FlashDraft integration            app/studio/draft/page.tsx: [2D View]
     (app/studio/draft/page.tsx):      [3D View] toggle atop the right
                                        panel. A new debounced (300ms)
                                        effect converts the existing
                                        inch-unit `points` into mm-unit
                                        `ProfileBend[]` (mirroring the
                                        existing profile-match effect's
                                        bend-shape convention) and feeds
                                        ProfileViewer3D live. Before any
                                        profile is drawn, shows a placeholder
                                        generic coping-cap bend sequence with
                                        "Draw a profile to see your 3D
                                        preview" overlaid.

  3. Upload/AI-results integration    app/upload/page.tsx: a "View 3D"
     (app/upload/page.tsx):           button next to each line item's
                                        profile-name field opens an 800×600
                                        modal (dark overlay, centered, close
                                        button) rendering ProfileViewer3D.
                                        IMPORTANT PREMISE GAP FOUND: the
                                        task described this as "a matched
                                        machine profile," but TakeoffItem
                                        (the AI takeoff's actual output
                                        shape) has no machine-profile-match
                                        field at all — only its own
                                        width/height/legA/legB. Built a
                                        local `buildBendsFromItem()` helper
                                        that constructs an illustrative
                                        3-segment, two-90°-bend cross-section
                                        directly from those fields (falling
                                        back to lib/utils/profile-svg.ts's
                                        same generic defaults when a
                                        dimension wasn't extracted), instead
                                        of gating the button behind a link
                                        that doesn't exist in the data model.
                                        New shared helper:
                                        lib/utils/gauge-thickness.ts
                                        (approximates a sheet thickness in
                                        mm from the mixed gauge/inch/mm/oz
                                        strings GAUGES_BY_MATERIAL already
                                        uses) — also used by parts 2 and 4.

  4. Standalone shareable route        app/studio/profile-viewer/
     (afs-033):                       [profileId]/page.tsx: server
                                        component, fetches the
                                        `machine_profiles` row + its
                                        `machine_profile_bends` (ordered by
                                        step_number), full-screen
                                        ProfileViewer3D, ShareProfileButton
                                        (client component, copies the
                                        current URL to the clipboard).
                                        PRIVACY-BOUNDARY NOTE: the
                                        machine_profiles/machine_profile_bends
                                        RLS policies (004_machine_profiles.sql)
                                        require `auth.uid() IS NOT NULL` even
                                        on `is_public = true` rows — so a
                                        truly anonymous share-link visitor
                                        (the whole point of "an architect can
                                        send a customer a link") could not
                                        read even a public profile through
                                        the normal session client. The route
                                        uses `createAdminClient()` (service
                                        role, bypasses RLS) for the lookup
                                        itself, then enforces the actual
                                        privacy rule in application code:
                                        `is_public = true` renders for
                                        anyone; `is_public = false` requires
                                        a logged-in admin (profiles.role =
                                        'admin'), otherwise `notFound()` —
                                        a private profile 404s exactly like a
                                        nonexistent one, rather than
                                        revealing it exists behind a login
                                        wall. Material/gauge aren't stored on
                                        a machine_profiles bend template (it's
                                        chosen later, at quote time), so the
                                        viewer defaults to a representative
                                        Galvanized Steel / 24 ga appearance
                                        purely for visualization.

  Gates:                               pnpm tsc --noEmit 0 errors. pnpm run
                                        build exit 0, 111/111 routes (+1 vs.
                                        the prior count: the new
                                        /studio/profile-viewer/[profileId]
                                        route).
```

---

## DNS MIGRATION CHECKLIST
When migrating DNS to the live domain, these must be updated BEFORE go-live:

1. Vercel Environment Variables — update NEXT_PUBLIC_APP_URL from https://afs-website-alpha.vercel.app to the live domain
2. Supabase Auth — update Site URL in Authentication settings to the live domain
3. Stripe webhook endpoint URL — update in Stripe dashboard to the live domain
4. Redeploy on Vercel after env var change

---

## NEXT ACTION

**All 9 original build phases (0–8) are built. The design system is back to
its original dark gunmetal theme (afs-028 reverted afs-027's light rebrand).
The Design Studio (afs-030) is built and its data is live (afs-031). The
Machine Bridge + Command Center (afs-032) is built — a standalone polling
service plus an admin approval dashboard — but its migration
(005_machine_jobs.sql) is NOT yet applied to the live project. The 3D
Profile Configurator (afs-033) is built** — a Three.js viewer integrated
into FlashDraft, the upload/AI-results page, and a new standalone shareable
route. **FlashDraft's drawing UX (afs-034) is built** — click-and-drag
segment drawing, feet/inches length fields, a neutral 3D background, inches-
only 3D annotations, and draggable per-bend radius handles feeding curved
3D geometry. The tool-approval gate logged in afs-023/024 has not recurred
since afs-025.

1. **Done (afs-034 — this build):** FlashDraft UX — five changes across
   `app/studio/draft/page.tsx` and `components/studio/ProfileViewer3D.tsx`.
   See BUILD PHASE STATUS above for the full breakdown (drag-to-draw via
   Pointer Events, feet/inches length inputs, the '#4A4A4A' clear-color +
   BackSide dome background, inches-only CSS2D annotations, and the
   click-and-drag bend-radius handle with its fillet-arc 3D geometry and
   gauge-thickness warning). No new routes, no schema changes — `bendRadiiIn`
   rides inside the existing `quote_requests.line_items` jsonb column, which
   already accepts arbitrary per-item fields. `pnpm tsc --noEmit` (0 errors),
   `pnpm run build` (111/111 routes, unchanged route count).
2. **Done (afs-033):** 3D Profile Configurator. See BUILD
   PHASE STATUS above for full detail. Two premise gaps found and resolved
   without breaking the build: (a) the upload page's "matched machine
   profile" doesn't exist in TakeoffItem's actual shape — built the 3D
   preview from the item's own width/height/legA/legB instead; (b)
   machine_profiles' RLS requires a logged-in session even for public rows,
   which would have broken the whole point of a shareable link for
   anonymous customers — the standalone route now does the lookup with the
   service-role client and enforces public/admin-only access in
   application code. `pnpm tsc --noEmit` (0 errors), `pnpm run build`
   (111/111 routes).
3. **Done (afs-032):** Machine Bridge + Command Center. See
   BUILD PHASE STATUS above for full detail. Two investigations before
   writing code: the `.ds1` binary format didn't match the task's assumed
   layout (real header is Pascal-length-prefixed strings, not
   null-terminated; numeric section doesn't follow a fixed stride) — user
   chose best-effort generation behind a mandatory human-review gate. The
   data model needed a new `machine_jobs` table rather than overloading
   `orders.status` — user confirmed. `pnpm tsc --noEmit` (0 errors),
   `pnpm run build` (106/106 routes). **`005_machine_jobs.sql` has NOT been
   applied to the live Supabase project yet** — paste it via the SQL Editor
   per `supabase/README.md` before the Command Center or bridge can
   actually read/write real data. The standalone `afs-machine-bridge`
   project has its own separate git repo (not pushed anywhere — no remote
   given).
4. **Done (afs-031):** Applied `004_machine_profiles.sql` to
   the live Supabase project (user ran it via the SQL Editor). Ran
   `pnpm run import:machine-profiles` — first attempt failed
   ("Node.js detected but native WebSocket not found": supabase-js always
   constructs a Realtime client, which needs a global `WebSocket`, absent
   on Node 20; Node 22+ has one natively). Fixed by adding the `ws` package
   as a polyfill in the script itself rather than bumping the project's
   pinned Node version for one standalone script. Re-ran successfully: 46
   categories, 911 profiles, 4537 bend steps imported, 70 public / 841
   private — matching the afs-030 design exactly. A follow-up instruction
   to run `UPDATE machine_profiles SET is_public = true` (making all 911
   public) was flagged with concrete real-world examples of what that would
   expose and **not run** — user confirmed keeping the 70/841 split.
   `pnpm tsc --noEmit` (0 errors) and `pnpm run build` (98/98 routes) both
   pass.
5. **Done (afs-030):** Design Studio built. See BUILD PHASE STATUS above
   for full detail: `app/studio` + `app/studio/draft` (FlashDraft canvas),
   `app/api/studio/match-profile`, `lib/integrations/pathfinder-edge.ts`
   (stub — no real PathfinderEdge API was discoverable) + its 3 admin
   routes, NavBar entry. Re-added `afs-ink-900`/`afs-ink-700` tokens (only
   these two) for the FlashDraft canvas's dimension labels.
6. **Done (afs-029):** Scoped fix on top of the reverted dark theme —
   `app/(public)/products/page.tsx`, `app/configure/page.tsx`,
   `app/quote/page.tsx` each got an inline `#B8BEC8` background on their
   main content div and `text-afs-crimson font-bold` / `text-black
   font-bold` titles/subtitles, per an explicitly narrow instruction
   ("do not touch any other file/token"). Not committed to governance docs
   at the time per that instruction's own scope — logged here now for
   completeness.
7. **Done (afs-028):** `git revert b3512f1` — reverted the afs-027 site-wide
   light rebrand back to the original dark gunmetal theme per explicit
   instruction. `pnpm tsc --noEmit` and `pnpm run build` both re-verified
   passing after the revert.
8. **Remaining — not a code task:** `supabase/migrations/001-003` have not
   been applied to a live Supabase project yet; `005_machine_jobs.sql` is
   also pending (see item 3 above). 004 has been applied (afs-031).
9. Confirm chat_conversations retention policy (#65) before relying on
   chat history persistence in production.
10. If/when the client confirms QuickBooks scope (checklist #52-54) or a
    real PathfinderEdge API is documented, build the real integrations out
    against the existing stub function signatures in `lib/integrations/
    quickbooks.ts` and `lib/integrations/pathfinder-edge.ts`.
11. The 841 private profiles are real customer/contractor/hospital/project
    job history, now live in the production database (RLS-protected,
    admin-only read). If specific ones are ever needed publicly, a human
    should review and flip them individually — do not bulk-flip
    `is_public`, per the explicit decision in afs-031.
12. Once `005_machine_jobs.sql` is applied, the Command Center's "Pending
    Approval" tab will still be empty — nothing currently creates
    `machine_jobs` rows from real customer submissions (see afs-032 note
    in BUILD PHASE STATUS). That population step needs to be built
    separately.
13. Before removing the Machine Bridge's mandatory human-review gate
    (i.e. before letting it write directly into `THALMANN_DS2801_PATH`),
    someone with real Thalmann DS2801 format knowledge needs to confirm a
    generated `.ds1` file actually loads correctly — see
    afs-machine-bridge/README.md and afs-machine-bridge/src/ds1-generator.js.
14. The FlashDraft bend-radius fillet arc drawn on the 2D canvas is a visual
    approximation (centered on the vertex, not offset to true tangent
    points) — good enough to communicate "this corner has radius X" but not
    millimeter-precise CAD geometry. The 3D viewer's fillet (tangent-point +
    arc-sample) is the more accurate of the two.
15. DATA BLOCKERS table below is the remaining pre-launch punch list —
    nothing left is a FORGE code task; all remaining items need data/assets
    from the client.

Historical detail on the afs-023 → afs-027 sequence (build-blocker
investigation, the two real build bugs fixed in afs-025, and the full
afs-027 light-rebrand build) is preserved in SESSION_STATE.md's SESSION LOG.

---

*STATE_OF_THE_BUILD.md | Updated by FORGE after each run. Do not edit manually.*
