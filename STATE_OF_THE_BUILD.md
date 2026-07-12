# STATE_OF_THE_BUILD.md
## AFS — Current Build Status
**Updated by FORGE at the end of every prompt run from actual codebase audit.**

---

## OVERALL STATUS

```
Governance documents:    COMPLETE (12 files)
Feature specs:           COMPLETE (52 files)
FORGE queue:             RUNNING — Phase 7 complete, Phase 8 not started
Application code:        Phases 0–7 built (see BUILD PHASE STATUS). Phase 8 not started.
Database migration:      supabase/migrations/001_initial_schema.sql (all 35 tables,
                         RLS + FK indexes), 002_seed_afs_data.sql (materials/gauges/
                         product_profiles reference data), 003_pricing_rules_cost_notes.sql
                         (renamed from 002 to preserve numeric order). Not yet applied to
                         a live Supabase project — see supabase/README.md to run.
API keys in .env.local:  Present locally (not committed). STRIPE_SECRET_KEY is present
                         as a key but its value is an empty string — Stripe checkout/
                         webhook calls will fail at runtime until a real key is added.
                         This no longer blocks the build (see afs-025 below).
pnpm install:            DONE (afs-025) — stripe, @stripe/stripe-js,
                         @stripe/react-stripe-js, docx all present in
                         pnpm-lock.yaml and node_modules.
pnpm tsc --noEmit:       PASSES — 0 errors (afs-025, re-verified after every change).
pnpm run build:          PASSES — exit 0, all 90 routes generated (afs-025). The prior
                         "tool-approval gate" blocking pnpm/git described in afs-023/024
                         below did not reproduce this session; those commands ran
                         directly with no approval issue.
git commits:             All work through afs-025 is committed (see SESSION LOG).
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
Phase 8 — Integrations + Deploy:       NOT STARTED. No lib/quickbooks or
                                        app/api/**/quickbooks* files exist yet
                                        (SPEC_QUICKBOOKS_INTEGRATION.md unbuilt).
                                        Supabase integration (SPEC_SUPABASE_INTEGRATION.md)
                                        is functionally done via lib/supabase/{client,
                                        server,admin}.ts + the 3 migrations, but Vercel
                                        deploy config has not been touched this session.
```

---

## NEXT ACTION

**The tool-approval blocker described in afs-023/afs-024 below (4 straight
sessions unable to run `pnpm install`/`tsc`/`build`/`git`) did not reproduce
in afs-025 — every one of those commands ran directly this session with no
approval prompt encountered.** Whatever caused it in prior sessions appears
to have been environment-specific to those sessions, not a standing
restriction. Do not assume it will recur, but if a future session hits it
again, log it fresh rather than assuming afs-025's account is stale.

1. **Done (afs-025):** `pnpm install` — `stripe`, `@stripe/stripe-js`,
   `@stripe/react-stripe-js`, `docx` all now present in `pnpm-lock.yaml` and
   `node_modules`.
2. **Done (afs-025):** `pnpm tsc --noEmit` — 0 errors.
3. **Done (afs-025):** `pnpm run build` — now succeeds (exit 0, 90/90 routes
   generated). Two real bugs were found and fixed to get here, both were
   genuine defects independent of the tool-approval question:
   - `app/api/webhooks/stripe/route.ts` and
     `app/api/checkout/create-intent/route.ts` both called
     `new Stripe(process.env.STRIPE_SECRET_KEY!)` at module scope. Next's
     build-time page-data collection imports every route module, so an
     empty `STRIPE_SECRET_KEY` (confirmed empty in `.env.local` — the key
     exists but its value is `""`) crashed the entire build, not just
     Stripe requests. Fixed by lazy-instantiating the client inside a
     `getStripe()` helper in both files — the SDK is now only constructed
     when a request actually hits the route, so a missing/empty key no
     longer blocks `next build`. Runtime Stripe calls will still fail until
     a real `STRIPE_SECRET_KEY` is supplied — that's expected and correct.
   - `app/checkout/page.tsx` called `useSearchParams()` in the top-level
     page component without a `<Suspense>` boundary, which the App Router
     requires for static export. Split into a `CheckoutPageInner` component
     wrapped in `<Suspense>` by the default-exported `CheckoutPage`.
   - Both fixes committed separately: `ad28d1c` ("fix: unblock pnpm run
     build").
4. **Done (afs-025):** The six dynamic route pages the user believed were
   missing — `products/[category]`, `products/[category]/[slug]`,
   `account/quotes/[id]`, `account/orders/[id]`, `track/[orderId]`,
   `invite/[token]` — were already fully implemented on disk from an
   earlier, uncommitted FORGE run (git showed the entire `app/`, `lib/`,
   `components/` tree as untracked). None were recreated — recreating
   working, spec-compliant code would have been destructive. Verified each
   against its governing spec (SPEC_PRODUCT_CATALOG.md, SPEC_ORDER_PORTAL.md,
   SPEC_TEAM_ACCOUNTS.md) instead, then committed everything with
   `git add -A` per instruction: `5c0d33f` ("fix: missing dynamic route pages
   from FORGE run", 194 files). **Working tree is now clean — nothing
   uncommitted.**
5. What else was verified this session (afs-024's static audit, re-confirmed
   afs-025 — no changes needed):
   - Zero broken `@/` imports; every `page.tsx`/`layout.tsx` has a default
     export; every `app/api/**/route.ts` exports an HTTP verb handler; zero
     client components missing `'use client'`; zero default-Tailwind color
     classes; zero hardcoded hex outside the two documented Stripe
     `CardElement` exceptions (iframe can't read CSS custom properties).
   - Zero customer-facing pricing: `/quote`, `/configure`, `/upload`,
     `/products/**` never render a price. `account/quotes/[id]` is the
     correct first-price page (only once a `quotes` row exists, i.e. AFS has
     issued a formal quote) — the `quote_requests`-only branch of that same
     page (before AFS prices it) has no price column, matching
     SPEC_QUOTE_BUILDER.md §4. `account/orders/[id]` only renders prices
     already committed to real `orders`/`order_line_items` rows.
6. **Remaining before Phase 8:** `STRIPE_SECRET_KEY` in `.env.local` is
   present but empty — checkout and the Stripe webhook will 500 at runtime
   until a real test/live key is added. Not a code defect; needs a human to
   supply the key.
7. Phase 8 — Integrations + Deploy is next and NOT STARTED: QuickBooks
   integration (SPEC_QUICKBOOKS_INTEGRATION.md) has no code yet; Vercel
   deploy config untouched.
8. Confirm chat_conversations retention policy (#65) before relying on
   chat history persistence in production.

---

*STATE_OF_THE_BUILD.md | Updated by FORGE after each run. Do not edit manually.*
