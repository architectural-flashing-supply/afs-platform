'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ALL_MATERIALS, GAUGES_BY_MATERIAL, MATERIAL_SHORTHAND } from '@/lib/data/catalog';
import {
  colorPaletteForMaterial,
  requiresFinishChoice,
  isColorRequirementSatisfied,
  colorRequirementErrorMessage,
  type AluminumFinish,
} from '@/lib/data/material-color-requirement';
import ColorField from '@/components/quote/ColorField';
import FinishColorField from '@/components/quote/FinishColorField';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import { formatInches } from '@/lib/utils/format-inches';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import { computeProfilePoints } from '@/lib/flashdraft/geometry';
import { drawHemGlyph, HEM_GLYPH_R } from '@/lib/flashdraft/hem-glyph';
import { ADMIN_JOB_HANDOFF_KEY, type AdminJobHandoffPayload } from '@/lib/flashdraft/admin-job-handoff';
import {
  drawProfileScene,
  renderShopSnapshotDataUri,
  LIVE_CANVAS_LABEL_STYLE,
} from '@/lib/flashdraft/draw-profile-scene';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';
import SubmitConfirmation3DModal, { type PaintFace } from '@/components/studio/SubmitConfirmation3DModal';
import MatchedProfile3DModal from '@/components/studio/MatchedProfile3DModal';
import { isPaintedMaterial, resolveSelectedPaintColor, BARE_METAL_COLOR } from '@/lib/utils/paint-appearance';
import ProfileDetailsModal, { type ProfileDetailsFormValues } from '@/components/studio/ProfileDetailsModal';
import VariantPicker from '@/components/studio/VariantPicker';
import Toast from '@/components/ui/Toast';
import type { ProfileMatch, DiagramBend } from '@/app/api/studio/match-profile/route';
import {
  type HemType,
  type Hem,
  type HemKick,
  HEM_DEFAULT_LENGTH_IN,
  HEM_DEFAULT_GAP_IN_OPEN,
  HEM_DEFAULT_GAP_IN_SMASHED,
  HEM_DEFAULT_KICK,
  hemAllowanceIn,
} from '@/lib/types/profile';

type SubmitState = 'idle' | 'submitting' | 'submitted';
type HemEndpoint = 'start' | 'end';

interface Point {
  x: number;
  y: number;
  /** Bend radius in inches — only meaningful for interior (bend) points. */
  radius?: number;
}

// Undo/redo history entry — the full editable profile state, not just
// `points`. Previously `past`/`future` stored bare `Point[]`, so hem
// creation/removal (setHemStart/setHemEnd, neither of which ever went
// through commitPoints) was invisible to undo entirely: pressing Undo
// right after adding a hem silently did nothing (if no prior points-only
// action existed to revert to) or reverted an unrelated earlier points
// change while leaving the just-added hem in place — either way, reading
// as "undo doesn't work." Every push site now snapshots all three fields
// together so a hem action is exactly as undoable as a points action.
interface ProfileSnapshot {
  points: Point[];
  hemStart: Hem | null;
  hemEnd: Hem | null;
}

// The full editable profile model persisted for autosave — everything that
// composes "the current drawing," not just geometry. Deliberately excludes
// saved-profile identity (profileName/revision/savedProfileId/categoryId/
// subcategory) since those belong to the separate Saved Profiles feature —
// restoring a stale savedProfileId here could make a later "Save" silently
// overwrite an unrelated saved profile.
interface AutosaveState {
  points: Point[];
  hemStart: Hem | null;
  hemEnd: Hem | null;
  material: string;
  gauge: string;
  color: string;
  finish: AluminumFinish | '';
  lengthFeet: string;
  lengthInches: string;
  quantity: string;
  notes: string;
  // Job-identity intake fields (migration 018, afs-jf-000) — all optional,
  // never block submit (afs-jf-003). `requestedBy` retired by migration 019
  // (afs-jf-004) — it was a naming mistake that actually meant a delivery
  // date, not a person's name — and replaced here by `jobName` +
  // `requestedDeliveryDate` (afs-jf-005).
  clientBusinessName: string;
  clientName: string;
  poNumber: string;
  jobName: string;
  requestedDeliveryDate: string;
}

const MM_PER_INCH = 25.4;
const VIEWER_DEBOUNCE_MS = 300;
const AUTOSAVE_KEY = 'afs-flashdraft-autosave';
const AUTOSAVE_DEBOUNCE_MS = 500;

// Shown in the 3D confirmation modal before the user has drawn anything —
// in practice unreachable, since the submit flow requires a real drawing,
// but kept as a safe fallback for viewerBends' initial state.
const PLACEHOLDER_COPING_CAP_BENDS: ProfileBend[] = [
  { leftLeg: 76.2, rightLeg: 254, angle: 90, radius: 3 },
  { leftLeg: 254, rightLeg: 76.2, angle: 90, radius: 3 },
];
const PLACEHOLDER_BLANK_WIDTH_MM = 76.2 + 254 + 76.2;

// A FlashDraft profile recovered from a customer's own submitted quote
// request (quote_requests.line_items), as opposed to the user's own
// saved_configurations Profile Passport rows (now browsed at
// /app/profile-passport, not inline here — see loadFromPassportById).
// `points` is only present for requests submitted after this feature shipped — line_items previously
// stored only the reconstruction-lossy bendRadiiIn/hemStart/hemEnd
// fields, not the raw drawn geometry, so older submissions can't be loaded
// back exactly and their Load button is disabled instead of guessing.
interface SavedQuoteProfile {
  quoteRequestId: string;
  itemIndex: number;
  requestNumber: string;
  submittedAt: string;
  name: string;
  material: string | null;
  gauge: string | null;
  points: Point[] | null;
}

interface QuoteRequestRow {
  id: string;
  request_number: string;
  submitted_at: string;
  line_items: unknown;
}

// F-01 (audit 2026-09-24). These validators used `typeof x === 'number'`,
// which is TRUE for NaN and for Infinity. That mattered because
// `JSON.parse('{"x": 1e999}')` yields Infinity — so a corrupt or tampered
// localStorage autosave entry could load non-finite geometry straight onto
// the canvas, with no crafted API request involved, and from there into the
// machine payload where it serialised to `null`. Number.isFinite rejects
// NaN, ±Infinity, and non-numbers in a single call.
function isFinitePoint(p: unknown): p is Point {
  if (!p || typeof p !== 'object') return false;
  const pt = p as Point;
  if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
  // radius is optional, but when present it drives the bend feature sent to
  // the machine, so it gets the same treatment.
  if (pt.radius !== undefined && pt.radius !== null && !Number.isFinite(pt.radius)) return false;
  return true;
}

function isPointArray(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 2 && value.every(isFinitePoint);
}

// Same shape check as isPointArray but without the >=2 length requirement —
// an autosaved profile may be mid-draw (0 or 1 points) rather than complete.
function isPointArrayShape(value: unknown): value is Point[] {
  return Array.isArray(value) && value.every(isFinitePoint);
}

// F-01: this previously accepted ANY non-null object, including `{}` and
// `[]` — a hem missing lengthIn then produced `undefined * 25.4 = NaN` in
// the machine adapter. Now checks the real Hem shape field by field.
function isHemShape(value: unknown): value is Hem | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const h = value as Hem;
  return (
    (h.type === 'open' || h.type === 'smashed' || h.type === 'teardrop') &&
    (h.kick === 'inside' || h.kick === 'outside') &&
    Number.isFinite(h.gapIn) &&
    Number.isFinite(h.lengthIn)
  );
}

// Guards the autosaved `finish` field (afs-jf-002) against a stale/corrupt
// localStorage entry from before this field existed, or any value outside
// the two real AluminumFinish options.
function isAluminumFinishShape(value: unknown): value is AluminumFinish | '' {
  return value === '' || value === 'Anodized' || value === 'Painted';
}

function isFlashDraftLineItem(
  value: unknown
): value is { profileType: string; material?: string | null; gauge?: string | null; points?: unknown } {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).profileType === 'Custom FlashDraft Profile'
  );
}

// Canvas 2D fillStyle/strokeStyle can't consume Tailwind classes or CSS
// custom properties — mirrors the afs-crimson / afs-ink-900 / afs-accent-*
// tokens for the canvas-drawn profile and its dimension/bend/hem labels
// (same documented exception pattern already used for the Stripe
// CardElement in app/checkout/page.tsx). See DESIGN_TOKENS.md §10.
const CANVAS_COLORS = {
  // Applied as the 2D canvas element's own inline background (see the
  // <canvas> below) — deliberately NOT the shared afs-bg-raised token
  // (#363C4A), which stays untouched for every other page/component that
  // uses it. Light neutral gray so the crimson/blue profile lines and
  // black-ink dimension labels stay high-contrast against the drawing
  // surface (afs-fl-019).
  background: '#C4C4C4',
  grid: 'rgba(17, 17, 17, 0.08)',
  profile: '#C0001A',
  profileSelected: '#2563EB',
  point: '#C0001A',
  ink: '#111111',
  dragLabelBg: 'rgba(17, 17, 17, 0.92)',
  dragLabelText: '#FFFFFF',
  angleArc: '#C0001A', // afs-crimson
  angleArcWarn: '#D32F2F',
  hemLine: '#C0001A', // afs-crimson — hem fold/gap/teardrop rendering (DESIGN_TOKENS.md §10)
};

// Green "move mode" cursor shown while whole-profile move (afs-sv-004,
// Alt+drag) is actively dragging — matches the Pathfinder-familiar move
// affordance Steve expects. CSS `cursor` can't consume Tailwind classes or
// CSS custom properties any more than a 2D canvas context can, so this is a
// literal-hex value under the same documented exception as CANVAS_COLORS
// above (DESIGN_TOKENS.md §10) rather than a new precedent. Inline SVG data
// URI (a 4-way move-arrows glyph) with a `grabbing` keyword fallback for any
// browser that can't parse a custom cursor image.
const MOVE_CURSOR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
  '<path d="M12 1 L8.5 5.5 H11 V10.5 H6 V8 L1.5 12 L6 16 V13.5 H11 V18.5 H8.5 L12 23 L15.5 18.5 H13 V13.5 H18 V16 L22.5 12 L18 8 V10.5 H13 V5.5 H15.5 Z" ' +
  'fill="#00FF00" stroke="#111111" stroke-width="1"/></svg>';
const MOVE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(MOVE_CURSOR_SVG)}") 12 12, grabbing`;

const PIXELS_PER_INCH = 20;
const CANVAS_MIN_WIDTH = 600;
const CANVAS_MIN_HEIGHT = 440;
const HIT_RADIUS_PX = 10;
const MATCH_DEBOUNCE_MS = 500;
const MATCH_SPLIT_THRESHOLD = 70;

const MIN_BEND_RADIUS_IN = 0.125;
const MAX_BEND_RADIUS_IN = 4;
const MIN_DRAG_SEGMENT_IN = 0.05;

const ANGLE_ARC_HIT_PX = 16;

const HEM_HIT_RADIUS_PX = 22; // generous double-click target for creating a NEW hem — was 14px, too tight to hit reliably in testing
// Re-opening an EXISTING hem's popup is a far more common action than the
// initial creation click, and the exact HEM_TRIGGER_OFFSET_IN point was too
// easy to miss — a slightly-off double-click just silently hit whatever's
// actually under the cursor (e.g. the neighboring bend-radius control) with
// no feedback, confirmed by Reid live. ~1.75x HEM_HIT_RADIUS_PX, within his
// requested 1.5x-2x range. Only applies at an endpoint that already has a
// hem — new-hem creation keeps the tighter HEM_HIT_RADIUS_PX.
const HEM_HIT_RADIUS_EXISTING_PX = 38;
const HEM_TRIGGER_OFFSET_IN = 0.5;

// Wider than HIT_RADIUS_PX on purpose: guards the "click empty space to
// draw a new segment" fallback in handlePointerDown. A pointerdown that
// misses every vertex/segment hit-test by just a few pixels — a failed
// grab while attempting to reshape or hem an existing leg, not a genuine
// click out in empty space — must never silently fall through to
// line-continuation. That fallback anchors its dashed preview at the
// profile's LAST point (not the cursor), so a near-miss produced a red
// dashed line that appeared to come from nowhere relative to where the
// user was actually dragging, and committed a surprise extra point on
// release. See the guard in handlePointerDown.
const NEW_SEGMENT_MISS_GUARD_PX = 24;

// HEM_GLYPH_R and drawHemGlyph itself live in lib/flashdraft/hem-glyph.ts
// (imported above) — shared with the standalone debug view at
// app/studio/hem-debug/page.tsx, which calls the exact same function at a
// larger scale rather than reimplementing it. The draw-loop's own use of
// drawHemGlyph, plus GRID_INCHES/ANGLE_ARC_RADIUS_PX/HEM_GLYPH_LENGTH_SCALE/
// MIN_READABLE_R/TEARDROP_THICKNESS_TO_R/MIN_TEARDROP_R and their tuning
// rationale, now live in lib/flashdraft/draw-profile-scene.ts's
// drawProfileScene (afs-fl-017) — shared with the offscreen shop-snapshot
// render at submit time, so this page no longer needs them directly.

const VERTEX_DRAG_THRESHOLD_PX = 3; // movement before a vertex click becomes a drag

// Hard guard rail on vertex-drag and leg-reshape (they share the same
// translation math — see clampDragAngle below): neither gesture may drag a
// bend angle to or past a self-overlapping fold (0°) or a fully
// straightened, no-bend-at-all joint (180°). This is prevention at the
// interaction level, not an attempt to correctly represent reflex angles
// through the rest of the angle math/quote-summary pipeline — bendAngleAt's
// use of Math.acos() below is mathematically incapable of returning more
// than 180° by definition, so a reflex bend that DID reach the committed
// points would be silently misreported as its unsigned supplement in the
// submitted quote text (e.g. a true 187° bend reads back as "173°",
// indistinguishable from a real 173° bend) — see buildBendSummary.
const MIN_BEND_ANGLE_DEG = 1;
const MAX_BEND_ANGLE_DEG = 179;

const ROTATE_STEP_DEG = 15;
const ZOOM_STEP_RATIO = 0.1;

function defaultBendRadiusIn(material: string): number {
  if (/copper|zinc/i.test(material)) return 0.75;
  if (/aluminu?m/i.test(material)) return 0.375;
  return 0.5;
}

function isGauge18OrThicker(gauge: string): boolean {
  const match = gauge.trim().match(/^(\d+)\s*ga$/i);
  if (!match) return false;
  return parseInt(match[1], 10) <= 18;
}

// PathfinderEdge fallback title generator (afs-jf-006) — used by
// sendToPathfinder() below ONLY when the user hasn't set a real canvas
// profile name (see that call site's own userSetProfileName check, which
// this function does not duplicate or re-decide). Composed left to right:
// short-material + gauge, then the first present of Job Name / Business
// Name / Client Name, then PO Number (as "PO <number>") — blanks dropped,
// no dangling separators, same drop-blank-segments convention as
// pathfinder-edge.ts's composeDescription. Falls back to a timestamp
// only when NONE of job/business/client/PO is present, matching this
// generator's pre-afs-jf-006 behavior of always including a timestamp.
function buildFallbackProfileName(
  material: string | null,
  gauge: string | null,
  jobName: string | null,
  businessName: string | null,
  clientName: string | null,
  poNumber: string | null
): string {
  const shortMaterial = material ? (MATERIAL_SHORTHAND[material] ?? material) : 'Profile';
  const materialGauge = [shortMaterial, gauge || null].filter(Boolean).join(' ');
  const identitySegment = jobName || businessName || clientName || null;
  const poSegment = poNumber ? `PO ${poNumber}` : null;
  const segments = [materialGauge, identitySegment, poSegment].filter(
    (s): s is string => !!s && s.trim() !== ''
  );
  if (!identitySegment && !poSegment) {
    segments.push(new Date().toLocaleString('en-US'));
  }
  return segments.join(' - ');
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function unitVector(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function bendAngleAt(prev: Point, curr: Point, next: Point): number {
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (mag === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Signed angle from v1 to v2 in degrees, range (-180, 180] — internal to the
// bend-circle angle-drag math below (direction/sign only); display always
// uses the unsigned bendAngleAt.
function signedAngleBetween(v1: Point, v2: Point): number {
  const a = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
  let deg = (a * 180) / Math.PI;
  while (deg > 180) deg -= 360;
  while (deg <= -180) deg += 360;
  return deg;
}

// Wraps a degree value into (-180, 180] — same wrap rule as
// signedAngleBetween, factored out so clampAngleAwayFromRef below can apply
// it to a plain angle difference without round-tripping through vectors.
function wrapDeg(deg: number): number {
  let d = deg;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

// If thetaDeg is within [MIN_BEND_ANGLE_DEG, MAX_BEND_ANGLE_DEG] of refDeg
// (unsigned), returns it unchanged. Otherwise pulls it back to whichever
// boundary it crossed — the one-dimensional primitive behind
// clampDragAngle below. `guardStraight` (default true) gates only the
// MAX_BEND_ANGLE_DEG side (mag -> 180°, "fully straightened") — see
// clampDragAngle's mirrored branch for why point 0's own drag passes
// false here: unlike every other clamped joint, that check isn't
// protecting a bend angle point 0 itself owns.
function clampAngleAwayFromRef(thetaDeg: number, refDeg: number, guardStraight = true): number {
  const delta = wrapDeg(thetaDeg - refDeg);
  const mag = Math.abs(delta);
  const tooOverlapped = mag < MIN_BEND_ANGLE_DEG;
  const tooStraight = guardStraight && mag > MAX_BEND_ANGLE_DEG;
  if (!tooOverlapped && !tooStraight) return thetaDeg;
  const sign = delta < 0 ? -1 : 1;
  const clampedMag = tooOverlapped ? MIN_BEND_ANGLE_DEG : MAX_BEND_ANGLE_DEG;
  return refDeg + sign * clampedMag;
}

// Guards the shared vertex-drag/leg-reshape translation math (in
// handlePointerMove) against producing a self-overlapping (angle -> 0°) or
// fully-straightened (angle -> 180°) bend at either joint a single drag can
// actually reshape: the vertex being dragged (`idx`), and — if idx-1 is
// itself an interior bend point — the joint immediately before it. Moving
// `idx` only ever changes the ONE leg between `original[idx-1]` (fixed) and
// the candidate point; both joints' angles are therefore driven by the same
// single degree of freedom (the direction from that fixed anchor to the
// candidate), so both constraints clamp the same theta, applied in
// sequence. Preserves the dragged LENGTH exactly — only the angle is ever
// pulled back, and only as far as the nearest boundary it would cross.
function clampDragAngle(candidate: Point, idx: number, original: Point[]): Point {
  // Every other vertex has a point strictly BEFORE it (idx-1) to anchor
  // against. Point 0 has no leg before it — there's nothing at idx-1 — so
  // this is the one place that anchor mirrors to the point strictly AFTER
  // it (idx+1) instead. This is a structural necessity, not a preference:
  // point 0 genuinely has only one leg, on its far side, unlike every
  // interior point which has one on each side. Everything below is written
  // once and reads `mirrored` rather than duplicating the whole function,
  // so the two directions can't drift apart.
  const mirrored = idx === 0;
  const anchor = mirrored ? original[idx + 1] : original[idx - 1];
  if (!anchor) return candidate;
  const length = dist(anchor, candidate);
  if (length < 1e-6) return candidate;
  const theta0 = (Math.atan2(candidate.y - anchor.y, candidate.x - anchor.x) * 180) / Math.PI;
  let theta = theta0;

  // Joint at the anchor: the fixed leg coming into the anchor from ITS
  // far neighbor (original[idx-2] normally; mirrored, original[idx+2] —
  // the point beyond the anchor, away from idx), vs. the leg this drag is
  // creating (anchor -> theta).
  const anchorFarNeighbor = mirrored ? original[idx + 2] : original[idx - 2];
  if (anchorFarNeighbor) {
    const phiBefore = (Math.atan2(anchorFarNeighbor.y - anchor.y, anchorFarNeighbor.x - anchor.x) * 180) / Math.PI;
    // Point 0 (mirrored) has no leg before it — no bend angle of its own
    // for this joint to protect. The only real hazard is leg0 folding
    // exactly back onto leg1 (mag->0, guarded below regardless); a fully
    // straightened run (leg0 collinear with, and opposite to, leg1) is an
    // ordinary straight profile, not a degenerate one — and is exactly the
    // "move point 0 further in/out along the leg" drag. Guarding it here
    // was pulling that legitimate in/out drag off-axis. Every other
    // (non-mirrored) vertex still protects its own straightened-joint case.
    theta = clampAngleAwayFromRef(theta, phiBefore, !mirrored);
  }
  // Joint at idx itself: only applies in the non-mirrored case. It
  // protects the angle between the leg this drag is creating and the
  // fixed leg going OUT to original[idx+1] — a second leg on idx's far
  // side from the anchor. Point 0 (mirrored) has no such far side — its
  // only leg IS the one being dragged — so there is no second joint to
  // protect, exactly like the true last point already skips this same
  // branch today (original[idx+1] is undefined there).
  if (!mirrored) {
    const nextNeighbor = original[idx + 1];
    if (nextNeighbor) {
      const originalIdxPoint = original[idx];
      const phiAfter =
        (Math.atan2(nextNeighbor.y - originalIdxPoint.y, nextNeighbor.x - originalIdxPoint.x) * 180) / Math.PI;
      theta = clampAngleAwayFromRef(theta, phiAfter + 180);
    }
  }

  if (theta === theta0) return candidate;
  const rad = (theta * Math.PI) / 180;
  return { x: anchor.x + Math.cos(rad) * length, y: anchor.y + Math.sin(rad) * length };
}

// Rotates every point downstream of `vertexIndex` around that vertex by
// deltaDeg — the "hinge" behind dragging a bend circle to change its angle.
// Leg lengths on both sides of the joint stay exactly the same; only the
// direction of everything past the joint changes, same as bending a real
// hinged joint.
function rotateChainAroundVertex(points: Point[], vertexIndex: number, deltaDeg: number): Point[] {
  const pivot = points[vertexIndex];
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p, i) => {
    if (i <= vertexIndex) return p;
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos, radius: p.radius };
  });
}

// Rotates every point around a fixed pivot by deltaDeg — used by the
// toolbar's Rotate Left/Right, which spins the whole profile (unlike
// rotateChainAroundVertex, which only spins what's downstream of one joint).
function rotateAllPoints(points: Point[], pivot: Point, deltaDeg: number): Point[] {
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => {
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos, radius: p.radius };
  });
}

function centroidOf(points: Point[]): Point {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y };
}

// Shared by fitToScreen (reads live `points` state) and loadTemplate (fits
// the just-loaded template array directly, before that state update has
// landed) — same math, parameterized instead of closing over `points`.
function computeFitView(points: Point[], canvasWidth: number, canvasHeight: number): { zoom: number; pan: Point } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const widthIn = Math.max(Math.max(...xs) - Math.min(...xs), 0.5);
  const heightIn = Math.max(Math.max(...ys) - Math.min(...ys), 0.5);
  const PADDING_PX = 60;
  const availW = canvasWidth - PADDING_PX * 2;
  const availH = canvasHeight - PADDING_PX * 2;
  const nextZoom = Math.max(
    0.25,
    Math.min(4, Math.min(availW / (widthIn * PIXELS_PER_INCH), availH / (heightIn * PIXELS_PER_INCH)))
  );
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { zoom: nextZoom, pan: { x: -centerX * PIXELS_PER_INCH * nextZoom, y: -centerY * PIXELS_PER_INCH * nextZoom } };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: a.x + t * abx, y: a.y + t * aby };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

interface ProfileTemplateVariant {
  id: string;
  label: string;
  // See the PLACEHOLDER notice on PROFILE_TEMPLATES below — every variant's
  // points are provisional generic shapes, not real fabrication geometry.
  points: Point[];
}

interface ProfileTemplate {
  id: string;
  label: string;
  // Design-time coordinates on an assumed 600x600 canvas, centered on
  // (300,300) — converted to world inches (origin at canvas center, same
  // convention worldToScreen/screenToWorld use) via TEMPLATE_CANVAS_CENTER
  // and PIXELS_PER_INCH below, not stored pre-converted. Present only for
  // single-shape templates — omitted when `variants` is set, since those
  // open VariantPicker instead of loading geometry directly.
  points?: Point[];
  // When set, clicking this template's button opens VariantPicker instead
  // of calling loadTemplateGeometry directly (see the button row below).
  variants?: ProfileTemplateVariant[];
}

// ============================================================================
// PLACEHOLDER GEOMETRY — afs-fl-020
//
// Every points/variants array below is a simple, generic 2-8 point shape at
// approximate standard dimensions, NOT real fabrication geometry. The real
// bend-point geometry for each of these 20 profiles (plus the 6 Coping Cap /
// Valley variants) was meant to come from physical reference images not
// available when this list was built — per Reid's explicit constraint,
// physical product dimensions are never fabricated from memory or invented
// as if sourced from a real reference. Swapping in real dimensions later is
// meant to be a pure data change to this array, not a rebuild of the
// template/VariantPicker mechanism itself. Do not present any shape here as
// production-final in code comments or UI copy — see STATE_OF_THE_BUILD.md
// (afs-fl-020) for the full list of what's still pending.
//
// This is the locked 20-item list (replaces the prior 10-item set), plus
// Coping Cap carried forward from that prior set as a 21st button — Coping
// Cap isn't one of the 20 newly-locked names, but it's explicitly required
// to route through VariantPicker (see task step 2), so it stays in the row
// rather than being dropped.
// ============================================================================
const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'z-closure',
    label: 'Z Closure',
    points: [{ x: 150, y: 280 }, { x: 250, y: 280 }, { x: 300, y: 330 }, { x: 400, y: 330 }],
  },
  {
    id: 'sill',
    label: 'Sill',
    points: [{ x: 200, y: 220 }, { x: 200, y: 320 }, { x: 340, y: 320 }, { x: 360, y: 350 }],
  },
  {
    id: 'j-channel',
    label: 'J-Channel',
    points: [
      { x: 220, y: 200 }, { x: 220, y: 320 }, { x: 260, y: 320 }, { x: 260, y: 260 }, { x: 300, y: 260 },
    ],
  },
  {
    id: 'z-spacer-trim',
    label: 'Z-Spacer Trim',
    points: [{ x: 200, y: 240 }, { x: 280, y: 240 }, { x: 320, y: 300 }, { x: 400, y: 300 }],
  },
  {
    id: 'outside-corner',
    label: 'Outside Corner',
    points: [{ x: 220, y: 200 }, { x: 220, y: 300 }, { x: 340, y: 300 }],
  },
  {
    id: 'inside-corner',
    label: 'Inside Corner',
    points: [{ x: 200, y: 200 }, { x: 200, y: 280 }, { x: 260, y: 280 }, { x: 260, y: 340 }],
  },
  {
    id: 'window-drip',
    label: 'Window Drip',
    points: [{ x: 220, y: 240 }, { x: 220, y: 300 }, { x: 380, y: 300 }, { x: 400, y: 330 }],
  },
  {
    id: 'siding-starter',
    label: 'Siding Starter',
    points: [{ x: 220, y: 260 }, { x: 220, y: 320 }, { x: 260, y: 320 }, { x: 280, y: 300 }],
  },
  {
    id: 'stucco-perimeter',
    label: 'Stucco Perimeter',
    points: [
      { x: 220, y: 220 }, { x: 220, y: 320 }, { x: 260, y: 320 }, { x: 260, y: 300 },
      { x: 340, y: 300 }, { x: 340, y: 340 },
    ],
  },
  {
    id: 'pitch-change',
    label: 'Pitch Change',
    points: [{ x: 150, y: 280 }, { x: 280, y: 280 }, { x: 360, y: 340 }, { x: 460, y: 340 }],
  },
  {
    id: 'drip-edge',
    label: 'Drip Edge',
    points: [{ x: 150, y: 250 }, { x: 150, y: 350 }, { x: 380, y: 350 }, { x: 420, y: 390 }],
  },
  {
    id: 'drip-edge-kick',
    label: 'Drip Edge with Kick',
    points: [
      { x: 150, y: 250 }, { x: 150, y: 350 }, { x: 380, y: 350 }, { x: 400, y: 370 }, { x: 430, y: 365 },
    ],
  },
  {
    id: 'hook-drip-edge',
    label: 'Hook Drip Edge',
    points: [
      { x: 150, y: 250 }, { x: 150, y: 350 }, { x: 380, y: 350 }, { x: 410, y: 380 },
      { x: 400, y: 400 }, { x: 380, y: 395 },
    ],
  },
  {
    id: 'sidewall',
    label: 'Sidewall',
    points: [
      { x: 200, y: 220 }, { x: 200, y: 300 }, { x: 260, y: 300 }, { x: 260, y: 340 }, { x: 340, y: 340 },
    ],
  },
  {
    id: 'head-wall',
    label: 'Head Wall',
    points: [
      { x: 200, y: 220 }, { x: 260, y: 220 }, { x: 260, y: 300 }, { x: 340, y: 300 }, { x: 340, y: 360 },
    ],
  },
  {
    id: 'ridge-cap-vented',
    label: 'Ridge Cap Vented',
    points: [
      { x: 170, y: 260 }, { x: 180, y: 280 }, { x: 300, y: 380 }, { x: 420, y: 280 }, { x: 430, y: 260 },
    ],
  },
  {
    id: 'counter',
    label: 'Counter',
    points: [{ x: 220, y: 200 }, { x: 220, y: 280 }, { x: 260, y: 300 }, { x: 260, y: 360 }],
  },
  {
    id: 'peak-wall',
    label: 'Peak Wall',
    points: [{ x: 200, y: 220 }, { x: 300, y: 340 }, { x: 400, y: 220 }],
  },
  {
    id: 'gutter',
    label: 'Gutter',
    points: [{ x: 150, y: 240 }, { x: 150, y: 380 }, { x: 420, y: 380 }, { x: 420, y: 300 }],
  },
  {
    id: 'valley',
    label: 'Valley',
    variants: [
      {
        id: 'valley-closed-rolled-hem',
        label: 'Closed / Rolled Hem',
        points: [{ x: 200, y: 200 }, { x: 300, y: 340 }, { x: 400, y: 200 }],
      },
      {
        id: 'valley-open-hook',
        label: 'Open Hook',
        points: [{ x: 200, y: 200 }, { x: 300, y: 340 }, { x: 400, y: 200 }, { x: 420, y: 220 }],
      },
      {
        id: 'valley-heavy-reinforced-closed-fold',
        label: 'Heavy Reinforced Closed Fold',
        points: [
          { x: 190, y: 200 }, { x: 210, y: 220 }, { x: 300, y: 340 }, { x: 390, y: 220 }, { x: 410, y: 200 },
        ],
      },
    ],
  },
  {
    id: 'coping-cap',
    label: 'Coping Cap',
    variants: [
      {
        id: 'coping-cap-2-piece-cleat',
        label: '2-Piece Cleat',
        points: [
          { x: 180, y: 200 }, { x: 180, y: 320 }, { x: 200, y: 320 }, { x: 200, y: 340 },
          { x: 400, y: 340 }, { x: 400, y: 320 }, { x: 420, y: 320 }, { x: 420, y: 200 },
        ],
      },
      {
        id: 'coping-cap-1-piece-cleat',
        label: '1-Piece Cleat',
        points: [
          { x: 180, y: 200 }, { x: 180, y: 320 }, { x: 200, y: 320 }, { x: 200, y: 340 },
          { x: 400, y: 340 }, { x: 400, y: 200 },
        ],
      },
      {
        id: 'coping-cap-face-cleat',
        label: 'Face Cleat',
        points: [
          { x: 180, y: 220 }, { x: 180, y: 320 }, { x: 200, y: 320 }, { x: 200, y: 340 },
          { x: 400, y: 340 }, { x: 400, y: 300 }, { x: 420, y: 280 },
        ],
      },
    ],
  },
];

// Templates are authored assuming a 600x600 canvas centered on (300,300) —
// matches CANVAS_MIN_WIDTH/HEIGHT and how worldToScreen places world (0,0)
// at the canvas center, so this is the same conversion in reverse at zoom 1.
const TEMPLATE_CANVAS_CENTER = 300;

function templatePointsToWorld(points: Point[]): Point[] {
  return points.map((p) => ({
    x: (p.x - TEMPLATE_CANVAS_CENTER) / PIXELS_PER_INCH,
    y: (p.y - TEMPLATE_CANVAS_CENTER) / PIXELS_PER_INCH,
  }));
}

// Part 1 — professional toolbar. Minimal stroke-only line icons (matches
// the site's existing icon style, e.g. app/studio/page.tsx's tab icons),
// not a licensed icon set — just enough to be recognizable.
const TOOLBAR_ICON_PATHS: Record<string, string> = {
  new: 'M5 3h9l5 5v13H5z M9 13h6M9 16h6',
  open: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  save: 'M4 4h13l3 3v13H4z M7 4v5h8V4 M6 14h12v6H6z',
  duplicate: 'M8 8h11v11H8z M5 16V6a1 1 0 011-1h10',
  editName: 'M4 20l1-5L16 4l4 4L9 19z M14 6l4 4',
  print: 'M6 9V3h12v6 M4 9h16v7H4z M7 14h10v7H7z',
  fitToScreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  center: 'M12 2v4M12 18v4M2 12h4M18 12h4 M12 9a3 3 0 100 6 3 3 0 000-6z',
  zoomOut: 'M10 4a6 6 0 100 12 6 6 0 000-12z M20 20l-5.5-5.5 M7 10h6',
  zoomIn: 'M10 4a6 6 0 100 12 6 6 0 000-12z M20 20l-5.5-5.5 M10 7v6M7 10h6',
  undo: 'M8 7L3 12l5 5 M3 12h11a6 6 0 010 12h-2',
  redo: 'M16 7l5 5-5 5 M21 12H10a6 6 0 000 12h2',
  rotateLeft: 'M4 12a8 8 0 1114 5.3 M4 17v-5h5',
  rotateRight: 'M20 12a8 8 0 10-14 5.3 M20 17v-5h-5',
  delete: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
};

function ToolbarIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={TOOLBAR_ICON_PATHS[name]} />
    </svg>
  );
}

// Standalone (not part of ToolbarIcon's named set below) since it's only
// ever used for the lock/unlock indicator and the Lock & Save button, not
// as a small toolbar icon button.
function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`py-1 px-2 rounded transition-colors ${
        active ? 'bg-afs-crimson text-white' : 'bg-afs-bg-raised text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white'
      } disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-afs-bg-raised disabled:hover:text-afs-chrome-mid`}
    >
      <span className="block" style={{ width: 14, height: 14 }}>
        <ToolbarIcon name={icon} />
      </span>
    </button>
  );
}

// Hem-type selector icon — renders the SAME drawHemGlyph function the main
// canvas draws with, on its own tiny canvas, so the popup buttons and the
// applied glyph can never drift apart the way the old hand-drawn SVG icon
// set (a hook/bar/dot that didn't match the real shapes) did.
//
// HEM_ICON_SIZE (24->34) and the R passed to drawHemGlyph were both bumped
// up together — previously the glyph occupied under a third of the icon's
// own footprint, reading as "a few illegible pixels" at actual button
// scale. Also now DPR-aware: the canvas backing store is sized at
// HEM_ICON_SIZE * devicePixelRatio physical pixels with a matching
// ctx.setTransform, so the glyph stays crisp on HiDPI displays instead of a
// low-res bitmap stretched up to fill the CSS box.
//
// HEM_ICON_GLYPH_R is an explicit multiple of the canonical HEM_GLYPH_R
// (imported from lib/flashdraft/hem-glyph.ts) rather than its own
// disconnected literal — same reasoning as app/studio/hem-debug/page.tsx's
// DEBUG_R below, and previously the two constants (13 here, HEM_GLYPH_R=6
// there) had no relationship at all, so an edit to one could silently
// drift from the other with nothing catching it.
const HEM_ICON_SIZE = 34;
const HEM_ICON_GLYPH_SCALE = 2;
const HEM_ICON_GLYPH_R = HEM_GLYPH_R * HEM_ICON_GLYPH_SCALE;
function HemGlyphIcon({ type }: { type: HemType }) {
  const iconCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = iconCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = HEM_ICON_SIZE * dpr;
    canvas.height = HEM_ICON_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, HEM_ICON_SIZE, HEM_ICON_SIZE);
    // angleRad=0 (local +x = screen +x). hem-glyph.ts's own coordinate
    // convention (see its file header) builds every shape spanning FROM
    // the tip OUTWARD into +x ONLY — confirmed for both branches: the
    // hook (drawHookGlyph) reaches a max local x of Lh = R*1.8, and the
    // teardrop reaches centerDist + bulbR = R*1.5 + R*0.6 = R*2.1 (its
    // bulb circle is centered at local x=R*1.5 with radius R*0.6). Anchor
    // the tip near the icon's LEFT edge, not the right — this used to
    // anchor at 0.68 (assuming -x-only shapes, which contradicted
    // hem-glyph.ts's actual +x convention even before the 2026-09-15
    // teardrop rework) and silently clipped almost the entire teardrop
    // bulb off the 34px-wide canvas (circle spanned local x=10.8..25.2,
    // i.e. canvas x=33.9..48.3 against a 34px-wide box) — the popup
    // icon rendered as just the two tangent lines (a "<" wedge), not a
    // teardrop, even though drawHemGlyph's own math was correct.
    // fitFraction leaves a small margin on both sides for HEM_ICON_GLYPH_R's
    // worst-case (teardrop) reach of R*2.1: at HEM_ICON_GLYPH_R=12 that's
    // 25.2px of a 34px-wide canvas, so anchoring the tip at 10% (3.4px)
    // leaves ~5.4px of margin on the right and ~3.4px on the left.
    const tipXFraction = 0.1;
    drawHemGlyph(ctx, { x: HEM_ICON_SIZE * tipXFraction, y: HEM_ICON_SIZE * 0.5 }, 0, type, HEM_ICON_GLYPH_R);
  }, [type]);
  return <canvas ref={iconCanvasRef} width={HEM_ICON_SIZE} height={HEM_ICON_SIZE} style={{ width: HEM_ICON_SIZE, height: HEM_ICON_SIZE }} />;
}

export default function FlashDraftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const jetbrainsFontRef = useRef<string>('monospace');
  // Guards the debounced autosave-write effect against firing with the
  // pre-restore initial state before the restore-on-mount effect (below)
  // has had a chance to run.
  const autosaveHydratedRef = useRef(false);

  useEffect(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--font-jetbrains').trim();
    jetbrainsFontRef.current = value ? `${value}, monospace` : 'monospace';
  }, []);

  const [points, setPoints] = useState<Point[]>([]);
  const [past, setPast] = useState<ProfileSnapshot[]>([]);
  const [future, setFuture] = useState<ProfileSnapshot[]>([]);

  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [segmentLengthInput, setSegmentLengthInput] = useState('');
  const [selectedBendPoint, setSelectedBendPoint] = useState<number | null>(null);
  const [bendRadiusInput, setBendRadiusInput] = useState('');
  const [angleInputDraft, setAngleInputDraft] = useState('');
  const [angleInputMode, setAngleInputMode] = useState<'angle' | 'length'>('angle');
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);

  // --- Leg dragging: drag any bend point or endpoint (including point 0
  // and the true last point) directly. The incoming leg (its fixed
  // opposite endpoint stays put) stretches/compresses to reach the new
  // position; everything downstream (later bend points and leg endpoints)
  // translates by the same delta, preserving every downstream leg's length
  // and angle — dragging doesn't activate until the pointer moves past
  // VERTEX_DRAG_THRESHOLD_PX, so a plain click still only selects the
  // vertex. Point 0 is the one structural exception: it has no leg before
  // it to anchor against, so it mirrors instead — only point 0 itself
  // moves, nothing translates. See clampDragAngle and the idx===0 branch
  // in handlePointerMove for the mirrored math (afs-sv-003). ---
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const draggingVertexOriginalPoints = useRef<Point[] | null>(null);
  const hasVertexDraggedRef = useRef(false);
  const vertexDragDownScreenRef = useRef<Point | null>(null);

  // Leg-body reshape (below) drives the SAME draggingVertexIndex machinery
  // as a direct vertex grab, but the cursor doesn't start on the vertex —
  // it starts wherever along the leg's body the user grabbed. Without
  // correction, the vertex-drag math (which snaps the vertex directly TO
  // the cursor's world position) would make the endpoint jump to the
  // cursor the instant the drag resolves, instead of moving by however far
  // the cursor has traveled. This offset — the vector from the grab point
  // to the endpoint's original position — is subtracted from the raw
  // cursor position before that same math runs, so the endpoint tracks the
  // cursor's movement while preserving where it was grabbed. Null for a
  // genuine vertex grab, where cursor ≈ vertex already and no correction
  // is needed.
  const legReshapeGrabOffsetRef = useRef<Point | null>(null);

  // --- Profile identity / save state (Part 2 / Part 5) ---
  const [profileName, setProfileName] = useState('Untitled Profile');
  const [editingName, setEditingName] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [revision, setRevision] = useState(1);
  const [savedProfileId, setSavedProfileId] = useState<string | null>(null);
  const [profileCategoryId, setProfileCategoryId] = useState<string | null>(null);
  const [profileSubcategory, setProfileSubcategory] = useState('');
  // Lock Profile & Save to Passport: once locked, every geometry-mutating
  // path (canvas drawing/dragging, hem edits, segment length/angle inputs,
  // rotate, delete, undo/redo) is guarded off at its own entry point below
  // -- this is the single source of truth all of them check. Phase 3
  // (afs-pp-001) made this a zero-friction, no-modal auto-save
  // (lockAndSaveProfile below) rather than routing through the Save modal
  // -- it still calls performSave's exact tested validation/DB-write path
  // via an explicit `lock` argument, just without ever opening the modal.
  const [isLocked, setIsLocked] = useState(false);
  // True for a few seconds right after a successful lock-and-save, so the
  // button can flash "Profile Saved & Locked" before settling into the
  // permanent "Profile Locked & Saved / Unlock to Edit" status row below --
  // the canvas itself stays locked (isLocked) the whole time; this is purely
  // the button's own transient confirmation text.
  const [justLocked, setJustLocked] = useState(false);
  // True once a profile has been loaded via ?loadPassport=<id> (Profile
  // Passport's "View in FlashDraft" / row-name link) — drives the
  // "← Back to Profiles" button and the "This profile is locked. View
  // only." banner. Deliberately NOT the same thing as isLocked: a user can
  // open an UNLOCKED profile from Profile Passport too (Editor/Admin roles
  // can still edit it there), in which case they came from Profile
  // Passport but the canvas isn't read-only -- only the Back button should
  // show, not the "view only" messaging or any extra edit restriction.
  const [viewingFromPassport, setViewingFromPassport] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [duplicateOnSave, setDuplicateOnSave] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [showMatched3DView, setShowMatched3DView] = useState(false);
  const [splitDismissed, setSplitDismissed] = useState(false);

  const [canvasSize, setCanvasSize] = useState({ width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<{ mouse: Point; pan: Point } | null>(null);
  const spacePressed = useRef(false);

  // --- Whole-profile move (afs-sv-004) ---
  // UX decision, made without direct user confirmation — documented here
  // per that constraint: Alt+drag (Option+drag on Mac), held anywhere on
  // the canvas while a profile exists, translates every point together as
  // one rigid body. This mirrors the file's own existing modifier-key
  // convention rather than inventing a new one: spacePressed above already
  // reserves a held key to mean "this drag pans the view, not editing" —
  // Alt+drag applies that identical pattern to a second, equally
  // unambiguous meaning ("this drag moves the whole profile, not one leg")
  // instead of adding a separate mode-toggle button to the toolbar.
  // Checked FIRST in handlePointerDown, before any vertex/segment
  // hit-testing, so it can never be confused with — or fall through from —
  // grabbing an endpoint or a leg body; those gestures only ever arm when
  // Alt is NOT held. A plain drag on empty canvas (no Alt held) is
  // completely unchanged: it still extends the profile with a new segment
  // exactly as it did before this feature (see the fallback branch at the
  // end of handlePointerDown) — this gesture never touches that path.
  // Because every point moves by the identical (dx, dy) world-space delta,
  // no leg length and no bend angle can change from this gesture — and
  // therefore neither can the derived blank width (see blankWidthInLive
  // further down, computed purely from pairwise point distances) — this is
  // structurally guaranteed by the translation math itself, not a
  // separate check.
  const altPressed = useRef(false);
  const [isMovingProfile, setIsMovingProfile] = useState(false);
  const moveProfileOriginRef = useRef<{ mouse: Point; points: Point[] } | null>(null);
  const hasMovedProfileRef = useRef(false);

  // --- Prepend a new leg from the free end of the FIRST leg (afs-sv-005) ---
  // Mirror of the "click near the last point continues the line" gesture
  // below, which always APPENDS. Point 0 can't reuse that exact mechanism:
  // unlike the true last point (deliberately excluded from hitTestVertex so
  // grabbing it means "extend"), point 0 IS a fully hit-testable, directly
  // draggable vertex (afs-sv-003 — grabbing it moves it in place). There is
  // no empty hit-radius left at point 0's own screen position where a plain
  // click/drag could unambiguously mean "start a new leg" instead of "move
  // this one." Resolved the same way afs-sv-004 resolved an equivalent
  // ambiguity for whole-profile move: reuse this file's existing
  // modifier-key-for-a-distinct-drag-meaning convention (spacePressed ->
  // pan, altPressed -> whole-move) instead of inventing a new interaction
  // paradigm or touching hitTestVertex/the sv-003 fix. Shift+drag anywhere
  // on the canvas (checked before vertex/segment hit-testing, so it always
  // takes priority) arms the exact same click-and-drag-drawing state
  // (dragAnchorRef/isDragDrawing/dragPreview) the append gesture uses, just
  // anchored at points[0] instead of the last point — prependDragRef is the
  // only new piece of state, recording which end the live preview and the
  // eventual commit should extend from.
  const shiftPressed = useRef(false);
  const prependDragRef = useRef(false);

  // --- Click-and-drag drawing state ---
  const dragAnchorRef = useRef<Point | null>(null);
  const dragDownScreenRef = useRef<Point | null>(null);
  const [isDragDrawing, setIsDragDrawing] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ point: Point; length: number; angleDeg: number } | null>(null);
  const [dragScreenPos, setDragScreenPos] = useState<Point | null>(null);

  // --- Hem tool state ---
  const [hemStart, setHemStart] = useState<Hem | null>(null);
  const [hemEnd, setHemEnd] = useState<Hem | null>(null);
  const [hemPopup, setHemPopup] = useState<{ endpoint: HemEndpoint; screenPos: Point } | null>(null);
  const [hemLengthDraft, setHemLengthDraft] = useState(String(HEM_DEFAULT_LENGTH_IN));
  const [hemGapDraft, setHemGapDraft] = useState(String(HEM_DEFAULT_GAP_IN_OPEN));

  // Template that opened VariantPicker (Coping Cap / Valley) — null when
  // the picker is closed. See PROFILE_TEMPLATES' `variants` field.
  const [variantPickerTemplate, setVariantPickerTemplate] = useState<ProfileTemplate | null>(null);

  // A drag starting on a leg's BODY (not its endpoints) reshapes the leg by
  // dragging its far endpoint, via the existing vertex-drag machinery
  // (draggingVertexIndex) rather than a separate code path. See the
  // disambiguation block in handlePointerMove.
  const legBodyDragCandidateRef = useRef<{
    legIndex: number;
    clickPoint: Point;
    distanceFromStartIn: number;
    downScreenPos: Point;
    towardStart: Point;
  } | null>(null);

  // A pointerdown that lands near the LAST point is ambiguous, same as a
  // vertex hit or a leg-body hit above: it could be the start of "continue
  // the line" (drag away to extend), or it could just be a plain click
  // meaning "select this vertex/segment." Deferring the decision until real
  // movement is seen (same VERTEX_DRAG_THRESHOLD_PX pattern the two
  // candidate refs above already use) fixes a real bug — previously this
  // branch armed isDragDrawing immediately, with no threshold at all, so an
  // ordinary click with only a few pixels of unavoidable mouse jitter (any
  // real mouse, not a synthetic zero-movement click) was silently
  // interpreted as "extend the line," appending a whole new leg the user
  // never intended to draw. Confirmed live: clicking a leg near its free
  // end to select it instead silently grew the profile (a second leg
  // appearing, blank width jumping) with no drag gesture the user was
  // consciously performing.
  const continueLineCandidateRef = useRef<{ anchor: Point; downScreenPos: Point; prepend: boolean } | null>(null);

  const [material, setMaterial] = useState('');
  const [gauge, setGauge] = useState('');
  const [color, setColor] = useState('');
  const [finish, setFinish] = useState<AluminumFinish | ''>('');
  const [lengthFeet, setLengthFeet] = useState('9');
  const [lengthInches, setLengthInches] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  // Job-identity intake fields (migration 018, afs-jf-000) — all optional,
  // never block submit (afs-jf-003). `requestedBy` retired by migration 019
  // (afs-jf-004, afs-jf-005) — replaced by `jobName` + `requestedDeliveryDate`.
  const [clientBusinessName, setClientBusinessName] = useState('');
  const [clientName, setClientName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [jobName, setJobName] = useState('');
  // Plain YYYY-MM-DD string matching the native <input type="date"> value
  // format (afs-jf-005) — no date-picker library exists in this project.
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  // Collapsed by default so the canvas info overlay stays compact when the
  // job-identity fields aren't in use (afs-jf-005). Now drives a right-side
  // slide-out drawer instead of an inline downward expansion (afs-jf-006).
  const [showJobInfo, setShowJobInfo] = useState(false);
  // Lets the whole upper-left name/stats box be dismissed via its own X
  // (afs-jf-006) — collapsing it is purely a display toggle (drawing/state
  // is untouched); a small pill re-opens it. Separate from showJobInfo so
  // dismissing the box doesn't fight with the drawer's own open/close state.
  const [profileBoxCollapsed, setProfileBoxCollapsed] = useState(false);

  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [topMatchDiagramBends, setTopMatchDiagramBends] = useState<DiagramBend[] | null>(null);
  const lastTopMatchIdRef = useRef<string | null>(null);

  const [viewerBends, setViewerBends] = useState<ProfileBend[]>(PLACEHOLDER_COPING_CAP_BENDS);
  const [viewerBlankWidthMm, setViewerBlankWidthMm] = useState(PLACEHOLDER_BLANK_WIDTH_MM);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // True only when FlashDraft was opened from Command Center (the
  // top-nav link, or a specific job's "Open in FlashDraft" link) --
  // NOT simply whenever an admin-role user happens to visit this
  // otherwise-public page directly. Gates "Send to PathfinderEdge"
  // together with isAdmin (Phase 3b) so that button no longer appears in
  // customer-visible FlashDraft just because the signed-in user has the
  // admin role.
  const [adminContext, setAdminContext] = useState(false);
  const [pathfinderState, setPathfinderState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [pathfinderMessage, setPathfinderMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

  const [showSavedProfiles, setShowSavedProfiles] = useState(false);
  const [savedProfilesLoading, setSavedProfilesLoading] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<SavedQuoteProfile[]>([]);

  const [show3DConfirm, setShow3DConfirm] = useState(false);
  const [confirmedPaintFace, setConfirmedPaintFace] = useState<PaintFace | null>(null);
  // Early 2D paint-face decision (afs-fl-013) — lifted out of
  // SubmitConfirmation3DModal's own local state so a choice made here in
  // the 2D sidebar carries through as that modal's starting value instead
  // of always resetting to 'up' at final submit confirmation.
  const [paintFace, setPaintFace] = useState<PaintFace>('up');

  const gaugeOptions = material ? GAUGES_BY_MATERIAL[material] ?? [] : [];
  // 'painted_steel' materials always require a McElroy color selection.
  // 'aluminum' materials require a Finish choice first (afs-jf-002,
  // supersedes afs-cv-002's blanket "aluminum always means PAC-CLAD"
  // ruling) — see lib/data/material-color-requirement.ts.
  const isAluminum = material ? requiresFinishChoice(material) : false;
  const colorPalette = material ? colorPaletteForMaterial(material, finish || null) : null;
  const colorSatisfied = isColorRequirementSatisfied(material, finish || null, color);
  // Real customer-selected paint face/color (afs-fl-013) — drives the early
  // 2D sidebar toggle, the 2D canvas stripe, and both 3D modals, replacing
  // the old material-name-guessed swatch.
  const isPainted = material ? isPaintedMaterial(material) : false;
  const paintFaceSelectable = isPainted && color.trim() !== '';
  const resolvedPaintColor = resolveSelectedPaintColor(material, color);
  const lengthFtDecimal = (Number(lengthFeet) || 0) + (Number(lengthInches) || 0) / 12;
  const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;

  // Autosave restore — runs once on mount, before the loadProfile/loadCanonical
  // handoff effect below, so an explicit "Load into FlashDraft" (from the
  // machine library, Saved Profiles, or the canonical-profile handoff) always
  // overwrites whatever this restores, exactly as it would overwrite anything
  // else already on the canvas.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AutosaveState>;
        if (isPointArrayShape(saved.points) && isHemShape(saved.hemStart) && isHemShape(saved.hemEnd)) {
          setPoints(saved.points);
          setHemStart(saved.hemStart ?? null);
          setHemEnd(saved.hemEnd ?? null);
          if (typeof saved.material === 'string') setMaterial(saved.material);
          if (typeof saved.gauge === 'string') setGauge(saved.gauge);
          if (typeof saved.color === 'string') setColor(saved.color);
          if (isAluminumFinishShape(saved.finish)) setFinish(saved.finish);
          if (typeof saved.lengthFeet === 'string') setLengthFeet(saved.lengthFeet);
          if (typeof saved.lengthInches === 'string') setLengthInches(saved.lengthInches);
          if (typeof saved.quantity === 'string') setQuantity(saved.quantity);
          if (typeof saved.notes === 'string') setNotes(saved.notes);
          if (typeof saved.clientBusinessName === 'string') setClientBusinessName(saved.clientBusinessName);
          if (typeof saved.clientName === 'string') setClientName(saved.clientName);
          if (typeof saved.poNumber === 'string') setPoNumber(saved.poNumber);
          if (typeof saved.jobName === 'string') setJobName(saved.jobName);
          if (typeof saved.requestedDeliveryDate === 'string') setRequestedDeliveryDate(saved.requestedDeliveryDate);
        }
      }
    } catch {
      // Corrupt entry or localStorage blocked — start with a clean canvas.
    } finally {
      autosaveHydratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave write — debounced ~500ms after the last change to any part of
  // the profile model, so it does not thrash on every mouse-move while
  // dragging. Guarded on autosaveHydratedRef so the restore effect above
  // always wins the race against this one writing back the pre-restore
  // (empty) initial state. Cleared ONLY by clearCanvas() (Clear button) and
  // on a successful submitQuoteRequest() — never by this effect, so simple
  // navigation away or a refresh always leaves the last autosaved state
  // intact for the restore effect to pick back up.
  useEffect(() => {
    if (!autosaveHydratedRef.current) return;
    const timeout = window.setTimeout(() => {
      try {
        const state: AutosaveState = {
          points,
          hemStart,
          hemEnd,
          material,
          gauge,
          color,
          finish,
          lengthFeet,
          lengthInches,
          quantity,
          notes,
          clientBusinessName,
          clientName,
          poNumber,
          jobName,
          requestedDeliveryDate,
        };
        window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(state));
      } catch {
        // Best-effort — browser may be blocking local storage.
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [
    points,
    hemStart,
    hemEnd,
    material,
    gauge,
    color,
    finish,
    lengthFeet,
    lengthInches,
    quantity,
    notes,
    clientBusinessName,
    clientName,
    poNumber,
    jobName,
    requestedDeliveryDate,
  ]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
      // One of two gates on the "Send to PathfinderEdge" button (the other
      // is adminContext, above) — this page is otherwise public (no login
      // required to draw/match a profile), so the button itself must not
      // even render for a non-admin; the route re-checks the same role
      // server-side regardless. isAdmin alone used to be the only gate
      // (Phase 3b removed that — see adminContext's own comment).
      if (!data.user) return;
      supabase
        .from('profiles')
        .select('role, company')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          setIsAdmin(profile?.role === 'admin');
          // afs-jf-008 — auto-populate Business Name from the account's
          // profile, but only into an empty field: a functional update
          // reads state as of whenever this network round-trip resolves,
          // so it never clobbers a value the autosave-restore effect above
          // already put there, or one the user has since typed.
          if (profile?.company) {
            setClientBusinessName((prev) => prev || profile.company);
          }
        });
    });
  }, []);

  // --- Canvas fills all remaining space in its wrapper (Part 2A) ---
  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setCanvasSize({
        width: Math.max(CANVAS_MIN_WIDTH, Math.floor(entry.contentRect.width)),
        height: Math.max(CANVAS_MIN_HEIGHT, Math.floor(entry.contentRect.height)),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commitPoints = useCallback(
    (newPoints: Point[]) => {
      setPast((p) => [...p, { points, hemStart, hemEnd }]);
      setFuture([]);
      setPoints(newPoints);
      setSelectedSegment(null);
    },
    [points, hemStart, hemEnd]
  );

  // Refactored from the previous version, which nested every side-effecting
  // setState call (setPoints, setHemStart, ...) INSIDE the functional
  // updater passed to setPast/setFuture — a real anti-pattern (updaters are
  // supposed to be pure; React 18 StrictMode's dev-only double-invocation
  // of updaters exists specifically to catch this) even though it wasn't
  // the cause of the actual bug found live (see applySegmentLength's own
  // comment for that). Now the updater passed to setPast/setFuture only
  // ever computes the next array; every other setter is called once, at
  // undo/redo's own top level.
  const undo = useCallback(() => {
    if (isLocked || past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture((f) => [{ points, hemStart, hemEnd }, ...f]);
    setPast((p) => p.slice(0, -1));
    setPoints(prev.points);
    setHemStart(prev.hemStart);
    setHemEnd(prev.hemEnd);
    setSelectedSegment(null);
  }, [isLocked, past, points, hemStart, hemEnd]);

  const redo = useCallback(() => {
    if (isLocked || future.length === 0) return;
    const next = future[0];
    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture((f) => f.slice(1));
    setPoints(next.points);
    setHemStart(next.hemStart);
    setHemEnd(next.hemEnd);
    setSelectedSegment(null);
  }, [isLocked, future, points, hemStart, hemEnd]);

  const getEffectiveRadius = useCallback(
    (i: number): number => points[i]?.radius ?? defaultBendRadiusIn(material),
    [points, material]
  );

  const applyBendRadius = useCallback((i: number, radiusIn: number) => {
    const clamped = Math.max(MIN_BEND_RADIUS_IN, Math.min(MAX_BEND_RADIUS_IN, radiusIn));
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, radius: clamped } : p)));
  }, []);

  useEffect(() => {
    if (selectedBendPoint === null) return;
    const value = getEffectiveRadius(selectedBendPoint);
    setBendRadiusInput(value.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBendPoint, points]);

  // Part 8 — syncs the angle panel's numeric field to the selected bend
  // point's live signed angle (mirrors the bendRadiusInput sync above).
  useEffect(() => {
    if (selectedBendPoint === null) return;
    const prevPt = points[selectedBendPoint - 1];
    const curr = points[selectedBendPoint];
    const next = points[selectedBendPoint + 1];
    if (!prevPt || !curr || !next) return;
    const v1 = { x: prevPt.x - curr.x, y: prevPt.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    setAngleInputDraft(signedAngleBetween(v1, v2).toFixed(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBendPoint, points]);

  // Syncs the segment-length field to the selected leg's live length (same
  // pattern as the two effects above) — without this, a leg reshaped by
  // dragging its body left the field showing whatever length it had at the
  // moment it was clicked, stale the instant the drag changed the leg's
  // actual length.
  useEffect(() => {
    if (selectedSegment === null) return;
    const a = points[selectedSegment];
    const b = points[selectedSegment + 1];
    if (!a || !b) return;
    setSegmentLengthInput(`${dist(a, b).toFixed(3)}"`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment, points]);

  // --- Keyboard shortcuts: undo/redo, space-to-pan, escape closes hem popup,
  // delete/backspace removes the selected point or segment (skipped while
  // focus is in a text field, so typing in Notes/Profile Name still works) ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spacePressed.current = true;
      }
      if (e.key === 'Alt') {
        altPressed.current = true;
      }
      if (e.key === 'Shift') {
        shiftPressed.current = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        setHemPopup(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isLocked) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        if (selectedBendPoint !== null) {
          e.preventDefault();
          commitPoints(points.filter((_, i) => i !== selectedBendPoint));
          setSelectedBendPoint(null);
        } else if (selectedSegment !== null) {
          e.preventDefault();
          commitPoints(points.filter((_, i) => i !== selectedSegment + 1));
          setSelectedSegment(null);
        }
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spacePressed.current = false;
      if (e.key === 'Alt') altPressed.current = false;
      if (e.key === 'Shift') shiftPressed.current = false;
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo, points, selectedBendPoint, selectedSegment, commitPoints, isLocked]);

  // --- Coordinate conversion ---
  // Reads canvas size via getBoundingClientRect() (always CSS/logical
  // pixels, regardless of devicePixelRatio) rather than canvas.width/height
  // — now that the draw effect below sizes the backing store at
  // devicePixelRatio physical pixels per CSS pixel, canvas.width/height
  // report the PHYSICAL size, which would silently put every world<->screen
  // conversion (and therefore every hit-test, drag, and render position) off
  // by a factor of the display's DPR.
  const worldToScreen = useCallback(
    (p: Point, canvas: HTMLCanvasElement): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: p.x * PIXELS_PER_INCH * zoom + pan.x + rect.width / 2,
        y: p.y * PIXELS_PER_INCH * zoom + pan.y + rect.height / 2,
      };
    },
    [zoom, pan]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, canvas: HTMLCanvasElement): Point => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (sx - rect.width / 2 - pan.x) / (PIXELS_PER_INCH * zoom),
        y: (sy - rect.height / 2 - pan.y) / (PIXELS_PER_INCH * zoom),
      };
    },
    [zoom, pan]
  );

  // --- Draw loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR-aware backing store — same pattern already used by HemGlyphIcon
    // and app/studio/hem-debug/page.tsx's canvases. Without this the
    // backing store has exactly 1 physical pixel per CSS pixel regardless
    // of screen density, so on any devicePixelRatio > 1 display (virtually
    // every modern screen) the ENTIRE canvas — not just hem glyphs — is a
    // low-res bitmap stretched to fill its CSS box, softer than it needs
    // to be. Only resizes the backing store when the target physical size
    // actually changed — this effect re-runs on every points/zoom/pan
    // change (many times during a single drag), and resizing a canvas's
    // width/height always clears its bitmap, so doing that unconditionally
    // would be wasted work and a visible flash on every frame.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    const targetWidth = Math.round(cssWidth * dpr);
    const targetHeight = Math.round(cssHeight * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Every drawing call below is now in CSS-pixel-equivalent space (the
    // setTransform above scales it up to match the physical backing
    // store), so bounds/positions use cssWidth/cssHeight — the logical
    // size — never canvas.width/canvas.height, which are now the physical
    // (DPR-multiplied) backing-store dimensions.
    // Segment lines, painted-side stripe, points, angle arcs, hem folds/
    // glyphs, and every label among them are drawn by the shared
    // drawProfileScene (lib/flashdraft/draw-profile-scene.ts) — the exact
    // same function the offscreen shop-snapshot render calls at submit time
    // (see renderShopSnapshotDataUri in sendToPathfinder/submitQuoteRequest
    // below), just with LIVE_CANVAS_LABEL_STYLE's small label sizes and this
    // draw pass's real interactive state. Visual output here is unchanged
    // from before afs-fl-017.
    drawProfileScene({
      ctx,
      cssWidth,
      cssHeight,
      points,
      hemStart,
      hemEnd,
      worldToScreen: (p) => worldToScreen(p, canvas),
      fontFamily: jetbrainsFontRef.current,
      pixelsPerInch: PIXELS_PER_INCH,
      zoom,
      pan,
      gauge,
      thicknessIn,
      getEffectiveRadius,
      isGauge18OrThicker,
      signedAngleBetween,
      colors: CANVAS_COLORS,
      labelStyle: LIVE_CANVAS_LABEL_STYLE,
      interaction: {
        selectedSegment,
        hoveredSegment,
        draggingVertexIndex,
        hoveredVertex,
        selectedBendPoint,
        isDragDrawing,
        dragPreviewPoint: dragPreview?.point ?? null,
        dragAnchor: dragAnchorRef.current,
        prependDrag: prependDragRef.current,
      },
      paint: paintFaceSelectable ? { paintFace, resolvedPaintColor } : undefined,
    });
  }, [
    points,
    selectedSegment,
    hoveredSegment,
    zoom,
    pan,
    worldToScreen,
    isDragDrawing,
    dragPreview,
    gauge,
    thicknessIn,
    getEffectiveRadius,
    hoveredVertex,
    selectedBendPoint,
    hemStart,
    hemEnd,
    draggingVertexIndex,
    viewMode,
    paintFaceSelectable,
    paintFace,
    resolvedPaintColor,
  ]);

  // --- Debounced profile matching ---
  useEffect(() => {
    if (points.length < 3) {
      setMatches([]);
      setTopMatchDiagramBends(null);
      return;
    }
    const handle = setTimeout(async () => {
      setMatchLoading(true);
      try {
        const bends = [];
        let blankWidth = 0;
        for (let i = 1; i < points.length - 1; i++) {
          bends.push({
            angle: bendAngleAt(points[i - 1], points[i], points[i + 1]),
            leftLeg: dist(points[i - 1], points[i]),
            rightLeg: dist(points[i], points[i + 1]),
          });
        }
        for (let i = 0; i < points.length - 1; i++) {
          blankWidth += dist(points[i], points[i + 1]);
        }
        blankWidth += hemAllowanceIn(hemStart, thicknessIn) + hemAllowanceIn(hemEnd, thicknessIn);
        const res = await fetch('/api/studio/match-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bends, blankWidth }),
        });
        if (res.ok) {
          const data = (await res.json()) as { matches: ProfileMatch[]; topMatchDiagramBends: DiagramBend[] | null };
          const nextMatches = data.matches ?? [];
          setMatches(nextMatches);
          setTopMatchDiagramBends(data.topMatchDiagramBends ?? null);
          const nextTopId = nextMatches[0]?.profileId ?? null;
          if (nextTopId !== lastTopMatchIdRef.current) {
            lastTopMatchIdRef.current = nextTopId;
            setSplitDismissed(false);
          }
        }
      } catch {
        // Non-critical — matching is a helper panel, not a required step.
      } finally {
        setMatchLoading(false);
      }
    }, MATCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [points, hemStart, hemEnd, thicknessIn]);

  // --- Debounced 3D-confirmation-modal sync (mirrors the profile-match bend shape, in mm) ---
  useEffect(() => {
    if (points.length < 2) {
      const handle = setTimeout(() => {
        setViewerBends(PLACEHOLDER_COPING_CAP_BENDS);
        setViewerBlankWidthMm(PLACEHOLDER_BLANK_WIDTH_MM);
      }, VIEWER_DEBOUNCE_MS);
      return () => clearTimeout(handle);
    }
    const handle = setTimeout(() => {
      const bends: ProfileBend[] = [];
      for (let i = 1; i < points.length - 1; i++) {
        bends.push({
          angle: bendAngleAt(points[i - 1], points[i], points[i + 1]),
          leftLeg: dist(points[i - 1], points[i]) * MM_PER_INCH,
          rightLeg: dist(points[i], points[i + 1]) * MM_PER_INCH,
          radius: (points[i].radius ?? defaultBendRadiusIn(material)) * MM_PER_INCH,
        });
      }
      let blankWidth = 0;
      for (let i = 0; i < points.length - 1; i++) {
        blankWidth += dist(points[i], points[i + 1]) * MM_PER_INCH;
      }
      blankWidth += (hemAllowanceIn(hemStart, thicknessIn) + hemAllowanceIn(hemEnd, thicknessIn)) * MM_PER_INCH;
      // A single segment (no interior bend point yet) still has a real
      // blank width — represent it as one "bend" with a straight 180° angle
      // so the extrusion renders a flat strip instead of staying empty.
      if (bends.length === 0 && points.length === 2) {
        bends.push({ leftLeg: blankWidth, rightLeg: 0, angle: 180, radius: 0 });
      }
      setViewerBends(bends);
      setViewerBlankWidthMm(blankWidth);
    }, VIEWER_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [points, material, hemStart, hemEnd, thicknessIn]);

  // --- Pointer handlers (mouse + touch via the Pointer Events API) ---
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Context-sensitive hit-testing — there is no separate draw/select/erase
  // mode anymore: a click on empty space extends the line, a click on an
  // existing vertex or segment selects it, and deletion happens only via
  // the toolbar's Delete action on whatever is currently selected.
  const hitTestVertex = useCallback(
    (screenPos: Point, canvas: HTMLCanvasElement): number | null => {
      let hit: number | null = null;
      let minDist = ANGLE_ARC_HIT_PX;
      // Starts at 0, not 1: point 0 (the first leg's start) is a fully
      // draggable endpoint exactly like every interior bend point — see the
      // `mirrored` branch of clampDragAngle and the idx===0 branch of the
      // draggingVertexIndex handler in handlePointerMove for the matching
      // drag math. Excluding it here was the root cause of the first leg
      // being undraggable at that end (afs-sv-003): a click there fell
      // through to the leg-0 body-drag path, which always drags the FAR
      // vertex (point 1), stretching the leg instead of moving point 0.
      //
      // Still stops at points.length - 1 (the LAST point stays excluded):
      // a click near it is deliberately claimed by the "continue drawing
      // from the last point" gesture in handlePointerDown, checked before
      // segment hit-testing — see that gesture's own comment. That gesture
      // is keyed specifically to points.length - 1, not point 0, so it has
      // no bearing on including point 0 here.
      for (let i = 0; i < points.length - 1; i++) {
        const center = worldToScreen(points[i], canvas);
        const d = Math.hypot(screenPos.x - center.x, screenPos.y - center.y);
        if (d < minDist) {
          minDist = d;
          hit = i;
        }
      }
      return hit;
    },
    [points, worldToScreen]
  );

  const hitTestSegmentAt = useCallback(
    (screenPos: Point, canvas: HTMLCanvasElement): number | null => {
      let hit: number | null = null;
      let minDist = HIT_RADIUS_PX;
      for (let i = 0; i < points.length - 1; i++) {
        const a = worldToScreen(points[i], canvas);
        const b = worldToScreen(points[i + 1], canvas);
        const d = distanceToSegment(screenPos, a, b);
        if (d < minDist) {
          minDist = d;
          hit = i;
        }
      }
      return hit;
    },
    [points, worldToScreen]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Locked profile: the canvas itself also gets pointerEvents: 'none'
    // (see the <canvas> style below) so this normally never even fires --
    // this guard is defense in depth against that CSS being bypassed some
    // other way, matching this file's own existing "defense in depth"
    // pattern (see handlePointerMove's dragStateArmed comment).
    if (isLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const screenPos = getPointerPos(e);

    if (e.button === 1 || spacePressed.current) {
      setIsPanning(true);
      panOrigin.current = { mouse: screenPos, pan };
      return;
    }
    if (e.button !== 0) return;

    // Reset every time — prevents a stale candidate from a previous
    // gesture leaking in.
    legBodyDragCandidateRef.current = null;
    legReshapeGrabOffsetRef.current = null;
    continueLineCandidateRef.current = null;
    prependDragRef.current = false;

    // Whole-profile move (afs-sv-004) — see the doc comment on
    // isMovingProfile's declaration above for why Alt+drag was chosen.
    // Checked before any vertex/segment hit-testing so it always takes
    // priority, regardless of whether the drag starts on empty canvas, on
    // a vertex, or on a leg body — none of those branches below ever run
    // while Alt is held.
    if (altPressed.current && points.length > 0) {
      setIsMovingProfile(true);
      moveProfileOriginRef.current = { mouse: screenPos, points };
      hasMovedProfileRef.current = false;
      setSelectedBendPoint(null);
      setSelectedSegment(null);
      canvas.style.cursor = MOVE_CURSOR;
      return;
    }

    // Prepend a new leg from point 0's free end (afs-sv-005) — see the doc
    // comment on prependDragRef's declaration for why Shift+drag was
    // chosen. Checked before vertex/segment hit-testing (same priority as
    // the Alt branch above) so it always wins over grabbing point 0
    // directly to move it — that gesture (afs-sv-003) only ever runs while
    // Shift is NOT held. Arms the same click-and-drag-drawing state the
    // append gesture (below, "click near the LAST point") uses, anchored
    // at points[0] instead; the anchor and preview point are only ever
    // read from live state at commit time (see handlePointerUp), so
    // exactly where on the canvas this drag starts doesn't matter, mirror
    // of how Alt+drag above works "anywhere on the canvas."
    if (shiftPressed.current && points.length > 0) {
      setSelectedBendPoint(null);
      setSelectedSegment(null);
      const anchor = points[0];
      dragAnchorRef.current = anchor;
      dragDownScreenRef.current = screenPos;
      prependDragRef.current = true;
      setIsDragDrawing(true);
      setDragPreview({ point: anchor, length: 0, angleDeg: 0 });
      setDragScreenPos(screenPos);
      return;
    }

    const vertexHit = hitTestVertex(screenPos, canvas);
    if (vertexHit !== null) {
      // Point 0 is a draggable endpoint, not a bend vertex — it has no leg
      // before it, so no angle and no bend radius to edit. Unlike an
      // interior hit, it never becomes the Angle/Bend Radius panel's
      // selectedBendPoint (that panel assumes a point with a leg on each
      // side — see applyBendAngle/selectAdjacentBendPoint, which already
      // only ever operate on indices 1..points.length-2).
      setSelectedBendPoint(vertexHit === 0 ? null : vertexHit);
      setSelectedSegment(null);
      setDraggingVertexIndex(vertexHit);
      draggingVertexOriginalPoints.current = points;
      hasVertexDraggedRef.current = false;
      vertexDragDownScreenRef.current = screenPos;
      return;
    }

    if (points.length === 0) {
      // Same click-drag-release gesture every subsequent point uses: arm
      // drag-drawing from the click position rather than committing it as a
      // static point immediately. A plain click (no drag) still places just
      // that first point on release below; a click-drag-release places the
      // first two points in one continuous gesture, matching how dragging
      // from an already-placed last point behaves.
      const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
      dragAnchorRef.current = raw;
      setIsDragDrawing(true);
      setDragPreview({ point: raw, length: 0, angleDeg: 0 });
      setDragScreenPos(screenPos);
      return;
    }

    // A click/drag near the LAST point is ambiguous, same as the vertex and
    // leg-body hits above: it might be the start of "continue the line"
    // (drag away to extend), or it might just be a plain click meaning
    // "select this." Recorded as a deferred candidate (see
    // continueLineCandidateRef's own comment) rather than committing to
    // "continue the line" immediately — falls through to the normal
    // segment hit-testing below, which finds this same segment (the last
    // point sits exactly on the last segment too), so a plain click here
    // selects it exactly like clicking anywhere else on the profile.
    const lastScreen = worldToScreen(points[points.length - 1], canvas);
    const distToLast = Math.hypot(screenPos.x - lastScreen.x, screenPos.y - lastScreen.y);
    if (distToLast <= HIT_RADIUS_PX) {
      continueLineCandidateRef.current = { anchor: points[points.length - 1], downScreenPos: screenPos, prepend: false };
    }

    const segmentHit = hitTestSegmentAt(screenPos, canvas);
    if (segmentHit !== null) {
      setSelectedSegment(segmentHit);
      setSelectedBendPoint(null);
      setSegmentLengthInput(`${dist(points[segmentHit], points[segmentHit + 1]).toFixed(3)}"`);

      // Arm a candidate for the leg-body reshape drag — resolved once, at
      // the first sign of real movement, in handlePointerMove (same
      // deferred-decision pattern the vertex-hit branch uses for its own
      // drag). A plain click (no drag) never resolves this candidate, so
      // click-to-select above is unaffected.
      const legA = points[segmentHit];
      const legB = points[segmentHit + 1];
      const legLenIn = dist(legA, legB);
      if (legLenIn > 0) {
        const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
        const t = Math.max(
          0,
          Math.min(1, ((raw.x - legA.x) * (legB.x - legA.x) + (raw.y - legA.y) * (legB.y - legA.y)) / (legLenIn * legLenIn))
        );
        const clickPoint = { x: legA.x + (legB.x - legA.x) * t, y: legA.y + (legB.y - legA.y) * t };
        legBodyDragCandidateRef.current = {
          legIndex: segmentHit,
          clickPoint,
          distanceFromStartIn: t * legLenIn,
          downScreenPos: screenPos,
          towardStart: unitVector(legB, legA),
        };
      }
      return;
    }

    // Guard against the near-miss artifact: a click that isn't quite close
    // enough to register as a vertex/segment hit above, but is still close
    // to the existing profile, is almost certainly a failed grab — not an
    // intentional "click empty space to draw a new segment." See
    // NEW_SEGMENT_MISS_GUARD_PX's own comment for why silently starting a
    // new line here was a real bug, not just a cosmetic one.
    for (let i = 0; i < points.length - 1; i++) {
      const segA = worldToScreen(points[i], canvas);
      const segB = worldToScreen(points[i + 1], canvas);
      if (distanceToSegment(screenPos, segA, segB) < NEW_SEGMENT_MISS_GUARD_PX) {
        setSelectedBendPoint(null);
        setSelectedSegment(null);
        return;
      }
    }

    setSelectedBendPoint(null);
    setSelectedSegment(null);
    const anchor = points[points.length - 1];
    dragAnchorRef.current = anchor;
    setIsDragDrawing(true);
    setDragPreview({ point: anchor, length: 0, angleDeg: 0 });
    setDragScreenPos(screenPos);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenPos = getPointerPos(e);

    // Defense in depth against any stray-armed-state bug in this class
    // (see handlePointerUp's doc comment): every gesture below is driven
    // purely by cursor position, with no check that a mouse button is
    // actually held. If some future change (or an already-fixed one)
    // leaves a candidate/drag ref armed with no button down, this makes
    // that a no-op — mere cursor movement — instead of a live drag,
    // regardless of root cause. Finalizes/cancels via the same shared path
    // a real release would use, so nothing is left half-committed.
    const dragStateArmed =
      isPanning ||
      isMovingProfile ||
      draggingVertexIndex !== null ||
      legBodyDragCandidateRef.current !== null ||
      continueLineCandidateRef.current !== null ||
      isDragDrawing;
    if (e.buttons === 0 && dragStateArmed) {
      handlePointerUp();
      return;
    }

    if (isPanning && panOrigin.current) {
      setPan({
        x: panOrigin.current.pan.x + (screenPos.x - panOrigin.current.mouse.x),
        y: panOrigin.current.pan.y + (screenPos.y - panOrigin.current.mouse.y),
      });
      return;
    }

    if (isMovingProfile && moveProfileOriginRef.current) {
      const origin = moveProfileOriginRef.current;
      const dxPx = screenPos.x - origin.mouse.x;
      const dyPx = screenPos.y - origin.mouse.y;
      if (!hasMovedProfileRef.current) {
        if (Math.hypot(dxPx, dyPx) < VERTEX_DRAG_THRESHOLD_PX) return; // still just a click, not a drag yet
        hasMovedProfileRef.current = true;
      }
      // Pure translation, computed once from the ORIGINAL (pointer-down-time)
      // points snapshot — never re-derived from the current `points` state —
      // so the delta applied here can never drift or compound across a
      // single drag. Every point (including hem-carrying endpoints — hems
      // are stored as direction/length data relative to their endpoint, not
      // as their own points, so they follow automatically) shifts by the
      // identical world-space vector; no leg length or bend angle is ever
      // touched.
      const dxWorld = dxPx / (PIXELS_PER_INCH * zoom);
      const dyWorld = dyPx / (PIXELS_PER_INCH * zoom);
      setPoints(origin.points.map((p) => ({ x: p.x + dxWorld, y: p.y + dyWorld, radius: p.radius })));
      return;
    }

    if (draggingVertexIndex !== null) {
      if (!hasVertexDraggedRef.current) {
        const downPos = vertexDragDownScreenRef.current;
        const movedPx = downPos ? Math.hypot(screenPos.x - downPos.x, screenPos.y - downPos.y) : Infinity;
        if (movedPx < VERTEX_DRAG_THRESHOLD_PX) return; // still just a click, not a drag yet

        hasVertexDraggedRef.current = true;
        canvas.style.cursor = 'grabbing';
      }
      const rawCursor = screenToWorld(screenPos.x, screenPos.y, canvas);
      const grabOffset = legReshapeGrabOffsetRef.current;
      // For a leg-body reshape, re-center the cursor by the grab offset
      // (see legReshapeGrabOffsetRef above) before it's treated as "where
      // the vertex should be" — a no-op for a genuine vertex grab.
      const raw = grabOffset ? { x: rawCursor.x - grabOffset.x, y: rawCursor.y - grabOffset.y } : rawCursor;
      const idx = draggingVertexIndex;
      const original = draggingVertexOriginalPoints.current;
      if (!original) return;
      const originalPos = original[idx];
      // Guard rail: never let this drag reach or cross a self-overlapping
      // (0°) or fully-straightened (180°) bend at either joint it can
      // reshape — see clampDragAngle. A no-op (returns `raw` itself,
      // same object) whenever the candidate is already safe.
      const clamped = clampDragAngle(raw, idx, original);
      if (idx === 0) {
        // Point 0 has no leg before it to anchor against (clampDragAngle
        // mirrors its anchor to point 1 instead — see that function).
        // With no "before" side to hold fixed and translate the rest
        // relative to, only point 0 itself moves; every other point stays
        // exactly where it started. This mirrors how dragging the true
        // last point also moves alone, with nothing to translate past it.
        setPoints((prev) =>
          prev.map((p, i) => (i === 0 ? { x: clamped.x, y: clamped.y, radius: p.radius } : original[i]))
        );
        return;
      }
      const delta = { x: clamped.x - originalPos.x, y: clamped.y - originalPos.y };
      // The incoming leg's endpoint (this vertex) moves to the cursor;
      // everything downstream translates by the same delta so downstream
      // leg lengths/angles stay exactly as they were, relative to each
      // other and to this vertex.
      setPoints((prev) =>
        prev.map((p, i) => {
          if (i < idx) return p;
          if (i === idx) return { x: clamped.x, y: clamped.y, radius: p.radius };
          const op = original[i];
          return { x: op.x + delta.x, y: op.y + delta.y, radius: op.radius };
        })
      );
      return;
    }

    if (continueLineCandidateRef.current) {
      // Resolve once, at the first sign of real movement — same deferred
      // pattern as the vertex-hit and leg-body candidates. A plain click
      // (no real movement) leaves this candidate to be discarded in
      // handlePointerUp, and the segment/vertex selection already made in
      // handlePointerDown stands as the outcome (see that branch's own
      // comment) — it never silently appends a new point.
      const candidate = continueLineCandidateRef.current;
      const movedPx = Math.hypot(screenPos.x - candidate.downScreenPos.x, screenPos.y - candidate.downScreenPos.y);
      if (movedPx < VERTEX_DRAG_THRESHOLD_PX) return; // still just a click, not a drag yet

      continueLineCandidateRef.current = null;
      // A real drag from here always means "continue the line," overriding
      // whatever selection handlePointerDown made as its click-only guess —
      // and takes priority over a leg-body-reshape candidate that may have
      // armed on the very same pointerdown (the last point sits on the
      // last segment too).
      legBodyDragCandidateRef.current = null;
      setSelectedBendPoint(null);
      setSelectedSegment(null);
      dragAnchorRef.current = candidate.anchor;
      dragDownScreenRef.current = candidate.downScreenPos;
      prependDragRef.current = candidate.prepend;
      setIsDragDrawing(true);
      const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
      const length = dist(candidate.anchor, raw);
      const angleDeg = (Math.atan2(raw.y - candidate.anchor.y, raw.x - candidate.anchor.x) * 180) / Math.PI;
      setDragPreview({ point: raw, length, angleDeg });
      setDragScreenPos(screenPos);
      return;
    }

    if (legBodyDragCandidateRef.current) {
      // A drag that started on a leg's body is ambiguous until now: decide
      // once, at the first sign of real movement, same as the vertex-hit
      // and last-point candidates above. Reshapes the leg by arming a
      // vertex-drag on its far endpoint and falling through to the exact
      // same downstream-point-translation logic the draggingVertexIndex
      // branch above already implements, so reshaping a leg body behaves
      // identically to dragging its endpoint directly, regardless of drag
      // direction.
      const candidate = legBodyDragCandidateRef.current;
      const movedPx = Math.hypot(screenPos.x - candidate.downScreenPos.x, screenPos.y - candidate.downScreenPos.y);
      if (movedPx < VERTEX_DRAG_THRESHOLD_PX) return; // still just a click, not a drag yet

      legBodyDragCandidateRef.current = null;

      // Every leg's body-drag reshapes it by moving whichever endpoint is
      // the "loose" one — the one whose own drag doesn't translate the rest
      // of the chain (see the idx===0 mirrored branch below and
      // clampDragAngle's own `mirrored` comment). For every leg except the
      // first, that's the higher-index endpoint (legIndex + 1): point 0 sits
      // fixed while the tail from there on translates. Leg 0 is the one
      // exception — point 0 itself is the loose end there, and point 1 is
      // the shared joint the rest of the chain hangs off, so grabbing leg
      // 0's body must drag point 0, not point 1. Without this special case,
      // grabbing anywhere along leg 0 except its exact tip dragged point 1
      // instead — moving the wrong end and stretching the leg rather than
      // swinging its free end (afs-sv-003 follow-up).
      const farVertex = candidate.legIndex === 0 ? 0 : candidate.legIndex + 1;
      const farOriginal = points[farVertex];
      legReshapeGrabOffsetRef.current = { x: candidate.clickPoint.x - farOriginal.x, y: candidate.clickPoint.y - farOriginal.y };
      setSelectedBendPoint(null);
      setSelectedSegment(candidate.legIndex);
      setDraggingVertexIndex(farVertex);
      draggingVertexOriginalPoints.current = points;
      hasVertexDraggedRef.current = true;
      vertexDragDownScreenRef.current = candidate.downScreenPos;
      canvas.style.cursor = 'grabbing';
      return;
    }

    if (isDragDrawing && dragAnchorRef.current) {
      const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
      const length = dist(dragAnchorRef.current, raw);
      const angleDeg = (Math.atan2(raw.y - dragAnchorRef.current.y, raw.x - dragAnchorRef.current.x) * 180) / Math.PI;
      setDragPreview({ point: raw, length, angleDeg });
      setDragScreenPos(screenPos);
      return;
    }

    // Alt held but not yet dragging — preview the move cursor and suppress
    // vertex/segment hover highlighting so it doesn't visually compete with
    // the move affordance (afs-sv-004).
    if (altPressed.current && points.length > 0) {
      canvas.style.cursor = 'grab';
      canvas.title = '';
      setHoveredVertex(null);
      setHoveredSegment(null);
      return;
    }

    // Shift held but not yet dragging — suppress vertex/segment hover so it
    // doesn't visually compete with point 0's own move affordance; cursor
    // stays the default crosshair (same "ready to draw" cue plain drawing
    // already uses), since this gesture also draws a new segment, just
    // prepended instead of appended (afs-sv-005).
    if (shiftPressed.current && points.length > 0) {
      canvas.style.cursor = 'crosshair';
      canvas.title = '';
      setHoveredVertex(null);
      setHoveredSegment(null);
      return;
    }

    const vertexHover = hitTestVertex(screenPos, canvas);
    setHoveredVertex(vertexHover);
    if (vertexHover !== null) {
      // Point 0 has no bend radius (see the matching selectedBendPoint
      // guard in handlePointerDown) — never show the tight-radius warning
      // for it.
      const isTooTight =
        vertexHover > 0 && isGauge18OrThicker(gauge) && getEffectiveRadius(vertexHover) < thicknessIn * 1.5;
      canvas.title = isTooTight ? 'Radius too tight for this gauge' : '';
      canvas.style.cursor = 'grab';
      setHoveredSegment(null);
      return;
    }
    const segmentHover = hitTestSegmentAt(screenPos, canvas);
    setHoveredSegment(segmentHover);
    canvas.title = '';
    canvas.style.cursor = segmentHover !== null ? 'grab' : 'crosshair';
  };

  // Also the shared "release/cancel everything" handler — reused for
  // pointercancel (already wired below), lost pointer capture (a popup
  // stealing focus, a right-click context menu, an OS-level drag
  // interruption — anything that makes a real pointerup unlikely to ever
  // arrive), a window blur mid-drag, and a defensive e.buttons===0 check in
  // handlePointerMove. Unconditionally clears the two "armed but not yet
  // resolved into a real gesture" candidate refs FIRST, regardless of which
  // branch below actually matches — previously they were only ever cleared
  // by the next pointerdown, so a plain click on a leg (down+up with no
  // real movement in between, the ordinary way to just select a leg) left
  // legBodyDragCandidateRef armed. Since handlePointerMove resolves that
  // ref from mere cursor position with NO check that a button is actually
  // held, the next unrelated mousemove over the canvas — cursor movement
  // alone, no button pressed — would silently arm a real vertex-reshape
  // drag that then followed the cursor on every subsequent move forever
  // (nothing but a pointerup ever clears draggingVertexIndex, and a plain
  // mousemove-only gesture never produces one). This was the reported
  // "moving the cursor with no button pressed moves the profile" bug.
  const handlePointerUp = () => {
    legBodyDragCandidateRef.current = null;
    legReshapeGrabOffsetRef.current = null;
    continueLineCandidateRef.current = null;
    // Read then reset, same pattern as the two refs above — this flag must
    // never survive past the gesture it belongs to, but the isDragDrawing
    // finalize branch below still needs to know which end THIS gesture was
    // extending from (afs-sv-005).
    const wasPrependDrag = prependDragRef.current;
    prependDragRef.current = false;

    if (isPanning) {
      setIsPanning(false);
      panOrigin.current = null;
      return;
    }
    if (isMovingProfile) {
      // Only push undo history if the profile actually moved — an Alt+click
      // with no real drag must not add a geometrically-identical entry to
      // the undo stack, same no-op guard the vertex-drag/leg-reshape
      // gestures elsewhere in this file already apply.
      if (hasMovedProfileRef.current && moveProfileOriginRef.current) {
        // Captured into a plain local BEFORE moveProfileOriginRef.current is
        // nulled below — setPast's updater callback runs later, during
        // React's next render/commit, not synchronously here. Reading the
        // ref directly inside that callback (as this used to) meant it saw
        // whatever the ref held BY THEN, which was already null (the very
        // next line nulls it), crashing every real Alt+drag move with
        // "Cannot read properties of null (reading 'points')" the instant
        // the drag was released. Confirmed via Playwright.
        const originalPoints = moveProfileOriginRef.current.points;
        setPast((p) => [...p, { points: originalPoints, hemStart, hemEnd }]);
        setFuture([]);
      }
      setIsMovingProfile(false);
      moveProfileOriginRef.current = null;
      hasMovedProfileRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'crosshair';
      return;
    }
    if (draggingVertexIndex !== null) {
      if (hasVertexDraggedRef.current && draggingVertexOriginalPoints.current) {
        const original = draggingVertexOriginalPoints.current;
        setPast((p) => [...p, { points: original, hemStart, hemEnd }]);
        setFuture([]);
      }
      legReshapeGrabOffsetRef.current = null;
      setDraggingVertexIndex(null);
      draggingVertexOriginalPoints.current = null;
      hasVertexDraggedRef.current = false;
      vertexDragDownScreenRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'crosshair';
      return;
    }
    if (isDragDrawing && dragAnchorRef.current && dragPreview) {
      if (points.length === 0) {
        // First-point gesture: a plain click (no drag) still places just
        // that one point, same as before; a click-drag-release places both
        // the anchor and the drag destination at once.
        commitPoints(
          dragPreview.length >= MIN_DRAG_SEGMENT_IN
            ? [dragAnchorRef.current, dragPreview.point]
            : [dragAnchorRef.current]
        );
      } else if (dragPreview.length >= MIN_DRAG_SEGMENT_IN) {
        // afs-sv-005: a prepend drag inserts the new point at the FRONT —
        // every existing point shifts one index later, which is exactly
        // why selectedBendPoint/selectedSegment were already cleared when
        // this gesture was armed in handlePointerDown (a selection left
        // pointing at its old index would now silently reference the
        // wrong vertex/leg). commitPoints's own setSelectedSegment(null)
        // covers segment selection either way; the append branch needs no
        // equivalent care since it never shifts any existing index.
        commitPoints(wasPrependDrag ? [dragPreview.point, ...points] : [...points, dragPreview.point]);
      }
      setIsDragDrawing(false);
      dragAnchorRef.current = null;
      setDragPreview(null);
      setDragScreenPos(null);
    }
  };

  // Losing window focus mid-drag (alt-tab, a native file/print dialog, the
  // OS taskbar) can mean the eventual mouseup/pointerup happens somewhere
  // this tab never sees at all — pointer capture generally survives that,
  // but "generally" isn't "always," and onLostPointerCapture above only
  // fires if the browser actually released capture. This is the last line
  // of defense: on blur, finalize/cancel exactly like a real release would.
  useEffect(() => {
    window.addEventListener('blur', handlePointerUp);
    return () => window.removeEventListener('blur', handlePointerUp);
  });

  const handlePointerLeave = () => {
    if (isDragDrawing || isPanning || isMovingProfile || draggingVertexIndex !== null) return;
    setHoveredVertex(null);
    setHoveredSegment(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.title = '';
  };

  // Wheel zoom is wired via a native, non-passive `wheel` listener (below)
  // rather than the React `onWheel` JSX prop. React attaches `onWheel` as a
  // PASSIVE listener, which silently ignores `e.preventDefault()` — the
  // browser scrolls the page at the same time the canvas zooms, both
  // firing unpredictably together. A manually-attached listener with
  // `{ passive: false }` is the only way to actually block page scroll
  // while the cursor is over the canvas.
  //
  // The canvas element unmounts/remounts whenever `viewMode` toggles
  // between '2d' and '3d' (see the `viewMode === '2d' &&` guard in the
  // JSX below), so this effect depends on `viewMode` to reattach the
  // listener each time the canvas element is recreated — same pattern the
  // draw-loop effect above already follows. The effect itself always
  // attaches at most one listener per canvas instance, and cleans it up
  // on every re-run and on unmount, so listeners never accumulate across
  // renders.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleWheelNative(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      setZoom((prevZoom) => {
        const nextZoom = Math.max(0.25, Math.min(4, prevZoom - e.deltaY * 0.001));
        if (nextZoom !== prevZoom) {
          // Keep the world point under the cursor fixed on screen: solve
          // for the pan offset that maps that same world point back to
          // the same screen position at the new zoom level.
          setPan((prevPan) => ({
            x: prevPan.x + (cursorX - rect.width / 2 - prevPan.x) * (1 - nextZoom / prevZoom),
            y: prevPan.y + (cursorY - rect.height / 2 - prevPan.y) * (1 - nextZoom / prevZoom),
          }));
        }
        return nextZoom;
      });
    }

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelNative);
  }, [viewMode]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isLocked) return;
    // A hem needs a neighbor point to compute a fold direction from, so
    // the popup itself is harmless to open at 1 point — renderHemAt (in the
    // draw loop) is what actually gates on having ≥2 points before drawing
    // the fold, so nothing crashes either way.
    if (points.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const startScreen = worldToScreen(points[0], canvas);
    const endScreen = worldToScreen(points[points.length - 1], canvas);

    // Hit-test against a point extrapolated past the true vertex, along the
    // leg's own direction, instead of the true vertex itself — colliding
    // directly with the true vertex collided with vertex-drag and made
    // double-clicking near a leg's end unreliable. The popup itself still
    // anchors at the true vertex (startScreen/endScreen above).
    let startHitTarget = points[0];
    let endHitTarget = points[points.length - 1];
    if (points.length >= 2) {
      const startDir = unitVector(points[1], points[0]);
      startHitTarget = {
        x: points[0].x + startDir.x * HEM_TRIGGER_OFFSET_IN,
        y: points[0].y + startDir.y * HEM_TRIGGER_OFFSET_IN,
      };
      const endDir = unitVector(points[points.length - 2], points[points.length - 1]);
      endHitTarget = {
        x: points[points.length - 1].x + endDir.x * HEM_TRIGGER_OFFSET_IN,
        y: points[points.length - 1].y + endDir.y * HEM_TRIGGER_OFFSET_IN,
      };
    }
    const startHitScreen = worldToScreen(startHitTarget, canvas);
    const endHitScreen = worldToScreen(endHitTarget, canvas);
    const dStart = Math.hypot(screenPos.x - startHitScreen.x, screenPos.y - startHitScreen.y);
    const dEnd = Math.hypot(screenPos.x - endHitScreen.x, screenPos.y - endHitScreen.y);
    // A hem already exists at this endpoint -> use the more generous
    // re-open radius; otherwise this is a fresh creation click and keeps
    // the tighter radius (see HEM_HIT_RADIUS_EXISTING_PX above).
    const startHitRadius = hemStart ? HEM_HIT_RADIUS_EXISTING_PX : HEM_HIT_RADIUS_PX;
    const endHitRadius = hemEnd ? HEM_HIT_RADIUS_EXISTING_PX : HEM_HIT_RADIUS_PX;
    const startInRange = dStart <= startHitRadius;
    const endInRange = dEnd <= endHitRadius;
    if (startInRange && (!endInRange || dStart <= dEnd)) {
      setHemPopup({ endpoint: 'start', screenPos: startScreen });
      setHemLengthDraft(String(hemStart?.lengthIn ?? HEM_DEFAULT_LENGTH_IN));
      // No type is chosen yet for a brand-new hem at this point (the Gap
      // field itself doesn't render until a type button creates the hem in
      // applyHem, which re-syncs this draft to the real type-specific
      // default) — this fallback only ever shows transiently.
      setHemGapDraft(String(hemStart?.gapIn ?? HEM_DEFAULT_GAP_IN_OPEN));
    } else if (endInRange) {
      setHemPopup({ endpoint: 'end', screenPos: endScreen });
      setHemLengthDraft(String(hemEnd?.lengthIn ?? HEM_DEFAULT_LENGTH_IN));
      setHemGapDraft(String(hemEnd?.gapIn ?? HEM_DEFAULT_GAP_IN_OPEN));
    }
  };

  const applySegmentLength = () => {
    if (isLocked || selectedSegment === null) return;
    const newLength = Number(segmentLengthInput.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(newLength) || newLength <= 0) return;
    const a = points[selectedSegment];
    const b = points[selectedSegment + 1];
    // No-op guard: this input has autoFocus, so ANY unmount while it's
    // focused — a leg-body reshape drag starting mid-selection, or simply
    // clicking a different leg/vertex/blank canvas to change or clear the
    // selection — fires a native blur, invoking this via onBlur with the
    // length UNCHANGED. Comparing against the raw, unrounded dist(a, b) was
    // not enough: the displayed segmentLengthInput is dist(a, b).toFixed(3),
    // so for any leg whose true length isn't already an exact 3-decimal
    // value (i.e. almost every leg not drawn perfectly axis-aligned), the
    // rounded-then-reparsed newLength differs from the exact dist(a, b) by
    // up to 0.0005" — comfortably over the old 1e-6 tolerance. That false
    // "edit" was committing a same-leg micro-resize (snapping the leg to its
    // own rounded length) on every plain click away from a selected
    // segment, which also re-fit/re-centered the view (see the
    // computeFitView call below) — a visible geometry/view "jump" on every
    // leg-to-leg click, confirmed live. Round dist(a, b) the same way before
    // comparing so a genuine, intentional edit (which changes the rounded
    // value by a real 0.001"+ step) still commits, but a blur with no real
    // edit is a true no-op.
    if (Math.abs(newLength - Number(dist(a, b).toFixed(3))) < 1e-6) return;
    const angleRad = Math.atan2(b.y - a.y, b.x - a.x);
    const newB = { x: a.x + Math.cos(angleRad) * newLength, y: a.y + Math.sin(angleRad) * newLength };
    const delta = { x: newB.x - b.x, y: newB.y - b.y };
    // Shift every downstream point by the same delta so the rest of the
    // profile keeps its shape relative to the resized segment.
    const newPoints = points.map((p, i) => (i > selectedSegment ? { ...p, x: p.x + delta.x, y: p.y + delta.y } : p));
    commitPoints(newPoints);

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const { zoom: nextZoom, pan: nextPan } = computeFitView(newPoints, rect.width, rect.height);
      setZoom(nextZoom);
      setPan(nextPan);
    }
  };

  // Part 8 — typing a new signed angle and pressing Enter rotates everything
  // downstream of the selected joint by the difference (same math the old
  // canvas-drag interaction used, just driven by a numeric field now).
  const applyBendAngle = () => {
    if (isLocked || selectedBendPoint === null) return;
    const i = selectedBendPoint;
    const desired = Number(angleInputDraft);
    if (!Number.isFinite(desired)) return;
    const prevPt = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    if (!prevPt || !curr || !next) return;
    const v1 = { x: prevPt.x - curr.x, y: prevPt.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const currentSigned = signedAngleBetween(v1, v2);
    const delta = desired - currentSigned;
    commitPoints(rotateChainAroundVertex(points, i, delta));
  };

  const deleteSelected = () => {
    if (isLocked) return;
    if (selectedBendPoint !== null) {
      commitPoints(points.filter((_, i) => i !== selectedBendPoint));
      setSelectedBendPoint(null);
      return;
    }
    if (selectedSegment !== null) {
      commitPoints(points.filter((_, i) => i !== selectedSegment + 1));
      setSelectedSegment(null);
    }
  };

  const selectAdjacentBendPoint = (direction: 1 | -1) => {
    const first = 1;
    const last = points.length - 2;
    if (last < first) return;
    if (selectedBendPoint === null) {
      setSelectedBendPoint(direction === 1 ? first : last);
      setSelectedSegment(null);
      return;
    }
    let next = selectedBendPoint + direction;
    if (next > last) next = first;
    if (next < first) next = last;
    setSelectedBendPoint(next);
    setSelectedSegment(null);
  };

  const fitToScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    // getBoundingClientRect (CSS/logical pixels), not canvas.width/height —
    // those are now the DPR-multiplied physical backing-store size. See
    // the draw effect's own comment for why.
    const rect = canvas.getBoundingClientRect();
    const { zoom: nextZoom, pan: nextPan } = computeFitView(points, rect.width, rect.height);
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const centerView = () => setPan({ x: 0, y: 0 });

  // Shared by both the direct single-shape templates and VariantPicker
  // selections below — the only difference between the two is where the
  // (label, points) pair comes from.
  const loadTemplateGeometry = (label: string, templatePoints: Point[]) => {
    if (points.length > 0) {
      const confirmed = window.confirm('Load template? This will replace your current work.');
      if (!confirmed) return;
    }
    const worldPoints = templatePointsToWorld(templatePoints);
    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
    setPoints(worldPoints);
    setSelectedSegment(null);
    setProfileName(label);

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const { zoom: nextZoom, pan: nextPan } = computeFitView(worldPoints, rect.width, rect.height);
      setZoom(nextZoom);
      setPan(nextPan);
    }
  };

  const loadTemplate = (template: ProfileTemplate) => {
    if (!template.points) return;
    loadTemplateGeometry(template.label, template.points);
  };

  const handleVariantSelect = (variant: ProfileTemplateVariant) => {
    loadTemplateGeometry(variant.label, variant.points);
    setVariantPickerTemplate(null);
  };

  const rotateProfile = (deltaDeg: number) => {
    if (isLocked || points.length < 2) return;
    commitPoints(rotateAllPoints(points, centroidOf(points), deltaDeg));
  };

  const printCanvas = () => {
    window.print();
  };

  const confirmNew = () => {
    // Always allowed, even while locked -- this discards the current
    // profile entirely (not an edit to it) and starts fresh, so the lock
    // resets along with everything else rather than blocking the action.
    setIsLocked(false);
    setJustLocked(false);
    commitPoints([]);
    setMatches([]);
    setTopMatchDiagramBends(null);
    setHemStart(null);
    setHemEnd(null);
    setProfileName('Untitled Profile');
    setRevision(1);
    setSavedProfileId(null);
    setProfileCategoryId(null);
    setProfileSubcategory('');
    setViewingFromPassport(false);
    setShowNewConfirm(false);
  };

  const commitProfileName = () => {
    if (profileNameDraft.trim()) setProfileName(profileNameDraft.trim());
    setEditingName(false);
  };

  // Fixes the Job Info persist bug (afs-jf-006): closing the drawer/box
  // previously just hid the fields while leaving their state (and the next
  // debounced autosave write, see the AUTOSAVE_KEY effect above) intact, so
  // reopening showed stale data. Called from both X buttons below.
  const clearJobInfoFields = () => {
    setClientBusinessName('');
    setClientName('');
    setPoNumber('');
    setJobName('');
    setRequestedDeliveryDate('');
  };

  const openSaveModal = () => {
    setDuplicateOnSave(false);
    setSaveError(null);
    setShowProfileDetails(true);
  };

  const openDuplicateModal = () => {
    setDuplicateOnSave(true);
    setSaveError(null);
    setShowProfileDetails(true);
  };

  // Part 5 — reuses the pre-existing saved_configurations table (confirmed
  // live in the real database, not just the migration file) rather than a
  // new one: FlashDraft doesn't use that table's catalog-linked FK columns
  // (profile_id/material_id/gauge_id/finish_id all stay null), so its own
  // points/hem/category data lives inside the existing flexible
  // `dimensions` JSONB column instead of requiring a schema change.
  // `lock` is an explicit argument, not a piece of component state, because
  // lockAndSaveProfile (Phase 3) calls this synchronously in the same tick
  // it decides to lock -- a `setLockOnSave(true)` immediately followed by a
  // direct performSave() call would still close over the OLD state value
  // (React doesn't re-render between them), so a state flag can't drive
  // this from a same-tick caller the way the old modal-based flow did.
  const performSave = async (values: ProfileDetailsFormValues, asDuplicate: boolean, lock: boolean = false) => {
    setSavingProfile(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaveError('Sign in to save profiles to your account.');
        // Same reasoning as the catch block below: the lock-and-save path
        // has no modal to show saveError inline in, so it needs its own
        // toast or this failure is otherwise silent.
        if (lock) setToast('Sign in to save profiles to your account.');
        setSavingProfile(false);
        return;
      }
      // Phase 3 (afs-pp-001) -- company_id/is_locked/job_info are real
      // top-level columns added by
      // supabase/migrations/024_profile_passport_company_scope.sql, which
      // has NOT been applied to the live database as of this writing (no
      // Supabase access to the real project in this session — see that
      // migration's own header comment). Every save through this function
      // will fail until it's applied, same as every other Profile Passport
      // route added in this phase.
      const { data: ownProfile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      const companyId = (ownProfile?.company_id as string | null) ?? null;
      const nextRevision = asDuplicate || !savedProfileId ? 1 : revision + 1;
      const isLockedNow = lock || isLocked;
      // Real canvas screenshot (025_profile_passport_thumbnail.sql), replacing
      // Profile Passport's generic vector-shape thumbnail with what the user
      // actually drew. Captured on every save, not only Lock -- the task this
      // shipped for asked for it specifically "when a profile is locked and
      // saved," but a profile saved via plain Save (never locked) benefits
      // from a real thumbnail too, and there's no reason to withhold one.
      // toDataURL() is synchronous and needs no library (Playwright is a
      // Node-side browser-automation tool -- it cannot run inside this
      // client-side page to screenshot itself; html2canvas would also be
      // solving a problem that doesn't exist here, since the canvas already
      // has real pixels to read directly). Safe to call unconditionally: this
      // canvas is never drawn to via drawImage() with cross-origin content,
      // so it can never be in a tainted state that would throw here.
      const thumbnailImage = canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
      const payload = {
        user_id: user.id,
        company_id: companyId,
        name: values.name,
        is_locked: isLockedNow,
        thumbnail_image: thumbnailImage,
        // Plain display-only labels (024_profile_passport_company_scope.sql)
        // — deliberately separate from dimensions.categoryId, a real FK into
        // machine_profile_categories.id (see ProfileDetailsModal.tsx), which
        // stays whatever the user actually picked there. Only the
        // zero-friction lock flow (afs-pp-001's own literal "Category (from
        // Job Info or 'General')" spec) ever sets these -- Job Info has no
        // category/subcategory concept of its own, so this is always just
        // the two defaults, never conditionally sourced from anything.
        ...(lock ? { category: 'General', subcategory: 'Custom' } : {}),
        job_info: {
          clientBusinessName: clientBusinessName || null,
          clientName: clientName || null,
          poNumber: poNumber || null,
          jobName: jobName || null,
          requestedDeliveryDate: requestedDeliveryDate || null,
        },
        dimensions: {
          kind: 'flashdraft',
          points,
          hemStart,
          hemEnd,
          categoryId: values.categoryId,
          subcategory: values.subcategory,
          // Snapshotted from the Job Info drawer at save time (afs-jf-006)
          // so the Load list's Job Name column has something to show —
          // kept here too (alongside the new top-level job_info column
          // above) so a row saved before this phase's migration was
          // applied still displays correctly (see getPassportProfiles'
          // own fallback read, lib/data/profile-passport.ts).
          jobName: jobName || null,
          revision: nextRevision,
          // Persisted alongside the geometry so lock status is a real,
          // durable property of the saved passport row, not just this
          // session's transient isLocked state -- `lock` locks going INTO
          // this save; a profile already locked stays locked on a later
          // re-save (e.g. via Edit Name) unless Unlock was used. Same
          // backward-compatibility reasoning as jobName above.
          isLocked: isLockedNow,
        },
        length_ft: lengthFtDecimal || null,
        quantity: Number(quantity) || null,
        notes: notes || null,
      };
      if (savedProfileId && !asDuplicate) {
        const { error } = await supabase.from('saved_configurations').update(payload).eq('id', savedProfileId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('saved_configurations').insert(payload).select('id').single();
        if (error) throw error;
        setSavedProfileId((data as { id: string }).id);
      }
      setProfileName(values.name);
      setProfileCategoryId(values.categoryId);
      setProfileSubcategory(values.subcategory);
      setRevision(nextRevision);
      setShowProfileDetails(false);
      // `lock` only takes effect here, on an actual successful write -- a
      // failed save (network error, RLS rejection) below hits the catch
      // block instead and never locks.
      if (lock) {
        setIsLocked(true);
        setJustLocked(true);
        setTimeout(() => setJustLocked(false), 3500);
        setToast('Profile Saved & Locked');
      } else {
        setToast('Profile saved to your account');
      }
    } catch {
      setSaveError('Could not save profile. Please try again.');
      // The lock-and-save path has no modal to show `saveError` inline in
      // (that's the whole point -- zero friction, afs-pp-001) so it needs
      // its own toast; the modal path already surfaces `saveError` via
      // ProfileDetailsModal's own `error` prop, so this stays lock-only to
      // avoid showing the same failure twice there.
      if (lock) setToast('Could not save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  // "Profile-<ISO-8601 timestamp>" per the Phase 3 spec's exact auto-name
  // format — includes milliseconds/timezone, so two locks in the same
  // second still can't collide the way a whole-second or date-only format
  // could.
  function generateAutoProfileName(): string {
    return `Profile-${new Date().toISOString()}`;
  }

  // Zero-friction "Lock Profile & Save to Passport" (Phase 3, afs-pp-001) --
  // no modal, no form-filling: calls performSave directly with an
  // auto-generated name and Job-Info-or-default category/subcategory. Job
  // Info has no category concept of its own (Business Name/Client Name/PO
  // Number/Job Name/Requested Delivery Date only), so `categoryId` is left
  // as whatever it already is (usually null) rather than writing the
  // spec's literal "General" into it -- categoryId is a real FK-shaped
  // reference into machine_profile_categories.id (see
  // ProfileDetailsModal.tsx), not a free-text label, and it has no visible
  // consumer in this phase's Profiles tab (Name/Date Created/Job Name/
  // Actions) to justify inventing a fake category row for it to point at.
  // subcategory IS free text, so "Custom" applies there exactly as spec'd.
  // Superseded the old modal-based lock flow (openLockAndSaveModal/
  // lockOnSave), which asked for name/category first.
  const lockAndSaveProfile = () => {
    if (isLocked || points.length < 2 || savingProfile) return;
    performSave(
      {
        name: profileName !== 'Untitled Profile' ? profileName : generateAutoProfileName(),
        categoryId: profileCategoryId,
        subcategory: profileSubcategory || 'Custom',
      },
      false,
      true
    );
  };

  // Snapshots the CURRENT state (before a hem mutation about to happen) onto
  // the undo stack and clears redo — the same "push before you change"
  // pattern commitPoints uses for points-only actions, applied here so hem
  // creation/type-change/removal is undoable too. NOT called from the Hem
  // Length (in) number input (setHemLength fires on every keystroke) —
  // that would flood undo with one entry per digit typed,
  // same reason bend-radius adjustment isn't undo-tracked either; only the
  // discrete type-select/remove actions below push a history entry.
  const pushHistorySnapshot = () => {
    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
  };

  const applyHem = (type: HemType) => {
    if (isLocked || !hemPopup) return;
    pushHistorySnapshot();
    const current = hemPopup.endpoint === 'start' ? hemStart : hemEnd;
    // gapIn is a real per-hem editable value (see the Gap (in) field below)
    // — preserved across a type switch same as lengthIn, rather than reset
    // to a type-derived constant, so re-clicking a type button (or picking
    // a different one) never silently wipes a value the user already typed.
    // For a brand-new hem (no `current` yet) the starting default is
    // type-specific — Open and Smashed read as nearly identical at a
    // shared default (confirmed live by Reid). Teardrop has no gap concept
    // (hem-glyph.ts's teardrop branch never reads gapPx) so it just
    // inherits Open's default, which is cosmetically inert for it.
    const gapDefault = type === 'smashed' ? HEM_DEFAULT_GAP_IN_SMASHED : HEM_DEFAULT_GAP_IN_OPEN;
    const gapIn = current?.gapIn ?? gapDefault;
    const lengthIn = current?.lengthIn ?? (Number(hemLengthDraft) || HEM_DEFAULT_LENGTH_IN);
    const kick = current?.kick ?? HEM_DEFAULT_KICK;
    const hem: Hem = { type, gapIn, lengthIn, kick };
    if (hemPopup.endpoint === 'start') setHemStart(hem);
    else setHemEnd(hem);
    // Keep the draft text in sync with the resolved value — the field
    // itself only starts rendering once `current` exists (right after this
    // call), so without this it would show the stale pre-type-pick text
    // even though the underlying hem.gapIn is already the real default.
    setHemGapDraft(String(gapIn));
    if (type !== 'open') setHemPopup(null);
  };

  const setHemLength = (val: string) => {
    setHemLengthDraft(val);
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || !hemPopup) return;
    const current = hemPopup.endpoint === 'start' ? hemStart : hemEnd;
    if (!current) return;
    const hem: Hem = { ...current, lengthIn: n };
    if (hemPopup.endpoint === 'start') setHemStart(hem);
    else setHemEnd(hem);
  };

  const setHemGap = (val: string) => {
    setHemGapDraft(val);
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || !hemPopup) return;
    const current = hemPopup.endpoint === 'start' ? hemStart : hemEnd;
    if (!current) return;
    const hem: Hem = { ...current, gapIn: n };
    if (hemPopup.endpoint === 'start') setHemStart(hem);
    else setHemEnd(hem);
  };

  const setHemKick = (kick: HemKick) => {
    if (!hemPopup) return;
    const current = hemPopup.endpoint === 'start' ? hemStart : hemEnd;
    if (!current) return;
    const hem: Hem = { ...current, kick };
    if (hemPopup.endpoint === 'start') setHemStart(hem);
    else setHemEnd(hem);
  };

  const removeHem = () => {
    if (isLocked || !hemPopup) return;
    pushHistorySnapshot();
    if (hemPopup.endpoint === 'start') setHemStart(null);
    else setHemEnd(null);
    setHemPopup(null);
  };

  const clearCanvas = () => {
    if (isLocked) return;
    commitPoints([]);
    setMatches([]);
    setTopMatchDiagramBends(null);
    setHemStart(null);
    setHemEnd(null);
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      // Best-effort — browser may be blocking local storage.
    }
  };

  // Phase 3 (afs-pp-001) -- the in-canvas Load modal (PassportProfile,
  // openLoadPanel/loadFromPassport) was replaced by a redirect to
  // /app/profile-passport (see the "Load Profiles" Link below); this is
  // what that dashboard's profile selection actually hands back to,
  // via ?loadPassport=<id> (see the mount effect below), rather than a
  // list picked from inline. Loads the row as the real, currently-editing
  // profile (savedProfileId/profileName/revision all set from it, not just
  // its geometry) so a subsequent Save/Lock updates the SAME row instead of
  // silently forking a duplicate. A locked profile loads still-locked (the
  // spec's own "user cannot edit unless they create a new unlocked
  // version" rule) -- Duplicate remains the supported way to fork an
  // editable copy of a locked profile, unchanged from existing behavior.
  const loadFromPassportById = useCallback(async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('saved_configurations')
      .select('id, name, is_locked, dimensions')
      .eq('id', id)
      .maybeSingle();
    if (!data) return;

    const row = data as { id: string; name: string | null; is_locked: boolean | null; dimensions: unknown };
    const dims = row.dimensions as {
      points?: unknown;
      hemStart?: Hem | null;
      hemEnd?: Hem | null;
      jobName?: unknown;
      categoryId?: string | null;
      subcategory?: string;
      revision?: number;
      isLocked?: boolean;
    } | null;
    if (!isPointArrayShape(dims?.points)) return;

    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
    setPoints(dims!.points as Point[]);
    setHemStart(isHemShape(dims?.hemStart) ? (dims!.hemStart as Hem) : null);
    setHemEnd(isHemShape(dims?.hemEnd) ? (dims!.hemEnd as Hem) : null);
    setSelectedSegment(null);
    setSavedProfileId(row.id);
    setProfileName(row.name || 'Untitled Profile');
    setProfileCategoryId(dims?.categoryId ?? null);
    setProfileSubcategory(dims?.subcategory ?? '');
    setRevision(dims?.revision ?? 1);
    if (typeof dims?.jobName === 'string' && dims.jobName) setJobName(dims.jobName);
    // Prefers the real is_locked column (024_profile_passport_company_scope.sql)
    // over dimensions.isLocked, matching getPassportProfiles' own fallback
    // order (lib/data/profile-passport.ts) -- falls back to the JSONB flag
    // for a row saved before that migration/column existed.
    setIsLocked(row.is_locked ?? Boolean(dims?.isLocked));
    // Marks this session as "opened from Profile Passport" (afs-pp-002) --
    // drives the "← Back to Profiles" button and, only when the profile is
    // also locked, the "View only" banner below the toolbar.
    setViewingFromPassport(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSavedProfiles = async () => {
    setShowSavedProfiles(true);
    if (!isAuthenticated) {
      setSavedProfiles([]);
      return;
    }
    setSavedProfilesLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavedProfiles([]);
      setSavedProfilesLoading(false);
      return;
    }
    const { data } = await supabase
      .from('quote_requests')
      .select('id, request_number, submitted_at, line_items')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });

    const profiles: SavedQuoteProfile[] = [];
    for (const row of (data ?? []) as QuoteRequestRow[]) {
      const items = Array.isArray(row.line_items) ? (row.line_items as unknown[]) : [];
      items.forEach((item, itemIndex) => {
        if (!isFlashDraftLineItem(item)) return;
        profiles.push({
          quoteRequestId: row.id,
          itemIndex,
          requestNumber: row.request_number,
          submittedAt: row.submitted_at,
          name: item.profileType,
          material: item.material ?? null,
          gauge: item.gauge ?? null,
          points: isPointArray(item.points) ? item.points : null,
        });
      });
    }
    setSavedProfiles(profiles);
    setSavedProfilesLoading(false);
  };

  const loadSavedProfile = (profile: SavedQuoteProfile) => {
    if (!profile.points) return;
    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
    setPoints(profile.points);
    setSelectedSegment(null);
    setShowSavedProfiles(false);
  };

  const loadFromLibrary = useCallback(async (profileId: string) => {
    const res = await fetch(`/api/studio/load-profile/${profileId}`);
    let bends: {
      step_number: number;
      left_leg_in: number | null;
      right_leg_in: number | null;
      bend_angle_degrees: number | null;
    }[] = [];
    if (res.ok) {
      const data = (await res.json()) as {
        bends: {
          step_number: number;
          left_leg_in: number | null;
          right_leg_in: number | null;
          bend_angle_degrees: number | null;
        }[];
      };
      bends = data.bends ?? [];
    }

    // Best-effort geometry reconstruction: the source machine data records
    // each bend's two adjacent leg lengths and included angle, not an
    // explicit direction/connectivity graph, so this "turtle graphics" walk
    // (draw the left leg, turn by the supplementary bend angle, repeat) is
    // an approximation of the true folded shape, not an exact CAD trace.
    // Centralized in lib/flashdraft/geometry.ts's computeProfilePoints —
    // see GEOMETRY_AUDIT.md — shared with BendSequenceDiagram and
    // ProfileViewer3D's identical reconstructions.
    const { points: reconstructed } = computeProfilePoints(
      bends.map((bend) => ({
        legIn: bend.left_leg_in,
        nextLegIn: bend.right_leg_in,
        bendAngleDegrees: bend.bend_angle_degrees,
      }))
    );

    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
    setPoints(reconstructed);
    setSelectedSegment(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canonical Profile Library's "Load into FlashDraft" hands off the
  // already-final `points` array via localStorage (see
  // components/studio/CanonicalProfileBrowser.tsx) rather than a profile id
  // to re-fetch: canonical points are the exact final geometry already, with
  // no bend-angle reconstruction step, so routing them back through
  // computeProfilePoints here would reintroduce the same same-direction-only
  // turn limitation that reconstruction has for machine profiles (see
  // lib/flashdraft/geometry.ts's own doc comment) — exactly what canonical
  // profiles exist to avoid.
  const loadCanonicalFromHandoff = useCallback(() => {
    let canonicalPoints: Point[] | null = null;
    try {
      const raw = window.localStorage.getItem('afs-flashdraft-canonical-points');
      if (raw) canonicalPoints = JSON.parse(raw) as Point[];
      window.localStorage.removeItem('afs-flashdraft-canonical-points');
    } catch {
      return;
    }
    if (!canonicalPoints) return;
    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
    setPoints(canonicalPoints);
    setSelectedSegment(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 3b: CommandCenterJobCard's "Open in FlashDraft" writes the job's
  // bends + identity fields to localStorage (ADMIN_JOB_HANDOFF_KEY) just
  // before navigating here with ?admin=1&loadJob=<jobId> — same handoff
  // pattern as loadCanonicalFromHandoff above, chosen over a new API route
  // since the card already has the full job (including bends) as a prop.
  // Same "turtle graphics" bends->points reconstruction loadFromLibrary and
  // BendSequenceDiagram use, via the shared computeProfilePoints.
  const loadFromAdminJobHandoff = useCallback(() => {
    let payload: AdminJobHandoffPayload | null = null;
    try {
      const raw = window.localStorage.getItem(ADMIN_JOB_HANDOFF_KEY);
      if (raw) payload = JSON.parse(raw) as AdminJobHandoffPayload;
      window.localStorage.removeItem(ADMIN_JOB_HANDOFF_KEY);
    } catch {
      return;
    }
    if (!payload) return;

    // machine_jobs bends are stored in millimeters (see MachineJobBend /
    // CommandCenterJobCard.tsx's own mmToIn), but computeProfilePoints's
    // legIn/nextLegIn feed directly into FlashDraft's points state, which
    // is inches-denominated throughout this canvas (loadFromLibrary's
    // source data is already in inches, hence no conversion there) — verified
    // by the mm values otherwise landing as a wildly oversized "Blank
    // Width" (e.g. a 100mm leg read as 100", not 3.94") during this
    // feature's own verification pass.
    const MM_PER_INCH = 25.4;
    const { points: reconstructed } = computeProfilePoints(
      payload.bends.map((bend) => ({
        legIn: bend.leftLegMm !== null ? bend.leftLegMm / MM_PER_INCH : null,
        nextLegIn: bend.rightLegMm !== null ? bend.rightLegMm / MM_PER_INCH : null,
        bendAngleDegrees: bend.bendAngleDegrees,
      }))
    );

    setPast((p) => [...p, { points, hemStart, hemEnd }]);
    setFuture([]);
    setPoints(reconstructed);
    setSelectedSegment(null);
    setProfileName(payload.profileName);
    if (payload.material) setMaterial(payload.material);
    if (payload.gauge) setGauge(payload.gauge);
    if (payload.quantity) setQuantity(String(payload.quantity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Part 4 integration: /studio/library's "Load into FlashDraft" button
  // links here with ?loadProfile=<id> (machine profiles) or ?loadCanonical=1
  // (canonical profiles) — load it once on mount. /app/profile-passport's
  // Profiles tab (Phase 3, afs-pp-001) does the same with ?loadPassport=<id>
  // for the user's own saved_configurations rows. Read via
  // window.location.search (not next/navigation's useSearchParams) so this
  // page stays statically prerenderable instead of requiring a Suspense
  // boundary just for a one-time read.
  //
  // Phase 3b: ?admin=1 marks this session as opened from Command Center
  // (gates "Send to PathfinderEdge" together with the isAdmin role check —
  // see adminContext's own comment); ?loadJob=1 (alongside admin=1) means
  // CommandCenterJobCard also left a specific job's geometry to load via
  // ADMIN_JOB_HANDOFF_KEY.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('loadProfile');
    if (loadId) loadFromLibrary(loadId);
    if (params.get('loadCanonical')) loadCanonicalFromHandoff();
    const passportId = params.get('loadPassport');
    if (passportId) loadFromPassportById(passportId);
    if (params.get('admin')) setAdminContext(true);
    if (params.get('loadJob')) loadFromAdminJobHandoff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = () => {
    try {
      window.localStorage.setItem(
        'afs-flashdraft-draft',
        JSON.stringify({ points, material, gauge, lengthFeet, lengthInches, quantity, notes, hemStart, hemEnd })
      );
      setDraftSavedNotice(true);
      setTimeout(() => setDraftSavedNotice(false), 2500);
    } catch {
      setSubmitError('Could not save draft — your browser may be blocking local storage.');
    }
  };

  // Renders the currently drawn profile onto a fresh offscreen canvas via
  // the same drawProfileScene the live draw-loop effect uses above, but with
  // SHOP_SNAPSHOT_LABEL_STYLE's larger, bold labels and no hover/selection/
  // drag overlays — the shop-floor-bound geometryImage for
  // shop_profile_library.geometry_svg (afs-sv-009/afs-fl-017) needs to read
  // clearly from a few feet away, not just at on-screen editing zoom. Shared
  // by both submit paths below (sendToPathfinder and submitQuoteRequest),
  // which both write this same field. Never touches the live, on-screen
  // canvas — that one keeps drawing with LIVE_CANVAS_LABEL_STYLE, unchanged.
  const buildShopSnapshotImage = useCallback(
    (paintFaceForSnapshot: PaintFace | null): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return renderShopSnapshotDataUri({
        cssWidth: rect.width,
        cssHeight: rect.height,
        points,
        hemStart,
        hemEnd,
        worldToScreen: (p) => worldToScreen(p, canvas),
        fontFamily: jetbrainsFontRef.current,
        pixelsPerInch: PIXELS_PER_INCH,
        zoom,
        pan,
        gauge,
        thicknessIn,
        getEffectiveRadius,
        isGauge18OrThicker,
        signedAngleBetween,
        colors: CANVAS_COLORS,
        paint:
          paintFaceSelectable && paintFaceForSnapshot
            ? { paintFace: paintFaceForSnapshot, resolvedPaintColor }
            : undefined,
      });
    },
    [
      points,
      hemStart,
      hemEnd,
      worldToScreen,
      zoom,
      pan,
      gauge,
      thicknessIn,
      getEffectiveRadius,
      paintFaceSelectable,
      resolvedPaintColor,
    ]
  );

  // Sends the CURRENTLY DRAWN profile straight to PathfinderEdge —
  // entirely separate from Submit for Quote / the quote-request pipeline.
  // Does not touch machine_jobs or delivery_method at all.
  const sendToPathfinder = async () => {
    if (points.length < 2) {
      setPathfinderState('error');
      setPathfinderMessage('Draw at least one segment before sending.');
      return;
    }
    setPathfinderState('sending');
    setPathfinderMessage(null);
    try {
      // Shop-floor snapshot (larger, bold labels) rendered offscreen — see
      // buildShopSnapshotImage above — reused as shop_profile_library.
      // geometry_svg (afs-sv-009) so the shop record's thumbnail is legible
      // at a glance, not a re-derived redraw of unrelated geometry.
      const geometryImage = buildShopSnapshotImage(paintFace);
      // Use the user's own canvas profile name when they've actually set
      // one (i.e. renamed it away from the "Untitled Profile" default via
      // the name editor or by loading a library/saved profile) — falls
      // back to the same generated format as before this existed
      // (afs-jf-003). Command Center's approve-quote-request route has its
      // own, separately-verified concept of "user-set name" (see that
      // route's resolveItemProfileName) — the two send paths are not
      // assumed symmetric.
      const trimmedProfileName = profileName.trim();
      const userSetProfileName =
        trimmedProfileName !== '' && trimmedProfileName !== 'Untitled Profile' ? trimmedProfileName : null;
      const generatedProfileName = buildFallbackProfileName(
        material || null,
        gauge || null,
        jobName.trim() || null,
        clientBusinessName.trim() || null,
        clientName.trim() || null,
        poNumber.trim() || null
      );
      const res = await fetch('/api/studio/send-to-pathfinder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: userSetProfileName ?? generatedProfileName,
          points,
          material: material || null,
          gauge: gauge || null,
          color: color.trim() || null,
          clientBusinessName: clientBusinessName.trim() || null,
          clientName: clientName.trim() || null,
          poNumber: poNumber.trim() || null,
          jobName: jobName.trim() || null,
          requestedDeliveryDate: requestedDeliveryDate || null,
          finish: isAluminum ? (finish || null) : null,
          // PathfinderEdge profile-level paintedSide. Only meaningful when
          // the part is actually painted (paintFaceSelectable gates the UI
          // control itself); unpainted sends null, which the adapter maps to
          // the spec's "None".
          paintFace: paintFaceSelectable ? paintFace : null,
          thicknessIn,
          quantity: Number(quantity) || null,
          lengthFt: lengthFtDecimal || null,
          notes: notes.trim() || null,
          geometryImage,
          hemStart: hemStart
            ? { type: hemStart.type, gapIn: hemStart.gapIn, lengthIn: hemStart.lengthIn, kick: hemStart.kick }
            : null,
          hemEnd: hemEnd
            ? { type: hemEnd.type, gapIn: hemEnd.gapIn, lengthIn: hemEnd.lengthIn, kick: hemEnd.kick }
            : null,
        }),
      });
      const data = (await res.json()) as { profileId?: string | null; message?: string; error?: string };
      if (!res.ok) {
        setPathfinderState('error');
        setPathfinderMessage(data.error ?? 'Could not send profile to PathfinderEdge.');
        return;
      }
      setPathfinderState('success');
      setPathfinderMessage(data.profileId ? `PathfinderEdge profileId: ${data.profileId}` : (data.message ?? 'Sent.'));
    } catch {
      setPathfinderState('error');
      setPathfinderMessage('Network error. Please try again.');
    }
  };

  const buildBendSummary = (): string => {
    if (points.length < 2) return 'No profile drawn.';
    const segments: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      segments.push(`${dist(points[i], points[i + 1]).toFixed(3)}"`);
    }
    const angles: string[] = [];
    const radii: string[] = [];
    for (let i = 1; i < points.length - 1; i++) {
      angles.push(`${bendAngleAt(points[i - 1], points[i], points[i + 1]).toFixed(0)}°`);
      radii.push(`${getEffectiveRadius(i).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}"`);
    }
    const hemParts: string[] = [];
    if (hemStart) hemParts.push(`start ${hemStart.type} (${hemStart.lengthIn.toFixed(3)}" fold, ${hemStart.gapIn.toFixed(3)}" gap)`);
    if (hemEnd) hemParts.push(`end ${hemEnd.type} (${hemEnd.lengthIn.toFixed(3)}" fold, ${hemEnd.gapIn.toFixed(3)}" gap)`);
    return `FlashDraft profile — legs: ${segments.join(' / ')}${angles.length ? `; bend angles: ${angles.join(' / ')}` : ''}${radii.length ? `; bend radii: ${radii.join(' / ')}` : ''}${hemParts.length ? `; hems: ${hemParts.join(', ')}` : ''}`;
  };

  const submitQuoteRequest = useCallback(
    async (email?: string, paintFace?: PaintFace | null) => {
      if (points.length < 2) {
        setSubmitError('Draw at least one bend segment before submitting.');
        return;
      }
      if (!material || !gauge) {
        setSubmitError('Select a material and gauge before submitting.');
        return;
      }
      if (!colorSatisfied) {
        setSubmitError(colorRequirementErrorMessage(material, finish || null));
        return;
      }

      setSubmitError(null);
      setSubmitState('submitting');

      const bendRadiiIn: number[] = [];
      for (let i = 1; i < points.length - 1; i++) {
        bendRadiiIn.push(getEffectiveRadius(i));
      }

      // Same shop-floor snapshot sendToPathfinder() builds (see
      // buildShopSnapshotImage above) — stored on the line item so a later
      // Command Center approval (approve-quote-request/route.ts,
      // server-side, no live canvas to read) can reuse this exact rendered
      // image for shop_profile_library.geometry_svg (afs-sv-009) instead of
      // re-rendering anything.
      const geometryImage = buildShopSnapshotImage(paintFace ?? null) ?? undefined;

      // Same "user-set name" resolution sendToPathfinder() uses (afs-jf-003)
      // — only included on the line item when the user actually renamed the
      // canvas profile away from the default; the Command Center approval
      // route (approve-quote-request/route.ts's resolveItemProfileName)
      // falls back to its own generated describeItem() format when absent,
      // exactly as it did before this field existed.
      const trimmedProfileNameForSubmit = profileName.trim();
      const userSetProfileNameForSubmit =
        trimmedProfileNameForSubmit !== '' && trimmedProfileNameForSubmit !== 'Untitled Profile'
          ? trimmedProfileNameForSubmit
          : undefined;

      try {
        const res = await fetch('/api/quote-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                profileType: 'Custom FlashDraft Profile',
                profileName: userSetProfileNameForSubmit,
                material,
                gauge,
                lengthFt: lengthFtDecimal || 0,
                quantity: Number(quantity) || 1,
                unit: 'LF',
                points,
                bendRadiiIn,
                geometryImage,
                // Auto-generated bend/leg/radius/hem technical readout
                // (afs-fl-012) — sent as its own field instead of folded
                // into the top-level `notes` string, so it can render as a
                // distinct block under "Requested Profiles" on the Command
                // Center card instead of burying (or, with no customer
                // text, replacing entirely) whatever the customer actually
                // typed in Customer Notes. See buildBendSummary above.
                geometrySummary: buildBendSummary(),
                hemStart: hemStart
                  ? { type: hemStart.type, gapIn: hemStart.gapIn, lengthIn: hemStart.lengthIn, kick: hemStart.kick }
                  : undefined,
                hemEnd: hemEnd
                  ? { type: hemEnd.type, gapIn: hemEnd.gapIn, lengthIn: hemEnd.lengthIn, kick: hemEnd.kick }
                  : undefined,
                paint_face: paintFace ?? undefined,
              },
            ],
            // Customer-typed text only (afs-fl-012) — matches the pattern
            // in app/api/field/quote-request/route.ts. The auto-generated
            // bend/leg/radius/hem summary travels on the line item itself
            // as `geometrySummary` (see above), not folded in here.
            notes: notes.trim() || null,
            // afs-fl-026: the Rush Order toggle was removed from this page's
            // sidebar (Reid: "they have notes" — rush requests now go in the
            // Notes field above instead) — isRush is intentionally omitted
            // here rather than hardcoded false; app/api/quote-requests/
            // route.ts already treats a missing isRush as false.
            color: color.trim() || null,
            finish: isAluminum ? (finish || null) : null,
            clientBusinessName: clientBusinessName.trim() || null,
            clientName: clientName.trim() || null,
            poNumber: poNumber.trim() || null,
            jobName: jobName.trim() || null,
            requestedDelivery: requestedDeliveryDate || null,
            guestEmail: email,
            sourceTool: 'afs-flashdraft',
          }),
        });
        const data = (await res.json()) as { requestNumber?: string; error?: string };
        if (!res.ok) {
          setSubmitError(data.error ?? 'Submission failed. Please try again.');
          setSubmitState('idle');
          return;
        }
        setRequestNumber(data.requestNumber ?? null);
        setShowEmailCapture(false);
        setSubmitState('submitted');
        try {
          window.localStorage.removeItem(AUTOSAVE_KEY);
        } catch {
          // Best-effort — browser may be blocking local storage.
        }
      } catch {
        setSubmitError('Submission failed. Please try again.');
        setSubmitState('idle');
      }
    },
    [
      points,
      material,
      gauge,
      color,
      finish,
      isAluminum,
      colorSatisfied,
      lengthFtDecimal,
      quantity,
      notes,
      profileName,
      clientBusinessName,
      clientName,
      poNumber,
      jobName,
      requestedDeliveryDate,
      getEffectiveRadius,
      hemStart,
      hemEnd,
      buildShopSnapshotImage,
    ]
  );

  const openSubmitFlow = () => {
    if (points.length < 2) {
      setSubmitError('Draw at least one bend segment before submitting.');
      return;
    }
    if (!material || !gauge) {
      setSubmitError('Select a material and gauge before submitting.');
      return;
    }
    if (!colorSatisfied) {
      setSubmitError(colorRequirementErrorMessage(material, finish || null));
      return;
    }
    setSubmitError(null);
    setShow3DConfirm(true);
  };

  const handle3DConfirmed = (confirmedFace: PaintFace | null) => {
    setConfirmedPaintFace(confirmedFace);
    // Keep the 2D sidebar's toggle in sync with whatever the 3D modal was
    // actually confirmed with (it seeds from `paintFace` but the customer
    // can still flip it there) — so re-opening the 3D confirm later, or
    // looking back at the 2D sidebar, doesn't show a stale choice.
    if (confirmedFace) setPaintFace(confirmedFace);
    setShow3DConfirm(false);
    if (isAuthenticated) {
      submitQuoteRequest(undefined, confirmedFace);
    } else {
      setShowEmailCapture(true);
    }
  };

  // Recomputed each render from the live canvas ref — cheap arithmetic, not
  // a hook, so no rules-of-hooks concern with calling it unconditionally.
  const canvas = canvasRef.current;
  // Hidden while a reshape drag is actively in progress (draggingVertexIndex
  // set alongside selectedSegment — see the leg-body candidate resolution in
  // handlePointerMove): showing the length field mid-drag meant it sat next
  // to the leg's blue "selected" highlight displaying a value the drag had
  // already moved past, reading as stale/conflicting rather than as
  // feedback. Reappears the instant the drag ends (draggingVertexIndex
  // resets to null in handlePointerUp), by which point the sync effect
  // above has already updated it to the leg's new, real length.
  const segmentInputPos =
    selectedSegment !== null && canvas && draggingVertexIndex === null
      ? (() => {
          const a = worldToScreen(points[selectedSegment], canvas);
          const b = worldToScreen(points[selectedSegment + 1], canvas);
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        })()
      : null;

  // Part 2 — Profile Info Panel figures, computed synchronously (not from
  // the debounced match/viewer effects) so they read as genuinely "live".
  let blankWidthInLive = 0;
  for (let i = 0; i < points.length - 1; i++) blankWidthInLive += dist(points[i], points[i + 1]);
  blankWidthInLive += hemAllowanceIn(hemStart, thicknessIn) + hemAllowanceIn(hemEnd, thicknessIn);
  const bendCountLive = Math.max(0, points.length - 2);
  const hemCountLive = (hemStart ? 1 : 0) + (hemEnd ? 1 : 0);

  // Part 6 — split-screen match panel + its "View in 3D" target geometry.
  const showSplit = !splitDismissed && matches.length > 0 && matches[0].score >= MATCH_SPLIT_THRESHOLD;
  const matchedProfileBends: ProfileBend[] = (topMatchDiagramBends ?? []).map((b) => ({
    leftLeg: b.leftLegMm ?? 0,
    rightLeg: b.rightLegMm ?? 0,
    angle: b.bendAngleDegrees ?? 180,
    radius: b.radiusMm ?? 0,
  }));
  const matchedProfileBlankWidthMm =
    matchedProfileBends.reduce((s, b) => s + b.leftLeg, 0) + (matchedProfileBends[matchedProfileBends.length - 1]?.rightLeg ?? 0);

  if (submitState === 'submitted') {
    return (
      <main className="min-h-screen bg-afs-bg-base py-16 px-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
            <h2 className="font-heading text-3xl text-afs-chrome-high mb-3">Quote Request Submitted</h2>
            {requestNumber && <p className="font-data text-sm text-afs-crimson mb-3">{requestNumber}</p>}
            <p className="font-body text-sm text-afs-chrome-mid mb-8">
              AFS will review your FlashDraft profile and follow up with a formal quote.
            </p>
            <a
              href="/account/quotes"
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              View My Requests
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    // afs-fl-026 mobile fix (partial — see STATE_OF_THE_BUILD.md): the prior
    // fixed-height + overflow-hidden shell below (still exact/unchanged at
    // lg+) gave a narrow viewport NO way to scroll at all, which is also why
    // the canvas panel was being squeezed to ~76px tall on a 375px-wide
    // screen (see the min-h-[400px] comment below) — a real, separate bug
    // from the chat-trigger overlap, on top of it. Below `lg`, this page can
    // now scroll like the rest of the site (`min-h` instead of a hard `h`,
    // `overflow-visible` instead of `overflow-hidden`). This does NOT, by
    // itself, eliminate the site-wide chat trigger's overlap with the
    // sidebar's Save/Clear/Load row flagged in afs-fl-026's second
    // verification pass — that row's rendered position is unchanged by this
    // fix (confirmed live: still overlaps at the default/top scroll
    // position). Reordering the canvas/sidebar was tried and rejected: it
    // only relocated the same collision onto the Material/Gauge selects
    // instead, which are used earlier and more often. Eliminating the
    // overlap entirely needs either a page-specific accommodation in the
    // shared ChatWidget trigger or a deliberate mobile redesign of this
    // sidebar — a design call, not something to guess at here.
    <main className="min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] bg-afs-bg-base flex flex-col overflow-visible lg:overflow-hidden">
      <div className="px-6 py-1 border-b border-afs-chrome-dim flex items-center gap-4 shrink-0">
        {/* Only shown when this session opened a saved profile from Profile
            Passport (afs-pp-002) -- a fresh/new drawing has nowhere to "go
            back" to. */}
        {viewingFromPassport && (
          <Link
            href="/app/profile-passport"
            className="font-label text-xs font-semibold text-afs-chrome-mid hover:text-afs-chrome-high transition-colors whitespace-nowrap"
          >
            ← Back to Profiles
          </Link>
        )}
        <div className="flex items-baseline gap-2">
          <span className="font-label text-afs-crimson text-[10px] tracking-widest uppercase">FlashDraft</span>
          <h1 className="font-heading text-base text-afs-chrome-high leading-tight">Draw Your Profile</h1>
        </div>
      </div>

      {viewingFromPassport && isLocked && (
        <div className="px-6 py-2 bg-afs-accent-green/10 border-b border-afs-accent-green/40 shrink-0">
          <p className="font-label text-xs font-semibold text-afs-accent-green">
            <LockIcon className="h-3 w-3 inline mr-1.5 -mt-0.5" aria-hidden="true" />
            This profile is locked. View only.
          </p>
        </div>
      )}

      {/* PART 1 — PROFESSIONAL TOOLBAR (single row) */}
      <div className="px-4 py-1.5 border-b border-afs-chrome-dim shrink-0 bg-afs-bg-dim">
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <ToolbarButton icon="new" label="New" onClick={() => setShowNewConfirm(true)} />
          <ToolbarButton icon="open" label="My Saved Profiles" onClick={openSavedProfiles} />
          <ToolbarButton icon="save" label="Save" onClick={openSaveModal} disabled={points.length < 2 || isLocked} />
          {/* Duplicate stays enabled while locked -- "make an editable copy
              of this locked profile" is a reasonable thing to want, and
              openDuplicateModal always saves as a brand-new (unlocked)
              record, never mutating the locked one. */}
          <ToolbarButton icon="duplicate" label="Duplicate" onClick={openDuplicateModal} disabled={points.length < 2} />
          <ToolbarButton icon="editName" label="Edit Name" onClick={openSaveModal} disabled={!savedProfileId} />
          <ToolbarButton icon="print" label="Print" onClick={printCanvas} />
          <span className="w-px h-5 bg-afs-chrome-dim mx-1" />
          <ToolbarButton icon="fitToScreen" label="Fit to Screen" onClick={fitToScreen} disabled={points.length === 0} />
          <ToolbarButton icon="center" label="Center" onClick={centerView} />
          <ToolbarButton icon="zoomOut" label="Zoom Out" onClick={() => setZoom((z) => Math.max(0.25, z * (1 - ZOOM_STEP_RATIO)))} />
          <ToolbarButton icon="zoomIn" label="Zoom In" onClick={() => setZoom((z) => Math.min(4, z * (1 + ZOOM_STEP_RATIO)))} />
          <span className="font-data text-[10px] text-afs-chrome-dim px-1 self-center">{Math.round(zoom * 100)}%</span>
          <ToolbarButton icon="undo" label="Undo" onClick={undo} disabled={past.length === 0 || isLocked} />
          <ToolbarButton icon="redo" label="Redo" onClick={redo} disabled={future.length === 0 || isLocked} />
          <ToolbarButton icon="rotateLeft" label="Rotate Left" onClick={() => rotateProfile(-ROTATE_STEP_DEG)} disabled={points.length < 2 || isLocked} />
          <ToolbarButton icon="rotateRight" label="Rotate Right" onClick={() => rotateProfile(ROTATE_STEP_DEG)} disabled={points.length < 2 || isLocked} />
          <ToolbarButton
            icon="delete"
            label="Delete"
            onClick={deleteSelected}
            disabled={isLocked || (selectedBendPoint === null && selectedSegment === null)}
          />
          <ToolbarButton icon="prev" label="Prev" onClick={() => selectAdjacentBendPoint(-1)} disabled={points.length < 3} />
          <ToolbarButton icon="next" label="Next" onClick={() => selectAdjacentBendPoint(1)} disabled={points.length < 3} />
          <span className="w-px h-5 bg-afs-chrome-dim mx-1" />
          <div className="flex items-center gap-1 bg-afs-bg-overlay border border-afs-border rounded p-0.5" role="group" aria-label="View mode">
            {(['2d', '3d'] as const).map((v) => {
              const isActive = viewMode === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewMode(v)}
                  title={v === '2d' ? '2D View' : '3D View'}
                  aria-pressed={isActive}
                  // afs-fl-026: the 3D button now carries afs-crimson permanently
                  // (Reid's request), so color alone can no longer show which
                  // mode is active — a white ring on whichever button IS active
                  // is the surviving indicator instead.
                  className={`font-label text-[10px] px-2 py-1 rounded transition-colors text-white ${
                    v === '3d' ? 'bg-afs-crimson' : 'bg-afs-bg-raised'
                  } ${isActive ? 'ring-2 ring-white' : ''}`}
                >
                  {v === '2d' ? '2D' : '3D'}
                </button>
              );
            })}
          </div>
        </div>
        <p
          className="font-body text-[10px] text-afs-chrome-dim mt-1 hidden md:block"
          title="Click empty space to draw · click a segment or bend to select it · double-click an endpoint for a hem · Alt+drag to move the whole profile · Shift+drag to start a new leg from the first leg's free end"
        >
          Click empty space to draw · click a segment or bend to select it · double-click an endpoint for a hem ·
          Alt+drag to move the whole profile · Shift+drag to start a new leg from the first leg&apos;s free end
        </p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 pt-4 px-4 pb-4 lg:pb-0 min-h-0">
        {/* LEFT PANEL */}
        <div className="w-full lg:w-[320px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-3.5 flex flex-col gap-2.5 overflow-y-auto">
          {/* Entry point 2/3 of Profile Passport (Phase 3, afs-pp-001) — the
              main site nav (top right) and this button both route to
              /app/profile-passport; distinct from "Load Profiles" further
              down, which also lands there but via the profile-loading flow
              specifically. */}
          <Link
            href="/app/profile-passport"
            className="flex items-center justify-center gap-2 border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
          >
            <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Profile Passport
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block" htmlFor="material">
                Material
              </label>
              <select
                id="material"
                value={material}
                onChange={(e) => {
                  setMaterial(e.target.value);
                  setGauge('');
                  setColor('');
                  setFinish('');
                }}
                className="w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-3 py-2 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors"
              >
                <option value="" disabled>
                  Select
                </option>
                {ALL_MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block" htmlFor="gauge">
                Gauge
              </label>
              <select
                id="gauge"
                value={gauge}
                disabled={!material}
                onChange={(e) => setGauge(e.target.value)}
                className="w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-3 py-2 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-40"
              >
                <option value="" disabled>
                  {material ? 'Select' : '—'}
                </option>
                {gaugeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {colorPalette === 'mcelroy' && (
            <ColorField
              palette="mcelroy"
              value={color || null}
              onChange={setColor}
              error={color.trim() === '' ? `Required for ${material}.` : null}
            />
          )}

          {isAluminum && (
            <FinishColorField
              material={material}
              finish={finish || null}
              onFinishChange={(f) => {
                setFinish(f);
                setColor('');
              }}
              color={color}
              onColorChange={setColor}
            />
          )}

          {paintFaceSelectable && (
            <div>
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block">
                Painted Side
              </label>
              <div className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded shrink-0 border border-afs-chrome-dim"
                  // Literal hex fill — same CANVAS_COLORS-style exception this
                  // file already documents (CLAUDE.md rule #4): the real
                  // selected color/finish has no afs-* token equivalent.
                  style={{ backgroundColor: resolvedPaintColor }}
                  aria-hidden="true"
                />
                <div className="flex gap-2 flex-1">
                  {(['up', 'down'] as PaintFace[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPaintFace(f)}
                      className={`flex-1 font-label text-xs px-3 py-2 rounded border transition-colors ${
                        paintFace === f
                          ? 'bg-afs-crimson text-white border-afs-crimson'
                          : 'bg-afs-bg-overlay text-white border-afs-border hover:border-afs-chrome-base'
                      }`}
                    >
                      {f === 'up' ? 'Painted Side Up' : 'Painted Side Down'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block">Length</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim mb-1 block" htmlFor="lengthFeet">
                  Feet
                </label>
                <input
                  id="lengthFeet"
                  type="number"
                  min="0"
                  step="1"
                  value={lengthFeet}
                  onChange={(e) => setLengthFeet(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-1.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
                />
              </div>
              <div>
                <label className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim mb-1 block" htmlFor="lengthInches">
                  Inches
                </label>
                <input
                  id="lengthInches"
                  type="number"
                  min="0"
                  max="11.875"
                  step="0.0625"
                  value={lengthInches}
                  onChange={(e) => setLengthInches(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-1.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block" htmlFor="quantity">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-1.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>

          {selectedBendPoint !== null && (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3 flex flex-col gap-2">
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block" htmlFor="angleMode">
                Angle (degrees)
              </label>
              <div className="flex gap-2">
                <select
                  id="angleMode"
                  value={angleInputMode}
                  onChange={(e) => setAngleInputMode(e.target.value as 'angle' | 'length')}
                  className="bg-afs-bg-overlay border-afs-accent-green border-2 rounded px-2 py-2 font-data text-xs text-afs-chrome-high focus:outline-none transition-colors"
                >
                  <option value="angle">Angle</option>
                  <option value="length">Length</option>
                </select>
                {angleInputMode === 'angle' ? (
                  <input
                    id="angleValue"
                    type="text"
                    inputMode="decimal"
                    value={angleInputDraft}
                    onChange={(e) => setAngleInputDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyBendAngle();
                    }}
                    onBlur={applyBendAngle}
                    className="flex-1 min-w-0 bg-afs-bg-overlay border-afs-accent-green border-2 rounded px-3 py-2 font-data text-sm text-afs-chrome-high focus:outline-none transition-colors"
                  />
                ) : (
                  <input
                    disabled
                    placeholder="Coming soon"
                    className="flex-1 min-w-0 bg-afs-bg-overlay border-afs-accent-green border-2 rounded px-3 py-2 font-data text-sm text-afs-chrome-dim focus:outline-none transition-colors opacity-50"
                  />
                )}
              </div>
            </div>
          )}

          {selectedBendPoint !== null && (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3">
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block" htmlFor="bendRadius">
                Bend Radius (in)
              </label>
              <input
                id="bendRadius"
                type="number"
                step="0.0625"
                min="0.125"
                value={bendRadiusInput}
                onChange={(e) => {
                  setBendRadiusInput(e.target.value);
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) applyBendRadius(selectedBendPoint, v);
                }}
                // Canvas 2D drawing for this same control can't consume Tailwind
                // tokens (see CANVAS_COLORS above) — this input mirrors that
                // exact bright-green so the panel field and the canvas handle
                // read as the same control.
                className="w-full bg-afs-bg-overlay border-afs-accent-green border-2 rounded px-3 py-2 font-data text-sm text-afs-chrome-high focus:outline-none transition-colors"
              />
            </div>
          )}

          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1 block" htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else we should know? (e.g. rush timeline)"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-1.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>

          {/* Profile Match sidebar list removed (afs-fl-028) -- the
              underlying matches/matchLoading/topMatchDiagramBends state and
              fetch effect are UNCHANGED and still deliberately kept: they
              also power the separate "Part 6" split-screen exact-match 3D
              view (showSplit/MatchedProfile3DModal below), which this task
              didn't ask to remove. Only this sidebar list is gone. */}

          {submitError && <p className="font-body text-sm text-afs-crimson">{submitError}</p>}
          {draftSavedNotice && <p className="font-body text-sm text-afs-success">Draft saved to this browser.</p>}

          {showEmailCapture && (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4">
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block" htmlFor="guestEmail">
                Email Address
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  id="guestEmail"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 min-w-[160px] bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
                />
                <button
                  type="button"
                  onClick={() => submitQuoteRequest(guestEmail.trim(), confirmedPaintFace)}
                  disabled={submitState === 'submitting'}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 rounded text-sm transition-colors disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-auto pt-2">
            {/* Lock Profile & Save to Passport -- shown once a real profile
                exists (points.length >= 2, same threshold Save/Duplicate
                already use). Zero-friction, no-modal auto-save
                (lockAndSaveProfile, Phase 3/afs-pp-001) still reuses
                performSave's exact tested validation/DB-write path. Once
                locked, this is replaced by a status row with an Unlock
                control -- the visual indicator the task asked for, not just
                the grayed-out canvas. justLocked is a purely transient
                (~3.5s) confirmation flash on top of that permanent state,
                not a substitute for it -- the canvas stays genuinely locked
                (isLocked) the whole time, spec's own "disable all geometry
                editing tools while is_locked = true" requirement holds
                throughout, even while this flash is showing. */}
            {points.length >= 2 && (
              isLocked ? (
                justLocked ? (
                  <div className="flex items-center justify-center gap-2 rounded border border-afs-accent-green bg-afs-accent-green/10 px-4 py-3">
                    <span className="flex items-center gap-2 font-label text-sm font-semibold text-afs-accent-green">
                      ✓ Profile Saved & Locked
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded border border-afs-accent-green bg-afs-accent-green/10 px-4 py-3">
                    <span className="flex items-center gap-2 font-label text-sm font-semibold text-afs-accent-green">
                      <LockIcon className="h-4 w-4" aria-hidden="true" />
                      Profile Locked & Saved
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsLocked(false)}
                      className="font-label text-xs font-semibold text-afs-chrome-mid underline underline-offset-2 hover:text-afs-chrome-high"
                    >
                      Unlock to Edit
                    </button>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={lockAndSaveProfile}
                  disabled={savingProfile}
                  className="flex items-center justify-center gap-2 border-2 border-afs-accent-green text-afs-accent-green hover:bg-afs-accent-green hover:text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50"
                >
                  <LockIcon className="h-4 w-4" aria-hidden="true" />
                  {savingProfile ? 'Saving…' : 'Lock Profile & Save to Passport'}
                </button>
              )
            )}
            <button
              type="button"
              onClick={openSubmitFlow}
              disabled={submitState === 'submitting' || showEmailCapture}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50"
            >
              {submitState === 'submitting' ? 'Submitting…' : 'Submit for Quote'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={saveDraft}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2.5 rounded transition-colors"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={isLocked}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-afs-bg-overlay"
              >
                Clear
              </button>
              {/* Phase 3 (afs-pp-001) -- routes to the Profile Passport
                  dashboard instead of the old in-canvas Load modal; picking
                  a profile there navigates back here with ?loadPassport=<id>
                  (see the mount effect below) rather than loading inline. */}
              <Link
                href="/app/profile-passport"
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2.5 rounded transition-colors text-center"
              >
                Load Profiles
              </Link>
            </div>

            {isAdmin && adminContext && (
              <div className="border-t border-afs-chrome-dim/40 pt-2 mt-1 flex flex-col gap-1.5">
                <p className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-mid">Admin</p>
                <button
                  type="button"
                  onClick={sendToPathfinder}
                  disabled={pathfinderState === 'sending'}
                  className="border border-afs-accent-purple bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2.5 rounded transition-colors disabled:opacity-50"
                >
                  {pathfinderState === 'sending' ? 'Sending…' : 'Send to PathfinderEdge'}
                </button>
                {pathfinderState === 'success' && (
                  <p className="font-body text-xs text-afs-success">{pathfinderMessage}</p>
                )}
                {pathfinderState === 'error' && (
                  <p className="font-body text-xs text-afs-crimson">{pathfinderMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — CANVAS (+ Part 6 split-screen match panel) */}
        {/* min-h-[400px]: on mobile the row above no longer sits in a fixed-
            height/overflow-hidden shell (see the `main` comment above), so
            this flex-1 child would otherwise collapse toward 0 once the
            sidebar's own natural content height exceeds the viewport —
            reproduced live at 375px where the canvas measured 76px tall
            before this fix. A real minimum keeps the canvas usable instead
            of being squeezed away. Unchanged at lg+ (min-h-0, as before). */}
        <div className="flex-1 min-w-0 flex flex-col min-h-[400px] lg:min-h-0">
          <div className="flex-1 min-h-0 flex overflow-hidden rounded border border-afs-chrome-dim metal-edge bg-afs-bg-raised">
            <div
              ref={canvasWrapRef}
              className="relative min-h-0 overflow-hidden transition-[flex-basis] duration-300 ease-in-out"
              style={{ flexBasis: showSplit ? '60%' : '100%', flexGrow: 0, flexShrink: 0, minWidth: 0 }}
            >
              {viewMode === '3d' && (
                <div className="absolute inset-0">
                  <ProfileViewer3D
                    bends={viewerBends}
                    blankWidth={viewerBlankWidthMm}
                    material={material || 'Galvanized Steel'}
                    gauge={gauge || GAUGES_BY_MATERIAL['Galvanized Steel']?.[1] || '24 ga'}
                    thicknessMm={gaugeToThicknessMm(gauge || GAUGES_BY_MATERIAL['Galvanized Steel']?.[1])}
                    profileName={profileName}
                    hemStart={hemStart}
                    hemEnd={hemEnd}
                    paintFace={paintFaceSelectable ? paintFace : undefined}
                    paintColor={paintFaceSelectable ? resolvedPaintColor : undefined}
                    bareColor={paintFaceSelectable ? BARE_METAL_COLOR : undefined}
                    className="w-full h-full"
                  />
                </div>
              )}

              {viewMode === '2d' && (
                <>
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => e.preventDefault()}
                className={`w-full h-full ${isLocked ? 'grayscale-[40%] opacity-80' : ''}`}
                // pointerEvents: 'none' while locked is the primary guard --
                // every handler above also checks isLocked itself (defense
                // in depth, matching this file's own established pattern),
                // but this is what actually stops the cursor from doing
                // anything at all, including view-only hover feedback.
                style={{
                  touchAction: 'none',
                  cursor: isLocked ? 'not-allowed' : 'crosshair',
                  background: CANVAS_COLORS.background,
                  pointerEvents: isLocked ? 'none' : 'auto',
                }}
              />

              {/* PART 2 — PROFILE INFO PANEL (afs-jf-006: renamed placeholder,
                  dismissible via its own X, Job Info moved to a right-side
                  drawer below instead of expanding inline). */}
              {profileBoxCollapsed ? (
                <button
                  type="button"
                  onClick={() => setProfileBoxCollapsed(false)}
                  className="absolute z-20 bg-black/70 text-white rounded px-3 py-2 font-semibold hover:bg-black/80"
                  style={{ top: 8, left: 8, fontFamily: jetbrainsFontRef.current, fontSize: 12 }}
                >
                  Profile Info
                </button>
              ) : (
                <div
                  className="absolute z-20 bg-black/70 text-white rounded px-3 py-2 flex flex-col gap-0.5"
                  style={{ top: 8, left: 8, fontFamily: jetbrainsFontRef.current, fontSize: 12 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    {editingName ? (
                      <input
                        autoFocus
                        value={profileNameDraft}
                        onChange={(e) => setProfileNameDraft(e.target.value)}
                        onBlur={commitProfileName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitProfileName();
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                        className="bg-transparent border-b border-white/40 outline-none text-white"
                        style={{ fontFamily: jetbrainsFontRef.current, fontSize: 12, width: 150 }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileNameDraft(profileName === 'Untitled Profile' ? '' : profileName);
                          setEditingName(true);
                        }}
                        className={`text-left hover:underline font-semibold ${
                          profileName === 'Untitled Profile' ? 'italic opacity-60' : ''
                        }`}
                      >
                        {profileName === 'Untitled Profile' ? 'Name your profile' : profileName}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setProfileBoxCollapsed(true);
                        setShowJobInfo(false);
                        clearJobInfoFields();
                      }}
                      aria-label="Close profile info"
                      className="text-white/60 hover:text-white leading-none -mt-0.5 -mr-0.5"
                    >
                      ✕
                    </button>
                  </div>
                  <span>Blank Width: {formatInches(blankWidthInLive)}</span>
                  <span>Bend Count: {bendCountLive}</span>
                  <span>Hem Count: {hemCountLive}</span>
                  <span>Revision: {revision}</span>
                  {isLocked && (
                    <span className="flex items-center gap-1 font-semibold text-afs-accent-green">
                      <LockIcon className="h-3 w-3" aria-hidden="true" />
                      Locked
                    </span>
                  )}

                  {/* Job-identity intake fields (migration 018/019, afs-jf-000/
                      afs-jf-004) pop down inline below, in this same
                      translucent left-side box -- reverted from afs-jf-006's
                      right-side full-height drawer back to the original
                      left-side/pop-down treatment. Toggling closed always
                      clears the fields (afs-jf-006's fix for the old
                      close-doesn't-clear persist bug -- kept; only the
                      position/style reverted, not that fix). */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showJobInfo;
                      setShowJobInfo(next);
                      if (!next) clearJobInfoFields();
                    }}
                    className="text-left font-semibold hover:underline mt-1 pt-1 border-t border-white/20"
                  >
                    {showJobInfo ? '− Job Info' : '+ Job Info'}
                  </button>

                  {showJobInfo && (
                    <div className="flex flex-col gap-2 mt-1 pt-1 border-t border-white/20" style={{ width: 220 }}>
                      <div>
                        <label
                          className="font-label text-[10px] uppercase tracking-wide text-white/70 mb-1 block"
                          htmlFor="clientBusinessName"
                        >
                          Business Name (optional)
                        </label>
                        <input
                          id="clientBusinessName"
                          type="text"
                          value={clientBusinessName}
                          onChange={(e) => setClientBusinessName(e.target.value)}
                          placeholder="Company name"
                          className="w-full bg-black/30 border border-white/20 rounded px-2 py-1.5 font-body text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-afs-crimson transition-colors"
                        />
                      </div>
                      <div>
                        <label
                          className="font-label text-[10px] uppercase tracking-wide text-white/70 mb-1 block"
                          htmlFor="clientName"
                        >
                          Client Name (optional)
                        </label>
                        <input
                          id="clientName"
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Contact name"
                          className="w-full bg-black/30 border border-white/20 rounded px-2 py-1.5 font-body text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-afs-crimson transition-colors"
                        />
                      </div>
                      <div>
                        <label
                          className="font-label text-[10px] uppercase tracking-wide text-white/70 mb-1 block"
                          htmlFor="poNumber"
                        >
                          PO Number (optional)
                        </label>
                        <input
                          id="poNumber"
                          type="text"
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          placeholder="e.g. PO-10234"
                          className="w-full bg-black/30 border border-white/20 rounded px-2 py-1.5 font-body text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-afs-crimson transition-colors"
                        />
                      </div>
                      <div>
                        <label
                          className="font-label text-[10px] uppercase tracking-wide text-white/70 mb-1 block"
                          htmlFor="jobName"
                        >
                          Job Name (optional)
                        </label>
                        <input
                          id="jobName"
                          type="text"
                          value={jobName}
                          onChange={(e) => setJobName(e.target.value)}
                          placeholder="e.g. Smith Residence Reroof"
                          className="w-full bg-black/30 border border-white/20 rounded px-2 py-1.5 font-body text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-afs-crimson transition-colors"
                        />
                      </div>
                      <div>
                        <label
                          className="font-label text-[10px] uppercase tracking-wide text-white/70 mb-1 block"
                          htmlFor="requestedDeliveryDate"
                        >
                          Requested Delivery Date (optional)
                        </label>
                        <input
                          id="requestedDeliveryDate"
                          type="date"
                          value={requestedDeliveryDate}
                          onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                          className="w-full bg-black/30 border border-white/20 rounded px-2 py-1.5 font-body text-xs text-white focus:outline-none focus:border-afs-crimson transition-colors"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}


              {isDragDrawing && dragPreview && dragScreenPos && (
              <div
                className="absolute z-20 pointer-events-none font-label font-semibold rounded"
                style={{
                  left: dragScreenPos.x + 16,
                  top: dragScreenPos.y + 16,
                  background: CANVAS_COLORS.dragLabelBg,
                  color: CANVAS_COLORS.dragLabelText,
                  padding: 8,
                  borderRadius: 4,
                  fontSize: 16,
                  whiteSpace: 'nowrap',
                }}
              >
                {dragPreview.length.toFixed(3)}&quot;
                <span className="ml-2 opacity-80">{Math.round(dragPreview.angleDeg)}°</span>
              </div>
            )}

            {segmentInputPos && (
              <input
                key={`seg-input-${selectedSegment}`}
                autoFocus
                type="text"
                inputMode="decimal"
                value={segmentLengthInput}
                onChange={(e) => setSegmentLengthInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySegmentLength();
                  if (e.key === 'Escape') setSelectedSegment(null);
                }}
                onBlur={applySegmentLength}
                className="absolute z-20 text-center"
                style={{
                  left: segmentInputPos.x - 44,
                  top: segmentInputPos.y - 14,
                  width: 88,
                  background: '#FFFFFF',
                  color: '#111111',
                  border: '1px solid #00C853',
                  fontFamily: jetbrainsFontRef.current,
                  padding: '4px 8px',
                  borderRadius: 3,
                  fontSize: 12,
                }}
              />
            )}

            {hemPopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHemPopup(null)} />
                <div
                  className="absolute z-50 bg-afs-bg-raised border border-afs-chrome-dim rounded shadow-raised p-3 flex flex-col gap-2"
                  style={{ top: 16, right: 16, minWidth: 190 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-mid">
                    {hemPopup.endpoint === 'start' ? 'Start' : 'End'} Hem
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['open', 'smashed', 'teardrop'] as HemType[]).map((t) => {
                      const current = hemPopup.endpoint === 'start' ? hemStart : hemEnd;
                      const active = current?.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => applyHem(t)}
                          className={`font-label text-[10px] px-1.5 py-1.5 rounded border capitalize transition-colors flex flex-col items-center gap-1 ${
                            active
                              ? 'bg-afs-crimson text-white border-afs-crimson'
                              : 'bg-afs-bg-overlay text-white border-afs-border hover:bg-afs-bg-surface'
                          }`}
                        >
                          <span className="block" style={{ width: HEM_ICON_SIZE, height: HEM_ICON_SIZE }}>
                            <HemGlyphIcon type={t} />
                          </span>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  {(hemPopup.endpoint === 'start' ? hemStart : hemEnd) && (
                    <div className="flex items-center gap-2">
                      <label className="font-label text-[10px] text-afs-chrome-mid">Hem Length (in)</label>
                      <input
                        type="number"
                        step="0.0625"
                        min="0"
                        value={hemLengthDraft}
                        onChange={(e) => setHemLength(e.target.value)}
                        className="w-16 bg-afs-bg-overlay border border-afs-border rounded px-1.5 py-1 font-data text-xs text-afs-chrome-high"
                      />
                    </div>
                  )}
                  {(hemPopup.endpoint === 'start' ? hemStart : hemEnd) && (
                    <div className="flex items-center gap-2">
                      <label className="font-label text-[10px] text-afs-chrome-mid">Gap (in)</label>
                      <input
                        type="number"
                        step="0.0625"
                        min="0"
                        value={hemGapDraft}
                        onChange={(e) => setHemGap(e.target.value)}
                        className="w-16 bg-afs-bg-overlay border border-afs-border rounded px-1.5 py-1 font-data text-xs text-afs-chrome-high"
                      />
                    </div>
                  )}
                  {(hemPopup.endpoint === 'start' ? hemStart : hemEnd) && (
                    <div className="flex flex-col gap-1 pt-1 border-t border-afs-chrome-dim/40">
                      <label className="font-label text-[10px] text-afs-chrome-mid">Kick</label>
                      <div className="grid grid-cols-2 gap-1">
                        {(['outside', 'inside'] as HemKick[]).map((k) => {
                          const current = hemPopup.endpoint === 'start' ? hemStart : hemEnd;
                          const active = current?.kick === k;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setHemKick(k)}
                              className={`font-label text-[10px] px-1.5 py-1.5 rounded border capitalize transition-colors ${
                                active
                                  ? 'bg-afs-crimson text-white border-afs-crimson'
                                  : 'bg-afs-bg-overlay text-white border-afs-border hover:bg-afs-bg-surface'
                              }`}
                            >
                              {k}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    {(hemPopup.endpoint === 'start' ? hemStart : hemEnd) && (
                      <button type="button" onClick={removeHem} className="font-label text-[10px] text-afs-crimson hover:underline">
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHemPopup(null)}
                      className="font-label text-[10px] text-afs-chrome-mid hover:text-white ml-auto"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}

                </>
              )}

              {/* Part 7 — "Common Profiles" template bar, overlaid at the
                  bottom of the canvas instead of a separate row below it.
                  Cleat is intentionally excluded (see PROFILE_TEMPLATES above).
                  Coping Cap and Valley have `variants` set, so their buttons
                  open VariantPicker instead of loading geometry directly. */}
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-afs-bg-raised/95 border-t border-afs-border flex items-center gap-4 px-4 py-2">
                <span className="font-label text-xs text-afs-chrome-mid uppercase tracking-wider shrink-0">
                  Start From a Template
                </span>
                <div className="flex items-center gap-2 overflow-x-auto">
                  {PROFILE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() =>
                        template.variants ? setVariantPickerTemplate(template) : loadTemplate(template)
                      }
                      className="shrink-0 py-1.5 px-3 text-xs font-label bg-afs-crimson hover:bg-afs-crimson-hover text-white rounded transition-colors"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Always mounted, toggled via isOpen — see the doc comment on
                  VariantPicker for why conditional mount/unmount here would
                  break under React Strict Mode's dev-only double-effect. */}
              <VariantPicker
                isOpen={!!variantPickerTemplate}
                categoryLabel={variantPickerTemplate?.label ?? ''}
                variants={variantPickerTemplate?.variants ?? []}
                onSelect={handleVariantSelect}
                onClose={() => setVariantPickerTemplate(null)}
              />
            </div>

            {/* PART 6 — split-screen matched-profile panel, always mounted
                so the flex-basis/opacity change transitions smoothly. */}
            <div
              className="min-h-0 overflow-hidden transition-[flex-basis,opacity] duration-300 ease-in-out border-l border-afs-chrome-dim flex flex-col"
              style={{ flexBasis: showSplit ? '40%' : '0%', opacity: showSplit ? 1 : 0, flexGrow: 0, flexShrink: 0 }}
            >
              {matches[0] && (
                <div className="p-4 flex flex-col gap-3 overflow-y-auto h-full w-full">
                  <div className="flex items-center justify-between">
                    <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">Machine Library Match</p>
                    <button
                      type="button"
                      onClick={() => setSplitDismissed(true)}
                      className="text-afs-chrome-dim hover:text-afs-crimson text-sm leading-none"
                      aria-label="Dismiss match"
                    >
                      ✕
                    </button>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-afs-chrome-high">{matches[0].nameEn}</h3>
                  {topMatchDiagramBends && <BendSequenceDiagram bends={topMatchDiagramBends} />}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-data text-sm font-semibold text-afs-chrome-high">{matches[0].score.toFixed(0)}% match</span>
                    </div>
                    <div className="h-1.5 bg-afs-bg-dim rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          matches[0].score >= 90 ? 'bg-afs-accent-green' : matches[0].score >= 70 ? 'bg-afs-amber' : 'bg-afs-crimson'
                        }`}
                        style={{ width: `${Math.min(100, matches[0].score)}%` }}
                      />
                    </div>
                  </div>
                  {matches[0].isExactMatch && (
                    <p className="font-label text-xs font-bold text-afs-accent-green uppercase tracking-wide">
                      EXACT MATCH — Machine program ready
                    </p>
                  )}
                  <p className="font-body text-xs text-afs-chrome-dim">
                    Fabricated {matches[0].fabricatedCount} time{matches[0].fabricatedCount === 1 ? '' : 's'} in shop history
                  </p>
                  <div className="flex flex-col gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => setShowMatched3DView(true)}
                      className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                    >
                      → View in 3D
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitDismissed(true)}
                      className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2 rounded transition-colors"
                    >
                      ✕ Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSavedProfiles && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => setShowSavedProfiles(false)}
        >
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-lg w-full max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl text-afs-chrome-high mb-4">My Saved Profiles</h3>
            {!isAuthenticated ? (
              <p className="font-body text-sm text-afs-chrome-mid">
                Sign in to view your saved profiles.{' '}
                <Link href="/login" className="text-afs-crimson hover:underline">
                  Sign in
                </Link>
              </p>
            ) : savedProfilesLoading ? (
              <p className="font-body text-sm text-afs-chrome-mid">Loading…</p>
            ) : savedProfiles.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">
                No saved profiles yet. Profiles from your submitted orders will appear here.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {savedProfiles.map((p) => (
                  <li
                    key={`${p.quoteRequestId}-${p.itemIndex}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-afs-bg-surface"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-afs-chrome-high truncate">
                        {p.name} <span className="font-data text-xs text-afs-chrome-dim">#{p.requestNumber}</span>
                      </p>
                      <p className="font-data text-xs text-afs-chrome-dim">
                        Submitted {new Date(p.submittedAt).toLocaleDateString()}
                        {p.material && ` · ${p.material}`}
                        {p.gauge && ` · ${p.gauge}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => loadSavedProfile(p)}
                      disabled={!p.points}
                      title={p.points ? undefined : 'Geometry not available for this submission'}
                      className="shrink-0 border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-afs-bg-overlay"
                    >
                      Load
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setShowSavedProfiles(false)}
              className="mt-4 font-label text-sm text-afs-chrome-mid hover:text-afs-crimson transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Always mounted, toggled via isOpen — see the doc comment on
          SubmitConfirmation3DModal for why conditional mount/unmount here
          would break under React Strict Mode's dev-only double-effect. */}
      <SubmitConfirmation3DModal
        isOpen={show3DConfirm}
        bends={viewerBends}
        blankWidthMm={viewerBlankWidthMm}
        material={material}
        gauge={gauge}
        thicknessMm={gaugeToThicknessMm(gauge)}
        color={color}
        initialPaintFace={paintFace}
        hemStart={hemStart}
        hemEnd={hemEnd}
        onCancel={() => setShow3DConfirm(false)}
        onConfirm={handle3DConfirmed}
      />

      {/* PART 6 — [→ View in 3D] on the split-screen match panel */}
      {showMatched3DView && matches[0] && (
        <MatchedProfile3DModal
          profileName={matches[0].nameEn}
          bends={matchedProfileBends}
          blankWidthMm={matchedProfileBlankWidthMm}
          material={material || 'Galvanized Steel'}
          gauge={gauge || GAUGES_BY_MATERIAL['Galvanized Steel']?.[1] || '24 ga'}
          thicknessMm={gaugeToThicknessMm(gauge || GAUGES_BY_MATERIAL['Galvanized Steel']?.[1])}
          color={color}
          onClose={() => setShowMatched3DView(false)}
        />
      )}

      {/* PART 1 — [New] confirmation dialog */}
      {showNewConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] px-6" onClick={() => setShowNewConfirm(false)}>
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg text-afs-chrome-high mb-2">Start a New Profile?</h3>
            <p className="font-body text-sm text-afs-chrome-mid mb-6">
              This clears the current canvas, hems, and match results. Unsaved work will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewConfirm(false)}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmNew}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PART 5 — Save / Duplicate / Edit Name */}
      {showProfileDetails && (
        <ProfileDetailsModal
          initialValues={{
            name: duplicateOnSave ? `Copy of ${profileName}` : profileName,
            categoryId: profileCategoryId,
            subcategory: profileSubcategory,
          }}
          onCancel={() => setShowProfileDetails(false)}
          onSave={(values) => performSave(values, duplicateOnSave)}
          saving={savingProfile}
          error={saveError}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
