import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate, ctaButton } from '@/lib/resend/templates/base';
import { getSiteUrl } from '@/lib/site-url';

const APP_URL = getSiteUrl();

const PICKUP_WINDOWS = ['morning', 'afternoon'] as const;
type PickupWindow = (typeof PICKUP_WINDOWS)[number];
const WINDOW_LABEL: Record<PickupWindow, string> = { morning: 'Morning', afternoon: 'Afternoon' };

interface PickupScheduleInput {
  orderId?: unknown;
  pickupDate?: unknown;
  pickupWindow?: unknown;
}

interface PickupOrderRecord {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  delivery_method: string;
  delivery_address: { contactName?: string; contactPhone?: string } | null;
}

function isValidPickupDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() >= today.getTime();
}

/**
 * Customer-facing counterpart to app/api/orders/[id]/dispatch (ship path) and
 * app/api/admin/orders/[id]/crm (admin-set ship date) — schedules the pickup
 * date/window against an already-placed order, per PICKUP_SCHEDULING_SCOPE.md
 * item 2. orders has no customer UPDATE RLS policy (only order-owner SELECT
 * and admin FOR ALL — SCHEMA.md TABLE 18), so ownership is verified against
 * the session user before falling through to the service-role client for the
 * actual write, matching the same auth-then-service-role pattern used by
 * dispatch/route.ts and delivered/route.ts.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as PickupScheduleInput;

    if (typeof body.orderId !== 'string' || !body.orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }
    if (typeof body.pickupDate !== 'string' || !isValidPickupDate(body.pickupDate)) {
      return NextResponse.json(
        { error: 'Select a business-day pickup date (Monday–Friday) that is not in the past.' },
        { status: 400 }
      );
    }
    if (typeof body.pickupWindow !== 'string' || !PICKUP_WINDOWS.includes(body.pickupWindow as PickupWindow)) {
      return NextResponse.json({ error: 'Select a pickup window (Morning or Afternoon).' }, { status: 400 });
    }
    const pickupDate = body.pickupDate;
    const pickupWindow = body.pickupWindow as PickupWindow;

    const admin = createAdminClient();
    const { data: orderRaw, error: orderError } = await admin
      .from('orders')
      .select('id, order_number, user_id, status, delivery_method, delivery_address')
      .eq('id', body.orderId)
      .maybeSingle();

    if (orderError || !orderRaw) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    const order = orderRaw as PickupOrderRecord;

    if (order.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (order.delivery_method !== 'pickup') {
      return NextResponse.json({ error: 'This order is not set up for pickup.' }, { status: 400 });
    }
    if (order.status === 'delivered' || order.status === 'cancelled') {
      return NextResponse.json(
        { error: `Pickup cannot be scheduled from order status "${order.status}".` },
        { status: 409 }
      );
    }

    const deliveryScheduledAt = new Date(`${pickupDate}T00:00:00`).toISOString();
    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin
      .from('orders')
      .update({ delivery_scheduled_at: deliveryScheduledAt, delivery_window: pickupWindow, updated_at: nowIso })
      .eq('id', order.id);
    if (updateError) {
      console.error('[Pickup Schedule Error]', updateError);
      return NextResponse.json({ error: 'Could not schedule pickup. Please try again.' }, { status: 500 });
    }

    const formattedDate = new Date(`${pickupDate}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const windowLabel = WINDOW_LABEL[pickupWindow];

    // Non-status-changing audit entry, same pattern dispatch/route.ts and
    // the CRM PATCH route use for delivery-date changes — visible in both
    // the admin and customer order-detail status history lists.
    await admin.from('order_status_history').insert({
      order_id: order.id,
      status: order.status,
      changed_by: user.id,
      note: `Pickup scheduled — ${formattedDate} ${windowLabel}`,
    });

    // --- Notify AFS admin --- (never blocks the response; ARCHITECTURE.md §9)
    const alertEmail = process.env.PICKUP_ALERT_EMAIL || 'trica@architecturalflashingsupply.com';
    await sendEmail({
      to: alertEmail,
      subject: `Pickup scheduled — Order ${order.order_number} — ${formattedDate} ${windowLabel}`,
      html: baseEmailTemplate(`
        <h1 style="font-size:20px;margin:0 0 16px;">Pickup Scheduled</h1>
        <p style="margin:0 0 12px;">Order <strong>${order.order_number}</strong> pickup has been scheduled for
        <strong>${formattedDate}, ${windowLabel}</strong>.</p>
        <p style="margin:0;">Contact: ${order.delivery_address?.contactName ?? '—'} ·
        ${order.delivery_address?.contactPhone ?? '—'}</p>
      `),
    });

    // --- Customer confirmation ---
    const { data: customerProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle();
    const email = customerProfile?.email as string | undefined;
    if (email) {
      await sendEmail({
        to: email,
        subject: `Pickup Scheduled — Order ${order.order_number}`,
        html: baseEmailTemplate(`
          <h1 style="font-size:20px;margin:0 0 16px;">Your Pickup Is Scheduled</h1>
          <p style="margin:0 0 12px;">Hi ${customerProfile?.full_name ?? 'there'},</p>
          <p style="margin:0 0 12px;">Order <strong>${order.order_number}</strong> is scheduled for pickup on
          <strong>${formattedDate}, ${windowLabel}</strong>.</p>
          <p style="margin:0 0 12px;">Contact AFS for pickup address and staging instructions.</p>
          ${ctaButton(`${APP_URL}/account/orders/${order.id}`, 'View Order')}
        `),
      });
    }

    return NextResponse.json({ success: true, deliveryScheduledAt, deliveryWindow: pickupWindow });
  } catch (error) {
    console.error('[Pickup Schedule Route Error]', error);
    return NextResponse.json({ error: 'Could not schedule pickup. Please try again.' }, { status: 500 });
  }
}
