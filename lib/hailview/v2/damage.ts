// HailView V2 — Module D: ONE physical damage scale for every material.
//
// This is the fix for V2's root causes #1 and #3. V1 had five unrelated
// point tables that were never on a common scale — 2.0 in hail was worth
// about 12 points times an age multiplier on asphalt and a flat 54 points on
// metal — so cross-material comparison was meaningless, and a metal roof
// could outscore a 16-year-old shingle roof on identical hail. V1 also had
// no cosmetic-versus-functional distinction at all, so a dent in a metal
// panel counted as replacement-worthy damage.
//
// THE COMMON SCALE IS IMPACT ENERGY. A hailstone's kinetic energy at impact
// goes as d^4: mass goes as volume (d^3) and terminal velocity goes as
// sqrt(d), so E = 1/2 m v^2 scales as d^3 * d = d^4. Every material's
// damage curve below is a function of that single quantity, which is what
// makes "this hail was twice as damaging" mean the same thing on a shingle
// roof and a standing-seam roof.
//
// DAMAGE IS SPLIT IN TWO, and the split is the whole point:
//   COSMETIC   — the roof looks hit. Dents in metal, granule scouring on
//                asphalt. The published anchor is explicit that granule
//                loss alone is NOT functional damage.
//   FUNCTIONAL — the roof's ability to shed water is compromised: mat
//                fracture, puncture, splits, seam or fastener failure.
// Only functional damage is unambiguously a replacement case. What happens
// to cosmetic damage is an INSURANCE question, not a physics one, and is
// decided in claims.ts by the cosmeticExclusion input.
//
// Pure and synchronous. Full derivation: SPEC_HAILVIEW_V2.md §4.

import type { MembraneMilThickness, MetalGauge, ShingleType } from '../types';
import { QUANTILE_QUADRATURE, type SizeQuantilesIn } from './swath';

export type ConstantProvenance = 'published' | 'expert';

/** Reference diameter for the energy index, inches. Energy index is 1.0 at 1.00 in. */
export const ENERGY_REFERENCE_DIAMETER_IN = 1.0;

/**
 * Impact-energy index of a hailstone of diameter `d`, relative to a 1.00 in
 * stone. 'published' — the d^4 scaling is standard hail-impact physics
 * (mass proportional to d^3, terminal velocity proportional to sqrt(d)).
 */
export function energyIndex(diameterIn: number): number {
  return (Math.max(0, diameterIn) / ENERGY_REFERENCE_DIAMETER_IN) ** 4;
}

// ─────────────────────────────────────────────────────────────────────────
// CURVE SHAPE
//
// Each damage mode is a logistic in LOG IMPACT ENERGY, which is the same as
// a logistic in log diameter with the exponent folded in:
//
//   P(d) = 1 / (1 + exp(-k * (ln E(d) - ln E_half)))
//        = 1 / (1 + exp(-4k * ln(d / d_half)))
//
// It is smooth, strictly monotonic in diameter, bounded in (0, 1), and has
// no breakpoints — which is what V1's step tables could never be, and why
// V1's score jumped discontinuously as hail size crossed a tier edge.
//
// A curve is pinned by TWO anchor points rather than by a hand-chosen
// steepness, so every number in the table below is a statement about the
// real world ("at this size, this fraction of roofs of this type are
// damaged") rather than a tuning parameter.
// ─────────────────────────────────────────────────────────────────────────

export interface DamageAnchor {
  diameterIn: number;
  probability: number;
  provenance: ConstantProvenance;
  /** Citation for 'published', or what needs validating for 'expert'. */
  note: string;
}

export interface DamageCurve {
  onset: DamageAnchor;
  half: DamageAnchor;
}

interface FittedCurve {
  /** Logistic steepness in log-energy. */
  k: number;
  /** Diameter at which the curve passes 0.50, inches. */
  halfDiameterIn: number;
}

/**
 * Solves the logistic through two anchor points. Throws rather than
 * silently returning a flat or inverted curve if the anchors do not define
 * one — an inverted damage curve would make bigger hail safer.
 */
export function fitDamageCurve(curve: DamageCurve): FittedCurve {
  const { onset, half } = curve;
  if (!(onset.diameterIn > 0) || !(half.diameterIn > 0)) {
    throw new Error('fitDamageCurve: anchor diameters must be positive.');
  }
  if (onset.diameterIn >= half.diameterIn) {
    throw new Error('fitDamageCurve: the onset anchor must sit below the half anchor.');
  }
  for (const a of [onset, half]) {
    if (!(a.probability > 0 && a.probability < 1)) {
      throw new Error('fitDamageCurve: anchor probabilities must be strictly between 0 and 1.');
    }
  }

  const logit = (p: number) => Math.log(p / (1 - p));
  // ln E(onset) - ln E(half) = 4 * ln(d_onset / d_half)
  const deltaLogEnergy = 4 * Math.log(onset.diameterIn / half.diameterIn);
  const deltaLogit = logit(onset.probability) - logit(half.probability);
  const k = deltaLogit / deltaLogEnergy;
  if (!(k > 0) || !Number.isFinite(k)) {
    throw new Error('fitDamageCurve: anchors do not define an increasing curve.');
  }
  return { k, halfDiameterIn: half.diameterIn };
}

/** Evaluates a fitted curve at a diameter. Strictly increasing, bounded (0, 1). */
export function damageProbabilityAt(fitted: FittedCurve, diameterIn: number): number {
  if (diameterIn <= 0) return 0;
  const z = 4 * fitted.k * Math.log(diameterIn / fitted.halfDiameterIn);
  // Logistic, written to avoid overflow at large |z|.
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

// ─────────────────────────────────────────────────────────────────────────
// MATERIALS
// ─────────────────────────────────────────────────────────────────────────

export type DamageMaterial =
  | { kind: 'asphalt_shingle'; shingleType: ShingleType }
  | { kind: 'metal_r_panel'; gauge: MetalGauge }
  | { kind: 'metal_standing_seam'; gauge: MetalGauge }
  | { kind: 'tpo_pvc_membrane'; mil: MembraneMilThickness }
  | { kind: 'wood_shake' };

/**
 * THE PUBLISHED ANCHOR. IIBEC / Smith (2013): the smallest hail capable of
 * FUNCTIONALLY damaging asphalt shingles is 1.0 in for 3-tab and 1.25 in
 * for laminated (architectural). The same source is explicit that granule
 * loss on its own is not functional damage — fracture or puncture is
 * required. These two numbers are the only hard published thresholds in
 * this engine, and every other material's constants are expressed relative
 * to a world in which these are true.
 */
export const PUBLISHED_ASPHALT_FUNCTIONAL_ONSET_IN: Record<ShingleType, number> = {
  '3-tab': 1.0,
  architectural: 1.25,
};

/**
 * Probability assigned to a published "smallest hail that CAN damage"
 * threshold. 'expert'.
 *
 * A published onset is the size at which damage first becomes possible on
 * the most vulnerable examples, not the size at which half of roofs fail —
 * so it is anchored low on the curve rather than at 0.50. Anchoring it at
 * 0.50 instead would roughly double every functional probability in the
 * engine. NEEDS REID'S FIELD VALIDATION.
 */
export const ONSET_ANCHOR_PROBABILITY = 0.05;

/**
 * Ratio between a material's 50%-damage diameter and its onset diameter,
 * where no published 50% figure exists. 'expert'.
 *
 * 1.4 means roughly a 3.8x increase in impact energy (1.4^4) between "the
 * first roofs start failing" and "half of them have". NEEDS REID'S FIELD
 * VALIDATION.
 */
export const DEFAULT_HALF_TO_ONSET_RATIO = 1.4;

/**
 * Metal gauge thickness factor on damage-threshold DIAMETER. 'expert'.
 *
 * Lower gauge number = thicker steel = resists more, so the threshold
 * diameter rises. This is root cause #4: V1 collected metalGauge and panel
 * type and then used neither (the route did not even pass metalGauge to the
 * scorer). The spread is deliberately modest — a 29 ga to 22 ga span is
 * about 0.4 mm of steel — but it is not zero, and it is monotonic.
 *
 * NEEDS REID'S FIELD VALIDATION.
 */
export const METAL_GAUGE_THRESHOLD_FACTOR: Record<MetalGauge, number> = {
  '29ga': 0.92,
  '26ga': 1.0,
  '24ga': 1.06,
  '22ga': 1.12,
};

/** Membrane thickness factor on damage-threshold diameter. 'expert'. */
export const MEMBRANE_MIL_THRESHOLD_FACTOR: Record<MembraneMilThickness, number> = {
  45: 0.93,
  60: 1.0,
  80: 1.07,
};

/**
 * AGE EMBRITTLEMENT — fractional reduction in threshold diameter per year,
 * and the age at which it stops accruing. All 'expert'.
 *
 * Asphalt and wood both embrittle: the mat loses plasticiser, the wood dries
 * and checks, so the same hailstone that bounced off a new roof fractures an
 * old one. Membranes lose flexibility to UV, faster than asphalt — the
 * sources behind SPEC_HAILVIEW.md §5.3 describe a 10-year-old membrane
 * fracturing under hail a new one would survive.
 *
 * METAL IS DELIBERATELY ZERO, and that is load-bearing rather than lazy.
 * Metal's failure mode is plastic deformation from a single impact; a
 * 20-year-old 24 ga panel dents at the same hail size a new one does.
 * Fasteners and sealants do age, but that is a leak risk from wind and
 * thermal cycling, not a hail-impact threshold. Giving metal an
 * embrittlement term would also quietly re-create root cause #2 — a score
 * that climbs with age when no hail ever fell.
 *
 * NEEDS REID'S FIELD VALIDATION.
 */
export const AGE_EMBRITTLEMENT_PER_YEAR: Record<DamageMaterial['kind'], number> = {
  asphalt_shingle: 0.006,
  metal_r_panel: 0,
  metal_standing_seam: 0,
  tpo_pvc_membrane: 0.01,
  wood_shake: 0.005,
};
export const AGE_EMBRITTLEMENT_CAP_YEARS: Record<DamageMaterial['kind'], number> = {
  asphalt_shingle: 25,
  metal_r_panel: 0,
  metal_standing_seam: 0,
  tpo_pvc_membrane: 20,
  wood_shake: 30,
};

/**
 * Multiplier applied to a material's threshold diameters for a roof of the
 * given age. Always in (0, 1]: age can only ever make a roof more
 * vulnerable, never less.
 */
export function ageThresholdFactor(material: DamageMaterial, roofAgeYears: number | undefined): number {
  const perYear = AGE_EMBRITTLEMENT_PER_YEAR[material.kind];
  if (perYear === 0) return 1;
  const age = roofAgeYears !== undefined && Number.isFinite(roofAgeYears) ? Math.max(0, roofAgeYears) : 0;
  const capped = Math.min(age, AGE_EMBRITTLEMENT_CAP_YEARS[material.kind]);
  return 1 - perYear * capped;
}

/** Thickness/gauge multiplier on threshold diameters. 1 where the material has none. */
export function thicknessThresholdFactor(material: DamageMaterial): number {
  switch (material.kind) {
    case 'metal_r_panel':
    case 'metal_standing_seam':
      return METAL_GAUGE_THRESHOLD_FACTOR[material.gauge];
    case 'tpo_pvc_membrane':
      return MEMBRANE_MIL_THRESHOLD_FACTOR[material.mil];
    case 'asphalt_shingle':
    case 'wood_shake':
      return 1;
  }
}

// ── Base functional curves, before age and thickness ────────────────────

function baseFunctionalCurve(material: DamageMaterial): DamageCurve {
  switch (material.kind) {
    case 'asphalt_shingle': {
      const onsetIn = PUBLISHED_ASPHALT_FUNCTIONAL_ONSET_IN[material.shingleType];
      return {
        onset: {
          diameterIn: onsetIn,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'published',
          note:
            'IIBEC / Smith (2013): smallest hail capable of functional damage — 1.00 in for 3-tab, ' +
            '1.25 in for laminated. Granule loss alone is not functional damage.',
        },
        half: {
          diameterIn: onsetIn * DEFAULT_HALF_TO_ONSET_RATIO,
          probability: 0.5,
          provenance: 'expert',
          note: 'No published 50%-damage diameter for asphalt; derived from the onset by DEFAULT_HALF_TO_ONSET_RATIO.',
        },
      };
    }

    case 'wood_shake':
      // The only material with real graduated published damage RATES, and
      // the curve is fitted straight to them. Checked against the third
      // published point as a sanity test: the fitted curve puts ~1.25 in at
      // about 0.07, which is the "hairline fractures begin" finding.
      return {
        onset: {
          diameterIn: 1.5,
          probability: 0.5,
          provenance: 'published',
          note: 'Haag Engineering forensic testing (SPEC_HAILVIEW.md §5.4): ~50% of heavy cedar shake panels damaged at ~1.5 in.',
        },
        half: {
          diameterIn: 1.75,
          probability: 0.9,
          provenance: 'published',
          note: 'Haag Engineering forensic testing (SPEC_HAILVIEW.md §5.4): ~90% of heavy cedar shake panels damaged at ~1.75 in.',
        },
      };

    case 'tpo_pvc_membrane':
      return {
        onset: {
          diameterIn: 1.75,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'published',
          note: 'SPEC_HAILVIEW.md §5.3: 1.75 in onset, cross-referenced across five industry sources and consistent with UL 2218 Class 4.',
        },
        half: {
          diameterIn: 1.75 * DEFAULT_HALF_TO_ONSET_RATIO,
          probability: 0.5,
          provenance: 'expert',
          note: 'Curve SHAPE for membrane is expert — only the 1.75 in onset is published. Re-expression of V1 §5.3 tier logic on the energy scale.',
        },
      };

    case 'metal_r_panel':
    case 'metal_standing_seam': {
      // NO PUBLISHED METAL THRESHOLD WAS FOUND. Every metal constant here
      // is 'expert' and must be flagged for Reid's field validation — see
      // SPEC_HAILVIEW_V2.md's constants table and the superseded-section
      // note in SPEC_HAILVIEW.md §5.2.
      //
      // The physical claim: FUNCTIONAL failure of a steel roof panel —
      // fracture, puncture, or seam/fastener failure that breaches
      // water-shedding — takes substantially larger hail than the denting
      // that V1's flat 1.5 in "onset" described. Standing seam is set above
      // R-panel because its concealed clips and raised seams keep fasteners
      // and panel edges out of the impact path.
      const baseOnsetIn = material.kind === 'metal_standing_seam' ? 2.0 : 1.75;
      return {
        onset: {
          diameterIn: baseOnsetIn,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'expert',
          note: `No published metal functional-damage threshold found. ${baseOnsetIn} in at 26 ga is an expert estimate — NEEDS REID'S FIELD VALIDATION.`,
        },
        half: {
          diameterIn: baseOnsetIn * DEFAULT_HALF_TO_ONSET_RATIO,
          probability: 0.5,
          provenance: 'expert',
          note: 'Derived from the expert onset by DEFAULT_HALF_TO_ONSET_RATIO — NEEDS FIELD VALIDATION.',
        },
      };
    }
  }
}

// ── Base cosmetic curves ────────────────────────────────────────────────

function baseCosmeticCurve(material: DamageMaterial): DamageCurve {
  switch (material.kind) {
    case 'asphalt_shingle':
      // Granule scouring. Explicitly NOT functional damage per the
      // published anchor, which is exactly why it is on its own curve.
      return {
        onset: {
          diameterIn: 0.75,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'expert',
          note: 'Granule-loss onset for asphalt. Expert; the published source addresses what is NOT functional damage, not when marring begins.',
        },
        half: {
          diameterIn: 1.05,
          probability: 0.5,
          provenance: 'expert',
          note: 'Expert. NEEDS FIELD VALIDATION.',
        },
      };

    case 'metal_r_panel':
    case 'metal_standing_seam':
      // REID'S OWN CONFIRMED FIGURE LIVES HERE, and this is where V1 put it
      // in the wrong place. SPEC_HAILVIEW.md §5.2 recorded a flat 1.5 in
      // "cosmetic damage onset, confirmed directly by Reid from field
      // experience" — and V1 then scored it as if it were a replacement
      // threshold, which is root cause #3 and the direct reason a metal roof
      // outscored a 16-year-old shingle roof.
      //
      // 1.5 in is kept, as the 50% point of the COSMETIC curve: "the size at
      // which a metal roof visibly dents" reads as a half-damage figure
      // rather than a first-possible-damage figure. That interpretive choice
      // is the one thing in this module that changes the meaning of a number
      // Reid personally confirmed, so it is called out here, in
      // SPEC_HAILVIEW_V2.md's constants table, and in SPEC_HAILVIEW.md §5.2
      // — IT NEEDS HIS SIGN-OFF.
      return {
        onset: {
          diameterIn: 1.25,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'expert',
          note: 'Expert: first visible denting below Reid’s confirmed 1.5 in figure.',
        },
        half: {
          diameterIn: 1.5,
          probability: 0.5,
          provenance: 'expert',
          note: 'Reid’s own confirmed 1.5 in metal figure (SPEC_HAILVIEW.md §5.2), re-anchored as COSMETIC 50% rather than as a replacement threshold. NEEDS REID’S SIGN-OFF.',
        },
      };

    case 'tpo_pvc_membrane':
      return {
        onset: {
          diameterIn: 1.25,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'expert',
          note: 'Expert: surface marring/scuffing below the published 1.75 in functional onset.',
        },
        half: {
          diameterIn: 1.55,
          probability: 0.5,
          provenance: 'expert',
          note: 'Expert. NEEDS FIELD VALIDATION.',
        },
      };

    case 'wood_shake':
      return {
        onset: {
          diameterIn: 1.0,
          probability: ONSET_ANCHOR_PROBABILITY,
          provenance: 'expert',
          note: 'Expert: surface bruising below Haag’s ~1.25 in hairline-fracture finding.',
        },
        half: {
          diameterIn: 1.3,
          probability: 0.5,
          provenance: 'expert',
          note: 'Expert, consistent with Haag’s ~1.25 in hairline-fracture onset. NEEDS FIELD VALIDATION.',
        },
      };
  }
}

function scaleCurve(curve: DamageCurve, factor: number): DamageCurve {
  return {
    onset: { ...curve.onset, diameterIn: curve.onset.diameterIn * factor },
    half: { ...curve.half, diameterIn: curve.half.diameterIn * factor },
  };
}

export interface MaterialDamageCurves {
  cosmetic: DamageCurve;
  functional: DamageCurve;
  /** Combined age and thickness multiplier applied to the base thresholds. */
  thresholdFactor: number;
  ageFactor: number;
  thicknessFactor: number;
}

/**
 * The effective curves for one roof: base material curves scaled by age
 * embrittlement and panel/membrane thickness.
 *
 * COSMETIC IS SCALED BY THE SAME FACTOR AS FUNCTIONAL, so a thicker gauge
 * resists denting as well as fracture and the two curves can never cross.
 */
export function curvesForRoof(
  material: DamageMaterial,
  roofAgeYears: number | undefined
): MaterialDamageCurves {
  const ageFactor = ageThresholdFactor(material, roofAgeYears);
  const thicknessFactor = thicknessThresholdFactor(material);
  const thresholdFactor = ageFactor * thicknessFactor;
  return {
    cosmetic: scaleCurve(baseCosmeticCurve(material), thresholdFactor),
    functional: scaleCurve(baseFunctionalCurve(material), thresholdFactor),
    thresholdFactor,
    ageFactor,
    thicknessFactor,
  };
}

export interface EventDamageProbabilities {
  /** P(at least cosmetic damage) — a superset of functional. */
  pCosmetic: number;
  /** P(functional damage: water-shedding compromised). */
  pFunctional: number;
  /** P(cosmetic damage but NOT functional) — what cosmeticExclusion decides the fate of. */
  pCosmeticOnly: number;
}

/**
 * Integrates the damage curves over ONE event's estimated size
 * distribution, by five-point quantile quadrature.
 *
 * Integrating rather than evaluating at the median is not a refinement, it
 * is the point: the curves are steeply convex around onset, so a median of
 * 0.9 in with real probability mass at 1.4 in carries a materially higher
 * damage chance than a certain 0.9 in does, and the median alone cannot see
 * that. This is how the swath layer's honest uncertainty actually reaches
 * the number.
 */
export function damageForEvent(
  curves: MaterialDamageCurves,
  quantilesIn: SizeQuantilesIn
): EventDamageProbabilities {
  const cosmetic = fitDamageCurve(curves.cosmetic);
  const functional = fitDamageCurve(curves.functional);

  let pCosmetic = 0;
  let pFunctional = 0;
  for (const q of QUANTILE_QUADRATURE) {
    const d = quantilesIn[q.key];
    pCosmetic += q.weight * damageProbabilityAt(cosmetic, d);
    pFunctional += q.weight * damageProbabilityAt(functional, d);
  }

  // Functional damage is by definition also cosmetic damage, so cosmetic is
  // a superset. The curves are built so this holds, but clamping makes it
  // true rather than assumed — a negative "cosmetic only" would otherwise
  // subtract from the claim probability in claims.ts.
  pCosmetic = Math.min(1, Math.max(pCosmetic, pFunctional));
  return {
    pCosmetic,
    pFunctional,
    pCosmeticOnly: Math.max(0, pCosmetic - pFunctional),
  };
}

/**
 * Combines per-event damage probabilities as INDEPENDENT HAZARDS:
 * P = 1 - product(1 - p_i).
 *
 * Independence is an approximation and a deliberately conservative one in
 * the right direction: two storms a year apart really are close to
 * independent, and the formula cannot exceed 1 however many events pile up,
 * which V1's additive point tables could and did (they saturated at an
 * arbitrary 60-point cap instead).
 */
export function combineIndependentHazards(probabilities: readonly number[]): number {
  let survival = 1;
  for (const p of probabilities) {
    survival *= 1 - Math.min(1, Math.max(0, p));
  }
  return 1 - survival;
}

/**
 * Every constant in this module with its provenance, for the engine's
 * provenance summary and the spec's constants table. Built by reading the
 * real curve objects rather than by restating them, so the summary cannot
 * drift from what the engine actually used.
 */
export function describeMaterialConstants(
  material: DamageMaterial,
  roofAgeYears: number | undefined
): { label: string; valueIn: number; provenance: ConstantProvenance; note: string }[] {
  const curves = curvesForRoof(material, roofAgeYears);
  return [
    { label: 'Cosmetic onset', valueIn: curves.cosmetic.onset.diameterIn, provenance: curves.cosmetic.onset.provenance, note: curves.cosmetic.onset.note },
    { label: 'Cosmetic 50%', valueIn: curves.cosmetic.half.diameterIn, provenance: curves.cosmetic.half.provenance, note: curves.cosmetic.half.note },
    { label: 'Functional onset', valueIn: curves.functional.onset.diameterIn, provenance: curves.functional.onset.provenance, note: curves.functional.onset.note },
    { label: 'Functional 50%', valueIn: curves.functional.half.diameterIn, provenance: curves.functional.half.provenance, note: curves.functional.half.note },
  ];
}
