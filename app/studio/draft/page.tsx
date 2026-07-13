'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALL_MATERIALS, GAUGES_BY_MATERIAL } from '@/lib/data/catalog';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';

type ToolMode = 'draw' | 'select' | 'erase';
type SubmitState = 'idle' | 'submitting' | 'submitted';
type ViewMode = '2d' | '3d';

interface Point {
  x: number;
  y: number;
  /** Bend radius in inches — only meaningful for interior (bend) points. */
  radius?: number;
}

interface ProfileMatch {
  profileId: string;
  nameEn: string;
  profileNumber: string;
  score: number;
}

const MM_PER_INCH = 25.4;
const VIEWER_DEBOUNCE_MS = 300;

// Shown in the 3D panel before the user has drawn anything, so the
// viewer never renders empty — a generic coping cap silhouette in mm.
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
// custom properties — mirrors the afs-crimson / afs-ink-900 tokens for the
// canvas-drawn profile and its dimension labels (same documented exception
// pattern already used for the Stripe CardElement in app/checkout/page.tsx).
const CANVAS_COLORS = {
  background: '#F5F5F0',
  grid: 'rgba(17, 17, 17, 0.08)',
  profile: '#C0001A',
  profileSelected: '#2563EB',
  point: '#C0001A',
  ink: '#111111',
  dragLabelBg: 'rgba(17, 17, 17, 0.92)',
  dragLabelText: '#FFFFFF',
  radiusHandle: '#00C853',
  radiusHandleWarn: '#D32F2F',
  radiusLabelBg: '#4A0072',
  radiusLabelText: '#FFFFFF',
};

const PIXELS_PER_INCH = 20;
const GRID_INCHES = 0.25;
const SNAP_ANGLE_DEGREES = 15;
const SNAP_DIMENSION_INCHES = 0.125;
const CANVAS_MIN_WIDTH = 600;
const CANVAS_MIN_HEIGHT = 500;
const HIT_RADIUS_PX = 10;
const MATCH_DEBOUNCE_MS = 500;

const RADIUS_HANDLE_GAP_PX = 10;
const RADIUS_HANDLE_ICON_PX = 12;
const RADIUS_LABEL_GAP_PX = 24;
const RADIUS_HANDLE_HIT_PX = 14;
const MIN_BEND_RADIUS_IN = 0.125;
const MAX_BEND_RADIUS_IN = 4;
const MIN_DRAG_SEGMENT_IN = 0.05;

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

function bendOffsetDirection(prev: Point, curr: Point, next: Point): Point {
  const n1 = { x: -(curr.y - prev.y), y: curr.x - prev.x };
  const len1 = Math.hypot(n1.x, n1.y) || 1;
  const u1 = { x: n1.x / len1, y: n1.y / len1 };
  const n2 = { x: -(next.y - curr.y), y: next.x - curr.x };
  const len2 = Math.hypot(n2.x, n2.y) || 1;
  const u2 = { x: n2.x / len2, y: n2.y / len2 };
  let x = u1.x + u2.x;
  let y = u1.y + u2.y;
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    x = u1.x;
    y = u1.y;
  } else {
    x /= len;
    y /= len;
  }
  return { x, y };
}

function radiusHandleOffsetPx(radiusIn: number, zoom: number): number {
  return radiusIn * PIXELS_PER_INCH * zoom + RADIUS_HANDLE_GAP_PX;
}

function formatRadiusLabel(radiusIn: number): string {
  const rounded = Math.round(radiusIn * 10000) / 10000;
  const text = rounded.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return `R: ${text}"`;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
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

export default function FlashDraftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // --- Bend radius handle drag state ---
  const [draggingRadiusIndex, setDraggingRadiusIndex] = useState<number | null>(null);
  const [radiusDragPreview, setRadiusDragPreview] = useState<number | null>(null);
  const [hoveredRadiusHandle, setHoveredRadiusHandle] = useState<number | null>(null);

  const [material, setMaterial] = useState('');
  const [gauge, setGauge] = useState('');
  const [lengthFeet, setLengthFeet] = useState('9');
  const [lengthInches, setLengthInches] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('2d');
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

  const gaugeOptions = material ? GAUGES_BY_MATERIAL[material] ?? [] : [];
  const lengthFtDecimal = (Number(lengthFeet) || 0) + (Number(lengthInches) || 0) / 12;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
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
    (i: number): number => {
      if (draggingRadiusIndex === i && radiusDragPreview !== null) return radiusDragPreview;
      return points[i]?.radius ?? defaultBendRadiusIn(material);
    },
    [points, material, draggingRadiusIndex, radiusDragPreview]
  );

  // Bend radius edits are a secondary property tweak, not a structural
  // change — applied directly rather than through commitPoints so dragging
  // the handle or typing in the panel doesn't flood the undo stack.
  const applyBendRadius = useCallback((i: number, radiusIn: number) => {
    const clamped = Math.max(MIN_BEND_RADIUS_IN, Math.min(MAX_BEND_RADIUS_IN, radiusIn));
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, radius: clamped } : p)));
  }, []);

  // Sync the left-panel radius field to the selected point / live drag value
  // without clobbering an in-progress keystroke that hasn't committed yet.
  useEffect(() => {
    if (selectedBendPoint === null) return;
    if (draggingRadiusIndex !== null && draggingRadiusIndex !== selectedBendPoint) return;
    const value = getEffectiveRadius(selectedBendPoint);
    setBendRadiusInput(value.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBendPoint, radiusDragPreview, points]);

  // --- Keyboard shortcuts: undo/redo, space-to-pan ---
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

  // Screen-space center of the draggable bend-radius handle for interior
  // point `i` — shared by the draw loop (rendering) and pointer handlers
  // (hit-testing) so the two never drift apart.
  const radiusHandleScreenPos = useCallback(
    (i: number, canvas: HTMLCanvasElement, radiusIn: number): Point => {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const s = worldToScreen(curr, canvas);
      const dir = bendOffsetDirection(prev, curr, next);
      const offsetPx = radiusHandleOffsetPx(radiusIn, zoom);
      return { x: s.x + dir.x * offsetPx, y: s.y + dir.y * offsetPx };
    },
    [points, worldToScreen, zoom]
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

    // Points + bend angle labels
    points.forEach((p, i) => {
      const s = worldToScreen(p, canvas);
      ctx.fillStyle = CANVAS_COLORS.point;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (i > 0 && i < points.length - 1) {
        const angle = bendAngleAt(points[i - 1], p, points[i + 1]);
        ctx.fillStyle = CANVAS_COLORS.ink;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${angle.toFixed(0)}°`, s.x + 8, s.y + 16);
      }
    });

    // Bend radius handles: fillet preview arc, draggable handle, dimension
    // line, and "R: x.xx"" label — one per interior (bend) point.
    const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;
    const gaugeIsThick = isGauge18OrThicker(gauge);
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const s = worldToScreen(curr, canvas);
      const dir = bendOffsetDirection(prev, curr, next);
      const effectiveRadius = getEffectiveRadius(i);
      const isTooTight = gaugeIsThick && effectiveRadius < thicknessIn * 1.5;
      const handleColor = isTooTight ? CANVAS_COLORS.radiusHandleWarn : CANVAS_COLORS.radiusHandle;

      // Fillet preview arc (approximate — centered at the vertex, spanning
      // between the two adjacent legs, scaled to the actual radius value).
      const angleToPrev = Math.atan2(prev.y - curr.y, prev.x - curr.x);
      const angleToNext = Math.atan2(next.y - curr.y, next.x - curr.x);
      let sweep = angleToNext - angleToPrev;
      while (sweep <= -Math.PI) sweep += Math.PI * 2;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      const arcRadiusPx = Math.max(4, effectiveRadius * PIXELS_PER_INCH * zoom);
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, arcRadiusPx, angleToPrev, angleToNext, sweep < 0);
      ctx.stroke();

      const offsetPx = radiusHandleOffsetPx(effectiveRadius, zoom);
      const handleCenter = radiusHandleScreenPos(i, canvas, effectiveRadius);
      const labelAnchor = {
        x: s.x + dir.x * (offsetPx + RADIUS_LABEL_GAP_PX),
        y: s.y + dir.y * (offsetPx + RADIUS_LABEL_GAP_PX),
      };

      ctx.strokeStyle = CANVAS_COLORS.radiusHandle;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(labelAnchor.x, labelAnchor.y);
      ctx.stroke();

      const handleIconRadius = hoveredRadiusHandle === i || draggingRadiusIndex === i ? RADIUS_HANDLE_ICON_PX + 2 : RADIUS_HANDLE_ICON_PX;
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handleCenter.x, handleCenter.y, handleIconRadius, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = handleColor;
      ctx.beginPath();
      ctx.arc(handleCenter.x, handleCenter.y, 3, 0, Math.PI * 2);
      ctx.fill();

      const labelText = formatRadiusLabel(effectiveRadius);
      ctx.font = `11px ${jetbrainsFontRef.current}`;
      const textWidth = ctx.measureText(labelText).width;
      const boxW = textWidth + 12;
      const boxH = 19;
      ctx.fillStyle = isTooTight ? CANVAS_COLORS.radiusHandleWarn : CANVAS_COLORS.radiusLabelBg;
      drawRoundedRect(ctx, labelAnchor.x - boxW / 2, labelAnchor.y - boxH / 2, boxW, boxH, 3);
      ctx.fillStyle = CANVAS_COLORS.radiusLabelText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, labelAnchor.x, labelAnchor.y);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
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
    getEffectiveRadius,
    hoveredRadiusHandle,
    draggingRadiusIndex,
    radiusHandleScreenPos,
  ]);

  // --- Debounced profile matching ---
  useEffect(() => {
    if (points.length < 3) {
      setMatches([]);
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
        const res = await fetch('/api/studio/match-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bends, blankWidth }),
        });
        if (res.ok) {
          const data = (await res.json()) as { matches: ProfileMatch[] };
          setMatches(data.matches ?? []);
        }
      } catch {
        // Non-critical — matching is a helper panel, not a required step.
      } finally {
        setMatchLoading(false);
      }
    }, MATCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [points]);

  // --- Debounced 3D viewer sync (mirrors the profile-match bend shape, in mm) ---
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
  }, [points, material]);

  // --- Pointer handlers (mouse + touch via the Pointer Events API) ---
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hitTestRadiusHandle = useCallback(
    (screenPos: Point, canvas: HTMLCanvasElement): number | null => {
      let hit: number | null = null;
      let minDist = RADIUS_HANDLE_HIT_PX;
      for (let i = 1; i < points.length - 1; i++) {
        const center = radiusHandleScreenPos(i, canvas, getEffectiveRadius(i));
        const d = Math.hypot(screenPos.x - center.x, screenPos.y - center.y);
        if (d < minDist) {
          minDist = d;
          hit = i;
        }
      }
      return hit;
    },
    [points, radiusHandleScreenPos, getEffectiveRadius]
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

    const handleHit = hitTestRadiusHandle(screenPos, canvas);
    if (handleHit !== null) {
      setDraggingRadiusIndex(handleHit);
      setSelectedBendPoint(handleHit);
      setSelectedSegment(null);
      setRadiusDragPreview(getEffectiveRadius(handleHit));
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
      let pointHit: number | null = null;
      let minPointDist = HIT_RADIUS_PX;
      for (let i = 1; i < points.length - 1; i++) {
        const s = worldToScreen(points[i], canvas);
        const d = Math.hypot(screenPos.x - s.x, screenPos.y - s.y);
        if (d < minPointDist) {
          minPointDist = d;
          pointHit = i;
        }
      }
      if (pointHit !== null) {
        setSelectedBendPoint(pointHit);
        setSelectedSegment(null);
        return;
      }
      setSelectedBendPoint(null);

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
      setSelectedSegment(hit);
      if (hit !== null) {
        setSegmentLengthInput(dist(points[hit], points[hit + 1]).toFixed(4));
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

    if (draggingRadiusIndex !== null) {
      const jointScreen = worldToScreen(points[draggingRadiusIndex], canvas);
      const distPx = Math.hypot(screenPos.x - jointScreen.x, screenPos.y - jointScreen.y);
      const rawRadius = (distPx - RADIUS_HANDLE_GAP_PX) / (PIXELS_PER_INCH * zoom);
      const snapped = Math.round(rawRadius / 0.0625) * 0.0625;
      setRadiusDragPreview(Math.max(MIN_BEND_RADIUS_IN, Math.min(MAX_BEND_RADIUS_IN, snapped)));
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

    const hit = hitTestRadiusHandle(screenPos, canvas);
    setHoveredRadiusHandle(hit);
    if (hit !== null) {
      const thicknessIn = gaugeToThicknessMm(gauge) / MM_PER_INCH;
      const isTooTight = isGauge18OrThicker(gauge) && getEffectiveRadius(hit) < thicknessIn * 1.5;
      canvas.title = isTooTight ? 'Radius too tight for this gauge' : '';
      canvas.style.cursor = 'pointer';
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
    if (draggingRadiusIndex !== null) {
      if (radiusDragPreview !== null) applyBendRadius(draggingRadiusIndex, radiusDragPreview);
      setDraggingRadiusIndex(null);
      setRadiusDragPreview(null);
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
    if (isDragDrawing || draggingRadiusIndex !== null || isPanning) return;
    setHoveredRadiusHandle(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.title = '';
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(4, z - e.deltaY * 0.001)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
  }, [tool]);

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

  const applySegmentLength = () => {
    if (selectedSegment === null) return;
    const newLength = Number(segmentLengthInput);
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

  const clearCanvas = () => {
    commitPoints([]);
    setMatches([]);
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

  const loadFromLibrary = async (profileId: string) => {
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

    commitPoints(reconstructed);
    setShowLibrary(false);
  };

  const saveDraft = () => {
    try {
      window.localStorage.setItem(
        'afs-flashdraft-draft',
        JSON.stringify({ points, material, gauge, lengthFeet, lengthInches, quantity, notes })
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
    return `FlashDraft profile — legs: ${segments.join(' / ')}${angles.length ? `; bend angles: ${angles.join(' / ')}` : ''}${radii.length ? `; bend radii: ${radii.join(' / ')}` : ''}`;
  };

  const submitQuoteRequest = useCallback(
    async (email?: string) => {
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
    [points, material, gauge, lengthFtDecimal, quantity, notes, getEffectiveRadius]
  );

  const handleSubmit = () => {
    if (isAuthenticated) {
      submitQuoteRequest();
    } else {
      setSubmitError(null);
      setShowEmailCapture(true);
    }
  };

  const canvasWidth = Math.max(CANVAS_MIN_WIDTH, containerRef.current?.clientWidth ?? CANVAS_MIN_WIDTH);

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
    <main className="min-h-screen bg-afs-bg-base">
      <div className="px-6 pt-10 pb-4 text-center">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">FlashDraft</p>
        <h1 className="font-display text-4xl text-afs-chrome-high leading-none mb-2">Draw Your Profile</h1>
        <p className="font-body text-afs-chrome-mid text-sm max-w-xl mx-auto">
          Click to place bend points. Matched against our machine library for instant fabrication.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-6 pb-10 max-w-[1600px] mx-auto">
        {/* LEFT PANEL */}
        <div className="w-full lg:w-[380px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 flex flex-col gap-5">
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

          {selectedSegment !== null && (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-3">
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="segLength">
                Segment {selectedSegment + 1} Length (in)
              </label>
              <div className="flex gap-2">
                <input
                  id="segLength"
                  type="number"
                  step="0.0625"
                  value={segmentLengthInput}
                  onChange={(e) => setSegmentLengthInput(e.target.value)}
                  className="flex-1 bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
                />
                <button
                  type="button"
                  onClick={applySegmentLength}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs font-semibold px-3 rounded transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          )}

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
                {matches.map((m) => (
                  <li key={m.profileId} className="flex items-center justify-between px-3 py-2 border-b border-afs-chrome-dim last:border-b-0">
                    <span className="font-body text-xs text-afs-chrome-high">{m.nameEn}</span>
                    <span className="font-data text-xs text-afs-crimson">{m.score.toFixed(0)}%</span>
                  </li>
                ))}
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
                  onClick={() => submitQuoteRequest(guestEmail.trim())}
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
              onClick={handleSubmit}
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
        <div ref={containerRef} className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-afs-bg-overlay border border-afs-border rounded p-1">
              {(['2d', '3d'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewMode(v)}
                  className={`font-label text-xs px-3 py-1.5 rounded transition-colors ${
                    viewMode === v ? 'bg-afs-crimson text-white' : 'text-afs-chrome-mid hover:text-white'
                  }`}
                >
                  {v === '2d' ? '2D View' : '3D View'}
                </button>
              ))}
            </div>

            {viewMode === '2d' ? (
              <>
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
              </>
            ) : (
              <p className="font-body text-xs text-afs-chrome-dim">Live preview — updates as you draw</p>
            )}
          </div>

          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge overflow-hidden relative">
            {viewMode === '2d' ? (
              <>
                <canvas
                  ref={canvasRef}
                  width={canvasWidth}
                  height={CANVAS_MIN_HEIGHT}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onWheel={handleWheel}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full"
                  style={{ minWidth: CANVAS_MIN_WIDTH, minHeight: CANVAS_MIN_HEIGHT, touchAction: 'none' }}
                />
                {isDragDrawing && dragPreview && dragScreenPos && (
                  <div
                    className="absolute z-20 pointer-events-none font-label font-semibold rounded"
                    style={{
                      left: dragScreenPos.x + 16,
                      top: dragScreenPos.y + 16,
                      background: 'rgba(17, 17, 17, 0.92)',
                      color: '#FFFFFF',
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
              </>
            ) : (
              <div style={{ minHeight: CANVAS_MIN_HEIGHT }}>
                {points.length < 2 && (
                  <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 font-body text-sm text-afs-chrome-mid bg-afs-bg-raised/90 px-4 py-2 rounded border border-afs-chrome-dim pointer-events-none">
                    Draw a profile to see your 3D preview
                  </p>
                )}
                <ProfileViewer3D
                  bends={viewerBends}
                  blankWidth={viewerBlankWidthMm}
                  material={material || 'Galvanized Steel'}
                  gauge={gauge || GAUGES_BY_MATERIAL[material || 'Galvanized Steel']?.[1] || '24 ga'}
                  thicknessMm={gaugeToThicknessMm(gauge || GAUGES_BY_MATERIAL[material || 'Galvanized Steel']?.[1])}
                  profileName={points.length < 2 ? 'Standard Coping Cap (example)' : undefined}
                  className="w-full"
                />
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
    </main>
  );
}
