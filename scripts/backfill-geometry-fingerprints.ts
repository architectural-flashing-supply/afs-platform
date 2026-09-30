/**
 * Backfills saved_configurations.geometry_fingerprint (Part 2, 2026-09-30).
 *
 * Uses the SAME lib/flashdraft/geometry-fingerprint.ts the client uses at
 * save time, so a backfilled row and a freshly-saved one can never disagree.
 * Idempotent: only touches rows whose fingerprint is NULL. profile_type is
 * deliberately left NULL — the template a legacy row started from is not
 * recorded anywhere, and guessing it is forbidden.
 *
 * Goes through the Supabase Management API SQL endpoint rather than
 * supabase-js: this repo runs on Node 20, and supabase-js 2.110 requires a
 * native WebSocket (Node 22+) even for plain REST use.
 *
 * Run: npx tsx scripts/backfill-geometry-fingerprints.ts
 */
import fs from 'node:fs';
import { geometryFingerprint } from '../lib/flashdraft/geometry-fingerprint';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
) as Record<string, string>;

const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];

async function sql<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T[];
}

async function main() {
  // Explicit column list, no thumbnail_image — a bulk read of that base64
  // column would dominate egress (CLAUDE.md egress rule).
  const rows = await sql<{ id: string; dimensions: { points?: unknown; hemStart?: unknown; hemEnd?: unknown } | null }>(
    `select id, dimensions from saved_configurations where geometry_fingerprint is null;`
  );
  console.log(`rows without a fingerprint: ${rows.length}`);

  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    const points = Array.isArray(row.dimensions?.points) ? row.dimensions!.points : null;
    if (!points) { skipped++; continue; }
    const fp = geometryFingerprint({
      points: points as { x: number; y: number }[],
      hemStart: (row.dimensions?.hemStart ?? null) as never,
      hemEnd: (row.dimensions?.hemEnd ?? null) as never,
    });
    if (!fp) { skipped++; continue; }
    // fp is 16 hex chars from our own hash — no injection surface, but keep
    // the guard explicit rather than relying on that.
    if (!/^[0-9a-f]{16}$/.test(fp)) { skipped++; continue; }
    await sql(`update saved_configurations set geometry_fingerprint = '${fp}' where id = '${row.id}' and geometry_fingerprint is null;`);
    written++;
  }
  console.log(`fingerprints written: ${written}, skipped (no usable geometry): ${skipped}`);

  const groups = await sql<{ geometry_fingerprint: string; n: number }>(
    `select geometry_fingerprint, count(*)::int n from saved_configurations
      where geometry_fingerprint is not null group by 1 order by n desc;`
  );
  console.log(`distinct shapes: ${groups.length}; shapes shared by >1 profile: ${groups.filter((g) => g.n > 1).length}`);
  groups.filter((g) => g.n > 1).forEach((g) => console.log(`  ${g.geometry_fingerprint} x${g.n}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
