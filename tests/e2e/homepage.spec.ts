import { test, expect, type Page } from '@playwright/test';

// Real homepage assembly (app/page.tsx) composing the eleven hp-001..hp-014
// section components (hpa-002's ProfileExplorer removed from the render
// order as of hpc-003) behind the same NavBar/Footer chrome
// (components/layout/AppChrome.tsx) every other public page uses. No
// E2E_TEST_EMAIL/E2E_TEST_PASSWORD gate is needed here — every assertion in
// this file runs against the fully public, unauthenticated view (NavBar's
// own auth check just resolves to the signed-out "Sign In" branch).

// Reused verbatim from tests/e2e/checkout.spec.ts — the one existing
// customer-facing-price guard in this suite, per CLAUDE.md rule #1.
const PRICE_PATTERN = /\$[\d,]+(\.\d{2})?/;

// Document order asserted by app/page.tsx's own <HomeSection slug="..."> wrapper
// sequence — eleven real sections as of hpc-003 (was twelve at hpa-003;
// profile-explorer was removed from the render order — the Explore Our
// Profiles section is no longer used as a sample, per Reid).
const SECTION_SLUGS = [
  'hero',
  'credibility',
  'field-app',
  'design-studio',
  'design-to-delivery',
  'pathways',
  'profile-passport',
  'case-studies',
  'shop-floor',
  'nationwide',
  'final-cta',
];

// DesignStudioHub's METHODS array (app/components/home/DesignStudioHub.tsx) —
// a static, hardcoded list (not DB-driven), so hardcoding the expected
// title/href pairs here mirrors the source rather than guessing at it.
const DESIGN_STUDIO_METHODS = [
  { title: 'Scan Plans', href: '/upload' },
  { title: 'Photo to Quote', href: '/field/contractor' },
  { title: 'FlashDraft', href: '/studio/draft' },
  { title: 'Quick Quote', href: '/quote' },
];

const VIEWPORTS = [
  { name: 'mobile-375x812', width: 375, height: 812 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
];

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

for (const viewport of VIEWPORTS) {
  test.describe(`Homepage — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('renders all eleven data-section elements, in document order', async ({ page }) => {
      await page.goto('/');
      const slugs = await page.locator('main > [data-section]').evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute('data-section'))
      );
      expect(slugs).toEqual(SECTION_SLUGS);
    });

    test('hero video declares an mp4 source and a poster', async ({ page }) => {
      await page.goto('/');
      const heroVideo = page.locator('[data-section="hero"] video');
      await expect(heroVideo).toHaveAttribute('poster', '/images/hero-poster.jpg');
      const mp4Source = heroVideo.locator('source[type="video/mp4"]');
      await expect(mp4Source).toHaveAttribute('src', '/videos/hero-metal-fabrication.mp4');
    });

    test('hero renders with zero console errors and no canvas element', async ({ page }) => {
      const consoleErrors = await collectConsoleErrors(page);
      await page.goto('/');
      const canvas = page.locator('[data-section="hero"] canvas');
      await expect(canvas).toHaveCount(0);
      // Give below-the-fold async work (NationwideMap's tile requests) a
      // chance to settle before asserting zero errors — a real error firing
      // after first paint would otherwise be missed.
      await page.waitForLoadState('networkidle');
      expect(consoleErrors).toEqual([]);
    });

    test('DesignStudioHub: clicking each card updates the detail panel; Start links resolve', async ({
      page,
    }) => {
      await page.goto('/');
      const tablist = page.getByRole('tablist', { name: 'Design Studio methods' });
      const panel = page.locator('#design-studio-panel');

      for (let i = 0; i < DESIGN_STUDIO_METHODS.length; i++) {
        const method = DESIGN_STUDIO_METHODS[i];
        await tablist.getByRole('tab').nth(i).click();
        await expect(panel.locator('h3')).toHaveText(method.title);

        const startLink = panel.getByRole('link', { name: `Start ${method.title}` });
        await expect(startLink).toHaveAttribute('href', method.href);

        const response = await page.request.get(method.href);
        expect(response.ok(), `${method.href} (Start ${method.title}) returned ${response.status()}`).toBe(true);
      }
    });

    test('NASA JSC case-study card renders the supplied photo with the expected alt text', async ({
      page,
    }) => {
      await page.goto('/');
      const card = page.locator('#case-study-nasa-jsc');
      const image = card.locator('img[alt="Trusted by NASA Johnson Space Center"]');
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('src', /NASA_Johnson_Space_Center/);
      // The old typographic badge is gone — the lockup is baked into the photo now.
      await expect(card.getByText('Trusted by', { exact: true })).toHaveCount(0);
    });

    test('NationwideMap renders the HQ marker', async ({ page }) => {
      await page.goto('/');
      const map = page.locator('[data-testid="nationwide-map"]');
      await expect(map).toBeVisible();
      await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 });
      await expect(map.locator('[data-testid="nationwide-map-hq-marker"]')).toBeVisible();
    });

    test('no customer-facing price pattern renders anywhere on the page', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(PRICE_PATTERN)).toHaveCount(0);
    });

    test.describe('reduced motion', () => {
      test('hero video never autoplays', async ({ page }) => {
        // Explicit emulateMedia() call rather than the `reducedMotion`
        // context option -- same pattern tests/e2e/hailview.spec.ts already
        // uses, and the one that reliably lands before HeroSection's mount
        // effect reads matchMedia.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/');

        const heroVideo = page.locator('[data-section="hero"] video');
        await expect(heroVideo).toHaveAttribute('poster', '/images/hero-poster.jpg');
        await expect(heroVideo.locator('source')).toHaveCount(0);
        const isPaused = await heroVideo.evaluate((el) => (el as HTMLVideoElement).paused);
        expect(isPaused).toBe(true);
      });
    });
  });
}

test.describe('Homepage navigation and footer', () => {
  test('Start a Quote is visible in the header nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Start a Quote' }).first()).toBeVisible();
  });

  test('HailView lives inside the Resources menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('menuitem', { name: 'HailView' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Resources' }).click();
    const hailViewItem = page.getByRole('menuitem', { name: 'HailView' });
    await expect(hailViewItem).toBeVisible();
    await expect(hailViewItem).toHaveAttribute('href', '/hailview');
  });

  test('FAQ and Contact appear in the footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq');
    await expect(footer.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  });

  test('mobile hamburger opens and closes the menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const hamburger = page.getByRole('button', { name: 'Open menu' });
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await hamburger.click();
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Homepage CTAs retargeted off the removed profile-explorer section (hpc-003)', () => {
  test('hero secondary CTA points at #shop-floor, which resolves on the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const heroCTA = page.locator('[data-section="hero"]').getByRole('link', { name: "See How It's Made" });
    await expect(heroCTA).toHaveAttribute('href', '#shop-floor');
    await expect(page.locator('#shop-floor')).toHaveCount(1);
  });

  test('final-CTA "Custom Profiles" button points at /architects/custom-profiles, which returns 200', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const finalCTA = page
      .locator('[data-section="final-cta"]')
      .getByRole('link', { name: 'Custom Profiles' });
    await expect(finalCTA).toHaveAttribute('href', '/architects/custom-profiles');
    const response = await page.request.get('/architects/custom-profiles', { timeout: 60_000 });
    expect(response.ok(), `/architects/custom-profiles returned ${response.status()}`).toBe(true);
  });
});

test.describe('Homepage link integrity', () => {
  test('every homepage CTA and every nav/footer link returns 200', async ({ page }) => {
    // Generous timeout: each unique href below is a route the Next.js dev
    // server hasn't necessarily compiled yet, and a cold first-compile of a
    // heavier route (e.g. /register) can exceed the default 30s test budget.
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Open the Resources dropdown so its two links (conditionally rendered,
    // not present in the DOM until opened) are collectable below.
    await page.getByRole('button', { name: 'Resources' }).click();
    await expect(page.getByRole('menuitem', { name: 'HailView' })).toBeVisible();

    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((href): href is string => !!href && href.startsWith('/'))
    );

    const unique = Array.from(new Set(hrefs));
    // Sanity floor: nav (5) + resources (2) + account (1) + footer (14) +
    // in-page section CTAs comfortably clear this even before de-duping.
    expect(unique.length).toBeGreaterThan(10);

    for (const href of unique) {
      const response = await page.request.get(href, { timeout: 60_000 });
      expect(response.ok(), `${href} returned ${response.status()}`).toBe(true);
    }
  });
});
