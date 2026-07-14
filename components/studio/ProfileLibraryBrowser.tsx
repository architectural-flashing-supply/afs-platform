'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';

export interface LibraryProfileCardData {
  id: string;
  nameEn: string;
  profileNumber: string;
  categoryName: string;
  blankWidthIn: number | null;
  blankWidthMm: number | null;
  bendCount: number;
  bends: { leftLegMm: number | null; rightLegMm: number | null; bendAngleDegrees: number | null; radiusMm: number | null }[];
  fabricatedCount: number;
}

const MAX_COMPARE = 3;

export default function ProfileLibraryBrowser({ profiles }: { profiles: LibraryProfileCardData[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [minWidth, setMinWidth] = useState('');
  const [maxWidth, setMaxWidth] = useState('');
  const [minBends, setMinBends] = useState('');
  const [maxBends, setMaxBends] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const categories = useMemo(() => {
    return Array.from(new Set(profiles.map((p) => p.categoryName))).sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (category !== 'all' && p.categoryName !== category) return false;
      if (needle && !`${p.nameEn} ${p.profileNumber}`.toLowerCase().includes(needle)) return false;
      if (minWidth && (p.blankWidthIn ?? 0) < Number(minWidth)) return false;
      if (maxWidth && (p.blankWidthIn ?? Infinity) > Number(maxWidth)) return false;
      if (minBends && p.bendCount < Number(minBends)) return false;
      if (maxBends && p.bendCount > Number(maxBends)) return false;
      return true;
    });
  }, [profiles, category, search, minWidth, maxWidth, minBends, maxBends]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const compareProfiles = profiles.filter((p) => compareIds.includes(p.id));

  return (
    <div className={compareProfiles.length > 0 ? 'pb-56' : ''}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* FILTER SIDEBAR */}
        <aside className="w-full lg:w-[260px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-5 flex flex-col gap-4 h-fit">
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="lib-search">
              Search
            </label>
            <input
              id="lib-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or #"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="lib-category">
              Category
            </label>
            <select
              id="lib-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">Blank Width (in)</span>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={minWidth}
                onChange={(e) => setMinWidth(e.target.value)}
                placeholder="Min"
                className="w-1/2 bg-afs-bg-overlay border border-afs-border rounded px-2 py-2 font-data text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
              />
              <input
                type="number"
                min="0"
                value={maxWidth}
                onChange={(e) => setMaxWidth(e.target.value)}
                placeholder="Max"
                className="w-1/2 bg-afs-bg-overlay border border-afs-border rounded px-2 py-2 font-data text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
              />
            </div>
          </div>
          <div>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">Bend Count</span>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={minBends}
                onChange={(e) => setMinBends(e.target.value)}
                placeholder="Min"
                className="w-1/2 bg-afs-bg-overlay border border-afs-border rounded px-2 py-2 font-data text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
              />
              <input
                type="number"
                min="0"
                value={maxBends}
                onChange={(e) => setMaxBends(e.target.value)}
                placeholder="Max"
                className="w-1/2 bg-afs-bg-overlay border border-afs-border rounded px-2 py-2 font-data text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
              />
            </div>
          </div>
          <p className="font-body text-xs text-afs-chrome-dim">
            {filtered.length} of {profiles.length} profiles
          </p>
        </aside>

        {/* GRID */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <p className="font-body text-sm text-afs-chrome-mid py-12 text-center">No profiles match these filters.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const isComparing = compareIds.includes(p.id);
                return (
                  <div key={p.id} className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-4 flex flex-col gap-2">
                    <BendSequenceDiagram bends={p.bends} />
                    <h3 className="font-heading text-base text-afs-chrome-high leading-tight">{p.nameEn}</h3>
                    <p className="font-data text-xs text-afs-chrome-dim">
                      #{p.profileNumber} · {p.categoryName}
                    </p>
                    <div className="font-body text-xs text-afs-chrome-mid flex items-center justify-between">
                      <span>
                        {p.blankWidthIn != null ? `${p.blankWidthIn.toFixed(3)}"` : '—'}
                        {p.blankWidthMm != null ? ` / ${p.blankWidthMm.toFixed(1)}mm` : ''}
                      </span>
                      <span>
                        {p.bendCount} bend{p.bendCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="font-body text-[11px] text-afs-chrome-dim">
                      Fabricated {p.fabricatedCount} time{p.fabricatedCount === 1 ? '' : 's'}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Link
                        href={`/studio/draft?loadProfile=${p.id}`}
                        className="flex-1 text-center bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                      >
                        Load into FlashDraft
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleCompare(p.id)}
                        disabled={!isComparing && compareIds.length >= MAX_COMPARE}
                        className={`font-label text-xs font-semibold px-3 py-2 rounded border transition-colors disabled:opacity-40 ${
                          isComparing
                            ? 'bg-afs-accent-green/20 border-afs-accent-green text-afs-chrome-high'
                            : 'border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface'
                        }`}
                      >
                        {isComparing ? 'Comparing' : 'Compare'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {compareProfiles.length > 0 && (
        <div className="fixed bottom-0 left-0 lg:left-48 right-0 z-40 bg-afs-bg-raised border-t border-afs-chrome-dim p-4">
          <div className="flex items-center justify-between mb-3 max-w-4xl">
            <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">
              Compare ({compareProfiles.length}/{MAX_COMPARE})
            </p>
            <button type="button" onClick={() => setCompareIds([])} className="font-label text-xs text-afs-crimson hover:underline">
              Clear
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-4xl">
            {compareProfiles.map((p) => (
              <div key={p.id} className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-2">
                <BendSequenceDiagram bends={p.bends} />
                <p className="font-body text-xs text-afs-chrome-high truncate mt-1">{p.nameEn}</p>
                <p className="font-data text-[10px] text-afs-chrome-dim">
                  {p.blankWidthIn != null ? `${p.blankWidthIn.toFixed(3)}"` : '—'} · {p.bendCount} bends
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
