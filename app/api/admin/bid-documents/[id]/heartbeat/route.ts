import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';

/**
 * Called every 2 minutes by the builder page while mounted and claimed by
 * self (a client-side setInterval; the MachineBridgeStatusDot that set this
 * precedent was deleted 2026-09-30 with the rest of the retired Machine
 * Bridge UI). If
 * someone else now holds the claim — another tab took over since this page
 * loaded — makes no write and reports stillClaimed: false so the client can
 * flip to read-only without waiting for the Realtime subscription
 * (belt-and-suspenders; BID_DOCUMENT_SCOPE.md §3.4/§3.6 cover both paths).
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

    if (existing.claimed_by !== auth.userId) {
      let claimedByName: string | null = null;
      if (existing.claimed_by) {
        const { data: claimantProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', existing.claimed_by)
          .maybeSingle();
        claimedByName = (claimantProfile?.full_name as string | undefined) ?? null;
      }
      return NextResponse.json({ stillClaimed: false, claimedBy: claimedByName });
    }

    const { error } = await supabase
      .from('bid_documents')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) {
      console.error('[Bid Heartbeat Error]', error);
      return NextResponse.json({ error: 'Could not record activity.' }, { status: 500 });
    }

    return NextResponse.json({ stillClaimed: true });
  } catch (error) {
    console.error('[Bid Heartbeat Error]', error);
    return NextResponse.json({ error: 'Could not record activity.' }, { status: 500 });
  }
}
