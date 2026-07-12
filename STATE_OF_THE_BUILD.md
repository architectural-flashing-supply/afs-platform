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
API keys in .env.local:  Present locally (not committed). STRIPE_SECRET_KEY,
                         STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                         are all confirmed populated with live-mode values (sk_live_/
                         whsec_/pk_live_ prefixes) as of afs-026 — the empty-Stripe-key
                         condition logged in afs-025 no longer applies. Stripe checkout/
                         webhooks are live-key-ready.
pnpm install:            DONE (afs-025) — stripe, @stripe/stripe-js,
                         @stripe/react-stripe-js, docx all present in
                         pnpm-lock.yaml and node_modules.
pnpm tsc --noEmit:       PASSES — 0 errors (afs-031, re-verified after every change).
pnpm run build:          PASSES — exit 0, all 98 routes generated (afs-031 — same
                         route count as afs-030; this run only touched the import
                         script and its dependencies, no routes added/removed).
git commits:             All work through afs-031 is committed and pushed to
                         origin/main. Working tree is clean.
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
The Design Studio (afs-030) is built AND its data is now live (afs-031):
004_machine_profiles.sql applied, 911 profiles imported, 70 public / 841
private.** The tool-approval gate logged in afs-023/024 has not recurred
since afs-025.

1. **Done (afs-031 — this build):** Applied `004_machine_profiles.sql` to
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
2. **Done (afs-030):** Design Studio built. See BUILD PHASE STATUS above
   for full detail: `app/studio` + `app/studio/draft` (FlashDraft canvas),
   `app/api/studio/match-profile`, `lib/integrations/pathfinder-edge.ts`
   (stub — no real PathfinderEdge API was discoverable) + its 3 admin
   routes, NavBar entry. Re-added `afs-ink-900`/`afs-ink-700` tokens (only
   these two) for the FlashDraft canvas's dimension labels.
3. **Done (afs-029):** Scoped fix on top of the reverted dark theme —
   `app/(public)/products/page.tsx`, `app/configure/page.tsx`,
   `app/quote/page.tsx` each got an inline `#B8BEC8` background on their
   main content div and `text-afs-crimson font-bold` / `text-black
   font-bold` titles/subtitles, per an explicitly narrow instruction
   ("do not touch any other file/token"). Not committed to governance docs
   at the time per that instruction's own scope — logged here now for
   completeness.
4. **Done (afs-028):** `git revert b3512f1` — reverted the afs-027 site-wide
   light rebrand back to the original dark gunmetal theme per explicit
   instruction. `pnpm tsc --noEmit` and `pnpm run build` both re-verified
   passing after the revert.
5. **Remaining — not a code task:** `supabase/migrations/001-003` have not
   been applied to a live Supabase project yet (004 now has been, as of
   afs-031).
6. Confirm chat_conversations retention policy (#65) before relying on
   chat history persistence in production.
7. If/when the client confirms QuickBooks scope (checklist #52-54) or a
   real PathfinderEdge API is documented, build the real integrations out
   against the existing stub function signatures in `lib/integrations/
   quickbooks.ts` and `lib/integrations/pathfinder-edge.ts`.
8. The 841 private profiles are real customer/contractor/hospital/project
   job history, now live in the production database (RLS-protected,
   admin-only read). If specific ones are ever needed publicly, a human
   should review and flip them individually — do not bulk-flip
   `is_public`, per the explicit decision in afs-031.
9. DATA BLOCKERS table below is the remaining pre-launch punch list —
   nothing left is a FORGE code task; all remaining items need data/assets
   from the client.

Historical detail on the afs-023 → afs-027 sequence (build-blocker
investigation, the two real build bugs fixed in afs-025, and the full
afs-027 light-rebrand build) is preserved in SESSION_STATE.md's SESSION LOG.

---

*STATE_OF_THE_BUILD.md | Updated by FORGE after each run. Do not edit manually.*
