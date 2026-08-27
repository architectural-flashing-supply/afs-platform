'use client';

import { useEffect, useRef } from 'react';

export interface VariantPickerOption {
  id: string;
  label: string;
  /** Raw template-space points (same 600x600 design canvas as
   *  PROFILE_TEMPLATES in app/studio/draft/page.tsx) — used only to draw
   *  the small preview outline below, not converted to world inches here. */
  points: { x: number; y: number }[];
}

interface VariantPickerProps {
  isOpen: boolean;
  /** e.g. "Coping Cap" — shown as "Choose a — Variant" in the header. */
  categoryLabel: string;
  variants: VariantPickerOption[];
  onSelect: (variant: VariantPickerOption) => void;
  onClose: () => void;
}

// Normalizes a variant's raw template points into a 0-100 box so the
// thumbnail shows the actual placeholder outline instead of a generic icon.
// No product photography exists yet for these variants — see the
// PROFILE_TEMPLATES PLACEHOLDER comment in app/studio/draft/page.tsx.
function previewPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const pad = 12;
  const scale = Math.min((100 - pad * 2) / spanX, (100 - pad * 2) / spanY);
  return points
    .map((p, i) => {
      const x = pad + (p.x - minX) * scale;
      const y = pad + (p.y - minY) * scale;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Generic, reusable thumbnail selector for template categories that have
 * more than one real sub-variant (e.g. Coping Cap: 2-piece cleat / 1-piece
 * cleat / face cleat). Not hardcoded to any one profile — callers pass
 * their own category label and variant list. Modeled on
 * components/quote/ColorPickerModal.tsx's full-page thumbnail-grid +
 * browser-history pattern, including its `isOpen`-gated-effect shape: the
 * caller keeps this component mounted at all times and toggles `isOpen`,
 * rather than conditionally mounting/unmounting it. Conditionally mounting
 * instead (i.e. only rendering `<VariantPicker>` when open) makes every
 * open a fresh mount, and React 18 Strict Mode's dev-only double-invoke of
 * a freshly-mounted effect (mount → cleanup → mount) races this effect's
 * cleanup's async `history.back()` against the second mount's own popstate
 * listener — the delayed popstate from that back() call lands on the new
 * listener and immediately closes the picker right after it opens.
 */
export default function VariantPicker({ isOpen, categoryLabel, variants, onSelect, onClose }: VariantPickerProps) {
  const pushedHistoryEntryRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ afsVariantPicker: true }, '');
    pushedHistoryEntryRef.current = true;

    const handlePopState = () => {
      pushedHistoryEntryRef.current = false;
      onClose();
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
    <div className="fixed inset-0 z-[70] bg-afs-bg-dim/90 flex items-center justify-center p-4">
      <div className="bg-afs-bg-raised border border-afs-border rounded-lg shadow-raised max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-afs-border shrink-0">
          <div>
            <p className="font-label text-xs uppercase tracking-wide text-afs-crimson">Choose a Variant</p>
            <h2 className="font-heading text-xl text-afs-chrome-high">{categoryLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-label text-sm text-afs-chrome-mid hover:text-afs-crimson border border-afs-border bg-afs-bg-overlay rounded px-4 py-2 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="px-5 pt-4">
          <p className="font-label text-[10px] text-afs-amber uppercase tracking-wide">
            Placeholder geometry — pending real reference-image dimensions
          </p>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant)}
              className="flex flex-col items-center gap-2 p-3 rounded border border-afs-border hover:border-afs-crimson bg-afs-bg-surface transition-colors"
            >
              <svg viewBox="0 0 100 100" className="w-full h-20">
                <path
                  d={previewPath(variant.points)}
                  className="stroke-afs-crimson fill-none"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-label text-xs text-afs-chrome-mid text-center">{variant.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
