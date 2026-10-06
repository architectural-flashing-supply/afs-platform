/**
 * SHOP VIEW's view model, from either source.
 *
 * Both builders live together because the two sides of this screen differ in
 * exactly one interesting way and it is worth seeing side by side: the fixture
 * carries v7's sample GEOMETRY and can draw a profile inline, while the live
 * side carries only `hasDrawing` and lazy-loads the real image one card at a
 * time through `/api/admin/shop-queue/drawing/[id]`.
 *
 * THAT ASYMMETRY IS CLAUDE.md RULE #26 AND MUST NOT BE "UNIFIED". A live queue
 * row's drawing is a base64 PNG measured at 70KB-786KB, and the board polls
 * every thirty seconds; returning them inline is the exact egress bug that rule
 * exists to prevent. So `drawing` is the fixture's inline geometry and
 * `hasLazyDrawing` is the live side's flag, and the component renders whichever
 * it was given.
 */
import { bendTxt, stats } from '@/lib/design/v7-draw';
import {
  V7_FIN,
  V7_QUEUE,
  colorOf,
  itemLabel,
  jobDims,
  jobHi,
  v7Fixture,
  type V7Job,
} from '@/lib/fixtures/command-center-v7';
import { deliveryWindowLabel } from '@/lib/delivery/windows';
import { formatDayHeading } from '@/lib/delivery/business-days';
import { liveSpecChip } from '@/lib/data/v7-view/from-live';
import type { ShopQueue, ShopQueueCard } from '@/lib/data/shop-queue';
import type { V7Button, V7ShopFinishedRow, V7ShopRow, V7ShopView } from './types';

/** v7 `pageShop()` (line 1476), over v7's own queue. */
export function fixtureShopView(): V7ShopView {
  const f = v7Fixture();
  const byNumber = (n: number) => f.jobs.find((j) => j.n === n);
  const queue = V7_QUEUE.map(byNumber).filter((j): j is V7Job => Boolean(j));

  const rows: V7ShopRow[] = queue.map((j, i) => {
    const now = j.shop === 'bending';
    const st = stats(j.kind, jobDims(f.jobs, f.profiles, j));
    const c = colorOf(j.spec);
    const buttons: V7Button[] = [
      { tone: 'green', size: 'sm', label: now ? 'Open' : 'Start bending', action: 'openop', actionId: String(j.n) },
      { tone: 'slate', size: 'sm', label: 'View', action: 'openop', actionId: String(j.n) },
    ];
    return {
      key: String(j.n),
      position: i + 1,
      drawing: { kind: j.kind, d: jobDims(f.jobs, f.profiles, j), hi: jobHi(j), paint: j.paint },
      hasLazyDrawing: false,
      itemLine: itemLabel(j),
      customerLine: `${j.cust} · profile #${j.prof}`,
      spec: { hex: c[1], colorName: c[0], spec: j.spec },
      bends: bendTxt(st),
      paint: j.paint,
      bending: now,
      state: now ? 'bending' : 'queued',
      stateLabel: now ? 'Bending now' : 'Queued',
      notePill: j.notes.length
        ? { tone: 'a', text: `${j.notes.length} note${j.notes.length === 1 ? '' : 's'}` }
        : null,
      // FIXTURE MODE SUBSTITUTES DATA ONLY (CLAUDE.md rule #34). v7's sample
      // notes are not `shop_callouts` rows, so the real count is zero here and
      // the pixel gate keeps measuring exactly the screen it measured before.
      calloutCount: 0,
      isRush: false,
      buttons,
    };
  });

  const finishedToday: V7ShopFinishedRow[] = V7_FIN.map(byNumber)
    .filter((j): j is V7Job => Boolean(j))
    .map((j) => ({
      key: String(j.n),
      drawing: { kind: j.kind, d: jobDims(f.jobs, f.profiles, j), hi: jobHi(j), paint: j.paint },
      hasLazyDrawing: false,
      itemLine: itemLabel(j),
      sub: `${j.cust} · invoice #${j.inv ? j.inv.no : ''} ${j.inv && j.inv.sent ? 'emailed' : ''}`.trimEnd(),
    }));

  const next = queue[0];
  return {
    rows,
    finishedToday,
    nextUp: next
      ? {
          key: String(next.n),
          drawing: { kind: next.kind, d: jobDims(f.jobs, f.profiles, next), hi: jobHi(next), paint: next.paint },
          hasLazyDrawing: false,
          caption: `${itemLabel(next)} · ${next.cust}`,
        }
      : null,
    emptyText: 'Nothing waiting. Jobs appear here when you press Send to machine on the Workbench.',
    // v7's sample notes are not shop_callouts rows, so nothing was read and
    // nothing failed to be read.
    calloutsUnreadable: false,
  };
}

/**
 * v7 `pageShop()` over the live queue.
 *
 * TWO v7 SLOTS THE LIVE ROW CANNOT FILL, and neither is faked:
 *
 *   - THE BEND COUNT. v7 prints "2 bends, 2 hems" because it has the geometry
 *     in memory. The live queue read deliberately carries none (rule #26), so
 *     the line holds the shop-floor instructions the row already has — hem
 *     handling and anything special — which is the thing an operator standing
 *     at the machine actually needs on that line. Where there are none it is
 *     empty rather than invented.
 *   - THE PAINTED SIDE. `paintedEdge` is a boolean on the live card, so it can
 *     say "Painted Up" or nothing at all; it never guesses "Down".
 */
export function liveShopView(queue: ShopQueue): V7ShopView {
  const rows: V7ShopRow[] = queue.active.map((card) => ({
    key: card.id,
    position: card.position,
    drawing: null,
    hasLazyDrawing: card.hasDrawing,
    itemLine: `${card.item}${card.quantity ? ` × ${card.quantity}` : ''}`,
    customerLine: `${card.customer}${
      card.machineProfileId ? ` · profile #${card.machineProfileId}` : ' · no machine profile number'
    }`,
    spec: liveSpecChip(card.spec),
    bends: [card.hemInstructions, card.specialInstructions].filter(Boolean).join(' · '),
    paint: card.paintedEdge ? 'Up' : '',
    bending: card.state === 'bending',
    state: card.state,
    stateLabel: card.stateLabel,
    // v7's note pill counts Steve's operator notes beside the status, and as of
    // the shop-callouts feature there is now something real to count: the
    // callouts Steve authored on this job's drawing in FlashDraft (migration
    // 051). Before that there was nothing honest to put here and the pill was
    // omitted; it is the same pill, finally with data behind it.
    notePill: card.calloutCount
      ? { tone: 'a', text: `${card.calloutCount} note${card.calloutCount === 1 ? '' : 's'}` }
      : null,
    calloutCount: card.calloutCount,
    isRush: card.isRush,
    buttons: card.action
      ? [
          {
            tone: 'green',
            size: 'sm',
            label: card.action.label,
            action: 'advance',
            actionId: card.id,
            // tests/e2e/shop-deliveries.spec.ts follows a job through the shop
            // by these two ids. Dropped on the first pass; the suite caught it.
            testId: card.action.kind === 'start' ? 'start-bending' : 'mark-finished',
          },
        ]
      : [],
  }));

  const finishedToday: V7ShopFinishedRow[] = queue.finishedToday.map((card: ShopQueueCard) => ({
    key: card.id,
    drawing: null,
    hasLazyDrawing: card.hasDrawing,
    itemLine: `${card.item}${card.quantity ? ` × ${card.quantity}` : ''}`,
    // v7 prints the invoice number here. The shop queue read has no invoice, so
    // the row says what it does know — when the job is going out, or that no
    // day is set yet, which is the thing somebody would act on.
    sub: `${card.customer} · ${
      card.deliveryDate
        ? `Going out ${formatDayHeading(card.deliveryDate)}, ${deliveryWindowLabel(card.deliveryWindow ?? '')}`
        : 'No delivery day yet — set one in Deliveries.'
    }`,
  }));

  const next = queue.active[0] ?? null;
  return {
    rows,
    finishedToday,
    nextUp: next
      ? {
          key: next.id,
          drawing: null,
          hasLazyDrawing: next.hasDrawing,
          caption: `${next.item}${next.quantity ? ` × ${next.quantity}` : ''} · ${next.customer}`,
        }
      : null,
    emptyText: 'Nothing waiting. Jobs appear here when you press Send to machine on the Workbench.',
    calloutsUnreadable: queue.calloutsUnreadable,
  };
}
