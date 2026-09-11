/**
 * Maps each material label as it actually appears on the two real
 * material-selection surfaces — app/quote/page.tsx (Quote Builder) and
 * app/studio/draft/page.tsx via lib/data/catalog.ts's ALL_MATERIALS
 * (FlashDraft) — to the real `materials.category` value it corresponds to
 * in supabase/migrations/002_seed_afs_data.sql. (A third surface,
 * app/configure/page.tsx's Custom Flashing Configurator, was eliminated
 * hpd-002 — its labels are no longer part of this mapping.)
 *
 * Neither of the two surfaces query the live `materials` table directly;
 * each renders its own local string array, and those local labels differ
 * slightly in wording from the seeded `materials.name` values (e.g.
 * "Galvanized Galvalume" here vs. "Galvalume Steel" in the DB, "Kynar 500
 * (Painted Steel)" here vs. "Kynar 500 Painted Steel" in the DB). This maps
 * by the same underlying material, not by exact string equality against a
 * different table — every entry below was cross-checked against the real
 * seeded category, not guessed.
 */

import { pacclad_anodized } from './metal-colors';

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

export type ColorPalette = 'mcelroy' | 'pacclad' | 'pacclad_anodized';

/**
 * The required Finish choice for 'aluminum' category materials (afs-jf-002).
 * Supersedes afs-cv-002's ruling that every aluminum material always uses
 * the PAC-CLAD palette — that was wrong for mill/anodized-only orders with
 * no painted coating at all. Not applicable to any other category:
 * 'painted_steel' materials (Kynar 500 Painted Steel, Vintage Steel) never
 * had a finish question and still don't — see colorPaletteForMaterial.
 */
export type AluminumFinish = 'Anodized' | 'Painted';

/**
 * True when this material requires a REQUIRED Finish choice (Anodized vs.
 * Painted) before any color can be captured. Currently only the 'aluminum'
 * category (Anodized Aluminum, the only seeded aluminum material).
 */
export function requiresFinishChoice(materialLabel: string): boolean {
  return MATERIAL_LABEL_TO_CATEGORY[materialLabel] === 'aluminum';
}

/**
 * True when this material eventually requires SOME color value — via a
 * chart picker (McElroy, PAC-CLAD) or, for Anodized aluminum until
 * pacclad_anodized is populated, free text — regardless of whether a value
 * has actually been entered yet. Use isColorRequirementSatisfied to check
 * whether it HAS been satisfied.
 */
export function materialRequiresColorValue(materialLabel: string): boolean {
  const category = MATERIAL_LABEL_TO_CATEGORY[materialLabel];
  return category === 'painted_steel' || category === 'aluminum';
}

/**
 * Returns which color chart palette a material + finish combination
 * requires a color selection from, or null when no chart-based picker
 * applies — either because the material is bare/mill-finish (no color
 * field at all), because a Finish hasn't been chosen yet for an aluminum
 * material, or because the chosen finish is 'Anodized' and no PAC-CLAD
 * anodized chart exists yet (see the FUTURE-SWAP HOOK below).
 *
 * 'painted_steel' materials (Kynar 500 Painted Steel, Vintage Steel) always
 * require the McElroy chart, regardless of `finish` — this branch is
 * untouched by afs-jf-002, matching the Kynar path exactly as afs-cv-002
 * built it.
 *
 * 'aluminum' materials require a Finish choice first (afs-jf-002,
 * supersedes afs-cv-002's blanket "aluminum always means PAC-CLAD" ruling):
 * 'Painted' requires the PAC-CLAD chart; 'Anodized' requires
 * 'pacclad_anodized' ONLY once that chart has real entries in
 * lib/data/metal-colors.ts, and null (free text) until then.
 */
export function colorPaletteForMaterial(
  materialLabel: string,
  finish?: AluminumFinish | null
): ColorPalette | null {
  const category = MATERIAL_LABEL_TO_CATEGORY[materialLabel];
  if (category === 'painted_steel') return 'mcelroy';
  if (category === 'aluminum') {
    if (finish === 'Painted') return 'pacclad';
    if (finish === 'Anodized') {
      // FUTURE-SWAP HOOK (afs-jf-002): AFS is waiting on the physical
      // PAC-CLAD anodized aluminum color chart (expected within days).
      // This branches on whether lib/data/metal-colors.ts's
      // pacclad_anodized array is actually populated, NOT on a hard-coded
      // "Anodized always means free text" rule — so the moment a future
      // prompt adds real { name, hex } entries to that array (mirroring
      // `pacclad`), this starts returning 'pacclad_anodized' automatically
      // and every one of the three wired surfaces (Quote Builder,
      // FlashDraft, Blueprint Takeoff AI) — all of which
      // render components/quote/FinishColorField.tsx rather than
      // reimplementing this branch themselves — switches from the
      // free-text input to a real ColorField/ColorPickerModal picker with
      // NO changes needed at any of those three call sites.
      return pacclad_anodized.length > 0 ? 'pacclad_anodized' : null;
    }
  }
  return null;
}

/**
 * Whether this material/finish/color combination is complete enough to
 * submit. Replaces the old `!colorPalette || color.trim() !== ''` check
 * (afs-cv-002) — that check silently passed for an Anodized aluminum item
 * with no color typed yet, because colorPaletteForMaterial legitimately
 * returns null for 'Anodized' (free-text mode, see above) even though a
 * color value IS still required in that case.
 */
export function isColorRequirementSatisfied(
  materialLabel: string,
  finish: AluminumFinish | null,
  color: string
): boolean {
  const category = MATERIAL_LABEL_TO_CATEGORY[materialLabel];
  if (category === 'painted_steel') return color.trim() !== '';
  if (category === 'aluminum') return finish != null && color.trim() !== '';
  return true;
}

/** User-facing message for when isColorRequirementSatisfied is false. */
export function colorRequirementErrorMessage(materialLabel: string, finish: AluminumFinish | null): string {
  const category = MATERIAL_LABEL_TO_CATEGORY[materialLabel];
  if (category === 'aluminum') {
    if (!finish) return 'Select a Finish (Anodized or Painted) before submitting.';
    if (finish === 'Painted') return 'Select a PAC-CLAD color before submitting.';
    return 'Specify an anodized color before submitting.';
  }
  // Only 'painted_steel' reaches here in practice — isColorRequirementSatisfied
  // is true for every other category, so callers never call this for one.
  return 'Select a McElroy color before submitting.';
}
