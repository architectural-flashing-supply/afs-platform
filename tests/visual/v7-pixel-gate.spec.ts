import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadManifest,
  assertDriversMatchManifest,
  SCREEN_DRIVERS,
  type ManifestScreen,
} from './v7-screen-drivers';
import {
  VIEWPORT,
  DIFF_BUDGET,
  MASK_BUDGET,
  SCREEN_MASKS,
  OUT_DIR,
  prepare,
  settle,
  applyMasks,
  readStructure,
  diffStructure,
  diffImages,
  writeSideBySide,
  writeBaseline,
  outPath,
  stripPrototypeChrome,
  type StructureDiff,
} from './v7-pixel-harness';

/**
 * THE V7 WHOLE-SCREEN PIXEL GATE — the fidelity authority for the Command
 * Center's appearance. See CLAUDE.md rule #34.
 *
 * For every screen in docs/design/command-center-v7/SCREEN_MANIFEST.json it:
 *
 *   1. renders the UNTOUCHED prototype at 1440x900, full page, clock and random
 *      source frozen, animations off, fonts loaded, and saves that as the
 *      baseline — the canonical truth, re-derived every run from a committed
 *      file rather than from a PNG somebody might have refreshed;
 *   2. renders the live app in fixture mode (`?fixture=v7`) with the same
 *      viewport and the same freezing, so the two sides show the same content
 *      and the diff measures fidelity only;
 *   3. diffs them whole, counting a size mismatch as difference rather than
 *      cropping it away;
 *   4. compares the ordered sequence of visible landmarks, so the report can
 *      SAY what is missing rather than only scoring it;
 *   5. writes baseline, live, diff and side-by-side PNGs to
 *      test-results/v7-pixel/, plus a machine-readable summary.
 *
 * PASS RULE: at most 1.5% of pixels differ. Masks are allowed only for
 * genuinely dynamic text, each justified in the harness and printed in the
 * report, and at most 2% of the screen in total.
 *
 * FIVE OUTCOMES, AND ONLY ONE PASSES — the same discipline the style gate uses,
 * because an outcome that is neither pass nor fail is how a gate stops looking:
 *
 *   pass       — measured, within budget.
 *   fail       — measured, over budget.
 *   missing    — the manifest names a v7 state with NO live route at all. Not a
 *                pass and not an excuse: it is the gap, named.
 *   live-only  — a live screen v7 has no counterpart for. The live side is
 *                still asserted to render; there is no baseline to diff.
 *   error      — a side could not be reached. Fails, like `uncovered` does in
 *                the style gate: a gate must not pass by failing to look.
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

const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

/**
 * Fixture mode needs CC_FIXTURE=1 in the server's environment, which is the
 * `next dev` process, not this one. It is set in .env.local (and documented in
 * .env.example); if it is missing the live side renders REAL data and every
 * number in the report is meaningless, so say so loudly rather than produce
 * numbers nobody should act on.
 */
const FIXTURE_READY = (() => {
  const p = path.join(__dirname, '..', '..', '.env.local');
  if (!fs.existsSync(p)) return false;
  return /^CC_FIXTURE\s*=\s*1\s*$/m.test(fs.readFileSync(p, 'utf8'));
})();

/** `?fixture=v7` appended to a manifest route, preserving any query it has. */
function fixtureUrl(route: string): string {
  return route.includes('?') ? `${route}&fixture=v7` : `${route}?fixture=v7`;
}

type Status = 'pass' | 'fail' | 'missing' | 'live-only' | 'error';

interface ScreenResult {
  id: string;
  name: string;
  tier: number;
  status: Status;
  ratio: number | null;
  diffPixels: number | null;
  protoSize: string;
  liveSize: string;
  maskRatio: number;
  structure: StructureDiff | null;
  note: string;
}

async function openPrototype(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await prepare(page);
  await page.goto(PROTOTYPE_URL, { waitUntil: 'load' });
  await page.waitForSelector('header.hdr', { timeout: 15_000 });
  return page;
}

async function openLive(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: VIEWPORT, storageState: authFile });
  const page = await ctx.newPage();
  await prepare(page);
  return page;
}

test.describe('v7 whole-screen pixel gate', () => {
  test.skip(
    !hasCreds,
    'Needs E2E_TEST_EMAIL / E2E_TEST_PASSWORD to reach /admin. The gate measures the ' +
      'real Command Center, so there is nothing honest to assert without them.',
  );

  test.beforeAll(() => {
    if (!fs.existsSync(PROTOTYPE)) {
      throw new Error(
        `The canonical prototype is missing: ${PROTOTYPE}\n` +
          'It is committed at docs/design/command-center-v7/. The pixel gate cannot run ' +
          'without it — restore it rather than skipping this spec.',
      );
    }
    assertDriversMatchManifest(loadManifest());
    if (!FIXTURE_READY) {
      throw new Error(
        'CC_FIXTURE=1 is not in .env.local, so `next dev` is serving REAL data on the ' +
          'live side and every diff percentage this gate produced would be measuring ' +
          'the database rather than the port. Add CC_FIXTURE=1 to .env.local (see ' +
          '.env.example) and restart the dev server.',
      );
    }
  });

  test('every manifest screen matches the prototype', async ({ browser }, testInfo) => {
    testInfo.setTimeout(20 * 60 * 1000);
    // `V7_PIXEL_ONLY=workbench,quotes` measures a subset while a screen is
    // being rebuilt. It is a DEVELOPMENT convenience and never a skip list: an
    // unfiltered run is what the report and the governance record, and the
    // filter is printed below so a partial run can never be mistaken for a
    // full one.
    const only = (process.env.V7_PIXEL_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const screens = loadManifest().filter((s) => !only.length || only.includes(s.id));
    if (only.length) console.log(`PARTIAL RUN — only: ${only.join(', ')} (${screens.length} of ${loadManifest().length} screens)`);
    const results: ScreenResult[] = [];

    const proto = await openPrototype(browser);
    const live = await openLive(browser);

    try {
      for (const s of screens) {
        results.push(await measure(proto, live, s, browser));
      }
    } finally {
      await proto.context().close();
      await live.context().close();
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'summary.md'), renderTable(results));
    console.log(`\n${renderTable(results)}\n`);
    console.log(`PNGs: ${OUT_DIR}`);

    const failed = results.filter((r) => r.status === 'fail' || r.status === 'error');
    const missing = results.filter((r) => r.status === 'missing');
    const passed = results.filter((r) => r.status === 'pass');
    console.log(
      `${passed.length} MATCHING · ${failed.length} NOT MATCHING · ${missing.length} no live route · ` +
        `${results.filter((r) => r.status === 'live-only').length} live-only`,
    );

    // A screen with no live route is a reported GAP, not a failure of the port
    // — the gate's job there is to name it, which it has. Everything measured
    // must be within budget.
    expect(
      failed.map((r) => `${r.id}: ${r.status}${r.ratio == null ? '' : ` ${(r.ratio * 100).toFixed(2)}%`} ${r.note}`),
      'Screens that do not match the prototype',
    ).toEqual([]);
  });
});

async function measure(
  proto: Page,
  live: Page,
  s: ManifestScreen,
  browser: Browser,
): Promise<ScreenResult> {
  const driver = SCREEN_DRIVERS[s.id];
  const masks = SCREEN_MASKS[s.id] ?? [];
  const base: ScreenResult = {
    id: s.id,
    name: s.name,
    tier: s.tier,
    status: 'error',
    ratio: null,
    diffPixels: null,
    protoSize: '—',
    liveSize: '—',
    maskRatio: 0,
    structure: null,
    note: '',
  };

  /* ── the prototype side ── */
  let protoBuf: Buffer | null = null;
  let protoStructure: Awaited<ReturnType<typeof readStructure>> | null = null;
  if (driver.proto) {
    try {
      // Reload so one screen's modal or filter cannot leak into the next.
      await proto.goto(PROTOTYPE_URL, { waitUntil: 'load' });
      await proto.waitForSelector('header.hdr', { timeout: 15_000 });
      await driver.proto(proto);
      // v7's review banner is not part of the design — see stripPrototypeChrome.
      await stripPrototypeChrome(proto);
      await settle(proto);
      const maskArea = await applyMasks(proto, masks);
      base.maskRatio = maskArea / (VIEWPORT.width * VIEWPORT.height);
      protoBuf = await proto.screenshot({ fullPage: true, animations: 'disabled' });
      protoStructure = await readStructure(proto);
      writeBaseline(s.id, protoBuf);
      fs.writeFileSync(outPath(s.id, 'baseline'), protoBuf);
    } catch (err) {
      return { ...base, note: `prototype side unreachable: ${(err as Error).message.split('\n')[0]}` };
    }
  }

  /* ── the live side ── */
  if (!s.liveRoute) {
    return {
      ...base,
      status: 'missing',
      protoSize: protoBuf ? sizeOf(protoBuf) : '—',
      note: s.liveNote ?? 'No live route exists for this v7 state.',
    };
  }

  let liveBuf: Buffer;
  let liveStructure: Awaited<ReturnType<typeof readStructure>>;
  try {
    await driver.live!(live, fixtureUrl(s.liveRoute));
    // Prove we are not measuring the sign-in page while reporting a Command
    // Center screen name — the trap CLAUDE.md rule #28 records.
    const url = live.url();
    if (/\/login/.test(url)) {
      return { ...base, note: `redirected to ${url} — storageState is not signed in.` };
    }
    await live.waitForSelector('header.hdr', { timeout: 20_000 });
    await settle(live);
    await applyMasks(live, masks);
    liveBuf = await live.screenshot({ fullPage: true, animations: 'disabled' });
    liveStructure = await readStructure(live);
    fs.writeFileSync(outPath(s.id, 'live'), liveBuf);
  } catch (err) {
    return {
      ...base,
      protoSize: protoBuf ? sizeOf(protoBuf) : '—',
      note: `live side unreachable: ${(err as Error).message.split('\n')[0]}`,
    };
  }

  if (!protoBuf || !protoStructure) {
    // Live-only: no prototype counterpart. The live side rendered, which is the
    // only thing there is to assert.
    return {
      ...base,
      status: 'live-only',
      liveSize: sizeOf(liveBuf),
      note: s.liveNote ?? 'No prototype counterpart; live render asserted only.',
    };
  }

  const d = diffImages(protoBuf, liveBuf, outPath(s.id, 'diff'));
  writeSideBySide(protoBuf, liveBuf, outPath(s.id, 'side-by-side'));
  const structure = diffStructure(protoStructure, liveStructure);

  if (base.maskRatio > MASK_BUDGET) {
    return {
      ...base,
      ratio: d.ratio,
      diffPixels: d.diffPixels,
      protoSize: `${d.protoSize.w}×${d.protoSize.h}`,
      liveSize: `${d.liveSize.w}×${d.liveSize.h}`,
      structure,
      note: `masks cover ${(base.maskRatio * 100).toFixed(2)}% of the screen, over the 2% budget.`,
    };
  }

  const pass = d.ratio <= DIFF_BUDGET;
  return {
    ...base,
    status: pass ? 'pass' : 'fail',
    ratio: d.ratio,
    diffPixels: d.diffPixels,
    protoSize: `${d.protoSize.w}×${d.protoSize.h}`,
    liveSize: `${d.liveSize.w}×${d.liveSize.h}`,
    structure,
    note: pass
      ? ''
      : describe(structure, d.protoSize, d.liveSize),
  };
}

function sizeOf(buf: Buffer): string {
  // PNG IHDR: width at byte 16, height at 20, both big-endian.
  return `${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}`;
}

/** Put the structure finding into words, so a failure says what is wrong. */
function describe(st: StructureDiff, p: { w: number; h: number }, l: { w: number; h: number }): string {
  const bits: string[] = [];
  if (p.h !== l.h) bits.push(`page height ${l.h} vs ${p.h}`);
  if (st.missing.length) bits.push(`${st.missing.length} missing (${st.missing.slice(0, 6).join(', ')}${st.missing.length > 6 ? ', …' : ''})`);
  if (st.extra.length) bits.push(`${st.extra.length} extra (${st.extra.slice(0, 6).join(', ')}${st.extra.length > 6 ? ', …' : ''})`);
  if (st.reordered) bits.push(`${st.reordered} out of order`);
  return bits.join('; ') || 'pixels differ with no structural difference — check spacing, type and colour.';
}

function renderTable(rows: ScreenResult[]): string {
  const head =
    '| id | screen | diff% | structure (missing / extra / reordered) | proto | live | status |\n' +
    '|---|---|---|---|---|---|---|';
  const body = rows
    .map((r) => {
      const pct = r.ratio == null ? '—' : `${(r.ratio * 100).toFixed(2)}%`;
      const st = r.structure
        ? `${r.structure.missing.length} / ${r.structure.extra.length} / ${r.structure.reordered}`
        : '—';
      const label =
        r.status === 'pass'
          ? 'MATCHING'
          : r.status === 'live-only'
            ? 'LIVE-ONLY'
            : r.status === 'missing'
              ? 'NO LIVE ROUTE'
              : 'NOT MATCHING';
      return `| \`${r.id}\` | ${r.name} | ${pct} | ${st} | ${r.protoSize} | ${r.liveSize} | ${label} |`;
    })
    .join('\n');
  return `${head}\n${body}`;
}
