import { describe, it, expect } from 'vitest';
import { resolvePriceBook, versionInForce, blankFieldsOf, priceBookChangeDelta, toEffectiveDate } from './price-book';
import { quoteFromPriceBook } from './quote-math';
import type { PriceBookItem, PriceBookVersion, QuoteItemInput } from './types';

/**
 * PRICE-BOOK VERSIONING.
 *
 * The headline test in this file is "a price change does NOT alter an
 * already-issued quote". It is proved twice, deliberately:
 *
 *   1. By RE-RESOLVING the book as of the quote's own issue date after a new
 *      version has been added, and re-running the identical maths — the answer
 *      is unchanged.
 *   2. By checking the SNAPSHOT the issued quote carries (the cents and the
 *      version id it recorded), which is what an old quote actually reads from.
 *
 * Two mechanisms, because either one alone would be a single point of failure
 * for a promise about money.
 */

const ITEM: PriceBookItem = {
  id: 'item-galv-24',
  material: 'Galvalume',
  gauge: '24 GA',
  displayOrder: 1,
  retiredAt: null,
};

const JANUARY: PriceBookVersion = {
  id: 'ver-january',
  itemId: ITEM.id,
  sheetCostCents: 24000,
  perBendCents: 150,
  perHemCents: 275,
  extrasCents: null,
  extrasNote: null,
  effectiveFrom: '2026-01-01',
  note: 'opening prices',
  createdBy: null,
  createdAt: '2026-01-01T09:00:00.000Z',
};

/** Steel went up. Steve raises the sheet cost on the first of October. */
const OCTOBER: PriceBookVersion = {
  ...JANUARY,
  id: 'ver-october',
  sheetCostCents: 31000,
  perBendCents: 175,
  effectiveFrom: '2026-10-01',
  note: 'supplier increase',
  createdAt: '2026-09-30T16:00:00.000Z',
};

const LINE: QuoteItemInput = {
  description: 'Drip Edge',
  material: 'Galvalume',
  gauge: '24 GA',
  blankWidthIn: 12,
  bendCount: 2,
  hemCount: 1,
  lengthFt: 10,
  quantity: 40,
};

describe('versionInForce', () => {
  it('picks the latest version that is not in the future', () => {
    expect(versionInForce([JANUARY, OCTOBER], '2026-09-15')?.id).toBe('ver-january');
    expect(versionInForce([JANUARY, OCTOBER], '2026-10-01')?.id).toBe('ver-october');
    expect(versionInForce([JANUARY, OCTOBER], '2026-12-25')?.id).toBe('ver-october');
  });

  it('does NOT apply a version dated tomorrow — that is what makes a scheduled rise safe', () => {
    // Steve enters October's prices on 30 September. The quote he sends that
    // afternoon must still be at September's prices.
    expect(versionInForce([JANUARY, OCTOBER], '2026-09-30')?.id).toBe('ver-january');
  });

  it('returns null before any version starts', () => {
    expect(versionInForce([JANUARY], '2025-12-31')).toBeNull();
  });

  it('lets a same-day correction win, because it was entered later', () => {
    const typo: PriceBookVersion = { ...JANUARY, id: 'typo', sheetCostCents: 2400, createdAt: '2026-01-01T09:00:00.000Z' };
    const fix: PriceBookVersion = { ...JANUARY, id: 'fix', sheetCostCents: 24000, createdAt: '2026-01-01T09:05:00.000Z' };
    expect(versionInForce([typo, fix], '2026-06-01')?.id).toBe('fix');
  });

  it('returns null when the item has no versions at all — prices start empty', () => {
    expect(versionInForce([], '2026-06-01')).toBeNull();
  });
});

describe('resolvePriceBook', () => {
  it('starts every unpriced row as a marked blank, not as zero', () => {
    const [row] = resolvePriceBook([ITEM], [], '2026-09-30');
    expect(row.version).toBeNull();
    expect(row.isComplete).toBe(false);
    expect(row.blankFields).toEqual(['sheetCostCents', 'perBendCents', 'perHemCents']);
  });

  it('names exactly which cells are still blank on a part-filled row', () => {
    const partial: PriceBookVersion = { ...JANUARY, perHemCents: null };
    const [row] = resolvePriceBook([ITEM], [partial], '2026-06-01');
    expect(row.blankFields).toEqual(['perHemCents']);
    expect(row.isComplete).toBe(false);
  });

  it('treats a blank EXTRAS as complete — a row with no extras is priced', () => {
    const [row] = resolvePriceBook([ITEM], [JANUARY], '2026-06-01');
    expect(row.version?.extrasCents).toBeNull();
    expect(row.isComplete).toBe(true);
  });

  it('keeps retired rows resolvable, carrying their retirement date', () => {
    const retired = { ...ITEM, retiredAt: '2026-08-01T00:00:00.000Z' };
    const [row] = resolvePriceBook([retired], [JANUARY], '2026-09-01');
    expect(row.version?.id).toBe('ver-january');
    expect(row.item.retiredAt).not.toBeNull();
  });

  it('orders rows by the price book display order', () => {
    const second: PriceBookItem = { ...ITEM, id: 'b', displayOrder: 2, gauge: '26 GA' };
    const rows = resolvePriceBook([second, ITEM], [], '2026-06-01');
    expect(rows.map((r) => r.item.id)).toEqual([ITEM.id, 'b']);
  });
});

describe('A PRICE CHANGE DOES NOT ALTER AN ALREADY-ISSUED QUOTE', () => {
  const ISSUED_ON = '2026-09-15';

  it('proof 1: re-resolving the book as of the issue date gives the old total, after the rise', () => {
    // The quote as it was issued, when January's prices were the only ones.
    const before = quoteFromPriceBook([LINE], resolvePriceBook([ITEM], [JANUARY], ISSUED_ON));
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    // BY HAND: 24000 x 40 / 4 + 150 x 2 x 40 + 275 x 1 x 40 = 240000 + 12000 + 11000
    expect(before.totalCents).toBe(263000);

    // Steve now adds October's higher prices. Nothing is overwritten — the
    // January row is still there, which is the whole design.
    const after = quoteFromPriceBook([LINE], resolvePriceBook([ITEM], [JANUARY, OCTOBER], ISSUED_ON));
    expect(after.ok).toBe(true);
    if (!after.ok) return;

    expect(after.totalCents).toBe(before.totalCents);
    expect(after.lines[0].priceBookVersionId).toBe('ver-january');
    expect(after.lines[0].pricesUsed.sheetCostCents).toBe(24000);
  });

  it('proof 2: the NEW quote, priced today, really does use the new prices', () => {
    // The companion assertion. Without it, "unchanged" could just mean the new
    // version was never picked up at all.
    const today = quoteFromPriceBook([LINE], resolvePriceBook([ITEM], [JANUARY, OCTOBER], '2026-10-02'));
    expect(today.ok).toBe(true);
    if (!today.ok) return;
    // BY HAND: 31000 x 40 / 4 + 175 x 2 x 40 + 275 x 1 x 40 = 310000 + 14000 + 11000
    expect(today.totalCents).toBe(335000);
    expect(today.lines[0].priceBookVersionId).toBe('ver-october');
    expect(today.totalCents).toBeGreaterThan(263000);
  });

  it('proof 3: the issued quote carries its own snapshot, so it survives even a lost version row', () => {
    const issued = quoteFromPriceBook([LINE], resolvePriceBook([ITEM], [JANUARY], ISSUED_ON));
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    // This is what `quotes.line_items` stores — the cents, not a pointer to a
    // row that a future change could move.
    const snapshot = JSON.parse(JSON.stringify(issued.lines)) as typeof issued.lines;
    expect(snapshot[0].pricesUsed.sheetCostCents).toBe(24000);
    expect(snapshot[0].lineTotalCents).toBe(263000);
    expect(snapshot.reduce((n, l) => n + l.lineTotalCents, 0)).toBe(263000);
  });
});

describe('blankFieldsOf', () => {
  it('reports every required field blank when there is no version', () => {
    expect(blankFieldsOf(null)).toEqual(['sheetCostCents', 'perBendCents', 'perHemCents']);
  });
});

describe('priceBookChangeDelta', () => {
  it('records old value to new value, with the dates that bound them', () => {
    const delta = priceBookChangeDelta(JANUARY, OCTOBER);
    expect(delta.old.sheetCostCents).toBe(24000);
    expect(delta.new.sheetCostCents).toBe(31000);
    expect(delta.old.effectiveFrom).toBe('2026-01-01');
    expect(delta.new.effectiveFrom).toBe('2026-10-01');
  });

  it('records the first-ever price as null -> value, not as 0 -> value', () => {
    const delta = priceBookChangeDelta(null, JANUARY);
    expect(delta.old.sheetCostCents).toBeNull();
    expect(delta.old.effectiveFrom).toBeNull();
    expect(delta.new.sheetCostCents).toBe(24000);
  });
});

describe('toEffectiveDate', () => {
  it('keeps a date a date', () => {
    expect(toEffectiveDate('2026-10-01')).toBe('2026-10-01');
    expect(toEffectiveDate('2026-10-01T18:30:00.000Z')).toBe('2026-10-01');
    expect(toEffectiveDate(new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-10-01');
  });
});
