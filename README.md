# AFS — Architectural Flashing Supply

**The developer README. Read this first, then `CLAUDE.md`.**

**Last verified against commit: `22223bb56f0b928f4df6ba91b2e0cb49c0c825bd` on 2026-10-02.**

Every factual claim below was read out of a file in this repository during the
session that wrote it, and the file is named. Anything that could not be
verified from a file in this worktree is marked **UNVERIFIED** — there are 15
such markers, and they are listed in one place in
[§14 Keeping this README current](#14-keeping-this-readme-current).

**This file contains no secret values.** Environment variables appear by NAME
only, with what each one is for and which file reads it. Never paste a key,
token, password, connection string or signed URL into this file.

---

## Table of contents

1. [What AFS is](#1-what-afs-is)
2. [Status snapshot](#2-status-snapshot)
3. [Tech stack with versions](#3-tech-stack-with-versions)
4. [Quick start on Windows](#4-quick-start-on-windows)
5. [Architecture overview](#5-architecture-overview)
6. [Core domain concepts and the data flow](#6-core-domain-concepts-and-the-data-flow)
7. [Database](#7-database)
8. [Integrations](#8-integrations)
9. [Testing](#9-testing)
10. [Deploying](#10-deploying)
11. [Governance and conventions](#11-governance-and-conventions)
12. [Known issues and open decisions](#12-known-issues-and-open-decisions)
13. [Handoff checklist for a new developer or buyer](#13-handoff-checklist-for-a-new-developer-or-buyer)
14. [Keeping this README current](#14-keeping-this-readme-current)

---

## 1. What AFS is

### The business

Architectural Flashing Supply (AFS) is a specialty sheet metal fabricator.
Every piece they make is custom: coping caps, base flashing, counter flashing,
step flashing, drip edge, gravel stop and expansion joints, fabricated from
copper, aluminum, galvanized steel, stainless and Galvalume. The shop is in
Burnet, Texas — the shop clock and the delivery calendar are both computed in
the shop's own time zone (`SHOP_TIME_ZONE` in `lib/utils/waiting-time.ts`,
used by `lib/delivery/business-days.ts`).

Source: `CLAUDE.md` ("WHAT THIS PROJECT IS"), `PRD.md` ("EXECUTIVE SUMMARY").

### The one business rule that shapes everything

**This is a Request-for-Quote (RFQ) platform, not an e-commerce store.**
Customers never see a price on the website. They submit drawings, configure a
profile or describe what they need; AFS prices it internally and delivers a
formal quote to the customer's portal; the customer approves, and only then
pays. The only dollar amounts a customer ever sees are on an AFS-generated
quote or invoice in their own account.

Any feature that would display a price, an estimate or a dollar amount to a
customer before that formal quote exists is wrong and must not be built. This
is `CLAUDE.md` rule #1, and it is the first thing to check when reviewing any
customer-facing change.

### Who uses the site

`PRD.md` defines four personas:

| Persona | What they come for |
|---|---|
| **Roofing contractor** | Accurate quotes fast; live order tracking so crews are scheduled against real delivery dates; digital records for job costing. |
| **Architect / specifier** | CSI Division 07 spec language, AutoCAD fabrication details, Revit families, finish palettes, material data sheets — enough to write AFS into a project specification. |
| **Project manager / general contractor** | Order tracking, delivery scheduling to the day, team access, project organization. |
| **AFS estimator (internal)** | Structured quote requests arriving pre-organized; a price book and commodity data to quote from; formal quotes out in minutes. |

"Builders and developers" are served by the contractor and PM surfaces; they
are not separate personas in `PRD.md`.

### The four platform pillars

From `CLAUDE.md`:

1. **Quote without calling** — upload blueprints or draw the profile; AFS
   receives a complete structured specification.
2. **The architect's platform** — spec sections, CAD/BIM, finishes, material
   data.
3. **Full visibility, every order** — fabrication queue through delivery, in
   real time, with pre-ship photos.
4. **Internal pricing intelligence** — a commodity-indexed pricing engine for
   AFS estimators. Customers never see this layer.

---

## 2. Status snapshot

Status vocabulary is the project's own, defined at the top of
`STATE_OF_THE_BUILD.md` and in `CURRENT_STATE.md`:

- **DONE** — automated gates passed **and** Reid independently confirmed the
  behaviour himself.
- **IMPLEMENTED, UNCONFIRMED** — code compiles, builds, and a session verified
  it live, but Reid has not looked at it.
- **BLOCKED** — an external dependency, no further code work possible.
- **NOT STARTED**.

A session's own Playwright pass or screenshot is *evidence to bring to Reid*,
never a substitute for his confirmation. That rule is stated at the top of both
`STATE_OF_THE_BUILD.md` and `SESSION_STATE.md`, and it exists because this
project has a documented history of "verified" fixes later found broken.

### Branches

Read from `git branch -vv` and `git log` in this worktree at the commit above.

| Branch | Head | What it is |
|---|---|---|
| `main` | `256eca1` | The deployed trunk. `main` auto-deploys to the canonical Vercel environment (`CLAUDE.md` rule #9). |
| `command-center-v7` | `22223bb` | **In progress.** The Command Center v7 port. Cut from `main` at `256eca1`. Phase 0 and Phase 2 are committed; Phases 1 and 3–6 are not. |
| `products-page` | `20f1f02` | Three commits ahead of `main`: the /products rebuild from the reviewed manifest (35 products, 17 designable), plus "Fix the cut-off 3D view, light the canvas, fix Dimensions Off, add 9 schematic previews". Not merged. |
| `products-manifest` | `7154c14` | One commit ahead of `main`; `products-page`'s ancestor. |
| `feat/command-center-redesign` | `ad905c6` | Superseded by the v2/v7 work. |
| `feat/homepage-redesign` | `45c3c43` | FlashDraft remedial cleanup, Phase 1. |
| `feat/field-app-spec` | `89edb74` | Local only — no `origin` tracking branch. |
| `fix/pathfinder-spec-encoding` | `e87008f` | Local is 1 ahead of `origin`. PathfinderEdge F-02 spec encoding. |
| `docs/readme` | this commit | This README. |

Remote: `https://github.com/architectural-flashing-supply/afs-platform.git`
(`origin/HEAD` → `origin/main`).

### In progress — the Command Center v7 port

`docs/COMMAND_CENTER_V7_GAP_AUDIT.md` (2026-10-01) audits the v7 HTML prototype
against the live app in ten items and lays out a six-phase build plan.
`STATE_OF_THE_BUILD.md`'s 2026-10-01 entry records what has actually shipped.

| v7 item | Status, per the audit |
|---|---|
| 1. Header nav, "+ New quote", type-ahead search | **BUILT** (Phase 2) |
| 2. Separate Quotes and Orders lists | **BUILT** (Phase 2) |
| 3. New quote page, customer-first | **MISSING** (Phase 3) |
| 4. Search over past quotes and orders | **PARTIAL** — `/admin/search` still searches profiles only |
| 5. Deliveries split view + tracking map | **PARTIAL** — list built, no map (Phase 6) |
| 6. Estimate emailed to the office when a quote is sent | **MISSING** (Phase 1) |
| 7. Invoice on shop-finish + reconciliation | **DIFFERENT** — invoice is created at customer approval, not shop-finish; reconciliation missing |
| 8. Change order before the machine | **MISSING** (Phase 4) |
| 9. Addendum after the job started | **MISSING** (Phase 5) |
| 10. Workbench cards, flag pills, stage panes, light theme | **PARTIAL** — one flag pill (`RUSH`) of several |

Phase 0 (2026-10-01) reverted the office email address across 31 occurrences in
19 files — see [§11](#the-office-email-rule-trica-is-correct). Phase 2 shipped
the seven-item nav (`lib/data/admin-nav.ts`), the red "+ New quote" button
(`components/layout/AdminTopBar.tsx`), the type-ahead
(`app/api/admin/command-center/typeahead/route.ts` over
`lib/data/header-typeahead.ts`), and both office lists over one shared
`components/admin/QuoteOrderList.tsx`. Putting Orders and Pricing in the nav
pulled two screens under the prebuild contrast gate for the first time and
exposed **9 pre-existing contrast failures**, all fixed at the colour. Final
gate reading in that entry: 22 screens, 465 pairs, 0 unresolved, 0 below.

**Status: IMPLEMENTED, UNCONFIRMED.** Gates pass; Reid has not confirmed the
screens himself.

### On hold — Products 3D previews

`SESSION_STATE.md`'s current handoff lists **"The Products page track, blocked
on the product catalog data"** under "STILL OPEN". The work itself sits on the
unmerged `products-page` branch, whose head commit is "Fix the cut-off 3D view,
light the canvas, fix Dimensions Off, add 9 schematic previews".

**UNVERIFIED (1):** the specific framing "Products 3D previews are on hold" is
not recorded in any governance file in this worktree. What *is* recorded is
that the Products track is blocked on product catalog data
(`SESSION_STATE.md`), and that the work exists unmerged on `products-page`
(`git log`). Treat the 3D previews as unmerged-and-waiting-on-catalog-data
rather than as a separate decision.

### Blocked — Microsoft 365 / Microsoft Graph

`docs/COMMAND_CENTER_V7_GAP_AUDIT.md` §(c), headed **"BLOCKED ON MICROSOFT
(tenant separation, 2026-10-02)"**, and `docs/COMMAND_CENTER_V2_SPEC.md` §2.4.

- There is **no Microsoft Graph code in the repo at all**. The V2 spec records
  the grep (`graph.microsoft|microsoftonline|Mail.Read|msal` over `app` and
  `lib`) returning zero files. Confirmed again in this session: no
  `MS_GRAPH_*` env var is read anywhere in `app/`, `lib/`, `components/`.
- Exactly **one** v7 feature depends on it: the Workbench "Email inbox" rail
  ("Connected to Outlook · read 20 sec ago", Check now, per-message
  Draft-quote / Apply / Log-it actions), plus the header's "N new emails"
  counter that reads from the same rail.
- The prerequisites are Reid's to do once: a Microsoft Entra ID app
  registration, a redirect URI, delegated Graph mail permissions, admin
  consent, and a client secret stored as `MS_GRAPH_CLIENT_ID`,
  `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_TENANT_ID` in Vercel
  (`docs/COMMAND_CENTER_V2_SPEC.md` §2.4, steps 1–7). None of those variables
  exist in `.env.example` yet.
- Spec Phase 4 (Outlook send, the Approve-by-email path through Graph, and the
  inbound mail parser) is **DEFERRED** until consent is granted; nothing in it
  can be verified end to end before then.
- **Nothing else waits on Microsoft.** v7 items 6–9 all send through Resend,
  which is already wired. None of the six v7 phases touches Graph.

### Other open tracks (from `SESSION_STATE.md`'s current handoff)

- **The Bid Monitor decision** — the screen is live; whether chasing public
  bids is work AFS wants is a product call.
- **Steve's historical pricing** has not been loaded into the append-only
  ledger. The import format is frozen in `SCHEMA.md` and `import_batch_id` is
  required by a CHECK, so a bad batch is always identifiable.

### Per-subsystem snapshot

`CURRENT_STATE.md` is the per-subsystem "what's actually true" file. **It is
dated 2026-09-05 and is partly stale** — for example it refers to
`/admin/building-codes`, which no longer exists as an admin route (migration
033 moved building codes to the public Resources menu, and the page is now
`app/(public)/resources/building-codes/page.tsx`). Read it with
`STATE_OF_THE_BUILD.md`'s newer entries beside it. Its own headline statuses:
HailView, FlashDraft, the job-identity/finish/colour system, the admin portal,
Shop View, the homepage, auth, the building-code directory and the PWA/field
apps are all **IMPLEMENTED, UNCONFIRMED**; Bid Documents is **DONE**;
PathfinderEdge is a real live integration with the bend-angle verification
matrix **OPEN/PARKED**.

---

## 3. Tech stack with versions

Versions are the declared ranges in `package.json` at this commit. The resolved
versions live in `pnpm-lock.yaml` (lockfile version 9.0).

### Runtime dependencies

| Package | Declared | What it is for |
|---|---|---|
| `next` | `14.2.5` | Next.js App Router. Pinned exactly, not a range. |
| `react`, `react-dom` | `^18` | UI. |
| `@supabase/supabase-js` | `^2.110.2` | Database, Auth, Storage, Realtime client. |
| `@supabase/ssr` | `^0.12.0` | Cookie-based session handling for App Router + middleware. |
| `@anthropic-ai/sdk` | `^0.111.0` | Claude API, server-side only. Model `claude-sonnet-4-6` (`lib/anthropic/spec.ts:131`, `app/api/takeoff/route.ts:288`, `app/api/chat/route.ts:279`). |
| `stripe` | `^17.7.0` | Server-side Stripe. |
| `@stripe/stripe-js` | `^4.10.0` | Browser Stripe. |
| `@stripe/react-stripe-js` | `^2.9.0` | Stripe Elements. |
| `three` | `^0.185.1` | The FlashDraft 3D profile viewer. |
| `leaflet` | `^1.9.4` | Maps. |
| `react-leaflet` | `^4.2.1` | Leaflet bindings — the homepage delivery-area map. |
| `@vis.gl/react-google-maps` | `^1.5.2` | Google Maps React components (delivery tracking map). |
| `pdf-lib` | `^1.17.1` | Quote / invoice / profile / bid-document PDFs. |
| `docx` | `^9.7.1` | `.docx` generation (spec writer export, `scripts/md-to-docx.mjs`). |
| `qrcode` | `^1.5.4` | QR codes. |

### Dev dependencies

| Package | Declared | What it is for |
|---|---|---|
| `typescript` | `^5` | Strict mode, `noEmit`, zero `any` (`tsconfig.json`, `CLAUDE.md` rule #3). |
| `tailwindcss` | `^3.4.17` | Styling. `afs-*` tokens only (`tailwind.config.js`, rule #4). |
| `postcss` | `^8.5.16` | With `autoprefixer` `^10.5.2`. |
| `@playwright/test` | `^1.48.0` | End-to-end tests. |
| `vitest` | `^5.0.0` | Unit tests over `lib/**/*.test.ts`. |
| `tsx` | `^4.23.0` | Running the one-off TypeScript scripts in `scripts/`. |
| `mdb-reader` | `^3.2.0` | Legacy Access-database reader — a dev-time tool from the (now removed) machine-library import. |
| `ws` | `^8.21.0` | WebSocket, dev tooling. |
| Types | `@types/node ^20`, `@types/react ^18`, `@types/react-dom ^18`, `@types/three ^0.185.1`, `@types/leaflet ^1.9.22`, `@types/google.maps ^3.58.1`, `@types/qrcode ^1.5.6`, `@types/ws ^8.18.1` | |

### Infrastructure and services

| Service | Role | Where it is configured |
|---|---|---|
| **Vercel** | Hosting and deployment. `main` auto-deploys. | `vercel.json` (framework `nextjs`, `pnpm` build/install/dev commands), `.vercelignore` |
| **Supabase** | PostgreSQL + RLS + Auth + Realtime + Storage | `lib/supabase/{client,server,admin}.ts`, `supabase/migrations/` |
| **Resend** | Transactional email | `lib/resend/`, `lib/email/outbound.ts` |
| **Stripe** | Card and ACH payments | `app/api/checkout/`, `app/api/webhooks/stripe/` |
| **Twilio** | SMS (delivery and production alerts) | `lib/twilio/sms.ts` |
| **Google Maps** | Address autocomplete, delivery tracking map, server-side geocoding | `components/track/DeliveryTrackingMap.tsx`, `lib/utils/geocode.ts` |
| **Anthropic Claude** | AI takeoff, spec writer, chatbot, recommendations | `lib/anthropic/`, `app/api/takeoff/`, `app/api/chat/`, `app/api/spec/` |
| **PathfinderEdge** | The live vendor API that feeds the Thalmann DS2801 bender | `lib/integrations/pathfinder-edge.ts` |
| **Open-Meteo** | HailView wind data (commercial plan required for wind) | `lib/hailview/wind.ts` |
| **SAM.gov** | Federal procurement bid discovery | `lib/bid-monitor/sources/sam-gov.ts` |
| **pnpm** | Package manager. **Never npm, never yarn** (rule #2). | `vercel.json`, `CLAUDE.md` |

**No `packageManager` field, no `engines` field, no `.nvmrc`, no `.npmrc`.**
**UNVERIFIED (2):** the required Node and pnpm versions are not pinned anywhere
in the repo. Node 20.20.2 and pnpm's lockfile v9 (i.e. pnpm 9+) were what this
session observed working; treat Node 20 LTS + pnpm 9 as the working baseline,
not as a documented requirement.

---

## 4. Quick start on Windows

### Prerequisites

- **Node.js 20 LTS** — see the UNVERIFIED note above.
- **pnpm 9+** (`npm install -g pnpm`). Nothing in this project uses npm or yarn
  for dependencies.
- **Git**.
- Optional: the **Supabase CLI**, if you want `supabase db push` instead of
  pasting SQL into the dashboard (`supabase/README.md` Option B).
- Optional: the **Vercel CLI**, for `deploy.ps1` and `vercel link`.
- Access to the AFS **Supabase** project and **Vercel** project, plus whichever
  third-party keys you need (see [§8](#8-integrations)).

### Clone and install

```powershell
git clone https://github.com/architectural-flashing-supply/afs-platform.git afs-website
cd afs-website
pnpm install
```

### Environment setup

Copy the template and fill it in. **`.env.local` is never committed.**

```powershell
Copy-Item .env.example .env.local
```

The three variables you cannot run without:

| Name | Where to get it | Read by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | `lib/supabase/*`, `middleware.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | same — **server-only, bypasses RLS, never put it in a `NEXT_PUBLIC_` name** | `lib/supabase/admin.ts`, `middleware.ts` |

Everything else degrades honestly when unset: Stripe checkout, Resend email,
Twilio SMS, Google Maps, the pricing engine's commodity feed and PathfinderEdge
each report "not configured" rather than crashing. `/admin/settings`
(`app/admin/settings/page.tsx`) renders a live per-integration configured/not-
configured panel derived straight from `process.env`, which is the fastest way
to see what your local environment is actually missing.

The full list of names, with what each is for, is in
[§8 Integrations](#8-integrations) and in `.env.example` itself.

### Run the dev server

```powershell
pnpm dev          # http://localhost:3000
```

### Ports

- **3000** — `next dev` and `next start`, and `playwright.config.ts`'s default
  `baseURL` (`http://localhost:3000`, overridable with `PLAYWRIGHT_BASE_URL`).
- **3001** — not configured anywhere. Next.js falls back to it automatically
  when 3000 is already held. This has bitten this project twice: the HEAD
  commit message and `SESSION_STATE.md` both record a leftover `next start`
  holding 3000 and serving a **stale build**, which sent a developer to 3001
  and produced symptoms that looked like app bugs. If something behaves
  impossibly, check which port you are on and whether a stale server owns 3000.

Other commands:

```powershell
pnpm build        # runs the prebuild contrast gate, then next build
pnpm start        # serve the production build
pnpm lint         # next lint
pnpm tsc --noEmit # must be 0 errors (rule #3)
```

### Signing in locally

Auth is Supabase Auth: email + password, or magic link. Both entry points are
`app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx`; the OAuth/magic
callback is `app/auth/callback/route.ts`.

Create an account through `/register` against whichever Supabase project your
`.env.local` points at. There are **no credentials in this repository and none
in this README** — `tests/e2e/README.md` makes the same point about the test
account, and `tests/e2e/auth.setup.ts` reads `E2E_TEST_EMAIL` /
`E2E_TEST_PASSWORD` from the environment rather than hardcoding a login.

For magic link and password reset to redirect back to `http://localhost:3000`,
that origin must be in Supabase → Authentication → URL Configuration →
Redirect URLs. `DNS_MIGRATION_CHECKLIST.md` Step 2 documents the same setting
for a real domain; the login and forgot-password pages build the redirect from
`window.location.origin` at request time, so Supabase's allow-list is the only
thing that needs changing.

### How a user becomes an admin

**There is exactly one admin role, and it is a single column: `profiles.role`
must equal the string `'admin'`.** There is no admin UI for granting it and no
invite flow — you set the row directly in Supabase (Table Editor, or an `update
profiles set role = 'admin' where id = '<auth user id>'` in the SQL Editor).

- `profiles.role` is `NOT NULL DEFAULT 'customer'` with
  `CHECK (role IN ('admin','contractor','architect','customer'))`
  (`supabase/migrations/001_initial_schema.sql`, documented in `SCHEMA.md:135`).
  Migration `007_delivery_tracking.sql` adds `'operator'` to that CHECK as a
  fifth permitted value.
- **Middleware behaviour** (`middleware.ts`, which matches every route except
  `_next/static`, `_next/image`, `favicon.ico` and static image extensions):
  - Unauthenticated + `/account`, `/checkout` or `/admin` → redirect to
    `/login?redirect=<pathname>`.
  - Unauthenticated + `/field/shop` → redirect to `/field/no-access`, not
    `/login`. Signed-out is treated as just one more "not admin" case.
  - `/field/contractor` is **deliberately not gated** — it is specified for
    anonymous field contractors with no AFS account, the same guest pattern as
    `/upload`.
  - Authenticated + `/admin/**` → role is looked up; anything other than
    `'admin'` redirects to `/account`.
  - Authenticated + `/field/shop` → `'admin'` only; otherwise
    `/field/no-access`.
  - Authenticated + `/login` or `/register` → redirect to `/admin` for an
    admin, `/account` for everyone else.
  - The role lookup (`getUserRole`) uses the **service-role** client, not the
    request-scoped session client, because the session client's `profiles` read
    depends on RLS and cookie-propagation timing in the Edge runtime — which is
    what previously misrouted both non-admins and admins. The function **fails
    closed**: a missing env var or a network error is caught and returns
    `null`, which every caller treats as not-admin. Both Supabase client
    constructions are wrapped in try/catch, because an unguarded throw there
    returns a 500 `MIDDLEWARE_INVOCATION_FAILED` for *every* request including
    public ones.
- **Middleware is not the only check.** Every admin page also calls
  `requireAdminUser()` (`lib/admin/auth.ts`), which redirects to `/login` with
  no user and to `/account` when `profiles.role !== 'admin'`. API route
  handlers cannot use `redirect()`, so they use
  `requireOperatorApi()` (`lib/auth/require-operator.ts`) for plain 401/403
  JSON, accepting `'operator'` or `'admin'`. `ARCHITECTURE.md:316` states the
  rule directly: *never rely on middleware alone*.

The HEAD commit of `command-center-v7` is this exact failure mode in practice —
*"Reid had no Command Center: his profiles row said customer, not admin"*. The
bounce to `/account` was the guard working correctly on a wrong row. If an
admin screen redirects you, check the row before you check the code.

---

## 5. Architecture overview

### How a request flows

```
Browser
  │
  ├── middleware.ts  (Edge; matches all non-static routes)
  │     • resolves the Supabase session from cookies (@supabase/ssr)
  │     • gates /account, /checkout, /admin, /field/shop
  │     • looks up profiles.role via the SERVICE-ROLE client, fails closed
  │     • bounces signed-in users off /login and /register
  │
  ├── Server Components / Pages (app/**/page.tsx)
  │     • public pages read with the anon client (lib/supabase/server.ts)
  │     • admin pages call requireAdminUser() again — layered, not single-point
  │     • light-vs-gunmetal theming is opted into BY THE PAGE
  │       (components/admin/LightWorkingArea.tsx, lib/data/admin-working-area.ts)
  │
  └── Route Handlers (app/api/**/route.ts — 117 of them)
        • session-scoped reads  → lib/supabase/server.ts   (RLS applies)
        • authoritative reads   → lib/supabase/admin.ts    (RLS bypassed,
                                   always cache:'no-store')
        • all Anthropic calls happen HERE, never in the client (rule #5)
        • every admin mutation writes an admin_audit_log row (lib/admin/audit.ts)
```

### Supabase usage

- **Three clients, three jobs.** `lib/supabase/client.ts` (browser, anon key),
  `lib/supabase/server.ts` (server components and route handlers, anon key,
  cookie session → RLS applies as the signed-in user), `lib/supabase/admin.ts`
  (service role, RLS bypassed, server-only).
- **The service-role client never reads a cached row.** `createAdminClient()`
  passes `cache: 'no-store'` on every request and must keep doing so. Next.js
  patches global `fetch` and caches GET responses in its Data Cache;
  supabase-js reads with `fetch`, so two identical PostgREST GETs in one route
  can be served the first one's body and a row that changed in between is
  simply not seen. This was diagnosed live (2026-09-30) when the Approve link's
  expired case poisoned the cache and the valid click that followed kept being
  told the link had expired — every symptom pointed at a date-parsing bug and
  it was not one. `CLAUDE.md` rule #22; the full story is in the file's own
  header comment.
- **RLS before features** (rule #6). Every table has RLS enabled and at least
  one policy before anything reads from it. The two patterns, from
  `ARCHITECTURE.md` §5:

  ```sql
  -- user-owned data
  CREATE POLICY "users_own_orders" ON orders FOR ALL USING (auth.uid() = user_id);
  CREATE POLICY "admin_all_orders" ON orders FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

  -- public/authenticated read, admin write
  CREATE POLICY "authenticated_read" ON products FOR SELECT
    USING (auth.uid() IS NOT NULL AND is_active = true);
  ```

  `supabase/README.md` has the spot-check query that asserts
  `pg_class.relrowsecurity` is `t` for every table.
- **Storage buckets** (`ARCHITECTURE.md` §5): `blueprints` (private, 50MB),
  `documents` (private, 100MB), `cad-library` (private, 250MB), `orders`
  (private, 25MB). The same section warns that a per-bucket limit can never
  exceed the project's *global* Storage limit, which caps at 50MB on the free
  plan — so `documents` and `cad-library` need Pro or higher. **UNVERIFIED
  (3):** `ARCHITECTURE.md` says no access to the live Supabase dashboard
  config was available to confirm the current global setting. Check Storage →
  Settings before relying on those numbers.
- **Realtime** is used selectively: the customer order-detail page and the
  admin production queue. Everything else polls.

### The `company_id` rule

This one trips people up, and `SCHEMA.md:2125–2137` spells it out:

- **There is no `customers` table anywhere in this schema**, and `orders` has
  no column literally named `customer_id`. An order identifies its owning
  customer through `user_id UUID NOT NULL REFERENCES profiles(id)`.
- **`companies` is an optional grouping reached only through
  `profiles.company_id`.** `orders` does not reference `companies` directly,
  and neither does any other user-scoped table.
- Every user-scoped table keys off `profiles(id)` directly, never
  `companies(id)` — `projects`, `quote_requests`, `takeoff_uploads`,
  `vault_documents` and `custom_profiles` all do.
- Company-wide *sharing* is layered on top of that per-user ownership rather
  than replacing it. `saved_configurations` (migration
  `024_profile_passport_company_scope.sql`) gains a nullable
  `company_id REFERENCES companies(id)` plus `is_locked`: any teammate on the
  same `company_id` can SELECT, UPDATE requires more, and a row with
  `company_id IS NULL` keeps exactly the original per-user behaviour
  (`SCHEMA.md:1229–1235`). A nullable company column that falls back to
  per-user is the pattern — do not make one `NOT NULL`.

### Folder map — one line per top-level item

| Path | What lives there |
|---|---|
| `app/` | Next.js App Router: 85 `page.tsx` route segments, 117 `app/api/**/route.ts` handlers, 15 layout/error files, `globals.css`. |
| `app/(public)/` | Route group for the marketing/public site — about, architects, products, resources, contact, FAQ, legal, flashchat. |
| `app/(auth)/` | Route group for login, register, confirm, forgot/reset password. Shares `AuthShell`. |
| `app/components/` | Homepage-only section components (hero, Nationwide map, phone-mockup video, shop-floor proof). **Separate from the top-level `components/`** — a historical split, not a rule. |
| `app/api/` | Every route handler. All Anthropic, Stripe, Resend, Twilio, PathfinderEdge and service-role work happens here. |
| `components/` | 149 shared React components in 19 feature folders (`admin/` 53, `account/` 19, `studio/` 9, `layout/` 9, `ui/` 9, …). |
| `lib/` | 170 TypeScript modules in 32 folders — the business logic. Pure, unit-testable modules live here by preference (`lib/data/`, `lib/pricing/`, `lib/delivery/`, `lib/flashdraft/`). |
| `supabase/` | 38 numbered SQL migrations plus `supabase/README.md` (how to apply them). |
| `scripts/` | One-off and build-time Node/tsx scripts, including `scripts/audit/contrast-check.mjs` — the `prebuild` gate. |
| `tests/` | `tests/e2e/` — 24 Playwright specs, 4 DB helpers, `auth.setup.ts`, and a README. Unit tests live beside their modules in `lib/`. |
| `specs/` | 54 `SPEC_*.md` feature specifications, one per feature, read before building it. |
| `docs/` | The Command Center V2 spec, the V7 gap audit, and the V2 HTML design prototype. |
| `public/` | Static assets: logos, PWA icons and four manifests, videos, `public/data/us-contiguous.geojson`, legacy site photography, metal colour charts. |
| `diagnostics/` | PathfinderEdge debug captures (gated by `PATHFINDER_DEBUG_CAPTURE`). Excluded from `tsconfig.json`. |
| `middleware.ts` | The single Edge middleware. Auth and role gating. |
| `*.md` at the root | The governance stack — see [§11](#11-governance-and-conventions). |

### Route tables

**Public** (`app/(public)/`, plus top-level public routes). Nothing here is
auth-gated.

| Route | Page |
|---|---|
| `/` | Homepage |
| `/about`, `/about/services`, `/about/services/submittal` | Company and services |
| `/products`, `/products/[category]`, `/products/[category]/[slug]` | Catalog |
| `/architects` + `/cad-library`, `/consultation`, `/custom-profiles`, `/finish-palette`, `/spec-writer`, `/guides`, `/guides/[profileSlug]`, `/specs/[profileSlug]` | Architect portal |
| `/resources`, `/resources/building-codes` | Resource centre + the building-code jurisdiction directory (public since migration 033) |
| `/contact`, `/faq`, `/flashchat`, `/legal/privacy`, `/legal/terms` | |
| `/quote`, `/upload` | Quote builder and blueprint upload — guest-accessible |
| `/studio`, `/studio/draft`, `/studio/library`, `/studio/hem-debug` | **FlashDraft**, the drawing tool |
| `/design-studio`, `/hailview`, `/track`, `/track/[orderId]` | 3D studio, HailView storm report, delivery tracking |
| `/field/contractor`, `/field/no-access` | Field PWA — contractor side is deliberately anonymous |
| `/invite/[token]` | Team invitation acceptance |
| `/login`, `/register`, `/register/confirm`, `/forgot-password`, `/forgot-password/sent`, `/reset-password` | Auth |
| `/configure*`, `/configurator*` | **Permanent 301 → `/studio/draft`** (`next.config.js`). The old configurator was removed as redundant with FlashDraft. |

**`/account`** — signed-in customer portal (middleware-gated).

| Route | Page |
|---|---|
| `/account` | Dashboard |
| `/account/orders`, `/account/orders/[id]` | Orders and order detail |
| `/account/quotes`, `/account/quotes/[id]` | Quotes |
| `/account/invoices` | Invoices |
| `/account/projects`, `/account/projects/[id]` | Multi-project management |
| `/account/documents` | Document vault |
| `/account/templates` | Saved project templates |
| `/account/team` | Team accounts |
| `/account/credit-application` | Online credit application |
| `/account/settings` | Profile and notification settings |
| `/app/profile-passport` | Profile Passport (saved custom profiles) |
| `/checkout` | Payment (middleware-gated separately) |

**`/admin`** — `profiles.role = 'admin'` only, gated twice.

| Route | Page | In the nav? |
|---|---|---|
| `/admin` | Dashboard | — |
| `/admin/command-center` | **The Workbench** (five lanes: New → Quoted → Approved → In the shop → Done). Also serves the pre-V2 dark views at `?tab=dashboard\|pending\|sent\|completed\|bids`. | Yes (with badge) |
| `/admin/command-center/job/[id]` | The Job screen | — |
| `/admin/command-center/bids/[id]` | Bid document editor | — |
| `/admin/quotes` | Quotes list (v7 Phase 2) | Yes |
| `/admin/orders`, `/admin/orders/[id]` | Orders list and detail | Yes |
| `/admin/shop-view` | Shop View — one job at a time, numbered queue | Yes |
| `/admin/deliveries` | Deliveries by day and window | Yes |
| `/admin/customers`, `/admin/customers/[id]` | Customer CRM | Yes |
| `/admin/pricing` | Pricing rules (`adminOnly: true`) | Yes |
| `/admin/credit-applications`, `/admin/bid-monitor`, `/admin/search`, `/admin/settings` | | Under **More** |
| `/admin/settings/price-book` | The versioned price book | — |
| `/admin/shop-library` | Send history to the current Thalmann | — |
| `/admin/quote-requests`, `/admin/quote-requests/[id]`, `/admin/orders-crm`, `/admin/quickbooks` | Pre-V2 screens | — |
| `/admin/geometry-test` | Developer-only geometry validation. Unlinked **on purpose** — recorded in `UNLINKED_ADMIN_ROUTES`. | No |
| `/admin/gbp-photos` | Google Business photo review. Unlinked on purpose; kept for a future driver app. | No |
| `/employee`, `/employee/orders`, `/employee/orders/[id]`, `/employee/photos` | Employee PWA | — |
| `/field/shop` | Shop-floor PWA, admin-only | — |

The nav is **data**, not markup: `lib/data/admin-nav.ts` exports
`TOP_LEVEL_NAV`, `MORE_NAV`, `ADMIN_SEARCH_HREF`, `NEW_QUOTE_HREF` and
`UNLINKED_ADMIN_ROUTES`, and `lib/data/admin-nav.test.ts` asserts the shape.
`MORE_NAV` holds **destinations only** — nesting a menu inside it would
reintroduce the second navigation level that v2-01 removed.

**`/api`** — 117 route handlers. Grouped:

| Group | Count-ish | Examples |
|---|---|---|
| `api/admin/command-center/*` | 14 | `approve`, `approve-quote-request`, `approve-by-phone`, `send-quote`, `reject`, `request-changes`, `set-rush`, `mark-delivered`, `typeahead`, `profile-search`, `profile-shortcuts`, `profile-thumbnail/[id]`, `draft-followup`, `cancel-quote-request` |
| `api/admin/*` (other) | ~30 | `bid-documents/*` (11), `shop-library/*`, `shop-queue/*`, `price-book`, `pricing-ledger/export`, `deliveries/*`, `customers/[id]`, `invoices/[id]/mark-paid`, `orders/[id]/*`, `inventory/*`, `gbp/[id]/*`, `pathfinder`, `quickbooks/status`, `supplier-price-change` |
| Customer-facing | ~25 | `quote-requests`, `quote-approve/[token]`, `projects`, `templates`, `team/*`, `documents/*`, `upload`, `takeoff`, `credit/apply`, `pickup/schedule`, `account/*`, `invoices/*`, `orders/[id]/*`, `track/*` |
| AI | 7 | `chat`, `takeoff`, `takeoff/[uploadId]`, `spec`, `spec/save`, `spec/[id]/docx`, `products/ai-search`, `recommendations/*`, `architects/installation-advisor` |
| Machine / field | 5 | `machine-bridge/pending-jobs`, `machine-bridge/job-delivered`, `field/shop/[id]/complete`, `field/photo-upload`, `field/quote-request` |
| Other | | `webhooks/stripe`, `checkout/*`, `auth/register`, `driver/location`, `bid-monitor/*`, `gbp/*`, `hailview/*`, `profile-passport/*`, `studio/canonical-profiles`, `contact`, `consultation/request` |

---

## 6. Core domain concepts and the data flow

### Profiles — and the three things called "profile"

This is the single most confusing naming in the codebase, so get it straight
first.

1. **`profiles`** — the Supabase Auth user table. Name, role, company, pricing
   tier, credit terms. Nothing to do with sheet metal.
2. **A flashing profile** — the cross-section shape of a piece of metal: a
   polyline of points with bend angles between the legs, plus optional hems.
   This is what FlashDraft draws.
3. **`canonical_profiles`** — the hand-authored starter library of
   mathematically correct flashing profiles, stored as pre-computed XY point
   sequences in inches (migration 006, seeded by
   `scripts/seed-canonical-profiles.ts`). Since migration 031 this is the
   **only** profile library.

Two more that sound similar and must never be confused:
**`shop_profile_library`** is the real *send history* to the current Thalmann
(including `pathfinder_profile_id`), and **`saved_configurations`** is the
customer-facing Profile Passport.

**The 911-profile machine library is gone.** Migration
`031_drop_machine_profile_library.sql` dropped `machine_profile_bends` (4,537
rows), `machine_profiles` (911) and `machine_profile_categories` (46), along
with their UI, routes and importers. Two decisive reasons: the geometry was
AI-read out of a legacy database and never validated, so matching a customer's
drawing against it produced confident-looking nonsense; and most of the profile
names were real customer, hospital and project names, which is not catalog
content. `lib/data/removed-machine-library.test.ts` is a **static test** over
`app/ components/ lib/ scripts/ tests/` that fails on any reference to those
tables or the deleted modules — and it also asserts that
`shop_profile_library` and `canonical_profiles` are still referenced, so an
over-eager cleanup cannot take them too.

**A bend angle has exactly one definition**, and `lib/flashdraft/geometry.ts`
is the only place that decides it (`CLAUDE.md` rule #12): the **signed interior
angle** in the range (−180, 180]. Magnitude is the included angle between the
two legs (180 = straight through, 90 = a right-angle corner, 0 = folded flat
back); the sign is the fold's handedness. `signedInteriorAngleDeg()` computes
it, `bendTurnDegrees()` turns it into a turtle heading change,
`buildCrossSectionPoints()` walks it back out as a polyline, and
`formatBendAngleLabel()` prints it. Every 3D viewer goes through those three, so
3D geometry and 3D labels can never drift from the 2D canvas. Never reintroduce
an unsigned angle into a rendering path — `Math.acos` returns 0..180 by
construction, so every bend turned the same way and a "W" rendered as a curled
triangle with three positive labels. Two documented exceptions survive: the
human-readable quote prose in `buildBendSummary` stays unsigned, and the
PathfinderEdge encoder (`lib/integrations/flashdraft-to-pathfinder.ts`) carries
its own already-signed `bendAngleAt` on AMS Controls' handedness, which is the
*negation* of FlashDraft's y-down screen convention and must not be "unified".

### FlashDraft — the drawing tool

`app/studio/draft/page.tsx` plus `components/studio/` (9 components) and
`lib/flashdraft/` (`geometry.ts`, `draw-profile-scene.ts`, `hem-glyph.ts`,
`geometry-fingerprint.ts`, `unsaved-work.ts`, `admin-job-handoff.ts`).

- **Both free endpoints extend, and a hem travels with them** (rule #13).
  Press-and-drag the first point to prepend a leg, the last point to append
  one. A last→first closing leg is not creatable by any gesture. Dragging from
  a hemmed end extends it anyway and the hem **moves** to the new free end,
  preserving type, gap, fold length and kick direction — nothing is destroyed
  and nothing is refused. This works without a migration because `hemStart` /
  `hemEnd` are anchored **positionally** ("the first point", "the last point"),
  never to a stored index; giving a hem a numeric index would reintroduce the
  stranded-fold bug the design avoids. A prepend must renumber every
  index-keyed piece of state in lockstep and push exactly **one** undo entry.
  Regression coverage: `tests/e2e/flashdraft-regression.spec.ts`.
- **A WebGL failure degrades to the 2D view** (rule #31).
  `new THREE.WebGLRenderer()` throws when a browser refuses a context — a
  blacklisted GPU driver on a shop tablet, a kiosk browser, a remote-desktop
  session. The throw is caught and `components/studio/ProfileCrossSection2D.tsx`
  renders instead, calling the same three geometry/format functions as the 3D
  viewer so the two cannot disagree. `tests/e2e/webgl-fallback.spec.ts` proves
  it by making `getContext` return null for the three WebGL context ids — a
  real refusal, not a test-only flag.
- **One profile search** (rule #27). `admin_profile_search` (migration 029,
  extended in 038 with a nullable `p_ids uuid[]`) is the only profile query;
  Recent and Pinned reuse it through that argument.
  `components/admin/ProfileSearchPanel.tsx` is the one UI, rendered both at
  `/admin/search` and in FlashDraft's `?admin=1` drawer. **Select auto-saves
  unsaved canvas work first** and only loads if that succeeded; "unsaved" is
  decided by `lib/flashdraft/unsaved-work.ts`'s signature, never a dirty flag
  and never `geometryFingerprint` (which is orientation-independent by design,
  so a whole-profile drag would read as no change at all).
- **A list view never returns `shop_profile_library.geometry_svg`** (rule #26).
  That column is misnamed — it holds a base64 PNG data URI, measured at
  70KB–786KB per row, about 6MB across the twenty rows that exist. Cards fetch
  their own image lazily on scroll through
  `components/admin/LazyProfileThumb.tsx`, and polling screens pause when the
  tab is hidden.

### The data flow, end to end

```
   INTAKE                     ┌──────────────── FlashDraft (/studio/draft)
   a quote_requests row       ├──────────────── Quote builder (/quote)
   IS the Job                 ├──────────────── Blueprint takeoff AI (/upload)
                              └──────────────── Field contractor PWA (/field/contractor)
        │                           POST /api/quote-requests
        ▼
   job_stage = 'new'          quote_requests  (+ line_items JSONB, is_rush, rush_source,
        │                                       job_name, client_business_name, PO, finish, color)
        │   admin: Send quote  →  POST /api/admin/command-center/send-quote
        ▼                          lib/quotes/issue.ts
   job_stage = 'quoted'       quotes          (revision, supersedes_id, line_items + CENTS snapshot,
        │                                      price-book version ids)
        │                     quote_approval_tokens  (HMAC-signed, single-use, expiring, HASH only)
        │                     pricing_ledger  (append-only)
        │
        │   customer approves, three channels, all writing the SAME record:
        │     • GET  /api/quote-approve/[token]        approval_channel='email'
        │     • POST .../command-center/approve-by-phone  approval_channel='phone'
        │     • an admin acting in the Command Center
        ▼
   job_stage = 'approved'     invoices        (created HERE, copied from the quote — lib/invoices/create.ts)
        │                     status stays 'submitted' ON PURPOSE (see the single door, below)
        │
        │   admin: Approve & Send to Machine → POST /api/admin/command-center/approve
        ▼                                       lib/integrations/pathfinder-edge.ts
   job_stage = 'shop'         machine_jobs, shop_profile_library (+ pathfinder_profile_id)
        │                     PathfinderEdge catalog 20115 ← the Thalmann DS2801 POLLS this
        │
        │   shop: Mark finished (/admin/shop-view or /field/shop)
        │     lib/utils/shop-job-completion.ts  → invoice email to the customer
        │     lib/delivery/auto-schedule.ts     → a real delivery, next business day
        ▼
   job_stage = 'done'         deliveries  (scheduled_date, window key, shop_job_id UNIQUE)
                              lib/delivery/notify.ts → Resend + Twilio + a notifications row
```

### The stage ladder

`lib/data/job-stage.ts` is the one model (migration 032). **A `quote_requests`
row *is* the Job** — every intake source already creates one, and `job_stage`
says which Workbench lane it sits in.

```
new  →  quoted  →  approved  →  shop  →  done        (job_stage = null means archived/cancelled)
```

Lane labels and sub-labels live in the same module: *New / Needs a quote*,
*Quoted / Waiting on the customer*, *Approved / Ready for the machine*,
*In the shop / At the Thalmann*, *Done / Delivered*.

The transition rule, enforced server-side by `planStageTransition()`:

- **Forward is allowed and may skip rungs.** Skipping is a real workflow: a
  customer who approves by phone goes `new → approved` with no `quoted` step,
  and today's single "Approve & Send to Machine" click takes a job from `new` to
  `shop` in one action.
- **Same-stage is a no-op, not an error.** A second click used to return
  `409 Quote request is not pending approval`, which read as a failure when the
  truthful answer was "that already happened".
- **Backward is refused.** A silent backward move would un-send work already at
  the machine.

The module is pure — no database access — so it is exhaustively unit-tested and
cannot be bypassed by a caller that forgets a query
(`lib/data/job-stage.test.ts`).

### ONE DOOR TO THE MACHINE

`CLAUDE.md` rule #14, and the most safety-critical invariant in the repo.
PathfinderEdge catalog 20115 is polled by the physical Thalmann DS2801, so a
profile landing there **is fabricable work**.

- `pushProfileToPathfinder()` (`lib/integrations/pathfinder-edge.ts`) takes a
  **required** third argument, an `ApprovalContext`, and **verifies it in the
  database with the service role before any network call**. A
  `quote_request_approval` needs a quote request still at `status='submitted'`;
  a `machine_job_approval` needs a machine job still at
  `status='pending_approval'`; both need the acting user to be a real
  `role='admin'` profile. Missing, stale or non-admin means the push returns an
  error and sends **nothing**. If the guard cannot verify, it refuses.
- **Exactly two files may call it:**
  `app/api/admin/command-center/approve-quote-request/route.ts` and
  `app/api/admin/command-center/approve/route.ts`. This is enforced by a
  **static test**, `lib/integrations/pathfinder-single-door.test.ts`, which
  walks `app/ components/ lib/ scripts/ tests/` and fails if any other file
  calls it. Do not add a caller, and do not add a file to the allow-list to
  make the test pass. Hiding a button is not enforcement; the database check
  is.
- Four doors were deleted on 2026-09-30 to establish this, including a
  round-trip test script that POSTed a live test profile into 20115 with no
  approval at all. The static test found it; grep had not.
- **"Approved by phone" and the email Approve link are not extra doors.** Both
  write the approval record the guard *reads* and deliberately leave
  `status='submitted'` alone so the guard's condition still holds when an admin
  later presses "Send to machine". Neither imports the PathfinderEdge module.
- **Machines pull; nothing pushes to them.** There is no job-submission
  endpoint, no job-status endpoint, and **no way to trigger, force or expedite a
  sync** — confirmed against the vendor's own machine-sync doc. A profile
  reaches the DS2801 when it sits in catalog 20115, is not archived, and the
  machine is powered on and connected. `submitJobToMachine` and `getJobStatus`
  returning `not_configured` is **correct**; do not "fix" them by inventing
  endpoints.
- **Open design question, NOT resolved:** the gate is an *admin* approval, not
  a *customer's* acceptance. A profile reaches the Thalmann the moment an admin
  clicks "Approve & Send to Machine"; there is no customer-acceptance step
  between quote and machine. **PENDING REID.**

### Rush

`CLAUDE.md` rule #15. **Rush is never inferred.** `quote_requests.is_rush` has
exactly two sources: the customer's explicit checkbox at intake
(`app/api/quote-requests/route.ts`) or an admin's explicit toggle
(`app/api/admin/command-center/set-rush/route.ts`). Never from a delivery date,
a keyword like "ASAP", a customer note, or how long a job has waited.

Postgres enforces it: migration 034's
`quote_requests_rush_needs_explicit_source` CHECK refuses `is_rush = true`
unless `rush_source` is `'customer_checkbox'` or `'admin_toggle'`. There is no
third value, so an inference has nothing it could write. The naive
`CHECK (is_rush = false OR rush_source IN (...))` was applied live and
**accepted** a rush with a NULL source — `false OR UNKNOWN` is UNKNOWN and a
CHECK accepts UNKNOWN — so the `IS NOT NULL` half is load-bearing.
`lib/data/rush-explicit-only.test.ts` is a static test that fails if any file
outside the four known writers assigns `is_rush`.

**Rush pins to the top of the shop queues only** — `lib/data/machine-jobs.ts`,
`lib/data/orders.ts`, `lib/data/shop-queue.ts`'s `compareShopQueue`: the lists
read by whoever decides what to bend next. Everywhere else (Workbench, office
pending list, Deliveries) ordering is newest-arrival-first and rush changes
nothing but the badge. **Deliveries is not a shop queue:** a rush job whose day
is Thursday does not become a Tuesday stop by being urgent.

### Pricing, quotes and invoices

- **The price book is versioned and never overwritten; a blank is never a
  zero** (rule #19). `price_book_items` + `price_book_versions` (migration 035).
  An edit **inserts** a version with a new `effective_from` and the database
  refuses an update (`price_book_versions_append_only`), so an already-issued
  quote keeps the prices it was built on forever — upheld three ways over: the
  insert-only writer, the trigger, and the quote's own cents snapshot in
  `quotes.line_items`.
- **Prices start empty.** Every money column is NULLABLE with **no default**;
  the 24 seeded rows have no version at all. `NULL` means Steve has not filled
  it in: it renders as a marked "Not set" chip on amber, and
  `lib/pricing/quote-math.ts` **refuses** to issue a quote that needs it,
  naming the row to fix. There is no `DEFAULT 0` anywhere — a zero is a price,
  and a made-up one. `extras` is the single exception.
- **Strips per sheet are derived, never stored:** `floor(48 / blankWidthIn)`,
  because a strip's width comes out of the sheet's 4 ft dimension and its
  length is the full 10 ft. A blank wider than 48 in, or a piece longer than
  10 ft, **fails loudly** — the naive formula yields 0 strips and then divides
  by it. A short piece is charged a whole strip **on purpose**: nesting is
  `SPEC_TRIM_LENGTH_OPTIMIZER.md`'s job, and quoting the optimistic number here
  would under-quote every short-piece job.
- **Issuing a quote** (`lib/quotes/issue.ts`) has one deliberate order of
  operations: price from the price book as of today and stop if anything is
  blank; write the `quotes` row snapshotting cents and version ids; mint a
  signed single-use expiring Approve link and store only its hash; send or
  capture the email; advance to `quoted` and append the ledger rows. A quote is
  never half-issued. **A revision is a new quote, not an edit** — `revision`
  increments, `supersedes_id` points at the one it replaces, the old one is
  marked `expired`, and its outstanding Approve links are expired with it, so a
  customer cannot approve a price that has been withdrawn.
- **The quote becomes the invoice with no retyping** (rule #21).
  `lib/invoices/create.ts` **copies** the quote's line items, totals and
  price-book snapshot. Nothing is recomputed from the price book, which may
  have moved; no human re-enters anything. A recomputed invoice would silently
  bill a different number from the one the customer approved.
  `invoices.quote_id` is UNIQUE, so a double click cannot bill twice.
- **The Approve link** (`app/api/quote-approve/[token]/route.ts`) is
  HMAC-SHA256 signed, **single-use** (a conditional `UPDATE ... WHERE used_at
  IS NULL`, so two simultaneous clicks cannot both win) and **expiring**. Only
  the hash is stored, and the signature is checked **before** the expiry so a
  forged expiry is never believed.
- **The pricing ledger is append-only, enforced by Postgres** (rule #20).
  `pricing_ledger` records every estimate, quote and revision, every outcome
  with its reason and time-to-decision, every invoice, every price-book change
  as old→new, and every supplier notice. Two independent refusals: a
  `BEFORE UPDATE OR DELETE` trigger that RAISEs (binding the table owner and
  the service role, which a REVOKE would not), and RLS with **SELECT and INSERT
  policies only** — no UPDATE policy and no DELETE policy exist at all. The
  trigger reads `to_jsonb(OLD) ->> 'test_tag'`, not `OLD.test_tag`, because
  PL/pgSQL plans an `IF` whole and does not short-circuit, so a direct column
  reference fails `42703` on the table that lacks the column. Money is **cents**
  in this table, everywhere.
- **The one escape is the reserved `E2E-TEST-` job-name prefix.** A row whose
  `test_tag` is non-null may be DELETED — never updated — and `test_tag` is
  written by exactly one function, `ledgerTestTag()` in `lib/pricing/ledger.ts`.
  Tagged rows are excluded from the `pricing_ledger_real` view and the CSV
  export. The same prefix also **captures outbound email**. One prefix, three
  jobs.
- **One confidence pattern** (rule #17). `lib/ai/takeoff-confidence.ts` owns the
  `high | medium | low` vocabulary, the per-item `aiNote`, `overallConfidence`
  and the `confidence !== 'high'` "unsure" threshold.
  `app/api/takeoff/route.ts` produces that shape; the Command Center Job screen
  consumes it; both import the module. A local
  `type X = 'high' | 'medium' | 'low'` anywhere is the drift this prevents, and
  a unit test fails on one. When a job has no AI extraction behind it, the panel
  says so rather than badging the customer's own numbers with a confidence they
  never earned.

### Delivery

- **A delivery day is a business day, worked out in the shop's own time zone,
  and `lib/delivery/business-days.ts` is the only place that decides it**
  (rule #24). Marking a job finished auto-schedules delivery for the **next
  business day**, which has two ways of going wrong and both live in that one
  file:
  - **The weekend.** Friday's next business day is Monday — so is Saturday's
    and Sunday's. A naive `+1 day` books a day nobody is driving, and the
    customer finds out by nobody turning up.
  - **The time zone.** Vercel runs in UTC; the shop is in Burnet, Texas. A job
    finished at 7pm Central Tuesday is already 01:00 UTC Wednesday, so
    "tomorrow" off the raw server clock would be Thursday. Every date goes
    through `shopDateOnly()` in `SHOP_TIME_ZONE`. **This bug hides itself:** on
    a Friday the weekend skip lands on Monday either way, so it only shows up as
    a Tuesday-evening finish booked for Thursday.
  - Dates are plain `YYYY-MM-DD` strings matching `deliveries.scheduled_date`'s
    `date` type — keeping them strings is what stops an instant creeping in.
  - **Holidays are deliberately not modelled.** No holiday calendar has been
    supplied, and inventing one would put a guess in the code. Weekends are a
    fact; an auto-scheduled delivery is always reschedulable by hand.
- **Four windows, as keys not labels:** `'08-10'`, `'10-12'`, `'13-15'`,
  `'15-17'`. The English lives in `lib/delivery/windows.ts` and nowhere else,
  so rewording a window is not a migration and no en dash ever ends up inside a
  database CHECK. `deliveries.shop_job_id` is UNIQUE so a double click cannot
  book the same work twice; a reschedule is an UPDATE of that one row.
- **Auto-scheduling never throws and never blocks** (`lib/delivery/auto-
  schedule.ts`). A job that has genuinely been bent is finished whether or not
  scheduling worked — an operator must not be told "that failed" about work
  already on the bench. It is idempotent, and a job finished → un-finished →
  finished again keeps a delivery somebody may already have rescheduled by
  hand.
- **Telling a customer goes through the services that already exist** (rule
  #25). `lib/delivery/notify.ts` is plumbing, not a second path: email via
  `lib/email/outbound.ts`'s `sendTrackedEmail`, the shell and button from
  `lib/resend/templates/base.ts`, SMS via `lib/twilio/sms.ts` behind the same
  `phone && sms_opt_in` gate, and the same `notifications` row. The tracking
  link has one formula, `lib/delivery/tracking-url.ts`, which returns `null`
  when there is no `orders.tracking_token` — callers must handle that, because
  a V2 Job that never became a paid order has nothing to track and a link to a
  dead page is worse than plainly giving the day and the window.
- **A captured test message gets no `notifications` row.** That table's status
  CHECK is `('sent','delivered','failed')`, so the only value a capture could
  take is `failed`, which would be a lie about a message nobody tried to send.
  The capture is recorded in full in `outbound_emails` instead. A tagged job
  never reaches Twilio either.
- **Nothing is reported as sent that was not sent.** Resend is unconfigured on
  the deployment, so the honest sentence the Deliveries screen prints is "the
  message is saved here, nothing left the building" — read back out of
  `deliveries.notify_note`, written from the result the notifier returned
  rather than from having called it.

### Reporting a send honestly

`CLAUDE.md` rule #16. `pushProfileToPathfinder` can return
`status: 'connected'` with `profileId: null` — the profile really was created,
but the follow-up GET that resolves its number did not find it. That is not a
success and not a failure: it is `send_status='unconfirmed'`, reported in plain
English, with **no retry offered**, because a retry would duplicate a real
profile in catalog 20115. A genuine failure writes `send_status='failed'` plus
the real reason and an audit row. An already-sent job answers 200 with "This job
has already been sent to the machine. Nothing was sent again." — never a bare
409.

---

## 7. Database

Schema source of truth: `SCHEMA.md` (139KB) at the repo root. The migrations in
`supabase/migrations/` implement it. `supabase/README.md` is the how-to-apply
guide — **note that its own narrative about which migrations are applied live is
stale**, and it only lists files up to 013.

### Migrations by number and purpose

| # | File | Purpose |
|---|---|---|
| 001 | `initial_schema` | All base tables, RLS enabled with policies, FK/filter indexes. Includes the `is_admin()` helper. |
| 002 | `seed_afs_data` | Reference data: materials, gauges, `product_profiles`. |
| 003 | `pricing_rules_cost_notes` | `pricing_rules.cost_notes` — the manual pricing mode while the commodity engine is deferred. |
| 004 | `machine_profiles` | Old Thalmann machine profile library. **Reversed by 031 — skip on a fresh database.** |
| 005 | `machine_jobs` | The Command Center machine-job approval queue + `machine_bridge_status`. Relaxes `admin_audit_log.admin_id` to nullable. |
| 006 | `canonical_profiles` | The hand-authored profile library (XY points in inches). Now the only profile library. |
| 007 | `delivery_tracking` | `driver_locations`, `delivery_notifications`, `gbp_photo_queue`; order tracking columns; `get_tracking_data`/`is_operator`/`is_order_out_for_delivery`; **adds `'operator'` to `profiles.role`'s CHECK**. |
| 008 | `order_geocoding` | `orders.geocoded_lat/lng` — the geocode cache for the driver-GPS 10-mile SMS trigger. |
| 009 | `command_center_crm` | `profiles.internal_notes`, `orders.invoice_paid_at`. Columns only. |
| 010 | `bid_monitor` | `bid_sources`, `bid_projects`, `bid_keywords`, `bid_alerts`. Numbered 010 because 008/009 were taken. |
| 011 | `orders_quote_id_unique` | `UNIQUE(orders.quote_id)` — a real double-insert guard for `createOrderFromQuote()`. |
| 012 | `machine_jobs_fallback_geometry` | `machine_jobs.used_fallback_geometry` — a queryable flag for when placeholder dimensions had to be substituted. |
| 013 | `bid_documents` | `bid_documents`, `_sections`, `_line_items`, `_viewers`. RLS is `role IN ('operator','admin')`, not admin-only. |
| 014 | `takeoff_uploads_pending_status` | Adds `'pending'` — the row is created before the browser has put the bytes in Storage. |
| 015 | `machine_jobs_delivery_method` | `delivery_method`, kept orthogonal to `status` rather than overloading it. |
| 016 | `source_tool_and_shop_profile_library` | `quote_requests.source_tool` + the `shop_profile_library` table. |
| 017 | `color_and_queue_position` | `color` on both tables; `shop_profile_library.queue_position`. |
| 018 | `job_identity_and_finish` | Client business name, contact name, PO number, requested-by, `finish` — on both tables. |
| 019 | `job_name_and_delivery_date` | `job_name` (the project, distinct from contact and company) and the requested delivery date. |
| 020 | `completion_events` | One row per shop-floor completion; `status` defaults to `'pending_integration'`. |
| 021 | `gbp_photo_queue_shop_job_link` | `gbp_photo_queue.shop_profile_library_id`. |
| 022 | `building_code_jurisdictions` | The Texas building-code jurisdiction directory. Deliberately its own table, not an extension of `bid_sources`. |
| 023 | `profile_passport` | Customer-scoped custom profile records with versioned revision history. |
| 024 | `profile_passport_company_scope` | Company-wide profile sharing (nullable `company_id` + `is_locked`) and structured columns on `saved_configurations`. |
| 025 | `profile_passport_thumbnail` | Real canvas-screenshot thumbnails replacing the generic vector preview. |
| 026 | `rename_galvanized_galvalume_to_galvalume` | Galvalume is itself an aluminum-zinc coating on steel, so the old name said the coating twice. |
| 027 | `profile_modify_lineage` | "Modify in FlashDraft" always creates a **new, unlocked** row linked to its parent. This adds the link. |
| 028 | `profile_search` | Grouping/typing columns; enables `pg_trgm` for typo tolerance. |
| 029 | `admin_profile_search_fn` | `admin_profile_search` as a parameterized SQL **function** rather than SQL built in a route. |
| 030 | `command_center_v2_clean_slate` | Wipes pre-V2 job data (Reid confirmed none was real work). Uses a `TEMP TABLE _v2_cutoff`. |
| 031 | `drop_machine_profile_library` | Drops `machine_profile_bends`, `machine_profiles`, `machine_profile_categories`, and `machine_jobs.machine_profile_id` (NULL on every row that ever existed). |
| 032 | `quote_requests_job_stage` | **The one job stage model.** `quote_requests.job_stage`. |
| 033 | `building_codes_public_read` | Building codes move to the public Resources menu; 022's admin-only `FOR ALL` policy is replaced. |
| 034 | `command_center_v2_workbench` | The Workbench and Job screen, plus the rush CHECK (`quote_requests_rush_needs_explicit_source`). |
| 035 | `price_book_ledger_quotes_invoices` | `price_book_items`, `price_book_versions`, `pricing_ledger` (+ the `pricing_ledger_real` view), `invoices`, `quote_approval_tokens`, `outbound_emails`; adds `quotes.revision` and `quotes.supersedes_id`. |
| 036 | `price_book_test_tag` | `test_tag` on `price_book_versions` and `price_book_items` — the deletable-test-row escape from append-only. |
| 037 | `deliveries_and_shop_queue` | The `deliveries` table (`shop_job_id` UNIQUE) and `shop_profile_library.started_at`. |
| 038 | `profile_search_shortcuts` | `admin_recent_profiles`, `admin_pinned_profiles`, and a nullable `p_ids uuid[]` argument on `admin_profile_search`. |

### Tables

67 distinct `CREATE TABLE` statements across the 38 migrations; migration 031
drops three of them, leaving **64** (counting the `TEMP TABLE _v2_cutoff`,
which is created and dropped inside migration 030). The ones you will touch
most:

**Identity and accounts** — `profiles` (the role column; see
[§4](#how-a-user-becomes-an-admin)), `companies`, `team_invitations`,
`credit_applications`, `notifications`.

**Intake and the Job** — `quote_requests` (**the Job**: `job_stage`,
`line_items` JSONB, `is_rush` + `rush_source`, `source_tool`, job identity,
finish, colour, approval channel/by/at), `takeoff_uploads`, `projects`,
`quote_templates`, `saved_configurations` (Profile Passport),
`profile_revisions`, `custom_profiles`, `canonical_profiles`.

**Money** — `quotes` (`revision`, `supersedes_id`, cents snapshot),
`quote_line_items`, `invoices` (`quote_id` UNIQUE), `quote_approval_tokens`
(hash only), `price_book_items`, `price_book_versions` (append-only),
`pricing_ledger` (append-only) + `pricing_ledger_real`, `pricing_rules`,
`contractor_pricing`, `commodity_prices`, `pricing_trend_analysis`,
`supplier_price_history`, `outbound_emails`.

**Fulfilment** — `orders` (`quote_id` UNIQUE, `tracking_token`, geocode cache),
`order_line_items`, `order_status_history`, `order_attachments`,
`machine_jobs`, `machine_bridge_status`, `shop_profile_library` (send history +
`pathfinder_profile_id`), `completion_events`, `deliveries`
(`shop_job_id` UNIQUE), `driver_locations`, `delivery_notifications`,
`gbp_photo_queue`.

**Catalog and content** — `products`, `product_profiles`, `materials`,
`gauges`, `finishes`, `accessories`, `product_accessories`, `cad_library_files`,
`cad_download_log`, `spec_templates`, `saved_specifications`,
`building_code_jurisdictions`, `vault_documents`, `chat_conversations`,
`consultation_requests`.

**Bids** — `bid_sources`, `bid_projects`, `bid_keywords`, `bid_alerts`,
`bid_documents`, `bid_document_sections`, `bid_document_line_items`,
`bid_document_viewers`.

**Admin plumbing** — `admin_audit_log`, `admin_recent_profiles`,
`admin_pinned_profiles`.

### RLS conventions

1. **RLS enabled on every table before any feature reads it** (rule #6).
2. **User-owned:** `USING (auth.uid() = user_id)` for the owner, plus a
   separate admin policy via `EXISTS (SELECT 1 FROM profiles WHERE id =
   auth.uid() AND role = 'admin')` (or the `is_admin()` helper from migration
   001).
3. **Reference/catalog:** authenticated or public SELECT on active rows,
   admin-only write.
4. **Operator-scoped:** `role IN ('operator','admin')` via `is_operator()`
   (migration 007) — used by the delivery/PWA tables and all four bid-document
   tables.
5. **Append-only tables get no UPDATE and no DELETE policy at all**, and a
   `BEFORE UPDATE OR DELETE` trigger that RAISEs as a second, independent
   refusal. Do not add a policy and do not simplify the trigger away.
6. **Company scope is a nullable column with a per-user fallback**, never a
   `NOT NULL` company requirement — see the `company_id` rule in
   [§5](#the-company_id-rule).
7. **Service-role code is the exception, not a shortcut.** It exists to read
   authoritative state (has this token been spent, what stage is this job at,
   does an invoice already exist) and is confined to `lib/supabase/admin.ts`'s
   callers.

### Applying migrations

Numeric order. Each file is safe to re-run only where it uses
`ON CONFLICT ... DO NOTHING` or `ADD COLUMN IF NOT EXISTS`; otherwise
re-running against an already-migrated database errors on `CREATE TABLE` /
`CREATE POLICY`, **which is intentional** (migrations are one-shot).

```powershell
# Option A — dashboard: paste each file into Supabase → SQL Editor, in order.

# Option B — CLI
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

After running them, seed the canonical profile library:

```powershell
pnpm tsx scripts/seed-canonical-profiles.ts   # upserts on slug; safe to re-run
```

**UNVERIFIED (4): which migrations are actually applied to the live database.**
This is the single most important caveat in this section, and the repo is
explicit about it in three places:

- `CURRENT_STATE.md` (PathfinderEdge section): *"This project's live Supabase
  database also has **no migration ledger** — any migration's live-apply status
  must be re-verified via `information_schema` each time it matters, never
  assumed from a file's presence or a prior note in either governance doc."*
- `MIGRATIONS_STATUS.md` exists specifically to say that migrations 007–010's
  live status **was never actually queried**, rather than repeat the project's
  documented history of asserting migration status without checking. The
  verification script is `scripts/check-migrations-007-010.ts`; run it from a
  shell where its approval prompt can be granted:
  `npx tsx scripts/check-migrations-007-010.ts`.
- `supabase/README.md` claims 007, 008 and 009 are not applied, and that 013 is
  "not yet applied as of this writing". Those lines are older than the features
  that depend on them and should not be trusted either way.

Do not infer "applied" from a migration file existing. Query
`information_schema`.

### Generated types

`supabase/README.md` step 1 after migrations is
`supabase gen types typescript --project-id <ref> > types/database.types.ts`.
**There is no `types/` directory in this repo** — that step has never been run,
and the code hand-declares its row interfaces instead (e.g. `MachineJobRow` in
`app/api/admin/command-center/approve/route.ts`). Not a defect, but do not
expect generated types to exist.

---

## 8. Integrations

Status vocabulary here: **Implemented** = real network calls, in use.
**Stubbed** = a real module with a stable interface that returns
`not_configured` and makes no network call. **Specified only** = a `SPEC_*.md`
document and no code.

Every variable below is a **NAME**. No values appear anywhere in this file.

### Supabase — Implemented

| Env var | For |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL. Client and server. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key. Safe in the client bundle. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Bypasses RLS. Never in a `NEXT_PUBLIC_` name. |

Files: `lib/supabase/client.ts`, `lib/supabase/server.ts`,
`lib/supabase/admin.ts`, `middleware.ts`, `app/auth/callback/route.ts`, and the
38 migrations. The Storage hostname is allow-listed in `next.config.js`'s
`images.remotePatterns` (public-object paths only) — if you move Supabase
projects, that hostname changes too.

### Vercel — Implemented (hosting)

| Env var | For |
|---|---|
| `NEXT_PUBLIC_APP_URL` | The canonical public base URL. First choice in `getSiteUrl()`. |
| `VERCEL_URL` | Auto-populated by Vercel per deployment (no scheme). Second choice. |

Files: `lib/site-url.ts`, `vercel.json`, `.vercelignore`, `deploy.ps1`.
**Rule #9: server-side code calls `getSiteUrl()`, never a hardcoded host.**
Resolution order is `NEXT_PUBLIC_APP_URL` → `https://$VERCEL_URL` →
`http://localhost:3000`. Client-side code that needs the current origin uses
`window.location.origin` directly, which works on preview deployments with no
env inlining. `DNS_MIGRATION_CHECKLIST.md` records a verified full-repo search
finding **zero** hardcoded deployment hostnames in application code, which is
what makes the domain cutover config-only.

### Anthropic Claude — Implemented

| Env var | For |
|---|---|
| `ANTHROPIC_API_KEY` | Server-only. |

Files: `lib/anthropic/client.ts`, `lib/anthropic/spec.ts`,
`app/api/takeoff/route.ts`, `app/api/chat/route.ts`, `app/api/spec/route.ts`,
`app/api/products/ai-search/route.ts`, `app/api/recommendations/*`,
`app/api/architects/installation-advisor/route.ts`. Model `claude-sonnet-4-6`
in all three call sites found. **Rule #5: no client-side AI calls, ever** — the
key never touches the client bundle. Confidence output goes through
`lib/ai/takeoff-confidence.ts` (rule #17).

### Resend (email) — Implemented

| Env var | For |
|---|---|
| `RESEND_API_KEY` | Server-only. |
| `RESEND_FROM_EMAIL` | Verified sender address. |
| `INVOICE_OFFICE_EMAIL` | Optional. Overrides the office invoice copy recipient. Read in `lib/data/office.ts`. |
| `AFS_EMAIL_TEST_MODE` | **Local development only.** `=1` captures every message. Deliberately not set in Vercel. Read in `lib/email/outbound.ts:68`. |

Files: `lib/resend/client.ts`, `lib/resend/send.ts`,
`lib/resend/templates/base.ts`, `lib/email/outbound.ts`,
`lib/quotes/email-template.ts`, `lib/utils/invoice-email.ts`,
`lib/utils/bid-document-email.ts`, `lib/delivery/notify.ts`.
No `resend` npm package — a single POST to a REST endpoint does not need an
SDK, matching the Twilio precedent. `lib/resend/client.ts`'s own header notes
that `CLAUDE.md`/`ARCHITECTURE.md` documented Resend as wired long before any
`lib/resend/` file existed; before that, every "email notification" call site
only inserted a `notifications` row.

**Test mode is per message, never a deployment flag** (rule #21): a message is
captured — written to `outbound_emails` with `status='captured_test_mode'`, no
provider call — when the job's name carries the reserved `E2E-TEST-` prefix. A
deployment-wide switch was rejected because it would silence real customer mail
the moment somebody left it on.

**`SESSION_STATE.md` and rule #25 record that Resend is currently unconfigured
on the deployment**, which is why the Deliveries screen honestly says the
message is saved but nothing left the building.

### Stripe — Implemented

| Env var | For |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client. Safe in the bundle. |
| `STRIPE_SECRET_KEY` | Server-only. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `app/api/webhooks/stripe` signatures. |

Files: `app/api/checkout/create-intent/route.ts`,
`app/api/checkout/confirm-order/route.ts`, `app/api/webhooks/stripe/route.ts`,
`app/checkout/page.tsx` (with `STRIPE_CARD_ELEMENT_COLORS`, a documented
rule-#4 `CANVAS_COLORS` exception because Stripe's embedded iframe cannot
consume Tailwind classes), `app/admin/orders/[id]/page.tsx`, `lib/data/orders.ts`.
Webhook endpoint URL changes on a domain cutover —
`DNS_MIGRATION_CHECKLIST.md` Step 3.

### Twilio (SMS) — Implemented

| Env var | For |
|---|---|
| `TWILIO_ACCOUNT_SID` | |
| `TWILIO_AUTH_TOKEN` | |
| `TWILIO_FROM_NUMBER` | E.164 format. |

File: `lib/twilio/sms.ts` — a direct `fetch` POST to Twilio's Messages
resource with Basic auth, no `twilio` npm package. Returns
`{ success: false, error: 'Twilio is not configured.' }` when any of the three
is missing. Callers: `app/api/orders/[id]/dispatch/route.ts`,
`app/api/driver/location/route.ts` (the 10-mile alert), `lib/delivery/notify.ts`
— all behind the same `phone && sms_opt_in` gate. A job carrying the
`E2E-TEST-` prefix never reaches Twilio.

### Google Maps — Implemented

| Env var | For |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client: address autocomplete and the delivery tracking map. Restrict to Places/Maps JS and your domain. |
| `GOOGLE_MAPS_API_KEY` | Server-only: Geocoding API. |

Files: `components/track/DeliveryTrackingMap.tsx:355` (which carries a
still-open `// TODO: Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local`),
`lib/utils/geocode.ts:21`, `lib/hailview/geocode.ts`,
`app/admin/settings/page.tsx:33`.

**Not Google Maps:** the homepage delivery-area map is Leaflet drawing
`public/data/us-contiguous.geojson`, a single MultiPolygon of the lower 48 + DC,
fit to its own computed bounds. Rule #11 is explicit that it is **a real
contiguous-US polygon, never a radius circle** — a decorative circle centred on
the Burnet shop was tried and explicitly replaced because it bore no relation
to the real coastline. If that file ever needs regenerating, the method is
`us-atlas`'s `states-10m.json` + `topojson-client`'s `merge()` over every state
except Alaska/Hawaii/the territories, rounded to ~3 decimals to stay under
100KB — both packages dev-time-only, never runtime dependencies.

### PathfinderEdge (Thalmann DS2801) — Implemented, live

| Env var | For |
|---|---|
| `PATHFINDER_EDGE_API_KEY` | Server-only. **Goes in the `Authorization` header RAW, with no scheme prefix** — not `Bearer <key>`, not `X-API-Key`. |
| `PATHFINDER_EDGE_BASE_URL` | The per-tenant root. |
| `PATHFINDER_EDGE_MACHINE_SERIAL` | Declared in `.env.example`. **No code reads it** — see UNVERIFIED (5). |
| `PATHFINDER_DEBUG_CAPTURE` | `=1` writes each outgoing POST body to `diagnostics/`. Off by default; a write failure here can never block a push. |

Files: `lib/integrations/pathfinder-edge.ts`,
`lib/integrations/flashdraft-to-pathfinder.ts`,
`lib/integrations/pathfinder-response.ts`, and the two allowed callers in
`app/api/admin/command-center/`.

This block in `CLAUDE.md` previously read "no discoverable REST API … wired but
unused". **That was wrong** — a probe had used the wrong auth format. Corrected
2026-09-24 from live evidence: `GET /api/v1/catalogs` returns 200 with real
data. Catalog **20115** ("afs") is the only catalog the machine subscribes to.

**Rule #32 — the vendor API gets a timeout on reads and a parser on every
response, and the POST gets neither timeout nor retry:**

- `PATHFINDER_READ_TIMEOUT_MS` is **8000**, chosen from the 2.46s a live probe
  measured, applied by `pathfinderRead()` through an `AbortController`. Before
  it, a host that accepted the connection and said nothing left a Command
  Center screen rendering forever.
- **The POST to `/api/v1/profiles` deliberately has no timeout.** Aborting a
  write tells you nothing about whether the server committed it, and an
  abandoned-but-committed profile in catalog 20115 is one the physical Thalmann
  will collect that this app has no record of.
- **No read is retried.** The most tempting case is the profile-number lookup
  after a push, where a retry would duplicate a real profile — rule #16's
  `unconfirmed` is the correct answer there, not persistence.
- `lib/integrations/pathfinder-response.ts` **parses** every response instead of
  casting it. `(await res.json()) as T[]` asserts nothing at runtime, so an
  envelope, a renamed field or a 200 carrying an error object all reached a
  component as a crash or as a row rendered "undefined".
  `logVendorShapeProblem()` writes one server line with the endpoint, every
  problem and a truncated copy of the real body — the truncation is what makes
  it diagnosable. A 200 with a wrong body is reported as an error, never as
  "Connected". Do not add a schema library for two documented shapes, and do not
  let a parser throw: a bad shape is a degraded read, not a 500.

**UNVERIFIED (5):** `PATHFINDER_EDGE_MACHINE_SERIAL` is documented in
`.env.example` and `CLAUDE.md` but no `process.env` reference to it exists
anywhere in `app/`, `lib/`, `components/`, `scripts/` or `tests/`. Either it is
vestigial or a future caller is intended; do not assume setting it changes
behaviour.

### AFS Machine Bridge — Implemented (the routes), external project

| Env var | For |
|---|---|
| `AFS_BRIDGE_SECRET` | Shared Bearer secret between this app's `app/api/machine-bridge/*` routes and the bridge's own `.env`. **Must match exactly.** |

Files: `lib/machine-bridge/auth.ts`,
`app/api/machine-bridge/pending-jobs/route.ts`,
`app/api/machine-bridge/job-delivered/route.ts`.

`afs-machine-bridge` is a **separate standalone Node.js project** — its own
`package.json`, its own git repo, not part of this repo. It polls
`machine_jobs` and generates `.ds1` files. Bearer-token auth rather than a
Supabase session, because the bridge is a service, not a logged-in user.
`CURRENT_STATE.md` records it as last audited 2026-07-13: running only on a dev
machine, failing auth (401), zero `.ds1` files generated, and **largely bypassed
in practice** since Command Center approvals default to `pathfinder_edge`
routing. Anyone relying on it should check its own logs, not this line.

### Open-Meteo (HailView wind) — Implemented, gated

| Env var | For |
|---|---|
| `OPEN_METEO_API_KEY` | A commercial Open-Meteo subscription. Not in `.env.example`. |

File: `lib/hailview/wind.ts:57`. Without it, wind speed/direction reports its
own absence by name rather than guessing.

### SAM.gov + state portals (Bid Monitor) — Implemented

| Env var | For |
|---|---|
| `SAM_GOV_API_KEY` | Free; register at api.data.gov. **Falls back to the rate-limited `DEMO_KEY` if unset.** |
| `BID_MONITOR_ALERT_EMAIL` | Primary "New Opportunities" recipient. `steve@architecturalflashingsupply.com` is always CC'd as a second, hardcoded recipient (`lib/data/office.ts`'s `OWNER_EMAIL`). |
| `PLANHUB_API_KEY` | Declared, **wired but unused** — see UNVERIFIED (6). |

Files: `lib/bid-monitor/` (index, alerts, keyword-matcher, html-extract) and
`lib/bid-monitor/sources/` (sam-gov, state-portals, texas-cities, texas-esbd,
txdot, usaspending); `app/api/bid-monitor/*`; migration 010.

**UNVERIFIED (6):** no PlanHub fetcher exists.
`lib/bid-monitor/sources/state-portals.ts:208` and
`components/admin/BidMonitorSourceDirectory.tsx:299` both say so in prose —
`PLANHUB_API_KEY` is declared and nothing reads it.

### Google Business Profile — Stubbed (with a flagged deviation)

| Env var | For |
|---|---|
| `GOOGLE_BUSINESS_CLIENT_ID` | OAuth app credential. |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | OAuth app credential. |
| `GOOGLE_BUSINESS_LOCATION_ID` | The GBP location. |
| `GOOGLE_BUSINESS_ACCESS_TOKEN` | A **manual stand-in** until a real authorization-code exchange exists. |

Files: `lib/integrations/google-business.ts`, `app/api/gbp/post/[id]/route.ts`,
`app/api/gbp/queue/route.ts`, `app/api/admin/gbp/[id]/{approve,reject}/route.ts`,
`app/admin/gbp-photos/page.tsx`.

`isGbpConfigured()` checks CLIENT_ID/SECRET/LOCATION_ID only. The module's own
header flags deviation **d-007**: a CLIENT_ID/SECRET pair is an OAuth *app*
credential, not a bearer access token, so actually calling the v4 Media API
needs a per-request token that only exists once a real OAuth exchange + refresh
flow is built behind `/admin/settings/integrations` — **which is not built**.
`postPhotoToGbp()` checks `GOOGLE_BUSINESS_ACCESS_TOKEN` separately and reports
the gap by name if it is missing.

### QuickBooks Online — Stubbed

No env vars. File: `lib/integrations/quickbooks.ts` — every export
(`connectQuickBooks`, `syncInvoice`, `syncCustomer`, `getConnectionStatus`)
returns a stable `{ status: 'not_configured' }`. Consumed by
`app/api/admin/quickbooks/status/route.ts` and `app/admin/quickbooks/page.tsx`.
`SPEC_QUICKBOOKS_INTEGRATION.md` is a **conditional** build, blocked on client
confirmation of the QBO subscription, sync scope and connection ownership.

### TaxJar — Specified only

| Env var | For |
|---|---|
| `TAXJAR_API_KEY` | Server-only. |

The **only** reference in the codebase is
`app/admin/settings/page.tsx:32` — `Boolean(process.env.TAXJAR_API_KEY)`, used
to render a configured/not-configured chip. There is no TaxJar client, no tax
calculation and no `lib/taxjar/`. `specs/SPEC_TAXJAR_INTEGRATION.md` is the
spec, and `CLAUDE.md`'s DATA BLOCKERS table records that tax nexus states have
not been supplied.

### Metals API (the commodity pricing feed) — Specified only

| Env var | For |
|---|---|
| `METALS_API_KEY` | Server-only. Required to activate the pricing engine. |

The only references are `app/admin/settings/page.tsx:34` and `:67`, which
render *"Missing METALS_API_KEY — pricing engine cannot activate"*. No feed
client exists. `PRICING_ENGINE.md` §9 has the activation checklist;
`commodity_prices` is seeded by nothing.

### Microsoft Graph / Outlook — Specified only, BLOCKED

No env vars in `.env.example`. **No code anywhere.**
`docs/COMMAND_CENTER_V2_SPEC.md` §2.4 records the grep returning zero files,
lists the seven setup steps, and names the variables Phase 4 will need
(`MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_TENANT_ID`), plus
the tables (`outlook_connections`, `email_messages`) and the design constraints
— delegated `Mail.Send` so mail lands in Steve's own Sent Items (Resend cannot
do this at all), change notifications rather than polling, and a renewal job
because Graph mail subscriptions expire in roughly 3 days. See
[§2](#blocked--microsoft-365--microsoft-graph).

### Pickup scheduling

| Env var | For |
|---|---|
| `PICKUP_ALERT_EMAIL` | Notified when a customer schedules a pickup window. Falls back to the office address if unset. |

Files: `app/api/pickup/schedule/route.ts`, `PICKUP_SCHEDULING_SCOPE.md`.

### Quote approval

| Env var | For |
|---|---|
| `QUOTE_APPROVE_SECRET` | Optional. Signs the single-use Approve link. If unset, a **separate** key is derived from `SUPABASE_SERVICE_ROLE_KEY` by HMAC with a fixed label (`lib/pricing/approve-token.ts`) — the derived key cannot be used as the service role, and the service role cannot be recovered from it. Set it to rotate every outstanding link at once. |

### Declared but unused

**UNVERIFIED (7): `CRON_SECRET`.** `.env.example` describes it as the shared
secret authenticating Vercel Cron requests to `app/api` routes. No
`process.env.CRON_SECRET` reference exists anywhere in `app/`, `lib/`,
`components/`, `scripts/` or `tests/`, and `vercel.json` declares no `crons`
array. Either no cron is configured or it is configured outside the repo.

### Test-only variables

Not in `.env.example`, read only by tests and `playwright.config.ts`:
`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` (`tests/e2e/auth.setup.ts` and every
credential-gated spec), `PLAYWRIGHT_BASE_URL` (`playwright.config.ts`),
`HAILVIEW_E2E_BASE_URL` (`tests/e2e/hailview.spec.ts`), `AFS_PRINT_PROOF`
(`tests/e2e/quote-approve-invoice.spec.ts`, `tests/e2e/shop-deliveries.spec.ts`).

---

## 9. Testing

Three independent layers, and all three are gates rather than suggestions.

### Unit tests — Vitest

```powershell
pnpm test:unit        # vitest run
```

`vitest.config.mts` includes **only** `lib/**/*.test.ts`. E2E specs live under
`tests/e2e/**` and run exclusively through Playwright, which has its own
`test()` implementation that conflicts with vitest's if both scan the same
files. The config also aliases `@` to the repo root, mirroring
`tsconfig.json`'s `paths` — **mirror any future change to those paths here**,
or a lib module written with `@/lib/...` imports becomes untestable.

**27 test files** at this commit. `STATE_OF_THE_BUILD.md`'s 2026-10-01 entry
records the last full run as **439/439 across 27 files**.

The ones that are really architecture enforcement, not feature tests:

| File | What it refuses to let you do |
|---|---|
| `lib/integrations/pathfinder-single-door.test.ts` | Call `pushProfileToPathfinder` from any file but the two allowed routes. A **static** walk of `app/ components/ lib/ scripts/ tests/`. |
| `lib/data/rush-explicit-only.test.ts` | Assign `is_rush` outside the four known writers, or add an inference-shaped expression to one. Static. |
| `lib/data/removed-machine-library.test.ts` | Reference the dropped machine-library tables, modules or data folder — and it also asserts `shop_profile_library` and `canonical_profiles` are **still** referenced. Static. |
| `lib/pricing/ledger-append-only.test.ts` | Loosen the append-only ledger. |
| `lib/design/placeholder-contrast.test.ts` | Pick a placeholder colour that fails on the surface it is mounted on. It **computes** every ratio from `tailwind.config.js` rather than trusting a comment, and asserts the *premises* too (the dim-looking tokens really do fail) so a retheme cannot make the rule silently vacuous. |
| `lib/data/admin-nav.test.ts` | Change the nav shape or add a second navigation level without noticing. |

The rest cover geometry (`lib/flashdraft/geometry.test.ts`,
`geometry-fingerprint.test.ts`, `unsaved-work.test.ts`), pricing
(`quote-math`, `price-book`, `approve-token`), the stage ladder
(`job-stage.test.ts`), the Workbench and the lists (`workbench.test.ts`,
`quote-order-list.test.ts` — 32 tests), the shop/delivery ordering split
(`shop-queue.test.ts`, `deliveries.test.ts`, `business-days.test.ts`), the
vendor API (`pathfinder-read-timeout`, `pathfinder-response`,
`flashdraft-to-pathfinder`), confidence (`takeoff-confidence`), hover timing
(`hover-intent`), search (`profile-search`), HailView scoring
(`replacement-score`), the catalog (`catalog`) and follow-up drafting
(`followup-draft`).

### End-to-end — Playwright

```powershell
pnpm test:e2e         # headless
pnpm test:e2e:ui      # UI mode
```

`playwright.config.ts`: `testDir: './tests/e2e'`, 30s timeout, 1 retry, **1
worker**, trace on first retry, `baseURL` from `PLAYWRIGHT_BASE_URL` or
`http://localhost:3000`. Two projects — `setup` (which runs `auth.setup.ts`)
and `chromium` (which depends on it).

The config **loads `.env.local` itself**, without adding a dotenv dependency
and without overriding anything already exported in the shell. Playwright does
not read `.env.local` on its own, so before this was added
`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` written there never reached the setup
project and every credential-gated test reported "skipped".

**Credentials are required and are not in this repo.** `auth.setup.ts`
**skips** (does not throw) when they are unset, because a thrown error in a
`setup` project skips every dependent test — a skip instead lets public/guest
specs still run. Specs that need a session opt in per file with
`test.use({ storageState: 'tests/e2e/.auth/user.json' })`. Admin specs
additionally require the account to have `profiles.role = 'admin'`; a non-admin
gets redirected to `/account` and the spec fails with a real, actionable
assertion rather than a silent pass. Full detail: `tests/e2e/README.md`.

**24 specs**, including: `command-center-v7-nav.spec.ts` and
`phase2-fidelity.spec.ts` (the v7 Phase 2 gates — the fidelity spec opens the
approved v7 HTML off disk beside the live pages at 1440×900 and 1280×800 and
asserts nav order, button label, titles, blurbs, column headers and all three
dropdowns **character-for-character**), `command-center-workbench.spec.ts`,
`command-center-v2-nav.spec.ts`, `contrast-live.spec.ts`,
`flashdraft-regression.spec.ts`, `webgl-fallback.spec.ts`,
`quote-approve-invoice.spec.ts`, `shop-deliveries.spec.ts`,
`profile-search.spec.ts`, `modify-in-flashdraft.spec.ts`,
`production-queue.spec.ts`, `no-configurator.spec.ts`,
`galvalume-rename.spec.ts`, `checkout.spec.ts`, `quote-request.spec.ts`,
`homepage.spec.ts`, `services.spec.ts`, `hailview.spec.ts`. DB helpers:
`tests/e2e/helpers/{db,pricing-db,search-db,shop-db}.ts`.

### The prebuild contrast gate

```powershell
pnpm check:contrast                              # report + exit code
node scripts/audit/contrast-check.mjs --json      # machine-readable
node scripts/audit/contrast-check.mjs --failures  # only the failing pairs
```

It is wired as `prebuild` in `package.json`, so **`pnpm build` runs it and a
Vercel deployment cannot get past it.** Exit 1 on any pair below WCAG AA: 4.5:1
body text and placeholders, 3:1 WCAG-large text and form-field boundaries.
`CLAUDE.md` rule #28.

**Nothing in it is a list anybody maintains.** Each run derives the screens
from `lib/data/admin-nav.ts` plus the `page.tsx` files that really exist under
those routes; the colours from `tailwind.config.js`; and the pairs by walking
each page's JSX and **recursing into the components it renders**, so a colour is
measured against the surface it is really mounted on. Adding a screen or a
component puts it under the gate automatically.

**`0 unresolved` in its output is load-bearing.** A gradient, a non-colour
arbitrary value or a className it cannot read is **counted and printed**, never
skipped, so the gate cannot pass by failing to look. If a change makes that
number rise, the gate got blinder, not the code safer. (A `+` string
concatenation reads as unresolved — that is why
`QuoteOrderList`'s field-class constant is a single string literal.)

Six resolution behaviours are load-bearing and must survive any rewrite, each
because without it the gate reported a defect that cannot render or missed one
that can: cross-file `{children}` (taking the occurrence inside JSX, **not** the
literal `{ children }` in a destructured parameter list); class constants
resolved across modules (`LIGHT_WORKING_AREA_CLASS`); a ternary's arms measured
as alternatives rather than as one mixable set; class maps (`TONES[tone]`)
expanded to their values; `file:`/`before:`/`after:` treated as a nested surface
rather than the element's own; and `/90` opacity composited over what is behind
it.

**Do not add a skip list, and do not relax a threshold to make a screen pass —
fix the colour.**

`tests/e2e/contrast-live.spec.ts` is the other half and must be kept: it
measures the same screens with `getComputedStyle` in a real browser, which is
what stops the static model drifting into fiction. It needs `storageState` like
every other admin spec — without it the admin routes redirect and it measures
the sign-in page while reporting Command Center route names, which is exactly
how the sign-in flow's own failures were found.

### Other audit scripts

```powershell
node scripts/audit/state-of-the-build-report.mjs
node scripts/audit/test-rows-clean.mjs
```

### The planned v7 style gate

**UNVERIFIED (8): there is no v7 style gate in this worktree.** `scripts/` has
no `design/` folder, `package.json` has no style-gate script, and `queue.yaml`
(which in this worktree is the historical 9-phase queue, ids `p0-001` through
`p8-003`) contains no match for "style gate". The v7 colour/style work in
flight at the time of writing is **untracked** in the primary working tree:
`app/styles/`, `docs/design/V7_COLOR_DEVIATIONS.md`,
`docs/design/command-center-v7/` and `scripts/design/` all appear as `??` in
`git status` on `command-center-v7` and are therefore not on any branch and not
in this worktree. Expect a style gate to arrive with that work; it does not
exist yet.

Note also that `CLAUDE.md` records `queue.yaml` as living **outside** the repo
at `FORGE\projects\afs-website\queue.yaml`. The copy committed here is a
historical artefact, not the live queue.

---

## 10. Deploying

### The deploy sequence

`deploy.ps1` at the repo root is a five-step pipeline:

```powershell
.\deploy.ps1                  # full pipeline
.\deploy.ps1 -SkipTests       # skip step 4
.\deploy.ps1 -DryRun          # parameter is declared but not acted on — see below
```

| Step | Command | Fails the run on |
|---|---|---|
| 1 | `pnpm tsc --noEmit` | any TypeScript error |
| 2 | `pnpm run build` | any build error — **including the prebuild contrast gate** |
| 3 | `vercel --prod` | a failed Vercel deployment |
| 4 | `npx playwright test` (unless `-SkipTests`) | any failing spec |
| 5 | `git add .` → `git commit -m "chore: deploy <timestamp>"` → `git push` | a failed push |

Two things to know before running it:

- **`-DryRun` is declared in the `param()` block and never referenced in the
  body.** Passing it does not make the script dry — it will still deploy and
  push. Treat it as unimplemented.
- **Step 5 runs `git add .`**, staging everything in the working tree, and
  commits with a generated timestamp message. On a tree with untracked
  working-session files that is not what you want. The project's own practice,
  visible throughout `git log`, is hand-authored commits with explicit paths.

`CLAUDE.md` rule #9 is explicit: **never run a production deploy from the
working tree.** `main` auto-deploys. Step 3 of `deploy.ps1` is in tension with
that rule; prefer pushing to `main` and letting Vercel build.

### Branch → preview → migrations → merge order

The order this project actually follows, read from `git log`, the governance
entries and `DNS_MIGRATION_CHECKLIST.md`:

1. **Branch from `main`.** The v7 branch records its own cut point explicitly:
   *"cut from `main` at `256eca1`"*.
2. **Build, with `pnpm tsc --noEmit` and `pnpm run build` green locally.** The
   build includes the contrast gate, so a colour regression is caught before
   the push.
3. **Push the branch.** Vercel builds a preview deployment per branch.
4. **Apply migrations before the code that reads them.** Rule #6 — RLS and
   schema land first. And because there is **no migration ledger** (see
   [§7](#applying-migrations)), confirm each one against `information_schema`
   rather than assuming.
5. **Run the E2E suite against the preview**, with `PLAYWRIGHT_BASE_URL` set to
   the preview URL and `storageState` configured. `contrast-live.spec.ts` in
   particular is meaningless without a real deployment to measure.
6. **Merge to `main`**, which auto-deploys to production.
7. **Governance last** (rule #8): the final action of every prompt is updating
   `STATE_OF_THE_BUILD.md` and `SESSION_STATE.md` **from an actual audit of the
   codebase, never from memory** — and, from now on, this README too (see
   [§14](#14-keeping-this-readme-current)).

For a domain cutover, `DNS_MIGRATION_CHECKLIST.md` is the five-step procedure:
update `NEXT_PUBLIC_APP_URL` in Vercel → update Supabase's Auth Site URL and
Redirect URLs → update the Stripe webhook endpoint URL (Stripe issues a new
signing secret only when a *new* endpoint is created, not on a URL edit) →
redeploy so the build picks up the new env value → confirm by actually signing
in, submitting a quote request and receiving a Stripe webhook, not merely by
having configured all three.

### Who owns the accounts

What the docs say, with the uncertainty marked:

**Vercel — stated in `CLAUDE.md` rule #9 and verified there against the live
Vercel API:**

- The canonical environment is `https://afs-website-alpha.vercel.app`, the
  production alias of project `steveharyckis-projects/afs-website`, tracking
  `main`. Verified via `targets.production.alias[0]` with
  `githubCommitRef=main`, and corroborated by `vercel alias ls`. The local
  `.vercel/project.json` is linked to this project.
- A **second** project, `reids-projects-b3405b97/afs-website` (alias
  `afs-website-eight.vercel.app`), has been **disconnected from GitHub — not
  deleted**. `vercel git disconnect` was run against it on 2026-09-29, proven
  live by a push producing a deployment only on the team project. The project,
  its domains and its environment variables all still exist and still serve its
  last build. **Deleting it, and deciding whether to rotate the secrets it still
  holds, remains PENDING REID.**
- Earlier revisions of that rule had these two projects **backwards**. The
  version in `CLAUDE.md` today is the corrected one.
- A caveat worth knowing: **re-running `vercel link` mutates the working
  tree** — it appends `.env*` to `.gitignore` (which would shadow the *tracked*
  `.env.example`) and rewrites `.env.local` with a fresh `VERCEL_OIDC_TOKEN`.
  Check `git status` afterwards and revert the `.gitignore` edit. Do not commit
  it.

**GitHub:** `origin` is
`https://github.com/architectural-flashing-supply/afs-platform.git`, and
`CLAUDE.md` records the repo as private. The team Vercel project reports its Git
link as `github:architectural-flashing-supply/afs-platform (branch main)`.

**UNVERIFIED (9): who owns the Supabase account and project.** No governance
file in this worktree names the Supabase organization, project ref, plan tier or
account owner. `supabase/README.md` and `DNS_MIGRATION_CHECKLIST.md` both say
"the AFS project" and tell you to select it in the dashboard. The project ref is
inferable from the Storage hostname in `next.config.js` but ownership is not
recorded anywhere. Establish this before any handoff.

**UNVERIFIED (10): who owns the Stripe, Resend, Twilio, Google Cloud, Anthropic,
Open-Meteo, SAM.gov and PathfinderEdge accounts.** `.env.example` says where to
*register* for several of them; no file records who holds the current accounts.

**UNVERIFIED (11): the production domain and its registrar.**
`DNS_MIGRATION_CHECKLIST.md` uses `architecturalflashingsupply.com` as its
worked example and `.env.example` uses it as a placeholder, but no file in this
worktree states that the cutover has happened or names a registrar or DNS
provider. The canonical environment named in `CLAUDE.md` is still a
`vercel.app` alias, which suggests it has not.

---

## 11. Governance and conventions

### The governance files, and what each is for

Read in this order. `CLAUDE.md` first, always.

| File | Size | Purpose |
|---|---|---|
| `CLAUDE.md` | 63KB | **The master index and the 32 numbered rules.** Read first on every run. Platform model, business model, tech stack, the machine-integration block, the data blockers. |
| `BLUEPRINT.md` | 37KB | Build phases, directory structure, quality gates, AI rules. |
| `ARCHITECTURE.md` | 91KB | Auth model, data flow, API patterns, RLS strategy, order lifecycle, Storage buckets, and the numbered architecture sections the rules cite (§13 the bend-angle contract, §15 deliveries, §16 profile search, §17 the contrast gate). |
| `SCHEMA.md` | 139KB | Every table with full SQL, RLS policies and indexes. The schema source of truth; the migrations implement it. |
| `DESIGN_TOKENS.md` | 18KB | The gunmetal colour system, typography, the Metal Edge treatment, the Tailwind config contract. |
| `SITEMAP.md` | 22KB | Routes mapped to specs and auth rules. |
| `COMPONENT_MAP.md` | 56KB | Every component, by section. |
| `PRICING_ENGINE.md` | 18KB | The internal pricing system. Admin only. |
| `PRD.md` | 6.7KB | Platform requirements, personas, what this is and is not. |
| `STATE_OF_THE_BUILD.md` | 985KB | **Current build status, newest entry first.** Updated from an actual audit of the codebase, never from memory. The verification standard is stated at the top. |
| `SESSION_STATE.md` | 557KB | The session-to-session handoff log. |
| `CURRENT_STATE.md` | 17KB | A per-subsystem "what's actually true" snapshot. **Dated 2026-09-05 and partly stale** — read it alongside the newer `STATE_OF_THE_BUILD.md` entries. |
| `MASTER_DOCUMENT_REGISTRY.md` | 11KB | Which documents exist and which belong in the FORGE project folder. |
| `MIGRATIONS_STATUS.md` | 36KB | Honest record that migrations 007–010's live status was never queried, and the script to query it. |
| `DNS_MIGRATION_CHECKLIST.md` | 4.5KB | The five-step domain cutover. |
| `specs/SPEC_*.md` (54 files) | | One per feature. Read the relevant spec before building the feature. |
| `docs/COMMAND_CENTER_V2_SPEC.md` | | The V2 Command Center spec, including the Outlook gap and its Phase 4 prerequisites. |
| `docs/COMMAND_CENTER_V7_GAP_AUDIT.md` | | The v7 prototype gap audit, the six-phase plan, the Microsoft-blocked list and eight owner questions. |
| `docs/design/command-center-v2-prototype.html` | | The approved V2 design prototype, measured against by `phase2-fidelity.spec.ts`. |

Also at the root, as point-in-time audits rather than live governance:
`AFS_FIELD_INTEGRATION_TODO.md`, `BID_DOCUMENT_SCOPE.md`, `CADLIB_AUDIT.md`,
`CREDIT_APP_GAPS.md`, `FREIGHT_ESTIMATOR_SCOPE.md`, `GEOMETRY_AUDIT.md`,
`HOMEPAGE_VERIFICATION.md`, `INVOICE_AUDIT.md`, `LIVE_INVENTORY_SCOPE.md`,
`MATERIAL_CALC_SCOPE.md`, `NOTIFICATION_AUDIT.md`,
`ORDER_LIFECYCLE_DECISION.md`, `PICKUP_SCHEDULING_SCOPE.md`,
`PO_INTEGRATION_SCOPE.md`, `PRODUCTION_QUEUE_AUDIT.md`, `RUSH_ORDER_AUDIT.md`,
`SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md`, `SPEC_HAILVIEW.md`,
`TRIM_OPTIMIZER_SCOPE.md`.

### The 32 rules in `CLAUDE.md`, in brief

Read the file for the reasoning — most rules exist because the opposite was
tried and shipped a real defect. **No rule below names a secret value.**

| # | Rule |
|---|---|
| 1 | **No customer-facing pricing.** No dollar amount reaches a customer before an AFS-generated quote in their portal. |
| 2 | **pnpm only.** Never npm, never yarn. |
| 3 | **TypeScript strict, zero `any`.** `pnpm tsc --noEmit` must be 0 before a prompt is complete. |
| 4 | **`afs-*` tokens only.** No default Tailwind colours, no literal hex in JSX. The one sanctioned exception is a documented `CANVAS_COLORS`-style constant for a `<canvas>` 2D context or a third-party iframe (Stripe's `CardElement`) that cannot consume Tailwind classes. A literal hex in a `className`/`style` on a normal DOM element is still a violation. |
| 5 | **No client-side AI calls.** All Anthropic traffic goes through `app/api/`. |
| 6 | **RLS before features.** |
| 7 | **Gates on every prompt** — compile, build, file_exists. |
| 8 | **Governance updated last**, from an actual audit, never from memory. |
| 9 | **One canonical site URL: `getSiteUrl()`.** Never a hardcoded host. Includes the full Vercel project inventory and the `vercel link` working-tree caveat. |
| 10 | **Marketing videos are pre-rendered to their display aspect**, never re-cropped or scaled in CSS. If a video looks cropped, re-encode the source. |
| 11 | **The homepage delivery-area map is a real contiguous-US polygon**, never a radius circle. |
| 12 | **A bend angle is the signed interior angle, and `lib/flashdraft/geometry.ts` is the only place that decides it.** Two documented exceptions. |
| 13 | **Both free endpoints extend, including a hemmed one, and the hem travels with it.** Hems are anchored positionally, never by index. One undo entry. |
| 14 | **ONE DOOR TO THE MACHINE.** A database-verified Command Center approval, two allowed callers, enforced by a static test. |
| 15 | **Rush is never inferred.** Two explicit sources, a Postgres CHECK, a static test, and shop-queues-only pinning. |
| 16 | **A send is never reported successful without the profile number actually returned.** `unconfirmed` is its own outcome, with no retry offered. |
| 17 | **One confidence pattern** — `lib/ai/takeoff-confidence.ts`. Do not write a second. |
| 18 | **Gunmetal header, light working area, converted per screen by the page.** Placeholder text is body text at 4.5:1 with no exemption; `afs-chrome-dim` is never a placeholder colour on gunmetal. 21 files outside the Command Center still do this, **PENDING REID**, not to be swept. |
| 19 | **The price book is versioned and never overwritten, and a blank is never a zero.** Strips per sheet are derived, and an oversize blank fails loudly. |
| 20 | **The pricing ledger is append-only, enforced by Postgres** — a RAISEing trigger *and* RLS with no UPDATE/DELETE policy. The `E2E-TEST-` prefix is the one escape. |
| 21 | **The quote becomes the invoice with no retyping, and the Approve link is not a fifth door.** Outbound email test mode is per message, never a deployment flag. |
| 22 | **The service-role client never reads a cached row** (`cache: 'no-store'`). |
| 23 | **Placeholder contrast is decided by the surface, not by a token name.** `afs-chrome-silver` is right on gunmetal (4.80:1) and wrong on the light card (1.55:1); there the placeholder is `afs-ink-700`. |
| 24 | **A delivery day is a business day in the shop's own time zone**, decided in one file. Weekends skip; holidays are deliberately not modelled. Windows are keys, not labels. |
| 25 | **Customer notification goes through the services that already exist.** One tracking-URL formula. A captured test message gets no `notifications` row. Nothing is reported as sent that was not sent. |
| 26 | **A list view never returns `geometry_svg`, and a polling screen pauses when the tab is hidden.** One lazy thumbnail component. |
| 27 | **One profile search, one panel, and Select saves your work before replacing it.** The enlarged preview has no close button, which is why the hover timing is a tested module. |
| 28 | **Contrast is a build gate, not a review step.** `0 unresolved` is load-bearing; no skip lists; keep the live half. |
| 29 | **A status colour is not a status text colour.** On gunmetal the text gets *lighter* — `afs-*-on-dark`. The danger colour is a salmon and cannot be anything else; that is physics. |
| 30 | **Every section has an error boundary, and it says what did not happen** — "nothing was sent to the machine", "you have not been charged", "your drawing is still saved on this computer". Never blame the user, never show a stack trace. |
| 31 | **A WebGL failure degrades to the 2D view.** `ProfileViewer3D` never leaves an empty panel, and the fallback shares the same three geometry functions. |
| 32 | **The vendor API gets a timeout on reads and a parser on every response — and the POST gets neither timeout nor retry.** |

### The office email rule: `trica@` is correct

**The spelling is `trica@architecturalflashingsupply.com` — with no `i` after
the `r`.** This looks like a typo and is not.

- The address is named **once**, in `lib/data/office.ts`, as
  `OFFICE_INVOICE_EMAIL_DEFAULT`. Everything else calls
  `officeInvoiceEmail()` and never a literal. `INVOICE_OFFICE_EMAIL` overrides
  it; the default is the real address rather than an empty string, so the
  automatic invoice copy works out of the box on every deployment.
- **The history matters, because it has flipped once.** On 2026-09-30, prompt
  `v2-01` ruled that `tricia@` was correct and rewrote **31 occurrences across
  19 files**. **Reid reversed that on 2026-10-01**: `trica@` is the real
  mailbox, and the 2026-09-30 "correction" was the error. Phase 0 of the v7
  build put all 31 back and rewrote the stale prose in `lib/data/office.ts`,
  `docs/COMMAND_CENTER_V2_SPEC.md` and `CLAUDE.md` so none of them still calls
  `trica` a misspelling. Zero `trica→tricia` occurrences remain; the six
  surviving `tricia@` strings in the repo are prose explaining the reversal,
  not addresses.
- The FORGE gates were inverted by this and were repaired — two gates scanned
  for `trica@` and exited 1 on finding it, which after the reversal would have
  failed the whole queue on the **correct** address.
- **Do not "fix" it again without Reid saying so in writing.** The comment in
  `lib/data/office.ts` exists precisely because the obvious-looking spelling is
  the wrong one. It is a live-money address.

**One live inconsistency to be aware of:** `.env.example` still shows
`tricia@architecturalflashingsupply.com` as the inline default for
`BID_MONITOR_ALERT_EMAIL`, `PICKUP_ALERT_EMAIL` and in the `INVOICE_OFFICE_EMAIL`
comment. Those are template defaults in a comment-bearing example file, not the
address the code uses — the code reads `lib/data/office.ts`. If you copy
`.env.example` to `.env.local` verbatim, `INVOICE_OFFICE_EMAIL` stays blank (it
has no value in the template) so the correct `trica@` default applies, but
`BID_MONITOR_ALERT_EMAIL` and `PICKUP_ALERT_EMAIL` would carry the wrong
spelling. Worth reconciling.

The shop owner's address, `steve@architecturalflashingsupply.com`, is also in
`lib/data/office.ts` as `OWNER_EMAIL` and is always CC'd on new-opportunity
alerts.

### The `middleware.ts` rule

**UNVERIFIED (12).** The convention stated in the brief for this README is:
**`middleware.ts` is never patched — any change is a full-file replacement, and
it requires explicit approval.** No governance file in this worktree records
that rule. A full-text search of `CLAUDE.md`, `ARCHITECTURE.md`,
`BLUEPRINT.md`, `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md`,
`MASTER_DOCUMENT_REGISTRY.md` and `queue.yaml` for "never patch", "do not
patch" and "full replacement" alongside middleware returns nothing. Treat it as
a standing instruction from Reid that is **not yet written down** — and write it
into `CLAUDE.md` if it is meant to bind future runs.

What *is* verifiable, and points the same way:

- `ARCHITECTURE.md:316` — **never rely on middleware alone.** Every admin page
  and API route repeats the role check (`lib/admin/auth.ts`,
  `lib/auth/require-operator.ts`).
- `middleware.ts` is a **single point of failure for every request**, including
  public ones: its matcher covers everything except `_next/static`,
  `_next/image`, `favicon.ico` and static image extensions, and the whole
  Supabase-session block runs unconditionally before any route-specific logic.
  Its own comments record that an unguarded throw there returns a 500
  `MIDDLEWARE_INVOCATION_FAILED` for *every* request. Both client constructions
  and the role query are therefore wrapped in try/catch and **fail closed**.
- `git log` shows the project's practice directly: multiple entries note
  *"`middleware.ts` was not touched"* as a deliberate, recorded fact — including
  the HEAD commit, which fixed an admin-access problem by correcting a database
  row and explicitly left the file alone.

A full-file replacement reviewed as a whole is the right way to change a file
with those properties, whether or not the rule is written down. Get approval.

### Other conventions worth knowing

- **Comments carry the reasoning.** Many modules open with a long header
  explaining *why* the code is shaped the way it is, usually naming the defect
  the shape prevents. Read the header before changing the module. Match the
  surrounding comment density.
- **Prefer a pure module in `lib/` plus a unit test** over logic embedded in a
  component or route. `lib/data/job-stage.ts`, `lib/delivery/business-days.ts`,
  `lib/data/quote-order-list.ts` and `lib/ui/hover-intent.ts` all exist in that
  shape so a rule becomes an assertion rather than something only a browser can
  tell you.
- **Decisions are kept as data next to the code.** `UNLINKED_ADMIN_ROUTES`,
  `LIGHT_WORKING_AREA_SCREENS` and `admin-nav.ts`'s comments record *why*
  something is the way it is, so the reason survives in the file rather than
  only in a commit message.
- **A static test is the enforcement mechanism of choice** when a rule is about
  what code may *not* do. Four of them exist. Do not relax one to make a change
  pass.
- **Commit messages are sentences, not conventional-commit prefixes** — "A
  WebGL failure shows the flat drawing, not an empty grey box". Match the style.
- **FORGE launches** go exclusively through
  `C:\Users\manag\Documents\FORGE\forge.ps1 -project afs-website`. The queue
  file location is fixed at `FORGE\projects\afs-website\queue.yaml` — back it up
  with a `.bak-<date>` suffix before replacing. Do not modify `forge.ps1`'s
  output formatting or launch interface without an explicit instruction from
  Reid recorded in the FORGE README.

---

## 12. Known issues and open decisions

### Open decisions — PENDING REID

These are recorded in governance as explicitly undecided. Do not resolve one by
picking a side in code.

1. **Is an admin approval enough to send work to the machine?** (rule #14.) A
   profile reaches the Thalmann the moment an admin clicks "Approve & Send to
   Machine"; there is **no customer-acceptance step between quote and machine**.
   The flagged open question in the rule itself.
2. **When should the invoice be created — at customer approval (live today) or
   at shop-finish (v7)?** These bill differently if a change or addendum lands
   in between. The live behaviour was deliberate (rule #21). Changing it is a
   money decision, not a UI one. (V7 audit §d #2.)
3. **Does the office "pending approval" step gate anything?** In v7 the estimate
   copy moves pending → approved but nothing waits on it. Advisory, or must a
   quote not reach the customer until it is approved internally? (§d #3.)
4. **Addendum pricing authority** — can an addendum's unit price be set freely,
   or must it come from the price book (rule #19, which refuses a quote built on
   an unset price)? (§d #4.)
5. **Change order after the machine has started but before bending** — v7
   splits at "before the machine"; the real boundary in the live system is the
   single-door approval. Which moment is the cutover in the shop's eyes?
   (§d #5.)
6. **Deliveries map data** — v7 uses hardcoded demo coordinates. Real stops need
   geocoding. Is there an existing address source, and is a geocoding call
   acceptable, or should the map stay schematic? Rule #11's precedent is a
   static local GeoJSON with **no runtime dependency** — do not introduce a paid
   tile or geocoding dependency without sign-off. (§d #6.)
7. **Should Customers be top-level nav (v7) or stay under More (live)?** And
   should Credit Applications / Bid Monitor, which v7 has no equivalent for,
   remain under More? (§d #7.) — *partly acted on already: v7 Phase 2 put
   Customers top-level.*
8. **Is `/admin/pricing` meant to be Steve-facing?** It is in the nav with
   `adminOnly: true`. Customers must never see pricing (rule #1); confirm
   admin-only by intent. (§d #8.)
9. **The 21 remaining `afs-chrome-dim` placeholder files** outside the Command
   Center and sign-in flow (rule #18). Listed in `STATE_OF_THE_BUILD.md`'s
   v2-02 re-verification entry. **Not to be swept without Reid's say.**
10. **Deleting the stray Vercel project** `reids-projects-b3405b97/afs-website`,
    and whether to rotate the secrets it still holds (rule #9).
11. **The Bid Monitor decision** — whether chasing public bids is work AFS wants
    (`SESSION_STATE.md`).
12. **v7 chrome that cannot be matched without breaking a stated rule**
    (`STATE_OF_THE_BUILD.md` 2026-10-01): v7's near-black gradient header with a
    3px red underline needs new colours the design rules forbid; v7's uppercase
    brand with "CENTER" in red and its bordered nav pill with a blue active chip
    measure about **1.7:1** on that surface and would fail the contrast gate.
    Matching v7 exactly and keeping the gate green are mutually exclusive.
    PENDING REID.
13. **A multi-item quote-request approval creates N separate `machine_jobs`
    rows / N separate Command Center cards**, all sharing one request number,
    with no visual grouping (`CURRENT_STATE.md`). Flagged as an undecided
    product question, not a bug.

### Known issues

0. **🔴 LIVE CREDENTIALS ARE COMMITTED TO THIS REPOSITORY. Rotate them.**
   Found and verified during this README pass, 2026-10-02. This is the highest
   priority item on this page and it is not a style problem.

   `.env.local.backup` and `.env.local.new` are **tracked by git** — not merely
   present in a working tree. `git ls-files` lists both, they were added in
   commit `471629f` ("fix: correct type predicate for Supabase materials joined
   relation array shape"), and `git ls-tree -r origin/main` and
   `git ls-tree -r origin/command-center-v7` both contain them, so they have
   been **pushed to the GitHub remote** and are in the history of every clone.

   `.env.local.backup` holds **18 populated values**, including (by NAME only)
   `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
   `PATHFINDER_EDGE_API_KEY`, `AFS_BRIDGE_SECRET`, `GOOGLE_MAPS_API_KEY`,
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `NEXT_PUBLIC_SUPABASE_URL`, plus two `THALMANN_*` variables that appear in
   no other file in the repo. `.env.local.new` holds a populated
   `VERCEL_OIDC_TOKEN`. **No value is reproduced in this README, and none
   should be.**

   The service-role key is the one that matters most: it bypasses RLS on every
   table, and — per `lib/pricing/approve-token.ts` — the Approve-link signing
   key is derived from it by HMAC whenever `QUOTE_APPROVE_SECRET` is unset,
   which it is.

   **Why `.gitignore` did not stop this:** `.gitignore` line 40 *does* list
   `.env.local.backup`. A `.gitignore` entry has no effect on a file that is
   already tracked. `.vercelignore` also lists it, which keeps it out of deploy
   uploads — but git, not Vercel, is the exposure here.

   **Remediation, in this order** — and none of it was done in this pass,
   because this run was scoped to documentation only:
   1. **Rotate every credential in both files**, at the provider. Treat them as
      disclosed. Note that rotating `SUPABASE_SERVICE_ROLE_KEY` also invalidates
      every outstanding Approve link unless `QUOTE_APPROVE_SECRET` is set
      explicitly first.
   2. `git rm --cached .env.local.backup .env.local.new` and commit, so they
      stop being tracked going forward.
   3. Decide whether to purge them from history. They are reachable in every
      existing clone and in the GitHub remote regardless, which is why step 1
      is the one that actually closes the exposure.
   4. Check the **stray Vercel project's** environment variables too (see
      [§10](#who-owns-the-accounts)) — it still holds whatever it was given.

1. **PathfinderEdge bend angles are not trustworthy for any non-90° profile.**
   `CURRENT_STATE.md` is blunt: the formula is on its **fourth revision** and
   the status is explicitly **OPEN/PARKED**. The 4-case verification matrix
   (sharp V, W-profile, near-90° regression, hairpin/hem-adjacent) that Reid was
   to run himself **has never been run**. A prior formula was shipped,
   "confirmed", and later found to render self-intersecting geometry on the real
   machine — which is why nothing here should be assumed correct without that
   matrix.
2. **`hemDirection`'s inside/outside → PathfinderEdge Positive/Negative mapping
   is an unconfirmed arbitrary choice** (`CURRENT_STATE.md`).
3. **A real blank-width discrepancy is unreconciled** — FlashDraft displayed
   33 ¼″ where PathfinderEdge independently recomputed 34 ⅜″ on one real pushed
   profile. Flagged as a genuine open question.
4. **No migration ledger on the live database.** Any migration's live status
   must be re-verified via `information_schema`. `MIGRATIONS_STATUS.md` exists
   because 007–010 were never actually queried. See [§7](#applying-migrations).
5. **`/admin/consultations` 404s.** It is (or was) a left-nav item with no
   `app/admin/consultations/` directory. Re-verified absent in this session.
   Pre-existing, not a regression. *(It is not in today's
   `lib/data/admin-nav.ts`, so the dead link may already be gone — the missing
   route is not.)*
6. **Four `shop_profile_library` columns are displayed but never populated** —
   `hem_instructions`, `painted_edge`, `special_instructions`, `order_number`.
   Flagged since afs-sv-010; every existing row shows "—".
7. **The 20 FlashDraft template shapes are placeholder geometry**, not real
   fabrication dimensions. Swapping in real ones is a pure data change to
   `PROFILE_TEMPLATES` once reference images arrive.
8. **The PAC-CLAD Anodized Aluminum colour chart is 9 placeholder colours**
   pixel-sampled from a PDF (`pacclad_anodized` in `lib/data/metal-colors.ts`),
   awaiting the real vector chart.
9. **The site-wide chat-widget trigger overlaps FlashDraft's mobile "Load"
   button** at a 375px viewport (afs-fl-027). Needs a design decision, not
   another resize.
10. **The magic-link role redirect has never been click-tested end to end.**
    Supabase's admin `generate_link` returns an implicit-flow link, not the PKCE
    link a real browser produces, so `exchangeCodeForSession` was never
    exercised. Needs a real inbox.
11. **`lib/pricing/approve-token.test.ts > rejects a single flipped character in
    the signature` is flaky by construction.** It flips the token's last
    base64url character, which encodes fewer than six significant bits, so for
    some randomly-signed tokens `'A' → 'B'` changes no decoded byte and the
    signature stays valid. The signing code is not implicated. Reported, not
    patched.
12. **`deploy.ps1 -DryRun` does nothing** and step 5 runs `git add .`. See
    [§10](#the-deploy-sequence).
13. **No `types/database.types.ts`.** The generated-types step in
    `supabase/README.md` has never been run; row shapes are hand-declared.
14. **`supabase/README.md` is stale** — it lists files only up to 013 and its
    claims about which migrations are applied predate the features that depend
    on them.
15. **`CURRENT_STATE.md` is dated 2026-09-05 and partly stale** — it refers to
    `/admin/building-codes`, which migration 033 moved to the public Resources
    menu.
16. **A stray file is committed:** `app/app/profile-passport/page - Copy.tsx`.
    It is inside `tsconfig.json`'s `include` and is not a route (the space and
    "Copy" make it inert as a segment), but it should not be in the tree.
17. **Root-level clutter is committed:** ~40 PNG/JPG audit screenshots
    (`hem-audit-*`, `proof-*`), three `*-current.txt` scratch dumps, a
    historical `queue.yaml`, and the two env backups — which are **not** merely
    clutter; see item 0 above.
18. **`components/track/DeliveryTrackingMap.tsx:356`** still carries
    `// TODO: Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local`.
19. **`specs/` has two duplicate spec files** — `SPEC_PRICING_ADMIN (1).md` and
    `SPEC_PRICING_ADMIN (2).md` beside `SPEC_PRICING_ADMIN.md`.
20. **Three env vars are declared and unread:** `CRON_SECRET`,
    `PATHFINDER_EDGE_MACHINE_SERIAL`, `PLANHUB_API_KEY`.
21. **Nothing creates `machine_jobs` rows automatically** from real customer
    quote requests, per `supabase/README.md`'s own note on migration 005. The
    Command Center approval path writes them; the "Pending Approval" tab is not
    auto-populated from intake.
22. **The field/PWA flows have never been tested on a real device.** Three PWA
    install sets and two mobile flows exist; `CURRENT_STATE.md` calls a real
    Android/iOS check "the single gate" for DONE, and it has not happened.
23. **Reid has not personally confirmed most of the app.** Nearly every
    subsystem in `CURRENT_STATE.md` is **IMPLEMENTED, UNCONFIRMED**. That is a
    status, not a defect — but it means "it's built" and "it's right" are not
    the same claim anywhere in this project.

### Data blockers

`CLAUDE.md`'s DATA BLOCKERS table. Features depending on these are built with
correct architecture and explicit placeholder behaviour — not skipped. When the
data arrives it populates the existing structure.

| Data needed | Blocks |
|---|---|
| Product catalog — profiles, materials, gauges | Catalog content, configurator dropdowns, **the Products page track** |
| Pricing rules and cost basis | Pricing engine activation |
| Supplier price history | Trend projection accuracy |
| Production stage names (shop language) | Timeline labels, notification triggers |
| AFS address, phone, hours | Contact page, freight origin, email footer |
| Tax nexus states | TaxJar configuration |
| Carrier / freight method | Freight calculation |
| Industry certifications | Trust badges, spec language |
| Logo vector file (SVG) | Asset quality — a PNG is in use as fallback |
| Photography | Product and gallery images |
| Privacy Policy | **Legal — launch blocker** |
| *(plus)* A Texas holiday calendar | Holidays in `lib/delivery/business-days.ts` — deliberately not modelled without one |

Also unseeded, per `supabase/README.md`: `pricing_rules`, `commodity_prices`,
`finishes`, `products`, `accessories` / `product_accessories`,
`cad_library_files`, `spec_templates`.

---

## 13. Handoff checklist for a new developer or buyer

Names only. **Do not record a credential value in this file, in any committed
file, or in a ticket.** Transfer secrets through a password manager or the
provider's own ownership-transfer flow.

### Accounts and services to inventory

| Service | What to confirm | Verified here? |
|---|---|---|
| **GitHub** | Org `architectural-flashing-supply`, repo `afs-platform`, private. Admin access, branch protection, who the collaborators are. | Remote URL verified; **UNVERIFIED (15)** for org ownership and admins |
| **Vercel — team project** | `steveharyckis-projects/afs-website`. Production alias `afs-website-alpha.vercel.app`, tracking `main`. Env vars per environment, team members, Git link. | Verified in `CLAUDE.md` rule #9 from live API output |
| **Vercel — stray project** | `reids-projects-b3405b97/afs-website`, alias `afs-website-eight.vercel.app`. **Disconnected from GitHub, not deleted.** Still holds domains and env vars, still serves its last build. Decide: delete, and rotate whatever secrets it holds. | Verified in rule #9; the decision is PENDING REID |
| **Supabase** | Organization, project, plan tier, project ref, Auth settings (Site URL, Redirect URLs), Storage global file-size limit, the four buckets and their limits, service-role key custody. | **UNVERIFIED (9)** — ownership recorded nowhere |
| **Stripe** | Account, mode (test vs live), the webhook endpoint pointing at `/api/webhooks/stripe`, and its signing secret. | **UNVERIFIED (10)** |
| **Resend** | Account, verified sending domain, the `RESEND_FROM_EMAIL` sender. Note: governance records Resend as currently **unconfigured on the deployment**. | **UNVERIFIED (10)** |
| **Twilio** | Account SID, the sending number, messaging compliance. | **UNVERIFIED (10)** |
| **Google Cloud** | The project behind both Maps keys; API restrictions (Places/Maps JS for the public key, Geocoding for the server key) and referrer restrictions. | **UNVERIFIED (10)** |
| **Google Business Profile** | The OAuth app (client id/secret) and the location id. A real authorization-code + refresh flow is **not built**. | Stub verified in code |
| **Anthropic** | API account and key custody. Model in use: `claude-sonnet-4-6`. | **UNVERIFIED (10)** |
| **PathfinderEdge** | Vendor account, the per-tenant base URL, the raw API key, and **catalog 20115 ("afs")** — the only catalog the Thalmann DS2801 (serial P0700707) subscribes to. | Integration verified live 2026-09-24 |
| **`afs-machine-bridge`** | **A separate git repo and project.** Its own `package.json` and `.env`, with `AFS_BRIDGE_SECRET` matching this app's. Last audited 2026-07-13: dev-machine only, failing auth. Get the repo. | Verified as external |
| **Old Thalmann archive** | `C:\Users\manag\Documents\afs-assets\old-machine-files\` — the **only** copies of the old DS2801's database (`ds2801db.bdb`) plus `.ds1` samples and JSON/restore-SQL dumps. Outside the repo, verified byte-for-byte. **Do not delete.** Contains real customer, hospital and project names. | Verified in `CLAUDE.md` / `supabase/README.md` |
| **Microsoft 365 / Entra** | Tenant, the (not yet created) Entra app registration, delegated Graph mail permissions and admin consent. **Blocked.** | Verified as blocked |
| **Open-Meteo** | A commercial subscription is required for HailView wind. | **UNVERIFIED (10)** |
| **SAM.gov (api.data.gov)** | A free key registered to the AFS email; currently may be falling back to the rate-limited `DEMO_KEY`. | Verified in `.env.example` |
| **PlanHub** | Account; no fetcher is built. | Verified as unbuilt |
| **TaxJar** | Account; only a presence check exists in code. | Verified as spec-only |
| **Metals API** | Account; required to activate the pricing engine. No feed client exists. | Verified as spec-only |
| **QuickBooks Online** | Subscription, sync scope and connection ownership — all three are what the integration is blocked on. | Verified as stubbed |

### Credentials to transfer (by NAME — never a value)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
`TAXJAR_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_API_KEY`,
`METALS_API_KEY`, `PATHFINDER_EDGE_API_KEY`, `PATHFINDER_EDGE_BASE_URL`,
`PATHFINDER_EDGE_MACHINE_SERIAL`, `AFS_BRIDGE_SECRET`,
`GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET`,
`GOOGLE_BUSINESS_LOCATION_ID`, `GOOGLE_BUSINESS_ACCESS_TOKEN`,
`SAM_GOV_API_KEY`, `PLANHUB_API_KEY`, `OPEN_METEO_API_KEY`, `CRON_SECRET`,
`QUOTE_APPROVE_SECRET`, `INVOICE_OFFICE_EMAIL`, `BID_MONITOR_ALERT_EMAIL`,
`PICKUP_ALERT_EMAIL`, `NEXT_PUBLIC_APP_URL`, plus `E2E_TEST_EMAIL` /
`E2E_TEST_PASSWORD` for the test account.

**Rotate these before anything else, regardless of handover, because they are
already committed to the repository and pushed to GitHub** — see
[§12 known issue 0](#known-issues): `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `PATHFINDER_EDGE_API_KEY`,
`AFS_BRIDGE_SECRET`, `GOOGLE_MAPS_API_KEY`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the
`VERCEL_OIDC_TOKEN` in `.env.local.new`.

Rotate on handover, at minimum: `SUPABASE_SERVICE_ROLE_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`,
`RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`, `PATHFINDER_EDGE_API_KEY`,
`AFS_BRIDGE_SECRET`. Note that rotating `SUPABASE_SERVICE_ROLE_KEY` also
rotates every outstanding Approve link **unless** `QUOTE_APPROVE_SECRET` is set
explicitly, because the signing key is derived from it by default
(`lib/pricing/approve-token.ts`).

Also audit: the **stray Vercel project's** environment variables, which still
exist and may hold live copies of several of the above.

### Domains, DNS and email

- **Target domain:** `architecturalflashingsupply.com` appears throughout as the
  intended live domain, in `DNS_MIGRATION_CHECKLIST.md`'s worked example and in
  `.env.example`'s placeholders. **UNVERIFIED (11):** no file states that the
  cutover has happened, and no registrar or DNS provider is named anywhere. The
  canonical environment in `CLAUDE.md` is still a `vercel.app` alias.
- **Current URLs:** `afs-website-alpha.vercel.app` (production alias, tracks
  `main`), `afs-website-git-main-steveharyckis-projects.vercel.app` (same source
  deployment), `afs-website-eight.vercel.app` (the stray project — still
  resolving, no longer building this repo).
- **The cutover is config-only.** `DNS_MIGRATION_CHECKLIST.md` records a
  verified full-repo search finding zero hardcoded deployment hostnames in
  application code. Three dashboard changes plus a redeploy: Vercel
  `NEXT_PUBLIC_APP_URL`, Supabase Auth Site URL + Redirect URLs, Stripe webhook
  endpoint URL. Then confirm by actually signing in, submitting a quote request
  and receiving a webhook.
- **Email domain:** `architecturalflashingsupply.com` mailboxes. Named in code:
  `trica@` (the office, `lib/data/office.ts` — see
  [§11](#the-office-email-rule-trica-is-correct)) and `steve@` (the owner,
  `OWNER_EMAIL`). Transfer: the Resend verified sending domain and its DNS
  records (SPF/DKIM/DMARC), plus the Microsoft 365 tenant that owns the
  mailboxes — the same tenant separation that blocks Graph. **UNVERIFIED (13):**
  no file in this worktree records the current mail provider, DNS records, or
  the mailbox list.
- **Legal:** the **Privacy Policy is a launch blocker** per `CLAUDE.md`'s DATA
  BLOCKERS table. `app/(public)/legal/privacy/page.tsx` exists as a route;
  whether it holds real reviewed policy text is **UNVERIFIED (14)** — the page
  was not read in this session.

### First-week orientation for a new developer

1. Read `CLAUDE.md` end to end. All 32 rules. It is long and it is the job.
2. Read the newest three entries of `STATE_OF_THE_BUILD.md` and the current
   handoff in `SESSION_STATE.md`.
3. Read `docs/COMMAND_CENTER_V7_GAP_AUDIT.md` — it is the current work plan.
4. Get `.env.local` working, run `pnpm dev`, sign in, set your own
   `profiles.role` to `'admin'`, and open `/admin/command-center`.
5. Run all three gates: `pnpm test:unit`, `pnpm check:contrast`,
   `pnpm tsc --noEmit`. Get them green before you change anything.
6. Read `lib/data/job-stage.ts`, `lib/integrations/pathfinder-edge.ts` and
   `lib/pricing/quote-math.ts`. Those three files are the business.
7. Before touching anything near the machine, read rule #14 and
   `lib/integrations/pathfinder-single-door.test.ts`. The next button along
   reaches a physical bending machine.

---

## 14. Keeping this README current

**README.md is a living document.** The rule, which is also now recorded in
`CLAUDE.md` under *"README is a living document"*:

1. **README.md is updated in the SAME COMMIT** as any change to setup steps,
   routes, environment variable NAMES, migrations, integrations, the deploy
   process or the folder map. Not a follow-up commit, not a later cleanup pass —
   the same commit, so the README can never describe a tree that no longer
   exists.
2. **The governance step of every Claude Code prompt includes: "update
   README.md sections affected by this run and refresh the Last verified
   line."** This sits alongside `CLAUDE.md` rule #8's existing requirement to
   update `STATE_OF_THE_BUILD.md` and `SESSION_STATE.md` from an actual audit of
   the codebase, never from memory. The same standard applies here: verify
   against the files, do not write from recollection.
3. **README.md must never contain a secret value.** Environment variables appear
   by NAME only, with what each is for and which file reads it. No keys, no
   tokens, no passwords, no connection strings, no URLs containing credentials.

Refresh the **Last verified against commit** line at the top on every pass, with
the commit hash the README was actually checked against and the date it was
checked.

### The 15 UNVERIFIED markers in this README

Every one is something the brief or a governance file asserts that could not be
confirmed from a file in this worktree at commit `22223bb`. Resolve them by
finding the evidence, then delete the marker.

| # | Section | What is unverified |
|---|---|---|
| 1 | §2 | The framing "Products 3D previews are on hold". `SESSION_STATE.md` says the Products track is blocked on catalog data; the work sits unmerged on `products-page`. No file records "on hold" as a decision. |
| 2 | §3 | Required Node and pnpm versions. No `engines`, no `packageManager`, no `.nvmrc`. Node 20 / pnpm 9 is observed, not documented. |
| 3 | §5 | Supabase's live global Storage file-size limit. `ARCHITECTURE.md` says the dashboard was never checked, and two bucket limits are impossible on the free plan. |
| 4 | §7 | **Which migrations are applied to the live database.** There is no migration ledger. `MIGRATIONS_STATUS.md` exists to say 007–010 were never queried. The most consequential marker here. |
| 5 | §8 | `PATHFINDER_EDGE_MACHINE_SERIAL` — documented, no code reads it. |
| 6 | §8 | `PLANHUB_API_KEY` — declared, no fetcher exists; two source comments say so. |
| 7 | §8 | `CRON_SECRET` — declared, no reader, and `vercel.json` has no `crons` array. |
| 8 | §9 | The planned v7 style gate. Not present; the v7 style work is untracked on the primary working tree and on no branch. |
| 9 | §10, §13 | Who owns the Supabase account and project. Recorded nowhere. |
| 10 | §10, §13 | Who owns Stripe, Resend, Twilio, Google Cloud, Anthropic, Open-Meteo, SAM.gov, PathfinderEdge. |
| 11 | §10, §13 | The production domain, whether the cutover happened, and the registrar / DNS provider. |
| 12 | §11 | **The `middleware.ts` rule** (never patch, full replacement, explicit approval). Stated in the brief; not in any governance file. Write it into `CLAUDE.md` if it is meant to bind. |
| 13 | §13 | The mail provider, DNS mail records (SPF/DKIM/DMARC) and the mailbox list. |
| 14 | §13 | Whether `app/(public)/legal/privacy/page.tsx` holds real reviewed policy text. The route exists; the page was not read. |
| 15 | §13 | Who owns the GitHub org `architectural-flashing-supply`, who its admins are, and whether branch protection is configured. The remote URL is verified; ownership is not recorded in any file. |

---

*README.md · AFS — Architectural Flashing Supply · verified against
`22223bb56f0b928f4df6ba91b2e0cb49c0c825bd` on 2026-10-02 · written on branch
`docs/readme` from a read-only worktree. No application code was changed.*
