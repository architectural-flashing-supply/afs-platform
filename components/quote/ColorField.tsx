'use client';

import { useState } from 'react';
import ColorPickerModal from './ColorPickerModal';
import type { ColorPalette } from '@/lib/data/material-color-requirement';
import { mcelroy, pacclad, pacclad_anodized } from '@/lib/data/metal-colors';

const PALETTE_COLORS: Record<ColorPalette, typeof mcelroy> = { mcelroy, pacclad, pacclad_anodized };

interface ColorFieldProps {
  palette: ColorPalette;
  value: string | null;
  onChange: (name: string) => void;
  error?: string | null;
}

/**
 * Required color field shown only for materials that need a painted/coated
 * color selection (see lib/data/material-color-requirement.ts). Renders a
 * trigger button — a swatch preview once a color is chosen, otherwise a
 * placeholder — that opens the full-page ColorPickerModal.
 */
export default function ColorField({ palette, value, onChange, error }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? PALETTE_COLORS[palette].find((c) => c.name === value) ?? null : null;

  return (
    <div>
      <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">
        Color <span className="text-afs-crimson">*</span>
      </label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-3 bg-afs-bg-overlay border rounded px-3 py-2.5 text-left transition-colors ${
          error ? 'border-afs-crimson' : 'border-afs-border hover:border-afs-chrome-base'
        }`}
      >
        {selected ? (
          <>
            {/* Swatch hex preview — see CANVAS_COLORS exception documented in ColorPickerModal.tsx */}
            <span
              className="block w-6 h-6 rounded shrink-0 border border-afs-chrome-dim"
              style={{ backgroundColor: selected.hex }}
              aria-hidden="true"
            />
            <span className="font-body text-sm text-afs-chrome-high truncate">{selected.name}</span>
          </>
        ) : (
          <span className="font-body text-sm text-afs-chrome-dim">Select a color…</span>
        )}
      </button>
      {error && <p className="font-body text-xs text-afs-crimson mt-1">{error}</p>}
      <ColorPickerModal
        isOpen={open}
        palette={palette}
        selectedName={value}
        onSelect={(color) => {
          onChange(color.name);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
