import { test, expect } from '@playwright/test';

// hpd-008: /about/services' "Learn More" accordion now auto-scrolls the
// expanded panel into view (previously it only expanded in place, requiring
// the user to manually scroll down past the 5-card grid to see it).

test.describe('/about/services accordion', () => {
  test('clicking "Learn More" expands the panel and scrolls it into view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/about/services');

    const scrollYBefore = await page.evaluate(() => window.scrollY);

    // "Design/Specification Support" is the last card (5th, standalone row)
    // -- picking it (not the first card) actually exercises the scroll,
    // since expanding the first card wouldn't need to scroll far if at all.
    await page.getByRole('heading', { name: 'Design/Specification Support' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Learn More' }).last().click();

    await expect(page.getByRole('heading', { name: 'Design/Specification Support', level: 3 })).toBeVisible();
    const scrollYAfter = await page.evaluate(() => window.scrollY);
    expect(scrollYAfter).toBeGreaterThan(scrollYBefore);
  });

  test('Submittal Services card shows the full supplied description text', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/about/services');

    // Submittal Services is the first card in SERVICES (page.tsx) -- index
    // 0's "Learn More" button reliably targets it without an ambiguous
    // div/has ancestor lookup.
    await page.getByRole('heading', { name: 'Submittal Services' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Learn More' }).nth(0).click();

    await expect(
      page.getByText(
        'AFS provides comprehensive project submittal packages for commercial, architectural, and large-scale construction projects.',
        { exact: false }
      )
    ).toBeVisible();
  });
});
