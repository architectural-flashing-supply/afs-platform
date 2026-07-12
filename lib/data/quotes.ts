import type { SupabaseClient } from '@supabase/supabase-js';

export type QuoteRowStatus = 'pending' | 'ready' | 'quoted' | 'expired' | 'cancelled';

export interface QuoteRow {
  id: string;              // routable id — /account/quotes/{id}
  requestNumber: string;
  quoteNumber: string | null;
  profilesSummary: string;
  submittedAt: string;
  status: QuoteRowStatus;
}

interface StoredLineItem {
  profileType?: string;
}

export function summarizeProfiles(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return 'Custom specification';
  const first = (items[0] as StoredLineItem)?.profileType ?? 'Item';
  if (items.length === 1) return first;
  return `${first} + ${items.length - 1} more`;
}

function resolveLinkedQuoteStatus(quoteStatus: string): QuoteRowStatus {
  if (quoteStatus === 'sent') return 'ready';
  if (quoteStatus === 'approved' || quoteStatus === 'converted') return 'quoted';
  if (quoteStatus === 'expired') return 'expired';
  if (quoteStatus === 'cancelled') return 'cancelled';
  return 'pending';
}

/**
 * Merges a customer's quote_requests with any linked formal quotes into a single
 * status-aware list. Draft quotes are invisible via RLS, so a quote_id that hasn't
 * been sent yet naturally falls back to "pending" — matching what the customer sees.
 */
export async function getQuoteRows(
  supabase: SupabaseClient,
  userId: string,
  limit?: number,
  projectId?: string
): Promise<QuoteRow[]> {
  let query = supabase
    .from('quote_requests')
    .select('id, request_number, status, submitted_at, quote_id, line_items')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (limit) query = query.limit(limit);

  const { data: requests } = await query;
  if (!requests || requests.length === 0) return [];

  const quoteIds = requests
    .map((r: { quote_id: string | null }) => r.quote_id)
    .filter((id: string | null): id is string => Boolean(id));

  const quotesById = new Map<string, { id: string; quote_number: string; status: string }>();
  if (quoteIds.length > 0) {
    const { data: linkedQuotes } = await supabase
      .from('quotes')
      .select('id, quote_number, status')
      .in('id', quoteIds);
    for (const q of linkedQuotes ?? []) quotesById.set(q.id, q);
  }

  return requests.map(
    (r: {
      id: string;
      request_number: string;
      status: string;
      submitted_at: string;
      quote_id: string | null;
      line_items: unknown;
    }) => {
      const linkedQuote = r.quote_id ? quotesById.get(r.quote_id) : undefined;

      const status: QuoteRowStatus = linkedQuote
        ? resolveLinkedQuoteStatus(linkedQuote.status)
        : r.status === 'expired'
        ? 'expired'
        : r.status === 'cancelled'
        ? 'cancelled'
        : 'pending';

      const row: QuoteRow = {
        id: linkedQuote ? linkedQuote.id : r.id,
        requestNumber: r.request_number,
        quoteNumber: linkedQuote?.quote_number ?? null,
        profilesSummary: summarizeProfiles(r.line_items),
        submittedAt: r.submitted_at,
        status,
      };
      return row;
    }
  );
}

export const QUOTE_STATUS_LABEL: Record<QuoteRowStatus, string> = {
  pending: 'Pending Review',
  ready: 'Quote Ready',
  quoted: 'Quoted',
  expired: 'Expired',
  cancelled: 'Cancelled',
};
