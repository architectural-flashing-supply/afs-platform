import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * PHASE 2 FIDELITY — the prototype beside the live app.
 *
 * Opens the approved v7 HTML straight off disk and the live pages in the same
 * browser at the same two viewports, and captures both. The screenshots are the
 * acceptance evidence; the assertions below check the things a screenshot
 * cannot (exact option text, exact nav order, exact button label), so a visual
 * difference that matters shows up as a failure rather than only in a picture.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set');
test.use({ storageState: authFile });

// pathToFileURL, not `file://` + a raw path: this path is on Windows and
// contains spaces, so a hand-built URL is malformed and the page never loads.
const PROTOTYPE_URL = pathToFileURL(
  path.resolve(
    'C:/Users/manag/Documents/ARCHITECTURAL FLASHING SUPPLY WEBSITE/cc-compare/Claude outputs/AFS_Command_Center_Prototype_v7.html'
  )
).href;
const SHOTS = 'test-results/phase2-fidelity';

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
];

/**
 * Drive the prototype the way a user does — by CLICKING its `[data-go]` nav.
 *
 * Its functions are not globals (`typeof window.go` is undefined on the loaded
 * page), so calling `go()` from `page.evaluate` hangs forever and every test
 * dies on the navigation timeout. Clicking goes through its own event
 * delegation, which is also closer to what we are claiming to compare.
 */
async function protoGo(page: Page, route: string) {
  await page.goto(PROTOTYPE_URL);
  await page.locator('header .nav a').first().waitFor({ timeout: 15000 });
  if (route !== 'workbench') {
    await page.locator(`[data-go="${route}"]`).first().click();
  }
  await page.waitForTimeout(500);
}

for (const vp of VIEWPORTS) {
  test.describe(`fidelity ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('header — prototype and live', async ({ page }) => {
      await protoGo(page, 'workbench');
      await page.locator('header').screenshot({ path: `${SHOTS}/${vp.name}-header-PROTOTYPE.png` });

      await page.goto('/admin/command-center');
      await page.locator('header').screenshot({ path: `${SHOTS}/${vp.name}-header-LIVE.png` });
    });

    test('quotes list — prototype and live', async ({ page }) => {
      await protoGo(page, 'quotes');
      await page.screenshot({ path: `${SHOTS}/${vp.name}-quotes-PROTOTYPE.png` });

      await page.goto('/admin/quotes');
      await page.screenshot({ path: `${SHOTS}/${vp.name}-quotes-LIVE.png` });
    });

    test('orders list — prototype and live', async ({ page }) => {
      await protoGo(page, 'orders');
      await page.screenshot({ path: `${SHOTS}/${vp.name}-orders-PROTOTYPE.png` });

      await page.goto('/admin/orders');
      await page.screenshot({ path: `${SHOTS}/${vp.name}-orders-LIVE.png` });
    });

    test('type-ahead open — prototype and live', async ({ page }) => {
      await protoGo(page, 'workbench');
      // Type into its real input — hqShow is not a global either, so it has to
      // be driven through the prototype's own input handler.
      await page.locator('#hq').fill('ro');
      await page.locator('#hsd').waitFor({ state: 'visible', timeout: 10000 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-typeahead-PROTOTYPE.png` });

      await page.goto('/admin/command-center');
      await page.getByRole('combobox').fill('ro');
      await page.getByTestId('admin-typeahead').waitFor({ timeout: 10000 });
      await page.screenshot({ path: `${SHOTS}/${vp.name}-typeahead-LIVE.png` });
    });
  });
}

test.describe('fidelity — the things a screenshot cannot check', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('nav order is character-for-character the prototype’s', async ({ page }) => {
    await protoGo(page, 'workbench');
    const proto = (await page.locator('header .nav a').allInnerTexts()).map((t) =>
      t.replace(/\s*\d+\s*$/, '').trim()
    );

    await page.goto('/admin/command-center');
    const live = (await page.locator('nav[aria-label="Main"] a').allInnerTexts()).map((t) =>
      t.replace(/\s*\d+\s*$/, '').trim()
    );

    expect(live).toEqual(proto);
  });

  test('the New quote button carries the prototype’s exact label', async ({ page }) => {
    await protoGo(page, 'workbench');
    const protoLabel = (await page.locator('header .nqb').innerText()).trim();

    await page.goto('/admin/command-center');
    const liveLabel = (await page.getByTestId('new-quote-button').innerText()).trim();

    expect(liveLabel).toBe(protoLabel);
  });

  test('stage, date and sort options match the prototype exactly, on both lists', async ({ page }) => {
    for (const kind of ['quotes', 'orders'] as const) {
      await protoGo(page, kind);
      const protoSelects = await page.locator('.bar select').evaluateAll((els) =>
        els.map((el) => [...(el as HTMLSelectElement).options].map((o) => o.text))
      );

      await page.goto(`/admin/${kind}`);
      const liveStage = await page.locator('select[name="stage"] option').allInnerTexts();
      const liveRange = await page.locator('select[name="range"] option').allInnerTexts();
      const liveSort = await page.locator('select[name="sort"] option').allInnerTexts();

      expect(liveStage, `${kind} stage options`).toEqual(protoSelects[0]);
      expect(liveRange, `${kind} date options`).toEqual(protoSelects[1]);
      expect(liveSort, `${kind} sort options`).toEqual(protoSelects[2]);
    }
  });

  test('the list column headers are the prototype’s, in order', async ({ page }) => {
    await protoGo(page, 'quotes');
    const proto = (await page.locator('.ltab .lh span').allInnerTexts())
      .map((t) => t.trim())
      .filter(Boolean);

    await page.goto('/admin/quotes');
    // Exclude the screen-reader-only label for the thumbnail column: v7's
    // equivalent header cell is empty, so counting ours shifts every column by
    // one and makes a matching set look like a mismatch.
    const live = (
      await page.locator('[class*="grid-cols"] > span:not(.sr-only)').allInnerTexts()
    )
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, proto.length);

    expect(live).toEqual(proto);
  });

  test('both page titles and blurbs are the prototype’s', async ({ page }) => {
    for (const kind of ['quotes', 'orders'] as const) {
      await protoGo(page, kind);
      const protoTitle = (await page.locator('.greet h1.t').innerText()).trim();
      const protoBlurb = (await page.locator('.greet p.sub').innerText()).trim();

      await page.goto(`/admin/${kind}`);
      expect((await page.getByRole('heading', { level: 1 }).innerText()).trim()).toBe(protoTitle);
      await expect(page.getByText(protoBlurb, { exact: false })).toBeVisible();
    }
  });
});
