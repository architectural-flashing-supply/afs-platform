import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      // Runs tests/e2e/auth.setup.ts, which itself skips (not fails) when
      // E2E_TEST_EMAIL/E2E_TEST_PASSWORD aren't set — see that file. A
      // skip here does not cascade into skipping the dependent project
      // below (only a failure would), so public/guest-flow specs still
      // run even without credentials configured.
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
