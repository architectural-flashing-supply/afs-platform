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
};

const PIXELS_PER_INCH = 20;
const GRID_INCHES = 0.25;
const SNAP_ANGLE_DEGREES = 15;
const SNAP_DIMENSION_INCHES = 0.125;
const CANVAS_MIN_WIDTH = 600;
const CANVAS_MIN_HEIGHT = 500;
const HIT_RADIUS_PX = 10;
const MATCH_DEBOUNCE_MS = 500;

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

  const [points, setPoints] = useState<Point[]>([]);
  const [past, setPast] = useState<Point[][]>([]);
  const [future, setFuture] = useState<Point[][]>([]);

  const [tool, setTool] = useState<ToolMode>('draw');
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [segmentLengthInput, setSegmentLengthInput] = useState('');

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panOrigin = useRef<{ mouse: Point; pan: Point } | null>(null);
  const spacePressed = useRef(false);

  const [snapAngle, setSnapAngle] = useState(true);
  const [snapDimension, setSnapDimension] = useState(true);

  const [material, setMaterial] = useState('');
  const [gauge, setGauge] = useState('');
  const [lengthFt, setLengthFt] = useState('10');
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

    if (points.length === 0) return;

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
  }, [points, selectedSegment, zoom, pan, worldToScreen]);

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
          radius: 3,
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
  }, [points]);

  // --- Mouse handlers ---
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const screenPos = getMousePos(e);

    if (e.button === 1 || spacePressed.current) {
      setIsPanning(true);
      panOrigin.current = { mouse: screenPos, pan };
      return;
    }

    if (tool === 'draw' && e.button === 0) {
      const raw = screenToWorld(screenPos.x, screenPos.y, canvas);
      const last = points[points.length - 1];
      const next = last ? applySnapping(last, raw, snapAngle, snapDimension) : snapDimension ? snapToGrid(raw) : raw;
      commitPoints([...points, next]);
    } else if (tool === 'select' && e.button === 0) {
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
    } else if (tool === 'erase' && e.button === 0) {
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && panOrigin.current) {
      const screenPos = getMousePos(e);
      setPan({
        x: panOrigin.current.pan.x + (screenPos.x - panOrigin.current.mouse.x),
        y: panOrigin.current.pan.y + (screenPos.y - panOrigin.current.mouse.y),
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    panOrigin.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(4, z - e.deltaY * 0.001)));
  };

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
    const newPoints = points.map((p, i) => (i > selectedSegment ? { x: p.x + delta.x, y: p.y + delta.y } : p));
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
        JSON.stringify({ points, material, gauge, lengthFt, quantity, notes })
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
    for (let i = 1; i < points.length - 1; i++) {
      angles.push(`${bendAngleAt(points[i - 1], points[i], points[i + 1]).toFixed(0)}°`);
    }
    return `FlashDraft profile — legs: ${segments.join(' / ')}${angles.length ? `; bend angles: ${angles.join(' / ')}` : ''}`;
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
                lengthFt: Number(lengthFt) || 0,
                quantity: Number(quantity) || 1,
                unit: 'LF',
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
    [points, material, gauge, lengthFt, quantity, notes]
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="lengthFt">
                Length (ft)
              </label>
              <input
                id="lengthFt"
                type="number"
                min="0"
                value={lengthFt}
                onChange={(e) => setLengthFt(e.target.value)}
                className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
              />
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
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={CANVAS_MIN_HEIGHT}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full cursor-crosshair"
                style={{ minWidth: CANVAS_MIN_WIDTH, minHeight: CANVAS_MIN_HEIGHT }}
              />
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
