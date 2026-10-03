import { describe, it, expect } from 'vitest';
import {
  SIXTEENTHS_PER_INCH,
  ceilToSixteenths,
  floorToSixteenths,
  fromSixteenths,
  feetToInches,
} from './sixteenths';

describe('the 1/16-inch grid: round trip', () => {
  it('converts a whole inch to exactly 16 sixteenths and back', () => {
    // ARRANGE / ACT
    const sixteenths = ceilToSixteenths(1);
    const inches = fromSixteenths(sixteenths);

    // ASSERT
    expect(sixteenths, '1 in must be 16 sixteenths exactly').toBe(SIXTEENTHS_PER_INCH);
    expect(inches, 'the round trip must return the original inch value').toBe(1);
  });

  it('round-trips every sixteenth of one inch without drift', () => {
    // A decimal-based planner would accumulate error here. Sixteenths are
    // dyadic, so every one of these is exact — this is the premise the
    // conservation identity in optimize.test.ts depends on.
    for (let n = 0; n <= 16; n += 1) {
      const inches = fromSixteenths(n);
      expect(
        ceilToSixteenths(inches),
        `${n}/16 in (= ${inches}) must round-trip to ${n} sixteenths, not ${ceilToSixteenths(inches)}`
      ).toBe(n);
      expect(floorToSixteenths(inches), `${n}/16 in must floor to itself`).toBe(n);
    }
  });

  it('treats a length already on the grid as a fixed point in both directions', () => {
    // 59.9375 in = 959/16. Both snaps must leave it alone: a length that is
    // already exact must never gain or lose a sixteenth.
    expect(ceilToSixteenths(59.9375), '59.9375 in is 959 sixteenths exactly').toBe(959);
    expect(floorToSixteenths(59.9375), '59.9375 in is 959 sixteenths exactly').toBe(959);
  });
});

describe('the 1/16-inch grid: snapping has a direction', () => {
  it('rounds a required length UP so a piece is never planned short', () => {
    // 95.97 in = 1535.52 sixteenths. Rounding down would plan 95.9375 in for a
    // piece the customer asked to be 95.97 in long — a short piece.
    expect(ceilToSixteenths(95.97), '95.97 in must round up to 1536 sixteenths (96 in)').toBe(1536);
    expect(fromSixteenths(ceilToSixteenths(95.97)), 'which is 96 in').toBe(96);
  });

  it('rounds an available stock length DOWN so material is never over-claimed', () => {
    // 119.99 in = 1919.84 sixteenths. Rounding up would claim 120 in of bar
    // that does not exist.
    expect(floorToSixteenths(119.99), '119.99 in must floor to 1919 sixteenths').toBe(1919);
    expect(fromSixteenths(floorToSixteenths(119.99)), 'which is 119.9375 in').toBe(119.9375);
  });

  it('rounds a kerf UP so blade width is never under-reserved', () => {
    // 0.26 in = 4.16 sixteenths -> 5 sixteenths = 0.3125 in.
    expect(ceilToSixteenths(0.26), '0.26 in must round up to 5 sixteenths').toBe(5);
    expect(fromSixteenths(ceilToSixteenths(0.26)), 'which is 0.3125 in').toBe(0.3125);
  });

  it('does not inflate a value that is only a float-error hair above the grid', () => {
    // 9.1 * 12 is 109.19999999999999 in float64, i.e. 1747.1999999999998
    // sixteenths. The real answer is 109.2 in, which is NOT on the grid, so
    // ceil must give 1748 (109.25) — one sixteenth up, not two.
    expect(ceilToSixteenths(9.1 * 12), '9.1 ft must plan as 1748 sixteenths').toBe(1748);

    // 8 ft IS on the grid. A naive ceil of a value a hair above 1536 would
    // return 1537 and hand out an extra sixteenth of metal for nothing.
    const eightFeetWithDrift = 1536.0000000001 / SIXTEENTHS_PER_INCH;
    expect(
      ceilToSixteenths(eightFeetWithDrift),
      'a value within tolerance of a grid point must snap to that point, not past it'
    ).toBe(1536);
  });
});

describe('the 1/16-inch grid: boundary and non-finite input', () => {
  it('maps zero to zero in both directions', () => {
    expect(ceilToSixteenths(0), 'zero has no length to round').toBe(0);
    expect(floorToSixteenths(0), 'zero has no length to round').toBe(0);
    expect(fromSixteenths(0), 'zero sixteenths is zero inches').toBe(0);
  });

  it('is pure arithmetic on a negative value and does not pretend to validate', () => {
    // Validation belongs to optimize.ts, which rejects a negative length with
    // an explicit error result before anything is snapped. These helpers must
    // not also decide policy — that would put one rule in two places.
    expect(ceilToSixteenths(-1), '-1 in is -16 sixteenths').toBe(-16);
    expect(floorToSixteenths(-1.01), '-1.01 in floors away from zero').toBe(-17);
  });

  it('passes a non-finite value straight through rather than inventing a number', () => {
    expect(Number.isNaN(ceilToSixteenths(Number.NaN)), 'NaN in, NaN out').toBe(true);
    expect(ceilToSixteenths(Number.POSITIVE_INFINITY), 'Infinity in, Infinity out').toBe(
      Number.POSITIVE_INFINITY
    );
    expect(Number.isNaN(floorToSixteenths(Number.NaN)), 'NaN in, NaN out').toBe(true);
  });
});

describe('feet to inches', () => {
  it('converts the seeded standard and max stock lengths exactly', () => {
    // product_profiles.standard_length_ft / max_length_ft seed values
    // (supabase/migrations/002_seed_afs_data.sql): 10, 12, 20 and 40 ft.
    expect(feetToInches(10), '10 ft is 120 in').toBe(120);
    expect(feetToInches(12), '12 ft is 144 in').toBe(144);
    expect(feetToInches(20), '20 ft is 240 in').toBe(240);
    expect(feetToInches(40), '40 ft is 480 in').toBe(480);
  });

  it('lands every seeded stock length exactly on the grid', () => {
    for (const feet of [10, 12, 20, 40]) {
      const inches = feetToInches(feet);
      expect(
        floorToSixteenths(inches),
        `${feet} ft must need no rounding at all — it is ${inches * 16} sixteenths`
      ).toBe(inches * SIXTEENTHS_PER_INCH);
    }
  });
});
