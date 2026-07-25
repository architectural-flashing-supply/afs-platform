import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Statuses that are valid orders but have nothing meaningful to show on a
// delivery map — cancelled has no delivery to track, and pickup orders have
// no jobsite/driver leg at all. Both are treated the same as "token not
// found" so the public page shows one generic unavailable message rather
// than distinguishing reasons to an anonymous caller.
const NON_TRACKABLE_STATUSES = new Set(['cancelled']);
const NOT_FOUND_MESSAGE = 'Tracking not available for this order.';

interface TrackingDataRow {
  order_id: string;
  order_number: string;
  order_status: string;
  delivery_method: string;
  delivery_address: Record<string, unknown> | null;
  driver_lat: string | number | null;
  driver_lng: string | number | null;
  driver_recorded_at: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  try {
    const token = params.token?.trim();
    if (!token) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    const admin = createAdminClient();

    // get_tracking_data() is a SECURITY DEFINER function (see
    // supabase/migrations/007_delivery_tracking.sql) — it does the token
    // match and bypasses RLS on orders/driver_locations itself, so no
    // anon-facing SELECT policy is needed on either table for this route.
    const { data, error } = await admin
      .rpc('get_tracking_data', { p_tracking_token: token })
      .maybeSingle<TrackingDataRow>();

    if (error) {
      console.error('[Track Error]', error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    if (
      !data ||
      NON_TRACKABLE_STATUSES.has(data.order_status) ||
      data.delivery_method === 'pickup'
    ) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    // The live driver dot only ever applies while an order is actively out
    // for delivery — older pings from a prior delivery attempt (or any
    // stray row) must never surface once the order has moved past that
    // status, so this is gated on order_status, not just "does a row exist".
    const driverLocation =
      data.order_status === 'out_for_delivery' && data.driver_lat != null && data.driver_lng != null
        ? {
            lat: Number(data.driver_lat),
            lng: Number(data.driver_lng),
            recordedAt: data.driver_recorded_at,
          }
        : null;

    // Never returns customer name/email/phone/company — get_tracking_data()
    // itself never selects those columns, so there's nothing to accidentally
    // leak here beyond what the map needs: status, jobsite address, and the
    // driver's current position.
    return NextResponse.json({
      orderId: data.order_id,
      orderNumber: data.order_number,
      status: data.order_status,
      deliveryAddress: data.delivery_address,
      driverLocation,
    });
  } catch (error) {
    console.error('[Track Error]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
