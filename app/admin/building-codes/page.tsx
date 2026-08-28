import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getBuildingCodeJurisdictions, getBuildingCodeStats } from '@/lib/data/building-codes';
import BuildingCodeDirectory from '@/components/admin/BuildingCodeDirectory';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-4 text-center">
      <p className="font-heading text-3xl text-afs-crimson">{value}</p>
      <p className="font-label text-xs text-afs-chrome-mid uppercase mt-1">{label}</p>
    </div>
  );
}

export default async function BuildingCodesPage() {
  const supabase = await createClient();
  // Admin only, matching app/admin/bid-monitor/page.tsx's precedent — this
  // table (022_building_code_jurisdictions.sql) has the same admin-only FOR
  // ALL RLS policy as bid_sources. It's reference content ultimately meant
  // for the Architect Portal's resource center (SPEC_ARCHITECTURAL_RESOURCE_
  // CENTER.md "Building code references"), but that read surface isn't
  // built yet, so this admin page is the first place it's viewable.
  await requireAdminUser(supabase);

  const rows = await getBuildingCodeJurisdictions(supabase);
  const stats = getBuildingCodeStats(rows);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Building Code Directory</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">
          Building-code adoption authority by jurisdiction, for the Architect Portal&apos;s resource center. Texas is the
          first state populated — all 254 counties and every incorporated city with 10,000+ population.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Counties" value={stats.counties} />
        <StatCard label="Cities" value={stats.cities} />
        <StatCard label="Verified Link" value={stats.verifiedLink} />
        <StatCard label="No Code Adopted" value={stats.noCodeAdopted} />
        <StatCard label="Unresolved" value={stats.unresolved} />
      </div>

      <BuildingCodeDirectory rows={rows} />
    </div>
  );
}
