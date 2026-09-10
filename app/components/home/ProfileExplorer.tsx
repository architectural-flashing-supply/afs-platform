import { Suspense } from 'react';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeFabricationCounts } from '@/lib/data/machine-profile-fabrication';
import ProfileLibraryBrowser, { type LibraryProfileCardData } from '@/components/studio/ProfileLibraryBrowser';

const HOMEPAGE_PROFILE_LIMIT = 12;

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

// Same public+active machine_profiles source ProfileLibraryBrowser is fed
// from today (app/studio/library/page.tsx) — service-role client for the
// same reason that page uses one: machine_profiles RLS requires
// auth.uid() IS NOT NULL even on is_public rows, which would break
// anonymous homepage visitors. Unlike the library page, there is no
// admin/private-row branch here — the homepage is always the public view.
async function loadHomepageProfiles(): Promise<{ cards: LibraryProfileCardData[]; categories: string[] } | null> {
  const admin = createAdminClient();

  const { data: profileRows, error: profileError } = await admin
    .from('machine_profiles')
    .select('id, name_en, profile_number, blank_width_in, blank_width_mm, machine_profile_categories(name_en)')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('name_en')
    .returns<ProfileRow[]>();

  if (profileError) return null;

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
      : Promise.resolve({ data: [] as BendRow[], error: null }),
    computeFabricationCounts(admin),
  ]);

  if (bendResult.error) return null;

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

  // Real distinct categories only — no curated/hardcoded vocabulary (unlike
  // app/studio/library/page.tsx's AFS_PRODUCT_CATEGORIES list).
  const categories = Array.from(new Set(cards.map((c) => c.categoryName))).sort();

  return { cards, categories };
}

async function ProfileExplorerContent() {
  const result = await loadHomepageProfiles();

  if (!result) {
    return (
      <p className="font-body text-sm text-afs-chrome-mid py-16 text-center">
        Couldn&apos;t load the profile library right now. Try again shortly, or browse the{' '}
        <Link href="/studio/library" className="text-afs-crimson hover:underline">
          full library
        </Link>
        .
      </p>
    );
  }

  const { cards, categories } = result;

  if (cards.length === 0) {
    return (
      <p className="font-body text-sm text-afs-chrome-mid py-16 text-center">
        No profiles are published yet. Check back soon, or browse the{' '}
        <Link href="/studio/library" className="text-afs-crimson hover:underline">
          full library
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <ProfileLibraryBrowser profiles={cards} categories={categories} compact limit={HOMEPAGE_PROFILE_LIMIT} show3DToggle />
      <div className="text-center mt-10">
        <Link href="/studio/library" className="font-label text-sm font-semibold text-afs-crimson hover:underline">
          See the full library →
        </Link>
      </div>
    </>
  );
}

function ProfileExplorerSkeleton() {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-afs-bg-overlay animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[340px] rounded bg-afs-bg-raised border border-afs-chrome-dim animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function ProfileExplorer() {
  return (
    <section id="profile-explorer" className="bg-afs-bg-base py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-5xl text-afs-chrome-high leading-none mb-3">Explore our profiles</h2>
          <p className="font-body text-afs-chrome-mid text-sm max-w-xl mx-auto">
            Real profiles from our machine library — filter by category and preview any shape in 3D.
          </p>
        </div>
        <Suspense fallback={<ProfileExplorerSkeleton />}>
          <ProfileExplorerContent />
        </Suspense>
      </div>
    </section>
  );
}
