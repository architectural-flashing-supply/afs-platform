import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * STATIC SCAN — the 911-entry AI-read machine profile library is gone and
 * must stay gone.
 *
 * Command Center V2 prompt v2-01 removed it: its geometry was AI-read out of
 * the OLD Thalmann's own job-history database and was never geometrically
 * validated, and its profile names were real customer and project names
 * (docs/COMMAND_CENTER_V2_SPEC.md §2.8). The raw source files are archived
 * outside the repo at C:\\Users\\manag\\Documents\\afs-assets\\old-machine-files\\
 * — they are the only copies of that machine's database.
 *
 * This test walks the real source tree the same way
 * lib/integrations/pathfinder-single-door.test.ts does, and fails if any
 * source file references the dropped tables, the deleted modules, or the
 * deleted local data folder. Deleting the code is not enough on its own: a
 * later change that "just adds the query back" would silently reintroduce a
 * table that no longer exists, and this is what catches that.
 *
 * NOT covered by this scan, deliberately, because they are different things
 * that must keep working:
 *   - `shop_profile_library` — real send history to the CURRENT Thalmann
 *   - `canonical_profiles`   — the hand-authored starter library
 */

const REPO_ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'scripts', 'tests'];
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** Dropped tables. */
const FORBIDDEN_TABLES = [
  'machine_profile_bends',
  'machine_profiles',
  'machine_profile_categories',
];

/** Deleted modules, by the path or symbol a reintroduced import would use. */
const FORBIDDEN_MODULES = [
  'api/studio/match-profile',
  'api/studio/load-profile',
  'api/studio/library-list',
  'studio/profile-viewer',
  'machine-profile-fabrication',
  'utils/bend-signature',
  'ProfileLibraryBrowser',
  'ProfileLibraryTabs',
  'ShareProfileButton',
  'import-machine-profiles',
  'import-additional-profiles',
];

/** The deleted local data folder holding the old machine's raw database. */
const FORBIDDEN_PATHS = ['machine-data/', 'machine-data\\'];

function sourceFiles(dir: string): string[] {
  const absolute = join(REPO_ROOT, dir);
  if (!existsSync(absolute)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
        out.push(full);
      }
    }
  };
  walk(absolute);
  return out;
}

const ALL_FILES = SCAN_DIRS.flatMap(sourceFiles);
const SELF = join('lib', 'data', 'removed-machine-library.test.ts');

function offenders(needles: string[]): string[] {
  const hits: string[] = [];
  for (const file of ALL_FILES) {
    const rel = relative(REPO_ROOT, file);
    if (rel === SELF || rel === SELF.split(sep).join('/')) continue;
    const contents = readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (contents.includes(needle)) hits.push(`${rel} -> ${needle}`);
    }
  }
  return hits;
}

describe('the 911-entry machine profile library stays removed', () => {
  it('scans a real, non-empty source tree', () => {
    // A scan that silently found no files would "pass" forever.
    expect(ALL_FILES.length).toBeGreaterThan(200);
  });

  it('no source file references the dropped tables', () => {
    expect(offenders(FORBIDDEN_TABLES)).toEqual([]);
  });

  it('no source file references the deleted modules', () => {
    expect(offenders(FORBIDDEN_MODULES)).toEqual([]);
  });

  it('no source file references the deleted machine-data folder', () => {
    expect(offenders(FORBIDDEN_PATHS)).toEqual([]);
  });

  it('the deleted files are actually gone from disk', () => {
    const deleted = [
      'app/api/studio/match-profile/route.ts',
      'app/api/studio/load-profile/[id]/route.ts',
      'app/api/studio/library-list/route.ts',
      'app/studio/profile-viewer/[profileId]/page.tsx',
      'components/studio/ProfileLibraryBrowser.tsx',
      'components/studio/ProfileLibraryTabs.tsx',
      'app/components/home/ProfileExplorer.tsx',
      'lib/data/machine-profile-fabrication.ts',
      'lib/utils/bend-signature.ts',
      'scripts/import-machine-profiles.ts',
      'scripts/import-additional-profiles.ts',
      'machine-data',
    ];
    expect(deleted.filter((p) => existsSync(join(REPO_ROOT, p)))).toEqual([]);
  });

  it('keeps the two libraries that are NOT being removed', () => {
    // Guards against an over-eager future cleanup: shop_profile_library is
    // real send history to the current machine, canonical_profiles is the
    // hand-authored starter library.
    const kept = ['shop_profile_library', 'canonical_profiles'];
    for (const table of kept) {
      const referenced = ALL_FILES.some((f) => readFileSync(f, 'utf8').includes(table));
      expect(referenced, `${table} should still be referenced in source`).toBe(true);
    }
  });
});
