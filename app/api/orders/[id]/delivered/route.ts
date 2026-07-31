import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://afs-website-alpha.vercel.app';

interface DeliveredOrderRecord {
  id: string;
  order_number: string;
  status: string;
  user_id: string;
}

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
      .select('id, order_number, status, user_id')
      .eq('id', params.id)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderRaw as DeliveredOrderRecord;

    if (order.status === 'delivered') {
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

    // --- Customer confirmation email (never blocks the response; ARCHITECTURE.md §9) ---
    const { data: customerProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', order.user_id)
      .maybeSingle();
    const email = customerProfile?.email as string | undefined;
    if (email) {
      const emailResult = await sendEmail({
        to: email,
        subject: `Your AFS Order #${order.order_number} Has Been Delivered`,
        html: baseEmailTemplate(`
          <h1 style="font-size:20px;margin:0 0 16px;">Your Order Has Been Delivered</h1>
          <p style="margin:0 0 12px;">Hi ${customerProfile?.full_name ?? 'there'},</p>
          <p style="margin:0 0 12px;">Order <strong>#${order.order_number}</strong> has been delivered.
          Thank you for choosing AFS.</p>
          ${ctaButton(`${APP_URL}/account/orders/${order.id}`, 'View Order')}
        `),
      });
      await admin.from('notifications').insert({
        order_id: order.id,
        user_id: order.user_id,
        channel: 'email',
        type: 'delivered_email',
        recipient: email,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.success ? null : emailResult.error,
      });
    }

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
      beforeValue: { status: order.status },
      afterValue: { status: 'delivered' },
    });

    return NextResponse.json({ delivered: true });
  } catch (error) {
    console.error('[Delivered Route Error]', error);
    return NextResponse.json({ error: 'Could not mark order delivered. Please try again.' }, { status: 500 });
  }
}
