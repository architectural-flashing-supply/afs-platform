// Shared hem-related types for flashing profiles — extracted out of
// app/studio/draft/page.tsx (FlashDraft) so the Photo-to-Quote flow (see
// specs/SPEC_PHOTO_TO_QUOTE_AI.md, not yet built) can adopt the same
// HemType/Hem convention instead of redefining it.
//
// Mid-leg hems (created by click-dragging on a leg body) were removed
// entirely — confirmed geometrically impossible to fabricate. Only the
// two profile-endpoint hems (hemStart/hemEnd, this file's Hem type)
// remain.

export type HemType = 'open' | 'smashed' | 'teardrop';

// 'outside' folds toward the profile's outside/convex face (existing visual
// behavior, unchanged); 'inside' mirrors the fold to the opposite side of
// the leg's own line. See app/studio/draft/page.tsx's renderHemAt and
// lib/flashdraft/hem-glyph.ts's drawHemGlyph `mirror` param for how this is
// applied as a true perpendicular mirror of the glyph construction.
export type HemKick = 'inside' | 'outside';

export interface Hem {
  type: HemType;
  gapIn: number;
  lengthIn: number;
  kick: HemKick;
}

// Default fold-back length for a newly created Hem — each Hem instance then
// carries its own lengthIn (editable per hem), rather than every hem sharing
// this one fixed depth.
export const HEM_DEFAULT_LENGTH_IN = 0.5;
// Gap is a per-hem editable value (reversed from an earlier "fixed shop
// constant" decision) — each Hem instance carries its own gapIn, and these
// are only the starting defaults for a newly created hem, picked per
// hem.type since Open and Smashed read as visually identical at a shared
// default (confirmed live by Reid).
export const HEM_DEFAULT_GAP_IN_OPEN = 0.1875; // 3/16"
export const HEM_DEFAULT_GAP_IN_SMASHED = 0.03125; // 1/32", nearly flush
// Matches current/prior visual behavior — new hems fold to the outside by default.
export const HEM_DEFAULT_KICK: HemKick = 'outside';

// Approximate extra blank-width consumed by a hem fold at one endpoint,
// using the hem's own fold-back length — a visual/quoting simplification,
// not a real fabrication bend-deduction calculation.
export function hemAllowanceIn(hem: Hem | null | undefined, thicknessIn: number): number {
  if (!hem) return 0;
  if (hem.type === 'smashed') return 2 * hem.lengthIn;
  if (hem.type === 'teardrop') return 2 * hem.lengthIn + Math.PI * (thicknessIn / 2);
  return 2 * hem.lengthIn + hem.gapIn;
}
