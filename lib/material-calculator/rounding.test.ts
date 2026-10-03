import { describe, expect, it } from 'vitest';
import { ceilQuantity, roundToWhole } from './rounding';

/**
 * THE REGRESSION TESTS FOR A LIVE BUG.
 *
 * `Math.ceil(100 * 1.1)` is 111. SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1's worked
 * example is "100 LF + 10% waste = 110 LF", and the shipped
 * lib/utils/material-calc.ts produced 111 for that input — so
 * components/quote/WasteFactorDisplay.tsx was over-billing every round order on
 * /quote Step 2 by one foot.
 *
 * These tests pin each expression that was wrong. If somebody later
 * "simplifies" rounding.ts back to bare Math.ceil / Math.round, these fail first
 * and name the reason.
 */
describe('ceilQuantity — Math.ceil without the floating-point foot', () => {
  it('recognises 100 * 1.1 as 110, which bare Math.ceil calls 111', () => {
    // ARRANGE — the exact expression that shipped wrong
    const product = 100 * 1.1;

    // ASSERT the premise first, so this test cannot become vacuous if the
    // platform's arithmetic ever changes
    expect(
      Math.ceil(product),
      `The premise of this whole module: Math.ceil(100 * 1.1) must really be 111, ` +
        `because 100 * 1.1 is ${product}. If this is ever 110, rounding.ts is no longer ` +
        `needed and should be deleted rather than left as a mystery.`
    ).toBe(111);

    // ACT
    const billed = ceilQuantity(product);

    // ASSERT
    expect(
      billed,
      `ceilQuantity(100 * 1.1) must be 110 — the figure SPEC §2.1 prints. Got ${billed}. ` +
        `A customer quoted 111 LF for a 100 LF order at 10% waste is being over-billed a ` +
        `foot of metal by a rounding artefact.`
    ).toBe(110);
  });

  it('recognises 25 * 2.2 as 55, which bare Math.ceil calls 56', () => {
    // ARRANGE — the per_piece case: 25 pieces at 2.2 boxes each
    const product = 25 * 2.2;
    expect(
      Math.ceil(product),
      `Premise: Math.ceil(25 * 2.2) must really be 56, because 25 * 2.2 is ${product}.`
    ).toBe(56);

    // ACT / ASSERT
    expect(
      ceilQuantity(product),
      `25 pieces at a per_piece rate of 2.2 is exactly 55 boxes, not 56. ` +
        `Got ${ceilQuantity(product)}.`
    ).toBe(55);
  });

  it('recognises 21 / 0.7 as 30, which bare Math.ceil calls 31', () => {
    // ARRANGE — the per_lf case: 21 LF at one unit per 0.7 LF
    const quotient = 21 / 0.7;
    expect(
      Math.ceil(quotient),
      `Premise: Math.ceil(21 / 0.7) must really be 31, because 21 / 0.7 is ${quotient}.`
    ).toBe(31);

    // ACT / ASSERT
    expect(
      ceilQuantity(quotient),
      `21 LF at one unit per 0.7 LF is exactly 30 units, not 31. ` +
        `Got ${ceilQuantity(quotient)}.`
    ).toBe(30);
  });

  it('still rounds a genuine fraction UP — it removes dust, it does not round down', () => {
    // ARRANGE — 47 * 1.1 = 51.7, a real remainder
    // ACT / ASSERT
    expect(
      ceilQuantity(47 * 1.1),
      `51.7 LF must still bill 52. The whole point of §2.1 is never to under-order, so ` +
        `the dust fix must not turn into a round-down. Got ${ceilQuantity(47 * 1.1)}.`
    ).toBe(52);
    expect(
      ceilQuantity(110.0001),
      `A remainder of one ten-thousandth is far above the snapping precision and must ` +
        `still round up to 111. Got ${ceilQuantity(110.0001)}.`
    ).toBe(111);
  });

  it('leaves whole numbers, zero and negatives alone', () => {
    // ARRANGE / ACT / ASSERT
    expect(ceilQuantity(110), 'An exact 110 must stay 110.').toBe(110);
    expect(ceilQuantity(0), 'Zero must stay zero, not become 1.').toBe(0);
    expect(
      ceilQuantity(-51.7),
      `Math.ceil(-51.7) is -51 and must stay -51: this helper changes rounding precision, ` +
        `not direction. Rejecting negatives is validate.ts's job. Got ${ceilQuantity(-51.7)}.`
    ).toBe(-51);
  });

  it('passes non-finite values straight through instead of inventing a number', () => {
    // ARRANGE / ACT / ASSERT
    expect(
      Number.isNaN(ceilQuantity(Number.NaN)),
      'NaN must stay NaN so the caller can refuse the row, rather than being snapped to 0.'
    ).toBe(true);
    expect(
      ceilQuantity(Number.POSITIVE_INFINITY),
      'Infinity must stay Infinity so the caller can refuse the row.'
    ).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('roundToWhole — Math.round without the lost half percent', () => {
  it('recognises (1.075 - 1) * 100 as 7.5 and rounds it to 8, where bare Math.round gives 7', () => {
    // ARRANGE — the exact expression the §3 percentage label is built from
    const percent = (1.075 - 1) * 100;

    // ASSERT the premise
    expect(
      Math.round(percent),
      `Premise: Math.round((1.075 - 1) * 100) must really be 7, because the product is ` +
        `${percent}.`
    ).toBe(7);

    // ACT / ASSERT
    expect(
      roundToWhole(percent),
      `A stored waste_factor of 1.075 is 7.5% and must display as 8%, not 7%. ` +
        `Got ${roundToWhole(percent)}.`
    ).toBe(8);
  });

  it('rounds an ordinary value exactly as Math.round does', () => {
    // ARRANGE / ACT / ASSERT
    expect(roundToWhole(10), 'A whole 10 must stay 10.').toBe(10);
    expect(roundToWhole(7.4), '7.4 must round to 7.').toBe(7);
    expect(roundToWhole(7.6), '7.6 must round to 8.').toBe(8);
    expect(roundToWhole(0), 'Zero percent must stay zero.').toBe(0);
  });
});
