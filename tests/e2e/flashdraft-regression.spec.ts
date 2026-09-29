import { test, expect, type Page } from '@playwright/test';

// Regression coverage for three bugs reported live on 2026-09-14:
//   1. Double-click on a leg endpoint doesn't open the hem popup.
//   2. Clicking between two different legs causes the profile/view to jump.
//   3. The inches stepper still increments by whole inches, not 1/16".
// No auth required — FlashDraft's canvas is a public page (see the note in
// flashdraft.spec.ts).

async function drawTwoLegProfile(page: Page, cx: number, cy: number) {
  await page.mouse.click(cx, cy);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 137, cy - 41, { steps: 10 });
  await page.mouse.up();
  await page.mouse.move(cx + 137, cy - 41);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy - 179, { steps: 10 });
  await page.mouse.up();
}

test.describe('FlashDraft regression — 2026-09-14', () => {
  test('BUG 2 repro: clicking leg A then leg B must not change zoom/pan', async ({ page }) => {
    await page.goto('/studio/draft');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);

    const zoomLabel = page.getByText(/^\d+%$/);
    const zoomBefore = await zoomLabel.textContent();

    // Click leg A's body (midpoint of first leg) to select it and mount the
    // segment-length input.
    await page.mouse.click(cx + 68, cy - 20);
    const legAValue = await page.locator('input[inputmode="decimal"]').inputValue();
    expect(legAValue.length).toBeGreaterThan(0);

    // Now click leg B's body — this is the exact gesture from the video.
    await page.mouse.click(cx + 83, cy - 110);

    const zoomAfter = await zoomLabel.textContent();
    await page.screenshot({ path: 'test-results/evidence-bug2-after-leg-switch.png' });
    expect(zoomAfter).toBe(zoomBefore);
  });

  test('BUG 1 repro: double-click on a leg endpoint opens the hem popup', async ({ page }) => {
    await page.goto('/studio/draft');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);

    // Select leg A first (mounts + focuses the segment-length input), then
    // double-click the FAR endpoint (point 0) — reproduces the exact
    // sequence from the video: select a leg, then go double-click an
    // endpoint.
    await page.mouse.click(cx + 68, cy - 20);
    await page.mouse.dblclick(cx, cy);

    await expect(page.getByText(/Hem$/)).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'test-results/evidence-bug1-hem-popup-open.png' });
  });

  test('BUG 3 repro: inches ArrowUp increments by 1/16", not a whole inch', async ({ page }) => {
    await page.goto('/studio/draft');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas box');
    await drawTwoLegProfile(page, box.x + box.width / 2, box.y + box.height / 2);

    const inches = page.locator('#lengthInches');
    await inches.fill('5.75');
    await inches.focus();
    await inches.press('ArrowUp');
    await expect(inches).toHaveValue('5.8125');
    await page.screenshot({ path: 'test-results/evidence-bug3-inches-stepped-1-16.png' });
  });
});

// ---------------------------------------------------------------------------
// lr-02 (2026-09-29) — extend-from-either-free-endpoint.
//
// Press-and-drag on the FIRST point prepends a leg; press-and-drag on the
// LAST point appends one; neither can ever create a closing last->first leg.
// The old Shift+drag prepend gesture (afs-sv-005) is gone entirely. An end
// carrying a hem refuses to extend and says why.
//
// Geometry is asserted against the AUTOSAVE payload rather than pixels, which
// does double duty: it is the only way to prove WHICH end grew (a prepend and
// an append both raise the bend count by one), and it is a live round-trip
// through the shared geometry validators F-01 added (isPointArrayShape /
// isHemShape in app/studio/draft/page.tsx) — the reload assertion below only
// passes if the written state survives them.
//
// No auth required — FlashDraft's canvas is a public page (see the note in
// flashdraft.spec.ts).
// ---------------------------------------------------------------------------

const AUTOSAVE_KEY = 'afs-flashdraft-autosave';

interface DraftPoint {
  x: number;
  y: number;
  radius?: number;
}

async function readAutosavePoints(page: Page): Promise<DraftPoint[] | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { points?: DraftPoint[] };
    return parsed.points ?? null;
  }, AUTOSAVE_KEY);
}

/** Autosave is debounced ~500ms, so poll rather than sleeping a fixed time. */
async function waitForAutosavePointCount(page: Page, count: number): Promise<DraftPoint[]> {
  await expect
    .poll(async () => (await readAutosavePoints(page))?.length ?? -1, { timeout: 10000 })
    .toBe(count);
  const points = await readAutosavePoints(page);
  if (!points) throw new Error('autosave points disappeared');
  return points;
}

/** A canvas with no autosaved profile restored onto it. */
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

async function dragFrom(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}

function bendCount(page: Page) {
  return page.getByText(/^Bend Count: \d+$/);
}

test.describe('FlashDraft geometry — lr-02 extend from either endpoint', () => {
  test('dragging the FIRST point prepends a leg at the head', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawTwoLegProfile(page, cx, cy);
    const before = await waitForAutosavePointCount(page, 3);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');

    // Press on point 0 (the pixel the first point was placed at — no pan or
    // zoom has happened, so it is still there) and drag away from the body
    // of the profile.
    await dragFrom(page, cx, cy, cx - 120, cy + 70);

    const after = await waitForAutosavePointCount(page, 4);
    // Inserted at the FRONT: every previous point is still present, in
    // order, one index later. This is what distinguishes a prepend from an
    // append — both produce 4 points and 2 bends.
    expect(after.slice(1)).toEqual(before);
    // ...and the new head is genuinely new, not a duplicate of the old one.
    expect(after[0]).not.toEqual(before[0]);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');

    // No closing last->first leg was created: the head and the tail are
    // still distinct points.
    expect(after[0]).not.toEqual(after[after.length - 1]);
    await page.screenshot({ path: 'test-results/evidence-lr02-prepend-from-first-point.png' });
  });

  test('dragging the LAST point still appends, unchanged', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawTwoLegProfile(page, cx, cy);
    const before = await waitForAutosavePointCount(page, 3);

    // The last point sits where drawTwoLegProfile released its second drag.
    await dragFrom(page, cx + 30, cy - 179, cx + 160, cy - 250);

    const after = await waitForAutosavePointCount(page, 4);
    // Pushed at the TAIL: every previous point keeps its own index.
    expect(after.slice(0, 3)).toEqual(before);
    expect(after[3]).not.toEqual(before[2]);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');
    await page.screenshot({ path: 'test-results/evidence-lr02-append-from-last-point.png' });
  });

  test('Shift+drag creates NO new leg (afs-sv-005 gesture removed)', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawTwoLegProfile(page, cx, cy);
    const before = await waitForAutosavePointCount(page, 3);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');

    // Shift held, dragging from the BODY of leg A. Under afs-sv-005 this
    // prepended a whole new leg from point 0 no matter where on the canvas
    // the drag started — it was checked before any hit-testing. Shift is now
    // bound to nothing and this is an ordinary leg reshape, so the point
    // COUNT must not move.
    await page.keyboard.down('Shift');
    await dragFrom(page, cx + 68, cy - 20, cx + 90, cy - 60);
    await page.keyboard.up('Shift');

    await expect(bendCount(page)).toHaveText('Bend Count: 1');
    const after = await readAutosavePoints(page);
    expect(after?.length).toBe(before.length);
    await page.screenshot({ path: 'test-results/evidence-lr02-shift-drag-no-new-leg.png' });
  });

  test('a hemmed end blocks extension and shows the tooltip', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawTwoLegProfile(page, cx, cy);
    const before = await waitForAutosavePointCount(page, 3);

    // Put an open hem on the START endpoint.
    await page.mouse.dblclick(cx, cy);
    await expect(page.getByText('Start Hem')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'open', exact: true }).click();
    await expect
      .poll(
        async () =>
          page.evaluate((key) => {
            const raw = window.localStorage.getItem(key);
            return raw ? Boolean((JSON.parse(raw) as { hemStart?: unknown }).hemStart) : false;
          }, AUTOSAVE_KEY),
        { timeout: 10000 }
      )
      .toBe(true);
    // Dismiss the popup so it cannot swallow the pointer events below.
    await page.keyboard.press('Escape');

    const canvas = page.locator('canvas');

    // Hovering the hemmed end explains why it will not extend.
    await page.mouse.move(cx + 200, cy + 200);
    await page.mouse.move(cx, cy);
    await expect(canvas).toHaveAttribute('title', 'Remove the hem to extend from this end.', { timeout: 5000 });

    // And the gesture itself is refused — no leg is prepended.
    await dragFrom(page, cx, cy, cx - 120, cy + 70);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');
    const after = await readAutosavePoints(page);
    expect(after?.length).toBe(before.length);

    // The OTHER end is unaffected and still extends normally.
    await dragFrom(page, cx + 30, cy - 179, cx + 160, cy - 250);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');
    await page.screenshot({ path: 'test-results/evidence-lr02-hem-blocks-extension.png' });
  });

  test('undo restores the pre-drag state in exactly ONE step', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawTwoLegProfile(page, cx, cy);
    const before = await waitForAutosavePointCount(page, 3);

    await dragFrom(page, cx, cy, cx - 120, cy + 70);
    await waitForAutosavePointCount(page, 4);
    await expect(bendCount(page)).toHaveText('Bend Count: 2');

    await page.keyboard.press('Control+z');

    const after = await waitForAutosavePointCount(page, 3);
    expect(after).toEqual(before);
    await expect(bendCount(page)).toHaveText('Bend Count: 1');
    await page.screenshot({ path: 'test-results/evidence-lr02-undo-one-step.png' });
  });

  test('a prepended profile round-trips through the F-01 autosave validators', async ({ page }) => {
    const { cx, cy } = await freshCanvas(page);
    await drawTwoLegProfile(page, cx, cy);
    await waitForAutosavePointCount(page, 3);
    await dragFrom(page, cx, cy, cx - 120, cy + 70);
    const written = await waitForAutosavePointCount(page, 4);

    // Reload: the restore effect re-validates the written payload through
    // isPointArrayShape / isHemShape (the F-01 finiteness guards). A payload
    // those reject is silently dropped and the canvas comes back empty, so a
    // surviving bend count proves the round trip.
    await page.reload();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(bendCount(page)).toHaveText('Bend Count: 2');
    const restored = await readAutosavePoints(page);
    expect(restored).toEqual(written);
    await page.screenshot({ path: 'test-results/evidence-lr02-autosave-roundtrip.png' });
  });
});
