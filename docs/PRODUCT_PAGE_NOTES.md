# PRODUCT_PAGE_NOTES.md
## The public Products page — what it shows, what it hides, and how to change it

**Branch `products-page`, 2026-10-01.** Built from
`lib/data/product-renders.manifest.json` (the reviewed render inventory — see
`docs/PRODUCT_MANIFEST.md`). Nothing on this page comes from the database.

---

## THE NUMBERS

| | Count |
|---|---:|
| Manifest entries | 64 |
| **Shown on /products** | **35** |
| Hidden | 29 |
| Shown products with geometry → **Select & Design** + 3D | **17** |
| Shown products with no geometry → **Request a Quote** only | **18** |
| Categories shown | 8 |

---

## WHAT IS HIDDEN, AND WHY

The page shows an entry only when `type === "product"` **and**
`needsReview === false`. That is one filter, in one function
(`isPublishable` in `lib/data/products-page.ts`), so there is a single place to
audit rather than several.

| Hidden because | Count |
|---|---:|
| `needsReview: true` — flagged during the manifest review | 26 |
| `type` is not `product` (6 montages + 1 machine photo) | 7 |

Nothing was deleted. **Every hidden entry stays in the manifest**, so when Steve
resolves a flag the product appears on the page on its own, with no code change.

Specifically excluded and worth naming:

- **`rbm-25-38-machine-photo`** — a photograph of a shop bending machine, not a
  product. Typed `non-product` in the manifest.
- **The five `drexel-trims-montage-*` files and `drexel-roof-trims-final-01`** —
  one house scene, recoloured. Typed `montage`.
- **The duplicate-shape clusters** — three names on one L-shape
  (`pitch-base` / `headwall-sample-02` / `rakewall-sample-02`), three on one
  ridge, two on one zee. All flagged, so none of them reach the page and the
  catalog does not show the same part three times under three names.

There is an e2e guard (`tests/e2e/products-page.spec.ts`) that fails if any
hidden entry's name or image file appears on the page.

---

## CATEGORY MAPPINGS MADE

The page uses a **display-mapping layer** (`CATEGORY_DISPLAY_MAP` and
`CATEGORY_DISPLAY_ORDER` in `lib/data/products-page.ts`). It renames nothing
anywhere else: `lib/data/profile-categories.ts`'s `AFS_PROFILE_CATEGORIES` —
read by the quote builder and FlashDraft — is **untouched**, and the manifest is
not rewritten.

### Folds

| Manifest category | Shown as | Why |
|---|---|---|
| `Standing Seam` | **Roofing Panels** | A standing-seam panel is a roofing panel; two roofing sections at the foot of the page describing the same thing is worse than one. |
| `Roofing` | **Roofing Panels** | Same reason — one roofing section. |

Neither key currently appears in the live data (both are defensive, and both are
unit-tested against synthetic rows so the fold cannot silently stop working).
Every other category passes through **unchanged**.

### Order — flashing and trim first, roofing last

1. Coping Caps & Cleats
2. Drip Edge & Gravel Stop
3. Valley Flashing
4. Fascia & Rake
5. Gutters & Scuppers
6. Base & Counter Flashing
7. Window & Door Flashing
8. Expansion Joints
9. **Trim & Closures** — kept as its own category, as instructed
10. Custom Profiles
11. Zinc Profiles
12. Standard Profiles
13. Roofing *(last)*
14. **Roofing Panels** *(last)*

A category present in the data but missing from this list is appended
alphabetically **after** the known ones rather than dropped — a new category
should look out of place, not vanish.

---

## PRODUCT NAMES — HOW TO EDIT THEM

**Every name on this page is a guess derived from a filename.** The Drexel
renderings carry no printed text whatsoever, so no product on the page has a
name anyone has verified. `nameSource` is `"filename"` on all 64 manifest
entries.

**To correct a name, edit `lib/data/product-name-overrides.ts`** — a plain
exported map, keyed by the manifest `id`:

```ts
export const PRODUCT_NAME_OVERRIDES: Record<string, string> = {
  'dmc-200s': 'DMC 200S Standing Seam Panel',
};
```

It ships **empty** on purpose. Do not edit a component, and do not edit the
derivation rules in `deriveDisplayName` — those move every other name at the
same time. A stale key (an id that no longer exists, or one that is hidden) is
simply never looked up, so it is harmless.

### What the derivation does

Two input shapes, handled differently on purpose:

- **A raw filename slug** (`t-style-drip-edge`): hyphens and underscores become
  spaces, every word is title-cased.
- **An already-reviewed name** (`J-Channel`, `Fascia Extender w/ Offset`): its
  capitalisation and its hyphens were set by hand in the manifest, so **both are
  left alone**.

That split is not cosmetic. Blanket hyphen-splitting turns `J-Channel` into
`J Channel` and `Snap-Lock` into `Snap Lock`; blanket title-casing turns `w/`
into `W/`. Both are rewordings of a product name, and this function is forbidden
from rewording. (Both were caught by the unit test during the build, not after.)

Trailing studio bookkeeping is dropped from either shape: `Eave Trim Sample 02`
→ `Eave Trim`, `Trims Zee Final 01` → `Trims Zee`, `Fascia LT 3` → `Fascia LT`.
A middle occurrence survives (`Sample Holder Bracket` is unchanged).

---

## DEFERRED — NOT BUILT THIS RUN

- **Material and gauge filters.** The manifest has **no material or gauge data
  at all** — the renderings do not state either. A filter that silently matches
  nothing is worse than no filter, so the filter UI is a name search and nothing
  else. When material data arrives, it belongs on the manifest entries first.
- **Product descriptions.** There are none, and there is nowhere honest to get
  them: nothing is printed in any rendering. The page shows a name and a profile
  and no body copy. Copy has to come from Drexel or from Steve.
- **Per-product detail pages.** `/products/[category]/[slug]` still runs on the
  older `lib/data/catalog.ts` content and was **not** touched this run. It has
  no Configurator CTA and no price (checked, not assumed).
- **Real dimensions in the 3D preview.** The preview is drawn at a nominal
  12" × 4" with 2" legs to show the *shape*. The page never prints a number from
  it, so no invented measurement reaches a customer; real sizes are entered in
  FlashDraft or on the quote.

---

## HOW THE TWO BUTTONS WORK

- **Select & Design** (geometry-backed products only). Writes the profile's
  point array to `localStorage['afs-flashdraft-canonical-points']` and navigates
  to `/studio/draft?loadCanonical=1`. This is FlashDraft's **existing** handoff,
  established by `components/studio/CanonicalProfileBrowser.tsx` — no FlashDraft
  feature was built this run. Points rather than bends on purpose: reconstructing
  from bends assumes every bend turns the same way and mangles alternating folds.
- **Request a Quote** (every product). Links to `/quote?product=<name>`.

Both are sized to their label and are never full-width on desktop; they stretch
only at 375px, where two side-by-side 44px targets do not fit.

**No prices, no cart, no "from $X", no Configurator link, and no RUSH badge** —
guarded by the e2e, not just by intent.

---

## DESIGN — THE LIGHT STACK

Each level sits **darker** than the one it is on, and there are no white cards:

| Layer | Token | Hex |
|---|---|---|
| Page | `afs-bg-light` | `#F7F7F5` |
| Category band | `afs-bg-light-raised` | `#EFEFEC` |
| Product card | `afs-bg-lane` | `#E1E5E9` |
| Enlarged card / modal | `afs-bg-catalog-pop` | `#D9DDE2` *(new)* |
| Control borders | `afs-border-catalog` | `#6F7781` *(new)* |

Only the last two are new; the rest are reused. Measured ratios and the reason
each new value is exactly what it is are in **DESIGN_TOKENS.md §8.1**. The
gunmetal header is untouched.

**Known cosmetic limitation, not a defect:** two things on this page are lighter
than the layering rule would like, and neither is fixable in CSS. (1) Many Drexel
renderings have a white background baked into the `.webp` itself, so a white
rectangle shows inside the card — the fix is re-encoding the assets, which is
out of scope. (2) `ProfileViewer3D` paints its own dark scene and gunmetal
overlay chrome inside the light modal; it was deliberately not modified this run.

---

*docs/PRODUCT_PAGE_NOTES.md | branch `products-page` | 2026-10-01*
