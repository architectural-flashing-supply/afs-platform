import { describe, expect, it } from 'vitest';
import { deriveLineItemIndexes, parseGeometryPoints, type ShopRowKey } from './shop-callouts';

/**
 * The derivation this file asserts is a real property of
 * app/api/admin/command-center/approve-quote-request/route.ts: it inserts one
 * `shop_profile_library` row per line item, in a loop, in item order. So the
 * rows of one quote request in `created_at` order ARE its line items in order.
 *
 * It is tested rather than trusted because the consequence of getting it wrong
 * is an operator reading the wrong note, or not reading one at all.
 */
const row = (id: string, job: string | null, createdAt: string): ShopRowKey => ({
  id,
  quoteRequestId: job,
  createdAt,
});

describe('deriveLineItemIndexes', () => {
  it('numbers one job’s shop rows by creation order', () => {
    const rows = [
      row('s2', 'job1', '2026-10-01T10:00:02Z'),
      row('s0', 'job1', '2026-10-01T10:00:00Z'),
      row('s1', 'job1', '2026-10-01T10:00:01Z'),
    ];
    const { itemIndexByRow, widenedJobs } = deriveLineItemIndexes(rows, new Map());
    expect(itemIndexByRow.get('s0')).toBe(0);
    expect(itemIndexByRow.get('s1')).toBe(1);
    expect(itemIndexByRow.get('s2')).toBe(2);
    expect(widenedJobs.size).toBe(0);
  });

  it('numbers each job independently', () => {
    const rows = [
      row('a0', 'jobA', '2026-10-01T10:00:00Z'),
      row('b0', 'jobB', '2026-10-01T10:00:01Z'),
      row('a1', 'jobA', '2026-10-01T10:00:02Z'),
    ];
    const { itemIndexByRow } = deriveLineItemIndexes(rows, new Map());
    expect(itemIndexByRow.get('a0')).toBe(0);
    expect(itemIndexByRow.get('a1')).toBe(1);
    expect(itemIndexByRow.get('b0')).toBe(0);
  });

  it('ignores rows with no quote request — a direct FlashDraft send', () => {
    const rows = [row('direct', null, '2026-10-01T10:00:00Z')];
    const { itemIndexByRow } = deriveLineItemIndexes(rows, new Map());
    expect(itemIndexByRow.has('direct')).toBe(false);
  });

  it('WIDENS when a callout claims an item index this board has no row for', () => {
    // THE FAILURE DIRECTION IS DELIBERATE. One shop row survives, but a note
    // was written on item 1. Mapping by position would hide that note
    // entirely. Showing it on every row of the job costs a question; hiding it
    // costs a part.
    const rows = [row('s0', 'job1', '2026-10-01T10:00:00Z')];
    const claimed = new Map([['job1', new Set([0, 1])]]);
    const { widenedJobs } = deriveLineItemIndexes(rows, claimed);
    expect(widenedJobs.has('job1')).toBe(true);
  });

  it('does not widen when every claimed index has a row', () => {
    const rows = [
      row('s0', 'job1', '2026-10-01T10:00:00Z'),
      row('s1', 'job1', '2026-10-01T10:00:01Z'),
    ];
    const claimed = new Map([['job1', new Set([0, 1])]]);
    expect(deriveLineItemIndexes(rows, claimed).widenedJobs.size).toBe(0);
  });

  it('widens one job without widening its neighbour', () => {
    const rows = [row('a0', 'jobA', '2026-10-01T10:00:00Z'), row('b0', 'jobB', '2026-10-01T10:00:01Z')];
    const claimed = new Map([
      ['jobA', new Set([5])],
      ['jobB', new Set([0])],
    ]);
    const { widenedJobs } = deriveLineItemIndexes(rows, claimed);
    expect(widenedJobs.has('jobA')).toBe(true);
    expect(widenedJobs.has('jobB')).toBe(false);
  });

  it('breaks a same-timestamp tie by id, so the mapping is stable', () => {
    const rows = [
      row('zzz', 'job1', '2026-10-01T10:00:00.000Z'),
      row('aaa', 'job1', '2026-10-01T10:00:00.000Z'),
    ];
    const first = deriveLineItemIndexes(rows, new Map()).itemIndexByRow;
    const second = deriveLineItemIndexes([...rows].reverse(), new Map()).itemIndexByRow;
    expect(first.get('aaa')).toBe(0);
    expect(second.get('aaa')).toBe(0);
  });
});

describe('parseGeometryPoints', () => {
  it('reads the points array FlashDraft wrote', () => {
    expect(
      parseGeometryPoints([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('coerces the numeric strings a JSONB round-trip can produce', () => {
    expect(parseGeometryPoints([{ x: '1.5', y: '-2' }])).toEqual([{ x: 1.5, y: -2 }]);
  });

  it('yields an empty polyline for anything it cannot read, rather than throwing', () => {
    // On the shop floor a throw is a blank screen beside a running machine.
    // An empty polyline renders the notes with no arrows and says so.
    expect(parseGeometryPoints(null)).toEqual([]);
    expect(parseGeometryPoints('[]')).toEqual([]);
    expect(parseGeometryPoints([{ x: 1 }])).toEqual([]);
    expect(parseGeometryPoints([{ x: 'left', y: 0 }])).toEqual([]);
    expect(parseGeometryPoints([1, 2, 3])).toEqual([]);
    expect(parseGeometryPoints([{ x: 0, y: 0 }, null])).toEqual([]);
  });

  it('keeps extra fields out and never partially succeeds', () => {
    // A half-read polyline is the dangerous case: it would draw arrows against
    // geometry that is not the geometry. All or nothing.
    expect(parseGeometryPoints([{ x: 0, y: 0 }, { x: 1, y: Infinity }])).toEqual([]);
  });
});
