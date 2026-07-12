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
pnpm tsc --noEmit:       PASSES — 0 errors (afs-027, re-verified after every change).
pnpm run build:          PASSES — exit 0, all 92 routes generated (afs-027, same route
                         count as afs-026 — this was a visual rebrand, no routes added
                         or removed).
git commits:             All work through afs-027 is committed (see SESSION LOG).
                         Working tree is clean.
Design system:           REBRANDED (afs-027) — site-wide light silver theme replacing
                         the original dark gunmetal theme. See DESIGN_TOKENS.md §10 for
                         full history. afs-bg-dim/base/raised/surface/overlay now run
                         #D0D0D0→#E6E6E6 (previously #1C1F26→#4E5568). Two new tokens,
                         afs-ink-900 (#111111) and afs-ink-700 (#374151), carry on-page
                         text that used to run on the chrome-high/mid/base scale — that
                         scale is retained, unchanged, for text on solid crimson/copper
                         fills only (buttons, badges), per explicit instruction to keep
                         all crimson CTAs exactly as they were. New afs-btn-chrome CSS
                         class (metallic gradient) added for the homepage's secondary
                         CTA. Visually verified via Playwright screenshot (temporary,
                         not added to package.json) against the running dev server —
                         homepage, /products, /about all render correctly with legible
                         dark text on the new light backgrounds and intact crimson CTAs.
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

**All 9 build phases (0–8) are built, and the site has been rebranded from
the dark gunmetal theme to a light silver theme (afs-027).** The tool-approval
gate logged in afs-023/024 has not recurred since afs-025.

1. **Done (afs-027):** Site-wide light theme rebrand. `tailwind.config.js` +
   `app/globals.css`: afs-bg-* tokens changed to light silver values, added
   `afs-ink-900`/`afs-ink-700` tokens, added `.afs-btn-chrome` CTA class.
   `DESIGN_TOKENS.md` rewritten to document the new theme (§10 has full
   before/after history). ~130 files across `app/` and `components/` had
   their on-page text classes remapped from the old light-on-dark
   `chrome-high/mid/base/dim` scale to the new dark-on-light `ink-900/700`
   scale, via 13 parallel subagents each handling a directory slice, plus
   manual passes on the homepage, product cards, and layout shells. Every
   crimson/copper CTA's `text-white` was deliberately left unchanged per
   instruction. Homepage headline enlarged ~30% and recolored; "Request a
   Quote" button converted to the new chrome-metallic style. Product
   category cards made compact with the title moved to the top of the tile.
   `pnpm tsc --noEmit` (0 errors) and `pnpm run build` (exit 0, 92/92 routes)
   both pass; visually verified via a temporary Playwright screenshot check
   against the dev server (not added as a project dependency). Committed.
2. **Done (afs-026):** Phase 8 — QuickBooks stub + Vercel deploy prep.
   `lib/integrations/quickbooks.ts`, `app/api/admin/quickbooks/status/route.ts`,
   `app/admin/quickbooks/page.tsx`, AdminShell nav entry, `vercel.json`,
   `.env.example` METALS_API_KEY addition.
3. **Remaining — not a code task:** `supabase/migrations/*` have not been
   applied to a live Supabase project yet (see `supabase/README.md`).
4. Confirm chat_conversations retention policy (#65) before relying on
   chat history persistence in production.
5. If/when the client confirms QuickBooks scope (checklist #52-54), build
   out real OAuth + sync per SPEC_QUICKBOOKS_INTEGRATION.md §3-5 — the stub
   module's function signatures already match what that implementation
   will fill in.
6. DATA BLOCKERS table below is the remaining pre-launch punch list —
   nothing left is a FORGE code task; all remaining items need data/assets
   from the client.
7. Known cosmetic residual from the rebrand: the `.metal-edge`/`.metal-edge-red`/
   `.metal-edge-copper` signature-element gradients and the (currently unused)
   `.hero-glow-red`/`.hero-glow-chrome` classes in `app/globals.css` were not
   updated — they were tuned for the old dark backgrounds and may read as
   faint against the new light ones. Not touched because they weren't in
   scope for this rebrand request; worth a follow-up pass if the Metal Edge
   accent looks washed out in review.

Historical detail on the afs-023 → afs-025 build-blocker investigation and
the two real build bugs fixed in afs-025 (eager `new Stripe(...)` at module
scope; missing `<Suspense>` around `useSearchParams()` in
`app/checkout/page.tsx`) is preserved in SESSION_STATE.md's SESSION LOG.

---

*STATE_OF_THE_BUILD.md | Updated by FORGE after each run. Do not edit manually.*
