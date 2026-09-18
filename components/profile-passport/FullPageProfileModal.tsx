'use client';

import { useEffect } from 'react';
import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';

interface FullPageProfileModalProps {
  name: string;
  points: { x: number; y: number }[];
  /** Real canvas screenshot (025_profile_passport_thumbnail.sql) — falls back to the vector shape (CanonicalProfileDiagram) when null. */
  thumbnailImage: string | null;
  onClose: () => void;
}

/**
 * Replaces ProfilePreviewModal (deleted) — a full-viewport takeover instead
 * of a small centered popup, and deliberately has no "View in FlashDraft"
 * link (removed on explicit instruction, not an oversight). z-[100] is
 * higher than any other z-index in this app (the highest previously in use
 * was z-50 on other modals) so this always wins regardless of what else is
 * open underneath.
 */
export default function FullPageProfileModal({ name, points, thumbnailImage, onClose }: FullPageProfileModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-8 py-6 border-b border-afs-chrome-dim shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-2xl text-afs-chrome-high truncate">{name}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 ml-4 text-afs-chrome-mid hover:text-afs-chrome-high text-3xl leading-none transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {thumbnailImage ? (
          <img src={thumbnailImage} alt={name} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="w-full h-full max-w-4xl max-h-full bg-afs-bg-overlay rounded">
            <CanonicalProfileDiagram points={points} width={960} height={720} />
          </div>
        )}
      </div>
    </div>
  );
}
