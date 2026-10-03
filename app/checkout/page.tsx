'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import PoNumberField from '@/components/checkout/PoNumberField';
import { CHECKOUT_INPUT_CLASS, CHECKOUT_LABEL_CLASS } from '@/components/checkout/field-classes';
import { PO_REQUIRED_ERROR, isPoNumberSatisfied, normalizePoNumber } from '@/lib/checkout/po-number';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

// Stripe's CardElement renders inside a cross-origin iframe and reads this style
// object directly (not CSS), so afs-* Tailwind classes and var(--afs-*) refs can't
// reach it — these must stay literal hex. Values mirror the afs-* tokens defined in
// app/globals.css; keep in sync if those tokens change.
const STRIPE_CARD_ELEMENT_COLORS = {
  bgRaised: '#363C4A', // --afs-bg-raised
  chromeMid: '#B8BFD0', // --afs-chrome-mid
  chromeDim: '#7A8299', // --afs-chrome-dim
  crimsonHover: '#E8001F', // --afs-crimson-hover
};

type LoadState = 'loading' | 'error' | 'ready';
type DeliveryMethod = 'ship' | 'pickup';
type PaymentMethod = 'card' | 'net_terms';

interface QuoteLineItem {
  id: string;
  description: string;
  length_ft: number;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  subtotal: number;
  freight: number | null;
  rush_surcharge: number;
  tax: number | null;
  total: number;
}

interface OrderSuccess {
  orderId: string | null;
  orderNumber: string | null;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Moved to components/checkout/field-classes.ts when the PO Number input was
// extracted into its own component — one definition, shared, rather than two
// literals that must stay identical with nothing keeping them that way. The
// values are unchanged; these aliases keep the rest of this file's JSX as it
// was.
const inputClass = CHECKOUT_INPUT_CLASS;
const labelClass = CHECKOUT_LABEL_CLASS;

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[600px] mx-auto text-center py-24">
          <p className="font-label text-sm text-afs-chrome-mid uppercase tracking-wide">Loading checkout…</p>
        </div>
      }
    >
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quoteId = searchParams.get('quote');

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [netTerms, setNetTerms] = useState(0);
  const [requirePo, setRequirePo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!quoteId) {
        setLoadError('A quote is required to check out.');
        setLoadState('error');
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent(`/checkout?quote=${quoteId}`)}`);
        return;
      }

      const { data: quoteRow } = await supabase
        .from('quotes')
        .select('id, quote_number, status, subtotal, freight, rush_surcharge, tax, total')
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!quoteRow) {
        setLoadError('Quote not found.');
        setLoadState('error');
        return;
      }
      if (quoteRow.status === 'converted') {
        setLoadError('This quote has already been placed as an order.');
        setLoadState('error');
        return;
      }
      if (quoteRow.status === 'expired') {
        setLoadError('This quote has expired. Request a new quote.');
        setLoadState('error');
        return;
      }
      if (quoteRow.status !== 'sent') {
        setLoadError('This quote is not yet available for checkout.');
        setLoadState('error');
        return;
      }

      const { data: lineItemRows } = await supabase
        .from('quote_line_items')
        .select('id, description, length_ft, quantity, unit, unit_price, line_total')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('net_terms, company_id')
        .eq('id', user.id)
        .single();

      // SPEC_PURCHASE_ORDER_INTEGRATION.md §2: the PO field is "Required if:
      // companies.require_po = true for user's company".
      //
      // Read through the SESSION client, so the companies "company_members" RLS
      // policy (001_initial_schema.sql:76) is what authorises it — a customer
      // can only ever see their own company's row.
      //
      // TWO QUERIES, NOT A POSTGREST EMBED: `profiles` and `companies` are
      // joined by two foreign keys (profiles.company_id -> companies.id and
      // companies.primary_user_id -> profiles.id), which makes an embedded
      // select ambiguous.
      const companyId = (profileRow?.company_id as string | null | undefined) ?? null;
      let companyRequiresPo = false;
      if (companyId) {
        const { data: companyRow } = await supabase
          .from('companies')
          .select('require_po')
          .eq('id', companyId)
          .maybeSingle();
        // A failed or missing read resolves to "not required". The server is the
        // enforcement point (app/api/checkout/create-intent/route.ts re-reads
        // this and refuses), so guessing false can only fail to warn early —
        // whereas guessing true would block a customer who has no requirement
        // at all, which is the worse failure.
        companyRequiresPo = companyRow?.require_po === true;
      }

      if (cancelled) return;

      setQuote(quoteRow as QuoteData);
      setLineItems((lineItemRows ?? []) as QuoteLineItem[]);
      setNetTerms((profileRow?.net_terms as number | undefined) ?? 0);
      setRequirePo(companyRequiresPo);
      setLoadState('ready');
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [quoteId, router]);

  if (loadState === 'loading') {
    return (
      <div className="max-w-[600px] mx-auto text-center py-24">
        <p className="font-label text-sm text-afs-chrome-mid uppercase tracking-wide">Loading checkout…</p>
      </div>
    );
  }

  if (loadState === 'error' || !quote) {
    return (
      <div className="max-w-[600px] mx-auto py-16">
        <div className="bg-afs-bg-raised border border-afs-crimson rounded p-8 text-center">
          <h1 className="font-heading text-2xl text-afs-chrome-high mb-3">Checkout Unavailable</h1>
          <p className="font-body text-sm text-afs-chrome-mid mb-6">{loadError}</p>
          <Link
            href="/account/quotes"
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors inline-block"
          >
            Back to My Quotes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm quote={quote} lineItems={lineItems} netTerms={netTerms} requirePo={requirePo} />
    </Elements>
  );
}

function CheckoutForm({
  quote,
  lineItems,
  netTerms,
  requirePo,
}: {
  quote: QuoteData;
  lineItems: QuoteLineItem[];
  netTerms: number;
  /** `companies.require_po` for this customer's company; false when they have none. */
  requirePo: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('ship');
  const [address, setAddress] = useState('');
  const [residential, setResidential] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardFocused, setCardFocused] = useState(false);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [noReturns, setNoReturns] = useState(false);
  const [specsFinal, setSpecsFinal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccess | null>(null);

  const legalComplete = acceptTerms && noReturns && specsFinal;
  const deliveryComplete =
    deliveryMethod === 'ship' ? address.trim().length > 0 : contactName.trim().length > 0 && contactPhone.trim().length > 0;
  const paymentComplete = paymentMethod === 'net_terms' ? true : cardComplete;
  // SPEC §3: "If user attempts submit without PO: ... Submit blocked".
  // When requirePo is false this term is constantly true, so gating is
  // arithmetically identical to before this feature existed. This is UX only —
  // the create-intent route re-reads require_po and refuses independently, so a
  // direct POST cannot get past it.
  const poComplete = isPoNumberSatisfied(poNumber, requirePo);
  const canSubmit = legalComplete && deliveryComplete && poComplete && paymentComplete && !submitting;

  const handlePlaceOrder = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/checkout/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          paymentMethod,
          deliveryMethod,
          address: deliveryMethod === 'ship' ? { address, residential } : undefined,
          contactName: deliveryMethod === 'pickup' ? contactName : undefined,
          contactPhone: deliveryMethod === 'pickup' ? contactPhone : undefined,
          // Trimmed-or-null, so '', '   ' and a missing field all reach
          // orders.po_number as one state instead of three.
          poNumber: normalizePoNumber(poNumber),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSubmitError(data.error ?? 'Could not place order. Please try again.');
        setSubmitting(false);
        return;
      }

      if (!data.requiresPayment) {
        setOrderSuccess({ orderId: data.orderId ?? null, orderNumber: data.orderNumber ?? null });
        setSubmitting(false);
        return;
      }

      if (!stripe || !elements) {
        setSubmitError('Payment could not be initialized. Please try again.');
        setSubmitting(false);
        return;
      }
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setSubmitError('Payment could not be initialized. Please try again.');
        setSubmitting(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElement },
      });

      if (confirmError) {
        setSubmitError(confirmError.message ?? 'Your card was declined. Please try a different card.');
        setSubmitting(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        try {
          const confirmRes = await fetch('/api/checkout/confirm-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
          });
          const confirmData = await confirmRes.json().catch(() => ({}));
          if (confirmRes.ok) {
            setOrderSuccess({ orderId: confirmData.orderId ?? null, orderNumber: confirmData.orderNumber ?? null });
          } else {
            // Card was already charged — still show success. The webhook may land shortly after.
            setOrderSuccess({ orderId: null, orderNumber: null });
          }
        } catch {
          setOrderSuccess({ orderId: null, orderNumber: null });
        }
      } else {
        setSubmitError('Payment could not be completed. Please try again.');
      }
      setSubmitting(false);
    } catch {
      setSubmitError('Could not submit. Your card was not charged. Try again.');
      setSubmitting(false);
    }
  }, [canSubmit, quote.id, paymentMethod, deliveryMethod, address, residential, contactName, contactPhone, poNumber, stripe, elements]);

  if (orderSuccess) {
    return (
      <div className="max-w-[600px] mx-auto py-16">
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-8 text-center">
          <h1 className="font-heading text-2xl text-afs-chrome-high mb-3">Order Placed</h1>
          {orderSuccess.orderNumber ? (
            <p className="font-data text-lg text-afs-crimson mb-3">{orderSuccess.orderNumber}</p>
          ) : null}
          <p className="font-body text-sm text-afs-chrome-mid mb-6">
            {paymentMethod === 'net_terms'
              ? 'Your order has entered the fabrication queue. An invoice will appear in your account.'
              : 'Payment received. Your order confirmation will appear in your account shortly.'}
          </p>
          <Link
            href={orderSuccess.orderId ? `/account/orders/${orderSuccess.orderId}` : '/account/orders'}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors inline-block"
          >
            View Your Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
      <div>
        <h1 className="font-heading text-3xl text-afs-chrome-high mb-1">Secure Checkout</h1>
        <p className="font-body text-sm text-afs-chrome-mid mb-8">Quote {quote.quote_number}</p>

        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-4">1. Delivery Information</h2>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <label
              className={`flex items-center gap-2 border rounded px-3 py-3 cursor-pointer font-label text-sm transition-colors ${
                deliveryMethod === 'ship'
                  ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                  : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
              }`}
            >
              <input
                type="radio"
                name="deliveryMethod"
                checked={deliveryMethod === 'ship'}
                onChange={() => setDeliveryMethod('ship')}
                disabled={submitting}
                className="accent-afs-crimson"
              />
              Ship
            </label>
            <label
              className={`flex items-center gap-2 border rounded px-3 py-3 cursor-pointer font-label text-sm transition-colors ${
                deliveryMethod === 'pickup'
                  ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                  : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
              }`}
            >
              <input
                type="radio"
                name="deliveryMethod"
                checked={deliveryMethod === 'pickup'}
                onChange={() => setDeliveryMethod('pickup')}
                disabled={submitting}
                className="accent-afs-crimson"
              />
              Pickup
            </label>
          </div>

          {deliveryMethod === 'ship' ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass} htmlFor="delivery-address">
                  Delivery Address
                </label>
                <textarea
                  id="delivery-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={submitting}
                  rows={3}
                  placeholder="Street, city, state, ZIP"
                  className={inputClass}
                  required
                />
              </div>
              <label className="flex items-center gap-3 font-body text-sm text-afs-chrome-mid">
                <input
                  type="checkbox"
                  checked={residential}
                  onChange={(e) => setResidential(e.target.checked)}
                  disabled={submitting}
                  className="accent-afs-crimson"
                />
                Is this a residential address?
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="font-body text-sm text-afs-chrome-mid">
                You&apos;ll receive pickup scheduling instructions in your order confirmation.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="contact-name">
                    Contact Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    disabled={submitting}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="contact-phone">
                    Contact Phone
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    disabled={submitting}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/*
            OUTSIDE the Ship/Pickup branch, deliberately. This input used to sit
            inside the Ship arm, so a customer who chose Pickup never saw it and
            their order carried no PO at all — and once a company requires one,
            that placement would have made the order unplaceable. A PO number is
            an accounting field, not a shipping field.
            SPEC_PURCHASE_ORDER_INTEGRATION.md §2 puts it in "checkout Section 1
            (Delivery Information)", which is here.
          */}
          <div className="mt-4">
            <PoNumberField
              value={poNumber}
              onChange={setPoNumber}
              required={requirePo}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-4">2. Payment</h2>

          <div className={`grid ${netTerms > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-4`}>
            <label
              className={`flex items-center gap-2 border rounded px-3 py-3 cursor-pointer font-label text-sm transition-colors ${
                paymentMethod === 'card'
                  ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                  : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === 'card'}
                onChange={() => setPaymentMethod('card')}
                disabled={submitting}
                className="accent-afs-crimson"
              />
              Credit / Debit Card
            </label>
            {netTerms > 0 && (
              <label
                className={`flex items-center gap-2 border rounded px-3 py-3 cursor-pointer font-label text-sm transition-colors ${
                  paymentMethod === 'net_terms'
                    ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                    : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'net_terms'}
                  onChange={() => setPaymentMethod('net_terms')}
                  disabled={submitting}
                  className="accent-afs-crimson"
                />
                Net {netTerms} Terms
              </label>
            )}
          </div>

          {paymentMethod === 'card' ? (
            /* Stripe's Card Element renders inside a cross-origin iframe, so its
               colors must be literal hex passed via the `style` option below —
               afs-* Tailwind classes can't reach into the iframe. */
            <div
              className={`rounded px-3 py-3 border transition-colors bg-afs-bg-raised ${
                cardFocused ? 'border-afs-crimson' : 'border-afs-border'
              }`}
            >
              <CardElement
                onFocus={() => setCardFocused(true)}
                onBlur={() => setCardFocused(false)}
                onChange={(e) => setCardComplete(e.complete)}
                options={{
                  style: {
                    base: {
                      backgroundColor: STRIPE_CARD_ELEMENT_COLORS.bgRaised,
                      color: STRIPE_CARD_ELEMENT_COLORS.chromeMid,
                      iconColor: STRIPE_CARD_ELEMENT_COLORS.chromeMid,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '16px',
                      '::placeholder': { color: STRIPE_CARD_ELEMENT_COLORS.chromeDim },
                    },
                    invalid: { color: STRIPE_CARD_ELEMENT_COLORS.crimsonHover },
                  },
                }}
              />
            </div>
          ) : (
            <p className="font-body text-sm text-afs-chrome-mid">
              Invoiced on Net-{netTerms} terms. No payment required now — your order enters the
              fabrication queue immediately.
            </p>
          )}
        </div>

        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 mb-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-4">3. Legal Acceptance</h2>
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 font-body text-sm text-afs-chrome-mid">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                disabled={submitting}
                className="accent-afs-crimson mt-0.5"
                required
              />
              I have reviewed and accept the AFS Terms of Sale.
            </label>
            <label className="flex items-start gap-3 font-body text-sm text-afs-chrome-mid">
              <input
                type="checkbox"
                checked={noReturns}
                onChange={(e) => setNoReturns(e.target.checked)}
                disabled={submitting}
                className="accent-afs-crimson mt-0.5"
                required
              />
              I understand that custom fabricated items cannot be returned once production begins.
            </label>
            <label className="flex items-start gap-3 font-body text-sm text-afs-chrome-mid">
              <input
                type="checkbox"
                checked={specsFinal}
                onChange={(e) => setSpecsFinal(e.target.checked)}
                disabled={submitting}
                className="accent-afs-crimson mt-0.5"
                required
              />
              I confirm these specifications and dimensions are final and correct.
            </label>
          </div>
        </div>

        {submitError && (
          <p className="font-body text-sm text-afs-crimson mb-4">{submitError}</p>
        )}

        {/*
          SPEC_PURCHASE_ORDER_INTEGRATION.md §3 asks for BOTH halves — the
          sentence and the block — so the disabled button alone is not enough:
          nothing else in this form explains why Place Order is unavailable, and
          a customer staring at a dead button has nothing to act on.

          Guarded on `requirePo`, so for a company without the requirement this
          element never exists and the page is unchanged.
        */}
        {requirePo && !poComplete && !submitError && (
          <p className="font-body text-sm text-afs-danger-on-dark mb-4" role="status">
            {PO_REQUIRED_ERROR}
          </p>
        )}

        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={!canSubmit}
          className="w-full bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-4 rounded text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Placing Order…' : 'Place Order'}
        </button>
      </div>

      <div className="lg:sticky lg:top-6 h-fit">
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Order Summary</h2>
          <div className="flex flex-col gap-2 mb-4">
            {lineItems.map((item) => (
              <div key={item.id} className="flex justify-between font-body text-xs text-afs-chrome-mid gap-3">
                <span className="truncate">
                  {item.description} ({item.quantity} {item.unit})
                </span>
                <span className="font-data text-afs-chrome-high whitespace-nowrap">
                  {currency.format(item.line_total)}
                </span>
              </div>
            ))}
          </div>
          <dl className="flex flex-col gap-2 font-body text-sm border-t border-afs-chrome-dim pt-3">
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Subtotal</dt>
              <dd className="font-data text-afs-chrome-high">{currency.format(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Freight</dt>
              <dd className="font-data text-afs-chrome-high">
                {quote.freight != null ? currency.format(quote.freight) : '—'}
              </dd>
            </div>
            {quote.rush_surcharge > 0 && (
              <div className="flex justify-between">
                <dt className="text-afs-chrome-mid">Rush Surcharge</dt>
                <dd className="font-data text-afs-chrome-high">{currency.format(quote.rush_surcharge)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Tax</dt>
              <dd className="font-data text-afs-chrome-high">
                {quote.tax != null ? currency.format(quote.tax) : '—'}
              </dd>
            </div>
            <div className="flex justify-between border-t border-afs-chrome-dim pt-2 mt-1">
              <dt className="font-label text-afs-chrome-high font-semibold">Total</dt>
              <dd className="font-data text-lg text-afs-crimson">{currency.format(quote.total)}</dd>
            </div>
          </dl>
          <p className="font-body text-xs text-afs-chrome-dim mt-4">
            Prices set by AFS and confirmed in your quote.
          </p>
        </div>
      </div>
    </div>
  );
}
