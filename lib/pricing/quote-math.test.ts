import { describe, it, expect } from 'vitest';
import {
  quoteFromPriceBook,
  stripsPerSheet,
  formatCents,
  parseDollarsToCents,
  SHEET_WIDTH_IN,
} from './quote-math';
import type { PriceBookVersion, QuoteItemInput, ResolvedPriceBookRow } from './types';
import { blankFieldsOf } from './price-book';

/**
 * THE PRICING MATHS.
 *
 * Every expected total below is worked out BY HAND in the test's own comment,
 * because the acceptance criterion in docs/COMMAND_CENTER_V2_SPEC.md §Phase 3
 * is literally "a quote total is reproducible by hand from the price book". A
 * test that computed the expectation with the same formula as the code would
 * prove only that the code agrees with itself.
 */

function version(over: Partial<PriceBookVersion> = {}): PriceBookVersion {
  return {
    id: 'v1',
    itemId: 'i1',
    sheetCostCents: 24000, // $240.00 a sheet
    perBendCents: 150, //     $1.50 a bend
    perHemCents: 275, //      $2.75 a hem
    extrasCents: null,
    extrasNote: null,
    effectiveFrom: '2026-01-01',
    note: null,
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function book(v: PriceBookVersion | null, over: Partial<ResolvedPriceBookRow['item']> = {}): ResolvedPriceBookRow[] {
  const item = { id: 'i1', material: 'Galvalume', gauge: '24 GA', displayOrder: 1, retiredAt: null, ...over };
  const blankFields = blankFieldsOf(v);
  return [{ item, version: v, blankFields, isComplete: blankFields.length === 0 }];
}

function item(over: Partial<QuoteItemInput> = {}): QuoteItemInput {
  return {
    description: 'Drip Edge',
    material: 'Galvalume',
    gauge: '24 GA',
    blankWidthIn: 12,
    bendCount: 2,
    hemCount: 1,
    lengthFt: 10,
    quantity: 40,
    ...over,
  };
}

describe('stripsPerSheet', () => {
  it('derives strips from the 4 ft (48 in) dimension of the sheet', () => {
    expect(stripsPerSheet(12)).toBe(4); // 48 / 12
    expect(stripsPerSheet(16)).toBe(3);
    expect(stripsPerSheet(48)).toBe(1); // exactly one full-width strip
  });

  it('rounds DOWN, because a partial strip is not a piece', () => {
    expect(stripsPerSheet(10)).toBe(4); // 4.8 -> 4, the 8 in remainder is scrap
    expect(stripsPerSheet(7)).toBe(6); // 6.857 -> 6
  });

  it('refuses a blank wider than the sheet instead of returning 0', () => {
    // The naive formula gives floor(48/60) = 0 and then divides by it. This is
    // the edge case the spec's own acceptance criterion calls out.
    expect(() => stripsPerSheet(SHEET_WIDTH_IN + 0.01)).toThrow(/does not fit across/);
    expect(() => stripsPerSheet(60)).toThrow(/does not fit across/);
  });

  it('refuses a width that is zero, negative or not a number', () => {
    expect(() => stripsPerSheet(0)).toThrow(/positive number/);
    expect(() => stripsPerSheet(-4)).toThrow(/positive number/);
    expect(() => stripsPerSheet(Number.NaN)).toThrow(/positive number/);
  });
});

describe('quoteFromPriceBook — the total, worked by hand', () => {
  it('prices one line the way the spec says, to the cent', () => {
    // BY HAND, for 40 pieces of a 12 in blank with 2 bends and 1 hem:
    //   strips per sheet = floor(48 / 12)          = 4
    //   material         = $240.00 x 40 / 4        = $2,400.00 =   240000c
    //   bends            = $1.50 x 2 x 40          =   $120.00 =    12000c
    //   hems             = $2.75 x 1 x 40          =   $110.00 =    11000c
    //   extras           = none                    =     $0.00 =        0c
    //   line total                                 = $2,630.00 =   263000c
    const result = quoteFromPriceBook([item()], book(version()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [line] = result.lines;
    expect(line.stripsPerSheet).toBe(4);
    expect(line.materialCents).toBe(240000);
    expect(line.bendCents).toBe(12000);
    expect(line.hemCents).toBe(11000);
    expect(line.extrasCents).toBe(0);
    expect(line.lineTotalCents).toBe(263000);
    expect(result.subtotalCents).toBe(263000);
    expect(result.totalCents).toBe(263000);
  });

  it('adds extras once per line, not once per piece', () => {
    // Extras are a per-line charge in the spec's formula (no "x qty" on it).
    const result = quoteFromPriceBook([item()], book(version({ extrasCents: 5000 })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0].extrasCents).toBe(5000);
    expect(result.lines[0].lineTotalCents).toBe(263000 + 5000);
  });

  it('records the price-book version every line was priced from', () => {
    const result = quoteFromPriceBook([item()], book(version({ id: 'version-abc' })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0].priceBookVersionId).toBe('version-abc');
    expect(result.priceBookVersionIds).toEqual(['version-abc']);
    expect(result.lines[0].pricesUsed).toEqual({
      sheetCostCents: 24000,
      perBendCents: 150,
      perHemCents: 275,
      extrasCents: 0,
    });
  });

  it('rounds once per line, so three pieces off a seven-strip sheet do not drift', () => {
    // 24000 x 3 / 7 = 10285.714...  -> 10286c. Rounding per piece would give
    // 3 x round(3428.57) = 3 x 3429 = 10287c, a cent adrift from the sheet.
    const result = quoteFromPriceBook(
      [item({ blankWidthIn: 7, quantity: 3, bendCount: 0, hemCount: 0 })],
      book(version())
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0].stripsPerSheet).toBe(6);
    expect(result.lines[0].materialCents).toBe(Math.round((24000 * 3) / 6));
  });

  it('matches material and gauge case- and whitespace-insensitively', () => {
    const result = quoteFromPriceBook(
      [item({ material: '  galvalume ', gauge: '24 ga' })],
      book(version())
    );
    expect(result.ok).toBe(true);
  });

  it('sums several lines', () => {
    const result = quoteFromPriceBook([item(), item({ quantity: 10, bendCount: 0, hemCount: 0 })], book(version()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // second line: 24000 x 10 / 4 = 60000c, no bends, no hems
    expect(result.subtotalCents).toBe(263000 + 60000);
  });
});

describe('quoteFromPriceBook — what it refuses, and what it says', () => {
  it('BLOCKS a quote when a price is blank, and never treats the blank as zero', () => {
    const result = quoteFromPriceBook([item()], book(version({ perBendCents: null })));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].kind).toBe('blank-price');
    expect(result.problems[0].message).toContain('Per bend');
    expect(result.problems[0].message).toContain('never treated as zero');
  });

  it('BLOCKS a quote when the item has never been priced at all', () => {
    const result = quoteFromPriceBook([item()], book(null));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].kind).toBe('blank-price');
    expect(result.problems[0].message).toContain('no prices filled in yet');
    // The SAME sentence as the part-filled case. Both refusals are about the
    // same rule, so they say the same thing about it.
    expect(result.problems[0].message).toContain('never treated as zero');
  });

  it('treats a blank EXTRAS as $0, because a row with no extras is priced', () => {
    const result = quoteFromPriceBook([item()], book(version({ extrasCents: null })));
    expect(result.ok).toBe(true);
  });

  it('BLOCKS when the price book has no row for that material and gauge', () => {
    const result = quoteFromPriceBook([item({ material: 'Copper', gauge: '16 oz' })], book(version()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].kind).toBe('no-price-book-row');
    expect(result.problems[0].message).toContain('Settings');
  });

  it('BLOCKS on a retired row, and says to un-retire it', () => {
    const result = quoteFromPriceBook([item()], book(version(), { retiredAt: '2026-06-01T00:00:00.000Z' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].message).toContain('retired');
  });

  it('BLOCKS a blank wider than the sheet rather than dividing by zero strips', () => {
    const result = quoteFromPriceBook([item({ blankWidthIn: 60 })], book(version()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].kind).toBe('bad-blank-width');
    expect(result.problems[0].message).toContain('48 in sheet');
  });

  it('BLOCKS when there is no drawing to measure a blank width from', () => {
    const result = quoteFromPriceBook([item({ blankWidthIn: null })], book(version()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].kind).toBe('bad-blank-width');
  });

  it('BLOCKS a piece longer than the 10 ft sheet', () => {
    const result = quoteFromPriceBook([item({ lengthFt: 12 })], book(version()));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].kind).toBe('bad-length');
  });

  it('BLOCKS a quantity that is zero or fractional', () => {
    expect(quoteFromPriceBook([item({ quantity: 0 })], book(version())).ok).toBe(false);
    expect(quoteFromPriceBook([item({ quantity: 2.5 })], book(version())).ok).toBe(false);
  });

  it('reports EVERY problem at once, so a blocked quote is fixed in one pass', () => {
    const result = quoteFromPriceBook(
      [item({ blankWidthIn: 60 }), item({ quantity: 0 }), item({ material: 'Zinc' })],
      book(version())
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.itemIndex)).toEqual([0, 1, 2]);
  });

  it('never returns a partial total — a blocked quote has no numbers on it', () => {
    const result = quoteFromPriceBook([item(), item({ blankWidthIn: 60 })], book(version()));
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('subtotalCents');
  });
});

describe('money formatting', () => {
  it('renders a blank as an em dash, never as $0.00', () => {
    expect(formatCents(null)).toBe('—');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(263000)).toBe('$2,630.00');
  });

  it('parses an empty box to null (a blank), not to 0', () => {
    expect(parseDollarsToCents('')).toBeNull();
    expect(parseDollarsToCents('   ')).toBeNull();
    expect(parseDollarsToCents('0')).toBe(0);
  });

  it('parses dollars to cents, and rejects anything that is not money', () => {
    expect(parseDollarsToCents('240')).toBe(24000);
    expect(parseDollarsToCents('$1,240.50')).toBe(124050);
    expect(parseDollarsToCents('2.5')).toBe(250);
    expect(parseDollarsToCents('abc')).toBe('invalid');
    expect(parseDollarsToCents('1.234')).toBe('invalid');
    expect(parseDollarsToCents('-5')).toBe('invalid');
  });
});
