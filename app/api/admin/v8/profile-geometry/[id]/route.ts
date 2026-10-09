import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSavedProfileGeometry, UUID_RE } from '@/lib/data/v8-profile-geometry';

/**
 * ONE saved FlashDraft profile's GEOMETRY, by id — what the V8 ProfileViewer
 * draws from.
 *
 * WHY IT IS NOT THE EXISTING `profile-thumbnail/[id]` ROUTE. That one returns a
 * base64 PNG screenshot and, as a fallback, the bare `points` array. A PNG
 * cannot be enlarged to full size and read off (it is a thumbnail-resolution
 * capture), and `points` alone loses the hems, the per-bend radii and the
 * material — so a profile with a teardrop hem on each end would render as a
 * bare polyline with its two folds missing. The viewer needs the whole saved
 * record, so this route returns the whole saved record and leaves that route
 * alone for the lazy-thumbnail callers that already use it (rule #26).
 *
 * EGRESS. Numbers only — a few hundred bytes for a typical profile, against
 * 70KB-786KB for one of the base64 images rule #26 exists to keep off list
 * views. There is nothing here to lazy-load around.
 *
 * ADMIN ONLY, checked server-side on the caller's own session before the
 * service role is used for anything; the service role is needed because the
 * profile belongs to a customer and RLS correctly denies an admin's session
 * another customer's row.
 *
 * `force-dynamic` AND the admin check before any read: an admin GET route in
 * this codebase was once served from Next's route cache to an unauthenticated
 * caller, with another customer's job on it (SESSION_STATE.md, 2026-10-03).
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
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

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'That is not a profile id.' }, { status: 400 });
  }

  const result = await getSavedProfileGeometry(params.id);
  // A 200 either way, carrying `kind`. An absent drawing is a real answer the
  // viewer renders in words, not an error condition — and a 404 here would make
  // the component's honest empty state indistinguishable from a broken route.
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
