/**
 * READING THE PRICE BOOK OUT OF THE DATABASE. The only file in lib/pricing that
 * touches Supabase — everything else here is pure so it can be tested without
 * one.
 *
 * EGRESS: these selects name their columns. The price book has no images and no
 * base64 anything, and it is not to acquire any.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePriceBook, toEffectiveDate } from './price-book';
import { isRushSurchargeType, type RushPolicy } from './rush-policy';
import type { PriceBookItem, PriceBookVersion, ResolvedPriceBookRow } from './types';

interface ItemRow {
  id: string;
  material: string;
  gauge: string;
  display_order: number;
  retired_at: string | null;
}

interface VersionRow {
  id: string;
  item_id: string;
  sheet_cost_cents: number | null;
  per_bend_cents: number | null;
  per_hem_cents: number | null;
  extras_cents: number | null;
  extras_note: string | null;
  effective_from: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export function toPriceBookItem(row: ItemRow): PriceBookItem {
  return {
    id: row.id,
    material: row.material,
    gauge: row.gauge,
    displayOrder: row.display_order,
    retiredAt: row.retired_at,
  };
}

export function toPriceBookVersion(row: VersionRow): PriceBookVersion {
  return {
    id: row.id,
    itemId: row.item_id,
    sheetCostCents: row.sheet_cost_cents,
    perBendCents: row.per_bend_cents,
    perHemCents: row.per_hem_cents,
    extrasCents: row.extras_cents,
    extrasNote: row.extras_note,
    effectiveFrom: toEffectiveDate(row.effective_from),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * The price book as it stands on `asOf` (default: today).
 *
 * `asOf` is what makes "a price change does not alter an already-issued quote"
 * reproducible from the database as well as from the quote's own snapshot:
 * resolve as of the quote's issue date and the old prices come back.
 */
export async function getResolvedPriceBook(
  supabase: SupabaseClient,
  asOf: Date | string = new Date()
): Promise<ResolvedPriceBookRow[]> {
  const [{ data: itemRows }, { data: versionRows }] = await Promise.all([
    supabase
      .from('price_book_items')
      .select('id, material, gauge, display_order, retired_at')
      .order('display_order', { ascending: true }),
    supabase
      .from('price_book_versions')
      .select(
        'id, item_id, sheet_cost_cents, per_bend_cents, per_hem_cents, extras_cents, extras_note, effective_from, note, created_by, created_at'
      ),
  ]);

  const items = ((itemRows ?? []) as ItemRow[]).map(toPriceBookItem);
  const versions = ((versionRows ?? []) as VersionRow[]).map(toPriceBookVersion);
  return resolvePriceBook(items, versions, toEffectiveDate(asOf));
}

/** Every version of one item, newest effective date first — the history panel. */
export async function getPriceBookHistory(
  supabase: SupabaseClient,
  itemId: string
): Promise<PriceBookVersion[]> {
  const { data } = await supabase
    .from('price_book_versions')
    .select(
      'id, item_id, sheet_cost_cents, per_bend_cents, per_hem_cents, extras_cents, extras_note, effective_from, note, created_by, created_at'
    )
    .eq('item_id', itemId)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });
  return ((data ?? []) as VersionRow[]).map(toPriceBookVersion);
}

// ---------------------------------------------------------------------------
// THE RUSH POLICY (migration 039)
// ---------------------------------------------------------------------------

interface RushPolicyRow {
  id: string;
  name: string;
  surcharge_type: string;
  surcharge_percent_bp: number | null;
  surcharge_cents: number | null;
  minimum_lead_time_days: number | null;
  effective_from: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** Named columns, per this file's EGRESS rule. The table holds no images. */
const RUSH_POLICY_COLUMNS =
  'id, name, surcharge_type, surcharge_percent_bp, surcharge_cents, ' +
  'minimum_lead_time_days, effective_from, note, created_by, created_at';

export function toRushPolicy(row: RushPolicyRow): RushPolicy {
  return {
    id: row.id,
    name: row.name,
    // Falls back to `'none'` for a value the database should not be able to
    // hold (migration 039's CHECK allows exactly four), so an impossible row
    // reads as "no extra charge" rather than crashing a page render. It cannot
    // invent a charge that way, which is the direction that matters.
    surchargeType: isRushSurchargeType(row.surcharge_type) ? row.surcharge_type : 'none',
    surchargePercentBp: row.surcharge_percent_bp,
    surchargeCents: row.surcharge_cents,
    minimumLeadTimeDays: row.minimum_lead_time_days,
    effectiveFrom: toEffectiveDate(row.effective_from),
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Every rush policy ever entered, newest start date first — plus, when it could
 * not be read at all, the reason in plain English.
 */
export interface RushPolicyBook {
  policies: RushPolicy[];
  /**
   * `null` on a successful read, INCLUDING a read that found nothing: an empty
   * table is a fact ("nobody has decided yet"), not a failure.
   *
   * Non-null means the policy could not be read, and carries a sentence written
   * for Steve rather than an error code. It is RETURNED rather than logged and
   * forgotten, because both the admin screen and the Job screen print it — a
   * swallowed failure here would silently mean "no rush surcharge, forever".
   */
  unavailable: string | null;
}

/**
 * Reads the rush policy. NEVER THROWS.
 *
 * ================== WHY NOT THROWING IS THE REQUIREMENT ==================
 *
 * `rush_policies` is created by migration 039, which an unattended run is
 * forbidden from applying — so on a deployment that has not had it applied,
 * every read of this table fails. A throw would take out quoting entirely for
 * the sake of a surcharge that is BLOCKED on business data anyway (checklist
 * #36). So the failure is turned into a sentence, that sentence is returned to
 * the caller, and the caller shows it: on Settings → Rush policy, which also
 * disables its form, and on the Job screen beside the quote.
 *
 * The two cases are worded differently because they are different facts. A
 * missing table is somebody's deployment step; any other error is a fault.
 */
export async function getRushPolicyBook(supabase: SupabaseClient): Promise<RushPolicyBook> {
  const { data, error } = await supabase
    .from('rush_policies')
    .select(RUSH_POLICY_COLUMNS)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    // PostgREST reports a table that is not in its schema cache as PGRST205,
    // and Postgres itself reports undefined_table as 42P01. Either way the
    // table is not there.
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    // ONE line, carrying the real error, so this is reported rather than
    // swallowed — and `console.warn` rather than `console.error` because a
    // not-yet-applied migration is an expected state on this deployment today.
    console.warn('[Rush Policy] could not be read', { code: error.code, message: error.message });
    return {
      policies: [],
      unavailable: missing
        ? 'The rush policy table is not in the database yet — migration 039_rush_policy.sql has not ' +
          'been applied. No rush surcharge is being added to any quote until it is.'
        : `The rush policy could not be read, so no rush surcharge is being added to any quote. ${error.message}`,
    };
  }

  return { policies: ((data ?? []) as unknown as RushPolicyRow[]).map(toRushPolicy), unavailable: null };
}
