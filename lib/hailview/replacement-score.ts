import type { MaterialCategory, MembraneMilThickness, ReplacementTier, ShingleType } from './types';

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISM CONTRACT — read before touching this file.
//
// Everything in this file is pure, synchronous, and deterministic: same
// inputs always produce the same score. No network call, no model/agent
// call, and no randomness happens anywhere in this file. The agentic
// synthesis layer (lib/hailview/explanation.ts, called from
// app/api/hailview/storm-history/route.ts) runs strictly AFTER this module
// has already produced a final score/tier, and is given that score/tier as
// a fact to explain — it is never allowed to recompute or override it. This
// separation is what makes the score defensible if a customer or insurer
// ever asks how it was derived. See SPEC_HAILVIEW.md Section 1 and 6.
//
// PROVENANCE NOTE (afs-hv-002): this replaces afs-hv-001's placeholder
// scoring engine, which its own header comment admitted was "a new,
// from-scratch implementation" because SPEC_HAILVIEW.md did not exist in
// the repo at the time. SPEC_HAILVIEW.md now exists (Section 5) and this
// file implements it directly. Two numeric bridges in Section 5.1 are not
// fully pinned down by the spec's prose and required an interpretive
// choice — both are called out at their point of use below and in
// STATE_OF_THE_BUILD.md:
//   1. The "unbounded" hail-size tier in the HAIL_TIERS point table has no
//      stated numeric threshold (see ASPHALT_SHINGLE_HAIL_TIERS below).
//   2. The spec names an "age subscore (0-56, additive)" as a term
//      independent from the "age-adjusted severity multiplier," but gives
//      only one age-derived formula (the multiplier, 1.0x-2.0x). The age
//      subscore below is derived from that same multiplier, scaled so the
//      multiplier's own stated range (1.0x-2.0x) maps onto the age
//      subscore's own stated range (0-56) — see shingleAgeAdjustment()
//      below.
// ─────────────────────────────────────────────────────────────────────────

export interface HailTier {
  minSizeIn: number;
  /** Absolute points this tier contributes toward a material's hail-severity subscore. */
  points: number;
}

// Step function (finds the highest tier whose minSizeIn <= the event's hail
// size) — kept as a plain step function, not interpolation, so any two
// people auditing the same event list by hand get the same result without
// needing a calculator. Shared by all four materials below.
function pointsForSize(tiers: HailTier[], sizeIn: number): number {
  let points = 0;
  for (const tier of tiers) {
    if (sizeIn >= tier.minSizeIn) points = tier.points;
  }
  return points;
}

// ─────────────────────────────────────────────────────────────────────────
// 5.1 ASPHALT SHINGLE (3-tab / architectural)
// ─────────────────────────────────────────────────────────────────────────

// SPEC_HAILVIEW.md Section 5.1: "HAIL_TIERS size-based point table (0.75"→
// 0.5pt, 1.0"→1.5pt, 1.25"→4pt, 1.75"→7pt, unbounded→12pt)." The first four
// thresholds are given as exact numbers; the fifth is only labeled
// "unbounded" with no numeric threshold. 2.00" is used here as that tier's
// threshold — the next standard NWS local-storm-report hail-size increment
// above 1.75" (golf ball -> hen egg) — because the spec gives no other
// number to anchor it to. If Reid's real e4roofing constant differs, only
// this one minSizeIn needs to change.
const ASPHALT_SHINGLE_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 0.75, points: 0.5 },
  { minSizeIn: 1.0, points: 1.5 },
  { minSizeIn: 1.25, points: 4 },
  { minSizeIn: 1.75, points: 7 },
  { minSizeIn: 2.0, points: 12 }, // "unbounded" tier — see note above
];

const SHINGLE_TYPICAL_LIFESPAN_YEARS: Record<ShingleType, number> = {
  '3-tab': 17.5,
  architectural: 27.5,
};

const SHINGLE_3TAB_BONUS = 8;

// Age-adjusted severity multiplier, per Section 5.1: 1.0x under 10yr, 1.2x
// at 10-15yr, 1.45x at 15-20yr, 1.7x at 20yr+, plus up to +0.3 once past
// the shingle type's typical lifespan ratio, capped at 2.0x total.
const SHINGLE_AGE_BAND_MULTIPLIER_MAX = 2.0;
const SHINGLE_LIFESPAN_RATIO_BONUS_MAX = 0.3;
// The spec caps the lifespan-ratio bonus at +0.3 but does not state the
// ratio at which that cap is reached. A roof at 1.5x its typical lifespan
// (50% past end-of-life) is used here as the point the bonus maxes out,
// scaling linearly from 0 at ratio 1.0 (exactly at typical lifespan).
const SHINGLE_LIFESPAN_RATIO_BONUS_FULL_AT = 1.5;

interface ShingleAgeAdjustment {
  multiplier: number;
  /** Points term (0-56) derived from the same multiplier — see file header note. */
  ageSubscore: number;
}

function shingleAgeAdjustment(roofAgeYears: number | undefined, shingleType: ShingleType | undefined): ShingleAgeAdjustment {
  if (roofAgeYears === undefined || !Number.isFinite(roofAgeYears)) {
    return { multiplier: 1.0, ageSubscore: 0 };
  }

  const band = roofAgeYears < 10 ? 1.0 : roofAgeYears < 15 ? 1.2 : roofAgeYears < 20 ? 1.45 : 1.7;

  let lifespanBonus = 0;
  if (shingleType) {
    const typicalLifespan = SHINGLE_TYPICAL_LIFESPAN_YEARS[shingleType];
    const lifespanRatio = roofAgeYears / typicalLifespan;
    if (lifespanRatio > 1) {
      const progress = (lifespanRatio - 1) / (SHINGLE_LIFESPAN_RATIO_BONUS_FULL_AT - 1);
      lifespanBonus = Math.min(SHINGLE_LIFESPAN_RATIO_BONUS_MAX, progress * SHINGLE_LIFESPAN_RATIO_BONUS_MAX);
    }
  }

  const multiplier = Math.min(SHINGLE_AGE_BAND_MULTIPLIER_MAX, band + lifespanBonus);
  // Multiplier's own stated range (1.0x-2.0x) mapped onto the age
  // subscore's own stated range (0-56) — see file header note #2.
  const ageSubscore = Math.min(56, Math.max(0, (multiplier - 1.0) * 56));

  return { multiplier, ageSubscore };
}

// ─────────────────────────────────────────────────────────────────────────
// 5.2 METAL (R-panel / standing seam)
// ─────────────────────────────────────────────────────────────────────────

// Confirmed by Reid: flat 1.5" cosmetic-damage onset for BOTH metal
// sub-types — gauge is a display/dropdown input only, never a severity
// input here (see MaterialScoreOptions below — metal gauge is intentionally
// not accepted as a scoring parameter).
const METAL_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 1.5, points: 30 },
  { minSizeIn: 1.75, points: 42 },
  { minSizeIn: 2.0, points: 54 },
  { minSizeIn: 2.5, points: 60 },
];

// Metal's failure mode is denting from direct impact, not the granule-loss/
// mat-fracture aging curve that drives shingle brittleness — so age is
// applied as its own separately-derived ADDITIVE term (fastener/sealant/
// finish wear accumulating over time) rather than as a multiplier on hail
// severity. Starts accruing at year 5, +1pt/year, caps at 20pts by year 25.
const METAL_AGE_SUBSCORE_START_YEARS = 5;
const METAL_AGE_SUBSCORE_MAX = 20;

function metalAgeSubscore(roofAgeYears: number | undefined): number {
  if (roofAgeYears === undefined || !Number.isFinite(roofAgeYears)) return 0;
  return Math.min(METAL_AGE_SUBSCORE_MAX, Math.max(0, roofAgeYears - METAL_AGE_SUBSCORE_START_YEARS));
}

// ─────────────────────────────────────────────────────────────────────────
// 5.3 TPO / PVC MEMBRANE
// ─────────────────────────────────────────────────────────────────────────

// Onset baseline 1.75" per UL 2218 Class 4. Points scaled proportionally
// from afs-hv-001's original 0.40/0.65/0.85/1.00 severity fractions onto a
// 60-point max, matching the 0-60 hail-severity budget used across all four
// materials.
const TPO_PVC_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 1.75, points: 24 },
  { minSizeIn: 2.0, points: 39 },
  { minSizeIn: 2.5, points: 51 },
  { minSizeIn: 3.0, points: 60 },
];

// Thickness and age each independently shift the EFFECTIVE onset threshold
// rather than scaling a computed severity number — this models "a smaller
// real hailstone counts as a bigger one" for a thinner or older membrane,
// per Section 5.3 ("thinner = lower effective threshold... age modifier...
// independently of thickness"). Implemented by adding the shift to the
// event's real size before the tier lookup above, which is equivalent to
// lowering the tier thresholds themselves.
const MEMBRANE_THICKNESS_ONSET_SHIFT_IN: Record<MembraneMilThickness, number> = {
  45: 0.15, // thinner — effective onset lowered
  60: 0, // baseline
  80: -0.15, // thicker — effective onset raised
};

// Aged, UV-degraded membranes lose flexibility independent of thickness —
// per Section 5.3's cited 10-year-fracture-under-lesser-hail finding, onset
// is lowered 0.10" per decade of age, capped at -0.20" (20+ years).
const MEMBRANE_AGE_ONSET_SHIFT_PER_DECADE_IN = 0.1;
const MEMBRANE_AGE_ONSET_SHIFT_MAX_IN = 0.2;

function membraneOnsetShiftIn(mil: MembraneMilThickness | undefined, roofAgeYears: number | undefined): number {
  const thicknessShift = mil !== undefined ? MEMBRANE_THICKNESS_ONSET_SHIFT_IN[mil] : 0;
  const ageShift =
    roofAgeYears !== undefined && Number.isFinite(roofAgeYears)
      ? Math.min(MEMBRANE_AGE_ONSET_SHIFT_MAX_IN, Math.max(0, roofAgeYears / 10) * MEMBRANE_AGE_ONSET_SHIFT_PER_DECADE_IN)
      : 0;
  return thicknessShift + ageShift;
}

// ─────────────────────────────────────────────────────────────────────────
// 5.4 WOOD SHAKE
// ─────────────────────────────────────────────────────────────────────────

// Real graduated Haag Engineering breakpoints (Section 5.4), NOT a single
// flat threshold: ~1.25" hairline-fracture onset, ~1.5" ~50% damage rate,
// ~1.75"+ ~90% damage rate. Points chosen so the ratios between tiers
// mirror those real damage-rate percentages against the shared 60-point
// hail-severity budget (30/60 = 50%, 54/60 = 90%), with a final saturation
// tier at 2.00"+.
const WOOD_SHAKE_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 1.25, points: 12 }, // hairline onset
  { minSizeIn: 1.5, points: 30 }, // ~50% damage rate
  { minSizeIn: 1.75, points: 54 }, // ~90% damage rate
  { minSizeIn: 2.0, points: 60 }, // saturation
];

// Section 5.4: "Age modulates this the same conceptual way as shingles
// (older wood is more brittle)" — same SHAPE (banded multiplier on hail
// severity), but its own separately-derived constants, since wood shake has
// no stated typical-lifespan figure to build a lifespan-ratio bonus from
// (unlike the shingle 17.5yr/27.5yr figures in 5.1).
function woodShakeAgeMultiplier(roofAgeYears: number | undefined): number {
  if (roofAgeYears === undefined || !Number.isFinite(roofAgeYears)) return 1.0;
  if (roofAgeYears < 10) return 1.0;
  if (roofAgeYears < 20) return 1.15;
  if (roofAgeYears < 30) return 1.35;
  return 1.55;
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED FREQUENCY SUBSCORE
// ─────────────────────────────────────────────────────────────────────────

const FREQUENCY_SUBSCORE_MAX = 20;
const FREQUENCY_POINTS_PER_EVENT = 5;
// Asphalt-specific escalation per Section 5.1: "+15% per additional
// qualifying event, capped at 2.5x," gated on roof age >=10yr — the only
// material Section 5 states this escalation rule for. Metal/TPO-PVC/wood
// use the same base per-event weight without this escalation, which is
// itself part of what keeps the four formulas genuinely distinct rather
// than one shared curve reused four times.
const FREQUENCY_ESCALATION_STEP = 0.15;
const FREQUENCY_ESCALATION_MAX = 2.5;
const FREQUENCY_ESCALATION_MIN_AGE_YEARS = 10;

function frequencySubscore(qualifyingCount: number, escalationEligible: boolean): { subscore: number; escalationApplied: boolean } {
  const base = Math.min(FREQUENCY_SUBSCORE_MAX, qualifyingCount * FREQUENCY_POINTS_PER_EVENT);
  if (!escalationEligible || qualifyingCount < 2) {
    return { subscore: base, escalationApplied: false };
  }
  const multiplier = Math.min(FREQUENCY_ESCALATION_MAX, 1 + FREQUENCY_ESCALATION_STEP * (qualifyingCount - 1));
  return { subscore: Math.min(FREQUENCY_SUBSCORE_MAX, base * multiplier), escalationApplied: true };
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED TIER MAPPING — Section 5.1: Low <35, Moderate 35-64, High >=65.
// Applied uniformly across all four materials (Section 5.2-5.4 do not
// state different breakpoints).
// ─────────────────────────────────────────────────────────────────────────

const TIER_LOW_MAX = 34; // 0–34
const TIER_MODERATE_MAX = 64; // 35–64, 65+ is High

function tierForScore(score: number): ReplacementTier {
  if (score <= TIER_LOW_MAX) return 'Low';
  if (score <= TIER_MODERATE_MAX) return 'Moderate';
  return 'High';
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────

export interface ScoreEventInput {
  id: string;
  sizeIn: number;
  validAt: string;
}

export interface MaterialScoreOptions {
  roofAgeYears?: number; // all materials except tpo_pvc_membrane's own thickness-only path ignore this only if undefined
  shingleType?: ShingleType; // asphalt_shingle only — ignored for other materials
  membraneMilThickness?: MembraneMilThickness; // tpo_pvc_membrane only
  // metal gauge is intentionally NOT accepted here — it is a display-only
  // input for metal_r_panel/metal_standing_seam, never part of the score.
}

export interface ScoredEvent {
  id: string;
  sizeIn: number;
  validAt: string;
  basePoints: number; // raw HAIL_TIERS point lookup for this material, before any age/thickness adjustment
  adjustedPoints: number; // after this material's age-multiplier / onset-shift, whichever applies
  qualifying: boolean;
}

export interface MaterialScoreFactors {
  ageSubscore: number; // 0-56 additive age term — asphalt_shingle only, 0 otherwise
  ageMultiplierApplied: number | null; // hail-severity age multiplier — asphalt_shingle and wood_shake only, null otherwise
  metalAgeSubscore: number; // 0-20 additive age term — metal_r_panel/metal_standing_seam only, 0 otherwise
  materialBonus: number; // e.g. asphalt 3-tab +8
  materialBonusLabel: string | null;
  effectiveOnsetShiftIn: number | null; // tpo_pvc_membrane only (thickness + age combined), null otherwise
  hailSeveritySubscore: number; // 0-60
  qualifyingEventCount: number;
  largestQualifyingEvent: ScoredEvent | null;
  frequencySubscore: number; // 0-20
  frequencyEscalationApplied: boolean;
}

export interface ScoreResult {
  score: number;
  tier: ReplacementTier;
  factors: MaterialScoreFactors;
  scoredEvents: ScoredEvent[];
}

/**
 * The one entry point into this module. Deterministic and synchronous —
 * see the DETERMINISM CONTRACT comment at the top of this file. Each
 * material below has a genuinely different formula shape (Section 5.1-5.4),
 * not one shared curve with swapped constants — see the per-material
 * sections above for what differs and why.
 */
export function computeReplacementScore(
  material: MaterialCategory,
  hailEvents: ScoreEventInput[],
  options: MaterialScoreOptions = {}
): ScoreResult {
  switch (material) {
    case 'asphalt_shingle':
      return scoreAsphaltShingle(hailEvents, options);
    case 'metal_r_panel':
    case 'metal_standing_seam':
      return scoreMetal(hailEvents, options);
    case 'tpo_pvc_membrane':
      return scoreTpoPvc(hailEvents, options);
    case 'wood_shake':
      return scoreWoodShake(hailEvents, options);
  }
}

function finalize(rawScore: number, scoredEvents: ScoredEvent[], factors: MaterialScoreFactors): ScoreResult {
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));
  return { score, tier: tierForScore(score), factors, scoredEvents };
}

function largestQualifying(scoredEvents: ScoredEvent[]): ScoredEvent | null {
  const qualifying = scoredEvents.filter((e) => e.qualifying);
  if (qualifying.length === 0) return null;
  return qualifying.reduce((largest, e) => (e.adjustedPoints > largest.adjustedPoints ? e : largest));
}

function scoreAsphaltShingle(hailEvents: ScoreEventInput[], options: MaterialScoreOptions): ScoreResult {
  const { multiplier, ageSubscore } = shingleAgeAdjustment(options.roofAgeYears, options.shingleType);

  const scoredEvents: ScoredEvent[] = hailEvents.map((event) => {
    const basePoints = pointsForSize(ASPHALT_SHINGLE_HAIL_TIERS, event.sizeIn);
    const adjustedPoints = basePoints * multiplier;
    return { id: event.id, sizeIn: event.sizeIn, validAt: event.validAt, basePoints, adjustedPoints, qualifying: adjustedPoints > 0 };
  });

  const hailSeveritySubscore = Math.min(60, scoredEvents.reduce((sum, e) => sum + e.adjustedPoints, 0));
  const qualifyingCount = scoredEvents.filter((e) => e.qualifying).length;
  const escalationEligible = options.roofAgeYears !== undefined && options.roofAgeYears >= FREQUENCY_ESCALATION_MIN_AGE_YEARS;
  const { subscore: freqSubscore, escalationApplied } = frequencySubscore(qualifyingCount, escalationEligible);
  const materialBonus = options.shingleType === '3-tab' ? SHINGLE_3TAB_BONUS : 0;

  const rawScore = ageSubscore + materialBonus + hailSeveritySubscore + freqSubscore;

  return finalize(rawScore, scoredEvents, {
    ageSubscore,
    ageMultiplierApplied: multiplier,
    metalAgeSubscore: 0,
    materialBonus,
    materialBonusLabel: options.shingleType === '3-tab' ? '3-tab flat risk bonus' : null,
    effectiveOnsetShiftIn: null,
    hailSeveritySubscore,
    qualifyingEventCount: qualifyingCount,
    largestQualifyingEvent: largestQualifying(scoredEvents),
    frequencySubscore: freqSubscore,
    frequencyEscalationApplied: escalationApplied,
  });
}

function scoreMetal(hailEvents: ScoreEventInput[], options: MaterialScoreOptions): ScoreResult {
  const scoredEvents: ScoredEvent[] = hailEvents.map((event) => {
    const basePoints = pointsForSize(METAL_HAIL_TIERS, event.sizeIn);
    // No age-multiplier on hail severity for metal — age is purely additive
    // (see metalAgeSubscore) because denting is not amplified by aging the
    // way granule loss/mat fracture is for shingles.
    return { id: event.id, sizeIn: event.sizeIn, validAt: event.validAt, basePoints, adjustedPoints: basePoints, qualifying: basePoints > 0 };
  });

  const hailSeveritySubscore = Math.min(60, scoredEvents.reduce((sum, e) => sum + e.adjustedPoints, 0));
  const qualifyingCount = scoredEvents.filter((e) => e.qualifying).length;
  const { subscore: freqSubscore, escalationApplied } = frequencySubscore(qualifyingCount, false);
  const ageSubscore = metalAgeSubscore(options.roofAgeYears);

  const rawScore = ageSubscore + hailSeveritySubscore + freqSubscore;

  return finalize(rawScore, scoredEvents, {
    ageSubscore: 0,
    ageMultiplierApplied: null,
    metalAgeSubscore: ageSubscore,
    materialBonus: 0,
    materialBonusLabel: null,
    effectiveOnsetShiftIn: null,
    hailSeveritySubscore,
    qualifyingEventCount: qualifyingCount,
    largestQualifyingEvent: largestQualifying(scoredEvents),
    frequencySubscore: freqSubscore,
    frequencyEscalationApplied: escalationApplied,
  });
}

function scoreTpoPvc(hailEvents: ScoreEventInput[], options: MaterialScoreOptions): ScoreResult {
  const onsetShiftIn = membraneOnsetShiftIn(options.membraneMilThickness, options.roofAgeYears);

  const scoredEvents: ScoredEvent[] = hailEvents.map((event) => {
    // Thickness/age lower (or raise) the EFFECTIVE onset threshold by
    // shifting the event's apparent size before the tier lookup — see
    // membraneOnsetShiftIn() above.
    const adjustedSizeIn = event.sizeIn + onsetShiftIn;
    const basePoints = pointsForSize(TPO_PVC_HAIL_TIERS, event.sizeIn);
    const adjustedPoints = pointsForSize(TPO_PVC_HAIL_TIERS, adjustedSizeIn);
    return { id: event.id, sizeIn: event.sizeIn, validAt: event.validAt, basePoints, adjustedPoints, qualifying: adjustedPoints > 0 };
  });

  const hailSeveritySubscore = Math.min(60, scoredEvents.reduce((sum, e) => sum + e.adjustedPoints, 0));
  const qualifyingCount = scoredEvents.filter((e) => e.qualifying).length;
  const { subscore: freqSubscore, escalationApplied } = frequencySubscore(qualifyingCount, false);

  const rawScore = hailSeveritySubscore + freqSubscore;

  return finalize(rawScore, scoredEvents, {
    ageSubscore: 0,
    ageMultiplierApplied: null,
    metalAgeSubscore: 0,
    materialBonus: 0,
    materialBonusLabel: null,
    effectiveOnsetShiftIn: onsetShiftIn,
    hailSeveritySubscore,
    qualifyingEventCount: qualifyingCount,
    largestQualifyingEvent: largestQualifying(scoredEvents),
    frequencySubscore: freqSubscore,
    frequencyEscalationApplied: escalationApplied,
  });
}

function scoreWoodShake(hailEvents: ScoreEventInput[], options: MaterialScoreOptions): ScoreResult {
  const multiplier = woodShakeAgeMultiplier(options.roofAgeYears);

  const scoredEvents: ScoredEvent[] = hailEvents.map((event) => {
    const basePoints = pointsForSize(WOOD_SHAKE_HAIL_TIERS, event.sizeIn);
    const adjustedPoints = basePoints * multiplier;
    return { id: event.id, sizeIn: event.sizeIn, validAt: event.validAt, basePoints, adjustedPoints, qualifying: adjustedPoints > 0 };
  });

  const hailSeveritySubscore = Math.min(60, scoredEvents.reduce((sum, e) => sum + e.adjustedPoints, 0));
  const qualifyingCount = scoredEvents.filter((e) => e.qualifying).length;
  const { subscore: freqSubscore, escalationApplied } = frequencySubscore(qualifyingCount, false);

  const rawScore = hailSeveritySubscore + freqSubscore;

  return finalize(rawScore, scoredEvents, {
    ageSubscore: 0,
    ageMultiplierApplied: multiplier,
    metalAgeSubscore: 0,
    materialBonus: 0,
    materialBonusLabel: null,
    effectiveOnsetShiftIn: null,
    hailSeveritySubscore,
    qualifyingEventCount: qualifyingCount,
    largestQualifyingEvent: largestQualifying(scoredEvents),
    frequencySubscore: freqSubscore,
    frequencyEscalationApplied: escalationApplied,
  });
}

export const HAIL_TIERS_BY_MATERIAL: Record<MaterialCategory, HailTier[]> = {
  asphalt_shingle: ASPHALT_SHINGLE_HAIL_TIERS,
  metal_r_panel: METAL_HAIL_TIERS,
  metal_standing_seam: METAL_HAIL_TIERS,
  tpo_pvc_membrane: TPO_PVC_HAIL_TIERS,
  wood_shake: WOOD_SHAKE_HAIL_TIERS,
};
