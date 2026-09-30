import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getBuildingCodeJurisdictions, getBuildingCodeStats } from '@/lib/data/building-codes';
import BuildingCodeDirectory from '@/components/resources/BuildingCodeDirectory';

// MOVED HERE from /admin/building-codes in Command Center V2 prompt v2-01.
// It was never Command Center work: it is public reference content — which
// government body has adopted a building code in a given jurisdiction, and
// the URL that proves it — and it now lives where an architect or contractor
// can actually find it, under the public Resources menu.
//
// Migration 033 added the anonymous SELECT policy this needs (022's original
// policy was admin-only FOR ALL, and its own comment said to widen it when a
// public read surface existed). Writes are still admin-only.
export const metadata: Metadata = {
  title: 'Building Code Directory | Architectural Flashing Supply',
  description:
    'Which Texas county or city has adopted a building code, who the adopting authority is, and a verified link to the source. A free reference for architects and contractors.',
};

export const dynamic = 'force-dynamic';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded p-4 text-center">
      <p className="font-heading text-3xl text-afs-crimson">{value}</p>
      <p className="font-label text-xs text-afs-chrome-mid uppercase mt-1">{label}</p>
    </div>
  );
}

export default async function PublicBuildingCodesPage() {
  const supabase = await createClient();
  const rows = await getBuildingCodeJurisdictions(supabase);
  const stats = getBuildingCodeStats(rows);

  return (
    <main className="min-h-screen bg-afs-bg-base py-14 px-6">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/resources"
          className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors"
        >
          ← Resources
        </Link>

        <div className="mt-4 mb-8">
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Free Reference</p>
          <h1 className="font-heading text-4xl text-afs-chrome-high">Building Code Directory</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-3 max-w-3xl">
            Which authority has adopted a building code in a given jurisdiction, and a link to the source we verified
            it against. Texas is the first state covered — all 254 counties, plus every incorporated city of 10,000 or
            more people.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="bg-afs-bg-raised border border-afs-border rounded p-8 text-center">
            <p className="font-body text-sm text-afs-chrome-mid">
              We&apos;re building this directory. Check back soon, or{' '}
              <Link href="/contact" className="text-afs-crimson hover:underline">
                ask us
              </Link>{' '}
              about a specific jurisdiction.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
              <StatCard label="Total" value={stats.total} />
              <StatCard label="Counties" value={stats.counties} />
              <StatCard label="Cities" value={stats.cities} />
              <StatCard label="Verified Link" value={stats.verifiedLink} />
              <StatCard label="No Code Adopted" value={stats.noCodeAdopted} />
              <StatCard label="Unresolved" value={stats.unresolved} />
            </div>

            <BuildingCodeDirectory rows={rows} />
          </>
        )}
      </div>
    </main>
  );
}
