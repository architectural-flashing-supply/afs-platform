import { test, expect, type Page } from '@playwright/test';
import WebSocketImpl from 'ws';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * THE JOB -> FLASHDRAFT HANDOFF, end to end (2026-10-03, branch
 * `cc-flashdraft-handoff`).
 *
 * WHAT THIS EXISTS TO PROVE. "Draw it in FlashDraft" on a Command Center job
 * used to be either a dead end (`needbox`: "Open in FlashDraft is not available
 * here") or, in v7's own fixture screen, a link to a bare `/studio/draft` — a
 * blank canvas, with the order's geometry and specification left behind. This
 * spec asserts the three honest outcomes the replacement promises, against real
 * rows, in a real browser:
 *
 *   1. A job carrying drawn geometry opens that geometry, EDITABLE, and saving
 *      writes the corrected profile back onto the job with who and when.
 *   2. A FIELD-APP job, which carries a photograph and no geometry at all,
 *      opens BLANK with that photo behind the canvas to trace. Nothing is
 *      invented — the assertion is explicitly that the canvas has NO points.
 *   3. A job with neither opens blank with the specification filled in, and
 *      says so rather than implying a drawing exists.
 *
 * ================== NOTHING REACHES THE MACHINE ==================
 *
 * This spec never approves anything and never presses "Send to machine". The
 * handoff route imports nothing from the machine integration — which is not a
 * claim resting on a reading of the file: the static single-door test
 * (lib/integrations/pathfinder-single-door.test.ts) fails if any file outside
 * the two approved callers so much as names the push function. Every job here
 * stays `status='submitted'`, `job_stage='new'`, which this spec asserts after
 * the write-back precisely so the single-door guard's own condition is
 * untouched by a correction.
 *
 * ================== NOTHING IS EMAILED ==================
 *
 * No route touched here sends mail. Job names still carry the reserved
 * `E2E-TEST-` prefix (CLAUDE.md rule #21), so anything that ever did would be
 * captured rather than delivered.
 *
 * ================== CLEANUP ==================
 *
 * Every row and every storage object created here is deleted in afterAll, even
 * if a test fails, and the audit rows the write-back writes go with them —
 * `admin_audit_log` has no FK to `quote_requests`, so they would otherwise be
 * left orphaned (the same trap tests/e2e/helpers/db.ts's deleteJob documents).
 */

// See the same guard in tests/e2e/modify-in-flashdraft.spec.ts: createClient
// asks for a global WebSocket whether or not realtime is ever used, and Node 20
// has none. Nothing here subscribes, so the symbol merely has to exist.
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocketImpl;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasEnv = Boolean(SUPABASE_URL && SERVICE_KEY && E2E_EMAIL && E2E_PASSWORD);

const TEST_TAG = 'E2E-TEST-FD-HANDOFF';

/** A distinctive W, so a mismatch between canvas and database is obvious. */
const DRAWN_POINTS = [
  { x: -9.5, y: -4.25 },
  { x: -4.5, y: 5.75 },
  { x: 0.5, y: -4.25 },
  { x: 5.5, y: 5.75 },
];
const DRAWN_HEM_START = { type: 'open', lengthIn: 0.625, gapIn: 0.1875, kick: 'inside' };
const DRAWN_HEM_END = { type: 'smashed', lengthIn: 0.5, gapIn: 0, kick: 'outside' };
const DRAWN_MATERIAL = 'Galvalume';
const DRAWN_GAUGE = '24 ga';
const CORRECTED_GAUGE = '22 ga';

/** A real 2x2 PNG, so the traced reference is a file Storage actually serves. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8//8/AzpgYkADIxkAAEaBAwOBFoKrAAAAAElFTkSuQmCC',
  'base64'
);

interface Created {
  geometryJobId: string;
  fieldJobId: string;
  metadataJobId: string;
  uploadId: string;
  storageKey: string;
}

let admin: SupabaseClient;
let testUserId: string;
let created: Created;
const savedProfileIds: string[] = [];

function requestNumber(suffix: string): string {
  // Deliberately NOT the AFS-QR-<year>-<seq> production format: a row this spec
  // creates must never be mistaken for, or collide with, a real request number
  // issued by app/api/quote-requests/route.ts's nextRequestNumber().
  return `AFS-QR-E2E-${suffix}-${Date.now().toString(36).toUpperCase()}`;
}

async function insertJob(fields: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await admin.from('quote_requests').insert({
    id,
    user_id: testUserId,
    project_id: null,
    status: 'submitted',
    job_stage: 'new',
    stage_changed_at: new Date().toISOString(),
    // RUSH IS NEVER INFERRED (CLAUDE.md rule #15) and nothing in this feature
    // sets it. Written explicitly false with a null source, which is the only
    // combination migration 034's CHECK accepts for a non-rush job.
    is_rush: false,
    rush_source: null,
    ...fields,
  });
  if (error) throw new Error(`insert quote_request: ${error.message}`);
  return id;
}

test.describe('Job -> FlashDraft handoff', () => {
  test.skip(!hasEnv, 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / E2E creds not set');
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

    const { data: users, error: userError } = await admin.auth.admin.listUsers();
    if (userError) throw new Error(`listUsers: ${userError.message}`);
    const me = users.users.find((u) => u.email?.toLowerCase() === E2E_EMAIL!.toLowerCase());
    if (!me) throw new Error(`no auth user for ${E2E_EMAIL}`);
    testUserId = me.id;

    // The traced reference — a real object in the real bucket, so the signed
    // URL the route mints is one a browser can actually fetch.
    const uploadId = crypto.randomUUID();
    const storageKey = `documents/field-photos/e2e/${uploadId}/sketch.png`;
    // THE FULL KEY, PREFIX INCLUDED. app/api/field/photo-upload/route.ts signs
    // its upload against the whole `documents/field-photos/...` string inside
    // the `documents` bucket, so a real object genuinely lives at that
    // redundant-looking path — and lib/data/job-screen.ts reads it back the
    // same way. Stripping the prefix here uploaded to a path the route then
    // could not sign, and the reference silently came back as "no image".
    const { error: upErr } = await admin.storage
      .from('documents')
      .upload(storageKey, PNG_BYTES, { contentType: 'image/png' });
    if (upErr) throw new Error(`storage upload: ${upErr.message}`);

    const { error: tuErr } = await admin.from('takeoff_uploads').insert({
      id: uploadId,
      user_id: testUserId,
      storage_key: storageKey,
      file_name: 'sketch.png',
      // THE EXTENSION, not a MIME type — this is what both real upload routes
      // write, and the reason lib/flashdraft/job-handoff.ts's
      // isTraceableImageType cannot be an `image/` prefix test.
      file_type: '.png',
      file_size_bytes: PNG_BYTES.length,
      status: 'uploaded',
    });
    if (tuErr) throw new Error(`takeoff_uploads: ${tuErr.message}`);

    created = {
      uploadId,
      storageKey,
      geometryJobId: await insertJob({
        request_number: requestNumber('GEO'),
        source_tool: 'afs-flashdraft',
        job_name: `${TEST_TAG} geometry`,
        client_business_name: 'E2E Handoff Builders',
        client_name: 'Carla',
        po_number: 'E2E-PO-1',
        color: 'Sandstone',
        notes: `${TEST_TAG} the customer drew this one`,
        line_items: [
          {
            unit: 'LF',
            quantity: 12,
            lengthFt: 10,
            material: DRAWN_MATERIAL,
            gauge: DRAWN_GAUGE,
            profileName: `${TEST_TAG} W profile`,
            profileType: 'Custom FlashDraft Profile',
            points: DRAWN_POINTS,
            hemStart: DRAWN_HEM_START,
            hemEnd: DRAWN_HEM_END,
            bendRadiiIn: [0.5, 0.5],
          },
        ],
      }),
      // EXACTLY what app/api/field/quote-request/route.ts inserts: an explicit
      // empty line_items array and an upload id. Nothing else.
      fieldJobId: await insertJob({
        request_number: requestNumber('FIELD'),
        source_tool: 'field_photo_quote',
        job_name: `${TEST_TAG} field app`,
        client_business_name: 'E2E Field Crew',
        client_name: 'Marco',
        line_items: [],
        upload_id: uploadId,
        notes: `${TEST_TAG} photo of a paper sketch`,
      }),
      metadataJobId: await insertJob({
        request_number: requestNumber('META'),
        source_tool: 'afs-quote-builder',
        job_name: `${TEST_TAG} described only`,
        client_business_name: 'E2E Desk Order',
        line_items: [
          {
            legA: 3,
            legB: 2,
            unit: 'LF',
            gauge: '26 ga',
            width: 12,
            height: 4,
            lengthFt: 10,
            material: 'Galvanized Steel',
            quantity: 40,
            profileType: 'Coping Cap',
          },
        ],
      }),
    };
  });

  test.afterAll(async () => {
    if (!admin || !created) return;
    const ids = [created.geometryJobId, created.fieldJobId, created.metadataJobId].filter(Boolean);
    for (const id of ids) {
      // The audit rows first: admin_audit_log has no FK to quote_requests, so
      // deleting the job alone would strand them pointing at a resource_id that
      // no longer resolves.
      await admin.from('admin_audit_log').delete().eq('resource_id', id);
      await admin.from('quote_requests').delete().eq('id', id);
    }
    if (savedProfileIds.length) {
      await admin.from('saved_configurations').delete().in('id', savedProfileIds);
    }
    if (created.uploadId) await admin.from('takeoff_uploads').delete().eq('id', created.uploadId);
    if (created.storageKey) {
      await admin.storage.from('documents').remove([created.storageKey]);
    }

    // Asserted, not assumed. A spec that claims it cleans up after itself
    // should fail when it has not.
    const { count } = await admin
      .from('quote_requests')
      .select('id', { count: 'exact', head: true })
      .in('id', ids);
    expect(count ?? 0, 'every job this spec created is deleted').toBe(0);
  });

  /**
   * The canvas's own autosaved model — real numbers, not a pixel diff.
   *
   * `expect` is REQUIRED rather than optional because waiting merely for the
   * key to EXIST is a race this spec lost on its first run: the autosave effect
   * writes the still-empty canvas before the handoff fetch resolves, so the
   * first value read back is `points: []` whatever the job carries. For a job
   * that has geometry the wait is for points to ARRIVE; for one that has none
   * the only honest wait is for the load to have finished and the debounce to
   * have passed, after which empty really means empty.
   */
  const AUTOSAVE_DEBOUNCE_SETTLE_MS = 1_500;

  async function canvasModel(
    page: Page,
    expectPoints: 'some' | 'none'
  ): Promise<{ points: { x: number; y: number }[]; hemStart: unknown; hemEnd: unknown } | null> {
    if (expectPoints === 'some') {
      await page.waitForFunction(
        () => {
          const raw = window.localStorage.getItem('afs-flashdraft-autosave');
          if (!raw) return false;
          try {
            return (JSON.parse(raw) as { points?: unknown[] }).points?.length ? true : false;
          } catch {
            return false;
          }
        },
        undefined,
        { timeout: 20_000 }
      );
    } else {
      await page.waitForTimeout(AUTOSAVE_DEBOUNCE_SETTLE_MS);
    }
    return page.evaluate(() => {
      const raw = window.localStorage.getItem('afs-flashdraft-autosave');
      return raw ? JSON.parse(raw) : null;
    });
  }

  // ------------------------------------------------------------------ (A)

  test('a job with drawn geometry offers a red Design in FlashDraft button in both places', async ({
    page,
  }) => {
    await page.goto(`/admin/command-center/job/${created.geometryJobId}`);

    const header = page.getByTestId('job-flashdraft-header');
    const profile = page.getByTestId('job-flashdraft-profile');
    await expect(header).toBeVisible();
    await expect(profile).toBeVisible();
    await expect(header).toHaveText('Design in FlashDraft');

    // v7's ONE action colour, via v7's own class. Not a new token and not a
    // Tailwind utility (CLAUDE.md rule #33).
    await expect(header).toHaveClass(/\bred\b/);

    // Both aim at the same job, through the one builder.
    const href = await header.getAttribute('href');
    expect(href).toContain(`loadRequest=${created.geometryJobId}`);
    expect(await profile.getAttribute('href')).toBe(href);

    // THE DEAD END IS GONE.
    await expect(page.getByText('Open in FlashDraft is not available here')).toHaveCount(0);
  });

  test('clicking it opens the real editor with the order\'s profile loaded and editable', async ({
    page,
  }) => {
    await page.goto(`/admin/command-center/job/${created.geometryJobId}`);
    await page.getByTestId('job-flashdraft-header').click();

    await expect(page).toHaveURL(/\/studio\/draft\?/);
    // The real editor, not a picture of one.
    await expect(page.locator('canvas')).toBeVisible();

    const banner = page.getByTestId('flashdraft-job-banner');
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText('E2E Handoff Builders');

    // The geometry really arrived — every point, both hems.
    const model = await canvasModel(page, 'some');
    expect(model).not.toBeNull();
    expect(model!.points).toEqual(DRAWN_POINTS);
    expect(model!.hemStart).toMatchObject({ type: 'open', gapIn: 0.1875, kick: 'inside' });
    expect(model!.hemEnd).toMatchObject({ type: 'smashed', kick: 'outside' });

    // And the specification came with it.
    await expect(page.locator('select#material')).toHaveValue(DRAWN_MATERIAL);
    await expect(page.locator('select#gauge')).toHaveValue(DRAWN_GAUGE);

    // EDITABLE — the canvas is not locked and takes pointer events.
    await expect(page.getByText('This profile is locked. View only.')).toHaveCount(0);
    await expect(page.locator('canvas')).not.toHaveCSS('pointer-events', 'none');
  });

  test('editing and saving writes the correction back and marks who and when', async ({ page }) => {
    await page.goto(`/studio/draft?admin=1&loadRequest=${created.geometryJobId}`);
    await expect(page.getByTestId('flashdraft-job-banner')).toBeVisible({ timeout: 20_000 });
    await canvasModel(page, 'some'); // the geometry must be on the canvas before it is edited

    // A real, deterministic edit.
    await page.locator('select#gauge').selectOption(CORRECTED_GAUGE);

    await page.getByRole('button', { name: /^save/i }).first().click();
    const nameField = page.getByLabel(/profile name/i);
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill(`${TEST_TAG} corrected`);
      await page.getByRole('button', { name: 'OK', exact: true }).click();
    }

    // The write-back reports itself where the estimator is looking.
    const writeback = page.getByTestId('flashdraft-job-writeback');
    await expect(writeback).toBeVisible({ timeout: 25_000 });
    await expect(writeback).toContainText('marked corrected by');

    const { data: row } = await admin
      .from('quote_requests')
      .select('line_items, status, job_stage')
      .eq('id', created.geometryJobId)
      .single();
    const item = (row as { line_items: Record<string, unknown>[] }).line_items[0];

    // THE HUMAN-CORRECTED MARKER: who, when, and which saved profile.
    expect(typeof item.correctedAt).toBe('string');
    expect(Number.isNaN(Date.parse(item.correctedAt as string))).toBe(false);
    expect(item.correctedBy).toBe(testUserId);
    expect(typeof item.correctedByName).toBe('string');
    expect((item.correctedByName as string).length).toBeGreaterThan(0);
    if (typeof item.correctedProfileId === 'string') savedProfileIds.push(item.correctedProfileId);

    // The EDIT was carried, and the geometry written is the canvas's own.
    expect(item.gauge).toBe(CORRECTED_GAUGE);
    const model = await canvasModel(page, 'some');
    expect(item.points).toEqual(model!.points);

    // A MERGE, NOT A REPLACEMENT — the customer's own fields survive.
    expect(item.quantity).toBe(12);
    expect(item.unit).toBe('LF');

    // AND NOTHING WAS APPROVED. Correcting a drawing is not an approval, so
    // the single-door guard's own condition (CLAUDE.md rule #14) still holds.
    const r = row as { status: string; job_stage: string };
    expect(r.status).toBe('submitted');
    expect(r.job_stage).toBe('new');

    // The Job screen now says so, by name and date.
    await page.goto(`/admin/command-center/job/${created.geometryJobId}`);
    const mark = page.getByTestId('job-flashdraft-corrected');
    await expect(mark).toBeVisible();
    await expect(mark).toContainText('Corrected in FlashDraft by');
  });

  // ------------------------------------------------------------------ (B)

  test('a FIELD-APP job opens blank with the photo behind the canvas, and invents no geometry', async ({
    page,
  }) => {
    await page.goto(`/admin/command-center/job/${created.fieldJobId}`);

    const header = page.getByTestId('job-flashdraft-header');
    // v7's own word for this case (prototype line 1250).
    await expect(header).toHaveText('Finish in FlashDraft');
    await header.click();

    await expect(page.getByTestId('flashdraft-job-banner')).toBeVisible({ timeout: 20_000 });

    // The photo is really behind the canvas, and really loads.
    const underlay = page.getByTestId('flashdraft-reference-underlay');
    await expect(underlay).toBeVisible();
    // POLLED, not sampled once: the signed URL is a real network fetch and the
    // element exists before the bytes arrive. Sampling `complete` the instant
    // the element appeared made this test flaky rather than wrong.
    await expect
      .poll(
        () =>
          underlay.evaluate(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0
          ),
        { message: 'the signed reference image actually loads', timeout: 15_000 }
      )
      .toBe(true);

    // NOTHING WAS INVENTED. The canvas is blank — a photograph is not a profile.
    const model = await canvasModel(page, 'none');
    expect(model?.points ?? []).toHaveLength(0);

    // But everything the order really knows did come across.
    await expect(page.getByTestId('flashdraft-job-banner')).toContainText('E2E Field Crew');

    // The estimator can turn the reference off.
    await page.getByTestId('flashdraft-underlay-toggle').uncheck();
    await expect(underlay).toHaveCount(0);
  });

  // ------------------------------------------------------------------ (C)

  test('a described-only job opens blank and says so rather than implying a drawing', async ({
    page,
  }) => {
    await page.goto(`/admin/command-center/job/${created.metadataJobId}`);
    const header = page.getByTestId('job-flashdraft-header');
    await expect(header).toHaveText('Draw it in FlashDraft');
    await expect(page.getByText(/no drawing was attached/i).first()).toBeVisible();
    await header.click();

    await expect(page.getByTestId('flashdraft-job-banner')).toBeVisible({ timeout: 20_000 });
    // No photo to trace, so no underlay and no controls pretending there is one.
    await expect(page.getByTestId('flashdraft-reference-underlay')).toHaveCount(0);
    const model = await canvasModel(page, 'none');
    expect(model?.points ?? []).toHaveLength(0);
    // The quote-builder's legA/legB/width/height were NOT promoted to a shape.
    await expect(page.locator('select#material')).toHaveValue('Galvanized Steel');
  });

  // ------------------------------------------------------------------ guard

  test('the handoff refuses a caller with no admin session, on both verbs', async ({ browser }) => {
    // `storageState: undefined` IS LOAD-BEARING. Playwright applies this
    // describe's `test.use({ storageState })` to contexts made with
    // `browser.newContext()` as well, so a bare call here produced a fully
    // SIGNED-IN context and the test passed a 200 off as the anonymous case.
    // Opting out explicitly is the only way to get a genuinely signed-out
    // caller, and a guard test that is not actually signed out guards nothing.
    const anon = await browser.newContext({ storageState: undefined });
    const get = await anon.request.get(
      `/api/admin/command-center/job-handoff/${created.geometryJobId}`
    );
    expect(get.status(), (await get.text()).slice(0, 300)).toBe(401);
    // The body carries no job data at all, not merely a non-200 status.
    expect(await get.text()).not.toContain('points');

    const post = await anon.request.post(
      `/api/admin/command-center/job-handoff/${created.geometryJobId}`,
      { data: { itemIndex: 0, points: DRAWN_POINTS } }
    );
    expect(post.status()).toBe(401);
    await anon.close();

    // And nothing was written by the refused POST.
    const { data: row } = await admin
      .from('quote_requests')
      .select('line_items')
      .eq('id', created.metadataJobId)
      .single();
    const item = (row as { line_items: Record<string, unknown>[] }).line_items[0];
    expect(item.points).toBeUndefined();
  });
});
