'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ReorderResponse {
  redirectUrl: string;
}

interface ReorderErrorResponse {
  error: string;
}

interface ReorderButtonProps {
  orderId: string;
  className?: string;
  label?: string;
}

export default function ReorderButton({ orderId, className, label = 'Reorder' }: ReorderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReorder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, { method: 'POST' });
      const data = (await res.json()) as ReorderResponse | ReorderErrorResponse;
      if (!res.ok) {
        setError('error' in data ? data.error : 'Reorder failed. Please try again.');
        setLoading(false);
        return;
      }
      router.push((data as ReorderResponse).redirectUrl);
    } catch {
      setError('Reorder failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleReorder}
        disabled={loading}
        data-testid="reorder-button"
        className={
          className ??
          'font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none'
        }
      >
        {loading ? 'Preparing…' : label}
      </button>
      {error && <span className="font-body text-xs text-afs-crimson">{error}</span>}
    </div>
  );
}
