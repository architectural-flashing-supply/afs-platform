'use client';

import { useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import SavedConfigCard, { type SavedConfig } from './SavedConfigCard';

export default function SavedProfilesBrowser({ configs }: { configs: SavedConfig[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return configs;
    return configs.filter((c) =>
      [c.name, c.profileName, c.materialName, c.gaugeLabel]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(term))
    );
  }, [configs, search]);

  return (
    <div>
      <div className="mb-8 max-w-md">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by profile type or material…"
          className="w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-copper transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No custom profiles match your search"
          description="Try a different profile type or material, or clear your search."
          actionLabel="Configure a Profile"
          actionHref="/configure"
          accent="copper"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((c) => (
            <SavedConfigCard key={c.id} config={c} />
          ))}
        </div>
      )}
    </div>
  );
}
