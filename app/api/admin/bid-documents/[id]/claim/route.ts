import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * Unconditionally sets claimed_by/claimed_at/last_activity_at to the caller,
 * overwriting whoever currently holds the claim — per explicit business
 * instruction (BID_DOCUMENT_SCOPE.md §3.1), this is not admin-gated and
 * there is no 409 "already claimed" response. Called automatically by the
 * builder page on mount when the bid reads as unclaimed (no explicit click
 * needed), and by an explicit "Take Over" button when it's actively claimed
 * by someone else.
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

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('bid_documents')
      .update({ claimed_by: auth.userId, claimed_at: now, last_activity_at: now })
      .eq('id', params.id);
    if (error) {
      console.error('[Bid Claim Error]', error);
      return NextResponse.json({ error: 'Could not claim this bid. Please try again.' }, { status: 500 });
    }

    const previousClaimedBy = existing.claimed_by as string | null;
    await logAdminAction({
      adminId: auth.userId,
      action:
        previousClaimedBy && previousClaimedBy !== auth.userId ? 'transfer_bid_document_claim' : 'claim_bid_document',
      resourceType: 'bid_documents',
      resourceId: params.id,
      beforeValue: { claimedBy: previousClaimedBy },
      afterValue: { claimedBy: auth.userId },
    });

    return NextResponse.json({ claimedBy: auth.userId, claimedAt: now });
  } catch (error) {
    console.error('[Bid Claim Error]', error);
    return NextResponse.json({ error: 'Could not claim this bid. Please try again.' }, { status: 500 });
  }
}
