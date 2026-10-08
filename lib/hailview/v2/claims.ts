// HailView V2 — Module E: damage -> P(the insurer pays for a FULL ROOF
// REPLACEMENT).
//
// This is the module that makes the headline number mean what it claims to
// mean. V1's "replacement probability" was a 0-100 points total with no
// insurance logic in it at all (root cause #3), and about 25 of those points
// came from an additive age term that applied with ZERO hail (root cause
// #2) — which is how a 16-year-old shingle roof scored 60 at an address
// whose damaging hail was years outside any claim window.
//
// THREE THINGS DECIDE A CLAIM, and all three were missing from V1:
//   1. Is the damage FUNCTIONAL, or only cosmetic? Cosmetic damage is paid
//      only where the policy has no cosmetic exclusion.
//   2. Is the loss INSIDE the claim window? An old storm is not a claim,
//      however severe it was.
//   3. Given functional damage, would the carrier replace or repair? That
//      rises with age, because an old roof is harder to repair-match and
//      more likely to be condemned as a whole.
//
// AGE ALONE IS NEVER AN INSURANCE EVENT. With no qualifying hail the
// probability is zero, not "25 points of age".
//
// Pure and synchronous. Full derivation: SPEC_HAILVIEW_V2.md §5.

import { combineIndependentHazards, type DamageMaterial, type EventDamageProbabilities } from './damage';

export type ClaimConstantProvenance = 'published' | 'expert' | 'expert-verify-per-policy';

/**
 * How far back a loss can be and still be claimable, months.
 *
 * Provenance: 'expert-verify-per-policy'. Most US homeowner policies
 * require prompt notice of loss and many carriers apply a one-year
 * limitation, but the actual deadline is a term of the specific policy and
 * varies by carrier and state. 12 months is a defensible default and
 * NOTHING MORE — it must be verified per policy before anyone relies on it.
 */
export const CLAIM_WINDOW_MONTHS = 12;

/**
 * P(carrier replaces the whole roof | functional hail damage), at a brand
 * new roof and at end of life. All 'expert'.
 *
 * Rises with age for reasons that are about repairability rather than
 * physics: discontinued shingle lines cannot be colour-matched, brittle old
 * material cannot be walked or lifted without further damage, and an old
 * roof with a few damaged slopes is more often condemned whole. Metal is
 * lower at both ends because individual panels really can be replaced.
 *
 * NEEDS REID'S FIELD VALIDATION — and ideally replacement with values
 * FITTED from the calibration data (scripts/hailview-calibrate.ts), which
 * is what the whole append-only outcome dataset exists to make possible.
 */
export const REPLACE_GIVEN_FUNCTIONAL_NEW: Record<DamageMaterial['kind'], number> = {
  asphalt_shingle: 0.55,
  metal_r_panel: 0.5,
  metal_standing_seam: 0.55,
  tpo_pvc_membrane: 0.55,
  wood_shake: 0.6,
};
export const REPLACE_GIVEN_FUNCTIONAL_AT_EOL: Record<DamageMaterial['kind'], number> = {
  asphalt_shingle: 0.9,
  metal_r_panel: 0.8,
  metal_standing_seam: 0.8,
  tpo_pvc_membrane: 0.85,
  wood_shake: 0.92,
};
/** Age at which the end-of-life value is reached, years. 'expert'. */
export const REPLACE_AGE_FULL_YEARS: Record<DamageMaterial['kind'], number> = {
  asphalt_shingle: 25,
  metal_r_panel: 35,
  metal_standing_seam: 40,
  tpo_pvc_membrane: 25,
  wood_shake: 30,
};

/**
 * P(carrier pays a FULL REPLACEMENT | cosmetic damage only, and the policy
 * has NO cosmetic exclusion). All 'expert'.
 *
 * Low by construction: even without an exclusion, cosmetic-only damage far
 * more often produces a repair, a partial payment, or a diminished-value
 * settlement than a full tear-off.
 */
export const REPLACE_GIVEN_COSMETIC_ONLY: Record<DamageMaterial['kind'], number> = {
  asphalt_shingle: 0.2,
  metal_r_panel: 0.25,
  metal_standing_seam: 0.25,
  tpo_pvc_membrane: 0.15,
  wood_shake: 0.2,
};

/**
 * Whether a metal roof's policy carries a cosmetic-damage exclusion
 * DEFAULTS TO TRUE, and that default is the single biggest correction in
 * this engine.
 *
 * Cosmetic-damage exclusion endorsements are near-standard on metal roofs
 * precisely because metal dents without leaking. V1 had no such concept, so
 * a dented-but-watertight metal roof scored as a replacement case. Under
 * the default, a dent contributes exactly zero.
 */
export const DEFAULT_COSMETIC_EXCLUSION: Record<DamageMaterial['kind'], boolean> = {
  asphalt_shingle: false,
  metal_r_panel: true,
  metal_standing_seam: true,
  tpo_pvc_membrane: true,
  wood_shake: false,
};

function replaceGivenFunctional(material: DamageMaterial, roofAgeYears: number | undefined): number {
  const base = REPLACE_GIVEN_FUNCTIONAL_NEW[material.kind];
  const eol = REPLACE_GIVEN_FUNCTIONAL_AT_EOL[material.kind];
  const full = REPLACE_AGE_FULL_YEARS[material.kind];
  const age = roofAgeYears !== undefined && Number.isFinite(roofAgeYears) ? Math.max(0, roofAgeYears) : 0;
  const progress = full > 0 ? Math.min(1, age / full) : 1;
  return base + (eol - base) * progress;
}

export interface ClaimEventInput {
  eventId: string;
  convectiveDayUtc: string;
  startTimeUtc: string;
  damage: EventDamageProbabilities;
}

export type ClaimWindowStatus = 'in_window' | 'outside_window';

export interface ClaimEventOutcome {
  eventId: string;
  convectiveDayUtc: string;
  startTimeUtc: string;
  windowStatus: ClaimWindowStatus;
  monthsAgo: number;
  /** Plain-English window label for the UI. */
  windowLabel: string;
  /** This event's own contribution to the claim probability. Zero outside the window. */
  claimContribution: number;
  /** The two halves of that contribution, for the audit trail. */
  fromFunctional: number;
  fromCosmetic: number;
  /** True when cosmetic damage was present but excluded by the policy input. */
  cosmeticSuppressed: boolean;
}

export interface ClaimAssessment {
  /** P(the insurer pays for a full roof replacement). */
  probability: number;
  perEvent: ClaimEventOutcome[];
  /** The in-window event contributing most, or null when there is none. */
  bestDateOfLoss: { eventId: string; convectiveDayUtc: string; claimContribution: number } | null;
  cosmeticExclusion: boolean;
  /** P(replace | functional damage) actually used, for the audit trail. */
  replaceGivenFunctional: number;
  inWindowEventCount: number;
  outsideWindowEventCount: number;
}

/**
 * Whole months between two instants, floored. Used only to label and gate
 * events, never to interpolate anything, so a floor is the honest rounding.
 */
function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}

/**
 * Converts per-event damage into P(insurer pays for a full replacement).
 *
 * EVENTS OUTSIDE THE CLAIM WINDOW ARE LISTED, NOT DROPPED. They contribute
 * exactly zero, and they come back with `windowStatus: 'outside_window'`
 * and a label the UI prints, because "your roof was hit by 3.25 inch hail,
 * but in 2023, which is outside the window your policy will pay on" is a
 * true and useful thing to tell someone — and silently discarding the event
 * would make the engine look as though it had never seen the storm at all.
 */
export function assessClaim(input: {
  material: DamageMaterial;
  roofAgeYears: number | undefined;
  events: readonly ClaimEventInput[];
  /** ISO 8601 "now" — passed in, never read from the clock. */
  nowUtc: string;
  /**
   * Whether the policy excludes cosmetic damage. Defaults per material via
   * DEFAULT_COSMETIC_EXCLUSION (true for metal and membrane).
   */
  cosmeticExclusion?: boolean;
}): ClaimAssessment {
  const cosmeticExclusion =
    input.cosmeticExclusion ?? DEFAULT_COSMETIC_EXCLUSION[input.material.kind];
  const pReplaceFunctional = replaceGivenFunctional(input.material, input.roofAgeYears);
  const pReplaceCosmeticOnly = REPLACE_GIVEN_COSMETIC_ONLY[input.material.kind];

  const perEvent: ClaimEventOutcome[] = input.events.map((event) => {
    const monthsAgo = monthsBetween(event.startTimeUtc, input.nowUtc);
    const inWindow = monthsAgo < CLAIM_WINDOW_MONTHS;

    const fromFunctional = event.damage.pFunctional * pReplaceFunctional;
    // Cosmetic contributes ONLY when the policy does not exclude it. Under
    // the exclusion this term is zero no matter how dented the roof is.
    const fromCosmetic = cosmeticExclusion
      ? 0
      : event.damage.pCosmeticOnly * pReplaceCosmeticOnly;

    // Within one event, functional and cosmetic-only are MUTUALLY EXCLUSIVE
    // outcomes (damage.ts defines pCosmeticOnly as pCosmetic - pFunctional),
    // so their claim contributions add rather than combining as hazards.
    const contribution = inWindow ? Math.min(1, fromFunctional + fromCosmetic) : 0;

    return {
      eventId: event.eventId,
      convectiveDayUtc: event.convectiveDayUtc,
      startTimeUtc: event.startTimeUtc,
      windowStatus: inWindow ? 'in_window' : 'outside_window',
      monthsAgo,
      windowLabel: inWindow
        ? `Within the typical ${CLAIM_WINDOW_MONTHS}-month claim window`
        : `Outside typical claim window (about ${monthsAgo} months ago)`,
      claimContribution: contribution,
      fromFunctional: inWindow ? fromFunctional : 0,
      fromCosmetic: inWindow ? fromCosmetic : 0,
      cosmeticSuppressed: cosmeticExclusion && event.damage.pCosmeticOnly > 0,
    };
  });

  const inWindow = perEvent.filter((e) => e.windowStatus === 'in_window');

  // ACROSS events, the chances combine as independent hazards — which is
  // also how "replacement probability rises with event count" is satisfied:
  // every additional in-window damaging storm can only raise the total, and
  // the total can never pass 1.
  const probability = combineIndependentHazards(inWindow.map((e) => e.claimContribution));

  const best = inWindow.reduce<ClaimEventOutcome | null>(
    (bestSoFar, e) =>
      e.claimContribution > 0 && (bestSoFar === null || e.claimContribution > bestSoFar.claimContribution)
        ? e
        : bestSoFar,
    null
  );

  return {
    probability,
    perEvent,
    bestDateOfLoss: best
      ? {
          eventId: best.eventId,
          convectiveDayUtc: best.convectiveDayUtc,
          claimContribution: best.claimContribution,
        }
      : null,
    cosmeticExclusion,
    replaceGivenFunctional: pReplaceFunctional,
    inWindowEventCount: inWindow.length,
    outsideWindowEventCount: perEvent.length - inWindow.length,
  };
}
