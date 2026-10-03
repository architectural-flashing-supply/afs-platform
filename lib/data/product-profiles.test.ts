import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveStockLengthBySlug,
  resolveStockLengthByQuoteLabel,
  readProfileStockLengths,
  type ProfileStockLength,
} from './product-profiles';

/**
 * STOCK-LENGTH RESOLUTION, against the real seeded rows.
 *
 * The fixture below mirrors `product_profiles` as
 * supabase/migrations/002_seed_afs_data.sql seeds it (lines 89-142): twelve
 * rows, ten with a `standard_length_ft`, and the two with NULL being exactly
 * the two `requires_consultation = true` rows. If that seed changes, this
 * fixture is what has to change with it — which is the point of writing it out
 * rather than reading it from the database.
 *
 * The three alias entries exist because app/quote/page.tsx's PROFILE_TYPES is a
 * free-text label list, not a foreign key, and three of its labels are
 * near-misses against the seeded `name` values. The other five unmatched labels
 * have no profile row at all and must resolve to null — per the spec's §3
 * "Only shown when product has standard stock lengths defined", that is a
 * silent no-render, not an error.
 */
const SEEDED_PROFILES: ProfileStockLength[] = [
  { slug: 'coping-cap', name: 'Coping Cap', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'base-flashing', name: 'Base Flashing', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'counter-flashing', name: 'Counter Flashing', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'drip-edge', name: 'Drip Edge', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'gravel-stop', name: 'Gravel Stop', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'fascia', name: 'Fascia', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'scupper', name: 'Scupper', standardLengthFt: null, maxLengthFt: null },
  { slug: 'valley-flashing', name: 'Valley Flashing', standardLengthFt: 10, maxLengthFt: 12 },
  { slug: 'expansion-joint', name: 'Expansion Joint', standardLengthFt: 10, maxLengthFt: 20 },
  {
    slug: 'window-door-flashing',
    name: 'Window & Door Flashing',
    standardLengthFt: 10,
    maxLengthFt: 12,
  },
  {
    slug: 'standing-seam-roofing',
    name: 'Standing Seam Roofing',
    standardLengthFt: 20,
    maxLengthFt: 40,
  },
  { slug: 'custom-profile', name: 'Custom Profile', standardLengthFt: null, maxLengthFt: null },
];

describe('resolveStockLengthBySlug', () => {
  it('resolves each seeded slug to its own standard length', () => {
    expect(resolveStockLengthBySlug(SEEDED_PROFILES, 'coping-cap'), 'coping cap stocks at 10 ft').toBe(10);
    expect(
      resolveStockLengthBySlug(SEEDED_PROFILES, 'standing-seam-roofing'),
      'standing seam stocks at 20 ft, not 10'
    ).toBe(20);
  });

  it('returns null for a profile whose standard length is genuinely NULL', () => {
    // Scupper and custom-profile are the two requires_consultation rows. NULL
    // is correct data there, not missing data: they have no standard length.
    expect(
      resolveStockLengthBySlug(SEEDED_PROFILES, 'scupper'),
      'a scupper has no standard stock length'
    ).toBe(null);
    expect(
      resolveStockLengthBySlug(SEEDED_PROFILES, 'custom-profile'),
      'nor does a fully custom profile'
    ).toBe(null);
  });

  it('returns null for a FlashDraft-only shape that has no profile row', () => {
    // lib/utils/profile-svg.ts's ProfileType is a 16-member union built for
    // FlashDraft geometry; only five of its values are real slugs.
    for (const slug of ['cleat', 'ridge', 'downspout', 'z-closure', 'chimney-cap']) {
      expect(
        resolveStockLengthBySlug(SEEDED_PROFILES, slug),
        `${slug} is a drawable shape, not a stocked profile`
      ).toBe(null);
    }
  });

  it('does not match a slug by prefix, case or whitespace', () => {
    for (const slug of ['coping', 'Coping-Cap', ' coping-cap', 'coping-cap ']) {
      expect(
        resolveStockLengthBySlug(SEEDED_PROFILES, slug),
        `"${slug}" is not the slug "coping-cap" and must not resolve as it`
      ).toBe(null);
    }
  });

  it('returns null when no profile has been loaded yet', () => {
    expect(
      resolveStockLengthBySlug([], 'coping-cap'),
      'before the fetch resolves there is nothing to match against'
    ).toBe(null);
  });
});

describe('resolveStockLengthByQuoteLabel', () => {
  it('resolves the nine labels that match a seeded name exactly', () => {
    const expected: [string, number | null][] = [
      ['Coping Cap', 10],
      ['Base Flashing', 10],
      ['Counter Flashing', 10],
      ['Drip Edge', 10],
      ['Gravel Stop', 10],
      ['Fascia', 10],
      ['Valley Flashing', 10],
      // These two match a row, but that row's standard length is NULL.
      ['Scupper', null],
      ['Custom Profile', null],
    ];

    for (const [label, lengthFt] of expected) {
      expect(
        resolveStockLengthByQuoteLabel(SEEDED_PROFILES, label),
        `the quote label "${label}" must resolve to ${String(lengthFt)}`
      ).toBe(lengthFt);
    }
  });

  it('resolves the three near-miss labels through the alias map', () => {
    // Each of these differs from the seeded `name` by real words, so an exact
    // match cannot find it and a prefix match would be a guess.
    expect(
      resolveStockLengthByQuoteLabel(SEEDED_PROFILES, 'Expansion Joint Cover'),
      '"Expansion Joint Cover" is the seeded "Expansion Joint"'
    ).toBe(10);
    expect(
      resolveStockLengthByQuoteLabel(SEEDED_PROFILES, 'Window / Door Flashing'),
      '"Window / Door Flashing" is the seeded "Window & Door Flashing"'
    ).toBe(10);
    expect(
      resolveStockLengthByQuoteLabel(SEEDED_PROFILES, 'Standing Seam Roofing Panel'),
      '"Standing Seam Roofing Panel" is the seeded "Standing Seam Roofing", which stocks at 20 ft'
    ).toBe(20);
  });

  it('returns null for the five labels that have no profile row at all', () => {
    for (const label of [
      'Step Flashing',
      'Conductor Head',
      'Downspout',
      'Reglet',
      'Wall Panel / Cladding',
    ]) {
      expect(
        resolveStockLengthByQuoteLabel(SEEDED_PROFILES, label),
        `"${label}" has no stocked profile, so the cut list must not render at all`
      ).toBe(null);
    }
  });

  it('returns null for the empty label the form starts with', () => {
    expect(
      resolveStockLengthByQuoteLabel(SEEDED_PROFILES, ''),
      'nothing is selected yet, so nothing resolves'
    ).toBe(null);
  });

  it('covers every one of the quote form’s seventeen labels, with no silent gap', () => {
    // app/quote/page.tsx's PROFILE_TYPES, verbatim. The assertion is that each
    // label resolves to a number or to null, and that the counts are what the
    // audit in TRIM_OPTIMIZER_SCOPE.md §3 found — so a label added to the form
    // without a decision about its stock length shows up here.
    const PROFILE_TYPES = [
      'Coping Cap',
      'Base Flashing',
      'Counter Flashing',
      'Step Flashing',
      'Drip Edge',
      'Gravel Stop',
      'Fascia',
      'Valley Flashing',
      'Scupper',
      'Conductor Head',
      'Downspout',
      'Expansion Joint Cover',
      'Reglet',
      'Window / Door Flashing',
      'Wall Panel / Cladding',
      'Standing Seam Roofing Panel',
      'Custom Profile',
    ];

    const resolved = PROFILE_TYPES.map((label) =>
      resolveStockLengthByQuoteLabel(SEEDED_PROFILES, label)
    );

    expect(resolved.filter((length) => length !== null).length, 'ten labels have a stock length').toBe(
      10
    );
    expect(resolved.filter((length) => length === null).length, 'seven do not').toBe(7);
  });
});

describe('readProfileStockLengths asks the catalog for exactly what it needs', () => {
  /**
   * A stub of the PostgREST boundary, not of the function under test. The
   * elite test standard requires external dependencies to be mocked rather
   * than called, and this is the only external dependency in this module. The
   * cast is the narrowest one that satisfies the parameter type — the stub
   * implements exactly the three calls the function makes.
   */
  function stubClient(data: unknown, error: { message: string } | null = null): SupabaseClient {
    const calls: { table?: string; columns?: string; filter?: [string, unknown] } = {};
    const builder = {
      select(columns: string) {
        calls.columns = columns;
        return this;
      },
      eq(column: string, value: unknown) {
        calls.filter = [column, value];
        return Promise.resolve({ data, error });
      },
    };
    return {
      from(table: string) {
        calls.table = table;
        return builder;
      },
      // Exposed so the assertions can check WHAT was asked for, not just what
      // came back.
      __calls: calls,
    } as unknown as SupabaseClient;
  }

  it('reads only the four stock-length columns, from active rows only', async () => {
    const client = stubClient([]);

    await readProfileStockLengths(client);

    const calls = (client as unknown as { __calls: { table: string; columns: string; filter: [string, unknown] } })
      .__calls;
    expect(calls.table, 'it reads product_profiles').toBe('product_profiles');
    expect(calls.columns, 'and only the columns it needs — never the whole row').toBe(
      'slug, name, standard_length_ft, max_length_ft'
    );
    expect(calls.filter, 'and only active profiles').toEqual(['is_active', true]);
  });

  it('maps snake_case columns onto the camelCase shape the resolvers expect', async () => {
    const client = stubClient([
      { slug: 'coping-cap', name: 'Coping Cap', standard_length_ft: 10, max_length_ft: 12 },
      { slug: 'scupper', name: 'Scupper', standard_length_ft: null, max_length_ft: null },
    ]);

    const { profiles } = await readProfileStockLengths(client);

    expect(profiles, 'both rows map field for field, NULL included').toEqual([
      { slug: 'coping-cap', name: 'Coping Cap', standardLengthFt: 10, maxLengthFt: 12 },
      { slug: 'scupper', name: 'Scupper', standardLengthFt: null, maxLengthFt: null },
    ]);
  });

  it('returns an empty list rather than throwing when the read comes back empty', async () => {
    // PostgREST returns `data: null` on an error. The optimizer section renders
    // nothing for an empty list, which is the right outcome: no stock length
    // resolves, so the spec's §3 condition is simply not met.
    expect(
      (await readProfileStockLengths(stubClient(null))).profiles,
      'null data becomes an empty list'
    ).toEqual([]);
    expect(
      (await readProfileStockLengths(stubClient([]))).profiles,
      'and so does an empty one'
    ).toEqual([]);
  });
});

describe('readProfileStockLengths tells a failed read apart from an empty one', () => {
  function readStub(data: unknown, error: { message: string } | null): SupabaseClient {
    const builder = {
      select() {
        return this;
      },
      eq() {
        return Promise.resolve({ data, error });
      },
    };
    return { from: () => builder } as unknown as SupabaseClient;
  }

  it('reports failed: false when the catalog is simply empty', async () => {
    const read = await readProfileStockLengths(readStub([], null));

    expect(read.profiles, 'no rows came back').toEqual([]);
    expect(
      read.failed,
      'but the read worked — the screen must say the catalog is empty, not that something broke'
    ).toBe(false);
  });

  it('reports failed: true when the read itself errored', async () => {
    const read = await readProfileStockLengths(readStub(null, { message: 'connection reset' }));

    expect(read.profiles, 'nothing usable came back').toEqual([]);
    expect(
      read.failed,
      'and the screen must not present an unknown as an empty catalog'
    ).toBe(true);
  });

  it('reports failed: false and the mapped rows on a successful read', async () => {
    const read = await readProfileStockLengths(
      readStub(
        [{ slug: 'fascia', name: 'Fascia', standard_length_ft: 10, max_length_ft: 12 }],
        null
      )
    );

    expect(read.failed, 'the read worked').toBe(false);
    expect(read.profiles, 'and the row is mapped').toEqual([
      { slug: 'fascia', name: 'Fascia', standardLengthFt: 10, maxLengthFt: 12 },
    ]);
  });
});
