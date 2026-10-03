import { describe, expect, it } from 'vitest';
import {
  FIXTURE_PRODUCT_COPING_CAP_COPPER,
  FIXTURE_PRODUCT_DRIP_EDGE_24GA,
  FIXTURE_PRODUCT_DRIP_EDGE_26GA,
  FIXTURE_PRODUCT_DRIP_EDGE_NO_GAUGE,
  FIXTURE_PRODUCT_LEGACY_MATERIAL_SPELLING,
} from '@/tests/fixtures/material-calculator';
import { resolveProduct } from './resolve-product';

/**
 * PRODUCT RESOLUTION.
 *
 * §4 takes a productId and app/quote/page.tsx has none — its profile, material and
 * gauge are free-text labels, not foreign keys (MATERIAL_CALC_SCOPE.md §6). These
 * tests pin how the labels are turned into a product, and more importantly WHEN
 * THEY ARE NOT: an ambiguous match must never pick one, because two products
 * differing only by gauge can carry different accessory rows and guessing would put
 * a fabricated accessory list in front of a customer.
 */
describe('resolveProduct — a single unambiguous match', () => {
  it('resolves one product from a profile name and a material name', () => {
    // ARRANGE
    const candidates = [FIXTURE_PRODUCT_DRIP_EDGE_24GA, FIXTURE_PRODUCT_COPING_CAP_COPPER];

    // ACT
    const result = resolveProduct(candidates, {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `One candidate matches "Drip Edge" + "Galvalume", so it must resolve to prd-0001. ` +
        `Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0001' });
  });

  it('matches the profile on its slug as well as its name', () => {
    // ARRANGE — FlashDraft speaks slugs, the quote wizard speaks names, both call
    // the same route
    // ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: 'drip-edge',
      materialLabel: 'Galvalume',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `A slug must match as well as a display name, or every FlashDraft caller resolves ` +
        `to nothing. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0001' });
  });

  it('ignores surrounding whitespace and letter case on both labels', () => {
    // ARRANGE / ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: '  DRIP EDGE  ',
      materialLabel: ' galvalume ',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `Labels arrive from a text field and from stored rows of differing vintage. Case ` +
        `and padding must not decide whether a customer gets accessory quantities. ` +
        `Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0001' });
  });

  it('matches a legacy material spelling through normalizeMaterialLabel', () => {
    // ARRANGE — migration 026 renamed Galvanized Galvalume to Galvalume, and
    // lib/data/catalog.ts's LEGACY_MATERIAL_ALIASES still resolves the old spelling
    // ACT
    const result = resolveProduct([FIXTURE_PRODUCT_LEGACY_MATERIAL_SPELLING], {
      profileLabel: 'Gravel Stop',
      materialLabel: 'Galvalume',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `A stored "Galvanized Galvalume" row must match a customer selecting "Galvalume". ` +
        `The alias map already exists in lib/data/catalog.ts; writing a second one here ` +
        `would be a second source of truth. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0005' });
  });
});

describe('resolveProduct — no match', () => {
  it('returns none for an empty candidate list, which is the real situation today', () => {
    // ARRANGE — `products` is unseeded: no INSERT INTO products exists in this repo
    // ACT
    const result = resolveProduct([], {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: '24 ga',
    });

    // ASSERT
    expect(
      result,
      `With no products seeded the answer must be a clean 'none' — not a throw and not a ` +
        `guess. SPEC §5 says the accessory section hides while checklist #17 is ` +
        `outstanding. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'none' });
  });

  it('returns none when the profile matches but the material does not', () => {
    // ARRANGE / ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: 'Drip Edge',
      materialLabel: 'Copper',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `Both halves must match. A Galvalume drip edge is not a copper one and carries ` +
        `different accessories. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'none' });
  });

  it('returns none when only the profile label is supplied', () => {
    // ARRANGE — a profile alone matches every material it is made in
    // ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: 'Drip Edge',
      materialLabel: null,
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `A profile with no material is ambiguity by construction, so it must not resolve ` +
        `even when exactly one candidate happens to match. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'none' });
  });

  it('returns none when only the material label is supplied', () => {
    // ARRANGE / ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: null,
      materialLabel: 'Galvalume',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `A material with no profile must not resolve. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'none' });
  });

  it('treats a whitespace-only label as absent', () => {
    // ARRANGE / ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: '   ',
      materialLabel: 'Galvalume',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `A field containing only spaces is an empty field. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'none' });
  });
});

describe('resolveProduct — ambiguity is never resolved by guessing', () => {
  it('returns ambiguous with the count for two matching candidates and no gauge', () => {
    // ARRANGE — the same profile and material at 24 ga and 26 ga
    const candidates = [FIXTURE_PRODUCT_DRIP_EDGE_24GA, FIXTURE_PRODUCT_DRIP_EDGE_26GA];

    // ACT
    const result = resolveProduct(candidates, {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: null,
    });

    // ASSERT
    expect(
      result,
      `Two products match and nothing distinguishes them, so the answer is 'ambiguous' ` +
        `with matchCount 2 — never one of the two ids. Picking either would show accessory ` +
        `quantities belonging to a product the customer did not choose. ` +
        `Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'ambiguous', matchCount: 2 });
  });

  it('does not fall back to the first candidate, in either input order', () => {
    // ARRANGE — reversing the input must not produce a different answer
    const forwards = resolveProduct(
      [FIXTURE_PRODUCT_DRIP_EDGE_24GA, FIXTURE_PRODUCT_DRIP_EDGE_26GA],
      { profileLabel: 'Drip Edge', materialLabel: 'Galvalume', gaugeLabel: null }
    );
    const backwards = resolveProduct(
      [FIXTURE_PRODUCT_DRIP_EDGE_26GA, FIXTURE_PRODUCT_DRIP_EDGE_24GA],
      { profileLabel: 'Drip Edge', materialLabel: 'Galvalume', gaugeLabel: null }
    );

    // ASSERT
    expect(
      backwards,
      `Ambiguity must not depend on the order PostgREST happened to return rows in. ` +
        `Got ${JSON.stringify(backwards)} versus ${JSON.stringify(forwards)}.`
    ).toEqual(forwards);
  });
});

describe('resolveProduct — a gauge narrows, it never widens', () => {
  it('narrows two candidates to the one carrying the requested gauge', () => {
    // ARRANGE
    const candidates = [FIXTURE_PRODUCT_DRIP_EDGE_24GA, FIXTURE_PRODUCT_DRIP_EDGE_26GA];

    // ACT
    const result = resolveProduct(candidates, {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: '26 ga',
    });

    // ASSERT
    expect(
      result,
      `The gauge is the only thing distinguishing these two, so "26 ga" must resolve to ` +
        `prd-0002. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0002' });
  });

  it('falls back to the gauge-agnostic candidate when no candidate carries the gauge', () => {
    // ARRANGE — a product with no gauge_id applies at every gauge
    const candidates = [FIXTURE_PRODUCT_DRIP_EDGE_24GA, FIXTURE_PRODUCT_DRIP_EDGE_NO_GAUGE];

    // ACT
    const result = resolveProduct(candidates, {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: '22 ga',
    });

    // ASSERT
    expect(
      result,
      `No candidate is 22 ga, but prd-0003 has no gauge at all and therefore applies at ` +
        `every gauge. It must win over the 24 ga row rather than the request going ` +
        `ambiguous. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0003' });
  });

  it('stays ambiguous when the gauge tells us nothing', () => {
    // ARRANGE — neither candidate is 22 ga and neither is gauge-agnostic
    const candidates = [FIXTURE_PRODUCT_DRIP_EDGE_24GA, FIXTURE_PRODUCT_DRIP_EDGE_26GA];

    // ACT
    const result = resolveProduct(candidates, {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: '22 ga',
    });

    // ASSERT
    expect(
      result,
      `A gauge that matches neither candidate must leave the request ambiguous, not pick ` +
        `the nearest. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'ambiguous', matchCount: 2 });
  });

  it('does not let a gauge rescue a single candidate that already matched', () => {
    // ARRANGE — one candidate, requested gauge does not match it
    // ACT
    const result = resolveProduct([FIXTURE_PRODUCT_DRIP_EDGE_24GA], {
      profileLabel: 'Drip Edge',
      materialLabel: 'Galvalume',
      gaugeLabel: '26 ga',
    });

    // ASSERT — the gauge only narrows when there is something to narrow, so the one
    // profile+material match stands. The accessory rows hang off the product, and a
    // single Galvalume drip-edge product is the product whatever gauge was typed.
    expect(
      result,
      `With exactly one profile+material match, the gauge has nothing to narrow and the ` +
        `match stands. Treating a gauge mismatch as a rejection would hide accessories ` +
        `for every product whose gauge rows are not seeded. Got ${JSON.stringify(result)}.`
    ).toEqual({ status: 'resolved', productId: 'prd-0001' });
  });
});
