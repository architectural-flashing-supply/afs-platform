import { test, expect, request as pwRequest } from '@playwright/test';
import fs from 'node:fs';

/**
 * A PHOTO TAKEN IN THE FIELD APP REACHES THE COMMAND CENTER WITHIN SECONDS.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE REGRESSION THIS PINS, AND WHAT IT ACTUALLY WAS.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Diagnosed 2026-10-09 against the live database, not guessed:
 *
 *   1. `V7Workbench.tsx` polled `router.refresh()` on a SIXTY-SECOND timer and
 *      nothing else. No Supabase realtime subscription exists for this screen,
 *      and `quote_requests` is in no realtime publication in any migration. So
 *      "within seconds" was not slow — it was impossible by construction.
 *   2. The Workbench card query did not select `upload_id`, so even once a
 *      field photo landed the board had no way to know a photograph existed,
 *      and `from-live.ts` set `drawing: null` unconditionally. The job appeared
 *      as an empty box.
 *
 * Both are fixed: a 5s `/api/admin/command-center/pulse` signature that
 * triggers a refresh only when something really moved, and a resolved
 * `profileSource` carrying the real photograph.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THIS TEST SUBMITS A REAL PHOTO THROUGH THE REAL ROUTES.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Not a seeded row and not a mocked response: it calls `/api/field/photo-upload`
 * for a signed URL, PUTs actual PNG bytes to Storage, and posts
 * `/api/field/quote-request` exactly as the contractor's phone does. A test
 * that inserted the row directly would pass while the upload path was broken,
 * which is most of what broke here.
 *
 * IT USES THE RESERVED `E2E-TEST-` JOB-NAME PREFIX (CLAUDE.md rule #20), so the
 * row is identifiable, is excluded from the pricing dataset and the CSV export,
 * captures rather than sends any mail, and is removable by
 * `scripts/audit/test-rows-clean.mjs`. It also deletes its own rows at the end.
 *
 * THE WORKBENCH IS LOADED **BEFORE** THE PHOTO IS SENT. That ordering is the
 * whole test: a page opened afterwards would show the job on its first render
 * and prove nothing about whether it ARRIVES. This one must watch it appear.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasAuth = fs.existsSync(authFile);

// playwright.config.ts loads .env.local into process.env for exactly this.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** The budget. The pulse is 5s; this allows for it plus a refresh and slack. */
const MUST_APPEAR_WITHIN_MS = 25_000;

/** A 1x1 PNG. The smallest real image bytes, so the upload path is genuinely exercised. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.use({ storageState: hasAuth ? authFile : undefined });

test.describe('field photo → Command Center', () => {
  test.skip(!hasAuth, 'Needs the admin storageState from auth.setup.ts.');
  test.skip(!SUPABASE_URL, 'Needs NEXT_PUBLIC_SUPABASE_URL to reach Storage.');

  test('a photo sent from the field app appears on the Workbench within seconds', async ({
    page,
    baseURL,
  }) => {
    const stamp = Date.now();
    const jobName = `E2E-TEST-field-photo-${stamp}`;
    let requestNumber = '';
    let requestId = '';

    // A SEPARATE, UNAUTHENTICATED CONTEXT. /field/contractor is an anonymous
    // guest flow; posting it from the admin's logged-in context would exercise
    // a path no contractor ever takes.
    const field = await pwRequest.newContext({ baseURL });

    try {
      // ── the Workbench is already open and settled, BEFORE anything is sent ──
      await page.goto('/admin/command-center', { waitUntil: 'load' });
      await page.waitForSelector('[data-stage]', { timeout: 30_000 });
      const before = await page.locator('[data-request-number]').count();

      // ── 1. ask for a signed upload token, exactly as the phone does ──────
      const signRes = await field.post('/api/field/photo-upload', {
        data: { filename: `${jobName}.png`, fileSize: PNG_1X1.byteLength },
      });
      expect(signRes.ok(), `photo-upload failed: ${signRes.status()} ${await signRes.text()}`).toBe(
        true,
      );
      const signed = (await signRes.json()) as {
        uploadId: string;
        storageKey: string;
        token: string;
      };
      expect(signed.uploadId, 'no uploadId came back').toBeTruthy();
      expect(signed.token, 'no upload token came back').toBeTruthy();

      // ── 2. PUT the real bytes to Storage ──────────────────────────────────
      // The endpoint supabase-js's `uploadToSignedUrl` posts to. The bucket is
      // the storage key's first segment and the key is passed whole — see
      // lib/data/v8-profile-source.ts's note on why that looks wrong and is
      // not: upload and read have always agreed on it.
      const bucket = signed.storageKey.split('/')[0];
      const putRes = await field.fetch(
        `${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${signed.storageKey}?token=${encodeURIComponent(signed.token)}`,
        { method: 'PUT', headers: { 'content-type': 'image/png' }, data: PNG_1X1 },
      );
      expect(putRes.ok(), `storage PUT failed: ${putRes.status()} ${await putRes.text()}`).toBe(true);

      // ── 3. submit the quote request, as the phone's second tap does ───────
      const sentAt = Date.now();
      const submitRes = await field.post('/api/field/quote-request', {
        data: {
          uploadId: signed.uploadId,
          jobName,
          clientBusinessName: 'E2E-TEST Field Co',
          notes: 'Submitted by tests/e2e/field-photo-arrives.spec.ts',
          guestEmail: `e2e-field-${stamp}@example.com`,
        },
      });
      expect(submitRes.ok(), `quote-request failed: ${submitRes.status()} ${await submitRes.text()}`).toBe(
        true,
      );
      const submitted = (await submitRes.json()) as { requestId: string; requestNumber: string };
      requestNumber = submitted.requestNumber;
      requestId = submitted.requestId;
      expect(requestNumber).toBeTruthy();

      // ── 4. IT MUST APPEAR ON ITS OWN. No reload, no navigation. ───────────
      const card = page.locator(`[data-request-number="${requestNumber}"]`);
      await expect(
        card,
        `${requestNumber} did not appear on the Workbench within ${MUST_APPEAR_WITHIN_MS / 1000}s ` +
          'without a manual reload — the pulse is not refreshing the board.',
      ).toBeVisible({ timeout: MUST_APPEAR_WITHIN_MS });

      const took = Date.now() - sentAt;
      // eslint-disable-next-line no-console
      console.log(`field photo ${requestNumber} appeared in ${(took / 1000).toFixed(1)}s`);

      // SECONDS, not a minute. The old 60s poll would fail this by itself.
      expect(took, 'it appeared, but not within seconds').toBeLessThan(MUST_APPEAR_WITHIN_MS);

      // The board really grew — guards against matching a card that was
      // already there.
      expect(await page.locator('[data-request-number]').count()).toBeGreaterThan(before);

      // ── 5. AND THE PHOTOGRAPH ITSELF IS ON THE CARD (rule 1b) ─────────────
      // Not an empty box, not a traced shape: the actual image the field app
      // uploaded, which is the other half of what "appears" has to mean.
      const raster = card.locator('[data-v8-profile-raster]');
      await expect(
        raster,
        'the job arrived but its photograph did not — the card is showing an empty box',
      ).toBeVisible({ timeout: 10_000 });
      const src = await raster.getAttribute('src');
      expect(src, 'the thumbnail has no image source').toBeTruthy();

      // Rule 5: every item gets a way into FlashDraft, photos especially.
      await expect(card.locator('[data-v8-viewer="photo"]')).toBeVisible();
    } finally {
      await field.dispose();
      // CLEANS UP AFTER ITSELF, through PostgREST with the service role rather
      // than through a new admin delete endpoint — this test is not a reason to
      // add a route that deletes jobs. The `E2E-TEST-` prefix also makes these
      // rows removable by scripts/audit/test-rows-clean.mjs if a run dies
      // before reaching here, but leaving litter for a script to find later is
      // not tidying up.
      if (requestId && SERVICE_KEY) {
        const db = await pwRequest.newContext();
        const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
        await db
          .delete(`${SUPABASE_URL}/rest/v1/quote_requests?id=eq.${requestId}`, { headers })
          .catch(() => undefined);
        await db
          .delete(`${SUPABASE_URL}/rest/v1/takeoff_uploads?request_id=eq.${requestId}`, { headers })
          .catch(() => undefined);
        await db.dispose();
      }
    }
  });
});
