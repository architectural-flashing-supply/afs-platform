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
                         (renamed from 002 to preserve numeric order). Not yet applied to
                         a live Supabase project — see supabase/README.md to run.
API keys in .env.local:  Present locally (not committed). STRIPE_SECRET_KEY,
                         STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                         are all confirmed populated with live-mode values (sk_live_/
                         whsec_/pk_live_ prefixes) as of afs-026 — the empty-Stripe-key
                         condition logged in afs-025 no longer applies. Stripe checkout/
                         webhooks are live-key-ready.
pnpm install:            DONE (afs-025) — stripe, @stripe/stripe-js,
                         @stripe/react-stripe-js, docx all present in
                         pnpm-lock.yaml and node_modules.
pnpm tsc --noEmit:       PASSES — 0 errors (afs-026, re-verified after every change).
pnpm run build:          PASSES — exit 0, all 92 routes generated (afs-026, +2 routes
                         for /admin/quickbooks and /api/admin/quickbooks/status vs.
                         afs-025's 90).
git commits:             All work through afs-026 is committed (see SESSION LOG).
                         Working tree is clean.
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

**All 9 build phases (0–8) are now built.** The tool-approval gate logged in
afs-023/024 has not recurred since afs-025; every pnpm/git command in
afs-026 ran directly with no approval issue.

1. **Done (afs-026):** Phase 8 — QuickBooks stub + Vercel deploy prep.
   `lib/integrations/quickbooks.ts`, `app/api/admin/quickbooks/status/route.ts`,
   `app/admin/quickbooks/page.tsx`, AdminShell nav entry, `vercel.json`,
   `.env.example` METALS_API_KEY addition. `pnpm run build` (exit 0, 92/92
   routes) and `pnpm tsc --noEmit` (0 errors) both pass. Committed.
2. **Remaining — not a code task:** `supabase/migrations/*` have not been
   applied to a live Supabase project yet (see `supabase/README.md`).
3. Confirm chat_conversations retention policy (#65) before relying on
   chat history persistence in production.
4. If/when the client confirms QuickBooks scope (checklist #52-54), build
   out real OAuth + sync per SPEC_QUICKBOOKS_INTEGRATION.md §3-5 — the stub
   module's function signatures already match what that implementation
   will fill in.
5. DATA BLOCKERS table below is the remaining pre-launch punch list —
   nothing left is a FORGE code task; all remaining items need data/assets
   from the client.

Historical detail on the afs-023 → afs-025 build-blocker investigation and
the two real build bugs fixed in afs-025 (eager `new Stripe(...)` at module
scope; missing `<Suspense>` around `useSearchParams()` in
`app/checkout/page.tsx`) is preserved in SESSION_STATE.md's SESSION LOG.

---

*STATE_OF_THE_BUILD.md | Updated by FORGE after each run. Do not edit manually.*
