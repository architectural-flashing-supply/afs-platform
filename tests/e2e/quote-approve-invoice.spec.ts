import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { dbConfigured, deleteJob, deleteTestNotifications, readJob, remainingTestNotifications } from './helpers/db';
import {
  addLaterPriceVersion,
  createTestPriceBookRow,
  createUnpricedPriceBookRow,
  deleteQuoteAndInvoiceFor,
  deleteTestPriceBook,
  expireApprovalToken,
  ledgerRealCountForTag,
  readApprovalToken,
  readInvoiceForJob,
  readLedgerForJob,
  readOutboundEmails,
  readQuoteForJob,
  realSendCount,
  remainingLedgerRows,
  remainingPriceBookFixtures,
  remainingQuoteArtifacts,
  restoreApprovalToken,
  type PriceBookFixture,
} from './helpers/pricing-db';

/**
 * QUOTE -> APPROVE LINK -> APPROVED -> INVOICE + LEDGER (prompt v2-03).
 * This is the path FORGE's gate runs.
 *
 * ================== NO REAL CUSTOMER EMAIL IS EVER SENT ==================
 *
 * Every job this spec creates is named with the reserved `E2E-TEST-` prefix
 * (lib/pricing/ledger.ts's LEDGER_TEST_TAG_PREFIX). `lib/email/outbound.ts`
 * reads that prefix and CAPTURES the message — it is written to
 * `outbound_emails` with status 'captured_test_mode' and NO PROVIDER CALL IS
 * MADE AT ALL. The spec then asserts, against the database, that the number of
 * messages about this job with any other status is ZERO.
 *
 * Test mode is decided PER MESSAGE by the job's own name, not by a
 * deployment-wide flag somebody could leave switched on. That is the whole
 * reason it is a prefix and not an env var.
 *
 * ================== NOTHING REACHES THE MACHINE ==================
 *
 * This spec never presses "Send to machine". The approve path
 * (app/api/quote-approve/[token]) imports nothing from the machine integration
 * and makes no outbound request to it — which is not a claim resting on a
 * reading of the file: lib/integrations/pathfinder-single-door.test.ts is a
 * STATIC test that fails if any file outside the two approved callers so much
 * as names the push function, and the approve route is not one of them. The
 * approve click LEAVES `quote_requests.status = 'submitted'` alone, which this
 * spec asserts, precisely so the single-door guard's own condition still holds
 * for a later, deliberate admin send.
 *
 * ================== CLEANUP ==================
 *
 * Every row is deleted and the counts are asserted back to zero: the job and
 * its audit rows, the quote, the token, the invoice, the captured emails, the
 * price book fixture, the tagged ledger rows, and the `notifications` rows the
 * submission route writes (which carry no link to the job at all).
 */

const authFile = 'tests/e2e/.auth/user.json';
const hasCreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
const canRun = hasCreds && dbConfigured();

/**
 * The reserved prefix is load-bearing, not decorative: it is what captures the
 * email, excludes the ledger rows from analytics, and permits the cleanup.
 */
const TEST_TAG = 'E2E-TEST-V2-03';

/** Prices chosen so every total below is checkable by hand. */
const SHEET_COST_CENTS = 24000; // $240.00 a 10 x 4 ft sheet
const PER_BEND_CENTS = 150; //     $1.50 a bend
const PER_HEM_CENTS = 275; //      $2.75 a hem
const RAISED_SHEET_COST_CENTS = 31000; // $310.00 after the supplier increase

/**
 * (0,0) -> (12,0) -> (12,4): a 16 in flat girth, ONE interior vertex, so one
 * bend. A hem on the far end makes one hem. Twelve pieces.
 *
 * BY HAND:
 *   strips per sheet = floor(48 / 16)      = 3
 *   material         = $240.00 x 12 / 3    = $960.00 =  96000c
 *   bends            = $1.50 x 1 x 12      =  $18.00 =   1800c
 *   hems             = $2.75 x 1 x 12      =  $33.00 =   3300c
 *   TOTAL                                  = $1,011.00 = 101100c
 */
const QUANTITY = 12;
const EXPECTED_TOTAL_CENTS = 101100;
/** The same shape at the raised sheet cost: $310 x 12 / 3 + 1800 + 3300. */
const EXPECTED_RAISED_TOTAL_CENTS = 31000 * 12 / 3 + 1800 + 3300; // 129100

const OFFICE_EMAIL = 'tricia@architecturalflashingsupply.com';

interface CreatedJob {
  requestId: string;
  requestNumber: string;
}

/**
 * Submits a real FlashDraft quote request through the real public API — the
 * same route app/studio/draft/page.tsx posts to. Nothing is inserted behind the
 * app's back.
 */
async function submitJob(
  request: APIRequestContext,
  label: string,
  fixture: PriceBookFixture
): Promise<CreatedJob> {
  const res = await request.post('/api/quote-requests', {
    data: {
      sourceTool: 'afs-flashdraft',
      notes: `${TEST_TAG} ${label}`,
      jobName: `${TEST_TAG} ${label}`,
      items: [
        {
          profileType: 'Drip Edge',
          material: fixture.material,
          gauge: fixture.gauge,
          quantity: QUANTITY,
          lengthFt: 10,
          points: [
            { x: 0, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 4 },
          ],
          hemEnd: { type: 'open', lengthIn: 0.5, gapIn: 0.125, kick: 'inward' },
        },
      ],
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as CreatedJob;
  expect(body.requestId).toBeTruthy();
  return body;
}

/** The Approve link out of the CAPTURED email — proving the email really carried it. */
function approveUrlFromEmail(html: string): string {
  const match = /href="([^"]*\/api\/quote-approve\/[^"]+)"/.exec(html);
  expect(match, 'the captured quote email contains an Approve link').not.toBeNull();
  return (match as RegExpExecArray)[1];
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Prints one line of EVIDENCE, when asked for it.
 *
 * Set AFS_PRINT_PROOF=1 to have this spec print the facts a governance report
 * quotes — the captured email recipients, the two price-book versions, the
 * totals either side of a price change. Off by default so a gate run stays
 * readable, and a `console.log` is never load-bearing: every one of these facts
 * is also an assertion above or below it.
 */
function proof(label: string, value: unknown): void {
  if (process.env.AFS_PRINT_PROOF === '1') {
    console.log(`PROOF | ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }
}

test.describe('Quote -> Approve -> Invoice, end to end', () => {
  test.skip(!canRun, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD and SUPABASE_ACCESS_TOKEN are all required');
  test.use({ storageState: authFile });

  const created: string[] = [];
  /** The floor for the notification sweep. Set before any submission. */
  const runStartedAt = new Date().toISOString();
  const testRecipient = process.env.E2E_TEST_EMAIL ?? '';

  let priced: PriceBookFixture;
  let unpriced: PriceBookFixture;

  test.beforeAll(async () => {
    if (!canRun) return;
    // Its own price book row, with its own reserved material and gauge, so a
    // real material's prices are never touched.
    priced = await createTestPriceBookRow(TEST_TAG, {
      sheetCostCents: SHEET_COST_CENTS,
      perBendCents: PER_BEND_CENTS,
      perHemCents: PER_HEM_CENTS,
    });
    unpriced = await createUnpricedPriceBookRow(TEST_TAG, 'BLANK');
  });

  test.afterAll(async () => {
    if (!canRun) return;
    for (const id of created) {
      await deleteQuoteAndInvoiceFor(id, TEST_TAG);
      await deleteJob(id);
    }
    await deleteTestPriceBook(TEST_TAG);
    await deleteTestNotifications(testRecipient, runStartedAt);
  });

  // -------------------------------------------------------------------------
  test('an empty price renders as a marked blank, and blocks the quote', async ({ page, request }) => {
    // --- The price book shows it as a blank, not as $0.00 -----------------
    await page.goto('/admin/settings/price-book');
    const row = page.locator(
      `[data-testid="price-book-row"][data-material="${unpriced.material}"][data-gauge="${unpriced.gauge}"]`
    );
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-complete', 'false');

    // Three required prices, three marked blanks. And the words are "Not set",
    // not a zero and not an empty cell.
    const blanks = row.locator('[data-testid="price-blank"]');
    await expect(blanks).toHaveCount(4); // the three required, plus extras
    await expect(blanks.first()).toContainText('Not set');
    await expect(row).not.toContainText('$0.00');

    // --- A job that needs it cannot be quoted -----------------------------
    const job = await submitJob(request, 'blank-price', unpriced);
    created.push(job.requestId);

    await page.goto(`/admin/command-center/job/${job.requestId}`);
    const blocked = page.locator('[data-testid="quote-blocked"]');
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText('cannot be quoted yet');
    await expect(blocked).toContainText('never treated as zero');
    await expect(page.locator('[data-testid="send-quote"]')).toBeDisabled();

    // --- And the server refuses too, not just the button ------------------
    const refused = await request.post('/api/admin/command-center/send-quote', {
      data: { quoteRequestId: job.requestId, sendTo: testRecipient },
    });
    expect(refused.status()).toBe(409);
    const refusedBody = (await refused.json()) as { error: string };
    expect(refusedBody.error).toContain(unpriced.material);
    proof('blank row renders', `${unpriced.material} ${unpriced.gauge} -> data-complete=false, cells read "Not set"`);
    proof('server refusal', refusedBody.error);

    // Nothing was written, and nothing was emailed.
    expect(await readQuoteForJob(job.requestId)).toBeNull();
    expect((await readJob(job.requestId)).job_stage).toBe('new');
    expect(await readOutboundEmails(job.requestId)).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  test('a quote is sent, the customer approves from the email, and the invoice is created and emailed to Tricia', async ({
    page,
    request,
  }) => {
    const job = await submitJob(request, 'journey', priced);
    created.push(job.requestId);

    // --- 1. The priced quote table, worked by hand ------------------------
    await page.goto(`/admin/command-center/job/${job.requestId}`);
    await expect(page.locator('[data-testid="quote-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="quote-total"]')).toHaveText(money(EXPECTED_TOTAL_CENTS));
    await expect(page.getByText('Priced from your price book')).toBeVisible();
    // The email preview names the Approve button and Tricia's address.
    await expect(page.getByText('Approve this quote')).toBeVisible();
    await expect(page.getByText(OFFICE_EMAIL)).toBeVisible();

    // --- 2. Send the quote -------------------------------------------------
    await page.locator('[data-testid="quote-send-to"]').fill(testRecipient);
    await page.locator('[data-testid="send-quote"]').click();
    await expect(page.locator('[data-testid="job-action-result"]')).toContainText('AFS-Q-');

    expect((await readJob(job.requestId)).job_stage).toBe('quoted');
    const quote = await readQuoteForJob(job.requestId);
    expect(quote, 'a quote row was written').not.toBeNull();
    expect(quote?.total_cents).toBe(EXPECTED_TOTAL_CENTS);
    expect(quote?.status).toBe('sent');
    expect(quote?.revision).toBe(1);
    // The SNAPSHOT: the cents the quote was built on live on the quote itself.
    expect(quote?.line_items?.[0].pricesUsed.sheetCostCents).toBe(SHEET_COST_CENTS);

    // --- 3. The email was CAPTURED, not sent -------------------------------
    const quoteEmails = await readOutboundEmails(job.requestId);
    expect(quoteEmails).toHaveLength(1);
    expect(quoteEmails[0].kind).toBe('quote');
    expect(quoteEmails[0].status).toBe('captured_test_mode');
    expect(quoteEmails[0].recipient).toBe(testRecipient);
    expect(await realSendCount(job.requestId)).toBe(0);

    proof('quote email', `${quoteEmails[0].kind} -> ${quoteEmails[0].recipient} [${quoteEmails[0].status}]`);
    const approveUrl = approveUrlFromEmail(quoteEmails[0].body_html ?? '');
    const approvePath = new URL(approveUrl).pathname;

    // --- 4. TAMPERED is refused -------------------------------------------
    const tamperedPath = approvePath.slice(0, -1) + (approvePath.endsWith('A') ? 'B' : 'A');
    const tampered = await request.get(tamperedPath);
    const tamperedHtml = await tampered.text();
    expect(tampered.status(), tamperedHtml).toBe(400);
    expect(tamperedHtml).toContain('altered');
    proof('TAMPERED link', `HTTP ${tampered.status()} - refused ("has been altered")`);
    expect((await readJob(job.requestId)).job_stage).toBe('quoted');

    // --- 5. EXPIRED is refused --------------------------------------------
    await expireApprovalToken(quote!.id);
    const expired = await request.get(approvePath);
    const expiredHtml = await expired.text();
    expect(expired.status(), expiredHtml).toBe(410);
    expect(expiredHtml).toContain('expired');
    proof('EXPIRED link', `HTTP ${expired.status()} - refused ("has expired")`);
    expect((await readJob(job.requestId)).job_stage).toBe('quoted');
    expect(await readInvoiceForJob(job.requestId)).toBeNull();
    // Put the clock back. `used_at` is untouched, so single use is unaffected.
    await restoreApprovalToken(quote!.id);
    const restored = await readApprovalToken(quote!.id);
    expect(restored?.used_at, 'the expired attempt did not spend the link').toBeNull();
    expect(
      new Date(restored!.expires_at).getTime(),
      `the link is live again (expires_at=${restored?.expires_at})`
    ).toBeGreaterThan(Date.now());

    // --- 6. VALID: the customer approves -----------------------------------
    const approved = await request.get(approvePath);
    const approvedHtml = await approved.text();
    // The page body rides on the assertion: a 410 here is one of four different
    // refusals, and the status code alone does not say which.
    expect(approved.status(), approvedHtml).toBe(200);
    expect(approvedHtml).toContain('your quote is approved');
    proof('VALID link', `HTTP ${approved.status()} - accepted ("your quote is approved")`);

    const afterApproval = await readJob(job.requestId);
    expect(afterApproval.job_stage).toBe('approved');
    expect(afterApproval.approval_channel).toBe('email');
    // THE SINGLE DOOR: status is deliberately left alone, so the guard's own
    // condition still holds for a later, deliberate admin send.
    expect(afterApproval.status).toBe('submitted');
    // And nothing was sent to the machine by this path.
    expect(afterApproval.pathfinder_profile_ids ?? []).toHaveLength(0);
    expect(afterApproval.send_status).toBeNull();

    const token = await readApprovalToken(quote!.id);
    expect(token?.used_at, 'the link was spent').not.toBeNull();

    // --- 7. The invoice, created from the quote with NO retyping -----------
    const invoice = await readInvoiceForJob(job.requestId);
    expect(invoice, 'an invoice row was created').not.toBeNull();
    expect(invoice?.total_cents).toBe(EXPECTED_TOTAL_CENTS);
    expect(invoice?.line_items?.[0].lineTotalCents).toBe(quote?.line_items?.[0].lineTotalCents);
    expect(invoice?.office_emailed_to).toBe(OFFICE_EMAIL);
    expect(invoice?.office_emailed_at).not.toBeNull();
    proof(
      'invoice from quote',
      `${invoice?.invoice_number} total ${money(invoice!.total_cents)} (quote total ${money(quote!.total_cents!)}), office copy -> ${invoice?.office_emailed_to}`
    );

    // --- 8. Tricia's copy was captured, and nothing was really sent --------
    const allEmails = await readOutboundEmails(job.requestId);
    const officeEmail = allEmails.find((e) => e.kind === 'invoice_office');
    expect(officeEmail, 'the office copy was written').toBeTruthy();
    expect(officeEmail?.recipient).toBe(OFFICE_EMAIL);
    expect(officeEmail?.status).toBe('captured_test_mode');
    expect(await realSendCount(job.requestId)).toBe(0);
    for (const e of allEmails) proof('captured email', `${e.kind} -> ${e.recipient} [${e.status}] "${e.subject}"`);
    proof('messages really sent to anybody', await realSendCount(job.requestId));

    // --- 9. The pricing history ---------------------------------------------
    const ledger = await readLedgerForJob(job.requestId);
    const kinds = ledger.map((l) => l.event_type);
    expect(kinds).toContain('quote_issued');
    expect(kinds).toContain('quote_outcome');
    expect(kinds).toContain('invoice_issued');

    const issued = ledger.find((l) => l.event_type === 'quote_issued');
    expect(issued?.amount_cents).toBe(EXPECTED_TOTAL_CENTS);
    expect(issued?.material).toBe(priced.material);
    expect(issued?.bend_count).toBe(1);
    expect(issued?.hem_count).toBe(1);
    expect(issued?.price_book_version_ids?.length).toBe(1);

    const outcome = ledger.find((l) => l.event_type === 'quote_outcome');
    expect(outcome?.outcome).toBe('approved');
    expect(outcome?.source).toBe('customer_link');
    expect(outcome?.time_to_decision_seconds).not.toBeNull();

    // A tagged row is invisible to the export and to analytics.
    expect(await ledgerRealCountForTag(TEST_TAG)).toBe(0);

    // --- 10. REUSED is refused, and nothing is billed twice ----------------
    const reused = await request.get(approvePath);
    expect(reused.status()).toBe(200);
    const reusedHtml = await reused.text();
    expect(reusedHtml).toContain('Already approved');
    proof('REUSED link', `HTTP ${reused.status()} - refused ("Already approved"), nothing billed twice`);

    const invoicesAfterReuse = await readInvoiceForJob(job.requestId);
    expect(invoicesAfterReuse?.invoice_number).toBe(invoice?.invoice_number);
    expect(await realSendCount(job.requestId)).toBe(0);

    // --- 11. The Approved checklist says all three things happened ---------
    await page.goto(`/admin/command-center/job/${job.requestId}`);
    const checklist = page.locator('[data-testid="approved-checklist"]');
    await expect(checklist).toBeVisible();
    await expect(checklist).toContainText('they clicked Approve in the email');
    await expect(checklist).toContainText(invoice!.invoice_number);
    await expect(checklist).toContainText(`Invoice emailed to ${OFFICE_EMAIL}`);
    expect(await checklist.locator('[data-checked="false"]').count()).toBe(0);
  });

  // -------------------------------------------------------------------------
  test('changing a price does NOT alter the already-issued quote, and the next quote uses the new price', async ({
    page,
    request,
  }) => {
    // The job quoted in the previous test is the "already-issued" one.
    const firstJobId = created[created.length - 1];
    const before = await readQuoteForJob(firstJobId);
    expect(before?.total_cents).toBe(EXPECTED_TOTAL_CENTS);

    // The supplier puts the sheet up. A new VERSION is added — nothing is
    // overwritten, which the database would refuse anyway.
    await addLaterPriceVersion(
      priced,
      TEST_TAG,
      {
        sheetCostCents: RAISED_SHEET_COST_CENTS,
        perBendCents: PER_BEND_CENTS,
        perHemCents: PER_HEM_CENTS,
      },
      '2000-01-01'
    );

    // The issued quote and its invoice are untouched.
    const after = await readQuoteForJob(firstJobId);
    expect(after?.total_cents).toBe(EXPECTED_TOTAL_CENTS);
    expect(after?.line_items?.[0].pricesUsed.sheetCostCents).toBe(SHEET_COST_CENTS);
    expect((await readInvoiceForJob(firstJobId))?.total_cents).toBe(EXPECTED_TOTAL_CENTS);

    // A NEW job of the identical shape is priced at the NEW price — the
    // companion assertion, without which "unchanged" could just mean the new
    // version was never picked up.
    const secondJob = await submitJob(request, 'after-the-rise', priced);
    created.push(secondJob.requestId);
    await page.goto(`/admin/command-center/job/${secondJob.requestId}`);
    await expect(page.locator('[data-testid="quote-total"]')).toHaveText(money(EXPECTED_RAISED_TOTAL_CENTS));
    proof(
      'price book version 1',
      `effective 1990-01-01, sheet ${money(SHEET_COST_CENTS)} -> issued quote ${after?.quote_number} total ${money(after!.total_cents!)} (UNCHANGED)`
    );
    proof(
      'price book version 2',
      `effective 2000-01-01, sheet ${money(RAISED_SHEET_COST_CENTS)} -> the NEXT quote prices at ${money(EXPECTED_RAISED_TOTAL_CENTS)}`
    );
    expect(EXPECTED_RAISED_TOTAL_CENTS).toBeGreaterThan(EXPECTED_TOTAL_CENTS);
  });

  // -------------------------------------------------------------------------
  test('every row this spec created is deleted, and the tables are clean', async () => {
    for (const id of created) {
      await deleteQuoteAndInvoiceFor(id, TEST_TAG);
      await deleteJob(id);
    }
    await deleteTestPriceBook(TEST_TAG);
    await deleteTestNotifications(testRecipient, runStartedAt);

    for (const id of created) {
      const left = await remainingQuoteArtifacts(id);
      expect(left).toEqual({ quotes: 0, invoices: 0, tokens: 0, emails: 0 });
    }
    // The append-only ledger lets a TAGGED row go, and only a tagged row.
    expect(await remainingLedgerRows(TEST_TAG)).toBe(0);
    expect(await remainingPriceBookFixtures(TEST_TAG)).toBe(0);
    expect(await remainingTestNotifications(testRecipient, runStartedAt)).toBe(0);

    created.length = 0;
  });
});
