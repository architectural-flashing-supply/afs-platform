'use client';

import type { FlashDraftAction, FlashDraftState } from '@/lib/flashdraft/types';

interface FlashDraftToolbarProps {
  state: FlashDraftState;
  dispatch: React.Dispatch<FlashDraftAction>;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onEditName: () => void;
  isAuthenticated: boolean;
  currentZoom: number;
  canvasSize: { width: number; height: number };
}

// Minimal stroke-only line icons — matches the site's existing icon style
// (e.g. app/studio/draft/page.tsx's TOOLBAR_ICON_PATHS), not a licensed
// icon set, just enough to be recognizable.
const ICON_PATHS: Record<string, string> = {
  new: 'M5 3h9l5 5v13H5z M9 13h6M9 16h6',
  open: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  save: 'M4 4h13l3 3v13H4z M7 4v5h8V4 M6 14h12v6H6z',
  duplicate: 'M8 8h11v11H8z M5 16V6a1 1 0 011-1h10',
  editName: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
  print: 'M6 9V3h12v6 M4 9h16v7H4z M7 14h10v7H7z',
  fitToScreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  center: 'M12 2v4M12 18v4M2 12h4M18 12h4 M12 9a3 3 0 100 6 3 3 0 000-6z',
  zoomOut: 'M10 4a6 6 0 100 12 6 6 0 000-12z M20 20l-5.5-5.5 M7 10h6',
  zoomIn: 'M10 4a6 6 0 100 12 6 6 0 000-12z M20 20l-5.5-5.5 M10 7v6M7 10h6',
  undo: 'M8 7L3 12l5 5 M3 12h11a6 6 0 010 12h-2',
  redo: 'M16 7l5 5-5 5 M21 12H10a6 6 0 000 12h2',
  rotateLeft: 'M4 12a8 8 0 1114 5.3 M4 17v-5h5',
  rotateRight: 'M20 12a8 8 0 10-14 5.3 M20 17v-5h-5',
  delete: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function Btn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded px-2 py-1.5 hover:bg-afs-bg-surface transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <Icon name={icon} />
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-afs-border mx-1 self-center" />;
}

export default function FlashDraftToolbar({
  state,
  dispatch,
  onNew,
  onOpen,
  onSave,
  onDuplicate,
  onEditName,
  isAuthenticated,
  currentZoom,
  canvasSize,
}: FlashDraftToolbarProps) {
  const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };

  return (
    <div className="bg-afs-bg-dim px-2 py-1">
      <div className="flex flex-row items-center gap-1">
        <Btn icon="new" label="New" onClick={onNew} />
        <Btn icon="open" label="Open" onClick={onOpen} />
        <Btn icon="save" label="Save" onClick={onSave} />
        <Btn icon="duplicate" label="Duplicate" onClick={onDuplicate} />
        <Btn icon="editName" label="Edit Name" onClick={onEditName} />
        {isAuthenticated && <Btn icon="print" label="Print" onClick={() => window.print()} />}
      </div>
      <div className="flex flex-row items-center gap-1 flex-wrap">
        <Btn
          icon="fitToScreen"
          label="Fit to Screen"
          onClick={() => dispatch({ type: 'FIT_TO_SCREEN', canvasWidth: canvasSize.width, canvasHeight: canvasSize.height })}
        />
        <Btn icon="center" label="Center" onClick={() => dispatch({ type: 'SET_PAN', panOffsetX: canvasSize.width / 2, panOffsetY: canvasSize.height / 2 })} />
        <Btn icon="zoomOut" label="Zoom Out" onClick={() => dispatch({ type: 'WHEEL', pixel: center, deltaY: 100 })} />
        <Btn icon="zoomIn" label="Zoom In" onClick={() => dispatch({ type: 'WHEEL', pixel: center, deltaY: -100 })} />
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ZOOM', scale: 40, pixel: center })}
          className="font-mono text-xs text-white px-2 py-1 rounded hover:bg-afs-bg-surface transition-colors"
        >
          {currentZoom}%
        </button>
        <Divider />
        <Btn icon="undo" label="Undo" onClick={() => dispatch({ type: 'UNDO' })} disabled={state.history.length === 0} />
        <Btn icon="redo" label="Redo" onClick={() => dispatch({ type: 'REDO' })} disabled={state.future.length === 0} />
        <Divider />
        <Btn icon="rotateLeft" label="Rotate Left" onClick={() => dispatch({ type: 'ROTATE_LEFT' })} />
        <Btn icon="rotateRight" label="Rotate Right" onClick={() => dispatch({ type: 'ROTATE_RIGHT' })} />
        <Divider />
        <Btn icon="delete" label="Delete" onClick={() => dispatch({ type: 'DELETE_SELECTED' })} disabled={state.interaction.type === 'IDLE'} />
        <Btn icon="prev" label="Prev" onClick={() => dispatch({ type: 'SELECT_ADJACENT_BEND', direction: -1 })} />
        <Btn icon="next" label="Next" onClick={() => dispatch({ type: 'SELECT_ADJACENT_BEND', direction: 1 })} />
        <Divider />
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: '2d' })}
          className={`font-label text-xs px-3 py-1.5 rounded transition-colors ${state.activeView === '2d' ? 'bg-afs-crimson text-white' : 'text-white hover:bg-afs-bg-surface'}`}
        >
          2D
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: '3d' })}
          className={`font-label text-xs px-3 py-1.5 rounded transition-colors ${state.activeView === '3d' ? 'bg-afs-crimson text-white' : 'text-white hover:bg-afs-bg-surface'}`}
        >
          3D
        </button>
      </div>
      <p className="text-xs italic text-afs-ink-700 px-2 py-1">
        Click empty canvas to draw · Drag from last point to extend · Click leg or bend to select · Double-click a leg, then drag to create a hem · Drag a bend point to adjust angle
      </p>
    </div>
  );
}
