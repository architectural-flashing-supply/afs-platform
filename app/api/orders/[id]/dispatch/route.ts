import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { sendSms } from '@/lib/twilio/sms';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';
import { sendInvoiceEmail } from '@/lib/utils/invoice-email';
import { logAdminAction } from '@/lib/admin/audit';
import { trackingUrlFor } from '@/lib/delivery/tracking-url';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface DispatchOrderRecord {
  id: string;
  order_number: string;
  status: string;
  tracking_token: string | null;
  total: number;
  user_id: string;
}

interface DispatchLineItemRecord {
  description: string;
  quantity: number;
  unit: string;
  line_total: number;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    // Past this point uses the service-role client — role is already
    // verified above via the session client, matching the same
    // auth-then-service-role pattern app/api/driver/location/route.ts uses
    // (orders/delivery_notifications have no operator SELECT/UPDATE policy).
    const admin = createAdminClient();

    const { data: orderRaw, error: orderError } = await admin
      .from('orders')
      .select('id, order_number, status, tracking_token, total, user_id')
      .eq('id', params.id)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderRaw as DispatchOrderRecord;

    if (order.status === 'out_for_delivery') {
      return NextResponse.json({ error: 'Order is already out for delivery.' }, { status: 409 });
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return NextResponse.json(
        { error: `Order cannot be dispatched from status "${order.status}".` },
        { status: 409 }
      );
    }
    if (!order.tracking_token) {
      // Every order gets a tracking_token DEFAULT gen_random_uuid()::text
      // (007_delivery_tracking.sql, backfilled on apply) — this only guards
      // a theoretical gap, e.g. a row somehow created before that ran.
      return NextResponse.json({ error: 'Order has no tracking token.' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'out_for_delivery', dispatched_at: nowIso, updated_at: nowIso })
      .eq('id', order.id);
    if (updateError) {
      console.error('[Dispatch Error]', updateError);
      return NextResponse.json({ error: 'Could not dispatch order. Please try again.' }, { status: 500 });
    }

    await admin.from('order_status_history').insert({
      order_id: order.id,
      status: 'out_for_delivery',
      changed_by: auth.userId,
      note: null,
    });

    // delivery_notifications has UNIQUE(order_id) — insert a bare row only
    // if one doesn't already exist (e.g. from an earlier 10-mile alert never
    // firing for this order); ignoreDuplicates makes this a no-op otherwise.
    await admin
      .from('delivery_notifications')
      .upsert({ order_id: order.id }, { onConflict: 'order_id', ignoreDuplicates: true });

    const { data: customerProfile } = await admin
      .from('profiles')
      .select('full_name, email, phone, sms_opt_in')
      .eq('id', order.user_id)
      .maybeSingle();

    const { data: lineItemsRaw } = await admin
      .from('order_line_items')
      .select('description, quantity, unit, line_total')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true });
    const lineItems = (lineItemsRaw ?? []) as DispatchLineItemRecord[];

    // lib/delivery/tracking-url.ts — the one place this URL is built. The
    // `!order.tracking_token` guard above has already returned 500, so this
    // is never null here; `?? ''` only satisfies the type.
    const trackingUrl = trackingUrlFor(order.tracking_token) ?? '';

    // --- SMS ---
    // Gated on phone + sms_opt_in, matching the only other real SMS send in
    // this codebase (app/api/driver/location's 10-mile alert) — dispatch is
    // important but doesn't override an explicit SMS opt-out.
    let smsSent = false;
    const phone = customerProfile?.phone as string | undefined;
    if (phone && customerProfile?.sms_opt_in) {
      const smsBody = `Your AFS order #${order.order_number} is on the way!\nTrack your delivery: ${trackingUrl}`;
      const smsResult = await sendSms(phone, smsBody);
      smsSent = smsResult.success;
      await admin.from('notifications').insert({
        order_id: order.id,
        user_id: order.user_id,
        channel: 'sms',
        type: 'dispatch_sms',
        recipient: phone,
        status: smsResult.success ? 'sent' : 'failed',
        error: smsResult.success ? null : smsResult.error,
      });
    }

    // --- Email ---
    // Sent regardless of email_opt_in — this is transactional delivery
    // status (ARCHITECTURE.md §9: "Send email (if opted in or
    // transactional)"), the same category as an order confirmation, not
    // marketing.
    let emailSent = false;
    const email = customerProfile?.email as string | undefined;
    if (email) {
      const summaryRows = lineItems
        .map(
          (item) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #E5E5E5;">${item.description}</td><td style="padding:6px 0;border-bottom:1px solid #E5E5E5;text-align:right;">${item.quantity} ${item.unit}</td><td style="padding:6px 0;border-bottom:1px solid #E5E5E5;text-align:right;">${currency.format(item.line_total)}</td></tr>`
        )
        .join('');
      const html = baseEmailTemplate(`
        <h1 style="font-size:20px;margin:0 0 16px;">Your Order Is On The Way</h1>
        <p style="margin:0 0 12px;">Hi ${customerProfile?.full_name ?? 'there'},</p>
        <p style="margin:0 0 12px;">Order <strong>#${order.order_number}</strong> has left our shop and is headed your way.</p>
        ${ctaButton(trackingUrl, 'Track Your Delivery')}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;font-size:13px;">
          <thead><tr>
            <th style="text-align:left;border-bottom:2px solid #111;padding-bottom:6px;">Item</th>
            <th style="text-align:right;border-bottom:2px solid #111;padding-bottom:6px;">Qty</th>
            <th style="text-align:right;border-bottom:2px solid #111;padding-bottom:6px;">Total</th>
          </tr></thead>
          <tbody>${summaryRows}</tbody>
        </table>
        <p style="margin:16px 0 0;font-weight:700;">Order Total: ${currency.format(order.total)}</p>
      `);

      const emailResult = await sendEmail({
        to: email,
        subject: `Your AFS Order #${order.order_number} Is On The Way`,
        html,
      });
      emailSent = emailResult.success;
      await admin.from('notifications').insert({
        order_id: order.id,
        user_id: order.user_id,
        channel: 'email',
        type: 'dispatch_email',
        recipient: email,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.success ? null : emailResult.error,
      });
    }

    // --- Invoice PDF email (step 2/e) ---
    const invoiceResult = await sendInvoiceEmail(order.id);

    await admin
      .from('delivery_notifications')
      .update({
        dispatch_sms_sent: smsSent,
        dispatch_email_sent: emailSent,
        invoice_sent: invoiceResult.success,
      })
      .eq('order_id', order.id);

    await logAdminAction({
      adminId: auth.userId,
      action: 'dispatch_order',
      resourceType: 'order',
      resourceId: order.id,
      beforeValue: { status: order.status },
      afterValue: { status: 'out_for_delivery' },
    });

    return NextResponse.json({ dispatched: true, trackingUrl });
  } catch (error) {
    console.error('[Dispatch Route Error]', error);
    return NextResponse.json({ error: 'Could not dispatch order. Please try again.' }, { status: 500 });
  }
}
