import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveStockLengthBySlug,
  resolveStockLengthByQuoteLabel,
  readProfileStockLengths,
  STOCK_LENGTH_READ_TIMEOUT_MS,
  type ProfileStockLength,
} from './product-profiles';

/**
 * STOCK-LENGTH RESOLUTION.
 *
 * TWO FIXTURES, BECAUSE THE SEED FILE AND THE LIVE DATABASE DO NOT AGREE.
 *
 * `SEED_FILE_PROFILES` is `product_profiles` as
 * supabase/migrations/002_seed_afs_data.sql DECLARES it (lines 89-142): twelve
 * rows, ten with a `standard_length_ft`, and the two NULLs being exactly the two
 * `requires_consultation = true` rows. It is kept because it is the only fixture
 * that exercises the NULL branch at all — no live row has a NULL
 * `standard_length_ft` today, so without it that branch would be untested.
 *
 * `LIVE_PROFILES` is what the live project really holds, read over PostgREST on
 * 2026-10-03 while building the trim optimizer. It differs from the seed file in
 * ways nobody had recorded, and `max_length_ft` differs on nine of the twelve
 * rows as well (12 -> 20). The divergence is written up in
 * STATE_OF_THE_BUILD.md; nothing in this run changed a row, and this fixture
 * only records what was measured:
 *
 *   scupper         seed NULL/NULL  ->  live 10/10
 *   custom-profile  seed NULL/NULL  ->  live 10/20
 *   standing-seam-roofing  seed 20 ft std  ->  live 10 ft std
 *   window-door-flashing   seed name "Window & Door Flashing"
 *                          ->  live name "Window/Door Flashing"
 *   requires_consultation  seed true on two rows  ->  live false on all twelve
 *
 * The three alias entries exist because app/quote/page.tsx's PROFILE_TYPES is a
 * free-text label list, not a foreign key, and three of its labels are
 * near-misses against the stored `name` values. They resolve by SLUG, which is
 * why the live rename of window-door-flashing's display name did not break
 * that one. The five labels with no profile row at all must resolve to null —
 * per the spec's §3 "Only shown when product has standard stock lengths
 * defined", that is a silent no-render, not an error.
 */
const SEED_FILE_PROFILES: ProfileStockLength[] = [
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

/**
 * What the live project really holds, read over PostgREST on 2026-10-03. Every
 * row carries a 10 ft standard length — including the two the seed file leaves
 * NULL — so on the live data there is no profile row that resolves to null.
 */
const LIVE_PROFILES: ProfileStockLength[] = [
  { slug: 'base-flashing', name: 'Base Flashing', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'coping-cap', name: 'Coping Cap', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'counter-flashing', name: 'Counter Flashing', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'custom-profile', name: 'Custom Profile', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'drip-edge', name: 'Drip Edge', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'expansion-joint', name: 'Expansion Joint', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'fascia', name: 'Fascia', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'gravel-stop', name: 'Gravel Stop', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'scupper', name: 'Scupper', standardLengthFt: 10, maxLengthFt: 10 },
  { slug: 'standing-seam-roofing', name: 'Standing Seam Roofing', standardLengthFt: 10, maxLengthFt: 40 },
  { slug: 'valley-flashing', name: 'Valley Flashing', standardLengthFt: 10, maxLengthFt: 20 },
  { slug: 'window-door-flashing', name: 'Window/Door Flashing', standardLengthFt: 10, maxLengthFt: 20 },
];

/** app/quote/page.tsx's PROFILE_TYPES, verbatim. */
const QUOTE_PROFILE_TYPES = [
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

describe('resolveStockLengthBySlug', () => {
  it('resolves each seeded slug to its own standard length', () => {
    expect(resolveStockLengthBySlug(SEED_FILE_PROFILES, 'coping-cap'), 'coping cap stocks at 10 ft').toBe(10);
    expect(
      resolveStockLengthBySlug(SEED_FILE_PROFILES, 'standing-seam-roofing'),
      'standing seam stocks at 20 ft, not 10'
    ).toBe(20);
  });

  it('returns null for a profile whose standard length is genuinely NULL', () => {
    // Scupper and custom-profile are the two requires_consultation rows. NULL
    // is correct data there, not missing data: they have no standard length.
    expect(
      resolveStockLengthBySlug(SEED_FILE_PROFILES, 'scupper'),
      'a scupper has no standard stock length'
    ).toBe(null);
    expect(
      resolveStockLengthBySlug(SEED_FILE_PROFILES, 'custom-profile'),
      'nor does a fully custom profile'
    ).toBe(null);
  });

  it('returns null for a FlashDraft-only shape that has no profile row', () => {
    // lib/utils/profile-svg.ts's ProfileType is a 16-member union built for
    // FlashDraft geometry; only five of its values are real slugs.
    for (const slug of ['cleat', 'ridge', 'downspout', 'z-closure', 'chimney-cap']) {
      expect(
        resolveStockLengthBySlug(SEED_FILE_PROFILES, slug),
        `${slug} is a drawable shape, not a stocked profile`
      ).toBe(null);
    }
  });

  it('does not match a slug by prefix, case or whitespace', () => {
    for (const slug of ['coping', 'Coping-Cap', ' coping-cap', 'coping-cap ']) {
      expect(
        resolveStockLengthBySlug(SEED_FILE_PROFILES, slug),
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
        resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, label),
        `the quote label "${label}" must resolve to ${String(lengthFt)}`
      ).toBe(lengthFt);
    }
  });

  it('resolves the three near-miss labels through the alias map', () => {
    // Each of these differs from the seeded `name` by real words, so an exact
    // match cannot find it and a prefix match would be a guess.
    expect(
      resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, 'Expansion Joint Cover'),
      '"Expansion Joint Cover" is the seeded "Expansion Joint"'
    ).toBe(10);
    expect(
      resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, 'Window / Door Flashing'),
      '"Window / Door Flashing" is the seeded "Window & Door Flashing"'
    ).toBe(10);
    expect(
      resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, 'Standing Seam Roofing Panel'),
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
        resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, label),
        `"${label}" has no stocked profile, so the cut list must not render at all`
      ).toBe(null);
    }
  });

  it('returns null for the empty label the form starts with', () => {
    expect(
      resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, ''),
      'nothing is selected yet, so nothing resolves'
    ).toBe(null);
  });

  it('covers every one of the quote form’s seventeen labels, with no silent gap', () => {
    // The assertion is that each label resolves to a number or to null, and that
    // the counts are what the SEED FILE's values give — so a label added to the
    // form without a decision about its stock length shows up here.
    const resolved = QUOTE_PROFILE_TYPES.map((label) =>
      resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, label)
    );

    expect(
      resolved.filter((length) => length !== null).length,
      "ten labels have a stock length on the seed file's values"
    ).toBe(10);
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

describe('readProfileStockLengths does not wait forever', () => {
  it('reports a failure when the read never settles at all', async () => {
    // ARRANGE — a hard network abort (offline laptop, captive portal, blocked
    // domain) does NOT make this read reject promptly; the promise simply stays
    // pending. Observed in a real browser, which is why the timeout exists.
    vi.useFakeTimers();
    const hung = {
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return new Promise(() => {
            /* never settles, exactly like the aborted request */
          });
        },
      }),
    } as unknown as SupabaseClient;

    // ACT
    const pending = readProfileStockLengths(hung);
    await vi.advanceTimersByTimeAsync(STOCK_LENGTH_READ_TIMEOUT_MS);
    const read = await pending;

    // ASSERT
    expect(
      read.failed,
      'a hung read is a failure the screen can say something about, not a permanent "checking…"'
    ).toBe(true);
    expect(read.profiles, 'and it carries no rows').toEqual([]);

    vi.useRealTimers();
  });

  it('does not give up on a read that settles before the timeout', async () => {
    vi.useFakeTimers();
    const slowButFine = {
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  data: [
                    { slug: 'fascia', name: 'Fascia', standard_length_ft: 10, max_length_ft: 12 },
                  ],
                  error: null,
                }),
              STOCK_LENGTH_READ_TIMEOUT_MS - 1000
            );
          });
        },
      }),
    } as unknown as SupabaseClient;

    const pending = readProfileStockLengths(slowButFine);
    await vi.advanceTimersByTimeAsync(STOCK_LENGTH_READ_TIMEOUT_MS);
    const read = await pending;

    expect(read.failed, 'a slow read that arrives in time is not a failure').toBe(false);
    expect(read.profiles.length, 'and its row is kept').toBe(1);

    vi.useRealTimers();
  });
});

describe('resolution against the LIVE rows, as measured on 2026-10-03', () => {
  it('resolves twelve of the seventeen quote labels, and exactly five to null', () => {
    // ARRANGE / ACT
    const resolved = QUOTE_PROFILE_TYPES.map((label) =>
      resolveStockLengthByQuoteLabel(LIVE_PROFILES, label)
    );

    // ASSERT
    expect(
      resolved.filter((length) => length !== null).length,
      'every one of the twelve live rows carries a 10 ft standard length, so twelve labels resolve'
    ).toBe(12);
    expect(
      QUOTE_PROFILE_TYPES.filter((label, i) => resolved[i] === null),
      'and only the five labels with no profile row at all resolve to nothing'
    ).toEqual([
      'Step Flashing',
      'Conductor Head',
      'Downspout',
      'Reglet',
      'Wall Panel / Cladding',
    ]);
  });

  it('resolves Scupper and Custom Profile to 10 ft, which the seed file says is NULL', () => {
    // This is not a preference, it is a measurement. The customer-facing cut
    // list therefore DOES render for a scupper today, which is why
    // tests/e2e/trim-optimizer-quote-states.spec.ts cannot use a scupper as its
    // no-stock-length case.
    expect(
      resolveStockLengthByQuoteLabel(LIVE_PROFILES, 'Scupper'),
      'live scupper: standard_length_ft = 10'
    ).toBe(10);
    expect(
      resolveStockLengthBySlug(SEED_FILE_PROFILES, 'scupper'),
      'seed file scupper: NULL — the divergence, in one pair of assertions'
    ).toBe(null);
  });

  it('still resolves the renamed Window/Door row, because the alias goes by slug', () => {
    // The live display name lost its ampersand and its spaces. The alias map
    // keys on the quote LABEL and resolves to a SLUG, so the rename cannot
    // break it — which is the reason it is built that way.
    expect(
      resolveStockLengthByQuoteLabel(LIVE_PROFILES, 'Window / Door Flashing'),
      'the alias resolves by slug, not by the stored display name'
    ).toBe(10);
  });

  it('resolves Standing Seam Roofing Panel to 10 ft live, not the 20 ft the seed file declares', () => {
    expect(
      resolveStockLengthByQuoteLabel(LIVE_PROFILES, 'Standing Seam Roofing Panel'),
      'live standing seam: standard_length_ft = 10'
    ).toBe(10);
    expect(
      resolveStockLengthByQuoteLabel(SEED_FILE_PROFILES, 'Standing Seam Roofing Panel'),
      'seed file standing seam: 20'
    ).toBe(20);
  });
});
