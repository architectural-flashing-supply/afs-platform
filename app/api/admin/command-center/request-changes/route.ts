import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

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
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const jobId = typeof body.jobId === 'string' ? body.jobId : null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!jobId || !message) {
      return NextResponse.json({ error: 'jobId and a message are required.' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from('machine_jobs')
      .select('id, quote_request_id, order_id')
      .eq('id', jobId)
      .maybeSingle();
    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    const jobRow = job as { id: string; quote_request_id: string | null; order_id: string | null };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('machine_jobs')
      .update({ status: 'changes_requested', updated_at: now })
      .eq('id', jobId);
    if (updateError) {
      return NextResponse.json({ error: 'Could not update job.' }, { status: 500 });
    }

    // Best-effort — matches the notification-failure-must-not-block-the-
    // action pattern used elsewhere (e.g. app/api/admin/orders/[id]/status).
    try {
      let userId: string | null = null;
      if (jobRow.order_id) {
        const { data: order } = await supabase.from('orders').select('user_id').eq('id', jobRow.order_id).maybeSingle();
        userId = (order as { user_id: string } | null)?.user_id ?? null;
      } else if (jobRow.quote_request_id) {
        const { data: qr } = await supabase
          .from('quote_requests')
          .select('user_id')
          .eq('id', jobRow.quote_request_id)
          .maybeSingle();
        userId = (qr as { user_id: string | null } | null)?.user_id ?? null;
      }
      if (userId) {
        const { data: customerProfile } = await supabase.from('profiles').select('email').eq('id', userId).single();
        await supabase.from('notifications').insert({
          user_id: userId,
          order_id: jobRow.order_id,
          channel: 'email',
          type: 'machine_job_changes_requested',
          recipient: (customerProfile?.email as string | undefined) ?? '',
          status: 'sent',
        });
      }
    } catch (notifyError) {
      console.error('[Command Center Request Changes Notification Error]', notifyError);
    }

    await logAdminAction({
      adminId: user.id,
      action: 'request_machine_job_changes',
      resourceType: 'machine_job',
      resourceId: jobId,
      afterValue: { status: 'changes_requested', message },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Command Center Request Changes Error]', error);
    return NextResponse.json({ error: 'Could not send request. Please try again.' }, { status: 500 });
  }
}
