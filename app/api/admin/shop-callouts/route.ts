import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import {
  getCalloutsForQuoteItem,
  insertCallout,
  markOrphaned,
  parseGeometryPoints,
} from '@/lib/data/shop-callouts';
import { validateCreate } from '@/lib/shop-callouts/validate';
import type { CalloutPoint } from '@/lib/shop-callouts/geometry';

/**
 * SHOP CALLOUTS — list and create. ADMIN ONLY, CHECKED HERE.
 *
 * ============ THIS ROUTE IS ALSO THE AUTHORING GATE ============
 *
 * FlashDraft (`app/studio/draft/page.tsx`) is ONE component serving both the
 * public customer tool and the admin session the Command Center opens with
 * `?admin=1`. `?admin=1` is a URL flag and grants nothing — a customer can type
 * it. So the callout layer does not mount on that flag: it mounts only after
 * THIS route answers 200 to a GET. A non-admin gets 403 here, the layer never
 * mounts, its chunk is never fetched, and there is nothing on the page to
 * author with. The gate is a server answer, not a query parameter.
 *
 * ============ company_id AND created_by COME FROM THE SESSION ============
 *
 * Never from the body. `validateCreate` does not even parse those names, so
 * there is no field for a forged value to arrive in; the insert reads them off
 * the authenticated profile.
 *
 * ============ force-dynamic ============
 *
 * CLAUDE.md rule #22 one layer up, and the defect SESSION_STATE.md records for
 * 2026-10-03: an admin GET without this was served from Next's route cache to
 * an unauthenticated caller, 200, with another customer's job on it. The admin
 * check ran once for the first authorised caller and every later request was
 * answered from the cached body.
 */
export const dynamic = 'force-dynamic';

interface Session {
  userId: string;
  companyId: string | null;
}

async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Session | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();
  const p = profile as { role?: string; company_id?: string | null } | null;
  if (p?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return { userId: user.id, companyId: p.company_id ?? null };
}

/**
 * GET /api/admin/shop-callouts?quoteRequestId=<id>&item=<n>
 *
 * Answers with the live callouts for that drawing, each already resolved
 * against the geometry stored on the job's line item — so a callout whose leg
 * was deleted comes back `anchorStatus: 'orphaned'` with its note intact, and
 * the canvas can say "Anchor changed — re-place" instead of losing it.
 *
 * It also RECONCILES the stored `orphaned` flag, which is why this is the
 * admin read and not the shop one: the shop floor holds SELECT only (migration
 * 051) and must never be the thing that writes a flag.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const session = await requireAdmin(supabase);
    if (session instanceof NextResponse) return session;

    const quoteRequestId = request.nextUrl.searchParams.get('quoteRequestId');
    if (!quoteRequestId) {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }
    const rawItem = Number(request.nextUrl.searchParams.get('item') ?? '0');
    const lineItemIndex = Number.isInteger(rawItem) && rawItem >= 0 ? rawItem : 0;

    // The job's own stored geometry, so a resolve happens against what is
    // RECORDED rather than against whatever is currently on somebody's canvas.
    const { data: qr } = await supabase
      .from('quote_requests')
      .select('id, line_items')
      .eq('id', quoteRequestId)
      .maybeSingle();
    const row = qr as { id: string; line_items: unknown } | null;
    if (!row) return NextResponse.json({ error: 'That job does not exist.' }, { status: 404 });

    const points = pointsFromLineItem(row.line_items, lineItemIndex);
    const { callouts, unreadable } = await getCalloutsForQuoteItem(
      supabase,
      quoteRequestId,
      lineItemIndex,
      points
    );

    // Reconcile the persisted flag with what the geometry says now. Two small
    // updates at most, and only when something actually changed. Skipped
    // entirely when the read failed — there is nothing to reconcile against.
    if (!unreadable) {
      const nowOrphaned = callouts.filter((c) => c.anchorStatus === 'orphaned' && !c.orphaned).map((c) => c.id);
      const nolonger = callouts.filter((c) => c.anchorStatus !== 'orphaned' && c.orphaned).map((c) => c.id);
      if (nowOrphaned.length) await markOrphaned(supabase, nowOrphaned, true);
      if (nolonger.length) await markOrphaned(supabase, nolonger, false);
    }

    return NextResponse.json({
      callouts: callouts.map((c) =>
        c.anchorStatus === 'orphaned' ? { ...c, orphaned: true } : { ...c, orphaned: false }
      ),
      points,
      // A FAILED READ IS NOT AN EMPTY LIST. The gate still answers 200 — the
      // caller IS an admin and the job DOES exist — but it says plainly that
      // the notes are unknown rather than letting an empty array imply none.
      unreadable,
    });
  } catch (error) {
    console.error('[Shop Callouts GET Error]', error);
    return NextResponse.json({ error: 'Could not read the shop notes.' }, { status: 500 });
  }
}

/** POST — create one callout. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const session = await requireAdmin(supabase);
    if (session instanceof NextResponse) return session;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = validateCreate(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await insertCallout(supabase, parsed.value, {
      createdBy: session.userId,
      companyId: session.companyId,
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });

    await logAdminAction({
      adminId: session.userId,
      action: 'create_shop_callout',
      resourceType: 'shop_callout',
      resourceId: result.id,
      afterValue: {
        quoteRequestId: parsed.value.quoteRequestId,
        lineItemIndex: parsed.value.lineItemIndex,
        shopJobId: parsed.value.shopJobId,
        segmentIndex: parsed.value.segmentIndex,
        t: parsed.value.t,
        note: parsed.value.note,
      },
    });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error('[Shop Callouts POST Error]', error);
    return NextResponse.json({ error: 'The note was not saved.' }, { status: 500 });
  }
}

/**
 * The `points` on one line item of a quote request.
 *
 * Deliberately NOT importing FlashDraft's handoff parser: that module's job is
 * to decide what KIND of handoff a job can offer (geometry / reference /
 * metadata) and it would pull a much larger contract in for one array. This
 * reads the one field, parses it rather than casting it, and yields an empty
 * polyline when there is none — which the resolver already handles by keeping
 * the note and dropping the arrow.
 */
function pointsFromLineItem(lineItems: unknown, index: number): CalloutPoint[] {
  if (!Array.isArray(lineItems)) return [];
  const item = lineItems[index];
  if (!item || typeof item !== 'object') return [];
  return parseGeometryPoints((item as Record<string, unknown>).points);
}
