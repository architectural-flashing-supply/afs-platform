import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrderFromQuote, type DeliveryAddressInput } from '@/lib/data/orders';

let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripe;
}

interface ConfirmOrderRequestBody {
  paymentIntentId: string;
}

/**
 * Synchronous fallback for card-payment order creation, called from the client
 * immediately after stripe.confirmCardPayment resolves. The Stripe webhook
 * (app/api/webhooks/stripe/route.ts) remains the primary, authoritative path —
 * this route exists only to give the browser a real orderId/orderNumber in the
 * common case, since createOrderFromQuote() is idempotent on quote_id and safe
 * to call whether or not the webhook has already fired (see
 * ORDER_LIFECYCLE_DECISION.md §4).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Partial<ConfirmOrderRequestBody>;
    if (!body.paymentIntentId || typeof body.paymentIntentId !== 'string') {
      return NextResponse.json({ error: 'A payment intent is required.' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const paymentIntent = await getStripe().paymentIntents.retrieve(body.paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment has not succeeded.' }, { status: 400 });
    }

    const metadata = paymentIntent.metadata;
    if (metadata.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const quoteId = metadata.quoteId;
    if (!quoteId) {
      return NextResponse.json({ error: 'Payment intent is missing quote metadata.' }, { status: 400 });
    }

    const deliveryMethod = metadata.deliveryMethod === 'pickup' ? 'pickup' : 'ship';
    const deliveryAddress: DeliveryAddressInput | null =
      deliveryMethod === 'ship'
        ? { address: metadata.address ?? '', residential: metadata.residential === 'true' }
        : null;

    const admin = createAdminClient();
    const created = await createOrderFromQuote(admin, {
      quoteId,
      userId: user.id,
      paymentMethod: 'card',
      netTerms: 0,
      deliveryMethod,
      deliveryAddress,
      contactName: deliveryMethod === 'pickup' ? metadata.contactName ?? null : null,
      contactPhone: deliveryMethod === 'pickup' ? metadata.contactPhone ?? null : null,
      poNumber: metadata.poNumber || null,
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!created) {
      return NextResponse.json({ error: 'Could not confirm order.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: created.orderId, orderNumber: created.orderNumber });
  } catch (error) {
    console.error('[Checkout Confirm Order Error]', error);
    return NextResponse.json({ error: 'Could not confirm order.' }, { status: 500 });
  }
}
