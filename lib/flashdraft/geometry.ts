import { formatInches as formatInchesShared } from '@/lib/utils/format-inches';
import type { CanvasPoint, CanvasTransform, GeoPoint, HitResult, Leg, ProfileGeometry } from './types';

const SNAP_ANGLE_STEP_RAD = (15 * Math.PI) / 180;
const SNAP_LENGTH_STEP_IN = 0.125;

export function geoToCanvas(geo: GeoPoint, t: CanvasTransform): CanvasPoint {
  return {
    x: geo.x * t.scale + t.panOffsetX,
    y: -geo.y * t.scale + t.panOffsetY,
  };
}

export function canvasToGeo(pixel: CanvasPoint, t: CanvasTransform): GeoPoint {
  return {
    x: (pixel.x - t.panOffsetX) / t.scale,
    y: -(pixel.y - t.panOffsetY) / t.scale,
  };
}

export function geoDistance(a: GeoPoint, b: GeoPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function pixelDistance(a: CanvasPoint, b: CanvasPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lineAngleRad(from: GeoPoint, to: GeoPoint): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// Shared with ProfileViewer3D's dimension labels — single source of truth
// for the decimal-inches-to-fractional-string conversion.
export function formatInches(inches: number): string {
  return formatInchesShared(inches);
}

export function snapAngle(rad: number): number {
  return Math.round(rad / SNAP_ANGLE_STEP_RAD) * SNAP_ANGLE_STEP_RAD;
}

export function snapLength(inches: number): number {
  return Math.round(inches / SNAP_LENGTH_STEP_IN) * SNAP_LENGTH_STEP_IN;
}

export function pointAlongLeg(leg: Leg, t: number): GeoPoint {
  return {
    x: leg.startGeo.x + (leg.endGeo.x - leg.startGeo.x) * t,
    y: leg.startGeo.y + (leg.endGeo.y - leg.startGeo.y) * t,
  };
}

export function closestTOnLeg(leg: Leg, point: GeoPoint): number {
  const abx = leg.endGeo.x - leg.startGeo.x;
  const aby = leg.endGeo.y - leg.startGeo.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return 0;
  const t = ((point.x - leg.startGeo.x) * abx + (point.y - leg.startGeo.y) * aby) / lengthSq;
  return Math.max(0, Math.min(1, t));
}

export function distanceToLeg(leg: Leg, point: GeoPoint): number {
  const t = closestTOnLeg(leg, point);
  const proj = pointAlongLeg(leg, t);
  return geoDistance(point, proj);
}

// Signed angle (v1 -> v2) in degrees, range (-180, 180]. v1/v2 are vectors
// FROM the bend point TO its incoming/outgoing leg endpoints — matches the
// sign convention the properties panel's angle field edits directly.
export function signedAngleBetween(v1: GeoPoint, v2: GeoPoint): number {
  const a = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
  let deg = (a * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  return deg;
}

export function rotatePoint(point: GeoPoint, pivot: GeoPoint, deltaRad: number): GeoPoint {
  const cos = Math.cos(deltaRad);
  const sin = Math.sin(deltaRad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

export function centroidOfGeometry(geometry: ProfileGeometry): GeoPoint {
  const points: GeoPoint[] = [];
  geometry.legs.forEach((leg) => points.push(leg.startGeo, leg.endGeo));
  if (points.length === 0) return { x: 0, y: 0 };
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

function pixelDistanceToSegment(p: CanvasPoint, a: CanvasPoint, b: CanvasPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return pixelDistance(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * abx, y: a.y + t * aby };
  return pixelDistance(p, proj);
}

// Moves a bend point to newGeo: the incoming leg stretches/compresses to
// reach it, while the outgoing leg and everything downstream translates by
// the same delta, preserving every downstream leg's length and direction —
// the "hinge" behind dragging a bend point.
export function dragBendPoint(geometry: ProfileGeometry, bendPointId: string, newGeo: GeoPoint): ProfileGeometry {
  const bendIndex = geometry.bendPoints.findIndex((b) => b.id === bendPointId);
  if (bendIndex === -1) return geometry;
  const bend = geometry.bendPoints[bendIndex];
  const oldGeo = bend.geo;
  const delta = { x: newGeo.x - oldGeo.x, y: newGeo.y - oldGeo.y };

  const incomingLegIndex = geometry.legs.findIndex((l) => l.id === bend.incomingLegId);
  const outgoingLegIndex = geometry.legs.findIndex((l) => l.id === bend.outgoingLegId);

  const legs = geometry.legs.map((leg, i) => {
    if (i === incomingLegIndex) {
      return {
        ...leg,
        endGeo: newGeo,
        lengthIn: geoDistance(leg.startGeo, newGeo),
        angleRad: lineAngleRad(leg.startGeo, newGeo),
      };
    }
    if (outgoingLegIndex !== -1 && i >= outgoingLegIndex) {
      return {
        ...leg,
        startGeo: { x: leg.startGeo.x + delta.x, y: leg.startGeo.y + delta.y },
        endGeo: { x: leg.endGeo.x + delta.x, y: leg.endGeo.y + delta.y },
      };
    }
    return leg;
  });

  const bendPoints = geometry.bendPoints.map((b, i) => {
    if (i === bendIndex) return b;
    if (i > bendIndex) return { ...b, geo: { x: b.geo.x + delta.x, y: b.geo.y + delta.y } };
    return b;
  });

  const incomingLeg = incomingLegIndex !== -1 ? legs[incomingLegIndex] : undefined;
  const outgoingLeg = outgoingLegIndex !== -1 ? legs[outgoingLegIndex] : undefined;
  let angleDegrees = bend.angleDegrees;
  if (incomingLeg && outgoingLeg) {
    const v1 = { x: incomingLeg.startGeo.x - newGeo.x, y: incomingLeg.startGeo.y - newGeo.y };
    const v2 = { x: outgoingLeg.endGeo.x - newGeo.x, y: outgoingLeg.endGeo.y - newGeo.y };
    angleDegrees = signedAngleBetween(v1, v2);
  }
  bendPoints[bendIndex] = { ...bend, geo: newGeo, angleDegrees };

  return { legs, bendPoints, hems: geometry.hems };
}

const DEFAULT_HIT_RADIUS_PX = 12;

// Priority: bend point > hem endpoint > leg > nothing.
export function hitTest(
  pixel: CanvasPoint,
  geometry: ProfileGeometry,
  transform: CanvasTransform,
  hitRadiusPx: number = DEFAULT_HIT_RADIUS_PX
): HitResult {
  for (const bend of geometry.bendPoints) {
    const center = geoToCanvas(bend.geo, transform);
    if (pixelDistance(pixel, center) <= hitRadiusPx) {
      return { type: 'bend', id: bend.id };
    }
  }

  for (const hem of geometry.hems) {
    const leg = geometry.legs.find((l) => l.id === hem.legId);
    if (!leg || leg.lengthIn === 0) continue;
    const startGeo = pointAlongLeg(leg, hem.distanceFromStartIn / leg.lengthIn);
    const foldDirRad = leg.angleRad + Math.PI;
    const endGeo = {
      x: startGeo.x + Math.cos(foldDirRad) * hem.lengthIn,
      y: startGeo.y + Math.sin(foldDirRad) * hem.lengthIn,
    };
    const startPx = geoToCanvas(startGeo, transform);
    const endPx = geoToCanvas(endGeo, transform);
    if (pixelDistance(pixel, startPx) <= hitRadiusPx) {
      return { type: 'hem_endpoint', hemId: hem.id, endpoint: 'start' };
    }
    if (pixelDistance(pixel, endPx) <= hitRadiusPx) {
      return { type: 'hem_endpoint', hemId: hem.id, endpoint: 'end' };
    }
  }

  for (const leg of geometry.legs) {
    const a = geoToCanvas(leg.startGeo, transform);
    const b = geoToCanvas(leg.endGeo, transform);
    const d = pixelDistanceToSegment(pixel, a, b);
    if (d <= hitRadiusPx) {
      const tParam = closestTOnLeg(leg, canvasToGeo(pixel, transform));
      return { type: 'leg', id: leg.id, tParam };
    }
  }

  return { type: 'none' };
}

export function computeProfileStats(geometry: ProfileGeometry): { bendCount: number; hemCount: number } {
  return { bendCount: geometry.bendPoints.length, hemCount: geometry.hems.length };
}
