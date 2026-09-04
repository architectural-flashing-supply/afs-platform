import type { MaterialCategory, MembraneMilThickness, ReplacementTier } from './types';

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISM CONTRACT — read before touching this file.
//
// Everything in this file is pure, synchronous, and deterministic: same
// inputs always produce the same score. No network call, no model/agent
// call, and no randomness happens anywhere in this file. The agentic
// synthesis layer (app/api/hailview/storm-history/route.ts's call into
// lib/anthropic/client.ts) runs strictly AFTER this module has already
// produced a final score/tier, and is given that score/tier as a fact to
// explain — it is never allowed to recompute or override it. This
// separation is what makes the score defensible if a customer or insurer
// ever asks how it was derived.
//
// This reconstructs the formula structure Reid described for his existing
// e4roofing tool (age-adjusted severity multiplier, cumulative + largest-
// event hail severity, escalating qualifying-event frequency, capped
// 0-100 score, Low/Moderate/High tiers) — the original source was not
// available to read directly in this session, so the exact constants
// below are a new, from-scratch implementation of that structure rather
// than a byte-for-byte port. If Reid's real constants differ, only the
// tier arrays and the few named constants below need to change — the
// shared pipeline (severityForSize → per-event multiplier → largest/
// cumulative/frequency aggregation → clamp → tier) is what must stay
// intact across all five material variants.
// ─────────────────────────────────────────────────────────────────────────

export interface HailTier {
  minSizeIn: number;
  /** 0–1, how much of this material's damage potential a hit at this size represents. */
  severity: number;
}

// Sorted ascending by minSizeIn. severityForSize() finds the highest tier
// whose minSizeIn <= the event's hail size (a step function, not
// interpolation — kept a plain step function so any two people auditing
// the same event list by hand get the same severity without needing a
// calculator).
const ASPHALT_SHINGLE_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 0.75, severity: 0.10 },
  { minSizeIn: 1.00, severity: 0.35 }, // functional-damage onset (typical insurance threshold)
  { minSizeIn: 1.25, severity: 0.60 },
  { minSizeIn: 1.50, severity: 0.80 },
  { minSizeIn: 1.75, severity: 0.95 },
  { minSizeIn: 2.00, severity: 1.00 },
];

// Confirmed by Reid: flat cosmetic-damage onset at 1.5" for BOTH metal
// sub-types (R-panel and standing seam) — gauge is a display/dropdown
// input only here, never a severity multiplier. Below 1.5" there is no
// qualifying cosmetic damage regardless of gauge.
const METAL_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 1.50, severity: 0.50 },
  { minSizeIn: 1.75, severity: 0.70 },
  { minSizeIn: 2.00, severity: 0.90 },
  { minSizeIn: 2.50, severity: 1.00 },
];

// Onset 1.75" per UL 2218 Class 4 impact-resistance rating.
const TPO_PVC_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 1.75, severity: 0.40 },
  { minSizeIn: 2.00, severity: 0.65 },
  { minSizeIn: 2.50, severity: 0.85 },
  { minSizeIn: 3.00, severity: 1.00 },
];

// Haag Engineering test data: ~1.25" hairline-fracture onset, ~1.5" is
// roughly the 50%-damage-rate threshold, ~1.75"+ is roughly the 90%
// (severe) damage-rate threshold.
const WOOD_SHAKE_HAIL_TIERS: HailTier[] = [
  { minSizeIn: 1.25, severity: 0.25 },
  { minSizeIn: 1.50, severity: 0.50 },
  { minSizeIn: 1.75, severity: 0.90 },
  { minSizeIn: 2.00, severity: 1.00 },
];

function tiersForMaterial(material: MaterialCategory): HailTier[] {
  switch (material) {
    case 'asphalt_shingle':
      return ASPHALT_SHINGLE_HAIL_TIERS;
    case 'metal_r_panel':
    case 'metal_standing_seam':
      return METAL_HAIL_TIERS;
    case 'tpo_pvc_membrane':
      return TPO_PVC_HAIL_TIERS;
    case 'wood_shake':
      return WOOD_SHAKE_HAIL_TIERS;
  }
}

function severityForSize(tiers: HailTier[], sizeIn: number): number {
  let severity = 0;
  for (const tier of tiers) {
    if (sizeIn >= tier.minSizeIn) severity = tier.severity;
  }
  return severity;
}

// Asphalt shingles lose impact resistance as the mat ages and dries out —
// the same hail size does more damage to a 20-year-old roof than a new
// one. Linear around a age-10 midpoint, clamped to a defensible range.
// Applies to asphalt_shingle only.
const SHINGLE_AGE_MULTIPLIER_MIDPOINT_YEARS = 10;
const SHINGLE_AGE_MULTIPLIER_SLOPE = 0.025;
const SHINGLE_AGE_MULTIPLIER_MIN = 0.80;
const SHINGLE_AGE_MULTIPLIER_MAX = 1.40;

function shingleAgeMultiplier(roofAgeYears: number | undefined): number {
  if (roofAgeYears === undefined || !Number.isFinite(roofAgeYears)) return 1.0;
  const raw = 1 + (roofAgeYears - SHINGLE_AGE_MULTIPLIER_MIDPOINT_YEARS) * SHINGLE_AGE_MULTIPLIER_SLOPE;
  return Math.min(SHINGLE_AGE_MULTIPLIER_MAX, Math.max(SHINGLE_AGE_MULTIPLIER_MIN, raw));
}

// Thinner membranes puncture/fatigue at a lower impact energy than
// thicker ones at the same hail size — this mirrors the age-modulates-
// severity pattern used for shingles above, but keyed by mil thickness
// instead of roof age. Applies to tpo_pvc_membrane only.
const MEMBRANE_THICKNESS_MULTIPLIER: Record<MembraneMilThickness, number> = {
  45: 1.15,
  60: 1.00,
  80: 0.85,
};

function membraneThicknessMultiplier(mil: MembraneMilThickness | undefined): number {
  return mil !== undefined ? MEMBRANE_THICKNESS_MULTIPLIER[mil] : 1.0;
}

// Score weighting — the single worst event dominates (a roof that took
// one 2" hit is a replacement conversation regardless of what else
// happened), cumulative wear from other qualifying events adds up to a
// smaller amount on top, and an escalating bonus rewards (in risk terms)
// repeated qualifying events even when none of them individually was the
// worst-case event. The three weights sum to 100 so a single maximal
// event with no history can reach 100 on its own without needing the
// clamp, while multiple lesser events can also approach it collectively.
const LARGEST_EVENT_WEIGHT = 60;
const CUMULATIVE_WEIGHT_PER_EVENT = 6;
const CUMULATIVE_CAP = 20;
const FREQUENCY_BONUS_BY_QUALIFYING_COUNT: Record<number, number> = {
  0: 0,
  1: 0,
  2: 5,
  3: 10,
  4: 15,
};
const FREQUENCY_BONUS_MAX = 20; // 5+ qualifying events

function frequencyBonus(qualifyingCount: number): number {
  if (qualifyingCount >= 5) return FREQUENCY_BONUS_MAX;
  return FREQUENCY_BONUS_BY_QUALIFYING_COUNT[qualifyingCount] ?? 0;
}

const TIER_LOW_MAX = 34; // 0–34
const TIER_MODERATE_MAX = 64; // 35–64, 65+ is High

function tierForScore(score: number): ReplacementTier {
  if (score <= TIER_LOW_MAX) return 'Low';
  if (score <= TIER_MODERATE_MAX) return 'Moderate';
  return 'High';
}

export interface ScoreEventInput {
  id: string;
  sizeIn: number;
  validAt: string;
}

export interface MaterialScoreOptions {
  roofAgeYears?: number; // asphalt_shingle only — ignored for other materials
  membraneMilThickness?: MembraneMilThickness; // tpo_pvc_membrane only
  // metal gauge is intentionally NOT accepted here — it is a display-only
  // input for metal_r_panel/metal_standing_seam, never part of the score.
}

export interface ScoredEvent {
  id: string;
  sizeIn: number;
  validAt: string;
  rawSeverity: number;
  adjustedSeverity: number;
  qualifying: boolean;
}

export interface MaterialScoreFactors {
  multiplierApplied: number;
  multiplierLabel: string | null;
  largestEvent: ScoredEvent | null;
  largestEventContribution: number;
  cumulativeContribution: number;
  cumulativeQualifyingCount: number;
  frequencyBonus: number;
  qualifyingEventCount: number;
}

export interface ScoreResult {
  score: number;
  tier: ReplacementTier;
  factors: MaterialScoreFactors;
  scoredEvents: ScoredEvent[];
}

/**
 * The one entry point into this module. Deterministic and synchronous —
 * see the DETERMINISM CONTRACT comment at the top of this file.
 */
export function computeReplacementScore(
  material: MaterialCategory,
  hailEvents: ScoreEventInput[],
  options: MaterialScoreOptions = {}
): ScoreResult {
  const tiers = tiersForMaterial(material);

  let multiplier = 1.0;
  let multiplierLabel: string | null = null;
  if (material === 'asphalt_shingle') {
    multiplier = shingleAgeMultiplier(options.roofAgeYears);
    multiplierLabel =
      options.roofAgeYears !== undefined ? `Roof age ${options.roofAgeYears}yr severity multiplier` : null;
  } else if (material === 'tpo_pvc_membrane') {
    multiplier = membraneThicknessMultiplier(options.membraneMilThickness);
    multiplierLabel =
      options.membraneMilThickness !== undefined
        ? `${options.membraneMilThickness}mil membrane severity multiplier`
        : null;
  }

  const scoredEvents: ScoredEvent[] = hailEvents
    .map((event) => {
      const rawSeverity = severityForSize(tiers, event.sizeIn);
      const adjustedSeverity = Math.min(1, Math.max(0, rawSeverity * multiplier));
      return {
        id: event.id,
        sizeIn: event.sizeIn,
        validAt: event.validAt,
        rawSeverity,
        adjustedSeverity,
        qualifying: adjustedSeverity > 0,
      };
    })
    .sort((a, b) => b.adjustedSeverity - a.adjustedSeverity);

  const qualifying = scoredEvents.filter((e) => e.qualifying);
  const largestEvent = scoredEvents[0] ?? null;
  const largestEventContribution = (largestEvent?.adjustedSeverity ?? 0) * LARGEST_EVENT_WEIGHT;

  const otherQualifying = largestEvent ? qualifying.filter((e) => e.id !== largestEvent.id) : qualifying;
  const cumulativeRaw = otherQualifying.reduce((sum, e) => sum + e.adjustedSeverity, 0) * CUMULATIVE_WEIGHT_PER_EVENT;
  const cumulativeContribution = Math.min(CUMULATIVE_CAP, cumulativeRaw);

  const bonus = frequencyBonus(qualifying.length);

  const rawScore = largestEventContribution + cumulativeContribution + bonus;
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  return {
    score,
    tier: tierForScore(score),
    factors: {
      multiplierApplied: multiplier,
      multiplierLabel,
      largestEvent: largestEvent && largestEvent.qualifying ? largestEvent : null,
      largestEventContribution: largestEvent?.qualifying ? largestEventContribution : 0,
      cumulativeContribution,
      cumulativeQualifyingCount: otherQualifying.length,
      frequencyBonus: bonus,
      qualifyingEventCount: qualifying.length,
    },
    scoredEvents,
  };
}

export const HAIL_TIERS_BY_MATERIAL: Record<MaterialCategory, HailTier[]> = {
  asphalt_shingle: ASPHALT_SHINGLE_HAIL_TIERS,
  metal_r_panel: METAL_HAIL_TIERS,
  metal_standing_seam: METAL_HAIL_TIERS,
  tpo_pvc_membrane: TPO_PVC_HAIL_TIERS,
  wood_shake: WOOD_SHAKE_HAIL_TIERS,
};
