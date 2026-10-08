// HailView V2 — Module C: the triangulation engine.
//
// Estimates the hail size AT THE ADDRESS for each storm event, with an
// honest uncertainty. This is the fix for V2's root cause #5: V1 treated
// every report inside a 1-mile box as if it had fallen on the roof, and a
// report 0.9 miles away counted exactly as much as one in the driveway.
//
// THE OUTPUT IS AN ESTIMATE, NEVER A CONFIRMATION. Only a measured report
// at a point is confirmed. Every number this module produces is an
// interpolation or an extrapolation from spotter estimates, and the UI copy
// says "estimated at your address" for exactly that reason.
//
// Pure and synchronous. The full derivation is in SPEC_HAILVIEW_V2.md §3.

import { bearingDegrees, haversineMiles, largestBearingGapDeg, toLocalXY, type LatLon } from './geo';
import type { HailObservation } from './evidence';
import { fitStormMotion, type StormEventCluster, type StormMotionFit } from './cluster';

// ─────────────────────────────────────────────────────────────────────────
// KERNEL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Isotropic kernel bandwidth, miles. Hail swaths are narrow — commonly
 * 1-3 miles wide at damaging intensity, which is the same physical fact
 * SPEC_HAILVIEW.md §4.2 cites as the reason V1's radius was 1 mile
 * ("hail cores are often under a mile wide at peak intensity").
 *
 * Provenance: 'expert'. The published literature describes swath widths,
 * not a Gaussian bandwidth, so turning "1-3 miles wide" into a kernel
 * scale is a modelling choice. NEEDS REID'S FIELD VALIDATION.
 */
export const SWATH_BANDWIDTH_MI = 3;

/**
 * Anisotropic bandwidths, applied when a storm-motion bearing is available.
 * A swath is long along the storm track and narrow across it, so a report
 * 5 miles up-track is far more informative about this address than one
 * 5 miles to the side.
 *
 * The two factors are reciprocal (2.0 and 0.5) so their geometric mean is
 * exactly 1: the anisotropic kernel covers the same effective AREA as the
 * isotropic one and only redistributes it. That is what stops "we found a
 * storm direction" from also silently widening or narrowing total support.
 *
 * Provenance: 'expert'. NEEDS REID'S FIELD VALIDATION.
 */
export const SWATH_ALONG_TRACK_FACTOR = 2.0;
export const SWATH_CROSS_TRACK_FACTOR = 0.5;

/** A measured report outweighs an estimated one by this factor. 'expert'. */
export const MEASURED_WEIGHT_BONUS = 1.5;

/**
 * Radius within which reports are considered for the bracketing test,
 * miles. Beyond this a report says little about direction of coverage at
 * the address. Set at 2x the bandwidth. 'expert'.
 */
export const BRACKET_RADIUS_MI = SWATH_BANDWIDTH_MI * 2;

/**
 * Angular span at or above which the address counts as bracketed by its
 * reports. 'published' — geometry, not a tuning constant: at a span of 180
 * degrees or more, no OPEN half-plane through the address contains every
 * report, so the address is not off to one side of the evidence.
 *
 * The comparison is `>=`, and the boundary case is the reason. At exactly
 * 180 the reports are diametrically opposite and the address lies ON the
 * segment joining them — one-dimensional interpolation, which is the
 * clearest possible case of being bracketed. Two reports can never exceed
 * 180 (two directions cannot strictly enclose a point in the plane), so a
 * strict `>` would mean "reports on opposing sides" — the canonical example
 * of bracketing — never qualified, and nothing with only two reports ever
 * could. Three or more reports can and do exceed it.
 */
export const BRACKET_MIN_ANGULAR_SPAN_DEG = 180;

/**
 * Tolerance on that comparison, degrees. 'expert'. Two reports that are
 * physically opposite rarely compute to exactly 180.000: the IEM feed rounds
 * positions to 0.01 degrees (about 0.6 miles here), so a genuinely
 * straddling pair lands a fraction of a degree short. Without the tolerance
 * the bracketing flag would flicker on coordinate rounding.
 */
export const BRACKET_ANGULAR_TOLERANCE_DEG = 0.5;

// ─────────────────────────────────────────────────────────────────────────
// PRIOR AND UNCERTAINTY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Climatological prior on the hail size at an address, given only that a
 * storm produced reports somewhere in the query radius: mean and 1 sigma,
 * inches.
 *
 * THIS IS WHAT MAKES A SINGLE DISTANT REPORT HARMLESS. The estimate is a
 * precision-weighted posterior over this prior (see
 * estimateSwathAtAddress), so when the only report is 10 miles away it
 * carries almost no precision and the answer stays at the prior rather than
 * asserting that 3 inch hail fell on this roof.
 *
 * 0.60 in is below every material's damage onset in damage.ts, so the prior
 * on its own produces a small damage probability: "a storm was in the area
 * and we have no evidence about this address" rather than either "nothing
 * happened" or "the worst happened".
 *
 * PRIOR_SIGMA_IN is also the CEILING on the reported uncertainty, and that
 * is deliberate. An earlier revision of this module added distance noise
 * without bound, which made a far-away report produce a posterior VAGUER
 * than the prior — incoherent (observing something cannot leave you less
 * certain than you began) and it inflated the upper tail so much that a
 * single 3 inch report 10 miles away scored P(>=1 in) = 0.43. The conjugate
 * update below cannot do that: precision only ever adds.
 *
 * Provenance: 'expert'. A real climatological prior would come from a
 * gridded hail climatology (a Phase 2 data source). NEEDS FIELD VALIDATION.
 */
export const PRIOR_SIZE_IN = 0.6;
export const PRIOR_SIGMA_IN = 0.45;

/**
 * Reporting noise, inches (1 sigma). Spotters size hail against reference
 * objects on a coarse ladder (penny, quarter, golf ball, baseball), so an
 * "estimated" size carries real error; a measured one much less.
 *
 * Provenance: 'expert'. NEEDS REID'S FIELD VALIDATION.
 */
export const SIGMA_ESTIMATED_IN = 0.35;
export const SIGMA_MEASURED_IN = 0.15;

/**
 * Spatial extrapolation noise, inches per mile of distance to the nearest
 * report. Hail size varies sharply across a swath, so distance from the
 * nearest evidence is the dominant uncertainty term at this scale.
 * 'expert'. NEEDS REID'S FIELD VALIDATION.
 */
export const SIGMA_PER_MILE_IN = 0.09;

/**
 * Multiplier on the spatial term when the address is NOT bracketed by its
 * reports. Extrapolating outside the directional hull of the evidence is
 * strictly less reliable than interpolating inside it. 'expert'.
 */
export const EXTRAPOLATION_SIGMA_FACTOR = 1.6;

/** Floor on sigma so an interval is never reported as exact. 'expert'. */
export const SIGMA_FLOOR_IN = 0.1;

/**
 * Standard normal quantile at 10% / 90%. 'published' (the normal
 * distribution's own 0.10 and 0.90 quantiles, +/-1.2816).
 */
const Z_10 = -1.2815515655446004;
const Z_25 = -0.6744897501960817;

/** Smallest diameter a hail report is ever written for, inches. 'published' — NWS LSR practice starts at pea size, 0.25 in. */
export const MIN_PHYSICAL_SIZE_IN = 0.25;

// ─────────────────────────────────────────────────────────────────────────

export interface SizeQuantilesIn {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface SwathEstimate {
  eventId: string;
  convectiveDayUtc: string;
  startTimeUtc: string;

  /** P(hail diameter at this address >= 1.0 in). */
  pExceedOneInch: number;
  /** Estimated size distribution at the address. ESTIMATES, never confirmations. */
  quantilesIn: SizeQuantilesIn;
  /** Normal-approximation parameters behind the quantiles. */
  centralIn: number;
  sigmaIn: number;

  /** True when the address sits inside the directional hull of nearby reports. */
  bracketed: boolean
  angularSpanDeg: number;
  interpolation: 'interpolated' | 'extrapolated';

  nearestReportMi: number;
  /** Largest size reported anywhere in this event, for context. */
  maxReportedSizeIn: number;
  reportCount: number;
  measuredCount: number;
  estimatedCount: number;

  kernel: 'isotropic' | 'anisotropic';
  stormMotion: StormMotionFit | null;
  /**
   * Kress-style effective sample size of the kernel weights,
   * (sum w)^2 / sum w^2 — how many reports this estimate effectively rests
   * on, which is almost always far below reportCount.
   */
  effectiveSampleSize: number;
  /** Total kernel weight, before the prior is blended in. */
  totalWeight: number;
}

/**
 * Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf
 * approximation (max absolute error 1.5e-7) — 'published'. Used instead of
 * a dependency so the scoring path stays free of new packages.
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/** Kernel weight of one observation about the address. */
function kernelWeight(
  address: LatLon,
  observation: HailObservation,
  motion: StormMotionFit | null
): number {
  const { x, y } = toLocalXY(address, observation);

  let scaled: number;
  if (motion) {
    // Rotate into the storm's frame: `along` runs with the track, `cross`
    // perpendicular to it.
    const theta = (motion.bearingDeg * Math.PI) / 180;
    const along = x * Math.sin(theta) + y * Math.cos(theta);
    const cross = x * Math.cos(theta) - y * Math.sin(theta);
    const hAlong = SWATH_BANDWIDTH_MI * SWATH_ALONG_TRACK_FACTOR;
    const hCross = SWATH_BANDWIDTH_MI * SWATH_CROSS_TRACK_FACTOR;
    scaled = (along / hAlong) ** 2 + (cross / hCross) ** 2;
  } else {
    const d = Math.hypot(x, y);
    scaled = (d / SWATH_BANDWIDTH_MI) ** 2;
  }

  const spatial = Math.exp(-0.5 * scaled);
  const basis = observation.sizeBasis === 'measured' ? MEASURED_WEIGHT_BONUS : 1;
  return spatial * basis * observation.quality;
}

/**
 * Estimates hail at `address` for one storm event.
 *
 * The three properties the FORGE brief requires of this function, and where
 * each comes from:
 *
 *  - A single DISTANT report yields a LOW exceedance probability and a WIDE
 *    interval, never a confident size. Its kernel weight decays as
 *    exp(-d^2/2h^2) — at 10 miles with h=3 that is 0.004 — and its spatial
 *    noise grows with the same distance, so it adds almost no precision and
 *    the posterior stays at the prior: central ~0.60 in, sigma ~0.45 in.
 *  - BRACKETED beats unbracketed on interval width, because
 *    EXTRAPOLATION_SIGMA_FACTOR inflates each observation's spatial noise
 *    when the address is outside their directional hull, which lowers the
 *    precision they contribute.
 *  - Two NEARBY reports interpolate between their sizes, because at short
 *    range their precision swamps the prior's and the posterior mean is
 *    their precision-weighted average.
 */
export function estimateSwathAtAddress(
  address: LatLon,
  cluster: StormEventCluster
): SwathEstimate {
  const motion = fitStormMotion(cluster);
  const observations = cluster.observations;

  const weighted = observations.map((o) => ({
    observation: o,
    weight: kernelWeight(address, o, motion),
    distanceMi: haversineMiles(address, o),
  }));

  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  const sumSquaredWeight = weighted.reduce((s, w) => s + w.weight ** 2, 0);
  const effectiveSampleSize = sumSquaredWeight > 0 ? totalWeight ** 2 / sumSquaredWeight : 0;

  const nearestReportMi = weighted.reduce(
    (min, w) => Math.min(min, w.distanceMi),
    Number.POSITIVE_INFINITY
  );

  // Bracketing: do the nearby reports surround the address directionally?
  // Decided BEFORE the estimate, because it scales each observation's
  // spatial noise below.
  const nearbyBearings = weighted
    .filter((w) => w.distanceMi <= BRACKET_RADIUS_MI)
    .map((w) => bearingDegrees(address, w.observation));
  const angularSpanDeg = nearbyBearings.length >= 2 ? 360 - largestBearingGapDeg(nearbyBearings) : 0;
  const bracketed =
    angularSpanDeg >= BRACKET_MIN_ANGULAR_SPAN_DEG - BRACKET_ANGULAR_TOLERANCE_DEG;
  const extrapolationFactor = bracketed ? 1 : EXTRAPOLATION_SIGMA_FACTOR;

  // ── Precision-weighted (Gaussian conjugate) update ───────────────────
  //
  // Each observation is a noisy reading OF THE SIZE AT THIS ADDRESS, with
  // its own noise: reporting noise (measured reports are tighter than
  // estimated ones) combined with spatial noise that grows with that
  // observation's own distance and is penalised when the address is outside
  // the reports' directional hull. Its kernel weight acts as an effective
  // count.
  //
  // Posterior precision is the SUM of the prior's and the observations',
  // so the posterior can never be vaguer than the prior and never drifts
  // further from it than the evidence supports. Both of the properties the
  // brief demands fall out of this rather than being tuned in: a distant
  // report contributes almost no precision (low weight, high spatial
  // noise), so the answer stays near the prior and stays wide; nearby
  // agreeing reports contribute a lot, so the answer moves and tightens.
  const priorPrecision = 1 / PRIOR_SIGMA_IN ** 2;
  let precision = priorPrecision;
  let precisionWeightedSum = priorPrecision * PRIOR_SIZE_IN;

  for (const w of weighted) {
    if (w.weight <= 0) continue;
    const sigmaReport =
      w.observation.sizeBasis === 'measured' ? SIGMA_MEASURED_IN : SIGMA_ESTIMATED_IN;
    const sigmaSpatial = SIGMA_PER_MILE_IN * w.distanceMi * extrapolationFactor;
    const sigmaObservation = Math.hypot(sigmaReport, sigmaSpatial);
    const observationPrecision = w.weight / sigmaObservation ** 2;
    precision += observationPrecision;
    precisionWeightedSum += observationPrecision * w.observation.sizeIn;
  }

  const centralIn = precisionWeightedSum / precision;
  // The floor represents irreducible spotter and spatial noise: however many
  // reports agree, an estimate at an address nobody measured is never exact.
  const sigmaIn = Math.max(SIGMA_FLOOR_IN, 1 / Math.sqrt(precision));

  const quantile = (z: number) => Math.max(MIN_PHYSICAL_SIZE_IN, centralIn + z * sigmaIn);
  const quantilesIn: SizeQuantilesIn = {
    p10: quantile(Z_10),
    p25: quantile(Z_25),
    p50: quantile(0),
    p75: quantile(-Z_25),
    p90: quantile(-Z_10),
  };

  return {
    eventId: cluster.id,
    convectiveDayUtc: cluster.convectiveDayUtc,
    startTimeUtc: cluster.startTimeUtc,
    pExceedOneInch: exceedanceProbability({ centralIn, sigmaIn }, 1.0),
    quantilesIn,
    centralIn,
    sigmaIn,
    bracketed,
    angularSpanDeg,
    interpolation: bracketed ? 'interpolated' : 'extrapolated',
    nearestReportMi: Number.isFinite(nearestReportMi) ? nearestReportMi : Number.NaN,
    maxReportedSizeIn: cluster.maxReportedSizeIn,
    reportCount: observations.length,
    measuredCount: observations.filter((o) => o.sizeBasis === 'measured').length,
    estimatedCount: observations.filter((o) => o.sizeBasis === 'estimated').length,
    kernel: motion ? 'anisotropic' : 'isotropic',
    stormMotion: motion,
    effectiveSampleSize,
    totalWeight,
  };
}

/**
 * P(size at the address >= thresholdIn) under the normal approximation
 * behind the quantiles. Monotone increasing in `centralIn` and decreasing
 * in `thresholdIn`, which is what the guard's size-monotonicity invariant
 * ultimately rests on.
 */
export function exceedanceProbability(
  estimate: { centralIn: number; sigmaIn: number },
  thresholdIn: number
): number {
  if (estimate.sigmaIn <= 0) return estimate.centralIn >= thresholdIn ? 1 : 0;
  return 1 - normalCdf((thresholdIn - estimate.centralIn) / estimate.sigmaIn);
}

/**
 * Quadrature weights for the five-point quantile grid, by the midpoint rule
 * on the probability axis: each quantile carries the probability mass of the
 * interval halfway to its neighbours. Sums to exactly 1.
 *
 * Used by damage.ts to integrate a damage curve over the size distribution
 * rather than evaluating it only at the median — which is the whole point,
 * since the curves are convex near onset and the median alone understates
 * the chance that the roof was hit by the top of the distribution.
 */
export const QUANTILE_QUADRATURE: readonly { key: keyof SizeQuantilesIn; weight: number }[] = [
  { key: 'p10', weight: 0.175 },
  { key: 'p25', weight: 0.2 },
  { key: 'p50', weight: 0.25 },
  { key: 'p75', weight: 0.2 },
  { key: 'p90', weight: 0.175 },
];

/** Shifts a swath estimate's central size by `deltaIn`, for sensitivity runs. */
export function shiftSwathEstimate(estimate: SwathEstimate, deltaIn: number): SwathEstimate {
  const centralIn = Math.max(MIN_PHYSICAL_SIZE_IN, estimate.centralIn + deltaIn);
  const sigmaIn = estimate.sigmaIn;
  const quantile = (z: number) => Math.max(MIN_PHYSICAL_SIZE_IN, centralIn + z * sigmaIn);
  return {
    ...estimate,
    centralIn,
    pExceedOneInch: exceedanceProbability({ centralIn, sigmaIn }, 1.0),
    quantilesIn: {
      p10: quantile(Z_10),
      p25: quantile(Z_25),
      p50: quantile(0),
      p75: quantile(-Z_25),
      p90: quantile(-Z_10),
    },
  };
}
