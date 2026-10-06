import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getShopCalloutSetForShopJob } from '@/lib/data/shop-callouts';

/**
 * THE SHOP FLOOR'S READ — one job's notes and the geometry to draw them on.
 *
 * READ-ONLY, AND THAT IS THE WHOLE POINT. There is no POST, PATCH or DELETE in
 * this file and there must never be one. The shop reads Steve's notes; it does
 * not write them and it cannot silence one. Underneath this route, migration
 * 051 grants the operator role SELECT and nothing else, so even if this file
 * grew a writer it would be refused by Postgres.
 *
 * ============ WHY IT IS NOT UNDER /api/admin ============
 *
 * `admin` and `operator` may both read. Everything under /api/admin in this
 * codebase answers 403 to anything but `role = 'admin'`, and putting an
 * operator-readable endpoint there would make that no longer true of the
 * directory. A customer, a contractor, an architect and an anonymous caller
 * get 403 here.
 *
 * NOTE THE LIVE GAP, HONESTLY: `middleware.ts` gates every `/admin/**` PAGE on
 * `role === 'admin'`, so an `operator`-role account cannot currently reach
 * Shop View itself — today's shop staff sign in with admin accounts (see
 * app/field/shop/page.tsx's own header). This route and the RLS policy are
 * correct for an operator the day one exists; middleware was out of scope for
 * this change and was not touched.
 *
 * ============ WHY THE DRAWING COMES BACK AS POINTS ============
 *
 * `shop_profile_library.geometry_svg` is a 70KB-786KB base64 PNG (CLAUDE.md
 * rule #26) and a PNG cannot carry an arrow at a known position — there is no
 * transform relating its pixels to inches. This returns `geometry_points`, the
 * same array FlashDraft authored against, so an anchor placed in the Command
 * Center resolves here against identical numbers. It is also two orders of
 * magnitude smaller.
 *
 * `force-dynamic` for CLAUDE.md rule #22's reason one layer up: a per-session
 * read served from Next's route cache answers the next caller with the first
 * caller's body.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { shopJobId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== 'admin' && role !== 'operator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const set = await getShopCalloutSetForShopJob(supabase, params.shopJobId);
    return NextResponse.json(set);
  } catch (error) {
    console.error('[Shop Callouts Read Error]', error);
    return NextResponse.json({ error: 'Could not read the shop notes.' }, { status: 500 });
  }
}
