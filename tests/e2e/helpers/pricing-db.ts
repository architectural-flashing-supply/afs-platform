import { sql } from './db';

/**
 * v2-03 — SQL HELPERS FOR THE PRICE BOOK, THE QUOTE, THE INVOICE AND THE
 * PRICING HISTORY. Companion to ./db.ts, which holds the job-level ones and
 * the Supabase Management API transport these reuse.
 *
 * ================== ONE PREFIX, THREE JOBS ==================
 *
 * Everything here is scoped by the reserved `E2E-TEST-` prefix
 * (lib/pricing/ledger.ts's LEDGER_TEST_TAG_PREFIX). That single prefix does
 * three things at once, by design:
 *
 *   1. A job whose name starts with it has its outbound email CAPTURED, never
 *      sent — so this spec can prove exactly what would have gone to the
 *      customer and to the office without one real message leaving the
 *      building.
 *   2. Its pricing-ledger rows carry the tag, which excludes them from the
 *      `pricing_ledger_real` view and from the CSV export, so a test run can
 *      never reach the dataset dynamic pricing will learn from.
 *   3. A tagged row is the ONLY kind the append-only trigger will let anything
 *      delete, which is what makes "every row this spec created is gone" true
 *      without weakening the ledger for real history.
 *
 * THIS FILE MAKES NO OUTBOUND REQUEST EXCEPT THE SUPABASE SQL POST INSIDE
 * ./db.ts's `sql()`. It touches no machine integration of any kind.
 */

/** A uuid, checked before it is ever interpolated into SQL. */
function uuid(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`not a uuid: ${id}`);
  return id;
}

/** A safe SQL string literal — every free-text value below goes through this. */
function lit(value: string): string {
  if (!/^[A-Za-z0-9 ._:@#/-]{1,200}$/.test(value)) throw new Error(`unsafe literal: ${value}`);
  return `'${value}'`;
}

export interface PriceBookFixture {
  itemId: string;
  material: string;
  gauge: string;
}

/**
 * Creates a price book row THIS SPEC OWNS, with real prices, so a quote can
 * actually be issued from it. It never touches a real material: both the
 * material and the gauge carry the reserved prefix, so a tagged version can
 * never be a version of something the shop really sells.
 */
export async function createTestPriceBookRow(
  tag: string,
  prices: { sheetCostCents: number; perBendCents: number; perHemCents: number },
  effectiveFrom = '1990-01-01'
): Promise<PriceBookFixture> {
  const material = `${tag}-MATERIAL`;
  const gauge = `${tag}-GAUGE`;
  const rows = await sql<{ id: string }>(
    `insert into price_book_items (material, gauge, display_order, test_tag)
     values (${lit(material)}, ${lit(gauge)}, 9000, ${lit(tag)})
     on conflict (material, gauge) do update set test_tag = excluded.test_tag
     returning id;`
  );
  const itemId = rows[0].id;
  await sql(
    `insert into price_book_versions
       (item_id, sheet_cost_cents, per_bend_cents, per_hem_cents, effective_from, note, test_tag)
     values ('${uuid(itemId)}', ${Math.round(prices.sheetCostCents)}, ${Math.round(prices.perBendCents)},
             ${Math.round(prices.perHemCents)}, date ${lit(effectiveFrom)}, 'E2E fixture', ${lit(tag)})
     on conflict (item_id, effective_from) do nothing;`
  );
  return { itemId, material, gauge };
}

/**
 * Adds a LATER, higher version of the same row.
 *
 * This is the live half of the proof that a price change does not alter an
 * already-issued quote: the quote sent before this ran keeps its own figures,
 * and the spec asserts both numbers afterwards.
 */
export async function addLaterPriceVersion(
  fixture: PriceBookFixture,
  tag: string,
  prices: { sheetCostCents: number; perBendCents: number; perHemCents: number },
  effectiveFrom: string
): Promise<void> {
  await sql(
    `insert into price_book_versions
       (item_id, sheet_cost_cents, per_bend_cents, per_hem_cents, effective_from, note, test_tag)
     values ('${uuid(fixture.itemId)}', ${Math.round(prices.sheetCostCents)}, ${Math.round(prices.perBendCents)},
             ${Math.round(prices.perHemCents)}, date ${lit(effectiveFrom)}, 'E2E fixture later price', ${lit(tag)})
     on conflict (item_id, effective_from) do nothing;`
  );
}

/**
 * Creates a price book row WITH NO PRICES AT ALL — the "prices start empty"
 * case. The editor must render it as a marked blank, and a job that needs it
 * must be refused a quote rather than quietly priced at zero.
 */
export async function createUnpricedPriceBookRow(tag: string, suffix: string): Promise<PriceBookFixture> {
  const material = `${tag}-${suffix}-MATERIAL`;
  const gauge = `${tag}-${suffix}-GAUGE`;
  const rows = await sql<{ id: string }>(
    `insert into price_book_items (material, gauge, display_order, test_tag)
     values (${lit(material)}, ${lit(gauge)}, 9001, ${lit(tag)})
     on conflict (material, gauge) do update set test_tag = excluded.test_tag
     returning id;`
  );
  return { itemId: rows[0].id, material, gauge };
}

/**
 * Puts a token's expiry back where it was after the EXPIRED case has been
 * exercised, so the same link can then be used for the VALID case. It never
 * touches `used_at`, so "single use" is not affected by this at all.
 */
export async function restoreApprovalToken(quoteId: string): Promise<void> {
  await sql(
    `update quote_approval_tokens set expires_at = now() + interval '30 days'
     where quote_id = '${uuid(quoteId)}';`
  );
}

/** Deletes this spec's price book fixture. Versions first — the FK is RESTRICT. */
export async function deleteTestPriceBook(tag: string): Promise<void> {
  await sql(`delete from price_book_versions where test_tag = ${lit(tag)};`);
  await sql(`delete from price_book_items where test_tag = ${lit(tag)};`);
}

/** Price book fixture rows still present. Must be 0 after cleanup. */
export async function remainingPriceBookFixtures(tag: string): Promise<number> {
  const rows = await sql<{ n: number }>(
    `select (select count(*)::int from price_book_items where test_tag = ${lit(tag)})
          + (select count(*)::int from price_book_versions where test_tag = ${lit(tag)}) as n;`
  );
  return rows[0].n;
}

export interface IssuedQuoteRow {
  id: string;
  quote_number: string;
  status: string;
  revision: number;
  total_cents: number | null;
  line_items: { lineTotalCents: number; pricesUsed: { sheetCostCents: number } }[] | null;
}

export async function readQuoteForJob(jobId: string): Promise<IssuedQuoteRow | null> {
  const rows = await sql<IssuedQuoteRow>(
    `select id, quote_number, status, revision, total_cents, line_items
     from quotes where request_id = '${uuid(jobId)}' order by revision desc limit 1;`
  );
  return rows[0] ?? null;
}

export interface InvoiceRowForTest {
  id: string;
  invoice_number: string;
  total_cents: number;
  office_emailed_to: string | null;
  office_emailed_at: string | null;
  line_items: { lineTotalCents: number }[] | null;
}

export async function readInvoiceForJob(jobId: string): Promise<InvoiceRowForTest | null> {
  const rows = await sql<InvoiceRowForTest>(
    `select id, invoice_number, total_cents, office_emailed_to, office_emailed_at, line_items
     from invoices where quote_request_id = '${uuid(jobId)}' order by issued_at desc limit 1;`
  );
  return rows[0] ?? null;
}

/** The single-use Approve link for a quote, as the database holds it. */
export async function readApprovalToken(
  quoteId: string
): Promise<{ id: string; used_at: string | null; expires_at: string } | null> {
  const rows = await sql<{ id: string; used_at: string | null; expires_at: string }>(
    `select id, used_at, expires_at from quote_approval_tokens
     where quote_id = '${uuid(quoteId)}' order by created_at desc limit 1;`
  );
  return rows[0] ?? null;
}

/** Forces a token to have expired, so the EXPIRED case is exercised for real. */
export async function expireApprovalToken(quoteId: string): Promise<void> {
  await sql(
    `update quote_approval_tokens set expires_at = now() - interval '1 day'
     where quote_id = '${uuid(quoteId)}';`
  );
}

export interface OutboundEmailRow {
  kind: string;
  recipient: string;
  subject: string;
  status: string;
  body_html: string | null;
}

/** Every message this job caused, oldest first. */
export async function readOutboundEmails(jobId: string): Promise<OutboundEmailRow[]> {
  return sql<OutboundEmailRow>(
    `select kind, recipient, subject, status, body_html from outbound_emails
     where quote_request_id = '${uuid(jobId)}' order by created_at;`
  );
}

/** Proves no message about this job was really sent to anybody. */
export async function realSendCount(jobId: string): Promise<number> {
  const rows = await sql<{ n: number }>(
    `select count(*)::int as n from outbound_emails
     where quote_request_id = '${uuid(jobId)}' and status <> 'captured_test_mode';`
  );
  return rows[0].n;
}

export interface LedgerRow {
  event_type: string;
  source: string;
  outcome: string | null;
  amount_cents: number | null;
  material: string | null;
  bend_count: number | null;
  hem_count: number | null;
  revision: number | null;
  time_to_decision_seconds: number | null;
  price_book_version_ids: string[] | null;
}

export async function readLedgerForJob(jobId: string): Promise<LedgerRow[]> {
  return sql<LedgerRow>(
    `select event_type, source, outcome, amount_cents, material, bend_count, hem_count,
            revision, time_to_decision_seconds, price_book_version_ids
     from pricing_ledger where quote_request_id = '${uuid(jobId)}' order by occurred_at, event_type;`
  );
}

/** Tagged ledger rows still present. Must be 0 after cleanup. */
export async function remainingLedgerRows(tag: string): Promise<number> {
  const rows = await sql<{ n: number }>(
    `select count(*)::int as n from pricing_ledger where test_tag = ${lit(tag)};`
  );
  return rows[0].n;
}

/** A tagged ledger row is INVISIBLE to the export and to analytics. Must be 0. */
export async function ledgerRealCountForTag(tag: string): Promise<number> {
  const rows = await sql<{ n: number }>(
    `select count(*)::int as n from pricing_ledger_real where test_tag = ${lit(tag)};`
  );
  return rows[0].n;
}

/**
 * Deletes everything this spec created that `deleteJob` cannot reach: the
 * quotes, their tokens, the invoice, the captured emails and the tagged ledger
 * rows. Order matters — the foreign keys point inward.
 */
export async function deleteQuoteAndInvoiceFor(jobId: string, tag: string): Promise<void> {
  const q = uuid(jobId);
  await sql(`delete from outbound_emails where quote_request_id = '${q}';`);
  await sql(`delete from pricing_ledger where quote_request_id = '${q}' and test_tag = ${lit(tag)};`);
  await sql(`delete from invoices where quote_request_id = '${q}';`);
  await sql(`delete from quote_approval_tokens where quote_request_id = '${q}';`);
  await sql(`update quote_requests set quote_id = null where id = '${q}';`);
  await sql(`delete from quotes where request_id = '${q}';`);
}

/** Counts for the "nothing was left behind" assertions. */
export async function remainingQuoteArtifacts(jobId: string): Promise<{
  quotes: number;
  invoices: number;
  tokens: number;
  emails: number;
}> {
  const q = uuid(jobId);
  const rows = await sql<{ quotes: number; invoices: number; tokens: number; emails: number }>(
    `select
       (select count(*)::int from quotes where request_id = '${q}') as quotes,
       (select count(*)::int from invoices where quote_request_id = '${q}') as invoices,
       (select count(*)::int from quote_approval_tokens where quote_request_id = '${q}') as tokens,
       (select count(*)::int from outbound_emails where quote_request_id = '${q}') as emails;`
  );
  return rows[0];
}
