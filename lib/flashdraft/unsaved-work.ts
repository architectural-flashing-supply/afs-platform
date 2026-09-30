/**
 * "IS THERE UNSAVED WORK ON THE CANVAS?" — the one question Search has to
 * answer correctly before it loads somebody else's profile over the top of
 * yours (Command Center V2 prompt v2-05).
 *
 * Selecting a profile from Search replaces what is on the FlashDraft canvas.
 * Unsaved work is therefore auto-saved to the Passport FIRST, and never
 * silently discarded. That promise is only as good as this predicate: say
 * "no unsaved work" when there is some and the drawing is gone; say "yes"
 * on every Select and every pick writes a junk duplicate row.
 *
 * WHY A SIGNATURE AND NOT A DIRTY FLAG. A boolean set by every mutating
 * handler has to be reset by every saving path and cleared by every loading
 * path, in a 4,500-line component — one missed reset and the answer is
 * wrong in whichever direction hurts. Comparing the geometry against what
 * was last written is stateless: it cannot drift, because it re-derives the
 * answer from the thing it is actually about.
 *
 * WHY NOT `geometryFingerprint`. That hash (lib/flashdraft/
 * geometry-fingerprint.ts) is deliberately orientation-INDEPENDENT so that
 * the same shape drawn backwards, mirrored or rotated collapses to one
 * value — exactly right for "same shape used 3x", and exactly wrong here,
 * where dragging the whole profile across the canvas IS a change the user
 * would be upset to lose. This one is a literal, ordered transcription.
 *
 * Coordinates are rounded to 1/10,000 inch before comparison: floating-point
 * re-serialisation noise is not an edit, and the shop cannot bend to a
 * ten-thousandth anyway.
 */

export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureHem {
  type: string;
  lengthIn: number;
  gapIn: number;
  kick: string;
}

export interface CanvasState {
  points: SignaturePoint[];
  hemStart: SignatureHem | null;
  hemEnd: SignatureHem | null;
}

/** 1/10,000 inch. Below that is float noise, not a change anyone made. */
const PLACES = 4;

function n(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(PLACES);
}

function hem(h: SignatureHem | null): string {
  if (!h) return '-';
  return `${h.type}:${n(h.lengthIn)}:${n(h.gapIn)}:${h.kick}`;
}

/**
 * An exact, ordered transcription of what is on the canvas. Equal strings
 * mean equal drawings; any real edit — a moved point, a changed hem gap, a
 * reversed draw order — changes it.
 */
export function canvasSignature(state: CanvasState): string {
  const pts = state.points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ');
  return `${pts}|${hem(state.hemStart)}|${hem(state.hemEnd)}`;
}

/**
 * Should Select auto-save before it loads something else?
 *
 * `lastSavedSignature` is null until this session has written the drawing
 * somewhere — so a drawing that has never been saved always counts as
 * unsaved, which is the safe direction to be wrong in.
 *
 * FEWER THAN TWO POINTS IS NOT WORK. A single click leaves one point on the
 * canvas and no profile; saving that would put an empty row in the Passport
 * and would teach the user that Select creates litter. Two points is the
 * first thing that is a profile at all (one leg), and it is also FlashDraft's
 * own threshold for saving or submitting anything.
 */
export function hasUnsavedCanvasWork(
  state: CanvasState,
  lastSavedSignature: string | null
): boolean {
  if (state.points.length < 2) return false;
  if (lastSavedSignature === null) return true;
  return canvasSignature(state) !== lastSavedSignature;
}
