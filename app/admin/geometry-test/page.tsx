import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/admin/auth';
import { computeProfilePoints, type ProfileGeometryPoint } from '@/lib/flashdraft/geometry';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';

// DEVELOPER-ONLY internal validation tool — see GEOMETRY_AUDIT.md. Hidden
// from every navigation surface (AdminTopBar.tsx, AdminShell.tsx, NavBar.tsx)
// and reachable only by typing the URL, on top of the /admin/** admin-role
// gate plus the page-local requireAdminUser check below. Command Center V2
// prompt v2-01 confirmed that hidden-and-admin-gated posture deliberately.
// `noindex` because it renders real shop geometry.
export const metadata: Metadata = {
  title: 'Geometry Test | AFS Admin',
  robots: { index: false, follow: false },
};

// Source of truth for this page was the old 911-entry machine profile
// library, whose geometry was AI-read from a legacy database and never
// validated — removed in Command Center V2 prompt v2-01
// (docs/COMMAND_CENTER_V2_SPEC.md §2.8). It now validates against
// `canonical_profiles`, the hand-authored starter library, which is a
// strictly better fixture for this purpose: every row carries BOTH an
// authored point list and an authored bend list, so the page can show
// computeProfilePoints()'s output next to the points a human intended and
// any drift is visible rather than inferred.
interface CanonicalRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  blank_width_in: number | null;
  points: ProfileGeometryPoint[] | null;
  bends:
    | {
        leftLegIn: number | null;
        rightLegIn: number | null;
        angleDegrees: number | null;
        direction?: 'up' | 'down';
      }[]
    | null;
}

const MM_PER_INCH = 25.4;

function formatNum(value: number | null, digits = 3): string {
  return value === null ? '—' : value.toFixed(digits);
}

function formatPoints(points: ProfileGeometryPoint[]): string {
  return points.map((p, i) => `${i}: (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`).join('\n');
}

export default async function GeometryTestPage() {
  // Same redundant-role-check convention every /admin page follows —
  // app/admin/layout.tsx's requireAdminUser already gates the whole
  // /admin/** tree, this is the second, page-local layer.
  const supabase = await createClient();
  await requireAdminUser(supabase);

  // Service-role client: canonical profiles are public reference geometry,
  // and this page only needs read access, not a visibility rule.
  const admin = createAdminClient();

  const { data: profileRows } = await admin
    .from('canonical_profiles')
    .select('id, name, slug, category, blank_width_in, points, bends')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(20)
    .returns<CanonicalRow[]>();

  const profiles = profileRows ?? [];

  return (
    <div>
      <div className="mb-8">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Internal Validation</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">Geometry Test</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1 max-w-3xl">
          First {profiles.length} canonical profiles, rendered via BendSequenceDiagram alongside their raw bend data,
          the points <code>computeProfilePoints()</code> derives from those bends, and the authored points stored on
          the row — so any drift between the two is visible side by side. See GEOMETRY_AUDIT.md. Developer tool, not
          linked from any nav.
        </p>
      </div>

      {profiles.length === 0 ? (
        <p className="font-body text-sm text-afs-chrome-dim">No active canonical profiles found.</p>
      ) : (
        <div className="space-y-8">
          {profiles.map((profile) => {
            const bends = profile.bends ?? [];
            const { points } = computeProfilePoints(
              bends.map((b) => ({
                legIn: b.leftLegIn,
                nextLegIn: b.rightLegIn,
                bendAngleDegrees: b.angleDegrees,
              }))
            );
            const authored = profile.points ?? [];

            return (
              <section key={profile.id} className="bg-afs-bg-raised border border-[var(--afs-border)] rounded p-6">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
                  <h2 className="font-heading text-xl text-afs-chrome-high">
                    {profile.name} <span className="font-data text-sm text-afs-chrome-dim">{profile.category}</span>
                  </h2>
                  <p className="font-data text-sm text-afs-chrome-mid">
                    Blank width: {formatNum(profile.blank_width_in, 3)}&quot; /{' '}
                    {formatNum(profile.blank_width_in === null ? null : profile.blank_width_in * MM_PER_INCH, 2)}mm
                  </p>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <div>
                    <p className="font-label text-xs text-afs-chrome-dim uppercase tracking-wider mb-2">Diagram</p>
                    <BendSequenceDiagram
                      bends={bends.map((b) => ({
                        leftLegMm: b.leftLegIn === null ? null : b.leftLegIn * MM_PER_INCH,
                        rightLegMm: b.rightLegIn === null ? null : b.rightLegIn * MM_PER_INCH,
                        bendAngleDegrees: b.angleDegrees,
                        radiusMm: null,
                      }))}
                      className="w-full h-48 bg-afs-bg-dim rounded"
                    />
                  </div>

                  <div>
                    <p className="font-label text-xs text-afs-chrome-dim uppercase tracking-wider mb-2">
                      Raw bend data ({bends.length} step{bends.length === 1 ? '' : 's'})
                    </p>
                    <table className="w-full font-data text-xs text-afs-chrome-mid">
                      <thead>
                        <tr className="text-afs-chrome-dim text-left border-b border-[var(--afs-border)]">
                          <th className="py-1 pr-2">Step</th>
                          <th className="py-1 pr-2">Left leg (in)</th>
                          <th className="py-1 pr-2">Right leg (in)</th>
                          <th className="py-1 pr-2">Angle (°)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bends.map((b, i) => (
                          <tr key={i} className="border-b border-[var(--afs-border)]">
                            <td className="py-1 pr-2">{i + 1}</td>
                            <td className="py-1 pr-2">{formatNum(b.leftLegIn)}</td>
                            <td className="py-1 pr-2">{formatNum(b.rightLegIn)}</td>
                            <td className="py-1 pr-2">{formatNum(b.angleDegrees, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <p className="font-label text-xs text-afs-chrome-dim uppercase tracking-wider mb-2">
                      computeProfilePoints() output (in)
                    </p>
                    <pre className="font-data text-xs text-afs-chrome-mid whitespace-pre-wrap bg-afs-bg-dim rounded p-2 max-h-48 overflow-auto">
                      {formatPoints(points)}
                    </pre>
                  </div>

                  <div>
                    <p className="font-label text-xs text-afs-chrome-dim uppercase tracking-wider mb-2">
                      Authored points on the row (in)
                    </p>
                    <pre className="font-data text-xs text-afs-chrome-mid whitespace-pre-wrap bg-afs-bg-dim rounded p-2 max-h-48 overflow-auto">
                      {authored.length === 0 ? '—' : formatPoints(authored)}
                    </pre>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
