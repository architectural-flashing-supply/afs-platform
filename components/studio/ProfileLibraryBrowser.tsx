'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';
import { formatInches } from '@/lib/utils/format-inches';
import type { ProfileBend } from '@/components/studio/ProfileViewer3D';

// Three.js touches the canvas/window at import time — same reason every
// other ProfileViewer3D call site in this codebase (FlashDraft, the
// standalone profile-viewer route, SubmitConfirmation3DModal) loads it this
// way, not just this one.
const ProfileViewer3D = dynamic(() => import('@/components/studio/ProfileViewer3D'), {
  ssr: false,
  loading: () => <div className="w-full h-[220px] bg-afs-bg-dim rounded animate-pulse" />,
});

const MM_PER_IN = 25.4;

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

function ProfileLibraryModal({ profile, onClose }: { profile: LibraryProfileCardData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6" onClick={onClose}>
      <div
        className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-2xl text-afs-chrome-high mb-4">{profile.nameEn}</h2>
        <BendSequenceDiagram bends={profile.bends} className="w-[500px] h-[400px] max-w-full bg-afs-bg-dim rounded mx-auto mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Blank Width</p>
            <p className="font-data text-sm text-afs-chrome-high">
              {profile.blankWidthIn != null ? `${profile.blankWidthIn.toFixed(3)}"` : '—'}
              {profile.blankWidthMm != null ? ` / ${profile.blankWidthMm.toFixed(1)}mm` : ''}
            </p>
          </div>
          <div>
            <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Bend Count</p>
            <p className="font-data text-sm text-afs-chrome-high">{profile.bendCount}</p>
          </div>
        </div>
        {profile.bends.length > 0 && (
          <div className="mb-4">
            <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-2">Bend Sequence</p>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {profile.bends.map((b, i) => (
                <p key={i} className="font-data text-xs text-afs-chrome-mid">
                  Step {i + 1}: left leg {b.leftLegMm != null ? formatInches(b.leftLegMm / MM_PER_IN) : '—'}, turn{' '}
                  {b.bendAngleDegrees != null ? `${b.bendAngleDegrees.toFixed(1)}°` : '—'}, right leg{' '}
                  {b.rightLegMm != null ? formatInches(b.rightLegMm / MM_PER_IN) : '—'}
                </p>
              ))}
            </div>
          </div>
        )}
        <p className="font-body text-sm text-afs-chrome-dim mb-6">
          Fabricated {profile.fabricatedCount} time{profile.fabricatedCount === 1 ? '' : 's'} in shop history
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors"
          >
            Close
          </button>
          <Link
            href={`/studio/draft?loadProfile=${profile.id}`}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
          >
            Load into FlashDraft
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProfileLibraryBrowser({
  profiles,
  categories,
  compact = false,
  limit,
  show3DToggle = false,
}: {
  profiles: LibraryProfileCardData[];
  categories: string[];
  /**
   * Homepage-style presentation (ProfileExplorer): category filter chips
   * above the grid instead of the full sidebar, no search/width/bend-count
   * filters, no compare tray. Defaults to false so /studio/library's
   * existing full browser is unchanged.
   */
  compact?: boolean;
  /** Caps the grid to the first N filtered profiles. Omit to show all. */
  limit?: number;
  /**
   * Per-card "View in 3D" toggle that swaps the BendSequenceDiagram
   * thumbnail for an inline ProfileViewer3D of that profile's real
   * geometry. Hidden on cards with no bend data. Defaults to false so
   * /studio/library's existing cards are unchanged.
   */
  show3DToggle?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [minWidth, setMinWidth] = useState('');
  const [maxWidth, setMaxWidth] = useState('');
  const [minBends, setMinBends] = useState('');
  const [maxBends, setMaxBends] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [modalProfile, setModalProfile] = useState<LibraryProfileCardData | null>(null);
  const [open3DIds, setOpen3DIds] = useState<string[]>([]);

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

  const visible = typeof limit === 'number' ? filtered.slice(0, limit) : filtered;

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const toggle3D = (id: string) => {
    setOpen3DIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const compareProfiles = compact ? [] : profiles.filter((p) => compareIds.includes(p.id));

  const viewerPropsFor = (p: LibraryProfileCardData) => ({
    bends: p.bends.map(
      (b): ProfileBend => ({
        leftLeg: b.leftLegMm ?? 0,
        rightLeg: b.rightLegMm ?? 0,
        angle: b.bendAngleDegrees ?? 180,
        radius: b.radiusMm ?? 0,
      })
    ),
    blankWidth: p.blankWidthMm ?? (p.blankWidthIn != null ? p.blankWidthIn * MM_PER_IN : 0),
  });

  const categoryChips = compact && (
    <div className="flex flex-wrap gap-2 mb-6" data-testid="profile-library-chips">
      {['all', ...categories].map((c) => (
        <button
          key={c}
          type="button"
          data-testid="profile-library-chip"
          data-category={c}
          onClick={() => setCategory(c)}
          className={`font-label text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
            category === c
              ? 'bg-afs-crimson border-afs-crimson text-white'
              : 'border-afs-border bg-afs-bg-overlay text-afs-chrome-mid hover:bg-afs-bg-surface'
          }`}
        >
          {c === 'all' ? 'All' : c}
        </button>
      ))}
    </div>
  );

  const grid =
    visible.length === 0 ? (
      <p className="font-body text-sm text-afs-chrome-mid py-12 text-center">No profiles match these filters.</p>
    ) : (
      <div
        className="grid gap-4"
        data-testid="profile-library-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
      >
        {visible.map((p) => {
          const isComparing = compareIds.includes(p.id);
          const hasGeometry = p.bendCount > 0;
          const is3DOpen = show3DToggle && open3DIds.includes(p.id);
          return (
            <div
              key={p.id}
              data-testid="profile-library-card"
              onClick={() => setModalProfile(p)}
              className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-4 flex flex-col gap-2 cursor-pointer hover:border-afs-crimson transition-colors"
            >
              {is3DOpen ? (
                <ProfileViewer3D {...viewerPropsFor(p)} material="" gauge="" thicknessMm={0} className="w-full h-[180px] bg-afs-bg-dim rounded" />
              ) : (
                <BendSequenceDiagram bends={p.bends} className="w-[240px] h-[180px] bg-afs-bg-dim rounded mx-auto" />
              )}
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
              <div className="flex flex-wrap gap-2 mt-1">
                <Link
                  href={`/studio/draft?loadProfile=${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                >
                  Load into FlashDraft
                </Link>
                {show3DToggle && hasGeometry && (
                  <button
                    type="button"
                    data-testid="profile-library-3d-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle3D(p.id);
                    }}
                    className="font-label text-xs font-semibold px-3 py-2 rounded border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface transition-colors"
                  >
                    {is3DOpen ? 'View 2D' : 'View in 3D'}
                  </button>
                )}
                {!compact && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCompare(p.id);
                    }}
                    disabled={!isComparing && compareIds.length >= MAX_COMPARE}
                    className={`font-label text-xs font-semibold px-3 py-2 rounded border transition-colors disabled:opacity-40 ${
                      isComparing
                        ? 'bg-afs-accent-green/20 border-afs-accent-green text-afs-chrome-high'
                        : 'border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface'
                    }`}
                  >
                    {isComparing ? 'Comparing' : 'Compare'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

  if (compact) {
    return (
      <div>
        {categoryChips}
        {grid}
        {modalProfile && (
          <ProfileLibraryModal profile={modalProfile} onClose={() => setModalProfile(null)} />
        )}
      </div>
    );
  }

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
              <option value="all">All Profiles</option>
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
        <div className="flex-1 min-w-0">{grid}</div>
      </div>

      {compareProfiles.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-afs-bg-raised border-t border-afs-chrome-dim p-4">
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

      {modalProfile && <ProfileLibraryModal profile={modalProfile} onClose={() => setModalProfile(null)} />}
    </div>
  );
}
