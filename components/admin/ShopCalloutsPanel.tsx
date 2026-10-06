'use client';

import { useCallback, useEffect, useState } from 'react';
import ShopCalloutDrawing from '@/components/admin/ShopCalloutDrawing';
import {
  CALLOUTS_UNREADABLE_MESSAGE,
  SHOP_NOTE_LABEL,
  shopCalloutBanner,
  type ShopCalloutSet,
} from '@/lib/shop-callouts/types';

/**
 * STEVE'S SHOP NOTES, AS THE OPERATOR READS THEM.
 *
 * ============ RED IS NOT THE ONLY SIGNAL ============
 *
 * Reid asked for red and red is here — `text-afs-crimson`, which measures
 * 6.50:1 on `afs-bg-card` and 5.17:1 on `afs-bg-lane`, both clear of WCAG AA's
 * 4.5:1 for body text on the two surfaces Shop View actually paints. (The gate
 * that proves it is `pnpm check:contrast`, CLAUDE.md rule #28.)
 *
 * But colour is never the only carrier. Every note also has a NUMBERED BADGE
 * matching its arrow and the words "SHOP NOTE" beside it, so the panel still
 * works for an operator with red-green colour blindness, on a sun-washed
 * tablet, and photocopied in black and white — which is how a job sheet
 * actually travels round a shop.
 *
 * ============ FETCHED WHEN IT IS OPENED, NOT POLLED ============
 *
 * The queue carries a COUNT (rule #26's lazy pattern, the same one
 * LazyProfileThumb uses for drawings). The text and the geometry arrive from
 * app/api/shop-callouts/[shopJobId] when an operator opens this panel. Twenty
 * rows of note text re-fetched every thirty seconds would be the same egress
 * mistake that rule exists to prevent.
 *
 * ============ READ-ONLY, DELIBERATELY ============
 *
 * There is no edit control, no delete and no reply. The shop reads Steve's
 * instruction; it cannot change it or silence it. Migration 051 grants the
 * operator role SELECT and nothing else, so this is the UI agreeing with the
 * database rather than the database trusting the UI.
 */

type State = 'loading' | 'ready' | 'failed';

export default function ShopCalloutsPanel({
  shopJobId,
  /** From the queue read, so the banner is right before the fetch lands. */
  expectedCount,
}: {
  shopJobId: string;
  expectedCount: number;
}) {
  const [set, setSet] = useState<ShopCalloutSet | null>(null);
  const [state, setState] = useState<State>('loading');
  const [highlight, setHighlight] = useState<number | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`/api/shop-callouts/${shopJobId}`, { cache: 'no-store' });
      if (!res.ok) {
        setState('failed');
        return;
      }
      const data = (await res.json()) as ShopCalloutSet;
      setSet({
        callouts: Array.isArray(data.callouts) ? data.callouts : [],
        points: Array.isArray(data.points) ? data.points : [],
        unreadable: data.unreadable === true,
      });
      setState('ready');
    } catch {
      setState('failed');
    }
  }, [shopJobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const callouts = set?.callouts ?? [];
  // Before the fetch lands, the count the queue already gave us is the honest
  // number; afterwards the fetched list is.
  const count = state === 'ready' ? callouts.length : expectedCount;
  const banner = shopCalloutBanner(count);

  return (
    <div className="flex flex-col gap-3" data-testid="shop-callouts-panel" data-shop-job-id={shopJobId}>
      {/* THE BANNER. Absent at zero — see shopCalloutBanner. A banner that says
          "0 notes" is a banner people learn to look past. */}
      {banner && (
        <div
          role="alert"
          data-testid="shop-callouts-banner"
          className="flex items-center gap-2 rounded border-2 border-afs-crimson bg-afs-bg-card px-3 py-2"
        >
          <span className="font-label text-xs font-bold uppercase tracking-wider text-afs-crimson">{SHOP_NOTE_LABEL}</span>
          <strong className="font-body text-base font-bold text-afs-crimson">{banner}</strong>
        </div>
      )}

      {state === 'failed' && (
        <div className="rounded border border-afs-border-light bg-afs-bg-card px-3 py-2">
          <p className="font-body text-sm text-afs-ink-900">
            {/* SAY WHAT DID NOT HAPPEN (CLAUDE.md rule #30). On this screen the
                next button along starts a bending machine, so "there may be
                notes you have not read" is the sentence that matters. */}
            The shop notes could not be loaded, so none are shown. This job has{' '}
            <strong>{expectedCount}</strong> of them — do not run it until you have read them.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded border border-afs-line-strong bg-afs-bg-light-raised px-3 py-1 font-body text-sm text-afs-ink-900"
          >
            Try again
          </button>
        </div>
      )}

      {/* THE READ ITSELF FAILED. Never the empty state while this is true: an
          operator reading "No shop notes on this job." would act on it. */}
      {state === 'ready' && set?.unreadable && (
        <div
          role="alert"
          data-testid="shop-callouts-unreadable"
          className="rounded border-2 border-afs-crimson bg-afs-bg-card px-3 py-2"
        >
          <strong className="font-body text-base font-bold text-afs-crimson">
            {CALLOUTS_UNREADABLE_MESSAGE}
          </strong>
        </div>
      )}

      {state === 'ready' && !set?.unreadable && callouts.length === 0 && (
        <p className="font-body text-sm text-afs-ink-700" data-testid="shop-callouts-empty">
          No shop notes on this job.
        </p>
      )}

      {callouts.length > 0 && (
        <div className="flex flex-wrap items-start gap-4">
          <ShopCalloutDrawing
            points={set?.points ?? []}
            callouts={callouts}
            highlightNumber={highlight}
            onPick={(n) => setHighlight((current) => (current === n ? null : n))}
          />

          <ul className="flex min-w-[260px] flex-1 flex-col gap-2" data-testid="shop-callouts-list">
            {callouts.map((c) => {
              const on = highlight === c.number;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    data-testid="shop-callout-note"
                    data-callout-number={c.number}
                    data-highlighted={on ? 'true' : 'false'}
                    // Click a number to highlight its arrow, and clicking the
                    // arrow highlights the note — the same state, driven from
                    // either end.
                    onClick={() => setHighlight((current) => (current === c.number ? null : c.number))}
                    aria-pressed={on}
                    className={`w-full rounded border-2 px-3 py-2 text-left ${
                      on ? 'border-afs-crimson bg-afs-amber-bg' : 'border-afs-border-light bg-afs-bg-card'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {/* THE NUMBERED BADGE — the colour-free half of the signal. */}
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-afs-crimson font-label text-sm font-bold text-white"
                      >
                        {c.number}
                      </span>
                      <span className="font-label text-xs font-bold uppercase tracking-wider text-afs-crimson">
                        {SHOP_NOTE_LABEL} {c.number}
                      </span>
                      {c.anchorStatus === 'orphaned' && (
                        <span className="font-body text-xs text-afs-ink-700">(no arrow — ask Steve where)</span>
                      )}
                    </span>
                    {/* THE NOTE ITSELF. Red, bold, and large enough to read
                        standing at a machine rather than leaning into a screen. */}
                    <span className="mt-1 block font-body text-lg font-bold leading-snug text-afs-crimson">
                      {c.note}
                    </span>
                    <span className="mt-1 block font-body text-xs text-afs-ink-700">
                      {c.authorName} · {formatWhen(c.createdAt)}
                      {c.updatedAt !== c.createdAt ? ` · edited ${formatWhen(c.updatedAt)}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * A timestamp an operator can act on.
 *
 * Deliberately NOT relative ("2 hours ago"): a shop tablet is left open for a
 * whole shift, so a relative time rendered once is wrong by lunch. An absolute
 * local time is right whenever it is read.
 */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
