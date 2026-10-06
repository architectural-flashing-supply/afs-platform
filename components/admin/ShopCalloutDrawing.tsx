'use client';

import { useMemo } from 'react';
import {
  calloutBounds,
  resolveCalloutAnchor,
  type CalloutPoint,
} from '@/lib/shop-callouts/geometry';
import type { ShopCallout } from '@/lib/shop-callouts/types';

/**
 * THE PROFILE WITH STEVE'S ARROWS ON IT — read-only, for the shop floor.
 *
 * ============ WHY IT DRAWS THE GEOMETRY AND NOT THE STORED PNG ============
 *
 * The rest of Shop View shows `shop_profile_library.geometry_svg`, which is a
 * base64 PNG (CLAUDE.md rule #26's misnamed column). A PNG cannot carry an
 * arrow at a known position: there is no transform relating its pixels to
 * inches, so a tip anchored at "halfway along leg 2" has nowhere to land on it.
 *
 * This draws `geometry_points` — the same array FlashDraft authored against —
 * so an anchor placed in the Command Center resolves here against identical
 * numbers. It is also two orders of magnitude smaller over the wire.
 *
 * ============ IT CANNOT DISAGREE WITH THE AUTHORING VIEW ============
 *
 * The anchor is resolved by `resolveCalloutAnchor`, the same function the
 * authoring layer calls, so an orphaned callout is orphaned on both screens and
 * a re-snapped one lands in the same place. That is the same discipline
 * CLAUDE.md rule #31 requires of the 2D WebGL fallback: one geometry module, so
 * two views cannot tell the shop two different things.
 *
 * NO HEMS, NO BEND ARCS, NO DIMENSIONS. This is deliberately a plain polyline:
 * it exists to show WHERE A NOTE POINTS, beside the real drawing, and inventing
 * a second renderer for hems would be a second thing that can disagree with
 * `drawProfileScene`. The operator's drawing of record is unchanged.
 */

/**
 * CLAUDE.md rule #4's CANVAS_COLORS exception — SVG paint attributes cannot
 * consume a Tailwind class. These mirror afs-* tokens as literal hex.
 *   #C0001A  afs-crimson       6.50:1 on white, 5.17:1 on afs-bg-lane
 *   #111111  afs-ink-900      18.9:1 on afs-bg-card
 *   #8C939B  afs-line-strong   the profile line, a neutral so the red reads as the signal
 */
const DRAWING_COLORS = {
  profile: '#111111',
  arrow: '#C0001A',
  halo: '#FFFFFF',
  badgeText: '#FFFFFF',
  highlight: '#4A0072',
  plate: '#FFFFFF',
} as const;

export default function ShopCalloutDrawing({
  points,
  callouts,
  width = 420,
  height = 300,
  highlightNumber = null,
  onPick,
}: {
  points: readonly CalloutPoint[];
  callouts: readonly ShopCallout[];
  width?: number;
  height?: number;
  /** The note number an operator is pointing at in the panel, if any. */
  highlightNumber?: number | null;
  onPick?: (n: number) => void;
}) {
  const placed = useMemo(() => {
    return callouts
      .map((c) => {
        const r = resolveCalloutAnchor(
          {
            segmentIndex: c.segmentIndex,
            segmentCount: c.segmentCount,
            t: c.t,
            segA: c.segA,
            segB: c.segB,
            anchor: c.anchor,
          },
          points
        );
        if (r.status === 'orphaned' || !r.tip) return null;
        return { number: c.number, tip: r.tip, tail: { x: r.tip.x + c.tail.dx, y: r.tip.y + c.tail.dy } };
      })
      .filter((v): v is { number: number; tip: CalloutPoint; tail: CalloutPoint } => v !== null);
  }, [callouts, points]);

  // The view fits the profile AND every tail, so an arrow pointing outboard is
  // never cropped off the edge of the plate.
  const bounds = useMemo(
    () => calloutBounds(points, placed.map((p) => p.tail)),
    [points, placed]
  );

  if (points.length < 2 || !bounds) {
    return (
      <div
        className="flex items-center justify-center rounded border border-afs-border-light bg-afs-bg-light-raised"
        style={{ width, height }}
        data-testid="shop-callout-drawing-empty"
      >
        <p className="font-body text-sm text-afs-ink-700 px-3 text-center">
          No drawing is stored for this job, so the arrows cannot be shown. Read the notes below.
        </p>
      </div>
    );
  }

  // 1 unit of padding in inches, plus room for a badge, converted after scaling.
  const padIn = 0.6;
  const w = Math.max(0.001, bounds.maxX - bounds.minX) + padIn * 2;
  const h = Math.max(0.001, bounds.maxY - bounds.minY) + padIn * 2;
  const scale = Math.min(width / w, height / h);
  const offX = (width - w * scale) / 2 - (bounds.minX - padIn) * scale;
  const offY = (height - h * scale) / 2 - (bounds.minY - padIn) * scale;
  const px = (p: CalloutPoint) => ({ x: p.x * scale + offX, y: p.y * scale + offY });

  const polyline = points.map((p) => { const s = px(p); return `${s.x},${s.y}`; }).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`The profile with ${placed.length} numbered shop note${placed.length === 1 ? '' : 's'} marked on it`}
      data-testid="shop-callout-drawing"
      className="rounded border border-afs-border-light"
      style={{ background: DRAWING_COLORS.plate, maxWidth: '100%' }}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={DRAWING_COLORS.profile}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {placed.map((a) => {
        const tip = px(a.tip);
        const tail = px(a.tail);
        const dx = tip.x - tail.x;
        const dy = tip.y - tail.y;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const headPx = 12;
        const baseX = tip.x - ux * headPx;
        const baseY = tip.y - uy * headPx;
        const half = headPx * 0.42;
        const head = `${tip.x},${tip.y} ${baseX - uy * half},${baseY + ux * half} ${baseX + uy * half},${baseY - ux * half}`;
        const on = highlightNumber === a.number;
        const colour = on ? DRAWING_COLORS.highlight : DRAWING_COLORS.arrow;
        return (
          <g
            key={a.number}
            data-callout-arrow={a.number}
            data-highlighted={on ? 'true' : 'false'}
            onClick={onPick ? () => onPick(a.number) : undefined}
            style={onPick ? { cursor: 'pointer' } : undefined}
          >
            {/* The halo first: a crimson arrow laid across a dark profile line
                would otherwise lose its own outline where they cross. */}
            <line x1={tail.x} y1={tail.y} x2={baseX} y2={baseY} stroke={DRAWING_COLORS.halo} strokeWidth={6} strokeLinecap="round" />
            <line x1={tail.x} y1={tail.y} x2={baseX} y2={baseY} stroke={colour} strokeWidth={on ? 4 : 3} strokeLinecap="round" />
            <polygon points={head} fill={colour} stroke={DRAWING_COLORS.halo} strokeWidth={1} />
            <circle cx={tail.x} cy={tail.y} r={on ? 15 : 13} fill={colour} stroke={DRAWING_COLORS.halo} strokeWidth={2} />
            <text
              x={tail.x}
              y={tail.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={DRAWING_COLORS.badgeText}
              fontSize={on ? 16 : 14}
              fontWeight={700}
            >
              {a.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
