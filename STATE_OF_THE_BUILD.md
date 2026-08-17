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
