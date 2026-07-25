import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * Employee PWA "Mark as Packaged" action (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md
 * §3 Screen 3). Mirrors the auth-then-service-role pattern already used by
 * the sibling dispatch/delivered routes — orders has no operator SELECT/UPDATE
 * RLS policy (007_delivery_tracking.sql §1).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const admin = createAdminClient();

    const { data: orderRaw, error: orderError } = await admin
      .from('orders')
      .select('id, status')
      .eq('id', params.id)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (orderRaw.status !== 'in_production' && orderRaw.status !== 'ready') {
      return NextResponse.json(
        { error: `Order cannot be marked packaged from status "${orderRaw.status}".` },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'packaged', packaged_at: nowIso, updated_at: nowIso })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Packaged Error]', updateError);
      return NextResponse.json({ error: 'Could not mark order packaged. Please try again.' }, { status: 500 });
    }

    await admin.from('order_status_history').insert({
      order_id: params.id,
      status: 'packaged',
      changed_by: auth.userId,
      note: null,
    });

    await logAdminAction({
      adminId: auth.userId,
      action: 'mark_order_packaged',
      resourceType: 'order',
      resourceId: params.id,
      beforeValue: { status: orderRaw.status },
      afterValue: { status: 'packaged' },
    });

    return NextResponse.json({ packaged: true });
  } catch (error) {
    console.error('[Packaged Route Error]', error);
    return NextResponse.json({ error: 'Could not mark order packaged. Please try again.' }, { status: 500 });
  }
}
