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
SPEC_SHOP_CALLOUTS.md          (repo root, not specs/ — see MASTER_DOCUMENT_REGISTRY.md)
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

    **"Customer approved by phone" is NOT a fifth door, and must never become
    one.** `app/api/admin/command-center/approve-by-phone/route.ts` records
    that a customer said yes on the telephone. It writes the approval record
    the guard READS — `job_stage='approved'`, `approval_channel='phone'`,
    `approved_by`, `approved_at`, plus an audit row — and it deliberately
    LEAVES `status='submitted'` alone so the guard's own condition still holds
    when someone later presses "Send to machine". It imports nothing from
    `lib/integrations/pathfinder-edge.ts` and makes no outbound request. If a
    future change makes it push directly, the static single-door test fails,
    and that failure is correct. Do not add it to the allow-list.

15. **RUSH IS NEVER INFERRED. Two sources, and Postgres enforces it.**
    `quote_requests.is_rush` may be set by the customer's explicit checkbox at
    intake (`app/api/quote-requests/route.ts`) or by an admin's explicit toggle
    (`app/api/admin/command-center/set-rush/route.ts`). Never from a delivery
    date, a keyword like "ASAP", the customer's note, or how long a job has
    been waiting.

    Migration 034's `quote_requests_rush_needs_explicit_source` CHECK refuses
    `is_rush = true` unless `rush_source` is `'customer_checkbox'` or
    `'admin_toggle'`. There is no third value, so an inference has nothing it
    could write. `lib/data/rush-explicit-only.test.ts` is a STATIC test that
    fails if any file outside the four known writers assigns `is_rush`, or if
    a writer gains an inference-shaped expression on the assignment line.

    **The constraint's `IS NOT NULL` half is load-bearing.** The naive
    `CHECK (is_rush = false OR rush_source IN (...))` was applied live and
    ACCEPTED a rush with a NULL source — `false OR UNKNOWN` is UNKNOWN, and a
    CHECK accepts UNKNOWN. Do not simplify it back. Full detail: SCHEMA.md
    TABLE 15.

    **Rush pins to the top of the SHOP QUEUES ONLY** — `lib/data/machine-jobs.ts`,
    `lib/data/orders.ts` and, as of v2-04, `lib/data/shop-queue.ts`'s
    `compareShopQueue`: the lists read by whoever decides what to bend next.
    Everywhere else, including the Workbench, the office pending list and the
    Deliveries screen, ordering is newest arrival first (or, on a calendar, by
    day and time window) and rush changes nothing but the badge. Deliveries is
    NOT a shop queue: a rush job whose day is Thursday does not become a Tuesday
    stop by being urgent. Both halves are asserted against the same two rows in
    `lib/data/shop-queue.test.ts`, and live on alpha by
    `tests/e2e/shop-deliveries.spec.ts`.

    **`is_rush` is never read off `shop_profile_library`.** That table has no
    such column and must not get one. It is read from the Job
    (`quote_requests.is_rush`), which is the only place the CHECK above applies.
    A shop row with no Job behind it — a direct FlashDraft send — is therefore
    never rush, which is correct: nobody ticked anything.

16. **A send is never reported as successful without the PathfinderEdge
    profile number that was actually returned.** `pushProfileToPathfinder` can
    return `status: 'connected'` with `profileId: null` — the profile really
    was created, but the follow-up GET that resolves its number did not find
    it. That is NOT a success and it is NOT a failure: it is
    `send_status='unconfirmed'`, reported in plain English, with **no retry
    offered**, because a retry would duplicate a real profile in catalog 20115.
    A genuine failure writes `send_status='failed'` plus the real reason and an
    audit row, and the card reads "Send failed — retry" after a reload. An
    already-sent job answers 200 with "This job has already been sent to the
    machine. Nothing was sent again." — never a bare 409. Full table:
    ARCHITECTURE.md's APPROVAL FEEDBACK section.

17. **ONE confidence pattern — `lib/ai/takeoff-confidence.ts`. Do not write a
    second.** The `high | medium | low` vocabulary, the per-item `aiNote`, the
    `overallConfidence` and the `confidence !== 'high'` "unsure" threshold all
    live there. `app/api/takeoff/route.ts` PRODUCES that shape and imports the
    module; the Command Center Job screen CONSUMES it and imports the same
    module. A local `type X = 'high' | 'medium' | 'low'` anywhere is the drift
    this prevents, and a unit test fails on one. When a job has no AI
    extraction behind it, the panel says so rather than badging the customer's
    own numbers with a confidence they never earned.

18. **Gunmetal header, light working area — converted per screen, by the
    page.** The Workbench, the Job screen, Shop View and Deliveries (v2-04)
    and Search (v2-05) render inside
    `components/admin/LightWorkingArea.tsx`; the list
    is data in `lib/data/admin-working-area.ts` and is unit-tested, so "which
    screens are light" is an assertion rather than a memory. Every other admin
    page is still gunmetal and converts when it is rebuilt (its text uses the
    light-on-dark `afs-chrome-*` tokens and would be unreadable otherwise). The
    PAGE opts in — the shell does not decide from the pathname — because
    `/admin/command-center` serves both the light Workbench and the pre-V2 dark
    `?tab=` views under one pathname. New light tokens are `afs-bg-lane`,
    `afs-bg-card`, `afs-line-strong`, `afs-green-deep` / `afs-green-ink` /
    `afs-green-soft`, `afs-amber-bg` / `afs-amber-ink`, with their measured
    contrast ratios recorded beside them in `tailwind.config.js`. Reuse
    `afs-bg-band`, `afs-bg-light-raised`, `afs-border-light`, `afs-ink-900` and
    `afs-ink-700` rather than adding near-duplicates.

    **PLACEHOLDER TEXT IS BODY TEXT: 4.5:1, no exemption.** A placeholder is
    meant to look dimmer, which makes it the easiest pair to get wrong — reach
    for the dimmest token on the scale and the contrast is gone.
    **`afs-chrome-dim` (#7A8299) is never a placeholder colour.** Measured, it
    fails against every gunmetal surface in the palette: 4.30:1 on `afs-bg-dim`
    at best, **1.94:1 on `afs-bg-overlay`** at worst, where the Command Center's
    reject/request-changes modal had it. Use **`afs-chrome-silver` (#C8D0E0)**,
    which clears AA on all five (4.80:1 at worst) and still sits well below the
    white typed text at 7.44:1, so it still reads as a placeholder.
    `lib/design/placeholder-contrast.test.ts` computes these ratios from
    `tailwind.config.js` rather than trusting a comment, and asserts the premise
    (chrome-dim fails everywhere) as well as the fix, so a retheme cannot make
    the rule silently vacuous. **21 files outside the Command Center and the sign-in flow still use
    `afs-chrome-dim` this way** — listed in STATE_OF_THE_BUILD.md's v2-02
    re-verification entry, PENDING REID, and not to be swept without his say.
    The twenty-second was `authInputClass` in `components/layout/AuthShell.tsx`,
    at **1.94:1** on `afs-bg-overlay`, on every page of the sign-in flow — which
    is the only way into every Command Center screen, and therefore inside rule
    #28's build gate. It was fixed in v2-06 and the override is recorded in
    STATE_OF_THE_BUILD.md's v2-06 entry. Nothing else on the list was touched.


19. **THE PRICE BOOK IS VERSIONED AND NEVER OVERWRITTEN, AND A BLANK IS NEVER
    A ZERO.** `price_book_items` (material + gauge, addable and retirable) and
    `price_book_versions` (what it cost, from when) — migration 035. An edit
    INSERTS a version with a new `effective_from`; it never updates one, and
    the database refuses the update anyway (`price_book_versions_append_only`).
    An already-issued quote therefore keeps the prices it was built on forever,
    upheld three ways over: the insert-only writer, the trigger, and the quote's
    own cents snapshot in `quotes.line_items`.

    **PRICES START EMPTY.** Every money column is NULLABLE with NO DEFAULT. The
    24 seeded rows have no version at all. `NULL` means Steve has not filled it
    in: it renders as a marked **"Not set"** chip on amber, and
    `lib/pricing/quote-math.ts` REFUSES to issue a quote that needs it, naming
    the row to go and fix. There is no `DEFAULT 0` anywhere — a zero is a price,
    and a made-up one. `extras` is the single exception: blank extras means "no
    extras", not "unpriced".

    **Strips per sheet are DERIVED, never stored:** `floor(48 / blankWidthIn)`,
    because a strip's width comes out of the sheet's 4 ft dimension and its
    length is the full 10 ft. A blank wider than 48 in, or a piece longer than
    10 ft, FAILS LOUDLY — the naive formula yields 0 strips and then divides by
    it. A short piece is charged a whole strip on purpose: nesting is
    SPEC_TRIM_LENGTH_OPTIMIZER.md's job, and quoting the optimistic number here
    would under-quote every short-piece job.

    All of this lives in `lib/pricing/`. Do not put a second copy of the
    formula, the blank-handling, or the version resolution anywhere else.

20. **THE PRICING LEDGER IS APPEND-ONLY, ENFORCED BY POSTGRES.**
    `pricing_ledger` (migration 035) records every estimate, quote and revision,
    every outcome with its reason and time-to-decision, every invoice, every
    price-book change as old value → new value, and every supplier price-change
    notice. It is the dataset dynamic pricing will learn from, so a row is never
    changed or removed once written.

    Two independent refusals, not one: a BEFORE UPDATE OR DELETE trigger that
    RAISES (binding the table owner and the service role, which a REVOKE would
    not), and RLS with **SELECT and INSERT policies only** — no UPDATE policy and
    no DELETE policy exist at all. Do not add one, and do not "simplify" the
    trigger away.

    **The trigger reads `to_jsonb(OLD) ->> 'test_tag'`, not `OLD.test_tag`.**
    PL/pgSQL plans an `IF` condition whole and does NOT short-circuit, so a
    direct column reference fails `42703` on the table that lacks the column,
    turning a refusal into the wrong error. Keep it column-agnostic.

    **The one escape is the reserved `E2E-TEST-` job-name prefix.** A row whose
    `test_tag` is non-null may be DELETED — never updated — and `test_tag` is
    written by exactly one function, `ledgerTestTag()` in
    `lib/pricing/ledger.ts`. A tagged row is excluded from the
    `pricing_ledger_real` view and from the CSV export, so test data can never
    reach the dataset or a spreadsheet. That same prefix also CAPTURES outbound
    email (rule #21). One prefix, three jobs; do not add a second mechanism.

    **Designed for two writers that do not exist yet, and both are documented in
    SCHEMA.md:** the deferred Phase 4 Outlook mail parser (`source='mail_parser'`,
    `external_ref` = the Graph `internetMessageId`, made idempotent by
    `uq_pricing_ledger_external_ref`), and historical spreadsheet / QuickBooks
    imports (`source='import'`, with `import_batch_id` REQUIRED by a CHECK so a
    bad batch is always identifiable — it cannot be deleted, it is superseded).
    The import column list is frozen in SCHEMA.md's PRICING LEDGER IMPORT FORMAT
    and is the same order the CSV export writes. **Money is CENTS in this table,
    everywhere.**

21. **THE QUOTE BECOMES THE INVOICE WITH NO RETYPING, AND THE APPROVE LINK IS
    NOT A FIFTH DOOR.** `lib/invoices/create.ts` COPIES the quote's line items,
    totals and price-book snapshot onto the `invoices` row. Nothing is
    recomputed from the price book — which may have moved since the quote was
    sent — and no human re-enters anything. A recomputed invoice would silently
    bill a different number from the one the customer approved. `invoices` has a
    UNIQUE constraint on `quote_id`, so a double click cannot bill twice.

    `app/api/quote-approve/[token]` — the Approve button in the quote email — is
    signed (HMAC-SHA256), **single-use** (a conditional UPDATE on
    `used_at IS NULL`, so two simultaneous clicks cannot both win) and
    **expiring**. Only the token's HASH is stored. The signature is checked
    BEFORE the expiry, so a forged expiry is never believed.

    **It CREATES the approval record the single-door guard already requires**
    (`job_stage='approved'`, `approval_channel='email'`, `approved_by` = the
    customer's own profile or NULL for a guest) and **deliberately leaves
    `status='submitted'` alone** so the guard's own condition still holds when an
    admin later presses "Send to machine". It imports nothing from
    `lib/integrations/pathfinder-edge.ts` and makes no request to it — enforced
    by the static single-door test, not asserted. Same contract as
    "Customer approved by phone" (rule #14), for the same reason. **Do not add it
    to the allow-list.**

    **OUTBOUND EMAIL TEST MODE IS PER MESSAGE, NEVER A DEPLOYMENT FLAG.**
    `lib/email/outbound.ts` captures a message — writes it to `outbound_emails`
    with `status='captured_test_mode'` and makes NO provider call — when the job's
    name carries the reserved `E2E-TEST-` prefix. A deployment-wide switch was
    rejected because it would silence real customer mail the moment somebody left
    it on. `AFS_EMAIL_TEST_MODE=1` is for local development only and is not set
    in Vercel. Every approved invoice is copied automatically to
    `officeInvoiceEmail()` — **`trica@architecturalflashingsupply.com`**, named
    once in `lib/data/office.ts` and nowhere else. **The spelling is `trica@`,
    with no `i` after the `r`.** An earlier pass (2026-09-30) ruled the opposite
    and rewrote 31 occurrences to `tricia@`; Reid reversed that on 2026-10-01 and
    every occurrence is back. Do not "correct" it again without his say — the
    wrong-looking spelling is the right one.

22. **THE SERVICE-ROLE SUPABASE CLIENT NEVER READS A CACHED ROW.**
    `lib/supabase/admin.ts` passes `cache: 'no-store'` on every request, and must
    keep doing so. Next.js patches global `fetch` and caches GET responses in its
    Data Cache; supabase-js reads with `fetch`, so two identical PostgREST GETs
    inside one route can be served the first one's body and a row that changed in
    between is simply not seen.

    That is not hypothetical — it was diagnosed live on alpha (2026-09-30) when
    the Approve link's EXPIRED case poisoned the cache and the VALID click that
    followed kept being told the link had expired. Every symptom pointed at a
    date-parsing bug and it was not one. The service role exists to read
    authoritative state (has this single-use token been spent, what stage is this
    job at, does an invoice already exist); a cached answer to any of those is a
    wrong answer.

23. **PLACEHOLDER CONTRAST IS DECIDED BY THE SURFACE, NOT BY A TOKEN NAME.**
    Rule #18 names `afs-chrome-silver` as the placeholder colour and that is
    right ON GUNMETAL, where it measures 4.80:1 at worst. On the LIGHT working
    area it measures **1.55:1** on `afs-bg-card` — worse than the 1.94:1 failure
    rule #18 exists to fix, because chrome-silver is a light colour chosen for a
    dark surface. v2-02 had only gunmetal surfaces, so the two readings of the
    rule were the same sentence; they are not any more.

    On a light surface the placeholder is **`afs-ink-700` (10.3:1 on
    `afs-bg-card`)** — an existing text token rather than a near-duplicate, which
    is what rule #18 asks for, and still clearly dimmer than the typed
    `afs-ink-900` at 18.9:1. `lib/design/placeholder-contrast.test.ts` computes
    every one of these ratios from `tailwind.config.js` and asserts BOTH premises
    (the five dim-looking tokens all fail on white; ink-700 passes on all four
    light surfaces), so a retheme cannot make the rule silently vacuous.

24. **A DELIVERY DAY IS A BUSINESS DAY, WORKED OUT IN THE SHOP'S OWN TIME ZONE,
    AND `lib/delivery/business-days.ts` IS THE ONLY PLACE THAT DECIDES IT.**
    Marking a job finished in Shop View auto-schedules its delivery for the NEXT
    BUSINESS DAY. That one sentence has two ways of being implemented wrongly,
    and both live in that one file so both have one test:

    (a) **The weekend.** Friday's next business day is MONDAY — so is Saturday's
    and Sunday's. A naive `+1 day` books a day nobody is driving, and the
    customer finds out by nobody turning up.

    (b) **The time zone.** Vercel runs in UTC; the shop is in Burnet, Texas. A
    job finished at 7pm Central on a Tuesday is already 01:00 UTC Wednesday, so
    "tomorrow" from the raw server clock would be Thursday. Every date is derived
    through `shopDateOnly()` in `SHOP_TIME_ZONE` (`lib/utils/waiting-time.ts`,
    already this codebase's one shop clock), never from raw `Date` parts. This
    bug hides itself: on a Friday the weekend skip lands on Monday either way,
    so it only shows up as a Tuesday-evening finish booked for Thursday.

    Dates are plain `YYYY-MM-DD` strings, matching `deliveries.scheduled_date`'s
    `date` type — a date-only value has no instant and no offset, and keeping it
    a string is what stops one creeping in. **Holidays are deliberately NOT
    modelled:** no holiday calendar has been supplied (see DATA BLOCKERS), and
    inventing one would put a guess in the code. Weekends are a fact; an
    auto-scheduled delivery is always reschedulable by hand from Deliveries.

    **The four windows are `'08-10'`, `'10-12'`, `'13-15'`, `'15-17'` — keys,
    never labels.** The English lives in `lib/delivery/windows.ts` and nowhere
    else, so rewording a window is not a migration and no en dash ever ends up
    inside a database CHECK constraint. `deliveries.shop_job_id` is UNIQUE, so a
    double click cannot book the same work twice; a reschedule is an UPDATE of
    that one row. Full detail: SCHEMA.md's DELIVERIES section and
    ARCHITECTURE.md section 15.

25. **TELLING A CUSTOMER SOMETHING GOES THROUGH THE SERVICES THAT ALREADY EXIST.
    `lib/delivery/notify.ts` IS PLUMBING, NOT A SECOND PATH.** Email through
    `lib/email/outbound.ts`'s `sendTrackedEmail` (which wraps
    `lib/resend/send.ts`, writes `outbound_emails`, and CAPTURES rather than
    sends for a job carrying the reserved `E2E-TEST-` prefix — rule #21), the
    shell and the button from `lib/resend/templates/base.ts`, SMS through
    `lib/twilio/sms.ts` behind the same `phone && sms_opt_in` gate the dispatch
    route and the 10-mile alert use, and the same `notifications` row. Do not add
    a second sender, a second template file, or a second test-mode switch.

    **The tracking link has ONE formula, in `lib/delivery/tracking-url.ts`.** It
    was inlined in three places (`app/api/orders/[id]/dispatch/route.ts`,
    `app/api/driver/location/route.ts`, `lib/utils/shop-job-completion.ts`);
    v2-04 needed a fourth caller and pointed all of them at the shared function
    instead of copying it again. It returns `null` when there is no
    `orders.tracking_token`, and callers must handle that — a V2 Job that never
    became a paid order has nothing to track, and a link to a dead page is worse
    than plainly giving the day and the window.

    **A CAPTURED test message gets NO `notifications` row.** That table's status
    CHECK is `('sent','delivered','failed')`, so the only value a capture could
    take is `failed`, which would be a lie about a message nobody tried to send;
    the capture is recorded in full in `outbound_emails` instead. Found live on
    alpha, not reasoned about — the first checkpoint run wrote exactly that row.
    A tagged job never reaches Twilio either: the rule protecting a customer's
    inbox has to protect their phone too, or the prefix is half a promise.

    **Nothing is reported as sent that was not sent.** Resend is unconfigured on
    this deployment, so the honest answer today is "the message is saved here,
    nothing left the building", and that is the sentence the Deliveries screen
    prints — read back out of `deliveries.notify_note`, which is written from the
    result the notifier returned rather than from having called it.

26. **A LIST VIEW NEVER RETURNS `shop_profile_library.geometry_svg`, AND A
    POLLING SCREEN PAUSES WHEN THE TAB IS HIDDEN.** That column is misnamed: it
    holds a base64 PNG data URI, measured against the live database at
    70KB-786KB per row — about 6MB across the twenty rows that exist. The old
    Shop View board polled all of it every thirty seconds, and kept polling
    while the tablet's screen was off.

    `lib/data/shop-queue.ts` returns `hasDrawing` and each card fetches its own
    image once it scrolls into view, through
    `app/api/admin/shop-queue/drawing/[id]` — the same lazy pattern
    `components/admin/PastProfileThumb.tsx` established for the Job screen and
    `app/api/admin/command-center/profile-thumbnail/[id]` for Search. Reuse that
    pattern rather than writing a third one. `/api/admin/shop-library`'s GET
    still returns the full row including the base64 and is still correct for the
    Profile Library table, which renders one screen on demand — do not point a
    polling surface at it.

    **v2-05 made that lazy loader ONE component.** It had been written twice
    (`PastProfileThumb.tsx`, `ShopJobDrawing.tsx`) and the Search rail would
    have been a third, so it now lives in
    `components/admin/LazyProfileThumb.tsx` and `PastProfileThumb` is a link
    wrapped around it. Its module-level cache is keyed by profile id, which is
    only safe because a saved profile's drawing NEVER changes in place — a
    modification creates a new row (rule #13's lineage). If that ever stops
    being true, the cache is wrong before anything else is.

27. **ONE PROFILE SEARCH: one query, one panel, and Select saves your work
    before it replaces it.** `admin_profile_search` (migration 029, extended in
    038 with a nullable `p_ids uuid[]`) is the ONLY profile query. Recent and
    Pinned reuse it through that argument — do not add a sibling function
    returning the same seventeen columns, and do not let `p_ids` be readable
    from a query string: it is built server-side from the caller's own shortcut
    rows (`buildIdSearchArgs`), never from `buildSearchArgs`.
    `components/admin/ProfileSearchPanel.tsx` is the ONE UI, rendered both at
    **`/admin/search/profiles`** and inside FlashDraft's `?admin=1` drawer; only
    `onSelect` differs.

    **THE ROUTE MOVED IN v7 STAGE D, AND THE RULE IS UNCHANGED.** `/admin/search`
    is now v7's own Search screen (`pageSearch()`), which searches QUOTES AND
    ORDERS — a different question over different tables, built from the Quotes
    and Orders lists' own rows and helpers (`applySearchQuery` in
    `lib/data/quote-order-list.ts`), with NO new SQL function and no second
    profile query. That is exactly what docs/COMMAND_CENTER_V7_GAP_AUDIT.md §4
    said the gap was: "a SEPARATE quote/order query, not a second profile
    function." One profile query, one profile panel, two mount points — only the
    URL of the first changed, and the new Search page links straight to it.

    **The enlarged preview has NO CLOSE BUTTON, and that is why the timing is a
    tested module.** `lib/ui/hover-intent.ts`: 150 ms before it opens (a sweep
    down the rail crosses every thumbnail and must open none of them), 300 ms of
    grace before it closes, and entering the preview CANCELS the close rather
    than restarting it — the preview sits across a gap from the rail and carries
    the Select button, so a pointer must be able to travel onto it. Keyboard and
    touch bypass both delays: an arrow key IS the intent, a tap IS the intent.
    Do not add a close button, do not inline the timers, and remember that
    Escape's refocus must not reopen what Escape just closed.

    **Select AUTO-SAVES unsaved canvas work FIRST, and only loads if that
    succeeded.** A failed save leaves the canvas exactly as it was and says
    "nothing was replaced". The save is the ordinary `performSave`, so the work
    lands in the Passport, and the load is the ordinary `loadForModify`, so the
    picked profile is never overwritten. "Unsaved" is decided by
    `lib/flashdraft/unsaved-work.ts`'s SIGNATURE, never a dirty flag, and never
    `geometryFingerprint` — that hash is orientation-independent by design
    (rule #12's neighbour), so a whole-profile drag would read as no change at
    all. **Every load path must record the signature**; miss one and picking two
    profiles in a row writes an untouched duplicate of the first into the
    Passport. Full contract: ARCHITECTURE.md section 16.

28. **CONTRAST IS A BUILD GATE, NOT A REVIEW STEP — `scripts/audit/contrast-check.mjs`.**
    It runs as `prebuild`, so `pnpm build` runs it and a Vercel deployment cannot
    get past it. It measures every Command Center screen plus the sign-in flow
    (the only way into them) and exits non-zero on any pair below WCAG AA: 4.5:1
    body text and placeholders, 3:1 WCAG-large text and form-field boundaries.

    **Nothing in it is a list anybody maintains.** The screens come from
    `lib/data/admin-nav.ts` plus the `page.tsx` files that really exist under
    those routes; the colours from `tailwind.config.js`; the pairs from walking
    each page's JSX and RECURSING INTO the components it renders, so a colour is
    measured against the surface it is really mounted on. Adding a screen or a
    component puts it under the gate automatically. Do not add a skip list, and
    do not relax a threshold to make a screen pass — fix the colour.

    **`0 unresolved` in its output is load-bearing.** A gradient, a non-colour
    arbitrary value or a className it cannot read is COUNTED and PRINTED, never
    skipped, so the gate cannot pass by failing to look. If a change makes that
    number rise, the gate got blinder, not the code safer.

    Six resolution behaviours are load-bearing and must survive any rewrite,
    each because without it the gate reported a defect that cannot render or
    missed one that can: cross-file `{children}` (and taking the occurrence
    inside JSX, NOT the literal `{ children }` in a destructured parameter list);
    class constants resolved across modules (`LIGHT_WORKING_AREA_CLASS`);
    a ternary's arms measured as alternatives rather than as one mixable set;
    class maps (`TONES[tone]`) expanded to their values; `file:`/`before:`/
    `after:` treated as a nested surface rather than the element's own; and `/90`
    opacity composited over what is behind it.

    **`tests/e2e/contrast-live.spec.ts` is the other half and must be kept.** It
    measures the same screens with `getComputedStyle` in a real browser against
    alpha, which is what stops the static model drifting into fiction. It needs
    `storageState` like every other admin spec — without it the admin routes
    redirect and it measures the sign-in page while reporting Command Center
    route names, which is how the sign-in flow's own failures were found. Full
    contract: ARCHITECTURE.md section 17.3.

29. **A STATUS COLOUR IS NOT A STATUS TEXT COLOUR. On gunmetal the text gets
    LIGHTER, and `afs-*-on-dark` are the four that do.**
    `afs-crimson`, `afs-success`, `afs-warning`, `afs-info` and `afs-amber` are
    FILL colours. As text on gunmetal they measure 1.42:1, 2.11:1, 3.67:1,
    2.34:1 and 4.28:1 — not marginal misses. Rules #18 and #23 are about picking
    the right token for the surface; this is the same mistake one step further
    on, where there IS no darker variant that helps, because on a dark surface
    the fix is lighter rather than darker.

    Use `afs-danger-on-dark`, `afs-success-on-dark`, `afs-warning-on-dark` and
    `afs-info-on-dark`. Each holds its dominant channel at full and lifts the
    others only as far as the required luminance demands, so it still reads as
    red/green/amber/blue while clearing AA on all five gunmetal surfaces. The
    danger colour is a salmon and cannot be anything else: clearing 4.5:1 on
    `afs-bg-overlay` needs a relative luminance near 0.56 and red contributes
    only 0.2126 of it. That is physics, and the alternative to accepting it is
    making those links filled buttons, not finding a better red.

    **They are for text ON DARK only** — on the light working area they measure
    1.3-1.6:1, which is rule #23 applying to them exactly as it does to
    `afs-chrome-silver`. `lib/design/placeholder-contrast.test.ts` asserts all
    three claims (the fill colours fail on gunmetal, the new ones pass there, the
    new ones fail on the white card), so a retheme cannot make the rule vacuous.

30. **EVERY SECTION HAS AN ERROR BOUNDARY, AND IT SAYS WHAT DID NOT HAPPEN.**
    `app/global-error.tsx` catches a failure in the root layout itself and must
    supply its own `<html>`/`<body>` (a framework requirement, and why its
    colours are a documented literal constant under rule #4's CANVAS_COLORS
    exception). `app/error.tsx` and one `error.tsx` per section catch everything
    else, and all of them render `components/ui/ErrorScreen.tsx` so the wording
    rule lives in one file. `components/ui/PanelErrorBoundary.tsx` contains a
    failure to ONE panel — it wraps each of the Job screen's three columns, so a
    throw in the profile drawing cannot take the Send quote button with it.

    The wording rule: never blame the user, never show a stack trace, and always
    say what did NOT happen — "nothing was sent to the machine", "you have not
    been charged", "your drawing is still saved on this computer". On a platform
    where the next button along reaches a physical bending machine, that sentence
    is the message.

31. **A WebGL FAILURE DEGRADES TO THE 2D VIEW. `ProfileViewer3D` NEVER LEAVES AN
    EMPTY PANEL.** `new THREE.WebGLRenderer()` throws when a browser refuses a
    context — a blacklisted GPU driver on a shop tablet, a kiosk browser, a
    remote-desktop session, too many live contexts on one page. The throw is
    caught and `components/studio/ProfileCrossSection2D.tsx` renders instead.

    That fallback calls `buildCrossSectionPoints`, `formatBendAngleLabel` and
    `formatInches` — the exact three functions the 3D viewer calls — so it cannot
    disagree with the 3D view about the shape, about a bend's sign (rule #12), or
    about how a length is written. Its props are MILLIMETRES, like
    `ProfileViewer3D`'s, converted at the same point. Do not give it its own
    geometry, and do not "unify" it with `BendSequenceDiagram`, which hardcodes a
    mm pixel scale, prints no leg lengths and is painted for a gunmetal card.

    `tests/e2e/webgl-fallback.spec.ts` proves it by making `getContext` return
    null for the three WebGL context ids — a real refusal, not a test-only flag.
    Keep it that way: a fallback reachable only through a test hook is a fallback
    nobody has proved.

32. **THE VENDOR API GETS A TIMEOUT ON READS AND A PARSER ON EVERY RESPONSE —
    AND THE POST GETS NEITHER TIMEOUT NOR RETRY.**
    `PATHFINDER_READ_TIMEOUT_MS` is 8000, chosen from the 2.46s a live probe
    actually measured, and applied by `pathfinderRead()` through an
    `AbortController`. Before it, a host that accepted the connection and said
    nothing left a Command Center screen rendering forever.

    **The POST to `/api/v1/profiles` deliberately has no timeout.** Aborting a
    write tells you nothing about whether the server committed it, and an
    abandoned-but-committed profile in catalog 20115 is one the physical Thalmann
    will collect that this app has no record of. **And no read is retried:** the
    one where a retry is most tempting is the profile-number lookup after a push,
    where a retry would duplicate a real profile — rule #16's `unconfirmed` is
    the correct answer there, not persistence.

    `lib/integrations/pathfinder-response.ts` parses every response instead of
    casting it. `(await res.json()) as T[]` asserts nothing at runtime, so an
    envelope, a renamed field or a 200 carrying an error object all reached a
    component as a crash or as a row rendered "undefined".
    `logVendorShapeProblem()` writes ONE server line with the endpoint, every
    problem and a truncated copy of the real body — the truncation is what makes
    it diagnosable. A 200 with a wrong body is reported as an error, never as
    "Connected". Do not add a schema library for two documented shapes, and do
    not let a parser throw: a bad shape is a degraded read, not a 500.

33. **THE COMMAND CENTER UI IS A PORT OF `docs/design/command-center-v7`.
    NEVER BUILD OR RESTYLE A COMMAND CENTER SCREEN FROM MEMORY. RUN THE v7
    STYLE GATE BEFORE FINISHING ANY UI WORK.**

    The canonical source is
    `docs/design/command-center-v7/AFS_Command_Center_Prototype_v7.html`
    (sha256 `37f9c4d6…112a63`), committed so the design cannot drift away from
    the repo. v7 WINS every conflict about appearance, layout, spacing, copy,
    colour, font, label and interaction. Existing code wins only where it
    supplies real data or API behaviour that v7 only fakes — keep that
    behaviour, present it in v7's look.

    **The CSS is DERIVED, not retyped.** `scripts/design/scope-v7-css.mjs`
    (`pnpm css:v7`, chained into `prebuild`) reads the prototype's own CSS and
    emits `app/styles/command-center-v7.generated.css` with every selector
    scoped to `.cc-v7`, which only `AdminShell` sets. Editing the generated file
    or hand-porting a rule is how the look drifts; change the prototype or the
    deviations file and regenerate. `lib/design/v7-css.test.ts` regenerates and
    compares, so a stale output fails the suite rather than shipping.

    **v7 IS LIGHT, AND THAT DEPENDS ON BLOCK ORDER.** The prototype has FOUR
    `<style>` blocks. Block 1 declares a DARK theme and says so ("One committed
    dark theme", `--bg:#343D49`). Block 3 REDECLARES `:root` with the light
    palette (`--bg:#F4F5F7`, `--hdr:#14181E`, `--red:#C8102E`) and wins. Reading
    only block 1 yields a dark Command Center and is exactly the mistake that
    produced earlier wrong-looking builds — v7's labels on the old app's look.
    The result is a LIGHT working area, a DARK header, and ONE red action
    colour. `lib/design/v7-css.test.ts` asserts the order and the resolved
    tokens, so the cascade cannot silently invert.

    **The ground is opt-in, per rule #18.** The transform splits v7's `body`
    rule: typography goes on `.cc-v7` (safe everywhere), paint goes on
    `.cc-v7-ground`. Painting the ground for the whole admin tree at once turned
    the contrast gate red with 46 real failures — `afs-chrome-high` and the four
    `*-on-dark` tokens at 1.09:1–1.69:1 on `#F4F5F7` — because twenty screens
    still set light-on-dark text. Screens convert one at a time and the PAGE
    opts in.

    **THE STYLE GATE IS NO LONGER THE ACCEPTANCE TEST — SEE RULE #34.** It
    passed 66 of 66 while the owner's report was "nothing matches", because it
    compares hand-picked pairs on hand-picked properties and every one of them
    really did match. The authority is now the WHOLE-SCREEN pixel diff,
    `tests/visual/v7-pixel-gate.spec.ts`. Everything below still applies and the
    style gate still runs — it remains the better tool for saying *why* two
    screens differ once the diff says they do, and the stage-coverage rule is
    still how a screen is stopped from passing by omission.

    `tests/visual/v7-style-gate.spec.ts` opens the prototype and the live app in
    one browser and compares the COMPUTED styles of every pair in
    `tests/visual/v7-component-map.ts` — family, size, weight, line-height,
    letter-spacing, transform, colour, background, border, radius, shadow,
    padding, gap, height. Lengths match within 1px; everything else exactly,
    unless the pair is a documented deviation. **Every v7 component a stage
    builds must be added to that map in the same commit** — `EXPECTED_STAGE_COVERAGE`
    fails the run if a stage ships components it never mapped, so a screen
    cannot pass by omission. An unmeasurable pair is reported UNCOVERED and
    fails, on the same principle as rule #28's `0 unresolved`.

    Two comparison rules are deliberate and must survive any rewrite, because
    without them the gate reports differences that cannot be seen and would end
    up skip-listed into uselessness: a border's style and colour are compared
    only on an edge whose WIDTH is non-zero (Tailwind's Preflight sets
    `border-style:solid;border-color:#e5e7eb` at width 0 on every element), and
    `color` is compared only on an element with a direct text node (the app's
    `<body>` and v7's set different inherited colours, which containers never
    render).

    **THREE PORT LAYERS SIT ON TOP OF THE VERBATIM CSS, and each has a stated
    bar.** v7 is a standalone page and this app is not, so a verbatim port alone
    renders differently for reasons that are nobody's design decision:
    `v7-fonts.css` binds v7's two families to the self-hosted next/font copies;
    `v7-preflight-reset.css` cancels Tailwind Preflight rules v7 has no
    counterpart for (it sets `letter-spacing: inherit` on form controls; v7's
    reset sets only `font: inherit`, and that shorthand does not carry
    letter-spacing); and `v7-real-data.css` handles cases v7's SAMPLE DATA
    cannot produce — a guest email used as a customer name is one 41-character
    token that overflows a list cell, and "Bending now" breaks inside a
    fixed-height pill once real material text narrows its column. The bar for
    `v7-real-data.css` is explicit in the file: v7's data must be INCAPABLE of
    showing the problem, and the fix must be a rule v7 already applies
    somewhere else. Anything else is a restyle, not a port.

    **CONVERTING A PAGE IS HALF A CONVERSION.** Moving a screen into the light
    working area leaves its CHILD components painting light-on-dark text, and
    the contrast gate fails on them at around 1.1-1.7:1 — rule #29, which has no
    darkening fix because on a light surface the fix runs the other way. Convert
    the children in the same commit, and point form fields at v7's own `.f`
    rather than a Tailwind border: `afs-line-strong` on `afs-bg-light-raised` is
    2.70:1 against a 3:1 boundary rule.

    **THE STYLE GATE REPORTS FOUR OUTCOMES, AND ONLY ONE OF THEM PASSES.**
    `pass`; `fail`; `uncovered` (a mapped pair that could not be measured —
    fails, because a gate must not pass by failing to look); `live-only` (the
    component has no counterpart in v7's rendered state, e.g. its seed fills
    every lane so its empty-lane message never renders — the LIVE element is
    still asserted to exist); and `no-data` (the component is built but this
    environment has no row to render it, e.g. an empty delivery week — the
    PROTOTYPE side must still match, so it cannot wave through something that
    was never built). The last two are printed and counted, never silent.

    **WHAT THE GATE CANNOT SEE, so look at the screenshots.** It compares a
    component against its counterpart, not that component's children. Giving an
    element v7's class while leaving its old flat children underneath renders
    inline text running together with buttons overlapping it, and every compared
    property still matches. That is a real defect this gate passed and a
    screenshot caught, which is why `test-results/v7-fidelity/` is part of the
    run and not decoration.

    **COLOUR DEVIATIONS ARE THE ONE LOOPHOLE AND THEY ARE MEASURED.** Where a v7
    colour fails the WCAG build gate (rule #28), change ONLY that colour, to the
    nearest passing shade in the same hue family, apply it in
    `v7-deviations.css` (never by editing the verbatim `v7.css`), and record it
    in `docs/design/V7_COLOR_DEVIATIONS.md`. **Never relax a gate threshold.**
    `lib/design/v7-deviations.test.ts` recomputes every ratio from the real CSS
    and asserts each deviation is still NECESSARY (v7's value really fails),
    SUFFICIENT (the replacement really passes) and IN HUE (channel ratios within
    5%) — so a deviation cannot be added to silence the gate, and one that stops
    being needed fails rather than lingering as a permanent excuse. There is
    exactly ONE today: `#1E8E52` → `#1D874E`, because white text on v7's green
    measures 4.16:1 against a 4.5:1 requirement.

34. **THE WHOLE-SCREEN PIXEL GATE IS THE FIDELITY AUTHORITY. THE STYLE GATE IS
    SECONDARY. NEVER CALL A SCREEN MATCHING WITHOUT A MEASURED PASS.**

    `tests/visual/v7-pixel-gate.spec.ts` renders the untouched prototype and the
    live app at 1440x900, full page, clock and random source frozen, animations
    off, fonts loaded, and diffs them WHOLE. Pass is at most **1.5% of pixels**
    per screen. The screens are every entry in
    `docs/design/command-center-v7/SCREEN_MANIFEST.json` — all 54 distinct v7
    states, read out of the prototype's own `render()` dispatcher, every page
    function and every `modalHTML()` branch.

    **WHY IT REPLACED THE 66-PAIR STYLE GATE AS THE AUTHORITY.** The owner's
    report was "nothing matches" while that gate passed 66 of 66. Both were
    true. A gate that compares hand-picked element pairs on hand-picked
    properties cannot see a missing profile drawing, an absent pill, a rail with
    two panels where v7 has three, a header logo at the wrong aspect ratio, or a
    screen that is simply a different screen — because every property it was
    pointed at really did match. **A gate that only looks where it is pointed
    cannot find what nobody pointed it at.** Keep the style gate running: it is
    still the better tool for saying *why* two screens differ once the diff says
    they do. It is no longer what decides whether they do.

    **SIX THINGS IN THE HARNESS ARE LOAD-BEARING AND MUST SURVIVE ANY REWRITE**,
    each because without it the gate could pass while the screen does not match:

    (a) **A SIZE MISMATCH COUNTS AS DIFFERENCE.** Both captures are composited
    onto a canvas of the UNION size over a sentinel magenta. Cropping to the
    intersection would let a page that renders half of v7's content score well,
    because the missing half would be outside the compared area.

    (b) **FIVE OUTCOMES, AND ONLY ONE PASSES** — `pass`, `fail`, `missing` (a v7
    state with NO live route: named in the report, never waved through),
    `live-only`, and `error` (a side that could not be reached — fails, on the
    same principle as rule #28's `0 unresolved`).

    (c) **THE MANIFEST AND THE DRIVERS ARE FORCED TO AGREE**, in both
    directions, by `assertDriversMatchManifest`. A state added to one and not
    the other fails the run rather than being silently skipped.

    (d) **THE BASELINE COMES ONLY FROM THE UNTOUCHED PROTOTYPE**, re-rendered
    every run. There is no "update baselines" mode and must never be one: a
    baseline here is not an expectation that can drift, it is a render of a
    committed file.

    (e) **ONLY v7's OWN REVIEW BANNER IS REMOVED FROM A BASELINE** — `.proto`,
    `#gpeek`, `#toast`, identified by their own class and ids. `.proto` is a
    static block that offsets the whole document, which would put every screen
    past any possible budget; removing it can only make the prototype side MORE
    like a shipped page, so it cannot hide a difference in the port.

    (f) **MASKS ARE FOR GENUINELY DYNAMIC TEXT ONLY**, each with a written
    justification, 2% of the screen in total, and all of them printed in the
    report. `SCREEN_MASKS` is EMPTY today and that is the target state. "This
    bit does not match yet" is not a justification, it is the finding.

    **DO NOT LOOSEN THE THRESHOLD, WIDEN A MASK, OR EDIT A BASELINE TO MAKE A
    SCREEN PASS.** Fix the screen. The 1.5% budget was never raised during the
    run that built this and every one of the 35 reachable screens came in under
    0.8% but one.

    **FIXTURE MODE IS WHAT MAKES THE NUMBER MEAN ANYTHING.** `lib/fixtures/mode.ts`
    requires THREE locks — `CC_FIXTURE=1`, a non-production build, AND
    `?fixture=v7` on the URL — and `lib/fixtures/mode.test.ts` asserts each
    independently, including the one combination that could happen by accident.
    It substitutes DATA ONLY and never touches authentication. Without it the
    diff would be measuring the database against a demo, every screen would
    differ for reasons that are nobody's design decision, and the only way to
    make it pass would be to raise the threshold until it asserted nothing —
    which is exactly how the previous gate ended up green on screens the owner
    says do not match.

    **THE SECOND GATE SAYS WHAT IS WRONG IN WORDS.** Alongside the diff, the
    harness compares the ordered sequence of visible landmarks and reports what
    is missing, extra or out of order. It matches v7's clickable widgets BY
    CLASS (`.dtab`, `.ci`, `.si`, `.opt`, `.tab`, `.hsr`, `.hsall`, `.nqb`,
    `.linkcell`) rather than by element, because v7 is one self-rendering page
    where every widget is a `<button>` and the port is a routed app where the
    same widget is often an `<a>`. Measuring the widget on BOTH sides is the
    honest fix; dropping it from the selector would have been the dishonest one.

    **AND LOOK AT THE SIDE-BY-SIDE.** `test-results/v7-pixel/<id>-side-by-side.png`
    is part of the run, not decoration. Three of the seven defects this gate
    found were found by LOOKING at it, not by reading the number — including a
    header logo at the wrong aspect ratio that had every element right of the
    brand 35px off on every screen in the app.

    Full detail, including every deliberate divergence and every honest empty
    state: `docs/design/V7_PIXEL_REPORT.md`. The behaviour mapping, v7 function
    to React handler: `docs/design/command-center-v7/BEHAVIOR_MAP.md`.

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

Quotes, invoices and the Approve link (v2-03) — ALL THREE OPTIONAL, all three
with a safe default, so the quote -> approve -> invoice path works on a fresh
deployment with none of them set. Full notes in .env.example:
  QUOTE_APPROVE_SECRET            Signs the single-use Approve link. Unset =
                                   a SEPARATE key derived from
                                   SUPABASE_SERVICE_ROLE_KEY by HMAC with a
                                   fixed label. Set it to rotate every
                                   outstanding link at once.
  INVOICE_OFFICE_EMAIL            Where every approved invoice is copied.
                                   Defaults to Tricia's real address.
  AFS_EMAIL_TEST_MODE             LOCAL DEV ONLY. Not set in Vercel — see
                                   rule #21.

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
