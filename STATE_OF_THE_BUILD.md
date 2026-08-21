# STATE_OF_THE_BUILD.md
## AFS — Current Build Status
**Updated from an actual audit of the codebase, not from memory or prior session summaries.**

---

## VERIFICATION STANDARD — READ THIS FIRST

This project has a documented history of governance docs claiming a fix was
"complete" or "verified live" when the underlying behavior was later found
broken, not visible in production, or not actually committed. A Claude Code
session's own claim of having "verified live" something (via Playwright, a
build pass, or code review) is **not sufficient** to mark an item complete
in this document. That standard is met only when:

1. The relevant automated gates actually pass (`pnpm tsc --noEmit`, `pnpm
   run build`), run directly in this session, not assumed from a prior one, AND
2. For anything visual or interactive (canvas rendering, UI behavior), **the
   user has independently confirmed the behavior themselves** — a session's
   own screenshot or Playwright pass is evidence to bring to the user, not a
   substitute for their confirmation.

Items below are marked accordingly: **DONE** (both gates above met),
**IMPLEMENTED, UNCONFIRMED** (code exists and compiles/builds, but the user
has not confirmed the actual behavior is correct), or **NOT STARTED**.

This file was rewritten in full on 2026-08-11 as a documentation-accuracy
pass — no application code was touched in that pass. The prior version of
this file (several thousand lines of session-by-session narrative) is not
reproduced here; it remains available via `git log -p -- STATE_OF_THE_BUILD.md`
for anyone who needs the granular history. Going forward, `git log` is the
authoritative record of what was actually committed — this file is a status
summary, not a replacement for it.

---

## VERIFIED THIS PASS (2026-08-11)

```
git log --oneline -20              Confirmed. Local main matches the commits
                                    listed under RECENT COMMITS below.
git status                         Clean except tsconfig.tsbuildinfo
                                    (build artifact, not source).
origin/main sync                   0 ahead / 0 behind — local main is fully
                                    pushed, nothing sitting uncommitted or
                                    unpushed.
pnpm tsc --noEmit                  0 errors. Exit code 0.
```

---

## OPEN/PARKED — PATHFINDEREDGE BEND-ANGLE INVESTIGATION (afs-sv-000)

**Status: OPEN/PARKED as of 2026-08-20. Not resolved, not abandoned —
a future session should pick this up from here, not assume it is done
and not restart from scratch.**

1. **Confirmed:** the supplement-swap bug, via a single-bend V test —
   PathfinderEdge profile 32912069, drawn interior angle 45°, rendered
   as approximately 135° on the machine side (PathfinderEdge) under
   the (now superseded) turn-angle formula.
2. **Staircase test profile 32911526: UNEVALUATED.** Has not yet been
   checked against this bend-angle behavior. Its only prior verdict
   (self-intersecting/impossible shape) rests entirely on Reid's own
   chat messages, not independent visual confirmation — no session has
   had browser access to PathfinderEdge's own web UI.
3. **Signed-interior-angle fix status (quoted, not restated from
   memory — see the full entry immediately below this one):** "Status:
   IMPLEMENTED, PENDING Reid's own visual verification matrix below.
   Not confirmed. Supersedes the turn-angle revision documented
   immediately below this entry — read this one first."
4. **Verification matrix still pending** — none of the following have
   been run: (1) V-profile sharp angle, (2) W-profile 45°/-60°/45°/-60°
   sequence, (3) near-90° regression check, (4) a -180°/hem-tail case.
5. **"Angle vs Radius" feature-type question: still open, undecided.**
   Whether a bare `radius: 0` (`Angle`-type feature) behaves differently
   from the `Radius`-type feature every real test so far has used
   remains untested.
6. **Production deploy SHA: UNVERIFIED.** Do not claim this fix is live
   in production without a real `deploy_verify`-equivalent check
   (production's deployed commit SHA, read from the Vercel API,
   compared against `git rev-parse HEAD`).

---

## JOB-IDENTITY FIELDS END TO END — SUBMISSION SURFACES, COMMAND CENTER EDIT, PATHFINDEREDGE DESCRIPTION, SHOP VIEW/PROFILE LIBRARY DISPLAY (afs-jf-003): IMPLEMENTED, UNCONFIRMED — 2026-08-21

**Status: `pnpm tsc --noEmit` returns 0 errors and `pnpm run build` completes
successfully, both run directly this session. This prompt touches four real
public submission surfaces, one Command Center admin page, and two internal
shop-floor display surfaces (Shop View, Profile Library) — this session had
no browser/Playwright access, so per this file's verification standard it is
marked IMPLEMENTED/UNCONFIRMED until Reid opens all four submission surfaces
and confirms the four new fields submit correctly, opens the Command Center
detail page and confirms he can view/edit/save the four fields, performs a
real PathfinderEdge send from both send paths and confirms the composed
`description`, and confirms both display surfaces (Shop View focus card,
Profile Library table + its two new filters).**

**PRODUCTION-BLOCKING SEQUENCING RISK — STILL OPEN, NOT NEW BUT NOW WORSE:**
migration `018_job_identity_and_finish.sql` (afs-jf-000) was already
flagged as NOT applied to the live Supabase project as of afs-jf-002 (the
immediately-preceding entry above), because that prompt made
`app/api/quote-requests/route.ts` always write a `finish` key on every
insert. This prompt adds FOUR MORE always-present keys to that same insert
(`client_business_name`, `client_name`, `po_number`, `requested_by`) — so
the same failure mode (Postgrest rejecting the insert because a referenced
column doesn't exist) now applies just as hard, on top of the existing
`finish` risk. **Attempted to re-verify migration 018's live-apply status
this session via the connected Supabase MCP account** — found only two
projects, both named `tarritrix`/`tarritrix-audit`, neither containing a
`quote_requests` or `shop_profile_library` table at all (confirmed via a
direct `information_schema.tables` query) — this MCP connection is not
wired to the real AFS Supabase project, so it could not be used to check.
Migration 018's live-apply status therefore remains exactly as last
recorded — **NOT applied** — and is **still unverified this session** by
the authoritative method (an `information_schema` check run directly
against the real AFS project in the Supabase Dashboard SQL Editor, same
standard already used for 017). **Apply and confirm migration 018 live
before or immediately upon deploying this commit — every quote-request
submission through all four surfaces will otherwise fail outright.**

**Re-verified before touching anything, per the task's instruction:** read
all four submission surfaces (`app/studio/draft/page.tsx`,
`app/configure/page.tsx`, `app/quote/page.tsx`, `app/upload/page.tsx`),
`app/admin/quote-requests/[id]/page.tsx`, both PathfinderEdge send paths,
`lib/integrations/pathfinder-edge.ts`, `app/admin/shop-view/page.tsx`, and
`app/admin/profile-library/page.tsx` in full. All of afs-cv-002's/afs-jf-000's
prior claims about these files were confirmed still accurate. One new
finding not previously documented: **`app/quote/page.tsx` already collects
a PO Number (Step 3, `form.poNumber`) and already sent it to
`/api/quote-requests` as `poNumber` in the request body — but that route
never read `body.poNumber` at all, so every PO Number entered on the Quote
Builder was silently discarded before this prompt.** This was a real
pre-existing bug, not something to work around; fixed as part of wiring
`po_number` through (see below), not treated as "PO number already fully
working, nothing to do there."

**Four submission surfaces — added Business Name / Client Name / PO
Number / Requested By, all optional, none block submit:**
1. `app/configure/page.tsx` — 4 new `ConfiguratorForm` fields, new input
   block above Notes, wired into the existing `/api/quote-requests` POST
   body.
2. `app/quote/page.tsx` — `poNumber` already existed (see the bug above);
   added `clientBusinessName`/`clientName`/`requestedBy` to
   `QuoteFormData`, new inputs in the Step 3 "Project Details" grid next to
   the existing PO Number field, and rows in the Step 4 review table for
   all three new fields (matching the page's existing review-every-field
   convention).
3. `app/studio/draft/page.tsx` — 4 new state vars, added to
   `AutosaveState` and both the localStorage restore/write effects (same
   pattern `finish` used in afs-jf-002), new input block between the Rush
   Order toggle and the Profile Match panel, wired into the
   `/api/quote-requests` POST body. **Full-file-replacement deviation,
   same as afs-cv-003:** this file (3,800+ lines) was edited via precise
   `Edit` calls, not rewritten via `Write` — reconstructing it by hand in
   one call risks transcription errors at this size. Flagged explicitly
   per the task's own instruction to note this rather than silently
   deviate.
4. `app/upload/page.tsx` — 4 new state vars, added to the `TakeoffDraft`
   local-persistence type and both its restore/write paths (same
   `prefilledFields`/`panelWidthUserSelected` pattern already established),
   new "Job Details (optional)" block above the submit buttons, wired into
   the `/api/quote-requests` POST body, cleared in `resetToIdle()`.

**`app/api/quote-requests/route.ts`:** now reads
`clientBusinessName`/`clientName`/`poNumber`/`requestedBy` (mirroring the
existing `color`/`finish` handling) and writes them into
`quote_requests.client_business_name` / `.client_name` / `.po_number` /
`.requested_by` — this is also the fix for the pre-existing PO Number
bug above.

**Command Center quote-request detail page
(`app/admin/quote-requests/[id]/page.tsx`) — was entirely read-only before
this prompt** (confirmed by reading it in full: every field rendered as
static `dt`/`dd` text; the only client-side form on the page,
`QuoteEstimatorForm`, only writes pricing/freight/estimator-notes on send,
never touches job-identity fields). New `components/admin/
JobIdentityEditorForm.tsx` (client component) renders and edits all four
fields, following `components/admin/CustomerAccountSettingsForm.tsx`'s
existing convention exactly (local state, dirty-tracking, PATCH-on-save,
`router.refresh()`) rather than inventing a new pattern — that form is the
closest existing "plain optional text fields, edit + save" admin pattern
in the codebase; `AdminNotesPanel.tsx` was considered and rejected as the
model since it's an append-only log, not a plain-field editor. New route
`app/api/admin/quote-requests/[id]/route.ts` (`PATCH`) follows
`app/api/admin/orders/[id]/crm/route.ts`'s single-PATCH-route-per-resource
pattern: admin-auth-gated, normalizes blank input to `null`, writes via
`logAdminAction`. The page's prior static "PO Number" `dt`/`dd` row was
removed — the new editable form now owns that field instead of duplicating
it as read-only text elsewhere on the page.

**Both PathfinderEdge send paths — shop_profile_library write-through
(all five fields: the four identity fields + `finish`, per afs-jf-002):**
- `lib/data/shop-profile-library.ts` — `ShopProfileLibraryInsert` gained
  `clientBusinessName`/`clientName`/`poNumber`/`requestedBy`/`finish`,
  written into the insert alongside `color` (afs-cv-003's precedent).
  **`finish` was NOT previously copied to `shop_profile_library` by
  afs-cv-003 or afs-jf-002** — confirmed by reading the pre-existing file
  before touching it; this prompt is the first to wire it there.
- `app/api/admin/command-center/approve-quote-request/route.ts` — the
  `quote_requests` select now includes all five columns; every
  `insertShopProfileLibraryRecord` call (one per line item) passes them
  through from the parent request (one set of values per request, not per
  item — matches how `color`/`finish` already work on `quote_requests`).
- `app/api/studio/send-to-pathfinder/route.ts` — no source `quote_request`
  on this path (same as `color`'s afs-cv-003 precedent), so all five come
  through as new optional body fields, populated client-side from
  FlashDraft's own live draw-session state.

**PathfinderEdge `description` composition (`lib/integrations/
pathfinder-edge.ts`'s `pushProfileToPathfinder`) — new `composeDescription()`
function:** builds `"Business | Client | PO <po> | Req: <name> | <finish>"`
with any blank/missing segment dropped entirely (never an empty ` | `),
prepended to the pre-existing `AFS profile <profileNumber>` reference text
(never replacing it). `MachineProfile` gained the same five optional
fields; `lib/integrations/flashdraft-to-pathfinder.ts`'s
`flashDraftToMachineProfile()` passes them through unchanged.

**Description length-limit check — done, no live test performed, no
truncation applied:**
1. Searched `diagnostics/*.json` (7 capture files present) — confirmed
   these record only the outgoing POST body (written by
   `PATHFINDER_DEBUG_CAPTURE`), never the API's response, so they carry no
   evidence of a server-side limit either way.
2. Fetched PathfinderEdge's own public docs
   (`https://docs.amscontrols.com/pathfinderEdge/profile-object` and
   `.../publicapi`) — `description` is documented only as "Free text. This
   travels to the machine," with no length constraint stated in either doc.
3. **Deliberately did NOT run a live over-length test against the real
   API.** `POST /api/v1/profiles` writes directly into catalog 20115 — the
   one real PathfinderEdge catalog the physical Thalmann DS2801 polls and
   picks up automatically (see `AFS_MACHINE_CATALOG_ID` and this file's own
   header comment) — an irreversible, shop-floor-visible production side
   effect. Not something to trigger from an unattended session without
   Reid's explicit go-ahead, so it wasn't done. **No truncation is applied
   as a result.** The full priority order to apply if a real limit is ever
   found (documented in a code comment at the composition site in
   `pathfinder-edge.ts`, right above `composeDescription`): truncate the
   identity string only, never the "AFS profile `<profileNumber>`"
   reference text, dropping/truncating in this order — `po_number` first,
   then `clientBusinessName`, then `requestedBy`, then `clientName`, then
   `finish`.

**Profile title on push (`nameEn`) — the two send paths do NOT share an
identical concept of "user-set name," verified independently rather than
assumed symmetric:**
- **`app/api/studio/send-to-pathfinder/route.ts` (direct FlashDraft
  send):** the client (`app/studio/draft/page.tsx`'s `sendToPathfinder()`)
  previously ALWAYS sent a generated string
  (`` `FlashDraft ${material} ${gauge} ${timestamp}` ``) regardless of
  whatever the user had typed into the canvas's own editable
  `profileName` state — that state was never read by this function before
  this prompt. Now: if the user has renamed the canvas profile away from
  the `'Untitled Profile'` default (via the name editor, or by loading a
  saved/library profile), that real name is sent; otherwise the exact same
  generated fallback as before.
- **`app/api/admin/command-center/approve-quote-request/route.ts`
  (Command Center approval):** confirmed by reading
  `quote_requests.line_items` end to end that NO submission surface —
  including FlashDraft's own `submitQuoteRequest` — ever sent a
  `profileName` field before this prompt; this route always used
  `describeItem()` (`profileType — material — gauge`). There was
  genuinely no "user-set name" concept reaching this route at all. Fixed
  by having FlashDraft's `submitQuoteRequest` include the item's
  `profileName` field only when the canvas name is real (same non-default
  check as above); this route's new `resolveItemProfileName()` uses it
  when present, falling back to the exact same `describeItem()` format
  otherwise — unchanged behavior for every non-FlashDraft item and for
  any FlashDraft item where the user never renamed the canvas.

**Shop View focus card (`components/admin/ShopViewBoard.tsx`, afs-cv-004)
and Profile Library table (`components/admin/ProfileLibraryTable.tsx`,
afs-sv-009/afs-cv-005) — both now display all five fields** (Business
Name, Client Name, PO Number, Requested By, Finish) alongside what each
already showed. Profile Library gained two new dedicated filter inputs
("Filter by business name…", "Filter by PO number…") in addition to its
existing search/source/status filters, and two new sortable columns for
each of the five fields where not already sortable. Both surfaces continue
excluding soft-deleted rows throughout — no change to that filter, it
already lived in `getShopProfileLibrary`/`getShopProfileLibraryFull`
(`lib/data/shop-profile-library.ts`), which both new selects extend rather
than replace.

Committed as `feat: job-identity fields end to end — submission surfaces,
Command Center edit, PathfinderEdge description, Shop View/Profile
Library display (afs-jf-003)`.

---

## ALUMINUM FINISH CHOICE (ANODIZED/PAINTED), SUPERSEDES AFS-CV-002'S ALUMINUM RULING (afs-jf-002): IMPLEMENTED, UNCONFIRMED — 2026-08-21

**Status: `pnpm tsc --noEmit` passes with 0 errors, run directly this
session. This prompt has a real browser surface (the same 4 wired surfaces
afs-cv-002/afs-jf-001 named) but this session had no browser/Playwright
access — per this file's verification standard it is marked
IMPLEMENTED/UNCONFIRMED until Reid opens each surface below, confirms the
Finish choice and both its color paths render/validate correctly, and
confirms a submitted request's `finish` value actually lands in the
database.**

**PRODUCTION-BLOCKING SEQUENCING NOTE — READ BEFORE DEPLOYING:**
`app/api/quote-requests/route.ts` now always writes a `finish` key on
every `quote_requests` insert (not just aluminum submissions — the key is
present, `null` for non-aluminum items). `supabase/migrations/
018_job_identity_and_finish.sql` (afs-jf-000), which adds
`quote_requests.finish`, is still recorded FILE-ONLY / NOT applied to the
live Supabase project as of this entry (see the afs-jf-000 entry below —
no session has re-verified this changed). **If this code ships before
migration 018 is applied live, EVERY quote-request submission through all
four surfaces — not just aluminum ones — will fail** (Postgrest rejects an
insert referencing a column that doesn't exist). Apply migration 018 live
and confirm it via `information_schema` (the same standard used for 017)
before or immediately upon deploying this commit.

**Supersedes afs-cv-002's ruling, and why:** afs-cv-002 mapped the
`aluminum` material category (currently only "Anodized Aluminum") straight
to the PAC-CLAD palette, unconditionally. That's wrong: an aluminum item
can be genuinely mill/anodized-finish with no painted coating at all, in
which case PAC-CLAD (a painted-color chart) doesn't apply. This prompt
replaces that blanket rule with a required Finish choice — "Anodized" or
"Painted" — for every `aluminum`-category material, on all four surfaces
afs-cv-002 wired. The `painted_steel` category (Kynar 500 Painted Steel,
Vintage Steel → McElroy, always required) is completely untouched — it
never had a finish concept and this prompt doesn't give it one.

**"Painted" finish** → same PAC-CLAD picker as before (`ColorField`,
`palette="pacclad"`, the same 51-entry `pacclad` array), required.
**"Anodized" finish** → a required free-text "Specify Anodized Color"
input instead, because no `pacclad_anodized` chart exists yet (AFS is
waiting on the physical PAC-CLAD anodized chart, expected within days).

**Future-swap hook, so a later prompt doesn't have to touch UI code:**
`lib/data/metal-colors.ts` now exports an empty `pacclad_anodized:
MetalColor[] = []` array. `colorPaletteForMaterial()` in
`lib/data/material-color-requirement.ts` branches on
`pacclad_anodized.length > 0` (a FUTURE-SWAP HOOK comment marks the exact
line), not on a hard-coded "Anodized always means free text" rule. The new
`components/quote/FinishColorField.tsx` — the single component all four
surfaces render for aluminum materials — reads that palette result and
renders either the real `ColorField` picker or the free-text fallback.
**The only change a future prompt needs to make is populating
`pacclad_anodized` with real `{ name, hex }` entries** (mirroring
`pacclad`) — no page, no component, no other function needs to change; the
real picker starts rendering everywhere automatically. `ColorField.tsx`,
`ColorPickerModal.tsx`, and `findMetalColorByName()` are already wired for
the `'pacclad_anodized'` palette key today, ahead of that data existing, so
that swap is genuinely a data-only change.

**New file:** `components/quote/FinishColorField.tsx` — required Finish
toggle (Anodized/Painted) + the conditional color control described above,
shared by all four surfaces exactly like `ColorField.tsx` already was.

**`lib/data/material-color-requirement.ts` — new/changed exports:**
`AluminumFinish` ('Anodized' | 'Painted'), `requiresFinishChoice()`,
`materialRequiresColorValue()`, `isColorRequirementSatisfied()` (replaces
the old, now-incorrect `!colorPalette || color.trim() !== ''` check — that
check silently passed for an unfinished Anodized item, since
`colorPaletteForMaterial` legitimately returns `null` for 'Anodized' even
when a color value is still required), and `colorRequirementErrorMessage()`.
`colorPaletteForMaterial()` gained a second `finish` parameter.

**Four wired surfaces, each updated the same way — Finish state added
alongside existing material/color state, reset together on material
change, threaded into validation and the `/api/quote-requests` POST body
as top-level `finish`:**
1. `app/quote/page.tsx` (Quote Builder) — `QuoteFormData.finish`, shown in
   the step-4 review table next to Color.
2. `app/configure/page.tsx` (Configurator) — `ConfiguratorForm.finish`.
3. `app/studio/draft/page.tsx` (FlashDraft) — `finish` state, added to
   `AutosaveState` and both the autosave restore/write effects (a new
   `isAluminumFinishShape()` guard validates the restored value).
4. `app/upload/page.tsx` (Blueprint Takeoff AI) — per-item `TakeoffItem.
   colorFinish` (deliberately NOT named `finish` — see below), composed
   into a single `"ProfileType: Finish"`-joined request-level string via a
   new `buildRequestFinish()`, mirroring the existing `buildRequestColor()`
   pattern for this table's multi-item-per-request shape.

**Naming collision found and deliberately avoided:** `TakeoffItem` in
`app/upload/page.tsx` already had an unrelated `finish: string | null`
field — a free-text finish note the takeoff AI extracts off the drawing
(see `app/api/takeoff/route.ts`'s JSON schema), never displayed, edited, or
submitted anywhere, and never constrained to "Anodized"/"Painted". Reusing
it for this prompt's controlled Anodized/Painted choice would have silently
conflated two different concepts. The new field is named `colorFinish`
instead; the pre-existing `finish` field is untouched.

**Kynar/painted-steel path confirmed unchanged beyond genuinely shared
code** (`ColorField.tsx`, `colorPaletteForMaterial()`'s `painted_steel`
branch) — no McElroy-path behavior was altered.

**No existing "finish" concept found for the McElroy/painted-steel path**
before this prompt — checked `EstimatorLineItem`, the takeoff AI schema,
and every McElroy call site. `quote_requests.finish` is left `null`/unset
for painted-steel submissions, as instructed; this prompt did not invent a
finish value for a material that was never asked a finish question before.

**Command Center visibility:** `app/admin/quote-requests/page.tsx` (list)
and `.../[id]/page.tsx` (detail) now show a `finish` `Badge` (chrome
variant, plain text — no swatch, since Finish has no color of its own)
immediately next to the existing `ColorSwatchChip` (afs-cv-003), in both
the list row and the detail page's Project Details panel and per-item
table. `lib/data/admin.ts`'s `getQuoteRequestsQueue()` now selects and
returns `finish` alongside `color`.

Committed as `feat: aluminum Finish choice (Anodized/Painted), supersedes
PAC-CLAD-on-all-aluminum ruling (afs-jf-002)`.

---

## COLOR PICKER MODAL — BACK BUTTON NO LONGER NAVIGATES AWAY (afs-jf-001): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors (verified this session).
Root cause and fix both confirmed directly against a real running dev
server via ad hoc Playwright scripts this session (not committed — scratch
files, deleted after use), not from code reading alone. Per this file's
verification standard, this is IMPLEMENTED/UNCONFIRMED, not DONE, until
Reid independently confirms the Back-button behavior himself on every
wired surface listed below.**

**Surface list re-verified, not assumed from the prior afs-cv-002 entry:**
grepped the whole repo for `ColorPickerModal`/`ColorField` — the only real
wiring surfaces are the same four afs-cv-002 named: `app/studio/draft/
page.tsx` (FlashDraft), `app/configure/page.tsx` (Configurator),
`app/quote/page.tsx` (Quote Builder), `app/upload/page.tsx` (Blueprint
Takeoff AI). All four import `ColorField`, never `ColorPickerModal`
directly, so the fix lives in one place (`ColorPickerModal.tsx`) and
covers all four automatically. No fifth surface exists.

**Root cause, confirmed live:** `ColorPickerModal.tsx` was a plain
conditional-render `fixed inset-0` overlay driven only by its `isOpen`
prop — opening it never pushed a browser history entry, so it had nothing
modal-specific for a Back press to intercept. A Playwright script driving
a real dev server confirmed this directly: on `/quote`, selecting a
color-required material (Kynar 500 Painted Steel), opening the picker,
then calling `page.goBack()` navigated the tab away from `/quote`
entirely (to whatever page actually preceded it in history) instead of
closing the modal. Same confirmed on `/studio/draft` navigated to from
`/studio` — Back left FlashDraft and landed back on the Design Studio
home page, matching the reported symptom exactly.

**Fix, in `ColorPickerModal.tsx` only (full file replacement):** a
`useEffect` keyed on `isOpen` now calls `window.history.pushState(...)`
when the modal opens and adds a `popstate` listener that calls `onClose()`
— so a Back press closes the modal and lands back on the exact
underlying page state, nothing else navigates. If the modal is instead
closed via its own Close button or by selecting a color, the effect's
cleanup calls `window.history.back()` to pop that same pushed entry
(guarded by a ref so the resulting `popstate` doesn't re-trigger
`onClose` a second time) — this prevents the pushed entry from lingering
as a stray forward-navigable entry that would otherwise silently absorb
the user's next real Back press.

**Verified live this session (Playwright against `pnpm dev`, scripts not
committed):**
1. `/quote` — Back while the picker is open: modal closes, URL stays
   `/quote`, in-progress `#material` field value (`Kynar 500 (Painted
   Steel)`) preserved.
2. `/quote` — reopen picker, close via the Close button, then a real
   Back press: URL goes to the actual prior page (not swallowed by a
   stray entry) — confirms the cleanup-on-Close path works.
3. `/studio` → `/studio/draft` → open picker → Back: stays on
   `/studio/draft`, does not fall through to `/studio` (Design Studio
   home) as it did before the fix.

**Not independently re-verified in a browser this session:**
`app/configure/page.tsx` and `app/upload/page.tsx` specifically — both
wire the identical shared `ColorField`/`ColorPickerModal` pair with no
surface-specific override, so the same fix applies, but only `/quote` and
`/studio/draft` were driven end-to-end this session. Reid's own
confirmation pass should still cover all four surfaces, not just these
two.

**Related issue, noted but NOT fixed (out of scope — not implicated in
this bug):** `components/ui/Modal.tsx`, the shared modal used across most
of `/admin` and `/account` (`ProfileLibraryTable`,
`CommandCenterJobCard`, `BidsCrmTab`, `CreditApplicationReviewModal`,
`OrdersCrmTab`, `CustomerDetailDrawer`, `StatusAdvancer`,
`TemplateCreateModal`, `ProjectEditModal`, `ProjectCreateModal`,
`InviteTeamMemberModal`, `DocumentUploadForm`, and others), has the exact
same plain-overlay-without-a-history-entry pattern — no `pushState`, no
`popstate` listener. A Back press while any of those modals is open would
likely exhibit the same navigate-away bug. This was not touched here
since none of those surfaces wire `ColorPickerModal`/`ColorField` and
fixing it was outside this task's scope.

Committed as `fix: ColorPickerModal Back button closes the picker instead
of navigating away (afs-jf-001)`.

---

## PROFILE LIBRARY QUEUE REORDERING ADDED (afs-cv-005): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors (verified this session).
`pnpm run build` completes successfully (verified this session). This session
had no browser/Playwright access — per this file's verification standard,
this is IMPLEMENTED/UNCONFIRMED, not DONE, until Reid opens
`/admin/profile-library` in a real browser, uses the up/down controls, and
confirms the row order actually persists across a page reload. Carried the
same migration-017 dependency afs-cv-003/afs-cv-004 already documented
below: `shop_profile_library.queue_position` (migration
`017_color_and_queue_position.sql`, afs-cv-000) is now **CONFIRMED APPLIED
LIVE** (see the afs-cv-000 entry below) — that dependency is closed; Reid
still needs to confirm in a real browser that reordering, persistence
across reload, and append-to-end all behave correctly, per the note
above.**

Read `app/admin/profile-library/page.tsx` (afs-sv-009) and afs-cv-004's Shop
View queue-strip implementation in full first, per the task's own
instruction, so both surfaces stay driven by the same `queue_position`
ordering model.

- **Reordering approach: explicit up/down buttons per row, not
  drag-to-reorder.** This codebase has no drag-and-drop library anywhere in
  `package.json`; adding one solely for this one table would have been
  disproportionate to the need. A code comment states this choice and the
  reasoning at the implementation site — `components/admin/
  ProfileLibraryTable.tsx`'s `moveRow` function and the surrounding "Queue"
  column.
- **Full file replacements** (not patches): `components/admin/
  ProfileLibraryTable.tsx`, `lib/data/shop-profile-library.ts`. New file:
  `app/api/admin/profile-library/reorder/route.ts` (PATCH).
- **New "Queue" column**, leftmost in the table: shows each row's rank (1..N)
  in the canonical queue order plus ▲/▼ buttons. The rank and the buttons'
  up/down behavior are always computed from the FULL row set, independent of
  the table's own search/filter/column-sort controls — "shop priority" is a
  global ordering, not a property of whatever subset happens to be visible.
  Reuses the exact `compareShopProfileLibraryQueueOrder` comparator
  afs-cv-004's Shop View queue strip already sorts by (`queue_position`
  ascending, nulls last → `due_date` ascending, nulls last → `created_at`
  ascending as the final tiebreak) — that comparator's signature was
  generalized from `ShopProfileLibraryFullRow`-specific to a small structural
  `QueueOrderFields` interface so both `ShopProfileLibraryRow` (this table)
  and `ShopProfileLibraryFullRow` (Shop View) satisfy it without a cast, per
  this task's explicit requirement that both surfaces be driven by the exact
  same ordering model.
- **Persistence:** clicking ▲/▼ swaps the row with its canonical-order
  neighbor, then PATCHes `app/api/admin/profile-library/reorder` with the
  FULL ordered id list for every currently active (non-deleted) row — not
  just the two that moved — which writes `queue_position = index + 1` for
  every one of them in that same request. This is required, not just tidy:
  `compareShopProfileLibraryQueueOrder` always sorts a null `queue_position`
  AFTER any explicit one, so a table with a mix of explicit and null
  positions doesn't behave like one ordered list — updating only the moved
  pair could jump them ahead of every untouched (still-null) row instead of
  just swapping with a neighbor. Writing the whole set keeps it a gapless
  1..N sequence. The route validates the posted id list is exactly a
  permutation of the current active row set before writing anything, and
  logs the action via `logAdminAction`. Optimistic UI update on click, with
  rollback and an inline error banner if the request fails.
- **New sends append to the end of the queue on insert.** Both real
  PathfinderEdge-send call sites already went through the single shared
  `insertShopProfileLibraryRecord` (`lib/data/shop-profile-library.ts`), so
  this only needed to change in one place. That function now calls a new
  `appendToQueueEnd` helper before every insert, which:
  1. Reads every current non-deleted row's `id`/`queue_position`/`due_date`/
     `created_at`.
  2. Sorts them into the same canonical queue order as above.
  3. If any row's stored `queue_position` doesn't already match its rank in
     that order (i.e. the table has never been normalized — true for every
     row today, since nothing has ever written this column before this
     prompt), **writes a real sequential `queue_position` to every one of
     them first.**
  4. Returns `existing row count + 1` as the new row's position.

  Step 3 is not optional scope creep — it is the fix for a real bug the
  literal instruction ("`queue_position` = current max among non-deleted
  rows, plus 1, never a default that would place a new send ahead of
  existing queued work") would otherwise still have. Before any row anywhere
  has an explicit `queue_position`, a plain `MAX(queue_position) + 1` is `1`,
  since nothing has a value to max over yet — and
  `compareShopProfileLibraryQueueOrder` sorts ANY explicit position before
  ANY null one, regardless of magnitude. So a naive "MAX+1" implementation
  would rank a brand-new send ahead of every pre-existing (still-null)
  queued row on its very first use — the exact bug the instruction calls
  out. Normalizing the whole active set to a real sequence first (once,
  self-healing after that) is the only way an appended position can
  actually land after all of it. This is a no-op after the first time it
  runs against a given table state, since the table stays sequential from
  then on.
- Soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from all of the
  above — the queue-order comparison, the rank shown in the Queue column,
  and `appendToQueueEnd`'s normalization pass — via the same
  `.is('deleted_at', null)` filter every read/write in this file already
  uses. No second filter implementation introduced.
- Colors: afs-* tokens only (`afs-chrome-mid`, `afs-crimson`,
  `afs-crimson-dim`, `afs-chrome-high`, `afs-border`) — no default Tailwind
  colors, no new literal hex values, no new CANVAS_COLORS-style exception.

Committed as `feat: add operator-controlled queue reordering to Profile
Library, writing shop_profile_library.queue_position (afs-cv-005)`.

---

## SHOP VIEW REWORKED TO ONE-JOB FOCUS MODE (afs-cv-004): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors (verified this session).
`pnpm run build` completes successfully (verified this session). This
session had no browser/Playwright access — per this file's verification
standard, this rework is IMPLEMENTED/UNCONFIRMED, not DONE, until Reid opens
`/admin/shop-view` in a real browser and confirms the focus layout, the
queue-strip chip switching, and the completion flow all behave correctly.
Still carries afs-sv-010's same dependency on migration 016
(`shop_profile_library`) — CONFIRMED applied live (see afs-sv-010 entry
below) — plus migration 017 (`color`/`queue_position`/`completed_at`,
afs-cv-000), now also **CONFIRMED APPLIED LIVE** (see the afs-cv-000 entry
below) — that dependency is closed too; the queue-position ordering, the
completion write, and the color swatch still need their own browser
confirmation, per the note above.**

This supersedes afs-sv-010's side-by-side multi-card grid layout (entry
below, kept for history) with a one-job-at-a-time focus layout, per this
task's explicit instruction:

- **Full file replacements** (not patches): `app/admin/shop-view/page.tsx`,
  `components/admin/ShopViewBoard.tsx`. Also touched: `lib/data/shop-
  profile-library.ts` (added `color`/`queuePosition`/`completedAt` to
  `ShopProfileLibraryFullRow` and its query; added a new shared
  `compareShopProfileLibraryQueueOrder` export) and `app/api/admin/profile-
  library/[id]/route.ts` (the PATCH handler — see completion behavior
  below).
- **Focus panel:** one job full-screen — `geometry_svg` rendered as large as
  the viewport allows (`h-[calc(100vh-280px)]` on large screens) beside a
  fields column: order number, customer name/company, contact info, account
  notes, material/gauge, quantity/length, a visually prominent color-coded
  due-date banner, hem instructions, a painted-edge badge, special
  instructions, the source-tool badge, the PathfinderEdge profile id, and
  the status-advance control. A color swatch + name renders when
  `shop_profile_library.color` (afs-cv-003) is set, using the same
  CANVAS_COLORS-style literal-hex exception `ColorSwatchChip.tsx` already
  documents — cleanly absent (no empty swatch row) when `color` is null.
- **Numbered queue strip** in the page header: one chip per active
  (non-complete) job, ordered by the new `compareShopProfileLibraryQueueOrder`
  (`queue_position` ascending, nulls last → `due_date` ascending, nulls last
  → `created_at` ascending as the final tiebreaker). The chip for whichever
  job is currently focused renders larger/filled (`afs-crimson`); focus
  defaults to position 1 (top of the queue) on load and whenever the
  previously-focused job drops out of the active set. Chips for jobs whose
  `due_date` is in the past render in the `afs-crimson`/`afs-crimson-dim`
  overdue treatment. Clicking a chip calls `setFocusedId` — no page reload,
  no route change.
- **Completion:** the existing `queued -> in_progress -> complete` advance
  control (`nextShopProfileLibraryStatus`, unchanged) now — when the next
  status is `complete` — has the PATCH route write `status` and
  `completed_at = now()` in the **same** `UPDATE` call, so a row can never be
  `complete` with a null `completed_at`. The completed job is filtered out of
  `activeRows` (status !== 'complete'), which drops it from both the focus
  panel and the queue strip; a `useEffect` watching `activeRows` then
  auto-refocuses to whatever is now first in queue order. An explicit code
  comment sits at the actual write site (the PATCH handler in
  `app/api/admin/profile-library/[id]/route.ts`) stating this fires **no**
  delivery/invoice/email side effects — `completed_at` is purely an event
  record for a future automation chain to consume later.
- **"Show Completed Today" toggle** in the header reveals a separate
  read-only panel listing jobs with `status = 'complete'` and `completed_at`
  falling on the current local calendar day (`toDateString()` comparison) —
  profile name, customer/company, completed time. These never appear in the
  active queue strip or focus rotation.
- Same 30-second polling pattern as afs-sv-010 (`GET /api/admin/shop-
  profile-library`, unchanged) — no Realtime dependency introduced, per the
  task's explicit instruction to keep the existing mechanism.
- Soft-deleted rows (`deleted_at IS NOT NULL`) continue to be excluded via
  the same single `getShopProfileLibraryFull` query afs-sv-009/010
  established — no second filter implementation introduced.
- Colors: afs-* tokens only, reusing the exact same token set afs-sv-010's
  card layout already used (`afs-crimson`, `afs-crimson-dim`, `afs-warning`,
  `afs-amber-dim`, `afs-success`, `afs-info`, `afs-chrome-*`) plus the
  pre-existing swatch-chip literal-hex exception for the color swatch fill —
  no new exception introduced, no default Tailwind colors.

Committed as `feat: rework Shop View to one-job-at-a-time focus mode with
numbered queue strip (afs-cv-004)`.

---

## SHOP VIEW — SHOP-FLOOR OPERATOR DISPLAY ADDED (afs-sv-010): SUPERSEDED BY afs-cv-004 — kept for history, do not treat as current UI

**The side-by-side multi-card grid layout described below was replaced by
afs-cv-004's one-job focus-mode layout (entry above). The API routes, data
layer, and polling mechanism this entry describes are still the ones
afs-cv-004 builds on — only `components/admin/ShopViewBoard.tsx` and
`app/admin/shop-view/page.tsx`'s presentation changed.**

**Status: `pnpm tsc --noEmit` passes with 0 errors (verified this session).
`pnpm run build` completes successfully (verified this session). This
session had no browser/Playwright access and the user has not yet seen the
page — per this file's verification standard, Shop View is UNCONFIRMED, not
DONE, until the user opens `/admin/shop-view` in a real browser (ideally on
the actual laptop that will sit beside the PathfinderEdge/Thalmann screen)
and confirms both the layout is legible at a glance and the status-advance
control actually persists.**

**Status: `pnpm tsc --noEmit` passes with 0 errors (verified this session).
`pnpm run build` completes successfully (verified this session). This
session had no browser/Playwright access and the user has not yet seen the
page — per this file's verification standard, Shop View is UNCONFIRMED, not
DONE, until the user opens `/admin/shop-view` in a real browser (ideally on
the actual laptop that will sit beside the PathfinderEdge/Thalmann screen)
and confirms both the layout is legible at a glance and the status-advance
control actually persists.**

**Depended on migration 016 (`shop_profile_library`, afs-sv-007) being
applied live — same dependency afs-sv-008/009 carried. That dependency is
now resolved and CONFIRMED via `information_schema`: Reid ran migration 016
in the Supabase Dashboard SQL Editor on 2026-08-20, then independently
verified both `shop_profile_library` and `quote_requests.source_tool` exist
via a direct `information_schema` query in the Dashboard (see the
afs-sv-007 entry below). No session yet has had a working Supabase MCP
connection to this project's actual instance to run that check itself,
only to unrelated "tarritrix"/"tarritrix-audit" projects — this
confirmation is Reid's own, done directly in the Dashboard.**

Built exactly what the task asked for:
- `app/admin/shop-view/page.tsx` — server component, admin-gated via
  `requireAdminUser`, initial data from a new `getShopProfileLibraryFull`
  query (`lib/data/shop-profile-library.ts`) added alongside the existing
  `getShopProfileLibrary` (afs-sv-009) — same table, same
  `deleted_at IS NULL` filter, same admin-only RLS, wider column selection
  (order number, contact info, account notes, length, hem/paint/special
  instructions, PathfinderEdge profile id) since Profile Library's own
  query doesn't need those columns and Shop View does.
- `components/admin/ShopViewBoard.tsx` — client component. Filters by
  customer, profile, material, status, and due date (overdue / due today /
  due this week / no due date); sorts by customer, profile, material,
  status, or due date, either direction. Each card renders `geometry_svg`
  large (up to `h-96`) for a direct side-by-side against the physical
  machine screen, plus order number, customer name/company, contact info,
  account notes, material/gauge, quantity/length, a visually prominent
  color-coded due-date banner (crimson if overdue/due today, amber if due
  within 3 days), hem instructions, a painted-edge badge that always shows
  YES or NO (never silently omitted), a highlighted special-instructions
  box when present, the source-tool badge (afs-sv-008's `Badge` component,
  reused — not reinvented), and the PathfinderEdge profile id.
- One-click status advance (`queued -> in_progress -> complete`) — new
  `PATCH` handler added to the existing
  `app/api/admin/profile-library/[id]/route.ts` (same file DELETE already
  lives in, same admin-gate/audit-log pattern, since both operate on the
  same `shop_profile_library` row by id). Optimistic UI update, reverts and
  shows an error banner if the request fails. Status validity and the
  `queued -> in_progress -> complete -> (none)` sequence live in one place
  (`isShopProfileLibraryStatus` / `nextShopProfileLibraryStatus` /
  `shopProfileLibraryStatusLabel`, all in `lib/data/shop-profile-library.ts`)
  so the API route's validation and the client's button logic can't drift
  apart.
- 30-second polling via a new `GET /api/admin/shop-profile-library` route
  (admin-gated, calls the same `getShopProfileLibraryFull`) — explicitly
  polling, not Realtime, per the task's own instruction to prefer the
  simpler mechanism here.
- "Shop View" added to the Command Center header nav in both of its render
  branches (dashboard view and tab view), reusing the exact same
  `PROFILE_LIBRARY_NAV_LINK_CLASSNAME` constant Profile Library's own link
  uses, so the two links cannot visually drift apart.
- Colors: afs-* tokens only (`afs-crimson`, `afs-warning`, `afs-amber-dim`,
  `afs-success`, `afs-info`, `afs-chrome-*`) — no new literal hex values,
  no canvas involved so the CANVAS_COLORS exception doesn't apply here.

**Known data gap, found while building this (not something this task asked
to fix, noting it so the next session doesn't have to rediscover it):**
`shop_profile_library.hem_instructions`, `.painted_edge`, `.special_instructions`,
and `.order_number` are real columns (migration 016) that Shop View reads
and renders correctly, but **no current write path populates them.**
Grepped both real insert call sites —
`app/api/admin/command-center/approve-quote-request/route.ts` and
`app/api/studio/send-to-pathfinder/route.ts` — and `insertShopProfileLibraryRecord`'s
own parameter list (`lib/data/shop-profile-library.ts`): neither passes
`hemInstructions`, `paintedEdge`, `specialInstructions`, or `orderNumber`
through, even though `hemStart`/`hemEnd` data is already available at both
call sites for the PathfinderEdge push itself. Every row inserted so far
will show "—" / "Painted Edge: No" for these fields on Shop View regardless
of the job's real hem/paint/special-instruction content. Wiring that
through is a future task, not part of afs-sv-010.

---

## COLOR SWATCH IN COMMAND CENTER QUOTE VIEWS, shop_profile_library.color WRITE-THROUGH ON BOTH PATHFINDEREDGE SEND PATHS (afs-cv-003): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors, verified this session.
This prompt touches two real browser surfaces (the Command Center
quote-request list and detail views) but this session had no browser/
Playwright access — per this file's verification standard it is marked
IMPLEMENTED/UNCONFIRMED until Reid opens both views and confirms the
swatch renders, and separately confirms a real PathfinderEdge send from
each of the two send paths actually writes `shop_profile_library.color`.
Migration 017 (`quote_requests.color` /
`shop_profile_library.color`, afs-cv-000) is now **CONFIRMED APPLIED
LIVE** (see the afs-cv-000 entry below) — that dependency is closed; the
swatch display and the write paths below still need their own
browser/live-send confirmation, per the note above.**

**Re-verified the task's premise before touching anything:** grepped every
caller of `pushProfileToPathfinder` across the codebase.
`app/api/admin/command-center/approve-quote-request/route.ts` and
`app/api/studio/send-to-pathfinder/route.ts` are confirmed to still be the
only two call sites that also write a `shop_profile_library` row (via
`insertShopProfileLibraryRecord`) — matching `lib/data/shop-profile-
library.ts`'s own header comment from afs-sv-009. **Found a third real send
path not in the task's list:** `app/api/admin/command-center/approve/
route.ts` (POST, approves a `machine_jobs` row directly by `jobId`) also
calls `pushProfileToPathfinder` for real and is wired to a real UI button
(`components/admin/CommandCenterJobCard.tsx`'s approve action) — it is not
a stub. However, this route has **no `insertShopProfileLibraryRecord` call
at all** — it never creates or updates a `shop_profile_library` row, so
there is no write point for this task's `color` column to populate there.
This is a pre-existing gap from afs-sv-009 (which only wired the
quote-request-approval and FlashDraft-direct-send paths to
`shop_profile_library`, not this machine-jobs-approval path), not something
this task's scope covers — noted here rather than silently expanded into.
`app/api/admin/pathfinder/push-profile/route.ts` also calls
`pushProfileToPathfinder` but is confirmed via `SITEMAP.md` ("POST —
stubbed, not live") and has no UI caller — not a real send path.

**Command Center display (2 views):**
- `app/admin/quote-requests/page.tsx` (list view) — `getQuoteRequestsQueue`
  (`lib/data/admin.ts`) now selects and returns `color`; the "Profiles"
  column (the only per-row spec-summary column that exists in this table —
  there is no separate material column to piggyback on) renders a new
  `ColorSwatchChip` next to the profile summary text when `color` is set.
- `app/admin/quote-requests/[id]/page.tsx` (detail view) — the "Submitted
  Specification" table's existing "Material / Gauge" column now also
  renders `ColorSwatchChip` (request-level `color` repeated on every line
  item row, since the schema stores one `color` per request, not per
  item). The pre-existing plain-text "Color" row in the Project Details
  panel was left in place and additionally upgraded to use the same
  `ColorSwatchChip` component instead of raw text, for visual consistency.
- New shared component `components/quote/ColorSwatchChip.tsx` — matches
  `Badge`'s chip styling (`components/ui/Badge.tsx`: border-afs-chrome-dim,
  font-label, rounded, text-afs-chrome-mid) with the status dot swapped for
  a real swatch. New `findMetalColorByName()` helper added to
  `lib/data/metal-colors.ts` to resolve a stored color name back to a hex
  for the swatch — since `quote_requests.color`/`shop_profile_library.color`
  store only the name with no palette marker, and a few names exist in both
  the McElroy and PAC-CLAD charts with different hex values (e.g.
  "Charcoal", "Hartford Green", "Galvalume Plus"), the lookup checks
  McElroy first, then PAC-CLAD, and returns the first match — a known,
  documented limitation of the underlying single-TEXT-column schema, not
  something this task's scope included fixing.
- **No second CANVAS_COLORS-style exception introduced** — the swatch
  chip's inline `style={{ backgroundColor }}` reuses the same exception
  already documented in `ColorPickerModal.tsx` (afs-cv-002), just
  referenced from a new call site.

**shop_profile_library.color write-through (2 send paths):**
- `app/api/admin/command-center/approve-quote-request/route.ts` —
  `quote_requests` select now includes `color`; every
  `insertShopProfileLibraryRecord` call (one per line item) passes
  `color: qr.color` alongside the material/gauge it already passed.
- `app/api/studio/send-to-pathfinder/route.ts` — this route has no source
  `quote_request` at all (confirmed in its own header comment: "never tied
  to a quote_request/machine_job"), so `color` is threaded the same way
  `material`/`gauge` already are here: as a new optional field on the
  request body, populated client-side from FlashDraft's own `color` state
  (`app/studio/draft/page.tsx`'s `sendToPathfinder()`, which already has a
  `ColorField`-backed `color` state for its own quote-request submission
  path) and passed straight through to `insertShopProfileLibraryRecord`.
- `lib/data/shop-profile-library.ts` — `ShopProfileLibraryInsert.color`
  added and written into the insert alongside `material`/`gauge`.

**Deviation from the task's "full file replacement, not a patch"
instruction:** every file changed was written in full via `Write` except
`app/studio/draft/page.tsx` (3,748 lines) — reconstructing that file's
entire content by hand in a single tool call risked transcription errors
at that size, so a single precise `Edit` (exact string match, not a
diff/patch apply) was used there instead, adding one field to the
`sendToPathfinder()` request body. Flagging this explicitly rather than
silently deviating.

Committed as `feat: show selected color in Command Center quote views,
populate shop_profile_library.color on both send paths (afs-cv-003)`.

---

## FULL-PAGE COLOR PICKER, REQUIRED FOR PAINTED/ANODIZED MATERIALS (afs-cv-002): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors, verified this session.
This prompt has a real browser surface (4 existing pages gained a new
required field) but this session had no browser/Playwright access — per
this file's verification standard it is marked IMPLEMENTED/UNCONFIRMED
until Reid opens each of the four surfaces below, confirms the picker
renders and filters correctly, and confirms a submitted request's `color`
value actually lands in the database. Migration 017
(`quote_requests.color`, afs-cv-000) is now **CONFIRMED APPLIED LIVE**
(see the afs-cv-000 entry below) — that dependency is closed; a real
submission through each of the four surfaces below still needs to be
checked in the database to confirm `color` actually persists
end-to-end.**

**Real material-selection surfaces found and wired — confirmed by grepping
the codebase, then cross-checked against the closed `SourceTool` union in
`lib/data/quote-request-source-tool.ts` (exactly 4 tokens, matching exactly
these 4 surfaces, with no unaccounted 5th):**
1. `app/studio/draft/page.tsx` (FlashDraft, `sourceTool: 'afs-flashdraft'`)
2. `app/configure/page.tsx` (Custom Flashing Configurator,
   `'afs-configurator'`) — this **is** the real, wired implementation of
   SPEC_FLASHING_CONFIGURATOR.md; no separate/different configurator route
   exists.
3. `app/quote/page.tsx` (Quote Builder, `'afs-quote-builder'`)
4. `app/upload/page.tsx` (Blueprint Takeoff AI results table,
   `'afs-takeoff'`) — not in the task's own "known real candidates" list,
   found by the required codebase grep; each extracted line item has its
   own editable material `<select>`, so this one got a **per-row** color
   field rather than a single page-level one (see below).

**Surfaces checked and confirmed NOT material-selection surfaces (read-only
reference/browse pages, no wiring added):** `app/(public)/architects/
finish-palette/page.tsx` (browses the separate `finishes` table, not the
McElroy/PAC-CLAD charts), `app/(public)/architects/custom-profiles/page.tsx`,
`app/(public)/architects/cad-library/page.tsx`, and `app/admin/quote-
requests/[id]/page.tsx` (admin estimator review — displays the customer's
already-submitted material/gauge/color read-only via `QuoteEstimatorForm`;
a `color` display line was added here so the new column is actually visible
to estimators, but no new *selection* input).

**New files:**
- `lib/data/material-color-requirement.ts` — maps each of the 9 material
  label strings used by the UI (which differ slightly in wording from the
  seeded `materials.name` values, e.g. "Galvanized Galvalume" vs. DB's
  "Galvalume Steel") to the real `materials.category` value from
  `supabase/migrations/002_seed_afs_data.sql`. `painted_steel` (Kynar 500
  Painted Steel, Vintage Steel) → McElroy required; `aluminum` (Anodized
  Aluminum, the only seeded aluminum material) → PAC-CLAD required; every
  other category → no color field.
- `components/quote/ColorPickerModal.tsx` — full-page modal, grid of swatch
  chips (hex background + name label) filterable by a search box. Chrome
  (frame/search/labels/layout) is afs-* tokens only; the swatch backgrounds
  are literal hex from `lib/data/metal-colors.ts`, documented as the same
  CANVAS_COLORS-pattern exception already used in `app/studio/draft/
  page.tsx` and `app/checkout/page.tsx` (CLAUDE.md rule #4).
- `components/quote/ColorField.tsx` — the required-field trigger (swatch
  preview button + validation message) that opens the modal, shared by all
  4 wired surfaces.

**Payload/schema:** `app/api/quote-requests/route.ts` now reads
`body.color` and writes it into `quote_requests.color`. On the 3
single-item surfaces (FlashDraft, Configurator, Quote Builder) this is a
straightforward 1:1 mapping. `app/upload/page.tsx`'s takeoff table can hold
several items with different color-requiring materials in one submission —
since `quote_requests.color` is a single column, `buildRequestColor()`
there composes one `"ProfileType: ColorName"` entry per item that needs a
color, semicolon-joined, rather than silently keeping only the first.

Committed as `feat: full-page color picker required for painted materials,
wired into FlashDraft/quote builder (afs-cv-002)`.

---

## METAL COLOR CHART DATA EXTRACTED FROM MCELROY + PAC-CLAD PDFs (afs-cv-001): IMPLEMENTED, UNCONFIRMED

**Status: `lib/data/metal-colors.ts` added, exporting two typed arrays,
`mcelroy` (18 colors) and `pacclad` (51 colors: 7 Premium + 5 Timber Series
Wood Grain + 39 Standard). `pnpm tsc --noEmit` passes with 0 errors,
verified this session. This prompt has no browser surface (a data file
only, no UI/API route consuming it yet) — per this file's verification
standard it is marked IMPLEMENTED/UNCONFIRMED, and specifically: the color
NAMES must be spot-checked by Reid against the two physical charts
(`public/Metal Color Charts/McElroy Shades of Distinction Roof and Wall
Panels.pdf` and `public/Metal Color Charts/PAC CLAD Color Guide-2025.pdf`)
before being trusted for fabrication or ordering.**

**Source pages used:** McElroy's PDF has no extractable text layer (both
pages are embedded raster scans) — the 18 names were read visually off
page 1's swatch grid (3 columns × 6 rows) and cross-checked against the
column headers of page 2's black-and-white "Product Availability" coil
matrix, which lists the same 17 coated-color names plus Galvalume Plus as
text. PAC-CLAD's PDF has a real text layer; page 2 (the full Premium +
Timber Series + Standard swatch grid) is the source of truth used — page 1
is a cover-page teaser repeating an 18-color subset of the same Standard
colors already covered on page 2, so it added no new names.

**Hex values are display-only approximations, not fabrication specs** —
stated explicitly in a comment at the top of `metal-colors.ts`. Method:
each PDF page was rendered to a high-resolution raster image
(PyMuPDF, zoom factor 3×), swatch cell boundaries were located (connected-
component / fixed-grid-pitch detection, confirmed against the visible
grid in each rendered page), and the median RGB of a center-inset sample
region per swatch was converted to hex. Several swatches are textured,
metallic, or wood-grain finishes that don't reduce to one flat color
(McElroy's Galvalume Plus and Cor-Ten AZP Raw; PAC-CLAD's Anodic Clear,
Silversmith, Silver, Weathered Zinc, Weathered Steel, and the five Timber
Series colors) — for these the median-sampled color is used as a
reasonable visual approximation, per the task's own instruction, rather
than left blank.

Committed as `feat: extract McElroy and PAC-CLAD color chart data into
lib/data/metal-colors.ts (afs-cv-001)`.

---

## COLOR + QUEUE_POSITION + COMPLETED_AT COLUMNS MIGRATION WRITTEN (afs-cv-000), THEN CONFIRMED APPLIED LIVE

**UPDATE 2026-08-21:** Reid ran migration 017 in the Supabase Dashboard SQL
Editor and confirmed it completed with no errors, then independently
verified all four new columns exist via a direct `information_schema`
query in the Dashboard — four `true` results, covering
`quote_requests.color`, `shop_profile_library.color`,
`shop_profile_library.queue_position`, and
`shop_profile_library.completed_at`. This closes the FILE-ONLY status this
entry originally recorded (see below for the original write-up, left
intact for history) with the same standard of evidence migrations
013/015/016 already carry. No session has had a working Supabase MCP
connection to this project's actual instance to run that check itself —
this verification was run by Reid directly in the Dashboard.

**Status: migration `017_color_and_queue_position.sql` written and
committed to `supabase/migrations/` — originally a FILE-ONLY change, per
the task's own instruction; now CONFIRMED APPLIED LIVE per the UPDATE note
above. `pnpm tsc --noEmit` passes with 0 errors. This prompt itself has no
browser surface to verify (it adds no UI, no API route, no data-fetching
code) — the migration is no longer the blocker for downstream prompts
(afs-cv-002 through afs-cv-005), each of which still needs its own
browser/Playwright confirmation independent of this.**

Confirmed before choosing the migration number: read every file in
`supabase/migrations/` (001 through 016) in full and cross-checked
SESSION_STATE.md's live-apply status notes; `016_source_tool_and_shop_
profile_library.sql` was in fact still the highest-numbered file on disk
(001–016, no gaps), so this migration is correctly numbered 017 — no
discrepancy to note.

**What it does:**
1. `ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS color TEXT` —
   nullable, additive, no default, no backfill needed.
2. `ALTER TABLE shop_profile_library ADD COLUMN IF NOT EXISTS color TEXT,
   ADD COLUMN IF NOT EXISTS queue_position INTEGER, ADD COLUMN IF NOT
   EXISTS completed_at TIMESTAMPTZ` — all three nullable, additive.

**No indexes added.** Checked the real pattern in migration 016 first,
per the task's own instruction not to invent a new convention: only 5 of
`shop_profile_library`'s ~20 columns got an index (`customer_name`,
`profile_name`, `status`, `due_date`, `created_at`) — plain nullable text
columns like `material`, `gauge`, `order_number`, `hem_instructions`, and
`pathfinder_profile_id` all got none. There is no "every nullable text
column gets a matching index" convention on this table to extend, so
`color` and `queue_position` were left unindexed, matching the
unindexed majority. No constraints or defaults were added either, per
the task's explicit instruction to add only what was listed.

`SCHEMA.md` updated: header table/migration-file counts (17 migration
files; table count unchanged at 54 since this migration adds no new
tables), the `MIGRATION FILE LOCATION` list, a new note on TABLE 15
(`quote_requests`) documenting `color`, and a new note in the SHOP
PROFILE LIBRARY TABLE section documenting `color`/`queue_position`/
`completed_at`, matching the depth and style of the existing 016 notes
in both places.

Committed as `feat: add color, queue_position, completed_at columns
migration, file only (afs-cv-000)`.

---

## JOB-IDENTITY + FINISH COLUMNS MIGRATION WRITTEN, FILE ONLY (afs-jf-000) — 2026-08-21

**Status: migration `018_job_identity_and_finish.sql` written and
committed to `supabase/migrations/` — FILE-ONLY change, per the task's
own instruction; NOT applied to the live Supabase project. `pnpm tsc
--noEmit` passes with 0 errors, run directly this session. This prompt
adds no UI, no API route, and no data-fetching code — there is no
browser surface to verify for this prompt itself, so it is marked
IMPLEMENTED/UNCONFIRMED pending Reid's manual application and, per this
file's verification standard, pending browser verification of whatever
downstream prompt actually consumes these columns.**

Confirmed before choosing the migration number: read every file in
`supabase/migrations/` (001 through 017) in full and cross-checked
SESSION_STATE.md's live-apply status notes, per the task's instruction.
`017_color_and_queue_position.sql` was in fact still the highest-numbered
file on disk (001–017, no gaps) and is CONFIRMED APPLIED LIVE per
SESSION_STATE.md's afs-cv-000 entry, so this migration is correctly
numbered 018 — no discrepancy to note.

**Pre-existing-column finding, verified directly before writing anything
(per the task's explicit instruction not to trust its own note):**
`quote_requests.po_number TEXT` already exists — added in
`001_initial_schema.sql` (line 442), confirmed by reading that file
directly. It is NOT a new addition of this migration. It is included in
this migration's `ALTER TABLE quote_requests` statement only via `ADD
COLUMN IF NOT EXISTS` for idempotent-migration-style safety (a harmless
no-op against the live column, matching this project's existing
pattern) — both the migration file's own header comment and SCHEMA.md
state this explicitly. Also verified: none of the five columns below
already existed on `shop_profile_library` (checked migrations 016 and
017, the only two prior migrations touching that table) — all five are
genuinely new there.

**What it does — all columns nullable, no defaults, `ADD COLUMN IF NOT
EXISTS`:**
1. `ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS
   client_business_name TEXT, ADD COLUMN IF NOT EXISTS client_name TEXT,
   ADD COLUMN IF NOT EXISTS po_number TEXT, ADD COLUMN IF NOT EXISTS
   requested_by TEXT, ADD COLUMN IF NOT EXISTS finish TEXT` —
   `client_business_name`/`client_name`/`requested_by`/`finish` are new;
   `po_number` is pre-existing (see above).
2. `ALTER TABLE shop_profile_library ADD COLUMN IF NOT EXISTS
   client_business_name TEXT, ADD COLUMN IF NOT EXISTS client_name TEXT,
   ADD COLUMN IF NOT EXISTS po_number TEXT, ADD COLUMN IF NOT EXISTS
   requested_by TEXT, ADD COLUMN IF NOT EXISTS finish TEXT` — all five
   new.

**No indexes, constraints, or defaults added beyond the columns listed
above.** Checked the real pattern already established on
`shop_profile_library` first (migrations 016/017), per the task's
instruction not to invent a new convention: only 5 of its ~20 columns
carry an index (`customer_name`, `profile_name`, `status`, `due_date`,
`created_at`); plain nullable text columns like `material`, `gauge`,
`order_number`, `hem_instructions`, `color` all carry none. No "every
plain text column gets an index" convention exists to extend, so all ten
new columns (five per table) were left unindexed, matching the unindexed
majority.

`SCHEMA.md` updated: header table/migration-file counts (18 migration
files; table count unchanged at 54 since this migration adds no new
tables), the `MIGRATION FILE LOCATION` list, a new note on TABLE 15
(`quote_requests`) documenting the four new columns plus the
`po_number` pre-existing finding, and a new note in the SHOP PROFILE
LIBRARY TABLE section documenting all five new columns there — matching
the depth and style of the existing 016/017 notes in both places.

Committed as `feat: add job-identity fields and finish columns
migration, file only (afs-jf-000)`.

---

## FLASHDRAFT — "SNAP TO 15° ANGLE" / "SNAP TO 1/8" DIMENSION" TOGGLES REMOVED (afs-sv-001): IMPLEMENTED, UNCONFIRMED

**Status: code removed, `pnpm tsc --noEmit` passes with 0 errors. Not yet
independently confirmed by the user drawing/editing in the actual FlashDraft
canvas — per this file's verification standard, that confirmation is
required before this can be marked DONE.**

Only file touched: `app/studio/draft/page.tsx` (full-file edits, no other
files reference this logic — confirmed via grep before starting).

Removed entirely:
- The two checkbox toggles in the FlashDraft sidebar ("Snap to 15° angle",
  "Snap to 1/8" dimension") and their `snapAngle`/`snapDimension` `useState`
  fields.
- `applySnapping()` (angle/length rounding to `SNAP_ANGLE_DEGREES` /
  `SNAP_DIMENSION_INCHES`) and `snapToGrid()` (first-point grid snap), plus
  the now-unused `SNAP_ANGLE_DEGREES` / `SNAP_DIMENSION_INCHES` constants.
- Every call site that invoked that snapping during drawing/editing: the
  first-click anchor in `handlePointerDown`, the vertex-drag reshape branch
  in `handlePointerMove` (still runs through the unrelated `clampDragAngle`
  guard rail, now against the raw cursor position instead of a snapped
  one), and the click-drag-draw preview branch in `handlePointerMove`.
- The drag-length/angle preview label's `snapAngle &&` gate — the angle is
  now always shown next to the length while drag-drawing, since there is no
  longer a toggle to gate it on.

**Explicitly NOT touched**, per the request: hem logic, bend-angle logic
(`clampDragAngle`, the bend-radius/angle input panel), the visual
background grid (`GRID_INCHES`, unrelated to `SNAP_DIMENSION_INCHES` and
left in place), and everything else in FlashDraft.

No new colors or non-afs-* Tailwind classes were introduced; this was a
pure removal (net −54 lines).

---

## FLASHDRAFT — WHEEL ZOOM: PAGE-SCROLL + CANVAS-ZOOM FIRING TOGETHER, FIXED (afs-sv-002): IMPLEMENTED, UNCONFIRMED

**Status: code fixed, `pnpm tsc --noEmit` passes with 0 errors. Not yet
independently confirmed by the user scrolling the mouse wheel over the
actual FlashDraft canvas — per this file's verification standard, that
confirmation is required before this can be marked DONE.**

Only file touched: `app/studio/draft/page.tsx` (full-file replacement of
the wheel-handling code only; nothing else in the file was touched).

**Root cause, confirmed directly from the code before changing anything:**
the canvas wired zoom via React's `onWheel={handleWheel}` JSX prop
(`app/studio/draft/page.tsx`, previously around line 1689/2844). React
attaches `onWheel` as a **passive** native listener regardless of what the
handler itself does, so the handler's `e.preventDefault()` call was
silently ignored by the browser — this is a documented React behavior, not
a typo. With `preventDefault()` a no-op, the browser's native page scroll
and the canvas's own zoom both fired off the same wheel event, simultaneously
and unpredictably, exactly as reported. Separately, the old zoom math
(`setZoom((z) => Math.max(0.25, Math.min(4, z - e.deltaY * 0.001)))`) never
touched `pan`, so zooming always scaled around the canvas's fixed center
point rather than the cursor position — the point under the cursor would
visibly drift on every scroll.

**Fix applied:**
- Deleted the `handleWheel` React synthetic-event handler and the
  `onWheel={handleWheel}` JSX prop on the `<canvas>` element.
- Added a `useEffect` that attaches a **native** `wheel` listener directly
  to the canvas DOM node via `canvas.addEventListener('wheel', handler, {
  passive: false })` — the only way to make `preventDefault()` actually
  block page scroll on a wheel event.
- The listener computes the cursor's position relative to the canvas via
  `getBoundingClientRect()`, then updates `pan` alongside `zoom` (solving
  for the pan offset that keeps the world point under the cursor fixed on
  screen at the new zoom level) — so zoom is now single, deterministic,
  and centered on the cursor, not the canvas center.
- The effect depends on `viewMode`: the `<canvas>` element unmounts and
  remounts whenever the user toggles between the 2D draw view and the 3D
  viewer (`{viewMode === '2d' && (<canvas ... />)}` in the JSX), so
  `canvasRef.current` is a different DOM node after each toggle. Depending
  on `viewMode` — the same pattern the existing draw-loop `useEffect`
  already uses for the same reason — makes the listener reattach to the
  new node each time. Every run of the effect returns a cleanup that calls
  `canvas.removeEventListener`, so the previous listener is always removed
  before (or upon) the next one being attached; listeners cannot
  accumulate across re-renders or across `viewMode` toggles.

**Explicitly NOT touched:** the toolbar zoom in/out buttons and the zoom
percentage readout (`setZoom` calls tied to `ToolbarButton` `onClick`,
unrelated to the wheel-event bug), pan-via-space-drag, all other pointer
handlers, and colors/styling — this was a pure event-wiring and zoom-math
fix, no afs-* token changes.

---

## FLASHDRAFT — FIRST-LEG DRAG ASYMMETRY, FIXED (afs-sv-003): IMPLEMENTED, UNCONFIRMED

**Status: code fixed, `pnpm tsc --noEmit` passes with 0 errors, `pnpm run
build` passes. Not yet independently confirmed by the user dragging the
first leg's endpoint in the actual FlashDraft canvas — per this file's
verification standard, that confirmation is required before this can be
marked DONE.**

Only file touched: `app/studio/draft/page.tsx` (full-file replacement of
the vertex hit-testing and drag-translation code only; hem logic and
bend-angle/length logic were explicitly not touched, per the request).

**Root cause, confirmed directly from the code before changing anything:**
two compounding, endpoint-specific gaps, both keyed to point 0 (the first
leg's start, i.e. its "top"):

1. `hitTestVertex()` looped `for (let i = 1; i < points.length - 1; i++)`
   — deliberately excluding BOTH true endpoints (point 0 and the last
   point) from direct vertex hit-testing, so neither could ever be grabbed
   and dragged as a vertex.
2. This exclusion was invisible for the LAST point because two other
   mechanisms happened to cover for it: a click near the last point is
   claimed by the "continue drawing from here" gesture in
   `handlePointerDown`, and — more importantly — dragging the BODY of the
   last leg (`legBodyDragCandidateRef`) always drags its FAR vertex
   (`legIndex + 1`), which for the last leg IS the last point. For the
   FIRST leg, the same "always drag the far vertex" convention drags point
   1 (`legIndex + 1` where `legIndex = 0`) — never point 0. With point 0
   excluded from direct vertex hit-testing and never the far vertex of any
   leg-body drag, there was no gesture that could ever move it: grabbing
   near point 0 fell through to leg-0 body-drag, which stretched the leg
   by dragging point 1 away while point 0 stayed fixed — reported as "it
   grows/resizes instead of moving."

**Fix applied:**
- `hitTestVertex()` now starts its loop at `i = 0`, so point 0 is a fully
  hit-testable, directly draggable vertex like every interior bend point.
  The last point stays excluded — that exclusion is a real, separate
  design choice (the "continue drawing" gesture owns that pixel radius),
  not the bug.
- `clampDragAngle()` and the `draggingVertexIndex` branch of
  `handlePointerMove` both special-case `idx === 0`: since point 0 has no
  leg before it, the shared drag math — which normally anchors on
  `original[idx - 1]` (fixed) and translates every point after `idx` by
  the same delta — mirrors instead, anchoring on `original[idx + 1]` and
  moving point 0 alone with nothing translating. This is the one
  remaining special case for leg index 0, and it is structurally required
  (documented in both functions): point 0 genuinely has only one leg, on
  its far side, unlike every interior point which has one on each side.
  It mirrors exactly how the true last point already behaves (moves
  alone, nothing to translate past it) — same behavior class, not a
  divergent one.
- `selectedBendPoint` (the Angle/Bend Radius side panel) and the hover
  "radius too tight" tooltip both now explicitly skip point 0 — it has no
  bend angle or bend radius (no leg before it), so it was never eligible
  for either before this fix and still isn't; this just prevents the
  newly-hittable point 0 from opening a panel that assumes an interior
  bend point exists on both sides.

**Explicitly NOT touched:** hem logic, bend-angle/length application
(`applyBendAngle`, `rotateChainAroundVertex`), the leg-body-reshape
mechanism itself (`legBodyDragCandidateRef`, unchanged), and everything
else in FlashDraft.

---

## FLASHDRAFT — WHOLE-PROFILE MOVE AFFORDANCE ADDED (afs-sv-004): IMPLEMENTED, UNCONFIRMED

**Status: code added, `pnpm tsc --noEmit` and `pnpm run build` both pass
with 0 errors. A new Playwright e2e test (`tests/e2e/flashdraft.spec.ts`)
asserts the numeric-identity requirement below programmatically, but per
this file's verification standard that is evidence to bring to the user,
not a substitute for the user independently confirming the interaction
feels right in the actual FlashDraft canvas — required before this can be
marked DONE.**

Only files touched: `app/studio/draft/page.tsx` (full-file edits) and
`tests/e2e/flashdraft.spec.ts` (one new test, plus a small shared-setup
helper extracted from the existing test).

**The feature:** before this change, every drag gesture on the canvas
either edited one vertex/leg (grab an endpoint, drag a leg body, drag a
bend-radius circle) or panned the view (middle-click or space+drag) — there
was no way to move an entire drawn profile as a single rigid body; the only
options were re-drawing it or nudging every point individually.

**Interaction chosen, and why (a UX decision made without direct user
confirmation — flagged here per the task's own instruction):** hold Alt
(Option on Mac) and drag anywhere on the canvas while a profile exists.
This mirrors a convention the file already uses — `spacePressed` reserves
a held key to mean "this drag pans the view, not editing" — applied to a
second, equally unambiguous meaning ("this drag moves the whole profile,
not one leg"), rather than adding a new mode-toggle button to the toolbar.
The check runs FIRST in `handlePointerDown`, before any vertex/segment
hit-testing, so it always wins and never falls through into a leg-edit
gesture — grabbing an endpoint or a leg body only ever behaves as before
when Alt is NOT held. A plain drag on empty canvas (no Alt) is completely
unchanged — it still extends the profile with a new segment exactly as it
did before, per the task's explicit requirement not to repurpose that
gesture. The toolbar's existing shortcut-hint line (below the toolbar) and
a live cursor change (to a "grab" hand while Alt is held, "grabbing" while
actively moving) both surface the gesture, since it has no other UI
affordance.

**Numeric-identity verification (the task's explicit ask):** the move is
implemented as a pure translation — every point in the ORIGINAL
(pointer-down-time) points snapshot shifts by one identical world-space
`(dx, dy)` delta, computed once from cursor movement and never re-derived
from live state, so it cannot drift or compound mid-drag. Because
`bendAngleAt`/leg-length/`blankWidthInLive` are all computed purely from
pairwise point positions (relative distances and angles), and a rigid
translation leaves every pairwise relationship unchanged by construction,
no leg length, no bend angle, and no derived blank width can change from
this gesture — this is a structural guarantee of the math, not a
value that needed separate clamping or re-derivation. Hems are stored as
direction/length data relative to their endpoint (not as their own points),
so they follow the translation automatically with no extra handling.
Confirmed with a new Playwright test that draws a 2-leg profile, reads the
Blank Width/Bend Count readout, performs an Alt+drag starting exactly on
the profile's bend vertex (proving Alt overrides the ordinary vertex-grab
there), and asserts both readouts are byte-for-byte unchanged afterward.

**Explicitly NOT touched:** every existing drag gesture (vertex drag, leg
reshape, hem creation, bend-radius/angle panels, pan, wheel zoom, drag-draw
of new segments) — none of their code paths changed; the new branch is
purely additive and is checked before all of them.

---

## FLASHDRAFT — PREPEND LEG FROM FIRST-LEG FREE END ADDED (afs-sv-005): IMPLEMENTED, UNCONFIRMED

**Status: code added, `pnpm tsc --noEmit` and `pnpm run build` both pass
with 0 errors. No new Playwright test was added and the existing
`tests/e2e/flashdraft.spec.ts` suite was not re-run this session — per
this file's verification standard, this is evidence to bring to the
user, not a substitute for the user independently confirming the
interaction in the actual FlashDraft canvas. Required before this can be
marked DONE.**

Only file touched: `app/studio/draft/page.tsx` (full-file edits).

**The feature:** before this change, a profile could only ever be
extended by appending — dragging from the true last point. There was no
way to start a new leg from the free end of the FIRST leg (point 0); the
only options were re-drawing the whole profile in the opposite order or
inserting geometry by hand.

**Why this couldn't just mirror the append gesture's mechanism
unmodified:** the last point is deliberately excluded from
`hitTestVertex()` so that grabbing it always means "continue drawing."
Point 0 is the opposite, by design, since afs-sv-003: it's a fully
hit-testable, directly draggable vertex (grabbing it moves it in place),
and that fix is not being reverted. That leaves no empty hit-radius at
point 0's own screen position where a plain click/drag could
unambiguously mean "start a new leg" rather than "move this one."

**Interaction chosen, and why (a UX decision made without direct user
confirmation — flagged here per the task's own instruction, same
disclosure afs-sv-004 made for Alt+drag):** hold Shift and drag anywhere
on the canvas while a profile exists. Mirrors the same
modifier-key-for-a-distinct-drag-meaning convention this file already
uses twice (`spacePressed` -> pan, `altPressed` -> whole-profile move),
now `shiftPressed` -> prepend, rather than touching `hitTestVertex()` or
the afs-sv-003 fix, or introducing a fragile click-radius disambiguation
that would behave inconsistently across zoom levels. The check runs in
`handlePointerDown` immediately after the Alt (whole-move) branch, before
any vertex/segment hit-testing, so it always wins over grabbing point 0
directly — the afs-sv-003 move gesture only ever runs while Shift is NOT
held, and is otherwise completely unchanged. A plain drag with no
modifier held is unaffected regardless of where on the profile it starts.

**Why blank width, bend angles, and hem placement are all correct at the
new leg with no new geometry code — verified by reading the existing
implementation, not assumed:** every relevant computation in this file
already operates generically on the live `points` array and on
`hemStart`/`hemEnd` by structural position, never by remembered point
identity:
- `bendAngleAt` (bend angle/radius panel, profile matching, 3D viewer
  sync, bend summary, submit payload) loops `i = 1..points.length-2` over
  whatever `points` currently is — a leg prepended onto the front is
  included automatically once it exists in the array.
- Blank width (`blankWidthInLive` and both debounced sync effects) sums
  `dist(points[i], points[i+1])` across every adjacent pair in the whole
  array, so the newly prepended leg's length is included with no special
  case, the same way an appended leg's length already was.
- `hemStart`/`hemEnd` are rendered and their allowance computed at
  structural index `0` / `points.length - 1`, never at a remembered point
  identity — the same convention that already made an appended leg's new
  last point silently inherit `hemEnd`. Prepending a new point 0 makes it
  inherit `hemStart` for free, by the same structural rule, with zero
  hem-transfer code required.
- The point that WAS point 0 (now shifted to index 1, an ordinary
  interior bend point with two legs) needs no radius fix-up: its
  `radius` was always `undefined` — point 0 is excluded from
  `selectedBendPoint`/`applyBendRadius` by the afs-sv-003 fix, so it could
  never have had one explicitly set — and `getEffectiveRadius()` already
  falls back to `defaultBendRadiusIn(material)` for any point with no
  radius, identically to how an appended profile's old last point already
  relies on that same fallback.

**How this resolves the task's afs-sv-003-interaction requirement:** the
new point 0 (after a prepend) supports full drag/edit exactly like every
other leg with no new code, because `clampDragAngle()`'s `mirrored`
branch and `handlePointerMove`'s `idx === 0` branch are both keyed to the
array index, not to a remembered point identity — they apply
automatically to whichever point is *currently* at index 0. The old
point 0 (now an interior point) simultaneously gains full angle/bend-radius
editing for the same structural reason. Neither required touching
afs-sv-003's code.

**One real correctness fix, not pre-existing:** `selectedBendPoint`/
`selectedSegment` are explicitly cleared the instant the Shift+drag
gesture arms in `handlePointerDown`, not left to `commitPoints`'s own
`setSelectedSegment(null)` alone. A prepend shifts every existing point's
array index by one; a selection left pointing at its old index would
silently reference the wrong vertex/leg after commit. Append never shifts
any existing index, so it never needed this.

**Explicitly NOT touched:** `hitTestVertex()`, the afs-sv-003 fix itself,
every other existing drag gesture (vertex drag, leg reshape, hem
creation/editing, bend-radius/angle panels, pan, wheel zoom, whole-profile
move, append drag-draw), and all bend/angle/hem/blank-width computation
code — none of it changed; the new branch is purely additive and is
checked before all of it.

---

## FLASHDRAFT — AUTOSAVE TO LOCALSTORAGE ADDED (afs-sv-006): IMPLEMENTED, UNCONFIRMED

**Status: code added, `pnpm tsc --noEmit` passes with 0 errors. No new
Playwright test was added and the existing `tests/e2e/flashdraft.spec.ts`
suite was not re-run this session — per this file's verification
standard, this is evidence to bring to the user, not a substitute for the
user independently confirming the behavior in the actual FlashDraft
canvas. Required before this can be marked DONE.**

Only file touched: `app/studio/draft/page.tsx`.

**The feature:** the full editable profile model — `points`, `hemStart`,
`hemEnd`, `material`, `gauge`, `lengthFeet`, `lengthInches`, `quantity`,
`notes`, and `rush` — is serialized to `localStorage` under the key
`afs-flashdraft-autosave`, debounced 500ms after the last change so it
does not write on every mouse-move during a drag. On mount, if a saved
entry exists, it is restored automatically before the user does anything.
Deliberately excludes saved-profile identity (`profileName`, `revision`,
`savedProfileId`, `profileCategoryId`, `profileSubcategory`): those
belong to the separate Saved Profiles feature (`saved_configurations`
table), and restoring a stale `savedProfileId` here could make a later
"Save" silently overwrite an unrelated saved profile instead of creating
a new one.

**Clear conditions — exactly two, both explicit `removeItem` calls, never
implicit:** (a) `clearCanvas()`, the Clear toolbar button's handler, and
(b) `submitQuoteRequest()`'s success branch, immediately after a formal
quote request is created. Simple navigation away or a page refresh never
clears it — the debounced write effect only ever writes, it never
removes. Both `removeItem` calls happen synchronously in the same tick as
the state reset, not deferred to the debounce, specifically so that
clicking Clear (or submitting) and then closing the tab within the
500ms debounce window can't leave the pre-clear/pre-submit state behind
in `localStorage` for the next visit to wrongly restore.

**Why the existing localStorage key (`afs-flashdraft-draft`, written by
the pre-existing manual "Save Draft" button) was left alone rather than
reused:** it already has one purpose (an explicit, user-initiated save)
with no matching restore code path anywhere in the file — repurposing it
for autosave would have conflated two different persistence intents
under one key. The new `afs-flashdraft-autosave` key is entirely
separate.

**Why the existing Load feature needed no changes:** "Load" (the machine
profile library), "My Saved Profiles", and the canonical-profile
`?loadCanonical=1` handoff all already call `setPoints`/`setHemStart`/
`setHemEnd` directly. Since the autosave-restore effect runs once on
mount and any of those three replace the same state afterward, the
loaded state always wins — and because the write effect is keyed off
that same state, the next debounced write 500ms later naturally
overwrites `afs-flashdraft-autosave` with the newly loaded profile,
satisfying "replacing whatever the autosave held for the current
session" with no explicit `removeItem` needed in any of the three load
paths.

**Explicitly NOT touched:** the "New" toolbar button (`confirmNew`) —
per the task's explicit scope, the autosave entry is cleared ONLY by
Clear and successful Submit, not by New (which already leaves `material`/
`gauge`/`notes`/etc. untouched today, same asymmetry Clear has always
had). The manual "Save Draft"/`afs-flashdraft-draft` button and all
Saved-Profiles/library code paths are unchanged.

---

## SHOP_PROFILE_LIBRARY POPULATED ON PATHFINDEREDGE SEND, PROFILE LIBRARY ADMIN PAGE ADDED (afs-sv-009): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors. Migration 016 (afs-sv-007
below) is CONFIRMED APPLIED LIVE (Reid, verified via `information_schema`
in the Dashboard, 2026-08-20 — see that entry), so `shop_profile_library`
and `quote_requests.source_tool` are real in the live Supabase project and
the inserts this entry describes should no longer fail at the database
level. Not yet independently confirmed by the user in the browser — that
confirmation covers the UI/insert behavior itself, not the migration's
live-apply status, which is now resolved above.**

**Confirmed directly from the code (not assumed) that exactly two real,
distinct code paths send a profile to PathfinderEdge** — read both in full
before changing anything, per the task:
1. `app/api/admin/command-center/approve-quote-request/route.ts` — an
   admin's "Approve" action on a pending quote request, one push per line
   item.
2. `app/api/studio/send-to-pathfinder/route.ts` — FlashDraft's own direct
   "Send to PathfinderEdge" button, independent of the quote-request/
   job-approval pipeline entirely (that file's own header comment says so).

A third candidate, `app/api/admin/command-center/approve/route.ts`
(approves an existing `pending_approval` `machine_jobs` row), was checked
and confirmed dead in practice: `approve-quote-request/route.ts`'s insert
is the only place a `machine_jobs` row is ever created, and it always
inserts with `status: 'approved_for_machine'` directly — nothing ever
creates a row that would still be sitting at `pending_approval` for that
route to act on. A fourth, `app/api/admin/pathfinder/push-profile/route.ts`,
is a generic stubbed test route per `SITEMAP.md` ("POST — stubbed, not
live"), not a real customer-data-bearing send path. Neither was touched.

**On every real send from either of the two paths above, one
`shop_profile_library` row is now inserted** via a new shared helper,
`lib/data/shop-profile-library.ts`'s `insertShopProfileLibraryRecord()` —
wrapped in try/catch, logs and continues on failure, never throws. This is
a deliberate design choice, not an oversight: like `lib/admin/audit.ts`'s
`logAdminAction` and every notification send (ARCHITECTURE.md §9), a
shop-record side effect must never roll back or fail a response that
already reflects a real push to the physical machine's catalog.

**Field-by-field, from the task's own list:**
- `order_number`: always null on both paths today — no order exists yet at
  quote-request-approval time (an order is only created after the customer
  approves a formal quote and pays), and the direct FlashDraft send has no
  order concept at all.
- `profile_name`, `material`, `gauge`, `quantity`, `length_ft`: read
  directly from the line item (approve-quote-request) or the live draw
  session's own state (send-to-pathfinder) — `gauge`, `quantity`, and
  `lengthFt` were not previously sent in the direct-send request body at
  all and are added to it now (FlashDraft's `gauge`/`quantity`/
  `lengthFtDecimal` state), since "all available metadata fields" requires
  them and they were simply never wired through before.
- `customer_name`/`company`/`customer_email`/`customer_phone`/
  `account_notes`/`due_date`: resolved once per approval (profile lookup
  for `user_id`, or `guest_email` alone for guest requests) and reused for
  both the shop_profile_library rows and the pre-existing customer
  notification email — one fetch, not duplicated. All null on the direct
  FlashDraft send (no customer is ever attached to that path).
- `source_tool`: `quote_requests.source_tool` (afs-sv-008's column) on the
  approval path; hardcoded `'afs-flashdraft'` on the direct-send path,
  since that route by definition only exists inside FlashDraft.
- `pathfinder_profile_id`: the real `profileId` PathfinderEdge's own
  response resolved, not a placeholder.
- `status`: `'queued'` on every insert, per the task.

**`geometry_svg` reuses each source tool's own existing renderer — no new
rendering logic was written, per the task's explicit instruction:**
- **FlashDraft-originated** (item has real drawn `points`): FlashDraft's
  canvas draw-loop (`app/studio/draft/page.tsx`'s "Draw loop" `useEffect`)
  is a live, interaction-state-coupled imperative effect (zoom/pan/hover/
  drag-preview) — not a pure `render(points) => image` function that could
  be called from a server route or reasonably reused as-is for a permanent
  thumbnail. Instead of duplicating any of that drawing logic, both
  `sendToPathfinder()` and `submitQuoteRequest()` now capture
  `canvasRef.current.toDataURL('image/png')` — a pixel snapshot of the
  exact canvas the user is looking at, at the moment of send — and send it
  as `geometryImage`. This literally reuses the same renderer (the same
  `<canvas>` element) with zero new drawing code. For the direct-send path
  this snapshot is used immediately server-side; for the approval path
  (server-side, no live canvas to read from), the snapshot is captured at
  **submission** time and stored as-is in `quote_requests.line_items[].
  geometryImage`, then read back unchanged by
  `approve-quote-request/route.ts` at approval time — never re-rendered.
  Older quote_requests rows submitted before this change simply have no
  snapshot (`geometry_svg` is null for those items).
- **Configurator-originated** (item has no `points`, just `profileType` +
  width/height/legA/legB): rendered server-side via
  `lib/utils/profile-svg.ts`'s `generateProfileSVG()` — the exact same
  function `app/configure/page.tsx` and `app/upload/page.tsx` already call
  to draw this profile, via `slugToProfileType()` to map the item's
  `profileType` string. Wrapped in a `data:image/svg+xml` URI so the admin
  table can always just `<img src={geometry_svg} />` regardless of which
  branch produced the value. An item whose `profileType` doesn't map to a
  known `ProfileType` (e.g. a Quote Builder or Blueprint Takeoff AI item)
  gets `geometry_svg: null` rather than a guessed diagram — there is no
  third renderer for those tools and the task didn't ask for one.

**`geometry_points`** (FlashDraft-originated items only, per the task):
the raw `points` array (`{x, y, radius?}[]`) — confirmed by reading
`app/studio/draft/page.tsx`'s own `Point` interface and `getEffectiveRadius`
(`points[i]?.radius ?? defaultBendRadiusIn(material)`) that `points` itself,
not the separately-computed `bendRadiiIn` submission array, is FlashDraft's
real internal point/bend structure — stored as-is, not re-derived.

**New admin page `app/admin/profile-library/page.tsx`** (`ProfileLibraryTable`
client component) — searchable (customer/company/profile/material),
sortable (click any column header), filterable (source tool, status) table
with a small `<img>` thumbnail per row rendered directly from
`geometry_svg`, and a trash-can action that opens a confirm/cancel modal
(same modal pattern as `CommandCenterJobCard`'s reject/request-changes
modals) before calling `DELETE /api/admin/profile-library/[id]`, which sets
`deleted_at` — never a hard delete. **Every query against
`shop_profile_library` goes through `lib/data/shop-profile-library.ts`'s
`getShopProfileLibrary()`, which filters `deleted_at IS NULL` in exactly
one place** — this admin table today, and whatever afs-sv-010's Shop View
ends up being, so a soft-deleted row disappears from both without either
needing its own exclusion logic.

**"Profile Library" added to the Command Center header nav** — both
occurrences of that nav bar in `app/admin/command-center/page.tsx` (the
dashboard view and the tab-content view) now end with a divider plus a
plain `Link` to `/admin/profile-library`, styled with the exact same
non-active nav-link className the CRM tab links already use (it's a
separate route, never "active" within this page's own tab state, same as
how "Dashboard" itself renders non-active-styled whenever a `?tab=` value
is selected).

**Files changed:** `app/api/admin/command-center/approve-quote-request/route.ts`
(full replacement — `QuoteRequestLineItem` gained `lengthFt`/`geometryImage`,
profile lookup hoisted and extended with `phone`/`company`, `geometry_svg`/
`geometry_points` builders added), `app/api/studio/send-to-pathfinder/route.ts`
(full replacement), `app/studio/draft/page.tsx` (targeted edits to
`sendToPathfinder` and `submitQuoteRequest` only), `app/admin/command-center/page.tsx`
(full replacement, nav link added twice), plus new files
`lib/data/shop-profile-library.ts`, `app/admin/profile-library/page.tsx`,
`components/admin/ProfileLibraryTable.tsx`, and
`app/api/admin/profile-library/[id]/route.ts`. Committed as `feat: populate
shop_profile_library on PathfinderEdge send, add Profile Library admin page
(afs-sv-009)`.

---

## QUOTE_REQUESTS INSERTS TAGGED WITH SOURCE_TOOL, COMMAND CENTER SOURCE BADGE ADDED (afs-sv-008): IMPLEMENTED, UNCONFIRMED

**Status: `pnpm tsc --noEmit` passes with 0 errors. Migration 016
(afs-sv-007, below) is CONFIRMED APPLIED LIVE (Reid, verified via
`information_schema` in the Dashboard, 2026-08-20 — see that entry), so
`quote_requests.source_tool` is a real column and the `select`/`insert`
statements this entry describes should no longer fail at the database
level. Not yet independently confirmed by the user in the browser.**

**Every real insert path into `quote_requests` was found by grepping the
codebase directly, not assumed from spec docs** — `SPEC_PHOTO_TO_QUOTE_AI.md`
was checked and confirmed to NOT correspond to a separate code path: the
Design Studio's "Photo to Quote" tile (`app/studio/page.tsx`) and its "Scan
to Quote" tile both link to the same `/upload` page, which is internally
named "takeoff" throughout the code (`/api/takeoff`, `takeoff_uploads`,
`TAKEOFF_SYSTEM_PROMPT`) — there is one real insert path here, not two.
Every other candidate found via `.from('quote_requests')` (admin
approve/reject routes, the chat AI's order-history lookup, the machine
bridge's pending-jobs poll, various dashboard counts) was confirmed to only
`select` or `update` — never `insert`.

**The actual, single insert statement lives in
`app/api/quote-requests/route.ts` (`admin.from('quote_requests').insert(...)`,
one call site) and is shared by four distinct front-end submission tools,
each of which now sends its own `sourceTool` token in the POST body:**

| Token | Tool | Route |
|---|---|---|
| `afs-flashdraft` | FlashDraft (draw-your-own-profile canvas) | `/studio/draft` |
| `afs-configurator` | Custom Flashing Configurator | `/configure` |
| `afs-quote-builder` | Quick Quote / "Build Your Quote" | `/quote` |
| `afs-takeoff` | Blueprint Takeoff AI ("Scan to Quote" / "Photo to Quote") | `/upload` |

New shared module `lib/data/quote-request-source-tool.ts` is the single
source of truth for these four tokens — `isSourceTool()` validates the
API route's incoming `body.sourceTool` (falls back to `'unknown'` for
anything missing or unrecognized, since the column has no CHECK
constraint and a client could send an arbitrary string), and
`sourceToolLabel()` renders a display label everywhere the value is shown.

**Command Center UI — badge added to both the list and detail surfaces
that show individual quote requests:**
- `PendingQuoteRequestCard` (Command Center → Pending Approval tab, the
  quote-request list view) — a `chrome`-variant `Badge` showing the source
  tool, next to the existing RUSH / Placeholder Geometry badges.
- `CommandCenterDashboard`'s "Quote Requests" recent-activity list (the
  Command Center dashboard's other list view) — same badge, next to the
  existing status badge.
- `/admin/quote-requests/[id]` (the detail view both of the above link
  out to) — same badge, `size="md"`, next to the existing status badge in
  the page header.

All three consume `quote_requests.source_tool` via `sourceToolLabel()`;
`lib/data/pending-quote-requests.ts` and `lib/data/command-center-dashboard.ts`
both select the new column and fall back to `'unknown'` client-side if the
row's value is null (pre-migration rows, or the migration not yet applied).

**Files changed** (`git diff --stat`): `app/api/quote-requests/route.ts`,
the four submission pages (`app/studio/draft/page.tsx`,
`app/configure/page.tsx`, `app/quote/page.tsx`, `app/upload/page.tsx`),
`lib/data/pending-quote-requests.ts`, `lib/data/command-center-dashboard.ts`,
`components/admin/PendingQuoteRequestCard.tsx`,
`components/admin/CommandCenterDashboard.tsx`,
`app/admin/quote-requests/[id]/page.tsx`, plus the new
`lib/data/quote-request-source-tool.ts`. Committed as `feat: tag
quote_requests inserts with source_tool, show source badge in Command
Center (afs-sv-008)`.

---

## SOURCE_TOOL COLUMN + SHOP_PROFILE_LIBRARY TABLE ADDED (afs-sv-007): APPLIED LIVE

**Status: migration `016_source_tool_and_shop_profile_library.sql` written,
committed to `supabase/migrations/`, run by Reid in the Supabase Dashboard
SQL Editor on 2026-08-20, and CONFIRMED APPLIED LIVE — Reid independently
verified both `shop_profile_library` (the table) and
`quote_requests.source_tool` (the column) exist via a direct
`information_schema` query in the Dashboard, 2026-08-20. Same standard of
evidence migrations 013 and 015 already carry (see below). `pnpm tsc
--noEmit` passes with 0 errors.**

No Claude Code session this pass has had a working Supabase MCP connection
to this project's actual instance (the only two projects visible through
the available connection, "tarritrix"/"tarritrix-audit", don't correspond
to it) — the `information_schema` verification above was run by Reid
directly in the Dashboard, not by a session.

Confirmed before choosing the migration number: `015_machine_jobs_
delivery_method.sql` was the highest-numbered file in
`supabase/migrations/` (001 through 015, no gaps), so this migration is
correctly numbered 016.

**What it does:**
1. `ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS source_tool TEXT
   NOT NULL DEFAULT 'unknown'` — additive, nullable-safe pattern (same as
   migration 003's `cost_notes` / migration 012's
   `used_fallback_geometry`), defaulting every existing row to
   `'unknown'` so no backfill pass is required.
2. New table `shop_profile_library` — an admin-only internal shop record
   of a profile job's full intake context (customer/account info,
   material/geometry, hem/paint instructions, machine-routing
   identifiers), independent of both `quote_requests` (a customer-facing
   RFQ submission) and `machine_jobs` (the approval → generation →
   delivery lifecycle for one bend program). `quote_request_id` and
   `machine_job_id` are both nullable FKs — a row can exist with no
   matching quote request or machine job at all (e.g. a job phoned or
   walked in and entered directly by shop staff). Full column list: `id`
   (UUID PK, `gen_random_uuid()`), `quote_request_id`, `machine_job_id`,
   `order_number`, `profile_name`, `customer_name`, `company`,
   `customer_email`, `customer_phone`, `account_notes`, `material`,
   `gauge`, `quantity`, `length_ft`, `due_date`, `hem_instructions`,
   `painted_edge` (default false), `special_instructions`,
   `geometry_points` (JSONB), `geometry_svg`, `source_tool`,
   `pathfinder_profile_id`, `status` (default `'queued'`), `created_at`
   (default `NOW()`), `deleted_at` (soft-delete marker, no hard-delete
   path).
3. RLS: admin only — `FOR ALL USING (EXISTS (SELECT 1 FROM profiles
   WHERE id = auth.uid() AND role = 'admin'))`, matching `machine_jobs`'
   (migration 005) inline admin-only pattern exactly, not the
   operator-inclusive pattern `bid_documents` (migration 013) uses — this
   is an internal shop record, not a feature any `operator`-role staff
   member is named as a user of.
4. Indexes: one plain B-tree index each on `customer_name`,
   `profile_name`, `status`, `due_date`, `created_at`.

`SCHEMA.md` updated: header table/migration counts (54 tables / 16
migration files), the `MIGRATION FILE LOCATION` list (also backfilled
one-line entries for migrations 014 and 015, which had no entry at all —
a pre-existing gap, not something this migration caused, fixed in
passing since it sits in the same list this migration needed to extend),
a new note on TABLE 15 (`quote_requests`) documenting `source_tool`, and
a new `SHOP PROFILE LIBRARY TABLE` section at the end mirroring the
`BID DOCUMENT TABLES` section's depth and style.

**Separately confirmed while reading SESSION_STATE.md for this task, not
introduced by this session:** that file's own "CORRECTED 2026-08-20" note
under the delivery_method entry states migration 015 **is** confirmed
applied live (verified via `information_schema`), and a separate
standalone note further down states migration 013 (`bid_documents`) is
also confirmed applied live, verified by Reid directly on 2026-08-20.
Neither of those statuses was reassessed or changed by this session —
recorded here only because this task's own instructions asked that they
be checked directly against the current file text rather than assumed.

---

## CRITICAL — PATHFINDEREDGE BEND ANGLE, FOURTH REVISION: SIGNED INTERIOR ANGLE, NOT TURN-ANGLE: IMPLEMENTED, PENDING VERIFICATION

**Status: IMPLEMENTED, PENDING Reid's own visual verification matrix
below. Not confirmed. Supersedes the turn-angle revision documented
immediately below this entry — read this one first.**

(2026-08-20) — scope: `lib/integrations/flashdraft-to-pathfinder.ts`'s
`bendAngleAt()`, `approve-quote-request/route.ts`'s duplicated
`bendAngleFromPoints()`, plus `lib/integrations/pathfinder-edge.ts` (a
diagnostic-only change, see below).

**Why the turn-angle revision's own confirmation didn't actually count
as evidence for it.** That revision's live test (profileId 32911527, a
60°/-120° three-segment chevron, "clean, correct leg lengths, no
self-intersection") only checked criteria that are invariant under a
supplement swap — leg lengths, vertex count, and self-intersection don't
change whether the true interior split at each vertex is 60/120 or
120/60. It could not have discriminated turn-angle from interior-angle
semantics either way; it wasn't real counter-evidence to the new
diagnosis, just a test that happened not to be precise enough to catch
the problem.

**Decisive evidence:** profileId 32912069, a single-bend FlashDraft "V"
drawn with a real interior angle of 45° (confirmed on FlashDraft's own
canvas), pushed under the turn-angle formula (which sent 135°, the
supplement of 45°) — rendered in PathfinderEdge as ~135°, not the
intended 45°. A single, isolated, angle-explicit bend is a direct,
one-variable confirmation that PathfinderEdge wants the signed interior
angle itself, not a turtle-turn conversion of it.

**Formula:** `sign(turn) × (180 − |turn|)`, algebraically equal to
`-interiorSigned` everywhere except at `turn === 0`. The
cross-product-equivalent sign-determination logic (signed atan2
difference) is unchanged from the prior revision — only the final
transform changed. Two boundaries handled explicitly and commented in
both files:
- `|turn| = 180` (interiorSigned = 0, a hairpin/flat fold, legs pointing
  in exactly opposite directions): formula naturally emits `0` — correct,
  since a perfectly flat fold has no meaningful handedness to sign in 2D.
- `turn === 0` (interiorSigned = 180, prev/curr/next exactly collinear,
  no bend at all): the literal formula breaks here because JS's
  `Math.sign(0) === 0` would collapse the whole product to `0` — wrong,
  since `0` means "hairpin fold" (the opposite degenerate case). Special-
  cased to return `180` directly.

`pnpm tsc --noEmit` — 0 errors.

**What stays explicitly UNEVALUATED, not resolved by this revision:**
the staircase self-intersection verdict (profileId 32911526) that
originally motivated the (now superseded) turn-angle revision. That
verdict rests entirely on two of Reid's own chat messages — no session
has ever had visual/browser access to PathfinderEdge's own web UI to
independently confirm it. It has not been re-checked. If a fresh look
contradicts this revision, this revision needs to be revisited too — it
is deprioritized behind the more decisive V-test evidence per explicit
instruction, not dismissed.

**Also still untested:** whether a bare `radius: 0` (`Angle`-type
feature) behaves differently from the `Radius`-type feature every real
test so far has used — `bendCount: 0` on 32911526, 32911527, and
32912069 all indicate material-default nonzero radii were used in every
case.

**Diagnostic logging made permanent.** The ad-hoc `console.log` added
mid-session to capture live POST bodies (used to capture the real
32912069-equivalent geometry and confirm the profile-name/timestamp
provenance of several live pushes) is replaced with an opt-in, env-gated
file capture in `pushProfileToPathfinder()`: set
`PATHFINDER_DEBUG_CAPTURE=1` to write each outgoing POST body to
`diagnostics/pathfinder-capture-<timestamp>.json` (new, gitignored
directory) — silent, zero filesystem writes, when unset (the default;
not set in `.env.local` or Vercel). A write failure there is logged, not
thrown — cannot block or fail a real push.

**VERIFICATION MATRIX — PENDING, none completed as of this write-up:**

| # | Test | Expected if this revision is correct |
|---|---|---|
| 1 | Single-bend V, sharp (~45°) | Renders as ~45°, not ~135° |
| 2 | 4-leg "W" profile, turns 45°/-60°/45°/-60° | Renders as the correct W shape, not distorted |
| 3 | Near-90° bend(s), regression check | Still correct — this revision and the superseded turn-angle revision coincide exactly at 90°, so nothing here should have changed |
| 4 | A near-straight (turn≈0°) or near-hairpin (turn≈±180°) bend, and/or a bend adjacent to a hem | Renders correctly at the two explicit boundary cases this revision added handling for |

No push was made by Claude for this revision — per explicit instruction,
Reid runs the matrix above himself. Do not mark this DONE until he has.

---

## CRITICAL FIX — PATHFINDEREDGE BEND ANGLE WAS UNSIGNED, THEN WRONG TURN-VS-INTERIOR MODEL (SUPERSEDED BY THE REVISION ABOVE): IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete — pending
Reid's own review of this session's transcript/diff, even though a real
visual check already happened live (see below).**

(2026-08-19) — scope: `lib/integrations/flashdraft-to-pathfinder.ts`'s
`bendAngleAt()`, `app/api/admin/command-center/approve-quote-request/
route.ts`'s duplicated `bendAngleFromPoints()`. Both are the single source
of the `bendAngleDegrees` value that ends up as PathfinderEdge's `angle`
feature field for every real, drawn-geometry profile pushed to the
machine — via FlashDraft's direct "Send to PathfinderEdge" button
(`flashDraftToMachineProfile` directly) AND via Command Center approval
of a quote request with real FlashDraft points (`buildMachineProfileForItem`
calls the same `flashDraftToMachineProfile` for that case — `route.ts`'s
own `bendAngleFromPoints` only ever fed `machine_jobs.custom_bends`, a
human-review display column, never the actual PathfinderEdge payload for
that path; fixed anyway for consistency, since it carried the identical
bug).

**Bug 1 (root cause as originally diagnosed): unsigned angle.** Both
functions computed the interior bend angle via `Math.acos`, which can only
return 0–180 — mathematically incapable of encoding turn direction.
Sending every bend as unsigned/positive meant every turn looked like the
same direction to PathfinderEdge, collapsing a real zigzag (signed 68°,
-45°, 75°, -45° on FlashDraft's own canvas) into a closed triangular loop
when pushed.

**Bug 2 (found only after fixing Bug 1, via a real push): wrong angle
model, not just missing sign.** The first fix made the angle signed by
reusing `app/studio/draft/page.tsx`'s `signedAngleBetween` formula exactly
— but that function returns the *interior* angle between the two legs
(180° = straight through), while PathfinderEdge's `[Straight, Angle,
Straight, Angle, Straight...]` feature list expects a turtle-graphics
*turn-from-heading* angle (0° = straight through) — a different quantity,
not a sign flip, related by `turn = interior + 180°` (wrapped), which only
coincidentally reduces to a pure sign flip when every bend is exactly 90°.
This was caught live: a real push of a plain 4-leg right-angle staircase
(all 90° bends, so the sign-only fix and the correct turn-angle fix
predict the same numbers) rendered as a **self-intersecting/geometrically
impossible shape** in PathfinderEdge, not a mirrored staircase — the
failure signature that revealed the deeper interior-vs-turn-angle
confusion, not just a backwards sign. (This exact ambiguity was already
flagged, unconfirmed, in `pathfinder-edge.ts`'s own `buildFeatures`
comment before this session — this session resolves it.)

**Final fix:** both functions now compute the signed interior angle
(unchanged formula, matches `signedAngleBetween`) as an explicit
intermediate step, then convert it to the turn angle PathfinderEdge
actually needs (`turn = interiorSigned + 180°`, wrapped to `(-180, 180]`).

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 133/133
static pages generated, no errors.

**Real end-to-end verification performed this session, against the live
PathfinderEdge API, not a script assertion:**
1. Pushed a real 4-leg right-angle staircase (`(0,0)→(10,0)→(10,10)→
   (20,10)→(20,0)`) through the real `flashDraftToMachineProfile` +
   `pushProfileToPathfinder` — the unmodified functions the real button
   uses — with the first (signed-but-interior) fix. Result: profileId
   `32911526`, catalog 20115. **Reid's own visual check: self-intersecting
   / geometrically impossible, not a simple mirror** — this is what
   surfaced Bug 2 above.
2. Diagnosed the interior-vs-turn-angle mismatch (see Bug 2), captured the
   exact POST body via an intercepted `fetch` (not hand-transcribed) to
   confirm the diagnosis against the real request payload, side by side
   with the source points.
3. Implemented the turn-angle fix, re-ran `tsc`/`build` clean.
4. Pushed a profile with two genuinely non-90° bends (`+60°`/`-120°`
   turtle turns — a 90°-only test cannot distinguish sign-flip from
   turn-angle-model, since they coincide at exactly 90°) through the same
   real path. Result: profileId `32911527`, catalog 20115. **Reid's own
   direct visual check, confirmed explicitly as a genuine pass (not "looks
   roughly okay"): clean three-segment shape, correct 10" leg lengths on
   all three segments, two distinct non-overlapping vertices, no
   self-intersection.**
5. Both test profiles (`32911526`, `32911527`) were left live in catalog
   20115 for the visual checks above and have **not** been deleted as of
   this write-up — cleanup still needed, flagged rather than forced.

**What this session's live check does NOT cover:** the Command Center
approval path (`approve-quote-request/route.ts`) was not independently
pushed end-to-end through a real quote request + admin approval click —
its real PathfinderEdge payload for drawn-geometry items is provably
identical to the direct-button path already tested (both call the same
`flashDraftToMachineProfile`), so this is a reasoned inference, not a
separately observed result for that specific route. The Radius-vs-Angle
feature-type distinction (`buildFeatures` sends `angle` on both `Radius`-
and `Angle`-type features) was exercised only via `Radius`-type features
in both live tests (every bend in both test profiles used a nonzero
material-default radius) — a bend with an explicit `radius: 0`, forcing a
bare `Angle` feature, was not separately tested; no evidence suggests it
behaves differently, but it is not confirmed.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** — a real visual check already happened twice this session
and both passed, but per this project's standing rule (repeated explicitly
by Reid mid-session: "do not conclude anything from your own screenshot
alone"), a session's own observation of the check is not the same as
Reid independently marking this done himself.

**Follow-up read-only diagnostic pass (2026-08-19, later same day):**
requested by Reid to independently re-audit both files rather than trust
the prior session's own account. No source files touched this pass.

Confirmed by direct file read that `lib/integrations/flashdraft-to-
pathfinder.ts`'s `bendAngleAt()` and `approve-quote-request/route.ts`'s
`bendAngleFromPoints()` are **byte-for-byte identical logic** (only the
function/type names differ) and **both currently contain the turn-angle
fix** (`interiorSigned` computed via signed atan2, then
`turn = interiorSigned + 180°` wrapped) — neither has regressed to the
original unsigned `Math.acos` version. `git status` on both files was
clean against the last commit at the time of this check.

Computed, via a throwaway script duplicating each formula (not importing
or modifying the source files), the `bendAngleDegrees` values both the
current fix and the original pre-fix code would emit for a constructed
5-leg, same-handed profile with turtle turns of exactly 45°/45°/38°/45°
at its 4 interior points (10" legs, points listed below):

```
P0 = (0.000000, 0.000000)
P1 = (10.000000, 0.000000)
P2 = (17.071068, 7.071068)
P3 = (17.071068, 17.071068)
P4 = (10.914453, 24.951175)
P5 = (0.988992, 26.169869)

CURRENT (turn-angle fix):              45.0000, 45.0000, 38.0000, 45.0000
ORIGINAL (unsigned Math.acos interior): 135.0000, 135.0000, 142.0000, 135.0000
```

The current fix reproduces the intended turn angles exactly (as it must
by construction — `turn = interiorSigned + 180` is the algebraic inverse
of how these points were built from turn angles in the first place). The
original version's `135/135/142/135` numbers are `180 − turn` for each
vertex — always positive, and for anything other than a 90° bend, a
*different magnitude* than the correct turn angle, not merely a
sign-flipped version of it — concrete numeric confirmation of what this
session's live PathfinderEdge pushes had already shown visually (a
zigzag collapsing into a loop, then a self-intersecting shape) before the
turn-angle fix was applied.

This pass changed no code and ran no new live PathfinderEdge push — it is
a static confirmation that the fix committed and documented above is
actually present in both files, not a new behavioral test.

**Second follow-up read-only pass (2026-08-19, same day): live API
inspection of profiles `32911527` and `32911528`.** No source files
touched.

**Hard API limitation discovered:** `GET /api/v1/profiles/{id}` does
**not** expose per-feature geometry — confirmed via `404` on both
`/api/v1/profiles/{id}/features` and `/api/v1/profiles/{id}/geometry`
for both IDs. The only fields available for an existing profile are
`profileName`, `description`, `owningCatalogId`, `category`,
`subCategory`, `blankWidth`, `bendCount`, `hemCount` — no bend angle
value (signed or otherwise), no hem parameters, no leg/flat lengths.
**There is currently no way, via this API, to confirm what sign or
magnitude PathfinderEdge actually stored for any profile's bends** —
only what was submitted (capturable locally via an intercepted `fetch`
on a fresh push, as done earlier this session) or what a human sees in
PathfinderEdge's own web UI (still no login access in this environment).

**Profile `32911528` is not one of this session's test pushes.** Its
`profileName` (`FlashDraft Stainless Steel 18 ga 8/19/2026, 9:42:31 PM`)
matches the live "Send to PathfinderEdge" button's own naming pattern
exactly (`page.tsx:2270`) — this looks like a real push made directly
through the live button, most likely Reid testing the fix himself.
`hemCount: 2`, `blankWidth: 34.375` (34 3/8").

**Blank-width discrepancy flagged, not resolved:** FlashDraft's own
displayed Blank Width (`page.tsx:2425-2427`, raw leg distances +
`hemAllowanceIn` per hem — that function's own comment in
`lib/types/profile.ts` calls it *"a visual/quoting simplification, not a
real fabrication bend-deduction calculation"*) and PathfinderEdge's own
recomputed `blankWidth` (from the submitted `Straight`/`Radius`/hem
features, using PathfinderEdge's own undocumented internal formula — one
prior data point in this doc suggests it adds each bend's radius on top
of the Straight-length sum) are **two independent calculations that were
never designed to agree.** For `32911528` specifically: FlashDraft showed
33 1/4", PathfinderEdge returned 34 3/8" (+1 1/8"). Plausible
explanation (bend-radius contributions FlashDraft's display never
includes), not a confirmed reconciliation — the original drawn
points/hem settings for this specific push aren't available via the API
or this session. **Flagged as a real, separate, open question — unrelated
to this session's bend-angle fix (blank-width code untouched), but
worth its own investigation** if quoting accuracy depends on FlashDraft's
displayed width matching what PathfinderEdge/the machine will actually
use.

**Also noted, not fixed (read-only pass, out of scope):**
`pathfinder-edge.ts`'s `buildFeatures` still has a stale comment
(lines ~288-295) saying the interior-vs-turn-angle mapping is
"NOT confirmed... flagged as open... pending a real bend push+visual
check" — that check has since happened and resolved the question (see
the CRITICAL FIX entry above). Comment cleanup left for a future pass
since this one was read-only.

---

## COMMAND CENTER — FULL APPROVAL PIPELINE CONNECTED TO PATHFINDEREDGE, HEMS INCLUDED AS REAL FEATURES: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete — pending
Reid's own review.**

(2026-08-18) — scope: `app/api/admin/command-center/approve-quote-
request/route.ts`, `lib/integrations/pathfinder-edge.ts`,
`lib/integrations/flashdraft-to-pathfinder.ts`, `app/studio/draft/
page.tsx`, `components/admin/PendingQuoteRequestCard.tsx`, `lib/data/
pending-quote-requests.ts`. **Direct answer to this prompt's own
framing: yes — a customer's quote request, once approved in the Command
Center, now reaches PathfinderEdge automatically as part of that one
click, with hems included as real features, not just reflected in
blank width.** Confirmed via a real end-to-end test (below), not
assumed.

**1. `delivery_method` default changed from `machine_bridge` to
`pathfinder_edge`** in `approve-quote-request/route.ts`'s insert — the
real, intended behavior change this prompt exists for, explicitly
confirmed with Reid in this conversation (not the technical-default
question migration 015 asked and answered separately).

**2. Every line item now gets pushed, not just item 0.** This route used
to hard-reject any quote request with more than one line item (a 422,
"can only map a single item's geometry"). Removed — the route now loops
over every item, builds each one's `MachineProfile`, and pushes each to
PathfinderEdge individually, creating one `machine_jobs` row per item
(previously always exactly one row per quote request). Both
`PendingQuoteRequestCard.tsx` (which used to disable the Approve button
entirely for multi-item requests) and `lib/data/pending-quote-
requests.ts`'s `hasMultipleLineItems` were updated to match — the button
is no longer disabled; a multi-item request instead shows an
informational note ("approving creates N separate machine jobs").
**Flagged for Reid, not resolved unilaterally, per this prompt's own
instruction:** N machine_jobs rows from one quote request now show as N
separate cards in the Command Center's Sent tab, all sharing the same
request number — whether Reid wants these visually grouped into one card
is a real product/UI decision this session did not make.

**3. Fail loud, not silent, on any push failure.** Every item's
PathfinderEdge push happens BEFORE any database write — if any single
item fails, the route returns immediately with a clear error and
`quote_requests.status` stays `submitted`, nothing is inserted, and the
admin can retry the same click. One narrower, lower-probability edge
case not fully closed: if all pushes succeed but a `machine_jobs` INSERT
itself fails partway through a multi-item loop (a DB-layer failure, not
a PathfinderEdge failure), the route returns a clear error naming exactly
how many rows exist vs. how many profiles were pushed, but does not
automatically roll back the already-created PathfinderEdge profiles —
flagged, not silently left ambiguous.

**4. Hems now convert to real PathfinderEdge features — the gap flagged
at the end of the previous prompt, fixed as explicitly instructed.**
Confirmed directly before starting: `flashdraft-to-pathfinder.ts`'s
adapter only fed `hemStart`/`hemEnd` into `hemAllowanceIn`'s blank-width
number, and `pathfinder-edge.ts`'s `buildFeatures` had no hem support at
all — a hem pushed to PathfinderEdge rendered as a plain straight/bent
bar with the right total length but no hem shape. Fixed at the root, not
worked around:
- `MachineProfile` gained optional `hemStart`/`hemEnd` fields
  (`MachineProfileHem`: `type`/`lengthMm`/`gapMm`/`kick`, mm like the
  rest of the interface).
- `buildFeatures` now constructs real `OpenHem`/`ClosedHem`/`TearDropHem`
  features, placed per the profile-object doc's own worked example
  verbatim (`Straight(0.5) -> OpenHem -> Straight(10) -> ...`) — a short
  "leader" Straight using the hem's own `lengthMm` sits between the hem
  feature and the profile's real leg material, satisfying the doc's
  "features must start and end with Straight" rule at a hemmed end.
  `'open'`→`OpenHem`, `'smashed'`→`ClosedHem` (no `hemHeight` field at
  all — matches "gap collapsed to ~0, nothing to report"),
  `'teardrop'`→`TearDropHem`.
- The adapter's blank-width calculation no longer adds `hemAllowanceIn`
  on top (that would now double-count the hem's material, since the hem
  is a real feature with its own leader-Straight length) — it's now
  plain leg-length only.
- `app/studio/draft/page.tsx`'s two hem-sending call sites (`Submit for
  Quote` and last session's `Send to PathfinderEdge` button) both now
  include `kick`, which was never sent before — needed for
  `hemDirection`, and the real, already-captured per-hem value, not a
  hardcoded placeholder.

**Two placeholder mappings remain explicitly UNCONFIRMED (not part of
this session's empirical test, which only checked that a hem feature
exists at all, not its exact rendered direction):**
- `hemDirection`: this codebase's `HemKick` (`'inside'`/`'outside'`) has
  no empirical basis for which PathfinderEdge `hemDirection`
  (`'Positive'`/`'Negative'`) it maps to — `'outside'` → `'Positive'`
  chosen arbitrarily but applied consistently. Needs a real pushed hem
  checked against PathfinderEdge's own profile thumbnail/render to
  confirm or correct.
- `hemClampOffset` (TearDropHem only): no source data anywhere in this
  codebase — defaulted to `0`, same placeholder-default precedent as
  `radiusQuality: 'Medium'`.

**Diagnostic finding, not a bug — worth recording so a future session
doesn't re-investigate it:** PathfinderEdge's own `bendCount` field on a
profile response only counts `Angle`-type features, NOT `Radius`-type
ones — confirmed by posting two isolated test profiles (one `Angle`, one
`Radius`, both deleted after) and comparing: `Angle` → `bendCount: 1`;
`Radius` → `bendCount: 0`, but `blankWidth` still correctly included the
radius value, confirming `Radius` features ARE accepted and processed,
just not tallied under that particular counter. The real end-to-end
test below shows `bendCount: 0` for a profile with one real 90° bend —
expected, not a defect, since that bend used a material-default `Radius`
(0.75" for copper, no explicit per-point radius given), not a bare
`Angle`.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 133/133
static pages, no errors.

**Real end-to-end test performed this session, through the actual
Command Center UI, not a script:**
1. Posted a real quote request via the real, unmodified `/api/quote-
   requests` route (guest submission) — one line item, a 2-leg/1-bend
   Copper/16oz profile with a real `open` hem at the start (`gapIn:
   0.1875, lengthIn: 0.5, kick: 'outside'`).
2. Created a throwaway admin account (no standing test credentials exist
   in this repo yet — see `tests/e2e/README.md`), logged in via
   Playwright against a live `pnpm dev` server, navigated to
   `/admin/command-center?tab=pending`, and clicked the real "Approve &
   Send to Machine" button — screenshot:
   `proof-hem-e2e-before-approve.png`.
3. The job moved to the Sent tab showing **"Approved — Sent to
   PathfinderEdge"** — screenshot: `proof-hem-e2e-approved-card.png`.
4. Resolved the real PathfinderEdge profileId (32910142, since deleted)
   via `admin_audit_log`'s `approve_quote_request_to_machine` entry, then
   called `GET /api/v1/profiles/32910142` directly:
   ```
   {"profileId":32910142,"profileName":"Custom FlashDraft Profile — Copper — 16 oz",
   "description":"AFS profile FD-MSZ8TZLY","owningCatalogId":20115,"category":null,
   "subCategory":null,"blankWidth":19.25,"bendCount":0,"hemCount":1}
   ```
   **`hemCount: 1`** — PathfinderEdge itself confirms a real hem feature
   was received, not just a blank-width number (`bendCount: 0` explained
   above, not a defect). `blankWidth: 19.25` reconciles exactly: `0.5`
   (hem leader) + `10` (leg 1) + `0.75` (the Radius bend's own material
   allowance, copper's material-default radius) + `8` (leg 2) = `19.25`.
5. Cleanup: the PathfinderEdge test profile (`DELETE` → 200), the
   `machine_jobs` row, and the `quote_requests` row were all deleted.
   **One thing NOT fully cleaned up, flagged rather than forced:** the
   throwaway admin account (`hem-e2e-admin@afs-internal.test`) could not
   be deleted — `admin_audit_log` rows this test legitimately created
   (`approve_quote_request_to_machine`,
   `approve_quote_request_to_machine_summary`) foreign-key to its
   `profiles` row, and deleting audit trail data to force a cleanup felt
   like the wrong call to make unilaterally. This account has `role:
   'admin'` and remains in the system — Reid should decide whether to
   remove it (and whether that means also removing the audit rows) or
   leave it.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** — the mechanism is now proven end-to-end with a real hem
reaching PathfinderEdge as a real feature, but the `hemDirection`
mapping's correctness, the multi-item Command Center UI question, and
the leftover test admin account all need Reid's own review before this
is "done."

---

## FLASHDRAFT — DIRECT "SEND TO PATHFINDEREDGE" BUTTON: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete — pending
Reid's own click-test on the live site.**

(2026-08-18) — scope: new `lib/integrations/flashdraft-to-pathfinder.ts`
(adapter), new `app/api/studio/send-to-pathfinder/route.ts`, `app/studio/
draft/page.tsx` (new admin-only button + state). Entirely separate from
tonight's earlier `machine_jobs`/`delivery_method` routing work — this
button sends whatever is CURRENTLY DRAWN on the canvas directly to
PathfinderEdge, with no `machine_jobs` row, no quote request, no approval
pipeline involved at all.

**`pushProfileToPathfinder` reused exactly as-is, not rewritten** — per
this prompt's explicit instruction. The new adapter
(`flashDraftToMachineProfile`) only converts FlashDraft's own `points`/
`hemStart`/`hemEnd`/`material`/`thicknessIn` state — the same inputs
already driving the Profile Info Panel's Blank Width/Bend Count/Hem
Count — into the `MachineProfile` shape `pushProfileToPathfinder` already
accepts. Leg-length/bend-angle math (`dist`, `bendAngleAt`,
`defaultBendRadiusIn`) is duplicated from `page.tsx`/`approve-quote-
request/route.ts` rather than imported, matching this codebase's already-
established precedent for small pure functions crossing the client-page/
server-route boundary (see `approve-quote-request/route.ts`'s own
`bendAngleFromPoints` comment for the same reasoning) — `buildFeatures`
and every other real PathfinderEdge-client internal in `pathfinder-
edge.ts` were not touched.

**New route is admin-gated**, same pattern as `approve/route.ts` and
`admin/pathfinder/push-profile/route.ts` (session auth + `profiles.role
=== 'admin'`, checked directly from an existing route rather than
invented). FlashDraft (`/studio/draft`) is otherwise a public,
no-login-required page — the button itself only renders client-side for
a signed-in admin (`isAdmin`, fetched alongside the existing
`isAuthenticated` check), and the route independently re-checks the same
role server-side regardless of what the client sends.

**Known, inherited gap — not fixed here, out of scope:** the adapter
only feeds `hemStart`/`hemEnd` into the blank-width material-allowance
calculation (`hemAllowanceIn`), not as real `OpenHem`/`TearDropHem`
features — `pathfinder-edge.ts`'s own `buildFeatures` has no hem support
yet (already flagged in that file). A profile with a real hem, sent
through this new button, will have the correct total blank width on
PathfinderEdge but render there as a plain straight/bent bar with no hem
shape. `owningCatalogId` is hardcoded to `20115` ("afs"), not
configurable in the UI, per this prompt's explicit instruction.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 133/133
static pages generated (up from 132 — the new route), no errors.

**Real click-test performed this session** (not just tsc/build): no
`E2E_TEST_EMAIL`/`PASSWORD` exist in this repo (see `tests/e2e/README.md`)
and this route needed a real signed-in admin, so a throwaway admin
account was created via the Supabase service-role client
(`auth.admin.createUser` + a matching `profiles` insert with
`role: 'admin'`), used once via Playwright against a live `pnpm dev`
server — logged in, drew a single 11" segment on the real canvas, clicked
"Send to PathfinderEdge," and the button showed **"PathfinderEdge
profileId: 32910125"** in the live UI. Independently confirmed via a
direct `GET /api/v1/profiles/32910125` — `200`,
`{"blankWidth":11.0,"owningCatalogId":20115,...}`, exactly matching the
drawn segment and the hardcoded catalog. Both the test PathfinderEdge
profile (`DELETE /api/v1/profiles/32910125` → 200) and the throwaway
admin account (Supabase Auth user + profiles row) were deleted
immediately after — nothing test-related was left in either system.
Screenshot: `proof-flashdraft-send-to-pathfinderedge.png` (repo root) —
shows the live canvas, the ADMIN section, the button, and the green
success line with the real profileId.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own click-test on the live site — this
session's test used a temporary throwaway admin account (since none of
the standing test credentials this project expects exist yet), not
Reid's own login, and confirms the mechanism works end-to-end, not that
the UI/UX or button placement is what Reid actually wants.

---

## COMMAND CENTER — DELIVERY_METHOD COLUMN, SEPARATES PATHFINDEREDGE FROM MACHINE BRIDGE ROUTING: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

(2026-08-18) — scope: new migration `015_machine_jobs_delivery_method.sql`,
`app/api/admin/command-center/approve-quote-request/route.ts`,
`app/api/admin/command-center/approve/route.ts`,
`app/api/machine-bridge/pending-jobs/route.ts`, `lib/data/machine-jobs.ts`,
`components/admin/CommandCenterJobCard.tsx`.

**The risk this closes.** Two independent systems both keyed off
`machine_jobs.status = 'approved_for_machine'`: the Machine Bridge's own
poll (`pending-jobs/route.ts`) and, as of last session, PathfinderEdge's
push (`approve/route.ts`). A job could reach the physical Thalmann via
both paths independently, with no human decision made about which one
should actually be used for that job. Fixed with a new column,
`delivery_method: 'pathfinder_edge' | 'machine_bridge'`, orthogonal to
`status` (not overloaded onto it — `status` stays purely an approval-state
field).

**A live but currently-unreachable finding, worth knowing about
regardless of urgency.** Confirmed directly from code (not assumed):
`approve-quote-request/route.ts` is the ONLY place that has ever created a
`machine_jobs` row, and it always sets `status: 'approved_for_machine'`
at insert time — meaning no job created through the app today has ever
reached `pending_approval`, and the "Approve & Send to Machine" button
(gated on that status, in `CommandCenterJobCard.tsx`) has never actually
fired against a real job. This means the double-send risk above is real
and structural but has not caused an actual double-send yet in
production — closing it now is prevention, not a fix for something that
already happened. Confirmed with Reid live before choosing a migration
default (see below) rather than assumed.

**Default chosen: `machine_bridge`, confirmed directly with Reid, not
assumed.** The migration's column default and `approve-quote-request/
route.ts`'s explicit insert value both use `'machine_bridge'` because
that is exactly what already happens for every quote-request-originated
job today — this default changes zero real behavior, it only makes the
existing behavior explicit and queryable. `'pathfinder_edge'` is only
ever reached by a job that goes through `pending_approval` first and gets
approved via the Command Center button — which, per the finding above,
does not happen anywhere in the app today.

**Every write site to `machine_jobs.status` grepped and confirmed —
full list, not spot-checked:**
1. `approve-quote-request/route.ts` (INSERT) — sets `status:
   'approved_for_machine'` AND now `delivery_method: 'machine_bridge'`
   explicitly in the same insert, not left to the column default alone.
2. `approve/route.ts` (UPDATE) — now checks `delivery_method ===
   'pathfinder_edge'` and returns a 409 refusal before doing anything else
   if it isn't, so a `machine_bridge`-routed job can never be pushed to
   PathfinderEdge through this route even if it somehow reached
   `pending_approval`.
3. `request-changes/route.ts`, `mark-delivered/route.ts`,
   `reject/route.ts`, `machine-bridge/job-delivered/route.ts` — each
   grepped directly; none ever sets `status = 'approved_for_machine'`
   (they set `changes_requested`, `sent_to_machine`, `rejected`,
   `staged_for_review`/`sent_to_machine`/`machine_error` respectively) —
   confirmed safe, not touched.

**`pending-jobs/route.ts` now filters on both `status = 'approved_for_
machine'` AND `delivery_method = 'machine_bridge'`** — a
`pathfinder_edge`-routed job can never be picked up by the Bridge's poll
even if a future bug re-adds a shared status value.

**`CommandCenterJobCard.tsx`'s stale hardcoded label fixed.** "Approved —
Queued for Bridge" was shown for every `approved_for_machine` job
regardless of which system actually has it — now `statusLabel()` reads
`job.deliveryMethod` and shows "Approved — Queued for Bridge" or
"Approved — Sent to PathfinderEdge" correctly. `CommandCenterDashboard.tsx`
has a separate, already-generic "Approved — Queued" label (no "for
Bridge" claim) — out of this prompt's explicit scope, not touched.

**CORRECTED 2026-08-20 — Migration 015 CONFIRMED applied to the live
Supabase project.** The note directly above this one, claiming the
migration was file-only and not yet applied, was wrong. Verified
2026-08-20 via a direct `information_schema` query: `machine_jobs.
delivery_method` exists on the live schema. This project's live Supabase
database has **no migration ledger** — there is no `schema_migrations`
table; migrations are applied manually via the Dashboard SQL Editor, with
no automated record of what has and hasn't run. Because of that, a
migration's live-apply status must never be assumed from its presence in
`supabase/migrations/`, from git history, or from a prior note in this
doc — it must be verified directly via `information_schema` (or
`pg_proc` for functions) each time it actually matters.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated, no errors.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own check — specifically a real end-to-end
test (a job explicitly set to `pathfinder_edge` reaching
`pending_approval` and getting approved) behaving as designed. This
session did not run that end-to-end test — no job exists at
`pending_approval` in the live database to test against. (The migration
itself is no longer the open question — see the correction above.)

---

## PATHFINDEREDGE — REAL API INTEGRATION, LIVE, WIRED TO THE APPROVE BUTTON: DONE (with explicitly flagged open gaps)

(2026-08-18) — scope: `lib/integrations/pathfinder-edge.ts`,
`app/api/admin/command-center/approve/route.ts`, `.env.example`,
`ARCHITECTURE.md`, plus `scripts/pathfinder-roundtrip-test.ts` (new,
manual-run only). This is a genuine status upgrade from stub to real,
not a rewrite that stays unconfirmed — see the two DONE-standard gates
plus the actual live round-trip evidence below, both met this session.

**The prior stub's core claim was wrong.** `lib/integrations/pathfinder-
edge.ts`'s header claimed "no REST API was discoverable" — that discovery
pass tried `Bearer <key>` auth; PathfinderEdge's real API
(https://docs.amscontrols.com/pathfinderEdge/publicapi, fetched and read
in full this session, not guessed) requires the key raw/unprefixed in the
`Authorization` header. `GET https://afs.pathfinderedge.com/api/v1/catalogs`
returns 200 with real data once auth is correct.

**A second, separate credential problem was found and fixed mid-session.**
The `PATHFINDER_EDGE_API_KEY` value already sitting in `.env.local` was
stale — NOT the key Reid had just confirmed live. Every request using it
returned a clean 401 from the real server (ruled out: key corruption/
whitespace — verified byte-for-byte via hex dump; network/proxy issues —
same sandbox, same request shape, the correct key worked immediately).
Reid supplied the correct current key; `.env.local` (gitignored, never
committed) now has it. Flagging this because it's exactly the kind of
silent staleness this file's own verification standard exists to catch —
if this session hadn't been required to actually run the round-trip test
live rather than assume the stub-era key was still good, this would not
have been caught.

**`lib/integrations/pathfinder-edge.ts` rewritten for real:**
`getPathfinderCatalogs()` and `pushProfileToPathfinder()` now make real
network calls. `discoverApiEndpoints()` repurposed from blind endpoint-
guessing into a real single-endpoint connectivity check.
`submitJobToMachine()`/`getJobStatus()` deliberately still return
`not_configured` — not a gap, PathfinderEdge's public API has no job-
submission/status endpoint at all (confirmed via
https://docs.amscontrols.com/pathfinderEdge/machine-sync): a profile
POSTed to the machine's subscribed catalog is picked up automatically on
the machine's own polling schedule, there is no "push to machine" or
"submit job" call to make. `PathfinderProfile`/`Catalog`/`MachineProfile`
etc. kept their exact prior shapes — every existing call site (`app/api/
admin/pathfinder/{route,push-profile,submit-job}.ts`) was grepped first
and needed zero changes.

**Units confirmed empirically, not assumed — genuinely, not just a
self-referential echo.** The profile-object doc says feature `length` is
"in your tenant's units" without naming one. `scripts/pathfinder-
roundtrip-test.ts` (kept as a documented manual test, not deleted) ran
two independent checks: (1) listed 10 real pre-existing profiles already
in catalog 20115 — blankWidth values 2.375 to 23.5, e.g. "PJC Austin" = 6,
"Standing Seam Drip Edge" = 8 — plausible only as inches for real
architectural flashing (as mm those would be sub-1cm parts); (2) posted a
known 6" bendless/hemless Straight, resolved its server-assigned
profileId (the POST response never echoes it — confirmed via the
publicapi doc; resolved with a follow-up catalog-scoped list call matched
by profile name), read it back, got `blankWidth: 6` exactly, then deleted
the test profile. Both signals agree: **units are inches**, confirmed by
Reid live in this session before Part 3 proceeded (see the mid-task
confirmation exchange). `mmToIn()` (25.4, rounded to 4 decimals, matching
`scripts/import-machine-profiles.ts`'s own existing convention) is
correct as written.

**`approve/route.ts` now makes a real call — confirmed by reading the
file first, not assumed.** It previously only flipped `machine_jobs.status`
to `approved_for_machine` with zero PathfinderEdge/machine contact. It now
fetches the job's real bend data (`machine_profile_bends` if
`machine_profile_id` is set, else `custom_bends`), builds a `MachineProfile`,
and calls `pushProfileToPathfinder` against catalog `20115` (hardcoded as
`AFS_MACHINE_CATALOG_ID`, confirmed by Seth Oliver as the only catalog the
Thalmann subscribes to) BEFORE flipping the status flag. If the push
fails, the job stays `pending_approval` and the admin sees the real
PathfinderEdge error (502, existing `CommandCenterJobCard.tsx` error UI
surfaces it unchanged) — approving no longer means "looks approved" when
nothing real happened.

**Answering this task's actual question directly: yes, the live "Approve
& Send to Machine" button now makes a real PathfinderEdge API call** (not
just a DB status flip) — confirmed by reading the route before and after,
not assumed.

**Explicitly open, not resolved this pass (see ARCHITECTURE.md §12 for
full detail on each):**
1. **No hem data reaches PathfinderEdge at all.** Neither
   `machine_profile_bends` nor `machine_jobs.custom_bends` stores hem
   information anywhere in this schema — `buildFeatures()` only ever
   emits `Straight`/`Angle`/`Radius`, never `OpenHem`/`TearDropHem`, even
   for a job with real hems. A data-model gap, not a client bug.
2. **Bend-angle sign convention and `radiusQuality: 'Medium'` are
   best-effort, not empirically confirmed.** The round-trip test
   deliberately used a bendless profile to isolate the units question —
   a real bend has not been pushed and visually checked against
   PathfinderEdge/the machine's own rendering yet.
3. **Possible dual-delivery path to the physical machine — a real open
   question, not resolved here.** The separate `afs-machine-bridge`
   project still polls `approved_for_machine` jobs and generates `.ds1`
   files for human-reviewed manual copy to the machine's live folder
   (ARCHITECTURE.md §11). Approving a job now ALSO pushes it into
   PathfinderEdge's catalog 20115, which the machine polls automatically.
   Both paths can now independently reach the same physical machine for
   the same approved job. Whether one should be disabled — and which —
   was out of scope for this prompt (which only asked to wire the approve
   button) and needs an explicit decision, not a default.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated, no errors. Live round-trip test output captured
in full in this session's transcript (create -> resolve id 32909938 ->
read back `blankWidth: 6` -> delete, status 200 throughout).

---

## FLASHDRAFT — KICK DIRECTION FLIPPED, TYPE-SPECIFIC GAP DEFAULTS, EXISTING-HEM RE-OPEN RADIUS: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

(2026-08-18) — scope: `app/studio/draft/page.tsx`, `lib/types/profile.ts`.
Three independent fixes, all confirmed live by Reid before this prompt (root
causes given directly, not re-diagnosed this session).

**1. Kick direction was inverted.** `mirrorGlyph = hem.kick === 'inside'`
rendered backwards — Reid confirmed live that selecting "Outside" visually
produced the inside result and vice versa. Flipped the single comparison to
`mirrorGlyph = hem.kick === 'outside'`; nothing else in the mirror
construction (`hem-glyph.ts`'s `ctx.scale(1,-1)`) touched.

**2. Open and Smashed shared one default gap, reading as visually
identical.** `HEM_DEFAULT_GAP_IN` (0.0625"/1/16") replaced with two
type-specific constants in `lib/types/profile.ts`:
`HEM_DEFAULT_GAP_IN_OPEN = 0.1875` (3/16") and
`HEM_DEFAULT_GAP_IN_SMASHED = 0.03125` (1/32", nearly flush). `gapIn`
remains fully per-hem editable — this only changes what a newly created
hem starts at. `applyHem` (`page.tsx`) now resolves the type-specific
default directly from the type button clicked, rather than filtering
through the `hemGapDraft` text field as the prior single-constant version
did — that filtering was silently equivalent to always using the one old
constant, since the Gap input can't have been user-edited before a type
exists yet (it only renders once a hem exists). `applyHem` now also
explicitly re-syncs `hemGapDraft` to the resolved value after creation, so
the displayed field never lags behind the real `hem.gapIn`. Teardrop has
no gap concept (`hem-glyph.ts`'s teardrop branch never reads `gapPx`,
confirmed by re-reading it this pass) — it inherits Open's default only
because `gapIn` is a required field on `Hem`, not because either constant
means anything for its rendering.

**3. Re-opening an existing hem's popup was too easy to miss.** The only
way to reopen a hem was double-clicking the exact
`HEM_TRIGGER_OFFSET_IN`-offset point `handleDoubleClick` computes, with no
feedback on a near-miss and no way to distinguish it from the neighboring
bend-radius control. Added `HEM_HIT_RADIUS_EXISTING_PX = 38` (~1.75x the
existing `HEM_HIT_RADIUS_PX = 22`, within Reid's requested 1.5x-2x range),
applied only at an endpoint where `hemStart`/`hemEnd` is already set — a
fresh double-click where no hem exists yet still uses the original tighter
`HEM_HIT_RADIUS_PX`, unchanged.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated, no errors. Screenshots taken against a live
`pnpm dev` server on the real `/studio/draft` canvas via a standalone
Playwright script (the Claude-in-Chrome extension was not connected this
session, so browser automation went through Playwright directly instead —
same live app, same real canvas, not a mock): `proof-hem-kick-direction-
full.png` (both endpoints of one profile, Outside default at the start
and Inside explicitly picked at the end) with tight closeups
`proof-hem-kick-start-outside-closeup.png` / `proof-hem-kick-end-inside-
closeup.png` (Hem Length/Gap temporarily bumped to 3"/1" via the popup's
own editable fields, not a code default change, purely so the mirrored
U-shape reads clearly at 1x app zoom); `proof-hem-gap-defaults-full.png`
(one profile, Open at the start reading "OPEN 3/16" gap", Smashed at the
end — the popup's own Gap field read back 0.1875 and 0.03125 respectively
before closing, confirming the internal value matches the label);
`proof-hem-reopen-reliability.png` (an existing Open hem re-opened 3/3
times via double-clicks offset 18-22px from the true vertex — inside the
new 38px existing-hem radius, outside the old 22px one — screenshot is the
3rd successful re-open, popup fields visible).

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own visual check — specifically whether the
flipped kick mapping now matches his reference sketch (this session had no
access to that sketch, only his description that the old mapping was
backwards) and whether 3/16"/1/32" read as sufficiently distinct at
default zoom in normal use, not just in the length/gap-exaggerated
closeups used here for clarity.

---

## FLASHDRAFT — TEARDROP PROPORTIONS RESTORED, REAL MINIMUM VISIBLE SIZE ENFORCED: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

(2026-08-17) — scope: `lib/flashdraft/hem-glyph.ts`, `app/studio/draft/page.tsx`.
Root cause was given directly in this prompt (not re-diagnosed): two
separate regressions from the previous "sized from material thickness"
pass.

**1. Tangent-circle proportions had drifted from the validated values.**
`hem-glyph.ts`'s teardrop branch used `d = R * 0.3, r = R * 0.22` —
tighter than the earlier Reid-confirmed `d = R * 0.42, r = R * 0.36`.
Restored exactly those two literals; nothing else in the tangent-circle
construction touched.

**2. The thickness-driven floor was too small to read as a loop at all.**
`page.tsx`'s teardrop `R` computation floored at `HEM_GLYPH_R` (6px) —
with no gauge selected (the `effectiveThicknessIn` fallback of 0.0625"),
`R` collapsed to exactly that floor, which at the (now-restored) tangent-
circle ratios renders a loop under 4px across — indistinguishable from a
dot at normal zoom. Confirmed by Reid's own live no-gauge test. Added a
new, separate constant `MIN_TEARDROP_R = 14` (px) and switched the floor
from `Math.max(HEM_GLYPH_R, ...)` to `Math.max(MIN_TEARDROP_R, ...)` —
same "guarantee legibility over strict proportionality" principle
Open/Smashed's own `MIN_READABLE_R` already applies, just a smaller floor
value since Teardrop's curl is supposed to read as tight, not like Open's
hook. `TEARDROP_THICKNESS_TO_R` itself, the straight connecting-line
logic, and the Open/Smashed branches are all unchanged, per this prompt's
explicit scope. The popup icon (`HemGlyphIcon`/`HEM_ICON_GLYPH_R`) was
also explicitly out of scope this pass and was not touched.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated, no errors. Screenshot reproduces Reid's exact
failing case (Teardrop hem, no material/gauge selected — confirmed via
`#material`/`#gauge` field values read directly from the page, both
empty strings) on the live `/studio/draft` canvas, zoomed to 177% via the
toolbar's zoom-in control: `proof-teardrop-no-gauge-full.png` (1400×900px,
134KB, full canvas context) and `proof-teardrop-no-gauge-closeup.png`
(160×120px, a tight crop located by scanning the canvas's own pixel data
for the crimson glyph rather than a guessed offset, showing the loop
unambiguously as a small closed circle, not a dot). Not near-empty files
like a prior session's 1.9KB screenshot — both were visually confirmed
before being reported here.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own visual check against the live canvas —
specifically whether `MIN_TEARDROP_R = 14` and the restored `0.42`/`0.36`
ratios together produce the exact loop tightness/size he expects; both
were given as exact values in this prompt, not derived independently
this session, so confirming they combine correctly (rather than each
being independently correct) is the open question.

---

## SITE-WIDE — CRIMSON EYEBROW LABEL LEGIBILITY FIX: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

(2026-08-17) — Reid confirmed via side-by-side DevTools comparison (crimson
hard-hat icon vs. the "INDUSTRY STANDARDS & MANUALS" label on
`/resources`, same page, same monitor) that both compute to the identical
correct `--afs-crimson` value (`rgb(192 0 26)`) but the small uppercase
tracking-wide text reads visibly less saturated than solid crimson shapes
— a small-text antialiasing/weight legibility issue, not a wrong color.
`--afs-crimson` itself is unchanged.

Added one shared class, `.eyebrow-label`, to `app/globals.css` (next to
the existing `--afs-crimson-glow` token / `.hero-glow-red` block):
`font-family: var(--font-barlow)` (= `font-label`), `text-transform:
uppercase`, `color: var(--afs-crimson)`, `text-shadow: var(--afs-crimson-
glow)` (reuses the already-defined token, adds perceived brightness
without changing the base color), `font-weight: 600` (Barlow's next
loaded weight step up from these labels' previous unstyled 400 default —
heavier strokes at small sizes reduce the antialiasing-driven
desaturation). Deliberately does **not** set `font-size` or
`letter-spacing`: the 9 files' call sites vary those intentionally (a
hero kicker at `text-lg` vs. a dense table badge at `text-[10px]`,
`tracking-wide` vs. `tracking-widest`), and this file's plain CSS rules
are emitted after Tailwind's generated utilities in the compiled
stylesheet — at equal specificity a font-size baked into the shared class
would always win over an element's own `text-*` utility regardless of
className order, silently overriding those per-instance choices. Each of
the 10 call sites (9 files, `about/page.tsx` has 2) had its `font-label`,
`uppercase`, and `text-afs-crimson` classes replaced with `eyebrow-label`;
existing `text-*` size, `tracking-*`, and all margin/border/padding
classes were left untouched, per this prompt's "do not remove
non-color-related classes" instruction. Confirmed via grep that no
matching pattern was missed and no unrelated `text-afs-crimson` usage
(hover-state links, solid-fill icons, buttons on light backgrounds) was
touched.

One real bug caught by the build gate, not by review: the first draft of
the CSS comment above `.eyebrow-label` used the literal phrase
`text-*/tracking-*`, whose `*/` substring is a valid CSS comment-close
token — it silently terminated the comment early, and `pnpm run build`'s
CSS minification step (`cssnano`) failed with `Unexpected '/'. Escaping
special characters with \ may help.` Fixed by rewording the comment to
avoid a literal `*/` sequence; rebuilt clean afterward.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated, no errors. Screenshots of 4 of the 9 files' fixed
labels on a live `pnpm dev` server (not localhost is not achievable in
this environment — see the verification standard note below), saved at
repo root: `proof-eyebrow-resources.png` (`/resources`, the exact
"INDUSTRY STANDARDS & MANUALS" card Reid referenced), `proof-eyebrow-
about-hero.png` (`/about`, "ABOUT AFS" hero kicker), `proof-eyebrow-
about-equipment.png` (`/about`, the three bordered equipment badges —
`UNLIMITED PROFILES` / `HIGH-VOLUME ROLL FORMING` / `ON-SITE
CAPABILITY`), `proof-eyebrow-contact.png` (`/contact`, the `PHONE` /
`GENERAL` / `OWNER` card labels).

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own check against the live site on his own
screen (not a phone photo of a monitor, not this session's localhost
screenshots) — the whole premise of this fix is a perceptual/legibility
judgment call only he can make.

---

## FLASHDRAFT — AUTO-FIT VIEW AFTER MANUAL LENGTH ENTRY: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

`b9a8d54` (2026-08-11) — one-block addition at the end of `applySegmentLength`
(`app/studio/draft/page.tsx`): after `commitPoints(newPoints)`, the view is
now re-fit using the same `computeFitView` mechanism already used by
`fitToScreen` and `loadTemplate` (reused exactly, no second fit-to-view
implementation was written). Reported symptom: typing a new length into the
manual segment-length box (e.g. resizing a leg to 96") could move the
geometry off-screen at the previously-set zoom/pan, with no re-center or
re-scale to bring it back into view. `commitPoints`, `computeFitView` itself,
`fitToScreen`, and `loadTemplate` were left untouched; no new UI element was
added — the existing `segmentInputPos` / `segmentLengthInput` input box is
unchanged.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both passed
in the session that made this change, and the commit is pushed to
`origin/main`. Per the verification standard above, this is canvas
view/zoom/pan behavior — visual and interactive — so it stays
**IMPLEMENTED, UNCONFIRMED** until Reid independently confirms a resized leg
is actually visible on screen after typing a new length, on the live canvas.

---

## FLASHDRAFT — HEM-MENU TRIGGER OFFSET FROM TRUE ENDPOINT: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

`e5eb3a7` (2026-08-11) — in `handleDoubleClick` (`app/studio/draft/page.tsx`),
added `HEM_TRIGGER_OFFSET_IN = 0.5` and changed the hem double-click
hit-test targets from the true vertex positions (`points[0]` /
`points[points.length - 1]`) to points extrapolated 0.5in past each true
endpoint, along that end's own leg direction, computed in world space
before conversion to screen space via `worldToScreen`. Reported symptom:
hit-testing directly against the true vertex collided with vertex-drag,
making double-click near a leg's end unreliable. The single-point case
(`points.length === 1`, no leg direction exists yet) still hit-tests
directly against `points[0]`, unchanged. `HEM_HIT_RADIUS_PX` and the
`dStart <= dEnd` tie-break are unchanged, now measured against the new
offset targets. The hem popup's on-screen anchor position
(`startScreen` / `endScreen`, used for `setHemPopup`) still anchors at the
true vertex — only the hit-test target changed. `drawHemGlyph` and
`HEM_GLYPH_R` were not touched.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both passed
in the session that made this change, and the commit is pushed to
`origin/main`. Per the verification standard above, this is canvas
double-click/hit-test behavior — visual and interactive — so it stays
**IMPLEMENTED, UNCONFIRMED** until Reid independently confirms
double-clicking near a leg's end reliably opens the hem popup on the live
canvas.

---

## FLASHDRAFT — LEG-BODY GRAB CURSOR: FIXED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

`a551366` (2026-08-11) — one-line fix in `handlePointerMove`
(`app/studio/draft/page.tsx`): leg-body segment hover was setting
`canvas.style.cursor = 'pointer'` instead of `'grab'`, while vertex hover
already correctly set `'grab'`. Reported symptom: "I have to click multiple
times before the grab hand shows up" — the grab cursor was never wired to
leg hover at all, only to vertex hover and to an in-progress drag past the
movement threshold. Changed the segment-hover branch to `'grab'` so it now
matches vertex-hover behavior and appears on hover, before any click. The
`'grabbing'` cursor set elsewhere (drag-candidate resolution, leg-hem drag
branch) was left untouched — that is the correct active-drag state, distinct
from this hover fix.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both passed
in the session that made this change, and the commit is pushed to
`origin/main`. Per the verification standard above, this is a canvas
hover/cursor behavior — visual and interactive — so it stays
**IMPLEMENTED, UNCONFIRMED** until Reid independently confirms the grab
cursor appears on leg-body hover on the live canvas.

---

## FLASHDRAFT — TEARDROP SIZED FROM MATERIAL THICKNESS (NOT HEM LENGTH), KICK MIRROR CONFIRMED ALREADY WORKING: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

(2026-08-17) — scope: `lib/flashdraft/hem-glyph.ts`, `app/studio/draft/page.tsx`.

**Part 1 — Teardrop's curl was sized like Open's hook, which is wrong for
Teardrop specifically.** `renderHemAt`'s teardrop branch used the exact
same length-driven `R` formula as Open — `Math.max(MIN_READABLE_R,
hem.lengthIn * PIXELS_PER_INCH * zoom * HEM_GLYPH_LENGTH_SCALE)` — so
raising Hem Length ballooned the curl itself into an oversized loop.
Reid's own reference photos of real formed material show a SMALL, TIGHT,
closed curl only at the very tip — the strip runs flat and straight
almost its full length first. The curl's real-world size reads as
proportional to material thickness, not fold-back length. Fixed for
teardrop only (Open/Smashed untouched, per this prompt's explicit
instruction): new `TEARDROP_THICKNESS_TO_R` constant (`1 / 0.22`, derived
from `hem-glyph.ts`'s own teardrop construction where the loop's circle
radius is `R * 0.22` — this factor makes that circle's real-world radius
work out to ~1x material thickness) drives `R` from `effectiveThicknessIn`
(`gauge ? thicknessIn : 0.0625`) instead of `hem.lengthIn`. Floors at
`HEM_GLYPH_R` (6px) rather than `MIN_READABLE_R` (10px) — the larger floor
is sized for Open's hook and reproduced the same oversized-loop symptom.
The straight connecting line to the curl is still `hem.lengthIn`-driven,
unchanged (matches the photos — the strip does stay flat/straight until
the tip).

**Part 2 — investigated the "Kick shows no visible difference" report;
found no bug in the current code.** Reproduced Reid's exact E/F test setup
(start endpoint, Open, 3/4" gap, only Kick toggled) and confirmed via raw
canvas pixel sampling (`ctx.getImageData`, not just eyeballing a
screenshot) that Outside and Inside render on opposite sides of the leg
line — the mirror already works. `git diff` confirms zero changes to
`lib/flashdraft/hem-glyph.ts` this session. Most likely explanation: the
E/F screenshots predate the prior session's `3fa8c704` fix (which rebuilt
Kick as a real `ctx.scale(1,-1)` mirror). This session's own first
screenshot attempt also produced a misleadingly-cropped comparison that
looked identical at a glance before pixel sampling caught the actual
(correct) behavior — see SESSION_STATE.md's fuller writeup for the
debugging trail, useful if this report recurs.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded, 132/132
static pages generated. Screenshots checked in at repo root:
`proof-teardrop-thickness-sized.png` / `proof-teardrop-thickness-sized-full.png`
(small tight curl at Hem Length 1.5", proving decoupling from length);
`proof-kick-start-outside-full.png` / `proof-kick-start-inside-full.png`
(same E/F setup, hook visibly mirrored). Full technical detail and the
exact pixel-sampling methodology in SESSION_STATE.md's matching entry.

Per the verification standard, this stays **IMPLEMENTED, UNCONFIRMED**
pending Reid's own visual check of the teardrop against his actual
reference photos (not present in this repo — this session compared
against the photos' description as given in the prompt, not the photo
files themselves).

---

## FLASHDRAFT — OPEN FOLD-DIRECTION BUG FIXED, KICK REBUILT AS A TRUE MIRROR, GAP WIRED THROUGH TO THE GLYPH: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

`3fa8c70` (2026-08-14, later the same day as the "HEM LENGTH NOW
SCALES..." pass immediately below, which this pass supersedes on kick
mechanism and gap wiring specifically) — coordinated pass across
`lib/flashdraft/hem-glyph.ts`, `lib/types/profile.ts`, and
`app/studio/draft/page.tsx`.

**Root cause fix: Open's fold direction was inverted relative to
Teardrop/Smashed.** `renderHemAt`'s `open` branch computed `foldTip` from
a separate `foldDir = { x: -u.x * kickSign, y: -u.y * kickSign }`
(negated `u`), while the `teardrop`/`smashed` branches both used
`u` directly (un-negated) — the two branches disagreed on which
direction was "outward" for the exact same endpoint mechanism. Deleted
`foldDir` entirely; the `open` branch now computes `foldTip` with the
identical formula the other two branches already used —
`{ x: p.x + u.x * hem.lengthIn, y: p.y + u.y * hem.lengthIn }` — so all
three hem types are now geometrically consistent.

**Kick rebuilt as a true perpendicular mirror, not a 180° angle
rotation.** The prior `kickSign`/`glyphAngle` mechanism (`kickSign = -1`
multiplier on the fold-direction vector, plus `angleU + Math.PI` on the
angle passed to the glyph) is deleted entirely — it rotated the glyph's
local frame rather than mirroring it, which is a different
transformation (it does not reliably flip which side of the leg line
the hook/loop curls toward). `drawHemGlyph` (`lib/flashdraft/hem-glyph.ts`)
gained a real `mirror: boolean = false` parameter: when true, `ctx.scale(1,
-1)` is inserted into the existing `save`/`translate`/`rotate` sequence,
after `rotate` — this flips local +y vs -y (which side of the leg's own
line the construction occupies) while leaving local +x (direction along
the line) untouched, applied identically to `drawHookGlyph`
(open/smashed) and the teardrop tangent-circle construction since both
run inside the same transformed context. In `page.tsx`, `glyphAngle` is
deleted — every `drawHemGlyphHere` call now passes `angleU` directly —
and `mirrorGlyph = hem.kick === 'inside'` is the sole thing kick now
drives.

**Kick terminology renamed `'inward' | 'outward'` → `'inside' |
'outside'`** (`HemKick` in `lib/types/profile.ts`, the type itself, not
just UI labels — default renamed `'outward'` → `'outside'`, same
underlying behavior, no change for existing/default hems). The popup's
Kick toggle buttons now read Outside/Inside.

**Gap now actually drives the glyph — real bug, not cosmetic.**
`drawHookGlyph` previously hardcoded `gapFraction` per type (`0.7` open,
`0.12` smashed) and computed `gap = R * gapFraction` — `Hem.gapIn` was
never read at all, which is why editing the Gap field in the popup had
no visible effect. `drawHookGlyph` now takes a real `gapPx` parameter
(absolute screen pixels) and uses it directly as the gap distance;
`drawHemGlyph` gained a matching `gapPx: number = R * 0.7` parameter
threaded through to it. `page.tsx` computes
`gapPx = hem.gapIn * PIXELS_PER_INCH * zoom` once in `renderHemAt` and
passes it to `drawHemGlyphHere` for both `open` and `smashed` (Teardrop
has no gap concept, unchanged). `R` continues to control the hook's
overall length, independent of `gapPx` — confirmed visually: at fixed
Hem Length, changing Gap from 1/16" to 3/4" visibly widens the hook
opening with no change to its overall length.

**This is a first-pass mapping of `kick` to the mirror boolean —
`'inside'` was chosen to mean `mirror: true` (and `'outside'` to mean
`mirror: false`) as a guess, not a confirmed physical mapping.** Verified
in this session (see screenshots below) that toggling kick at a FIXED
endpoint does correctly flip the hook to the opposite side of the leg
line with no change to gap or length — the mirror mechanism itself
works. What is **not** yet confirmed is whether `'inside'` is the
physically-correct label for the side it produces on Reid's own
reference sketch — that mapping is one `===` comparison
(`hem.kick === 'inside'`) away from being flipped if he says it's
backwards.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded (full route
table generated, `/studio/draft` included). Screenshots checked in at
`studio-hem-fix-screenshots/` (repo root): `A_full_outside_vs_inside_same_gap.png`
(full canvas, one leg, Open hem at each end — start=Outside kick,
end=Inside kick, same 3/4" gap on both, per this prompt's literal
request); `B_both_hooks_same_gap_zoom.png` (tight crop of the same pair);
`E_start_kick_OUTSIDE.png` / `F_start_kick_INSIDE.png` (the SAME
start-endpoint hem, same gap/length, before/after toggling only Kick —
direct proof the mirror flips the hook to the opposite side of the leg
line, isolated from the base angle difference between endpoints);
`G_end_kick_OUTSIDE.png` / `H_end_kick_INSIDE.png` (same isolation test
at the end endpoint); `C_gap_small_0.0625in.png` / `D_gap_large_0.75in.png`
(same start hem, same Outside kick, same Hem Length — Gap changed from
1/16" to 3/4", showing the visual gap change independently of hook
length). Driven via a Playwright script against a real `pnpm dev` server
(not the debug page) — `page.mouse` drag gestures to draw the leg,
`page.getByRole('button', ...)` clicks for the popup's type/kick
buttons, `page.locator(...).fill(...)` for the Gap field — chosen over
the Chrome DevTools extension per this project's own prior-session
notes that its coordinate-space mapping is unreliable for multi-step
canvas interaction.

Per the verification standard, this stays **IMPLEMENTED, UNCONFIRMED**
pending Reid's own check against his reference sketch — do not mark
DONE. Specifically flagged as first-pass and likely needing a one-line
flip if wrong: whether `hem.kick === 'inside'` is the correct condition
for `mirror: true`, per the note above.

---

<details>
<summary>Superseded pass (2026-08-14, earlier the same day) — kick mechanism and gap wiring below are no longer current; kept for archaeology</summary>

## FLASHDRAFT — HEM LENGTH NOW SCALES THE GLYPH, GAP RETURNS AS EDITABLE, KICK DIRECTION ADDED: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

`2471830` (2026-08-14, same day as the "GAP REMOVED..." pass immediately
below and later in the session — Reid reversed the "Gap is a fixed
constant" decision from that same earlier pass) — single coordinated
pass across
`lib/types/profile.ts` and `app/studio/draft/page.tsx`.
`lib/flashdraft/hem-glyph.ts`'s internal shape math
(`drawHookGlyph`/teardrop tangent-circle construction) was explicitly
out of scope and was not touched.

**Root cause fix: Hem Length now scales the glyph itself, not just its
position.** `foldTip` was already correctly computed from `hem.lengthIn`
in all three `renderHemAt` branches — the straight leg-to-fold connecting
line always grew correctly. The bug was downstream: `drawHemGlyphHere`
was called with a FIXED screen-pixel radius
(`HEM_GLYPH_DISPLAY_R = 12`, unrelated to `lengthIn`) at that `foldTip`
point, so increasing Hem Length only pushed the fixed-size icon further
away along a longer line — the fold shape itself never grew, reading as
"extending the leg" rather than a bigger hem. `HEM_GLYPH_DISPLAY_R` is
deleted; every `renderHemAt` call site now computes
`R = Math.max(MIN_READABLE_R, hem.lengthIn * PIXELS_PER_INCH * zoom * HEM_GLYPH_LENGTH_SCALE)` —
a real screen-pixel radius derived from the hem's actual inch length,
zoom-aware. `MIN_READABLE_R = 10` (px floor, so a very short hem never
collapses to an illegible dot) and `HEM_GLYPH_LENGTH_SCALE = 1.0` (a
tuning multiplier on top of the literal inch-to-pixel mapping) are both
new constants, both first-pass values — **not yet confirmed as the right
tuning by Reid.** Note this floor means the size difference between a
short and a long hem reads as subtle at low canvas zoom (both can sit
near the 10px floor) but is unambiguous once zoomed in — see the
screenshots below, captured at zoom levels where the growth is clearly
visible. The popup icon glyphs (`HEM_ICON_GLYPH_R`, a fixed-size UI
element showing hem TYPE, not real dimension) were explicitly excluded
from this change, per this prompt's scope.

**Gap returns as a real per-hem editable field** (Reid reversed the
"Gap is a fixed shop constant" decision from earlier the same session —
see the pass immediately below). `HEM_DEFAULT_GAP_IN` `0.125` (1/8") →
`0.0625` (1/16") — still only a default for a newly-created hem; each
hem's own `gapIn` remains independently editable. The popup's "Gap (in)"
field is back, in the same slot/pattern as "Hem Length (in)", reusing
the pre-removal `hemGapDraft`/`setHemGapDraft` state naming (found via
`git show` on the removal commit) with a generalized `setHemGap` handler
(the old `setOpenHemGap` was gated to the `open` type only; the field is
now shown — and gapIn preserved across type switches, matching how
`lengthIn` already behaved — for all three hem types, per this prompt's
explicit instruction to place it in the same always-visible block as
Hem Length).

**New `kick: 'inward' | 'outward'` field on `Hem`** (`lib/types/profile.ts`,
default `'outward'`, matching prior visual behavior so existing/default
hems are unaffected). A new Kick toggle (Outward/Inward) sits in the hem
popup below Gap. `'inward'` flips both the direction vector driving
`foldTip` and the glyph's own rotation angle together (a `kickSign =
-1` multiplier on the fold direction, plus `+ Math.PI` on the angle
passed to `drawHemGlyphHere`) — a first-pass mirror implementation, since
`drawHemGlyph` only accepts a rotation angle, not a true
perpendicular-mirror parameter, and hem-glyph.ts's internals were out of
scope to change. **This specifically needs Reid's live visual
confirmation that the mirror reads as "folds to the physically opposite
side" — not just that it visibly changes.**

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded. Screenshots
checked in at repo root: `hem-audit-2026-08-14-length-scale-small.png`
(0.5" default length, zoomed in) and `-length-scale-large.png` (same
hem, length changed to 2" — visibly larger fold shape, not just a longer
connector line) demonstrate the root-cause fix;
`-popup-length-gap-kick.png` shows Hem Length, Gap, and the Kick toggle
together in the popup; `-kick-outward.png` and `-kick-inward.png` are the
same start-endpoint hem before/after toggling Kick, for Reid to judge the
mirror direction; `-both-hems-full-canvas.jpg` shows a full profile with
one endpoint kicked inward and the other outward. Captured via direct
`PointerEvent`/`MouseEvent` dispatch against a real `pnpm dev` server (not
the debug page) — the Chrome DevTools extension's click/screenshot
coordinate-space mapping proved unreliable for multi-step canvas
interaction in this session (consistent with the same tooling caveat
noted in the 2026-08-14 entry below and in SESSION_STATE.md), so this
session drove the canvas via `element.dispatchEvent(new PointerEvent(...))`
in the page's own JS context instead, using the canvas's own
`getBoundingClientRect()` for coordinates.

Per the verification standard, this stays **IMPLEMENTED, UNCONFIRMED**
pending Reid's own check — do not mark DONE. Two things flagged
specifically as first-pass and likely needing adjustment once seen live:
the inward-kick mirror direction, and `HEM_GLYPH_LENGTH_SCALE`'s default
value of `1.0`.

**Update from the pass above this one:** the "inward-kick mirror
direction" concern was well-founded — the `kickSign`/`glyphAngle`
rotation approach described here did not actually mirror the glyph
(rotation ≠ mirror), and Open's fold direction was separately found to
disagree with Teardrop/Smashed. Both are fixed in the
"OPEN FOLD-DIRECTION BUG FIXED..." entry above this `<details>` block.
`HEM_GLYPH_LENGTH_SCALE`'s default of `1.0` was out of scope for that
pass and remains an open first-pass value.

</details>

---

## FLASHDRAFT — 3D VIEW DOES NOT RENDER HEMS: NOT STARTED

**Status: NOT STARTED. Newly identified, not a regression from this
session's work.**

`ProfileViewer3D` (`components/studio/ProfileViewer3D.tsx`) has no
hem-related props at all — confirmed by direct inspection of its prop
interface. The 3D view renders the extruded profile body but never
draws hem folds, so a profile with hems set in the 2D draft canvas shows
no hems at all when switched to 3D. This needs real scoping as its own
task (prop plumbing from `hemStart`/`hemEnd` through to a 3D
representation of the fold, decisions about how to represent `kick` and
`lengthIn` in three dimensions) — not a quick prop pass-through, and out
of scope for this pass per its own instructions.

---

## FLASHDRAFT — HEM SYSTEM: GAP REMOVED, MID-LEG HEMS DELETED, TEARDROP RETIGHTENED: IMPLEMENTED, UNCONFIRMED

**Status: IMPLEMENTED, UNCONFIRMED. Do not mark this complete.**

`c-pending` (2026-08-14, uncommitted at time of writing this entry) —
single coordinated pass across `lib/types/profile.ts`,
`app/studio/draft/page.tsx`, and `lib/flashdraft/hem-glyph.ts`. Rewritten
here rather than appended to, per this prompt's own instruction — the
change is large enough that the prior incremental history below (the
`7de79db` → `e9b5060` chain) is kept for archaeology but no longer
describes current behavior in several places (gap value, glyph size,
teardrop proportions, and the entire mid-leg hem feature it references
are all superseded).

**Gap is no longer user-editable.** `HEM_DEFAULT_GAP_IN` (real-world
constant, confirmed by Reid from shop practice) changed `0.1875` (3/16")
→ `0.125` (1/8"). The popup's "Gap (in)" field is gone entirely — for
both `hemPopup` (Hem, profile endpoints) and the now-deleted
`legHemPopup` (see below). `Hem` gained its own `lengthIn: number` field
(default `0.5"`, `HEM_DEFAULT_LENGTH_IN` in `lib/types/profile.ts`) —
each hem's fold-back length is independently editable via a new "Hem
Length (in)" field occupying the same popup slot the Gap field used to.
`hemAllowanceIn` now reads each hem's own `lengthIn` instead of the
single global `HEM_FOLD_DEPTH_IN` constant (deleted).

**Positioning fix.** `renderHemAt`'s `foldTip` now computes from the
hem's own `lengthIn` instead of the deleted global constant. The
perpendicular gap-offset positioning (`offsetTip`/`sOffsetTip`, plus the
`perp` vector that fed it) is gone — `drawHemGlyphHere` is called
directly at `sFoldTip`, matching how teardrop/smashed already worked;
the glyph's own internal air-gap rendering (already correct, inside
`hem-glyph.ts`) is what shows the gap now, not a separate positional
offset in `page.tsx`.

**Vertex dot suppressed at hemmed endpoints.** The `points.forEach`
vertex-dot draw loop skips the fill when `i === 0 && hemStart` or
`i === points.length - 1 && hemEnd` — the hem glyph itself is the visual
marker there now, so the plain dot no longer duplicates/clutters it.

**Mid-leg hems: DELETED entirely** (supersedes the "NOT DONE" entry that
used to follow this one — confirmed geometrically impossible to
fabricate, per Reid). Removed from `lib/types/profile.ts`: the `LegHem`
interface, `legHemAllowanceIn`, `sumLegHemAllowanceIn`. Removed from
`app/studio/draft/page.tsx`: `legHems` state and every setter,
`legHemPreview`, `legHemDragRef`, `legHemPopup` and its full popup UI
block, `legHemRearmCandidateRef`, `renderLegHemAt`, the
`LEG_DRAG_BACKWARD_COS_THRESHOLD`/`LEG_HEM_MIN_DRAG_IN` constants, the
"drag back on any leg for a hem there" UI hint text, and the entire
backward-drag disambiguation system in `handlePointerDown`/
`handlePointerMove`/`handlePointerUp` that decided whether a drag on a
leg's body or a vertex became a hem-creation gesture or a reshape.
Ordinary leg-body reshape (drag a leg's body to move its far endpoint)
and direct vertex-drag continue to work — verified below — now applying
uniformly regardless of drag direction, since there's no more hem
gesture for "backward" to mean. Grep-confirmed zero remaining
`LegHem`/`legHem`/`renderLegHemAt` references anywhere in `app/`, `lib/`,
`components/` (one explanatory comment in `profile.ts` describes the
removal without using the type name).

**Teardrop tightened further.** `e9b5060`'s `d = R*0.42, r = R*0.36`
(still described there as "a first pass ... not yet confirmed") changed
to `d = R*0.3, r = R*0.22` — same non-self-intersecting tangent-circle
construction (`d > r` still holds), only the two ratios changed, per
Reid's real reference photos showing a tight rolled curl rather than a
circle.

**Glyph display size.** `HEM_GLYPH_DISPLAY_R` (`app/studio/draft/page.tsx`)
`22` → `12`.

**Leg-shrink bug ("leg 1 lengthens but won't shorten") — investigated,
root cause found, already fixed as a side effect of the mid-leg-hem
deletion above, no separate code change needed.** Reid reported the
first leg could lengthen but not shorten via drag, while every
subsequent leg worked normally. Root-caused by tracing the pre-existing
`legHemRearmCandidateRef` mechanism (now deleted, see above): in the old
`handlePointerDown`'s `vertexHit !== null` branch, dragging ANY interior
bend point armed a rearm-candidate unconditionally — no exception for
distance from the profile start — so a first real movement pointing
"backward" along the incoming leg (Math.cos check against
`LEG_DRAG_BACKWARD_COS_THRESHOLD`) redirected the gesture into
hem-creation instead of the vertex-reshape the user intended, which is
exactly what "won't shorten" looks like from the outside (dragging
backward — the natural shrink direction — silently did something else).
The leg-body-drag variant of the same mechanism had a narrow exception
(`hemEligible = !nearAbsoluteStart`, only within ~22px of the profile's
absolute start point) that doesn't fully explain the reported
leg-index-specific asymmetry, but is moot now regardless: the entire
interception system is gone. Verified via a Playwright script (the
Chrome DevTools extension used earlier in this session proved
unreliable for this precise a multi-step interaction — screenshot/click
coordinate-space mismatches and page-scroll drift repeatedly caused
false negatives, documented in the session transcript, not in code) —
drew a 3-leg profile (20"/15"/20"), shrank leg 0 via leg-body drag
(55"→50"), shrank leg 1 via leg-body drag on a fresh profile (55"→50"),
shrank leg 0 via direct vertex-drag (55"→50"), shrank leg 1 via direct
vertex-drag (55"→50", separate profile), and repeated the leg-0
lengthen-then-shrink sequence with the default Snap-to-15°/Snap-to-1/8"
settings ON (55"→60"→50"). All five reproduced correctly and
symmetrically — no leg-index asymmetry found in the current code.

Required gates for this pass: `pnpm tsc --noEmit` — 0 errors. `pnpm run
build` — succeeded (full route table, `/studio/draft` included,
`.next/BUILD_ID` confirmed present after the run — an earlier attempt in
this same session reported success with a truncated log and no
`BUILD_ID`, traced to a stray duplicate build process killed mid-run;
the run reported here was isolated and verified for real). Screenshots
checked in at repo root: `hem-audit-2026-08-14-open-popup.png` (Hem
Length field visible, no Gap field), `hem-audit-2026-08-14-endpoint-zoom.png`
(no vertex dot at the hemmed start endpoint), `hem-audit-2026-08-14-teardrop.png`
and `-teardrop-closeup.png` (tightened curl), `hem-audit-2026-08-14-full-canvas.png`.
Captured via the same Playwright approach as the leg-shrink verification
above, against a real `pnpm dev` server — not the debug page.

---

<details>
<summary>Prior incremental history (2026-08-06 through 2026-08-13) — superseded in several particulars by the pass above, kept for archaeology</summary>

`e9b5060` is the most recent commit (prior to the pass above) touching
hem rendering, and is now itself superseded on gap value, glyph size,
and teardrop proportions. What none of the passes below ever achieved is
user-confirmation — every one was reported "verified live" by the
session that made it, and every one of those self-reports has so far
been insufficient. Treat hem geometry as **open** until Reid confirms
against the real rendered canvas.

Multiple passes have gone into `drawHemGlyph()` (now `lib/flashdraft/hem-glyph.ts`,
called from both the live canvas and the popup selector icons in
`app/studio/draft/page.tsx`):

- `912f0b9` (2026-08-06) — rewrote Open/Smashed/Teardrop using literal
  coordinates traced from a real PathfinderEdge reference screenshot and
  hand-drawn sketches, replacing an earlier descriptive-shape version.
  Normalized the local coordinate convention so the two call-site mechanisms
  (endpoint hems vs. leg-mid hems) can no longer produce mirrored glyphs.
- `0a117eb` (2026-08-06) — extracted `drawHemGlyph` into a standalone debug
  view at `/studio/hem-debug` (all three shapes at 15x scale) and fixed the
  popup icons being illegibly small.
- `3786ff0` (2026-08-06) — added audit evidence screenshots (`hem-audit-*.png`,
  repo root) from a no-code-change diagnostic pass.
- `abb5da8` (2026-08-07) — three targeted fixes from that audit: (1) the main
  production canvas gained DPR-awareness (`devicePixelRatio` backing store +
  `ctx.setTransform`), which it previously lacked entirely, requiring every
  coordinate-math site (`worldToScreen`, `screenToWorld`, grid bounds, two
  `computeFitView` call sites — 18 places) to switch from reading
  `canvas.width`/`height` to `getBoundingClientRect()`; (2) unified the three
  previously-disconnected glyph-scale constants (`HEM_GLYPH_R`,
  `HEM_ICON_GLYPH_R`, the debug view's `DEBUG_R`) so they derive from one
  base constant; (3) made Open and Smashed visually distinguishable at popup
  button scale (shorter + thinner stroke for Smashed) since their real
  differentiator — offset from the leg centerline — isn't visible without a
  reference leg line next to an isolated icon.

- `7de79db` (2026-08-13) — replaced the shape logic in
  `lib/flashdraft/hem-glyph.ts` entirely. Prior passes built every shape
  backward over the leg's own material (-x territory), which is why Open
  rendered as a short stub and Teardrop as two disconnected primitives
  (a curved tail + a separate near-circle). Rebuilt from SMACNA/press-brake
  hem definitions, spanning outward from the tip into the hem's own fold
  material (+x territory) instead: Open and Smashed now share one
  `drawHookGlyph()` hairpin construction (180-degree bend, U cross-section)
  differing only by gap fraction (0.7 vs. 0.12), and Teardrop is an exact
  tangent-line-to-circle construction (apex at the tip, `d = R*1.2 > r =
  R*0.5` algebraically guarantees the two tangent lines and connecting arc
  cannot self-intersect) forming one closed loop instead of two
  primitives. Also fixed `app/studio/hem-debug/page.tsx`'s `ANCHOR`
  constant, which was calibrated for the old leftward/downward-extending
  shapes and clipped the new rightward-extending ones off the 280x180
  debug canvas — caught by screenshotting the debug view before fixing
  `ANCHOR` (Open showed as two disconnected clipped bars, Teardrop as an
  open "&lt;" with no closed loop) and again after (both fully rendered).
  The post-fix screenshots are checked in at
  `hem-audit-2026-08-13-open.png`, `-smashed.png`, `-teardrop.png`, and
  `-full-page.png` — all three shapes render complete and unclipped.
  `pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
  passed, and the commit is pushed to `origin/main`.

- `440d047` (2026-08-13) — deleted a SECOND, older hem-rendering system that
  the `7de79db` pass above never touched. `renderHemAt` and `renderLegHemAt`
  (`app/studio/draft/page.tsx`) each hand-built an approximate hem shape
  with raw `ctx.moveTo`/`lineTo`/`arc`/`fill` calls (an offset-line cap for
  open, a filled semicircle for teardrop, two parallel lines for smashed),
  then drew the correct `drawHemGlyph` shape ON TOP of it as a small
  fixed-size icon — this is why the live canvas still looked wrong after
  `7de79db` even though that pass's `hem-glyph.ts` rewrite was itself
  correct; `/studio/hem-debug` calls `drawHemGlyph` directly and so never
  exercised the buggy manual construction. Deleted the manual construction
  entirely, for all three hem types, in both functions — `drawHemGlyph` is
  now the only hem renderer on the canvas. Added a real-scale radius
  argument (`R`, derived from `gapIn` or effective material thickness ×
  `PIXELS_PER_INCH * zoom`, floored at `MIN_HEM_GLYPH_R = HEM_GLYPH_R`) so
  the glyph reflects the hem's actual dimensions instead of always
  rendering at popup-icon size. `lib/flashdraft/hem-glyph.ts` itself was
  not touched. `pnpm tsc --noEmit` (0 errors) and `pnpm run build`
  (succeeded) both passed, and the commit is pushed to `origin/main`.
  Verified on the live `/studio/draft` canvas (not the debug page) with a
  real "Coping Cap" template profile carrying all three hem types — Open
  and Teardrop render as a single clean glyph with no second shape
  underneath; Smashed is correctly small (its `gapIn` is architecturally
  always `0`, so `R` floors to the same size as the popup icon — expected,
  not a bug). Screenshots saved to the local scratchpad, not checked into
  the repo.

- `171f88c` (2026-08-13) — `440d047` above over-deleted: cleaning out the
  duplicate hand-coded geometry also removed the stroke connecting each
  leg's true vertex to its fold tip (real material, independent of hem
  type), and left every `R` computation scaling with the hem's real
  `gapIn`/thickness × `PIXELS_PER_INCH * zoom` — directly contradicting
  `hem-glyph.ts`'s own header comment that the glyph radius is meant to be
  a fixed screen-pixel size, unscaled by zoom or real-world fold depth.
  Scope: `renderHemAt`/`renderLegHemAt` in `app/studio/draft/page.tsx`
  only. Restored the connecting line (`sP` to `sFoldTip`) once per branch,
  all three hem types, both functions — some `open` branches were also
  missing `sFoldTip` itself, only ever having computed the offset tip.
  Replaced every `R` computation with one fixed constant,
  `HEM_GLYPH_DISPLAY_R = 22`, used directly with no scaling; removed the
  now-fully-unused `MIN_HEM_GLYPH_R` it replaced. `pnpm tsc --noEmit`
  (0 errors) and `pnpm run build` (succeeded) both passed, and the commit
  is pushed to `origin/main`. Verified on the live `/studio/draft` canvas
  (not the debug page) with a manually-drawn profile carrying all three
  hem types — connecting lines visible and glyph size now constant
  regardless of each leg's real gap/thickness. Screenshot checked in at
  repo root: `hem-audit-2026-08-13-live-canvas-connecting-lines.jpg`. Per
  this prompt's own instruction, `HEM_GLYPH_DISPLAY_R = 22` was used as
  specified rather than second-guessed — needs Reid's confirmation on
  whether 22px is the right size from the screenshot.

- `e9b5060` (2026-08-13) — matched the hem glyph's line weight to the leg's
  own stroke, and tightened the teardrop loop. Scope:
  `lib/flashdraft/hem-glyph.ts` only, `page.tsx` untouched. Every
  `ctx.lineWidth` in `drawHemGlyph`/`drawHookGlyph` was `R * 0.22`, scaling
  the hem stroke with glyph size instead of matching the leg's fixed 2px
  stroke — replaced all of them with one new `HEM_LINE_WIDTH = 2` constant.
  Also tightened the teardrop's tangent-circle construction from
  `d = R * 1.2, r = R * 0.5` (a wide, open-looking loop) to
  `d = R * 0.42, r = R * 0.36` — `d` stays strictly greater than `r`, so the
  construction is still guaranteed non-self-intersecting; `angleC`, the
  tangent-point math, and arc sweep direction were left untouched, only the
  two input values changed. The open/smashed hook construction
  (`drawHookGlyph`) itself was not touched — already confirmed correct in
  shape, only its line weight needed fixing. `pnpm tsc --noEmit`
  (0 errors) and `pnpm run build` (succeeded) both passed, and the commit
  is pushed to `origin/main`. Verified on the live `/studio/draft` canvas
  (not the debug page) with a manually-drawn profile carrying all three
  hem types, zoomed to compare leg and hem line weights directly.
  Screenshots checked in at repo root:
  `hem-audit-2026-08-13-line-weight-full.jpg` and
  `hem-audit-2026-08-13-line-weight-closeup.png`. The teardrop tightness
  (`d = 0.42R`, `r = 0.36R`) is a first pass at the proportion Reid
  described, not yet confirmed against what he had in mind — flag it as
  likely needing one more adjustment once seen live, not as final.

The teardrop tightness (`d = 0.42R`, `r = 0.36R`) noted above was itself
superseded by the 2026-08-14 pass at the top of this section
(`d = 0.3R`, `r = 0.22R`), and mid-leg hems (referenced throughout this
history as "leg-mid hems") were deleted entirely by that same pass — see
above, not "not started."

</details>

---

## FLASHDRAFT TEMPLATE REBUILD (Pass 1–4): NOT STARTED

**Status: NOT STARTED. Zero implementation work has begun.**

The full 20-item template list — Z Closure, Sill, J-Channel, Z-Spacer Trim,
Outside Corner, Inside Corner, Window Drip, Siding Starter, Stucco
Perimeter, Pitch Change, Drip Edge, Drip Edge with Kick, Hook Drip Edge,
Sidewall, Head Wall, Ridge Cap Vented, Counter, Peak Wall, Gutter, Valley —
plus Coping Cap and Valley as variant-picker categories, was locked with the
user but no code exists for it. Confirmed via directory search: no
`app/studio/**` path contains any `template` file or route beyond what
already existed before this list was locked.

The PAC-CLAD "Painted Color" picker (Pass 4) is also entirely unbuilt — a
repo-wide search for "PAC-CLAD" and "Painted Color" found no matches inside
`app/studio/**` or any FlashDraft-related component. Zero hours have been
spent on it despite being requested.

---

## FLASHDRAFT — CANVAS/SIDEBAR UI CHANGES: NOT STARTED

**Status: NOT STARTED.**

The lighter-gray canvas background and compact sidebar redesign requested
by the user have not been implemented. `CANVAS_COLORS.background` in
`app/studio/draft/page.tsx` has not changed as part of this request, and no
sidebar-layout commit exists for it.

---

## PATHFINDEREDGE MACHINE INTEGRATION: BLOCKED (external dependency)

**Status: BLOCKED. This is a genuine production-blocking issue for the
physical shop, separate from the software platform.**

- Catalog `20115` (`afs`, lowercase) is confirmed as the correct sync
  target.
- Confirmed via AMS Controls (Seth Oliver) that a profile (`32890799`) was
  successfully created via `POST /api/v1/profiles` at some point in the
  past — but **not** from this application's own code.
  `lib/integrations/pathfinder-edge.ts` remains a complete stub: verified
  directly this pass — 100 lines, every exported function
  (`discoverApiEndpoints`, `getPathfinderCatalogs`, `pushProfileToPathfinder`,
  `submitJobToMachine`, `getJobStatus`) returns a hardcoded
  `{ status: 'not_configured' }` result and contains zero `fetch()` calls
  or any other network I/O. The successful profile creation AMS Controls
  observed happened through some other path, not this codebase.
- Root cause of current 401 errors on a freshly rotated API key is
  unresolved — waiting on AMS Controls server-side logs.
- On 2026-08-11, the user attempted to send a real job from PathfinderEdge
  to the Thalmann machine directly (not via this application) and it failed
  to reach the machine. Cause unknown, pending AMS Controls log review.
- Env vars `PATHFINDER_EDGE_API_KEY`, `PATHFINDER_EDGE_BASE_URL`,
  `PATHFINDER_EDGE_MACHINE_SERIAL` are wired but unused, per CLAUDE.md.

No code changes should be attempted here until AMS Controls confirms a real,
documented REST surface — see the stub's own header comment for why
guessing at request/response shapes against a machine that physically bends
metal is not acceptable.

---

## SECURITY — CREDENTIAL ROTATION: DEFERRED BY DESIGN, NOT AN OPEN ISSUE

Per explicit, repeated user instruction, credential rotation (Stripe,
Supabase, Anthropic, PathfinderEdge, Google Maps, the machine-bridge shared
secret) is deferred to a single pass immediately before DNS cutover/go-live,
not done incrementally now. **Do not flag this as an open action item
needing attention in the current build phase** — it is a deliberate,
standing decision, not an oversight.

---

## MIGRATION 013 (bid_documents) — CONFIRMED APPLIED LIVE, 2026-08-20

`013_bid_documents.sql` (four tables: `bid_documents`,
`bid_document_sections`, `bid_document_line_items`,
`bid_document_viewers` — see `BID_DOCUMENT_SCOPE.md` for the feature
design) is **confirmed applied to the live Supabase project**, verified
by Reid directly via `information_schema` in the Dashboard SQL Editor
(the check was deliberately not attempted through this session's own
PostgREST access — see migration 015's earlier stale-cache false-positive
in `MIGRATIONS_STATUS.md` for why PostgREST-based checks on this project
are not trusted for this purpose).

This confirms only that the migration's schema objects exist live. No
Bid Documents application code (bid-doc-002/003 — claim-lock UI, pricing
entry, PDF generation, Resend send) has a status entry in this document
yet; that is a separate, not-yet-addressed build phase, not implied by
this migration's live status.

---

## GOVERNANCE STACK

| Document | Status |
|---|---|
| CLAUDE.md | Current — master index |
| BLUEPRINT.md | Current — FORGE operational rules |
| ARCHITECTURE.md | Current — system architecture |
| SCHEMA.md | Current — database tables + RLS |
| DESIGN_TOKENS.md | Current — Gunmetal theme, afs-* tokens |
| SITEMAP.md | Current — route map |
| COMPONENT_MAP.md | Current — component index |
| PRICING_ENGINE.md | Current — internal commodity pricing system |
| PRD.md | Current — platform requirements |
| STATE_OF_THE_BUILD.md | This file — rewritten 2026-08-11 |
| SESSION_STATE.md | Rewritten 2026-08-11 — session handoff log |
| MASTER_DOCUMENT_REGISTRY.md | FORGE project-folder document index |

---

## DATA BLOCKERS — UNRESOLVED

These items block specific features but do not block the build. Code is
built now; data populates the existing structure when received.

| Item | Checklist # | Blocks |
|---|---|---|
| Product catalog — SKUs, finishes | #12–21 | Catalog content beyond profile/material/gauge dropdowns (seeded) |
| Pricing cost basis and margin rules | #22–23, #26 | Pricing engine activation |
| Supplier price history | Internal records | Trend projection accuracy |
| Production stage names (shop language) | #39 | Timeline labels, notification triggers |
| AFS address, phone, hours | #5, #6 | Contact page, freight origin, email footer |
| Tax nexus states | #31 | TaxJar configuration |
| Carrier / freight method | #27–28, #80 | Freight calculation |
| Industry certifications | #8 | Trust badges, spec language |
| Logo vector file (SVG) | #1 | Asset quality — PNG in use as fallback |
| Photography | #9 | Product and gallery images |
| CAD/BIM library files (DWG/DXF/Revit) | SPEC_CAD_BIM_LIBRARY.md | `/architects/cad-library` content — code path is complete, zero rows exist because zero files have been received |
| Privacy Policy | #65 | Legal — launch blocker |

*Not independently re-verified in this pass; carried forward from the last
codebase audit that specifically checked each row. If a client deliverable
listed here has since arrived, confirm against the code before trusting
this table.*

---

## BUILD PHASE STATUS

*Carried forward from the last full-codebase audit (not re-verified route
by route in this documentation pass). Believed accurate as of the commits
in RECENT COMMITS below; if in doubt, verify a specific route or feature
directly rather than trusting this table blind — that is exactly the
failure mode this rewrite exists to correct.*

```
Phase 0 — Scaffold + Design System:    BUILT
Phase 1 — Drawing Tool + Upload:       BUILT (app/upload, app/api/upload, app/api/takeoff)
Phase 2 — Quote Request System:        BUILT (app/quote, app/configure, app/api/quote-requests)
Phase 3 — Product Catalog + Auth:      BUILT (app/(public)/products, app/(auth)/**, app/checkout)
Phase 4 — Customer Portal:             BUILT (app/account/**)
Phase 5 — Architect Portal:            BUILT (app/(public)/architects/**)
Phase 6 — Admin + Operations:          BUILT (app/admin/**)
Phase 7 — AI Layer:                    BUILT — chatbot, product finder/cross-sell/
                                        material recs, installation advisor
Phase 8 — Integrations + Deploy:       BUILT. QuickBooks is a CONDITIONAL,
                                        stubbed build (blocked on client
                                        confirmation, zero real QBO API calls).
                                        Supabase integration functional.
                                        Vercel deploy prep done (vercel.json,
                                        .env.example).

Design Studio (beyond the original 9-phase queue):
  Thalmann machine profile import:     Migration + import script built;
                                        migration NOT yet applied to the
                                        live Supabase project (confirm
                                        before assuming machine_profiles
                                        rows exist in production).
  PathfinderEdge integration:          BLOCKED — see PATHFINDEREDGE
                                        MACHINE INTEGRATION above.
  FlashDraft + Design Studio UI:       Core two-panel canvas tool BUILT.
                                        Hem geometry UNRESOLVED (2D canvas
                                        implemented, UNCONFIRMED by Reid;
                                        3D view renders no hems at all —
                                        NOT STARTED), mid-leg hems DELETED,
                                        template rebuild NOT STARTED,
                                        canvas/sidebar UI changes NOT
                                        STARTED — see the dedicated
                                        FlashDraft sections above.

Machine Bridge + Command Center:       afs-machine-bridge (separate repo)
                                        last audited 2026-07-13: running on
                                        the dev machine only, not the
                                        shop-floor computer; polling the
                                        deployed app but failing auth (401,
                                        likely AFS_BRIDGE_SECRET mismatch);
                                        zero .ds1 files ever generated as a
                                        result. Not re-verified in this
                                        documentation pass — if this is
                                        being relied on, re-check
                                        afs-machine-bridge's own logs
                                        directly rather than trusting this
                                        line.

3D Profile Configurator:               BUILT — Three.js viewer integrated
                                        into FlashDraft, upload results, and
                                        a standalone shareable route.
```

---

## RECENT COMMITS (verified via `git log --oneline -15`, most recent first)

```
3fa8c70  fix: correct Open hem fold direction, rebuild kick as a true mirror, wire real gap through to the glyph
2471830  fix: hem length now scales the glyph itself, Gap returns as editable, add inward/outward kick
2a47bdd  fix: FlashDraft hem system overhaul — Gap replaced by Hem Length, mid-leg hems deleted, teardrop retightened, leg-shrink bug resolved
a9d729b  docs: record hem line-weight/teardrop tightening fix in governance docs, mark UNCONFIRMED
e9b5060  fix: match hem glyph line weight to leg stroke, tighten teardrop loop proportions
27e3cbd  docs: record connecting-line/glyph-size hem fix in governance docs, mark UNCONFIRMED
171f88c  fix: restore leg-to-fold hem connecting line, fix glyph size to fixed on-screen radius
f6f5889  docs: record duplicate hem geometry deletion in governance docs, mark UNCONFIRMED
440d047  fix: delete duplicate hand-coded hem geometry, canvas now draws only the validated glyph
a9c299d  docs: record hem glyph geometry rebuild in governance docs, mark UNCONFIRMED
7de79db  fix: replace hem glyph geometry with validated SMACNA hem construction
7bc1841  docs: record hem-menu trigger offset fix in governance docs
e5eb3a7  fix: offset hem-menu double-click hit-test past true leg endpoint
18cc3d9  docs: record auto-fit-view-after-length-entry fix in governance docs
b9a8d54  fix: auto-fit view after manual segment length entry
11c20ea  docs: record leg-body grab cursor fix in governance docs
a551366  fix: leg-body hover shows grab cursor immediately, not just on drag
```

Local `main` is in sync with `origin/main` (0 ahead / 0 behind) as of this
pass.

---

## DNS MIGRATION CHECKLIST

When migrating DNS to the live domain, these must be updated BEFORE go-live:

1. Vercel Environment Variables — update `NEXT_PUBLIC_APP_URL` from
   `https://afs-website-alpha.vercel.app` to the live domain
2. Supabase Auth — update Site URL in Authentication settings to the live
   domain
3. Stripe webhook endpoint URL — update in Stripe dashboard to the live
   domain
4. Redeploy on Vercel after env var change
5. Credential rotation pass (Stripe, Supabase, Anthropic, PathfinderEdge,
   Google Maps, machine-bridge shared secret) — deliberately deferred to
   this step, see SECURITY above

---

## NEXT ACTION

1. Get the user's own confirmation on the FlashDraft hem system (geometry,
   Hem Length glyph scaling, Gap re-added and now actually wired to the
   glyph, Outside/Inside Kick rebuilt as a true mirror, mid-leg removal,
   leg-shrink fix, Teardrop now sized from material thickness) against his
   reference sketch/photos — do not mark it complete until that happens,
   regardless of how many rendering passes have been made. Specific items
   still needing his judgment: whether `hem.kick === 'inside'` is the
   correct condition for `mirror: true` (one line to flip if backwards —
   see the "OPEN FOLD-DIRECTION BUG FIXED..." entry above — this session
   re-confirmed the mirror itself renders correctly either way, just not
   which label is physically correct), `HEM_GLYPH_LENGTH_SCALE`'s default
   of `1.0`, and whether Teardrop's new `TEARDROP_THICKNESS_TO_R` proportion
   (see the newest FlashDraft entry above) actually matches his reference
   photos' tightness once seen live.
2. ~~Mid-leg hem removal~~ — done 2026-08-14, see the consolidated
   FlashDraft hem-system entry above.
3. FlashDraft 3D view does not render hems — newly identified this
   session, needs real scoping (not a quick prop pass-through), see the
   dedicated NOT STARTED entry above.
4. FlashDraft template rebuild (Pass 1–4) — not started, needs scoping into
   actual FORGE prompts against the locked 20-item list + PAC-CLAD picker.
5. Canvas/sidebar UI changes — not started.
6. PathfinderEdge — blocked on AMS Controls (Seth Oliver) providing
   server-side logs for the 401 root cause; no code work possible until a
   real, documented API surface is confirmed.

---

*STATE_OF_THE_BUILD.md | AFS — Architectural Flashing Supply | Reid Whitesides | Rewritten 2026-08-11 from direct verification (git log, tsc, git status) |*
