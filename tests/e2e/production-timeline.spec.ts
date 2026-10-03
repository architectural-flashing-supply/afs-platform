import { test, expect } from '@playwright/test';

/**
 * EES-OVN.06 AC-20 / AC-21 — the three surfaces ProductionTimeline is rendered
 * on, in a real browser.
 *
 * The /order-status cases need NO credentials and no seeded order: the page is
 * public, and its idle / validation / error states are reachable without one.
 * They are the honest part of this spec — they assert behaviour that is true on
 * any deployment.
 *
 * The customer and admin cases need the shared tests/e2e/auth.setup.ts session
 * (see tests/e2e/README.md), and the admin case needs that account to carry
 * `profiles.role = 'admin'`. They skip rather than fail when credentials are
 * absent, matching every other spec in this directory, and skip rather than
 * fail when the environment has no order to open — the premise has nothing to
 * observe in that case, and inventing an order from a test would be writing
 * real rows through a door nobody approved.
 */
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

test.describe('Public order-status lookup (/order-status)', () => {
  test('loads anonymously and shows the lookup form', async ({ page }) => {
    const response = await page.goto('/order-status');
    expect(response?.ok(), 'the public order-status page must load without a session').toBeTruthy();
    await expect(page, 'and must not redirect to the sign-in flow').not.toHaveURL(/\/login/);

    await expect(page.locator('[data-testid="order-status-lookup"]')).toBeVisible();
    await expect(page.locator('#order-status-order-number')).toBeVisible();
    await expect(page.locator('#order-status-email')).toBeVisible();
    await expect(page.locator('[data-testid="order-status-submit"]')).toBeVisible();
  });

  test('shows a field-level error on an empty submit and sends no request', async ({ page }) => {
    await page.goto('/order-status');

    let requested = false;
    await page.route('**/api/track/verify', (route) => {
      requested = true;
      return route.abort();
    });

    await page.locator('[data-testid="order-status-submit"]').click();

    await expect(
      page.getByText('Enter the order number from your confirmation email.'),
      'an empty order number must be pointed at by name, not reported as a generic failure'
    ).toBeVisible();
    await expect(page.getByText('Enter the email address the order was placed with.')).toBeVisible();
    expect(requested, 'an incomplete form must not reach the rate-limited endpoint at all').toBe(false);
  });

  test('shows the API message for an order that does not exist, and no stack trace', async ({ page }) => {
    await page.goto('/order-status');

    await page.locator('#order-status-order-number').fill('AFS-DOES-NOT-EXIST-000');
    await page.locator('#order-status-email').fill('nobody@example.test');
    await page.locator('[data-testid="order-status-submit"]').click();

    const errorPanel = page.locator('[data-testid="order-status-error"]');
    await expect(errorPanel, 'a failed lookup must say so on the page').toBeVisible({ timeout: 15000 });
    await expect(
      errorPanel,
      'CLAUDE.md rule #30: say what did NOT happen — the order itself is untouched by a failed lookup'
    ).toContainText('Nothing about your order has changed');

    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body.includes('at object.'), 'never a stack frame on a customer-facing page').toBe(false);
    expect(body.includes('typeerror'), 'never a raw exception name').toBe(false);
  });

  test('shows no price anywhere — AFS is an RFQ platform', async ({ page }) => {
    await page.goto('/order-status');
    const body = await page.locator('body').innerText();
    expect(
      /\$\s?\d/.test(body),
      'no dollar amount may appear on a public order-status page; prices only exist on an AFS-issued quote in the portal'
    ).toBe(false);
  });

  test('is where the footer sends a visitor who wants to track an order', async ({ page }) => {
    await page.goto('/');
    const footerLink = page.locator('footer a', { hasText: 'Track an Order' }).first();
    await expect(footerLink, 'the footer advertises order tracking').toBeVisible();
    await expect(
      footerLink,
      'and must point at the public page — /account/orders needs a session, so an anonymous visitor landed on /login'
    ).toHaveAttribute('href', '/order-status');
  });
});

test.describe('Customer order detail timeline', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('renders the timeline with list and progress semantics', async ({ page }) => {
    await page.goto('/account/orders');
    const firstOrderLink = page.locator('a[href^="/account/orders/"]').first();
    if (!(await firstOrderLink.isVisible().catch(() => false))) {
      test.skip(true, 'This account has no orders — there is no timeline to render.');
      return;
    }
    await firstOrderLink.click();
    await expect(page).toHaveURL(/\/account\/orders\/[^/]+$/);

    const timeline = page.locator('[data-testid="production-timeline"]');
    await expect(timeline).toBeVisible();
    await expect(
      timeline.locator('ol[role="list"]'),
      'the stages are an ordered list — screen readers announce position in it'
    ).toBeVisible();
    await expect(
      timeline.locator('[role="progressbar"]'),
      'and the progress through them is a progressbar, not only a visual rail'
    ).toHaveAttribute('aria-valuemax', '9');
    await expect(timeline.locator('[data-testid="stage-submitted"]')).toBeVisible();
    await expect(timeline.locator('[data-testid="stage-delivered"]')).toBeVisible();
  });
});

test.describe('Admin order detail timeline', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  // NAVIGATED VIA /admin/customers, not /admin/orders. `/admin/orders` is now
  // v7's office Orders list, whose rows link to the Workbench job screen
  // (lib/data/v7-view/from-live-lists.ts), so it is not a route to the admin
  // order DETAIL at all. The live links to that page are the Customers detail
  // screen (app/admin/customers/[id]/page.tsx) and /admin/quotes/new; the
  // Customers path is the one that does not need a quote in progress.
  test('renders the admin variant beside StatusAdvancer, in shop wording', async ({ page }) => {
    await page.goto('/admin/customers');
    await expect(page, 'E2E_TEST_EMAIL must carry the admin role for this spec').not.toHaveURL(/\/(login|account)$/);

    // Hrefs are READ and navigated directly rather than clicked, and every read
    // goes through `count()` first: a click raced the client-side transition,
    // and `getAttribute()` on an absent element waits out the whole test
    // timeout, which reports "no order detail" as a 30-second failure.
    const customerLinks = page.locator('a[href^="/admin/customers/"]');
    const customerCount = await customerLinks.count();
    if (customerCount === 0) {
      test.skip(true, 'No customers in this environment, so no order detail to open.');
      return;
    }

    // Not every customer has placed an order, so walk the first few rather than
    // reporting "nothing to test" because row one happened to have none.
    const customerHrefs = (
      await Promise.all(
        Array.from({ length: Math.min(customerCount, 5) }, (_, i) => customerLinks.nth(i).getAttribute('href'))
      )
    ).filter((href): href is string => typeof href === 'string');

    let orderHref: string | null = null;
    for (const customerHref of customerHrefs) {
      await page.goto(customerHref);
      await expect(page).toHaveURL(/\/admin\/customers\/[^/]+$/);
      const orderLinks = page.locator('a[href^="/admin/orders/"]');
      if ((await orderLinks.count()) > 0) {
        orderHref = await orderLinks.first().getAttribute('href');
        break;
      }
    }

    if (!orderHref) {
      test.skip(true, 'None of the first five customers has an order, so there is no admin order detail to open.');
      return;
    }
    await page.goto(orderHref);
    await expect(page).toHaveURL(/\/admin\/orders\/[^/]+$/);

    await expect(
      page.locator('[data-testid="status-advancer"]'),
      'editing stays StatusAdvancer’s job — the timeline is the reading half beside it'
    ).toBeVisible();

    const timeline = page.locator('[data-testid="production-timeline"]');
    await expect(timeline, 'the admin order detail renders the shared timeline').toBeVisible();
    await expect(
      timeline.locator('[data-testid="stage-bending"]'),
      'and shows the shop’s own wording for the forming stage'
    ).toContainText('Bending/Forming');
    await expect(
      timeline.locator('[data-testid="pre-ship-photo-slot"]'),
      'the admin page already has its own PreShipPhotoSection, so the timeline must not repeat it'
    ).toHaveCount(0);
  });
});
