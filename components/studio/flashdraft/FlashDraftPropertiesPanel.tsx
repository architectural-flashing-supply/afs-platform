'use client';

import { useEffect, useState } from 'react';
import { formatInches } from '@/lib/flashdraft/geometry';
import type { FlashDraftAction, FlashDraftState, HemType } from '@/lib/flashdraft/types';

interface FlashDraftPropertiesPanelProps {
  state: FlashDraftState;
  dispatch: React.Dispatch<FlashDraftAction>;
}

const FRACTIONS = [
  { label: '0', value: 0 },
  { label: '1/8', value: 0.125 },
  { label: '1/4', value: 0.25 },
  { label: '3/8', value: 0.375 },
  { label: '1/2', value: 0.5 },
  { label: '5/8', value: 0.625 },
  { label: '3/4', value: 0.75 },
  { label: '7/8', value: 0.875 },
];

const INPUT_CLASS =
  'w-full border border-afs-accent-green rounded px-2 py-1 font-mono text-sm text-afs-ink-900 bg-white focus:outline-none focus:ring-1 focus:ring-afs-accent-green';

function decompose(totalIn: number): { ft: number; wholeIn: number; fraction: number } {
  const safeTotal = Math.max(0, totalIn);
  const ft = Math.floor(safeTotal / 12);
  const remainder = safeTotal - ft * 12;
  const wholeIn = Math.floor(remainder);
  const frac = remainder - wholeIn;
  const fraction = FRACTIONS.reduce((closest, f) => (Math.abs(frac - f.value) < Math.abs(frac - closest) ? f.value : closest), 0);
  return { ft, wholeIn, fraction };
}

function LengthEditor({ totalIn, onChange }: { totalIn: number; onChange: (totalIn: number) => void }) {
  const { ft, wholeIn, fraction } = decompose(totalIn);
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="text-[10px] text-afs-ink-700 block mb-1">Feet</label>
        <input
          type="number"
          min={0}
          value={ft}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 12 + wholeIn + fraction)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className="text-[10px] text-afs-ink-700 block mb-1">In</label>
        <input
          type="number"
          min={0}
          max={11}
          value={wholeIn}
          onChange={(e) => onChange(ft * 12 + Math.max(0, Math.min(11, Number(e.target.value) || 0)) + fraction)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className="text-[10px] text-afs-ink-700 block mb-1">Frac</label>
        <select value={fraction} onChange={(e) => onChange(ft * 12 + wholeIn + Number(e.target.value))} className={INPUT_CLASS}>
          {FRACTIONS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function FlashDraftPropertiesPanel({ state, dispatch }: FlashDraftPropertiesPanelProps) {
  const { profile, interaction } = state;
  const { geometry } = profile;

  const [angleDraft, setAngleDraft] = useState('');
  const [radiusDraft, setRadiusDraft] = useState('');

  const selectedBend = interaction.type === 'SELECTED_BEND' ? geometry.bendPoints.find((b) => b.id === interaction.bendPointId) : undefined;

  useEffect(() => {
    if (!selectedBend) return;
    setAngleDraft(selectedBend.angleDegrees.toFixed(1));
    setRadiusDraft(selectedBend.radiusIn.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBend?.id]);

  const commitAngle = () => {
    if (!selectedBend) return;
    const v = Number(angleDraft);
    if (Number.isFinite(v)) dispatch({ type: 'SET_BEND_ANGLE', bendPointId: selectedBend.id, angleDegrees: v });
  };
  const commitRadius = () => {
    if (!selectedBend) return;
    const v = Number(radiusDraft);
    if (Number.isFinite(v) && v > 0) dispatch({ type: 'SET_BEND_RADIUS', bendPointId: selectedBend.id, radiusIn: v });
  };

  if (interaction.type === 'SELECTED_LEG') {
    const leg = geometry.legs.find((l) => l.id === interaction.legId);
    if (!leg) return null;
    return (
      <div className="border border-afs-border rounded p-3 bg-afs-bg-raised">
        <p className="text-xs font-semibold text-afs-ink-700 uppercase mb-2">Leg Length</p>
        <LengthEditor totalIn={leg.lengthIn} onChange={(v) => dispatch({ type: 'SET_LEG_LENGTH', legId: leg.id, lengthIn: v })} />
      </div>
    );
  }

  if (interaction.type === 'SELECTED_BEND' && selectedBend) {
    return (
      <div className="border border-afs-border rounded p-3 bg-afs-bg-raised flex flex-col gap-3">
        <p className="text-xs font-semibold text-afs-ink-700 uppercase">Bend</p>
        <div>
          <label className="text-[10px] text-afs-ink-700 block mb-1">Angle (degrees)</label>
          <input
            type="number"
            step={1}
            value={angleDraft}
            onChange={(e) => setAngleDraft(e.target.value)}
            onBlur={commitAngle}
            onKeyDown={(e) => e.key === 'Enter' && commitAngle()}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="text-[10px] text-afs-ink-700 block mb-1">Radius (in)</label>
          <input
            type="number"
            step={0.0625}
            value={radiusDraft}
            onChange={(e) => setRadiusDraft(e.target.value)}
            onBlur={commitRadius}
            onKeyDown={(e) => e.key === 'Enter' && commitRadius()}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    );
  }

  if (interaction.type === 'SELECTED_HEM') {
    const hem = geometry.hems.find((h) => h.id === interaction.hemId);
    if (!hem) return null;
    return (
      <div className="border border-afs-border rounded p-3 bg-afs-bg-raised flex flex-col gap-3">
        <p className="text-xs font-semibold text-afs-ink-700 uppercase">Hem</p>
        <div className="flex gap-2">
          {(['open', 'smashed', 'teardrop'] as HemType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => dispatch({ type: 'SET_HEM_TYPE', hemId: hem.id, hemType: t })}
              className={`flex-1 py-2 rounded text-xs font-semibold capitalize transition-colors ${
                hem.type === t ? 'bg-afs-crimson text-white' : 'bg-afs-bg-surface text-white hover:bg-afs-bg-overlay'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div>
          <label className="text-[10px] text-afs-ink-700 block mb-1">Length</label>
          <LengthEditor totalIn={hem.lengthIn} onChange={(v) => dispatch({ type: 'SET_HEM_LENGTH', hemId: hem.id, lengthIn: v })} />
        </div>
        {hem.type === 'open' && (
          <div>
            <label className="text-xs text-afs-ink-700 mb-1 block">Gap (inches)</label>
            <input
              type="number"
              step={0.0625}
              min={0.0625}
              max={1}
              value={hem.gapIn}
              onChange={(e) => dispatch({ type: 'SET_HEM_GAP', hemId: hem.id, gapIn: parseFloat(e.target.value) || 0 })}
              className={INPUT_CLASS}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-afs-border rounded p-3 bg-afs-bg-raised">
      <p className="text-xs font-semibold text-afs-ink-700 uppercase mb-2">Profile</p>
      <div className="space-y-1 text-sm font-mono text-white">
        <div>Blank Width: {formatInches(profile.blankWidthIn)}</div>
        <div>Bend Count: {profile.bendCount}</div>
        <div>Hem Count: {profile.hemCount}</div>
        <div>Revision: {profile.revision}</div>
      </div>
    </div>
  );
}
