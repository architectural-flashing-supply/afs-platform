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
│   ├── admin/                          /admin/...
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
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
METALS_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
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

---

## 12. GOVERNANCE UPDATE — REQUIRED LAST ACTION

The final action of every FORGE prompt:
1. Read the actual file tree and relevant source files
2. Update STATE_OF_THE_BUILD.md with what was built — from reality, not from memory
3. Update SESSION_STATE.md with what was built and what runs next
4. Commit all changes: `git add -A && git commit -m '[FORGE] {promptId}: {description}'`

---

*BLUEPRINT.md | AFS | Reid Whitesides | Visual AI Method | June 2026*
