import { findMetalColorByName } from '@/lib/data/metal-colors';

interface ColorSwatchChipProps {
  color: string;
}

/**
 * Small swatch + name chip for a quote request's selected color
 * (quote_requests.color, afs-cv-002) — rendered wherever material is
 * already shown in the Command Center's quote-request list and detail
 * views. Matches Badge's chip styling (components/ui/Badge.tsx: border-
 * afs-chrome-dim, font-label, rounded, text-afs-chrome-mid) with the status
 * dot swapped for an actual color swatch. The swatch's literal hex fill
 * reuses the CANVAS_COLORS exception already documented in
 * ColorPickerModal.tsx (CLAUDE.md rule #4) — no second exception
 * introduced here.
 */
export default function ColorSwatchChip({ color }: ColorSwatchChipProps) {
  const match = findMetalColorByName(color);
  return (
    <span className="inline-flex items-center gap-2 border border-afs-chrome-dim rounded font-label whitespace-nowrap text-xs px-2 py-1 text-afs-chrome-mid">
      <span
        className="w-2.5 h-2.5 rounded-sm shrink-0 border border-afs-chrome-dim"
        style={match ? { backgroundColor: match.hex } : undefined}
        aria-hidden="true"
      />
      {color}
    </span>
  );
}
