import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import CanonicalProfileBrowser, {
  type CanonicalProfileCardData,
} from '@/components/studio/CanonicalProfileBrowser';

export const metadata: Metadata = {
  title: 'Profile Library | AFS Architectural Flashing Supply',
  description:
    'Browse the AFS canonical profile library — hand-authored reference profiles you can load straight into FlashDraft.',
};

// This page used to show two tabs: "Machine Profiles" (the 911 AI-read
// profiles imported from the OLD Thalmann's database) and "Canonical
// Profiles". The machine tab and its whole data set were removed in
// Command Center V2 prompt v2-01 — the imported geometry was AI-read from a
// legacy database and never geometrically validated, which is exactly the
// wrong thing to hand a customer as a starting point (see
// docs/COMMAND_CENTER_V2_SPEC.md §2.8). The raw source files are archived
// outside the repo at C:\Users\manag\Documents\afs-assets\old-machine-files\.
//
// What is left is the canonical library: `canonical_profiles`, hand-authored
// reference geometry with both an authored point list and a bend list. There
// is no tab strip any more because there is only one library.
//
// Service-role client, same rationale as /api/studio/canonical-profiles:
// these are public reference profiles with no private-row concept, and an
// anonymous visitor browsing the library has no auth.uid() for RLS to match.
interface CanonicalProfileRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  blank_width_in: number;
  points: { x: number; y: number }[];
  bends: CanonicalProfileCardData['bends'];
  tags: string[];
  sort_order: number;
}

export const dynamic = 'force-dynamic';

export default async function ProfileLibraryPage() {
  const admin = createAdminClient();

  const { data } = await admin
    .from('canonical_profiles')
    .select('id, name, slug, category, description, blank_width_in, points, bends, tags, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .returns<CanonicalProfileRow[]>();

  const profiles: CanonicalProfileCardData[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description,
    blankWidthIn: row.blank_width_in,
    points: row.points,
    bends: row.bends,
    tags: row.tags,
  }));

  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="px-6 pt-10 pb-6 text-center">
        <Link href="/studio" className="font-label text-xs text-afs-chrome-dim hover:text-afs-crimson transition-colors">
          ← Design Studio
        </Link>
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-2 mt-3">Profile Library</p>
        <h1 className="font-display text-5xl text-afs-chrome-high leading-none mb-3">Profile Library</h1>
        <p className="font-body text-afs-chrome-mid text-sm max-w-xl mx-auto">
          Browse our reference profiles and load one straight into FlashDraft
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-24">
        {profiles.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-dim text-center py-16">
            No profiles in the library yet.
          </p>
        ) : (
          <CanonicalProfileBrowser profiles={profiles} />
        )}
      </div>
    </main>
  );
}
