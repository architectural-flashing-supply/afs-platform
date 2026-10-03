/**
 * BAND BOUNDARIES AND RATE VERSIONS — the unit suite.
 *
 * The whole point of this file is the boundary. A banded rate table has exactly
 * two places it can go wrong without anybody noticing: a shipment that sits
 * precisely on a boundary, and a table that contradicts itself. Both produce a
 * dollar figure that looks perfectly reasonable on a customer's quote, so both
 * are asserted here at the exact pound.
 *
 * ARRANGE from `./fixtures` (frozen constants, never random), ACT one call,
 * ASSERT exact values with a message saying what it means. No teardown is
 * needed: every function under test is pure and nothing is written anywhere.
 */
import { describe, expect, it } from 'vitest';
import {
  bandForWeight,
  describeBand,
  rateVersionInForce,
  resolveBands,
  roundToWholePounds,
  surchargesInForce,
  toEffectiveDate,
  validateBandCoverage,
} from './bands';
import {
  AS_OF,
  BAND_HEAVY,
  BAND_LIGHT,
  BAND_MEDIUM,
  BANDS_STARTING_AT_100,
  BANDS_WITH_RETIRED_MEDIUM,
  CLOSED_TOP_BANDS,
  CONTIGUOUS_BANDS,
  GAPPED_BANDS,
  OVERLAPPING_BANDS,
  PRICED_VERSIONS,
  RATE_MEDIUM_CENTS,
  SURCHARGES_FULL,
  SURCHARGES_FUTURE,
  VERSION_MEDIUM,
  VERSION_MEDIUM_BLANK,
  VERSION_MEDIUM_FUTURE,
  VERSION_MEDIUM_SAME_DAY_CORRECTION,
} from './fixtures';
import type { BandCoverageProblemKind, FreightRateBand } from './types';

/** Bands resolved against the priced fixture versions, as the estimator sees them. */
const resolved = resolveBands(CONTIGUOUS_BANDS, PRICED_VERSIONS, AS_OF);
const resolvedClosedTop = resolveBands(CLOSED_TOP_BANDS, PRICED_VERSIONS, AS_OF);

function kindsOf(problems: { kind: BandCoverageProblemKind }[]): BandCoverageProblemKind[] {
  return problems.map((problem) => problem.kind);
}

describe('bandForWeight — a band is [min, max): inclusive floor, exclusive ceiling', () => {
  it('puts a shipment at a band\'s exact floor in that band, because the floor is inclusive', () => {
    const match = bandForWeight(resolved, 0);
    expect(
      match?.band.id,
      'A 0 lb shipment must land in the band that starts at 0 lb. If the floor were exclusive, ' +
        'the lightest possible shipment would match no band at all and be refused.'
    ).toBe(BAND_LIGHT.id);
  });

  it('puts a shipment one pound below a band\'s ceiling in that band', () => {
    const match = bandForWeight(resolved, 499);
    expect(
      match?.band.id,
      'A 499 lb shipment is inside [0,500) and must be charged the light band\'s rate.'
    ).toBe(BAND_LIGHT.id);
  });

  it('puts a shipment at a band\'s exact ceiling in the NEXT band, because the ceiling is exclusive', () => {
    const match = bandForWeight(resolved, 500);
    expect(
      match?.band.id,
      'A 500 lb shipment must land in [500,1000), not [0,500). This is the boundary the ' +
        'half-open convention exists to make unambiguous — with closed ranges both bands would ' +
        'contain 500 and the rate charged would depend on sort order.'
    ).toBe(BAND_MEDIUM.id);
  });

  it('puts a shipment one pound below the top band in the middle band', () => {
    const match = bandForWeight(resolved, 999);
    expect(match?.band.id, 'A 999 lb shipment is inside [500,1000).').toBe(BAND_MEDIUM.id);
  });

  it('puts a shipment at the open-ended band\'s floor in the open-ended band', () => {
    const match = bandForWeight(resolved, 1000);
    expect(
      match?.band.id,
      'A 1,000 lb shipment must land in the open-ended top band [1000, and over).'
    ).toBe(BAND_HEAVY.id);
  });

  it('puts an arbitrarily heavy shipment in the open-ended band', () => {
    const match = bandForWeight(resolved, 99999);
    expect(
      match?.band.id,
      'A band with no upper weight must cover every weight at or above its floor, however large.'
    ).toBe(BAND_HEAVY.id);
  });

  it('returns null above a CLOSED top band rather than guessing the nearest rate', () => {
    const match = bandForWeight(resolvedClosedTop, 1000);
    expect(
      match,
      'With no open-ended band, a 1,000 lb shipment is one nobody has priced. Returning the ' +
        'top band\'s rate would invent a freight charge; null makes the estimator refuse and say so.'
    ).toBeNull();
  });

  it('returns null below the lowest band\'s floor', () => {
    const resolvedFrom100 = resolveBands(BANDS_STARTING_AT_100, PRICED_VERSIONS, AS_OF);
    const match = bandForWeight(resolvedFrom100, 50);
    expect(
      match,
      'A 50 lb shipment under a table that starts at 100 lb is unpriced, not nearest-matched.'
    ).toBeNull();
  });

  it('rounds a fractional weight UP to the next whole pound before comparing, crossing the boundary', () => {
    const match = bandForWeight(resolved, 499.5);
    expect(
      match?.band.id,
      '499.5 lb rounds to 500 lb, which is a 500 lb shipment and belongs to [500,1000). ' +
        'Comparing the raw float would make the boundary depend on the floating-point sum of ' +
        'per-item weights, which is not something a dollar figure should rest on.'
    ).toBe(BAND_MEDIUM.id);
  });

  it('rounds a fractional weight DOWN when it is below the halfway point, staying in the lower band', () => {
    const match = bandForWeight(resolved, 499.4);
    expect(
      match?.band.id,
      '499.4 lb rounds to 499 lb and stays in [0,500). Together with the previous test this pins ' +
        'the rounding rule to the exact half-pound.'
    ).toBe(BAND_LIGHT.id);
  });

  it('returns null for a negative weight', () => {
    expect(
      bandForWeight(resolved, -1),
      'A negative shipment weight is not a shipment. It must not resolve to the 0 lb band.'
    ).toBeNull();
  });

  it('returns null for NaN rather than throwing, so a half-typed box renders as "no estimate"', () => {
    expect(
      bandForWeight(resolved, Number.NaN),
      'NaN reaches this function from an empty or partly-typed weight box. It must produce null, ' +
        'not a crash and not a band.'
    ).toBeNull();
  });

  it('returns null for Infinity, which the open-ended band would otherwise swallow', () => {
    expect(
      bandForWeight(resolved, Number.POSITIVE_INFINITY),
      'Infinity is >= the open band\'s floor, so without an explicit finiteness guard it would ' +
        'match and be charged a real rate. It must return null.'
    ).toBeNull();
  });

  it('never matches a retired band', () => {
    const withRetired = resolveBands(BANDS_WITH_RETIRED_MEDIUM, PRICED_VERSIONS, AS_OF);
    const match = bandForWeight(withRetired, 600);
    expect(
      match,
      'A 600 lb shipment fell in the retired [500,1000) band. A retired band keeps its history ' +
        'for old quotes but must never price new work.'
    ).toBeNull();
  });

  it('gives the same answer whichever order the bands arrive in', () => {
    const reversed = [...resolved].reverse();
    expect(
      bandForWeight(reversed, 500)?.band.id,
      'The lookup sorts by floor before walking, so display order cannot change which rate a ' +
        'shipment is charged.'
    ).toBe(BAND_MEDIUM.id);
  });
});

describe('roundToWholePounds — the one place a weight is rounded', () => {
  it('rounds exactly half a pound up', () => {
    expect(roundToWholePounds(499.5), '499.5 lb is a 500 lb shipment.').toBe(500);
  });

  it('leaves a whole pound alone', () => {
    expect(roundToWholePounds(600), 'A whole number of pounds must pass through unchanged.').toBe(600);
  });
});

describe('validateBandCoverage — a table that contradicts itself is a refusal, not a lookup', () => {
  it('reports nothing for a contiguous half-open table', () => {
    expect(
      validateBandCoverage(CONTIGUOUS_BANDS),
      '[0,500) [500,1000) [1000,∞) meet exactly and cover everything from 0 up. A false positive ' +
        'here would block every estimate on a correct table.'
    ).toEqual([]);
  });

  it('reports an overlap naming both bands', () => {
    const problems = validateBandCoverage(OVERLAPPING_BANDS);
    expect(kindsOf(problems), 'An overlapping table must be reported as overlapping.').toEqual([
      'overlap',
    ]);
    expect(
      problems[0].bandIds.sort(),
      'The message has to name both bands so the estimator knows which two to go and fix.'
    ).toEqual([BAND_LIGHT.id, BAND_MEDIUM.id].sort());
  });

  it('reports a gap naming the uncovered weights', () => {
    const problems = validateBandCoverage(GAPPED_BANDS);
    expect(kindsOf(problems), 'Nothing covers 500–599 lb, so that is a gap.').toEqual(['gap']);
    expect(
      problems[0].message,
      'The gap message must state the uncovered range in pounds — "there is a gap" alone does not ' +
        'tell anyone what to type.'
    ).toContain('500');
  });

  it('reports a band whose ceiling is not above its floor', () => {
    const degenerate: FreightRateBand[] = [{ ...BAND_MEDIUM, maxWeightLbs: 500 }];
    expect(
      kindsOf(validateBandCoverage(degenerate)),
      'A band [500,500) can never contain any shipment, so it is a fault rather than a band.'
    ).toEqual(['max-not-above-min']);
  });

  it('reports a negative floor', () => {
    const negative: FreightRateBand[] = [{ ...BAND_LIGHT, minWeightLbs: -100 }];
    expect(
      kindsOf(validateBandCoverage(negative)),
      'A band cannot start below zero pounds.'
    ).toContain('negative-min');
  });

  it('reports two open-ended bands, because a heavy shipment could match both', () => {
    const twoOpen: FreightRateBand[] = [
      { ...BAND_MEDIUM, maxWeightLbs: null },
      BAND_HEAVY,
    ];
    expect(
      kindsOf(validateBandCoverage(twoOpen)),
      'With two bands having no upper weight there is no way to say which rate a 5,000 lb ' +
        'shipment should be charged.'
    ).toContain('multiple-open-ended');
  });

  it('reports two bands starting at the same weight', () => {
    const duplicate: FreightRateBand[] = [
      BAND_MEDIUM,
      { ...BAND_MEDIUM, id: 'band-medium-copy', maxWeightLbs: 1200 },
    ];
    expect(
      kindsOf(validateBandCoverage(duplicate)),
      'Only one band may start at each weight, or a shipment at that weight matches two.'
    ).toEqual(['duplicate-min']);
  });

  it('reports a duplicated floor ONCE, not also as an overlap', () => {
    const duplicate: FreightRateBand[] = [
      BAND_MEDIUM,
      { ...BAND_MEDIUM, id: 'band-medium-copy', maxWeightLbs: 1200 },
    ];
    expect(
      validateBandCoverage(duplicate),
      'Two complaints about one mistake makes the editor\'s warning list unreadable.'
    ).toHaveLength(1);
  });

  it('reports an empty zone as no-bands, not as a gap', () => {
    const problems = validateBandCoverage([]);
    expect(
      kindsOf(problems),
      'A zone with no bands has nothing to look a shipment up in. Calling that a "gap" would ' +
        'tell the estimator to extend a band that does not exist.'
    ).toEqual(['no-bands']);
  });

  it('reports a zone whose only band is retired as no-bands', () => {
    const allRetired: FreightRateBand[] = [{ ...BAND_LIGHT, retiredAt: '2026-09-01T00:00:00.000Z' }];
    expect(
      kindsOf(validateBandCoverage(allRetired)),
      'Retired bands cannot price new work, so a zone holding only retired bands is empty for ' +
        'this purpose.'
    ).toEqual(['no-bands']);
  });

  it('does NOT report a closed top band as a fault', () => {
    expect(
      validateBandCoverage(CLOSED_TOP_BANDS),
      'A table that stops at 999 lb is a legitimate choice: a heavier shipment gets a refusal ' +
        'naming its weight. Only a self-contradicting table is a coverage fault.'
    ).toEqual([]);
  });

  it('does NOT report a lowest floor above zero as a fault', () => {
    expect(
      validateBandCoverage(BANDS_STARTING_AT_100),
      'A table starting at 100 lb is sound; a 50 lb shipment under it is unpriced, which the ' +
        'estimate reports separately with the weight named.'
    ).toEqual([]);
  });

  it('ignores a retired band that would otherwise overlap a live one', () => {
    const retiredOverlap: FreightRateBand[] = [
      BAND_LIGHT,
      { ...BAND_LIGHT, id: 'band-old', maxWeightLbs: 900, retiredAt: '2026-08-01T00:00:00.000Z' },
      BAND_MEDIUM,
      BAND_HEAVY,
    ];
    expect(
      validateBandCoverage(retiredOverlap),
      'A retired band crossing a live one is history, not a contradiction. Flagging it would make ' +
        'every corrected table permanently "faulty".'
    ).toEqual([]);
  });
});

describe('rateVersionInForce — an issued quote keeps the rate it was built on', () => {
  it('returns the latest version that has already started', () => {
    const versions = [VERSION_MEDIUM, VERSION_MEDIUM_FUTURE];
    expect(
      rateVersionInForce(versions, AS_OF)?.id,
      'On 2026-10-03 the January version is in force and the December one has not started.'
    ).toBe(VERSION_MEDIUM.id);
  });

  it('treats a version starting exactly on the resolution date as in force', () => {
    const versions = [VERSION_MEDIUM, VERSION_MEDIUM_FUTURE];
    expect(
      rateVersionInForce(versions, VERSION_MEDIUM_FUTURE.effectiveFrom)?.id,
      'A rate effective from the first of the month applies ON the first, not from the second.'
    ).toBe(VERSION_MEDIUM_FUTURE.id);
  });

  it('ignores a version dated in the future, so next month\'s increase can be entered today', () => {
    expect(
      rateVersionInForce([VERSION_MEDIUM_FUTURE], AS_OF),
      'Entering the carrier\'s announced increase in advance must not change the quote sent this ' +
        'afternoon. That is the whole reason rates are dated.'
    ).toBeNull();
  });

  it('returns null for a date before any version started', () => {
    expect(
      rateVersionInForce([VERSION_MEDIUM], '2025-12-31'),
      'Before the first rate was entered there was no rate, and that is a refusal rather than zero.'
    ).toBeNull();
  });

  it('lets the later-entered of two same-day versions win, because that is the correction', () => {
    const versions = [VERSION_MEDIUM, VERSION_MEDIUM_SAME_DAY_CORRECTION];
    expect(
      rateVersionInForce(versions, AS_OF)?.id,
      'Two rates starting the same day means somebody fixed a typo. The one entered later is the ' +
        'intended rate; "latest effective_from" alone cannot decide this case.'
    ).toBe(VERSION_MEDIUM_SAME_DAY_CORRECTION.id);
  });

  it('gives the same answer whichever order the versions arrive in', () => {
    const forwards = [VERSION_MEDIUM, VERSION_MEDIUM_SAME_DAY_CORRECTION];
    const backwards = [VERSION_MEDIUM_SAME_DAY_CORRECTION, VERSION_MEDIUM];
    expect(
      rateVersionInForce(backwards, AS_OF)?.id,
      'A rate must not depend on the order PostgREST happened to return rows in.'
    ).toBe(rateVersionInForce(forwards, AS_OF)?.id);
  });

  it('returns null for an empty history', () => {
    expect(
      rateVersionInForce([], AS_OF),
      'A band nobody has ever priced has no rate in force.'
    ).toBeNull();
  });
});

describe('surchargesInForce — "never set" is not "set to zero"', () => {
  it('returns the current version and ignores a future one', () => {
    expect(
      surchargesInForce([SURCHARGES_FULL, SURCHARGES_FUTURE], AS_OF)?.id,
      'The surcharges in force today are today\'s, not an increase dated December.'
    ).toBe(SURCHARGES_FULL.id);
  });

  it('returns null when nothing has ever been saved', () => {
    expect(
      surchargesInForce([], AS_OF),
      'This is the shipping state: the residential surcharge (#29), liftgate upcharge (#88) and ' +
        'free-freight threshold (#30) have never been supplied. null is a distinct fact from a ' +
        'row whose values are zero, and the estimator must be able to tell them apart.'
    ).toBeNull();
  });
});

describe('resolveBands — isPriced is the blank-is-never-a-zero rule at the point it would be lost', () => {
  it('marks a band with an in-force rate as priced and carries the cents through', () => {
    const rows = resolveBands([BAND_MEDIUM], [VERSION_MEDIUM], AS_OF);
    expect(rows[0].isPriced, 'A band with a filled-in rate in force is priced.').toBe(true);
    expect(
      rows[0].version?.rateCents,
      'The resolved row must carry the exact cents the estimate will use.'
    ).toBe(RATE_MEDIUM_CENTS);
  });

  it('marks a band whose in-force version has a BLANK rate as NOT priced', () => {
    const rows = resolveBands([BAND_MEDIUM], [VERSION_MEDIUM_BLANK], AS_OF);
    expect(
      rows[0].isPriced,
      'A version exists but its rate was never typed in. Treating that as priced would let the ' +
        'estimate reach a null and either crash or quietly charge zero.'
    ).toBe(false);
    expect(
      rows[0].version?.rateCents,
      'The blank must stay null all the way through — never coerced to 0.'
    ).toBeNull();
  });

  it('marks a band with no version at all as NOT priced', () => {
    const rows = resolveBands([BAND_MEDIUM], [], AS_OF);
    expect(rows[0].isPriced, 'A band nobody has priced is not priced.').toBe(false);
    expect(rows[0].version, 'There is no version to report.').toBeNull();
  });

  it('marks a band as NOT priced when its only rate starts in the future', () => {
    const rows = resolveBands([BAND_MEDIUM], [VERSION_MEDIUM_FUTURE], AS_OF);
    expect(
      rows[0].isPriced,
      'A rate that has not started yet cannot price today\'s quote.'
    ).toBe(false);
  });
});

describe('describeBand — how a band reads in a message', () => {
  it('prints a closed band using the carrier\'s inclusive wording', () => {
    expect(
      describeBand(BAND_MEDIUM),
      'The band is stored as [500,1000) but a carrier tariff calls that "500–999 lb", and the ' +
        'estimator reads tariffs, not interval notation.'
    ).toBe('500–999 lb');
  });

  it('prints the open-ended band without an upper figure', () => {
    expect(describeBand(BAND_HEAVY), 'There is no upper weight to print.').toBe('1,000 lb and over');
  });
});

describe('toEffectiveDate — a date is a date, with no instant and no offset', () => {
  it('keeps a YYYY-MM-DD string exactly as it is', () => {
    expect(
      toEffectiveDate('2026-10-03'),
      'A date-only value must not be round-tripped through a Date, which would introduce a ' +
        'timezone offset and could move it a day.'
    ).toBe('2026-10-03');
  });

  it('takes the date part of a full timestamp', () => {
    expect(toEffectiveDate('2026-10-03T23:45:00.000Z'), 'The date part is the date.').toBe('2026-10-03');
  });

  it('throws on something that is not a date at all, rather than inventing one', () => {
    expect(
      () => toEffectiveDate('not a date'),
      'Silently producing today\'s date from a malformed value would attach a rate to the wrong day.'
    ).toThrow();
  });
});
