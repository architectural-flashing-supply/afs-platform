import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * Unconditionally clears claimed_by/claimed_at/last_activity_at. Any
 * eligible user can release any claim, not just their own — same "not
 * admin-gated" reasoning as claim (BID_DOCUMENT_SCOPE.md §3.4).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const { data: existing } = await supabase
      .from('bid_documents')
      .select('id, claimed_by')
      .eq('id', params.id)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Bid document not found.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('bid_documents')
      .update({ claimed_by: null, claimed_at: null, last_activity_at: null })
      .eq('id', params.id);
    if (error) {
      console.error('[Bid Release Error]', error);
      return NextResponse.json({ error: 'Could not release this bid. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: auth.userId,
      action: 'release_bid_document',
      resourceType: 'bid_documents',
      resourceId: params.id,
      beforeValue: { claimedBy: existing.claimed_by as string | null },
      afterValue: { claimedBy: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Bid Release Error]', error);
    return NextResponse.json({ error: 'Could not release this bid. Please try again.' }, { status: 500 });
  }
}
