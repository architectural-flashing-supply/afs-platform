import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import ShareProfileButton from '@/components/studio/ShareProfileButton';

interface MachineProfileRow {
  id: string;
  name_en: string;
  profile_number: string;
  blank_width_mm: number | null;
  is_public: boolean;
  is_active: boolean;
}

interface MachineProfileBendRow {
  step_number: number;
  left_leg_mm: number | null;
  right_leg_mm: number | null;
  bend_angle_degrees: number | null;
  radius_mm: number | null;
}

// Bend templates in machine_profiles record fold geometry only, not a
// material/gauge choice (that's picked later, at quote time) — default to
// a representative galvanized-steel look purely for visualization.
const DEFAULT_MATERIAL = 'Galvanized Steel';
const DEFAULT_GAUGE = '24 ga';

export default async function ProfileViewerPage({ params }: { params: { profileId: string } }) {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('machine_profiles')
    .select('id, name_en, profile_number, blank_width_mm, is_public, is_active')
    .eq('id', params.profileId)
    .single<MachineProfileRow>();

  if (!profile || !profile.is_active) notFound();

  // machine_profiles RLS requires auth.uid() IS NOT NULL even for public
  // rows, so an anonymous share-link visitor can't read via the session
  // client — the admin client above bypasses RLS for the lookup, and this
  // is where the privacy boundary from the profile import is enforced in
  // application code instead: public profiles render for anyone, private
  // ones require a logged-in admin, otherwise the page 404s exactly like a
  // truly missing profile would.
  if (!profile.is_public) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) notFound();

    const { data: viewerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!viewerProfile || viewerProfile.role !== 'admin') notFound();
  }

  const { data: bendRows } = await admin
    .from('machine_profile_bends')
    .select('step_number, left_leg_mm, right_leg_mm, bend_angle_degrees, radius_mm')
    .eq('profile_id', profile.id)
    .order('step_number', { ascending: true })
    .returns<MachineProfileBendRow[]>();

  const bends: ProfileBend[] = (bendRows ?? []).map((b) => ({
    leftLeg: b.left_leg_mm ?? 0,
    rightLeg: b.right_leg_mm ?? 0,
    angle: b.bend_angle_degrees ?? 180,
    radius: b.radius_mm ?? 0,
  }));

  return (
    <main className="fixed inset-0 bg-afs-bg-base flex flex-col z-40">
      <div className="flex items-center justify-between px-6 py-4 border-b border-afs-chrome-dim shrink-0">
        <div>
          <Link href="/studio" className="font-label text-xs text-afs-chrome-dim hover:text-afs-crimson transition-colors">
            ← Design Studio
          </Link>
          <h1 className="font-heading text-2xl text-afs-chrome-high leading-tight mt-1">{profile.name_en}</h1>
          <p className="font-data text-xs text-afs-chrome-mid">#{profile.profile_number}</p>
        </div>
        <ShareProfileButton />
      </div>

      <div className="flex-1 min-h-0">
        <ProfileViewer3D
          bends={bends}
          blankWidth={profile.blank_width_mm ?? 0}
          material={DEFAULT_MATERIAL}
          gauge={DEFAULT_GAUGE}
          thicknessMm={gaugeToThicknessMm(DEFAULT_GAUGE)}
          profileName={profile.name_en}
          className="w-full h-full"
        />
      </div>

      <p className="text-center font-body text-xs text-afs-chrome-dim py-3 shrink-0">
        This URL is shareable — an architect can send a customer a link to view this profile in 3D.
      </p>
    </main>
  );
}
