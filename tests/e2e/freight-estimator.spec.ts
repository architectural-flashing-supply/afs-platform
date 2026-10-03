import { test, expect } from '@playwright/test';
import { dbConfigured, deleteJob, sql } from './helpers/db';

/**
 * THE FREIGHT ESTIMATOR, END TO END.
 *
 * ================== WHAT THIS SPEC ASSERTS, AND WHY THAT ==================
 *
 * It asserts the state the application is REALLY in, which is the whole point
 * of an end-to-end test. Migration 039 is written and DELIBERATELY NOT APPLIED
 * (the overnight run's hard rule is migration FILES only), so on every
 * deployment this spec can reach, the five freight tables do not exist. The
 * honest things to prove are therefore:
 *
 *   1. The rate editor LOADS and says, in plain English, that the tables are
 *      not installed — rather than throwing, rendering an empty table that
 *      looks like unfilled data, or showing controls that cannot save.
 *   2. Settings links to it, so the screen is reachable rather than orphaned.
 *   3. THE MANUAL FREIGHT PATH IS UNBROKEN. This is the one that matters: the
 *      "Freight Amount ($)" box has been the whole of this feature since the
 *      beginning and must keep working with no rate table at all.
 *
 * ================== WHAT IT DELIBERATELY DOES NOT DO ==================
 *
 * It writes NOTHING to the freight tables. It cannot — they are not there — and
 * a spec that created zones and rates would be asserting against a database
 * state no environment has, which is how a green suite stops meaning anything.
 * When 039 is applied, the band-boundary, surcharge, threshold and override
 * behaviour it would then be worth driving through the UI is already pinned by
 * 135 unit tests in `lib/freight/*.test.ts`, at the exact pound and the exact
 * cent.
 *
 * It also sends no quote. `POST /api/admin/quote-requests/[id]/send` delivers a
 * formal quote to a real customer's portal and fires a notification; this spec
 * fills the freight box and asserts the value, and stops there.
 *
 * ================== AND IT TOUCHES NO REAL QUOTE REQUEST ==================
 *
 * The estimator test drives its OWN fixture, created and deleted by this spec,
 * for a reason worth writing down: `app/admin/quote-requests/[id]/page.tsx`
 * moves a request from `submitted` to `reviewing` AS A SIDE EFFECT OF BEING
 * OPENED (ARCHITECTURE.md §6's estimator workflow). A first draft of this spec
 * walked the real list looking for one that renders an estimator, and the live
 * database has 11 requests of which exactly 1 would — so it would have flipped
 * up to 9 real requests out of `submitted` just by looking at them. CLAUDE.md
 * rule #14's single-door guard requires `status='submitted'`, so that is not a
 * harmless browse.
 *
 * The fixture is created at `status='reviewing'` so opening it changes nothing
 * at all, carries the reserved `E2E-TEST-` job-name prefix, and is deleted in
 * `afterAll` with the shared `deleteJob` sweep.
 */

const authFile = 'tests/e2e/.auth/user.json';
const canRun = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

/** The reserved prefix (lib/pricing/ledger.ts's LEDGER_TEST_TAG_PREFIX). */
const TEST_TAG = 'E2E-TEST-FREIGHT';

test.describe('Freight estimator', () => {
  test.skip(!canRun, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD are required to reach any /admin screen');
  test.use({ storageState: authFile });

  test('the freight rates screen loads and explains that the table is not set up yet', async ({ page }) => {
    await page.goto('/admin/settings/freight');

    // Not the sign-in page. Without storageState every /admin route redirects,
    // and a spec that measured the login screen while reporting an admin route
    // name is how the sign-in flow's own contrast failures went unnoticed for
    // a release (CLAUDE.md rule #28).
    await expect(
      page,
      'The admin freight screen must be reachable with the stored admin session, not redirected to /login.'
    ).not.toHaveURL(/\/login/);

    await expect(
      page.getByRole('heading', { name: 'Freight rates', level: 1 }),
      'The page heading proves the route rendered rather than falling through to an error boundary.'
    ).toBeVisible();

    const notInstalled = page.getByTestId('freight-not-installed');
    const emptyState = page.getByTestId('freight-empty-state');

    // Either honest state is a pass, because which one shows depends on
    // whether migration 039 has been applied to the environment under test —
    // and the point is that NEITHER is a crash and neither is a blank screen.
    // Today it is the first.
    const notInstalledVisible = await notInstalled.isVisible().catch(() => false);
    if (notInstalledVisible) {
      await expect(
        notInstalled,
        'With migration 039 unapplied the screen must name the migration, so somebody reading it knows ' +
          'what to apply rather than suspecting a bug.'
      ).toContainText('039_freight_rate_table_and_estimates.sql');
      await expect(
        notInstalled,
        'And it must say freight can still be entered by hand, so nobody concludes that quoting is blocked.'
      ).toContainText('entered by hand');
    } else {
      await expect(
        emptyState,
        'With 039 applied and nothing entered, the screen must show the add-a-zone empty state. A third ' +
          'possibility — a blank screen — is the failure this assertion exists to catch.'
      ).toBeVisible();
      await expect(
        emptyState,
        'The empty state must say why nothing is pre-filled: a guessed freight rate would reach a customer.'
      ).toContainText('guessed freight rate');
    }
  });

  test('Settings links to the freight rates screen', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page, 'Settings must be reachable with the stored admin session.').not.toHaveURL(/\/login/);

    const link = page.getByTestId('settings-freight-link');
    await expect(
      link,
      'A screen nothing links to is a screen nobody finds. The link lives in Settings → Pricing, beside ' +
        'the price book.'
    ).toBeVisible();

    await link.click();
    await expect(
      page,
      'And it must actually navigate there — a link to the wrong path passes a visibility check and ' +
        'fails the user.'
    ).toHaveURL(/\/admin\/settings\/freight$/);
  });

  test.describe('on a quote request', () => {
    test.skip(!dbConfigured(), 'SUPABASE_ACCESS_TOKEN is required to create and remove the fixture');

    let fixtureId: string | null = null;

    test.beforeAll(async () => {
      // The estimator needs a non-guest request, so the fixture borrows the E2E
      // account's own profile as its customer. A real customer is never the E2E
      // account, so this cannot reach one.
      const owner = await sql<{ id: string }>(
        `select id from profiles where role = 'admin' order by created_at asc limit 1;`
      );
      if (owner.length === 0) return;

      const rows = await sql<{ id: string }>(
        `insert into quote_requests
           (request_number, user_id, status, line_items, jobsite_address, notes, job_name, submitted_at)
         values (
           '${TEST_TAG}-REQ',
           '${owner[0].id}',
           -- 'reviewing', NOT 'submitted': opening the screen would move a
           -- submitted request on, and this spec must change nothing.
           'reviewing',
           '[{"profileType":"${TEST_TAG} Coping Cap","material":"Copper","gauge":"16 oz","width":8,"height":4,"lengthFt":10,"quantity":12,"unit":"LF"}]'::jsonb,
           '"${TEST_TAG} jobsite, Burnet TX"'::jsonb,
           'Created by tests/e2e/freight-estimator.spec.ts. Deleted in afterAll.',
           '${TEST_TAG}-REQ',
           now()
         )
         returning id;`
      );
      const insertedId = rows[0]?.id ?? null;
      if (insertedId === null) return;

      // READ IT BACK before trusting it. An insert that returned an id and a
      // row the application can actually load are two different claims, and
      // when they came apart the symptom was a bare 404 on the estimator
      // screen, which reads as a broken route rather than a broken fixture.
      const back = await sql<{ id: string; status: string; user_id: string | null }>(
        `select id, status, user_id from quote_requests where id = '${insertedId}';`
      );
      if (back.length !== 1 || back[0].user_id === null) return;
      if (process.env.AFS_PRINT_PROOF === '1') {
        console.log(`PROOF | fixture quote request: ${back[0].id} status=${back[0].status}`);
      }
      fixtureId = insertedId;
    });

    test.afterAll(async () => {
      if (!fixtureId) return;
      await deleteJob(fixtureId);
      const left = await sql<{ n: number }>(
        `select count(*)::int as n from quote_requests where request_number = '${TEST_TAG}-REQ';`
      );
      // TEARDOWN LEAVES NO ARTIFACTS, and that is asserted rather than assumed.
      expect(left[0]?.n, 'The fixture quote request must be gone after the spec.').toBe(0);
    });

    test('the manual freight amount box still works, with no rate table at all', async ({ page }) => {
      test.skip(fixtureId === null, 'The fixture quote request could not be created');

      await page.goto(`/admin/quote-requests/${fixtureId}`);
      await expect(page, 'The estimator screen must be reachable.').not.toHaveURL(/\/login/);

      await expect(
        page.getByTestId('estimator-form'),
        'The fixture has a user_id, line items and a quotable status, so the estimator form must render.'
      ).toBeVisible();

      // THE ASSERTION THIS WHOLE SPEC EXISTS FOR. The freight box predates the
      // estimator by every migration, is the only freight input that has ever
      // shipped, and must keep working with no rate table at all.
      const freightBox = page.locator('#freight-amount');
      await expect(
        freightBox,
        'The "Freight Amount ($)" box must still be on the quote screen. The freight panel was built ' +
          'AROUND it, not over it: with no rate table it is the whole of the feature, which is ' +
          "SPEC_FREIGHT_ESTIMATOR.md §3's own documented interim behaviour."
      ).toBeVisible();

      await freightBox.fill('185.50');
      await expect(
        freightBox,
        'And it must still accept a typed amount. Nothing about the estimate may stand between an ' +
          'estimator and typing a freight figure.'
      ).toHaveValue('185.50');

      await expect(
        page.getByTestId('freight-panel'),
        'The freight panel must render on the quote screen, not be skipped when there is no rate table.'
      ).toBeVisible();

      // With migration 039 unapplied, the panel must say so rather than showing
      // an empty zone dropdown that looks like a configuration somebody lost.
      await expect(
        page.getByTestId('freight-panel-not-installed'),
        'The panel must explain why there is no automatic estimate, and confirm that typing the amount ' +
          'is the way forward — the alternative is an estimator wondering what broke.'
      ).toContainText('Type the freight amount below');

      // And no dollar figure may be presented as an estimate when there is no
      // rate table to have produced one.
      await expect(
        page.getByTestId('freight-estimate'),
        'No estimate block may render without a rate table. A figure on this panel is a figure an ' +
          'estimator is entitled to trust.'
      ).toHaveCount(0);

      // The freight class is still shown, because it comes from the longest
      // piece and SPEC §4's own table and needs no rate data at all.
      await expect(
        page.getByTestId('freight-panel'),
        'The fixture\'s longest piece is 10 ft, which is class 92.5 — knowable with an entirely empty ' +
          'rate book, and the one piece of freight information AFS actually has today.'
      ).toContainText('Class 92.5');
    });
  });
});
