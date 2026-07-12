export type ProfileType =
  | 'coping-cap'
  | 'base-flashing'
  | 'drip-edge'
  | 'gravel-stop'
  | 'fascia';

export interface ProfileSVGParams {
  profileType: ProfileType;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
}

interface Point {
  x: number;
  y: number;
}

type DimSide = 'top' | 'bottom' | 'left' | 'right';

interface DimensionLine {
  label: string;
  value: number;
  p1: Point;
  p2: Point;
  side: DimSide;
}

interface ProfileGeometry {
  points: Point[];
  dims: DimensionLine[];
}

const METAL_COLOR = '#B8BFD0';
const DIM_COLOR = '#C0001A';
const LABEL_FONT = 'var(--font-jetbrains), monospace';

const DEFAULTS = {
  width: 12,
  height: 4,
  legA: 2,
  legB: 2,
} as const;

const PROFILE_LABELS: Record<ProfileType, string> = {
  'coping-cap': 'Coping Cap',
  'base-flashing': 'Base Flashing',
  'drip-edge': 'Drip Edge',
  'gravel-stop': 'Gravel Stop',
  fascia: 'Fascia',
};

const KNOWN_PROFILE_TYPES: readonly ProfileType[] = [
  'coping-cap',
  'base-flashing',
  'drip-edge',
  'gravel-stop',
  'fascia',
];

/**
 * Maps a product_profiles.slug (or any free-form profile label) to a known
 * ProfileType for diagram rendering. Returns null when the profile has no
 * schematic diagram yet — callers should fall back to a text-only display.
 */
export function slugToProfileType(slug: string | null | undefined): ProfileType | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase().trim().replace(/s$/, '');
  return (KNOWN_PROFILE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as ProfileType)
    : null;
}

function resolveDim(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatInches(value: number): string {
  const whole = Math.floor(value);
  const sixteenths = Math.round((value - whole) * 16);

  if (sixteenths === 0) return `${whole}"`;
  if (sixteenths === 16) return `${whole + 1}"`;

  const divisor = gcd(sixteenths, 16);
  const num = sixteenths / divisor;
  const den = 16 / divisor;
  return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`;
}

function copingCapGeometry(w: number, h: number, legA: number, legB: number): ProfileGeometry {
  const frontHem = { x: legA, y: h };
  const frontBottom = { x: 0, y: h };
  const frontTop = { x: 0, y: 0 };
  const backTop = { x: w, y: 0 };
  const backBottom = { x: w, y: h };
  const backHem = { x: Math.max(w - legB, legA), y: h };

  return {
    points: [frontHem, frontBottom, frontTop, backTop, backBottom, backHem],
    dims: [
      { label: 'W', value: w, p1: frontTop, p2: backTop, side: 'top' },
      { label: 'H', value: h, p1: frontTop, p2: frontBottom, side: 'left' },
      { label: 'LEG A', value: legA, p1: frontBottom, p2: frontHem, side: 'bottom' },
      { label: 'LEG B', value: legB, p1: backBottom, p2: backHem, side: 'bottom' },
    ],
  };
}

function baseFlashingGeometry(h: number, legA: number, legB: number): ProfileGeometry {
  const wallTop = { x: 0, y: 0 };
  const wallBottom = { x: 0, y: h };
  const legEnd = { x: legA, y: h };
  const dripEnd = { x: legA, y: h + legB };

  return {
    points: [wallTop, wallBottom, legEnd, dripEnd],
    dims: [
      { label: 'H', value: h, p1: wallTop, p2: wallBottom, side: 'left' },
      { label: 'LEG A', value: legA, p1: wallBottom, p2: legEnd, side: 'bottom' },
      { label: 'LEG B', value: legB, p1: legEnd, p2: dripEnd, side: 'right' },
    ],
  };
}

function dripEdgeGeometry(legA: number, legB: number): ProfileGeometry {
  const legAEnd = { x: legA, y: 0 };
  const corner = { x: 0, y: 0 };
  const legBEnd = { x: 0, y: legB };

  return {
    points: [legAEnd, corner, legBEnd],
    dims: [
      { label: 'LEG A', value: legA, p1: corner, p2: legAEnd, side: 'top' },
      { label: 'LEG B', value: legB, p1: corner, p2: legBEnd, side: 'left' },
    ],
  };
}

function gravelStopGeometry(h: number, legA: number): ProfileGeometry {
  const legEnd = { x: legA, y: 0 };
  const corner = { x: 0, y: 0 };
  const faceBottom = { x: 0, y: h };

  return {
    points: [legEnd, corner, faceBottom],
    dims: [
      { label: 'LEG A', value: legA, p1: corner, p2: legEnd, side: 'top' },
      { label: 'H', value: h, p1: corner, p2: faceBottom, side: 'left' },
    ],
  };
}

function fasciaGeometry(h: number, legA: number): ProfileGeometry {
  const hemLen = clamp(h * 0.2, 0.375, 0.75);
  const legEnd = { x: legA, y: 0 };
  const corner = { x: 0, y: 0 };
  const faceBottom = { x: 0, y: h };
  const hemEnd = { x: hemLen, y: h };

  return {
    points: [legEnd, corner, faceBottom, hemEnd],
    dims: [
      { label: 'LEG A', value: legA, p1: corner, p2: legEnd, side: 'top' },
      { label: 'H', value: h, p1: corner, p2: faceBottom, side: 'left' },
    ],
  };
}

function buildGeometry(
  profileType: ProfileType,
  w: number,
  h: number,
  legA: number,
  legB: number
): ProfileGeometry {
  switch (profileType) {
    case 'coping-cap':
      return copingCapGeometry(w, h, legA, legB);
    case 'base-flashing':
      return baseFlashingGeometry(h, legA, legB);
    case 'drip-edge':
      return dripEdgeGeometry(legA, legB);
    case 'gravel-stop':
      return gravelStopGeometry(h, legA);
    case 'fascia':
      return fasciaGeometry(h, legA);
  }
}

function renderDimension(
  dim: DimensionLine,
  toX: (n: number) => number,
  toY: (n: number) => number,
  index: number
): string {
  const offsetPx = 34 + index * 24;
  const text = `${dim.label} ${formatInches(dim.value)}`;

  if (dim.side === 'top' || dim.side === 'bottom') {
    const x1 = toX(dim.p1.x);
    const x2 = toX(dim.p2.x);
    const y = toY(dim.p1.y);
    const dimY = dim.side === 'top' ? y - offsetPx : y + offsetPx;
    const xa = Math.min(x1, x2);
    const xb = Math.max(x1, x2);
    const midX = (xa + xb) / 2;
    const textY = dim.side === 'top' ? dimY - 8 : dimY + 18;

    return `
      <line x1="${xa.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xa.toFixed(1)}" y2="${dimY.toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1" opacity="0.45" />
      <line x1="${xb.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${dimY.toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1" opacity="0.45" />
      <line x1="${xa.toFixed(1)}" y1="${dimY.toFixed(1)}" x2="${xb.toFixed(1)}" y2="${dimY.toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#afsDimArrow)" marker-end="url(#afsDimArrow)" />
      <text x="${midX.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="middle" font-family="${LABEL_FONT}" font-size="12" fill="${DIM_COLOR}">${text}</text>
    `;
  }

  const y1 = toY(dim.p1.y);
  const y2 = toY(dim.p2.y);
  const x = toX(dim.p1.x);
  const dimX = dim.side === 'left' ? x - offsetPx : x + offsetPx;
  const ya = Math.min(y1, y2);
  const yb = Math.max(y1, y2);
  const midY = (ya + yb) / 2;
  const textX = dim.side === 'left' ? dimX - 8 : dimX + 8;

  return `
    <line x1="${x.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${dimX.toFixed(1)}" y2="${ya.toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1" opacity="0.45" />
    <line x1="${x.toFixed(1)}" y1="${yb.toFixed(1)}" x2="${dimX.toFixed(1)}" y2="${yb.toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1" opacity="0.45" />
    <line x1="${dimX.toFixed(1)}" y1="${ya.toFixed(1)}" x2="${dimX.toFixed(1)}" y2="${yb.toFixed(1)}" stroke="${DIM_COLOR}" stroke-width="1" marker-start="url(#afsDimArrow)" marker-end="url(#afsDimArrow)" />
    <text x="${textX.toFixed(1)}" y="${(midY + 4).toFixed(1)}" text-anchor="${dim.side === 'left' ? 'end' : 'start'}" font-family="${LABEL_FONT}" font-size="12" fill="${DIM_COLOR}">${text}</text>
  `;
}

/**
 * Generates a schematic SVG cross-section for a flashing profile.
 * For reference only — not a fabrication drawing.
 */
export function generateProfileSVG(params: ProfileSVGParams): string {
  const w = resolveDim(params.width, DEFAULTS.width);
  const h = resolveDim(params.height, DEFAULTS.height);
  const legA = resolveDim(params.legA, DEFAULTS.legA);
  const legB = resolveDim(params.legB, DEFAULTS.legB);

  const geometry = buildGeometry(params.profileType, w, h, legA, legB);
  const { points, dims } = geometry;

  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  const bboxW = Math.max(maxX - minX, 0.5);
  const bboxH = Math.max(maxY - minY, 0.5);

  const CANVAS = 440;
  const PAD = 96;
  const drawW = CANVAS - PAD * 2;
  const drawH = CANVAS - PAD * 2;
  const scale = clamp(Math.min(drawW / bboxW, drawH / bboxH), 6, 30);

  const toX = (x: number) => PAD + (x - minX) * scale;
  const toY = (y: number) => PAD + (y - minY) * scale;

  const outline = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.x).toFixed(1)} ${toY(p.y).toFixed(1)}`)
    .join(' ');

  const sideCounts: Partial<Record<DimSide, number>> = {};
  const dimSVGs = dims
    .map(d => {
      const idx = sideCounts[d.side] ?? 0;
      sideCounts[d.side] = idx + 1;
      return renderDimension(d, toX, toY, idx);
    })
    .join('');

  const caption = PROFILE_LABELS[params.profileType].toUpperCase();

  return `<svg viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" role="img" aria-label="${PROFILE_LABELS[params.profileType]} profile diagram">
    <defs>
      <marker id="afsDimArrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L8 4 L0 8 Z" fill="${DIM_COLOR}" />
      </marker>
    </defs>
    <path d="${outline}" fill="none" stroke="${METAL_COLOR}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />
    ${dimSVGs}
    <text x="${CANVAS / 2}" y="${CANVAS - 20}" text-anchor="middle" font-family="${LABEL_FONT}" font-size="11" letter-spacing="2" fill="#7A8299">${caption}</text>
  </svg>`;
}
