/**
 * V7'S DEMO DATA, TRANSLITERATED — the fixture the pixel gate renders against.
 *
 * WHY A FIXTURE EXISTS AT ALL. The whole-screen pixel gate
 * (tests/visual/v7-pixel-gate.spec.ts) diffs the live app against the untouched
 * prototype. If the two sides show different CONTENT — a different customer
 * name, eleven rows instead of sixteen, a blank lane where v7 has four cards —
 * then every screen differs for reasons that are nobody's design decision, the
 * numbers are meaningless, and the only way to make them pass is to raise the
 * threshold until the gate asserts nothing. That is exactly how the previous
 * 66-pair computed-style gate ended up passing screens the owner says do not
 * match.
 *
 * So fixture mode makes the content identical and lets the diff measure
 * FIDELITY ONLY: layout, order, spacing, type, colour, proportion.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IT CANNOT REACH PRODUCTION, AND THAT IS ENFORCED THREE WAYS AT ONCE.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `isFixtureMode()` in lib/fixtures/mode.ts requires ALL THREE of:
 *
 *   1. `process.env.CC_FIXTURE === '1'`   — absent from Vercel, present in
 *                                           .env.local and .env.example only.
 *   2. `process.env.NODE_ENV !== 'production'`
 *   3. the request URL carrying `?fixture=v7`
 *
 * Any one missing and every screen reads live data. `lib/fixtures/mode.test.ts`
 * asserts each of the three independently, including the case where the env var
 * is set in a production build — because that is the only combination that
 * could ever happen by accident, and it is the one that must still refuse.
 *
 * The numbers, names and addresses below are the PROTOTYPE'S OWN SAMPLE DATA.
 * v7 says so on its own banner ("Customers, prices and numbers are samples").
 * Nothing here is a real AFS customer, a real price or a real job.
 */
import { V7_NAMES, dimTxt, segsOf, stats, type V7Stats } from '@/lib/design/v7-draw';

/** v7's frozen clock: `new Date(2026, 9, 1, 10, 30)`. Thu 1 Oct 2026, 10:30. */
export const V7_NOW = new Date(2026, 9, 1, 10, 30).getTime();

/** v7 `CUSTS` — [company, contact first name]. */
export const V7_CUSTS: [string, string][] = [
  ['Hill Country Roofing', 'Mike'],
  ['Martinez Builders', 'Carla'],
  ['Round Rock Roofing', 'Dan'],
  ['Georgetown Siding Co.', 'Priya'],
  ['Cedar Park Contractors', 'Marcus'],
  ['Pflugerville Metal Works', 'Ellie'],
  ['Lakeway Custom Homes', 'Tom'],
  ['Bluebonnet Exteriors', 'Sam'],
  ['Ortega Roofing', 'Luis'],
  ['Liberty Hill Homes', 'Grace'],
  ['Hutto Metal Roofing', 'Ray'],
];

export function personOf(company: string): string {
  const hit = V7_CUSTS.find((c) => c[0] === company);
  return hit ? hit[1] : '';
}

export function emailOf(company: string): string {
  return `${personOf(company).toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.example`;
}

/** v7 `jid()` — the job number as a customer-facing id. */
export function jid(n: number): string {
  return `AFS-2026-0${n}`;
}

/** v7 `LEN` — every sample job is 10 ft stock. */
export const V7_LEN = '10 ft 0 in';

/** v7 `TRICIA`. The spelling is `trica@` — see CLAUDE.md rule #21. */
export const V7_TRICIA = 'trica@architecturalflashingsupply.com';

export interface V7Material {
  spec: string;
  first: string;
  last: string;
  orders: number;
  pcs: number;
}

export interface V7Profile {
  id: number;
  kind: string;
  cust: string;
  person: string;
  /** Per-segment lengths, overriding the definition's defaults. */
  d: number[];
  paint: string;
  mats: V7Material[];
  ver: number;
  parent: number;
}

function M(spec: string, first: string, last: string, orders: number, pcs: number): V7Material {
  return { spec, first, last, orders, pcs };
}

/** v7 `seedProfiles()` — the sixteen saved profiles. */
export function v7Profiles(): V7Profile[] {
  const L: [number, string, string, number[], V7Material[]][] = [
    [1, 'drip', 'Hill Country Roofing', [3, 2, 0.5], [
      M('24 ga Charcoal Kynar', 'Mar 4', 'Aug 28', 3, 120),
      M('24 ga Galvalume', 'Jun 14', 'Jun 14', 1, 30),
      M('26 ga Galvalume', 'May 2', 'May 2', 1, 20),
    ]],
    [2, 'coping', 'Martinez Builders', [1, 4, 8, 4, 1], [M('24 ga Sandstone Kynar', 'Sep 30', 'Sep 30', 1, 12)]],
    [3, 'snap', 'Round Rock Roofing', [0.5, 2, 6, 2, 0.5], [M('24 ga Galvalume', 'Sep 29', 'Sep 29', 1, 24)]],
    [4, 'jch', 'Georgetown Siding Co.', [2.5, 2, 0.75], [
      M('24 ga White Kynar', 'Apr 10', 'Sep 28', 5, 260),
      M('26 ga Galvalume', 'Jul 7', 'Jul 7', 1, 40),
    ]],
    [5, 'gravel', 'Cedar Park Contractors', [3, 4, 4, 1], [M('0.040 in Anodized Aluminum', 'Aug 3', 'Sep 25', 2, 60)]],
    [6, 'fascia', 'Pflugerville Metal Works', [5, 6, 1], [M('24 ga Bronze Kynar', 'Sep 22', 'Sep 22', 1, 18)]],
    [7, 'valley', 'Lakeway Custom Homes', [5, 1.5, 5], [M('Copper 16 oz', 'Sep 18', 'Sep 18', 1, 20)]],
    [8, 'z', 'Bluebonnet Exteriors', [2, 4, 3], [
      M('26 ga Galvalume', 'Jun 2', 'Sep 12', 4, 210),
      M('24 ga White Kynar', 'Aug 19', 'Aug 19', 1, 60),
    ]],
    [9, 'counter', 'Ortega Roofing', [2, 2.5, 3.5, 3], [M('26 ga Galvalume', 'Sep 9', 'Sep 9', 1, 25)]],
    [10, 'counter', 'Hill Country Roofing', [1.5, 2, 3, 2.5], [M('26 ga Galvalume', 'Jun 14', 'Jun 14', 1, 30)]],
    [11, 'jch', 'Hill Country Roofing', [2, 2.5, 1], [M('24 ga White Kynar', 'Apr 22', 'Apr 22', 1, 50)]],
    [12, 'drip', 'Round Rock Roofing', [2.5, 2, 0.5], [
      M('24 ga Galvalume', 'Aug 9', 'Aug 9', 2, 70),
      M('26 ga Galvalume', 'Jul 1', 'Jul 1', 1, 30),
    ]],
    [13, 'z', 'Georgetown Siding Co.', [1.5, 4, 2], [M('24 ga White Kynar', 'Aug 30', 'Aug 30', 1, 30)]],
    [14, 'fascia', 'Cedar Park Contractors', [4, 5, 1], [
      M('0.040 in Anodized Aluminum', 'Jul 30', 'Jul 30', 1, 40),
      M('24 ga Galvalume', 'May 12', 'May 12', 1, 24),
    ]],
    [15, 'drip', 'Hutto Metal Roofing', [3, 2.5, 0.5], [M('26 ga Galvalume', 'Jun 9', 'Oct 1', 2, 60)]],
    [16, 'drip', 'Liberty Hill Homes', [3.5, 2, 0.5], [M('26 ga Galvalume', 'Aug 4', 'Sep 29', 2, 80)]],
  ];
  return L.map((r) => ({
    id: r[0],
    kind: r[1],
    cust: r[2],
    person: personOf(r[2]),
    d: r[3],
    paint: 'Up',
    mats: r[4],
    ver: 1,
    parent: 0,
  }));
}

export interface V7Day {
  k: string;
  label: string;
  sub: string;
}

/** v7 `DAYS`. */
export const V7_DAYS: V7Day[] = [
  { k: 'thu', label: 'Thu, Oct 1', sub: 'Today' },
  { k: 'fri', label: 'Fri, Oct 2', sub: 'Tomorrow' },
  { k: 'mon', label: 'Mon, Oct 5', sub: '' },
  { k: 'tue', label: 'Tue, Oct 6', sub: '' },
  { k: 'wed', label: 'Wed, Oct 7', sub: '' },
];

/**
 * v7 `WINS` — the four delivery windows, AS v7 LABELS THEM.
 *
 * These are v7's en-dash LABELS, not the app's keys. CLAUDE.md rule #24 keeps
 * the keys `'08-10'`…`'15-17'` in `lib/delivery/windows.ts` and the English
 * beside them; nothing here is a key and nothing here reaches a database.
 */
export const V7_WINS = ['8–10 AM', '10 AM–12 PM', '1–3 PM', '3–5 PM'];

/** v7 `COLORS` — the FlashDraft colour library, name + hex + range note. */
export const V7_COLORS: Record<string, [string, string, string]> = {
  '24 ga Charcoal Kynar': ['Charcoal', '#475B65', 'PAC-CLAD standard'],
  '24 ga Sandstone Kynar': ['Sandstone', '#E1DBC9', 'PAC-CLAD standard'],
  '24 ga White Kynar': ['Bone White', '#F4F3EC', 'PAC-CLAD standard'],
  '24 ga Bronze Kynar': ['Medium Bronze', '#675B43', 'PAC-CLAD standard'],
  '24 ga Galvalume': ['Galvalume Plus', '#B6B6B6', 'PAC-CLAD standard'],
  '26 ga Galvalume': ['Galvalume Plus', '#B6B6B6', 'PAC-CLAD standard'],
  '0.040 in Anodized Aluminum': ['Clear Satin', '#D1D3CD', 'PAC-CLAD anodized'],
  'Copper 16 oz': ['Mill finish', '#B87333', 'Uncoated copper'],
};

export function colorOf(spec: string): [string, string, string] {
  return V7_COLORS[spec] || ['', '#999999', ''];
}

export type V7Lane = 'new' | 'quoted' | 'approved' | 'shop' | 'done';

export interface V7Note {
  who: string;
  t: string;
  txt: string;
}

export interface V7Change {
  seg: number;
  delta: number;
  text: string;
}

export interface V7Invoice {
  no: number;
  sent: boolean;
  at?: string;
}

export interface V7Recon {
  est: number;
  final: number;
  diff: number;
  why: string;
}

export interface V7Addendum {
  no: string;
  text: string;
  qty: string;
  unit: string;
  st: 'ok' | 'wait';
  when: string;
}

export interface V7Job {
  n: number;
  cust: string;
  person: string;
  kind: string;
  pid: number;
  qty: number | string;
  spec: string;
  src: string;
  lane: V7Lane;
  paint: string;
  unit: string;
  shop: string;
  day: string | null;
  win: string;
  warn: boolean;
  onBoard: boolean;
  colorOk: boolean;
  age: string;
  noteQ: string;
  apAt: string;
  doneAt: string;
  quoteAt: string;
  recv: string;
  prof: number;
  notes: V7Note[];
  chg: V7Change | null;
  chgDone: boolean;
  inv: V7Invoice | null;
  sketchD: number[] | null;
  ts: number;
  rev: number;
  revs: { rev: number; old: number; nw: number; note: string; when: string }[];
  adds: V7Addendum[];
  est: { tot: number; at: string; rev: number } | null;
  recon: V7Recon | null;
  att?: string;
  mailBody?: string;
}

/** v7 `DT` — each job's arrival timestamp, as [month, day, hour, minute]. */
const V7_DT: Record<number, [number, number, number, number]> = {
  412: [10, 1, 7, 52],
  413: [10, 1, 4, 30],
  414: [9, 30, 15, 0],
  409: [9, 30, 10, 2],
  395: [9, 27, 14, 15],
  405: [10, 1, 10, 10],
  408: [10, 1, 9, 30],
  398: [9, 29, 15, 0],
  401: [9, 28, 16, 10],
  402: [9, 30, 13, 0],
  399: [9, 29, 11, 0],
  371: [8, 28, 9, 0],
};

type JobSeed = Partial<V7Job> & { n: number; cust: string; kind: string; lane: V7Lane };

function J(o: JobSeed): V7Job {
  return {
    pid: 0,
    paint: 'Up',
    unit: '',
    shop: '',
    day: null,
    win: '',
    warn: false,
    onBoard: true,
    colorOk: false,
    age: '',
    noteQ: '',
    apAt: '',
    doneAt: '',
    quoteAt: '',
    recv: 'Thu, Oct 1, 7:52 AM',
    prof: 0,
    notes: [],
    chg: null,
    chgDone: false,
    inv: null,
    sketchD: null,
    ts: 0,
    rev: 1,
    revs: [],
    adds: [],
    est: null,
    recon: null,
    qty: 0,
    spec: '',
    src: 'Email',
    ...o,
    person: personOf(o.cust),
  } as V7Job;
}

export function num(v: unknown): number {
  const x = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(x) ? 0 : x;
}

/** v7 `cents()` — integer cents to `$1,234.56`. */
export function cents(c: number): string {
  return `$${(c / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** v7 `money()` — a float dollar amount, through the same formatter. */
export function money(n: number): string {
  return cents(Math.round(n * 100));
}

/** v7's sales-tax rate. `S.eng.tax` defaults to '8.25' and the fixture never edits it. */
export const V7_TAX_RATE = 0.0825;

export function pieces(q: unknown): string {
  return Math.floor(num(q)) === 1 ? 'piece' : 'pieces';
}

/** v7 `jobs` — the twelve seeded jobs, in seed order. */
export function v7Jobs(): V7Job[] {
  const jobs: V7Job[] = [
    J({ n: 412, cust: 'Hill Country Roofing', kind: 'drip', pid: 1, qty: 40, spec: '24 ga Charcoal Kynar', src: 'Email', lane: 'new', age: '2 hours ago', chg: { seg: 0, delta: 0.25, text: 'Make the top leg a little wider than last time' } }),
    J({ n: 413, cust: 'Martinez Builders', kind: 'coping', pid: 0, qty: 12, spec: '24 ga Sandstone Kynar', src: 'Field app', lane: 'new', age: '5 hours ago' }),
    J({ n: 414, cust: 'Ortega Roofing', kind: 'counter', pid: 0, qty: 25, spec: '26 ga Galvalume', src: 'Field app', lane: 'new', age: 'Yesterday' }),
    J({ n: 409, cust: 'Lakeway Custom Homes', kind: 'valley', pid: 7, qty: 20, spec: 'Copper 16 oz', src: 'Email', lane: 'quoted', unit: '38.50', noteQ: 'Quote sent 1 day ago', quoteAt: 'Wed 10:02 AM' }),
    J({ n: 395, cust: 'Bluebonnet Exteriors', kind: 'z', pid: 8, qty: 60, spec: '26 ga Galvalume', src: 'FlashDraft', lane: 'quoted', unit: '4.90', noteQ: 'Sent 4 days ago, no reply yet', warn: true, quoteAt: 'Sun 2:15 PM' }),
    J({ n: 405, cust: 'Cedar Park Contractors', kind: 'gravel', pid: 5, qty: 30, spec: '0.040 in Anodized Aluminum', src: 'Email', lane: 'approved', unit: '11.25', apAt: '20 minutes ago' }),
    J({ n: 408, cust: 'Pflugerville Metal Works', kind: 'fascia', pid: 6, qty: 18, spec: '24 ga Bronze Kynar', src: 'Email', lane: 'approved', unit: '14.10', apAt: '1 hour ago' }),
    J({ n: 398, cust: 'Round Rock Roofing', kind: 'snap', pid: 3, qty: 24, spec: '24 ga Galvalume', src: 'FlashDraft', lane: 'shop', shop: 'bending', unit: '9.40', prof: 32960114, day: 'fri', win: '8–10 AM', notes: [{ who: 'Steve', t: '7:40 AM', txt: 'Hems stay open, do not close them. Customer is picky about scratches, run it film side up.' }] }),
    J({ n: 401, cust: 'Georgetown Siding Co.', kind: 'jch', pid: 4, qty: 50, spec: '24 ga White Kynar', src: 'Email', lane: 'shop', shop: 'queued', unit: '5.20', prof: 32960121, notes: [{ who: 'Steve', t: 'Yesterday 4:10 PM', txt: 'Check the first piece against the field cut sheet before you run all 50.' }] }),
    J({ n: 402, cust: 'Hutto Metal Roofing', kind: 'drip', pid: 15, qty: 30, spec: '26 ga Galvalume', src: 'Email', lane: 'shop', shop: 'finished', unit: '6.30', prof: 32960109, day: 'thu', win: '1–3 PM', inv: { no: 4515, sent: true, at: '7:12 AM' } }),
    J({ n: 399, cust: 'Liberty Hill Homes', kind: 'drip', pid: 16, qty: 40, spec: '26 ga Galvalume', src: 'Email', lane: 'done', unit: '6.10', doneAt: 'Tue, Sep 29', prof: 32960098, inv: { no: 4512, sent: true, at: 'Sep 29' } }),
    J({ n: 371, cust: 'Hill Country Roofing', kind: 'drip', pid: 1, qty: 40, spec: '24 ga Charcoal Kynar', src: 'Email', lane: 'done', unit: '6.85', doneAt: 'Aug 28', onBoard: false, prof: 32960012, inv: { no: 4398, sent: true, at: 'Aug 28' } }),
  ];
  // v7 `finishSeed()`: stamp the arrival time and the estimate every non-New job
  // carries, so the Job screen's reconciliation has something to reconcile.
  jobs.forEach((j) => {
    const a = V7_DT[j.n];
    j.ts = a ? new Date(2026, a[0] - 1, a[1], a[2], a[3]).getTime() : V7_NOW;
    if (j.lane !== 'new') {
      const u = Math.round(num(j.unit) * 100);
      const q = Math.floor(num(j.qty));
      const sub = u * q;
      const tot = sub + Math.floor(sub * V7_TAX_RATE + 0.5 + 1e-9);
      j.est = { tot, at: j.quoteAt || 'earlier', rev: 1 };
      if (j.lane === 'done' || j.shop === 'finished') j.recon = { est: tot, final: tot, diff: 0, why: '' };
    }
  });
  return jobs;
}

export interface V7InboxMessage {
  id: number;
  who: string;
  co: string;
  subj: string;
  time: string;
  type: 'order' | 'reorder' | 'approval' | 'notice' | 'skip';
  st: 'new' | 'job' | 'done';
  job?: number;
  att: string;
  body?: string;
  make?: { kind: string; pid: number; qty: number; spec: string; sketchD?: number[] };
}

/** v7 `inbox` — the Outlook rail's six messages. */
export const V7_INBOX: V7InboxMessage[] = [
  { id: 1, who: 'Mike', co: 'Hill Country Roofing', subj: 'More drip edge', time: '7:52 AM', type: 'order', st: 'job', job: 412, att: 'drip-edge-sketch.pdf' },
  { id: 2, who: 'Priya', co: 'Georgetown Siding Co.', subj: 'J-channel again, 50 pcs', time: '8:31 AM', type: 'reorder', st: 'new', att: '', body: 'Hi Steve, same J-channel as last time please. 24 ga white, 10 ft lengths, 50 pieces. We can pick up next Wednesday.', make: { kind: 'jch', pid: 4, qty: 50, spec: '24 ga White Kynar' } },
  { id: 3, who: 'Grace', co: 'Liberty Hill Homes', subj: 'Valley flashing, see sketch', time: '9:05 AM', type: 'order', st: 'new', att: 'valley-sketch.pdf', body: 'Steve, we need 20 pieces of valley flashing in 16 oz copper, 10 ft lengths. Sketch attached. Dimensions are on the drawing.', make: { kind: 'valley', pid: 0, qty: 20, spec: 'Copper 16 oz', sketchD: [4.5, 1.5, 4.5] } },
  { id: 4, who: 'Sam', co: 'Bluebonnet Exteriors', subj: `RE: Quote ${jid(395)} approved`, time: '9:12 AM', type: 'approval', st: 'new', att: '', body: 'Looks good, go ahead and run the Z-closures. Sam', job: 395 },
  { id: 5, who: 'Accounts', co: 'Sample Coil Supply', subj: 'Price change notice effective Nov 1', time: '9:20 AM', type: 'notice', st: 'new', att: 'price-notice.pdf', body: 'Effective November 1, 2026, painted coil pricing will change. See attached notice for gauge and color detail.' },
  { id: 6, who: 'Events', co: 'Roofing Expo 2026', subj: 'Free exhibitor tickets', time: '9:41 AM', type: 'skip', st: 'new', att: '', body: 'Claim your free tickets to the regional roofing expo.' },
];

/** v7 `MTYPE` — inbox message type to [label, tag colour]. */
export const V7_MTYPE: Record<string, [string, string]> = {
  order: ['Order', 'blue'],
  reorder: ['Reorder', 'violet'],
  approval: ['Approval', 'green'],
  notice: ['Supplier notice', 'amber'],
  skip: ['Not an order', ''],
};

/** v7 `LANES`. */
export const V7_LANES: [V7Lane, string, string][] = [
  ['new', 'New', 'Needs a quote'],
  ['quoted', 'Quoted', 'Waiting on the customer'],
  ['approved', 'Approved', 'Ready for the machine'],
  ['shop', 'In the shop', 'At the Thalmann'],
  ['done', 'Done', 'Delivered'],
];

/** v7 `STATUS` / `PILLC` — lane to list-row status label and pill colour. */
export const V7_STATUS: Record<V7Lane, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Delivered',
};
export const V7_PILLC: Record<V7Lane, string> = { new: 'r', quoted: 'a', approved: 'g', shop: 'v', done: 'b' };

/** v7 `RANGES` / `SORTS` / `MATS` / `LSTAGES` — the filter-bar options, verbatim. */
export const V7_RANGES: [string, string][] = [
  ['all', 'Any time'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
  ['year', 'This year'],
];
export const V7_SORTS: [string, string][] = [
  ['new', 'Newest first'],
  ['old', 'Oldest first'],
  ['cust', 'Customer A to Z'],
  ['qty', 'Most pieces'],
  ['val', 'Highest value'],
];
export const V7_MATS = ['All materials', 'Galvalume', 'Kynar', 'Aluminum', 'Copper'];
export const V7_LSTAGES: Record<'quotes' | 'orders', [string, string][]> = {
  quotes: [
    ['all', 'Both stages'],
    ['new', 'Needs a quote'],
    ['quoted', 'Waiting on the customer'],
  ],
  orders: [
    ['all', 'All orders'],
    ['approved', 'Approved'],
    ['shop', 'In the shop'],
    ['done', 'Delivered'],
  ],
};

/** v7 `queue` / `fin` — the Thalmann queue order and today's finished list. */
export const V7_QUEUE = [398, 401];
export const V7_FIN = [402];

/** v7 `engBlank()` — the pricing engine's eight materials, with no cost set. */
export function v7EngMaterials(): { id: number; name: string; cost: string }[] {
  return [
    '24 ga Charcoal Kynar',
    '24 ga Sandstone Kynar',
    '24 ga White Kynar',
    '24 ga Bronze Kynar',
    '24 ga Galvalume',
    '26 ga Galvalume',
    '0.040 in Anodized Aluminum',
    'Copper 16 oz',
  ].map((name, i) => ({ id: i + 1, name, cost: '' }));
}

/** v7 `loadExample()`'s sheet costs and rates — the `?example=1` state. */
export const V7_EXAMPLE_COSTS: Record<string, number> = {
  '24 ga Charcoal Kynar': 118,
  '24 ga Sandstone Kynar': 118,
  '24 ga White Kynar': 112,
  '24 ga Bronze Kynar': 118,
  '24 ga Galvalume': 74,
  '26 ga Galvalume': 62,
  '0.040 in Anodized Aluminum': 96,
  'Copper 16 oz': 420,
};
export const V7_EXAMPLE_RATES = { bend: '0.85', hem: '0.60', markup: '35', rush: '25', min: '75' };

/** v7 `DPOS` / `SHOPXY` — the delivery map's sample coordinates. */
export const V7_DPOS: Record<string, [number, number]> = {
  'Hill Country Roofing': [150, 255],
  'Martinez Builders': [300, 305],
  'Round Rock Roofing': [450, 232],
  'Georgetown Siding Co.': [385, 125],
  'Cedar Park Contractors': [335, 205],
  'Pflugerville Metal Works': [490, 268],
  'Lakeway Custom Homes': [290, 350],
  'Bluebonnet Exteriors': [235, 170],
  'Ortega Roofing': [205, 215],
  'Liberty Hill Homes': [285, 110],
  'Hutto Metal Roofing': [545, 205],
};
export const V7_SHOPXY: [number, number] = [115, 62];

/* ───────────────────────── derived helpers (v7's own) ───────────────────── */

export function profBy(profiles: V7Profile[], id: number): V7Profile | null {
  return profiles.find((p) => p.id === Number(id)) ?? null;
}

export function jobBy(jobs: V7Job[], n: number): V7Job | null {
  return jobs.find((j) => j.n === Number(n)) ?? null;
}

/**
 * v7 `jobDims()` — the lengths this job's drawing should use.
 *
 * A job with a saved profile draws the profile; a job with an unapplied change
 * request draws the REQUESTED version, with the changed segment highlighted,
 * which is the whole point of the amber "change asked for" strip on the Job
 * screen. A job with neither draws its sketch, or the definition's defaults.
 */
export function jobDims(jobs: V7Job[], profiles: V7Profile[], j: V7Job): number[] {
  const p = j.pid ? profBy(profiles, j.pid) : null;
  let d: number[];
  if (p) {
    d = p.d.slice();
    if (j.chg && !j.chgDone) d[j.chg.seg] = d[j.chg.seg] + j.chg.delta;
  } else {
    d = (j.sketchD ?? V7_DEF_LENGTHS(j.kind)).slice();
  }
  return d;
}

function V7_DEF_LENGTHS(kind: string): number[] {
  return segsOf(kind, null).map((s) => s[1]);
}

export function jobHi(j: V7Job): number[] {
  return j.chg && !j.chgDone ? [j.chg.seg] : [];
}

export function jobSt(jobs: V7Job[], profiles: V7Profile[], j: V7Job): V7Stats {
  return stats(j.kind, jobDims(jobs, profiles, j));
}

export function itemLabel(j: V7Job): string {
  return `${V7_NAMES[j.kind]} × ${j.qty}`;
}

/** v7 `addSub()` + `totals()`. Money is integer cents throughout. */
export function totals(j: V7Job): { has: boolean; sub: number; tax: number; tot: number } {
  const q = Math.floor(num(j.qty));
  const u = Math.round(num(j.unit) * 100);
  let addSub = 0;
  (j.adds || []).forEach((a) => {
    if (a.st === 'ok') addSub += Math.round(num(a.unit) * 100) * Math.floor(num(a.qty));
  });
  const sub = u * q + addSub;
  const tax = Math.floor(sub * V7_TAX_RATE + 0.5 + 1e-9);
  return { has: q > 0 && u > 0, sub, tax, tot: sub + tax };
}

/** v7 `pState()` — the job's profile state, which decides the card's first pill. */
export type V7ProfileState = 'none' | 'reuse' | 'change' | 'newver';
export function pState(j: V7Job): V7ProfileState {
  if (!j.pid) return 'none';
  if (j.chg && !j.chgDone) return 'change';
  if (j.chg && j.chgDone) return 'newver';
  return 'reuse';
}

export function profKnown(profiles: V7Profile[], j: V7Job): V7Material | null {
  const p = j.pid ? profBy(profiles, j.pid) : null;
  if (!p) return null;
  return p.mats.find((m) => m.spec === j.spec) ?? null;
}

export function dayLabel(k: string | null): string {
  return V7_DAYS.find((d) => d.k === k)?.label ?? '';
}

/** v7 `fmtTs()` — "Today 7:52 AM" for today, else "Sep 29". */
export function fmtTs(ts: number): string {
  const d = new Date(ts);
  const n = new Date(V7_NOW);
  if (d.toDateString() === n.toDateString()) {
    return `Today ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function rangeCut(r: string): number {
  return r === '30'
    ? V7_NOW - 30 * 864e5
    : r === '90'
      ? V7_NOW - 90 * 864e5
      : r === 'year'
        ? new Date(2026, 0, 1).getTime()
        : 0;
}

/** A Search/Quotes/Orders list row. v7 builds these from jobs AND from history. */
export interface V7Row {
  cust: string;
  person: string;
  pid: number;
  kind: string;
  d: number[];
  spec: string;
  qty: number;
  unit: number;
  ts: number;
  status: string;
  lane: string;
  n: number;
  tot: number;
  j: V7Job | null;
}

const V7_MON: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const V7_MATF: Record<string, number> = { Galvalume: 1, Kynar: 1.25, Aluminum: 1.2, Copper: 3.4 };

function pd(s: string): number {
  const p = String(s).split(' ');
  return new Date(2026, V7_MON[p[0]], Number(p[1]), 9, 0).getTime();
}

function histUnit(kind: string, d: number[], spec: string): number {
  const st = stats(kind, d);
  let f = 1;
  Object.keys(V7_MATF).forEach((k) => {
    if (spec.indexOf(k) >= 0) f = V7_MATF[k];
  });
  return Math.round((st.dev * 0.95 * f + st.bends * 0.55) * 20) / 20;
}

function rowTot(unit: number, qty: number): number {
  const sub = Math.round(unit * 100) * qty;
  return sub + Math.floor(sub * V7_TAX_RATE + 0.5 + 1e-9);
}

/**
 * v7 `hist()` — every past order, rebuilt from the saved profiles' material
 * history. This is how Search shows 40-odd rows from only twelve live jobs.
 */
export function v7Hist(profiles: V7Profile[], jobs: V7Job[]): V7Row[] {
  let rows: V7Row[] = [];
  profiles.forEach((p) => {
    p.mats.forEach((m) => {
      const k = m.orders;
      if (!k) return;
      const f = pd(m.first);
      const l = pd(m.last);
      const base = Math.max(1, Math.round(m.pcs / k));
      const unit = histUnit(p.kind, p.d, m.spec);
      for (let i = 0; i < k; i++) {
        const q = i === k - 1 ? Math.max(1, m.pcs - base * (k - 1)) : base;
        rows.push({
          cust: p.cust,
          person: p.person,
          pid: p.id,
          kind: p.kind,
          d: p.d,
          spec: m.spec,
          qty: q,
          unit,
          ts: k === 1 ? l : f + ((l - f) * i) / (k - 1),
          status: 'Delivered',
          lane: 'done',
          n: 0,
          tot: rowTot(unit, q),
          j: null,
        });
      }
    });
  });
  rows = rows.filter(
    (r) => !jobs.some((j) => j.pid === r.pid && j.spec === r.spec && Math.abs(j.ts - r.ts) < 36 * 36e5),
  );
  rows.sort((a, b) => a.ts - b.ts).forEach((r, i) => {
    r.n = 100 + i;
  });
  return rows;
}

/** v7 `rowOfJob()`. */
export function rowOfJob(jobs: V7Job[], profiles: V7Profile[], j: V7Job): V7Row {
  const t = totals(j);
  return {
    cust: j.cust,
    person: j.person,
    pid: j.pid,
    kind: j.kind,
    d: jobDims(jobs, profiles, j),
    spec: j.spec,
    qty: Math.floor(num(j.qty)),
    unit: num(j.unit),
    ts: j.ts,
    status: V7_STATUS[j.lane],
    lane: j.lane,
    n: j.n,
    tot: t.has ? t.tot : 0,
    j,
  };
}

/** v7 `allRows()` — history plus every live job. */
export function v7AllRows(profiles: V7Profile[], jobs: V7Job[]): V7Row[] {
  const rows = v7Hist(profiles, jobs);
  jobs.forEach((j) => rows.push(rowOfJob(jobs, profiles, j)));
  return rows;
}

/** v7 `sortRows()`. */
export function sortRows(rows: V7Row[], how: string): V7Row[] {
  const f: Record<string, (a: V7Row, b: V7Row) => number> = {
    new: (a, b) => b.ts - a.ts,
    old: (a, b) => a.ts - b.ts,
    cust: (a, b) => a.cust.localeCompare(b.cust) || b.ts - a.ts,
    qty: (a, b) => b.qty - a.qty || b.ts - a.ts,
    val: (a, b) => b.tot - a.tot || b.ts - a.ts,
  };
  return rows.slice().sort(f[how] || f.new);
}

/** v7 `matchTokens()` — every token must appear somewhere in the row. */
export function matchTokens(r: V7Row, q: string): boolean {
  const toks = String(q).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return true;
  const hay = [
    r.cust,
    r.person,
    V7_NAMES[r.kind],
    dimTxt(r.kind, r.d),
    r.spec,
    jid(r.n),
    r.status,
    new Date(r.ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  ]
    .join(' ')
    .toLowerCase();
  return toks.every((t) => hay.indexOf(t) >= 0);
}

export interface V7SearchState {
  q: string;
  mat: string;
  range: string;
  show: string;
  sort: string;
  pid: number;
}

export function v7SearchDef(): V7SearchState {
  return { q: '', mat: 'All materials', range: 'all', show: 'all', sort: 'new', pid: 0 };
}

/** v7 `searchRows()`. */
export function v7SearchRows(profiles: V7Profile[], jobs: V7Job[], s: V7SearchState): V7Row[] {
  const cut = rangeCut(s.range);
  return sortRows(
    v7AllRows(profiles, jobs).filter((r) => {
      if (s.pid && r.pid !== s.pid) return false;
      if (s.mat !== 'All materials' && r.spec.indexOf(s.mat) < 0) return false;
      if (cut && r.ts < cut) return false;
      const isQ = r.lane === 'new' || r.lane === 'quoted';
      if (s.show === 'quotes' && !isQ) return false;
      if (s.show === 'orders' && isQ) return false;
      return matchTokens(r, s.q);
    }),
    s.sort,
  );
}

export interface V7ListState {
  q: string;
  stage: string;
  range: string;
  sort: string;
}

export function v7ListDef(): V7ListState {
  return { q: '', stage: 'all', range: 'all', sort: 'new' };
}

/** v7 `listRows()`. */
export function v7ListRows(
  profiles: V7Profile[],
  jobs: V7Job[],
  kind: 'quotes' | 'orders',
  s: V7ListState,
): V7Row[] {
  const lanes = kind === 'quotes' ? ['new', 'quoted'] : ['approved', 'shop', 'done'];
  const cut = rangeCut(s.range);
  return sortRows(
    jobs
      .filter((j) => lanes.indexOf(j.lane) >= 0 && (s.stage === 'all' || j.lane === s.stage))
      .map((j) => rowOfJob(jobs, profiles, j))
      .filter((r) => (!cut || r.ts >= cut) && matchTokens(r, s.q)),
    s.sort,
  );
}

export function labelOf(opts: [string, string][], v: string): string {
  return opts.find((o) => o[0] === v)?.[1] ?? '';
}

export function stopsOn(jobs: V7Job[], k: string): V7Job[] {
  return jobs.filter((j) => j.lane === 'shop' && j.day === k);
}

/** v7 `dayStops()` — a day's stops, in window order. */
export function dayStops(jobs: V7Job[], k: string): V7Job[] {
  return stopsOn(jobs, k)
    .slice()
    .sort((a, b) => V7_WINS.indexOf(a.win) - V7_WINS.indexOf(b.win));
}

export function laneCount(jobs: V7Job[], lane: V7Lane): number {
  return jobs.filter((j) => j.lane === lane && (lane !== 'done' || j.onBoard)).length;
}

/**
 * THE WHOLE FIXTURE, as one object. Built fresh per call so one screen's render
 * cannot mutate another's — the prototype mutates `S` freely and a shared
 * module-level object here would carry that between requests.
 */
export interface V7Fixture {
  profiles: V7Profile[];
  jobs: V7Job[];
  inbox: V7InboxMessage[];
  queue: number[];
  fin: number[];
  custs: [string, string][];
}

export function v7Fixture(): V7Fixture {
  return {
    profiles: v7Profiles(),
    jobs: v7Jobs(),
    inbox: V7_INBOX.map((m) => ({ ...m })),
    queue: [...V7_QUEUE],
    fin: [...V7_FIN],
    custs: V7_CUSTS.map((c) => [c[0], c[1]] as [string, string]),
  };
}
