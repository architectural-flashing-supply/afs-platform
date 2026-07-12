'use client';

import { useState } from 'react';
import ProductionTimeline, {
  ORDER_STATUS_LABEL,
  type OrderStatus,
  type StatusHistoryItem,
} from '@/components/account/ProductionTimeline';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';

interface TrackOrderResponse {
  orderNumber: string;
  orderDate: string;
  status: OrderStatus;
  deliveryMethod: string;
  deliveryScheduledAt: string | null;
  deliveryWindow: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  shopPhotoUrl: string | null;
  statusHistory: StatusHistoryItem[];
}

interface TrackErrorResponse {
  error: string;
}

const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  submitted: 'info',
  received: 'chrome',
  in_queue: 'warning',
  cutting: 'warning',
  bending: 'warning',
  qc: 'warning',
  ready: 'success',
  shipped: 'success',
  delivered: 'chrome',
  cancelled: 'error',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PublicOrderTrackerPage({ params }: { params: { orderId: string } }) {
  const [orderNumber, setOrderNumber] = useState(decodeURIComponent(params.orderId));
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackOrderResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/track/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderNumber.trim(), email: email.trim() }),
      });
      const data = (await res.json()) as TrackOrderResponse | TrackErrorResponse;
      if (!res.ok) {
        setError('error' in data ? data.error : 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      setOrder(data as TrackOrderResponse);
      setLoading(false);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors';

  return (
    <main className="min-h-screen bg-afs-bg-base py-16 px-6">
      <div className="max-w-xl mx-auto">
        <div className="mb-10 text-center">
          <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-4">Order Tracker</p>
          <h1 className="font-display text-5xl text-afs-chrome-high leading-none mb-4">TRACK YOUR ORDER</h1>
          <p className="font-body text-afs-chrome-mid text-base">
            Enter your order number and the email address on file to see fabrication status.
          </p>
        </div>

        {!order ? (
          <form
            onSubmit={handleSubmit}
            className="bg-afs-bg-overlay border border-afs-chrome-dim rounded p-8"
            data-testid="track-form"
          >
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block" htmlFor="orderId">
              Order Number
            </label>
            <input
              id="orderId"
              name="orderId"
              type="text"
              required
              className={`${inputClass} mb-6`}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="AFS-2026-00001"
            />

            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className={`${inputClass} mb-6`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            {error && <p className="font-body text-sm text-afs-crimson mb-4">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Looking up…' : 'Track Order'}
            </button>
          </form>
        ) : (
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-8">
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="font-data text-2xl text-afs-chrome-high">{order.orderNumber}</h2>
                <p className="font-body text-sm text-afs-chrome-mid mt-1">Ordered {formatDate(order.orderDate)}</p>
              </div>
              <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'chrome'} size="md">
                {ORDER_STATUS_LABEL[order.status] ?? order.status}
              </Badge>
            </div>

            <ProductionTimeline
              currentStatus={order.status}
              statusHistory={order.statusHistory}
              trackingNumber={order.trackingNumber}
              carrier={order.carrier}
              shopPhotoUrl={order.shopPhotoUrl}
              variant="public"
            />

            {order.deliveryScheduledAt && (
              <p className="font-body text-sm text-afs-chrome-mid mt-4">
                {order.deliveryMethod === 'pickup' ? 'Pickup scheduled' : 'Delivery scheduled'} for{' '}
                <span className="font-data text-afs-chrome-high">{formatDate(order.deliveryScheduledAt)}</span>
                {order.deliveryWindow ? ` · ${order.deliveryWindow}` : ''}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setOrder(null);
                setError(null);
              }}
              className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors mt-8"
            >
              ← Track a different order
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
