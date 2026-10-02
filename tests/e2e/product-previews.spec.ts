import { test, expect } from '@playwright/test';
import { PRODUCT_PREVIEW_SHAPES } from '../../lib/data/product-preview-shapes';
import { getCatalogProducts } from '../../lib/data/products-page';

/**
 * One popup screenshot per SCHEMATIC preview (Task 5f), with the rules that
 * make a traced shape safe to show asserted on every one of them rather than
 * spot-checked: 3D renders, no Select & Design, no Dimensions control, and no
 * dimension or angle label anywhere.
 */

const SHOT_DIR = 'test-results/product-previews';

const previewed = getCatalogProducts().filter((p) => p.hasSchematicPreview);

test.describe('schematic product previews', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the table and the page agree on which products are previewed', () => {
    expect(previewed.length).toBe(Object.keys(PRODUCT_PREVIEW_SHAPES).length);
    expect(previewed.length).toBeGreaterThan(0);
  });

  for (const product of previewed) {
    test(`${product.name} renders a schematic preview`, async ({ page }) => {
      await page.goto('/products');
      await page.getByRole('button', { name: product.name, exact: false }).first().click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(page.getByText('Loading 3D view…')).toHaveCount(0, { timeout: 20000 });
      await expect(dialog.locator('canvas').first()).toBeVisible();
      await page.waitForTimeout(1200);

      // Request a Quote only — a traced shape is never fabricable.
      await expect(dialog.getByText('Request a Quote')).toBeVisible();
      await expect(dialog.getByText('Select & Design')).toHaveCount(0);

      // No dimensions control and no labels: nothing invented reaches a customer.
      await expect(dialog.getByRole('button', { name: /Dimensions/ })).toHaveCount(0);
      const labels = dialog.locator('div[style*="translate"]').filter({ hasText: /["°]/ });
      expect(await labels.count(), 'a schematic preview rendered a dimension label').toBe(0);

      await dialog.screenshot({ path: `${SHOT_DIR}/${product.id}.png` });
    });
  }
});
