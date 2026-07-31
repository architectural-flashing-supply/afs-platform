'use client';

import { useState } from 'react';
import { optimizeTrimLength } from '@/lib/utils/trim-optimizer';

interface TrimLengthOptimizerSectionProps {
  lengthFt: number;
  quantity: number;
  stockLengthFt: number | null;
}

function formatLf(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function TrimLengthOptimizerSection({
  lengthFt,
  quantity,
  stockLengthFt,
}: TrimLengthOptimizerSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only shown when the profile has a standard stock length defined — SPEC §3.
  if (!(lengthFt > 0) || !(quantity > 0) || stockLengthFt === null || !(stockLengthFt > 0)) return null;

  const neededLf = lengthFt * quantity;
  const result = optimizeTrimLength(neededLf, stockLengthFt);

  return (
    <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mt-3">
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
