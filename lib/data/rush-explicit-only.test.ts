import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * RUSH IS NEVER INFERRED — enforced statically, the same way the PathfinderEdge
 * single door is (lib/integrations/pathfinder-single-door.test.ts).
 *
 * Command Center V2 prompt v2-02: `is_rush` may be set by an explicit customer
 * checkbox at intake, or by an explicit admin toggle. Never from a date, a
 * keyword, a note, or how long something has been waiting.
 *
 * Three layers hold that, and this file is the second:
 *
 *   1. POSTGRES. Migration 034's `quote_requests_rush_needs_explicit_source`
 *      CHECK refuses `is_rush = true` unless `rush_source` is
 *      'customer_checkbox' or 'admin_toggle'. There is no third value.
 *   2. THIS TEST. It walks the source tree and fails if any file other than the
 *      known writers sets `is_rush` on quote_requests, and fails if any of those
 *      writers gains an inference-shaped expression.
 *   3. The routes themselves reject a non-boolean `isRush` with a 400.
 *
 * Adding a new rush writer means adding it to ALLOWED_WRITERS below, which is a
 * reviewable change, not an accident.
 */

const ROOTS = ['app', 'components', 'lib', 'scripts'];
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

/** This file names `is_rush` in order to police it, and excludes itself. */
const SELF = 'lib/data/rush-explicit-only.test.ts';

/**
 * The ONLY files allowed to write quote_requests.is_rush, each with why.
 * A `machine_jobs.is_rush` write is a COPY of an already-decided value, not a
 * decision, so the approval route is on the list for that reason.
 */
const ALLOWED_WRITERS: Record<string, string> = {
  'app/api/quote-requests/route.ts': 'the customer checkbox at intake',
  'app/api/field/quote-request/route.ts': 'the field app, which always writes false',
  'app/api/admin/command-center/set-rush/route.ts': 'the explicit admin toggle',
  'app/api/admin/command-center/approve-quote-request/route.ts':
    'copies the already-decided value onto machine_jobs; decides nothing',
  'lib/pricing/ledger.ts':
    'records the already-decided value on a pricing_ledger row; decides nothing. ' +
    'Added deliberately in v2-03 — the ledger has to carry the rush flag because ' +
    'dynamic pricing needs to know whether a quote was a rush job, and recording a ' +
    'fact is not the same as deciding it. `is_rush: entry.isRush ?? null` reads one ' +
    'boolean straight off the caller and can reach no date, note or keyword.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/**
 * Lines in `text` that really ASSIGN `field` a value.
 *
 * Three shapes name a rush field without setting it, and all three have to be
 * excluded or this test flags the very routes it is meant to bless. The first
 * version of this file failed on all three, which is why the rule is now about
 * what the VALUE looks like rather than about line shape:
 *
 *   `is_rush: boolean;`                                  a type annotation
 *   `as { status: string; is_rush: boolean }[]`           a cast
 *   `select('... is_rush, requested_delivery ...')`       a column list
 *
 * An assignment assigns a value — `true`, `false`, `isRush`, `qr.is_rush`. It
 * never assigns the bare word `boolean`. That is the discriminator.
 */
const TS_TYPE_VALUE = /^(boolean|string|number|uuid|null|unknown|any|Date)\b/;

function assignmentLines(text: string, field: string): string[] {
  const re = new RegExp(`\\b${field}\\s*:\\s*([^,;}\\n]*)`);
  return text.split('\n').filter((line) => {
    const t = line.trim();
    // A PostgREST column list, not code.
    if (/^['"`]|select\(/.test(t)) return false;
    const m = t.match(re);
    if (!m) return false;
    return !TS_TYPE_VALUE.test(m[1].trim());
  });
}

function sourceFiles(): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  for (const root of ROOTS) {
    let stat;
    try {
      stat = statSync(join(process.cwd(), root));
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const full of walk(join(process.cwd(), root))) {
      const path = relative(process.cwd(), full).split('\\').join('/');
      if (path === SELF) continue;
      files.push({ path, text: readFileSync(full, 'utf8') });
    }
  }
  return files;
}

describe('rush is set explicitly, or not at all', () => {
  const files = sourceFiles();

  it('scans a real source tree (guards against the scan silently finding nothing)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('only the four known writers assign is_rush at all', () => {
    const writers = files
      // A `.test.ts` fixture object is not a database writer. Excluded here
      // rather than silently: a unit test that constructs `{ is_rush: false }`
      // to exercise a pure function reaches no database at all.
      .filter(({ path }) => !path.endsWith('.test.ts'))
      .filter(({ text }) => assignmentLines(text, 'is_rush').length > 0)
      .map(({ path }) => path)
      .sort();
    expect(writers).toEqual(Object.keys(ALLOWED_WRITERS).sort());
  });

  it('no writer derives rush from a date, a keyword or a note', () => {
    // The shapes an inference would actually take, checked against the
    // ASSIGNMENT LINE itself — so an unrelated date elsewhere in a 700-line
    // route is not a false positive, and an inference on the line that decides
    // rush cannot hide.
    const inferenceShapes: [RegExp, string][] = [
      [/requested_delivery/i, 'a requested delivery date'],
      [/\bnotes\b/i, 'the customer note'],
      [/submitted_at/i, 'how long it has waited'],
      [/(includes|match|test|indexOf|search)\s*\(/i, 'a text search'],
      [/\b(asap|urgent|expedite)\b/i, 'a keyword'],
      [/Date\s*\(/, 'a date calculation'],
      [/\bdaysSince\b/, 'an age calculation'],
    ];
    for (const path of Object.keys(ALLOWED_WRITERS)) {
      const text = files.find((f) => f.path === path)?.text ?? '';
      expect(text, `missing writer ${path}`).not.toBe('');
      for (const line of assignmentLines(text, 'is_rush')) {
        for (const [shape, what] of inferenceShapes) {
          expect(shape.test(line), `${path} infers rush from ${what}: ${line.trim()}`).toBe(false);
        }
      }
    }
  });

  it('rush_source is only ever one of the two allowed values', () => {
    const allowed = [
      /rush_source:\s*null/,
      /rush_source:\s*rushSource/,
      /rush_source:\s*isRush \? 'admin_toggle' : null/,
      /rush_source:\s*'customer_checkbox'/,
      /rush_source:\s*'admin_toggle'/,
    ];
    for (const { path, text } of files) {
      for (const line of assignmentLines(text, 'rush_source')) {
        expect(
          allowed.some((a) => a.test(line.trim())),
          `${path}: unexpected rush_source assignment -> ${line.trim()}`
        ).toBe(true);
      }
    }
  });

  it('the admin toggle refuses anything that is not exactly true or false', () => {
    const text = files.find((f) => f.path === 'app/api/admin/command-center/set-rush/route.ts')!.text;
    expect(text).toContain('body.isRush !== true && body.isRush !== false');
    expect(text).toContain('Rush is never inferred.');
  });

  it('the customer intake route names the checkbox as its source', () => {
    const text = files.find((f) => f.path === 'app/api/quote-requests/route.ts')!.text;
    expect(text).toContain("'customer_checkbox'");
    expect(text).toContain('body.isRush === true');
  });

  it('the database constraint that backs all of this is in a committed migration', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/034_command_center_v2_workbench.sql'),
      'utf8'
    );
    expect(sql).toContain('quote_requests_rush_needs_explicit_source');
    // The IS NOT NULL half is what makes the constraint actually bite — without
    // it the CHECK evaluates to UNKNOWN and Postgres ACCEPTS the row. This was
    // written the naive way first and proven wrong against the live database.
    expect(sql).toMatch(/NOT is_rush\s*\n?\s*OR \(rush_source IS NOT NULL/);
  });
});

describe('rush pins to the top of the SHOP QUEUES ONLY', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('the machine queue and the production/driver queues still pin rush first', () => {
    expect(read('lib/data/machine-jobs.ts')).toContain("order('is_rush', { ascending: false })");
    expect(read('lib/data/orders.ts')).toContain("order('is_rush', { ascending: false })");
  });

  it('the Workbench does NOT reorder by rush — newest arrival, everywhere', () => {
    const workbench = read('lib/data/workbench.ts');
    expect(workbench).not.toContain("order('is_rush'");
    expect(workbench).toContain("order('submitted_at', { ascending: false })");
  });

  it('the office pending list no longer reorders by rush either', () => {
    expect(read('lib/data/pending-quote-requests.ts')).not.toContain("order('is_rush'");
  });
});
