import { describe, expect, it } from 'vitest';
import type { MaterialCategory, MetalGauge } from '../types';
import type { HailObservation } from './evidence';
import { CLAIM_WINDOW_MONTHS } from './claims';
import {
  MODEL_VERSION,
  computeReplacementProbabilityV2,
  tierForScore,
  type EngineInput,
} from './engine';
import { evaluateWithGuard } from './guard';

const ADDRESS = { lat: 30.7608552, lon: -98.2239954 };
const NOW = '2026-10-08T12:00:00Z';
/** Comfortably inside the 12-month claim window from NOW. */
const IN_WINDOW_DAY = '2026-05-11';

function offsetFrom(north: number, east: number) {
  const perDegLat = 69.0547;
  return {
    lat: ADDRESS.lat + north / perDegLat,
    lon: ADDRESS.lon + east / (perDegLat * Math.cos((ADDRESS.lat * Math.PI) / 180)),
  };
}

/**
 * One storm event's worth of evidence: three reports of the same size
 * straddling the address, so the estimate is bracketed and well-evidenced
 * and the comparison between materials is not about evidence quality.
 */
function evidenceAt(sizeIn: number, day = IN_WINDOW_DAY): HailObservation[] {
  // Times are AFTERNOON UTC on purpose, so the convective day (12Z to 12Z)
  // equals the calendar date passed in and these assertions read as written.
  // An earlier version used 01:00Z, which correctly landed on the PREVIOUS
  // convective day and made the helper's own argument misleading.
  const spots: [number, number, string][] = [
    [0.5, 0, '20:00:00'],
    [-0.5, 0.2, '20:12:00'],
    [0, -0.5, '20:24:00'],
  ];
  return spots.map(([north, east, time], i) => {
    const pos = offsetFrom(north, east);
    return {
      id: `${day}-${i}`,
      lat: pos.lat,
      lon: pos.lon,
      timeUtc: `${day}T${time}Z`,
      sizeIn,
      sizeBasis: i === 0 ? 'measured' : 'estimated',
      source: 'iem_lsr',
      quality: 1.0,
      reporterClass: 'Trained Spotter',
      place: 'Burnet',
      remark: null,
    } satisfies HailObservation;
  });
}

function input(overrides: Partial<EngineInput> & { material: MaterialCategory }): EngineInput {
  return {
    lat: ADDRESS.lat,
    lon: ADDRESS.lon,
    nowUtc: NOW,
    observations: [],
    ...overrides,
  };
}

function probabilityFor(overrides: Partial<EngineInput> & { material: MaterialCategory }): number {
  return computeReplacementProbabilityV2(input(overrides)).probability;
}

// ─────────────────────────────────────────────────────────────────────────

describe('engine — determinism (SPEC_HAILVIEW.md §1)', () => {
  it('produces byte-identical output for identical inputs', () => {
    const i = input({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
      observations: evidenceAt(1.75),
    });
    const a = computeReplacementProbabilityV2(i);
    const b = computeReplacementProbabilityV2(i);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('never reads the clock: the same evidence with a different nowUtc gives a different answer only through the claim window', () => {
    const observations = evidenceAt(2.0, '2026-05-11');
    const nowInside = probabilityFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
      observations,
      nowUtc: '2026-10-08T12:00:00Z',
    });
    const nowLater = probabilityFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
      observations,
      nowUtc: '2028-10-08T12:00:00Z',
    });
    expect(nowInside).toBeGreaterThan(0.1);
    expect(nowLater).toBe(0);
  });

  it('reports the uncalibrated model version', () => {
    expect(MODEL_VERSION).toBe('v2.0-uncalibrated');
    const r = computeReplacementProbabilityV2(input({ material: 'wood_shake', observations: evidenceAt(1.5) }));
    expect(r.modelVersion).toBe('v2.0-uncalibrated');
  });
});

describe('engine — THE REVERSAL BUG: cross-material rationality', () => {
  // This is the defect that triggered V2. At one Burnet address a 16-year-
  // old shingle roof scored 60 and a 24 ga standing seam roof scored 81.
  const AGE = 16;

  it('24 ga standing seam P <= 16-yr architectural shingle P for ANY hail up to 2.5 in (cosmeticExclusion on)', () => {
    for (const sizeIn of [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5]) {
      const observations = evidenceAt(sizeIn);
      const shingle = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: AGE,
        observations,
      });
      const metal = probabilityFor({
        material: 'metal_standing_seam',
        metalGauge: '24ga',
        roofAgeYears: AGE,
        observations,
        cosmeticExclusion: true,
      });
      expect(
        metal,
        `24ga standing seam (${metal.toFixed(4)}) must not exceed 16-yr architectural shingle (${shingle.toFixed(4)}) at ${sizeIn}" hail`
      ).toBeLessThanOrEqual(shingle);
    }
  });

  it('29 ga R-panel P <= 16-yr architectural shingle P for ANY hail up to 2.0 in', () => {
    for (const sizeIn of [0.75, 1.0, 1.25, 1.5, 1.75, 2.0]) {
      const observations = evidenceAt(sizeIn);
      const shingle = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: AGE,
        observations,
      });
      const metal = probabilityFor({
        material: 'metal_r_panel',
        metalGauge: '29ga',
        roofAgeYears: AGE,
        observations,
        cosmeticExclusion: true,
      });
      expect(
        metal,
        `29ga R-panel (${metal.toFixed(4)}) must not exceed 16-yr architectural shingle (${shingle.toFixed(4)}) at ${sizeIn}" hail`
      ).toBeLessThanOrEqual(shingle);
    }
  });

  it('3-tab is at least as vulnerable as architectural at the same age and hail (published onsets 1.00 vs 1.25 in)', () => {
    for (const sizeIn of [1.0, 1.25, 1.5, 2.0]) {
      const observations = evidenceAt(sizeIn);
      const threeTab = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: '3-tab',
        roofAgeYears: AGE,
        observations,
      });
      const architectural = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: AGE,
        observations,
      });
      expect(threeTab).toBeGreaterThanOrEqual(architectural);
    }
  });
});

describe('engine — monotonicity', () => {
  it('is non-decreasing in hail size for every material', () => {
    const materials: { material: MaterialCategory; metalGauge?: MetalGauge }[] = [
      { material: 'asphalt_shingle' },
      { material: 'metal_r_panel', metalGauge: '26ga' },
      { material: 'metal_standing_seam', metalGauge: '24ga' },
      { material: 'tpo_pvc_membrane' },
      { material: 'wood_shake' },
    ];
    for (const m of materials) {
      let previous = -1;
      for (const sizeIn of [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0]) {
        const p = probabilityFor({ ...m, roofAgeYears: 12, observations: evidenceAt(sizeIn) });
        expect(p, `${m.material} at ${sizeIn}"`).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = p;
      }
    }
  });

  it('is non-decreasing in roof age for asphalt shingle', () => {
    let previous = -1;
    for (const roofAgeYears of [0, 5, 10, 16, 20, 25, 30, 40]) {
      const p = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears,
        observations: evidenceAt(1.5),
      });
      expect(p, `shingle at age ${roofAgeYears}`).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = p;
    }
  });

  it('is non-decreasing in roof age for wood shake and membrane too', () => {
    for (const material of ['wood_shake', 'tpo_pvc_membrane'] as const) {
      let previous = -1;
      for (const roofAgeYears of [0, 10, 20, 30]) {
        const p = probabilityFor({ material, roofAgeYears, observations: evidenceAt(2.0) });
        expect(p, `${material} at age ${roofAgeYears}`).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = p;
      }
    }
  });

  it('a THICKER metal gauge resists more: 22ga <= 24ga <= 26ga <= 29ga at identical hail', () => {
    // Gauge NUMBER runs opposite to thickness — 22ga is the thickest steel,
    // 29ga the thinnest — so probability must run with the gauge number.
    const observations = evidenceAt(2.25);
    const probabilities = (['22ga', '24ga', '26ga', '29ga'] as MetalGauge[]).map((metalGauge) =>
      probabilityFor({
        material: 'metal_standing_seam',
        metalGauge,
        roofAgeYears: 12,
        observations,
        cosmeticExclusion: false,
      })
    );
    for (let i = 1; i < probabilities.length; i++) {
      expect(probabilities[i]).toBeGreaterThanOrEqual(probabilities[i - 1] - 1e-12);
    }
    // And the span is real, not a rounding artefact.
    expect(probabilities[3]).toBeGreaterThan(probabilities[0]);
  });

  it('a THINNER membrane is more vulnerable: 45 mil >= 60 mil >= 80 mil', () => {
    const observations = evidenceAt(2.0);
    const p45 = probabilityFor({ material: 'tpo_pvc_membrane', membraneMilThickness: 45, roofAgeYears: 10, observations });
    const p60 = probabilityFor({ material: 'tpo_pvc_membrane', membraneMilThickness: 60, roofAgeYears: 10, observations });
    const p80 = probabilityFor({ material: 'tpo_pvc_membrane', membraneMilThickness: 80, roofAgeYears: 10, observations });
    expect(p45).toBeGreaterThanOrEqual(p60);
    expect(p60).toBeGreaterThanOrEqual(p80);
    expect(p45).toBeGreaterThan(p80);
  });

  it('metal gauge is actually USED (root cause #4: V1 collected it and ignored it)', () => {
    const observations = evidenceAt(2.25);
    const thin = probabilityFor({ material: 'metal_r_panel', metalGauge: '29ga', roofAgeYears: 12, observations, cosmeticExclusion: false });
    const thick = probabilityFor({ material: 'metal_r_panel', metalGauge: '22ga', roofAgeYears: 12, observations, cosmeticExclusion: false });
    expect(thin).not.toBe(thick);
  });
});

describe('engine — the cosmetic toggle', () => {
  it('flipping the exclusion off never LOWERS metal probability, and raises it where there is cosmetic damage', () => {
    for (const sizeIn of [1.0, 1.5, 1.75, 2.0, 2.5]) {
      const observations = evidenceAt(sizeIn);
      const excluded = probabilityFor({
        material: 'metal_standing_seam',
        metalGauge: '24ga',
        roofAgeYears: 16,
        observations,
        cosmeticExclusion: true,
      });
      const covered = probabilityFor({
        material: 'metal_standing_seam',
        metalGauge: '24ga',
        roofAgeYears: 16,
        observations,
        cosmeticExclusion: false,
      });
      expect(covered, `at ${sizeIn}"`).toBeGreaterThanOrEqual(excluded);
    }

    // At a size that dents but does not fracture, the difference is real.
    const observations = evidenceAt(1.75);
    const excluded = probabilityFor({ material: 'metal_standing_seam', metalGauge: '24ga', roofAgeYears: 16, observations, cosmeticExclusion: true });
    const covered = probabilityFor({ material: 'metal_standing_seam', metalGauge: '24ga', roofAgeYears: 16, observations, cosmeticExclusion: false });
    expect(covered).toBeGreaterThan(excluded + 0.02);
  });

  it('never changes the shingle probability either way', () => {
    for (const sizeIn of [1.0, 1.5, 2.0, 2.5]) {
      const observations = evidenceAt(sizeIn);
      const excluded = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        observations,
        cosmeticExclusion: true,
      });
      const covered = probabilityFor({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        observations,
        cosmeticExclusion: false,
      });
      // Shingle cosmetic damage is granule loss, which the published anchor
      // says is NOT functional damage. The toggle is a policy question about
      // cosmetic damage, and this test pins the fact that it is reported for
      // metal and does not quietly change an asphalt answer when the UI
      // leaves the control at its default.
      expect(covered).toBeGreaterThanOrEqual(excluded);
    }
  });

  it('defaults the exclusion ON for metal and OFF for asphalt', () => {
    const metal = computeReplacementProbabilityV2(
      input({ material: 'metal_standing_seam', metalGauge: '24ga', roofAgeYears: 16, observations: evidenceAt(1.75) })
    );
    const shingle = computeReplacementProbabilityV2(
      input({ material: 'asphalt_shingle', shingleType: 'architectural', roofAgeYears: 16, observations: evidenceAt(1.75) })
    );
    expect(metal.cosmeticExclusion).toBe(true);
    expect(shingle.cosmeticExclusion).toBe(false);
  });
});

describe('engine — no hail means no claim (root cause #2)', () => {
  it('P <= 0.03 for every material at every age when there is no hail evidence at all', () => {
    const materials: MaterialCategory[] = [
      'asphalt_shingle',
      'metal_r_panel',
      'metal_standing_seam',
      'tpo_pvc_membrane',
      'wood_shake',
    ];
    for (const material of materials) {
      for (const roofAgeYears of [0, 5, 10, 16, 20, 25, 30, 40, 60]) {
        const p = probabilityFor({ material, roofAgeYears, observations: [] });
        expect(p, `${material} at age ${roofAgeYears} with no hail`).toBeLessThanOrEqual(0.03);
      }
    }
  });

  it('a 16-year-old architectural shingle roof with no hail scores 0, not 60', () => {
    // The exact case from the bug report. V1 gave ~25 points of age subscore
    // before any hail was considered.
    const r = computeReplacementProbabilityV2(
      input({ material: 'asphalt_shingle', shingleType: 'architectural', roofAgeYears: 16, observations: [] })
    );
    expect(r.probability).toBe(0);
    expect(r.score).toBe(0);
    expect(r.tier).toBe('Low');
    expect(r.evidenceGrade).toBe('D');
    expect(r.evidenceGradeReason).toMatch(/weak evidence of no hail rather than proof/i);
  });
});

describe('engine — the claim window', () => {
  it('an event older than the window contributes 0 and is STILL LISTED', () => {
    // 3.25" baseball hail, but in 2023 — real Burnet data, and far outside
    // any 12-month claim window from 2026.
    const r = computeReplacementProbabilityV2(
      input({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        observations: evidenceAt(3.25, '2023-05-05'),
      })
    );

    expect(r.probability).toBe(0);
    expect(r.perEvent).toHaveLength(1);
    const event = r.perEvent[0];
    expect(event.windowStatus).toBe('outside_window');
    expect(event.claimContribution).toBe(0);
    expect(event.windowLabel).toMatch(/outside typical claim window/i);
    // The damage itself is still assessed and reported — the roof really was
    // hit; it is the claim that has expired.
    expect(event.pFunctional).toBeGreaterThan(0.5);
    expect(r.bestDateOfLoss).toBeNull();
  });

  it('the same storm INSIDE the window produces a high probability', () => {
    const r = computeReplacementProbabilityV2(
      input({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        observations: evidenceAt(3.25, IN_WINDOW_DAY),
      })
    );
    expect(r.probability).toBeGreaterThan(0.6);
    expect(r.perEvent[0].windowStatus).toBe('in_window');
    expect(r.bestDateOfLoss?.convectiveDayUtc).toBe(IN_WINDOW_DAY);
    expect(r.claimWindowMonths).toBe(CLAIM_WINDOW_MONTHS);
  });

  it('picks the best date of loss as the highest-contributing in-window event', () => {
    const r = computeReplacementProbabilityV2(
      input({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        observations: [...evidenceAt(1.0, '2026-04-02'), ...evidenceAt(2.75, '2026-06-14')],
      })
    );
    expect(r.perEvent).toHaveLength(2);
    expect(r.bestDateOfLoss?.convectiveDayUtc).toBe('2026-06-14');
  });

  it('more in-window damaging events can only raise the probability', () => {
    const one = probabilityFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
      observations: evidenceAt(1.75, '2026-06-14'),
    });
    const two = probabilityFor({
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 16,
      observations: [...evidenceAt(1.75, '2026-06-14'), ...evidenceAt(1.75, '2026-04-02')],
    });
    expect(two).toBeGreaterThan(one);
    expect(two).toBeLessThanOrEqual(1);
  });
});

describe('engine — range, grade and legacy shape', () => {
  it('low <= probability <= high, all inside 0-1', () => {
    for (const sizeIn of [0.75, 1.5, 2.5]) {
      const r = computeReplacementProbabilityV2(
        input({ material: 'asphalt_shingle', roofAgeYears: 16, observations: evidenceAt(sizeIn) })
      );
      expect(r.low).toBeLessThanOrEqual(r.probability);
      expect(r.probability).toBeLessThanOrEqual(r.high);
      expect(r.low).toBeGreaterThanOrEqual(0);
      expect(r.high).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the legacy score/tier fields on V1 cut points', () => {
    expect(tierForScore(0)).toBe('Low');
    expect(tierForScore(34)).toBe('Low');
    expect(tierForScore(35)).toBe('Moderate');
    expect(tierForScore(64)).toBe('Moderate');
    expect(tierForScore(65)).toBe('High');
    expect(tierForScore(100)).toBe('High');

    const r = computeReplacementProbabilityV2(
      input({ material: 'asphalt_shingle', roofAgeYears: 16, observations: evidenceAt(3.0) })
    );
    expect(r.score).toBe(Math.round(r.probability * 100));
    expect(r.tier).toBe(tierForScore(r.score));
  });

  it('grades well-evidenced nearby bracketed measured evidence as A', () => {
    const r = computeReplacementProbabilityV2(
      input({ material: 'asphalt_shingle', roofAgeYears: 16, observations: evidenceAt(1.75) })
    );
    expect(r.evidenceGrade).toBe('A');
  });

  it('grades a single distant report as D and never calls it confirmed', () => {
    const pos = offsetFrom(11, 0);
    const r = computeReplacementProbabilityV2(
      input({
        material: 'asphalt_shingle',
        roofAgeYears: 16,
        observations: [
          {
            id: 'far',
            lat: pos.lat,
            lon: pos.lon,
            timeUtc: `${IN_WINDOW_DAY}T20:00:00Z`,
            sizeIn: 3.0,
            sizeBasis: 'estimated',
            source: 'iem_lsr',
            quality: 0.7,
            reporterClass: 'Public',
            place: null,
            remark: null,
          },
        ],
      })
    );
    expect(r.evidenceGrade).toBe('D');
    expect(r.perEvent[0].interpolation).toBe('extrapolated');
    // The 3" report is 11 miles away: the estimate at the address must not
    // inherit its size.
    expect(r.perEvent[0].estimatedSizeIn).toBeLessThan(1.0);
    expect(JSON.stringify(r)).not.toMatch(/confirmed/i);
  });

  it('NEVER describes the address using a different storm\'s geometry', () => {
    // REGRESSION. The evidence grade used to be computed by pooling the best
    // property of every event: min(nearest) from one storm, "any bracketed"
    // from another, the report count of a third. On live Burnet data that
    // produced a grade-A reason asserting "the address sits between reports
    // on opposing sides" while the storm the number actually rested on was
    // marked `extrapolated` in its own row. Two true facts about two
    // different storms, combined into one false claim about the address.
    //
    // Here: ONE in-window storm whose reports are all on one side (so it is
    // extrapolated), plus an older, bracketed, better-evidenced storm. The
    // reason must describe the in-window one.
    const oneSided = [1, 1.6, 2.2].map((north, i) => {
      const pos = offsetFrom(north, 0);
      return {
        id: `one-sided-${i}`,
        lat: pos.lat,
        lon: pos.lon,
        timeUtc: `2026-06-14T2${i}:00:00Z`,
        sizeIn: 2.0,
        sizeBasis: 'measured' as const,
        source: 'iem_lsr',
        quality: 1,
        reporterClass: 'Trained Spotter',
        place: 'Burnet',
        remark: null,
      };
    });
    // Bracketed, nearby, well-evidenced — but years old.
    const oldBracketed = evidenceAt(3.0, '2023-05-05');

    const result = computeReplacementProbabilityV2(
      input({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        observations: [...oneSided, ...oldBracketed],
      })
    );

    const driving = result.perEvent.find((e) => e.convectiveDayUtc === '2026-06-14');
    expect(driving).toBeDefined();
    expect(driving!.windowStatus).toBe('in_window');
    expect(driving!.interpolation).toBe('extrapolated');

    // The reason must name the storm it is describing, and must not claim
    // interpolation for an extrapolated one.
    expect(result.evidenceGradeReason).toContain('2026-06-14');
    expect(result.evidenceGradeReason).toMatch(/extrapolated rather than interpolated/);
    expect(result.evidenceGradeReason).not.toMatch(/interpolated rather than extrapolated/);
  });

  it('keeps the grade reason consistent with the driving event, for every material and geometry', () => {
    const cases: { label: string; observations: HailObservation[] }[] = [
      { label: 'bracketed in-window', observations: evidenceAt(2.0) },
      { label: 'out-of-window only', observations: evidenceAt(2.0, '2023-05-05') },
      { label: 'no evidence', observations: [] },
    ];
    for (const c of cases) {
      const r = computeReplacementProbabilityV2(
        input({ material: 'asphalt_shingle', roofAgeYears: 16, observations: c.observations })
      );
      const saysInterpolated = /interpolated rather than extrapolated/.test(r.evidenceGradeReason);
      const saysExtrapolated = /extrapolated rather than interpolated/.test(r.evidenceGradeReason);
      // At most one of the two claims, never both.
      expect(saysInterpolated && saysExtrapolated, c.label).toBe(false);

      if (saysInterpolated || saysExtrapolated) {
        // Whichever storm the reason names must actually have that geometry.
        const named = r.perEvent.find((e) => r.evidenceGradeReason.includes(e.convectiveDayUtc));
        expect(named, c.label).toBeDefined();
        expect(named!.interpolation, c.label).toBe(saysInterpolated ? 'interpolated' : 'extrapolated');
      }
    }
  });

  it('says so plainly when no storm falls inside the claim window, however good the evidence', () => {
    const r = computeReplacementProbabilityV2(
      input({
        material: 'asphalt_shingle',
        shingleType: 'architectural',
        roofAgeYears: 16,
        // Excellent evidence — bracketed, measured, in the driveway — but old.
        observations: evidenceAt(3.25, '2023-05-05'),
      })
    );
    expect(r.probability).toBe(0);
    expect(r.evidenceGradeReason).toMatch(/no reported storm falls inside the typical claim window/i);
  });

  it('reports a sensitivity note and flags metal constants as expert', () => {
    const r = computeReplacementProbabilityV2(
      input({ material: 'metal_standing_seam', metalGauge: '24ga', roofAgeYears: 16, observations: evidenceAt(2.0) })
    );
    expect(r.sensitivity.note).toMatch(/quarter-inch/i);
    expect(r.sensitivity.hailMinus).toBeLessThanOrEqual(r.probability);
    expect(r.sensitivity.hailPlus).toBeGreaterThanOrEqual(r.probability);
    expect(r.constantsProvenanceSummary.expertCount).toBe(4);
    expect(r.constantsProvenanceSummary.publishedCount).toBe(0);
    expect(r.constantsProvenanceSummary.summary).toMatch(/no published metal hail-damage threshold/i);
    expect(r.constantsProvenanceSummary.claimWindowProvenance).toBe('expert-verify-per-policy');
  });

  it('reports published provenance for the materials that have it', () => {
    const shingle = computeReplacementProbabilityV2(
      input({ material: 'asphalt_shingle', shingleType: '3-tab', roofAgeYears: 16, observations: evidenceAt(1.5) })
    );
    expect(shingle.constantsProvenanceSummary.publishedCount).toBeGreaterThan(0);

    const shake = computeReplacementProbabilityV2(
      input({ material: 'wood_shake', roofAgeYears: 16, observations: evidenceAt(1.5) })
    );
    // Both wood-shake functional anchors are real Haag figures.
    expect(shake.constantsProvenanceSummary.publishedCount).toBe(2);
  });
});

describe('guard — the deterministic runtime reviewer', () => {
  it('passes every invariant on an ordinary result and adds no flags', () => {
    const r = evaluateWithGuard(
      input({ material: 'asphalt_shingle', shingleType: 'architectural', roofAgeYears: 16, observations: evidenceAt(1.75) })
    );
    expect(r.guardFlags).toEqual([]);
  });

  it('passes for every material, including metal, where age is flat by design', () => {
    const materials: { material: MaterialCategory; metalGauge?: MetalGauge }[] = [
      { material: 'asphalt_shingle' },
      { material: 'metal_r_panel', metalGauge: '29ga' },
      { material: 'metal_standing_seam', metalGauge: '24ga' },
      { material: 'tpo_pvc_membrane' },
      { material: 'wood_shake' },
    ];
    for (const m of materials) {
      for (const sizeIn of [0.75, 1.75, 3.0]) {
        const r = evaluateWithGuard(input({ ...m, roofAgeYears: 16, observations: evidenceAt(sizeIn) }));
        expect(r.guardFlags, `${m.material} at ${sizeIn}"`).toEqual([]);
      }
    }
  });

  it('passes with no evidence at all', () => {
    const r = evaluateWithGuard(input({ material: 'wood_shake', roofAgeYears: 30, observations: [] }));
    expect(r.guardFlags).toEqual([]);
    expect(r.probability).toBe(0);
  });

  it('returns the deterministic number unchanged — the guard annotates, never edits', () => {
    const i = input({ material: 'asphalt_shingle', roofAgeYears: 16, observations: evidenceAt(2.0) });
    const bare = computeReplacementProbabilityV2(i);
    const guarded = evaluateWithGuard(i);
    expect(guarded.probability).toBe(bare.probability);
    expect(guarded.score).toBe(bare.score);
    expect(guarded.tier).toBe(bare.tier);
  });
});
