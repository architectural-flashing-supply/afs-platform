'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UseTemplateButtonProps {
  templateId: string;
}

interface UseTemplateResponse {
  redirectUrl: string;
}

export default function UseTemplateButton({ templateId }: UseTemplateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
      const data = (await res.json()) as UseTemplateResponse | { error: string };
      if (!res.ok) {
        setError('error' in data ? data.error : 'Could not load template.');
        setLoading(false);
        return;
      }
      router.push((data as UseTemplateResponse).redirectUrl);
    } catch {
      setError('Could not load template. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleUse}
        disabled={loading}
        data-testid="use-template-button"
        className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 py-2 rounded text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Use Template'}
      </button>
      {error && <span className="font-body text-xs text-afs-crimson">{error}</span>}
    </div>
  );
}
