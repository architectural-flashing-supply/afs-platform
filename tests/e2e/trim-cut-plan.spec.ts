import { test, expect } from '@playwright/test';

/**
 * THE ADMIN CUT PLAN SCREEN, END TO END (/admin/cut-plan).
 *
 * ================== WHAT IT PROVES ==================
 *
 *   1. The screen loads for an admin and shows the catalog's standard stock
 *      lengths, read from `product_profiles`.
 *   2. Typing a profile, a finished length and a quantity produces a plan, and
 *      the plan's arithmetic is the library's: 10 pieces of 96 in against 10 ft
 *      stock is 10 bars at 20% waste, which is the fixture
 *      lib/trim-optimizer/optimize.test.ts asserts at the unit level. Both
 *      numbers appearing on screen is what proves the wiring, not the maths.
 *   3. The REFUSAL reaches the screen in words: a 12 ft piece against 10 ft
 *      stock says it cannot be cut from stock at all, and no partial plan is
 *      shown beside it.
 *   4. The empty state — no piece entered yet — invites the first piece rather
 *      than showing a plan of nothing.
 *   5. Un-ticking every stock length says there is nothing to cut from.
 *   6. A stock length typed by hand is really used; a duplicate and a zero are
 *      each refused in words that say nothing was added; and removing it puts
 *      the 12 ft piece back out of reach.
 *   7. No price, anywhere. This screen is quantities only
 *      (specs/SPEC_TRIM_LENGTH_OPTIMIZER.md §1) and AFS is an RFQ platform.
 *   8. A visitor with no session is redirected away from it.
 *
 * ================== NOTHING IS WRITTEN, AND NOTHING IS SENT ==================
 *
 * This screen has no mutation of any kind: it reads `product_profiles` and does
 * arithmetic in the browser. There is no fixture to create and none to sweep,
 * no email, no SMS, and nothing that touches the bend-machine integration — the
 * guarantee for that last one is lib/integrations/pathfinder-single-door.test.ts,
 * a static test that fails if any file outside the two approved callers so much
 * as names the push function.
 *
 * Gated on credentials, like every admin spec: an unauthenticated visit is
 * redirected by app/admin/layout.tsx's requireAdminUser, so without
 * storageState this would measure the sign-in page while reporting admin route
 * names.
 */

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasCreds = !!(E2E_EMAIL && E2E_PASSWORD);
const authFile = 'tests/e2e/.auth/user.json';

test.describe('Cut Plan', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
  test.use({ storageState: authFile });

  test('invites the first piece before anything is entered, and shows no plan', async ({ page }) => {
    await page.goto('/admin/cut-plan');

    await expect(page.getByRole('heading', { name: 'Cut Plan', level: 1 })).toBeVisible();
    await expect(
      page.getByText('Add a profile, a finished length and a quantity'),
      'an untouched form must invite the first piece, not show a plan of nothing'
    ).toBeVisible();
  });

  test("lists the catalog's standard stock lengths", async ({ page }) => {
    await page.goto('/admin/cut-plan');

    // Ten of the twelve seeded product_profiles rows stock at 10 ft
    // (supabase/migrations/002_seed_afs_data.sql), so this one is always there
    // when the catalog reads at all.
    await expect(
      page.getByRole('checkbox', { name: /10 ft/ }),
      'the 10 ft standard length is seeded on ten of the twelve profiles'
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: /10 ft/ }),
      'and the first length is ticked so the screen is usable immediately'
    ).toBeChecked();
  });

  test('plans ten 8 ft pieces into ten 10 ft bars at 20% waste', async ({ page }) => {
    await page.goto('/admin/cut-plan');

    await page.locator('#piece-1-profile').fill('Coping Cap');
    await page.locator('#piece-1-length').fill('96');
    await page.locator('#piece-1-quantity').fill('10');

    // 96 + 96 + 0.25 kerf overruns a 120 in bar, so one piece per bar; each bar
    // keeps 96 in and loses 0.25 in to the blade and 23.75 in as off-cut, which
    // is 240 in of 1200 in — 20.0%.
    await expect(
      page.getByText('20.0%', { exact: true }),
      'the waste figure must be the library\'s, not a rounded-off approximation of it'
    ).toBeVisible();
    await expect(
      page.getByText('Cut 1 piece from 120" stock: 96", 1/4" blade loss, 23 3/4" off-cut').first(),
      'and each bar must carry the shop sentence the library wrote'
    ).toBeVisible();
    await expect(page.getByText('Coping Cap', { exact: true })).toBeVisible();
  });

  test('refuses a piece longer than the stock, in words, with no partial plan', async ({ page }) => {
    await page.goto('/admin/cut-plan');

    await page.locator('#piece-1-profile').fill('Coping Cap');
    await page.locator('#piece-1-length').fill('144');
    await page.locator('#piece-1-quantity').fill('1');

    await expect(
      page.getByText('Cannot be planned'),
      'a 12 ft piece against 10 ft stock is a refusal, not a warning'
    ).toBeVisible();
    await expect(
      page.getByText(/longer than the longest stock length available/),
      'and the reason has to be in words the estimator can act on'
    ).toBeVisible();
    await expect(
      page.getByText('Stock pieces'),
      'no totals panel may appear beside a refusal'
    ).toHaveCount(0);
  });

  test('says there is nothing to cut from when every stock length is un-ticked', async ({ page }) => {
    await page.goto('/admin/cut-plan');

    await page.locator('#piece-1-profile').fill('Coping Cap');
    await page.locator('#piece-1-length').fill('96');

    for (const box of await page.getByRole('checkbox').all()) {
      if (await box.isChecked()) await box.uncheck();
    }

    await expect(
      page.getByText('Not enough to plan yet'),
      'an unfinished form is not a refusal and must not be dressed as one'
    ).toBeVisible();
    await expect(page.getByText(/nothing to cut from/)).toBeVisible();
  });

  test('takes a stock length by hand, refuses a duplicate and an empty one, and removes it', async ({
    page,
  }) => {
    await page.goto('/admin/cut-plan');

    // A length the catalog does not carry. 16 ft = 192 in, and one 144 in piece
    // comes off it with 47.75 in left (192 - 144 - 0.25).
    await page.locator('#extra-stock-length').fill('16');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('16 ft', { exact: false }).first()).toBeVisible();

    // The same length twice is refused, and says nothing was added.
    await page.locator('#extra-stock-length').fill('16');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(
      page.getByText('16 ft is already in the list. Nothing was added.'),
      'a duplicate must be refused in words, and must say nothing happened'
    ).toBeVisible();

    // So is a length that is not a length.
    await page.locator('#extra-stock-length').fill('0');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(
      page.getByText('Enter a stock length in feet, greater than zero. Nothing was added.')
    ).toBeVisible();

    // And the hand-typed length really is used: a 12 ft piece fits a 16 ft bar
    // and fits nothing the catalog carries at 10 ft.
    await page.locator('#piece-1-profile').fill('Expansion Joint');
    await page.locator('#piece-1-length').fill('144');
    await page.locator('#piece-1-quantity').fill('1');
    await expect(
      page.getByText('Cut 1 piece from 192" stock: 144", 1/4" blade loss, 47 3/4" off-cut'),
      'the hand-typed 16 ft bar is the one the plan uses'
    ).toBeVisible();

    // Removing it leaves only the catalog lengths, which cannot hold the piece.
    await page.getByRole('button', { name: /Remove the 16 ft stock length/ }).click();
    await expect(
      page.getByText(/longer than the longest stock length available/),
      'with the 16 ft bar gone, a 12 ft piece has nothing to come off'
    ).toBeVisible();
  });

  test('never shows a price', async ({ page }) => {
    await page.goto('/admin/cut-plan');

    await page.locator('#piece-1-profile').fill('Coping Cap');
    await page.locator('#piece-1-length').fill('96');
    await page.locator('#piece-1-quantity').fill('10');

    await expect(page.getByText('20.0%', { exact: true })).toBeVisible();
    await expect(
      page.getByText(/\$[\d,]+(\.\d{2})?/),
      'the trim optimizer is quantities only — SPEC_TRIM_LENGTH_OPTIMIZER.md §1'
    ).toHaveCount(0);
  });
});

test.describe('Cut Plan is admin-only', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');

  test('redirects a visitor with no session away from the screen', async ({ page }) => {
    // No storageState on this describe block, so this is a signed-out visit.
    await page.goto('/admin/cut-plan');

    await expect(
      page,
      'the /admin tree is gated by middleware and again by requireAdminUser'
    ).not.toHaveURL(/\/admin\/cut-plan/);
  });
});
