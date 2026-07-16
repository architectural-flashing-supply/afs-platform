'use client';

import type { FlashDraftAction, Hem, HemPopupState, HemType } from '@/lib/flashdraft/types';

interface HemPopupProps {
  hemPopup: HemPopupState;
  dispatch: React.Dispatch<FlashDraftAction>;
  currentHem: Hem | null;
}

// Fixed top-right of the canvas container (must never overlap the drawing) —
// the container this mounts inside (FlashDraftCanvas's wrapper in page.tsx)
// is position: relative, so this absolute positioning is scoped to it.
export default function HemPopup({ hemPopup, dispatch, currentHem }: HemPopupProps) {
  if (!hemPopup.visible || !currentHem) return null;

  return (
    <div className="absolute top-4 right-4 z-50 bg-afs-bg-raised border border-afs-border rounded-lg shadow-xl p-4 w-56">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-white uppercase tracking-wide">Hem Type</span>
        <button type="button" onClick={() => dispatch({ type: 'CLOSE_HEM_POPUP' })} className="text-afs-ink-700 hover:text-white">
          ×
        </button>
      </div>
      <div className="flex gap-2 mb-3">
        {(['open', 'smashed', 'teardrop'] as HemType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => dispatch({ type: 'SELECT_HEM_TYPE_FROM_POPUP', hemId: currentHem.id, hemType: t })}
            className={`flex-1 py-2 rounded text-xs font-semibold capitalize transition-colors ${
              currentHem.type === t ? 'bg-afs-crimson text-white' : 'bg-afs-bg-surface text-white hover:bg-afs-bg-overlay'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {currentHem.type === 'open' && (
        <div>
          <label className="text-xs text-afs-ink-700 mb-1 block">Gap (inches)</label>
          <input
            type="number"
            step={0.0625}
            min={0.0625}
            max={1}
            value={currentHem.gapIn}
            onChange={(e) => dispatch({ type: 'SET_HEM_GAP', hemId: currentHem.id, gapIn: parseFloat(e.target.value) || 0 })}
            className="w-full border border-afs-accent-green rounded px-2 py-1 font-mono text-sm bg-white text-afs-ink-900"
          />
        </div>
      )}
    </div>
  );
}
