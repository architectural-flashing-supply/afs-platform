import { test, expect, type Page } from '@playwright/test';

// app/studio/draft is a public page (no login required to draw or match a
// profile — only the eventual quote submission needs auth/guest email).
// Gated on E2E_TEST_EMAIL/E2E_TEST_PASSWORD anyway, consistent with every
// other spec in this suite — see tests/e2e/README.md and the identical
// note in quote-request.spec.ts.
const hasCreds = !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;

// Shared by both tests below: places a 3-point/2-leg profile (point 1 by a
// plain click, points 2/3 by drag-to-draw) starting at (cx, cy). Extracted
// once both tests needed the identical setup (afs-sv-004's move test reuses
// this exactly), rather than duplicating it.
async function drawTwoLegProfile(page: Page, cx: number, cy: number) {
  // Point 1 — a single click on an empty canvas places the first point;
  // there's no prior point yet to drag a segment from (see
  // handlePointerDown's `points.length === 0` branch).
  await page.mouse.click(cx, cy);

  // Point 2 — drag-to-draw leg 1, horizontally. Pointerdown near the
  // last point arms drag-drawing; MIN_DRAG_SEGMENT_IN (0.05") is easily
  // cleared by a 150px drag at the default 1x zoom (20px/inch → 7.5").
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy, { steps: 10 });
  await page.mouse.up();

  // Point 3 — drag-to-draw leg 2, perpendicular to leg 1, creating one
  // real interior bend point (not just a straight extension).
  await page.mouse.move(cx + 150, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy - 150, { steps: 10 });
  await page.mouse.up();
}

test.describe('FlashDraft canvas', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');

  test('draws a two-leg profile, shows a nonzero blank width and bend count, and opens the 3D submit confirmation', async ({
    page,
  }) => {
    await page.goto('/studio/draft');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('FlashDraft canvas did not render a bounding box.');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);

    // bendCountLive = points.length - 2 → 1 for a 3-point/2-leg profile.
    await expect(page.getByText('Bend Count: 1')).toBeVisible();

    // blankWidthInLive sums leg lengths — formatInches(0) renders as
    // exactly `0"`, so any other value confirms a nonzero blank width.
    const blankWidthLine = page.getByText(/^Blank Width:/);
    await expect(blankWidthLine).toBeVisible();
    await expect(blankWidthLine).not.toHaveText('Blank Width: 0"');

    // openSubmitFlow() requires material + gauge before it will open the
    // 3D confirmation modal.
    await page.locator('#material').selectOption({ index: 1 });
    await page.locator('#gauge').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Submit for Quote' }).click();

    // SubmitConfirmation3DModal's heading is conditional on whether the
    // selected material is a painted finish.
    await expect(
      page.getByRole('heading', { name: /Confirm Your Profile|please confirm your painted side/i })
    ).toBeVisible();
  });

  // afs-sv-004 — Alt+drag is the whole-profile move gesture (see the
  // isMovingProfile doc comment in app/studio/draft/page.tsx). A pure
  // translation cannot change any leg length or bend angle, so the derived
  // Blank Width / Bend Count readout must read back byte-for-byte identical
  // after the move — this is the automated form of the task's "verify
  // explicitly" requirement.
  test('Alt+drag moves the whole profile without changing any leg length or the blank width', async ({ page }) => {
    await page.goto('/studio/draft');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('FlashDraft canvas did not render a bounding box.');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);

    const blankWidthLine = page.getByText(/^Blank Width:/);
    const bendCountLine = page.getByText(/^Bend Count:/);
    const blankWidthBefore = await blankWidthLine.textContent();
    const bendCountBefore = await bendCountLine.textContent();

    // Drag starting exactly ON the drawn geometry — the bend vertex placed
    // at (cx + 150, cy) by drawTwoLegProfile — specifically to prove
    // Alt+drag overrides the ordinary vertex-grab/leg-reshape gestures
    // there rather than only working over genuinely empty canvas.
    await page.mouse.move(cx + 150, cy);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(cx + 250, cy + 80, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    await expect(blankWidthLine).toHaveText(blankWidthBefore ?? '');
    await expect(bendCountLine).toHaveText(bendCountBefore ?? '');
  });

  // The reported bug: after a profile is drafted, clicking elsewhere on
  // empty canvas silently starts a new segment from the last point (see
  // handlePointerDown's "click empty space" branch). Lock Profile & Save
  // to Passport is the fix -- once locked, the canvas gets pointerEvents:
  // 'none' AND every mutation handler independently checks isLocked, so
  // this proves the actual reported symptom (a stray click extending the
  // drawing) is gone, not just that some internal flag got set.
  test('Lock Profile & Save to Passport stops the canvas from accepting further clicks/drags, and the profile saves', async ({
    page,
  }) => {
    await page.goto('/studio/draft');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('FlashDraft canvas did not render a bounding box.');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await drawTwoLegProfile(page, cx, cy);
    await expect(page.getByText('Bend Count: 1')).toBeVisible();

    await page.getByRole('button', { name: 'Lock Profile & Save to Passport' }).click();
    await expect(page.getByRole('heading', { name: 'Profile Details' })).toBeVisible();
    // Profile Name is pre-filled ("Untitled Profile"); Category/Subcategory
    // are optional (see ProfileDetailsModal's handleSave) -- OK alone saves.
    // exact: true -- a template button's accessible name loosely matched
    // "OK" as a substring without it, a real strict-mode violation found
    // live (not assumed) while smoke-testing this modal.
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // Confirms performSave's success path actually ran (a real DB write,
    // not just the button toggling some local-only "locked" flag) and that
    // it recognized lockOnSave and locked as a result.
    await expect(page.getByText('Profile locked and saved to your Passport')).toBeVisible();
    await expect(page.getByText('Profile Locked & Saved')).toBeVisible();

    const bendCountBefore = await page.getByText(/^Bend Count:/).textContent();
    const blankWidthBefore = await page.getByText(/^Blank Width:/).textContent();

    // Exactly the reported gesture: a click on empty canvas, away from the
    // existing geometry, that pre-lock would extend the line from the last
    // point (a new leg, bumping Bend Count).
    await page.mouse.click(cx + 150, cy - 300);
    await expect(page.getByText(/^Bend Count:/)).toHaveText(bendCountBefore ?? '');
    await expect(page.getByText(/^Blank Width:/)).toHaveText(blankWidthBefore ?? '');

    // A click-drag (the other half of the same bug -- drag-to-draw a new
    // segment) is equally a no-op while locked.
    await page.mouse.move(cx + 150, cy - 300);
    await page.mouse.down();
    await page.mouse.move(cx + 300, cy - 300, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText(/^Bend Count:/)).toHaveText(bendCountBefore ?? '');

    // Unlock restores normal editing.
    await page.getByRole('button', { name: 'Unlock to Edit' }).click();
    await expect(page.getByText('Profile Locked & Saved')).toHaveCount(0);
    await page.mouse.move(cx + 150, cy - 150);
    await page.mouse.down();
    await page.mouse.move(cx + 300, cy - 150, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText('Bend Count: 2')).toBeVisible();
  });
});

// afs-fl-020 — 20-item template list + VariantPicker for Coping Cap/Valley.
// Not gated on hasCreds like the describe block above: loading a template
// or opening VariantPicker is pure canvas/client state, no auth involved,
// same as drawTwoLegProfile's own "public page" note.
test.describe('FlashDraft templates (afs-fl-020)', () => {
  test('renders 21 template buttons, loads distinguishable placeholder geometry, and opens VariantPicker for Coping Cap and Valley', async ({
    page,
  }) => {
    await page.goto('/studio/draft');

    // loadTemplateGeometry window.confirm()s before replacing an
    // already-loaded shape — Playwright auto-dismisses unhandled dialogs,
    // which would silently no-op every template click after the first.
    page.on('dialog', (dialog) => dialog.accept());

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // 20 locked-list items + Coping Cap carried forward as a variant-picker
    // trigger (see the PLACEHOLDER GEOMETRY comment in page.tsx).
    const templateBar = page.getByText('Start From a Template').locator('..');
    const buttons = templateBar.getByRole('button');
    await expect(buttons).toHaveCount(21);

    // A plain (non-variant) template loads geometry straight onto the
    // canvas — Bend Count should go non-empty/nonzero-ish once loaded.
    await buttons.filter({ hasText: 'Sill' }).click();
    await expect(page.getByText(/^Bend Count:/)).toBeVisible();
    const sillBendCount = await page.getByText(/^Bend Count:/).textContent();

    await buttons.filter({ hasText: 'J-Channel' }).click();
    await expect(page.getByText(/^Bend Count:/)).toBeVisible();
    const jChannelBendCount = await page.getByText(/^Bend Count:/).textContent();

    // Different point counts (Sill: 4 pts/2 bends, J-Channel: 5 pts/3
    // bends) should read back as different Bend Count values — confirms
    // each template loads genuinely distinguishable geometry, not a
    // shared/copy-pasted shape.
    expect(sillBendCount).not.toBe(jChannelBendCount);

    // Coping Cap opens VariantPicker with exactly 3 selectable options.
    await buttons.filter({ hasText: 'Coping Cap' }).click();
    await expect(page.getByText('Choose a Variant')).toBeVisible();
    let variantButtons = page.locator('button').filter({ hasText: /Cleat$/ });
    await expect(variantButtons).toHaveCount(3);
    await variantButtons.filter({ hasText: '1-Piece Cleat' }).click();
    await expect(page.getByText('Choose a Variant')).toHaveCount(0);
    await expect(page.getByText(/^Bend Count:/)).toBeVisible();

    // Valley opens VariantPicker with exactly 3 selectable options.
    await buttons.filter({ hasText: 'Valley' }).click();
    await expect(page.getByText('Choose a Variant')).toBeVisible();
    variantButtons = page.locator('button').filter({
      hasText: /Closed \/ Rolled Hem|Open Hook|Heavy Reinforced Closed Fold/,
    });
    await expect(variantButtons).toHaveCount(3);
    await variantButtons.filter({ hasText: 'Open Hook' }).click();
    await expect(page.getByText('Choose a Variant')).toHaveCount(0);
  });
});
