import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { sendInvoiceEmail } from './invoice-email';
import { trackingUrlFor } from '@/lib/delivery/tracking-url';

/**
 * The two loose links a shop_profile_library row carries back to a real
 * `orders` row. Split out of ShopJobCompletionEvent (below) so v2-04's
 * delivery notifier can resolve a tracking link through the SAME FK chain
 * this file already documents, instead of writing a second resolver.
 */
export interface ShopJobOrderLink {
  orderNumber: string | null;
  quoteRequestId: string | null;
}

export interface ShopJobCompletionEvent extends ShopJobOrderLink {
  shopProfileLibraryId: string;
  completedBy: string;
}

export interface MatchedOrder {
  id: string;
  orderNumber: string;
  trackingToken: string | null;
}

/**
 * Finds the real `orders` row (if any) a completed shop_profile_library job
 * belongs to. `shop_profile_library.order_number` is a loose TEXT field, not
 * a verified foreign key (ORDER_LIFECYCLE_DECISION.md), and — confirmed
 * directly against the live database — no write path in this codebase ever
 * populates it (insertShopProfileLibraryRecord, lib/data/shop-profile-
 * library.ts, never sets order_number on either real call site: the Command
 * Center approve-quote-request flow or FlashDraft's direct send). So it is
 * checked here only as a defensive fallback, never as the primary link.
 *
 * The real, FK-backed path (documented in SESSION_STATE.md's afs-fl-005
 * handoff note) is: shop_profile_library.quote_request_id -> quote_requests
 * (whose own quote_id column is set by app/api/admin/quote-requests/[id]/
 * send/route.ts once AFS sends a formal quote) -> quotes.id -> orders.quote_id
 * (set by lib/data/orders.ts's createOrderFromQuote, called only after
 * payment/net-terms placement — see ORDER_LIFECYCLE_DECISION.md). A job with
 * no quote_request_id at all (e.g. a direct FlashDraft admin test send via
 * app/api/studio/send-to-pathfinder/route.ts) or whose quote_request_id
 * hasn't converted to a paid order yet has no real order — that is expected,
 * not an error.
 */
export async function findOrderForShopJob(
  admin: ReturnType<typeof createAdminClient>,
  link: ShopJobOrderLink
): Promise<MatchedOrder | null> {
  const event = link;
  if (event.quoteRequestId) {
    const { data: quoteRequest } = await admin
      .from('quote_requests')
      .select('quote_id')
      .eq('id', event.quoteRequestId)
      .maybeSingle();

    const quoteId = quoteRequest?.quote_id as string | null | undefined;
    if (quoteId) {
      const { data: order } = await admin
        .from('orders')
        .select('id, order_number, tracking_token')
        .eq('quote_id', quoteId)
        .maybeSingle();
      if (order) {
        return { id: order.id as string, orderNumber: order.order_number as string, trackingToken: order.tracking_token as string | null };
      }
    }
  }

  if (event.orderNumber) {
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, tracking_token')
      .eq('order_number', event.orderNumber)
      .maybeSingle();
    if (order) {
      return { id: order.id as string, orderNumber: order.order_number as string, trackingToken: order.tracking_token as string | null };
    }
  }

  return null;
}

/**
 * Fires once a shop_profile_library row successfully transitions to
 * 'complete', from either Shop View's PATCH (app/api/admin/shop-library/
 * [id]/route.ts) or the mobile field/shop "Mark Complete" tap
 * (app/api/field/shop/[id]/complete/route.ts) — both call this after their
 * own status write succeeds, so the automation runs identically regardless
 * of which surface triggered completion. Never throws and never blocks or
 * fails the completion it's attached to: marking a shop job complete must
 * always succeed even when no real order can be found for it.
 *
 * Deliberately does NOT touch orders.status or send dispatch SMS — "job
 * fabrication complete" and "order physically left on a truck" are separate,
 * later events (the existing dispatch button/route).
 */
export async function runShopJobCompletionAutomation(event: ShopJobCompletionEvent): Promise<void> {
  const admin = createAdminClient();

  const order = await findOrderForShopJob(admin, event);
  if (!order) {
    console.error(
      `[Shop Job Completion Automation] shop_profile_library ${event.shopProfileLibraryId} marked complete with no matching real order ` +
        `(quote_request_id: ${event.quoteRequestId ?? 'none'}, order_number: ${event.orderNumber ?? 'none'}) — skipping delivery scheduling and invoice email.`
    );
    return;
  }

  const nowIso = new Date().toISOString();

  const { error: deliveryError } = await admin
    .from('orders')
    .update({ delivery_scheduled_at: nowIso, updated_at: nowIso })
    .eq('id', order.id);
  if (deliveryError) {
    console.error('[Shop Job Completion Automation — Delivery Schedule Error]', deliveryError);
  } else {
    await logAdminAction({
      adminId: event.completedBy,
      action: 'shop_job_completion_schedule_delivery',
      resourceType: 'order',
      resourceId: order.id,
      afterValue: { delivery_scheduled_at: nowIso, shop_profile_library_id: event.shopProfileLibraryId },
    });
  }

  // lib/delivery/tracking-url.ts — the one place this URL is built.
  const trackingUrl = trackingUrlFor(order.trackingToken) ?? undefined;
  const invoiceResult = await sendInvoiceEmail(order.id, trackingUrl);
  if (!invoiceResult.success) {
    console.error(
      `[Shop Job Completion Automation] sendInvoiceEmail failed for order ${order.id} (${order.orderNumber}): ${invoiceResult.error}`
    );
  }
}
