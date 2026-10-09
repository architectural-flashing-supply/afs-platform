import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { prepare, settle } from './v7-pixel-harness';

/**
 * DOES `ProfileViewer` ACTUALLY RENDER? — the gap V8 phase 0 shipped with.
 *
 * Phase 0 proved the component's canvas call stream identical to FlashDraft's
 * renderer by unit test, and gave it NO mount point anywhere, so it had never
 * been rendered in a browser. A unit test on a recording fake context cannot
 * tell you that a real canvas came back null, that the DPR transform collapsed
 * the drawing to a corner, that the overlay opened behind the page, or that
 * nothing was painted at all. Those are exactly the failures that look like a
 * passing test and an empty box.
 *
 * So this spec drives the real component in a real browser against REAL saved
 * geometry, through `/studio/v8-viewer-debug`, and asserts the things a
 * call-stream test structurally cannot:
 *
 *   - the canvas has non-blank pixels, measured by reading them back
 *   - a single click opens the enlarged view and a double-click the full size,
 *     with the 230 ms discipline holding on a real event loop
 *   - the full-size view carries real labels, read out of the canvas as pixels
 *     of the label ink rather than as DOM text (it is a canvas; there is no text
 *     node to query)
 *   - the explicit "No saved drawing" state renders those words
 *
 * IT NEEDS REAL IDS AND SAYS SO WHEN IT HAS NONE. `V8_VIEWER_IDS` is a
 * comma-separated env var. Without it the spec SKIPS with a message naming what
 * to pass — it does not invent a profile, and it does not quietly pass. A real
 * saved profile belongs to a customer, so no id is committed in this file.
 *
 * Screenshots land in `test-results/v8-viewer/` and are the point as much as
 * the assertions are: three of the seven v7 defects were found by LOOKING
 * (rule #34), and this component had never been looked at.
 */

const OUT = path.join(__dirname, '..', '..', 'test-results', 'v8-viewer');
const IDS = (process.env.V8_VIEWER_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const authFile = 'tests/e2e/.auth/user.json';
const hasAuth = fs.existsSync(authFile);

test.use({ viewport: { width: 1440, height: 900 }, storageState: hasAuth ? authFile : undefined });

/**
 * Share of non-background pixels in a canvas, read back from the bitmap.
 *
 * `index` selects among matches with `querySelectorAll`. Playwright's `>> nth=`
 * is LOCATOR syntax and is not a valid CSS selector — passing it into
 * `querySelector` throws, which is how the first version of this helper failed.
 */
async function inkRatio(
  page: import('@playwright/test').Page,
  selector: string,
  index = 0,
): Promise<number> {
  return page.evaluate(({ sel, idx }) => {
    const c = document.querySelectorAll(sel)[idx] as HTMLCanvasElement | undefined;
    if (!c) return -1;
    const ctx = c.getContext('2d');
    if (!ctx) return -2;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let ink = 0;
    // FlashDraft's canvas ground is #C4C4C4. Anything meaningfully darker or
    // more saturated than the ground is drawn content.
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (r < 170 || spread > 24) ink += 1;
    }
    return ink / (c.width * c.height);
  }, { sel: selector, idx: index });
}

/** Count pixels close to a given hex, for reading canvas-drawn labels. */
async function pixelsNear(
  page: import('@playwright/test').Page,
  selector: string,
  hex: string,
  tol = 40,
  index = 0,
): Promise<number> {
  return page.evaluate(
    ({ sel, hex, tol, idx }) => {
      const c = document.querySelectorAll(sel)[idx] as HTMLCanvasElement | undefined;
      if (!c) return -1;
      const ctx = c.getContext('2d');
      if (!ctx) return -2;
      const want = [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - want[0]) <= tol &&
          Math.abs(data[i + 1] - want[1]) <= tol &&
          Math.abs(data[i + 2] - want[2]) <= tol
        ) {
          n += 1;
        }
      }
      return n;
    },
    { sel: selector, hex, tol, idx: index },
  );
}

test.describe('ProfileViewer, in a real browser, on real saved geometry', () => {
  test.skip(
    IDS.length === 0,
    'Set V8_VIEWER_IDS=<saved_configurations uuid>,<uuid> to run. No id is committed here — a saved profile is a customer\'s record.',
  );
  test.skip(!hasAuth, 'Needs the admin storageState from auth.setup.ts.');

  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('thumbnails paint, and the no-drawing state says so in words', async ({ page }) => {
    await prepare(page);
    await page.goto(`/studio/v8-viewer-debug?ids=${IDS.join(',')}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-v8-profile-canvas="thumb"]', { timeout: 20_000 });
    await settle(page);

    const thumbs = page.locator('[data-v8-profile-canvas="thumb"]');
    // Three viewers per id (initialData, fetched-by-id, 56px) must all paint.
    //
    // AUTO-RETRYING, because one of the three fetches its own geometry. A bare
    // `count()` here read 4 of 6 and failed the component for being slower than
    // one frame — the fetch-by-id instances had not resolved yet. That was this
    // test being wrong, not the viewer; `toHaveCount` waits for the state the
    // assertion is actually about.
    await expect(thumbs, 'every viewer instance should produce a thumbnail canvas').toHaveCount(
      IDS.length * 3,
    );
    const n = await thumbs.count();

    // THE ASSERTION A CALL-STREAM TEST CANNOT MAKE: real pixels exist.
    for (let i = 0; i < n; i += 1) {
      const ratio = await inkRatio(page, '[data-v8-profile-canvas="thumb"]', i);
      expect(ratio, `thumbnail ${i} is blank — the canvas painted nothing`).toBeGreaterThan(0.002);
    }

    // The server-read and the fetched-by-id paths must agree. If they ever
    // disagree they disagree here, not on a screen somebody is using.
    for (let i = 0; i < IDS.length; i += 1) {
      const a = await inkRatio(page, '[data-v8-profile-canvas="thumb"]', i * 3);
      const b = await inkRatio(page, '[data-v8-profile-canvas="thumb"]', i * 3 + 1);
      expect(Math.abs(a - b), `initialData and fetch-by-id disagree for id ${IDS[i]}`).toBeLessThan(0.002);
    }

    // The explicit absence, in words, from an id that cannot exist.
    const absent = page.locator('[data-v8-viewer="no-drawing"]');
    await expect(absent).toHaveCount(1);
    // REID'S RULE 1d: a missing drawing is a visible TO-DO, in those words,
    // not a blank box. It also carries the way to fix it.
    await expect(absent).toContainText('No profile drawing yet');
    await expect(absent).toHaveAttribute('data-v8-todo', '1');
    // The reason travels with it, so the absence is explained rather than bare.
    await expect(absent).toHaveAttribute('data-v8-reason', /.+/);
    // RULE 5: even with no image, there is a way into FlashDraft to draw one —
    // this is precisely the case that needs it.
    await expect(absent.locator('[data-v8-send-to-flashdraft]')).toBeVisible();
    // And the box itself is NOT a .zoom and NOT a button — there is nothing to
    // enlarge, and a control that opens an empty overlay teaches people the
    // overlay is sometimes empty.
    expect(await absent.evaluate((el) => el.tagName)).toBe('SPAN');
    expect(await absent.evaluate((el) => el.className.includes('zoom'))).toBe(false);

    await page.screenshot({ path: path.join(OUT, '01-thumbnails.png'), fullPage: true });
  });

  test('single click enlarges; double click goes full size and carries the numbers', async ({ page }) => {
    await prepare(page);
    await page.goto(`/studio/v8-viewer-debug?ids=${IDS.join(',')}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-v8-viewer="geometry"]', { timeout: 20_000 });
    await settle(page);

    const first = page.locator('[data-v8-viewer="geometry"]').first();

    // ── single click → enlarged, and NOT before the delay elapses ─────────
    await first.click();
    await expect(page.locator('[data-v8-overlay="enlarged"]')).toBeHidden();
    await page.waitForTimeout(450);
    const pop = page.locator('[data-v8-overlay="enlarged"]');
    await expect(pop).toBeVisible();
    expect(
      await inkRatio(page, '[data-v8-profile-canvas="enlarged"]'),
      'the enlarged view painted nothing',
    ).toBeGreaterThan(0.002);
    await page.screenshot({ path: path.join(OUT, '02-enlarged.png') });

    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();

    // ── double click → full size, and the enlarge must never land after ───
    await first.dblclick();
    const full = page.locator('[data-v8-overlay="fullsize"]');
    await expect(full).toBeVisible();
    await page.waitForTimeout(450);
    expect(
      await pop.count(),
      'a double-click also fired the enlarge — the 230 ms cancel is not working',
    ).toBe(0);
    await expect(full).toBeVisible();

    // The meta line, which is DOM text.
    const meta = (await page.locator('[data-v8-overlay-meta]').textContent()) ?? '';
    expect(meta).toMatch(/Developed width/);
    expect(meta).toMatch(/bend/);
    expect(meta).toMatch(/hem/);

    // THE LABELS ARE CANVAS PIXELS, not text nodes — so they are read as ink.
    // #111111 is FlashDraft's label ink; #C0001A is its profile/hem/angle line.
    const labelInk = await pixelsNear(page, '[data-v8-profile-canvas="fullsize"]', '#111111', 60);
    const lineInk = await pixelsNear(page, '[data-v8-profile-canvas="fullsize"]', '#C0001A', 60);
    expect(labelInk, 'the full-size view has no label ink — no dimensions were drawn').toBeGreaterThan(400);
    expect(lineInk, 'the full-size view has no profile line').toBeGreaterThan(400);

    // Steve's red shop note, which the harness passes in.
    await expect(page.locator('[data-v8-shop-note]').first()).toContainText('Steve:');

    // The painted side is a property of the job, and the harness passes none,
    // so it must SAY so rather than leaving the absence to read as an answer.
    await expect(page.locator('[data-v8-painted-side]')).toContainText('not specified');

    await page.screenshot({ path: path.join(OUT, '03-fullsize.png') });

    // ── and every way of closing it ───────────────────────────────────────
    await page.locator('[data-v8-overlay="fullsize"] [data-v8-overlay-close]').click();
    await expect(full).toBeHidden();

    await first.dblclick();
    await expect(full).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(full).toBeHidden();

    await first.dblclick();
    await expect(full).toBeVisible();
    await page.locator('[data-v8-overlay-scrim]').click({ position: { x: 5, y: 5 } });
    await expect(full).toBeHidden();
  });

  test('the keyboard reaches it without the click delay', async ({ page }) => {
    await prepare(page);
    await page.goto(`/studio/v8-viewer-debug?ids=${IDS.join(',')}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-v8-viewer="geometry"]', { timeout: 20_000 });
    await settle(page);

    // A key press IS the intent, so there is nothing to disambiguate and no
    // delay to wait out. A thumbnail nobody can reach by keyboard is a
    // thumbnail with no numbers available to anybody not using a mouse.
    await page.locator('[data-v8-viewer="geometry"]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-v8-overlay="enlarged"]')).toBeVisible({ timeout: 300 });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-v8-overlay="enlarged"]')).toBeHidden();
  });
});
