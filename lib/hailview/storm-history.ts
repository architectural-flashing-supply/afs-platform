import type { StormEvent } from './types';

const IEM_LSR_URL = 'https://mesonet.agron.iastate.edu/geojson/lsr.py';

const LOOKBACK_YEARS = 5;
const RADIUS_MI = 1;
const MILES_PER_DEGREE_LAT = 69.0;

// Hail reports must never be crowded out by the much higher volume of
// routine wind-gust/other reports near any given address — only non-hail
// reports are capped. Preserves the fix this port is based on.
const NON_HAIL_CAP = 150;

// Exported for the V2 evidence adapter (lib/hailview/v2/evidence.ts), which
// reads two fields V1 does not: `qualifier` (the NWS M/E/U measured-vs-
// estimated convention) and `source` (the reporter class). Both have always
// been present in the live feed — verified 2026-10-08 against a Burnet, TX
// window — V1 simply never read them.
export interface LsrFeatureProperties {
  type: string;
  typetext: string;
  magf: number | null;
  magnitude: string | null;
  unit: string | null;
  valid: string;
  city: string | null;
  county: string | null;
  state: string | null;
  st: string | null;
  remark: string | null;
  /** NWS LSR size basis: 'M' measured, 'E' estimated, 'U' unknown. */
  qualifier: string | null;
  /** Reporter class, e.g. 'Trained Spotter', 'Public', 'Cocorahs'. */
  source: string | null;
  lat: number;
  lon: number;
}

export interface LsrFeature {
  properties: LsrFeatureProperties;
  geometry: { type: 'Point'; coordinates: [number, number] };
}

interface LsrFeatureCollection {
  type: 'FeatureCollection';
  features: LsrFeature[];
}

export interface LsrFetchOptions {
  lat: number;
  lon: number;
  radiusMi: number;
  lookbackYears: number;
  /**
   * ISO 8601 "now". V2 passes this explicitly so an engine run is
   * reproducible from a recorded response; V1's own call site keeps using
   * the wall clock, exactly as before.
   */
  nowUtc?: string;
}

/**
 * The one place this feed is queried. Builds the latitude-corrected
 * bounding box and returns the raw features, unfiltered by report type —
 * `fetchStormHistory` below applies V1's hail/non-hail handling, and
 * lib/hailview/v2/evidence.ts applies V2's normalization. Extracted in
 * hv2-01 so V1 and V2 cannot drift apart on how the box is built; V1's
 * resulting request is byte-identical to what it was before.
 */
export async function fetchLsrFeatures(options: LsrFetchOptions): Promise<LsrFeature[]> {
  const { lat, lon, radiusMi, lookbackYears } = options;
  const now = options.nowUtc ? new Date(options.nowUtc) : new Date();
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - lookbackYears);

  const latRad = (lat * Math.PI) / 180;
  const latDelta = radiusMi / MILES_PER_DEGREE_LAT;
  const lonDelta = radiusMi / (MILES_PER_DEGREE_LAT * Math.cos(latRad));

  const params = new URLSearchParams({
    sts: start.toISOString(),
    ets: now.toISOString(),
    north: (lat + latDelta).toFixed(6),
    south: (lat - latDelta).toFixed(6),
    east: (lon + lonDelta).toFixed(6),
    west: (lon - lonDelta).toFixed(6),
  });

  const res = await fetch(`${IEM_LSR_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`IEM LSR feed responded with HTTP ${res.status}`);
  }

  const geojson = (await res.json()) as LsrFeatureCollection;
  return geojson.features ?? [];
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius, miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toStormEvent(feature: LsrFeature, originLat: number, originLon: number): StormEvent {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  const isHail = /HAIL/i.test(p.typetext ?? '');

  return {
    id: `${p.valid}-${lat.toFixed(4)}-${lon.toFixed(4)}-${p.typetext}`,
    isHail,
    typeText: p.typetext,
    sizeIn: isHail ? p.magf ?? null : null,
    magnitude: p.magf ?? null,
    unit: p.unit ?? null,
    validAt: p.valid,
    city: p.city ?? null,
    county: p.county ?? null,
    state: p.state ?? p.st ?? null,
    distanceMi: haversineMiles(originLat, originLon, lat, lon),
    lat,
    lon,
    remark: p.remark ?? null,
  };
}

/**
 * Fetches Local Storm Reports from Iowa Environmental Mesonet within a
 * ~1-mile radius of (lat, lon) over the trailing 5 years. The IEM feed
 * takes a rectangular bounding box, so the box itself is built with a
 * latitude-corrected longitude delta (a degree of longitude covers fewer
 * ground-miles as latitude increases) and then narrowed to a true circular
 * radius via haversine distance, matching the box-then-circle approach
 * this port is based on.
 *
 * Hail reports are never capped. Every other report type (wind gusts,
 * etc.) is capped at NON_HAIL_CAP, most recent first — without this,
 * routine wind-gust reports (far more numerous than hail reports at most
 * addresses) would crowd real hail history out of the result set.
 */
export async function fetchStormHistory(lat: number, lon: number): Promise<StormEvent[]> {
  const features = await fetchLsrFeatures({
    lat,
    lon,
    radiusMi: RADIUS_MI,
    lookbackYears: LOOKBACK_YEARS,
  });

  const allEvents = features
    .map((f) => toStormEvent(f, lat, lon))
    .filter((e) => e.distanceMi <= RADIUS_MI);

  const hailEvents = allEvents.filter((e) => e.isHail);
  const otherEvents = allEvents
    .filter((e) => !e.isHail)
    .sort((a, b) => new Date(b.validAt).getTime() - new Date(a.validAt).getTime())
    .slice(0, NON_HAIL_CAP);

  return [...hailEvents, ...otherEvents].sort(
    (a, b) => new Date(b.validAt).getTime() - new Date(a.validAt).getTime()
  );
}
