import { readFileSync } from 'fs';
import path from 'path';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBidDocument, type BidDocumentDetail } from '@/lib/data/bid-documents';
import { buildSimplePdf, PAGE_WIDTH, MARGIN_LEFT, type SimplePdfLine, type SimplePdfLogo } from './simple-pdf';
import { decodePng, downsamplePngBoxFilter, type DecodedPng } from './png-decode';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Read once per server process, not per request — the logo file never
// changes at runtime. public/afs-logo-512.png is a real 1024×1024 RGBA PNG
// (CLAUDE.md rule: use the exact asset already present, never generate or
// substitute a different logo); it's downsampled 4x (→256×256) before
// embedding since a print-sized letterhead logo doesn't need source
// resolution this high, and the smaller raster keeps the generated PDF (and
// its Resend email attachment) a reasonable size.
let cachedLogo: DecodedPng | null = null;
function getAfsLogoPng(): DecodedPng {
  if (!cachedLogo) {
    const buffer = readFileSync(path.join(process.cwd(), 'public', 'afs-logo-512.png'));
    cachedLogo = downsamplePngBoxFilter(decodePng(buffer), 4);
  }
  return cachedLogo;
}

const LOGO_DISPLAY_SIZE = 54;

function buildLogo(): SimplePdfLogo {
  const png = getAfsLogoPng();
  return {
    image: png,
    x: PAGE_WIDTH - MARGIN_LEFT - LOGO_DISPLAY_SIZE, // top-right, flush with the same margin the text uses
    yFromTop: 40,
    width: LOGO_DISPLAY_SIZE,
    height: LOGO_DISPLAY_SIZE,
  };
}

/**
 * Shared by app/api/admin/bid-documents/[id]/pdf/route.ts (the "generate
 * for review" preview step, BID_DOCUMENT_SCOPE.md's approval-step
 * successor) and generateBidDocumentPDF() below (used again by the actual
 * Resend send), so the document layout is defined exactly once — same
 * split as buildInvoicePdfLines/generateInvoicePDF.
 *
 * Bid line items are hand-priced qty/spec/unit-price rows grouped under a
 * free-text work-description heading (BID_DOCUMENT_SCOPE.md §1.1) — there
 * is no profile/material/gauge to render, only what a human estimator
 * actually typed.
 */
export function buildBidDocumentPdfLines(bid: BidDocumentDetail): SimplePdfLine[] {
  const lines: SimplePdfLine[] = [];

  lines.push({ text: 'ARCHITECTURAL FLASHING SUPPLY — BID PROPOSAL', font: 'bold', size: 15 });
  lines.push({ text: `Bid #: ${bid.bidNumber}`, spaceBefore: 10 });
  lines.push({ text: `Date: ${formatDate(bid.createdAt)}` });
  if (bid.priceValidUntil) {
    lines.push({ text: `Price Valid Until: ${formatDate(bid.priceValidUntil)}` });
  }

  lines.push({ text: 'Project', font: 'bold', size: 11, spaceBefore: 18 });
  lines.push({ text: bid.projectName });
  if (bid.projectLocation) lines.push({ text: bid.projectLocation });

  lines.push({ text: 'Submitted To', font: 'bold', size: 11, spaceBefore: 18 });
  lines.push({ text: bid.gcName });
  if (bid.gcContactName) lines.push({ text: bid.gcContactName });
  if (bid.gcContactEmail) lines.push({ text: bid.gcContactEmail });
  if (bid.gcContactPhone) lines.push({ text: bid.gcContactPhone });

  lines.push({ text: 'Bid Line Items', font: 'bold', size: 11, spaceBefore: 18 });
  if (bid.sections.length === 0) {
    lines.push({ text: 'No line items entered yet.', size: 9, spaceBefore: 4 });
  } else {
    lines.push({ text: 'Qty        Unit    Unit Price      Extended', font: 'mono', size: 9, spaceBefore: 4 });
    for (const section of bid.sections) {
      lines.push({ text: section.workDescription, font: 'bold', size: 10, spaceBefore: 12 });
      for (const item of section.lineItems) {
        lines.push({ text: item.specText, size: 9, spaceBefore: 6 });
        lines.push({
          text: `${String(item.quantity).padEnd(10)} ${item.unit.padEnd(7)} ${currency
            .format(item.unitPrice)
            .padEnd(15)} ${currency.format(item.extendedPrice)}`,
          font: 'mono',
          size: 9,
        });
      }
    }
  }

  lines.push({
    text: `Subtotal: ${bid.subtotal != null ? currency.format(bid.subtotal) : '—'}`,
    font: 'bold',
    size: 12,
    spaceBefore: 16,
  });

  lines.push({ text: bid.taxNote, size: 9, spaceBefore: 18 });
  if (bid.deliveryTerms) {
    lines.push({ text: `Delivery Terms: ${bid.deliveryTerms}`, size: 9, spaceBefore: 4 });
  }
  if (bid.priceValidUntil) {
    lines.push({ text: `This bid is valid until ${formatDate(bid.priceValidUntil)}.`, size: 9, spaceBefore: 4 });
  }

  if (bid.customerNote) {
    lines.push({ text: 'Note', font: 'bold', size: 11, spaceBefore: 18 });
    lines.push({ text: bid.customerNote, size: 9 });
  }

  lines.push({ text: 'Thank you for the opportunity to bid this project.', font: 'bold', size: 10, spaceBefore: 18 });

  return lines;
}

/**
 * Admin/operator-triggered generation — mirrors generateInvoicePDF()'s own
 * doc comment: no per-user session to scope against (the caller already ran
 * requireOperatorApi()), reads via the service-role client rather than a
 * customer-session-scoped one, since a bid document has no customer/account
 * owner at all (BID_DOCUMENT_SCOPE.md §1.2).
 */
export async function generateBidDocumentPDF(bidId: string): Promise<Buffer> {
  const admin = createAdminClient();
  const bid = await getBidDocument(admin, bidId);
  if (!bid) {
    throw new Error('Bid document not found.');
  }

  const lines = buildBidDocumentPdfLines(bid);
  return buildSimplePdf(lines, { logo: buildLogo() });
}
