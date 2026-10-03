/**
 * READING THE RATE TABLE — the unit suite.
 *
 * The behaviour under test is the three-way distinction the rest of this feature
 * depends on, because getting it wrong produces a screen that lies about why it
 * is empty:
 *
 *   not installed — migration 039 has not been applied. Say so, name it.
 *   installed and empty — the tables are there, nothing typed in yet.
 *   broken — a permissions failure or a dropped connection. PROPAGATE, because
 *            reporting it as "no rates" would look exactly like somebody having
 *            deleted every rate.
 *
 * ARRANGE uses a hand-written Supabase double rather than a mocking library:
 * four tables are read in one `Promise.all`, and what matters is which table
 * returned which error, which is clearer to read as data than as a stack of
 * mock expectations. No real network call is made by any test in this file.
 *
 * The double is reached through `as unknown as SupabaseClient` — a cast, not an
 * `any`: the test supplies exactly the four chained calls `getFreightRateTable`
 * uses and nothing else, so a change to the read path fails here loudly rather
 * than being absorbed by a permissive stub.
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FREIGHT_MIGRATION_NAME,
  getFreightRateTable,
  isRelationMissingError,
} from './db';
import { AS_OF, RATE_MEDIUM_CENTS, RESIDENTIAL_CENTS } from './fixtures';

interface TableReply {
  data: unknown[] | null;
  error: { code?: string; message?: string } | null;
}

/** The chainable, awaitable shape supabase-js's query builder presents. */
function reply(result: TableReply): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.eq = () => builder;
  builder.then = (resolve: (value: TableReply) => unknown) => Promise.resolve(resolve(result));
  return builder;
}

const EMPTY_REPLY: TableReply = { data: [], error: null };

function fakeClient(replies: Partial<Record<string, TableReply>>): SupabaseClient {
  return {
    from: (table: string) => reply(replies[table] ?? EMPTY_REPLY),
  } as unknown as SupabaseClient;
}

/** One zone, one band, one rate, one surcharge row — the smallest real table. */
function populatedClient(): SupabaseClient {
  return fakeClient({
    freight_zones: {
      data: [
        { id: 'z1', name: 'Local', note: null, display_order: 1, retired_at: null },
        { id: 'z2', name: 'Retired zone', note: null, display_order: 2, retired_at: '2026-09-01T00:00:00.000Z' },
      ],
      error: null,
    },
    freight_rate_bands: {
      data: [
        { id: 'b1', zone_id: 'z1', min_weight_lbs: 0, max_weight_lbs: 500, display_order: 1, retired_at: null },
        { id: 'b2', zone_id: 'z1', min_weight_lbs: 500, max_weight_lbs: null, display_order: 2, retired_at: null },
      ],
      error: null,
    },
    freight_rate_versions: {
      data: [
        {
          id: 'rv1',
          band_id: 'b2',
          rate_cents: RATE_MEDIUM_CENTS,
          effective_from: '2026-01-01',
          note: null,
          created_by: null,
          created_at: '2026-01-01T10:00:00.000Z',
        },
      ],
      error: null,
    },
    freight_surcharge_versions: {
      data: [
        {
          id: 'sv1',
          residential_cents: RESIDENTIAL_CENTS,
          liftgate_cents: null,
          free_freight_threshold_cents: null,
          effective_from: '2026-01-01',
          note: null,
          created_by: null,
          created_at: '2026-01-01T10:00:00.000Z',
        },
      ],
      error: null,
    },
  });
}

describe('isRelationMissingError — telling "not installed" from "broken"', () => {
  it('recognises PostgreSQL 42P01 undefined_table', () => {
    expect(
      isRelationMissingError({ code: '42P01', message: 'relation "freight_zones" does not exist' }),
      'This is what PostgreSQL raises when the migration has not been applied.'
    ).toBe(true);
  });

  it('recognises PostgREST PGRST205, which is what actually surfaces through supabase-js', () => {
    expect(
      isRelationMissingError({
        code: 'PGRST205',
        message: "Could not find the table 'public.freight_zones' in the schema cache",
      }),
      'PostgREST keeps its own schema cache and answers with its own code. Which of the two surfaces ' +
        'depends on whether that cache has reloaded, so both must be recognised or the screen shows a ' +
        'confusing error instead of the sentence explaining what to do.'
    ).toBe(true);
  });

  it('recognises the message alone when no code is supplied', () => {
    expect(
      isRelationMissingError({ message: 'Could not find the table in the schema cache' }),
      'A last resort, because an error object without a code still has to be classified.'
    ).toBe(true);
  });

  it('does NOT treat a permissions failure as a missing table', () => {
    expect(
      isRelationMissingError({ code: '42501', message: 'permission denied for table freight_zones' }),
      'A permissions failure is "broken", not "not installed". Classifying it as not-installed would ' +
        'tell somebody to apply a migration that is already applied.'
    ).toBe(false);
  });

  it('does NOT treat a dropped connection as a missing table', () => {
    expect(
      isRelationMissingError({ message: 'fetch failed' }),
      'A network failure must propagate, not be reported as an unconfigured feature.'
    ).toBe(false);
  });

  it('handles null and a non-object without throwing', () => {
    expect(isRelationMissingError(null), 'No error is not a missing relation.').toBe(false);
    expect(isRelationMissingError('boom'), 'A string error must not crash the classifier.').toBe(false);
    expect(isRelationMissingError(undefined), 'Neither is undefined.').toBe(false);
  });
});

describe('getFreightRateTable — the three-way answer', () => {
  it('reports NOT INSTALLED when a table is missing, naming the migration', async () => {
    const client = fakeClient({
      freight_zones: { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } },
    });

    const result = await getFreightRateTable(client, AS_OF);

    expect(
      result.installed,
      'Migration 039 is deliberately unapplied, so this is the state of every environment today.'
    ).toBe(false);
    if (result.installed) return;
    expect(
      result.reason,
      'The reason must name the migration, or somebody has to go and find out which one it is.'
    ).toContain(FREIGHT_MIGRATION_NAME);
    expect(
      result.reason,
      'And it must say that manual freight entry still works, so nobody thinks quoting is blocked.'
    ).toContain('entered by hand');
  });

  it('reports NOT INSTALLED when only the surcharge table is missing', async () => {
    const client = fakeClient({
      freight_surcharge_versions: {
        data: null,
        error: { code: '42P01', message: 'relation "freight_surcharge_versions" does not exist' },
      },
    });

    const result = await getFreightRateTable(client, AS_OF);
    expect(
      result.installed,
      'A partly-applied migration is not a usable table. Any one of the four missing means the ' +
        'feature is not installed.'
    ).toBe(false);
  });

  it('PROPAGATES a permissions failure rather than reporting an empty table', async () => {
    const client = fakeClient({
      freight_zones: { data: null, error: { code: '42501', message: 'permission denied for table freight_zones' } },
    });

    await expect(
      getFreightRateTable(client, AS_OF),
      'Reporting this as "no rates configured" would remove every rate from every estimate and look ' +
        'exactly like somebody having deleted them. "Empty" and "broken" are different facts.'
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('reports INSTALLED AND EMPTY when every table is there and every one is empty', async () => {
    const result = await getFreightRateTable(fakeClient({}), AS_OF);

    expect(result.installed, 'The tables exist.').toBe(true);
    if (!result.installed) return;
    expect(result.table.zones, 'Nothing has been typed in yet — migration 039 seeds nothing.').toEqual([]);
    expect(result.table.bandsByZone, 'And so there are no bands.').toEqual({});
    expect(
      result.table.surcharges,
      'No surcharge version has ever been saved, which is null and not a row of zeros.'
    ).toBeNull();
    expect(result.table.asOf, 'The resolution date is reported back, so a caller can record it.').toBe(AS_OF);
  });

  it('maps snake_case rows onto the camelCase domain types', async () => {
    const result = await getFreightRateTable(populatedClient(), AS_OF);
    expect(result.installed, 'Populated.').toBe(true);
    if (!result.installed) return;

    expect(result.table.zones.map((zone) => zone.name), 'Both zones are returned, retired included.').toEqual([
      'Local',
      'Retired zone',
    ]);
    expect(
      result.table.zones[1].retiredAt,
      'A retired zone is returned WITH its retirement, because an old quote still has to resolve ' +
        'against it — the estimate is the right place to refuse it for new work.'
    ).toBe('2026-09-01T00:00:00.000Z');
    expect(
      result.table.bandsByZone.z1.map((entry) => entry.band.maxWeightLbs),
      'max_weight_lbs null must survive as null — it is the open-ended top band, not a zero.'
    ).toEqual([500, null]);
  });

  it('resolves each band\'s rate through the real version rule, so an unpriced band is not priced', async () => {
    const result = await getFreightRateTable(populatedClient(), AS_OF);
    expect(result.installed, 'Populated.').toBe(true);
    if (!result.installed) return;

    const [light, heavy] = result.table.bandsByZone.z1;
    expect(
      light.isPriced,
      'Band b1 has no rate version at all. The read path must not invent one, and must not report it ' +
        'as priced.'
    ).toBe(false);
    expect(heavy.isPriced, 'Band b2 has a rate in force.').toBe(true);
    expect(heavy.version?.rateCents, 'With the exact cents from the row.').toBe(RATE_MEDIUM_CENTS);
  });

  it('keeps a blank surcharge field blank rather than defaulting it to zero', async () => {
    const result = await getFreightRateTable(populatedClient(), AS_OF);
    expect(result.installed, 'Populated.').toBe(true);
    if (!result.installed) return;

    expect(result.table.surcharges?.residentialCents, 'Set, and carried through exactly.').toBe(RESIDENTIAL_CENTS);
    expect(
      result.table.surcharges?.liftgateCents,
      'Blank in the row and blank here. This is the one hop where a null could become a 0 and nobody ' +
        'would notice until a liftgate job was under-quoted.'
    ).toBeNull();
    expect(result.table.surcharges?.freeFreightThresholdCents, 'Also blank, so the rule is not applied.').toBeNull();
  });

  it('omits a zone with no bands from bandsByZone rather than giving it an empty array', async () => {
    const result = await getFreightRateTable(populatedClient(), AS_OF);
    expect(result.installed, 'Populated.').toBe(true);
    if (!result.installed) return;

    expect(
      Object.keys(result.table.bandsByZone),
      'Only z1 has bands. The estimate distinguishes "this zone has no bands" from "the table is ' +
        'empty", and an absent key rather than an empty array is what keeps that distinction readable.'
    ).toEqual(['z1']);
  });
});
