# CURRENT_STATE.md
## AFS — What's Actually True Right Now, By Subsystem

**Read this when you need "what's the real state of X" without reconciling
a dozen scattered, sometimes-superseded entries yourself.** This file is a
snapshot, not an audit trail — it does not replace `STATE_OF_THE_BUILD.md`
or `SESSION_STATE.md`, both of which stay exactly as they are, unedited,
as the detailed session-by-session history. Every section below points to
the specific entry (or entries) in those files for the full story.

Status values used below, matching `STATE_OF_THE_BUILD.md`'s own standard:
**DONE** (gates passed + Reid independently confirmed), **IMPLEMENTED,
UNCONFIRMED** (code compiles/builds and a session verified it live via
Playwright/direct DB checks, but Reid has not looked at it himself),
**BLOCKED** (external dependency, no further code work possible),
**NOT STARTED**.

Each section also states plainly whether its status here was **re-verified
this pass** (I re-checked real code/git directly) or **carried from docs**
(taken from the governance files' own most recent entry, not independently
re-checked in this pass). Do not read "carried from docs" as less real —
most of those entries already contain their *own* session's live
verification; it just wasn't redone here.

---

## HAILVIEW

**Status: IMPLEMENTED, UNCONFIRMED.** All 5 spec phases (geocode/storm/wind
pipeline, scoring engine, UI, agentic explanation, email capture) are
complete, plus an unplanned interactive Leaflet map and a full-bleed
map-as-page-background layout. The default map zoom has been corrected
twice in as many sessions (8 → 9) after each prior "confirmed via
screenshot" claim missed real extraneous cities in frame.

**Most important open item:** Reid has never personally looked at HailView.
Given the zoom value alone has already needed one live-caught correction
after being called "confirmed," nothing about the map framing, scoring
narrative, or email form should be treated as settled until he does.

**Re-verified this pass:** `DEFAULT_ZOOM = 9` confirmed directly in
`components/hailview/HailViewMap.tsx`.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-hv-001 through afs-hv-009
(afs-hv-009 is the current top entry).

---

## FLASHDRAFT

**Status: IMPLEMENTED, UNCONFIRMED**, across every dimension below. The
core 2D drawing canvas, 3D viewer, hem system, and paint/color system are
all real, wired, non-stub code that passes `tsc`/`build` and has been
exercised live via Playwright in-session — none of it has Reid's own
sign-off yet.

- **2D hem geometry:** many iterative fixes (gap defaults, kick
  mirroring, fold direction, teardrop proportions) — most recent fix
  `3fa8c70`. Treat as open until Reid checks it against his own reference
  photos/sketch, per the file's own repeated caveat.
- **3D hem geometry:** added afs-fl-018 — `ProfileViewer3D.tsx` genuinely
  renders hems now (re-verified this pass: `hemStart`/`hemEnd` appear 11
  times in that file), superseding an earlier "3D View Does Not Render
  Hems: NOT STARTED" entry that is now stale.
  **Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-018 entry and the
  "FLASHDRAFT — 3D VIEW DOES NOT RENDER HEMS" entry it supersedes.
- **Paint-face 3D rendering:** went through 3 regressions in one night
  (afs-fl-018 → afs-fl-022 → afs-fl-023); afs-fl-023's decal-architecture
  fix could not be broken again in afs-fl-025's exhaustive 6-profile/
  72-mesh re-audit. Treat as currently correct, not as "still fragile."
- **Templates:** the locked 20-item list + Coping Cap/Valley VariantPicker
  is real and shipped (afs-fl-020) — **re-verified this pass:**
  `PROFILE_TEMPLATES` array exists at `app/studio/draft/page.tsx:547`.
  **This directly contradicts** the stale "FLASHDRAFT TEMPLATE REBUILD
  (Pass 1–4): NOT STARTED" entry later in `STATE_OF_THE_BUILD.md` — see
  Step 3 correction below. Every item's geometry is still explicitly
  **PLACEHOLDER** (generic 2–8 point shapes, not real fabrication
  dimensions) — Reid has not supplied physical reference dimensions, and
  none were fabricated from memory per his standing constraint.
- **Known, unresolved regression, not fixed:** the site-wide chat-widget
  trigger (115px, afs-fl-027) still fully overlaps FlashDraft's mobile
  "Load" button at a 375px viewport — needs a design decision (page-
  specific chat accommodation vs. mobile sidebar redesign), not another
  resize.

**Most important open item:** the 20 template shapes are placeholder
geometry only — swapping in real dimensions is a pure data change to
`PROFILE_TEMPLATES` once Reid supplies reference images, not a rebuild.

**Full history:** `STATE_OF_THE_BUILD.md` — hem chain from `3fa8c70` back
through the `<details>` archaeology blocks; paint-face chain afs-fl-018 →
022 → 023 → 025; templates afs-fl-020; UI polish afs-fl-026/027/028/029.

---

## JOB-IDENTITY, FINISH & COLOR SYSTEM (cross-cutting)

**Status: IMPLEMENTED, UNCONFIRMED.** Business Name / Client Name / PO
Number / Job Name / Requested Delivery Date / Finish (Anodized vs.
Painted) / Color are wired end-to-end across all four submission surfaces
(FlashDraft, Configurator, Quote Builder, Blueprint Takeoff), the Command
Center edit UI, and the PathfinderEdge description string. All five
supporting migrations (016–019) are **confirmed applied live** via direct
`information_schema` checks.

**Most important open item:** the PAC-CLAD Anodized Aluminum color chart
(`pacclad_anodized` in `lib/data/metal-colors.ts`) is still 9
**placeholder** colors pixel-sampled from a PDF — explicitly expected to
be replaced once Reid gets the real vector chart from the distributor.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-jf-000 through afs-jf-006,
afs-cv-000 through afs-cv-005.

---

## ADMIN PORTAL / NAVIGATION

**Status: IMPLEMENTED, UNCONFIRMED.** Current nav (afs-fl-031): icons
stripped, GBP Photos moved to its own `/admin/gbp-photos` route, Invoices
folded into the Orders tab as a toggle, Shop View promoted to a top-level
Operations item, QuickBooks/Employee folded into existing sections. No nav
commits have landed since.

**Most important open item:** `/admin/consultations` (left nav item,
untouched by afs-fl-031) 404s — **re-verified this pass:** no
`app/admin/consultations/` directory exists in the repo. Pre-existing,
not a regression, not yet fixed.

**Also awaiting Reid's yes/no (explicit judgment calls, not silent
decisions):** the "Settings" section's single item was renamed to
"General" to avoid a redundant "Settings > Settings" label; GBP photo
review is reachable only via a dashboard stat card, not a nav link.

**Re-verified this pass:** `components/layout/AdminShell.tsx`'s
`NAV_SECTIONS` matches the afs-fl-031 description; `git log` confirms no
admin-nav-touching commit after it.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-031 entry.

---

## COMMAND CENTER

**Status: mixed.** Core dashboard/CRM tabs are BUILT (original Phase 6).
The PathfinderEdge approval pipeline is genuinely connected end-to-end
(hems included as real machine features) — the "Approve & Send to
Machine" click now pushes every line item to PathfinderEdge before any DB
write, and `delivery_method` on new quote-request approvals now defaults
to **`pathfinder_edge`**, not `machine_bridge` (changed deliberately
mid-build; see the PathfinderEdge section below for what that implies).

**Most important open item:** a multi-item quote request approval creates
N separate `machine_jobs` rows / N separate Command Center cards, all
sharing one request number, with no visual grouping — flagged as an
undecided product question, not a bug.

**Re-verified this pass:** grepped
`app/api/admin/command-center/approve-quote-request/route.ts` directly —
confirms `delivery_method: 'pathfinder_edge'` is the current insert value.

**Full history:** `STATE_OF_THE_BUILD.md`, "COMMAND CENTER — FULL APPROVAL
PIPELINE CONNECTED TO PATHFINDEREDGE" entry, afs-fl-031.

---

## SHOP VIEW & PROFILE LIBRARY

**Status: IMPLEMENTED, UNCONFIRMED.** Shop View is a one-job-at-a-time
focus layout with a numbered queue strip (afs-cv-004, superseding an
earlier side-by-side grid). Profile Library has admin-controlled queue
reordering (afs-cv-005) and shows all job-identity/color/finish fields.

**Most important open item:** `shop_profile_library.hem_instructions`,
`.painted_edge`, `.special_instructions`, and `.order_number` are real,
displayed columns that **no insert path has ever populated** — flagged
since afs-sv-010, still open, every existing row shows "—" for these.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-cv-004, afs-cv-005,
afs-sv-009/afs-sv-010.

---

## PATHFINDEREDGE INTEGRATION (machine-facing)

**Status: real, live API integration is DONE** (superseding an earlier
complete stub) — `lib/integrations/pathfinder-edge.ts` makes genuine
network calls, confirmed via a real create→read→delete round trip.
Hems now push as real `OpenHem`/`ClosedHem`/`TearDropHem` features, not
just a blank-width number.

**Most important open item — do not treat bend angles on the machine as
trustworthy for any non-90° profile:** the bend-angle formula is on its
4th revision (signed interior angle, `sign(turn) × (180 − |turn|)`) and
status is explicitly **OPEN/PARKED** — the 4-case verification matrix
(sharp V, W-profile, near-90° regression, hairpin/hem-adjacent) that Reid
was supposed to run himself has never been run, per afs-sv-000. A prior
turn-angle formula was shipped, "confirmed," and later found to render
self-intersecting geometry on the real machine — this history is why nothing
here should be assumed correct without that matrix.

**Also open:** `hemDirection` (inside/outside → PathfinderEdge's
Positive/Negative) is an unconfirmed arbitrary mapping; a real blank-width
discrepancy between FlashDraft's own displayed width and PathfinderEdge's
independently recomputed one (33 1/4" vs. 34 3/8" on one real pushed
profile) is flagged as a genuine open question, not reconciled; the
separate `afs-machine-bridge` project (still a real alternate path to the
same physical Thalmann) was last audited 2026-07-13, running only on a dev
machine and failing auth (401) — not re-checked since, and now largely
bypassed in practice since Command Center approvals default to
PathfinderEdge routing instead. This project's live Supabase database also
has **no migration ledger** — any migration's live-apply status must be
re-verified via `information_schema` each time it matters, never assumed
from a file's presence or a prior note in either governance doc.

**Full history:** `STATE_OF_THE_BUILD.md` — afs-sv-000 (OPEN/PARKED), the
"fourth revision: signed interior angle" entry, "PathfinderEdge — real API
integration, live" entry, afs-jf-006 (title/description generator).

---

## HOMEPAGE

**Status: IMPLEMENTED, UNCONFIRMED.** Existing hero headline/photo are
deliberately unchanged. Added: a "Drawing to Steel" SVG sketch-accent over
the hero, a 4-category real-photo grid (38 photos), and an 8-photo curated
project gallery — all sourced from AFS's own legacy site photography,
individually opened and classified to exclude iStock/stock images (a
separate, clean audit — afs-fl-035 found zero iStock references anywhere
in the codebase or Storage).

**Most important open item:** a further 46 genuine legacy photos are now
catalogued at `public/legacy-site-photos/` (with a manifest) but are not
wired into any page yet — a future integration pass, not a data gap.

**Re-verified this pass:** `app/page.tsx` confirmed to import and render
`HeroDrawingOverlay`, `PhotoCategoryGrid`, and `ProjectGallery`.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-034, afs-fl-035,
afs-fl-036.

---

## AUTH / LOGIN / ACCOUNT

**Status: IMPLEMENTED, UNCONFIRMED.** Password-login role redirect
(admin → `/admin`, customer → `/account`) was **confirmed working live
this session** via two real throwaway accounts driven through the actual
`/login` page. The magic-link path had the same gap and was just patched
to mirror it.

**Most important open item:** the magic-link fix itself could not be
click-tested end-to-end in this environment — Supabase's admin
`generate_link` API returns an implicit-flow link, not the PKCE link a
real browser's magic-link flow produces, so `exchangeCodeForSession` was
never actually exercised. Needs either Reid's own click-through or a
future session with real inbox access.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-038 (current), afs-fl-033
(NavBar/header/sign-out, re-verified twice, still not Reid-confirmed).

---

## BID DOCUMENTS

**Status: DONE.** Built 2026-07-31 (predates this doc's rewrite), migration
013 (`bid_documents` + 3 related tables) **confirmed applied live**. A
full claim-lock/collaborative-editing → line-item pricing (server-computed,
never client-trusted) → real PDF generation → Resend delivery →
Command Center surfacing pipeline all exists as real, wired code — this
corrects an earlier session's mistaken claim that this feature was
unbuilt.

**Most important open item:** no live `bid_documents` row has ever been
exercised end-to-end in an environment with real DB access — the
remaining step is one real claim → price → preview → send click-through,
not a rebuild.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-021 (the correction),
migration-013 entry.

---

## BUILDING CODE DIRECTORY

**Status: IMPLEMENTED, UNCONFIRMED** (gates pass; not yet Reid-confirmed
live). All 254 Texas counties and 226 incorporated cities ≥10,000
population are seeded at `/admin/building-codes`, each with an
individually HTTP-verified real link, an honestly-confirmed
`no_code_adopted` status, or an honest `unresolved` (4 jurisdictions
total, where the source blocks automated fetch/bot-checks).

**Most important open item:** none structurally — this is a complete,
one-state-only-by-design dataset (schema is state-agnostic for a future
expansion). The 4 `unresolved` rows are the only real gaps, and they're
flagged as such rather than silently guessed.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-024.

---

## PWA / FIELD APPS

**Status: IMPLEMENTED, UNCONFIRMED.** Three independently-scoped install
sets exist (root: red, `/field/contractor`: black, `/field/shop`: white),
each with real alpha-composited icons baked from the real logo. Contractor
camera-to-quote (`/field/contractor`, anonymous guest access, no account
required) and shop-floor job completion (`/field/shop`, admin-only) are
both built and write to real tables; job completion now auto-schedules a
delivery date and sends a tracking-link invoice email (afs-fl-014) when a
real matching order exists.

**Most important open item:** none of the three PWA installs, and neither
mobile flow, has ever been checked on a real Android/iOS device — this is
the single gate the file repeatedly calls out as the actual bar for DONE,
not another code pass.

**Full history:** `STATE_OF_THE_BUILD.md`, afs-fl-000 through afs-fl-014.

---

## CORE PLATFORM (Phases 0–8 + pre-existing tools)

Covers the original 9-phase build (scaffold, drawing/upload, quote request
system, product catalog + auth, customer portal, architect portal, admin +
operations, AI layer, integrations/deploy) plus tools built before this
doc's 2026-08-11 rewrite that haven't been individually re-touched since:
Bid Monitor (SAM.gov + 50-state registry), the Employee PWA, the RAG
chatbot/FlashChat, the Resources library, Track Delivery, Design Studio,
and the 3D Profile Configurator.

**Status: BUILT**, per the last full-codebase audit — **not
independently re-verified route-by-route in this pass or since.** The
governing table's own text says as much: "if in doubt, verify a specific
route or feature directly rather than trusting this table blind."

**Most important open item:** the separate `afs-machine-bridge` project
was last audited 2026-07-13 (dev-machine-only, failing auth, zero `.ds1`
files generated) and has not been re-checked since — anyone relying on it
today should check its own logs directly, not this line.

**Full history:** `STATE_OF_THE_BUILD.md`, "BUILD PHASE STATUS" table
(bottom of file).

---

*CURRENT_STATE.md | AFS — Architectural Flashing Supply | Generated
2026-09-05 from a direct read of `STATE_OF_THE_BUILD.md`, `SESSION_STATE.md`,
`git log`, and targeted current-code checks (grep/read) where this pass's
own investigation found the written status might be stale. Does not
replace either governance file — see the pointers above for full detail.*
