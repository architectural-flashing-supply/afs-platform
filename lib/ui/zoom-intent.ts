/**
 * THE DRAWING-ZOOM GESTURE'S TIMING — one number, in one place.
 *
 * The V8 contract (docs/design/command-center-v8/) opens the enlarged view on a
 * SINGLE click and the full-size view on a DOUBLE click, from the same element.
 * Those two gestures overlap: a double-click fires `click` twice before
 * `dblclick`. So the enlarge is SCHEDULED rather than performed, and the
 * double-click cancels it.
 *
 *     tm = setTimeout(() => openPop(k), 230);   // the contract's own line
 *
 * Without the delay, a double-click opens BOTH — the enlarged view, then the
 * full-size view on top of it — and the user's one intent reads as two.
 *
 * WHY IT IS NOT INLINED IN THE COMPONENT. `lib/ui/hover-intent.ts` already
 * exists for the same reason on the profile-search rail (CLAUDE.md rule #27:
 * "do not inline the timers"), and the number is asserted equal to the frozen
 * contract's by lib/ui/zoom-intent.test.ts. A copy in a component is a copy
 * that can drift from the design it was taken from, silently, because 180 ms
 * and 230 ms look the same in a screenshot and feel different in the hand.
 *
 * KEYBOARD AND TOUCH BYPASS IT, same as hover-intent: a key press IS the
 * intent, so Enter opens the enlarged view immediately and there is nothing to
 * schedule.
 */
export const ZOOM_OPEN_DELAY_MS = 230;
