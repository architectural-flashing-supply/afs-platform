import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQuoteOrderRows, companiesFromRows } from '@/lib/data/quote-order-rows';
import { buildTypeahead, TYPEAHEAD_MIN_CHARS } from '@/lib/data/header-typeahead';

export const dynamic = 'force-dynamic';

/**
 * The header type-ahead (v7 `hqShow`, prototype line 1680).
 *
 * Returns two groups in v7's order: COMPANIES matched on the first token, then
 * JOB ROWS matched by the full token-AND query, newest first. Company-first is
 * the design, not an accident — Steve types a company name far more often than
 * a profile word.
 *
 * AUTH. The caller's identity comes from the SESSION, never from the request:
 * the admin check is `profiles.role` for `auth.getUser()`'s own id, and the
 * query string carries nothing but `q`. There is no company/tenant id in the
 * body or the URL to spoof.
 *
 * No new table and no new SQL: this reads the same `quote_requests` the
 * Workbench and both lists read, through `getQuoteOrderRows`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < TYPEAHEAD_MIN_CHARS) {
    return NextResponse.json({ companies: [], rows: [], totalRows: 0, emptyMessage: null });
  }

  const rows = await getQuoteOrderRows(supabase);
  const result = buildTypeahead(companiesFromRows(rows), rows, q);

  return NextResponse.json({
    companies: result.companies,
    // Only the fields the dropdown prints — no line items, no base64.
    rows: result.rows.map((r) => ({
      id: r.id,
      customer: r.customer,
      item: r.item,
      spec: r.spec,
      quantity: r.quantity,
      totalCents: r.totalCents,
      submittedAt: r.submittedAt,
      requestNumber: r.requestNumber,
    })),
    totalRows: result.totalRows,
    emptyMessage: result.emptyMessage,
  });
}
