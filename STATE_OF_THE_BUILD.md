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
                                        Hem geometry UNRESOLVED, mid-leg
                                        removal NOT STARTED, template
                                        rebuild NOT STARTED, canvas/sidebar
                                        UI changes NOT STARTED — see the
                                        dedicated FlashDraft sections above.

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

## RECENT COMMITS (verified via `git log`, most recent first)

```
a551366  fix: leg-body hover shows grab cursor immediately, not just on drag
75aa55f  docs: rewrite governance docs to reflect verified current state
abb5da8  fix: DPR-aware live canvas, unified glyph scale constants, Open/Smashed differentiation
3786ff0  audit: add hem glyph rendering audit evidence images
0a117eb  feat: add hem glyph debug view, fix illegible popup icon size
4866dea  fix: stray drag state on mere cursor movement, undo/redo history gaps
912f0b9  fix: rewrite drawHemGlyph with literal capsule/loop coords, unify popup icons, fix drag-artifact bug
875c51e  fix: clamp bend angle to prevent reflex/collinear states, redesign hem glyphs, fix reshape UX conflict with length input
1292e0f  feat: leg-body reshape gesture via direction-based disambiguation, extending the hem-drag pattern
36579a0  fix: direction-based disambiguation lets leg-hem-drag arm correctly from interior vertices and the last point
4cec386  fix: resolve informal profile labels to canonical geometry, infer topology from extracted dimension shape for unmapped types
88c98a5  fix: replace fabricated 16in roof panel default with drawing-first extraction + user width selection; fix catalog copy and profile-type dropdown gap
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
   Gap→Hem Length, mid-leg removal, leg-shrink fix) against real
   PathfinderEdge reference evidence — do not mark it complete until that
   happens, regardless of how many rendering passes have been made.
2. ~~Mid-leg hem removal~~ — done 2026-08-14, see the consolidated
   FlashDraft hem-system entry above.
3. FlashDraft template rebuild (Pass 1–4) — not started, needs scoping into
   actual FORGE prompts against the locked 20-item list + PAC-CLAD picker.
4. Canvas/sidebar UI changes — not started.
5. PathfinderEdge — blocked on AMS Controls (Seth Oliver) providing
   server-side logs for the 401 root cause; no code work possible until a
   real, documented API surface is confirmed.

---

*STATE_OF_THE_BUILD.md | AFS — Architectural Flashing Supply | Reid Whitesides | Rewritten 2026-08-11 from direct verification (git log, tsc, git status) |*
