/**
 * Narrowing an untrusted `items` array.
 *
 * THE RULE THIS FILE PROTECTS: narrow, never invent. The engine is total — every
 * rule copes with an absent, zero, negative or non-numeric field, because that is
 * the only way a validator can report on a half-filled form as the customer
 * types it. So this layer must not "clean up" a bad value into a plausible one,
 * which would hide the very thing the engine exists to report.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_POINTS_PER_ITEM,
  countOversizedPolylines,
  profileLabelsOf,
  readOrderValidatorItem,
  readOrderValidatorItems,
} from './request-items';
import { validateOrder } from './validate';

describe('readOrderValidatorItem', () => {
  it('carries a complete item through unchanged', () => {
    expect(
      readOrderValidatorItem({
        profileType: 'Coping Cap',
        material: 'Galvanized Steel',
        gauge: '20 ga',
        width: 12,
        height: 6,
        legA: 3,
        legB: 3,
        lengthFt: 10,
        quantity: 4,
      }),
      'Expected every supplied field preserved exactly.'
    ).toEqual({
      profileType: 'Coping Cap',
      profileName: null,
      material: 'Galvanized Steel',
      gauge: '20 ga',
      width: 12,
      height: 6,
      legA: 3,
      legB: 3,
      lengthFt: 10,
      quantity: 4,
      points: null,
      hemStart: null,
      hemEnd: null,
    });
  });

  it('keeps an absent dimension absent rather than defaulting it to zero', () => {
    const item = readOrderValidatorItem({ profileType: 'Drip Edge', lengthFt: 10, quantity: 1 });
    expect(
      item?.width,
      'Expected null. The Quote Builder tells the customer to leave leg measurements blank on a flat profile, and a 0 here would be reported as "that is not a measurement" on a field they were told to leave empty.'
    ).toBeNull();
  });

  it('passes a wrong-typed number through as NaN for the engine to report', () => {
    const item = readOrderValidatorItem({ profileType: 'Coping Cap', width: '12' });
    expect(
      Number.isNaN(item?.width),
      `Expected NaN; got ${JSON.stringify(item?.width)}. Parsing "12" into 12 here would be this layer deciding what the customer meant, and skipping the field entirely would mean no range check ran with nobody saying so. NaN is the one answer the engine turns into a message.`
    ).toBe(true);
  });

  it('reports a string dimension as a problem once it reaches the engine', () => {
    const items = readOrderValidatorItems([{ profileType: 'Coping Cap', width: '12', lengthFt: 10, quantity: 1 }]);
    expect(
      validateOrder({ items }).findings.map((f) => f.code),
      'Expected the engine to report the unusable width. This is the end-to-end proof that passing NaN through rather than coercing or dropping it is what makes the problem visible.'
    ).toContain('OV_DIMENSION_NOT_POSITIVE');
  });

  it('returns null for an entry that is not an object', () => {
    for (const entry of [null, undefined, 'a string', 42, [], true]) {
      expect(
        readOrderValidatorItem(entry),
        `Expected null for ${JSON.stringify(entry)}: there is no line item there to validate.`
      ).toBeNull();
    }
  });

  it('reads a drawn polyline of finite points', () => {
    const item = readOrderValidatorItem({
      profileType: 'Custom FlashDraft Profile',
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
    });
    expect(item?.points, 'Expected the polyline preserved in world inches.').toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it('discards a polyline containing a non-finite or non-numeric point', () => {
    for (const points of [
      [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }],
      [{ x: 0, y: 0 }, { x: '6', y: 0 }],
      [{ x: 0, y: 0 }, null],
      [{ x: 0, y: 0 }, { x: 6 }],
    ]) {
      expect(
        readOrderValidatorItem({ profileType: 'Custom FlashDraft Profile', points })?.points,
        `Expected null for ${JSON.stringify(points)}. A half-read drawing would still be measured, and a girth measured off a shape nobody drew could refuse a real profile or pass an impossible one.`
      ).toBeNull();
    }
  });

  it('discards a polyline longer than the cap', () => {
    const points = Array.from({ length: MAX_POINTS_PER_ITEM + 1 }, (_unused, index) => ({ x: index, y: 0 }));
    expect(
      readOrderValidatorItem({ profileType: 'Custom FlashDraft Profile', points })?.points,
      `Expected null above ${MAX_POINTS_PER_ITEM} points. The self-intersection check is quadratic in the point count and the validate endpoint is unauthenticated, so an unbounded polyline is a way to burn server time.`
    ).toBeNull();
  });

  it('keeps a polyline exactly at the cap (boundary)', () => {
    const points = Array.from({ length: MAX_POINTS_PER_ITEM }, (_unused, index) => ({ x: index, y: 0 }));
    expect(
      readOrderValidatorItem({ profileType: 'Custom FlashDraft Profile', points })?.points?.length,
      `Expected exactly ${MAX_POINTS_PER_ITEM} points kept: the cap is a ceiling, not a limit one short of it.`
    ).toBe(MAX_POINTS_PER_ITEM);
  });

  it('reads a hem fold length, and keeps an unrecorded one unrecorded', () => {
    expect(
      readOrderValidatorItem({ hemStart: { lengthIn: 0.5 } })?.hemStart,
      'Expected the fold length read.'
    ).toEqual({ lengthIn: 0.5 });
    expect(
      readOrderValidatorItem({ hemStart: { type: 'open' } })?.hemStart,
      'Expected a hem with no lengthIn at all. A hem read back out of JSONB may have lost it, and absent is not zero — reporting "this hem has no fold" would be a false accusation.'
    ).toEqual({});
    expect(
      readOrderValidatorItem({})?.hemStart,
      'Expected null when there is no hem: a profile with no hems must not be reported as having an unmeasurable one.'
    ).toBeNull();
  });
});

describe('readOrderValidatorItems', () => {
  it('drops unreadable entries and keeps the rest', () => {
    const items = readOrderValidatorItems([{ profileType: 'Coping Cap' }, 'nonsense', null, { profileType: 'Fascia' }]);
    expect(
      items.map((item) => item.profileType),
      'Expected the two real items. One malformed entry must not discard a whole request.'
    ).toEqual(['Coping Cap', 'Fascia']);
  });

  it('returns nothing for a body whose items are not an array', () => {
    for (const raw of [null, undefined, {}, 'items', 42]) {
      expect(readOrderValidatorItems(raw), `Expected [] for ${JSON.stringify(raw)}.`).toEqual([]);
    }
  });
});

describe('profileLabelsOf', () => {
  it('returns the distinct labels in first-seen order', () => {
    expect(
      profileLabelsOf([
        { profileType: 'Coping Cap' },
        { profileType: 'Fascia' },
        { profileType: 'Coping Cap' },
        { profileType: 'Drip Edge' },
      ]),
      'Expected first-seen order with no duplicates, so the catalog lookup is done once per distinct profile.'
    ).toEqual(['Coping Cap', 'Fascia', 'Drip Edge']);
  });

  it('ignores blank, whitespace-only and non-string labels', () => {
    expect(
      profileLabelsOf([{ profileType: '' }, { profileType: '   ' }, { profileType: null }, {}]),
      'Expected []. A blank label must not become a catalog lookup for the empty string.'
    ).toEqual([]);
  });

  it('trims a label before comparing, so one profile is not looked up twice', () => {
    expect(
      profileLabelsOf([{ profileType: 'Coping Cap' }, { profileType: '  Coping Cap  ' }]),
      'Expected one entry.'
    ).toEqual(['Coping Cap']);
  });
});

describe('countOversizedPolylines', () => {
  const oversized = Array.from({ length: MAX_POINTS_PER_ITEM + 1 }, (_unused, index) => ({ x: index, y: 0 }));

  it('counts nothing for a normal request', () => {
    expect(
      countOversizedPolylines([{ points: [{ x: 0, y: 0 }, { x: 6, y: 0 }] }, { width: 12 }]),
      'Expected 0 — a real FlashDraft profile is a handful of points.'
    ).toBe(0);
  });

  it('counts each item whose polyline is over the cap', () => {
    expect(
      countOversizedPolylines([{ points: oversized }, { points: [{ x: 0, y: 0 }] }, { points: oversized }]),
      'Expected 2. Counted rather than silently dropped so the route can refuse the request and say why — a cap that is not reported looks exactly like coverage.'
    ).toBe(2);
  });

  it('counts nothing at exactly the cap (boundary)', () => {
    const atCap = Array.from({ length: MAX_POINTS_PER_ITEM }, (_unused, index) => ({ x: index, y: 0 }));
    expect(countOversizedPolylines([{ points: atCap }]), 'Expected 0 at exactly the cap.').toBe(0);
  });

  it('counts nothing for a body that is not an array', () => {
    for (const raw of [null, undefined, {}, 'items']) {
      expect(countOversizedPolylines(raw), `Expected 0 for ${JSON.stringify(raw)}.`).toBe(0);
    }
  });
});
