/**
 * THE FREIGHT RATE TABLE AND THE FREIGHT ESTIMATE, as types.
 *
 * MONEY IS ALWAYS CENTS, ALWAYS AN INTEGER, AND `null` IS NOT ZERO.
 *
 * That is the same rule `lib/pricing/types.ts` is built around, and it is here
 * for a sharper reason: freight is the one line on an AFS quote that nobody at
 * AFS has a cost basis for yet. The carrier and its rate structures are
 * checklist #27-28, the residential surcharge is #29, the free-freight
 * threshold #30, the liftgate upcharge #88, and own-truck-vs-third-party #80 —
 * every one of them still open. So a rate that has not been typed in is `null`,
 * it renders as a marked blank, and `estimateFreight` REFUSES to produce a
 * figure that needs it. It is never defaulted, never inferred from a
 * neighbouring band, and never quietly treated as free.
 *
 * WHAT IS NOT IN HERE, DELIBERATELY: a destination ZIP. SPEC_FREIGHT_ESTIMATOR
 * .md §2 lists one, but `quote_requests.jobsite_address` is a single opaque
 * free-text string, and regex-extracting a ZIP from it to drive a lane lookup
 * would be a guess wearing a lookup's clothes. The estimator PICKS a zone
 * instead — `FreightInput.zoneId` — and nothing is inferred from an address.
 */

// ===========================================================================
// THE RATE TABLE
// ===========================================================================

/** A destination zone AFS bills freight by. Admin-entered; none are seeded. */
export interface FreightZone {
  id: string;
  name: string;
  note: string | null;
  displayOrder: number;
  /** Retired zones keep their history; they just cannot start a new estimate. */
  retiredAt: string | null;
}

/**
 * A weight band inside one zone.
 *
 * THE BAND IS `[minWeightLbs, maxWeightLbs)` — INCLUSIVE FLOOR, EXCLUSIVE
 * CEILING. `maxWeightLbs === null` is the open-ended top band, covering
 * everything at or above its floor. See `lib/freight/bands.ts` for why that
 * convention is the one that makes boundaries unambiguous.
 */
export interface FreightRateBand {
  id: string;
  zoneId: string;
  minWeightLbs: number;
  /** EXCLUSIVE upper bound. `null` = no upper bound (the top band). */
  maxWeightLbs: number | null;
  displayOrder: number;
  retiredAt: string | null;
}

/**
 * What a band costs, from a date. An edit INSERTS one of these; it never
 * overwrites the previous one, which is what lets a quote already sent keep the
 * freight it was built on.
 */
export interface FreightRateVersion {
  id: string;
  bandId: string;
  /** Flat charge for a shipment in this band. `null` = blank, never 0. */
  rateCents: number | null;
  /** ISO date (YYYY-MM-DD). */
  effectiveFrom: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** A band together with the rate version in force on a given date. */
export interface ResolvedFreightBand {
  band: FreightRateBand;
  /** `null` when the band has never been priced at all. */
  version: FreightRateVersion | null;
  /** True only when a version is in force AND its rate is filled in. */
  isPriced: boolean;
}

/**
 * The adders and the threshold, as of a date.
 *
 * EACH `null` MEANS SOMETHING DIFFERENT AND SPECIFIC, and none of them means
 * zero:
 *
 *  - `residentialCents === null` — the residential surcharge (#29) is unknown,
 *    so an estimate with the residential toggle ON is REFUSED rather than
 *    charged 0.
 *  - `liftgateCents === null` — the same, for the liftgate upcharge (#88).
 *  - `freeFreightThresholdCents === null` — the threshold (#30) is unknown, so
 *    the rule is NOT APPLIED, and the estimate says so in words.
 *
 * A `FreightRateTable.surcharges` of `null` is a THIRD state: nothing has ever
 * been set at all, which is not the same fact as "set to zero".
 */
export interface FreightSurcharges {
  id: string;
  residentialCents: number | null;
  liftgateCents: number | null;
  freeFreightThresholdCents: number | null;
  /** ISO date (YYYY-MM-DD). */
  effectiveFrom: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** The whole rate table as it stood on one date. */
export interface FreightRateTable {
  zones: FreightZone[];
  /** Keyed by zone id. A zone with no bands is absent, not an empty array. */
  bandsByZone: Record<string, ResolvedFreightBand[]>;
  /** `null` when no surcharge version has ever been saved. */
  surcharges: FreightSurcharges | null;
  /** The date everything above was resolved as of (YYYY-MM-DD). */
  asOf: string;
}

// ===========================================================================
// BAND COVERAGE
// ===========================================================================

/**
 * A structural fault in one zone's bands.
 *
 * These are the faults that span ROWS, which is why they are not database
 * CHECKs: an overlap, a gap, a second open-ended band and a duplicate floor all
 * need to see the other bands. `estimateFreight` REFUSES on any of them rather
 * than returning whichever band happened to sort first — a table that silently
 * picks a band produces a wrong freight figure that looks right, which is the
 * single worst outcome available to this feature.
 */
export type BandCoverageProblemKind =
  | 'no-bands'
  | 'overlap'
  | 'gap'
  | 'max-not-above-min'
  | 'negative-min'
  | 'multiple-open-ended'
  | 'duplicate-min';

export interface BandCoverageProblem {
  kind: BandCoverageProblemKind;
  /** Every band involved. One id for a single-row fault, two for an overlap. */
  bandIds: string[];
  /** Written for a non-technical reader, naming what to go and fix. */
  message: string;
}

// ===========================================================================
// THE ESTIMATE
// ===========================================================================

/**
 * What the estimator knows about a shipment.
 *
 * `weightLbs` is the best-effort estimate from `estimateShipmentWeight`, which
 * matches each line item's free-text material/gauge against seeded
 * `gauges.weight_lbs_sqft`. `weightMatchedItems`/`weightTotalItems` carry its
 * caveat: a weight derived from 2 of 5 items is a different fact from one
 * derived from 5 of 5, and both the estimator and the audit record keep that
 * distinction rather than presenting a partial weight as a complete one.
 */
export interface FreightInput {
  /** `null` = the estimator has not picked a zone. Never inferred. */
  zoneId: string | null;
  weightLbs: number;
  weightMatchedItems: number;
  weightTotalItems: number;
  longestPieceFt: number;
  isResidential: boolean;
  requiresLiftgate: boolean;
  /**
   * The merchandise subtotal in cents, for the free-freight threshold only.
   * Freight is never a percentage of it.
   */
  merchandiseSubtotalCents: number;
}

/** Every reason an estimate could not be produced. */
export type FreightRefusalKind =
  | 'rate-table-empty'
  | 'no-zone-selected'
  | 'zone-not-found'
  | 'zone-retired'
  | 'zone-has-no-bands'
  | 'band-coverage'
  | 'no-band-for-weight'
  | 'bad-weight'
  | 'band-rate-blank'
  | 'residential-adder-blank'
  | 'liftgate-adder-blank'
  | 'oversize-manual-entry';

export interface FreightRefusal {
  kind: FreightRefusalKind;
  /** Plain English, naming the thing to go and fix. */
  message: string;
}

/** Every number that produced a freight figure, kept beside it. */
export interface FreightBreakdown {
  baseRateCents: number;
  /** 0 when the toggle is off. A blank adder with the toggle on is a refusal. */
  residentialCents: number;
  /** 0 when the toggle is off. A blank adder with the toggle on is a refusal. */
  liftgateCents: number;
  /** True when the subtotal reached a configured free-freight threshold. */
  freeFreightApplied: boolean;
  /** The integer sum. Every input is already integer cents, so nothing rounds. */
  totalCents: number;
  bandId: string;
  rateVersionId: string;
  /** `null` when no surcharge version has ever been saved. */
  surchargeVersionId: string | null;
}

export interface FreightEstimate {
  breakdown: FreightBreakdown;
  /** SPEC_FREIGHT_ESTIMATOR.md §4's NMFC-style class. Needs no rate data. */
  freightClass: string;
  /** The weight actually used for the band lookup, rounded to whole pounds. */
  weightLbsUsed: number;
  zoneName: string;
  /**
   * Things worth saying out loud that are not refusals — notably that no
   * free-freight threshold is configured, so that rule was not applied.
   */
  notes: string[];
}

/**
 * An estimate, or every reason there isn't one.
 *
 * `freightClass` is present on BOTH branches on purpose: the class comes from
 * the longest piece and the spec's own table, so it is knowable even when not
 * one rate has been filled in, and the estimator should see it either way.
 */
export type FreightEstimateResult =
  | {
      ok: true;
      estimate: FreightEstimate;
      freightClass: string;
      requiresManualEntry: false;
    }
  | {
      ok: false;
      refusals: FreightRefusal[];
      freightClass: string;
      /** True for a piece over the spec's 24 ft auto-calculation limit. */
      requiresManualEntry: boolean;
      /** R-11's faults, carried through so the UI can list them. */
      coverageProblems: BandCoverageProblem[];
    };

// ===========================================================================
// THE AUDIT RECORD
// ===========================================================================

/**
 * Where a freight figure came from.
 *
 *  - `estimate` — the rate table produced it and nobody changed it.
 *  - `override` — the table produced one and the estimator typed a different
 *    figure. BOTH are kept.
 *  - `manual`   — the table could not produce one at all (blank rate, no band,
 *    oversize piece, nothing configured) and the estimator typed one.
 *
 * An override of `0` is a REAL override — freight waived by hand — which is why
 * every amount in this module is tested against `null` and never against
 * falsiness.
 */
export type FreightBasis = 'estimate' | 'override' | 'manual';

/**
 * One row of `freight_estimates`, built in code so the shape can be unit-tested
 * against migration 039's three basis CHECK constraints without a database.
 */
export interface FreightEstimateRecord {
  zoneId: string | null;
  zoneName: string | null;
  weightLbs: number;
  weightMatchedItems: number;
  weightTotalItems: number;
  longestPieceFt: number;
  freightClass: string;
  isResidential: boolean;
  requiresLiftgate: boolean;
  merchandiseSubtotalCents: number;

  basis: FreightBasis;
  /** `null` exactly when the table could not produce a figure. */
  computedCents: number | null;
  /** `null` exactly when nobody typed one. `0` is a real override. */
  overrideCents: number | null;
  /** What goes on the quote. Always present. */
  finalCents: number;

  bandId: string | null;
  rateVersionIds: string[];
  surchargeVersionId: string | null;
  breakdown: FreightBreakdown | null;
  /** Why there was no estimate to compare against, when there wasn't. */
  refusals: FreightRefusal[];
  notes: string[];
  overrideReason: string | null;
}

/** The old → new pair a freight decision writes into `admin_audit_log`. */
export interface FreightAuditDelta {
  old: { freightCents: number | null; basis: null };
  new: { freightCents: number; basis: FreightBasis };
}

// ===========================================================================
// LABELS — the English lives here and nowhere else
// ===========================================================================

/**
 * Plain-English names for the three configurable money fields, used by the
 * editor's form, by every 400 the rate route returns, and by every refusal
 * message — so rewording one is a single edit and the three can never drift.
 */
export const FREIGHT_SURCHARGE_LABELS = {
  residentialCents: 'Residential delivery surcharge',
  liftgateCents: 'Liftgate service upcharge',
  freeFreightThresholdCents: 'Free freight threshold',
} as const;

export type FreightSurchargeField = keyof typeof FREIGHT_SURCHARGE_LABELS;

export const FREIGHT_SURCHARGE_FIELDS: readonly FreightSurchargeField[] = [
  'residentialCents',
  'liftgateCents',
  'freeFreightThresholdCents',
];

/** How a basis reads on screen and in the audit log. */
export const FREIGHT_BASIS_LABELS: Record<FreightBasis, string> = {
  estimate: 'Calculated from the rate table',
  override: 'Calculated, then changed by hand',
  manual: 'Entered by hand (no rate available)',
};
