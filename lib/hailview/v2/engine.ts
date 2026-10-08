// HailView V2 — Module F: the engine.
//
// Orchestrates evidence -> clusters -> swath estimates -> damage -> claim
// probability, and reports the result with its uncertainty, its evidence
// grade, its per-event audit trail and its sensitivity to the two inputs
// that move it most.
//
// ─────────────────────────────────────────────────────────────────────────
// DETERMINISM CONTRACT — SPEC_HAILVIEW.md §1 and §6, unchanged by V2.
//
// Everything in this file is pure and synchronous. The number comes from
// deterministic, auditable code: no model call, no network call, no
// randomness, and no clock read (the caller passes `nowUtc`). The agentic
// layer (lib/hailview/explanation.ts) runs strictly AFTER this module has
// produced a final probability and is given it as a fact to narrate; it can
// add narrative and advisory audit flags and it can never change the
// number. See also guard.ts, which re-checks the invariants and can only
// ever ANNOTATE a result.
// ─────────────────────────────────────────────────────────────────────────

import type { MaterialCategory, MembraneMilThickness, MetalGauge, ReplacementTier, ShingleType } from '../types';
import {
  CLAIM_OCCURRENCE_LINK_DISTANCE_MI,
  clusterObservationsIntoEvents,
  type StormEventCluster,
} from './cluster';
import type { HailObservation } from './evidence';
import {
  curvesForRoof,
  damageForEvent,
  describeMaterialConstants,
  type ConstantProvenance,
  type DamageMaterial,
  type EventDamageProbabilities,
} from './damage';
import { CLAIM_WINDOW_MONTHS, assessClaim, type ClaimEventOutcome } from './claims';
import { SWATH_BANDWIDTH_MI, estimateSwathAtAddress, shiftSwathEstimate, type SwathEstimate } from './swath';

export const MODEL_VERSION = 'v2.0-uncalibrated';

/** Legacy tier cut points, unchanged from V1 so nothing downstream breaks. */
export const TIER_LOW_MAX = 34;
export const TIER_MODERATE_MAX = 64;

export function tierForScore(score: number): ReplacementTier {
  if (score <= TIER_LOW_MAX) return 'Low';
  if (score <= TIER_MODERATE_MAX) return 'Moderate';
  return 'High';
}

/** Hail-size perturbation used for the reported range and the sensitivity note, inches. */
export const SENSITIVITY_HAIL_DELTA_IN = 0.25;

export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

export interface EngineInput {
  material: MaterialCategory;
  roofAgeYears?: number;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
  /** Whether the policy excludes cosmetic damage. Defaults per material. */
  cosmeticExclusion?: boolean;
  lat: number;
  lon: number;
  observations: readonly HailObservation[];
  /** ISO 8601 "now" — the engine never reads the clock itself. */
  nowUtc: string;
  /** Plain-English notes from the evidence layer about what it could see. */
  coverageNotes?: readonly string[];
}

export interface PerEventResult {
  eventId: string;
  convectiveDayUtc: string;
  startTimeUtc: string;

  /** Swath triangulation at the address. ESTIMATES, never confirmations. */
  estimatedSizeIn: number;
  estimatedSizeLowIn: number;
  estimatedSizeHighIn: number;
  pExceedOneInch: number;
  bracketed: boolean;
  interpolation: 'interpolated' | 'extrapolated';
  nearestReportMi: number;
  maxReportedSizeIn: number;
  reportCount: number;
  measuredCount: number;
  estimatedCount: number;
  kernel: 'isotropic' | 'anisotropic';

  /** Damage, on the shared impact-energy scale. */
  pCosmetic: number;
  pFunctional: number;

  /** Claim window and this event's contribution. */
  windowStatus: 'in_window' | 'outside_window';
  windowLabel: string;
  monthsAgo: number;
  claimContribution: number;
  cosmeticSuppressed: boolean;
}

export interface SensitivityResult {
  /** Probability with every event's estimated size shifted down 0.25 in. */
  hailMinus: number;
  /** Probability with every event's estimated size shifted up 0.25 in. */
  hailPlus: number;
  /** Probability with the cosmetic-exclusion input flipped. */
  cosmeticExclusionFlipped: number;
  /** Plain-English summary of what moves this number most. */
  note: string;
}

export interface ConstantsProvenanceSummary {
  publishedCount: number;
  expertCount: number;
  /** Every expert constant in the path actually taken, by label. */
  expertConstants: { label: string; valueIn: number; note: string }[];
  /** Claim-window provenance is its own case — a policy term, not a measurement. */
  claimWindowProvenance: 'expert-verify-per-policy';
  summary: string;
}

export interface EngineResult {
  /** P(the insurer pays for a FULL ROOF REPLACEMENT). */
  probability: number;
  /** Deterministic range from the +/-0.25 in hail sensitivity. low <= probability <= high. */
  low: number;
  high: number;

  evidenceGrade: EvidenceGrade;
  evidenceGradeReason: string;

  perEvent: PerEventResult[];
  bestDateOfLoss: { eventId: string; convectiveDayUtc: string; claimContribution: number } | null;
  sensitivity: SensitivityResult;

  modelVersion: string;
  constantsProvenanceSummary: ConstantsProvenanceSummary;

  cosmeticExclusion: boolean;
  claimWindowMonths: number;

  /** Legacy response fields the existing UI and email report already read. */
  score: number;
  tier: ReplacementTier;

  /** Populated by guard.ts when a re-checked invariant does not hold. */
  guardFlags: string[];

  coverageNotes: string[];
}

/** Maps the route's flat material inputs onto damage.ts's discriminated union. */
export function toDamageMaterial(input: EngineInput): DamageMaterial {
  switch (input.material) {
    case 'asphalt_shingle':
      // Architectural is the default: it is by far the more common
      // residential product today, and it is the LESS vulnerable of the two
      // (1.25 in published onset against 1.00 in), so defaulting to it
      // cannot inflate a score for someone who did not answer.
      return { kind: 'asphalt_shingle', shingleType: input.shingleType ?? 'architectural' };
    case 'metal_r_panel':
      return { kind: 'metal_r_panel', gauge: input.metalGauge ?? '26ga' };
    case 'metal_standing_seam':
      return { kind: 'metal_standing_seam', gauge: input.metalGauge ?? '26ga' };
    case 'tpo_pvc_membrane':
      return { kind: 'tpo_pvc_membrane', mil: input.membraneMilThickness ?? 60 };
    case 'wood_shake':
      return { kind: 'wood_shake' };
  }
}

interface CoreRun {
  probability: number;
  clusters: StormEventCluster[];
  swaths: SwathEstimate[];
  damages: EventDamageProbabilities[];
  claimEvents: ClaimEventOutcome[];
  bestDateOfLoss: EngineResult['bestDateOfLoss'];
  cosmeticExclusion: boolean;
}

/**
 * One full deterministic pass. Takes already-clustered events and already
 * estimated swaths so the sensitivity runs can reuse them — re-clustering
 * for each perturbation would be wasted work and, worse, would let a
 * perturbation change the EVENT SET rather than only the sizes, which is
 * not what "what if the hail was a quarter-inch bigger" means.
 */
function runCore(
  input: EngineInput,
  clusters: StormEventCluster[],
  swaths: SwathEstimate[],
  overrides: { hailDeltaIn?: number; cosmeticExclusion?: boolean } = {}
): CoreRun {
  const material = toDamageMaterial(input);
  const curves = curvesForRoof(material, input.roofAgeYears);

  const effectiveSwaths =
    overrides.hailDeltaIn === undefined || overrides.hailDeltaIn === 0
      ? swaths
      : swaths.map((s) => shiftSwathEstimate(s, overrides.hailDeltaIn as number));

  const damages = effectiveSwaths.map((s) => damageForEvent(curves, s.quantilesIn));

  const claim = assessClaim({
    material,
    roofAgeYears: input.roofAgeYears,
    nowUtc: input.nowUtc,
    cosmeticExclusion: overrides.cosmeticExclusion ?? input.cosmeticExclusion,
    events: effectiveSwaths.map((s, i) => ({
      eventId: s.eventId,
      convectiveDayUtc: s.convectiveDayUtc,
      startTimeUtc: s.startTimeUtc,
      damage: damages[i],
    })),
  });

  return {
    probability: claim.probability,
    clusters,
    swaths: effectiveSwaths,
    damages,
    claimEvents: claim.perEvent,
    bestDateOfLoss: claim.bestDateOfLoss,
    cosmeticExclusion: claim.cosmeticExclusion,
  };
}

/**
 * Evidence grade A-D with a plain-English reason.
 *
 * GRADED ON ONE EVENT — THE ONE THE NUMBER RESTS ON — AND NEVER ON THE BEST
 * PROPERTY OF EACH EVENT POOLED TOGETHER.
 *
 * That pooling was a real defect, found on live Burnet data by the advisory
 * audit layer rather than by a test. The grade was computed from
 * `min(nearestReportMi)` across all events, `anyBracketed` across all
 * events, and the report count of a third event — so a 2026 storm that
 * drives the whole number was described using the bracketing of a 2023
 * storm that contributes nothing, and the reason text asserted "the address
 * sits between reports on opposing sides" while that event's own row said
 * `extrapolated`. Two true facts about two different storms, combined into
 * one false claim about the address.
 *
 * The driving event is the highest-contributing IN-WINDOW event, because
 * that is what the probability is made of. With no in-window event there is
 * nothing claimable to grade, so the best-evidenced event is graded instead
 * and the reason says the window is empty.
 *
 * Absence of reports gives grade D with a reason that says so, rather than
 * a confident zero.
 */
function gradeEvidence(
  swaths: SwathEstimate[],
  claimEvents: ClaimEventOutcome[]
): { grade: EvidenceGrade; reason: string } {
  if (swaths.length === 0) {
    return {
      grade: 'D',
      reason:
        'No hail reports were found near this address in the search window. Small towns generate ' +
        'fewer reports than cities, so this is weak evidence of no hail rather than proof of it.',
    };
  }

  const inWindowIndexes = claimEvents
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.windowStatus === 'in_window');
  const hasInWindowEvent = inWindowIndexes.length > 0;

  // The one event the grade describes.
  let drivingIndex: number;
  if (hasInWindowEvent) {
    drivingIndex = inWindowIndexes.reduce((best, cur) =>
      cur.e.claimContribution > best.e.claimContribution ? cur : best
    ).i;
  } else {
    drivingIndex = swaths.reduce(
      (bestIdx, s, i) => (s.effectiveSampleSize > swaths[bestIdx].effectiveSampleSize ? i : bestIdx),
      0
    );
  }

  const driving = swaths[drivingIndex];
  const nearest = driving.nearestReportMi;
  const measured = driving.measuredCount > 0;
  const bracketed = driving.bracketed;

  // Appended to every grade, so a good grade can never read as though the
  // number were claimable when no storm falls inside the window.
  const windowNote = hasInWindowEvent
    ? ''
    : ' No reported storm falls inside the typical claim window, so nothing here contributes to the result.';

  const sideNote = bracketed
    ? 'the address sits between reports on opposing sides, so the size at your address is interpolated rather than extrapolated'
    : 'every nearby report is on one side of the address, so the size at your address is extrapolated rather than interpolated';

  if (Number.isFinite(nearest) && nearest <= 1 && driving.reportCount >= 3 && bracketed && measured) {
    return {
      grade: 'A',
      reason:
        `This result rests on the ${driving.convectiveDayUtc} storm: ${driving.reportCount} reports ` +
        `within a mile of this address, including at least one measured report, and ${sideNote}.` +
        windowNote,
    };
  }

  if (Number.isFinite(nearest) && nearest <= 2 && (bracketed || driving.reportCount >= 2)) {
    return {
      grade: 'B',
      reason:
        `This result rests on the ${driving.convectiveDayUtc} storm: ${driving.reportCount} report` +
        `${driving.reportCount === 1 ? '' : 's'} within about ${nearest.toFixed(1)} miles of this ` +
        `address, and ${sideNote}.` +
        (measured ? '' : ' All of them are spotter estimates rather than measurements.') +
        windowNote,
    };
  }

  if (Number.isFinite(nearest) && nearest <= SWATH_BANDWIDTH_MI * 2) {
    return {
      grade: 'C',
      reason:
        `The nearest report for the ${driving.convectiveDayUtc} storm this result rests on is about ` +
        `${nearest.toFixed(1)} miles away, so the size at your address is extrapolated from reports ` +
        `that fell elsewhere in the storm.` + windowNote,
    };
  }

  return {
    grade: 'D',
    reason:
      `The nearest report for the ${driving.convectiveDayUtc} storm this result rests on is about ` +
      `${Number.isFinite(nearest) ? nearest.toFixed(1) : 'an unknown number of'} miles away — too far ` +
      `to say much about this address. Hail swaths are often only one to three miles wide, so a ` +
      `report at this distance may have missed the property entirely.` + windowNote,
  };
}

function summariseProvenance(input: EngineInput): ConstantsProvenanceSummary {
  const material = toDamageMaterial(input);
  const constants = describeMaterialConstants(material, input.roofAgeYears);
  const expert = constants.filter((c) => c.provenance === 'expert');
  const published = constants.filter((c) => c.provenance === 'published');

  const isMetal = material.kind === 'metal_r_panel' || material.kind === 'metal_standing_seam';
  const summary = isMetal
    ? 'Every damage threshold for metal roofing in this model is an expert estimate — no published ' +
      'metal hail-damage threshold was found. These constants need field validation before the ' +
      'number is relied on.'
    : `${published.length} of ${constants.length} damage thresholds for this material come from ` +
      'published sources; the rest are expert estimates needing field validation.';

  return {
    publishedCount: published.length,
    expertCount: expert.length,
    expertConstants: expert.map((c) => ({ label: c.label, valueIn: c.valueIn, note: c.note })),
    claimWindowProvenance: 'expert-verify-per-policy',
    summary,
  };
}

/**
 * THE ENTRY POINT. Deterministic: same inputs, identical output.
 *
 * Callers should normally use `evaluateWithGuard` in guard.ts, which runs
 * this and then re-checks its invariants. This function is exported
 * separately so the guard has something to call that cannot call it back.
 */
export function computeReplacementProbabilityV2(input: EngineInput): EngineResult {
  const address = { lat: input.lat, lon: input.lon };
  // ONE CONVECTIVE DAY IS ONE OCCURRENCE — the link distance is passed
  // explicitly rather than defaulted, because a policy pays per date of
  // loss and splitting a storm date into cells would count one claim twice.
  // Full reasoning and the measurement behind it: cluster.ts's
  // CLAIM_OCCURRENCE_LINK_DISTANCE_MI.
  const clusters = clusterObservationsIntoEvents(
    input.observations,
    CLAIM_OCCURRENCE_LINK_DISTANCE_MI
  );
  const swaths = clusters.map((c) => estimateSwathAtAddress(address, c));

  const base = runCore(input, clusters, swaths);

  // Sensitivity. The hail runs are also what produce the reported range:
  // the dominant uncertainty in this engine is the size at the address, so
  // a range derived from perturbing that size is the honest one, rather
  // than a confidence interval the model has not earned.
  const minus = runCore(input, clusters, swaths, { hailDeltaIn: -SENSITIVITY_HAIL_DELTA_IN });
  const plus = runCore(input, clusters, swaths, { hailDeltaIn: SENSITIVITY_HAIL_DELTA_IN });
  const flipped = runCore(input, clusters, swaths, {
    cosmeticExclusion: !base.cosmeticExclusion,
  });

  const perEvent: PerEventResult[] = swaths.map((s, i) => {
    const claimEvent = base.claimEvents[i];
    const damage = base.damages[i];
    return {
      eventId: s.eventId,
      convectiveDayUtc: s.convectiveDayUtc,
      startTimeUtc: s.startTimeUtc,
      estimatedSizeIn: s.quantilesIn.p50,
      estimatedSizeLowIn: s.quantilesIn.p10,
      estimatedSizeHighIn: s.quantilesIn.p90,
      pExceedOneInch: s.pExceedOneInch,
      bracketed: s.bracketed,
      interpolation: s.interpolation,
      nearestReportMi: s.nearestReportMi,
      maxReportedSizeIn: s.maxReportedSizeIn,
      reportCount: s.reportCount,
      measuredCount: s.measuredCount,
      estimatedCount: s.estimatedCount,
      kernel: s.kernel,
      pCosmetic: damage.pCosmetic,
      pFunctional: damage.pFunctional,
      windowStatus: claimEvent.windowStatus,
      windowLabel: claimEvent.windowLabel,
      monthsAgo: claimEvent.monthsAgo,
      claimContribution: claimEvent.claimContribution,
      cosmeticSuppressed: claimEvent.cosmeticSuppressed,
    };
  });

  const { grade, reason } = gradeEvidence(swaths, base.claimEvents);

  const score = Math.round(base.probability * 100);

  const cosmeticDelta = flipped.probability - base.probability;
  const sensitivityNote =
    `A quarter-inch change in the estimated hail size at this address moves the result from ` +
    `${Math.round(minus.probability * 100)} to ${Math.round(plus.probability * 100)}. ` +
    (Math.abs(cosmeticDelta) < 0.005
      ? 'The cosmetic-damage exclusion setting makes no material difference here.'
      : base.cosmeticExclusion
        ? `If the policy did NOT exclude cosmetic damage, the result would be ` +
          `${Math.round(flipped.probability * 100)}.`
        : `If the policy DID exclude cosmetic damage, the result would be ` +
          `${Math.round(flipped.probability * 100)}.`);

  return {
    probability: base.probability,
    // Ordered defensively rather than assumed: the pipeline is monotone in
    // size so minus <= base <= plus, and guard.ts asserts it, but clamping
    // here means a future change cannot produce low > high in the response.
    low: Math.min(minus.probability, base.probability, plus.probability),
    high: Math.max(minus.probability, base.probability, plus.probability),
    evidenceGrade: grade,
    evidenceGradeReason: reason,
    perEvent,
    bestDateOfLoss: base.bestDateOfLoss,
    sensitivity: {
      hailMinus: minus.probability,
      hailPlus: plus.probability,
      cosmeticExclusionFlipped: flipped.probability,
      note: sensitivityNote,
    },
    modelVersion: MODEL_VERSION,
    constantsProvenanceSummary: summariseProvenance(input),
    cosmeticExclusion: base.cosmeticExclusion,
    claimWindowMonths: CLAIM_WINDOW_MONTHS,
    score,
    tier: tierForScore(score),
    guardFlags: [],
    coverageNotes: [...(input.coverageNotes ?? [])],
  };
}
