/**
 * The public Products page's data layer — the ONLY place that decides which
 * manifest entries reach the page, what each one is called, and what order the
 * categories appear in.
 *
 * Source of truth is `lib/data/product-renders.manifest.json`, the reviewed
 * inventory built on 2026-10-01 from the 75 Drexel Metals renderings. Nothing
 * here edits that file: entries hidden from the page STAY in the manifest, so
 * Steve can fix them later and they reappear on their own.
 *
 * No prices, no stock, no material or gauge data passes through here — the
 * manifest has none, and the platform is an RFQ model (CLAUDE.md rule #1).
 */
import manifest from '@/lib/data/product-renders.manifest.json';
import { PRODUCT_NAME_OVERRIDES } from '@/lib/data/product-name-overrides';
import { previewShapeFor } from '@/lib/data/product-preview-shapes';
import { TRIMMED_PRODUCT_IMAGES } from '@/lib/data/product-image-trim';
import type { ProfileType } from '@/lib/utils/profile-svg';

export interface ProductRenderEntry {
  id: string;
  type: string;
  sourceName: string;
  nameSource: string;
  description: string;
  category: string;
  subcategory: string;
  imageFiles: string[];
  geometryMatch: string | null;
  needsReview: boolean;
  reviewNote?: string;
}

export interface CatalogProduct {
  id: string;
  /** Mechanically derived from the filename-based name, then overridden if Reid/Steve said so. */
  name: string;
  /** Display category — already through the mapping below, safe to render. */
  category: string;
  subcategory: string;
  /** Public path under /images/products, ready for next/image. */
  image: string;
  /** Non-null means this product can offer Select & Design and the 3D view. */
  geometryMatch: ProfileType | null;
  /**
   * True when the product has no real geometry but DOES have a schematic shape
   * traced from its rendering (lib/data/product-preview-shapes.ts).
   *
   * Such a product shows the 3D viewer with dimension labels hidden, and offers
   * Request a Quote ONLY — a traced shape must never be handed to FlashDraft as
   * if it were fabrication geometry. Mutually exclusive with geometryMatch.
   */
  hasSchematicPreview: boolean;
}

export interface CatalogSection {
  category: string;
  products: CatalogProduct[];
}

/**
 * DISPLAY CATEGORY ORDER. Flashing and trim first, roofing last — Reid's
 * standing rule for this page, because AFS fabricates flashing and the roofing
 * panels are the part of the Drexel set that is least representative of what
 * the shop actually bends.
 *
 * This list is DISPLAY ONLY. It does not rename anything in
 * `lib/data/profile-categories.ts`, which the quote builder and FlashDraft
 * read, and it is not written back to the manifest.
 */
export const CATEGORY_DISPLAY_ORDER: readonly string[] = [
  'Coping Caps & Cleats',
  'Drip Edge & Gravel Stop',
  'Valley Flashing',
  'Fascia & Rake',
  'Gutters & Scuppers',
  'Base & Counter Flashing',
  'Window & Door Flashing',
  'Expansion Joints',
  'Trim & Closures',
  'Custom Profiles',
  'Zinc Profiles',
  'Standard Profiles',
  // Roofing LAST, always.
  'Roofing',
  'Roofing Panels',
];

/**
 * Category folds applied before ordering. Keys are manifest category values;
 * values are what the page shows instead.
 *
 * `Standing Seam` folds into `Roofing Panels` because a standing-seam panel IS
 * a roofing panel and splitting them puts two roofing sections at the bottom of
 * the page describing the same thing. The manifest keeps `Standing Seam`
 * wherever it appears, and `AFS_PROFILE_CATEGORIES` still lists it for the
 * quote builder — this fold is only how /products groups them.
 *
 * Every mapping made here is listed in docs/PRODUCT_PAGE_NOTES.md.
 */
export const CATEGORY_DISPLAY_MAP: Readonly<Record<string, string>> = {
  'Standing Seam': 'Roofing Panels',
  Roofing: 'Roofing Panels',
};

export function mapDisplayCategory(category: string): string {
  return CATEGORY_DISPLAY_MAP[category] ?? category;
}

/**
 * Trailing tokens that are studio bookkeeping rather than part of a product's
 * name — "Eave Trim Sample 02" is an eave trim, and "Trims Zee Final 01" is a
 * zee. Stripped only from the END of the name, and only when followed by a
 * number, so a real product that happens to contain one of these words keeps it.
 */
const TRAILING_BOOKKEEPING_TOKEN = /[\s_-]+(?:sample|final|main|render|rendering|v)[\s_-]*\d+\s*$/i;
/** A bare trailing number ("Fascia LT 3"), stripped after the token rule above. */
const TRAILING_BARE_NUMBER = /[\s_-]+\d+\s*$/;

/**
 * Derive a display name mechanically. Two input shapes, deliberately handled
 * differently, because treating them the same damages one of them:
 *
 *   A RAW FILENAME SLUG — all lowercase, no spaces ("t-style-drip-edge").
 *     Hyphens and underscores are separators and become spaces; each word is
 *     title-cased.
 *
 *   AN ALREADY-REVIEWED NAME — carries capitals or spaces ("J-Channel",
 *     "Fascia Extender w/ Offset"). Its casing and its hyphens were set by
 *     hand in the manifest, so BOTH are left exactly alone. Only underscores
 *     normalise, and only whitespace is tidied.
 *
 * Getting this wrong is not cosmetic: blanket hyphen-splitting turns
 * "J-Channel" into "J Channel" and "Snap-Lock" into "Snap Lock", and blanket
 * title-casing turns "w/" into "W/". Both are rewordings of a product name, and
 * this function is forbidden from rewording.
 *
 * Trailing studio bookkeeping ("sample 02", "final 01") and a trailing bare
 * number are dropped from either shape.
 *
 * If a derived name is still wrong, the fix is `PRODUCT_NAME_OVERRIDES` — not
 * this function, which moves every other name at the same time.
 */
export function deriveDisplayName(raw: string): string {
  let s = raw.replace(/\.webp$/i, '');
  const isRawSlug = !/\s/.test(s) && s === s.toLowerCase();

  // Strip bookkeeping before separators are normalised so both
  // "eave-trim-sample-02" and "Eave Trim Sample 02" are caught.
  s = s.replace(TRAILING_BOOKKEEPING_TOKEN, '');
  s = isRawSlug ? s.replace(/[_-]+/g, ' ') : s.replace(/_+/g, ' ');
  s = s.replace(TRAILING_BOOKKEEPING_TOKEN, '');
  s = s.replace(TRAILING_BARE_NUMBER, '');
  s = s.replace(/\s+/g, ' ').trim();

  // A reviewed name keeps its own capitalisation, verbatim.
  if (!isRawSlug) return s;

  return s
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** The raw manifest, typed. Includes everything — hidden entries too. */
export const PRODUCT_MANIFEST = manifest as ProductRenderEntry[];

/**
 * Entries the page is allowed to show: a real product, and not flagged for
 * review. Montages, the bending-machine photo (`rbm-25-38`, typed
 * `non-product`) and all 26 `needsReview` entries are excluded here and
 * nowhere else, so there is one filter to audit rather than several.
 */
export function isPublishable(entry: ProductRenderEntry): boolean {
  return entry.type === 'product' && entry.needsReview === false;
}

function toCatalogProduct(entry: ProductRenderEntry): CatalogProduct {
  // A traced cross-section (read off the product's own rendering) always wins
  // over a generic ProfileType template. A template is a stand-in shape at
  // made-up sizes; where the real section is known, the template is withdrawn
  // for this product, which also withdraws Select & Design (a traced shape is
  // proportion-faithful but unmeasured, so it is never handed to FlashDraft).
  const traced = previewShapeFor(entry.id) !== null;
  const matched = (entry.geometryMatch as ProfileType | null) ?? null;
  return {
    id: entry.id,
    name: PRODUCT_NAME_OVERRIDES[entry.id] ?? deriveDisplayName(entry.sourceName),
    category: mapDisplayCategory(entry.category),
    subcategory: entry.subcategory,
    image: TRIMMED_PRODUCT_IMAGES[entry.id] ?? entry.imageFiles[0],
    geometryMatch: traced ? null : matched,
    hasSchematicPreview: traced,
  };
}

/** Every publishable product, flat, in manifest order. */
export function getCatalogProducts(
  source: ProductRenderEntry[] = PRODUCT_MANIFEST
): CatalogProduct[] {
  return source.filter(isPublishable).map(toCatalogProduct);
}

/**
 * Publishable products grouped into category sections, in display order.
 *
 * A category present in the data but missing from CATEGORY_DISPLAY_ORDER is
 * appended alphabetically AFTER the known ones rather than dropped — a new
 * category should show up looking out of place, not vanish.
 */
export function getCatalogSections(
  source: ProductRenderEntry[] = PRODUCT_MANIFEST
): CatalogSection[] {
  const grouped = new Map<string, CatalogProduct[]>();
  for (const product of getCatalogProducts(source)) {
    const bucket = grouped.get(product.category);
    if (bucket) bucket.push(product);
    else grouped.set(product.category, [product]);
  }

  return [...grouped.entries()]
    .map(([category, products]) => ({ category, products }))
    .sort((a, b) => {
      const ai = CATEGORY_DISPLAY_ORDER.indexOf(a.category);
      const bi = CATEGORY_DISPLAY_ORDER.indexOf(b.category);
      if (ai === -1 && bi === -1) return a.category.localeCompare(b.category);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}

/** Stable anchor id for the sticky jump-nav. */
export function categoryAnchorId(category: string): string {
  return `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
