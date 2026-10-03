import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrderFromQuote, type DeliveryAddressInput } from '@/lib/data/orders';
import { validatePoNumber } from '@/lib/checkout/po-number';

let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripe;
}

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
      .select('net_terms, company_id')
      .eq('id', user.id)
      .single();
    const netTerms = (profile?.net_terms as number | undefined) ?? 0;

    if (body.paymentMethod === 'net_terms' && netTerms <= 0) {
      return NextResponse.json({ error: 'Net terms are not available on this account.' }, { status: 403 });
    }

    // ── THE PURCHASE ORDER GUARD ────────────────────────────────────────────
    // THIS IS THE ENFORCEMENT. The checkout page disables Place Order without a
    // required PO, but that is UX: a customer can POST straight to this route.
    //
    // `requirePo` is read from `companies.require_po` for the caller's OWN
    // company — never taken from the request body, which the caller controls.
    // The read goes through the SESSION client so the companies
    // "company_members" RLS policy (001_initial_schema.sql:76) authorises it.
    //
    // TWO QUERIES, NOT A POSTGREST EMBED: profiles and companies are joined by
    // two foreign keys (profiles.company_id and companies.primary_user_id), so
    // an embedded select is ambiguous.
    //
    // KNOWN WEAKNESS, PRE-EXISTING AND MUCH WIDER THAN THIS ROUTE. `profiles`'
    // only write policy is `users_own_profile`, `FOR ALL USING (auth.uid() =
    // id)` with no WITH CHECK (001_initial_schema.sql:51), so a signed-in
    // customer can PATCH any column on their own row — including `company_id`,
    // and therefore out of a company that requires a PO. No migration adds a
    // column-level guard. The same hole lets a customer write their own `role`
    // and `net_terms`, which matters far more than a missing PO; it needs its
    // own item and a human, and is reported rather than patched here. Every
    // legitimate `company_id` write already goes through the service role
    // (app/api/team/invite/route.ts:71,188), so the fix would not break Team
    // Accounts. Do not treat this read as a tenant boundary — it is a business
    // rule about the caller's own paperwork, and the worst case is an order of
    // the customer's own that carries no PO.
    const companyId = (profile?.company_id as string | null | undefined) ?? null;
    let requirePo = false;
    if (companyId) {
      const { data: companyRow, error: companyError } = await supabase
        .from('companies')
        .select('require_po')
        .eq('id', companyId)
        .maybeSingle();
      if (companyError) {
        // Fail open, and say so in the log. The row is one the RLS policy
        // already guarantees this caller can see, so an error here is
        // infrastructural; refusing every order of every company whenever this
        // read hiccups would be a worse outcome than missing a PO on one.
        console.error('[Checkout Create Intent] Could not read companies.require_po', companyError);
      }
      requirePo = companyRow?.require_po === true;
    }

    // ORDERING IS LOAD-BEARING: this runs BEFORE createAdminClient(), BEFORE
    // the net-terms branch that inserts an order, and BEFORE getStripe() —
    // so a rejected checkout creates no PaymentIntent and no order row, and the
    // customer has provably not been charged.
    const poValidation = validatePoNumber(body.poNumber, requirePo);
    if (!poValidation.ok) {
      return NextResponse.json({ error: poValidation.error }, { status: 400 });
    }
    const poNumber = poValidation.value;
    // ────────────────────────────────────────────────────────────────────────

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
        // The validated, trimmed-or-null value — not the raw body field.
        poNumber,
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
      // Validated and trimmed. Stripe caps a metadata value at 500 characters;
      // validatePoNumber has already refused anything over 50, so this can no
      // longer make paymentIntents.create throw. The webhook and
      // confirm-order read it back out with `metadata.poNumber || null`, so ''
      // still means "no PO" on the way home.
      poNumber: poNumber ?? '',
    };
    if (body.deliveryMethod === 'ship' && body.address) {
      metadata.address = body.address.address ?? '';
      metadata.residential = body.address.residential ? 'true' : 'false';
    } else {
      metadata.contactName = body.contactName ?? '';
      metadata.contactPhone = body.contactPhone ?? '';
    }

    const intent = await getStripe().paymentIntents.create({
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
