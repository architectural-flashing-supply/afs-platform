import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  VIEWPORT,
  V8_BASELINE_DIR,
  assertContractIntact,
  loadContract,
  openContractState,
  statesFor,
  writeV8Baseline,
} from './v8-contract';

/**
 * V8 CONTRACT BASELINES — one full-page PNG per approved state.
 *
 * Captures every state in docs/design/command-center-v8/CONTRACT_MANIFEST.json
 * at 1440x900, full page, clock and random source frozen, animations off, fonts
 * loaded, into tests/visual/v8-baselines/.
 *
 * WHAT A BASELINE IS HERE, AND WHAT IT IS NOT. It is a RENDER OF A COMMITTED
 * FILE, re-derived on every run. It is not an expectation that can be
 * "updated" when a screen stops matching it — the same discipline rule #34
 * records for v7, and for the same reason: the moment a baseline becomes
 * something a session may refresh, a failing gate turns into a two-line fix and
 * stops being a gate.
 *
 * So there is no update mode, and there does not need to be one: if the
 * contract file changes, contract-check fails the build first, and the only way
 * past that is Reid's own re-baseline. The PNGs follow from the HTML, never the
 * other way round.
 *
 * FIVE STATES, AND WHY THE LAST TWO ARE SEPARATE CAPTURES. Shop View's job
 * screen and its full-size drawing overlay are not visible in the file's
 * load state — `job()` hides the queue and `openFull()` raises an overlay. A
 * baseline set that only photographed each file as it loads would have no
 * picture of the two screens the V8 work is mostly about, so the gate for them
 * could never be more than "the file exists".
 */

test.use({ viewport: VIEWPORT });

test.describe('V8 contract baselines', () => {
  test('every approved contract state captures a full-page baseline', async ({ page }) => {
    assertContractIntact();
    const contract = loadContract();
    const states = statesFor();
    expect(states.length).toBeGreaterThan(0);

    const captured: { id: string; file: string; bytes: number; size: string }[] = [];

    for (const state of states) {
      await openContractState(page, state);

      // The driven states must actually be in the state they claim, or the
      // baseline is a photograph of the undriven file under a name that says
      // otherwise — the exact failure a gate is supposed to prevent.
      if (state.drive.startsWith('job:')) {
        const jobId = state.drive.slice(4);
        await expect(page.locator(`#jv-${jobId}`)).toBeVisible();
        await expect(page.locator('#qv')).toBeHidden();
      }
      if (state.drive.startsWith('full:')) {
        await expect(page.locator('#full')).toBeVisible();
        await expect(page.locator('#fs svg')).toHaveCount(1);
      }

      const buf = await page.screenshot({ fullPage: true, animations: 'disabled' });
      const p = writeV8Baseline(state.id, buf);
      const dims = await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      }));
      captured.push({
        id: state.id,
        file: path.basename(state.file),
        bytes: fs.statSync(p).size,
        size: `${dims.w}x${dims.h}`,
      });
    }

    const lines = [
      `V8 contract baselines — ${contract.contractVersion}, approved ${contract.approvedOn} by ${contract.approvedBy}`,
      `viewport ${VIEWPORT.width}x${VIEWPORT.height}, full page`,
      '',
      ...captured.map((c) => `  ${c.id.padEnd(20)} ${c.size.padEnd(12)} ${String(c.bytes).padStart(8)} bytes   ${c.file}`),
      '',
      `  ${captured.length} baselines in ${path.relative(path.join(__dirname, '..', '..'), V8_BASELINE_DIR)}`,
    ].join('\n');
    // eslint-disable-next-line no-console
    console.log(lines);
    fs.writeFileSync(path.join(V8_BASELINE_DIR, 'MANIFEST.txt'), `${lines}\n`, 'utf8');

    expect(captured).toHaveLength(states.length);
    for (const c of captured) expect(c.bytes).toBeGreaterThan(5_000);
  });
});
