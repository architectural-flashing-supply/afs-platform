import { test, expect, type Page } from '@playwright/test';

// HailView (app/hailview/page.tsx, afs-hv-003) is a public tool with no
// Supabase auth gate, calling the real Phase 1/2 pipeline end-to-end
// (Nominatim geocoding, IEM Local Storm Reports, the deterministic scoring
// engine in lib/hailview/replacement-score.ts) against a real address. This
// does not assert on result.narrative — Phase 3 deliberately renders a
// placeholder explanation instead (see the page's own header comment).
const TEST_ADDRESS = '1500 Marilla St, Dallas, TX 75201';

// Overridable so this spec can run against a dev server that isn't bound to
// playwright.config.ts's default :3000 (e.g. that port already held by an
// unrelated process) without editing shared config.
test.use({ baseURL: process.env.HAILVIEW_E2E_BASE_URL || 'http://localhost:3000' });

async function submitAndWaitForResult(page: Page) {
  await page.getByTestId('hailview-submit').click();
  await expect(page.getByTestId('hailview-score')).toBeVisible({ timeout: 30000 });
}

test.describe('HailView — real address, real scoring, all four material types', () => {
  test('asphalt shingle produces a real, in-range computed score', async ({ page }) => {
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('asphalt_shingle');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const scoreText = await page.getByTestId('hailview-score').innerText();
    const score = Number(scoreText);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    await expect(page.getByTestId('hailview-tier')).toBeVisible();
    // Placeholder explanation is a deterministic template built from this
    // same score — not the Phase 4 agent narrative (see page header comment).
    await expect(page.getByTestId('hailview-explanation-placeholder-label')).toBeVisible();
    await expect(page.getByTestId('hailview-explanation')).toContainText(`scored ${score}`);
    await expect(page.getByTestId('hailview-storm-timeline').or(page.getByText('No hail events recorded'))).toBeVisible();

    await page.screenshot({ path: 'test-results/hailview-asphalt-shingle.png', fullPage: true });
  });

  test('metal roofing (R-panel, 26ga) produces a real, in-range computed score', async ({ page }) => {
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('metal');
    await page.locator('#hailview-metal-subtype').selectOption('metal_r_panel');
    await page.locator('#hailview-metal-gauge').selectOption('26ga');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const scoreText = await page.getByTestId('hailview-score').innerText();
    const score = Number(scoreText);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    await expect(page.getByTestId('hailview-tier')).toBeVisible();

    await page.screenshot({ path: 'test-results/hailview-metal-r-panel.png', fullPage: true });
  });

  test('TPO/PVC membrane (60mil) produces a real, in-range computed score', async ({ page }) => {
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('tpo_pvc_membrane');
    await page.locator('#hailview-mil').selectOption('60');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const scoreText = await page.getByTestId('hailview-score').innerText();
    const score = Number(scoreText);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    await expect(page.getByTestId('hailview-tier')).toBeVisible();
  });

  test('wood shake produces a real, in-range computed score', async ({ page }) => {
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('wood_shake');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const scoreText = await page.getByTestId('hailview-score').innerText();
    const score = Number(scoreText);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    await expect(page.getByTestId('hailview-tier')).toBeVisible();
  });
});
