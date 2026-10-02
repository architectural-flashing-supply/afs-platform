'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { V7Btn, V7PillEl, V7Spec, V7Thumb } from '@/components/admin/v7/V7Primitives';
import type { V7Card, V7Chip, V7Lane, V7RailRow, V7WorkbenchView } from '@/lib/data/v7-view/types';

/**
 * THE WORKBENCH — a transliteration of v7's `pageWorkbench()` (line 1283),
 * `card()` (1248), `inboxRow()` (1262) and `railPanels()` (1271).
 *
 * Element for element, class for class, in v7's order. The previous build had
 * most of these class names but was missing four things that are most of what
 * the screen looks like, and the whole-screen pixel gate is what found them:
 *
 *   1. the profile DRAWING on every card (v7 `thumbJ()`), where the old build
 *      put a small source icon;
 *   2. the profile-state PILL every card carries (v7 `pPill()`) — "Past
 *      profile", "Past profile + change asked", "New profile, needs drawing";
 *   3. the material colour CHIP beside the spec (v7 `chip()`);
 *   4. the THIRD rail panel. v7's rail is inbox, shop, deliveries; the old
 *      build had two.
 *
 * None of those is detectable by comparing computed styles on hand-picked
 * pairs, which is exactly why the gate was replaced.
 *
 * POLLING STILL PAUSES WHEN THE TAB IS HIDDEN. Carried over unchanged from the
 * previous component — it was correct, and a Workbench left open on a shop
 * office monitor would otherwise re-query forever for nobody.
 */
/**
 * A WHOLE-className MAP, NOT A TEMPLATE, AND CLAUDE.md RULE #28 IS WHY.
 *
 * The contrast gate (`scripts/audit/contrast-check.mjs`, which runs as
 * `prebuild`) expands a class map to its values and can therefore measure the
 * colours. A runtime template like `` `pill ${tone}` `` it reports as
 * UNRESOLVED — and rule #28 says a rising unresolved count means the gate got
 * blinder, not that the code got safer. These were templates on the first pass
 * and took the count from 0 to 65 in one build.
 */
const PSTRIP_CLASS: Record<string, string> = {
  green: 'pstrip green',
  amber: 'pstrip amber',
  red: 'pstrip red',
  blue: 'pstrip blue',
};

/** v7 colours an inbox row by message type (`inboxRow()`, line 1262). */
const INBOX_CLASS: Record<string, string> = {
  order: 'rl m order',
  reorder: 'rl m reorder',
  approval: 'rl m approval',
  notice: 'rl m notice',
  skip: 'rl m skip',
  done: 'rl m done',
};

const REFRESH_MS = 60_000;

export default function V7Workbench({
  view,
  /** Fixture mode renders v7's sample data and must not poll a live endpoint. */
  live = true,
}: {
  view: V7WorkbenchView;
  live?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; tone: string; message: string } | null>(null);

  useEffect(() => {
    if (!live) return;
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
      if (document.hidden) stop();
      else {
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
  }, [router, live]);

  /**
   * THE ONE DOOR, unchanged. "Send to machine" POSTs to the same
   * approve-quote-request route it always has — CLAUDE.md rule #14's verified
   * approval is what reaches catalog 20115, and nothing in this rebuild touches
   * that path. In fixture mode there is no real job behind a card, so the
   * handler is not wired at all and the button renders disabled.
   */
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
          setResult({ id, tone: body.alreadySent ? 'amber' : 'green', message: body.message ?? 'Done.' });
        } else {
          setResult({ id, tone: 'red', message: body.error ?? 'The send did not go through.' });
        }
      } catch {
        setResult({
          id,
          tone: 'red',
          message: 'The send could not be attempted — the connection dropped. Nothing was sent.',
        });
      } finally {
        setBusyId(null);
        router.refresh();
      }
    },
    [router],
  );

  const onAction = live
    ? (action: string, id?: string) => {
        if (action === 'machine' && id) void send(id);
      }
    : undefined;

  return (
    <>
      <div className="greet">
        {/* v7 titles this screen "Workbench" — it is the nav item's own label,
            so the page says what you clicked. The greeting is still computed and
            is carried as the heading's title attribute. */}
        <h1 className="t" title={view.greeting}>
          Workbench
        </h1>
        <div className="chips">
          {view.chips.map((c) => (
            <Chip key={c.text} chip={c} />
          ))}
        </div>
      </div>

      <div className="wb2">
        <div className="board">
          <div className="lanes">
            {view.lanes.map((lane) => (
              <LaneEl key={lane.key} lane={lane} busyId={busyId} result={result} onAction={onAction} />
            ))}
          </div>
        </div>
        <RailPanels view={view} />
      </div>

      <p className="foot">
        {view.footNotes.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </p>
    </>
  );
}

/** v7's chips are buttons that scroll, or links that navigate. */
function Chip({ chip }: { chip: V7Chip }) {
  const cls = chip.tone ? `chip ${chip.tone}` : 'chip';
  const inner = (
    <>
      {chip.beacon && <span className="beacon" />}
      {chip.text}
    </>
  );
  if (chip.href) {
    return (
      <Link href={chip.href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (chip.scrollTo) {
    // v7 scrolls with `scrollIntoView({behavior:'smooth'})`. An anchor does the
    // same thing without JavaScript and keeps the target reachable by keyboard.
    return (
      <a href={`#${chip.scrollTo}`} className={cls}>
        {inner}
      </a>
    );
  }
  return <span className={cls}>{inner}</span>;
}

function LaneEl({
  lane,
  busyId,
  result,
  onAction,
}: {
  lane: V7Lane;
  busyId: string | null;
  result: { id: string; tone: string; message: string } | null;
  onAction?: (action: string, id?: string) => void;
}) {
  // v7 colours each lane's top edge by a modifier class whose name is the lane
  // key. Spelled out rather than interpolated: the contrast gate counts a
  // runtime template as `unresolved`, and rule #28 treats a rising unresolved
  // count as the gate going blind.
  const cls =
    lane.key === 'new'
      ? 'lane new'
      : lane.key === 'quoted'
        ? 'lane quoted'
        : lane.key === 'approved'
          ? 'lane approved'
          : lane.key === 'shop'
            ? 'lane shop'
            : 'lane done';
  return (
    // The HEADING carries `id="lane-<key>"` and the section is labelled by it.
    // That id is also the summary chip's scroll target, which is what you want
    // to land on. v7 puts the id on the section instead, but the section is not
    // the thing being named and a screen reader announcing the region needs the
    // h2's text.
    <section className={cls} aria-labelledby={`lane-${lane.key}`}>
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
            <CardEl
              key={card.key}
              card={card}
              busy={busyId === card.key}
              result={result && result.id === card.key ? result : null}
              onAction={onAction}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CardEl({
  card,
  busy,
  result,
  onAction,
}: {
  card: V7Card;
  busy: boolean;
  result: { tone: string; message: string } | null;
  onAction?: (action: string, id?: string) => void;
}) {
  const metaClass = card.metaTone ? `meta ${card.metaTone}` : 'meta';
  return (
    <article
      className={card.approved ? 'card appr' : 'card'}
      data-testid="workbench-card"
      // The STAGE, not the card's key — this was `card.key` on the first pass,
      // which broke every selector in the suite that picks a lane's cards.
      data-stage={card.stage}
      data-request-number={card.jobNumber}
    >
      <div className="top">
        <V7Thumb
          drawing={card.drawing}
          state={card.thumbState}
          href={card.href}
          label={`Open ${card.customer}`}
        />
        <div className="body">
          <Link href={card.href} className="stretch">
            {card.customer}
          </Link>
          <div className="item">{card.itemLine}</div>
          <div className="spec">
            <V7Spec spec={card.spec} />
          </div>
        </div>
      </div>

      {/* v7 always renders this row: every card carries a profile-state pill. */}
      <div className="crow">
        <V7PillEl pill={card.profilePill} />
        {card.flagPills.map((p) => (
          <V7PillEl key={p.text} pill={p} />
        ))}
      </div>

      <div className={metaClass}>
        {card.beacon && <span className="beacon" />}
        <span className="src">{card.source}</span>
        <span>{card.meta}</span>
      </div>

      {result && (
        <div role="status" data-testid="card-send-result" className={PSTRIP_CLASS[result.tone] ?? 'pstrip'}>
          <div>{result.message}</div>
        </div>
      )}

      {card.buttons.length > 0 && (
        <div className="crow">
          {card.buttons.map((b) => (
            <V7Btn
              key={b.label}
              button={busy && b.action === 'machine' ? { ...b, label: 'Sending…' } : b}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </article>
  );
}

/** v7 `railPanels()` (line 1271) — three panels, in this order. */
function RailPanels({ view }: { view: V7WorkbenchView }) {
  return (
    <div className="rail2">
      <section className="rp" id="inbox">
        <h3>
          Email inbox{' '}
          <span className="tag blue">{view.inbox ? `${view.inbox.newCount} new` : 'not connected'}</span>
        </h3>
        {view.inbox ? (
          <>
            <div className="conn" style={{ margin: '0 0 8px' }}>
              <i />
              {view.inbox.connected}
            </div>
            <div className="scroll">
              {view.inbox.rows.map((m) => (
                <div className={INBOX_CLASS[m.type] ?? 'rl m'} key={m.key}>
                  <div className="tx">
                    <b>{m.company}</b>
                    <span>
                      {m.subject} · {m.time}
                    </span>
                  </div>
                  {m.button.label === 'Handled' ? (
                    <span className="pill">Handled</span>
                  ) : (
                    <V7Btn button={m.button} />
                  )}
                </div>
              ))}
            </div>
            {/* v7 closes the panel with this row. Leaving it out made the panel
                25px shorter, which moved both rail panels below it — a visible
                difference the whole-screen diff found and no pair comparison
                could have. */}
            <div className="crow" style={{ marginTop: '6px' }}>
              <V7Btn button={{ tone: 'slate', size: 'sm', label: 'Check now', action: 'checkMail' }} />
            </div>
          </>
        ) : (
          /* THE ONE MICROSOFT-DEPENDENT FEATURE. There is no Graph code in this
             repo at all (docs/COMMAND_CENTER_V2_SPEC.md §2.4) and the Entra app
             registration is still pending, so the panel says so rather than
             showing an inbox that is not being read. v7's markup is kept so the
             panel appears in the right place at the right size, which is what
             the rail's layout depends on. */
          <div className="hint">
            Not connected to Outlook yet. When it is, new orders and approvals appear here.
          </div>
        )}
      </section>

      <section className="rp">
        <h3>
          In the shop right now{' '}
          <Link href="/admin/shop-view" className="btn slate sm">
            Shop View
          </Link>
        </h3>
        {view.shopRows.length ? (
          view.shopRows.map((r) => <RailRowEl key={r.key} row={r} />)
        ) : (
          <div className="hint">Nothing in the queue.</div>
        )}
      </section>

      <section className="rp">
        <h3>
          Deliveries, next two days{' '}
          <Link href="/admin/deliveries" className="btn slate sm">
            Deliveries
          </Link>
        </h3>
        {view.deliveryRows.length ? (
          view.deliveryRows.map((r) => <RailRowEl key={r.key} row={r} />)
        ) : (
          <div className="hint">No deliveries scheduled.</div>
        )}
      </section>
    </div>
  );
}

function RailRowEl({ row }: { row: V7RailRow }) {
  const body = (
    <>
      <V7Thumb drawing={row.drawing} size={100} className="sm" label={row.title} />
      <div className="tx">
        <b>{row.title}</b>
        <span>{row.sub}</span>
      </div>
    </>
  );
  return row.href ? (
    <Link href={row.href} className="rl">
      {body}
    </Link>
  ) : (
    <div className="rl">{body}</div>
  );
}
