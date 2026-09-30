import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isJobStage, planStageTransition, type JobStageValue } from '@/lib/data/job-stage';

/**
 * "CUSTOMER APPROVED BY PHONE" — records a real customer approval that arrived
 * over the telephone, and moves the job to the Approved lane.
 *
 * ============ THIS IS NOT A PATHFINDEREDGE BYPASS. READ WHY. ============
 *
 * CLAUDE.md rule #14: the only way anything reaches PathfinderEdge catalog
 * 20115 is a Command Center approval that `pushProfileToPathfinder` VERIFIES IN
 * THE DATABASE before any network call — for `quote_request_approval` that
 * means the quote request must still be `status='submitted'` and the acting
 * user must be a real `role='admin'` profile.
 *
 * This route does not weaken that check, does not import
 * lib/integrations/pathfinder-edge.ts, and sends nothing anywhere. It does two
 * things:
 *
 *   1. It writes the approval record the guard reads — `job_stage='approved'`,
 *      `approval_channel='phone'`, `approved_by=<the admin's real id>`,
 *      `approved_at=<now>`, plus an `admin_audit_log` row naming who recorded
 *      it. That is a database-verified approval by construction: it is created
 *      by an authenticated admin session and it is written to the same row the
 *      guard re-reads.
 *
 *   2. It LEAVES `status='submitted'` alone, precisely so the guard's own
 *      condition still holds when "Send to machine" is pressed afterwards.
 *
 * The machine send is still a separate, deliberate click that goes through
 * `approve-quote-request` — the one door. Nothing here shortens that path; it
 * only records that the customer said yes on the phone instead of clicking a
 * link in an email, which is a fact about how the approval arrived, not a way
 * around needing one.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const quoteRequestId = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).quoteRequestId : null;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: found, error: findError } = await admin
      .from('quote_requests')
      .select('id, status, job_stage')
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (findError || !found) {
      return NextResponse.json({ error: 'That job could not be found.' }, { status: 404 });
    }
    const qr = found as { status: string; job_stage: string | null };

    const from: JobStageValue = isJobStage(qr.job_stage) ? qr.job_stage : null;
    const transition = planStageTransition(from, 'approved');
    if (transition.outcome === 'noop') {
      // Already approved. 200 with the plain-English reason — the same rule the
      // already-sent path follows. Recording the same approval twice is not a
      // failure and must not read like one.
      return NextResponse.json({ ok: true, alreadyApproved: true, message: transition.message });
    }
    if (transition.outcome === 'refused') {
      return NextResponse.json({ error: transition.message }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from('quote_requests')
      .update({
        job_stage: transition.to,
        stage_changed_at: now,
        approved_at: now,
        approval_channel: 'phone',
        approved_by: user.id,
        // `status` is DELIBERATELY NOT TOUCHED. See this route's header: the
        // single-door guard requires status='submitted' when it verifies the
        // approval, and this job has not been sent to the machine yet.
      })
      .eq('id', quoteRequestId);
    if (updateError) {
      console.error('[Approve By Phone Error]', updateError);
      return NextResponse.json(
        { error: 'The approval could not be saved. Nothing was changed — please try again.' },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminId: user.id,
      action: 'record_customer_approval_by_phone',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      beforeValue: { jobStage: qr.job_stage, status: qr.status },
      afterValue: {
        jobStage: transition.to,
        approvalChannel: 'phone',
        // Stated in the audit row so an auditor does not have to infer it.
        statusLeftAt: qr.status,
        pathfinderPushed: false,
      },
    });

    return NextResponse.json({
      ok: true,
      jobStage: transition.to,
      message:
        'Recorded — the customer approved by phone. This job is now in the Approved lane, ' +
        'ready for you to send to the machine.',
    });
  } catch (error) {
    console.error('[Approve By Phone Error]', error);
    return NextResponse.json({ error: 'Could not record the approval. Please try again.' }, { status: 500 });
  }
}
