'use client';

import { useMemo, useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import FinishChip, { type Finish } from './FinishChip';

interface MaterialTab {
  id: string;
  name: string;
  slug: string;
}

interface FinishPaletteBrowserProps {
  materials: MaterialTab[];
  finishesByMaterial: Record<string, Finish[]>;
}

export default function FinishPaletteBrowser({ materials, finishesByMaterial }: FinishPaletteBrowserProps) {
  const [activeMaterialId, setActiveMaterialId] = useState(materials[0]?.id ?? '');

  const activeMaterial = useMemo(
    () => materials.find((m) => m.id === activeMaterialId) ?? materials[0],
    [materials, activeMaterialId]
  );
  const activeFinishes = activeMaterial ? finishesByMaterial[activeMaterial.id] ?? [] : [];

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-10 border-b border-afs-chrome-dim flex-wrap">
        {materials.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveMaterialId(m.id)}
            className={`font-label text-sm px-6 py-3 border-b-2 transition-colors ${
              activeMaterial?.id === m.id
                ? 'border-afs-copper text-afs-chrome-high'
                : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {activeFinishes.length === 0 ? (
        <EmptyState
          title="Finish library coming soon"
          description="Digital color chips for this material are being prepared."
          actionLabel="Contact AFS for Finish Information"
          actionHref="/contact"
          accent="copper"
        />
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-8 justify-items-center mb-10">
            {activeFinishes.map((f) => (
              <FinishChip key={f.id} finish={f} />
            ))}
          </div>
          <div className="text-center">
            <a
              href={`/api/architects/palette/${activeMaterial?.slug}/pdf`}
              className="inline-block border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              Download Complete Palette (PDF)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
