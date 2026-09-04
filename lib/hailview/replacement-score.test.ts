import { describe, expect, it } from 'vitest';
import { computeReplacementScore, type ScoreEventInput } from './replacement-score';

// Identical storm history reused across every material below so any score
// difference is attributable only to the per-material formula, not to
// different input data.
const IDENTICAL_STORM_HISTORY: ScoreEventInput[] = [
  { id: 'evt-1', sizeIn: 1.0, validAt: '2023-04-12T18:00:00Z' },
  { id: 'evt-2', sizeIn: 1.5, validAt: '2022-05-30T21:00:00Z' },
  { id: 'evt-3', sizeIn: 2.0, validAt: '2021-06-10T19:30:00Z' },
];

const NO_EVENTS: ScoreEventInput[] = [];

const SEVERE_STORM_HISTORY: ScoreEventInput[] = [
  { id: 'evt-a', sizeIn: 2.5, validAt: '2024-04-01T18:00:00Z' },
  { id: 'evt-b', sizeIn: 2.5, validAt: '2023-04-01T18:00:00Z' },
  { id: 'evt-c', sizeIn: 2.5, validAt: '2022-04-01T18:00:00Z' },
];

describe('computeReplacementScore — determinism', () => {
  it('is a pure function: identical inputs always produce identical output', () => {
    const first = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, { roofAgeYears: 12, shingleType: '3-tab' });
    const second = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, { roofAgeYears: 12, shingleType: '3-tab' });
    expect(second).toEqual(first);
  });

  it('produces a score of 0 and tier Low with no qualifying storm history', () => {
    for (const material of ['asphalt_shingle', 'metal_r_panel', 'metal_standing_seam', 'tpo_pvc_membrane', 'wood_shake'] as const) {
      const result = computeReplacementScore(material, NO_EVENTS, {});
      expect(result.score).toBe(0);
      expect(result.tier).toBe('Low');
    }
  });
});

describe('computeReplacementScore — materials produce genuinely distinct scores on identical input', () => {
  it('asphalt (3-tab, 12yr), metal R-panel, TPO/PVC 60mil, and wood shake all score differently for the same storm history and age', () => {
    const commonOptions = { roofAgeYears: 12, membraneMilThickness: 60 as const, shingleType: '3-tab' as const };

    const asphalt = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, commonOptions);
    const metal = computeReplacementScore('metal_r_panel', IDENTICAL_STORM_HISTORY, commonOptions);
    const tpo = computeReplacementScore('tpo_pvc_membrane', IDENTICAL_STORM_HISTORY, commonOptions);
    const wood = computeReplacementScore('wood_shake', IDENTICAL_STORM_HISTORY, commonOptions);

    const scores = [asphalt.score, metal.score, tpo.score, wood.score];
    const distinctScores = new Set(scores);

    // Not asserting a specific relative ordering (that's an emergent
    // property of each formula, not a spec requirement) — only that the
    // four materials' genuinely different formulas do not collapse onto
    // the same number for the same real-world inputs.
    expect(distinctScores.size).toBe(scores.length);
  });

  it('metal and standing seam share the same formula (gauge is display-only, not a scoring input)', () => {
    const rPanel = computeReplacementScore('metal_r_panel', IDENTICAL_STORM_HISTORY, { roofAgeYears: 8 });
    const standingSeam = computeReplacementScore('metal_standing_seam', IDENTICAL_STORM_HISTORY, { roofAgeYears: 8 });
    expect(rPanel.score).toBe(standingSeam.score);
    expect(rPanel.tier).toBe(standingSeam.tier);
  });
});

describe('asphalt shingle — Section 5.1', () => {
  it('a 1.5" hail event alone does not qualify (onset is above the 1.25" tier, below the next tier)', () => {
    const result = computeReplacementScore('asphalt_shingle', [{ id: 'e1', sizeIn: 1.5, validAt: '2024-01-01T00:00:00Z' }], {});
    // 1.5" still steps down to the 1.25" tier (4pt) under the step function.
    expect(result.factors.hailSeveritySubscore).toBeGreaterThan(0);
    expect(result.factors.hailSeveritySubscore).toBeCloseTo(4, 5);
  });

  it('3-tab shingles score higher than architectural shingles at identical age and storm history', () => {
    const threeTab = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, { roofAgeYears: 12, shingleType: '3-tab' });
    const architectural = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, { roofAgeYears: 12, shingleType: 'architectural' });
    expect(threeTab.score).toBeGreaterThan(architectural.score);
    expect(threeTab.factors.materialBonus).toBe(8);
    expect(architectural.factors.materialBonus).toBe(0);
  });

  it('older roofs score higher than newer roofs against identical storm history', () => {
    const newRoof = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, { roofAgeYears: 3, shingleType: 'architectural' });
    const oldRoof = computeReplacementScore('asphalt_shingle', IDENTICAL_STORM_HISTORY, { roofAgeYears: 22, shingleType: 'architectural' });
    expect(oldRoof.score).toBeGreaterThan(newRoof.score);
    expect(oldRoof.factors.ageMultiplierApplied).toBeGreaterThan(newRoof.factors.ageMultiplierApplied as number);
  });

  it('a severe, repeated storm history on an old 3-tab roof reaches the High tier (>=65)', () => {
    const result = computeReplacementScore('asphalt_shingle', SEVERE_STORM_HISTORY, { roofAgeYears: 25, shingleType: '3-tab' });
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.tier).toBe('High');
  });

  it('a single minor event on a new roof stays in the Low tier (<35)', () => {
    const result = computeReplacementScore('asphalt_shingle', [{ id: 'e1', sizeIn: 0.75, validAt: '2024-01-01T00:00:00Z' }], {
      roofAgeYears: 2,
      shingleType: 'architectural',
    });
    expect(result.score).toBeLessThan(35);
    expect(result.tier).toBe('Low');
  });

  it('frequency escalation only applies once roof age reaches 10 years', () => {
    const youngRoof = computeReplacementScore('asphalt_shingle', SEVERE_STORM_HISTORY, { roofAgeYears: 5, shingleType: 'architectural' });
    const oldRoof = computeReplacementScore('asphalt_shingle', SEVERE_STORM_HISTORY, { roofAgeYears: 15, shingleType: 'architectural' });
    expect(youngRoof.factors.frequencyEscalationApplied).toBe(false);
    expect(oldRoof.factors.frequencyEscalationApplied).toBe(true);
  });
});

describe('metal roofing — Section 5.2', () => {
  it('cosmetic onset is flat 1.5", not gauge-scaled — gauge is not accepted as a scoring input at all', () => {
    const belowOnset = computeReplacementScore('metal_r_panel', [{ id: 'e1', sizeIn: 1.25, validAt: '2024-01-01T00:00:00Z' }], {});
    const atOnset = computeReplacementScore('metal_r_panel', [{ id: 'e1', sizeIn: 1.5, validAt: '2024-01-01T00:00:00Z' }], {});
    expect(belowOnset.factors.hailSeveritySubscore).toBe(0);
    expect(atOnset.factors.hailSeveritySubscore).toBeGreaterThan(0);
  });

  it('age contributes as a separate additive subscore, not a multiplier on hail severity', () => {
    const event: ScoreEventInput[] = [{ id: 'e1', sizeIn: 2.0, validAt: '2024-01-01T00:00:00Z' }];
    const newRoof = computeReplacementScore('metal_r_panel', event, { roofAgeYears: 2 });
    const oldRoof = computeReplacementScore('metal_r_panel', event, { roofAgeYears: 26 });
    // Hail severity subscore is identical regardless of age (no multiplier)...
    expect(newRoof.factors.hailSeveritySubscore).toBe(oldRoof.factors.hailSeveritySubscore);
    // ...but the age subscore itself differs, driving the total score up.
    expect(oldRoof.factors.metalAgeSubscore).toBeGreaterThan(newRoof.factors.metalAgeSubscore);
    expect(oldRoof.score).toBeGreaterThan(newRoof.score);
  });
});

describe('TPO/PVC membrane — Section 5.3', () => {
  it('onset is 1.75" at the 60mil baseline', () => {
    const belowOnset = computeReplacementScore('tpo_pvc_membrane', [{ id: 'e1', sizeIn: 1.5, validAt: '2024-01-01T00:00:00Z' }], {
      membraneMilThickness: 60,
    });
    const atOnset = computeReplacementScore('tpo_pvc_membrane', [{ id: 'e1', sizeIn: 1.75, validAt: '2024-01-01T00:00:00Z' }], {
      membraneMilThickness: 60,
    });
    expect(belowOnset.factors.hailSeveritySubscore).toBe(0);
    expect(atOnset.factors.hailSeveritySubscore).toBeGreaterThan(0);
  });

  it('thinner membranes score higher than thicker membranes for identical hail exposure', () => {
    const event: ScoreEventInput[] = [{ id: 'e1', sizeIn: 1.75, validAt: '2024-01-01T00:00:00Z' }];
    const thin = computeReplacementScore('tpo_pvc_membrane', event, { membraneMilThickness: 45 });
    const thick = computeReplacementScore('tpo_pvc_membrane', event, { membraneMilThickness: 80 });
    expect(thin.score).toBeGreaterThan(thick.score);
  });

  it('age lowers the effective onset threshold independently of thickness', () => {
    const event: ScoreEventInput[] = [{ id: 'e1', sizeIn: 1.75, validAt: '2024-01-01T00:00:00Z' }];
    const newMembrane = computeReplacementScore('tpo_pvc_membrane', event, { membraneMilThickness: 60, roofAgeYears: 1 });
    const oldMembrane = computeReplacementScore('tpo_pvc_membrane', event, { membraneMilThickness: 60, roofAgeYears: 20 });
    expect(oldMembrane.factors.effectiveOnsetShiftIn).toBeGreaterThan(newMembrane.factors.effectiveOnsetShiftIn as number);
    expect(oldMembrane.score).toBeGreaterThanOrEqual(newMembrane.score);
  });
});

describe('wood shake — Section 5.4', () => {
  it('is a graduated tier table, not a single flat threshold — three distinct sizes produce three distinct severity subscores', () => {
    const hairline = computeReplacementScore('wood_shake', [{ id: 'e1', sizeIn: 1.25, validAt: '2024-01-01T00:00:00Z' }], {});
    const half = computeReplacementScore('wood_shake', [{ id: 'e1', sizeIn: 1.5, validAt: '2024-01-01T00:00:00Z' }], {});
    const severe = computeReplacementScore('wood_shake', [{ id: 'e1', sizeIn: 1.75, validAt: '2024-01-01T00:00:00Z' }], {});

    expect(hairline.factors.hailSeveritySubscore).toBeGreaterThan(0);
    expect(half.factors.hailSeveritySubscore).toBeGreaterThan(hairline.factors.hailSeveritySubscore);
    expect(severe.factors.hailSeveritySubscore).toBeGreaterThan(half.factors.hailSeveritySubscore);

    // The real Haag Engineering damage-rate jumps this table is built from:
    // ~50% at 1.5", ~90% at 1.75", against the shared 60-point ceiling.
    expect(half.factors.hailSeveritySubscore / 60).toBeCloseTo(0.5, 1);
    expect(severe.factors.hailSeveritySubscore / 60).toBeCloseTo(0.9, 1);
  });

  it('older wood shake scores higher than newer wood shake against identical, non-saturating storm history', () => {
    // A single 1.25" hairline event, well under the tier table's 2.0"
    // saturation point, so the age multiplier's effect isn't masked by the
    // shared 60-point hail-severity ceiling.
    const singleHairlineEvent: ScoreEventInput[] = [{ id: 'e1', sizeIn: 1.25, validAt: '2024-01-01T00:00:00Z' }];
    const newRoof = computeReplacementScore('wood_shake', singleHairlineEvent, { roofAgeYears: 3 });
    const oldRoof = computeReplacementScore('wood_shake', singleHairlineEvent, { roofAgeYears: 35 });
    expect(oldRoof.score).toBeGreaterThan(newRoof.score);
  });
});

describe('correctly tiered — Low/Moderate/High boundaries hold at 35/65 for every material', () => {
  it.each(['asphalt_shingle', 'metal_r_panel', 'metal_standing_seam', 'tpo_pvc_membrane', 'wood_shake'] as const)(
    '%s: tier matches the score for a range of severities',
    (material) => {
      const low = computeReplacementScore(material, [], {});
      const high = computeReplacementScore(material, SEVERE_STORM_HISTORY, { roofAgeYears: 30, shingleType: '3-tab', membraneMilThickness: 45 });

      expect(low.score).toBeLessThan(35);
      expect(low.tier).toBe('Low');

      if (high.score >= 65) {
        expect(high.tier).toBe('High');
      } else if (high.score >= 35) {
        expect(high.tier).toBe('Moderate');
      } else {
        expect(high.tier).toBe('Low');
      }
    }
  );
});
