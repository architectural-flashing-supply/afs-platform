/**
 * FREIGHT TEST FIXTURES — explicit, named, and shared by all three unit suites.
 *
 * ================== THESE NUMBERS ARE NOT AFS'S RATES ==================
 *
 * Every cents value in this file is an ARBITRARY TEST CONSTANT, chosen to make
 * an assertion readable, and it is deliberately a number no real tariff would
 * produce (12345, 23456, 34567) so it can never be mistaken for a real rate if
 * it is ever seen in a log or a screenshot. AFS's actual carrier and rate
 * structures are checklist #27-28 and have not arrived. Nothing in this file is
 * imported by any shipped module — it exists only under `*.test.ts`, and the
 * shipped rate table ships EMPTY (migration 039 contains no INSERT at all).
 *
 * Nothing here is random. Every fixture is a frozen constant so a test's
 * ARRANGE step is reproducible and a failure means the code changed rather than
 * the data did.
 */
import { resolveBands } from './bands';
import type {
  FreightInput,
  FreightRateBand,
  FreightRateTable,
  FreightRateVersion,
  FreightSurcharges,
  FreightZone,
} from './types';

/** The date every fixture resolves "as of", so no test depends on the clock. */
export const AS_OF = '2026-10-03';

// ===========================================================================
// ZONES
// ===========================================================================

export const ZONE_LOCAL: FreightZone = {
  id: 'zone-local',
  name: 'Local — Central Texas',
  note: null,
  displayOrder: 1,
  retiredAt: null,
};

export const ZONE_REGIONAL: FreightZone = {
  id: 'zone-regional',
  name: 'Regional — Texas and bordering states',
  note: null,
  displayOrder: 2,
  retiredAt: null,
};

export const ZONE_RETIRED: FreightZone = {
  id: 'zone-retired',
  name: 'Old zone that is no longer billed',
  note: null,
  displayOrder: 3,
  retiredAt: '2026-09-01T00:00:00.000Z',
};

// ===========================================================================
// BANDS — a contiguous, half-open set: [0,500) [500,1000) [1000, ∞)
// ===========================================================================

export const BAND_LIGHT: FreightRateBand = {
  id: 'band-light',
  zoneId: ZONE_LOCAL.id,
  minWeightLbs: 0,
  maxWeightLbs: 500,
  displayOrder: 1,
  retiredAt: null,
};

export const BAND_MEDIUM: FreightRateBand = {
  id: 'band-medium',
  zoneId: ZONE_LOCAL.id,
  minWeightLbs: 500,
  maxWeightLbs: 1000,
  displayOrder: 2,
  retiredAt: null,
};

/** The open-ended top band: `maxWeightLbs === null`. */
export const BAND_HEAVY: FreightRateBand = {
  id: 'band-heavy',
  zoneId: ZONE_LOCAL.id,
  minWeightLbs: 1000,
  maxWeightLbs: null,
  displayOrder: 3,
  retiredAt: null,
};

export const CONTIGUOUS_BANDS: readonly FreightRateBand[] = [
  BAND_LIGHT,
  BAND_MEDIUM,
  BAND_HEAVY,
];

/** Closed at the top: nothing covers 1,000 lb or more. */
export const CLOSED_TOP_BANDS: readonly FreightRateBand[] = [BAND_LIGHT, BAND_MEDIUM];

/** `[0,600)` crosses into `[500,1000)` — a shipment of 550 lb matches both. */
export const OVERLAPPING_BANDS: readonly FreightRateBand[] = [
  { ...BAND_LIGHT, maxWeightLbs: 600 },
  BAND_MEDIUM,
];

/** Nothing covers 500–599 lb. */
export const GAPPED_BANDS: readonly FreightRateBand[] = [
  BAND_LIGHT,
  { ...BAND_MEDIUM, minWeightLbs: 600 },
];

/** Starts at 100 lb, so a 50 lb shipment is unpriced but the table is sound. */
export const BANDS_STARTING_AT_100: readonly FreightRateBand[] = [
  { ...BAND_LIGHT, minWeightLbs: 100 },
  BAND_MEDIUM,
];

/** One band retired: weights in its old range match nothing. */
export const BANDS_WITH_RETIRED_MEDIUM: readonly FreightRateBand[] = [
  BAND_LIGHT,
  { ...BAND_MEDIUM, retiredAt: '2026-09-15T00:00:00.000Z' },
  BAND_HEAVY,
];

// ===========================================================================
// RATE VERSIONS — arbitrary test cents, never AFS's real rates
// ===========================================================================

export const RATE_LIGHT_CENTS = 12345;
export const RATE_MEDIUM_CENTS = 23456;
export const RATE_HEAVY_CENTS = 34567;

export const VERSION_LIGHT: FreightRateVersion = {
  id: 'rv-light',
  bandId: BAND_LIGHT.id,
  rateCents: RATE_LIGHT_CENTS,
  effectiveFrom: '2026-01-01',
  note: null,
  createdBy: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

export const VERSION_MEDIUM: FreightRateVersion = {
  id: 'rv-medium',
  bandId: BAND_MEDIUM.id,
  rateCents: RATE_MEDIUM_CENTS,
  effectiveFrom: '2026-01-01',
  note: null,
  createdBy: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

export const VERSION_HEAVY: FreightRateVersion = {
  id: 'rv-heavy',
  bandId: BAND_HEAVY.id,
  rateCents: RATE_HEAVY_CENTS,
  effectiveFrom: '2026-01-01',
  note: null,
  createdBy: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

export const PRICED_VERSIONS: readonly FreightRateVersion[] = [
  VERSION_LIGHT,
  VERSION_MEDIUM,
  VERSION_HEAVY,
];

/** A version that EXISTS but whose rate was never filled in. Blank, not zero. */
export const VERSION_MEDIUM_BLANK: FreightRateVersion = {
  ...VERSION_MEDIUM,
  id: 'rv-medium-blank',
  rateCents: null,
};

/** Dated in the future relative to `AS_OF`: not in force today. */
export const VERSION_MEDIUM_FUTURE: FreightRateVersion = {
  ...VERSION_MEDIUM,
  id: 'rv-medium-future',
  rateCents: 99999,
  effectiveFrom: '2026-12-01',
  createdAt: '2026-09-01T10:00:00.000Z',
};

/** Same `effectiveFrom` as VERSION_MEDIUM, entered later — the correction. */
export const VERSION_MEDIUM_SAME_DAY_CORRECTION: FreightRateVersion = {
  ...VERSION_MEDIUM,
  id: 'rv-medium-correction',
  rateCents: 24000,
  effectiveFrom: '2026-01-01',
  createdAt: '2026-01-01T16:30:00.000Z',
};

// ===========================================================================
// SURCHARGES — arbitrary test cents
// ===========================================================================

export const RESIDENTIAL_CENTS = 4321;
export const LIFTGATE_CENTS = 5432;
export const FREE_FREIGHT_THRESHOLD_CENTS = 500000;

/** All three filled in. */
export const SURCHARGES_FULL: FreightSurcharges = {
  id: 'sv-full',
  residentialCents: RESIDENTIAL_CENTS,
  liftgateCents: LIFTGATE_CENTS,
  freeFreightThresholdCents: FREE_FREIGHT_THRESHOLD_CENTS,
  effectiveFrom: '2026-01-01',
  note: null,
  createdBy: null,
  createdAt: '2026-01-01T10:00:00.000Z',
};

/** A row exists, but every adder is still blank — the common half-filled case. */
export const SURCHARGES_ALL_BLANK: FreightSurcharges = {
  ...SURCHARGES_FULL,
  id: 'sv-blank',
  residentialCents: null,
  liftgateCents: null,
  freeFreightThresholdCents: null,
};

/** Adders set, no threshold. */
export const SURCHARGES_NO_THRESHOLD: FreightSurcharges = {
  ...SURCHARGES_FULL,
  id: 'sv-no-threshold',
  freeFreightThresholdCents: null,
};

/** Threshold set, adders blank — the case that must refuse, not charge 0. */
export const SURCHARGES_THRESHOLD_ONLY: FreightSurcharges = {
  ...SURCHARGES_FULL,
  id: 'sv-threshold-only',
  residentialCents: null,
  liftgateCents: null,
};

export const SURCHARGES_FUTURE: FreightSurcharges = {
  ...SURCHARGES_FULL,
  id: 'sv-future',
  residentialCents: 9999,
  effectiveFrom: '2026-12-01',
  createdAt: '2026-09-01T10:00:00.000Z',
};

// ===========================================================================
// INPUTS
// ===========================================================================

/**
 * A 600 lb, 10 ft shipment with no toggles — lands in `[500,1000)`, class 92.5.
 * Every estimate test starts from this and changes exactly one thing, so a
 * failure says which field caused it.
 */
export const BASE_INPUT: FreightInput = {
  zoneId: ZONE_LOCAL.id,
  weightLbs: 600,
  weightMatchedItems: 3,
  weightTotalItems: 3,
  longestPieceFt: 10,
  isResidential: false,
  requiresLiftgate: false,
  merchandiseSubtotalCents: 250000,
};

/** One field changed, so the ARRANGE step of each test reads as one line. */
export function inputWith(overrides: Partial<FreightInput>): FreightInput {
  return { ...BASE_INPUT, ...overrides };
}

// ===========================================================================
// TABLE BUILDER
// ===========================================================================

/**
 * A resolved rate table, assembled the same way `lib/freight/db.ts` assembles
 * one from PostgREST rows — through the real `resolveBands`, so a test is never
 * asserting against a hand-written resolution that the production read path
 * would have produced differently.
 *
 * Defaults to the contiguous, fully-priced `ZONE_LOCAL` with full surcharges;
 * each test overrides the one thing it is about.
 */
export function makeTable(
  overrides: {
    zones?: readonly FreightZone[];
    bands?: readonly FreightRateBand[];
    versions?: readonly FreightRateVersion[];
    surcharges?: FreightSurcharges | null;
    asOf?: string;
  } = {}
): FreightRateTable {
  const zones = overrides.zones ?? [ZONE_LOCAL];
  const bands = overrides.bands ?? CONTIGUOUS_BANDS;
  const versions = overrides.versions ?? PRICED_VERSIONS;
  const asOf = overrides.asOf ?? AS_OF;

  const bandsByZone: FreightRateTable['bandsByZone'] = {};
  for (const zone of zones) {
    const forZone = bands.filter((band) => band.zoneId === zone.id);
    if (forZone.length > 0) bandsByZone[zone.id] = resolveBands(forZone, versions, asOf);
  }

  return {
    zones: [...zones],
    bandsByZone,
    surcharges: overrides.surcharges === undefined ? SURCHARGES_FULL : overrides.surcharges,
    asOf,
  };
}

/** The shipping state: migration 039 applied, nothing entered yet. */
export const EMPTY_TABLE: FreightRateTable = {
  zones: [],
  bandsByZone: {},
  surcharges: null,
  asOf: AS_OF,
};
