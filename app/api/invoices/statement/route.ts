import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInvoiceRows, INVOICE_STATUS_LABEL } from '@/lib/data/invoices';
import { buildSimplePdf, type SimplePdfLine } from '@/lib/utils/simple-pdf';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company')
      .eq('id', user.id)
      .single();

    const { searchParams } = request.nextUrl;
    const to = searchParams.get('to') ?? new Date().toISOString();
    const from =
      searchParams.get('from') ??
      new Date(new Date(to).setFullYear(new Date(to).getFullYear() - 1)).toISOString();

    const invoiceRows = await getInvoiceRows(supabase, user.id, { from, to });

    const lines: SimplePdfLine[] = [];
    lines.push({ text: 'AFS — Architectural Flashing Supply', font: 'bold', size: 16 });
    lines.push({ text: 'ACCOUNT STATEMENT', font: 'bold', size: 14, spaceBefore: 4 });
    lines.push({ text: `${profile?.full_name ?? ''}${profile?.company ? ` — ${profile.company}` : ''}`, spaceBefore: 10 });
    lines.push({ text: `Statement period: ${formatDate(from)} – ${formatDate(to)}` });

    lines.push({
      text: 'Date        Invoice #              Status       Amount        Balance',
      font: 'mono',
      size: 9,
      spaceBefore: 18,
    });

    let runningBalance = 0;
    let outstandingTotal = 0;
    for (const row of [...invoiceRows].reverse()) {
      if (row.status !== 'paid') outstandingTotal += row.amount;
      runningBalance += row.status === 'paid' ? 0 : row.amount;
      lines.push({
        text: `${formatDate(row.date).padEnd(12)}${row.invoiceNumber.padEnd(23)}${INVOICE_STATUS_LABEL[row.status].padEnd(
          13
        )}${currency.format(row.amount).padEnd(14)}${currency.format(runningBalance)}`,
        font: 'mono',
        size: 9,
      });
    }

    if (invoiceRows.length === 0) {
      lines.push({ text: 'No invoices in this period.', size: 9 });
    }

    lines.push({ text: `Outstanding Balance: ${currency.format(outstandingTotal)}`, font: 'bold', size: 12, spaceBefore: 16 });

    const pdfBuffer = buildSimplePdf(lines);
    const filename = `AFS-Statement-${formatDate(from).replace(/[,\s]/g, '')}-${formatDate(to).replace(/[,\s]/g, '')}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('[Statement PDF Error]', error);
    return NextResponse.json({ error: 'Could not generate account statement.' }, { status: 500 });
  }
}
