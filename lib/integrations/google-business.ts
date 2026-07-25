/**
 * Google Business Profile (GBP) photo-posting integration.
 *
 * SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §5/§7 — OAuth 2.0 with Google,
 * configured once via /admin/settings/integrations (that settings UI is not
 * built yet). GOOGLE_BUSINESS_CLIENT_ID/SECRET/LOCATION_ID gate whether GBP
 * is considered "configured" at all (drives the Command Center GBP Photos
 * tab's [Post to Google Business] button being disabled, and this route's
 * 503 short-circuit) — same precedent as lib/integrations/quickbooks.ts and
 * lib/integrations/pathfinder-edge.ts.
 *
 * DEVIATION FLAGGED (d-007): a CLIENT_ID/SECRET pair is an OAuth *app*
 * credential, not a bearer access token — actually calling the v4 Media API
 * needs a per-request OAuth access token, which only exists once a real
 * authorization-code exchange + refresh-token flow is built behind
 * /admin/settings/integrations (not built). Until then, GOOGLE_BUSINESS_ACCESS_TOKEN
 * is a manual stand-in env var (paste a token obtained via Google's OAuth
 * Playground or a one-off script) — isGbpConfigured() intentionally does
 * NOT check for it, so the settings-page "configured" state still reflects
 * CLIENT_ID/SECRET/LOCATION_ID per spec; postPhotoToGbp() checks it
 * separately and reports the gap by name if it's missing.
 */

export type GbpResult =
  | { status: 'not_configured'; message: string }
  | { status: 'posted'; message: string }
  | { status: 'error'; message: string };

const NOT_CONFIGURED_MESSAGE =
  'Google Business Profile not configured. Add credentials in /admin/settings/integrations.';

/** True once GOOGLE_BUSINESS_CLIENT_ID/SECRET/LOCATION_ID are all set — gates the Post button and the API route's 503. */
export function isGbpConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_BUSINESS_CLIENT_ID &&
      process.env.GOOGLE_BUSINESS_CLIENT_SECRET &&
      process.env.GOOGLE_BUSINESS_LOCATION_ID
  );
}

/**
 * Posts an already-signed, publicly-fetchable photo URL to the Google My
 * Business API v4.9 media endpoint, per SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md
 * §1's literal request shape. The caller (app/api/gbp/post/[id]/route.ts)
 * is responsible for generating `sourceUrl` from Supabase Storage.
 */
export async function postPhotoToGbp(sourceUrl: string): Promise<GbpResult> {
  if (!isGbpConfigured()) {
    return { status: 'not_configured', message: NOT_CONFIGURED_MESSAGE };
  }

  const accessToken = process.env.GOOGLE_BUSINESS_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      status: 'not_configured',
      message:
        'GOOGLE_BUSINESS_CLIENT_ID/SECRET/LOCATION_ID are set, but GOOGLE_BUSINESS_ACCESS_TOKEN is missing — the real OAuth exchange flow is not built yet (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §5). Add a manually-obtained access token to unblock posting.',
    };
  }

  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;

  try {
    const response = await fetch(`https://mybusiness.googleapis.com/v4/accounts/${locationId}/locations/-/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaFormat: 'PHOTO', sourceUrl, category: 'ADDITIONAL' }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('[GBP Post Error]', response.status, errorBody);
      return { status: 'error', message: `Google Business API returned HTTP ${response.status}.` };
    }

    return { status: 'posted', message: 'Photo posted to Google Business Profile.' };
  } catch (error) {
    console.error('[GBP Post Network Error]', error);
    return { status: 'error', message: 'Could not reach the Google Business API.' };
  }
}
