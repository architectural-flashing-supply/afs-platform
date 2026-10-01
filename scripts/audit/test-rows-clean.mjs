#!/usr/bin/env node
/**
 * PROVES THE E2E SUITE LEFT NOTHING BEHIND.
 *
 *   node scripts/audit/test-rows-clean.mjs
 *
 * Exits 0 when every table the suite writes to holds zero test rows, 1 when any
 * does not — and prints the real count per table either way, so "clean" is a
 * query result rather than an assurance.
 *
 * WHAT COUNTS AS A TEST ROW. Three things, and all three are conventions this
 * codebase already enforces elsewhere rather than invented here:
 *
 *   - the reserved `E2E-TEST-` job-name prefix (CLAUDE.md rule #20), which is
 *     also what captures outbound email and what makes a pricing-ledger row
 *     deletable;
 *   - `pricing_ledger.test_tag`, written by exactly one function and excluded
 *     from the `pricing_ledger_real` view and the CSV export;
 *   - anything owned by the E2E test account.
 *
 * It reads through the same Supabase Management API SQL channel the E2E helpers
 * and the migration procedure use (tests/e2e/helpers/db.ts), so it needs no new
 * credential and adds no route to the deployed app.
 */

import fs from 'node:fs';
import path from 'node:path';

function env(key) {
  if (process.env[key]) return process.env[key];
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return null;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 1 || line.trim().startsWith('#')) continue;
    if (line.slice(0, i).trim() === key) return line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const token = env('SUPABASE_ACCESS_TOKEN');
const url = env('NEXT_PUBLIC_SUPABASE_URL');
if (!token || !url) {
  console.error('SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL not set — cannot verify, and refusing to report clean.');
  process.exit(1);
}
const ref = new URL(url).hostname.split('.')[0];

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${body}`);
  return JSON.parse(body);
}

/**
 * One row per thing that must be zero. The `why` column is printed, so the
 * report says what each number means rather than just that it is 0.
 */
const CHECKS = [
  ['quote_requests', "job_name like 'E2E-TEST-%'", 'Jobs created by the Workbench, quote, delivery and approval specs'],
  // quotes has no job_name; it reaches the test job through request_id.
  ['quotes', "quote_number like 'E2E-TEST-%' or request_id in (select id from public.quote_requests where job_name like 'E2E-TEST-%')", 'Quotes issued from a test job'],
  ['invoices', "invoice_number like 'E2E-TEST-%'", 'Invoices created from a test quote'],
  ['outbound_emails', "subject like '%E2E-TEST-%'", 'Captured test-mode messages'],
  ['pricing_ledger', 'test_tag is not null', 'Tagged ledger rows — the only ones the trigger lets you delete'],
  ['shop_profile_library', "profile_name like 'E2E-TEST-%'", 'Shop send history written by a test'],
  // machine_jobs has no job_name either: profile_name is its own label, and
  // quote_request_id is how it points back at the Job.
  ['machine_jobs', "profile_name like 'E2E-TEST-%' or quote_request_id in (select id from public.quote_requests where job_name like 'E2E-TEST-%')", 'Machine-side records for a test job'],
  ['deliveries', "notify_note like '%E2E-TEST-%'", 'Deliveries auto-scheduled by a test finish'],
  ['saved_configurations', "name like 'E2E-TEST-%' or name like 'Profile-20%'", 'Passport rows, including auto-saves from the Search specs'],
  ['admin_recent_profiles', '1=1', 'Per-admin Search shortcuts — expected to be empty on a clean alpha'],
  ['admin_pinned_profiles', '1=1', 'Per-admin Search shortcuts'],
];

/** Tables that are allowed to be non-empty — reported, never failed on. */
const INFORMATIONAL = new Set(['admin_recent_profiles', 'admin_pinned_profiles']);

const results = [];
let failed = 0;

for (const [table, predicate, why] of CHECKS) {
  let count = null;
  let note = '';
  try {
    const rows = await sql(`select count(*)::int as n from public.${table} where ${predicate};`);
    count = rows[0]?.n ?? 0;
  } catch (err) {
    note = ` (${String(err.message).slice(0, 120)})`;
  }
  const informational = INFORMATIONAL.has(table);
  // A query that FAILED must never print as "ok": not being able to check is not
  // the same as being clean. Same rule the single-door guard follows when it
  // cannot verify an approval — an unverifiable answer is not a good one.
  const bad = count === null || (count > 0 && !informational);
  if (bad) failed++;
  results.push({ table, predicate, why, count, note, informational, bad });
}

// Also name the E2E account's own holdings, which is the check that does not
// depend on anyone having remembered the prefix.
const E2E_EMAIL = 'e2e-forge@architecturalflashingsupply.com';
let ownedRows = [];
try {
  ownedRows = await sql(`
    select 'quote_requests' as t, count(*)::int as n from public.quote_requests qr
      join public.profiles p on p.id = qr.user_id where p.email = '${E2E_EMAIL}'
    union all
    select 'saved_configurations', count(*)::int from public.saved_configurations sc
      join public.profiles p on p.id = sc.user_id where p.email = '${E2E_EMAIL}'
    union all
    select 'takeoff_uploads', count(*)::int from public.takeoff_uploads tu
      join public.profiles p on p.id = tu.user_id where p.email = '${E2E_EMAIL}'
    union all
    select 'notifications', count(*)::int from public.notifications n
      join public.profiles p on p.id = n.user_id where p.email = '${E2E_EMAIL}';
  `);
} catch (err) {
  ownedRows = [{ t: 'owned-by-e2e-account', n: null, err: String(err.message).slice(0, 160) }];
}

console.log('LEFTOVER TEST ROWS — queried live, not assumed');
console.log(`Project: ${ref}`);
console.log('');
console.log('| table                  | rows | what it would mean');
console.log('|------------------------|------|--------------------');
for (const r of results) {
  const flag = r.count === null ? 'ERR ' : r.bad ? 'FAIL' : r.informational ? ' -- ' : ' ok ';
  console.log(`| ${r.table.padEnd(22)} | ${String(r.count ?? '?').padStart(4)} | ${flag} ${r.why}${r.note}`);
}
console.log('');
console.log(`Rows owned by ${E2E_EMAIL}:`);
for (const r of ownedRows) console.log(`  ${String(r.t).padEnd(22)} ${r.n ?? '?'}${r.err ? ` (${r.err})` : ''}`);
for (const r of ownedRows) if (typeof r.n === 'number' && r.n > 0) failed++;

console.log('');
console.log(failed === 0 ? 'CLEAN — no leftover test rows.' : `NOT CLEAN — ${failed} check(s) found rows.`);
process.exit(failed === 0 ? 0 : 1);
