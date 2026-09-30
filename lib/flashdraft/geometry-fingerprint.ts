/**
 * GEOMETRY FINGERPRINT (Part 2, 2026-09-30).
 *
 * A stable, orientation-independent hash of a FlashDraft profile's SHAPE,
 * used to group "same shape ×N" in Command Center profile search. Two
 * profiles share a fingerprint when they would come off the machine as the
 * same part, regardless of who drew them, what they were named, which way
 * round the points were drawn, or whether the drawing was mirrored.
 *
 * NORMALIZATION — the exact, reviewable definition:
 *
 *   - LEG LENGTHS: Euclidean distance between consecutive points, rounded to
 *     the nearest 1/64 inch. 1/64" is the finest increment FlashDraft's own
 *     fractional readout displays, so two drawings that READ identically on
 *     screen fingerprint identically.
 *   - BEND ANGLES: signedInteriorAngleDeg at each interior point (the single
 *     source of truth per CLAUDE.md rule #12), rounded to the nearest 0.5°.
 *   - HEMS: start/end hem `type` and `gapIn` (gap rounded to 1/64"), or the
 *     literal token `none`. Hem LENGTH is deliberately excluded — it is a
 *     fabrication detail, not part of the profile outline.
 *
 * ORIENTATION INDEPENDENCE. Leg lengths and interior angles are intrinsic,
 * so rotating the drawing on the canvas cannot change them — rotation
 * invariance is free. The two transforms that DO change the encoding are
 * handled explicitly by generating all four variants and keeping the
 * lexicographically smallest:
 *
 *   1. as drawn
 *   2. drawn backwards      — legs reversed; angles reversed AND negated
 *                             (traversing the other way flips handedness);
 *                             hems swapped
 *   3. mirrored             — angles negated
 *   4. mirrored + backwards — legs reversed; angles reversed; hems swapped
 *
 * Because the canonical form is a MINIMUM over that set, any two drawings
 * related by rotation, reversal, or mirroring collapse to the same string
 * and therefore the same hash.
 *
 * The hash is FNV-1a (two 32-bit passes concatenated to 16 hex chars).
 * Deliberately not a crypto hash: this is
 * a grouping key, never a security boundary, and FNV-1a is dependency-free
 * and identical in Node and the browser, so a fingerprint computed at save
 * time in the client matches one computed in a server-side backfill.
 */

import { signedInteriorAngleDeg } from './geometry';

export interface FingerprintPoint {
  x: number;
  y: number;
}

export interface FingerprintHem {
  type?: string | null;
  gapIn?: number | null;
}

export interface FingerprintInput {
  points: FingerprintPoint[];
  hemStart?: FingerprintHem | null;
  hemEnd?: FingerprintHem | null;
}

/** 1/64 inch — the finest increment FlashDraft's fractional readout shows. */
const LENGTH_STEP = 1 / 64;
/** 0.5 degrees. */
const ANGLE_STEP = 0.5;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Fixed-width so string comparison of variants is stable and total. */
function fmtLength(inches: number): string {
  return roundTo(inches, LENGTH_STEP).toFixed(4);
}

function fmtAngle(deg: number): string {
  const rounded = roundTo(deg, ANGLE_STEP);
  // -0 and 0 must encode identically, or a mirrored straight-through bend
  // would fingerprint differently from its unmirrored twin.
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return (safe >= 0 ? '+' : '') + safe.toFixed(1);
}

function fmtHem(hem: FingerprintHem | null | undefined): string {
  if (!hem || !hem.type) return 'none';
  const gap = typeof hem.gapIn === 'number' && Number.isFinite(hem.gapIn) ? fmtLength(hem.gapIn) : '0.0000';
  // Hem KICK/direction is intentionally excluded alongside length: mirroring
  // a profile flips kick, so including it would break mirror-invariance,
  // which is the property "same shape" is supposed to have.
  return `${String(hem.type).toLowerCase()}@${gap}`;
}

/** One variant's canonical string. */
function encode(legs: number[], angles: number[], hemA: FingerprintHem | null | undefined, hemB: FingerprintHem | null | undefined): string {
  return [
    `L:${legs.map(fmtLength).join(',')}`,
    `A:${angles.map(fmtAngle).join(',')}`,
    `H:${fmtHem(hemA)}|${fmtHem(hemB)}`,
  ].join(';');
}

/**
 * The normalized, orientation-independent canonical form. Exported so a test
 * (and a human debugging a mis-grouping) can read exactly what was hashed.
 * Returns null when the geometry is too small or not finite to describe.
 */
export function canonicalGeometryString(input: FingerprintInput): string | null {
  const pts = input.points;
  if (!Array.isArray(pts) || pts.length < 2) return null;
  for (const p of pts) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  }

  const legs: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    legs.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  if (legs.some((l) => !Number.isFinite(l))) return null;

  const angles: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = signedInteriorAngleDeg(pts[i - 1], pts[i], pts[i + 1]);
    if (!Number.isFinite(a)) return null;
    angles.push(a);
  }

  const rev = <T,>(arr: T[]): T[] => arr.slice().reverse();
  const neg = (arr: number[]): number[] => arr.map((v) => -v);
  const hs = input.hemStart ?? null;
  const he = input.hemEnd ?? null;

  const variants = [
    encode(legs, angles, hs, he), // as drawn
    encode(rev(legs), neg(rev(angles)), he, hs), // drawn backwards
    encode(legs, neg(angles), hs, he), // mirrored
    encode(rev(legs), rev(angles), he, hs), // mirrored + backwards
  ];

  return variants.reduce((a, b) => (b < a ? b : a));
}

/**
 * FNV-1a, run twice with different offset bases and concatenated, giving 16
 * hex chars. Implemented in 32-bit integer arithmetic via Math.imul rather
 * than BigInt: this module is imported by the FlashDraft client bundle, and
 * the project's TS target predates BigInt literals. Identical output in Node
 * and the browser, which is the property the backfill depends on.
 */
function fnv1a32(str: string, offsetBasis: number): number {
  const bytes = new TextEncoder().encode(str);
  let hash = offsetBasis;
  for (const byte of bytes) {
    hash ^= byte;
    // 16777619, the FNV 32-bit prime. Math.imul keeps this a true 32-bit
    // multiply; `*` would lose precision past 2^53.
    hash = Math.imul(hash, 16777619);
  }
  // >>> 0 normalizes to unsigned before hex formatting.
  return hash >>> 0;
}

function hash16(str: string): string {
  const a = fnv1a32(str, 0x811c9dc5); // standard FNV-1a offset basis
  const b = fnv1a32(str, 0x01000193); // second basis -> independent 32 bits
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * The fingerprint stored in saved_configurations.geometry_fingerprint.
 * Returns null for geometry that cannot be normalized — a NULL fingerprint
 * means "not groupable", never "groups with other broken rows".
 */
export function geometryFingerprint(input: FingerprintInput): string | null {
  const canonical = canonicalGeometryString(input);
  if (canonical === null) return null;
  return hash16(canonical);
}
