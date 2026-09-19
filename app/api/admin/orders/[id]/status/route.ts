import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { NOTIFICATION_STAGES, isBackwardMove, isOrderStatus, getStage } from '@/lib/admin/orderStages';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';
import { getSiteUrl } from '@/lib/site-url';

const APP_URL = getSiteUrl();

interface OrderStatusSource {
  id: string;
  order_number: string;
  status: string;
  user_id: string;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const newStatus = typeof body.status === 'string' ? body.status : '';
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    if (!isOrderStatus(newStatus)) {
      return NextResponse.json({ error: 'Unrecognized status.' }, { status: 400 });
    }

    const { data: orderRaw, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, user_id')
      .eq('id', params.id)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderRaw as OrderStatusSource;

    if (order.status === newStatus) {
      return NextResponse.json({ error: 'Order is already in this status.' }, { status: 409 });
    }

    // Backward movement is unusual and must be explained (SPEC_PRODUCTION_TIMELINE.md §8).
    const backward = isBackwardMove(order.status, newStatus);
    if (backward && !note) {
      return NextResponse.json({ error: 'Add a note explaining why this order is moving backward.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    if (updateError) {
      console.error('[Order Status Update Error]', updateError);
      return NextResponse.json({ error: 'Could not update order status. Please try again.' }, { status: 500 });
    }

    const { error: historyError } = await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: newStatus,
      changed_by: user.id,
      note,
    });
    if (historyError) {
      console.error('[Order Status History Error]', historyError);
    }

    // Notification failure must never block the status change (ARCHITECTURE.md §9).
    if (NOTIFICATION_STAGES.includes(newStatus)) {
      try {
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', order.user_id)
          .single();
        const email = (customerProfile?.email as string | undefined) ?? '';

        let emailResult: { success: boolean; error?: string } = {
          success: false,
          error: 'Customer has no email on file.',
        };
        if (email) {
          const stageLabel = getStage(newStatus)?.label ?? newStatus;
          emailResult = await sendEmail({
            to: email,
            subject: `Order #${order.order_number} Update: ${stageLabel}`,
            html: baseEmailTemplate(`
              <h1 style="font-size:20px;margin:0 0 16px;">Order Status Update</h1>
              <p style="margin:0 0 12px;">Hi ${(customerProfile?.full_name as string | undefined) ?? 'there'},</p>
              <p style="margin:0 0 12px;">Order <strong>#${order.order_number}</strong> is now:
              <strong>${stageLabel}</strong>.</p>
              ${ctaButton(`${APP_URL}/account/orders/${order.id}`, 'View Order')}
            `),
          });
        }

        await supabase.from('notifications').insert({
          order_id: order.id,
          user_id: order.user_id,
          channel: 'email',
          type: 'order_status_changed',
          recipient: email,
          status: emailResult.success ? 'sent' : 'failed',
          error: emailResult.success ? null : emailResult.error,
        });
      } catch (notifyError) {
        console.error('[Order Status Notification Error]', notifyError);
      }
    }

    await logAdminAction({
      adminId: user.id,
      action: backward ? 'override_order_status' : 'advance_order_status',
      resourceType: 'order',
      resourceId: order.id,
      beforeValue: { status: order.status },
      afterValue: { status: newStatus, note },
    });

    return NextResponse.json({ orderNumber: order.order_number, status: newStatus });
  } catch (error) {
    console.error('[Order Status Route Error]', error);
    return NextResponse.json({ error: 'Could not update order status. Please try again.' }, { status: 500 });
  }
}
