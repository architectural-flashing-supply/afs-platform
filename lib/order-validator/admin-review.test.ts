import { describe, expect, it } from 'vitest';
import { assumedLimitDisclosures, buildAdminReview } from './admin-review';
import { assumedLimitKeys } from './limits';
import {
  ALL_CONSTRAINTS,
  COPING_CAP_CONSTRAINTS,
  SELF_CROSSING_POINTS,
  VALID_COPING_CAP_ITEM,
  VALID_DRAWN_ITEM,
} from './fixtures';
import type { OrderValidatorItem } from './types';

describe('buildAdminReview', () => {
  it('reports a clean request as checked with nothing to flag', () => {
    const review = buildAdminReview([VALID_COPING_CAP_ITEM], ALL_CONSTRAINTS);
    expect(review.checked, 'Expected the check to have run.').toBe(true);
    expect(review.findings, 'Expected no findings on a valid coping cap.').toEqual([]);
    expect(
      review.itemsWithRanges,
      'Expected 1 of 1 line covered by a product_profiles row. A clean panel has to be distinguishable from a panel that checked nothing, which is what this number is for.'
    ).toBe(1);
    expect(review.itemCount, 'Expected the line count reported.').toBe(1);
  });

  it('gives the admin the internal-only findings a customer never sees', () => {
    const oneStripItem: OrderValidatorItem = {
      ...VALID_DRAWN_ITEM,
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
      ],
    };
    const codes = buildAdminReview([oneStripItem], []).findings.map((f) => f.code);
    expect(
      codes,
      'Expected the strip note. It is admin scope because how many strips come off a sheet is cost-adjacent, and the estimator is exactly who needs it.'
    ).toContain('OV_BLANK_WIDTH_ONE_STRIP');
    expect(
      codes,
      'Expected the unknown-profile note. "AFS holds no dimension ranges for a Custom FlashDraft Profile" is what makes a silent pass distinguishable from a pass that checked something.'
    ).toContain('OV_PROFILE_CONSTRAINTS_UNKNOWN');
  });

  it('counts only the lines that had a product_profiles row behind them', () => {
    const review = buildAdminReview(
      [VALID_COPING_CAP_ITEM, { ...VALID_DRAWN_ITEM, points: undefined }],
      [COPING_CAP_CONSTRAINTS]
    );
    expect(
      review.itemsWithRanges,
      `Expected 1 of 2: the coping cap has a seeded row and "Custom FlashDraft Profile" does not. Got ${review.itemsWithRanges}.`
    ).toBe(1);
    expect(review.itemCount, 'Expected both lines counted.').toBe(2);
  });

  it('reports a request with a self-crossing drawing as blocked', () => {
    const review = buildAdminReview([{ ...VALID_DRAWN_ITEM, points: SELF_CROSSING_POINTS }], []);
    expect(
      review.blocked,
      'Expected blocked: the metal would have to pass through itself, and an estimator should see that before pricing it.'
    ).toBe(true);
    expect(review.counts.error, 'Expected one error counted.').toBeGreaterThan(0);
  });

  it('returns a not-checked result rather than throwing when the engine cannot run', () => {
    // A frozen-prototype item whose every property access throws is the only way
    // to make the pure engine fail, and that is the point: if it somehow does,
    // this page must still render the estimator's quote form beside it.
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('simulated failure inside the engine');
        },
      }
    ) as OrderValidatorItem;
    const review = buildAdminReview([hostile], ALL_CONSTRAINTS);
    expect(
      review.checked,
      'Expected checked:false, not a throw. This runs during the SERVER render of /admin/quote-requests/[id], where PanelErrorBoundary cannot help — it catches render errors in a CLIENT subtree — so a throw here would take the whole route to its error.tsx and the estimator would lose the Send Quote form.'
    ).toBe(false);
    expect(review.findings, 'Expected no findings claimed when the check did not run.').toEqual([]);
    expect(
      review.blocked,
      'Expected false. A check that did not run must not be reported as a refusal.'
    ).toBe(false);
  });

  it('still discloses the assumed limits when the check could not run', () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('simulated failure');
        },
      }
    ) as OrderValidatorItem;
    expect(
      buildAdminReview([hostile], []).assumedLimits.length,
      'Expected the disclosure regardless: which thresholds are unconfirmed is a property of the limits table, not of this request.'
    ).toBe(assumedLimitKeys().length);
  });

  it('handles an empty line-item array', () => {
    const review = buildAdminReview([], ALL_CONSTRAINTS);
    expect(review.checked, 'Expected the check to have run.').toBe(true);
    expect(review.itemCount, 'Expected zero lines.').toBe(0);
    expect(review.itemsWithRanges, 'Expected zero covered lines, not a negative number.').toBe(0);
  });
});

describe('assumedLimitDisclosures', () => {
  it('returns one entry per unconfirmed limit, each with a label and a basis', () => {
    const disclosures = assumedLimitDisclosures();
    expect(
      disclosures.map((d) => d.key).sort(),
      'Expected exactly the keys assumedLimitKeys() reports, so the panel cannot drift from the limits table.'
    ).toEqual([...assumedLimitKeys()].sort());
    for (const disclosure of disclosures) {
      expect(
        disclosure.label.trim().length,
        `"${disclosure.key}" has no label, so the panel would render a blank row.`
      ).toBeGreaterThan(0);
      expect(
        disclosure.basis.trim().length,
        `"${disclosure.key}" has no basis. The whole point of the disclosure is telling an estimator WHY a threshold is unconfirmed.`
      ).toBeGreaterThan(0);
      expect(
        ['assumption', 'data-blocked'],
        `"${disclosure.key}" is disclosed as unconfirmed but its provenance is "${disclosure.provenance}". Only an assumption or a data-blocked limit belongs on this list; anything traceable to code or to the spec must not be presented to Steve as needing his confirmation.`
      ).toContain(disclosure.provenance);
    }
  });

  it('names the five placeholder numbers and the data-blocked list', () => {
    expect(
      assumedLimitDisclosures().map((d) => d.key).sort(),
      'Expected the five unconfirmed thresholds plus the incompatibility list that is waiting on checklist #38.'
    ).toEqual(
      [
        'incompatibleCombinations',
        'maxBendCountError',
        'maxBendCountWarn',
        'minFlangeLengthIn',
        'minHemFoldLengthIn',
        'zeroLengthEpsilonIn',
      ].sort()
    );
  });
});
