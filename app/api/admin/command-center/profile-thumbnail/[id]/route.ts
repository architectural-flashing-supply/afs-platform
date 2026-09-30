import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * ONE profile's thumbnail, by id (Part 2, 2026-09-30).
 *
 * Exists so search results can stay lightweight: thumbnail_image is a base64
 * PNG that regularly exceeds 100KB, and returning 24 of them per search was
 * the single largest avoidable egress cost in the Command Center. The client
 * calls this per item as it scrolls into view.
 *
 * Admin-only, same server-side role check as the search route. Cached
 * privately for an hour — a saved profile's drawing does not change (a
 * modification creates a new row, see Part 1), so this is safely cacheable
 * per admin session.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  }

  // Service role: the point of this endpoint is cross-customer admin access,
  // which RLS correctly denies to the admin's own session.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Not configured.' }, { status: 500 });

  const res = await fetch(
    `${url}/rest/v1/saved_configurations?id=eq.${params.id}&select=thumbnail_image,dimensions`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
  );
  if (!res.ok) return NextResponse.json({ error: 'Lookup failed.' }, { status: 502 });
  const rows = (await res.json()) as { thumbnail_image: string | null; dimensions: { points?: unknown } | null }[];
  if (!rows.length) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json(
    {
      thumbnailImage: rows[0].thumbnail_image,
      // Vector fallback so a row with no captured screenshot still renders.
      points: Array.isArray(rows[0].dimensions?.points) ? rows[0].dimensions!.points : null,
    },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  );
}
