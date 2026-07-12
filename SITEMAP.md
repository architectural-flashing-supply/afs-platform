# SITEMAP.md
## AFS — Complete Route Map
**83 routes. Every route mapped to its spec, auth requirement, and role gate.**
**Reflects the RFQ model — no customer-facing pricing anywhere.**

---

## ROUTE TREE

```
afs-web/app/
│
├── (public)/                        No auth required on these routes
│   │
│   ├── page.tsx
│   │   URL:      /
│   │   Page:     Homepage
│   │   Spec:     SPEC_HOMEPAGE.md
│   │   Purpose:  Qualifies 4 audiences. Drives to /quote or /upload.
│   │             No prices. CTAs: "Submit a Drawing" "Request a Quote"
│   │
│   ├── products/
│   │   ├── page.tsx
│   │   │   URL:      /products
│   │   │   Page:     Product Catalog
│   │   │   Spec:     SPEC_PRODUCT_CATALOG.md
│   │   │   Purpose:  Browse what AFS fabricates. No prices.
│   │   │             Every product drives to "Request a Quote"
│   │   │
│   │   └── [category]/
│   │       ├── page.tsx
│   │       │   URL:      /products/[category]
│   │       │   Example:  /products/coping-caps
│   │       │   Spec:     SPEC_PRODUCT_CATALOG.md
│   │       │   Params:   generateStaticParams from product_profiles.slug
│   │       │
│   │       └── [slug]/
│   │           └── page.tsx
│   │               URL:      /products/[category]/[slug]
│   │               Example:  /products/coping-caps/galvanized-20ga
│   │               Spec:     SPEC_PRODUCT_CATALOG.md §4
│   │               Params:   generateStaticParams from products joined to profiles
│   │
│   ├── quote/
│   │   └── page.tsx
│   │       URL:      /quote
│   │       Page:     Quote Request Wizard (4 steps, client-side state)
│   │       Spec:     SPEC_QUOTE_BUILDER.md
│   │       Purpose:  Customer specifies profiles, materials, dimensions.
│   │                 Submits request. AFS prices internally. No prices shown.
│   │       Params:   ?step=1-4 ?product={id} ?profile={id} ?project={id}
│   │                 ?from_order={id} ?from_template={id}
│   │
│   ├── configure/
│   │   └── page.tsx
│   │       URL:      /configure
│   │       Page:     Custom Flashing Configurator
│   │       Spec:     SPEC_FLASHING_CONFIGURATOR.md
│   │       Purpose:  Precise custom profile specification with live SVG diagram.
│   │                 Output is a quote request submission. No prices shown.
│   │       Params:   ?profile={id} ?saved={configId}
│   │
│   ├── upload/
│   │   └── page.tsx
│   │       URL:      /upload
│   │       Page:     Blueprint Takeoff AI
│   │       Spec:     SPEC_DRAWING_TOOL.md
│   │       Purpose:  Upload DWG/DXF/PDF. AI extracts profiles and dimensions.
│   │                 Result converts to quote request. No prices shown.
│   │       Params:   ?mode=blueprint|photo ?project={id}
│   │
│   ├── track/
│   │   └── [orderId]/
│   │       └── page.tsx
│   │           URL:      /track/[orderId]
│   │           Page:     Public Order Tracker
│   │           Spec:     SPEC_ORDER_PORTAL.md §6
│   │           Auth:     Email verification (not full auth — order ID + email)
│   │           Purpose:  Track fabrication and delivery without logging in.
│   │                     Shows production timeline, ship date, tracking link.
│   │                     Does NOT show pricing.
│   │           Rate limit: 10 lookups per IP per hour
│   │
│   ├── architects/
│   │   ├── page.tsx
│   │   │   URL:      /architects
│   │   │   Page:     Architect Portal Landing
│   │   │   Spec:     SPEC_ARCHITECT_PORTAL.md
│   │   │   Design:   Copper accent replaces crimson. Same dark gunmetal base.
│   │   │
│   │   ├── spec-writer/
│   │   │   └── page.tsx
│   │   │       URL:      /architects/spec-writer
│   │   │       Page:     AI CSI Specification Generator
│   │   │       Spec:     SPEC_AI_SPEC_WRITER.md
│   │   │       Auth:     Required — architect or admin role
│   │   │       Purpose:  Generates CSI Division 07 spec sections.
│   │   │                 Output: editable DOCX. No pricing in specs.
│   │   │
│   │   ├── cad-library/
│   │   │   └── page.tsx
│   │   │       URL:      /architects/cad-library
│   │   │       Page:     Technical Drawing Library
│   │   │       Spec:     SPEC_CAD_BIM_LIBRARY.md
│   │   │       Auth:     Browse public. Download requires auth (any role).
│   │   │       Purpose:  DWG, DXF, PDF, Revit families for every AFS profile.
│   │   │
│   │   ├── finish-palette/
│   │   │   └── page.tsx
│   │   │       URL:      /architects/finish-palette
│   │   │       Page:     Finish and Color Library
│   │   │       Spec:     SPEC_FINISH_PALETTE.md
│   │   │       Auth:     Browse public. Download requires auth.
│   │   │
│   │   ├── custom-profiles/
│   │   │   └── page.tsx
│   │   │       URL:      /architects/custom-profiles
│   │   │       Page:     Saved Custom Profile Library
│   │   │       Spec:     SPEC_CUSTOM_PROFILE_LIBRARY.md
│   │   │       Auth:     Required — any role
│   │   │
│   │   ├── specs/
│   │   │   └── [profileSlug]/
│   │   │       └── page.tsx
│   │   │           URL:      /architects/specs/[profileSlug]
│   │   │           Example:  /architects/specs/coping-caps
│   │   │           Page:     Material Specification + Data Sheet
│   │   │           Spec:     SPEC_MATERIAL_SPEC_LIBRARY.md
│   │   │
│   │   ├── guides/
│   │   │   ├── page.tsx
│   │   │   │   URL:      /architects/guides
│   │   │   │   Page:     Architectural Resource Center
│   │   │   │   Spec:     SPEC_ARCHITECTURAL_RESOURCE_CENTER.md
│   │   │   │
│   │   │   └── [profileSlug]/
│   │   │       └── page.tsx
│   │   │           URL:      /architects/guides/[profileSlug]
│   │   │           Page:     Field Installation Guide
│   │   │           Spec:     SPEC_FIELD_INSTALLATION_GUIDES.md
│   │   │
│   │   └── consultation/
│   │       └── page.tsx
│   │           URL:      /architects/consultation
│   │           Page:     Design Consultation Request
│   │           Spec:     SPEC_DESIGN_CONSULTATION.md
│   │           Auth:     Public (no auth required to submit)
│   │
│   ├── about/
│   │   └── page.tsx
│   │       URL:      /about
│   │       Page:     Company story, facility, team
│   │       Blocked:  Photography (#9), copy (#11)
│   │
│   ├── contact/
│   │   └── page.tsx
│   │       URL:      /contact
│   │       Params:   ?order={id} (pre-fills order reference)
│   │       Blocked:  Address, phone, hours (#5, #6)
│   │
│   └── legal/
│       ├── terms/page.tsx          /legal/terms       — Blocked: #64, #92
│       ├── privacy/page.tsx        /legal/privacy     — LAUNCH BLOCKER: #65
│       └── warranty/page.tsx       /legal/warranty    — Blocked: #63
│
├── (auth)/                          Redirect to /account if already authenticated
│   ├── login/
│   │   ├── page.tsx                 /login
│   │   │   Spec: SPEC_AUTH.md §2.3
│   │   │   Params: ?redirect={url} ?error={code}
│   │   └── magic-sent/page.tsx      /login/magic-sent
│   │
│   ├── register/
│   │   ├── page.tsx                 /register
│   │   │   Spec: SPEC_AUTH.md §2.1
│   │   └── confirm/page.tsx         /register/confirm
│   │
│   ├── forgot-password/
│   │   ├── page.tsx                 /forgot-password
│   │   └── sent/page.tsx            /forgot-password/sent
│   │
│   ├── reset-password/page.tsx      /reset-password
│   │
│   └── invite/[token]/page.tsx      /invite/[token]
│       Spec: SPEC_TEAM_ACCOUNTS.md §4
│
├── auth/callback/route.ts           /auth/callback
│   Spec: SPEC_AUTH.md §4.1
│   Purpose: Supabase auth code exchange for magic links and email confirmation
│
├── account/                         Auth required — any role
│   ├── page.tsx                     /account
│   │   Spec: SPEC_ORDER_PORTAL.md §2
│   │   Page: Customer Dashboard
│   │
│   ├── orders/
│   │   ├── page.tsx                 /account/orders
│   │   │   Spec: SPEC_ORDER_PORTAL.md §3
│   │   └── [id]/page.tsx            /account/orders/[id]
│   │       Spec: SPEC_ORDER_PORTAL.md §4
│   │
│   ├── quotes/
│   │   ├── page.tsx                 /account/quotes
│   │   │   Purpose: List of quote_requests and formal quotes from AFS
│   │   └── [id]/page.tsx            /account/quotes/[id]
│   │       Purpose: View formal AFS quote. First time customer sees prices.
│   │                [Approve & Pay] button triggers checkout.
│   │
│   ├── projects/
│   │   ├── page.tsx                 /account/projects
│   │   │   Spec: SPEC_MULTI_PROJECT_MANAGEMENT.md §3
│   │   └── [id]/page.tsx            /account/projects/[id]
│   │       Spec: SPEC_MULTI_PROJECT_MANAGEMENT.md §4
│   │
│   ├── documents/page.tsx           /account/documents
│   │   Spec: SPEC_DOCUMENT_UPLOAD.md §5
│   │
│   ├── invoices/page.tsx            /account/invoices
│   │   Spec: SPEC_INVOICE_PORTAL.md
│   │   Purpose: AFS-generated invoices. Prices set by AFS.
│   │
│   ├── delivery/page.tsx            /account/delivery
│   │   Spec: SPEC_DELIVERY_SCHEDULER.md
│   │
│   ├── templates/page.tsx           /account/templates
│   │   Spec: SPEC_SAVED_PROJECT_TEMPLATES.md
│   │
│   ├── team/page.tsx                /account/team
│   │   Spec: SPEC_TEAM_ACCOUNTS.md §5
│   │
│   ├── credit-application/page.tsx  /account/credit-application
│   │   Spec: SPEC_ONLINE_CREDIT_APPLICATION.md
│   │
│   └── settings/page.tsx            /account/settings
│       Spec: SPEC_AUTH.md §8
│
├── checkout/page.tsx                /checkout
│   Auth: Required — any role
│   Spec: SPEC_CHECKOUT.md
│   Purpose: Triggered ONLY from /account/quotes/[id] after customer
│             approves formal AFS quote. Collects payment.
│   Params: ?quote={id}
│
├── admin/                           Auth required — admin role only
│   ├── page.tsx                     /admin
│   │   Spec: SPEC_ADMIN_PORTAL.md §3
│   │   Page: Admin Dashboard
│   │
│   ├── quote-requests/
│   │   ├── page.tsx                 /admin/quote-requests
│   │   │   Purpose: Queue of incoming quote requests. Core admin workflow.
│   │   └── [id]/page.tsx            /admin/quote-requests/[id]
│   │       Purpose: View request, run pricing engine, send formal quote.
│   │       Spec: PRICING_ENGINE.md §6
│   │
│   ├── orders/
│   │   ├── page.tsx                 /admin/orders
│   │   │   Spec: SPEC_PRODUCTION_QUEUE.md §2
│   │   └── [id]/page.tsx            /admin/orders/[id]
│   │       Spec: SPEC_PRODUCTION_QUEUE.md §4
│   │
│   ├── customers/
│   │   ├── page.tsx                 /admin/customers
│   │   │   Spec: SPEC_CUSTOMER_MANAGEMENT.md §1
│   │   └── [id]/page.tsx            /admin/customers/[id]
│   │       Spec: SPEC_CUSTOMER_MANAGEMENT.md §2
│   │
│   ├── pricing/page.tsx             /admin/pricing
│   │   Spec: SPEC_PRICING_ADMIN.md
│   │   Purpose: Pricing rules editor, commodity dashboard, trend alerts.
│   │
│   ├── cad-library/page.tsx         /admin/cad-library
│   │   Spec: SPEC_CAD_BIM_LIBRARY.md §5
│   │
│   ├── consultations/page.tsx       /admin/consultations
│   │   Spec: SPEC_DESIGN_CONSULTATION.md §4
│   │
│   ├── credit-applications/page.tsx /admin/credit-applications
│   │   Spec: SPEC_ONLINE_CREDIT_APPLICATION.md §4
│   │
│   └── settings/page.tsx            /admin/settings
│       Purpose: Integration status, QuickBooks connect, system settings
│
└── api/                             All server-side — never callable for AI from client
    │
    ├── upload/route.ts              POST /api/upload
    ├── takeoff/route.ts             POST /api/takeoff
    ├── takeoff/confirm/route.ts     POST /api/takeoff/confirm
    │
    ├── quote-requests/
    │   ├── route.ts                 GET POST /api/quote-requests
    │   └── [id]/route.ts           GET /api/quote-requests/[id]
    │
    ├── quotes/
    │   ├── route.ts                 GET /api/quotes
    │   └── [id]/
    │       ├── route.ts            GET /api/quotes/[id]
    │       └── approve/route.ts    POST /api/quotes/[id]/approve
    │
    ├── products/
    │   ├── route.ts                 GET /api/products
    │   ├── search/route.ts          GET /api/products/search?q=
    │   └── [id]/route.ts           GET /api/products/[id]
    │
    ├── orders/
    │   ├── route.ts                 GET POST /api/orders
    │   └── [id]/
    │       ├── route.ts            GET PATCH /api/orders/[id]
    │       ├── reorder/route.ts    POST /api/orders/[id]/reorder
    │       └── status/route.ts     PATCH /api/orders/[id]/status (admin)
    │
    ├── chat/route.ts                POST /api/chat (streaming)
    ├── spec/route.ts                POST /api/spec
    ├── spec/[id]/docx/route.ts      GET /api/spec/[id]/docx
    │
    ├── delivery/
    │   ├── schedule/route.ts        POST /api/delivery/schedule
    │   ├── reschedule/route.ts      POST /api/delivery/reschedule
    │   └── availability/route.ts    GET /api/delivery/availability
    │
    ├── pickup/schedule/route.ts     POST /api/pickup/schedule
    │
    ├── documents/
    │   ├── route.ts                 GET /api/documents
    │   ├── upload/route.ts          POST /api/documents/upload
    │   ├── [id]/route.ts           DELETE /api/documents/[id]
    │   └── [id]/download/route.ts   GET /api/documents/[id]/download
    │
    ├── account/
    │   ├── profile/route.ts         PATCH /api/account/profile
    │   └── notifications/route.ts   PATCH /api/account/notifications
    │
    ├── team/invite/route.ts         POST /api/team/invite
    ├── credit/apply/route.ts        POST /api/credit/apply
    ├── consultation/request/route.ts POST /api/consultation/request
    │
    ├── configurator/
    │   ├── profile/[id]/route.ts    GET /api/configurator/profile/[id]
    │   ├── save/route.ts            POST /api/configurator/save
    │   └── submit/route.ts          POST /api/configurator/submit
    │
    ├── architects/
    │   └── palette/[slug]/pdf/route.ts GET /api/architects/palette/[slug]/pdf
    │
    ├── invoices/
    │   ├── route.ts                 GET /api/invoices
    │   └── [id]/pdf/route.ts        GET /api/invoices/[id]/pdf
    │
    ├── admin/
    │   ├── quote-requests/[id]/price/route.ts  POST — run pricing engine
    │   ├── quote-requests/[id]/send/route.ts   POST — send formal quote
    │   ├── customers/[id]/route.ts  PATCH
    │   ├── pricing/commodity/route.ts GET PATCH
    │   └── pricing/rules/route.ts   GET PATCH
    │
    ├── cron/
    │   ├── commodity-prices/route.ts GET — daily commodity fetch
    │   └── pricing-trends/route.ts  GET — nightly trend analysis
    │
    └── webhooks/
        ├── stripe/route.ts          POST — payment events
        └── twilio/route.ts          POST — SMS opt-out handling
```

---

## ROUTE PROTECTION MATRIX

```
Route Pattern                Auth Required   Role           Notes
───────────────────────────────────────────────────────────────────
/                            No             —              Public
/products/**                 No             —              Public — no prices
/quote                       No             —              Public
/configure                   No             —              Public
/upload                      No             —              Public
/track/[id]                  No             —              Email verify
/architects                  No             —              Public
/architects/spec-writer      Yes            architect|admin
/architects/cad-library      Partial        any            Browse public, download auth
/architects/finish-palette   Partial        any            Browse public, download auth
/architects/custom-profiles  Yes            any
/architects/specs/**         No             —              Public
/architects/guides/**        No             —              Public
/architects/consultation     No             —              Public
/about                       No             —              Public
/contact                     No             —              Public
/legal/**                    No             —              Public
/login                       No             —              Redirect if authed
/register                    No             —              Redirect if authed
/forgot-password             No             —              Public
/reset-password              No             —              Public
/invite/[token]              No             —              Token validates identity
/auth/callback               No             —              Supabase handler
/account/**                  Yes            any            middleware.ts
/checkout                    Yes            any            middleware.ts
/admin/**                    Yes            admin          middleware.ts + route check
/api/admin/**                Yes (server)   admin          Server-side check in handler
/api/cron/**                 Bearer token   —              CRON_SECRET required
```

---

## URL NAMING CONVENTIONS

```
Category slugs:      kebab-case from product_profiles.slug
                     e.g. coping-caps, base-flashing, step-flashing

Reference numbers:
  Quote requests:    AFS-QR-2026-XXXXX
  Formal quotes:     AFS-Q-2026-XXXXX
  Orders:            AFS-2026-XXXXX
  Invoices:          AFS-INV-2026-XXXXX

Query params:
  ?step=             Quote wizard step (1-4)
  ?product={id}      Pre-select product in wizard
  ?profile={id}      Pre-select profile in configurator
  ?project={id}      Assign submission to project
  ?from_order={id}   Reorder — load order's items
  ?from_template={id} Load template items
  ?redirect={url}    Post-login redirect target
  ?mode=             Upload mode: blueprint | photo
  ?quote={id}        Checkout quote reference
```

---

## PAGE + ROUTE COUNT

```
Public pages:        18  (including legal placeholders)
Auth pages:           7
Account pages:       11
Admin pages:          7
API routes:          40
Cron routes:          2
Webhook routes:       2
─────────────────────
Total:               87 routes
```

---

*SITEMAP.md | AFS | Reid Whitesides | June 2026*
*RFQ model. No customer-facing pricing on any public or account route.*
