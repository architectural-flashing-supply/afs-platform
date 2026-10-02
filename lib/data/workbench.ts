/**
 * THE WORKBENCH — five lanes, one Job card per request, newest arrival first.
 *
 * Command Center V2 prompt v2-02. The approved UX is
 * docs/design/command-center-v2-prototype.html (`STAGES`, `card()`,
 * `workbench()`); the stage model is lib/data/job-stage.ts and migration 032;
 * the per-stage clocks, the send-failure state and the returned PathfinderEdge
 * profile numbers are migration 034.
 *
 * FOUR RULES THIS MODULE IS RESPONSIBLE FOR, all of them testable here rather
 * than in a component:
 *
 * 1. NEWEST ARRIVAL AT THE TOP, EVERYWHERE. Every lane sorts by
 *    submitted_at DESC and nothing else. Rush does NOT reorder the Workbench —
 *    rush pins to the top of the SHOP QUEUES only (lib/data/machine-jobs.ts,
 *    lib/data/orders.ts), which are a different list read by a different
 *    person for a different purpose.
 *
 * 2. ONE ACTION PER CARD. `action` is a single value or null, never a list.
 *
 * 3. DONE AUTO-ARCHIVES AFTER 14 DAYS. Filtered out of the lane, never
 *    deleted and never hidden from Search.
 *
 * 4. EGRESS: no base64 anything. line_items can carry a `geometryImage` data
 *    URI that regularly exceeds 100KB, and `points` arrays are large; this
 *    module reads NEITHER. A card needs a customer, an item, an age and one
 *    action, and that is all it selects.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  JOB_STAGES,
  JOB_STAGE_LABELS,
  JOB_STAGE_SUBLABELS,
  isJobStage,
  type JobStage,
} from '@/lib/data/job-stage';
import { sourceArrivalLabel, sourceIconKey, type SourceIconKey } from '@/lib/data/quote-request-source-tool';
import { daysSince, greetingFor, waitingPhrase } from '@/lib/utils/waiting-time';

/** A Done job leaves the Workbench after this many days. Search still finds it. */
export const DONE_ARCHIVE_DAYS = 14;

/** A sent quote with no reply after this many days is "stale" and offers Follow up. */
export const STALE_QUOTE_DAYS = 3;

/** The one thing a card's button does. Null = this card has no action. */
export type WorkbenchCardAction =
  /** Go to the Job screen and write the quote. */
  | { kind: 'start-quote'; label: 'Start quote' }
  /** Go to the Job screen, where the follow-up draft is written. */
  | { kind: 'follow-up'; label: 'Follow up' }
  /** POST to approve-quote-request. The ONE door. Pulsing green. */
  | { kind: 'send-to-machine'; label: 'Send to machine' }
  /** A send that failed. Retrying is safe because nothing reached the machine. */
  | { kind: 'retry-send'; label: 'Try sending again' }
  /** Go to Deliveries. */
  | { kind: 'schedule-delivery'; label: 'Schedule delivery' };

export type MetaTone = 'neutral' | 'warn' | 'good' | 'bad';

export interface WorkbenchCard {
  id: string;
  requestNumber: string;
  stage: JobStage;
  /** Company if we know it, else the person, else the guest email. */
  customer: string;
  /** "Drip edge, 24 ga Charcoal Kynar × 40" — the item, as one line. */
  item: string;
  /** v7 splits that in two: "Drip edge × 40" ... */
  itemLine: string;
  /** ... and "24 ga Charcoal Kynar", set smaller beside a colour chip. */
  specLine: string;
  sourceLabel: string;
  sourceIcon: SourceIconKey;
  /** The card's one-line status, already written in plain English. */
  meta: string;
  metaTone: MetaTone;
  action: WorkbenchCardAction | null;
  /** Only ever true from an explicit customer checkbox or admin toggle. */
  isRush: boolean;
  /** Approved cards pulse green. */
  pulse: boolean;
}

export interface WorkbenchLane {
  key: JobStage;
  name: string;
  sub: string;
  cards: WorkbenchCard[];
}

export interface WorkbenchSummary {
  /** "Good morning, Steve." */
  greeting: string;
  quotesToWrite: number;
  approvalsReady: number;
  inTheShop: number;
}

/** One chip in the morning summary. `go` is the green "act on this" chip. */
export interface SummaryChip {
  text: string;
  tone: 'plain' | 'go';
}

export interface Workbench {
  lanes: WorkbenchLane[];
  summary: WorkbenchSummary;
  /** Rows filtered out of Done by the 14-day rule. Stated, never silent. */
  archivedFromDone: number;
}

interface WorkbenchRow {
  id: string;
  request_number: string;
  user_id: string | null;
  guest_email: string | null;
  line_items: LineItemForCard[] | null;
  is_rush: boolean;
  submitted_at: string;
  quoted_at: string | null;
  source_tool: string | null;
  job_stage: string | null;
  stage_changed_at: string | null;
  approved_at: string | null;
  sent_to_machine_at: string | null;
  done_at: string | null;
  send_status: string | null;
  send_error: string | null;
  pathfinder_profile_ids: string[] | null;
}

/**
 * The ONLY line_item fields a card reads. Deliberately narrow — see the egress
 * rule in this file's header. `points`, `geometryImage` and `bendRadiiIn` are
 * not in this type on purpose.
 */
interface LineItemForCard {
  profileType?: string | null;
  material?: string | null;
  gauge?: string | null;
  quantity?: number | null;
}

/**
 * The card's item line. Prototype: `item, first-part-of-spec × qty`.
 * A multi-item request names its first item and counts the rest, rather than
 * running off the card or pretending there is only one.
 */
export function describeCardItem(items: LineItemForCard[] | null): string {
  if (!items || items.length === 0) return 'No items listed';
  const first = items[0];
  const name = (first.profileType ?? '').trim() || 'Custom profile';
  const spec = [first.gauge, first.material].filter((s): s is string => !!s && s.trim() !== '').join(' ');
  const qty = Number(first.quantity) > 0 ? Math.round(Number(first.quantity)) : null;
  const head = [name, spec].filter(Boolean).join(', ');
  const withQty = qty ? `${head} × ${qty}` : head;
  if (items.length === 1) return withQty;
  const more = items.length - 1;
  return `${withQty} + ${more} more item${more === 1 ? '' : 's'}`;
}

/**
 * The same first line item, split the way prototype v7's card prints it.
 *
 * v7 gives a card TWO lines where `describeCardItem` gives one: `.item` is the
 * profile and the count ("Drip edge × 40") and `.spec` is the material, set
 * smaller and dimmer beside a colour chip ("24 ga Charcoal Kynar"). The one
 * string above cannot be split again reliably — "Drip edge, 24 ga Charcoal
 * Kynar × 40" has a comma inside the material for some specs — so the parts are
 * built from the line item rather than parsed back out of the sentence.
 *
 * Added ALONGSIDE `describeCardItem` rather than replacing it: that function is
 * still the one-line form, it has its own tests, and other surfaces print it.
 * The "+ N more items" note stays on the item line, where v7 puts the count.
 */
export function describeCardItemParts(items: LineItemForCard[] | null): {
  itemLine: string;
  specLine: string;
} {
  if (!items || items.length === 0) return { itemLine: 'No items listed', specLine: '' };
  const first = items[0];
  const name = (first.profileType ?? '').trim() || 'Custom profile';
  const specLine = [first.gauge, first.material]
    .filter((s): s is string => !!s && s.trim() !== '')
    .join(' ');
  const qty = Number(first.quantity) > 0 ? Math.round(Number(first.quantity)) : null;
  let itemLine = qty ? `${name} × ${qty}` : name;
  if (items.length > 1) {
    const more = items.length - 1;
    itemLine += ` + ${more} more item${more === 1 ? '' : 's'}`;
  }
  return { itemLine, specLine };
}

/**
 * When the clock for a stage starts. Falls back down the chain rather than
 * printing nothing: a row that predates migration 034 still has submitted_at.
 */
function stageClock(row: WorkbenchRow, stage: JobStage): string | null {
  switch (stage) {
    case 'new':
      return row.submitted_at;
    case 'quoted':
      return row.quoted_at ?? row.stage_changed_at ?? row.submitted_at;
    case 'approved':
      return row.approved_at ?? row.stage_changed_at ?? row.submitted_at;
    case 'shop':
      return row.sent_to_machine_at ?? row.stage_changed_at ?? row.submitted_at;
    case 'done':
      return row.done_at ?? row.stage_changed_at ?? row.submitted_at;
  }
}

/** machine_jobs statuses collapsed into what the shop card actually says. */
export type ShopSubState = 'queued' | 'finished' | 'problem' | 'unknown';

export function shopSubStateLabel(sub: ShopSubState): string {
  switch (sub) {
    case 'queued':
      return 'Queued at the Thalmann';
    case 'finished':
      return 'Finished, ready to deliver';
    case 'problem':
      return 'The machine reported a problem';
    case 'unknown':
      return 'At the Thalmann';
  }
}

export function shopSubStateFromJobStatuses(statuses: string[]): ShopSubState {
  if (statuses.length === 0) return 'unknown';
  if (statuses.includes('machine_error')) return 'problem';
  if (statuses.every((s) => s === 'completed')) return 'finished';
  return 'queued';
}

/**
 * Builds one card. Exported so the ordering, the meta wording and the
 * one-action rule are unit-testable without a database.
 */
export function buildCard(
  row: WorkbenchRow,
  stage: JobStage,
  opts: { customer: string; shopSub: ShopSubState; now: Date }
): WorkbenchCard {
  const age = waitingPhrase(stageClock(row, stage), opts.now);
  const base = {
    id: row.id,
    requestNumber: row.request_number,
    stage,
    customer: opts.customer,
    item: describeCardItem(row.line_items),
    ...describeCardItemParts(row.line_items),
    sourceLabel: sourceArrivalLabel(row.source_tool),
    sourceIcon: sourceIconKey(row.source_tool),
    isRush: row.is_rush === true,
  };

  // A send that failed outranks whatever the stage would otherwise say. It is
  // the one thing on this screen that needs doing again, so it is what the
  // card reports, and it survives a reload because it is a column.
  if (row.send_status === 'failed') {
    return {
      ...base,
      meta: `Send failed — retry. ${row.send_error ?? 'No reason was recorded.'}`,
      metaTone: 'bad',
      action: { kind: 'retry-send', label: 'Try sending again' },
      pulse: false,
    };
  }
  if (row.send_status === 'unconfirmed') {
    return {
      ...base,
      meta:
        'Sent, but the machine did not return a profile number, so it is not confirmed. ' +
        'Check catalog 20115 before sending again.',
      metaTone: 'warn',
      action: null,
      pulse: false,
    };
  }

  switch (stage) {
    case 'new':
      return {
        ...base,
        meta: age ? `${base.sourceLabel}, ${age}` : base.sourceLabel,
        metaTone: 'neutral',
        action: { kind: 'start-quote', label: 'Start quote' },
        pulse: false,
      };
    case 'quoted': {
      const stale = daysSince(row.quoted_at ?? row.stage_changed_at, opts.now) >= STALE_QUOTE_DAYS;
      return {
        ...base,
        meta: `Quote sent ${age ?? 'recently'}${stale ? ', no reply yet' : ''}`,
        metaTone: stale ? 'warn' : 'neutral',
        action: stale ? { kind: 'follow-up', label: 'Follow up' } : null,
        pulse: false,
      };
    }
    case 'approved':
      return {
        ...base,
        meta: `Customer approved ${age ?? 'recently'}`,
        metaTone: 'good',
        action: { kind: 'send-to-machine', label: 'Send to machine' },
        pulse: true,
      };
    case 'shop': {
      const numbers = (row.pathfinder_profile_ids ?? []).filter(Boolean);
      const sent = numbers.length ? `Sent as profile ${numbers.map((n) => `#${n}`).join(', ')}. ` : '';
      return {
        ...base,
        meta: `${sent}${shopSubStateLabel(opts.shopSub)}`,
        metaTone: opts.shopSub === 'problem' ? 'bad' : 'neutral',
        action: { kind: 'schedule-delivery', label: 'Schedule delivery' },
        pulse: false,
      };
    }
    case 'done':
      return {
        ...base,
        meta: `Delivered ${age ?? 'recently'}`,
        metaTone: 'good',
        action: null,
        pulse: false,
      };
  }
}

/** The summary line above the lanes. Assembled here so it can be asserted. */
export function buildSummary(
  counts: { quotesToWrite: number; approvalsReady: number; inTheShop: number },
  adminFirstName: string,
  now: Date
): WorkbenchSummary {
  return { greeting: `${greetingFor(now)}, ${adminFirstName}.`, ...counts };
}

/**
 * The summary chips above the lanes, in render order, with the wording the page
 * actually prints. app/admin/command-center/page.tsx renders from this and
 * composes no text of its own, so the unit test below asserts what really
 * ships.
 *
 * This replaced a `line` field on WorkbenchSummary that assembled all three
 * counts into one sentence. Nothing ever rendered it — the page has always
 * drawn three separate chips, per the approved prototype — so its unit test was
 * asserting a string no user could see, and had drifted: it expected
 * "0 approvals ready for the machine", which the UI deliberately never shows
 * because the green chip is hidden at zero (prototype line 304).
 */
export function summaryChips(summary: WorkbenchSummary): SummaryChip[] {
  // WORDING AND ORDER COME FROM PROTOTYPE v7 (`pageWorkbench()`, line 1283),
  // which leads with the thing to act on and phrases it as the shop would:
  // "2 ready for the machine", not "2 approvals ready".
  const chips: SummaryChip[] = [];

  // v7 shows this chip EITHER WAY: green with a pulsing beacon when there is
  // something to send, and a plain "No approvals waiting" when there is not.
  // The earlier version omitted it entirely at zero so the green chip would
  // keep its meaning — v7 solves the same problem by changing the chip rather
  // than removing it, which also stops the row from reflowing as work arrives.
  chips.push(
    summary.approvalsReady > 0
      ? { text: `${summary.approvalsReady} ready for the machine`, tone: 'go' }
      : { text: 'No approvals waiting', tone: 'plain' },
  );

  chips.push({ text: `${summary.quotesToWrite} to quote`, tone: 'plain' });

  // v7's fourth chip counts today's DELIVERIES. The Workbench query does not
  // read the deliveries table, so this counts jobs in the shop instead — the
  // same lane v7's own "In the shop" rail panel reports — rather than printing
  // a number nothing stands behind. Its third chip ("N new emails") is the
  // Outlook inbox rail and is deliberately absent: there is no Graph code in
  // this repo and this build does not add any.
  chips.push({
    text: summary.inTheShop === 1 ? '1 job in the shop' : `${summary.inTheShop} jobs in the shop`,
    tone: 'plain',
  });

  return chips;
}

const CARD_COLUMNS =
  'id, request_number, user_id, guest_email, line_items, is_rush, submitted_at, quoted_at, ' +
  'source_tool, job_stage, stage_changed_at, approved_at, sent_to_machine_at, done_at, ' +
  'send_status, send_error, pathfinder_profile_ids';

export async function getWorkbench(
  supabase: SupabaseClient,
  adminFirstName: string,
  now: Date = new Date()
): Promise<Workbench> {
  // ONE query for every lane. job_stage IS NULL means archived (cancelled) and
  // is off the Workbench by definition, so it is excluded in SQL rather than
  // fetched and dropped.
  const { data, error } = await supabase
    .from('quote_requests')
    .select(CARD_COLUMNS)
    .not('job_stage', 'is', null)
    .order('submitted_at', { ascending: false });

  const rows = (error ? [] : ((data ?? []) as unknown as WorkbenchRow[])).filter((r) =>
    isJobStage(r.job_stage)
  );

  // Customer names: one batched read, company first (that is what a card
  // shows), falling back to the person and then the guest email.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)));
  const nameById = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, company')
      .in('id', userIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; company: string | null }[]) {
      nameById.set(p.id, (p.company ?? '').trim() || (p.full_name ?? '').trim() || 'Customer');
    }
  }

  // Shop sub-state: one batched read of the machine_jobs belonging to the rows
  // that are actually in the shop lane. Nothing else needs it.
  const shopIds = rows.filter((r) => r.job_stage === 'shop').map((r) => r.id);
  const shopStatuses = new Map<string, string[]>();
  if (shopIds.length) {
    const { data: jobs } = await supabase
      .from('machine_jobs')
      .select('quote_request_id, status')
      .in('quote_request_id', shopIds);
    for (const j of (jobs ?? []) as { quote_request_id: string | null; status: string }[]) {
      if (!j.quote_request_id) continue;
      const list = shopStatuses.get(j.quote_request_id) ?? [];
      list.push(j.status);
      shopStatuses.set(j.quote_request_id, list);
    }
  }

  let archivedFromDone = 0;
  const byStage = new Map<JobStage, WorkbenchCard[]>(JOB_STAGES.map((s) => [s, []]));

  for (const row of rows) {
    const stage = row.job_stage as JobStage;
    if (stage === 'done' && daysSince(row.done_at ?? row.stage_changed_at, now) >= DONE_ARCHIVE_DAYS) {
      archivedFromDone++;
      continue;
    }
    const customer =
      (row.user_id ? nameById.get(row.user_id) : null) ?? (row.guest_email || 'Guest');
    byStage.get(stage)!.push(
      buildCard(row, stage, {
        customer,
        shopSub: shopSubStateFromJobStatuses(shopStatuses.get(row.id) ?? []),
        now,
      })
    );
  }

  const lanes: WorkbenchLane[] = JOB_STAGES.map((key) => ({
    key,
    name: JOB_STAGE_LABELS[key],
    sub: JOB_STAGE_SUBLABELS[key],
    cards: byStage.get(key)!,
  }));

  return {
    lanes,
    summary: buildSummary(
      {
        quotesToWrite: byStage.get('new')!.length,
        approvalsReady: byStage.get('approved')!.length,
        inTheShop: byStage.get('shop')!.length,
      },
      adminFirstName,
      now
    ),
    archivedFromDone,
  };
}
