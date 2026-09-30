import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * ONE shop job's drawing, by id, fetched lazily.
 *
 * `shop_profile_library.geometry_svg` is misnamed: it holds a base64 PNG data
 * URI, measured live against this database at 70KB–786KB a row. Shop View
 * shows the queue as a list of large cards and polls itself, so
 * server-rendering those images would put megabytes into the HTML of a page
 * that refreshes every thirty seconds. Each card asks for its own drawing once
 * it scrolls into view instead.
 *
 * This is the exact pattern app/api/admin/command-center/profile-thumbnail/
 * [id] already established for the Job screen's past-profile tiles (see its
 * own header) — same reason, same shape, same private cache header. A drawing
 * never changes once a profile has been sent to the machine, so an hour of
 * private caching is safe and saves the repeat fetch on every poll.
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

  const { data, error } = await supabase
    .from('shop_profile_library')
    .select('geometry_svg')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Lookup failed.' }, { status: 502 });
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  return NextResponse.json(
    { drawing: (data as { geometry_svg: string | null }).geometry_svg },
    { headers: { 'Cache-Control': 'private, max-age=3600' } }
  );
}
