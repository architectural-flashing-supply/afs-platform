import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { haversineDistance } from '@/lib/utils/distance';
import { geocodeAddress } from '@/lib/utils/geocode';
import { sendSms } from '@/lib/twilio/sms';

const TEN_MILE_THRESHOLD_MILES = 10;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://afs-website-alpha.vercel.app';

interface DeliveryAddressJson {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  tracking_token: string | null;
  delivery_method: string;
  delivery_address: DeliveryAddressJson | null;
  geocoded_lat: string | number | null;
  geocoded_lng: string | number | null;
  user_id: string;
}

function formatAddress(address: DeliveryAddressJson | null): string {
  if (!address) return '';
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  return [address.line1, address.line2, cityState, address.zip].filter(Boolean).join(', ');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: driverProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    // Matches is_operator()'s own definition (supabase/migrations/007_delivery_tracking.sql
    // — role IN ('operator','admin')) rather than excluding admin, so an admin
    // testing/covering the Employee PWA isn't locked out of a route every
    // other operator-gated policy in this schema treats admin as a superset of.
    if (driverProfile?.role !== 'operator' && driverProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { orderId, lat, lng } = raw as Record<string, unknown>;
    if (
      typeof orderId !== 'string' ||
      !orderId ||
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return NextResponse.json({ error: 'orderId, lat, and lng are required.' }, { status: 400 });
    }

    // Past this point uses the service-role client. driver_locations' own RLS
    // (operator_insert_own_locations) would cover the insert below for a real
    // operator session, but delivery_notifications is admin-only FOR ALL (no
    // operator policy) and orders has no operator SELECT policy at all — a
    // non-admin operator session couldn't read the order or flip
    // ten_mile_sent. Role is already verified above via the session client,
    // so this mirrors the same auth-then-service-role pattern already used by
    // app/api/track/[token] (get_tracking_data) and the machine-bridge routes.
    const admin = createAdminClient();

    const { error: insertError } = await admin.from('driver_locations').insert({
      driver_id: user.id,
      order_id: orderId,
      lat,
      lng,
    });
    if (insertError) {
      console.error('[Driver Location Error]', insertError);
      return NextResponse.json({ error: 'Could not record location.' }, { status: 500 });
    }

    const { data: orderRaw, error: orderError } = await admin
      .from('orders')
      .select('id, order_number, tracking_token, delivery_method, delivery_address, geocoded_lat, geocoded_lng, user_id')
      .eq('id', orderId)
      .maybeSingle();

    // The GPS ping is already recorded above — a missing order, a pickup
    // order (no jobsite to check distance against), or no trackable address
    // just means there's nothing to run the 10-mile check against. The PWA
    // polls this route every 30s regardless, so it must never fail the whole
    // request over the SMS side-effect.
    if (orderError || !orderRaw) {
      return NextResponse.json({ received: true });
    }
    const order = orderRaw as OrderRow;

    if (order.delivery_method === 'pickup') {
      return NextResponse.json({ received: true });
    }

    let jobsiteLat = order.geocoded_lat != null ? Number(order.geocoded_lat) : null;
    let jobsiteLng = order.geocoded_lng != null ? Number(order.geocoded_lng) : null;

    if (jobsiteLat == null || jobsiteLng == null) {
      const addressString = formatAddress(order.delivery_address);
      const geocoded = addressString ? await geocodeAddress(addressString) : null;
      if (geocoded) {
        jobsiteLat = geocoded.lat;
        jobsiteLng = geocoded.lng;
        await admin
          .from('orders')
          .update({ geocoded_lat: jobsiteLat, geocoded_lng: jobsiteLng })
          .eq('id', order.id);
      }
    }

    if (jobsiteLat == null || jobsiteLng == null) {
      return NextResponse.json({ received: true });
    }

    const distanceMiles = haversineDistance(lat, lng, jobsiteLat, jobsiteLng);

    if (distanceMiles <= TEN_MILE_THRESHOLD_MILES) {
      const { data: existingNotification } = await admin
        .from('delivery_notifications')
        .select('id, ten_mile_sent')
        .eq('order_id', order.id)
        .maybeSingle();

      if (!existingNotification || !existingNotification.ten_mile_sent) {
        const { data: customerProfile } = await admin
          .from('profiles')
          .select('phone, sms_opt_in')
          .eq('id', order.user_id)
          .maybeSingle();

        const phone = customerProfile?.phone as string | undefined;
        const smsOptIn = Boolean(customerProfile?.sms_opt_in);

        if (phone && smsOptIn && order.tracking_token) {
          const trackingUrl = `${APP_URL}/track/${order.tracking_token}`;
          const message = `Your AFS order #${order.order_number} is about 10 miles away. Track your driver: ${trackingUrl}`;
          const result = await sendSms(phone, message);

          await admin.from('notifications').insert({
            order_id: order.id,
            user_id: order.user_id,
            channel: 'sms',
            type: 'ten_mile_delivery_alert',
            recipient: phone,
            status: result.success ? 'sent' : 'failed',
            error: result.success ? null : result.error,
          });
        }

        // Fired once per order regardless of whether a message actually went
        // out (no phone / not opted in / send failure) — the alternative,
        // re-attempting on every 30s ping for the rest of the delivery, would
        // just repeat the same failure. ARCHITECTURE.md §9's opt-in check is
        // still honored above; this only prevents retry-storming it.
        const now = new Date().toISOString();
        if (existingNotification) {
          await admin
            .from('delivery_notifications')
            .update({ ten_mile_sent: true, ten_mile_sent_at: now })
            .eq('id', existingNotification.id);
        } else {
          await admin.from('delivery_notifications').insert({
            order_id: order.id,
            ten_mile_sent: true,
            ten_mile_sent_at: now,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Driver Location Error]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
