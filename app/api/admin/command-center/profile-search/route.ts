import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildSearchArgs,
  mapSearchRow,
  type ProfileSearchFnRow,
  type ProfileSearchResult,
} from '@/lib/data/profile-search';

/**
 * ADMIN profile search across ALL customers (Part 2, 2026-09-30).
 *
 * Admin-only by a SERVER-SIDE role check, not by UI hiding. Customers keep
 * their RLS-scoped access to their own profiles through the ordinary Profile
 * Passport routes; this is the only cross-customer view, and it returns 403
 * to anyone whose profiles.role is not 'admin'.
 *
 * The query is the parameterized Postgres function admin_profile_search
 * (029, extended with an id list in 038), which re-checks admin itself —
 * defence in depth, so this route forgetting the check could not open the
 * door.
 *
 * EGRESS: rows carry no geometry and no thumbnail_image, only hasThumbnail,
 * so the client lazy-loads each thumbnail from ../profile-thumbnail/<id> as
 * it actually scrolls into view. The row->result mapping is the shared
 * `mapSearchRow` (v2-05) rather than a copy, because there are now three
 * callers of the same function and a private copy in each is how one of them
 * quietly starts returning a different shape.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const args = buildSearchArgs((k) => sp.get(k));

    const { data, error } = await supabase.rpc('admin_profile_search', args);
    if (error) {
      // insufficient_privilege from the function's own guard means the role
      // check above and the database disagree — surface it as 403, not 500.
      if (error.code === '42501') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      return NextResponse.json({ error: 'Search failed.', detail: error.message }, { status: 500 });
    }

    const results: ProfileSearchResult[] = ((data ?? []) as ProfileSearchFnRow[]).map(mapSearchRow);

    return NextResponse.json({ results, limit: args.p_limit, offset: args.p_offset });
  } catch {
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
