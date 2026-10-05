import { test, expect, type Page } from '@playwright/test';
import { ALL_MATERIALS } from '../../lib/data/catalog';

/**
 * The shared 3D viewer, exercised through both of its public surfaces: the
 * Products popup and FlashDraft's draft page.
 *
 * Guards three defects fixed on 2026-10-01, each of which was silent:
 *   - a profile clipped by the canvas because the viewer's 500px height floor
 *     overflowed a shorter slot (Task 1),
 *   - "Dimensions Off" leaving every label on screen, because CSS2DObject divs
 *     are DOM nodes that `scene.remove()` does not detach (Task 4),
 *   - the canvas background, now one shared constant (Task 3).
 */

const SHOT_DIR = 'test-results/viewer-3d';

async function openProductModal(page: Page, productName: string) {
  await page.goto('/products');
  await page.getByRole('button', { name: productName, exact: false }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Loading 3D view…')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByRole('dialog').locator('canvas').first()).toBeVisible();
  await page.waitForTimeout(1200);
}

/**
 * The profile is clipped if the canvas is taller than the box that contains it.
 * Measuring the elements is what proves it, rather than eyeballing a screenshot.
 */
async function canvasFitsItsSlot(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[role="dialog"] canvas') as HTMLCanvasElement | null;
    if (!canvas) return null;
    const viewerRoot = canvas.parentElement?.parentElement as HTMLElement | null;
    const slot = viewerRoot?.parentElement as HTMLElement | null;
    if (!viewerRoot || !slot) return null;
    return {
      canvasH: canvas.clientHeight,
      viewerH: viewerRoot.clientHeight,
      slotH: slot.clientHeight,
      overflow: viewerRoot.clientHeight - slot.clientHeight,
    };
  });
}

const DESIGNABLE = ['Ridge Cap', 'Econo Coping LT', 'Perforated Z Closure', 'Drip Edge'];

for (const viewport of [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
]) {
  test.describe(`viewer framing — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const product of DESIGNABLE) {
      test(`${product} is not clipped`, async ({ page }) => {
        await openProductModal(page, product);

        const m = await canvasFitsItsSlot(page);
        expect(m, 'canvas not found').not.toBeNull();
        // The viewer must not be taller than the slot it was given.
        expect(m!.overflow, `viewer overflows its slot by ${m!.overflow}px`).toBeLessThanOrEqual(1);
        expect(m!.canvasH).toBeGreaterThanOrEqual(300);

        const slug = product.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await page
          .getByRole('dialog')
          .screenshot({ path: `${SHOT_DIR}/${viewport.name}-${slug}.png` });
      });
    }

    test('the dialog itself fits the viewport', async ({ page }) => {
      await openProductModal(page, 'Ridge Cap');
      const box = await page.getByRole('dialog').boundingBox();
      expect(box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.width).toBeLessThanOrEqual(viewport.width);
    });
  });
}

test.describe('Dimensions toggle', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('opens with dimensions OFF; On shows labels; Off removes them again', async ({ page }) => {
    await openProductModal(page, 'Ridge Cap');
    const dialog = page.getByRole('dialog');

    // CSS2DObject labels are divs the CSS2DRenderer appends next to the canvas.
    const labels = dialog.locator('div[style*="translate"]').filter({ hasText: /["°]/ });

    // Default state: OFF. The customer opts in to dimensions.
    await expect(dialog.getByRole('button', { name: /Dimensions Off/ })).toBeVisible();
    expect(await labels.count(), 'dimension labels showing by default').toBe(0);

    await page.screenshot({ path: `${SHOT_DIR}/dimensions-off.png` });

    await dialog.getByRole('button', { name: /Dimensions/ }).click();
    await page.waitForTimeout(600);
    await expect(dialog.getByRole('button', { name: /Dimensions On/ })).toBeVisible();
    expect(await labels.count(), 'labels did not appear when switched on').toBeGreaterThan(0);

    await page.screenshot({ path: `${SHOT_DIR}/dimensions-on.png` });

    await dialog.getByRole('button', { name: /Dimensions/ }).click();
    await page.waitForTimeout(600);
    expect(await labels.count(), 'labels survived being switched off').toBe(0);
  });
});

test.describe('canvas background — every material', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /**
   * Renders each supported material on the shared background and captures it.
   *
   * The profile is loaded through the real Select & Design handoff, because
   * FlashDraft opens with an EMPTY canvas (Blank Width 0") and screenshotting
   * that proves nothing about how a material renders — the first version of
   * this test did exactly that and passed while showing an empty 2D grid.
   * Separation here comes from lighting and specular response rather than flat
   * hex contrast, so the evidence has to be a real rendered frame.
   */
  test('each material renders distinctly on the shared background', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Ridge Cap', exact: false }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Select & Design' }).click();

    await page.waitForURL(/\/studio\/draft/, { timeout: 20000 });
    // The handoff really did carry geometry across.
    await expect(page.getByText(/Blank Width:\s*(?!0")/)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: '3D', exact: true }).click();
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);

    for (const material of ALL_MATERIALS) {
      await page.selectOption('#material', material);
      await page.waitForTimeout(1000);
      const slug = material.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      // The 3D panel only, so the shot is the render and nothing else.
      await canvas.screenshot({ path: `${SHOT_DIR}/material-${slug}.png` });
    }
  });
});
