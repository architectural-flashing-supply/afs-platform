// HailView V2 — Module A: normalized hail evidence.
//
// One normalized observation shape, and an EvidenceSource interface so the
// Phase 2 sources (NOAA MRMS MESH, SPC daily reports, NOAA Storm Events,
// CoCoRaHS) plug in without the scoring pipeline changing. ONLY the IEM
// Local Storm Report adapter is implemented in Phase 1 — see
// SPEC_HAILVIEW_V2.md's data-source roadmap.
//
// DETERMINISM: this module performs I/O (it is the only module in v2/ that
// does). Everything downstream of it — cluster, swath, damage, claims,
// engine, guard — is pure and synchronous. The network boundary stops here
// so the scoring path itself stays reproducible from a recorded fixture.

import { haversineMiles, type LatLon } from './geo';
import { fetchLsrFeatures, type LsrFeature } from '../storm-history';

/**
 * How the reported size was arrived at.
 *
 * Only a MEASURED report is a measurement. Everything else is a human
 * eyeball estimate against a reference object ("quarter size", "golf ball"),
 * which is why no interpolated value anywhere in this engine is ever
 * described to a user as "confirmed".
 */
export type SizeBasis = 'measured' | 'estimated';

export interface HailObservation {
  /** Stable, content-derived id — see observationId(). */
  id: string;
  lat: number;
  lon: number;
  /** ISO 8601, always UTC. */
  timeUtc: string;
  /** Hail diameter, inches. */
  sizeIn: number;
  sizeBasis: SizeBasis;
  /** Source id of the EvidenceSource that produced this row, e.g. 'iem_lsr'. */
  source: string;
  /**
   * Reporter-class credibility weight in (0, 1]. Multiplies the spatial
   * kernel weight in swath.ts; it never changes the reported size.
   */
  quality: number;
  /** Verbatim reporter class from the upstream feed, for display/audit. */
  reporterClass: string;
  /** Nearest named place from the upstream feed, for display. */
  place: string | null;
  /** Free-text remark from the upstream feed, for display/audit. */
  remark: string | null;
}

export interface EvidenceQuery {
  lat: number;
  lon: number;
  radiusMi: number;
  lookbackYears: number;
  /** ISO 8601 "now" — passed in, never read from the clock, so a run is reproducible. */
  nowUtc: string;
}

export interface EvidenceResult {
  sourceId: string;
  observations: HailObservation[];
  /**
   * What this source could and could not see, in plain English. Surfaced in
   * the evidence grade rather than discarded — absence of reports is weak
   * evidence, not proof of no hail.
   */
  coverageNote: string;
  /** Set when the source could not be read at all. Observations will be empty. */
  errorReason: string | null;
}

/** Phase 2 plugs new sources in here. Phase 1 implements exactly one. */
export interface EvidenceSource {
  readonly id: string;
  readonly label: string;
  /**
   * Must never throw: an unreachable source is a degraded read (empty
   * observations + errorReason), not a 500. Same contract as
   * lib/integrations/pathfinder-response.ts.
   */
  fetch(query: EvidenceQuery): Promise<EvidenceResult>;
}

// ─────────────────────────────────────────────────────────────────────────
// REPORTER-CLASS QUALITY WEIGHTS — provenance: 'expert'
//
// NWS Local Storm Reports carry a `source` field naming the reporter class.
// These weights are a judgement about relative credibility of hail-size
// reporting by class, NOT a published figure: no source was found that
// quantifies per-class hail-size error for LSRs. They are deliberately
// gentle (0.70-1.00) so no class is silently discarded.
//
// NEEDS REID'S FIELD VALIDATION.
// ─────────────────────────────────────────────────────────────────────────
const REPORTER_QUALITY: Record<string, number> = {
  'nws employee': 1.0,
  'official nws obs': 1.0,
  'trained spotter': 1.0,
  'co-op observer': 0.95,
  cocorahs: 0.95,
  'emergency mngr': 0.9,
  'law enforcement': 0.85,
  'storm chaser': 0.85,
  'amateur radio': 0.85,
  'park/forest srvc': 0.85,
  'broadcast media': 0.75,
  public: 0.7,
};
/** Unrecognised reporter class — not dropped, just weighted like the public. */
const REPORTER_QUALITY_DEFAULT = 0.7; // 'expert'

function qualityForReporter(rawSource: string | null): number {
  if (!rawSource) return REPORTER_QUALITY_DEFAULT;
  return REPORTER_QUALITY[rawSource.trim().toLowerCase()] ?? REPORTER_QUALITY_DEFAULT;
}

/**
 * The IEM feed's `qualifier` is the NWS LSR convention: M = measured,
 * E = estimated, U = unknown. Verified against the live feed on 2026-10-08
 * for a Burnet, TX 15-mile window: 35 M, 61 E, 6 U across 102 hail reports.
 *
 * U is treated as ESTIMATED, not as measured — an unknown basis is never
 * promoted to a measurement.
 */
function basisForQualifier(qualifier: string | null): SizeBasis {
  return qualifier?.trim().toUpperCase() === 'M' ? 'measured' : 'estimated';
}

/**
 * Content-derived id. The IEM feed really does serve byte-identical
 * duplicate rows (verified live: the 2023-06-17T01:25Z 1.00" Broadcast
 * Media report near Burnet appears twice in one response), and a duplicate
 * would double its own kernel weight in swath.ts. Deduplicating on this id
 * is what stops that.
 */
function observationId(o: Omit<HailObservation, 'id'>): string {
  return [
    o.source,
    o.timeUtc,
    o.lat.toFixed(4),
    o.lon.toFixed(4),
    o.sizeIn.toFixed(2),
    o.reporterClass.toLowerCase(),
  ].join('|');
}

/** Only inches are accepted; any other unit is a shape problem, not a size. */
function inchesFromFeature(f: LsrFeature): number | null {
  const unit = (f.properties.unit ?? '').trim().toLowerCase();
  if (unit !== 'inch' && unit !== 'in' && unit !== 'inches') return null;
  const mag = f.properties.magf;
  if (typeof mag !== 'number' || !Number.isFinite(mag) || mag <= 0) return null;
  return mag;
}

export const IEM_LSR_SOURCE_ID = 'iem_lsr';

/**
 * Module A's only Phase 1 source. Reuses lib/hailview/storm-history.ts's
 * bounding-box builder and fetch rather than issuing its own request, so
 * there is one description of how this feed is queried.
 */
export const iemLsrEvidenceSource: EvidenceSource = {
  id: IEM_LSR_SOURCE_ID,
  label: 'Iowa Environmental Mesonet — NWS Local Storm Reports',

  async fetch(query: EvidenceQuery): Promise<EvidenceResult> {
    const origin: LatLon = { lat: query.lat, lon: query.lon };
    let features: LsrFeature[];
    try {
      features = await fetchLsrFeatures({
        lat: query.lat,
        lon: query.lon,
        radiusMi: query.radiusMi,
        lookbackYears: query.lookbackYears,
        nowUtc: query.nowUtc,
      });
    } catch (error) {
      console.error('[HailView V2 Evidence] IEM LSR read failed', error);
      return {
        sourceId: IEM_LSR_SOURCE_ID,
        observations: [],
        coverageNote: 'Local Storm Reports could not be read for this address.',
        errorReason:
          error instanceof Error ? error.message : 'Unknown error reading the IEM LSR feed.',
      };
    }

    const byId = new Map<string, HailObservation>();
    for (const f of features) {
      if (!/HAIL/i.test(f.properties.typetext ?? '')) continue;
      const sizeIn = inchesFromFeature(f);
      if (sizeIn === null) continue;

      const [lon, lat] = f.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (haversineMiles(origin, { lat, lon }) > query.radiusMi) continue;

      const reporterClass = (f.properties.source ?? '').trim() || 'Unknown';
      const partial: Omit<HailObservation, 'id'> = {
        lat,
        lon,
        timeUtc: f.properties.valid,
        sizeIn,
        sizeBasis: basisForQualifier(f.properties.qualifier),
        source: IEM_LSR_SOURCE_ID,
        quality: qualityForReporter(f.properties.source),
        reporterClass,
        place: f.properties.city?.trim() || null,
        remark: f.properties.remark?.trim() || null,
      };
      const id = observationId(partial);
      // First row wins; a byte-identical duplicate adds no information.
      if (!byId.has(id)) byId.set(id, { id, ...partial });
    }

    const observations = [...byId.values()].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));

    return {
      sourceId: IEM_LSR_SOURCE_ID,
      observations,
      coverageNote:
        `NWS Local Storm Reports within ${query.radiusMi} miles over the last ${query.lookbackYears} years. ` +
        'Report positions in this feed are rounded to 0.01 degrees (about 0.6 miles here), and small towns ' +
        'generate fewer reports than cities, so an absence of reports is weak evidence rather than proof ' +
        'that no hail fell.',
      errorReason: null,
    };
  },
};

/**
 * Reads every supplied source and merges the results. Phase 1 passes one
 * source; the merge and the per-source notes exist now so Phase 2 does not
 * have to reshape the pipeline.
 */
export async function collectHailEvidence(
  query: EvidenceQuery,
  sources: readonly EvidenceSource[] = [iemLsrEvidenceSource]
): Promise<{
  observations: HailObservation[];
  coverageNotes: string[];
  errors: { sourceId: string; reason: string }[];
}> {
  const results = await Promise.all(sources.map((s) => s.fetch(query)));
  const byId = new Map<string, HailObservation>();
  const coverageNotes: string[] = [];
  const errors: { sourceId: string; reason: string }[] = [];

  for (const r of results) {
    coverageNotes.push(r.coverageNote);
    if (r.errorReason) errors.push({ sourceId: r.sourceId, reason: r.errorReason });
    for (const o of r.observations) if (!byId.has(o.id)) byId.set(o.id, o);
  }

  return {
    observations: [...byId.values()].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc)),
    coverageNotes,
    errors,
  };
}
