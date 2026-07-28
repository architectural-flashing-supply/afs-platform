'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FetchResult {
  fetched: number;
  newProjects: number;
  errors: string[];
}

const SCHEDULE_STORAGE_KEY = 'afs-bid-monitor-daily-fetch';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BidMonitorFetchControls({ initialLastFetchedAt }: { initialLastFetchedAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(initialLastFetchedAt);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduleDaily, setScheduleDaily] = useState(false);

  // Reads the placeholder flag on mount only (not SSR'd — this is a purely
  // client-side toggle, see the note on the checkbox below).
  useEffect(() => {
    setScheduleDaily(window.localStorage.getItem(SCHEDULE_STORAGE_KEY) === 'true');
  }, []);

  const handleFetchNow = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bid-monitor/fetch', { method: 'POST' });
      const data = (await res.json()) as FetchResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Fetch failed. Please try again.');
        setBusy(false);
        return;
      }
      setResult({ fetched: data.fetched, newProjects: data.newProjects, errors: data.errors ?? [] });
      setLastFetchedAt(new Date().toISOString());
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSchedule = () => {
    const next = !scheduleDaily;
    setScheduleDaily(next);
    window.localStorage.setItem(SCHEDULE_STORAGE_KEY, String(next));
  };

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={handleFetchNow}
            disabled={busy}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-5 py-2.5 rounded transition-colors disabled:opacity-50"
          >
            {busy ? 'Fetching…' : 'Fetch Now'}
          </button>
          <p className="font-body text-xs text-afs-chrome-mid mt-2">
            Last fetch: <span className="text-afs-chrome-high">{formatDateTime(lastFetchedAt)}</span>
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={scheduleDaily} onChange={handleToggleSchedule} className="accent-afs-crimson w-4 h-4" />
          <span className="font-label text-sm text-afs-chrome-mid">Schedule Daily Fetch</span>
        </label>
      </div>

      {scheduleDaily && (
        <p className="font-body text-xs text-afs-chrome-dim mt-3">
          Flag saved locally. No Vercel Cron route exists yet to actually run this daily — vercel.json has no cron
          entries (see STATE_OF_THE_BUILD.md). This toggle is the setting a future{' '}
          <code className="font-data">app/api/cron/bid-monitor-fetch</code> route would read.
        </p>
      )}

      {error && <p className="font-body text-sm text-afs-crimson mt-4">{error}</p>}

      {result && !error && (
        <div className="mt-4 bg-afs-bg-surface border border-afs-border rounded p-4">
          <p className="font-body text-sm text-afs-chrome-high">
            Fetched <span className="font-data">{result.fetched}</span> opportunities —{' '}
            <span className="font-data text-afs-success">{result.newProjects} new</span>.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc list-inside">
              {result.errors.map((err) => (
                <li key={err} className="font-body text-xs text-afs-amber">
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
