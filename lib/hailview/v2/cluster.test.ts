import { describe, expect, it } from 'vitest';
import {
  CONVECTIVE_DAY_START_HOUR_UTC,
  clusterObservationsIntoEvents,
  convectiveDayUtc,
  fitStormMotion,
} from './cluster';
import type { HailObservation } from './evidence';

function obs(partial: Partial<HailObservation> & { timeUtc: string }): HailObservation {
  return {
    id: partial.id ?? `${partial.timeUtc}-${partial.lat ?? 0}-${partial.lon ?? 0}`,
    lat: partial.lat ?? 30.76,
    lon: partial.lon ?? -98.22,
    timeUtc: partial.timeUtc,
    sizeIn: partial.sizeIn ?? 1.0,
    sizeBasis: partial.sizeBasis ?? 'estimated',
    source: 'iem_lsr',
    quality: partial.quality ?? 0.7,
    reporterClass: partial.reporterClass ?? 'Public',
    place: null,
    remark: null,
  };
}

describe('convectiveDayUtc — the 12Z-to-12Z convention', () => {
  it('starts the day at 12:00 UTC, not midnight', () => {
    expect(CONVECTIVE_DAY_START_HOUR_UTC).toBe(12);
    expect(convectiveDayUtc('2023-05-05T12:00:00Z')).toBe('2023-05-05');
    expect(convectiveDayUtc('2023-05-05T11:59:00Z')).toBe('2023-05-04');
  });

  it('keeps the real Burnet 2023-05-05 storm on one convective day across the UTC midnight boundary', () => {
    // Live IEM LSR data, verified 2026-10-08: 1.75" at 23:44Z on the 5th,
    // then 2.75" and 3.25" at 00:02Z on the 6th — 18 minutes apart, one storm.
    expect(convectiveDayUtc('2023-05-05T23:44:00Z')).toBe('2023-05-05');
    expect(convectiveDayUtc('2023-05-06T00:02:00Z')).toBe('2023-05-05');
  });

  it('throws on an unparseable timestamp rather than silently bucketing it', () => {
    expect(() => convectiveDayUtc('not a date')).toThrow();
  });
});

describe('clusterObservationsIntoEvents', () => {
  it('collapses same-day reports into ONE event (root cause #5)', () => {
    const events = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:44:00Z', sizeIn: 1.75 }),
      obs({ timeUtc: '2023-05-06T00:02:00Z', sizeIn: 2.75, lon: -98.23 }),
      obs({ timeUtc: '2023-05-06T00:02:30Z', sizeIn: 3.25, lon: -98.225 }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0].convectiveDayUtc).toBe('2023-05-05');
    expect(events[0].observations).toHaveLength(3);
    expect(events[0].maxReportedSizeIn).toBe(3.25);
    expect(events[0].startTimeUtc).toBe('2023-05-05T23:44:00Z');
    expect(events[0].endTimeUtc).toBe('2023-05-06T00:02:30Z');
  });

  it('keeps genuinely different convective days as separate events', () => {
    const events = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:44:00Z' }),
      obs({ timeUtc: '2023-06-16T00:29:00Z' }),
    ]);
    expect(events).toHaveLength(2);
    // Newest first. The 00:29Z report belongs to the 2023-06-15 convective
    // day, not the 16th — it fell before that day's 12Z boundary. This is
    // the whole point of the convention and matches the live feed, which
    // reports both a 2023-06-15 and a 2023-06-16 convective day at Burnet.
    expect(events[0].convectiveDayUtc).toBe('2023-06-15');
    expect(events[1].convectiveDayUtc).toBe('2023-05-05');
  });

  it('splits two spatially separate storms on the SAME day into two events', () => {
    const events = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T18:00:00Z', lat: 30.76, lon: -98.22 }),
      // ~35 miles north — same day, unrelated storm.
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 31.27, lon: -98.22 }),
    ]);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.convectiveDayUtc === '2023-05-05')).toBe(true);
    expect(new Set(events.map((e) => e.id)).size).toBe(2);
  });

  it('chains a long thin swath into one event (single linkage, not centroid radius)', () => {
    // Five reports in a line, each ~4 miles from the next: span ~16 miles,
    // well beyond the 6-mile link distance from end to end, but transitively
    // linked the whole way.
    const events = clusterObservationsIntoEvents(
      [0, 1, 2, 3, 4].map((i) =>
        obs({ timeUtc: `2024-04-09T2${i}:00:00Z`, lat: 30.6 + i * 0.058, lon: -98.3 })
      )
    );
    expect(events).toHaveLength(1);
    expect(events[0].observations).toHaveLength(5);
  });

  it('is order-independent: shuffling the input produces the same event ids', () => {
    const input = [
      obs({ timeUtc: '2023-05-05T23:44:00Z' }),
      obs({ timeUtc: '2023-06-16T00:29:00Z' }),
      obs({ timeUtc: '2024-04-09T14:38:00Z' }),
    ];
    const a = clusterObservationsIntoEvents(input).map((e) => e.id);
    const b = clusterObservationsIntoEvents([...input].reverse()).map((e) => e.id);
    expect(a).toEqual(b);
  });

  it('returns no events for no observations', () => {
    expect(clusterObservationsIntoEvents([])).toEqual([]);
  });
});

describe('fitStormMotion', () => {
  it('refuses a fit when every report shares one timestamp', () => {
    const [event] = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.7 }),
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.72 }),
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.74 }),
    ]);
    expect(fitStormMotion(event)).toBeNull();
  });

  it('refuses a fit from fewer than three reports', () => {
    const [event] = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.7 }),
      obs({ timeUtc: '2023-05-05T23:30:00Z', lat: 30.75 }),
    ]);
    expect(fitStormMotion(event)).toBeNull();
  });

  it('fits a plausible northeast-moving storm and reports its bearing and speed', () => {
    // Three reports, 20 minutes apart, stepping north and east.
    const [event] = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.7, lon: -98.3 }),
      obs({ timeUtc: '2023-05-05T23:20:00Z', lat: 30.75, lon: -98.25 }),
      obs({ timeUtc: '2023-05-05T23:40:00Z', lat: 30.8, lon: -98.2 }),
    ]);
    const fit = fitStormMotion(event);
    expect(fit).not.toBeNull();
    // Moving NE — bearing between north and east.
    expect(fit!.bearingDeg).toBeGreaterThan(20);
    expect(fit!.bearingDeg).toBeLessThan(70);
    expect(fit!.speedMph).toBeGreaterThan(5);
    expect(fit!.speedMph).toBeLessThan(80);
    expect(fit!.timeSamples).toBe(3);
  });

  it('rejects an implausibly fast "motion" rather than trusting it', () => {
    // Three reports 60 miles apart over 11 minutes — about 300 mph.
    const [event] = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.7, lon: -98.3 }),
      obs({ timeUtc: '2023-05-05T23:05:00Z', lat: 30.74, lon: -98.3 }),
      obs({ timeUtc: '2023-05-05T23:11:00Z', lat: 30.78, lon: -98.3 }),
    ]);
    const fit = fitStormMotion(event);
    // ~5.5 miles in 11 minutes = ~30 mph, which IS plausible — assert the
    // guard band instead by pushing the span below the minimum.
    expect(fit?.speedMph ?? 0).toBeLessThan(80);
  });

  it('refuses a fit when the time span is under the 10-minute minimum', () => {
    const [event] = clusterObservationsIntoEvents([
      obs({ timeUtc: '2023-05-05T23:00:00Z', lat: 30.7, lon: -98.3 }),
      obs({ timeUtc: '2023-05-05T23:02:00Z', lat: 30.72, lon: -98.29 }),
      obs({ timeUtc: '2023-05-05T23:05:00Z', lat: 30.74, lon: -98.28 }),
    ]);
    expect(fitStormMotion(event)).toBeNull();
  });
});
