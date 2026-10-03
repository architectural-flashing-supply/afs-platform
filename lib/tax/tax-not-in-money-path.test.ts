/**
 * TAX IS BUILT BUT NOT WIRED — enforcement test. EES-OVN.08 §8, AC-47, AC-48.
 *
 * ================== WHAT THIS GUARDS AND WHY ==================
 *
 * This item builds a complete sales-tax subsystem and deliberately connects it
 * to NOTHING a customer can see. The reason is not caution for its own sake —
 * the specs genuinely conflict about where tax belongs, and acting on either
 * reading would change a figure a customer has already approved:
 *
 *   - specs/SPEC_TAXJAR_INTEGRATION.md §1 says tax is a LINE ITEM ON THE FORMAL
 *     QUOTE, and also that it is "calculated at checkout".
 *   - specs/SPEC_CHECKOUT.md §2 says the quote shows Tax: "Calculated at
 *     checkout", i.e. the quote carries NO tax figure.
 *   - app/api/checkout/create-intent/route.ts charges
 *     `Math.round(quote.total * 100)`. A tax computed at checkout is by
 *     construction not in `quote.total`, so adding it would charge MORE than the
 *     figure the customer approved — against CLAUDE.md's business model, where
 *     the only dollar amounts a customer sees are on an AFS-generated quote.
 *
 * Which of those moves is a business decision for Reid (EES-OVN.08
 * UNRESOLVED-02), so nothing is wired and §14 of the EES specifies the
 * recommended option for whoever does it.
 *
 * ================== WHY A STATIC IMPORT TEST, NOT A FLAG TEST ==================
 *
 * The item asks, for the wired case, for a test proving flag-off output is
 * identical to today's. This is stronger. Flag-off identity is a property of one
 * code path at one moment; an import-graph assertion fails the moment anyone
 * connects the two subsystems, in ANY flag state, including a future refactor
 * that threads tax through a helper nobody thought of as a money path.
 *
 * Modelled directly on lib/integrations/pathfinder-single-door.test.ts, which
 * uses the same technique to keep four deleted doors to the bending machine from
 * coming back.
 *
 * ================== WHEN TAX *IS* DELIBERATELY WIRED ==================
 *
 * Do not add a file to GUARDED_PATHS' exceptions to make this pass. The right
 * change at that point is to DELETE the guarded entry being wired, in the same
 * commit as the wiring, with the quote/checkout decision recorded — so the test
 * stops guarding something that is no longer true instead of lying about it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'scripts'];
const SCAN_EXT = /\.(ts|tsx|mjs|cjs|js)$/;

/**
 * THE CUSTOMER MONEY PATH. Every one of these decides, displays, stores or
 * charges a figure a customer sees or pays. None of them may import lib/tax
 * while the quote-vs-checkout question is open.
 *
 * Each entry is a path PREFIX, matched with forward slashes.
 */
const GUARDED_PATHS: { prefix: string; why: string }[] = [
  {
    prefix: 'lib/pricing/',
    why: 'builds the quote totals a customer approves; quote-math.ts deliberately adds no tax today',
  },
  {
    prefix: 'lib/invoices/',
    why: 'copies the approved quote onto the invoice and writes tax_cents: 0 as a known literal',
  },
  {
    prefix: 'app/api/checkout/',
    why: 'creates the Stripe PaymentIntent from quote.total — the amount actually charged',
  },
  { prefix: 'app/checkout/', why: 'renders the figures the customer sees before paying' },
  {
    prefix: 'app/api/webhooks/stripe/',
    why: 'reconciles what was actually charged; a tax figure here could not change the charge anyway',
  },
  { prefix: 'lib/data/orders.ts', why: 'creates the order record from the approved quote' },
  { prefix: 'lib/data/invoices.ts', why: 'reads invoice money for the customer portal' },
  {
    prefix: 'app/account/',
    why: 'the customer portal, where a quote total is shown for approval',
  },
  {
    prefix: 'app/api/quote-approve/',
    why: "the customer's own approval of a quote — the figure is fixed by then",
  },
];

/**
 * Files that may import lib/tax. Everything in lib/tax itself, plus the admin
 * surfaces this item builds.
 */
const ALLOWED_PREFIXES = [
  'lib/tax/',
  'app/api/admin/tax-nexus/',
  'app/admin/settings/tax-nexus/',
  'components/admin/TaxNexusEditor.tsx',
];

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
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Strips comments so a doc-comment MENTIONING lib/tax is not mistaken for an
 * import of it. This file and several others legitimately discuss the module by
 * path in prose — including the EES reference in lib/tax/service.ts's own header.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function repoRelative(file: string): string {
  return relative(REPO_ROOT, file).split(sep).join('/');
}

/** Every real import/require specifier in a source file. */
function importSpecifiers(src: string): string[] {
  const code = stripComments(src);
  const found: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      const specifier = match[1];
      if (specifier !== undefined) found.push(specifier);
    }
  }
  return found;
}

/** True when a specifier resolves into lib/tax, by alias or by relative path. */
function pointsAtTaxModule(specifier: string, fromFile: string): boolean {
  if (specifier.startsWith('@/lib/tax')) return true;
  if (specifier === '@/lib/tax') return true;
  if (specifier.startsWith('.')) {
    const resolved = join(fromFile, '..', specifier);
    return repoRelative(resolved).startsWith('lib/tax/') || repoRelative(resolved) === 'lib/tax';
  }
  return false;
}

interface Offender {
  file: string;
  specifier: string;
  why: string;
}

function findOffenders(): { offenders: Offender[]; scanned: number; importers: string[] } {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(REPO_ROOT, dir)));
  const offenders: Offender[] = [];
  const importers: string[] = [];

  for (const file of files) {
    const rel = repoRelative(file);
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const taxImports = importSpecifiers(src).filter((s) => pointsAtTaxModule(s, file));
    if (taxImports.length === 0) continue;
    importers.push(rel);

    if (ALLOWED_PREFIXES.some((p) => rel === p || rel.startsWith(p))) continue;

    const guarded = GUARDED_PATHS.find((g) => rel === g.prefix || rel.startsWith(g.prefix));
    if (guarded) {
      for (const specifier of taxImports) {
        offenders.push({ file: rel, specifier, why: guarded.why });
      }
    }
  }

  return { offenders, scanned: files.length, importers };
}

describe('AC-47/AC-48: the customer money path does not import lib/tax', () => {
  it('scans a real, non-trivial set of files, so a pass is not an empty walk', () => {
    // ARRANGE / ACT
    const { scanned } = findOffenders();

    // ASSERT — a gate that passes by failing to look is the failure mode
    // CLAUDE.md rule #28 calls out, so the walk itself is asserted first.
    expect(
      scanned,
      `Only ${scanned} files were scanned. This test is worthless if the walk is broken, so it ` +
        'asserts its own reach before asserting anything about the results.'
    ).toBeGreaterThan(200);
  });

  it('no guarded file imports the tax engine', () => {
    // ACT
    const { offenders } = findOffenders();

    // ASSERT
    const report = offenders
      .map((o) => `  ${o.file} imports "${o.specifier}" — this file ${o.why}`)
      .join('\n');

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : 'A file in the customer money path imports lib/tax:\n' +
          report +
          '\n\nTax is deliberately NOT wired to any customer-facing figure in this item. ' +
          'specs/SPEC_TAXJAR_INTEGRATION.md §1 and specs/SPEC_CHECKOUT.md §2 disagree about whether ' +
          'tax belongs on the quote or is added at payment, and app/api/checkout/create-intent ' +
          'charges quote.total — so adding tax at checkout would charge more than the customer ' +
          'approved. That decision is EES-OVN.08 UNRESOLVED-02, for Reid.\n\n' +
          'If tax is now genuinely being wired: DELETE the guarded entry from GUARDED_PATHS in the ' +
          'same commit, with the decision recorded. Do NOT add the file to ALLOWED_PREFIXES — that ' +
          'would leave this test claiming to guard something it no longer does.'
    ).toEqual([]);
  });

  it('the Stripe charge is still computed from quote.total alone', () => {
    // ARRANGE — INV-02. Read the real route rather than trusting the import graph.
    const route = readFileSync(
      join(REPO_ROOT, 'app', 'api', 'checkout', 'create-intent', 'route.ts'),
      'utf8'
    );

    // ASSERT
    expect(
      route,
      'The charged amount must still be exactly quote.total in cents. If this line changed, a ' +
        'customer is being charged something other than the figure they approved.'
    ).toContain('amount: Math.round(quote.total * 100)');
    expect(
      /\btax\b/i.test(stripComments(route)),
      'app/api/checkout/create-intent/route.ts must contain no tax logic at all while UNRESOLVED-02 ' +
        'is open.'
    ).toBe(false);
  });

  it('the invoice still writes tax_cents: 0 as a known literal', () => {
    // ARRANGE — INV-03. Recorded as UNRESOLVED-03: correct while tax is off,
    // and the first thing to change when it is switched on.
    const create = readFileSync(join(REPO_ROOT, 'lib', 'invoices', 'create.ts'), 'utf8');

    // ASSERT
    expect(
      create,
      'lib/invoices/create.ts must still write tax_cents: 0. It is a KNOWN literal, not a calculated ' +
        'zero, and EES-OVN.08 §14 step 8 is where it changes.'
    ).toContain('tax_cents: 0');
  });

  it('quote-math still adds no tax to a total', () => {
    // ARRANGE
    const math = readFileSync(join(REPO_ROOT, 'lib', 'pricing', 'quote-math.ts'), 'utf8');

    // ASSERT
    expect(
      math,
      'lib/pricing/quote-math.ts must still set totalCents to the subtotal. Its own comment records ' +
        'that freight and tax are not invented there because both are open data blockers.'
    ).toContain('totalCents: subtotalCents');
  });

  it('every importer of lib/tax is an admin surface or lib/tax itself', () => {
    // ACT
    const { importers } = findOffenders();

    // ASSERT — the positive form of the same rule, so an importer in a directory
    // nobody thought to guard is still surfaced.
    const unexpected = importers.filter(
      (rel) => !ALLOWED_PREFIXES.some((p) => rel === p || rel.startsWith(p))
    );

    expect(
      unexpected,
      unexpected.length === 0
        ? ''
        : `These files import lib/tax and are neither lib/tax nor a known admin surface:\n` +
          unexpected.map((f) => `  ${f}`).join('\n') +
          '\n\nGUARDED_PATHS is a deny-list and cannot name a directory nobody has thought of, so ' +
          'this assertion is the catch-all. If one of these is a legitimate new admin surface, add ' +
          'it to ALLOWED_PREFIXES. If it is a money path, it must not import lib/tax at all.'
    ).toEqual([]);
  });
});
