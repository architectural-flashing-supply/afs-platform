import { test, expect } from '@playwright/test';

// The Custom Flashing Configurator (app/configure/page.tsx) was eliminated
// (hpd-002, 2026-09-11) — Reid's decision: redundant with FlashDraft. This
// suite is the repo-wide guard that the elimination actually stuck: the old
// route redirects rather than 404ing for anything indexed/bookmarked, and no
// rendered page still links to it. See STATE_OF_THE_BUILD.md's hpd-002 entry
// for the full inventory of what was removed vs. kept.

const REDIRECT_SOURCES = ['/configure', '/configure/some/path', '/configurator', '/configurator/some/path'];

test.describe('Configurator elimination — redirects', () => {
  for (const source of REDIRECT_SOURCES) {
    test(`${source} redirects (permanent) to /studio/draft`, async ({ page }) => {
      const response = await page.request.get(source, { maxRedirects: 0 });
      expect(response.status(), `${source} status`).toBe(308);
      expect(response.headers()['location'], `${source} location header`).toBe('/studio/draft');
    });
  }

  test('/configure resolves to a real 200 page when redirects are followed', async ({ page }) => {
    const response = await page.request.get('/configure');
    expect(response.ok(), `/configure (followed) returned ${response.status()}`).toBe(true);
    expect(response.url()).toContain('/studio/draft');
  });
});

// Pages known (pre-elimination) to have linked at least one of: the
// DesignStudioHub Configurator card, the /studio Custom Configurator tab,
// the ProductCard/ProductDetailView "Configure" CTA, or the
// SavedConfigCard/SavedProfilesBrowser Configurator links.
const SWEPT_PAGES = ['/', '/studio', '/design-studio', '/products/roofing/valley-flashing'];

test.describe('Configurator elimination — no rendered link remains', () => {
  for (const path of SWEPT_PAGES) {
    test(`${path} contains no href to /configure or /configurator`, async ({ page }) => {
      await page.goto(path);
      const hrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href'))
          .filter((href): href is string => !!href)
      );
      const configuratorHrefs = hrefs.filter((h) => h.startsWith('/configure') || h.startsWith('/configurator'));
      expect(configuratorHrefs, `${path} still links to: ${configuratorHrefs.join(', ')}`).toEqual([]);
    });
  }

  test('DesignStudioHub renders exactly four method tabs, none labeled Configurator', async ({ page }) => {
    await page.goto('/');
    const tablist = page.getByRole('tablist', { name: 'Design Studio methods' });
    await expect(tablist.getByRole('tab')).toHaveCount(4);
    await expect(tablist.getByRole('tab', { name: 'Configurator' })).toHaveCount(0);
  });
});
