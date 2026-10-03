import { calculateWasteAdjustedQuantity } from '@/lib/material-calculator';

interface WasteFactorDisplayProps {
  lengthFt: number;
  quantity: number;
}

function formatLf(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function WasteFactorDisplay({ lengthFt, quantity }: WasteFactorDisplayProps) {
  if (!(lengthFt > 0) || !(quantity > 0)) return null;

  const { rawQtyLf, wasteFactorPct, wasteQtyLf, adjustedQtyLf } = calculateWasteAdjustedQuantity(
    lengthFt,
    quantity
  );

  return (
    <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mt-3">
      <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-3">
        Auto Material Calculator
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-body text-sm text-afs-chrome-mid">Your quantity</span>
          <span className="font-data text-sm text-afs-chrome-high">{formatLf(rawQtyLf)} LF</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-body text-sm text-afs-chrome-mid">
            + Waste factor ({wasteFactorPct}%, estimated)
          </span>
          <span className="font-data text-sm text-afs-chrome-high">+{formatLf(wasteQtyLf)} LF</span>
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-afs-chrome-dim">
          <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-high">
            Total billed quantity
          </span>
          <span className="font-data text-sm font-semibold text-afs-crimson">
            {formatLf(adjustedQtyLf)} LF
          </span>
        </div>
      </div>
    </div>
  );
}
