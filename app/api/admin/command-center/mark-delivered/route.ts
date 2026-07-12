import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

// Closes the human-review loop: the bridge only ever stages a .ds1 file in
// its local review/ folder (status 'staged_for_review') because the binary
// format isn't fully verified — see afs-machine-bridge/README.md. Once a
// human has opened that file, confirmed it looks right, and manually copied
// it into the Thalmann's live folder, this route records that it actually
// reached the machine.
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
    if ((job as { status: string }).status !== 'staged_for_review') {
      return NextResponse.json({ error: 'Job is not staged for review.' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('machine_jobs')
      .update({ status: 'sent_to_machine', delivered_at: now, updated_at: now })
      .eq('id', jobId);
    if (updateError) {
      return NextResponse.json({ error: 'Could not update job.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'confirm_machine_job_delivered',
      resourceType: 'machine_job',
      resourceId: jobId,
      afterValue: { status: 'sent_to_machine' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Command Center Mark Delivered Error]', error);
    return NextResponse.json({ error: 'Could not update job. Please try again.' }, { status: 500 });
  }
}
