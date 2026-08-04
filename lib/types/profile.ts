// Shared hem-related types for flashing profiles — extracted out of
// app/studio/draft/page.tsx (FlashDraft) so the Photo-to-Quote flow (see
// specs/SPEC_PHOTO_TO_QUOTE_AI.md, not yet built) can adopt the same
// HemType/Hem/LegHem convention instead of redefining it.

export type HemType = 'open' | 'smashed' | 'teardrop';

export interface Hem {
  type: HemType;
  gapIn: number;
}

// A hem created by click-dragging on any leg (as opposed to a profile's
// two absolute-endpoint hems). legIndex i means the leg from points[i] to
// points[i+1] in the caller's own point array.
export interface LegHem {
  legIndex: number;
  distanceFromStartIn: number;
  lengthIn: number;
  type: HemType;
  gapIn: number;
}

export const HEM_FOLD_DEPTH_IN = 0.375;
export const HEM_DEFAULT_GAP_IN = 0.1875; // 3/16"

// Approximate extra blank-width consumed by a hem fold at one endpoint — a
// visual/quoting simplification (fold depth is a fixed visual constant, not
// a real fabrication bend-deduction calculation), not fabrication-precise.
export function hemAllowanceIn(hem: Hem | null | undefined, thicknessIn: number): number {
  if (!hem) return 0;
  if (hem.type === 'smashed') return 2 * HEM_FOLD_DEPTH_IN;
  if (hem.type === 'teardrop') return 2 * HEM_FOLD_DEPTH_IN + Math.PI * (thicknessIn / 2);
  return 2 * HEM_FOLD_DEPTH_IN + hem.gapIn;
}

// Same idea as hemAllowanceIn, for a leg hem — its fold length is the
// user's actual drag distance (lengthIn) rather than the fixed
// HEM_FOLD_DEPTH_IN visual constant hemStart/hemEnd use.
export function legHemAllowanceIn(hem: LegHem, thicknessIn: number): number {
  if (hem.type === 'smashed') return 2 * hem.lengthIn;
  if (hem.type === 'teardrop') return 2 * hem.lengthIn + Math.PI * (thicknessIn / 2);
  return 2 * hem.lengthIn + hem.gapIn;
}

export function sumLegHemAllowanceIn(hems: LegHem[], thicknessIn: number): number {
  return hems.reduce((sum, h) => sum + legHemAllowanceIn(h, thicknessIn), 0);
}
