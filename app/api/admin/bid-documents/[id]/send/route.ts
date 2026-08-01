import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { sendBidDocumentEmail } from '@/lib/utils/bid-document-email';

/**
 * "Send this bid to the customer" (BID_DOCUMENT_SCOPE.md's approval step,
 * final action) — real Resend delivery via sendBidDocumentEmail(), which
 * validates pricing exists and a GC contact email is on file before
 * generating the PDF and emailing it. Distinct from the plain status PATCH
 * on app/api/admin/bid-documents/[id]/route.ts: that route can still flip
 * status directly (Won/Lost/Withdrawn/Expired — no email involved), but the
 * draft → sent transition now always goes through this route so "sent"
 * means the GC actually received the PDF, not just that someone clicked a
 * button.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const result = await sendBidDocumentEmail(params.id, auth.userId);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Could not send this bid.' }, { status: 400 });
    }

    return NextResponse.json({ sent: true, bidNumber: result.bidNumber });
  } catch (error) {
    console.error('[Bid Document Send Error]', error);
    return NextResponse.json({ error: 'Could not send this bid. Please try again.' }, { status: 500 });
  }
}
