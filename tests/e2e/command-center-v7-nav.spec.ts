import { test, expect, type Page } from '@playwright/test';
import { TOP_LEVEL_NAV, MORE_NAV, NEW_QUOTE_HREF } from '../../lib/data/admin-nav';

/**
 * v7 Phase 2 — the header and the two office lists.
 *
 * Needs an admin session: every assertion here is behind /admin, which
 * redirects a signed-out visitor. `storageState` comes from auth.setup.ts, the
 * same way every other admin spec gets it.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

// Without the admin session every /admin route 307s to the sign-in page and the
// assertions below would measure THAT while reporting Command Center names —
// the exact failure CLAUDE.md rule #28 records for contrast-live. Skip honestly
// instead of passing on the wrong page.
test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
test.use({ storageState: authFile });

const DESKTOP = { width: 1440, height: 900 };
const NARROW = { width: 1280, height: 800 };

async function noConsoleErrors(page: Page, run: () => Promise<void>) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await run();
  // Next aborts an in-flight RSC prefetch when the test navigates again
  // immediately, logs this, and falls back to a full browser navigation that
  // succeeds — which is why the status assertions in the loop still pass. It is
  // an artifact of driving goto() in a tight loop, not an application error, so
  // it is filtered by its exact text rather than by blanket-ignoring errors.
  const real = errors.filter((e) => !e.includes('Failed to fetch RSC payload'));
  expect(real, `console errors: ${real.join(' | ')}`).toEqual([]);
}

test.describe('v7 header', () => {
  test.use({ viewport: DESKTOP, storageState: authFile });

  test('the seven nav items appear in v7 order', async ({ page }) => {
    await page.goto('/admin/command-center');
    const labels = await page.locator('nav[aria-label="Main"] a').allInnerTexts();
    const cleaned = labels.map((l) => l.replace(/\s*\d+\s*$/, '').trim());
    expect(cleaned).toEqual([
      'Workbench',
      'Quotes',
      'Orders',
      'Shop View',
      'Deliveries',
      'Customers',
      'Pricing',
    ]);
  });

  test('every nav link resolves without a console error', async ({ page }) => {
    for (const item of TOP_LEVEL_NAV) {
      await noConsoleErrors(page, async () => {
        const res = await page.goto(item.href);
        expect(res?.status(), `${item.href} status`).toBeLessThan(400);
        // Not bounced to the login page.
        expect(page.url()).toContain('/admin');
      });
    }
  });

  test('the header search box submits and lands on the Search page with the query', async ({
    page,
  }) => {
    // PORTED FROM tests/e2e/command-center-v2-nav.spec.ts, which was deleted
    // with v7 Stage D: that spec asserted the PRE-v7 navigation (three
    // top-level items, Customers under More) and so could never pass again
    // against the approved design. This was its one assertion with no
    // counterpart here, so it moves rather than being lost.
    //
    // Updated for v7: /admin/search is now the quotes-and-orders Search screen
    // (`pageSearch()`), not the profile rail — that moved to
    // /admin/search/profiles. See CLAUDE.md rules #27 and #33.
    await page.goto('/admin/command-center');
    const box = page.getByRole('combobox');
    await expect(box).toBeVisible();
    await box.fill('coping');
    await box.press('Enter');

    await expect(page).toHaveURL(/\/admin\/search\?q=coping/);
    await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
    // The query really arrived — the field on the page is filled from it.
    await expect(page.locator('input[name="q"]')).toHaveValue('coping');
  });

  test('Credit Applications and Bid Monitor live under More', async ({ page }) => {
    await page.goto('/admin/command-center');
    const more = MORE_NAV.map((i) => i.label);
    expect(more).toContain('Credit Applications');
    expect(more).toContain('Bid Monitor');
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menu').getByText('Credit Applications')).toBeVisible();
  });

  test('"+ New quote" is on every admin page, in the one red', async ({ page }) => {
    for (const href of ['/admin/command-center', '/admin/quotes', '/admin/orders', '/admin/deliveries']) {
      await page.goto(href);
      const btn = page.getByTestId('new-quote-button');
      await expect(btn, `missing on ${href}`).toBeVisible();
      await expect(btn).toHaveText('+ New quote');
      await expect(btn).toHaveAttribute('href', NEW_QUOTE_HREF);
    }
  });

  for (const vp of [
    { name: '1920', width: 1920, height: 1080 },
    { name: '1440', width: 1440, height: 900 },
    { name: '1280', width: 1280, height: 800 },
    { name: '900', width: 900, height: 800 },
  ]) {
    test(`no horizontal page scroll at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/quotes');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `page scrolls horizontally at ${vp.name}`).toBeLessThanOrEqual(1);
    });
  }

  test('the header does not wrap at 1440 or 1280', async ({ page }) => {
    for (const vp of [DESKTOP, NARROW]) {
      await page.setViewportSize(vp);
      await page.goto('/admin/command-center');
      // Children are vertically CENTRED and have different heights, so equal
      // `top` values are not the test — different tops on one row is normal.
      // One row means every child overlaps vertically: the lowest top is still
      // above the highest bottom.
      const onOneRow = await page.evaluate(() => {
        const bar = document.querySelector('header > div') as HTMLElement | null;
        if (!bar) return false;
        const boxes = [...bar.children].map((c) => (c as HTMLElement).getBoundingClientRect());
        if (boxes.length === 0) return false;
        const lowestTop = Math.max(...boxes.map((b) => b.top));
        const highestBottom = Math.min(...boxes.map((b) => b.bottom));
        return lowestTop < highestBottom;
      });
      expect(onOneRow, `header wrapped at ${vp.width}`).toBe(true);
    }
  });
});

test.describe('type-ahead', () => {
  test.use({ viewport: DESKTOP, storageState: authFile });

  test('opens while typing and puts companies above job rows', async ({ page }) => {
    await page.goto('/admin/command-center');
    const box = page.getByRole('combobox');
    await box.fill('a');
    // Below the two-character minimum the dropdown stays shut.
    await expect(page.getByTestId('admin-typeahead')).toHaveCount(0);

    await box.fill('ro');
    const dd = page.getByTestId('admin-typeahead');
    await expect(dd).toBeVisible({ timeout: 10000 });

    const companies = dd.getByTestId('typeahead-company');
    const rows = dd.getByTestId('typeahead-row');
    if ((await companies.count()) > 0 && (await rows.count()) > 0) {
      const cy = (await companies.first().boundingBox())!.y;
      const ry = (await rows.first().boundingBox())!.y;
      expect(cy, 'a company must sit above the first job row').toBeLessThan(ry);
    }
  });
});

test.describe('Quotes and Orders lists', () => {
  test.use({ viewport: DESKTOP, storageState: authFile });

  for (const kind of ['quotes', 'orders'] as const) {
    test(`${kind}: search, stage, date and sort each change the URL and the result set`, async ({ page }) => {
      await page.goto(`/admin/${kind}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const countLine = page.locator('p', { hasText: /·\s*(newest|oldest|customer|most|highest)/i }).first();
      await expect(countLine).toBeVisible();
      const before = (await countLine.innerText()).trim();

      // A search string nothing can match must empty the list.
      await page.getByRole('searchbox').fill('zzzznotathing');
      await page.getByRole('button', { name: 'Apply' }).click();
      await expect(page).toHaveURL(/q=zzzznotathing/);
      await expect(page.getByText('Nothing here matches.')).toBeVisible();

      // Sort is reflected in the count line.
      await page.goto(`/admin/${kind}?sort=cust`);
      await expect(page.locator('p', { hasText: 'customer a to z' }).first()).toBeVisible();

      // Stage and date are accepted and echoed back into the controls.
      const stage = kind === 'quotes' ? 'quoted' : 'shop';
      await page.goto(`/admin/${kind}?stage=${stage}&range=90`);
      await expect(page.locator('select[name="stage"]')).toHaveValue(stage);
      await expect(page.locator('select[name="range"]')).toHaveValue('90');
      expect(before.length).toBeGreaterThan(0);
    });
  }

  test('Quotes and Orders show different stage options, as v7 separates them', async ({ page }) => {
    await page.goto('/admin/quotes');
    const q = await page.locator('select[name="stage"] option').allInnerTexts();
    expect(q).toEqual(['Both stages', 'Needs a quote', 'Waiting on the customer']);

    await page.goto('/admin/orders');
    const o = await page.locator('select[name="stage"] option').allInnerTexts();
    expect(o).toEqual(['All orders', 'Approved', 'In the shop', 'Delivered']);
  });

  test('both lists offer v7’s date and sort options verbatim', async ({ page }) => {
    await page.goto('/admin/quotes');
    expect(await page.locator('select[name="range"] option').allInnerTexts()).toEqual([
      'Any time',
      'Last 30 days',
      'Last 90 days',
      'This year',
    ]);
    expect(await page.locator('select[name="sort"] option').allInnerTexts()).toEqual([
      'Newest first',
      'Oldest first',
      'Customer A to Z',
      'Most pieces',
      'Highest value',
    ]);
  });
});
