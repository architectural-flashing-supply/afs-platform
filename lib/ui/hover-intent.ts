/**
 * HOVER INTENT, with a grace period — the little state machine behind the
 * Search rail's enlarged preview (Command Center V2 prompt v2-05).
 *
 * TWO DELAYS, AND THEY DO DIFFERENT JOBS.
 *
 *   OPEN (150 ms)   Sweeping the pointer down a vertical rail of twenty
 *                   thumbnails crosses every one of them. Opening on the
 *                   first pixel of contact would fire twenty previews for a
 *                   gesture that meant none of them. The pointer has to
 *                   settle before anything happens.
 *
 *   GRACE (300 ms)  The preview is a panel BESIDE the rail carrying a Select
 *                   button, so the pointer has to travel off the thumbnail
 *                   and across a gap to reach it. Closing the instant the
 *                   pointer leaves the thumbnail would make Select
 *                   unclickable — the panel would vanish out from under the
 *                   cursor mid-journey. This is the "pointer-safe corridor":
 *                   not a geometric corridor, a temporal one. Entering the
 *                   preview cancels the close outright, so a slow traveller
 *                   is fine too — the 300 ms only has to cover the gap, not
 *                   the whole decision.
 *
 * THERE IS NO CLOSE BUTTON, by design, which is exactly why the close rules
 * have to be this careful: the preview's only ways out are moving the
 * pointer away and leaving it away, pressing Escape, or choosing something
 * else. If any of those were unreliable the panel would feel stuck.
 *
 * KEYBOARD AND TOUCH DO NOT WAIT. `openNow` exists because neither has a
 * hover state to express intent with: an arrow key IS the intent, and a tap
 * IS the intent. Making them sit through 150 ms of nothing would be a delay
 * with no ambiguity to resolve. Same at the other end — `closeNow` for
 * Escape, no grace.
 *
 * The timers are INJECTABLE so the unit test can drive them deterministically
 * (see hover-intent.test.ts) rather than sleeping, which is what makes "the
 * grace period really does let the pointer reach the preview" an assertion
 * instead of a hope.
 */

/** Pointer settles for this long on a thumbnail before its preview opens. */
export const HOVER_OPEN_DELAY_MS = 150;

/** The pointer has this long to travel from the thumbnail onto the preview. */
export const HOVER_GRACE_DELAY_MS = 300;

type TimerHandle = ReturnType<typeof setTimeout>;

export interface HoverIntentOptions {
  onOpen: (id: string) => void;
  onClose: () => void;
  openMs?: number;
  graceMs?: number;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}

export interface HoverIntent {
  /** Pointer entered a rail thumbnail. Opens after the open delay. */
  pointerEnterItem(id: string): void;
  /** Pointer left a rail thumbnail. Closes after the grace delay. */
  pointerLeaveItem(): void;
  /** Pointer reached the preview. Cancels the pending close. */
  pointerEnterPreview(): void;
  /** Pointer left the preview. Closes after the grace delay. */
  pointerLeavePreview(): void;
  /** Keyboard or touch: open immediately, no intent delay. */
  openNow(id: string): void;
  /** Escape, or a selection: close immediately, no grace. */
  closeNow(): void;
  /** Drop any pending timer without changing what is open. */
  cancelPending(): void;
  /** Teardown — clears timers and closes. */
  dispose(): void;
  openId(): string | null;
}

export function createHoverIntent(options: HoverIntentOptions): HoverIntent {
  const openMs = options.openMs ?? HOVER_OPEN_DELAY_MS;
  const graceMs = options.graceMs ?? HOVER_GRACE_DELAY_MS;
  const set = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clear = options.clearTimer ?? ((h) => clearTimeout(h));

  let timer: TimerHandle | null = null;
  let open: string | null = null;

  function cancelPending(): void {
    if (timer !== null) {
      clear(timer);
      timer = null;
    }
  }

  function openNow(id: string): void {
    cancelPending();
    if (open === id) return;
    open = id;
    options.onOpen(id);
  }

  function closeNow(): void {
    cancelPending();
    if (open === null) return;
    open = null;
    options.onClose();
  }

  return {
    pointerEnterItem(id: string): void {
      cancelPending();
      // Already showing something: SWAP ON MOVE. The intent was established
      // when the first preview opened; making the user re-earn it for every
      // neighbouring thumbnail would make the rail feel sticky.
      if (open !== null) {
        openNow(id);
        return;
      }
      timer = set(() => {
        timer = null;
        openNow(id);
      }, openMs);
    },

    pointerLeaveItem(): void {
      cancelPending();
      // Nothing open yet means the pointer was only passing through — drop
      // the pending open and leave the screen alone.
      if (open === null) return;
      timer = set(() => {
        timer = null;
        closeNow();
      }, graceMs);
    },

    pointerEnterPreview(): void {
      // The pointer made the journey. Cancel the close outright — not
      // restart it — so reading the preview or reaching for Select is
      // never on a clock.
      cancelPending();
    },

    pointerLeavePreview(): void {
      cancelPending();
      if (open === null) return;
      timer = set(() => {
        timer = null;
        closeNow();
      }, graceMs);
    },

    openNow,
    closeNow,
    cancelPending,

    dispose(): void {
      cancelPending();
      open = null;
    },

    openId(): string | null {
      return open;
    },
  };
}
