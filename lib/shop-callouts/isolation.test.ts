/**
 * SHOP CALLOUTS — ISOLATION. A STATIC PROOF THAT THE CUSTOMER NEVER SEES ONE.
 *
 * `app/studio/draft/page.tsx` is ONE component serving the public customer
 * drawing tool AND the admin session Command Center opens with `?admin=1`. The
 * brief's first requirement is non-negotiable: the customer-facing FlashDraft
 * must contain no callout code path, no callout data and no callout network
 * calls — and it must be PROVED, not asserted in a comment.
 *
 * Five claims, each checked against the real filesystem rather than against a
 * list somebody maintains:
 *
 *   1. The shared page reaches the authoring layer ONLY through `next/dynamic`,
 *      so the code sits in its own chunk a customer's browser never fetches.
 *   2. The mount is gated on `calloutsEnabled`, which is set only by a 200
 *      from the admin-guarded API — not by `?admin=1`, not by client-side role
 *      state.
 *   3. Nothing outside a named allow-list touches the `shop_callouts` table.
 *   4. No customer-facing route, email, invoice, PDF or quote path mentions
 *      callouts at all.
 *   5. Every callout query names its columns — no `select('*')`, which is what
 *      makes claim 4 something that stays true as columns are added.
 *
 * This is the same shape as `lib/integrations/pathfinder-single-door.test.ts`
 * and `lib/data/removed-machine-library.test.ts`: a static scan catches a door
 * added months from now, which a runtime test on today's callers cannot.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'scripts', 'tests'];
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

/**
 * Strips comments so a doc-comment MENTIONING the table or the module is not
 * mistaken for a query against it. Several files legitimately discuss this
 * feature in prose — including this one.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = SCAN_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));
const sources = new Map<string, string>();
for (const f of files) {
  sources.set(relative(REPO_ROOT, f).split(sep).join('/'), readFileSync(f, 'utf8'));
}

/** The table name, built from fragments for the reason the removed-library test does. */
const TABLE = `shop${'_'}callouts`;

/** The ONLY files permitted to touch the table. */
const ALLOWED_TABLE_FILES = [
  'lib/data/shop-callouts.ts',
  'app/api/admin/shop-callouts/route.ts',
  'app/api/admin/shop-callouts/[id]/route.ts',
  'app/api/shop-callouts/[shopJobId]/route.ts',
  // tests and the static gate itself
  'lib/data/shop-callouts.test.ts',
  'lib/shop-callouts/isolation.test.ts',
  // The e2e spec reads the table back through the Supabase Management API to
  // prove a note really landed, and deletes its own rows in afterAll. It is a
  // verifier, not a second query path — it makes no application request to the
  // table and ships in nothing.
  'tests/e2e/shop-callouts.spec.ts',
];

/**
 * The customer's half of the application. A callout must not be mentioned
 * anywhere in here — not selected, not returned, not imported.
 *
 * Chosen by what a CUSTOMER can reach or receive: the RFQ intake, the guest
 * upload and takeoff flows, the field contractor flow, the approve-by-email
 * link, checkout and Stripe, every account-portal page, the quote/invoice
 * builders, the PDF writers, and every email template and sender.
 */
const CUSTOMER_FACING_PREFIXES = [
  'app/api/quote-requests/',
  'app/api/quote-approve/',
  'app/api/orders/',
  'app/api/checkout/',
  'app/api/webhooks/',
  'app/api/invoices/',
  'app/api/upload/',
  'app/api/takeoff/',
  'app/api/field/',
  'app/api/track/',
  'app/account/',
  'app/(public)/',
  'app/checkout/',
  'app/field/contractor/',
  'components/quote/',
  'components/account/',
  'components/field/',
  'lib/invoices/',
  'lib/email/',
  'lib/resend/',
  'lib/utils/profile-pdf.ts',
  'lib/pricing/',
  'lib/quotes/',
];

describe('shop callouts — the customer-facing FlashDraft has no callout code path', () => {
  const draftPage = sources.get('app/studio/draft/page.tsx');

  it('the shared page exists and is the page under test', () => {
    expect(draftPage, 'app/studio/draft/page.tsx must exist — it is the shared FlashDraft').toBeTruthy();
  });

  it('reaches the authoring layer ONLY through next/dynamic', () => {
    const src = stripComments(draftPage ?? '');
    // The dynamic import is the one permitted reference.
    expect(src).toContain("dynamic(() => import('@/components/studio/ShopCalloutLayer')");
    // And there must be no STATIC import of it, nor of any callout module —
    // a static import would put the code in the page's own chunk, which every
    // visitor downloads.
    const staticImports = src.match(/^\s*import[\s\S]*?from\s+'([^']+)';/gm) ?? [];
    for (const line of staticImports) {
      expect(
        line,
        `app/studio/draft/page.tsx must not statically import a callout module:\n${line}`
      ).not.toMatch(/ShopCallout|shop-callouts/);
    }
  });

  it('mounts the layer only behind the server-verified gate', () => {
    const src = stripComments(draftPage ?? '');
    // The gate is the admin-guarded GET, and the mount is conditional on its
    // result — never on `?admin=1`, which a customer can type.
    expect(src).toMatch(/fetch\(\s*`\/api\/admin\/shop-callouts\?/);
    expect(src).toContain('{calloutsEnabled && jobHandoff && canvasMounted && (');
    // `adminContext` is the ?admin=1 flag. It must not be what enables callouts.
    expect(src).not.toMatch(/adminContext\s*&&[^\n]*ShopCalloutLayer/);
  });

  it('makes no callout network call except the admin-guarded gate', () => {
    const src = stripComments(draftPage ?? '');
    const calls = src.match(/['"`][^'"`]*shop-callouts[^'"`]*['"`]/g) ?? [];
    for (const call of calls) {
      expect(call, `every callout request from the shared page must be the admin route: ${call}`).toContain(
        '/api/admin/shop-callouts'
      );
    }
  });
});

describe('shop callouts — only the allow-list touches the table', () => {
  it('no other file queries it', () => {
    const offenders: string[] = [];
    for (const [path, src] of sources) {
      if (ALLOWED_TABLE_FILES.includes(path)) continue;
      if (stripComments(src).includes(TABLE)) offenders.push(path);
    }
    expect(
      offenders,
      `These files reference the ${TABLE} table and are not on the allow-list. ` +
        'Route the read through lib/data/shop-callouts.ts instead of adding a second query.'
    ).toEqual([]);
  });

  it('the allow-listed files all still exist', () => {
    // Without this the test above could pass by the allow-list naming files
    // that are gone — green because it is looking at nothing.
    for (const path of ALLOWED_TABLE_FILES) {
      expect(sources.has(path), `${path} is on the allow-list but does not exist`).toBe(true);
    }
  });
});

describe('shop callouts — no customer-facing path mentions one', () => {
  it('not in any customer route, email, invoice, PDF or quote builder', () => {
    const offenders: string[] = [];
    for (const [path, src] of sources) {
      if (!CUSTOMER_FACING_PREFIXES.some((p) => path.startsWith(p))) continue;
      if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) continue;
      const clean = stripComments(src);
      if (clean.includes(TABLE) || /shop-callouts|ShopCallout/.test(clean)) offenders.push(path);
    }
    expect(
      offenders,
      'A customer-facing module references shop callouts. A callout is an internal ' +
        'instruction to the machine operator and is never part of what a customer receives.'
    ).toEqual([]);
  });

  it('the customer-facing prefixes are real directories, so the scan is looking at something', () => {
    // The same self-check as above: a typo'd prefix would make the test vacuous.
    const covered = CUSTOMER_FACING_PREFIXES.filter((p) =>
      Array.from(sources.keys()).some((k) => k.startsWith(p))
    );
    expect(
      CUSTOMER_FACING_PREFIXES.filter((p) => !covered.includes(p)),
      'These customer-facing prefixes match no file — fix the prefix rather than leaving the scan blind'
    ).toEqual([]);
  });
});

describe('shop callouts — every query names its columns', () => {
  const dataModule = sources.get('lib/data/shop-callouts.ts') ?? '';

  it('never selects *', () => {
    // `select('*')` would ship a future column to every existing reader
    // without anybody choosing to, which is what makes "no customer-facing
    // path returns a callout" an unmaintainable claim rather than a property.
    expect(stripComments(dataModule)).not.toMatch(/select\(\s*['"`]\*/);
  });

  it('filters soft-deleted rows in exactly one module', () => {
    // The same discipline lib/data/shop-library.ts applies to
    // shop_profile_library: `deleted_at IS NULL` lives in one place so a
    // deleted note disappears from every surface at once.
    const routesWithDeletedAt = Array.from(sources.entries()).filter(
      ([path, src]) =>
        path.startsWith('app/api/') && path.includes('shop-callouts') && stripComments(src).includes("'deleted_at'")
    );
    expect(routesWithDeletedAt.map(([p]) => p)).toEqual([]);
  });
});

describe('shop callouts — a failure is never dressed up as an empty list', () => {
  const dataModule = sources.get('lib/data/shop-callouts.ts') ?? '';
  const panel = sources.get('components/admin/ShopCalloutsPanel.tsx') ?? '';

  it('the data module never returns the database’s own error text to a caller', () => {
    // Found live on 2026-10-06: a failed save put "Could not find the table
    // 'public.shop_callouts' in the schema cache" in front of an estimator.
    // CLAUDE.md rule #30 — no stack traces, say what did NOT happen.
    const clean = stripComments(dataModule);
    expect(clean).not.toContain('error: error.message');
    expect(clean).not.toContain('error?.message');
  });

  it('the panel never renders its empty state while the read was unreadable', () => {
    // The dangerous direction: an operator reading "No shop notes on this job."
    // when the truth is that nobody could tell.
    const clean = stripComments(panel);
    expect(clean).toContain("state === 'ready' && !set?.unreadable && callouts.length === 0");
    expect(clean).toContain('data-testid="shop-callouts-unreadable"');
  });

  it('every reader of the set is forced by the type to handle unreadable', () => {
    // `unreadable` is a required field on ShopCalloutSet, so a new reader that
    // ignores it does not compile into an empty-state render by accident.
    const types = stripComments(sources.get('lib/shop-callouts/types.ts') ?? '');
    expect(types).toContain('unreadable: boolean;');
    expect(types).toContain('CALLOUTS_UNREADABLE_MESSAGE');
  });
});

describe('shop callouts — the write routes are admin-only and the read route is not public', () => {
  const create = sources.get('app/api/admin/shop-callouts/route.ts') ?? '';
  const edit = sources.get('app/api/admin/shop-callouts/[id]/route.ts') ?? '';
  const read = sources.get('app/api/shop-callouts/[shopJobId]/route.ts') ?? '';

  it('both admin routes check the role server-side', () => {
    for (const [name, src] of [['create', create], ['edit', edit]] as const) {
      const clean = stripComments(src);
      expect(clean, `${name} must read the role from the session`).toContain("from('profiles')");
      expect(clean, `${name} must refuse a non-admin`).toContain('403');
      // CLAUDE.md rule #22 one layer up — SESSION_STATE.md 2026-10-03 records
      // an admin GET served from Next's route cache to a signed-out caller.
      expect(clean, `${name} must declare force-dynamic`).toContain("export const dynamic = 'force-dynamic'");
    }
  });

  it('the shop read allows operator as well as admin, and writes nothing', () => {
    const clean = stripComments(read);
    expect(clean).toContain("role !== 'admin' && role !== 'operator'");
    // READ-ONLY. There must be no writing verb in this file at all.
    expect(clean).not.toMatch(/export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)/);
  });

  it('neither write route takes company or author from the request body', () => {
    // The validator does not parse those names at all (see validate.test.ts).
    // Here: no route may read them off a body even if the validator changed.
    for (const src of [create, edit]) {
      const clean = stripComments(src);
      expect(clean).not.toMatch(/body\.(companyId|company_id|createdBy|created_by)/);
      expect(clean).not.toMatch(/raw\.(companyId|company_id|createdBy|created_by)/);
    }
  });
});
