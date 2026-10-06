import { NextRequest, NextResponse } from 'next/server';
import { receiveEmail } from '@/lib/email-intake/pipeline';
import { buildProductionDeps } from '@/lib/email-intake/server';
import { createGraphClient, fetchGraphEmail, readGraphConfig, verifyNotification, type GraphNotification } from '@/lib/email-intake/sources/graph';

export const maxDuration = 300;

/**
 * Microsoft Graph change-notification endpoint for Steve's mailbox.
 *
 * DORMANT until the Entra app registration exists (OUTLOOK_* env vars). Until then it answers the subscription
 * validation handshake (which needs no credentials) and returns 503 for real notifications, so nothing is
 * half-processed. When the env vars are set it is live with no code change.
 * Idempotent: Graph retries notifications, and the pipeline dedupes on Message-ID.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Subscription validation: Graph POSTs ?validationToken=... and expects it echoed as text/plain within 10 s.
  const token = request.nextUrl.searchParams.get('validationToken');
  if (token) return new NextResponse(token, { status: 200, headers: { 'content-type': 'text/plain' } });

  const cfg = readGraphConfig();
  if (!cfg) return NextResponse.json({ error: 'Outlook is not configured yet.' }, { status: 503 });

  let body: { value?: GraphNotification[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const notes = (body.value ?? []).filter((n) => verifyNotification(n, cfg.clientState) && n.resourceData?.id);
  if (notes.length === 0) return NextResponse.json({ error: 'No valid notifications' }, { status: 202 });

  const client = createGraphClient(cfg);
  const deps = buildProductionDeps();
  const results: string[] = [];
  for (const n of notes) {
    try {
      const email = await fetchGraphEmail(client, n.resourceData!.id as string);
      const out = await receiveEmail(email, deps);
      results.push(out.status);
    } catch (e) {
      // Never throw back to Graph: a non-2xx makes it retry-storm. The failure is logged; the admin intake page
      // shows any message that was stored but not processed, with a Retry button.
      console.error('[Outlook Webhook] message failed', e);
      results.push('failed');
    }
  }
  return NextResponse.json({ processed: results }, { status: 202 });
}
