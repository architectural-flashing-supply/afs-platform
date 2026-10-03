/**
 * THE RULE LIMITS, AS A TYPED TABLE — AND EVERY ONE SAYS WHO SAID SO.
 *
 * A validator is only as honest as its thresholds. Some of these numbers are
 * real and traceable to code or to a committed document; others are placeholders
 * nobody at AFS has confirmed. Presenting the second kind as though it were the
 * first is how a validator starts refusing fabricable work, so provenance is
 * recorded as DATA, in `LIMIT_PROVENANCE`, not as a comment that a reader may or
 * may not scroll past:
 *
 *   'repo-verified' — the value comes from real code or real seeded data in this
 *                     repository, cited in its `basis`.
 *   'spec-stated'   — written down in specs/SPEC_AI_ORDER_VALIDATOR.md.
 *   'assumption'    — nobody has stated it. Steve must confirm. Chosen
 *                     deliberately PERMISSIVE so the rule flags little rather
 *                     than much: a false refusal costs AFS a job.
 *   'data-blocked'  — the rule exists and is tested, but the data that would
 *                     populate it is a documented DATA BLOCKER, so the default
 *                     is empty and the rule cannot fire until it is supplied.
 *
 * `assumedLimitKeys()` is what the admin review panel renders, so "which of
 * these thresholds is still a guess" is read out of this table rather than
 * copied into a component and left to rot.
 *
 * lib/order-validator/limits.test.ts fails if a key has no provenance entry, or
 * if a provenance entry names a key that no longer exists — so a new limit
 * cannot ship without declaring whether anybody confirmed it.
 */

import { SHEET_LENGTH_FT, SHEET_WIDTH_IN } from '@/lib/pricing/quote-math';
import type { MaterialCategory } from '@/lib/data/material-color-requirement';
import type { RangedDimension } from './types';

/**
 * A minimum on one named dimension of one profile, matched by the profile label
 * as it appears on the submission surface.
 *
 * This exists because SPEC §3's "Step Flashing: Width should be at least 4
 * inches for standard shingle coverage" cannot be expressed as a
 * `product_profiles` range: Step Flashing is one of five Quote Builder labels
 * with no `product_profiles` row at all (the others are Conductor Head,
 * Downspout, Reglet and Wall Panel / Cladding).
 */
export interface ProfileDimensionMinimum {
  /** Profile label, compared after normalisation — see `profileLabelKey`. */
  profileLabel: string;
  dimension: RangedDimension;
  minIn: number;
}

/**
 * "Very wide spans in light gauges will not hold shape" (SPEC §3), as data.
 *
 * EXPRESSED IN GAUGE NUMBERS, NOT THICKNESS, and deliberately so. The spec
 * states the limit as "Width > 24" and gauge is > 22ga galvanized", and gauge
 * numbers run BACKWARDS — a higher number is thinner metal (22 GA is 0.0296 in,
 * 26 GA is 0.0179 in, per the seeded `gauges` rows). Comparing the number the
 * customer actually chose keeps this rule pure: no `gauges` table read, no
 * thickness lookup that could fail, and the same answer on the client and the
 * server.
 *
 * A gauge label that carries no gauge number — '0.032"', '16 oz', '0.7mm' — has
 * no stated limit of this kind, and the rule correctly does not fire for it.
 * Inventing an equivalent for copper by weight or aluminium by inch would be
 * making up shop capability.
 */
export interface GaugeSpanLimit {
  /** `null` = applies to every material. */
  materialCategory: MaterialCategory | null;
  /** Flat width, in inches, at or above which the limit applies. */
  minWidthIn: number;
  /** Applies when the chosen gauge NUMBER is greater than this (i.e. thinner). */
  lighterThanGaugeNumber: number;
}

/**
 * A material + gauge pairing AFS cannot or will not fabricate.
 *
 * SPEC §4 describes an `incompatible_combinations` table "for future use",
 * "Populated when checklist #38 data received (fabrication constraints)",
 * "Currently: table is empty, no incompatibility rules enforced". No such table
 * exists anywhere in this repository, and the data it would hold has not been
 * received — so the rule lives here as typed config with an EMPTY default rather
 * than as an empty table behind a query that could only ever return no rows.
 */
export interface MaterialGaugeIncompatibility {
  materialCategory: MaterialCategory;
  gaugeNumber: number;
  /** Plain English, shown to the customer as-is. */
  reason: string;
}

export interface OrderValidatorLimits {
  /** Widest flat blank that can be cut across a sheet, in inches. */
  maxBlankWidthIn: number;
  /** Longest piece one sheet yields, in feet. */
  maxPieceLengthFt: number;
  /** Shortest formable leg/flange, in inches. */
  minFlangeLengthIn: number;
  /** Shortest formable hem fold, in inches. */
  minHemFoldLengthIn: number;
  /** Two drawn points closer than this are the same point, in inches. */
  zeroLengthEpsilonIn: number;
  /** Above this many bends, flag for a human to confirm. */
  maxBendCountWarn: number;
  /** Above this many bends, refuse. */
  maxBendCountError: number;
  profileMinimums: readonly ProfileDimensionMinimum[];
  gaugeSpanLimits: readonly GaugeSpanLimit[];
  incompatibleCombinations: readonly MaterialGaugeIncompatibility[];
}

export const DEFAULT_ORDER_VALIDATOR_LIMITS: OrderValidatorLimits = {
  maxBlankWidthIn: SHEET_WIDTH_IN,
  maxPieceLengthFt: SHEET_LENGTH_FT,
  minFlangeLengthIn: 0.5,
  minHemFoldLengthIn: 0.25,
  zeroLengthEpsilonIn: 0.001,
  maxBendCountWarn: 12,
  maxBendCountError: 24,
  profileMinimums: [{ profileLabel: 'Step Flashing', dimension: 'width', minIn: 4 }],
  gaugeSpanLimits: [{ materialCategory: 'galvanized', minWidthIn: 24, lighterThanGaugeNumber: 22 }],
  incompatibleCombinations: [],
};

export type LimitProvenance = 'repo-verified' | 'spec-stated' | 'assumption' | 'data-blocked';

export interface LimitProvenanceEntry {
  provenance: LimitProvenance;
  /** One sentence naming the authority, or saying plainly that there isn't one. */
  basis: string;
  /** How the limit reads on the admin panel. */
  label: string;
}

export const LIMIT_PROVENANCE: Record<keyof OrderValidatorLimits, LimitProvenanceEntry> = {
  maxBlankWidthIn: {
    provenance: 'repo-verified',
    label: 'Maximum flat blank width',
    basis:
      "SHEET_WIDTH_IN in lib/pricing/quote-math.ts — a sheet is 10 ft x 4 ft and a strip's width comes out of the 48 in dimension (CLAUDE.md rule #19).",
  },
  maxPieceLengthFt: {
    provenance: 'repo-verified',
    label: 'Longest piece from one sheet',
    basis: "SHEET_LENGTH_FT in lib/pricing/quote-math.ts — a strip's length is the sheet's 10 ft dimension.",
  },
  minFlangeLengthIn: {
    provenance: 'assumption',
    label: 'Shortest formable leg or flange',
    basis:
      'No shop minimum has been supplied (CLAUDE.md DATA BLOCKERS, checklist #38). 0.5 in is a deliberately permissive placeholder — Steve to confirm the real brake minimum.',
  },
  minHemFoldLengthIn: {
    provenance: 'assumption',
    label: 'Shortest formable hem fold',
    basis:
      'No shop minimum has been supplied. 0.25 in is a deliberately permissive placeholder — Steve to confirm.',
  },
  zeroLengthEpsilonIn: {
    provenance: 'assumption',
    label: 'Tolerance for two drawn points being the same point',
    basis:
      'A drag on the FlashDraft canvas snaps, so an exact float comparison would miss a duplicated point. 0.001 in is a placeholder tolerance — no drawing tolerance has been stated.',
  },
  maxBendCountWarn: {
    provenance: 'assumption',
    label: 'Bend count that needs a human to confirm',
    basis:
      'The practical bend count for the shop Thalmann DS2801 has not been supplied. 12 is a placeholder — Steve to confirm.',
  },
  maxBendCountError: {
    provenance: 'assumption',
    label: 'Bend count that cannot be formed',
    basis: 'As above. 24 is a placeholder — Steve to confirm.',
  },
  profileMinimums: {
    provenance: 'spec-stated',
    label: 'Per-profile dimension minimums',
    basis:
      'specs/SPEC_AI_ORDER_VALIDATOR.md section 3: "Step Flashing: Width should be at least 4 inches for standard shingle coverage."',
  },
  gaugeSpanLimits: {
    provenance: 'spec-stated',
    label: 'Wide span in light gauge',
    basis:
      'specs/SPEC_AI_ORDER_VALIDATOR.md section 3: "flag if Width > 24\\" and gauge is > 22ga galvanized."',
  },
  incompatibleCombinations: {
    provenance: 'data-blocked',
    label: 'Material and gauge combinations AFS will not fabricate',
    basis:
      'specs/SPEC_AI_ORDER_VALIDATOR.md section 4 — populated when checklist #38 (fabrication constraints) is received. Empty today, so this rule cannot fire.',
  },
};

/**
 * Which limits are still unconfirmed. The admin panel lists these so an
 * estimator reading a warning knows whether the threshold behind it is real
 * shop capability or a placeholder.
 */
export function assumedLimitKeys(): (keyof OrderValidatorLimits)[] {
  return (Object.keys(LIMIT_PROVENANCE) as (keyof OrderValidatorLimits)[]).filter((key) => {
    const provenance = LIMIT_PROVENANCE[key].provenance;
    return provenance === 'assumption' || provenance === 'data-blocked';
  });
}

/**
 * Defaults with an optional override applied. A caller passing `undefined` — or
 * an object with one key — gets a complete, valid limits table either way, so
 * no rule has to cope with a half-built config.
 */
export function resolveLimits(overrides?: Partial<OrderValidatorLimits>): OrderValidatorLimits {
  if (!overrides) return DEFAULT_ORDER_VALIDATOR_LIMITS;
  return { ...DEFAULT_ORDER_VALIDATOR_LIMITS, ...overrides };
}

/**
 * Profile labels are free text and the three submission surfaces spell them
 * differently ('Expansion Joint Cover' on the Quote Builder vs 'Expansion
 * Joint' in `product_profiles`). Case, spacing, punctuation and hyphens are
 * normalised away before comparing, the same approach
 * lib/data/catalog.ts's material aliasing takes.
 */
export function profileLabelKey(label: string | null | undefined): string {
  if (!label) return '';
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The gauge NUMBER a label carries, or null when it carries none.
 *
 * '26 ga' -> 26, '24GA' -> 24, '18 gauge' -> 18. '0.032"', '16 oz' and '0.7mm'
 * -> null: they are real gauge labels from the seeded `gauges` rows, but they
 * express thickness by inch, weight or millimetre rather than by gauge number,
 * and no gauge-number limit applies to them.
 *
 * The unit suffix is REQUIRED. A bare '26' could be anything, and guessing it
 * is a gauge number would let a mislabelled row trip a rule.
 */
export function gaugeNumberOf(gauge: string | null | undefined): number | null {
  if (typeof gauge !== 'string') return null;
  const match = /(\d{1,2})\s*(?:ga|gauge)\b/i.exec(gauge.trim());
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
