'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ShopJobDrawing from '@/components/admin/ShopJobDrawing';
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

  const onAction = live ? (action: string, id?: string) => { if (id) void advance(id); } : undefined;

  return (
    <div className="shopg" data-hydrated={hydrated ? 'true' : 'false'}>
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
                  <Row key={row.key} row={row} busy={busyId === row.key} onAction={onAction} />
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
}: {
  row: V7ShopRow;
  busy: boolean;
  onAction?: (action: string, id?: string) => void;
}) {
  return (
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
        {row.notePill && <V7PillEl pill={row.notePill} />}
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
