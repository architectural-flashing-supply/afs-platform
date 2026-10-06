'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RetryButton({ messageId, label, force }: { messageId: string; label: string; force?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await fetch('/api/admin/email-intake/retry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messageId, force }) });
            const j = await r.json();
            setMsg(r.ok ? j.status : j.error ?? 'failed');
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded border border-neutral-400 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
      >
        {busy ? 'Working…' : label}
      </button>
      {msg && <span className="ml-2 text-xs text-neutral-600">{msg}</span>}
    </span>
  );
}
