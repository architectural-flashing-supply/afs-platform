// HailView V2 — Module G: the deterministic runtime reviewer.
//
// NO LLM. This re-evaluates the engine's own invariants by running it again
// on perturbed inputs and checking that the answers move the way the model
// claims they must. It is the mechanical half of the pair whose other half
// is the advisory agent in explanation.ts: the agent can comment, the guard
// can prove.
//
// IT NEVER SILENTLY ALTERS THE NUMBER. A violation comes back as a visible
// `guardFlags` entry on the same result, plus a server log. The number the
// deterministic engine produced is the number that is returned — an engine
// that quietly corrected itself when it failed its own invariant would be
// strictly less auditable than one that reports the contradiction, and
// auditability is the whole reason SPEC_HAILVIEW.md §1 exists.
//
// Pure and synchronous, like everything downstream of evidence.ts.

import { computeReplacementProbabilityV2, type EngineInput, type EngineResult } from './engine';

/**
 * Tolerance on monotonicity comparisons. Floating-point accumulation across
 * the quadrature and the hazard product can make an exactly-flat response
 * come back a few ulps the wrong way; anything larger is a real violation.
 */
const MONOTONIC_TOLERANCE = 1e-9;

/** Size perturbation used to probe size monotonicity, inches. */
const PROBE_HAIL_DELTA_IN = 0.1;
/** Age perturbation used to probe age monotonicity, years. */
const PROBE_AGE_DELTA_YEARS = 5;

/**
 * Materials whose damage thresholds embrittle with age, and for which the
 * engine therefore claims probability is non-decreasing in roof age.
 *
 * METAL IS DELIBERATELY ABSENT. damage.ts sets metal's age embrittlement to
 * zero on purpose (a 20-year-old panel dents at the same hail size a new
 * one does), so metal's probability is FLAT in age, not increasing — and
 * asserting an increase would be asserting the bug this engine exists to
 * remove.
 */
const AGE_MONOTONIC_MATERIALS = new Set(['asphalt_shingle', 'tpo_pvc_membrane', 'wood_shake']);

/**
 * Shifts every observation's reported size, for the guard's size probe.
 *
 * Perturbing the OBSERVATIONS rather than the engine's internal estimates
 * is the point: it exercises the whole pipeline — kernel weighting, the
 * prior, quadrature, the damage curves and the claim logic — rather than
 * only the last stage of it.
 */
function withShiftedObservationSizes(input: EngineInput, deltaIn: number): EngineInput {
  return {
    ...input,
    observations: input.observations.map((o) => ({
      ...o,
      sizeIn: Math.max(0.25, o.sizeIn + deltaIn),
    })),
  };
}

export interface GuardCheck {
  id: string;
  passed: boolean;
  /** Plain-English description of the violation. Empty when passed. */
  flag: string;
}

/**
 * Re-evaluates the invariants against a result the engine already produced.
 * Returns the checks; `evaluateWithGuard` below is what callers want.
 */
export function checkInvariants(input: EngineInput, result: EngineResult): GuardCheck[] {
  const checks: GuardCheck[] = [];

  const bounded = (label: string, value: number): GuardCheck => ({
    id: `bounds:${label}`,
    passed: Number.isFinite(value) && value >= 0 && value <= 1,
    flag: `${label} is ${value}, which is outside the valid 0-1 range.`,
  });

  checks.push(bounded('probability', result.probability));
  checks.push(bounded('low', result.low));
  checks.push(bounded('high', result.high));

  checks.push({
    id: 'range:ordered',
    passed:
      result.low <= result.probability + MONOTONIC_TOLERANCE &&
      result.probability <= result.high + MONOTONIC_TOLERANCE,
    flag:
      `The reported range does not contain the reported probability ` +
      `(low ${result.low}, probability ${result.probability}, high ${result.high}).`,
  });

  checks.push({
    id: 'score:matches-probability',
    passed: result.score === Math.round(result.probability * 100),
    flag: `Score ${result.score} does not match the probability ${result.probability}.`,
  });

  // Per-event sanity: a claim contribution outside [0,1], or a nonzero
  // contribution from an event the window logic excluded.
  for (const e of result.perEvent) {
    if (!(e.claimContribution >= 0 && e.claimContribution <= 1)) {
      checks.push({
        id: `event:${e.eventId}:contribution-bounds`,
        passed: false,
        flag: `Event ${e.eventId} has a claim contribution of ${e.claimContribution}, outside 0-1.`,
      });
    }
    if (e.windowStatus === 'outside_window' && e.claimContribution > MONOTONIC_TOLERANCE) {
      checks.push({
        id: `event:${e.eventId}:window-leak`,
        passed: false,
        flag:
          `Event ${e.eventId} is outside the claim window but still contributed ` +
          `${e.claimContribution} to the probability.`,
      });
    }
    if (e.pFunctional > e.pCosmetic + MONOTONIC_TOLERANCE) {
      checks.push({
        id: `event:${e.eventId}:functional-exceeds-cosmetic`,
        passed: false,
        flag:
          `Event ${e.eventId} reports functional damage (${e.pFunctional}) as more likely than ` +
          `cosmetic damage (${e.pCosmetic}); functional damage is a subset of cosmetic.`,
      });
    }
  }

  // Monotone in hail size: bigger hail can never lower the probability.
  const biggerHail = computeReplacementProbabilityV2(
    withShiftedObservationSizes(input, PROBE_HAIL_DELTA_IN)
  );
  checks.push({
    id: 'monotonic:hail-size',
    passed: biggerHail.probability >= result.probability - MONOTONIC_TOLERANCE,
    flag:
      `Increasing every reported hail size by ${PROBE_HAIL_DELTA_IN} in LOWERED the probability ` +
      `(${result.probability} -> ${biggerHail.probability}).`,
  });

  const smallerHail = computeReplacementProbabilityV2(
    withShiftedObservationSizes(input, -PROBE_HAIL_DELTA_IN)
  );
  checks.push({
    id: 'monotonic:hail-size-down',
    passed: smallerHail.probability <= result.probability + MONOTONIC_TOLERANCE,
    flag:
      `Decreasing every reported hail size by ${PROBE_HAIL_DELTA_IN} in RAISED the probability ` +
      `(${result.probability} -> ${smallerHail.probability}).`,
  });

  // Monotone in roof age, for the materials that embrittle.
  if (input.roofAgeYears !== undefined && Number.isFinite(input.roofAgeYears)) {
    const older = computeReplacementProbabilityV2({
      ...input,
      roofAgeYears: input.roofAgeYears + PROBE_AGE_DELTA_YEARS,
    });
    const expectIncrease = AGE_MONOTONIC_MATERIALS.has(input.material);
    checks.push({
      id: 'monotonic:roof-age',
      passed: expectIncrease
        ? older.probability >= result.probability - MONOTONIC_TOLERANCE
        : Math.abs(older.probability - result.probability) <= 1e-6 ||
          older.probability >= result.probability - MONOTONIC_TOLERANCE,
      flag: expectIncrease
        ? `Adding ${PROBE_AGE_DELTA_YEARS} years of roof age LOWERED the probability for ` +
          `${input.material} (${result.probability} -> ${older.probability}).`
        : `Adding ${PROBE_AGE_DELTA_YEARS} years of roof age moved the probability for ` +
          `${input.material}, which has no age embrittlement term ` +
          `(${result.probability} -> ${older.probability}).`,
    });
  }

  // Flipping the cosmetic exclusion OFF can only ever add a contribution.
  const exclusionOff = computeReplacementProbabilityV2({ ...input, cosmeticExclusion: false });
  const exclusionOn = computeReplacementProbabilityV2({ ...input, cosmeticExclusion: true });
  checks.push({
    id: 'monotonic:cosmetic-exclusion',
    passed: exclusionOff.probability >= exclusionOn.probability - MONOTONIC_TOLERANCE,
    flag:
      `Covering cosmetic damage LOWERED the probability ` +
      `(excluded ${exclusionOn.probability} -> covered ${exclusionOff.probability}).`,
  });

  return checks;
}

/**
 * Runs the engine and then re-checks its invariants. The ONE function
 * application code should call.
 *
 * On a violation the result comes back unchanged except for `guardFlags`,
 * which the UI renders, and a server log line. The number is never edited.
 */
export function evaluateWithGuard(input: EngineInput): EngineResult {
  const result = computeReplacementProbabilityV2(input);
  const checks = checkInvariants(input, result);
  const failed = checks.filter((c) => !c.passed);

  if (failed.length > 0) {
    // One line, every violation, so it is diagnosable from a log rather
    // than only reproducible — same principle as
    // logVendorShapeProblem() in lib/integrations/pathfinder-response.ts.
    console.error(
      '[HailView V2 Guard] invariant violation',
      JSON.stringify({
        modelVersion: result.modelVersion,
        material: input.material,
        roofAgeYears: input.roofAgeYears,
        observationCount: input.observations.length,
        probability: result.probability,
        violations: failed.map((c) => ({ id: c.id, flag: c.flag })),
      })
    );
  }

  return { ...result, guardFlags: failed.map((c) => c.flag) };
}
