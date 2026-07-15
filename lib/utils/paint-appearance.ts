import { FINISHES } from '@/lib/data/catalog';

// Shared by every FlashDraft 3D-viewer modal that needs to know whether a
// material gets the painted-side confirmation flow, and what color
// approximates its finish — SubmitConfirmation3DModal (the submit flow) and
// MatchedProfile3DModal (viewing a matched library profile).
export type PaintFace = 'up' | 'down';

const PAINTED_MATERIAL_PATTERN = /kynar|painted|vintage/i;

// Mirrors ProfileViewer3D's default galvanized-steel appearance — the
// "opposite face renders as bare metal" default color for the split view.
export const BARE_METAL_COLOR = '#B8C4CC';
export const ROTATE_SPEED = 6; // one full 360° orbit in ROTATE_DURATION_MS at 60fps
export const ROTATE_DURATION_MS = 10000;

export function isPaintedMaterial(material: string): boolean {
  return PAINTED_MATERIAL_PATTERN.test(material);
}

export function approxPaintColor(material: string): string {
  if (/vintage/i.test(material)) return '#7A6B5A';
  const kynarFinish = FINISHES.find((f) => /kynar/i.test(f.name));
  return kynarFinish?.hex ?? '#5B6470';
}
