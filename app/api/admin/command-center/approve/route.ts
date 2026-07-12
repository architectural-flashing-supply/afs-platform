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
    const jobId = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).jobId : null;
    if (typeof jobId !== 'string') {
      return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from('machine_jobs')
      .select('id, status')
      .eq('id', jobId)
      .maybeSingle();
    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    if ((job as { status: string }).status !== 'pending_approval') {
      return NextResponse.json({ error: 'Job is not pending approval.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('machine_jobs')
      .update({ status: 'approved_for_machine', approved_by: user.id, approved_at: now, updated_at: now })
      .eq('id', jobId);
    if (updateError) {
      return NextResponse.json({ error: 'Could not approve job.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'approve_machine_job',
      resourceType: 'machine_job',
      resourceId: jobId,
      afterValue: { status: 'approved_for_machine' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Command Center Approve Error]', error);
    return NextResponse.json({ error: 'Could not approve job. Please try again.' }, { status: 500 });
  }
}
