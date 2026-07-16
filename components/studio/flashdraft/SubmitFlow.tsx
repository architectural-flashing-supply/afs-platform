'use client';

import { useEffect, useState } from 'react';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import {
  type PaintFace,
  isPaintedMaterial,
  approxPaintColor,
  BARE_METAL_COLOR,
  ROTATE_SPEED,
  ROTATE_DURATION_MS,
} from '@/lib/utils/paint-appearance';

export interface SubmitFlowProps {
  bends: ProfileBend[];
  blankWidthMm: number;
  material: string;
  gauge: string;
  thicknessMm: number;
  profileName: string;
  requestNumber: string | null;
  paintFace: PaintFace | null;
}

// Post-submission full-screen 3D confirmation — plays one auto-rotation of
// the confirmed profile, then reveals the "View My Requests" CTA. Reuses
// ProfileViewer3D's own internal autoRotateDurationMs stop rather than
// tracking rotation state separately.
export default function SubmitFlow({ bends, blankWidthMm, material, gauge, thicknessMm, profileName, requestNumber, paintFace }: SubmitFlowProps) {
  const [showCta, setShowCta] = useState(false);
  const isPainted = isPaintedMaterial(material);

  useEffect(() => {
    const timer = setTimeout(() => setShowCta(true), ROTATE_DURATION_MS + 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[80] flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-1">Quote Request Submitted</p>
        <h2 className="font-heading text-3xl text-white">{profileName}</h2>
        {requestNumber && <p className="font-data text-sm text-afs-chrome-mid mt-1">{requestNumber}</p>}
      </div>

      <div style={{ width: 700, maxWidth: '100%', height: 520 }} className="bg-afs-bg-dim rounded overflow-hidden">
        <ProfileViewer3D
          bends={bends}
          blankWidth={blankWidthMm}
          material={material}
          gauge={gauge}
          thicknessMm={thicknessMm}
          profileName={profileName}
          paintFace={isPainted ? paintFace ?? 'up' : undefined}
          paintColor={isPainted ? approxPaintColor(material) : undefined}
          bareColor={isPainted ? BARE_METAL_COLOR : undefined}
          autoRotateSpeed={ROTATE_SPEED}
          autoRotateDurationMs={ROTATE_DURATION_MS}
          className="w-full h-full"
        />
      </div>

      {showCta ? (
        <a
          href="/account/quotes"
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
        >
          View My Requests
        </a>
      ) : (
        <p className="font-body text-sm text-afs-chrome-mid">AFS will review your FlashDraft profile and follow up with a formal quote.</p>
      )}
    </div>
  );
}
