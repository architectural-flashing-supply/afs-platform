import { describe, expect, it } from 'vitest';
import { NOTE_MAX_CHARS, numberCallouts, shopCalloutBanner } from './types';
import { validateCreate, validateNote, validateUpdate } from './validate';

const goodCreate = {
  quoteRequestId: '11111111-1111-1111-1111-111111111111',
  lineItemIndex: 0,
  segmentIndex: 0,
  segmentCount: 2,
  t: 0.5,
  segA: { x: 0, y: 0 },
  segB: { x: 4, y: 0 },
  anchor: { x: 2, y: 0 },
  tail: { dx: 0, dy: -1.75 },
  note: 'Hems stay open, do not close them.',
};

describe('validateNote — 280 characters, trimmed', () => {
  it('agrees with the database constraint', () => {
    expect(NOTE_MAX_CHARS).toBe(280);
  });

  it('trims and accepts', () => {
    const r = validateNote('  Run it film side up.  ');
    expect(r).toEqual({ ok: true, value: 'Run it film side up.' });
  });

  it('refuses empty and whitespace-only', () => {
    expect(validateNote('').ok).toBe(false);
    expect(validateNote('     ').ok).toBe(false);
    expect(validateNote('\n\t ').ok).toBe(false);
  });

  it('refuses a non-string instead of coercing it', () => {
    expect(validateNote(undefined).ok).toBe(false);
    expect(validateNote(42).ok).toBe(false);
    expect(validateNote(null).ok).toBe(false);
  });

  it('accepts exactly 280 and refuses 281', () => {
    expect(validateNote('x'.repeat(280)).ok).toBe(true);
    const over = validateNote('x'.repeat(281));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain('281');
  });

  it('counts after trimming, so 280 plus a trailing newline is fine', () => {
    expect(validateNote(`${'x'.repeat(280)}\n`).ok).toBe(true);
  });
});

describe('validateCreate', () => {
  it('accepts a well-formed callout', () => {
    const r = validateCreate(goodCreate);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBe('Hems stay open, do not close them.');
  });

  it('needs a job to attach to', () => {
    const { quoteRequestId: _omitted, ...withoutJob } = goodCreate;
    const r = validateCreate(withoutJob);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('quoteRequestId or shopJobId');
  });

  it('accepts a shop job as the subject on its own', () => {
    const { quoteRequestId: _omitted, ...rest } = goodCreate;
    expect(validateCreate({ ...rest, shopJobId: '22222222-2222-2222-2222-222222222222' }).ok).toBe(true);
  });

  it('NEVER reads company or author from the body', () => {
    // The strong property: those names are not parsed at all, so the validated
    // value has no field a forged one could occupy. The route supplies both
    // from the session.
    const r = validateCreate({
      ...goodCreate,
      companyId: '99999999-9999-9999-9999-999999999999',
      company_id: '99999999-9999-9999-9999-999999999999',
      createdBy: '88888888-8888-8888-8888-888888888888',
      created_by: '88888888-8888-8888-8888-888888888888',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value)).not.toContain('companyId');
      expect(Object.keys(r.value)).not.toContain('company_id');
      expect(Object.keys(r.value)).not.toContain('createdBy');
      expect(Object.keys(r.value)).not.toContain('created_by');
      expect(JSON.stringify(r.value)).not.toContain('99999999');
      expect(JSON.stringify(r.value)).not.toContain('88888888');
    }
  });

  it('refuses a t outside 0..1', () => {
    expect(validateCreate({ ...goodCreate, t: 1.0001 }).ok).toBe(false);
    expect(validateCreate({ ...goodCreate, t: -0.1 }).ok).toBe(false);
  });

  it('refuses a fractional or negative segment index', () => {
    expect(validateCreate({ ...goodCreate, segmentIndex: 1.5 }).ok).toBe(false);
    expect(validateCreate({ ...goodCreate, segmentIndex: -1 }).ok).toBe(false);
  });

  it('refuses a segment count below one', () => {
    expect(validateCreate({ ...goodCreate, segmentCount: 0 }).ok).toBe(false);
  });

  it('refuses NaN and Infinity rather than storing them', () => {
    expect(validateCreate({ ...goodCreate, t: NaN }).ok).toBe(false);
    expect(validateCreate({ ...goodCreate, anchor: { x: Infinity, y: 0 } }).ok).toBe(false);
    expect(validateCreate({ ...goodCreate, tail: { dx: NaN, dy: 0 } }).ok).toBe(false);
  });

  it('defaults a missing or junk line-item index to 0 rather than refusing', () => {
    const { lineItemIndex: _omitted, ...rest } = goodCreate;
    const r = validateCreate(rest);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lineItemIndex).toBe(0);
    const junk = validateCreate({ ...goodCreate, lineItemIndex: 'two' });
    expect(junk.ok).toBe(true);
    if (junk.ok) expect(junk.value.lineItemIndex).toBe(0);
  });

  it('refuses a non-object body', () => {
    expect(validateCreate(null).ok).toBe(false);
    expect(validateCreate('note').ok).toBe(false);
  });
});

describe('validateUpdate', () => {
  it('accepts a note on its own', () => {
    const r = validateUpdate({ note: 'Changed my mind.' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ note: 'Changed my mind.' });
  });

  it('accepts a dragged tail on its own', () => {
    expect(validateUpdate({ tail: { dx: 2, dy: -1 } }).ok).toBe(true);
  });

  it('accepts a re-anchor, and demands all of its parts', () => {
    expect(
      validateUpdate({
        anchor: {
          segmentIndex: 1,
          segmentCount: 2,
          t: 0.25,
          segA: { x: 4, y: 0 },
          segB: { x: 4, y: 3 },
          anchor: { x: 4, y: 0.75 },
        },
      }).ok
    ).toBe(true);
    expect(validateUpdate({ anchor: { segmentIndex: 1, t: 0.25 } }).ok).toBe(false);
  });

  it('refuses an empty patch instead of reporting a save that changed nothing', () => {
    const r = validateUpdate({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Nothing to change.');
  });

  it('applies the same note rule as create', () => {
    expect(validateUpdate({ note: '   ' }).ok).toBe(false);
    expect(validateUpdate({ note: 'x'.repeat(281) }).ok).toBe(false);
  });
});

describe('the banner sentence', () => {
  it('is Reid’s wording, verbatim', () => {
    expect(shopCalloutBanner(3)).toBe('3 shop notes from Steve — read before running');
  });

  it('is singular for one', () => {
    expect(shopCalloutBanner(1)).toBe('1 shop note from Steve — read before running');
  });

  it('is absent at zero — no banner on a job with no notes', () => {
    expect(shopCalloutBanner(0)).toBeNull();
    expect(shopCalloutBanner(-1)).toBeNull();
  });
});

describe('numberCallouts — 1..n by creation order, derived', () => {
  it('numbers in creation order whatever order the rows arrive in', () => {
    const numbered = numberCallouts([
      { id: 'c', createdAt: '2026-10-03T10:00:00Z' },
      { id: 'a', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'b', createdAt: '2026-10-02T10:00:00Z' },
    ]);
    expect(numbered.map((c) => [c.id, c.number])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('is stable for two rows written in the same millisecond', () => {
    // Without the id tiebreak these two could number differently on two reads
    // of identical data, and "click 2 to highlight arrow 2" would point
    // somewhere different each time.
    const rows = [
      { id: 'zzz', createdAt: '2026-10-01T10:00:00.000Z' },
      { id: 'aaa', createdAt: '2026-10-01T10:00:00.000Z' },
    ];
    expect(numberCallouts(rows).map((c) => c.id)).toEqual(['aaa', 'zzz']);
    expect(numberCallouts([...rows].reverse()).map((c) => c.id)).toEqual(['aaa', 'zzz']);
  });

  it('renumbers after a delete so the panel and the arrows agree', () => {
    // Deleting callout 2 leaves 1 and 2, not 1 and 3. This is why the number
    // is derived and not a stored column.
    const after = numberCallouts([
      { id: 'a', createdAt: '2026-10-01T10:00:00Z' },
      { id: 'c', createdAt: '2026-10-03T10:00:00Z' },
    ]);
    expect(after.map((c) => c.number)).toEqual([1, 2]);
  });

  it('does not mutate its input', () => {
    const rows = [
      { id: 'b', createdAt: '2026-10-02T10:00:00Z' },
      { id: 'a', createdAt: '2026-10-01T10:00:00Z' },
    ];
    numberCallouts(rows);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
