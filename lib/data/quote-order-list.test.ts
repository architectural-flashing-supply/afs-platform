import { describe, it, expect } from 'vitest';
import {
  applyListQuery,
  DEFAULT_LIST_QUERY,
  LIST_RANGES,
  LIST_SORTS,
  LIST_STAGES,
  matchTokens,
  parseListQuery,
  rangeCutMs,
  resultCountLine,
  sortRows,
  STAGES_FOR_KIND,
  type ListRow,
} from '@/lib/data/quote-order-list';
import {
  buildTypeahead,
  matchCompanies,
  seeAllLabel,
  TYPEAHEAD_EMPTY_MESSAGE,
  TYPEAHEAD_MIN_CHARS,
} from '@/lib/data/header-typeahead';

const NOW = new Date('2026-10-01T12:00:00Z');

function row(over: Partial<ListRow> = {}): ListRow {
  return {
    id: 'id-1',
    requestNumber: 'QR-1001',
    stage: 'new',
    customer: 'Hill Country Roofing',
    person: 'Dale',
    item: 'Drip edge, 4 in × 2 in',
    spec: '24 ga Charcoal Kynar',
    quantity: 40,
    totalCents: 125000,
    submittedAt: '2026-09-28T10:00:00Z',
    sourceLabel: 'Field app',
    meta: 'Arrived 3 days ago',
    isRush: false,
    profileId: null,
    ...over,
  };
}

describe('v7 option sets are reproduced verbatim', () => {
  it('stage options match v7 LSTAGES', () => {
    expect(LIST_STAGES.quotes.map((s) => [s.value, s.label])).toEqual([
      ['all', 'Both stages'],
      ['new', 'Needs a quote'],
      ['quoted', 'Waiting on the customer'],
    ]);
    expect(LIST_STAGES.orders.map((s) => [s.value, s.label])).toEqual([
      ['all', 'All orders'],
      ['approved', 'Approved'],
      ['shop', 'In the shop'],
      ['done', 'Delivered'],
    ]);
  });

  it('range options match v7 RANGES', () => {
    expect(LIST_RANGES.map((r) => [r.value, r.label])).toEqual([
      ['all', 'Any time'],
      ['30', 'Last 30 days'],
      ['90', 'Last 90 days'],
      ['year', 'This year'],
    ]);
  });

  it('sort options match v7 SORTS', () => {
    expect(LIST_SORTS.map((s) => [s.value, s.label])).toEqual([
      ['new', 'Newest first'],
      ['old', 'Oldest first'],
      ['cust', 'Customer A to Z'],
      ['qty', 'Most pieces'],
      ['val', 'Highest value'],
    ]);
  });

  it('each list owns the stages v7 gives it, and they never overlap', () => {
    expect(STAGES_FOR_KIND.quotes).toEqual(['new', 'quoted']);
    expect(STAGES_FOR_KIND.orders).toEqual(['approved', 'shop', 'done']);
    const overlap = STAGES_FOR_KIND.quotes.filter((s) => STAGES_FOR_KIND.orders.includes(s));
    expect(overlap).toEqual([]);
  });
});

describe('token-AND match', () => {
  it('requires EVERY token, not any', () => {
    const r = row();
    expect(matchTokens(r, 'hill drip')).toBe(true);
    expect(matchTokens(r, 'hill gutter')).toBe(false);
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    const r = row();
    expect(matchTokens(r, '  HILL   country  ')).toBe(true);
  });

  it('matches an empty query against everything', () => {
    expect(matchTokens(row(), '')).toBe(true);
    expect(matchTokens(row(), '   ')).toBe(true);
  });

  it('searches the job number, the spec, the status and the arrival month', () => {
    const r = row();
    expect(matchTokens(r, 'QR-1001')).toBe(true);
    expect(matchTokens(r, 'kynar')).toBe(true);
    expect(matchTokens(r, 'new')).toBe(true);
    expect(matchTokens(r, 'september 2026')).toBe(true);
  });

  it('matches tokens across different fields at once', () => {
    // "hill" is the customer, "kynar" is the spec — neither field alone has both.
    expect(matchTokens(row(), 'hill kynar')).toBe(true);
  });
});

describe('sorting', () => {
  const a = row({ id: 'a', customer: 'Zeta', quantity: 10, totalCents: 500, submittedAt: '2026-09-01T00:00:00Z' });
  const b = row({ id: 'b', customer: 'Alpha', quantity: 99, totalCents: 100, submittedAt: '2026-09-20T00:00:00Z' });

  it('newest and oldest are inverses', () => {
    expect(sortRows([a, b], 'new').map((r) => r.id)).toEqual(['b', 'a']);
    expect(sortRows([a, b], 'old').map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('customer A to Z', () => {
    expect(sortRows([a, b], 'cust').map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('most pieces, and highest value', () => {
    expect(sortRows([a, b], 'qty').map((r) => r.id)).toEqual(['b', 'a']);
    expect(sortRows([a, b], 'val').map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('treats an unpriced row as zero value rather than dropping it', () => {
    const unpriced = row({ id: 'c', totalCents: null });
    const out = sortRows([unpriced, a], 'val').map((r) => r.id);
    expect(out).toEqual(['a', 'c']);
    expect(out).toHaveLength(2);
  });

  it('does not mutate the input array', () => {
    const input = [a, b];
    sortRows(input, 'cust');
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('date range', () => {
  it('Any time has no cutoff', () => {
    expect(rangeCutMs('all', NOW)).toBe(0);
  });

  it('30 and 90 days look back from now', () => {
    expect(rangeCutMs('30', NOW)).toBe(NOW.getTime() - 30 * 864e5);
    expect(rangeCutMs('90', NOW)).toBe(NOW.getTime() - 90 * 864e5);
  });

  it('This year starts at 1 January of the current year', () => {
    expect(rangeCutMs('year', NOW)).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe('applyListQuery', () => {
  const quoteNew = row({ id: 'q1', stage: 'new' });
  const quoteQuoted = row({ id: 'q2', stage: 'quoted', customer: 'Martinez Builders' });
  const orderShop = row({ id: 'o1', stage: 'shop', customer: 'Round Rock Roofing' });
  const orderDone = row({ id: 'o2', stage: 'done', customer: 'Ortega Roofing' });
  const all = [quoteNew, quoteQuoted, orderShop, orderDone];

  it('Quotes shows only quote stages; Orders only order stages', () => {
    expect(applyListQuery(all, 'quotes', DEFAULT_LIST_QUERY, NOW).map((r) => r.id).sort()).toEqual(['q1', 'q2']);
    expect(applyListQuery(all, 'orders', DEFAULT_LIST_QUERY, NOW).map((r) => r.id).sort()).toEqual(['o1', 'o2']);
  });

  it('the stage filter narrows within the list', () => {
    const out = applyListQuery(all, 'quotes', { ...DEFAULT_LIST_QUERY, stage: 'quoted' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['q2']);
  });

  it('the search box narrows the result set', () => {
    const out = applyListQuery(all, 'orders', { ...DEFAULT_LIST_QUERY, q: 'ortega' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['o2']);
  });

  it('the date filter drops rows older than the cutoff', () => {
    const old = row({ id: 'old', stage: 'new', submittedAt: '2024-01-01T00:00:00Z' });
    const out = applyListQuery([quoteNew, old], 'quotes', { ...DEFAULT_LIST_QUERY, range: '30' }, NOW);
    expect(out.map((r) => r.id)).toEqual(['q1']);
  });

  it('the sort control changes the order', () => {
    const asc = applyListQuery(all, 'quotes', { ...DEFAULT_LIST_QUERY, sort: 'cust' }, NOW);
    expect(asc[0].customer).toBe('Hill Country Roofing');
  });
});

describe('parseListQuery', () => {
  it('falls back to v7 defaults for anything missing or invalid', () => {
    expect(parseListQuery({}, 'quotes')).toEqual(DEFAULT_LIST_QUERY);
    expect(parseListQuery({ stage: 'nonsense', range: 'nope', sort: 'bad' }, 'quotes')).toEqual(
      DEFAULT_LIST_QUERY
    );
  });

  it('rejects a stage that belongs to the OTHER list', () => {
    // 'shop' is an Orders stage; it must not survive on Quotes.
    expect(parseListQuery({ stage: 'shop' }, 'quotes').stage).toBe('all');
    expect(parseListQuery({ stage: 'shop' }, 'orders').stage).toBe('shop');
  });

  it('keeps valid values', () => {
    expect(parseListQuery({ q: 'hill', stage: 'quoted', range: '90', sort: 'val' }, 'quotes')).toEqual({
      q: 'hill',
      stage: 'quoted',
      range: '90',
      sort: 'val',
    });
  });
});

describe('result count line', () => {
  it('singularises and names the sort, as v7 does', () => {
    expect(resultCountLine(1, 'quotes', 'new')).toBe('1 quote · newest first');
    expect(resultCountLine(12, 'orders', 'val')).toBe('12 orders · highest value');
    expect(resultCountLine(0, 'quotes', 'new')).toBe('0 quotes · newest first');
  });
});

describe('header type-ahead', () => {
  const companies = [
    { name: 'Hill Country Roofing', person: 'Dale' },
    { name: 'Hill Top Metal', person: 'Rosa' },
    { name: 'Hillside Exteriors', person: 'Ann' },
    { name: 'Martinez Builders', person: 'Luis' },
  ];
  const rows = [
    row({ id: 'r1', customer: 'Hill Country Roofing', item: 'Drip edge' }),
    row({ id: 'r2', customer: 'Martinez Builders', item: 'Gutter' }),
  ];

  it('stays closed below the minimum length', () => {
    const out = buildTypeahead(companies, rows, 'h');
    expect(TYPEAHEAD_MIN_CHARS).toBe(2);
    expect(out.companies).toEqual([]);
    expect(out.rows).toEqual([]);
    expect(out.emptyMessage).toBeNull(); // hidden, not "nothing found"
  });

  it('puts COMPANY matches before profile-word matches', () => {
    const out = buildTypeahead(companies, rows, 'hill');
    expect(out.companies.length).toBeGreaterThan(0);
    expect(out.companies[0].name).toBe('Hill Country Roofing');
    // Companies are a separate, earlier group — never interleaved with rows.
    expect(out.rows.every((r) => r.id !== undefined)).toBe(true);
  });

  it('caps companies at two and rows at six, as v7 does', () => {
    const out = buildTypeahead(companies, rows, 'hill');
    expect(out.companies).toHaveLength(2);
    const many = Array.from({ length: 20 }, (_, i) => row({ id: `m${i}` }));
    expect(buildTypeahead(companies, many, 'hill country').rows).toHaveLength(6);
  });

  it('matches companies on the FIRST token only', () => {
    // "drip edge" is not in any company name, but "hill" is.
    const out = buildTypeahead(companies, rows, 'hill drip edge');
    expect(out.companies[0].name).toBe('Hill Country Roofing');
    expect(matchCompanies(companies, 'martinez gutter')[0].name).toBe('Martinez Builders');
  });

  it('shows v7’s exact empty line only when nothing matched at all', () => {
    expect(buildTypeahead(companies, rows, 'zzzzz').emptyMessage).toBe(TYPEAHEAD_EMPTY_MESSAGE);
    // A company hit alone is still a result, so no empty line.
    const companyOnly = buildTypeahead(companies, [], 'hill');
    expect(companyOnly.companies.length).toBeGreaterThan(0);
    expect(companyOnly.emptyMessage).toBeNull();
  });

  it('counts every match in the footer, not just the six shown', () => {
    const many = Array.from({ length: 9 }, (_, i) => row({ id: `m${i}` }));
    const out = buildTypeahead(companies, many, 'hill country');
    expect(out.totalRows).toBe(9);
    expect(seeAllLabel(out.totalRows)).toBe('See all 9 results, newest first');
    expect(seeAllLabel(1)).toBe('See all 1 result, newest first');
    expect(seeAllLabel(0)).toBeNull();
  });
});
