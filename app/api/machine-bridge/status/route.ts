import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Considered "connected" if the bridge has pinged (via pending-jobs polling
// or job-delivered reporting) within 2x its expected poll interval — gives
// one missed poll's worth of slack before the Command Center shows red.
const STALE_AFTER_MS = 90_000;

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data } = await supabase.from('machine_bridge_status').select('last_ping_at').eq('id', true).maybeSingle();
  const lastPingAt = (data as { last_ping_at: string | null } | null)?.last_ping_at ?? null;
  const connected = !!lastPingAt && Date.now() - new Date(lastPingAt).getTime() < STALE_AFTER_MS;

  return NextResponse.json({ connected, lastPingAt });
}
