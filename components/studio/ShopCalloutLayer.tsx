'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TAIL_OFFSET_IN,
  defaultTailOffset,
  placementHit,
  resolveCalloutAnchor,
  type CalloutPoint,
} from '@/lib/shop-callouts/geometry';
import { stepRightClick, type RightClickMark } from '@/lib/shop-callouts/gesture';
import {
  CALLOUTS_UNREADABLE_MESSAGE,
  NOTE_MAX_CHARS,
  SHOP_NOTE_LABEL,
  numberCallouts,
  type ShopCallout,
} from '@/lib/shop-callouts/types';

/**
 * SHOP CALLOUTS — THE AUTHORING LAYER. ADMIN ONLY, AND ONLY HERE.
 *
 * ============ WHY THIS IS ITS OWN FILE AND LOADED DYNAMICALLY ============
 *
 * `app/studio/draft/page.tsx` is ONE component serving two audiences: the
 * public customer drawing tool at /studio/draft, and the admin session the
 * Command Center opens with `?admin=1&loadRequest=<id>`. `?admin=1` is a URL
 * flag and grants nothing — a customer can type it.
 *
 * So this file is reached through `next/dynamic` behind a gate that is a SERVER
 * ANSWER, not a query parameter: the page asks
 * `GET /api/admin/shop-callouts?quoteRequestId=…`, which answers 403 to
 * anything but a `role = 'admin'` profile, and only mounts this component if
 * that call succeeded. For a customer the request fails, the component never
 * mounts, and its JavaScript chunk is never fetched — there is no callout code
 * in the customer's page, no callout data on it, and no callout network call
 * from it. `lib/shop-callouts/isolation.test.ts` asserts all three statically.
 *
 * Authoring is gated three deep and the outer two are conveniences: the dynamic
 * import keeps the code away, the server gate keeps the UI away, and the API's
 * own admin check plus migration 051's RLS are what actually make it safe.
 *
 * ============ WHAT IT DRAWS ON, AND WHAT IT DOES NOT TOUCH ============
 *
 * An absolutely-positioned SVG OVER the canvas, never the canvas itself.
 * `lib/flashdraft/draw-profile-scene.ts` — the hem glyphs, the bend arcs, the
 * profile geometry — is not modified by this feature and is not imported here.
 * The overlay is `pointer-events: none` except on the handles themselves, so
 * every existing canvas gesture (draw, drag, Alt-move, Space-pan, wheel zoom)
 * reaches the canvas exactly as before.
 *
 * ============ NOTHING IS IN PIXELS ============
 *
 * Every anchor and every tail is stored in INCHES and projected through the
 * parent's own `worldToScreen` on each render, so zoom, pan, resize and
 * fit-to-view move the arrows with the drawing rather than away from it. The
 * one screen-space measurement in the whole file is the double-right-click's
 * 8px, which is a property of a HAND and not of a drawing.
 */

/** v7 and this project's crimson token, as literal hex for SVG paint. */
const CALLOUT_COLORS = {
  // CLAUDE.md rule #4's CANVAS_COLORS exception: an SVG `stroke`/`fill`
  // attribute cannot consume a Tailwind class, so these mirror the afs-*
  // tokens as literal hex. afs-crimson (#C0001A) measures 6.5:1 on white and
  // 5.2:1 on afs-bg-lane — AA body text on both Shop View surfaces, which is
  // why the same value is the note colour there.
  arrow: '#C0001A',
  arrowHalo: '#FFFFFF',
  badgeText: '#FFFFFF',
  selected: '#4A0072',
} as const;

const ARROW_HEAD_PX = 11;
const POPUP_WIDTH_PX = 300;
const BADGE_R_PX = 11;
const HANDLE_R_PX = 9;

export interface ShopCalloutLayerProps {
  /** The live canvas, so this layer can listen for the right-click on it. */
  canvas: HTMLCanvasElement | null;
  /** The job this drawing belongs to. Required — a callout with no job has nothing to be read on. */
  quoteRequestId: string;
  lineItemIndex: number;
  /** The profile as it is on the canvas now, in inches. */
  points: readonly CalloutPoint[];
  /** The parent's own transform, so there is only one copy of it. */
  toScreen: (p: CalloutPoint) => CalloutPoint | null;
  toWorld: (sx: number, sy: number) => CalloutPoint | null;
  /** Re-render triggers. The values are not read; the identity change is the signal. */
  zoom: number;
  pan: { x: number; y: number };
  /** A locked profile is read-only, including its callouts. */
  disabled?: boolean;
}

type Draft = {
  /** Null while creating; the row id when editing an existing note. */
  id: string | null;
  text: string;
  /** Kept so a failed save can put the arrow back exactly where it was. */
  anchor: {
    segmentIndex: number;
    segmentCount: number;
    t: number;
    segA: CalloutPoint;
    segB: CalloutPoint;
    anchor: CalloutPoint;
  };
  tail: { dx: number; dy: number };
  saving: boolean;
  error: string | null;
  confirmingDelete: boolean;
};

export default function ShopCalloutLayer({
  canvas,
  quoteRequestId,
  lineItemIndex,
  points,
  toScreen,
  toWorld,
  zoom,
  pan,
  disabled = false,
}: ShopCalloutLayerProps) {
  const [callouts, setCallouts] = useState<ShopCallout[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [arming, setArming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * The notes could not be READ — which is not the same as there being none.
   * Steve is told, because otherwise he adds a second note that is already
   * there, or assumes the shop has nothing to read. See ShopCalloutSet.unreadable.
   */
  const [unreadable, setUnreadable] = useState(false);
  const lastRightClick = useRef<RightClickMark | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragging = useRef<{ id: string; part: 'tip' | 'tail' } | null>(null);
  /** The current callouts, readable from a listener that outlived its render. */
  const latestRef = useRef<ShopCallout[]>([]);
  latestRef.current = callouts;

  // `pan`/`zoom` are props purely so a view change re-renders this layer; the
  // arrows are recomputed from inches below. Referenced here so the dependency
  // is visible rather than implicit.
  const viewKey = `${zoom}:${pan.x}:${pan.y}`;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 3200);
  }, []);

  /** Re-read from the server. The authoritative numbering and orphan state. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/shop-callouts?quoteRequestId=${encodeURIComponent(quoteRequestId)}&item=${lineItemIndex}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { callouts?: ShopCallout[]; unreadable?: boolean };
      setUnreadable(data.unreadable === true);
      if (Array.isArray(data.callouts)) setCallouts(data.callouts);
    } catch {
      // A failed refresh leaves what is on screen. It is never the thing that
      // empties the list — a disappearing shop note is the worst outcome here.
    }
  }, [quoteRequestId, lineItemIndex]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * EVERY CALLOUT, RESOLVED AGAINST THE CANVAS AS IT IS RIGHT NOW.
   *
   * The server resolved them against the geometry it has STORED. Steve may
   * have moved a leg since without saving, so they are resolved again here
   * against the live `points` — which is what makes "Anchor changed —
   * re-place" appear while he is still looking at the change that caused it.
   */
  const resolved = useMemo(() => {
    return numberCallouts(
      callouts.map((c) => {
        const r = resolveCalloutAnchor(
          {
            segmentIndex: c.segmentIndex,
            segmentCount: c.segmentCount,
            t: c.t,
            segA: c.segA,
            segB: c.segB,
            anchor: c.anchor,
          },
          points
        );
        return { ...c, anchorStatus: r.status, tip: r.tip };
      })
    );
  }, [callouts, points]);

  const orphanCount = resolved.filter((c) => c.anchorStatus === 'orphaned').length;

  /** Place a new callout at a world point, or refuse and say why. */
  const placeAt = useCallback(
    (world: CalloutPoint) => {
      const hit = placementHit(world, points);
      if (!hit) {
        showToast('Click closer to the profile');
        return;
      }
      const segA = points[hit.segmentIndex];
      const segB = points[hit.segmentIndex + 1];
      const tail = defaultTailOffset(hit.point, segA, segB, points, DEFAULT_TAIL_OFFSET_IN);
      setArming(false);
      setSelectedId(null);
      setDraft({
        id: null,
        text: '',
        anchor: {
          segmentIndex: hit.segmentIndex,
          segmentCount: Math.max(1, points.length - 1),
          t: hit.t,
          segA: { x: segA.x, y: segA.y },
          segB: { x: segB.x, y: segB.y },
          anchor: hit.point,
        },
        tail: { dx: tail.x, dy: tail.y },
        saving: false,
        error: null,
        confirmingDelete: false,
      });
    },
    [points, showToast]
  );

  /**
   * THE DOUBLE-RIGHT-CLICK, listened for on the canvas itself.
   *
   * A NATIVE listener added by this component rather than a prop on the
   * canvas, so the parent's existing `onContextMenu={(e) =>
   * e.preventDefault()}` — which has suppressed the native menu on this canvas,
   * and only on this canvas, since long before this feature — is left exactly
   * as it was. The timing and distance rule is `stepRightClick`, which is
   * pure and unit-tested; this handler holds one ref and no logic.
   */
  useEffect(() => {
    if (!canvas || disabled) return;
    const onContextMenu = (e: MouseEvent) => {
      // Already prevented by the canvas's own React handler. Repeated here
      // because this listener must not depend on the order the two run in.
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mark: RightClickMark = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        at: e.timeStamp,
      };
      const step = stepRightClick(lastRightClick.current, mark);
      lastRightClick.current = step.next;
      if (!step.place) return;
      const world = toWorld(mark.x, mark.y);
      if (world) placeAt(world);
    };
    canvas.addEventListener('contextmenu', onContextMenu);
    return () => canvas.removeEventListener('contextmenu', onContextMenu);
  }, [canvas, disabled, toWorld, placeAt]);

  /**
   * THE ARMED-PLACEMENT FALLBACK — required, and not a nicety.
   *
   * A right-click double is unavailable on a tablet, awkward on a trackpad,
   * and unreachable from a keyboard. "Add shop note" arms placement and the
   * next single click on the canvas places the arrow. Esc disarms.
   */
  useEffect(() => {
    if (!canvas || !arming || disabled) return;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (world) placeAt(world);
    };
    // Capture, so arming claims the click before the canvas starts a new
    // segment with it. Without this, arming a note and clicking would both
    // place the note and draw a leg.
    canvas.addEventListener('click', onClick, true);
    canvas.addEventListener('pointerdown', swallow, true);
    return () => {
      canvas.removeEventListener('click', onClick, true);
      canvas.removeEventListener('pointerdown', swallow, true);
    };
  }, [canvas, arming, disabled, toWorld, placeAt]);

  /** Esc: cancel the popup if one is open, otherwise disarm placement. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (draft) {
        setDraft(null);
        e.stopPropagation();
      } else if (arming) {
        setArming(false);
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [draft, arming]);

  useEffect(() => {
    if (draft && !draft.saving) textareaRef.current?.focus();
    // Focus on open only — refocusing on every keystroke would fight the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, draft === null]);

  /** Save: create or update. Optimistic, with the typed text never lost. */
  const save = useCallback(async () => {
    if (!draft) return;
    const trimmed = draft.text.trim();
    if (trimmed.length === 0) {
      setDraft({ ...draft, error: 'Type a note before saving.' });
      return;
    }
    if (trimmed.length > NOTE_MAX_CHARS) {
      setDraft({ ...draft, error: `That is ${trimmed.length} characters. A shop note is ${NOTE_MAX_CHARS} at most.` });
      return;
    }
    setDraft({ ...draft, saving: true, error: null });

    // OPTIMISTIC. The arrow and the note appear at once; a failure puts the
    // list back exactly as it was and re-opens the popup with the text still
    // in it. `snapshot` is that rollback.
    const snapshot = callouts;
    const optimistic: ShopCallout = {
      id: draft.id ?? `pending-${Date.now()}`,
      number: callouts.length + 1,
      note: trimmed,
      authorName: 'Saving…',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      segmentIndex: draft.anchor.segmentIndex,
      segmentCount: draft.anchor.segmentCount,
      t: draft.anchor.t,
      segA: draft.anchor.segA,
      segB: draft.anchor.segB,
      anchor: draft.anchor.anchor,
      tail: draft.tail,
      orphaned: false,
      anchorStatus: 'exact',
      tip: draft.anchor.anchor,
    };
    setCallouts(draft.id ? callouts.map((c) => (c.id === draft.id ? { ...c, note: trimmed } : c)) : [...callouts, optimistic]);

    try {
      const res = draft.id
        ? await fetch(`/api/admin/shop-callouts/${draft.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: trimmed, tail: draft.tail, anchor: draft.anchor }),
          })
        : await fetch('/api/admin/shop-callouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quoteRequestId,
              lineItemIndex,
              segmentIndex: draft.anchor.segmentIndex,
              segmentCount: draft.anchor.segmentCount,
              t: draft.anchor.t,
              segA: draft.anchor.segA,
              segB: draft.anchor.segB,
              anchor: draft.anchor.anchor,
              tail: draft.tail,
              note: trimmed,
            }),
          });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCallouts(snapshot);
        setDraft((d) => (d ? { ...d, saving: false, error: data.error ?? 'That did not save. Your note is still here.' } : d));
        return;
      }
      setDraft(null);
      await refresh();
    } catch {
      setCallouts(snapshot);
      setDraft((d) =>
        d ? { ...d, saving: false, error: 'The connection dropped, so nothing was saved. Your note is still here.' } : d
      );
    }
  }, [draft, callouts, quoteRequestId, lineItemIndex, refresh]);

  /** Delete, after the popup's own confirm step. Never window.confirm(). */
  const remove = useCallback(async () => {
    if (!draft?.id) return;
    const snapshot = callouts;
    setCallouts(callouts.filter((c) => c.id !== draft.id));
    setDraft({ ...draft, saving: true, error: null });
    try {
      const res = await fetch(`/api/admin/shop-callouts/${draft.id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setCallouts(snapshot);
        setDraft((d) => (d ? { ...d, saving: false, error: data.error ?? 'That did not delete.' } : d));
        return;
      }
      setDraft(null);
      await refresh();
    } catch {
      setCallouts(snapshot);
      setDraft((d) => (d ? { ...d, saving: false, error: 'The connection dropped, so nothing was deleted.' } : d));
    }
  }, [draft, callouts, refresh]);

  /** Open an existing callout for editing. */
  const openExisting = useCallback(
    (c: (typeof resolved)[number]) => {
      setSelectedId(c.id);
      setDraft({
        id: c.id,
        text: c.note,
        anchor: {
          segmentIndex: c.segmentIndex,
          segmentCount: c.segmentCount,
          t: c.t,
          segA: c.segA,
          segB: c.segB,
          anchor: c.anchor,
        },
        tail: c.tail,
        saving: false,
        error: null,
        confirmingDelete: false,
      });
    },
    []
  );

  /**
   * Dragging a tip re-snaps it; dragging a tail just moves it. Both persist.
   *
   * The listeners are attached ONCE and no-op while nothing is being dragged,
   * rather than being attached when a drag starts. A ref cannot re-run an
   * effect, so the attach-on-demand version needed a state tick to re-arm
   * itself and dropped the first pointermove of every drag while it did.
   */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragging.current;
      if (!drag || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const world = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (!world) return;
      setCallouts((current) =>
        current.map((c) => {
          if (c.id !== drag.id) return c;
          if (drag.part === 'tail') {
            const tip = c.tip ?? c.anchor;
            return { ...c, tail: { dx: world.x - tip.x, dy: world.y - tip.y } };
          }
          const hit = placementHit(world, points);
          if (!hit) return c;
          const segA = points[hit.segmentIndex];
          const segB = points[hit.segmentIndex + 1];
          return {
            ...c,
            segmentIndex: hit.segmentIndex,
            segmentCount: Math.max(1, points.length - 1),
            t: hit.t,
            segA: { x: segA.x, y: segA.y },
            segB: { x: segB.x, y: segB.y },
            anchor: hit.point,
            tip: hit.point,
            anchorStatus: 'exact',
            orphaned: false,
          };
        })
      );
    };
    const onUp = () => {
      const drag = dragging.current;
      dragging.current = null;
      if (!drag) return;
      // The post-drag value, read from the ref the render keeps current — not
      // from this closure, which was created before the drag moved anything.
      const c = latestRef.current.find((row) => row.id === drag.id);
      if (!c) return;
      const failed = () =>
        showToast('The arrow moved on screen but did not save. Reload to see where it really is.');
      fetch(`/api/admin/shop-callouts/${drag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tail: c.tail,
          anchor: {
            segmentIndex: c.segmentIndex,
            segmentCount: c.segmentCount,
            t: c.t,
            segA: c.segA,
            segB: c.segB,
            anchor: c.anchor,
          },
        }),
      })
        .then((res) => {
          if (!res.ok) failed();
        })
        .catch(failed);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [canvas, toWorld, points, showToast]);

  const startDrag = (id: string, part: 'tip' | 'tail') => (e: React.PointerEvent) => {
    if (disabled) return;
    // stopPropagation but NOT preventDefault: preventing the default on a
    // pointerdown suppresses the compatibility mouse events the browser would
    // otherwise synthesise, and the badge is also a <button> that needs its
    // click. Stopping propagation is enough to keep the canvas out of it.
    e.stopPropagation();
    dragging.current = { id, part };
  };

  if (disabled) return null;

  const draftTip = draft ? toScreen(draft.anchor.anchor) : null;
  const draftTail = draft && draftTip ? toScreen({ x: draft.anchor.anchor.x + draft.tail.dx, y: draft.anchor.anchor.y + draft.tail.dy }) : null;
  const popupAt = draftTail ?? draftTip;
  // The canvas's own width, so a note placed at the end of a long leg opens its
  // popup on the inboard side instead of half off the drawing area.
  const areaWidth = canvas?.getBoundingClientRect().width ?? 0;

  return (
    <div
      className="absolute inset-0 z-30"
      style={{ pointerEvents: 'none' }}
      data-testid="shop-callout-layer"
      data-callout-count={resolved.length}
      data-view={viewKey}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          {/* One marker, reused. Drawn as a path rather than a <marker> so the
              head size stays constant in SCREEN pixels at any zoom — a head
              that scaled with the drawing would vanish when zoomed out. */}
        </defs>
        {resolved.map((c) => {
          if (c.anchorStatus === 'orphaned' || !c.tip) return null;
          const tip = toScreen(c.tip);
          const tail = toScreen({ x: c.tip.x + c.tail.dx, y: c.tip.y + c.tail.dy });
          if (!tip || !tail) return null;
          return (
            <CalloutArrow
              key={c.id}
              number={c.number}
              tip={tip}
              tail={tail}
              selected={selectedId === c.id}
            />
          );
        })}
        {draft && draftTip && draftTail && (
          <CalloutArrow number={draft.id ? 0 : resolved.length + 1} tip={draftTip} tail={draftTail} selected />
        )}
      </svg>

      {/* The clickable handles, as real buttons so they are keyboard-reachable
          and screen-reader-nameable. Separate from the SVG above because an
          SVG element cannot be a <button>. */}
      {resolved.map((c) => {
        if (c.anchorStatus === 'orphaned' || !c.tip) return null;
        const tip = toScreen(c.tip);
        const tail = toScreen({ x: c.tip.x + c.tail.dx, y: c.tip.y + c.tail.dy });
        if (!tip || !tail) return null;
        return (
          <div key={c.id}>
            <button
              type="button"
              aria-label={`Shop note ${c.number}: ${c.note}`}
              data-testid="shop-callout-badge"
              data-callout-number={c.number}
              onClick={() => openExisting(c)}
              onPointerDown={startDrag(c.id, 'tail')}
              className="absolute rounded-full font-bold flex items-center justify-center"
              style={{
                pointerEvents: 'auto',
                left: tail.x - BADGE_R_PX,
                top: tail.y - BADGE_R_PX,
                width: BADGE_R_PX * 2,
                height: BADGE_R_PX * 2,
                background: CALLOUT_COLORS.arrow,
                color: CALLOUT_COLORS.badgeText,
                border: `2px solid ${CALLOUT_COLORS.arrowHalo}`,
                fontSize: 12,
                cursor: 'grab',
              }}
            >
              {c.number}
            </button>
            <button
              type="button"
              aria-label={`Move the arrow tip of shop note ${c.number}`}
              onPointerDown={startDrag(c.id, 'tip')}
              className="absolute rounded-full"
              style={{
                pointerEvents: 'auto',
                left: tip.x - HANDLE_R_PX,
                top: tip.y - HANDLE_R_PX,
                width: HANDLE_R_PX * 2,
                height: HANDLE_R_PX * 2,
                background: 'transparent',
                cursor: 'grab',
              }}
            />
          </div>
        );
      })}

      {/* "ADD SHOP NOTE" — the armed-placement fallback, and the orphan notice. */}
      <div className="absolute flex flex-col items-end gap-2" style={{ pointerEvents: 'auto', top: 8, right: 8 }}>
        <button
          type="button"
          data-testid="add-shop-note"
          aria-pressed={arming}
          onClick={() => {
            setArming((a) => !a);
            setToast(null);
          }}
          className="rounded px-3 py-2 font-semibold text-white"
          style={{ background: arming ? CALLOUT_COLORS.selected : CALLOUT_COLORS.arrow, fontSize: 12 }}
        >
          {arming ? 'Click the profile to place · Esc' : 'Add Shop Note'}
        </button>
        {unreadable && (
          <span
            role="alert"
            data-testid="shop-callout-unreadable"
            className="rounded px-2 py-1 text-white"
            style={{ background: CALLOUT_COLORS.arrow, fontSize: 11, maxWidth: 280 }}
          >
            {CALLOUTS_UNREADABLE_MESSAGE}
          </span>
        )}
        {resolved.length > 0 && (
          <span
            data-testid="shop-callout-count"
            className="rounded px-2 py-1 text-white"
            style={{ background: 'rgba(0,0,0,0.7)', fontSize: 11 }}
          >
            {resolved.length} shop note{resolved.length === 1 ? '' : 's'} on this drawing
          </span>
        )}
      </div>

      {/* ORPHANS. The note is kept, listed with its text, and says what to do.
          It is never deleted because somebody moved a leg. */}
      {orphanCount > 0 && (
        <div
          className="absolute rounded p-2 flex flex-col gap-1"
          data-testid="shop-callout-orphans"
          style={{ pointerEvents: 'auto', bottom: 8, right: 8, maxWidth: 320, background: 'rgba(0,0,0,0.78)' }}
        >
          <strong className="text-white" style={{ fontSize: 11 }}>
            Anchor changed — re-place
          </strong>
          {resolved
            .filter((c) => c.anchorStatus === 'orphaned')
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openExisting(c)}
                className="text-left text-white"
                style={{ fontSize: 11, textDecoration: 'underline' }}
              >
                {c.number}. {c.note}
              </button>
            ))}
        </div>
      )}

      {toast && (
        <div
          role="status"
          data-testid="shop-callout-toast"
          className="absolute left-1/2 rounded px-3 py-2 text-white"
          style={{ pointerEvents: 'none', bottom: 16, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.82)', fontSize: 12 }}
        >
          {toast}
        </div>
      )}

      {draft && popupAt && (
        <CalloutPopup
          draft={draft}
          at={popupAt}
          areaWidth={areaWidth}
          onChange={(text) => setDraft({ ...draft, text, error: null })}
          onSave={save}
          onCancel={() => setDraft(null)}
          onDelete={remove}
          onConfirmDelete={(confirming) => setDraft({ ...draft, confirmingDelete: confirming })}
          textareaRef={textareaRef}
        />
      )}
    </div>
  );
}

/**
 * Keeps the pointerdown that places an armed note from also starting a new
 * segment on the canvas.
 *
 * stopPropagation ONLY. React 18 listens at the root container, so stopping
 * propagation in a capture-phase listener on the canvas keeps the event from
 * ever reaching `handlePointerDown`. `preventDefault` is deliberately NOT
 * called: on a pointerdown it suppresses the synthesised mouse events, and the
 * `click` this arming flow is waiting for is one of the things that depends on
 * them.
 */
function swallow(e: Event) {
  e.stopPropagation();
}

/**
 * ONE ARROW. Tip on the metal, tail where the note sits.
 *
 * The head is drawn in SCREEN pixels so it stays legible at every zoom, and it
 * carries a white halo underneath because a crimson arrow laid over a crimson
 * painted-side stripe would otherwise disappear.
 */
function CalloutArrow({
  number,
  tip,
  tail,
  selected,
}: {
  number: number;
  tip: CalloutPoint;
  tail: CalloutPoint;
  selected: boolean;
}) {
  const dx = tip.x - tail.x;
  const dy = tip.y - tail.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = tip.x - ux * ARROW_HEAD_PX;
  const baseY = tip.y - uy * ARROW_HEAD_PX;
  const half = ARROW_HEAD_PX * 0.42;
  const head = `${tip.x},${tip.y} ${baseX - uy * half},${baseY + ux * half} ${baseX + uy * half},${baseY - ux * half}`;
  const stroke = selected ? CALLOUT_COLORS.selected : CALLOUT_COLORS.arrow;
  return (
    <g data-callout-arrow={number}>
      <line x1={tail.x} y1={tail.y} x2={baseX} y2={baseY} stroke={CALLOUT_COLORS.arrowHalo} strokeWidth={5} strokeLinecap="round" />
      <line x1={tail.x} y1={tail.y} x2={baseX} y2={baseY} stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
      <polygon points={head} fill={stroke} stroke={CALLOUT_COLORS.arrowHalo} strokeWidth={1} />
    </g>
  );
}

/**
 * THE POP-UP. Anchored near the TAIL, which is by construction on the emptier
 * side of the profile, so it does not cover the drawing it is describing.
 *
 * Ctrl+Enter saves, Esc cancels (handled by the layer so it also disarms),
 * Delete needs a second press INSIDE the popup — never `window.confirm()`,
 * which on this page would also block the canvas.
 */
function CalloutPopup({
  draft,
  at,
  areaWidth,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onConfirmDelete,
  textareaRef,
}: {
  draft: Draft;
  at: CalloutPoint;
  areaWidth: number;
  onChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onConfirmDelete: (confirming: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const remaining = NOTE_MAX_CHARS - draft.text.trim().length;
  const over = remaining < 0;
  // Right of the tail normally; flipped to the left when there is not room, so
  // the popup never hangs off the edge of the drawing area.
  const fitsRight = areaWidth === 0 || at.x + 18 + POPUP_WIDTH_PX <= areaWidth - 8;
  const left = fitsRight ? at.x + 18 : Math.max(8, at.x - 18 - POPUP_WIDTH_PX);
  return (
    <div
      data-testid="shop-callout-popup"
      className="absolute rounded-lg p-3 flex flex-col gap-2"
      style={{
        pointerEvents: 'auto',
        left,
        top: Math.max(8, at.y - 20),
        width: POPUP_WIDTH_PX,
        background: '#14181E',
        border: `2px solid ${CALLOUT_COLORS.arrow}`,
        color: '#FFFFFF',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSave();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <strong style={{ fontSize: 11, letterSpacing: '0.06em' }}>{SHOP_NOTE_LABEL}</strong>
        <span style={{ fontSize: 11, color: over ? '#FFB9B9' : '#C8D0E0' }} data-testid="shop-callout-counter">
          {remaining} left
        </span>
      </div>
      <textarea
        ref={textareaRef}
        data-testid="shop-callout-textarea"
        value={draft.text}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        // No `maxLength`: a hard cap silently swallows a paste, and Steve would
        // not know the end of his sentence was gone. The counter goes negative
        // and the save is refused with the real number instead.
        placeholder="What should the operator know?"
        aria-label="Shop note"
        className="w-full rounded p-2"
        style={{ background: '#242A34', color: '#FFFFFF', border: '1px solid #9AA0B8', fontSize: 13 }}
      />
      {draft.error && (
        <p data-testid="shop-callout-error" style={{ fontSize: 12, color: '#FFB9B9' }}>
          {draft.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="shop-callout-save"
          onClick={onSave}
          disabled={draft.saving}
          className="rounded px-3 py-2 font-semibold"
          style={{ background: CALLOUT_COLORS.arrow, color: '#FFFFFF', fontSize: 12 }}
        >
          {draft.saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          data-testid="shop-callout-cancel"
          onClick={onCancel}
          className="rounded px-3 py-2"
          style={{ background: '#2E3440', color: '#FFFFFF', fontSize: 12 }}
        >
          Cancel
        </button>
        {draft.id &&
          (draft.confirmingDelete ? (
            <span className="flex items-center gap-2 ml-auto">
              <span style={{ fontSize: 11 }}>Delete it?</span>
              <button
                type="button"
                data-testid="shop-callout-delete-confirm"
                onClick={onDelete}
                className="rounded px-2 py-1 font-semibold"
                style={{ background: CALLOUT_COLORS.arrow, color: '#FFFFFF', fontSize: 11 }}
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => onConfirmDelete(false)}
                className="rounded px-2 py-1"
                style={{ background: '#2E3440', color: '#FFFFFF', fontSize: 11 }}
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-testid="shop-callout-delete"
              onClick={() => onConfirmDelete(true)}
              className="rounded px-3 py-2 ml-auto"
              style={{ background: 'transparent', color: '#FFB9B9', fontSize: 12, textDecoration: 'underline' }}
            >
              Delete
            </button>
          ))}
      </div>
      <p style={{ fontSize: 11, color: '#C8D0E0' }}>
        Ctrl+Enter saves · Esc cancels · the shop sees this in red before they run the job
      </p>
    </div>
  );
}
