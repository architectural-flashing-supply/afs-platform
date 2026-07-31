/**
 * Direct live-database verification for migrations 007-010.
 *
 * STATE_OF_THE_BUILD.md's own history (see its "Database migration" line,
 * corrected afs-041) shows repeated confusion about migration-apply status
 * across this project — several past sessions asserted "not applied"
 * without ever directly querying the live database, and were later
 * corrected by a session that actually did. This script does not repeat
 * that pattern: every finding below comes from a live call against the
 * real Supabase project (same service-role client pattern as
 * scripts/fix-gauges-seed.ts / scripts/fix-profile-names.ts), not from
 * reading the migration files or any prior doc.
 *
 * Method, and its real limits (stated up front rather than glossed over):
 *   - Table existence: SELECT ... LIMIT 1 against the table. PostgREST
 *     returns a distinct "table not found in schema cache" error
 *     (code PGRST205) when a table genuinely doesn't exist in the exposed
 *     schema — reliable signal, this is a real network round-trip against
 *     the live project, not a guess.
 *   - Column existence: SELECT of that one column against a table already
 *     known to exist. PostgREST returns code 42703 (undefined column) when
 *     the column is missing — same reliability as above.
 *   - Function (RPC) existence: supabase.rpc() with harmless/read-only
 *     arguments (a random UUID, a bogus token — none of these mutate any
 *     row). PostgREST returns PGRST202 when the function doesn't exist.
 *   - CHECK constraint *content* (e.g. whether orders.status's constraint
 *     was actually widened to allow 'out_for_delivery', or profiles.role
 *     to allow 'operator') is NOT directly introspectable through
 *     PostgREST with this project's service-role client — pg_constraint /
 *     information_schema aren't exposed over the REST API, and this
 *     project has no exec-arbitrary-SQL RPC defined (checked: grepped
 *     supabase/migrations for one, found none). This script reports what
 *     it CAN determine live for those two constraints (whether any
 *     existing row already uses one of the new values, which is a real,
 *     positive live signal if found) and explicitly flags what it cannot
 *     determine, rather than inferring the constraint definition from the
 *     migration file text.
 *
 * Run: npx tsx scripts/check-migrations-007-010.ts
 */

import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

loadEnvLocal();

function loadEnvLocal(): void {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not found — assume env vars are already set (e.g. CI)
  }
}

type Result = { name: string; exists: boolean; detail: string };

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or environment).');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const tableResults: Result[] = [];
  const columnResults: Result[] = [];
  const functionResults: Result[] = [];
  const signalResults: Result[] = [];

  async function checkTable(table: string): Promise<{ exists: boolean; rowCount: number | null }> {
    const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      const missing = error.code === 'PGRST205' || /schema cache/i.test(error.message) || error.code === '42P01';
      tableResults.push({
        name: table,
        exists: false,
        detail: missing ? `NOT FOUND live (${error.code}: ${error.message})` : `ERROR checking (${error.code}: ${error.message})`,
      });
      return { exists: false, rowCount: null };
    }
    tableResults.push({ name: table, exists: true, detail: `EXISTS live, row count = ${count}` });
    return { exists: true, rowCount: count ?? null };
  }

  async function checkColumn(table: string, column: string): Promise<boolean> {
    const { error } = await supabase.from(table).select(column).limit(1);
    if (error) {
      const missing = error.code === '42703' || /column .* does not exist/i.test(error.message);
      columnResults.push({
        name: `${table}.${column}`,
        exists: false,
        detail: missing ? `NOT FOUND live (${error.code}: ${error.message})` : `ERROR checking (${error.code}: ${error.message})`,
      });
      return false;
    }
    columnResults.push({ name: `${table}.${column}`, exists: true, detail: 'EXISTS live' });
    return true;
  }

  async function checkFunction(fn: string, args: Record<string, unknown>): Promise<boolean> {
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      const missing = error.code === 'PGRST202' || /function .* does not exist/i.test(error.message);
      functionResults.push({
        name: fn,
        exists: false,
        detail: missing ? `NOT FOUND live (${error.code}: ${error.message})` : `ERROR calling (${error.code}: ${error.message})`,
      });
      return false;
    }
    functionResults.push({ name: fn, exists: true, detail: 'EXISTS live (RPC call succeeded)' });
    return true;
  }

  console.log('=== Migration 007_delivery_tracking.sql ===');
  await checkTable('driver_locations');
  await checkTable('delivery_notifications');
  await checkTable('gbp_photo_queue');
  for (const col of ['packaged_at', 'dispatched_at', 'delivered_at', 'assigned_driver_id', 'tracking_token']) {
    await checkColumn('orders', col);
  }
  await checkFunction('get_tracking_data', { p_tracking_token: '00000000-0000-0000-0000-000000000000-live-check' });
  await checkFunction('is_operator', {});
  await checkFunction('is_order_out_for_delivery', { p_order_id: '00000000-0000-0000-0000-000000000000' });

  // Live positive-signal check for the two widened CHECK constraints (see
  // header comment — this cannot prove absence, only confirm presence).
  {
    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .in('status', ['packaged', 'out_for_delivery', 'in_production'])
      .limit(5);
    if (error) {
      signalResults.push({
        name: 'orders.status widened CHECK (packaged/out_for_delivery/in_production)',
        exists: false,
        detail: `Could not check live rows (${error.code}: ${error.message})`,
      });
    } else {
      signalResults.push({
        name: 'orders.status widened CHECK (packaged/out_for_delivery/in_production)',
        exists: (data?.length ?? 0) > 0,
        detail:
          (data?.length ?? 0) > 0
            ? `${data!.length} live order row(s) already use one of the new status values — CHECK constraint is confirmed widened live.`
            : 'No live order currently uses one of the new status values. This does NOT prove the constraint was not widened — only that no row happens to use these values yet. Constraint content is not directly introspectable via this service-role REST client (see header comment).',
      });
    }
  }
  {
    const { data, error } = await supabase.from('profiles').select('role').eq('role', 'operator').limit(5);
    if (error) {
      signalResults.push({
        name: "profiles.role widened CHECK ('operator')",
        exists: false,
        detail: `Could not check live rows (${error.code}: ${error.message})`,
      });
    } else {
      signalResults.push({
        name: "profiles.role widened CHECK ('operator')",
        exists: (data?.length ?? 0) > 0,
        detail:
          (data?.length ?? 0) > 0
            ? `${data!.length} live profile row(s) already have role = 'operator' — CHECK constraint is confirmed widened live.`
            : "No live profile currently has role = 'operator'. This does NOT prove the constraint was not widened — only that no row happens to use this value yet. Constraint content is not directly introspectable via this service-role REST client (see header comment).",
      });
    }
  }

  console.log('=== Migration 008_order_geocoding.sql ===');
  await checkColumn('orders', 'geocoded_lat');
  await checkColumn('orders', 'geocoded_lng');

  console.log('=== Migration 009_command_center_crm.sql ===');
  await checkColumn('profiles', 'internal_notes');
  await checkColumn('orders', 'invoice_paid_at');

  console.log('=== Migration 010_bid_monitor.sql ===');
  const bidSources = await checkTable('bid_sources');
  const bidProjects = await checkTable('bid_projects');
  const bidKeywords = await checkTable('bid_keywords');
  const bidAlerts = await checkTable('bid_alerts');
  if (bidKeywords.exists) {
    signalResults.push({
      name: 'bid_keywords seed row count (migration inserts 30)',
      exists: bidKeywords.rowCount === 30,
      detail: `Live row count = ${bidKeywords.rowCount} (migration file inserts exactly 30 rows)`,
    });
  }
  if (bidSources.exists) {
    signalResults.push({
      name: 'bid_sources seed row count (migration inserts 81)',
      exists: bidSources.rowCount === 81,
      detail: `Live row count = ${bidSources.rowCount} (migration file inserts exactly 81 rows)`,
    });
  }
  void bidProjects;
  void bidAlerts;

  console.log('\n\n========== SUMMARY ==========\n');
  console.log('-- TABLES --');
  tableResults.forEach((r) => console.log(`  [${r.exists ? 'EXISTS' : 'MISSING'}] ${r.name} — ${r.detail}`));
  console.log('\n-- COLUMNS --');
  columnResults.forEach((r) => console.log(`  [${r.exists ? 'EXISTS' : 'MISSING'}] ${r.name} — ${r.detail}`));
  console.log('\n-- FUNCTIONS (RPC) --');
  functionResults.forEach((r) => console.log(`  [${r.exists ? 'EXISTS' : 'MISSING'}] ${r.name} — ${r.detail}`));
  console.log('\n-- CONSTRAINT LIVE SIGNALS (not conclusive — see detail) --');
  signalResults.forEach((r) => console.log(`  [${r.exists ? 'POSITIVE' : 'NO SIGNAL'}] ${r.name} — ${r.detail}`));

  console.log('\n\n=== JSON (for machine consumption) ===');
  console.log(JSON.stringify({ tableResults, columnResults, functionResults, signalResults }, null, 2));
}

main().catch((err) => {
  console.error('Migration check failed:', err);
  process.exit(1);
});
