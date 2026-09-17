'use client';

import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';

interface ProfilePreviewModalProps {
  name: string;
  points: { x: number; y: number }[];
  onClose: () => void;
}

/** Full-size geometry preview — reuses CanonicalProfileDiagram's pure points-to-SVG renderer (components/studio/CanonicalProfileDiagram.tsx), the same one the canonical profile browser uses, rather than a second implementation. */
export default function ProfilePreviewModal({ name, points, onClose }: ProfilePreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6" onClick={onClose}>
      <div
        className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl text-afs-chrome-high">{name}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-afs-chrome-mid hover:text-afs-chrome-high">
            ✕
          </button>
        </div>
        <div className="bg-afs-bg-overlay border border-afs-border rounded" style={{ height: 360 }}>
          <CanonicalProfileDiagram points={points} width={460} height={360} />
        </div>
      </div>
    </div>
  );
}
