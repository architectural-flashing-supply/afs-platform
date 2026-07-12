import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { discoverApiEndpoints } from '@/lib/integrations/pathfinder-edge';

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

  const discovery = await discoverApiEndpoints();
  return NextResponse.json({
    connected: discovery.status === 'connected',
    message: discovery.message,
    endpoints: discovery.endpoints,
  });
}
