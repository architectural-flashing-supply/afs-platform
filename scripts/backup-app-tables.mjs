/**
 * backup-app-tables.mjs — full logical backup of every application table.
 *
 * WHY NOT pg_dump: this Supabase project's direct database host
 * (db.<ref>.supabase.co) resolves to IPv6 only and is unreachable from the
 * dev machine, and the pooler (aws-0-us-east-1.pooler.supabase.com) rejects
 * the DB password recorded in "AFS CREDENTIALS.txt". So this script is the
 * documented equivalent: it reads every row of every table in the `public`
 * schema through the Supabase Management API SQL endpoint — the same channel
 * the project's migration procedure uses — and writes, per table:
 *
 *   <table>.json  full-fidelity rows as a JSON array (to_jsonb per row)
 *   <table>.sql   a restore statement built on jsonb_populate_recordset,
 *                 which reconstructs the rows without hand-written casts
 *
 * plus schema.json (columns, constraints, indexes, RLS policies) and
 * MANIFEST.json (row count + byte size per file).
 *
 * Usage:  node scripts/backup-app-tables.mjs <outputDir>
 *
 * Reads SUPABASE_ACCESS_TOKEN from .env.local. Read-only against the database.
 */

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_REF = 'lxfiziwsqezjjybeguqq';
const PAGE_SIZE = 1000;

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/backup-app-tables.mjs <outputDir>');
  process.exit(1);
}

function loadToken() {
  const envPath = path.join(process.cwd(), '.env.local');
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('SUPABASE_ACCESS_TOKEN='));
  if (!line) throw new Error('SUPABASE_ACCESS_TOKEN missing from .env.local');
  return line.slice('SUPABASE_ACCESS_TOKEN='.length).replace(/^"|"$/g, '').trim();
}

const TOKEN = loadToken();

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    throw new Error(`SQL failed (${res.status}): ${await res.text()}\n${query.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * The Management API SQL endpoint rejects request bodies over roughly 1 MB, so
 * a restore has to arrive as several statements rather than one. Chunk on
 * serialised size, not row count — one `shop_profile_library` row carries a
 * base64 thumbnail and is bigger than a thousand `gauges` rows.
 */
const CHUNK_BYTES = 400_000;

function chunkRows(rows) {
  const chunks = [];
  let current = [];
  let size = 0;
  for (const row of rows) {
    const rowSize = JSON.stringify(row).length + 1;
    if (current.length > 0 && size + rowSize > CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += rowSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function buildRestoreSql(table, rows) {
  if (rows.length === 0) return `-- public.${table}: 0 rows, nothing to restore\n`;
  const chunks = chunkRows(rows);
  const header =
    `-- restore public.${table} — ${rows.length} rows in ${chunks.length} statement(s).\n` +
    `-- Each statement is independently under the Management API body limit.\n`;
  return (
    header +
    chunks
      .map(
        (chunk, i) =>
          `-- chunk ${i + 1}/${chunks.length} (${chunk.length} rows)\n` +
          `INSERT INTO public."${table}"\n` +
          `SELECT * FROM jsonb_populate_recordset(null::public."${table}", ` +
          `$afsdump$${JSON.stringify(chunk)}$afsdump$::jsonb);\n`
      )
      .join('\n')
  );
}

fs.mkdirSync(outDir, { recursive: true });

const tables = (
  await sql(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name;`
  )
).map((r) => r.table_name);

console.log(`Backing up ${tables.length} tables from public schema -> ${outDir}\n`);

const manifest = [];

for (const table of tables) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    // ctid ordering is stable for a table nobody is writing to, and needs no
    // assumption about a primary key existing or being sortable.
    const page = await sql(
      `select to_jsonb(t) as r from public."${table}" t
       order by t.ctid limit ${PAGE_SIZE} offset ${offset};`
    );
    rows.push(...page.map((p) => p.r));
    if (page.length < PAGE_SIZE) break;
  }

  const jsonPath = path.join(outDir, `${table}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');

  const sqlPath = path.join(outDir, `${table}.sql`);
  fs.writeFileSync(sqlPath, buildRestoreSql(table, rows), 'utf8');

  manifest.push({
    table,
    rows: rows.length,
    json_bytes: fs.statSync(jsonPath).size,
    sql_bytes: fs.statSync(sqlPath).size,
  });
  console.log(
    `${table.padEnd(32)} ${String(rows.length).padStart(6)} rows  ` +
      `${String(fs.statSync(jsonPath).size).padStart(10)} B json`
  );
}

const schema = {
  columns: await sql(
    `select table_name, column_name, data_type, is_nullable, column_default
     from information_schema.columns where table_schema='public'
     order by table_name, ordinal_position;`
  ),
  constraints: await sql(
    `select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
     from pg_constraint where connamespace = 'public'::regnamespace
     order by 1, 2;`
  ),
  indexes: await sql(
    `select tablename, indexname, indexdef from pg_indexes
     where schemaname='public' order by tablename, indexname;`
  ),
  policies: await sql(
    `select tablename, policyname, cmd, qual, with_check from pg_policies
     where schemaname='public' order by tablename, policyname;`
  ),
};
fs.writeFileSync(path.join(outDir, 'schema.json'), JSON.stringify(schema, null, 2), 'utf8');

fs.writeFileSync(
  path.join(outDir, 'MANIFEST.json'),
  JSON.stringify(
    {
      project_ref: PROJECT_REF,
      taken_at: new Date().toISOString(),
      method: 'Supabase Management API SQL endpoint (pg_dump unreachable — see header)',
      table_count: tables.length,
      total_rows: manifest.reduce((a, b) => a + b.rows, 0),
      tables: manifest,
    },
    null,
    2
  ),
  'utf8'
);

const zero = manifest.filter((m) => m.json_bytes === 0 || m.sql_bytes === 0);
console.log(
  `\nDone. ${tables.length} tables, ${manifest.reduce((a, b) => a + b.rows, 0)} rows total.`
);
if (zero.length) {
  console.error(`FAIL: zero-byte dump files for: ${zero.map((z) => z.table).join(', ')}`);
  process.exit(1);
}
console.log('No zero-byte dump files.');
