/**
 * THE 2D VIEW THE 3D VIEWER FALLS BACK TO WHEN WebGL IS UNAVAILABLE (F-06).
 *
 * `ProfileViewer3D` needs a WebGL context, and there is no guarantee of one:
 * a shop tablet with a blacklisted GPU driver, a locked-down browser, a
 * remote-desktop session, or simply too many live contexts on one page all
 * produce the same outcome — `new THREE.WebGLRenderer()` throws. Before this
 * component existed, that left an empty grey box with a "Rotate • Zoom • Pan"
 * hint over it. The operator's actual question ("is this the right shape?")
 * does not need three dimensions to answer, so the viewer answers it flat.
 *
 * GEOMETRY COMES FROM THE SAME PLACE THE 3D DOES. `buildCrossSectionPoints`,
 * `formatBendAngleLabel` and `formatInches` are the exact three functions
 * ProfileViewer3D itself calls (CLAUDE.md rule #12: geometry.ts is the only
 * place that decides what a bend angle means). So the fallback cannot disagree
 * with the 3D view about the shape, about a bend's sign, or about how a length
 * is written — it is the same numbers, drawn with an SVG polyline instead of an
 * extruded mesh.
 *
 * WHY NOT REUSE `BendSequenceDiagram`. It is the nearest existing 2D drawing and
 * it does share `computeProfilePoints`, but it hardcodes `SCALE_PX_PER_MM`,
 * prints no leg lengths, and is painted for a gunmetal card only. The fallback
 * has to carry the leg dimensions (that is most of what the 3D labels are for),
 * fit whatever size box the viewer occupied, and render on both palettes.
 * Reshaping BendSequenceDiagram to cover all of that would have changed what the
 * Command Center job card already renders, for no gain.
 *
 * UNITS: ProfileViewer3D's `bends` and `blankWidth` are MILLIMETRES — the
 * placeholder profile in app/studio/draft/page.tsx is `leftLeg: 76.2` for a 3"
 * leg, and the 3D viewer's own labels read `formatInches(mmToIn(legLenMm))`.
 * This component takes the same props in the same unit and converts at the same
 * point, so a label here and a label there are the same string.
 *
 * Y IS FLIPPED on the way in, for the reason geometry.ts's own header records:
 * `computeProfilePoints` walks in FlashDraft's y-DOWN canvas frame and every
 * consumer renders in a y-UP frame. SVG's y axis points down, so negating y here
 * puts the shape the same way up as the 3D viewer and the 2D canvas.
 */

import { buildCrossSectionPoints, formatBendAngleLabel } from '@/lib/flashdraft/geometry';
import { formatInches } from '@/lib/utils/format-inches';
import type { ProfileBend } from '@/components/studio/ProfileViewer3D';

const VIEW = 1000;
const PADDING = 90;
const MM_PER_INCH = 25.4;

/** Same conversion ProfileViewer3D applies before every dimension label. */
function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

/**
 * The real length of screen segment `i`, in millimetres.
 *
 * `buildCrossSectionPoints` walks one point per bend using that bend's
 * `leftLeg`, then one final point using the LAST bend's `rightLeg`. So segment i
 * is bend i's left leg for every bend, and the one segment past the end is the
 * last bend's trailing leg. Every other `rightLeg` is redundant with the next
 * bend's `leftLeg` — the same convention
 * lib/integrations/pathfinder-edge.ts's buildFeatures documents.
 */
function segmentLengthMm(bends: ProfileBend[], i: number): number | null {
  if (bends.length === 0) return null;
  if (i < bends.length) return bends[i]?.leftLeg ?? null;
  return bends[bends.length - 1]?.rightLeg ?? null;
}

/**
 * Both palettes, measured (WCAG 2.1 1.4.3 for the text, 1.4.11 for the line):
 *   light: ink-900 on bg-card 18.9:1 · ink-700 on bg-card 10.3:1 · crimson line 6.0:1
 *   dark:  chrome-high on bg-dim 16.9:1 · chrome-mid on bg-dim 9.0:1 · crimson-hover line 4.5:1
 * The dark tone strokes in crimson-HOVER (#E8001F) because plain crimson on
 * #1C1F26 measures 2.4:1 and would miss the 3:1 UI-component rule.
 *
 * These are SVG `fill`/`stroke` attributes, which cannot consume a Tailwind
 * class — the same constraint CLAUDE.md rule #4's CANVAS_COLORS exception
 * describes, and handled the same documented way: one constant mirroring the
 * afs-* token values as literal hex.
 */
const TONES = {
  light: { surface: 'bg-afs-bg-card', stroke: '#C0001A', label: '#111111', sub: '#374151' },
  dark: { surface: 'bg-afs-bg-dim', stroke: '#E8001F', label: '#FFFFFF', sub: '#B8BFD0' },
} as const;

export interface ProfileCrossSection2DProps {
  bends: ProfileBend[];
  /** Millimetres, same as ProfileViewer3D's prop of the same name. */
  blankWidth: number;
  material: string;
  gauge: string;
  profileName?: string;
  tone?: 'light' | 'dark';
  /** Why the 3D view is not being shown. Rendered verbatim, so keep it plain English. */
  reason?: string;
  className?: string;
}

export default function ProfileCrossSection2D({
  bends,
  blankWidth,
  material,
  gauge,
  profileName,
  tone = 'dark',
  reason,
  className,
}: ProfileCrossSection2DProps) {
  const t = TONES[tone];
  const points = buildCrossSectionPoints(bends).map((p) => ({ x: p.x, y: -p.y }));
  const finite = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  // A profile with no usable geometry still has to say something true rather
  // than render an empty box — which is the whole reason this component exists.
  const hasShape = finite.length >= 2;

  let d = '';
  let screen: { x: number; y: number }[] = [];
  if (hasShape) {
    const xs = finite.map((p) => p.x);
    const ys = finite.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX || 1;
    const spanY = Math.max(...ys) - minY || 1;
    const scale = Math.min((VIEW - PADDING * 2) / spanX, (VIEW - PADDING * 2) / spanY);
    const drawW = spanX * scale;
    const drawH = spanY * scale;
    screen = finite.map((p) => ({
      // Rounded here, once, for the hydration reason BendSequenceDiagram
      // documents: an un-rounded float can stringify one ULP apart between the
      // Node SSR pass and the browser's V8, which React flags as a mismatch.
      x: Math.round(((p.x - minX) * scale + (VIEW - drawW) / 2) * 100) / 100,
      y: Math.round(((p.y - minY) * scale + (VIEW - drawH) / 2) * 100) / 100,
    }));
    d = screen.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  return (
    <div
      data-testid="profile-2d-fallback"
      className={`relative ${t.surface} ${className ?? ''}`}
      style={{ minHeight: 500 }}
    >
      {hasShape ? (
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Flat cross-section of ${profileName ?? 'this profile'}`}
        >
          <path d={d} fill="none" stroke={t.stroke} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          {screen.map((p, i) => (
            <circle key={`v${i}`} cx={p.x} cy={p.y} r={9} fill={t.stroke} />
          ))}
          {/* Leg lengths at each segment midpoint — the same formatInches the 3D labels use. */}
          {screen.slice(0, -1).map((p, i) => {
            const q = screen[i + 1];
            const lengthMm = segmentLengthMm(bends, i);
            if (lengthMm === null || !Number.isFinite(lengthMm)) return null;
            return (
              <text
                key={`l${i}`}
                x={(p.x + q.x) / 2}
                y={(p.y + q.y) / 2 - 14}
                fontSize={26}
                fill={t.label}
                textAnchor="middle"
              >
                {formatInches(mmToIn(lengthMm))}
              </text>
            );
          })}
          {/* Bend angles at each interior vertex — signed, via geometry.ts. */}
          {bends.map((bend, i) => {
            const p = screen[i + 1];
            if (!p) return null;
            return (
              <text key={`a${i}`} x={p.x + 16} y={p.y + 30} fontSize={26} fill={t.sub}>
                {formatBendAngleLabel(bend.angle)}
              </text>
            );
          })}
        </svg>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <p className="font-body text-sm text-center" style={{ color: t.sub }}>
            This profile has no bend geometry on record, so there is nothing to draw.
          </p>
        </div>
      )}

      <div className="absolute top-3 left-3 max-w-sm">
        <p data-testid="profile-2d-fallback-reason" className="font-label text-xs" style={{ color: t.sub }}>
          {reason ?? 'Showing the flat 2D view.'}
        </p>
      </div>

      <div className="absolute bottom-3 left-3">
        {profileName ? (
          <p className="font-heading text-sm" style={{ color: t.label }}>
            {profileName}
          </p>
        ) : null}
        <p className="font-data text-xs" style={{ color: t.sub }}>
          {material} · {gauge}
          {Number.isFinite(blankWidth) && blankWidth > 0 ? ` · blank ${formatInches(mmToIn(blankWidth))}` : ''}
        </p>
      </div>
    </div>
  );
}
