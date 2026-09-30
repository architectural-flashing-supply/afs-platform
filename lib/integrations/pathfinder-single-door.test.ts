/**
 * ONE DOOR TO THE MACHINE — enforcement tests (2026-09-30).
 *
 * Catalog 20115 is polled by the physical Thalmann DS2801. Two independent
 * checks here:
 *
 *   1. STATIC: no file outside the Command Center approval path may call
 *      pushProfileToPathfinder at all. This catches a new door being added
 *      months from now, which a runtime test on today's callers cannot.
 *   2. RUNTIME: the guard inside pushProfileToPathfinder refuses and sends
 *      NOTHING when the approval record is missing, stale, or the actor is
 *      not an admin.
 *
 * No real vendor calls: fetch is replaced with a spy that fails the test if
 * it is ever invoked, and supabase-js is mocked per-case.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');

/** The ONLY files permitted to call pushProfileToPathfinder. */
const ALLOWED_CALLERS = [
  'app/api/admin/command-center/approve-quote-request/route.ts',
  'app/api/admin/command-center/approve/route.ts',
  // the implementation itself, and its own tests
  'lib/integrations/pathfinder-edge.ts',
  'lib/integrations/flashdraft-to-pathfinder.test.ts',
  'lib/integrations/pathfinder-single-door.test.ts',
];

// scripts/pathfinder-roundtrip-test.ts was DELETED in this pass: it POSTed a
// test profile straight into catalog 20115 with no approval of any kind — a
// fourth door, found by this very test. Its finding (feature `length` is mm)
// is recorded in ARCHITECTURE.md; the script itself is not coming back.

const SCAN_DIRS = ['app', 'components', 'lib', 'scripts', 'tests'];

/**
 * Strips // and /* *\/ comments so a doc-comment MENTIONING the function is
 * not mistaken for a call to it. Several modules legitimately reference it by
 * name in prose (lib/data/shop-library.ts, flashdraft-to-pathfinder.ts).
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const SCAN_EXT = /\.(ts|tsx|mjs|cjs|js)$/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

describe('ONE DOOR — static: only the approval path references the push', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));

  it('scanned a meaningful number of files (guards against a broken walk)', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('no file outside the Command Center approval path calls pushProfileToPathfinder', () => {
    const offenders = files.filter((f) => {
      const rel = relative(REPO_ROOT, f).split(sep).join('/');
      if (ALLOWED_CALLERS.includes(rel)) return false;
      return /pushProfileToPathfinder\s*\(/.test(stripComments(readFileSync(f, 'utf8')));
    });
    expect(offenders.map((f) => relative(REPO_ROOT, f).split(sep).join('/'))).toEqual([]);
  });

  it('the deleted direct-send routes are really gone', () => {
    const rels = files.map((f) => relative(REPO_ROOT, f).split(sep).join('/'));
    expect(rels).not.toContain('app/api/studio/send-to-pathfinder/route.ts');
    expect(rels).not.toContain('app/api/admin/pathfinder/push-profile/route.ts');
    expect(rels).not.toContain('app/api/admin/pathfinder/submit-job/route.ts');
  });

  it('no client code fetches a direct-send endpoint any more', () => {
    const offenders = files.filter((f) =>
      /['"`]\/api\/(studio\/send-to-pathfinder|admin\/pathfinder\/(push-profile|submit-job))/.test(
        readFileSync(f, 'utf8'),
      ),
    );
    expect(offenders.map((f) => relative(REPO_ROOT, f).split(sep).join('/'))).toEqual([]);
  });
});

// --- runtime guard -----------------------------------------------------

const PROFILE = {
  id: 'p1',
  nameEn: 'Guard test profile',
  profileNumber: 'GT-1',
  blankWidthMm: 500,
  bends: [{ stepNumber: 1, leftLegMm: 100, rightLegMm: 100, bendAngleDegrees: 90, radiusMm: 3 }],
};

/** Installs a supabase-js mock returning the given rows, then imports fresh. */
async function loadPushWith(rows: Record<string, { data: unknown; error: unknown }>) {
  vi.resetModules();
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => rows[table] ?? { data: null, error: null } }),
        }),
      }),
    }),
  }));
  const mod = await import('./pathfinder-edge');
  return mod.pushProfileToPathfinder;
}

const ADMIN_OK = { data: { id: 'admin-1', role: 'admin' }, error: null };

describe('ONE DOOR — runtime: the push refuses without a real approval', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-key';
    process.env.PATHFINDER_EDGE_API_KEY = 'stub-api-key';
    process.env.PATHFINDER_EDGE_BASE_URL = 'https://stub.pathfinderedge.test';
    // Any network call at all is a test failure — this is the whole point.
    fetchSpy = vi.fn(() => {
      throw new Error('NETWORK CALL ATTEMPTED — the single-door guard let an unapproved push through.');
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('refuses when the quote request is not "submitted" (already approved)', async () => {
    const push = await loadPushWith({
      profiles: ADMIN_OK,
      quote_requests: { data: { id: 'qr-1', status: 'reviewing' }, error: null },
    });
    const result = await push(PROFILE, '20115', {
      kind: 'quote_request_approval',
      quoteRequestId: 'qr-1',
      adminId: 'admin-1',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not "submitted"|not awaiting approval/i);
    expect(result.profileId).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses when the quote request does not exist', async () => {
    const push = await loadPushWith({ profiles: ADMIN_OK, quote_requests: { data: null, error: null } });
    const result = await push(PROFILE, '20115', {
      kind: 'quote_request_approval',
      quoteRequestId: 'ghost',
      adminId: 'admin-1',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/does not exist/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses when the actor is not an admin', async () => {
    const push = await loadPushWith({
      profiles: { data: { id: 'u1', role: 'customer' }, error: null },
      quote_requests: { data: { id: 'qr-1', status: 'submitted' }, error: null },
    });
    const result = await push(PROFILE, '20115', {
      kind: 'quote_request_approval',
      quoteRequestId: 'qr-1',
      adminId: 'u1',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not an admin/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses when the machine job is not "pending_approval"', async () => {
    const push = await loadPushWith({
      profiles: ADMIN_OK,
      machine_jobs: { data: { id: 'mj-1', status: 'approved_for_machine' }, error: null },
    });
    const result = await push(PROFILE, '20115', {
      kind: 'machine_job_approval',
      machineJobId: 'mj-1',
      adminId: 'admin-1',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/not "pending_approval"/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses when no approval context is supplied at all', async () => {
    const push = await loadPushWith({ profiles: ADMIN_OK });
    // Callers are type-checked, but a JS caller or an `as never` cast is not.
    const result = await push(PROFILE, '20115', undefined as never);
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/no approval context/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses when service-role credentials are missing (cannot verify => cannot push)', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const push = await loadPushWith({ profiles: ADMIN_OK });
    const result = await push(PROFILE, '20115', {
      kind: 'quote_request_approval',
      quoteRequestId: 'qr-1',
      adminId: 'admin-1',
    });
    expect(result.status).toBe('error');
    expect(result.message).toMatch(/could not be verified|Refusing to push/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
