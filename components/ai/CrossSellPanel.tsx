'use client';

import { useEffect, useState } from 'react';

interface CrossSellSuggestion {
  accessory: string;
  reason: string;
}

interface CrossSellResponse {
  suggestions: CrossSellSuggestion[];
}

interface CrossSellPanelProps {
  profileTypes: string[];
  materials: string[];
  onSelectionChange: (selected: string[]) => void;
}

function shouldFireCrossSell(profileTypes: string[], materials: string[]): boolean {
  const distinctProfiles = new Set(profileTypes.filter((p) => p.trim().length > 0));
  return distinctProfiles.size >= 3 || materials.includes('Copper');
}

export default function CrossSellPanel({ profileTypes, materials, onSelectionChange }: CrossSellPanelProps) {
  const [suggestions, setSuggestions] = useState<CrossSellSuggestion[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const fires = shouldFireCrossSell(profileTypes, materials);

  useEffect(() => {
    if (!fires) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/recommendations/cross-sell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileTypes, materials }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as CrossSellResponse;
        if (!cancelled) setSuggestions(data.suggestions);
      } catch {
        // Silent — cross-sell is a non-blocking enhancement
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fires, JSON.stringify(profileTypes), JSON.stringify(materials)]);

  const toggle = (accessory: string) => {
    setChecked((prev) => {
      const next = { ...prev, [accessory]: !prev[accessory] };
      onSelectionChange(Object.keys(next).filter((k) => next[k]));
      return next;
    });
  };

  if (!fires || suggestions.length === 0) return null;

  return (
    <div className="bg-afs-bg-surface border border-afs-border rounded p-6 mt-6">
      <p className="font-label text-xs uppercase tracking-wide text-afs-ink-700 mb-4">
        You may also need:
      </p>
      <div className="space-y-3">
        {suggestions.map((s) => (
          <label
            key={s.accessory}
            className="flex items-start gap-3 bg-afs-bg-raised border border-afs-chrome-dim rounded p-4 cursor-pointer hover:border-afs-chrome-base transition-colors"
          >
            <input
              type="checkbox"
              checked={Boolean(checked[s.accessory])}
              onChange={() => toggle(s.accessory)}
              className="mt-1 accent-afs-crimson"
            />
            <span>
              <span className="font-heading text-base text-afs-ink-900 block mb-1">{s.accessory}</span>
              <span className="font-body text-sm text-afs-ink-700">{s.reason}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
