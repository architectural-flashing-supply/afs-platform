/**
 * Translates German name_original values in machine_profiles into name_en,
 * plus a couple of visibility/formatting cleanups, per a fixed rule list.
 * Mirrors 16 SQL UPDATE statements as sequential in-order passes (later
 * rules can override name_en set by an earlier rule on the same row, same
 * as running the statements one after another in psql) since supabase-js
 * has no raw SQL execution path available here.
 *
 * Run: pnpm tsx scripts/translate-profile-names.ts
 */

import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

loadEnvLocal();

interface ProfileRow {
  id: string;
  name_original: string;
  name_en: string;
  is_public: boolean;
}

function ilikeContains(value: string, needle: string): boolean {
  return value.toLowerCase().includes(needle.toLowerCase());
}

function ilikeStartsWith(value: string, prefix: string): boolean {
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}

interface Rule {
  label: string;
  match: (row: ProfileRow) => boolean;
  apply: (row: ProfileRow) => Partial<Pick<ProfileRow, 'name_en' | 'is_public'>>;
}

const FORCE_PRIVATE_NAMES = new Set(['Messe', 'Toli', 'Toli1', 'FKT']);

const RULES: Rule[] = [
  {
    label: "name_en = 'Parapet Coping Cap' WHERE name_original ILIKE '%attikakappe%'",
    match: (r) => ilikeContains(r.name_original, 'attikakappe'),
    apply: () => ({ name_en: 'Parapet Coping Cap' }),
  },
  {
    label: "name_en = 'Parapet Coping Holder' WHERE name_original ILIKE '%attikahalter%'",
    match: (r) => ilikeContains(r.name_original, 'attikahalter'),
    apply: () => ({ name_en: 'Parapet Coping Holder' }),
  },
  {
    label:
      "name_en = 'Parapet Cap' WHERE name_original ILIKE '%attika%' AND name_original NOT ILIKE '%kappe%' AND name_original NOT ILIKE '%halter%'",
    match: (r) =>
      ilikeContains(r.name_original, 'attika') &&
      !ilikeContains(r.name_original, 'kappe') &&
      !ilikeContains(r.name_original, 'halter'),
    apply: () => ({ name_en: 'Parapet Cap' }),
  },
  {
    label: "name_en = 'Valley Flashing' WHERE name_original ILIKE '%kehle%'",
    match: (r) => ilikeContains(r.name_original, 'kehle'),
    apply: () => ({ name_en: 'Valley Flashing' }),
  },
  {
    label: "name_en = 'Rake Fascia' WHERE name_original ILIKE '%ortgang%'",
    match: (r) => ilikeContains(r.name_original, 'ortgang'),
    apply: () => ({ name_en: 'Rake Fascia' }),
  },
  {
    label: "name_en = 'Eave Drip Edge' WHERE name_original ILIKE '%traufe%'",
    match: (r) => ilikeContains(r.name_original, 'traufe'),
    apply: () => ({ name_en: 'Eave Drip Edge' }),
  },
  {
    label: "name_en = 'Ridge Cap' WHERE name_original ILIKE '%first%'",
    match: (r) => ilikeContains(r.name_original, 'first'),
    apply: () => ({ name_en: 'Ridge Cap' }),
  },
  {
    label: "name_en = 'Snap Lock Panel' WHERE name_original ILIKE '%steckpaneel%'",
    match: (r) => ilikeContains(r.name_original, 'steckpaneel'),
    apply: () => ({ name_en: 'Snap Lock Panel' }),
  },
  {
    label: "name_en = 'Edge Angle' WHERE name_original ILIKE '%randwinkel%'",
    match: (r) => ilikeContains(r.name_original, 'randwinkel'),
    apply: () => ({ name_en: 'Edge Angle' }),
  },
  {
    label: "name_en = 'Gutter Inlet' WHERE name_original ILIKE '%einlauf%'",
    match: (r) => ilikeContains(r.name_original, 'einlauf'),
    apply: () => ({ name_en: 'Gutter Inlet' }),
  },
  {
    label: "name_en = 'Pent Roof Profile' WHERE name_original ILIKE '%pult%'",
    match: (r) => ilikeContains(r.name_original, 'pult'),
    apply: () => ({ name_en: 'Pent Roof Profile' }),
  },
  {
    label: "name_en = 'Radius Profile' WHERE name_original ILIKE '%rund%'",
    match: (r) => ilikeContains(r.name_original, 'rund'),
    apply: () => ({ name_en: 'Radius Profile' }),
  },
  {
    label: "name_en = 'Trapezoid Profile' WHERE name_original ILIKE '%trapez%'",
    match: (r) => ilikeContains(r.name_original, 'trapez'),
    apply: () => ({ name_en: 'Trapezoid Profile' }),
  },
  {
    label:
      "name_en = REGEXP_REPLACE(name_en, '^Rheinzink-Profile_', 'Profile ') WHERE name_original ILIKE 'rheinzink%'",
    match: (r) => ilikeStartsWith(r.name_original, 'rheinzink'),
    apply: (r) => ({ name_en: r.name_en.replace(/^Rheinzink-Profile_/, 'Profile ') }),
  },
  {
    label: "is_public = false WHERE name_original IN ('Messe', 'Toli', 'Toli1', 'FKT')",
    match: (r) => FORCE_PRIVATE_NAMES.has(r.name_original),
    apply: () => ({ is_public: false }),
  },
  {
    label: "name_en = CONCAT('Standard Profile ', LPAD(name_original, 3, '0')) WHERE name_original ~ '^[0-9]+$'",
    match: (r) => /^[0-9]+$/.test(r.name_original),
    apply: (r) => ({ name_en: `Standard Profile ${r.name_original.padStart(3, '0')}` }),
  },
];

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

  const { data: profiles, error } = await supabase
    .from('machine_profiles')
    .select('id, name_original, name_en, is_public')
    .returns<ProfileRow[]>();
  if (error) throw error;

  // In-memory state, mutated as each rule runs, so a later rule's regexp
  // step sees any name_en change made by an earlier rule this run — same
  // ordering behavior as running the 16 UPDATEs sequentially in psql.
  const state = new Map<string, ProfileRow>();
  for (const row of profiles ?? []) state.set(row.id, { ...row });

  console.log(`Loaded ${state.size} machine_profiles rows.\n`);

  for (const rule of RULES) {
    const matches = Array.from(state.values()).filter(rule.match);
    let updated = 0;

    for (const row of matches) {
      const patch = rule.apply(row);
      const { error: updateError } = await supabase.from('machine_profiles').update(patch).eq('id', row.id);
      if (updateError) {
        console.warn(`  FAILED to update ${row.id} ("${row.name_original}"): ${updateError.message}`);
        continue;
      }
      state.set(row.id, { ...row, ...patch });
      updated++;
    }

    console.log(`${rule.label}`);
    console.log(`  -> ${updated} row(s) updated\n`);
  }
}

main().catch((err) => {
  console.error('Translation run failed:', err);
  process.exit(1);
});
