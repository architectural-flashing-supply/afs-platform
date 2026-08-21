import type { SupabaseClient } from '@supabase/supabase-js';
import { usesFallbackGeometry } from '@/lib/machine-jobs/fallback-geometry';

// Same shape quote_requests.line_items is actually stored in — see
// app/api/quote-requests/route.ts's QuoteRequestItemInput. No bend/angle
// data is ever captured here, only basic dimensions, plus the real
// FlashDraft-drawn points when the item came from /studio/draft (see
// approve-quote-request/route.ts's QuoteRequestLineItem — points are the
// same shape, just narrowed to x/y here since usesFallbackGeometry() only
// needs to know how many there are).
export interface PendingQuoteRequestLineItem {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  quantity: number;
  points?: { x: number; y: number }[] | null;
}

export interface PendingQuoteRequestRow {
  id: string;
  requestNumber: string;
  customerName: string;
  customerCompany: string | null;
  lineItemDescriptions: string[];
  isRush: boolean;
  notes: string | null;
  submittedAt: string;
  sourceTool: string;
  // True when approving this request would map ANY item through
  // buildBendsFromItem's hardcoded 12"/2"/2" fallback (no real dimensions
  // or drawn points captured) — surfaced so an admin sees the warning
  // before clicking Approve, not after. See approve-quote-request/route.ts.
  // Checks every item, not just item 0 — approving now creates one
  // machine_jobs row per item, so a fallback-geometry item anywhere in the
  // request is worth flagging, not just the first one.
  willUseFallbackGeometry: boolean;
  // True when this request has more than one line item. No longer blocks
  // approval (approve-quote-request/route.ts now creates one machine_jobs
  // row per item and pushes each to PathfinderEdge individually) — purely
  // informational, surfaced so an admin knows N separate jobs will be
  // created from one click.
  hasMultipleLineItems: boolean;
}

function describeLineItem(item: PendingQuoteRequestLineItem): string {
  const parts = [item.profileType];
  if (item.material) parts.push(item.material);
  if (item.gauge) parts.push(item.gauge);
  const dims: string[] = [];
  if (item.width) dims.push(`W:${item.width}"`);
  if (item.height) dims.push(`H:${item.height}"`);
  if (item.legA) dims.push(`A:${item.legA}"`);
  if (item.legB) dims.push(`B:${item.legB}"`);
  const label = parts.join(' — ');
  const qty = item.quantity ? ` × ${item.quantity}` : '';
  return dims.length ? `${label} (${dims.join(' ')})${qty}` : `${label}${qty}`;
}

export async function getPendingQuoteRequests(supabase: SupabaseClient): Promise<PendingQuoteRequestRow[]> {
  const { data: rows, error } = await supabase
    .from('quote_requests')
    .select('id, request_number, user_id, guest_email, line_items, is_rush, notes, submitted_at, source_tool')
    .eq('status', 'submitted')
    .order('is_rush', { ascending: false })
    .order('submitted_at', { ascending: false });
  if (error || !rows) return [];

  const requests = rows as {
    id: string;
    request_number: string;
    user_id: string | null;
    guest_email: string | null;
    line_items: PendingQuoteRequestLineItem[] | null;
    is_rush: boolean;
    notes: string | null;
    submitted_at: string;
    source_tool: string | null;
  }[];
  if (requests.length === 0) return [];

  const userIds = requests.map((r) => r.user_id).filter((v): v is string => !!v);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, company').in('id', userIds)
    : { data: [] };
  const profileMap = new Map<string, { fullName: string; company: string | null }>();
  for (const p of (profiles ?? []) as { id: string; full_name: string; company: string | null }[]) {
    profileMap.set(p.id, { fullName: p.full_name, company: p.company });
  }

  return requests.map((r) => {
    const profile = r.user_id ? profileMap.get(r.user_id) : null;
    const items = r.line_items ?? [];
    return {
      id: r.id,
      requestNumber: r.request_number,
      customerName: profile?.fullName ?? r.guest_email ?? 'Guest',
      customerCompany: profile?.company ?? null,
      lineItemDescriptions: items.map(describeLineItem),
      isRush: r.is_rush,
      notes: r.notes,
      submittedAt: r.submitted_at,
      sourceTool: r.source_tool ?? 'unknown',
      willUseFallbackGeometry: items.some(usesFallbackGeometry),
      hasMultipleLineItems: items.length > 1,
    };
  });
}
