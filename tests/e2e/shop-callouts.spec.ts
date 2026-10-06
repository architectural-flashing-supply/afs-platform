import { test, expect } from '@playwright/test';
import { sql } from './helpers/db';
import { createShopJobFixture, deleteShopFixtures } from './helpers/shop-db';

/**
 * SHOP CALLOUTS, END TO END — Steve authors, the shop reads, the customer sees
 * nothing.
 *
 * ================== WHAT THIS PROVES, AND IN WHAT ORDER ==================
 *
 *   1. Steve double-right-clicks the FlashDraft canvas on a real job, types a
 *      note and saves it. The arrow and the numbered badge appear.
 *   2. The shop opens that job in Shop View and the note is there: the banner,
 *      the numbered badge, the words SHOP NOTE, the arrow on the profile, and
 *      the text in RED — asserted as a computed colour, not as a class name.
 *   3. The CUSTOMER-facing FlashDraft shows none of it: no layer, no button,
 *      no network call, and the admin API refuses a signed-out caller.
 *
 * ================== MIGRATION 051 GATES THIS WHOLE SPEC ==================
 *
 * `shop_callouts` has been applied to a LOCAL PostgreSQL cluster only; it is
 * NOT yet applied to the live Supabase project (PENDING REID — see
 * supabase/migrations/051_shop_callouts.sql's own header). So `beforeAll`
 * PROBES for the table and skips with that exact reason rather than failing
 * red for a reason that is not a defect. The moment the migration is applied,
 * this spec runs for real with no edit.
 *
 * ================== NOTHING REACHES THE MACHINE, NOTHING IS EMAILED ==================
 *
 * No test here approves anything or presses "Send to machine"; the shop row is
 * written by SQL exactly as tests/e2e/helpers/shop-db.ts documents, for the
 * same reason. Every fixture's job name carries the reserved `E2E-TEST-`
 * prefix (CLAUDE.md rule #21), so any mail this path ever grew would be
 * captured rather than delivered.
 */

const TEST_TAG = 'E2E-TEST-SHOP-CALLOUTS';
const NOTE_TEXT = 'Hems stay open, do not close them. Film side up.';

/** afs-crimson, the token the panel paints the note text with. */
const CRIMSON_RGB = 'rgb(192, 0, 26)';

/** A plain L, so an arrow anchored to leg 0 is unambiguous. */
const POINTS = [
  { x: -6, y: -3 },
  { x: 2, y: -3 },
  { x: 2, y: 4 },
];

const hasEnv = Boolean(
  process.env.SUPABASE_ACCESS_TOKEN &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.E2E_TEST_EMAIL &&
    process.env.E2E_TEST_PASSWORD
);

let tableExists = false;
let quoteRequestId = '';
let shopJobId = '';

async function probeTable(): Promise<boolean> {
  const rows = await sql<{ present: boolean }>(
    `select exists (
       select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'shop_callouts'
     ) as present;`
  );
  return rows[0]?.present === true;
}

test.describe('shop callouts', () => {
  test.skip(!hasEnv, 'SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL / E2E creds not set');
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeAll(async () => {
    tableExists = await probeTable();
    if (!tableExists) return;

    const users = await sql<{ id: string }>(
      `select id from profiles where lower(email) = lower('${process.env.E2E_TEST_EMAIL}') limit 1;`
    );
    const userId = users[0]?.id;
    if (!userId) throw new Error(`no profile for ${process.env.E2E_TEST_EMAIL}`);

    // A Job carrying real geometry on its line item — which is what the
    // authoring canvas loads and what the arrows are anchored against.
    const requestNumber = `AFS-QR-E2E-CALLOUT-${Date.now().toString(36).toUpperCase()}`;
    const lineItems = JSON.stringify([
      {
        profileName: `${TEST_TAG}-PROFILE`,
        material: 'Galvalume',
        gauge: '24 ga',
        quantity: 7,
        lengthFt: 10,
        points: POINTS,
      },
    ]).replace(/'/g, "''");
    const inserted = await sql<{ id: string }>(
      `insert into quote_requests
         (user_id, request_number, status, job_stage, stage_changed_at, source_tool,
          is_rush, rush_source, job_name, line_items)
       values ('${userId}', '${requestNumber}', 'submitted', 'new', now(), 'afs-flashdraft',
               false, null, '${TEST_TAG}-JOB', '${lineItems}'::jsonb)
       returning id;`
    );
    quoteRequestId = inserted[0].id;

    const fixture = await createShopJobFixture(TEST_TAG, quoteRequestId, {
      label: 'QUEUED',
      queuePosition: 1,
      customerEmail: 'forge@example.test',
      quantity: 7,
      machineProfileId: '32960999',
    });
    shopJobId = fixture.shopJobId;

    // The shop row needs the SAME geometry the callout was anchored against —
    // which is exactly what a real send writes (`geometry_points:
    // build.item.points` in the approve route).
    await sql(
      `update shop_profile_library
          set geometry_points = '${JSON.stringify(POINTS)}'::jsonb
        where id = '${shopJobId}';`
    );
  });

  test.afterAll(async () => {
    if (!hasEnv || !tableExists) return;
    // Callouts first: they FK to both rows below, and the audit rows point at
    // callout ids that must still exist to be found.
    if (quoteRequestId) {
      await sql(
        `delete from admin_audit_log
          where resource_type = 'shop_callout'
            and resource_id in (select id from shop_callouts where quote_request_id = '${quoteRequestId}');`
      );
      await sql(`delete from shop_callouts where quote_request_id = '${quoteRequestId}';`);
    }
    if (shopJobId) await sql(`delete from shop_callouts where shop_job_id = '${shopJobId}';`);
    await deleteShopFixtures(TEST_TAG);
    if (quoteRequestId) await sql(`delete from quote_requests where id = '${quoteRequestId}';`);
  });

  test('Steve double-right-clicks the canvas, types a note, and it saves', async ({ page }) => {
    test.skip(!tableExists, 'migration 051 is not applied to this database — PENDING REID');

    await page.goto(`/studio/draft?admin=1&loadRequest=${quoteRequestId}`);

    // The layer mounts only after the admin-guarded GET answered 200.
    const layer = page.getByTestId('shop-callout-layer');
    await expect(layer).toBeVisible({ timeout: 15000 });

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');

    // A SINGLE right-click must do exactly what it does today: nothing.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await expect(page.getByTestId('shop-callout-popup')).toHaveCount(0);

    // Two right-clicks inside 400ms and 8px, on the profile.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.mouse.click(box.x + box.width / 2 + 2, box.y + box.height / 2 + 1, { button: 'right' });

    const popup = page.getByTestId('shop-callout-popup');
    await expect(popup).toBeVisible();

    // An empty save is refused INLINE, and the typed text is never lost.
    await page.getByTestId('shop-callout-save').click();
    await expect(page.getByTestId('shop-callout-error')).toHaveText(/Type a note before saving/i);

    await page.getByTestId('shop-callout-textarea').fill(NOTE_TEXT);
    await expect(page.getByTestId('shop-callout-counter')).toContainText(
      String(280 - NOTE_TEXT.length)
    );
    await page.getByTestId('shop-callout-save').click();

    await expect(popup).toHaveCount(0);
    await expect(page.getByTestId('shop-callout-badge').first()).toHaveText('1');

    // And it is really in the database, attributed to the session's own user.
    const rows = await sql<{ note: string; segment_index: number; orphaned: boolean }>(
      `select note, segment_index, orphaned from shop_callouts
        where quote_request_id = '${quoteRequestId}' and deleted_at is null;`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe(NOTE_TEXT);
    expect(rows[0].orphaned).toBe(false);
  });

  test('a click out in empty space creates nothing and says so', async ({ page }) => {
    test.skip(!tableExists, 'migration 051 is not applied to this database — PENDING REID');

    await page.goto(`/studio/draft?admin=1&loadRequest=${quoteRequestId}`);
    await expect(page.getByTestId('shop-callout-layer')).toBeVisible({ timeout: 15000 });

    const before = await sql<{ n: number }>(
      `select count(*)::int as n from shop_callouts where quote_request_id = '${quoteRequestId}' and deleted_at is null;`
    );

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('no canvas');
    // Top-left corner — far from an L drawn around the middle of the canvas.
    const x = box.x + 24;
    const y = box.y + 24;
    await page.mouse.click(x, y, { button: 'right' });
    await page.mouse.click(x + 1, y + 1, { button: 'right' });

    await expect(page.getByTestId('shop-callout-toast')).toHaveText('Click closer to the profile');
    await expect(page.getByTestId('shop-callout-popup')).toHaveCount(0);

    const after = await sql<{ n: number }>(
      `select count(*)::int as n from shop_callouts where quote_request_id = '${quoteRequestId}' and deleted_at is null;`
    );
    expect(after[0].n).toBe(before[0].n);
  });

  test('the shop sees the banner, the badge, the label, the arrow and RED text', async ({ page }) => {
    test.skip(!tableExists, 'migration 051 is not applied to this database — PENDING REID');

    await page.goto('/admin/shop-view');
    await expect(page.locator('[data-hydrated="true"]')).toBeVisible({ timeout: 15000 });

    // The board-level banner, in Reid's own words.
    await expect(page.getByTestId('shop-board-callout-banner')).toContainText(
      /shop note.* from Steve — read before running/
    );

    // v7's own note pill, now with a real count behind it.
    const row = page.locator(`[data-shop-job-id="${shopJobId}"]`);
    await expect(row).toBeVisible();
    const toggle = row.getByTestId('shop-notes-toggle');
    await expect(toggle).toContainText('1 note');
    await toggle.click();

    const panel = page.getByTestId('shop-callouts-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId('shop-callouts-banner')).toBeVisible();

    // THE ARROW, drawn on the profile.
    await expect(panel.getByTestId('shop-callout-drawing')).toBeVisible();
    await expect(panel.locator('[data-callout-arrow="1"]')).toHaveCount(1);

    // THE NOTE: numbered, labelled SHOP NOTE, and RED — asserted as a computed
    // colour so a renamed token or a lost class cannot pass.
    const note = panel.getByTestId('shop-callout-note').first();
    await expect(note).toContainText(NOTE_TEXT);
    await expect(note).toContainText('SHOP NOTE 1');
    const noteColour = await note
      .locator('span.text-afs-crimson')
      .last()
      .evaluate((el) => getComputedStyle(el).color);
    expect(noteColour).toBe(CRIMSON_RGB);

    // RED IS NOT THE ONLY SIGNAL: the numbered badge survives greyscale.
    await expect(note.locator('span', { hasText: /^1$/ }).first()).toBeVisible();

    // Clicking the number highlights its arrow, and the arrow highlights back.
    await note.click();
    await expect(panel.locator('[data-callout-arrow="1"]')).toHaveAttribute('data-highlighted', 'true');
  });

  test('the customer-facing FlashDraft shows no callout anything', async ({ browser }) => {
    // storageState: undefined is LOAD-BEARING. `browser.newContext()` inherits
    // test.use's storageState, so without this the "customer" would be signed
    // in as the admin and the test would guard nothing — exactly the trap
    // SESSION_STATE.md records for 2026-10-03.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    const calloutRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('shop-callouts')) calloutRequests.push(r.url());
    });

    await page.goto('/studio/draft');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('shop-callout-layer')).toHaveCount(0);
    await expect(page.getByTestId('add-shop-note')).toHaveCount(0);
    // No job, so no gate request is even attempted.
    expect(calloutRequests).toEqual([]);

    // And the same with ?admin=1 typed by hand, which grants nothing.
    await page.goto('/studio/draft?admin=1');
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByTestId('shop-callout-layer')).toHaveCount(0);

    await context.close();
  });

  test('the API refuses a signed-out caller on every verb', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });

    const list = await context.request.get(
      `/api/admin/shop-callouts?quoteRequestId=${quoteRequestId || '00000000-0000-0000-0000-000000000000'}`
    );
    expect([401, 403]).toContain(list.status());

    const create = await context.request.post('/api/admin/shop-callouts', {
      data: { quoteRequestId, segmentIndex: 0, segmentCount: 2, t: 0.5, segA: { x: 0, y: 0 }, segB: { x: 1, y: 0 }, anchor: { x: 0.5, y: 0 }, tail: { dx: 0, dy: -1 }, note: 'should not be written' },
    });
    expect([401, 403]).toContain(create.status());

    const read = await context.request.get(
      `/api/shop-callouts/${shopJobId || '00000000-0000-0000-0000-000000000000'}`
    );
    expect([401, 403]).toContain(read.status());

    await context.close();

    if (tableExists && quoteRequestId) {
      const leaked = await sql<{ n: number }>(
        `select count(*)::int as n from shop_callouts
          where quote_request_id = '${quoteRequestId}' and note = 'should not be written';`
      );
      expect(leaked[0].n).toBe(0);
    }
  });

  test('a body-supplied company_id and author are ignored', async ({ page }) => {
    test.skip(!tableExists, 'migration 051 is not applied to this database — PENDING REID');

    const forgedCompany = '00000000-0000-0000-0000-0000000000ff';
    const forgedAuthor = '00000000-0000-0000-0000-0000000000fe';
    const res = await page.request.post('/api/admin/shop-callouts', {
      data: {
        quoteRequestId,
        companyId: forgedCompany,
        company_id: forgedCompany,
        createdBy: forgedAuthor,
        created_by: forgedAuthor,
        segmentIndex: 1,
        segmentCount: 2,
        t: 0.25,
        segA: { x: 2, y: -3 },
        segB: { x: 2, y: 4 },
        anchor: { x: 2, y: -1.25 },
        tail: { dx: 1.75, dy: 0 },
        note: 'Check the first piece against the cut sheet.',
      },
    });
    expect(res.ok()).toBe(true);
    const id = ((await res.json()) as { id: string }).id;

    const rows = await sql<{ company_id: string | null; created_by: string }>(
      `select company_id, created_by from shop_callouts where id = '${id}';`
    );
    expect(rows[0].company_id).not.toBe(forgedCompany);
    expect(rows[0].created_by).not.toBe(forgedAuthor);
  });

  test('a note over 280 characters is refused by the API', async ({ page }) => {
    test.skip(!tableExists, 'migration 051 is not applied to this database — PENDING REID');

    const res = await page.request.post('/api/admin/shop-callouts', {
      data: {
        quoteRequestId,
        segmentIndex: 0,
        segmentCount: 2,
        t: 0.5,
        segA: { x: -6, y: -3 },
        segB: { x: 2, y: -3 },
        anchor: { x: -2, y: -3 },
        tail: { dx: 0, dy: -1.75 },
        note: 'x'.repeat(281),
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('281');
  });

  test('editing the drawing orphans the note instead of deleting it', async ({ page }) => {
    test.skip(!tableExists, 'migration 051 is not applied to this database — PENDING REID');

    // Move the whole profile far away, as a real edit might. The note must
    // survive, with its text, and say what to do.
    await sql(
      `update quote_requests
          set line_items = jsonb_set(line_items, '{0,points}',
              '[{"x":200,"y":200},{"x":208,"y":200}]'::jsonb)
        where id = '${quoteRequestId}';`
    );

    const res = await page.request.get(
      `/api/admin/shop-callouts?quoteRequestId=${quoteRequestId}`
    );
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { callouts: { note: string; anchorStatus: string }[] };
    expect(body.callouts.length).toBeGreaterThan(0);
    for (const c of body.callouts) {
      expect(c.anchorStatus).toBe('orphaned');
      // THE TEXT SURVIVES. This is the assertion that matters.
      expect(c.note.length).toBeGreaterThan(0);
    }

    // And the flag was reconciled in the row rather than only in the response.
    const rows = await sql<{ n: number }>(
      `select count(*)::int as n from shop_callouts
        where quote_request_id = '${quoteRequestId}' and deleted_at is null and orphaned = true;`
    );
    expect(rows[0].n).toBe(body.callouts.length);

    await sql(
      `update quote_requests
          set line_items = jsonb_set(line_items, '{0,points}', '${JSON.stringify(POINTS)}'::jsonb)
        where id = '${quoteRequestId}';`
    );
  });
});
