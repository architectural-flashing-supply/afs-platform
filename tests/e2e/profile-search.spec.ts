import { test, expect, type Page } from '@playwright/test';
import { dbConfigured } from './helpers/db';
import {
  deleteSearchFixtures,
  findUserId,
  insertSearchFixtures,
  profilesCreatedSince,
  remainingSearchRows,
  SEARCH_PREFIX,
  type SearchFixture,
} from './helpers/search-db';

/**
 * PROFILE SEARCH — the thumbnail rail, the hover-intent preview, and Select
 * (Command Center V2 prompt v2-05). This is the path FORGE's gate runs.
 *
 * ================== WHAT IT PROVES ==================
 *
 *   1. Search by EACH field — Everything, Profile name, Company, Person,
 *      Profile type — including the negative case that makes the selector
 *      mean something: a term that lives in the COMPANY finds nothing when
 *      the selector says Profile name.
 *   2. The material filter.
 *   3. EGRESS: the list response carries no image data at all, and
 *      thumbnails below the fold are not fetched until they are scrolled to.
 *   4. The hover-intent preview: it does not open instantly, and the 300 ms
 *      grace really does let the pointer travel off the thumbnail and onto
 *      the preview without it vanishing. Plus: no close button.
 *   5. Keyboard and touch both reach the preview AND the Select button.
 *   6. Select loads the profile as a LINKED NEW DRAFT (the lineage banner,
 *      which is the visible form of source_profile_id).
 *   7. Inside FlashDraft, Select AUTO-SAVES unsaved canvas work FIRST — with
 *      the new row asserted in the database, not just a toast believed.
 *
 * ================== NOTHING REACHES THE MACHINE ==================
 *
 * This spec makes no request of any kind to the bend-machine integration and
 * never presses anything that would. It touches `saved_configurations` and
 * the two per-admin shortcut tables and nothing else.
 *
 * ================== CLEANUP ==================
 *
 * Every row is created through ./helpers/search-db.ts — the same Supabase
 * Management API SQL channel every other v2 spec uses — scoped to the E2E
 * test user, and swept in afterAll even if a test fails. The sweep covers
 * what the APP created (the auto-saved drawing) as well as the fixtures, and
 * the remaining counts are printed AND asserted back to zero.
 */

const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasEnv = !!(E2E_EMAIL && E2E_PASSWORD && dbConfigured());

const authFile = 'tests/e2e/.auth/user.json';

/** Every fixture name starts with this, which is also how the sweep finds them. */
const PREFIX = SEARCH_PREFIX;

let testUserId: string;
let target: SearchFixture; // the one every Select test picks
const startedAt = new Date().toISOString();

test.describe('Profile search', () => {
  test.skip(!hasEnv, 'needs SUPABASE_ACCESS_TOKEN + E2E_TEST_EMAIL/PASSWORD — see tests/e2e/README.md');
  test.use({ storageState: authFile });

  test.beforeAll(async () => {
    testUserId = await findUserId(E2E_EMAIL!);
    // A previous interrupted run must not decide this one's counts.
    await deleteSearchFixtures(testUserId, startedAt);

    // THREE NAMED FIXTURES, plus filler. Each field's search term lives in
    // exactly ONE field of exactly one row, and in no other row's name —
    // which is what makes "search by company found it, search by name did
    // not" a real test of the selector rather than a coincidence.
    //
    // The filler exists so the rail is longer than its own scroll box and
    // there are genuinely off-screen thumbnails to prove laziness with. Two
    // share a fingerprint so the "same shape used 2×" badge has something to
    // count.
    const fixtures = await insertSearchFixtures(testUserId, [
      {
        name: `${PREFIX} Zorbix Drip`,
        company: 'Quafflewick Roofing',
        person: 'Bartholomew Quince',
        profileType: 'zorbix-drip',
        material: 'Galvalume',
        gauge: '24 ga',
        thumbnail: true,
      },
      {
        name: `${PREFIX} Marlow Coping`,
        company: 'Pendlebury Sheetmetal',
        person: 'Ottoline Frisk',
        profileType: 'marlow-coping',
        material: 'Copper',
        gauge: '16 oz',
      },
      {
        name: `${PREFIX} Grimsby Counter`,
        company: 'Havering Metals',
        person: 'Priya Raghunathan',
        profileType: 'grimsby-counter',
        material: 'Galvalume',
        gauge: '22 ga',
      },
      ...Array.from({ length: 9 }, (_unused, i) => ({
        name: `${PREFIX} Filler ${String(i + 1).padStart(2, '0')}`,
        company: 'Filler Fabrication',
        person: 'Filler Person',
        profileType: 'filler',
        material: 'Galvalume',
        gauge: '26 ga',
        thumbnail: i % 2 === 0,
        fingerprint: i < 2 ? 'e2e-search-shared-shape' : `e2e-search-fp-${i}`,
      })),
    ]);

    const zorbix = fixtures.find((f) => f.name.includes('Zorbix'));
    if (!zorbix) throw new Error('Zorbix fixture was not created');
    target = zorbix;
  });

  test.afterAll(async () => {
    if (!testUserId) return;
    // Scoped twice over: to the E2E user, and to this run's own window. The
    // sweep covers the row the APP created (the auto-save) as well as the
    // fixtures, so "every row the tests created is deleted" is true of both.
    await deleteSearchFixtures(testUserId, startedAt);
    const left = await remainingSearchRows(testUserId, startedAt);
    // Printed as well as asserted, so the run report can quote real output.
    console.log('CLEANUP remainingSearchRows:', JSON.stringify(left));
    expect(left).toEqual({ profiles: 0, recent: 0, pinned: 0 });
  });

  // ------------------------------------------------------------------ helpers

  async function openSearch(page: Page, q?: string): Promise<void> {
    await page.goto(q ? `/admin/search?q=${encodeURIComponent(q)}` : '/admin/search');
    await expect(page.getByTestId('profile-search-panel')).toBeVisible();
  }

  /**
   * The search box is addressed by id, not by its label: the gunmetal header
   * has its own `Search` label on the box that BROUGHT you here, so
   * getByLabel('Search') matches two inputs and Playwright's strict mode
   * rightly refuses to guess.
   */
  async function searchIn(page: Page, field: string, term: string): Promise<void> {
    await page.getByLabel('Search in').selectOption({ label: field });
    await page.locator('#profile-search-q').fill(term);
  }

  /** Rail item names, after the debounce has settled. */
  async function railNames(page: Page): Promise<string[]> {
    await expect(page.getByTestId('search-count')).not.toContainText('Searching');
    return page.getByTestId('rail-item').allInnerTexts();
  }

  // ------------------------------------------------------------ each field

  test('searches by Everything', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Zorbix');
    await expect(page.getByTestId('rail-item')).toHaveCount(1);
    expect((await railNames(page))[0]).toContain('Zorbix Drip');
  });

  test('searches by Profile name', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Profile name', 'Grimsby');
    await expect(page.getByTestId('rail-item')).toHaveCount(1);
    expect((await railNames(page))[0]).toContain('Grimsby Counter');
  });

  test('searches by Company — and Profile name does NOT find a company word', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Company', 'Quafflewick');
    await expect(page.getByTestId('rail-item')).toHaveCount(1);
    expect((await railNames(page))[0]).toContain('Zorbix Drip');

    // The selector has to actually restrict, or it is decoration: the same
    // term, searched in Profile name, must find nothing.
    await page.getByLabel('Search in').selectOption({ label: 'Profile name' });
    await expect(page.getByTestId('no-matches')).toBeVisible();
    await expect(page.getByTestId('rail-item')).toHaveCount(0);
  });

  test('searches by Person', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Person', 'Ottoline');
    await expect(page.getByTestId('rail-item')).toHaveCount(1);
    expect((await railNames(page))[0]).toContain('Marlow Coping');
  });

  test('searches by Profile type', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Profile type', 'grimsby-counter');
    await expect(page.getByTestId('rail-item')).toHaveCount(1);
    expect((await railNames(page))[0]).toContain('Grimsby Counter');
  });

  test('filters by material on its own, with no search term', async ({ page }) => {
    await openSearch(page);
    await page.getByLabel('Material').selectOption('Copper');
    await expect(page.getByTestId('rail-item')).toHaveCount(1);
    expect((await railNames(page))[0]).toContain('Marlow Coping');
  });

  test('counts a repeated shape', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Filler');
    await expect(page.getByTestId('rail-item').first()).toBeVisible();
    await expect(page.getByText('Same shape used 2×').first()).toBeVisible();
  });

  // ------------------------------------------------------------------ egress

  test('the list response carries NO image data, and thumbnails load lazily', async ({ page }) => {
    const searchBodies: string[] = [];
    const thumbRequests: string[] = [];
    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/api/admin/command-center/profile-search')) {
        searchBodies.push(await res.text().catch(() => ''));
      }
      if (url.includes('/api/admin/command-center/profile-thumbnail/')) {
        thumbRequests.push(url);
      }
    });

    await openSearch(page);
    await searchIn(page, 'Everything', PREFIX);
    await expect(page.getByTestId('rail-item')).toHaveCount(12);

    // --- no base64 anywhere in the list payload
    expect(searchBodies.length).toBeGreaterThan(0);
    const body = searchBodies[searchBodies.length - 1];
    expect(body).not.toContain('data:image');
    expect(body).not.toContain('thumbnailImage');
    expect(body).not.toContain('iVBORw0KGgo');
    const parsed = JSON.parse(body) as { results: Record<string, unknown>[] };
    expect(parsed.results.length).toBe(12);
    for (const r of parsed.results) {
      for (const key of Object.keys(r)) expect(key).not.toMatch(/image|svg/i);
      expect(typeof r.hasThumbnail).toBe('boolean');
    }

    // --- thumbnails below the fold have not been asked for yet
    await expect(page.getByTestId('profile-thumb').first()).not.toHaveAttribute('data-thumb-state', 'pending');
    const before = new Set(thumbRequests).size;
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(12);

    // --- scrolling the rail asks for the rest
    await page.getByTestId('rail-item').last().scrollIntoViewIfNeeded();
    await expect
      .poll(() => new Set(thumbRequests).size, { timeout: 15_000 })
      .toBeGreaterThan(before);
  });

  // ------------------------------------------------------ the hover preview

  test('the preview waits for the pointer to settle, then opens', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Zorbix');
    const item = page.getByTestId('rail-item').first();
    await expect(item).toBeVisible();
    const box = (await item.boundingBox())!;

    const t0 = Date.now();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('profile-preview')).toBeVisible();
    const elapsed = Date.now() - t0;
    // The open delay is 150 ms (lib/ui/hover-intent.ts). Anything that
    // opened instantly would land well under this.
    expect(elapsed).toBeGreaterThanOrEqual(120);
    await expect(page.getByTestId('profile-preview')).toContainText('Zorbix Drip');
    await expect(page.getByTestId('profile-preview')).toContainText('Quafflewick Roofing');
  });

  test('the grace delay lets the pointer travel onto the preview, and there is no close button', async ({
    page,
  }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Zorbix');
    const item = page.getByTestId('rail-item').first();
    await expect(item).toBeVisible();
    const itemBox = (await item.boundingBox())!;
    await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);

    const preview = page.getByTestId('profile-preview');
    await expect(preview).toBeVisible();
    const previewBox = (await preview.boundingBox())!;

    // OFF the thumbnail, onto neither the rail nor the preview — the gap the
    // pointer has to cross. One move event, so nothing in between is entered.
    const gapX = itemBox.x + itemBox.width + (previewBox.x - (itemBox.x + itemBox.width)) / 2;
    await page.mouse.move(gapX, itemBox.y + itemBox.height / 2);
    await page.waitForTimeout(200); // inside the 300 ms grace
    await expect(preview).toBeVisible();

    // Arrived. The close is cancelled outright, so reading it is not on a clock.
    await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + 40);
    await page.waitForTimeout(1200);
    await expect(preview).toBeVisible();

    // NO CLOSE BUTTON. The only buttons in the preview are the two actions.
    const labels = await preview.getByRole('button').allInnerTexts();
    expect(labels.map((l) => l.trim())).toEqual(['Select', 'Pin']);
    expect(labels.join(' ')).not.toMatch(/close|dismiss|×|✕/i);

    // And Select is genuinely clickable from here — the whole point of the grace.
    await expect(preview.getByTestId('profile-select')).toBeEnabled();
  });

  test('the preview closes when the pointer leaves and does not arrive', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Zorbix');
    const item = page.getByTestId('rail-item').first();
    await expect(item).toBeVisible();
    const itemBox = (await item.boundingBox())!;
    await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
    await expect(page.getByTestId('profile-preview')).toBeVisible();

    // Away, and stay away. 300 ms of grace, then it goes.
    await page.mouse.move(5, 5);
    await expect(page.getByTestId('profile-preview')).toBeHidden({ timeout: 5_000 });
  });

  // ------------------------------------------------------------------ keyboard

  test('the keyboard reaches the preview and the Select button, and Escape closes', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', PREFIX);
    await expect(page.getByTestId('rail-item').first()).toBeVisible();

    // "/" jumps to the box from anywhere on the screen.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await expect(page.locator('#profile-search-q')).toBeFocused();

    // Tab out of the three controls and into the rail.
    await page.keyboard.press('Tab'); // Search in
    await page.keyboard.press('Tab'); // Material
    await page.keyboard.press('Tab'); // first rail item
    const firstId = await page.evaluate(() => document.activeElement?.getAttribute('data-rail-id') ?? null);
    expect(firstId).not.toBeNull();

    // Focusing a thumbnail previews it — no hover needed, no delay.
    await expect(page.getByTestId('profile-preview')).toBeVisible();

    // Arrow keys walk the rail and the preview follows.
    await page.keyboard.press('ArrowDown');
    const secondId = await page.evaluate(() => document.activeElement?.getAttribute('data-rail-id') ?? null);
    expect(secondId).not.toBe(firstId);
    await expect(page.getByTestId('profile-preview')).toBeVisible();

    // Enter puts Select one press away.
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('profile-select')).toBeFocused();

    // Escape closes the preview — the way out, since there is no button.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('profile-preview')).toBeHidden();
  });

  // ------------------------------------------------------------------ select

  test('Select loads the profile as a LINKED NEW DRAFT', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Zorbix');
    const item = page.getByTestId('rail-item').first();
    await expect(item).toBeVisible();
    await item.click();

    const preview = page.getByTestId('profile-preview');
    await expect(preview).toBeVisible();
    await preview.getByTestId('profile-select').click();

    await page.waitForURL(new RegExp(`modifyProfile=${target.id}`), { timeout: 20_000 });
    const banner = page.getByTestId('modified-from-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(target.name);
    await expect(banner).toContainText('the original is unchanged');
  });

  test('Select records the profile in Recent', async ({ page }) => {
    await openSearch(page);
    await searchIn(page, 'Everything', 'Zorbix');
    const item = page.getByTestId('rail-item').first();
    await expect(item).toBeVisible();
    await item.click();
    await page.getByTestId('profile-select').click();
    await page.waitForURL(/modifyProfile=/, { timeout: 20_000 });

    // Back to an empty box: Recent and Pinned are what it shows.
    await openSearch(page);
    await expect(page.getByRole('heading', { name: 'Recent' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pinned' })).toBeVisible();
    await expect(page.getByTestId('rail-item').filter({ hasText: 'Zorbix Drip' })).toHaveCount(1);
  });

  // ------------------------------------------------- inside FlashDraft

  test('inside FlashDraft, Select AUTO-SAVES the unsaved drawing before loading', async ({ page }) => {
    const before = await profilesCreatedSince(testUserId, startedAt);
    const countBefore = before.length;

    await page.goto('/studio/draft?admin=1');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // A real two-leg profile, drawn exactly the way flashdraft.spec.ts draws one.
    await page.mouse.click(cx, cy);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy, { steps: 10 });
    await page.mouse.up();
    await page.mouse.move(cx + 150, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 150, cy - 150, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText('Bend Count: 1')).toBeVisible();

    // Search is reachable from inside the Command Center's FlashDraft view.
    await page.getByTestId('open-profile-search').click();
    await expect(page.getByTestId('profile-search-drawer')).toBeVisible();

    const drawer = page.getByTestId('profile-search-drawer');
    await drawer.locator('#profile-search-q').fill('Zorbix');
    const item = drawer.getByTestId('rail-item').first();
    await expect(item).toBeVisible();
    await item.click();
    await drawer.getByTestId('profile-select').click();

    // The drawing was saved FIRST, then the picked profile was loaded here.
    await expect(page.getByTestId('profile-search-drawer')).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId('modified-from-banner')).toContainText(target.name);
    await expect(page.getByText(/Saved your drawing first/)).toBeVisible();

    // And it is in the database — the toast is not the evidence, this is.
    const after = await profilesCreatedSince(testUserId, startedAt);
    expect(after.length).toBe(countBefore + 1);
    const autosaved = after.filter((r) => !r.name.startsWith(PREFIX));
    console.log('AUTO-SAVED ROW:', JSON.stringify(autosaved));
    expect(autosaved.length).toBe(1);
    expect(autosaved[0].name).toMatch(/^Profile-/);
  });

  /**
   * TOUCH — a NESTED describe, because `hasTouch` is a browser-context option
   * and the rest of this spec is a mouse and a keyboard.
   *
   * It has to be nested rather than a sibling: the fixtures live in the outer
   * describe's beforeAll, and a sibling describe would run against an empty
   * library and fail looking for rail items that were never created. (That is
   * exactly how it failed first time round.)
   */
  test.describe('on a touchscreen', () => {
    test.use({ hasTouch: true });

    test('a tap opens the preview, and a second tap Selects', async ({ page }) => {
      await page.goto('/admin/search');
      await expect(page.getByTestId('profile-search-panel')).toBeVisible();
      await page.locator('#profile-search-q').fill('Zorbix');

      const item = page.getByTestId('rail-item').first();
      await expect(item).toBeVisible();
      const itemBox = (await item.boundingBox())!;
      // NO mouse movement anywhere in this test — a tap, and nothing else.
      await page.touchscreen.tap(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);

      const preview = page.getByTestId('profile-preview');
      await expect(preview).toBeVisible();

      const select = preview.getByTestId('profile-select');
      const selectBox = (await select.boundingBox())!;
      // A real finger target, not a nominal one.
      expect(selectBox.height).toBeGreaterThanOrEqual(44);
      await page.touchscreen.tap(selectBox.x + selectBox.width / 2, selectBox.y + selectBox.height / 2);
      await page.waitForURL(/modifyProfile=/, { timeout: 20_000 });
    });
  });
});
