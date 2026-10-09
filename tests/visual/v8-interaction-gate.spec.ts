import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { prepare, settle } from './v7-pixel-harness';
import { VIEWPORT, assertContractIntact, contractFileUrl, loadContract } from './v8-contract';

/**
 * THE V8 DRAWING-INTERACTION GATE.
 *
 * The one behaviour V8 is mostly about: Steve clicks a profile thumbnail and
 * sees the drawing bigger; he double-clicks it and sees it full size with every
 * number on it. This gate is the executable form of that, and it is written
 * against the CONTRACT HTML first — so the gate is proved correct against the
 * approved design before it is ever pointed at the app.
 *
 * WHY THAT ORDER MATTERS. A gate written against the implementation records
 * what the implementation happens to do. Written against the contract, it
 * records what Reid approved, and the implementation has to come to it. The
 * contract's own script block is the specification:
 *
 *     document.addEventListener('click', e => {
 *       const t = e.target.closest('.zoom');
 *       if (!t || e.target.closest('.expbtn')) return;
 *       clearTimeout(tm);
 *       tm = setTimeout(() => openPop(t.dataset.k), 230);
 *     });
 *     document.addEventListener('dblclick', e => {
 *       const t = e.target.closest('.zoom');
 *       if (!t) return;
 *       clearTimeout(tm); openFull(t.dataset.k);
 *     });
 *
 * All three contract files carry that block byte-identically, which this gate
 * asserts rather than assumes — one contract, checked against all three, not
 * three near-copies drifting apart.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THE 230 ms IS A LOAD-BEARING NUMBER, NOT A NICETY.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * A double-click fires `click` twice before `dblclick`. Without the delay, the
 * first click would open the enlarged view and the double-click would then open
 * full size on top of it — two overlays for one gesture, and the user's
 * double-click reading as "he wanted both". The timer is what makes a
 * double-click a single intent. So this gate does not merely check that
 * double-click opens full size: it checks that the enlarge NEVER FIRES
 * AFTERWARDS, by waiting out the full delay again and asserting the enlarged
 * view is still closed. That is the assertion the naive implementation fails.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * WHAT "FULL SIZE" MUST CARRY, AND WHY THE COUNTS ARE DERIVED.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Every segment length, every interior angle, the hem labels, the developed
 * width, the painted-side marker and Steve's red shop note. The numbers are not
 * typed into this file — they are read out of each profile's own META entry in
 * the contract and checked as RELATIONSHIPS:
 *
 *     interior-angle labels   === META.bends
 *     "… hem" labels          === META.hems
 *     all length labels       === drawn segments + hem segments
 *     painted-side markers    === drawn segments + hem segments  (one per leg)
 *     developed width         === META.dev, printed in the overlay's own meta line
 *
 * Hardcoding "coping has five labels" would make this gate a transcription of
 * today's sample data, and it would have to be re-typed the first time a
 * drawing changed. Derived, it says the real thing: a leg without a dimension
 * on it is a leg the shop has to guess at.
 *
 * TWO CLAUSES COULD GO VACUOUS, AND BOTH ARE PINNED. Only two of the eight
 * contract profiles carry a shop note (`zbar`, `coping`) and only five carry a
 * hem, so "assert the note is there when there is one" would pass trivially if
 * a future contract had none. The gate therefore also asserts that the contract
 * CONTAINS at least one noted profile and at least one hemmed one — the same
 * premise-plus-fix discipline lib/design/placeholder-contrast.test.ts uses.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * HOW THIS BECOMES THE GATE FOR THE REAL SCREENS.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * `SURFACES` lists every place a profile thumbnail will be clickable. Contract
 * surfaces have a `file`; live surfaces have a `route`, which is `null` until
 * the phase that ports that screen. `EXPECTED_PORTED` is the number of live
 * surfaces that must be wired at the current phase, and it is asserted — so a
 * later phase cannot leave a screen unported and still see green, and this
 * phase cannot claim coverage it does not have. Phase 0 ports nothing: the
 * number is 0, every live surface is reported `not-ported`, and the report says
 * so in words rather than skipping the row.
 */

const REPO_ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'test-results', 'v8');

/** Which V8 phase this branch is at. Phase 0 = harness + audit, no screens. */
const PHASE = 0;

/**
 * Live surfaces required to be wired, per phase. Bumping a phase without
 * wiring its screen fails this gate, which is the intent: the number is a
 * commitment, not a description.
 */
const EXPECTED_PORTED: Record<number, number> = { 0: 0 };

interface Surface {
  id: string;
  label: string;
  /** A contract HTML file, relative to the repo root. */
  file?: string;
  /** A live app route. `null` until the phase that ports this screen. */
  route?: string | null;
  /** The phase that ports it. */
  phase: number;
}

const SURFACES: Surface[] = [
  {
    id: 'contract-workbench-b',
    label: 'Contract — Workbench (B)',
    file: 'docs/design/command-center-v8/Workbench_B-stage-strip-table.html',
    phase: 0,
  },
  {
    id: 'contract-email-two-pane',
    label: 'Contract — email two-pane (C)',
    file: 'docs/design/command-center-v8/Workbench_C-inbox-first.html',
    phase: 0,
  },
  {
    id: 'contract-shop-view',
    label: 'Contract — Shop View (E)',
    file: 'docs/design/command-center-v8/Workbench_E-shop-view.html',
    phase: 0,
  },
  { id: 'live-workbench', label: 'Live — Workbench', route: null, phase: 1 },
  { id: 'live-shop-view', label: 'Live — Shop View', route: null, phase: 2 },
  { id: 'live-email-two-pane', label: 'Live — email two-pane', route: null, phase: 3 },
  { id: 'live-deliveries', label: 'Live — Deliveries', route: null, phase: 4 },
  { id: 'live-customers', label: 'Live — Customers', route: null, phase: 4 },
  { id: 'live-quotes', label: 'Live — Quotes', route: null, phase: 4 },
  { id: 'live-orders', label: 'Live — Orders', route: null, phase: 4 },
  { id: 'live-search', label: 'Live — Search results', route: null, phase: 5 },
];

/** One profile's entry in a contract file's own META table. */
interface Meta {
  name: string;
  dev: string;
  bends: number;
  hems: number;
  mid: string;
  full: string;
}

/**
 * Read a contract file's META table out of its source.
 *
 * Read from the FILE rather than from `window.META` so the expectations cannot
 * be influenced by anything the page did at runtime — the gate's expected
 * values and the page's rendered values come from independent reads of the same
 * committed bytes.
 */
function readMeta(fileRel: string): Record<string, Meta> {
  const src = fs.readFileSync(path.join(REPO_ROOT, fileRel), 'utf8');
  const m = src.match(/const META=(\{[\s\S]*?\});\n/);
  if (!m) throw new Error(`No META table found in ${fileRel}`);
  return JSON.parse(m[1]) as Record<string, Meta>;
}

/** Counts derived from one profile's full-size SVG source. */
function expectedFromFull(full: string) {
  const count = (re: RegExp) => (full.match(re) ?? []).length;
  const segments = count(/stroke="#1553B3"/g);
  const hemSegments = count(/stroke="#C26A00" stroke-width="7"/g);
  return {
    segments,
    hemSegments,
    legs: segments + hemSegments,
    angleLabels: count(/fill="#17703A"/g),
    lengthLabels: count(/fill="#101C2C"/g),
    hemLabels: count(/hem<\/text>/g),
    paintedMarkers: count(/stroke-dasharray/g),
    shopNote: (full.match(/>(Steve:[^<]*)</) ?? [])[1] ?? null,
  };
}

/** The contract's shared handler block, as a fingerprint. */
function handlerFingerprint(fileRel: string): string {
  const src = fs.readFileSync(path.join(REPO_ROOT, fileRel), 'utf8');
  const start = src.indexOf("function closeAll(){pop.style.display");
  const end = src.indexOf("})();</script>");
  if (start < 0 || end < 0) throw new Error(`No zoom handler block found in ${fileRel}`);
  return src.slice(start, end);
}

/**
 * How many `.zoom` mount points a contract file has, counted from its source.
 *
 * THIS IS WHAT STOPS THE GATE PASSING BY LOOKING AT ONE THUMBNAIL. The visible
 * mounts differ per state — Shop View has six on the queue board and one inside
 * each of its three job screens, which are `display:none` until `job()` runs.
 * A gate that clicked whatever happened to be visible on load would exercise
 * six of nine and report success. So the total is counted from the file, every
 * state is driven, and the two numbers are asserted equal.
 */
function sourceZoomMounts(fileRel: string): number {
  const src = fs.readFileSync(path.join(REPO_ROOT, fileRel), 'utf8');
  return (src.match(/<div class="[^"]*\bzoom\b[^"]*"/g) ?? []).length;
}

/**
 * The states a contract file must be driven through to reach every mount.
 *
 * DERIVED FROM THE FILE, not a hand-kept list: `none` plus one `job:<id>` for
 * every `id="jv-…"` job screen the file defines. A new job screen in a future
 * contract is covered the moment it exists, and a hand list could not have
 * been wrong in a way anybody would notice.
 */
function driveStates(fileRel: string): string[] {
  const src = fs.readFileSync(path.join(REPO_ROOT, fileRel), 'utf8');
  const jobs = (src.match(/id="jv-([^"]*)"/g) ?? []).map((s) => s.replace(/^id="jv-/, '').replace(/"$/, ''));
  return ['none', ...jobs.map((j) => `job:${j}`)];
}

async function openContractFile(page: Page, fileRel: string, drive = 'none'): Promise<void> {
  await prepare(page);
  await page.goto(contractFileUrl(fileRel), { waitUntil: 'load' });
  await page.waitForSelector('body', { timeout: 15_000 });
  if (drive.startsWith('job:')) {
    await page.evaluate((id) => {
      (window as unknown as { job: (s: string) => void }).job(id);
    }, drive.slice(4));
  }
  await settle(page);
}

const contract = loadContract();
const DELAY = contract.interaction.singleClickDelayMs;
/** Comfortably past the open delay, so "not yet" and "never" are distinguishable. */
const PAST_DELAY = DELAY + 220;

test.use({ viewport: VIEWPORT });

test.describe('V8 drawing-interaction gate', () => {
  test.beforeAll(() => {
    assertContractIntact();
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test('all three contract files carry one identical zoom-handler contract', () => {
    const files = SURFACES.filter((s) => s.file).map((s) => s.file as string);
    expect(files.length).toBe(3);
    const prints = files.map((f) => handlerFingerprint(f));
    for (let i = 1; i < prints.length; i += 1) {
      expect(prints[i], `${files[i]} differs from ${files[0]}`).toBe(prints[0]);
    }
    // The spec this gate is written against, asserted to still be the spec.
    expect(prints[0]).toContain(`setTimeout(()=>openPop(k),${DELAY})`);
    expect(prints[0]).toContain("e.target.closest('.expbtn')");
    expect(prints[0]).toContain("if(e.key==='Escape')closeAll()");
  });

  for (const surface of SURFACES.filter((s) => s.file)) {
    const fileRel = surface.file as string;

    test(`${surface.label} — single click enlarges, double click goes full size`, async ({ page }) => {
      const meta = readMeta(fileRel);
      const totalMounts = sourceZoomMounts(fileRel);
      const states = driveStates(fileRel);
      let exercised = 0;
      let doubleClickProved = 0;

      for (const drive of states) {
        await openContractFile(page, fileRel, drive);
        const pop = page.locator('#pop');
        const full = page.locator('#full');
        const scrim = page.locator('#scrim');

        // Only the mounts VISIBLE in this state. The hidden ones belong to
        // another state and get their turn there; `exercised` proves it.
        const zooms = page.locator('.zoom:visible');
        const n = await zooms.count();

        for (let i = 0; i < n; i += 1) {
          const z = zooms.nth(i);
          const kind = (await z.getAttribute('data-k')) as string;
          await z.click({ position: { x: 4, y: 4 } });

          // Before the delay elapses, nothing has opened. This is what stops a
          // "click opens it immediately" implementation from passing.
          await expect(pop).toBeHidden();

          await page.waitForTimeout(PAST_DELAY);
          await expect(pop, `[${drive}] single click on .zoom[data-k=${kind}] must enlarge`).toBeVisible();
          await expect(full).toBeHidden();
          await expect(page.locator('#pt')).toHaveText(meta[kind].name);
          await expect(page.locator('#ps svg')).toHaveCount(1);

          await page.keyboard.press('Escape');
          await expect(pop).toBeHidden();
          await expect(scrim).toBeHidden();
          exercised += 1;
        }

        if (n === 0) continue;

        // ── a double-click goes straight to full size, and the enlarge never
        //    fires afterwards ───────────────────────────────────────────────
        const first = zooms.nth(0);
        const firstKind = (await first.getAttribute('data-k')) as string;
        await first.dblclick({ position: { x: 4, y: 4 } });
        await expect(full).toBeVisible();
        await expect(pop).toBeHidden();

        // THE TIMING ASSERTION. Wait out the whole open delay again: a
        // scheduled enlarge that was not cancelled would land here, on top of
        // the full-size view — the defect the 230 ms exists to prevent.
        await page.waitForTimeout(PAST_DELAY);
        await expect(pop, 'a double-click must not also fire the enlarge').toBeHidden();
        await expect(full).toBeVisible();
        await expect(page.locator('#ft')).toHaveText(meta[firstKind].name);
        doubleClickProved += 1;
      }

      // EVERY MOUNT IN THE FILE WAS CLICKED, across all its states.
      expect(
        exercised,
        `${fileRel}: ${totalMounts} .zoom mounts in the source, ${exercised} exercised. ` +
          'A mount reachable only in an undriven state is a mount nobody gated.',
      ).toBe(totalMounts);

      if (totalMounts === 0) {
        // APPARATUS WITHOUT A MOUNT. Workbench_C is this case in the approved
        // design: it carries the identical handlers, the #pop/#full overlays,
        // the META table and the legend, but mounts no drawing anywhere — the
        // email two-pane shows the attachment as a text chip. Recorded as a
        // finding rather than passed over, and the premise test below forbids
        // every file being like this.
        test.info().annotations.push({
          type: 'apparatus-only',
          description:
            `${fileRel} carries the full zoom/overlay apparatus but has no .zoom mount point. ` +
            'See docs/COMMAND_CENTER_V8_AUDIT.md.',
        });
      } else {
        expect(doubleClickProved).toBeGreaterThan(0);
      }
    });

    test(`${surface.label} — full size carries every number the shop needs`, async ({ page }) => {
      await openContractFile(page, fileRel);
      const meta = readMeta(fileRel);
      const kinds = Object.keys(meta);
      expect(kinds.length).toBeGreaterThan(0);

      let noted = 0;
      let hemmed = 0;

      for (const kind of kinds) {
        const m = meta[kind];
        const want = expectedFromFull(m.full);

        await page.evaluate((k) => {
          (window as unknown as { openFullBtn: (s: string) => void }).openFullBtn(k);
        }, kind);
        await expect(page.locator('#full')).toBeVisible();

        const svg = page.locator('#fs svg');
        await expect(svg).toHaveCount(1);

        // EVERY INTERIOR ANGLE. One label per bend — rule #12's signed interior
        // angle is the whole meaning of a bend, so a missing one is a missing
        // instruction, not a missing decoration.
        await expect(
          page.locator('#fs text[fill="#17703A"]'),
          `${kind}: one interior-angle label per bend`,
        ).toHaveCount(m.bends);
        expect(want.angleLabels, `${kind}: contract itself must label every bend`).toBe(m.bends);

        // EVERY SEGMENT LENGTH, INCLUDING THE HEMS' OWN. One dimension per leg.
        await expect(
          page.locator('#fs text[fill="#101C2C"]'),
          `${kind}: one length label per leg (segments + hems)`,
        ).toHaveCount(want.legs);
        expect(want.lengthLabels).toBe(want.legs);

        // HEM LABELS, counted by the word the shop reads.
        const hemLabels = await page.locator('#fs text', { hasText: /hem$/ }).count();
        expect(hemLabels, `${kind}: ${m.hems} hem label(s)`).toBe(m.hems);
        expect(want.hemLabels).toBe(m.hems);
        if (m.hems > 0) hemmed += 1;

        // PAINTED-SIDE MARKER — the dashed amber run alongside each leg.
        await expect(
          page.locator('#fs line[stroke-dasharray]'),
          `${kind}: painted-side marker alongside every leg`,
        ).toHaveCount(want.paintedMarkers);
        expect(want.paintedMarkers).toBe(want.legs);

        // DEVELOPED WIDTH — in the overlay's own meta line, with the bend and
        // hem counts, pluralised as the contract pluralises them.
        const fm = (await page.locator('#fm').textContent()) ?? '';
        expect(fm, `${kind}: developed width`).toContain(`Developed width ${m.dev} in`);
        expect(fm).toContain(`${m.bends} bends`);
        expect(fm).toContain(`${m.hems} hem${m.hems === 1 ? '' : 's'}`);

        // STEVE'S RED SHOP NOTE, where the profile has one.
        if (want.shopNote) {
          noted += 1;
          await expect(
            page.locator('#fs text', { hasText: 'Steve:' }),
            `${kind}: Steve's shop note`,
          ).toHaveText(want.shopNote);
          await expect(page.locator('#fs rect[fill="#B3261E"]')).toHaveCount(1);
          await expect(page.locator('#fs line[stroke="#B3261E"]')).toHaveCount(1);
        } else {
          await expect(page.locator('#fs text', { hasText: 'Steve:' })).toHaveCount(0);
        }

        // The legend naming all five ink colours travels with the full view.
        await expect(page.locator('#full .leg')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.locator('#full')).toBeHidden();
      }

      // PREMISE CHECKS — without these, the two conditional clauses above could
      // pass a contract that had no shop notes and no hems at all.
      expect(noted, 'the contract must contain at least one shop-noted profile').toBeGreaterThan(0);
      expect(hemmed, 'the contract must contain at least one hemmed profile').toBeGreaterThan(0);
    });

    test(`${surface.label} — Esc, the close button and the scrim all close it`, async ({ page }) => {
      await openContractFile(page, fileRel);
      const pop = page.locator('#pop');
      const full = page.locator('#full');
      const scrim = page.locator('#scrim');
      const first = page.locator('.zoom:visible').nth(0);
      const hasMount = (await page.locator('.zoom:visible').count()) > 0;
      // Workbench_C mounts no drawing (see the coverage test's `apparatus-only`
      // annotation), so there is nothing to click there — but its overlays must
      // still close, and `openFullBtn` reaches them exactly as a ported screen
      // would. The close contract is gated on all three files either way.
      const kind = hasMount
        ? ((await first.getAttribute('data-k')) as string)
        : Object.keys(readMeta(fileRel))[0];

      if (hasMount) {
        // Enlarged view: close button.
        await first.click({ position: { x: 4, y: 4 } });
        await page.waitForTimeout(PAST_DELAY);
        await expect(pop).toBeVisible();
        await page.locator('#pc').click();
        await expect(pop).toBeHidden();
        await expect(scrim).toBeHidden();

        // Enlarged view: Escape.
        await first.click({ position: { x: 4, y: 4 } });
        await page.waitForTimeout(PAST_DELAY);
        await expect(pop).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(pop).toBeHidden();
      }

      // Full size: close button.
      await page.evaluate((k) => {
        (window as unknown as { openFullBtn: (s: string) => void }).openFullBtn(k);
      }, kind);
      await expect(full).toBeVisible();
      await page.locator('#fc').click();
      await expect(full).toBeHidden();
      await expect(scrim).toBeHidden();

      // Full size: Escape.
      await page.evaluate((k) => {
        (window as unknown as { openFullBtn: (s: string) => void }).openFullBtn(k);
      }, kind);
      await expect(full).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(full).toBeHidden();

      // Full size: the scrim behind it.
      await page.evaluate((k) => {
        (window as unknown as { openFullBtn: (s: string) => void }).openFullBtn(k);
      }, kind);
      await expect(full).toBeVisible();
      await scrim.click({ position: { x: 4, y: 4 } });
      await expect(full).toBeHidden();
      await expect(scrim).toBeHidden();
    });

    test(`${surface.label} — the expand button goes straight to full size`, async ({ page }) => {
      // The expand corner button lives on Shop View's per-job plate, which is
      // inside a `display:none` job screen until `job()` runs — so this test
      // walks the same derived state list rather than looking only at load.
      let found = 0;
      for (const drive of driveStates(fileRel)) {
        await openContractFile(page, fileRel, drive);
        const exp = page.locator('.expbtn:visible');
        const n = await exp.count();
        if (n === 0) continue;
        found += n;
        await exp.nth(0).click();
        await expect(page.locator('#full')).toBeVisible();
        // The handler returns early for `.expbtn`, so no enlarge may be pending
        // — the button must not leave a second overlay queued behind the first.
        await page.waitForTimeout(PAST_DELAY);
        await expect(page.locator('#pop')).toBeHidden();
        await page.keyboard.press('Escape');
        await expect(page.locator('#full')).toBeHidden();
      }
      if (found === 0) {
        // Reported, not silently skipped: this file genuinely has no expand
        // button in the approved design (only Shop View's plates carry one).
        test.info().annotations.push({
          type: 'no-expand-button',
          description: `${fileRel} has no .expbtn in the approved design`,
        });
      }
    });
  }

  /**
   * THE PREMISE BEHIND `apparatus-only`. One contract file (C) mounts no
   * drawing, which is a real fact about the approved design and is annotated
   * rather than failed. Without this test, a future contract in which NO file
   * mounted a drawing would sail through every zoom test above by having
   * nothing to click — the gate would be green and measuring nothing.
   */
  test('the contract mounts at least one clickable drawing somewhere', () => {
    const files = SURFACES.filter((s) => s.file).map((s) => s.file as string);
    const counts = files.map((f) => ({ f, n: sourceZoomMounts(f) }));
    // eslint-disable-next-line no-console
    console.log(
      ['V8 contract zoom mounts', ...counts.map((c) => `  ${String(c.n).padStart(3)}  ${path.basename(c.f)}`)].join('\n'),
    );
    expect(
      counts.reduce((a, c) => a + c.n, 0),
      'no contract file mounts a .zoom drawing — every zoom test would pass vacuously',
    ).toBeGreaterThan(0);
  });

  test('live surfaces: ported count matches the phase commitment', () => {
    const live = SURFACES.filter((s) => !s.file);
    const ported = live.filter((s) => s.route);
    const notPorted = live.filter((s) => !s.route);

    const lines = [
      `V8 interaction gate — phase ${PHASE}`,
      '',
      `  contract surfaces gated : ${SURFACES.filter((s) => s.file).length}`,
      `  live surfaces ported    : ${ported.length}`,
      `  live surfaces NOT ported: ${notPorted.length}`,
      '',
      ...notPorted.map((s) => `  not-ported  ${s.id.padEnd(22)} ${s.label}  (phase ${s.phase})`),
      ...ported.map((s) => `  ported      ${s.id.padEnd(22)} ${s.route}`),
      '',
    ].join('\n');
    // eslint-disable-next-line no-console
    console.log(lines);
    fs.writeFileSync(path.join(OUT_DIR, 'interaction-gate-coverage.txt'), `${lines}\n`, 'utf8');

    const want = EXPECTED_PORTED[PHASE];
    expect(want, `EXPECTED_PORTED has no entry for phase ${PHASE}`).toBeDefined();
    expect(
      ported.length,
      `phase ${PHASE} commits to ${want} ported live surface(s); found ${ported.length}. ` +
        'A phase that ports a screen must give it a route here in the same commit.',
    ).toBe(want);
  });
});
