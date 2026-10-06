/**
 * THE DOUBLE-RIGHT-CLICK, AS A PURE FUNCTION.
 *
 * Steve places a shop note by right-clicking twice. "Twice" has to mean
 * something exact or it means two different things on two different days: two
 * clicks 390ms apart must place a note and two 410ms apart must not, and a
 * right-click that slid 12px across the canvas while the hand moved is two
 * separate right-clicks, not a double.
 *
 * That rule is four lines of arithmetic and it is impossible to verify by
 * clicking. It is here, pure, with a test, and the canvas keeps nothing but a
 * ref holding the last click.
 *
 * WHAT A SINGLE RIGHT-CLICK DOES: exactly what it does today, which on this
 * canvas is nothing. `app/studio/draft/page.tsx`'s <canvas> has carried
 * `onContextMenu={(e) => e.preventDefault()}` since long before this feature,
 * for every visitor, and `handlePointerDown` returns immediately on
 * `e.button !== 0`. So the native menu was already suppressed on the canvas
 * (and only on the canvas) and a right-click already did nothing at all. This
 * feature adds a second right-click as a meaning; it takes nothing away, and it
 * deliberately does NOT make that existing preventDefault conditional, which
 * would be a change to customer-facing behaviour.
 */

/** Reid's numbers, named so a test asserts them rather than re-deriving them. */
export const DOUBLE_RIGHT_CLICK_MS = 400;
export const DOUBLE_RIGHT_CLICK_PX = 8;

export interface RightClickMark {
  /** Canvas-relative CSS pixels. Screen space is correct here: this is a HAND, not a drawing. */
  x: number;
  y: number;
  /** `event.timeStamp`, or `performance.now()`. Milliseconds. */
  at: number;
}

/**
 * Is `mark` the second half of a double right-click that began at `previous`?
 *
 * `null` previous (the first ever click, or the one after a successful
 * placement) is always false — a double needs two.
 */
export function isDoubleRightClick(
  previous: RightClickMark | null,
  mark: RightClickMark,
  windowMs: number = DOUBLE_RIGHT_CLICK_MS,
  radiusPx: number = DOUBLE_RIGHT_CLICK_PX
): boolean {
  if (!previous) return false;
  const dt = mark.at - previous.at;
  // A non-monotonic timestamp (a clock change, a synthesised event) is not a
  // double. `dt < 0` must fail rather than pass by the magic of comparing a
  // negative number against a positive bound.
  if (dt < 0 || dt > windowMs) return false;
  return Math.hypot(mark.x - previous.x, mark.y - previous.y) <= radiusPx;
}

/**
 * The whole gesture as one step, so the canvas holds one ref and no logic.
 *
 * Returns the mark to remember next, and whether to place. After a placement
 * the memory is CLEARED — three right-clicks in a row place one note, not two.
 * A third click 200ms after the second would otherwise pair with it and drop a
 * second arrow on top of the first.
 */
export function stepRightClick(
  previous: RightClickMark | null,
  mark: RightClickMark,
  windowMs: number = DOUBLE_RIGHT_CLICK_MS,
  radiusPx: number = DOUBLE_RIGHT_CLICK_PX
): { place: boolean; next: RightClickMark | null } {
  if (isDoubleRightClick(previous, mark, windowMs, radiusPx)) {
    return { place: true, next: null };
  }
  return { place: false, next: mark };
}
