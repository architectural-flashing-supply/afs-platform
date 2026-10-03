import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import {
  availableQty,
  stockLevel,
  type AdjustmentKind,
  type StockLevel,
  type StockUnit,
} from '@/lib/inventory/stock-math';

/**
 * SERVER-SIDE READS FOR LIVE INVENTORY (migration 039).
 *
 * Everything here uses the CALLER'S session client, never the service role: the
 * admin-only RLS policies are the real boundary, and reading around them with a
 * key that bypasses RLS would make those policies decorative. (CLAUDE.md rule
 * #22's no-store service client is for authoritative state a session cannot
 * see — a single-use token, a job stage. An admin reading their own screen is
 * not that.)
 *
 * ================ WHY A LOAD STATE AND NOT JUST A ROW ARRAY ================
 *
 * Migration 039 is deliberately NOT APPLIED — the run that wrote it forbids
 * applying a migration — so the live answer from PostgREST today is
 * `42P01 undefined_table`. An empty array would render as "nothing is being
 * tracked yet", which is a different and wrong statement: it would send
 * somebody looking for stock rows that cannot exist, instead of telling them
 * the migration has not been run.
 *
 * So the reads return a discriminated state and the screen says which one it is
 * in. "Not provisioned" is an operator action; "error" is a fault; "empty" is a
 * fact about the data. Three different sentences, because they need three
 * different responses.
 */

/**
 * The codes that mean "this object has not been created yet".
 *
 * ================= PGRST205 IS THE ONE THAT ACTUALLY HAPPENS =================
 *
 * The obvious code to look for is PostgreSQL's `42P01 undefined_table`, and
 * this module was written expecting it. It never arrives. PostgREST keeps its
 * own SCHEMA CACHE and refuses the request before Postgres is reached, so an
 * unapplied migration comes back as:
 *
 *   code:    'PGRST205'
 *   message: "Could not find the table 'public.inventory_items' in the schema cache"
 *   hint:    "Perhaps you meant the table 'public.price_book_items'"
 *
 * Measured live against the real database on 2026-10-03, by opening the screen
 * — which reported the generic "could not be read" error instead of the panel
 * that names the migration file. 42P01 and 42883 are kept because a direct SQL
 * path (a function body, a future server-side call) does raise them, but
 * PGRST205 and PGRST202 are what PostgREST sends.
 */
const NOT_PROVISIONED_CODES = new Set([
  '42P01', // PostgreSQL undefined_table — raised by SQL, not by PostgREST
  '42883', // PostgreSQL undefined_function — likewise
  'PGRST205', // PostgREST: table not in the schema cache. THE LIVE CASE.
  'PGRST202', // PostgREST: function not in the schema cache
]);

/** The three database objects migration 039 creates, and nothing else. */
const OWNED_OBJECT_NAMES = ['inventory_items', 'inventory_adjustments', 'inventory_apply_adjustment'];

export function isNotProvisionedError(error: Pick<PostgrestError, 'code' | 'message'> | null): boolean {
  if (!error) return false;
  if (NOT_PROVISIONED_CODES.has(error.code)) return true;

  // A fallback for the case where no code is surfaced at all. Narrowed to the
  // three object names this feature owns, so an unrelated failure is never
  // mistaken for a missing migration and quietly explained away — a real RLS
  // refusal or a connection fault has to stay a reported fault.
  const message = (error.message ?? '').toLowerCase();
  const namesThisFeature = OWNED_OBJECT_NAMES.some((name) => message.includes(name));
  return (
    namesThisFeature &&
    (message.includes('does not exist') || message.includes('could not find') || message.includes('schema cache'))
  );
}

export interface InventoryItemRow {
  id: string;
  materialId: string;
  materialName: string;
  gaugeId: string;
  gaugeLabel: string;
  finish: string | null;
  coilWidthIn: number | null;
  stockUnit: StockUnit;
  /** null means never counted. Never 0 by default. */
  onHand: number | null;
  reserved: number;
  /** null means no threshold has been set. 0 is a real threshold. */
  reorderPoint: number | null;
  /** Derived, so no component does its own subtraction. */
  available: number | null;
  /** Derived, so no component does its own threshold comparison. */
  level: StockLevel;
  retiredAt: string | null;
  updatedAt: string;
}

export interface InventoryAdjustmentRow {
  id: string;
  itemId: string;
  kind: AdjustmentKind;
  source: string;
  deltaOnHand: number | null;
  countedOnHand: number | null;
  deltaReserved: number | null;
  onHandAfter: number | null;
  reservedAfter: number;
  reason: string;
  adjustedByName: string | null;
  createdAt: string;
}

/** The two states that are not data, shared by every read below. */
export type InventoryLoadFailure = { state: 'not_provisioned' } | { state: 'error'; message: string };

export type InventoryLoad<T> = { state: 'ready'; rows: T[] } | InventoryLoadFailure;

/** The history read also reports whether it returned all of it. */
export type AdjustmentLoad =
  | { state: 'ready'; rows: InventoryAdjustmentRow[]; truncated: boolean }
  | InventoryLoadFailure;

/** The newest N adjustments a single read returns. Stated, never silent. */
export const ADJUSTMENT_PAGE_SIZE = 200;

/**
 * THE ONE SENTENCE for "the database part of this feature has not been applied
 * yet". Named once so the screen, the three API routes and any future caller
 * cannot describe the same situation three different ways — and so it names the
 * exact file to apply, which is the only action that fixes it.
 */
export const NOT_PROVISIONED_MESSAGE =
  'The inventory tables have not been created in this database yet. Nothing was saved. Apply supabase/migrations/039_inventory_items_and_adjustments.sql.';

/* ------------------------------------------------------------------ shapes */

export interface InventoryItemSource {
  id: string;
  material_id: string;
  gauge_id: string;
  finish: string | null;
  coil_width_in: number | string | null;
  stock_unit: StockUnit;
  qty_on_hand: number | string | null;
  qty_reserved: number | string;
  reorder_point: number | string | null;
  retired_at: string | null;
  updated_at: string;
  materials: { name: string } | null;
  gauges: { label: string } | null;
}

/**
 * The ledger row as PostgREST sends it. Exported because
 * `inventory_apply_adjustment()` returns this same row shape from an RPC, where
 * there is no joined `profiles` — the adjustments route supplies `null` for it,
 * since the actor is the session's own admin by construction.
 */
export interface InventoryAdjustmentSource {
  id: string;
  item_id: string;
  kind: AdjustmentKind;
  source: string;
  delta_on_hand: number | string | null;
  counted_on_hand: number | string | null;
  delta_reserved: number | string | null;
  on_hand_after: number | string | null;
  reserved_after: number | string;
  reason: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

/**
 * PostgREST returns `numeric` as a JSON STRING, not a number — the type is
 * wider than a double, so serialising it as one would lose precision, and
 * supabase-js hands it through verbatim. Doing `row.qty_on_hand - x` on that
 * string gives NaN silently. Every numeric column therefore goes through here.
 *
 * `null` survives as `null`: an uncounted quantity must never become 0.
 */
function toNumberOrNull(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** For a NOT NULL numeric column, where a null could only mean a read bug. */
function toNumber(value: number | string): number {
  return toNumberOrNull(value) ?? 0;
}

export function mapItemRow(row: InventoryItemSource): InventoryItemRow {
  const onHand = toNumberOrNull(row.qty_on_hand);
  const reserved = toNumber(row.qty_reserved);
  const reorderPoint = toNumberOrNull(row.reorder_point);
  const quantities = { onHand, reserved, reorderPoint };

  return {
    id: row.id,
    materialId: row.material_id,
    // An item cannot exist without its material (NOT NULL FK), so a missing
    // join is a read problem, not a data problem — say so rather than printing
    // an empty cell that reads as "no material".
    materialName: row.materials?.name ?? 'Unknown material',
    gaugeId: row.gauge_id,
    gaugeLabel: row.gauges?.label ?? 'Unknown gauge',
    finish: row.finish,
    coilWidthIn: toNumberOrNull(row.coil_width_in),
    stockUnit: row.stock_unit,
    onHand,
    reserved,
    reorderPoint,
    available: availableQty(quantities),
    level: stockLevel(quantities),
    retiredAt: row.retired_at,
    updatedAt: row.updated_at,
  };
}

export function mapAdjustmentRow(row: InventoryAdjustmentSource): InventoryAdjustmentRow {
  return {
    id: row.id,
    itemId: row.item_id,
    kind: row.kind,
    source: row.source,
    deltaOnHand: toNumberOrNull(row.delta_on_hand),
    countedOnHand: toNumberOrNull(row.counted_on_hand),
    deltaReserved: toNumberOrNull(row.delta_reserved),
    onHandAfter: toNumberOrNull(row.on_hand_after),
    reservedAfter: toNumber(row.reserved_after),
    reason: row.reason,
    adjustedByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Turn a PostgrestError into the right load state. Nothing is swallowed: a real
 * fault is reported as a fault, with the server's own message logged for
 * diagnosis and a plain sentence returned for the screen.
 */
export function loadStateFromError(error: PostgrestError, where: string): InventoryLoadFailure {
  if (isNotProvisionedError(error)) return { state: 'not_provisioned' };
  console.error(`[Inventory read error: ${where}]`, error);
  return { state: 'error', message: 'Could not read the inventory. Nothing was changed.' };
}

/* ------------------------------------------------------------------- reads */

export const INVENTORY_ITEM_SELECT =
  'id, material_id, gauge_id, finish, coil_width_in, stock_unit, qty_on_hand, qty_reserved, reorder_point, retired_at, updated_at, materials(name), gauges(label)';

/**
 * Every active inventory item, ordered the way somebody looking for a pile of
 * metal would scan: by material, then gauge, then finish.
 *
 * Retired items are excluded. Their history stays readable through
 * `getInventoryAdjustments`, which is the point of retiring rather than
 * deleting.
 */
export async function getInventoryItems(supabase: SupabaseClient): Promise<InventoryLoad<InventoryItemRow>> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select(INVENTORY_ITEM_SELECT)
    .is('retired_at', null)
    .order('material_id', { ascending: true })
    .order('gauge_id', { ascending: true })
    .order('finish', { ascending: true, nullsFirst: true });

  if (error) return loadStateFromError(error, 'getInventoryItems');

  const rows = ((data ?? []) as unknown as InventoryItemSource[]).map(mapItemRow);
  // The database cannot order by the joined material NAME, only by its id, so
  // the readable ordering is applied here. localeCompare rather than `<`, so
  // "Galvalume" and "galvanized" sort the way a person reads them.
  rows.sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName) ||
      a.gaugeLabel.localeCompare(b.gaugeLabel) ||
      (a.finish ?? '').localeCompare(b.finish ?? '')
  );
  return { state: 'ready', rows };
}

export async function getInventoryItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<InventoryLoad<InventoryItemRow>> {
  const { data, error } = await supabase.from('inventory_items').select(INVENTORY_ITEM_SELECT).eq('id', itemId).maybeSingle();

  if (error) return loadStateFromError(error, 'getInventoryItem');
  if (!data) return { state: 'ready', rows: [] };
  return { state: 'ready', rows: [mapItemRow(data as unknown as InventoryItemSource)] };
}

/**
 * One item's adjustment history, newest first.
 *
 * Reads `ADJUSTMENT_PAGE_SIZE + 1` rows to know whether more exist, and reports
 * `truncated` rather than quietly showing the first 200 of a longer history.
 * CLAUDE.md's "no silent caps" principle: a cap nobody is told about reads as
 * "that is all of it".
 *
 * `profiles(full_name)` needs no disambiguating constraint hint: `adjusted_by`
 * is the only foreign key from this table to `profiles`. Naming the generated
 * constraint would couple the query to a name nothing in the repository
 * asserts.
 */
export async function getInventoryAdjustments(supabase: SupabaseClient, itemId: string): Promise<AdjustmentLoad> {
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .select(
      'id, item_id, kind, source, delta_on_hand, counted_on_hand, delta_reserved, on_hand_after, reserved_after, reason, created_at, profiles(full_name)'
    )
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(ADJUSTMENT_PAGE_SIZE + 1);

  if (error) return loadStateFromError(error, 'getInventoryAdjustments');

  const all = ((data ?? []) as unknown as InventoryAdjustmentSource[]).map(mapAdjustmentRow);
  const truncated = all.length > ADJUSTMENT_PAGE_SIZE;
  return { state: 'ready', rows: truncated ? all.slice(0, ADJUSTMENT_PAGE_SIZE) : all, truncated };
}

/* ------------------------------------------------- the create/edit vocabulary */

export interface MaterialOption {
  id: string;
  name: string;
  gauges: { id: string; label: string }[];
}

/**
 * The materials and gauges an item can be created against — the vocabulary that
 * already exists in this database (001_initial_schema.sql), not a second list.
 *
 * A material with no active gauge is omitted: `inventory_items.gauge_id` is NOT
 * NULL, so offering such a material would be offering a choice that cannot be
 * saved.
 */
export async function getInventoryVocabulary(supabase: SupabaseClient): Promise<InventoryLoad<MaterialOption>> {
  const { data, error } = await supabase
    .from('materials')
    .select('id, name, gauges(id, label, is_active, sort_order)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return loadStateFromError(error, 'getInventoryVocabulary');

  interface VocabSource {
    id: string;
    name: string;
    gauges: { id: string; label: string; is_active: boolean; sort_order: number }[] | null;
  }

  const rows: MaterialOption[] = ((data ?? []) as unknown as VocabSource[])
    .map((m) => ({
      id: m.id,
      name: m.name,
      gauges: (m.gauges ?? [])
        .filter((g) => g.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((g) => ({ id: g.id, label: g.label })),
    }))
    .filter((m) => m.gauges.length > 0);

  return { state: 'ready', rows };
}
