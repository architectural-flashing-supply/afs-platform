'use client';

import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 30_000;

export default function MachineBridgeStatusDot() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/machine-bridge/status');
        if (!res.ok) {
          if (!cancelled) setConnected(false);
          return;
        }
        const data = (await res.json()) as { connected: boolean; lastPingAt: string | null };
        if (!cancelled) {
          setConnected(data.connected);
          setLastPingAt(data.lastPingAt);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    check();
    const handle = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  const dotClass = connected === null ? 'bg-afs-chrome-dim' : connected ? 'bg-afs-success' : 'bg-afs-crimson';
  const label = connected === null ? 'Checking…' : connected ? 'Machine Bridge Connected' : 'Machine Bridge Offline';

  return (
    <div className="flex items-center gap-2" title={lastPingAt ? `Last ping: ${new Date(lastPingAt).toLocaleString()}` : 'No ping recorded yet'}>
      <span className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
      <span className="font-label text-xs text-afs-chrome-mid">{label}</span>
    </div>
  );
}
