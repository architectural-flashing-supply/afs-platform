import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import {
  pushProfileToPathfinder,
  AFS_MACHINE_CATALOG_ID,
  type MachineProfile,
  type MachineProfileBend,
} from '@/lib/integrations/pathfinder-edge';

interface MachineJobRow {
  id: string;
  status: string;
  profile_name: string;
  custom_bends: MachineProfileBend[] | null;
  blank_width_mm: number | null;
  delivery_method: 'pathfinder_edge' | 'machine_bridge';
}

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
      .select('id, status, profile_name, custom_bends, blank_width_mm, delivery_method')
      .eq('id', jobId)
      .maybeSingle();
    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    const jobRow = job as MachineJobRow;
    if (jobRow.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Job is not pending approval.' }, { status: 409 });
    }
    // This route pushes to PathfinderEdge specifically — a job explicitly
    // routed to the Machine Bridge must never come through here, or it
    // could reach the physical machine via both paths independently. See
    // migration 015_machine_jobs_delivery_method.sql.
    if (jobRow.delivery_method !== 'pathfinder_edge') {
      return NextResponse.json(
        {
          error: `This job is routed to delivery_method "${jobRow.delivery_method}", not "pathfinder_edge" — refusing to push it to PathfinderEdge.`,
        },
        { status: 409 }
      );
    }

    // The job's own custom_bends (FlashDraft-drawn geometry) is the only
    // bend source. Until Command Center V2 prompt v2-01 there was a second
    // branch that read a step-ordered bend sequence from the old 911-entry
    // machine profile library when the job linked to one; that library and
    // its link column are gone, and the link was NULL on every job row that
    // ever existed, so this is the same geometry every real job already used.
    const bends: MachineProfileBend[] = (jobRow.custom_bends ?? []).map((b, i) => ({
      stepNumber: i + 1,
      leftLegMm: b.leftLegMm,
      rightLegMm: b.rightLegMm,
      bendAngleDegrees: b.bendAngleDegrees,
      radiusMm: b.radiusMm,
    }));

    const machineProfile: MachineProfile = {
      id: jobRow.id,
      nameEn: jobRow.profile_name,
      profileNumber: jobRow.id.slice(0, 8),
      blankWidthMm: jobRow.blank_width_mm,
      bends,
    };

    // ONE DOOR: verified in the database before any network call (see
    // pushProfileToPathfinder's header). The job is still 'pending_approval'
    // here — it only becomes 'approved_for_machine' after a successful push.
    const pushResult = await pushProfileToPathfinder(machineProfile, AFS_MACHINE_CATALOG_ID, {
      kind: 'machine_job_approval',
      machineJobId: jobRow.id,
      adminId: user.id,
    });
    if (pushResult.status !== 'connected') {
      // Job stays 'pending_approval' — nothing was actually sent, so
      // nothing should look approved. The admin can retry the same click
      // once the underlying problem (network, PathfinderEdge outage,
      // invalid geometry) is resolved.
      await logAdminAction({
        adminId: user.id,
        action: 'approve_machine_job_pathfinder_failed',
        resourceType: 'machine_job',
        resourceId: jobId,
        afterValue: { pathfinderStatus: pushResult.status, pathfinderMessage: pushResult.message },
      });
      return NextResponse.json(
        { error: `Could not push profile to PathfinderEdge: ${pushResult.message}` },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('machine_jobs')
      .update({ status: 'approved_for_machine', approved_by: user.id, approved_at: now, updated_at: now })
      .eq('id', jobId);
    if (updateError) {
      return NextResponse.json(
        {
          error:
            'Profile was pushed to PathfinderEdge, but the job status could not be updated. Check machine_jobs manually.',
        },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminId: user.id,
      action: 'approve_machine_job',
      resourceType: 'machine_job',
      resourceId: jobId,
      afterValue: {
        status: 'approved_for_machine',
        pathfinderCatalogId: AFS_MACHINE_CATALOG_ID,
        pathfinderProfileId: pushResult.profileId,
        pathfinderMessage: pushResult.message,
      },
    });

    return NextResponse.json({ ok: true, pathfinderProfileId: pushResult.profileId });
  } catch (error) {
    console.error('[Command Center Approve Error]', error);
    return NextResponse.json({ error: 'Could not approve job. Please try again.' }, { status: 500 });
  }
}
