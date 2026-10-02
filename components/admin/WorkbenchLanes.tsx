'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SourceIcon from '@/components/admin/SourceIcon';
import type { MetaTone, WorkbenchCard, WorkbenchLane } from '@/lib/data/workbench';

/**
 * The five lanes, as prototype v7 draws them (`pageWorkbench()` line 1283,
 * `card()` line 1248, `cardNote()` line 1239).
 *
 * This is a PORT. Every class name here — `.lane`, `.lane-h`, `.lane-t`,
 * `.lc`, `.cards`, `.empty`, `.card`, `.top`, `.body`, `.stretch`, `.item`,
 * `.spec`, `.crow`, `.meta`, `.src`, `.beacon`, `.pill`, `.btn` — comes from
 * docs/design/command-center-v7, and the appearance comes entirely from that
 * prototype's own CSS (app/styles/command-center-v7.generated.css). Nothing
 * here carries a Tailwind colour, size or spacing utility, and nothing should:
 * one would override v7 and fail tests/visual/v7-style-gate.spec.ts.
 *
 * It previously rendered the same information in the old gunmetal-era Tailwind
 * tokens (`bg-afs-bg-lane`, `afs-ink-900`, `afs-green-deep`). That is the
 * "v7's labels on the old look" failure this rebuild exists to correct, so the
 * markup is replaced wholesale while the BEHAVIOUR below is carried over
 * unchanged — it was correct.
 *
 * v7's lane markup is identical for all five lanes except a modifier class
 * (`.lane.new`, `.lane.quoted`, …) that colours each lane's top edge. The
 * modifier happens to be the stage key, so `` `lane ${lane.key}` `` would be
 * the obvious spelling — but see LANE_CLASS below for why it is written out.
 *
 * POLLING PAUSES WHEN THE TAB IS HIDDEN. A Workbench left open on a shop
 * office monitor would otherwise re-query forever for nobody. The interval is
 * cleared on `visibilitychange` and restarted on return, and one refresh runs
 * immediately on return so a tab that was hidden for an hour is not stale.
 */
const REFRESH_MS = 60_000;

/**
 * v7's `.meta` tone modifier. `cardNote()` returns `''`, `'warn'` or `'ok'`;
 * this maps the data module's four tones onto those three, because v7 has no
 * separate "bad" tone — a failed send is amber-urgent on the card and states
 * its own message in the button row.
 *
 * Written as a MAP TO THE WHOLE className, not to a modifier interpolated into
 * a template. The contrast gate expands class maps (`TONES[tone]`) but reports
 * a runtime template as `unresolved`, and CLAUDE.md rule #28 treats a rising
 * unresolved count as the gate going blind. Same reason as LANE_CLASS below.
 */
const META_CLASS: Record<MetaTone, string> = {
  neutral: 'meta',
  warn: 'meta warn',
  good: 'meta ok',
  bad: 'meta warn',
};

/**
 * v7 colours each lane's top edge by a modifier class whose name is the stage
 * key (`.lane.new`, `.lane.quoted`, `.lane.approved`, `.lane.shop`,
 * `.lane.done`). Spelled out rather than built as `` `lane ${lane.key}` ``: the
 * template is a runtime value, which the contrast gate counts as `unresolved`.
 */
const LANE_CLASS: Record<WorkbenchLane['key'], string> = {
  new: 'lane new',
  quoted: 'lane quoted',
  approved: 'lane approved',
  shop: 'lane shop',
  done: 'lane done',
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
    [router],
  );

  return (
    <div className="board">
      <div className="lanes">
        {lanes.map((lane) => (
          // The HEADING carries `id="lane-<key>"` and the section is labelled by
          // it. v7 puts that id on the section instead, but the section is not
          // the thing being named, and a screen reader announcing the region
          // needs the h2's text. It also keeps `#lane-approved` working as the
          // summary chip's scroll target, since the heading is what you want to
          // land on.
          <section key={lane.key} className={LANE_CLASS[lane.key]} aria-labelledby={`lane-${lane.key}`}>
            <div className="lane-h">
              <div className="lane-t">
                <h2 id={`lane-${lane.key}`}>{lane.name}</h2>
                <span className="lc" data-testid={`lane-count-${lane.key}`}>
                  {lane.cards.length}
                </span>
              </div>
              <p>{lane.sub}</p>
            </div>
            <div className="cards">
              {lane.cards.length === 0 ? (
                <div className="empty">Nothing here right now.</div>
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
            </div>
          </section>
        ))}
      </div>
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

  // v7's `.card.appr` — the Approved lane's card is marked, and only an
  // approved card carries the pulsing beacon in its meta row.
  const approved = card.stage === 'approved' && card.pulse;

  return (
    <article
      className={`card${approved ? ' appr' : ''}`}
      data-testid="workbench-card"
      data-stage={card.stage}
      data-request-number={card.requestNumber}
    >
      <div className="top">
        {/* v7 puts the profile drawing here as a `.thumb`. Until the Workbench
            query carries a drawing (it deliberately selects no base64 — see
            lib/data/workbench.ts's egress rule, and CLAUDE.md rule #26), the
            slot holds the arrival-source icon, which is real and already
            fetched. */}
        <span className="thumb" title={card.sourceLabel} aria-hidden="true">
          <SourceIcon icon={card.sourceIcon} />
        </span>
        <div className="body">
          <Link href={jobHref} className="stretch">
            {card.customer}
          </Link>
          <div className="item">{card.itemLine}</div>
          {card.specLine && <div className="spec">{card.specLine}</div>}
        </div>
      </div>

      {card.isRush && (
        <div className="crow">
          <span className="pill r">Rush</span>
        </div>
      )}

      <div className={META_CLASS[card.metaTone]}>
        {approved && <span className="beacon" />}
        <span className="src">{card.sourceLabel}</span>
        <span>{card.meta}</span>
      </div>

      {result && (
        <div
          role="status"
          data-testid="card-send-result"
          className={`pstrip ${result.tone === 'error' ? 'red' : result.tone === 'info' ? 'amber' : 'green'}`}
        >
          <div>{result.message}</div>
        </div>
      )}

      {card.action && (
        <div className="crow">
          {card.action.kind === 'send-to-machine' || card.action.kind === 'retry-send' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSend(card.id)}
              // v7 paints the machine send `green` and a retry `red`. Its light
              // theme resolves BOTH to the one red action colour — see
              // v7.css's `.btn.red,.btn.green{background:var(--red)}` — so the
              // distinction is kept in the markup without inventing a colour.
              className={`btn sm ${card.action.kind === 'retry-send' ? 'red' : 'green'}`}
            >
              {busy ? 'Sending…' : card.action.label}
            </button>
          ) : (
            <Link
              href={card.action.kind === 'schedule-delivery' ? '/admin/deliveries' : jobHref}
              // v7: "Start quote" is the next step (red); "Follow up" and
              // "Schedule delivery" are amber, which its light theme renders as
              // a white button with a charcoal outline.
              className={`btn sm ${card.action.kind === 'start-quote' ? 'red' : 'amber'}`}
            >
              {card.action.label}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
