/**
 * THE LIVE SIDE OF THE LIST AND SEARCH VIEWS.
 *
 * Split out of `from-live.ts` because the Workbench reads a different module
 * (`lib/data/workbench.ts`) from the two lists and Search (`quote-order-list.ts`),
 * and one file importing both would make either screen's build pull the other's
 * query helpers.
 *
 * Nothing here filters, sorts or matches — `applyListQuery` and
 * `applySearchQuery` already do all of that and are unit-tested. This only
 * reshapes rows the page has already selected into v7's markup slots.
 *
 * WHAT THE LIVE ROW CANNOT FILL, AND DOES NOT PRETEND TO. v7 gives a list row
 * three lines of profile — name, dimensions, bend count — from geometry it has
 * in memory. The live list query deliberately carries NO geometry (CLAUDE.md
 * rule #26: `geometry_svg` is a base64 PNG at up to 786KB a row, and a list of
 * fifty would be tens of megabytes). So the profile name is printed and the
 * other two lines are left empty rather than filled with a plausible-looking
 * guess, and the thumbnail is the empty `.rt` box rather than an invented
 * shape. Both are listed in docs/design/V7_PIXEL_REPORT.md.
 */
import {
  LIST_RANGES,
  LIST_SORTS,
  LIST_STAGES,
  SEARCH_SHOWS,
  materialOptions,
  type ListKind,
  type ListQuery,
  type ListRow,
  type SearchQuery,
} from '@/lib/data/quote-order-list';
import { liveSpecChip } from '@/lib/data/v7-view/from-live';
import type { V7Button, V7ListRow, V7ListView, V7SearchRow, V7SearchView } from './types';

/** v7 `cents()` — grouped dollars, two decimals, no currency code. */
function cents(value: number): string {
  return `$${(value / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** v7 `PILLC` (line 1599) — the status pill's colour, by stage. */
const STAGE_PILL: Record<string, string> = {
  new: 'r',
  quoted: 'a',
  approved: 'g',
  shop: 'v',
  done: 'b',
};

/**
 * v7 `STATUS` (line 1598). Note `done` reads "Delivered" on a list and on
 * Search, where the Workbench lane is titled "Done" — v7 uses both words
 * deliberately, for the lane and for the row.
 */
const STAGE_TEXT: Record<string, string> = {
  new: 'New',
  quoted: 'Quoted',
  approved: 'Approved',
  shop: 'In the shop',
  done: 'Delivered',
};

/** v7 `fmtTs()` — today reads as a time, anything else as a short date. */
function fmtTs(iso: string, now: Date): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) {
    return `Today ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pieces(q: number): string {
  return q === 1 ? 'piece' : 'pieces';
}

function optionsOf(items: { value: string; label: string }[]): [string, string][] {
  return items.map((i) => [i.value, i.label]);
}

/** v7 `listAct()` (line 1720), over the stages the live app really has. */
function liveListButton(row: ListRow): V7Button {
  const href = `/admin/command-center/job/${row.id}`;
  switch (row.stage) {
    case 'new':
      return { tone: 'red', size: 'sm', label: 'Start quote', href };
    case 'quoted':
      return { tone: 'amber', size: 'sm', label: 'Follow up', href };
    case 'approved':
      return { tone: 'green', size: 'sm', label: 'Send to machine', href };
    case 'shop':
      return { tone: 'violet', size: 'sm', label: 'Shop View', href: '/admin/shop-view' };
    default:
      return { tone: 'blue', size: 'sm', label: 'Reorder', href };
  }
}

function liveListRow(row: ListRow, now: Date): V7ListRow {
  return {
    key: row.id,
    href: `/admin/command-center/job/${row.id}`,
    drawing: null,
    customer: row.customer,
    person: row.person,
    profileName: row.item,
    dims: '',
    bends: '',
    qty: `${row.quantity} ${pieces(row.quantity)}`,
    spec: liveSpecChip(row.spec),
    total: row.totalCents == null ? 'No price yet' : cents(row.totalCents),
    jobId: row.requestNumber,
    statusPill: { tone: STAGE_PILL[row.stage] ?? '', text: STAGE_TEXT[row.stage] ?? row.stage },
    // v7's flag pills are "Revised v2" and "Addendum waiting" — gap-audit items
    // 8 and 9, neither of which exists. Rush is the one flag this app has, and
    // only ever from an explicit source (CLAUDE.md rule #15).
    flagPills: row.isRush ? [{ tone: 'r', text: 'RUSH' }] : [],
    meta: row.meta,
    date: fmtTs(row.submittedAt, now),
    source: row.sourceLabel,
    button: liveListButton(row),
  };
}

/** v7 `pageList()` (line 1745), from rows the page already fetched. */
export function liveList(
  kind: ListKind,
  query: ListQuery,
  rows: ListRow[],
  now: Date = new Date(),
): V7ListView {
  const title = kind === 'quotes' ? 'Quotes' : 'Orders';
  const sortLabel = LIST_SORTS.find((s) => s.value === query.sort)?.label ?? 'Newest first';
  return {
    title,
    sub:
      kind === 'quotes'
        ? 'Every quote that still needs a price or is waiting on the customer. Revised quotes show here too.'
        : 'Everything the customer has approved: waiting for the machine, in the shop, and delivered.',
    showNewQuote: kind === 'quotes',
    filters: [
      {
        name: 'q',
        label: `Search ${title.toLowerCase()}`,
        value: query.q,
        placeholder: 'Customer, profile, material or job number',
      },
      { name: 'stage', label: 'Stage', value: query.stage, options: optionsOf(LIST_STAGES[kind]) },
      { name: 'range', label: 'Date', value: query.range, options: optionsOf(LIST_RANGES) },
      { name: 'sort', label: 'Sort', value: query.sort, options: optionsOf(LIST_SORTS) },
    ],
    countLine: `${rows.length} ${kind === 'quotes' ? 'quote' : 'order'}${rows.length === 1 ? '' : 's'} · ${sortLabel.toLowerCase()}`,
    rows: rows.map((r) => liveListRow(r, now)),
    emptyText: 'Nothing here matches.',
  };
}

function liveSearchRow(row: ListRow, now: Date): V7SearchRow {
  const unitCents =
    row.totalCents != null && row.quantity > 0 ? Math.round(row.totalCents / row.quantity) : null;
  return {
    key: row.id,
    drawing: null,
    profileName: row.item,
    dims: '',
    bends: '',
    customer: row.customer,
    person: row.person,
    jobId: row.requestNumber,
    date: fmtTs(row.submittedAt, now),
    status: STAGE_TEXT[row.stage] ?? row.stage,
    qty: `${row.quantity} ${pieces(row.quantity)}`,
    spec: liveSpecChip(row.spec),
    total: row.totalCents == null ? '' : cents(row.totalCents),
    price: unitCents == null ? 'No price yet' : `${cents(unitCents)} each`,
    buttons: [
      { tone: 'slate', size: 'sm', label: 'Open job', href: `/admin/command-center/job/${row.id}` },
    ],
  };
}

/** v7 `pageSearch()` (line 1667), over quotes AND orders. */
export function liveSearch(
  query: SearchQuery,
  rows: ListRow[],
  allRows: ListRow[],
  now: Date = new Date(),
): V7SearchView {
  const sortLabel = LIST_SORTS.find((s) => s.value === query.sort)?.label ?? 'Newest first';
  return {
    filters: [
      {
        name: 'q',
        label: 'Search for',
        value: query.q,
        placeholder: 'Company, then profile, material or job number',
      },
      { name: 'show', label: 'Show', value: query.show, options: optionsOf(SEARCH_SHOWS) },
      {
        name: 'material',
        label: 'Material',
        value: query.material,
        // v7's material list is a fixed five because its data is a fixture.
        // This one is derived from the rows that exist, so it can never offer a
        // material that returns nothing — see materialOptions()'s own comment.
        options: materialOptions(allRows).map((m) => [m, m] as [string, string]),
      },
      { name: 'range', label: 'Date', value: query.range, options: optionsOf(LIST_RANGES) },
      { name: 'sort', label: 'Sort', value: query.sort, options: optionsOf(LIST_SORTS) },
    ],
    // v7's "Showing profile #N only" chip belongs to the PROFILE search, which
    // is a different screen at /admin/search/profiles (CLAUDE.md rule #27).
    // Nothing on this screen can be filtered to one profile, so the chip is
    // never shown rather than being shown inert.
    profileChip: null,
    countLine:
      `${rows.length} result${rows.length === 1 ? '' : 's'}` +
      (query.q.trim() ? ` for “${query.q.trim()}”` : '') +
      ` · ${sortLabel.toLowerCase()}`,
    rows: rows.map((r) => liveSearchRow(r, now)),
    emptyText: 'Nothing matches. Try fewer words, or just the company name.',
  };
}
