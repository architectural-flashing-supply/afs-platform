/**
 * Manual display-name corrections for the public Products page.
 *
 * WHY THIS FILE EXISTS. Every name on the Products page is derived
 * MECHANICALLY from the rendering's filename (see `deriveDisplayName` in
 * `lib/data/products-page.ts`), because the Drexel renderings carry no printed
 * text at all — nothing in any of the 75 images names the product. The
 * manifest records that honestly: `nameSource` is `"filename"` on all 64
 * entries. A derived name is therefore the best available guess at what a part
 * is called, not a verified product name.
 *
 * So when Reid or Steve finds a name that is wrong, abbreviated or
 * trade-incorrect, the fix goes HERE — a plain map, keyed by the manifest
 * entry's `id` — and NOT in a component, and NOT by editing the derivation
 * rules (which would silently move every other name at the same time).
 *
 * HOW TO EDIT. Add one line per correction. The key is the `id` exactly as it
 * appears in `lib/data/product-renders.manifest.json`; the value is the name
 * you want shown, verbatim, with whatever capitalisation and punctuation is
 * correct:
 *
 *     export const PRODUCT_NAME_OVERRIDES: Record<string, string> = {
 *       'dmc-200s': 'DMC 200S Standing Seam Panel',
 *       'cfr-sample-02': 'Continuous Fascia Receiver',
 *     };
 *
 * An id that is not in the manifest, or is in the manifest but hidden from the
 * page (flagged `needsReview`, or a montage), is simply never looked up — a
 * stale key is harmless, not an error.
 *
 * Deliberately EMPTY on delivery. Nothing here is invented: the first entries
 * should come from Drexel's own literature or from Steve, not from a guess
 * made while building the page.
 */
export const PRODUCT_NAME_OVERRIDES: Record<string, string> = {};
