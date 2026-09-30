/**
 * The curated AFS product-category vocabulary.
 *
 * This list used to live inside the (now deleted) /studio/library machine-
 * profile page, and the FlashDraft "Profile Details" category dropdown used
 * to read its options from the old machine profile library's own category
 * table instead. That library was removed in Command Center V2 prompt v2-01
 * (docs/COMMAND_CENTER_V2_SPEC.md §2.8), so the vocabulary now lives here —
 * one place, no database round-trip, and it can never go sparse.
 *
 * These are AFS trade terms, not names lifted from a machine catalog.
 * Keep them plain English: they appear directly in customer-facing
 * dropdowns.
 */
export const AFS_PROFILE_CATEGORIES = [
  'Coping Caps & Cleats',
  'Drip Edge & Gravel Stop',
  'Valley Flashing',
  'Fascia & Rake',
  'Gutters & Scuppers',
  'Base & Counter Flashing',
  'Window & Door Flashing',
  'Expansion Joints',
  'Standing Seam',
  'Custom Profiles',
  'Zinc Profiles',
  'Standard Profiles',
] as const;

export type AfsProfileCategory = (typeof AFS_PROFILE_CATEGORIES)[number];
