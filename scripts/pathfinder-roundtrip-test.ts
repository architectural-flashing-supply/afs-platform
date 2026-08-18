/**
 * One-off manual validation script for lib/integrations/pathfinder-edge.ts
 * — NOT wired into any build/CI step, run by hand only.
 *
 * Confirms two things empirically, since PathfinderEdge's own docs
 * (https://docs.amscontrols.com/pathfinderEdge/profile-object) state
 * feature `length` is "in your tenant's units" without saying what that
 * unit actually is:
 *
 * 1. PIPELINE CHECK — posts a trivial known profile (a single 6-inch
 *    Straight, no bends, no hems) to catalog 20115 via the real
 *    pushProfileToPathfinder(), then GETs it back by the resolved
 *    profileId and prints the echoed blankWidth. IMPORTANT CAVEAT: for a
 *    bendless, hemless single-Straight profile, blankWidth is just that
 *    Straight's own length echoed back unchanged — this alone is
 *    UNIT-INVARIANT. Sending "6" and getting back "6" proves the
 *    POST -> resolve-id -> GET pipeline works end-to-end (auth, feature
 *    array shape, profileId resolution), but by itself does NOT prove
 *    the number means inches rather than mm — the server doesn't
 *    transform an opaque single length, so it would echo any number back
 *    unchanged regardless of unit.
 * 2. UNIT PLAUSIBILITY CHECK — separately lists a handful of REAL,
 *    already-existing profiles in catalog 20115 and prints their
 *    blankWidth values. This is the actual empirical signal: real AFS
 *    flashing profiles have known plausible blank widths (roughly 3-40
 *    for architectural flashing in inches; the equivalent mm range would
 *    be roughly 75-1000). Whichever range the real data falls in tells us
 *    the tenant's configured unit — grounded in real production data,
 *    not a self-referential test value.
 *
 * Cleans up its own test profile via DELETE afterward (PathfinderEdge
 * archives rather than hard-deletes, per the publicapi doc, so this is
 * best-effort tidiness, not a guarantee of zero trace).
 *
 * Run: pnpm tsx scripts/pathfinder-roundtrip-test.ts
 */

import { readFileSync } from 'fs';
import path from 'path';
import { pushProfileToPathfinder, type MachineProfile } from '../lib/integrations/pathfinder-edge';

const AFS_CATALOG_ID = '20115';
const MM_PER_INCH = 25.4;

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

async function pathfinderGet(path_: string): Promise<{ status: number; body: unknown }> {
  const baseUrl = (process.env.PATHFINDER_EDGE_BASE_URL ?? '').replace(/\/+$/, '');
  const apiKey = process.env.PATHFINDER_EDGE_API_KEY ?? '';
  const res = await fetch(`${baseUrl}${path_}`, {
    method: 'GET',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function pathfinderDelete(path_: string): Promise<number> {
  const baseUrl = (process.env.PATHFINDER_EDGE_BASE_URL ?? '').replace(/\/+$/, '');
  const apiKey = process.env.PATHFINDER_EDGE_API_KEY ?? '';
  const res = await fetch(`${baseUrl}${path_}`, {
    method: 'DELETE',
    headers: { Authorization: apiKey },
  });
  return res.status;
}

async function main() {
  loadEnvLocal();
  if (!process.env.PATHFINDER_EDGE_API_KEY || !process.env.PATHFINDER_EDGE_BASE_URL) {
    throw new Error('PATHFINDER_EDGE_API_KEY and PATHFINDER_EDGE_BASE_URL must be set (.env.local or environment).');
  }

  console.log('=== 1. UNIT PLAUSIBILITY CHECK — existing real profiles in catalog', AFS_CATALOG_ID, '===');
  const listResult = await pathfinderGet(`/api/v1/profiles?catalog=${AFS_CATALOG_ID}&skip=0&take=10`);
  console.log(`GET /api/v1/profiles?catalog=${AFS_CATALOG_ID}&skip=0&take=10 -> ${listResult.status}`);
  if (listResult.status === 200 && Array.isArray(listResult.body)) {
    const rows = listResult.body as { profileId: number; profileName: string; blankWidth: number }[];
    if (rows.length === 0) {
      console.log('Catalog has zero profiles — no plausibility signal available from existing data.');
    } else {
      for (const row of rows) {
        console.log(`  profileId=${row.profileId} name="${row.profileName}" blankWidth=${row.blankWidth}`);
      }
      const widths = rows.map((r) => r.blankWidth);
      const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
      console.log(
        `  Average blankWidth across ${widths.length} real profiles: ${avg.toFixed(2)}. Real AFS flashing blank ` +
          `widths are roughly 3-40 in inches, or roughly 75-1000 in mm — compare this average against those ranges.`
      );
    }
  } else {
    console.log('  Could not list existing profiles — see status/body above.');
  }

  console.log();
  console.log('=== 2. PIPELINE CHECK — known 6-inch straight segment, no bends, no hems ===');
  const KNOWN_LENGTH_IN = 6;
  const testProfile: MachineProfile = {
    id: 'roundtrip-test',
    nameEn: `AFS_TEST_ROUNDTRIP_${Date.now()}`,
    profileNumber: 'ROUNDTRIP-TEST',
    blankWidthMm: KNOWN_LENGTH_IN * MM_PER_INCH,
    bends: [],
  };
  console.log(`Posting profile "${testProfile.nameEn}" (blankWidthMm=${testProfile.blankWidthMm}, i.e. ${KNOWN_LENGTH_IN}" if mm->in conversion is correct)...`);

  const pushResult = await pushProfileToPathfinder(testProfile, AFS_CATALOG_ID);
  console.log('pushProfileToPathfinder result:', JSON.stringify(pushResult, null, 2));

  if (pushResult.status !== 'connected' || !pushResult.profileId) {
    console.log();
    console.log('PIPELINE CHECK FAILED — could not create/resolve the test profile. See result above. Stopping.');
    process.exitCode = 1;
    return;
  }

  const getResult = await pathfinderGet(`/api/v1/profiles/${pushResult.profileId}`);
  console.log(`GET /api/v1/profiles/${pushResult.profileId} -> ${getResult.status}`);
  console.log('Body:', JSON.stringify(getResult.body, null, 2));

  if (getResult.status === 200 && getResult.body && typeof getResult.body === 'object') {
    const echoedBlankWidth = (getResult.body as { blankWidth?: number }).blankWidth;
    console.log();
    console.log(`Known input length: ${KNOWN_LENGTH_IN} (what we intended as inches)`);
    console.log(`Echoed blankWidth:  ${echoedBlankWidth}`);
    console.log(
      echoedBlankWidth === KNOWN_LENGTH_IN
        ? 'Numbers match — the pipeline round-trips a length unchanged (expected either way, see caveat in this file\'s header comment; does NOT by itself confirm the unit is inches).'
        : 'Numbers do NOT match — investigate before trusting mmToIn()\'s inches assumption.'
    );
  }

  console.log();
  console.log('=== Cleanup — deleting test profile', pushResult.profileId, '===');
  const deleteStatus = await pathfinderDelete(`/api/v1/profiles/${pushResult.profileId}`);
  console.log(`DELETE /api/v1/profiles/${pushResult.profileId} -> ${deleteStatus}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
