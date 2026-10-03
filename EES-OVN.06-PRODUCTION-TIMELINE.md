# EES-OVN.06-PRODUCTION-TIMELINE

## 1. IDENTITY

| Field | Value |
|---|---|
| Prompt ID | EES-OVN.06 |
| Prompt Name | Production Timeline — shared component, three variants, config-driven stage labels |
| Queue item | `06-production-timeline` |
| Source spec | `specs/SPEC_PRODUCTION_TIMELINE.md` |
| Branch | `ovn/06-production-timeline` (git worktree of `C:\Users\manag\Documents\afs-website`) |
| Date | 2026-10-03 |
| Run type | Unattended overnight. No human available. Every judgement call is recorded in §13 and in the FINAL REPORT. |

---

## 2. OBJECTIVE

Make `ProductionTimeline` the one shared production-status component the spec
says it is — rendered on **three** real surfaces with three real variants —
without touching the Command Center v7 screens or the Production Queue, and
with every stage label driven from a single config module so that when
checklist #39 (shop manager's exact stage language) lands, renaming is a
one-file edit.

Three things make this item non-trivial and they are the whole of the work:

1. The component exists and is good, but it has **one** caller and **no**
   `variant` prop — the `admin` and `public` branches were deleted in an
   earlier pass precisely because they were dead code
   (`PRODUCTION_QUEUE_AUDIT.md` §2b, recorded as the as-built decision in
   `specs/SPEC_PRODUCTION_TIMELINE.md` §9). Re-adding variants is only
   defensible if each one gets a **real** call site in the same commit.
   Dead-code variants are what the audit condemned; this item must not
   recreate them.
2. Wiring the component onto `/admin/orders/[id]` puts it **under the WCAG
   build gate** (`scripts/audit/contrast-check.mjs`, CLAUDE.md rule #28 —
   verified: that route is one of the gate's 24 screens today, 17 pairs). The
   component currently paints `afs-chrome-dim` text and `afs-crimson` text on
   gunmetal, which measure **2.88:1** and ~2.3:1 — rules #18 and #29. Those
   colours must be corrected or `pnpm build` cannot pass.
3. The spec's "public tracker" and the repository's public tracker are not the
   same artefact. `SITEMAP.md:250` says `/track/[id]` is **"Email verify"**;
   what was actually built at `app/track/[orderId]/page.tsx` is a token-based
   full-screen live delivery map, and the email-verify endpoint that SITEMAP
   describes — `app/api/track/verify/route.ts` — **exists, is complete, and has
   zero callers**. The public variant's correct home is therefore a new page
   consuming that orphaned endpoint, not a rewrite of the working map.

---

## 3. ENGINEERING CONTEXT

### 3.1 Current state — verified by inspection, not assumed

| Artefact | Path | State |
|---|---|---|
| Stage config | `lib/admin/orderStages.ts` | REAL. 9 stages, keys in production order, `label` / `adminLabel` / `description`, plus `POST_PRODUCTION_STATUSES`, `NOTIFICATION_STAGES`, `stageIndex`, `getNextStage`, `isBackwardMove`, `STATUS_LABEL`, `STATUS_VARIANT`. Already the single source of truth. |
| Timeline component | `components/account/ProductionTimeline.tsx` | REAL, customer-only. No `variant` prop. No loading / error state. No list or progress semantics (plain `<div>`s). |
| Customer surface | `app/account/orders/[id]/page.tsx:255-290` | REAL and complete — signs `shop_photo_url` (audit §2c fixed), passes `estimatedShipDate` (audit §2e fixed). |
| Admin surface | `app/admin/orders/[id]/page.tsx` | REAL. Renders `StatusAdvancer` (edit) + a **hand-rolled** "Status History" `<ul>` (lines 287-310) that lists status + note + changed-by + timestamp. Does **not** render `ProductionTimeline`. Gunmetal, NOT a v7 Command Center screen. |
| Public map | `app/track/[orderId]/page.tsx` | REAL, token-based, `fixed inset-0` full-screen `DeliveryTrackingMap`. Its own duplicated `STATUS_LABEL` / `STATUS_VARIANT` / `STATUS_MESSAGE` maps. Does not render `ProductionTimeline`. |
| Email-verify endpoint | `app/api/track/verify/route.ts` | REAL and complete — rate-limited (10/hr/IP), order-number + email match, returns `status`, `statusHistory`, `deliveryScheduledAt`, `trackingNumber`, `carrier`, **signed** `shopPhotoUrl`. **ZERO CALLERS** (grepped `app/ components/ lib/ tests/`). |
| Footer "Track an Order" | `components/layout/Footer.tsx:50` | Points at `/account/orders`, which requires a session — an anonymous visitor following a public footer link labelled "Track an Order" is bounced to `/login`. |
| E2E | `tests/e2e/production-queue.spec.ts` | REAL, 4 tests, admin-credential gated. No timeline-specific spec. |
| Unit test harness | `vitest.config.mts` | `include: ['lib/**/*.test.ts']` only. **No component test capability** — no jsdom, no testing-library, `tsconfig` `jsx: "preserve"`. |

### 3.2 Governing rules that constrain this work

- **CLAUDE.md #4** — `afs-*` tokens only. No literal hex in JSX. No
  `bg-[var(--…)]` arbitrary values (they also break #28, see below).
- **CLAUDE.md #18 / #23** — placeholder and body text contrast by surface;
  `afs-chrome-dim` is never a text colour on gunmetal. The 21 remaining
  `afs-chrome-dim` files are **PENDING REID and must not be swept**; only files
  the build gate actually covers get fixed, and the override gets recorded —
  the precedent is v2-06's `AuthShell`.
- **CLAUDE.md #28** — `scripts/audit/contrast-check.mjs` runs as `prebuild`.
  It walks `lib/data/admin-nav.ts` routes plus every `page.tsx` beneath them and
  **recurses into the components those pages render**. `0 unresolved` is
  load-bearing: an arbitrary colour value raises the unresolved count, which the
  rule defines as the gate getting blinder. Never relax a threshold.
- **CLAUDE.md #29** — `afs-crimson` / `afs-success` / `afs-warning` / `afs-info`
  are FILL colours. As text on gunmetal use the `afs-*-on-dark` family.
- **CLAUDE.md #30** — error wording: never blame the user, no stack trace,
  always say what did **not** happen.
- **CLAUDE.md #33 / #34** — the Command Center v7 screens are frozen under a
  whole-screen pixel gate. Nothing in this item may change them.
- **Item instruction** — "the Command Center v7 screens and the Production
  Queue must not change visually."
- **RFQ model** — no customer-facing price anywhere on these surfaces.

### 3.3 Discrepancies found and how each is resolved (LAW 3 / S27)

| # | Discrepancy | Resolution |
|---|---|---|
| D1 | Item says "build three variants per the spec"; spec §9 says the `admin`/`public` variants **were deliberately removed** as dead code. | Both are right about their own moment. The variants are rebuilt **and each gets a real call site in the same commit**, which removes the only reason §9 gave for deleting them. §9 is rewritten as as-built, citing this EES. |
| D2 | Item names config fields `customerLabel, adminLabel, description`; the repo field is `label`. | Rename `label` → `customerLabel` in `lib/admin/orderStages.ts`. Blast radius verified as exactly **two** read sites (`ProductionTimeline.tsx:23`, `app/api/admin/orders/[id]/status/route.ts:101`). Values unchanged, so zero visual/behavioural change. |
| D3 | `SITEMAP.md:250` documents `/track/[id]` as "Email verify"; the built page is a token map, and the email-verify endpoint has no caller. | Build the public variant as a **new** page on the orphaned endpoint. Do not alter the working map. SITEMAP updated. |
| D4 | `in_production` maps to stage `ready` in `ProductionTimeline` but to stage `qc` in `lib/data/command-center-dashboard.ts:268`. The two disagree. | **Do not unify.** The dashboard feeds a frozen v7 screen; changing its mapping changes a displayed percentage. Timeline keeps its own mapping (spec §10 states it explicitly). Recorded UNRESOLVED for Reid. |
| D5 | `AppChrome.tsx:10` strips NavBar/Footer for every path under `/track`, so a lookup page at `/track/lookup` would render chrome-less. | Put the public page at **`/order-status`**, which gets normal public chrome, and avoid editing shared layout logic. |
| D6 | `components/account/ProductionTimeline.tsx` uses `bg-[var(--afs-crimson-ghost)]`, which `contrast-check.mjs:798` counts as **unresolved**. | Replace with real tokens as part of bringing the component under the gate. |

---

## 4. REQUIRED REPOSITORY INSPECTION — what was actually read

Read in full: `CLAUDE.md`, `specs/SPEC_PRODUCTION_TIMELINE.md`,
`PRODUCTION_QUEUE_AUDIT.md`, `lib/admin/orderStages.ts`,
`components/account/ProductionTimeline.tsx`, `app/account/orders/[id]/page.tsx`,
`app/admin/orders/[id]/page.tsx`, `app/track/[orderId]/page.tsx`,
`app/track/page.tsx`, `app/api/track/[token]/route.ts`,
`app/api/track/verify/route.ts`, `tests/e2e/production-queue.spec.ts`,
`tests/e2e/README.md`, `playwright.config.ts`, `vitest.config.mts`,
`package.json`, `tsconfig.json`, `components/ui/Input.tsx`,
`components/ui/Button.tsx`, `components/ui/EmptyState.tsx`,
`components/admin/QuoteRequestAttachmentCard.tsx`,
`components/ui/ImageLightbox.tsx`.

Read in relevant part: `scripts/audit/contrast-check.mjs` (screen discovery
lines 700-730, unresolved accounting 780-820, class-map/v7 resolution 580-660),
`lib/data/admin-nav.ts`, `lib/data/command-center-dashboard.ts` (lines 200-285),
`tailwind.config.js` (colour tokens), `app/globals.css` (`--afs-crimson-ghost`,
`.eyebrow-label`), `components/layout/Footer.tsx`,
`components/layout/AppChrome.tsx`, `SITEMAP.md`, `tests/e2e/helpers/db.ts`.

Greps run (all of `app/ components/ lib/ tests/ scripts/ supabase/`):
`ProductionTimeline`, `ORDER_STAGES`, `order_status_history`, `orderStages`,
`api/track/verify`, `tracking_token`, `ImageLightbox`, `/track`.

Commands run for baseline (§5).

---

## 5. PRECONDITIONS AND BASELINE (S36)

Measured on this worktree at `75118cb`, working tree clean, **before** any edit:

| Check | Command | Result |
|---|---|---|
| Type check | `pnpm tsc --noEmit` | **CLEAN**, exit 0 |
| Unit tests | `pnpm test:unit` | **484 passed, 1 failed** (31 files, 1 failed) |
| Contrast gate | `node scripts/audit/contrast-check.mjs` | **PASS** — 24 screens, 248 pairs, 0 unresolved, 0 below threshold |

**PRE-EXISTING FAILURE, not caused by this item and not fixed by it:**
`lib/design/v7-css.test.ts` — "`app/styles/command-center-v7.generated.css` is
stale". The reported diff is a single line differing only in trailing
whitespace / line ending, i.e. a CRLF artefact of this Windows worktree, not a
content drift. Regenerating it would rewrite a v7 generated artefact, which this
run is forbidden to touch. Recorded, not touched. Any end-of-run count must
still show exactly this one failure and no other.

Environment facts relied on: no Supabase credentials are applied by this run
(migrations are files only — and this item needs **none**); `E2E_TEST_EMAIL` /
`E2E_TEST_PASSWORD` may be absent, in which case admin-gated Playwright tests
skip themselves by the suite's existing convention.

---

## 6. SCOPE

### 6.1 Created

| Path | Purpose |
|---|---|
| `lib/production/timeline-view.ts` | Pure view-model builder. Decides, for a given variant and order state, exactly what the timeline renders: rows + visual state + ordering, which labels, which descriptions, banner, estimated-ship line, photo slot position, tracking block, progress/a11y values, empty detection, and the error wording. No JSX, no React, no I/O. |
| `lib/production/timeline-view.test.ts` | Vitest unit suite over the above. |
| `components/account/ProductionTimeline.test.tsx` | Vitest **component render** suite — `react-dom/server`'s `renderToStaticMarkup`, no new dependency, no jsdom. |
| `components/account/PreShipPhotoThumb.tsx` | `'use client'` thumbnail that opens the existing `ImageLightbox` at full resolution (spec §5's "click → full size"). |
| `components/track/OrderStatusLookup.tsx` | `'use client'` public order-status lookup: form → `POST /api/track/verify` → `ProductionTimeline variant="public"`. Owns the idle / loading / error / success states. |
| `app/order-status/page.tsx` | Public route shell + metadata for the above. |
| `tests/e2e/production-timeline.spec.ts` | Playwright. Public page states need no credentials; customer/admin assertions are credential-gated like every other spec here. |

### 6.2 Modified

| Path | Change |
|---|---|
| `lib/admin/orderStages.ts` | `label` → `customerLabel`; add `TimelineVariant` and `stageLabel(stage, variant)` so the variant→label decision lives beside the array; add `TIMELINE_POST_PRODUCTION_STAGE` (moved in from the component) with the D4 warning. No key, order, or label **text** changes. |
| `components/account/ProductionTimeline.tsx` | Add `variant`, `loadState`, `errorMessage`. Render from the view model. Add `<ol role="list">`/`<li>` + `role="progressbar"` + `aria-current="step"` semantics. Loading / empty / error states. Gunmetal-safe colour pass (#18/#29) and removal of the arbitrary `bg-[var(…)]` (#28). |
| `app/account/orders/[id]/page.tsx` | Pass `variant="customer"`. |
| `app/admin/orders/[id]/page.tsx` | Replace the hand-rolled "Status History" `<ul>` with `ProductionTimeline variant="admin"` fed by the same `getOrderStatusHistory()` rows (now carrying `changedByName`). `StatusAdvancer` untouched. |
| `app/api/admin/orders/[id]/status/route.ts` | `getStage(...)?.label` → `?.customerLabel` (one token; the value it reads is the customer-facing label, which is correct for the customer email it builds). |
| `components/layout/Footer.tsx` | "Track an Order" → `/order-status` instead of the session-gated `/account/orders`. |
| `vitest.config.mts` | Add `components/**/*.test.tsx` + `lib/**/*.test.tsx` to `include`; set `esbuild.jsx: 'automatic'` because `tsconfig` says `jsx: "preserve"`, which esbuild cannot execute. |
| `specs/SPEC_PRODUCTION_TIMELINE.md` | Rewrite §9/§10 as the real as-built; add the variant matrix. |
| `SITEMAP.md`, `COMPONENT_MAP.md` | Record `/order-status` and the new components. |
| `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md` | Dated append (governance last, per CLAUDE.md #8). |

### 6.3 Untouched — deliberately

`middleware.ts`; everything under `docs/design/command-center-v7/`; every v7
Command Center screen and `app/styles/command-center-v7.generated.css`;
`components/admin/ProductionQueueTable.tsx` and `/admin/orders` (the Production
Queue); `components/admin/StatusAdvancer.tsx` and `QuickAdvanceButton.tsx`;
`app/track/[orderId]/page.tsx` and `components/track/DeliveryTrackingMap.tsx`;
`app/api/track/verify/route.ts` and `app/api/track/[token]/route.ts` (consumed
as-is, not edited); `lib/data/command-center-dashboard.ts`;
`components/layout/AppChrome.tsx` and `NavBar.tsx`; every Supabase migration.

---

## 7. NON-GOALS (S37)

- **No schema change and no migration.** Every field the three variants need
  already exists (`orders.status`, `.delivery_scheduled_at`, `.tracking_number`,
  `.carrier`, `.shop_photo_url`, `order_status_history`). Writing an unused
  migration file would be noise.
- **Not fixing the stage labels.** They stay placeholders until checklist #39.
  Inventing shop language is explicitly forbidden.
- **Not resolving D4.** Reid's call.
- **Not building admin editing into the timeline.** `StatusAdvancer` already
  satisfies spec §8 and is better suited; the `admin` variant is the *reading*
  half and sits beside it. "Editable admin surface" is satisfied by the page,
  not by duplicating the advancer.
- **Not sweeping `afs-chrome-dim`** out of the 21 files rule #18 lists as
  pending Reid. Only `ProductionTimeline`, which this item brings under the
  build gate, is corrected.
- **Not wiring `machine_jobs` → `orders.status`** (audit §2f). Separate decision.
- **Not adding the Production Queue's Expected column / SortControls**
  (audit §2d) — a different spec and a different screen.
- **No notification behaviour change** (spec §7 is already real in the status
  route).

---

## 8. INVARIANTS (S38)

| ID | Invariant | How it is held |
|---|---|---|
| INV-1 | `/admin/orders` (Production Queue) and every v7 Command Center screen render byte-identically. | Neither is edited. `ORDER_STAGES` key order, label **text** and `STATUS_LABEL`/`STATUS_VARIANT` values are unchanged, so every consumer prints what it printed before. |
| INV-2 | The customer order-detail timeline keeps showing the same stages, in the same order, with the same text. | Rows come from the same `ORDER_STAGES` in the same order; only colour tokens and the surrounding element types change. Covered by render tests on the `customer` variant. |
| INV-3 | `data-testid` hooks `production-timeline`, `stage-<key>`, `pre-ship-photo-slot`, `status-advancer` keep working. | Preserved verbatim; asserted by the new Playwright spec and the existing `production-queue.spec.ts`. |
| INV-4 | No price is shown to a customer on any of the three variants. | The timeline never receives a money field; `/api/track/verify` returns none. Asserted in the view-model test by shape. |
| INV-5 | The contrast build gate still reports `0 unresolved` and `0 below threshold`. | Re-run after the change; thresholds untouched. |
| INV-6 | `app/api/track/verify`'s auth model is unchanged — order number **plus** matching account email, rate-limited. | The route is not edited; the new page is a caller. |
| INV-7 | A profile/machine door is neither added nor touched. | No file under `lib/integrations/` is read or written. Static single-door test unaffected. |
| INV-8 | `pnpm tsc --noEmit` stays clean and the pre-existing failing test stays the only failing test. | End-of-run verification. |

---

## 9. REQUIREMENTS

### R1 — One config module drives every stage label

- R1.1 `lib/admin/orderStages.ts` remains the only place the stage array lives.
- R1.2 Fields are `key`, `customerLabel`, `adminLabel`, `description` — the
  names the item specifies, so which audience a label serves is readable at the
  declaration.
- R1.3 `stageLabel(stage, variant)` in the same module is the only place that
  decides which field a variant reads: `admin` → `adminLabel`;
  `customer` and `public` → `customerLabel`.
- R1.4 Array order **is** the production sequence. Nothing re-sorts it.
- R1.5 `TIMELINE_POST_PRODUCTION_STAGE` (the `in_production`/`packaged`/
  `out_for_delivery` → fabrication-stage mapping the timeline uses) lives in the
  config module with a comment stating that
  `lib/data/command-center-dashboard.ts`'s map deliberately differs (D4) and
  must not be merged into it.
- R1.6 No second copy of any stage label, in any file, for any variant.

### R2 — One pure view model, three variants

`buildTimelineView(input)` in `lib/production/timeline-view.ts` returns
everything the component renders. Variant rules, stated so they are testable:

| Shown | `customer` | `admin` | `public` |
|---|---|---|---|
| Stage label source | `customerLabel` | `adminLabel` | `customerLabel` |
| Stage description | completed + active rows | never | active row only ("minimal") |
| Timestamp per stage | yes | yes | yes |
| History note | no | yes | no |
| Changed-by name | no | yes | no |
| Estimated ship date | yes | no | yes |
| Pre-ship photo slot | yes | no | yes |
| Tracking block | yes | yes | yes |
| Progress summary | yes | yes | yes |

Rationale for each `no`: the admin page already shows the scheduled date and
the pre-ship photos in their own purpose-built panels, and customer prose is
not shop language; `public` is specified as the *minimal* variant, and a note
written for internal eyes must never reach an anonymous visitor.

- R2.1 `rows` is always every `ORDER_STAGES` entry, in config order, regardless
  of variant or status.
- R2.2 State: index `< current` → `completed`; `=== current` → `active`;
  `> current` → `pending`.
- R2.3 A post-production status resolves `current` through
  `TIMELINE_POST_PRODUCTION_STAGE` and sets a `post_production` banner naming
  the real status, so no customer is shown a stage label that misstates what
  happened. No stage is ever `active` in this case — the real status is outside
  the sequence, and the banner is what reports it.
- R2.4 `cancelled`: every stage reached according to history is `completed`,
  every other stage is `pending` **and** `struckThrough`; a `cancelled` banner
  carries the timestamp when history has one. No stage is `active`.
- R2.5 A status not in the config, not post-production and not `cancelled`
  yields all-`pending` rows, progress `0`, and an `unknown` banner naming the
  raw value — never a silently blank timeline (this is the failure mode audit
  §2a describes, generalised).
- R2.6 Timestamps: history is sorted ascending by `changedAt` and the **last**
  entry for a stage wins, so a re-entered stage shows when it was last entered.
- R2.7 `progress`: `stagesReached` (0..`totalStages`), `totalStages`
  (= `ORDER_STAGES.length`), and a `valueText` naming the current stage in
  words — the three values a `role="progressbar"` needs.
- R2.8 `tracking` is produced only when a tracking number exists **and** status
  is `shipped`, `delivered` or `out_for_delivery`; it attaches to the `shipped`
  row. `url` resolves for `ups`/`fedex`/`usps` (case- and punctuation-
  insensitive) and is `null` for any other carrier, which renders as plain
  text rather than a dead link.
- R2.9 `photo` is produced only when a URL is given and the variant shows it;
  the slot renders after the `qc` row (spec §5).
- R2.10 `isEmpty` is true when `statusHistory` is empty; `emptyMessage` is
  variant-appropriate. The stage list still renders — "nothing has been
  recorded yet" is information, a blank panel is not.
- R2.11 `estimatedShipDate` is surfaced only when the variant shows it, the
  order is not cancelled, and the order has not shipped or been delivered.
- R2.12 The module is pure: same input → same output, no `Date.now()`, no
  locale-formatted strings baked into the model (the component formats).
- R2.13 Error wording constants live here so the rule-#30 sentence is testable:
  the body must say what did **not** happen.

### R3 — The component

- R3.1 Props: the spec §3 shape plus `variant` (required — an explicit audience
  beats a default that silently shows customer prose to the shop) and
  `loadState?: 'ready' | 'loading' | 'error'` with `errorMessage?: string | null`.
- R3.2 `loading`: skeleton rows, `aria-busy="true"`, and an accessible
  "Loading production status…" label. `data-testid="production-timeline-loading"`.
- R3.3 `error`: a panel whose wording obeys rule #30 — no blame, no stack, and
  an explicit statement that the order itself is unaffected.
  `data-testid="production-timeline-error"`.
- R3.4 `empty`: the stage list plus the empty message,
  `data-testid="production-timeline-empty"`.
- R3.5 Semantics: `<ol role="list">` with one `<li>` per stage (the explicit
  `role` is required because `list-style:none` strips list semantics in Safari);
  `aria-current="step"` on the active row; a `role="progressbar"` element with
  `aria-valuemin` / `aria-valuemax` / `aria-valuenow` / `aria-valuetext`.
- R3.6 Existing `data-testid`s preserved; `data-state` added per row.
- R3.7 Colour: every pair clears WCAG AA on gunmetal. Specifically
  `afs-chrome-dim` → `afs-chrome-silver` for pending label text,
  `afs-chrome-base` → `afs-chrome-mid` for timestamps, `afs-crimson` →
  `afs-danger-on-dark` for the tracking link and the in-progress eyebrow, and
  the arbitrary `bg-[var(--afs-crimson-ghost)]` → real tokens.
- R3.8 No React state, no effects, no browser API — so it renders from a server
  component (customer, admin) and from inside a client component (public)
  without a second implementation.
- R3.9 The photo thumbnail opens full size through the existing `ImageLightbox`
  (spec §5), via a small `'use client'` child.

### R4 — Wiring, three real surfaces

- R4.1 `app/account/orders/[id]/page.tsx` → `variant="customer"`. No other
  change; it already passes every prop.
- R4.2 `app/admin/orders/[id]/page.tsx` → the hand-rolled Status History panel
  is replaced by `variant="admin"`, fed from the same `getOrderStatusHistory()`
  rows, now carrying `changedByName` and `note`. This is strictly more
  information than the list it replaces (the full sequence, not only the
  changes that happened). `StatusAdvancer` is untouched, so spec §8 editing is
  unchanged.
- R4.3 `app/order-status/page.tsx` + `components/track/OrderStatusLookup.tsx` →
  `variant="public"`, data from the existing `POST /api/track/verify`. The
  working live map at `/track/[orderId]` is not touched.
- R4.4 `components/layout/Footer.tsx`'s "Track an Order" points at
  `/order-status`, so the public variant is reachable without a session — which
  is what that link already claimed to be.

### R5 — Verification

- R5.1 `pnpm tsc --noEmit` clean.
- R5.2 `pnpm test:unit`: every new test passes; the only failure in the run is
  the pre-existing `lib/design/v7-css.test.ts`.
- R5.3 `node scripts/audit/contrast-check.mjs`: PASS, `0 unresolved`,
  `0 below threshold`, with `/admin/orders/[id]`'s measured pair count **higher**
  than the baseline 17 (proof the component really came under the gate rather
  than being invisible to it).
- R5.4 `pnpm lint` reports no new warning on touched files.
- R5.5 Playwright `tests/e2e/production-timeline.spec.ts` runs; credential-gated
  cases skip honestly when credentials are absent rather than passing vacuously.
- R5.6 The item is marked **UNVERIFIED** until a human confirms the three
  surfaces in a browser.

---

## 10. CONSTRAINTS — what must not change or be assumed

1. Do not edit `middleware.ts`, deploy, merge, or touch `main`.
2. Do not apply a migration. (This item needs none.)
3. Do not edit any v7 Command Center screen, anything under
   `docs/design/command-center-v7/`, the generated v7 CSS, or any pixel-gate
   baseline.
4. Do not change `/admin/orders`, `ProductionQueueTable`, `StatusAdvancer`, or
   `QuickAdvanceButton`.
5. Do not change `app/track/[orderId]/page.tsx` or `DeliveryTrackingMap`.
6. Do not change `lib/data/command-center-dashboard.ts`'s post-production map.
7. Do not invent stage names, carriers, dates, or any business value.
8. Do not relax a contrast threshold, add a gate skip list, or let the
   unresolved count rise.
9. Do not sweep `afs-chrome-dim` beyond this component.
10. Do not weaken, skip or delete a test to get green.
11. Do not add a runtime dependency. The component test harness must work with
    what `package.json` already has.
12. Do not read, print or copy any secret.

---

## 11. IMPLEMENTATION SEQUENCE

1. Config module: rename `label` → `customerLabel`, add `TimelineVariant`,
   `stageLabel`, `TIMELINE_POST_PRODUCTION_STAGE`; fix the two read sites.
2. `lib/production/timeline-view.ts`.
3. `lib/production/timeline-view.test.ts` — run; must be green before any UI.
4. `vitest.config.mts` — component-test capability.
5. `ProductionTimeline.tsx` rewrite onto the view model, with semantics, load
   states and the colour pass. `PreShipPhotoThumb.tsx`.
6. `components/account/ProductionTimeline.test.tsx` — run.
7. Wire customer, then admin, then the public page + footer link.
8. `tests/e2e/production-timeline.spec.ts`.
9. Full verification: `tsc`, unit, contrast gate, lint.
10. Docs: spec as-built, SITEMAP, COMPONENT_MAP.
11. Governance append, then commit and push.

Commit after each of 1-2-3, 5-6, 7, 8, 9-10-11 so a lost session costs one unit.

---

## 12. ACCEPTANCE CRITERIA

| ID | Criterion |
|---|---|
| **AC-01** | `lib/admin/orderStages.ts` declares `customerLabel`, `adminLabel`, `description` on all 9 stages, in production order, and is the only file in `app/ components/ lib/` containing a stage label string. |
| **AC-02** | `stageLabel(stage, 'admin')` returns `adminLabel`; `stageLabel(stage, 'customer')` and `stageLabel(stage, 'public')` return `customerLabel`, for every one of the 9 stages. |
| **AC-03** | `buildTimelineView` returns exactly 9 rows, in `ORDER_STAGES` key order, for every variant and for every one of the 13 accepted `orders.status` values plus an unknown value. |
| **AC-04** | For `currentStatus: 'cutting'`: rows 0-2 `completed`, row 3 `active` with `isCurrent: true`, rows 4-8 `pending`; `progress.stagesReached === 4`, `totalStages === 9`. |
| **AC-05** | For `currentStatus: 'cancelled'` with history up to `in_queue`: rows 0-2 `completed`, rows 3-8 `pending` **and** `struckThrough`, no row `active`, banner kind `cancelled` carrying the cancellation timestamp. |
| **AC-06** | For `currentStatus: 'packaged'`: banner kind `post_production` whose text contains `Packaged`; rows up to and including `ready` are `completed`; no row is `active`. |
| **AC-07** | For an unrecognised status: all 9 rows `pending`, `progress.stagesReached === 0`, banner kind `unknown` naming the raw value. No throw. |
| **AC-08** | Variant visibility matrix (R2) holds exactly: `admin` emits `note`/`changedByName` and no `description`, no `photo`, no `estimatedShipDate`; `public` emits a `description` only on the `active` row and never a `note`; `customer` emits descriptions on completed+active rows, `photo`, `estimatedShipDate`, and never a `note`. |
| **AC-09** | `tracking` is `null` unless a tracking number exists and status ∈ {`shipped`,`delivered`,`out_for_delivery`}; `url` is non-null for `UPS`, `FedEx`, `usps` (any casing/punctuation) and `null` for an unrecognised carrier; the number is URL-encoded in the resolved link. |
| **AC-10** | `photo` is non-null only for `customer`/`public` with a URL, and `rows.find(r => r.key === 'qc')!.showPhoto === true` identifies the slot position. |
| **AC-11** | `isEmpty` is `true` exactly when `statusHistory.length === 0`, and the 9 rows still render in that case. |
| **AC-12** | Two history entries for the same stage → the row's timestamp is the later one. |
| **AC-13** | Rendered markup for each of the three variants contains `<ol`, one `<li` per stage with `data-testid="stage-<key>"`, `aria-current="step"` on exactly one row when a stage is active and on none otherwise, and one `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`. |
| **AC-14** | Rendered markup order of stage labels equals `ORDER_STAGES` order for every variant; the `admin` render contains `Bending/Forming` and not `Forming` as a standalone label, and the `customer` render the reverse. |
| **AC-15** | `loadState="loading"` renders `data-testid="production-timeline-loading"` with `aria-busy="true"` and no stage rows; `loadState="error"` renders `data-testid="production-timeline-error"` whose text states that nothing about the order has changed; neither throws. |
| **AC-16** | `components/account/ProductionTimeline.tsx` contains no `afs-chrome-dim`, no `afs-crimson` used as a text colour, and no `bg-[`/`text-[` arbitrary value. |
| **AC-17** | `node scripts/audit/contrast-check.mjs` exits 0 with `0 unresolved` and `0 below threshold`, and `/admin/orders/[id]` measures **more** pairs than the baseline 17. |
| **AC-18** | `pnpm tsc --noEmit` exits 0. |
| **AC-19** | `pnpm test:unit` shows exactly one failing test — `lib/design/v7-css.test.ts` — and a total passing count ≥ 484 + the new tests. |
| **AC-20** | `GET /order-status` returns 200 anonymously, renders the lookup form, shows a field-level validation error on an empty submit, and shows the API's not-found message (never a stack trace) for a non-existent order; `components/layout/Footer.tsx`'s "Track an Order" href is `/order-status`. |
| **AC-21** | `/admin/orders/[id]` still renders `data-testid="status-advancer"` and now also `data-testid="production-timeline"`; `/admin/orders` is unchanged. |
| **AC-22** | No file under `docs/design/command-center-v7/`, no v7 screen, no migration, and `middleware.ts` appear in `git diff --name-only`. |

---

## 13. VALIDATION — criterion → method

| AC | Verification |
|---|---|
| AC-01 | `lib/production/timeline-view.test.ts` asserts the field names and order; a grep recorded in the FINAL REPORT shows no stage label string outside the config module. |
| AC-02 | Unit test, all 9 stages × 3 variants. |
| AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12 | `lib/production/timeline-view.test.ts`, exact-value assertions with diagnostic messages. |
| AC-13, AC-14, AC-15 | `components/account/ProductionTimeline.test.tsx` over `renderToStaticMarkup` output. |
| AC-16 | Unit assertion that reads the component source, so it cannot silently regress. |
| AC-17 | `node scripts/audit/contrast-check.mjs`, real output pasted in the FINAL REPORT. |
| AC-18, AC-19 | `pnpm tsc --noEmit`, `pnpm test:unit`, real output pasted. |
| AC-20, AC-21 | `tests/e2e/production-timeline.spec.ts` (public cases unauthenticated; admin cases credential-gated). |
| AC-22 | `git diff --name-only` listed in the FINAL REPORT. |

---

## 14. REQUIRED TESTS

**Unit — `lib/production/timeline-view.test.ts` (vitest).** Config shape and
order; `stageLabel` for 9 × 3; row count and order per variant; the five state
cases (normal / first stage / last stage / cancelled / post-production /
unknown); boundary statuses `submitted` and `delivered`; the variant visibility
matrix; tracking resolution incl. unknown carrier, casing, punctuation and URL
encoding; photo slot presence and position; empty history; duplicate history
entries; unsorted history input; a history entry for a stage that is not in the
config; `null`/`undefined`/empty-string inputs for every optional field; purity
(same input twice → deep-equal output).

**Component render — `components/account/ProductionTimeline.test.tsx` (vitest +
`react-dom/server`).** One render per variant; label text per variant; stage
order in markup; list and `listitem` structure; `aria-current="step"` exactly
once when active and zero times when cancelled or post-production;
`role="progressbar"` attribute set; loading, empty and error states; photo slot
rendered/not per variant; tracking link rendered as a link vs plain text; the
source-hygiene assertion for AC-16.

**E2E — `tests/e2e/production-timeline.spec.ts` (Playwright).**
`/order-status` anonymous: page loads, form present, empty submit shows a
validation error, a non-existent order shows the API's message and no stack
trace, no dollar sign anywhere in the rendered page (RFQ guard). Footer link
target. Credential-gated: `/admin/orders/[id]` shows both the advancer and the
timeline; `/account/orders/[id]` shows the timeline with list semantics.

**Regression.** The existing suite (`pnpm test:unit`) plus
`tests/e2e/production-queue.spec.ts`'s reliance on `status-advancer` and the
unchanged Production Queue.

---

## 15. COMPLETION EVIDENCE REQUIRED

Files created / modified; the real output of `pnpm tsc --noEmit`,
`pnpm test:unit`, `node scripts/audit/contrast-check.mjs` and `pnpm lint`;
`git diff --name-only`; the new test counts; the pre-existing failure still
named as pre-existing; every assumption from §13's discrepancy table restated;
browser verification steps for a human; and the item marked UNVERIFIED pending
that confirmation.

---

## 16. SELF-AUDIT

Performed after the first draft of this specification, reviewing it as another
senior engineer's work.

**Defects found and corrected in this document before implementation began:**

1. The first draft wired the public variant into `app/track/[orderId]`. Reading
   `AppChrome.tsx:10` showed every `/track*` path renders without NavBar or
   Footer, and reading the page showed a `fixed inset-0` map — the timeline
   would have had nowhere to live and would have degraded a working screen.
   Corrected to a new `/order-status` route (D5).
2. The first draft proposed consolidating the two post-production stage maps.
   Reading `lib/data/command-center-dashboard.ts:268` showed they **disagree**
   (`in_production` → `qc` vs `ready`) and that the dashboard's feeds a frozen
   v7 screen. Consolidating would have changed a v7 number. Corrected to an
   explicit do-not-merge note plus an UNRESOLVED entry (D4).
3. The first draft did not account for the build gate. Checking
   `contrast-check.mjs`'s screen list proved `/admin/orders/[id]` is gate-covered
   today, so wiring the admin variant would have failed `pnpm build` on
   `afs-chrome-dim` at 2.88:1 and on the arbitrary `bg-[var(…)]` raising the
   unresolved count. Added R3.7, AC-16 and AC-17 — including the requirement
   that the measured pair count **rise**, without which the gate could "pass"
   by not seeing the component at all.
4. The first draft planned React Testing Library. `package.json` has no jsdom
   and no testing-library, and this run may not install dependencies.
   Corrected to `renderToStaticMarkup`, which needs only the `react-dom`
   already present — plus the `esbuild.jsx: 'automatic'` override that
   `jsx: "preserve"` makes necessary.
5. The first draft left "three variants" in conflict with spec §9's deletion
   decision. Corrected to the explicit D1 resolution: variants return **only
   with real call sites**, which is what §9's reasoning actually required.
6. Acceptance criteria initially said "renders correctly per variant", which is
   not reviewable. Replaced with AC-04 through AC-15's exact row indices,
   counts, attribute names and text.

**Score.** Technical correctness 15/15. Completeness 15/15. Repository
grounding 10/10 (every claim above cites a file read, and the baseline is
measured output, not belief). Architectural consistency 10/10. Requirement
clarity 10/10. Acceptance-test quality 10/10. Edge-case and failure coverage
10/10. Security and data integrity 5/5 (no new endpoint, no new auth surface,
no schema change; the one new page consumes an existing rate-limited,
email-matched route). Implementation executability 10/10. Reviewability and
evidence quality 5/5. **Total 100/100.**

No critical defect remains: no materially ambiguous requirement, no unverified
repository assumption where verification was possible, no contradictory
requirement, no destructive migration, no unsafe security requirement, and
completion is objectively determinable from §12.

## 17. COMPLETION EVIDENCE — recorded after execution

### Files created

```
lib/production/timeline-view.ts                      pure view model, 3 variants
lib/production/timeline-view.test.ts                 47 tests
components/account/ProductionTimeline.test.tsx       25 component render tests
components/account/PreShipPhotoThumb.tsx             client lightbox thumbnail
components/track/OrderStatusLookup.tsx               public variant's surface
app/order-status/page.tsx                            public route + metadata
tests/e2e/production-timeline.spec.ts                8 cases
EES-OVN.06-PRODUCTION-TIMELINE.md                    this document
```

### Files modified

```
lib/admin/orderStages.ts                 label -> customerLabel; stageLabel();
                                         TimelineVariant; TIMELINE_POST_PRODUCTION_STAGE;
                                         POST_PRODUCTION_LABEL; CANCELLED_LABEL
components/account/ProductionTimeline.tsx  rebuilt onto the view model: variant,
                                         loadState, ol/li + progressbar + aria-current,
                                         colour pass
app/account/orders/[id]/page.tsx         variant="customer"
app/admin/orders/[id]/page.tsx           hand-rolled Status History -> variant="admin";
                                         unused formatDateTime removed
app/api/admin/orders/[id]/status/route.ts  ?.label -> ?.customerLabel
components/layout/Footer.tsx             "Track an Order" -> /order-status
vitest.config.mts                        oxc.jsx automatic; .tsx test include
specs/SPEC_PRODUCTION_TIMELINE.md        S2/S3/S4 corrected, S9/S10 rewritten as-built
SITEMAP.md, COMPONENT_MAP.md             /order-status and the new components
STATE_OF_THE_BUILD.md, SESSION_STATE.md  dated appends
```

No migration was written (none is needed), `middleware.ts` is untouched, and no
file under `docs/design/command-center-v7/` appears in the diff.

### Commands run, and their real results

| Command | Result |
|---|---|
| `pnpm tsc --noEmit` | exit 0, no output |
| `pnpm test:unit` | **556 passed / 557**, 32 files passed / 33. The single failure is `lib/design/v7-css.test.ts`, failing identically at baseline |
| `node scripts/audit/contrast-check.mjs` | **PASS** — 24 screens, 252 pairs, **0 unresolved, 0 below threshold**. `/admin/orders/[id]` 17 pairs at baseline -> **21** now |
| `npx playwright test tests/e2e/production-timeline.spec.ts` | **6 passed, 2 skipped** (the two skips print their reason: no order row exists in this environment) |
| `pnpm lint` | **CANNOT RUN** — no ESLint config exists in this repository, so `next lint` enters its interactive setup prompt and exits 1. Pre-existing |

### Acceptance criteria

AC-01 through AC-16 are each asserted by a named test in
`lib/production/timeline-view.test.ts` or
`components/account/ProductionTimeline.test.tsx`, all passing. AC-17, AC-18 and
AC-19 are the three commands above. AC-20's five public cases pass live; its
footer-href half passes live. AC-21 is **PARTIALLY VERIFIED**: the contrast
gate's output names `components/account/ProductionTimeline.tsx` under
`/admin/orders/[id]`, which it can only do by walking that page's real render
tree, so the component IS mounted there — but the Playwright assertion could not
run because this environment has no order to open, and it skips rather than
passing vacuously. AC-22 holds: `git diff --name-only` lists no v7 file, no
migration and not `middleware.ts`.

### Known limitations

1. The customer and admin variants were not rendered against real data in a
   browser during this run. **UNVERIFIED pending a human** — steps in the FINAL
   REPORT.
2. Coverage was not measured: this repository has no coverage tooling installed,
   and adding `@vitest/coverage-*` is a dependency change outside this item.
3. `in_production`'s two different stage mappings were left disagreeing on
   purpose (§3.3 D4). **UNRESOLVED — Reid's call.**
4. Stage labels remain placeholders. Checklist #39 is still outstanding, which is
   exactly why they now live in one file with one accessor.

### Implementation self-audit

Re-reviewed as another engineer's work, against §12. Four defects were found
during execution and fixed rather than rationalised: a test that asserted admin
tracking on an unshipped order (the test was wrong, not the code); a money-field
guard whose regex matched `totalStages`; `esbuild.jsx` silently ignored because
this Vite major uses oxc; and a Playwright `getAttribute()` on an absent element
that turned "no order to open" into a 30-second timeout. One real product defect
was found by the contrast gate after the code was written — `afs-chrome-mid` at
4.04:1 on `afs-bg-overlay` — and fixed in both places it occurred. Nothing was
skipped, no assertion weakened, no threshold relaxed.

Score on the executed work: technical correctness 15, completeness 14 (AC-21 is
only partially verifiable in this environment, and that is stated rather than
claimed), repository grounding 10, architectural consistency 10, requirement
clarity 10, acceptance-test quality 10, edge-case and failure coverage 10,
security and data integrity 5, implementation executability 10, reviewability and
evidence quality 5. **Total 99/100.**

---

---

ENGINEERING COMPLETION RECORD
Prompt ID: EES-OVN.06
Prompt Name: Production Timeline — shared component, three variants, config-driven stage labels
Word Count: 5791
Engineering Proficiency Score: 99/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES
