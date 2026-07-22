import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/admin/auth';
import { computeProfilePoints, type ProfileGeometryPoint } from '@/lib/flashdraft/geometry';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';

// Internal validation tool only — see GEOMETRY_AUDIT.md. Not linked from
// NavBar.tsx or AdminShell.tsx's nav sections; reachable only by typing the
// URL directly. `noindex` since this renders real (admin-only, but still
// real) shop profile data, same posture as every other /admin page.
export const metadata: Metadata = {
  title: 'Geometry Test | AFS Admin',
  robots: { index: false, follow: false },
};

interface ProfileRow {
  id: string;
  name_en: string;
  profile_number: string;
  blank_width_in: number | null;
  blank_width_mm: number | null;
}

interface BendRow {
  profile_id: string;
  step_number: number;
  left_leg_mm: number | null;
  right_leg_mm: number | null;
  left_leg_in: number | null;
  right_leg_in: number | null;
  bend_angle_degrees: number | null;
  radius_mm: number | null;
}

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

  // Service-role client — same admin-bypass pattern as
  // app/studio/library/page.tsx (machine_profiles RLS requires
  // auth.uid() IS NOT NULL even on is_public rows, and this page only
  // needs read access, not a customer-facing visibility rule).
  const admin = createAdminClient();

  const { data: profileRows } = await admin
    .from('machine_profiles')
    .select('id, name_en, profile_number, blank_width_in, blank_width_mm')
    .eq('is_public', true)
    .eq('is_active', true)
    .order('name_en')
    .limit(20)
    .returns<ProfileRow[]>();

  const profiles = profileRows ?? [];
  const profileIds = profiles.map((p) => p.id);

  const { data: bendRows } =
    profileIds.length > 0
      ? await admin
          .from('machine_profile_bends')
          .select('profile_id, step_number, left_leg_mm, right_leg_mm, left_leg_in, right_leg_in, bend_angle_degrees, radius_mm')
          .in('profile_id', profileIds)
          .order('step_number', { ascending: true })
          .returns<BendRow[]>()
      : { data: [] as BendRow[] };

  const bendsByProfile = new Map<string, BendRow[]>();
  for (const row of bendRows ?? []) {
    const list = bendsByProfile.get(row.profile_id) ?? [];
    list.push(row);
    bendsByProfile.set(row.profile_id, list);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">Internal Validation</p>
        <h1 className="font-heading text-3xl text-afs-chrome-high">Geometry Test</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1 max-w-3xl">
          First {profiles.length} public machine profiles, rendered via BendSequenceDiagram alongside their raw bend
          data and the exact points computed by <code>computeProfilePoints()</code> — for cross-checking the geometry
          algorithm against real data. See GEOMETRY_AUDIT.md. Not linked from any nav.
        </p>
      </div>

      {profiles.length === 0 ? (
        <p className="font-body text-sm text-afs-chrome-dim">No public, active machine profiles found.</p>
      ) : (
        <div className="space-y-8">
          {profiles.map((profile) => {
            const bends = bendsByProfile.get(profile.id) ?? [];
            const { points } = computeProfilePoints(
              bends.map((b) => ({
                legIn: b.left_leg_in,
                nextLegIn: b.right_leg_in,
                bendAngleDegrees: b.bend_angle_degrees,
              }))
            );

            return (
              <section key={profile.id} className="bg-afs-bg-raised border border-[var(--afs-border)] rounded p-6">
                <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
                  <h2 className="font-heading text-xl text-afs-chrome-high">
                    {profile.name_en} <span className="font-data text-sm text-afs-chrome-dim">#{profile.profile_number}</span>
                  </h2>
                  <p className="font-data text-sm text-afs-chrome-mid">
                    Blank width: {formatNum(profile.blank_width_in, 3)}&quot; / {formatNum(profile.blank_width_mm, 2)}mm
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <p className="font-label text-xs text-afs-chrome-dim uppercase tracking-wider mb-2">Diagram</p>
                    <BendSequenceDiagram
                      bends={bends.map((b) => ({
                        leftLegMm: b.left_leg_mm,
                        rightLegMm: b.right_leg_mm,
                        bendAngleDegrees: b.bend_angle_degrees,
                        radiusMm: b.radius_mm,
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
                        {bends.map((b) => (
                          <tr key={b.step_number} className="border-b border-[var(--afs-border)]">
                            <td className="py-1 pr-2">{b.step_number}</td>
                            <td className="py-1 pr-2">{formatNum(b.left_leg_in)}</td>
                            <td className="py-1 pr-2">{formatNum(b.right_leg_in)}</td>
                            <td className="py-1 pr-2">{formatNum(b.bend_angle_degrees, 1)}</td>
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
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
