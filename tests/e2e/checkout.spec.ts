import { test, expect } from '@playwright/test';

// app/checkout/page.tsx's own load() requires a `?quote=<id>` pointing at a
// real quote_requests-derived `quotes` row, owned by the signed-in user,
// with status 'sent' — there is no "browse to checkout" entry point
// anywhere else in the app; checkout only happens from
// /account/quotes/[id] after AFS has already sent a formal quote and the
// customer approves it. This authoring session has no way to create that
// fixture (no live Supabase project/credentials — see
// tests/e2e/README.md), so per this task's own instruction this spec
// asserts the gating behavior instead of reaching Stripe's CardElement:
// checkout is unreachable, and no price is ever shown, until a real
// AFS-generated quote exists in the account.
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

const PRICE_PATTERN = /\$[\d,]+(\.\d{2})?/;

test.describe('Checkout', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');

  test('with no quote id, checkout is unreachable and shows no price', async ({ page }) => {
    await page.goto('/checkout');

    await expect(page.getByRole('heading', { name: 'Checkout Unavailable' })).toBeVisible();
    await expect(page.getByText('A quote is required to check out.')).toBeVisible();
    // The Payment step (and Stripe's CardElement inside it) only mounts
    // inside CheckoutForm, which never renders on this error path.
    await expect(page.getByRole('heading', { name: '2. Payment' })).toHaveCount(0);
    await expect(page.getByText(PRICE_PATTERN)).toHaveCount(0);
  });

  test('an unauthenticated visitor with a quote id is redirected to /login before any price renders', async ({
    page,
  }) => {
    await page.goto('/checkout?quote=00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(PRICE_PATTERN)).toHaveCount(0);
  });

  test.describe('authenticated', () => {
    test.use({ storageState: 'tests/e2e/.auth/user.json' });

    test('a quote id the account does not own still never reaches Stripe or shows a price', async ({ page }) => {
      await page.goto('/checkout?quote=00000000-0000-0000-0000-000000000000');

      // .eq('user_id', user.id) in load() means an unowned/nonexistent
      // quote id resolves the same way as a missing one — "Quote not
      // found.", not a leak of someone else's price.
      await expect(page.getByRole('heading', { name: 'Checkout Unavailable' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '2. Payment' })).toHaveCount(0);
      await expect(page.getByText(PRICE_PATTERN)).toHaveCount(0);
    });
  });
});
