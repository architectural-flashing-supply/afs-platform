/**
 * THE PRICING HISTORY LEDGER — the dataset the future dynamic pricing engine
 * will learn from.
 *
 * APPEND-ONLY, AND NOT ON THE HONOUR SYSTEM. Migration 035 puts a BEFORE UPDATE
 * OR DELETE trigger on `pricing_ledger` that raises, and gives the table SELECT
 * and INSERT policies only — no UPDATE policy and no DELETE policy exist, so
 * there are two independent refusals rather than one. This module can therefore
 * only ever add rows, which is the point: a price history you can edit is not a
 * history.
 *
 * WHAT GOES IN, per the v2-03 prompt:
 *   - every estimate and quote INCLUDING REVISIONS, with the material, gauge,
 *     blank width, bend count, hem count, length, quantity, rush flag,
 *     customer, the prices used, and the price-book VERSION used
 *   - every outcome (approved / declined / expired), the time to decision, and
 *     the reason when one is given
 *   - every invoice
 *   - every price-book change, as old value -> new value
 *   - every supplier price-change notice
 *
 * ================== TWO FUTURE WRITERS, DESIGNED FOR NOW ==================
 *
 * (a) THE DEFERRED PHASE 4 MAIL PARSER. When the Outlook inbound parser lands
 *     it writes supplier notices straight in here with
 *     `source: 'mail_parser'` and `externalRef` set to the Graph
 *     `internetMessageId`. Migration 035's `uq_pricing_ledger_external_ref`
 *     unique index makes the import idempotent, so re-running the parser over
 *     the same mailbox cannot double-count a price rise. Nothing about the
 *     table or this module has to change for it — that is the whole point of
 *     agreeing the shape now.
 *
 * (b) HISTORICAL SPREADSHEETS AND QUICKBOOKS EXPORTS. `source: 'import'` plus
 *     an `importBatchId` naming the file. The column-by-column import format is
 *     written down in SCHEMA.md ("PRICING LEDGER IMPORT FORMAT") and
 *     ARCHITECTURE.md; `importBatchId` is required by a CHECK constraint so an
 *     import can always be identified later — it cannot be DELETED (nothing
 *     here can), it is superseded by a corrected batch.
 *
 * ================== THE TEST TAG ==================
 *
 * `test_tag` is NULL on every row any production path writes. `ledgerTestTag()`
 * below is the ONLY thing that ever sets it, and it only does so for a job
 * whose name starts with the reserved literal prefix `E2E-TEST-`. A tagged row
 * is excluded from the `pricing_ledger_real` view and from the CSV export, so
 * it can never reach the dataset the pricing engine learns from, and it is the
 * only kind of row the append-only trigger will let a test delete afterwards.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const LEDGER_EVENT_TYPES = [
  'estimate',
  'quote_issued',
  'quote_revised',
  'quote_outcome',
  'invoice_issued',
  'invoice_paid',
  'price_book_change',
  'supplier_price_change',
] as const;
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export const LEDGER_SOURCES = ['admin_ui', 'customer_link', 'mail_parser', 'import', 'system'] as const;
export type LedgerSource = (typeof LEDGER_SOURCES)[number];

export type LedgerOutcome = 'approved' | 'declined' | 'expired';

/**
 * The reserved job-name prefix that marks E2E test data. Chosen as a literal
 * rather than an env var so it is greppable and cannot differ between
 * environments. A real customer whose job is genuinely named "E2E-TEST-…" would
 * have their ledger rows excluded from analytics, which is the only downside,
 * and is not a real one.
 */
export const LEDGER_TEST_TAG_PREFIX = 'E2E-TEST-';

/** The tag for a job, or null — which is what every real job gets. */
export function ledgerTestTag(jobName: string | null | undefined): string | null {
  if (typeof jobName !== 'string') return null;
  const trimmed = jobName.trim();
  if (!trimmed.startsWith(LEDGER_TEST_TAG_PREFIX)) return null;
  // The first whitespace-delimited word, so one run's rows share one tag.
  return trimmed.split(/\s+/)[0];
}

export interface LedgerEntry {
  eventType: LedgerEventType;
  source?: LedgerSource;
  occurredAt?: string;

  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;

  quoteRequestId?: string | null;
  quoteId?: string | null;
  invoiceId?: string | null;
  customerId?: string | null;
  customerLabel?: string | null;

  material?: string | null;
  gauge?: string | null;
  blankWidthIn?: number | null;
  bendCount?: number | null;
  hemCount?: number | null;
  lengthFt?: number | null;
  quantity?: number | null;
  isRush?: boolean | null;

  priceBookVersionIds?: string[] | null;
  pricesUsed?: Record<string, unknown> | null;
  amountCents?: number | null;
  revision?: number | null;

  outcome?: LedgerOutcome | null;
  outcomeReason?: string | null;
  timeToDecisionSeconds?: number | null;

  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;

  supplierName?: string | null;
  oldCostCents?: number | null;
  newCostCents?: number | null;
  effectiveDate?: string | null;
  attachmentPath?: string | null;

  note?: string | null;
  payload?: Record<string, unknown> | null;

  importBatchId?: string | null;
  externalRef?: string | null;

  testTag?: string | null;
}

/** The snake_case row, built in one place so every writer agrees on it. */
export function toLedgerRow(entry: LedgerEntry): Record<string, unknown> {
  return {
    event_type: entry.eventType,
    source: entry.source ?? 'admin_ui',
    occurred_at: entry.occurredAt ?? new Date().toISOString(),
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    actor_role: entry.actorRole ?? null,
    quote_request_id: entry.quoteRequestId ?? null,
    quote_id: entry.quoteId ?? null,
    invoice_id: entry.invoiceId ?? null,
    customer_id: entry.customerId ?? null,
    customer_label: entry.customerLabel ?? null,
    material: entry.material ?? null,
    gauge: entry.gauge ?? null,
    blank_width_in: entry.blankWidthIn ?? null,
    bend_count: entry.bendCount ?? null,
    hem_count: entry.hemCount ?? null,
    length_ft: entry.lengthFt ?? null,
    quantity: entry.quantity ?? null,
    is_rush: entry.isRush ?? null,
    price_book_version_ids: entry.priceBookVersionIds ?? null,
    prices_used: entry.pricesUsed ?? null,
    amount_cents: entry.amountCents ?? null,
    revision: entry.revision ?? null,
    outcome: entry.outcome ?? null,
    outcome_reason: entry.outcomeReason ?? null,
    time_to_decision_seconds: entry.timeToDecisionSeconds ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    supplier_name: entry.supplierName ?? null,
    old_cost_cents: entry.oldCostCents ?? null,
    new_cost_cents: entry.newCostCents ?? null,
    effective_date: entry.effectiveDate ?? null,
    attachment_path: entry.attachmentPath ?? null,
    note: entry.note ?? null,
    payload: entry.payload ?? null,
    import_batch_id: entry.importBatchId ?? null,
    external_ref: entry.externalRef ?? null,
    test_tag: entry.testTag ?? null,
  };
}

/**
 * Appends one or more entries. NEVER THROWS, and never blocks the thing it is
 * recording: a quote that was really sent must not fail because its history row
 * did not land. A failure is returned so the caller can log it.
 *
 * The ledger's own integrity is not weakened by this: a missing row is a gap,
 * an editable row would be a lie, and only the second one is prevented at the
 * cost of the workflow.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  entries: LedgerEntry | LedgerEntry[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return { ok: true, count: 0 };
  try {
    const { error } = await supabase.from('pricing_ledger').insert(list.map(toLedgerRow));
    if (error) {
      console.error('[Pricing Ledger] append failed', error.message);
      return { ok: false, count: 0, error: error.message };
    }
    return { ok: true, count: list.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error appending to the pricing ledger.';
    console.error('[Pricing Ledger] append threw', message);
    return { ok: false, count: 0, error: message };
  }
}

/** Columns of the CSV export, in order. Header text is the plain-English name. */
export const LEDGER_CSV_COLUMNS: { key: string; header: string }[] = [
  { key: 'occurred_at', header: 'When' },
  { key: 'event_type', header: 'What happened' },
  { key: 'source', header: 'Where it came from' },
  { key: 'actor_email', header: 'Who' },
  { key: 'customer_label', header: 'Customer' },
  { key: 'material', header: 'Material' },
  { key: 'gauge', header: 'Gauge' },
  { key: 'blank_width_in', header: 'Blank width (in)' },
  { key: 'bend_count', header: 'Bends' },
  { key: 'hem_count', header: 'Hems' },
  { key: 'length_ft', header: 'Length (ft)' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'is_rush', header: 'Rush' },
  { key: 'revision', header: 'Revision' },
  { key: 'amount_cents', header: 'Amount (cents)' },
  { key: 'outcome', header: 'Outcome' },
  { key: 'outcome_reason', header: 'Reason' },
  { key: 'time_to_decision_seconds', header: 'Time to decision (s)' },
  { key: 'supplier_name', header: 'Supplier' },
  { key: 'old_cost_cents', header: 'Old cost (cents)' },
  { key: 'new_cost_cents', header: 'New cost (cents)' },
  { key: 'effective_date', header: 'Effective date' },
  { key: 'price_book_version_ids', header: 'Price book version(s)' },
  { key: 'prices_used', header: 'Prices used' },
  { key: 'old_value', header: 'Old value' },
  { key: 'new_value', header: 'New value' },
  { key: 'import_batch_id', header: 'Import batch' },
  { key: 'external_ref', header: 'External reference' },
  { key: 'note', header: 'Note' },
  { key: 'quote_request_id', header: 'Job id' },
  { key: 'quote_id', header: 'Quote id' },
  { key: 'invoice_id', header: 'Invoice id' },
  { key: 'id', header: 'Ledger id' },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  // A leading =, +, - or @ is treated as a formula by Excel and Sheets. The
  // ledger is exported to be opened in exactly those, so it is neutralised.
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** The whole export, as one CSV string. Reads rows from `pricing_ledger_real`. */
export function ledgerToCsv(rows: readonly Record<string, unknown>[]): string {
  const header = LEDGER_CSV_COLUMNS.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((row) => LEDGER_CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(','));
  return [header, ...body].join('\r\n');
}
