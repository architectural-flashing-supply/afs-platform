/**
 * THE FREIGHT ESTIMATE — the unit suite.
 *
 * What this file is really testing is the list of things the estimator REFUSES
 * to do. The happy path is three additions; the engineering is in the twelve
 * ways it declines to produce a number it cannot stand behind, and in the fact
 * that it reports all of them at once.
 *
 * ARRANGE from `./fixtures` — `BASE_INPUT` is a 600 lb, 10 ft, no-toggles
 * shipment against a fully-priced table, and each test changes exactly one
 * thing, so a failure names its own cause. ACT is one `estimateFreight` call.
 * ASSERT is exact, with a message saying what breaks if it regresses. Nothing
 * is written, so there is nothing to tear down.
 */
import { describe, expect, it } from 'vitest';
import { OVERSIZE_MANUAL_ENTRY_FT, estimateFreight } from './estimate';
import {
  BAND_HEAVY,
  BAND_LIGHT,
  BAND_MEDIUM,
  CLOSED_TOP_BANDS,
  CONTIGUOUS_BANDS,
  EMPTY_TABLE,
  FREE_FREIGHT_THRESHOLD_CENTS,
  GAPPED_BANDS,
  LIFTGATE_CENTS,
  OVERLAPPING_BANDS,
  PRICED_VERSIONS,
  RATE_HEAVY_CENTS,
  RATE_LIGHT_CENTS,
  RATE_MEDIUM_CENTS,
  RESIDENTIAL_CENTS,
  SURCHARGES_ALL_BLANK,
  SURCHARGES_FULL,
  SURCHARGES_NO_THRESHOLD,
  SURCHARGES_THRESHOLD_ONLY,
  VERSION_HEAVY,
  VERSION_LIGHT,
  VERSION_MEDIUM_BLANK,
  ZONE_LOCAL,
  ZONE_RETIRED,
  inputWith,
  makeTable,
} from './fixtures';
import type { FreightEstimateResult, FreightRefusalKind } from './types';

function kinds(result: FreightEstimateResult): FreightRefusalKind[] {
  return result.ok ? [] : result.refusals.map((refusal) => refusal.kind);
}

/** Every refusal message, joined — for asserting a specific number is named. */
function messages(result: FreightEstimateResult): string {
  return result.ok ? '' : result.refusals.map((refusal) => refusal.message).join(' | ');
}

describe('estimateFreight — the happy path is the band rate, exactly', () => {
  it('charges the matched band\'s rate with no adders and no threshold reached', () => {
    const result = estimateFreight(inputWith({}), makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));

    expect(result.ok, `A 600 lb shipment in a fully-priced table must produce a figure. Refusals: ${messages(result)}`).toBe(true);
    if (!result.ok) return;

    expect(
      result.estimate.breakdown.totalCents,
      'A 600 lb shipment falls in [500,1000), so the total must be exactly that band\'s rate — not ' +
        'interpolated, not averaged, not scaled by weight.'
    ).toBe(RATE_MEDIUM_CENTS);
    expect(result.estimate.breakdown.baseRateCents, 'The base rate is the band rate.').toBe(RATE_MEDIUM_CENTS);
    expect(result.estimate.breakdown.residentialCents, 'Residential was not ticked, so nothing is added.').toBe(0);
    expect(result.estimate.breakdown.liftgateCents, 'Liftgate was not ticked, so nothing is added.').toBe(0);
    expect(result.estimate.breakdown.freeFreightApplied, 'No threshold is configured, so none was reached.').toBe(false);
    expect(result.estimate.breakdown.bandId, 'The record must name the band the rate came from.').toBe(BAND_MEDIUM.id);
    expect(result.estimate.breakdown.rateVersionId, 'And the exact version of that rate.').toBe('rv-medium');
    expect(result.estimate.zoneName, 'The zone is reported by name for the panel and the audit row.').toBe(ZONE_LOCAL.name);
    expect(result.estimate.weightLbsUsed, 'The weight actually used for the lookup is reported.').toBe(600);
  });

  it('charges the light band for a light shipment and the heavy band for a heavy one', () => {
    const table = makeTable({ surcharges: SURCHARGES_NO_THRESHOLD });

    const light = estimateFreight(inputWith({ weightLbs: 100 }), table);
    expect(light.ok && light.estimate.breakdown.totalCents, '100 lb is in [0,500).').toBe(RATE_LIGHT_CENTS);

    const heavy = estimateFreight(inputWith({ weightLbs: 5000 }), table);
    expect(
      heavy.ok && heavy.estimate.breakdown.totalCents,
      '5,000 lb is in the open-ended top band.'
    ).toBe(RATE_HEAVY_CENTS);
  });

  it('crosses the band boundary at the exact pound', () => {
    const table = makeTable({ surcharges: SURCHARGES_NO_THRESHOLD });

    const below = estimateFreight(inputWith({ weightLbs: 499 }), table);
    const at = estimateFreight(inputWith({ weightLbs: 500 }), table);

    expect(below.ok && below.estimate.breakdown.baseRateCents, '499 lb is still the light band.').toBe(RATE_LIGHT_CENTS);
    expect(
      at.ok && at.estimate.breakdown.baseRateCents,
      '500 lb is the medium band. This is the boundary a customer would be mischarged at if the ' +
        'ceiling were ever made inclusive.'
    ).toBe(RATE_MEDIUM_CENTS);
  });
});

describe('estimateFreight — the freight class, which needs no rate data at all', () => {
  const table = makeTable({ surcharges: SURCHARGES_NO_THRESHOLD });

  it('reports class 85 for a piece at 8 ft', () => {
    expect(estimateFreight(inputWith({ longestPieceFt: 8 }), table).freightClass, 'SPEC §4: <= 8 ft is class 85.').toBe('85');
  });

  it('reports class 92.5 for a piece at 12 ft', () => {
    expect(estimateFreight(inputWith({ longestPieceFt: 12 }), table).freightClass, 'SPEC §4: <= 12 ft is 92.5.').toBe('92.5');
  });

  it('reports class 100 for a piece at 16 ft', () => {
    expect(estimateFreight(inputWith({ longestPieceFt: 16 }), table).freightClass, 'SPEC §4: <= 16 ft is 100.').toBe('100');
  });

  it('reports class 110 for a piece just over 16 ft', () => {
    expect(
      estimateFreight(inputWith({ longestPieceFt: 16.5 }), table).freightClass,
      'SPEC §4: over 16 ft is class 110 and needs special handling.'
    ).toBe('110');
  });

  it('still reports the class when it has refused to produce a figure', () => {
    const result = estimateFreight(inputWith({ longestPieceFt: 30 }), EMPTY_TABLE);
    expect(
      result.freightClass,
      'The class comes from the longest piece and the spec\'s own table, so it is knowable with an ' +
        'entirely empty rate table. Hiding it on the refusal branch would withhold the one piece of ' +
        'freight information AFS actually has.'
    ).toBe('110');
  });
});

describe('estimateFreight — the 24 ft rule from SPEC_FREIGHT_ESTIMATOR.md §4', () => {
  const table = makeTable({ surcharges: SURCHARGES_NO_THRESHOLD });

  it('pins the threshold to the 24 ft the specification states', () => {
    expect(
      OVERSIZE_MANUAL_ENTRY_FT,
      'SPEC §4 says "Pieces > 24 ft … Admin manual entry required". If this constant drifts, the ' +
        'code stops matching the specification it cites.'
    ).toBe(24);
  });

  it('still auto-calculates at exactly 24 ft', () => {
    const result = estimateFreight(inputWith({ longestPieceFt: 24 }), table);
    expect(
      result.ok,
      `The rule is "> 24 ft", so 24 ft itself is inside the auto-calculated range. Refusals: ${messages(result)}`
    ).toBe(true);
  });

  it('refuses just over 24 ft, and produces no figure', () => {
    const result = estimateFreight(inputWith({ longestPieceFt: 24.01 }), table);
    expect(kinds(result), 'One hundredth of a foot past the limit is past the limit.').toContain('oversize-manual-entry');
    expect(result.requiresManualEntry, 'The panel uses this flag to say so in words.').toBe(true);
    expect(result.ok, 'No figure may come out of an oversize job, however complete the rate table is.').toBe(false);
  });

  it('refuses a clearly oversize piece even when everything else is priced', () => {
    const result = estimateFreight(inputWith({ longestPieceFt: 30 }), table);
    expect(kinds(result), 'A 30 ft piece may need a flatbed and a permit — that is a human decision.').toContain(
      'oversize-manual-entry'
    );
    expect(
      messages(result),
      'The message has to say WHY, or it reads as a bug. It names flatbed service and the permit.'
    ).toContain('flatbed');
  });
});

describe('estimateFreight — a blank adder is a refusal, never a zero', () => {
  it('adds the residential surcharge when it is set and the box is ticked', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true }),
      makeTable({ surcharges: SURCHARGES_NO_THRESHOLD })
    );
    expect(result.ok, `Both the rate and the adder exist. Refusals: ${messages(result)}`).toBe(true);
    if (!result.ok) return;
    expect(result.estimate.breakdown.residentialCents, 'The adder must be reported on its own line.').toBe(
      RESIDENTIAL_CENTS
    );
    expect(
      result.estimate.breakdown.totalCents,
      'And counted exactly once in the total.'
    ).toBe(RATE_MEDIUM_CENTS + RESIDENTIAL_CENTS);
  });

  it('REFUSES when residential is ticked and the surcharge was never set', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true }),
      makeTable({ surcharges: SURCHARGES_ALL_BLANK })
    );
    expect(
      kinds(result),
      'Checklist #29 — the residential surcharge — has not arrived. Charging 0 for it would silently ' +
        'under-quote every residential delivery AFS ever makes, and nobody would ever see it happen.'
    ).toContain('residential-adder-blank');
    expect(result.ok, 'There must be no figure.').toBe(false);
  });

  it('REFUSES when residential is ticked and no surcharge row has ever been saved', () => {
    const result = estimateFreight(inputWith({ isResidential: true }), makeTable({ surcharges: null }));
    expect(
      kinds(result),
      'A missing surcharge row and a row with a blank field are the same fact from the estimator\'s ' +
        'point of view, and must refuse identically.'
    ).toContain('residential-adder-blank');
  });

  it('does not add the residential surcharge when the box is unticked, even though it is set', () => {
    const result = estimateFreight(inputWith({ isResidential: false }), makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    expect(result.ok && result.estimate.breakdown.residentialCents, 'Not a residential delivery, not charged.').toBe(0);
    expect(
      result.ok && result.estimate.breakdown.totalCents,
      'The total must be the band rate alone.'
    ).toBe(RATE_MEDIUM_CENTS);
  });

  it('adds the liftgate upcharge when it is set and the box is ticked', () => {
    const result = estimateFreight(inputWith({ requiresLiftgate: true }), makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    expect(result.ok && result.estimate.breakdown.liftgateCents, 'The liftgate line must carry its own figure.').toBe(
      LIFTGATE_CENTS
    );
    expect(result.ok && result.estimate.breakdown.totalCents, 'Counted once.').toBe(RATE_MEDIUM_CENTS + LIFTGATE_CENTS);
  });

  it('REFUSES when liftgate is ticked and the upcharge was never set', () => {
    const result = estimateFreight(inputWith({ requiresLiftgate: true }), makeTable({ surcharges: SURCHARGES_ALL_BLANK }));
    expect(
      kinds(result),
      'Checklist #88 — the liftgate upcharge — has not arrived, so there is nothing honest to add.'
    ).toContain('liftgate-adder-blank');
  });

  it('does not add the liftgate upcharge when the box is unticked', () => {
    const result = estimateFreight(inputWith({ requiresLiftgate: false }), makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    expect(result.ok && result.estimate.breakdown.liftgateCents, 'No liftgate needed, nothing charged.').toBe(0);
  });

  it('adds both adders exactly once each when both boxes are ticked', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true, requiresLiftgate: true }),
      makeTable({ surcharges: SURCHARGES_NO_THRESHOLD })
    );
    expect(
      result.ok && result.estimate.breakdown.totalCents,
      'Band rate plus both adders, each counted once. A double-count here would be invisible on the ' +
        'quote and would have to be found by a customer.'
    ).toBe(RATE_MEDIUM_CENTS + RESIDENTIAL_CENTS + LIFTGATE_CENTS);
  });
});

describe('estimateFreight — the free freight threshold', () => {
  it('waives freight entirely when the order is above the threshold', () => {
    const result = estimateFreight(
      inputWith({ merchandiseSubtotalCents: FREE_FREIGHT_THRESHOLD_CENTS + 100000 }),
      makeTable({ surcharges: SURCHARGES_FULL })
    );
    expect(result.ok, `Everything is priced. Refusals: ${messages(result)}`).toBe(true);
    if (!result.ok) return;
    expect(result.estimate.breakdown.totalCents, 'Free freight means zero freight.').toBe(0);
    expect(result.estimate.breakdown.freeFreightApplied, 'And the breakdown must say that is why.').toBe(true);
    expect(
      result.estimate.notes.join(' '),
      'A $0.00 freight line with no explanation reads as a bug, so the note names the threshold.'
    ).toContain('free freight threshold');
  });

  it('waives freight when the order lands EXACTLY on the threshold', () => {
    const result = estimateFreight(
      inputWith({ merchandiseSubtotalCents: FREE_FREIGHT_THRESHOLD_CENTS }),
      makeTable({ surcharges: SURCHARGES_FULL })
    );
    expect(
      result.ok && result.estimate.breakdown.freeFreightApplied,
      '"Free freight over $5,000" that excludes an order of exactly $5,000 is a promise broken at ' +
        'precisely the number it was written with, and it is the customer who finds it.'
    ).toBe(true);
  });

  it('charges full freight one cent below the threshold', () => {
    const result = estimateFreight(
      inputWith({ merchandiseSubtotalCents: FREE_FREIGHT_THRESHOLD_CENTS - 1 }),
      makeTable({ surcharges: SURCHARGES_FULL })
    );
    expect(result.ok && result.estimate.breakdown.freeFreightApplied, 'One cent short is short.').toBe(false);
    expect(result.ok && result.estimate.breakdown.totalCents, 'So the full band rate applies.').toBe(RATE_MEDIUM_CENTS);
  });

  it('does not apply the rule at all when no threshold has been set, and says so', () => {
    const result = estimateFreight(
      inputWith({ merchandiseSubtotalCents: 99999999 }),
      makeTable({ surcharges: SURCHARGES_NO_THRESHOLD })
    );
    expect(
      result.ok && result.estimate.breakdown.freeFreightApplied,
      'Checklist #30 has not arrived. Applying an unconfigured discount would silently under-quote; ' +
        'not applying it can only over-quote, and the estimator reviews every figure before it is sent.'
    ).toBe(false);
    expect(result.ok && result.estimate.breakdown.totalCents, 'The full rate is charged.').toBe(RATE_MEDIUM_CENTS);
    expect(
      result.ok && result.estimate.notes.join(' '),
      'The non-application must be visible rather than assumed, so the estimator knows the rule is ' +
        'missing rather than not met.'
    ).toContain('No free freight threshold has been set');
  });

  it('refuses an oversize job rather than calling it free, even when it qualifies', () => {
    const result = estimateFreight(
      inputWith({ longestPieceFt: 30, merchandiseSubtotalCents: FREE_FREIGHT_THRESHOLD_CENTS + 1 }),
      makeTable({ surcharges: SURCHARGES_FULL })
    );
    expect(
      result.ok,
      'A refusal outranks the threshold. Reporting "free" here would dress a figure the code could ' +
        'not compute as the most attractive answer available, and a 30 ft piece on a flatbed is not free.'
    ).toBe(false);
    expect(kinds(result), 'The reason given must be the oversize piece.').toContain('oversize-manual-entry');
  });

  it('refuses a blank residential adder rather than calling it free, even when it qualifies', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true, merchandiseSubtotalCents: FREE_FREIGHT_THRESHOLD_CENTS + 1 }),
      makeTable({ surcharges: SURCHARGES_THRESHOLD_ONLY })
    );
    expect(
      result.ok,
      'Whether a free-freight promise covers the residential surcharge is UNRESOLVED-03. Assuming it ' +
        'does, by waiving everything, is exactly the guess this function must not make.'
    ).toBe(false);
    expect(kinds(result), 'And it must say which adder is missing.').toContain('residential-adder-blank');
  });
});

describe('estimateFreight — a blank rate is a refusal, never a zero', () => {
  it('REFUSES when the matched band\'s rate was never filled in', () => {
    const result = estimateFreight(
      inputWith({}),
      makeTable({ versions: [VERSION_LIGHT, VERSION_MEDIUM_BLANK, VERSION_HEAVY] })
    );
    expect(
      kinds(result),
      'A version row exists but its rate is null. This is the single most likely way a zero would ' +
        'reach a customer\'s quote, so it is a refusal.'
    ).toContain('band-rate-blank');
    expect(result.ok, 'No figure.').toBe(false);
    expect(
      messages(result),
      'The message must name the band to go and fix, not just report a blank.'
    ).toContain('500–999 lb');
  });

  it('REFUSES when the matched band has no rate version at all', () => {
    const result = estimateFreight(inputWith({}), makeTable({ versions: [VERSION_LIGHT, VERSION_HEAVY] }));
    expect(
      kinds(result),
      'A band nobody has ever priced and a band priced with a blank are the same fact to the ' +
        'estimator, and must refuse identically.'
    ).toContain('band-rate-blank');
  });

  it('says in plain English that a blank is not treated as zero', () => {
    const result = estimateFreight(
      inputWith({}),
      makeTable({ versions: [VERSION_LIGHT, VERSION_MEDIUM_BLANK, VERSION_HEAVY] })
    );
    expect(
      messages(result),
      'The non-technical reader has no reason to assume it. CLAUDE.md rule #19 asks for this sentence ' +
        'to be said out loud.'
    ).toContain('never treated as zero');
  });
});

describe('estimateFreight — the zone', () => {
  it('REFUSES with the empty-table reason when no zones exist at all', () => {
    const result = estimateFreight(inputWith({}), EMPTY_TABLE);
    expect(
      kinds(result),
      'This is the shipping state of every environment: migration 039 creates the tables and seeds ' +
        'nothing, because the carrier is checklist #27-28.'
    ).toContain('rate-table-empty');
  });

  it('REFUSES with the empty-table reason when zones exist but none has a band', () => {
    const result = estimateFreight(inputWith({}), makeTable({ bands: [] }));
    expect(
      kinds(result),
      'A zone with no bands has nothing to look a shipment up in, so there is still no table.'
    ).toContain('rate-table-empty');
  });

  it('does NOT report the table as empty when bands exist but their rates are blank', () => {
    const result = estimateFreight(inputWith({}), makeTable({ versions: [] }));
    expect(
      kinds(result),
      'Reporting "the table is empty" when the bands are right there and only the rates are missing ' +
        'would send the estimator to build something that already exists. The per-band blank names the ' +
        'exact row to fill in, which is strictly more useful.'
    ).toEqual(['band-rate-blank']);
  });

  it('REFUSES when no zone has been picked, and does not call the table empty', () => {
    const result = estimateFreight(inputWith({ zoneId: null }), makeTable({}));
    expect(kinds(result), 'The estimator simply has not chosen yet.').toContain('no-zone-selected');
    expect(
      kinds(result),
      '"Nothing is configured" and "you have not picked one" are different problems with different ' +
        'fixes, and the panel shows a different thing for each.'
    ).not.toContain('rate-table-empty');
  });

  it('REFUSES an unknown zone id', () => {
    const result = estimateFreight(inputWith({ zoneId: 'zone-that-was-deleted' }), makeTable({}));
    expect(kinds(result), 'A stale id from an old page load must not resolve to anything.').toContain('zone-not-found');
  });

  it('REFUSES a retired zone', () => {
    const table = makeTable({
      zones: [ZONE_LOCAL, { ...ZONE_RETIRED, id: ZONE_RETIRED.id }],
      bands: [
        ...CONTIGUOUS_BANDS,
        { ...BAND_MEDIUM, id: 'band-retired-zone-medium', zoneId: ZONE_RETIRED.id },
      ],
      versions: [...PRICED_VERSIONS, { ...PRICED_VERSIONS[1], id: 'rv-rz', bandId: 'band-retired-zone-medium' }],
    });
    const result = estimateFreight(inputWith({ zoneId: ZONE_RETIRED.id }), table);
    expect(
      kinds(result),
      'A retired zone keeps its history so old quotes resolve, but must never price new work.'
    ).toContain('zone-retired');
    expect(messages(result), 'The message names the zone so the estimator knows which one.').toContain(ZONE_RETIRED.name);
  });

  it('REFUSES a zone that has no bands while another zone does', () => {
    const table = makeTable({
      zones: [ZONE_LOCAL, { ...ZONE_LOCAL, id: 'zone-bandless', name: 'Zone with no bands yet' }],
    });
    const result = estimateFreight(inputWith({ zoneId: 'zone-bandless' }), table);
    expect(
      kinds(result),
      'The table is not empty — the chosen zone is. Saying so points at the right screen.'
    ).toContain('zone-has-no-bands');
  });
});

describe('estimateFreight — a self-contradicting band table', () => {
  it('REFUSES an overlapping table rather than returning whichever band sorted first', () => {
    const table = makeTable({
      bands: OVERLAPPING_BANDS,
      versions: [VERSION_LIGHT, { ...PRICED_VERSIONS[1] }],
    });
    const result = estimateFreight(inputWith({ weightLbs: 550 }), table);
    expect(
      kinds(result),
      '550 lb matches both [0,600) and [500,1000). Picking one would charge a confidently wrong rate ' +
        'that nobody can tell is wrong by looking at the quote.'
    ).toContain('band-coverage');
    expect(result.ok, 'No figure.').toBe(false);
  });

  it('carries the coverage faults through so the panel can list them', () => {
    const table = makeTable({ bands: GAPPED_BANDS, versions: PRICED_VERSIONS });
    const result = estimateFreight(inputWith({ weightLbs: 550 }), table);
    expect(result.ok, 'A gapped table cannot price the weight in the gap.').toBe(false);
    if (result.ok) return;
    expect(
      result.coverageProblems.map((problem) => problem.kind),
      'The structured faults, not just the sentence, so the editor and the panel can render them the ' +
        'same way and point at the right rows.'
    ).toEqual(['gap']);
  });
});

describe('estimateFreight — the weight', () => {
  it('REFUSES a weight of zero, because a shipment that weighs nothing is not a shipment', () => {
    const result = estimateFreight(inputWith({ weightLbs: 0 }), makeTable({}));
    expect(
      kinds(result),
      'Zero reaches here when not one line item matched a seeded gauge weight. The lightest band ' +
        'would happily accept it and produce a real rate for an unknown shipment.'
    ).toContain('bad-weight');
  });

  it('REFUSES a negative weight', () => {
    expect(kinds(estimateFreight(inputWith({ weightLbs: -5 }), makeTable({}))), 'Not a weight.').toContain('bad-weight');
  });

  it('REFUSES NaN, which is what an empty weight box produces', () => {
    expect(
      kinds(estimateFreight(inputWith({ weightLbs: Number.NaN }), makeTable({}))),
      'A half-typed box must produce a sentence, not a crash and not a figure.'
    ).toContain('bad-weight');
  });

  it('REFUSES a weight heavier than a closed top band, naming the weight', () => {
    const table = makeTable({ bands: CLOSED_TOP_BANDS, versions: [VERSION_LIGHT, PRICED_VERSIONS[1]] });
    const result = estimateFreight(inputWith({ weightLbs: 2000 }), table);
    expect(kinds(result), 'Nothing covers 2,000 lb, and the top band\'s rate is not its rate.').toContain(
      'no-band-for-weight'
    );
    expect(
      messages(result),
      'The weight has to be in the message, or the estimator cannot tell which band to add.'
    ).toContain('2,000');
  });

  it('warns, without refusing, when the weight came from only some of the line items', () => {
    const result = estimateFreight(
      inputWith({ weightMatchedItems: 2, weightTotalItems: 5 }),
      makeTable({ surcharges: SURCHARGES_NO_THRESHOLD })
    );
    expect(
      result.ok,
      'A partial weight is still a real lower bound, and refusing on it would block most quotes — ' +
        'line items carry free-text material and gauge, so a miss is common.'
    ).toBe(true);
    expect(
      result.ok && result.estimate.notes.join(' '),
      'But it must say so: a weight from 2 of 5 items means the real shipment is heavier and may be ' +
        'in a dearer band.'
    ).toContain('2 of 5');
  });
});

describe('estimateFreight — every reason at once, not the first one', () => {
  it('reports the blank rate, the blank adder and the oversize piece together', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true, longestPieceFt: 30 }),
      makeTable({
        versions: [VERSION_LIGHT, VERSION_MEDIUM_BLANK, VERSION_HEAVY],
        surcharges: SURCHARGES_ALL_BLANK,
      })
    );
    const reported = kinds(result);

    expect(reported, 'The band whose rate is blank.').toContain('band-rate-blank');
    expect(reported, 'The residential adder that was never set.').toContain('residential-adder-blank');
    expect(reported, 'And the 30 ft piece.').toContain('oversize-manual-entry');
    expect(
      reported.length,
      'Exactly three — stopping at the first would send the estimator back to Settings three separate ' +
        'times for one quote, which is how a tool stops being used.'
    ).toBe(3);
  });

  it('reports both blank adders when both boxes are ticked', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true, requiresLiftgate: true }),
      makeTable({ surcharges: SURCHARGES_ALL_BLANK })
    );
    expect(kinds(result).sort(), 'Both, in one pass.').toEqual(
      ['liftgate-adder-blank', 'residential-adder-blank'].sort()
    );
  });
});

describe('estimateFreight — nothing rounds in the total', () => {
  it('sums integer cents exactly, with no drift', () => {
    const result = estimateFreight(
      inputWith({ isResidential: true, requiresLiftgate: true }),
      makeTable({ surcharges: SURCHARGES_NO_THRESHOLD })
    );
    expect(result.ok, `Everything priced. Refusals: ${messages(result)}`).toBe(true);
    if (!result.ok) return;

    const { baseRateCents, residentialCents, liftgateCents, totalCents } = result.estimate.breakdown;
    expect(
      totalCents,
      'Every input is already an integer number of cents, so the total is an exact sum and there is no ' +
        'rounding step that could drift. The only rounding in this library is the weight\'s.'
    ).toBe(baseRateCents + residentialCents + liftgateCents);
    expect(Number.isInteger(totalCents), 'Money is integer cents, never a float.').toBe(true);
  });

  it('reports an integer total for the lightest band too', () => {
    const result = estimateFreight(inputWith({ weightLbs: 1 }), makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    expect(
      result.ok && Number.isInteger(result.estimate.breakdown.totalCents),
      'A 1 lb shipment rounds to 1 lb and lands in the light band at an integer rate.'
    ).toBe(true);
    expect(result.ok && result.estimate.breakdown.bandId, 'Which is the band starting at 0.').toBe(BAND_LIGHT.id);
  });

  it('records the open band\'s own ids rather than a neighbour\'s', () => {
    const result = estimateFreight(inputWith({ weightLbs: 9000 }), makeTable({ surcharges: SURCHARGES_NO_THRESHOLD }));
    expect(result.ok && result.estimate.breakdown.bandId, 'The audit row must name the band actually used.').toBe(
      BAND_HEAVY.id
    );
    expect(result.ok && result.estimate.breakdown.rateVersionId, 'And the exact rate version.').toBe(VERSION_HEAVY.id);
    expect(
      result.ok && result.estimate.breakdown.surchargeVersionId,
      'And the surcharge version it was read against, so the figure can be reconstructed years later.'
    ).toBe(SURCHARGES_NO_THRESHOLD.id);
  });

  it('records a null surcharge version when none has ever been saved', () => {
    const result = estimateFreight(inputWith({}), makeTable({ surcharges: null }));
    expect(
      result.ok && result.estimate.breakdown.surchargeVersionId,
      'No surcharge row exists, and null says so honestly rather than pointing at one that does not.'
    ).toBeNull();
  });
});
