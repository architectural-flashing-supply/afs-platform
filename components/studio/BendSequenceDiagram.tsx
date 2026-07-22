import { computeProfilePoints } from '@/lib/flashdraft/geometry';

interface Bend {
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

interface Point {
  x: number;
  y: number;
}

const SCALE_PX_PER_MM = 0.6;
const PADDING = 24;

// Same "turtle graphics" reconstruction FlashDraft's Load from Library uses
// (now centralized in lib/flashdraft/geometry.ts's computeProfilePoints —
// see GEOMETRY_AUDIT.md): draw the left leg, turn by the supplementary bend
// angle, repeat, then draw the final right leg. An approximation of the
// true folded shape, not an exact CAD trace — there's no explicit
// connectivity/direction metadata in the source bend records to
// reconstruct it precisely. mm values are passed straight through
// unconverted (the shared function is unit-agnostic), so output is
// unchanged bit-for-bit from the prior inline implementation.
function reconstructPoints(bends: Bend[]): Point[] {
  return computeProfilePoints(
    bends.map((b) => ({
      legIn: b.leftLegMm,
      nextLegIn: b.rightLegMm,
      bendAngleDegrees: b.bendAngleDegrees,
    }))
  ).points;
}

export default function BendSequenceDiagram({ bends, className }: { bends: Bend[]; className?: string }) {
  if (!bends || bends.length === 0) {
    return <p className="font-body text-xs text-afs-chrome-dim">No bend sequence on file.</p>;
  }

  const points = reconstructPoints(bends);
  const xs = points.map((p) => p.x * SCALE_PX_PER_MM);
  const ys = points.map((p) => p.y * SCALE_PX_PER_MM);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX + PADDING * 2;
  const height = Math.max(...ys) - minY + PADDING * 2;
  const offsetX = PADDING - minX;
  const offsetY = PADDING - minY;

  // Rounded to a fixed precision immediately — an un-rounded float (e.g.
  // 119.27593808696412) can render one ULP differently between the Node.js
  // SSR pass and the browser's V8, which React then flags as a hydration
  // mismatch on the exact digit string. Every SVG coordinate below derives
  // from these already-rounded numbers, not the raw computed floats.
  const screenPoints = points.map((p) => ({
    x: Math.round((p.x * SCALE_PX_PER_MM + offsetX) * 100) / 100,
    y: Math.round((p.y * SCALE_PX_PER_MM + offsetY) * 100) / 100,
  }));
  const pathD = screenPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const viewBoxWidth = Math.round(Math.max(width, 40) * 100) / 100;
  const viewBoxHeight = Math.round(Math.max(height, 40) * 100) / 100;

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className={className ?? 'w-full h-32 bg-afs-bg-dim rounded'}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={pathD} fill="none" stroke="#C0001A" strokeWidth={2} strokeLinejoin="round" />
      {screenPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#C0001A" />
      ))}
      {bends.map((bend, i) => {
        const p = screenPoints[i + 1];
        if (!p) return null;
        return (
          <text key={i} x={p.x + 6} y={p.y - 6} fontSize="8" fill="#D8E0EC">
            {(bend.bendAngleDegrees ?? 0).toFixed(0)}°
          </text>
        );
      })}
    </svg>
  );
}
