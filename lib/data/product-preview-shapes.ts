/**
 * SCHEMATIC cross-sections for products that have no `geometryMatch`.
 *
 * WHY THIS TABLE IS SEPARATE. The `ProfileType` union in
 * `lib/utils/profile-svg.ts` is FlashDraft's fabrication vocabulary: a value in
 * it means "this app knows how to build this shape" and it feeds the Select &
 * Design handoff and, downstream, the machine. Nothing here is that. These are
 * drawings traced from a Drexel marketing rendering so a customer can see what
 * a part looks like, nothing more. Adding them to `ProfileType` would make
 * guesses look like fabrication data, so they live in their own table and
 * `buildGeometry` is untouched.
 *
 * WHAT "SCHEMATIC" MEANS HERE, AND IT IS STRICT:
 *   - **The proportions are indicative, not measured.** Nothing in any Drexel
 *     rendering states a dimension (docs/PRODUCT_MANIFEST.md), so every number
 *     below is a reading of a picture. They exist only to make the shape read
 *     correctly on screen.
 *   - **No dimension or angle labels are ever shown** for these. The viewer is
 *     mounted with its dimensions toggle hidden and labels off, so no invented
 *     measurement can reach a customer.
 *   - **No Select & Design.** A schematic shape must never be handed to
 *     FlashDraft as if it were real geometry. These products offer Request a
 *     Quote only.
 *
 * Coordinates are INCHES, y-down — the same frame as `profilePointsFor`, so the
 * bends run through `bendsFromPoints` and therefore through
 * `signedInteriorAngleDeg`, keeping handedness correct (CLAUDE.md rule #12).
 *
 * Products that could NOT be drawn faithfully are deliberately absent. They are
 * listed, with reasons, in docs/PRODUCT_MANIFEST.md.
 */
import type { ProfilePoint } from '@/lib/data/product-geometry';

export interface ProductPreviewShape {
  /** Always true. These are traced from a picture, never measured. */
  schematic: true;
  /** Cross-section polyline, inches, y-down. */
  points: ProfilePoint[];
  /** What the rendering showed, in words — the basis for the trace. */
  note: string;
}

/**
 * Keyed by the manifest entry's `id`.
 *
 * Several products in the Drexel set are the same part photographed twice or
 * named twice; where that is true they share one shape rather than carrying two
 * slightly different traces of one picture.
 */
export const PRODUCT_PREVIEW_SHAPES: Readonly<Record<string, ProductPreviewShape>> = {
  // --- Trim and closures: plain, unambiguous cross-sections -----------------
  'j-channel': {
    schematic: true,
    note: 'J-channel: a tall back leg, a base, and a short return leg forming the channel.',
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 1.25, y: 3 },
      { x: 1.25, y: 1.4 },
    ],
  },
  'soffit-j-sample-02': {
    schematic: true,
    note: 'Soffit J: the same channel family as the J-channel, shallower, as rendered.',
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ],
  },
  'trims-reglet': {
    schematic: true,
    note: 'Reglet: a flange into the wall, a vertical face, and a kick-out at the bottom.',
    points: [
      { x: 0, y: 0 },
      { x: 1.5, y: 0 },
      { x: 1.5, y: 4 },
      { x: 2.3, y: 4.4 },
    ],
  },

  // --- Edge / eave / rake: a roof flange, a face, a kick --------------------
  'eave-trim-sample-02': {
    schematic: true,
    note: 'Eave trim: a wide roof-side flange, down over the eave, finishing in a kick.',
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1.5 },
      { x: 4.7, y: 1.9 },
    ],
  },
  'gable-sample-02': {
    schematic: true,
    note: 'Gable/rake trim: a roof flange, a taller vertical face, and a kick at the bottom.',
    points: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 3 },
      { x: 3.7, y: 3.4 },
    ],
  },

  // --- Peak and valley -----------------------------------------------------
  'peak-sample-02': {
    schematic: true,
    note: 'Peak trim: a short vertical leg and kick, rising over the peak to a long slope.',
    points: [
      { x: 0, y: 3.2 },
      { x: 0.1, y: 0.6 },
      { x: 1.6, y: 0 },
      { x: 4.2, y: 1.3 },
    ],
  },
  'valley-sample-02': {
    schematic: true,
    note: 'Valley: two flat planes meeting in a shallow V, as rendered.',
    points: [
      { x: 0, y: 0 },
      { x: 3, y: 1.4 },
      { x: 6, y: 0 },
    ],
  },

  // --- Roofing panels: ONLY the two whose rendering shows a complete,
  // --- repeating pan-and-seam section. Every other roofing entry is a seam
  // --- close-up and is skipped; see docs/PRODUCT_MANIFEST.md.
  'rib-mechanically-seamed-flat-panel': {
    schematic: true,
    note: 'Flat pan between two upstanding seams — the mechanically-seamed rendering shows the full repeating section.',
    points: [
      { x: 0, y: 0 },
      { x: 0, y: -1.6 },
      { x: 0.25, y: -1.6 },
      { x: 0.25, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: -1.6 },
      { x: 6.25, y: -1.6 },
    ],
  },
  'rib-snap-lock-flat': {
    schematic: true,
    note: 'Flat pan between two snap-lock seams; the seam is drawn with its returned lip, as rendered.',
    points: [
      { x: 0, y: 0 },
      { x: 0, y: -1.4 },
      { x: 0.35, y: -1.4 },
      { x: 0.35, y: -0.5 },
      { x: 6, y: -0.5 },
      { x: 6, y: -1.4 },
      { x: 6.35, y: -1.4 },
    ],
  },
};

/** The schematic shape for a product id, or null if it has none. */
export function previewShapeFor(productId: string): ProductPreviewShape | null {
  return PRODUCT_PREVIEW_SHAPES[productId] ?? null;
}

/** Every product id that carries a schematic preview. */
export function previewedProductIds(): string[] {
  return Object.keys(PRODUCT_PREVIEW_SHAPES);
}
