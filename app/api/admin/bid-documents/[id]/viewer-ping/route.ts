import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';

/**
 * Presence heartbeat (BID_DOCUMENT_SCOPE.md §3.7) — upserted every 20s while
 * the builder page is mounted. DELETE is a best-effort unmount cleanup call;
 * staleness filtering in GET .../viewers (last_seen_at within 60s) is the
 * real mechanism, since a closed tab won't always fire the DELETE.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const { error } = await supabase
      .from('bid_document_viewers')
      .upsert({ bid_id: params.id, user_id: auth.userId, last_seen_at: new Date().toISOString() }, { onConflict: 'bid_id,user_id' });
    if (error) {
      console.error('[Bid Viewer Ping Error]', error);
      return NextResponse.json({ error: 'Could not record presence.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Bid Viewer Ping Error]', error);
    return NextResponse.json({ error: 'Could not record presence.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    await supabase.from('bid_document_viewers').delete().eq('bid_id', params.id).eq('user_id', auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Bid Viewer Ping Delete Error]', error);
    return NextResponse.json({ ok: true });
  }
}
