/**
 * THE SHARED QUOTES / ORDERS LIST — filters, sort and token match.
 *
 * One module, used by both `/admin/quotes` and `/admin/orders`, because v7
 * builds both pages from one `pageList(kind)` with one `listRows(kind)`. The
 * two pages differ in exactly three ways and nothing else:
 *   - which job stages they include,
 *   - the wording of the stage dropdown,
 *   - the page title and blurb.
 *
 * Everything here is a PURE function over rows that the page has already
 * fetched, so the filter/sort/match rules are unit-testable without a database.
 *
 * Fidelity note: the option values, the option labels, the defaults and the
 * matched fields are copied from v7 (`LSTAGES` line 1694, `RANGES` 1600,
 * `SORTS` 1601, `matchTokens` 1631, `listRows` 1699, `sortRows` 1623,
 * `rangeCut` 1611). Do not reword a label here — the labels ARE the design.
 */
import type { JobStage } from '@/lib/data/job-stage';

export type ListKind = 'quotes' | 'orders';
export type ListRange = 'all' | '30' | '90' | 'year';
export type ListSort = 'new' | 'old' | 'cust' | 'qty' | 'val';

/** One row of either list. Assembled by the page from quote_requests + quotes. */
export interface ListRow {
  id: string;
  /** `quote_requests.request_number`, printed as the job id. */
  requestNumber: string;
  stage: JobStage;
  /** Company if known, else the person, else the guest email. */
  customer: string;
  /** Contact person, blank when we only have a company. */
  person: string;
  /** "Drip edge, 24 ga Charcoal Kynar" — the profile and its dimensions. */
  item: string;
  /** Material / gauge / colour, as the card prints it. */
  spec: string;
  quantity: number;
  /** Quote total in CENTS, or null when no quote has been priced yet. */
  totalCents: number | null;
  /** ISO timestamp the job arrived. */
  submittedAt: string;
  sourceLabel: string;
  /** The one-line plain-English status the Workbench card already writes. */
  meta: string;
  isRush: boolean;
  /** Profile id for the row thumbnail, when the job has a saved drawing. */
  profileId: string | null;
}

/** v7 `LSTAGES` (line 1694) — values and labels, verbatim. */
export const LIST_STAGES: Record<ListKind, { value: string; label: string }[]> = {
  quotes: [
    { value: 'all', label: 'Both stages' },
    { value: 'new', label: 'Needs a quote' },
    { value: 'quoted', label: 'Waiting on the customer' },
  ],
  orders: [
    { value: 'all', label: 'All orders' },
    { value: 'approved', label: 'Approved' },
    { value: 'shop', label: 'In the shop' },
    { value: 'done', label: 'Delivered' },
  ],
};

/** v7 `RANGES` (line 1600), verbatim. */
export const LIST_RANGES: { value: ListRange; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];

/** v7 `SORTS` (line 1601), verbatim. */
export const LIST_SORTS: { value: ListSort; label: string }[] = [
  { value: 'new', label: 'Newest first' },
  { value: 'old', label: 'Oldest first' },
  { value: 'cust', label: 'Customer A to Z' },
  { value: 'qty', label: 'Most pieces' },
  { value: 'val', label: 'Highest value' },
];

/** Which job stages each list owns. v7 `listRows` line 1699. */
export const STAGES_FOR_KIND: Record<ListKind, JobStage[]> = {
  quotes: ['new', 'quoted'],
  orders: ['approved', 'shop', 'done'],
};

/** v7 `STATUS` (line 1598), verbatim — the pill text. */
export const STAGE_LABEL: Record<JobStage, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Delivered',
};

export interface ListQuery {
  q: string;
  stage: string;
  range: ListRange;
  sort: ListSort;
}

/** v7's defaults: empty search, all stages, any time, newest first. */
export const DEFAULT_LIST_QUERY: ListQuery = { q: '', stage: 'all', range: 'all', sort: 'new' };

/**
 * v7 `rangeCut` (line 1611) — the cutoff timestamp, or 0 for "Any time".
 * "This year" is 1 January of the current year in local time, as v7 does.
 */
export function rangeCutMs(range: ListRange, now: Date = new Date()): number {
  const day = 864e5;
  if (range === '30') return now.getTime() - 30 * day;
  if (range === '90') return now.getTime() - 90 * day;
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
  return 0;
}

/**
 * v7 `matchTokens` (line 1631): case-insensitive **token-AND**. Every
 * whitespace-separated token must appear SOMEWHERE in the row's haystack; an
 * empty query matches everything.
 *
 * The haystack is the same set of fields v7 joins: customer, person, profile
 * name + dimensions, spec, job id, status, and the month-and-year the job
 * arrived — which is what lets "hill country drip edge" and "martinez january"
 * both work.
 */
export function rowHaystack(row: ListRow): string {
  const when = new Date(row.submittedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  return [
    row.customer,
    row.person,
    row.item,
    row.spec,
    row.requestNumber,
    STAGE_LABEL[row.stage],
    when,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchTokens(row: ListRow, q: string): boolean {
  const tokens = String(q).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = rowHaystack(row);
  return tokens.every((t) => hay.includes(t));
}

/** v7 `sortRows` (line 1623). */
export function sortRows(rows: ListRow[], how: ListSort): ListRow[] {
  const out = [...rows];
  const ts = (r: ListRow) => new Date(r.submittedAt).getTime();
  switch (how) {
    case 'old':
      return out.sort((a, b) => ts(a) - ts(b));
    case 'cust':
      return out.sort((a, b) => a.customer.localeCompare(b.customer) || ts(b) - ts(a));
    case 'qty':
      return out.sort((a, b) => b.quantity - a.quantity || ts(b) - ts(a));
    case 'val':
      return out.sort((a, b) => (b.totalCents ?? 0) - (a.totalCents ?? 0) || ts(b) - ts(a));
    case 'new':
    default:
      return out.sort((a, b) => ts(b) - ts(a));
  }
}

/**
 * The whole pipeline, in v7's order: stage scope -> stage filter -> date cut ->
 * token match -> sort.
 */
export function applyListQuery(
  rows: ListRow[],
  kind: ListKind,
  query: ListQuery,
  now: Date = new Date()
): ListRow[] {
  const scope = STAGES_FOR_KIND[kind];
  const cut = rangeCutMs(query.range, now);
  const filtered = rows.filter((r) => {
    if (!scope.includes(r.stage)) return false;
    if (query.stage !== 'all' && r.stage !== query.stage) return false;
    if (cut && new Date(r.submittedAt).getTime() < cut) return false;
    return matchTokens(r, query.q);
  });
  return sortRows(filtered, query.sort);
}

/** Reads a query off the page's searchParams, falling back to v7's defaults. */
export function parseListQuery(
  params: { q?: string; stage?: string; range?: string; sort?: string },
  kind: ListKind
): ListQuery {
  const stageOk = LIST_STAGES[kind].some((s) => s.value === params.stage);
  const rangeOk = LIST_RANGES.some((r) => r.value === params.range);
  const sortOk = LIST_SORTS.some((s) => s.value === params.sort);
  return {
    q: params.q ?? '',
    stage: stageOk ? (params.stage as string) : DEFAULT_LIST_QUERY.stage,
    range: rangeOk ? (params.range as ListRange) : DEFAULT_LIST_QUERY.range,
    sort: sortOk ? (params.sort as ListSort) : DEFAULT_LIST_QUERY.sort,
  };
}

/** v7's result line: "12 quotes · newest first". */
export function resultCountLine(count: number, kind: ListKind, sort: ListSort): string {
  const noun = kind === 'quotes' ? 'quote' : 'order';
  const sortLabel = (LIST_SORTS.find((s) => s.value === sort) ?? LIST_SORTS[0]).label.toLowerCase();
  return `${count} ${noun}${count === 1 ? '' : 's'} · ${sortLabel}`;
}
