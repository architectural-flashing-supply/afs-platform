import { test, expect } from '@playwright/test';

// app/quote/page.tsx is a public page — a guest can submit without ever
// logging in (the email-capture panel on step 4 covers that path), so this
// spec technically doesn't need E2E_TEST_EMAIL/E2E_TEST_PASSWORD to exist.
// It's still gated on them, consistent with every other spec in this
// suite: this authoring session has no live dev server or Supabase project
// to actually run against, and submitting a real quote request against
// whatever environment does run this suite shouldn't happen by accident.
// See tests/e2e/README.md.
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

test.describe('Quote Request Wizard', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');

  test('submits the minimum valid item and confirms with an AFS-QR request number, never showing a price', async ({
    page,
  }) => {
    await page.goto('/quote');

    // Step 1 — Profile & Material. profileType/material/gauge are the only
    // fields step1Valid requires.
    await page.getByRole('button', { name: 'Coping Cap', exact: true }).click();
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — Dimensions & Quantity. Only length + quantity are required —
    // width/height/legA/legB are explicitly optional per step2Valid.
    await page.locator('#lengthFt').fill('10');
    await page.locator('#quantity').fill('1');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3 — Project Details. projectName + jobsiteAddress are the only
    // fields step3Valid requires.
    await page.locator('#projectName').fill('E2E Test Project');
    await page.locator('#jobsiteAddress').fill('123 Test St, Austin, TX 78701');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4 — Review & Submit. CLAUDE.md rule #1: no price anywhere here.
    await expect(page.getByText('Pricing is not shown here')).toBeVisible();
    await expect(page.getByText(/\$[\d,]+(\.\d{2})?/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Submit Quote Request' }).click();

    // handleSubmit() only submits immediately for an authenticated session
    // — this page's own default `page` fixture carries no storageState, so
    // the guest email-capture panel is expected to appear here.
    const guestEmailInput = page.locator('#guestEmail');
    if (await guestEmailInput.isVisible().catch(() => false)) {
      await guestEmailInput.fill(process.env.E2E_TEST_EMAIL!);
      await page.getByRole('button', { name: 'Submit as Guest' }).click();
    }

    await expect(page.getByText('Quote Request Submitted')).toBeVisible();
    await expect(page.getByText(/^AFS-QR-\d{4}-\d{5}$/)).toBeVisible();

    // No dollar amount anywhere in the confirmation view either.
    await expect(page.getByText(/\$[\d,]+(\.\d{2})?/)).toHaveCount(0);
  });
});
