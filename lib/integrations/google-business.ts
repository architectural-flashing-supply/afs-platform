/**
 * Google Business Profile (GBP) photo-posting integration stub.
 *
 * SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §5 — OAuth 2.0 with Google,
 * configured once via /admin/settings/integrations (not yet built). No
 * GOOGLE_BUSINESS_CLIENT_ID/SECRET/LOCATION_ID are present in this
 * environment, so this mirrors lib/integrations/quickbooks.ts's exact stub
 * pattern: every export returns a stable "not_configured" result and makes
 * zero network calls. isGbpConfigured() is the one live check — it drives
 * the Command Center GBP Photos tab's [Post to Google Business] button
 * being disabled per the task's explicit requirement.
 */

export type GbpResult = { status: 'not_configured'; message: string } | { status: 'posted'; message: string };

const NOT_CONFIGURED: GbpResult = {
  status: 'not_configured',
  message: 'Google Business Profile integration not yet configured',
};

/** True once real GOOGLE_BUSINESS_* credentials are set — gates the Post button, nothing else. */
export function isGbpConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID &&
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET &&
      process.env.GOOGLE_BUSINESS_LOCATION_ID
  );
}

export async function postPhotoToGbp(_photoId: string): Promise<GbpResult> {
  if (!isGbpConfigured()) return NOT_CONFIGURED;
  // Real POST to accounts/{accountId}/locations/{locationId}/media (Google My
  // Business API v4.9) would go here once OAuth is actually wired up —
  // intentionally not built against fabricated request/response shapes.
  return NOT_CONFIGURED;
}
