/**
 * The two places reading `product_profiles` dimension ranges can go wrong, both
 * of which turn "AFS states no limit here" into a limit:
 *
 *   1. A NULL bound becoming 0. `Number(null)` is 0 and `Number('')` is 0, so a
 *      naive conversion makes every absent minimum into "at least zero" —
 *      harmless-looking — and every absent MAXIMUM into "at most zero", which
 *      refuses every dimension on the profile.
 *   2. A Quote Builder label never finding its catalog row, so no range is
 *      checked at all and nobody says so.
 */

import { describe, expect, it } from 'vitest';
import {
  constraintsForQuoteLabels,
  mapProfileConstraintRow,
  type ProfileConstraintRow,
} from './product-profiles';

/** The real seeded Coping Cap row, column for column (migration 002). */
const COPING_CAP_ROW: ProfileConstraintRow = {
  slug: 'coping-cap',
  name: 'Coping Cap',
  min_width: 6,
  max_width: 36,
  min_height: 4,
  max_height: 16,
  min_leg_a: 2,
  max_leg_a: 8,
  min_leg_b: 2,
  max_leg_b: 8,
  max_length_ft: 12,
  requires_consultation: false,
};

/** The real seeded Fascia row: NULL on all four leg bounds. */
const FASCIA_ROW: ProfileConstraintRow = {
  slug: 'fascia',
  name: 'Fascia',
  min_width: 6,
  max_width: 24,
  min_height: 4,
  max_height: 12,
  min_leg_a: null,
  max_leg_a: null,
  min_leg_b: null,
  max_leg_b: null,
  max_length_ft: 12,
  requires_consultation: false,
};

/** The real seeded Custom Profile row: every bound NULL, consultation required. */
const CUSTOM_PROFILE_ROW: ProfileConstraintRow = {
  slug: 'custom-profile',
  name: 'Custom Profile',
  min_width: null,
  max_width: null,
  min_height: null,
  max_height: null,
  min_leg_a: null,
  max_leg_a: null,
  min_leg_b: null,
  max_leg_b: null,
  max_length_ft: null,
  requires_consultation: true,
};

describe('mapProfileConstraintRow', () => {
  it('carries every real bound across unchanged', () => {
    expect(
      mapProfileConstraintRow(COPING_CAP_ROW),
      'Expected the seeded Coping Cap ranges exactly as migration 002 wrote them. These are the numbers a customer is refused against, so a transposed pair would refuse the wrong dimension.'
    ).toEqual({
      slug: 'coping-cap',
      name: 'Coping Cap',
      minWidth: 6,
      maxWidth: 36,
      minHeight: 4,
      maxHeight: 16,
      minLegA: 2,
      maxLegA: 8,
      minLegB: 2,
      maxLegB: 8,
      maxLengthFt: 12,
      requiresConsultation: false,
    });
  });

  it('keeps a NULL bound as null and never as zero', () => {
    const mapped = mapProfileConstraintRow(FASCIA_ROW);
    for (const key of ['minLegA', 'maxLegA', 'minLegB', 'maxLegB'] as const) {
      expect(
        mapped[key],
        `Expected ${key} to be null; got ${JSON.stringify(mapped[key])}. The seeded Fascia row genuinely has no leg range, and a 0 maximum would refuse every leg dimension on a fascia — Number(null) is 0, which is exactly how that happens.`
      ).toBeNull();
    }
  });

  it('keeps every bound null on a profile with no ranges at all', () => {
    const mapped = mapProfileConstraintRow(CUSTOM_PROFILE_ROW);
    expect(
      Object.values(mapped).filter((value) => value === 0),
      `Expected no zeros anywhere in the mapped Custom Profile row; got ${JSON.stringify(mapped)}.`
    ).toEqual([]);
    expect(
      mapped.requiresConsultation,
      'Expected true: the seeded Custom Profile row requires AFS engineering review, and the customer is entitled to be told the quote will take longer.'
    ).toBe(true);
  });

  it('reads a numeric string from the driver as the number it is', () => {
    const asStrings = { ...COPING_CAP_ROW, min_width: '6.000', max_width: '36.000' } as unknown as ProfileConstraintRow;
    const mapped = mapProfileConstraintRow(asStrings);
    expect(
      mapped.minWidth,
      `Expected 6; got ${JSON.stringify(mapped.minWidth)}. A DECIMAL(8,3) column has arrived as a numeric string from PostgREST before, and a string compared against a number with < would be a silent wrong answer rather than an error.`
    ).toBe(6);
    expect(mapped.maxWidth, 'Expected 36 from "36.000".').toBe(36);
  });

  it('treats an empty string and an unparseable value as no constraint, not as zero', () => {
    const broken = {
      ...COPING_CAP_ROW,
      min_width: '',
      max_width: 'not a number',
    } as unknown as ProfileConstraintRow;
    const mapped = mapProfileConstraintRow(broken);
    expect(
      mapped.minWidth,
      'Expected null for an empty string. Number("") is 0, so the naive conversion turns a missing minimum into "at least zero".'
    ).toBeNull();
    expect(
      mapped.maxWidth,
      'Expected null for unparseable text rather than NaN, because every comparison against NaN is false and the bound would silently stop being checked without anything saying so.'
    ).toBeNull();
  });

  it('treats a NULL requires_consultation as false', () => {
    const mapped = mapProfileConstraintRow({ ...COPING_CAP_ROW, requires_consultation: null });
    expect(
      mapped.requiresConsultation,
      'Expected false. Claiming a profile needs engineering review on no evidence would delay a quote for no reason.'
    ).toBe(false);
  });
});

describe('constraintsForQuoteLabels', () => {
  const CATALOG = [
    mapProfileConstraintRow(COPING_CAP_ROW),
    mapProfileConstraintRow({
      ...COPING_CAP_ROW,
      slug: 'expansion-joint',
      name: 'Expansion Joint',
      max_length_ft: 20,
      requires_consultation: true,
    }),
    mapProfileConstraintRow({
      ...COPING_CAP_ROW,
      slug: 'standing-seam-roofing',
      name: 'Standing Seam Roofing',
      max_length_ft: 40,
    }),
  ];

  it('resolves a Quote Builder label that differs from the catalog name', () => {
    const resolved = constraintsForQuoteLabels(CATALOG, ['Expansion Joint Cover']);
    expect(
      resolved.length,
      'Expected the aliased row found. "Expansion Joint Cover" is what the Quote Builder offers; "Expansion Joint" is what the catalog calls it, and without the alias no range would be checked and the customer would never know.'
    ).toBe(1);
    expect(
      resolved[0].name,
      'Expected the row re-announced under the customer\'s own label, so the engine\'s exact match succeeds and the refusal message uses the words the customer chose.'
    ).toBe('Expansion Joint Cover');
    expect(resolved[0].slug, 'Expected the real catalog slug kept, so an admin caller holding a slug still matches.').toBe(
      'expansion-joint'
    );
    expect(resolved[0].maxLengthFt, 'Expected the real seeded 20 ft limit, not the Coping Cap 12 ft.').toBe(20);
  });

  it('resolves the standing seam panel label', () => {
    expect(
      constraintsForQuoteLabels(CATALOG, ['Standing Seam Roofing Panel'])[0]?.slug,
      'Expected "standing-seam-roofing". The Quote Builder adds "Panel" to the catalog name, which an exact comparison would miss.'
    ).toBe('standing-seam-roofing');
  });

  it('resolves a label that already matches the catalog name', () => {
    expect(
      constraintsForQuoteLabels(CATALOG, ['Coping Cap'])[0]?.slug,
      'Expected the direct name match to work without an alias entry.'
    ).toBe('coping-cap');
  });

  it('returns nothing for a label with no catalog row, rather than a nearby one', () => {
    for (const label of ['Step Flashing', 'Conductor Head', 'Downspout', 'Reglet', 'Wall Panel / Cladding']) {
      expect(
        constraintsForQuoteLabels(CATALOG, [label]),
        `Expected [] for "${label}". It is one of the five Quote Builder labels with no product_profiles row at all; returning a near neighbour would refuse a customer against another profile's limits, which is worse than checking nothing and saying so.`
      ).toEqual([]);
    }
  });

  it('does not add the same row twice for a repeated label', () => {
    expect(
      constraintsForQuoteLabels(CATALOG, ['Coping Cap', 'Coping Cap']).length,
      'Expected one entry for a two-item request that names the same profile twice; duplicates would make the engine scan a list that grows with the request.'
    ).toBe(1);
  });

  it('returns nothing when the catalog could not be read', () => {
    expect(
      constraintsForQuoteLabels([], ['Coping Cap']),
      'Expected []. A guest cannot read product_profiles (its RLS requires a session), and the engine must fall through to its data-free rules rather than being handed a fabricated catalog.'
    ).toEqual([]);
  });
});
