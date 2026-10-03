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
  // tsconfig.json sets `jsx: "preserve"` (Next.js compiles JSX itself), and the
  // transform honours it — so a .tsx test file reached node with its JSX intact
  // and failed to parse ("Unexpected JSX expression"). Overriding to the
  // automatic runtime here is what makes component render tests possible WITHOUT
  // adding a dependency: components/**/*.test.tsx renders through
  // react-dom/server's renderToStaticMarkup, which needs no jsdom and no
  // testing library. Only this test runner is affected; the app's own build is
  // untouched.
  //
  // It is `oxc`, not `esbuild`: this Vite major transforms with oxc, and setting
  // the esbuild options instead is accepted silently with a warning and then
  // ignored — which looks like a config that works and is not one.
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'react' },
  },
  test: {
    // .tsx is included so a COMPONENT can be unit-tested beside the module it
    // renders (EES-OVN.06). End-to-end specs still live under tests/** and run
    // exclusively through Playwright.
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx', 'components/**/*.test.tsx'],
  },
});
