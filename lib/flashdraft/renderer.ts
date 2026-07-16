import { formatInches, geoToCanvas, pointAlongLeg } from './geometry';
import type { BendPoint, CanvasPoint, CanvasTransform, FlashDraftState, GeoPoint, Hem, Leg } from './types';

// Canvas 2D fillStyle/strokeStyle can't consume Tailwind classes or CSS
// custom properties — documented exception, see DESIGN_TOKENS.md §10 and
// the identical pattern in app/studio/draft/page.tsx's CANVAS_COLORS.
export const CANVAS_COLORS = {
  background: '#F4F4F6',
  grid: '#DCDDE0',
  gridMajor: '#C8C9CC',
  leg: '#C0001A',
  legSelected: '#0055CC',
  legHover: '#E83030',
  bendArc: '#C0001A',
  bendLabel: '#111111',
  bendHandleFill: '#FFFFFF',
  bendHandleStroke: '#C0001A',
  bendHandleSelectedFill: '#C0001A',
  hemLine: '#C0001A',
  hemLabel: '#C0001A',
  dimensionLabel: '#111111',
  dimensionLabelBg: '#FFFFFF',
  previewLine: '#C0001A',
  selectionRing: '#0055CC',
};

const FONT_LABEL = '11px "JetBrains Mono", monospace';
const FONT_LABEL_BOLD = 'bold 11px "JetBrains Mono", monospace';
const FONT_ANGLE_BOLD = 'bold 12px "JetBrains Mono", monospace';

export interface HoverTarget {
  type: 'leg' | 'bend';
  id: string;
}

function drawLabelWithBackground(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.font = FONT_LABEL_BOLD;
  const metrics = ctx.measureText(text);
  const paddingX = 5;
  const paddingY = 3;
  const w = metrics.width + paddingX * 2;
  const h = 14 + paddingY;
  ctx.fillStyle = CANVAS_COLORS.dimensionLabelBg;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x - paddingX, y - h / 2, w, h, 3);
    ctx.fill();
  } else {
    ctx.fillRect(x - paddingX, y - h / 2, w, h);
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

export function renderGrid(ctx: CanvasRenderingContext2D, transform: CanvasTransform, width: number, height: number): void {
  ctx.fillStyle = CANVAS_COLORS.background;
  ctx.fillRect(0, 0, width, height);

  const drawLines = (stepPx: number, color: string, lineWidth: number, alpha: number) => {
    if (stepPx < 3) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = alpha;
    const offsetX = ((transform.panOffsetX % stepPx) + stepPx) % stepPx;
    const offsetY = ((transform.panOffsetY % stepPx) + stepPx) % stepPx;
    ctx.beginPath();
    for (let x = offsetX; x < width; x += stepPx) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += stepPx) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  drawLines((1 / 8) * transform.scale, CANVAS_COLORS.grid, 0.5, 0.4);
  drawLines(1 * transform.scale, CANVAS_COLORS.gridMajor, 1, 0.6);

  ctx.strokeStyle = CANVAS_COLORS.gridMajor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(0, transform.panOffsetY);
  ctx.lineTo(width, transform.panOffsetY);
  ctx.moveTo(transform.panOffsetX, 0);
  ctx.lineTo(transform.panOffsetX, height);
  ctx.stroke();
}

export function renderLeg(
  ctx: CanvasRenderingContext2D,
  leg: Leg,
  transform: CanvasTransform,
  isSelected: boolean,
  isHovered: boolean
): void {
  const a = geoToCanvas(leg.startGeo, transform);
  const b = geoToCanvas(leg.endGeo, transform);

  ctx.strokeStyle = isSelected ? CANVAS_COLORS.legSelected : isHovered ? CANVAS_COLORS.legHover : CANVAS_COLORS.leg;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const perp = { x: -dy / len, y: dx / len };
  const labelX = midX + perp.x * 16;
  const labelY = midY + perp.y * 16;
  drawLabelWithBackground(ctx, formatInches(leg.lengthIn), labelX, labelY, CANVAS_COLORS.dimensionLabel);
}

export function renderBendPoint(
  ctx: CanvasRenderingContext2D,
  bend: BendPoint,
  incomingLeg: Leg | undefined,
  outgoingLeg: Leg | undefined,
  transform: CanvasTransform,
  isSelected: boolean,
  isHovered: boolean
): void {
  const center = geoToCanvas(bend.geo, transform);
  const radius = isSelected || isHovered ? 11 : 7;

  if (incomingLeg && outgoingLeg) {
    const incomingDir = incomingLeg.angleRad + Math.PI;
    const outgoingDir = outgoingLeg.angleRad;
    const arcRadius = 28;
    let sweep = outgoingDir - incomingDir;
    while (sweep <= -Math.PI) sweep += Math.PI * 2;
    while (sweep > Math.PI) sweep -= Math.PI * 2;

    ctx.strokeStyle = CANVAS_COLORS.bendArc;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, arcRadius, incomingDir, outgoingDir, sweep < 0);
    ctx.stroke();

    // Arrowhead at the outgoing end of the arc, tangent to the sweep direction.
    const tip = { x: center.x + Math.cos(outgoingDir) * arcRadius, y: center.y + Math.sin(outgoingDir) * arcRadius };
    const tangent = outgoingDir + (sweep < 0 ? -Math.PI / 2 : Math.PI / 2);
    const back1 = tangent + (2.6);
    const back2 = tangent - (2.6);
    const headLen = 5;
    ctx.fillStyle = CANVAS_COLORS.bendArc;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - Math.cos(back1) * headLen, tip.y - Math.sin(back1) * headLen);
    ctx.lineTo(tip.x - Math.cos(back2) * headLen, tip.y - Math.sin(back2) * headLen);
    ctx.closePath();
    ctx.fill();

    const midAngle = incomingDir + sweep / 2;
    const labelPos = {
      x: center.x + Math.cos(midAngle) * (arcRadius + 14),
      y: center.y + Math.sin(midAngle) * (arcRadius + 14),
    };
    const text = `${bend.angleDegrees.toFixed(0)}°`;
    ctx.font = FONT_ANGLE_BOLD;
    const metrics = ctx.measureText(text);
    const w = metrics.width + 8;
    const h = 16;
    ctx.fillStyle = CANVAS_COLORS.dimensionLabelBg;
    ctx.fillRect(labelPos.x - w / 2, labelPos.y - h / 2, w, h);
    ctx.fillStyle = CANVAS_COLORS.bendLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, labelPos.x, labelPos.y + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? CANVAS_COLORS.bendHandleSelectedFill : CANVAS_COLORS.bendHandleFill;
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#FFFFFF' : CANVAS_COLORS.bendHandleStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function hemGeometry(hem: Hem, leg: Leg): { startGeo: GeoPoint; foldDirRad: number } | null {
  if (leg.lengthIn === 0) return null;
  const startGeo = pointAlongLeg(leg, hem.distanceFromStartIn / leg.lengthIn);
  const foldDirRad = leg.angleRad + Math.PI;
  return { startGeo, foldDirRad };
}

export function renderHem(ctx: CanvasRenderingContext2D, hem: Hem, leg: Leg, transform: CanvasTransform, isSelected: boolean): void {
  const geo = hemGeometry(hem, leg);
  if (!geo) return;
  const { startGeo, foldDirRad } = geo;
  const hemStartPixel = geoToCanvas(startGeo, transform);
  const hemLengthPx = hem.lengthIn * transform.scale;
  const dirVec = { x: Math.cos(foldDirRad), y: Math.sin(foldDirRad) };

  ctx.strokeStyle = CANVAS_COLORS.hemLine;
  ctx.fillStyle = CANVAS_COLORS.hemLine;

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = CANVAS_COLORS.selectionRing;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hemStartPixel.x, hemStartPixel.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (hem.type === 'open') {
    const foldEnd = { x: hemStartPixel.x + dirVec.x * hemLengthPx, y: hemStartPixel.y + dirVec.y * hemLengthPx };
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(hemStartPixel.x, hemStartPixel.y);
    ctx.lineTo(foldEnd.x, foldEnd.y);
    ctx.stroke();

    const gapPx = hem.gapIn * transform.scale;
    const perp = { x: dirVec.y, y: -dirVec.x };
    const gapStart = { x: hemStartPixel.x + perp.x * gapPx, y: hemStartPixel.y + perp.y * gapPx };
    const gapEnd = { x: foldEnd.x + perp.x * gapPx, y: foldEnd.y + perp.y * gapPx };
    ctx.beginPath();
    ctx.moveTo(gapStart.x, gapStart.y);
    ctx.lineTo(gapEnd.x, gapEnd.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(foldEnd.x, foldEnd.y);
    ctx.lineTo(gapEnd.x, gapEnd.y);
    ctx.stroke();

    const midX = (hemStartPixel.x + foldEnd.x) / 2;
    const midY = (hemStartPixel.y + foldEnd.y) / 2;
    drawLabelWithBackground(ctx, formatInches(hem.lengthIn), midX + perp.x * 10, midY + perp.y * 10, CANVAS_COLORS.hemLabel);
  } else if (hem.type === 'smashed') {
    ctx.lineWidth = 2.5;
    const perp = { x: dirVec.y, y: -dirVec.x };
    for (const side of [-1.5, 1.5]) {
      const start = { x: hemStartPixel.x + perp.x * side, y: hemStartPixel.y + perp.y * side };
      const end = {
        x: hemStartPixel.x + dirVec.x * hemLengthPx + perp.x * side,
        y: hemStartPixel.y + dirVec.y * hemLengthPx + perp.y * side,
      };
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    const foldEnd = { x: hemStartPixel.x + dirVec.x * hemLengthPx, y: hemStartPixel.y + dirVec.y * hemLengthPx };
    ctx.font = FONT_LABEL;
    ctx.fillText('SMASHED', foldEnd.x + 6, foldEnd.y - 6);
  } else {
    const tearRadiusPx = Math.max(10, hem.gapIn * transform.scale);
    const straightLenPx = Math.max(0, hemLengthPx - tearRadiusPx);
    const foldEnd = { x: hemStartPixel.x + dirVec.x * straightLenPx, y: hemStartPixel.y + dirVec.y * straightLenPx };
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(hemStartPixel.x, hemStartPixel.y);
    ctx.lineTo(foldEnd.x, foldEnd.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(foldEnd.x, foldEnd.y, tearRadiusPx, foldDirRad - Math.PI / 2, foldDirRad + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = CANVAS_COLORS.hemLine;
    ctx.fill();

    ctx.font = FONT_LABEL;
    ctx.fillStyle = CANVAS_COLORS.hemLabel;
    ctx.fillText('TEARDROP', foldEnd.x + tearRadiusPx + 6, foldEnd.y - 6);
  }
}

export function renderDragPreview(
  ctx: CanvasRenderingContext2D,
  fromGeo: GeoPoint,
  toGeo: GeoPoint,
  transform: CanvasTransform,
  lengthIn: number,
  angleRad: number,
  snapping: boolean
): void {
  const a = geoToCanvas(fromGeo, transform);
  const b = geoToCanvas(toGeo, transform);
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = CANVAS_COLORS.previewLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = CANVAS_COLORS.leg;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
  ctx.fill();

  const angleDeg = (angleRad * 180) / Math.PI;
  const label = `${formatInches(lengthIn)}${snapping ? ` · ${angleDeg.toFixed(0)}°` : ''}`;
  drawLabelWithBackground(ctx, label, b.x + 14, b.y - 14, CANVAS_COLORS.dimensionLabel);
}

export function renderHemPreview(
  ctx: CanvasRenderingContext2D,
  leg: Leg,
  startTParam: number,
  previewLengthIn: number,
  transform: CanvasTransform
): void {
  const startGeo = pointAlongLeg(leg, startTParam);
  const foldDirRad = leg.angleRad + Math.PI;
  const start = geoToCanvas(startGeo, transform);
  const lengthPx = previewLengthIn * transform.scale;
  const end = {
    x: start.x + Math.cos(foldDirRad) * lengthPx,
    y: start.y + Math.sin(foldDirRad) * lengthPx,
  };

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = CANVAS_COLORS.hemLine;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

// Deviation from the literal spec signature: renderAll takes an optional
// `hover` argument. Hover is tracked as local (non-dispatched) state inside
// FlashDraftCanvas per Section 7 ("track in local hover state") specifically
// so mouse movement doesn't round-trip the reducer — but that means it can't
// live on FlashDraftState either, so it has to reach renderAll some other
// way. An optional trailing parameter is the least invasive way to thread it
// through without breaking the (ctx, state, width, height) call shape.
export function renderAll(
  ctx: CanvasRenderingContext2D,
  state: FlashDraftState,
  canvasWidth: number,
  canvasHeight: number,
  hover?: HoverTarget | null
): void {
  const { geometry } = state.profile;
  const { transform, interaction } = state;

  renderGrid(ctx, transform, canvasWidth, canvasHeight);

  for (const leg of geometry.legs) {
    const isSelected = interaction.type === 'SELECTED_LEG' && interaction.legId === leg.id;
    const isHovered = hover?.type === 'leg' && hover.id === leg.id;
    renderLeg(ctx, leg, transform, isSelected, isHovered);
  }

  for (const leg of geometry.legs) {
    for (const hem of leg.hems) {
      const isSelected = interaction.type === 'SELECTED_HEM' && interaction.hemId === hem.id;
      renderHem(ctx, hem, leg, transform, isSelected);
    }
  }

  for (const bend of geometry.bendPoints) {
    const incomingLeg = geometry.legs.find((l) => l.id === bend.incomingLegId);
    const outgoingLeg = geometry.legs.find((l) => l.id === bend.outgoingLegId);
    const isSelected = interaction.type === 'SELECTED_BEND' && interaction.bendPointId === bend.id;
    const isHovered = hover?.type === 'bend' && hover.id === bend.id;
    renderBendPoint(ctx, bend, incomingLeg, outgoingLeg, transform, isSelected, isHovered);
  }

  if (interaction.type === 'DRAWING' && interaction.previewGeo) {
    const dx = interaction.previewGeo.x - interaction.startGeo.x;
    const dy = interaction.previewGeo.y - interaction.startGeo.y;
    const lengthIn = Math.hypot(dx, dy);
    const angleRad = Math.atan2(dy, dx);
    renderDragPreview(ctx, interaction.startGeo, interaction.previewGeo, transform, lengthIn, angleRad, true);
  }

  if (interaction.type === 'DRAWING_HEM') {
    const leg = geometry.legs.find((l) => l.id === interaction.legId);
    if (leg) renderHemPreview(ctx, leg, interaction.startTParam, interaction.previewLengthIn, transform);
  }
}
