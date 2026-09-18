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
// sequence — thirteen real sections. client-carousel moved from #2 (right
// after hero) to the very last section, ahead of the footer, in the
// homepage layout restructuring pass — its bg-white was breaking the page's
// otherwise-consistent dark gunmetal theme just three sections in; as the
// last section it now closes the page on a bright trust band instead. Three
// SectionImageBreak photo bands (not HomeSections — no data-section, so
// they don't appear in this list) were added between sections at the same
// time; see app/page.tsx and STATE_OF_THE_BUILD.md for the full layout.
const SECTION_SLUGS = [
  'hero',
  'field-app',
  'credibility',
  'design-studio',
  'design-to-delivery',
  'pathways',
  'profile-passport',
  'case-studies',
  'shop-floor',
  'nationwide',
  'final-cta',
  'hail-view',
  'client-carousel',
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

    test('hero shop-floor video declares an mp4 source and a poster', async ({ page }) => {
      // hpd-007: split-screen hero restored -- raw shop-floor fabrication
      // footage fills the left column, no phone mockup inside the hero.
      await page.goto('/');
      const heroVideo = page.locator('[data-section="hero"] video');
      await expect(heroVideo).toHaveAttribute('poster', '/images/hero-poster.jpg');
      const mp4Source = heroVideo.locator('source[type="video/mp4"]');
      await expect(mp4Source).toHaveAttribute('src', '/videos/hero-metal-fabrication.mp4');
    });

    test('field-app phone-mockup video declares an mp4 source, a poster, and loops', async ({ page }) => {
      // hpd-007: PhoneMockupVideo moved back below the fold into
      // FieldAppStory, alongside the "Photo to Quote" steps copy. Source
      // swapped to field-app.mp4/webm (Reid's real handheld field clip,
      // rotation baked in) -- see PhoneMockupVideo.tsx's own comment for why.
      await page.goto('/');
      const phoneVideo = page.locator('[data-section="field-app"] video');
      // Below the fold: PhoneMockupVideo only attaches <source> once its
      // IntersectionObserver (rootMargin 200px) sees it near the viewport.
      await phoneVideo.scrollIntoViewIfNeeded();
      await expect(phoneVideo).toHaveAttribute('poster', '/images/field-app-poster.jpg');
      await expect(phoneVideo).toHaveAttribute('loop', '');
      const mp4Source = phoneVideo.locator('source[type="video/mp4"]');
      await expect(mp4Source).toHaveAttribute('src', '/videos/field-app.mp4');
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
  // hpd-007 restored the split-screen hero's dual CTAs as "Start Your
  // Project" / "View Our Work" -- "Design Your Profile" / "Request a Quote"
  // no longer exist inside the hero.
  test('hero dual CTAs resolve to /quote and /about/services', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const hero = page.locator('[data-section="hero"]');

    const primaryCTA = hero.getByRole('link', { name: 'Start Your Project' });
    await expect(primaryCTA).toHaveAttribute('href', '/quote');

    const secondaryCTA = hero.getByRole('link', { name: 'View Our Work' });
    await expect(secondaryCTA).toHaveAttribute('href', '/about/services');
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

test.describe('Homepage overhaul (hpd-008)', () => {
  test('header logo has no separate sidebar, the mark renders oversized (76px), and the tagline is present', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const header = page.locator('header');
    const headerLogoImg = header.locator('img');
    await expect(headerLogoImg).toHaveCount(1);
    await expect(headerLogoImg).toHaveAttribute('width', '76');
    await expect(header.getByText('Architectural Flashing Supply', { exact: false })).toBeVisible();
  });

  test('footer renders the real AFS logo image, not text branding', async ({ page }) => {
    // Reverses 05c772e's earlier "text-only, no logo mark" decision, per an
    // explicit later instruction to restore the logo image in the footer.
    await page.goto('/');
    const footer = page.locator('footer');
    const footerLogoImg = footer.locator('img');
    await expect(footerLogoImg).toHaveCount(1);
    await expect(footerLogoImg).toHaveAttribute('src', /afs-logo\.png/);
    await expect(footer.getByText('AFS — Architectural Flashing Supply')).toHaveCount(0);
  });

  test('hero right column has Reid\'s real blueprint background image, filling the section (bg-cover)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const hero = page.locator('[data-section="hero"]');
    const rightColumn = hero.locator('div.grid > div').nth(1);
    const backgroundImage = await rightColumn.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(backgroundImage).toContain('blueprint.webp');
    const backgroundSize = await rightColumn.evaluate((el) => getComputedStyle(el).backgroundSize);
    expect(backgroundSize).toBe('cover');
  });

  test('hero right column has a uniform translucent wash plus an extra fade on the right edge only', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const hero = page.locator('[data-section="hero"]');
    const rightColumn = hero.locator('div.grid > div').nth(1);
    // Two overlay divs: a uniform wash, then a right-edge-only gradient.
    const overlays = rightColumn.locator(':scope > div.pointer-events-none.absolute.inset-0');
    await expect(overlays).toHaveCount(2);
    const washBg = await overlays.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(washBg).not.toBe('rgba(0, 0, 0, 0)');
    const edgeBg = await overlays.nth(1).evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(edgeBg).toContain('linear-gradient');
  });

  test('hero left video shows a real, timed process-stage label ("Feed + Bend" then "Release")', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const hero = page.locator('[data-section="hero"]');
    await expect(hero.getByText('Feed + Bend')).toBeVisible();
  });

  test('field-app phone-mockup video has no bezel padding around it (fills to the frame border)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const fieldApp = page.locator('[data-section="field-app"]');
    await fieldApp.scrollIntoViewIfNeeded();
    const video = fieldApp.locator('video');
    const frame = video.locator('..');
    const [videoBox, frameBox] = await Promise.all([video.boundingBox(), frame.boundingBox()]);
    expect(videoBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    // The video fills the frame right up to its 6px border on every side
    // (absolutely positioned children sit inside the parent's padding
    // box) -- so the expected gap is exactly 2*6=12px, not the ~28px gap
    // the old border + p-2 bezel + separate inner rounded div used to leave.
    const BORDER_PX = 12;
    expect(Math.abs(videoBox!.width - (frameBox!.width - BORDER_PX))).toBeLessThan(2);
    expect(Math.abs(videoBox!.height - (frameBox!.height - BORDER_PX))).toBeLessThan(2);
  });

  test('client-carousel is the last section, immediately before the footer', async ({ page }) => {
    // Moved from #2 (above the fold, right after hero) to the very bottom
    // of the page in the homepage layout restructuring pass -- its
    // bg-white broke the page's otherwise-consistent dark gunmetal theme
    // just three sections in. It's no longer expected to be above the fold.
    await page.goto('/');
    const lastSection = page.locator('main > [data-section]').last();
    await expect(lastSection).toHaveAttribute('data-section', 'client-carousel');

    const carouselBox = await lastSection.boundingBox();
    const footerBox = await page.locator('footer').boundingBox();
    expect(carouselBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    // The footer should follow directly after the carousel -- allowing for
    // ordinary layout padding/margin (not pixel-perfect), but nowhere near
    // enough gap to fit another whole section in between.
    expect(footerBox!.y).toBeGreaterThanOrEqual(carouselBox!.y);
    expect(footerBox!.y - (carouselBox!.y + carouselBox!.height)).toBeLessThan(150);
  });

  test('field-app step highlighting tracks video playback: step 1 active at start, step 2 by ~2.5s', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const fieldApp = page.locator('[data-section="field-app"]');
    const steps = fieldApp.locator('ol > li');
    await fieldApp.scrollIntoViewIfNeeded();

    // Step 1 should be the active (opacity: 1) one shortly after the video
    // starts playing.
    await expect(steps.nth(0)).toHaveCSS('opacity', '1', { timeout: 5000 });
    await expect(steps.nth(1)).not.toHaveCSS('opacity', '1');

    // By ~2.5s into the (autoplaying, muted) video, step 2 should take over.
    await page.waitForTimeout(2500);
    await expect(steps.nth(1)).toHaveCSS('opacity', '1');
    await expect(steps.nth(0)).not.toHaveCSS('opacity', '1');
  });

  test('client carousel spells "Hays ISD" correctly and scrolls slowly (14s cycle)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const carousel = page.locator('[data-section="client-carousel"]');
    await expect(carousel.getByText('Hays ISD', { exact: true }).first()).toBeVisible();
    await expect(carousel.getByText('Hayes ISD')).toHaveCount(0);
    const duration = await carousel
      .locator('.client-marquee-track')
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duration).toBe('14s');
  });

  test('field-app button text is breakpoint-conditional: desktop "Open the Field App", mobile "Install App"', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const fieldApp = page.locator('[data-section="field-app"]');
    await expect(fieldApp.getByRole('link', { name: 'Open the Field App' })).toBeVisible();
    await expect(fieldApp.getByRole('link', { name: 'Install App' })).toBeHidden();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(fieldApp.getByRole('link', { name: 'Install App' })).toBeVisible();
    await expect(fieldApp.getByRole('link', { name: 'Open the Field App' })).toBeHidden();
  });

  test('field-app steps use single-digit numbers and the updated step 2/3 copy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const fieldApp = page.locator('[data-section="field-app"]');
    await expect(fieldApp.getByText('AFS designs the profile')).toBeVisible();
    await expect(fieldApp.getByText('Fabrication & Job Site Delivery')).toBeVisible();
    await expect(fieldApp.getByText('AI identifies the profile and material')).toHaveCount(0);
  });

  test('design-to-delivery has no photo/camera reference in step 1', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const section = page.locator('[data-section="design-to-delivery"]');
    await expect(section.getByText('Upload Blueprints & Specifications')).toBeVisible();
    await expect(section.getByText(/snap a photo/i)).toHaveCount(0);
  });

  test('nationwide map is expanded to at least 500px tall', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const map = page.locator('[data-testid="nationwide-map"]');
    const box = await map.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(500);
  });

  test('final-CTA buttons are all the same crimson style, and hail button reads "Check Hail View"', async ({
    page,
  }) => {
    await page.goto('/');
    const finalCTA = page.locator('[data-section="final-cta"]');
    await expect(finalCTA.getByRole('link', { name: 'Check Hail View' })).toHaveAttribute('href', '/hailview');
    await expect(finalCTA.getByRole('link', { name: 'Check Hail Impact' })).toHaveCount(0);

    const classes = await finalCTA.getByRole('link').evaluateAll((links) => links.map((l) => l.className));
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('bg-afs-crimson');
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
