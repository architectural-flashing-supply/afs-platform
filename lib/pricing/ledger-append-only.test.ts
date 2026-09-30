import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ledgerTestTag, ledgerToCsv, toLedgerRow, LEDGER_TEST_TAG_PREFIX, LEDGER_CSV_COLUMNS } from './ledger';

/**
 * APPEND-ONLY, PROVED AGAINST THE LIVE DATABASE.
 *
 * WHY THIS TEST TALKS TO POSTGRES AND THE REST OF lib/pricing DOES NOT. The
 * claim being tested is not "our code does not issue an UPDATE" — that is a
 * claim about code, and code changes. The claim is "the DATABASE REFUSES an
 * UPDATE", which is a fact about migration 035's `pricing_ledger_append_only`
 * trigger, and the only way to find out is to try it.
 *
 * NOTHING IS LEFT BEHIND. The probe runs inside a PL/pgSQL block that RAISES at
 * the end, which aborts the whole statement and rolls the probe row back. The
 * result of both attempts is carried out in the exception message. The test
 * asserts the row count is unchanged afterwards, so "nothing was left behind"
 * is measured rather than assumed.
 *
 * The SQL goes through the Supabase Management API — the same channel this
 * project's migrations and its E2E helpers already use
 * (tests/e2e/helpers/db.ts). It needs SUPABASE_ACCESS_TOKEN and
 * NEXT_PUBLIC_SUPABASE_URL from .env.local. Without them the four database
 * assertions cannot run and are skipped WITH A LOUD MESSAGE — a skip here is
 * not a pass, and the gate's own output shows it.
 */

function env(key: string): string | null {
  if (process.env[key]) return process.env[key] as string;
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return null;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 1 || line.trim().startsWith('#')) continue;
    if (line.slice(0, i).trim() === key) return line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const TOKEN = env('SUPABASE_ACCESS_TOKEN');
const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL');
const dbReachable = Boolean(TOKEN && SUPABASE_URL);

if (!dbReachable) {
  console.warn(
    '\n[ledger-append-only] SKIPPING the database proofs: SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL are not set.\n' +
      '                      A skip is NOT a pass. The append-only guarantee is unverified in this run.\n'
  );
}

interface SqlOutcome {
  ok: boolean;
  rows: Record<string, unknown>[];
  error: string;
}

async function sql(query: string): Promise<SqlOutcome> {
  const ref = new URL(SUPABASE_URL as string).hostname.split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN as string}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, rows: [], error: text };
  return { ok: true, rows: JSON.parse(text) as Record<string, unknown>[], error: '' };
}

describe.skipIf(!dbReachable)('pricing_ledger — the database refuses UPDATE and DELETE', () => {
  it('rejects BOTH an UPDATE and a DELETE, and leaves no probe row behind', async () => {
    const before = await sql('select count(*)::int as n from pricing_ledger;');
    expect(before.ok).toBe(true);
    const countBefore = before.rows[0].n as number;

    // The probe: insert, try to update it, try to delete it, then RAISE so the
    // whole statement rolls back. Both attempts report through the message.
    const probe = await sql(`
do $proof$
declare v_id uuid; upd text; del text;
begin
  insert into pricing_ledger (event_type, source, note, amount_cents)
  values ('price_book_change','system','append-only probe (rolled back)', 4242)
  returning id into v_id;

  begin
    update pricing_ledger set note = 'tampered', amount_cents = 1 where id = v_id;
    upd := 'NOT_BLOCKED';
  exception when others then upd := 'BLOCKED:' || SQLSTATE;
  end;

  begin
    delete from pricing_ledger where id = v_id;
    del := 'NOT_BLOCKED';
  exception when others then del := 'BLOCKED:' || SQLSTATE;
  end;

  raise exception 'APPEND_ONLY_PROOF update=% delete=%', upd, del;
end
$proof$;`);

    expect(probe.ok).toBe(false); // the deliberate RAISE
    expect(probe.error).toContain('APPEND_ONLY_PROOF');
    expect(probe.error).toContain('update=BLOCKED:42501');
    expect(probe.error).toContain('delete=BLOCKED:42501');

    const after = await sql('select count(*)::int as n from pricing_ledger;');
    expect(after.rows[0].n).toBe(countBefore);
  }, 30000);

  it('has no UPDATE policy and no DELETE policy either — two refusals, not one', async () => {
    const { rows } = await sql(
      `select cmd from pg_policies where schemaname='public' and tablename='pricing_ledger' order by cmd;`
    );
    const commands = rows.map((r) => String(r.cmd));
    expect(commands).toContain('SELECT');
    expect(commands).toContain('INSERT');
    expect(commands).not.toContain('UPDATE');
    expect(commands).not.toContain('DELETE');
  }, 30000);

  it('keeps the trigger attached to the table', async () => {
    const { rows } = await sql(
      `select tgname, tgenabled from pg_trigger
       where tgrelid = 'public.pricing_ledger'::regclass and not tgisinternal;`
    );
    const names = rows.map((r) => String(r.tgname));
    expect(names).toContain('pricing_ledger_append_only');
    // 'O' = enabled for origin (the normal state). A disabled trigger would be
    // 'D', and would be a silently broken guarantee.
    expect(rows.map((r) => String(r.tgenabled))).toContain('O');
  }, 30000);

  it('refuses an UPDATE to price_book_versions too, so an old quote cannot be repriced', async () => {
    const probe = await sql(`
do $proof$
declare v_item uuid; v_id uuid; upd text;
begin
  select id into v_item from price_book_items limit 1;
  if v_item is null then raise exception 'PRICE_BOOK_PROOF no_items'; end if;

  insert into price_book_versions (item_id, sheet_cost_cents, effective_from, note)
  values (v_item, 111, date '1990-01-01', 'append-only probe (rolled back)')
  returning id into v_id;

  begin
    update price_book_versions set sheet_cost_cents = 999 where id = v_id;
    upd := 'NOT_BLOCKED';
  exception when others then upd := 'BLOCKED:' || SQLSTATE;
  end;

  raise exception 'PRICE_BOOK_PROOF update=%', upd;
end
$proof$;`);
    expect(probe.ok).toBe(false);
    expect(probe.error).toContain('PRICE_BOOK_PROOF update=BLOCKED:42501');
  }, 30000);
});

/**
 * The pure half: the test tag that decides which rows a test is allowed to
 * clean up, and the CSV export.
 */
describe('ledgerTestTag', () => {
  it('returns null for every ordinary job name — real history is never tagged', () => {
    expect(ledgerTestTag('Baylor Scott & White coping')).toBeNull();
    expect(ledgerTestTag('')).toBeNull();
    expect(ledgerTestTag(null)).toBeNull();
    expect(ledgerTestTag(undefined)).toBeNull();
    // Near misses must not tag either.
    expect(ledgerTestTag('e2e-test-lowercase')).toBeNull();
    expect(ledgerTestTag('MY E2E-TEST-JOB')).toBeNull();
  });

  it('tags only a job whose name starts with the reserved prefix', () => {
    expect(ledgerTestTag(`${LEDGER_TEST_TAG_PREFIX}V2-03 line one`)).toBe(`${LEDGER_TEST_TAG_PREFIX}V2-03`);
    expect(ledgerTestTag(`  ${LEDGER_TEST_TAG_PREFIX}V2-03  `)).toBe(`${LEDGER_TEST_TAG_PREFIX}V2-03`);
  });
});

describe('toLedgerRow', () => {
  it('defaults source to admin_ui and test_tag to null', () => {
    const row = toLedgerRow({ eventType: 'quote_issued' });
    expect(row.source).toBe('admin_ui');
    expect(row.test_tag).toBeNull();
    expect(row.event_type).toBe('quote_issued');
  });

  it('carries every priced fact through under its snake_case name', () => {
    const row = toLedgerRow({
      eventType: 'quote_issued',
      material: 'Copper',
      gauge: '16 oz',
      blankWidthIn: 13.5,
      bendCount: 3,
      hemCount: 2,
      lengthFt: 10,
      quantity: 12,
      isRush: true,
      amountCents: 123456,
      revision: 2,
      priceBookVersionIds: ['a', 'b'],
    });
    expect(row.blank_width_in).toBe(13.5);
    expect(row.bend_count).toBe(3);
    expect(row.hem_count).toBe(2);
    expect(row.is_rush).toBe(true);
    expect(row.amount_cents).toBe(123456);
    expect(row.revision).toBe(2);
    expect(row.price_book_version_ids).toEqual(['a', 'b']);
  });
});

describe('ledgerToCsv', () => {
  it('writes a header row even when there is nothing to export', () => {
    const csv = ledgerToCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
    expect(csv).toContain('When,What happened');
    expect(csv).toContain('Price book version(s)');
    expect(LEDGER_CSV_COLUMNS.length).toBeGreaterThan(20);
  });

  it('quotes commas, quotes and newlines instead of breaking the row', () => {
    const csv = ledgerToCsv([{ note: 'Steel up 12%, effective "Oct 1"\nconfirmed' }]);
    expect(csv).toContain('"Steel up 12%, effective ""Oct 1""\nconfirmed"');
  });

  it('neutralises a leading = so a note cannot become a spreadsheet formula', () => {
    const csv = ledgerToCsv([{ note: '=1+1' }]);
    expect(csv).toContain("'=1+1");
  });

  it('renders a boolean as yes/no and an object as JSON', () => {
    const csv = ledgerToCsv([{ is_rush: true, prices_used: { sheetCostCents: 24000 } }]);
    expect(csv).toContain('yes');
    expect(csv).toContain('sheetCostCents');
  });
});
