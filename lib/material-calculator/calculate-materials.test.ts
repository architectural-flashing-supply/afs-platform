import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ACCESSORY_PER_LF_REQUIRED,
  FIXTURE_ACCESSORY_SET,
} from '@/tests/fixtures/material-calculator';
import { MATERIAL_CALCULATOR_CONFIG } from './config';
import { calculateMaterials } from './index';
import type { MaterialCalcInput } from './types';

const LIBRARY_DIR = join(process.cwd(), 'lib', 'material-calculator');
const ROUTE_FILE = join(process.cwd(), 'app', 'api', 'calculator', 'materials', 'route.ts');

function librarySourceFiles(): Array<{ name: string; source: string }> {
  return readdirSync(LIBRARY_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, source: readFileSync(join(LIBRARY_DIR, name), 'utf8') }));
}

/**
 * THE ORCHESTRATOR — SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1 + §2.2 + §2.3 composed.
 *
 * The interesting part is WHICH QUANTITY FEEDS WHICH CALCULATION. §2.2's parameter
 * is `orderedQtyLf` and §2.3's worked example says `orderedLf`, and the spec never
 * says whether either means the raw or the waste-adjusted figure. These tests pin
 * the answer so a later change has to argue with an assertion instead of a comment.
 */
describe('calculateMaterials — composition', () => {
  it('feeds accessories the BILLED footage, not the raw footage', () => {
    // ARRANGE — 100 LF raw becomes 110 LF billed. One roll per 20 LF is 5 rolls on
    // the raw figure and 6 on the billed one.
    const input: MaterialCalcInput = {
      lengthFt: 10,
      quantity: 10,
      accessories: [FIXTURE_ACCESSORY_PER_LF_REQUIRED],
    };

    // ACT
    const result = calculateMaterials(input);

    // ASSERT
    expect(
      result.accessories.required[0].calculatedQty,
      `Accessories must be computed on the 110 LF that is actually being ordered, giving ` +
        `6 rolls. Computing on the raw 100 LF would give 5 and leave the waste footage ` +
        `unsealed — §2.1 calls the adjusted figure the billed quantity, and §2.2's ` +
        `parameter is named orderedQtyLf. Got ${result.accessories.required[0].calculatedQty}.`
    ).toBe(6);
  });

  it('feeds stock optimization the RAW footage, matching the shipped trim optimizer', () => {
    // ARRANGE — components/quote/TrimLengthOptimizerSection.tsx passes
    // lengthFt * quantity, so 100 LF at a 10 ft stock length is 11 pieces
    // (100 / (10 - 0.0208) = 10.02 -> 11). On the billed 110 LF it would be 12.
    const input: MaterialCalcInput = { lengthFt: 10, quantity: 10, stockLengthFt: 10 };

    // ACT
    const result = calculateMaterials(input);

    // ASSERT
    expect(
      result.stockOptimization?.piecesOrdered,
      `§2.3 must cut for the raw 100 LF, giving 11 pieces, because the already-live ` +
        `TrimLengthOptimizerSection does exactly that and this item does not change a ` +
        `shipped screen's numbers. Recorded as EES deviation D-2 / UNRESOLVED-3. ` +
        `Got ${result.stockOptimization?.piecesOrdered}.`
    ).toBe(11);
  });

  it('passes the config kerf allowance into the stock calculation', () => {
    // ARRANGE — a 10 ft stock length minus the kerf is 9.9792 ft usable, so a
    // 9.99 LF need takes two pieces rather than one
    const input: MaterialCalcInput = { lengthFt: 9.99, quantity: 1, stockLengthFt: 10 };

    // ACT
    const result = calculateMaterials(input);

    // ASSERT
    expect(
      result.stockOptimization?.piecesOrdered,
      `9.99 LF exceeds the ${10 - MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt} ft a 10 ft ` +
        `stick yields after a ${MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt} ft kerf, so two ` +
        `pieces are needed. If this says 1, the kerf is not reaching the formula. ` +
        `Got ${result.stockOptimization?.piecesOrdered}.`
    ).toBe(2);
  });

  it('returns null stock optimization when no stock length is on file', () => {
    // ARRANGE — five of the wizard's profile labels have no product_profiles row
    // ACT
    const omitted = calculateMaterials({ lengthFt: 10, quantity: 10 });
    const explicitNull = calculateMaterials({ lengthFt: 10, quantity: 10, stockLengthFt: null });

    // ASSERT
    expect(
      omitted.stockOptimization,
      `With no stock length §2.3 must return null so the section hides, rather than ` +
        `inventing a stock length. Got ${JSON.stringify(omitted.stockOptimization)}.`
    ).toBeNull();
    expect(
      explicitNull.stockOptimization,
      `An explicit null must behave the same as an omitted field — getProfileStockLengths ` +
        `returns null for a profile with no standard_length_ft.`
    ).toBeNull();
  });

  it('returns three empty accessory arrays when no accessory rows were supplied', () => {
    // ARRANGE — the real situation today: product_accessories is unseeded
    // ACT
    const result = calculateMaterials({ lengthFt: 10, quantity: 10 });

    // ASSERT
    expect(
      result.accessories,
      `With no accessory rows the three arrays must be empty, not undefined and not a ` +
        `placeholder list. Got ${JSON.stringify(result.accessories)}.`
    ).toEqual({ required: [], optional: [], uncalculable: [] });
  });

  it('composes all three sections in one result for a fully-specified order', () => {
    // ARRANGE
    const input: MaterialCalcInput = {
      lengthFt: 10,
      quantity: 10,
      wasteFactorMultiplier: 1.1,
      stockLengthFt: 10,
      accessories: FIXTURE_ACCESSORY_SET,
    };

    // ACT
    const result = calculateMaterials(input);

    // ASSERT
    expect(
      {
        billed: result.waste.adjustedQtyLf,
        requiredCount: result.accessories.required.length,
        optionalCount: result.accessories.optional.length,
        refusedCount: result.accessories.uncalculable.length,
        pieces: result.stockOptimization?.piecesOrdered ?? null,
        estimated: result.waste.isEstimated,
      },
      `One call must produce all three of the spec's sections. Expected 110 LF billed, ` +
        `2 required, 1 optional, 1 refused (the per_sqft row), 11 stock pieces, and ` +
        `estimated false because a real multiplier was supplied. ` +
        `Got ${JSON.stringify(result)}.`
    ).toEqual({
      billed: 110,
      requiredCount: 2,
      optionalCount: 1,
      refusedCount: 1,
      pieces: 11,
      estimated: false,
    });
  });
});

describe('calculateMaterials — determinism', () => {
  it('returns a deeply equal result on 100 successive calls with the same input', () => {
    // ARRANGE
    const input: MaterialCalcInput = {
      lengthFt: 10.5,
      quantity: 7,
      stockLengthFt: 10,
      accessories: FIXTURE_ACCESSORY_SET,
    };

    // ACT
    const first = calculateMaterials(input);
    const repeats = Array.from({ length: 99 }, () => calculateMaterials(input));

    // ASSERT
    for (const [index, repeat] of repeats.entries()) {
      expect(
        repeat,
        `Call ${index + 2} of 100 differed from the first. This library feeds a quote a ` +
          `customer is billed against: the same order must always produce the same ` +
          `quantities. Got ${JSON.stringify(repeat)} versus ${JSON.stringify(first)}.`
      ).toEqual(first);
    }
  });

  it('keeps no state between calls with different inputs', () => {
    // ARRANGE
    const a: MaterialCalcInput = { lengthFt: 10, quantity: 10, accessories: FIXTURE_ACCESSORY_SET };
    const b: MaterialCalcInput = { lengthFt: 25, quantity: 3, stockLengthFt: 12 };

    // ACT
    const firstA = calculateMaterials(a);
    calculateMaterials(b);
    const secondA = calculateMaterials(a);

    // ASSERT
    expect(
      secondA,
      `Interleaving a different order must not change this one's answer. Shared state ` +
        `between calls would make the wizard's displayed quantities depend on what the ` +
        `last customer asked for. Got ${JSON.stringify(secondA)} versus ${JSON.stringify(firstA)}.`
    ).toEqual(firstA);
  });

  it('does not mutate the input object', () => {
    // ARRANGE
    const input: MaterialCalcInput = {
      lengthFt: 10,
      quantity: 10,
      accessories: FIXTURE_ACCESSORY_SET,
    };
    const snapshot = JSON.stringify(input);

    // ACT
    calculateMaterials(input);

    // ASSERT
    expect(
      JSON.stringify(input),
      `The caller's input must come back untouched. app/quote/page.tsx holds this state in ` +
        `React and a mutation would desynchronise the form from what was calculated.`
    ).toBe(snapshot);
  });

  it('does not mutate the caller\'s accessories array', () => {
    // ARRANGE — calculateAccessories sorts, and sort() is in-place on the array it is
    // given
    const accessories = [...FIXTURE_ACCESSORY_SET].reverse();
    const originalOrder = accessories.map((a) => a.accessoryId);

    // ACT
    calculateMaterials({ lengthFt: 10, quantity: 10, accessories });

    // ASSERT
    expect(
      accessories.map((a) => a.accessoryId),
      `The caller's array must not be reordered in place. Got ` +
        `${JSON.stringify(accessories.map((a) => a.accessoryId))}, expected ` +
        `${JSON.stringify(originalOrder)}.`
    ).toEqual(originalOrder);
  });
});

/**
 * STATIC GUARDS. These read the source files rather than calling them, because
 * each one asserts something about the SHAPE of the code that no runtime test can
 * see — and each one is a rule that, if broken, breaks quietly.
 */
describe('static guard — the library is pure', () => {
  const FORBIDDEN: ReadonlyArray<[string, RegExp, string]> = [
    ['fetch', /\bfetch\s*\(/, 'a network call makes the result depend on something outside the input'],
    ['Date.now', /\bDate\.now\s*\(/, 'a clock read makes two identical orders compute differently'],
    ['new Date', /\bnew\s+Date\s*\(/, 'a clock read makes two identical orders compute differently'],
    ['Math.random', /\bMath\.random\s*\(/, 'a random source makes the quantities unreproducible'],
    ['a Supabase client', /from\s+['"][^'"]*supabase[^'"]*['"]/, 'the database belongs in lib/data/, so every formula stays unit-testable without one'],
  ];

  for (const [label, pattern, why] of FORBIDDEN) {
    it(`contains no ${label} in any source file`, () => {
      // ARRANGE
      const files = librarySourceFiles();

      // ACT
      const offenders = files.filter((file) => pattern.test(file.source)).map((f) => f.name);

      // ASSERT
      expect(
        offenders,
        `lib/material-calculator/ must stay pure: ${why}. Found ${label} in ` +
          `${JSON.stringify(offenders)}. Move it to lib/data/ or to the API route.`
      ).toEqual([]);
    });
  }

  it('reads at least six source files, so the guard cannot pass by finding nothing', () => {
    // ARRANGE / ACT
    const files = librarySourceFiles();

    // ASSERT
    expect(
      files.length >= 6,
      `The purity guard scans lib/material-calculator/*.ts. It found only ${files.length} ` +
        `files (${JSON.stringify(files.map((f) => f.name))}). A guard that looks at nothing ` +
        `passes everything — if the directory moved, fix LIBRARY_DIR.`
    ).toBe(true);
  });
});

describe('static guard — one waste-factor formula, one stock-length formula', () => {
  it('the old lib/utils/material-calc.ts is gone from disk', () => {
    // ARRANGE — its contents moved to waste.ts. A re-export shim left behind would
    // be exactly the two-sources-of-truth drift this move exists to prevent, so the
    // file must be absent rather than emptied.
    // ACT / ASSERT
    expect(
      existsSync(join(process.cwd(), 'lib', 'utils', 'material-calc.ts')),
      `lib/utils/material-calc.ts must not exist. §2.1 now lives only in ` +
        `lib/material-calculator/waste.ts, and a second module exporting the same formula ` +
        `is how the two drift apart.`
    ).toBe(false);
  });

  it('no source file IMPORTS the old module', () => {
    // ARRANGE — a comment may name the old path (several do, explaining the move);
    // an import statement may not, and only an import can actually resolve.
    const roots = ['app', 'components', 'lib', 'scripts', 'tests'];
    const importsOldModule = /(?:from|require\s*\(|import\s*\()\s*['"][^'"]*utils\/material-calc['"]/;
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          if (importsOldModule.test(readFileSync(join(process.cwd(), rel), 'utf8'))) {
            offenders.push(rel);
          }
        }
      }
    }
    for (const root of roots) walk(root);

    // ACT / ASSERT
    expect(
      offenders,
      `Nothing may import lib/utils/material-calc. Found ${JSON.stringify(offenders)}. ` +
        `Point it at '@/lib/material-calculator' instead.`
    ).toEqual([]);
  });

  it('the import guard really scans the tree, so it cannot pass by finding nothing', () => {
    // ARRANGE — the same walk, looking for an import that definitely exists
    const importsNewModule = /from\s*['"][^'"]*material-calculator['"]/;
    const found: string[] = [];

    function walk(dir: string): void {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          if (importsNewModule.test(readFileSync(join(process.cwd(), rel), 'utf8'))) found.push(rel);
        }
      }
    }
    for (const root of ['app', 'components', 'lib', 'tests']) walk(root);

    // ACT / ASSERT
    expect(
      found.length >= 3,
      `The walk must reach real files. It found only ${found.length} importers of ` +
        `'@/lib/material-calculator' (${JSON.stringify(found)}); at minimum ` +
        `WasteFactorDisplay, the API route and the data module import it. A walk that ` +
        `visits nothing would make the guard above vacuous.`
    ).toBe(true);
  });

  it('the library imports the shipped trim optimizer rather than reimplementing §2.3', () => {
    // ARRANGE
    const index = readFileSync(join(LIBRARY_DIR, 'index.ts'), 'utf8');

    // ACT / ASSERT
    expect(
      index.includes("from '@/lib/utils/trim-optimizer'"),
      `§2.3's formula already exists in lib/utils/trim-optimizer.ts for ` +
        `SPEC_TRIM_LENGTH_OPTIMIZER.md and is already wired into the wizard. index.ts must ` +
        `import it, so there is exactly one stock-length formula in the repository.`
    ).toBe(true);

    // No file here may compute a piece count or a cut list itself. validate.ts needs
    // the piece count for its resource guard and IMPORTS stockPiecesNeeded from the
    // trim optimizer to get it — so the test looks for the arithmetic, not the word.
    const reimplemented = librarySourceFiles().filter((file) => {
      const code = file.source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      return (
        /Math\.ceil\s*\([^)]*\/\s*\(?\s*stockLength/.test(code) ||
        /usableLengthFt\s*=/.test(code) ||
        /cutList\s*[:=]/.test(code)
      );
    });
    expect(
      reimplemented.map((f) => f.name),
      `No file here may contain its own cut-list or piece-count arithmetic — import ` +
        `stockPiecesNeeded / optimizeTrimLength instead. Found ` +
        `${JSON.stringify(reimplemented.map((f) => f.name))}.`
    ).toEqual([]);

    expect(
      readFileSync(join(LIBRARY_DIR, 'validate.ts'), 'utf8').includes(
        "import { stockPiecesNeeded } from '@/lib/utils/trim-optimizer'"
      ),
      `validate.ts's resource guard must get the piece count from the same function ` +
        `optimizeTrimLength uses. Two copies of that expression would be two answers to ` +
        `the same question, and the guard could pass while the thing it guards overflows.`
    ).toBe(true);
  });
});

describe('static guard — no money anywhere, and no service role in the route', () => {
  it('no library type or source mentions a price', () => {
    // ARRANGE — CLAUDE.md rule #1: AFS is an RFQ platform and the customer sees no
    // dollar amount before AFS issues the formal quote
    const money = /\b(price|priceCents|cost|costCents|amountDue|totalPrice|unitPrice|subtotal|dollars|usd)\b/i;
    const files = librarySourceFiles();

    // ACT
    const offenders = files
      .filter((file) => {
        // Strip comments: the headers legitimately explain WHY there is no pricing
        // here, and matching those would make this guard impossible to satisfy.
        const code = file.source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        return money.test(code);
      })
      .map((f) => f.name);

    // ASSERT
    expect(
      offenders,
      `The Auto Material Calculator computes QUANTITIES ONLY. A money field here would be ` +
        `a customer-facing price before AFS has set one, which CLAUDE.md rule #1 forbids ` +
        `outright. Found ${JSON.stringify(offenders)}.`
    ).toEqual([]);
  });

  it('the API route never reaches for the service-role Supabase client', () => {
    // ARRANGE — lib/supabase/admin.ts bypasses RLS, and RLS is what keeps
    // pricing_rules admin-only and keeps a guest from reading the accessory catalog
    const source = readFileSync(ROUTE_FILE, 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // ACT / ASSERT
    expect(
      code.includes('supabase/admin'),
      `app/api/calculator/materials/route.ts must not import lib/supabase/admin.ts. The ` +
        `service role would let a guest read the whole accessory catalog and would expose ` +
        `admin-only pricing_rules.waste_factor to a customer.`
    ).toBe(false);
    expect(
      code.includes('SERVICE_ROLE'),
      `The route must not name a service-role key either.`
    ).toBe(false);
    expect(
      source.includes("from '@/lib/supabase/server'"),
      `The route must read through lib/supabase/server.ts — the anon key plus the ` +
        `caller's own cookies — so Postgres RLS decides what the caller may see.`
    ).toBe(true);
  });
});

describe('MATERIAL_CALCULATOR_CONFIG — the one place the undefined numbers live', () => {
  it('holds the spec-defined 1.10 default', () => {
    // ARRANGE / ACT / ASSERT
    expect(
      MATERIAL_CALCULATOR_CONFIG.defaultWasteFactorMultiplier,
      `SPEC §2.1: "Default until data received: 1.10 (10%)". Changing this silently ` +
        `changes every quantity the quote wizard displays.`
    ).toBe(1.1);
  });

  it('refuses per_sqft and supports exactly the three methods the spec switches on', () => {
    // ARRANGE / ACT / ASSERT
    expect(
      [...MATERIAL_CALCULATOR_CONFIG.supportedCalcMethods],
      `§2.2's switch handles per_lf, per_piece and fixed. Got ` +
        `${JSON.stringify(MATERIAL_CALCULATOR_CONFIG.supportedCalcMethods)}.`
    ).toEqual(['per_lf', 'per_piece', 'fixed']);
    expect(
      [...MATERIAL_CALCULATOR_CONFIG.uncalculableCalcMethods],
      `per_sqft is permitted by the database CHECK but has no formula and no area input, ` +
        `so it must be listed as uncalculable rather than quietly defaulting to 1 the way ` +
        `the spec's own switch does. Got ` +
        `${JSON.stringify(MATERIAL_CALCULATOR_CONFIG.uncalculableCalcMethods)}.`
    ).toEqual(['per_sqft']);
  });

  it('covers all four database calc_method values between the two lists', () => {
    // ARRANGE — migration 001's CHECK: ('per_lf','per_piece','per_sqft','fixed')
    const covered = [
      ...MATERIAL_CALCULATOR_CONFIG.supportedCalcMethods,
      ...MATERIAL_CALCULATOR_CONFIG.uncalculableCalcMethods,
    ].sort();

    // ACT / ASSERT
    expect(
      covered,
      `Every value product_accessories.calc_method can hold must be either supported or ` +
        `explicitly refused. A value in neither list would fall through to whatever the ` +
        `switch did last. Got ${JSON.stringify(covered)}.`
    ).toEqual(['fixed', 'per_lf', 'per_piece', 'per_sqft']);
  });

  it('keeps the waste-factor band ordered and inclusive of the spec default', () => {
    // ARRANGE
    const { minimumWasteFactorMultiplier: min, maximumWasteFactorMultiplier: max, defaultWasteFactorMultiplier: def } =
      MATERIAL_CALCULATOR_CONFIG;

    // ACT / ASSERT
    expect(
      min < max && min <= def && def <= max,
      `The band must be ordered and must contain the spec's own default, or the default ` +
        `itself would be rejected by validation. Got min ${min}, default ${def}, max ${max}.`
    ).toBe(true);
  });
});
