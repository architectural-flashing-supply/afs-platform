import { describe, it, expect } from 'vitest';
import { optimizeTrimLength } from './trim-optimizer';

/**
 * CHARACTERISATION TESTS FOR THE SHIPPED CONTINUOUS-RUN OPTIMIZER.
 *
 * This function is specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §2 transcribed, and it
 * is already wired into the customer's quote form (app/quote/page.tsx Step 2).
 * These tests exist to PIN what it prints today, so the guard added alongside
 * them cannot change any answer a customer is already being given.
 *
 * It answers a different question from lib/trim-optimizer/'s packer — see that
 * directory's types.ts header. Nothing here is a judgement about which model is
 * better; this one is the one on screen.
 */

describe("the spec's own worked example", () => {
  it('turns 47 LF into 5 pieces of 10 ft stock, wasting 3 LF (6%)', () => {
    // ARRANGE — specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §3's illustration, verbatim:
    // "You need 47 LF. We stock this profile in 10 ft lengths." -> 5 pieces,
    // 50 ft ordered, waste 3 LF (6%).

    // ACT
    const result = optimizeTrimLength(47, 10);

    // ASSERT
    expect(result.stockLengthFt, 'the stock length is echoed back').toBe(10);
    expect(result.piecesOrdered, 'ceil(47 / (10 - 0.0208)) is 5').toBe(5);
    expect(result.totalStockFt, '5 pieces x 10 ft').toBe(50);
    expect(result.wasteLinearFt, '50 ft ordered less 47 LF needed').toBe(3);
    expect(result.wastePercent, '3 of 50 ft is 6%').toBe(6);
    expect(result.cutList.length, 'one cut-list entry per piece ordered').toBe(5);
  });

  it('marks the first four pieces full length and the fifth an off-cut', () => {
    // ACT
    const { cutList } = optimizeTrimLength(47, 10);

    // ASSERT — the first four consume the whole usable length, so their
    // remainder is zero and the spec's own wording is "Full length".
    for (const piece of cutList.slice(0, 4)) {
      expect(piece.remainderFt, `piece ${piece.pieceNumber} has no remainder`).toBe(0);
      expect(piece.cuttingInstructions, `piece ${piece.pieceNumber} is a full length`).toBe(
        'Full length'
      );
    }

    expect(cutList[0].pieceNumber, 'pieces are numbered from 1').toBe(1);
    expect(cutList[4].pieceNumber, 'through to the last').toBe(5);
    expect(cutList[4].lengthFt, 'the fifth piece carries what is left of the 47 LF').toBe(7.08);
    expect(cutList[4].remainderFt, 'and leaves an off-cut').toBe(2.9);
    expect(cutList[4].cuttingInstructions, 'which the shop is told about in feet').toBe(
      'Cut to 7.08 ft — 2.90 ft remainder'
    );
  });
});

describe('the continuous-run model, at its boundaries', () => {
  it('orders one piece for a run that exactly fills one usable length', () => {
    // ARRANGE — 10 ft stock less the 0.0208 ft blade allowance is 9.9792 ft of
    // usable run per piece.
    const result = optimizeTrimLength(9.9792, 10);

    expect(result.piecesOrdered, 'exactly one usable length needs exactly one piece').toBe(1);
    expect(result.cutList[0].remainderFt, 'with nothing left on it').toBe(0);
    expect(result.cutList[0].cuttingInstructions, 'so it is a full length').toBe('Full length');
  });

  it('orders a second piece for one hundredth of a foot more', () => {
    const result = optimizeTrimLength(9.9892, 10);

    expect(
      result.piecesOrdered,
      'a run a hundredth of a foot past one usable length needs two pieces'
    ).toBe(2);
  });

  it('charges the blade allowance against every piece, so 100 LF needs 11 lengths', () => {
    // ARRANGE — this is the model's defining conservatism and it is deliberate:
    // 100 / 9.9792 is 10.0208, so ten 10 ft sticks are not quite enough.
    const result = optimizeTrimLength(100, 10);

    expect(result.piecesOrdered, 'ceil(100 / 9.9792) is 11').toBe(11);
    expect(result.totalStockFt, '11 x 10 ft').toBe(110);
    expect(result.wasteLinearFt, '110 less 100').toBe(10);
  });

  it('respects a caller-supplied blade allowance', () => {
    // ARRANGE — zero kerf makes the usable length the whole stick.
    const result = optimizeTrimLength(50, 10, 0);

    expect(result.piecesOrdered, '50 / 10 is exactly 5 pieces with no blade loss').toBe(5);
    expect(result.wasteLinearFt, 'and nothing is wasted').toBe(0);
    expect(result.wastePercent, 'so the waste is 0%').toBe(0);
  });

  it('orders one piece for a run shorter than one stick', () => {
    const result = optimizeTrimLength(4, 10);

    expect(result.piecesOrdered, 'a 4 LF run still needs a whole stick').toBe(1);
    expect(result.cutList[0].lengthFt, 'cut to the 4 ft needed').toBe(4);
    expect(result.cutList[0].remainderFt, 'leaving 5.98 ft of the usable length').toBe(5.98);
    expect(result.cutList[0].cuttingInstructions, 'and the off-cut is called out').toBe(
      'Cut to 4.00 ft — 5.98 ft remainder'
    );
  });

  it('calls a remainder of half a foot or less a full length', () => {
    // ARRANGE — the spec's threshold is `remainder > 0.5`. 9.4792 ft of run
    // leaves exactly 0.5 ft of the usable 9.9792 ft, which is NOT more than 0.5.
    const result = optimizeTrimLength(9.4792, 10);

    expect(result.cutList[0].remainderFt, 'half a foot is left').toBe(0.5);
    expect(
      result.cutList[0].cuttingInstructions,
      'and at exactly half a foot the spec still says full length'
    ).toBe('Full length');
  });
});

describe('the guard: an unusable stock length produces an empty result, not a hung tab', () => {
  // Before this guard existed, `stockLengthFt - kerfAllowanceFt <= 0` gave
  // `piecesNeeded = Infinity` and an unbounded for-loop, or a negative count and
  // a silently empty cut list. The live component guards `stockLengthFt > 0`,
  // which does not cover 0 < stockLengthFt <= kerf. A vitest testTimeout would
  // catch the hang, but only after the whole suite had stalled.

  const EMPTY = {
    piecesOrdered: 0,
    totalStockFt: 0,
    cutList: [],
    wastePercent: 0,
    wasteLinearFt: 0,
  };

  it('returns nothing to cut when the stock length equals the blade width', () => {
    const result = optimizeTrimLength(47, 0.0208);

    expect(result, 'a stick entirely consumed by the blade yields no pieces').toEqual({
      stockLengthFt: 0.0208,
      ...EMPTY,
    });
  });

  it('returns nothing to cut when the stock length is shorter than the blade width', () => {
    const result = optimizeTrimLength(47, 0.01);

    expect(result, 'and neither does a stick shorter than the blade').toEqual({
      stockLengthFt: 0.01,
      ...EMPTY,
    });
  });

  it('returns nothing to cut for a zero or negative run', () => {
    for (const neededLf of [0, -10]) {
      expect(
        optimizeTrimLength(neededLf, 10),
        `a run of ${neededLf} LF asks for nothing`
      ).toEqual({ stockLengthFt: 10, ...EMPTY });
    }
  });

  it('returns nothing to cut for a non-finite input, rather than Infinity pieces', () => {
    for (const [neededLf, stockLengthFt] of [
      [Number.NaN, 10],
      [47, Number.NaN],
      [Number.POSITIVE_INFINITY, 10],
      [47, Number.POSITIVE_INFINITY],
    ]) {
      const result = optimizeTrimLength(neededLf, stockLengthFt);
      expect(
        result.piecesOrdered,
        `(${String(neededLf)}, ${String(stockLengthFt)}) must order no pieces`
      ).toBe(0);
      expect(result.cutList, 'and list no cuts').toEqual([]);
    }
  });

  it('returns nothing to cut for a non-finite or negative blade allowance', () => {
    for (const kerf of [Number.NaN, -1]) {
      const result = optimizeTrimLength(47, 10, kerf);
      expect(result.piecesOrdered, `a ${String(kerf)} ft blade is not a blade`).toBe(0);
    }
  });
});
