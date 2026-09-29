import { test, expect } from '@playwright/test';

// 2026-09-29 rename verification. app/studio/draft is a public page (see
// flashdraft.spec.ts's header), so this needs no credentials and runs against
// whatever PLAYWRIGHT_BASE_URL points at — alpha, for the real check.
//
// The bar: the FlashDraft material dropdown offers "Galvalume", never
// "Galvanized Galvalume", and picking it offers the same gauge list the old
// entry had. The standalone "Galvanized Steel" material must still be there.

const EXPECTED_GAUGES = ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'];

test.describe('FlashDraft material rename: Galvalume', () => {
  test('dropdown shows Galvalume and not Galvanized Galvalume', async ({ page }) => {
    await page.goto('/studio/draft');
    const material = page.locator('select#material');
    await expect(material).toBeVisible();

    const options = await material.locator('option').allTextContents();
    const trimmed = options.map((o) => o.trim());

    expect(trimmed).toContain('Galvalume');
    expect(trimmed).not.toContain('Galvanized Galvalume');
    // exactly one Galvalume-bearing option
    expect(trimmed.filter((o) => /galvalume/i.test(o))).toEqual(['Galvalume']);
    // the separate galvanized material survives untouched
    expect(trimmed).toContain('Galvanized Steel');
  });

  test('selecting Galvalume offers the same gauges as before the rename', async ({ page }) => {
    await page.goto('/studio/draft');
    await page.locator('select#material').selectOption('Galvalume');

    const gauge = page.locator('select#gauge');
    await expect(gauge).toBeEnabled();

    const gauges = (await gauge.locator('option').allTextContents())
      .map((g) => g.trim())
      .filter((g) => g !== 'Select' && g !== '—' && g !== '');

    expect(gauges).toEqual(EXPECTED_GAUGES);

    // identical to Galvanized Steel's list, as the old entry's was
    await page.locator('select#material').selectOption('Galvanized Steel');
    const galvSteelGauges = (await gauge.locator('option').allTextContents())
      .map((g) => g.trim())
      .filter((g) => g !== 'Select' && g !== '—' && g !== '');
    expect(galvSteelGauges).toEqual(EXPECTED_GAUGES);
  });
});
