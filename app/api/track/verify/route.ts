import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/lib/utils/validation';

interface TrackStatusHistoryItem {
  status: string;
  changedAt: string;
}

interface TrackOrderResponse {
  orderNumber: string;
  orderDate: string;
  status: string;
  deliveryMethod: string;
  deliveryScheduledAt: string | null;
  deliveryWindow: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shopPhotoUrl: string | null;
  statusHistory: TrackStatusHistoryItem[];
}

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const attemptsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = (attemptsByIp.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  attempts.push(now);
  attemptsByIp.set(ip, attempts);
  return attempts.length > RATE_LIMIT_MAX;
}

const NOT_FOUND_MESSAGE = 'Order not found or email does not match our records.';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const orderNumber = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!orderNumber || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid order number and email address.' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select(
        'id, order_number, status, created_at, user_id, delivery_method, delivery_scheduled_at, delivery_window, tracking_number, carrier, shop_photo_url'
      )
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', order.user_id)
      .maybeSingle();

    if (!profile || profile.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    const { data: historyRaw } = await admin
      .from('order_status_history')
      .select('status, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    const statusHistory: TrackStatusHistoryItem[] = (historyRaw ?? []).map((h: { status: string; created_at: string }) => ({
      status: h.status,
      changedAt: h.created_at,
    }));

    const response: TrackOrderResponse = {
      orderNumber: order.order_number,
      orderDate: order.created_at,
      status: order.status,
      deliveryMethod: order.delivery_method,
      deliveryScheduledAt: order.delivery_scheduled_at,
      deliveryWindow: order.delivery_window,
      trackingNumber: order.tracking_number,
      carrier: order.carrier,
      shopPhotoUrl: order.shop_photo_url,
      statusHistory,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Track Verify Error]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
