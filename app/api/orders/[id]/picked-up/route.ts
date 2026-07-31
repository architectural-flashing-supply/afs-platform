import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { logAdminAction } from '@/lib/admin/audit';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://afs-website-alpha.vercel.app';

interface PickedUpOrderRecord {
  id: string;
  order_number: string;
  status: string;
  user_id: string;
  delivery_method: string;
  delivery_address: { contactName?: string } | null;
}

/**
 * Pickup counterpart to app/api/orders/[id]/delivered — per
 * PICKUP_SCHEDULING_SCOPE.md item 4, "picked up" reuses the existing
 * `delivered` terminal status rather than adding a new orders.status value,
 * so it slots into every existing "is this order done" check
 * (ACTIVE_ORDER_STATUSES, getProductionQueue, account/page.tsx) for free.
 * The order_status_history note is what actually distinguishes a pickup
 * from a shipped delivery in the timeline.
 */
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
      .select('id, order_number, status, user_id, delivery_method, delivery_address')
      .eq('id', params.id)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderRaw as PickedUpOrderRecord;

    if (order.delivery_method !== 'pickup') {
      return NextResponse.json({ error: 'This order is not set up for pickup.' }, { status: 400 });
    }
    if (order.status === 'delivered') {
      return NextResponse.json({ error: 'Order is already marked picked up.' }, { status: 409 });
    }
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Order is cancelled.' }, { status: 409 });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: nowIso, updated_at: nowIso })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Picked Up Error]', updateError);
      return NextResponse.json({ error: 'Could not mark order picked up. Please try again.' }, { status: 500 });
    }

    const contactName = order.delivery_address?.contactName;
    await admin.from('order_status_history').insert({
      order_id: params.id,
      status: 'delivered',
      changed_by: auth.userId,
      note: contactName ? `Picked up by ${contactName}` : 'Picked up by customer',
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
        subject: `Your AFS Order #${order.order_number} Has Been Picked Up`,
        html: baseEmailTemplate(`
          <h1 style="font-size:20px;margin:0 0 16px;">Pickup Confirmed</h1>
          <p style="margin:0 0 12px;">Hi ${customerProfile?.full_name ?? 'there'},</p>
          <p style="margin:0 0 12px;">Order <strong>#${order.order_number}</strong> has been picked up.
          Thank you for choosing AFS.</p>
          ${ctaButton(`${APP_URL}/account/orders/${order.id}`, 'View Order')}
        `),
      });
      await admin.from('notifications').insert({
        order_id: order.id,
        user_id: order.user_id,
        channel: 'email',
        type: 'pickup_email',
        recipient: email,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.success ? null : emailResult.error,
      });
    }

    await logAdminAction({
      adminId: auth.userId,
      action: 'mark_order_picked_up',
      resourceType: 'order',
      resourceId: params.id,
      beforeValue: { status: order.status },
      afterValue: { status: 'delivered' },
    });

    return NextResponse.json({ pickedUp: true });
  } catch (error) {
    console.error('[Picked Up Route Error]', error);
    return NextResponse.json({ error: 'Could not mark order picked up. Please try again.' }, { status: 500 });
  }
}
