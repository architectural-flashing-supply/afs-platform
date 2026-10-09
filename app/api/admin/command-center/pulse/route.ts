import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * HAS ANYTHING ARRIVED OR MOVED? — a few bytes, so the Workbench can ask often.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE REGRESSION THIS EXISTS TO FIX.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A photo taken in the field app used to reach Steve's Command Center within
 * seconds. Diagnosed 2026-10-09 against the live database: the Workbench polls
 * `router.refresh()` on a `REFRESH_MS = 60_000` timer and nothing else — no
 * Supabase realtime subscription exists on that screen. So a field photo could
 * take a full minute to appear, averaging half of one. "Within seconds" was not
 * slow, it was impossible by construction.
 *
 * WHY NOT REALTIME. `supabase_realtime` has no `ALTER PUBICATION … ADD TABLE`
 * for `quote_requests` anywhere in `supabase/migrations/`, so the table does not
 * publish changes, and adding it would be a migration against production — which
 * this run is explicitly forbidden from applying. Short polling is the other
 * option the instruction allows, and it is what this is.
 *
 * WHY NOT JUST POLL `router.refresh()` EVERY FIVE SECONDS. That re-runs the
 * whole Workbench server component — several queries, every lane, every card —
 * twelve times a minute per open tab, to answer a question whose answer is
 * almost always "nothing changed". This endpoint answers that question with two
 * indexed aggregates and a count, and the client only calls `router.refresh()`
 * when the signature actually moves.
 *
 * `stage_changed_at` AND `submitted_at` BOTH, because they catch different
 * things: a brand-new arrival moves the second, and a job advancing a lane
 * moves the first. A signature built on one of them would miss half the events
 * it exists to notice. The COUNT catches a deletion, which moves neither.
 *
 * Admin-only and `force-dynamic`: it reports on another customer's jobs, and a
 * cached pulse is a pulse that never changes.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  const [newest, moved, counted] = await Promise.all([
    admin.from('quote_requests').select('submitted_at').order('submitted_at', { ascending: false }).limit(1),
    admin
      .from('quote_requests')
      .select('stage_changed_at')
      .order('stage_changed_at', { ascending: false, nullsFirst: false })
      .limit(1),
    admin.from('quote_requests').select('id', { count: 'exact', head: true }),
  ]);

  const latestArrival =
    (newest.data as { submitted_at: string }[] | null)?.[0]?.submitted_at ?? '';
  const latestMove =
    (moved.data as { stage_changed_at: string | null }[] | null)?.[0]?.stage_changed_at ?? '';

  return NextResponse.json(
    {
      // One opaque string the client compares. Its parts are only interesting
      // when somebody is reading a log.
      signature: `${counted.count ?? 0}|${latestArrival}|${latestMove}`,
      count: counted.count ?? 0,
      latestArrival,
      latestMove,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
