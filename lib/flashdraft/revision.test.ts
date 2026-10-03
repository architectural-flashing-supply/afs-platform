import { describe, expect, it } from 'vitest';
import { nextRevisionNumber } from './revision';

/**
 * The rule that was wrong for every modified draft, now asserted.
 *
 * The regression test is `a modified draft KEEPS its computed revision` — that
 * is the case `asDuplicate || !savedProfileId ? 1 : revision + 1` got wrong,
 * and it is the one `tests/e2e/modify-in-flashdraft.spec.ts:179` had been
 * failing on against the live app.
 */

const ID = 'c612e300-edd7-4146-9329-0bc2677d0cbb';
const SOURCE = '9e531edb-c931-9995-8f21-0bc2677d0cbb';

describe('a genuinely new drawing', () => {
  it('starts at 1', () => {
    expect(
      nextRevisionNumber({ revision: 1, savedProfileId: null, sourceProfileId: null, asDuplicate: false })
    ).toBe(1);
  });

  it('starts at 1 even if the component state somehow carried a number over', () => {
    // No own row and no ancestry means no history, whatever is on screen.
    expect(
      nextRevisionNumber({ revision: 7, savedProfileId: null, sourceProfileId: null, asDuplicate: false })
    ).toBe(1);
  });
});

describe('re-saving your own row', () => {
  it('advances the count', () => {
    expect(
      nextRevisionNumber({ revision: 3, savedProfileId: ID, sourceProfileId: null, asDuplicate: false })
    ).toBe(4);
  });

  it('survives a nonsense stored revision rather than advancing it into NaN', () => {
    // `dimensions->>'revision'` is JSONB with no constraint behind it, so this
    // branch needs the same sanitisation the ancestry branch does — `NaN + 1`
    // is NaN, and it would have been written straight to the row.
    for (const revision of [Number.NaN, -4, 0, 2.7]) {
      const out = nextRevisionNumber({ revision, savedProfileId: ID, sourceProfileId: null, asDuplicate: false });
      expect(Number.isInteger(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(2); // a re-save always advances past 1
    }
  });

  it('advances it for a row that itself came from a modification', () => {
    expect(
      nextRevisionNumber({ revision: 5, savedProfileId: ID, sourceProfileId: SOURCE, asDuplicate: false })
    ).toBe(6);
  });
});

describe('a modified draft — THE REGRESSION', () => {
  it('KEEPS the revision loadForModify worked out, and does not reset to 1', () => {
    // loadForModify sets revision = source.revision + 1, then nulls
    // savedProfileId so the first save is an INSERT and the LOCKED original is
    // never overwritten. A source at revision 4 must save as 5.
    expect(
      nextRevisionNumber({ revision: 5, savedProfileId: null, sourceProfileId: SOURCE, asDuplicate: false })
    ).toBe(5);
  });

  it('is not fooled by the INSERT, which is a storage detail', () => {
    // The old rule keyed on `!savedProfileId`, which is exactly this, and so
    // wrote 1 for every modified draft ever saved.
    expect(
      nextRevisionNumber({ revision: 2, savedProfileId: null, sourceProfileId: SOURCE, asDuplicate: false })
    ).not.toBe(1);
  });

  it('never writes 0, a negative, or a fraction from a nonsense source row', () => {
    const bad = [0, -3, 0.5, Number.NaN];
    for (const revision of bad) {
      const out = nextRevisionNumber({ revision, savedProfileId: null, sourceProfileId: SOURCE, asDuplicate: false });
      expect(out).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(out)).toBe(true);
    }
  });
});

describe('a duplicate', () => {
  it('starts its own count, unchanged from the original rule', () => {
    // Deliberately untouched by the fix: a duplicate is a separate copy the
    // user asked for, not the next revision of anything.
    expect(
      nextRevisionNumber({ revision: 9, savedProfileId: ID, sourceProfileId: null, asDuplicate: true })
    ).toBe(1);
    expect(
      nextRevisionNumber({ revision: 9, savedProfileId: null, sourceProfileId: SOURCE, asDuplicate: true })
    ).toBe(1);
  });
});
