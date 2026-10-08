// Shared spherical geometry for the HailView V2 engine.
//
// One copy of each formula, because swath.ts, cluster.ts and evidence.ts all
// need the same distance and the same local-plane projection, and two
// implementations that disagree by a fraction of a mile would move a
// bracketing decision without anybody noticing.

/** Earth radius in miles — IUGG mean radius 6371.0088 km converted. 'published'. */
export const EARTH_RADIUS_MI = 3958.7613;

/**
 * Statute miles per degree of latitude. 'published' — derived from
 * EARTH_RADIUS_MI (2*pi*R/360). Kept as its own constant because the IEM
 * bounding-box builder in lib/hailview/storm-history.ts uses the rounder
 * 69.0 figure and must keep doing so (changing it would change which
 * reports the legacy V1 path sees).
 */
export const MILES_PER_DEGREE_LAT = (2 * Math.PI * EARTH_RADIUS_MI) / 360;

const DEG = Math.PI / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Great-circle distance in statute miles. */
export function haversineMiles(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface LocalXY {
  /** Miles east of the origin. */
  x: number;
  /** Miles north of the origin. */
  y: number;
}

/**
 * Equirectangular projection onto a local tangent plane centred on `origin`,
 * in miles. Over the <= ~15 mile radius HailView queries this is accurate to
 * well under the 0.6-mile coordinate quantization the IEM feed already
 * imposes (its lat/lon are rounded to 0.01 degrees), so a more elaborate
 * projection would be false precision.
 */
export function toLocalXY(origin: LatLon, point: LatLon): LocalXY {
  return {
    x: (point.lon - origin.lon) * MILES_PER_DEGREE_LAT * Math.cos(origin.lat * DEG),
    y: (point.lat - origin.lat) * MILES_PER_DEGREE_LAT,
  };
}

/** Compass bearing in degrees (0 = north, 90 = east) of `point` from `origin`. */
export function bearingDegrees(origin: LatLon, point: LatLon): number {
  const { x, y } = toLocalXY(origin, point);
  const deg = (Math.atan2(x, y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Largest angular gap, in degrees, between consecutive bearings around the
 * circle. With fewer than two bearings there is no gap to measure and the
 * whole circle (360) is empty.
 *
 * `360 - largestGap` is the angular SPAN the reports cover. A span above 180
 * degrees means no half-plane through the address contains every report —
 * i.e. the address is inside the directional hull of the reports and the
 * estimate is an interpolation rather than an extrapolation. See swath.ts.
 */
export function largestBearingGapDeg(bearings: number[]): number {
  if (bearings.length === 0) return 360;
  if (bearings.length === 1) return 360;
  const sorted = [...bearings].sort((a, b) => a - b);
  let largest = 360 - sorted[sorted.length - 1] + sorted[0]; // wrap-around gap
  for (let i = 1; i < sorted.length; i++) {
    largest = Math.max(largest, sorted[i] - sorted[i - 1]);
  }
  return largest;
}
