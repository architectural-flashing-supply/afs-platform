/**
 * READING THE FREIGHT RATE TABLE OUT OF THE DATABASE. The only file in
 * lib/freight that touches Supabase — everything else here is pure so it can be
 * tested without one.
 *
 * ================== "NOT INSTALLED" IS A FIRST-CLASS ANSWER ==================
 *
 * Migration 039 is written and DELIBERATELY NOT APPLIED, so on every environment
 * today these five tables DO NOT EXIST. That is not an error to be swallowed and
 * it is not the same thing as an empty rate table:
 *
 *   not installed — migration 039 has not been applied. A configuration fact.
 *                   The screen says so, names the migration, and points out that
 *                   manual freight entry on the quote screen is unaffected.
 *   installed and empty — the tables are there and Steve has not filled them in
 *                   yet. The screen shows the add-a-zone form.
 *
 * Collapsing the first into the second would make an unapplied migration look
 * like an unfilled form, and somebody would spend an afternoon typing rates into
 * a screen that cannot save them. So `getFreightRateTable` returns a
 * DISCRIMINATED result and the caller has to handle both.
 *
 * ANY OTHER ERROR IS PROPAGATED. "Empty" and "broken" are different facts too: a
 * permissions failure or a dropped connection reported as an empty table would
 * silently remove every rate from every estimate, and the estimator would
 * reasonably conclude the rates had been deleted.
 *
 * EGRESS: every select names its columns. Nothing in these tables is large
 * today, and naming them is what keeps it that way (CLAUDE.md rule #26's
 * reasoning, applied before there is anything to regret).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveBands, surchargesInForce, toEffectiveDate } from './bands';
import type {
  FreightRateBand,
  FreightRateTable,
  FreightRateVersion,
  FreightSurcharges,
  FreightZone,
} from './types';

const ZONE_COLUMNS = 'id, name, note, display_order, retired_at';
const BAND_COLUMNS = 'id, zone_id, min_weight_lbs, max_weight_lbs, display_order, retired_at';
const RATE_VERSION_COLUMNS = 'id, band_id, rate_cents, effective_from, note, created_by, created_at';
const SURCHARGE_COLUMNS =
  'id, residential_cents, liftgate_cents, free_freight_threshold_cents, effective_from, note, created_by, created_at';

interface ZoneRow {
  id: string;
  name: string;
  note: string | null;
  display_order: number;
  retired_at: string | null;
}

interface BandRow {
  id: string;
  zone_id: string;
  min_weight_lbs: number;
  max_weight_lbs: number | null;
  display_order: number;
  retired_at: string | null;
}

interface RateVersionRow {
  id: string;
  band_id: string;
  rate_cents: number | null;
  effective_from: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface SurchargeRow {
  id: string;
  residential_cents: number | null;
  liftgate_cents: number | null;
  free_freight_threshold_cents: number | null;
  effective_from: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export function toFreightZone(row: ZoneRow): FreightZone {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    displayOrder: row.display_order,
    retiredAt: row.retired_at,
  };
}

export function toFreightRateBand(row: BandRow): FreightRateBand {
  return {
    id: row.id,
    zoneId: row.zone_id,
    minWeightLbs: row.min_weight_lbs,
    maxWeightLbs: row.max_weight_lbs,
    displayOrder: row.display_order,
    retiredAt: row.retired_at,
  };
}

export function toFreightRateVersion(row: RateVersionRow): FreightRateVersion {
  return {
    id: row.id,
    bandId: row.band_id,
    rateCents: row.rate_cents,
    effectiveFrom: toEffectiveDate(row.effective_from),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function toFreightSurcharges(row: SurchargeRow): FreightSurcharges {
  return {
    id: row.id,
    residentialCents: row.residential_cents,
    liftgateCents: row.liftgate_cents,
    freeFreightThresholdCents: row.free_freight_threshold_cents,
    effectiveFrom: toEffectiveDate(row.effective_from),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Does this error mean the table isn't there?
 *
 * PostgreSQL raises `42P01 undefined_table`; PostgREST, which keeps its own
 * schema cache, answers `PGRST205` with "Could not find the table … in the
 * schema cache". Both are checked, plus the message as a last resort, because
 * which one surfaces depends on whether PostgREST has reloaded its cache — and
 * being wrong about this means showing a confusing error instead of the sentence
 * that explains exactly what to do.
 */
export function isRelationMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '42P01' || candidate.code === 'PGRST205') return true;
  if (typeof candidate.message !== 'string') return false;
  const message = candidate.message.toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  );
}

export const FREIGHT_MIGRATION_NAME = '039_freight_rate_table_and_estimates.sql';

/** Why the table could not be read, in words an estimator can act on. */
export const FREIGHT_NOT_INSTALLED_REASON =
  `The freight rate tables have not been created on this deployment yet — migration ` +
  `${FREIGHT_MIGRATION_NAME} has not been applied. Freight can still be entered by hand on any ` +
  `quote, exactly as it is today; only the rate table and the automatic estimate are unavailable.`;

export type FreightRateTableResult =
  | { installed: true; table: FreightRateTable }
  | { installed: false; reason: string };

/**
 * The whole rate table as it stood on `asOf` (default: today).
 *
 * `asOf` is what makes "a carrier increase does not alter an already-issued
 * quote" reproducible from the database as well as from the quote's own
 * `freight_estimates` row: resolve as of the quote's issue date and the old
 * rates come back.
 */
export async function getFreightRateTable(
  supabase: SupabaseClient,
  asOf: Date | string = new Date()
): Promise<FreightRateTableResult> {
  const effectiveDate = toEffectiveDate(asOf);

  const [zonesResult, bandsResult, versionsResult, surchargesResult] = await Promise.all([
    supabase.from('freight_zones').select(ZONE_COLUMNS).order('display_order', { ascending: true }),
    supabase.from('freight_rate_bands').select(BAND_COLUMNS).order('min_weight_lbs', { ascending: true }),
    supabase.from('freight_rate_versions').select(RATE_VERSION_COLUMNS),
    supabase.from('freight_surcharge_versions').select(SURCHARGE_COLUMNS),
  ]);

  const errors = [zonesResult.error, bandsResult.error, versionsResult.error, surchargesResult.error].filter(
    (error): error is NonNullable<typeof error> => error !== null && error !== undefined
  );

  if (errors.some(isRelationMissingError)) {
    return { installed: false, reason: FREIGHT_NOT_INSTALLED_REASON };
  }
  if (errors.length > 0) {
    // Propagated, never flattened into an empty table. A permissions failure
    // reported as "no rates" would remove every rate from every estimate and
    // look exactly like somebody having deleted them.
    throw errors[0];
  }

  const zones = ((zonesResult.data ?? []) as ZoneRow[]).map(toFreightZone);
  const bands = ((bandsResult.data ?? []) as BandRow[]).map(toFreightRateBand);
  const versions = ((versionsResult.data ?? []) as RateVersionRow[]).map(toFreightRateVersion);
  const surchargeVersions = ((surchargesResult.data ?? []) as SurchargeRow[]).map(toFreightSurcharges);

  const bandsByZone: FreightRateTable['bandsByZone'] = {};
  for (const zone of zones) {
    const forZone = bands.filter((band) => band.zoneId === zone.id);
    if (forZone.length > 0) bandsByZone[zone.id] = resolveBands(forZone, versions, effectiveDate);
  }

  return {
    installed: true,
    table: {
      zones,
      bandsByZone,
      surcharges: surchargesInForce(surchargeVersions, effectiveDate),
      asOf: effectiveDate,
    },
  };
}

/** Every rate version for one band, newest start date first — the history panel. */
export async function getFreightRateHistory(
  supabase: SupabaseClient,
  bandId: string
): Promise<FreightRateVersion[]> {
  const { data } = await supabase
    .from('freight_rate_versions')
    .select(RATE_VERSION_COLUMNS)
    .eq('band_id', bandId)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });
  return ((data ?? []) as RateVersionRow[]).map(toFreightRateVersion);
}

/** Every surcharge version, newest start date first. */
export async function getFreightSurchargeHistory(
  supabase: SupabaseClient
): Promise<FreightSurcharges[]> {
  const { data } = await supabase
    .from('freight_surcharge_versions')
    .select(SURCHARGE_COLUMNS)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });
  return ((data ?? []) as SurchargeRow[]).map(toFreightSurcharges);
}
