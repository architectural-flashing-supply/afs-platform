import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  dbConfigured,
  deleteJob,
  deleteTestNotifications,
  readJob,
  remainingTestNotifications,
  sql,
} from './helpers/db';
import { readOutboundEmails, realSendCount } from './helpers/pricing-db';
import {
  createShopJobFixture,
  deleteShopFixtures,
  moveDelivery,
  nextBusinessDayInDatabase,
  readDeliveryForShopJob,
  readShopRow,
  remainingShopFixtures,
  setFixtureRush,
  type ShopJobFixture,
} from './helpers/shop-db';

/**
 * SHOP VIEW -> DELIVERIES, END TO END (prompt v2-04). This is the path FORGE's
 * gate runs, and it covers the whole journey in one test:
 *
 *   Start bending -> Mark finished -> the delivery appears in Deliveries ->
 *   Mark delivered -> the job is Done.
 *
 * ================== NOTHING REACHES THE MACHINE ==================
 *
 * This spec never presses "Send to machine" and makes no request of any kind to
 * the bend-machine integration. A Job reaches the shop lane by SQL (see
 * ./helpers/shop-db.ts's header for why that is the only safe way), because the
 * real route into that lane POSTs a profile into catalog 20115, which the
 * physical Thalmann polls. The guarantee is not this paragraph: it is
 * lib/integrations/pathfinder-single-door.test.ts, a static test that fails if
 * any file outside the two approved callers so much as names the push function.
 *
 * ================== NO REAL CUSTOMER IS EVER CONTACTED ==================
 *
 * Every fixture's `job_name` carries the reserved `E2E-TEST-` prefix
 * (lib/pricing/ledger.ts's LEDGER_TEST_TAG_PREFIX), so lib/email/outbound.ts
 * CAPTURES the delivery notification — written to `outbound_emails` with status
 * 'captured_test_mode', with NO PROVIDER CALL MADE AT ALL — and
 * lib/delivery/notify.ts never reaches Twilio for a tagged job either. The spec
 * asserts, against the database, that the count of messages about these jobs
 * with any other status is ZERO.
 *
 * ================== CLEANUP ==================
 *
 * Every row is deleted and every count asserted back to zero: the Jobs, their
 * shop rows, their deliveries, their completion events, their captured emails,
 * their audit rows and the `notifications` rows the submission route writes.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const canRun = hasCreds && dbConfigured();

/** Load-bearing, not decorative: it captures the email and permits the cleanup. */
const TEST_TAG = 'E2E-TEST-V2-04';

/**
 * Queue positions far past the real queue, so a fixture never reorders real
 * shop work — and so rush pinning is unambiguous. RUSH sits BELOW NORMAL in
 * queue order on purpose: if it still renders above it, the pin is real.
 */
const POS_NORMAL = 9001;
const POS_RUSH = 9002;
const POS_JOURNEY = 9003;
const POS_MANUAL = 9004;

interface CreatedJob {
  requestId: string;
  requestNumber: string;
}

/**
 * Submits a real FlashDraft quote request through the real public API — the
 * same route app/studio/draft/page.tsx posts to. Nothing about the Job's
 * creation is faked.
 */
async function submitJob(request: APIRequestContext, label: string): Promise<CreatedJob> {
  const res = await request.post('/api/quote-requests', {
    data: {
      sourceTool: 'afs-flashdraft',
      notes: `${TEST_TAG} ${label}`,
      jobName: `${TEST_TAG} ${label}`,
      items: [
        {
          profileType: 'Drip Edge',
          material: `${TEST_TAG}-MATERIAL`,
          gauge: `${TEST_TAG}-GAUGE`,
          quantity: 7,
          lengthFt: 10,
          points: [
            { x: 0, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 4 },
          ],
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as CreatedJob;
  expect(body.requestId).toBeTruthy();
  return body;
}

/** Today's date IN THE SHOP'S TIME ZONE, computed by Postgres. */
async function shopToday(): Promise<string> {
  const rows = await sql<{ d: string }>(
    `select (now() at time zone 'America/Chicago')::date::text as d;`
  );
  return rows[0].d;
}

/** The day of week of a date, computed by Postgres. 0 = Sunday, 6 = Saturday. */
async function dowInDatabase(day: string): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`not a date: ${day}`);
  const rows = await sql<{ dow: number }>(
    `select extract(dow from '${day}'::date)::int as dow;`
  );
  return rows[0].dow;
}

/**
 * Prints one line of EVIDENCE, when asked for it.
 *
 * `AFS_PRINT_PROOF=1` makes this spec print the facts a governance report
 * quotes. Off by default so a gate run stays readable, and a `console.log` is
 * never load-bearing: every fact printed is also asserted beside it.
 */
function proof(label: string, value: unknown): void {
  if (process.env.AFS_PRINT_PROOF === '1') {
    console.log(`PROOF | ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
}

test.describe('Shop View -> Deliveries, end to end', () => {
  test.skip(!canRun, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD and SUPABASE_ACCESS_TOKEN are all required');
  test.use({ storageState: authFile });

  const createdJobs: string[] = [];
  const runStartedAt = new Date().toISOString();
  const testRecipient = process.env.E2E_TEST_EMAIL ?? '';

  test.afterAll(async () => {
    if (!canRun) return;
    await deleteShopFixtures(TEST_TAG);
    for (const id of createdJobs) {
      await sql(`delete from outbound_emails where quote_request_id = '${id}';`);
      await deleteJob(id);
    }
    await deleteTestNotifications(testRecipient, runStartedAt);

    const left = await remainingShopFixtures(TEST_TAG);
    proof('rows left behind', left);
    expect(left.shopRows).toBe(0);
    expect(left.deliveries).toBe(0);
    expect(left.completionEvents).toBe(0);
    expect(left.orphanAuditRows).toBe(0);
    expect(await remainingTestNotifications(testRecipient, runStartedAt)).toBe(0);
  });

  // =========================================================================
  test('rush pins to the top of the SHOP queue, and nowhere else', async ({ page, request }) => {
    // RUSH IS SUBMITTED FIRST, ON PURPOSE. The Workbench is newest arrival
    // first, so the NORMAL job is above the rush one there — while the shop
    // queue puts the rush one on top. If both screens agreed, this test could
    // pass with rush doing nothing; ordering them against each other is what
    // makes the two halves of rule #15 distinguishable.
    const rushJob = await submitJob(request, 'pin-rush');
    const normalJob = await submitJob(request, 'pin-normal');
    createdJobs.push(normalJob.requestId, rushJob.requestId);

    const normal = await createShopJobFixture(TEST_TAG, normalJob.requestId, {
      label: 'PIN-NORMAL',
      queuePosition: POS_NORMAL,
      customerEmail: testRecipient,
      company: 'E2E Normal Co',
    });
    const rush = await createShopJobFixture(TEST_TAG, rushJob.requestId, {
      label: 'PIN-RUSH',
      queuePosition: POS_RUSH,
      customerEmail: testRecipient,
      company: 'E2E Rush Co',
    });
    // Rush the way an admin toggle does it: with an explicit source, which is
    // the only thing the database's own CHECK will accept (rule #15).
    await setFixtureRush(rushJob.requestId);

    // --- SHOP VIEW: rush is above normal, even from a later queue slot -----
    await page.goto('/admin/shop-view');
    const cards = page.locator('[data-testid="shop-card"]');
    await expect(cards.first()).toBeVisible();

    const ids = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-shop-job-id') ?? '')
    );
    const rushIndex = ids.indexOf(rush.shopJobId);
    const normalIndex = ids.indexOf(normal.shopJobId);
    expect(rushIndex, 'the rush fixture is on the shop queue').toBeGreaterThanOrEqual(0);
    expect(normalIndex, 'the normal fixture is on the shop queue').toBeGreaterThanOrEqual(0);
    proof('shop queue index — rush / normal', { rushIndex, normalIndex, rushQueuePosition: POS_RUSH, normalQueuePosition: POS_NORMAL });
    expect(rushIndex).toBeLessThan(normalIndex);

    // Pinned to the TOP, not merely above its own pair: it outranks every
    // real (non-rush) row in the queue too.
    expect(rushIndex).toBe(0);
    const rushCard = page.locator(`[data-shop-job-id="${rush.shopJobId}"]`);
    await expect(rushCard).toHaveAttribute('data-rush', 'true');
    await expect(rushCard).toContainText('Rush');
    await expect(rushCard).toContainText('Queued');

    // --- THE WORKBENCH: rush changes nothing but the badge ----------------
    await page.goto('/admin/command-center');
    const shopCards = page.locator('[data-testid="workbench-card"][data-stage="shop"]');
    await expect(shopCards.first()).toBeVisible();
    const wbNumbers = await shopCards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-request-number') ?? '')
    );
    const wbRush = wbNumbers.indexOf(rushJob.requestNumber);
    const wbNormal = wbNumbers.indexOf(normalJob.requestNumber);
    expect(wbRush).toBeGreaterThanOrEqual(0);
    expect(wbNormal).toBeGreaterThanOrEqual(0);
    // Newest arrival first and nothing else. `pin-normal` was submitted LAST,
    // so it is above the rush job here — the exact OPPOSITE of the shop queue
    // three assertions ago, with the same two rows.
    proof('workbench shop lane index — rush / normal', { wbRush, wbNormal, laneSize: wbNumbers.length });
    expect(wbNormal).toBeLessThan(wbRush);
  });

  // =========================================================================
  test('Start bending -> Mark finished -> Deliveries -> Mark delivered -> Done', async ({
    page,
    request,
  }, testInfo) => {
    // 90s, not the config's 30s. This is the suite's longest end-to-end: it
    // submits a job, starts it, finishes it — which writes the shop row,
    // auto-schedules the delivery on the next business day and notifies the
    // customer — then reschedules and delivers it, and reads the database back
    // between every step. Three of those are real round trips measured at
    // around three seconds each, and the total had grown past 30s. Raising the
    // TEST's budget is not relaxing any assertion in it; every expectation
    // below is unchanged.
    testInfo.setTimeout(90_000);
    const job = await submitJob(request, 'journey');
    createdJobs.push(job.requestId);
    const fixture = await createShopJobFixture(TEST_TAG, job.requestId, {
      label: 'JOURNEY',
      queuePosition: POS_JOURNEY,
      customerEmail: testRecipient,
      company: 'E2E Journey Roofing',
      quantity: 7,
      machineProfileId: '32999001',
    });

    // ---------------- 1. START BENDING ----------------
    await page.goto('/admin/shop-view');
    const card = page.locator(`[data-shop-job-id="${fixture.shopJobId}"]`);
    await expect(card).toBeVisible();
    // v7's wording for the machine profile number on a queue row is
    // "· profile #N" (pageShop, prototype line 1480), not "Machine profile #N".
    // v7 wins on copy, so this asserts what the shop actually reads.
    await expect(card).toContainText('profile #32999001');
    await expect(card).toHaveAttribute('data-state', 'queued');

    // WAIT FOR HYDRATION BEFORE PRESSING. The row is server-rendered, so the
    // card and its button are visible before React has attached the handler —
    // a click that lands in that window is simply swallowed, and this test was
    // intermittently doing exactly that. `data-hydrated` is set by the board
    // on mount; see V7ShopBoard for why it is a real state and not a test hook.
    await expect(page.locator('.shopg')).toHaveAttribute('data-hydrated', 'true');
    await card.locator('[data-testid="start-bending"]').click();
    // 15s, not the 5s default. Advancing a job is a real round trip — it writes
    // the shop row, auto-schedules the delivery and notifies the customer — and
    // it measures around three seconds locally. The strip itself now appears
    // IMMEDIATELY reading "Starting…"; this waits for the result to replace it.
    await expect(page.locator('[data-testid="shop-result"]')).toContainText('Started bending', {
      timeout: 15_000,
    });

    let shopRow = await readShopRow(fixture.shopJobId);
    proof('after Start bending', shopRow);
    expect(shopRow.status).toBe('in_progress');
    expect(shopRow.started_at, 'started_at records WHEN bending began').not.toBeNull();
    await expect(page.locator(`[data-shop-job-id="${fixture.shopJobId}"]`)).toContainText('Bending now');

    // ---------------- 2. MARK FINISHED ----------------
    // Which auto-schedules the delivery for the next BUSINESS day and tells
    // the customer through the existing services.
    const finishedOn = await shopToday();
    const expectedDay = await nextBusinessDayInDatabase(finishedOn);

    await page
      .locator(`[data-shop-job-id="${fixture.shopJobId}"]`)
      .locator('[data-testid="mark-finished"]')
      .click();
    const finishResult = page.locator('[data-testid="shop-result"]');
    await expect(finishResult).toContainText('Marked finished');
    await expect(finishResult).toContainText('Delivery set for');

    shopRow = await readShopRow(fixture.shopJobId);
    expect(shopRow.status).toBe('complete');
    expect(shopRow.completed_at).not.toBeNull();

    const delivery = await readDeliveryForShopJob(fixture.shopJobId);
    proof('auto-scheduled delivery', { finishedOn, expectedDay, delivery });
    expect(delivery, 'Mark finished created a delivery').not.toBeNull();
    const d = delivery as NonNullable<typeof delivery>;
    expect(d.status).toBe('scheduled');
    expect(d.auto_scheduled, 'the shop booked this, nobody chose it').toBe(true);
    expect(d.time_window).toBe('08-10');
    // ledgerTestTag() takes the first whitespace-delimited word of the job
    // name, so the tag on the row is the fixture's full hyphenated name. What
    // matters is that it CARRIES the reserved prefix — that is what makes the
    // row deletable and the email captured.
    expect(d.test_tag ?? '').toContain(TEST_TAG);

    // THE NEXT BUSINESS DAY — the expected value came from Postgres, so this
    // is two independent implementations agreeing, not the code checking
    // itself. And whatever day it is, it is never a weekend.
    expect(d.scheduled_date).toBe(expectedDay);
    const dow = await dowInDatabase(d.scheduled_date);
    proof('scheduled day of week (0=Sun, 6=Sat)', dow);
    expect(dow).toBeGreaterThanOrEqual(1);
    expect(dow).toBeLessThanOrEqual(5);

    // THE FRIDAY CASE, which is the one a naive `+1 day` gets wrong every
    // week. It cannot be produced by finishing a job today (the server clock
    // is what it is), so it is asserted against the same Postgres arithmetic
    // the line above trusted: Friday 2 Oct -> MONDAY 5 Oct, not Saturday.
    // lib/delivery/business-days.test.ts asserts the app's own function
    // returns that same date, including for a Friday EVENING in Texas that is
    // already Saturday in UTC.
    const friday = '2026-10-02';
    expect(await dowInDatabase(friday), 'the fixture date really is a Friday').toBe(5);
    const afterFriday = await nextBusinessDayInDatabase(friday);
    proof('Friday finish -> next business day', { friday, afterFriday, dow: await dowInDatabase(afterFriday) });
    expect(afterFriday).toBe('2026-10-05');
    expect(await dowInDatabase(afterFriday), 'and it is a Monday').toBe(1);

    // --- THE CUSTOMER WAS NOTIFIED, THROUGH THE EXISTING SERVICE ----------
    expect(d.notified_at, 'a notification attempt is recorded').not.toBeNull();
    expect(d.notify_note ?? '').toContain('recorded and NOT sent');

    const emails = await readOutboundEmails(job.requestId);
    const deliveryEmails = emails.filter((e) => e.kind === 'delivery_scheduled');
    proof(
      'captured delivery email',
      deliveryEmails.map((e) => `${e.kind} -> ${e.recipient} [${e.status}] ${e.subject}`)
    );
    expect(deliveryEmails.length, 'one delivery email was produced').toBe(1);
    expect(deliveryEmails[0].recipient).toBe(testRecipient);
    expect(deliveryEmails[0].status).toBe('captured_test_mode');
    expect(deliveryEmails[0].subject).toContain('Your AFS delivery is scheduled for');
    // It really went through lib/resend/templates/base.ts's shell, not some
    // second template invented here.
    expect(deliveryEmails[0].body_html ?? '').toContain('Your Delivery Is Scheduled');
    expect(await realSendCount(job.requestId), 'nothing was sent to anybody').toBe(0);

    // ---------------- 3. IT APPEARS IN DELIVERIES ----------------
    await page.goto('/admin/deliveries');
    const dayColumn = page.locator(`[data-testid="delivery-day"][data-date="${d.scheduled_date}"]`);
    await expect(dayColumn).toBeVisible();
    const stop = dayColumn.locator(`[data-delivery-id="${d.id}"]`);
    await expect(stop).toBeVisible();
    await expect(stop).toContainText('E2E Journey Roofing');
    await expect(stop).toContainText(`${fixture.profileName} × 7`);
    await expect(stop).toContainText('8–10 AM');
    await expect(stop).toContainText('set by the shop');

    // ---------------- 4. MARK DELIVERED -> THE JOB IS DONE ----------------
    await stop.locator('[data-testid="mark-delivered"]').click();
    const deliveredResult = page.locator('[data-testid="deliveries-result"]');
    await expect(deliveredResult).toContainText('Marked delivered');
    await expect(deliveredResult).toContainText('moved to Done');

    const afterDelivery = await readDeliveryForShopJob(fixture.shopJobId);
    proof('after Mark delivered', afterDelivery);
    expect(afterDelivery?.status).toBe('delivered');
    expect(afterDelivery?.delivered_at).not.toBeNull();

    const jobRow = await readJob(job.requestId);
    proof('job stage after delivery', { job_stage: jobRow.job_stage, status: jobRow.status });
    expect(jobRow.job_stage, 'the Job is Done').toBe('done');

    // The Workbench agrees, which is the thing Steve actually looks at.
    await page.goto('/admin/command-center');
    const doneCard = page.locator(
      `[data-testid="workbench-card"][data-request-number="${job.requestNumber}"]`
    );
    await expect(doneCard).toHaveAttribute('data-stage', 'done');

    // ---------------- 5. A SECOND CLICK IS INFORMATION, NOT A FAILURE ------
    const again = await request.post('/api/admin/deliveries/mark-delivered', {
      data: { deliveryId: d.id },
    });
    expect(again.status()).toBe(200);
    const againBody = (await again.json()) as { alreadyDelivered?: boolean; message?: string };
    proof('second Mark delivered', againBody);
    expect(againBody.alreadyDelivered).toBe(true);
    expect(againBody.message ?? '').toContain('already marked delivered');
  });

  // =========================================================================
  test('a delivery can be scheduled and changed by hand, and a weekend is refused', async ({
    page,
    request,
  }) => {
    const job = await submitJob(request, 'manual');
    createdJobs.push(job.requestId);
    const fixture = await createShopJobFixture(TEST_TAG, job.requestId, {
      label: 'MANUAL',
      queuePosition: POS_MANUAL,
      customerEmail: testRecipient,
      company: 'E2E Manual Builders',
      quantity: 3,
    });

    // --- A job still bending cannot be promised a day ---------------------
    const tooEarly = await request.post('/api/admin/deliveries/schedule', {
      data: { shopJobId: fixture.shopJobId, scheduledDate: await nextWeekday(1), timeWindow: '13-15' },
    });
    expect(tooEarly.status()).toBe(409);
    expect((await tooEarly.json()).error as string).toContain('has not come off the machine yet');

    // Finished, with no delivery — the real "Not scheduled yet" case, which
    // happens when auto-scheduling could not book one.
    await sql(
      `update shop_profile_library set status = 'complete', completed_at = now()
        where id = '${fixture.shopJobId}';`
    );

    // --- A weekend is refused, not quietly corrected ----------------------
    const saturday = await nextDayOfWeek(6);
    const weekend = await request.post('/api/admin/deliveries/schedule', {
      data: { shopJobId: fixture.shopJobId, scheduledDate: saturday, timeWindow: '08-10' },
    });
    proof('weekend refusal', { saturday, status: weekend.status() });
    expect(weekend.status()).toBe(400);
    expect((await weekend.json()).error as string).toContain('Monday to Friday');
    expect(await readDeliveryForShopJob(fixture.shopJobId)).toBeNull();

    // --- Schedule it by hand from the Not scheduled yet panel -------------
    await page.goto('/admin/deliveries');
    const waiting = page.locator(`[data-testid="unscheduled-job"][data-shop-job-id="${fixture.shopJobId}"]`);
    await expect(waiting).toBeVisible();
    await expect(waiting).toContainText('E2E Manual Builders');

    await waiting.locator('[data-testid="schedule-delivery"]').click();
    const modal = page.locator('[data-testid="schedule-modal"]');
    await expect(modal).toBeVisible();

    // The picker only offers weekdays, so a Saturday is not selectable at all.
    const dayValues = await modal
      .locator('[data-testid="delivery-day-select"] option')
      .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
    expect(dayValues.length).toBe(10);
    for (const value of dayValues) expect(await dowInDatabase(value)).toBeGreaterThanOrEqual(1);

    const chosenDay = dayValues[1];
    await modal.locator('[data-testid="delivery-day-select"]').selectOption(chosenDay);
    await modal.locator('[data-testid="delivery-window-select"]').selectOption('13-15');
    await modal.locator('[data-testid="confirm-schedule"]').click();

    await expect(page.locator('[data-testid="deliveries-result"]')).toContainText('Delivery set for');
    let booked = await readDeliveryForShopJob(fixture.shopJobId);
    proof('scheduled by hand', booked);
    expect(booked?.scheduled_date).toBe(chosenDay);
    expect(booked?.time_window).toBe('13-15');
    expect(booked?.auto_scheduled, 'a person chose this day').toBe(false);

    // --- Change the day ---------------------------------------------------
    const stop = page.locator(`[data-delivery-id="${booked?.id}"]`);
    await expect(stop).toBeVisible();
    await stop.locator('[data-testid="change-day"]').click();
    const changeModal = page.locator('[data-testid="schedule-modal"]');
    await expect(changeModal).toContainText('Change the delivery day');
    const movedDay = dayValues[3];
    await changeModal.locator('[data-testid="delivery-day-select"]').selectOption(movedDay);
    await changeModal.locator('[data-testid="confirm-schedule"]').click();
    await expect(page.locator('[data-testid="deliveries-result"]')).toContainText('Delivery moved to');

    booked = await readDeliveryForShopJob(fixture.shopJobId);
    proof('after Change day', booked);
    expect(booked?.scheduled_date).toBe(movedDay);
    // One row, not two — deliveries.shop_job_id is UNIQUE.
    const count = await sql<{ n: number }>(
      `select count(*)::int as n from deliveries where shop_job_id = '${fixture.shopJobId}';`
    );
    expect(count[0].n).toBe(1);

    // --- Rush does NOT reorder the Deliveries screen ----------------------
    // Push this one outside the visible week and confirm the screen says so
    // rather than silently dropping it.
    const farAway = await nextBusinessDayInDatabase(dayValues[dayValues.length - 1]);
    await moveDelivery(booked!.id, farAway);
    await page.goto('/admin/deliveries');
    const beyond = page.locator('[data-testid="beyond-week"]');
    await expect(beyond).toBeVisible();
    await expect(beyond).toContainText('beyond this week');
    proof('beyond-week notice', await beyond.innerText());
  });
});

/** A weekday `n` business days out, computed by Postgres. */
async function nextWeekday(n: number): Promise<string> {
  const rows = await sql<{ d: string }>(
    `with s as (select generate_series((now() at time zone 'America/Chicago')::date + 1,
                                       (now() at time zone 'America/Chicago')::date + 20,
                                       interval '1 day')::date as d)
     select d::text as d from s where extract(dow from d) between 1 and 5
      order by d offset ${Math.max(0, Math.round(n)) - 1} limit 1;`
  );
  return rows[0].d;
}

/** The next date falling on a given day of week, computed by Postgres. */
async function nextDayOfWeek(dow: number): Promise<string> {
  const rows = await sql<{ d: string }>(
    `with s as (select generate_series((now() at time zone 'America/Chicago')::date + 1,
                                       (now() at time zone 'America/Chicago')::date + 14,
                                       interval '1 day')::date as d)
     select d::text as d from s where extract(dow from d) = ${Math.round(dow)} order by d limit 1;`
  );
  return rows[0].d;
}
