'use client';

import { useEffect, useRef, useState } from 'react';

interface EmployeeOrderActionsProps {
  orderId: string;
  initialStatus: string;
}

type ActionKey = 'packaged' | 'dispatch' | 'delivered';

export default function EmployeeOrderActions({ orderId, initialStatus }: EmployeeOrderActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  function stopGpsWatch() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  function startGpsWatch() {
    if (watchIdRef.current !== null || !('geolocation' in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        }).catch((err) => console.error('[Employee GPS Post Error]', err));
      },
      (err) => console.error('[Employee GPS Watch Error]', err),
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
  }

  // Resume GPS reporting if this page loads mid-delivery (e.g. after a
  // reload) — the watch itself only lives in this component instance, so a
  // fresh mount with status already out_for_delivery needs to restart it,
  // not just the moment [Dispatch for Delivery] is tapped.
  useEffect(() => {
    if (status === 'out_for_delivery') startGpsWatch();
    return () => stopGpsWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function runAction(action: ActionKey, path: string, method: 'PATCH' | 'POST', nextStatus: string) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(path, { method });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(null);
        return;
      }
      if (action === 'delivered') stopGpsWatch();
      setStatus(nextStatus);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  const buttonClass =
    'w-full py-4 rounded font-label font-semibold text-base transition-colors disabled:opacity-50 disabled:pointer-events-none';

  return (
    <div className="flex flex-col gap-3">
      {status === 'out_for_delivery' && (
        <div className="bg-[var(--afs-crimson-ghost)] border border-afs-crimson rounded p-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-afs-crimson animate-pulse shrink-0" />
          <span className="font-label text-sm text-afs-chrome-high">Delivery in progress — GPS active</span>
        </div>
      )}

      {(status === 'in_production' || status === 'ready') && (
        <button
          type="button"
          onClick={() => runAction('packaged', `/api/orders/${orderId}/packaged`, 'PATCH', 'packaged')}
          disabled={loading !== null}
          className={`${buttonClass} bg-afs-bg-overlay border border-afs-border text-afs-chrome-high`}
        >
          {loading === 'packaged' ? 'Updating…' : 'Mark as Packaged'}
        </button>
      )}

      {status === 'packaged' && (
        <button
          type="button"
          onClick={() => runAction('dispatch', `/api/orders/${orderId}/dispatch`, 'POST', 'out_for_delivery')}
          disabled={loading !== null}
          className={`${buttonClass} bg-afs-crimson text-white`}
        >
          {loading === 'dispatch' ? 'Dispatching…' : 'Dispatch for Delivery'}
        </button>
      )}

      {status === 'out_for_delivery' && (
        <button
          type="button"
          onClick={() => runAction('delivered', `/api/orders/${orderId}/delivered`, 'POST', 'delivered')}
          disabled={loading !== null}
          className={`${buttonClass} bg-afs-crimson text-white`}
        >
          {loading === 'delivered' ? 'Marking Delivered…' : 'Mark Delivered'}
        </button>
      )}

      {status === 'delivered' && (
        <p className="text-center font-label text-sm text-afs-chrome-mid py-2">This order has been delivered.</p>
      )}

      {error && <p className="font-body text-sm text-afs-crimson text-center">{error}</p>}
    </div>
  );
}
