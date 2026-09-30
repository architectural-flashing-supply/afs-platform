/**
 * DELIVERIES — the five-day week view, the stops on each day, and everything
 * finished that has nowhere to go yet.
 *
 * Command Center V2 prompt v2-04. The approved UX is the prototype's
 * `deliveriesView`: a week of day columns each holding stops (customer,
 * item × qty, window, **Mark delivered**), beside a **Not scheduled yet**
 * panel whose rows offer **Schedule delivery**.
 *
 * ============ RUSH DOES NOT PIN HERE ============
 *
 * CLAUDE.md rule #15: rush pins to the top of the SHOP QUEUES only. Deliveries
 * is not one — it is a calendar, read by whoever is loading a truck, and a
 * rush job whose day is Thursday does not become a Tuesday stop by being
 * urgent. So: stops sort by time window within their day, and the unscheduled
 * panel sorts by the same queue order the shop uses WITHOUT the rush pin. The
 * rush BADGE still shows, because the person loading wants to know. Both
 * halves are unit-tested against lib/data/shop-queue.ts's opposite behaviour.
 *
 * ============ THE WEEK STARTS TODAY ============
 *
 * The prototype hardcodes Thu Oct 1 – Wed Oct 7, i.e. the five business days
 * starting the day AFTER the day it was drawn. This starts with today when
 * today is a working day. A delivery going out this morning has to be on the
 * screen this morning, and the prototype's sample data simply had none.
 *
 * ============ NOTHING IS HIDDEN SILENTLY ============
 *
 * A delivery scheduled beyond the five days on screen is counted and its
 * earliest date is named (`beyondWeek`), rather than dropping off the end. A
 * screen that shows five days and says nothing about the sixth reads as "there
 * is nothing else", which is the failure this avoids.
 *
 * ============ EGRESS ============
 *
 * Same rule as the shop queue: `geometry_svg` is a base64 PNG and is never
 * selected here. Deliveries shows no drawings at all.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compareShopProfileLibraryQueueOrder,
  type QueueOrderFields,
} from '@/lib/data/shop-library';
import {
  businessDaysFrom,
  formatDayHeading,
  shopDateOnly,
  type DateOnly,
} from '@/lib/delivery/business-days';
import { DELIVERY_WINDOW_KEYS, deliveryWindowLabel } from '@/lib/delivery/windows';

/** How many business days the week view shows, per the approved prototype. */
export const DELIVERY_WEEK_DAYS = 5;

export interface DeliveryStop {
  deliveryId: string;
  shopJobId: string;
  quoteRequestId: string | null;
  customer: string;
  item: string;
  quantity: number | null;
  scheduledDate: DateOnly;
  timeWindow: string;
  timeWindowLabel: string;
  status: 'scheduled' | 'delivered';
  deliveredAt: string | null;
  autoScheduled: boolean;
  /** What the customer was actually told, as the notifier reported it. */
  notifyNote: string | null;
  isRush: boolean;
}

export interface DeliveryDay {
  date: DateOnly;
  heading: string;
  stops: DeliveryStop[];
}

/** A finished shop job with no delivery row yet. */
export interface UnscheduledJob extends QueueOrderFields {
  shopJobId: string;
  quoteRequestId: string | null;
  customer: string;
  item: string;
  quantity: number | null;
  /** 'shop' while the Job is still at the machine, 'done' once delivered. */
  jobStage: string | null;
  isRush: boolean;
  finishedAt: string | null;
}

export interface DeliveriesView {
  days: DeliveryDay[];
  unscheduled: UnscheduledJob[];
  /** Scheduled deliveries outside the five days on screen. Never silent. */
  beyondWeek: { count: number; earliest: DateOnly | null; earliestHeading: string | null };
  /** Delivered stops whose day has already scrolled off the week. */
  deliveredThisWeek: number;
}

/** Window order within a day — 8am first. */
export function compareStops(a: DeliveryStop, b: DeliveryStop): number {
  const ai = (DELIVERY_WINDOW_KEYS as readonly string[]).indexOf(a.timeWindow);
  const bi = (DELIVERY_WINDOW_KEYS as readonly string[]).indexOf(b.timeWindow);
  if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  return a.customer.localeCompare(b.customer);
}

/**
 * The unscheduled panel's order: the shop's own queue order, with NO rush pin.
 *
 * Exported and pure so rule #15's "shop queues only" half is a unit test
 * against lib/data/shop-queue.ts's `compareShopQueue`, not a comment.
 */
export function compareUnscheduled(a: UnscheduledJob, b: UnscheduledJob): number {
  return compareShopProfileLibraryQueueOrder(a, b);
}

interface DeliveryRow {
  id: string;
  shop_job_id: string;
  quote_request_id: string | null;
  scheduled_date: string;
  time_window: string;
  status: string;
  delivered_at: string | null;
  auto_scheduled: boolean;
  notify_note: string | null;
}

interface ShopRowForDelivery {
  id: string;
  quote_request_id: string | null;
  profile_name: string | null;
  customer_name: string | null;
  company: string | null;
  quantity: number | null;
  status: string | null;
  queue_position: number | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const SHOP_COLUMNS =
  'id, quote_request_id, profile_name, customer_name, company, quantity, status, ' +
  'queue_position, due_date, completed_at, created_at';

function customerOf(r: ShopRowForDelivery): string {
  return (r.company ?? '').trim() || (r.customer_name ?? '').trim() || 'No customer recorded';
}

export async function getDeliveriesView(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<DeliveriesView> {
  const today = shopDateOnly(now);
  const days = businessDaysFrom(today, DELIVERY_WEEK_DAYS);
  const windowStart = days[0];
  const windowEnd = days[days.length - 1];

  const [{ data: deliveryData }, { data: shopData }] = await Promise.all([
    supabase
      .from('deliveries')
      .select(
        'id, shop_job_id, quote_request_id, scheduled_date, time_window, status, delivered_at, auto_scheduled, notify_note'
      )
      .order('scheduled_date', { ascending: true }),
    // Only rows that are FINISHED at the machine can be delivered, plus any
    // row that already has a delivery (so a reschedule keeps working even if
    // somebody re-opened the shop job).
    supabase.from('shop_profile_library').select(SHOP_COLUMNS).is('deleted_at', null),
  ]);

  const deliveries = (deliveryData ?? []) as unknown as DeliveryRow[];
  const shopRows = (shopData ?? []) as unknown as ShopRowForDelivery[];
  const shopById = new Map(shopRows.map((r) => [r.id, r]));

  const jobIds = Array.from(
    new Set(
      [...shopRows.map((r) => r.quote_request_id), ...deliveries.map((d) => d.quote_request_id)].filter(
        (v): v is string => !!v
      )
    )
  );
  const jobById = new Map<string, { isRush: boolean; stage: string | null }>();
  if (jobIds.length) {
    const { data: jobs } = await supabase
      .from('quote_requests')
      .select('id, is_rush, job_stage')
      .in('id', jobIds);
    for (const j of (jobs ?? []) as { id: string; is_rush: boolean; job_stage: string | null }[]) {
      jobById.set(j.id, { isRush: j.is_rush === true, stage: j.job_stage });
    }
  }

  const stops: DeliveryStop[] = deliveries.map((d) => {
    const shop = shopById.get(d.shop_job_id) ?? null;
    const job = d.quote_request_id ? jobById.get(d.quote_request_id) : null;
    return {
      deliveryId: d.id,
      shopJobId: d.shop_job_id,
      quoteRequestId: d.quote_request_id,
      customer: shop ? customerOf(shop) : 'No customer recorded',
      item: (shop?.profile_name ?? '').trim() || 'Custom profile',
      quantity: shop?.quantity ?? null,
      scheduledDate: d.scheduled_date,
      timeWindow: d.time_window,
      timeWindowLabel: deliveryWindowLabel(d.time_window),
      status: d.status === 'delivered' ? 'delivered' : 'scheduled',
      deliveredAt: d.delivered_at,
      autoScheduled: d.auto_scheduled,
      notifyNote: d.notify_note,
      isRush: job?.isRush ?? false,
    };
  });

  const inWindow = (date: string) => date >= windowStart && date <= windowEnd;

  const dayViews: DeliveryDay[] = days.map((date) => ({
    date,
    heading: formatDayHeading(date),
    stops: stops.filter((s) => s.scheduledDate === date).sort(compareStops),
  }));

  const beyond = stops
    .filter((s) => s.status === 'scheduled' && !inWindow(s.scheduledDate))
    .map((s) => s.scheduledDate)
    .sort();
  const earliest = beyond[0] ?? null;

  const scheduledShopJobIds = new Set(deliveries.map((d) => d.shop_job_id));
  const unscheduled: UnscheduledJob[] = shopRows
    .filter((r) => r.status === 'complete' && !scheduledShopJobIds.has(r.id))
    .map((r) => {
      const job = r.quote_request_id ? jobById.get(r.quote_request_id) : null;
      return {
        shopJobId: r.id,
        quoteRequestId: r.quote_request_id,
        customer: customerOf(r),
        item: (r.profile_name ?? '').trim() || 'Custom profile',
        quantity: r.quantity,
        jobStage: job?.stage ?? null,
        isRush: job?.isRush ?? false,
        finishedAt: r.completed_at,
        queuePosition: r.queue_position,
        dueDate: r.due_date,
        createdAt: r.created_at,
      };
    })
    .sort(compareUnscheduled);

  return {
    days: dayViews,
    unscheduled,
    beyondWeek: {
      count: beyond.length,
      earliest,
      earliestHeading: earliest ? formatDayHeading(earliest) : null,
    },
    deliveredThisWeek: stops.filter((s) => s.status === 'delivered' && inWindow(s.scheduledDate)).length,
  };
}

/**
 * Every shop job that could be given a delivery day from the Deliveries
 * screen's own picker — finished work, whether or not it already has one.
 *
 * "Schedule or change a delivery from any shop or done job" (this prompt): a
 * job still bending is deliberately NOT offered, because a day cannot be
 * promised for work that has not come off the machine.
 */
export interface SchedulableJob {
  shopJobId: string;
  customer: string;
  item: string;
  quantity: number | null;
  currentDate: DateOnly | null;
  currentWindow: string | null;
}

export function schedulableFrom(view: DeliveriesView): SchedulableJob[] {
  const fromStops = view.days
    .flatMap((d) => d.stops)
    .filter((s) => s.status === 'scheduled')
    .map((s) => ({
      shopJobId: s.shopJobId,
      customer: s.customer,
      item: s.item,
      quantity: s.quantity,
      currentDate: s.scheduledDate,
      currentWindow: s.timeWindow,
    }));
  const fromUnscheduled = view.unscheduled.map((u) => ({
    shopJobId: u.shopJobId,
    customer: u.customer,
    item: u.item,
    quantity: u.quantity,
    currentDate: null,
    currentWindow: null,
  }));
  return [...fromUnscheduled, ...fromStops];
}
