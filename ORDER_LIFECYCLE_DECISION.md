# ORDER_LIFECYCLE_DECISION.md
## Resolving the quote_requests → orders conflict
**Investigation only — no other files modified.**

---

## 1. WHAT THE CODE ACTUALLY DOES TODAY

Traced every write to the `orders` table across the six files read for this
investigation, plus `app/checkout/page.tsx` and `app/admin/command-center/page.tsx`
for surrounding context.

**There are exactly two places in the codebase that INSERT an `orders` row.
Both live inside `lib/data/orders.ts`'s `createOrderFromQuote()` (lines 77–169),
which both call sites share. Nothing else creates an order — not quote-request
submission, not admin "send quote," and not admin "approve quote request."**

### Call site 1 — Stripe webhook (post-payment, card)
`app/api/webhooks/stripe/route.ts` lines 14–42, `handlePaymentSuccess()`:
fires on Stripe's `payment_intent.succeeded` event (line 70), reads
`quoteId`/`userId` out of the PaymentIntent's metadata, and calls
`createOrderFromQuote(admin, { ...paymentMethod: 'card', stripePaymentIntentId: paymentIntent.id })`
at lines 30–41. This is the only path that creates an order for a
credit-card payment, and it only runs after Stripe has confirmed the charge.

### Call site 2 — Net Terms (synchronous, at checkout, still post-quote)
`app/api/checkout/create-intent/route.ts` lines 99–120: when
`paymentMethod === 'net_terms'`, `createOrderFromQuote()` is called directly
in the API route, synchronously, with `deposit_paid` implicitly `false`
(`lib/data/orders.ts` line 128: `deposit_paid: input.paymentMethod === 'card'`).
No Stripe PaymentIntent is created for this path at all (confirmed no
`stripe.paymentIntents.create` call in the net-terms branch). This still
requires `quotes.status === 'sent'` (enforced at `create-intent/route.ts`
line 82–84) — i.e., it still requires a customer-visible, AFS-priced quote
to exist and the *customer* to have submitted checkout. It is not gated on
Stripe payment succeeding, but it is gated on the customer's own
"Place Order" action against a real quote.

### What does NOT create an order
- `app/api/admin/command-center/approve-quote-request/route.ts` (the
  "approve" action in Command Center): inserts a `machine_jobs` row only
  (lines 202–225, `status: 'approved_for_machine'`) and updates
  `quote_requests.status` to `'reviewing'` (lines 228–231). **No `orders`
  insert anywhere in this file.** Note also: the page that calls this route,
  `app/admin/command-center/page.tsx` (lines 175–177), already labels this
  action **"Approve & Send to Machine"** in its own code comment — the UI
  itself does not claim to be creating an order.
- `app/api/admin/quote-requests/[id]/send/route.ts` (the "send formal
  quote" action): inserts a `quotes` row (`status: 'sent'`, lines 135–157)
  and `quote_line_items` (lines 159–178), and updates
  `quote_requests.status` to `'quoted'` (lines 180–183). **No `orders`
  insert.** This is also the *only* place `unit_price` / line pricing is
  ever attached to a request — a bare `quote_requests` row has no AFS-set
  price on it at all (its `line_items` JSONB, per `SendLineItemInput`, has
  no `unitPrice` until this route runs).

### Idempotency
`createOrderFromQuote()` (lines 81–88) checks for an existing order by
`quote_id` before inserting, and returns the existing order if found. So
call sites 1 and 2 can never double-create an order for the same quote,
which matters below.

**Conclusion: the code implements ARCHITECTURE.md's documented lifecycle
exactly** — `quote_requests` → (admin prices and sends) → `quotes` (status
`sent`) → customer approves & pays/selects Net Terms → `orders`. Nothing
today creates an order pre-payment/pre-approval from Command Center.

---

## 2. THE REAL GAP FOUND (not previously flagged)

While tracing call site 1, `app/checkout/page.tsx` lines 279–293 shows the
card-payment success path:

```
const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(...)
...
if (paymentIntent?.status === 'succeeded') {
  setOrderSuccess({ orderId: null, orderNumber: null });   // line 290
}
```

The client marks the order "placed" the instant Stripe confirms payment
*client-side* — it never calls back to the server to confirm an `orders`
row actually exists. The only thing that ever creates that row for a card
payment is the asynchronous Stripe webhook (call site 1), which the browser
has no visibility into and does not wait for. `orderId`/`orderNumber` are
hard-coded `null` here (contrast the Net Terms branch, `create-intent`
route, which returns a real `orderId`/`orderNumber` synchronously), so the
success screen's "View Your Orders" link falls back to `/account/orders`
(line 315) instead of the specific order — the customer has no confirmation
the order row exists, only that Stripe accepted the card.

If the webhook is ever delayed, misconfigured (`STRIPE_WEBHOOK_SECRET`
mismatch), or simply not registered in a given environment, a customer can
be charged with **no `orders` row ever created** and no error surfaced to
anyone. This is the most plausible root cause of an admin ("Steve")
observing "sometimes an approved/paid request never turns into an order"
and describing the fix in terms of the step *they* control and can see
(Command Center approval) rather than the step that's actually silently
failing (webhook delivery).

---

## 3. DECISION: which model is correct

**ARCHITECTURE.md's model is correct. The operational note, taken
literally, must not be implemented.**

Reasoning:

1. **No price exists yet at Command Center approval time.** A
   `quote_requests` line item has no `unitPrice` (see `SendLineItemInput`
   in the `send` route — pricing is only ever attached there) until an
   estimator runs the "send formal quote" action. `orders.subtotal` and
   `orders.total` are `NOT NULL` (SCHEMA.md TABLE 18). There is no valid
   value to populate them with at the point the operational note proposes
   creating the row.
2. **It would violate CLAUDE.md's core business rule** — "Payment is
   collected only after AFS has set and delivered the price" — and
   ARCHITECTURE.md §6's explicit sequence (quote sent → customer approves
   & pays → order). An `orders` row is customer-visible order-tracking
   state (Pillar 3); creating it before the customer has ever seen a price
   or clicked "Approve & Place Order" would show the customer an order they
   never placed.
3. **The Command Center approval action is already correctly scoped** to
   machine-program approval, not order approval — both the code
   (`machine_jobs` insert only) and the UI's own label ("Approve & Send to
   Machine") agree on this. `machine_jobs` is explicitly documented in
   ARCHITECTURE.md §6 as "a separate lifecycle from `orders.status`" — the
   code matches that design. Changing this route to also insert into
   `orders` would conflate two intentionally independent lifecycles and
   require inventing a price the system doesn't have yet.
4. **The actual defect worth fixing is reliability of the *existing*
   post-payment trigger** (§2 above), not moving order-creation earlier.

---

## 4. EXACTLY WHAT qtoq-001b SHOULD BUILD

Scope: harden the existing post-payment order-creation path. Do **not**
touch `app/api/admin/command-center/approve-quote-request/route.ts` and do
**not** add any `orders` insert to it or to
`app/api/admin/quote-requests/[id]/send/route.ts`.

1. **Add a new route `app/api/checkout/confirm-order/route.ts`.**
   - `POST` body: `{ paymentIntentId: string }`.
   - Auth-check the same way `create-intent/route.ts` does (lines 50–56):
     require a logged-in Supabase user via `createClient()` +
     `supabase.auth.getUser()`; 401 if absent.
   - Retrieve the PaymentIntent from Stripe server-side via
     `getStripe().paymentIntents.retrieve(paymentIntentId)`.
   - Verify `paymentIntent.status === 'succeeded'` (400 if not) and
     `paymentIntent.metadata.userId === user.id` (403 if not — prevents one
     user confirming another's payment intent).
   - Call the existing `createOrderFromQuote()` from `lib/data/orders.ts`
     with the same field mapping already used in
     `app/api/webhooks/stripe/route.ts`'s `handlePaymentSuccess()` (lines
     14–41): `quoteId`/`userId` from metadata, `paymentMethod: 'card'`,
     `netTerms: 0`, delivery fields from metadata exactly as that function
     already parses them, `stripePaymentIntentId: paymentIntent.id`.
   - This is safe to call whether or not the webhook has already fired,
     because `createOrderFromQuote()` is already idempotent on `quote_id`
     (`lib/data/orders.ts` lines 81–88) — whichever of {webhook, this
     route} runs first creates the order; the second call is a no-op that
     returns the existing row.
   - Return `{ orderId, orderNumber }` on success (200); on any Stripe or
     DB error, 500.

2. **Update `app/checkout/page.tsx`'s `handlePlaceOrder`** (around lines
   279–293): after `stripe.confirmCardPayment` resolves with
   `paymentIntent.status === 'succeeded'`, call
   `POST /api/checkout/confirm-order` with `{ paymentIntentId: paymentIntent.id }`
   and set `orderSuccess` from its `{ orderId, orderNumber }` response
   instead of the current hard-coded `{ orderId: null, orderNumber: null }`
   at line 290. If `confirm-order` itself fails, still show the existing
   "Order Placed" success copy (the card was charged — do not tell the
   customer payment failed) but keep the "View Your Orders" link pointing
   at `/account/orders` (today's fallback), since the webhook may still
   land shortly after.

3. **Do not change `app/api/webhooks/stripe/route.ts`.** It remains the
   primary, authoritative order-creation path — it must keep working
   identically for cases where the customer's browser closes/loses
   connection right after Stripe confirms the charge (the webhook is the
   only path that still fires in that case). `confirm-order` is a
   synchronous convenience call for the common case, not a replacement.

4. **No schema changes.** `orders`, `quotes`, `quote_requests` and their
   RLS policies are unchanged.

5. **Governance update (per CLAUDE.md rule 8):** after building, update
   STATE_OF_THE_BUILD.md and SESSION_STATE.md from an actual audit
   reflecting the new `confirm-order` route, and add one sentence to
   ARCHITECTURE.md §6 noting that order creation is triggered by *either*
   the Stripe webhook *or* the client-side `confirm-order` fallback, both
   converging on the same idempotent `createOrderFromQuote()`.

6. **Explicitly out of scope for qtoq-001b:** any change to Command
   Center's approve-for-machine flow, any change to the "send formal
   quote" flow, and any deposit/partial-payment logic (still blocked per
   SPEC_CHECKOUT.md §8 / checklist #35).

---

## 5. ADDENDUM — post-build audit found the idempotency claim in §1 and §4
was DB-unenforced (2026-07-30)

§1 and §4 above state `createOrderFromQuote()` is "idempotent on quote_id"
based on its SELECT-by-`quote_id`-before-INSERT check. That check is real
but not atomic, and — traced against the actual migrations, not assumed —
`orders.quote_id` had only a non-unique index (`idx_orders_quote`,
`001_initial_schema.sql`), no `UNIQUE` constraint. Before qtoq-001b, the
only way to hit this gap was a retried Stripe webhook delivery, which
Stripe does not send concurrently with itself. After qtoq-001b, the
client's `confirm-order` call and the webhook's `handlePaymentSuccess()`
are two independently-triggered requests for the same quote that *can*
execute concurrently (client fires `confirm-order` the same tick Stripe's
webhook fires) — so the race this design relies on being safe became
substantially more reachable by this change itself, not just a
theoretical retry edge case.

Fixed in a follow-up audit pass, still within qtoq-001b's scope of
"harden the existing post-payment order-creation path":
- `supabase/migrations/011_orders_quote_id_unique.sql` adds a real
  `UNIQUE (quote_id)` constraint.
- `createOrderFromQuote()` (`lib/data/orders.ts`) now catches the
  resulting Postgres `23505` unique-violation on the `orders` insert and
  re-queries for the winning row instead of throwing, so both concurrent
  callers still return the same `{ orderId, orderNumber }`.

This is a narrow correction to §4 point 4 ("No schema changes") — the
schema change is the fix for the exact defect §4 point 4 was originally
scoped to hardening. `send/route.ts` and
`approve-quote-request/route.ts` are still untouched, per §1–§4.

---

*ORDER_LIFECYCLE_DECISION.md | AFS | Investigation record + qtoq-001b follow-up audit | 2026-07-30*
