'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ZOOM_OPEN_DELAY_MS } from '@/lib/ui/zoom-intent';
import {
  developedWidthIn,
  renderSavedProfileScene,
  V8_SHOP_NOTE_COLOR,
  type ViewerSize,
} from '@/lib/flashdraft/viewer-scene';
import type { SavedProfileResult } from '@/lib/data/v8-profile-geometry';
import { formatInches } from '@/lib/utils/format-inches';

/**
 * THE ONE PLACE A SAVED PROFILE IS DRAWN IN THE COMMAND CENTER.
 *
 * Thumbnail, enlarged view, full-size view. Takes a saved FlashDraft profile id
 * and renders ONLY from that profile's saved geometry — the points, hems and
 * bend radii the customer or the estimator actually drew.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHY THIS COMPONENT EXISTS, STATED PLAINLY.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Every profile drawing in the Command Center today comes from
 * `lib/design/v7-draw.ts` via `V7Drawing` / `V7Thumb`: a profile KIND out of a
 * nine-entry table, plus a handful of leg lengths. It is a picture of the
 * CATEGORY of flashing a job belongs to. It is not the customer's drawing, and
 * it cannot be — the table has no entry for a seven-bend custom, no way to say
 * which direction a hem kicks, and no concept of a bend's handedness at all
 * (CLAUDE.md rule #12, where the signed interior angle IS the meaning of a
 * bend). Shown at full size on the screen whose next button reaches the
 * Thalmann, a category picture labelled as the customer's profile is a wrong
 * instruction that looks like a right one.
 *
 * So: saved geometry, or an explicit "No saved drawing". There is no third
 * branch, and a stand-in is never rendered. `lib/data/v8-profile-geometry.ts`
 * decides which of the two it is and says why in plain English.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * IT DOES NOT CONTAIN A DRAWING ALGORITHM.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * All three sizes call `renderSavedProfileScene`, which calls
 * `drawProfileScene` — the same function FlashDraft's live editing canvas draws
 * with and the same one the shop snapshot is rendered with. Segments, angle
 * arcs, angle labels, hem folds, hem glyphs, hem labels, the painted-side
 * stripe and every dimension string are therefore the editor's own, not a
 * second interpretation of them. `scripts/audit/single-drawing-path.mjs` fails
 * the build if an admin screen draws a saved profile any other way.
 *
 * The three sizes differ ONLY in label size, padding and whether the grid is
 * drawn — all of it data in `VIEWER_SIZES`, so "what does the full-size view
 * show that the thumbnail does not" is one table rather than three code paths.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THE GESTURE, AND THE 230 ms.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Single click enlarges; double-click goes full size. Those overlap — a
 * double-click fires `click` twice first — so the enlarge is SCHEDULED and the
 * double-click cancels it (`ZOOM_OPEN_DELAY_MS`, with the contract line quoted
 * in that module). Without the cancel, one double-click opens two overlays.
 * `tests/visual/v8-interaction-gate.spec.ts` waits the delay out AFTER a
 * double-click to prove the enlarge never lands.
 *
 * Keyboard bypasses the timer: Enter/Space IS the intent, so it enlarges at
 * once, and the thumbnail is a real `<button>` so it is reachable at all. Same
 * reasoning as `lib/ui/hover-intent.ts` (rule #27).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT THE HOST SCREEN SUPPLIES, AND WHY THE VIEWER DOES NOT FETCH IT.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * `shopNotes` and `paintedSide` belong to the JOB, not to the profile — the
 * same saved profile can be run twice with different paint and different
 * instructions. The viewer takes them as props and renders them; it never goes
 * looking, because a viewer that guessed which job a profile belonged to would
 * sometimes guess the wrong one.
 *
 * AND IT SAYS WHEN IT WAS NOT TOLD. With no `paintedSide`, the full-size view
 * prints "Painted side not specified for this job" rather than drawing no
 * stripe and letting the absence read as "paint neither face". An unanswered
 * question and an answer of "no" are different things on a shop floor.
 */

export interface ProfileViewerProps {
  /** A `saved_configurations` id — the Profile Passport row FlashDraft wrote. */
  profileId: string;
  /** What to call this profile in the overlays. The host's own wording. */
  label: string;
  /** Thumbnail box size in CSS pixels. The contract uses 56 (small) and 110 (medium). */
  thumbSize?: number;
  /** v7/v8 thumbnail box class, so the host controls the frame. */
  className?: string;
  /** Steve's red shop notes for THIS job. Never invented, never fetched here. */
  shopNotes?: string[];
  /** Which face is painted, when the job says. Omitted means nobody said. */
  paintedSide?: { face: 'up' | 'down'; color: string } | null;
  /**
   * Pre-loaded geometry, when the host already read it server-side. Omit and
   * the viewer fetches it once by id.
   */
  initialData?: SavedProfileResult;
}

/**
 * Module-level cache, keyed by profile id.
 *
 * SAFE ONLY BECAUSE A SAVED PROFILE'S DRAWING NEVER CHANGES IN PLACE — a
 * modification creates a new row (rule #13's lineage), which is the identical
 * argument `components/admin/LazyProfileThumb.tsx` records for its own cache.
 * If that ever stops being true, this cache is wrong before anything else is.
 */
const CACHE = new Map<string, SavedProfileResult>();

type Overlay = 'none' | 'enlarged' | 'fullsize';

/** One canvas rendering one saved profile at one size. */
function ProfileCanvas({
  data,
  size,
  width,
  height,
  paintedSide,
}: {
  data: Extract<SavedProfileResult, { kind: 'geometry' }>;
  size: ViewerSize;
  width: number;
  height: number;
  paintedSide?: { face: 'up' | 'down'; color: string } | null;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // DPR-aware, like FlashDraft's own canvas: without it every stroke and
    // every label is soft on a high-density display, and a soft dimension
    // string is the one thing a full-size view must not be.
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderSavedProfileScene({
      ctx,
      cssWidth: width,
      cssHeight: height,
      geometry: data.geometry,
      material: data.material,
      gauge: data.gauge,
      size,
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      paint: paintedSide ? { paintFace: paintedSide.face, resolvedPaintColor: paintedSide.color } : undefined,
    });
  }, [data, size, width, height, paintedSide]);

  return (
    <canvas
      ref={ref}
      style={{ width, height, display: 'block' }}
      role="img"
      aria-label={`${data.name ?? 'Saved'} profile drawing — ${data.bendCount} bends, ${data.hemCount} hems`}
      data-v8-profile-canvas={size}
    />
  );
}

export default function ProfileViewer({
  profileId,
  label,
  thumbSize = 110,
  className,
  shopNotes = [],
  paintedSide = null,
  initialData,
}: ProfileViewerProps) {
  const [data, setData] = useState<SavedProfileResult | null>(initialData ?? CACHE.get(profileId) ?? null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (data) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/v8/profile-geometry/${profileId}`, { cache: 'no-store' });
        if (!res.ok) {
          if (alive) setData({ kind: 'none', id: profileId, reason: 'The drawing could not be loaded just now.' });
          return;
        }
        const body = (await res.json()) as SavedProfileResult;
        CACHE.set(profileId, body);
        if (alive) setData(body);
      } catch {
        if (alive) setData({ kind: 'none', id: profileId, reason: 'The drawing could not be loaded just now.' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [profileId, data]);

  const cancelPending = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const close = useCallback(() => {
    cancelPending();
    setOverlay('none');
    returnFocus.current?.focus();
  }, [cancelPending]);

  useEffect(() => {
    if (overlay === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, close]);

  const hasDrawing = data?.kind === 'geometry';

  // ── the thumbnail ───────────────────────────────────────────────────────
  if (!data) {
    // Loading. An empty box of the right size, so nothing reflows when the
    // drawing arrives — and no spinner, because at these sizes a spinner is
    // bigger than the thing it is waiting for.
    return (
      <span
        className={className}
        style={{ display: 'inline-block', width: thumbSize, height: thumbSize }}
        aria-busy="true"
        aria-label={`Loading ${label} drawing`}
        data-v8-viewer="loading"
      />
    );
  }

  if (!hasDrawing) {
    /**
     * THE EXPLICIT ABSENCE. Not a placeholder shape, not a grey square with an
     * icon that reads as "a profile", not v7's generic empty box with nothing
     * in it — the words, in the box, with the reason. On a screen where the
     * next button along sends work to a bending machine, "we do not have the
     * drawing" has to be readable from the thumbnail, not discoverable by
     * clicking.
     *
     * It is NOT a `.zoom` and NOT a button: there is nothing to enlarge, and
     * a control that opens an empty overlay teaches people the overlay is
     * sometimes empty.
     */
    const absent = data as Extract<SavedProfileResult, { kind: 'none' }>;
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: thumbSize,
          height: thumbSize,
          padding: 4,
          textAlign: 'center',
          lineHeight: 1.15,
          fontSize: thumbSize >= 90 ? 11 : 9,
        }}
        title={absent.reason}
        data-v8-viewer="no-drawing"
        data-v8-reason={absent.reason}
      >
        No saved drawing
      </span>
    );
  }

  const geo = data as Extract<SavedProfileResult, { kind: 'geometry' }>;
  const dev = developedWidthIn(geo.geometry, geo.gauge);
  const metaLine = [
    // `formatInches` is this codebase's one answer for how an inch is written
    // (1 1/2", not 1.5) and the full-size view must agree with the labels on the
    // drawing beside it, which come from the same function inside
    // `drawProfileScene`. The contract's own meta line reads "Developed width 11
    // in"; a decimal here beside sixteenths there would be two notations for one
    // measurement on one screen.
    dev === null ? 'Developed width unavailable' : `Developed width ${formatInches(dev)}`,
    `${geo.bendCount} bend${geo.bendCount === 1 ? '' : 's'}`,
    `${geo.hemCount} hem${geo.hemCount === 1 ? '' : 's'}`,
  ].join(' · ');

  return (
    <>
      <button
        type="button"
        ref={returnFocus}
        className={['zoom', className].filter(Boolean).join(' ')}
        data-v8-viewer="drawing"
        data-profile-id={geo.id}
        title="Click to enlarge · double-click for full size"
        aria-label={`${label} — click to enlarge, double-click for full size`}
        style={{ display: 'inline-block', padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}
        onClick={() => {
          // SCHEDULED, not opened. See ZOOM_OPEN_DELAY_MS.
          cancelPending();
          timer.current = setTimeout(() => {
            timer.current = null;
            setOverlay('enlarged');
          }, ZOOM_OPEN_DELAY_MS);
        }}
        onDoubleClick={() => {
          cancelPending();
          setOverlay('fullsize');
        }}
        onKeyDown={(e) => {
          // A key press IS the intent — no delay to disambiguate.
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cancelPending();
            setOverlay('enlarged');
          }
        }}
      >
        <ProfileCanvas data={geo} size="thumb" width={thumbSize} height={thumbSize} />
      </button>

      {overlay !== 'none' && (
        <div
          id="v8-scrim"
          data-v8-overlay-scrim
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,30,0.55)', zIndex: 80 }}
        />
      )}

      {overlay === 'enlarged' && (
        <div
          id="v8-pop"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} — enlarged`}
          data-v8-overlay="enlarged"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex: 81,
            background: '#fff',
            borderRadius: 10,
            padding: 14,
            boxShadow: '0 18px 48px rgba(16,24,30,0.35)',
          }}
          // Double-clicking the enlarged drawing goes full size, exactly as the
          // contract's `#ps.ondblclick` does.
          onDoubleClick={() => {
            cancelPending();
            setOverlay('fullsize');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <b data-v8-overlay-title>{geo.name ?? label}</b>
            <button
              type="button"
              data-v8-overlay-close
              aria-label="Close"
              onClick={close}
              style={{ marginLeft: 'auto', border: 0, background: 'none', cursor: 'pointer', fontSize: 16 }}
            >
              ✕
            </button>
          </div>
          <ProfileCanvas data={geo} size="enlarged" width={420} height={260} paintedSide={paintedSide} />
          <div style={{ marginTop: 8, fontSize: 12 }}>
            Saved FlashDraft profile · <b>double-click the drawing for full size</b>
          </div>
        </div>
      )}

      {overlay === 'fullsize' && (
        <div
          id="v8-full"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} — full size`}
          data-v8-overlay="fullsize"
          style={{
            position: 'fixed',
            inset: '4vh 4vw',
            zIndex: 81,
            background: '#fff',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            padding: 16,
            overflow: 'auto',
            boxShadow: '0 24px 64px rgba(16,24,30,0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <h2 data-v8-overlay-title style={{ margin: 0 }}>
              {geo.name ?? label}
            </h2>
            <span data-v8-overlay-meta>{metaLine}</span>
            <button
              type="button"
              data-v8-overlay-close
              aria-label="Close"
              onClick={close}
              style={{ marginLeft: 'auto', border: 0, background: 'none', cursor: 'pointer', fontSize: 18 }}
            >
              ✕
            </button>
          </div>

          {/* Steve's shop notes, in the contract's red, above the drawing. The
              host supplied them; nothing here composes or edits them. */}
          {shopNotes.length > 0 && (
            <div data-v8-shop-notes style={{ marginTop: 10, display: 'grid', gap: 6 }}>
              {shopNotes.map((note) => (
                <div
                  key={note}
                  data-v8-shop-note
                  style={{
                    background: V8_SHOP_NOTE_COLOR,
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: 6,
                    padding: '6px 10px',
                    width: 'fit-content',
                    maxWidth: '100%',
                  }}
                >
                  {note}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, flex: 1, minHeight: 0 }}>
            <ProfileCanvas data={geo} size="fullsize" width={1100} height={620} paintedSide={paintedSide} />
          </div>

          {/* The painted side is a property of the JOB. Saying so beats drawing
              nothing and letting the absence read as an answer. */}
          <div data-v8-painted-side style={{ marginTop: 8, fontSize: 13 }}>
            {paintedSide
              ? `Painted side marked on the ${paintedSide.face === 'up' ? 'upper' : 'lower'} face.`
              : 'Painted side not specified for this job.'}
          </div>
        </div>
      )}
    </>
  );
}
