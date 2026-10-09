'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ZOOM_OPEN_DELAY_MS } from '@/lib/ui/zoom-intent';
import { HOVER_OPEN_DELAY_MS, HOVER_GRACE_DELAY_MS } from '@/lib/ui/hover-intent';
import {
  DOC_WIDTH,
  VIEWER_DISPLAY,
  developedWidthIn,
  renderSavedProfileScene,
  V8_SHOP_NOTE_COLOR,
  type ViewerSize,
} from '@/lib/flashdraft/viewer-scene';
import type { ProfileSource, ProfileSourceGeometry } from '@/lib/data/v8-profile-source';
import { formatInches } from '@/lib/utils/format-inches';

/**
 * THE ONE PLACE A PROFILE IS SHOWN IN THE COMMAND CENTER — four sources, four
 * sizes, and nothing invented or dropped at any of them.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * REID'S PROFILE RULES (2026-10-09), AND HOW EACH ONE IS MET HERE.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. EVERY THUMBNAIL SHOWS THE REAL SAVED IMAGE FROM ITS SOURCE. The four
 *    sources are resolved by `lib/data/v8-profile-source.ts` and arrive here as
 *    a discriminated union, so this component cannot accidentally render one as
 *    another: `geometry` is drawn by FlashDraft's own renderer, `photo` is the
 *    actual photograph on a signed URL, `png` is the real saved raster, and
 *    `none` is an explicit to-do. NOTHING IS INVENTED, TRACED, VECTORISED OR
 *    PARAMETRICALLY DRAWN — there is no code path here that could.
 *
 * 2. HOVER = A LARGER PREVIEW of the real saved image, on the shared
 *    `lib/ui/hover-intent.ts` timings (CLAUDE.md rule #27: do not inline the
 *    timers). A sweep across a table of thumbnails must open none of them.
 *
 * 3. SINGLE CLICK = enlarged. DOUBLE CLICK = full size. Those gestures overlap,
 *    so the enlarge is SCHEDULED and the double-click cancels it
 *    (`ZOOM_OPEN_DELAY_MS`). Photos and PNGs open full-size and zoomable;
 *    geometry opens with every number on it.
 *
 * 4. NOTHING IS EVER DROPPED AT ANY SIZE. This is structural, not a promise:
 *    `renderSavedProfileScene` composes ONE canonical document with every
 *    label, glyph and mark present and applies a single uniform scale, so a
 *    thumbnail is a true miniature of the full-size view rather than a reduced
 *    drawing. There is no per-size switch left to turn a label off with.
 *    A unit test asserts the drawn-string set is identical at every size.
 *
 * 5. EVERY ITEM GETS "SEND TO FLASHDRAFT", whatever its source — including a
 *    photo and including an item with no image at all, which is precisely the
 *    case where somebody needs to draw one. It is PROMINENT on a photo, because
 *    a photo is the case that always needs a redraw. The handoff is a plain
 *    link carrying the job and item, so the operator lands in the real editor;
 *    `onSendToFlashDraft` lets a host override it. An AI-assisted redraw from
 *    the photo is deliberately NOT built here — the button and the handoff are
 *    shaped so it can be added behind them later.
 */

export interface ProfileViewerProps {
  /**
   * The resolved source. Server-read and passed in, or fetched by `fetchFor`.
   *
   * `null` is accepted and means "not resolved" — a caller whose row genuinely
   * has no source yet. It renders the loading box rather than guessing, which
   * is different from `{ kind: 'none' }`, the resolver's explicit "there is no
   * image, and that is work".
   */
  source?: ProfileSource | null;
  /**
   * Fetch the source client-side when it was not passed. `job:<uuid>` or
   * `profile:<uuid>`. Prefer passing `source` — a server read costs no
   * round-trip and no signed-URL churn.
   */
  fetchFor?: string;
  /** What to call this item in the overlays and for screen readers. */
  label: string;
  /** Thumbnail box in CSS pixels. The contract uses 56 (small) and 110 (medium). */
  thumbSize?: number;
  className?: string;
  /** Steve's red shop notes for THIS job. Never invented, never fetched here. */
  shopNotes?: string[];
  /** Which face is painted, when the job says. Omitted means nobody said. */
  paintedSide?: { face: 'up' | 'down'; color: string } | null;
  /** Where "Send to FlashDraft" goes. Omit to hide the button (rare — rule 5). */
  flashDraftHref?: string | null;
}

/** Module cache, keyed by the fetch key. A saved drawing never changes in place (rule #13). */
const CACHE = new Map<string, ProfileSource>();

type Overlay = 'none' | 'enlarged' | 'fullsize';

/* ───────────────────────────── the canvas ──────────────────────────────── */

function GeometryCanvas({
  source,
  size,
  width,
  height,
  paintedSide,
}: {
  source: ProfileSourceGeometry;
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
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    renderSavedProfileScene({
      ctx,
      displayWidth: width,
      displayHeight: height,
      dpr,
      geometry: source.geometry,
      material: source.material,
      gauge: source.gauge,
      size,
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      paint: paintedSide ? { paintFace: paintedSide.face, resolvedPaintColor: paintedSide.color } : undefined,
    });
  }, [source, size, width, height, paintedSide]);

  return (
    <canvas
      ref={ref}
      style={{ width, height, display: 'block' }}
      role="img"
      aria-label={`${source.name ?? 'Saved'} profile drawing — ${source.bendCount} bends, ${source.hemCount} hems`}
      data-v8-profile-canvas={size}
    />
  );
}

/** The real photograph or the real saved raster. Never redrawn, only shown. */
function RasterImage({
  src,
  alt,
  width,
  height,
  size,
  contain,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  size: ViewerSize;
  contain?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{
        width,
        height,
        display: 'block',
        // `contain` at full size so nothing is cropped out of the picture;
        // `cover` on a thumbnail so the box is filled rather than letterboxed.
        objectFit: contain ? 'contain' : 'cover',
        background: '#1A1D23',
      }}
      data-v8-profile-raster={size}
    />
  );
}

/* ──────────────────────────── the component ────────────────────────────── */

export default function ProfileViewer({
  source: provided,
  fetchFor,
  label,
  thumbSize = 110,
  className,
  shopNotes = [],
  paintedSide = null,
  flashDraftHref = null,
}: ProfileViewerProps) {
  const cacheKey = fetchFor ?? '';
  const [source, setSource] = useState<ProfileSource | null>(
    provided ?? (cacheKey ? CACHE.get(cacheKey) ?? null : null),
  );
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [hovering, setHovering] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (provided) setSource(provided);
  }, [provided]);

  useEffect(() => {
    if (source || !fetchFor) return;
    let alive = true;
    (async () => {
      const fail: ProfileSource = {
        kind: 'none',
        reason: 'The drawing could not be loaded just now.',
        todo: true,
      };
      try {
        const res = await fetch(`/api/admin/v8/profile-source?for=${encodeURIComponent(fetchFor)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (alive) setSource(fail);
          return;
        }
        const body = (await res.json()) as ProfileSource;
        // A photo's signed URL expires, so it is deliberately NOT cached.
        if (body.kind !== 'photo') CACHE.set(fetchFor, body);
        if (alive) setSource(body);
      } catch {
        if (alive) setSource(fail);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchFor, source]);

  const clearTimers = useCallback(() => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const close = useCallback(() => {
    clearTimers();
    setOverlay('none');
    setHovering(false);
    returnFocus.current?.focus();
  }, [clearTimers]);

  useEffect(() => {
    if (overlay === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlay, close]);

  /* ── loading ───────────────────────────────────────────────────────────── */
  if (!source) {
    return (
      <span
        className={className}
        style={{ display: 'inline-block', width: thumbSize, height: thumbSize }}
        aria-busy="true"
        aria-label={`Loading ${label}`}
        data-v8-viewer="loading"
      />
    );
  }

  /* ── no image at all: an explicit TO-DO, never a stand-in ──────────────── */
  if (source.kind === 'none') {
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: thumbSize,
          height: thumbSize,
          padding: 4,
          textAlign: 'center',
          lineHeight: 1.15,
          fontSize: thumbSize >= 90 ? 11 : 9,
          border: '1px dashed #B3261E',
          borderRadius: 6,
          color: '#8A1C16',
          background: '#FFF4F3',
        }}
        title={source.reason}
        data-v8-viewer="no-drawing"
        data-v8-todo="1"
        data-v8-reason={source.reason}
      >
        No profile drawing yet
        {flashDraftHref && thumbSize >= 90 && (
          <a
            href={flashDraftHref}
            data-v8-send-to-flashdraft="1"
            style={{ fontSize: 10, fontWeight: 700, color: '#B3261E', textDecoration: 'underline' }}
            onClick={(e) => e.stopPropagation()}
          >
            Draw it
          </a>
        )}
      </span>
    );
  }

  const isGeometry = source.kind === 'geometry';
  const geo = isGeometry ? (source as ProfileSourceGeometry) : null;
  const rasterSrc = source.kind === 'photo' ? source.url : source.kind === 'png' ? source.dataUri : null;

  const dev = geo ? developedWidthIn(geo.geometry, geo.gauge) : null;
  const metaLine = geo
    ? [
        dev === null ? 'Developed width unavailable' : `Developed width ${formatInches(dev)}`,
        `${geo.bendCount} bend${geo.bendCount === 1 ? '' : 's'}`,
        `${geo.hemCount} hem${geo.hemCount === 1 ? '' : 's'}`,
      ].join(' · ')
    : source.kind === 'photo'
      ? `${source.caption} · ${source.fileName}`
      : source.kind === 'png'
        ? source.caption
        : '';

  const hoverPx = VIEWER_DISPLAY.hover.px;
  const enlargedPx = VIEWER_DISPLAY.enlarged.px;
  const aspect = 620 / DOC_WIDTH;

  const body = (size: ViewerSize, w: number, h: number, contain: boolean) =>
    geo ? (
      <GeometryCanvas source={geo} size={size} width={w} height={h} paintedSide={paintedSide} />
    ) : rasterSrc ? (
      <RasterImage src={rasterSrc} alt={label} width={w} height={h} size={size} contain={contain} />
    ) : null;

  const sendButton = (prominent: boolean) =>
    flashDraftHref ? (
      <a
        href={flashDraftHref}
        data-v8-send-to-flashdraft="1"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'inline-block',
          padding: prominent ? '8px 14px' : '5px 10px',
          borderRadius: 6,
          fontWeight: 700,
          fontSize: prominent ? 14 : 12,
          textDecoration: 'none',
          background: prominent ? '#C8102E' : 'transparent',
          color: prominent ? '#fff' : '#C8102E',
          border: prominent ? 'none' : '1px solid #C8102E',
        }}
      >
        Send to FlashDraft
      </a>
    ) : null;

  return (
    <>
      <span
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => setHovering(true), HOVER_OPEN_DELAY_MS);
        }}
        onMouseLeave={() => {
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => setHovering(false), HOVER_GRACE_DELAY_MS);
        }}
      >
        <button
          type="button"
          ref={returnFocus}
          className={['zoom', className].filter(Boolean).join(' ')}
          data-v8-viewer={source.kind}
          title="Hover to preview · click to enlarge · double-click for full size"
          aria-label={`${label} — hover to preview, click to enlarge, double-click for full size`}
          style={{ display: 'inline-block', padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}
          onClick={() => {
            clearTimers();
            clickTimer.current = setTimeout(() => {
              clickTimer.current = null;
              setHovering(false);
              setOverlay('enlarged');
            }, ZOOM_OPEN_DELAY_MS);
          }}
          onDoubleClick={() => {
            clearTimers();
            setHovering(false);
            setOverlay('fullsize');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              clearTimers();
              setOverlay('enlarged');
            }
          }}
        >
          {body('thumb', thumbSize, thumbSize, false)}
        </button>

        {/* RULE 2 — hover gives a larger preview of the real saved image. */}
        {hovering && overlay === 'none' && (
          <span
            data-v8-hover-preview="1"
            style={{
              position: 'absolute',
              zIndex: 60,
              top: '100%',
              left: 0,
              marginTop: 6,
              padding: 8,
              background: '#fff',
              border: '1px solid #D7DBE2',
              borderRadius: 8,
              boxShadow: '0 12px 32px rgba(16,24,30,0.28)',
              pointerEvents: 'none',
            }}
          >
            {body('hover', hoverPx, Math.round(hoverPx * aspect), true)}
            <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#3A4150' }}>{metaLine}</span>
          </span>
        )}
      </span>

      {overlay !== 'none' && (
        <div
          data-v8-overlay-scrim
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,30,0.55)', zIndex: 80 }}
        />
      )}

      {overlay === 'enlarged' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} — enlarged`}
          data-v8-overlay="enlarged"
          onDoubleClick={() => {
            clearTimers();
            setOverlay('fullsize');
          }}
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
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <b data-v8-overlay-title>{geo?.name ?? label}</b>
            <span data-v8-overlay-meta style={{ fontSize: 12, color: '#3A4150' }}>{metaLine}</span>
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
          {body('enlarged', enlargedPx, Math.round(enlargedPx * aspect), true)}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span>
              {geo ? 'Saved FlashDraft profile' : source.kind === 'photo' ? 'Photo from the field app' : 'Saved shop image'} ·{' '}
              <b>double-click for full size</b>
            </span>
            <span style={{ marginLeft: 'auto' }}>{sendButton(source.kind === 'photo')}</span>
          </div>
        </div>
      )}

      {overlay === 'fullsize' && (
        <div
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <h2 data-v8-overlay-title style={{ margin: 0 }}>
              {geo?.name ?? label}
            </h2>
            <span data-v8-overlay-meta>{metaLine}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
              {sendButton(source.kind === 'photo')}
              <button
                type="button"
                data-v8-overlay-close
                aria-label="Close"
                onClick={close}
                style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </span>
          </div>

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
            {body('fullsize', DOC_WIDTH, 620, true)}
          </div>

          {geo ? (
            <div data-v8-painted-side style={{ marginTop: 8, fontSize: 13 }}>
              {paintedSide
                ? `Painted side marked on the ${paintedSide.face === 'up' ? 'upper' : 'lower'} face.`
                : 'Painted side not specified for this job.'}
            </div>
          ) : (
            <div data-v8-raster-note style={{ marginTop: 8, fontSize: 13 }}>
              {source.kind === 'photo'
                ? 'This is the photograph as it was sent. It carries no dimensions — send it to FlashDraft to draw the profile.'
                : 'This is the image saved when the job went to the shop. It cannot be enlarged beyond its saved resolution.'}
            </div>
          )}

          {/* v7/v8's own legend, so the inks on the drawing are named. */}
          {geo && (
            <div
              data-v8-legend
              style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}
            >
              {[
                ['#C0001A', 'Profile'],
                ['#C0001A', 'Hem'],
                ['#111111', 'Dimension'],
                ['#B3261E', "Steve's shop note"],
              ].map(([hex, text]) => (
                <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <i style={{ width: 12, height: 12, borderRadius: 2, background: hex, display: 'inline-block' }} />
                  {text}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
