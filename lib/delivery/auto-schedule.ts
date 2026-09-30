/**
 * MARK FINISHED -> A REAL DELIVERY ON THE NEXT BUSINESS DAY -> THE CUSTOMER IS
 * TOLD. One function, called from both completion routes, so the shop tablet
 * and the field app cannot behave differently.
 *
 * Callers:
 *   app/api/admin/shop-library/[id]/route.ts  (Shop View's Mark finished)
 *   app/api/field/shop/[id]/complete/route.ts (the mobile Mark Complete tap)
 *
 * Both already call `runShopJobCompletionAutomation` (lib/utils/
 * shop-job-completion.ts) on the same transition, and that stays exactly as it
 * was — it updates the matching `orders` row and sends the invoice. This adds
 * the V2 `deliveries` row beside it rather than rewriting it, because the two
 * answer different questions: that one is about an order and its invoice, this
 * one is about a truck on a Tuesday.
 *
 * NEVER THROWS, NEVER BLOCKS. A shop job that has genuinely been bent is
 * finished whether or not scheduling worked — the operator must not be told
 * "that failed" about work already sitting on the bench. A failure here is
 * logged and reported to the caller as a plain sentence it can show.
 *
 * IDEMPOTENT. `deliveries.shop_job_id` is UNIQUE (migration 037), and this
 * checks for an existing row first: a job finished, then un-finished, then
 * finished again keeps the delivery somebody may already have rescheduled by
 * hand. It never silently overwrites a human's choice with tomorrow morning.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logAdminAction } from '@/lib/admin/audit';
import { ledgerTestTag } from '@/lib/pricing/ledger';
import { formatDayHeading, nextBusinessDay, shopDateOnly } from '@/lib/delivery/business-days';
import { DEFAULT_DELIVERY_WINDOW, deliveryWindowLabel } from '@/lib/delivery/windows';
import { notifyDeliveryScheduled } from '@/lib/delivery/notify';

export interface AutoScheduleInput {
  shopJobId: string;
  /** Who pressed Mark finished. */
  finishedBy: string;
  /** When they pressed it. Defaults to now. */
  finishedAt?: Date;
}

export interface AutoScheduleResult {
  scheduled: boolean;
  /** `YYYY-MM-DD`, or null when nothing was scheduled. */
  scheduledDate: string | null;
  timeWindow: string | null;
  /** Plain English, safe to show the operator verbatim. */
  message: string;
}

interface ShopJobRow {
  id: string;
  quote_request_id: string | null;
  order_number: string | null;
  profile_name: string | null;
  customer_name: string | null;
  company: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  quantity: number | null;
  job_name: string | null;
}

export async function autoScheduleDeliveryOnFinish(
  admin: SupabaseClient,
  input: AutoScheduleInput
): Promise<AutoScheduleResult> {
  try {
    const { data: existing } = await admin
      .from('deliveries')
      .select('id, scheduled_date, time_window')
      .eq('shop_job_id', input.shopJobId)
      .maybeSingle();

    if (existing) {
      const row = existing as { scheduled_date: string; time_window: string };
      return {
        scheduled: false,
        scheduledDate: row.scheduled_date,
        timeWindow: row.time_window,
        message:
          `Marked finished. This job already had a delivery booked for ` +
          `${formatDayHeading(row.scheduled_date)}, ${deliveryWindowLabel(row.time_window)}, ` +
          `so that day was left alone.`,
      };
    }

    const { data: jobRaw, error: jobError } = await admin
      .from('shop_profile_library')
      .select(
        'id, quote_request_id, order_number, profile_name, customer_name, company, customer_email, customer_phone, quantity, job_name'
      )
      .eq('id', input.shopJobId)
      .maybeSingle();
    if (jobError || !jobRaw) {
      return {
        scheduled: false,
        scheduledDate: null,
        timeWindow: null,
        message: 'Marked finished. The delivery could not be booked automatically — schedule it from Deliveries.',
      };
    }
    const job = jobRaw as unknown as ShopJobRow;

    // The shop's own calendar date, then the next working day after it.
    const finishedOn = shopDateOnly(input.finishedAt ?? new Date());
    const scheduledDate = nextBusinessDay(finishedOn);
    const timeWindow = DEFAULT_DELIVERY_WINDOW;

    const { data: inserted, error: insertError } = await admin
      .from('deliveries')
      .insert({
        shop_job_id: job.id,
        quote_request_id: job.quote_request_id,
        scheduled_date: scheduledDate,
        time_window: timeWindow,
        status: 'scheduled',
        auto_scheduled: true,
        scheduled_by: input.finishedBy,
        test_tag: ledgerTestTag(job.job_name),
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('[Auto-schedule Delivery] insert failed', insertError);
      return {
        scheduled: false,
        scheduledDate: null,
        timeWindow: null,
        message: 'Marked finished. The delivery could not be booked automatically — schedule it from Deliveries.',
      };
    }
    const deliveryId = (inserted as { id: string }).id;

    const notified = await notifyDeliveryScheduled(admin, {
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
      autoScheduled: true,
    });

    // What the customer was really told, recorded from the result rather than
    // assumed from having called the notifier.
    await admin
      .from('deliveries')
      .update({
        notified_at: notified.attempted ? new Date().toISOString() : null,
        notify_note: notified.note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);

    await logAdminAction({
      adminId: input.finishedBy,
      action: 'auto_schedule_delivery_on_finish',
      resourceType: 'delivery',
      resourceId: deliveryId,
      afterValue: {
        shop_job_id: job.id,
        scheduled_date: scheduledDate,
        time_window: timeWindow,
        finished_on: finishedOn,
        notify: notified.note,
      },
    });

    return {
      scheduled: true,
      scheduledDate,
      timeWindow,
      // Written out here so both completion routes report the same sentence,
      // with a real day heading rather than an ISO string on a tablet.
      message:
        `Marked finished. Delivery set for ${formatDayHeading(scheduledDate)}, ` +
        `${deliveryWindowLabel(timeWindow)}. ${notified.note}`,
    };
  } catch (error) {
    console.error('[Auto-schedule Delivery] unexpected failure', error);
    return {
      scheduled: false,
      scheduledDate: null,
      timeWindow: null,
      message: 'Marked finished. The delivery could not be booked automatically — schedule it from Deliveries.',
    };
  }
}
