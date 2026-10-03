/**
 * EES-OVN.08 AC-12, AC-38 — THE MIGRATION'S OWN GUARANTEES.
 *
 * ================== WHY THIS TEST READS A FILE ==================
 *
 * The overnight run is forbidden from applying migrations to Supabase, so no
 * Postgres instance exists here to reject a bad row and prove the CHECK works.
 * The honest alternative is to assert that the constraints, the RLS and the
 * absence of seed data are REALLY IN THE FILE that will be applied — which is a
 * weaker claim than "Postgres refused it", and is stated as such in the final
 * report rather than dressed up.
 *
 * It is still worth having. The three things asserted below are the ones whose
 * accidental removal would be invisible in review:
 *   - the amount/outcome CHECK, which is the database half of "an uncalculated
 *     tax is not a zero tax";
 *   - admin-only RLS with no authenticated/anon policy;
 *   - and above all, THAT NO NEXUS STATE IS SEEDED. A future edit that adds a
 *     "helpful" starter list would make the app look configured and collect the
 *     wrong tax in the wrong states.
 *
 * This is the same technique lib/data/removed-machine-library.test.ts and
 * lib/integrations/pathfinder-single-door.test.ts use: a static assertion over
 * real repository text, rather than trusting a comment.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NEXUS_BASES } from './types';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '039_tax_nexus_and_calculations.sql'
);

function migrationSql(): string {
  return readFileSync(MIGRATION_PATH, 'utf8');
}

/** The SQL with every `--` comment line removed, so a comment cannot satisfy an assertion. */
function sqlWithoutComments(): string {
  return migrationSql()
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

describe('migration 039 — it exists and is additive', () => {
  it('is readable', () => {
    expect(
      migrationSql().length,
      `Expected to read ${MIGRATION_PATH}. If this fails the migration file was renamed or removed.`
    ).toBeGreaterThan(0);
  });

  it('creates both tables with IF NOT EXISTS, so re-running is safe', () => {
    const sql = sqlWithoutComments();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tax_nexus_states');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tax_calculations');
  });

  it('ALTERS no existing table and DROPS no table', () => {
    // ARRANGE
    const sql = sqlWithoutComments();

    // ACT — the only ALTERs permitted are on the two tables this file creates.
    const alters = sql.match(/ALTER TABLE\s+(\w+)/gi) ?? [];
    const altered = new Set(
      alters.map((m) => m.replace(/ALTER TABLE\s+/i, '').trim().toLowerCase())
    );

    // ASSERT
    for (const table of altered) {
      expect(
        ['tax_nexus_states', 'tax_calculations'].includes(table),
        `Migration 039 ALTERs "${table}", which it did not create. This migration is specified as ` +
          'additive only: it must not change an existing table, because nothing in it may alter a ' +
          'figure on a quote, order or invoice that already exists.'
      ).toBe(true);
    }

    expect(
      /DROP\s+TABLE/i.test(sql),
      'An additive migration must not drop a table.'
    ).toBe(false);
    expect(
      /\bUPDATE\s+\w+\s+SET\b/i.test(sql),
      'An additive migration must not rewrite existing rows.'
    ).toBe(false);
  });
});

describe('AC-12: the database enforces "an uncalculated tax is not a zero tax"', () => {
  it('carries the amount/outcome equality CHECK', () => {
    // ARRANGE / ACT
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');

    // ASSERT
    expect(
      sql,
      'THE LOAD-BEARING CONSTRAINT. Without it, TypeScript is the only thing stopping a failed ' +
        "calculation being stored with amount_cents = 0, and TypeScript is erased at runtime. " +
        'Expected: CHECK ((outcome = \'calculated\') = (amount_cents IS NOT NULL))'
    ).toContain("CHECK ((outcome = 'calculated') = (amount_cents IS NOT NULL))");
  });

  it('does NOT write that CHECK in a form that goes UNKNOWN on a NULL', () => {
    // ARRANGE — CLAUDE.md rule #15 records the real bug this guards: the naive
    // rush CHECK was ACCEPTED for a NULL source because `false OR UNKNOWN` is
    // UNKNOWN and a CHECK accepts UNKNOWN.
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');

    // ASSERT
    expect(
      /amount_cents\s*(=|<>)\s*0/i.test(sql),
      'A comparison like `amount_cents <> 0` goes UNKNOWN when amount_cents is NULL, and a CHECK ' +
        'ACCEPTS UNKNOWN — so it would silently permit exactly the rows the constraint forbids. ' +
        'Keep the IS NOT NULL form.'
    ).toBe(false);
  });

  it('allows amount_cents to be NULL, because a non-answer has no amount', () => {
    const sql = sqlWithoutComments();
    expect(
      /amount_cents\s+bigint\s*,/.test(sql.replace(/\s+/g, ' ')),
      'amount_cents must be NULLABLE with NO DEFAULT. A `NOT NULL DEFAULT 0` here would make every ' +
        'failure look like a zero tax, which is the bug this item exists to prevent.'
    ).toBe(true);
    expect(
      /amount_cents[^,]*DEFAULT/i.test(sql),
      'amount_cents must have no DEFAULT. A default zero is a price, and a made-up one.'
    ).toBe(false);
  });

  it('restricts outcome to the two provider-interaction values', () => {
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');
    expect(
      sql,
      'Only provider interactions are stored. not_configured / exempt / no_nexus are decided locally ' +
        'and write no row, which is what keeps this table meaningful.'
    ).toContain("CHECK (outcome IN ('calculated', 'failed'))");
  });

  it('forbids a cached failure at the database level', () => {
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');
    expect(
      sql,
      'A failure must never be servable from cache: one vendor blip would become a day of refusals. ' +
        'Expressed as a constraint so a future caller cannot make one cacheable by setting an expiry.'
    ).toContain("CHECK (outcome <> 'failed' OR expires_at IS NULL)");
  });

  it('forbids negative money', () => {
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');
    expect(sql, 'A negative sales tax is not a thing.').toContain('amount_cents >= 0');
    expect(sql).toContain('subtotal_cents >= 0');
  });
});

describe('AC-38: RLS is admin-only on both tables, with no customer policy', () => {
  it('enables RLS on both tables', () => {
    const sql = sqlWithoutComments();
    expect(sql).toContain('ALTER TABLE tax_nexus_states  ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE tax_calculations  ENABLE ROW LEVEL SECURITY');
  });

  it('grants admin-only access through is_admin(), matching migration 035', () => {
    const sql = sqlWithoutComments();
    expect(sql).toContain('CREATE POLICY admin_all_tax_nexus_states ON tax_nexus_states FOR ALL USING (is_admin())');
    expect(sql).toContain('CREATE POLICY admin_all_tax_calculations ON tax_calculations FOR ALL USING (is_admin())');
  });

  it('creates NO policy for the authenticated or anon role', () => {
    // ARRANGE
    const sql = sqlWithoutComments();

    // ACT
    const policies = sql.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];

    // ASSERT
    expect(policies.length, 'Exactly two policies are expected, one per table.').toBe(2);
    for (const policy of policies) {
      expect(
        /\bTO\s+(authenticated|anon|public)\b/i.test(policy),
        'Neither table may have a customer-readable policy. With RLS on and no matching policy, a ' +
          'non-admin role can read nothing — which is the tenancy boundary that actually exists for ' +
          "AFS's own tax configuration. Offending policy: " + policy
      ).toBe(false);
      expect(
        policy,
        'Every policy here must be gated on is_admin().'
      ).toContain('is_admin()');
    }
  });

  it('every policy is dropped before it is created, so re-running is safe', () => {
    const sql = sqlWithoutComments();
    expect(sql).toContain('DROP POLICY IF EXISTS admin_all_tax_nexus_states');
    expect(sql).toContain('DROP POLICY IF EXISTS admin_all_tax_calculations');
  });
});

describe('AC-11 / INV-11: NO NEXUS STATE IS SEEDED', () => {
  it('inserts nothing at all', () => {
    // ARRANGE
    const sql = sqlWithoutComments();

    // ACT
    const inserts = sql.match(/INSERT\s+INTO/gi) ?? [];

    // ASSERT
    expect(
      inserts.length,
      'THE MOST IMPORTANT ASSERTION IN THIS FILE. AFS\'s nexus state list is an open data blocker ' +
        '(checklist #31) and must come from its accountant — nexus is established by physical ' +
        'presence, economic thresholds and employee presence, none of which is derivable from this ' +
        'codebase. A seeded starter list would make the app LOOK configured, calculate confidently, ' +
        `and collect the wrong tax in the wrong states. Found ${inserts.length} INSERT statement(s).`
    ).toBe(0);
  });

  it('mentions no US state code as a seeded value', () => {
    // ARRANGE — a loose check that no VALUES clause smuggled a state in.
    const sql = sqlWithoutComments();

    // ASSERT
    expect(
      /VALUES\s*\(/i.test(sql),
      'No VALUES clause belongs in this migration: it creates structure only.'
    ).toBe(false);
  });

  it('says in the file that empty means "not configured", not "no tax owed"', () => {
    // The comment is the handover to the next reader, so its presence is asserted.
    expect(
      migrationSql(),
      'A future reader who does not know why the table is empty is the person most likely to seed it.'
    ).toContain('It does NOT mean "no tax is owed"');
  });
});

describe('the migration and the TypeScript types cannot drift', () => {
  it('the nexus_basis CHECK lists exactly the four NexusBasis values', () => {
    // ARRANGE
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');

    // ACT / ASSERT — each union member must appear in the constraint.
    for (const basis of NEXUS_BASES) {
      expect(
        sql,
        `NexusBasis includes "${basis}" but the migration's CHECK does not list it, so a valid typed ` +
          'value would be rejected by the database as a 500 instead of being saved.'
      ).toContain(`'${basis}'`);
    }

    // And the constraint must not admit a fifth value the type does not know.
    const match = sql.match(/CHECK \(nexus_basis IN \(([^)]*)\)\)/);
    expect(match, "Expected a nexus_basis IN (...) CHECK in the migration.").not.toBeNull();
    const listed = (match?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter((s) => s !== '');
    expect(
      listed.sort(),
      'The database must admit exactly the values the TypeScript union admits — no more, no fewer.'
    ).toEqual([...NEXUS_BASES].sort());
  });

  it('the state_code CHECK matches normalizeStateCode\'s two-uppercase-letter rule', () => {
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');
    expect(
      sql,
      'lib/tax/nexus.ts normalises to two uppercase ASCII letters; the column constraint is the ' +
        'second line of defence and must agree.'
    ).toContain("CHECK (state_code ~ '^[A-Z]{2}$')");
  });

  it('one row per state is enforced, so a double click cannot create two', () => {
    const sql = sqlWithoutComments().replace(/\s+/g, ' ');
    expect(sql).toContain('UNIQUE (state_code)');
  });

  it('indexes the cache read and the review queue', () => {
    const sql = sqlWithoutComments();
    expect(sql, 'The cache lookup is by key and expiry.').toContain(
      'idx_tax_calculations_cache'
    );
    expect(sql, 'The review queue is a small minority of rows, so the index is partial.').toContain(
      'WHERE requires_review'
    );
  });
});
