import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildIdSearchArgs,
  mapSearchRow,
  RECENT_PROFILE_LIMIT,
  type ProfileSearchFnRow,
  type ProfileSearchResult,
} from '@/lib/data/profile-search';

/**
 * RECENT and PINNED — the two lists Search shows when the box is empty
 * (Command Center V2 prompt v2-05, migration 038).
 *
 * WHAT THIS IS NOT: a second query layer. The CARDS come back through the
 * very same `admin_profile_search` the search box uses, called with the id
 * list these two little tables hold (`p_ids`, added in 038). This route owns
 * the shortcut rows and nothing else — which is why it cannot return a
 * different set of fields from the search rail beside it, and why the egress
 * rule holds here for free: the function has no `thumbnail_image` in its
 * return type.
 *
 * ADMIN-ONLY, AND PER-ADMIN. Both tables are keyed on `admin_id` and their
 * RLS policies require `admin_id = auth.uid()` AND `profiles.role='admin'`.
 * Every statement here runs on the CALLER's session — never the service role
 * — so a bug in this file cannot reach another admin's list; the database
 * would refuse it.
 */
export const dynamic = 'force-dynamic';

type Shortcut = { profile_id: string };

async function cardsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<ProfileSearchResult[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc('admin_profile_search', buildIdSearchArgs(ids));
  if (error) throw error;
  return ((data ?? []) as ProfileSearchFnRow[]).map(mapSearchRow);
}

async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string } | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { userId: user.id };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const gate = await requireAdmin(supabase);
    if (gate instanceof NextResponse) return gate;

    const [recentRows, pinnedRows] = await Promise.all([
      supabase
        .from('admin_recent_profiles')
        .select('profile_id')
        .eq('admin_id', gate.userId)
        .order('opened_at', { ascending: false })
        .limit(RECENT_PROFILE_LIMIT),
      supabase
        .from('admin_pinned_profiles')
        .select('profile_id')
        .eq('admin_id', gate.userId)
        .order('pinned_at', { ascending: false }),
    ]);

    const recentIds = ((recentRows.data ?? []) as Shortcut[]).map((r) => r.profile_id);
    const pinnedIds = ((pinnedRows.data ?? []) as Shortcut[]).map((r) => r.profile_id);

    const [recent, pinned] = await Promise.all([cardsFor(supabase, recentIds), cardsFor(supabase, pinnedIds)]);

    return NextResponse.json({ recent, pinned, pinnedIds });
  } catch {
    return NextResponse.json({ error: 'Could not load your lists.' }, { status: 500 });
  }
}

/**
 * `open` records a Select, `pin`/`unpin` toggle the star.
 *
 * RECENT IS TRIMMED HERE, not by a trigger: ten is a presentation decision,
 * and burying it in the database would make "why did my eleventh disappear"
 * a question only a DBA could answer. The delete is scoped to this admin's
 * own rows and to ids outside the newest ten — RLS would refuse anything
 * else anyway.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const gate = await requireAdmin(supabase);
    if (gate instanceof NextResponse) return gate;

    const body = (await request.json().catch(() => null)) as {
      action?: string;
      profileId?: string;
    } | null;
    const action = body?.action;
    const profileId = body?.profileId ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
      return NextResponse.json({ error: 'Bad profile id.' }, { status: 400 });
    }

    if (action === 'open') {
      const { error } = await supabase
        .from('admin_recent_profiles')
        .upsert(
          { admin_id: gate.userId, profile_id: profileId, opened_at: new Date().toISOString() },
          { onConflict: 'admin_id,profile_id' }
        );
      if (error) return NextResponse.json({ error: 'Could not record that.' }, { status: 500 });

      const { data: keep } = await supabase
        .from('admin_recent_profiles')
        .select('profile_id')
        .eq('admin_id', gate.userId)
        .order('opened_at', { ascending: false })
        .limit(RECENT_PROFILE_LIMIT);
      const keepIds = ((keep ?? []) as Shortcut[]).map((r) => r.profile_id);
      if (keepIds.length === RECENT_PROFILE_LIMIT) {
        await supabase
          .from('admin_recent_profiles')
          .delete()
          .eq('admin_id', gate.userId)
          .not('profile_id', 'in', `(${keepIds.join(',')})`);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'pin') {
      const { error } = await supabase
        .from('admin_pinned_profiles')
        .upsert({ admin_id: gate.userId, profile_id: profileId }, { onConflict: 'admin_id,profile_id' });
      if (error) return NextResponse.json({ error: 'Could not pin that.' }, { status: 500 });
      return NextResponse.json({ ok: true, pinned: true });
    }

    if (action === 'unpin') {
      const { error } = await supabase
        .from('admin_pinned_profiles')
        .delete()
        .eq('admin_id', gate.userId)
        .eq('profile_id', profileId);
      if (error) return NextResponse.json({ error: 'Could not unpin that.' }, { status: 500 });
      return NextResponse.json({ ok: true, pinned: false });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }
}
