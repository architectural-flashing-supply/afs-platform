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
//
// The bare `/admin/command-center` URL (no `?tab=`) now renders the newer
// unified "Dashboard" view (showDashboard = rawTab === undefined in
// app/admin/command-center/page.tsx) — its own h1 is literally "Dashboard",
// not "Machine Queue", and it doesn't render PendingQuoteRequestCard/
// EmptyState directly. The "Machine Queue" heading, the Pending Approval
// tab content, and the job-card-or-empty-state fallback this spec checks
// only render under the explicit `?tab=pending` machine-queue view — so
// this spec navigates there directly rather than to the bare URL.
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

test.describe('Admin Command Center', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('renders the Pending Approval tab and its job cards without a server error', async ({ page }) => {
    const response = await page.goto('/admin/command-center?tab=pending');
    expect(response?.ok()).toBeTruthy();

    // Landing here (not redirected) is itself proof E2E_TEST_EMAIL has the
    // admin role — requireAdminUser() would otherwise have redirected away.
    await expect(page).toHaveURL(/\/admin\/command-center\?tab=pending/);
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
