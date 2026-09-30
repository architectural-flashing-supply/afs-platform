import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { isJobStage, planStageTransition, type JobStageValue } from '@/lib/data/job-stage';
import { deliveryWindowLabel } from '@/lib/delivery/windows';
import { formatDayHeading } from '@/lib/delivery/business-days';

/**
 * MARK DELIVERED — the last button in the whole journey. It drops the stop off
 * the Deliveries week and moves the Job to **Done**.
 *
 * NOT TO BE CONFUSED WITH app/api/admin/command-center/mark-delivered, which
 * despite its name has nothing to do with a customer delivery: it records that
 * a `.ds1` file a human reviewed was copied into the Thalmann's live folder
 * (`machine_jobs` staged_for_review -> sent_to_machine). Two different
 * meanings of "delivered", both pre-existing; this is the customer one, and it
 * is on the deliveries resource where it belongs.
 *
 * ============ WHEN THE JOB REALLY BECOMES DONE ============
 *
 * A Job can be more than one piece of work: approve-quote-request writes ONE
 * `shop_profile_library` row PER LINE ITEM, so a three-item request is three
 * stops. The Job moves to Done only when EVERY one of its deliveries has been
 * delivered. Marking the first of three sets that stop delivered and says so —
 * it does not tell Steve the job is finished when two thirds of it is still on
 * the floor.
 *
 * The stage move goes through `planStageTransition` (lib/data/job-stage.ts),
 * which is the one place that decides whether a stage change is allowed. A
 * second click is a NO-OP with a plain-English sentence, never a 409 that
 * reads as a failure — the defect that rule was written for.
 *
 * NOTHING HERE TOUCHES THE MACHINE. It imports nothing from the machine
 * integration and makes no outbound request to it; the single-door static test
 * (lib/integrations/pathfinder-single-door.test.ts) is what guarantees that
 * rather than this sentence.
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
    const deliveryId = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).deliveryId : null;
    if (typeof deliveryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(deliveryId)) {
      return NextResponse.json({ error: 'Pick a delivery to mark delivered.' }, { status: 400 });
    }

    // Service role: `deliveries` and `quote_requests` are read and written
    // here across customers, and lib/supabase/admin.ts never reads a cached
    // row (CLAUDE.md rule #22) — "has this already been delivered" and "are
    // the other stops delivered" both have to be the current answer.
    const admin = createAdminClient();

    const { data: deliveryRaw } = await admin
      .from('deliveries')
      .select('id, shop_job_id, quote_request_id, scheduled_date, time_window, status, delivered_at')
      .eq('id', deliveryId)
      .maybeSingle();
    if (!deliveryRaw) {
      return NextResponse.json({ error: 'That delivery could not be found.' }, { status: 404 });
    }
    const delivery = deliveryRaw as unknown as {
      id: string;
      shop_job_id: string;
      quote_request_id: string | null;
      scheduled_date: string;
      time_window: string;
      status: string;
      delivered_at: string | null;
    };

    const when = `${formatDayHeading(delivery.scheduled_date)}, ${deliveryWindowLabel(delivery.time_window)}`;

    // Already delivered is information, not a failure.
    if (delivery.status === 'delivered') {
      return NextResponse.json({
        ok: true,
        alreadyDelivered: true,
        jobDone: false,
        message: `This one was already marked delivered. Nothing changed.`,
      });
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin
      .from('deliveries')
      .update({ status: 'delivered', delivered_at: nowIso, delivered_by: user.id, updated_at: nowIso })
      .eq('id', delivery.id)
      // Conditional, so two simultaneous clicks cannot both win. The same
      // shape the Approve link's single-use check uses (CLAUDE.md rule #21).
      .eq('status', 'scheduled');
    if (updateError) {
      console.error('[Mark Delivered — Update Error]', updateError);
      return NextResponse.json({ error: 'Could not mark that delivered. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'mark_delivery_delivered',
      resourceType: 'delivery',
      resourceId: delivery.id,
      beforeValue: { status: delivery.status },
      afterValue: { status: 'delivered', delivered_at: nowIso, scheduled_for: when },
    });

    // ---- Does the whole Job move to Done? ----
    let jobDone = false;
    let stageNote = '';
    if (delivery.quote_request_id) {
      // Every piece of work this Job produced — approve-quote-request writes
      // one shop_profile_library row PER LINE ITEM.
      const { data: pieces } = await admin
        .from('shop_profile_library')
        .select('id')
        .eq('quote_request_id', delivery.quote_request_id)
        .is('deleted_at', null);
      const pieceIds = ((pieces ?? []) as { id: string }[]).map((p) => p.id);

      // Which of them are delivered. The row updated moments ago is counted
      // explicitly rather than re-read, so this never depends on read timing.
      const { data: siblings } = await admin
        .from('deliveries')
        .select('shop_job_id, status')
        .eq('quote_request_id', delivery.quote_request_id);
      const delivered = new Set<string>([delivery.shop_job_id]);
      for (const d of (siblings ?? []) as { shop_job_id: string; status: string }[]) {
        if (d.status === 'delivered') delivered.add(d.shop_job_id);
      }

      // A piece with no delivery row at all is outstanding too — it has not
      // been given a day yet, so the Job certainly is not finished.
      const outstanding = pieceIds.filter((id) => !delivered.has(id)).length;

      if (outstanding === 0) {
        const { data: jobRaw } = await admin
          .from('quote_requests')
          .select('id, job_stage')
          .eq('id', delivery.quote_request_id)
          .maybeSingle();
        const currentStage: JobStageValue = isJobStage((jobRaw as { job_stage?: unknown } | null)?.job_stage)
          ? ((jobRaw as { job_stage: string }).job_stage as JobStageValue)
          : null;
        const transition = planStageTransition(currentStage, 'done');

        if (transition.outcome === 'advance') {
          const { error: stageError } = await admin
            .from('quote_requests')
            .update({ job_stage: 'done', stage_changed_at: nowIso, done_at: nowIso })
            .eq('id', delivery.quote_request_id);
          if (stageError) {
            console.error('[Mark Delivered — Stage Error]', stageError);
            stageNote = 'The delivery is recorded, but the job did not move to Done. Tell an admin.';
          } else {
            jobDone = true;
            stageNote = 'The job has moved to Done.';
            await logAdminAction({
              adminId: user.id,
              action: 'job_stage_done_on_delivery',
              resourceType: 'quote_request',
              resourceId: delivery.quote_request_id,
              beforeValue: { job_stage: currentStage },
              afterValue: { job_stage: 'done', done_at: nowIso },
            });
          }
        } else {
          // noop (already Done) or refused (cancelled). Either way, say what
          // is true rather than reporting a failure the user cannot act on.
          jobDone = transition.outcome === 'noop';
          stageNote = transition.message;
        }
      } else {
        stageNote =
          outstanding === 1
            ? 'One more piece of this job still has to go out, so it is not Done yet.'
            : `${outstanding} more pieces of this job still have to go out, so it is not Done yet.`;
      }
    } else {
      stageNote = 'This one is not linked to a job, so there was no job to move.';
    }

    return NextResponse.json({
      ok: true,
      alreadyDelivered: false,
      jobDone,
      message: `Marked delivered. ${stageNote}`,
    });
  } catch (error) {
    console.error('[Mark Delivered Route Error]', error);
    return NextResponse.json({ error: 'Could not mark that delivered. Please try again.' }, { status: 500 });
  }
}
