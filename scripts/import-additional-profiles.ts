/**
 * Imports the supplemental FlashDraft profile library from
 * machine-data/afs-additional-profiles.json — a clean, pre-vetted export of
 * generic reusable profiles (no customer/project names), separate from the
 * live shop job history handled by scripts/import-machine-profiles.ts.
 * Every profile in this file is already marked isPublic: true by its
 * source export; this script still forces is_public = true on write so the
 * behavior is correct even if a future export accidentally omits the flag.
 *
 * Upserts by source_profile_id (machine_profiles) and (profile_id,
 * step_number) (machine_profile_bends) — safe to re-run, never duplicates.
 * Each profile's category (sourceCategoryId) must already exist in
 * machine_profile_categories (created by import-machine-profiles.ts); a
 * profile whose category isn't found is skipped with a warning rather than
 * failing the whole run.
 *
 * Run: pnpm run import:additional-profiles
 */

import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

// Same rationale as import-machine-profiles.ts: supabase-js always
// constructs a Realtime client, which requires a global WebSocket
// implementation this script's target Node version doesn't provide natively.
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;
}

loadEnvLocal();

interface SourceBend {
  step: number;
  leftLegMm: number | null;
  rightLegMm: number | null;
  angleDegrees: number | null;
  radiusMm: number | null;
  leftLegIn: number | null;
  rightLegIn: number | null;
  radiusIn: number | null;
}

interface SourceProfile {
  sourceProfileId: number;
  sourceCategoryId: number;
  categoryName: string;
  profileNumber: string;
  blankWidthMm: number | null;
  blankWidthIn: number | null;
  isPublic: boolean;
  bends: SourceBend[];
}

interface SourceFile {
  source: string;
  exportedAt: string;
  totalProfiles: number;
  totalBendSteps: number;
  profiles: SourceProfile[];
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
  const jsonPath = path.resolve(__dirname, '../machine-data/afs-additional-profiles.json');
  console.log(`Reading ${jsonPath} ...`);
  const source: SourceFile = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(`Parsed ${source.profiles.length} profiles, ${source.totalBendSteps} bend steps from ${source.source}.`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or environment).');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // --- Resolve categories (must already exist from import-machine-profiles.ts) ---
  const { data: categories, error: catError } = await supabase
    .from('machine_profile_categories')
    .select('id, source_category_id');
  if (catError) throw catError;

  const categoryIdBySource = new Map<number, string>();
  for (const row of categories ?? []) {
    categoryIdBySource.set(row.source_category_id as number, row.id as string);
  }

  // --- Check which source_profile_ids already exist, to report new-vs-duplicate ---
  const sourceIds = source.profiles.map((p) => p.sourceProfileId);
  const { data: existingProfiles, error: existingError } = await supabase
    .from('machine_profiles')
    .select('source_profile_id')
    .in('source_profile_id', sourceIds);
  if (existingError) throw existingError;
  const existingIds = new Set((existingProfiles ?? []).map((r) => r.source_profile_id as number));

  const skippedNoCategory: number[] = [];
  const profileRows = source.profiles
    .map((p) => {
      const categoryId = categoryIdBySource.get(p.sourceCategoryId);
      if (!categoryId) {
        skippedNoCategory.push(p.sourceProfileId);
        return null;
      }
      return {
        source_profile_id: p.sourceProfileId,
        category_id: categoryId,
        profile_number: p.profileNumber,
        name_en: p.profileNumber,
        name_original: p.profileNumber,
        blank_width_mm: p.blankWidthMm,
        blank_width_in: p.blankWidthIn,
        is_public: true,
        is_active: true,
        match_tolerance_pct: 5,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (skippedNoCategory.length > 0) {
    console.warn(`Skipping ${skippedNoCategory.length} profile(s) — unknown category: ${skippedNoCategory.join(', ')}`);
  }

  console.log(`Upserting ${profileRows.length} profiles...`);
  const { data: upsertedProfiles, error: profileError } = await supabase
    .from('machine_profiles')
    .upsert(profileRows, { onConflict: 'source_profile_id' })
    .select('id, source_profile_id');
  if (profileError) throw profileError;

  const profileIdBySource = new Map<number, string>();
  for (const row of upsertedProfiles ?? []) {
    profileIdBySource.set(row.source_profile_id as number, row.id as string);
  }

  // --- Bend steps ---
  const bendRows = source.profiles
    .flatMap((p) => {
      const profileId = profileIdBySource.get(p.sourceProfileId);
      if (!profileId) return [];
      return p.bends.map((b) => ({
        profile_id: profileId,
        step_number: b.step,
        left_leg_mm: b.leftLegMm,
        left_leg_in: b.leftLegIn,
        right_leg_mm: b.rightLegMm,
        right_leg_in: b.rightLegIn,
        bend_angle_degrees: b.angleDegrees,
        radius_mm: b.radiusMm,
        radius_in: b.radiusIn,
      }));
    });

  console.log(`Upserting ${bendRows.length} bend steps...`);
  const CHUNK = 500;
  for (let i = 0; i < bendRows.length; i += CHUNK) {
    const chunk = bendRows.slice(i, i + CHUNK);
    const { error: bendError } = await supabase
      .from('machine_profile_bends')
      .upsert(chunk, { onConflict: 'profile_id,step_number' });
    if (bendError) throw bendError;
  }

  const newCount = profileRows.filter((p) => !existingIds.has(p.source_profile_id)).length;
  const duplicateCount = profileRows.length - newCount;

  console.log('\n=== Import Summary ===');
  console.log(`New profiles added:     ${newCount}`);
  console.log(`Duplicates skipped:     ${duplicateCount} (already present — upserted/refreshed, not double-inserted)`);
  console.log(`Skipped (no category):  ${skippedNoCategory.length}`);
  console.log(`Bend steps added:       ${bendRows.length}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
