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
