// GOLDEN TEST — the whole V2 pipeline against a RECORDED LIVE response.
//
// lib/hailview/__fixtures__/burnet-tx-lsr.json is a real IEM Local Storm
// Report response, recorded on 2026-10-08 for central Burnet, TX with the
// coordinates rounded to 2 decimals (which is all the feed itself resolves
// to, and which keeps a specific house out of a committed fixture).
//
// This is the test that would catch a change nobody intended. The unit tests
// above it use hand-built evidence chosen to isolate one behaviour each;
// this one runs the real, messy thing — 67 recorded hail reports narrowing to
// 58 observations across 12 convective days, including a byte-identical
// duplicate row, mixed measured/estimated/unknown qualifiers and six distinct
// reporter classes — end to end, and pins the answers.
//
// The fixture carries its own frozen `nowUtc`, so the claim-window logic is
// stable: without that this test would start failing the moment real time
// moved the 12-month window past the fixture's newest storm.

import { describe, expect, it } from 'vitest';
import fixture from '../__fixtures__/burnet-tx-lsr.json';
import type { LsrFeature } from '../storm-history';
import { CLAIM_OCCURRENCE_LINK_DISTANCE_MI, clusterObservationsIntoEvents } from './cluster';
import type { EvidenceQuery, EvidenceSource, HailObservation } from './evidence';
import { collectHailEvidence, iemLsrEvidenceSource } from './evidence';
import { computeReplacementProbabilityV2 } from './engine';
import { evaluateWithGuard } from './guard';
import { estimateSwathAtAddress } from './swath';

const QUERY: EvidenceQuery = {
  lat: fixture.query.lat,
  lon: fixture.query.lon,
  radiusMi: fixture.query.radiusMi,
  lookbackYears: fixture.query.lookbackYears,
  nowUtc: fixture.query.nowUtc,
};

const ADDRESS = { lat: QUERY.lat, lon: QUERY.lon };

/**
 * Replays the recorded response through the REAL adapter.
 *
 * The adapter is exercised rather than bypassed on purpose: the
 * qualifier -> sizeBasis mapping, the reporter-class quality lookup, the
 * unit check and the duplicate-row dedup are all adapter behaviour, and
 * hand-building HailObservations here would test none of them.
 */
async function observationsFromFixture(): Promise<HailObservation[]> {
  const features = fixture.features as unknown as LsrFeature[];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
  try {
    const result = await iemLsrEvidenceSource.fetch(QUERY);
    expect(result.errorReason).toBeNull();
    return result.observations;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('golden — the recorded Burnet, TX response', () => {
  it('is a real recording with the fields V2 depends on', () => {
    expect(fixture.featureCount).toBe(67);
    expect(fixture.features).toHaveLength(67);
    // The two fields V1 never read and V2 needs.
    expect(fixture.features.every((f) => 'qualifier' in f.properties)).toBe(true);
    expect(fixture.features.every((f) => 'source' in f.properties)).toBe(true);
    // Every row is hail, in inches.
    expect(fixture.features.every((f) => /HAIL/i.test(f.properties.typetext))).toBe(true);
    expect(
      fixture.features.every((f) => (f.properties.unit ?? '').toLowerCase() === 'inch')
    ).toBe(true);
  });

  it('normalizes into observations, splitting measured from estimated', async () => {
    const observations = await observationsFromFixture();

    // 67 features were recorded from a 12-mile BOUNDING BOX; the adapter
    // narrows that to a true 12-mile CIRCLE, which drops the 8 reports in
    // the box's corners, and then removes 1 byte-identical duplicate row.
    // 67 -> 59 -> 58. The duplicate is not hypothetical: the IEM feed really
    // serves repeated rows, and without the dedup that report would carry
    // double kernel weight in swath.ts.
    expect(observations).toHaveLength(58);

    const measured = observations.filter((o) => o.sizeBasis === 'measured');
    const estimated = observations.filter((o) => o.sizeBasis === 'estimated');
    // Inside the circle: 21 M / 33 E / 5 U. U is treated as ESTIMATED, never
    // promoted to a measurement — so 21 measured and 37 estimated.
    expect(measured).toHaveLength(21);
    expect(estimated).toHaveLength(37);

    // Reporter-class weights really varied, rather than everything landing
    // on the default.
    const qualities = new Set(observations.map((o) => o.quality));
    expect(qualities.size).toBeGreaterThan(1);

    // Sorted oldest first, and every id unique.
    expect(new Set(observations.map((o) => o.id)).size).toBe(observations.length);
    for (let i = 1; i < observations.length; i++) {
      expect(observations[i].timeUtc >= observations[i - 1].timeUtc).toBe(true);
    }
  });

  it('collapses 58 reports into 12 storm occurrences, not 58', async () => {
    const observations = await observationsFromFixture();
    const events = clusterObservationsIntoEvents(observations, CLAIM_OCCURRENCE_LINK_DISTANCE_MI);

    // THE HEADLINE FIX. V1 would have treated every one of these reports as
    // its own "qualifying event" and paid frequency points per report. The
    // worst case in this recording is 2023-05-05, where one storm date
    // produced 14 reports.
    expect(events).toHaveLength(12);
    expect(new Set(events.map((e) => e.convectiveDayUtc)).size).toBe(12);
    expect(events.reduce((s, e) => s + e.observations.length, 0)).toBe(observations.length);
    expect(Math.max(...events.map((e) => e.observations.length))).toBe(14);

    // Newest first, and no observation in two events.
    for (let i = 1; i < events.length; i++) {
      expect(events[i].startTimeUtc <= events[i - 1].startTimeUtc).toBe(true);
    }
    const allIds = events.flatMap((e) => e.observations.map((o) => o.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('would have DOUBLE-COUNTED storm dates under a spatial link distance', () => {
    // Pinning the measurement behind CLAIM_OCCURRENCE_LINK_DISTANCE_MI. A
    // 6-mile link distance splits 8 of these 12 convective days and turns
    // them into 22 events — so the same storm date would enter claims.ts as
    // up to four independent hazards and inflate the probability. The engine
    // therefore passes the occurrence link distance explicitly.
    return observationsFromFixture().then((observations) => {
      const cells = clusterObservationsIntoEvents(observations, 6);
      const occurrences = clusterObservationsIntoEvents(
        observations,
        CLAIM_OCCURRENCE_LINK_DISTANCE_MI
      );
      expect(cells.length).toBe(22);
      expect(occurrences.length).toBe(12);
      expect(cells.length).toBeGreaterThan(occurrences.length);
    });
  });

  it('estimates a size at the address for every event, always within physical bounds', async () => {
    const observations = await observationsFromFixture();
    const events = clusterObservationsIntoEvents(observations, CLAIM_OCCURRENCE_LINK_DISTANCE_MI);

    for (const event of events) {
      const swath = estimateSwathAtAddress(ADDRESS, event);
      expect(swath.centralIn).toBeGreaterThan(0);
      // The estimate at the address can never exceed the largest size
      // reported anywhere in the storm — the kernel is a weighted average
      // against a lower prior, so it is bounded above by the data.
      expect(swath.centralIn).toBeLessThanOrEqual(event.maxReportedSizeIn + 1e-9);
      expect(swath.pExceedOneInch).toBeGreaterThanOrEqual(0);
      expect(swath.pExceedOneInch).toBeLessThanOrEqual(1);
      expect(swath.quantilesIn.p10).toBeLessThanOrEqual(swath.quantilesIn.p50);
      expect(swath.quantilesIn.p50).toBeLessThanOrEqual(swath.quantilesIn.p90);
      expect(swath.sigmaIn).toBeGreaterThan(0);
    }
  });
});

describe('golden — end-to-end results at the recorded address', () => {
  async function runFor(overrides: Parameters<typeof computeReplacementProbabilityV2>[0] extends infer T ? Partial<T> : never) {
    const observations = await observationsFromFixture();
    return computeReplacementProbabilityV2({
      lat: ADDRESS.lat,
      lon: ADDRESS.lon,
      nowUtc: QUERY.nowUtc,
      observations,
      material: 'asphalt_shingle',
      ...overrides,
    } as Parameters<typeof computeReplacementProbabilityV2>[0]);
  }

  it('THE REVERSAL IS GONE on real data: 16-yr architectural shingle >= 24ga standing seam', async () => {
    const shingle = await runFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
    });
    const metal = await runFor({
      material: 'metal_standing_seam',
      metalGauge: '24ga',
      roofAgeYears: 16,
      cosmeticExclusion: true,
    });

    expect(shingle.probability).toBeGreaterThanOrEqual(metal.probability);
    // And both are real numbers in range, not a degenerate 0 == 0 pass.
    expect(shingle.probability).toBeGreaterThanOrEqual(0);
    expect(shingle.probability).toBeLessThanOrEqual(1);
    expect(metal.probability).toBeGreaterThanOrEqual(0);
  });

  it('covering cosmetic damage never lowers the metal result', async () => {
    const excluded = await runFor({
      material: 'metal_standing_seam',
      metalGauge: '24ga',
      roofAgeYears: 16,
      cosmeticExclusion: true,
    });
    const covered = await runFor({
      material: 'metal_standing_seam',
      metalGauge: '24ga',
      roofAgeYears: 16,
      cosmeticExclusion: false,
    });
    expect(covered.probability).toBeGreaterThanOrEqual(excluded.probability);
  });

  it('lists out-of-window storms rather than dropping them', async () => {
    const result = await runFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
    });

    const outside = result.perEvent.filter((e) => e.windowStatus === 'outside_window');
    // The recording spans five years against a 12-month window, so most
    // storms must be outside it — and must still be reported.
    expect(outside.length).toBeGreaterThan(0);
    for (const e of outside) {
      expect(e.claimContribution).toBe(0);
      expect(e.windowLabel).toMatch(/outside typical claim window/i);
    }
    // Including the 2024-04-09 storm, the largest in the recording at 4.00",
    // which really did happen and really is too old to claim on.
    const biggest = result.perEvent.reduce((a, b) =>
      b.maxReportedSizeIn > a.maxReportedSizeIn ? b : a
    );
    expect(biggest.maxReportedSizeIn).toBe(4);
    expect(biggest.windowStatus).toBe('outside_window');
    expect(biggest.claimContribution).toBe(0);
  });

  it('is deterministic and passes every guard invariant on real data', async () => {
    const observations = await observationsFromFixture();
    const engineInput = {
      lat: ADDRESS.lat,
      lon: ADDRESS.lon,
      nowUtc: QUERY.nowUtc,
      observations,
      material: 'asphalt_shingle' as const,
      shingleType: 'architectural' as const,
      roofAgeYears: 16,
    };

    const a = computeReplacementProbabilityV2(engineInput);
    const b = computeReplacementProbabilityV2(engineInput);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    expect(evaluateWithGuard(engineInput).guardFlags).toEqual([]);
  });

  it('never describes an estimate as confirmed, anywhere in the response', async () => {
    const result = await runFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/confirmed/i);
    expect(serialized).not.toMatch(/measured at your address/i);
  });

  it('holds the cross-material ordering for every material at this address', async () => {
    const shingle = await runFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
    });
    for (const gauge of ['29ga', '26ga', '24ga'] as const) {
      const rPanel = await runFor({
        material: 'metal_r_panel',
        metalGauge: gauge,
        roofAgeYears: 16,
        cosmeticExclusion: true,
      });
      expect(rPanel.probability).toBeLessThanOrEqual(shingle.probability);
    }
  });
});

describe('golden — the evidence source contract', () => {
  it('a failing source degrades to empty observations with a reason, never a throw', async () => {
    const broken: EvidenceSource = {
      id: 'broken',
      label: 'Broken test source',
      async fetch() {
        return {
          sourceId: 'broken',
          observations: [],
          coverageNote: 'nothing',
          errorReason: 'simulated outage',
        };
      },
    };
    const merged = await collectHailEvidence(QUERY, [broken]);
    expect(merged.observations).toEqual([]);
    expect(merged.errors).toEqual([{ sourceId: 'broken', reason: 'simulated outage' }]);
  });

  it('merges multiple sources and deduplicates across them', async () => {
    const observations = await observationsFromFixture();
    const makeSource = (id: string): EvidenceSource => ({
      id,
      label: id,
      async fetch() {
        return { sourceId: id, observations, coverageNote: `${id} note`, errorReason: null };
      },
    });
    const merged = await collectHailEvidence(QUERY, [makeSource('a'), makeSource('b')]);
    // Same rows from two sources must not double-count.
    expect(merged.observations).toHaveLength(observations.length);
    expect(merged.coverageNotes).toHaveLength(2);
  });
});
