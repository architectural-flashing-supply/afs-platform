import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';

const STALE_AFTER_MS = 60_000;

interface ViewerSource {
  user_id: string;
  last_seen_at: string;
}

/**
 * Filtered server-side to last_seen_at within 60s — anyone whose ping has
 * gone stale (tab closed, laptop asleep) simply stops appearing, no cleanup
 * job required (BID_DOCUMENT_SCOPE.md §3.7).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const { data } = await supabase.from('bid_document_viewers').select('user_id, last_seen_at').eq('bid_id', params.id);
    const rows = (data ?? []) as ViewerSource[];
    const cutoff = Date.now() - STALE_AFTER_MS;
    const active = rows.filter((row) => new Date(row.last_seen_at).getTime() >= cutoff);

    if (active.length === 0) {
      return NextResponse.json({ viewers: [] });
    }

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in(
        'id',
        active.map((v) => v.user_id)
      );
    const nameById = new Map(((profileRows ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

    return NextResponse.json({
      viewers: active.map((v) => ({
        userId: v.user_id,
        fullName: nameById.get(v.user_id) ?? 'Unknown',
        lastSeenAt: v.last_seen_at,
      })),
    });
  } catch (error) {
    console.error('[Bid Viewers List Error]', error);
    return NextResponse.json({ viewers: [] });
  }
}
