import { test, expect } from '@playwright/test';

/**
 * Command Center V2 — ONE-level navigation, verified in a real browser
 * (prompt v2-01, step 5).
 *
 * The unit tests in lib/data/admin-nav.test.ts prove the nav DATA is right.
 * This proves the rendered header matches it, that the second level is
 * really gone from the page (no sidebar, no gear popover), and that Building
 * Codes is reachable from the public site.
 *
 * Creates no rows, so there is nothing to clean up.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

test.describe('public site: Building Codes lives under Resources', () => {
  test('the Resources menu offers Building Codes, and the page loads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Resources' }).first().click();
    const link = page.getByRole('menuitem', { name: 'Building Codes' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/resources\/building-codes/);
    await expect(page.getByRole('heading', { name: 'Building Code Directory' })).toBeVisible();
  });

  test('the directory shows real jurisdiction data, not an empty shell', async ({ page }) => {
    await page.goto('/resources/building-codes');
    // 254 Texas counties + 226 cities were seeded by migration 022. Scope to
    // the stat cards: the filter strip below also has a "Counties" control.
    const stats = page.locator('p.font-heading');
    await expect(stats.filter({ hasText: /^480$/ })).toBeVisible();
    await expect(stats.filter({ hasText: /^254$/ })).toBeVisible();
    await expect(stats.filter({ hasText: /^226$/ })).toBeVisible();
  });

  test('Building Codes is gone from the Command Center', async ({ page }) => {
    const response = await page.goto('/admin/building-codes');
    // Either a 404 (route deleted) or a redirect to /login (admin gate runs
    // first for an anonymous visitor). Both prove it is no longer an admin
    // page; what must NOT happen is the old page rendering.
    const status = response?.status() ?? 0;
    expect(status === 404 || page.url().includes('/login')).toBe(true);
  });
});

test.describe('Command Center header', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set');
  test.use({ storageState: authFile });

  test('top level is exactly Workbench, Shop View, Deliveries', async ({ page }) => {
    await page.goto('/admin/command-center');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    const labels = (await nav.getByRole('link').allInnerTexts()).map((t) =>
      t.replace(/\s*\d+\s*$/, '').trim()
    );
    expect(labels).toEqual(['Workbench', 'Shop View', 'Deliveries']);
  });

  test('the search box is in the header and lands on a real Search page', async ({ page }) => {
    await page.goto('/admin/command-center');
    const box = page.getByRole('searchbox', { name: 'Search' });
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('placeholder', 'Customer, profile, or job');
    await box.fill('coping');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/admin\/search\?q=coping/);
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  });

  test('More opens a flat menu with exactly the four V2 destinations', async ({ page }) => {
    await page.goto('/admin/command-center');
    const more = page.getByRole('button', { name: 'More' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');

    const menu = page.getByRole('menu');
    expect(await menu.getByRole('menuitem').allInnerTexts()).toEqual([
      'Customers',
      'Credit Applications',
      'Bid Monitor',
      'Settings',
    ]);
    // Flat: a destination, never another menu.
    await expect(menu.getByRole('button')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  test('the second navigation level is gone from the page', async ({ page }) => {
    await page.goto('/admin/command-center');
    // The 240px sidebar that duplicated the top bar.
    await expect(page.locator('aside')).toHaveCount(0);
    // The gear popover that held QuickBooks / Pricing / Settings.
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0);
    // Labels the two-level nav used, now absorbed elsewhere.
    const header = page.locator('header').first();
    for (const gone of ['Dashboard', 'Production Queue', 'Quote Requests']) {
      await expect(header.getByRole('link', { name: gone, exact: true })).toHaveCount(0);
    }
  });

  test('every More destination actually loads', async ({ page }) => {
    for (const [href, heading] of [
      ['/admin/customers', 'Customers'],
      ['/admin/credit-applications', /credit application/i],
      ['/admin/bid-monitor', /bid/i],
      ['/admin/settings', 'Settings'],
    ] as const) {
      const response = await page.goto(href);
      expect(response?.status(), `${href} should not error`).toBeLessThan(400);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    }
  });

  test('Deliveries and Shop View load from the top level', async ({ page }) => {
    await page.goto('/admin/command-center');
    // Scope to the header nav — the dashboard body also links to a
    // deliveries-related metric, which an unscoped name match would hit.
    const nav = page.getByRole('navigation', { name: 'Main' });
    await nav.getByRole('link', { name: 'Deliveries', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deliveries' })).toBeVisible();
    await nav.getByRole('link', { name: 'Shop View', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/shop-view/);
  });

  test('Settings absorbed Pricing and shows the QuickBooks coming-soon card', async ({ page }) => {
    await page.goto('/admin/settings');
    // `exact` since v2-03 added a "Pricing history" section beside "Pricing" —
    // a substring match now resolves to two headings and is ambiguous.
    await expect(page.getByRole('heading', { name: 'Pricing', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Price rules/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
    await expect(page.getByRole('link', { name: /QuickBooks/ })).toBeVisible();
  });

  test('Settings carries the price book, the pricing history and the office invoice address', async ({
    page,
  }) => {
    await page.goto('/admin/settings');

    // The price book is what quotes are actually built from.
    const priceBook = page.getByRole('link', { name: /Price book/ });
    await expect(priceBook).toBeVisible();

    // The pricing history: the dataset dynamic pricing will learn from, with
    // its CSV export and the form that records a supplier's price change.
    await expect(page.getByRole('heading', { name: 'Pricing history' })).toBeVisible();
    await expect(page.locator('[data-testid="ledger-export"]')).toBeVisible();
    await expect(page.locator('[data-testid="supplier-price-change-form"]')).toBeVisible();
    await expect(
      page.getByText(/Nothing in here can be edited or deleted, by anyone/)
    ).toBeVisible();

    // The exact wording the v2-03 prompt asks for, on the card itself.
    await expect(page.locator('[data-testid="dynamic-pricing-card"]')).toContainText(
      'Dynamic pricing — coming soon (learning from this history)'
    );

    // The automatic invoice copy goes to Tricia, spelled correctly.
    await expect(page.locator('[data-testid="office-invoice-email"]')).toHaveText(
      'tricia@architecturalflashingsupply.com'
    );

    // And the price book opens.
    await priceBook.click();
    await expect(page).toHaveURL(/\/admin\/settings\/price-book/);
    await expect(page.getByRole('heading', { name: 'Price book' })).toBeVisible();
    await expect(page.getByText('Quotes you have already sent keep the prices they were built on')).toBeVisible();
  });

  test('Customers absorbed the orders CRM', async ({ page }) => {
    await page.goto('/admin/customers');
    const link = page.getByRole('link', { name: /Orders & invoicing/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/orders-crm/);
  });
});
