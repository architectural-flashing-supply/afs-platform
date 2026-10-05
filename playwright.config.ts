import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Playwright does not read .env.local (this repo has no dotenv dependency and
// the config had no loader of its own), so E2E_TEST_EMAIL/E2E_TEST_PASSWORD
// written there never reached auth.setup.ts or the specs, and every
// credential-gated test reported "skipped". Load it here, without adding a
// dependency, and without overriding anything already exported in the shell
// (so `$env:E2E_TEST_EMAIL=...` still wins). See STATE_OF_THE_BUILD.md's lr-01
// entry.
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  for (const rawLine of fs.readFileSync(envLocalPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

export default defineConfig({
  // './tests', not './tests/e2e': the v7 style gate lives in tests/visual/
  // because it is not an end-to-end flow — it compares computed styles against
  // the committed prototype. Both directories are discovered from here so one
  // `playwright test` runs the behaviour specs and the appearance gate.
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
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
