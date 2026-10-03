/**
 * NEXUS LOGIC — "does AFS collect sales tax in this state, on this date?"
 *
 * Pure. No database, no clock, no environment. The caller supplies the list and
 * the date, which is what makes every branch here a unit test rather than
 * something only a deployed environment can answer.
 *
 * ================== AN EMPTY LIST IS NOT "NO TAX OWED" ==================
 *
 * This file deliberately does NOT decide what an empty nexus list means. It
 * reports what the list says, and `calculate.ts` turns an empty list into
 * `not_configured` — because nobody has told AFS where it owes tax yet
 * (CLAUDE.md DATA BLOCKERS, checklist #31), and answering "no nexus, so zero"
 * would assert a legal fact AFS has not supplied. Keeping that decision in one
 * place means it cannot be made differently by a second caller.
 *
 * DATES ARE `YYYY-MM-DD` STRINGS and are compared with `<=` / `>=`, which is
 * correct because ISO date strings sort lexicographically. See NexusState's own
 * comment in types.ts for why no `Date` is allowed anywhere near this.
 */

import type { NexusBasis, NexusState } from './types';
import { NEXUS_BASES } from './types';

/** `YYYY-MM-DD`, and nothing else. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A two-letter uppercase state code, or `null` if the input is not one.
 *
 * Accepts padding and lower case, because a code typed into a form or read off a
 * pasted address arrives as `" tx "` constantly and normalising that is not a
 * risk. Refuses everything else — a three-letter code, a digit, a non-ASCII
 * letter — rather than passing it to a vendor, where it would surface as a shape
 * error a long way from the typo that caused it.
 *
 * NOTE `/^[A-Z]{2}$/` AND NOT `/^\w{2}$/`. `\w` matches digits and underscore,
 * so `T1` and `_X` would pass. And the test runs AFTER uppercasing, so the
 * character class does not need a lower-case half.
 */
export function normalizeStateCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

/** True when `value` is one of the four recorded nexus bases. */
export function isNexusBasis(value: unknown): value is NexusBasis {
  return typeof value === 'string' && (NEXUS_BASES as readonly string[]).includes(value);
}

/** True for a `YYYY-MM-DD` string. Does not check that the date is real. */
export function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}

/**
 * True when `onDate` falls inside the row's effective window.
 *
 * A null `effectiveTo` means "still current", so the window is open-ended. A row
 * whose window has not started yet, or has ended, is not in force — which is how
 * a nexus that AFS registered for next quarter can be recorded now without
 * taking effect today.
 */
export function isInEffect(row: NexusState, onDate: string): boolean {
  if (row.effectiveFrom > onDate) return false;
  if (row.effectiveTo !== null && row.effectiveTo < onDate) return false;
  return true;
}

/**
 * The nexus row for a state on a date, or `null`.
 *
 * Returns the row whether or not AFS is collecting on it: a recorded-but-not-
 * collecting nexus is a real row, and the caller needs to be able to tell it
 * apart from no row at all so it can say which it was. `isCollectingNexus`
 * below is the narrower question.
 *
 * `state_code` is UNIQUE in the database (migration 039), so at most one row can
 * match a code; the `find` is therefore not hiding an ambiguity. The window test
 * is still applied, because a retired row keeps its code.
 */
export function findNexusForState(
  list: readonly NexusState[],
  stateCode: string | null | undefined,
  onDate: string
): NexusState | null {
  const code = normalizeStateCode(stateCode);
  if (code === null) return null;
  return list.find((row) => row.stateCode === code && isInEffect(row, onDate)) ?? null;
}

/**
 * True only when AFS both HAS nexus in the state on that date AND is collecting
 * there. A row with `collecting: false` returns false — see NexusState's comment:
 * the accountant has told us nexus exists but registration is not complete, and
 * calculating a tax AFS cannot remit would be worse than calculating none.
 */
export function isCollectingNexus(
  list: readonly NexusState[],
  stateCode: string | null | undefined,
  onDate: string
): boolean {
  const row = findNexusForState(list, stateCode, onDate);
  return row !== null && row.collecting;
}

/** Every state AFS currently collects in, uppercase, sorted. For a summary line. */
export function collectingStateCodes(list: readonly NexusState[], onDate: string): string[] {
  return list
    .filter((row) => row.collecting && isInEffect(row, onDate))
    .map((row) => row.stateCode)
    .sort();
}

/**
 * A STABLE FINGERPRINT OF THE NEXUS LIST, AND IT IS LOAD-BEARING FOR THE CACHE.
 *
 * It goes into the cache key (see cache-key.ts). Without it, adding a state to
 * the nexus list would keep serving the cached "no nexus here" answer for the
 * whole TTL — a wrong answer produced by a CORRECT edit, which is the worst kind
 * because the person who made the edit has no reason to suspect it.
 *
 * Every field that can change an outcome is included: the code, whether AFS
 * collects, and the window. `id`, `note`, `registrationId` and `basis` are NOT —
 * none of them can change a calculated figure, and including them would discard
 * the cache on a typo fix in a note. Sorted, so the fingerprint does not depend
 * on the order the database happened to return rows in.
 */
export function nexusFingerprint(list: readonly NexusState[]): string {
  if (list.length === 0) return 'nexus:empty';
  const parts = list
    .map(
      (row) =>
        `${row.stateCode}:${row.collecting ? '1' : '0'}:${row.effectiveFrom}:${row.effectiveTo ?? '-'}`
    )
    .sort();
  return `nexus:${parts.join('|')}`;
}
