import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import EmptyState from '@/components/ui/EmptyState';
import SavedProfilesBrowser from '@/components/architects/SavedProfilesBrowser';
import type { SavedConfig } from '@/components/architects/SavedConfigCard';

export const metadata: Metadata = {
  title: 'Your Custom Profiles | AFS Architectural Flashing Supply',
  description: 'Saved and past custom flashing profiles, searchable and ready to reorder.',
};

interface SavedConfigRow {
  id: string;
  name: string | null;
  dimensions: { width?: number; height?: number; legA?: number; legB?: number } | null;
  length_ft: number | null;
  quantity: number | null;
  updated_at: string;
  product_profiles: { name: string; slug: string } | null;
  materials: { name: string } | null;
  gauges: { label: string } | null;
}

export default async function CustomProfilesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/architects/custom-profiles');

  const { data: rowsRaw } = await supabase
    .from('saved_configurations')
    .select(
      'id, name, dimensions, length_ft, quantity, updated_at, product_profiles(name, slug), materials(name), gauges(label)'
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  const rows = (rowsRaw ?? []) as unknown as SavedConfigRow[];

  const configs: SavedConfig[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    profileName: r.product_profiles?.name ?? 'Custom Profile',
    profileSlug: r.product_profiles?.slug ?? null,
    materialName: r.materials?.name ?? null,
    gaugeLabel: r.gauges?.label ?? null,
    width: r.dimensions?.width ?? null,
    height: r.dimensions?.height ?? null,
    legA: r.dimensions?.legA ?? null,
    legB: r.dimensions?.legB ?? null,
    lengthFt: r.length_ft,
    quantity: r.quantity,
    updatedAt: r.updated_at,
  }));

  return (
    <ArchitectShell>
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="mb-10">
          <ArchitectEyebrow>Saved Custom Profile Library</ArchitectEyebrow>
          <h1 className="font-display text-6xl text-afs-chrome-high leading-none mb-4">YOUR CUSTOM PROFILES</h1>
          <p className="font-body text-afs-chrome-mid text-base max-w-2xl">
            Past custom designs, saved for easy reference and reordering — no need to start from scratch.
          </p>
        </div>

        {configs.length === 0 ? (
          <EmptyState
            title="No custom profiles saved yet"
            description="Configure a profile and save it — or place a custom order. Both appear here for easy reordering."
            actionLabel="Configure a Profile"
            actionHref="/configure"
            accent="copper"
          />
        ) : (
          <SavedProfilesBrowser configs={configs} />
        )}
      </div>
    </ArchitectShell>
  );
}
