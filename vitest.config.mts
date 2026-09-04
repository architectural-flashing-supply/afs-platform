import { defineConfig } from 'vitest/config';

// Unit tests only (lib/**/*.test.ts) — end-to-end specs live under
// tests/e2e/** and .repro-*/** and run exclusively through Playwright
// (pnpm test:e2e), which has its own test() implementation that conflicts
// with vitest's if both scan the same files.
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
  },
});
