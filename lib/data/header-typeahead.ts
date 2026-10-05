/**
 * THE HEADER TYPE-AHEAD — ranking, not fetching.
 *
 * v7 `hqShow` (line 1680) opens the dropdown at **two characters**, and shows
 * two groups in a fixed order:
 *
 *   1. COMPANIES whose name contains the FIRST token (max 2), each with a
 *      "New quote" shortcut.
 *   2. JOB ROWS matched by the full token-AND query (max 6), newest first.
 *
 * Then a footer: "See all N results, newest first", or — when nothing matched
 * at all — "Nothing found. Try the company name first."
 *
 * Company-first is the whole point: Steve types a company name far more often
 * than a profile word, so companies must never be pushed below job rows.
 *
 * Pure functions only. The route fetches; this ranks.
 */
import { matchTokens, sortRows, type ListRow } from '@/lib/data/quote-order-list';

/** v7 opens the dropdown at two characters (`if (v.length < 2)`). */
export const TYPEAHEAD_MIN_CHARS = 2;
/** v7 `cs.slice(0, 2)`. */
export const TYPEAHEAD_MAX_COMPANIES = 2;
/** v7 `rows.slice(0, 6)`. */
export const TYPEAHEAD_MAX_ROWS = 6;

export interface TypeaheadCompany {
  name: string;
  person: string;
}

export interface TypeaheadResult {
  companies: TypeaheadCompany[];
  rows: ListRow[];
  /** Every row that matched, before the 6-row cut — the footer counts these. */
  totalRows: number;
  /** v7's exact empty-state sentence, or null when there is something to show. */
  emptyMessage: string | null;
}

export const TYPEAHEAD_EMPTY_MESSAGE = 'Nothing found. Try the company name first.';

/**
 * v7 matches companies on the FIRST token only
 * (`v.toLowerCase().split(/\s+/)[0]`), not the whole query — so
 * "hill country drip edge" still surfaces Hill Country Roofing even though
 * "drip edge" is nowhere in the company name.
 */
export function matchCompanies(
  companies: TypeaheadCompany[],
  query: string,
  limit: number = TYPEAHEAD_MAX_COMPANIES
): TypeaheadCompany[] {
  const first = query.trim().toLowerCase().split(/\s+/)[0] ?? '';
  if (!first) return [];
  return companies.filter((c) => c.name.toLowerCase().includes(first)).slice(0, limit);
}

/** Job rows for the dropdown: token-AND, newest first, capped. */
export function matchRows(
  rows: ListRow[],
  query: string,
  limit: number = TYPEAHEAD_MAX_ROWS
): { rows: ListRow[]; total: number } {
  const matched = sortRows(
    rows.filter((r) => matchTokens(r, query)),
    'new'
  );
  return { rows: matched.slice(0, limit), total: matched.length };
}

/**
 * The whole dropdown, in v7's order. Below the minimum length the dropdown is
 * closed, which is represented as an empty result with no message — not as an
 * empty state, because v7 hides the box entirely rather than showing "nothing
 * found" while the user is still on the first keystroke.
 */
export function buildTypeahead(
  companies: TypeaheadCompany[],
  rows: ListRow[],
  query: string
): TypeaheadResult {
  const q = query.trim();
  if (q.length < TYPEAHEAD_MIN_CHARS) {
    return { companies: [], rows: [], totalRows: 0, emptyMessage: null };
  }
  const matchedCompanies = matchCompanies(companies, q);
  const { rows: matchedRows, total } = matchRows(rows, q);
  // v7: the "nothing found" line shows only when there are no rows AND no
  // companies — a company hit on its own is a useful result.
  const emptyMessage =
    total === 0 && matchedCompanies.length === 0 ? TYPEAHEAD_EMPTY_MESSAGE : null;
  return { companies: matchedCompanies, rows: matchedRows, totalRows: total, emptyMessage };
}

/** v7's footer line. Null when there are no rows to see all of. */
export function seeAllLabel(totalRows: number): string | null {
  if (totalRows === 0) return null;
  return `See all ${totalRows} result${totalRows === 1 ? '' : 's'}, newest first`;
}
