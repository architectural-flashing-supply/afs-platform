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

/**
 * HOW MANY CALENDAR DAYS FROM `from` TO `to`. Signed: a `to` before `from` is
 * negative.
 *
 * `Date.UTC` on both sides, so this is pure calendar arithmetic with no zone in
 * it — the strings already ARE the shop's dates, and re-interpreting either of
 * them in any other zone is how an off-by-one gets in (the same reason
 * `dayOfWeek` is built this way).
 */
export function calendarDaysBetween(from: DateOnly, to: DateOnly): number {
  if (!isDateOnly(from)) throw new Error(`not a date: ${from}`);
  if (!isDateOnly(to)) throw new Error(`not a date: ${to}`);
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY);
}

/**
 * BUSINESS DAYS BETWEEN TWO DATES — the half-open interval `(from, to]`.
 *
 * "How much notice did the customer actually give us" is this question, and it
 * has to be measured in business days for the same reason `nextBusinessDay`
 * skips the weekend: the shop does not fabricate on a Saturday, so two
 * calendar days over a weekend is nought working days of notice.
 *
 * The interval EXCLUDES `from` and INCLUDES `to`, so:
 *   Monday   -> Tuesday          1   (one working day of notice)
 *   Friday   -> Monday           1   (the weekend is not notice)
 *   Friday   -> Saturday         0
 *   Monday   -> the same Monday  0
 *   Monday   -> the next Monday  5
 * A `to` earlier than `from` is the negation, so a date already in the past
 * reads as negative notice rather than as a large positive number.
 *
 * WHY IT IS NOT A LOOP OVER EVERY DAY. A customer can type any date into a
 * `<input type="date">`, including the year 9999, and a day-by-day walk would
 * then run about three million iterations inside a page render. Whole weeks
 * contribute exactly five business days each, so only the remainder — at most
 * six days — is ever checked one at a time.
 */
export function businessDaysBetween(from: DateOnly, to: DateOnly): number {
  const totalDays = calendarDaysBetween(from, to);
  if (totalDays === 0) return 0;
  if (totalDays < 0) return -businessDaysBetween(to, from);

  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * 5;
  const remainder = totalDays % 7;
  for (let i = 1; i <= remainder; i++) {
    if (isBusinessDay(addDays(from, fullWeeks * 7 + i))) count++;
  }
  return count;
}

/**
 * The upper bound on `addBusinessDays`. Ten years of working days is far past
 * anything a lead time could legitimately be (`rush_policies` caps a minimum
 * lead time at 365 days in the database), and it is here so a corrupt or
 * hostile number cannot turn one date calculation into an unbounded loop.
 */
const MAX_BUSINESS_DAYS_TO_ADD = 3650;

/**
 * `n` BUSINESS DAYS STRICTLY AFTER `from`.
 *
 * `addBusinessDays(d, 0)` is `d` itself, unchanged even when `d` is a Saturday:
 * zero business days later than a date is that date, and quietly rolling it
 * forward would be a different question's answer.
 *
 * This is the inverse of `businessDaysBetween` on its own interval — so
 * `businessDaysBetween(d, addBusinessDays(d, n)) === n` for every `n >= 0`,
 * which is asserted rather than assumed.
 */
export function addBusinessDays(from: DateOnly, n: number): DateOnly {
  if (!isDateOnly(from)) throw new Error(`not a date: ${from}`);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`a number of business days must be a whole number, zero or more, not ${n}`);
  }
  if (n > MAX_BUSINESS_DAYS_TO_ADD) {
    throw new Error(`${n} business days is past the ${MAX_BUSINESS_DAYS_TO_ADD}-day bound this function will walk`);
  }
  let day = from;
  for (let i = 0; i < n; i++) day = nextBusinessDay(day);
  return day;
}
