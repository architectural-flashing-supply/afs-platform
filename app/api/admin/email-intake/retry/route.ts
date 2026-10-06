import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/email-intake/pipeline';
import { buildProductionDeps, getAdminCaller } from '@/lib/email-intake/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

/** Re-run a stored message that failed (or was stored but never processed). Safe to click twice: it is idempotent. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getAdminCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { messageId?: string; force?: boolean } | null;
  if (!body?.messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
  if (body.force) {
    // Admin override for a message wrongly classified as "ignored": mark it fresh so the pipeline re-evaluates it.
    await createAdminClient().from('email_messages').update({ status: 'received', error: null }).eq('id', body.messageId).in('status', ['ignored', 'failed']);
  }
  const outcome = await processMessage(body.messageId, buildProductionDeps(), { forceOrder: Boolean(body.force) });
  return NextResponse.json(outcome);
}
