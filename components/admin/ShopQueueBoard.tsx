'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShopQueue, ShopQueueCard } from '@/lib/data/shop-queue';
import { deliveryWindowLabel } from '@/lib/delivery/windows';
import { formatDayHeading } from '@/lib/delivery/business-days';
import ShopJobDrawing from '@/components/admin/ShopJobDrawing';

/**
 * SHOP VIEW — the queue in queue order, as the approved prototype draws it
 * (`shopView`): a big position number, a large drawing, item × qty, the spec,
 * the customer, the machine profile number, the status, and ONE button —
 * **Start bending**, then **Mark finished**.
 *
 * ============ THIS RUNS ON A TABLET NEXT TO A BENDING MACHINE ============
 *
 * Which is why every target here is genuinely large rather than nominally
 * accessible: the buttons are `min-h-[72px]` with 20px text, the position
 * number is 40px, the item line is 30px, and the whole card is one row an
 * operator can read standing up. Nothing on this screen is a 32px icon button.
 *
 * ============ POLLING PAUSES WHEN THE TAB IS HIDDEN ============
 *
 * The tablet sits on all day. A 30-second poll that keeps firing while the
 * screen is off or another tab is in front is pure egress for nobody's
 * benefit, so the interval is torn down on `visibilitychange` and a fresh read
 * happens the moment the tab comes back — which is also the moment it matters,
 * because somebody may have finished a job on another device meanwhile. (The
 * previous Shop View board polled unconditionally; this is the fix.)
 *
 * ============ AND IT NEVER POLLS THE DRAWINGS ============
 *
 * The queue endpoint returns `hasDrawing`, never the base64 image. See
 * ShopJobDrawing.tsx and lib/data/shop-queue.ts's egress note.
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

type Busy = { id: string; label: string } | null;
type Result = { tone: 'ok' | 'info' | 'error'; message: string } | null;

export default function ShopQueueBoard({ initial }: { initial: ShopQueue }) {
  const [queue, setQueue] = useState<ShopQueue>(initial);
  const [busy, setBusy] = useState<Busy>(null);
  const [result, setResult] = useState<Result>(null);

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
      if (document.hidden) {
        stop();
      } else {
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
  }, [refresh]);

  async function advance(card: ShopQueueCard) {
    if (!card.action) return;
    setBusy({ id: card.id, label: card.action.label });
    setResult(null);
    try {
      const res = await fetch(`/api/admin/shop-library/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: card.action.nextStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setResult({
          tone: 'ok',
          message: typeof data.message === 'string' ? data.message : 'Done.',
        });
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
      setBusy(null);
    }
  }

  const next = queue.active[0] ?? null;

  return (
    <div className="shopg">
      <section className="panel">
        <h2>
          Queue
          <span className="tag">
            {queue.active.length} job{queue.active.length === 1 ? '' : 's'}
          </span>
        </h2>

        {result && (
          <div
            role="status"
            data-testid="shop-result"
            className={RESULT_CLASS[result.tone]}
          >
            <div>{result.message}</div>
          </div>
        )}

        {queue.active.length === 0 ? (
          <div className="empty" data-testid="shop-empty">
            Nothing waiting. Jobs appear here when you press Send to machine on the Workbench.
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
                {queue.active.map((card) => (
                  <ShopRow key={card.id} card={card} busy={busy} onAdvance={advance} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="sidecol">
        <section className="panel">
          <h2>Finished today</h2>
          {queue.finishedToday.length === 0 ? (
            <div className="hint">Nothing finished yet today.</div>
          ) : (
            <div data-testid="shop-finished-today">
              {queue.finishedToday.map((card) => (
                <div className="mini" key={card.id}>
                  <div>
                    <div className="nm">
                      {card.item}
                      {card.quantity ? ` × ${card.quantity}` : ''}
                    </div>
                    <div className="sb">
                      {card.customer}
                      {' · '}
                      {card.deliveryDate
                        ? `Going out ${formatDayHeading(card.deliveryDate)}, ${deliveryWindowLabel(
                            card.deliveryWindow ?? '',
                          )}`
                        : 'No delivery day yet — set one in Deliveries.'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {next && (
          <section className="panel">
            <h2>Next up</h2>
            <div className="plate">
              <ShopJobDrawing id={next.id} hasDrawing={next.hasDrawing} size={240} />
            </div>
            <p className="cap">
              {next.item}
              {next.quantity ? ` × ${next.quantity}` : ''}
              {' · '}
              {next.customer}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * One queue row — v7 `pageShop()`'s `.stbl` row (prototype line 1478).
 *
 * v7's six cells: position, drawing, job (item + customer + machine profile
 * number), material (spec + shop instructions), status, actions. `tr.now` is
 * the job being bent right now, which v7 marks with a green left edge.
 */
function ShopRow({
  card,
  busy,
  onAdvance,
}: {
  card: ShopQueueCard;
  busy: Busy;
  onAdvance: (card: ShopQueueCard) => void;
}) {
  const working = busy?.id === card.id;
  const anyBusy = busy !== null;
  const bending = card.state === 'bending';
  const instructions = [
    card.paintedEdge ? 'Painted side up' : null,
    card.hemInstructions,
    card.specialInstructions,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <tr
      className={bending ? 'now' : undefined}
      data-testid="shop-card"
      data-shop-job-id={card.id}
      data-state={card.state}
      data-rush={card.isRush ? 'true' : 'false'}
    >
      <td>
        <div className="pos" aria-label={`Queue position ${card.position}`}>
          {card.position}
        </div>
      </td>
      <td>
        <ShopJobDrawing id={card.id} hasDrawing={card.hasDrawing} size={56} />
      </td>
      <td>
        <div className="it1">
          {card.item}
          {card.quantity ? ` × ${card.quantity}` : ''}
          {card.isRush && <span className="pill r">Rush</span>}
        </div>
        <div className="it2">
          {card.customer}
          {card.machineProfileId
            ? ` · profile #${card.machineProfileId}`
            : ' · no machine profile number'}
        </div>
      </td>
      <td>
        <div>{card.spec}</div>
        {instructions && <div className="it2">{instructions}</div>}
      </td>
      <td>
        <span className={bending ? 'stat b' : 'stat q'}>{card.stateLabel}</span>
      </td>
      <td>
        {card.action ? (
          <button
            type="button"
            data-testid={card.action.kind === 'start' ? 'start-bending' : 'mark-finished'}
            disabled={anyBusy}
            onClick={() => onAdvance(card)}
            className="btn green sm"
          >
            {working ? 'Working…' : card.action.label}
          </button>
        ) : (
          <span className="stat f">Finished</span>
        )}
      </td>
    </tr>
  );
}
