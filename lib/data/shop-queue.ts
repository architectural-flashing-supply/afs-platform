/**
 * THE SHOP QUEUE — what the Thalmann works on, in the order it works on it.
 *
 * Command Center V2 prompt v2-04. The approved UX is the prototype's
 * `shopView` (docs/design/command-center-v2-prototype.html): the queue in
 * queue order with a position number, a large drawing, item × qty, the spec,
 * the customer, the machine profile number and the status, with ONE button per
 * card — **Start bending**, then **Mark finished**.
 *
 * NO NEW QUEUE TABLE, AND NO NEW STATUS VOCABULARY. `shop_profile_library`
 * (migration 016) is the real record of what has been sent to the current
 * Thalmann; `queue_position` (017) is the order; `queued -> in_progress ->
 * complete` (afs-sv-010, lib/data/shop-library.ts) is already the lifecycle,
 * and it maps one-to-one onto the prototype's Queued / Bending now / Finished.
 * This module reads that, orders it, and labels it. It writes nothing.
 *
 * ============ RULE #15: RUSH PINS HERE, AND THIS IS WHERE "HERE" IS ============
 *
 * CLAUDE.md rule #15 says rush pins to the top of the SHOP QUEUES only. This
 * is one of them — the list the operator reads to decide what to bend next —
 * so `compareShopQueue` puts every rush job above every non-rush job and only
 * then falls back to queue order. Everywhere else, including the Workbench
 * (lib/data/workbench.ts) and the Deliveries screen (lib/data/deliveries.ts),
 * rush changes nothing but the badge. Both halves of that are unit-tested.
 *
 * `is_rush` is NEVER read off this table: `shop_profile_library` has no
 * `is_rush` column and must not get one. It is read from the Job
 * (`quote_requests.is_rush`), which is the only place Postgres enforces that a
 * rush has an explicit source (migration 034's
 * `quote_requests_rush_needs_explicit_source`). A shop row with no Job behind
 * it — a direct FlashDraft send — is therefore never rush, which is correct:
 * nobody ticked anything.
 *
 * ============ EGRESS ============
 *
 * `shop_profile_library.geometry_svg` is misnamed: it holds a base64 PNG data
 * URI, measured live at 70KB–786KB per row. Twenty rows of it is ~6MB of HTML
 * on a page that is polled. This module NEVER selects it. It returns
 * `hasDrawing`, and the card fetches the image itself once it scrolls into
 * view, through app/api/admin/shop-queue/drawing/[id] — the same lazy pattern
 * PastProfileThumb.tsx already uses for the Job screen.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compareShopProfileLibraryQueueOrder,
  type QueueOrderFields,
} from '@/lib/data/shop-library';
import { getCalloutCountsForShopRows } from '@/lib/data/shop-callouts';

/** The prototype's three shop states, in the operator's words. */
export type ShopCardState = 'queued' | 'bending' | 'finished';

export function shopCardStateFromStatus(status: string): ShopCardState {
  if (status === 'in_progress') return 'bending';
  if (status === 'complete') return 'finished';
  return 'queued';
}

export const SHOP_CARD_STATE_LABEL: Record<ShopCardState, string> = {
  queued: 'Queued',
  bending: 'Bending now',
  finished: 'Finished',
};

/** The one button this card offers. Null = nothing left to do here. */
export type ShopCardAction =
  | { kind: 'start'; label: 'Start bending'; nextStatus: 'in_progress' }
  | { kind: 'finish'; label: 'Mark finished'; nextStatus: 'complete' };

export function shopCardAction(state: ShopCardState): ShopCardAction | null {
  if (state === 'queued') return { kind: 'start', label: 'Start bending', nextStatus: 'in_progress' };
  if (state === 'bending') return { kind: 'finish', label: 'Mark finished', nextStatus: 'complete' };
  return null;
}

export interface ShopQueueCard extends QueueOrderFields {
  id: string;
  /** 1-based, as printed in the big circle. Assigned after ordering. */
  position: number;
  /** The Job this belongs to, when there is one. */
  quoteRequestId: string | null;
  item: string;
  quantity: number | null;
  /** "24 ga Charcoal Kynar, 10 ft" — already assembled. */
  spec: string;
  customer: string;
  /** PathfinderEdge profile number, as returned by the machine. */
  machineProfileId: string | null;
  state: ShopCardState;
  stateLabel: string;
  action: ShopCardAction | null;
  /** Only ever true from an explicit customer checkbox or admin toggle. */
  isRush: boolean;
  startedAt: string | null;
  completedAt: string | null;
  /** Shop-floor instructions an operator needs on the card itself. */
  hemInstructions: string | null;
  paintedEdge: boolean;
  specialInstructions: string | null;
  /** True when a base64 drawing exists to lazy-load. Never the image itself. */
  hasDrawing: boolean;
  /**
   * How many of Steve's shop callouts are on this job (migration 051).
   *
   * A COUNT AND NEVER THE TEXT. This module's egress note applies to notes as
   * well as drawings: twenty rows of 280-character strings, re-fetched every
   * thirty seconds, for text an operator reads on one job at a time. The card
   * shows the count; the notes are fetched from
   * app/api/shop-callouts/[shopJobId] when the operator opens them.
   */
  calloutCount: number;
  /** Set once a delivery row exists, so the card can say so. */
  deliveryDate: string | null;
  deliveryWindow: string | null;
}

/**
 * Rush first, then the queue order every other shop surface already uses.
 *
 * Exported and pure so "rush pins in the shop queue" is a unit test rather
 * than a claim about a SQL clause.
 */
export function compareShopQueue(
  a: QueueOrderFields & { isRush: boolean },
  b: QueueOrderFields & { isRush: boolean }
): number {
  if (a.isRush !== b.isRush) return a.isRush ? -1 : 1;
  return compareShopProfileLibraryQueueOrder(a, b);
}

/** "24 ga Charcoal Kynar, 10 ft" from the columns that carry those pieces. */
export function describeSpec(row: {
  gauge: string | null;
  material: string | null;
  color: string | null;
  finish: string | null;
  lengthFt: number | null;
}): string {
  const parts = [
    row.gauge,
    row.material,
    row.color,
    row.finish,
    row.lengthFt ? `${row.lengthFt} ft` : null,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : p))
    .filter((p): p is string => typeof p === 'string' && p !== '');
  return parts.length ? parts.join(', ') : 'No specification recorded';
}

const QUEUE_COLUMNS =
  'id, quote_request_id, profile_name, customer_name, company, material, gauge, color, finish, ' +
  'quantity, length_ft, due_date, hem_instructions, painted_edge, special_instructions, ' +
  'pathfinder_profile_id, status, queue_position, started_at, completed_at, created_at, ' +
  // `geometry_svg` is deliberately absent — see this file's egress note. Only
  // "does a drawing exist" is read, by a separate id-only select below.
  'job_name';

interface QueueSourceRow {
  id: string;
  quote_request_id: string | null;
  profile_name: string | null;
  customer_name: string | null;
  company: string | null;
  material: string | null;
  gauge: string | null;
  color: string | null;
  finish: string | null;
  quantity: number | null;
  length_ft: number | null;
  due_date: string | null;
  hem_instructions: string | null;
  painted_edge: boolean | null;
  special_instructions: string | null;
  pathfinder_profile_id: string | null;
  status: string | null;
  queue_position: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  job_name: string | null;
}

export interface ShopQueue {
  /** Everything still to bend or bending, in queue order, rush pinned. */
  active: ShopQueueCard[];
  /** Finished today, newest first — the operator's own "did I do that" check. */
  finishedToday: ShopQueueCard[];
  /**
   * TRUE WHEN THE SHOP NOTES COULD NOT BE COUNTED.
   *
   * Every `calloutCount` is then 0, which is indistinguishable from "no notes"
   * unless somebody says so — and on this screen that silence would hide an
   * instruction from the person about to bend the part. The board renders a
   * warning instead of its usual nothing. See ShopCalloutSet.unreadable.
   */
  calloutsUnreadable: boolean;
}

/**
 * Reads the queue. One query for the rows, one batched query for the Jobs'
 * rush flags, one batched query for which rows already have a delivery, and a
 * fourth that asks only whether a drawing exists.
 */
export async function getShopQueue(supabase: SupabaseClient, now: Date = new Date()): Promise<ShopQueue> {
  const { data, error } = await supabase
    .from('shop_profile_library')
    .select(QUEUE_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error || !data) return { active: [], finishedToday: [], calloutsUnreadable: false };

  const rows = data as unknown as QueueSourceRow[];
  if (rows.length === 0) return { active: [], finishedToday: [], calloutsUnreadable: false };

  const ids = rows.map((r) => r.id);
  const jobIds = Array.from(
    new Set(rows.map((r) => r.quote_request_id).filter((v): v is string => !!v))
  );

  // Rush comes from the Job, never from this table. See the header.
  const rushByJob = new Map<string, boolean>();
  if (jobIds.length) {
    const { data: jobs } = await supabase.from('quote_requests').select('id, is_rush').in('id', jobIds);
    for (const j of (jobs ?? []) as { id: string; is_rush: boolean }[]) {
      rushByJob.set(j.id, j.is_rush === true);
    }
  }

  const deliveryByShopJob = new Map<string, { date: string; window: string }>();
  {
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('shop_job_id, scheduled_date, time_window')
      .in('shop_job_id', ids);
    for (const d of (deliveries ?? []) as {
      shop_job_id: string;
      scheduled_date: string;
      time_window: string;
    }[]) {
      deliveryByShopJob.set(d.shop_job_id, { date: d.scheduled_date, window: d.time_window });
    }
  }

  // How many of Steve's shop notes are on each row (migration 051). Counts
  // only — see ShopQueueCard.calloutCount. One batched query for the board.
  const { counts: calloutCounts, unreadable: calloutsUnreadable } = await getCalloutCountsForShopRows(
    supabase,
    rows.map((r) => ({ id: r.id, quoteRequestId: r.quote_request_id, createdAt: r.created_at }))
  );

  // Does a drawing exist? `geometry_svg` holds a base64 PNG, so this asks for
  // its LENGTH through a view-free trick: select the id of every row whose
  // geometry_svg is not null. No image bytes cross the wire.
  const withDrawing = new Set<string>();
  {
    const { data: drawn } = await supabase
      .from('shop_profile_library')
      .select('id')
      .in('id', ids)
      .not('geometry_svg', 'is', null);
    for (const d of (drawn ?? []) as { id: string }[]) withDrawing.add(d.id);
  }

  const cards = rows.map((r) => {
    const state = shopCardStateFromStatus(r.status ?? 'queued');
    const delivery = deliveryByShopJob.get(r.id) ?? null;
    return {
      id: r.id,
      position: 0,
      quoteRequestId: r.quote_request_id,
      item: (r.profile_name ?? '').trim() || 'Custom profile',
      quantity: r.quantity,
      spec: describeSpec({
        gauge: r.gauge,
        material: r.material,
        color: r.color,
        finish: r.finish,
        lengthFt: r.length_ft,
      }),
      customer: (r.company ?? '').trim() || (r.customer_name ?? '').trim() || 'No customer recorded',
      machineProfileId: r.pathfinder_profile_id,
      state,
      stateLabel: SHOP_CARD_STATE_LABEL[state],
      action: shopCardAction(state),
      isRush: r.quote_request_id ? (rushByJob.get(r.quote_request_id) ?? false) : false,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      hemInstructions: r.hem_instructions,
      paintedEdge: r.painted_edge ?? false,
      specialInstructions: r.special_instructions,
      hasDrawing: withDrawing.has(r.id),
      calloutCount: calloutCounts.get(r.id) ?? 0,
      deliveryDate: delivery?.date ?? null,
      deliveryWindow: delivery?.window ?? null,
      // QueueOrderFields
      queuePosition: r.queue_position,
      dueDate: r.due_date,
      createdAt: r.created_at,
    } satisfies ShopQueueCard;
  });

  const active = cards.filter((c) => c.state !== 'finished').sort(compareShopQueue);
  active.forEach((c, i) => {
    c.position = i + 1;
  });

  const todayKey = now.toDateString();
  const finishedToday = cards
    .filter((c) => c.state === 'finished' && c.completedAt && new Date(c.completedAt).toDateString() === todayKey)
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime());

  return { active, finishedToday, calloutsUnreadable };
}
