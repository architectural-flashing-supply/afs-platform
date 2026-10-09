import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveJobProfileSource, resolveSavedProfileSource } from '@/lib/data/v8-profile-source';

/**
 * WHAT PICTURE DOES THIS ITEM HAVE? — the one endpoint the V8 viewer asks.
 *
 * `?for=job:<uuid>` or `?for=profile:<uuid>`, optionally `&item=<n>` to pick a
 * specific line item. Returns the four-way union from
 * `lib/data/v8-profile-source.ts`: real geometry, the real photograph on a
 * signed URL, the real saved PNG, or an explicit to-do.
 *
 * A 200 EVERY TIME, carrying `kind`. An absent drawing is a real answer the
 * Workbench puts on a to-do list, not an error condition — and a 404 here would
 * make an honest "nothing drawn yet" indistinguishable from a broken route.
 *
 * ADMIN ONLY, checked on the caller's own session BEFORE the service role is
 * used for anything, and `force-dynamic` so no response is ever cached: this
 * returns another customer's photograph on a signed URL, and an admin GET route
 * in this codebase was once served from Next's route cache to an
 * unauthenticated caller (SESSION_STATE.md, 2026-10-03).
 *
 * THE SIGNED URL IS WHY `Cache-Control: no-store` IS NOT OPTIONAL. It expires;
 * a cached body would hand out a dead link, and a shared cache would hand one
 * customer's photo to whoever asked next.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const forParam = request.nextUrl.searchParams.get('for') ?? '';
  const sep = forParam.indexOf(':');
  const kind = sep > 0 ? forParam.slice(0, sep) : '';
  const id = sep > 0 ? forParam.slice(sep + 1) : '';

  const rawItem = request.nextUrl.searchParams.get('item');
  const itemIndex = rawItem !== null && /^\d+$/.test(rawItem) ? Number(rawItem) : undefined;

  const headers = { 'Cache-Control': 'no-store' };

  if (kind === 'job') {
    return NextResponse.json(await resolveJobProfileSource({ jobId: id, itemIndex }), { headers });
  }
  if (kind === 'profile') {
    return NextResponse.json(await resolveSavedProfileSource(id), { headers });
  }
  return NextResponse.json(
    { error: 'Ask for `job:<uuid>` or `profile:<uuid>`.' },
    { status: 400, headers },
  );
}
