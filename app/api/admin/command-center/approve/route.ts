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
  machine_profile_id: string | null;
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
      .select('id, status, profile_name, machine_profile_id, custom_bends, blank_width_mm, delivery_method')
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

    // machine_profile_id set -> a real library match, bends live in
    // machine_profile_bends (step-ordered). Otherwise fall back to the
    // job's own custom_bends (FlashDraft-drawn geometry) — same
    // precedence lib/data/machine-jobs.ts's getMachineJobs already uses.
    let bends: MachineProfileBend[];
    if (jobRow.machine_profile_id) {
      const { data: bendRows, error: bendsError } = await supabase
        .from('machine_profile_bends')
        .select('step_number, left_leg_mm, right_leg_mm, bend_angle_degrees, radius_mm')
        .eq('profile_id', jobRow.machine_profile_id)
        .order('step_number', { ascending: true });
      if (bendsError) {
        return NextResponse.json({ error: 'Could not load profile bend data.' }, { status: 500 });
      }
      bends = (bendRows ?? []).map((b) => ({
        stepNumber: (b as { step_number: number }).step_number,
        leftLegMm: (b as { left_leg_mm: number | null }).left_leg_mm,
        rightLegMm: (b as { right_leg_mm: number | null }).right_leg_mm,
        bendAngleDegrees: (b as { bend_angle_degrees: number | null }).bend_angle_degrees,
        radiusMm: (b as { radius_mm: number | null }).radius_mm,
      }));
    } else {
      bends = (jobRow.custom_bends ?? []).map((b, i) => ({
        stepNumber: i + 1,
        leftLegMm: b.leftLegMm,
        rightLegMm: b.rightLegMm,
        bendAngleDegrees: b.bendAngleDegrees,
        radiusMm: b.radiusMm,
      }));
    }

    const machineProfile: MachineProfile = {
      id: jobRow.id,
      nameEn: jobRow.profile_name,
      profileNumber: jobRow.id.slice(0, 8),
      blankWidthMm: jobRow.blank_width_mm,
      bends,
    };

    const pushResult = await pushProfileToPathfinder(machineProfile, AFS_MACHINE_CATALOG_ID);
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
