import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests only (lib/**/*.test.ts) — end-to-end specs live under
// tests/e2e/** and .repro-*/** and run exclusively through Playwright
// (pnpm test:e2e), which has its own test() implementation that conflicts
// with vitest's if both scan the same files.
export default defineConfig({
  // tsconfig.json maps '@/*' to the repo root and the whole app uses it, but
  // vitest resolves modules itself and had no such mapping — so a lib module
  // written with '@/lib/...' imports (normal everywhere else in this codebase)
  // could not be unit-tested at all: it failed with "Cannot find package
  // '@/lib/data/job-stage'". Added in v2-02 when lib/data/workbench.ts hit it.
  // Mirror any future change to tsconfig's paths here.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: ['lib/**/*.test.ts'],
  },
});
