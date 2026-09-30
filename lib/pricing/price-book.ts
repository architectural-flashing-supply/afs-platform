/**
 * PRICE-BOOK VERSIONING. Pure — the rule that decides which price was in force
 * on a given day, with no database in the way.
 *
 * THE ONE PROMISE THIS FILE KEEPS: an already-issued quote keeps the prices it
 * was built on, forever. Three separate mechanisms uphold it, and they are
 * deliberately redundant:
 *
 *  1. An edit INSERTS a new `price_book_versions` row with a new
 *     `effective_from`. It never updates the old one.
 *  2. The database refuses the update anyway — migration 035's
 *     `price_book_versions_append_only` trigger.
 *  3. The quote itself SNAPSHOTS the cents it used and the version id it used
 *     them from (`quotes.line_items`, `quotes.price_book_snapshot`), so even if
 *     both of the above were somehow undone, the issued document does not move.
 *
 * `resolvePriceBook` exists to make (1) provable in a unit test without a
 * database: resolve the same book twice, once as of the quote's date and once
 * as of today, and the older resolution is unchanged by the newer version.
 */
import {
  PRICE_BOOK_REQUIRED_FIELDS,
  type PriceBookField,
  type PriceBookItem,
  type PriceBookVersion,
  type ResolvedPriceBookRow,
} from './types';

/** YYYY-MM-DD, in the shop's own calendar terms. Dates here are dates, not instants. */
export function toEffectiveDate(value: Date | string): string {
  if (typeof value === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (m) return m[1];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Not a date: ${value}`);
    return parsed.toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/**
 * The version in force for one item on `asOf`: the latest `effective_from` that
 * is not in the future relative to it.
 *
 * A version dated tomorrow is NOT in force today. That is what makes "set the
 * new price to start on the first of next month" a real, safe thing for Steve
 * to do: the quote he sends this afternoon still uses today's price.
 */
export function versionInForce(
  versions: readonly PriceBookVersion[],
  asOf: string
): PriceBookVersion | null {
  let best: PriceBookVersion | null = null;
  for (const v of versions) {
    if (v.effectiveFrom > asOf) continue;
    if (best === null || v.effectiveFrom > best.effectiveFrom) best = v;
    // Two versions on the same day: the one entered later wins, because that is
    // the correction. A same-day correction is the one case where "latest
    // effective_from" alone is not enough to decide.
    else if (v.effectiveFrom === best.effectiveFrom && v.createdAt > best.createdAt) best = v;
  }
  return best;
}

/** Which of the required prices are still blank on a version. */
export function blankFieldsOf(version: PriceBookVersion | null): PriceBookField[] {
  if (!version) return [...PRICE_BOOK_REQUIRED_FIELDS];
  return PRICE_BOOK_REQUIRED_FIELDS.filter((f) => version[f] === null);
}

/**
 * The whole price book as it stood on one date.
 *
 * Retired items are INCLUDED, carrying their `retiredAt`. They have to be: a
 * quote issued before the retirement still has to resolve, and the quote maths
 * is the right place to refuse a retired row on a NEW quote, with a sentence
 * that says so.
 */
export function resolvePriceBook(
  items: readonly PriceBookItem[],
  versions: readonly PriceBookVersion[],
  asOf: string
): ResolvedPriceBookRow[] {
  const byItem = new Map<string, PriceBookVersion[]>();
  for (const v of versions) {
    const list = byItem.get(v.itemId);
    if (list) list.push(v);
    else byItem.set(v.itemId, [v]);
  }

  return items
    .map((item) => {
      const version = versionInForce(byItem.get(item.id) ?? [], asOf);
      const blankFields = blankFieldsOf(version);
      return { item, version, blankFields, isComplete: blankFields.length === 0 };
    })
    .sort((a, b) => a.item.displayOrder - b.item.displayOrder);
}

/**
 * Can a quote be issued from this book at all? Used by the Job screen to say
 * "the price book is empty" once, instead of repeating it per line.
 */
export function priceBookHasAnyPrices(rows: readonly ResolvedPriceBookRow[]): boolean {
  return rows.some((r) => r.isComplete && r.item.retiredAt === null);
}

/**
 * The old-value/new-value pair a price-book change writes into the pricing
 * ledger. Built here rather than in the route so the shape is testable and the
 * same whichever writer produces it.
 */
export function priceBookChangeDelta(
  previous: PriceBookVersion | null,
  next: PriceBookVersion
): { old: PriceBookDelta; new: PriceBookDelta } {
  const fields: PriceBookField[] = ['sheetCostCents', 'perBendCents', 'perHemCents', 'extrasCents'];
  const oldValue: PriceBookDelta = { effectiveFrom: previous?.effectiveFrom ?? null };
  const newValue: PriceBookDelta = { effectiveFrom: next.effectiveFrom };
  for (const f of fields) {
    oldValue[f] = previous ? previous[f] : null;
    newValue[f] = next[f];
  }
  return { old: oldValue, new: newValue };
}

/**
 * One side of a price-book change, as it is written into the ledger's
 * `old_value` / `new_value`. `effectiveFrom` is carried too: "what it was" is
 * not a complete answer without "from when".
 */
export interface PriceBookDelta {
  effectiveFrom: string | null;
  sheetCostCents?: number | null;
  perBendCents?: number | null;
  perHemCents?: number | null;
  extrasCents?: number | null;
}
