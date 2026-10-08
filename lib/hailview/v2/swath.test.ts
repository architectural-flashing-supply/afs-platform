import { describe, expect, it } from 'vitest';
import { clusterObservationsIntoEvents } from './cluster';
import type { HailObservation } from './evidence';
import {
  BRACKET_MIN_ANGULAR_SPAN_DEG,
  PRIOR_SIGMA_IN,
  PRIOR_SIZE_IN,
  QUANTILE_QUADRATURE,
  SWATH_ALONG_TRACK_FACTOR,
  SWATH_CROSS_TRACK_FACTOR,
  estimateSwathAtAddress,
  exceedanceProbability,
} from './swath';

const ADDRESS = { lat: 30.7608552, lon: -98.2239954 };

/** Miles north/east of the address, converted to a lat/lon offset. */
function offsetFrom(north: number, east: number) {
  const perDegLat = 69.0547;
  return {
    lat: ADDRESS.lat + north / perDegLat,
    lon: ADDRESS.lon + east / (perDegLat * Math.cos((ADDRESS.lat * Math.PI) / 180)),
  };
}

function obs(o: {
  timeUtc: string;
  sizeIn: number;
  north?: number;
  east?: number;
  basis?: 'measured' | 'estimated';
  quality?: number;
}): HailObservation {
  const pos = offsetFrom(o.north ?? 0, o.east ?? 0);
  return {
    id: `${o.timeUtc}-${o.north ?? 0}-${o.east ?? 0}-${o.sizeIn}`,
    lat: pos.lat,
    lon: pos.lon,
    timeUtc: o.timeUtc,
    sizeIn: o.sizeIn,
    sizeBasis: o.basis ?? 'estimated',
    source: 'iem_lsr',
    quality: o.quality ?? 0.7,
    reporterClass: 'Public',
    place: null,
    remark: null,
  };
}

function estimateFor(observations: HailObservation[]) {
  const [event] = clusterObservationsIntoEvents(observations);
  return estimateSwathAtAddress(ADDRESS, event);
}

describe('swath — a single DISTANT report', () => {
  it('yields a low exceedance probability and a wide interval, never a confident size', () => {
    const far = estimateFor([obs({ timeUtc: '2024-04-09T20:00:00Z', sizeIn: 3.0, north: 10 })]);

    // The 3" report is 10 miles away: the estimate must fall back toward the
    // climatological prior, not assert that 3" hail hit this roof.
    expect(far.centralIn).toBeLessThan(1.0);
    expect(far.centralIn).toBeCloseTo(PRIOR_SIZE_IN, 1);
    expect(far.pExceedOneInch).toBeLessThan(0.3);
    // And the uncertainty is capped at the prior's: evidence can only ever
    // add precision, never remove it.
    expect(far.sigmaIn).toBeLessThanOrEqual(PRIOR_SIGMA_IN + 1e-9);
    expect(far.sigmaIn).toBeCloseTo(PRIOR_SIGMA_IN, 2);
    expect(far.nearestReportMi).toBeGreaterThan(9);
    expect(far.interpolation).toBe('extrapolated');
    // Wide: the 10-90 interval must span a meaningful range of inches.
    expect(far.quantilesIn.p90 - far.quantilesIn.p10).toBeGreaterThan(0.8);
  });

  it('a NEARBY single report of the same size is both higher and tighter than a distant one', () => {
    const near = estimateFor([obs({ timeUtc: '2024-04-09T20:00:00Z', sizeIn: 3.0, north: 0.3 })]);
    const far = estimateFor([obs({ timeUtc: '2024-04-09T20:00:00Z', sizeIn: 3.0, north: 10 })]);

    expect(near.centralIn).toBeGreaterThan(far.centralIn);
    expect(near.pExceedOneInch).toBeGreaterThan(far.pExceedOneInch);
    const nearWidth = near.quantilesIn.p90 - near.quantilesIn.p10;
    const farWidth = far.quantilesIn.p90 - far.quantilesIn.p10;
    expect(nearWidth).toBeLessThan(farWidth);
  });
});

describe('swath — bracketing', () => {
  it('bracketed beats unbracketed on interval width, all else equal', () => {
    // GEOMETRY IS THE ONLY DIFFERENCE between these two cases: both have two
    // reports of the same size, both exactly 1 mile from the address, both
    // on the same convective day. Only the directions differ — opposite
    // sides versus 60 degrees apart on one side. An earlier version of this
    // test also moved the second report further away, which would have let
    // a pure distance effect pass for a bracketing effect.
    const bracketed = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: 1, east: 0 }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 1.5, north: -1, east: 0 }),
    ]);
    const unbracketed = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: 1, east: 0 }),
      // Bearing 60 degrees, still exactly 1 mile out.
      obs({
        timeUtc: '2025-05-17T01:05:00Z',
        sizeIn: 1.5,
        north: Math.cos(Math.PI / 3),
        east: Math.sin(Math.PI / 3),
      }),
    ]);

    expect(bracketed.bracketed).toBe(true);
    // Two diametrically opposite reports span exactly 180 degrees — the
    // boundary case, and the reason the comparison is >= rather than >.
    expect(bracketed.angularSpanDeg).toBeCloseTo(BRACKET_MIN_ANGULAR_SPAN_DEG, 3);
    expect(unbracketed.bracketed).toBe(false);
    expect(unbracketed.angularSpanDeg).toBeCloseTo(60, 3);

    const bracketedWidth = bracketed.quantilesIn.p90 - bracketed.quantilesIn.p10;
    const unbracketedWidth = unbracketed.quantilesIn.p90 - unbracketed.quantilesIn.p10;
    expect(bracketedWidth).toBeLessThan(unbracketedWidth);
    expect(bracketed.interpolation).toBe('interpolated');
    expect(unbracketed.interpolation).toBe('extrapolated');
  });

  it('a lone report can never be bracketed', () => {
    const one = estimateFor([obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: 0.5 })]);
    expect(one.bracketed).toBe(false);
    expect(one.angularSpanDeg).toBe(0);
  });
});

describe('swath — two nearby reports interpolate between their sizes', () => {
  it('lands the central estimate between the two observed sizes', () => {
    const e = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.0, north: 0.4 }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 2.0, north: -0.4 }),
    ]);
    expect(e.centralIn).toBeGreaterThan(1.0);
    expect(e.centralIn).toBeLessThan(2.0);
    expect(e.reportCount).toBe(2);
  });

  it('leans toward whichever report is closer', () => {
    const closerToSmall = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.0, north: 0.2 }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 2.0, north: -2.5 }),
    ]);
    const closerToLarge = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.0, north: 2.5 }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 2.0, north: -0.2 }),
    ]);
    expect(closerToSmall.centralIn).toBeLessThan(closerToLarge.centralIn);
  });
});

describe('swath — measured reports outweigh estimated ones', () => {
  it('pulls the estimate toward the measured report when the two disagree', () => {
    const measuredIsLarge = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 2.0, north: 0.5, basis: 'measured' }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 1.0, north: -0.5, basis: 'estimated' }),
    ]);
    const measuredIsSmall = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 2.0, north: 0.5, basis: 'estimated' }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 1.0, north: -0.5, basis: 'measured' }),
    ]);
    expect(measuredIsLarge.centralIn).toBeGreaterThan(measuredIsSmall.centralIn);
    expect(measuredIsLarge.measuredCount).toBe(1);
    expect(measuredIsLarge.estimatedCount).toBe(1);
  });

  it('reports a tighter interval when the evidence is measured rather than estimated', () => {
    const measured = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: 0.5, basis: 'measured' }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 1.5, north: -0.5, basis: 'measured' }),
    ]);
    const estimated = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: 0.5, basis: 'estimated' }),
      obs({ timeUtc: '2025-05-17T01:05:00Z', sizeIn: 1.5, north: -0.5, basis: 'estimated' }),
    ]);
    const width = (e: { quantilesIn: { p90: number; p10: number } }) =>
      e.quantilesIn.p90 - e.quantilesIn.p10;
    expect(width(measured)).toBeLessThan(width(estimated));
  });
});

describe('swath — anisotropic kernel', () => {
  it('uses an isotropic kernel when no storm motion can be fitted', () => {
    const e = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: 1 }),
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: -1 }),
    ]);
    expect(e.kernel).toBe('isotropic');
    expect(e.stormMotion).toBeNull();
  });

  it('uses an anisotropic kernel once three timed reports give a storm bearing', () => {
    const e = estimateFor([
      obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.5, north: -4, east: 0 }),
      obs({ timeUtc: '2025-05-17T01:20:00Z', sizeIn: 1.5, north: 0, east: 0 }),
      obs({ timeUtc: '2025-05-17T01:40:00Z', sizeIn: 1.5, north: 4, east: 0 }),
    ]);
    expect(e.kernel).toBe('anisotropic');
    expect(e.stormMotion).not.toBeNull();
  });

  it('weights an along-track report above an equally distant cross-track one', () => {
    // A storm tracking due north. The address sits on the track.
    const timed = (north: number, east: number, t: string) =>
      obs({ timeUtc: t, sizeIn: 1.0, north, east });

    // Build a northward track, then add ONE large report either 5 miles
    // along the track or 5 miles across it, and compare the pull.
    const track = [
      timed(-6, 0, '2025-05-17T01:00:00Z'),
      timed(-3, 0, '2025-05-17T01:15:00Z'),
      timed(0.2, 0, '2025-05-17T01:30:00Z'),
    ];
    const alongTrack = estimateFor([
      ...track,
      obs({ timeUtc: '2025-05-17T01:45:00Z', sizeIn: 3.0, north: 5, east: 0 }),
    ]);
    const crossTrack = estimateFor([
      ...track,
      obs({ timeUtc: '2025-05-17T01:45:00Z', sizeIn: 3.0, north: 0, east: 5 }),
    ]);

    expect(alongTrack.kernel).toBe('anisotropic');
    expect(alongTrack.centralIn).toBeGreaterThan(crossTrack.centralIn);
  });

  it('keeps the anisotropic kernel area-neutral: the two factors are reciprocal', () => {
    expect(SWATH_ALONG_TRACK_FACTOR * SWATH_CROSS_TRACK_FACTOR).toBeCloseTo(1, 10);
  });
});

describe('swath — exceedance probability and quadrature', () => {
  it('is monotone: a larger central estimate never lowers exceedance', () => {
    const sigma = 0.4;
    let previous = -1;
    for (const centralIn of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
      const p = exceedanceProbability({ centralIn, sigmaIn: sigma }, 1.0);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });

  it('is bounded in [0, 1] and sits at 0.5 when the central estimate IS the threshold', () => {
    expect(exceedanceProbability({ centralIn: 1.0, sigmaIn: 0.4 }, 1.0)).toBeCloseTo(0.5, 6);
    expect(exceedanceProbability({ centralIn: 0.1, sigmaIn: 0.3 }, 4.0)).toBeGreaterThanOrEqual(0);
    expect(exceedanceProbability({ centralIn: 9, sigmaIn: 0.3 }, 1.0)).toBeLessThanOrEqual(1);
  });

  it('quadrature weights sum to exactly 1', () => {
    const total = QUANTILE_QUADRATURE.reduce((s, q) => s + q.weight, 0);
    expect(total).toBeCloseTo(1, 12);
  });
});

describe('swath — quantiles are ordered and physical', () => {
  it('p10 <= p25 <= p50 <= p75 <= p90, and nothing falls below the smallest reportable size', () => {
    const e = estimateFor([obs({ timeUtc: '2025-05-17T01:00:00Z', sizeIn: 1.25, north: 0.5 })]);
    const q = e.quantilesIn;
    expect(q.p10).toBeLessThanOrEqual(q.p25);
    expect(q.p25).toBeLessThanOrEqual(q.p50);
    expect(q.p50).toBeLessThanOrEqual(q.p75);
    expect(q.p75).toBeLessThanOrEqual(q.p90);
    expect(q.p10).toBeGreaterThanOrEqual(0.25);
  });
});
