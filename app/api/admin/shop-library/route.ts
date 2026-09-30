import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getShopProfileLibraryFull } from '@/lib/data/shop-library';

/**
 * Read-only listing endpoint for Shop View's (afs-sv-010) 30-second poll —
 * the page itself server-renders the initial set via the same
 * getShopProfileLibraryFull (lib/data/shop-library.ts) call this
 * route makes, so both the first paint and every subsequent poll go
 * through the exact same query and admin gate.
 */
export async function GET(): Promise<NextResponse> {
  try {
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

    const rows = await getShopProfileLibraryFull(supabase);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error('[Shop Profile Library List Error]', error);
    return NextResponse.json({ error: 'Could not load shop profile library.' }, { status: 500 });
  }
}
