/**
 * THE OVERRIDE AND THE AUDIT RECORD — the unit suite.
 *
 * Two things are really being asserted here. First, that `basis` tells the
 * truth in all four combinations of (computed, typed), because "where did this
 * freight number come from" is the question that will be asked about this
 * feature for years. Second, that an override of ZERO is treated as a real
 * decision — a single falsy test anywhere in `override.ts` would silently
 * reclassify every waived-freight job as "calculated from the table", and that
 * is a lie the audit trail exists to prevent.
 *
 * The last test in this file checks the produced row against migration 039's
 * three basis CHECK constraints directly, so the builder cannot emit a row the
 * database would reject — which would otherwise only be discovered the first
 * time somebody overrode a freight figure in production.
 */
import { describe, expect, it } from 'vitest';
import { estimateFreight } from './estimate';
import { auditDelta, buildFreightEstimateRecord, finalCentsToQuoteDollars } from './override';
import {
  BAND_MEDIUM,
  EMPTY_TABLE,
  RATE_MEDIUM_CENTS,
  SURCHARGES_NO_THRESHOLD,
  VERSION_HEAVY,
  VERSION_LIGHT,
  VERSION_MEDIUM_BLANK,
  ZONE_LOCAL,
  inputWith,
  makeTable,
} from './fixtures';
import type { FreightEstimateRecord, FreightEstimateResult } from './types';

/** A 600 lb job against a fully-priced table: the table CAN price this. */
const PRICED_RESULT: FreightEstimateResult = estimateFreight(
  inputWith({}),
  makeTable({ surcharges: SURCHARGES_NO_THRESHOLD })
);

/** The same job against an empty table: the table CANNOT price it. */
const REFUSED_RESULT: FreightEstimateResult = estimateFreight(inputWith({}), EMPTY_TABLE);

/** Migration 039's three basis CHECK constraints, in TypeScript. */
function satisfiesMigration039Checks(row: FreightEstimateRecord): boolean {
  if (row.finalCents < 0) return false;
  if (row.computedCents !== null && row.computedCents < 0) return false;
  if (row.overrideCents !== null && row.overrideCents < 0) return false;

  if (row.basis === 'estimate') {
    return row.computedCents !== null && row.overrideCents === null && row.finalCents === row.computedCents;
  }
  if (row.basis === 'override') {
    return row.computedCents !== null && row.overrideCents !== null && row.finalCents === row.overrideCents;
  }
  return row.computedCents === null && row.overrideCents !== null && row.finalCents === row.overrideCents;
}

describe('buildFreightEstimateRecord — basis tells the truth in all four cases', () => {
  it('records basis=estimate when the table priced it and nobody changed it', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: null,
    });

    expect(built.ok, 'A priced estimate with an empty box is the ordinary case.').toBe(true);
    if (!built.ok) return;

    expect(built.record.basis, 'Nobody typed anything, so the figure is the table\'s.').toBe('estimate');
    expect(built.record.computedCents, 'The computed figure is the band rate.').toBe(RATE_MEDIUM_CENTS);
    expect(built.record.overrideCents, 'Nothing was typed, which is null and not zero.').toBeNull();
    expect(built.record.finalCents, 'So what goes on the quote is what the table said.').toBe(RATE_MEDIUM_CENTS);
  });

  it('records basis=override and KEEPS BOTH figures when the estimator typed a different one', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
    });
    expect(built.ok, 'A priced estimate plus a typed figure.').toBe(true);
    if (!built.ok) return;

    expect(built.record.basis, 'The table produced one and a human replaced it.').toBe('override');
    expect(
      built.record.computedCents,
      'The computed figure must SURVIVE the override. "We quoted $180 where the table said $234" is ' +
        'the single most valuable row in this table for working out whether the rates are right.'
    ).toBe(RATE_MEDIUM_CENTS);
    expect(built.record.overrideCents, 'And what was typed.').toBe(18000);
    expect(built.record.finalCents, 'The quote gets the typed figure.').toBe(18000);
  });

  it('records basis=manual when the table could not price it and the estimator typed one', () => {
    const built = buildFreightEstimateRecord({
      result: REFUSED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
    });
    expect(built.ok, 'This is the shipping state: empty table, figure typed by hand.').toBe(true);
    if (!built.ok) return;

    expect(built.record.basis, 'There was nothing to override — the figure is entirely the human\'s.').toBe('manual');
    expect(
      built.record.computedCents,
      'null, not 0: the table produced NO figure, which is a different fact from producing a zero one.'
    ).toBeNull();
    expect(built.record.finalCents, 'The typed figure goes on the quote.').toBe(18000);
    expect(
      built.record.refusals.map((refusal) => refusal.kind),
      'And the row records WHY there was nothing to compare against, so a reader a year from now is ' +
        'not left wondering whether the estimator ignored a perfectly good estimate.'
    ).toContain('rate-table-empty');
  });

  it('REFUSES to build a record when there is neither a computed figure nor a typed one', () => {
    const built = buildFreightEstimateRecord({
      result: REFUSED_RESULT,
      input: inputWith({}),
      overrideCents: null,
    });
    expect(
      built.ok,
      'There is no freight on this quote at all, so there is nothing to be the subject of an audit ' +
        'row. Inventing a 0 to fill it would be exactly the fabrication this feature exists to avoid.'
    ).toBe(false);
    if (built.ok) return;
    expect(built.problem.kind, 'And it says which problem it is.').toBe('nothing-to-record');
  });
});

describe('buildFreightEstimateRecord — an override of ZERO is a real override', () => {
  it('treats a typed 0 against a priced estimate as an override, not as an empty box', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 0,
    });
    expect(built.ok, 'Zero is a figure.').toBe(true);
    if (!built.ok) return;

    expect(
      built.record.basis,
      '"Freight waived on this one" is a decision somebody made. A single falsy test in override.ts ' +
        'would reclassify it as "calculated from the table", which is the opposite of what happened.'
    ).toBe('override');
    expect(built.record.overrideCents, 'The typed zero must be kept as a zero, not flattened to null.').toBe(0);
    expect(built.record.finalCents, 'And the quote shows $0.00 freight.').toBe(0);
    expect(
      built.record.computedCents,
      'While the table\'s figure survives beside it, so the waiver is visible as a waiver.'
    ).toBe(RATE_MEDIUM_CENTS);
  });

  it('treats a typed 0 with no computed figure as a manual zero', () => {
    const built = buildFreightEstimateRecord({
      result: REFUSED_RESULT,
      input: inputWith({}),
      overrideCents: 0,
    });
    expect(built.ok, 'Still a figure.').toBe(true);
    if (!built.ok) return;
    expect(built.record.basis, 'Nothing to override, so it is a hand-entered figure that happens to be 0.').toBe(
      'manual'
    );
    expect(built.record.finalCents, 'Free delivery, decided by a person.').toBe(0);
  });

  it('records an override that EQUALS the computed figure as an override anyway', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: RATE_MEDIUM_CENTS,
    });
    expect(built.ok, 'A figure was typed.').toBe(true);
    if (!built.ok) return;
    expect(
      built.record.basis,
      'The audit trail records what was DONE, not what turned out to be redundant. Collapsing this to ' +
        '"estimate" would quietly erase the fact that a human looked at it and agreed.'
    ).toBe('override');
  });
});

describe('buildFreightEstimateRecord — a bad override is refused, not rounded', () => {
  it('refuses a fractional number of cents', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 12.5,
    });
    expect(
      built.ok,
      'Money is integer cents everywhere in this codebase. Half a cent is a parsing mistake upstream, ' +
        'and rounding it here would hide that.'
    ).toBe(false);
    if (built.ok) return;
    expect(built.problem.kind, 'Reported as a bad override.').toBe('bad-override');
  });

  it('refuses a negative amount', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: -1,
    });
    expect(built.ok, 'Freight is never negative; a credit is not a freight line.').toBe(false);
  });

  it('refuses NaN rather than writing it to the database', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: Number.NaN,
    });
    expect(
      built.ok,
      'NaN arrives from an unparseable box. It must be caught here, because it would reach ' +
        'quotes.freight as null and the total as NaN.'
    ).toBe(false);
  });
});

describe('buildFreightEstimateRecord — the record keeps the inputs as they were', () => {
  it('stores the zone, weight, caveat, length and class actually used', () => {
    const input = inputWith({ weightMatchedItems: 2, weightTotalItems: 5, longestPieceFt: 14 });
    const result = estimateFreight(input, makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    const built = buildFreightEstimateRecord({ result, input, overrideCents: null });

    expect(built.ok, `Priced. ${built.ok ? '' : built.problem.message}`).toBe(true);
    if (!built.ok) return;

    expect(built.record.zoneId, 'The zone id, for the foreign key.').toBe(ZONE_LOCAL.id);
    expect(built.record.zoneName, 'And its name, so the row still reads after the zone is renamed.').toBe(
      ZONE_LOCAL.name
    );
    expect(built.record.weightLbs, 'The weight as given, not the rounded lookup value.').toBe(600);
    expect(
      built.record.weightMatchedItems,
      'The caveat travels with the weight: 2 of 5 items matched is a different fact from 5 of 5, and ' +
        'a reader checking this figure later needs to know which it was.'
    ).toBe(2);
    expect(built.record.weightTotalItems, 'Out of five.').toBe(5);
    expect(built.record.longestPieceFt, 'The length that produced the class.').toBe(14);
    expect(built.record.freightClass, '14 ft is class 100 per SPEC §4.').toBe('100');
  });

  it('names the band and the exact rate version the figure came from', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: null,
    });
    expect(built.ok, 'Priced.').toBe(true);
    if (!built.ok) return;

    expect(built.record.bandId, 'Which band.').toBe(BAND_MEDIUM.id);
    expect(
      built.record.rateVersionIds,
      'Which rate version — so the figure can be reconstructed years later even after the rate has ' +
        'changed three times. An array because a future per-cwt rate could resolve through more than one.'
    ).toEqual(['rv-medium']);
    expect(built.record.surchargeVersionId, 'And which surcharge version it was read against.').toBe(
      SURCHARGES_NO_THRESHOLD.id
    );
  });

  it('leaves the band and version fields null when nothing was resolved', () => {
    const built = buildFreightEstimateRecord({
      result: REFUSED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
    });
    expect(built.ok, 'A manual figure.').toBe(true);
    if (!built.ok) return;

    expect(built.record.bandId, 'No band was matched, and null says so.').toBeNull();
    expect(built.record.rateVersionIds, 'No versions were used.').toEqual([]);
    expect(built.record.breakdown, 'And there is no breakdown to keep.').toBeNull();
  });

  it('keeps the refusals on an OVERRIDE too, not only on a manual entry', () => {
    const input = inputWith({ isResidential: true, longestPieceFt: 30 });
    const result = estimateFreight(input, makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    const built = buildFreightEstimateRecord({ result, input, overrideCents: 40000 });

    expect(built.ok, 'Oversize, so the table refused and a figure was typed.').toBe(true);
    if (!built.ok) return;
    expect(
      built.record.refusals.map((refusal) => refusal.kind),
      '"The table was unsure about this, and here is what was sent instead" is more use later than ' +
        'either half on its own.'
    ).toContain('oversize-manual-entry');
  });

  it('trims an override reason, and stores an empty one as null', () => {
    const withReason = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
      overrideReason: '  Customer is collecting half of it themselves  ',
    });
    expect(withReason.ok && withReason.record.overrideReason, 'Trimmed, not stored with its whitespace.').toBe(
      'Customer is collecting half of it themselves'
    );

    const blankReason = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
      overrideReason: '   ',
    });
    expect(
      blankReason.ok && blankReason.record.overrideReason,
      'A box containing only spaces is an empty box, and an empty reason is null rather than "   ".'
    ).toBeNull();
  });
});

describe('auditDelta — old is what the table said, new is what was sent', () => {
  it('reports the computed figure as old and the same figure as new on an untouched estimate', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: null,
    });
    expect(built.ok, 'Priced.').toBe(true);
    if (!built.ok) return;

    const delta = auditDelta(built.record);
    expect(delta.old.freightCents, 'The table\'s figure.').toBe(RATE_MEDIUM_CENTS);
    expect(delta.new.freightCents, 'Which is also what was sent.').toBe(RATE_MEDIUM_CENTS);
    expect(delta.new.basis, 'And the basis records that nobody changed it.').toBe('estimate');
  });

  it('reports the change on an override', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
    });
    expect(built.ok, 'Overridden.').toBe(true);
    if (!built.ok) return;

    const delta = auditDelta(built.record);
    expect(delta.old.freightCents, 'What the table said.').toBe(RATE_MEDIUM_CENTS);
    expect(delta.new.freightCents, 'What was actually sent.').toBe(18000);
    expect(delta.new.basis, 'Classified as an override.').toBe('override');
  });

  it('reports a null old value on a manual entry, which is itself the fact worth recording', () => {
    const built = buildFreightEstimateRecord({
      result: REFUSED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
    });
    expect(built.ok, 'Manual.').toBe(true);
    if (!built.ok) return;

    const delta = auditDelta(built.record);
    expect(
      delta.old.freightCents,
      'null, not 0. The audit log reading "0 → 18000" would say the table priced it at nothing, which ' +
        'is a different and wrong story.'
    ).toBeNull();
    expect(delta.new.basis, 'Classified as a hand entry.').toBe('manual');
  });

  it('always reports a null old basis, because the table has no basis of its own', () => {
    const built = buildFreightEstimateRecord({
      result: PRICED_RESULT,
      input: inputWith({}),
      overrideCents: 18000,
    });
    expect(
      built.ok && auditDelta(built.record).old.basis,
      'The basis IS the decision, and the decision is the new value. An "old basis" would be a field ' +
        'with nothing true to put in it.'
    ).toBeNull();
  });
});

describe('finalCentsToQuoteDollars — the one cents-to-dollars boundary', () => {
  it('converts a whole-dollar figure exactly', () => {
    expect(
      finalCentsToQuoteDollars(18500),
      'quotes.freight is DECIMAL(10,2) dollars and predates this work by six migrations, so there is ' +
        'exactly one conversion and it happens here.'
    ).toBe(185);
  });

  it('converts a figure with cents exactly', () => {
    expect(finalCentsToQuoteDollars(18599), 'No rounding, no drift.').toBe(185.99);
  });

  it('converts zero to zero', () => {
    expect(finalCentsToQuoteDollars(0), 'A waived freight line is $0.00, not null.').toBe(0);
  });
});

describe('buildFreightEstimateRecord — the row can never violate migration 039', () => {
  it('produces a row satisfying the basis CHECKs in all three valid combinations', () => {
    const cases: { label: string; result: FreightEstimateResult; overrideCents: number | null }[] = [
      { label: 'estimate', result: PRICED_RESULT, overrideCents: null },
      { label: 'override', result: PRICED_RESULT, overrideCents: 18000 },
      { label: 'override of zero', result: PRICED_RESULT, overrideCents: 0 },
      { label: 'manual', result: REFUSED_RESULT, overrideCents: 18000 },
      { label: 'manual zero', result: REFUSED_RESULT, overrideCents: 0 },
    ];

    for (const testCase of cases) {
      const built = buildFreightEstimateRecord({
        result: testCase.result,
        input: inputWith({}),
        overrideCents: testCase.overrideCents,
      });
      expect(built.ok, `The "${testCase.label}" case must produce a record.`).toBe(true);
      if (!built.ok) continue;

      expect(
        satisfiesMigration039Checks(built.record),
        `The "${testCase.label}" row violates one of migration 039's three basis CHECK constraints, ` +
          `so Postgres would reject it. Without this test that is discovered the first time somebody ` +
          `overrides a freight figure in production, by the quote failing to send.`
      ).toBe(true);
    }
  });

  it('produces a valid row for a blank-rate refusal overridden by hand', () => {
    const input = inputWith({});
    const result = estimateFreight(
      input,
      makeTable({ versions: [VERSION_LIGHT, VERSION_MEDIUM_BLANK, VERSION_HEAVY] })
    );
    const built = buildFreightEstimateRecord({ input, result, overrideCents: 20000 });

    expect(built.ok, 'A blank band rate with a hand-entered figure is the likeliest real-world case.').toBe(true);
    if (!built.ok) return;
    expect(built.record.basis, 'The table produced nothing, so it is a manual figure.').toBe('manual');
    expect(
      satisfiesMigration039Checks(built.record),
      'And the row still satisfies the manual-basis CHECK: computed null, override set, final equal.'
    ).toBe(true);
  });
});
