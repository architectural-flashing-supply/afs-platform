/**
 * EES-OVN.08 AC-15 … AC-18, plus the cache fingerprint (AC-30's other half).
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeStateCode,
  isNexusBasis,
  isIsoDateString,
  isInEffect,
  findNexusForState,
  isCollectingNexus,
  collectingStateCodes,
  nexusFingerprint,
} from './nexus';
import {
  FIXTURE_TODAY,
  NEXUS_CA_NOT_COLLECTING,
  NEXUS_LIST_EMPTY,
  NEXUS_LIST_MIXED,
  NEXUS_NM_FUTURE,
  NEXUS_OK_EXPIRED,
  NEXUS_TX_COLLECTING,
} from '@/tests/fixtures/tax/nexus';

describe('normalizeStateCode — AC-18 boundary table', () => {
  it.each<[string | null | undefined, string | null, string]>([
    ['TX', 'TX', 'the ordinary case'],
    ['tx', 'TX', 'lower case is normalised, not refused'],
    ['  TX ', 'TX', 'padding from a pasted address is normalised'],
    [' tx\t', 'TX', 'tabs count as padding'],
    ['', null, 'an empty string is not a state'],
    ['   ', null, 'whitespace only is not a state'],
    [null, null, 'null must not throw'],
    [undefined, null, 'undefined must not throw'],
    ['T', null, 'one letter is not a state code'],
    ['TEX', null, 'three letters is not a state code'],
    ['T1', null, 'a digit must be refused — /\\w{2}/ would have accepted this'],
    ['_X', null, 'underscore must be refused — /\\w{2}/ would have accepted this'],
    ['ÉX', null, 'a non-ASCII letter must be refused'],
    ['T X', null, 'an internal space is not padding'],
  ])('normalizeStateCode(%o) === %o — %s', (input, expected, why) => {
    expect(
      normalizeStateCode(input),
      `Expected ${JSON.stringify(expected)} for ${JSON.stringify(input)} because ${why}. ` +
        'A bad code that reaches the vendor surfaces as a shape error far from the typo.'
    ).toBe(expected);
  });
});

describe('isNexusBasis', () => {
  it.each(['physical_presence', 'economic_threshold', 'employee_presence', 'voluntary'])(
    'accepts %s',
    (basis) => {
      expect(isNexusBasis(basis), `${basis} is one of the four recorded bases.`).toBe(true);
    }
  );

  it.each([['', 'empty'], ['PHYSICAL_PRESENCE', 'wrong case'], ['guess', 'not a basis']])(
    'rejects %o (%s)',
    (value) => {
      expect(
        isNexusBasis(value),
        `"${value}" must be refused — these four values are also the migration's CHECK constraint, ` +
          'so accepting a fifth here would produce a database error instead of a 400.'
      ).toBe(false);
    }
  );

  it.each([[null], [undefined], [42], [{}], [[]]])('rejects the non-string %o', (value) => {
    expect(isNexusBasis(value), 'A non-string must be refused without throwing.').toBe(false);
  });
});

describe('isIsoDateString', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isIsoDateString('2026-10-03')).toBe(true);
  });

  it.each([
    ['2026-10-3', 'an unpadded day would break lexicographic comparison'],
    ['10/03/2026', 'a US-format date is not this codebase convention'],
    ['2026-10-03T00:00:00Z', 'a timestamp carries an instant, which a date-only value must not'],
    ['', 'empty'],
  ])('rejects %o — %s', (value, why) => {
    expect(isIsoDateString(value), `Expected false for "${value}" because ${why}.`).toBe(false);
  });

  it('rejects a non-string without throwing', () => {
    expect(isIsoDateString(new Date())).toBe(false);
  });
});

describe('isInEffect — the effective window', () => {
  it('a row with an open-ended window is in effect today', () => {
    expect(
      isInEffect(NEXUS_TX_COLLECTING, FIXTURE_TODAY),
      'A null effectiveTo means "still current", so the window must be open-ended.'
    ).toBe(true);
  });

  it('a row whose window has closed is not in effect', () => {
    expect(
      isInEffect(NEXUS_OK_EXPIRED, FIXTURE_TODAY),
      `OK's window ends ${NEXUS_OK_EXPIRED.effectiveTo}, before ${FIXTURE_TODAY}. A deregistered ` +
        'state must not keep producing tax.'
    ).toBe(false);
  });

  it('a row whose window has not opened is not in effect', () => {
    expect(
      isInEffect(NEXUS_NM_FUTURE, FIXTURE_TODAY),
      `NM starts ${NEXUS_NM_FUTURE.effectiveFrom}, after ${FIXTURE_TODAY}. A nexus registered ahead ` +
        'of time must be recordable without taking effect yet.'
    ).toBe(false);
  });

  it('the first day of the window is inclusive', () => {
    expect(
      isInEffect(NEXUS_TX_COLLECTING, NEXUS_TX_COLLECTING.effectiveFrom),
      'effectiveFrom is the first day tax applies, so the boundary is inclusive.'
    ).toBe(true);
  });

  it('the last day of the window is inclusive', () => {
    const lastDay = NEXUS_OK_EXPIRED.effectiveTo;
    expect(lastDay, 'Fixture must carry a closing date for this assertion to mean anything.').not.toBeNull();
    expect(
      isInEffect(NEXUS_OK_EXPIRED, lastDay as string),
      'effectiveTo is the last day tax applies, so the boundary is inclusive.'
    ).toBe(true);
  });

  it('the day after the window is excluded', () => {
    expect(isInEffect(NEXUS_OK_EXPIRED, '2026-07-01')).toBe(false);
  });

  it('the day before the window is excluded', () => {
    expect(isInEffect(NEXUS_TX_COLLECTING, '2025-12-31')).toBe(false);
  });
});

describe('findNexusForState', () => {
  it('finds an in-force row by code', () => {
    expect(findNexusForState(NEXUS_LIST_MIXED, 'TX', FIXTURE_TODAY)).toEqual(NEXUS_TX_COLLECTING);
  });

  it('finds a lower-case code', () => {
    expect(
      findNexusForState(NEXUS_LIST_MIXED, ' tx ', FIXTURE_TODAY),
      'The lookup must normalise its input, or a form value would miss a configured state.'
    ).toEqual(NEXUS_TX_COLLECTING);
  });

  it('AC-16: returns the row even when AFS is not collecting on it', () => {
    expect(
      findNexusForState(NEXUS_LIST_MIXED, 'CA', FIXTURE_TODAY),
      'A recorded-but-not-collecting nexus is a real row. The caller must be able to tell it apart ' +
        'from no row at all so it can say which it was.'
    ).toEqual(NEXUS_CA_NOT_COLLECTING);
  });

  it('AC-17: returns null for a row outside its window', () => {
    expect(findNexusForState(NEXUS_LIST_MIXED, 'OK', FIXTURE_TODAY)).toBeNull();
  });

  it('AC-15: returns null for a state with no row', () => {
    expect(findNexusForState(NEXUS_LIST_MIXED, 'FL', FIXTURE_TODAY)).toBeNull();
  });

  it('returns null for an empty list without throwing', () => {
    expect(findNexusForState(NEXUS_LIST_EMPTY, 'TX', FIXTURE_TODAY)).toBeNull();
  });

  it.each([['TEX'], [''], [null], [undefined]])('returns null for the invalid code %o', (code) => {
    expect(findNexusForState(NEXUS_LIST_MIXED, code, FIXTURE_TODAY)).toBeNull();
  });
});

describe('isCollectingNexus', () => {
  it('true for an in-force collecting state', () => {
    expect(isCollectingNexus(NEXUS_LIST_MIXED, 'TX', FIXTURE_TODAY)).toBe(true);
  });

  it('AC-16: false for a recorded state AFS is not collecting in', () => {
    expect(
      isCollectingNexus(NEXUS_LIST_MIXED, 'CA', FIXTURE_TODAY),
      'Calculating a tax AFS cannot remit is worse than calculating none, so collecting=false must ' +
        'never produce a figure.'
    ).toBe(false);
  });

  it('false for an expired window, a future window, an unknown state and an empty list', () => {
    expect(isCollectingNexus(NEXUS_LIST_MIXED, 'OK', FIXTURE_TODAY)).toBe(false);
    expect(isCollectingNexus(NEXUS_LIST_MIXED, 'NM', FIXTURE_TODAY)).toBe(false);
    expect(isCollectingNexus(NEXUS_LIST_MIXED, 'FL', FIXTURE_TODAY)).toBe(false);
    expect(isCollectingNexus(NEXUS_LIST_EMPTY, 'TX', FIXTURE_TODAY)).toBe(false);
  });
});

describe('collectingStateCodes', () => {
  it('lists only in-force collecting states, sorted', () => {
    expect(
      collectingStateCodes(NEXUS_LIST_MIXED, FIXTURE_TODAY),
      'Only TX is both collecting and in force on FIXTURE_TODAY: CA is not collecting, OK has ' +
        'expired, NM has not started.'
    ).toEqual(['TX']);
  });

  it('is empty for an empty list', () => {
    expect(collectingStateCodes(NEXUS_LIST_EMPTY, FIXTURE_TODAY)).toEqual([]);
  });

  it('is sorted regardless of input order', () => {
    const codes = collectingStateCodes(
      [NEXUS_TX_COLLECTING, { ...NEXUS_CA_NOT_COLLECTING, collecting: true }],
      FIXTURE_TODAY
    );
    expect(codes, 'A summary line must not reorder itself with the database row order.').toEqual(['CA', 'TX']);
  });
});

describe('nexusFingerprint — the cache-invalidation half of AC-30', () => {
  it('an empty list has its own stable fingerprint', () => {
    expect(nexusFingerprint(NEXUS_LIST_EMPTY)).toBe('nexus:empty');
  });

  it('is stable across calls for the same list', () => {
    expect(nexusFingerprint(NEXUS_LIST_MIXED)).toBe(nexusFingerprint(NEXUS_LIST_MIXED));
  });

  it('is independent of row order', () => {
    // ARRANGE
    const reversed = [...NEXUS_LIST_MIXED].reverse();

    // ACT / ASSERT
    expect(
      nexusFingerprint(reversed),
      'The fingerprint must not change with the order the database happened to return rows in, or ' +
        'the cache would be discarded at random.'
    ).toBe(nexusFingerprint(NEXUS_LIST_MIXED));
  });

  it('AC-30: adding a state changes the fingerprint', () => {
    // ARRANGE
    const before = nexusFingerprint([NEXUS_TX_COLLECTING]);
    const after = nexusFingerprint([NEXUS_TX_COLLECTING, NEXUS_CA_NOT_COLLECTING]);

    // ASSERT
    expect(
      after,
      'Adding a state MUST change the fingerprint. Without this, adding a nexus state would keep ' +
        'serving the cached "no nexus here" answer for the whole TTL — a wrong answer caused by a ' +
        'correct edit, which nobody would think to suspect.'
    ).not.toBe(before);
  });

  it('AC-30: flipping `collecting` changes the fingerprint', () => {
    const on = nexusFingerprint([NEXUS_TX_COLLECTING]);
    const off = nexusFingerprint([{ ...NEXUS_TX_COLLECTING, collecting: false }]);
    expect(
      off,
      'Stopping collection must invalidate cached figures for that state.'
    ).not.toBe(on);
  });

  it('AC-30: changing the effective window changes the fingerprint', () => {
    const open = nexusFingerprint([NEXUS_TX_COLLECTING]);
    const closed = nexusFingerprint([{ ...NEXUS_TX_COLLECTING, effectiveTo: '2026-10-01' }]);
    expect(closed, 'Closing a window must invalidate cached figures.').not.toBe(open);
  });

  it('does NOT change when only a note, registration id, basis or id changes', () => {
    // ARRANGE — four fields that cannot change a calculated figure.
    const base = nexusFingerprint([NEXUS_TX_COLLECTING]);
    const cosmetic = nexusFingerprint([
      {
        ...NEXUS_TX_COLLECTING,
        id: '00000000-0000-4000-8000-00000000ffff',
        note: 'a typo fix',
        registrationId: 'TEST-TX-9999',
        basis: 'voluntary',
      },
    ]);

    // ASSERT
    expect(
      cosmetic,
      'None of id/note/registrationId/basis can change a calculated figure, so including them would ' +
        'throw away every cached result on a typo fix in a note.'
    ).toBe(base);
  });
});
