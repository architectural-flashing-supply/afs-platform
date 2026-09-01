'use client';

import { useEffect, useRef, useState } from 'react';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import type { Hem } from '@/lib/types/profile';
import {
  type PaintFace,
  isPaintedMaterial,
  resolveSelectedPaintColor,
  BARE_METAL_COLOR,
  ROTATE_SPEED,
  ROTATE_DURATION_MS,
} from '@/lib/utils/paint-appearance';

export type { PaintFace };

export interface SubmitConfirmation3DModalProps {
  isOpen: boolean;
  bends: ProfileBend[];
  blankWidthMm: number;
  material: string;
  gauge: string;
  thicknessMm: number;
  color: string;
  initialPaintFace: PaintFace;
  /** Real hem fold data from FlashDraft's own draft canvas (afs-fl-018) — see ProfileViewer3D's own doc comment. */
  hemStart?: Hem | null;
  hemEnd?: Hem | null;
  onConfirm: (paintFace: PaintFace | null) => void;
  onCancel: () => void;
  submitting?: boolean;
}

/**
 * Browser history sync (afs-fl-028): follows the same always-mounted,
 * isOpen-gated pattern as components/quote/ColorPickerModal.tsx and
 * components/studio/VariantPicker.tsx — see VariantPicker's doc comment for
 * why conditionally mounting this modal (i.e. only rendering it when open)
 * would break under React Strict Mode's dev-only double-invoked effect.
 * The caller (app/studio/draft/page.tsx) keeps this component mounted at
 * all times and toggles `isOpen`.
 */
export default function SubmitConfirmation3DModal({
  isOpen,
  bends,
  blankWidthMm,
  material,
  gauge,
  thicknessMm,
  color,
  initialPaintFace,
  hemStart,
  hemEnd,
  onConfirm,
  onCancel,
  submitting,
}: SubmitConfirmation3DModalProps) {
  const isPainted = isPaintedMaterial(material);
  // Seeded from the customer's early 2D choice (app/studio/draft/page.tsx's
  // page-level paintFace state) rather than always resetting to 'up' — the
  // 2D decision carries through to this final confirmation instead of being
  // silently discarded (afs-fl-013). Re-seeded on every open (not just on
  // first mount) below now that this component stays mounted across opens.
  const [paintFace, setPaintFace] = useState<PaintFace>(initialPaintFace);
  const pushedHistoryEntryRef = useRef(false);

  useEffect(() => {
    if (isOpen) setPaintFace(initialPaintFace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ afsSubmitConfirmation3DModal: true }, '');
    pushedHistoryEntryRef.current = true;

    const handlePopState = () => {
      pushedHistoryEntryRef.current = false;
      onCancel();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (pushedHistoryEntryRef.current) {
        pushedHistoryEntryRef.current = false;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col items-center gap-4">
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
            paintColor={isPainted ? resolveSelectedPaintColor(material, color) : undefined}
            bareColor={isPainted ? BARE_METAL_COLOR : undefined}
            hemStart={hemStart}
            hemEnd={hemEnd}
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
