import { describe, expect, it } from 'vitest';
import { MATERIAL_CALCULATOR_CONFIG } from './config';
import { calculateMaterials } from './index';
import {
  MaterialCalcInputError,
  assertValidMaterialCalcInput,
  validateMaterialCalcInput,
} from './validate';
import type { MaterialCalcInput } from './types';

/**
 * INPUT REJECTION.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md defines no validation at all, so §2.1 would
 * return Math.ceil(-50 * 1.1) = -55 LF and §4 would serve it. A quantity that is
 * zero, negative, fractional or not a number is refused here by name, because a
 * zero that looks like an answer is worse than a refusal that says which field was
 * wrong.
 */

/** Minimum valid input, so each test varies exactly one field. */
const VALID: MaterialCalcInput = { lengthFt: 10, quantity: 10 };

describe('validateMaterialCalcInput — lengthFt', () => {
  const rejected: ReadonlyArray<[string, unknown]> = [
    ['zero', 0],
    ['negative', -10],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
    ['a numeric string', '10'],
  ];

  for (const [label, value] of rejected) {
    it(`rejects a ${label} length and names the field`, () => {
      // ARRANGE
      const input = { ...VALID, lengthFt: value } as unknown as MaterialCalcInput;

      // ACT
      const result = validateMaterialCalcInput(input);

      // ASSERT
      expect(
        result.ok,
        `A ${label} length must be rejected. Accepting it would bill a customer against ` +
          `a quantity that is not a length. Got ${JSON.stringify(result)}.`
      ).toBe(false);
      expect(
        result.ok === false ? result.errors.map((e) => e.field) : [],
        `The error must name 'lengthFt' so a 400 response can point at the right input. ` +
          `Got ${JSON.stringify(result)}.`
      ).toContain('lengthFt');
    });
  }

  it('accepts a half-foot length, which the wizard input steps in', () => {
    // ARRANGE — app/quote/page.tsx's length field is step="0.5"
    // ACT
    const result = validateMaterialCalcInput({ ...VALID, lengthFt: 10.5 });

    // ASSERT
    expect(
      result,
      `10.5 ft is an ordinary wizard input and must be accepted — only the PIECE count ` +
        `has to be whole. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });
});

describe('validateMaterialCalcInput — quantity', () => {
  const rejected: ReadonlyArray<[string, unknown]> = [
    ['zero', 0],
    ['negative', -1],
    ['fractional', 2.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
    ['a numeric string', '10'],
  ];

  for (const [label, value] of rejected) {
    it(`rejects a ${label} quantity and names the field`, () => {
      // ARRANGE
      const input = { ...VALID, quantity: value } as unknown as MaterialCalcInput;

      // ACT
      const result = validateMaterialCalcInput(input);

      // ASSERT
      expect(
        result.ok,
        `A ${label} quantity must be rejected. Got ${JSON.stringify(result)}.`
      ).toBe(false);
      expect(
        result.ok === false ? result.errors.map((e) => e.field) : [],
        `The error must name 'quantity'. Got ${JSON.stringify(result)}.`
      ).toContain('quantity');
    });
  }

  it('rejects a fractional quantity with a message about whole pieces, not about zero', () => {
    // ARRANGE — 2.5 pieces is positive and finite; it is rejected for a different reason
    // ACT
    const result = validateMaterialCalcInput({ ...VALID, quantity: 2.5 });

    // ASSERT
    expect(
      result.ok === false ? result.errors[0].message : '',
      `A 2.5-piece order must be refused for not being a whole number of pieces. ` +
        `Reusing the "greater than zero" message would send a customer looking for the ` +
        `wrong mistake. Got ${JSON.stringify(result)}.`
    ).toBe('Quantity must be a whole number of pieces.');
  });

  it('accepts a quantity of exactly 1, the lowest orderable count', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({ ...VALID, quantity: 1 });

    // ASSERT
    expect(
      result,
      `One piece is a real order and must be accepted. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });
});

describe('validateMaterialCalcInput — wasteFactorMultiplier band', () => {
  it('accepts an omitted multiplier, which means "use the documented default"', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput(VALID);

    // ASSERT
    expect(
      result,
      `An absent multiplier is the normal case — pricing_rules is unreadable to a ` +
        `customer — and must not be an error. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it('accepts a null multiplier for the same reason', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({ ...VALID, wasteFactorMultiplier: null });

    // ASSERT
    expect(
      result,
      `null is what getProductWasteFactorMultiplier returns when no row is readable, and ` +
        `the route passes it straight through. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it(`accepts exactly the minimum, ${MATERIAL_CALCULATOR_CONFIG.minimumWasteFactorMultiplier}`, () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({
      ...VALID,
      wasteFactorMultiplier: MATERIAL_CALCULATOR_CONFIG.minimumWasteFactorMultiplier,
    });

    // ASSERT
    expect(
      result,
      `A factor of exactly 1.0 means "no waste", which is a legitimate setting for a ` +
        `precisely-cut material. The boundary is inclusive. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it(`accepts exactly the maximum, ${MATERIAL_CALCULATOR_CONFIG.maximumWasteFactorMultiplier}`, () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({
      ...VALID,
      wasteFactorMultiplier: MATERIAL_CALCULATOR_CONFIG.maximumWasteFactorMultiplier,
    });

    // ASSERT
    expect(
      result,
      `The config's maximum is inclusive. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it('rejects a multiplier below 1, which would bill less than was ordered', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({ ...VALID, wasteFactorMultiplier: 0.9 });

    // ASSERT
    expect(
      result.ok,
      `A 0.9 factor would bill 90 LF for a 100 LF order. §2.1's "never under-order" makes ` +
        `that a contradiction, not a setting. Got ${JSON.stringify(result)}.`
    ).toBe(false);
    expect(
      result.ok === false ? result.errors[0].field : '',
      `The error must name 'wasteFactorMultiplier'. Got ${JSON.stringify(result)}.`
    ).toBe('wasteFactorMultiplier');
  });

  it('rejects a multiplier above 2, the likely data-entry slip', () => {
    // ARRANGE — assumption A-01: 110 typed where 1.10 was meant
    // ACT
    const result = validateMaterialCalcInput({ ...VALID, wasteFactorMultiplier: 110 });

    // ASSERT
    expect(
      result.ok,
      `A factor of 110 would bill 11,000 LF for a 100 LF order. It is refused and the ` +
        `documented default used instead. Got ${JSON.stringify(result)}.`
    ).toBe(false);
  });

  it('rejects a multiplier just above the maximum, proving the boundary is exact', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({ ...VALID, wasteFactorMultiplier: 2.1 });

    // ASSERT
    expect(
      result.ok,
      `2.1 is above the config maximum of ${MATERIAL_CALCULATOR_CONFIG.maximumWasteFactorMultiplier} ` +
        `and must be rejected, so the band is a real boundary and not a rough guide. ` +
        `Got ${JSON.stringify(result)}.`
    ).toBe(false);
  });
});

describe('validateMaterialCalcInput — stockLengthFt', () => {
  it('accepts an omitted stock length, which means the profile has none on file', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput(VALID);

    // ASSERT
    expect(
      result,
      `Five of the wizard's profile labels have no product_profiles row and therefore no ` +
        `standard length. That is not an error — §2.3 just hides. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it('rejects a zero or negative stock length', () => {
    for (const value of [0, -10]) {
      // ARRANGE / ACT
      const result = validateMaterialCalcInput({ ...VALID, stockLengthFt: value });

      // ASSERT
      expect(
        result.ok,
        `A stock length of ${value} ft must be rejected. Got ${JSON.stringify(result)}.`
      ).toBe(false);
    }
  });

  it('rejects a stock length at or below the saw kerf, which would divide by zero', () => {
    // ARRANGE — optimizeTrimLength divides by (stockLengthFt - kerfAllowanceFt)
    const atKerf = MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt;

    // ACT
    const result = validateMaterialCalcInput({ ...VALID, stockLengthFt: atKerf });

    // ASSERT
    expect(
      result.ok,
      `A stock length equal to the kerf (${atKerf} ft) makes the usable length zero, and ` +
        `the piece count Infinity. The spec guards neither. Got ${JSON.stringify(result)}.`
    ).toBe(false);
  });

  it('accepts a 10 ft stock length, the ordinary case', () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({ ...VALID, stockLengthFt: 10 });

    // ASSERT
    expect(
      result,
      `10 ft is §2.3's own worked example stock length. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });
});

/**
 * RESOURCE GUARDS, not business rules.
 *
 * POST /api/calculator/materials is PUBLIC and unauthenticated — the quote wizard
 * supports guest submission — so its inputs are attacker-controlled.
 * `optimizeTrimLength` builds a cut list with one object per piece, which makes the
 * piece count an allocation size: a request for 1e9 ft x 1e9 pieces against a
 * hand-picked stock length asks the server for tens of millions of objects.
 */
describe('validateMaterialCalcInput — resource guards on a public route', () => {
  it('rejects a total footage beyond what the calculator handles', () => {
    // ARRANGE — 1e9 ft x 1e9 pieces is 1e18 LF
    const input: MaterialCalcInput = { lengthFt: 1e9, quantity: 1e9 };

    // ACT
    const result = validateMaterialCalcInput(input);

    // ASSERT
    expect(
      result.ok,
      `1e18 LF must be refused. Each field is individually positive and finite, so the ` +
        `only thing that catches it is the combined bound — and without it this reaches ` +
        `the cut-list loop. Got ${JSON.stringify(result)}.`
    ).toBe(false);
  });

  it(`accepts exactly ${MATERIAL_CALCULATOR_CONFIG.maxRawQuantityLf} LF, the bound itself`, () => {
    // ARRANGE / ACT
    const result = validateMaterialCalcInput({
      lengthFt: MATERIAL_CALCULATOR_CONFIG.maxRawQuantityLf,
      quantity: 1,
    });

    // ASSERT
    expect(
      result,
      `The bound is inclusive: it marks where an input stops being an order, not where ` +
        `AFS declines the work. Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it('accepts a large but real order — 500 pieces of 20 ft', () => {
    // ARRANGE — 10,000 LF, a genuinely big commercial job
    // ACT
    const result = validateMaterialCalcInput({ lengthFt: 20, quantity: 500, stockLengthFt: 10 });

    // ASSERT
    expect(
      result,
      `A 10,000 LF job on 10 ft stock is about 1,002 pieces — a real order that must not ` +
        `be caught by a guard aimed at 33-million-piece requests. ` +
        `Got ${JSON.stringify(result)}.`
    ).toEqual({ ok: true });
  });

  it('rejects a cut list longer than the calculator will build', () => {
    // ARRANGE — 100,000 LF against 1 ft stock is about 100,002 pieces
    const input: MaterialCalcInput = { lengthFt: 100000, quantity: 1, stockLengthFt: 1 };

    // ACT
    const result = validateMaterialCalcInput(input);

    // ASSERT
    expect(
      result.ok,
      `A six-figure piece count must be refused before optimizeTrimLength allocates one ` +
        `object per piece. Got ${JSON.stringify(result)}.`
    ).toBe(false);
    expect(
      result.ok === false ? result.errors[0].field : '',
      `The error must name 'stockLengthFt', since that is the field that makes the piece ` +
        `count explode. Got ${JSON.stringify(result)}.`
    ).toBe('stockLengthFt');
  });

  it('reports the footage problem rather than the piece-count problem when both apply', () => {
    // ARRANGE — an absurd footage AND an absurd stock length
    const input: MaterialCalcInput = { lengthFt: 1e9, quantity: 1e9, stockLengthFt: 0.03 };

    // ACT
    const result = validateMaterialCalcInput(input);

    // ASSERT
    expect(
      result.ok === false ? result.errors.map((e) => e.field) : [],
      `The footage bound is the root cause and the piece count is its consequence, so ` +
        `only the footage is reported — and critically, the piece count is never COMPUTED ` +
        `for an input this size. Got ${JSON.stringify(result)}.`
    ).toEqual(['quantity']);
  });

  it('reports a bad length as a bad length, not as an oversized order', () => {
    // ARRANGE — the resource guards must not run on fields that are already invalid
    const input = { lengthFt: Number.NaN, quantity: 10 } as MaterialCalcInput;

    // ACT
    const result = validateMaterialCalcInput(input);

    // ASSERT
    expect(
      result.ok === false ? result.errors.map((e) => e.field) : [],
      `NaN x 10 is NaN, which is not greater than any bound, so the guards must be ` +
        `skipped and the real problem named. Got ${JSON.stringify(result)}.`
    ).toEqual(['lengthFt']);
  });

  it('calculateMaterials refuses an allocation-sized request instead of attempting it', () => {
    // ARRANGE — the end-to-end guard: this is the call the public route makes
    const input: MaterialCalcInput = { lengthFt: 1e9, quantity: 1e9, stockLengthFt: 0.03 };

    // ACT / ASSERT
    expect(
      () => calculateMaterials(input),
      `calculateMaterials must throw before optimizeTrimLength is reached. If this test ` +
        `ever hangs or runs out of memory instead of throwing, the guard has been removed ` +
        `and the public route is a denial-of-service vector.`
    ).toThrow(MaterialCalcInputError);
  });
});

describe('validateMaterialCalcInput — several bad fields at once', () => {
  it('reports every offending field rather than stopping at the first', () => {
    // ARRANGE
    const input = { lengthFt: 0, quantity: -1, wasteFactorMultiplier: 5 } as MaterialCalcInput;

    // ACT
    const result = validateMaterialCalcInput(input);

    // ASSERT
    expect(
      result.ok === false ? result.errors.map((e) => e.field).sort() : [],
      `All three bad fields must be reported together so the caller fixes them in one ` +
        `round trip. Got ${JSON.stringify(result)}.`
    ).toEqual(['lengthFt', 'quantity', 'wasteFactorMultiplier']);
  });
});

describe('MaterialCalcInputError — how the refusal reaches the caller', () => {
  it('assertValidMaterialCalcInput throws with the details attached', () => {
    // ARRANGE
    const input = { lengthFt: 0, quantity: 10 } as MaterialCalcInput;

    // ACT / ASSERT
    let thrown: unknown = null;
    try {
      assertValidMaterialCalcInput(input);
    } catch (error) {
      thrown = error;
    }

    expect(
      thrown instanceof MaterialCalcInputError,
      `A zero length must throw MaterialCalcInputError specifically, so the API route can ` +
        `answer 400 rather than 500. Got ${String(thrown)}.`
    ).toBe(true);
    expect(
      thrown instanceof MaterialCalcInputError ? thrown.details : [],
      `The thrown error must carry the field-level details, or the 400 response has ` +
        `nothing useful to say. Got ${JSON.stringify(thrown)}.`
    ).toEqual([{ field: 'lengthFt', message: 'Length must be greater than zero.' }]);
  });

  it('names every bad field in the message when there is more than one', () => {
    // ARRANGE
    const input = { lengthFt: 0, quantity: 0 } as MaterialCalcInput;

    // ACT
    let message = '';
    try {
      assertValidMaterialCalcInput(input);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    // ASSERT
    expect(
      message,
      `With two bad fields the message must list both field names, because a server log ` +
        `showing only the first hides half the problem. Got "${message}".`
    ).toBe('2 inputs are not valid: lengthFt, quantity');
  });

  it('calculateMaterials refuses bad input instead of returning a zeroed result', () => {
    // ARRANGE
    const input = { lengthFt: -5, quantity: 10 } as MaterialCalcInput;

    // ACT / ASSERT
    expect(
      () => calculateMaterials(input),
      `calculateMaterials must throw on a negative length. Returning a -55 LF or a 0 LF ` +
        `result would put a number on the screen that looks like an answer.`
    ).toThrow(MaterialCalcInputError);
  });

  it('calculateMaterials accepts the minimum valid order: 1 piece of 1 ft', () => {
    // ARRANGE / ACT
    const result = calculateMaterials({ lengthFt: 1, quantity: 1 });

    // ASSERT
    expect(
      result.waste,
      `The smallest real order must compute: 1 LF raw, 2 LF billed at the 10% default ` +
        `(1.1 rounds up to 2). Got ${JSON.stringify(result.waste)}.`
    ).toEqual({
      rawQtyLf: 1,
      wasteFactorPct: 10,
      wasteQtyLf: 1,
      adjustedQtyLf: 2,
      isEstimated: true,
    });
  });
});
