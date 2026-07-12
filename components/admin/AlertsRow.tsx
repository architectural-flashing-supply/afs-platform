'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Alert {
  id: string;
  message: string;
  href: string;
}

interface AlertsRowProps {
  alerts: Alert[];
}

export default function AlertsRow({ alerts }: AlertsRowProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((alert) => !dismissed.has(alert.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mb-6">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between gap-4 bg-afs-bg-surface border-l-4 border-afs-warning rounded-sm px-4 py-3"
        >
          <Link href={alert.href} className="font-body text-sm text-afs-ink-900">
            {alert.message}
          </Link>
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
            className="font-label text-xs text-afs-ink-700 hover:text-afs-ink-900 shrink-0"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
