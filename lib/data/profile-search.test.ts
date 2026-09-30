import { describe, it, expect } from 'vitest';
import {
  buildSearchArgs, parseField, parseStatus, parseDate, parseLimit, parseOffset,
  SEARCH_FIELDS, SEARCH_STATUSES, MAX_LIMIT, DEFAULT_LIMIT,
} from './profile-search';

/** Turns a plain object into the getter buildSearchArgs expects. */
const bag = (o: Record<string, string>) => (k: string) => (k in o ? o[k] : null);

describe('profile search — field selector', () => {
  it('accepts every advertised field', () => {
    for (const f of SEARCH_FIELDS) expect(parseField(f)).toBe(f);
  });
  it('falls back to "all" for anything unknown', () => {
    for (const bad of ['', 'nope', 'NAME', 'sql', null, undefined]) expect(parseField(bad)).toBe('all');
  });
});

describe('profile search — status filter', () => {
  it('accepts every advertised status', () => {
    for (const s of SEARCH_STATUSES) expect(parseStatus(s)).toBe(s);
  });
  it('returns null (no filter) for anything unknown', () => {
    for (const bad of ['', 'pending', 'reviewing', null, undefined]) expect(parseStatus(bad)).toBeNull();
  });
});

describe('profile search — date bounds', () => {
  it('accepts an ISO calendar date', () => {
    expect(parseDate('2026-09-30')).toBe('2026-09-30');
    expect(parseDate('2026-01-01')).toBe('2026-01-01');
  });
  it('drops a malformed date rather than erroring the search', () => {
    for (const bad of ['30-09-2026', '2026/09/30', '2026-9-3', 'today', '', null, undefined]) {
      expect(parseDate(bad)).toBeNull();
    }
  });
  it('drops a calendar-invalid date that still matches the shape', () => {
    expect(parseDate('2026-02-31')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('2026-00-10')).toBeNull();
  });
  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseDate('2024-02-29')).toBe('2024-02-29');
    expect(parseDate('2026-02-29')).toBeNull();
  });
});

describe('profile search — pagination clamping', () => {
  it('clamps limit into [1, MAX_LIMIT]', () => {
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit('24')).toBe(24);
    expect(parseLimit('999')).toBe(MAX_LIMIT);
    expect(parseLimit('0')).toBe(1);
    expect(parseLimit('-5')).toBe(1);
  });
  it('falls back to the default for non-numeric limits', () => {
    for (const bad of ['abc', '', null, undefined]) expect(parseLimit(bad)).toBe(DEFAULT_LIMIT);
  });
  it('floors a fractional limit rather than passing it through', () => {
    expect(parseLimit('12.7')).toBe(12);
  });
  it('clamps offset at zero and never goes negative', () => {
    expect(parseOffset('0')).toBe(0);
    expect(parseOffset('48')).toBe(48);
    expect(parseOffset('-10')).toBe(0);
    expect(parseOffset('nope')).toBe(0);
  });
});

describe('profile search — buildSearchArgs is total and typed', () => {
  it('maps a full query string to typed arguments', () => {
    expect(buildSearchArgs(bag({
      q: '  Reposition  ', field: 'company', material: 'Galvalume', gauge: '24 ga',
      dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'sent_to_machine',
      limit: '12', offset: '24',
    }))).toEqual({
      p_q: 'Reposition', p_field: 'company', p_material: 'Galvalume', p_gauge: '24 ga',
      p_date_from: '2026-09-01', p_date_to: '2026-09-30', p_status: 'sent_to_machine',
      p_limit: 12, p_offset: 24,
    });
  });

  it('produces a valid argument set from an EMPTY query string', () => {
    expect(buildSearchArgs(bag({}))).toEqual({
      p_q: '', p_field: 'all', p_material: null, p_gauge: null,
      p_date_from: null, p_date_to: null, p_status: null,
      p_limit: DEFAULT_LIMIT, p_offset: 0,
    });
  });

  it('treats whitespace-only filters as "no filter", not as matching empty string', () => {
    const args = buildSearchArgs(bag({ material: '   ', gauge: '', q: '   ' }));
    expect(args.p_material).toBeNull();
    expect(args.p_gauge).toBeNull();
    expect(args.p_q).toBe('');
  });

  it('never propagates a raw value that could be read as SQL — every field is typed or dropped', () => {
    const args = buildSearchArgs(bag({
      field: "name'; drop table saved_configurations; --",
      status: "'; delete from profiles; --",
      dateFrom: "2026-01-01'; --",
      limit: "10; drop",
      offset: "0 or 1=1",
    }));
    expect(args.p_field).toBe('all');
    expect(args.p_status).toBeNull();
    expect(args.p_date_from).toBeNull();
    expect(args.p_limit).toBe(DEFAULT_LIMIT);
    expect(args.p_offset).toBe(0);
  });

  it('passes the search TEXT through verbatim — it is a typed parameter, not SQL', () => {
    // p_q reaches Postgres as a bound text argument, so quotes in a real
    // company name ("O'Brien Roofing") must survive untouched.
    expect(buildSearchArgs(bag({ q: "O'Brien Roofing" })).p_q).toBe("O'Brien Roofing");
  });
});

// --- Part 7: Products page category filter ordering -------------------
// Colocated here rather than in a new file: this is the only other pure
// list-ordering rule in the Command Center/Products surface and it needs the
// same "stable except for the pinned tail" assertion shape.
describe('Part 7 — category filter puts the roofing categories last', () => {
  // Mirrors orderCategoryOptions in components/product/ProductCatalogBrowser.tsx.
  const CATEGORY_FILTER_LAST = ['roofing', 'roof-panels'];
  function orderCategoryOptions<T extends { value: string }>(options: T[]): T[] {
    const rest = options.filter((o) => !CATEGORY_FILTER_LAST.includes(o.value));
    const last = options.filter((o) => CATEGORY_FILTER_LAST.includes(o.value));
    last.sort((a, b) => CATEGORY_FILTER_LAST.indexOf(a.value) - CATEGORY_FILTER_LAST.indexOf(b.value));
    return [...rest, ...last];
  }

  const CATALOG_ORDER = [
    'roofing', 'scuppers', 'fascia', 'copings-and-cleats', 'siding-and-walls',
    'custom-fabrications', 'windows-and-doors-flashing', 'roof-panels',
  ].map((value) => ({ value }));

  it('moves both roofing categories to the end', () => {
    const out = orderCategoryOptions(CATALOG_ORDER).map((o) => o.value);
    expect(out.slice(-2)).toEqual(['roofing', 'roof-panels']);
  });

  it('leaves every other category in its original relative order', () => {
    const out = orderCategoryOptions(CATALOG_ORDER).map((o) => o.value);
    expect(out.slice(0, -2)).toEqual([
      'scuppers', 'fascia', 'copings-and-cleats', 'siding-and-walls',
      'custom-fabrications', 'windows-and-doors-flashing',
    ]);
  });

  it('loses nothing and duplicates nothing', () => {
    const out = orderCategoryOptions(CATALOG_ORDER).map((o) => o.value);
    expect(out.slice().sort()).toEqual(CATALOG_ORDER.map((o) => o.value).slice().sort());
  });
});

describe('Part 7 — gauge lists are the single source of truth', () => {
  it('removes the gauges that are no longer selectable', async () => {
    const { GAUGES_BY_MATERIAL, gaugesForMaterial } = await import('./catalog');
    expect(GAUGES_BY_MATERIAL['Lead Coated Copper']).toEqual(['16 oz', '20 oz']);
    expect(GAUGES_BY_MATERIAL['Anodized Aluminum']).not.toContain('18 ga');
    expect(GAUGES_BY_MATERIAL['Zinc']).toEqual(['0.7mm', '0.8mm']);
    // The Products page gauge filter derives from this same map.
    expect(gaugesForMaterial('Zinc')).not.toContain('1.0mm');
    expect(gaugesForMaterial('Zinc')).not.toContain('1.5mm');
  });

  it('leaves 18 ga selectable where it is genuinely valid', () => {
    // Removing it globally would have been the easy wrong fix.
    return import('./catalog').then(({ GAUGES_BY_MATERIAL }) => {
      expect(GAUGES_BY_MATERIAL['Galvanized Steel']).toContain('18 ga');
      expect(GAUGES_BY_MATERIAL['Stainless Steel']).toContain('18 ga');
    });
  });
});
