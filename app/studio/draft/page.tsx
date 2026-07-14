'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALL_MATERIALS, GAUGES_BY_MATERIAL } from '@/lib/data/catalog';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';
import SubmitConfirmation3DModal, { type PaintFace } from '@/components/studio/SubmitConfirmation3DModal';
import type { ProfileMatch, DiagramBend } from '@/app/api/studio/match-profile/route';

type ToolMode = 'draw' | 'select' | 'erase';
type SubmitState = 'idle' | 'submitting' | 'submitted';
type HemType = 'open' | 'smashed' | 'teardrop';
type HemEndpoint = 'start' | 'end';

interface Hem {
  type: HemType;
  gapIn: number;
}

interface Point {
  x: number;
  y: number;
  /** Bend radius in inches — only meaningful for interior (bend) points. */
  radius?: number;
}

const MM_PER_INCH = 25.4;
const VIEWER_DEBOUNCE_MS = 300;

// Shown in the 3D confirmation modal before the user has drawn anything —
// in practice unreachable, since the submit flow requires a real drawing,
// but kept as a safe fallback for viewerBends' initial state.
const PLACEHOLDER_COPING_CAP_BENDS: ProfileBend[] = [
  { leftLeg: 76.2, rightLeg: 254, angle: 90, radius: 3 },
  { leftLeg: 254, rightLeg: 76.2, angle: 90, radius: 3 },
];
const PLACEHOLDER_BLANK_WIDTH_MM = 76.2 + 254 + 76.2;

interface LibraryProfile {
  id: string;
  name_en: string;
  profile_number: string;
}

// Canvas 2D fillStyle/strokeStyle can't consume Tailwind classes or CSS
// custom properties — mirrors the afs-crimson / afs-ink-900 / afs-accent-*
// tokens for the canvas-drawn profile and its dimension/bend/hem labels
// (same documented exception pattern already used for the Stripe
// CardElement in app/checkout/page.tsx). See DESIGN_TOKENS.md §10.
const CANVAS_COLORS = {
  background: '#F5F5F0',
  grid: 'rgba(17, 17, 17, 0.08)',
  profile: '#C0001A',
  profileSelected: '#2563EB',
  point: '#C0001A',
  ink: '#111111',
  dragLabelBg: 'rgba(17, 17, 17, 0.92)',
  dragLabelText: '#FFFFFF',
  bendCircleFill: 'rgba(255, 255, 255, 0.2)',
  bendCircleBorder: '#00C853', // mirrors afs-accent-green
  bendCircleWarnBorder: '#D32F2F',
  hemLine: '#4A0072', // mirrors afs-accent-purple
};

const PIXELS_PER_INCH = 20;
const GRID_INCHES = 0.25;
const SNAP_ANGLE_DEGREES = 15;
const SNAP_DIMENSION_INCHES = 0.125;
const CANVAS_MIN_WIDTH = 600;
const CANVAS_MIN_HEIGHT = 440;
const HIT_RADIUS_PX = 10;
const MATCH_DEBOUNCE_MS = 500;

const MIN_BEND_RADIUS_IN = 0.125;
const MAX_BEND_RADIUS_IN = 4;
const MIN_DRAG_SEGMENT_IN = 0.05;

const BEND_CIRCLE_RADIUS_PX = 16; // 32px diameter
const BEND_CIRCLE_HIT_PX = 18;

const HEM_FOLD_DEPTH_IN = 0.375;
const HEM_DEFAULT_GAP_IN = 0.1875; // 3/16"
const HEM_HIT_RADIUS_PX = 14;

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

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
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

function applySnapping(prev: Point, raw: Point, snapAngle: boolean, snapDimension: boolean): Point {
  let dx = raw.x - prev.x;
  let dy = raw.y - prev.y;
  let length = Math.hypot(dx, dy);
  let angleRad = Math.atan2(dy, dx);

  if (snapAngle) {
    const deg = (angleRad * 180) / Math.PI;
    const snappedDeg = Math.round(deg / SNAP_ANGLE_DEGREES) * SNAP_ANGLE_DEGREES;
    angleRad = (snappedDeg * Math.PI) / 180;
  }
  if (snapDimension) {
    length = Math.round(length / SNAP_DIMENSION_INCHES) * SNAP_DIMENSION_INCHES;
  }
  dx = Math.cos(angleRad) * length;
  dy = Math.sin(angleRad) * length;
  return { x: prev.x + dx, y: prev.y + dy };
}

function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / SNAP_DIMENSION_INCHES) * SNAP_DIMENSION_INCHES,
    y: Math.round(p.y / SNAP_DIMENSION_INCHES) * SNAP_DIMENSION_INCHES,
  };
}

// Approximate extra blank-width consumed by a hem fold at one endpoint — a
// visual/quoting simplification (fold depth is a fixed visual constant, not
// a real fabrication bend-deduction calculation), not fabrication-precise.
function hemAllowanceIn(hem: Hem | null | undefined, thicknessIn: number): number {
  if (!hem) return 0;
  if (hem.type === 'smashed') return 2 * HEM_FOLD_DEPTH_IN;
  if (hem.type === 'teardrop') return 2 * HEM_FOLD_DEPTH_IN + Math.PI * (thicknessIn / 2);
  return 2 * HEM_FOLD_DEPTH_IN + hem.gapIn;
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

export default function FlashDraftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const jetbrainsFontRef = useRef<string>('monospace');

  useEffect(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--font-jetbrains').trim();
    jetbrainsFontRef.current = value ? `${value}, monospace` : 'monospace';
  }, []);

  const [points, setPoints] = useState<Point[]>([]);
  const [past, setPast] = useState<Point[][]>([]);
  const [future, setFuture] = useState<Point[][]>([]);

  const [tool, setTool] = useState<ToolMode>('draw');
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [segmentLengthInput, setSegmentLengthInput] = useState('');
  const [selectedBendPoint, setSelectedBendPoint] = useState<number | null>(null);
  const [bendRadiusInput, setBendRadiusInput] = useState('');

  const [canvasSize, setCanvasSize] = useState({ width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<{ mouse: Point; pan: Point } | null>(null);
  const spacePressed = useRef(false);

  const [snapAngle, setSnapAngle] = useState(true);
  const [snapDimension, setSnapDimension] = useState(true);

  // --- Click-and-drag drawing state ---
  const dragAnchorRef = useRef<Point | null>(null);
  const [isDragDrawing, setIsDragDrawing] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ point: Point; length: number; angleDeg: number } | null>(null);
  const [dragScreenPos, setDragScreenPos] = useState<Point | null>(null);

  // --- Bend circle angle-drag state ---
  const [draggingAngleIndex, setDraggingAngleIndex] = useState<number | null>(null);
  const [hoveredBendCircle, setHoveredBendCircle] = useState<number | null>(null);
  const angleDragOriginalPoints = useRef<Point[] | null>(null);
  const hasAngleDraggedRef = useRef(false);

  // --- Hem tool state ---
  const [hemStart, setHemStart] = useState<Hem | null>(null);
  const [hemEnd, setHemEnd] = useState<Hem | null>(null);
  const [hemPopup, setHemPopup] = useState<{ endpoint: HemEndpoint; screenPos: Point } | null>(null);
  const [hemGapDraft, setHemGapDraft] = useState(String(HEM_DEFAULT_GAP_IN));

  const [material, setMaterial] = useState('');
  const [gauge, setGauge] = useState('');
  const [lengthFeet, setLengthFeet] = useState('9');
  const [lengthInches, setLengthInches] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [topMatchDiagramBends, setTopMatchDiagramBends] = useState<DiagramBend[] | null>(null);
  const [showFloatingPreview, setShowFloatingPreview] = useState(true);
  const lastTopMatchIdRef = useRef<string | null>(null);

  const [viewerBends, setViewerBends] = useState<ProfileBend[]>(PLACEHOLDER_COPING_CAP_BENDS);
  const [viewerBlankWidthMm, setViewerBlankWidthMm] = useState(PLACEHOLDER_BLANK_WIDTH_MM);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryProfiles, setLibraryProfiles] = useState<LibraryProfile[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [show3DConfirm, setShow3DConfirm] = useState(false);
  const [confirmedPaintFace, setConfirmedPaintFace] = useState<PaintFace | null>(null);

  const gaugeOptions = material ? GAUGES_BY_MATERIAL[material] ?? [] : [];
  const lengthFtDecimal = (Number(lengthFeet) || 0) + (Number(lengthInches) || 0) / 12;
  const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
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
      setPast((p) => [...p, points]);
      setFuture([]);
      setPoints(newPoints);
      setSelectedSegment(null);
    },
    [points]
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prevPoints = p[p.length - 1];
      setFuture((f) => [points, ...f]);
      setPoints(prevPoints);
      setSelectedSegment(null);
      return p.slice(0, -1);
    });
  }, [points]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const nextPoints = f[0];
      setPast((p) => [...p, points]);
      setPoints(nextPoints);
      setSelectedSegment(null);
      return f.slice(1);
    });
  }, [points]);

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

  // --- Keyboard shortcuts: undo/redo, space-to-pan, escape closes hem popup ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spacePressed.current = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        setHemPopup(null);
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spacePressed.current = false;
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo]);

  // --- Coordinate conversion ---
  const worldToScreen = useCallback(
    (p: Point, canvas: HTMLCanvasElement): Point => ({
      x: p.x * PIXELS_PER_INCH * zoom + pan.x + canvas.width / 2,
      y: p.y * PIXELS_PER_INCH * zoom + pan.y + canvas.height / 2,
    }),
    [zoom, pan]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number, canvas: HTMLCanvasElement): Point => ({
      x: (sx - canvas.width / 2 - pan.x) / (PIXELS_PER_INCH * zoom),
      y: (sy - canvas.height / 2 - pan.y) / (PIXELS_PER_INCH * zoom),
    }),
    [zoom, pan]
  );

  // --- Draw loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = CANVAS_COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    const step = GRID_INCHES * PIXELS_PER_INCH * zoom;
    ctx.strokeStyle = CANVAS_COLORS.grid;
    ctx.lineWidth = 1;
    const offsetX = (pan.x + canvas.width / 2) % step;
    const offsetY = (pan.y + canvas.height / 2) % step;
    for (let x = offsetX; x < canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offsetY; y < canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    if (points.length === 0 && !isDragDrawing) return;

    // Segments
    for (let i = 0; i < points.length - 1; i++) {
      const a = worldToScreen(points[i], canvas);
      const b = worldToScreen(points[i + 1], canvas);
      ctx.strokeStyle = selectedSegment === i ? CANVAS_COLORS.profileSelected : CANVAS_COLORS.profile;
      ctx.lineWidth = selectedSegment === i ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const length = dist(points[i], points[i + 1]);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      ctx.fillStyle = CANVAS_COLORS.ink;
      ctx.font = '12px sans-serif';
      ctx.fillText(`${length.toFixed(3)}"`, midX + 6, midY - 6);
    }

    // Live drag-in-progress segment, from the last committed point to the cursor
    if (isDragDrawing && dragPreview && points.length > 0) {
      const anchor = points[points.length - 1];
      const a = worldToScreen(anchor, canvas);
      const b = worldToScreen(dragPreview.point, canvas);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = CANVAS_COLORS.profile;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = CANVAS_COLORS.point;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Points (small dot at every vertex, including the two hem-able endpoints)
    points.forEach((p) => {
      const s = worldToScreen(p, canvas);
      ctx.fillStyle = CANVAS_COLORS.point;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Bend circle handles: fillet preview arc (still driven by the numeric
    // radius value, set via the left-panel input) + a translucent draggable
    // circle badge centered on the vertex showing live angle + radius.
    // Dragging the circle changes the ANGLE (rotates everything downstream
    // of the joint) — the radius is edited via the panel input, not here.
    const gaugeIsThick = isGauge18OrThicker(gauge);
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const s = worldToScreen(curr, canvas);
      const effectiveRadius = getEffectiveRadius(i);
      const isTooTight = gaugeIsThick && effectiveRadius < thicknessIn * 1.5;
      const circleBorder = isTooTight ? CANVAS_COLORS.bendCircleWarnBorder : CANVAS_COLORS.bendCircleBorder;

      const angleToPrev = Math.atan2(prev.y - curr.y, prev.x - curr.x);
      const angleToNext = Math.atan2(next.y - curr.y, next.x - curr.x);
      let sweep = angleToNext - angleToPrev;
      while (sweep <= -Math.PI) sweep += Math.PI * 2;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      const arcRadiusPx = Math.max(4, effectiveRadius * PIXELS_PER_INCH * zoom);
      ctx.strokeStyle = circleBorder;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, arcRadiusPx, angleToPrev, angleToNext, sweep < 0);
      ctx.stroke();

      const isActive = hoveredBendCircle === i || draggingAngleIndex === i || selectedBendPoint === i;
      const circleRadiusPx = BEND_CIRCLE_RADIUS_PX + (isActive ? 2 : 0);
      ctx.fillStyle = CANVAS_COLORS.bendCircleFill;
      ctx.beginPath();
      ctx.arc(s.x, s.y, circleRadiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = circleBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = CANVAS_COLORS.ink;
      ctx.font = `10px ${jetbrainsFontRef.current}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${bendAngleAt(prev, curr, next).toFixed(0)}°`, s.x, s.y - 5);
      ctx.fillText(`${effectiveRadius.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}"`, s.x, s.y + 6);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Hem folds — drawn at whichever endpoint(s) have one.
    const renderHemAt = (hem: Hem, endpointIdx: number, neighborIdx: number) => {
      const p = points[endpointIdx];
      const q = points[neighborIdx];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const len = Math.hypot(dx, dy) || 1;
      const u = { x: dx / len, y: dy / len };
      const perp = { x: -u.y, y: u.x };
      const foldTip = { x: p.x + u.x * HEM_FOLD_DEPTH_IN, y: p.y + u.y * HEM_FOLD_DEPTH_IN };
      const gapWorld = hem.type === 'smashed' ? 0 : hem.type === 'teardrop' ? thicknessIn : hem.gapIn;
      const flapEnd = { x: p.x + perp.x * gapWorld, y: p.y + perp.y * gapWorld };

      const sP = worldToScreen(p, canvas);
      const sFoldTip = worldToScreen(foldTip, canvas);
      const sFlapEnd = worldToScreen(flapEnd, canvas);

      ctx.strokeStyle = CANVAS_COLORS.hemLine;
      if (hem.type === 'smashed') {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sP.x, sP.y);
        ctx.lineTo(sFoldTip.x, sFoldTip.y);
        ctx.stroke();
      } else if (hem.type === 'teardrop') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sP.x, sP.y);
        ctx.lineTo(sFoldTip.x, sFoldTip.y);
        ctx.stroke();
        const radiusPx = Math.max(3, (thicknessIn / 2) * PIXELS_PER_INCH * zoom);
        ctx.beginPath();
        ctx.arc(sFoldTip.x, sFoldTip.y, radiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sFoldTip.x, sFoldTip.y);
        ctx.lineTo(sFlapEnd.x, sFlapEnd.y);
        ctx.stroke();
      } else {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sP.x, sP.y);
        ctx.lineTo(sFoldTip.x, sFoldTip.y);
        ctx.lineTo(sFlapEnd.x, sFlapEnd.y);
        ctx.stroke();
      }

      ctx.fillStyle = CANVAS_COLORS.hemLine;
      ctx.font = `10px ${jetbrainsFontRef.current}`;
      ctx.fillText(hem.type, sFoldTip.x + 6, sFoldTip.y - 6);
    };

    if (points.length >= 2) {
      if (hemStart) renderHemAt(hemStart, 0, 1);
      if (hemEnd) renderHemAt(hemEnd, points.length - 1, points.length - 2);
    }
  }, [
    points,
    selectedSegment,
    zoom,
    pan,
    worldToScreen,
    isDragDrawing,
    dragPreview,
    gauge,
    thicknessIn,
    getEffectiveRadius,
    hoveredBendCircle,
    draggingAngleIndex,
    selectedBendPoint,
    hemStart,
    hemEnd,
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
            setShowFloatingPreview(true);
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

  const hitTestBendCircle = useCallback(
    (screenPos: Point, canvas: HTMLCanvasElement): number | null => {
      let hit: number | null = null;
      let minDist = BEND_CIRCLE_HIT_PX;
      for (let i = 1; i < points.length - 1; i++) {
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

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

    const handleHit = hitTestBendCircle(screenPos, canvas);
    if (handleHit !== null) {
      setDraggingAngleIndex(handleHit);
      setSelectedBendPoint(handleHit);
      setSelectedSegment(null);
      angleDragOriginalPoints.current = points;
      hasAngleDraggedRef.current = false;
      return;
    }

    if (tool === 'draw') {
      if (points.length === 0) {
        const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
        commitPoints([snapDimension ? snapToGrid(raw) : raw]);
        return;
      }
      const anchor = points[points.length - 1];
      dragAnchorRef.current = anchor;
      setIsDragDrawing(true);
      setDragPreview({ point: anchor, length: 0, angleDeg: 0 });
      setDragScreenPos(screenPos);
    } else if (tool === 'select') {
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
      setSelectedBendPoint(null);
      setSelectedSegment(hit);
      if (hit !== null) {
        setSegmentLengthInput(`${dist(points[hit], points[hit + 1]).toFixed(3)}"`);
      }
    } else if (tool === 'erase') {
      let hit: number | null = null;
      let minDist = HIT_RADIUS_PX;
      points.forEach((p, i) => {
        const s = worldToScreen(p, canvas);
        const d = Math.hypot(screenPos.x - s.x, screenPos.y - s.y);
        if (d < minDist) {
          minDist = d;
          hit = i;
        }
      });
      if (hit !== null) {
        commitPoints(points.filter((_, i) => i !== hit));
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenPos = getPointerPos(e);

    if (isPanning && panOrigin.current) {
      setPan({
        x: panOrigin.current.pan.x + (screenPos.x - panOrigin.current.mouse.x),
        y: panOrigin.current.pan.y + (screenPos.y - panOrigin.current.mouse.y),
      });
      return;
    }

    if (draggingAngleIndex !== null) {
      const i = draggingAngleIndex;
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const pointerWorld = screenToWorld(screenPos.x, screenPos.y, canvas);
      const vPointer = { x: pointerWorld.x - curr.x, y: pointerWorld.y - curr.y };
      if (Math.hypot(vPointer.x, vPointer.y) < 1e-6) return;
      const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      const currentSigned = signedAngleBetween(v1, v2);
      let targetSigned = signedAngleBetween(v1, vPointer);
      if (snapAngle) targetSigned = Math.round(targetSigned / SNAP_ANGLE_DEGREES) * SNAP_ANGLE_DEGREES;
      const delta = targetSigned - currentSigned;
      hasAngleDraggedRef.current = true;
      setPoints(rotateChainAroundVertex(points, i, delta));
      return;
    }

    if (isDragDrawing && dragAnchorRef.current) {
      const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
      const snapped = applySnapping(dragAnchorRef.current, raw, snapAngle, snapDimension);
      const length = dist(dragAnchorRef.current, snapped);
      const angleDeg = (Math.atan2(snapped.y - dragAnchorRef.current.y, snapped.x - dragAnchorRef.current.x) * 180) / Math.PI;
      setDragPreview({ point: snapped, length, angleDeg });
      setDragScreenPos(screenPos);
      return;
    }

    const hit = hitTestBendCircle(screenPos, canvas);
    setHoveredBendCircle(hit);
    if (hit !== null) {
      const isTooTight = isGauge18OrThicker(gauge) && getEffectiveRadius(hit) < thicknessIn * 1.5;
      canvas.title = isTooTight ? 'Radius too tight for this gauge' : 'Drag to adjust bend angle';
      canvas.style.cursor = 'grab';
    } else {
      canvas.title = '';
      canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panOrigin.current = null;
      return;
    }
    if (draggingAngleIndex !== null) {
      if (hasAngleDraggedRef.current && angleDragOriginalPoints.current) {
        const original = angleDragOriginalPoints.current;
        setPast((p) => [...p, original]);
        setFuture([]);
      }
      setDraggingAngleIndex(null);
      angleDragOriginalPoints.current = null;
      hasAngleDraggedRef.current = false;
      return;
    }
    if (isDragDrawing && dragAnchorRef.current && dragPreview) {
      if (dragPreview.length >= MIN_DRAG_SEGMENT_IN) {
        commitPoints([...points, dragPreview.point]);
      }
      setIsDragDrawing(false);
      dragAnchorRef.current = null;
      setDragPreview(null);
      setDragScreenPos(null);
    }
  };

  const handlePointerLeave = () => {
    if (isDragDrawing || draggingAngleIndex !== null || isPanning) return;
    setHoveredBendCircle(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.title = '';
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(4, z - e.deltaY * 0.001)));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (points.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const startScreen = worldToScreen(points[0], canvas);
    const endScreen = worldToScreen(points[points.length - 1], canvas);
    const dStart = Math.hypot(screenPos.x - startScreen.x, screenPos.y - startScreen.y);
    const dEnd = Math.hypot(screenPos.x - endScreen.x, screenPos.y - endScreen.y);
    if (dStart <= HEM_HIT_RADIUS_PX && dStart <= dEnd) {
      setHemPopup({ endpoint: 'start', screenPos: startScreen });
      setHemGapDraft(String(hemStart?.gapIn ?? HEM_DEFAULT_GAP_IN));
    } else if (dEnd <= HEM_HIT_RADIUS_PX) {
      setHemPopup({ endpoint: 'end', screenPos: endScreen });
      setHemGapDraft(String(hemEnd?.gapIn ?? HEM_DEFAULT_GAP_IN));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
  }, [tool]);

  const applySegmentLength = () => {
    if (selectedSegment === null) return;
    const newLength = Number(segmentLengthInput.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(newLength) || newLength <= 0) return;
    const a = points[selectedSegment];
    const b = points[selectedSegment + 1];
    const angleRad = Math.atan2(b.y - a.y, b.x - a.x);
    const newB = { x: a.x + Math.cos(angleRad) * newLength, y: a.y + Math.sin(angleRad) * newLength };
    const delta = { x: newB.x - b.x, y: newB.y - b.y };
    // Shift every downstream point by the same delta so the rest of the
    // profile keeps its shape relative to the resized segment.
    const newPoints = points.map((p, i) => (i > selectedSegment ? { ...p, x: p.x + delta.x, y: p.y + delta.y } : p));
    commitPoints(newPoints);
  };

  const applyHem = (type: HemType) => {
    if (!hemPopup) return;
    const gapIn = type === 'open' ? Number(hemGapDraft) || HEM_DEFAULT_GAP_IN : type === 'teardrop' ? thicknessIn / 2 : 0;
    const hem: Hem = { type, gapIn };
    if (hemPopup.endpoint === 'start') setHemStart(hem);
    else setHemEnd(hem);
    if (type !== 'open') setHemPopup(null);
  };

  const setOpenHemGap = (val: string) => {
    setHemGapDraft(val);
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || !hemPopup) return;
    const hem: Hem = { type: 'open', gapIn: n };
    if (hemPopup.endpoint === 'start') setHemStart(hem);
    else setHemEnd(hem);
  };

  const removeHem = () => {
    if (!hemPopup) return;
    if (hemPopup.endpoint === 'start') setHemStart(null);
    else setHemEnd(null);
    setHemPopup(null);
  };

  const clearCanvas = () => {
    commitPoints([]);
    setMatches([]);
    setTopMatchDiagramBends(null);
    setHemStart(null);
    setHemEnd(null);
  };

  const openLibrary = async () => {
    setShowLibrary(true);
    setLibraryLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('machine_profiles')
      .select('id, name_en, profile_number')
      .eq('is_public', true)
      .eq('is_active', true)
      .order('name_en');
    setLibraryProfiles((data ?? []) as LibraryProfile[]);
    setLibraryLoading(false);
  };

  const loadFromLibrary = useCallback(async (profileId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('machine_profile_bends')
      .select('step_number, left_leg_in, right_leg_in, bend_angle_degrees')
      .eq('profile_id', profileId)
      .order('step_number', { ascending: true });

    const bends = (data ?? []) as {
      step_number: number;
      left_leg_in: number | null;
      right_leg_in: number | null;
      bend_angle_degrees: number | null;
    }[];

    // Best-effort geometry reconstruction: the source machine data records
    // each bend's two adjacent leg lengths and included angle, not an
    // explicit direction/connectivity graph, so this "turtle graphics" walk
    // (draw the left leg, turn by the supplementary bend angle, repeat) is
    // an approximation of the true folded shape, not an exact CAD trace.
    const reconstructed: Point[] = [{ x: 0, y: 0 }];
    let heading = 0;
    let current = { x: 0, y: 0 };
    for (const bend of bends) {
      const legLength = bend.left_leg_in ?? 0;
      current = {
        x: current.x + Math.cos((heading * Math.PI) / 180) * legLength,
        y: current.y + Math.sin((heading * Math.PI) / 180) * legLength,
      };
      reconstructed.push(current);
      const angle = bend.bend_angle_degrees ?? 180;
      heading += 180 - angle;
    }
    if (bends.length > 0) {
      const last = bends[bends.length - 1];
      const legLength = last.right_leg_in ?? 0;
      current = {
        x: current.x + Math.cos((heading * Math.PI) / 180) * legLength,
        y: current.y + Math.sin((heading * Math.PI) / 180) * legLength,
      };
      reconstructed.push(current);
    }

    setPast((p) => [...p, points]);
    setFuture([]);
    setPoints(reconstructed);
    setSelectedSegment(null);
    setShowLibrary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Part 4 integration: /studio/library's "Load into FlashDraft" button
  // links here with ?loadProfile=<id> — load it once on mount. Read via
  // window.location.search (not next/navigation's useSearchParams) so this
  // page stays statically prerenderable instead of requiring a Suspense
  // boundary just for a one-time read.
  useEffect(() => {
    const loadId = new URLSearchParams(window.location.search).get('loadProfile');
    if (loadId) loadFromLibrary(loadId);
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
    if (hemStart) hemParts.push(`start ${hemStart.type} (${hemStart.gapIn.toFixed(3)}" gap)`);
    if (hemEnd) hemParts.push(`end ${hemEnd.type} (${hemEnd.gapIn.toFixed(3)}" gap)`);
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

      setSubmitError(null);
      setSubmitState('submitting');

      const combinedNotes = [buildBendSummary(), notes.trim() || null].filter(Boolean).join('\n\n');
      const bendRadiiIn: number[] = [];
      for (let i = 1; i < points.length - 1; i++) {
        bendRadiiIn.push(getEffectiveRadius(i));
      }

      try {
        const res = await fetch('/api/quote-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                profileType: 'Custom FlashDraft Profile',
                material,
                gauge,
                lengthFt: lengthFtDecimal || 0,
                quantity: Number(quantity) || 1,
                unit: 'LF',
                bendRadiiIn,
                hemStart: hemStart ? { type: hemStart.type, gapIn: hemStart.gapIn } : undefined,
                hemEnd: hemEnd ? { type: hemEnd.type, gapIn: hemEnd.gapIn } : undefined,
                paint_face: paintFace ?? undefined,
              },
            ],
            notes: combinedNotes,
            isRush: false,
            guestEmail: email,
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
      } catch {
        setSubmitError('Submission failed. Please try again.');
        setSubmitState('idle');
      }
    },
    [points, material, gauge, lengthFtDecimal, quantity, notes, getEffectiveRadius, hemStart, hemEnd]
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
    setSubmitError(null);
    setShow3DConfirm(true);
  };

  const handle3DConfirmed = (paintFace: PaintFace | null) => {
    setConfirmedPaintFace(paintFace);
    setShow3DConfirm(false);
    if (isAuthenticated) {
      submitQuoteRequest(undefined, paintFace);
    } else {
      setShowEmailCapture(true);
    }
  };

  // Recomputed each render from the live canvas ref — cheap arithmetic, not
  // a hook, so no rules-of-hooks concern with calling it unconditionally.
  const canvas = canvasRef.current;
  const segmentInputPos =
    selectedSegment !== null && canvas
      ? (() => {
          const a = worldToScreen(points[selectedSegment], canvas);
          const b = worldToScreen(points[selectedSegment + 1], canvas);
          return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        })()
      : null;

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
    <main className="h-[calc(100vh-2.75rem)] bg-afs-bg-base flex flex-col overflow-hidden">
      <div className="px-6 py-2.5 border-b border-afs-chrome-dim flex items-center justify-between gap-4 shrink-0">
        <div>
          <span className="font-label text-afs-crimson text-[10px] tracking-widest uppercase">FlashDraft</span>
          <h1 className="font-heading text-lg text-afs-chrome-high leading-tight">Draw Your Profile</h1>
        </div>
        <p className="font-body text-xs text-afs-chrome-dim hidden md:block text-right">
          Click to place bend points · double-click an endpoint for a hem · matched against our machine library live
        </p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* LEFT PANEL */}
        <div className="w-full lg:w-[320px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">Tool</span>
            <div className="grid grid-cols-3 gap-2">
              {(['draw', 'select', 'erase'] as ToolMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTool(m)}
                  className={`font-label text-xs px-2 py-2 rounded border capitalize transition-colors ${
                    tool === m
                      ? 'bg-afs-crimson text-white border-afs-crimson'
                      : 'bg-afs-bg-overlay text-white border-afs-border'
                  }`}
                >
                  {m} Mode
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="material">
                Material
              </label>
              <select
                id="material"
                value={material}
                onChange={(e) => {
                  setMaterial(e.target.value);
                  setGauge('');
                }}
                className="w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-3 py-2.5 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors"
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
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="gauge">
                Gauge
              </label>
              <select
                id="gauge"
                value={gauge}
                disabled={!material}
                onChange={(e) => setGauge(e.target.value)}
                className="w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-3 py-2.5 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-40"
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

          <div>
            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">Length</span>
            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
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
                  step="0.125"
                  value={lengthInches}
                  onChange={(e) => setLengthInches(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="quantity">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between font-label text-xs text-afs-chrome-mid">
              Snap to 15° angle
              <input type="checkbox" checked={snapAngle} onChange={(e) => setSnapAngle(e.target.checked)} className="accent-afs-crimson" />
            </label>
            <label className="flex items-center justify-between font-label text-xs text-afs-chrome-mid">
              Snap to 1/8&quot; dimension
              <input
                type="checkbox"
                checked={snapDimension}
                onChange={(e) => setSnapDimension(e.target.checked)}
                className="accent-afs-crimson"
              />
            </label>
          </div>

          {selectedBendPoint !== null && (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3">
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="bendRadius">
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
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else we should know?"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>

          <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded overflow-hidden">
            <div className="px-3 py-2 border-b border-afs-chrome-dim">
              <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid">
                Profile Match {matchLoading && '· searching…'}
              </span>
            </div>
            {matches.length === 0 ? (
              <p className="font-body text-xs text-afs-chrome-dim px-3 py-3">
                Draw at least one bend to see matching profiles.
              </p>
            ) : (
              <ul>
                {matches.map((m) => {
                  const barColorClass = m.score >= 90 ? 'bg-afs-accent-green' : m.score >= 70 ? 'bg-afs-amber' : 'bg-afs-crimson';
                  return (
                    <li key={m.profileId} className="px-3 py-2.5 border-b border-afs-chrome-dim last:border-b-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-body text-xs text-afs-chrome-high truncate">{m.nameEn}</span>
                        <span className="font-data text-sm font-semibold text-afs-chrome-high shrink-0">{m.score.toFixed(0)}% match</span>
                      </div>
                      <div className="h-1.5 bg-afs-bg-dim rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full ${barColorClass}`} style={{ width: `${Math.min(100, m.score)}%` }} />
                      </div>
                      <p className="font-body text-[11px] text-afs-chrome-dim">
                        Fabricated {m.fabricatedCount} time{m.fabricatedCount === 1 ? '' : 's'} in shop history
                      </p>
                      {m.isExactMatch && (
                        <p className="font-label text-[10px] font-bold text-afs-accent-green uppercase tracking-wide mt-1">
                          Exact Match — Machine program ready
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2.5 rounded transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={openLibrary}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs font-semibold px-3 py-2.5 rounded transition-colors"
              >
                Load
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — CANVAS */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors"
              >
                Zoom −
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors"
              >
                Zoom +
              </button>
              <span className="font-data text-xs text-afs-chrome-mid self-center">{Math.round(zoom * 100)}%</span>
            </div>
            <p className="font-body text-xs text-afs-chrome-dim">Ctrl+Z undo · Ctrl+Y redo · middle-mouse or Space+drag to pan</p>
          </div>

          <div
            ref={canvasWrapRef}
            className="flex-1 min-h-0 bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden relative"
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onDoubleClick={handleDoubleClick}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
              className="w-full h-full"
              style={{ touchAction: 'none' }}
            />

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
                {snapAngle && <span className="ml-2 opacity-80">{Math.round(dragPreview.angleDeg)}°</span>}
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
                  style={{ left: hemPopup.screenPos.x + 16, top: Math.max(8, hemPopup.screenPos.y - 70), minWidth: 190 }}
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
                          className={`font-label text-[10px] px-1.5 py-1.5 rounded border capitalize transition-colors ${
                            active
                              ? 'bg-afs-crimson text-white border-afs-crimson'
                              : 'bg-afs-bg-overlay text-white border-afs-border hover:bg-afs-bg-surface'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  {(hemPopup.endpoint === 'start' ? hemStart : hemEnd)?.type === 'open' && (
                    <div className="flex items-center gap-2">
                      <label className="font-label text-[10px] text-afs-chrome-mid">Gap (in)</label>
                      <input
                        type="number"
                        step="0.0625"
                        min="0"
                        value={hemGapDraft}
                        onChange={(e) => setOpenHemGap(e.target.value)}
                        className="w-16 bg-afs-bg-overlay border border-afs-border rounded px-1.5 py-1 font-data text-xs text-afs-chrome-high"
                      />
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

            {showFloatingPreview && topMatchDiagramBends && matches.length > 0 && matches[0].score >= 70 && (
              <div
                className="absolute top-3 right-3 z-20 bg-afs-bg-dim/95 border border-afs-chrome-dim rounded p-2 flex flex-col"
                style={{ width: 200, height: 150 }}
              >
                <div className="flex items-center justify-between mb-1 gap-1">
                  <p className="font-label text-[10px] text-afs-chrome-mid truncate">{matches[0].nameEn}</p>
                  <button
                    type="button"
                    onClick={() => setShowFloatingPreview(false)}
                    className="text-afs-chrome-dim hover:text-afs-crimson text-xs leading-none shrink-0"
                    aria-label="Close preview"
                  >
                    ×
                  </button>
                </div>
                <p className="font-data text-[10px] text-afs-crimson mb-1">{matches[0].score.toFixed(0)}% match</p>
                <div className="flex-1 min-h-0">
                  <BendSequenceDiagram bends={topMatchDiagramBends} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLibrary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6" onClick={() => setShowLibrary(false)}>
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-lg w-full max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl text-afs-chrome-high mb-4">Load from Library</h3>
            {libraryLoading ? (
              <p className="font-body text-sm text-afs-chrome-mid">Loading…</p>
            ) : libraryProfiles.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">No public profiles available yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {libraryProfiles.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => loadFromLibrary(p.id)}
                      className="w-full text-left font-body text-sm text-afs-chrome-high hover:bg-afs-bg-surface px-3 py-2 rounded transition-colors"
                    >
                      {p.name_en} <span className="font-data text-xs text-afs-chrome-dim">#{p.profile_number}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setShowLibrary(false)}
              className="mt-4 font-label text-sm text-afs-chrome-mid hover:text-afs-crimson transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {show3DConfirm && (
        <SubmitConfirmation3DModal
          bends={viewerBends}
          blankWidthMm={viewerBlankWidthMm}
          material={material}
          gauge={gauge}
          thicknessMm={gaugeToThicknessMm(gauge)}
          onCancel={() => setShow3DConfirm(false)}
          onConfirm={handle3DConfirmed}
        />
      )}
    </main>
  );
}
