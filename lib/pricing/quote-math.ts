/**
 * THE QUOTE MATHS. Pure — no database, no network, no clock beyond what is
 * handed in — so it can be unit-tested exhaustively and reproduced by hand.
 *
 * THE FORMULA, from docs/COMMAND_CENTER_V2_SPEC.md §2.6:
 *
 *   strips per sheet = floor(48 / blank width in inches)      <- DERIVED
 *   line = sheet cost / strips per sheet x qty
 *        + per bend x bends x qty
 *        + per hem  x hems  x qty
 *        + extras
 *
 * WHAT THE 48 AND THE 10 FT ARE. A sheet is 10 ft x 4 ft. A strip is cut along
 * the 10 ft length, so its width comes out of the 4 ft (48 in) dimension and
 * its length is the full 10 ft. That is why the blank width divides 48 and not
 * 120.
 *
 * THREE THINGS THIS REFUSES TO GUESS AT, EACH FAILING LOUDLY RATHER THAN
 * SILENTLY PRODUCING A NUMBER:
 *
 *  1. A blank width WIDER THAN 48 IN cannot be cut from a 4 ft sheet at all.
 *     The naive formula yields floor(48/60) = 0 strips and then divides by it.
 *     This returns a refusal naming the item instead.
 *  2. A finished length LONGER THAN 10 FT does not come off one sheet either.
 *     Same class of error, same treatment.
 *  3. A BLANK PRICE IS NOT ZERO. If the price book has no sheet cost, no per
 *     bend or no per hem for the item's material + gauge, no total is produced.
 *     CLAUDE.md's business model says the only dollar amount a customer ever
 *     sees is one AFS set deliberately; a total built on an unfilled cell is
 *     not that.
 *
 * WHAT IT DELIBERATELY DOES *NOT* DO: nest short pieces inside one 10 ft strip.
 * A piece shorter than 10 ft is charged a whole strip, because the drop is
 * scrap unless somebody plans the run — and planning the run is the trim-length
 * optimizer's job (SPEC_TRIM_LENGTH_OPTIMIZER.md), not this function's. Quoting
 * the optimistic number here would under-quote every short-piece job.
 */
import {
  PRICE_BOOK_FIELD_LABELS,
  PRICE_BOOK_REQUIRED_FIELDS,
  type PriceBookField,
  type QuoteItemInput,
  type QuoteLine,
  type QuoteProblem,
  type QuoteResult,
  type ResolvedPriceBookRow,
} from './types';

/** The 4 ft dimension of a sheet, in inches. A strip's width comes out of this. */
export const SHEET_WIDTH_IN = 48;
/** The 10 ft dimension of a sheet, in feet. A strip's length is this. */
export const SHEET_LENGTH_FT = 10;

/**
 * How many strips of `blankWidthIn` come out of one 48 in sheet.
 *
 * Throws on a width that cannot produce one — the caller is expected to have
 * validated, and a silent 0 here becomes a division by zero two lines later.
 */
export function stripsPerSheet(blankWidthIn: number): number {
  if (!Number.isFinite(blankWidthIn) || blankWidthIn <= 0) {
    throw new Error(`Blank width must be a positive number of inches, not ${blankWidthIn}.`);
  }
  if (blankWidthIn > SHEET_WIDTH_IN) {
    throw new Error(
      `A blank ${blankWidthIn} in wide does not fit across a ${SHEET_WIDTH_IN} in sheet, so it cannot be cut from one.`
    );
  }
  return Math.floor(SHEET_WIDTH_IN / blankWidthIn);
}

/** Cents, rounded once, at the end. Never a float in a total. */
function cents(value: number): number {
  return Math.round(value);
}

function matchKey(material: string | null, gauge: string | null): string {
  return `${(material ?? '').trim().toLowerCase()}|${(gauge ?? '').trim().toLowerCase()}`;
}

/**
 * Prices a whole job against the resolved price book.
 *
 * Returns either a complete quote or every reason it cannot be issued. It never
 * returns a partial total, because a partial total on a quote is a wrong total.
 */
export function quoteFromPriceBook(
  items: readonly QuoteItemInput[],
  priceBook: readonly ResolvedPriceBookRow[]
): QuoteResult {
  const byKey = new Map<string, ResolvedPriceBookRow>();
  for (const row of priceBook) {
    byKey.set(matchKey(row.item.material, row.item.gauge), row);
  }

  const problems: QuoteProblem[] = [];
  const lines: QuoteLine[] = [];

  items.forEach((item, itemIndex) => {
    const quantity = item.quantity;
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity) !== quantity) {
      problems.push({
        itemIndex,
        kind: 'bad-quantity',
        message: `"${item.description}" has a quantity of ${item.quantity}. Set a whole number of pieces before quoting.`,
      });
      return;
    }

    const row = byKey.get(matchKey(item.material, item.gauge));
    if (!row) {
      problems.push({
        itemIndex,
        kind: 'no-price-book-row',
        message:
          `"${item.description}" is ${item.material ?? 'an unnamed material'} in ${item.gauge ?? 'an unnamed gauge'}, ` +
          `and the price book has no row for that combination. Add it in Settings → Price book, then quote.`,
      });
      return;
    }

    if (row.item.retiredAt !== null) {
      problems.push({
        itemIndex,
        kind: 'no-price-book-row',
        message:
          `"${item.description}" uses ${row.item.material} ${row.item.gauge}, which has been retired from the price book. ` +
          `Un-retire it, or change the material on the job, before quoting.`,
      });
      return;
    }

    const version = row.version;
    if (!version) {
      problems.push({
        itemIndex,
        kind: 'blank-price',
        message:
          `${row.item.material} ${row.item.gauge} has no prices filled in yet, so "${item.description}" cannot be quoted. ` +
          `Fill it in under Settings → Price book.`,
      });
      return;
    }

    const blanks: PriceBookField[] = PRICE_BOOK_REQUIRED_FIELDS.filter((f) => version[f] === null);
    if (blanks.length > 0) {
      problems.push({
        itemIndex,
        kind: 'blank-price',
        message:
          `${row.item.material} ${row.item.gauge} is missing ${blanks
            .map((f) => PRICE_BOOK_FIELD_LABELS[f])
            .join(' and ')} in the price book, so "${item.description}" cannot be quoted. ` +
          `A blank is never treated as zero — fill it in under Settings → Price book.`,
      });
      return;
    }

    const blankWidthIn = item.blankWidthIn;
    if (blankWidthIn === null || !Number.isFinite(blankWidthIn) || blankWidthIn <= 0) {
      problems.push({
        itemIndex,
        kind: 'bad-blank-width',
        message:
          `"${item.description}" has no blank width, so there is no way to work out how many strips come off a sheet. ` +
          `Open it in FlashDraft and check the drawing.`,
      });
      return;
    }
    if (blankWidthIn > SHEET_WIDTH_IN) {
      problems.push({
        itemIndex,
        kind: 'bad-blank-width',
        message:
          `"${item.description}" measures ${blankWidthIn.toFixed(2)} in across the flat, which is wider than a ` +
          `${SHEET_WIDTH_IN} in sheet. It cannot be cut from one, so it cannot be priced this way.`,
      });
      return;
    }

    if (item.lengthFt !== null && Number.isFinite(item.lengthFt) && item.lengthFt > SHEET_LENGTH_FT) {
      problems.push({
        itemIndex,
        kind: 'bad-length',
        message:
          `"${item.description}" is ${item.lengthFt} ft long, and a sheet is ${SHEET_LENGTH_FT} ft. ` +
          `Split it into ${SHEET_LENGTH_FT} ft pieces, or price it by hand.`,
      });
      return;
    }

    const strips = stripsPerSheet(blankWidthIn);
    const sheetCostCents = version.sheetCostCents as number;
    const perBendCents = version.perBendCents as number;
    const perHemCents = version.perHemCents as number;
    const extras = version.extrasCents ?? 0;

    // Rounded ONCE per line, not once per piece, so 3 pieces at a third of a
    // cent each do not drift away from the sheet cost they came from.
    const materialCents = cents((sheetCostCents * quantity) / strips);
    const bendCents = cents(perBendCents * Math.max(0, item.bendCount) * quantity);
    const hemCents = cents(perHemCents * Math.max(0, item.hemCount) * quantity);

    lines.push({
      description: item.description,
      material: row.item.material,
      gauge: row.item.gauge,
      blankWidthIn,
      bendCount: Math.max(0, item.bendCount),
      hemCount: Math.max(0, item.hemCount),
      lengthFt: item.lengthFt,
      quantity,
      stripsPerSheet: strips,
      materialCents,
      bendCents,
      hemCents,
      extrasCents: extras,
      lineTotalCents: materialCents + bendCents + hemCents + extras,
      priceBookVersionId: version.id,
      pricesUsed: {
        sheetCostCents,
        perBendCents,
        perHemCents,
        extrasCents: extras,
      },
    });
  });

  if (problems.length > 0) return { ok: false, problems };

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  return {
    ok: true,
    lines,
    subtotalCents,
    // Freight and tax are NOT invented here. AFS's freight method and tax nexus
    // states are both open DATA BLOCKERS in CLAUDE.md; adding a guessed
    // percentage would put a made-up dollar amount on a customer's quote.
    totalCents: subtotalCents,
    priceBookVersionIds: Array.from(new Set(lines.map((l) => l.priceBookVersionId))),
  };
}

/** "$1,234.56" from 123456. The one place cents become a string. */
export function formatCents(value: number | null): string {
  if (value === null) return '—';
  return (value / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** "12.34" -> 1234. Returns null for an empty box, which is a blank, not a 0. */
export function parseDollarsToCents(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid';
  return Math.round(Number(trimmed) * 100);
}
