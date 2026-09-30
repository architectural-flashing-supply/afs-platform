import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isJobStage, JOB_STAGE_LABELS } from '@/lib/data/job-stage';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const quoteRequestId = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).quoteRequestId : null;
    if (typeof quoteRequestId !== 'string') {
      return NextResponse.json({ error: 'quoteRequestId is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: quoteRequest, error: qrError } = await admin
      .from('quote_requests')
      .select('id, status, job_stage')
      .eq('id', quoteRequestId)
      .maybeSingle();
    if (qrError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }
    const qr = quoteRequest as { status: string; job_stage: string | null };
    // Plain English instead of the old "not pending approval" 409, which told
    // a non-technical reader nothing about why. A cancelled job is already
    // archived; a job that has moved on names the lane it is in.
    if (qr.status === 'cancelled') {
      return NextResponse.json({ ok: true, alreadyCancelled: true, message: 'This job was already cancelled.' });
    }
    if (qr.status !== 'submitted') {
      const where = isJobStage(qr.job_stage) ? `"${JOB_STAGE_LABELS[qr.job_stage]}"` : 'further along';
      return NextResponse.json(
        { error: `This job has already moved to ${where}, so it cannot be cancelled from here.` },
        { status: 409 }
      );
    }

    const { error: updateError } = await admin
      .from('quote_requests')
      // job_stage NULL = archived, off the Workbench (migration 032).
      .update({ status: 'cancelled', job_stage: null })
      .eq('id', quoteRequestId);
    if (updateError) {
      return NextResponse.json({ error: 'Could not cancel request.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'cancel_quote_request',
      resourceType: 'quote_request',
      resourceId: quoteRequestId,
      afterValue: { status: 'cancelled', jobStage: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Command Center Cancel Quote Request Error]', error);
    return NextResponse.json({ error: 'Could not cancel request. Please try again.' }, { status: 500 });
  }
}
