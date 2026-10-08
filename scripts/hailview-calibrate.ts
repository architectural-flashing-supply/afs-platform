// HailView V2 — calibration harness.
//
// Reads a CSV of PAST, KNOWN claim outcomes, re-runs the deterministic
// engine from the evidence stored alongside each row, and reports how well
// the model's probabilities matched reality: a Brier score and a
// reliability table.
//
// IT FITS NOTHING. This run only MEASURES. Every constant in
// lib/hailview/v2/** stays exactly as it is, and the model version stays
// 'v2.0-uncalibrated' until real outcome data exists and someone decides,
// with Reid, what to change. A harness that quietly refitted constants
// would make the number unauditable, which is the one thing
// SPEC_HAILVIEW.md §1 does not permit.
//
// Usage:
//   npx tsx scripts/hailview-calibrate.ts <outcomes.csv>
//   npx tsx scripts/hailview-calibrate.ts --self-test
//
// CSV schema: documented in SPEC_HAILVIEW_V2.md §8 and enforced below.
// NO REAL OR FABRICATED CLAIM DATA IS COMMITTED TO THIS REPO. --self-test
// runs against a tiny inline array so the harness itself is testable
// without inventing a claims dataset that would then look authoritative.

import fs from 'node:fs';
import type { MaterialCategory, MembraneMilThickness, MetalGauge, ShingleType } from '../lib/hailview/types';
import type { HailObservation } from '../lib/hailview/v2/evidence';
import { computeReplacementProbabilityV2 } from '../lib/hailview/v2/engine';

// ─────────────────────────────────────────────────────────────────────────
// CSV SCHEMA
// ─────────────────────────────────────────────────────────────────────────

/**
 * One row per PAST LOOKUP WITH A KNOWN OUTCOME. Column order is fixed and
 * is the order the header must appear in.
 *
 * `observations_json` carries the evidence that was available AT THE TIME,
 * not a fresh query: a model is calibrated against what it actually saw.
 * That is also why `asof_utc` is a required column — re-running today's
 * clock against a 2019 claim would put every event outside the claim window
 * and score the whole dataset at zero.
 */
export const CSV_COLUMNS = [
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
] as const;

export type Outcome = 'approved' | 'denied' | 'partial';

export interface CalibrationRow {
  caseId: string;
  asofUtc: string;
  lat: number;
  lon: number;
  material: MaterialCategory;
  roofAgeYears?: number;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
  cosmeticExclusion?: boolean;
  observations: HailObservation[];
  outcome: Outcome;
}

/**
 * Maps an outcome onto the 0/1 target the Brier score needs.
 *
 * The engine predicts P(the insurer pays for a FULL ROOF REPLACEMENT), so
 * `partial` is a MISS: a partial payment or a repair is, by that
 * definition, not the event being predicted. Scoring `partial` as 0.5 would
 * be scoring the model against a different question than the one it
 * answers.
 */
export function outcomeToTarget(outcome: Outcome): 0 | 1 {
  return outcome === 'approved' ? 1 : 0;
}

/** Minimal RFC-4180 field splitter: handles quoted fields and escaped quotes. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

function optionalNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`not a number: ${JSON.stringify(raw)}`);
  return n;
}

/**
 * Parses the CSV. THROWS on a malformed row rather than skipping it — a
 * calibration run silently computed over a subset of the data would report
 * a Brier score for a dataset nobody chose.
 */
export function parseCalibrationCsv(text: string): CalibrationRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new Error('Calibration CSV is empty.');

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const expected = [...CSV_COLUMNS];
  if (header.length !== expected.length || header.some((h, i) => h !== expected[i])) {
    throw new Error(
      `Calibration CSV header mismatch.\n  expected: ${expected.join(',')}\n  found:    ${header.join(',')}`
    );
  }

  return lines.slice(1).map((line, index) => {
    const f = splitCsvLine(line);
    if (f.length !== expected.length) {
      throw new Error(`Row ${index + 2}: expected ${expected.length} fields, found ${f.length}.`);
    }
    const [caseId, asofUtc, lat, lon, material, age, shingle, gauge, mil, exclusion, obsJson, outcome] = f;

    const outcomeTrimmed = outcome.trim().toLowerCase();
    if (outcomeTrimmed !== 'approved' && outcomeTrimmed !== 'denied' && outcomeTrimmed !== 'partial') {
      throw new Error(`Row ${index + 2}: outcome must be approved|denied|partial, found ${JSON.stringify(outcome)}.`);
    }

    let observations: HailObservation[];
    try {
      const parsed = JSON.parse(obsJson) as unknown;
      if (!Array.isArray(parsed)) throw new Error('not an array');
      observations = parsed as HailObservation[];
    } catch (error) {
      throw new Error(
        `Row ${index + 2}: observations_json is not a JSON array of HailObservation (${
          error instanceof Error ? error.message : 'parse error'
        }).`
      );
    }

    const exclusionTrimmed = exclusion.trim().toLowerCase();
    return {
      caseId: caseId.trim(),
      asofUtc: asofUtc.trim(),
      lat: Number(lat),
      lon: Number(lon),
      material: material.trim() as MaterialCategory,
      roofAgeYears: optionalNumber(age),
      shingleType: shingle.trim() === '' ? undefined : (shingle.trim() as ShingleType),
      metalGauge: gauge.trim() === '' ? undefined : (gauge.trim() as MetalGauge),
      membraneMilThickness: optionalNumber(mil) as MembraneMilThickness | undefined,
      cosmeticExclusion:
        exclusionTrimmed === '' ? undefined : exclusionTrimmed === 'true' || exclusionTrimmed === '1',
      observations,
      outcome: outcomeTrimmed,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────

export interface ReliabilityBucket {
  /** Half-open [lowerBound, upperBound), except the last which includes 1. */
  lowerBound: number;
  upperBound: number;
  count: number;
  meanPredicted: number;
  observedRate: number;
}

export interface CalibrationReport {
  caseCount: number;
  /** Mean squared error of the probabilities. Lower is better; 0.25 is a coin flip. */
  brierScore: number;
  /**
   * Brier score of always predicting the dataset's own base rate. The model
   * is only earning its keep if it beats this — which is why it is printed
   * next to the headline number rather than left for the reader to work out.
   */
  baseRateBrierScore: number;
  /** 1 - brier/baseRateBrier. Positive means better than the base rate. */
  skillScore: number;
  baseRate: number;
  reliability: ReliabilityBucket[];
  /** Any guard flags raised while re-running the dataset. */
  guardFlagCases: { caseId: string; flags: string[] }[];
}

const BUCKET_EDGES = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0];

export function scoreCalibration(
  rows: readonly CalibrationRow[]
): CalibrationReport {
  if (rows.length === 0) throw new Error('No calibration rows to score.');

  const predictions = rows.map((row) => {
    const result = computeReplacementProbabilityV2({
      material: row.material,
      roofAgeYears: row.roofAgeYears,
      shingleType: row.shingleType,
      metalGauge: row.metalGauge,
      membraneMilThickness: row.membraneMilThickness,
      cosmeticExclusion: row.cosmeticExclusion,
      lat: row.lat,
      lon: row.lon,
      observations: row.observations,
      // The clock as it was, not as it is now.
      nowUtc: row.asofUtc,
    });
    return { row, probability: result.probability, guardFlags: result.guardFlags };
  });

  const targets = predictions.map((p) => outcomeToTarget(p.row.outcome));
  const baseRate = targets.reduce<number>((s, t) => s + t, 0) / targets.length;

  const brierScore =
    predictions.reduce((s, p, i) => s + (p.probability - targets[i]) ** 2, 0) / predictions.length;
  const baseRateBrierScore =
    targets.reduce((s: number, t) => s + (baseRate - t) ** 2, 0) / targets.length;

  const reliability: ReliabilityBucket[] = [];
  for (let b = 0; b < BUCKET_EDGES.length - 1; b++) {
    const lowerBound = BUCKET_EDGES[b];
    const upperBound = BUCKET_EDGES[b + 1];
    const isLast = b === BUCKET_EDGES.length - 2;
    // The last bucket is closed at 1.0 so a prediction of exactly 1 lands
    // somewhere; every other bucket is half-open so no case is counted twice.
    const members = predictions
      .map((p, i) => ({ probability: p.probability, target: targets[i] }))
      .filter(
        (m) =>
          m.probability >= lowerBound &&
          (isLast ? m.probability <= upperBound : m.probability < upperBound)
      );
    reliability.push({
      lowerBound,
      upperBound,
      count: members.length,
      meanPredicted:
        members.length === 0 ? 0 : members.reduce((s, m) => s + m.probability, 0) / members.length,
      observedRate:
        members.length === 0 ? 0 : members.reduce((s, m) => s + m.target, 0) / members.length,
    });
  }

  return {
    caseCount: rows.length,
    brierScore,
    baseRateBrierScore,
    skillScore: baseRateBrierScore === 0 ? 0 : 1 - brierScore / baseRateBrierScore,
    baseRate,
    reliability,
    guardFlagCases: predictions
      .filter((p) => p.guardFlags.length > 0)
      .map((p) => ({ caseId: p.row.caseId, flags: p.guardFlags })),
  };
}

export function formatReport(report: CalibrationReport): string {
  const lines: string[] = [];
  lines.push('HailView V2 calibration — MEASUREMENT ONLY, no constants were fitted.');
  lines.push('');
  lines.push(`Cases:                 ${report.caseCount}`);
  lines.push(`Base rate (approved):  ${(report.baseRate * 100).toFixed(1)}%`);
  lines.push(`Brier score:           ${report.brierScore.toFixed(4)}  (lower is better)`);
  lines.push(`Base-rate Brier:       ${report.baseRateBrierScore.toFixed(4)}`);
  lines.push(
    `Skill vs base rate:    ${(report.skillScore * 100).toFixed(1)}%  ` +
      `(${report.skillScore > 0 ? 'better than' : 'NO BETTER THAN'} always predicting the base rate)`
  );
  lines.push('');
  lines.push('Reliability table — a well-calibrated model has observed ~= predicted:');
  lines.push('  predicted band      n   mean predicted   observed approved');
  for (const b of report.reliability) {
    const band = `${b.lowerBound.toFixed(1)}-${b.upperBound.toFixed(1)}`.padEnd(14);
    if (b.count === 0) {
      lines.push(`  ${band}      0        —                —`);
      continue;
    }
    lines.push(
      `  ${band}  ${String(b.count).padStart(5)}        ` +
        `${(b.meanPredicted * 100).toFixed(1).padStart(5)}%          ` +
        `${(b.observedRate * 100).toFixed(1).padStart(5)}%`
    );
  }

  if (report.guardFlagCases.length > 0) {
    lines.push('');
    lines.push('GUARD FLAGS RAISED while re-running the dataset:');
    for (const c of report.guardFlagCases) {
      lines.push(`  ${c.caseId}: ${c.flags.join('; ')}`);
    }
  }

  lines.push('');
  lines.push(
    `Cases needed before fitting anything: this engine has ${report.caseCount} and is still ` +
      'labelled v2.0-uncalibrated. See SPEC_HAILVIEW_V2.md §8 for the calibration-data blocker.'
  );
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// SELF-TEST — a tiny inline dataset, so the harness is runnable without a
// claims file. These are SYNTHETIC SHAPES, not real or plausible claim
// records, and nothing here is committed as data.
// ─────────────────────────────────────────────────────────────────────────

export function selfTestRows(): CalibrationRow[] {
  const makeObservations = (day: string, sizeIn: number): HailObservation[] =>
    [0, 1, 2].map((i) => ({
      id: `${day}-${i}`,
      lat: 30.76 + (i - 1) * 0.007,
      lon: -98.224 + (i - 1) * 0.004,
      timeUtc: `${day}T20:${String(i * 12).padStart(2, '0')}:00Z`,
      sizeIn,
      sizeBasis: i === 0 ? 'measured' : 'estimated',
      source: 'iem_lsr',
      quality: 1,
      reporterClass: 'Trained Spotter',
      place: 'Burnet',
      remark: null,
    }));

  return [
    {
      caseId: 'SELFTEST-1',
      asofUtc: '2026-10-08T12:00:00Z',
      lat: 30.7608552,
      lon: -98.2239954,
      material: 'asphalt_shingle',
      shingleType: 'architectural',
      roofAgeYears: 18,
      observations: makeObservations('2026-06-14', 2.75),
      outcome: 'approved',
    },
    {
      caseId: 'SELFTEST-2',
      asofUtc: '2026-10-08T12:00:00Z',
      lat: 30.7608552,
      lon: -98.2239954,
      material: 'metal_standing_seam',
      metalGauge: '24ga',
      roofAgeYears: 8,
      cosmeticExclusion: true,
      observations: makeObservations('2026-06-14', 1.5),
      outcome: 'denied',
    },
    {
      caseId: 'SELFTEST-3',
      asofUtc: '2026-10-08T12:00:00Z',
      lat: 30.7608552,
      lon: -98.2239954,
      material: 'asphalt_shingle',
      shingleType: '3-tab',
      roofAgeYears: 22,
      observations: makeObservations('2026-05-11', 1.25),
      outcome: 'partial',
    },
  ];
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    console.log(formatReport(scoreCalibration(selfTestRows())));
    console.log('');
    console.log('(--self-test: three synthetic cases. Not real claim data.)');
    return;
  }

  const path = args[0];
  if (!path) {
    console.error('Usage: npx tsx scripts/hailview-calibrate.ts <outcomes.csv> | --self-test');
    console.error(`CSV columns, in order: ${CSV_COLUMNS.join(',')}`);
    process.exit(1);
  }

  const text = fs.readFileSync(path, 'utf8');
  console.log(formatReport(scoreCalibration(parseCalibrationCsv(text))));
}

// Run only when invoked directly, so the exports above stay unit-testable.
if (process.argv[1] && /hailview-calibrate\.ts$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main();
}
