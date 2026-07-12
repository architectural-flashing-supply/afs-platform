import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedBridgeRequest } from '@/lib/machine-bridge/auth';
import { logAdminAction } from '@/lib/admin/audit';

// 'staged_for_review' is not one of the two statuses originally sketched
// for this route ('delivered' | 'failed') — the bridge never delivers
// straight into the machine's live folder (see afs-machine-bridge's README
// for why: the .ds1 binary format is only partially verified), so its
// normal success report means "generated and staged for human review,"
// not "delivered." Kept 'delivered' accepted too in case a future,
// fully-verified bridge reports it directly.
const ACCEPTED_STATUSES = ['delivered', 'staged_for_review', 'failed'] as const;
type BridgeReportedStatus = (typeof ACCEPTED_STATUSES)[number];

const JOB_STATUS_BY_REPORT: Record<BridgeReportedStatus, string> = {
  delivered: 'sent_to_machine',
  staged_for_review: 'staged_for_review',
  failed: 'machine_error',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedBridgeRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw: unknown = await request.json().catch(() => null);
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const body = raw as { jobId?: string; status?: string; error?: string };
  if (!body.jobId || !body.status || !ACCEPTED_STATUSES.includes(body.status as BridgeReportedStatus)) {
    return NextResponse.json(
      { error: `jobId is required and status must be one of: ${ACCEPTED_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const newStatus = JOB_STATUS_BY_REPORT[body.status as BridgeReportedStatus];
  const now = new Date().toISOString();

  const update: Record<string, unknown> = { status: newStatus, updated_at: now };
  if (newStatus === 'staged_for_review') update.staged_at = now;
  if (newStatus === 'sent_to_machine') update.delivered_at = now;

  const { error: updateError } = await supabase.from('machine_jobs').update(update).eq('id', body.jobId);
  if (updateError) {
    return NextResponse.json({ error: 'Could not update job status.' }, { status: 500 });
  }

  await supabase
    .from('machine_bridge_status')
    .update({ last_ping_at: now, updated_at: now })
    .eq('id', true);

  await logAdminAction({
    adminId: null,
    action: `machine_bridge_report_${body.status}`,
    resourceType: 'machine_job',
    resourceId: body.jobId,
    afterValue: { status: newStatus, error: body.error ?? null },
  });

  return NextResponse.json({ ok: true });
}
