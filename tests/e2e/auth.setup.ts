import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  // Skip (not throw) when credentials aren't configured — a thrown error
  // here fails the "setup" project, which per Playwright's dependency
  // semantics skips every test in any project that depends on it. A skip
  // instead lets those dependent specs run their own (identical) env
  // check and report an honest per-spec skip rather than a suite-wide
  // failure. See tests/e2e/README.md. The `if` guard (rather than relying
  // on setup.skip's own condition argument) is also what lets TypeScript
  // narrow `email`/`password` to `string` below, under strict mode.
  if (!email || !password) {
    setup.skip(true, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
    return;
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: authFile });
});
