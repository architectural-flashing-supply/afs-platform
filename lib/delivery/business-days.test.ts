import { describe, it, expect } from 'vitest';
import {
  addBusinessDays,
  addDays,
  businessDayOnOrAfter,
  businessDaysBetween,
  businessDaysFrom,
  calendarDaysBetween,
  dayOfWeek,
  formatDayHeading,
  isBusinessDay,
  isDateOnly,
  nextBusinessDay,
  shopDateOnly,
} from './business-days';
import { DEFAULT_DELIVERY_WINDOW, DELIVERY_WINDOW_KEYS, deliveryWindowLabel, isDeliveryWindow } from './windows';
import { trackingUrlFor } from './tracking-url';

/**
 * "Mark finished auto-schedules the delivery for the NEXT BUSINESS DAY."
 *
 * The weekend skip and the time zone are the two ways that sentence gets
 * implemented wrongly, and both are asserted here rather than left to a
 * comment. The Friday case is the one that matters most — it is the one a
 * naive `+1 day` gets wrong every single week.
 */

describe('nextBusinessDay skips the weekend', () => {
  // 2026-10-02 is a Friday; 2026-10-03 Saturday; 2026-10-04 Sunday;
  // 2026-10-05 Monday. Verified by dayOfWeek below rather than asserted.
  it('knows which days of the week these dates are', () => {
    expect(dayOfWeek('2026-10-01')).toBe(4); // Thursday
    expect(dayOfWeek('2026-10-02')).toBe(5); // Friday
    expect(dayOfWeek('2026-10-03')).toBe(6); // Saturday
    expect(dayOfWeek('2026-10-04')).toBe(0); // Sunday
    expect(dayOfWeek('2026-10-05')).toBe(1); // Monday
  });

  it('FRIDAY -> MONDAY, not Saturday', () => {
    expect(nextBusinessDay('2026-10-02')).toBe('2026-10-05');
  });

  it('Saturday -> Monday', () => {
    expect(nextBusinessDay('2026-10-03')).toBe('2026-10-05');
  });

  it('Sunday -> Monday', () => {
    expect(nextBusinessDay('2026-10-04')).toBe('2026-10-05');
  });

  it('Thursday -> Friday, and Monday -> Tuesday', () => {
    expect(nextBusinessDay('2026-10-01')).toBe('2026-10-02');
    expect(nextBusinessDay('2026-10-05')).toBe('2026-10-06');
  });

  it('is strictly after: a job finished today never goes out today', () => {
    expect(nextBusinessDay('2026-10-01')).not.toBe('2026-10-01');
  });

  it('crosses a month boundary and a leap day without special-casing either', () => {
    // 2026-11-30 is a Monday, so December starts on a Tuesday.
    expect(nextBusinessDay('2026-11-30')).toBe('2026-12-01');
    // 2028 is a leap year; 2028-02-28 is a Monday, 2028-02-29 a Tuesday.
    expect(nextBusinessDay('2028-02-28')).toBe('2028-02-29');
    expect(isDateOnly('2028-02-29')).toBe(true);
    expect(isDateOnly('2027-02-29')).toBe(false);
  });
});

describe('isBusinessDay', () => {
  it('is Monday to Friday and nothing else', () => {
    expect(isBusinessDay('2026-10-05')).toBe(true); // Mon
    expect(isBusinessDay('2026-10-09')).toBe(true); // Fri
    expect(isBusinessDay('2026-10-10')).toBe(false); // Sat
    expect(isBusinessDay('2026-10-11')).toBe(false); // Sun
  });
});

describe('businessDayOnOrAfter and businessDaysFrom', () => {
  it('on-or-after keeps a weekday where it is', () => {
    expect(businessDayOnOrAfter('2026-10-01')).toBe('2026-10-01');
  });
  it('on-or-after moves a weekend forward to Monday', () => {
    expect(businessDayOnOrAfter('2026-10-03')).toBe('2026-10-05');
  });
  it('the five-day week jumps the weekend in the middle', () => {
    // Starting Thursday: Thu, Fri, then Mon/Tue/Wed — never Sat or Sun.
    expect(businessDaysFrom('2026-10-01', 5)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
  });
  it('every day it produces is a business day, for a whole year of start dates', () => {
    let day = '2026-01-01';
    for (let i = 0; i < 365; i++) {
      for (const d of businessDaysFrom(day, 5)) expect(isBusinessDay(d)).toBe(true);
      day = addDays(day, 1);
    }
  });
});

describe('the shop clock, not the server clock', () => {
  /**
   * The bug this prevents: Vercel runs in UTC, the shop is in Central. At
   * 19:00 Central on Tuesday it is already 00:00 UTC Wednesday, so a "next
   * business day" taken from the raw server date would book Thursday.
   */
  it('a Tuesday evening in Texas is still Tuesday', () => {
    // 2026-10-06 is a Tuesday. 19:30 CDT = 00:30 UTC on the 7th.
    const instant = new Date('2026-10-07T00:30:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-10-07'); // the trap
    expect(shopDateOnly(instant)).toBe('2026-10-06'); // the truth
    expect(nextBusinessDay(shopDateOnly(instant))).toBe('2026-10-07');
  });

  it('a Friday evening in Texas still lands on Monday', () => {
    // 2026-10-02 is a Friday. 20:00 CDT = 01:00 UTC Saturday.
    const instant = new Date('2026-10-03T01:00:00Z');
    expect(shopDateOnly(instant)).toBe('2026-10-02');
    expect(nextBusinessDay(shopDateOnly(instant))).toBe('2026-10-05');
  });

  it('a morning in Texas is the same day either way', () => {
    expect(shopDateOnly(new Date('2026-10-06T14:00:00Z'))).toBe('2026-10-06');
  });
});

describe('formatDayHeading', () => {
  it('reads like the prototype: "Fri, Oct 2"', () => {
    expect(formatDayHeading('2026-10-02')).toBe('Fri, Oct 2');
    expect(formatDayHeading('2026-10-05')).toBe('Mon, Oct 5');
  });
  it('never shifts the date by a zone', () => {
    // The classic off-by-one: parsing '2026-01-01' as UTC midnight and
    // rendering it in a negative-offset zone gives Dec 31.
    expect(formatDayHeading('2026-01-01')).toBe('Thu, Jan 1');
  });
  it('says so plainly when there is no date', () => {
    expect(formatDayHeading('not a date')).toBe('Not scheduled yet');
  });
});

describe('the four delivery windows', () => {
  it('are exactly the four the approved prototype offers, in day order', () => {
    expect(DELIVERY_WINDOW_KEYS.map(deliveryWindowLabel)).toEqual([
      '8–10 AM',
      '10 AM–12 PM',
      '1–3 PM',
      '3–5 PM',
    ]);
  });
  it('default to first thing in the morning', () => {
    expect(DEFAULT_DELIVERY_WINDOW).toBe('08-10');
    expect(deliveryWindowLabel(DEFAULT_DELIVERY_WINDOW)).toBe('8–10 AM');
  });
  it('reject anything else, and never print a raw key at a person', () => {
    expect(isDeliveryWindow('18-20')).toBe(false);
    expect(isDeliveryWindow('8–10 AM')).toBe(false); // the LABEL is not the key
    expect(deliveryWindowLabel('18-20')).toBe('Daytime');
  });
});

describe('the tracking link', () => {
  it('is null when there is no token, rather than a link to /track/null', () => {
    expect(trackingUrlFor(null)).toBeNull();
    expect(trackingUrlFor(undefined)).toBeNull();
    expect(trackingUrlFor('   ')).toBeNull();
  });
  it('points at /track/<token> on the app, and escapes the token', () => {
    const url = trackingUrlFor('abc-123');
    expect(url).not.toBeNull();
    expect(url as string).toMatch(/\/track\/abc-123$/);
    expect(trackingUrlFor('a b') as string).toMatch(/\/track\/a%20b$/);
  });
});

/**
 * MEASURING NOTICE IN BUSINESS DAYS (ovn 10-rush-order).
 *
 * `rush_policies.minimum_lead_time_days` is "the shortest notice AFS will take
 * for a rush job", and comparing it against the requested-by date the customer
 * gave is a business-day question — so it is answered in this file, which
 * CLAUDE.md rule #24 makes the only place allowed to decide what a business day
 * is.
 *
 * The Friday case is again the one that matters: a Friday-to-Monday request
 * looks like three days of notice on a calendar and is one working day in the
 * shop. Quoting it as three is how a rush job gets accepted that cannot be
 * made.
 */
describe('businessDaysBetween counts working days, not calendar days', () => {
  // Anchors, verified by dayOfWeek rather than asserted from memory:
  // 2026-10-05 Mon, 10-06 Tue, 10-09 Fri, 10-10 Sat, 10-12 Mon, 11-02 Mon.
  it('knows which days of the week the anchors are', () => {
    expect(dayOfWeek('2026-10-05'), 'anchor 2026-10-05 must be a Monday').toBe(1);
    expect(dayOfWeek('2026-10-06'), 'anchor 2026-10-06 must be a Tuesday').toBe(2);
    expect(dayOfWeek('2026-10-09'), 'anchor 2026-10-09 must be a Friday').toBe(5);
    expect(dayOfWeek('2026-10-10'), 'anchor 2026-10-10 must be a Saturday').toBe(6);
    expect(dayOfWeek('2026-10-12'), 'anchor 2026-10-12 must be a Monday').toBe(1);
    expect(dayOfWeek('2026-11-02'), 'anchor 2026-11-02 must be a Monday').toBe(1);
  });

  it('Monday to Tuesday is one working day of notice', () => {
    expect(
      businessDaysBetween('2026-10-05', '2026-10-06'),
      'Mon -> Tue is 1 business day; any other answer means the interval is not (from, to]'
    ).toBe(1);
  });

  it('FRIDAY TO MONDAY IS ONE WORKING DAY, not three — the weekend is not notice', () => {
    expect(
      businessDaysBetween('2026-10-09', '2026-10-12'),
      'Fri -> Mon must be 1, not the 3 calendar days between them. Three would let a rush job be accepted that the shop has one day to make.'
    ).toBe(1);
  });

  it('Friday to Saturday is no working days at all', () => {
    expect(
      businessDaysBetween('2026-10-09', '2026-10-10'),
      'Fri -> Sat is 0: Saturday is not a day the shop fabricates on'
    ).toBe(0);
  });

  it('the same day is zero, not one', () => {
    expect(
      businessDaysBetween('2026-10-05', '2026-10-05'),
      'a date is not notice against itself; the interval excludes its start'
    ).toBe(0);
  });

  it('a whole week is five, and four whole weeks are twenty', () => {
    expect(businessDaysBetween('2026-10-05', '2026-10-12'), 'Mon -> next Mon is 5 working days').toBe(5);
    expect(
      businessDaysBetween('2026-10-05', '2026-11-02'),
      '28 calendar days is exactly 4 weeks, so 20 working days — this is the path through the whole-weeks shortcut'
    ).toBe(20);
  });

  it('a date already past reads as NEGATIVE notice, never as a large positive', () => {
    expect(
      businessDaysBetween('2026-10-06', '2026-10-05'),
      'Tue -> the Monday before is -1. A sign flip here would make a late date look like plenty of notice.'
    ).toBe(-1);
  });

  it('crosses a month boundary without an off-by-one', () => {
    // 2026-10-30 is a Friday; 2026-11-02 the following Monday.
    expect(dayOfWeek('2026-10-30'), 'anchor 2026-10-30 must be a Friday').toBe(5);
    expect(businessDaysBetween('2026-10-30', '2026-11-02'), 'Fri 30 Oct -> Mon 2 Nov is 1 working day').toBe(1);
  });

  it('crosses a leap day without an off-by-one', () => {
    // 2028 is a leap year. 2028-02-28 is a Monday, so 02-29 is Tuesday and
    // 03-01 is Wednesday: two working days, the leap day being one of them.
    expect(dayOfWeek('2028-02-28'), 'anchor 2028-02-28 must be a Monday').toBe(1);
    expect(
      businessDaysBetween('2028-02-28', '2028-03-01'),
      'Mon 28 Feb -> Wed 1 Mar 2028 is 2 working days, counting the leap day'
    ).toBe(2);
  });

  it('refuses a value that is not a date rather than guessing at one', () => {
    expect(() => businessDaysBetween('not-a-date', '2026-10-05')).toThrow(/not a date/);
    expect(() => businessDaysBetween('2026-10-05', '2026-02-31')).toThrow(/not a date/);
  });
});

describe('calendarDaysBetween is signed and zone-free', () => {
  it('counts calendar days including the weekend', () => {
    expect(calendarDaysBetween('2026-10-09', '2026-10-12'), 'Fri -> Mon is 3 calendar days').toBe(3);
  });
  it('is zero on the same day and negative backwards', () => {
    expect(calendarDaysBetween('2026-10-05', '2026-10-05')).toBe(0);
    expect(calendarDaysBetween('2026-10-12', '2026-10-09')).toBe(-3);
  });
  it('spans a leap day correctly', () => {
    expect(
      calendarDaysBetween('2028-02-28', '2028-03-01'),
      '2028 is a leap year, so 28 Feb -> 1 Mar is 2 calendar days, not 1'
    ).toBe(2);
  });
});

describe('addBusinessDays answers "the earliest we could do it"', () => {
  it('zero business days later is the same date, even on a Saturday', () => {
    expect(
      addBusinessDays('2026-10-10', 0),
      'zero business days after a date is that date. Rolling a Saturday forward here would answer a different question.'
    ).toBe('2026-10-10');
  });

  it('one business day after a Friday is the following Monday', () => {
    expect(addBusinessDays('2026-10-09', 1), 'Fri + 1 working day = Mon').toBe('2026-10-12');
  });

  it('five business days after a Monday is the following Monday', () => {
    expect(addBusinessDays('2026-10-05', 5), 'Mon + 5 working days = the next Mon').toBe('2026-10-12');
  });

  it('ten business days crosses two weekends', () => {
    expect(addBusinessDays('2026-10-05', 10), 'Mon + 10 working days = two weeks on, same weekday').toBe('2026-10-19');
  });

  it('is the exact inverse of businessDaysBetween on its own interval', () => {
    // The property that makes the lead-time check coherent: if the earliest we
    // can do it is addBusinessDays(today, n), then that date really does carry
    // n working days of notice.
    for (const start of ['2026-10-05', '2026-10-09', '2026-10-10', '2026-11-02']) {
      for (const n of [0, 1, 2, 5, 7, 23]) {
        expect(
          businessDaysBetween(start, addBusinessDays(start, n)),
          'businessDaysBetween(' +
            start +
            ', addBusinessDays(' +
            start +
            ', ' +
            n +
            ')) must be exactly ' +
            n +
            ', or the earliest date shown to an estimator does not carry the notice the policy asked for'
        ).toBe(n);
      }
    }
  });

  it('refuses a negative or fractional count rather than silently flooring it', () => {
    expect(() => addBusinessDays('2026-10-05', -1)).toThrow(/whole number, zero or more/);
    expect(() => addBusinessDays('2026-10-05', 1.5)).toThrow(/whole number, zero or more/);
  });

  it('refuses an absurd count rather than looping for minutes', () => {
    expect(
      () => addBusinessDays('2026-10-05', 100000),
      'an unbounded walk here would hang a page render; the bound is the guard'
    ).toThrow(/bound this function will walk/);
  });
});
