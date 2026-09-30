interface Point {
  x: number;
  y: number;
}

const PADDING = 12;

// Canonical profiles store their final, exact polyline — no bend-angle
// turtle-graphics reconstruction needed (contrast BendSequenceDiagram, which
// reconstructs an approximate shape from a bend list at render time). This
// component only ever connects the dots.
export default function CanonicalProfileDiagram({
  points,
  width = 240,
  height = 180,
}: {
  points: Point[];
  width?: number;
  height?: number;
}) {
  if (!points || points.length === 0) {
    return <p className="font-body text-xs text-afs-chrome-dim">No geometry on file.</p>;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;

  const drawableWidth = Math.max(width - PADDING * 2, 1);
  const drawableHeight = Math.max(height - PADDING * 2, 1);
  const scale = spanX === 0 && spanY === 0 ? 1 : Math.min(drawableWidth / (spanX || 1), drawableHeight / (spanY || 1));

  // Center the scaled shape within the padded viewBox.
  const scaledWidth = spanX * scale;
  const scaledHeight = spanY * scale;
  const offsetX = PADDING + (drawableWidth - scaledWidth) / 2 - minX * scale;
  const offsetY = PADDING + (drawableHeight - scaledHeight) / 2 - minY * scale;

  const screenPoints = points.map((p) => ({
    x: Math.round((p.x * scale + offsetX) * 100) / 100,
    y: Math.round((p.y * scale + offsetY) * 100) / 100,
  }));

  const pointsAttr = screenPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <polyline points={pointsAttr} fill="none" className="stroke-afs-crimson" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
