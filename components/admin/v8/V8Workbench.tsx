'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProfileViewer from '@/components/admin/v8/ProfileViewer';
import type { V8WorkbenchView } from '@/lib/data/v8-view/workbench';
import type { JobStage } from '@/lib/data/job-stage';

/**
 * THE WORKBENCH, PORTED FROM MOCKUP B.
 *
 * `docs/design/command-center-v8/Workbench_B-stage-strip-table.html` — frozen,
 * hash-verified on every build. Its markup, its class names and its wording;
 * the live app's data and behaviour. The CSS is DERIVED from that same file by
 * `scripts/design/scope-v8-css.mjs` under `.cc-v8` and is never retyped
 * (CLAUDE.md rule #33).
 *
 * THE STAGE STRIP FILTERS THE TABLE, which is the whole idea of mockup B and
 * the thing that makes it different from v7's five-lane board. The mockup does
 * it by toggling `style.display` on rows; this does it by filtering the array,
 * which is the same result in React and keeps the DOM honest about what is on
 * screen — a hidden row is still a row a screen reader reads.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THE LIVE SCREEN DOES THAT THE MOCKUP ONLY MIMES.
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   - Every thumbnail is the REAL saved image for that job, through the one
 *     ProfileViewer: drawn geometry, the field photograph, the saved shop PNG,
 *     or an explicit to-do (Reid's profile rules). The mockup's thumbnails are
 *     hand-drawn stand-in paths, which rule 1 forbids in the real thing.
 *   - The row actions post to the real routes and report what really happened.
 *   - The board refreshes itself within seconds of a job arriving, via the
 *     pulse — see V7Workbench's own note and the pulse route for the
 *     regression that fixed.
 *   - The inbox button says the mail connection is not wired rather than
 *     showing the mockup's "7 new", which would be a number nobody can click
 *     through to.
 */

const PULSE_MS = 5_000;
const REFRESH_MS = 60_000;

/**
 * CLASS MAPS, NOT STRING INTERPOLATION — and this is a gate requirement, not a
 * style preference.
 *
 * `scripts/audit/contrast-check.mjs` resolves a class MAP to its values
 * (CLAUDE.md rule #28's `TONES[tone]` behaviour) but cannot read
 * `` `pill ${tone}` ``, whose value only exists at runtime. Written the
 * interpolated way these five className expressions came back as
 * `5 unresolved`, and rule #28 is explicit that a rise in that number means
 * the gate got blinder rather than the code safer.
 *
 * Writing them out also makes the tone vocabulary a closed, readable set
 * instead of whatever string a view model happens to produce.
 */
const NEED_CLASS: Record<string, string> = {
  b: 'need b',
  g: 'need g',
  a: 'need a',
  n: 'need n',
};

const PILL_CLASS: Record<string, string> = {
  b: 'pill b',
  g: 'pill g',
  a: 'pill a',
  n: 'pill n',
  r: 'pill r',
};

const ACTION_CLASS: Record<string, string> = {
  b: 'btn sm b',
  g: 'btn sm g',
  a: 'btn sm a',
  o: 'btn sm o',
};

export default function V8Workbench({ view }: { view: V8WorkbenchView }) {
  const router = useRouter();
  const [stage, setStage] = useState<JobStage | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; tone: string; message: string } | null>(null);

  // SAME PULSE AS THE v7 BOARD, and for the same reason — a field photo must
  // appear within seconds, not within a minute. See
  // app/api/admin/command-center/pulse/route.ts.
  useEffect(() => {
    let pulse: ReturnType<typeof setInterval> | null = null;
    let slow: ReturnType<typeof setInterval> | null = null;
    let last: string | null = null;
    let inFlight = false;

    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch('/api/admin/command-center/pulse', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { signature?: string };
        const sig = typeof body.signature === 'string' ? body.signature : null;
        if (sig === null) return;
        if (last !== null && sig !== last) router.refresh();
        last = sig;
      } catch {
        /* a failed pulse is not worth showing anybody; the next is 5s away */
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      if (pulse === null) pulse = setInterval(check, PULSE_MS);
      if (slow === null) slow = setInterval(() => router.refresh(), REFRESH_MS);
    };
    const stop = () => {
      // Rule #26: a polling screen pauses when the tab is hidden.
      if (pulse !== null) { clearInterval(pulse); pulse = null; }
      if (slow !== null) { clearInterval(slow); slow = null; }
    };
    const onVis = () => {
      if (document.hidden) stop();
      else { router.refresh(); void check(); start(); }
    };
    if (!document.hidden) { void check(); start(); }
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [router]);

  const rows = stage === 'all' ? view.rows : view.rows.filter((r) => r.stage === stage);

  /**
   * THE ONE DOOR, UNCHANGED.
   *
   * Only "send to machine" (and its retry) posts anything, and it posts to
   * `approve-quote-request` — the same route v7's board uses and one of the
   * only TWO files CLAUDE.md rule #14 permits to reach catalog 20115. A
   * generic `workbench-action` endpoint was drafted here and DELETED before it
   * ran: a route that takes an action name and an id, one of whose names is
   * "send to machine", is a fifth door to the Thalmann wearing a dispatcher's
   * costume. The static single-door test would have failed it, and it would
   * have been right.
   *
   * Every other action is a LINK to the screen where that work is done, which
   * is what v7's board does too.
   */
  async function sendToMachine(id: string) {
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
        setResult({ id, tone: body.alreadySent ? 'amber' : 'ok', message: body.message ?? 'Done.' });
      } else {
        // NOTHING IS REPORTED AS SENT THAT WAS NOT SENT (rule #16).
        setResult({ id, tone: 'bad', message: body.error ?? 'The send did not go through.' });
      }
    } catch {
      setResult({
        id,
        tone: 'bad',
        message: 'The send could not be attempted — the connection dropped. Nothing was sent.',
      });
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }

  /** Where a non-sending action goes. The work happens on that screen. */
  function actionHref(row: (typeof view.rows)[number]): string | null {
    switch (row.action?.kind) {
      case 'schedule-delivery':
        return '/admin/deliveries';
      case 'start-quote':
        return row.href;
      default:
        return null;
    }
  }

  return (
    <div className="wrap" data-v8-screen="workbench">
      <div className="bar">
        <div>
          <h1 title={view.greeting}>Workbench</h1>
          <div className="sub" style={{ margin: 0 }}>
            Your five steps, left to right. Tap a step to filter the list.
          </div>
        </div>
        {/* The mockup shows "✉ Inbox · 7 new". There is no mail connection, so
            this says so and goes where the mail work actually is. */}
        <Link href="/admin/email-intake" className="inbox" data-v8-inbox>
          {view.inboxNewCount === null ? '✉ Inbox · not connected' : `✉ Inbox · ${view.inboxNewCount} new`}
        </Link>
      </div>

      <div className="needrow">
        {view.needs.map((n) => {
          const inner = (
            <>
              <b>{n.count}</b>
              <span>{n.text}</span>
            </>
          );
          return n.href ? (
            <Link key={n.text} href={n.href} className={NEED_CLASS[n.tone] ?? 'need n'} data-v8-need={n.tone}>
              {inner}
            </Link>
          ) : (
            <span key={n.text} className={NEED_CLASS[n.tone] ?? 'need n'} data-v8-need={n.tone}>
              {inner}
            </span>
          );
        })}
      </div>

      <div className="strip" role="tablist" aria-label="Filter by stage">
        {view.stages.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={stage === s.key}
            className={`stg${stage === s.key ? ' on' : ''}`}
            data-s={s.key}
            data-v8-stage={s.key}
            onClick={() => setStage(s.key)}
          >
            <span className="num">{s.count}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th />
              <th>Customer / job</th>
              <th>Profile</th>
              <th>Color / qty</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} data-s={r.stage} data-request-number={r.key} data-v8-row={r.key}>
                <td className="hov">
                  <ProfileViewer
                    source={r.profileSource}
                    label={`${r.customer} — ${r.profile}`}
                    thumbSize={56}
                    flashDraftHref={r.flashDraftHref}
                  />
                </td>
                <td>
                  <b>
                    <Link href={r.href}>{r.customer}</Link>
                  </b>
                  <div className="muted">{r.jobLine}</div>
                </td>
                <td>
                  {r.profile}
                  <div className="muted">{r.profileSpec}</div>
                </td>
                <td>
                  {r.colorName ? (
                    <span className="tag">
                      <span className="sw" style={{ background: r.colorHex }} />
                      {r.colorName}
                    </span>
                  ) : (
                    <span className="muted">No colour set</span>
                  )}
                  <div className="muted">{r.qtyLine}</div>
                </td>
                <td>
                  <span className={PILL_CLASS[r.pillTone] ?? 'pill n'}>{r.stageLabel}</span>
                  {r.isRush && <span className={PILL_CLASS.r} style={{ marginLeft: 6 }}>RUSH</span>}
                  <div className="muted when">{r.when}</div>
                  {result?.id === r.key && (
                    <div className="muted" data-v8-action-result={result.tone}>
                      {result.message}
                    </div>
                  )}
                </td>
                <td className="r">
                  {r.action === null ? (
                    <Link href={r.href} className="btn sm o">
                      Open
                    </Link>
                  ) : actionHref(r) ? (
                    <Link
                      href={actionHref(r) as string}
                      className={ACTION_CLASS[r.action.tone] ?? 'btn sm o'}
                      data-v8-action={r.action.kind}
                    >
                      {r.action.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={ACTION_CLASS[r.action.tone] ?? 'btn sm o'}
                      disabled={busyId === r.key}
                      onClick={() => void sendToMachine(r.key)}
                      data-v8-action={r.action.kind}
                    >
                      {busyId === r.key ? 'Working…' : r.action.label}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {stage === 'all'
                    ? 'Nothing on the board. New jobs appear here the moment they arrive.'
                    : 'Nothing at this step right now.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* REID'S PROFILE RULE 1d — jobs with no image of any kind, as work. Only
          rendered when there is something on it: an always-present empty panel
          trains people to ignore it. */}
      {view.needsDrawing.length > 0 && (
        <div className="tbl" style={{ marginTop: 16 }} data-v8-needs-drawing-panel="1">
          <table>
            <thead>
              <tr>
                <th>Needs a drawing · {view.needsDrawing.length}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {view.needsDrawing.map((n) => (
                <tr key={n.key} data-v8-needs-drawing-row={n.key}>
                  <td>
                    <b>
                      <Link href={n.href}>{n.title}</Link>
                    </b>
                    <div className="muted">{n.sub}</div>
                  </td>
                  <td className="r">
                    <Link href={n.flashDraftHref} className="btn sm b" data-v8-send-to-flashdraft="1">
                      Send to FlashDraft
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">
        {view.footNotes.map((f) => (
          <div key={f}>{f}</div>
        ))}
      </div>
    </div>
  );
}
