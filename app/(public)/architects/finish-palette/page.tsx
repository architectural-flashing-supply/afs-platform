import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import EmptyState from '@/components/ui/EmptyState';
import FinishPaletteBrowser from '@/components/architects/FinishPaletteBrowser';
import type { Finish } from '@/components/architects/FinishChip';

export const metadata: Metadata = {
  title: 'Finish & Color Library | AFS Architectural Flashing Supply',
  description: 'Digital color chips and downloadable finish palettes for every AFS material.',
};

interface MaterialRow {
  id: string;
  name: string;
  slug: string;
}

interface FinishRow {
  id: string;
  material_id: string;
  name: string;
  manufacturer: string | null;
  color_code: string | null;
  hex_preview: string | null;
  is_standard: boolean;
  upcharge_pct: number;
}

export default async function FinishPalettePage() {
  const supabase = await createClient();

  const { data: materialsRaw } = await supabase
    .from('materials')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const materials = (materialsRaw ?? []) as MaterialRow[];

  const { data: finishesRaw } = await supabase
    .from('finishes')
    .select('id, material_id, name, manufacturer, color_code, hex_preview, is_standard, upcharge_pct')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const finishRows = (finishesRaw ?? []) as FinishRow[];

  const finishesByMaterial: Record<string, Finish[]> = {};
  for (const row of finishRows) {
    const list = finishesByMaterial[row.material_id] ?? [];
    list.push({
      id: row.id,
      name: row.name,
      manufacturer: row.manufacturer,
      colorCode: row.color_code,
      hexPreview: row.hex_preview,
      isStandard: row.is_standard,
    });
    finishesByMaterial[row.material_id] = list;
  }

  return (
    <ArchitectShell>
      <section className="metal-edge metal-edge-copper px-6 pt-16 pb-12 text-center border-b border-afs-border">
        <ArchitectEyebrow>AFS Finish &amp; Color Library</ArchitectEyebrow>
        <h1 className="font-display text-6xl text-afs-ink-900 leading-none mb-4">FINISH PALETTE</h1>
        <p className="font-body text-afs-ink-700 text-base max-w-2xl mx-auto">
          Digital color chips and downloadable palettes for every AFS material.
        </p>
      </section>

      <div className="max-w-[1280px] mx-auto px-6 py-12">
        {materials.length === 0 ? (
          <EmptyState
            title="Finish library coming soon"
            description="Material and finish data is being finalized. Contact AFS for current finish availability."
            actionLabel="Contact AFS for Finish Information"
            actionHref="/contact"
            accent="copper"
          />
        ) : (
          <FinishPaletteBrowser materials={materials} finishesByMaterial={finishesByMaterial} />
        )}
      </div>
    </ArchitectShell>
  );
}
