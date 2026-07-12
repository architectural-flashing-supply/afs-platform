import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrderFromQuote, type DeliveryAddressInput } from '@/lib/data/orders';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface CreateIntentRequestBody {
  quoteId: string;
  paymentMethod: 'card' | 'net_terms';
  deliveryMethod: 'ship' | 'pickup';
  address?: DeliveryAddressInput;
  contactName?: string;
  contactPhone?: string;
  poNumber?: string | null;
}

interface QuoteForCheckout {
  id: string;
  user_id: string;
  status: string;
  total: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Partial<CreateIntentRequestBody>;

    if (!body.quoteId || typeof body.quoteId !== 'string') {
      return NextResponse.json({ error: 'A quote is required.' }, { status: 400 });
    }
    if (body.paymentMethod !== 'card' && body.paymentMethod !== 'net_terms') {
      return NextResponse.json({ error: 'Select a valid payment method.' }, { status: 400 });
    }
    if (body.deliveryMethod !== 'ship' && body.deliveryMethod !== 'pickup') {
      return NextResponse.json({ error: 'Select a valid delivery method.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to place this order.' }, { status: 401 });
    }

    const { data: quoteRaw, error: quoteError } = await supabase
      .from('quotes')
      .select('id, user_id, status, total')
      .eq('id', body.quoteId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (quoteError || !quoteRaw) {
      return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
    }
    const quote = quoteRaw as QuoteForCheckout;

    if (quote.status === 'converted') {
      return NextResponse.json(
        { error: 'This quote has already been placed as an order.' },
        { status: 409 }
      );
    }
    if (quote.status === 'expired') {
      return NextResponse.json(
        { error: 'This quote has expired. Request a new quote.' },
        { status: 409 }
      );
    }
    if (quote.status !== 'sent') {
      return NextResponse.json({ error: 'This quote is not available for payment.' }, { status: 409 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('net_terms')
      .eq('id', user.id)
      .single();
    const netTerms = (profile?.net_terms as number | undefined) ?? 0;

    if (body.paymentMethod === 'net_terms' && netTerms <= 0) {
      return NextResponse.json({ error: 'Net terms are not available on this account.' }, { status: 403 });
    }

    const admin = createAdminClient();

    if (body.paymentMethod === 'net_terms') {
      const created = await createOrderFromQuote(admin, {
        quoteId: quote.id,
        userId: user.id,
        paymentMethod: 'net_terms',
        netTerms,
        deliveryMethod: body.deliveryMethod,
        deliveryAddress: body.deliveryMethod === 'ship' ? body.address ?? null : null,
        contactName: body.deliveryMethod === 'pickup' ? body.contactName ?? null : null,
        contactPhone: body.deliveryMethod === 'pickup' ? body.contactPhone ?? null : null,
        poNumber: body.poNumber ?? null,
        stripePaymentIntentId: null,
      });
      if (!created) {
        return NextResponse.json({ error: 'Could not place order. Please try again.' }, { status: 500 });
      }
      return NextResponse.json({
        requiresPayment: false,
        orderId: created.orderId,
        orderNumber: created.orderNumber,
      });
    }

    const metadata: Record<string, string> = {
      quoteId: quote.id,
      userId: user.id,
      deliveryMethod: body.deliveryMethod,
      poNumber: body.poNumber ?? '',
    };
    if (body.deliveryMethod === 'ship' && body.address) {
      metadata.address = body.address.address ?? '';
      metadata.residential = body.address.residential ? 'true' : 'false';
    } else {
      metadata.contactName = body.contactName ?? '';
      metadata.contactPhone = body.contactPhone ?? '';
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(quote.total * 100),
      currency: 'usd',
      metadata,
    });

    return NextResponse.json({
      requiresPayment: true,
      clientSecret: intent.client_secret,
      orderTotal: quote.total,
    });
  } catch (error) {
    console.error('[Checkout Create Intent Error]', error);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
