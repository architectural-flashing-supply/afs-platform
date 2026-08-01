import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';
import { getBidDocument } from '@/lib/data/bid-documents';
import { generateBidDocumentPDF } from '@/lib/utils/bid-document-pdf';

/**
 * The "generate the PDF for review" approval step (BID_DOCUMENT_SCOPE.md's
 * successor — this codebase already has a real PDF generator, so this
 * replaces that document's §7.3 browser-print-only plan): any operator/
 * admin can preview the current pricing as a real PDF before anyone clicks
 * Send. Streamed inline (not as an attachment) so it opens directly in the
 * browser tab the "Preview PDF" link opens.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const bid = await getBidDocument(supabase, params.id);
    if (!bid) {
      return NextResponse.json({ error: 'Bid document not found.' }, { status: 404 });
    }

    const pdfBuffer = await generateBidDocumentPDF(params.id);

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${bid.bidNumber}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('[Bid Document PDF Error]', error);
    return NextResponse.json({ error: 'Could not generate bid PDF.' }, { status: 500 });
  }
}
