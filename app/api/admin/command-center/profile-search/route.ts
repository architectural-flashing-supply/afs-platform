import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSearchArgs, type ProfileSearchResult } from '@/lib/data/profile-search';

/**
 * ADMIN profile search across ALL customers (Part 2, 2026-09-30).
 *
 * Admin-only by a SERVER-SIDE role check, not by UI hiding. Customers keep
 * their RLS-scoped access to their own profiles through the ordinary Profile
 * Passport routes; this is the only cross-customer view, and it returns 403
 * to anyone whose profiles.role is not 'admin'.
 *
 * The query is the parameterized Postgres function admin_profile_search
 * (029), which re-checks admin itself — defence in depth, so this route
 * forgetting the check could not open the door.
 *
 * EGRESS: rows carry no geometry and no thumbnail_image, only hasThumbnail,
 * so the client lazy-loads each thumbnail from ./thumbnail/<id> as it
 * actually scrolls into view.
 */
export const dynamic = 'force-dynamic';

interface SearchFnRow {
  id: string;
  name: string;
  company: string | null;
  person: string | null;
  profile_type: string | null;
  material: string | null;
  gauge: string | null;
  length_ft: number | null;
  quantity: number | null;
  created_at: string;
  geometry_fingerprint: string | null;
  same_shape_count: number;
  bend_count: number;
  hem_count: number;
  status: string | null;
  pathfinder_profile_id: string | null;
  has_thumbnail: boolean;
}

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

    const rows = (data ?? []) as SearchFnRow[];
    const results: ProfileSearchResult[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      company: r.company,
      person: r.person,
      profileType: r.profile_type,
      material: r.material,
      gauge: r.gauge,
      lengthFt: r.length_ft,
      quantity: r.quantity,
      createdAt: r.created_at,
      fingerprint: r.geometry_fingerprint,
      sameShapeCount: r.same_shape_count,
      bendCount: r.bend_count,
      hemCount: r.hem_count,
      status: r.status,
      pathfinderProfileId: r.pathfinder_profile_id,
      hasThumbnail: r.has_thumbnail,
    }));

    return NextResponse.json({ results, limit: args.p_limit, offset: args.p_offset });
  } catch {
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
