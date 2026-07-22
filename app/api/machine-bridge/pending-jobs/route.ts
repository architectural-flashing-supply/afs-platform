import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedBridgeRequest, logBridgeAuthFailure } from '@/lib/machine-bridge/auth';

interface MachineJobRow {
  id: string;
  order_id: string | null;
  quote_request_id: string | null;
  machine_profile_id: string | null;
  custom_bends: BendShape[] | null;
  profile_name: string;
  material: string | null;
  gauge: string | null;
  quantity: number;
  blank_width_mm: number | null;
  notes: string | null;
}

interface BendShape {
  leftLegMm: number | null;
  rightLegMm: number | null;
  bendAngleDegrees: number | null;
  radiusMm: number | null;
}

interface MachineProfileBendRow {
  profile_id: string;
  left_leg_mm: number | null;
  right_leg_mm: number | null;
  bend_angle_degrees: number | null;
  radius_mm: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedBridgeRequest(request)) {
    logBridgeAuthFailure(request, '/api/machine-bridge/pending-jobs');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Every successful poll counts as a "ping" for the Command Center's
  // connection-status dot, whether or not there are any jobs — otherwise
  // the dot would look dead during any quiet stretch with nothing pending.
  const now = new Date().toISOString();
  await supabase.from('machine_bridge_status').update({ last_ping_at: now, updated_at: now }).eq('id', true);

  const { data: jobs, error: jobsError } = await supabase
    .from('machine_jobs')
    .select(
      'id, order_id, quote_request_id, machine_profile_id, custom_bends, profile_name, material, gauge, quantity, blank_width_mm, notes'
    )
    .eq('status', 'approved_for_machine');
  if (jobsError) {
    return NextResponse.json({ error: 'Could not load pending jobs.' }, { status: 500 });
  }
  const jobRows = (jobs ?? []) as MachineJobRow[];
  if (jobRows.length === 0) {
    return NextResponse.json({ jobs: [] });
  }

  const [{ data: quoteRequests }, { data: orders }, { data: bendRows }] = await Promise.all([
    supabase
      .from('quote_requests')
      .select('id, request_number')
      .in('id', jobRows.map((j) => j.quote_request_id).filter((v): v is string => !!v)),
    supabase
      .from('orders')
      .select('id, order_number')
      .in('id', jobRows.map((j) => j.order_id).filter((v): v is string => !!v)),
    supabase
      .from('machine_profile_bends')
      .select('profile_id, left_leg_mm, right_leg_mm, bend_angle_degrees, radius_mm')
      .in('profile_id', jobRows.map((j) => j.machine_profile_id).filter((v): v is string => !!v))
      .order('step_number', { ascending: true }),
  ]);

  const requestNumberByQuoteRequest = new Map<string, string>();
  for (const qr of (quoteRequests ?? []) as { id: string; request_number: string }[]) {
    requestNumberByQuoteRequest.set(qr.id, qr.request_number);
  }
  const orderNumberByOrder = new Map<string, string>();
  for (const o of (orders ?? []) as { id: string; order_number: string }[]) {
    orderNumberByOrder.set(o.id, o.order_number);
  }
  const bendsByProfile = new Map<string, BendShape[]>();
  for (const row of (bendRows ?? []) as MachineProfileBendRow[]) {
    const list = bendsByProfile.get(row.profile_id) ?? [];
    list.push({
      leftLegMm: row.left_leg_mm,
      rightLegMm: row.right_leg_mm,
      bendAngleDegrees: row.bend_angle_degrees,
      radiusMm: row.radius_mm,
    });
    bendsByProfile.set(row.profile_id, list);
  }

  const response = jobRows.map((job) => ({
    id: job.id,
    requestNumber:
      (job.quote_request_id && requestNumberByQuoteRequest.get(job.quote_request_id)) ||
      (job.order_id && orderNumberByOrder.get(job.order_id)) ||
      job.id,
    profileName: job.profile_name,
    material: job.material,
    gauge: job.gauge,
    quantity: job.quantity,
    blankWidthMm: job.blank_width_mm,
    bends: job.machine_profile_id ? bendsByProfile.get(job.machine_profile_id) ?? [] : job.custom_bends ?? [],
    notes: job.notes,
  }));

  return NextResponse.json({ jobs: response });
}
