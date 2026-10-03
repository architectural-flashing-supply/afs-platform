import { test, expect, type Page } from '@playwright/test';

/**
 * THE ORDER VALIDATOR, IN A REAL BROWSER — SPEC_AI_ORDER_VALIDATOR.md section 7.
 *
 * WHY EVERY SCENARIO HERE IS DATABASE-INDEPENDENT, which is a deliberate design
 * choice and not a shortcut. The validator's rules come from three places: the
 * real seeded `product_profiles` ranges, the limits config, and pure geometry.
 * Only the first needs a database — and `product_profiles` RLS is
 * `auth.uid() IS NOT NULL`, so a GUEST browser cannot read a single range even
 * against a live project. A range-check E2E would therefore need a signed-in
 * contractor AND a reachable Supabase, and would be reporting on the fixture
 * data rather than on the behaviour.
 *
 * So the browser tests drive the rules that are genuinely config- and
 * geometry-driven, where the assertion is about the UI contract the spec
 * specifies:
 *
 *   section 3's coping-cap rule     -> inline error + Next disabled
 *   section 3's step-flashing rule  -> inline warning
 *   section 5's acknowledge flow    -> amber banner, then an advance
 *
 * The RANGE rules are covered exhaustively in `lib/order-validator/rules.test.ts`
 * against the exact values migration 002 seeds — bound by bound, including every
 * NULL — which is a stronger assertion about those numbers than a browser can
 * make. What a browser is needed for is what it does here: proving the message
 * really renders, the border really appears, and the button really is disabled.
 */

const QUOTE_URL = '/quote';

/** Step 1: pick a profile, a material and a gauge, then move to Dimensions. */
async function completeStepOne(page: Page, profile: string, material: string, gauge: string): Promise<void> {
  await page.goto(QUOTE_URL);
  await page.getByRole('button', { name: profile, exact: true }).click();
  await page.locator('#material').selectOption(material);
  await page.locator('#gauge').selectOption(gauge);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(
    page.locator('#width'),
    'Expected to be on the Dimensions step. If this fails, step 1 did not validate — check whether the chosen material now requires a colour selection.'
  ).toBeVisible();
}

async function fillDimensions(
  page: Page,
  values: { width?: string; height?: string; legA?: string; legB?: string; lengthFt?: string; quantity?: string }
): Promise<void> {
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined) continue;
    await page.locator(`#${field}`).fill(value);
  }
}

test.describe('the order validator in the Quote Builder', () => {
  test('physically impossible dimensions show an inline error and block the advance', async ({ page }) => {
    // ARRANGE — a coping cap whose two drip legs add up to its whole width.
    // SPEC §3: "Leg A + Leg B must be less than Width (legs fold down from the
    // cap)". Every value is inside the seeded Coping Cap range on its own, so
    // this is the profile-specific rule firing and nothing else.
    await completeStepOne(page, 'Coping Cap', 'Galvanized Steel', '20 ga');

    // ACT
    await fillDimensions(page, { width: '6', height: '6', legA: '4', legB: '4', lengthFt: '10', quantity: '2' });

    // ASSERT — the message under Leg A, naming both numbers.
    const message = page.locator('#legA-validation');
    await expect(
      message,
      'Expected an inline message under Leg A. SPEC §2 requires the error "below input", because a banner alone does not tell the customer which of the four boxes to change.'
    ).toContainText('Leg A plus Leg B');
    await expect(
      message,
      'Expected the message to state the combined leg length (8") so the customer can see what is wrong without doing the arithmetic.'
    ).toContainText('8"');

    // ASSERT — the input itself is marked, not just the text beneath it.
    await expect(
      page.locator('#legA'),
      'Expected aria-invalid on the offending input. SPEC §2 asks for a red border; the border is a Tailwind class a browser assertion cannot read meaningfully, and aria-invalid is the same state expressed where it is both testable and useful to a screen reader.'
    ).toHaveAttribute('aria-invalid', 'true');

    // ASSERT — and the advance really is blocked.
    await expect(
      page.getByRole('button', { name: 'Next' }),
      'Expected Next disabled. SPEC §2: "[Next] button disabled while any error exists". An error message beside a working Next button is advice, not a gate.'
    ).toBeDisabled();
  });

  test('correcting the dimensions clears the error and re-enables the advance', async ({ page }) => {
    // The other half of the gate, and the half that is easy to get wrong: a
    // validator that cannot be satisfied is worse than no validator.
    await completeStepOne(page, 'Coping Cap', 'Galvanized Steel', '20 ga');
    await fillDimensions(page, { width: '6', height: '6', legA: '4', legB: '4', lengthFt: '10', quantity: '2' });
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    // ACT — widen the cap so the legs fit inside it.
    await page.locator('#width').fill('12');

    // ASSERT
    await expect(
      page.locator('#legA-validation'),
      'Expected the message gone once the legs fit inside the cap.'
    ).toBeEmpty();
    await expect(
      page.getByRole('button', { name: 'Next' }),
      'Expected Next enabled again. The live pass is recomputed on every keystroke, so the gate has to open as soon as the geometry is possible.'
    ).toBeEnabled();
  });

  test('a dimension below a stated minimum shows an inline message without blocking', async ({ page }) => {
    // SPEC §3: "Step Flashing: Width should be at least 4 inches for standard
    // shingle coverage." It is a "should", so this is a warning — a narrower
    // step flashing is fabricable, it just will not cover the course. Step
    // Flashing deliberately has NO product_profiles row (one of five such Quote
    // Builder labels), which is exactly why the limit lives in the config.
    await completeStepOne(page, 'Step Flashing', 'Galvanized Steel', '26 ga');

    await fillDimensions(page, { width: '3', lengthFt: '1', quantity: '40' });

    await expect(
      page.locator('#width-validation'),
      'Expected the inline message under Width, naming the 4" minimum.'
    ).toContainText('4"');
    await expect(
      page.getByRole('button', { name: 'Next' }),
      'Expected Next still enabled: a warning is acknowledged, never refused. Blocking here would stop AFS taking an order it can perfectly well fabricate.'
    ).toBeEnabled();
  });

  test('a warning banner offers Acknowledge and Continue, and continuing works', async ({ page }) => {
    // SPEC §5: "warnings -> show amber warning banners with [Acknowledge and
    // Continue] option ... User must explicitly acknowledge each warning".
    // The banner comes from the SERVER pass at Next, not from the live one — a
    // banner that appeared mid-keystroke would shout at someone halfway through
    // typing a number.
    await completeStepOne(page, 'Step Flashing', 'Galvanized Steel', '26 ga');
    await fillDimensions(page, { width: '3', lengthFt: '1', quantity: '40' });

    // ACT — the first press runs the server check and must NOT advance.
    await page.getByRole('button', { name: 'Next' }).click();

    const banner = page.getByTestId('order-validator-warnings');
    await expect(
      banner,
      'Expected the amber warning banner after the server check. If this times out, check that POST /api/quote-requests/validate answered — it is designed to fall through to a clean result on any internal failure, which would advance the page instead.'
    ).toBeVisible();
    await expect(
      page.locator('#width'),
      'Expected to still be on the Dimensions step: an unacknowledged warning does not advance.'
    ).toBeVisible();

    // ACT — acknowledge, then advance.
    await banner.getByRole('button', { name: 'Acknowledge and Continue' }).click();
    await expect(banner, 'Expected the banner gone once acknowledged.').toBeHidden();
    await page.getByRole('button', { name: 'Next' }).click();

    // ASSERT — the Project step.
    await expect(
      page.locator('#projectName'),
      'Expected to reach the Project step. An acknowledgement that does not let the customer through is a dead end.'
    ).toBeVisible();
  });

  test('an edit after acknowledging re-asks, so an acknowledgement cannot outlive its warning', async ({ page }) => {
    // The property SPEC §5's "acknowledge each warning" depends on. Without it a
    // customer could accept a warning about a 3 inch width, change it to 1 inch,
    // and walk past a warning about the new number that they never saw.
    await completeStepOne(page, 'Step Flashing', 'Galvanized Steel', '26 ga');
    await fillDimensions(page, { width: '3', lengthFt: '1', quantity: '40' });
    await page.getByRole('button', { name: 'Next' }).click();

    const banner = page.getByTestId('order-validator-warnings');
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Acknowledge and Continue' }).click();
    await expect(banner).toBeHidden();

    // ACT — change the very dimension that was warned about.
    await page.locator('#width').fill('1');
    await page.getByRole('button', { name: 'Next' }).click();

    // ASSERT — asked again, and still on this step.
    await expect(
      page.getByTestId('order-validator-warnings'),
      'Expected the warning re-raised for the new width. The acknowledgement is cleared by any step-2 edit, so it cannot be spent on a number that is no longer on the form.'
    ).toBeVisible();
    await expect(page.locator('#width'), 'Expected to still be on the Dimensions step.').toBeVisible();
  });

  test('a valid request passes straight through with nothing shown', async ({ page }) => {
    // The regression that matters most. A validator whose false-positive rate is
    // anything but zero costs AFS real orders, and on this platform the next
    // button along eventually reaches a physical bending machine.
    await completeStepOne(page, 'Coping Cap', 'Galvanized Steel', '20 ga');
    await fillDimensions(page, { width: '12', height: '6', legA: '3', legB: '3', lengthFt: '10', quantity: '4' });

    await expect(
      page.locator('#legA-validation'),
      'Expected no inline message on a coping cap that is inside every seeded range with legs that fit inside the cap.'
    ).toBeEmpty();
    await expect(page.locator('#width-validation'), 'Expected no inline message on the width.').toBeEmpty();

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(
      page.getByTestId('order-validator-errors'),
      'Expected no error banner from the server pass either.'
    ).toBeHidden();
    await expect(
      page.locator('#projectName'),
      'Expected to advance to the Project step on the first press. A clean request must not be made to press Next twice.'
    ).toBeVisible();
  });
});
