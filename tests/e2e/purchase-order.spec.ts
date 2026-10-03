import { test, expect } from '@playwright/test';

/**
 * PURCHASE ORDER INTEGRATION — SPEC_PURCHASE_ORDER_INTEGRATION.md
 *
 * WHAT THIS SPEC CAN AND CANNOT REACH, STATED UP FRONT.
 *
 * `app/checkout/page.tsx`'s own `load()` requires a `?quote=<id>` pointing at a
 * real `quotes` row owned by the signed-in user with `status = 'sent'`, and
 * there is no "browse to checkout" entry point anywhere in the app — checkout
 * only happens from /account/quotes/[id] after AFS has sent a formal quote.
 * `tests/e2e/README.md` records that no test account exists in this repo, so
 * this authoring session cannot create that fixture. The same constraint that
 * shapes `checkout.spec.ts` shapes this file, and the same credential skip is
 * used rather than a fabricated login.
 *
 * So the REQUIRED-PO BLOCKING BEHAVIOUR — the heart of SPEC §3 — is asserted
 * here against the live form and SKIPS without credentials plus a company that
 * has `require_po = true`. It is reported as skipped, never as passing.
 *
 * The behaviour that CAN be proved without that fixture is proved here, and the
 * field's two rendered states are proved exactly, in this run, by
 * `lib/checkout/po-number-field.render.test.ts` — which server-renders the real
 * component and pins the not-required markup to what shipped before the
 * requirement existed. That is where the "nothing changed for everybody else"
 * guarantee is actually tested.
 */
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

/**
 * A company whose `companies.require_po` is true, and a `quotes` row with
 * `status='sent'` owned by E2E_TEST_EMAIL. Both are real-data prerequisites a
 * human must set up; there is deliberately no code here that creates them.
 */
const requiredPoQuoteId = process.env.E2E_REQUIRED_PO_QUOTE_ID ?? '';

/** SPEC §3's exact sentence. Also asserted as a literal in lib/checkout/po-number.test.ts. */
const PO_REQUIRED_ERROR = 'Purchase Order Number is required for your account';
/** SPEC §2's exact hint. */
const PO_REQUIRED_HINT = 'Your account requires a PO number for all orders';

const PRICE_PATTERN = /\$[\d,]+(\.\d{2})?/;

test.describe('Purchase Order integration', () => {
  test.describe('checkout gating holds, and no price leaks on the way', () => {
    test('an unauthenticated visitor never reaches the PO field or a price', async ({ page }) => {
      await page.goto('/checkout?quote=00000000-0000-0000-0000-000000000000');

      // middleware.ts's isCheckoutRoute redirects before the page renders —
      // the same behaviour checkout.spec.ts asserts.
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('#po-number')).toHaveCount(0);
      await expect(page.getByText(PRICE_PATTERN)).toHaveCount(0);
    });
  });

  test.describe('authenticated', () => {
    test.use({ storageState: 'tests/e2e/.auth/user.json' });
    test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');

    test('a quote the account does not own shows no PO field and no price', async ({ page }) => {
      await page.goto('/checkout?quote=00000000-0000-0000-0000-000000000000');

      await expect(page.getByRole('heading', { name: 'Checkout Unavailable' })).toBeVisible();
      await expect(page.locator('#po-number')).toHaveCount(0);
      await expect(page.getByText(PRICE_PATTERN)).toHaveCount(0);
    });

    test.describe('a company that requires a PO number', () => {
      test.skip(
        !requiredPoQuoteId,
        'E2E_REQUIRED_PO_QUOTE_ID not set — needs a quotes row with status=sent owned by the test account, whose company has companies.require_po = true. See this file’s header.'
      );

      test('the field is marked required and explains why', async ({ page }) => {
        await page.goto(`/checkout?quote=${requiredPoQuoteId}`);

        const field = page.locator('#po-number');
        await expect(field).toBeVisible();
        // SPEC §3: "PO field marked required in checkout".
        await expect(field).toHaveAttribute('aria-required', 'true');
        // SPEC §2: the hint, and the label that replaces "PO Number (optional)".
        await expect(page.getByText(PO_REQUIRED_HINT)).toBeVisible();
        await expect(page.getByText('(optional)')).toHaveCount(0);
        // SPEC §2: "Max: 50 characters".
        await expect(field).toHaveAttribute('maxlength', '50');
      });

      test('Place Order is blocked with an empty PO, and says exactly why', async ({ page }) => {
        await page.goto(`/checkout?quote=${requiredPoQuoteId}`);

        // Satisfy every OTHER gate, so the only thing standing between the
        // customer and submit is the missing PO number. Net terms is used where
        // available so no card is ever involved; this test must never reach a
        // real payment.
        await page.getByLabel('Delivery Address').fill('100 Test Row, Burnet, TX 78611');
        for (const consent of [
          'I have reviewed and accept the AFS Terms of Sale.',
          'I understand that custom fabricated items cannot be returned once production begins.',
          'I confirm these specifications and dimensions are final and correct.',
        ]) {
          await page.getByLabel(consent).check();
        }

        const placeOrder = page.getByRole('button', { name: 'Place Order' });

        // SPEC §3: "Submit blocked" ...
        await expect(page.locator('#po-number')).toHaveValue('');
        await expect(placeOrder).toBeDisabled();
        // ... and the sentence, so a dead button is not the only feedback.
        await expect(page.getByText(PO_REQUIRED_ERROR)).toBeVisible();
      });

      test('whitespace does not satisfy the requirement', async ({ page }) => {
        await page.goto(`/checkout?quote=${requiredPoQuoteId}`);

        await page.getByLabel('Delivery Address').fill('100 Test Row, Burnet, TX 78611');
        for (const consent of [
          'I have reviewed and accept the AFS Terms of Sale.',
          'I understand that custom fabricated items cannot be returned once production begins.',
          'I confirm these specifications and dimensions are final and correct.',
        ]) {
          await page.getByLabel(consent).check();
        }

        await page.locator('#po-number').fill('     ');

        // Three spaces is not a purchase order number — the order would carry no
        // usable reference, which is the whole point of the requirement.
        await expect(page.getByRole('button', { name: 'Place Order' })).toBeDisabled();
        await expect(page.getByText(PO_REQUIRED_ERROR)).toBeVisible();
      });

      test('entering a real PO number clears the block', async ({ page }) => {
        await page.goto(`/checkout?quote=${requiredPoQuoteId}`);

        await page.getByLabel('Delivery Address').fill('100 Test Row, Burnet, TX 78611');
        for (const consent of [
          'I have reviewed and accept the AFS Terms of Sale.',
          'I understand that custom fabricated items cannot be returned once production begins.',
          'I confirm these specifications and dimensions are final and correct.',
        ]) {
          await page.getByLabel(consent).check();
        }

        await page.locator('#po-number').fill('PO-2026-04521');

        await expect(page.getByText(PO_REQUIRED_ERROR)).toHaveCount(0);
        // NOTE: deliberately NOT clicked. This spec never places an order and
        // never reaches Stripe — the run that authored it is barred from making
        // a real charge. Asserting the gate has opened is the behaviour under
        // test; what happens after the click is create-intent's own contract.
      });

      test('the field is present for Pickup as well as Ship', async ({ page }) => {
        await page.goto(`/checkout?quote=${requiredPoQuoteId}`);

        // The regression this item fixed: the input used to live inside the Ship
        // branch, so a Pickup customer never saw it — and once their company
        // requires one, the order could not be placed at all.
        await page.getByRole('radio', { name: 'Pickup' }).check();

        await expect(page.locator('#po-number')).toBeVisible();
        await expect(page.getByText(PO_REQUIRED_HINT)).toBeVisible();
      });
    });
  });

  test.describe('admin — the company PO requirement control', () => {
    test.use({ storageState: 'tests/e2e/.auth/user.json' });
    test.skip(
      !hasCreds,
      'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set, and the account must have profiles.role = admin — see tests/e2e/README.md'
    );

    test('the customer detail page carries a Purchase Order Requirement panel', async ({ page }) => {
      await page.goto('/admin/customers');

      const firstCustomer = page.locator('a[href^="/admin/customers/"]').first();
      const count = await firstCustomer.count();
      test.skip(count === 0, 'No customers exist in this environment to open.');

      await firstCustomer.click();
      await expect(page.getByRole('heading', { name: 'Purchase Order Requirement' })).toBeVisible();

      // The panel renders in BOTH states, so exactly one of these must be true:
      // the company checkbox, or the copy explaining that there is no company
      // account to attach the requirement to. A panel that rendered neither
      // would be the silent-no-op this item set out to avoid.
      const checkbox = page.getByText('Require PO Number on all orders');
      const noCompanyCopy = page.getByText('has no company account on file', { exact: false });
      const shown = (await checkbox.count()) + (await noCompanyCopy.count());
      expect(
        shown,
        'The Purchase Order Requirement panel must show either the company checkbox or the no-company explanation — never an empty box.'
      ).toBeGreaterThan(0);
    });

    test('no price is introduced on the admin customer page by this panel', async ({ page }) => {
      await page.goto('/admin/customers');
      const firstCustomer = page.locator('a[href^="/admin/customers/"]').first();
      test.skip((await firstCustomer.count()) === 0, 'No customers exist in this environment to open.');
      await firstCustomer.click();

      // The panel is a boolean setting. It must not render a dollar amount of
      // its own — the page's existing Order History totals are a separate,
      // pre-existing admin-only surface.
      const panel = page
        .locator('div')
        .filter({ has: page.getByRole('heading', { name: 'Purchase Order Requirement' }) })
        .last();
      await expect(panel.getByText(PRICE_PATTERN)).toHaveCount(0);
    });
  });
});
