import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  V7_COMPONENT_MAP,
  COMPARED_PROPERTIES,
  LENGTH_PROPERTIES,
  LENGTH_TOLERANCE_PX,
  EXPECTED_STAGE_COVERAGE,
  SHELL_VIEWPORTS,
  SCREENSHOT_VIEWPORTS,
  type V7ComponentPair,
  type ComparedProperty,
} from './v7-component-map';
import { isAllowedColorDeviation, cssColorToHex } from './v7-color-deviations';

/**
 * THE V7 STYLE GATE — the acceptance test for the Command Center's appearance.
 *
 * It opens prototype v7 and the live app side by side in the same browser and
 * compares the COMPUTED styles of every component pair in
 * tests/visual/v7-component-map.ts. Lengths match within 1px; colours,
 * families, keywords and shadows must match exactly, unless the pair is a
 * documented WCAG deviation (tests/visual/v7-color-deviations.ts).
 *
 * WHY COMPUTED STYLE AND NOT A SCREENSHOT DIFF. The live app shows real data
 * where v7 shows samples, so pixels legitimately differ — a screenshot diff
 * would be all false positives and would have to be thresholded until it
 * asserted nothing. Computed style is the part that must be identical: the same
 * font at the same size and weight on the same background with the same border,
 * radius, shadow and padding. Screenshots are still saved, for a human to look
 * at, by the `fidelity` test at the bottom — as evidence, not as the assertion.
 *
 * TWO TRAPS THIS FILE IS WRITTEN AROUND, both found the hard way in earlier runs
 * and recorded in SESSION_STATE.md:
 *
 *  1. The prototype is a local file. Building its `file://` URL by hand on
 *     Windows produces something Chromium will not load, and the symptom is a
 *     30-second navigation timeout on EVERY test rather than an error. It is
 *     built with `pathToFileURL` here, and `beforeAll` asserts the file exists
 *     before any test runs so a missing file fails in one place with a clear
 *     message.
 *  2. The prototype's page functions are NOT globals, so `page.evaluate(() =>
 *     pageWorkbench())` fails silently. Pages are reached by CLICKING the
 *     prototype's own `[data-go]` nav, which is also what a user does.
 *
 *  3. (Live side.) Every /admin route redirects a signed-out visitor to
 *     /login. Without `storageState` this spec would measure the SIGN-IN page
 *     while reporting Command Center component names — the precise trap
 *     CLAUDE.md rule #28 records. `storageState` is set below, and each live
 *     page load asserts it really is on an /admin URL before measuring.
 */

const PROTOTYPE = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'design',
  'command-center-v7',
  'AFS_Command_Center_Prototype_v7.html',
);
const PROTOTYPE_URL = pathToFileURL(PROTOTYPE).href;
const authFile = 'tests/e2e/.auth/user.json';
const SHOTS = path.join(__dirname, '..', '..', 'test-results', 'v7-fidelity');

const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

test.use({ storageState: authFile });

test.beforeAll(() => {
  if (!fs.existsSync(PROTOTYPE)) {
    throw new Error(
      `The canonical prototype is missing: ${PROTOTYPE}\n` +
        'It is committed at docs/design/command-center-v7/. The style gate cannot ' +
        'run without it — restore it rather than skipping this spec.',
    );
  }
});

/**
 * next/font rewrites a family to a hashed name like
 * `__Barlow_Semi_Condensed_a1b2c3`, with a `..._Fallback_...` sibling. The
 * prototype, loading the same families from Google, reports the plain name.
 * Normalising lets the gate assert the TYPEFACE rather than excuse the
 * difference: `__Barlow_Semi_Condensed_a1b2c3` -> `barlow semi condensed`.
 */
export function normaliseFontFamily(stack: string): string {
  const first = stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const unhashed = first
    .replace(/^__/, '')
    .replace(/_Fallback_[0-9a-f]+$/i, '')
    .replace(/_[0-9a-f]{6,}$/i, '');
  return unhashed.replace(/_/g, ' ').trim().toLowerCase();
}

/**
 * Properties that only have an appearance when a related property is non-zero,
 * or when the element actually renders something. Comparing them otherwise
 * reports differences that cannot be seen, which would force a skip list and
 * end with the gate asserting nothing.
 *
 * TWO CASES, both found by running this gate against the real port:
 *
 * 1. ZERO-WIDTH BORDERS. Tailwind's Preflight sets `border-style: solid` and
 *    `border-color: #e5e7eb` on every element, with `border-width: 0`. v7's
 *    reset is only `box-sizing`, so its elements report `border-style: none`
 *    and `border-color: currentColor`. Every element in the app therefore
 *    "differs" on six border properties while rendering no border at all — a
 *    border of width 0 paints nothing whatever its style and colour. So style
 *    and colour are compared only on an edge whose WIDTH is non-zero, and the
 *    width itself is always compared.
 *
 * 2. INHERITED TEXT COLOUR ON CONTAINERS. The app's `<body>` sets
 *    `text-afs-chrome-mid`; v7's sets `--ink`. A container that holds no text
 *    of its own — the header bar, its inner row, the brand lockup, the nav
 *    group, `main.wrap` — inherits one or the other and renders neither,
 *    because every text-bearing descendant sets its own colour (and the gate
 *    checks those descendants separately). `color` is therefore compared only
 *    on an element with a direct, non-whitespace text node.
 *
 * Both rules are narrow and mechanical, and neither can hide a visible defect:
 * give an element a real border, or real text, and its colour is compared again.
 */
function appearanceApplies(
  prop: ComparedProperty,
  side: { style: Record<string, string>; hasOwnText: boolean },
): boolean {
  const edge = prop.match(/^border(Top|Right|Bottom|Left)(Style|Color)$/);
  if (edge) {
    const width = parseFloat(side.style[`border${edge[1]}Width`] ?? '0');
    return Number.isFinite(width) && width > 0;
  }
  if (prop === 'color') return side.hasOwnText;
  return true;
}

/** Compare one property value, returning null when acceptable or a reason when not. */
function difference(prop: ComparedProperty, protoValue: string, liveValue: string): string | null {
  if (prop === 'fontFamily') {
    const a = normaliseFontFamily(protoValue);
    const b = normaliseFontFamily(liveValue);
    return a === b ? null : `font-family head "${b}" != v7 "${a}"`;
  }

  if (protoValue === liveValue) return null;

  if (LENGTH_PROPERTIES.has(prop)) {
    const a = parseFloat(protoValue);
    const b = parseFloat(liveValue);
    // `normal` letter-spacing / line-height parse to NaN; then only an exact
    // string match counts, which the check above already did.
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= LENGTH_TOLERANCE_PX
        ? null
        : `${prop} ${liveValue} != v7 ${protoValue} (>${LENGTH_TOLERANCE_PX}px)`;
    }
    return `${prop} ${liveValue} != v7 ${protoValue}`;
  }

  // Colour-valued properties may differ only as a documented WCAG deviation.
  if (/color/i.test(prop)) {
    if (isAllowedColorDeviation(protoValue, liveValue)) return null;
    return `${prop} ${cssColorToHex(liveValue)} != v7 ${cssColorToHex(protoValue)}`;
  }

  return `${prop} "${liveValue}" != v7 "${protoValue}"`;
}

interface Measured {
  style: Record<string, string>;
  /** Whether the element has a direct, non-whitespace text node of its own. */
  hasOwnText: boolean;
}

/** Read the compared properties off one element. */
async function computed(page: Page, selector: string): Promise<Measured | null> {
  return page.evaluate(
    ({ sel, props }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const style: Record<string, string> = {};
      for (const p of props) style[p] = (cs as unknown as Record<string, string>)[p] ?? '';
      // Border widths are needed to decide whether a border's style and colour
      // have any appearance, even when not in the compared set.
      for (const edge of ['Top', 'Right', 'Bottom', 'Left']) {
        const key = `border${edge}Width`;
        style[key] = (cs as unknown as Record<string, string>)[key] ?? '';
      }
      const hasOwnText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
      );
      return { style, hasOwnText };
    },
    { sel: selector, props: COMPARED_PROPERTIES as unknown as string[] },
  );
}

/** Put the prototype on the page a pair lives on, by clicking its own nav. */
async function gotoPrototypePage(page: Page, protoPage: string | null) {
  await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
  // The prototype renders into #app on load; wait for its header to exist.
  await page.waitForSelector('header.hdr', { timeout: 10_000 });
  if (protoPage) {
    const link = page.locator(`[data-go="${protoPage}"]`).first();
    await expect(
      link,
      `The prototype has no [data-go="${protoPage}"] control to reach that page.`,
    ).toBeAttached();
    await link.click();
    await page.waitForSelector('header.hdr', { timeout: 10_000 });
  }
  // Both sides must load the same two families before any font-size or family
  // is read, or the gate measures a fallback metric.
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
}

async function gotoLivePage(page: Page, livePath: string) {
  await page.goto(livePath, { waitUntil: 'domcontentloaded' });
  // Trap 3: prove we are not measuring the sign-in page.
  await expect(page, `Expected to stay on ${livePath}; a redirect means storageState is not signed in.`)
    .toHaveURL(new RegExp(`${livePath.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}`));
  await page.waitForSelector('header.hdr', { timeout: 15_000 });
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
}

interface PairResult {
  pair: V7ComponentPair;
  status: 'pass' | 'fail' | 'uncovered' | 'no-proto';
  problems: string[];
}

test.describe('v7 style gate', () => {
  test.skip(
    !hasCreds,
    'Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD to reach /admin. The gate measures ' +
      'the real Command Center, so there is nothing honest to assert without them.',
  );

  // One browser context for the prototype, one for the live app, so a pair is
  // compared at the same viewport without reloading either side per property.
  test('every mapped component matches the prototype', async ({ browser }, testInfo) => {
    testInfo.setTimeout(240_000);
    const results: PairResult[] = [];

    const protoCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const liveCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: authFile,
    });
    const protoPage = await protoCtx.newPage();
    const livePage = await liveCtx.newPage();

    try {
      // Group by page so each side navigates once per page, not once per pair.
      const byPage = new Map<string, V7ComponentPair[]>();
      for (const pair of V7_COMPONENT_MAP) {
        const k = `${pair.protoPage ?? ''}|${pair.livePath}`;
        if (!byPage.has(k)) byPage.set(k, []);
        byPage.get(k)!.push(pair);
      }

      for (const [, pairs] of byPage) {
        await gotoPrototypePage(protoPage, pairs[0].protoPage);
        await gotoLivePage(livePage, pairs[0].livePath);

        for (const pair of pairs) {
          if (pair.requiresData) {
            results.push({ pair, status: 'uncovered', problems: [pair.requiresData] });
            continue;
          }

          if (pair.open) {
            // Reveal on both sides. Re-navigating first keeps one pair's open
            // menu from covering the next pair's target.
            await protoPage.locator(pair.open.proto).first().click();
            await livePage.locator(pair.open.live).first().click();
          }

          const a = await computed(protoPage, pair.proto);
          const b = await computed(livePage, pair.live);

          if (pair.absentInPrototype) {
            // No counterpart to compare against, but the LIVE element must
            // still be there — otherwise this field would quietly excuse a
            // component that was never built.
            results.push({
              pair,
              status: b ? 'no-proto' : 'fail',
              problems: b
                ? [pair.absentInPrototype]
                : [
                    `live selector "${pair.live}" matched nothing on ${pair.livePath} ` +
                      '(and the prototype has no counterpart, so nothing was compared)',
                  ],
            });
          } else if (!a) {
            results.push({
              pair,
              status: 'uncovered',
              problems: [`prototype selector "${pair.proto}" matched nothing`],
            });
          } else if (!b) {
            results.push({
              pair,
              status: 'fail',
              problems: [`live selector "${pair.live}" matched nothing on ${pair.livePath}`],
            });
          } else {
            const problems: string[] = [];
            for (const prop of COMPARED_PROPERTIES) {
              if (pair.skip?.[prop]) continue;
              // A property with no appearance on EITHER side is not compared —
              // see appearanceApplies. If it has appearance on one side only,
              // it IS compared, so a border appearing or vanishing still fails.
              if (!appearanceApplies(prop, a) && !appearanceApplies(prop, b)) continue;
              const d = difference(prop, a.style[prop] ?? '', b.style[prop] ?? '');
              if (d) problems.push(d);
            }
            results.push({ pair, status: problems.length ? 'fail' : 'pass', problems });
          }

          if (pair.open) {
            // Close both menus again (Escape is what v7 and the live component
            // both listen for) so the next pair starts from a clean page.
            await protoPage.keyboard.press('Escape');
            await livePage.keyboard.press('Escape');
          }
        }
      }
    } finally {
      await protoCtx.close();
      await liveCtx.close();
    }

    // THE REPORT. Printed whether or not the gate passes, because "which pairs
    // were checked" is as much the deliverable as the pass/fail.
    const pad = (s: string, n: number) => s.padEnd(n);
    const lines = [
      '',
      'V7 STYLE GATE — COMPONENT PAIRS',
      `prototype: ${path.relative(process.cwd(), PROTOTYPE).replace(/\\/g, '/')}`,
      '',
      `${pad('KEY', 22)}${pad('STAGE', 6)}${pad('STATUS', 10)}COMPONENT`,
    ];
    for (const r of results) {
      lines.push(
        `${pad(r.pair.key, 22)}${pad(r.pair.stage, 6)}${pad(r.status.toUpperCase(), 10)}${r.pair.label}`,
      );
      for (const p of r.problems) lines.push(`${' '.repeat(38)}- ${p}`);
    }
    const failed = results.filter((r) => r.status === 'fail');
    const uncovered = results.filter((r) => r.status === 'uncovered');
    const noProto = results.filter((r) => r.status === 'no-proto');
    lines.push(
      '',
      `${results.length} pairs checked · ` +
        `${results.length - failed.length - uncovered.length - noProto.length} pass · ` +
        `${failed.length} fail · ${uncovered.length} uncovered · ` +
        `${noProto.length} live-only (no prototype counterpart)`,
      '',
    );
    const report = lines.join('\n');
    console.log(report);
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(path.join(SHOTS, 'style-gate-report.txt'), report);
    await testInfo.attach('v7-style-gate-report', { body: report, contentType: 'text/plain' });

    // An uncovered pair is a gate that did not look, which rule #28's `0
    // unresolved` principle treats as a failure, not a pass.
    expect(
      uncovered.map((r) => `${r.pair.key}: ${r.problems.join('; ')}`),
      'Some mapped components could not be measured. The gate must not pass by failing to look.',
    ).toEqual([]);
    expect(
      failed.map((r) => `${r.pair.key}: ${r.problems.join('; ')}`),
      'Live components differ from prototype v7.',
    ).toEqual([]);
  });

  test('coverage: every stage contributes the components it claims', () => {
    const counted: Record<string, number> = {};
    for (const p of V7_COMPONENT_MAP) counted[p.stage] = (counted[p.stage] ?? 0) + 1;
    for (const [stage, expected] of Object.entries(EXPECTED_STAGE_COVERAGE)) {
      expect(
        counted[stage] ?? 0,
        `Stage ${stage} should map ${expected} components. Building a screen without ` +
          'adding its components to v7-component-map.ts would otherwise pass by omission.',
      ).toBe(expected);
    }
    // Keys must be unique — the report is indexed by them.
    const keys = V7_COMPONENT_MAP.map((p) => p.key);
    expect(new Set(keys).size, 'Duplicate component key in v7-component-map.ts').toBe(keys.length);
  });

  test('the shell holds its shape at 1920, 1440, 1280 and 900', async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000);
    const findings: string[] = [];

    for (const vp of SHELL_VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: authFile,
      });
      const page = await ctx.newPage();
      try {
        await gotoLivePage(page, '/admin/command-center');

        // The header must not spill horizontally, and the nav must stay on one
        // row down to 900 (where v7 wraps it deliberately).
        const overflow = await page.evaluate(() => {
          const el = document.scrollingElement!;
          return el.scrollWidth - el.clientWidth;
        });
        if (overflow > 1) findings.push(`${vp.label}: page scrolls horizontally by ${overflow}px`);

        // Every nav item is present and clickable at every width.
        const navCount = await page.locator('header.hdr nav.nav a').count();
        if (navCount !== 7) findings.push(`${vp.label}: ${navCount} nav items, expected 7`);

        // The one red action button is visible at every width.
        const nqb = page.locator('header.hdr .nqb');
        if (!(await nqb.isVisible())) findings.push(`${vp.label}: "+ New quote" is not visible`);
      } finally {
        await ctx.close();
      }
    }

    expect(findings, 'The shell breaks at one of the four named widths.').toEqual([]);
  });

  test('fidelity: side-by-side screenshots at 1440x900 and 1280x800', async ({
    browser,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    fs.mkdirSync(SHOTS, { recursive: true });
    const saved: string[] = [];

    // One screenshot pair per mapped live route, deduplicated.
    const routes = [...new Set(V7_COMPONENT_MAP.map((p) => p.livePath))];
    const protoPages = [...new Set(V7_COMPONENT_MAP.map((p) => p.protoPage ?? 'workbench'))];

    for (const vp of SCREENSHOT_VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: authFile,
      });
      const page = await ctx.newPage();
      try {
        for (const route of routes) {
          await gotoLivePage(page, route);
          const name = `live--${route.replace(/\//g, '_').replace(/^_/, '')}--${vp.label}.png`;
          await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
          saved.push(name);
        }
        for (const pp of protoPages) {
          await gotoPrototypePage(page, pp === 'workbench' ? null : pp);
          const name = `v7--${pp}--${vp.label}.png`;
          await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
          saved.push(name);
        }
      } finally {
        await ctx.close();
      }
    }

    console.log(
      `\nv7 fidelity screenshots -> ${path.relative(process.cwd(), SHOTS).replace(/\\/g, '/')}\n` +
        saved.map((s) => `  ${s}`).join('\n') +
        '\n',
    );
    expect(saved.length).toBeGreaterThan(0);
  });
});
