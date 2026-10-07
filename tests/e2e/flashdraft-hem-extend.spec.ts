/**
 * Extending a profile by pressing on its HEM (2026-10-07).
 *
 * CLAUDE.md rule #13 already says both free endpoints extend and that a hem
 * rides along to the new free end. What was missing is that once an end is
 * hemmed, the hem is most of what is VISIBLE there — at the default zoom an
 * open 1 7/8" hem reaches about 105px out while the endpoint ring is 8px —
 * so the thing a user presses to continue their profile was not the thing
 * that responded.
 *
 * WHAT IT DID BEFORE (measured, not assumed — see STATE_OF_THE_BUILD.md's
 * 2026-10-07 entry): a press on the hem missed every hit-test and fell
 * through to handlePointerDown's final "clicked empty space" branch, which
 * anchors at the profile's LAST point. Dragging from the START hem therefore
 * grew a leg off the OTHER END of the profile — a wrong leg, not a no-op.
 *
 * Geometry is asserted against the autosave payload rather than pixels, the
 * same way flashdraft-regression.spec.ts does: it is the only way to prove
 * WHICH end grew, since a prepend and an append both raise the point count
 * by one.
 *
 * No auth required — FlashDraft's canvas is a public page.
 */
import { test, expect, type Page } from '@playwright/test';

const AUTOSAVE_KEY = 'afs-flashdraft-autosave';

// page.tsx's own PIXELS_PER_INCH, and the zoom a fresh canvas starts at. The
// profile below is drawn with explicit pixel offsets and nothing in the
// gesture re-fits the view, so every point's screen position stays known
// without reaching into the component for zoom/pan.
const PIXELS_PER_INCH = 20;

// The brief's hem: an Open hem, 1 7/8" fold, 3/8" gap.
const HEM_LENGTH_IN = 1.875;
const HEM_GAP_IN = 0.375;

// Mirrors lib/flashdraft/draw-profile-scene.ts's own MIN_READABLE_R floor and
// HEM_GLYPH_LENGTH_SCALE, and lib/flashdraft/hem-glyph.ts's
// HEM_HOOK_LENGTH_FACTOR — the numbers the production hit-test now derives
// its area from. Restated here (not imported) deliberately: this spec drives a
// real browser through real pixels, so if the drawing moves and this does not,
// the test must fail rather than follow it silently.
const MIN_READABLE_R_PX = 10;
const HEM_HOOK_LENGTH_FACTOR = 1.8;

const HEM_FOLD_TIP_PX = HEM_LENGTH_IN * PIXELS_PER_INCH;
const HEM_GLYPH_R_PX = Math.max(MIN_READABLE_R_PX, HEM_FOLD_TIP_PX);
/** Distance from the metal endpoint to the hem's outermost visible point. */
const HEM_VISIBLE_END_PX = HEM_FOLD_TIP_PX + HEM_GLYPH_R_PX * HEM_HOOK_LENGTH_FACTOR;

// A 3-point profile: a top leg out to the right and slightly up, then a drop.
// Same gesture shape flashdraft-regression.spec.ts uses.
const LEG1 = { dx: 137, dy: -41 };
const LEG2 = { dx: 30, dy: -179 };

interface DraftPoint {
  x: number;
  y: number;
  radius?: number;
}

interface DraftHem {
  type: string;
  gapIn: number;
  lengthIn: number;
  kick: string;
}

async function readAutosavePoints(page: Page): Promise<DraftPoint[] | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return (JSON.parse(raw) as { points?: DraftPoint[] }).points ?? null;
  }, AUTOSAVE_KEY);
}

async function readAutosaveHems(page: Page): Promise<{ hemStart: DraftHem | null; hemEnd: DraftHem | null }> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { hemStart: null, hemEnd: null };
    const parsed = JSON.parse(raw) as { hemStart?: DraftHem | null; hemEnd?: DraftHem | null };
    return { hemStart: parsed.hemStart ?? null, hemEnd: parsed.hemEnd ?? null };
  }, AUTOSAVE_KEY);
}

/** Autosave is debounced ~500ms, so poll rather than sleeping a fixed time. */
async function waitForPointCount(page: Page, count: number): Promise<DraftPoint[]> {
  await expect
    .poll(async () => (await readAutosavePoints(page))?.length ?? -1, { timeout: 10000 })
    .toBe(count);
  const points = await readAutosavePoints(page);
  if (!points) throw new Error('autosave points disappeared');
  return points;
}

async function freshCanvas(page: Page): Promise<{ cx: number; cy: number }> {
  await page.goto('/studio/draft');
  await page.evaluate((key) => window.localStorage.removeItem(key), AUTOSAVE_KEY);
  await page.reload();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas box');
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

async function drawThreePointProfile(page: Page, cx: number, cy: number) {
  await page.mouse.click(cx, cy);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + LEG1.dx, cy + LEG1.dy, { steps: 10 });
  await page.mouse.up();
  await page.mouse.move(cx + LEG1.dx, cy + LEG1.dy);
  await page.mouse.down();
  await page.mouse.move(cx + LEG2.dx, cy + LEG2.dy, { steps: 10 });
  await page.mouse.up();
}

/** Puts the brief's Open hem on one endpoint and waits for autosave to record it. */
async function addOpenHem(page: Page, x: number, y: number, label: 'Start Hem' | 'End Hem') {
  await page.mouse.dblclick(x, y);
  await expect(page.getByText(label)).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'open', exact: true }).click();
  const popup = page.locator('div.z-50').filter({ has: page.getByText(label) });
  await popup.locator('input[type="number"]').nth(0).fill(String(HEM_LENGTH_IN));
  await popup.locator('input[type="number"]').nth(1).fill(String(HEM_GAP_IN));
  await expect
    .poll(async () => {
      const hems = await readAutosaveHems(page);
      const hem = label === 'Start Hem' ? hems.hemStart : hems.hemEnd;
      return hem?.lengthIn === HEM_LENGTH_IN && hem?.gapIn === HEM_GAP_IN;
    }, { timeout: 10000 })
    .toBe(true);
  // Dismiss the popup so it cannot swallow the pointer events that follow.
  await page.keyboard.press('Escape');
  await expect(page.getByText(label)).toHaveCount(0, { timeout: 3000 });
}

/**
 * The hem's own outward direction: away from the endpoint's one neighbour.
 * This is the same `u` renderHemAt builds, expressed in screen pixels (the
 * world-to-screen map is a uniform positive scale, so the direction is the
 * same number in both spaces).
 */
function outwardUnit(ex: number, ey: number, nx: number, ny: number) {
  const dx = ex - nx;
  const dy = ey - ny;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function along(ox: number, oy: number, u: { x: number; y: number }, px: number) {
  return { x: ox + u.x * px, y: oy + u.y * px };
}

async function dragFrom(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}

function bendCount(page: Page) {
  return page.getByText(/^Bend Count: \d+$/);
}

test.describe('FlashDraft — extend the profile by pressing its hem', () => {
  test('dragging from the START hem TIP prepends, and the hem moves to the new head', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    const before = await waitForPointCount(page, 3);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');

    await addOpenHem(page, cx, cy, 'Start Hem');
    const hemsBefore = await readAutosaveHems(page);
    expect(hemsBefore.hemStart).not.toBeNull();
    expect(hemsBefore.hemEnd).toBeNull();

    // The hem runs away from points[1]. Press on its outermost VISIBLE point
    // and drag further out along the same direction.
    const u = outwardUnit(cx, cy, cx + LEG1.dx, cy + LEG1.dy);
    const tip = along(cx, cy, u, HEM_VISIBLE_END_PX);
    const target = along(cx, cy, u, HEM_VISIBLE_END_PX + 120);
    await dragFrom(page, tip.x, tip.y, target.x, target.y);

    // 1. It grew at the HEAD: every previous point is still there, in order,
    //    one index later, behind a genuinely new head. Before this fix the
    //    same gesture appended at the TAIL instead — the wrong end entirely.
    const after = await waitForPointCount(page, 4);
    expect(after.slice(1)).toEqual(before);
    expect(after[0]).not.toEqual(before[0]);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');
    // Still no closing last->first leg.
    expect(after[0]).not.toEqual(after[after.length - 1]);

    // 2. The new leg starts at the METAL ENDPOINT, not at the hem's tip: the
    //    old head is still points[1], so the new leg is points[0]->points[1]
    //    and its far end is where the pointer was released. Had the gesture
    //    anchored on the fold tip, points[1] would have moved.
    expect(after[1]).toEqual(before[0]);

    // 3. The hem is on the NEW free end, unchanged field for field, and
    //    nothing was stranded mid-profile.
    const hemsAfter = await readAutosaveHems(page);
    expect(hemsAfter.hemStart).toEqual(hemsBefore.hemStart);
    expect(hemsAfter.hemEnd).toBeNull();

    await page.screenshot({ path: 'test-results/hem-extend-start-tip.png' });
  });

  test('dragging from the END hem TIP appends, and the hem moves to the new tail', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    const before = await waitForPointCount(page, 3);

    const lastX = cx + LEG2.dx;
    const lastY = cy + LEG2.dy;
    await addOpenHem(page, lastX, lastY, 'End Hem');
    const hemsBefore = await readAutosaveHems(page);
    expect(hemsBefore.hemEnd).not.toBeNull();
    expect(hemsBefore.hemStart).toBeNull();

    const u = outwardUnit(lastX, lastY, cx + LEG1.dx, cy + LEG1.dy);
    const tip = along(lastX, lastY, u, HEM_VISIBLE_END_PX);
    const target = along(lastX, lastY, u, HEM_VISIBLE_END_PX + 120);
    await dragFrom(page, tip.x, tip.y, target.x, target.y);

    const after = await waitForPointCount(page, 4);
    // Pushed at the TAIL: every previous point keeps its own index.
    expect(after.slice(0, 3)).toEqual(before);
    expect(after[3]).not.toEqual(before[2]);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');

    const hemsAfter = await readAutosaveHems(page);
    expect(hemsAfter.hemEnd).toEqual(hemsBefore.hemEnd);
    expect(hemsAfter.hemStart).toBeNull();

    await page.screenshot({ path: 'test-results/hem-extend-end-tip.png' });
  });

  test('dragging from the hem BODY — the connecting line and the fold tip — also extends', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    const before = await waitForPointCount(page, 3);
    await addOpenHem(page, cx, cy, 'Start Hem');

    // Half way along the straight connecting line, well short of the glyph.
    const u = outwardUnit(cx, cy, cx + LEG1.dx, cy + LEG1.dy);
    const mid = along(cx, cy, u, HEM_FOLD_TIP_PX / 2);
    await dragFrom(page, mid.x, mid.y, mid.x - 40, mid.y + 130);

    const after = await waitForPointCount(page, 4);
    expect(after.slice(1)).toEqual(before);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');
    const hems = await readAutosaveHems(page);
    expect(hems.hemStart).not.toBeNull();
    expect(hems.hemEnd).toBeNull();
  });

  test('ONE undo takes back a hem-started extension, geometry and hem together', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    const before = await waitForPointCount(page, 3);
    await addOpenHem(page, cx, cy, 'Start Hem');
    const hemsBefore = await readAutosaveHems(page);

    const u = outwardUnit(cx, cy, cx + LEG1.dx, cy + LEG1.dy);
    const tip = along(cx, cy, u, HEM_VISIBLE_END_PX);
    await dragFrom(page, tip.x, tip.y, tip.x - 60, tip.y + 110);
    await waitForPointCount(page, 4);

    await page.keyboard.press('Control+z');
    const undone = await waitForPointCount(page, 3);
    expect(undone).toEqual(before);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');
    const hemsUndone = await readAutosaveHems(page);
    expect(hemsUndone.hemStart).toEqual(hemsBefore.hemStart);
    expect(hemsUndone.hemEnd).toBeNull();
  });

  test('a plain CLICK on the hem extends nothing, and a double-click still opens the hem popup', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    const before = await waitForPointCount(page, 3);
    await addOpenHem(page, cx, cy, 'Start Hem');

    const u = outwardUnit(cx, cy, cx + LEG1.dx, cy + LEG1.dy);
    const tip = along(cx, cy, u, HEM_VISIBLE_END_PX);

    // A click is a press and a release with no movement between them — under
    // the drag threshold, so it must commit nothing at all.
    await page.mouse.click(tip.x, tip.y);
    await page.waitForTimeout(1200);
    expect(await readAutosavePoints(page)).toEqual(before);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');
    await expect(page.getByText('Start Hem')).toHaveCount(0);

    // Double-clicking the hem still opens the Start Hem popup, through the
    // unchanged HEM_HIT_RADIUS_EXISTING_PX path, which is measured from a
    // point extrapolated HEM_TRIGGER_OFFSET_IN past the vertex — so it covers
    // the endpoint and the connecting line. Asserted at the fold tip, the far
    // end of that line.
    const foldTip = along(cx, cy, u, HEM_FOLD_TIP_PX);
    await page.mouse.dblclick(foldTip.x, foldTip.y);
    await expect(page.getByText('Start Hem')).toBeVisible({ timeout: 3000 });
    // ...and the double-click did not grow the profile either.
    expect(await readAutosavePoints(page)).toEqual(before);
    await page.screenshot({ path: 'test-results/hem-extend-dblclick-still-opens-popup.png' });
  });

  test('an UN-hemmed endpoint is unchanged — nothing out where a hem would be claims the press', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    const before = await waitForPointCount(page, 3);

    // Same pixel a hemmed head's tip would occupy, but this head carries no
    // hem — so that end must not claim the press, and the gesture must do
    // exactly what it did before this change: fall through to the
    // "clicked empty space" branch, which continues the line from the
    // profile's LAST point.
    const u = outwardUnit(cx, cy, cx + LEG1.dx, cy + LEG1.dy);
    const tip = along(cx, cy, u, HEM_VISIBLE_END_PX);
    await dragFrom(page, tip.x, tip.y, tip.x - 60, tip.y + 110);

    const after = await waitForPointCount(page, 4);
    expect(after.slice(0, 3)).toEqual(before);
    expect(after[3]).not.toEqual(before[2]);
    const hems = await readAutosaveHems(page);
    expect(hems.hemStart).toBeNull();
    expect(hems.hemEnd).toBeNull();
  });

  test('hovering the hem offers the same grab cursor the bare endpoint does', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawThreePointProfile(page, cx, cy);
    await waitForPointCount(page, 3);
    await addOpenHem(page, cx, cy, 'Start Hem');

    const canvas = page.locator('canvas');
    const u = outwardUnit(cx, cy, cx + LEG1.dx, cy + LEG1.dy);
    const tip = along(cx, cy, u, HEM_VISIBLE_END_PX);

    // Park somewhere neutral first so the cursor really changes.
    await page.mouse.move(cx + 260, cy + 190);
    await expect.poll(async () => canvas.evaluate((el) => el.style.cursor)).toBe('crosshair');

    await page.mouse.move(tip.x, tip.y);
    await expect.poll(async () => canvas.evaluate((el) => el.style.cursor)).toBe('grab');
    // No blocking tooltip: a hemmed end extends like any other (rule #13).
    expect((await canvas.getAttribute('title')) ?? '').toBe('');
  });
});
