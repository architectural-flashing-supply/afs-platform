import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeFabricationCounts } from '@/lib/data/machine-profile-fabrication';
import ProfileLibraryBrowser, { type LibraryProfileCardData } from '@/components/studio/ProfileLibraryBrowser';

export const metadata: Metadata = {
  title: 'Profile Library | AFS Architectural Flashing Supply',
  description:
    'Browse every profile in the AFS machine library — filter by category, blank width, and bend count, then load one straight into FlashDraft.',
};

// Curated AFS product categories that always populate the dropdown, regardless
// of what machine_profile_categories currently holds — the Thalmann source
// data is being migrated onto this vocabulary category by category (see
// DATA BLOCKERS in CLAUDE.md), so the dropdown should not go sparse or
// revert to raw machine category names while that migration is in progress.
const AFS_PRODUCT_CATEGORIES = [
  'Coping Caps & Cleats',
  'Drip Edge & Gravel Stop',
  'Valley Flashing',
  'Fascia & Rake',
  'Gutters & Scuppers',
  'Base & Counter Flashing',
  'Window & Door Flashing',
  'Expansion Joints',
  'Standing Seam',
  'Custom Profiles',
  'Zinc Profiles',
  'Standard Profiles',
] as const;

interface ProfileRow {
  id: string;
  name_en: string;
  profile_number: string;
  blank_width_in: number | null;
  blank_width_mm: number | null;
  machine_profile_categories: { name_en: string } | null;
}

interface BendRow {
  profile_id: string;
  step_number: number;
  left_leg_mm: number | null;
  right_leg_mm: number | null;
  bend_angle_degrees: number | null;
  radius_mm: number | null;
}

// Server component using the service-role client — same rationale as
// app/studio/profile-viewer/[profileId]/page.tsx: machine_profiles RLS
// requires auth.uid() IS NOT NULL even for public rows, which would break
// anonymous browsing of a page meant to be a public resource. Full
// visibility (public + private) is admin-only, not "any authenticated
// user" — most private rows carry real customer/project names (see
// scripts/import-machine-profiles.ts's own privacy rationale), so a
// regular signed-in customer or contractor must not see other customers'
// project names here. This mirrors the exact same admin-only rule already
// enforced for private rows on the standalone profile-viewer route. The
// admin client bypasses RLS either way, so this visibility rule is
// enforced here in application code, not by RLS.
export default async function ProfileLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: viewerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    isAdmin = viewerProfile?.role === 'admin';
  }

  const admin = createAdminClient();

  let profileQuery = admin
    .from('machine_profiles')
    .select('id, name_en, profile_number, blank_width_in, blank_width_mm, machine_profile_categories(name_en)')
    .eq('is_active', true)
    .order('name_en');
  if (!isAdmin) {
    profileQuery = profileQuery.eq('is_public', true);
  }
  const { data: profileRows } = await profileQuery.returns<ProfileRow[]>();

  const profiles = profileRows ?? [];
  const profileIds = profiles.map((p) => p.id);

  const [bendResult, fabricationCounts] = await Promise.all([
    profileIds.length > 0
      ? admin
          .from('machine_profile_bends')
          .select('profile_id, step_number, left_leg_mm, right_leg_mm, bend_angle_degrees, radius_mm')
          .in('profile_id', profileIds)
          .order('step_number', { ascending: true })
          .returns<BendRow[]>()
      : Promise.resolve({ data: [] as BendRow[] }),
    computeFabricationCounts(admin),
  ]);

  const bendsByProfile = new Map<string, BendRow[]>();
  for (const row of bendResult.data ?? []) {
    const list = bendsByProfile.get(row.profile_id) ?? [];
    list.push(row);
    bendsByProfile.set(row.profile_id, list);
  }

  const cards: LibraryProfileCardData[] = profiles.map((p) => {
    const bends = bendsByProfile.get(p.id) ?? [];
    return {
      id: p.id,
      nameEn: p.name_en,
      profileNumber: p.profile_number,
      categoryName: p.machine_profile_categories?.name_en ?? 'Uncategorized',
      blankWidthIn: p.blank_width_in,
      blankWidthMm: p.blank_width_mm,
      bendCount: bends.length,
      bends: bends.map((b) => ({
        leftLegMm: b.left_leg_mm,
        rightLegMm: b.right_leg_mm,
        bendAngleDegrees: b.bend_angle_degrees,
        radiusMm: b.radius_mm,
      })),
      fabricatedCount: fabricationCounts.get(p.id) ?? 1,
    };
  });

  const dbCategoryNames = Array.from(new Set(cards.map((c) => c.categoryName))).filter(
    (name) => !(AFS_PRODUCT_CATEGORIES as readonly string[]).includes(name),
  );
  const categories = [...AFS_PRODUCT_CATEGORIES, ...dbCategoryNames.sort()];

  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="px-6 pt-10 pb-6 text-center">
        <Link href="/studio" className="font-label text-xs text-afs-chrome-dim hover:text-afs-crimson transition-colors">
          ← Design Studio
        </Link>
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-2 mt-3">Machine Library</p>
        <h1 className="font-display text-5xl text-afs-chrome-high leading-none mb-3">Profile Library</h1>
        <p className="font-body text-afs-chrome-mid text-sm max-w-xl mx-auto">
          Browse every profile in our machine library
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-24">
        <ProfileLibraryBrowser profiles={cards} categories={categories} />
      </div>
    </main>
  );
}
