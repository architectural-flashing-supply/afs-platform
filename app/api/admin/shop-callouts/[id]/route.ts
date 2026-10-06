import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { getCalloutById, softDeleteCallout, updateCallout } from '@/lib/data/shop-callouts';
import { validateUpdate } from '@/lib/shop-callouts/validate';

/**
 * ONE SHOP CALLOUT — edit the note, drag the arrow, or soft-delete it.
 *
 * ADMIN ONLY, CHECKED HERE, on both verbs. The shop floor holds SELECT only
 * (migration 051), so an operator reaching this route is refused twice over:
 * by the role check below and by RLS underneath it.
 *
 * DELETE IS A SOFT DELETE. The row stays with `deleted_at` set. What the shop
 * was told, and when, is part of the record of how a part came to be bent —
 * and a hard delete would also make the audit row point at nothing.
 *
 * `force-dynamic` for the reason in the sibling route's header.
 */
export const dynamic = 'force-dynamic';

async function requireAdminId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user.id;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const adminId = await requireAdminId(supabase);
    if (adminId instanceof NextResponse) return adminId;

    const raw: unknown = await request.json().catch(() => null);
    const parsed = validateUpdate(raw);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const before = await getCalloutById(supabase, params.id);
    if (!before) return NextResponse.json({ error: 'That note no longer exists.' }, { status: 404 });

    const result = await updateCallout(supabase, params.id, parsed.value);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAdminAction({
      adminId,
      action: 'update_shop_callout',
      resourceType: 'shop_callout',
      resourceId: params.id,
      beforeValue: { note: before.note, tailDx: before.tail_dx, tailDy: before.tail_dy },
      afterValue: parsed.value as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Shop Callout PATCH Error]', error);
    return NextResponse.json({ error: 'The change was not saved.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const adminId = await requireAdminId(supabase);
    if (adminId instanceof NextResponse) return adminId;

    const before = await getCalloutById(supabase, params.id);
    if (!before) return NextResponse.json({ error: 'That note no longer exists.' }, { status: 404 });

    const result = await softDeleteCallout(supabase, params.id);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction({
      adminId,
      action: 'delete_shop_callout',
      resourceType: 'shop_callout',
      resourceId: params.id,
      beforeValue: { note: before.note },
      afterValue: { deleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Shop Callout DELETE Error]', error);
    return NextResponse.json({ error: 'The note was not deleted.' }, { status: 500 });
  }
}
