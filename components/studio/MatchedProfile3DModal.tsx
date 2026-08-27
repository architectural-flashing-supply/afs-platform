'use client';

import { useState } from 'react';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import {
  type PaintFace,
  isPaintedMaterial,
  resolveSelectedPaintColor,
  BARE_METAL_COLOR,
  ROTATE_SPEED,
  ROTATE_DURATION_MS,
} from '@/lib/utils/paint-appearance';

export interface MatchedProfile3DModalProps {
  profileName: string;
  bends: ProfileBend[];
  blankWidthMm: number;
  material: string;
  gauge: string;
  thicknessMm: number;
  color: string;
  onClose: () => void;
}

// View-only counterpart to SubmitConfirmation3DModal — shown when the
// customer clicks "View in 3D" on a matched library profile (Part 6),
// not part of the submit flow, so it only ever closes, never confirms.
export default function MatchedProfile3DModal({
  profileName,
  bends,
  blankWidthMm,
  material,
  gauge,
  thicknessMm,
  color,
  onClose,
}: MatchedProfile3DModalProps) {
  const isPainted = isPaintedMaterial(material);
  const [paintFace, setPaintFace] = useState<PaintFace>('up');

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 max-w-2xl w-full flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-1">Machine Library Match</p>
          <h2 className="font-heading text-2xl text-afs-chrome-high">{profileName}</h2>
          {isPainted && <p className="font-body text-sm text-afs-chrome-mid mt-1">Please confirm your painted side</p>}
        </div>

        <div style={{ width: 600, maxWidth: '100%', height: 500 }} className="bg-afs-bg-dim rounded overflow-hidden">
          <ProfileViewer3D
            bends={bends}
            blankWidth={blankWidthMm}
            material={material}
            gauge={gauge}
            thicknessMm={thicknessMm}
            profileName={profileName}
            paintFace={isPainted ? paintFace : undefined}
            paintColor={isPainted ? resolveSelectedPaintColor(material, color) : undefined}
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
            onClick={onClose}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
