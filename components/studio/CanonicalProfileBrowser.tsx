'use client';

import { useMemo, useState } from 'react';
import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';

export interface CanonicalBend {
  leftLegIn: number;
  rightLegIn: number;
  angleDegrees: number;
  direction: 'up' | 'down';
}

export interface CanonicalProfileCardData {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  blankWidthIn: number;
  points: { x: number; y: number }[];
  bends: CanonicalBend[];
  tags: string[];
}

// Loading into FlashDraft hands off the already-final `points` array via
// localStorage rather than re-deriving it from `bends` through
// lib/flashdraft/geometry.ts's computeProfilePoints: that reconstruction
// assumes every bend turns the same rotational direction (it has no
// up/down concept), which would silently mangle any of these profiles with
// alternating bends (most of them). See app/studio/draft/page.tsx's
// `loadCanonical` handling for the other half of this handoff.
const FLASHDRAFT_HANDOFF_KEY = 'afs-flashdraft-canonical-points';

export default function CanonicalProfileBrowser({ profiles }: { profiles: CanonicalProfileCardData[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [modalProfile, setModalProfile] = useState<CanonicalProfileCardData | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set(profiles.map((p) => p.category))).sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (needle && !`${p.name} ${p.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [profiles, category, search]);

  const loadIntoFlashDraft = (profile: CanonicalProfileCardData) => {
    try {
      window.localStorage.setItem(FLASHDRAFT_HANDOFF_KEY, JSON.stringify(profile.points));
    } catch {
      // localStorage unavailable — FlashDraft's loadCanonical handler will
      // no-op if the key is missing, same as a blocked-storage machine
      // profile load.
    }
    window.location.href = '/studio/draft?loadCanonical=1';
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* FILTER SIDEBAR */}
      <aside className="w-full lg:w-[260px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-5 flex flex-col gap-4 h-fit">
        <div>
          <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="canonical-search">
            Search
          </label>
          <input
            id="canonical-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or tag"
            className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
          />
        </div>
        <div>
          <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="canonical-category">
            Category
          </label>
          <select
            id="canonical-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
          >
            <option value="all">All Profiles</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setModalProfile(p)}
                className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-4 flex flex-col gap-2 cursor-pointer hover:border-afs-crimson transition-colors"
              >
                <div className="w-[240px] h-[180px] bg-afs-bg-dim rounded mx-auto">
                  <CanonicalProfileDiagram points={p.points} width={240} height={180} />
                </div>
                <h3 className="font-heading text-base text-afs-chrome-high leading-tight">{p.name}</h3>
                <p className="font-data text-xs text-afs-chrome-dim">{p.category}</p>
                <div className="font-body text-xs text-afs-chrome-mid flex items-center justify-between">
                  <span>{p.blankWidthIn.toFixed(3)}&quot;</span>
                  <span>
                    {p.bends.length} bend{p.bends.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadIntoFlashDraft(p);
                    }}
                    className="flex-1 text-center bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                  >
                    Load into FlashDraft
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalProfile && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6"
          onClick={() => setModalProfile(null)}
        >
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-2xl text-afs-chrome-high mb-4">{modalProfile.name}</h2>
            <div className="w-[500px] h-[400px] max-w-full bg-afs-bg-dim rounded mx-auto mb-4">
              <CanonicalProfileDiagram points={modalProfile.points} width={500} height={400} />
            </div>
            {modalProfile.description && (
              <p className="font-body text-sm text-afs-chrome-mid mb-4">{modalProfile.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Blank Width</p>
                <p className="font-data text-sm text-afs-chrome-high">{modalProfile.blankWidthIn.toFixed(3)}&quot;</p>
              </div>
              <div>
                <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Bend Count</p>
                <p className="font-data text-sm text-afs-chrome-high">{modalProfile.bends.length}</p>
              </div>
            </div>
            {modalProfile.bends.length > 0 && (
              <div className="mb-4">
                <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-2">Bend Sequence</p>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {modalProfile.bends.map((b, i) => (
                    <p key={i} className="font-data text-xs text-afs-chrome-mid">
                      Step {i + 1}: left leg {b.leftLegIn.toFixed(3)}&quot;, turn {b.direction} {b.angleDegrees.toFixed(0)}°, right leg{' '}
                      {b.rightLegIn.toFixed(3)}&quot;
                    </p>
                  ))}
                </div>
              </div>
            )}
            {modalProfile.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {modalProfile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-mid border border-afs-border rounded px-2 py-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModalProfile(null)}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => loadIntoFlashDraft(modalProfile)}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
              >
                Load into FlashDraft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
