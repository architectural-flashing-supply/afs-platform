/**
 * SHOP CALLOUTS — the one place that reads and writes `shop_callouts`.
 *
 * `deleted_at IS NULL` lives here exactly once, the same way
 * lib/data/shop-library.ts holds it for `shop_profile_library`, so a
 * soft-deleted shop note disappears from every surface at once.
 *
 * ============ EXPLICIT COLUMN LISTS, ALWAYS ============
 *
 * Every select below names its columns. `select('*')` would make it impossible
 * to state, as this module needs to, that no customer-facing code path can ever
 * receive a callout — a future column would be shipped by every existing
 * reader without anybody choosing to.
 *
 * ============ HOW A SHOP VIEW ROW FINDS ITS NOTES ============
 *
 * Steve authors against a QUOTE REQUEST and a line-item index: FlashDraft is
 * opened as /studio/draft?admin=1&loadRequest=<id>&item=<n>. The shop reads
 * `shop_profile_library` rows, one per line item, created in a loop in
 * app/api/admin/command-center/approve-quote-request/route.ts in item order.
 * Those rows carry `quote_request_id` but NOT the item index.
 *
 * So the index is DERIVED: the shop rows of one quote request, ordered by
 * `created_at` ascending, are its line items in order. That is a real property
 * of the insert loop, not an assumption about it, and it is unit-tested.
 *
 * WHEN THE DERIVATION CANNOT BE TRUSTED, EVERY NOTE IS SHOWN ON EVERY ROW OF
 * THAT JOB. If the number of shop rows does not match what the callouts expect
 * — a row deleted, a job re-sent, a mix of old and new — the resolver widens
 * rather than narrows. Showing an operator a note meant for the other line
 * item costs a question. Hiding one costs a part. The failure direction is
 * chosen deliberately and is asserted in the test.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveCalloutAnchor,
  type CalloutPoint,
} from '@/lib/shop-callouts/geometry';
import { numberCallouts, type ShopCallout, type ShopCalloutSet } from '@/lib/shop-callouts/types';
import type { CalloutCreateInput, CalloutUpdateInput } from '@/lib/shop-callouts/validate';

const CALLOUT_COLUMNS =
  'id, quote_request_id, line_item_index, shop_job_id, drawing_id, drawing_revision, ' +
  'segment_index, segment_count, t, seg_ax, seg_ay, seg_bx, seg_by, anchor_x, anchor_y, ' +
  'tail_dx, tail_dy, note, orphaned, created_by, created_at, updated_at';

interface CalloutRow {
  id: string;
  quote_request_id: string | null;
  line_item_index: number;
  shop_job_id: string | null;
  drawing_id: string | null;
  drawing_revision: number | null;
  segment_index: number;
  segment_count: number;
  t: number | string;
  seg_ax: number | string;
  seg_ay: number | string;
  seg_bx: number | string;
  seg_by: number | string;
  anchor_x: number | string;
  anchor_y: number | string;
  tail_dx: number | string;
  tail_dy: number | string;
  note: string;
  orphaned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * PostgREST returns `numeric` as a STRING, not a number.
 *
 * Every anchor field in this table is `numeric`, so skipping this coercion
 * would hand the geometry resolver `"3.5"` and `Math.abs("3.5" - 3.5)` would
 * be 0 while `points[i].x - anchor.segA.x` silently became a string
 * concatenation somewhere else. Converted once, on the way in.
 */
function n(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export interface CalloutAuthor {
  id: string;
  name: string;
}

function toCallout(row: CalloutRow, points: readonly CalloutPoint[], authorName: string): Omit<ShopCallout, 'number'> {
  const anchor = {
    segmentIndex: row.segment_index,
    segmentCount: row.segment_count,
    t: n(row.t),
    segA: { x: n(row.seg_ax), y: n(row.seg_ay) },
    segB: { x: n(row.seg_bx), y: n(row.seg_by) },
    anchor: { x: n(row.anchor_x), y: n(row.anchor_y) },
  };
  // With no geometry at all, nothing can be resolved and the note still has to
  // be shown — a job whose drawing was never stored is precisely a job where
  // the written instruction is all the operator has.
  const resolved =
    points.length >= 2
      ? resolveCalloutAnchor(anchor, points)
      : { status: 'orphaned' as const, tip: null, segmentIndex: null, t: null };
  return {
    id: row.id,
    note: row.note,
    authorName,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    segmentIndex: anchor.segmentIndex,
    segmentCount: anchor.segmentCount,
    t: anchor.t,
    segA: anchor.segA,
    segB: anchor.segB,
    anchor: anchor.anchor,
    tail: { dx: n(row.tail_dx), dy: n(row.tail_dy) },
    orphaned: row.orphaned,
    anchorStatus: resolved.status,
    tip: resolved.tip,
  };
}

/** Names for the `created_by` ids in a batch, so the shop sees "Steve", not a uuid. */
async function authorNames(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return out;
  const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', unique);
  for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    // Falls back to the email and then to "AFS" — never to a uuid, which tells
    // an operator nothing, and never to a guessed name.
    out.set(p.id, (p.full_name ?? '').trim() || (p.email ?? '').trim() || 'AFS');
  }
  return out;
}

/**
 * Every live callout on one drawing of one quote request — the admin authoring
 * read. `points` is the geometry currently on the canvas, so each callout comes
 * back already resolved against it.
 */
export async function getCalloutsForQuoteItem(
  supabase: SupabaseClient,
  quoteRequestId: string,
  lineItemIndex: number,
  points: readonly CalloutPoint[]
): Promise<{ callouts: ShopCallout[]; unreadable: boolean }> {
  const { data, error } = await supabase
    .from('shop_callouts')
    .select(CALLOUT_COLUMNS)
    .eq('quote_request_id', quoteRequestId)
    .eq('line_item_index', lineItemIndex)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  // A FAILED READ IS NOT AN EMPTY LIST. See ShopCalloutSet.unreadable.
  if (error || !data) {
    console.error('[Shop Callouts Read Error]', error);
    return { callouts: [], unreadable: true };
  }
  const rows = data as unknown as CalloutRow[];
  const names = await authorNames(supabase, rows.map((r) => r.created_by));
  return {
    callouts: numberCallouts(rows.map((r) => toCallout(r, points, names.get(r.created_by) ?? 'AFS'))),
    unreadable: false,
  };
}

/** One callout by id, live only. Used by the update/delete routes to audit the before-value. */
export async function getCalloutById(
  supabase: SupabaseClient,
  id: string
): Promise<CalloutRow | null> {
  const { data } = await supabase
    .from('shop_callouts')
    .select(CALLOUT_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as unknown as CalloutRow | null) ?? null;
}

/**
 * WHAT A FAILED WRITE SAYS TO STEVE — and what it deliberately does not.
 *
 * CLAUDE.md rule #30: never show a stack trace, and always say what did NOT
 * happen. The database's own words are not that. Found live on 2026-10-06,
 * when a failed save put "Could not find the table 'public.shop_callouts' in
 * the schema cache" in the popup — a PostgREST internal, in front of an
 * estimator, saying nothing about whether the job changed.
 *
 * The real error is logged server-side, where it is diagnosable.
 */
const SAVE_FAILED = 'The note was not saved. Nothing on this job was changed — your text is still here.';
const DELETE_FAILED = 'The note was not deleted. It is still on this job.';

export interface CalloutInsertContext {
  /** From the session, never from the body. */
  createdBy: string;
  companyId: string | null;
}

export async function insertCallout(
  supabase: SupabaseClient,
  input: CalloutCreateInput,
  ctx: CalloutInsertContext
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from('shop_callouts')
    .insert({
      quote_request_id: input.quoteRequestId,
      line_item_index: input.lineItemIndex,
      shop_job_id: input.shopJobId,
      drawing_id: input.drawingId,
      drawing_revision: input.drawingRevision,
      segment_index: input.segmentIndex,
      segment_count: input.segmentCount,
      t: input.t,
      seg_ax: input.segA.x,
      seg_ay: input.segA.y,
      seg_bx: input.segB.x,
      seg_by: input.segB.y,
      anchor_x: input.anchor.x,
      anchor_y: input.anchor.y,
      tail_dx: input.tail.dx,
      tail_dy: input.tail.dy,
      note: input.note,
      // Session-derived. There is no code path by which a request body reaches
      // either of these two columns.
      created_by: ctx.createdBy,
      company_id: ctx.companyId,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[Shop Callout Insert Error]', error);
    return { error: SAVE_FAILED };
  }
  return { id: (data as { id: string }).id };
}

export async function updateCallout(
  supabase: SupabaseClient,
  id: string,
  input: CalloutUpdateInput
): Promise<{ ok: true } | { error: string }> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.note !== undefined) patch.note = input.note;
  if (input.tail !== undefined) {
    patch.tail_dx = input.tail.dx;
    patch.tail_dy = input.tail.dy;
  }
  if (input.anchor !== undefined) {
    patch.segment_index = input.anchor.segmentIndex;
    patch.segment_count = input.anchor.segmentCount;
    patch.t = input.anchor.t;
    patch.seg_ax = input.anchor.segA.x;
    patch.seg_ay = input.anchor.segA.y;
    patch.seg_bx = input.anchor.segB.x;
    patch.seg_by = input.anchor.segB.y;
    patch.anchor_x = input.anchor.anchor.x;
    patch.anchor_y = input.anchor.anchor.y;
    // Re-placing an orphan is how an orphan stops being one. Nothing else
    // clears this flag, so a note that says "re-place me" keeps saying it
    // until somebody actually re-places it.
    patch.orphaned = false;
  }
  const { data, error } = await supabase
    .from('shop_callouts')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    console.error('[Shop Callout Update Error]', error);
    return { error: SAVE_FAILED };
  }
  // Zero rows means the id is gone or already soft-deleted. Reported as such
  // rather than as a success, so the popup never shows a saved note that is not.
  if (!data || (data as unknown[]).length === 0) return { error: 'That note no longer exists.' };
  return { ok: true };
}

/** Soft delete. The row stays; `deleted_at` is what every read filters on. */
export async function softDeleteCallout(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: true } | { error: string }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('shop_callouts')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    console.error('[Shop Callout Delete Error]', error);
    return { error: DELETE_FAILED };
  }
  if (!data || (data as unknown[]).length === 0) return { error: 'That note no longer exists.' };
  return { ok: true };
}

/** Persist a recomputed orphan flag. Admin-only path; never called by the shop read. */
export async function markOrphaned(
  supabase: SupabaseClient,
  ids: string[],
  orphaned: boolean
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('shop_callouts')
    .update({ orphaned })
    .in('id', ids)
    .is('deleted_at', null);
  if (error) console.error('[Shop Callout Orphan Flag Error]', error);
}

// ---------------------------------------------------------------------------
// SHOP VIEW
// ---------------------------------------------------------------------------

/** One shop row, reduced to what the callout resolver needs. */
export interface ShopRowKey {
  id: string;
  quoteRequestId: string | null;
  createdAt: string;
}

/**
 * WHICH LINE ITEM IS THIS SHOP ROW? See this module's header.
 *
 * Pure, exported and tested: the rows of one quote request in `created_at`
 * order are its line items in order. Returns a map of shop-row id -> item
 * index, plus the set of quote requests where the derivation is UNSAFE and
 * every note must be shown on every row.
 */
export function deriveLineItemIndexes(
  rows: readonly ShopRowKey[],
  calloutItemIndexesByJob: ReadonlyMap<string, ReadonlySet<number>>
): { itemIndexByRow: Map<string, number>; widenedJobs: Set<string> } {
  const byJob = new Map<string, ShopRowKey[]>();
  for (const r of rows) {
    if (!r.quoteRequestId) continue;
    const list = byJob.get(r.quoteRequestId) ?? [];
    list.push(r);
    byJob.set(r.quoteRequestId, list);
  }

  const itemIndexByRow = new Map<string, number>();
  const widenedJobs = new Set<string>();
  for (const [jobId, list] of byJob) {
    const ordered = [...list].sort((a, b) => {
      const at = a.createdAt.localeCompare(b.createdAt);
      return at !== 0 ? at : a.id.localeCompare(b.id);
    });
    ordered.forEach((r, i) => itemIndexByRow.set(r.id, i));

    // The derivation is only trustworthy while every item index a callout
    // claims is one this job actually has a row for. A callout on item 2 of a
    // job with one shop row means a row was deleted or the job was re-sent —
    // at which point mapping by position would HIDE that note. Widen instead.
    const claimed = calloutItemIndexesByJob.get(jobId);
    if (claimed) {
      for (const idx of claimed) {
        if (idx >= ordered.length) {
          widenedJobs.add(jobId);
          break;
        }
      }
    }
  }
  return { itemIndexByRow, widenedJobs };
}

/**
 * HOW MANY LIVE NOTES EACH SHOP ROW HAS. One query for every row on the board.
 *
 * Returns counts only — the note text, the geometry and the arrows are fetched
 * per job when an operator opens the notes, the same lazy shape CLAUDE.md rule
 * #26 requires of the drawings on this screen. The queue endpoint polls every
 * thirty seconds and must not start carrying 280-character strings for twenty
 * rows because a count was convenient to compute alongside them.
 */
export async function getCalloutCountsForShopRows(
  supabase: SupabaseClient,
  rows: readonly ShopRowKey[]
): Promise<{ counts: Map<string, number>; unreadable: boolean }> {
  const counts = new Map<string, number>();
  if (rows.length === 0) return { counts, unreadable: false };

  const shopIds = rows.map((r) => r.id);
  const jobIds = Array.from(
    new Set(rows.map((r) => r.quoteRequestId).filter((v): v is string => Boolean(v)))
  );

  const { data, error } = await supabase
    .from('shop_callouts')
    .select('id, shop_job_id, quote_request_id, line_item_index')
    .is('deleted_at', null)
    .or(
      [
        shopIds.length ? `shop_job_id.in.(${shopIds.join(',')})` : null,
        jobIds.length ? `quote_request_id.in.(${jobIds.join(',')})` : null,
      ]
        .filter(Boolean)
        .join(',')
    );
  // A FAILED COUNT MUST NOT RENDER AS "no notes". On this screen that would
  // hide a note from the person about to bend the part — see
  // ShopCalloutSet.unreadable for how this was found.
  if (error || !data) {
    console.error('[Shop Callout Count Error]', error);
    return { counts, unreadable: true };
  }

  const found = data as unknown as {
    id: string;
    shop_job_id: string | null;
    quote_request_id: string | null;
    line_item_index: number;
  }[];

  const claimed = new Map<string, Set<number>>();
  for (const c of found) {
    if (!c.quote_request_id) continue;
    const set = claimed.get(c.quote_request_id) ?? new Set<number>();
    set.add(c.line_item_index);
    claimed.set(c.quote_request_id, set);
  }
  const { itemIndexByRow, widenedJobs } = deriveLineItemIndexes(rows, claimed);

  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const c of found) {
    // A callout pinned straight to a shop row needs no derivation at all.
    if (c.shop_job_id && byId.has(c.shop_job_id)) {
      bump(c.shop_job_id);
      continue;
    }
    if (!c.quote_request_id) continue;
    const siblings = rows.filter((r) => r.quoteRequestId === c.quote_request_id);
    if (siblings.length === 0) continue;
    if (widenedJobs.has(c.quote_request_id)) {
      for (const r of siblings) bump(r.id);
      continue;
    }
    const match = siblings.find((r) => itemIndexByRow.get(r.id) === c.line_item_index);
    if (match) bump(match.id);
    // No match and not widened: the note belongs to a line item this board has
    // no row for. Counted nowhere rather than attributed to the wrong row.
  }
  return { counts, unreadable: false };
}

/**
 * EVERYTHING ONE SHOP ROW NEEDS TO SHOW ITS NOTES — the notes and the geometry
 * to draw the arrows on, fetched when an operator opens them.
 *
 * `geometry_points` and not `geometry_svg`: that column holds a 70KB-786KB
 * base64 PNG (rule #26) and, more to the point, a PNG cannot carry an arrow at
 * a known position. `geometry_points` is the same `points` array FlashDraft
 * authored against — written by
 * app/api/admin/command-center/approve-quote-request/route.ts from
 * `build.item.points` — so an anchor authored in FlashDraft resolves here
 * against identical numbers.
 */
export async function getShopCalloutSetForShopJob(
  supabase: SupabaseClient,
  shopJobId: string
): Promise<ShopCalloutSet> {
  const { data: jobRow } = await supabase
    .from('shop_profile_library')
    .select('id, quote_request_id, created_at, geometry_points')
    .eq('id', shopJobId)
    .is('deleted_at', null)
    .maybeSingle();
  const job = jobRow as
    | { id: string; quote_request_id: string | null; created_at: string; geometry_points: unknown }
    | null;
  // The job row itself could not be read. Not "no notes" — nothing is known.
  if (!job) return { callouts: [], points: [], unreadable: true };

  const points = parseGeometryPoints(job.geometry_points);

  // Siblings are needed to derive this row's line-item index, exactly as the
  // count query does. One extra small select, ids and timestamps only.
  let siblings: ShopRowKey[] = [{ id: job.id, quoteRequestId: job.quote_request_id, createdAt: job.created_at }];
  if (job.quote_request_id) {
    const { data: sibs } = await supabase
      .from('shop_profile_library')
      .select('id, quote_request_id, created_at')
      .eq('quote_request_id', job.quote_request_id)
      .is('deleted_at', null);
    const list = (sibs ?? []) as { id: string; quote_request_id: string | null; created_at: string }[];
    if (list.length) {
      siblings = list.map((r) => ({ id: r.id, quoteRequestId: r.quote_request_id, createdAt: r.created_at }));
    }
  }

  const orFilter = [
    `shop_job_id.eq.${shopJobId}`,
    job.quote_request_id ? `quote_request_id.eq.${job.quote_request_id}` : null,
  ]
    .filter(Boolean)
    .join(',');

  const { data, error } = await supabase
    .from('shop_callouts')
    .select(CALLOUT_COLUMNS)
    .is('deleted_at', null)
    .or(orFilter)
    .order('created_at', { ascending: true });
  if (error || !data) {
    console.error('[Shop Callout Set Read Error]', error);
    return { callouts: [], points, unreadable: true };
  }

  const all = data as unknown as CalloutRow[];
  const claimed = new Map<string, Set<number>>();
  for (const c of all) {
    if (!c.quote_request_id) continue;
    const set = claimed.get(c.quote_request_id) ?? new Set<number>();
    set.add(c.line_item_index);
    claimed.set(c.quote_request_id, set);
  }
  const { itemIndexByRow, widenedJobs } = deriveLineItemIndexes(siblings, claimed);
  const myIndex = itemIndexByRow.get(shopJobId) ?? 0;

  const mine = all.filter((c) => {
    if (c.shop_job_id === shopJobId) return true;
    if (!c.quote_request_id || c.quote_request_id !== job.quote_request_id) return false;
    // A note pinned to ANOTHER shop row of the same job is that row's, not this
    // one's — the pin is more specific than the derivation.
    if (c.shop_job_id && c.shop_job_id !== shopJobId) return false;
    if (widenedJobs.has(c.quote_request_id)) return true;
    return c.line_item_index === myIndex;
  });

  const names = await authorNames(supabase, mine.map((r) => r.created_by));
  return {
    callouts: numberCallouts(mine.map((r) => toCallout(r, points, names.get(r.created_by) ?? 'AFS'))),
    points,
    unreadable: false,
  };
}

/**
 * `geometry_points` is JSONB written by a few different producers over this
 * project's history, so it is PARSED rather than cast — the same reason
 * lib/integrations/pathfinder-response.ts parses a vendor payload instead of
 * asserting it. A row whose geometry is unreadable yields an empty polyline,
 * which renders the notes with no arrows and says so, rather than throwing on
 * the shop floor.
 */
export function parseGeometryPoints(value: unknown): { x: number; y: number }[] {
  if (!Array.isArray(value)) return [];
  const out: { x: number; y: number }[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    const x = typeof o.x === 'number' ? o.x : Number(o.x);
    const y = typeof o.y === 'number' ? o.y : Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    out.push({ x, y });
  }
  return out;
}
