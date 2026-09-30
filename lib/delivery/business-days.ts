/**
 * BUSINESS DAYS, IN THE SHOP'S OWN TIME ZONE.
 *
 * Command Center V2 prompt v2-04. "Mark finished auto-schedules the delivery
 * for the next business day" is one sentence with two ways to get it wrong,
 * and this module exists so both are wrong in exactly one place:
 *
 * 1. THE WEEKEND. Friday's next business day is MONDAY, not Saturday. So is
 *    Saturday's and Sunday's. A naive `+1 day` books a delivery for a day
 *    nobody is driving, and the customer finds out by nobody turning up.
 *
 * 2. THE TIME ZONE. Vercel runs this in UTC. The shop is in Burnet, Texas.
 *    A job finished at 7pm Central on Friday is already Saturday 01:00 UTC,
 *    so "tomorrow" computed from the server clock would be Sunday — and then
 *    the weekend skip would move it to Monday and nobody would notice the
 *    bug, because Monday is also the right answer. The bug only shows up on
 *    a Tuesday evening, as a delivery booked for Thursday. Every date here is
 *    therefore derived in SHOP_TIME_ZONE (lib/utils/waiting-time.ts, already
 *    this codebase's one shop clock), never from the raw Date parts.
 *
 * Dates are handled as plain `YYYY-MM-DD` strings, matching
 * `deliveries.scheduled_date`'s `date` type. A date-only value has no instant
 * and no offset; keeping it a string is what stops one creeping in.
 *
 * NOT MODELLED, ON PURPOSE: holidays. AFS has given no holiday calendar (see
 * CLAUDE.md's DATA BLOCKERS), and inventing one would put Thanksgiving in the
 * code as a guess. Weekends are a fact; a holiday list is data that has not
 * arrived. An auto-scheduled delivery is always reschedulable by hand from the
 * Deliveries screen, which is where a holiday gets handled today.
 */
import { SHOP_TIME_ZONE } from '@/lib/utils/waiting-time';

/** A date with no time: `YYYY-MM-DD`, exactly as Postgres `date` renders it. */
export type DateOnly = string;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return false;
  // Rejects 2026-02-31: round-tripping a real calendar date is unchanged.
  const [y, m, d] = value.split('-').map(Number);
  const asUtc = new Date(Date.UTC(y, m - 1, d));
  return (
    asUtc.getUTCFullYear() === y && asUtc.getUTCMonth() === m - 1 && asUtc.getUTCDate() === d
  );
}

/**
 * The calendar date an instant falls on IN THE SHOP'S TIME ZONE.
 *
 * `en-CA` is used because its short date format is already `YYYY-MM-DD`; this
 * is a formatting trick, not a locale choice, and it is the reason this
 * function needs no date arithmetic at all.
 */
export function shopDateOnly(instant: Date, timeZone: string = SHOP_TIME_ZONE): DateOnly {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * The day of the week for a date-only value. 0 = Sunday … 6 = Saturday.
 *
 * Built from `Date.UTC` so it is pure calendar arithmetic with no zone in it:
 * the string already IS the shop's date, so re-interpreting it in any zone is
 * how an off-by-one gets in.
 */
export function dayOfWeek(date: DateOnly): number {
  if (!isDateOnly(date)) throw new Error(`not a date: ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday to Friday. */
export function isBusinessDay(date: DateOnly): boolean {
  const dow = dayOfWeek(date);
  return dow >= 1 && dow <= 5;
}

/** `date` plus `days` calendar days, still date-only. */
export function addDays(date: DateOnly, days: number): DateOnly {
  if (!isDateOnly(date)) throw new Error(`not a date: ${date}`);
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/**
 * The next business day STRICTLY AFTER `date`.
 *
 * Friday -> Monday. Saturday -> Monday. Sunday -> Monday. Thursday -> Friday.
 * Strictly after, because this answers "when does it go out" for work that has
 * just been finished — a job finished at 4pm is not going out at 8am the same
 * morning.
 */
export function nextBusinessDay(date: DateOnly): DateOnly {
  let next = addDays(date, 1);
  while (!isBusinessDay(next)) next = addDays(next, 1);
  return next;
}

/**
 * The next business day ON OR AFTER `date`.
 *
 * Used to lay out the Deliveries week, which starts today when today is a
 * working day rather than skipping straight past it.
 */
export function businessDayOnOrAfter(date: DateOnly): DateOnly {
  let day = date;
  while (!isBusinessDay(day)) day = addDays(day, 1);
  return day;
}

/** `count` consecutive business days, starting at the first one on or after `from`. */
export function businessDaysFrom(from: DateOnly, count: number): DateOnly[] {
  const days: DateOnly[] = [];
  let day = businessDayOnOrAfter(from);
  for (let i = 0; i < count; i++) {
    days.push(day);
    day = nextBusinessDay(day);
  }
  return days;
}

/**
 * "Fri, Oct 2" — the heading the approved prototype puts on a day column.
 *
 * Formatted in UTC from a date-only string on purpose: the string carries no
 * time, so asking any other zone to render it is how "Oct 2" becomes "Oct 1".
 */
export function formatDayHeading(date: DateOnly): string {
  if (!isDateOnly(date)) return 'Not scheduled yet';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
