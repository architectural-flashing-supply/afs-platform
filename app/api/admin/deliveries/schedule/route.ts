import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { ledgerTestTag } from '@/lib/pricing/ledger';
import { notifyDeliveryScheduled } from '@/lib/delivery/notify';
import { isDeliveryWindow, deliveryWindowLabel } from '@/lib/delivery/windows';
import { formatDayHeading, isBusinessDay, isDateOnly } from '@/lib/delivery/business-days';

/**
 * SCHEDULE OR CHANGE A DELIVERY — the approved prototype's day + time-window
 * window, from any finished shop job whether its Job is still in the shop or
 * already done.
 *
 * ONE ROW PER SHOP JOB. `deliveries.shop_job_id` is UNIQUE (migration 037), so
 * this is an upsert on that key: scheduling and rescheduling are the same
 * action from the user's side and they are the same write here. A double click
 * cannot book two trucks.
 *
 * A DELIVERED DELIVERY IS NOT RESCHEDULABLE. Moving a stop that has already
 * been dropped off would rewrite history, and the honest answer is a sentence
 * saying so rather than a silent success.
 *
 * WHAT IS REFUSED, AND WHY IT IS REFUSED RATHER THAN CORRECTED:
 *   - a day that is not a working day. The four windows are 8am to 5pm on a
 *     weekday; quietly moving a Saturday request to Monday would tell the
 *     customer one thing and the shop another.
 *   - a job that has not come off the machine. A day cannot be promised for
 *     work that is still bending.
 *
 * The customer is told through lib/delivery/notify.ts, which is the existing
 * email and SMS services and nothing new.
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
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const shopJobId = body.shopJobId;
    const scheduledDate = body.scheduledDate;
    const timeWindow = body.timeWindow;
    const notify = body.notify !== false; // default on, as the prototype ticks it

    if (typeof shopJobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(shopJobId)) {
      return NextResponse.json({ error: 'Pick a job to schedule.' }, { status: 400 });
    }
    if (!isDateOnly(scheduledDate)) {
      return NextResponse.json({ error: 'Pick a delivery day.' }, { status: 400 });
    }
    if (!isBusinessDay(scheduledDate)) {
      return NextResponse.json(
        { error: 'Deliveries go out Monday to Friday. Pick a weekday.' },
        { status: 400 }
      );
    }
    if (!isDeliveryWindow(timeWindow)) {
      return NextResponse.json({ error: 'Pick a time window.' }, { status: 400 });
    }

    // Service role from here: `deliveries` is admin-only and the notifier
    // reads `orders` and `profiles` across customers. Role is already verified
    // above through the session client — the same auth-then-service-role
    // pattern app/api/orders/[id]/dispatch/route.ts uses. lib/supabase/admin.ts
    // also never reads a cached row (CLAUDE.md rule #22), which matters here:
    // "does this job already have a delivery" has to be the current answer.
    const admin = createAdminClient();

    const { data: jobRaw } = await admin
      .from('shop_profile_library')
      .select(
        'id, status, quote_request_id, order_number, profile_name, customer_name, company, customer_email, customer_phone, quantity, job_name, deleted_at'
      )
      .eq('id', shopJobId)
      .maybeSingle();
    if (!jobRaw || (jobRaw as { deleted_at: string | null }).deleted_at) {
      return NextResponse.json({ error: 'That job could not be found.' }, { status: 404 });
    }
    const job = jobRaw as unknown as {
      id: string;
      status: string | null;
      quote_request_id: string | null;
      order_number: string | null;
      profile_name: string | null;
      customer_name: string | null;
      company: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      quantity: number | null;
      job_name: string | null;
    };

    if (job.status !== 'complete') {
      return NextResponse.json(
        {
          error:
            'This job has not come off the machine yet, so a delivery day cannot be promised for it. ' +
            'Mark it finished in Shop View first.',
        },
        { status: 409 }
      );
    }

    const { data: existing } = await admin
      .from('deliveries')
      .select('id, scheduled_date, time_window, status')
      .eq('shop_job_id', shopJobId)
      .maybeSingle();
    const before = existing as
      | { id: string; scheduled_date: string; time_window: string; status: string }
      | null;

    if (before && before.status === 'delivered') {
      return NextResponse.json(
        {
          error:
            'This one has already been delivered, so its day cannot be changed. ' +
            'Start a new job if it needs to go out again.',
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    let deliveryId: string;

    if (before) {
      const { error: updateError } = await admin
        .from('deliveries')
        .update({
          scheduled_date: scheduledDate,
          time_window: timeWindow,
          // A person chose this day, so it is no longer the shop's default.
          auto_scheduled: false,
          scheduled_by: user.id,
          scheduled_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', before.id);
      if (updateError) {
        console.error('[Schedule Delivery — Update Error]', updateError);
        return NextResponse.json({ error: 'Could not save that day. Please try again.' }, { status: 500 });
      }
      deliveryId = before.id;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from('deliveries')
        .insert({
          shop_job_id: job.id,
          quote_request_id: job.quote_request_id,
          scheduled_date: scheduledDate,
          time_window: timeWindow,
          status: 'scheduled',
          auto_scheduled: false,
          scheduled_by: user.id,
          test_tag: ledgerTestTag(job.job_name),
        })
        .select('id')
        .single();
      if (insertError || !inserted) {
        console.error('[Schedule Delivery — Insert Error]', insertError);
        return NextResponse.json({ error: 'Could not save that day. Please try again.' }, { status: 500 });
      }
      deliveryId = (inserted as { id: string }).id;
    }

    let notifyNote = 'The customer was not notified, because that box was unticked.';
    if (notify) {
      const result = await notifyDeliveryScheduled(admin, {
        shopJobId: job.id,
        quoteRequestId: job.quote_request_id,
        orderNumber: job.order_number,
        customerEmail: job.customer_email,
        customerPhone: job.customer_phone,
        customerName: job.company ?? job.customer_name,
        itemDescription: job.profile_name ?? 'order',
        quantity: job.quantity,
        jobName: job.job_name,
        scheduledDate,
        timeWindow,
        autoScheduled: false,
      });
      notifyNote = result.note;
      await admin
        .from('deliveries')
        .update({
          notified_at: result.attempted ? new Date().toISOString() : null,
          notify_note: notifyNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliveryId);
    } else {
      await admin.from('deliveries').update({ notify_note: notifyNote }).eq('id', deliveryId);
    }

    await logAdminAction({
      adminId: user.id,
      action: before ? 'reschedule_delivery' : 'schedule_delivery',
      resourceType: 'delivery',
      resourceId: deliveryId,
      beforeValue: before ? { scheduled_date: before.scheduled_date, time_window: before.time_window } : null,
      afterValue: {
        shop_job_id: job.id,
        scheduled_date: scheduledDate,
        time_window: timeWindow,
        notify: notifyNote,
      },
    });

    return NextResponse.json({
      ok: true,
      deliveryId,
      scheduledDate,
      timeWindow,
      message:
        `${before ? 'Delivery moved to' : 'Delivery set for'} ${formatDayHeading(scheduledDate)}, ` +
        `${deliveryWindowLabel(timeWindow)}. ${notifyNote}`,
    });
  } catch (error) {
    console.error('[Schedule Delivery Route Error]', error);
    return NextResponse.json({ error: 'Could not save that day. Please try again.' }, { status: 500 });
  }
}
