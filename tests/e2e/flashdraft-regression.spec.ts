import { test, expect, type Page } from '@playwright/test';

// Regression coverage for three bugs reported live on 2026-09-14:
//   1. Double-click on a leg endpoint doesn't open the hem popup.
//   2. Clicking between two different legs causes the profile/view to jump.
//   3. The inches stepper still increments by whole inches, not 1/16".
// No auth required — FlashDraft's canvas is a public page (see the note in
// flashdraft.spec.ts).

async function drawTwoLegProfile(page: Page, cx: number, cy: number) {
  await page.mouse.click(cx, cy);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 137, cy - 41, { steps: 10 });
  await page.mouse.up();
  await page.mouse.move(cx + 137, cy - 41);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy - 179, { steps: 10 });
  await page.mouse.up();
}

test.describe('FlashDraft regression — 2026-09-14', () => {
  test('BUG 2 repro: clicking leg A then leg B must not change zoom/pan', async ({ page }) => {
    await page.goto('/studio/draft');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);

    const zoomLabel = page.getByText(/^\d+%$/);
    const zoomBefore = await zoomLabel.textContent();

    // Click leg A's body (midpoint of first leg) to select it and mount the
    // segment-length input.
    await page.mouse.click(cx + 68, cy - 20);
    const legAValue = await page.locator('input[inputmode="decimal"]').inputValue();
    expect(legAValue.length).toBeGreaterThan(0);

    // Now click leg B's body — this is the exact gesture from the video.
    await page.mouse.click(cx + 83, cy - 110);

    const zoomAfter = await zoomLabel.textContent();
    await page.screenshot({ path: 'test-results/evidence-bug2-after-leg-switch.png' });
    expect(zoomAfter).toBe(zoomBefore);
  });

  test('BUG 1 repro: double-click on a leg endpoint opens the hem popup', async ({ page }) => {
    await page.goto('/studio/draft');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);

    // Select leg A first (mounts + focuses the segment-length input), then
    // double-click the FAR endpoint (point 0) — reproduces the exact
    // sequence from the video: select a leg, then go double-click an
    // endpoint.
    await page.mouse.click(cx + 68, cy - 20);
    await page.mouse.dblclick(cx, cy);

    await expect(page.getByText(/Hem$/)).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/evidence-bug1-hem-popup-open.png' });
  });

  test('BUG 3 repro: inches ArrowUp increments by 1/16", not a whole inch', async ({ page }) => {
    await page.goto('/studio/draft');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');
    await drawTwoLegProfile(page, box.x + box.width / 2, box.y + box.height / 2);

    const inches = page.locator('#lengthInches');
    await inches.fill('5.75');
    await inches.focus();
    await inches.press('ArrowUp');
    await expect(inches).toHaveValue('5.8125');
    await page.screenshot({ path: 'test-results/evidence-bug3-inches-stepped-1-16.png' });
  });
});
