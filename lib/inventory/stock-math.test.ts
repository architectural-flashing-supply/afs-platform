import { describe, expect, it } from 'vitest';
import {
  ADJUSTMENT_KINDS,
  MAX_QTY,
  STOCK_UNITS,
  applyAdjustment,
  availableQty,
  formatQty,
  isAdjustmentKind,
  isStockUnit,
  needsAttention,
  roundQty,
  stockLevel,
  type AdjustmentOutcome,
  type StockQuantities,
} from './stock-math';

/**
 * THE SPECIFICATION FOR WHAT AN INVENTORY QUANTITY MEANS.
 *
 * Every fixture below is an explicit named constant — never random, never
 * generated — so a failure names a real situation rather than a seed. Each test
 * exercises exactly one behaviour and asserts an exact value with a message
 * saying what was expected, what came back, and why it matters.
 *
 * The four areas the queue item names are here: reservation math, low-stock
 * thresholds, and (in migration-rls.test.ts) adjustment-log immutability and
 * the RLS policies in the migration text.
 */

/* ------------------------------------------------------------- fixtures */

/** A row Steve has created but nobody has walked out and counted. */
const UNCOUNTED: StockQuantities = { onHand: null, reserved: 0, reorderPoint: null };

/** Counted, nothing promised, nobody has said what low means. */
const COUNTED_NO_THRESHOLD: StockQuantities = { onHand: 40, reserved: 0, reorderPoint: null };

/** 40 on hand, 10 promised to a job, reorder at 12. Available = 30. */
const HEALTHY: StockQuantities = { onHand: 40, reserved: 10, reorderPoint: 12 };

/** Available (30 - 18 = 12) sits exactly ON the reorder point. */
const AT_THRESHOLD: StockQuantities = { onHand: 30, reserved: 18, reorderPoint: 12 };

/** Available = 5, below the reorder point of 12. */
const BELOW_THRESHOLD: StockQuantities = { onHand: 15, reserved: 10, reorderPoint: 12 };

/** Everything on hand is already promised. Available = 0. */
const FULLY_RESERVED: StockQuantities = { onHand: 8, reserved: 8, reorderPoint: 2 };

/** A count came in below what was reserved. Available = -3. */
const SHORT: StockQuantities = { onHand: 5, reserved: 8, reorderPoint: 2 };

/** A real threshold of zero: "tell me when it is out." Not the same as null. */
const ZERO_THRESHOLD: StockQuantities = { onHand: 3, reserved: 0, reorderPoint: 0 };

/** Helper that fails loudly if an outcome was refused when it should not be. */
function expectAccepted(outcome: AdjustmentOutcome, why: string): Extract<AdjustmentOutcome, { ok: true }> {
  expect(outcome.ok, `${why} — instead it was refused with: ${outcome.ok ? '' : outcome.reason}`).toBe(true);
  if (!outcome.ok) throw new Error('unreachable: asserted ok above');
  return outcome;
}

function expectRefused(outcome: AdjustmentOutcome, why: string): string {
  expect(outcome.ok, `${why} — instead it was ACCEPTED`).toBe(false);
  if (outcome.ok) throw new Error('unreachable: asserted not ok above');
  expect(
    outcome.reason.trim().length,
    'a refusal has to say what to do about it; an empty reason leaves the user stuck'
  ).toBeGreaterThan(10);
  return outcome.reason;
}

/* -------------------------------------------------------------- rounding */

describe('roundQty', () => {
  it('rounds to the two decimal places numeric(12,2) actually stores', () => {
    expect(roundQty(0.1 + 0.2), 'float drift must not reach the database: 0.1 + 0.2 is 0.3, not 0.30000000000000004').toBe(0.3);
    expect(roundQty(12), 'a whole number is unchanged').toBe(12);
    expect(roundQty(-3.456), 'a negative available quantity rounds the same way').toBe(-3.46);
  });

  it('rounds 1.005 UP, which the obvious implementation gets wrong', () => {
    // 1.005 is really 1.00499999999999989 as a double, so Math.round(1.005*100)
    // is 100 and the naive version returns 1.00 — a pound of coil quietly
    // disappearing. This assertion is the reason roundQty re-parses through the
    // decimal string.
    expect(roundQty(1.005), '1.005 at two places is 1.01, not 1.00 — a quantity must not shrink by being rounded').toBe(1.01);
    expect(roundQty(2.675), '2.675 at two places is 2.68, the same trap one step along').toBe(2.68);
  });

  it('never returns negative zero, which would fail an Object.is comparison far away', () => {
    expect(
      Object.is(roundQty(-0.004), 0),
      'rounding a tiny negative to zero must give +0: Object.is(-0, 0) is false, so a leaked -0 fails equality assertions for no visible reason'
    ).toBe(true);
  });

  it('keeps an absurd magnitude finite, so the MAX_QTY check can still refuse it', () => {
    // `${1e21}` is "1e+21", and "1e+21e2" parses as NaN. A NaN escaping here
    // would sail straight past `> MAX_QTY`, because every comparison with NaN
    // is false — the overflow would be accepted instead of refused.
    expect(Number.isFinite(roundQty(1e21)), 'a finite input must stay finite, or the overflow guard stops guarding').toBe(true);
    expectRefused(
      applyAdjustment(HEALTHY, { kind: 'count', amount: 1e21, unit: 'pound' }),
      'an absurd count has to be refused, not accepted as NaN'
    );
  });

  it('is NaN for a non-finite input, so bad input cannot masquerade as a quantity', () => {
    expect(Number.isNaN(roundQty(Number.POSITIVE_INFINITY)), 'Infinity is not a quantity').toBe(true);
    expect(Number.isNaN(roundQty(Number.NaN)), 'NaN stays NaN').toBe(true);
  });
});

/* ----------------------------------------------------------- availableQty */

describe('availableQty', () => {
  it('is null for an item nobody has counted, because there is no number', () => {
    expect(
      availableQty(UNCOUNTED),
      'an uncounted item must report null, not 0 — reporting 0 would invent a measurement (CLAUDE.md rule #19 applied to quantities)'
    ).toBeNull();
  });

  it('is the full count when nothing is reserved', () => {
    expect(availableQty(COUNTED_NO_THRESHOLD), '40 on hand with nothing promised leaves 40 available').toBe(40);
  });

  it('subtracts what is already promised to a job', () => {
    expect(availableQty(HEALTHY), '40 on hand minus 10 reserved is 30 available').toBe(30);
  });

  it('is zero when every piece on hand is already promised', () => {
    expect(availableQty(FULLY_RESERVED), '8 on hand and 8 reserved leaves nothing free to promise').toBe(0);
  });

  it('goes NEGATIVE when a count comes in below what is reserved', () => {
    expect(
      availableQty(SHORT),
      'a count of 5 against 8 reserved is a real shortfall of 3; clamping it to 0 would hide that the shop has promised metal it does not have'
    ).toBe(-3);
  });

  it('rounds the subtraction to two places', () => {
    expect(availableQty({ onHand: 0.3, reserved: 0.1, reorderPoint: null }), '0.3 - 0.1 is 0.2 at two places').toBe(0.2);
  });
});

/* ------------------------------------------------------------- stockLevel */

describe('stockLevel', () => {
  it('reports uncounted before anything else, because there is no number to judge', () => {
    expect(
      stockLevel({ onHand: null, reserved: 0, reorderPoint: 5 }),
      'an uncounted item with a threshold set is still uncounted — a threshold cannot be applied to a quantity nobody has measured'
    ).toBe('uncounted');
  });

  it('reports out when available is exactly zero', () => {
    expect(stockLevel(FULLY_RESERVED), '8 on hand with 8 reserved means nothing is available: out').toBe('out');
  });

  it('reports out when available is negative', () => {
    expect(stockLevel(SHORT), 'a shortfall is out of stock, not low').toBe('out');
  });

  it('reports out even with no reorder point set, because "there is none" needs no threshold', () => {
    expect(
      stockLevel({ onHand: 0, reserved: 0, reorderPoint: null }),
      'out must be checked before no_threshold: a count of zero is a fact, independent of anybody setting a threshold'
    ).toBe('out');
  });

  it('reports no_threshold when the quantity is known and what counts as low is not', () => {
    expect(
      stockLevel(COUNTED_NO_THRESHOLD),
      'saying "in stock" here would be a judgement nobody authorised — the honest answer is that no reorder point has been set'
    ).toBe('no_threshold');
  });

  it('reports low AT the reorder point, not just below it', () => {
    expect(
      stockLevel(AT_THRESHOLD),
      'the comparison is <=, not <: at the reorder point is exactly when you reorder'
    ).toBe('low');
  });

  it('reports low below the reorder point', () => {
    expect(stockLevel(BELOW_THRESHOLD), 'available 5 against a reorder point of 12 is low').toBe('low');
  });

  it('reports ok above the reorder point', () => {
    expect(stockLevel(HEALTHY), 'available 30 against a reorder point of 12 is fine').toBe('ok');
  });

  it('treats a reorder point of 0 as a real threshold, not as unset', () => {
    expect(
      stockLevel(ZERO_THRESHOLD),
      'reorderPoint 0 means "tell me when it is out"; treating 0 as falsy and reporting no_threshold is the classic bug this asserts against'
    ).toBe('ok');
    expect(
      stockLevel({ onHand: 0, reserved: 0, reorderPoint: 0 }),
      'with a zero threshold, zero available is out'
    ).toBe('out');
  });

  it('judges on AVAILABLE, not on the raw count', () => {
    expect(
      stockLevel({ onHand: 100, reserved: 95, reorderPoint: 10 }),
      '100 on hand looks healthy, but 95 are promised — reporting "in stock" about metal already spoken for is the more dangerous error'
    ).toBe('low');
  });
});

describe('needsAttention', () => {
  it('is true for out and low only', () => {
    expect(needsAttention('out'), 'out needs attention').toBe(true);
    expect(needsAttention('low'), 'low needs attention').toBe(true);
    expect(needsAttention('ok'), 'ok does not').toBe(false);
    expect(
      needsAttention('uncounted'),
      'uncounted is a gap in the record, not a stock shortage — it is surfaced by its own chip, not by the low-stock alarm'
    ).toBe(false);
    expect(needsAttention('no_threshold'), 'no_threshold is not a shortage').toBe(false);
  });
});

/* ---------------------------------------------------- applyAdjustment: ok */

describe('applyAdjustment — count', () => {
  it('sets on hand absolutely on an item that was never counted', () => {
    const out = expectAccepted(
      applyAdjustment(UNCOUNTED, { kind: 'count', amount: 24, unit: 'sheet' }),
      'a first physical count is how an uncounted item gets a number'
    );
    expect(out.onHandAfter, 'a count sets on hand to exactly what was counted').toBe(24);
    expect(out.reservedAfter, 'a count does not change what is reserved').toBe(0);
    expect(out.countedOnHand, 'the ledger row stores the absolute counted value').toBe(24);
    expect(out.deltaOnHand, 'a count is not a delta').toBeNull();
    expect(out.deltaReserved, 'a count does not touch reserved').toBeNull();
  });

  it('accepts a count of zero, because zero counted is a real measurement', () => {
    const out = expectAccepted(
      applyAdjustment(COUNTED_NO_THRESHOLD, { kind: 'count', amount: 0, unit: 'sheet' }),
      'counting the rack and finding it empty is a measurement, and the one case where zero is allowed'
    );
    expect(out.onHandAfter, 'the count stands at 0').toBe(0);
  });

  it('ACCEPTS a count that comes in below what is reserved', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'count', amount: 4, unit: 'sheet' }),
      'a measurement is a measurement: refusing it would force somebody to record a number they did not measure'
    );
    expect(out.onHandAfter, 'the counted value is stored as-is').toBe(4);
    expect(out.reservedAfter, '10 remain promised even though only 4 are there').toBe(10);
    expect(
      availableQty({ onHand: out.onHandAfter, reserved: out.reservedAfter, reorderPoint: 12 }),
      'the shortfall must be visible afterwards as a negative available quantity: 4 - 10 = -6'
    ).toBe(-6);
  });

  it('refuses a negative count', () => {
    const reason = expectRefused(
      applyAdjustment(HEALTHY, { kind: 'count', amount: -1, unit: 'sheet' }),
      'you cannot count minus one sheet'
    );
    expect(reason, 'the refusal names the direction problem').toMatch(/positive/i);
  });

  it('refuses a count above what numeric(12,2) can store', () => {
    expectRefused(
      applyAdjustment(HEALTHY, { kind: 'count', amount: MAX_QTY + 1, unit: 'pound' }),
      'the overflow must be caught here, so the user reads a sentence instead of PostgreSQL error 22003'
    );
  });
});

describe('applyAdjustment — receipt', () => {
  it('adds to on hand and stores a positive delta', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'receipt', amount: 10, unit: 'sheet' }),
      'material arriving adds to on hand'
    );
    expect(out.onHandAfter, '40 + 10 = 50').toBe(50);
    expect(out.reservedAfter, 'a receipt does not change reservations').toBe(10);
    expect(out.deltaOnHand, 'the ledger stores +10, and the sign CHECK in migration 039 requires it to be positive').toBe(10);
    expect(out.countedOnHand, 'a receipt is a delta, not a count').toBeNull();
  });

  it('refuses a receipt onto an item that has never been counted, and names the fix', () => {
    const reason = expectRefused(
      applyAdjustment(UNCOUNTED, { kind: 'receipt', amount: 5, unit: 'sheet' }),
      'adding to an unknown baseline would invent the total, which is exactly what this feature must not do'
    );
    expect(reason, 'the refusal must name the fix, the way an unpriced quote names the row to go and fix').toMatch(/count first/i);
  });

  it('rounds a fractional receipt to two places', () => {
    const out = expectAccepted(
      applyAdjustment({ onHand: 0.1, reserved: 0, reorderPoint: null }, { kind: 'receipt', amount: 0.2, unit: 'pound' }),
      'fractional weights are normal for coil bought by the pound'
    );
    expect(out.onHandAfter, '0.1 + 0.2 must store as 0.3, not 0.30000000000000004').toBe(0.3);
  });

  it('refuses a receipt that would overflow the column', () => {
    expectRefused(
      applyAdjustment({ onHand: MAX_QTY, reserved: 0, reorderPoint: null }, { kind: 'receipt', amount: 1, unit: 'pound' }),
      'one more pound than the column can hold is refused in words'
    );
  });

  it('refuses a zero receipt', () => {
    expectRefused(
      applyAdjustment(HEALTHY, { kind: 'receipt', amount: 0, unit: 'sheet' }),
      'receiving nothing is not an event worth a ledger row'
    );
  });
});

describe('applyAdjustment — consumption', () => {
  it('subtracts from on hand and stores a negative delta', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'consumption', amount: 5, unit: 'sheet' }),
      'using 5 sheets off a count of 40 with 10 reserved leaves 35, which is still above the reservation'
    );
    expect(out.onHandAfter, '40 - 5 = 35').toBe(35);
    expect(out.deltaOnHand, 'the ledger stores -5; the user typed 5 and the KIND carries the sign').toBe(-5);
  });

  it('allows consumption down to exactly the reserved quantity', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'consumption', amount: 30, unit: 'sheet' }),
      '40 - 30 = 10, which is exactly the reserved quantity: the boundary is allowed'
    );
    expect(out.onHandAfter, 'on hand lands exactly on the reserved quantity').toBe(10);
  });

  it('refuses consumption that would eat into reserved metal, and names the fix', () => {
    const reason = expectRefused(
      applyAdjustment(HEALTHY, { kind: 'consumption', amount: 31, unit: 'sheet' }),
      'one more than 30 would leave 9 against 10 promised to a job'
    );
    expect(reason, 'the refusal names releasing the reservation as the way forward').toMatch(/release the reservation/i);
  });

  it('refuses consumption of more than is on hand', () => {
    const reason = expectRefused(
      applyAdjustment(COUNTED_NO_THRESHOLD, { kind: 'consumption', amount: 41, unit: 'sheet' }),
      'you cannot use 41 sheets off a count of 40'
    );
    expect(reason, 'the refusal states what is actually on hand').toContain('40 sheets');
  });

  it('refuses consumption from an item that has never been counted', () => {
    expectRefused(
      applyAdjustment(UNCOUNTED, { kind: 'consumption', amount: 1, unit: 'sheet' }),
      'subtracting from an unknown baseline would invent the result'
    );
  });
});

/* ------------------------------------------- applyAdjustment: reservations */

describe('applyAdjustment — reserve (the reservation math)', () => {
  it('increases reserved and leaves on hand alone', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'reserve', amount: 12, unit: 'sheet' }),
      'promising 12 of the 30 available is legal'
    );
    expect(out.onHandAfter, 'a reservation does not move metal, so on hand is unchanged').toBe(40);
    expect(out.reservedAfter, '10 already reserved + 12 more = 22').toBe(22);
    expect(out.deltaReserved, 'the ledger stores +12').toBe(12);
    expect(out.deltaOnHand, 'a reservation is not a change to on hand').toBeNull();
  });

  it('allows reserving exactly everything available', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'reserve', amount: 30, unit: 'sheet' }),
      'reserving the whole available quantity is the boundary, and it is allowed'
    );
    expect(out.reservedAfter, 'all 40 are now promised').toBe(40);
    expect(
      availableQty({ onHand: out.onHandAfter, reserved: out.reservedAfter, reorderPoint: 12 }),
      'nothing is left to promise'
    ).toBe(0);
  });

  it('refuses one more than is available, and names the real number', () => {
    const reason = expectRefused(
      applyAdjustment(HEALTHY, { kind: 'reserve', amount: 31, unit: 'sheet' }),
      'promising metal that is not there is the failure this whole module exists to prevent'
    );
    expect(reason, 'the refusal states how much really is available, so the user can fix it in one step').toContain('30 sheets');
  });

  it('refuses a reservation when everything is already reserved', () => {
    const reason = expectRefused(
      applyAdjustment(FULLY_RESERVED, { kind: 'reserve', amount: 1, unit: 'sheet' }),
      'available is exactly 0'
    );
    expect(reason, 'the refusal says why nothing is available').toMatch(/already reserved/i);
  });

  it('refuses a reservation on an item that is already short', () => {
    expectRefused(
      applyAdjustment(SHORT, { kind: 'reserve', amount: 1, unit: 'sheet' }),
      'available is -3; promising more on top of a shortfall must be refused'
    );
  });

  it('refuses a reservation on an item that has never been counted', () => {
    const reason = expectRefused(
      applyAdjustment(UNCOUNTED, { kind: 'reserve', amount: 1, unit: 'sheet' }),
      'you cannot promise metal nobody has confirmed is there'
    );
    expect(reason, 'the refusal names the fix').toMatch(/count first/i);
  });

  it('refuses a zero reservation', () => {
    expectRefused(applyAdjustment(HEALTHY, { kind: 'reserve', amount: 0, unit: 'sheet' }), 'reserving nothing is not an event');
  });
});

describe('applyAdjustment — release', () => {
  it('decreases reserved and stores a negative delta', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'release', amount: 4, unit: 'sheet' }),
      'letting go of 4 of the 10 promised is legal'
    );
    expect(out.reservedAfter, '10 - 4 = 6').toBe(6);
    expect(out.onHandAfter, 'releasing a promise does not move metal').toBe(40);
    expect(out.deltaReserved, 'the ledger stores -4').toBe(-4);
  });

  it('allows releasing exactly everything reserved', () => {
    const out = expectAccepted(
      applyAdjustment(HEALTHY, { kind: 'release', amount: 10, unit: 'sheet' }),
      'releasing the whole reservation is the boundary, and it is allowed'
    );
    expect(out.reservedAfter, 'nothing is promised any more').toBe(0);
  });

  it('refuses releasing one more than is reserved, and names the real number', () => {
    const reason = expectRefused(
      applyAdjustment(HEALTHY, { kind: 'release', amount: 11, unit: 'sheet' }),
      'releasing more than was promised would drive reserved negative'
    );
    expect(reason, 'the refusal states how much is really reserved').toContain('10 sheets');
  });

  it('refuses a release when nothing is reserved', () => {
    const reason = expectRefused(
      applyAdjustment(COUNTED_NO_THRESHOLD, { kind: 'release', amount: 1, unit: 'sheet' }),
      'there is no promise to let go of'
    );
    expect(reason, 'the refusal says so plainly').toMatch(/nothing is reserved/i);
  });

  it('releases on a short item, because releasing can only help', () => {
    const out = expectAccepted(
      applyAdjustment(SHORT, { kind: 'release', amount: 3, unit: 'sheet' }),
      'an item that is short needs its over-promise released, so this must not be refused'
    );
    expect(out.reservedAfter, '8 - 3 = 5, which matches the 5 actually on hand').toBe(5);
    expect(
      availableQty({ onHand: out.onHandAfter, reserved: out.reservedAfter, reorderPoint: 2 }),
      'the shortfall is gone'
    ).toBe(0);
  });
});

/* ------------------------------------------------- applyAdjustment: inputs */

describe('applyAdjustment — bad input, every kind', () => {
  it.each(ADJUSTMENT_KINDS)('refuses NaN for %s', (kind) => {
    expectRefused(applyAdjustment(HEALTHY, { kind, amount: Number.NaN, unit: 'sheet' }), `NaN is not an amount (${kind})`);
  });

  it.each(ADJUSTMENT_KINDS)('refuses Infinity for %s', (kind) => {
    expectRefused(
      applyAdjustment(HEALTHY, { kind, amount: Number.POSITIVE_INFINITY, unit: 'sheet' }),
      `Infinity is not an amount (${kind})`
    );
  });

  it.each(ADJUSTMENT_KINDS)('refuses a negative amount for %s', (kind) => {
    expectRefused(
      applyAdjustment(HEALTHY, { kind, amount: -5, unit: 'sheet' }),
      `the amount is a positive magnitude and the kind carries the sign (${kind})`
    );
  });
});

/* ---------------------------------------------------------------- display */

describe('formatQty', () => {
  it('writes the unit, and gets singular and plural right', () => {
    expect(formatQty(1, 'sheet'), 'one sheet, not one sheets').toBe('1 sheet');
    expect(formatQty(3, 'sheet'), 'three sheets').toBe('3 sheets');
    expect(formatQty(1, 'linear_foot'), 'one linear foot').toBe('1 linear foot');
    expect(formatQty(2.5, 'linear_foot'), 'a fraction prints to two places').toBe('2.50 linear feet');
    expect(formatQty(40, 'pound'), 'pounds abbreviate').toBe('40 lbs');
  });
});

/* ----------------------------------------------------------------- guards */

describe('the narrowing guards used by the API routes', () => {
  it('accepts exactly the four units and nothing else', () => {
    for (const unit of STOCK_UNITS) {
      expect(isStockUnit(unit), `${unit} is a real unit`).toBe(true);
    }
    expect(isStockUnit('ton'), 'a unit nobody defined must be refused at the request boundary').toBe(false);
    expect(isStockUnit(''), 'an empty string is not a unit').toBe(false);
    expect(isStockUnit(null), 'null is not a unit').toBe(false);
    expect(isStockUnit(7), 'a number is not a unit').toBe(false);
  });

  it('accepts exactly the five adjustment kinds and nothing else', () => {
    for (const kind of ADJUSTMENT_KINDS) {
      expect(isAdjustmentKind(kind), `${kind} is a real kind`).toBe(true);
    }
    expect(isAdjustmentKind('adjust'), 'an undefined kind must be refused at the request boundary').toBe(false);
    expect(isAdjustmentKind(undefined), 'undefined is not a kind').toBe(false);
  });

  it('keeps the TypeScript unions and the SQL CHECK constraints in step', () => {
    // If a unit or a kind is ever added to one side only, the migration's CHECK
    // and this union disagree and rows start being refused by the database for
    // reasons the UI cannot explain. Asserting the counts here is what makes
    // that a test failure instead of a production surprise.
    expect(STOCK_UNITS.length, 'four units, matching inventory_items_stock_unit_check in migration 039').toBe(4);
    expect(ADJUSTMENT_KINDS.length, 'five kinds, matching inventory_adjustments_kind_check in migration 039').toBe(5);
  });
});
