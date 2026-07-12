import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeLineTotal, round2 } from '@/lib/admin/pricing';

interface SendLineItemInput {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

interface QuoteRequestSource {
  id: string;
  request_number: string;
  status: string;
  user_id: string | null;
}

function isValidLineItem(item: unknown): item is SendLineItemInput {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.profileType === 'string' &&
    i.profileType.trim().length > 0 &&
    typeof i.lengthFt === 'number' &&
    i.lengthFt > 0 &&
    typeof i.quantity === 'number' &&
    i.quantity > 0 &&
    typeof i.unitPrice === 'number' &&
    i.unitPrice > 0
  );
}

function describeItem(item: SendLineItemInput): string {
  const parts = [item.profileType];
  if (item.material) parts.push(item.material);
  if (item.gauge) parts.push(item.gauge);
  return parts.join(' — ');
}

async function nextQuoteNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AFS-Q-${year}-`;

  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1);

  const last = data?.[0]?.quote_number as string | undefined;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const rawItems = body.lineItems;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 });
    }
    if (!rawItems.every(isValidLineItem)) {
      return NextResponse.json(
        { error: 'Every line item needs a unit price greater than $0.' },
        { status: 400 }
      );
    }
    const lineItems = rawItems as SendLineItemInput[];

    const freight =
      typeof body.freight === 'number' && Number.isFinite(body.freight) && body.freight >= 0 ? body.freight : null;
    const estimatorNotes = typeof body.estimatorNotes === 'string' ? body.estimatorNotes : null;

    const { data: requestRaw, error: requestError } = await supabase
      .from('quote_requests')
      .select('id, request_number, status, user_id')
      .eq('id', params.id)
      .maybeSingle();

    if (requestError || !requestRaw) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }
    const quoteRequest = requestRaw as QuoteRequestSource;

    if (quoteRequest.status === 'quoted') {
      return NextResponse.json({ error: 'This request has already been quoted.' }, { status: 409 });
    }
    if (quoteRequest.status === 'cancelled' || quoteRequest.status === 'expired') {
      return NextResponse.json({ error: 'This request can no longer be quoted.' }, { status: 409 });
    }
    if (!quoteRequest.user_id) {
      return NextResponse.json(
        { error: 'This request was submitted as a guest and has no account to receive a formal quote.' },
        { status: 400 }
      );
    }

    const subtotal = round2(
      lineItems.reduce((sum, item) => sum + computeLineTotal(item.unitPrice, item.quantity, item.lengthFt), 0)
    );
    const total = round2(subtotal + (freight ?? 0));

    const quoteNumber = await nextQuoteNumber(supabase);
    const now = new Date().toISOString();

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        request_id: quoteRequest.id,
        user_id: quoteRequest.user_id,
        status: 'sent',
        subtotal,
        freight,
        rush_surcharge: 0,
        tax: null,
        total,
        estimator_notes: estimatorNotes,
        created_by: user.id,
        sent_at: now,
      })
      .select('id, quote_number')
      .single();

    if (quoteError || !quote) {
      console.error('[Admin Send Quote Error]', quoteError);
      return NextResponse.json({ error: 'Could not create the quote. Please try again.' }, { status: 500 });
    }

    const quoteLineItems = lineItems.map((item, index) => ({
      quote_id: quote.id,
      description: describeItem(item),
      width_in: item.width ?? null,
      height_in: item.height ?? null,
      leg_a_in: item.legA ?? null,
      leg_b_in: item.legB ?? null,
      length_ft: item.lengthFt,
      quantity: item.quantity,
      unit: item.unit ?? 'LF',
      unit_price: item.unitPrice,
      line_total: computeLineTotal(item.unitPrice, item.quantity, item.lengthFt),
      sort_order: index,
    }));

    const { error: lineItemsError } = await supabase.from('quote_line_items').insert(quoteLineItems);
    if (lineItemsError) {
      console.error('[Admin Send Quote Line Items Error]', lineItemsError);
      return NextResponse.json({ error: 'Could not save quote line items. Please try again.' }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('quote_requests')
      .update({ status: 'quoted', quoted_at: now, quote_id: quote.id })
      .eq('id', quoteRequest.id);
    if (updateError) {
      console.error('[Admin Send Quote Request Update Error]', updateError);
    }

    // Notification failure must never block the quote from being sent (ARCHITECTURE.md section 9).
    try {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', quoteRequest.user_id)
        .single();
      await supabase.from('notifications').insert({
        user_id: quoteRequest.user_id,
        channel: 'email',
        type: 'quote_sent',
        recipient: (customerProfile?.email as string | undefined) ?? '',
        status: 'sent',
      });
    } catch (notifyError) {
      console.error('[Admin Send Quote Notification Error]', notifyError);
    }

    return NextResponse.json({ quoteId: quote.id, quoteNumber: quote.quote_number });
  } catch (error) {
    console.error('[Admin Send Quote Error]', error);
    return NextResponse.json({ error: 'Could not send this quote. Please try again.' }, { status: 500 });
  }
}
