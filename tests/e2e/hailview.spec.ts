import { test, expect, type Page } from '@playwright/test';

// HailView (app/hailview/page.tsx, afs-hv-004) is a public tool with no
// Supabase auth gate, calling the real Phase 1/2/3 pipeline end-to-end
// (Nominatim geocoding, IEM Local Storm Reports, the deterministic scoring
// engine in lib/hailview/replacement-score.ts, and the agentic explanation
// layer in lib/hailview/explanation.ts) against a real address. The
// explanation panel renders `result.narrative` (real agent text) when the
// agent call succeeds, or the deterministic fallback template when it
// doesn't — either way `hailview-explanation` must be non-empty, so these
// tests assert on that rather than on which of the two produced it.
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
    // Real agent-generated narrative (or, if the agent call failed for any
    // reason, the deterministic fallback template) — either way this must
    // render real, non-empty text, never a blank panel.
    const explanationText = await page.getByTestId('hailview-explanation').innerText();
    expect(explanationText.trim().length).toBeGreaterThan(0);
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
