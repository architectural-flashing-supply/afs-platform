import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
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

    if (orderRaw.status === 'delivered') {
      return NextResponse.json({ error: 'Order is already marked delivered.' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: nowIso, updated_at: nowIso })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Delivered Error]', updateError);
      return NextResponse.json({ error: 'Could not mark order delivered. Please try again.' }, { status: 500 });
    }

    await admin.from('order_status_history').insert({
      order_id: params.id,
      status: 'delivered',
      changed_by: auth.userId,
      note: null,
    });

    // No separate Supabase Realtime broadcast is fired here — the Employee
    // PWA's GPS loop and the customer tracking page both already key their
    // stop/live-dot behavior directly off orders.status (updated above, and
    // for the tracking page, off get_tracking_data()'s own order_status
    // column) — per this task's own "(or simply let PWA stop on this
    // status)" alternative, a dedicated broadcast channel would just be a
    // second source of truth for the exact same fact.
    await logAdminAction({
      adminId: auth.userId,
      action: 'mark_order_delivered',
      resourceType: 'order',
      resourceId: params.id,
      beforeValue: { status: orderRaw.status },
      afterValue: { status: 'delivered' },
    });

    return NextResponse.json({ delivered: true });
  } catch (error) {
    console.error('[Delivered Route Error]', error);
    return NextResponse.json({ error: 'Could not mark order delivered. Please try again.' }, { status: 500 });
  }
}
