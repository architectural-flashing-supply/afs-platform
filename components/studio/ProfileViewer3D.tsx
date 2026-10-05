'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { formatInches } from '@/lib/utils/format-inches';
import { buildCrossSectionPoints, formatBendAngleLabel } from '@/lib/flashdraft/geometry';
import ProfileCrossSection2D from '@/components/studio/ProfileCrossSection2D';
import type { Hem } from '@/lib/types/profile';

export interface ProfileBend {
  leftLeg: number;
  rightLeg: number;
  angle: number;
  radius: number;
}

export interface ProfileViewer3DProps {
  bends: ProfileBend[];
  blankWidth: number;
  material: string;
  gauge: string;
  thicknessMm: number;
  profileName?: string;
  className?: string;
  /**
   * Paint-side confirmation (FlashDraft's 3D submit-confirmation modal
   * only) — when set, the base mesh renders in `bareColor` and a thin
   * coplanar decal in `paintColor` is applied to the outer ('up') or inner
   * ('down') face of the folded sheet, so one face reads as painted finish
   * and the opposite face reads as bare metal. Omitted everywhere else.
   */
  paintFace?: 'up' | 'down';
  paintColor?: string;
  bareColor?: string;
  /**
   * Real fold geometry at the profile's start/end (afs-fl-018) — mirrors
   * FlashDraft's own hemStart/hemEnd (lib/types/profile.ts's Hem). Only
   * passed where real hem data actually exists (FlashDraft's own draft
   * canvas and its Submit Confirmation modal) — the machine-library match
   * view and the shared profile-viewer page have no hem data on record, so
   * they omit these props entirely and render no hem geometry, same as
   * before this prop existed.
   */
  hemStart?: Hem | null;
  hemEnd?: Hem | null;
  /** Degrees per second-equivalent (three.js OrbitControls convention). Defaults preserve existing behavior. */
  autoRotateSpeed?: number;
  /** How long auto-rotation runs before stopping. Defaults preserve existing behavior. */
  autoRotateDurationMs?: number;
  /**
   * Floor for the viewer's own height, in pixels. Defaults to 500, which is
   * what every caller got before this prop existed.
   *
   * It exists because that floor is a FLOOR, not a size: a caller that gives
   * the viewer a shorter slot (a modal panel, a card) does not shrink it — the
   * canvas renders at 500px inside the shorter box and the overflow is clipped,
   * which looks exactly like the camera cutting the profile off and is not.
   * That was the 2026-10-01 Products-popup bug: a 320px slot, a 500px canvas,
   * and the bottom 36% of every profile gone. A caller that sizes the viewer
   * itself passes its own floor (or 0) so the two agree.
   */
  minHeightPx?: number;
  /**
   * Hides the Dimensions control AND keeps every dimension/angle label off.
   *
   * For the Products page's SCHEMATIC previews (lib/data/product-preview-shapes.ts),
   * whose proportions are traced from a marketing rendering rather than
   * measured. Labelling them would put invented numbers in front of a customer,
   * so the toggle is not merely defaulted off — it is not offered.
   */
  hideDimensions?: boolean;
  /**
   * Initial state of the Dimensions toggle. Defaults to false: every 3D profile opens clean (FlashDraft,
   * Products, confirmation modals) and the customer turns dimensions on if they want.
   * Ignored when hideDimensions is true.
   */
  defaultDimensionsOn?: boolean;
  /**
   * Palette for the 2D fallback rendered when WebGL is unavailable (F-06).
   * Defaults to 'dark', because this viewer's own overlay chrome is gunmetal
   * (afs-bg-raised/90 panels, afs-chrome-mid labels) — i.e. every place it is
   * mounted today is a dark surface. A light-surface caller passes 'light'.
   */
  fallbackTone?: 'light' | 'dark';
}

interface Point2D {
  x: number;
  y: number;
}

type CameraPreset = 'default' | 'top' | 'side' | 'end';

const EXTRUDE_DEPTH_MM = 304.8; // one linear foot
const DIM_LINE_OFFSET_MM = 15;
// Fallback only — used before the first real bounding box is known (e.g. the
// very first render tick). The real initial camera position is computed per
// profile by computeFitCamera below (afs-fl-026), since a fixed distance
// like this one is comfortable for some profile sizes and wrong (too close
// or too far) for others.
const INITIAL_CAMERA_POSITION = new THREE.Vector3(200, 150, 300);
// Same oblique viewing angle as the old fixed INITIAL_CAMERA_POSITION,
// normalized to a pure direction — computeFitCamera scales this by the
// actual profile's size to get a real position.
const DEFAULT_CAMERA_DIRECTION = INITIAL_CAMERA_POSITION.clone().normalize();
// Multiplier applied on top of the tightest distance that exactly frames the
// profile's bounding sphere, so the profile sits comfortably inside the
// viewport with margin rather than touching its edges.
/**
 * THE 3D CANVAS BACKGROUND. One constant, used by BOTH the renderer's clear
 * colour and the enclosing dome, and shared by every mount of this viewer —
 * FlashDraft's draft page, the Products popup, the confirmation and matched-
 * profile modals.
 *
 * Both, because they are the same visible surface and only one of them is
 * usually seen: the dome is a BackSide sphere of radius 2000 and the camera
 * sits a few hundred units from origin, i.e. INSIDE it. The dome is therefore
 * what the viewer actually looks at, and the clear colour shows only where the
 * dome does not cover. Setting one and not the other changes nothing visible —
 * which is why they were previously two different greys (#8A8A8A and #787878)
 * and why they are now one value.
 *
 * History: #3A3A3A -> #565656 (afs-fl-026) -> #787878/#8A8A8A (afs-fl-029,
 * after Reid reported profiles blending into the background) -> this. Each
 * step lightened it. Separation does NOT come from flat hex contrast — copper
 * (#B87333) measures 1.10:1 against the old #8A8A8A and still reads clearly,
 * because these are lit metallic surfaces with specular highlights, not flat
 * swatches. The value below was chosen by RENDERING every material option on
 * it and looking; see STATE_OF_THE_BUILD.md's 2026-10-01 entry for the
 * evidence.
 */
export const VIEWER_BACKGROUND_COLOR = '#C9CDD2';

const FIT_MARGIN = 1.35;
// The overlay chrome (Reset/Top/Side/End and the Dimensions button) floats over
// the TOP of the canvas, so a perfectly centred profile puts its upper faces and
// labels behind those controls. Raising the camera target by this fraction of
// the profile's bounding radius drops the profile slightly in frame, clearing
// the toolbar without pushing the lower edge toward the bottom.
const FIT_TOOLBAR_CLEARANCE = 0.12;
const CAMERA_PRESETS: Record<CameraPreset, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  default: { position: INITIAL_CAMERA_POSITION.clone(), target: new THREE.Vector3(0, 0, 0) },
  top: { position: new THREE.Vector3(0, 400, 0.01), target: new THREE.Vector3(0, 0, 0) },
  side: { position: new THREE.Vector3(400, 0, 0), target: new THREE.Vector3(0, 0, 0) },
  end: { position: new THREE.Vector3(0, 0, 400), target: new THREE.Vector3(0, 0, 0) },
};

/**
 * Frame-to-fit: positions a camera at the nearest distance (along
 * `direction`, plus FIT_MARGIN of breathing room) that keeps `box`'s entire
 * bounding sphere inside the camera's view frustum, for BOTH the vertical
 * and horizontal field of view — so a tall-narrow or short-wide profile is
 * still fully framed regardless of the viewport's own aspect ratio, not just
 * whichever axis happens to be the vertical FOV.
 */
function computeFitCamera(
  box: THREE.Box3,
  camera: THREE.PerspectiveCamera,
  direction: THREE.Vector3
): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  if (box.isEmpty()) return null;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  if (!(sphere.radius > 0)) return null;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const fitDistanceV = sphere.radius / Math.sin(vFov / 2);
  const fitDistanceH = sphere.radius / Math.sin(hFov / 2);
  const distance = FIT_MARGIN * Math.max(fitDistanceV, fitDistanceH);
  // Raising the target lifts the view, which renders the profile slightly lower
  // on screen — clear of the floating toolbar. Applied here rather than at the
  // call site so "Reset View" (which replays fitCameraRef) returns to exactly
  // this framing instead of a different, unbiased one.
  const target = sphere.center.clone();
  target.y += sphere.radius * FIT_TOOLBAR_CLEARANCE;
  const position = target.clone().add(direction.clone().normalize().multiplyScalar(distance));
  return { position, target };
}

interface MaterialAppearance {
  color: string;
  metalness: number;
  roughness: number;
}

const MATERIAL_APPEARANCE: { test: RegExp; appearance: MaterialAppearance }[] = [
  { test: /galvani[sz]ed|galvalume/i, appearance: { color: '#B8C4CC', metalness: 0.8, roughness: 0.3 } },
  { test: /copper/i, appearance: { color: '#B87333', metalness: 0.9, roughness: 0.2 } },
  { test: /aluminu?m/i, appearance: { color: '#C0C0C0', metalness: 0.7, roughness: 0.35 } },
  { test: /stainless/i, appearance: { color: '#D4D4D4', metalness: 0.95, roughness: 0.15 } },
  { test: /zinc/i, appearance: { color: '#8B9BAE', metalness: 0.75, roughness: 0.4 } },
  { test: /kynar|painted/i, appearance: { color: '#8B9BAE', metalness: 0.3, roughness: 0.7 } },
  { test: /vintage/i, appearance: { color: '#7A6B5A', metalness: 0.4, roughness: 0.8 } },
];
const DEFAULT_APPEARANCE: MaterialAppearance = { color: '#B8C4CC', metalness: 0.8, roughness: 0.3 };

function getMaterialAppearance(material: string): MaterialAppearance {
  const match = MATERIAL_APPEARANCE.find((m) => m.test.test(material));
  return match ? match.appearance : DEFAULT_APPEARANCE;
}

function mmToIn(mm: number): number {
  return mm / 25.4;
}

/**
 * Same "turtle graphics" reconstruction used by FlashDraft's Load from
 * Library and the Command Center's BendSequenceDiagram — now centralized
 * in lib/flashdraft/geometry.ts's computeProfilePoints (see
 * GEOMETRY_AUDIT.md): walk each leg, turn by the supplementary bend
 * angle, repeat. An approximation of the true folded shape (no explicit
 * direction/connectivity metadata exists in a bend-sequence record), not
 * an exact CAD trace. `bend.leftLeg`/`bend.angle` are pre-resolved with
 * `||` (not `??`) here, exactly as the prior inline implementation did,
 * so a literal 0-degree angle still defaults to 180° (straight through)
 * rather than being read as a full fold-back — preserving this file's
 * own prior edge-case behavior bit-for-bit rather than silently
 * adopting BendSequenceDiagram/loadFromLibrary's `??`-based default.
 *
 * lr-02: `bend.angle` is now a SIGNED interior angle wherever the caller
 * has a real 2D point list to derive it from (FlashDraft's draft canvas
 * and, through it, SubmitConfirmation3DModal). computeProfilePoints reads
 * that sign as the fold's handedness (see bendTurnDegrees there), so the
 * extruded cross-section is congruent to what the user drew instead of
 * curling every bend the same way. Callers whose bends come out of the
 * machine catalog (MatchedProfile3DModal, /upload) still pass unsigned
 * angles and are bit-for-bit unchanged —
 * bendTurnDegrees reduces to the old `180 - angle` for any angle >= 0.
 *
 * `bend.angle || 180` below is deliberately left as-is: `||` is falsy-based,
 * so it treats a literal 0 as missing, and a NEGATIVE angle is truthy and
 * passes straight through with its sign intact.
 */
function buildProfilePoints(bends: ProfileBend[]): Point2D[] {
  return buildCrossSectionPoints(bends);
}

function segNormal(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/**
 * Offsets a polyline along its averaged (miter-ish) per-vertex normal by
 * `offset` — positive offsets move "outward" (same side as buildRibbonOutline's
 * `outer`), negative move "inward" (`inner`). A reasonable approximation for
 * a visual preview, not millimeter-precise CAD miter geometry.
 */
function offsetPolyline(points: Point2D[], offset: number): Point2D[] {
  return points.map((p, i) => {
    let nx: number;
    let ny: number;
    if (i === 0) {
      const n = segNormal(points[0], points[1] ?? points[0]);
      nx = n.x;
      ny = n.y;
    } else if (i === points.length - 1) {
      const n = segNormal(points[i - 1], points[i]);
      nx = n.x;
      ny = n.y;
    } else {
      const n1 = segNormal(points[i - 1], points[i]);
      const n2 = segNormal(points[i], points[i + 1]);
      nx = n1.x + n2.x;
      ny = n1.y + n2.y;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
    }
    return { x: p.x + nx * offset, y: p.y + ny * offset };
  });
}

/**
 * Buffers a polyline into a thin closed ribbon (outer edge + inner edge)
 * representing the sheet-metal thickness, so ExtrudeGeometry produces a
 * realistic folded-metal solid rather than a solid filled wedge. Also
 * returns the two boundaries separately — used by the paint-side decal,
 * which paints only one of them (see ProfileViewer3DProps.paintFace).
 */
function buildRibbonOutline(points: Point2D[], thickness: number): { outline: Point2D[]; outer: Point2D[]; inner: Point2D[] } {
  const half = thickness / 2;
  const outer = offsetPolyline(points, half);
  const inner = offsetPolyline(points, -half);
  // afs-fl-023: Array.prototype.reverse() mutates in place. Reversing
  // `inner` directly here (as this used to do) corrupted the very `inner`
  // array being returned below — silently un-aligning outer[i]/inner[i]
  // (each meant to be the same cross-section point offset in opposite
  // directions) into forward (A->B) vs reversed (B->A) order. Every caller
  // that pairs outer[i] with inner[i] (the paint-face branch's
  // startEdgeGeom/endEdgeGeom "true free tip" end caps) then bridged the
  // wrong pair of points across the whole open shape instead of capping a
  // single tip's sheet thickness. Reversing a copy for the closed `outline`
  // loop leaves the returned `outer`/`inner` correctly index-aligned.
  const innerReversedForOutline = [...inner].reverse();
  return { outline: [...outer, ...innerReversedForOutline], outer, inner };
}

/**
 * A thin flat strip lofted along `pts` (a single ribbon boundary, in the
 * profile's XY plane) and extruded along Z (the linear-foot length) — the
 * "coating" decal used to render one face of the folded sheet in a finish
 * color while the base mesh stays bare metal. Rendered with polygonOffset
 * (see the decal material below) so it doesn't z-fight the coplanar base
 * mesh surface it sits directly on top of.
 */
function buildDecalStripGeometry(pts: Point2D[], depth: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const base = positions.length / 3;
    positions.push(a.x, a.y, 0, b.x, b.y, 0, b.x, b.y, depth, a.x, a.y, depth);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

const IN_TO_MM = 25.4;
// Real-world teardrop curl radius, as a multiple of material thickness —
// lib/flashdraft/draw-profile-scene.ts derives its (screen-space, schematic)
// teardrop glyph radius from `effectiveThicknessIn * TEARDROP_THICKNESS_TO_R
// (= 1/0.22) * 0.8` (hem-glyph.ts's own `r = R * 0.8`); this is that same
// ratio with the screen-only pixelsPerInch*zoom conversion dropped, since
// this is real millimeters, not screen pixels.
const HEM_TEARDROP_CURL_RADIUS_TO_THICKNESS = (1 / 0.22) * 0.8;
const HEM_HOOK_ARC_SEGMENTS = 16;
const HEM_TEARDROP_ARC_SEGMENTS = 24;
// The following three match lib/flashdraft/hem-glyph.ts's drawHemGlyph
// teardrop branch exactly (sweepDeg, tailFrac, TAIL_DIVERGE_DEG) — that file
// is the authoritative definition of the teardrop's open hook/curl topology,
// not reinvented here.
const HEM_TEARDROP_SWEEP_DEG = 310;
const HEM_TEARDROP_TAIL_FRAC = 0.42;
const HEM_TEARDROP_TAIL_DIVERGE_DEG = 20;

/**
 * Real (to-scale, millimeter) centerline for an Open/Smashed hem's fold —
 * same topology as lib/flashdraft/hem-glyph.ts's drawHookGlyph (a straight
 * run, a 180-degree turn, a straight run back, separated by the real gap),
 * traced in local hem space: origin (0,0) = the profile's actual endpoint,
 * +x = outward along the leg's own direction. `gapMm` is floored well above
 * zero so a "smashed" (nearly flush) hem still traces a renderable arc
 * instead of a degenerate zero-radius turn.
 */
function buildHookFoldCenterline(lengthMm: number, gapMm: number): Point2D[] {
  const gap = Math.max(gapMm, 0.02);
  const r = gap / 2;
  const flatLen = Math.max(lengthMm - r, 0);
  const points: Point2D[] = [
    { x: 0, y: 0 },
    { x: flatLen, y: 0 },
  ];
  for (let s = 1; s <= HEM_HOOK_ARC_SEGMENTS; s++) {
    const t = s / HEM_HOOK_ARC_SEGMENTS;
    const ang = -Math.PI / 2 + Math.PI * t;
    points.push({ x: flatLen + r * Math.cos(ang), y: r + r * Math.sin(ang) });
  }
  points.push({ x: 0, y: gap });
  return points;
}

/**
 * Real (to-scale, millimeter) centerline for a Teardrop hem's fold — a
 * straight run of the hem's own real `lengthIn` (Reid's reference photos:
 * "the strip running flat and straight... that part IS hem.lengthIn"), then
 * the same open hook/curl-with-tail topology as hem-glyph.ts's teardrop
 * branch (NOT a closed loop — a visible gap remains between the tail and
 * the curl), traced with the exact same sweep/tail math, just translated so
 * the curl starts at the end of the straight run instead of at local-origin.
 */
function buildTeardropFoldCenterline(lengthMm: number, curlRadiusMm: number): Point2D[] {
  const r = Math.max(curlRadiusMm, 0.01);
  const cx = lengthMm;
  const cy = r;
  const thetaStart = -Math.PI / 2;
  const thetaEnd = thetaStart + (HEM_TEARDROP_SWEEP_DEG * Math.PI) / 180;
  const points: Point2D[] = [
    { x: 0, y: 0 },
    { x: lengthMm, y: 0 },
  ];
  for (let s = 1; s <= HEM_TEARDROP_ARC_SEGMENTS; s++) {
    const t = s / HEM_TEARDROP_ARC_SEGMENTS;
    const ang = thetaStart + (thetaEnd - thetaStart) * t;
    points.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  const arcEndX = cx + r * Math.cos(thetaEnd);
  const arcEndY = cy + r * Math.sin(thetaEnd);
  const tangentX = -Math.sin(thetaEnd);
  const tangentY = Math.cos(thetaEnd);
  const divergeRad = (HEM_TEARDROP_TAIL_DIVERGE_DEG * Math.PI) / 180;
  const tailDirX = tangentX * Math.cos(divergeRad) - tangentY * Math.sin(divergeRad);
  const tailDirY = tangentX * Math.sin(divergeRad) + tangentY * Math.cos(divergeRad);
  const tailLen = HEM_TEARDROP_TAIL_FRAC * r;
  points.push({ x: arcEndX + tailDirX * tailLen, y: arcEndY + tailDirY * tailLen });
  return points;
}

/**
 * Builds the real 3D geometry for one hem (start or end) — places the
 * to-scale 2D fold centerline (buildHookFoldCenterline/
 * buildTeardropFoldCenterline) in the profile's own XY plane at `p`,
 * oriented along the leg's outward direction and mirrored per `hem.kick`
 * ('outside' folds toward the same side as the ribbon's own `outer`
 * boundary — see buildRibbonOutline — 'inside' toward `inner`, matching
 * this file's existing outer/inner naming), then lofts an outer rail, an
 * inner rail (the fold's own sheet thickness, offset via the same
 * offsetPolyline helper the main ribbon uses), and a small end cap at the
 * fold's free/open end along Z using buildDecalStripGeometry — the same
 * technique this file already uses to loft a 2D profile-plane boundary into
 * 3D BufferGeometry for the paint decal.
 */
function buildHemGeometries(
  hem: Hem,
  p: Point2D,
  neighbor: Point2D,
  normal: Point2D,
  thicknessMm: number,
  depth: number,
  centerShift: THREE.Vector3
): THREE.BufferGeometry[] {
  const dx = p.x - neighbor.x;
  const dy = p.y - neighbor.y;
  const len = Math.hypot(dx, dy) || 1;
  const u: Point2D = { x: dx / len, y: dy / len };
  const kickSign = hem.kick === 'outside' ? 1 : -1;

  const lengthMm = Math.max(hem.lengthIn, 0) * IN_TO_MM;
  const gapMm = Math.max(hem.gapIn, 0) * IN_TO_MM;
  const curlRadiusMm = thicknessMm * HEM_TEARDROP_CURL_RADIUS_TO_THICKNESS;

  const local = hem.type === 'teardrop' ? buildTeardropFoldCenterline(lengthMm, curlRadiusMm) : buildHookFoldCenterline(lengthMm, gapMm);

  const worldCenterline: Point2D[] = local.map((pt) => ({
    x: p.x + pt.x * u.x + pt.y * kickSign * normal.x,
    y: p.y + pt.x * u.y + pt.y * kickSign * normal.y,
  }));

  const half = thicknessMm / 2;
  const outerRail = offsetPolyline(worldCenterline, half);
  const innerRail = offsetPolyline(worldCenterline, -half);
  const tipCap = [innerRail[innerRail.length - 1], outerRail[outerRail.length - 1]];

  const geometries = [buildDecalStripGeometry(outerRail, depth), buildDecalStripGeometry(innerRail, depth), buildDecalStripGeometry(tipCap, depth)];
  geometries.forEach((g) => g.translate(centerShift.x, centerShift.y, centerShift.z));
  return geometries;
}

/**
 * lr-02: must match the 2D canvas's own angle label EXACTLY, sign included
 * — that label is `${signedAngleBetween(v1, v2).toFixed(0)}°` (see
 * lib/flashdraft/draw-profile-scene.ts's angle-indicator loop), so this
 * uses `.toFixed(0)` rather than `Math.round`. The two disagree on
 * negative halves (`Math.round(-50.5)` is -50, `(-50.5).toFixed(0)` is
 * "-51"), which is exactly the class of mismatch this is here to prevent.
 * Previously `Math.round(bend.angle)` over an unsigned angle, so every 3D
 * label read positive no matter which way the fold actually went.
 */
function bendAngleLabel(bend: ProfileBend): string {
  return formatBendAngleLabel(bend.angle);
}

/**
 * Replaces each interior vertex of a polyline with a circular fillet of the
 * given radius (tangent to both adjacent legs), sampled into line segments —
 * so the extruded ribbon shows an actual curved bend instead of a sharp miter.
 * Radii are indexed the same as `bends` (one entry per interior vertex).
 */
function filletPolyline(points: Point2D[], radiiMm: number[], segmentsPerArc = 8): Point2D[] {
  if (points.length < 3) return points;
  const result: Point2D[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const radius = radiiMm[i - 1] ?? 0;

    if (radius <= 0) {
      result.push(curr);
      continue;
    }

    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len1 = Math.hypot(v1.x, v1.y) || 1;
    const len2 = Math.hypot(v2.x, v2.y) || 1;
    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };
    const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    const theta = Math.acos(dot);
    if (theta < 1e-3 || theta > Math.PI - 1e-3) {
      // Nearly straight or folded fully back on itself — no stable fillet.
      result.push(curr);
      continue;
    }

    const tanDist = Math.min(radius / Math.tan(theta / 2), len1 * 0.49, len2 * 0.49);
    const actualRadius = tanDist * Math.tan(theta / 2);

    const p1 = { x: curr.x + u1.x * tanDist, y: curr.y + u1.y * tanDist };
    const p2 = { x: curr.x + u2.x * tanDist, y: curr.y + u2.y * tanDist };

    const bisector = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisLen = Math.hypot(bisector.x, bisector.y) || 1;
    const bisUnit = { x: bisector.x / bisLen, y: bisector.y / bisLen };
    const centerDist = actualRadius / Math.sin(theta / 2);
    const center = { x: curr.x + bisUnit.x * centerDist, y: curr.y + bisUnit.y * centerDist };

    const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
    const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    result.push(p1);
    for (let s = 1; s < segmentsPerArc; s++) {
      const t = s / segmentsPerArc;
      const ang = a1 + delta * t;
      result.push({ x: center.x + Math.cos(ang) * actualRadius, y: center.y + Math.sin(ang) * actualRadius });
    }
    result.push(p2);
  }
  result.push(points[points.length - 1]);
  return result;
}

export default function ProfileViewer3D({
  bends,
  blankWidth,
  material,
  gauge,
  thicknessMm,
  profileName,
  className,
  paintFace,
  paintColor,
  bareColor,
  hemStart,
  hemEnd,
  autoRotateSpeed = 4,
  autoRotateDurationMs = 3000,
  fallbackTone = 'dark',
  minHeightPx = 500,
  hideDimensions = false,
  defaultDimensionsOn = false,
}: ProfileViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  const cameraAnimRef = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; start: number } | null>(null);
  // Latest real frame-to-fit camera position/target for this profile
  // (afs-fl-026) — kept current on every geometry rebuild so "Reset View"
  // always returns to a correctly-framed shot, not the generic fallback.
  const fitCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  // Auto-fit only drives the camera on the FIRST geometry build after mount —
  // later rebuilds (e.g. flipping paintFace) update fitCameraRef for Reset
  // View but must not yank the camera out from under a user who has already
  // manually orbited/zoomed.
  const hasAutoFitRef = useRef(false);
  // The last built geometry's bounding box. Kept so a container RESIZE can
  // recompute the fit: the fit distance depends on camera.aspect, so a camera
  // framed at one aspect is wrong at another (a modal opening, a phone
  // rotating, a panel being dragged). Before this, resize updated the aspect
  // and the renderer size but left the camera at its original distance.
  const fitBoxRef = useRef<THREE.Box3 | null>(null);

  const [dimensionsOn, setDimensionsOn] = useState(!hideDimensions && defaultDimensionsOn);
  const [hintVisible, setHintVisible] = useState(true);
  /**
   * F-06 — WebGL IS NOT GUARANTEED, SO THE VIEWER DEGRADES TO 2D.
   *
   * `new THREE.WebGLRenderer()` throws when the browser refuses a WebGL context:
   * a blacklisted GPU driver on a shop tablet, a hardened/kiosk browser, a
   * remote-desktop session, software rendering disabled by policy, or too many
   * live contexts on one page. Before this, that throw escaped the effect and
   * left an empty grey box with a "Rotate • Zoom • Pan" hint floating over it —
   * no shape, no dimensions, and no explanation.
   *
   * When it is non-null, this component renders `ProfileCrossSection2D` instead:
   * the same geometry, the same labels, no WebGL. The string is the plain-English
   * reason shown to the operator, not the exception text.
   */
  const [webglFailure, setWebglFailure] = useState<string | null>(null);

  const animateCameraTo = useCallback((preset: CameraPreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    // 'default' (Reset View) prefers the real computed frame-to-fit shot for
    // THIS profile over the generic CAMERA_PRESETS fallback, once one exists.
    const target = (preset === 'default' && fitCameraRef.current) || CAMERA_PRESETS[preset];
    cameraAnimRef.current = {
      from: camera.position.clone(),
      to: target.position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.target.clone(),
      start: performance.now(),
    };
  }, []);

  // --- One-time scene setup ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // The enclosing dome. The camera sits inside this sphere, so this is the
    // background the viewer actually sees — see VIEWER_BACKGROUND_COLOR, which
    // the renderer's clear colour below also uses. One value for both; they
    // used to be two near-identical greys, which meant changing the clear
    // colour alone had no visible effect.
    const domeGeometry = new THREE.SphereGeometry(2000, 32, 16);
    const domeMaterial = new THREE.MeshBasicMaterial({
      color: VIEWER_BACKGROUND_COLOR,
      side: THREE.BackSide,
    });
    const dome = new THREE.Mesh(domeGeometry, domeMaterial);
    scene.add(dome);

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
    camera.position.copy(INITIAL_CAMERA_POSITION);
    cameraRef.current = camera;
    // This effect's cleanup disposes the renderer/controls but this ref
    // itself survives (React StrictMode's dev-only mount->cleanup->remount
    // cycle reuses the same component instance and its refs). Reset the
    // flag alongside every fresh camera so the geometry-rebuild effect's
    // one-time auto-fit (afs-fl-026) always applies to THIS camera instead
    // of silently no-op'ing because a phantom earlier mount already flipped
    // it for a camera that no longer exists.
    hasAutoFitRef.current = false;

    // F-06: the one line in this file that can fail for reasons that have
    // nothing to do with the profile being drawn. Caught here rather than
    // allowed to escape the effect, so the component can fall back to the flat
    // 2D view instead of leaving an empty container behind. The two objects
    // created above this point are disposed on the way out — an early return
    // skips this effect's own cleanup function entirely.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      domeGeometry.dispose();
      domeMaterial.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      console.error('[ProfileViewer3D] WebGL unavailable — falling back to the 2D cross-section view:', err);
      setWebglFailure('3D view is not available in this browser, so this is the flat 2D drawing instead. The shape, the leg lengths and the bend angles are the same.');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(VIEWER_BACKGROUND_COLOR, 1);

    // METALS NEED SOMETHING TO REFLECT. Every appearance in MATERIAL_APPEARANCE
    // is a MeshStandardMaterial with metalness 0.7-0.95, and a metal has no
    // diffuse response: with no environment map it renders very nearly BLACK no
    // matter what colour or lights are set. Copper (#B87333, metalness 0.9) came
    // out near-black brown; galvalume came out charcoal.
    //
    // That was always true, but the old dark-grey background camouflaged it —
    // a dark model on a dark field reads as "metal in shadow". Lightening the
    // background (above) exposed it, and no value of VIEWER_BACKGROUND_COLOR can
    // fix it, because the problem is the model, not the field behind it.
    //
    // RoomEnvironment + PMREMGenerator ship with three itself (no new
    // dependency). The generated cube map is what the metals now reflect, which
    // is what gives copper its colour and the steels their sheen. Disposed with
    // the rest of the scene below.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTexture = pmrem.fromScene(roomEnvironment, 0.04).texture;
    scene.environment = environmentTexture;
    roomEnvironment.dispose?.();
    pmrem.dispose();
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(5, 10, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.6);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = true;
    controlsRef.current = controls;

    const hintTimer = setTimeout(() => setHintVisible(false), 5000);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const anim = cameraAnimRef.current;
      if (anim) {
        const elapsed = performance.now() - anim.start;
        const t = Math.min(1, elapsed / 500);
        const eased = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(anim.from, anim.to, eased);
        controls.target.lerpVectors(anim.fromTarget, anim.toTarget, eased);
        if (t >= 1) cameraAnimRef.current = null;
      }

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);

      // Re-frame for the new aspect. The fit distance is derived from
      // camera.aspect, so the shot computed when this viewer first mounted is
      // wrong at any other size — which is what left a profile part-way out of
      // frame when a modal opened at one size and settled at another.
      // fitCameraRef is refreshed too, so Reset View returns HERE.
      const box = fitBoxRef.current;
      if (!box) return;
      const refit = computeFitCamera(box, camera, DEFAULT_CAMERA_DIRECTION);
      if (!refit) return;
      fitCameraRef.current = refit;
      camera.position.copy(refit.position);
      controls.target.copy(refit.target);
      controls.update();
    });
    resizeObserver.observe(container);

    return () => {
      clearTimeout(hintTimer);
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      environmentTexture.dispose();
      scene.environment = null;
      renderer.dispose();
      domeGeometry.dispose();
      domeMaterial.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-rotate for a configurable duration/speed, re-triggered whenever
  // paintFace changes (the "Flip Paint Side" button re-plays the rotation) ---
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.autoRotate = true;
    controls.autoRotateSpeed = autoRotateSpeed;
    const timer = setTimeout(() => {
      controls.autoRotate = false;
    }, autoRotateDurationMs);
    return () => clearTimeout(timer);
  }, [autoRotateSpeed, autoRotateDurationMs, paintFace]);

  // --- Rebuild geometry + annotations whenever the profile changes ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (meshGroupRef.current) {
      scene.remove(meshGroupRef.current);
      meshGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    if (labelGroupRef.current) {
      // A CSS2DObject is a real <div> that CSS2DRenderer appended to its own
      // DOM element. Removing its Group from the scene graph only stops the
      // renderer VISITING it — it does not take the div out of the DOM, so the
      // element stays on screen at its last position forever.
      //
      // That was the Dimensions-toggle bug: turning dimensions off rebuilds the
      // geometry (dimensionsOn is in this effect's dependency list) with an
      // empty label group, but every label from the previous build stayed
      // visible, so the button flipped to "Off" and nothing disappeared. The
      // mesh teardown immediately above has always disposed properly; the label
      // teardown had no DOM equivalent. Each element is detached explicitly.
      labelGroupRef.current.traverse((obj) => {
        const element = (obj as Partial<CSS2DObject>).element;
        element?.remove();
      });
      labelGroupRef.current.clear();
      scene.remove(labelGroupRef.current);
    }

    const meshGroup = new THREE.Group();
    const labelGroup = new THREE.Group();

    const points = buildProfilePoints(bends);
    if (points.length >= 2) {
      const radiiMm = bends.map((b) => b.radius || 0);
      const filletedPoints = filletPolyline(points, radiiMm);
      const effectiveThicknessMm = thicknessMm || 0.6;
      const { outline, outer, inner } = buildRibbonOutline(filletedPoints, effectiveThicknessMm);
      const shape = new THREE.Shape();
      outline.forEach((p, i) => {
        if (i === 0) shape.moveTo(p.x, p.y);
        else shape.lineTo(p.x, p.y);
      });
      shape.closePath();

      // Bounding-box center of the cross-section outline plus the full Z
      // depth — used to center every mesh built below (base solid, hems,
      // paint walls) into the space dimension labels expect. Computed from
      // `outline` directly (rather than geometry.center()'s own post-bevel
      // bbox) so the SAME centerShift works whether or not the branch below
      // builds a beveled ExtrudeGeometry at all. At most bevelSize (0.3mm)
      // off from a true bevel-inflated bbox — invisible on a profile this
      // size.
      const outlineXs = outline.map((p) => p.x);
      const outlineYs = outline.map((p) => p.y);
      const centerShift = new THREE.Vector3(
        -(Math.min(...outlineXs) + Math.max(...outlineXs)) / 2,
        -(Math.min(...outlineYs) + Math.max(...outlineYs)) / 2,
        -EXTRUDE_DEPTH_MM / 2
      );

      const appearance = getMaterialAppearance(material);

      if (paintFace && paintColor) {
        // afs-fl-022: the prior approach (one bare-metal ExtrudeGeometry
        // solid plus a second "paint decal" surface held a hair off the
        // base mesh's own coincident face via polygonOffset + a geometric
        // standoff) produced two different real bugs across two attempts —
        // an angle-dependent z-fight flip to bare metal, then (confirmed
        // live here, Playwright, rotating a real painted profile) BOTH
        // faces reading painted at once. Root cause: the standoff's
        // offsetPolyline call recomputes its push direction from whichever
        // rail (outer/inner) it's handed, using that rail's OWN local
        // geometry — which doesn't reliably point "away from the solid" for
        // both rails, especially on a zigzag profile that alternates
        // convex/concave turns. `side: THREE.DoubleSide` on the decal then
        // made the resulting mispositioned sliver visible from angles it
        // should have been hidden at. Removing the second surface removes
        // the whole bug class: the solid is now built directly as its own
        // two real, non-coincident faces (the outer rail wall and the
        // inner rail wall, each its own mesh/material) plus the two raw
        // sheet-edge strips and the two cross-section end caps — nothing
        // else ever competes for the same pixels, so there's no standoff
        // direction left to get wrong.
        const paintMaterial = new THREE.MeshStandardMaterial({
          color: paintColor,
          // Flat/non-reflective, matching a real painted (Kynar) coating.
          metalness: 0,
          roughness: 0.85,
          side: THREE.DoubleSide,
        });
        // Bare metal, DoubleSide — same reasoning as hemMaterial below:
        // these hand-lofted strips' triangle winding isn't guaranteed to
        // face the camera from every angle the way a THREE.ExtrudeGeometry
        // solid's does.
        const edgeMaterial = new THREE.MeshStandardMaterial({
          color: bareColor ?? appearance.color,
          metalness: appearance.metalness,
          roughness: appearance.roughness,
          side: THREE.DoubleSide,
        });

        const outerWallGeom = buildDecalStripGeometry(outer, EXTRUDE_DEPTH_MM);
        const innerWallGeom = buildDecalStripGeometry(inner, EXTRUDE_DEPTH_MM);
        // The raw cut edge of the sheet at the profile's two open ends
        // (where outer and inner meet) — always bare metal regardless of
        // paintFace, same as real painted coil stock's exposed cut edge.
        const startEdgeGeom = buildDecalStripGeometry([outer[0], inner[0]], EXTRUDE_DEPTH_MM);
        const endEdgeGeom = buildDecalStripGeometry(
          [outer[outer.length - 1], inner[inner.length - 1]],
          EXTRUDE_DEPTH_MM
        );
        // The two flat cross-section end caps (what you'd see looking at
        // the cut end of a 1-foot length) — reuses the same `shape` the old
        // ExtrudeGeometry solid triangulated, via THREE.ShapeGeometry
        // (robust ear-clipping, safe for this profile's non-convex outline)
        // instead of a hand-rolled fan triangulation.
        const startCapGeom = new THREE.ShapeGeometry(shape);
        const endCapGeom = new THREE.ShapeGeometry(shape);
        endCapGeom.translate(0, 0, EXTRUDE_DEPTH_MM);

        [outerWallGeom, innerWallGeom, startEdgeGeom, endEdgeGeom, startCapGeom, endCapGeom].forEach((g) =>
          g.translate(centerShift.x, centerShift.y, centerShift.z)
        );

        const outerMesh = new THREE.Mesh(outerWallGeom, paintFace === 'up' ? paintMaterial : edgeMaterial);
        const innerMesh = new THREE.Mesh(innerWallGeom, paintFace === 'down' ? paintMaterial : edgeMaterial);
        const startEdgeMesh = new THREE.Mesh(startEdgeGeom, edgeMaterial);
        const endEdgeMesh = new THREE.Mesh(endEdgeGeom, edgeMaterial);
        const startCapMesh = new THREE.Mesh(startCapGeom, edgeMaterial);
        const endCapMesh = new THREE.Mesh(endCapGeom, edgeMaterial);
        [outerMesh, innerMesh, startEdgeMesh, endEdgeMesh, startCapMesh, endCapMesh].forEach((m) => {
          m.castShadow = true;
          m.receiveShadow = true;
          meshGroup.add(m);
        });
      } else {
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: EXTRUDE_DEPTH_MM,
          bevelEnabled: true,
          bevelThickness: 0.5,
          bevelSize: 0.3,
          bevelSegments: 2,
          curveSegments: 8,
        });
        geometry.translate(centerShift.x, centerShift.y, centerShift.z);
        const bareMaterial = new THREE.MeshStandardMaterial({
          color: bareColor ?? appearance.color,
          metalness: appearance.metalness,
          roughness: appearance.roughness,
        });
        const mesh = new THREE.Mesh(geometry, bareMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshGroup.add(mesh);
      }

      if (hemStart || hemEnd) {
        // Bare metal, DoubleSide (rather than reusing `bareMaterial`) —
        // the hem's outer/inner rails are two independently-lofted strips
        // (buildDecalStripGeometry, same technique the paint-face walls
        // above use) whose triangle winding isn't guaranteed to face the
        // camera from every angle the way a THREE.ExtrudeGeometry solid's
        // does.
        const hemMaterial = new THREE.MeshStandardMaterial({
          color: bareColor ?? appearance.color,
          metalness: appearance.metalness,
          roughness: appearance.roughness,
          side: THREE.DoubleSide,
        });
        const lastIdx = filletedPoints.length - 1;
        if (hemStart) {
          const normal = segNormal(filletedPoints[0], filletedPoints[1]);
          buildHemGeometries(hemStart, filletedPoints[0], filletedPoints[1], normal, effectiveThicknessMm, EXTRUDE_DEPTH_MM, centerShift).forEach(
            (geom) => meshGroup.add(new THREE.Mesh(geom, hemMaterial))
          );
        }
        if (hemEnd) {
          const normal = segNormal(filletedPoints[lastIdx - 1], filletedPoints[lastIdx]);
          buildHemGeometries(
            hemEnd,
            filletedPoints[lastIdx],
            filletedPoints[lastIdx - 1],
            normal,
            effectiveThicknessMm,
            EXTRUDE_DEPTH_MM,
            centerShift
          ).forEach((geom) => meshGroup.add(new THREE.Mesh(geom, hemMaterial)));
        }
      }

      if (dimensionsOn && !hideDimensions) {
        // geometry.center() (done manually above) already recenters the mesh itself, but our 2D
        // `points` are still in original (un-centered) profile space — use
        // the same shift so labels land on the visible, centered mesh.
        const shiftX = -(Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
        const shiftY = -(Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2;

        for (let i = 0; i < points.length - 1; i++) {
          const a = points[i];
          const b = points[i + 1];
          const midX = (a.x + b.x) / 2 + shiftX;
          const midY = (a.y + b.y) / 2 + shiftY;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(midX, midY, 0),
            new THREE.Vector3(midX + nx * DIM_LINE_OFFSET_MM, midY + ny * DIM_LINE_OFFSET_MM, 0),
          ]);
          const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xc0001a }));
          labelGroup.add(line);

          const div = document.createElement('div');
          div.className =
            'font-data text-[11px] text-afs-ink-900 bg-white px-0.5 py-0.5 border border-afs-chrome-dim rounded-sm text-center leading-tight';
          const legLenMm = Math.hypot(dx, dy);
          div.textContent = formatInches(mmToIn(legLenMm));
          const label = new CSS2DObject(div);
          label.position.set(midX + nx * DIM_LINE_OFFSET_MM, midY + ny * DIM_LINE_OFFSET_MM, 0);
          labelGroup.add(label);
        }

        bends.forEach((bend, i) => {
          const vertex = points[i + 1];
          if (!vertex) return;
          const div = document.createElement('div');
          div.className = 'font-data text-[11px] font-bold text-afs-crimson bg-white px-0.5 py-0.5 border border-afs-crimson rounded-sm';
          div.textContent = bendAngleLabel(bend);
          const label = new CSS2DObject(div);
          label.position.set(vertex.x + shiftX, vertex.y + shiftY, EXTRUDE_DEPTH_MM / 2);
          labelGroup.add(label);
        });

        const blankDiv = document.createElement('div');
        blankDiv.className =
          'font-data text-[11px] text-afs-ink-900 bg-white px-0.5 py-0.5 border border-afs-chrome-dim rounded-sm text-center';
        blankDiv.textContent = `Blank Width: ${formatInches(mmToIn(blankWidth))}`;
        const blankLabel = new CSS2DObject(blankDiv);
        const minY = Math.min(...points.map((p) => p.y)) + shiftY;
        blankLabel.position.set(0, minY - DIM_LINE_OFFSET_MM * 2, EXTRUDE_DEPTH_MM / 2);
        labelGroup.add(blankLabel);
      }
    }

    scene.add(meshGroup);
    scene.add(labelGroup);
    meshGroupRef.current = meshGroup;
    labelGroupRef.current = labelGroup;

    // Frame-to-fit (afs-fl-026): compute the real bounding box of the mesh
    // just built and derive a camera shot that keeps the whole profile
    // visible, scaled to ITS actual size rather than a fixed distance that's
    // only right for one particular profile. Only drives the live camera on
    // the first build after mount — see hasAutoFitRef above.
    const camera = cameraRef.current;
    if (camera) {
      const box = new THREE.Box3().setFromObject(meshGroup);
      fitBoxRef.current = box.clone();
      const fit = computeFitCamera(box, camera, DEFAULT_CAMERA_DIRECTION);
      if (fit) {
        fitCameraRef.current = fit;
        if (!hasAutoFitRef.current) {
          camera.position.copy(fit.position);
          controlsRef.current?.target.copy(fit.target);
          controlsRef.current?.update();
          hasAutoFitRef.current = true;
        }
      }
    }
  }, [bends, blankWidth, material, thicknessMm, dimensionsOn, hideDimensions, paintFace, paintColor, bareColor, hemStart, hemEnd]);

  // F-06: WebGL refused a context. Render the same profile flat rather than an
  // empty grey box. The two effects above both bail on their own null refs, so
  // nothing keeps trying to drive a renderer that was never created.
  if (webglFailure) {
    return (
      <ProfileCrossSection2D
        bends={bends}
        blankWidth={blankWidth}
        material={material}
        gauge={gauge}
        profileName={profileName}
        tone={fallbackTone}
        reason={webglFailure}
        className={className}
      />
    );
  }

  return (
    <div className={`relative ${className ?? ''}`} style={{ minHeight: minHeightPx }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
        <div className="flex gap-1 bg-afs-bg-raised/90 border border-afs-chrome-dim rounded p-1">
          <button
            type="button"
            onClick={() => animateCameraTo('default')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            Reset View
          </button>
          <button
            type="button"
            onClick={() => animateCameraTo('top')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => animateCameraTo('side')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            Side
          </button>
          <button
            type="button"
            onClick={() => animateCameraTo('end')}
            className="font-label text-xs px-2 py-1 rounded text-afs-chrome-mid hover:bg-afs-bg-surface hover:text-white transition-colors"
          >
            End
          </button>
        </div>
        {!hideDimensions && (
          <button
            type="button"
            onClick={() => setDimensionsOn((d) => !d)}
            className={`font-label text-xs px-3 py-1.5 rounded border transition-colors ${
              dimensionsOn
                ? 'bg-afs-crimson text-white border-afs-crimson'
                : 'bg-afs-bg-raised/90 text-afs-chrome-mid border-afs-chrome-dim hover:text-white'
            }`}
          >
            Dimensions {dimensionsOn ? 'On' : 'Off'}
          </button>
        )}
      </div>

      {/* Bottom-left info */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <div className="bg-afs-bg-raised/90 border border-afs-chrome-dim rounded px-3 py-2">
          {profileName && <p className="font-heading text-sm text-afs-chrome-high">{profileName}</p>}
          <p className="font-data text-xs text-afs-chrome-mid">
            {material} · {gauge}
          </p>
        </div>
        <p
          className={`font-label text-xs text-afs-chrome-dim transition-opacity duration-700 ${
            hintVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Rotate • Zoom • Pan
        </p>
      </div>
    </div>
  );
}
