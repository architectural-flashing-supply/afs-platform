import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
    await page.getByRole('button', { name: /sign in|log in/i }).click();
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
    const nameField = page.getByLabel(/profile name/i);
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill('E2E MODIFY RESULT');
      await page.getByRole('button', { name: /save/i }).last().click();
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
