import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { submitJobToMachine } from '@/lib/integrations/pathfinder-edge';

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
  const body = raw as { profileId?: string; quantity?: number; material?: string; notes?: string };
  if (!body.profileId || typeof body.quantity !== 'number') {
    return NextResponse.json({ error: 'profileId and quantity are required.' }, { status: 400 });
  }

  const result = await submitJobToMachine(body.profileId, body.quantity, body.material ?? '', body.notes ?? '');
  return NextResponse.json(result);
}
