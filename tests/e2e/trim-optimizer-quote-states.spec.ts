import { test, expect, type Page } from '@playwright/test';

/**
 * THE TRIM LENGTH OPTIMIZER'S THREE STATES, IN THE CUSTOMER'S QUOTE FORM.
 *
 * app/quote/page.tsx Step 2 renders components/quote/TrimLengthOptimizerSection
 * below the waste-factor line. Its three states say three different things and
 * this spec proves each one in a real browser:
 *
 *   ready   — the spec's own worked example, end to end: "You need 47 LF. We
 *             stock this profile in 10 ft lengths." -> 5 pieces x 10 ft, 50 ft
 *             ordered, 3 LF (6%) waste. Those numbers are
 *             specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §3's illustration verbatim.
 *   loading — the catalog read is held open, and the section says it is checking
 *             rather than appearing from nowhere a moment later.
 *   error   — the catalog read is refused, and the section says the cut list is
 *             unavailable AND that the quote request itself is unaffected. The
 *             alternative, which is what shipped before, was rendering nothing
 *             at all — indistinguishable from a profile that genuinely has no
 *             stock length.
 *
 * ================== NOTHING IS SUBMITTED AND NOTHING IS WRITTEN ==================
 *
 * This spec never presses Submit. It stops on Step 2, so no `quote_requests`
 * row is created, no email or SMS is attempted, and there is nothing to sweep.
 *
 * ========= WHY IT RUNS SIGNED IN, ON A PAGE THAT IS DELIBERATELY PUBLIC =========
 *
 * Because today the cut list is INVISIBLE to a signed-out visitor, and that is
 * a defect in the data path rather than in this spec.
 * `product_profiles`'s only SELECT policy is 001_initial_schema.sql:195,
 * `auth.uid() IS NOT NULL AND is_active = true`. A guest has no `auth.uid()`,
 * so RLS filters every row out and PostgREST answers with an empty result and
 * NO error — which is indistinguishable from "this profile has no standard
 * stock length", so the section renders nothing at all.
 *
 * This was found by running exactly this flow both ways: with a session it
 * prints "You need 47 LF. We stock this profile in 10 ft lengths.", without one
 * it prints nothing. supabase/migrations/039_product_profiles_public_read.sql
 * fixes it and has NOT been applied (the overnight brief forbids applying
 * migrations), so this spec asserts the behaviour that really exists today.
 * When 039 is applied, drop the `test.use` below and this block with it.
 *
 * The guest case is deliberately NOT asserted either way: a test that pinned
 * today's silence would start failing the moment the migration lands, and a
 * conditional assertion would prove nothing.
 */

/** Everything the form needs before Step 2 will accept a length and quantity. */
async function reachStepTwo(page: Page) {
  await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
  await page.locator('#material').selectOption({ index: 1 });
  await page.locator('#gauge').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Next' }).click();
}

/** The browser Supabase client's read of the stock-length catalog. */
const CATALOG_READ = '**/rest/v1/product_profiles**';

test.describe('Trim Length Optimizer in the quote form', () => {
  test.skip(
    !(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD),
    'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — needed only because of the RLS gap above; see tests/e2e/README.md'
  );
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test("shows the spec's own worked example: 47 LF becomes 5 pieces of 10 ft", async ({ page }) => {
    await page.goto('/quote');
    await reachStepTwo(page);

    await page.locator('#lengthFt').fill('47');
    await page.locator('#quantity').fill('1');

    await expect(
      page.getByText('You need 47 LF. We stock this profile in 10 ft lengths.'),
      'coping-cap is seeded with standard_length_ft = 10, so the section must render'
    ).toBeVisible();

    // Collapsed by default; the cut list is behind the disclosure.
    await page.getByRole('button', { name: 'Trim Length Optimizer' }).click();

    await expect(page.getByText('5 pieces × 10 ft'), 'ceil(47 / 9.9792) is 5').toBeVisible();
    await expect(page.getByText('50 ft ordered'), '5 pieces x 10 ft').toBeVisible();
    await expect(page.getByText('3 LF (6%)'), '50 ft ordered less 47 LF needed is 6%').toBeVisible();
    await expect(
      page.getByText('Piece 5'),
      'and the fifth piece is listed, being the one with the off-cut'
    ).toBeVisible();
  });

  test('renders nothing for a profile that has no standard stock length', async ({ page }) => {
    await page.goto('/quote');

    // Scupper is one of the two seeded requires_consultation rows, where
    // standard_length_ft is NULL — correct data, not missing data. SPEC §3:
    // the section is "only shown when product has standard stock lengths
    // defined", so the right behaviour is silence.
    await page.getByRole('button', { name: 'Scupper', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#lengthFt').fill('47');
    await page.locator('#quantity').fill('1');

    // The waste-factor line above it still renders, which is what makes this a
    // test of the optimizer's own condition rather than of the step as a whole.
    await expect(
      page.getByRole('button', { name: 'Trim Length Optimizer' }),
      'a profile with no stock length must show no cut list at all'
    ).toHaveCount(0);
    await expect(
      page.getByText(/We could not look up stock lengths/),
      'and must not claim anything went wrong, because nothing did'
    ).toHaveCount(0);
  });

  test('says it is checking while the catalog read is still open', async ({ page }) => {
    // Hold the read open long enough to observe the loading state. This is the
    // real read being delayed, not a test-only flag in the component.
    await page.route(CATALOG_READ, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue();
    });

    await page.goto('/quote');
    await reachStepTwo(page);

    await page.locator('#lengthFt').fill('47');
    await page.locator('#quantity').fill('1');

    await expect(
      page.getByText('Checking stock lengths…'),
      'the customer is told the lookup is in progress rather than shown nothing'
    ).toBeVisible();

    // And it resolves into the real thing once the read completes.
    await expect(
      page.getByText('You need 47 LF. We stock this profile in 10 ft lengths.')
    ).toBeVisible({ timeout: 10000 });
  });

  test('says the cut list is unavailable, and that the quote request is unaffected', async ({
    page,
  }) => {
    // A server error: PostgREST answers, and the answer is a failure. This is
    // the common shape — an RLS change, a dropped column, a project paused.
    await page.route(CATALOG_READ, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'injected failure' }),
      })
    );

    await page.goto('/quote');
    await reachStepTwo(page);

    await page.locator('#lengthFt').fill('47');
    await page.locator('#quantity').fill('1');

    await expect(
      page.getByText(/We could not look up stock lengths just now/),
      'a failed lookup must say so rather than look like a profile with no stock length'
    ).toBeVisible();
    await expect(
      page.getByText(/Your quote request is unaffected/),
      'and must say what did NOT happen — CLAUDE.md rule #30 applied to a panel'
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Trim Length Optimizer' }),
      'no cut list is offered, because there is no stock length to base one on'
    ).toHaveCount(0);
  });

  test('gives up on a read that never answers, instead of checking forever', async ({ page }) => {
    // THE OTHER SHAPE, and the one that was broken. A hard abort — an offline
    // laptop, a captive portal, a blocked domain — does not make the PostgREST
    // read reject promptly; the promise stays pending, and before
    // STOCK_LENGTH_READ_TIMEOUT_MS existed this section sat on "Checking stock
    // lengths…" indefinitely. That was found here, by doing exactly this.
    await page.route(CATALOG_READ, (route) => route.abort());

    await page.goto('/quote');
    await reachStepTwo(page);

    await page.locator('#lengthFt').fill('47');
    await page.locator('#quantity').fill('1');

    await expect(
      page.getByText('Checking stock lengths…'),
      'it starts out checking, which is honest'
    ).toBeVisible();

    // The timeout is 8s (lib/data/product-profiles.ts), so this waits past it
    // deliberately rather than racing it.
    await expect(
      page.getByText(/We could not look up stock lengths just now/),
      'and then says so, rather than checking forever'
    ).toBeVisible({ timeout: 20000 });
  });

  test('shows no cut list before a length and quantity are entered', async ({ page }) => {
    await page.goto('/quote');
    await reachStepTwo(page);

    await expect(
      page.getByRole('button', { name: 'Trim Length Optimizer' }),
      'nothing has been asked for yet, so there is nothing to optimize'
    ).toHaveCount(0);
    await expect(
      page.getByText('Checking stock lengths…'),
      'and a customer who has not typed a length is not waiting for anything'
    ).toHaveCount(0);
  });

  test('never shows a price alongside the cut list', async ({ page }) => {
    await page.goto('/quote');
    await reachStepTwo(page);

    await page.locator('#lengthFt').fill('47');
    await page.locator('#quantity').fill('1');
    await page.getByRole('button', { name: 'Trim Length Optimizer' }).click();

    await expect(page.getByText('50 ft ordered')).toBeVisible();
    await expect(
      page.getByText(/\$[\d,]+(\.\d{2})?/),
      'CLAUDE.md rule #1: the customer sees no dollar amount before an AFS quote'
    ).toHaveCount(0);
  });
});
