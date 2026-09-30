'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';

interface FullPageProfileModalProps {
  /** saved_configurations.id — the source for "Modify in FlashDraft". */
  id: string;
  name: string;
  points: { x: number; y: number }[];
  /** Real canvas screenshot (025_profile_passport_thumbnail.sql) — falls back to the vector shape (CanonicalProfileDiagram) when null. */
  thumbnailImage: string | null;
  onClose: () => void;
}

/**
 * Replaces ProfilePreviewModal (deleted) — a full-viewport takeover instead
 * of a small centered popup. It still has no "VIEW in FlashDraft" link: that
 * was removed on explicit instruction and has not come back.
 *
 * It does now carry "MODIFY in FlashDraft" (Part 1, 2026-09-30), which is a
 * different action, added on explicit instruction: it opens the profile as a
 * NEW, UNLOCKED draft linked to this one (?modifyProfile=<id>), so the
 * original — locked or not — is never edited or overwritten. z-[100] is
 * higher than any other z-index in this app (the highest previously in use
 * was z-50 on other modals) so this always wins regardless of what else is
 * open underneath.
 */
export default function FullPageProfileModal({ id, name, points, thumbnailImage, onClose }: FullPageProfileModalProps) {
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
        <div className="shrink-0 ml-4 flex items-center gap-4">
          {/* Opens a NEW unlocked draft linked to this profile. Safe on a
              locked original: the draft saves as its own row (see
              loadForModify in app/studio/draft/page.tsx). */}
          <Link
            href={`/studio/draft?modifyProfile=${id}`}
            data-testid="modify-in-flashdraft"
            className="border border-afs-crimson bg-afs-crimson/10 text-afs-chrome-high hover:bg-afs-crimson/20 font-label text-sm font-semibold px-4 py-2 rounded transition-colors whitespace-nowrap"
          >
            Modify in FlashDraft
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-afs-chrome-mid hover:text-afs-chrome-high text-3xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>
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
