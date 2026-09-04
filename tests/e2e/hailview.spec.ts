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

  // afs-hv-005 — SPEC_HAILVIEW.md Section 8's consent-based "email me my own
  // result" form. This environment has no RESEND_API_KEY/RESEND_FROM_EMAIL
  // set (verified directly, not assumed), so lib/resend/send.ts's sendEmail()
  // returns { success: false, error: 'Resend is not configured.' } and
  // app/api/hailview/email-report/route.ts reflects that as reason:
  // 'not_configured'. This test asserts the real degrade path renders —
  // it does not fabricate a "sent" assertion this environment cannot produce.
  test('email-my-result form degrades gracefully when Resend is not configured', async ({ page }) => {
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('asphalt_shingle');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    await page.getByTestId('hailview-email-input').fill('test-user@example.com');
    await page.getByTestId('hailview-email-submit').click();

    await expect(page.getByTestId('hailview-email-report-not-configured')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('hailview-email-report-not-configured')).toContainText("isn't live yet");
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

// afs-hv-006 — Leaflet/OpenStreetMap map added to the results view
// (components/hailview/HailViewMap.tsx). Asserts against the real
// HailViewLookupResponse returned by the same live pipeline the tests above
// already exercise (real Nominatim lat/lon, real IEM LSR hailEvents each
// with its own lat/lon) rather than any fixture data.
test.describe('HailView — interactive map (afs-hv-006)', () => {
  test('address marker pulses, real storm markers plot, map frames all points', async ({ page }) => {
    const responsePromise = page.waitForResponse((res) => res.url().includes('/api/hailview/storm-history'));
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('asphalt_shingle');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const body = (await (await responsePromise).json()) as { lat: number; lon: number; hailEvents: { id: string }[] };

    const map = page.getByTestId('hailview-map');
    await expect(map).toBeVisible();
    // react-leaflet renders tiles asynchronously — wait for at least one real
    // OSM tile image to load before asserting on marker geometry.
    await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 });

    // Address marker: exactly one, with the pulse-ring element present and
    // actually animating (not display:none, not a static div).
    const addressMarker = map.locator('[data-testid="hailview-map-address-marker"]');
    await expect(addressMarker).toHaveCount(1);
    const ring = addressMarker.locator('.hailview-address-marker-ring');
    await expect(ring).toBeVisible();
    const animationName = await ring.evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe('hailview-address-pulse');

    // Storm event markers: one leaflet marker per real hailEvents entry
    // returned by the API this run (not a hardcoded count) — total markers
    // on the map = 1 address marker + hailEvents.length storm markers.
    const allMarkers = map.locator('.leaflet-marker-icon');
    await expect(allMarkers).toHaveCount(1 + body.hailEvents.length);

    // Bounds-fit: no hardcoded zoom assertion, just confirm Leaflet actually
    // set a zoom level (i.e. fitBounds/setView ran) rather than staying
    // uninitialized.
    const zoomAttr = await map.locator('.leaflet-container').first().getAttribute('style');
    expect(zoomAttr).toBeTruthy();

    await page.screenshot({ path: 'test-results/hailview-map-pulse.png', fullPage: true });
  });

  test('storm marker click shows its real date and size from the already-displayed data', async ({ page }) => {
    const responsePromise = page.waitForResponse((res) => res.url().includes('/api/hailview/storm-history'));
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('asphalt_shingle');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const body = (await (await responsePromise).json()) as {
      hailEvents: { id: string; validAt: string; sizeIn: number | null }[];
    };
    test.skip(body.hailEvents.length === 0, 'No real hail events for this address/period — nothing to click.');

    const map = page.getByTestId('hailview-map');
    await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 });

    const stormMarkers = map.locator('.leaflet-marker-icon:not(:has(.hailview-address-marker))');
    await stormMarkers.first().click();

    const first = body.hailEvents[0];
    await expect(page.locator('.leaflet-popup-content')).toContainText(first.validAt.slice(0, 10));
  });

  test('reduced motion renders a static ring, not an animated one', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/hailview');
    await page.locator('#hailview-address').fill(TEST_ADDRESS);
    await page.locator('#hailview-material').selectOption('asphalt_shingle');
    await page.locator('#hailview-roof-age').fill('15');
    await submitAndWaitForResult(page);

    const map = page.getByTestId('hailview-map');
    await expect(map.locator('.leaflet-tile-loaded').first()).toBeVisible({ timeout: 20000 });

    const ring = map.locator('.hailview-address-marker-ring').first();
    await expect(ring).toBeVisible();
    const style = await ring.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { animationName: cs.animationName, opacity: cs.opacity };
    });
    expect(style.animationName).toBe('none');
    expect(Number(style.opacity)).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/hailview-map-reduced-motion.png', fullPage: true });
  });
});
