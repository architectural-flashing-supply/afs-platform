import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';
import { runShopJobCompletionAutomation } from '@/lib/utils/shop-job-completion';
import { autoScheduleDeliveryOnFinish } from '@/lib/delivery/auto-schedule';
import { createAdminClient } from '@/lib/supabase/admin';

interface FieldShopCompleteResponse {
  ok: true;
  completedAt: string;
  completionEventId: string;
  /** Plain English — what happened to the delivery. Safe to show verbatim. */
  message: string;
  scheduledDate: string | null;
  timeWindow: string | null;
}

/**
 * Shop-floor "Mark Complete" tap (afs-fl-003) — components/field/
 * ShopJobCompletionList.tsx's only write path. Same status/completed_at
 * write afs-cv-004's app/api/admin/shop-library/[id]/route.ts PATCH
 * handler already does for the queued -> in_progress -> complete
 * lifecycle's final step (status literal 'complete', not 'completed' —
 * lib/data/shop-library.ts's SHOP_PROFILE_LIBRARY_STATUSES is the one place
 * it is defined), plus a completion_events row (migration 020 — CONFIRMED
 * APPLIED LIVE, see STATE_OF_THE_BUILD.md/SESSION_STATE.md; the "FILE
 * ONLY" language previously here was stale). Both this route and the
 * Shop View PATCH handler call the same runShopJobCompletionAutomation
 * (lib/utils/shop-job-completion.ts) AND the same
 * autoScheduleDeliveryOnFinish (lib/delivery/auto-schedule.ts, v2-04) once
 * their own status write succeeds, so the invoice email, the delivery and the
 * customer notification fire identically regardless of which surface
 * triggered completion (afs-fl-014, v2-04).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: existing } = await supabase
      .from('shop_profile_library')
      .select('id, status, order_number, quote_request_id, deleted_at')
      .eq('id', params.id)
      .maybeSingle();
    if (!existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    if (existing.status === 'complete') {
      return NextResponse.json({ error: 'This job is already marked complete.' }, { status: 409 });
    }

    const completedAt = new Date().toISOString();

    // Write 1 of 2: the actual completion. Must land before the
    // completion_events insert below — a shop-floor job is genuinely done
    // once this succeeds, whether or not the event record that follows
    // does.
    const { error: updateError } = await supabase
      .from('shop_profile_library')
      .update({ status: 'complete', completed_at: completedAt })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Field Shop Complete — Job Update Error]', updateError);
      return NextResponse.json({ error: 'Could not mark this job complete. Please try again.' }, { status: 500 });
    }

    // Write 2 of 2: the completion_events record a future delivery/
    // invoice/email automation will read. This is NOT a Supabase
    // transaction (no multi-statement transaction across two separate
    // .from() calls on this client) — if it fails, the job row above is
    // already 'complete', so this is surfaced as a distinct, loud error
    // rather than silently dropped or rolled back.
    //
    // (This block used to end "never call Resend/Twilio/any external API
    // here — explicitly out of scope for this prompt". That was afs-fl-003's
    // scope, and v2-04 changed it: Mark finished now books the delivery and
    // tells the customer. The sends happen BELOW, after both writes, in
    // never-throwing helpers — not inside this block, which is still the
    // rule the sentence was protecting.)
    const { data: eventRow, error: insertError } = await supabase
      .from('completion_events')
      .insert({
        shop_profile_library_id: params.id,
        order_number: existing.order_number,
        completed_at: completedAt,
      })
      .select('id')
      .single();
    if (insertError || !eventRow) {
      console.error('[Field Shop Complete — completion_events Insert Error]', insertError);
      return NextResponse.json(
        {
          error:
            'Job was marked complete, but the completion record failed to save. Tell an admin — this must be fixed manually.',
          completedAt,
        },
        { status: 500 }
      );
    }

    await logAdminAction({
      adminId: user.id,
      action: 'complete_shop_profile_library_job',
      resourceType: 'shop_profile_library',
      resourceId: params.id,
      beforeValue: { status: existing.status },
      afterValue: { status: 'complete', completed_at: completedAt, completion_event_id: eventRow.id as string },
    });

    // Delivery scheduling + invoice email for whichever real order (if any)
    // this job belongs to — see runShopJobCompletionAutomation's own header
    // comment for why this never errors or blocks the completion above.
    await runShopJobCompletionAutomation({
      shopProfileLibraryId: params.id,
      orderNumber: existing.order_number as string | null,
      quoteRequestId: existing.quote_request_id as string | null,
      completedBy: user.id,
    });

    // v2-04: the SAME auto-schedule Shop View's Mark finished runs
    // (lib/delivery/auto-schedule.ts) — next business day, customer notified
    // through the existing services. One function, so the tablet by the
    // machine and the phone in somebody's pocket cannot disagree.
    const auto = await autoScheduleDeliveryOnFinish(createAdminClient(), {
      shopJobId: params.id,
      finishedBy: user.id,
    });

    const response: FieldShopCompleteResponse = {
      ok: true,
      completedAt,
      completionEventId: eventRow.id as string,
      message: auto.message,
      scheduledDate: auto.scheduledDate,
      timeWindow: auto.timeWindow,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Field Shop Complete Route Error]', error);
    return NextResponse.json({ error: 'Could not mark this job complete. Please try again.' }, { status: 500 });
  }
}
