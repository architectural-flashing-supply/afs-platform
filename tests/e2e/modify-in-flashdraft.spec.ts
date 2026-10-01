import { test, expect, type Page } from '@playwright/test';
import WebSocketImpl from 'ws';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * WHY THIS POLYFILL EXISTS, AND WHY IT IS THREE LINES RATHER THAN A REWRITE.
 *
 * `createClient` builds a realtime client whether or not you ever subscribe to
 * anything, and that constructor asks for a global `WebSocket`. Node 20 does not
 * have one, so this spec threw at `createClient` — before any query, before any
 * assertion — and all three of its tests were reported as failing for a reason
 * that had nothing to do with "Modify in FlashDraft". It is recorded as PENDING
 * in SESSION_STATE.md's v2-05 entry.
 *
 * `ws` is already a devDependency of this repo. Assigning it here, in the test
 * process only, is enough: nothing in this spec uses realtime, so the socket is
 * never opened — the constructor just needs the symbol to exist. The alternative
 * on the table was converting the whole spec to the Management API SQL channel
 * (tests/e2e/helpers/db.ts), which would mean re-verifying a Part 1 spec to fix
 * a Node version problem.
 *
 * Guarded, so this becomes a no-op the day the runner moves to Node 22+.
 */
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = WebSocketImpl;
}

/**
 * Part 1 (2026-09-30) — "Modify in FlashDraft".
 *
 * Proves the safety property that matters: opening a LOCKED profile for
 * modification produces a new, unlocked, fully-populated draft, and the
 * locked original is left byte-identical.
 *
 * Rows are created and deleted through the service role, scoped to the E2E
 * test user only, and every id created is torn down in afterAll even if a
 * test fails (Part 6's test-isolation rule).
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const E2E_EMAIL = process.env.E2E_TEST_EMAIL;
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD;
const hasEnv = !!(SUPABASE_URL && SERVICE_KEY && E2E_EMAIL && E2E_PASSWORD);

/** The source geometry — a distinctive Z so a mismatch is obvious. */
const SOURCE_POINTS = [
  { x: -12.5, y: -6.25 },
  { x: -12.5, y: 3.75 },
  { x: 4.25, y: 3.75 },
  { x: 4.25, y: 11.5 },
];
const SOURCE_HEM_START = { type: 'open', lengthIn: 0.5, gapIn: 0.875, kick: 'inside' };
const SOURCE_HEM_END = { type: 'smashed', lengthIn: 0.375, gapIn: 0, kick: 'outside' };
const SOURCE_MATERIAL = 'Galvalume';
const SOURCE_GAUGE = '24 ga';

let admin: SupabaseClient;
let testUserId: string;
let sourceId: string;
const createdIds: string[] = [];

test.describe('Modify in FlashDraft', () => {
  test.skip(!hasEnv, 'needs SUPABASE_SERVICE_ROLE_KEY + E2E_TEST_EMAIL/PASSWORD — see tests/e2e/README.md');

  test.beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });
    const { data: users, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    const found = users.users.find((u) => u.email === E2E_EMAIL);
    if (!found) throw new Error(`E2E user ${E2E_EMAIL} not found`);
    testUserId = found.id;

    const { data, error: insertError } = await admin
      .from('saved_configurations')
      .insert({
        user_id: testUserId,
        name: 'E2E MODIFY SOURCE (locked)',
        is_locked: true,
        length_ft: 9.5,
        quantity: 3,
        notes: 'E2E source notes',
        job_info: { clientBusinessName: 'E2E Co', clientName: 'E2E Person', poNumber: 'E2E-PO-1', jobName: 'E2E Job' },
        dimensions: {
          kind: 'flashdraft',
          points: SOURCE_POINTS,
          hemStart: SOURCE_HEM_START,
          hemEnd: SOURCE_HEM_END,
          revision: 4,
          isLocked: true,
          material: SOURCE_MATERIAL,
          gauge: SOURCE_GAUGE,
          paintFace: 'down',
          lengthFeet: '9',
          lengthInches: '6',
        },
      })
      .select('id')
      .single();
    if (insertError) throw insertError;
    sourceId = (data as { id: string }).id;
    createdIds.push(sourceId);
  });

  test.afterAll(async () => {
    if (!admin) return;
    // Scoped twice over: by id AND by the test user, so a bad id can never
    // reach another user's row.
    for (const id of createdIds) {
      await admin.from('saved_configurations').delete().eq('id', id).eq('user_id', testUserId);
    }
    // Sweep anything this spec's naming convention created but did not track.
    await admin
      .from('saved_configurations')
      .delete()
      .eq('user_id', testUserId)
      .like('name', 'E2E MODIFY%');
  });

  async function login(page: Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD!);
    // ANCHORED, for the reason tests/e2e/auth.setup.ts already records: the login
    // page also renders a "Sign in with magic link instead" toggle, so an
    // unanchored /sign in|log in/i matches two buttons and Playwright's strict
    // mode refuses the click. Latent here since that toggle shipped, and only
    // reachable once the WebSocket polyfill above let this spec get as far as
    // logging in.
    await page.getByRole('button', { name: /^(log in|sign in)$/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  }

  test('the enlarged view offers Modify in FlashDraft for a locked profile', async ({ page }) => {
    await login(page);
    await page.goto('/app/profile-passport');
    await page.getByText('E2E MODIFY SOURCE (locked)').first().click();
    const modify = page.getByTestId('modify-in-flashdraft');
    await expect(modify).toBeVisible();
    await expect(modify).toHaveAttribute('href', `/studio/draft?modifyProfile=${sourceId}`);
  });

  test('Modify opens an unlocked draft with geometry, hems, material and gauge matching the source', async ({ page }) => {
    await login(page);
    await page.goto(`/studio/draft?modifyProfile=${sourceId}`);

    // The lineage banner proves this is a modify session, not an edit of the
    // original, and that the draft is editable (no "View only" banner).
    await expect(page.getByTestId('modified-from-banner')).toBeVisible();
    await expect(page.getByTestId('modified-from-banner')).toContainText('E2E MODIFY SOURCE (locked)');
    await expect(page.getByTestId('modified-from-banner')).toContainText('rev 5');
    await expect(page.getByText('This profile is locked. View only.')).toHaveCount(0);

    // Specification fields restored exactly.
    await expect(page.locator('select#material')).toHaveValue(SOURCE_MATERIAL);
    await expect(page.locator('select#gauge')).toHaveValue(SOURCE_GAUGE);

    // Geometry + hems: read the canvas's own autosaved model rather than
    // pixel-diffing, so the assertion is on real numbers.
    // The canvas autosave is DEBOUNCED ~500ms after the last model change
    // (app/studio/draft/page.tsx's AUTOSAVE_KEY effect), and a modify load sets
    // the geometry only once its fetch resolves — so reading localStorage the
    // instant the banner appears reliably read null. Wait for the write rather
    // than for a fixed delay.
    await page.waitForFunction(
      () => !!window.localStorage.getItem('afs-flashdraft-autosave'),
      undefined,
      { timeout: 15_000 }
    );
    const model = await page.evaluate(() => {
      const raw = window.localStorage.getItem('afs-flashdraft-autosave');
      return raw ? JSON.parse(raw) : null;
    });
    expect(model).not.toBeNull();
    expect(model.points).toEqual(SOURCE_POINTS);
    expect(model.hemStart).toMatchObject({ type: 'open', gapIn: 0.875, kick: 'inside' });
    expect(model.hemEnd).toMatchObject({ type: 'smashed', kick: 'outside' });
  });

  test('saving the modified draft creates a NEW row linked to the source, leaving the original untouched', async ({ page }) => {
    const { data: before } = await admin
      .from('saved_configurations')
      .select('name, is_locked, dimensions, length_ft, quantity')
      .eq('id', sourceId)
      .single();

    await login(page);
    await page.goto(`/studio/draft?modifyProfile=${sourceId}`);
    await expect(page.getByTestId('modified-from-banner')).toBeVisible();

    // Make a real edit, then save under a distinct name.
    await page.locator('select#gauge').selectOption('22 ga');
    await page.getByRole('button', { name: /^save/i }).first().click();
    // ProfileDetailsModal's confirm button is labelled "OK", not "Save". The old
    // `getByRole('button', { name: /save/i }).last()` resolved to the page's own
    // "Save Draft" button BEHIND the modal's overlay, so every click was
    // intercepted by the backdrop until the test timed out. Target the modal's
    // real button.
    const nameField = page.getByLabel(/profile name/i);
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill('E2E MODIFY RESULT');
      await page.getByRole('button', { name: 'OK', exact: true }).click();
    }
    await expect(page.getByText(/profile saved/i)).toBeVisible({ timeout: 20_000 });

    // The new row exists, is unlocked, and points back at the source.
    const { data: children } = await admin
      .from('saved_configurations')
      .select('id, name, is_locked, source_profile_id, dimensions')
      .eq('user_id', testUserId)
      .eq('source_profile_id', sourceId);
    expect(children && children.length).toBeGreaterThan(0);
    const child = (children as { id: string; is_locked: boolean | null; source_profile_id: string; dimensions: { revision?: number; gauge?: string } }[])[0];
    createdIds.push(child.id);
    expect(child.id).not.toBe(sourceId);
    expect(child.source_profile_id).toBe(sourceId);
    expect(child.is_locked).toBeFalsy();
    expect(child.dimensions.revision).toBe(5);
    expect(child.dimensions.gauge).toBe('22 ga');

    // The original is byte-identical to before.
    const { data: after } = await admin
      .from('saved_configurations')
      .select('name, is_locked, dimensions, length_ft, quantity')
      .eq('id', sourceId)
      .single();
    expect(after).toEqual(before);
    expect((after as { is_locked: boolean }).is_locked).toBe(true);
  });
});
