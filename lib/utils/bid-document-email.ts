import { createAdminClient } from '@/lib/supabase/admin';
import { getBidDocument } from '@/lib/data/bid-documents';
import { logAdminAction } from '@/lib/admin/audit';
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate } from '@/lib/resend/templates/base';
import { generateBidDocumentPDF } from './bid-document-pdf';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export interface SendBidDocumentEmailResult {
  success: boolean;
  error?: string;
  bidNumber?: string;
}

/**
 * Called only from POST /api/admin/bid-documents/[id]/send — an explicit,
 * staff-triggered action (BID_DOCUMENT_SCOPE.md's approval step: pricing
 * must exist and a human must click Send; nothing here fires from autosave).
 * Mirrors sendInvoiceEmail()'s shape: uses the service-role client
 * throughout since a bid document has no customer session to scope against
 * (BID_DOCUMENT_SCOPE.md §1.2 — the recipient is a GC, not an AFS account
 * holder), generates the same PDF the preview route streams, and never
 * throws (ARCHITECTURE.md §9: notification failure must never block the
 * underlying action) — the caller still gets a real success/error result to
 * show the operator, it just isn't surfaced as an unhandled rejection.
 */
export async function sendBidDocumentEmail(bidId: string, actorId: string): Promise<SendBidDocumentEmailResult> {
  const admin = createAdminClient();
  const bid = await getBidDocument(admin, bidId);

  if (!bid) {
    return { success: false, error: 'Bid document not found.' };
  }
  if (!bid.gcContactEmail) {
    return { success: false, error: 'This bid has no GC contact email on file.', bidNumber: bid.bidNumber };
  }
  if (bid.subtotal == null || bid.sections.every((section) => section.lineItems.length === 0)) {
    return { success: false, error: 'Enter at least one priced line item before sending.', bidNumber: bid.bidNumber };
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateBidDocumentPDF(bidId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not generate the bid PDF.';
    await logAdminAction({
      adminId: actorId,
      action: 'bid_document.send_failed',
      resourceType: 'bid_documents',
      resourceId: bidId,
      afterValue: { bidNumber: bid.bidNumber, error: message },
    });
    return { success: false, error: message, bidNumber: bid.bidNumber };
  }

  const html = baseEmailTemplate(`
    <h1 style="font-size:20px;margin:0 0 16px;">Bid Proposal Attached</h1>
    <p style="margin:0 0 12px;">Hi ${bid.gcContactName ?? 'there'},</p>
    <p style="margin:0 0 12px;">
      Attached is our bid proposal <strong>${bid.bidNumber}</strong> for
      <strong>${bid.projectName}</strong>, totaling
      <strong>${bid.subtotal != null ? currency.format(bid.subtotal) : '—'}</strong>.
    </p>
    <p style="margin:0;">Questions about this bid? Just reply to this email.</p>
  `);

  const result = await sendEmail({
    to: bid.gcContactEmail,
    subject: `AFS Bid Proposal — ${bid.bidNumber} — ${bid.projectName}`,
    html,
    attachments: [{ filename: `${bid.bidNumber}.pdf`, content: pdfBuffer }],
  });

  if (result.success) {
    await admin
      .from('bid_documents')
      .update({ status: 'sent', sent_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
      .eq('id', bidId);
  }

  await logAdminAction({
    adminId: actorId,
    action: result.success ? 'bid_document.sent' : 'bid_document.send_failed',
    resourceType: 'bid_documents',
    resourceId: bidId,
    afterValue: {
      bidNumber: bid.bidNumber,
      gcContactEmail: bid.gcContactEmail,
      subtotal: bid.subtotal,
      error: result.success ? null : result.error,
    },
  });

  return { success: result.success, error: result.error, bidNumber: bid.bidNumber };
}
