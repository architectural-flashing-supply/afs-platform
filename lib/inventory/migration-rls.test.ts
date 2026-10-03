import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADJUSTMENT_KINDS, STOCK_UNITS } from './stock-math';

/**
 * A STATIC TEST OVER THE TEXT OF MIGRATION 039.
 *
 * ===================== WHY THIS IS THE RIGHT TEST =====================
 *
 * The migration is deliberately NOT applied: the run that wrote it forbids
 * applying a migration, so there is no database to query and no live policy to
 * introspect. Asserting against the FILE is therefore not a weaker substitute
 * for a live check — it is the only honest check available, and it is the one
 * the queue item asks for by name ("RLS policy presence in the migration text").
 *
 * It also keeps working after the migration IS applied, as the guard that stops
 * a later edit from quietly removing a protection. Each assertion below exists
 * because its absence would be a specific, nameable defect, and the message
 * says which.
 *
 * Comments are stripped before the destructive-statement sweep (§"additive
 * only"), because the migration documents its own rollback path as a comment on
 * purpose — dropping an append-only history should never be a command somebody
 * can run by accident, and a grep that cannot tell code from commentary would
 * either fail on that comment or force it to be deleted.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const MIGRATION_FILE = '039_inventory_items_and_adjustments.sql';
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

const raw = fs.readFileSync(MIGRATION_PATH, 'utf8');

/** The SQL with every `--` comment removed, for assertions about statements. */
const code = raw
  .split('\n')
  .map((line) => {
    const idx = line.indexOf('--');
    return idx === -1 ? line : line.slice(0, idx);
  })
  .join('\n');

/** Collapse whitespace so an assertion is not defeated by a line break. */
const flat = code.replace(/\s+/g, ' ');

/**
 * The migration with every dollar-quoted body removed — the `$fn$ … $fn$` of a
 * function and the `$$ … $$` of a DO block.
 *
 * Needed for the "seeds nothing" assertion. `inventory_apply_adjustment()`
 * legitimately contains `INSERT INTO inventory_adjustments` — that is the whole
 * point of the function, the statement that writes the ledger row inside the
 * same transaction as the quantity change. A grep that cannot tell a statement
 * the migration RUNS from a statement a function it DEFINES will run later
 * would read that as a seed, and the only ways to make it pass would be to
 * delete the real guarantee or to weaken the test. Neither is acceptable, so
 * the test learns the difference instead.
 */
const topLevel = code.replace(/\$fn\$[\s\S]*?\$fn\$/g, ' ').replace(/\$\$[\s\S]*?\$\$/g, ' ');

describe('migration 039 — the file itself', () => {
  it('exists and is the next free migration number', () => {
    const numbers = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => Number(f.slice(0, 3)))
      .filter((n) => Number.isInteger(n));

    const highest = Math.max(...numbers);
    expect(
      highest,
      `039 must be the highest migration number; found ${highest}. Two migrations sharing a number apply in an undefined order, which is how a policy silently loses to an older copy of itself.`
    ).toBe(39);

    const duplicates = numbers.filter((n) => n === 39);
    expect(duplicates.length, 'exactly one migration may carry the number 039').toBe(1);
  });

  it('says in its own header that it has not been applied', () => {
    expect(
      raw,
      'the file has to state that it was never run, or a future reader will assume the tables exist on alpha and will not understand why the screen says otherwise'
    ).toContain('NOT APPLIED');
  });
});

describe('migration 039 — additive only', () => {
  // Each pattern, if present as real SQL, would mean this migration changes or
  // destroys something that already exists. The run's rules allow an additive
  // file only.
  const destructive: { pattern: RegExp; why: string }[] = [
    { pattern: /\bDROP\s+TABLE\b/i, why: 'dropping a table is not additive' },
    { pattern: /\bDROP\s+COLUMN\b/i, why: 'dropping a column destroys data' },
    { pattern: /\bTRUNCATE\b/i, why: 'truncating destroys every row' },
    { pattern: /\bDELETE\s+FROM\b/i, why: 'deleting rows is not additive' },
    { pattern: /\bUPDATE\s+(?!inventory_items\b)\w+\s+SET\b/i, why: 'updating an existing table is not additive' },
    { pattern: /\bALTER\s+TABLE\s+\w+\s+RENAME\b/i, why: 'renaming breaks every existing reference' },
    { pattern: /\bDROP\s+FUNCTION\b/i, why: 'dropping a function could remove one another migration depends on' },
  ];

  it.each(destructive)('contains no $pattern — $why', ({ pattern, why }) => {
    const match = code.match(pattern);
    expect(match, `${why}. Found: ${match?.[0] ?? ''}`).toBeNull();
  });

  it('does not redefine migration 035\'s afs_append_only(), which the pricing ledger depends on', () => {
    expect(
      code.includes('FUNCTION afs_append_only'),
      "CLAUDE.md rule #20 says do not simplify the pricing ledger's trigger away. This migration defines afs_inventory_append_only() instead, with inventory's own wording and no test-tag escape hatch."
    ).toBe(false);
  });

  it('seeds nothing — not one inventory row', () => {
    expect(
      /INSERT\s+INTO\s+inventory_/i.test(topLevel),
      'the queue item says "Ship with an empty table and a clear empty state; no invented stock numbers". A seeded row would be an invented stock number. (Measured against the migration with function bodies removed: inventory_apply_adjustment() legitimately inserts the ledger row at RUN time, which is not a seed.)'
    ).toBe(false);
    expect(
      /INSERT\s+INTO\s+inventory_adjustments/i.test(code),
      'the function that writes the ledger row must still be there — this half of the assertion stops the test from passing because the insert was deleted rather than because no seed exists'
    ).toBe(true);
  });
});

describe('migration 039 — both tables, with their real shape', () => {
  it('creates inventory_items idempotently', () => {
    expect(code, 'the table has to be created').toMatch(/CREATE TABLE IF NOT EXISTS inventory_items/);
  });

  it('creates inventory_adjustments idempotently', () => {
    expect(code, 'the ledger has to be created').toMatch(/CREATE TABLE IF NOT EXISTS inventory_adjustments/);
  });

  it('holds every field the queue item names', () => {
    for (const column of ['material_id', 'gauge_id', 'finish', 'coil_width_in', 'qty_on_hand', 'qty_reserved', 'reorder_point']) {
      expect(code, `inventory_items must have ${column} — the queue item names it explicitly`).toContain(column);
    }
  });

  it('points material and gauge at the vocabulary that already exists, rather than at free text', () => {
    expect(flat, 'material_id must be a real FK into materials, or a second drifting list of materials appears').toMatch(
      /material_id\s+uuid NOT NULL REFERENCES materials\(id\)/
    );
    expect(flat, 'gauge_id must be a real FK into gauges').toMatch(/gauge_id\s+uuid NOT NULL REFERENCES gauges\(id\)/);
  });

  it('leaves qty_on_hand and reorder_point NULLABLE WITH NO DEFAULT — a blank is never a zero', () => {
    const onHand = flat.match(/qty_on_hand\s+numeric\(12,2\)([^,]*),/);
    expect(onHand, 'qty_on_hand must be declared as numeric(12,2)').not.toBeNull();
    expect(
      onHand?.[1].trim(),
      'qty_on_hand must have NO default and NO NOT NULL: NULL means nobody has counted this yet, and defaulting it to 0 would invent a measurement (CLAUDE.md rule #19 applied to quantities)'
    ).toBe('');

    const reorder = flat.match(/reorder_point\s+numeric\(12,2\)([^,]*),/);
    expect(reorder, 'reorder_point must be declared as numeric(12,2)').not.toBeNull();
    expect(
      reorder?.[1].trim(),
      'reorder_point must have no default: NULL means nobody has said what low means, which is different from a threshold of 0'
    ).toBe('');
  });

  it('gives qty_reserved NOT NULL DEFAULT 0 — the one deliberate exception', () => {
    expect(
      flat,
      'nothing reserved is a fact, unlike no metal, which would be a guess. Same carve-out as `extras` in CLAUDE.md rule #19.'
    ).toMatch(/qty_reserved\s+numeric\(12,2\) NOT NULL DEFAULT 0/);
  });

  it('requires a reason and an actor on every ledger row', () => {
    expect(flat, '"with reason and who" is only true if the reason cannot be skipped').toMatch(/reason\s+text NOT NULL/);
    expect(flat, 'every adjustment records who made it').toMatch(/adjusted_by\s+uuid NOT NULL REFERENCES profiles\(id\)/);
    expect(
      code,
      'a reason of "   " is not a reason, so the database refuses a blank one as well as a missing one'
    ).toMatch(/inventory_adjustments_reason_not_blank/);
  });

  it('constrains the unit and the kind to exactly the sets the TypeScript knows about', () => {
    for (const unit of STOCK_UNITS) {
      expect(code, `the stock_unit CHECK must list '${unit}', or a row the UI offers is refused by the database`).toContain(
        `'${unit}'`
      );
    }
    for (const kind of ADJUSTMENT_KINDS) {
      expect(code, `the kind CHECK must list '${kind}'`).toContain(`'${kind}'`);
    }
  });

  it('refuses a row whose kind and fields disagree, and whose kind and sign disagree', () => {
    expect(
      code,
      'without the shape CHECK a row could claim to be a count and carry a reserved delta, and the log would stop being readable'
    ).toContain('inventory_adjustments_shape');
    expect(
      code,
      'without the sign CHECK a "receipt" of a negative amount — a mis-keyed consumption — would be recorded as the wrong event'
    ).toContain('inventory_adjustments_sign');
  });

  it('makes the identity index a PARTIAL UNIQUE index over COALESCE, not a plain UNIQUE constraint', () => {
    const idx = flat.match(/CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_identity(.*?);/);
    expect(idx, 'the identity index has to exist, or duplicate rows for the same stock pile accumulate').not.toBeNull();
    expect(
      idx?.[1],
      "PostgreSQL's default is NULLS DISTINCT, so a plain UNIQUE over a nullable finish would let unlimited duplicate mill-finish rows coexist — which is the row shape AFS has most of. COALESCE makes the NULLs comparable."
    ).toContain('COALESCE');
    expect(
      idx?.[1],
      'the index must be partial on retired_at IS NULL, so retiring a row frees its identity slot and the same item can be created again'
    ).toContain('WHERE retired_at IS NULL');
  });

  it('makes the idempotency key a database constraint rather than a convention', () => {
    expect(
      code,
      'a double-clicked Apply or a retried fetch must not be able to apply a delta twice, even if the function\'s early return were removed'
    ).toContain('uq_inventory_adjustments_client_request');
  });
});

describe('migration 039 — RLS', () => {
  it('enables row level security on both tables', () => {
    expect(code, 'inventory_items without RLS is readable by any authenticated user, and a quantity is back-office').toMatch(
      /ALTER TABLE inventory_items\s+ENABLE ROW LEVEL SECURITY/
    );
    expect(code, 'the ledger needs RLS too').toMatch(/ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY/);
  });

  it('scopes inventory_items to admins through the existing is_admin() helper', () => {
    expect(flat, 'an item is created, edited and retired by an admin, so FOR ALL is right here').toMatch(
      /CREATE POLICY admin_all_inventory_items ON inventory_items FOR ALL USING \(is_admin\(\)\) WITH CHECK \(is_admin\(\)\)/
    );
  });

  it('gives the ledger a SELECT policy and an INSERT policy and NOTHING ELSE', () => {
    expect(flat, 'an admin has to be able to read the history').toMatch(
      /CREATE POLICY admin_read_inventory_adjustments ON inventory_adjustments FOR SELECT USING \(is_admin\(\)\)/
    );
    expect(flat, 'an admin has to be able to add to the history').toMatch(
      /CREATE POLICY admin_insert_inventory_adjustments ON inventory_adjustments FOR INSERT/
    );

    // The absence is the assertion. CLAUDE.md rule #20's reasoning for the
    // pricing ledger applies here: with no UPDATE or DELETE policy, a session
    // has no route to either operation even before the trigger is consulted.
    const policies = [...flat.matchAll(/CREATE POLICY \w+ ON inventory_adjustments FOR (\w+)/g)].map((m) => m[1].toUpperCase());
    expect(policies.sort(), 'exactly two policies on the ledger: SELECT and INSERT').toEqual(['INSERT', 'SELECT']);
    expect(
      policies.includes('UPDATE'),
      'an UPDATE policy on an append-only ledger would make the history editable. Do not add one.'
    ).toBe(false);
    expect(policies.includes('DELETE'), 'a DELETE policy would make the history removable. Do not add one.').toBe(false);
    expect(policies.includes('ALL'), 'FOR ALL on the ledger would grant UPDATE and DELETE by the back door').toBe(false);
  });

  it('pins the actor in the INSERT policy, so one admin cannot record a change against another admin\'s name', () => {
    expect(
      flat,
      "the ledger's whole value is the reason and WHO. Without `adjusted_by = auth.uid()` a direct insert could attribute a change to somebody who never made it."
    ).toMatch(/admin_insert_inventory_adjustments ON inventory_adjustments FOR INSERT WITH CHECK \(is_admin\(\) AND adjusted_by = auth\.uid\(\)\)/);
  });

  it('has no company_id on either table, and the reason is written down', () => {
    expect(
      code.includes('company_id'),
      "in THIS schema `companies` is the CUSTOMER's organisation (SCHEMA.md TABLE 2), reached through profiles.company_id. Coil in the Burnet shop belongs to AFS, so a company_id here could only be a dead always-NULL column or an assertion that a contractor owns AFS's metal — which would make the policy wrong in the dangerous direction. The tenancy boundary for an AFS-internal table in this codebase is is_admin(), exactly as migration 035 uses for the price book and the pricing ledger."
    ).toBe(false);
    expect(
      raw,
      'the decision must be documented in the file, not only in a test message'
    ).toContain('WHY THERE IS NO `company_id`');
  });
});

describe('migration 039 — the ledger cannot be changed, and a quantity cannot move unlogged', () => {
  it('binds a BEFORE UPDATE OR DELETE trigger on the ledger', () => {
    expect(flat, 'the trigger is the refusal that binds the table owner and the service role, which a missing policy does not').toMatch(
      /CREATE TRIGGER inventory_adjustments_append_only BEFORE UPDATE OR DELETE ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION afs_inventory_append_only\(\)/
    );
  });

  it('makes that trigger function raise, with no escape hatch of any kind', () => {
    const fn = flat.match(/FUNCTION afs_inventory_append_only\(\) RETURNS trigger(.*?)\$fn\$;/);
    expect(fn, 'the inventory append-only function has to exist').not.toBeNull();
    expect(fn?.[1], 'it has to actually refuse, not just log').toContain('RAISE EXCEPTION');
    expect(
      fn?.[1].includes('test_tag'),
      "035's function has a test_tag escape hatch so pricing E2E data can be cleaned up. This ledger has no test rows at all, so an escape hatch would be a hole with no user."
    ).toBe(false);
    expect(fn?.[1], 'a refusal is a privilege error, matching the pricing ledger').toContain("'42501'");
  });

  it('refuses a direct quantity change at the database, not only in the API route', () => {
    expect(
      flat,
      'admin_all_inventory_items is FOR ALL, so without this trigger an admin session could PATCH qty_on_hand straight through PostgREST and move a number with no ledger row behind it. A route refusing something is not enforcement — CLAUDE.md rule #14.'
    ).toMatch(
      /CREATE TRIGGER inventory_items_quantities_through_ledger BEFORE INSERT OR UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION afs_inventory_quantities_through_ledger\(\)/
    );

    const guard = flat.match(/FUNCTION afs_inventory_quantities_through_ledger\(\) RETURNS trigger(.*?)\$fn\$;/);
    expect(guard, 'the guard function has to exist').not.toBeNull();
    expect(guard?.[1], 'it must compare both quantity columns').toContain('qty_on_hand IS DISTINCT FROM OLD.qty_on_hand');
    expect(guard?.[1], 'it must compare the reserved column too, or reservations become the unguarded back door').toContain(
      'qty_reserved IS DISTINCT FROM OLD.qty_reserved'
    );
    expect(guard?.[1], 'it must refuse an INSERT that arrives already carrying a quantity').toContain('TG_OP = \'INSERT\'');
    expect(guard?.[1], 'it must actually raise').toContain('RAISE EXCEPTION');
    expect(
      guard?.[1],
      'the flag must be read with the missing_ok form: current_setting with one argument ERRORS when the setting was never set, which would turn every ordinary edit into a failure'
    ).toContain("current_setting('afs.inventory_apply', true)");
  });

  it('lets exactly one thing set the bypass flag, and sets it transaction-locally', () => {
    const sets = [...code.matchAll(/set_config\('afs\.inventory_apply',\s*'(\w+)',\s*(\w+)\)/g)];
    expect(
      sets.length,
      'the flag is set on and off again around one UPDATE inside inventory_apply_adjustment() and nowhere else; more call sites means more ways to move a quantity unlogged'
    ).toBe(2);
    expect(sets.map((m) => m[1]).sort(), 'on before the update, off immediately after').toEqual(['off', 'on']);
    for (const m of sets) {
      expect(
        m[2],
        'the third argument must be true (transaction-local), or the flag leaks across statements on a pooled connection and the guard stops guarding'
      ).toBe('true');
    }
  });
});

describe('migration 039 — inventory_apply_adjustment()', () => {
  const fn = flat.match(/CREATE OR REPLACE FUNCTION inventory_apply_adjustment\((.*?)\$fn\$;/);

  it('exists', () => {
    expect(fn, 'the one transaction that writes a quantity and its ledger row together has to exist').not.toBeNull();
  });

  it('is SECURITY INVOKER, so the admin-only policies remain the real boundary', () => {
    expect(
      fn?.[1],
      'SECURITY DEFINER here would be a documented way around the RLS policies in §5 — the caller\'s own rights must apply'
    ).toContain('SECURITY INVOKER');
  });

  it('locks the item row, so two admins cannot interleave a read and a write', () => {
    expect(fn?.[1], 'without FOR UPDATE, two concurrent adjustments can both read the old quantity and the second overwrites the first').toContain(
      'FOR UPDATE'
    );
  });

  it('compares the caller\'s expectation with IS NOT DISTINCT FROM, not with =', () => {
    expect(
      fn?.[1],
      'qty_on_hand is NULL for a never-counted item, and NULL = NULL is UNKNOWN — with `=` the very first count would always report a conflict'
    ).toContain('IS NOT DISTINCT FROM');
  });

  it('returns an existing row for a repeated client_request_id instead of applying the delta again', () => {
    expect(fn?.[1], 'idempotency has to be checked before anything is written').toContain('client_request_id = p_client_request_id');
    expect(fn?.[1], 'and it has to return the original row').toMatch(/RETURN v_existing/);
  });

  it('binds the actor and the source to the session rather than trusting the parameters', () => {
    expect(fn?.[1], 'the actor comes from auth.uid() when there is a session').toContain('auth.uid()');
    expect(
      fn?.[1],
      'a session passing somebody else\'s id must be refused, or the ledger can attribute a change to an admin who never made it'
    ).toContain('p_adjusted_by IS DISTINCT FROM v_uid');
    expect(
      fn?.[1],
      "a session must not be able to claim source 'erp_sync' and forge the provenance of a future ERP import"
    ).toContain("p_source IS DISTINCT FROM 'admin_ui'");
  });

  it('refuses to move the quantities of a retired item', () => {
    expect(fn?.[1], 'a retired item is out of service; its history stays readable but its numbers stop moving').toContain('retired_at IS NOT NULL');
  });

  it('writes the quantities and inserts the ledger row in the same function body', () => {
    expect(fn?.[1], 'the UPDATE has to be here').toMatch(/UPDATE inventory_items SET qty_on_hand = p_on_hand_after/);
    expect(fn?.[1], 'and the INSERT has to be here, in the same transaction — otherwise one can happen without the other').toMatch(
      /INSERT INTO inventory_adjustments/
    );
  });

  it('does not reimplement the business math that lib/inventory/stock-math.ts owns', () => {
    // The function is handed the already-computed results. If it started
    // deciding what is available or what counts as low, there would be two
    // sources of truth in two languages, and they would drift.
    expect(
      fn?.[1].includes('reorder_point'),
      'the low-stock threshold is decided in lib/inventory/stock-math.ts and nowhere else; this function must not read reorder_point'
    ).toBe(false);
    expect(fn?.[1], 'it is handed the computed result').toContain('p_on_hand_after');
    expect(fn?.[1], 'and the computed reserved result').toContain('p_reserved_after');
  });
});

describe('migration 039 — the ERP seam SPEC_LIVE_INVENTORY.md §4 defers', () => {
  it('admits the deferred writers as a source value, so arriving needs no schema change', () => {
    expect(code, "'erp_sync' has to be an allowed source already").toContain("'erp_sync'");
    expect(code, "'import' has to be an allowed source already").toContain("'import'");
    expect(
      code,
      'admin_ui is the only writer today, and it is the default'
    ).toMatch(/source\s+text NOT NULL DEFAULT 'admin_ui'/);
  });
});
