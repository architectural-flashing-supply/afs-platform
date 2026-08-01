import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { nextBidNumber } from '@/lib/data/bid-documents';

/**
 * Creates a new bid document from the Command Center "Bids" tab's "+ New
 * Bid" form. Only the two NOT NULL, non-system columns are collected here —
 * everything else (GC contact info, price validity, sections/line items) is
 * filled in on the detail/builder page. requireOperatorApi, not admin-only,
 * per BID_DOCUMENT_SCOPE.md §0.2.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const projectName = typeof body.projectName === 'string' ? body.projectName.trim() : '';
    const gcName = typeof body.gcName === 'string' ? body.gcName.trim() : '';

    if (!projectName || !gcName) {
      return NextResponse.json({ error: 'Project name and GC name are both required.' }, { status: 400 });
    }

    const bidNumber = await nextBidNumber(supabase);

    const { data: bid, error } = await supabase
      .from('bid_documents')
      .insert({
        bid_number: bidNumber,
        status: 'draft',
        project_name: projectName,
        gc_name: gcName,
        created_by: auth.userId,
      })
      .select('id, bid_number')
      .single();

    if (error || !bid) {
      console.error('[Bid Document Create Error]', error);
      return NextResponse.json({ error: 'Could not create this bid. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ bidId: bid.id, bidNumber: bid.bid_number });
  } catch (error) {
    console.error('[Bid Document Create Error]', error);
    return NextResponse.json({ error: 'Could not create this bid. Please try again.' }, { status: 500 });
  }
}
