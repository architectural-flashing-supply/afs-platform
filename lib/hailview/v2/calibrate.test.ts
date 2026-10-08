import { describe, expect, it } from 'vitest';
import {
  CSV_COLUMNS,
  formatReport,
  outcomeToTarget,
  parseCalibrationCsv,
  scoreCalibration,
  selfTestRows,
  splitCsvLine,
} from '../../../scripts/hailview-calibrate';

// The harness is tested against the tiny inline dataset the script itself
// ships, NOT against a committed claims file. Inventing a plausible-looking
// claims CSV and committing it would make fabricated data look like
// evidence, which is exactly what the calibration blocker must not become.

describe('calibration CSV parsing', () => {
  const header = CSV_COLUMNS.join(',');

  it('documents a fixed column order', () => {
    expect(CSV_COLUMNS).toEqual([
      'case_id',
      'asof_utc',
      'lat',
      'lon',
      'material',
      'roof_age_years',
      'shingle_type',
      'metal_gauge',
      'membrane_mil',
      'cosmetic_exclusion',
      'observations_json',
      'outcome',
    ]);
  });

  it('parses a well-formed row, including the quoted JSON evidence column', () => {
    const observations = [
      {
        id: 'o1',
        lat: 30.76,
        lon: -98.224,
        timeUtc: '2026-06-14T20:00:00Z',
        sizeIn: 2.0,
        sizeBasis: 'measured',
        source: 'iem_lsr',
        quality: 1,
        reporterClass: 'Trained Spotter',
        place: 'Burnet',
        remark: null,
      },
    ];
    const json = JSON.stringify(observations).replace(/"/g, '""');
    const csv =
      `${header}\n` +
      `C1,2026-10-08T12:00:00Z,30.7608552,-98.2239954,asphalt_shingle,18,architectural,,,false,"${json}",approved`;

    const rows = parseCalibrationCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].caseId).toBe('C1');
    expect(rows[0].material).toBe('asphalt_shingle');
    expect(rows[0].shingleType).toBe('architectural');
    expect(rows[0].roofAgeYears).toBe(18);
    expect(rows[0].metalGauge).toBeUndefined();
    expect(rows[0].cosmeticExclusion).toBe(false);
    expect(rows[0].observations).toHaveLength(1);
    expect(rows[0].outcome).toBe('approved');
  });

  it('REJECTS a header in the wrong order rather than mapping columns by guess', () => {
    const swapped = ['asof_utc', 'case_id', ...CSV_COLUMNS.slice(2)].join(',');
    expect(() => parseCalibrationCsv(`${swapped}\n`)).toThrow(/header mismatch/i);
  });

  it('THROWS on a malformed row rather than skipping it', () => {
    expect(() => parseCalibrationCsv(`${header}\nC1,2026-10-08T12:00:00Z,30.7`)).toThrow(/expected 12 fields/i);
    expect(() =>
      parseCalibrationCsv(`${header}\nC1,2026-10-08T12:00:00Z,30.7,-98.2,asphalt_shingle,18,,,,,[],maybe`)
    ).toThrow(/approved\|denied\|partial/i);
    expect(() =>
      parseCalibrationCsv(`${header}\nC1,2026-10-08T12:00:00Z,30.7,-98.2,asphalt_shingle,18,,,,,notjson,approved`)
    ).toThrow(/observations_json/i);
  });

  it('throws on an empty file', () => {
    expect(() => parseCalibrationCsv('')).toThrow(/empty/i);
  });

  it('splits quoted CSV fields and escaped quotes correctly', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(splitCsvLine('a,"say ""hi""",b')).toEqual(['a', 'say "hi"', 'b']);
    expect(splitCsvLine('a,,b')).toEqual(['a', '', 'b']);
  });
});

describe('outcome mapping', () => {
  it('treats PARTIAL as a miss, because the engine predicts a FULL replacement', () => {
    expect(outcomeToTarget('approved')).toBe(1);
    expect(outcomeToTarget('denied')).toBe(0);
    expect(outcomeToTarget('partial')).toBe(0);
  });
});

describe('calibration scoring', () => {
  it('computes a Brier score, a base-rate comparison and a reliability table', () => {
    const report = scoreCalibration(selfTestRows());

    expect(report.caseCount).toBe(3);
    expect(report.baseRate).toBeCloseTo(1 / 3, 6);
    expect(report.brierScore).toBeGreaterThanOrEqual(0);
    expect(report.brierScore).toBeLessThanOrEqual(1);
    expect(report.baseRateBrierScore).toBeCloseTo(2 / 9, 6);

    // Every case lands in exactly one bucket.
    const bucketed = report.reliability.reduce((s, b) => s + b.count, 0);
    expect(bucketed).toBe(report.caseCount);
  });

  it('re-runs each case at ITS OWN asof time, not today', () => {
    const rows = selfTestRows();
    const asItWas = scoreCalibration(rows);
    const twoYearsLater = scoreCalibration(
      rows.map((r) => ({ ...r, asofUtc: '2028-10-08T12:00:00Z' }))
    );
    // Moving every asof date two years forward pushes every storm outside
    // the claim window, so every prediction collapses to zero. If the
    // harness read the wall clock instead of asofUtc, these would be equal.
    expect(twoYearsLater.brierScore).not.toBeCloseTo(asItWas.brierScore, 6);
    expect(twoYearsLater.reliability[0].count).toBe(3);
  });

  it('scores a perfect predictor at 0 and an inverted one at 1', () => {
    const rows = selfTestRows();
    // Construct the extremes directly from the identity Brier = mean (p-t)^2
    // rather than trusting the engine to be perfect on synthetic data.
    const perfect = rows.map((r) => (outcomeToTarget(r.outcome) === 1 ? 1 : 0));
    const brier = (ps: number[]) =>
      ps.reduce((s, p, i) => s + (p - outcomeToTarget(rows[i].outcome)) ** 2, 0) / ps.length;
    expect(brier(perfect)).toBe(0);
    expect(brier(perfect.map((p) => 1 - p))).toBe(1);
  });

  it('raises no guard flags across the self-test dataset', () => {
    expect(scoreCalibration(selfTestRows()).guardFlagCases).toEqual([]);
  });

  it('throws rather than reporting a score for an empty dataset', () => {
    expect(() => scoreCalibration([])).toThrow(/no calibration rows/i);
  });

  it('formats a report that states plainly that nothing was fitted', () => {
    const text = formatReport(scoreCalibration(selfTestRows()));
    expect(text).toMatch(/MEASUREMENT ONLY, no constants were fitted/);
    expect(text).toMatch(/Brier score/);
    expect(text).toMatch(/Reliability table/);
    expect(text).toMatch(/v2\.0-uncalibrated/);
  });
});
