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
    // Coverage provider, added with the order validator (ovn/04). The repo had
    // no coverage setup at all and `--coverage` failed with "Cannot find
    // dependency '@vitest/coverage-v8'"; the provider is now a devDependency,
    // pinned to the exact vitest version (5.0.0) because a mismatched pair
    // prints "Running mixed versions is not supported".
    //
    // `all: false` is deliberate: this reports on the files the selected tests
    // actually import, so `pnpm vitest run --coverage lib/<module>` measures
    // THAT module rather than diluting it with the whole of lib/. A repo-wide
    // number is not what any of these prompts asks for.
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      all: false,
      exclude: ['**/*.test.ts', '**/fixtures.ts'],
    },
  },
});
