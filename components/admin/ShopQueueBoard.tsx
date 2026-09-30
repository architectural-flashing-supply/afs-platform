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

  return (
    <div className="flex flex-col gap-4">
      {result && (
        <p
          role="status"
          data-testid="shop-result"
          className={`font-body text-[19px] rounded-lg p-4 ${
            result.tone === 'error'
              ? 'bg-afs-bg-card text-afs-crimson border border-afs-line-strong'
              : result.tone === 'info'
                ? 'bg-afs-amber-bg text-afs-amber-ink'
                : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {result.message}
        </p>
      )}

      {queue.active.length === 0 ? (
        <div
          data-testid="shop-empty"
          className="bg-afs-bg-card border border-afs-border-light rounded-xl p-10 text-center"
        >
          <p className="font-body text-2xl text-afs-ink-900">The machine queue is empty.</p>
          <p className="font-body text-[17px] text-afs-ink-700 mt-2">
            Jobs appear here as soon as an approved one is sent to the machine.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4 list-none m-0 p-0" data-testid="shop-queue">
          {queue.active.map((card) => (
            <li key={card.id}>
              <ShopCard card={card} busy={busy} onAdvance={advance} />
            </li>
          ))}
        </ul>
      )}

      {queue.finishedToday.length > 0 && (
        <section className="mt-2">
          <h2 className="font-heading text-2xl text-afs-ink-900 mb-2">Finished today</h2>
          <ul className="flex flex-col gap-2 list-none m-0 p-0" data-testid="shop-finished-today">
            {queue.finishedToday.map((card) => (
              <li
                key={card.id}
                className="bg-afs-bg-card border border-afs-border-light rounded-lg p-4 flex flex-wrap items-baseline gap-x-4 gap-y-1"
              >
                <span className="font-label text-[19px] font-bold text-afs-green-ink">✓ Finished</span>
                <span className="font-body text-[19px] text-afs-ink-900">
                  {card.item}
                  {card.quantity ? ` × ${card.quantity}` : ''}
                </span>
                <span className="font-body text-[17px] text-afs-ink-700">{card.customer}</span>
                <span className="font-body text-[17px] text-afs-ink-700">
                  {card.deliveryDate
                    ? `Going out ${formatDayHeading(card.deliveryDate)}, ${deliveryWindowLabel(
                        card.deliveryWindow ?? ''
                      )}`
                    : 'No delivery day yet — set one in Deliveries.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShopCard({
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

  return (
    <article
      data-testid="shop-card"
      data-shop-job-id={card.id}
      data-state={card.state}
      data-rush={card.isRush ? 'true' : 'false'}
      className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-wrap lg:flex-nowrap items-center gap-5"
    >
      <div
        aria-label={`Queue position ${card.position}`}
        className="shrink-0 w-16 h-16 rounded-full bg-afs-bg-lane border border-afs-line-strong flex items-center justify-center font-data text-[40px] leading-none text-afs-ink-900"
      >
        {card.position}
      </div>

      <ShopJobDrawing id={card.id} hasDrawing={card.hasDrawing} size={112} />

      <div className="flex-1 min-w-[260px] flex flex-col gap-1">
        <h2 className="font-heading text-[30px] leading-tight text-afs-ink-900 m-0">
          {card.item}
          {card.quantity ? ` × ${card.quantity}` : ''}
          {card.isRush && (
            <span className="ml-3 align-middle font-label text-[15px] font-bold uppercase tracking-wide bg-afs-amber-bg text-afs-amber-ink rounded px-2 py-1">
              Rush
            </span>
          )}
        </h2>
        <p className="font-body text-[19px] text-afs-ink-900 m-0">{card.spec}</p>
        <p className="font-body text-[17px] text-afs-ink-700 m-0">
          {card.customer}
          {card.machineProfileId ? ` · Machine profile #${card.machineProfileId}` : ' · No machine profile number'}
          {` · ${card.stateLabel}`}
        </p>
        {(card.hemInstructions || card.paintedEdge || card.specialInstructions) && (
          <p className="font-body text-[17px] text-afs-ink-900 bg-afs-bg-light-raised rounded-lg px-3 py-2 m-0">
            {[
              card.paintedEdge ? 'Painted side up' : null,
              card.hemInstructions,
              card.specialInstructions,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {card.action ? (
        <button
          type="button"
          data-testid={card.action.kind === 'start' ? 'start-bending' : 'mark-finished'}
          disabled={anyBusy}
          onClick={() => onAdvance(card)}
          className={`shrink-0 w-full lg:w-auto min-h-[72px] px-8 rounded-lg font-label text-[20px] font-bold disabled:opacity-60 disabled:cursor-not-allowed ${
            card.action.kind === 'start'
              ? 'bg-afs-crimson text-afs-chrome-high hover:brightness-95'
              : 'bg-afs-green-deep text-afs-chrome-high hover:brightness-95'
          }`}
        >
          {working ? 'Working…' : card.action.label}
        </button>
      ) : (
        <span className="shrink-0 font-label text-[20px] font-bold text-afs-green-ink px-4">
          ✓ Finished
        </span>
      )}
    </article>
  );
}
