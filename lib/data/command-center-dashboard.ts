import type { SupabaseClient } from '@supabase/supabase-js';

// orders.status's real CHECK constraint (see SCHEMA.md TABLE 18 + the d-002
// follow-up documented in supabase/migrations/007_delivery_tracking.sql)
// is: submitted/received/in_queue/cutting/bending/qc/ready/shipped/
// delivered/cancelled/packaged/out_for_delivery/in_production — there is
// no separate "in_production" transition anything in this codebase
// actually sets (app/api/orders/[id]/packaged/route.ts checks for it as an
// allowed predecessor state, nothing sets it), so "In Production" is
// counted across the real granular stages the app does use, plus the
// literal value for forward-compatibility.
const IN_PRODUCTION_STATUSES = ['in_queue', 'cutting', 'bending', 'qc', 'in_production'];
const READY_STATUSES = ['ready', 'packaged'];
const OUT_FOR_DELIVERY_STATUS = 'out_for_delivery';

export interface OrderStatusCounts {
  inProduction: number;
  readyForPickup: number;
  outForDelivery: number;
}

export async function getOrderStatusCounts(supabase: SupabaseClient): Promise<OrderStatusCounts> {
  const [inProduction, readyForPickup, outForDelivery] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', IN_PRODUCTION_STATUSES),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', READY_STATUSES),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', OUT_FOR_DELIVERY_STATUS),
  ]);

  return {
    inProduction: inProduction.count ?? 0,
    readyForPickup: readyForPickup.count ?? 0,
    outForDelivery: outForDelivery.count ?? 0,
  };
}

/** Lightweight head-count — avoids getGbpPhotos' per-row signed-URL fetch, which is unnecessary just for a badge number. */
export async function getGbpPendingCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('gbp_photo_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review');
  return count ?? 0;
}

// Same shape quote_requests.line_items is stored in (see
// app/api/quote-requests/route.ts / lib/data/pending-quote-requests.ts) —
// only profileType is needed here.
interface RecentQuoteRequestLineItem {
  profileType: string;
}

export interface RecentQuoteRequestRow {
  id: string;
  requestNumber: string;
  customerName: string;
  profileType: string;
  status: string;
  submittedAt: string;
}

/**
 * Distinct from getPendingQuoteRequests (lib/data/pending-quote-requests.ts),
 * which is scoped to status = 'submitted' only for the Pending Approval
 * queue. This is the dashboard's "recent activity" feed — last N requests
 * regardless of status, each carrying its own status badge.
 */
export async function getRecentQuoteRequests(supabase: SupabaseClient, limit = 10): Promise<RecentQuoteRequestRow[]> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('id, request_number, user_id, guest_email, line_items, status, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const rows = data as {
    id: string;
    request_number: string;
    user_id: string | null;
    guest_email: string | null;
    line_items: RecentQuoteRequestLineItem[] | null;
    status: string;
    submitted_at: string;
  }[];
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id).filter((v): v is string => !!v);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameById = new Map(((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  return rows.map((r) => {
    const items = r.line_items ?? [];
    const profileType =
      items.length === 0
        ? '—'
        : items.length === 1
          ? items[0].profileType
          : `${items[0].profileType} +${items.length - 1} more`;

    return {
      id: r.id,
      requestNumber: r.request_number,
      customerName: (r.user_id ? nameById.get(r.user_id) : null) ?? r.guest_email ?? 'Guest',
      profileType,
      status: r.status,
      submittedAt: r.submitted_at,
    };
  });
}
