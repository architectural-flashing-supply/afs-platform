import { test, expect } from '@playwright/test';

// /admin/command-center requires an admin-role session (requireAdminUser in
// lib/admin/auth.ts redirects an unauthenticated visitor to /login and a
// non-admin authenticated visitor to /account) — this spec depends on the
// shared tests/e2e/auth.setup.ts storageState. Gated on
// E2E_TEST_EMAIL/E2E_TEST_PASSWORD, consistent with every other spec in
// this suite — see tests/e2e/README.md. Whether E2E_TEST_EMAIL actually
// carries the admin role is not something this authoring session can
// verify; if it doesn't, this spec will fail with a real, actionable
// redirect-to-/account assertion failure rather than silently passing.
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

test.describe('Admin Command Center', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('renders the Pending Approval tab and its job cards without a server error', async ({ page }) => {
    const response = await page.goto('/admin/command-center');
    expect(response?.ok()).toBeTruthy();

    // Landing here (not redirected) is itself proof E2E_TEST_EMAIL has the
    // admin role — requireAdminUser() would otherwise have redirected away.
    await expect(page).toHaveURL(/\/admin\/command-center/);
    await expect(page.getByRole('heading', { name: 'Machine Queue' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pending Approval/ })).toBeVisible();

    // Real Pending Approval content depends on a live quote_requests row
    // this authoring session cannot guarantee exists for this account.
    // Accept either a real PendingQuoteRequestCard (identified by its
    // "Requested Profiles" label — the component has no data-testid) or
    // the page's own graceful EmptyState as evidence the tab rendered
    // cleanly; only fail if neither appears, which would mean the page
    // crashed or hung rather than genuinely having zero pending jobs.
    const jobCard = page.getByText('Requested Profiles').first();
    const emptyState = page.getByText('Nothing here.');
    await expect(jobCard.or(emptyState)).toBeVisible();
  });
});
