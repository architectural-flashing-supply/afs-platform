import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  auditActionsFor,
  dbConfigured,
  deleteJob,
  deleteTestNotifications,
  forceStage,
  readJob,
  remainingOrphanAuditRows,
  remainingTagged,
  remainingTestNotifications,
} from './helpers/db';

/**
 * COMMAND CENTER V2 — THE WORKBENCH AND THE JOB SCREEN, end to end
 * (prompt v2-02). This is the path FORGE's gate runs.
 *
 * THE JOURNEY IT COVERS, in one test:
 *   a FlashDraft submission arrives as a New card
 *     -> the Job screen opens
 *       -> an approval runs that makes NO PathfinderEdge write of any kind
 *         -> the card lands in the Approved lane
 *
 * ================== HOW WE KNOW NOTHING REACHED THE MACHINE ==================
 *
 * 1. The approval step posts to /api/admin/command-center/approve-by-phone.
 *    That route does not import lib/integrations/pathfinder-edge.ts and makes no
 *    outbound request at all — there is no PathfinderEdge call on that path to
 *    stub. That is not a claim resting on a reading of the file:
 *    lib/integrations/pathfinder-single-door.test.ts is a STATIC test that fails
 *    if any file outside the two approved callers so much as names
 *    pushProfileToPathfinder, and approve-by-phone is not one of them.
 *
 * 2. "Send to machine" — the one button that really does push — is NEVER
 *    CLICKED by this spec.
 *
 * 3. The single approve-quote-request call this spec makes is against a job
 *    already at `shop`. That route answers the already-sent case and RETURNS
 *    BEFORE the push loop is reached, which the test proves by asserting the
 *    200-with-a-message that only the early return can produce. Reaching the
 *    push would have required a different status code and a different body.
 *
 * 4. The audit log is read afterwards and asserted to contain NO
 *    approve_quote_request_to_machine and NO
 *    approve_quote_request_pathfinder_failed row — the two rows that any real
 *    push attempt, successful or not, is required to write.
 *
 * CLEANUP: every row this file creates is deleted in afterAll and the counts are
 * asserted back to zero — the jobs and their audit rows by id, and the
 * `notifications` rows the submission route writes by recipient + run start,
 * since those carry no link to the job at all.
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const canRun = hasCreds && dbConfigured();

/** Every row this spec creates carries this prefix, so cleanup is exact. */
const TEST_TAG = 'V2-02-E2E-WORKBENCH';

interface CreatedJob {
  requestId: string;
  requestNumber: string;
}

/**
 * Submits a real FlashDraft quote request through the real public API — the same
 * route app/studio/draft/page.tsx posts to, with the same
 * `sourceTool: 'afs-flashdraft'` token. Nothing is inserted behind the app's
 * back, so "a FlashDraft submission arrives as a New card" is genuinely what is
 * being tested.
 */
async function submitFlashDraftRequest(request: APIRequestContext, label: string): Promise<CreatedJob> {
  const res = await request.post('/api/quote-requests', {
    data: {
      sourceTool: 'afs-flashdraft',
      notes: `${TEST_TAG} ${label}`,
      jobName: `${TEST_TAG} ${label}`,
      items: [
        {
          profileType: 'Drip Edge',
          material: 'Galvalume',
          gauge: '24 ga',
          quantity: 7,
          lengthFt: 10,
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
          ],
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as { requestId: string; requestNumber: string };
  expect(body.requestId).toBeTruthy();
  return body;
}

function laneCard(page: Page, lane: string, requestNumber: string) {
  return page
    .locator(`section[aria-labelledby="lane-${lane}"]`)
    .locator(`[data-request-number="${requestNumber}"]`);
}

test.describe('Command Center V2 — Workbench and Job screen', () => {
  test.skip(!canRun, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD and SUPABASE_ACCESS_TOKEN are all required');
  test.use({ storageState: authFile });

  const created: string[] = [];
  /**
   * The floor for the notification sweep below. Set before any submission, so
   * the sweep's range is exactly "rows this run caused" and can never widen
   * backwards over somebody else's.
   */
  const runStartedAt = new Date().toISOString();
  const testRecipient = process.env.E2E_TEST_EMAIL ?? '';

  test.afterAll(async () => {
    if (!canRun) return;
    for (const id of created) await deleteJob(id);
    // POST /api/quote-requests also emails the submitter and logs the attempt
    // in `notifications`. That row has no link to the quote request, so
    // deleteJob cannot reach it and 55 accumulated across this prompt's runs
    // before this sweep existed. Scoped to the E2E address AND this run's start.
    await deleteTestNotifications(testRecipient, runStartedAt);

    // Prove the tables are clean, not merely that the deletes ran.
    expect(await remainingTagged(TEST_TAG)).toBe(0);
    expect(await remainingTestNotifications(testRecipient, runStartedAt)).toBe(0);
    // And that no audit row outlived the job it describes. admin_audit_log has
    // no FK to quote_requests, so this is the only thing that catches an
    // orphan — 20 accumulated across this prompt's runs before deleteJob swept
    // them too.
    expect(await remainingOrphanAuditRows()).toBe(0);
  });

  test('the Workbench renders the five lanes and the summary line', async ({ page }) => {
    await page.goto('/admin/command-center');

    const laneNames = await page.locator('section[aria-labelledby^="lane-"] h2').allInnerTexts();
    expect(laneNames).toEqual(['New', 'Quoted', 'Approved', 'In the shop', 'Done']);

    // The sub-labels are what tell a non-technical reader what a lane means.
    for (const sub of [
      'Needs a quote',
      'Waiting on the customer',
      'Ready for the machine',
      'At the Thalmann',
      'Delivered',
    ]) {
      await expect(page.getByText(sub, { exact: true })).toBeVisible();
    }

    // v7 TITLES THIS SCREEN "Workbench" (`pageWorkbench()`, line 1283), not with
    // a greeting. The greeting is still computed — it rides along as the
    // heading's title attribute — but the visible h1 is the nav item's own
    // label, so the page says what you clicked.
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Workbench');
    await expect(h1).toHaveAttribute('title', /^Good (morning|afternoon|evening), .+\.$/);

    // v7's FOUR chips, in v7's order (`pageWorkbench()`, line 1283): approvals,
    // to-quote, email, deliveries today.
    //
    // THE "N jobs in the shop" CHIP IS GONE, and that is the design rather than
    // a loss. v7 does not have one; it has an EMAIL chip in that position. The
    // previous build's chip set was its own, and the whole-screen pixel gate is
    // what surfaced the difference. The email chip reads "Email not connected"
    // in live mode rather than a 0, because there is no Microsoft Graph behind
    // it and a zero would read as "no new mail" when the truth is "nothing is
    // being read".
    await expect(page.getByText(/^\d+ to quote$/)).toBeVisible();
    await expect(
      page.getByText(/^(\d+ ready for the machine|No approvals waiting)$/)
    ).toBeVisible();
    await expect(page.getByText(/^(\d+ new emails?|Email not connected)$/)).toBeVisible();
    await expect(
      page.getByText(/^(\d+ deliver(y|ies)|No deliveries) today$/)
    ).toBeVisible();
  });

  test('a FlashDraft submission arrives as a New card, opens, is approved with NO PathfinderEdge write, and lands in Approved', async ({
    page,
    request,
  }) => {
    // --- 1. It arrives as a New card --------------------------------------
    const job = await submitFlashDraftRequest(request, 'journey');
    created.push(job.requestId);
    expect((await readJob(job.requestId)).job_stage).toBe('new');

    await page.goto('/admin/command-center');
    const card = laneCard(page, 'new', job.requestNumber);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-stage', 'new');
    await expect(card).toContainText('From FlashDraft');
    // NEWEST ARRIVAL AT THE TOP: this is the most recent submission.
    const newLane = page.locator('section[aria-labelledby="lane-new"] [data-testid="workbench-card"]');
    await expect(newLane.first()).toHaveAttribute('data-request-number', job.requestNumber);

    // --- 2. The Job screen opens ------------------------------------------
    await card.getByRole('link', { name: 'Start quote' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/command-center/job/${job.requestId}`));

    // Three columns, by their headings.
    await expect(page.getByRole('heading', { name: 'The request', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The profile', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The quote', level: 2 })).toBeVisible();
    // Column 1 also carries the AI reading panel.
    await expect(page.getByRole('heading', { name: 'What the AI read', level: 3 })).toBeVisible();
    // The stage stepper marks New as the current step.
    await expect(page.locator('ol[aria-label="Job stage"] li[aria-current="step"]')).toHaveText('New');
    // Column 2 offers the past-profiles block, headed with the customer's name.
    await expect(page.getByRole('heading', { level: 3, name: /past profiles$/ })).toBeVisible();

    // --- 3. An approval that makes NO PathfinderEdge write ----------------
    await page.getByRole('button', { name: 'Customer approved by phone' }).click();
    await expect(page.getByTestId('job-action-result')).toContainText(/approved by phone/i);

    const after = await readJob(job.requestId);
    expect(after.job_stage).toBe('approved');
    expect(after.approval_channel).toBe('phone');
    // The single door needs status='submitted' when it verifies an approval, so
    // recording a phone approval must not disturb it.
    expect(after.status).toBe('submitted');
    // Nothing was sent, so there is no profile number and no send state.
    expect(after.pathfinder_profile_ids ?? []).toEqual([]);
    expect(after.send_status).toBeNull();

    // PROOF #4: the audit log holds the phone-approval row and NEITHER of the
    // two rows a real push attempt would have written.
    const actions = await auditActionsFor(job.requestId);
    expect(actions).toContain('record_customer_approval_by_phone');
    expect(actions).not.toContain('approve_quote_request_to_machine');
    expect(actions).not.toContain('approve_quote_request_to_machine_summary');
    expect(actions).not.toContain('approve_quote_request_pathfinder_failed');

    // --- 4. The card is in the Approved lane ------------------------------
    await page.goto('/admin/command-center');
    const approved = laneCard(page, 'approved', job.requestNumber);
    await expect(approved).toBeVisible();
    await expect(approved).toHaveAttribute('data-stage', 'approved');
    await expect(approved).toContainText('Customer approved');
    await expect(approved.getByRole('button', { name: 'Send to machine' })).toBeVisible();
    // The green pulse v7 specifies for this lane. v7 marks the CARD `.appr`
    // and puts the pulsing dot in its meta row as a `.beacon` span, rather
    // than animating the card itself (which was the pre-port `afs-beacon`
    // class). Both halves are asserted: the card is marked, and the dot that
    // actually pulses is really there.
    // toHaveClass(RegExp) matches the WHOLE class attribute, not a substring,
    // so this is anchored rather than written as a word-boundary search.
    await expect(approved).toHaveClass(/^card appr$/);
    await expect(approved.locator('.meta .beacon')).toBeVisible();

    // "Send to machine" is NOT CLICKED. It is the one door to catalog 20115 and
    // this spec never opens it.
  });

  test('an already-sent job answers in plain English, not a bare 409', async ({ page, request }) => {
    const job = await submitFlashDraftRequest(request, 'already-sent');
    created.push(job.requestId);

    // Put the job at `shop` WITHOUT a PathfinderEdge push — the only way to
    // reach the already-sent branch without sending real work to the machine,
    // and exactly the state a second click would find.
    await forceStage(job.requestId, 'shop');

    const res = await request.post('/api/admin/command-center/approve-quote-request', {
      data: { quoteRequestId: job.requestId },
    });
    const body = (await res.json()) as {
      ok?: boolean;
      alreadySent?: boolean;
      message?: string;
      error?: string;
    };

    // THE DEFECT THIS FIXES: this used to answer `409 Quote request is not
    // pending approval.` — a failure-shaped reply to "that already happened".
    expect(res.status()).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.alreadySent).toBe(true);
    expect(body.message).toBe('This job has already been sent to the machine. Nothing was sent again.');
    expect(body.error).toBeUndefined();
    // Plain English, so: no status code, no "409", no jargon in what the user reads.
    expect(body.message).not.toMatch(/409|error|invalid|not pending/i);

    // And the early return really did precede any push: no push audit row exists.
    const actions = await auditActionsFor(job.requestId);
    expect(actions).not.toContain('approve_quote_request_to_machine');
    expect(actions).not.toContain('approve_quote_request_pathfinder_failed');

    // The card is in the shop lane where it belongs.
    await page.goto('/admin/command-center');
    await expect(laneCard(page, 'shop', job.requestNumber)).toBeVisible();
  });

  test('rush cannot be set except by the customer checkbox or the admin toggle', async ({ request }) => {
    const job = await submitFlashDraftRequest(request, 'rush');
    created.push(job.requestId);

    // FlashDraft sends no rush flag, so it arrives standard — not inferred into
    // rush from its note or its dates.
    let state = await readJob(job.requestId);
    expect(state.is_rush).toBe(false);
    expect(state.rush_source).toBeNull();

    // The admin toggle, explicit, is allowed — and records WHERE it came from.
    const on = await request.post('/api/admin/command-center/set-rush', {
      data: { quoteRequestId: job.requestId, isRush: true },
    });
    expect(on.status(), await on.text()).toBe(200);
    state = await readJob(job.requestId);
    expect(state.is_rush).toBe(true);
    expect(state.rush_source).toBe('admin_toggle');

    // A request that does not say true or false is refused, not guessed at.
    for (const data of [
      { quoteRequestId: job.requestId },
      { quoteRequestId: job.requestId, isRush: 'yes' },
      { quoteRequestId: job.requestId, isRush: 1 },
    ]) {
      const vague = await request.post('/api/admin/command-center/set-rush', { data });
      expect(vague.status()).toBe(400);
    }

    // Turning it off clears the provenance with it.
    const off = await request.post('/api/admin/command-center/set-rush', {
      data: { quoteRequestId: job.requestId, isRush: false },
    });
    expect(off.status()).toBe(200);
    state = await readJob(job.requestId);
    expect(state.is_rush).toBe(false);
    expect(state.rush_source).toBeNull();
  });

  test('a field-app submission also arrives as a New card', async ({ page, request }) => {
    const res = await request.post('/api/field/quote-request', {
      data: { notes: `${TEST_TAG} field`, jobName: `${TEST_TAG} field` },
    });
    expect(res.status(), await res.text()).toBe(200);
    const job = (await res.json()) as CreatedJob;
    created.push(job.requestId);

    await page.goto('/admin/command-center');
    const card = laneCard(page, 'new', job.requestNumber);
    await expect(card).toBeVisible();
    await expect(card).toContainText('From the field app');
  });

  test('a stale quote gets a follow-up draft, and the draft survives a reload', async ({ page, request }) => {
    const job = await submitFlashDraftRequest(request, 'followup');
    created.push(job.requestId);

    // A quote sent 5 days ago: that is stale (the threshold is 3 days).
    await forceStage(job.requestId, 'quoted', { quotedDaysAgo: 5 });

    await page.goto('/admin/command-center');
    const card = laneCard(page, 'quoted', job.requestNumber);
    await expect(card).toContainText('no reply yet');
    await card.getByRole('link', { name: 'Follow up' }).click();

    await page.getByRole('button', { name: 'Write a follow-up' }).click();
    // Assert the server's own answer first: if the draft route failed, this shows
    // the real reason instead of a bare 'textarea not found'.
    await expect(page.getByTestId('job-action-result')).toContainText(/Draft saved/);
    const draft = page.getByTestId('followup-draft');
    await expect(draft).toBeVisible();
    const text = await draft.inputValue();
    expect(text).toContain('quote');
    expect(text).toContain(job.requestNumber);
    // It is a DRAFT: the screen says sending is not wired up, so nobody thinks
    // the customer has already been chased.
    await expect(page.getByTestId('followup-not-sent-notice')).toContainText(
      'Sending from Outlook is not connected yet'
    );

    // It is stored, so it survives a reload.
    expect((await readJob(job.requestId)).followup_draft).toBe(text);
    await page.reload();
    await expect(page.getByTestId('followup-draft')).toHaveValue(text);
  });
});
