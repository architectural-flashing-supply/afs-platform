/**
 * THE CUSTOMER'S TRACKING LINK — one formula, one file.
 *
 * `${getSiteUrl()}/track/${orders.tracking_token}` is not new in v2-04. It was
 * already written out by hand in three places:
 *
 *   app/api/orders/[id]/dispatch/route.ts:110   (the "on the way" email + SMS)
 *   app/api/driver/location/route.ts:153        (the 10-miles-away text)
 *   lib/utils/shop-job-completion.ts:124        (the invoice email's button)
 *
 * The Deliveries screen needed a fourth, which is one more than a formula
 * should have. So rather than adding an equivalent, the three existing copies
 * now call this — the reuse the prompt asked for, made literal instead of
 * duplicated. The URL, the route it points at (app/track/[orderId] and
 * app/api/track/[token], backed by 007_delivery_tracking.sql's SECURITY
 * DEFINER get_tracking_data()) and the token column are all unchanged.
 *
 * WHY IT TAKES A TOKEN AND NOT AN ORDER. The token is the whole credential:
 * `orders.tracking_token` defaults to `gen_random_uuid()::text` and the public
 * page's only input is that string. Passing an order object in would invite a
 * caller to pass an order that has no token, which is the one case that must
 * return null rather than a link to `/track/null`.
 *
 * getSiteUrl() rather than a literal host — CLAUDE.md rule #9.
 */
import { getSiteUrl } from '@/lib/site-url';

/**
 * The absolute tracking URL for a token, or null when there is no token.
 *
 * Null is a real answer and callers must handle it: a V2 Job that never became
 * a paid `orders` row has nothing to track, and a notification that links to a
 * dead page is worse than one that simply gives the day and the window.
 */
export function trackingUrlFor(trackingToken: string | null | undefined): string | null {
  const token = typeof trackingToken === 'string' ? trackingToken.trim() : '';
  if (token === '') return null;
  return `${getSiteUrl()}/track/${encodeURIComponent(token)}`;
}
