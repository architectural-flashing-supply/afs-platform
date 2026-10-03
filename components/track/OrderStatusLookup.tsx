'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ProductionTimeline, { ORDER_STATUS_LABEL } from '@/components/account/ProductionTimeline';
import { STATUS_VARIANT } from '@/lib/admin/orderStages';
import type { StatusHistoryEntry } from '@/lib/production/timeline-view';

/**
 * THE PUBLIC VARIANT'S SURFACE — SPEC_PRODUCTION_TIMELINE.md §1's "public order
 * tracker (read-only, minimal variant)".
 *
 * WHY THIS EXISTS AND WHY IT IS NOT app/track/[orderId]. SITEMAP.md has always
 * described the public tracker as "Email verify", and the endpoint for exactly
 * that — POST /api/track/verify, order number plus the matching account email,
 * rate-limited to 10 attempts an hour per IP, returning status, history,
 * scheduled date, tracking and a SIGNED pre-ship photo URL — was already built
 * and complete. It had no caller at all. What was built at /track/[orderId] is
 * a different thing: a token-addressed, full-screen live delivery map, and
 * putting a timeline inside it would mean rebuilding a working screen (and it
 * renders chrome-less, because AppChrome strips the nav and footer for every
 * /track path). So the public variant lives here, on its own route, consuming
 * the endpoint that was waiting for it. The map is untouched.
 *
 * NO PRICE APPEARS ON THIS PAGE. AFS is an RFQ platform (CLAUDE.md), the
 * endpoint returns no money field, and the timeline has nowhere to put one.
 */

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
  statusHistory: { status: string; changedAt: string }[];
}

type LookupState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'found'; order: TrackOrderResponse };

/** What to say when the network itself failed rather than the lookup. */
const NETWORK_ERROR = 'We could not reach the order system. Nothing was submitted — please try again in a moment.';
const INVALID_RESPONSE = 'The order system returned something we could not read. Nothing was submitted.';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OrderStatusLookup() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<{ orderNumber?: string; email?: string }>({});
  const [state, setState] = useState<LookupState>({ phase: 'idle' });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Client-side validation exists to spare a round trip and to point at the
    // field at fault; the route validates independently and is the authority.
    const errors: { orderNumber?: string; email?: string } = {};
    if (!orderNumber.trim()) errors.orderNumber = 'Enter the order number from your confirmation email.';
    if (!email.trim()) errors.email = 'Enter the email address the order was placed with.';
    setFieldError(errors);
    if (Object.keys(errors).length > 0) return;

    setState({ phase: 'loading' });
    try {
      const res = await fetch('/api/track/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderNumber.trim(), email: email.trim() }),
      });
      const payload: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : INVALID_RESPONSE;
        setState({ phase: 'error', message });
        return;
      }

      if (!payload || typeof payload !== 'object' || typeof (payload as { status?: unknown }).status !== 'string') {
        setState({ phase: 'error', message: INVALID_RESPONSE });
        return;
      }

      setState({ phase: 'found', order: payload as TrackOrderResponse });
    } catch {
      setState({ phase: 'error', message: NETWORK_ERROR });
    }
  }

  const order = state.phase === 'found' ? state.order : null;
  const history: StatusHistoryEntry[] =
    order?.statusHistory.map((h) => ({ status: h.status, changedAt: h.changedAt })) ?? [];

  return (
    <div data-testid="order-status-lookup" className="max-w-[760px] mx-auto px-6 py-16">
      <h1 className="font-heading text-3xl text-afs-chrome-high">Track an Order</h1>
      <p className="font-body text-sm text-afs-chrome-mid mt-2 mb-8">
        Enter your order number and the email address the order was placed with. No account needed.
      </p>

      <form onSubmit={handleSubmit} noValidate className="bg-afs-bg-raised border border-afs-border rounded p-6 mb-8">
        <div className="flex flex-col gap-4">
          <Input
            id="order-status-order-number"
            name="orderNumber"
            label="Order Number"
            autoComplete="off"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            error={fieldError.orderNumber}
            disabled={state.phase === 'loading'}
          />
          <Input
            id="order-status-email"
            name="email"
            type="email"
            label="Email Address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError.email}
            disabled={state.phase === 'loading'}
          />
          <div>
            <Button type="submit" disabled={state.phase === 'loading'} data-testid="order-status-submit">
              {state.phase === 'loading' ? 'Looking up your order…' : 'Find My Order'}
            </Button>
          </div>
        </div>
      </form>

      {state.phase === 'error' && (
        // The route's own wording is shown verbatim when it supplied one — it
        // deliberately does not distinguish "no such order" from "email does not
        // match", so an anonymous caller cannot use this page to discover
        // whether an order number exists.
        <div
          data-testid="order-status-error"
          role="alert"
          className="bg-afs-bg-overlay border border-afs-crimson rounded px-4 py-3 mb-8"
        >
          <p className="font-body text-sm text-afs-chrome-high">{state.message}</p>
          {/* chrome-silver on afs-bg-overlay — chrome-mid measures 4.04:1 there. */}
          <p className="font-body text-xs text-afs-chrome-silver mt-1">
            Nothing about your order has changed. Check the order number on your confirmation email, or contact us and we
            will look it up for you.
          </p>
        </div>
      )}

      {state.phase === 'loading' && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Production Status</h2>
          <ProductionTimeline variant="public" currentStatus="" statusHistory={[]} loadState="loading" />
        </div>
      )}

      {order && (
        <>
          <div
            data-testid="order-status-header"
            className="flex items-start justify-between gap-6 mb-6 flex-wrap"
          >
            <div>
              <h2 className="font-data text-2xl text-afs-chrome-high">{order.orderNumber}</h2>
              <p className="font-body text-sm text-afs-chrome-mid mt-1">Ordered {formatDate(order.orderDate)}</p>
            </div>
            <Badge variant={STATUS_VARIANT[order.status] ?? 'chrome'} size="md">
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </Badge>
          </div>

          <div className="bg-afs-bg-raised border border-afs-border rounded p-6 mb-8">
            <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Production Status</h2>
            <ProductionTimeline
              variant="public"
              currentStatus={order.status}
              statusHistory={history}
              estimatedShipDate={order.deliveryScheduledAt}
              trackingNumber={order.trackingNumber}
              carrier={order.carrier}
              shopPhotoUrl={order.shopPhotoUrl}
            />
          </div>

          <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
            <h2 className="font-heading text-lg text-afs-chrome-high mb-3">
              {order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}
            </h2>
            <dl className="flex flex-col gap-1.5 font-body text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-afs-chrome-mid">Scheduled</dt>
                <dd className="font-data text-afs-chrome-high">
                  {order.deliveryScheduledAt ? formatDate(order.deliveryScheduledAt) : 'Not yet scheduled'}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-afs-chrome-mid">Window</dt>
                <dd className="font-data text-afs-chrome-high">{order.deliveryWindow ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
