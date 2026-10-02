/**
 * THE JOB SCREEN — v7 `pageJob()` (prototype line 1420) and the five
 * stage panes behind it, fixture side.
 *
 * Eight of the manifest's screens are this one page in different stages, which
 * is why it is worth a view model of its own: New with a change asked for, New
 * with no saved profile, New from a field-app photo, Quoted, Approved, In the
 * shop bending, In the shop finished, and Delivered. Each one is a different
 * right-hand pane over the same two left panes.
 *
 * FIXTURE ONLY. The live Job screen keeps `JobActionPanel`, which actually
 * sends a quote, actually records a phone approval and actually opens the one
 * door to the machine (CLAUDE.md rule #14). v7's version of the same pane has
 * a "Pretend Mike clicked Approve" button in it. Rule #33's split applies
 * exactly: the behaviour stays, and this gives the gate v7's layout to measure.
 */
import {
  V7_LEN,
  V7_TRICIA,
  cents,
  colorOf,
  dayLabel,
  itemLabel,
  jid,
  jobBy,
  jobDims,
  jobHi,
  jobSt,
  num,
  pieces,
  pState,
  profBy,
  profKnown,
  totals,
  v7Fixture,
  type V7Job,
} from '@/lib/fixtures/command-center-v7';
import { V7_NAMES, bendTxt, dimTxt, fmtIn, segsOf } from '@/lib/design/v7-draw';
import type { V7Button, V7DrawingRef, V7SpecChip } from './types';

export interface V7JobReadRow {
  k: string;
  v: string;
  /** v7's `.sure` column: "Sure", "Check", or a button. */
  sure: string;
  unsure: boolean;
  /** The amber "Confirm" control on an unread colour. */
  button: V7Button | null;
}

export interface V7JobStepRow {
  label: string;
  /** '' | 'done' | 'cur' */
  state: string;
}

export interface V7JobProfileRow {
  label: string;
  hem: boolean;
  length: string;
  angle: string;
  changed: boolean;
}

/** v7's `.pstrip` above the spec list — one of four, by profile state. */
export interface V7ProfileStrip {
  tone: 'green' | 'amber' | 'blue' | 'red';
  title: string;
  body: string;
  /** v7 bolds the computed "Top 3" -> 3 1/4"" line inside the amber strip. */
  emphasis: string | null;
  extra: string | null;
  button: V7Button;
}

/** v7's `.chk` rows — a tick, a dot or a warning, with a line and a small line. */
export interface V7CheckRow {
  mark: 'tick' | 'wait' | 'warn';
  text: string;
  small: string | null;
}

export interface V7JobView {
  customer: string;
  kindLower: string;
  sub: string;
  steps: V7JobStepRow[];

  request: {
    tag: string;
    from: string;
    company: string;
    body: string;
    attachment: string | null;
    sourceHref: string | null;
    readTitle: string;
    rows: V7JobReadRow[];
    note: string | null;
  };

  profile: {
    tag: string;
    drawing: V7DrawingRef;
    strip: V7ProfileStrip;
    spec: { term: string; value: string; chip?: V7SpecChip; colorNote?: string }[];
    rows: V7JobProfileRow[];
    pastTitle: string;
    past: { key: string; drawing: V7DrawingRef; label: string; href: string }[];
    pastEmpty: string;
  };

  stage: V7JobStagePane;
}

export type V7JobStagePane =
  | {
      kind: 'quote';
      heading: string;
      tag: string;
      itemName: string;
      spec: V7SpecChip;
      qty: string;
      unit: string;
      lineText: string;
      engine: { missing: string[]; buttons: V7Button[] };
      totals: { sub: string; tax: string; taxPct: string; tot: string };
      mail: { to: string; subject: string; greeting: string };
      actions: V7Button[];
      note: string;
    }
  | {
      kind: 'status';
      heading: string;
      tag: { tone: string; text: string };
      /** v7's `.wait` or `.big-note` lead paragraph. */
      lead: { beacon: boolean; html: string } | null;
      checks: V7CheckRow[];
      recon: { est: string; final: string; diff: string; why: string | null } | null;
      actions: V7Button[];
      note: string | null;
      /** v7's violet "For this review only" box. Fixture only, by definition. */
      demo: { text: string; button: V7Button } | null;
      notes: { who: string; t: string; txt: string }[] | null;
      notesTitle: string;
    };

function chip(spec: string): V7SpecChip {
  const c = colorOf(spec);
  return { hex: c[1], colorName: c[0], spec };
}

/** v7 `chgLine()` (line 1407) — "Top 3" → 3 1/4" (+1/4")". */
function chgLine(f: ReturnType<typeof v7Fixture>, j: V7Job): string {
  const p = j.pid ? profBy(f.profiles, j.pid) : null;
  if (!p || !j.chg) return '';
  const sg = segsOf(j.kind, p.d)[j.chg.seg];
  if (!sg) return '';
  return `${sg[0]} ${fmtIn(sg[1])} → ${fmtIn(sg[1] + j.chg.delta)} (${j.chg.delta > 0 ? '+' : '−'}${fmtIn(Math.abs(j.chg.delta))})`;
}

/** v7 `mailBody()` (line 1305). */
function mailBody(j: V7Job): string {
  if (j.mailBody) return j.mailBody;
  if (j.n === 412) {
    return 'Hey Steve, need 40 more of the drip edge we got last month, same charcoal color, 24 gauge, 10 ft lengths. Make the top leg a little wider than last time, about a quarter inch. Can you get them to the Dripping Springs job by Friday?';
  }
  return `Hi Steve, can you run ${j.qty} ${V7_NAMES[j.kind].toLowerCase()} in ${j.spec}, 10 ft lengths? We need them by next Wednesday. Drawing attached.`;
}

/** v7 `profStrip()` (line 1410). */
function profileStrip(f: ReturnType<typeof v7Fixture>, j: V7Job): V7ProfileStrip {
  const s = pState(j);
  const p = j.pid ? profBy(f.profiles, j.pid) : null;
  const mk = profKnown(f.profiles, j);
  const firstMat = p && !mk ? `First time this profile is made in ${j.spec}.` : null;

  if (s === 'reuse' && p) {
    return {
      tone: 'green',
      title: `Using a past profile: ${j.cust}, profile #${p.id}`,
      body:
        (mk ? `Last made in ${mk.spec} on ${mk.last}, ${mk.orders} order${mk.orders === 1 ? '' : 's'}. ` : '') +
        'No changes asked for. This order matches the saved drawing exactly.',
      emphasis: null,
      extra: firstMat,
      button: { tone: 'line', size: 'sm', label: 'Open in FlashDraft', href: '/studio/draft' },
    };
  }
  if (s === 'change' && p && j.chg) {
    return {
      tone: 'amber',
      title: `Past profile #${p.id} with a change asked for`,
      body: `${j.chg.text}.`,
      emphasis: chgLine(f, j),
      extra: `${firstMat ?? ''}The drawing below shows the requested version. It is not saved in FlashDraft yet.`,
      button: { tone: 'amber', size: '', label: 'Open FlashDraft to make this change', href: '/studio/draft' },
    };
  }
  if (s === 'newver' && p) {
    return {
      tone: 'blue',
      title: `New version saved: profile #${p.id} (version ${p.ver})`,
      body: `Made from profile #${p.parent}. The requested change is in the saved drawing.`,
      emphasis: null,
      extra: null,
      button: { tone: 'line', size: 'sm', label: 'Open in FlashDraft', href: '/studio/draft' },
    };
  }
  return {
    tone: 'red',
    title: 'No saved profile for this order',
    body: "This is the parser's reading of the customer's sketch. Draw it once in FlashDraft and it is saved for every future order.",
    emphasis: null,
    extra: null,
    button: { tone: 'red', size: '', label: 'Draw it in FlashDraft', href: '/studio/draft' },
  };
}

/** v7 `readRows()` (line 1308). */
function readRows(j: V7Job): V7JobReadRow[] {
  const color = j.n === 412 && !j.colorOk;
  const rows: V7JobReadRow[] = [
    {
      k: 'Profile',
      v: `${V7_NAMES[j.kind]}${j.pid ? `, matched to saved profile #${j.pid}` : ', no saved match'}`,
      sure: 'Sure',
      unsure: false,
      button: null,
    },
    { k: 'Quantity', v: String(j.qty), sure: 'Sure', unsure: false, button: null },
    { k: 'Length', v: V7_LEN, sure: 'Sure', unsure: false, button: null },
  ];
  if (j.chg) rows.push({ k: 'Change', v: j.chg.text, sure: 'Check', unsure: true, button: null });
  if (color) {
    rows.push({
      k: 'Color',
      v: 'Charcoal Kynar, please confirm',
      sure: '',
      unsure: true,
      button: { tone: 'amber', size: 'sm', label: 'Confirm', action: 'confirmColor' },
    });
  } else {
    rows.push({
      k: 'Material',
      v: `${j.spec}${j.n === 412 ? ' (you confirmed)' : ''}`,
      sure: 'Sure',
      unsure: false,
      button: null,
    });
  }
  rows.push({
    k: 'Needed by',
    v: j.n === 412 ? 'Friday, Dripping Springs job' : 'Next Wednesday',
    sure: 'Sure',
    unsure: false,
    button: null,
  });
  return rows;
}

const STEP_ORDER = ['new', 'quoted', 'approved', 'shop', 'done'] as const;
const STEP_LABEL: Record<string, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Done',
};

/** v7 `stagePane()` (line 1357) — five different right-hand panes. */
function stagePane(f: ReturnType<typeof v7Fixture>, j: V7Job): V7JobStagePane {
  const t = totals(j);
  const tot = t.has ? cents(t.tot) : 'the quoted total';
  const first = j.person;

  if (j.lane === 'new') {
    return {
      kind: 'quote',
      heading: 'The quote',
      tag: 'Draft',
      itemName: V7_NAMES[j.kind],
      spec: chip(j.spec),
      qty: String(j.qty),
      unit: j.unit,
      lineText: t.has ? cents(t.sub) : 'Needs a price',
      // v7's engine box with nothing filled in: it names what it is waiting for
      // and offers the two ways to supply it.
      engine: {
        missing: [`sheet cost for ${j.spec}`, 'rate per bend', 'markup %'],
        buttons: [
          { tone: 'violet', size: 'sm', label: 'Open the pricing engine', href: '/admin/pricing' },
          { tone: 'slate', size: 'sm', label: 'Fill example numbers (demo)', href: '/admin/pricing?example=1' },
        ],
      },
      totals: {
        sub: t.has ? cents(t.sub) : '—',
        tax: t.has ? cents(t.tax) : '—',
        taxPct: '8.25',
        tot: t.has ? cents(t.tot) : '—',
      },
      mail: {
        to: `${j.person}, ${j.cust}`,
        subject: `Your quote for ${j.qty} ${pieces(j.qty)} of ${V7_NAMES[j.kind].toLowerCase()}`,
        greeting: `Hi ${j.person}, your quote is attached. Click Approve and we will get it into production.`,
      },
      actions: [
        { tone: 'red', size: '', label: 'Send quote', action: 'sendQuote' },
        { tone: 'slate', size: '', label: 'Preview quote document', action: 'docq' },
      ],
      note: 'Prices never come from the AI. They come from the pricing engine or from you.',
    };
  }

  if (j.lane === 'quoted') {
    return {
      kind: 'status',
      heading: 'Waiting on the customer',
      tag: { tone: 'amber', text: 'Quoted' },
      lead: {
        beacon: false,
        html: `${j.rev > 1 ? `Revised quote v${j.rev}` : 'Quote'} emailed ${j.quoteAt || 'just now'}.|Waiting for ${first} to click Approve. Total ${tot}.`,
      },
      checks: [
        {
          mark: 'tick',
          text: 'Estimate copy emailed to Tricia',
          small: `Shows in her pending-approval folder · ${V7_TRICIA}`,
        },
      ],
      recon: null,
      actions: [
        { tone: 'amber', size: '', label: 'Follow up', action: 'follow' },
        { tone: 'slate', size: '', label: 'View quote', action: 'docq' },
        { tone: 'line', size: '', label: 'Approved by phone', action: 'phoneOk' },
        { tone: 'line', size: '', label: 'Customer changed something', action: 'chg1' },
      ],
      note: 'Follow up writes the email for you. You read it and press send. If the customer changes the order before approving, the revised quote replaces this one.',
      demo: {
        text: 'For this review only. In the real system the customer clicks Approve inside their email. Press this to see what happens next.',
        button: { tone: 'violet', size: 'sm', label: `Pretend ${first} clicked Approve`, action: 'simApprove' },
      },
      notes: null,
      notesTitle: '',
    };
  }

  if (j.lane === 'approved') {
    return {
      kind: 'status',
      heading: 'Ready for the machine',
      tag: { tone: 'green', text: 'Approved' },
      lead: { beacon: true, html: `${first} approved the quote ${j.apAt}.` },
      checks: [
        { mark: 'tick', text: 'Customer approved the quote', small: `${j.apAt} · ${tot}` },
        { mark: 'tick', text: "Tricia's estimate moved from pending to approved", small: V7_TRICIA },
        {
          mark: 'wait',
          text: `The invoice is created and emailed to ${first} when the shop marks the job finished`,
          small: null,
        },
      ],
      recon: null,
      actions: [
        { tone: 'green', size: 'lg', label: 'Send to machine', action: 'machine' },
        { tone: 'slate', size: '', label: 'View quote', action: 'docq' },
        { tone: 'line', size: '', label: 'Customer changed something', action: 'chg1' },
      ],
      note: 'Goes to the Thalmann only when you press the button. Until then a change is simple: re-quote, the customer re-approves, and the job comes back here.',
      demo: null,
      notes: null,
      notesTitle: '',
    };
  }

  if (j.lane === 'shop') {
    const pos = [398, 401].indexOf(j.n) + 1;
    const st = j.shop === 'bending' ? 'bending now' : j.shop === 'finished' ? 'finished' : 'waiting in the queue';
    const checks: V7CheckRow[] = [];
    checks.push(
      j.day
        ? { mark: 'tick', text: 'Delivery scheduled', small: `${dayLabel(j.day)}, ${j.win}` }
        : {
            mark: 'warn',
            text: 'No delivery date yet',
            small: 'It is set automatically when the shop marks this finished, or pick a day now.',
          },
    );
    checks.push(
      j.inv
        ? {
            mark: 'tick',
            text: `Invoice #${j.inv.no} emailed to ${first} at ${j.inv.at}`,
            small: 'Final invoice and reconciliation went to Tricia at the same time',
          }
        : {
            mark: 'wait',
            text: `Invoice goes to ${first} when the shop marks it finished`,
            small: 'Tricia gets the final invoice with a reconciliation at the same moment',
          },
    );
    const actions: V7Button[] = [
      { tone: 'amber', size: '', label: j.day ? 'Change delivery' : 'Schedule delivery', action: 'sched' },
      { tone: 'violet', size: '', label: 'Open in Shop View', href: '/admin/shop-view' },
      { tone: 'slate', size: '', label: j.inv ? 'View invoice' : 'Preview invoice', action: 'doci' },
    ];
    if (j.shop !== 'finished') actions.push({ tone: 'line', size: '', label: 'Add an addendum', action: 'chg2' });

    return {
      kind: 'status',
      heading: 'At the Thalmann',
      tag: { tone: 'violet', text: 'In the shop' },
      lead: {
        beacon: false,
        html: `Sent to the machine as profile #${j.prof}.|${pos ? `Position ${pos} in the queue. ` : ''}Status: ${st}.`,
      },
      checks,
      recon: j.recon
        ? {
            est: cents(j.recon.est),
            final: cents(j.recon.final),
            diff: j.recon.diff === 0 ? 'None' : `${j.recon.diff > 0 ? '+' : '−'}${cents(Math.abs(j.recon.diff))}`,
            why: j.recon.why || null,
          }
        : null,
      actions,
      note:
        j.shop === 'finished'
          ? null
          : 'The job has started, so the approved order stays as it is. A change becomes an addendum on the same job: the customer approves it, the shop sees it, and it is its own line on the invoice.',
      demo: null,
      notes: j.notes,
      notesTitle: 'Notes for the operator',
    };
  }

  return {
    kind: 'status',
    heading: 'Delivered',
    tag: { tone: '', text: 'Done' },
    lead: null,
    checks: [
      { mark: 'tick', text: 'Delivered', small: j.doneAt },
      {
        mark: 'tick',
        text: `Invoice #${j.inv ? j.inv.no : ''} emailed to ${first}`,
        small: 'Final invoice with reconciliation sent to Tricia',
      },
    ],
    recon: j.recon
      ? {
          est: cents(j.recon.est),
          final: cents(j.recon.final),
          diff: j.recon.diff === 0 ? 'None' : `${j.recon.diff > 0 ? '+' : '−'}${cents(Math.abs(j.recon.diff))}`,
          why: j.recon.why || null,
        }
      : null,
    actions: [
      { tone: 'blue', size: '', label: 'Start a reorder', action: 'reorder' },
      { tone: 'slate', size: '', label: 'View invoice', action: 'doci' },
    ],
    note: 'A reorder starts a new job with the same profile, material and quantity.',
    demo: null,
    notes: null,
    notesTitle: '',
  };
}

export function fixtureJob(jobNumber: number): V7JobView | null {
  const f = v7Fixture();
  const j = jobBy(f.jobs, jobNumber);
  if (!j) return null;

  const st = jobSt(f.jobs, f.profiles, j);
  const d = jobDims(f.jobs, f.profiles, j);
  const hi = jobHi(j);
  const cur = STEP_ORDER.indexOf(j.lane);

  const past = f.profiles
    .filter((p) => p.cust === j.cust && p.id !== j.pid)
    .map((p) => ({
      key: String(p.id),
      drawing: { kind: p.kind, d: p.d, hi: [], paint: p.paint } as V7DrawingRef,
      label: `${V7_NAMES[p.kind]} ${dimTxt(p.kind, p.d)}`,
      href: `/admin/search?pid=${p.id}&fixture=v7`,
    }));

  const isEmail = j.src === 'Email';
  const from =
    j.src === 'FlashDraft'
      ? `${j.person} saved this drawing in FlashDraft and asked for a quote.`
      : j.src === 'Field app'
        ? `${j.cust}'s crew sent this from the field app.`
        : j.src === 'Reorder'
          ? 'You started this as a reorder of a past job.'
          : j.src === 'Desk'
            ? 'You started this at the desk from New quote.'
            : 'You started this from a saved profile in Search.';

  const nonEmailRows: V7JobReadRow[] = [
    { k: 'Profile', v: V7_NAMES[j.kind], sure: '', unsure: false, button: null },
    { k: 'Quantity', v: String(j.qty), sure: '', unsure: false, button: null },
    { k: 'Material', v: j.spec, sure: '', unsure: false, button: null },
    { k: 'Length', v: V7_LEN, sure: '', unsure: false, button: null },
  ];
  if (j.chg) nonEmailRows.push({ k: 'Change', v: j.chg.text, sure: '', unsure: true, button: null });

  return {
    customer: j.cust,
    kindLower: V7_NAMES[j.kind].toLowerCase(),
    sub: `${V7_NAMES[j.kind]} · ${j.spec} · ${j.qty} ${pieces(j.qty)} · Job ${jid(j.n)}`,
    steps: STEP_ORDER.map((k, i) => ({
      label: STEP_LABEL[k],
      state: i < cur ? 'done' : i === cur ? 'cur' : '',
    })),

    request: {
      tag: isEmail
        ? `Email · ${j.recv.replace(/^[A-Za-z]+, /, '')}`
        : `${j.src} · ${j.lane === 'new' ? j.age : 'received'}`,
      from: j.person,
      company: j.cust,
      body: isEmail ? mailBody(j) : from,
      attachment: isEmail ? (j.att || `${V7_NAMES[j.kind].toLowerCase().replace(/ /g, '-')}-sketch.pdf`) : null,
      sourceHref: isEmail ? `/admin/command-center/job/${j.n}/source?fixture=v7` : null,
      readTitle: isEmail ? 'What the parser read' : 'What was asked for',
      rows: isEmail ? readRows(j) : nonEmailRows,
      note: isEmail
        ? 'Highlighted lines are ones it is less sure about. Check them before sending.'
        : null,
    },

    profile: {
      tag: j.pid ? 'Saved in FlashDraft' : 'From sketch',
      drawing: { kind: j.kind, d, hi, paint: j.paint },
      strip: profileStrip(f, j),
      spec: [
        { term: 'Item', value: itemLabel(j) },
        { term: 'Material', value: '', chip: chip(j.spec) },
        { term: 'Color', value: '', chip: chip(j.spec), colorNote: colorOf(j.spec)[2] },
        { term: 'Length', value: V7_LEN },
        { term: 'Bends', value: bendTxt(st) },
        { term: 'Developed', value: `${fmtIn(st.dev)} wide` },
        { term: 'Painted side', value: j.paint },
      ],
      rows: st.sg.map((s, i) => ({
        label: s[0],
        hem: Boolean(s[3]),
        length: fmtIn(s[1]),
        angle: i < st.ang.length && st.ang[i] != null ? `${st.ang[i]}°` : '—',
        changed: hi.indexOf(i) >= 0,
      })),
      pastTitle: `${j.cust}${j.pid ? "'s other profiles" : "'s saved profiles"}`,
      past,
      pastEmpty: 'No other saved profiles.',
    },

    stage: stagePane(f, j),
  };
}

export { num };
