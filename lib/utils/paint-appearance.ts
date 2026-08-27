import { FINISHES } from '@/lib/data/catalog';
import { findMetalColorByName } from '@/lib/data/metal-colors';
import { materialRequiresColorValue } from '@/lib/data/material-color-requirement';

// Shared by every FlashDraft 3D-viewer modal that needs to know whether a
// material gets the painted-side confirmation flow, and what color
// approximates its finish — SubmitConfirmation3DModal (the submit flow) and
// MatchedProfile3DModal (viewing a matched library profile).
export type PaintFace = 'up' | 'down';

// Mirrors ProfileViewer3D's default galvanized-steel appearance — the
// "opposite face renders as bare metal" default color for the split view.
export const BARE_METAL_COLOR = '#B8C4CC';
export const ROTATE_SPEED = 6; // one full 360° orbit in ROTATE_DURATION_MS at 60fps
export const ROTATE_DURATION_MS = 10000;

// Fallback swatch for a free-text / unmatched color name (afs-fl-013) —
// reuses catalog.ts's own 'Custom Color Match' placeholder rather than a
// second hardcoded hex. Matching a free-text name to a real color is out of
// scope here; this is the accepted "no real hex" fallback.
const CUSTOM_COLOR_MATCH_HEX = FINISHES.find((f) => f.name === 'Custom Color Match')?.hex ?? '#C0001A';

// A material needs the paint-face confirmation flow exactly when it needs a
// painted/coated color selection at all — derives from the same
// painted_steel/aluminum category logic app/studio/draft/page.tsx already
// uses (isAluminum, colorPalette) via materialRequiresColorValue, instead of
// a separate regex that could drift out of sync. Anodized aluminum is a
// coating on one face just like Kynar, so it's included via the 'aluminum'
// category regardless of which Finish (Anodized/Painted) was chosen.
export function isPaintedMaterial(material: string): boolean {
  return materialRequiresColorValue(material);
}

// Resolves the customer's ACTUAL selected color/finish name to its real
// display hex, across whichever chart it came from — McElroy for
// painted_steel, PAC-CLAD Anodized for Anodized aluminum — using the same
// colorMatch-by-name lookup components/admin/ShopViewBoard.tsx already uses
// for row.color. Falls back to the Custom Color Match placeholder for a
// free-text or unmatched name rather than a generic material-based guess.
export function resolveSelectedPaintColor(material: string, color: string): string {
  if (!isPaintedMaterial(material)) return BARE_METAL_COLOR;
  return findMetalColorByName(color)?.hex ?? CUSTOM_COLOR_MATCH_HEX;
}
