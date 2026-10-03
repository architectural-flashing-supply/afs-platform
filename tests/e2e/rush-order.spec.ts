import { test, expect, type APIRequestContext } from '@playwright/test';
import { dbConfigured, deleteJob, deleteTestNotifications, sql } from './helpers/db';

/**
 * RUSH ORDER, END TO END — ovn item 10-rush-order.
 *
 * WHAT THIS SPEC PROVES, and what it deliberately does not:
 *
 *   PROVES  the customer can request rush AND give a date, and both land in the
 *           database as separate, explicit facts
 *   PROVES  a date on its own does NOT make a job rush (CLAUDE.md rule #15)
 *   PROVES  a rush job carries a visible badge in an existing admin queue list
 *   PROVES  the customer-facing rush step shows no dollar amount at all
 *   PROVES  Settings → Rush policy renders its empty state honestly
 *
 *   DOES NOT exercise a configured rush policy, because `rush_policies` is
 *           created by migration 039 and THIS RUN MAY NOT APPLY A MIGRATION.
 *           So the screen under test here is the not-yet-applied state, which
 *           is exactly the state the deployment is really in — and the
 *           surcharge arithmetic itself is unit-tested exhaustively instead, in
 *           lib/pricing/rush-policy.test.ts, where a policy can be a fixture.
 *           That split is honest about what each harness can actually see.
 *
 * NOTHING REACHES THE MACHINE. This file does not click "Send to machine", does
 * not call an approval route, and does not import anything from
 * lib/integrations. Every job it creates stays at the `new` stage.
 *
 * NO EMAIL LEAVES THE BUILDING. Every job's name carries the reserved
 * `E2E-TEST-` prefix, so lib/email/outbound.ts CAPTURES its mail rather than
 * sending it, and no `notifications` row is written for a captured message
 * (CLAUDE.md rules #20, #21, #25).
 *
 * CLEANUP: every job this file creates is deleted in afterAll, and the delete is
 * then PROVEN rather than assumed by reading the table back.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const canReadDb = dbConfigured();

/**
 * The reserved prefix (lib/pricing/ledger.ts's `LEDGER_TEST_TAG_PREFIX`) plus a
 * token unique to this spec, so cleanup is exact and mail is captured.
 */
const TEST_TAG = 'E2E-TEST-RUSH-ORDER';

/** A date far enough out that it is a valid future date on any day of the week. */
function dateInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface CreatedJob {
  requestId: string;
  requestNumber: string;
}

/**
 * Submits through the REAL public intake route — the same one
 * app/quote/page.tsx posts to, with the same `sourceTool` token and the same
 * two fields the wizard now sends. Nothing is inserted behind the app's back,
 * so what is asserted afterwards is genuinely what the route stored.
 */
async function submitQuoteRequest(
  request: APIRequestContext,
  label: string,
  rush: { isRush?: boolean; requestedDelivery?: string | null }
): Promise<CreatedJob> {
  const res = await request.post('/api/quote-requests', {
    data: {
      sourceTool: 'afs-quote-builder',
      guestEmail: process.env.E2E_TEST_EMAIL,
      jobName: `${TEST_TAG} ${label}`,
      notes: `${TEST_TAG} ${label}`,
      jobsiteAddress: '1 Test Street, Burnet, TX 78611',
      ...rush,
      items: [
        {
          profileType: 'Drip Edge',
          material: 'Galvalume',
          gauge: '24 ga',
          quantity: 4,
          lengthFt: 10,
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as { requestId: string; requestNumber: string };
  expect(body.requestId, 'the intake route must return the id it created').toBeTruthy();
  return body;
}

/** The three rush columns plus the date, straight out of Postgres. */
async function readRushColumns(id: string): Promise<{
  is_rush: boolean;
  rush_source: string | null;
  rush_set_at: string | null;
  requested_delivery: string | null;
}> {
  const rows = await sql<{
    is_rush: boolean;
    rush_source: string | null;
    rush_set_at: string | null;
    requested_delivery: string | null;
  }>(
    `select is_rush, rush_source, rush_set_at, requested_delivery
     from quote_requests where id = '${id.replace(/[^0-9a-f-]/gi, '')}';`
  );
  expect(rows.length, `expected exactly one quote_requests row for ${id}`).toBe(1);
  return rows[0];
}

// ===========================================================================
// THE CUSTOMER SIDE — no credentials and no database needed
// ===========================================================================

test.describe('the quote wizard asks for rush AND for a date, and shows no price', () => {
  test('the rush step offers both, keeps them separate, and never shows a dollar amount', async ({
    page,
  }) => {
    await page.goto('/quote');

    // Step 1 — the profile. Filled through the real controls, so the step
    // gating is exercised rather than bypassed.
    await page.getByRole('button', { name: 'Drip Edge', exact: true }).click();
    await page.selectOption('#material', 'Galvalume');
    await page.selectOption('#gauge', { index: 1 });
    await page.getByRole('button', { name: /^Next/ }).click();

    // Step 2 — the measurements.
    await page.fill('#lengthFt', '10');
    await page.fill('#quantity', '4');
    await page.getByRole('button', { name: /^Next/ }).click();

    // Step 3 — where rush lives.
    const neededBy = page.getByTestId('needed-by');
    await expect(
      neededBy,
      'the customer has to be able to say WHEN they need it, not only that it is urgent'
    ).toBeVisible();
    await expect(neededBy, 'it is a date picker, so a free-text "ASAP" never reaches the column').toHaveAttribute(
      'type',
      'date'
    );

    // THE SEPARATION, STATED TO THE CUSTOMER. Rule #15 is enforced in Postgres
    // and in a static test, but neither of those stops a customer from BELIEVING
    // a date is a rush request. This sentence is the part only the UI can do.
    await expect(
      page.getByText('A date on its own is not a rush request', { exact: false }),
      'the page must say that a date alone is not a rush request, or the customer and the constraint disagree'
    ).toBeVisible();

    // The spec's placeholder promise appears once rush is asked for, and it
    // promises SCHEDULING, not a turnaround nobody has supplied (checklist #32).
    await page.getByRole('button', { name: /Standard timeline|Rush requested/ }).click();
    await expect(page.getByTestId('rush-promise')).toContainText(
      'AFS will confirm turnaround in your formal quote'
    );

    // THE RFQ MODEL. Not one dollar amount anywhere on the rush step — no
    // surcharge, no estimate, no "from $". The only money a customer ever sees
    // is on the formal quote AFS sends them.
    const step3Text = (await page.locator('main').innerText()) || '';
    expect(
      step3Text,
      'a rush surcharge shown here would be a price before the formal quote, which the business model forbids'
    ).not.toMatch(/\$\s?\d/);

    // The date reaches the review step, so the customer can check it before
    // submitting rather than discovering it on a quote.
    const wanted = dateInDays(21);
    await neededBy.fill(wanted);
    await page.fill('#projectName', `${TEST_TAG} review`);
    await page.fill('#jobsiteAddress', '1 Test Street, Burnet, TX 78611');
    await page.getByRole('button', { name: /^Next/ }).click();

    await expect(page.getByTestId('review-needed-by')).toHaveText(wanted);
    await expect(page.getByText('RUSH REQUESTED', { exact: true })).toBeVisible();

    const reviewText = (await page.locator('main').innerText()) || '';
    expect(
      reviewText,
      'the review step is the last thing a customer reads before submitting and must still carry no price'
    ).not.toMatch(/\$\s?\d/);
  });
});

// ===========================================================================
// PERSISTENCE AND THE BADGE — these need the database and an admin session
// ===========================================================================

test.describe('the rush flag and the date persist, and the badge shows', () => {
  test.skip(
    !canReadDb,
    'SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL are required to read the row back'
  );

  const created: string[] = [];
  const runStartedAt = new Date().toISOString();
  const testRecipient = process.env.E2E_TEST_EMAIL ?? '';

  test.afterAll(async () => {
    if (!canReadDb) return;
    for (const id of created) await deleteJob(id);
    if (testRecipient) await deleteTestNotifications(testRecipient, runStartedAt);

    // PROVE the cleanup, rather than trusting that the deletes ran.
    const leftover = await sql<{ n: string }>(
      `select count(*)::text as n from quote_requests where job_name like '${TEST_TAG}%';`
    );
    expect(leftover[0].n, 'this spec must leave no rows behind').toBe('0');
  });

  test('rush ticked plus a date stores both, and names the checkbox as the source', async ({
    request,
  }) => {
    const wanted = dateInDays(21);
    const job = await submitQuoteRequest(request, 'both', {
      isRush: true,
      requestedDelivery: wanted,
    });
    created.push(job.requestId);

    const row = await readRushColumns(job.requestId);
    expect(row.is_rush, 'the customer ticked rush, so the row must be rush').toBe(true);
    expect(
      row.rush_source,
      'the provenance has to say WHICH of the two allowed sources set it — migration 034 refuses a rush with no source'
    ).toBe('customer_checkbox');
    expect(row.rush_set_at, 'a rush is stamped with when it was set').not.toBeNull();
    expect(
      row.requested_delivery,
      'the date the customer asked for is its own column and must arrive unchanged'
    ).toBe(wanted);
  });

  test('A DATE WITH NO TICK IS NOT RUSH — the date never implies urgency', async ({ request }) => {
    const wanted = dateInDays(3);
    const job = await submitQuoteRequest(request, 'date only', {
      // isRush omitted entirely, exactly as a customer who filled in a date and
      // left the toggle alone would send it.
      requestedDelivery: wanted,
    });
    created.push(job.requestId);

    const row = await readRushColumns(job.requestId);
    expect(
      row.is_rush,
      'a date only three days out must NOT make the job rush. This is the inference CLAUDE.md rule #15 exists to forbid, and it is forbidden in the route, in a static test and in a Postgres CHECK.'
    ).toBe(false);
    expect(row.rush_source, 'a standard job carries no rush provenance').toBeNull();
    expect(row.requested_delivery, 'the date itself is still stored — it is just not a rush flag').toBe(
      wanted
    );
  });

  test('a tick with no date is rush with no date, and neither field invents the other', async ({
    request,
  }) => {
    const job = await submitQuoteRequest(request, 'tick only', { isRush: true });
    created.push(job.requestId);

    const row = await readRushColumns(job.requestId);
    expect(row.is_rush, 'rush was ticked').toBe(true);
    expect(
      row.requested_delivery,
      'no date was given, and the app must not invent one from the rush flag any more than the reverse'
    ).toBeNull();
  });

  test.describe('the admin side', () => {
    test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD are required for an admin session');
    test.use({ storageState: authFile });

    test('a rush job carries a RUSH badge in the Workbench lane it lands in', async ({
      page,
      request,
    }) => {
      const job = await submitQuoteRequest(request, 'badge', {
        isRush: true,
        requestedDelivery: dateInDays(21),
      });
      created.push(job.requestId);

      await page.goto('/admin/command-center');
      const card = page.locator(`[data-request-number="${job.requestNumber}"]`).first();
      await expect(card, 'the job this spec just submitted must appear on the Workbench').toBeVisible();

      // The badge is PRE-EXISTING work — this item added no badge anywhere. It
      // is asserted here because the item requires rush to be visible in the
      // lists that already exist, and an assertion is the only way to know it
      // still is.
      //
      // MATCHED CASE-INSENSITIVELY ON PURPOSE, and the first version of this
      // test was wrong about which component draws it. `/admin/command-center`
      // renders `V7Workbench` in BOTH live and fixture mode, fed by
      // `lib/data/v7-view/from-live.ts`, whose pill text is the literal
      // `'RUSH'`. The older `components/admin/WorkbenchLanes.tsx` spells it
      // `'Rush'` and is not what this route mounts. What matters to this item
      // is that the badge is there and visible, not its casing, so the
      // assertion says that and nothing narrower.
      await expect(
        card.getByText(/^rush$/i),
        'a rush job has to be impossible to miss in the queue an estimator actually reads'
      ).toBeVisible();
    });

    test('the Job screen states the rush policy and does not pretend one exists', async ({
      page,
      request,
    }) => {
      const job = await submitQuoteRequest(request, 'job screen', {
        isRush: true,
        requestedDelivery: dateInDays(21),
      });
      created.push(job.requestId);

      await page.goto(`/admin/command-center/job/${job.requestId}`);
      await expect(page.getByRole('checkbox', { name: 'This is a rush job' })).toBeChecked();

      // One sentence, whichever state the deployment is in — the table missing,
      // the table empty, or a policy in force. All three are true statements;
      // none of them is a surcharge nobody set.
      await expect(page.getByTestId('rush-policy-sentence')).toBeVisible();
      await expect(page.getByTestId('rush-policy-sentence')).toContainText(
        /rush policy|No rush policy|rush job needs/i
      );
    });
  });
});

// ===========================================================================
// THE ADMIN POLICY SCREEN AND ITS EMPTY STATE
// ===========================================================================

test.describe('Settings → Rush policy is honest about having nothing in it', () => {
  test.skip(!hasCreds, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD are required for an admin session');
  test.use({ storageState: authFile });

  test('Settings links to it, and the blurb reads the real state', async ({ page }) => {
    await page.goto('/admin/settings');
    const link = page.getByTestId('settings-rush-policy-link');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Rush policy');
  });

  test('the screen says what state it is in, and offers no save it cannot honour', async ({
    page,
  }) => {
    await page.goto('/admin/settings/rush-policy');
    await expect(page.getByRole('heading', { level: 1, name: 'Rush policy' })).toBeVisible();

    const unavailable = page.getByTestId('rush-policy-unavailable');
    const empty = page.getByTestId('rush-policy-empty');
    const inForce = page.getByTestId('rush-policy-in-force');

    const states = await Promise.all([
      unavailable.count(),
      empty.count(),
      inForce.count(),
    ]);
    expect(
      states.filter((n) => n > 0).length,
      'exactly ONE of the three states must render — they are three different facts and showing two at once would be incoherent'
    ).toBe(1);

    if ((await unavailable.count()) > 0) {
      // THE STATE THIS DEPLOYMENT IS REALLY IN until somebody applies migration
      // 039. It must name the file, say that no quote is being surcharged, and
      // DISABLE the form — a save that cannot possibly land is worse than no
      // button at all.
      await expect(unavailable).toContainText('039_rush_policy.sql');
      await expect(unavailable).toContainText('No rush surcharge');
      await expect(
        page.getByTestId('rush-policy-save'),
        'with no table to write to, the save button must be disabled rather than failing on press'
      ).toBeDisabled();
    } else if ((await empty.count()) > 0) {
      // The shipped state once the migration IS applied: a real table with
      // nothing in it, because the surcharge is a business decision nobody has
      // made yet (checklist #36).
      await expect(empty).toContainText('No rush policy has been set yet');
      await expect(empty).toContainText('No rush surcharge is added to any quote');
      await expect(
        page.getByTestId('rush-policy-save'),
        'with a real table and no policy, saving the first one must be possible'
      ).toBeEnabled();
    }

    // NO SURCHARGE IS EVER INVENTED ON THIS SCREEN. There is no pre-filled
    // percentage and no pre-filled amount, in any of the three states — a
    // default here would become a price Steve never chose the first time
    // somebody pressed Save.
    await expect(
      page.getByTestId('rush-policy-percent'),
      'the percentage box must start empty: a pre-filled rate is a made-up business number'
    ).toHaveValue('');
    await expect(page.getByTestId('rush-policy-lead')).toHaveValue('');
  });
});
