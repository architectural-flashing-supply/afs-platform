'use client';

import { useEffect, useState } from 'react';
import { STOCK_TYPE_LABEL, type StockType } from '@/lib/data/catalog';

interface MaterialAlternative {
  material: string;
  stockStatus: StockType;
  reason: string;
}

interface MaterialRecResponse {
  recommend: boolean;
  message: string;
  alternatives: MaterialAlternative[];
}

interface MaterialRecommendationPanelProps {
  material: string;
  profileType: string;
  stockStatus: StockType;
  onSelectAlternative: (material: string) => void;
}

export default function MaterialRecommendationPanel({
  material,
  profileType,
  stockStatus,
  onSelectAlternative,
}: MaterialRecommendationPanelProps) {
  const [result, setResult] = useState<MaterialRecResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    setResult(null);

    if (stockStatus !== 'special_order' || !material || !profileType) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/recommendations/material', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ material, profileType, stockStatus }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as MaterialRecResponse;
        if (!cancelled) setResult(data);
      } catch {
        // Silent — material guidance is a non-blocking enhancement
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [material, profileType, stockStatus]);

  if (dismissed || !result || !result.recommend || result.alternatives.length === 0) {
    return null;
  }

  return (
    <div className="bg-afs-bg-surface border border-afs-border rounded p-6 mt-6">
      <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-base mb-3">
        Material Guidance
      </p>
      <p className="font-body text-sm text-afs-chrome-mid mb-5">{result.message}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {result.alternatives.map((alt) => (
          <div
            key={alt.material}
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-heading text-base text-afs-chrome-high">{alt.material}</span>
              <span className="font-label text-xs uppercase text-afs-chrome-dim border border-afs-chrome-dim rounded px-2 py-0.5">
                {STOCK_TYPE_LABEL[alt.stockStatus]}
              </span>
            </div>
            <p className="font-body text-sm text-afs-chrome-mid mb-4">{alt.reason}</p>
            <button
              type="button"
              onClick={() => onSelectAlternative(alt.material)}
              className="mt-auto bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors"
            >
              Select This Instead
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="font-body text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors"
      >
        Keep My Selection
      </button>
    </div>
  );
}
