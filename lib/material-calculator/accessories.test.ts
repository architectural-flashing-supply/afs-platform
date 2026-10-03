import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ACCESSORY_FIXED_OPTIONAL,
  FIXTURE_ACCESSORY_PER_LF_REQUIRED,
  FIXTURE_ACCESSORY_PER_PIECE_REQUIRED,
  FIXTURE_ACCESSORY_PER_SQFT_OPTIONAL,
  FIXTURE_ACCESSORY_SET,
  FIXTURE_ACCESSORY_ZERO_RATE_PER_LF,
  FIXTURE_ACCESSORY_ZERO_RATE_PER_PIECE,
} from '@/tests/fixtures/material-calculator';
import { calculateAccessories, calculateAccessoryQuantity } from './accessories';
import type { ProductAccessory } from './types';

/**
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §2.2 — ACCESSORY QUANTITIES.
 *
 * A wrong accessory count here means a crew arrives on a roof without enough
 * sealant, so every quantity is asserted exactly against a hand-computed value.
 */
describe('calculateAccessoryQuantity — the four calc_method rules', () => {
  it('per_lf divides the billed footage by the rate and rounds up: 110 LF at 1 per 20 LF is 6', () => {
    // ARRANGE — the spec's own example: "1 tube per 20 LF". 110 / 20 = 5.5
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_PER_LF_REQUIRED, 110, 10);

    // ASSERT
    expect(
      result,
      `110 LF at one roll per 20 LF is 5.5 rolls and must order 6. Five rolls covers ` +
        `100 LF and leaves the last 10 LF unsealed. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, calculatedQty: 6 });
  });

  it('per_lf yields exactly the quotient when it divides evenly', () => {
    // ARRANGE — 100 / 20 = 5 exactly
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_PER_LF_REQUIRED, 100, 10);

    // ASSERT
    expect(
      result,
      `100 LF at one roll per 20 LF is exactly 5 rolls. Math.ceil must not inflate an ` +
        `exact division to 6. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, calculatedQty: 5 });
  });

  it('per_piece multiplies by the piece count and rounds up: 3 pieces at 2.5 is 8', () => {
    // ARRANGE — config A-03: §2.2's code says Math.ceil, its prose says a bare
    // multiply. 3 * 2.5 = 7.5
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_PER_PIECE_REQUIRED, 110, 3);

    // ASSERT
    expect(
      result,
      `3 pieces at 2.5 boxes per piece is 7.5 boxes and must order 8. Half a box is not ` +
        `orderable, and §2.1's "never under-order" settles which way it rounds. ` +
        `Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, calculatedQty: 8 });
  });

  it('per_piece ignores the footage entirely', () => {
    // ARRANGE — same pieces, wildly different footage
    // ACT
    const tenLf = calculateAccessoryQuantity(FIXTURE_ACCESSORY_PER_PIECE_REQUIRED, 10, 4);
    const thousandLf = calculateAccessoryQuantity(FIXTURE_ACCESSORY_PER_PIECE_REQUIRED, 1000, 4);

    // ASSERT
    expect(
      thousandLf,
      `A per_piece rate must depend only on the piece count. 4 pieces at 2.5 is 10 ` +
        `whether the run is 10 LF or 1000 LF. Got ${JSON.stringify(thousandLf)} at 1000 LF ` +
        `versus ${JSON.stringify(tenLf)} at 10 LF.`
    ).toEqual(tenLf);
    expect(
      thousandLf,
      `4 pieces at 2.5 boxes per piece is exactly 10 boxes. Got ${JSON.stringify(thousandLf)}.`
    ).toEqual({ ok: true, calculatedQty: 10 });
  });

  it('fixed returns the rate exactly, unscaled by footage or pieces', () => {
    // ARRANGE — §2.2: "fixed: calcRate (always exactly this quantity)"
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_FIXED_OPTIONAL, 5000, 400);

    // ASSERT
    expect(
      result,
      `A fixed rate of 2 must stay 2 for a 5000 LF / 400 piece order. §2.2 says ` +
        `"always exactly this quantity". Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, calculatedQty: 2 });
  });

  it('fixed passes a fractional rate through UNROUNDED', () => {
    // ARRANGE — calc_rate is DECIMAL(8,4), so 1.5 is storable, and §2.2 says the
    // fixed quantity is exactly the rate
    const halfUnit: ProductAccessory = { ...FIXTURE_ACCESSORY_FIXED_OPTIONAL, calcRate: 1.5 };

    // ACT
    const result = calculateAccessoryQuantity(halfUnit, 110, 10);

    // ASSERT
    expect(
      result,
      `A fixed rate of 1.5 must return exactly 1.5, not 2. Rounding it up would bill ` +
        `more than the row says, and "always exactly this quantity" is the spec's own ` +
        `wording. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, calculatedQty: 1.5 });
  });

  it('REFUSES per_sqft rather than silently returning 1', () => {
    // ARRANGE — §2.2's switch has no per_sqft case, so the spec's own code falls
    // through to `let qty = 1`: a fabricated quantity (config A-04)
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_PER_SQFT_OPTIONAL, 110, 10);

    // ASSERT
    expect(
      result.ok,
      `per_sqft must be refused. There is no area in the calculator's input, so any ` +
        `number it produced would be invented — and the spec's own switch would have ` +
        `produced the fabricated value 1.`
    ).toBe(false);
    expect(
      result.ok === false ? result.reason : '',
      `The refusal must explain itself in plain English so the UI can print it. ` +
        `Got ${JSON.stringify(result)}.`
    ).toContain('square foot');
  });

  it('REFUSES a per_lf rate of 0 rather than returning Infinity', () => {
    // ARRANGE — calc_rate is NOT NULL DEFAULT 1 with no CHECK, so a 0 is storable,
    // and the spec divides by it unguarded
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_ZERO_RATE_PER_LF, 110, 10);

    // ASSERT
    expect(
      result.ok,
      `A per_lf rate of 0 is "one per zero feet" — division by zero. The spec's ` +
        `Math.ceil(110 / 0) is Infinity, which would render as "Infinity rolls". It must ` +
        `be refused instead. Got ${JSON.stringify(result)}.`
    ).toBe(false);
  });

  it('ACCEPTS a per_piece rate of 0 as the real answer "none needed"', () => {
    // ARRANGE — unlike per_lf, zero here is a multiplier, not a divisor
    // ACT
    const result = calculateAccessoryQuantity(FIXTURE_ACCESSORY_ZERO_RATE_PER_PIECE, 110, 10);

    // ASSERT
    expect(
      result,
      `A per_piece rate of 0 means this product needs none of this accessory. That is a ` +
        `real answer and must not be refused as missing data. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true, calculatedQty: 0 });
  });

  it('REFUSES a negative rate for every method', () => {
    // ARRANGE — a negative count cannot be ordered
    const methods = ['per_lf', 'per_piece', 'fixed'] as const;

    for (const calcMethod of methods) {
      const negative: ProductAccessory = {
        ...FIXTURE_ACCESSORY_PER_LF_REQUIRED,
        calcMethod,
        calcRate: -5,
      };

      // ACT
      const result = calculateAccessoryQuantity(negative, 110, 10);

      // ASSERT
      expect(
        result.ok,
        `A calc_rate of -5 on a ${calcMethod} row must be refused. No negative quantity ` +
          `is orderable, and the spec guards none of the three. Got ${JSON.stringify(result)}.`
      ).toBe(false);
    }
  });

  it('REFUSES a NaN rate, which is what an unparseable DECIMAL arrives as', () => {
    // ARRANGE — lib/data/product-accessories.ts maps an unparseable calc_rate to NaN
    // on purpose so this refusal is the single place that handles it
    const unparseable: ProductAccessory = {
      ...FIXTURE_ACCESSORY_PER_LF_REQUIRED,
      calcRate: Number.NaN,
    };

    // ACT
    const result = calculateAccessoryQuantity(unparseable, 110, 10);

    // ASSERT
    expect(
      result.ok,
      `A NaN calc_rate must be refused, not turned into "NaN rolls" on the screen. ` +
        `Got ${JSON.stringify(result)}.`
    ).toBe(false);
  });
});

describe('calculateAccessories — the §3 required / optional / refused split', () => {
  it('splits a mixed set into the three groups §3 renders', () => {
    // ARRANGE — one required per_lf, one required per_piece, one optional fixed,
    // one optional per_sqft
    // ACT
    const result = calculateAccessories({
      orderedQtyLf: 110,
      orderedPieces: 10,
      accessories: FIXTURE_ACCESSORY_SET,
    });

    // ASSERT
    expect(
      result.required.map((a) => `${a.accessoryName}:${a.calculatedQty}${a.unit}`),
      `§3's "REQUIRED WITH THIS ORDER" must hold exactly the is_required rows with their ` +
        `computed quantities. 110 LF at 1 per 20 LF is 6 rolls; 10 pieces at 2.5 is 25 ` +
        `boxes. Got ${JSON.stringify(result.required)}.`
    ).toEqual(['Butyl Tape:6rolls', 'Hex Screws:25boxes']);

    expect(
      result.optional.map((a) => `${a.accessoryName}:${a.calculatedQty}${a.unit}`),
      `§3's "ALSO COMMONLY ORDERED" must hold the optional rows that could be quantified ` +
        `— the fixed Termination Bar at exactly 2. Got ${JSON.stringify(result.optional)}.`
    ).toEqual(['Termination Bar:2EA']);

    expect(
      result.uncalculable.map((a) => a.accessoryName),
      `The per_sqft row must be listed without a quantity rather than dropped: the ` +
        `contractor still needs to know it applies. Got ${JSON.stringify(result.uncalculable)}.`
    ).toEqual(['Touch-Up Paint']);
  });

  it('carries every field of §2.2 AccessoryRequirement through, including a null sku', () => {
    // ARRANGE — accessories.sku is nullable (migration 001 line 240: TEXT UNIQUE)
    // ACT
    const result = calculateAccessories({
      orderedQtyLf: 110,
      orderedPieces: 10,
      accessories: [FIXTURE_ACCESSORY_FIXED_OPTIONAL],
    });

    // ASSERT
    expect(
      result.optional[0],
      `The result must carry §2.2's whole interface — accessoryId, accessoryName, sku, ` +
        `calcMethod, calculatedQty, unit, isRequired — with a null sku preserved as null ` +
        `rather than coerced to ''. Got ${JSON.stringify(result.optional[0])}.`
    ).toEqual({
      accessoryId: 'acc-0003-termination-bar',
      accessoryName: 'Termination Bar',
      sku: null,
      calcMethod: 'fixed',
      calculatedQty: 2,
      unit: 'EA',
      isRequired: false,
    });
  });

  it('sorts by name regardless of the order the rows arrived in', () => {
    // ARRANGE — PostgREST gives no ordering guarantee without an explicit order()
    const forwards = [FIXTURE_ACCESSORY_PER_LF_REQUIRED, FIXTURE_ACCESSORY_PER_PIECE_REQUIRED];
    const backwards = [FIXTURE_ACCESSORY_PER_PIECE_REQUIRED, FIXTURE_ACCESSORY_PER_LF_REQUIRED];

    // ACT
    const a = calculateAccessories({ orderedQtyLf: 110, orderedPieces: 10, accessories: forwards });
    const b = calculateAccessories({ orderedQtyLf: 110, orderedPieces: 10, accessories: backwards });

    // ASSERT
    expect(
      a.required.map((x) => x.accessoryName),
      `Rows must come back name-ascending ("Butyl Tape" before "Hex Screws") whichever ` +
        `order the database returned them in. Got ${JSON.stringify(a.required.map((x) => x.accessoryName))}.`
    ).toEqual(['Butyl Tape', 'Hex Screws']);
    expect(
      b.required,
      `Reversing the input must produce an identical result. A list that reshuffles ` +
        `between two identical requests reads as a bug to whoever is looking at it.`
    ).toEqual(a.required);
  });

  it('breaks a name tie on accessory id, so the order is total', () => {
    // ARRANGE — two rows with the same display name, which a catalog can contain
    const second: ProductAccessory = {
      ...FIXTURE_ACCESSORY_FIXED_OPTIONAL,
      accessoryId: 'acc-0099-termination-bar-heavy',
    };

    // ACT
    const result = calculateAccessories({
      orderedQtyLf: 110,
      orderedPieces: 10,
      accessories: [second, FIXTURE_ACCESSORY_FIXED_OPTIONAL],
    });

    // ASSERT
    expect(
      result.optional.map((a) => a.accessoryId),
      `Equal names must fall back to id order, so the sort is total and the output is ` +
        `deterministic. Got ${JSON.stringify(result.optional.map((a) => a.accessoryId))}.`
    ).toEqual(['acc-0003-termination-bar', 'acc-0099-termination-bar-heavy']);
  });

  it('returns three empty arrays for an empty accessory set', () => {
    // ARRANGE — the real situation today: product_accessories has no rows
    // ACT
    const result = calculateAccessories({ orderedQtyLf: 110, orderedPieces: 10, accessories: [] });

    // ASSERT
    expect(
      result,
      `No accessory rows must produce three empty arrays, not undefined and not a ` +
        `placeholder list. SPEC §5 says the accessory section hides while checklist #17 ` +
        `is outstanding. Got ${JSON.stringify(result)}.`
    ).toEqual({ required: [], optional: [], uncalculable: [] });
  });

  it('never returns a non-finite or negative quantity, whatever the rows hold', () => {
    // ARRANGE — every refusal case at once
    const hostile: ProductAccessory[] = [
      FIXTURE_ACCESSORY_ZERO_RATE_PER_LF,
      FIXTURE_ACCESSORY_PER_SQFT_OPTIONAL,
      { ...FIXTURE_ACCESSORY_PER_LF_REQUIRED, calcRate: Number.NaN },
      { ...FIXTURE_ACCESSORY_PER_PIECE_REQUIRED, calcRate: -1, accessoryId: 'acc-neg' },
      { ...FIXTURE_ACCESSORY_FIXED_OPTIONAL, calcRate: Number.POSITIVE_INFINITY, accessoryId: 'acc-inf' },
    ];

    // ACT
    const result = calculateAccessories({ orderedQtyLf: 110, orderedPieces: 10, accessories: hostile });
    const quantities = [...result.required, ...result.optional].map((a) => a.calculatedQty);

    // ASSERT
    expect(
      quantities.every((q) => Number.isFinite(q) && q >= 0),
      `Every returned calculatedQty must be finite and >= 0. Anything else renders as ` +
        `"NaN rolls" or "-1 boxes" on a customer's screen. Got ${JSON.stringify(quantities)}.`
    ).toBe(true);
    expect(
      result.uncalculable.length,
      `All five hostile rows must land in uncalculable with a reason, not be quantified. ` +
        `Got ${result.uncalculable.length}: ${JSON.stringify(result.uncalculable.map((a) => a.accessoryName))}.`
    ).toBe(5);
  });

  it('gives every refused row a non-empty reason the UI can print', () => {
    // ARRANGE / ACT
    const result = calculateAccessories({
      orderedQtyLf: 110,
      orderedPieces: 10,
      accessories: [FIXTURE_ACCESSORY_PER_SQFT_OPTIONAL, FIXTURE_ACCESSORY_ZERO_RATE_PER_LF],
    });

    // ASSERT
    for (const row of result.uncalculable) {
      expect(
        row.reason.length > 0,
        `"${row.accessoryName}" was refused with an empty reason. A silent omission is ` +
          `indistinguishable from a bug; the UI has to be able to say why.`
      ).toBe(true);
    }
    expect(
      result.uncalculable.length,
      `Both refused rows must be reported. Got ${result.uncalculable.length}.`
    ).toBe(2);
  });
});
