# PO_INTEGRATION_SCOPE.md
## AFS — Purchase Order Integration: Current State + po-002 Scope

Prepared per request to read SPEC_PURCHASE_ORDER_INTEGRATION.md in full,
grep the repo for existing PO code, confirm `app/checkout/page.tsx` and
`app/api/checkout/create-intent/route.ts` don't support a non-Stripe
payment path, check SCHEMA.md for PO-related columns, and determine the
real data model `po-002` should build. Sourced from a live read of the
spec, the checkout page, the create-intent route, `lib/data/orders.ts`,
`lib/data/customers.ts`, the admin order/customer/quote-request detail
pages, the invoice PDF builder, `app/account/orders/[id]/page.tsx`, and
`supabase/migrations/001_initial_schema.sql` — not from memory.

---

## 1. THIS IS NOT A NEW PAYMENT METHOD

Confirmed by reading both files named in the request:

- `app/checkout/page.tsx` has exactly two `PaymentMethod` values:
  `'card' | 'net_terms'` (line 30). A PO number is a **free-text metadata
  field on top of one of those two payment methods**, not a third payment
  path. Nothing about PO changes how the order gets paid — a PO customer
  either pays by card or, if their account has `net_terms > 0`, is
  invoiced on terms. SPEC_PURCHASE_ORDER_INTEGRATION.md never proposes a
  "pay by PO" option either — its own code sample (§2) places the PO
  field inside checkout Section 1, "Delivery Information," alongside
  address fields, not Section 2 ("Payment").
- `app/api/checkout/create-intent/route.ts` line 17 has the identical
  `'card' | 'net_terms'` union and rejects anything else (line 43–45). No
  PO-specific branch exists.

**So: confirmed, neither file supports (or should support) a non-Stripe
payment path for PO orders. This is correct and matches the spec.**

---

## 2. A PARTIAL PO IMPLEMENTATION ALREADY EXISTS

Grepping the repo for `po_number`/`poNumber`/`require_po` turned up a
real, working (if incomplete) feature already in place — this is not a
greenfield build:

- **`orders.po_number TEXT`** and **`quote_requests.po_number TEXT`**
  both exist today (`supabase/migrations/001_initial_schema.sql:442,565`)
  and are real, already-applied columns (SCHEMA.md TABLE 15, TABLE 18).
- **`companies.require_po BOOLEAN NOT NULL DEFAULT false`** also exists
  today (`001_initial_schema.sql:71`, SCHEMA.md TABLE 2).
- `app/checkout/page.tsx` already renders a `PO Number (optional)` text
  input (lines 413–425) and threads it through `handlePlaceOrder` →
  `POST /api/checkout/create-intent` (line 250).
- `create-intent/route.ts` already accepts `poNumber` in its request body
  (line 22) and passes it into `createOrderFromQuote()` for both the
  `net_terms` branch (line 109) and, via Stripe PaymentIntent metadata
  (line 126) → `app/api/webhooks/stripe/route.ts:39` → the same function,
  for the `card` branch. **Both payment paths already persist
  `orders.po_number`.**
- `lib/data/orders.ts`'s `createOrderFromQuote()` already writes
  `po_number: input.poNumber` on insert (line 139) and
  `getAdminOrderDetail()` already selects and returns it (line 468).
- `app/admin/orders/[id]/page.tsx:211` already **displays** the PO number
  on the admin order detail page.
- `app/quote/page.tsx` already has its own, separate PO number field
  (lines 523–525) on the up-front quote request form, saved to
  `quote_requests.po_number` (line 239) and displayed on
  `app/admin/quote-requests/[id]/page.tsx:145`.

None of this needs to be built. What's below is what's actually missing.

---

## 3. WHAT'S ACTUALLY MISSING (the real gaps)

### 3a. PO number is not collected for pickup orders
`app/checkout/page.tsx` lines 386–463: the PO number `<input>` sits
**inside the `deliveryMethod === 'ship'` branch only** (lines 413–425).
A customer who selects "Pickup" never sees the field at all, and
`poNumber` stays `''` regardless of their company's requirement. PO
number has nothing to do with delivery method — it's an accounting
field, not a shipping field — so this is a straightforward existing bug
in the current partial build, not a design choice.

### 3b. `companies.require_po` is written by nothing and read by nothing
Grepped the entire repo for `require_po`/`requirePo`: the only two hits
in any `.ts`/`.tsx`/`.sql` file are the column definition itself
(`001_initial_schema.sql:71`) and its restatement in `SCHEMA.md`. **Zero
code reads it. Zero code writes it. There is no admin UI to set it**
(`app/admin/customers/[id]/page.tsx`'s `CustomerAccountSettingsForm`
edits `role`, `pricingTier`, `netTerms`, `creditLimit`, `taxExempt` — no
`companies` table field anywhere). SPEC §3's entire "Company PO
Requirement" section — the required-vs-optional toggle, the blocking
validation message — is unbuilt. Today the PO field is unconditionally
optional for every customer, always.

### 3c. `companies` has no admin management surface at all
This matters for scoping 3b correctly. `companies` rows are created
through the Team Accounts flow (`app/account/team/page.tsx`,
`app/api/team/invite/route.ts` — a customer becomes a company
`owner`/`admin` and gets `profiles.company_id` set); there is **no
`/admin/companies` page** and no company-level section on
`/admin/customers/{id}` today. `profiles.company_id` is nullable, and a
customer who never used Team Accounts has no `companies` row at all.
SPEC §3's literal instruction — "Admin sets per company in
`/admin/customers/{id}`" — has to resolve against this reality: that
route is a **per-profile** page today, and most individual customers
won't have a company row to attach a requirement to.

### 3d. PO number is invisible on the customer's own order page
`app/account/orders/[id]/page.tsx` lines 96–100: the `orders` select
list does not include `po_number`, and nothing in the page renders it.
SPEC §2 explicitly lists "Order detail page" as a required surface —
confirmed missing by reading the query and the render tree.

### 3e. PO number is missing from the invoice PDF
`app/api/invoices/[id]/pdf/route.ts` lines 17–21: the `orders` select
does not include `po_number`. `lib/utils/invoice-pdf.ts`'s
`InvoiceOrderRecord` interface (lines 11–23) and `buildInvoicePdfLines()`
(lines 54+) have no PO field or line for it. SPEC §2 explicitly lists
"Invoice PDF header" as a required surface — confirmed missing.

### 3f. No order-confirmation email exists to put a PO number into
Grepped for any order-confirmation email send path — none exists.
`SPEC_RESEND_INTEGRATION.md`/`SPEC_EMAIL_TEMPLATES.md` (Phase 4,
CLAUDE.md's own spec list) have not been built yet; there is no Resend
call, no email template file, anywhere in the repo tied to order
placement. SPEC §2's "Order confirmation email" bullet has no host to
attach to — this is a pre-existing gap in an entirely different,
unbuilt feature, not something `po-002` can wire into.

### 3g. `quote_requests.po_number` and `orders.po_number` are two disconnected fields
A customer can type a PO number on the `/quote` request form
(`quote_requests.po_number`) and then, once that request is priced and
they check out, is asked to type a PO number **again** from scratch —
`app/checkout/page.tsx` never reads back the originating
`quote_requests.po_number` to pre-fill the checkout field. Minor UX gap,
not a data-model gap (both real columns already exist independently).

---

## 4. IS AN ADMIN APPROVAL STEP NEEDED BEFORE FABRICATION ON A PO ORDER?

**No — and building one would contradict both the spec and the existing,
just-decided order lifecycle. Explicitly out of scope.**

- SPEC_PURCHASE_ORDER_INTEGRATION.md itself never mentions an approval
  step. Its entire scope is: a text field, a per-company required flag,
  and three display surfaces. Nothing about gating production.
- `ORDER_LIFECYCLE_DECISION.md` (in this repo, dated 2026-07-30) already
  investigated and settled the adjacent question of when an `orders` row
  — and therefore fabrication — should be allowed to start, and
  concluded the only two valid triggers are a succeeded Stripe charge
  (webhook or `confirm-order` fallback) or a net-terms customer's own
  "Place Order" click against an AFS-priced quote (`quotes.status =
  'sent'`). Both already require the customer to have seen and accepted
  a real price. Adding a second, PO-specific hold in front of that would
  be new scope with no spec basis and no data to support it (there is no
  `orders.status` value for "pending PO verification" and no admin queue
  for it — see `ORDER_STAGES`/`orders.status` CHECK constraint in
  SCHEMA.md TABLE 18, which has no such state).
- If AFS wants to manually verify a submitted PO number/document before
  cutting metal, that is a distinct future feature (a new order status +
  admin queue) that should get its own spec, not be inferred here.

**`po-002` should not touch order-creation gating, `orders.status`, or
add any new admin approval queue.**

---

## 5. PO DOCUMENT UPLOAD — evaluated, recommend deferring

The request asked whether PO document upload (via the existing
`app/api/documents/upload` pattern) belongs in this scope. Findings:

- SPEC_PURCHASE_ORDER_INTEGRATION.md never mentions a document upload —
  only a PO **number** text field. This would be scope invention beyond
  the spec.
- The existing upload route (`app/api/documents/upload/route.ts`) writes
  into `vault_documents`, keyed by `user_id` + optional `project_id` +
  optional `order_id`. But checkout happens **before** an order exists
  (the order isn't created until payment succeeds or net-terms is
  confirmed — see §4), so there is no `order_id` yet to attach a document
  to at the point a customer would upload their PO. The route also has
  no `orderId` form field at all today — only `projectId`.
- A real implementation would need either (a) a pre-order staging
  mechanism (upload tied to the `quote_id`, then re-parented to the
  `order_id` after `createOrderFromQuote()` runs — similar in spirit to
  how `takeoff_uploads` stages a file before a `quote_request` exists),
  or (b) a new `order_attachments.attachment_type` value (today's enum —
  `'approved_drawing','pre_ship_photo','delivery_confirmation',
  'signed_bol','quality_report','other'` — has no `'po_document'`
  option) plus admin-only write access, since `order_attachments` is
  admin-authored today (customers only get `SELECT`, gated on
  `is_visible_to_customer`).
- This is a real, buildable feature, but it's materially larger than
  "add a text field" and unrequested by the spec. **Recommend deferring
  it to a follow-up (`po-003`) scoped explicitly to document upload if
  AFS confirms they need it** — don't fold it into `po-002` silently.

---

## 6. EXACTLY WHAT po-002 SHOULD BUILD

No new tables, no new columns, no migration — every field this needs
already exists in the live schema (§2). This is a wiring/completeness
pass on an already-half-built feature.

1. **Fix the delivery-method bug (§3a).** Move the PO Number input in
   `app/checkout/page.tsx` out of the `deliveryMethod === 'ship'`
   conditional block so it always renders in Section 1, regardless of
   Ship vs. Pickup.

2. **Build the company PO-requirement toggle (§3b, §3c) on the existing
   admin customer page**, reusing `companies.require_po` — do not invent
   a new profile-level column:
   - Extend `lib/data/customers.ts`'s customer-detail fetch to also
     resolve `profiles.company_id → companies.{id, name, require_po}`
     when `company_id` is set.
   - Add a small form (new component, e.g. `CompanyPoRequirementForm`,
     alongside `CustomerAccountSettingsForm` on
     `app/admin/customers/[id]/page.tsx`) that renders **only when the
     customer has a `company_id`**, showing the company name and a
     "Require PO Number on all orders" checkbox; PATCH to a new/extended
     admin API route that updates `companies.require_po` for that
     `company_id` (admin-authenticated, logged to `admin_audit_log` the
     same way `CustomerAccountSettingsForm`'s save already is).
     When the customer has no `company_id`, show explanatory copy
     instead of a broken control (e.g. "This customer has no company on
     file — PO requirement is set at the company level via Team
     Accounts.") rather than silently doing nothing.

3. **Enforce the requirement at checkout**, both sides:
   - Client (`app/checkout/page.tsx`): in the same load effect that
     already fetches `profiles.net_terms` (line 145–149), also resolve
     `profiles.company_id → companies.require_po`. If `true`, change the
     label to "Purchase Order Number *", show the spec's hint copy
     ("Your account requires a PO number for all orders"), and fold
     `poNumber.trim().length > 0` into `deliveryComplete`/`canSubmit` so
     "Place Order" is blocked client-side without one.
   - Server (`app/api/checkout/create-intent/route.ts`): after resolving
     `profile` (line 86–91), also fetch `companies.require_po` via
     `profile.company_id` and, if required and `!body.poNumber`, return
     `400` with the spec's exact message — "Purchase Order Number is
     required for your account" — **before** creating a Stripe
     PaymentIntent or calling `createOrderFromQuote()`. This is the real
     guard; the client check is UX only.

4. **Surface PO number on the customer's own order detail page (§3d).**
   Add `po_number` to the `orders` select in
   `app/account/orders/[id]/page.tsx` (line 99) and render it (e.g. next
   to Order # / Payment Method) when non-null.

5. **Surface PO number on the invoice PDF (§3e).** Add `po_number` to
   the `orders` select in `app/api/invoices/[id]/pdf/route.ts` (line
   20), add `po_number: string | null` to `InvoiceOrderRecord` in
   `lib/utils/invoice-pdf.ts`, and add a `PO Number: {order.po_number}`
   line near the header (after `Status`, before `Bill To`) when present
   — matching SPEC §2's "Invoice PDF header" placement.

6. **Pre-fill from the quote request (§3g) — small nice-to-have.** When
   loading the quote in `app/checkout/page.tsx`, also read the
   originating `quote_requests.po_number` (via `quotes.request_id`) and
   use it as the PO field's initial value if the customer hasn't already
   typed one. Not spec-required; include only if trivial alongside the
   above — do not let it block the rest of this list.

7. **Do not build:**
   - Any new payment method (§1).
   - Any admin approval / production-hold gate tied to PO status (§4).
   - PO document upload (§5) — flag as a candidate follow-up, don't
     silently fold it in.
   - Order-confirmation email PO integration (§3f) — no such email
     exists yet; out of scope until `SPEC_RESEND_INTEGRATION.md` /
     `SPEC_EMAIL_TEMPLATES.md` are built.
   - Any change to `orders.status`, the `ORDER_STAGES` enum, or
     `order_attachments.attachment_type`.

---

*PO_INTEGRATION_SCOPE.md | AFS | prepared from live codebase audit, 2026-07-30*
