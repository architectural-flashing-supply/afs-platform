/**
 * EES-OVN.08 AC-28, AC-29, AC-32, and the service's composition guarantees.
 *
 * ================== THE SUPABASE DOUBLE ==================
 *
 * A hand-written fake, not a mocking library. The real client is a fluent
 * builder, so the double implements just the chain this code actually uses and
 * RECORDS every call — which is what lets a test assert "the provider was called
 * once" and "the second request was served from the cache" rather than asserting
 * on a returned value that would be identical either way.
 *
 * NO NETWORK AND NO DATABASE. Both are injected.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildProvider, calculateTaxForOrder, summariseTaxConfig } from './service';
import { resolveTaxConfigFromEnv } from './config';
import { collectableTaxCents } from './types';
import type { NexusState, TaxCalculationRequest } from './types';
import { TaxJarProvider } from './providers/taxjar';
import { MockTaxProvider } from './providers/mock';
import { FIXTURE_TODAY, NEXUS_TX_COLLECTING, NEXUS_CA_NOT_COLLECTING } from '@/tests/fixtures/tax/nexus';

const REQUEST: TaxCalculationRequest = {
  toState: 'TX',
  toZip: '78701',
  subtotalCents: 100_000,
  shippingCents: 0,
};

const CONFIGURED_ENV = {
  TAX_PROVIDER: 'mock',
  TAX_ORIGIN_ZIP: '78611',
  TAX_ORIGIN_STATE: 'TX',
};

interface InsertedRow {
  table: string;
  row: Record<string, unknown>;
}

interface FakeDbOptions {
  nexus?: NexusState[];
  /** A cache hit to return, or null for a miss. */
  cacheHit?: Record<string, unknown> | null;
  /** Make the nexus read fail, to prove the conservative degradation. */
  failNexusRead?: boolean;
  /** Make the insert fail, to prove a good answer survives it (AC-32). */
  failInsert?: boolean;
}

interface FakeDb {
  client: SupabaseClient;
  inserted: InsertedRow[];
  cacheLookups: number;
}

/**
 * A minimal fluent fake. Each `from()` returns a builder whose terminal methods
 * (`maybeSingle`, `single`, `limit`, `order`) resolve to the configured answer.
 */
function fakeDb(options: FakeDbOptions = {}): FakeDb {
  const inserted: InsertedRow[] = [];
  const state = { cacheLookups: 0 };
  const nexusRows = (options.nexus ?? []).map((n) => ({
    id: n.id,
    state_code: n.stateCode,
    collecting: n.collecting,
    nexus_basis: n.basis,
    registration_id: n.registrationId,
    effective_from: n.effectiveFrom,
    effective_to: n.effectiveTo,
    note: n.note,
  }));

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;

      builder.select = () => {
        if (table === 'tax_calculations') state.cacheLookups += 1;
        return builder;
      };
      builder.eq = chain;
      builder.is = chain;
      builder.gt = chain;
      builder.order = () => {
        if (table === 'tax_nexus_states') {
          return Promise.resolve(
            options.failNexusRead
              ? { data: null, error: { message: 'read failed' } }
              : { data: nexusRows, error: null }
          );
        }
        return builder;
      };
      builder.limit = chain;
      builder.maybeSingle = () =>
        Promise.resolve({ data: options.cacheHit ?? null, error: null });
      builder.insert = (row: Record<string, unknown>) => {
        inserted.push({ table, row });
        return {
          select: () => ({
            single: () =>
              Promise.resolve(
                options.failInsert
                  ? { data: null, error: { message: 'insert failed' } }
                  : { data: { id: 'rec-1' }, error: null }
              ),
          }),
        };
      };
      builder.update = () => ({
        eq: () => ({ is: () => Promise.resolve({ error: null }) }),
        gt: () => Promise.resolve({ error: null }),
      });
      return builder;
    },
  } as unknown as SupabaseClient;

  return {
    client,
    inserted,
    get cacheLookups() {
      return state.cacheLookups;
    },
  };
}

describe('buildProvider', () => {
  it('returns null when no provider is configured, so no vendor call is possible', () => {
    const config = resolveTaxConfigFromEnv({});
    expect(
      buildProvider(config, {}),
      'A null provider is what makes calculateTax short-circuit before any network access.'
    ).toBeNull();
  });

  it('returns the mock provider for TAX_PROVIDER=mock', () => {
    const config = resolveTaxConfigFromEnv({ TAX_PROVIDER: 'mock' });
    expect(buildProvider(config, { TAX_PROVIDER: 'mock' })).toBeInstanceOf(MockTaxProvider);
  });

  it('returns a TaxJar client for TAX_PROVIDER=taxjar with a key', () => {
    const env = { TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: 'k' };
    const config = resolveTaxConfigFromEnv(env);
    expect(buildProvider(config, env)).toBeInstanceOf(TaxJarProvider);
  });

  it('returns null rather than an empty bearer token if a key vanishes between resolution and build', () => {
    // ARRANGE — a config that says taxjar, with the key absent from env. This is
    // unreachable through resolveTaxProvider, which is exactly why it is handled
    // rather than asserted away with a non-null `!`.
    const config = { ...resolveTaxConfigFromEnv({ TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: 'k' }), provider: 'taxjar' as const };

    // ACT / ASSERT
    expect(
      buildProvider(config, {}),
      'A `!` here would be the one place a configuration change could put "Bearer " with no token on ' +
        'the wire.'
    ).toBeNull();
  });
});

describe('calculateTaxForOrder — nothing configured', () => {
  it('returns not_configured without consulting the cache or writing a row', async () => {
    // ARRANGE
    const db = fakeDb({ nexus: [NEXUS_TX_COLLECTING] });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: 'admin-1',
      env: {},
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.outcome.kind).toBe('not_configured');
    expect(collectableTaxCents(result.outcome)).toBeNull();
    expect(
      db.cacheLookups,
      'With no provider there is no vendor call to avoid, so a cache lookup would cost a database ' +
        'round trip to save nothing.'
    ).toBe(0);
    expect(
      db.inserted.length,
      'A local decision is not a provider interaction and must write no row — that is what keeps ' +
        'tax_calculations a record of real vendor conversations.'
    ).toBe(0);
  });

  it('an empty nexus list with a configured provider is still not_configured, and writes no row', async () => {
    // ARRANGE
    const db = fakeDb({ nexus: [] });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: null,
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.outcome.kind).toBe('not_configured');
    expect(db.inserted.length, 'No vendor was called, so there is nothing to record.').toBe(0);
  });

  it('a failed nexus read degrades to not_configured, never to "no tax owed"', async () => {
    // ARRANGE — the database is unreachable.
    const db = fakeDb({ failNexusRead: true });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: null,
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(
      result.outcome.kind,
      'getNexusStates returns [] on error, which is the MOST CONSERVATIVE answer available: an empty ' +
        'list becomes not_configured, so a read failure degrades to "we do not know" rather than to ' +
        '"no tax is owed".'
    ).toBe('not_configured');
    expect(collectableTaxCents(result.outcome)).toBeNull();
  });
});

describe('calculateTaxForOrder — the exempt and no-nexus short circuits', () => {
  it('an exempt customer gets a zero without a cache lookup or a recorded row', async () => {
    // ARRANGE
    const db = fakeDb({ nexus: [NEXUS_TX_COLLECTING] });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: true,
      actorId: null,
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.outcome.kind).toBe('exempt');
    expect(collectableTaxCents(result.outcome)).toBe(0);
    expect(db.cacheLookups, 'An exemption is decided in microseconds; there is nothing to cache.').toBe(0);
    expect(db.inserted.length, 'No provider was called.').toBe(0);
  });

  it('a non-nexus state gets a zero with no provider interaction recorded', async () => {
    // ARRANGE — the list is supplied, and CA is recorded as not collecting.
    const db = fakeDb({ nexus: [NEXUS_CA_NOT_COLLECTING] });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: { ...REQUEST, toState: 'CA', toZip: '90001' },
      customerTaxExempt: false,
      actorId: null,
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.outcome.kind).toBe('no_nexus');
    expect(collectableTaxCents(result.outcome), 'The list was supplied: this zero is an answer.').toBe(0);
    expect(db.inserted.length).toBe(0);
  });
});

describe('calculateTaxForOrder — AC-28: a cache hit avoids the vendor', () => {
  it('serves a cached figure and makes no provider call', async () => {
    // ARRANGE — a cache row that would not be produced by the mock's own
    // arithmetic (9999, not 6250), so a hit is distinguishable from a fresh call.
    const db = fakeDb({
      nexus: [NEXUS_TX_COLLECTING],
      cacheHit: {
        amount_cents: 9999,
        rate: 0.0825,
        taxable_amount_cents: 100_000,
        freight_taxable: false,
        jurisdictions: null,
        provider: 'taxjar',
      },
    });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: null,
      env: { ...CONFIGURED_ENV, TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: 'k' },
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.fromCache, 'The result must declare that it came from the cache.').toBe(true);
    expect(
      collectableTaxCents(result.outcome),
      'Expected the cached 9999, which the mock arithmetic would never produce — so this proves a ' +
        'genuine cache hit rather than a coincidental match.'
    ).toBe(9999);
    expect(
      db.inserted.length,
      'A cache hit writes no new row: nothing new was asked of the vendor.'
    ).toBe(0);
  });

  it('a cached MOCK figure stays non-authoritative when it is reused', async () => {
    // ARRANGE
    const db = fakeDb({
      nexus: [NEXUS_TX_COLLECTING],
      cacheHit: {
        amount_cents: 6250,
        rate: 0.0625,
        taxable_amount_cents: 100_000,
        freight_taxable: true,
        jurisdictions: null,
        provider: 'mock',
      },
    });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: null,
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.fromCache).toBe(true);
    expect(
      result.outcome.isAuthoritative,
      "A figure's authority is a property of the figure, not of the current configuration. A reused " +
        'mock number must still be marked as a development figure.'
    ).toBe(false);
    expect(result.outcome.reason).toContain('not a real tax');
  });
});

describe('calculateTaxForOrder — a fresh calculation is recorded', () => {
  it('records a calculated row with an expiry so it can be reused', async () => {
    // ARRANGE
    const db = fakeDb({ nexus: [NEXUS_TX_COLLECTING], cacheHit: null });
    const now = new Date('2026-10-03T15:00:00Z');

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: 'admin-1',
      env: CONFIGURED_ENV,
      now,
    });

    // ASSERT
    expect(result.outcome.kind).toBe('calculated');
    expect(result.fromCache).toBe(false);
    expect(db.inserted.length, 'A real provider interaction must be recorded.').toBe(1);

    const row = db.inserted[0]?.row;
    expect(row, 'A row must have been inserted.').toBeDefined();
    if (!row) throw new Error('unreachable');
    expect(row.outcome).toBe('calculated');
    expect(row.amount_cents, 'Expected the mock TX figure: 100000 * 0.0625.').toBe(6250);
    expect(row.requires_review, 'A success needs no review.').toBe(false);
    expect(
      row.expires_at,
      'A calculated row must carry an expiry, or it could never be reused.'
    ).not.toBeNull();
    expect(row.created_by, 'The actor is recorded for the audit trail.').toBe('admin-1');
    expect(
      row.nexus_fingerprint,
      'The nexus list behind the figure is snapshotted, which is why the nexus table needs no ' +
        'version history.'
    ).toContain('TX');
  });

  it('AC-29: a FAILED calculation is recorded with no expiry and flagged for review', async () => {
    // ARRANGE — a state the mock has no recorded rate for, which the mock treats
    // as a provider failure rather than guessing.
    const db = fakeDb({ nexus: [{ ...NEXUS_TX_COLLECTING, stateCode: 'FL' }], cacheHit: null });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: { ...REQUEST, toState: 'FL', toZip: '33101' },
      customerTaxExempt: false,
      actorId: 'admin-1',
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(result.outcome.kind).toBe('failed');
    const row = db.inserted[0]?.row;
    expect(row, 'A failure must still be recorded — that is the review queue.').toBeDefined();
    if (!row) throw new Error('unreachable');
    expect(row.outcome).toBe('failed');
    expect(
      row.amount_cents,
      'A failure must store NULL, never 0. A zero here would be a tax figure, and a made-up one.'
    ).toBeNull();
    expect(
      row.expires_at,
      'THE LOAD-BEARING ASSERTION for AC-29. A failure must have no expiry, so it can never be served ' +
        'from cache — otherwise one vendor blip becomes a day of refusals. Migration 039 refuses the ' +
        'alternative at the database too.'
    ).toBeNull();
    expect(row.requires_review, 'A failure must reach a human.').toBe(true);
    expect(Array.isArray(row.problems), 'The problems are stored for the admin to read.').toBe(true);
  });

  it('AC-32: a recording failure does NOT downgrade a successful calculation', async () => {
    // ARRANGE — the insert fails.
    const db = fakeDb({ nexus: [NEXUS_TX_COLLECTING], cacheHit: null, failInsert: true });

    // ACT
    const result = await calculateTaxForOrder(db.client, {
      request: REQUEST,
      customerTaxExempt: false,
      actorId: null,
      env: CONFIGURED_ENV,
      now: new Date('2026-10-03T15:00:00Z'),
    });

    // ASSERT
    expect(
      result.outcome.kind,
      'The tax really was calculated. Reporting otherwise because a bookkeeping write failed would be ' +
        'the same class of lie as reporting a zero for an uncalculated tax.'
    ).toBe('calculated');
    expect(collectableTaxCents(result.outcome)).toBe(6250);
    expect(result.recordId, 'The caller is told the row was not written.').toBeNull();
  });
});

describe('summariseTaxConfig — the admin panel, with no secret in it', () => {
  it('reports presence of the key, never its value', () => {
    // ARRANGE
    const secret = 'tj_live_SHOULD_NEVER_APPEAR';
    const env = { ...CONFIGURED_ENV, TAX_PROVIDER: 'taxjar', TAXJAR_API_KEY: secret };
    const config = resolveTaxConfigFromEnv(env);

    // ACT
    const summary = summariseTaxConfig(config, env, [NEXUS_TX_COLLECTING], FIXTURE_TODAY);

    // ASSERT
    expect(summary.hasApiKey, 'Presence is all a screen needs.').toBe(true);
    expect(
      JSON.stringify(summary).includes(secret),
      'This object is serialised to an admin screen. The key must never be in it.'
    ).toBe(false);
  });

  it('is not ready to calculate when nothing is configured', () => {
    const config = resolveTaxConfigFromEnv({});
    const summary = summariseTaxConfig(config, {}, [], FIXTURE_TODAY);
    expect(summary.readyToCalculate, 'No provider, no origin, no states.').toBe(false);
    expect(summary.hasApiKey).toBe(false);
    expect(summary.nexusCount).toBe(0);
    expect(summary.collectingCount).toBe(0);
  });

  it('is not ready when a provider and origin exist but no state is collecting', () => {
    // ARRANGE
    const config = resolveTaxConfigFromEnv(CONFIGURED_ENV);

    // ACT
    const summary = summariseTaxConfig(config, CONFIGURED_ENV, [NEXUS_CA_NOT_COLLECTING], FIXTURE_TODAY);

    // ASSERT
    expect(
      summary.readyToCalculate,
      'A recorded nexus AFS is not collecting in does not make the system ready to collect tax.'
    ).toBe(false);
    expect(summary.nexusCount, 'The row is still counted as recorded.').toBe(1);
    expect(summary.collectingCount).toBe(0);
  });

  it('is ready when a provider, an origin and a collecting state are all present', () => {
    const config = resolveTaxConfigFromEnv(CONFIGURED_ENV);
    const summary = summariseTaxConfig(config, CONFIGURED_ENV, [NEXUS_TX_COLLECTING], FIXTURE_TODAY);
    expect(summary.readyToCalculate).toBe(true);
    expect(summary.collectingCount).toBe(1);
  });

  it('counts only states in force today', () => {
    // ARRANGE — a state whose window has not opened.
    const config = resolveTaxConfigFromEnv(CONFIGURED_ENV);
    const future: NexusState = { ...NEXUS_TX_COLLECTING, effectiveFrom: '2027-01-01' };

    // ACT
    const summary = summariseTaxConfig(config, CONFIGURED_ENV, [future], FIXTURE_TODAY);

    // ASSERT
    expect(
      summary.collectingCount,
      'A nexus registered ahead of time is recorded but not yet in force.'
    ).toBe(0);
    expect(summary.readyToCalculate).toBe(false);
  });
});
