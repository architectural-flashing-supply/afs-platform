# E2E Tests (Playwright)

## Test account required

No test/QA account credentials exist anywhere in this repo (`.env.example`
has no `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` entries, and there is no
README documenting one). Auth-dependent specs in this suite cannot run
until a human creates a real account via Supabase Auth and sets:

```
E2E_TEST_EMAIL=<real test account email>
E2E_TEST_PASSWORD=<real test account password>
```

in `.env.local` (or the CI environment's secrets). `auth.setup.ts` reads
these two vars from `process.env` — it does not hardcode or fabricate a
login. Until they are set, `auth.setup.ts` skips itself (rather than
failing the run), and every spec in this directory does the same
`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` check at its own top and skips too —
none of them fail the suite for a missing test account.

`playwright.config.ts` runs `auth.setup.ts` as a `setup` project that the
`chromium` project depends on, writing `tests/e2e/.auth/user.json`. Specs
that need an authenticated session opt in per-file with
`test.use({ storageState: 'tests/e2e/.auth/user.json' })` (see
`command-center.spec.ts` and the `authenticated` describe block in
`checkout.spec.ts`) — specs that don't need auth (the public
`/quote` and `/studio/draft` pages) use the default unauthenticated
context instead.

`command-center.spec.ts` additionally requires the `E2E_TEST_EMAIL`
account to have the `admin` role in `profiles.role` — a non-admin account
will be redirected to `/account` by `requireAdminUser()` and that spec
will fail with a real, actionable assertion rather than a silent pass.

## Running

```
pnpm test:e2e       # headless
pnpm test:e2e:ui    # Playwright UI mode
```

Requires the dev server (`pnpm dev`) reachable at the configured
`baseURL` (see `playwright.config.ts`).
