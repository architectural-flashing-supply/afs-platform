/**
 * Corrective seed for the `gauges` table.
 *
 * Background (see STATE_OF_THE_BUILD.md "OVERALL STATUS" — Database
 * migration line): supabase/migrations/002_seed_afs_data.sql seeds
 * `materials` (9 rows, confirmed live) and `product_profiles` (12 rows,
 * confirmed live) correctly, but its 9 `INSERT INTO gauges (...) SELECT
 * id, ... FROM materials WHERE slug = '...'` statements (one per material,
 * 27 gauge rows total across the 9 statements — this file's own prior
 * documentation said "8 INSERT INTO gauges statements", which a direct
 * grep of the migration file found to be off by one; there are 9, matching
 * the 9 seeded materials) produced 0 live rows in `gauges`.
 *
 * Static comparison of 002_seed_afs_data.sql's column lists against
 * SCHEMA.md's `CREATE TABLE materials` / `CREATE TABLE gauges` found no
 * column-name or type mismatch — every column referenced in both INSERT
 * statements (name/slug/alloy_grade/category/commodity_key/
 * density_lbs_per_cubic_in/is_active/sort_order for materials;
 * material_id/label/thickness_inches/weight_lbs_sqft/is_active/sort_order
 * for gauges) exists with a compatible type on the documented live schema,
 * and every gauge block's `WHERE slug = '...'` value exactly matches one of
 * the 9 slugs the same file inserts into `materials`. A live query to
 * confirm this against the real database directly (rather than against
 * SCHEMA.md's documentation of it) was attempted this session via several
 * independent channels — pnpm/npx/node script execution, the connected
 * Supabase MCP tools, and a raw curl request against the project's REST
 * API — and every one of them was blocked by this session's tool-approval
 * gate with no interactive channel available to grant it (the same
 * recurring blocker logged repeatedly elsewhere in this project's
 * SESSION_STATE.md, e.g. afs-023 through afs-025). So the exact original
 * failure mode (e.g. the gauges statements simply never being pasted into
 * the SQL Editor when 001-003 were applied, vs. some statement erroring
 * and being silently skipped) is NOT independently confirmed here.
 *
 * Rather than re-deriving material_id via the same SELECT-by-slug pattern
 * and hoping it works this time, this script queries `materials` live by
 * slug at run time (via the same admin-client pattern as every other
 * script in this directory) and reports exactly which of the 9 slugs
 * resolve to a real row — which either confirms or refutes the "failed
 * material_id lookup" hypothesis the moment a human actually runs it,
 * instead of asserting it as fact. Any slug that doesn't resolve is
 * skipped with a clear warning rather than inserting a broken row.
 *
 * Idempotent: `gauges` has no UNIQUE constraint beyond its own `id`
 * (SCHEMA.md), so this script checks each material's existing gauge
 * labels before inserting and only inserts genuinely missing rows — safe
 * to re-run after a partial success.
 *
 * Run: pnpm fix:gauges-seed
 */

import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

// Same rationale as the other scripts in this directory: supabase-js always
// constructs a Realtime client, which requires a global WebSocket
// implementation this script's target Node version doesn't provide natively.
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

loadEnvLocal();

interface GaugeSeed {
  label: string;
  thicknessInches: number;
  weightLbsSqft: number;
  sortOrder: number;
}

// Exact values from supabase/migrations/002_seed_afs_data.sql's 9
// `INSERT INTO gauges` blocks — copied, not re-derived, so this script
// seeds the same data the migration always intended.
const GAUGES_BY_SLUG: Record<string, GaugeSeed[]> = {
  'galvanized-steel': [
    { label: '26 GA', thicknessInches: 0.0179, weightLbsSqft: 0.731, sortOrder: 10 },
    { label: '24 GA', thicknessInches: 0.0239, weightLbsSqft: 0.976, sortOrder: 20 },
    { label: '22 GA', thicknessInches: 0.0296, weightLbsSqft: 1.2094, sortOrder: 30 },
    { label: '20 GA', thicknessInches: 0.0359, weightLbsSqft: 1.4661, sortOrder: 40 },
  ],
  'galvalume-steel': [
    { label: '26 GA', thicknessInches: 0.0179, weightLbsSqft: 0.731, sortOrder: 10 },
    { label: '24 GA', thicknessInches: 0.0239, weightLbsSqft: 0.976, sortOrder: 20 },
    { label: '22 GA', thicknessInches: 0.0296, weightLbsSqft: 1.2094, sortOrder: 30 },
  ],
  copper: [
    { label: '16 oz', thicknessInches: 0.0216, weightLbsSqft: 1.0047, sortOrder: 10 },
    { label: '20 oz', thicknessInches: 0.027, weightLbsSqft: 1.2558, sortOrder: 20 },
    { label: '24 oz', thicknessInches: 0.0324, weightLbsSqft: 1.507, sortOrder: 30 },
    { label: '32 oz', thicknessInches: 0.0432, weightLbsSqft: 2.0093, sortOrder: 40 },
  ],
  'lead-coated-copper': [
    { label: '16 oz LCC', thicknessInches: 0.0216, weightLbsSqft: 1.0047, sortOrder: 10 },
    { label: '20 oz LCC', thicknessInches: 0.027, weightLbsSqft: 1.2558, sortOrder: 20 },
  ],
  'anodized-aluminum': [
    { label: '.032"', thicknessInches: 0.032, weightLbsSqft: 0.4493, sortOrder: 10 },
    { label: '.040"', thicknessInches: 0.04, weightLbsSqft: 0.5616, sortOrder: 20 },
    { label: '.050"', thicknessInches: 0.05, weightLbsSqft: 0.702, sortOrder: 30 },
    { label: '.063"', thicknessInches: 0.063, weightLbsSqft: 0.8845, sortOrder: 40 },
  ],
  'stainless-steel': [
    { label: '26 GA', thicknessInches: 0.0187, weightLbsSqft: 0.7712, sortOrder: 10 },
    { label: '24 GA', thicknessInches: 0.025, weightLbsSqft: 1.031, sortOrder: 20 },
    { label: '22 GA', thicknessInches: 0.0312, weightLbsSqft: 1.2867, sortOrder: 30 },
  ],
  zinc: [
    { label: '0.7mm', thicknessInches: 0.0276, weightLbsSqft: 1.0214, sortOrder: 10 },
    { label: '0.8mm', thicknessInches: 0.0315, weightLbsSqft: 1.1658, sortOrder: 20 },
    { label: '1.0mm', thicknessInches: 0.0394, weightLbsSqft: 1.4581, sortOrder: 30 },
  ],
  'kynar-500-painted-steel': [
    { label: '26 GA', thicknessInches: 0.0179, weightLbsSqft: 0.731, sortOrder: 10 },
    { label: '24 GA', thicknessInches: 0.0239, weightLbsSqft: 0.976, sortOrder: 20 },
  ],
  'vintage-steel': [
    { label: '26 GA', thicknessInches: 0.0179, weightLbsSqft: 0.731, sortOrder: 10 },
    { label: '24 GA', thicknessInches: 0.0239, weightLbsSqft: 0.976, sortOrder: 20 },
  ],
};

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

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or environment).');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const slugs = Object.keys(GAUGES_BY_SLUG);
  console.log(`Checking ${slugs.length} materials for missing gauge rows...`);

  let materialsResolved = 0;
  let materialsMissing = 0;
  let gaugesInserted = 0;
  let gaugesSkippedExisting = 0;
  const detail: string[] = [];

  for (const slug of slugs) {
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle();

    if (materialError) {
      detail.push(`  [${slug}] materials lookup failed: ${materialError.message}`);
      continue;
    }

    if (!material) {
      // This is the live confirmation (or refutation) of the "failed
      // material_id lookup" hypothesis from STATE_OF_THE_BUILD.md — a
      // slug the migration's own materials INSERT should have created is
      // genuinely absent from the live table.
      materialsMissing++;
      detail.push(`  [${slug}] NOT FOUND in materials — skipped all its gauges`);
      continue;
    }

    materialsResolved++;

    const { data: existingGauges, error: existingError } = await supabase
      .from('gauges')
      .select('label')
      .eq('material_id', material.id);

    if (existingError) {
      detail.push(`  [${slug}] existing-gauges lookup failed: ${existingError.message}`);
      continue;
    }

    const existingLabels = new Set((existingGauges ?? []).map((g) => g.label));
    const toInsert = GAUGES_BY_SLUG[slug]
      .filter((g) => !existingLabels.has(g.label))
      .map((g) => ({
        material_id: material.id,
        label: g.label,
        thickness_inches: g.thicknessInches,
        weight_lbs_sqft: g.weightLbsSqft,
        is_active: true,
        sort_order: g.sortOrder,
      }));

    if (toInsert.length === 0) {
      gaugesSkippedExisting += GAUGES_BY_SLUG[slug].length;
      detail.push(`  [${slug}] "${material.name}" — all ${GAUGES_BY_SLUG[slug].length} gauges already present, skipped`);
      continue;
    }

    const { error: insertError } = await supabase.from('gauges').insert(toInsert);
    if (insertError) {
      detail.push(`  [${slug}] "${material.name}" — insert of ${toInsert.length} gauge(s) failed: ${insertError.message}`);
      continue;
    }

    gaugesInserted += toInsert.length;
    const skippedForThisMaterial = GAUGES_BY_SLUG[slug].length - toInsert.length;
    gaugesSkippedExisting += skippedForThisMaterial;
    detail.push(
      `  [${slug}] "${material.name}" — inserted ${toInsert.length} gauge(s)` +
        (skippedForThisMaterial > 0 ? `, skipped ${skippedForThisMaterial} already present` : '')
    );
  }

  console.log('\n=== Gauges Seed Fix Summary ===');
  console.log(`Materials resolved live:      ${materialsResolved} / ${slugs.length}`);
  console.log(`Materials NOT found live:     ${materialsMissing}`);
  console.log(`Gauge rows inserted:          ${gaugesInserted}`);
  console.log(`Gauge rows already present:   ${gaugesSkippedExisting}`);
  console.log('\nDetail:');
  detail.forEach((line) => console.log(line));

  if (materialsMissing > 0) {
    console.log(
      '\nWARNING: one or more expected material slugs were not found in the live ' +
        '`materials` table. Re-check supabase/migrations/002_seed_afs_data.sql\'s ' +
        'materials INSERT was actually applied before re-running this script.'
    );
  }
}

main().catch((err) => {
  console.error('Gauges seed fix failed:', err);
  process.exit(1);
});
