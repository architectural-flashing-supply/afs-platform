// HailView V2 — Module B: group observations into storm events.
//
// ONE STORM IS ONE EVENT. This is the fix for V2's root cause #5: V1 treated
// every Local Storm Report as an independent "qualifying event" and then paid
// frequency points per report, so one supercell that generated eighteen
// reports scored like eighteen separate hailstorms. Measured live at Burnet,
// TX on 2026-10-08: the 2023-05-05 convective day alone produced 18 hail
// reports within 15 miles, and the single largest storm in the window
// (2024-04-09, 4.25 in) produced another 18.
//
// Pure and synchronous — no I/O, no clock read, no randomness.

import { haversineMiles, toLocalXY, type LatLon } from './geo';
import type { HailObservation } from './evidence';

/**
 * A convective day runs 12:00 UTC to 12:00 UTC — the SPC/NWS convention,
 * which exists precisely so that an evening thunderstorm outbreak is one
 * day's event rather than two. 'published' (NOAA/SPC convective-day
 * definition; the same boundary SPC uses for its daily reports).
 *
 * This matters at exactly the address under test: the 2023-05-05 Burnet
 * storm produced a 1.75 in report at 23:44Z on the 5th and 2.75 in / 3.25 in
 * reports at 00:02Z on the 6th. Calendar-day grouping splits one hailstorm
 * into two events 18 minutes apart; the convective day keeps it as one.
 */
export const CONVECTIVE_DAY_START_HOUR_UTC = 12;

/**
 * Single-linkage spatial threshold, miles. Two observations on the same
 * convective day belong to the same event if they are within this distance
 * of each other, transitively — a hail swath is a long thin chain of
 * reports, so chaining is the right linkage and a centroid-radius test is
 * the wrong one.
 *
 * Provenance: 'expert'. Set at 2x the swath bandwidth (SWATH_BANDWIDTH_MI,
 * 3 mi). NEEDS REID'S FIELD VALIDATION.
 *
 * THIS IS NOT WHAT THE CLAIM ENGINE USES — see
 * CLAIM_OCCURRENCE_LINK_DISTANCE_MI below. It is the default for callers
 * that want meteorological cells, and it is what the Phase 2 wide-area
 * sources (MRMS grids over whole counties) will want.
 */
export const EVENT_LINK_DISTANCE_MI = 6;

/**
 * WHAT THE CLAIM ENGINE USES: no spatial split at all. One convective day
 * at one address is ONE EVENT.
 *
 * This is an INSURANCE fact, not a meteorological one, and it is the reason
 * the engine does not use EVENT_LINK_DISTANCE_MI. A policy pays per
 * OCCURRENCE, and an occurrence is identified by a date of loss: if two
 * separate cells cross the same roof on one afternoon, the homeowner files
 * one claim for that date, not two. Treating them as two independent
 * hazards in claims.ts would inflate the probability — the same
 * over-counting the convective-day grouping exists to remove, reintroduced
 * one level down.
 *
 * It was measured, not assumed. Against the recorded Burnet fixture at a
 * 12-mile radius, a 6-mile link distance split 8 of 12 convective days and
 * turned them into 22 events — one 2026-05-06 storm date became two
 * hazards, one 2025-05-16 date became four.
 *
 * Nothing is lost by merging, because DISTANCE IS ALREADY HANDLED, and
 * handled better: swath.ts weights every report by its distance from the
 * address with a 3-mile kernel, so a report from the far cell contributes
 * almost nothing to the estimate at this roof. A hard cluster boundary
 * would be a cruder version of the same discrimination, applied twice.
 */
export const CLAIM_OCCURRENCE_LINK_DISTANCE_MI = Number.POSITIVE_INFINITY;

/**
 * Returns the convective day (YYYY-MM-DD) an instant falls in.
 *
 * Deliberately NOT the shop time zone: a convective day is a meteorological
 * unit defined in UTC, not a local business day (contrast rule #24's
 * delivery dates, which are local by definition). The returned string is a
 * plain date with no instant and no offset.
 */
export function convectiveDayUtc(timeUtc: string): string {
  const t = new Date(timeUtc);
  if (Number.isNaN(t.getTime())) {
    throw new Error(`convectiveDayUtc: not a parseable timestamp: ${timeUtc}`);
  }
  const shifted = new Date(t.getTime() - CONVECTIVE_DAY_START_HOUR_UTC * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

export interface StormEventCluster {
  /** Stable id: convective day plus the index of the cluster within it. */
  id: string;
  convectiveDayUtc: string;
  observations: HailObservation[];
  /** Earliest / latest observation time in this cluster, ISO 8601. */
  startTimeUtc: string;
  endTimeUtc: string;
  /** Unweighted mean position of the cluster's observations. */
  centroid: LatLon;
  /** Largest reported size anywhere in the cluster, inches. */
  maxReportedSizeIn: number;
}

function centroidOf(observations: HailObservation[]): LatLon {
  const n = observations.length;
  return {
    lat: observations.reduce((s, o) => s + o.lat, 0) / n,
    lon: observations.reduce((s, o) => s + o.lon, 0) / n,
  };
}

/**
 * Single-linkage (transitive) grouping by distance. O(n^2) on purpose: a
 * query returns on the order of a hundred observations across five years,
 * and a spatial index here would be complexity with nothing to buy.
 */
function linkByDistance(observations: HailObservation[], thresholdMi: number): HailObservation[][] {
  const unassigned = [...observations];
  const groups: HailObservation[][] = [];

  while (unassigned.length > 0) {
    const seed = unassigned.shift();
    if (!seed) break;
    const group = [seed];

    // Grow the group until no remaining observation is within the threshold
    // of ANY member — that transitivity is what lets a 20-mile swath of
    // reports chain into one event under a 6-mile link distance.
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = unassigned.length - 1; i >= 0; i--) {
        const candidate = unassigned[i];
        const linked = group.some((m) => haversineMiles(m, candidate) <= thresholdMi);
        if (linked) {
          group.push(candidate);
          unassigned.splice(i, 1);
          grew = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Groups observations into storm events: convective day first, then spatial
 * coherence within the day. Two genuinely separate storms on one day — one
 * north of town in the morning, one south of town at night — stay separate;
 * one storm whose reports straddle 00:00 UTC stays single.
 *
 * Returned newest-first, which is the order every consumer wants.
 */
export function clusterObservationsIntoEvents(
  observations: readonly HailObservation[],
  linkDistanceMi: number = EVENT_LINK_DISTANCE_MI
): StormEventCluster[] {
  const byDay = new Map<string, HailObservation[]>();
  for (const o of observations) {
    const day = convectiveDayUtc(o.timeUtc);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(o);
    else byDay.set(day, [o]);
  }

  const clusters: StormEventCluster[] = [];
  // Sort the days so cluster ids are deterministic regardless of the input
  // order the evidence layer happened to produce.
  for (const day of [...byDay.keys()].sort()) {
    const dayObservations = byDay.get(day) ?? [];
    const groups = linkByDistance(dayObservations, linkDistanceMi);

    // Order the day's groups by their earliest observation so the index in
    // the id is stable too.
    const ordered = groups
      .map((g) => [...g].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc)))
      .sort((a, b) => a[0].timeUtc.localeCompare(b[0].timeUtc));

    ordered.forEach((group, index) => {
      clusters.push({
        id: ordered.length === 1 ? day : `${day}#${index + 1}`,
        convectiveDayUtc: day,
        observations: group,
        startTimeUtc: group[0].timeUtc,
        endTimeUtc: group[group.length - 1].timeUtc,
        centroid: centroidOf(group),
        maxReportedSizeIn: group.reduce((m, o) => Math.max(m, o.sizeIn), 0),
      });
    });
  }

  return clusters.sort((a, b) => b.startTimeUtc.localeCompare(a.startTimeUtc));
}

/**
 * Least-squares storm-motion fit over a cluster's observations, used by
 * swath.ts to decide whether an anisotropic (along-track) kernel is
 * justified. Returns null when the cluster cannot support a direction.
 *
 * Positions are projected to a local miles plane centred on the cluster
 * centroid, then x and y are each regressed on time. The resulting velocity
 * vector gives the bearing; its magnitude gives the speed, which is what
 * makes the fit falsifiable — a "motion" of 3 mph or 200 mph is a fit to
 * coordinate quantization noise, not to a storm.
 */
export interface StormMotionFit {
  bearingDeg: number;
  speedMph: number;
  /** Distinct timestamps the fit was built from. */
  timeSamples: number;
  spanMinutes: number;
}

/** Minimum distinct timestamps before a motion fit is attempted. 'expert'. */
export const MOTION_MIN_TIME_SAMPLES = 3;
/** Minimum time span, minutes. Below this, position change is quantization noise. 'expert'. */
export const MOTION_MIN_SPAN_MINUTES = 10;
/** Plausible convective storm-motion band, mph. 'expert', from standard severe-storm motion ranges. */
export const MOTION_MIN_SPEED_MPH = 5;
export const MOTION_MAX_SPEED_MPH = 80;

export function fitStormMotion(cluster: StormEventCluster): StormMotionFit | null {
  const distinctTimes = new Set(cluster.observations.map((o) => o.timeUtc));
  if (cluster.observations.length < MOTION_MIN_TIME_SAMPLES) return null;
  if (distinctTimes.size < MOTION_MIN_TIME_SAMPLES) return null;

  const t0 = new Date(cluster.startTimeUtc).getTime();
  const samples = cluster.observations.map((o) => {
    const { x, y } = toLocalXY(cluster.centroid, o);
    return { t: (new Date(o.timeUtc).getTime() - t0) / 3600_000, x, y }; // t in hours
  });

  const spanMinutes =
    (new Date(cluster.endTimeUtc).getTime() - new Date(cluster.startTimeUtc).getTime()) / 60_000;
  if (spanMinutes < MOTION_MIN_SPAN_MINUTES) return null;

  const n = samples.length;
  const meanT = samples.reduce((s, p) => s + p.t, 0) / n;
  const varT = samples.reduce((s, p) => s + (p.t - meanT) ** 2, 0);
  if (varT <= 0) return null;

  const meanX = samples.reduce((s, p) => s + p.x, 0) / n;
  const meanY = samples.reduce((s, p) => s + p.y, 0) / n;
  const vx = samples.reduce((s, p) => s + (p.t - meanT) * (p.x - meanX), 0) / varT;
  const vy = samples.reduce((s, p) => s + (p.t - meanT) * (p.y - meanY), 0) / varT;

  const speedMph = Math.hypot(vx, vy);
  if (speedMph < MOTION_MIN_SPEED_MPH || speedMph > MOTION_MAX_SPEED_MPH) return null;

  return {
    bearingDeg: ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360,
    speedMph,
    timeSamples: distinctTimes.size,
    spanMinutes,
  };
}
