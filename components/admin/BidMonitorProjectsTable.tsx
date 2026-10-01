'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmptyState from '@/components/ui/EmptyState';
import type { BidProjectListRow } from '@/lib/data/bid-monitor';

const SOURCE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'federal', label: 'Federal' },
  { value: 'texas_state', label: 'Texas State' },
  { value: 'city_county', label: 'City/County' },
  { value: 'dot', label: 'DOT' },
  { value: 'planroom', label: 'Plan Room' },
] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number]['value'];

// 'bid_submitted' and 'expired' are real bid_projects.status values (see
// VALID_STATUSES in app/api/bid-monitor/projects/[id]/route.ts) but have no
// dedicated filter chip per this dashboard's spec — they're still visible
// under "All" and still get a real status badge + Track option below.
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'bidding', label: 'Bidding' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'passed', label: 'Passed' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const TRACK_STATUSES = [
  'new',
  'reviewing',
  'bidding',
  'bid_submitted',
  'won',
  'lost',
  'passed',
  'expired',
] as const;

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  bidding: 'Bidding',
  bid_submitted: 'Bid Submitted',
  won: 'Won',
  lost: 'Lost',
  passed: 'Passed',
  expired: 'Expired',
};

const STATUS_CHIP_CLASS: Record<string, string> = {
  new: 'border-afs-info text-afs-info-on-dark',
  reviewing: 'border-afs-amber text-afs-warning-on-dark',
  bidding: 'border-afs-crimson text-afs-danger-on-dark',
  bid_submitted: 'border-afs-copper text-afs-chrome-silver',
  won: 'border-afs-success text-afs-success-on-dark',
  lost: 'border-afs-chrome-dim text-afs-chrome-silver',
  passed: 'border-afs-chrome-dim text-afs-chrome-silver',
  expired: 'border-afs-chrome-dim text-afs-chrome-silver',
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  city: 'City',
  county: 'County',
  dot: 'DOT',
  planroom: 'Plan Room',
  exchange: 'Exchange',
};

const SOURCE_TYPE_CHIP_CLASS: Record<string, string> = {
  federal: 'border-afs-info text-afs-info-on-dark',
  state: 'border-afs-success text-afs-success-on-dark',
  city: 'border-afs-copper text-afs-chrome-silver',
  county: 'border-afs-copper text-afs-chrome-silver',
  dot: 'border-afs-amber text-afs-warning-on-dark',
  planroom: 'border-afs-chrome-base text-afs-chrome-silver',
  exchange: 'border-afs-chrome-base text-afs-chrome-silver',
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isDueSoon(iso: string | null): boolean {
  if (!iso) return false;
  const dueMs = new Date(iso).getTime();
  return dueMs - Date.now() <= 7 * 24 * 60 * 60 * 1000;
}

function matchesSourceFilter(project: BidProjectListRow, filter: SourceFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'federal':
      return project.sourceType === 'federal';
    case 'texas_state':
      return project.sourceType === 'state' && project.sourceState === 'TX';
    case 'city_county':
      return project.sourceType === 'city' || project.sourceType === 'county';
    case 'dot':
      return project.sourceType === 'dot';
    case 'planroom':
      return project.sourceType === 'planroom' || project.sourceType === 'exchange';
    default:
      return true;
  }
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block border rounded font-label text-[10px] uppercase tracking-wide px-1.5 py-0.5 whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function TrackDropdown({ project }: { project: BidProjectListRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value;
    if (status === project.status) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bid-monitor/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not update status.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={project.status}
        onChange={handleChange}
        disabled={busy}
        className="bg-afs-bg-overlay border border-afs-chrome-base rounded text-xs font-label text-afs-chrome-high px-2 py-1 disabled:opacity-50"
      >
        {TRACK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error && <p className="font-body text-[10px] text-afs-danger-on-dark">{error}</p>}
    </div>
  );
}

export default function BidMonitorProjectsTable({ projects }: { projects: BidProjectListRow[] }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          matchesSourceFilter(p, sourceFilter) && (statusFilter === 'all' || p.status === statusFilter)
      ),
    [projects, sourceFilter, statusFilter]
  );

  if (projects.length === 0) {
    return (
      <EmptyState title="No matching opportunities found." description='Click "Fetch Now" to scan sources.' />

    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
        <div className="flex items-center gap-1 flex-wrap">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSourceFilter(f.value)}
              className={`font-label text-xs px-3 py-1.5 rounded transition-colors ${
                sourceFilter === f.value
                  ? 'bg-afs-crimson text-white'
                  : 'bg-afs-bg-overlay text-afs-chrome-silver hover:bg-afs-bg-surface hover:text-afs-chrome-high'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="w-px h-5 bg-afs-border hidden sm:block" />
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`font-label text-xs px-3 py-1.5 rounded transition-colors ${
                statusFilter === f.value
                  ? 'bg-afs-bg-surface text-afs-chrome-high border border-afs-chrome-mid'
                  : 'bg-afs-bg-overlay text-afs-chrome-silver hover:bg-afs-bg-surface hover:text-afs-chrome-high border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-body text-sm text-afs-chrome-mid py-8 text-center border border-afs-border rounded bg-afs-bg-raised">
          No opportunities match these filters.
        </p>
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-afs-border">
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Project</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Source</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Location</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Bid Due</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Est. Value</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Keywords</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Status</th>
                <th className="font-label text-xs uppercase tracking-wide text-afs-chrome-silver px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => {
                const dueSoon = isDueSoon(project.bidDueDate);
                const extraKeywords = project.keywordsMatched.length - 3;
                return (
                  <tr key={project.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                    <td className="px-4 py-3 align-top max-w-[280px]">
                      <p className="font-body text-sm text-afs-chrome-high" title={project.title}>
                        {truncate(project.title, 60)}
                      </p>
                      {project.division7Relevant && (
                        <span className="inline-block mt-1 eyebrow-label text-[10px] tracking-wide">
                          Division 7 Match
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Chip className={SOURCE_TYPE_CHIP_CLASS[project.sourceType] ?? 'border-afs-chrome-dim text-afs-chrome-silver'}>
                        {SOURCE_TYPE_LABEL[project.sourceType] ?? project.sourceType}
                      </Chip>
                      <p className="font-body text-xs text-afs-chrome-mid mt-1">{project.sourceName}</p>
                    </td>
                    <td className="px-4 py-3 align-top font-body text-xs text-afs-chrome-mid whitespace-nowrap">
                      {project.locationCity || project.locationState
                        ? [project.locationCity, project.locationState].filter(Boolean).join(', ')
                        : '—'}
                    </td>
                    <td className={`px-4 py-3 align-top font-data text-xs whitespace-nowrap ${dueSoon ? 'text-afs-danger-on-dark font-semibold' : 'text-afs-chrome-mid'}`}>
                      {formatDate(project.bidDueDate)}
                    </td>
                    <td className="px-4 py-3 align-top font-data text-xs text-afs-chrome-mid whitespace-nowrap">
                      {project.estimatedValue ? currency.format(project.estimatedValue) : '—'}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {project.keywordsMatched.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="bg-afs-bg-surface border border-afs-border text-afs-chrome-mid font-label text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap"
                          >
                            {kw}
                          </span>
                        ))}
                        {extraKeywords > 0 && (
                          <span className="font-label text-[10px] text-afs-chrome-silver">+{extraKeywords} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Chip className={STATUS_CHIP_CLASS[project.status] ?? 'border-afs-chrome-dim text-afs-chrome-silver'}>
                        {STATUS_LABEL[project.status] ?? project.status}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col items-end gap-2">
                        {project.sourceUrl ? (
                          <a
                            href={project.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-label text-xs text-afs-chrome-high hover:text-afs-danger-on-dark transition-colors"
                          >
                            View →
                          </a>
                        ) : (
                          <span className="font-label text-xs text-afs-chrome-silver">No link</span>
                        )}
                        <TrackDropdown project={project} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
