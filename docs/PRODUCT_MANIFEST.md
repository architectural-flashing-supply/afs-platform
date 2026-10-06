# PRODUCT_MANIFEST.md
## Drexel Metals renderings — reviewed products list

**Branch `products-manifest`. 2026-10-01.** Every one of the 75 `.webp` files was opened and looked at. No page or component was built.

Source: `afs-assets/drexel-webp/renders/` (web copies only; nothing from `Renders-originals`). AFS has permission to use these renderings. Assets copied to `public/images/products/`, subfolder structure preserved.

---

## THE FINDING THAT SHAPES EVERYTHING BELOW

**No Drexel rendering has any text printed in it.** The brief assumed the product descriptions were printed inside the images; they are not. All 75 are clean 3D renderings — most on white, the `trim-jpegs` set on grey — with no labels, no callouts, no dimensions, no product names.

So `description` is `""` on every entry, and the only name available is the filename. Rather than silently present a filename as if it had been read off the image, every entry carries a **`nameSource`** field, which is `"filename"` on all 64. Nothing was invented, summarised from memory, or guessed.

**The Products page therefore has no copy.** Descriptions have to come from Drexel or from Steve before anything can be published.

---

## CATEGORIES

Flashing and trim first; Roofing Panels last, as instructed.

| Category | Entries |
|---|---:|
| Coping Caps & Cleats | 6 |
| Drip Edge & Gravel Stop | 6 |
| Valley Flashing | 2 |
| Fascia & Rake | 5 |
| Gutters & Scuppers | 2 |
| Base & Counter Flashing | 7 |
| Trim & Closures | 16 |
| Roofing Panels | 13 |
| Not a product | 7 |
| **Total** | **64** |

Nine of the twelve existing `AFS_PROFILE_CATEGORIES` were reused as-is. **Two new category names were needed and are flagged for your decision:**

- **`Trim & Closures`** — J-channel, zees, ridge/hip, soffit-J, transitions. The existing vocabulary has no general trim bucket and forcing these into `Custom Profiles` would have been wrong.
- **`Roofing Panels`** — the DMC panel profiles, rib options and seam details. The existing `Standing Seam` category arguably covers these; I used `Roofing Panels` because the brief named it and ordered it last. **Your call which one survives.**
- **`Not a product`** — the six montages plus the machine photo, so they can never be published as SKUs by accident.

Unused existing categories: `Window & Door Flashing`, `Expansion Joints`, `Standing Seam`, `Custom Profiles`, `Zinc Profiles`, `Standard Profiles`.

---

## GEOMETRY — WHO GETS "SELECT & DESIGN" AND THE 3D ROTATION

**27 entries have a confirmed `geometryMatch`** against the existing `ProfileType` union in `lib/utils/profile-svg.ts`. These can carry Select & Design and the slow 3D rotation:

| Entry | ProfileType |
|---|---|
| `drip-edge-and-drip-edge-lt` — Drip Edge and Drip Edge LT | `drip-edge` |
| `econo-coping-lt` — Econo Coping LT | `coping-cap` |
| `econo-coping` — Econo Coping | `coping-cap` |
| `econo-gravel-stop` — Econo Gravel Stop | `gravel-stop` |
| `fascia-extender-w-offset` — Fascia Extender w/ Offset | `fascia` |
| `fascia-extender` — Fascia Extender | `fascia` |
| `fascia-lt-3` — Fascia LT 3 | `fascia` |
| `gravel-stop` — Gravel Stop | `gravel-stop` |
| `secure-lok-fascia` — Secure-Lok Fascia | `fascia` |
| `snap-coping-max-c` — Snap Coping Max C | `coping-cap` |
| `snap-coping-max` — Snap Coping Max | `coping-cap` |
| `dmc-gutter-lt-1` — DMC Gutter LT | `gutter` |
| `dmc-gutter-rendering-1` — DMC Gutter | `gutter` |
| `trim-drip-edge` — Drip Edge | `drip-edge` |
| `perforated-z-closure` — Perforated Z Closure | `z-closure` |
| `ridge-cap` — Ridge Cap | `ridge` |
| `ridge-trim` — Ridge Trim | `ridge` |
| `t-style-drip-edge` — T-Style Drip Edge | `drip-edge` |
| `trims-offset-cleat` — Offset Cleat | `cleat` |
| `trims-zee` — Zee | `z-closure` |
| `offset-cleat-sample-02` — Offset Cleat Sample 02 | `cleat` |
| `ridge-and-hip-sample-02` — Ridge and Hip Sample 02 | `ridge` |
| `ridge-sample-01` — Ridge Sample 01 | `ridge` |
| `vented-ridge-sample-02` — Vented Ridge Sample 02 | `ridge` |
| `vented-zee-sample-02` — Vented Zee Sample 02 | `z-closure` |
| `zee-sample-01` — Zee Sample 01 | `z-closure` |
| `zee-sample-02` — Zee Sample 02 | `z-closure` |

**37 entries have no geometry** and get **Request a Quote only**.

Geometry was assigned only where the product unambiguously IS that ProfileType. No angle, segment or dimension was read off a rendering — the renderings carry none, and inventing them would put fiction into a system that feeds a physical bending machine. Notable deliberate nulls: counter flashing and reglet (no ProfileType exists; `base-flashing` is a different part), valley (no ProfileType), and every standing-seam panel (the union is a flashing vocabulary, not a panel one).

---

## NEEDS REVIEW — 26 entries

- **`drip-edge-and-drip-edge-lt`** (Drip Edge & Gravel Stop) — One rendering shows two variants (standard + LT). May need splitting into two products; no printed text to confirm.
- **`fascia-lt-3`** (Fascia & Rake) — Trailing "3" in the filename is unexplained — variant number or gauge? No printed text.
- **`snap-coping-max-c`** (Coping Caps & Cleats) — Trailing "C" is unexplained — variant or cleat option? No printed text. Rendering differs from Snap Coping Max only in the anchor cleat.
- **`dmc-gutter-rendering-1`** (Gutters & Scuppers) — Filename says only "rendering-1" — is this the base DMC Gutter, or a second view of the LT? Hanger detail differs (perforated strap vs bolted bracket).
- **`dmc-150ss-mechanical-lock`** (Roofing Panels) — Filename gives no product prefix; folder places it under DMC 150SS. Confirm it is the 150SS mechanical-lock seam and not a shared generic render.
- **`dmc-fwq100-flush-mount-soffit`** (Roofing Panels) — Filename gives no product prefix; folder places it under DMC FWQ100. A soffit panel may belong in its own wall/soffit category rather than Roofing Panels.
- **`compression-counter-flashing`** (Base & Counter Flashing) — No ProfileType for counter flashing. base-flashing exists but is a different part — deliberately left null rather than mismatched.
- **`pitch-base`** (Base & Counter Flashing) — Rendering is a plain two-leg L. Could be base-flashing or pitch-change; the name supports neither clearly, so no geometry was assigned.
- **`w-valley`** (Valley Flashing) — Rendering reads as a simple V, not the W its name implies. No ProfileType for valley; none assigned.
- **`cfr-sample-02`** (Trim & Closures) — "CFR" is an unexplained acronym and nothing is printed in the image. Needs a real product name before it can be published.
- **`counter-flashing-sample-02`** (Base & Counter Flashing) — Appears to be a second render (grey backdrop) of the same part as compression-counter-flashing. Confirm whether these are one product or two.
- **`headwall-sample-02`** (Base & Counter Flashing) — Plain two-leg L, visually identical to pitch-base and rakewall-sample-02. Three names, one shape — confirm they are genuinely different parts.
- **`offset-cleat-sample-02`** (Coping Caps & Cleats) — Second render of the same part as trims-offset-cleat. Confirm one product or two.
- **`rakewall-sample-02`** (Base & Counter Flashing) — Plain two-leg L, visually identical to headwall-sample-02 and pitch-base. See that note.
- **`rbm-25-38-machine-photo`** (Not a product) — NOT A RENDERING. A 400x250 web photo of a shop bending machine on casters. Not a product, montage or swatch, so none of the three allowed types applies. Recommend dropping it from the Products page entirely.
- **`reglet-sample-02`** (Base & Counter Flashing) — Second render of the same part as trims-reglet. Confirm one product or two.
- **`ridge-and-hip-sample-02`** (Trim & Closures) — Visually identical to ridge-sample-01 and ridge-trim. Three names, one shape — confirm before publishing all three.
- **`ridge-sample-01`** (Trim & Closures) — See ridge-and-hip-sample-02 — same shape, different name.
- **`transition-sample-02`** (Trim & Closures) — Shallow two-plane bend. pitch-change may fit but the name does not say so — left null rather than guessed.
- **`trim-generic-sample-01`** (Trim & Closures) — Name says "generic sample" — likely a placeholder/stock image rather than a real SKU. Recommend excluding from the Products page.
- **`vented-zee-sample-02`** (Trim & Closures) — Named "vented" but no perforations are visible in the rendering, unlike perforated-z-closure which clearly shows them. Confirm the right render is attached to the right name.
- **`zee-sample-01`** (Trim & Closures) — zee-sample-01 and zee-sample-02 are near-identical renders of the same zee. Likely one product with two frames.
- **`zee-sample-02`** (Trim & Closures) — See zee-sample-01 — same part.
- **`drexel-trims-montage-485c`** (Not a product) — Same house scene as the other four montages, recoloured. "485C" reads as a Pantone code but nothing is printed in the image to confirm it — do not publish it as a colour name without confirmation.
- **`drexel-trims-montage-503c`** (Not a product) — See 485C — same scene, different colour, unconfirmed Pantone-style code.
- **`drexel-trims-montage-7479c`** (Not a product) — See 485C — same scene, different colour, unconfirmed Pantone-style code.

---

## TWO THINGS THAT ARE NOT PRODUCTS AT ALL

1. **`rbm-25-38-main-400x250.webp` is a photograph of a shop bending machine on casters** — a 400x250 web thumbnail, not a rendering. It is not a product, a montage or a colour swatch, so none of the three allowed `type` values applies. I gave it `type: "non-product"` rather than misfile it, and recommend dropping it.
2. **There are no colour swatch sheets in this set.** The five `drexel-trims-montage-*` files are the same house scene recoloured (485C / 503C / 7479C / blue / untitled). They read as colour variants, but since nothing is printed in them, the Pantone-looking codes are unverified and must not be published as finish names.

---

## WHAT A PRODUCTS PAGE STILL NEEDS

- Product descriptions (nothing is printed in any image).
- A decision on `Trim & Closures` vs existing vocabulary, and `Roofing Panels` vs `Standing Seam`.
- Resolution of the 26 review items above, in particular the duplicate-shape clusters: three names on one L-shape (pitch-base / headwall / rakewall), three on one ridge, two on one zee, and the trim-complete vs trim-jpegs pairs that appear to be the same parts rendered twice.
- Confirmation that the `-sample-NN` and `trim-generic` files are real SKUs and not studio test frames.

No prices appear anywhere in this manifest and none should (CLAUDE.md rule #1).

---

*Generated on branch `products-manifest`, 2026-10-01. Inventory: `docs/PRODUCT_MANIFEST_INVENTORY.md`. Data: `lib/data/product-renders.manifest.json`.*

---

## 2026-10-01 (second pass) — SCHEMATIC 3D PREVIEWS

Nine of the 18 shown products that have no `geometryMatch` now have a
**schematic** 3D preview, traced from their own Drexel rendering and stored in
`lib/data/product-preview-shapes.ts`. The `ProfileType` union and
`buildGeometry` were NOT touched: a value in that union means "this app can
fabricate this", and a shape read off a marketing picture is not that.

**What "schematic" buys and what it costs.** Each shape renders in the same 3D
viewer, so a customer can see the section — but with the **dimensions control
removed, no dimension or angle labels, and Request a Quote only**. No Select &
Design: a traced shape must never reach FlashDraft, and through it the machine,
dressed as real geometry. Proportions are a reading of a picture; nothing in any
rendering states a dimension.

### Products that GOT a schematic preview (9)

| id | Category | What the rendering showed |
|---|---|---|
| `j-channel` | Trim & Closures | Tall back leg, base, short return — a channel |
| `soffit-j-sample-02` | Trim & Closures | Same channel family, shallower |
| `trims-reglet` | Base & Counter Flashing | Wall flange, vertical face, bottom kick-out |
| `eave-trim-sample-02` | Drip Edge & Gravel Stop | Wide roof flange, down over the eave, kick |
| `gable-sample-02` | Fascia & Rake | Roof flange, taller face, bottom kick |
| `peak-sample-02` | Trim & Closures | Short leg and kick, over the peak to a long slope |
| `valley-sample-02` | Valley Flashing | Two planes meeting in a shallow V |
| `rib-mechanically-seamed-flat-panel` | Roofing Panels | Flat pan between two upstanding seams |
| `rib-snap-lock-flat` | Roofing Panels | Flat pan between two snap-lock seams with returned lip |

### Products SKIPPED, and why (9 — all Roofing Panels)

| id | Why skipped |
|---|---|
| `rib-mechanically-seamed-striations` | Striations are a fine surface corrugation. Their count and depth are not stated anywhere, so any section drawn would be invented detail, not a trace. |
| `rib-snap-lock-striations` | Same — striated pan. |
| `dmc-150ss-seamed-90` | The rendering is a SEAM CLOSE-UP, not a complete repeating panel section. Nothing shows the pan width or the full profile. |
| `dmc-200s-seamed-180` | Seam close-up, same reason. |
| `dmc-200s-seamed-90` | Seam close-up, same reason. |
| `dmc-200s` | Seam close-up, same reason. |
| `dmc-fwq100-reveal` | Reveal/joint close-up; no complete repeating section visible. |
| `fastener-flange` | A seam-and-clip attachment detail, not a panel cross-section. |
| `snap-lock-wclip` | A seam-and-clip attachment detail, not a panel cross-section. |

These nine keep their photographic rendering in the popup, exactly as before.
A named SKU's seam profile is the thing that identifies it, and drawing a
generic one from a close-up would put a confident wrong shape under a real
product name — the same failure that got the 911-profile machine library
deleted.

**No product was skipped for being mounted against brick or masonry.** Every
such rendering in the set (the edge-metal group) already carries real
`geometryMatch` geometry, so none of them needed a trace.

**Counts after this pass:** 35 shown · 17 designable (unchanged, and asserted by
a test) · 9 schematic preview · 9 image-only.

## 2026-10-05 - traced product cross-sections
- lib/data/product-preview-shapes.ts is now GENERATED from 34 traces read off the end-face of each Drexel rendering (axonometric projection solved, then verified by projecting the polyline back onto the rendering). Proportions only; scale is nominal (longest side 6 in) and never displayed.
- 17 products previously borrowed generic ProfileType templates (wrong shapes). Traced shape now wins; for those products the template is withdrawn, so they offer Request a Quote only (no Select & Design) - a traced shape is unmeasured and must not reach FlashDraft.
- Untraceable (no preview): snap-lock-wclip (assembled-seam close-up). Low confidence: snap-coping-max (back leg hidden by cleat), valley-sample-02 (fold angle unverified). Seam close-ups (dmc-*, fwq100, fastener-flange) trace only the visible panel sheet, not clips/adjoining panels.
- Rollback: git revert the merge; templates return.

## 2026-10-05 - products: hems, single turn, sizing (branch fix/products-hems-sizing)
- Real hems: gen_ts.py now reads the audited hem data (trace/result2) and emits hemStart/hemEnd (open fold-back, length + gap) per product; ProductProfilePreview3D maps them to the viewer's Hem (HEM_LEFT_IS_OUTSIDE). VERIFIED by overlaying the viewer's own hem centrelines on all 27 hemmed ends of the Drexel renderings (afs-overnight/logs/hem2): every fold-back lands on the correct side. Hem return length is the audited value; econo-gravel-stop is the smallest visible.
- 3D rotation is ONE clock-based 360 turn (30 s, singleTurnMs); cancelled by any user drag or view preset. Catalogue camera starts more end-on (cameraDirection prop) so the section reads.
- Tile popover no longer re-opens after the modal closes (suppress until a real re-entry, ProductTile.tsx).
- Rendering images auto-trimmed (public/images/products-trim, lib/data/product-image-trim.ts, generator afs-overnight/trace/trim_images.py). Not trimmed: brick-wall shots, fascia/rake, gutter, DMC close-ups.
- Perforated Z Closure: perforation is now on the vertical WEB in 3D (perforatedSegments [1] is the web in the traced order - re-checked visually). The rendering image was RETOUCHED (flange slots filled, web slots drawn) - it is not a Drexel original; script afs-overnight/pz3.py, original at trace/perforated-z-closure.orig-trim.webp. trim_images.py would regenerate the OLD file name; the retouched file is perforated-z-closure-web.webp.
- Products header: faint rotating Zee backdrop (ProductsHeaderBackdrop); "Product Catalog" eyebrow removed.
- Open: header copy still mentions taking products into FlashDraft although no traced product is designable.

## 2026-10-06 - products: hem legibility, orientation, thumbnails, scroll dismiss
- Hems: gen_ts.py now floors every hem to a legible size (HEM_MIN_LEN_IN 0.42, HEM_MIN_GAP_IN 0.17, nominal inches; true traced proportions kept above the floor) and applies Reid's hem decisions: all open except Soffit J = closed (smashed). Collision check vs the profile's other legs: all >= 0.18 in.
- ORIENTATION BUG FIXED: ProfileViewer3D always lays the first leg along +X, so several traced profiles (T-style drip edge, eave trim, gable, ridge cap, ...) displayed rotated/upside-down vs their renderings. ProductProfilePreview3D now passes orientationRad (traced first-leg angle) -> meshGroup.rotation.z. FlashDraft studio unaffected (default 0).
- 3D Top/Side/End presets now frame at the fit distance (End frames the cross-section, not the 12 in extrusion).
- Tile popover closes on scroll/wheel/touchmove/resize and stays closed until the pointer really moves (scrollHold); modal-close suppression unchanged.
- Thumbnails: renderings re-trimmed at 2.5% margin; light images feathered into their edge colour; every image box is filled with the image's own edge colour (lib/data/product-image-bg.ts, generated by trace/trim2.py). Black-background renderings (Z, reglet, J-channel, ridge cap/trim, zee, ...) now show as uniform black boxes.
- Perforated Z: perforation is on the vertical WEB in both the retouched rendering and 3D.

## 2026-10-06 (3) - Clean regenerated product renderings
- The pixelated/faded Drexel-derived renderings for 15 traced products (J-Channel, Perforated Z, Ridge Cap, Ridge Trim, Zee, Peak, Soffit J, Vented Ridge, Drip Edge, T-Style Drip Edge, Offset Cleat, Reglet, Eave Trim, Gable, Valley) were replaced by our own anti-aliased 3D renders generated from the traced profile geometry (three.js ortho render, 2400px supersample, transparent webp). Colours sampled from the original renderings.
- Files: public/images/products-render/*.webp; lib/data/product-image-trim.ts and product-image-bg.ts remapped (bg rgb(240,243,247)); products-page.test.ts path regex allows products-render.
- Tooling (outside repo): afs-overnight/render/{render.html,render_profiles.cjs,colors.py,wire.py}.
- Caveats: these are AFS illustrations built from traced proportions (hems drawn at legible size, sheet thickness 1.6mm for visibility), not Drexel originals; Perforated Z slot pattern is representative (3 rows), valley fold angle and snap-coping-max remain low confidence. Rib panels, DMC, gutter, context shots unchanged.
- Verified: vitest products-page (27 pass), Playwright screenshots of grid + modals (logs/v4).
