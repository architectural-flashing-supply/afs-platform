import type { SupabaseClient } from '@supabase/supabase-js';

export type BidDocumentStatus = 'draft' | 'sent' | 'awarded' | 'lost' | 'expired' | 'withdrawn';

/**
 * A bid's claim is a soft, advisory lock (BID_DOCUMENT_SCOPE.md §3.1) — not
 * a security boundary. Computed lazily at read time, exactly the way
 * MachineBridgeStatusDot.tsx compares lastPingAt against CHECK_INTERVAL_MS —
 * no cron job ever clears claimed_by/claimed_at. The single source of truth
 * both the API routes and every list/detail render import, so the threshold
 * can never drift between them.
 */
export const CLAIM_INACTIVITY_TIMEOUT_MINUTES = 30;

export function isClaimActive(claimedBy: string | null, lastActivityAt: string | null): boolean {
  if (!claimedBy || !lastActivityAt) return false;
  return Date.now() - new Date(lastActivityAt).getTime() < CLAIM_INACTIVITY_TIMEOUT_MINUTES * 60_000;
}

/** "Claimed 12 min ago" / "Claimed 2 hr ago" style label for claim badges. */
export function formatClaimAge(claimedAt: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(claimedAt).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

export interface BidDocumentRow {
  id: string;
  bidNumber: string;
  status: BidDocumentStatus;
  projectName: string;
  gcName: string;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  lastActivityAt: string | null;
  subtotal: number | null;
  createdAt: string;
}

export interface BidDocumentSection {
  id: string;
  workDescription: string;
  sortOrder: number;
}

export interface BidDocumentLineItem {
  id: string;
  sectionId: string;
  quantity: number;
  specText: string;
  unit: string;
  unitPrice: number;
  extendedPrice: number;
  sortOrder: number;
}

export interface BidDocumentSectionWithItems extends BidDocumentSection {
  lineItems: BidDocumentLineItem[];
}

export interface BidDocumentDetail extends BidDocumentRow {
  gcContactName: string | null;
  gcContactEmail: string | null;
  gcContactPhone: string | null;
  projectLocation: string | null;
  bidProjectId: string | null;
  priceValidUntil: string | null;
  deliveryTerms: string | null;
  taxNote: string;
  customerNote: string | null;
  createdBy: string;
  sentAt: string | null;
  sections: BidDocumentSectionWithItems[];
}

interface BidDocumentSource {
  id: string;
  bid_number: string;
  status: BidDocumentStatus;
  project_name: string;
  gc_name: string;
  gc_contact_name: string | null;
  gc_contact_email: string | null;
  gc_contact_phone: string | null;
  project_location: string | null;
  bid_project_id: string | null;
  price_valid_until: string | null;
  delivery_terms: string | null;
  tax_note: string;
  customer_note: string | null;
  subtotal: number | null;
  claimed_by: string | null;
  claimed_at: string | null;
  last_activity_at: string | null;
  created_by: string;
  sent_at: string | null;
  created_at: string;
}

const LIST_COLUMNS =
  'id, bid_number, status, project_name, gc_name, claimed_by, claimed_at, last_activity_at, subtotal, created_at';
const DETAIL_COLUMNS =
  'id, bid_number, status, project_name, gc_name, gc_contact_name, gc_contact_email, gc_contact_phone, ' +
  'project_location, bid_project_id, price_valid_until, delivery_terms, tax_note, customer_note, subtotal, ' +
  'claimed_by, claimed_at, last_activity_at, created_by, sent_at, created_at';

async function resolveProfileNames(
  supabase: SupabaseClient,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', uniqueIds);
  return new Map(((data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
}

function toRow(source: BidDocumentSource, nameById: Map<string, string>): BidDocumentRow {
  return {
    id: source.id,
    bidNumber: source.bid_number,
    status: source.status,
    projectName: source.project_name,
    gcName: source.gc_name,
    claimedBy: source.claimed_by,
    claimedByName: source.claimed_by ? (nameById.get(source.claimed_by) ?? null) : null,
    claimedAt: source.claimed_at,
    lastActivityAt: source.last_activity_at,
    subtotal: source.subtotal,
    createdAt: source.created_at,
  };
}

/** All bids, newest first — matches getRecentQuoteRequests' shape (command-center-dashboard.ts). */
export async function getBidDocuments(supabase: SupabaseClient): Promise<BidDocumentRow[]> {
  const { data, error } = await supabase.from('bid_documents').select(LIST_COLUMNS).order('created_at', {
    ascending: false,
  });
  if (error || !data) return [];

  const rows = data as BidDocumentSource[];
  const nameById = await resolveProfileNames(
    supabase,
    rows.map((r) => r.claimed_by)
  );
  return rows.map((r) => toRow(r, nameById));
}

export async function getBidDocument(supabase: SupabaseClient, id: string): Promise<BidDocumentDetail | null> {
  const { data: bidRaw, error: bidError } = await supabase
    .from('bid_documents')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (bidError || !bidRaw) return null;
  const bid = bidRaw as unknown as BidDocumentSource;

  const [{ data: sectionRows }, nameById] = await Promise.all([
    supabase
      .from('bid_document_sections')
      .select('id, work_description, sort_order')
      .eq('bid_id', id)
      .order('sort_order', { ascending: true }),
    resolveProfileNames(supabase, [bid.claimed_by]),
  ]);

  const sections = (sectionRows ?? []) as { id: string; work_description: string; sort_order: number }[];
  const sectionIds = sections.map((s) => s.id);

  const { data: lineItemRows } =
    sectionIds.length > 0
      ? await supabase
          .from('bid_document_line_items')
          .select('id, section_id, quantity, spec_text, unit, unit_price, extended_price, sort_order')
          .in('section_id', sectionIds)
          .order('sort_order', { ascending: true })
      : { data: [] };

  const lineItems = (lineItemRows ?? []) as {
    id: string;
    section_id: string;
    quantity: number;
    spec_text: string;
    unit: string;
    unit_price: number;
    extended_price: number;
    sort_order: number;
  }[];

  const lineItemsBySection = new Map<string, BidDocumentLineItem[]>();
  for (const item of lineItems) {
    const mapped: BidDocumentLineItem = {
      id: item.id,
      sectionId: item.section_id,
      quantity: item.quantity,
      specText: item.spec_text,
      unit: item.unit,
      unitPrice: item.unit_price,
      extendedPrice: item.extended_price,
      sortOrder: item.sort_order,
    };
    const existing = lineItemsBySection.get(item.section_id) ?? [];
    existing.push(mapped);
    lineItemsBySection.set(item.section_id, existing);
  }

  return {
    ...toRow(bid, nameById),
    gcContactName: bid.gc_contact_name,
    gcContactEmail: bid.gc_contact_email,
    gcContactPhone: bid.gc_contact_phone,
    projectLocation: bid.project_location,
    bidProjectId: bid.bid_project_id,
    priceValidUntil: bid.price_valid_until,
    deliveryTerms: bid.delivery_terms,
    taxNote: bid.tax_note,
    customerNote: bid.customer_note,
    createdBy: bid.created_by,
    sentAt: bid.sent_at,
    sections: sections.map((s) => ({
      id: s.id,
      workDescription: s.work_description,
      sortOrder: s.sort_order,
      lineItems: lineItemsBySection.get(s.id) ?? [],
    })),
  };
}

/** Same shape as send/route.ts's nextQuoteNumber — prefix AFS-BID-{year}-, zero-padded 5-digit sequence. */
export async function nextBidNumber(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AFS-BID-${year}-`;

  const { data } = await supabase
    .from('bid_documents')
    .select('bid_number')
    .like('bid_number', `${prefix}%`)
    .order('bid_number', { ascending: false })
    .limit(1);

  const last = data?.[0]?.bid_number as string | undefined;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}
