import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getShopQueue } from '@/lib/data/shop-queue';

/**
 * THE SHOP QUEUE, for Shop View's poll.
 *
 * The tablet by the machine refreshes itself so an operator is never looking
 * at a job somebody else finished five minutes ago. This is what it asks.
 *
 * WHY NOT REUSE /api/admin/shop-library's GET. That one returns
 * `getShopProfileLibraryFull`, which selects `geometry_svg` — a base64 PNG
 * measured live at 70KB–786KB per row. Twenty rows is roughly 6MB, polled
 * every thirty seconds, forever. This returns the queue with a `hasDrawing`
 * flag instead and lets each card fetch its own image once, lazily. The old
 * route is untouched; the Profile Library table still uses it.
 *
 * Admin-only, checked here rather than trusted from middleware — the same
 * belt-and-braces every other admin route in this codebase applies.
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

  const queue = await getShopQueue(supabase);
  return NextResponse.json(queue, { headers: { 'Cache-Control': 'no-store' } });
}
