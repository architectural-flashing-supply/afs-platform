import type { SupabaseClient } from '@supabase/supabase-js';

// shop_profile_library (migration 016_source_tool_and_shop_profile_library.sql,
// afs-sv-007) is an admin-only internal shop record of a profile job's full
// intake context, written on every real send to PathfinderEdge — see
// app/api/admin/command-center/approve-quote-request/route.ts and
// app/api/studio/send-to-pathfinder/route.ts (afs-sv-009), the only two real
// PathfinderEdge-send code paths in this codebase. This file is the single
// place both call sites (and any future one — e.g. afs-sv-010's Shop View)
// should go through, so "exclude soft-deleted rows" and "how a row gets
// written" each have exactly one implementation, not one per call site.

export interface ShopProfileLibraryInsert {
  quoteRequestId?: string | null;
  machineJobId?: string | null;
  orderNumber?: string | null;
  profileName: string;
  customerName?: string | null;
  company?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  accountNotes?: string | null;
  material?: string | null;
  gauge?: string | null;
  // McElroy/PAC-CLAD color name (afs-cv-000's migration 017, afs-cv-002's
  // selection UI) — populated from the same source the caller already draws
  // material/gauge from, per call site (afs-cv-003).
  color?: string | null;
  // Job-identity intake fields + finish (migration 018, afs-jf-000/afs-jf-003)
  // — copied through from quote_requests on the Command Center approval path,
  // or threaded from FlashDraft's own live draw-session state on the direct
  // send path, the same way color already is (afs-cv-003). All optional/
  // nullable; also composed into the PathfinderEdge `description` field by
  // pushProfileToPathfinder (lib/integrations/pathfinder-edge.ts) — this is
  // the separate, permanent shop-record write-through, not that composition.
  clientBusinessName?: string | null;
  clientName?: string | null;
  poNumber?: string | null;
  requestedBy?: string | null;
  // job_name + requested_delivery_date (migration 019, afs-jf-004/afs-jf-005)
  // — same write-through story as the fields above.
  jobName?: string | null;
  requestedDeliveryDate?: string | null;
  finish?: string | null;
  quantity?: number | null;
  lengthFt?: number | null;
  dueDate?: string | null;
  geometryPoints?: unknown;
  geometrySvg?: string | null;
  sourceTool?: string | null;
  pathfinderProfileId?: string | null;
}

interface QueueOrderMinimalRow {
  id: string;
  queuePosition: number | null;
  dueDate: string | null;
  createdAt: string;
}

/**
 * Bootstraps `queue_position` for every non-deleted row (afs-cv-005), then
 * returns the position a brand-new row should append at.
 *
 * Before this ships, every existing row's `queue_position` is null, and
 * `compareShopProfileLibraryQueueOrder` always sorts a null position AFTER
 * any explicit one. That means a naive `MAX(queue_position) + 1` for a new
 * row — which would be `1`, since nothing yet has an explicit position —
 * would rank the new row ahead of every pre-existing null-positioned row.
 * That's exactly the "new send jumps the queue" bug this must avoid. So the
 * first time this runs, it assigns every currently non-deleted row a real
 * sequential position (in the same canonical order Shop View already sorts
 * by — due_date, then created_at, as a tiebreak), and only then computes the
 * new row's position as one past the end of that now-fully-sequential set.
 * Once the table is normalized this way, every future insert keeps it
 * sequential, so the update pass here is a no-op after the first call.
 */
async function appendToQueueEnd(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('shop_profile_library')
    .select('id, queue_position, due_date, created_at')
    .is('deleted_at', null);
  if (error || !data) return 1;

  const rows: QueueOrderMinimalRow[] = (
    data as { id: string; queue_position: number | null; due_date: string | null; created_at: string }[]
  ).map((r) => ({ id: r.id, queuePosition: r.queue_position, dueDate: r.due_date, createdAt: r.created_at }));

  const ordered = [...rows].sort(compareShopProfileLibraryQueueOrder);
  const stale = ordered.filter((r, idx) => r.queuePosition !== idx + 1);
  if (stale.length > 0) {
    await Promise.all(
      stale.map((r) =>
        supabase
          .from('shop_profile_library')
          .update({ queue_position: ordered.indexOf(r) + 1 })
          .eq('id', r.id)
      )
    );
  }

  return ordered.length + 1;
}

/**
 * Never throws — this is a secondary shop-record side effect of a real
 * PathfinderEdge send, not the send itself. A failure here (most likely:
 * migration 016 not yet applied live, see STATE_OF_THE_BUILD.md) must not
 * roll back or fail a response that already reflects a real push to the
 * physical machine's catalog. Same never-block reasoning ARCHITECTURE.md §9
 * requires of notification sends, and the same pattern lib/admin/audit.ts's
 * logAdminAction already uses.
 */
export async function insertShopProfileLibraryRecord(
  supabase: SupabaseClient,
  input: ShopProfileLibraryInsert
): Promise<void> {
  try {
    // Appends to the end of the shop queue (afs-cv-005) — see
    // appendToQueueEnd above for why this can't be a plain MAX()+1.
    const queuePosition = await appendToQueueEnd(supabase);

    const { error } = await supabase.from('shop_profile_library').insert({
      quote_request_id: input.quoteRequestId ?? null,
      machine_job_id: input.machineJobId ?? null,
      order_number: input.orderNumber ?? null,
      profile_name: input.profileName,
      customer_name: input.customerName ?? null,
      company: input.company ?? null,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      account_notes: input.accountNotes ?? null,
      material: input.material ?? null,
      gauge: input.gauge ?? null,
      color: input.color ?? null,
      client_business_name: input.clientBusinessName ?? null,
      client_name: input.clientName ?? null,
      po_number: input.poNumber ?? null,
      requested_by: input.requestedBy ?? null,
      job_name: input.jobName ?? null,
      requested_delivery_date: input.requestedDeliveryDate ?? null,
      finish: input.finish ?? null,
      quantity: input.quantity ?? null,
      length_ft: input.lengthFt ?? null,
      due_date: input.dueDate ?? null,
      geometry_points: input.geometryPoints ?? null,
      geometry_svg: input.geometrySvg ?? null,
      source_tool: input.sourceTool ?? null,
      pathfinder_profile_id: input.pathfinderProfileId ?? null,
      queue_position: queuePosition,
      status: 'queued',
    });
    if (error) {
      console.error('[Shop Profile Library Insert Error]', error);
    }
  } catch (error) {
    console.error('[Shop Profile Library Insert Error]', error);
  }
}

export interface ShopProfileLibraryRow {
  id: string;
  profileName: string;
  customerName: string | null;
  company: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  material: string | null;
  gauge: string | null;
  // Job-identity intake fields + finish (migration 018, afs-jf-003) — see
  // ShopProfileLibraryInsert above for the full write-through story.
  clientBusinessName: string | null;
  clientName: string | null;
  poNumber: string | null;
  requestedBy: string | null;
  finish: string | null;
  quantity: number | null;
  dueDate: string | null;
  sourceTool: string | null;
  status: string;
  geometrySvg: string | null;
  // Manual shop-floor queue ordering (afs-cv-000's migration 017, afs-cv-005's
  // reordering UI) — null for rows that predate this column or that no one
  // has manually sequenced yet. See compareShopProfileLibraryQueueOrder.
  queuePosition: number | null;
  createdAt: string;
}

/**
 * The one query every surface reading shop_profile_library should call —
 * `deleted_at IS NULL` lives here exactly once (via `.is('deleted_at', null)`)
 * so a soft-deleted row disappears everywhere at once: this admin page today,
 * afs-sv-010's Shop View whenever it's built.
 */
export async function getShopProfileLibrary(supabase: SupabaseClient): Promise<ShopProfileLibraryRow[]> {
  const { data, error } = await supabase
    .from('shop_profile_library')
    .select(
      'id, profile_name, customer_name, company, customer_email, customer_phone, material, gauge, client_business_name, client_name, po_number, requested_by, finish, quantity, due_date, source_tool, status, geometry_svg, queue_position, created_at'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  return (
    data as {
      id: string;
      profile_name: string | null;
      customer_name: string | null;
      company: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      material: string | null;
      gauge: string | null;
      client_business_name: string | null;
      client_name: string | null;
      po_number: string | null;
      requested_by: string | null;
      finish: string | null;
      quantity: number | null;
      due_date: string | null;
      source_tool: string | null;
      status: string | null;
      geometry_svg: string | null;
      queue_position: number | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    profileName: r.profile_name ?? '—',
    customerName: r.customer_name,
    company: r.company,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    material: r.material,
    gauge: r.gauge,
    clientBusinessName: r.client_business_name,
    clientName: r.client_name,
    poNumber: r.po_number,
    requestedBy: r.requested_by,
    finish: r.finish,
    quantity: r.quantity,
    dueDate: r.due_date,
    sourceTool: r.source_tool,
    status: r.status ?? 'queued',
    geometrySvg: r.geometry_svg,
    queuePosition: r.queue_position,
    createdAt: r.created_at,
  }));
}

// ----------------------------------------------------------------------------
// Status lifecycle (afs-sv-010) — queued -> in_progress -> complete. Shared
// between the status-update API route (app/api/admin/shop-library/[id]/
// route.ts's PATCH handler, which validates against this exact set) and
// Shop View's one-click advance control, so "what are the valid statuses"
// and "what comes next" each have exactly one implementation.
// ----------------------------------------------------------------------------

export const SHOP_PROFILE_LIBRARY_STATUSES = ['queued', 'in_progress', 'complete'] as const;
export type ShopProfileLibraryStatus = (typeof SHOP_PROFILE_LIBRARY_STATUSES)[number];

export function isShopProfileLibraryStatus(value: unknown): value is ShopProfileLibraryStatus {
  return typeof value === 'string' && (SHOP_PROFILE_LIBRARY_STATUSES as readonly string[]).includes(value);
}

const NEXT_STATUS: Record<ShopProfileLibraryStatus, ShopProfileLibraryStatus | null> = {
  queued: 'in_progress',
  in_progress: 'complete',
  complete: null,
};

const STATUS_LABEL: Record<ShopProfileLibraryStatus, string> = {
  queued: 'Queued',
  in_progress: 'In Progress',
  complete: 'Complete',
};

// Rows written before this status lifecycle existed, or any future write
// path that leaves status unset, land on the same 'queued' the column's own
// DEFAULT already uses — never render a raw unrecognized string.
export function shopProfileLibraryStatusLabel(status: string): string {
  return STATUS_LABEL[isShopProfileLibraryStatus(status) ? status : 'queued'];
}

export function nextShopProfileLibraryStatus(status: string): ShopProfileLibraryStatus | null {
  return NEXT_STATUS[isShopProfileLibraryStatus(status) ? status : 'queued'];
}

// ----------------------------------------------------------------------------
// Shop View (afs-sv-010) — the full intake record, for the shop-floor
// operator display. Profile Library's getShopProfileLibrary above only
// selects the columns its table needs; Shop View's cards surface
// substantially more of the row (order number, contact info, account
// notes, length, hem/paint/special instructions, PathfinderEdge profile
// id), so it gets its own select rather than over-fetching on every
// Profile Library page load. Both share the same table, the same
// `deleted_at IS NULL` filter, and the same admin-only RLS policy.
// ----------------------------------------------------------------------------

export interface ShopProfileLibraryFullRow {
  id: string;
  orderNumber: string | null;
  profileName: string;
  customerName: string | null;
  company: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  accountNotes: string | null;
  material: string | null;
  gauge: string | null;
  // McElroy/PAC-CLAD color name (afs-cv-000's migration 017, afs-cv-003's
  // write-through) — see ColorSwatchChip.tsx for the established swatch
  // rendering pattern this reuses.
  color: string | null;
  // Job-identity intake fields + finish (migration 018, afs-jf-003) — see
  // ShopProfileLibraryInsert above for the full write-through story.
  clientBusinessName: string | null;
  clientName: string | null;
  poNumber: string | null;
  requestedBy: string | null;
  finish: string | null;
  quantity: number | null;
  lengthFt: number | null;
  dueDate: string | null;
  hemInstructions: string | null;
  paintedEdge: boolean;
  specialInstructions: string | null;
  geometrySvg: string | null;
  sourceTool: string | null;
  pathfinderProfileId: string | null;
  status: string;
  // Manual shop-floor queue ordering (afs-cv-000's migration 017) — null for
  // rows written before this column existed, or any row staff hasn't
  // manually sequenced. See compareShopProfileLibraryQueueOrder below for
  // the single sort this drives across Shop View's queue strip and focus
  // panel (afs-cv-004), and the Profile Library table's up/down reordering
  // controls (afs-cv-005) — both read/write the exact same column.
  queuePosition: number | null;
  // Set only on the queued/in_progress -> complete transition (afs-cv-004).
  // Distinct from createdAt — used to drive the "Completed today" review
  // panel, not the active queue.
  completedAt: string | null;
  createdAt: string;
}

export async function getShopProfileLibraryFull(supabase: SupabaseClient): Promise<ShopProfileLibraryFullRow[]> {
  const { data, error } = await supabase
    .from('shop_profile_library')
    .select(
      'id, order_number, profile_name, customer_name, company, customer_email, customer_phone, account_notes, material, gauge, color, client_business_name, client_name, po_number, requested_by, finish, quantity, length_ft, due_date, hem_instructions, painted_edge, special_instructions, geometry_svg, source_tool, pathfinder_profile_id, status, queue_position, completed_at, created_at'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  return (
    data as {
      id: string;
      order_number: string | null;
      profile_name: string | null;
      customer_name: string | null;
      company: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      account_notes: string | null;
      material: string | null;
      gauge: string | null;
      color: string | null;
      client_business_name: string | null;
      client_name: string | null;
      po_number: string | null;
      requested_by: string | null;
      finish: string | null;
      quantity: number | null;
      length_ft: number | null;
      due_date: string | null;
      hem_instructions: string | null;
      painted_edge: boolean | null;
      special_instructions: string | null;
      geometry_svg: string | null;
      source_tool: string | null;
      pathfinder_profile_id: string | null;
      status: string | null;
      queue_position: number | null;
      completed_at: string | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    profileName: r.profile_name ?? '—',
    customerName: r.customer_name,
    company: r.company,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    accountNotes: r.account_notes,
    material: r.material,
    gauge: r.gauge,
    color: r.color,
    clientBusinessName: r.client_business_name,
    clientName: r.client_name,
    poNumber: r.po_number,
    requestedBy: r.requested_by,
    finish: r.finish,
    quantity: r.quantity,
    lengthFt: r.length_ft,
    dueDate: r.due_date,
    hemInstructions: r.hem_instructions,
    paintedEdge: r.painted_edge ?? false,
    specialInstructions: r.special_instructions,
    geometrySvg: r.geometry_svg,
    sourceTool: r.source_tool,
    pathfinderProfileId: r.pathfinder_profile_id,
    status: r.status ?? 'queued',
    queuePosition: r.queue_position,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  }));
}

// ----------------------------------------------------------------------------
// Queue ordering (afs-cv-004) — queue_position ascending (nulls last), then
// due_date ascending (nulls last), then created_at ascending as the final
// tiebreaker. Shared between Shop View's numbered queue strip, its focus-panel
// "advance to next job" logic, and the Profile Library table's up/down
// reordering controls (afs-cv-005), so all three agree on exactly one order.
// Structural (not nominal) typing — any row shape carrying these three
// fields, e.g. both ShopProfileLibraryRow and ShopProfileLibraryFullRow,
// satisfies QueueOrderFields without an explicit cast.
// ----------------------------------------------------------------------------
export interface QueueOrderFields {
  queuePosition: number | null;
  dueDate: string | null;
  createdAt: string;
}

export function compareShopProfileLibraryQueueOrder(a: QueueOrderFields, b: QueueOrderFields): number {
  if (a.queuePosition !== b.queuePosition) {
    if (a.queuePosition === null) return 1;
    if (b.queuePosition === null) return -1;
    return a.queuePosition - b.queuePosition;
  }
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (diff !== 0) return diff;
  }
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

// ----------------------------------------------------------------------------
// Field — Shop (afs-fl-003) — a read-only queue for the mobile job-completion
// list at app/field/shop/page.tsx. Only non-complete rows are relevant here
// (a completed job has no more action to take), same `status !== 'complete'`
// filter Shop View's own active queue already applies (lib/data/shop-queue.ts), in the same
// compareShopProfileLibraryQueueOrder order every other queue surface uses.
// ----------------------------------------------------------------------------

export interface FieldShopQueueRow {
  id: string;
  orderNumber: string | null;
  profileName: string;
  customerName: string | null;
  company: string | null;
  jobName: string | null;
  dueDate: string | null;
  status: string;
  queuePosition: number | null;
  createdAt: string;
}

export async function getFieldShopQueue(supabase: SupabaseClient): Promise<FieldShopQueueRow[]> {
  const { data, error } = await supabase
    .from('shop_profile_library')
    .select('id, order_number, profile_name, customer_name, company, job_name, due_date, status, queue_position, created_at')
    .is('deleted_at', null)
    .neq('status', 'complete')
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const rows: FieldShopQueueRow[] = (
    data as {
      id: string;
      order_number: string | null;
      profile_name: string | null;
      customer_name: string | null;
      company: string | null;
      job_name: string | null;
      due_date: string | null;
      status: string | null;
      queue_position: number | null;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    profileName: r.profile_name ?? '—',
    customerName: r.customer_name,
    company: r.company,
    jobName: r.job_name,
    dueDate: r.due_date,
    status: r.status ?? 'queued',
    queuePosition: r.queue_position,
    createdAt: r.created_at,
  }));

  return [...rows].sort(compareShopProfileLibraryQueueOrder);
}
