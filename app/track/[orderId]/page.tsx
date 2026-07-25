'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import DeliveryTrackingMap, {
  type DeliveryAddress,
  type DriverLocation,
} from '@/components/track/DeliveryTrackingMap';

interface TrackResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  deliveryAddress: DeliveryAddress | null;
  driverLocation: DriverLocation | null;
}

// This page's status set is wider than lib/admin/orderStages.ts's OrderStatus
// union (it doesn't include packaged/out_for_delivery/in_production — see
// supabase/migrations/007_delivery_tracking.sql section 6a) — deliberately
// not importing that type here, since widening a union used across the
// admin production-queue UI is a bigger change than this tracking page needs.
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  submitted: 'info',
  received: 'chrome',
  in_queue: 'warning',
  cutting: 'warning',
  bending: 'warning',
  qc: 'warning',
  ready: 'success',
  in_production: 'warning',
  packaged: 'success',
  shipped: 'success',
  out_for_delivery: 'success',
  delivered: 'chrome',
  cancelled: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  received: 'Received',
  in_queue: 'In Queue',
  cutting: 'Cutting',
  bending: 'Bending',
  qc: 'Quality Check',
  ready: 'Ready',
  in_production: 'In Production',
  packaged: 'Packaged',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// The status bar's trailing message is status-aware rather than a fixed
// "Your delivery is on the way" string shown regardless of actual status —
// that phrase is only accurate once the order is actually out for delivery.
const STATUS_MESSAGE: Record<string, string> = {
  out_for_delivery: 'Your delivery is on the way',
  shipped: 'Your order has shipped',
  packaged: 'Your order is packaged and ready to ship',
  delivered: 'Your order has been delivered',
};
const DEFAULT_STATUS_MESSAGE = 'Your order is being prepared';

function UnavailableMessage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-afs-bg-base px-6">
      <div className="max-w-md text-center bg-afs-bg-raised border border-afs-border rounded p-8 metal-edge">
        <h1 className="font-heading text-2xl font-bold text-afs-chrome-high mb-3">Tracking Not Available</h1>
        <p className="font-body text-sm text-afs-chrome-mid mb-6">
          Tracking not available for this order. If you believe this is an error, contact AFS directly.
        </p>
        <a
          href="tel:+15123724900"
          className="block font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors mb-1"
        >
          (512) 372-4900
        </a>
        <a
          href="mailto:trica@architecturalflashingsupply.com"
          className="block font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors"
        >
          trica@architecturalflashingsupply.com
        </a>
      </div>
    </main>
  );
}

export default function PublicOrderTrackerPage({ params }: { params: { orderId: string } }) {
  const [loading, setLoading] = useState(true);
  const [notAvailable, setNotAvailable] = useState(false);
  const [data, setData] = useState<TrackResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/track/${encodeURIComponent(params.orderId)}`);
        if (cancelled) return;
        if (!res.ok) {
          setNotAvailable(true);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as TrackResponse;
        if (cancelled) return;
        setData(json);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setNotAvailable(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.orderId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-afs-bg-base">
        <p className="font-body text-afs-chrome-mid text-sm">Loading tracking information…</p>
      </main>
    );
  }

  if (notAvailable || !data) {
    return <UnavailableMessage />;
  }

  const isOutForDelivery = data.status === 'out_for_delivery';

  return (
    <main className="fixed inset-0 flex flex-col">
      <div className="bg-afs-bg-raised border-b border-afs-border px-6 py-3 flex items-center gap-4 flex-wrap z-10">
        <div className="bg-afs-bg-dim inline-flex items-center px-2 py-1 rounded-sm">
          <Image src="/afs-logo.png" alt="AFS" width={40} height={28} className="w-auto h-7 object-contain" />
        </div>
        <span className="font-data text-sm text-afs-chrome-high">Order #{data.orderNumber}</span>
        <Badge variant={STATUS_VARIANT[data.status] ?? 'chrome'} pulse={isOutForDelivery}>
          {STATUS_LABEL[data.status] ?? data.status}
        </Badge>
        <span className="font-body text-sm text-afs-chrome-mid ml-auto">
          {STATUS_MESSAGE[data.status] ?? DEFAULT_STATUS_MESSAGE}
        </span>
      </div>

      <div className="flex-1 relative">
        <DeliveryTrackingMap
          orderId={data.orderId}
          deliveryAddress={data.deliveryAddress}
          initialDriverLocation={data.driverLocation}
          isOutForDelivery={isOutForDelivery}
        />
      </div>
    </main>
  );
}
