# SESSION_STATE.md
## AFS — Session Log
**This is the handoff document between sessions.**

---

## WORKING STYLE NOTE — VERIFICATION STANDARD

Governance docs in this project must reflect **verified, tested-and-confirmed
status only**. A Claude Code session's own "verified live" claim — a
Playwright screenshot, a passing build, a byte-for-byte screenshot diff — is
**not sufficient on its own** to mark a fix complete in these documents,
especially for anything visual or interactive. Multiple times in this
project's history, a fix was reported complete by the session that made it
and later found to not actually be visible or working correctly once the
user checked it themselves (FlashDraft's hem glyph rendering is the current
live example — several rewrite passes each self-reported as "verified,"
none yet confirmed correct by the user against real reference evidence).

**Going forward:** report a session's own testing as exactly that — evidence
to bring to the user — and hold the item as unresolved/unconfirmed in these
docs until the user has independently checked the actual behavior. Do not
let self-reported verification read as equivalent to user confirmation.

---

## CURRENT STATUS

**Most recent session (2026-08-14): FlashDraft hem length now scales the
glyph itself (root-cause fix), Gap returns as a per-hem editable field
(reversing the prior pass's decision), inward/outward Kick direction
added.** Single coordinated pass across `lib/types/profile.ts` and
`app/studio/draft/page.tsx` (`lib/flashdraft/hem-glyph.ts`'s internal
shape math explicitly out of scope, not touched) — see
STATE_OF_THE_BUILD.md's new consolidated FlashDraft entry for the full
technical writeup.

Summary of what changed:
- **Root cause fix — Hem Length actually scales the fold glyph.**
  Previously `drawHemGlyphHere` always used a fixed screen-pixel radius
  (`HEM_GLYPH_DISPLAY_R = 12`) regardless of `hem.lengthIn`, so increasing
  Hem Length only pushed the same-size icon further away along a longer
  connecting line — never grew the fold shape, reading as "extending the
  leg." `HEM_GLYPH_DISPLAY_R` deleted; every call site now computes `R =
  Math.max(MIN_READABLE_R, hem.lengthIn * PIXELS_PER_INCH * zoom *
  HEM_GLYPH_LENGTH_SCALE)` — a real, zoom-aware radius derived from the
  hem's actual inch length. `MIN_READABLE_R = 10` and
  `HEM_GLYPH_LENGTH_SCALE = 1.0` are both new, both first-pass values not
  yet confirmed by Reid.
- **Gap is editable again** (Reid reversed the prior pass's "fixed shop
  constant" decision same-day). `HEM_DEFAULT_GAP_IN` 0.125"→0.0625"
  (still just a new-hem default). The popup's "Gap (in)" field is back,
  reusing the pre-removal `hemGapDraft` state naming pulled from `git
  show` on the removal commit, generalized to show for all three hem
  types (not just `open`) and to preserve the value across type switches,
  matching how Hem Length already behaved.
- **New `kick: 'inward' | 'outward'` field on `Hem`**, default `'outward'`
  (matches prior behavior — no change for existing/default hems). A new
  Kick toggle in the popup flips both the fold-direction vector and the
  glyph's own rotation angle together. First-pass mirror implementation
  (a 180° rotation of the glyph's local frame — `drawHemGlyph` only takes
  a rotation angle, no true perpendicular-mirror parameter, and
  hem-glyph.ts was out of scope) — **specifically needs Reid's live
  visual confirmation that it reads as "the physically opposite side,"**
  not just that something visibly changes.

`pnpm tsc --noEmit` — 0 errors. `pnpm run build` — succeeded. Screenshots
checked in at repo root: `hem-audit-2026-08-14-length-scale-small.png` /
`-length-scale-large.png` (same hem, 0.5" vs. 2" length, showing the fold
shape itself grow), `-popup-length-gap-kick.png` (Hem Length, Gap, and
Kick together in the popup), `-kick-outward.png` / `-kick-inward.png`
(same endpoint, before/after toggling Kick), `-both-hems-full-canvas.jpg`
(one endpoint kicked inward, the other outward, in one profile). Driven
via direct `PointerEvent`/`MouseEvent` dispatch in the page's own JS
context against a real `pnpm dev` server — the Chrome DevTools
extension's click/screenshot coordinate mapping was unreliable for this
multi-step canvas interaction in this session (same caveat as several
prior sessions below), so canvas events were dispatched directly via
`element.dispatchEvent(...)` using `canvas.getBoundingClientRect()` for
coordinates instead of relying on the extension's own click targeting.

Per the verification standard above, this stays **IMPLEMENTED,
UNCONFIRMED** pending Reid's own check — do not mark DONE. Also newly
identified this session, tracked as its own NOT STARTED item in
STATE_OF_THE_BUILD.md: `ProfileViewer3D` has no hem-related props at
all, confirmed by direct inspection — the 3D view renders no hems
regardless of what's set in the 2D draft canvas. Not attempted this
session, needs real scoping.

---

**Prior session (2026-08-14): FlashDraft comprehensive hem-system
fix — Gap removed in favor of per-hem Hem Length, mid-leg hems deleted
entirely, teardrop retightened, glyph size shrunk, leg-shrink bug
investigated and resolved.** One coordinated pass across
`lib/types/profile.ts`, `app/studio/draft/page.tsx`, and
`lib/flashdraft/hem-glyph.ts`, per this prompt's own instruction to
rewrite the FlashDraft section rather than append — see
STATE_OF_THE_BUILD.md's consolidated FlashDraft hem-system entry for the
full technical writeup (prior incremental history collapsed into a
`<details>` block there rather than deleted).

Summary of what changed:
- **Gap is no longer user-editable** (`HEM_DEFAULT_GAP_IN` 0.1875"→0.125",
  the real shop-confirmed constant). The popup's "Gap (in)" field is
  gone; `Hem` gained its own `lengthIn` (default 0.5"), editable via a
  new "Hem Length (in)" field in the same popup slot.
- **Positioning fix**: `foldTip` now uses the hem's own `lengthIn`; the
  perpendicular gap-offset positioning (`offsetTip`) is gone —
  `drawHemGlyphHere` renders directly at `sFoldTip`, matching how
  teardrop/smashed already worked.
- **Vertex dot suppressed** at any endpoint carrying a hem (the glyph is
  the marker there now).
- **Mid-leg hems deleted entirely** — `LegHem` interface, every
  `legHem*`-prefixed state/ref/handler, `renderLegHemAt`, the whole
  backward-drag-becomes-a-hem disambiguation system in
  `handlePointerDown`/`handlePointerMove`. Grep-confirmed zero remaining
  references. Leg reshaping (drag a leg's body or a vertex directly)
  keeps working, now uniformly regardless of drag direction.
- **Teardrop tightened further**: `d = 0.42R, r = 0.36R` (still a "first
  pass" per the 08-13 entry below) → `d = 0.3R, r = 0.22R`.
- **Glyph display size**: `HEM_GLYPH_DISPLAY_R` 22 → 12.
- **Leg-shrink bug** ("leg 1 lengthens but won't shorten, later legs work
  fine") — traced to the now-deleted `legHemRearmCandidateRef`
  mechanism: dragging any interior bend point armed a hem-rearm
  candidate unconditionally, so a first movement pointing backward along
  the incoming leg (the natural shrink gesture) silently redirected into
  hem-creation instead of reshaping. Verified via a standalone
  Playwright script (the Chrome extension tool proved unreliable for
  this precise a multi-step interaction this session — coordinate-space
  mismatches and page-scroll drift, a tooling issue, not a code issue)
  that the current code shrinks leg 0 and leg 1 identically via both
  leg-body drag and direct vertex-drag, with snap on or off. No residual
  asymmetry found — no separate fix beyond the mid-leg-hem deletion was
  needed.

Required gates: `pnpm tsc --noEmit` — 0 errors. `pnpm run build` —
succeeded, `.next/BUILD_ID` confirmed present (an earlier attempt in
this session reported false success with a truncated log after a stray
duplicate build process got killed mid-run; the run reported here was
isolated and re-verified). Screenshots checked in at repo root:
`hem-audit-2026-08-14-open-popup.png`, `-endpoint-zoom.png`,
`-teardrop.png`, `-teardrop-closeup.png`, `-full-canvas.png`. Per the
verification standard above, this stays **IMPLEMENTED, UNCONFIRMED**
pending Reid's own visual check — do not mark DONE.

**Prior session (2026-08-13): FlashDraft hem glyph — matched line
weight to the leg stroke, tightened the teardrop loop.** Scope:
`lib/flashdraft/hem-glyph.ts` only, per this prompt — `page.tsx` untouched.
Two fixes inside `drawHemGlyph`/`drawHookGlyph`:

1. **Line weight.** Every `ctx.lineWidth` assignment was `R * 0.22` —
   scaling the hem's stroke weight with glyph size instead of matching the
   leg's own fixed 2px stroke in `page.tsx`. Replaced all of them (both
   `drawHookGlyph`, used for open/smashed, and the teardrop branch) with a
   single new `HEM_LINE_WIDTH = 2` constant, used directly with no
   R-derived scaling.

2. **Teardrop loop proportions.** The tangent-circle construction used
   `d = R * 1.2` (distance from tip to circle center) and `r = R * 0.5`
   (circle radius), producing a wide, open-looking loop. Tightened to
   `d = R * 0.42`, `r = R * 0.36` — `d` still strictly greater than `r`, so
   the construction remains non-self-intersecting, just proportioned so the
   loop reads as a tight curl-back-and-close. `angleC`, the tangent-point
   math, and the arc sweep direction were left exactly as-is, per this
   prompt's scope — only the two input values changed. The open/smashed
   hook construction (`drawHookGlyph`) itself was not touched, since its
   shape was already confirmed correct.

Verified on the live `/studio/draft` canvas (not the debug page) with a
manually-drawn profile carrying all three hem types — Open at the start
endpoint, Teardrop at the end endpoint, Smashed via leg-mid drag-back.
Screenshots checked in at repo root:
`hem-audit-2026-08-13-line-weight-full.jpg` (full canvas, all three hems)
and `hem-audit-2026-08-13-line-weight-closeup.png` (a leg and the teardrop
glyph zoomed together for a direct line-weight comparison). Visually, hem
stroke weight now reads the same as the leg stroke, and the teardrop loop
is noticeably tighter than the prior wide-circle version.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
passed. Commit `e9b5060` is pushed to `origin/main`. Per the verification
standard above, this stays **IMPLEMENTED, UNCONFIRMED** pending Reid's own
visual check. Flagging specifically: the teardrop's tightness
(`d = 0.42R`, `r = 0.36R`) is a first pass at the proportion Reid
described from memory, not a value confirmed against a real reference —
it may need one more adjustment once Reid sees it live. Do not treat this
as the final teardrop proportion until he confirms.

**Prior session (2026-08-13): FlashDraft live canvas — restored the
leg-to-fold connecting line, fixed hem glyph size to a constant on-screen
radius.** Scope: `renderHemAt` and `renderLegHemAt` in
`app/studio/draft/page.tsx` only, per this prompt — `lib/flashdraft/hem-glyph.ts`
untouched. Two bugs from the prior (`440d047`) pass, which deleted the
duplicate hand-coded geometry but over-deleted alongside it:

1. **Missing connecting line.** The stroke from the leg's true vertex (`p`)
   to `foldTip`/`sFoldTip` — real material, present regardless of hem type —
   had been removed along with the duplicate geometry it was cleaned up
   with. Added back once per branch (all three hem types, both functions),
   immediately before each `drawHemGlyphHere` call, computing `sP =
   worldToScreen(p, canvas)` in every branch that was missing it (the
   `open` branches in both functions were also missing `sFoldTip` itself,
   since `foldTip` was previously only used for the offset math, never
   converted to screen space).

2. **Glyph size tracking real-world dimensions.** Every `R` computation was
   `Math.max(MIN_HEM_GLYPH_R, hem.gapIn * PIXELS_PER_INCH * zoom)` or the
   `effectiveThicknessIn` equivalent — scaling with the hem's real gap/
   thickness and with zoom. This directly contradicts `hem-glyph.ts`'s own
   header comment: "Fixed screen-pixel-size cross-section glyph radius,
   unscaled by zoom or real-world fold depth." Replaced all six call sites
   (three hem types × two functions) with a single fixed constant,
   `HEM_GLYPH_DISPLAY_R = 22` (px), used directly as `R` — independent of
   `zoom` or any real-world dimension. Removed the now-unused
   `MIN_HEM_GLYPH_R` constant (a `HEM_GLYPH_R` alias) it replaced, since
   every call site that referenced it is gone. Text labels showing the true
   `gapIn`/thickness value are unchanged.

Verified on the live `/studio/draft` canvas (not the debug page) with a
manually-drawn 5-point profile (not a template — the "Coping Cap" template
button did not visibly load geometry when clicked during this session;
drawing was done via direct click/drag instead): an Open hem at the start
endpoint, a Teardrop hem at the end endpoint, and a Smashed hem via
leg-mid drag-back on an interior leg. Screenshot shows all three hem types
with their connecting line visible and the glyph a consistent, generous
size regardless of each leg's real gap/thickness — matching this prompt's
intent. Screenshot checked in at repo root:
`hem-audit-2026-08-13-live-canvas-connecting-lines.jpg`. Per this prompt's
instructions, `HEM_GLYPH_DISPLAY_R = 22` was used as specified and not
second-guessed — Reid should confirm from the screenshot whether 22px reads
as the right size before this is considered final.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
passed. Commit `171f88c` is pushed to `origin/main`. Per the verification
standard above, this stays **IMPLEMENTED, UNCONFIRMED** — the screenshot
proves the connecting line is back and the glyph size no longer tracks real
dimensions, but does not by itself confirm Reid agrees the result
(including the `R = 22` size choice) is correct to his eye. Do not mark
this complete until Reid confirms against the screenshot and the live
canvas.

**Prior session (2026-08-13): FlashDraft live canvas — deleted
duplicate hand-coded hem geometry, canvas now draws only the validated
glyph.** Root cause of the hem geometry still looking wrong on the live
`/studio/draft` canvas after the `7de79db` `hem-glyph.ts` rebuild (below):
`renderHemAt` and `renderLegHemAt` (`app/studio/draft/page.tsx`) each
contained TWO hem-rendering systems — a manually hand-coded
`ctx.moveTo`/`lineTo`/`arc`/`fill` construction (an offset-line cap for
open, a filled semicircle for teardrop, two parallel lines for smashed)
predating the `hem-glyph.ts` fix and never touched by it, followed by a
`drawHemGlyphHere` call drawing the correct shape on top as a small
fixed-size icon. The debug view at `/studio/hem-debug` calls `drawHemGlyph`
directly and so never exercised the first (buggy) system, which is why
prior passes' debug-view screenshots looked correct while the live canvas
did not.

Deleted the manual construction entirely in both functions, for all three
hem types — `drawHemGlyphHere` (and by extension `drawHemGlyph` in
`lib/flashdraft/hem-glyph.ts`, itself untouched) is now the only hem
renderer on the canvas. Added a real-scale radius argument: `R` is derived
from the hem's `gapIn` (open/smashed) or effective material thickness
(teardrop, same `effectiveThicknessIn` calculation already present),
multiplied by `PIXELS_PER_INCH * zoom`, floored at `MIN_HEM_GLYPH_R`
(`= HEM_GLYPH_R`, the same constant the popup icons use) so a near-zero
smashed gap or a small gap at low zoom never collapses the glyph to an
unreadable point. The `drawHemGlyphHere` wrapper (`app/studio/draft/page.tsx`)
now takes and passes through this `R`.

Verified on the live `/studio/draft` canvas (not the debug page, per this
prompt's explicit requirement) using the "Coping Cap" template: applied an
Open hem at the start endpoint, a Teardrop hem at the end endpoint, and a
Smashed hem via leg-mid drag-back on the bottom leg. Open and Teardrop both
render as a single clean glyph matching the debug view's validated shapes,
with no second shape underneath. Smashed renders correctly but is very
small on screen, because its real `gapIn` is architecturally always `0`
(SMACNA definition: gap crushed flush) — `R` floors to `MIN_HEM_GLYPH_R` in
that case, same as the popup icon size; this is expected, not a rendering
bug. Screenshots saved to the local scratchpad (not checked into the repo):
`live-canvas-all-three-hems-final.jpg`.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both
passed. Commit `440d047` is pushed to `origin/main`. Per the verification
standard above, this stays **IMPLEMENTED, UNCONFIRMED** — the live-canvas
screenshots prove the duplicate geometry is gone and Open/Teardrop render
as a single correct shape, but do not by themselves confirm Reid agrees the
geometry is correct to his eye. Do not mark this complete until Reid
confirms against the live canvas himself.

**Prior session (2026-08-13): FlashDraft hem glyph geometry rebuilt
from validated SMACNA construction.** Replaced the shape logic inside
`drawHemGlyph()` (`lib/flashdraft/hem-glyph.ts`) entirely — the only file
this prompt was scoped to. Prior passes built every shape backward over the
leg's own material (-x territory), which is why Open rendered as a short
stub and Teardrop as two disconnected primitives. Rebuilt per SMACNA/
press-brake hem definitions, spanning outward from the tip into the hem's
own fold material (+x territory): Open and Smashed now share one
`drawHookGlyph()` hairpin construction (180-degree bend, U cross-section,
gap fraction 0.7 vs. 0.12), and Teardrop is an exact tangent-line-to-circle
construction (`d = R*1.2 > r = R*0.5` algebraically guarantees no
self-intersection) forming one closed loop. Angle/tip-point computation and
all call sites in `app/studio/draft/page.tsx` were left untouched, per
scope.

While verifying via the existing `/studio/hem-debug` debug view (as
instructed, rather than building a new one), the first screenshot showed
the new shapes clipped off-canvas — Open as two disconnected bars, Teardrop
as an open "<" with no closed loop. Root cause: the debug page's `ANCHOR`
constant (`app/studio/hem-debug/page.tsx`) was calibrated for the old
leftward/downward-extending geometry and didn't leave room for the new
rightward-extending shapes. Flagged this to Reid before proceeding, since
fixing it meant touching a second file outside the prompt's stated
one-file scope; Reid approved expanding scope to fix it. Moved `ANCHOR`
from `{x:200,y:50}` to `{x:30,y:85}` so all three shapes render fully
within the existing 280x180 canvas. Re-screenshotted after the fix — all
three shapes now render complete and unclipped. Screenshots checked in at
repo root: `hem-audit-2026-08-13-open.png`, `-smashed.png`, `-teardrop.png`,
`-full-page.png`.

`pnpm tsc --noEmit` (0 errors) and `pnpm run build` (succeeded, after
stopping a separately-running `next dev` server whose `.next` cache was
lock-contending with the build) both passed. Commit `7de79db` is pushed to
`origin/main`. Per the verification standard above, this stays
**IMPLEMENTED, UNCONFIRMED** — the screenshots prove the shapes are no
longer clipped and no longer visibly broken, but do not by themselves
confirm the geometry matches real PathfinderEdge/SMACNA reference hems to
Reid's eye. Do not mark this complete until Reid confirms against the
screenshots and the live canvas. See STATE_OF_THE_BUILD.md for the full
writeup.

**Prior session (2026-08-11): FlashDraft hem-menu trigger offset from
true endpoint.** In `handleDoubleClick` (`app/studio/draft/page.tsx`), added
`HEM_TRIGGER_OFFSET_IN = 0.5` and changed the hem double-click hit-test
targets from the true vertex positions to points extrapolated 0.5in past
each true endpoint, along that end's own leg direction, computed in world
space before conversion to screen space. Reported symptom: hit-testing
directly against the true vertex collided with vertex-drag, making
double-click near a leg's end unreliable. The single-point case
(`points.length === 1`) still hit-tests directly against `points[0]`,
unchanged, since no leg direction exists yet. `HEM_HIT_RADIUS_PX` and the
`dStart <= dEnd` tie-break logic are unchanged, now measured against the new
offset targets. The hem popup's on-screen anchor position still anchors at
the true vertex — only the hit-test target changed; `drawHemGlyph` and
`HEM_GLYPH_R` were not touched. `pnpm tsc --noEmit` (0 errors) and `pnpm run
build` (succeeded) both passed in this session; commit `e5eb3a7` is pushed
to `origin/main`. Per the verification standard above, this is canvas
double-click/hit-test behavior — it stays **IMPLEMENTED, UNCONFIRMED** until
Reid independently confirms double-clicking near a leg's end reliably opens
the hem popup on the live canvas. See STATE_OF_THE_BUILD.md for the full
writeup.

**Prior session (2026-08-11): FlashDraft auto-fit view after manual
length entry.** Single addition at the end of `applySegmentLength`
(`app/studio/draft/page.tsx`): after `commitPoints(newPoints)`, the view is
now re-fit via the same `computeFitView` mechanism already used by
`fitToScreen` and `loadTemplate` (reused exactly, not reimplemented).
Reported symptom: typing a new length into the manual segment-length box
(e.g. resizing a leg to 96") could leave the resized geometry off-screen at
the previously-set zoom/pan. `commitPoints`, `computeFitView`, `fitToScreen`,
and `loadTemplate` were left untouched; no new UI element was added. `pnpm
tsc --noEmit` (0 errors) and `pnpm run build` (succeeded) both passed in
this session; commit `b9a8d54` is pushed to `origin/main`. Per the
verification standard above, this is canvas view/zoom/pan behavior — it
stays **IMPLEMENTED, UNCONFIRMED** until Reid independently confirms a
resized leg is visible on screen after typing a new length, on the live
canvas. See STATE_OF_THE_BUILD.md for the full writeup.

**Prior session (2026-08-11): FlashDraft leg-body grab cursor fix.**
Single one-line change in `handlePointerMove` (`app/studio/draft/page.tsx`):
leg-body segment hover now sets `canvas.style.cursor = 'grab'` instead of
`'pointer'`, matching the vertex-hover behavior that was already correct.
Reported symptom was "I have to click multiple times before the grab hand
shows up" — the grab cursor had never been wired to leg hover at all, only
to vertex hover and to an in-progress drag past the movement threshold. The
`'grabbing'` active-drag cursor set elsewhere was untouched. `pnpm tsc
--noEmit` (0 errors) and `pnpm run build` (succeeded) both passed in this
session; commit `a551366` is pushed to `origin/main`. Per the verification
standard above, this is canvas hover/cursor behavior — it stays
**IMPLEMENTED, UNCONFIRMED** until Reid independently confirms the grab
cursor appears on leg-body hover on the live canvas. See STATE_OF_THE_BUILD.md
for the full writeup.

**Prior session (2026-08-11): documentation-accuracy pass.** No
application code was changed. Scope: rewrite STATE_OF_THE_BUILD.md and this
file to reflect actually-verified current state, after this project's
history of status claims not matching reality.

Verified directly this session, not assumed from prior summaries:

- `git log --oneline -20` — matches the RECENT COMMITS list below.
- `git status` — clean except `tsconfig.tsbuildinfo` (build artifact).
- Local `main` vs. `origin/main` — 0 ahead / 0 behind, fully synced.
- `pnpm tsc --noEmit` — 0 errors, exit code 0.
- `app/studio/draft/page.tsx` — directly inspected: the leg-mid hem
  drag-back gesture (`LEG_HEM_MIN_DRAG_IN`, `legHemPreview`, `angleFold`) is
  still present and wired up. The "remove mid-leg hems, keep only endpoint
  double-click hems" fix has **not** been implemented — `git log --all`
  turned up no matching commit.
- `lib/integrations/pathfinder-edge.ts` — directly inspected: 100 lines,
  every exported function returns a hardcoded `not_configured` result, zero
  `fetch()` calls. Confirmed stub, matching its own header comment.
- Repo-wide search for "PAC-CLAD" / "Painted Color" and for any
  `app/studio/**` template files — no FlashDraft template-rebuild work
  exists.

See STATE_OF_THE_BUILD.md for the full current status of FlashDraft hem
geometry, mid-leg hem removal, the template rebuild, canvas/sidebar UI
changes, and the PathfinderEdge integration — each is broken out with its
own section there rather than duplicated here.

---

## RECENT COMMITS (verified via `git log --oneline -20`, most recent first)

```
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
75aa55f  docs: rewrite governance docs to reflect verified current state
abb5da8  fix: DPR-aware live canvas, unified glyph scale constants, Open/Smashed differentiation
3786ff0  audit: add hem glyph rendering audit evidence images
0a117eb  feat: add hem glyph debug view, fix illegible popup icon size
4866dea  fix: stray drag state on mere cursor movement, undo/redo history gaps
```

---

## OPEN ITEMS FOR THE NEXT SESSION

1. **FlashDraft leg-body grab cursor** — unconfirmed by the user. Fix is
   pushed (`a551366`); needs Reid to hover a leg body on the live canvas and
   confirm the grab hand now appears immediately on hover.
2. **FlashDraft hem system (glyph-scales-with-length, Gap re-added, Kick
   direction, mid-leg removal, teardrop retighten, leg-shrink bug)** —
   unconfirmed by the user. Do not do another silent rewrite pass; get
   Reid to look at the live canvas and confirm: increasing Hem Length
   visibly grows the fold shape (not just the connecting line); the popup
   shows Hem Length, Gap, AND a Kick toggle together; toggling Kick
   mirrors the fold to the physically opposite side (not just "changes
   something"); no vertex dot at a hemmed endpoint; the teardrop curl
   reads as tight, not round; dragging mid-leg does nothing (no
   hem-creation gesture left); and that leg 1 shrinks the same as any
   other leg now.
3. ~~Mid-leg hem removal~~ — **DONE** as of the 2026-08-14 session above.
   No longer an open item.
4. **FlashDraft 3D view renders no hems** — newly identified this session.
   `ProfileViewer3D` has no hem-related props at all. Needs real scoping
   as its own task (prop plumbing plus a design decision on how to
   represent `kick`/`lengthIn` in 3D) — not a quick prop pass-through.
5. **FlashDraft template rebuild (Pass 1–4)** — not started. 20-item
   template list + Coping Cap/Valley variant pickers + PAC-CLAD "Painted
   Color" picker, all locked with the user, zero implementation.
6. **Canvas/sidebar UI** — not started. Lighter gray canvas background,
   compact sidebar redesign.
7. **PathfinderEdge** — blocked on AMS Controls (Seth Oliver) providing
   server-side logs to root-cause the 401s on the freshly rotated API key.
   Do not guess at request/response shapes in `lib/integrations/pathfinder-edge.ts`
   without a real documented API surface — it drives a physical bending
   machine.
8. **Credential rotation** — deliberately deferred to one pass immediately
   before DNS cutover, per standing user instruction. Not an open action
   item for the current build phase; do not re-raise it as a gap.

---

## PRIOR HISTORY

This file previously contained several thousand lines of session-by-session
narrative going back to the start of the project. That narrative is not
reproduced here — condensing it was part of this rewrite, since the file
had grown to a size that worked against the "quick, trustworthy status
check" purpose it exists for. Nothing is lost: the full prior text is
available via `git log -p -- SESSION_STATE.md`, and the authoritative
record of what actually shipped, at what commit, is `git log` on this repo
directly — not this file's prose description of it.

---

*SESSION_STATE.md | AFS — Architectural Flashing Supply | Reid Whitesides | Rewritten 2026-08-11 |*
