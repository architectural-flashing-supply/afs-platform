import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// force-dynamic: this route reads the database at request time, which the
// build-time prerender pass cannot do.
export const dynamic = 'force-dynamic';

interface CanonicalProfileRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  blank_width_in: number;
  points: { x: number; y: number }[];
  bends: { leftLegIn: number; rightLegIn: number; angleDegrees: number; direction: 'up' | 'down' }[];
  tags: string[];
  sort_order: number;
}

// Public resource — canonical profiles are hand-crafted reference geometry,
// not shop job history, so there is no private-row concept here. The
// service-role client is used anyway so anonymous FlashDraft visitors can
// browse without an auth.uid() session for RLS to match.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let query = admin
    .from('canonical_profiles')
    .select('id, name, slug, category, description, blank_width_in, points, bends, tags, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query.returns<CanonicalProfileRow[]>();

  if (error) {
    return NextResponse.json({ error: 'Failed to load canonical profiles.' }, { status: 500 });
  }

  const profiles = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    blankWidthIn: row.blank_width_in,
    points: row.points,
    bends: row.bends,
    tags: row.tags,
    sortOrder: row.sort_order,
  }));

  return NextResponse.json({ profiles });
}
