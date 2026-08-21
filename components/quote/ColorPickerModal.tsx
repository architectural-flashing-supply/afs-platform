'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { mcelroy, pacclad, pacclad_anodized, type MetalColor } from '@/lib/data/metal-colors';
import type { ColorPalette } from '@/lib/data/material-color-requirement';

const PALETTE_COLORS: Record<ColorPalette, MetalColor[]> = { mcelroy, pacclad, pacclad_anodized };
const PALETTE_LABEL: Record<ColorPalette, string> = {
  mcelroy: 'McElroy — Shades of Distinction',
  pacclad: 'PAC-CLAD Color Guide',
  pacclad_anodized: 'PAC-CLAD Anodized Color Guide',
};

interface ColorPickerModalProps {
  isOpen: boolean;
  palette: ColorPalette;
  selectedName: string | null;
  onSelect: (color: MetalColor) => void;
  onClose: () => void;
}

/**
 * Full-page color picker modal for the two painted/coated metal color
 * charts (McElroy for painted steel, PAC-CLAD for anodized aluminum).
 *
 * CANVAS_COLORS exception (CLAUDE.md rule #4): the swatch chip backgrounds
 * below render literal hex values sampled from the two source color chart
 * PDFs (see lib/data/metal-colors.ts) — a printed paint-chip color has no
 * afs-* token equivalent, exactly like the CANVAS_COLORS exception in
 * app/studio/draft/page.tsx and STRIPE_CARD_ELEMENT_COLORS in
 * app/checkout/page.tsx. Every other element in this modal — frame, search
 * box, labels, layout — uses afs-* tokens only.
 *
 * Browser history sync (afs-jf-001): this used to be a plain conditional-
 * render overlay with no browser history entry of its own, so pressing
 * Back while open fell through to whatever page actually preceded the
 * current one — navigating away from the host page entirely instead of
 * closing the modal. While open, it now pushes one history entry and
 * listens for `popstate` to close on Back. If it's instead closed via its
 * own Close button or a color selection, that pushed entry is popped with
 * `history.back()` so it doesn't linger as a stray forward-navigable entry
 * that would absorb a later, real Back press.
 */
export default function ColorPickerModal({
  isOpen,
  palette,
  selectedName,
  onSelect,
  onClose,
}: ColorPickerModalProps) {
  const [search, setSearch] = useState('');
  const pushedHistoryEntryRef = useRef(false);

  const colors = PALETTE_COLORS[palette];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return colors;
    return colors.filter((c) => c.name.toLowerCase().includes(q));
  }, [colors, search]);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ afsColorPickerModal: true }, '');
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
    <div className="fixed inset-0 z-[70] bg-afs-bg-dim flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-afs-chrome-dim shrink-0">
        <div>
          <p className="font-label text-xs uppercase tracking-wide text-afs-crimson">Select a Color</p>
          <h2 className="font-heading text-2xl text-afs-chrome-high">{PALETTE_LABEL[palette]}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-label text-sm text-afs-chrome-mid hover:text-afs-crimson border border-afs-border bg-afs-bg-overlay rounded px-4 py-2 transition-colors"
        >
          Close
        </button>
      </div>

      <div className="px-6 py-4 border-b border-afs-chrome-dim shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search colors by name…"
          className="w-full max-w-md bg-afs-bg-overlay border border-afs-border rounded px-4 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
          autoFocus
        />
        <p className="font-body text-xs text-afs-chrome-dim mt-2">
          {filtered.length} of {colors.length} colors — order and fabricate from the printed color name, confirmed
          against a physical chart or chip. Swatches here are display-only approximations, not fabrication
          specifications.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {filtered.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid text-center py-16">
            No colors match &quot;{search}&quot;.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            {filtered.map((color) => {
              const active = color.name === selectedName;
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => onSelect(color)}
                  className={`flex flex-col items-stretch rounded overflow-hidden border-2 bg-afs-bg-raised transition-colors text-left ${
                    active ? 'border-afs-crimson' : 'border-afs-chrome-dim hover:border-afs-chrome-base'
                  }`}
                >
                  {/* Swatch hex background — see CANVAS_COLORS exception in the module comment above. */}
                  <span className="block h-20 w-full" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                  <span className="font-body text-xs text-afs-chrome-high px-2 py-2 leading-tight">
                    {color.name}
                    {active && (
                      <span className="block font-label text-[10px] uppercase text-afs-crimson mt-1">Selected</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
