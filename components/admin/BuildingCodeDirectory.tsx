'use client';

import { useMemo, useState } from 'react';
import type { BuildingCodeJurisdictionRow, BuildingCodeStatus, BuildingCodeJurisdictionType } from '@/lib/data/building-codes';

const TYPE_TABS = ['all', 'county', 'city'] as const;
type TypeTab = (typeof TYPE_TABS)[number];

const STATUS_FILTERS = ['all', 'verified_link', 'no_code_adopted', 'unresolved'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const TYPE_LABEL: Record<TypeTab, string> = {
  all: 'All',
  county: 'Counties',
  city: 'Cities',
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'All Statuses',
  verified_link: 'Verified Link',
  no_code_adopted: 'No Code Adopted',
  unresolved: 'Unresolved',
};

const STATUS_BADGE: Record<BuildingCodeStatus, string> = {
  verified_link: 'border-afs-success text-afs-success',
  no_code_adopted: 'border-afs-chrome-dim text-afs-chrome-mid',
  unresolved: 'border-afs-amber text-afs-amber',
};

const STATUS_DOT: Record<BuildingCodeStatus, string> = {
  verified_link: 'bg-afs-success',
  no_code_adopted: 'bg-afs-chrome-dim',
  unresolved: 'bg-afs-amber',
};

function jurisdictionLabel(type: BuildingCodeJurisdictionType): string {
  return type === 'county' ? 'County' : 'City';
}

export default function BuildingCodeDirectory({ rows }: { rows: BuildingCodeJurisdictionRow[] }) {
  const [typeTab, setTypeTab] = useState<TypeTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeTab !== 'all' && r.jurisdictionType !== typeTab) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.countyName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, typeTab, statusFilter, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1 border-b border-afs-border">
          {TYPE_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeTab(t)}
              className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                typeTab === t ? 'border-afs-crimson text-afs-chrome-high' : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-afs-bg-raised border border-afs-border rounded font-label text-xs text-afs-chrome-high px-3 py-2"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jurisdiction…"
            className="bg-afs-bg-raised border border-afs-border rounded font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim px-3 py-2 w-56"
          />
        </div>
      </div>

      <p className="font-data text-xs text-afs-chrome-dim mb-3">
        Showing {filtered.length} of {rows.length}
      </p>

      <div className="border border-afs-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-raised border-b border-afs-border">
              <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">Jurisdiction</th>
              <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">Type</th>
              <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">County</th>
              <th className="text-right font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">Population</th>
              <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">Status</th>
              <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">Link</th>
              <th className="text-left font-label text-xs uppercase tracking-wide text-afs-chrome-dim px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors align-top">
                <td className="font-heading text-sm text-afs-chrome-high px-4 py-3 whitespace-nowrap">
                  {r.name}
                  {r.jurisdictionType === 'county' ? ' County' : ''}
                </td>
                <td className="font-label text-xs text-afs-chrome-mid px-4 py-3">{jurisdictionLabel(r.jurisdictionType)}</td>
                <td className="font-body text-xs text-afs-chrome-mid px-4 py-3">{r.countyName ?? '—'}</td>
                <td className="font-data text-xs text-afs-chrome-mid px-4 py-3 text-right whitespace-nowrap">
                  {r.population ? r.population.toLocaleString('en-US') : '—'}
                  {r.populationBasis && <span className="text-afs-chrome-dim"> ({r.populationBasis})</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 font-label text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 whitespace-nowrap ${STATUS_BADGE[r.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status]}`} aria-hidden />
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-label text-xs text-afs-crimson hover:text-afs-chrome-high transition-colors"
                    >
                      Visit →
                    </a>
                  ) : (
                    <span className="font-label text-xs text-afs-chrome-dim">No link</span>
                  )}
                </td>
                <td className="font-body text-xs text-afs-chrome-mid px-4 py-3 max-w-xs">
                  {r.status === 'unresolved' ? r.unresolvedReason : r.notes}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="font-body text-sm text-afs-chrome-dim px-4 py-8 text-center">
                  No jurisdictions match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
