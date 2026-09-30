/**
 * THE QUOTE PDF AND THE INVOICE PDF — one renderer, one snapshot.
 *
 * "The quote BECOMES the invoice on approval with NO RETYPING of any field" is
 * the v2-03 requirement, and this file is where it is made literally true: both
 * documents are rendered from the SAME `QuoteLine[]` snapshot by the SAME
 * function, with only the heading, the number and the dated lines differing.
 * There is no second layout to drift, and no field anybody could mistype into
 * one but not the other.
 *
 * Built on lib/utils/simple-pdf.ts — this codebase's existing dependency-free
 * PDF writer, already used for the order invoice and the account statement.
 */
import { buildSimplePdf, type SimplePdfLine } from '@/lib/utils/simple-pdf';
import { formatCents } from '@/lib/pricing/quote-math';
import type { QuoteLine } from '@/lib/pricing/types';

export interface DocumentParty {
  name: string | null;
  company: string | null;
  email: string | null;
  poNumber?: string | null;
}

export interface QuoteInvoiceDocument {
  kind: 'quote' | 'invoice';
  /** AFS-Q-000123 or AFS-INV-000123. */
  number: string;
  /** ISO instant the document was issued. */
  issuedAt: string;
  /** Quote: "Valid until". Invoice: "Due". Omitted when there is none. */
  secondaryDate: string | null;
  jobName: string | null;
  party: DocumentParty;
  lines: QuoteLine[];
  subtotalCents: number;
  totalCents: number;
  /** Rendered under the totals; the quote's approve instruction, for instance. */
  footnote: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Fixed-width columns, so the table reads as a table in a monospaced font. */
function tableRow(cells: [string, string, string, string, string]): string {
  return (
    cells[0].slice(0, 30).padEnd(31) +
    cells[1].padStart(4) +
    cells[2].padStart(8) +
    cells[3].padStart(8) +
    cells[4].padStart(13)
  );
}

export function buildQuoteInvoicePdfLines(doc: QuoteInvoiceDocument): SimplePdfLine[] {
  const isQuote = doc.kind === 'quote';
  const lines: SimplePdfLine[] = [];

  lines.push({ text: 'ARCHITECTURAL FLASHING SUPPLY', font: 'bold', size: 15 });
  lines.push({ text: isQuote ? 'QUOTE' : 'INVOICE', font: 'bold', size: 13, spaceBefore: 2 });
  lines.push({ text: '209 Sure Cast Drive, Burnet, TX 78611  ·  (512) 372-4900', size: 9 });

  lines.push({ text: `${isQuote ? 'Quote' : 'Invoice'} #: ${doc.number}`, spaceBefore: 14 });
  lines.push({ text: `Date: ${formatDate(doc.issuedAt)}` });
  if (doc.secondaryDate) {
    lines.push({ text: `${isQuote ? 'Valid until' : 'Due'}: ${formatDate(doc.secondaryDate)}` });
  }
  if (doc.jobName) lines.push({ text: `Job: ${doc.jobName}` });
  if (doc.party.poNumber) lines.push({ text: `PO #: ${doc.party.poNumber}` });

  lines.push({ text: isQuote ? 'Prepared for' : 'Bill to', font: 'bold', size: 11, spaceBefore: 16 });
  lines.push({ text: doc.party.name ?? doc.party.email ?? '—' });
  if (doc.party.company) lines.push({ text: doc.party.company });
  if (doc.party.email) lines.push({ text: doc.party.email });

  lines.push({ text: 'Items', font: 'bold', size: 11, spaceBefore: 18 });
  lines.push({
    text: tableRow(['Description', 'Qty', 'Bends', 'Hems', 'Amount']),
    font: 'mono',
    size: 9,
  });
  for (const line of doc.lines) {
    lines.push({
      text: tableRow([
        line.description,
        String(line.quantity),
        String(line.bendCount),
        String(line.hemCount),
        formatCents(line.lineTotalCents),
      ]),
      font: 'mono',
      size: 9,
    });
    // The spec that produced the price, printed under the line it produced —
    // so a customer querying a number can see what it was built from.
    const spec = [
      line.material,
      line.gauge,
      line.blankWidthIn !== null ? `${line.blankWidthIn.toFixed(2)} in flat` : null,
      line.lengthFt !== null ? `${line.lengthFt} ft lengths` : null,
      `${line.stripsPerSheet} per sheet`,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push({ text: `   ${spec}`, font: 'mono', size: 8 });
  }

  lines.push({ text: `Subtotal: ${formatCents(doc.subtotalCents)}`, font: 'bold', size: 11, spaceBefore: 16 });
  lines.push({ text: `Total: ${formatCents(doc.totalCents)}`, font: 'bold', size: 13 });
  // Freight and tax are DATA BLOCKERS in CLAUDE.md. Saying so beats printing a
  // guessed line item or letting the customer assume the total is final.
  lines.push({
    text: 'Freight and tax are quoted separately once the delivery address is confirmed.',
    size: 9,
    spaceBefore: 6,
  });

  if (doc.footnote) lines.push({ text: doc.footnote, size: 10, spaceBefore: 14 });

  return lines;
}

export function buildQuoteInvoicePdf(doc: QuoteInvoiceDocument): Buffer {
  return buildSimplePdf(buildQuoteInvoicePdfLines(doc));
}
