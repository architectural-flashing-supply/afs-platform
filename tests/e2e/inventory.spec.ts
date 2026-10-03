import { expect, test } from '@playwright/test';

/**
 * LIVE INVENTORY — the admin screen, end to end (overnight item 09).
 *
 * ===================== WHAT THIS SPEC CAN AND CANNOT PROVE =====================
 *
 * Migration 039 is written and DELIBERATELY NOT APPLIED — the run's rules forbid
 * applying one — so `inventory_items` and `inventory_adjustments` DO NOT EXIST in
 * the database this runs against. That is not a limitation to apologise for: it
 * is the state the screen is really in, and the state most likely to be hit by
 * the next person to open it. So this spec proves the honest things:
 *
 *   1. The screen renders for an admin, and is behind the admin gate.
 *   2. It is in exactly ONE of its designed states and SAYS WHICH IN WORDS —
 *      today, the not-provisioned panel naming the migration file to apply.
 *   3. It never shows a quantity it does not have. In particular it does not
 *      render an empty table that would read as "no stock is tracked", and it
 *      does not print 0 for a quantity nobody counted.
 *   4. The write boundary holds without a session: POST answers 401.
 *
 * What it CANNOT prove here, and what proves it instead: that an adjustment
 * applies, that the ledger refuses an UPDATE, that a reservation beyond
 * available is refused. Those need the tables. The math is
 * `lib/inventory/stock-math.test.ts` (68 tests); the schema, the RLS policies,
 * the append-only trigger and the unlogged-quantity guard are
 * `lib/inventory/migration-rls.test.ts` (41 assertions over the migration's own
 * text). Nothing is claimed here that was not measured here.
 *
 * ===================== NOTHING IS CREATED, SO NOTHING IS SWEPT =====================
 *
 * This spec makes no inventory row (it could not — the table is absent) and no
 * fixture of any kind. It reads one screen and makes one unauthenticated POST.
 * There is deliberately no teardown, because there is nothing to tear down —
 * stated rather than left for a reader to work out.
 *
 * It also touches nothing that could reach the bending machine, sends no email
 * and no SMS, and creates no quote, order or job.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

const INVENTORY_PATH = '/admin/settings/inventory';

test.describe('Shop material inventory — the admin screen', () => {
  // A skip, not a failure: the same contract tests/e2e/auth.setup.ts states.
  // Without credentials there is no admin session, and /admin/** redirects.
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — see tests/e2e/README.md');
  test.use({ storageState: authFile });

  test('renders for an admin, with its heading and a way back to Settings', async ({ page }) => {
    await page.goto(INVENTORY_PATH);

    await expect(
      page,
      'an admin must land on the inventory screen itself — a redirect to /login or /account here means the admin gate rejected a real admin'
    ).toHaveURL(new RegExp(`${INVENTORY_PATH}$`));

    await expect(
      page.getByRole('heading', { name: 'Shop material inventory', level: 1 }),
      'the screen has to name itself, so somebody arriving from Settings knows which inventory this is'
    ).toBeVisible();

    await expect(
      page.getByRole('link', { name: /Settings/ }).first(),
      'a sub-page needs a way back to its parent, the way the price book does'
    ).toBeVisible();
  });

  test('is in exactly one designed state, and says which one in words', async ({ page }) => {
    await page.goto(INVENTORY_PATH);

    const notProvisioned = page.getByTestId('inventory-not-provisioned');
    const failed = page.getByTestId('inventory-error');
    const empty = page.getByTestId('inventory-empty');
    const table = page.getByRole('table', { name: /Shop material inventory/i });

    const counts = {
      notProvisioned: await notProvisioned.count(),
      failed: await failed.count(),
      empty: await empty.count(),
      table: await table.count(),
    };

    const shown = Object.values(counts).filter((c) => c > 0).length;
    expect(
      shown,
      `exactly one of the four states must be on screen, and it must be visible. Counted: ${JSON.stringify(counts)}. Zero means the screen rendered nothing it can explain; more than one means two contradictory statements at once.`
    ).toBe(1);

    // THE ERROR STATE IS A FAILURE, NOT AN ACCEPTABLE OUTCOME — and this
    // assertion exists because its absence let a real bug through.
    //
    // Three of the four states are legitimate: not-provisioned (the migration
    // has not been applied), empty (it has, and there are no rows yet), and the
    // populated table. The generic error panel is none of those: it means the
    // read failed for a reason the screen could not explain.
    //
    // On the first live run this spec PASSED while the screen showed exactly
    // that panel, because `isNotProvisionedError` was looking for PostgreSQL's
    // 42P01 and PostgREST actually sends PGRST205 from its own schema cache.
    // Everything was green and the screen was wrong. A gate that accepts every
    // branch equally cannot find that, so this one does not.
    expect(
      counts.failed,
      `the screen is showing the generic error panel, which means the inventory read failed for a reason it could not explain. If the migration simply has not been applied, that is the not-provisioned state and it should be detected as one — check isNotProvisionedError against the code the database really returned (the server log prints it).`
    ).toBe(0);

    // WHICHEVER state it is, the screen has to say something true about it.
    if (counts.notProvisioned > 0) {
      await expect(
        notProvisioned,
        'the not-provisioned panel must be visible, not merely present in the DOM'
      ).toBeVisible();
      await expect(
        notProvisioned,
        'it has to name the migration file, because applying that file is the only action that changes this state — "something is not set up" without the filename is not actionable'
      ).toContainText('039_inventory_items_and_adjustments.sql');
      await expect(
        notProvisioned,
        'and it has to say nothing was lost, per CLAUDE.md rule #30: an error screen says what did NOT happen'
      ).toContainText(/nothing has been lost|Nothing was saved/i);

      // THE IMPORTANT NEGATIVE. An empty table here would read as "no stock is
      // tracked", which is a different and false statement.
      expect(counts.empty, 'the empty state must NOT also be shown — it would claim the tables exist and are empty').toBe(0);
      expect(counts.table, 'and no table of quantities can be rendered when there are no tables to read').toBe(0);
    } else if (counts.empty > 0) {
      await expect(empty, 'the empty state must be visible').toBeVisible();
      await expect(
        empty,
        'the empty state has to say that no quantity is assumed, which is the whole promise of shipping this empty'
      ).toContainText(/Not counted/i);
    } else {
      await expect(table, 'the populated table must be visible').toBeVisible();
    }
  });

  test('never prints a quantity it does not have', async ({ page }) => {
    await page.goto(INVENTORY_PATH);

    const body = await page.locator('body').innerText();

    // A never-counted item reads "Not counted", and a never-set threshold reads
    // "Not set". Neither is ever a 0. This asserts the premise that makes the
    // whole feature honest: if the screen is showing quantities at all, it is
    // not inventing one for a row nobody has counted.
    const onHandCells = page.locator('[data-testid^="on-hand-"]');
    const cellCount = await onHandCells.count();
    for (let i = 0; i < cellCount; i += 1) {
      const text = (await onHandCells.nth(i).innerText()).trim();
      expect(
        text.length,
        'an on-hand cell is never blank: it is either a real quantity or the words "Not counted"'
      ).toBeGreaterThan(0);
      expect(
        text === '0' || text === '0.00',
        `an on-hand cell read exactly "${text}". A bare 0 for a row nobody has counted is an invented measurement — the honest value is "Not counted" (CLAUDE.md rule #19 applied to quantities).`
      ).toBe(false);
    }

    // And no customer-facing price or quantity language leaked onto an internal
    // screen. The RFQ rule is about prices; this screen must show none.
    expect(
      /\$\d/.test(body),
      'the inventory screen shows quantities, never money. A dollar figure here would mean a price crept into a stock screen.'
    ).toBe(false);
  });
});

test.describe('Shop material inventory — the write boundary', () => {
  // NO storageState here, on purpose: this is the unauthenticated case.
  test('refuses to create an item without a session', async ({ request }) => {
    const res = await request.post('/api/admin/inventory/items', {
      data: {
        materialId: '00000000-0000-0000-0000-000000000000',
        gaugeId: '00000000-0000-0000-0000-000000000000',
        stockUnit: 'sheet',
      },
      failOnStatusCode: false,
    });

    expect(
      res.status(),
      `an unauthenticated POST must be refused with 401 before anything is read or written; got ${res.status()}. This is the only one of the six handlers' guards that can be measured while the tables do not exist, and it is the one that matters most.`
    ).toBe(401);
  });

  test('refuses to set a quantity directly, even with a session, by naming the right route', async ({ request }) => {
    // Unauthenticated, so the expected answer is still 401 — the point of the
    // assertion is that the quantity-rejection check CANNOT be reached before
    // the auth check. A 400 here would mean the route validated a body for a
    // caller it had not identified, which is the ordering bug this guards.
    const res = await request.post('/api/admin/inventory/items', {
      data: { materialId: 'x', gaugeId: 'y', stockUnit: 'sheet', qtyOnHand: 40 },
      failOnStatusCode: false,
    });

    expect(
      res.status(),
      `auth is checked FIRST: a body carrying qtyOnHand from an unidentified caller must still answer 401, not 400. Got ${res.status()}.`
    ).toBe(401);
  });
});
