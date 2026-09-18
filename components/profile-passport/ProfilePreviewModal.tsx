'use client';

import Link from 'next/link';
import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';

interface ProfilePreviewModalProps {
  profileId: string;
  name: string;
  points: { x: number; y: number }[];
  /** Real canvas screenshot (025_profile_passport_thumbnail.sql) — falls back to the vector shape (CanonicalProfileDiagram) when null. */
  thumbnailImage: string | null;
  onClose: () => void;
}

/**
 * Full-size geometry preview. Prefers the real captured screenshot over the
 * vector-shape fallback (CanonicalProfileDiagram, the same points-to-SVG
 * renderer the canonical profile browser uses) — a row saved before
 * 025_profile_passport_thumbnail.sql existed, or with capture disabled,
 * still gets a real preview instead of a blank box.
 */
export default function ProfilePreviewModal({ profileId, name, points, thumbnailImage, onClose }: ProfilePreviewModalProps) {
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
        <div className="bg-afs-bg-overlay border border-afs-border rounded flex items-center justify-center" style={{ height: 360 }}>
          {thumbnailImage ? (
            <img src={thumbnailImage} alt={name} className="max-w-full max-h-full object-contain" />
          ) : (
            <CanonicalProfileDiagram points={points} width={460} height={360} />
          )}
        </div>
        <div className="flex justify-end mt-4">
          <Link
            href={`/studio/draft?loadPassport=${profileId}`}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
          >
            View in FlashDraft →
          </Link>
        </div>
      </div>
    </div>
  );
}
