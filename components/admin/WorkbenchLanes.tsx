'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SourceIcon from '@/components/admin/SourceIcon';
import type { MetaTone, WorkbenchCard, WorkbenchLane } from '@/lib/data/workbench';

/**
 * The five lanes, as the approved prototype draws them
 * (docs/design/command-center-v2-prototype.html, `workbench()` and `card()`).
 *
 * GUNMETAL HEADER, LIGHT WORKING AREA: everything here is on the light palette
 * (afs-bg-lane, afs-bg-card, afs-ink-900/700). The contrast figures for every
 * pair used below are recorded in tailwind.config.js next to the tokens.
 *
 * POLLING PAUSES WHEN THE TAB IS HIDDEN. A Workbench left open on a shop
 * office monitor would otherwise re-query forever for nobody. The interval is
 * cleared on `visibilitychange` and restarted on return, and one refresh runs
 * immediately on return so a tab that was hidden for an hour is not stale.
 */
const REFRESH_MS = 60_000;

const TONE_CLASS: Record<MetaTone, string> = {
  neutral: 'text-afs-ink-700',
  warn: 'text-afs-amber-ink',
  good: 'text-afs-green-ink',
  bad: 'text-afs-crimson',
};

interface SendResult {
  tone: 'ok' | 'info' | 'error';
  message: string;
}

export default function WorkbenchLanes({ lanes }: { lanes: WorkbenchLane[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<(SendResult & { id: string }) | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => router.refresh(), REFRESH_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  const send = useCallback(
    async (id: string) => {
      setBusyId(id);
      setResult(null);
      try {
        const res = await fetch('/api/admin/command-center/approve-quote-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteRequestId: id }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          alreadySent?: boolean;
          message?: string;
          error?: string;
        };
        if (res.ok && body.ok) {
          setResult({
            id,
            // An already-sent job is not a failure and is not styled as one.
            tone: body.alreadySent ? 'info' : 'ok',
            message: body.message ?? 'Done.',
          });
        } else {
          setResult({ id, tone: 'error', message: body.error ?? 'The send did not go through.' });
        }
      } catch {
        setResult({
          id,
          tone: 'error',
          message: 'The send could not be attempted — the connection dropped. Nothing was sent.',
        });
      } finally {
        setBusyId(null);
        router.refresh();
      }
    },
    [router]
  );

  return (
    <div
      className="grid gap-3.5 overflow-x-auto pb-1.5"
      style={{ gridTemplateColumns: 'repeat(5, minmax(230px, 1fr))' }}
    >
      {lanes.map((lane) => (
        <section
          key={lane.key}
          aria-labelledby={`lane-${lane.key}`}
          className="bg-afs-bg-lane rounded-lg p-3 flex flex-col gap-2.5 min-h-[420px]"
        >
          <div className="flex items-center justify-between pt-0.5 px-1">
            <h2 id={`lane-${lane.key}`} className="font-heading text-xl text-afs-ink-900">
              {lane.name}
            </h2>
            <span
              className={`min-w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center px-2 font-label ${
                lane.key === 'approved' && lane.cards.length
                  ? 'bg-afs-green-deep text-afs-chrome-high'
                  : 'bg-afs-ink-900 text-afs-bg-card'
              }`}
              data-testid={`lane-count-${lane.key}`}
            >
              {lane.cards.length}
            </span>
          </div>
          <p className="font-body text-sm text-afs-ink-700 px-1 pb-1">{lane.sub}</p>

          {lane.cards.length === 0 ? (
            <p className="font-body text-sm text-afs-ink-700 px-1 py-2">Nothing here right now.</p>
          ) : (
            lane.cards.map((card) => (
              <Card
                key={card.id}
                card={card}
                busy={busyId === card.id}
                result={result && result.id === card.id ? result : null}
                onSend={send}
              />
            ))
          )}
        </section>
      ))}
    </div>
  );
}

function Card({
  card,
  busy,
  result,
  onSend,
}: {
  card: WorkbenchCard;
  busy: boolean;
  result: SendResult | null;
  onSend: (id: string) => void;
}) {
  const jobHref = `/admin/command-center/job/${card.id}`;
  return (
    <article
      data-testid="workbench-card"
      data-stage={card.stage}
      data-request-number={card.requestNumber}
      className={`bg-afs-bg-card rounded-lg flex flex-col ${
        card.stage === 'approved' && card.pulse
          ? 'border-2 border-afs-green-deep afs-beacon'
          : 'border border-afs-border-light'
      }`}
    >
      <Link
        href={jobHref}
        className="px-3.5 pt-3 pb-1.5 flex flex-col gap-1.5 rounded-t-lg group focus-visible:outline focus-visible:outline-2"
      >
        <span className="flex gap-2 items-center">
          <span
            className="w-7 h-7 rounded shrink-0 bg-afs-bg-light-raised text-afs-ink-700 flex items-center justify-center"
            title={card.sourceLabel}
          >
            <SourceIcon icon={card.sourceIcon} />
          </span>
          <span className="font-label font-bold text-[15px] leading-tight text-afs-ink-900 group-hover:underline">
            {card.customer}
          </span>
          {card.isRush && (
            <span className="ml-auto font-label text-[11px] font-bold tracking-wide uppercase text-afs-chrome-high bg-afs-crimson rounded-full px-2 py-0.5">
              Rush
            </span>
          )}
        </span>
        <span className="font-body text-[15px] text-afs-ink-900">{card.item}</span>
        <span className={`font-body text-[13px] font-semibold ${TONE_CLASS[card.metaTone]}`}>
          {card.meta}
        </span>
      </Link>

      {result && (
        <p
          role="status"
          data-testid="card-send-result"
          className={`mx-3.5 mb-1.5 rounded p-2 font-body text-[13px] ${
            result.tone === 'error'
              ? 'bg-afs-bg-light-raised text-afs-crimson'
              : result.tone === 'info'
                ? 'bg-afs-amber-bg text-afs-amber-ink'
                : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {result.message}
        </p>
      )}

      {card.action === null ? (
        <div className="h-2" />
      ) : (
        <div className="px-3.5 pb-3.5 pt-1.5">
          {card.action.kind === 'send-to-machine' || card.action.kind === 'retry-send' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSend(card.id)}
              className={`w-full min-h-10 rounded-lg font-label font-bold text-afs-chrome-high disabled:opacity-70 ${
                card.action.kind === 'retry-send'
                  ? 'bg-afs-crimson hover:bg-afs-crimson-hover'
                  : 'bg-afs-green-deep hover:brightness-95'
              }`}
            >
              {busy ? 'Sending…' : card.action.label}
            </button>
          ) : (
            <Link
              href={card.action.kind === 'schedule-delivery' ? '/admin/deliveries' : jobHref}
              className="w-full min-h-10 rounded-lg font-label font-bold flex items-center justify-center bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
            >
              {card.action.label}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
