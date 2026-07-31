'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PickupScheduleValue {
  pickupDate: string | null;
  pickupWindow: string | null;
}

interface PickupSchedulerProps {
  orderId: string;
  initial: PickupScheduleValue;
  canSchedule: boolean;
}

const PICKUP_WINDOWS = ['morning', 'afternoon'] as const;
const WINDOW_LABEL: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function isWeekday(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return day !== 0 && day !== 6;
}

export default function PickupScheduler({ orderId, initial, canSchedule }: PickupSchedulerProps) {
  const router = useRouter();
  const [scheduled, setScheduled] = useState(initial);
  const [editing, setEditing] = useState(!initial.pickupDate);
  const [pickupDate, setPickupDate] = useState(toDateInputValue(initial.pickupDate));
  const [pickupWindow, setPickupWindow] = useState(initial.pickupWindow ?? 'morning');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!pickupDate) {
      setError('Select a pickup date.');
      return;
    }
    if (!isWeekday(pickupDate)) {
      setError('AFS pickup is available on business days (Monday–Friday) only.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/pickup/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, pickupDate, pickupWindow }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deliveryScheduledAt?: string;
        deliveryWindow?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Could not schedule pickup. Please try again.');
        return;
      }
      setScheduled({ pickupDate: data.deliveryScheduledAt ?? null, pickupWindow: data.deliveryWindow ?? null });
      setEditing(false);
      router.refresh();
    } catch {
      setError('Could not schedule pickup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const facilityRow = (
    <div className="flex justify-between">
      <dt className="text-afs-chrome-mid">Facility</dt>
      <dd className="font-body text-afs-chrome-high text-right">Contact AFS for pickup address.</dd>
    </div>
  );

  if (!editing) {
    return (
      <dl className="flex flex-col gap-2 font-body text-sm">
        <div className="flex justify-between">
          <dt className="text-afs-chrome-mid">Pickup Date</dt>
          <dd className="font-data text-afs-chrome-high">
            {scheduled.pickupDate ? formatDate(scheduled.pickupDate) : 'Not yet scheduled'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-afs-chrome-mid">Window</dt>
          <dd className="font-data text-afs-chrome-high">
            {scheduled.pickupWindow ? (WINDOW_LABEL[scheduled.pickupWindow] ?? scheduled.pickupWindow) : '—'}
          </dd>
        </div>
        {facilityRow}
        {canSchedule && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors"
            >
              Reschedule
            </button>
          </div>
        )}
      </dl>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-sm text-afs-chrome-mid">
        Contact AFS for pickup address. Choose a business-day window below and we&apos;ll have your order staged
        and ready.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block" htmlFor="pickup-date">
            Pickup Date
          </label>
          <input
            id="pickup-date"
            type="date"
            value={pickupDate}
            min={todayInputValue()}
            disabled={submitting}
            onChange={(e) => setPickupDate(e.target.value)}
            className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data"
          />
          <p className="font-body text-xs text-afs-chrome-dim mt-1">Business days only (Mon–Fri).</p>
        </div>
        <div>
          <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block">Window</span>
          <div className="flex gap-2">
            {PICKUP_WINDOWS.map((w) => (
              <label
                key={w}
                className={`flex-1 text-center border rounded px-3 py-2 cursor-pointer font-label text-sm transition-colors ${
                  pickupWindow === w
                    ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                    : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="pickupWindow"
                  className="sr-only"
                  checked={pickupWindow === w}
                  disabled={submitting}
                  onChange={() => setPickupWindow(w)}
                />
                {WINDOW_LABEL[w]}
              </label>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-5 py-2 rounded transition-colors disabled:opacity-50"
        >
          {submitting ? 'Scheduling…' : 'Schedule Pickup'}
        </button>
        {scheduled.pickupDate && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={submitting}
            className="font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
