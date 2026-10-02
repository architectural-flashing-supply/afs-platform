/**
 * THE FIXTURE SIDE OF THE VIEW MODEL — prototype v7's own sample data, shaped
 * for the ported components.
 *
 * Every function here is a transliteration of the matching prototype function,
 * named in its comment. Where v7 computes a string inline inside its markup
 * builder, that string is computed here instead, so the component can stay a
 * verbatim transliteration of v7's ELEMENTS without carrying any of its logic.
 *
 * Only reachable when all three fixture locks are open — see lib/fixtures/mode.ts.
 */
import {
  V7_LANES,
  V7_STATUS,
  V7_PILLC,
  V7_RANGES,
  V7_SORTS,
  V7_MATS,
  V7_LSTAGES,
  V7_MTYPE,
  V7_DAYS,
  V7_TRICIA,
  cents,
  colorOf,
  dayLabel,
  fmtTs,
  itemLabel,
  jid,
  jobDims,
  jobHi,
  jobSt,
  laneCount,
  labelOf,
  money,
  num,
  pieces,
  profBy,
  pState,
  rowOfJob,
  stopsOn,
  totals,
  v7Fixture,
  v7ListRows,
  v7SearchRows,
  type V7Fixture,
  type V7Job,
  type V7Lane as V7LaneKey,
  type V7ListState,
  type V7Row,
  type V7SearchState,
} from '@/lib/fixtures/command-center-v7';
import { V7_NAMES, bendTxt, dimTxt, stats } from '@/lib/design/v7-draw';
import type {
  V7Card,
  V7Chip,
  V7DrawingRef,
  V7Filter,
  V7InboxRow,
  V7Lane,
  V7ListRow,
  V7ListView,
  V7Pill,
  V7RailRow,
  V7SearchRow,
  V7SearchView,
  V7SpecChip,
  V7WorkbenchView,
} from './types';

export { V7_TRICIA };

function specChip(spec: string): V7SpecChip {
  const c = colorOf(spec);
  return { hex: c[1], colorName: c[0], spec };
}

function drawingOf(f: V7Fixture, j: V7Job): V7DrawingRef {
  return { kind: j.kind, d: jobDims(f.jobs, f.profiles, j), hi: jobHi(j), paint: j.paint };
}

/** v7 `pPill()` (line 1162) — the profile-state pill every card carries. */
function profilePill(j: V7Job): V7Pill {
  const s = pState(j);
  if (s === 'reuse') return { tone: 'g', text: 'Past profile' };
  if (s === 'change') return { tone: 'a', text: 'Past profile + change asked' };
  if (s === 'newver') return { tone: 'b', text: 'New version saved' };
  return {
    tone: 'r',
    text: j.src === 'Field app' ? 'Photo of sketch, not drawn yet' : 'New profile, needs drawing',
  };
}

/** v7 `flagPills()` (line 1717). */
function flagPills(j: V7Job): V7Pill[] {
  const out: V7Pill[] = [];
  if (j.rev > 1) out.push({ tone: 'a', text: `Revised v${j.rev}` });
  if (j.adds.some((a) => a.st === 'wait')) out.push({ tone: 'a', text: 'Addendum waiting' });
  return out;
}

/** v7 `cardNote()` (line 1239). */
function cardNote(j: V7Job): { t: string; c: '' | 'warn' | 'ok'; beacon: boolean } {
  if (j.lane === 'new') return { t: j.age, c: '', beacon: false };
  if (j.lane === 'quoted') return { t: j.noteQ, c: j.warn ? 'warn' : '', beacon: false };
  if (j.lane === 'approved') return { t: `Approved ${j.apAt}`, c: 'ok', beacon: true };
  if (j.lane === 'done') return { t: `Delivered ${j.doneAt}`, c: '', beacon: false };
  const d = j.day
    ? `delivery ${j.day === 'thu' ? 'today' : dayLabel(j.day).split(',')[0]}, ${j.win}`
    : 'no delivery date yet';
  const st = j.shop === 'bending' ? 'Bending now' : j.shop === 'finished' ? 'Finished' : 'Queued';
  return { t: `${st} · ${d}`, c: j.day ? '' : 'warn', beacon: false };
}

/** v7 `card()`'s button row (line 1248). */
function cardButtons(j: V7Job, href: string): V7Button[] {
  const ps = pState(j);
  if (j.lane === 'new') {
    const fieldNo = ps === 'none' && j.src === 'Field app';
    if (ps === 'none') {
      return [{ tone: 'red', size: 'sm', label: fieldNo ? 'Finish in FlashDraft' : 'Design in FlashDraft', action: 'fd', actionId: String(j.n) }];
    }
    if (ps === 'change') {
      return [
        { tone: 'red', size: 'sm', label: 'Start quote', href },
        { tone: 'blue', size: 'sm', label: 'Apply change in FlashDraft', action: 'fd', actionId: String(j.n) },
      ];
    }
    return [
      { tone: 'red', size: 'sm', label: 'Start quote', href },
      { tone: 'slate', size: 'sm', label: 'View in FlashDraft', action: 'fd', actionId: String(j.n) },
    ];
  }
  if (j.lane === 'quoted') {
    return [
      { tone: 'amber', size: 'sm', label: 'Follow up', action: 'follow', actionId: String(j.n) },
      { tone: 'slate', size: 'sm', label: 'View quote', action: 'docq', actionId: String(j.n) },
    ];
  }
  if (j.lane === 'approved') {
    return [
      { tone: 'green', size: 'sm', label: 'Send to machine', action: 'machine', actionId: String(j.n) },
      { tone: 'slate', size: 'sm', label: 'View quote', action: 'docq', actionId: String(j.n) },
    ];
  }
  if (j.lane === 'shop') {
    const out: V7Button[] = [];
    if (j.shop !== 'finished') out.push({ tone: 'violet', size: 'sm', label: 'Open in Shop View', href: '/admin/shop-view' });
    if (!j.day) out.push({ tone: 'amber', size: 'sm', label: 'Schedule delivery', href: '/admin/deliveries' });
    return out;
  }
  return [{ tone: 'blue', size: 'sm', label: 'Start a reorder', action: 'reorder', actionId: String(j.n) }];
}

import type { V7Button } from './types';

function cardOf(f: V7Fixture, j: V7Job): V7Card {
  const n = cardNote(j);
  const href = `/admin/command-center/job/${j.n}`;
  const ps = pState(j);
  return {
    key: String(j.n),
    jobNumber: j.n,
    customer: j.cust,
    itemLine: itemLabel(j),
    spec: specChip(j.spec),
    drawing: drawingOf(f, j),
    // v7 `thumbJ()`: a job with no saved profile is `.np`, unless it came from
    // the field app, in which case it is `.photo`.
    thumbState: j.pid ? '' : j.src === 'Field app' ? 'photo' : 'np',
    profilePill: profilePill(j),
    flagPills: flagPills(j),
    source: j.src,
    meta: n.t,
    metaTone: n.c,
    beacon: n.beacon,
    approved: j.lane === 'approved',
    buttons: cardButtons(j, href),
    href,
    ...(ps ? {} : {}),
  };
}

/** v7 `pageWorkbench()` (line 1283). */
export function fixtureWorkbench(): V7WorkbenchView {
  const f = v7Fixture();
  const ap = laneCount(f.jobs, 'approved');
  const nw = laneCount(f.jobs, 'new');
  const td = stopsOn(f.jobs, 'thu').length;
  const nin = f.inbox.filter((m) => m.st === 'new').length;

  const chips: V7Chip[] = [
    ap
      ? { text: `${ap} ready for the machine`, tone: 'go', beacon: true, scrollTo: 'lane-approved' }
      : { text: 'No approvals waiting', tone: '', beacon: false },
    { text: `${nw} to quote`, tone: '', beacon: false, scrollTo: 'lane-new' },
    { text: `${nin} new email${nin === 1 ? '' : 's'}`, tone: 'vio', beacon: false, scrollTo: 'inbox' },
    { text: `${td ? `${td} deliver${td === 1 ? 'y' : 'ies'}` : 'No deliveries'} today`, tone: '', beacon: false, href: '/admin/deliveries' },
  ];

  const lanes: V7Lane[] = V7_LANES.map(([key, name, sub]) => ({
    key,
    name,
    sub,
    cards: f.jobs.filter((j) => j.lane === key && j.onBoard).map((j) => cardOf(f, j)),
  }));

  const inboxRows: V7InboxRow[] = f.inbox.map((m) => {
    let button: V7Button;
    if (m.st === 'job') button = { tone: 'slate', size: 'sm', label: 'Open job', href: `/admin/command-center/job/${m.job}` };
    else if (m.st === 'done') button = { tone: '', size: 'sm', label: 'Handled' };
    else if (m.type === 'order' || m.type === 'reorder') button = { tone: 'blue', size: 'sm', label: 'Draft quote', action: 'mailGo', actionId: String(m.id) };
    else if (m.type === 'approval') button = { tone: 'green', size: 'sm', label: 'Apply', action: 'mailGo', actionId: String(m.id) };
    else if (m.type === 'notice') button = { tone: 'amber', size: 'sm', label: 'Log it', action: 'mailGo', actionId: String(m.id) };
    else button = { tone: 'slate', size: 'sm', label: 'Ignore', action: 'mailGo', actionId: String(m.id) };
    return {
      key: String(m.id),
      type: m.st === 'done' ? 'done' : m.type,
      company: m.co,
      subject: m.subj,
      time: m.time,
      button,
    };
  });

  const shopRows: V7RailRow[] = f.queue
    .map((n) => f.jobs.find((j) => j.n === n))
    .filter((j): j is V7Job => Boolean(j))
    .map((j) => ({
      key: String(j.n),
      drawing: drawingOf(f, j),
      title: itemLabel(j),
      sub: `${j.cust} · ${j.shop === 'bending' ? 'Bending now' : 'Queued'}`,
      href: '/admin/shop-view',
    }));

  const deliveryRows: V7RailRow[] = f.jobs
    .filter((j) => j.lane === 'shop' && (j.day === 'thu' || j.day === 'fri'))
    .map((j) => ({
      key: String(j.n),
      drawing: drawingOf(f, j),
      title: j.cust,
      sub: `${j.day === 'thu' ? 'Today' : 'Tomorrow'} · ${j.win} · ${itemLabel(j)}`,
      href: '/admin/deliveries',
    }));

  return {
    chips,
    lanes,
    inbox: { connected: 'Connected to Outlook · read 20 sec ago', newCount: nin, rows: inboxRows },
    shopRows,
    deliveryRows,
    // v7's third sentence is a SAMPLE-DATA DISCLOSURE and is true here, because
    // in fixture mode the screen really is showing v7's samples. The live
    // builder does not emit it — shipping "these are sample data" over real
    // customer names would be a false statement on a working screen.
    footNotes: [
      'Done jobs leave the board after 14 days. Search still finds them.',
      'Customer names, numbers and prices on this screen are sample data.',
    ],
  };
}

/* ───────────────────────────── Quotes / Orders ─────────────────────────── */

function listRowOf(f: V7Fixture, r: V7Row): V7ListRow {
  const j = r.j!;
  const st = stats(r.kind, r.d);
  const n = cardNote(j);
  return {
    key: String(j.n),
    href: `/admin/command-center/job/${j.n}`,
    drawing: { kind: r.kind, d: r.d, hi: [], paint: j.paint },
    customer: r.cust,
    person: r.person,
    profileName: V7_NAMES[r.kind],
    dims: dimTxt(r.kind, r.d),
    bends: bendTxt(st),
    qty: `${r.qty} ${pieces(r.qty)}`,
    spec: specChip(r.spec),
    total: r.tot ? cents(r.tot) : 'No price yet',
    jobId: jid(r.n),
    statusPill: { tone: V7_PILLC[j.lane], text: V7_STATUS[j.lane] },
    flagPills: flagPills(j),
    meta: n.t,
    date: fmtTs(j.ts),
    source: j.src,
    button: listAct(j),
  };
}

/** v7 `listAct()` (line 1720). */
function listAct(j: V7Job): V7Button {
  if (j.lane === 'new') {
    return { tone: 'red', size: 'sm', label: pState(j) === 'none' ? 'Open and draw' : 'Start quote', href: `/admin/command-center/job/${j.n}` };
  }
  if (j.lane === 'quoted') return { tone: 'amber', size: 'sm', label: 'Follow up', action: 'follow', actionId: String(j.n) };
  if (j.lane === 'approved') return { tone: 'green', size: 'sm', label: 'Send to machine', action: 'machine', actionId: String(j.n) };
  if (j.lane === 'shop') {
    return j.shop === 'finished'
      ? { tone: 'slate', size: 'sm', label: 'Deliveries', href: '/admin/deliveries' }
      : { tone: 'violet', size: 'sm', label: 'Shop View', href: '/admin/shop-view' };
  }
  return { tone: 'blue', size: 'sm', label: 'Reorder', action: 'reorder', actionId: String(j.n) };
}

/** v7 `pageList()` (line 1745). */
export function fixtureList(kind: 'quotes' | 'orders', s: V7ListState): V7ListView {
  const f = v7Fixture();
  const rows = v7ListRows(f.profiles, f.jobs, kind, s);
  const title = kind === 'quotes' ? 'Quotes' : 'Orders';
  return {
    title,
    sub:
      kind === 'quotes'
        ? 'Every quote that still needs a price or is waiting on the customer. Revised quotes show here too.'
        : 'Everything the customer has approved: waiting for the machine, in the shop, and delivered.',
    showNewQuote: kind === 'quotes',
    filters: [
      { name: 'q', label: `Search ${title.toLowerCase()}`, value: s.q, placeholder: 'Customer, profile, material or job number' },
      { name: 'stage', label: 'Stage', value: s.stage, options: V7_LSTAGES[kind] },
      { name: 'range', label: 'Date', value: s.range, options: V7_RANGES },
      { name: 'sort', label: 'Sort', value: s.sort, options: V7_SORTS },
    ],
    countLine: `${rows.length} ${kind === 'quotes' ? 'quote' : 'order'}${rows.length === 1 ? '' : 's'} · ${labelOf(V7_SORTS, s.sort).toLowerCase()}`,
    rows: rows.map((r) => listRowOf(f, r)),
    emptyText: 'Nothing here matches.',
  };
}

/* ────────────────────────────────  Search  ─────────────────────────────── */

/** v7 `resRow()` (line 1655). */
function searchRowOf(r: V7Row): V7SearchRow {
  const st = stats(r.kind, r.d);
  const buttons: V7Button[] = [];
  if (r.pid) buttons.push({ tone: 'red', size: 'sm', label: 'Reorder', action: 'reorderRow', actionId: String(r.pid) });
  if (r.j) buttons.push({ tone: 'slate', size: 'sm', label: 'Open job', href: `/admin/command-center/job/${r.n}` });
  else if (r.pid) buttons.push({ tone: 'slate', size: 'sm', label: 'FlashDraft', action: 'fdp', actionId: String(r.pid) });
  return {
    key: `${r.n}-${r.pid}-${r.ts}`,
    drawing: { kind: r.kind, d: r.d, hi: [], paint: 'Up' },
    profileName: V7_NAMES[r.kind],
    dims: dimTxt(r.kind, r.d),
    bends: bendTxt(st),
    customer: r.cust,
    person: r.person,
    jobId: jid(r.n),
    date: fmtTs(r.ts),
    status: r.status,
    qty: `${r.qty} ${pieces(r.qty)}`,
    spec: specChip(r.spec),
    total: r.tot ? cents(r.tot) : '',
    price: r.unit ? `${money(r.unit)} each` : 'No price yet',
    buttons,
  };
}

/** v7 `pageSearch()` (line 1667) + `resultsHTML()` (line 1664). */
export function fixtureSearch(s: V7SearchState): V7SearchView {
  const f = v7Fixture();
  const rows = v7SearchRows(f.profiles, f.jobs, s);
  return {
    filters: [
      { name: 'q', label: 'Search for', value: s.q, placeholder: 'Company, then profile, material or job number' },
      {
        name: 'show',
        label: 'Show',
        value: s.show,
        options: [
          ['all', 'Quotes and orders'],
          ['quotes', 'Quotes only'],
          ['orders', 'Orders only'],
        ],
      },
      { name: 'mat', label: 'Material', value: s.mat, options: V7_MATS.map((m) => [m, m] as [string, string]) },
      { name: 'range', label: 'Date', value: s.range, options: V7_RANGES },
      { name: 'sort', label: 'Sort', value: s.sort, options: V7_SORTS },
    ],
    profileChip: s.pid ? { text: `Showing profile #${s.pid} only`, clearHref: '/admin/search' } : null,
    countLine:
      `${rows.length} result${rows.length === 1 ? '' : 's'}` +
      (s.q.trim() ? ` for “${s.q.trim()}”` : '') +
      ` · ${labelOf(V7_SORTS, s.sort).toLowerCase()}`,
    rows: rows.map(searchRowOf),
    emptyText: 'Nothing matches. Try fewer words, or just the company name.',
  };
}

export { V7_DAYS, V7_MTYPE, num, totals, rowOfJob, profBy, jobSt, type V7LaneKey, type V7Filter };
