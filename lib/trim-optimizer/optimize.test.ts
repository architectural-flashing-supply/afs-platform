import { describe, it, expect } from 'vitest';
import {
  optimizeCutPlan,
  stockLengthFromFeet,
  DEFAULT_KERF_IN,
  DEFAULT_STRATEGY,
  MAX_TOTAL_PIECES,
} from './optimize';
import type { CutPlan, CutPlanInput, CutPlanResult, CutStrategy } from './types';

/* ------------------------------------------------------------------ fixtures */

/**
 * Explicit, versioned fixtures — never generated, never random. Lengths are in
 * inches; 120 in is the 10 ft standard length ten of the twelve seeded
 * `product_profiles` rows carry, and 240 in is the 20 ft one
 * `standing-seam-roofing` carries.
 */
const STOCK_10FT = { lengthIn: 120, label: '10 ft standard' } as const;
const STOCK_20FT = { lengthIn: 240, label: '20 ft' } as const;

/** Asserts ok and narrows, with a diagnostic naming the error if it is not. */
function expectPlan(result: CutPlanResult): CutPlan {
  if (!result.ok) {
    throw new Error(
      `expected a plan, got error ${result.error.code}: ${result.error.message}`
    );
  }
  return result.plan;
}

/* --------------------------------------------------------------- happy path */

describe('optimizeCutPlan: happy path', () => {
  it('gives each 8 ft piece its own 10 ft bar, because two will not fit', () => {
    // ARRANGE — 10 pieces of 96 in. Two on one 120 in bar would need
    // 96 + 96 + 0.25 = 192.25 in, so one per bar is the only arrangement.
    const input: CutPlanInput = {
      pieces: [{ id: 'line-1', profile: 'coping-cap', lengthIn: 96, quantity: 10 }],
      stockLengths: [STOCK_10FT],
    };

    // ACT
    const plan = expectPlan(optimizeCutPlan(input));

    // ASSERT
    expect(plan.totals.stockPieceCount, '10 pieces, one per bar, is 10 bars').toBe(10);
    expect(plan.totals.requiredLengthIn, '10 x 96 in of finished metal').toBe(960);
    expect(plan.totals.totalStockLengthIn, '10 bars x 120 in').toBe(1200);
    expect(plan.totals.kerfLengthIn, 'one severing cut per bar at 1/4 in').toBe(2.5);
    expect(plan.totals.leftoverLengthIn, '120 - 96 - 0.25 = 23.75 in per bar').toBe(237.5);
    expect(plan.totals.wasteLengthIn, 'kerf 2.5 + leftover 237.5').toBe(240);
    expect(plan.totals.wastePercent, '240 of 1200 in is 20%').toBe(20);

    const first = firstBar(plan);
    expect(first.cuts.length, 'one cut per bar').toBe(1);
    expect(first.cuts[0].pieceId, 'the cut names the line that asked for it').toBe('line-1');
    expect(first.cuts[0].lengthIn, 'cut at the requested 96 in').toBe(96);
    expect(first.stockLengthIn, 'from the 10 ft bar').toBe(120);
    expect(first.stockLabel, 'the bar carries its label through').toBe('10 ft standard');
    expect(first.utilizationPercent, '96 of 120 in is 80%').toBe(80);
    expect(first.index, 'stock pieces are numbered from 1 across the whole plan').toBe(1);
    expect(first.cuttingInstructions, 'the shop sentence names the cut and the off-cut').toBe(
      'Cut 1 piece from 120" stock: 96", 1/4" blade loss, 23 3/4" off-cut'
    );
  });

  it('nests three 4 ft pieces and one 2 ft piece into two bars', () => {
    // ARRANGE — 3 x 48 in + 1 x 24 in = 168 in of finished metal. All four on
    // one bar would need 168 + 3 x 0.25 = 168.75 in, so two bars is the floor;
    // the question is the arrangement.
    const input: CutPlanInput = {
      pieces: [
        { id: 'long', profile: 'drip-edge', lengthIn: 48, quantity: 3 },
        { id: 'short', profile: 'drip-edge', lengthIn: 24, quantity: 1 },
      ],
      stockLengths: [STOCK_10FT],
    };

    // ACT
    const plan = expectPlan(optimizeCutPlan(input));

    // ASSERT — bar 1 takes 48 + 48 (96 + 0.25 kerf), bar 2 takes 48 + 24.
    // 48 + 48 + 24 = 120 plus two kerfs is 120.5, which overruns the bar.
    expect(plan.totals.stockPieceCount, 'two bars').toBe(2);
    expect(
      firstBar(plan).cuts.map((cut) => cut.lengthIn),
      'the first bar takes the two longest pieces'
    ).toEqual([48, 48]);
    expect(
      plan.profiles[0].stockPieces[1].cuts.map((cut) => cut.lengthIn),
      'the second bar takes the remaining long piece and the short one'
    ).toEqual([48, 24]);
    expect(plan.totals.requiredLengthIn, '3 x 48 + 24').toBe(168);
    expect(plan.totals.totalStockLengthIn, '2 x 120').toBe(240);
    expect(plan.totals.kerfLengthIn, 'each bar makes 2 cuts at 1/4 in').toBe(1);
    expect(plan.totals.leftoverLengthIn, '23.5 + 47.5').toBe(71);
    expect(plan.totals.wastePercent, '72 of 240 in is 30%').toBe(30);
    expect(
      firstBar(plan).cuttingInstructions,
      'identical lengths are grouped, not listed twice'
    ).toBe('Cut 2 pieces from 120" stock: 2 × 48", 1/2" blade loss, 23 1/2" off-cut');
  });

  it('echoes the resolved settings, including the default kerf and strategy', () => {
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'a', profile: 'fascia', lengthIn: 60, quantity: 1 }],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(plan.settings.kerfIn, "the spec's ~1/4 in blade width").toBe(DEFAULT_KERF_IN);
    expect(plan.settings.kerfIn, 'which is exactly 0.25 in on the 1/16 grid').toBe(0.25);
    expect(plan.settings.strategy, 'best-fit-decreasing by default').toBe(DEFAULT_STRATEGY);
  });

  it('never nests two different profiles into one stock piece', () => {
    // ARRANGE — a coping cap and a drip edge are different blanks off different
    // coils. 96 + 24 would fit a 120 in bar numerically; it must not happen.
    const input: CutPlanInput = {
      pieces: [
        { id: 'cap', profile: 'coping-cap', lengthIn: 96, quantity: 1 },
        { id: 'edge', profile: 'drip-edge', lengthIn: 24, quantity: 1 },
      ],
      stockLengths: [STOCK_10FT],
    };

    // ACT
    const plan = expectPlan(optimizeCutPlan(input));

    // ASSERT
    expect(plan.profiles.map((p) => p.profile), 'profiles come back in ascending order').toEqual([
      'coping-cap',
      'drip-edge',
    ]);
    expect(plan.totals.stockPieceCount, 'one bar each, never a shared bar').toBe(2);
    for (const stockPiece of allStockPieces(plan)) {
      const profiles = new Set(stockPiece.cuts.map((cut) => cut.profile));
      expect(profiles.size, `bar ${stockPiece.index} must carry exactly one profile`).toBe(1);
      expect([...profiles][0], 'and it must be the bar own profile').toBe(stockPiece.profile);
    }
  });
});

/* -------------------------------------------------------- multiple stock sizes */

describe('optimizeCutPlan: multiple stock lengths are evaluated, not guessed', () => {
  it('puts three 5 ft pieces on one 20 ft bar rather than three 10 ft bars', () => {
    // ARRANGE — this is the counter-example in the engine's own R-15 comment.
    // Taking "the shortest bar that fits the piece" would open a 120 in bar per
    // piece (60 + 60 + 0.25 overruns it) for 180 in of waste. One 240 in bar
    // carries all three for 60 in of waste.
    const input: CutPlanInput = {
      pieces: [{ id: 'panel', profile: 'standing-seam-roofing', lengthIn: 60, quantity: 3 }],
      stockLengths: [STOCK_10FT, STOCK_20FT],
    };

    // ACT
    const plan = expectPlan(optimizeCutPlan(input));

    // ASSERT
    expect(plan.totals.stockPieceCount, 'one 20 ft bar, not three 10 ft bars').toBe(1);
    expect(plan.profiles[0].stockLengthsUsedIn, 'and the 20 ft length is the one used').toEqual([
      240,
    ]);
    expect(plan.totals.requiredLengthIn, '3 x 60 in').toBe(180);
    expect(plan.totals.totalStockLengthIn, 'one 240 in bar').toBe(240);
    expect(plan.totals.kerfLengthIn, 'two cuts between pieces plus one severing cut').toBe(0.75);
    expect(plan.totals.leftoverLengthIn, '240 - 180 - 0.75').toBe(59.25);
    expect(plan.totals.wastePercent, '60 of 240 in is 25%, against 50% on 10 ft bars').toBe(25);
  });

  it('still uses the short bar when the short bar is the tighter fit', () => {
    // ARRANGE — one 96 in piece. A 240 in bar would waste 143.75 in; a 120 in
    // bar wastes 23.75 in. Offering both must not make the plan worse.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'cap', profile: 'coping-cap', lengthIn: 96, quantity: 1 }],
        stockLengths: [STOCK_20FT, STOCK_10FT],
      })
    );

    expect(plan.profiles[0].stockLengthsUsedIn, 'the 10 ft bar is the right bar here').toEqual([
      120,
    ]);
    expect(plan.totals.wasteLengthIn, '0.25 kerf + 23.75 off-cut').toBe(24);
  });

  it('treats two stock entries that snap to the same length as one bar size', () => {
    // ARRANGE — 119.99 in and 120 in both floor to 1919 and 1920 sixteenths
    // respectively, so they are NOT the same; 120 in and 120.004 in both floor
    // to 1920 and are.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'a', profile: 'fascia', lengthIn: 96, quantity: 1 }],
        stockLengths: [
          { lengthIn: 120.004, label: 'zz-second' },
          { lengthIn: 120, label: 'aa-first' },
        ],
      })
    );

    expect(plan.profiles[0].stockLengthsUsedIn, 'one bar size, not two').toEqual([120]);
    expect(
      firstBar(plan).stockLabel,
      'the surviving label is the one that sorts first, so input order cannot change it'
    ).toBe('aa-first');
  });

  it('accepts stock lengths given in feet through the helper', () => {
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 1 }],
        stockLengths: [stockLengthFromFeet(10, '10 ft standard')],
      })
    );

    expect(firstBar(plan).stockLengthIn, '10 ft is 120 in').toBe(120);
    expect(firstBar(plan).stockLabel, 'the label passes through').toBe('10 ft standard');
  });
});

/* ---------------------------------------------------------------- boundaries */

describe('optimizeCutPlan: boundaries', () => {
  it('fits two pieces exactly, to the sixteenth, with nothing left over', () => {
    // ARRANGE — 59.875 + 59.875 = 119.75, plus one 0.25 in cut between them, is
    // 120.00 in exactly: the tightest legal pack of a 10 ft bar.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'pair', profile: 'coping-cap', lengthIn: 59.875, quantity: 2 }],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(plan.totals.stockPieceCount, 'both pieces fit one bar').toBe(1);
    const bar = firstBar(plan);
    expect(bar.finishedLengthIn, '2 x 59.875').toBe(119.75);
    expect(bar.kerfTotalIn, 'one cut between the two pieces, and no remnant to sever').toBe(0.25);
    expect(bar.leftoverIn, 'an exact fit leaves no off-cut at all').toBe(0);
    // 4/1920*100 and 0.25/120*100 are the same IEEE-754 double: both are the
    // correctly-rounded value of 1/480 x 100. So this can be asserted exactly.
    expect(plan.totals.wastePercent, 'the 1/4 in blade is the only waste').toBe(
      (0.25 / 120) * 100
    );
  });

  it('needs a second bar when the pieces are one sixteenth longer', () => {
    // ARRANGE — identical to the test above but for 1/16 in per piece:
    // 59.9375 + 59.9375 + 0.25 = 120.125 in, which overruns the bar.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'pair', profile: 'coping-cap', lengthIn: 59.9375, quantity: 2 }],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(
      plan.totals.stockPieceCount,
      'one sixteenth of an inch is the difference between one bar and two'
    ).toBe(2);
    expect(plan.totals.totalStockLengthIn, '2 x 120 in').toBe(240);
    expect(plan.totals.requiredLengthIn, '2 x 59.9375 in').toBe(119.875);
    expect(plan.totals.kerfLengthIn, 'one severing cut on each bar').toBe(0.5);
    expect(plan.totals.leftoverLengthIn, '2 x (120 - 59.9375 - 0.25)').toBe(119.625);
  });

  it('uses the whole bar, with no cut and no blade loss, when the piece is the bar', () => {
    // ARRANGE — the commonest case in the real data: ten of the twelve seeded
    // profiles stock at 10 ft, and a 10 ft finished piece is one whole bar.
    // The spec's own "one kerf per stock piece" model would report TWO bars.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'full', profile: 'coping-cap', lengthIn: 120, quantity: 1 }],
        stockLengths: [STOCK_10FT],
      })
    );

    const bar = firstBar(plan);
    expect(plan.totals.stockPieceCount, 'one bar, not two').toBe(1);
    expect(bar.kerfTotalIn, 'nothing is cut, so the blade takes nothing').toBe(0);
    expect(bar.leftoverIn, 'and nothing is left over').toBe(0);
    expect(bar.utilizationPercent, 'the bar is fully used').toBe(100);
    expect(plan.totals.wastePercent, 'zero waste').toBe(0);
    expect(bar.cuttingInstructions, 'the shop is told not to cut it').toBe(
      'Use the full 120" stock piece — no cut needed'
    );
  });

  it('snaps an off-grid request conservatively in every direction at once', () => {
    // ARRANGE — a piece 95.97 in long (not on the 1/16 grid) from a bar
    // measured at 119.99 in, with a 0.26 in blade.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'odd', profile: 'fascia', lengthIn: 95.97, quantity: 1 }],
        stockLengths: [{ lengthIn: 119.99 }],
        settings: { kerfIn: 0.26 },
      })
    );

    const bar = firstBar(plan);
    expect(bar.cuts[0].lengthIn, 'the piece rounds UP: never cut a piece short').toBe(96);
    expect(bar.stockLengthIn, 'the bar rounds DOWN: never claim metal that is not there').toBe(
      119.9375
    );
    expect(plan.settings.kerfIn, 'the blade rounds UP: never under-reserve it').toBe(0.3125);
    expect(bar.kerfTotalIn, 'the one severing cut reserves the snapped blade width').toBe(0.3125);
    expect(bar.leftoverIn, '119.9375 - 96 - 0.3125').toBe(23.625);
    expect(bar.stockLabel, 'a bar given without a label reports none').toBe(null);
  });

  it('leaves no negative off-cut when the remnant is thinner than the blade', () => {
    // ARRANGE — 119.9375 in of finished metal in a 120 in bar leaves 1/16 in,
    // which the severing cut would more than consume. The off-cut must be zero,
    // never negative, and the blade loss must be capped at what is really there.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'nearly', profile: 'coping-cap', lengthIn: 119.9375, quantity: 1 }],
        stockLengths: [STOCK_10FT],
      })
    );

    const bar = firstBar(plan);
    expect(bar.kerfTotalIn, 'the blade can only take the 1/16 in that remains').toBe(0.0625);
    expect(bar.leftoverIn, 'and nothing survives it').toBe(0);
    expect(
      bar.finishedLengthIn + bar.kerfTotalIn + bar.leftoverIn,
      'the bar is still fully accounted for'
    ).toBe(120);
  });

  it('plans a single piece', () => {
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'one', profile: 'drip-edge', lengthIn: 24, quantity: 1 }],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(plan.profiles.length, 'one profile').toBe(1);
    expect(plan.totals.stockPieceCount, 'one bar').toBe(1);
    expect(firstBar(plan).cuts.length, 'one cut').toBe(1);
  });

  it('plans exactly MAX_TOTAL_PIECES pieces and conserves every inch', () => {
    // ARRANGE — the cap itself must be plannable, not merely below the error.
    // Nine 12 in pieces fit a 120 in bar (108 + 8 x 0.25 = 110); ten do not
    // (120 + 9 x 0.25 = 122.25). 5000 / 9 is 555 full bars plus 5 pieces.
    const input: CutPlanInput = {
      pieces: [{ id: 'bulk', profile: 'cleat', lengthIn: 12, quantity: MAX_TOTAL_PIECES }],
      stockLengths: [STOCK_10FT],
    };

    // ACT
    const plan = expectPlan(optimizeCutPlan(input));

    // ASSERT
    expect(plan.totals.stockPieceCount, '555 bars of 9 plus one bar of 5').toBe(556);
    expect(plan.totals.requiredLengthIn, '5000 x 12 in').toBe(60000);
    expect(plan.totals.totalStockLengthIn, '556 x 120 in').toBe(66720);
    expect(plan.totals.kerfLengthIn, '555 x 2.25 + 1.25').toBe(1250);
    expect(plan.totals.leftoverLengthIn, '555 x 9.75 + 58.75').toBe(5470);
    expect(
      plan.totals.requiredLengthIn + plan.totals.kerfLengthIn + plan.totals.leftoverLengthIn,
      'every inch of 66720 is accounted for at the cap'
    ).toBe(plan.totals.totalStockLengthIn);
  });
});

/* ---------------------------------------------------------- zero and empty */

describe('optimizeCutPlan: zero and empty are answers, not errors', () => {
  it('treats a zero quantity as nothing to plan', () => {
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'zeroed', profile: 'coping-cap', lengthIn: 96, quantity: 0 }],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(plan.profiles, 'a profile with nothing to cut is omitted, not shown empty').toEqual([]);
    expect(plan.totals.stockPieceCount, 'no bars').toBe(0);
    expect(plan.totals.totalStockLengthIn, 'no stock').toBe(0);
    expect(plan.totals.wastePercent, 'and 0% waste — not NaN, which 0/0 would give').toBe(0);
    expect(Number.isNaN(plan.totals.wastePercent), 'explicitly not NaN').toBe(false);
  });

  it('plans nothing from an empty piece list', () => {
    const plan = expectPlan(optimizeCutPlan({ pieces: [], stockLengths: [STOCK_10FT] }));

    expect(plan.profiles, 'no profiles').toEqual([]);
    expect(plan.totals.wasteLengthIn, 'no waste').toBe(0);
    expect(plan.totals.wastePercent, 'and 0%, not NaN').toBe(0);
  });

  it('ignores a zeroed line while still planning the lines beside it', () => {
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [
          { id: 'zeroed', profile: 'coping-cap', lengthIn: 96, quantity: 0 },
          { id: 'real', profile: 'coping-cap', lengthIn: 48, quantity: 1 },
        ],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(plan.totals.requiredLengthIn, 'only the 48 in piece is planned').toBe(48);
    expect(
      allStockPieces(plan).flatMap((bar) => bar.cuts.map((cut) => cut.pieceId)),
      'and the zeroed line contributes no cut'
    ).toEqual(['real']);
  });

  it('counts a zero kerf as zero, not as the default', () => {
    // ARRANGE — a shear, not a saw: no metal is consumed by the separation.
    // 0 is a legitimate setting and must not fall through to DEFAULT_KERF_IN.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'pair', profile: 'coping-cap', lengthIn: 60, quantity: 2 }],
        stockLengths: [STOCK_10FT],
        settings: { kerfIn: 0 },
      })
    );

    expect(plan.settings.kerfIn, 'zero means zero').toBe(0);
    expect(plan.totals.stockPieceCount, '60 + 60 = 120 fits one bar with no blade loss').toBe(1);
    expect(plan.totals.wasteLengthIn, 'and wastes nothing').toBe(0);
  });
});

/* -------------------------------------------------------------------- errors */

describe('optimizeCutPlan: every failure is a returned result, never a throw', () => {
  it('refuses when no stock length is given', () => {
    const result = optimizeCutPlan({
      pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 1 }],
      stockLengths: [],
    });

    expect(result.ok, 'nothing can be cut from nothing').toBe(false);
    if (result.ok) return;
    expect(result.error.code, 'the code names the missing input').toBe('no_stock_lengths');
    expect(result.error.message, 'and says no plan was produced').toContain(
      'No cut plan was produced'
    );
  });

  it('refuses a stock length that is not a usable measurement', () => {
    for (const lengthIn of [0, -120, Number.NaN, Number.POSITIVE_INFINITY, 0.01]) {
      const result = optimizeCutPlan({
        pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 1 }],
        stockLengths: [{ lengthIn }],
      });

      expect(result.ok, `a ${String(lengthIn)} in bar is not a bar`).toBe(false);
      if (result.ok) continue;
      expect(result.error.code, `for stock length ${String(lengthIn)}`).toBe(
        'invalid_stock_length'
      );
    }
  });

  it('refuses a kerf that is not a width', () => {
    for (const kerfIn of [-0.25, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const result = optimizeCutPlan({
        pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 1 }],
        stockLengths: [STOCK_10FT],
        settings: { kerfIn },
      });

      expect(result.ok, `a ${String(kerfIn)} in blade is not a blade`).toBe(false);
      if (result.ok) continue;
      expect(result.error.code, `for kerf ${String(kerfIn)}`).toBe('invalid_kerf');
    }
  });

  it('refuses a piece that is missing a field or carries a nonsense one', () => {
    const cases: { label: string; piece: CutPlanInput['pieces'][number] }[] = [
      { label: 'empty id', piece: { id: '  ', profile: 'coping-cap', lengthIn: 96, quantity: 1 } },
      { label: 'empty profile', piece: { id: 'a', profile: '', lengthIn: 96, quantity: 1 } },
      { label: 'zero length', piece: { id: 'a', profile: 'coping-cap', lengthIn: 0, quantity: 1 } },
      {
        label: 'negative length',
        piece: { id: 'a', profile: 'coping-cap', lengthIn: -96, quantity: 1 },
      },
      {
        label: 'non-finite length',
        piece: { id: 'a', profile: 'coping-cap', lengthIn: Number.NaN, quantity: 1 },
      },
      {
        label: 'fractional quantity',
        piece: { id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 1.5 },
      },
      {
        label: 'negative quantity',
        piece: { id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: -1 },
      },
    ];

    for (const { label, piece } of cases) {
      const result = optimizeCutPlan({ pieces: [piece], stockLengths: [STOCK_10FT] });

      expect(result.ok, `${label} must not produce a plan`).toBe(false);
      if (result.ok) continue;
      expect(result.error.code, `${label} is an invalid piece`).toBe('invalid_piece');
      expect(result.error.details.pieceIds.length, `${label} names the offending piece`).toBe(1);
    }
  });

  it('refuses two pieces that share an id, because a cut could not be traced', () => {
    const result = optimizeCutPlan({
      pieces: [
        { id: 'same', profile: 'coping-cap', lengthIn: 96, quantity: 1 },
        { id: 'same', profile: 'coping-cap', lengthIn: 48, quantity: 1 },
      ],
      stockLengths: [STOCK_10FT],
    });

    expect(result.ok, 'duplicate ids must not produce a plan').toBe(false);
    if (result.ok) return;
    expect(result.error.code, 'the code names the duplication').toBe('duplicate_piece_id');
    expect(result.error.details.pieceIds, 'and names the id').toEqual(['same']);
  });

  it('refuses a piece longer than every stock length, and says how long the longest is', () => {
    // ARRANGE — a 12 ft piece against 10 ft stock. No packing can help; the
    // honest answer is that it cannot be cut from stock at all.
    const result = optimizeCutPlan({
      pieces: [
        { id: 'too-long', profile: 'coping-cap', lengthIn: 144, quantity: 1 },
        { id: 'fine', profile: 'coping-cap', lengthIn: 48, quantity: 1 },
      ],
      stockLengths: [STOCK_10FT],
    });

    expect(result.ok, 'an impossible piece must not produce a partial plan').toBe(false);
    if (result.ok) return;
    expect(result.error.code, 'the code names the real problem').toBe('piece_exceeds_stock');
    expect(result.error.details.pieceIds, 'only the impossible piece is named').toEqual([
      'too-long',
    ]);
    expect(result.error.details.longestStockLengthIn, 'and the longest bar there is').toBe(120);
    expect(result.error.message, 'the message states the longest length in shop units').toContain(
      '120"'
    );
  });

  it('does not refuse an over-long piece whose quantity is zero', () => {
    // A line an estimator has zeroed out asks for nothing, so its length
    // cannot make the request impossible.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [
          { id: 'zeroed-long', profile: 'coping-cap', lengthIn: 144, quantity: 0 },
          { id: 'real', profile: 'coping-cap', lengthIn: 48, quantity: 1 },
        ],
        stockLengths: [STOCK_10FT],
      })
    );

    expect(plan.totals.requiredLengthIn, 'only the real line is planned').toBe(48);
  });

  it('declines more pieces than it will pack in one pass, and names the cap', () => {
    const result = optimizeCutPlan({
      pieces: [
        { id: 'bulk', profile: 'cleat', lengthIn: 12, quantity: MAX_TOTAL_PIECES + 1 },
      ],
      stockLengths: [STOCK_10FT],
    });

    expect(result.ok, 'one piece past the cap is declined').toBe(false);
    if (result.ok) return;
    expect(result.error.code, 'the code names the cap').toBe('too_many_pieces');
    expect(result.error.details.limit, 'and the cap is reported').toBe(MAX_TOTAL_PIECES);
    expect(result.error.message, 'the message tells the reader what to do').toContain('split');
  });

  it('never throws, whatever it is given', () => {
    // Every case above is a RETURNED error. This asserts the no-throw promise
    // across all of them in one place, including the ones that are hardest to
    // reach, so a future change that starts throwing fails here loudly.
    const inputs: CutPlanInput[] = [
      { pieces: [], stockLengths: [] },
      { pieces: [{ id: '', profile: '', lengthIn: 0, quantity: 0 }], stockLengths: [] },
      {
        pieces: [{ id: 'a', profile: 'x', lengthIn: 1e9, quantity: 1 }],
        stockLengths: [{ lengthIn: 1 }],
      },
      {
        pieces: [{ id: 'a', profile: 'x', lengthIn: 0.0625, quantity: 1 }],
        stockLengths: [{ lengthIn: 0.0625 }],
        settings: { kerfIn: 10 },
      },
    ];

    for (const input of inputs) {
      expect(
        () => optimizeCutPlan(input),
        `optimizeCutPlan must return a result rather than throw for ${JSON.stringify(input)}`
      ).not.toThrow();
    }
  });

  it('plans a piece that fills a bar whose blade is wider than the bar', () => {
    // A 10 in blade on a 10 in bar: the one piece uses the whole bar, so no cut
    // is made and the absurd blade width never applies. The point is that this
    // returns a sane plan instead of a negative off-cut.
    const plan = expectPlan(
      optimizeCutPlan({
        pieces: [{ id: 'a', profile: 'x', lengthIn: 10, quantity: 1 }],
        stockLengths: [{ lengthIn: 10 }],
        settings: { kerfIn: 10 },
      })
    );

    expect(firstBar(plan).leftoverIn, 'no off-cut, and certainly not a negative one').toBe(0);
    expect(firstBar(plan).kerfTotalIn, 'no cut was made').toBe(0);
  });
});

/* -------------------------------------------------------------- determinism */

describe('optimizeCutPlan: determinism does not depend on input order', () => {
  const canonical: CutPlanInput = {
    pieces: [
      { id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 2 },
      { id: 'b', profile: 'coping-cap', lengthIn: 48, quantity: 3 },
      { id: 'c', profile: 'drip-edge', lengthIn: 60, quantity: 4 },
      { id: 'd', profile: 'drip-edge', lengthIn: 24, quantity: 1 },
    ],
    stockLengths: [STOCK_10FT, STOCK_20FT],
  };

  it('returns the same plan when called twice', () => {
    const first = expectPlan(optimizeCutPlan(canonical));
    const second = expectPlan(optimizeCutPlan(canonical));

    expect(second, 'the same input must give a deep-equal plan every time').toEqual(first);
  });

  it('returns the same plan when the pieces arrive in the opposite order', () => {
    const reversed = expectPlan(
      optimizeCutPlan({ ...canonical, pieces: [...canonical.pieces].reverse() })
    );

    expect(
      reversed,
      'the plan must be a function of the requirement, not of the order it was typed'
    ).toEqual(expectPlan(optimizeCutPlan(canonical)));
  });

  it('returns the same plan when the stock lengths arrive in the opposite order', () => {
    const reversed = expectPlan(
      optimizeCutPlan({ ...canonical, stockLengths: [...canonical.stockLengths].reverse() })
    );

    expect(reversed, 'stock order is normalised before packing').toEqual(
      expectPlan(optimizeCutPlan(canonical))
    );
  });

  it('returns the same plan when the two profiles are interleaved differently', () => {
    const interleaved = expectPlan(
      optimizeCutPlan({
        ...canonical,
        pieces: [canonical.pieces[2], canonical.pieces[0], canonical.pieces[3], canonical.pieces[1]],
      })
    );

    expect(interleaved, 'profiles are grouped and sorted before packing').toEqual(
      expectPlan(optimizeCutPlan(canonical))
    );
  });
});

/* ------------------------------------------------------- the property, and both
                                                            strategies */

/** Every fixture the conservation property and the strategy comparison run on. */
const PROPERTY_FIXTURES: { label: string; input: CutPlanInput }[] = [
  {
    label: 'one piece, one bar',
    input: {
      pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 48, quantity: 1 }],
      stockLengths: [STOCK_10FT],
    },
  },
  {
    label: 'ten 8 ft pieces, one per bar',
    input: {
      pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 10 }],
      stockLengths: [STOCK_10FT],
    },
  },
  {
    label: 'exact fit to the sixteenth',
    input: {
      pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 59.875, quantity: 2 }],
      stockLengths: [STOCK_10FT],
    },
  },
  {
    label: 'mixed lengths that nest',
    input: {
      pieces: [
        { id: 'a', profile: 'drip-edge', lengthIn: 48, quantity: 5 },
        { id: 'b', profile: 'drip-edge', lengthIn: 36, quantity: 4 },
        { id: 'c', profile: 'drip-edge', lengthIn: 18, quantity: 7 },
      ],
      stockLengths: [STOCK_10FT],
    },
  },
  {
    label: 'two profiles, two stock lengths',
    input: {
      pieces: [
        { id: 'a', profile: 'coping-cap', lengthIn: 96, quantity: 3 },
        { id: 'b', profile: 'standing-seam-roofing', lengthIn: 60, quantity: 9 },
      ],
      stockLengths: [STOCK_10FT, STOCK_20FT],
    },
  },
  {
    label: 'off-grid lengths and an off-grid bar',
    input: {
      pieces: [
        { id: 'a', profile: 'fascia', lengthIn: 37.4, quantity: 6 },
        { id: 'b', profile: 'fascia', lengthIn: 11.9, quantity: 5 },
      ],
      stockLengths: [{ lengthIn: 119.99 }],
      settings: { kerfIn: 0.1875 },
    },
  },
  {
    label: 'a zero-kerf shear',
    input: {
      pieces: [{ id: 'a', profile: 'cleat', lengthIn: 40, quantity: 7 }],
      stockLengths: [STOCK_10FT],
      settings: { kerfIn: 0 },
    },
  },
  {
    label: 'a remnant thinner than the blade',
    input: {
      pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 119.9375, quantity: 3 }],
      stockLengths: [STOCK_10FT],
    },
  },
  {
    label: 'every piece the length of the bar',
    input: {
      pieces: [{ id: 'a', profile: 'coping-cap', lengthIn: 120, quantity: 4 }],
      stockLengths: [STOCK_10FT],
    },
  },
];

describe('optimizeCutPlan: total stock equals finished plus kerf plus leftover, exactly', () => {
  for (const { label, input } of PROPERTY_FIXTURES) {
    for (const strategy of ['first-fit-decreasing', 'best-fit-decreasing'] as CutStrategy[]) {
      it(`accounts for every inch — ${label}, ${strategy}`, () => {
        const plan = expectPlan(
          optimizeCutPlan({ ...input, settings: { ...input.settings, strategy } })
        );

        // Per stock piece. Sixteenths are dyadic, so this is exact — see
        // ./sixteenths.ts. A tolerance here would hide real drift.
        for (const bar of allStockPieces(plan)) {
          expect(
            bar.finishedLengthIn + bar.kerfTotalIn + bar.leftoverIn,
            `bar ${bar.index} of ${label}: ${bar.finishedLengthIn} finished + ${bar.kerfTotalIn} kerf + ${bar.leftoverIn} leftover must be the whole ${bar.stockLengthIn} in bar`
          ).toBe(bar.stockLengthIn);
          expect(bar.leftoverIn, `bar ${bar.index} off-cut must never be negative`).toBeGreaterThanOrEqual(0);
          expect(bar.kerfTotalIn, `bar ${bar.index} blade loss must never be negative`).toBeGreaterThanOrEqual(0);
        }

        // Per profile.
        for (const profile of plan.profiles) {
          expect(
            profile.totals.requiredLengthIn +
              profile.totals.kerfLengthIn +
              profile.totals.leftoverLengthIn,
            `profile ${profile.profile} of ${label} must account for all of its stock`
          ).toBe(profile.totals.totalStockLengthIn);
          expect(
            profile.totals.stockPieceCount,
            `profile ${profile.profile} must report as many bars as it lists`
          ).toBe(profile.stockPieces.length);
        }

        // And in the plan totals.
        expect(
          plan.totals.requiredLengthIn + plan.totals.kerfLengthIn + plan.totals.leftoverLengthIn,
          `${label}: the plan totals must account for all ${plan.totals.totalStockLengthIn} in of stock`
        ).toBe(plan.totals.totalStockLengthIn);
        expect(
          plan.totals.wasteLengthIn,
          `${label}: waste is kerf plus leftover and nothing else`
        ).toBe(plan.totals.kerfLengthIn + plan.totals.leftoverLengthIn);
      });
    }
  }

  it('makes the plan totals the sum of the profile totals, on every fixture', () => {
    for (const { label, input } of PROPERTY_FIXTURES) {
      const plan = expectPlan(optimizeCutPlan(input));
      const summed = plan.profiles.reduce(
        (acc, profile) => ({
          required: acc.required + profile.totals.requiredLengthIn,
          stock: acc.stock + profile.totals.totalStockLengthIn,
          kerf: acc.kerf + profile.totals.kerfLengthIn,
          leftover: acc.leftover + profile.totals.leftoverLengthIn,
          bars: acc.bars + profile.totals.stockPieceCount,
        }),
        { required: 0, stock: 0, kerf: 0, leftover: 0, bars: 0 }
      );

      expect(summed.required, `${label}: finished length`).toBe(plan.totals.requiredLengthIn);
      expect(summed.stock, `${label}: stock length`).toBe(plan.totals.totalStockLengthIn);
      expect(summed.kerf, `${label}: blade loss`).toBe(plan.totals.kerfLengthIn);
      expect(summed.leftover, `${label}: off-cuts`).toBe(plan.totals.leftoverLengthIn);
      expect(summed.bars, `${label}: bar count`).toBe(plan.totals.stockPieceCount);
    }
  });

  it('plans exactly the pieces that were asked for, no more and no fewer', () => {
    for (const { label, input } of PROPERTY_FIXTURES) {
      const plan = expectPlan(optimizeCutPlan(input));
      const planned = new Map<string, number>();
      for (const bar of allStockPieces(plan)) {
        for (const cut of bar.cuts) {
          planned.set(cut.pieceId, (planned.get(cut.pieceId) ?? 0) + 1);
        }
      }

      for (const piece of input.pieces) {
        expect(
          planned.get(piece.id) ?? 0,
          `${label}: piece ${piece.id} was asked for ${piece.quantity} times`
        ).toBe(piece.quantity);
      }
    }
  });

  it('never does worse with the default strategy than with first-fit', () => {
    for (const { label, input } of PROPERTY_FIXTURES) {
      const ffd = expectPlan(
        optimizeCutPlan({ ...input, settings: { ...input.settings, strategy: 'first-fit-decreasing' } })
      );
      const bfd = expectPlan(
        optimizeCutPlan({ ...input, settings: { ...input.settings, strategy: 'best-fit-decreasing' } })
      );

      expect(
        bfd.totals.wasteLengthIn,
        `${label}: best-fit wasted ${bfd.totals.wasteLengthIn} in against first-fit's ${ffd.totals.wasteLengthIn} in`
      ).toBeLessThanOrEqual(ffd.totals.wasteLengthIn);
      expect(
        bfd.totals.stockPieceCount,
        `${label}: best-fit used ${bfd.totals.stockPieceCount} bars against first-fit's ${ffd.totals.stockPieceCount}`
      ).toBeLessThanOrEqual(ffd.totals.stockPieceCount);
    }
  });
});

/* ------------------------------------------------------------------ helpers */

function allStockPieces(plan: CutPlan) {
  return plan.profiles.flatMap((profile) => profile.stockPieces);
}

/** The first stock piece of the first profile — the one most assertions mean. */
function firstBar(plan: CutPlan) {
  return plan.profiles[0].stockPieces[0];
}
