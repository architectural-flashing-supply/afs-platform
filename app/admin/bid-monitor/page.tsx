import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getBidMonitorStats, getBidProjects, getBidSources, getBidKeywords } from '@/lib/data/bid-monitor';
import BidMonitorProjectsTable from '@/components/admin/BidMonitorProjectsTable';
import BidMonitorSourceDirectory from '@/components/admin/BidMonitorSourceDirectory';
import BidMonitorKeywordManager from '@/components/admin/BidMonitorKeywordManager';
import BidMonitorFetchControls from '@/components/admin/BidMonitorFetchControls';
import LightWorkingArea from '@/components/admin/LightWorkingArea';

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
      // v7's own light-surface red. `afs-danger-on-dark` was right while this
      // page was gunmetal; on the light working area it is a light-on-dark
      // token and CLAUDE.md rule #29 says those are for dark surfaces only.
      style={{ color: 'var(--redtxt)', flex: 'none' }}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
      <circle cx="12" cy="12" r="5.5" strokeOpacity="0.7" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" stroke="none" />
      <path d="M12 12 L18.5 7.5" />
    </svg>
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
    // STAGE G — Bid Monitor lives under "More" and takes the same v7 shell and
    // look: `.greet`, `.chips` for the stats strip, and `.panel` sections. v7
    // has no equivalent screen, so what it inherits is the shell and the
    // component vocabulary rather than ported markup.
    <LightWorkingArea>
      <div className="greet">
        <RadarIcon />
        <div>
          <h1 className="t">Bid Monitor</h1>
          <p className="sub">
            Government and commercial procurement opportunities, matched against AFS&apos;s Division
            7 keyword list.
          </p>
        </div>
      </div>

      {/* SECTION 1 — STATS STRIP, as v7's summary chips. */}
      <div className="chips">
        <span className="chip">{stats.newThisWeek} new this week</span>
        <span className="chip">{stats.division7Matches} Division 7 matches</span>
        <span className="chip">{stats.activeBids} active bids</span>
        <span className="chip">{stats.sourcesMonitored} sources monitored</span>
      </div>

      {/* SECTION 2 — ACTIVE PROJECTS TABLE */}
      <section className="panel">
        <h2>Matched Opportunities</h2>
        <BidMonitorProjectsTable projects={projects} />
      </section>

      {/* SECTION 3 — SOURCE DIRECTORY */}
      <section className="panel">
        <h2>
          Source Directory<span className="tag">{sources.length}</span>
        </h2>
        <BidMonitorSourceDirectory sources={sources} samGovConfigured={samGovConfigured} />
      </section>

      {/* SECTION 4 — KEYWORD MANAGER */}
      <section className="panel">
        <h2>Monitored Keywords</h2>
        <BidMonitorKeywordManager keywords={keywords} />
      </section>

      {/* SECTION 5 — FETCH CONTROLS */}
      <section className="panel">
        <h2>Fetch Controls</h2>
        <BidMonitorFetchControls initialLastFetchedAt={lastFetchedAt} />
      </section>
    </LightWorkingArea>
  );
}
