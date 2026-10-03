'use client';

import { useState } from 'react';
import { optimizeTrimLength } from '@/lib/utils/trim-optimizer';

/**
 * Where the stock-length catalog read has got to. The three cases say three
 * different things and must not be collapsed into "no stock length":
 *
 *   loading — we do not know yet. Saying nothing at all makes the section
 *             appear a moment after the customer types, with no explanation.
 *   error   — the read failed, so we do not know whether this profile has a
 *             stock length. That is not the same as knowing it has none.
 *   ready   — we know. No stock length then means exactly what SPEC §3 says it
 *             means: this profile has none, and the section does not render.
 */
export type StockLengthStatus = 'loading' | 'error' | 'ready';

interface TrimLengthOptimizerSectionProps {
  lengthFt: number;
  quantity: number;
  stockLengthFt: number | null;
  status: StockLengthStatus;
}

function formatLf(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

const shellClass = 'bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mt-3';

export default function TrimLengthOptimizerSection({
  lengthFt,
  quantity,
  stockLengthFt,
  status,
}: TrimLengthOptimizerSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Nothing has been asked for yet. No status message belongs here either — a
  // customer who has not typed a length is not waiting for anything.
  if (!(lengthFt > 0) || !(quantity > 0)) return null;

  if (status === 'loading') {
    return (
      <div className={shellClass} aria-busy="true" aria-live="polite">
        <p className="font-body text-sm text-afs-chrome-mid">Checking stock lengths…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={shellClass} role="status">
        <p className="font-body text-sm text-afs-chrome-mid">
          We could not look up stock lengths just now, so there is no cut list to show. Your quote
          request is unaffected — nothing you have entered has been lost, and AFS will confirm the
          lengths on your quote.
        </p>
      </div>
    );
  }

  // Only shown when the profile has a standard stock length defined — SPEC §3.
  if (stockLengthFt === null || !(stockLengthFt > 0)) return null;

  const neededLf = lengthFt * quantity;
  const result = optimizeTrimLength(neededLf, stockLengthFt);

  return (
    <div className={shellClass}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">
          Trim Length Optimizer
        </span>
        <span
          className={`shrink-0 text-afs-crimson transition-transform ${isOpen ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>

      <p className="font-body text-sm text-afs-chrome-mid mt-2">
        You need {formatLf(neededLf)} LF. We stock this profile in {formatLf(stockLengthFt)} ft lengths.
      </p>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-afs-chrome-dim space-y-3">
          <div className="space-y-1.5">
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-high block">
              Optimized Cut List
            </span>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-afs-chrome-mid">
                {result.piecesOrdered} {result.piecesOrdered === 1 ? 'piece' : 'pieces'} ×{' '}
                {formatLf(result.stockLengthFt)} ft
              </span>
              <span className="font-data text-sm text-afs-chrome-high">
                {formatLf(result.totalStockFt)} ft ordered
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-sm text-afs-chrome-mid">Waste</span>
              <span className="font-data text-sm text-afs-crimson">
                {formatLf(result.wasteLinearFt)} LF ({Math.round(result.wastePercent)}%)
              </span>
            </div>
          </div>

          <ul className="space-y-1">
            {result.cutList.map((piece) => (
              <li
                key={piece.pieceNumber}
                className="flex items-center justify-between font-body text-sm text-afs-chrome-mid"
              >
                <span>Piece {piece.pieceNumber}</span>
                <span className="font-data text-afs-chrome-high">
                  {formatLf(piece.lengthFt)} ft
                  {piece.remainderFt > 0.5 ? ` (${formatLf(piece.remainderFt)} ft off-cut)` : ' (full length)'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
