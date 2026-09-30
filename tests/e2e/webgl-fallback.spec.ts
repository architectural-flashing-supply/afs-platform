import { test, expect } from '@playwright/test';

/**
 * F-06 — A WebGL FAILURE DEGRADES TO THE 2D VIEW.
 *
 * This does not simulate the failure with a test-only flag or a prop. It makes
 * the browser genuinely refuse a WebGL context by returning null from
 * `HTMLCanvasElement.prototype.getContext` for the three WebGL context ids, which
 * is exactly what a blacklisted GPU driver, a hardened kiosk browser or an
 * exhausted context pool does. `new THREE.WebGLRenderer()` then throws for real,
 * and ProfileViewer3D's catch is the code under test.
 *
 * `getContext('2d')` is deliberately left working — FlashDraft's drawing canvas
 * is a 2D context, and breaking that would test nothing about WebGL.
 */
const BLOCK_WEBGL = () => {
  const real = HTMLCanvasElement.prototype.getContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HTMLCanvasElement.prototype.getContext = function (id: string, ...rest: any[]): any {
    if (id === 'webgl' || id === 'webgl2' || id === 'experimental-webgl') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (real as any).call(this, id, ...rest);
  };
};

async function openThreeDView(page: import('@playwright/test').Page) {
  await page.goto('/studio/draft');
  // The toolbar's view-mode group; the 3D button is titled "3D View".
  const threeD = page.getByTitle('3D View');
  await expect(threeD).toBeVisible({ timeout: 30000 });
  await threeD.click();
}

test.describe('FlashDraft 3D viewer degrades to the flat 2D view when WebGL is unavailable', () => {
  test('WebGL refused: the 2D cross-section renders instead of an empty panel', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await page.addInitScript(BLOCK_WEBGL);
    await openThreeDView(page);

    const fallback = page.getByTestId('profile-2d-fallback');
    await expect(fallback).toBeVisible({ timeout: 20000 });

    // The plain-English reason, not an exception string.
    await expect(page.getByTestId('profile-2d-fallback-reason')).toContainText('flat 2D drawing');

    // The real geometry is drawn, not a placeholder box: an SVG path with a
    // move-and-line command list, plus one vertex dot per point.
    const pathD = await fallback.locator('path').first().getAttribute('d');
    expect(pathD).toMatch(/^M[-\d.]+,[-\d.]+( L[-\d.]+,[-\d.]+)+$/);
    expect(await fallback.locator('circle').count()).toBeGreaterThanOrEqual(3);

    // The labels the 3D view would have shown: fractional inches and signed
    // degrees, both produced by lib/flashdraft/geometry.ts + format-inches.
    // textContent, not innerText: `innerText` is an HTMLElement property and is
    // undefined on an SVGElement, so allInnerTexts() returns blanks here.
    const labels = await fallback.locator('text').allTextContents();
    expect(labels.some((l) => /"/.test(l))).toBe(true);
    expect(labels.some((l) => /°$/.test(l))).toBe(true);

    // No WebGL canvas was left behind for the user to stare at.
    expect(await fallback.locator('canvas').count()).toBe(0);

    // The failure was reported to the console for whoever has to diagnose it.
    expect(consoleErrors.some((e) => e.includes('[ProfileViewer3D] WebGL unavailable'))).toBe(true);

    await page.screenshot({ path: 'test-results/f06-webgl-fallback-2d.png', fullPage: false });
  });

  test('control: with WebGL available the 3D canvas renders and no fallback appears', async ({ page }) => {
    await openThreeDView(page);
    // Headless Chromium here has SwiftShader, so a real WebGL canvas is created.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('profile-2d-fallback')).toHaveCount(0);
  });
});
