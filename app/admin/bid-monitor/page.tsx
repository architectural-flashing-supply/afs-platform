import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getBidMonitorStats, getBidProjects, getBidSources, getBidKeywords } from '@/lib/data/bid-monitor';
import BidMonitorProjectsTable from '@/components/admin/BidMonitorProjectsTable';
import BidMonitorSourceDirectory from '@/components/admin/BidMonitorSourceDirectory';
import BidMonitorKeywordManager from '@/components/admin/BidMonitorKeywordManager';
import BidMonitorFetchControls from '@/components/admin/BidMonitorFetchControls';

function RadarIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-afs-crimson shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
      <circle cx="12" cy="12" r="5.5" strokeOpacity="0.7" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <path d="M12 12 L18.5 7.5" />
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-4 text-center">
      <p className="font-heading text-3xl text-afs-crimson">{value}</p>
      <p className="font-label text-xs text-afs-chrome-mid uppercase mt-1">{label}</p>
    </div>
  );
}

export default async function BidMonitorPage() {
  const supabase = await createClient();
  // Admin only — matches every other page directly under app/admin/**
  // (app/admin/layout.tsx's requireAdminUser hard-redirects any non-admin
  // session before this page renders at all). Extending this specific page
  // to 'operator' as well would need two things beyond this file's scope:
  // (1) a change to the shared app/admin/layout.tsx gate, which every other
  // admin page also sits behind, and (2) new operator RLS policies on
  // bid_sources/bid_projects/bid_keywords/bid_alerts, which are all admin-only
  // FOR ALL today (010_bid_monitor.sql) — an operator session would hit an
  // empty RLS-filtered result even if the layout let them through. Flagging
  // rather than silently reworking either.
  await requireAdminUser(supabase);

  const [stats, projects, sources, keywords] = await Promise.all([
    getBidMonitorStats(supabase),
    getBidProjects(supabase),
    getBidSources(supabase),
    getBidKeywords(supabase),
  ]);

  const samGovConfigured = Boolean(process.env.SAM_GOV_API_KEY);
  const lastFetchedAt = sources.reduce<string | null>((latest, s) => {
    if (!s.lastCheckedAt) return latest;
    if (!latest || s.lastCheckedAt > latest) return s.lastCheckedAt;
    return latest;
  }, null);

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <RadarIcon />
        <div>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Bid Monitor</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            Government and commercial procurement opportunities, matched against AFS&apos;s Division 7 keyword list.
          </p>
        </div>
      </div>

      {/* SECTION 1 — STATS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="New This Week" value={stats.newThisWeek} />
        <StatCard label="Division 7 Matches" value={stats.division7Matches} />
        <StatCard label="Active Bids" value={stats.activeBids} />
        <StatCard label="Sources Monitored" value={stats.sourcesMonitored} />
      </div>

      {/* SECTION 2 — ACTIVE PROJECTS TABLE */}
      <section className="mb-10">
        <h2 className="font-heading text-xl text-afs-chrome-high mb-4">Matched Opportunities</h2>
        <BidMonitorProjectsTable projects={projects} />
      </section>

      {/* SECTION 3 — SOURCE DIRECTORY */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-heading text-xl text-afs-chrome-high">Source Directory</h2>
          <span className="font-data text-xs text-afs-chrome-dim border border-afs-border rounded-full px-2.5 py-0.5">
            {sources.length}
          </span>
        </div>
        <BidMonitorSourceDirectory sources={sources} samGovConfigured={samGovConfigured} />
      </section>

      {/* SECTION 4 — KEYWORD MANAGER */}
      <section className="mb-10">
        <h2 className="font-heading text-xl text-afs-chrome-high mb-4">Monitored Keywords</h2>
        <BidMonitorKeywordManager keywords={keywords} />
      </section>

      {/* SECTION 5 — FETCH CONTROLS */}
      <section>
        <h2 className="font-heading text-xl text-afs-chrome-high mb-4">Fetch Controls</h2>
        <BidMonitorFetchControls initialLastFetchedAt={lastFetchedAt} />
      </section>
    </div>
  );
}
