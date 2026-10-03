/**
 * `lib/freight` — the freight estimator's public surface.
 *
 * ================== TWO HELPERS LIVE SOMEWHERE ELSE, ON PURPOSE ==================
 *
 * `getFreightClass` and `estimateShipmentWeight` were already built, tested and
 * in use in `lib/admin/pricing.ts` before this directory existed. They are
 * RE-EXPORTED here rather than moved or reimplemented:
 *
 *  - Reimplementing `getFreightClass` would give the NMFC class table two
 *    homes, and the one thing worse than a magic number is two copies of it
 *    that can disagree. `components/admin/QuoteEstimatorForm.tsx` already
 *    imports the original.
 *  - Moving them would edit a module five other call sites import, for no
 *    behavioural gain.
 *
 * So `lib/freight` is the discoverable entry point for everything freight, and
 * there is still exactly one implementation of each.
 */
export {
  bandForWeight,
  describeBand,
  rateVersionInForce,
  resolveBands,
  roundToWholePounds,
  surchargesInForce,
  toEffectiveDate,
  validateBandCoverage,
} from './bands';

export { OVERSIZE_MANUAL_ENTRY_FT, estimateFreight } from './estimate';

export {
  auditDelta,
  buildFreightEstimateRecord,
  finalCentsToQuoteDollars,
  type BuildFreightRecordInput,
  type FreightRecordProblem,
  type FreightRecordResult,
} from './override';

export {
  FREIGHT_MIGRATION_NAME,
  FREIGHT_NOT_INSTALLED_REASON,
  getFreightRateHistory,
  getFreightRateTable,
  getFreightSurchargeHistory,
  isRelationMissingError,
  type FreightRateTableResult,
} from './db';

export type {
  BandCoverageProblem,
  BandCoverageProblemKind,
  FreightAuditDelta,
  FreightBasis,
  FreightBreakdown,
  FreightEstimate,
  FreightEstimateRecord,
  FreightEstimateResult,
  FreightInput,
  FreightRateBand,
  FreightRateTable,
  FreightRateVersion,
  FreightRefusal,
  FreightRefusalKind,
  FreightSurchargeField,
  FreightSurcharges,
  FreightZone,
  ResolvedFreightBand,
} from './types';

export {
  FREIGHT_BASIS_LABELS,
  FREIGHT_SURCHARGE_FIELDS,
  FREIGHT_SURCHARGE_LABELS,
} from './types';

/**
 * The two that already existed. Same functions, not copies — see the header.
 */
export {
  estimateShipmentWeight,
  getFreightClass,
  type WeightEstimateItem,
  type WeightEstimateResult,
  type WeightReferenceGauge,
} from '@/lib/admin/pricing';
