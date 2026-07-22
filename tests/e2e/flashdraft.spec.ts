import { test, expect } from '@playwright/test';

// app/studio/draft is a public page (no login required to draw or match a
// profile — only the eventual quote submission needs auth/guest email).
// Gated on E2E_TEST_EMAIL/E2E_TEST_PASSWORD anyway, consistent with every
// other spec in this suite — see tests/e2e/README.md and the identical
// note in quote-request.spec.ts.
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

test.describe('FlashDraft canvas', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');

  test('draws a two-leg profile, shows a nonzero blank width and bend count, and opens the 3D submit confirmation', async ({
    page,
  }) => {
    await page.goto('/studio/draft');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('FlashDraft canvas did not render a bounding box.');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Point 1 — a single click on an empty canvas places the first point;
    // there's no prior point yet to drag a segment from (see
    // handlePointerDown's `points.length === 0` branch).
    await page.mouse.click(cx, cy);

    // Point 2 — drag-to-draw leg 1, horizontally. Pointerdown near the
    // last point arms drag-drawing; MIN_DRAG_SEGMENT_IN (0.05") is easily
    // cleared by a 150px drag at the default 1x zoom (20px/inch → 7.5").
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy, { steps: 10 });
    await page.mouse.up();

    // Point 3 — drag-to-draw leg 2, perpendicular to leg 1, creating one
    // real interior bend point (not just a straight extension).
    await page.mouse.move(cx + 150, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy - 150, { steps: 10 });
    await page.mouse.up();

    // bendCountLive = points.length - 2 → 1 for a 3-point/2-leg profile.
    await expect(page.getByText('Bend Count: 1')).toBeVisible();

    // blankWidthInLive sums leg lengths — formatInches(0) renders as
    // exactly `0"`, so any other value confirms a nonzero blank width.
    const blankWidthLine = page.getByText(/^Blank Width:/);
    await expect(blankWidthLine).toBeVisible();
    await expect(blankWidthLine).not.toHaveText('Blank Width: 0"');

    // openSubmitFlow() requires material + gauge before it will open the
    // 3D confirmation modal.
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Submit for Quote' }).click();

    // SubmitConfirmation3DModal's heading is conditional on whether the
    // selected material is a painted finish.
    await expect(
      page.getByRole('heading', { name: /Confirm Your Profile|please confirm your painted side/i })
    ).toBeVisible();
  });
});
