/**
 * "How long it has been waiting" — the phrase every Workbench card carries.
 *
 * Pure, so it can be unit-tested exhaustively and so the server and the
 * client can never disagree about what a card says. It takes `now` as an
 * argument rather than reading the clock, for the same reason.
 *
 * The vocabulary is the approved prototype's own: "2 hours ago",
 * "5 hours ago", "yesterday", "4 days ago". Plain English for a
 * non-technical reader — no "2h", no ISO timestamps, no "1 days".
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * A human phrase for how long ago `at` was, relative to `now`.
 *
 * Returns null when `at` is missing — a caller must decide what to say when a
 * job has no clock, rather than being handed an invented one.
 */
export function waitingPhrase(at: string | Date | null | undefined, now: Date): string | null {
  if (!at) return null;
  const then = at instanceof Date ? at : new Date(at);
  const ms = then.getTime();
  if (!Number.isFinite(ms)) return null;

  const delta = now.getTime() - ms;

  // A clock a little ahead of the server is ordinary, not an error. Anything
  // in the future reads as "just now" rather than "in -3 minutes".
  if (delta < MINUTE_MS) return 'just now';
  if (delta < HOUR_MS) {
    const minutes = Math.floor(delta / MINUTE_MS);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (delta < DAY_MS) {
    const hours = Math.floor(delta / HOUR_MS);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(delta / DAY_MS);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Whole days between `at` and `now`. -1 when there is no usable date. */
export function daysSince(at: string | Date | null | undefined, now: Date): number {
  if (!at) return -1;
  const then = at instanceof Date ? at : new Date(at);
  const ms = then.getTime();
  if (!Number.isFinite(ms)) return -1;
  return Math.floor((now.getTime() - ms) / DAY_MS);
}

/**
 * Time-of-day greeting for the summary line above the lanes.
 *
 * DELIBERATE DEVIATION FROM THE PROTOTYPE, recorded here rather than left to
 * be discovered: the prototype hardcodes the string "Good morning, Steve."
 * because it is a static mock. A real screen that says "Good morning" at 4pm
 * reads as broken to the non-technical reader this whole build is for, so the
 * greeting follows the clock. The morning wording is the prototype's,
 * unchanged.
 *
 * SHOP TIME, NOT SERVER TIME. Vercel runs in UTC, so reading the server's own
 * hours would greet a Texas morning as afternoon. The shop is in Burnet, TX.
 */
export const SHOP_TIME_ZONE = 'America/Chicago';

export function greetingFor(now: Date, timeZone: string = SHOP_TIME_ZONE): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(now)
  );
  // Intl can render midnight as "24" in the hour12:false + hourCycle h24 case.
  const h = hour === 24 ? 0 : hour;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
