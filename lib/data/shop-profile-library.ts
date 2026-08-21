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
  quantity?: number | null;
  lengthFt?: number | null;
  dueDate?: string | null;
  geometryPoints?: unknown;
  geometrySvg?: string | null;
  sourceTool?: string | null;
  pathfinderProfileId?: string | null;
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
      quantity: input.quantity ?? null,
      length_ft: input.lengthFt ?? null,
      due_date: input.dueDate ?? null,
      geometry_points: input.geometryPoints ?? null,
      geometry_svg: input.geometrySvg ?? null,
      source_tool: input.sourceTool ?? null,
      pathfinder_profile_id: input.pathfinderProfileId ?? null,
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
  quantity: number | null;
  dueDate: string | null;
  sourceTool: string | null;
  status: string;
  geometrySvg: string | null;
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
      'id, profile_name, customer_name, company, customer_email, customer_phone, material, gauge, quantity, due_date, source_tool, status, geometry_svg, created_at'
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
      quantity: number | null;
      due_date: string | null;
      source_tool: string | null;
      status: string | null;
      geometry_svg: string | null;
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
    quantity: r.quantity,
    dueDate: r.due_date,
    sourceTool: r.source_tool,
    status: r.status ?? 'queued',
    geometrySvg: r.geometry_svg,
    createdAt: r.created_at,
  }));
}

// ----------------------------------------------------------------------------
// Status lifecycle (afs-sv-010) — queued -> in_progress -> complete. Shared
// between the status-update API route (app/api/admin/profile-library/[id]/
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
  // panel (afs-cv-004).
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
      'id, order_number, profile_name, customer_name, company, customer_email, customer_phone, account_notes, material, gauge, color, quantity, length_ft, due_date, hem_instructions, painted_edge, special_instructions, geometry_svg, source_tool, pathfinder_profile_id, status, queue_position, completed_at, created_at'
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
// tiebreaker. Shared between Shop View's numbered queue strip and its
// focus-panel "advance to next job" logic so both agree on exactly one order.
// ----------------------------------------------------------------------------
export function compareShopProfileLibraryQueueOrder(
  a: ShopProfileLibraryFullRow,
  b: ShopProfileLibraryFullRow
): number {
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
