'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectStatusActionsProps {
  projectId: string;
  status: 'active' | 'completed' | 'archived';
}

export default function ProjectStatusActions({ projectId, status }: ProjectStatusActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(next: 'completed' | 'archived' | 'active') {
    setLoading(next);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not update project status.');
        setLoading(null);
        return;
      }
      router.refresh();
    } catch {
      setError('Could not update project status.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {status !== 'archived' && (
          <button
            type="button"
            onClick={() => updateStatus(status === 'completed' ? 'active' : 'completed')}
            disabled={loading !== null}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading === 'completed' || loading === 'active'
              ? 'Updating…'
              : status === 'completed'
              ? 'Mark Active'
              : 'Mark Complete'}
          </button>
        )}
        {status !== 'archived' ? (
          <button
            type="button"
            onClick={() => updateStatus('archived')}
            disabled={loading !== null}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading === 'archived' ? 'Archiving…' : 'Archive'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => updateStatus('active')}
            disabled={loading !== null}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading === 'active' ? 'Restoring…' : 'Unarchive'}
          </button>
        )}
      </div>
      {error && <span className="font-body text-xs text-afs-crimson">{error}</span>}
    </div>
  );
}
