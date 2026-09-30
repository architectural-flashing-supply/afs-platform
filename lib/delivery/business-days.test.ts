import { describe, it, expect } from 'vitest';
import {
  addDays,
  businessDayOnOrAfter,
  businessDaysFrom,
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
