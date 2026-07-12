import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pushProfileToPathfinder, type MachineProfile } from '@/lib/integrations/pathfinder-edge';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const body = raw as { profile?: MachineProfile; catalogId?: string };
  if (!body.profile || typeof body.catalogId !== 'string') {
    return NextResponse.json({ error: 'profile and catalogId are required.' }, { status: 400 });
  }

  const result = await pushProfileToPathfinder(body.profile, body.catalogId);
  return NextResponse.json(result);
}
