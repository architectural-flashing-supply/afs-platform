# SITEMAP.md
## AFS — Complete Route Map
**113 routes (`pnpm run build`'s own route-table row count — see PAGE +
ROUTE COUNT below for the exact filesystem breakdown: 112 page.tsx/
route.ts files, 58 pages + 54 route handlers, +1 for Next's synthetic
`/_not-found` route that has no source file). Re-verified 2026-07-14
(afs-038) against the actual `app/` directory and a fresh `pnpm run
build` output after that session added `/studio/library` — the only
route-count change since the 2026-07-13 audit below. Note: this
document previously cited "106" for the build-reported count; a fresh,
reproducible recount (`grep` of the actual route table, not a
remembered figure) found 113 both before and after accounting for the
one new route, so 106 appears to have been an error in an earlier
pass rather than a real prior count — flagged here rather than quietly
carried forward. Original 2026-07-13 rewrite note preserved below since
its route-existence findings are still accurate:**
**Rewritten from a full audit of the actual `app/` directory on
2026-07-13 — the previous version of this document described several
routes that were never built (`/login/magic-sent`, `/account/delivery`,
`/admin/cad-library`, `/admin/consultations`, most of the
originally-planned `/api/**` tree) and omitted several that were
(`/studio/**`, `/admin/command-center`, `/admin/quickbooks`,
`/admin/pathfinder`, the real `/api/machine-bridge/**` and
`/api/studio/**` routes). This version reflects only routes that exist
as real files.**
**Reflects the RFQ model — no customer-facing pricing anywhere.**

---

## ROUTE TREE

```
app/
│
├── (public)/                        No auth required (route group — no URL segment)
│   ├── page.tsx                     / — Homepage. Assembled hpa-003, eleven
│                                     sections as of hpc-003 (profile-
│                                     explorer removed): app/components/
│                                     {hero,home}/ sections via
│                                     HomeSection.tsx wrapper, in order
│                                     (hero, credibility, field-app,
│                                     design-studio, design-to-delivery,
│                                     pathways, profile-passport,
│                                     case-studies, shop-floor, nationwide,
│                                     final-cta).
│                                     See COMPONENT_MAP.md LAYER 3.
│   ├── products/
│   │   ├── page.tsx                 /products — catalog, no prices
│   │   └── [category]/
│   │       ├── page.tsx             /products/[category]
│   │       └── [slug]/page.tsx      /products/[category]/[slug]
│   ├── architects/
│   │   ├── page.tsx                 /architects — portal landing, copper accent
│   │   ├── spec-writer/page.tsx     /architects/spec-writer — auth: architect|admin
│   │   ├── cad-library/page.tsx     /architects/cad-library — browse public, download auth
│   │   ├── finish-palette/page.tsx  /architects/finish-palette — browse public, download auth
│   │   ├── custom-profiles/page.tsx /architects/custom-profiles — auth required
│   │   ├── specs/[profileSlug]/page.tsx   /architects/specs/[profileSlug]
│   │   ├── guides/
│   │   │   ├── page.tsx             /architects/guides
│   │   │   └── [profileSlug]/page.tsx /architects/guides/[profileSlug]
│   │   └── consultation/page.tsx    /architects/consultation — public submit
│   ├── about/page.tsx               /about
│   ├── contact/page.tsx             /contact
│   └── legal/
│       ├── terms/page.tsx           /legal/terms
│       └── privacy/page.tsx         /legal/privacy — LAUNCH BLOCKER: #65
│
├── (auth)/                          Redirect to /account if already authenticated
│   ├── login/page.tsx               /login
│   ├── register/
│   │   ├── page.tsx                 /register
│   │   └── confirm/page.tsx         /register/confirm
│   ├── forgot-password/
│   │   ├── page.tsx                 /forgot-password
│   │   └── sent/page.tsx            /forgot-password/sent
│   └── reset-password/page.tsx      /reset-password
├── invite/[token]/page.tsx          /invite/[token] — team invitation accept flow
├── auth/callback/route.ts           /auth/callback — Supabase auth code exchange
│
├── quote/page.tsx                   /quote — Quote Request Wizard, no prices shown
├── configure/page.tsx               /configure — Custom Flashing Configurator, no prices
├── upload/page.tsx                  /upload — Blueprint Takeoff AI, no prices
├── track/[orderId]/page.tsx         /track/[orderId] — public tracker, no full auth
│
├── studio/                          Design Studio — primary NavBar destination
│   ├── page.tsx                     /studio — 4 tab-card landing (Scan/Photo/FlashDraft/
│   │                                 Custom Configurator, the last added afs-cs-002 —
│   │                                 links to the existing /configure route, which is
│   │                                 unchanged and still also linked from NavBar) +
│   │                                 a banner link to /studio/library
│   ├── draft/page.tsx               /studio/draft — FlashDraft 2D canvas tool (afs-038: hem
│   │                                 tool, bend-angle circle handles, inline dimension input,
│   │                                 mandatory 3D submit-confirmation modal — no more
│   │                                 [2D View][3D View] toggle)
│   ├── library/page.tsx             /studio/library — Profile Library (afs-038, NEW):
│   │                                 browsable grid of all public machine profiles, filters,
│   │                                 3-item compare tray, "Load into FlashDraft"
│   └── profile-viewer/[profileId]/page.tsx  /studio/profile-viewer/[id] — standalone
│                                     3D viewer, public profiles anonymous, private admin-only
│
├── account/                         Auth required — any role
│   ├── page.tsx                     /account — dashboard
│   ├── orders/
│   │   ├── page.tsx                 /account/orders
│   │   └── [id]/page.tsx            /account/orders/[id]
│   ├── quotes/
│   │   ├── page.tsx                 /account/quotes
│   │   └── [id]/page.tsx            /account/quotes/[id] — first place customer sees prices
│   ├── projects/
│   │   ├── page.tsx                 /account/projects
│   │   └── [id]/page.tsx            /account/projects/[id]
│   ├── documents/page.tsx           /account/documents
│   ├── invoices/page.tsx            /account/invoices
│   ├── templates/page.tsx           /account/templates
│   ├── team/page.tsx                /account/team
│   ├── credit-application/page.tsx  /account/credit-application
│   └── settings/page.tsx            /account/settings
│
├── checkout/page.tsx                /checkout — auth required, triggered only from
│                                     /account/quotes/[id] after quote approval
│
├── admin/                           Auth required — admin role only
│   ├── page.tsx                     /admin — dashboard
│   ├── command-center/page.tsx      /admin/command-center — Machine Bridge approval
│   │                                 queue (Pending Approval / Sent to Machine / Completed)
│   ├── quote-requests/
│   │   ├── page.tsx                 /admin/quote-requests
│   │   └── [id]/page.tsx            /admin/quote-requests/[id] — run pricing engine, send quote
│   ├── orders/
│   │   ├── page.tsx                 /admin/orders
│   │   └── [id]/page.tsx            /admin/orders/[id]
│   ├── customers/
│   │   ├── page.tsx                 /admin/customers
│   │   └── [id]/page.tsx            /admin/customers/[id]
│   ├── pricing/page.tsx             /admin/pricing — pricing rules editor, commodity dashboard
│   ├── credit-applications/page.tsx /admin/credit-applications
│   ├── quickbooks/page.tsx          /admin/quickbooks — connection status, stubbed (not live)
│   └── settings/page.tsx            /admin/settings — integration status, system settings
│                                     (NOTE: /admin/pathfinder has no page.tsx — it's API-only,
│                                      see below; /admin/cad-library and /admin/consultations
│                                      described in earlier drafts of this doc were never built)
│
└── api/                             All server-side
    ├── upload/route.ts                              POST
    ├── takeoff/route.ts                              POST
    ├── quote-requests/route.ts                       GET POST
    ├── products/ai-search/route.ts                   POST — Claude-backed search
    ├── orders/[id]/reorder/route.ts                   POST
    ├── chat/route.ts                                  POST — streaming AI chatbot
    ├── spec/route.ts                                  POST
    ├── spec/save/route.ts                             POST
    ├── spec/[id]/docx/route.ts                        GET
    ├── documents/upload/route.ts                      POST
    ├── documents/download/route.ts                    POST
    ├── documents/[id]/route.ts                        DELETE
    ├── documents/[id]/download/route.ts                GET
    ├── account/profile/route.ts                       PATCH
    ├── account/notifications/route.ts                  PATCH
    ├── team/invite/route.ts                           POST
    ├── credit/apply/route.ts                          POST
    ├── consultation/request/route.ts                   POST
    ├── contact/route.ts                               POST
    ├── auth/register/route.ts                         POST
    ├── checkout/create-intent/route.ts                 POST
    ├── projects/route.ts                              GET POST
    ├── projects/[id]/route.ts                          GET PATCH
    ├── invoices/statement/route.ts                     GET
    ├── invoices/[id]/pdf/route.ts                      GET
    ├── templates/route.ts                             GET POST
    ├── templates/[id]/use/route.ts                     POST
    ├── track/verify/route.ts                          POST — order tracker email verify
    ├── recommendations/material/route.ts               POST
    ├── recommendations/cross-sell/route.ts             POST
    ├── architects/installation-advisor/route.ts        POST
    ├── architects/palette/[materialSlug]/pdf/route.ts   GET
    ├── studio/match-profile/route.ts                   POST — debounced profile matching
    ├── webhooks/stripe/route.ts                        POST
    │
    ├── machine-bridge/                                  Bearer AFS_BRIDGE_SECRET, not session auth
    │   ├── pending-jobs/route.ts                        GET — bridge polls this
    │   ├── job-delivered/route.ts                       POST — bridge reports staged/failed
    │   └── status/route.ts                              GET — connection-status ping
    │
    └── admin/                                           admin role required
        ├── customers/[id]/route.ts                      PATCH
        ├── credit-applications/[id]/route.ts             PATCH
        ├── orders/[id]/status/route.ts                   PATCH
        ├── orders/[id]/notes/route.ts                    POST
        ├── orders/[id]/photos/route.ts                   POST
        ├── pricing/rules/[productId]/route.ts             GET PATCH
        ├── quote-requests/[id]/send/route.ts              POST
        ├── quickbooks/status/route.ts                     GET — stubbed, not live
        ├── pathfinder/route.ts                            GET — stubbed, not live
        ├── pathfinder/push-profile/route.ts                POST — stubbed, not live
        ├── pathfinder/submit-job/route.ts                  POST — stubbed, not live
        └── command-center/
            ├── approve/route.ts                          POST — approve a machine_jobs row
            ├── approve-quote-request/route.ts             POST — approve a quote_requests row directly
            ├── reject/route.ts                            POST — reason required
            ├── request-changes/route.ts                   POST — sets changes_requested + emails customer
            └── mark-delivered/route.ts                    POST — closes the human-review-gate loop
```

**Routes described in earlier drafts of this document that were never
built and do not exist:** `/login/magic-sent`, `/account/delivery`,
`/admin/cad-library`, `/admin/consultations`, `/legal/warranty`, and most
of the originally-planned `/api/quotes/**`, `/api/products/search`,
`/api/products/[id]`, `/api/orders` (GET/POST — only `[id]/reorder`
exists), `/api/delivery/**`, `/api/pickup/**`, `/api/configurator/**`,
`/api/invoices` (GET list — only `statement` and `[id]/pdf` exist),
`/api/cron/**` (no cron routes exist yet — see PRICING_ENGINE.md §8,
still speculative), and `/api/webhooks/twilio`.

---

## ROUTE PROTECTION MATRIX

```
Route Pattern                Auth Required   Role           Notes
───────────────────────────────────────────────────────────────────
/                            No             —              Public. Assembled hpa-003 --
                                                             see COMPONENT_MAP.md LAYER 3
/products/**                 No             —              Public — no prices
/quote                       No             —              Public
/configure                   No             —              Public
/upload                      No             —              Public
/studio                      No             —              Public
/studio/draft                No             —              Public
/studio/library              No             —              Public — service-role fetch server-
                                                             side, same anonymous-read rationale
                                                             as /studio/profile-viewer/[id] below
/studio/profile-viewer/[id]  Partial        —              Public profile: anyone. Private
                                                             profile: admin only (404s otherwise)
/design-studio                No             —              Public. hp-006, feat/homepage-redesign
                                                             only, not yet on main. Renders
                                                             DesignStudioHub full-width; normal
                                                             NavBar/Footer/ChatWidget chrome. A
                                                             second, un-reconciled "Design Studio"
                                                             destination alongside /studio.
/faq                          No             —              Public. Missing from this matrix
                                                             before hp-024 despite being a real
                                                             route (app/(public)/faq/page.tsx).
/resources                    No             —              Public. Same as /faq — real route,
                                                             was missing from this matrix before
                                                             hp-024 (app/(public)/resources/page.tsx).
/hailview                     No             —              Public. HailView tool (afs-hv-001
                                                             through afs-hv-009) — was missing
                                                             from this matrix before hp-024
                                                             (app/hailview/page.tsx).
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
/account/**                  Yes            any            middleware.ts + AppChrome portal exclusion
/checkout                    Yes            any            middleware.ts
/admin/**                    Yes            admin          middleware.ts + route check +
                                                             AppChrome portal exclusion
/api/admin/**                Yes (server)   admin          Server-side check in handler
/api/machine-bridge/**       Bearer token   —              AFS_BRIDGE_SECRET required, not
                                                             Supabase session auth — see
                                                             ARCHITECTURE.md §11
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

Re-verified 2026-07-14 (afs-038) against the actual `app/` directory
(`find app -name page.tsx` / `find app -name route.ts`) — unchanged
since 2026-07-13 except the one new page:

```
Public pages:        25  (includes Design Studio: /studio, /studio/draft,
                          /studio/library, /studio/profile-viewer/[id])
Auth pages:            7
Account pages:        13
Admin pages:          12
Checkout:              1
Auth callback route:   1
API routes:           53
─────────────────────
Total (filesystem):  112  (58 page.tsx + 54 route.ts)
```

`pnpm run build`'s own route table (`grep -E '^(├|└|┌).*(○|●|ƒ)'` against
a fresh build's output — a reproducible count, not a remembered one)
shows **113 rows**: the 112 real files above, plus Next's synthetic
`/_not-found` route (no source file). Unlike a prior version of this
document, the build table does **not** collapse dynamic routes below
their file count — each dynamic `page.tsx` (e.g. `/products/[category]`)
is still exactly one row; only its individually-generated static paths
(e.g. every category slug) are nested *under* that row, not counted as
separate top-level rows. **113 is the number to cite as "the route
count"** going forward — it reconciles cleanly with the filesystem count
above (112 + 1 synthetic route), which the previously-cited "106" did
not.

---

*SITEMAP.md | AFS | Reid Whitesides | June 2026*
*Rewritten from a full app/ directory audit, 2026-07-13; route count
re-verified and corrected, /studio/library added, 2026-07-14 (afs-038).*
*RFQ model. No customer-facing pricing on any public or account route.*
