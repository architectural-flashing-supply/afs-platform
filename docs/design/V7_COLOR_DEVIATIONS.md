# V7_COLOR_DEVIATIONS.md

Every place the live Command Center's colour differs from prototype v7's literal
value, and why. The rule this file exists to serve: **v7 wins every conflict
about appearance, except where its value fails the WCAG AA build gate
(`scripts/audit/contrast-check.mjs`, run as `prebuild`). Where it fails, change
only that colour, to the nearest passing shade in the same hue family, and
record it here. A gate threshold is never relaxed.**

Deviations are applied in
`docs/design/command-center-v7/v7-deviations.css`, which the scoping transform
(`scripts/design/scope-v7-css.mjs`) appends after the verbatim CSS.
`docs/design/command-center-v7/v7.css` itself is never edited — it is a
byte-faithful extract of the prototype, and the style gate compares against the
prototype, so editing it would hide a drift rather than record one.

`lib/design/v7-deviations.test.ts` recomputes every ratio in the tables below
from the real CSS files, and fails if a number here is wrong, if a deviation
stops being necessary, or if an undocumented colour change appears. The
measurements are not comments — they are assertions.

---

## 1. `#1E8E52` → `#1D874E` — v7's green, where white text sits on it

| | Value | White-on-it contrast | Needed |
|---|---|---|---|
| v7 | `#1E8E52` | **4.16 : 1** | 4.5 : 1 |
| live | `#1D874E` | **4.54 : 1** | 4.5 : 1 |

v7's light theme keeps one green and uses it both as a decorative edge and as a
fill behind white text. As a fill it misses AA for small text by 0.34.

**Where it is a fill behind white text, and therefore where the gate bites:**

| Selector | Text | Size | WCAG class | v7 ratio |
|---|---|---|---|---|
| `.chk i` | ✓ glyph | 13px / 700 | small → 4.5 | 4.16 ✗ |
| `.apv` ("Approve" stamp) | "Approved" | 12.5px / 700 | small → 4.5 | 4.16 ✗ |
| `.srow.now .pos` | queue position | 18px / 700 | small → 4.5 (bold-large starts at 18.66px) | 4.16 ✗ |
| `.invbanner .ic` | ✓ glyph | 26px / 700 | **large → 3.0** | 4.16 ✓ |

`.invbanner .ic` already passes on its own, and the `#1E8E52` borders, dots and
left-edges (`.card.appr`, `.step.done`, `.conn i`, `.live i`, `.beacon`,
`.pill.g::before`, `.sw.on`) are decorative boundaries that the gate does not
measure — SC 1.4.11 covers form-field boundaries only, and the gate implements
exactly that.

**The substitution is applied to the colour, not to the four selectors.**
`#1E8E52` is one colour in v7 and is replaced everywhere it appears, including
the places that already passed. Splitting it would leave two greens 4.6% apart —
indistinguishable to the eye, and a trap for the next person to edit either one.

Hue is preserved rather than approximated: the channels are scaled uniformly
(×0.954), so the green:red and blue:red channel ratios move from 4.733/2.733 to
4.655/2.690 — under 2% — and `--green-h` (`#17794A`, 5.43:1) already passes and
is untouched.

---

## 2. Nothing else deviates

v7's light palette was measured pair-by-pair against the gate's own thresholds
before any CSS was written. Everything else passes as authored, including the
pairs most likely to fail:

| Pair | Ratio | Needed | |
|---|---|---|---|
| `--ink` `#0F1318` on `--bg` `#F4F5F7` | 17.09 | 4.5 | ✓ |
| `--ink3` `#3E4957` on `--p2` `#CBD2DB` (dimmest text, darkest light surface) | 6.00 | 4.5 | ✓ |
| white on `--red` `#C8102E` (the one action colour) | 5.88 | 4.5 | ✓ |
| `--redtxt` `#B3122B` on white | 6.91 | 4.5 | ✓ |
| `--ambertxt` `#6E4300` on `--amberbg` `#FFF4D9` | 7.78 | 4.5 | ✓ |
| `--greentxt` `#14693A` on `--greenbg` `#E6F4EC` | 5.95 | 4.5 | ✓ |
| `--violettxt` `#0B5568` on `--violetbg` `#E3F2F6` | 7.28 | 4.5 | ✓ |
| header search placeholder `#5C6675` on white | 5.81 | 4.5 | ✓ |
| nav text `#E6EAF0` on nav ground `#1F262F` | 12.63 | 4.5 | ✓ |
| active nav chip `#0F1318` on white | 18.64 | 4.5 | ✓ |
| brand accent `#FF5468` on header `#14181E` | 5.70 | 4.5 | ✓ |
| form-field border `--line2` `#6B7686` on white | 4.60 | 3.0 | ✓ |

### Two near-misses that are correctly NOT deviations

`--line` `#9CA6B3` measures **2.47:1** on white and **2.26:1** on `--bg`, and
`.nav`'s own border `#3A4350` measures **1.78:1** on the header. Both are below
3:1 and neither is a defect:

- SC 1.4.11 (and the gate) requires 3:1 of **form-field** boundaries. v7's
  fields (`input.f`, `select.f`, `textarea.f`, `.hdr-r input`) use `--line2`
  `#6B7686` (4.60) and `#8A94A3` (5.81 on the header) — they pass.
- `--line` draws panel edges and table-row rules; `#3A4350` draws the container
  around the nav pills. Those are decorative separators, and WCAG sets no
  contrast minimum for them. Raising them would visibly harden every edge in
  the interface and would be a reinterpretation of v7, not an accessibility fix.

They are listed here so that a future reader who measures them does not conclude
the gate is missing something.

---

*docs/design/V7_COLOR_DEVIATIONS.md · branch `command-center-v7`*
