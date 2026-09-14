'use client';

import ColorField from './ColorField';
import { colorPaletteForMaterial, type AluminumFinish } from '@/lib/data/material-color-requirement';

const FINISH_OPTIONS: AluminumFinish[] = ['Anodized', 'Painted'];

interface FinishColorFieldProps {
  material: string;
  finish: AluminumFinish | null;
  onFinishChange: (finish: AluminumFinish) => void;
  color: string;
  onColorChange: (name: string) => void;
}

/**
 * Required Finish choice (Anodized / Painted) + color capture for 'aluminum'
 * category materials (afs-jf-002) — supersedes afs-cv-002's ruling that
 * every aluminum material always shows the PAC-CLAD picker. Rendered by all
 * three wired surfaces (Quote Builder, FlashDraft, Blueprint Takeoff AI) in
 * place of a plain ColorField whenever
 * requiresFinishChoice(material) is true; the McElroy/painted-steel path is
 * untouched and keeps rendering ColorField directly.
 *
 * "Painted" always shows the PAC-CLAD picker (ColorField). "Anodized" shows
 * that same picker ONLY once lib/data/metal-colors.ts's pacclad_anodized
 * array has real entries — until then it shows a free-text input instead.
 * That branch lives entirely in colorPaletteForMaterial, not here, so this
 * component (and every surface that renders it) needs no changes when the
 * anodized chart is added — see the FUTURE-SWAP HOOK comment on
 * colorPaletteForMaterial in lib/data/material-color-requirement.ts.
 */
export default function FinishColorField({
  material,
  finish,
  onFinishChange,
  color,
  onColorChange,
}: FinishColorFieldProps) {
  const palette = finish ? colorPaletteForMaterial(material, finish) : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">
          Finish <span className="text-afs-crimson">*</span>
        </label>
        <div className="flex gap-2">
          {FINISH_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onFinishChange(option)}
              className={`flex-1 font-label text-sm px-3 py-2.5 rounded border transition-colors ${
                finish === option
                  ? 'bg-afs-crimson text-white border-afs-crimson'
                  : 'bg-afs-bg-overlay text-white border-afs-border hover:border-afs-chrome-base'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {!finish && (
          <p className="font-body text-xs text-afs-crimson mt-1">Required for {material}.</p>
        )}
      </div>

      {finish && (
        palette ? (
          <ColorField
            palette={palette}
            value={color || null}
            onChange={onColorChange}
            error={color.trim() === '' ? `Required for ${material} (${finish}).` : null}
          />
        ) : (
          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">
              Specify Anodized Color <span className="text-afs-crimson">*</span>
            </label>
            {/*
              FUTURE-SWAP HOOK (afs-jf-002): this free-text input stands in
              for the Anodized finish until PAC-CLAD's anodized aluminum
              color chart is available (expected within days). It renders
              only because colorPaletteForMaterial() returned null above —
              once lib/data/metal-colors.ts's pacclad_anodized array is
              populated with real { name, hex } entries, that function
              starts returning 'pacclad_anodized' instead and the branch
              above renders a real ColorField/ColorPickerModal picker here
              automatically. No change needed in this component.
            */}
            <input
              type="text"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              placeholder="e.g. Clear Anodized, Champagne, Dark Bronze…"
              className={`w-full bg-afs-bg-overlay border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors ${
                color.trim() === '' ? 'border-afs-crimson' : 'border-afs-border hover:border-afs-chrome-base'
              }`}
            />
            {color.trim() === '' && (
              <p className="font-body text-xs text-afs-crimson mt-1">Required for {material} (Anodized).</p>
            )}
            <p className="font-body text-xs text-afs-chrome-dim mt-1">
              AFS is finalizing the PAC-CLAD anodized color chart — type the anodized finish you need and our
              estimator will confirm it against the physical chart.
            </p>
          </div>
        )
      )}
    </div>
  );
}
