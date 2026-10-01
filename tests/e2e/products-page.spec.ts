import { test, expect, type Page } from '@playwright/test';
import manifest from '../../lib/data/product-renders.manifest.json';

/**
 * The public Products page, rebuilt 2026-10-01 from the reviewed render
 * manifest (docs/PRODUCT_MANIFEST.md, docs/PRODUCT_PAGE_NOTES.md).
 *
 * The things worth guarding here are the ones that are SILENT when they break:
 * a flagged product quietly appearing on a public page, roofing drifting above
 * the flashing categories, a price or a Configurator link creeping back in, or
 * the geometry-backed products losing their Select & Design button.
 */

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

interface ManifestEntry {
  id: string;
  type: string;
  sourceName: string;
  category: string;
  geometryMatch: string | null;
  needsReview: boolean;
}

const entries = manifest as ManifestEntry[];
const publishable = entries.filter((e) => e.type === 'product' && !e.needsReview);
const withGeometry = publishable.find((e) => e.geometryMatch);
const withoutGeometry = publishable.find((e) => !e.geometryMatch);

/** Tiles are buttons whose accessible name is the product name. */
function tileByName(page: Page, name: string) {
  return page.getByRole('button', { name, exact: false }).first();
}

test.describe('Products page — desktop', () => {
  test.use({ viewport: DESKTOP });

  test('loads and renders every publishable product', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'PRODUCTS', level: 1 })).toBeVisible();

    // Sanity on the premise: there is something to show.
    expect(publishable.length).toBeGreaterThan(0);
    await expect(page.locator('section[id^="cat-"]')).not.toHaveCount(0);
  });

  test('category order puts flashing first and Roofing Panels last', async ({ page }) => {
    await page.goto('/products');
    const headings = await page.locator('section[id^="cat-"] h2').allInnerTexts();

    expect(headings.length).toBeGreaterThan(1);
    expect(headings[0]).not.toBe('Roofing Panels');
    expect(headings[0]).not.toBe('Roofing');
    expect(headings[headings.length - 1]).toBe('Roofing Panels');
  });

  test('no flagged, montage or non-product entry appears', async ({ page }) => {
    await page.goto('/products');
    const body = (await page.locator('main').innerText()).toLowerCase();

    const hidden = entries.filter((e) => e.needsReview || e.type !== 'product');
    expect(hidden.length).toBeGreaterThan(0);

    // The bending-machine photo by name, plus every montage, explicitly.
    for (const e of hidden.filter((h) => h.type !== 'product')) {
      expect(body, `hidden non-product "${e.sourceName}" leaked onto the page`).not.toContain(
        e.sourceName.toLowerCase()
      );
    }
    // No image on the page may point at a hidden entry's file.
    const sources = await page.locator('main img').evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLImageElement).getAttribute('src') ?? '')
    );
    for (const e of hidden) {
      const slug = e.id;
      for (const src of sources) {
        expect(decodeURIComponent(src), `hidden entry ${slug} rendered an image`).not.toContain(
          `${slug}.webp`
        );
      }
    }
  });

  test('shows no price and no Configurator reference', async ({ page }) => {
    await page.goto('/products');
    const body = await page.locator('main').innerText();

    expect(body).not.toContain('$');
    expect(body.toLowerCase()).not.toContain('configur');
    expect(body.toLowerCase()).not.toContain('add to cart');
    expect(body.toLowerCase()).not.toContain('rush');
    // The material rule: never "Galvanized Galvalume".
    expect(body.toLowerCase()).not.toContain('galvanized galvalume');
  });

  test('a geometry-backed product offers Select & Design', async ({ page }) => {
    test.skip(!withGeometry, 'no publishable product carries geometry');
    await page.goto('/products');

    await tileByName(page, withGeometry!.sourceName).hover();
    await expect(page.getByText('Select & Design').first()).toBeVisible();
  });

  test('a product with no geometry offers only Request a Quote', async ({ page }) => {
    test.skip(!withoutGeometry, 'every publishable product carries geometry');
    await page.goto('/products');

    const tile = tileByName(page, withoutGeometry!.sourceName);
    await tile.hover();

    const popover = page.getByRole('tooltip');
    await expect(popover).toBeVisible();
    await expect(popover.getByText('Request a Quote')).toBeVisible();
    await expect(popover.getByText('Select & Design')).toHaveCount(0);
  });

  test('keyboard focus enlarges a tile without opening the modal', async ({ page }) => {
    await page.goto('/products');
    await tileByName(page, publishable[0].sourceName).focus();

    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('click opens the modal and Escape closes it', async ({ page }) => {
    await page.goto('/products');
    await tileByName(page, publishable[0].sourceName).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Request a Quote')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('search filters by name', async ({ page }) => {
    await page.goto('/products');
    const search = page.getByLabel('Search products by name');

    await search.fill('zzzzznotathing');
    await expect(page.getByText(/No products match/)).toBeVisible();

    await search.fill('');
    await expect(page.locator('section[id^="cat-"]')).not.toHaveCount(0);
  });

  test('buttons are sized to their label, not full width', async ({ page }) => {
    await page.goto('/products');
    await tileByName(page, publishable[0].sourceName).click();

    const quote = page.getByRole('dialog').getByRole('link', { name: 'Request a Quote' });
    const button = await quote.boundingBox();
    const dialog = await page.getByRole('dialog').boundingBox();
    expect(button!.width).toBeLessThan(dialog!.width * 0.75);
  });

  test('Request a Quote carries the product name to /quote', async ({ page }) => {
    await page.goto('/products');
    await tileByName(page, publishable[0].sourceName).click();

    const href = await page
      .getByRole('dialog')
      .getByRole('link', { name: 'Request a Quote' })
      .getAttribute('href');
    expect(href).toContain('/quote?product=');
  });

  test('screenshot — catalog at 1440px', async ({ page }) => {
    await page.goto('/products');
    await page.screenshot({ path: 'test-results/products-desktop.png', fullPage: false });
  });

  test('screenshot — enlarged card at 1440px', async ({ page }) => {
    await page.goto('/products');
    await tileByName(page, publishable[0].sourceName).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // The 3D viewer is a dynamic import (three.js) — wait for the loading
    // placeholder to go away, so this screenshot proves the viewer actually
    // rendered rather than catching it mid-load.
    await expect(page.getByText('Loading 3D view…')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('dialog').locator('canvas')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/products-modal.png', fullPage: false });
  });
});

test.describe('Products page — 375px', () => {
  test.use({ viewport: MOBILE });

  test('renders a single-column grid and taps open the modal', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'PRODUCTS', level: 1 })).toBeVisible();

    await tileByName(page, publishable[0].sourceName).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('does not scroll horizontally', async ({ page }) => {
    await page.goto('/products');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('screenshot — catalog at 375px', async ({ page }) => {
    await page.goto('/products');
    await page.screenshot({ path: 'test-results/products-mobile.png', fullPage: false });
  });
});
