/**
 * THE PRICE BOOK AND THE QUOTE, as types.
 *
 * MONEY IS ALWAYS CENTS, ALWAYS AN INTEGER, AND `null` IS NOT ZERO.
 *
 * That last part is the rule the rest of this directory is built around. A
 * price Steve has not filled in yet is `null`. It renders as a marked blank, it
 * is never defaulted, never inferred from a similar material, and never quietly
 * treated as free. `quoteFromPriceBook` refuses to produce a total when a price
 * it needs is blank — see lib/pricing/quote-math.ts.
 */

/** One line of the price book: a material + gauge Steve can price. */
export interface PriceBookItem {
  id: string;
  material: string;
  gauge: string;
  displayOrder: number;
  /** Retired items keep their history; they just cannot start a new quote. */
  retiredAt: string | null;
}

/**
 * What that line cost, from a date. An edit INSERTS one of these; it never
 * overwrites the previous one, which is what lets an old quote keep the prices
 * it was built on forever.
 */
export interface PriceBookVersion {
  id: string;
  itemId: string;
  /** One 10 ft x 4 ft sheet. `null` = blank. */
  sheetCostCents: number | null;
  perBendCents: number | null;
  perHemCents: number | null;
  extrasCents: number | null;
  extrasNote: string | null;
  /** ISO date (YYYY-MM-DD). */
  effectiveFrom: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

/** An item together with the version that is in force on a given date. */
export interface ResolvedPriceBookRow {
  item: PriceBookItem;
  /** `null` when the item has never been priced at all. */
  version: PriceBookVersion | null;
  /** Which of the four prices are still blank. Empty = ready to quote from. */
  blankFields: PriceBookField[];
  /** True when every price this row needs is filled in. */
  isComplete: boolean;
}

export type PriceBookField = 'sheetCostCents' | 'perBendCents' | 'perHemCents' | 'extrasCents';

/** Plain-English names, used by the editor and by every refusal message. */
export const PRICE_BOOK_FIELD_LABELS: Record<PriceBookField, string> = {
  sheetCostCents: 'Sheet cost (10 × 4 ft)',
  perBendCents: 'Per bend',
  perHemCents: 'Per hem',
  extrasCents: 'Extras',
};

/**
 * `extras` is the one price that is legitimately optional: a row with no extras
 * is priced, not unpriced. The other three must be filled in before a quote can
 * be issued from the row.
 */
export const PRICE_BOOK_REQUIRED_FIELDS: readonly PriceBookField[] = [
  'sheetCostCents',
  'perBendCents',
  'perHemCents',
];

/** The measurable facts about one item on a job, taken from its real geometry. */
export interface QuoteItemInput {
  /** Free text as it appears on the quote, e.g. "Drip Edge". */
  description: string;
  material: string | null;
  gauge: string | null;
  /** Flat girth of the profile before bending, in inches. */
  blankWidthIn: number | null;
  bendCount: number;
  hemCount: number;
  /** Finished length of one piece, in feet. */
  lengthFt: number | null;
  quantity: number;
}

/** One priced line, with every number that produced it kept beside it. */
export interface QuoteLine {
  description: string;
  material: string | null;
  gauge: string | null;
  blankWidthIn: number | null;
  bendCount: number;
  hemCount: number;
  lengthFt: number | null;
  quantity: number;
  /** floor(48 / blankWidthIn) — derived, never stored. */
  stripsPerSheet: number;
  materialCents: number;
  bendCents: number;
  hemCents: number;
  extrasCents: number;
  lineTotalCents: number;
  /** The exact price-book version this line was priced from. */
  priceBookVersionId: string;
  pricesUsed: {
    sheetCostCents: number;
    perBendCents: number;
    perHemCents: number;
    extrasCents: number;
  };
}

/** A quote that can actually be issued. */
export interface PricedQuote {
  ok: true;
  lines: QuoteLine[];
  subtotalCents: number;
  totalCents: number;
  /** Every version id used, so the quote records what it was built on. */
  priceBookVersionIds: string[];
}

/**
 * A quote that CANNOT be issued, and the plain-English reason. Every reason is
 * written for a non-technical reader and names the row to go and fix.
 */
export interface BlockedQuote {
  ok: false;
  /** One entry per problem — a job can have several unpriced items. */
  problems: QuoteProblem[];
}

export interface QuoteProblem {
  /** Index into the input items, so the UI can point at the right row. */
  itemIndex: number;
  kind: 'no-price-book-row' | 'blank-price' | 'bad-blank-width' | 'bad-length' | 'bad-quantity';
  message: string;
}

export type QuoteResult = PricedQuote | BlockedQuote;
