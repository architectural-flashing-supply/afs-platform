/**
 * lib/tax/db.ts — the row mapping, the review queue, and the two update paths.
 *
 * service.test.ts already drives db.ts through the composition root, which covers
 * the cache lookup and the insert. This file covers what that cannot reach from
 * the outside: the `date` slicing, the problem-list coercion, the review queue
 * read and resolve, the cache-expiry sweep, and the two defensive branches that
 * exist precisely so a malformed row is ignored rather than misread.
 *
 * Same hand-written fluent Supabase double as service.test.ts, for the same
 * reason: it RECORDS what was asked of the database, so a test can assert the
 * filters rather than only the return value. No network, no database.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  toNexusState,
  getNexusStates,
  getTaxCalculationsNeedingReview,
  findCachedCalculation,
  recordCalculation,
  resolveReview,
  expireCachedCalculations,
  cacheKeyFor,
} from './db';
import type { NexusState, TaxOutcome } from './types';
import { NEXUS_TX_COLLECTING } from '@/tests/fixtures/tax/nexus';

afterEach(() => {
  vi.restoreAllMocks();
});

interface Recorded {
  table: string;
  op: string;
  filters: { method: string; args: unknown[] }[];
  payload?: Record<string, unknown>;
}

interface Harness {
  client: SupabaseClient;
  calls: Recorded[];
}

/**
 * A fluent double whose terminal method resolves to `answer`. Every filter call
 * is recorded, so a test can assert that (for example) the cache read really
 * filters on `outcome = 'calculated'`.
 */
function harness(answer: { data: unknown; error: unknown }): Harness {
  const calls: Recorded[] = [];

  const client = {
    from(table: string) {
      const current: Recorded = { table, op: 'select', filters: [] };
      const builder: Record<string, unknown> = {};
      const record = (method: string) => (...args: unknown[]) => {
        current.filters.push({ method, args });
        return builder;
      };

      builder.select = (...args: unknown[]) => {
        calls.push(current);
        current.filters.push({ method: 'select', args });
        return builder;
      };
      builder.eq = record('eq');
      builder.is = record('is');
      builder.gt = record('gt');
      builder.limit = record('limit');
      builder.order = (...args: unknown[]) => {
        current.filters.push({ method: 'order', args });
        // `order` is terminal for the list reads and chained for the single reads;
        // returning a thenable builder satisfies both.
        return Object.assign(builder, {
          then: (resolve: (v: unknown) => unknown) => resolve(answer),
        });
      };
      builder.maybeSingle = () => Promise.resolve(answer);
      builder.single = () => Promise.resolve(answer);
      builder.insert = (payload: Record<string, unknown>) => {
        calls.push({ table, op: 'insert', filters: [], payload });
        return {
          select: () => ({ single: () => Promise.resolve(answer) }),
        };
      };
      builder.update = (payload: Record<string, unknown>) => {
        const updateCall: Recorded = { table, op: 'update', filters: [], payload };
        calls.push(updateCall);
        const chain: Record<string, unknown> = {};
        const chainRecord = (method: string) => (...args: unknown[]) => {
          updateCall.filters.push({ method, args });
          return Object.assign(chain, {
            then: (resolve: (v: unknown) => unknown) => resolve(answer),
          });
        };
        chain.eq = chainRecord('eq');
        chain.is = chainRecord('is');
        chain.gt = chainRecord('gt');
        return chain;
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

describe('toNexusState — the row mapping', () => {
  it('maps every column to its camelCase field', () => {
    // ARRANGE
    const row = {
      id: 'row-1',
      state_code: 'TX',
      collecting: true,
      nexus_basis: 'physical_presence',
      registration_id: 'TX-1',
      effective_from: '2026-01-01',
      effective_to: null,
      note: 'from the accountant',
    };

    // ACT / ASSERT
    expect(toNexusState(row)).toEqual({
      id: 'row-1',
      stateCode: 'TX',
      collecting: true,
      basis: 'physical_presence',
      registrationId: 'TX-1',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      note: 'from the accountant',
    });
  });

  it('slices a timestamp back to a date, so lexicographic comparison keeps working', () => {
    // ARRANGE — what a column widened to timestamptz would return.
    const row = {
      id: 'row-2',
      state_code: 'CA',
      collecting: false,
      nexus_basis: 'economic_threshold',
      registration_id: null,
      effective_from: '2026-02-01T00:00:00+00:00',
      effective_to: '2026-06-30T00:00:00+00:00',
      note: null,
    };

    // ACT
    const mapped = toNexusState(row);

    // ASSERT
    expect(
      mapped.effectiveFrom,
      'nexus.ts compares these with <= as plain strings. A trailing time part would make ' +
        "'2026-02-01T00:00:00' > '2026-02-01' and break the window test on the boundary day only — " +
        'which is exactly the kind of bug that survives a casual test.'
    ).toBe('2026-02-01');
    expect(mapped.effectiveTo).toBe('2026-06-30');
  });

  it('keeps a null end date as null rather than slicing it into an empty string', () => {
    const mapped = toNexusState({
      id: 'r',
      state_code: 'TX',
      collecting: true,
      nexus_basis: 'voluntary',
      registration_id: null,
      effective_from: '2026-01-01',
      effective_to: null,
      note: null,
    });
    expect(mapped.effectiveTo, 'Null means "still current" and must survive the mapping.').toBeNull();
  });
});

describe('getNexusStates', () => {
  it('returns mapped rows ordered by state code', async () => {
    // ARRANGE
    const { client, calls } = harness({
      data: [
        {
          id: 'a',
          state_code: 'TX',
          collecting: true,
          nexus_basis: 'physical_presence',
          registration_id: null,
          effective_from: '2026-01-01',
          effective_to: null,
          note: null,
        },
      ],
      error: null,
    });

    // ACT
    const states = await getNexusStates(client);

    // ASSERT
    expect(states.length).toBe(1);
    expect(states[0]?.stateCode).toBe('TX');
    expect(
      calls[0]?.filters.some((f) => f.method === 'order' && f.args[0] === 'state_code'),
      'The list is ordered by state code so the admin table is stable between renders.'
    ).toBe(true);
  });

  it('returns [] and logs on a read error — the most conservative answer available', async () => {
    // ARRANGE
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({ data: null, error: { message: 'boom' } });

    // ACT
    const states = await getNexusStates(client);

    // ASSERT
    expect(
      states,
      'An empty list becomes not_configured in calculateTax, so a read failure degrades to "we do not ' +
        'know" rather than to "no tax is owed". That is why [] is safe here and would not be safe in a ' +
        'function whose empty value meant something affirmative.'
    ).toEqual([]);
    expect(errorSpy, 'A silent read failure is worse than a logged one.').toHaveBeenCalledTimes(1);
  });

  it('returns [] for a null payload without throwing', async () => {
    const { client } = harness({ data: null, error: null });
    await expect(getNexusStates(client)).resolves.toEqual([]);
  });
});

describe('getTaxCalculationsNeedingReview', () => {
  it('maps rows and filters to unreviewed failures only', async () => {
    // ARRANGE
    const { client, calls } = harness({
      data: [
        {
          id: 'calc-1',
          provider: 'taxjar',
          outcome: 'failed',
          amount_cents: null,
          rate: null,
          to_state: 'TX',
          to_zip: '78701',
          subtotal_cents: 100_000,
          shipping_cents: 0,
          problems: ['HTTP 500 from TaxJar.'],
          requires_review: true,
          reviewed_at: null,
          review_note: null,
          created_at: '2026-10-03T12:00:00Z',
        },
      ],
      error: null,
    });

    // ACT
    const rows = await getTaxCalculationsNeedingReview(client);

    // ASSERT
    expect(rows.length).toBe(1);
    const row = rows[0];
    if (!row) throw new Error('unreachable');
    expect(row.outcome).toBe('failed');
    expect(row.amountCents, 'A failure carries no amount, in the database and here.').toBeNull();
    expect(row.problems).toEqual(['HTTP 500 from TaxJar.']);

    const filters = calls[0]?.filters ?? [];
    expect(
      filters.some((f) => f.method === 'eq' && f.args[0] === 'requires_review' && f.args[1] === true),
      'The queue must filter on requires_review.'
    ).toBe(true);
    expect(
      filters.some((f) => f.method === 'is' && f.args[0] === 'reviewed_at' && f.args[1] === null),
      'An already-reviewed failure must not reappear in the queue.'
    ).toBe(true);
  });

  it('coerces a non-array problems column to an empty list rather than crashing the screen', async () => {
    // ARRANGE — jsonb can hold anything; the admin screen maps over this.
    const { client } = harness({
      data: [
        {
          id: 'calc-2',
          provider: 'taxjar',
          outcome: 'failed',
          amount_cents: null,
          rate: null,
          to_state: null,
          to_zip: null,
          subtotal_cents: 0,
          shipping_cents: 0,
          problems: { not: 'an array' },
          requires_review: true,
          reviewed_at: null,
          review_note: null,
          created_at: '2026-10-03T12:00:00Z',
        },
      ],
      error: null,
    });

    // ACT
    const rows = await getTaxCalculationsNeedingReview(client);

    // ASSERT
    expect(
      rows[0]?.problems,
      'A jsonb column can hold any shape. The review panel renders this with .map, so a non-array ' +
        'would throw inside a server component rather than show the failure it exists to show.'
    ).toEqual([]);
  });

  it('drops non-string entries from a mixed problems array', async () => {
    const { client } = harness({
      data: [
        {
          id: 'c',
          provider: 'mock',
          outcome: 'failed',
          amount_cents: null,
          rate: null,
          to_state: 'TX',
          to_zip: '1',
          subtotal_cents: 1,
          shipping_cents: 0,
          problems: ['real', 42, null, 'also real'],
          requires_review: true,
          reviewed_at: null,
          review_note: null,
          created_at: '2026-10-03T12:00:00Z',
        },
      ],
      error: null,
    });
    expect(await getTaxCalculationsNeedingReview(client).then((r) => r[0]?.problems)).toEqual([
      'real',
      'also real',
    ]);
  });

  it('returns [] and logs on a read error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({ data: null, error: { message: 'boom' } });
    expect(await getTaxCalculationsNeedingReview(client)).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('converts a numeric rate string to a number', async () => {
    // ARRANGE — numeric(8,6) comes back as a string from PostgREST.
    const { client } = harness({
      data: [
        {
          id: 'c',
          provider: 'taxjar',
          outcome: 'calculated',
          amount_cents: 8250,
          rate: '0.082500',
          to_state: 'TX',
          to_zip: '78701',
          subtotal_cents: 100_000,
          shipping_cents: 0,
          problems: null,
          requires_review: false,
          reviewed_at: null,
          review_note: null,
          created_at: '2026-10-03T12:00:00Z',
        },
      ],
      error: null,
    });

    // ACT / ASSERT
    expect(
      await getTaxCalculationsNeedingReview(client).then((r) => r[0]?.rate),
      'A numeric column arrives as a string. Rendering it without conversion would be harmless, but ' +
        'arithmetic on it would not be.'
    ).toBe(0.0825);
  });
});

describe('findCachedCalculation', () => {
  it('filters on the key, a calculated outcome and an unexpired row', async () => {
    // ARRANGE
    const now = new Date('2026-10-03T15:00:00Z');
    const { client, calls } = harness({
      data: {
        amount_cents: 8250,
        rate: '0.0825',
        taxable_amount_cents: 100_000,
        freight_taxable: false,
        jurisdictions: { state: 'TX' },
        provider: 'taxjar',
      },
      error: null,
    });

    // ACT
    const hit = await findCachedCalculation(client, 'key-1', now);

    // ASSERT
    expect(hit?.amountCents).toBe(8250);
    expect(hit?.rate, 'The numeric rate is converted.').toBe(0.0825);

    const filters = calls[0]?.filters ?? [];
    expect(
      filters.some((f) => f.method === 'eq' && f.args[0] === 'outcome' && f.args[1] === 'calculated'),
      'THE LOAD-BEARING FILTER. A failed row must never be served from cache — one vendor blip would ' +
        'otherwise become a day of refusals.'
    ).toBe(true);
    expect(
      filters.some((f) => f.method === 'gt' && f.args[0] === 'expires_at'),
      'An expired row is not a cache hit.'
    ).toBe(true);
  });

  it('returns null for a miss', async () => {
    const { client } = harness({ data: null, error: null });
    expect(await findCachedCalculation(client, 'k', new Date())).toBeNull();
  });

  it('returns null and logs on a read error, so the provider is asked instead', async () => {
    // ARRANGE
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({ data: null, error: { message: 'boom' } });

    // ACT / ASSERT
    expect(
      await findCachedCalculation(client, 'k', new Date()),
      'A cache read failure is not a calculation failure: falling through to the provider is slower ' +
        'and correct.'
    ).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores a "calculated" row with no amount rather than reading null as zero', async () => {
    // ARRANGE — migration 039's CHECK makes this impossible; defence in depth.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({
      data: {
        amount_cents: null,
        rate: 0.0825,
        taxable_amount_cents: null,
        freight_taxable: null,
        jurisdictions: null,
        provider: 'taxjar',
      },
      error: null,
    });

    // ACT / ASSERT
    expect(
      await findCachedCalculation(client, 'k', new Date()),
      'If the impossible happens, the honest response is to ignore the row and recalculate — NOT to ' +
        'read the null as a zero tax, which is the bug this whole subsystem is built against.'
    ).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('defaults a null rate to 0 and a non-object jurisdictions to null', async () => {
    const { client } = harness({
      data: {
        amount_cents: 100,
        rate: null,
        taxable_amount_cents: null,
        freight_taxable: null,
        jurisdictions: 'not an object',
        provider: 'mock',
      },
      error: null,
    });
    const hit = await findCachedCalculation(client, 'k', new Date());
    expect(hit?.rate).toBe(0);
    expect(hit?.jurisdictions).toBeNull();
  });
});

describe('recordCalculation', () => {
  const origin = { zip: '78611', state: 'TX' };
  const request = { toState: 'TX', toZip: '78701', subtotalCents: 100_000, shippingCents: 0 };
  const nexus: NexusState[] = [NEXUS_TX_COLLECTING];

  function input(outcome: TaxOutcome, extra: Record<string, unknown> = {}) {
    return {
      cacheKey: 'key-1',
      outcome,
      request,
      origin,
      exempt: false,
      nexus,
      cacheTtlSeconds: 3600,
      now: new Date('2026-10-03T15:00:00Z'),
      actorId: 'admin-1',
      ...extra,
    };
  }

  it.each<[TaxOutcome['kind'], TaxOutcome]>([
    [
      'not_configured',
      {
        kind: 'not_configured',
        reason: 'nothing configured',
        provider: 'none',
        isAuthoritative: false,
      },
    ],
    [
      'exempt',
      {
        kind: 'exempt',
        amountCents: 0,
        zeroReason: 'customer_exempt',
        reason: 'exempt',
        provider: 'none',
        isAuthoritative: true,
      },
    ],
    [
      'no_nexus',
      {
        kind: 'no_nexus',
        amountCents: 0,
        zeroReason: 'no_nexus',
        reason: 'no nexus',
        provider: 'mock',
        isAuthoritative: true,
      },
    ],
  ])('writes NO row for a locally-decided %s outcome', async (_kind, outcome) => {
    // ARRANGE
    const { client, calls } = harness({ data: { id: 'x' }, error: null });

    // ACT
    const id = await recordCalculation(client, input(outcome));

    // ASSERT
    expect(id, 'Nothing was written, so there is no id.').toBeNull();
    expect(
      calls.filter((c) => c.op === 'insert').length,
      'Only a PROVIDER INTERACTION is recorded. A local decision costs nothing to recompute, and ' +
        'storing one would dilute both the table and the review queue.'
    ).toBe(0);
  });

  it('returns null and logs when the insert fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({ data: null, error: { message: 'insert failed' } });
    const id = await recordCalculation(
      client,
      input({
        kind: 'calculated',
        amountCents: 6250,
        rate: 0.0625,
        taxableAmountCents: 100_000,
        freightTaxable: true,
        jurisdictions: null,
        provider: 'mock',
        isAuthoritative: false,
        reason: 'ok',
      })
    );
    expect(id).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('never throws when the client itself throws', async () => {
    // ARRANGE
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = {
      from() {
        throw new Error('client exploded');
      },
    } as unknown as SupabaseClient;

    // ACT / ASSERT
    await expect(
      recordCalculation(
        client,
        input({
          kind: 'failed',
          reason: 'x',
          problems: ['y'],
          requiresAdminReview: true,
          timedOut: false,
          provider: 'taxjar',
          isAuthoritative: false,
        })
      ),
      'A bookkeeping write must never be able to break the calculation that produced it.'
    ).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('snapshots the request and the reason, so a past calculation is reproducible', async () => {
    // ARRANGE
    const { client, calls } = harness({ data: { id: 'rec-9' }, error: null });

    // ACT
    const id = await recordCalculation(
      client,
      input({
        kind: 'calculated',
        amountCents: 6250,
        rate: 0.0625,
        taxableAmountCents: 100_000,
        freightTaxable: true,
        jurisdictions: { country: 'US', state: 'TX', county: null, city: null },
        provider: 'mock',
        isAuthoritative: false,
        reason: 'DEVELOPMENT FIGURE ONLY',
      }),
      );

    // ASSERT
    expect(id).toBe('rec-9');
    const payload = calls.find((c) => c.op === 'insert')?.payload;
    if (!payload) throw new Error('an insert must have been recorded');
    expect(payload.request_snapshot, 'The snapshot is what makes the nexus table need no versions.').toBeDefined();
    expect(payload.nexus_fingerprint).toContain('TX');
    expect(payload.customer_tax_exempt).toBe(false);
    expect(payload.created_by).toBe('admin-1');
    expect(payload.quote_id, 'A preview belongs to no quote.').toBeNull();
  });
});

describe('resolveReview', () => {
  it('marks a row reviewed only while it is still unreviewed', async () => {
    // ARRANGE
    const now = new Date('2026-10-03T15:00:00Z');
    const { client, calls } = harness({ data: null, error: null });

    // ACT
    const ok = await resolveReview(client, 'calc-1', 'admin-1', 'looked at it', now);

    // ASSERT
    expect(ok).toBe(true);
    const update = calls.find((c) => c.op === 'update');
    if (!update) throw new Error('an update must have been recorded');
    expect(update.payload?.requires_review).toBe(false);
    expect(update.payload?.reviewed_by).toBe('admin-1');
    expect(update.payload?.review_note).toBe('looked at it');
    expect(
      update.filters.some((f) => f.method === 'is' && f.args[0] === 'reviewed_at' && f.args[1] === null),
      'The conditional update is what stops two admins clicking at once from overwriting each ' +
        "other's note — the same discipline the single-use approve token uses."
    ).toBe(true);
  });

  it('returns false and logs on an error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({ data: null, error: { message: 'nope' } });
    expect(await resolveReview(client, 'c', 'a', null, new Date())).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('expireCachedCalculations', () => {
  it('expires only unexpired calculated rows, and never deletes', async () => {
    // ARRANGE
    const now = new Date('2026-10-03T15:00:00Z');
    const { client, calls } = harness({ data: null, error: null });

    // ACT
    await expireCachedCalculations(client, now);

    // ASSERT
    const update = calls.find((c) => c.op === 'update');
    if (!update) throw new Error('an update must have been recorded');
    expect(update.payload?.expires_at).toBe(now.toISOString());
    expect(
      update.filters.some((f) => f.method === 'eq' && f.args[0] === 'outcome' && f.args[1] === 'calculated'),
      'A failed row has no expiry to set and must not be touched.'
    ).toBe(true);
    expect(
      calls.some((c) => c.op === 'delete'),
      'The rows are also the audit record of what was calculated, so expiring is an UPDATE, never a ' +
        'delete.'
    ).toBe(false);
  });

  it('logs rather than throwing on an error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = harness({ data: null, error: { message: 'nope' } });
    await expect(expireCachedCalculations(client, new Date())).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('cacheKeyFor', () => {
  it('builds the key from the same nexus list the calculation will use', () => {
    // ARRANGE
    const base = {
      provider: 'taxjar' as const,
      origin: { zip: '78611', state: 'TX' },
      request: { toState: 'TX', toZip: '78701', subtotalCents: 100_000, shippingCents: 0 },
      exempt: false,
      nexus: [NEXUS_TX_COLLECTING],
    };

    // ACT
    const key = cacheKeyFor(base);
    const changed = cacheKeyFor({ ...base, nexus: [] });

    // ASSERT
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(
      changed,
      'Fingerprinting happens inside this helper so a caller cannot accidentally key a lookup against ' +
        'a different nexus list from the one the calculation reads.'
    ).not.toBe(key);
  });
});
