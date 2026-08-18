import type { SupabaseClient } from '@supabase/supabase-js';

export type CommandCenterTab = 'pending' | 'sent' | 'completed';

// 'pending' is intentionally absent here — the Pending Approval tab is
// sourced directly from quote_requests (status = 'submitted'), not
// machine_jobs, since nothing creates a machine_jobs row until an admin
// approves a quote request. See lib/data/pending-quote-requests.ts.
type MachineJobTab = 'sent' | 'completed';

const STATUSES_BY_TAB: Record<MachineJobTab, string[]> = {
  sent: ['approved_for_machine', 'staged_for_review', 'sent_to_machine'],
  completed: ['completed'],
};

export interface MachineJobBend {
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

export interface MachineJobRow {
  id: string;
  requestNumber: string;
  customerName: string;
  customerCompany: string | null;
  profileName: string;
  material: string | null;
  gauge: string | null;
  quantity: number;
  blankWidthMm: number | null;
  isRush: boolean;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  approvedAt: string | null;
  stagedAt: string | null;
  deliveredAt: string | null;
  bends: MachineJobBend[];
  // True when approve-quote-request/route.ts had to substitute the
  // hardcoded 12"/2"/2" placeholder dimensions for this job's custom_bends
  // — see migration 012_machine_jobs_fallback_geometry.sql.
  usedFallbackGeometry: boolean;
  // Which real system this job is routed through — orthogonal to
  // `status`. See migration 015_machine_jobs_delivery_method.sql.
  deliveryMethod: 'pathfinder_edge' | 'machine_bridge';
}

interface MachineJobSource {
  id: string;
  order_id: string | null;
  quote_request_id: string | null;
  machine_profile_id: string | null;
  custom_bends: MachineJobBend[] | null;
  profile_name: string;
  material: string | null;
  gauge: string | null;
  quantity: number;
  blank_width_mm: number | null;
  is_rush: boolean;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  requested_by: string | null;
  approved_at: string | null;
  staged_at: string | null;
  delivered_at: string | null;
  created_at: string;
  used_fallback_geometry: boolean;
  delivery_method: 'pathfinder_edge' | 'machine_bridge';
}

export async function getMachineJobs(supabase: SupabaseClient, tab: MachineJobTab): Promise<MachineJobRow[]> {
  const { data: jobs, error } = await supabase
    .from('machine_jobs')
    .select(
      'id, order_id, quote_request_id, machine_profile_id, custom_bends, profile_name, material, gauge, quantity, blank_width_mm, is_rush, notes, status, rejection_reason, requested_by, approved_at, staged_at, delivered_at, created_at, used_fallback_geometry, delivery_method'
    )
    .in('status', STATUSES_BY_TAB[tab])
    .order('is_rush', { ascending: false })
    .order('created_at', { ascending: false });
  if (error || !jobs) return [];

  const jobRows = jobs as MachineJobSource[];
  if (jobRows.length === 0) return [];

  const quoteRequestIds = jobRows.map((j) => j.quote_request_id).filter((v): v is string => !!v);
  const orderIds = jobRows.map((j) => j.order_id).filter((v): v is string => !!v);
  const profileIds = jobRows.map((j) => j.machine_profile_id).filter((v): v is string => !!v);
  const requesterIds = jobRows.map((j) => j.requested_by).filter((v): v is string => !!v);

  const [{ data: quoteRequests }, { data: orders }, { data: bendRows }] = await Promise.all([
    quoteRequestIds.length
      ? supabase.from('quote_requests').select('id, request_number, user_id, guest_email').in('id', quoteRequestIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabase.from('orders').select('id, order_number, user_id').in('id', orderIds)
      : Promise.resolve({ data: [] }),
    profileIds.length
      ? supabase
          .from('machine_profile_bends')
          .select('profile_id, left_leg_mm, right_leg_mm, bend_angle_degrees, radius_mm')
          .in('profile_id', profileIds)
          .order('step_number', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const userIds = new Set<string>();
  const quoteRequestMap = new Map<string, { requestNumber: string; userId: string | null; guestEmail: string | null }>();
  for (const qr of (quoteRequests ?? []) as { id: string; request_number: string; user_id: string | null; guest_email: string | null }[]) {
    quoteRequestMap.set(qr.id, { requestNumber: qr.request_number, userId: qr.user_id, guestEmail: qr.guest_email });
    if (qr.user_id) userIds.add(qr.user_id);
  }
  const orderMap = new Map<string, { orderNumber: string; userId: string }>();
  for (const o of (orders ?? []) as { id: string; order_number: string; user_id: string }[]) {
    orderMap.set(o.id, { orderNumber: o.order_number, userId: o.user_id });
    userIds.add(o.user_id);
  }
  for (const id of requesterIds) userIds.add(id);

  const { data: profiles } = userIds.size
    ? await supabase.from('profiles').select('id, full_name, company').in('id', Array.from(userIds))
    : { data: [] };
  const profileMap = new Map<string, { fullName: string; company: string | null }>();
  for (const p of (profiles ?? []) as { id: string; full_name: string; company: string | null }[]) {
    profileMap.set(p.id, { fullName: p.full_name, company: p.company });
  }

  const bendsByProfile = new Map<string, MachineJobBend[]>();
  for (const row of (bendRows ?? []) as {
    profile_id: string;
    left_leg_mm: number | null;
    right_leg_mm: number | null;
    bend_angle_degrees: number | null;
    radius_mm: number | null;
  }[]) {
    const list = bendsByProfile.get(row.profile_id) ?? [];
    list.push({
      leftLegMm: row.left_leg_mm,
      rightLegMm: row.right_leg_mm,
      bendAngleDegrees: row.bend_angle_degrees,
      radiusMm: row.radius_mm,
    });
    bendsByProfile.set(row.profile_id, list);
  }

  return jobRows.map((job) => {
    const quoteRequest = job.quote_request_id ? quoteRequestMap.get(job.quote_request_id) : null;
    const order = job.order_id ? orderMap.get(job.order_id) : null;
    const customerUserId = quoteRequest?.userId ?? order?.userId ?? job.requested_by ?? null;
    const customerProfile = customerUserId ? profileMap.get(customerUserId) : null;

    return {
      id: job.id,
      requestNumber: quoteRequest?.requestNumber ?? order?.orderNumber ?? job.id.slice(0, 8),
      customerName: customerProfile?.fullName ?? quoteRequest?.guestEmail ?? 'Guest',
      customerCompany: customerProfile?.company ?? null,
      profileName: job.profile_name,
      material: job.material,
      gauge: job.gauge,
      quantity: job.quantity,
      blankWidthMm: job.blank_width_mm,
      isRush: job.is_rush,
      notes: job.notes,
      status: job.status,
      rejectionReason: job.rejection_reason,
      submittedAt: job.created_at,
      approvedAt: job.approved_at,
      stagedAt: job.staged_at,
      deliveredAt: job.delivered_at,
      bends: job.machine_profile_id ? bendsByProfile.get(job.machine_profile_id) ?? [] : job.custom_bends ?? [],
      usedFallbackGeometry: job.used_fallback_geometry,
      deliveryMethod: job.delivery_method,
    };
  });
}

export async function getMachineJobCounts(supabase: SupabaseClient): Promise<Record<CommandCenterTab, number>> {
  const [pendingResult, machineJobEntries] = await Promise.all([
    supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    Promise.all(
      (Object.keys(STATUSES_BY_TAB) as MachineJobTab[]).map(async (tab) => {
        const { count } = await supabase
          .from('machine_jobs')
          .select('id', { count: 'exact', head: true })
          .in('status', STATUSES_BY_TAB[tab]);
        return [tab, count ?? 0] as const;
      })
    ),
  ]);

  return {
    pending: pendingResult.count ?? 0,
    ...Object.fromEntries(machineJobEntries),
  } as Record<CommandCenterTab, number>;
}
