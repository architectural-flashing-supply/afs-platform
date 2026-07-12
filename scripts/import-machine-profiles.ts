/**
 * Imports the Thalmann DS2801 bending machine profile library into Supabase.
 *
 * Source: machine-data/ds2801db.bdb (a Microsoft Jet/Access database — the
 * ".bdb" extension is unusual but the file's own header confirms "Standard
 * Jet DB"). Reads via the mdb-reader npm package rather than shelling out to
 * the system `mdbtools` CLI: this environment has no apt-get/mdbtools
 * package available (Windows, no WSL), and a pure-JS reader is more portable
 * for a script that lives in the repo and may run on a different machine
 * later. Same three source tables, same result.
 *
 * PRIVACY: this source database is a live shop's job history, not a clean
 * generic profile catalog. Individual profile names embed real customer and
 * project names even inside generic-sounding categories (e.g. category
 * "DRIP EDGE" contains profiles named after specific customers). Per an
 * explicit decision recorded in SESSION_STATE.md, only categories 23
 * (Rheinzink-Profile) and 42-61 (the numbered "00"-"19" series) are treated
 * as public, reusable templates. Every other category is imported as
 * is_public = false. Within the public categories, any individual profile
 * whose name doesn't fully resolve to a recognized generic term (via
 * NAME_TRANSLATIONS or a generic code/numeric pattern) is also forced
 * private — a handful of profiles even in the "safe" categories (e.g.
 * "Messe", "Toli", "BUG--master-cuppers") look like personal nicknames or
 * in-jokes rather than generic profile names, so they don't get a free pass
 * just because their category is otherwise public.
 *
 * Run: pnpm run import:machine-profiles
 */

import { readFileSync } from 'fs';
import path from 'path';
import MDBReader from 'mdb-reader';
import type { Value } from 'mdb-reader';
import { createClient } from '@supabase/supabase-js';

loadEnvLocal();

interface KategorieRow {
  [key: string]: Value;
  kKategorie: number;
  sBezeichnung: string;
  sKommentar: string | null;
}

interface BiegeprogrammRow {
  [key: string]: Value;
  kBiegeprogramm: number;
  kKategorie: number;
  nProgrammnummer: string | number;
  nAbwicklung: number | null;
}

interface BiegeprogrammSatzRow {
  [key: string]: Value;
  kBiegeprogramm: number;
  nSatznummer: number;
  nSchenkelLinks: number | null;
  nSchenkelRechts: number | null;
  nBiegewinkel: number | null;
  nRadius: number | null;
}

// Built from a full inspection of the real ds2801db.bdb Kategorien table (46
// rows) — see SESSION_STATE.md for the audit that produced this list. Any
// category encountered in the file but not listed here defaults to private.
const CATEGORY_MAP: Record<number, { nameEn: string; isPublic: boolean }> = {
  23: { nameEn: 'Zinc Profiles', isPublic: true },
  42: { nameEn: 'Standard Series 0', isPublic: true },
  43: { nameEn: 'Standard Series 1', isPublic: true },
  44: { nameEn: 'Standard Series 2', isPublic: true },
  45: { nameEn: 'Standard Series 3', isPublic: true },
  46: { nameEn: 'Standard Series 4', isPublic: true },
  47: { nameEn: 'Standard Series 5', isPublic: true },
  48: { nameEn: 'Standard Series 6', isPublic: true },
  49: { nameEn: 'Standard Series 7', isPublic: true },
  50: { nameEn: 'Standard Series 8', isPublic: true },
  51: { nameEn: 'Standard Series 9', isPublic: true },
  52: { nameEn: 'Standard Series 10', isPublic: true },
  53: { nameEn: 'Standard Series 11', isPublic: true },
  54: { nameEn: 'Standard Series 12', isPublic: true },
  55: { nameEn: 'Standard Series 13', isPublic: true },
  56: { nameEn: 'Standard Series 14', isPublic: true },
  57: { nameEn: 'Standard Series 15', isPublic: true },
  58: { nameEn: 'Standard Series 16', isPublic: true },
  59: { nameEn: 'Standard Series 17', isPublic: true },
  60: { nameEn: 'Standard Series 18', isPublic: true },
  61: { nameEn: 'Standard Series 19', isPublic: true },
  62: { nameEn: 'Omega Profile', isPublic: false },
  63: { nameEn: 'Miscellaneous Custom', isPublic: false },
  64: { nameEn: 'First Class RV', isPublic: false },
  65: { nameEn: 'IB Roof System', isPublic: false },
  66: { nameEn: 'L3 Luna', isPublic: false },
  67: { nameEn: 'Eave Drip Edge', isPublic: false },
  68: { nameEn: 'Valley Flashing', isPublic: false },
  69: { nameEn: 'Hip and Ridge Flashing', isPublic: false },
  70: { nameEn: 'Copper', isPublic: false },
  71: { nameEn: 'Mauricio Construction', isPublic: false },
  72: { nameEn: 'MG Construction', isPublic: false },
  73: { nameEn: 'DPR Construction', isPublic: false },
  74: { nameEn: 'Prime Walls', isPublic: false },
  75: { nameEn: 'DBS', isPublic: false },
  76: { nameEn: 'RE Construction — Mauricio', isPublic: false },
  77: { nameEn: 'Crewlyn', isPublic: false },
  78: { nameEn: 'Headwall Flashing', isPublic: false },
  79: { nameEn: 'Gutter & Downspout', isPublic: false },
  80: { nameEn: 'Angelus Waterproofing', isPublic: false },
  81: { nameEn: 'Bell County', isPublic: false },
  82: { nameEn: 'Standard Drywall', isPublic: false },
  83: { nameEn: 'BBS Construction', isPublic: false },
  84: { nameEn: 'Aluminum', isPublic: false },
  85: { nameEn: 'Clinton Baird', isPublic: false },
  86: { nameEn: 'Gray and Becker', isPublic: false },
};

// Longer/multi-word keys first so they match before their component words do.
const NAME_TRANSLATIONS: [RegExp, string][] = [
  [/kehl mit rippe/gi, 'Ribbed Valley Flashing'],
  [/attikakappe/gi, 'Parapet Coping Cap'],
  [/attikahalter/gi, 'Parapet Coping Cap Bracket'],
  [/attika/gi, 'Parapet Coping Cap'],
  [/rheinzink-profile/gi, 'Zinc Profiles'],
  [/biegeprogramme/gi, 'Bend Programs'],
  [/kehle/gi, 'Valley Flashing'],
  [/kehl/gi, 'Valley Flashing'],
  [/ortgang/gi, 'Rake Fascia'],
  [/traufe/gi, 'Eave Drip Edge'],
  [/einlauf/gi, 'Gutter Inlet'],
  [/randwinkel/gi, 'Edge Angle'],
  [/steckpaneel/gi, 'Snap Lock Panel'],
  [/kappleiste/gi, 'Cap Strip'],
  [/first(?!\s*class)/gi, 'Ridge Cap'],
  [/miscelaneous/gi, 'Miscellaneous Custom'],
  [/omega/gi, 'Omega Profile'],
  [/rund/gi, 'Round'],
  [/trapez/gi, 'Trapezoid'],
  [/falz/gi, 'Seam'],
  [/pult/gi, 'Pent Cap'],
];

function translateName(raw: string): string {
  let out = raw.trim();
  for (const [pattern, replacement] of NAME_TRANSLATIONS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

// Tokens accepted as "generic/safe": pure numeric, dimension ranges (30-30,
// 4-12), radius codes (R100), or a dictionary word (after stripping a
// trailing digit run, so "GUTTER1"/"Toli1"-style variant suffixes still
// resolve to their root word). Deliberately NOT permissive about bare short
// alphabetic codes in general — real project/customer names in this data
// (HAM, WALLER CREEK, 1407 BURFORD, BAND STRAP, JONHS-LUCE, BUG--master-
// cuppers) are exactly this shape, so trusting "short word = generic code"
// would leak them. Anything not explicitly recognized defaults to private.
const NUMERIC_PATTERN = /^[0-9]+(\.[0-9]+)?$/;
const DIMENSION_RANGE_PATTERN = /^[0-9]+(\.[0-9]+)?-[0-9]+(\.[0-9]+)?$/;
const RADIUS_PATTERN = /^R[0-9]+(\.[0-9]+)?$/i;

const KNOWN_ENGLISH_WORDS = new Set([
  'parapet', 'coping', 'cap', 'bracket', 'valley', 'flashing', 'rake', 'fascia',
  'eave', 'drip', 'edge', 'gutter', 'gutters', 'downspout', 'downspouts',
  'inlet', 'angle', 'snap', 'lock', 'panel', 'strip', 'zinc', 'profiles',
  'bend', 'programs', 'ridge', 'ribbed', 'round', 'trapezoid', 'seam', 'pent',
  'omega', 'profile', 'miscellaneous', 'custom', 'with', 'and',
]);

function isGenericToken(token: string): boolean {
  if (NUMERIC_PATTERN.test(token) || DIMENSION_RANGE_PATTERN.test(token) || RADIUS_PATTERN.test(token)) {
    return true;
  }
  const stripped = token.replace(/[0-9]+$/, '').toLowerCase();
  return KNOWN_ENGLISH_WORDS.has(stripped) || KNOWN_ENGLISH_WORDS.has(token.toLowerCase());
}

function hasUnrecognizedToken(translated: string): boolean {
  const tokens = translated.split(/[\s\-/]+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.some((t) => !isGenericToken(t));
}

function mmToIn(mm: number | null | undefined): number | null {
  if (mm === null || mm === undefined || Number.isNaN(mm)) return null;
  return Math.round((mm / 25.4) * 10000) / 10000;
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
  const dbPath = path.resolve(__dirname, '../machine-data/ds2801db.bdb');
  console.log(`Reading ${dbPath} ...`);
  const buffer = readFileSync(dbPath);
  const reader = new MDBReader(buffer);

  const kategorien = reader.getTable('Kategorien').getData<KategorieRow>();
  const biegeprogramme = reader.getTable('Biegeprogramme').getData<BiegeprogrammRow>();
  const saetze = reader.getTable('BiegeprogrammSaetze').getData<BiegeprogrammSatzRow>();

  console.log(
    `Parsed ${kategorien.length} categories, ${biegeprogramme.length} profiles, ${saetze.length} bend steps.`
  );

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local or environment).');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // --- Categories ---
  const sortedCategories = [...kategorien].sort((a, b) => a.kKategorie - b.kKategorie);
  const categoryRows = sortedCategories.map((k, index) => {
    const mapped = CATEGORY_MAP[k.kKategorie];
    return {
      source_category_id: k.kKategorie,
      name_en: mapped?.nameEn ?? translateName(k.sBezeichnung),
      name_original: k.sBezeichnung,
      sort_order: index,
      is_public: mapped?.isPublic ?? false,
      is_active: true,
    };
  });

  console.log(`Upserting ${categoryRows.length} categories...`);
  const { data: upsertedCategories, error: catError } = await supabase
    .from('machine_profile_categories')
    .upsert(categoryRows, { onConflict: 'source_category_id' })
    .select('id, source_category_id');
  if (catError) throw catError;

  const categoryIdBySource = new Map<number, string>();
  for (const row of upsertedCategories ?? []) {
    categoryIdBySource.set(row.source_category_id as number, row.id as string);
  }

  // --- Profiles ---
  const profileRows = biegeprogramme
    .map((bp) => {
      const categoryId = categoryIdBySource.get(bp.kKategorie);
      if (!categoryId) {
        console.warn(`Skipping profile ${bp.kBiegeprogramm} — unknown category ${bp.kKategorie}`);
        return null;
      }
      const categoryMeta = CATEGORY_MAP[bp.kKategorie];
      const rawName = String(bp.nProgrammnummer ?? '');
      const translated = translateName(rawName);
      const isPublic = (categoryMeta?.isPublic ?? false) && !hasUnrecognizedToken(translated);

      return {
        source_profile_id: bp.kBiegeprogramm,
        category_id: categoryId,
        profile_number: rawName,
        name_en: translated || rawName,
        name_original: rawName,
        blank_width_mm: bp.nAbwicklung ?? null,
        blank_width_in: mmToIn(bp.nAbwicklung),
        is_public: isPublic,
        is_active: true,
        match_tolerance_pct: 5,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

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
  const bendRows = saetze
    .map((s) => {
      const profileId = profileIdBySource.get(s.kBiegeprogramm);
      if (!profileId) return null;
      return {
        profile_id: profileId,
        step_number: s.nSatznummer,
        left_leg_mm: s.nSchenkelLinks ?? null,
        left_leg_in: mmToIn(s.nSchenkelLinks),
        right_leg_mm: s.nSchenkelRechts ?? null,
        right_leg_in: mmToIn(s.nSchenkelRechts),
        bend_angle_degrees: s.nBiegewinkel ?? null,
        radius_mm: s.nRadius ?? null,
        radius_in: mmToIn(s.nRadius),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`Upserting ${bendRows.length} bend steps...`);
  const CHUNK = 500;
  for (let i = 0; i < bendRows.length; i += CHUNK) {
    const chunk = bendRows.slice(i, i + CHUNK);
    const { error: bendError } = await supabase
      .from('machine_profile_bends')
      .upsert(chunk, { onConflict: 'profile_id,step_number' });
    if (bendError) throw bendError;
  }

  const publicCategoryCount = categoryRows.filter((c) => c.is_public).length;
  const publicProfileCount = profileRows.filter((p) => p.is_public).length;

  console.log('\n=== Import Summary ===');
  console.log(`Categories:        ${categoryRows.length} (${publicCategoryCount} public)`);
  console.log(`Total profiles:    ${profileRows.length}`);
  console.log(`Public profiles:   ${publicProfileCount}`);
  console.log(`Private profiles:  ${profileRows.length - publicProfileCount}`);
  console.log(`Bend steps:        ${bendRows.length}`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
