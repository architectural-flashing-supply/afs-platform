import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCustomerDetail } from './customers';

/**
 * `getCustomerDetail` resolving `profiles.company_id → companies` is the data
 * path the PO requirement admin panel is built on, and the one most likely to
 * break quietly: it is TWO queries rather than a PostgREST embed (profiles and
 * companies are joined by two foreign keys, so an embed is ambiguous), and a
 * regression would not throw — it would render the "no company account on file"
 * copy for a customer who has one, silently hiding the setting.
 *
 * The stub below records which tables were asked for and in what order, so the
 * two-query shape is asserted rather than assumed.
 */

interface QueryRecord {
  table: string;
  columns: string;
  eqValue: string;
}

type Row = Record<string, unknown> | null;

/**
 * A minimal stand-in for the PostgREST builder chain this module uses:
 * `.from(t).select(c).eq('id', v).maybeSingle()`. It is deliberately NOT a
 * general Supabase mock — it implements exactly the four calls under test, so
 * a change in how the module queries fails loudly here instead of being
 * absorbed by a permissive fake.
 */
function stubSupabase(rows: Record<string, Row>, log: QueryRecord[]): SupabaseClient {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(_column: string, value: string) {
              return {
                async maybeSingle() {
                  log.push({ table, columns, eqValue: value });
                  return { data: rows[table] ?? null, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const PROFILE_WITH_COMPANY = {
  id: 'profile-1',
  full_name: 'Dana Reyes',
  company: 'Hill Country Roofing',
  email: 'dana@example.com',
  phone: '555-0100',
  role: 'contractor',
  pricing_tier: 'contractor',
  net_terms: 30,
  credit_limit: 25000,
  tax_exempt: false,
  created_at: '2026-01-15T00:00:00.000Z',
  internal_notes: null,
  company_id: 'company-1',
} as const;

const PROFILE_WITHOUT_COMPANY = { ...PROFILE_WITH_COMPANY, company_id: null } as const;

const COMPANY_REQUIRING_PO = {
  id: 'company-1',
  name: 'Hill Country Roofing LLC',
  require_po: true,
} as const;

describe('getCustomerDetail — company account resolution', () => {
  it('resolves the company and its PO requirement when the customer has a company_id', async () => {
    // ARRANGE
    const log: QueryRecord[] = [];
    const supabase = stubSupabase(
      { profiles: { ...PROFILE_WITH_COMPANY }, companies: { ...COMPANY_REQUIRING_PO } },
      log
    );

    // ACT
    const detail = await getCustomerDetail(supabase, 'profile-1');

    // ASSERT
    expect(
      detail?.companyAccount,
      'The admin PO panel renders from this object; if it is null the panel shows the no-company copy for a customer who does have one, and the setting becomes unreachable.'
    ).toEqual({ id: 'company-1', name: 'Hill Country Roofing LLC', requirePo: true });
  });

  it('issues exactly two queries, profiles then companies, keyed on company_id', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase(
      { profiles: { ...PROFILE_WITH_COMPANY }, companies: { ...COMPANY_REQUIRING_PO } },
      log
    );

    await getCustomerDetail(supabase, 'profile-1');

    expect(
      log.map((q) => q.table),
      'Must be two separate queries. profiles and companies are joined by TWO foreign keys (profiles.company_id and companies.primary_user_id), so a PostgREST embedded select is ambiguous and would need an explicit constraint-name hint.'
    ).toEqual(['profiles', 'companies']);
    expect(
      log[1].eqValue,
      'The companies lookup must key on the profile\'s company_id, not on the profile id — keying on the profile id would silently return nothing for every customer.'
    ).toBe('company-1');
  });

  it('selects require_po, or the admin panel has nothing to render', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase(
      { profiles: { ...PROFILE_WITH_COMPANY }, companies: { ...COMPANY_REQUIRING_PO } },
      log
    );

    await getCustomerDetail(supabase, 'profile-1');

    expect(
      log[1].columns.includes('require_po'),
      `The companies select must fetch require_po. Selected: "${log[1].columns}".`
    ).toBe(true);
    expect(
      log[0].columns.includes('company_id'),
      `The profiles select must fetch company_id or the second query can never run. Selected: "${log[0].columns}".`
    ).toBe(true);
  });

  it('returns a null company account when the customer has no company_id, and does not query companies', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase({ profiles: { ...PROFILE_WITHOUT_COMPANY } }, log);

    const detail = await getCustomerDetail(supabase, 'profile-1');

    expect(
      detail?.companyAccount,
      'company_id is nullable and most individual customers have no companies row — this is the normal case, not an error.'
    ).toBe(null);
    expect(
      log.map((q) => q.table),
      'With no company_id there is nothing to look up; a second query would be a wasted round trip on every customer page.'
    ).toEqual(['profiles']);
  });

  it('returns a null company account when the company row is missing despite a company_id', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase({ profiles: { ...PROFILE_WITH_COMPANY }, companies: null }, log);

    const detail = await getCustomerDetail(supabase, 'profile-1');

    expect(
      detail?.companyAccount,
      'A dangling company_id (or a read the policy refused) must degrade to the no-company panel, not throw and take the whole customer page down with it.'
    ).toBe(null);
  });

  it('reports requirePo false when the company does not require a PO', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase(
      { profiles: { ...PROFILE_WITH_COMPANY }, companies: { ...COMPANY_REQUIRING_PO, require_po: false } },
      log
    );

    const detail = await getCustomerDetail(supabase, 'profile-1');

    expect(detail?.companyAccount?.requirePo, 'false must survive as false.').toBe(false);
  });

  it('coerces a null require_po to false rather than leaking null into a boolean field', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase(
      { profiles: { ...PROFILE_WITH_COMPANY }, companies: { ...COMPANY_REQUIRING_PO, require_po: null } },
      log
    );

    const detail = await getCustomerDetail(supabase, 'profile-1');

    expect(
      detail?.companyAccount?.requirePo,
      'The column is NOT NULL in the schema, but the checkbox binds to this value directly — a null would make the input uncontrolled and React would warn, so it is pinned to a real boolean here.'
    ).toBe(false);
  });

  it('still returns the rest of the customer when the company lookup finds nothing', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase({ profiles: { ...PROFILE_WITHOUT_COMPANY } }, log);

    const detail = await getCustomerDetail(supabase, 'profile-1');

    expect(detail?.fullName, 'Adding the company lookup must not change the existing fields.').toBe(
      'Dana Reyes'
    );
    expect(detail?.netTerms, 'Adding the company lookup must not change the existing fields.').toBe(30);
    expect(
      detail?.company,
      'profiles.company is free text the customer typed at sign-up and is a DIFFERENT field from the companies row — both must survive independently.'
    ).toBe('Hill Country Roofing');
  });

  it('returns null for a customer that does not exist', async () => {
    const log: QueryRecord[] = [];
    const supabase = stubSupabase({ profiles: null }, log);

    const detail = await getCustomerDetail(supabase, 'nobody');

    expect(detail, 'A missing profile must stay null so the page can call notFound().').toBe(null);
    expect(
      log.map((q) => q.table),
      'No company lookup should be attempted for a customer that does not exist.'
    ).toEqual(['profiles']);
  });
});
