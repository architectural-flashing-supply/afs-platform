import type { SupabaseClient } from '@supabase/supabase-js';
import { sourceArrivalLabel } from '@/lib/data/quote-request-source-tool';
import { describeCardItem, type Workbench } from '@/lib/data/workbench';
import { isJobStage, type JobStage } from '@/lib/data/job-stage';
import type { ListRow } from '@/lib/data/quote-order-list';

/**
 * Rows for the Quotes and Orders lists.
 *
 * ONE query for both pages, the same shape the Workbench reads
 * (`quote_requests`, `job_stage IS NOT NULL`), plus the two things a list row
 * needs that a Workbench card does not: the CONTACT PERSON and the QUOTE TOTAL.
 *
 * No schema change was required for either. The person comes from the existing
 * `profiles` join the Workbench already does; the total comes from
 * `quote_requests.quote_id -> quotes.total_cents`, both of which exist
 * (migration 035). A job with no priced quote simply has `totalCents: null`,
 * which the list prints as "No price yet" — v7's own wording for the same case.
 *
 * Filtering, sorting and the token match all happen in
 * `lib/data/quote-order-list.ts` on the returned rows, so they stay pure and
 * testable. This module only fetches.
 */

interface QuoteRequestRow {
  id: string;
  request_number: string | null;
  user_id: string | null;
  guest_email: string | null;
  client_business_name: string | null;
  client_name: string | null;
  line_items: LineItemRow[] | null;
  is_rush: boolean | null;
  submitted_at: string;
  source_tool: string | null;
  job_stage: string | null;
  quote_id: string | null;
}

interface LineItemRow {
  profileType?: string | null;
  material?: string | null;
  gauge?: string | null;
  quantity?: number | null;
  profileId?: string | null;
}

const LIST_COLUMNS =
  'id, request_number, user_id, guest_email, client_business_name, client_name, ' +
  'line_items, is_rush, submitted_at, source_tool, job_stage, quote_id';

/** Material/gauge line, as the card writes it. */
function describeSpec(items: LineItemRow[] | null): string {
  if (!items || items.length === 0) return '';
  const first = items[0];
  return [first.gauge, first.material].filter((s): s is string => !!s && s.trim() !== '').join(' ');
}

function totalQuantity(items: LineItemRow[] | null): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, i) => sum + (typeof i.quantity === 'number' ? i.quantity : 0), 0);
}

function firstProfileId(items: LineItemRow[] | null): string | null {
  if (!items) return null;
  for (const i of items) {
    if (i.profileId && i.profileId.trim() !== '') return i.profileId;
  }
  return null;
}

/**
 * The plain-English status line. Deliberately the SAME sentence the Workbench
 * card prints, so a job does not describe itself two different ways on two
 * screens.
 */
function metaFor(stage: JobStage, source: string): string {
  switch (stage) {
    case 'new':
      return `${source} · needs a quote`;
    case 'quoted':
      return `${source} · waiting on the customer`;
    case 'approved':
      return `${source} · ready for the machine`;
    case 'shop':
      return `${source} · at the Thalmann`;
    case 'done':
      return `${source} · delivered`;
    default:
      return source;
  }
}

export async function getQuoteOrderRows(supabase: SupabaseClient): Promise<ListRow[]> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select(LIST_COLUMNS)
    .not('job_stage', 'is', null)
    .order('submitted_at', { ascending: false });

  if (error || !data) return [];
  const rows = data as unknown as QuoteRequestRow[];

  // Customer names and contacts: one batched read, company first — the same
  // rule the Workbench uses (lib/data/workbench.ts:365).
  const userIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];
  const profileById = new Map<string, { company: string; person: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, company')
      .in('id', userIds);
    for (const p of (profiles ?? []) as { id: string; full_name: string | null; company: string | null }[]) {
      profileById.set(p.id, {
        company: (p.company ?? '').trim(),
        person: (p.full_name ?? '').trim(),
      });
    }
  }

  // Quote totals: one batched read over the quote ids these jobs point at.
  const quoteIds = [...new Set(rows.map((r) => r.quote_id).filter((id): id is string => !!id))];
  const totalById = new Map<string, number>();
  if (quoteIds.length > 0) {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, total_cents')
      .in('id', quoteIds);
    for (const q of (quotes ?? []) as { id: string; total_cents: number | null }[]) {
      if (typeof q.total_cents === 'number') totalById.set(q.id, q.total_cents);
    }
  }

  return rows
    .filter((r) => isJobStage(r.job_stage))
    .map((r) => {
      const profile = r.user_id ? profileById.get(r.user_id) : undefined;
      const company =
        (r.client_business_name ?? '').trim() ||
        profile?.company ||
        profile?.person ||
        (r.client_name ?? '').trim() ||
        (r.guest_email ?? '').trim() ||
        'Customer';
      const person = profile?.person || (r.client_name ?? '').trim();
      const stage = r.job_stage as JobStage;
      const sourceLabel = sourceArrivalLabel(r.source_tool);

      return {
        id: r.id,
        requestNumber: r.request_number ?? '',
        stage,
        customer: company,
        // Never repeat the company as the contact line.
        person: person && person !== company ? person : '',
        item: describeCardItem(r.line_items),
        spec: describeSpec(r.line_items),
        quantity: totalQuantity(r.line_items),
        totalCents: r.quote_id ? (totalById.get(r.quote_id) ?? null) : null,
        submittedAt: r.submitted_at,
        sourceLabel,
        meta: metaFor(stage, sourceLabel),
        isRush: r.is_rush === true,
        profileId: firstProfileId(r.line_items),
      } satisfies ListRow;
    });
}

/** Companies for the header type-ahead, newest activity first. */
export function companiesFromRows(rows: ListRow[]): { name: string; person: string }[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    if (!seen.has(r.customer)) seen.set(r.customer, r.person);
  }
  return [...seen.entries()].map(([name, person]) => ({ name, person }));
}

export type { Workbench };
