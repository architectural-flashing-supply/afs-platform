import { describe, expect, it } from 'vitest';
import { MATERIAL_CALCULATOR_CONFIG } from './config';
import { applyWasteFactor, calculateWasteAdjustedQuantity } from './waste';

/**
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1 — WASTE FACTOR.
 *
 * These tests are the contract for the formula that decides how much metal a
 * customer is billed for. Every assertion is an exact comparison against a
 * hand-computed value, because "about 110 LF" is not a quantity anybody can
 * fabricate from.
 */
describe('applyWasteFactor — SPEC §2.1', () => {
  it('returns the spec worked example exactly: 100 LF at 1.10 bills 110 LF', () => {
    // ARRANGE — the spec's own figures: "Your order: 100 LF + 10% waste = 110 LF"
    const rawQuantityLf = 100;
    const multiplier = 1.1;

    // ACT
    const billed = applyWasteFactor(rawQuantityLf, multiplier);

    // ASSERT
    expect(
      billed,
      `100 LF at a 1.10 waste factor must bill exactly 110 LF — the figure printed in ` +
        `SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1. Got ${billed}. This is the number the ` +
        `customer is quoted against, so it cannot drift.`
    ).toBe(110);
  });

  it('always rounds UP, never down: 47 LF at 1.10 is 51.7 and bills 52', () => {
    // ARRANGE — 47 * 1.1 = 51.7, which rounds DOWN to 51 under Math.round
    const rawQuantityLf = 47;

    // ACT
    const billed = applyWasteFactor(rawQuantityLf, 1.1);

    // ASSERT
    expect(
      billed,
      `47 LF at 1.10 is 51.7 LF and must bill 52, not 51. §2.1's comment is ` +
        `"Always round UP — never under-order": a rounded-down figure ships a job short.`
    ).toBe(52);
  });

  it('leaves an already-whole result alone rather than adding a foot', () => {
    // ARRANGE — 200 * 1.1 = 220 exactly
    // ACT
    const billed = applyWasteFactor(200, 1.1);

    // ASSERT
    expect(
      billed,
      `200 LF at 1.10 is exactly 220 LF. Math.ceil must not inflate an exact result ` +
        `to 221. Got ${billed}.`
    ).toBe(220);
  });

  it('uses the documented 1.10 default when no multiplier is supplied', () => {
    // ARRANGE / ACT
    const billed = applyWasteFactor(100);

    // ASSERT
    expect(
      billed,
      `With no multiplier the config default (${MATERIAL_CALCULATOR_CONFIG.defaultWasteFactorMultiplier}) ` +
        `must apply, giving 110. Got ${billed}. A different default would silently change ` +
        `every quantity on the quote wizard.`
    ).toBe(110);
  });

  it('honours a real per-product multiplier instead of the default', () => {
    // ARRANGE — copper is cut more precisely than painted steel (§2.1's own note)
    // ACT
    const billed = applyWasteFactor(100, 1.05);

    // ASSERT
    expect(
      billed,
      `100 LF at a 1.05 factor must bill 105 LF, proving a real pricing_rules.waste_factor ` +
        `overrides the default. Got ${billed}.`
    ).toBe(105);
  });

  it('is tolerant arithmetic, not a guard: a zero quantity returns 0 rather than throwing', () => {
    // ARRANGE — components/quote/WasteFactorDisplay.tsx guards its own inputs and
    // calls this directly. Making it throw would change a shipped screen.
    // ACT
    const billed = applyWasteFactor(0, 1.1);

    // ASSERT
    expect(
      billed,
      `applyWasteFactor(0) must return 0 and must not throw: rejection is validate.ts's ` +
        `job at the library boundary, and WasteFactorDisplay relies on this staying ` +
        `tolerant. Got ${billed}.`
    ).toBe(0);
  });

  it('handles a fractional raw quantity, which a half-foot length produces', () => {
    // ARRANGE — the wizard's length input has step="0.5", so 10.5 ft x 3 is real
    const rawQuantityLf = 31.5;

    // ACT
    const billed = applyWasteFactor(rawQuantityLf, 1.1);

    // ASSERT — 31.5 * 1.1 = 34.65
    expect(
      billed,
      `31.5 LF at 1.10 is 34.65 LF and must bill 35. The quote wizard's length field ` +
        `steps in half feet, so a fractional raw quantity is an ordinary input. Got ${billed}.`
    ).toBe(35);
  });
});

describe('calculateWasteAdjustedQuantity — the §3 display breakdown', () => {
  it('breaks 10 ft x 10 pieces into the four figures §3 prints', () => {
    // ARRANGE
    const lengthFt = 10;
    const quantity = 10;

    // ACT
    const result = calculateWasteAdjustedQuantity(lengthFt, quantity);

    // ASSERT
    expect(
      result,
      `§3's panel prints "Your quantity 100 LF / + Waste factor (10%) +10 LF / Total ` +
        `ordered 110 LF". All four figures must come from one call so the lines cannot ` +
        `disagree with each other. Got ${JSON.stringify(result)}.`
    ).toEqual({
      rawQtyLf: 100,
      wasteFactorPct: 10,
      wasteQtyLf: 10,
      adjustedQtyLf: 110,
      isEstimated: true,
    });
  });

  it('reports the waste footage as the real difference, not as a recomputed percentage', () => {
    // ARRANGE — 47 * 1.1 = 51.7, billed 52, so the real waste is 5 LF not 4.7
    // ACT
    const result = calculateWasteAdjustedQuantity(47, 1);

    // ASSERT
    expect(
      result.wasteQtyLf,
      `wasteQtyLf must be adjustedQtyLf - rawQtyLf (52 - 47 = 5), the footage actually ` +
        `added, not 10% of 47 (4.7). The three printed lines have to add up. Got ${result.wasteQtyLf}.`
    ).toBe(5);
  });

  it('marks the factor ESTIMATED when nothing supplied one', () => {
    // ARRANGE / ACT
    const result = calculateWasteAdjustedQuantity(10, 10, null);

    // ASSERT
    expect(
      result.isEstimated,
      `A null multiplier means no pricing_rules row was readable, so §3 must print ` +
        `"(estimated)". Dropping that qualifier would present a placeholder as real data.`
    ).toBe(true);
  });

  it('marks the factor MEASURED when a real one was supplied — even when it equals the 1.10 default', () => {
    // ARRANGE — pricing_rules.waste_factor DEFAULTS TO 1.10 in migration 001 line 279,
    // so a real row carrying 1.10 is indistinguishable by value from the placeholder.
    const realMultiplierThatEqualsTheDefault = 1.1;

    // ACT
    const result = calculateWasteAdjustedQuantity(10, 10, realMultiplierThatEqualsTheDefault);

    // ASSERT
    expect(
      result.isEstimated,
      `A supplied 1.10 came from a real pricing_rules row and must NOT be badged ` +
        `"estimated" merely for agreeing with the spec's placeholder. This is why ` +
        `isEstimated is derived from whether a multiplier was supplied, not from its value.`
    ).toBe(false);
  });

  it('rounds the displayed percentage to a whole number', () => {
    // ARRANGE — a stored 1.075 is 7.5%, which has no place in a one-line label
    // ACT
    const result = calculateWasteAdjustedQuantity(100, 1, 1.075);

    // ASSERT
    expect(
      result.wasteFactorPct,
      `A 1.075 factor must display as 8%, not 7.5% or 7.499999%. Got ${result.wasteFactorPct}.`
    ).toBe(8);
  });

  it('reports 0% for a factor of exactly 1.0, the no-waste boundary', () => {
    // ARRANGE / ACT
    const result = calculateWasteAdjustedQuantity(100, 1, 1);

    // ASSERT
    expect(
      result,
      `A factor of exactly 1.0 is the lowest the config permits and must add nothing: ` +
        `100 LF in, 100 LF billed, 0% shown. Got ${JSON.stringify(result)}.`
    ).toEqual({
      rawQtyLf: 100,
      wasteFactorPct: 0,
      wasteQtyLf: 0,
      adjustedQtyLf: 100,
      isEstimated: false,
    });
  });

  it('reports 100% for a factor of exactly 2.0, the highest the config permits', () => {
    // ARRANGE / ACT
    const result = calculateWasteAdjustedQuantity(100, 1, MATERIAL_CALCULATOR_CONFIG.maximumWasteFactorMultiplier);

    // ASSERT
    expect(
      result.adjustedQtyLf,
      `The config's maximum factor (${MATERIAL_CALCULATOR_CONFIG.maximumWasteFactorMultiplier}) ` +
        `must still compute rather than being clamped somewhere unseen: 100 LF bills 200 LF. ` +
        `Got ${result.adjustedQtyLf}.`
    ).toBe(200);
  });
});
