'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALL_MATERIALS, GAUGES_BY_MATERIAL } from '@/lib/data/catalog';
import { gaugeToThicknessMm } from '@/lib/utils/gauge-thickness';
import { formatInches, signedAngleBetween } from '@/lib/flashdraft/geometry';
import { flashDraftReducer, initialFlashDraftState } from '@/lib/flashdraft/reducer';
import type { BendPoint, GeoPoint, Leg, ProfileGeometry, QuoteSubmissionProfile } from '@/lib/flashdraft/types';
import FlashDraftCanvas from '@/components/studio/flashdraft/FlashDraftCanvas';
import FlashDraftToolbar from '@/components/studio/flashdraft/FlashDraftToolbar';
import FlashDraftPropertiesPanel from '@/components/studio/flashdraft/FlashDraftPropertiesPanel';
import FlashDraftProfileInfo from '@/components/studio/flashdraft/FlashDraftProfileInfo';
import HemPopup from '@/components/studio/flashdraft/HemPopup';
import SubmitFlow from '@/components/studio/flashdraft/SubmitFlow';
import ProfileViewer3D, { type ProfileBend } from '@/components/studio/ProfileViewer3D';
import BendSequenceDiagram from '@/components/studio/BendSequenceDiagram';
import SubmitConfirmation3DModal, { type PaintFace } from '@/components/studio/SubmitConfirmation3DModal';
import MatchedProfile3DModal from '@/components/studio/MatchedProfile3DModal';
import ProfileDetailsModal, { type ProfileDetailsFormValues } from '@/components/studio/ProfileDetailsModal';
import type { ProfileMatch, DiagramBend } from '@/app/api/studio/match-profile/route';

const MM_PER_INCH = 25.4;
const MATCH_DEBOUNCE_MS = 600;
const MATCH_SPLIT_THRESHOLD = 70;

interface LibraryProfile {
  id: string;
  name_en: string;
  profile_number: string;
}

function convertProfileToBends(geometry: ProfileGeometry, blankWidthIn: number): ProfileBend[] {
  const bends: ProfileBend[] = geometry.bendPoints.map((bend) => {
    const incomingLeg = geometry.legs.find((l) => l.id === bend.incomingLegId);
    const outgoingLeg = geometry.legs.find((l) => l.id === bend.outgoingLegId);
    return {
      leftLeg: (incomingLeg?.lengthIn ?? 0) * MM_PER_INCH,
      rightLeg: (outgoingLeg?.lengthIn ?? 0) * MM_PER_INCH,
      angle: Math.abs(bend.angleDegrees),
      radius: bend.radiusIn * MM_PER_INCH,
    };
  });
  // A single leg with no interior bend still has a real blank width —
  // represent it as one straight "bend" so the 3D extrusion renders a flat
  // strip instead of staying empty (mirrors the pre-rewrite page's fallback).
  if (bends.length === 0 && geometry.legs.length === 1) {
    bends.push({ leftLeg: blankWidthIn * MM_PER_INCH, rightLeg: 0, angle: 180, radius: 0 });
  }
  return bends;
}

// Reconstructs a Leg/BendPoint graph from the flat point polyline the
// machine_profiles library (and the "turtle graphics" bend-sequence walk)
// produces — same reconstruction BendSequenceDiagram and the pre-rewrite
// page used, just re-targeted at the new geometry model.
function pointsToGeometry(points: GeoPoint[]): ProfileGeometry {
  const legs: Leg[] = [];
  const bendPoints: BendPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const startGeo = points[i];
    const endGeo = points[i + 1];
    const leg: Leg = {
      id: crypto.randomUUID(),
      startGeo,
      endGeo,
      lengthIn: Math.hypot(endGeo.x - startGeo.x, endGeo.y - startGeo.y),
      angleRad: Math.atan2(endGeo.y - startGeo.y, endGeo.x - startGeo.x),
      hems: [],
    };
    legs.push(leg);
    if (legs.length > 1) {
      const prevLeg = legs[legs.length - 2];
      const v1 = { x: prevLeg.startGeo.x - leg.startGeo.x, y: prevLeg.startGeo.y - leg.startGeo.y };
      const v2 = { x: leg.endGeo.x - leg.startGeo.x, y: leg.endGeo.y - leg.startGeo.y };
      bendPoints.push({
        id: crypto.randomUUID(),
        geo: leg.startGeo,
        angleDegrees: signedAngleBetween(v1, v2),
        radiusIn: 0.5,
        incomingLegId: prevLeg.id,
        outgoingLegId: leg.id,
      });
    }
  }
  return { legs, bendPoints, hems: [] };
}

function buildQuoteSubmissionProfile(state: ReturnType<typeof flashDraftReducer>): QuoteSubmissionProfile {
  const { profile } = state;
  const { geometry } = profile;
  return {
    profileName: profile.name,
    blankWidthIn: profile.blankWidthIn,
    totalLengthFt: profile.lengthFt,
    totalLengthInExtra: profile.lengthInExtra,
    quantity: profile.quantity,
    materialId: profile.materialId ?? '',
    gaugeId: profile.gaugeId ?? '',
    notes: profile.notes,
    paintFace: profile.paintFace,
    legs: geometry.legs.map((leg) => ({
      lengthIn: leg.lengthIn,
      hems: leg.hems.map((h) => ({ type: h.type, lengthIn: h.lengthIn, gapIn: h.gapIn, distanceFromStartIn: h.distanceFromStartIn })),
    })),
    bendPoints: geometry.bendPoints.map((b) => ({ angleDegrees: b.angleDegrees, radiusIn: b.radiusIn })),
  };
}

function buildBendSummary(state: ReturnType<typeof flashDraftReducer>): string {
  const { geometry } = state.profile;
  if (geometry.legs.length === 0) return 'No profile drawn.';
  const segments = geometry.legs.map((l) => formatInches(l.lengthIn));
  const angles = geometry.bendPoints.map((b) => `${Math.abs(b.angleDegrees).toFixed(0)}°`);
  const radii = geometry.bendPoints.map((b) => `${b.radiusIn.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}"`);
  const hemParts = geometry.hems.map((h) => `${h.type} (${formatInches(h.lengthIn)}, ${h.gapIn.toFixed(3)}" gap)`);
  return `FlashDraft profile — legs: ${segments.join(' / ')}${angles.length ? `; bend angles: ${angles.join(' / ')}` : ''}${
    radii.length ? `; bend radii: ${radii.join(' / ')}` : ''
  }${hemParts.length ? `; hems: ${hemParts.join(', ')}` : ''}`;
}

export default function FlashDraftPage() {
  const [state, dispatch] = useReducer(flashDraftReducer, initialFlashDraftState);
  const { profile, hemPopup, activeView } = state;
  const { geometry } = profile;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 440 });
  const didInitialFitRef = useRef(false);

  const [editingName, setEditingName] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [duplicateOnSave, setDuplicateOnSave] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryProfiles, setLibraryProfiles] = useState<LibraryProfile[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [topMatchDiagramBends, setTopMatchDiagramBends] = useState<DiagramBend[] | null>(null);
  const [splitDismissed, setSplitDismissed] = useState(false);
  const [showMatched3DView, setShowMatched3DView] = useState(false);
  const lastTopMatchIdRef = useRef<string | null>(null);

  const [show3DConfirm, setShow3DConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitFlowActive, setSubmitFlowActive] = useState(false);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);

  const gaugeOptions = profile.materialId ? GAUGES_BY_MATERIAL[profile.materialId] ?? [] : [];
  const thicknessMm = gaugeToThicknessMm(profile.gaugeId);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  // --- Global keyboard shortcuts: undo/redo, escape, delete/backspace.
  // Skipped while focus is in a text field so typing in Notes/Name still
  // works. ---
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        dispatch({ type: 'KEY_DOWN', key: e.key, ctrl: true });
        return;
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'KEY_DOWN', key: 'Escape', ctrl: false });
        return;
      }
      if (inField) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'KEY_DOWN', key: e.key, ctrl: false });
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSizeChange = useCallback(
    (width: number, height: number) => {
      setCanvasSize({ width, height });
      if (!didInitialFitRef.current && geometry.legs.length === 0) {
        didInitialFitRef.current = true;
        dispatch({ type: 'FIT_TO_SCREEN', canvasWidth: width, canvasHeight: height });
      }
    },
    [geometry.legs.length]
  );

  // --- Debounced profile matching (Section 12) ---
  useEffect(() => {
    if (geometry.legs.length < 2) {
      setMatches([]);
      setTopMatchDiagramBends(null);
      return;
    }
    const handle = setTimeout(async () => {
      setMatchLoading(true);
      try {
        const bends = geometry.bendPoints.map((bend) => {
          const incomingLeg = geometry.legs.find((l) => l.id === bend.incomingLegId);
          const outgoingLeg = geometry.legs.find((l) => l.id === bend.outgoingLegId);
          return {
            angle: Math.abs(bend.angleDegrees),
            leftLeg: incomingLeg?.lengthIn ?? 0,
            rightLeg: outgoingLeg?.lengthIn ?? 0,
          };
        });
        const res = await fetch('/api/studio/match-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bends, blankWidth: profile.blankWidthIn }),
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
  }, [geometry, profile.blankWidthIn]);

  // --- /studio/library "Load into FlashDraft" deep-link (?loadProfile=<id>) ---
  const loadFromLibrary = useCallback(async (profileId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('machine_profile_bends')
      .select('step_number, left_leg_in, right_leg_in, bend_angle_degrees')
      .eq('profile_id', profileId)
      .order('step_number', { ascending: true });

    const bendRows = (data ?? []) as { step_number: number; left_leg_in: number | null; right_leg_in: number | null; bend_angle_degrees: number | null }[];

    const reconstructed: GeoPoint[] = [{ x: 0, y: 0 }];
    let heading = 0;
    let current: GeoPoint = { x: 0, y: 0 };
    for (const bend of bendRows) {
      const legLength = bend.left_leg_in ?? 0;
      current = {
        x: current.x + Math.cos((heading * Math.PI) / 180) * legLength,
        y: current.y + Math.sin((heading * Math.PI) / 180) * legLength,
      };
      reconstructed.push(current);
      const angle = bend.bend_angle_degrees ?? 180;
      heading += 180 - angle;
    }
    if (bendRows.length > 0) {
      const last = bendRows[bendRows.length - 1];
      const legLength = last.right_leg_in ?? 0;
      current = {
        x: current.x + Math.cos((heading * Math.PI) / 180) * legLength,
        y: current.y + Math.sin((heading * Math.PI) / 180) * legLength,
      };
      reconstructed.push(current);
    }

    dispatch({ type: 'LOAD_PROFILE', profile: { ...profile, geometry: pointsToGeometry(reconstructed) } });
    setShowLibrary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadId = new URLSearchParams(window.location.search).get('loadProfile');
    if (loadId) loadFromLibrary(loadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // --- Save / Duplicate (Section 14) ---
  const openSaveModal = () => {
    setDuplicateOnSave(false);
    setSaveError(null);
    setShowSaveModal(true);
  };
  const openDuplicateModal = () => {
    setDuplicateOnSave(true);
    setSaveError(null);
    setShowSaveModal(true);
  };

  // Reuses the pre-existing saved_configurations table. material_id/gauge_id
  // are real UUID FKs into materials/gauges (SCHEMA.md), but FlashDraft's
  // material/gauge pickers are plain catalog strings (that DB data hasn't
  // been delivered yet — CLAUDE.md Data Blockers) — so, matching the
  // pre-rewrite page's already-shipped behavior, those FK columns stay null
  // and the catalog strings travel inside `dimensions` instead.
  const performSave = async (values: ProfileDetailsFormValues, asDuplicate: boolean) => {
    setSavingProfile(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaveError('Sign in to save profiles to your account.');
        setSavingProfile(false);
        return;
      }
      const payload = {
        user_id: user.id,
        name: values.name,
        dimensions: {
          kind: 'flashdraft_v2',
          profile: { ...profile, name: values.name },
          categoryId: values.categoryId,
          subcategory: values.subcategory,
        },
        length_ft: profile.lengthFt + profile.lengthInExtra / 12 || null,
        quantity: profile.quantity || null,
        notes: profile.notes || null,
      };
      if (profile.savedProfileId && !asDuplicate) {
        const { error } = await supabase.from('saved_configurations').update(payload).eq('id', profile.savedProfileId);
        if (error) throw error;
        dispatch({ type: 'MARK_SAVED', profileId: profile.savedProfileId, name: values.name });
      } else {
        const { data, error } = await supabase.from('saved_configurations').insert(payload).select('id').single();
        if (error) throw error;
        dispatch({ type: 'MARK_SAVED', profileId: (data as { id: string }).id, name: values.name });
      }
      setShowSaveModal(false);
      setToast('Profile saved to your account');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setSaveError('Could not save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveDraft = () => {
    try {
      window.localStorage.setItem('afs-flashdraft-draft', JSON.stringify(profile));
      setDraftSavedNotice(true);
      setTimeout(() => setDraftSavedNotice(false), 2500);
    } catch {
      setSubmitError('Could not save draft — your browser may be blocking local storage.');
    }
  };

  // --- Submission (Section 15) ---
  const validateForSubmit = (): string | null => {
    if (geometry.legs.length === 0) return 'Please draw at least one profile segment.';
    if (!profile.materialId) return 'Please select a material.';
    if (!profile.gaugeId) return 'Please select a gauge.';
    if (profile.lengthFt === 0 && profile.lengthInExtra === 0) return 'Please enter a length.';
    if (profile.quantity < 1) return 'Please enter a quantity.';
    return null;
  };

  const openSubmitFlow = () => {
    const error = validateForSubmit();
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setShow3DConfirm(true);
  };

  const submitQuoteRequest = useCallback(
    async (paintFace: PaintFace | null) => {
      setSubmitError(null);
      setSubmitting(true);
      const submissionProfile = buildQuoteSubmissionProfile(state);
      const combinedNotes = [buildBendSummary(state), profile.notes.trim() || null].filter(Boolean).join('\n\n');
      try {
        const res = await fetch('/api/quote-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [
              {
                profileType: 'Custom FlashDraft Profile',
                material: profile.materialId,
                gauge: profile.gaugeId,
                lengthFt: profile.lengthFt + profile.lengthInExtra / 12,
                quantity: profile.quantity,
                unit: 'LF',
                paint_face: paintFace ?? undefined,
                flashdraftGeometry: submissionProfile,
              },
            ],
            notes: combinedNotes,
            isRush: false,
          }),
        });
        const data = (await res.json()) as { requestNumber?: string; error?: string };
        if (!res.ok) {
          setSubmitError(data.error ?? 'Submission failed. Please try again.');
          setSubmitting(false);
          return;
        }
        setRequestNumber(data.requestNumber ?? null);
        setShow3DConfirm(false);
        setSubmitting(false);
        setSubmitFlowActive(true);
      } catch {
        setSubmitError('Submission failed. Please try again.');
        setSubmitting(false);
      }
    },
    [state, profile]
  );

  const handle3DConfirmed = (paintFace: PaintFace | null) => {
    dispatch({ type: 'SET_PAINT_FACE', face: paintFace ?? 'up' });
    if (isAuthenticated) {
      submitQuoteRequest(paintFace);
    } else {
      setShow3DConfirm(false);
      setSubmitError('Please sign in to submit a quote request.');
    }
  };

  const viewerBends = convertProfileToBends(geometry, profile.blankWidthIn);
  const viewerBlankWidthMm = profile.blankWidthIn * MM_PER_INCH;
  const selectedMaterialName = profile.materialId || 'Galvanized Steel';
  const selectedGaugeName = profile.gaugeId || GAUGES_BY_MATERIAL['Galvanized Steel']?.[1] || '24 ga';
  const selectedThicknessMm = gaugeToThicknessMm(selectedGaugeName);

  const showSplit = !splitDismissed && matches.length > 0 && matches[0].score >= MATCH_SPLIT_THRESHOLD;
  const matchedProfileBends: ProfileBend[] = (topMatchDiagramBends ?? []).map((b) => ({
    leftLeg: b.leftLegMm ?? 0,
    rightLeg: b.rightLegMm ?? 0,
    angle: b.bendAngleDegrees ?? 180,
    radius: b.radiusMm ?? 0,
  }));
  const matchedProfileBlankWidthMm =
    matchedProfileBends.reduce((s, b) => s + b.leftLeg, 0) + (matchedProfileBends[matchedProfileBends.length - 1]?.rightLeg ?? 0);

  const currentHem = hemPopup.hemId ? geometry.hems.find((h) => h.id === hemPopup.hemId) ?? null : null;

  if (submitFlowActive) {
    return (
      <SubmitFlow
        bends={viewerBends}
        blankWidthMm={viewerBlankWidthMm}
        material={selectedMaterialName}
        gauge={selectedGaugeName}
        thicknessMm={selectedThicknessMm}
        profileName={profile.name}
        requestNumber={requestNumber}
        paintFace={profile.paintFace}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2.75rem)] bg-afs-bg-base overflow-hidden">
      <div className="px-6 py-1.5 border-b border-afs-chrome-dim flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="font-label text-afs-crimson text-[10px] tracking-widest uppercase">FlashDraft</span>
          <h1 className="font-heading text-base text-afs-chrome-high leading-tight">Draw Your Profile</h1>
        </div>
      </div>

      <FlashDraftToolbar
        state={state}
        dispatch={dispatch}
        onNew={() => {
          if (window.confirm('Clear the current canvas, hems, and match results? Unsaved work will be lost.')) {
            dispatch({ type: 'CLEAR' });
            setMatches([]);
            setTopMatchDiagramBends(null);
          }
        }}
        onOpen={openLibrary}
        onSave={openSaveModal}
        onDuplicate={openDuplicateModal}
        onEditName={() => setEditingName(true)}
        isAuthenticated={!!isAuthenticated}
        currentZoom={Math.round((state.transform.scale / 40) * 100)}
        canvasSize={canvasSize}
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* LEFT PANEL */}
        <div className="w-full lg:w-[320px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="material">
                Material
              </label>
              <select
                id="material"
                value={profile.materialId ?? ''}
                onChange={(e) => dispatch({ type: 'SET_MATERIAL', materialId: e.target.value })}
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
                value={profile.gaugeId ?? ''}
                disabled={!profile.materialId}
                onChange={(e) => dispatch({ type: 'SET_GAUGE', gaugeId: e.target.value })}
                className="w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-3 py-2.5 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-40"
              >
                <option value="" disabled>
                  {profile.materialId ? 'Select' : '—'}
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
                  value={profile.lengthFt}
                  onChange={(e) => dispatch({ type: 'SET_LENGTH_FT', ft: Number(e.target.value) || 0 })}
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
                  value={profile.lengthInExtra}
                  onChange={(e) => dispatch({ type: 'SET_LENGTH_IN', inches: Number(e.target.value) || 0 })}
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
              value={profile.quantity}
              onChange={(e) => dispatch({ type: 'SET_QUANTITY', quantity: Number(e.target.value) || 1 })}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson transition-colors"
            />
          </div>

          <p className="font-body text-[11px] text-afs-chrome-dim border-t border-afs-chrome-dim pt-3">
            Snapping: 15° angle increments, 1/8&quot; length increments — always on.
          </p>

          <FlashDraftPropertiesPanel state={state} dispatch={dispatch} />

          <div>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={profile.notes}
              onChange={(e) => dispatch({ type: 'SET_NOTES', notes: e.target.value })}
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
              <p className="font-body text-xs text-afs-chrome-dim px-3 py-3">Draw at least one bend to see matching profiles.</p>
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
          {isAuthenticated === false && (
            <p className="font-body text-xs text-afs-chrome-dim">
              <a href="/login" className="text-afs-crimson hover:underline">
                Sign in
              </a>{' '}
              to submit a quote request or save this profile.
            </p>
          )}

          <div className="flex flex-col gap-2 mt-auto pt-2">
            <button
              type="button"
              onClick={openSubmitFlow}
              disabled={submitting}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit for Quote'}
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
                onClick={() => {
                  dispatch({ type: 'CLEAR' });
                  setMatches([]);
                  setTopMatchDiagramBends(null);
                }}
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

        {/* CANVAS AREA */}
        <div className="flex-1 flex min-w-0 min-h-0 relative">
          {activeView === '2d' ? (
            <>
              <div className="relative min-h-0 flex-1" style={{ transition: 'width 300ms' }}>
                {editingName && (
                  <div className="absolute top-2 left-2 z-50 bg-black/90 rounded px-2 py-1">
                    <input
                      autoFocus
                      value={profile.name}
                      onChange={(e) => dispatch({ type: 'SET_PROFILE_NAME', name: e.target.value })}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                      className="bg-transparent border-b border-white outline-none text-white text-xs font-mono"
                    />
                  </div>
                )}
                <FlashDraftCanvas state={state} dispatch={dispatch} onSizeChange={handleSizeChange} />
                <FlashDraftProfileInfo profile={profile} dispatch={dispatch} />
                <HemPopup hemPopup={hemPopup} dispatch={dispatch} currentHem={currentHem} />
              </div>
              {showSplit && matches[0] && (
                <div className="w-[40%] border-l border-afs-border bg-afs-bg-base flex flex-col p-4 gap-3 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-afs-chrome-mid uppercase">Profile Match</span>
                    <button type="button" onClick={() => setSplitDismissed(true)} className="text-afs-chrome-dim hover:text-white text-lg leading-none">
                      ×
                    </button>
                  </div>
                  {topMatchDiagramBends && <BendSequenceDiagram bends={topMatchDiagramBends} className="w-full h-48 bg-afs-bg-dim rounded" />}
                  <div>
                    <div className="text-white font-semibold text-sm mb-1">{matches[0].nameEn}</div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 rounded bg-afs-bg-surface overflow-hidden">
                        <div
                          className={`h-full rounded ${matches[0].score >= 90 ? 'bg-afs-accent-green' : matches[0].score >= 70 ? 'bg-afs-amber' : 'bg-afs-crimson'}`}
                          style={{ width: `${Math.min(100, matches[0].score)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-white">{matches[0].score.toFixed(0)}%</span>
                    </div>
                    {matches[0].isExactMatch && (
                      <div className="text-xs text-afs-accent-green font-semibold mb-1">EXACT MATCH — Machine program ready</div>
                    )}
                    <div className="text-xs text-afs-chrome-dim">
                      Fabricated {matches[0].fabricatedCount} time{matches[0].fabricatedCount === 1 ? '' : 's'} in shop history
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMatched3DView(true)}
                    className="w-full py-2 bg-afs-crimson text-white rounded text-sm font-semibold hover:bg-afs-crimson-hover transition-colors"
                  >
                    → View in 3D
                  </button>
                </div>
              )}
            </>
          ) : (
            <ProfileViewer3D
              bends={viewerBends}
              blankWidth={viewerBlankWidthMm}
              material={selectedMaterialName}
              gauge={selectedGaugeName}
              thicknessMm={selectedThicknessMm}
              profileName={profile.name}
              className="flex-1"
            />
          )}
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
          material={selectedMaterialName}
          gauge={selectedGaugeName}
          thicknessMm={selectedThicknessMm}
          submitting={submitting}
          onCancel={() => setShow3DConfirm(false)}
          onConfirm={handle3DConfirmed}
        />
      )}

      {showMatched3DView && matches[0] && (
        <MatchedProfile3DModal
          profileName={matches[0].nameEn}
          bends={matchedProfileBends}
          blankWidthMm={matchedProfileBlankWidthMm}
          material={selectedMaterialName}
          gauge={selectedGaugeName}
          thicknessMm={selectedThicknessMm}
          onClose={() => setShowMatched3DView(false)}
        />
      )}

      {showSaveModal && (
        <ProfileDetailsModal
          initialValues={{
            name: duplicateOnSave ? `Copy of ${profile.name}` : profile.name,
            categoryId: null,
            subcategory: '',
          }}
          onCancel={() => setShowSaveModal(false)}
          onSave={(values) => performSave(values, duplicateOnSave)}
          saving={savingProfile}
          error={saveError}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] bg-afs-bg-raised border border-afs-accent-green rounded px-4 py-3 shadow-raised">
          <p className="font-body text-sm text-afs-chrome-high">{toast}</p>
        </div>
      )}
    </div>
  );
}
