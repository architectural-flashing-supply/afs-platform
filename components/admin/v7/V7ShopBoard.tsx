'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ShopJobDrawing from '@/components/admin/ShopJobDrawing';
import ShopCalloutsPanel from '@/components/admin/ShopCalloutsPanel';
import { CALLOUTS_UNREADABLE_MESSAGE, shopCalloutBanner } from '@/lib/shop-callouts/types';
import V7Drawing from '@/components/admin/v7/V7Drawing';
import { V7Btn, V7PillEl, V7Spec } from '@/components/admin/v7/V7Primitives';
import { liveShopView } from '@/lib/data/v7-view/shop';
import type { ShopQueue, ShopQueueCard } from '@/lib/data/shop-queue';
import type { V7ShopFinishedRow, V7ShopRow, V7ShopView } from '@/lib/data/v7-view/types';

/**
 * SHOP VIEW — a transliteration of v7's `pageShop()` (prototype line 1476).
 *
 * ============ THIS RUNS ON A TABLET NEXT TO A BENDING MACHINE ============
 *
 * v7's `.stbl` row is already sized for that: a 40px position number, a large
 * drawing, and buttons an operator can hit standing up. The previous build had
 * the same six cells and the same class names and still did not look like v7,
 * and the whole-screen gate is what said so:
 *
 *   - the material cell was missing the colour chip and the painted-side mark;
 *   - the status cell was missing v7's note-count pill;
 *   - the action cell had one button where v7 has two (the second is "View",
 *     which opens the job without starting it — an operator needs to look at a
 *     job without claiming it);
 *   - "Finished today" had no thumbnail at all, where v7 gives every row one.
 *
 * ============ POLLING PAUSES WHEN THE TAB IS HIDDEN ============
 *
 * Carried over unchanged — it was correct. The tablet sits on all day, and a
 * 30-second poll that keeps firing while the screen is off is pure egress for
 * nobody. It is torn down on `visibilitychange` and a fresh read happens the
 * moment the tab comes back, which is also the moment it matters.
 *
 * ============ AND IT NEVER POLLS THE DRAWINGS ============
 *
 * CLAUDE.md rule #26. The queue endpoint returns `hasDrawing`, never the base64
 * image, and each card fetches its own once it is on screen. In FIXTURE mode
 * there is no endpoint and no base64 — the view carries v7's sample geometry
 * and `V7Drawing` renders it inline. Those are different code paths on purpose;
 * see lib/data/v7-view/shop.ts.
 */
const POLL_INTERVAL_MS = 30_000;

/**
 * v7's `.pstrip` notice, per tone. A map to the WHOLE className rather than a
 * template, because the contrast gate expands class maps but counts a runtime
 * template as `unresolved` — see CLAUDE.md rule #28.
 */
const RESULT_CLASS: Record<'ok' | 'info' | 'error', string> = {
  ok: 'pstrip green',
  info: 'pstrip amber',
  error: 'pstrip red',
};

type Result = { tone: 'ok' | 'info' | 'error'; message: string } | null;

/**
 * SHOP CALLOUTS ON THIS BOARD — THE BANNER, THE PILL AND THE PANEL.
 *
 * v7 already designs all three. Its `pageShop()` row carries
 * `<span class="pill a">N notes</span>` beside the status (prototype line
 * 1482) and its operator screen carries `notesBox(j, 'Notes from Steve')`
 * (line 1513). The live board had the pill slot wired to `null` because there
 * was nothing real to count. There is now: `shop_callouts` (migration 051).
 *
 * TWO DELIBERATE DIVERGENCES FROM v7, BOTH ON REID'S EXPLICIT INSTRUCTION in
 * the shop-callouts brief, and both recorded in SPEC_SHOP_CALLOUTS.md:
 *
 *   1. THE NOTE TEXT IS RED AND BOLD. v7's `.nt` is ordinary ink. Reid asked
 *      for red, large enough to read at arm's length; `afs-crimson` is the
 *      token that satisfies it and clears WCAG AA on both Shop View surfaces.
 *   2. THE ARROWS. v7's notes are text only. An arrow pointing at the part of
 *      the profile a note is about does not exist in the prototype.
 *
 * Neither affects the pixel gate (CLAUDE.md rule #34): the gate renders
 * `?fixture=v7`, fixture mode substitutes DATA ONLY, and v7's sample notes are
 * not `shop_callouts` rows — so `calloutCount` is 0 on that path, the banner
 * is absent at zero by design, and the panel is closed. The measured screen is
 * byte-for-byte the screen the gate measured before.
 */
export default function V7ShopBoard({
  initial,
  view: fixtureView,
}: {
  /** The live queue. Absent in fixture mode, where `view` is supplied instead. */
  initial?: ShopQueue;
  /** A prebuilt view. Supplying it turns off polling and every live action. */
  view?: V7ShopView;
}) {
  const [queue, setQueue] = useState<ShopQueue | null>(initial ?? null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const live = !fixtureView;

  /**
   * MARKS THE BOARD AS INTERACTIVE, because until React has hydrated, pressing
   * Start bending does nothing at all — the markup is there, the handler is
   * not. That is inherent to a server-rendered page and not specific to this
   * component, but on THIS screen it matters twice over: an operator standing
   * at the machine presses a large button and expects something, and
   * tests/e2e/shop-deliveries.spec.ts was clicking into that window and seeing
   * its click swallowed.
   *
   * `data-hydrated` is what the test waits for. It is not a test-only hook —
   * it is the honest statement of a state the screen really has.
   */
  /**
   * WHICH JOB'S SHOP NOTES ARE OPEN. One at a time: an operator is running one
   * job, and a board of expanded note panels is a board nobody reads.
   *
   * Opened by default for nothing — but see the pill, which says how many are
   * waiting on every row that has any, so opening is a decision and not a
   * discovery.
   */
  const [openNotesFor, setOpenNotesFor] = useState<string | null>(null);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shop-queue', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as ShopQueue;
      if (Array.isArray(data.active)) setQueue(data);
    } catch {
      // A missed poll just means the next one retries. Never surfaced — an
      // operator does not need to hear about a dropped background request.
    }
  }, []);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!live) return;
    const start = () => {
      if (timer.current !== null) return;
      timer.current = setInterval(refresh, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer.current === null) return;
      clearInterval(timer.current);
      timer.current = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void refresh();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [refresh, live]);

  /** Start bending / Mark finished. The route and its body are unchanged. */
  const advance = useCallback(
    async (id: string) => {
      const card = queue?.active.find((c: ShopQueueCard) => c.id === id);
      if (!card?.action) return;
      setBusyId(id);
      // SAY SOMETHING IMMEDIATELY. Advancing a job is a real round trip — it
      // writes the shop row, auto-schedules the delivery on the next business
      // day (rule #24) and notifies the customer (rule #25) — and it has been
      // measured at around three seconds. An operator standing at the machine
      // pressed a button and the screen said nothing for three seconds, which
      // is how a button gets pressed twice. Now the strip appears at once and
      // its text is replaced by the result.
      setResult({ tone: 'info', message: card.action.label === 'Start bending' ? 'Starting…' : 'Finishing…' });
      try {
        const res = await fetch(`/api/admin/shop-library/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: card.action.nextStatus }),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (res.ok && data.ok === true) {
          setResult({ tone: 'ok', message: typeof data.message === 'string' ? data.message : 'Done.' });
          await refresh();
        } else {
          setResult({
            tone: 'error',
            message: typeof data.error === 'string' ? data.error : 'That did not go through.',
          });
        }
      } catch {
        setResult({ tone: 'error', message: 'The connection dropped, so nothing was changed.' });
      } finally {
        setBusyId(null);
      }
    },
    [queue, refresh],
  );

  const view = fixtureView ?? (queue ? liveShopView(queue) : null);
  if (!view) return null;

  // EVERY SHOP NOTE WAITING ON THIS BOARD, counted across the queue. The
  // banner is absent at zero (shopCalloutBanner returns null), which is what
  // keeps this invisible on a board with no notes and in fixture mode.
  const totalCallouts = view.rows.reduce((sum, r) => sum + r.calloutCount, 0);
  const boardBanner = shopCalloutBanner(totalCallouts);

  const onAction = live ? (action: string, id?: string) => { if (id) void advance(id); } : undefined;

  return (
    <div className="shopg" data-hydrated={hydrated ? 'true' : 'false'}>
      {/* THE NOTES COULD NOT BE READ. Said out loud, because the alternative
          is a board that looks exactly like a board with no notes on it. */}
      {view.calloutsUnreadable && (
        <div
          role="alert"
          data-testid="shop-board-callouts-unreadable"
          className="rounded border-2 border-afs-crimson bg-afs-bg-card px-3 py-2"
          style={{ gridColumn: '1 / -1' }}
        >
          <strong className="font-body text-base font-bold text-afs-crimson">
            {CALLOUTS_UNREADABLE_MESSAGE}
          </strong>
        </div>
      )}

      {boardBanner && (
        <div
          role="alert"
          data-testid="shop-board-callout-banner"
          className="rounded border-2 border-afs-crimson bg-afs-bg-card px-3 py-2"
          style={{ gridColumn: '1 / -1' }}
        >
          <strong className="font-body text-base font-bold text-afs-crimson">{boardBanner}</strong>
        </div>
      )}

      <section className="panel">
        {/* The `{' '}` is not noise: v7 emits `Queue <span class="tag">`, and JSX
            drops whitespace that contains a newline, so without it the tag butts
            straight against the word. The structure gate read "Queue2 jobs". */}
        <h2>
          Queue{' '}
          <span className="tag">
            {view.rows.length} job{view.rows.length === 1 ? '' : 's'}
          </span>
        </h2>

        {result && (
          <div role="status" data-testid="shop-result" className={RESULT_CLASS[result.tone]}>
            <div>{result.message}</div>
          </div>
        )}

        {view.rows.length === 0 ? (
          <div className="empty" data-testid="shop-empty">
            {view.emptyText}
          </div>
        ) : (
          <div className="tw">
            <table className="stbl" data-testid="shop-queue">
              <thead>
                <tr>
                  <th />
                  <th />
                  <th>Job</th>
                  <th>Material</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <Row
                    key={row.key}
                    row={row}
                    busy={busyId === row.key}
                    onAction={onAction}
                    notesOpen={openNotesFor === row.key}
                    onToggleNotes={
                      // Only the LIVE board can open a panel: the fixture's
                      // counts are zero by construction, and the endpoint it
                      // would fetch from does not serve fixture data.
                      live && row.calloutCount > 0
                        ? () => setOpenNotesFor((current) => (current === row.key ? null : row.key))
                        : undefined
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="sidecol">
        <section className="panel">
          <h2>Finished today</h2>
          {view.finishedToday.length === 0 ? (
            <div className="hint">Nothing finished yet today.</div>
          ) : (
            <div data-testid="shop-finished-today">
              {view.finishedToday.map((f) => (
                <Mini key={f.key} row={f} />
              ))}
            </div>
          )}
        </section>

        {view.nextUp && (
          <section className="panel">
            <h2>Next up</h2>
            <div className="plate">
              {view.nextUp.drawing ? (
                <V7Drawing
                  kind={view.nextUp.drawing.kind}
                  d={view.nextUp.drawing.d}
                  options={{
                    w: 460,
                    h: 290,
                    dims: true,
                    paint: view.nextUp.drawing.paint,
                    hi: view.nextUp.drawing.hi,
                  }}
                />
              ) : (
                <ShopJobDrawing id={view.nextUp.key} hasDrawing={view.nextUp.hasLazyDrawing} size={240} />
              )}
            </div>
            <p className="cap">{view.nextUp.caption}</p>
          </section>
        )}
      </div>
    </div>
  );
}

/** v7's `.stbl` row — six cells, in v7's order. */
function Row({
  row,
  busy,
  onAction,
  notesOpen,
  onToggleNotes,
}: {
  row: V7ShopRow;
  busy: boolean;
  onAction?: (action: string, id?: string) => void;
  notesOpen: boolean;
  /** Absent when this row has no notes, or on the fixture board. */
  onToggleNotes?: () => void;
}) {
  return (
    <>
    <tr
      className={row.bending ? 'now' : undefined}
      data-testid="shop-card"
      data-shop-job-id={row.key}
      // `data-state` is read by tests/e2e/shop-deliveries.spec.ts to follow a
      // job through Start bending -> Mark finished. It was dropped on the first
      // pass of this component and the suite caught it.
      data-state={row.state}
      data-rush={row.isRush ? 'true' : 'false'}
    >
      <td>
        <div className="pos" aria-label={`Queue position ${row.position}`}>
          {row.position}
        </div>
      </td>
      <td>
        <ThumbCell row={row} />
      </td>
      <td>
        <div className="it1">
          {row.itemLine}
          {row.isRush && <span className="pill r">Rush</span>}
        </div>
        <div className="it2">{row.customerLine}</div>
      </td>
      <td>
        <div>
          <V7Spec spec={row.spec} />
        </div>
        <div className="it2">
          {row.bends}
          {row.bends && row.paint ? ' · ' : ''}
          {row.paint && (
            <span className="paint">
              <i />
              Painted {row.paint}
            </span>
          )}
        </div>
      </td>
      <td>
        <span className={row.bending ? 'stat b' : 'stat q'}>{row.stateLabel}</span>
        {/* v7's own note pill. On the live board it is a BUTTON, because the
            notes it counts can be opened; on the fixture board it is v7's
            plain span, which is what the pixel gate measures. */}
        {row.notePill &&
          (onToggleNotes ? (
            <button
              type="button"
              data-testid="shop-notes-toggle"
              aria-expanded={notesOpen}
              onClick={onToggleNotes}
              className="pill a"
              title="Notes from Steve"
              style={{ cursor: 'pointer' }}
            >
              {row.notePill.text}
            </button>
          ) : (
            <V7PillEl pill={row.notePill} />
          ))}
      </td>
      <td>
        {row.buttons.length === 0 ? (
          <span className="stat f">Finished</span>
        ) : (
          row.buttons.map((b, i) => (
            <V7Btn
              key={b.label}
              button={busy && i === 0 ? { ...b, label: 'Working…' } : b}
              onAction={onAction}
            />
          ))
        )}
      </td>
    </tr>
    {/* STEVE'S NOTES, UNDER THE JOB THEY ARE ABOUT — the arrows on the profile
        and the text in red, read-only. A second <tr> rather than a modal: an
        operator standing at the machine should be able to see the note and the
        job's own row at the same time. */}
    {notesOpen && (
      <tr data-testid="shop-notes-row">
        <td colSpan={6} style={{ padding: '12px 10px' }}>
          <ShopCalloutsPanel shopJobId={row.key} expectedCount={row.calloutCount} />
        </td>
      </tr>
    )}
    </>
  );
}

function ThumbCell({ row }: { row: V7ShopRow }) {
  if (row.drawing) {
    return (
      <span className="thumb sm">
        <span className="pl">
          <V7Drawing
            kind={row.drawing.kind}
            d={row.drawing.d}
            options={{ w: 100, h: 100, pad: 11, sw: 4.6, hi: row.drawing.hi }}
          />
        </span>
      </span>
    );
  }
  return <ShopJobDrawing id={row.key} hasDrawing={row.hasLazyDrawing} size={56} />;
}

function Mini({ row }: { row: V7ShopFinishedRow }) {
  return (
    <div className="mini">
      {row.drawing ? (
        <span className="thumb sm">
          <span className="pl">
            <V7Drawing
              kind={row.drawing.kind}
              d={row.drawing.d}
              options={{ w: 100, h: 100, pad: 11, sw: 4.6 }}
            />
          </span>
        </span>
      ) : (
        <ShopJobDrawing id={row.key} hasDrawing={row.hasLazyDrawing} size={56} />
      )}
      <div>
        <div className="nm">{row.itemLine}</div>
        <div className="sb">{row.sub}</div>
      </div>
    </div>
  );
}
