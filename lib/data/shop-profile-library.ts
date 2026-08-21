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
