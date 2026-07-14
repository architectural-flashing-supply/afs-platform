'use client';

import { useState } from 'react';
import { FINISHES } from '@/lib/data/catalog';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';

export type PaintFace = 'up' | 'down';

export interface SubmitConfirmation3DModalProps {
  bends: ProfileBend[];
  blankWidthMm: number;
  material: string;
  gauge: string;
  thicknessMm: number;
  onConfirm: (paintFace: PaintFace | null) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const PAINTED_MATERIAL_PATTERN = /kynar|painted|vintage/i;
// Mirrors ProfileViewer3D's default galvanized-steel appearance — the
// "opposite face renders as bare metal" default color for the split view.
const BARE_METAL_COLOR = '#B8C4CC';
const ROTATE_SPEED = 6; // one full 360° orbit in ROTATE_DURATION_MS at 60fps
const ROTATE_DURATION_MS = 10000;

function approxPaintColor(material: string): string {
  if (/vintage/i.test(material)) return '#7A6B5A';
  const kynarFinish = FINISHES.find((f) => /kynar/i.test(f.name));
  return kynarFinish?.hex ?? '#5B6470';
}

export default function SubmitConfirmation3DModal({
  bends,
  blankWidthMm,
  material,
  gauge,
  thicknessMm,
  onConfirm,
  onCancel,
  submitting,
}: SubmitConfirmation3DModalProps) {
  const isPainted = PAINTED_MATERIAL_PATTERN.test(material);
  const [paintFace, setPaintFace] = useState<PaintFace>('up');

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 max-w-2xl w-full flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-1">Confirm Before Submitting</p>
          <h2 className="font-heading text-2xl text-afs-chrome-high">
            {isPainted ? 'Please confirm your painted side' : 'Confirm Your Profile'}
          </h2>
        </div>

        <div style={{ width: 600, maxWidth: '100%', height: 500 }} className="bg-afs-bg-dim rounded overflow-hidden">
          <ProfileViewer3D
            bends={bends}
            blankWidth={blankWidthMm}
            material={material}
            gauge={gauge}
            thicknessMm={thicknessMm}
            paintFace={isPainted ? paintFace : undefined}
            paintColor={isPainted ? approxPaintColor(material) : undefined}
            bareColor={isPainted ? BARE_METAL_COLOR : undefined}
            autoRotateSpeed={ROTATE_SPEED}
            autoRotateDurationMs={ROTATE_DURATION_MS}
            className="w-full h-full"
          />
        </div>

        {isPainted && (
          <button
            type="button"
            onClick={() => setPaintFace((f) => (f === 'up' ? 'down' : 'up'))}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-4 py-2 rounded transition-colors"
          >
            Flip Paint Side
          </button>
        )}

        <div className="flex gap-3 justify-center w-full pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50"
          >
            Go back and edit
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isPainted ? paintFace : null)}
            disabled={submitting}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Looks correct — Submit Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
