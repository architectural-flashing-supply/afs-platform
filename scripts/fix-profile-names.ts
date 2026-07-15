/**
 * One-time data-quality fix for machine_profiles.name_en — a live-database
 * audit while building the FlashDraft Profile Library found several
 * is_public = true rows still showing raw German source text (equal to
 * name_original) instead of a translated English name, and a few rows that
 * read as personal nicknames / shorthand rather than generic profile types
 * (Messe, Toli, Toli1, "BUG--master-cuppers") were left is_public = true
 * despite scripts/import-machine-profiles.ts's own stated intent to force
 * exactly those kinds of names private.
 *
 * Every rule below matches against name_original — the untouched German
 * source field — never name_en, which may already be correctly translated
 * for unrelated rows and shouldn't be re-processed. Applies across the
 * FULL machine_profiles table (public and private), not just currently-
 * public rows, since this is a data-quality fix, not a visibility change.
 *
 * Run: pnpm fix:profile-names
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

interface ProfileRow {
  id: string;
  name_original: string;
  name_en: string;
  is_public: boolean;
}

interface ProfileUpdate {
  name_en?: string;
  is_public?: boolean;
}

// Ordered — first match wins among these 8 substring translations
// (case-insensitive, matched against name_original).
const TRANSLATIONS: [string, string][] = [
  ['ortgang', 'Rake Fascia'],
  ['kehle', 'Valley Flashing'],
  ['randwinkel', 'Edge Angle'],
  ['steckpaneel', 'Snap Lock Panel'],
  ['traufe', 'Eave Drip Edge'],
  ['pult', 'Pent Roof Profile'],
  ['rund', 'Radius Profile'],
  ['trapez', 'Trapezoid Profile'],
];

const FORCE_PRIVATE_EXACT = new Set(['messe', 'toli', 'toli1']);

function computeUpdate(row: ProfileRow): ProfileUpdate | null {
  const original = row.name_original ?? '';
  const originalLower = original.toLowerCase().trim();
  const update: ProfileUpdate = {};

  if (originalLower.includes('rheinzink')) {
    const stripped = original.replace(/Rheinzink-Profile_/gi, '').trim();
    update.name_en = stripped ? `Profile ${stripped}` : 'Profile';
  } else {
    const match = TRANSLATIONS.find(([keyword]) => originalLower.includes(keyword));
    if (match) {
      update.name_en = match[1];
    } else if (/^\d+$/.test(original.trim())) {
      update.name_en = `Standard Profile ${original.trim()}`;
    }
  }

  if (FORCE_PRIVATE_EXACT.has(originalLower) || originalLower.includes('bug')) {
    update.is_public = false;
  }

  if (update.name_en !== undefined && update.name_en === row.name_en) delete update.name_en;
  if (update.is_public !== undefined && update.is_public === row.is_public) delete update.is_public;

  return Object.keys(update).length > 0 ? update : null;
}

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

  console.log(`Checking ${profiles?.length ?? 0} profiles against name-fix rules...`);

  let updated = 0;
  let namesChanged = 0;
  let madePrivate = 0;
  const changedNames: string[] = [];

  for (const row of profiles ?? []) {
    const update = computeUpdate(row);
    if (!update) continue;

    const { error: updateError } = await supabase.from('machine_profiles').update(update).eq('id', row.id);
    if (updateError) {
      console.warn(`Failed to update ${row.id} ("${row.name_original}"): ${updateError.message}`);
      continue;
    }

    updated++;
    if (update.name_en !== undefined) {
      namesChanged++;
      changedNames.push(`  "${row.name_original}" → name_en: "${update.name_en}"`);
    }
    if (update.is_public !== undefined) {
      madePrivate++;
      changedNames.push(`  "${row.name_original}" → is_public: false`);
    }
  }

  console.log('\n=== Profile Name Fix Summary ===');
  console.log(`Profiles updated:       ${updated}`);
  console.log(`  name_en changed:      ${namesChanged}`);
  console.log(`  is_public set false:  ${madePrivate}`);
  if (changedNames.length > 0) {
    console.log('\nDetail:');
    changedNames.forEach((line) => console.log(line));
  }
}

main().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
