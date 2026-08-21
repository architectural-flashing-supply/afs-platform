/**
 * Maps each material label as it actually appears on the three real
 * material-selection surfaces — app/configure/page.tsx (Custom Flashing
 * Configurator), app/quote/page.tsx (Quote Builder), and
 * app/studio/draft/page.tsx via lib/data/catalog.ts's ALL_MATERIALS
 * (FlashDraft) — to the real `materials.category` value it corresponds to
 * in supabase/migrations/002_seed_afs_data.sql.
 *
 * None of the three surfaces query the live `materials` table directly;
 * each renders its own local string array, and those local labels differ
 * slightly in wording from the seeded `materials.name` values (e.g.
 * "Galvanized Galvalume" here vs. "Galvalume Steel" in the DB, "Kynar 500
 * (Painted Steel)" here vs. "Kynar 500 Painted Steel" in the DB). This maps
 * by the same underlying material, not by exact string equality against a
 * different table — every entry below was cross-checked against the real
 * seeded category, not guessed.
 */

export type MaterialCategory =
  | 'galvanized'
  | 'galvalume'
  | 'copper'
  | 'aluminum'
  | 'stainless'
  | 'zinc'
  | 'painted_steel';

export const MATERIAL_LABEL_TO_CATEGORY: Record<string, MaterialCategory> = {
  'Galvanized Steel': 'galvanized',
  'Galvanized Galvalume': 'galvalume',
  Copper: 'copper',
  'Lead Coated Copper': 'copper',
  'Anodized Aluminum': 'aluminum',
  'Stainless Steel': 'stainless',
  Zinc: 'zinc',
  'Kynar 500 (Painted Steel)': 'painted_steel',
  'Vintage Steel': 'painted_steel',
};

export type ColorPalette = 'mcelroy' | 'pacclad';

/**
 * Returns which color chart palette a material requires a color selection
 * from, or null when the material is bare/mill-finish and shows no color
 * field at all. The 'painted_steel' category (Kynar 500 Painted Steel,
 * Vintage Steel) requires McElroy; the 'aluminum' category (Anodized
 * Aluminum, currently the only seeded aluminum material) requires PAC-CLAD.
 */
export function colorPaletteForMaterial(materialLabel: string): ColorPalette | null {
  const category = MATERIAL_LABEL_TO_CATEGORY[materialLabel];
  if (category === 'painted_steel') return 'mcelroy';
  if (category === 'aluminum') return 'pacclad';
  return null;
}
