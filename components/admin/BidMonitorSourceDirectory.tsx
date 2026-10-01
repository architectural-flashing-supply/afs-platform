'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DOT_PORTALS, FREE_PLANROOMS } from '@/lib/bid-monitor/sources/state-portals';
import type { BidSourceRow } from '@/lib/data/bid-monitor';

const TABS = ['federal', 'texas', 'all-states', 'dot', 'planrooms'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  federal: 'Federal',
  texas: 'Texas',
  'all-states': 'All States',
  dot: 'DOT',
  planrooms: 'Plan Rooms',
};

// AZ/NM/OK/TX — the four states this codebase's own quick-filter buttons
// treat as "Southwest" (no single official federal definition; CA/NV/UT/CO
// are sometimes included elsewhere but are excluded here to keep this a
// distinct, useful subset from "All Texas").
const SOUTHWEST_STATES = ['AZ', 'NM', 'OK', 'TX'];

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never checked';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function isRecent(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function openUrls(urls: string[]) {
  urls.forEach((url) => window.open(url, '_blank', 'noopener,noreferrer'));
}

function SourceCard({
  name,
  url,
  lastCheckedAt,
  statusLabel,
  statusClass,
  notes,
  action,
}: {
  name: string;
  url: string;
  lastCheckedAt: string | null;
  statusLabel: string;
  statusClass: string;
  notes: string | null;
  action: React.ReactNode;
}) {
  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading text-base text-afs-chrome-high">{name}</p>
        <span className={`font-label text-[10px] uppercase tracking-wide border rounded px-2 py-0.5 whitespace-nowrap ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      {notes && <p className="font-body text-xs text-afs-chrome-mid">{notes}</p>}
      <p className="font-data text-[11px] text-afs-chrome-silver">Last checked: {formatDateTime(lastCheckedAt)}</p>
      <div className="flex items-center gap-3 mt-1">
        {action}
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high transition-colors">
          Visit site →
        </a>
      </div>
    </div>
  );
}

function MiniPortalCard({ label, url, lastCheckedAt }: { label: string; url: string; lastCheckedAt: string | null }) {
  const recent = isRecent(lastCheckedAt);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col gap-1 bg-afs-bg-raised border rounded p-3 hover:bg-afs-bg-surface transition-colors ${
        recent ? 'border-afs-success' : 'border-afs-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-label text-sm text-afs-chrome-high">{label}</p>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${recent ? 'bg-afs-success' : 'bg-afs-chrome-dim'}`} aria-hidden />
      </div>
      <p className="font-data text-[10px] text-afs-chrome-silver">{formatDateTime(lastCheckedAt)}</p>
      <span className="font-label text-xs text-afs-danger-on-dark mt-1">Open Portal →</span>
    </a>
  );
}

export default function BidMonitorSourceDirectory({
  sources,
  samGovConfigured,
}: {
  sources: BidSourceRow[];
  samGovConfigured: boolean;
}) {
  const [tab, setTab] = useState<Tab>('federal');
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  // The only real fetch endpoint scans every configured source at once
  // (app/api/bid-monitor/fetch/route.ts) — there's no per-source fetch route,
  // so every "Fetch Now" button on this directory (not just USASpending's)
  // triggers the same full scan rather than pretending a source-scoped one
  // exists.
  const handleFetchNow = async () => {
    setFetchBusy(true);
    setFetchMessage(null);
    try {
      const res = await fetch('/api/bid-monitor/fetch', { method: 'POST' });
      const data = (await res.json()) as { fetched?: number; newProjects?: number; error?: string };
      setFetchMessage(res.ok ? `Fetched ${data.fetched ?? 0} (${data.newProjects ?? 0} new).` : data.error ?? 'Fetch failed.');
    } catch {
      setFetchMessage('Network error.');
    } finally {
      setFetchBusy(false);
    }
  };

  const samGov = sources.find((s) => s.name === 'SAM.gov');
  const usaSpending = sources.find((s) => s.name === 'USASpending.gov');
  const texasEsbd = sources.find((s) => s.sourceType === 'state' && s.state === 'TX');
  const txDot = sources.find((s) => s.sourceType === 'dot' && s.state === 'TX');
  const texasCityCounty = sources.filter((s) => s.state === 'TX' && (s.sourceType === 'city' || s.sourceType === 'county'));
  const allStates = sources.filter((s) => s.sourceType === 'state');
  const allTxSources = sources.filter((s) => s.state === 'TX');
  const southwestStateSources = allStates.filter((s) => SOUTHWEST_STATES.includes(s.state ?? ''));

  const dotEntries = DOT_PORTALS.map((portal) => {
    const dbRow = sources.find((s) => s.sourceType === 'dot' && s.state === portal.state);
    return {
      key: portal.id,
      label: `${portal.state} DOT`,
      url: dbRow?.url ?? portal.url,
      lastCheckedAt: dbRow?.lastCheckedAt ?? null,
    };
  });

  const planroomEntries = FREE_PLANROOMS.map((portal) => {
    const dbRow = sources.find((s) => s.sourceType === 'planroom' && s.name.toLowerCase().includes(portal.id.replace('-', '')));
    return {
      key: portal.id,
      name: portal.name,
      url: dbRow?.url ?? portal.url,
      notes: dbRow?.notes ?? portal.notes ?? null,
      lastCheckedAt: dbRow?.lastCheckedAt ?? null,
    };
  });
  const planHub = planroomEntries.find((p) => p.key === 'planhub');
  const bidPlanroom = planroomEntries.find((p) => p.key === 'bidplanroom');
  const constructConnect = planroomEntries.find((p) => p.key === 'constructconnect');
  const subHub = planroomEntries.find((p) => p.key === 'sub-hub');

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-afs-border mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`font-label text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? 'border-afs-crimson text-afs-chrome-high' : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'federal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SourceCard
            name="SAM.gov"
            url={samGov?.url ?? 'https://sam.gov/opportunities'}
            lastCheckedAt={samGov?.lastCheckedAt ?? null}
            statusLabel={samGovConfigured ? 'Configured' : 'Needs API Key'}
            statusClass={samGovConfigured ? 'border-afs-success text-afs-success-on-dark' : 'border-afs-amber text-afs-warning-on-dark'}
            notes={samGov?.notes ?? null}
            action={
              <Link href="/admin/settings" className="font-label text-xs text-afs-chrome-high hover:text-afs-danger-on-dark transition-colors">
                Configure
              </Link>
            }
          />
          <SourceCard
            name="USASpending.gov"
            url={usaSpending?.url ?? 'https://usaspending.gov'}
            lastCheckedAt={usaSpending?.lastCheckedAt ?? null}
            statusLabel="Active"
            statusClass="border-afs-success text-afs-success-on-dark"
            notes={usaSpending?.notes ?? null}
            action={
              <button
                type="button"
                onClick={handleFetchNow}
                disabled={fetchBusy}
                className="font-label text-xs text-afs-chrome-high hover:text-afs-danger-on-dark transition-colors disabled:opacity-50"
              >
                {fetchBusy ? 'Fetching…' : 'Fetch Now'}
              </button>
            }
          />
          {fetchMessage && <p className="sm:col-span-2 font-body text-xs text-afs-chrome-mid">{fetchMessage}</p>}
        </div>
      )}

      {tab === 'texas' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SourceCard
              name="Texas ESBD"
              url={texasEsbd?.url ?? 'https://www.txsmartbuy.gov/esbd'}
              lastCheckedAt={texasEsbd?.lastCheckedAt ?? null}
              statusLabel="Active"
              statusClass="border-afs-success text-afs-success-on-dark"
              notes={texasEsbd?.notes ?? null}
              action={<span className="font-label text-xs text-afs-chrome-silver">Texas Electronic State Business Daily</span>}
            />
            <SourceCard
              name="TxDOT Letting Calendar"
              url={txDot?.url ?? 'https://www.txdot.gov/business/contractors/highway-letting.html'}
              lastCheckedAt={txDot?.lastCheckedAt ?? null}
              statusLabel="Active"
              statusClass="border-afs-success text-afs-success-on-dark"
              notes={txDot?.notes ?? null}
              action={<span className="font-label text-xs text-afs-chrome-silver">Highway construction lettings</span>}
            />
          </div>

          <div>
            <p className="font-label text-xs uppercase tracking-widest text-afs-chrome-silver mb-3">
              Texas Cities &amp; Counties ({texasCityCounty.length})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {texasCityCounty.map((s) => (
                <MiniPortalCard key={s.id} label={s.name.replace(' Purchasing', '')} url={s.url} lastCheckedAt={s.lastCheckedAt} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'all-states' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => openUrls(allTxSources.map((s) => s.url))}
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors"
            >
              Open All Texas ({allTxSources.length})
            </button>
            <button
              type="button"
              onClick={() => openUrls(southwestStateSources.map((s) => s.url))}
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors"
            >
              Open All Southwest ({southwestStateSources.length})
            </button>
            <p className="font-body text-xs text-afs-chrome-silver">Browsers may block more than a few tabs opening at once.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {allStates.map((s) => (
              <MiniPortalCard key={s.id} label={s.state ?? s.name} url={s.url} lastCheckedAt={s.lastCheckedAt} />
            ))}
          </div>
        </div>
      )}

      {tab === 'dot' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {dotEntries.map((d) => (
            <MiniPortalCard key={d.key} label={d.label} url={d.url} lastCheckedAt={d.lastCheckedAt} />
          ))}
        </div>
      )}

      {tab === 'planrooms' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SourceCard
            name="PlanHub"
            url={planHub?.url ?? 'https://www.planhub.com'}
            lastCheckedAt={planHub?.lastCheckedAt ?? null}
            statusLabel="Registration Required"
            statusClass="border-afs-amber text-afs-warning-on-dark"
            notes="Registration required — free at planhub.com"
            action={
              <button
                type="button"
                disabled
                title="No PlanHub account integration is built yet — PLANHUB_API_KEY is wired but unused, matching the PathfinderEdge stub precedent."
                className="font-label text-xs text-afs-chrome-silver cursor-not-allowed"
              >
                Connect Account
              </button>
            }
          />
          <SourceCard
            name="BidPlanroom"
            url={bidPlanroom?.url ?? 'https://www.bidplanroom.com'}
            lastCheckedAt={bidPlanroom?.lastCheckedAt ?? null}
            statusLabel="Free Listings"
            statusClass="border-afs-success text-afs-success-on-dark"
            notes={bidPlanroom?.notes ?? null}
            action={
              <a href={bidPlanroom?.url ?? 'https://www.bidplanroom.com'} target="_blank" rel="noopener noreferrer" className="font-label text-xs text-afs-chrome-high hover:text-afs-danger-on-dark transition-colors">
                View Public Listings →
              </a>
            }
          />
          <SourceCard
            name="ConstructConnect"
            url={constructConnect?.url ?? 'https://www.constructconnect.com'}
            lastCheckedAt={constructConnect?.lastCheckedAt ?? null}
            statusLabel="Free Tier"
            statusClass="border-afs-success text-afs-success-on-dark"
            notes={constructConnect?.notes ?? null}
            action={
              <a href={constructConnect?.url ?? 'https://www.constructconnect.com'} target="_blank" rel="noopener noreferrer" className="font-label text-xs text-afs-chrome-high hover:text-afs-danger-on-dark transition-colors">
                View Free Tier →
              </a>
            }
          />
          <SourceCard
            name="Sub-Hub"
            url={subHub?.url ?? 'https://constructionbids.ai/sub-hub'}
            lastCheckedAt={subHub?.lastCheckedAt ?? null}
            statusLabel="Aggregator"
            statusClass="border-afs-chrome-base text-afs-chrome-base"
            notes={subHub?.notes ?? 'Free construction-bid aggregator — not yet tracked in bid_sources.'}
            action={
              <a href={subHub?.url ?? 'https://constructionbids.ai/sub-hub'} target="_blank" rel="noopener noreferrer" className="font-label text-xs text-afs-chrome-high hover:text-afs-danger-on-dark transition-colors">
                View Aggregator →
              </a>
            }
          />
        </div>
      )}
    </div>
  );
}
