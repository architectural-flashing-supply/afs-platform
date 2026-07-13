import type { SupabaseClient } from '@supabase/supabase-js';

// Same shape quote_requests.line_items is actually stored in — see
// app/api/quote-requests/route.ts's QuoteRequestItemInput. No bend/angle
// data is ever captured here, only basic dimensions.
export interface PendingQuoteRequestLineItem {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  quantity: number;
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
    .select('id, request_number, user_id, guest_email, line_items, is_rush, notes, submitted_at')
    .eq('status', 'submitted')
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
    return {
      id: r.id,
      requestNumber: r.request_number,
      customerName: profile?.fullName ?? r.guest_email ?? 'Guest',
      customerCompany: profile?.company ?? null,
      lineItemDescriptions: (r.line_items ?? []).map(describeLineItem),
      isRush: r.is_rush,
      notes: r.notes,
      submittedAt: r.submitted_at,
    };
  });
}
