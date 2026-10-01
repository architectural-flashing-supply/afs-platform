import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  parseCatalogList,
  parseProfileSummaryList,
  logVendorShapeProblem,
} from '@/lib/integrations/pathfinder-response';

/**
 * F-09 — proof that a changed vendor payload is DETECTED and LOGGED rather than
 * crashing a component or being silently mis-rendered.
 *
 * Each "bad payload" below is a real way a third-party JSON API changes:
 * wrapping the array in an envelope, renaming a field, returning an error object
 * with a 200, widening a number to a string, or returning null for a name. The
 * old code was `(await res.json()) as T[]`, which accepted every one of them.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseCatalogList', () => {
  it('accepts the documented shape', () => {
    const result = parseCatalogList([
      { catalogId: 20115, catalogName: 'afs' },
      { catalogId: 20118, catalogName: 'Profiles for Pricing' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([
        { id: '20115', name: 'afs' },
        { id: '20118', name: 'Profiles for Pricing' },
      ]);
    }
  });

  it('tolerates a numeric id widened to a string — the codebase stringifies it anyway', () => {
    const result = parseCatalogList([{ catalogId: '20115', catalogName: 'afs' }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].id).toBe('20115');
  });

  it('REJECTS an envelope around the array — the old cast would have crashed on .map', () => {
    const result = parseCatalogList({ data: [{ catalogId: 20115, catalogName: 'afs' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain('object where the catalog list should be an array');
  });

  it('REJECTS a renamed field instead of rendering "undefined"', () => {
    const result = parseCatalogList([{ catalogId: 20115, name: 'afs' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain('has no catalogName');
  });

  it('REJECTS a 200 carrying an error object', () => {
    const result = parseCatalogList({ error: 'rate limited' });
    expect(result.ok).toBe(false);
  });

  it('REJECTS a non-numeric id', () => {
    const result = parseCatalogList([{ catalogId: 'afs-main', catalogName: 'afs' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain('no usable catalogId');
  });

  it('caps the problem list and says how many entries there were', () => {
    const result = parseCatalogList(Array.from({ length: 71 }, () => ({})));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toHaveLength(6);
      expect(result.problems[5]).toContain('71 entries');
    }
  });
});

describe('parseProfileSummaryList', () => {
  it('accepts the documented shape and keeps profileId a number', () => {
    const result = parseProfileSummaryList([{ profileId: 32914399, profileName: 'AFS-001' }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].profileId).toBe(32914399);
  });

  it('keeps ids numeric so "9" cannot sort above "10" when picking the newest match', () => {
    const result = parseProfileSummaryList([
      { profileId: '9', profileName: 'dup' },
      { profileId: '10', profileName: 'dup' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const newest = result.value.reduce((a, b) => (b.profileId > a.profileId ? b : a));
      expect(newest.profileId).toBe(10);
    }
  });

  it('REJECTS a null profileName rather than matching it against the sent name', () => {
    const result = parseProfileSummaryList([{ profileId: 1, profileName: null }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain('has no profileName');
  });
});

describe('logVendorShapeProblem', () => {
  it('writes ONE server-side line carrying the endpoint, the problems and the real payload', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = { data: [{ catalogId: 20115 }] };
    const parsed = parseCatalogList(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    const line = logVendorShapeProblem('GET /api/v1/catalogs', parsed.problems, raw);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(line);
    expect(line).toContain('[PATHFINDER_SHAPE]');
    expect(line).toContain('GET /api/v1/catalogs');
    expect(line).toContain('does not match the documented shape');
    expect(line).toContain('{"data":[{"catalogId":20115}]}');
  });

  it('truncates a large payload instead of flooding the log', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = Array.from({ length: 400 }, (_, i) => ({ catalogId: i }));
    const line = logVendorShapeProblem('GET /api/v1/catalogs', ['x'], raw);
    expect(line).toContain('chars total)');
    expect(line.length).toBeLessThan(1200);
  });

  it('survives a payload that cannot be serialised', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logVendorShapeProblem('GET /api/v1/catalogs', ['x'], circular)).not.toThrow();
  });
});
