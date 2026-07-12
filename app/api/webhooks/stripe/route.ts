import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrderFromQuote, type DeliveryAddressInput } from '@/lib/data/orders';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const metadata = paymentIntent.metadata;
  const quoteId = metadata.quoteId;
  const userId = metadata.userId;
  if (!quoteId || !userId) {
    console.error('[Stripe Webhook] payment_intent.succeeded missing quoteId/userId metadata', paymentIntent.id);
    return;
  }

  const deliveryMethod = metadata.deliveryMethod === 'pickup' ? 'pickup' : 'ship';
  const deliveryAddress: DeliveryAddressInput | null =
    deliveryMethod === 'ship'
      ? { address: metadata.address ?? '', residential: metadata.residential === 'true' }
      : null;

  const admin = createAdminClient();
  await createOrderFromQuote(admin, {
    quoteId,
    userId,
    paymentMethod: 'card',
    netTerms: 0,
    deliveryMethod,
    deliveryAddress,
    contactName: deliveryMethod === 'pickup' ? metadata.contactName ?? null : null,
    contactPhone: deliveryMethod === 'pickup' ? metadata.contactPhone ?? null : null,
    poNumber: metadata.poNumber || null,
    stripePaymentIntentId: paymentIntent.id,
  });
}

function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): void {
  console.error(
    '[Stripe Webhook] payment_intent.payment_failed',
    paymentIntent.id,
    paymentIntent.last_payment_error?.message ?? 'Unknown error'
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    console.error('[Stripe Webhook] Invalid signature', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('[Stripe Webhook] Handler error', error);
    return NextResponse.json({ error: 'Webhook handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
