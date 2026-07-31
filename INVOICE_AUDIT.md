# INVOICE_AUDIT.md
## Invoice auto-generation on dispatch — actual vs. claimed, verified against source

Scope: does an invoice actually auto-generate and email to the customer when
an order is dispatched, does it contain the required content, and is there a
real DB record of it. Files read in full: `lib/utils/invoice-pdf.ts`,
`lib/utils/invoice-email.ts`, `app/api/orders/[id]/dispatch/route.ts`,
`app/api/invoices/[id]/pdf/route.ts`, `app/api/invoices/[id]/send/route.ts`,
`lib/data/invoices.ts`. Supporting checks: `lib/data/orders.ts`,
`components/admin/QuoteEstimatorForm.tsx`,
`app/api/admin/quote-requests/[id]/send/route.ts`,
`app/api/admin/command-center/approve-quote-request/route.ts`,
`lib/data/command-center-crm.ts`, `app/api/admin/invoices/[id]/mark-paid/route.ts`,
`supabase/migrations/007_delivery_tracking.sql`,
`supabase/migrations/009_command_center_crm.sql`.

**Bottom line: auto-generation and auto-email on dispatch both actually work
and are wired correctly.** The invoice content mostly matches spec. One real
bug was found (invoice status ignores the "paid" flag everywhere except the
admin CRM tab) and one architectural fact needs to be stated plainly: there is
no `invoices` table — this is by design, not an oversight, but it has a real
consequence for historical accuracy that the next prompt should decide on.

---

## 1. What happens today, traced end to end

1. Admin/employee calls `POST /api/orders/[id]/dispatch`
   (`app/api/orders/[id]/dispatch/route.ts`). Auth via `requireOperatorApi`
   (lines 33-36).
2. Order status flips to `out_for_delivery`, `dispatched_at` stamped (lines
   73-76). Guarded so this can only fire once per order — blocked if already
   `out_for_delivery`, `delivered`, or `cancelled` (lines 55-63).
3. SMS (if opted in) and a dispatch email are sent (lines 111-177) — not in
   scope here, already covered by `NOTIFICATION_AUDIT.md` items 4/5.
4. **Line 180: `const invoiceResult = await sendInvoiceEmail(order.id);`** —
   this is the actual auto-generate-and-send trigger. It is unconditional
   (not gated on `email_opt_in`, matching the transactional-email precedent
   set for the dispatch email itself at lines 133-136).
5. `sendInvoiceEmail` (`lib/utils/invoice-email.ts`):
   - Re-fetches the order via the service-role client (lines 26-30) —
     independent of whatever the dispatch route already had in scope.
   - Looks up the customer's profile for `full_name`/`email` (lines 36-40).
   - If no email on file: logs a `notifications` row with
     `status: 'failed'` and returns `success: false` (lines 44-55) —
     **does not throw**, so dispatch itself never fails because of this.
   - Calls `generateInvoicePDF(orderId)` (line 59, from `invoice-pdf.ts`) to
     get a `Buffer`. On error, same failed-notification-and-return-false
     pattern (lines 60-72).
   - Builds an email via `baseEmailTemplate` (lines 74-83) and calls
     `sendEmail()` from `lib/resend/send.ts` with the PDF as a real
     attachment (lines 85-90) — this is a genuine Resend API call, not a
     stub.
   - Inserts a `notifications` row recording the real
     `result.success`/`result.error` (lines 92-100) — correct, not
     fabricated (see `NOTIFICATION_AUDIT.md`'s "fabricated notifications
     row" anti-pattern; this call site does not do that).
6. Back in the dispatch route, `delivery_notifications.invoice_sent` is set
   to `invoiceResult.success` (lines 182-189) — this is the only per-order
   boolean surfaced to the admin UI for "was the invoice actually emailed."
7. `generateInvoicePDF` (`lib/utils/invoice-pdf.ts` lines 131-163) reads the
   order, the customer's profile, and `order_line_items` directly from
   Postgres via the service-role client, then calls the shared
   `buildInvoicePdfLines()` (lines 54-118) and `buildSimplePdf()` to produce
   the `Buffer`. Nothing is written to Storage or any table — **the PDF is
   generated in memory, attached to the email, and discarded.** It is fully
   reproducible on demand (see §4) so this is a defensible choice, not
   obviously a bug.

Two other routes reuse the same building blocks and both work correctly:
- `GET /api/invoices/[id]/pdf` (customer download) — independently
  session-scoped, calls the same `buildInvoicePdfLines()` (line 50) so the
  layout can't drift between the emailed copy and the on-demand download.
- `POST /api/invoices/[id]/send` (admin manual resend from the CRM
  Invoices tab) — just calls `sendInvoiceEmail()` again (line 23), so a
  manual resend is byte-for-byte the same as the automatic dispatch send.

**Conclusion for §1: auto-generation on dispatch is real, not manual, not a
stub.** No gap here.

---

## 2. Required content — checked against `buildInvoicePdfLines()`

| Requirement | Present? | Where |
|---|---|---|
| AFS header | ✅ | `invoice-pdf.ts:63` — `"ARCHITECTURAL FLASHING SUPPLY — INVOICE"` |
| Line items | ✅ | `invoice-pdf.ts:85-96` |
| Material | ⚠️ Present, but not a separate field | see below |
| Gauge | ⚠️ Present, but not a separate field | see below |
| Qty | ✅ | `invoice-pdf.ts:90` — `item.quantity` |
| Length | ✅ | `invoice-pdf.ts:90` — `item.length_ft` |
| Subtotal | ✅ | `invoice-pdf.ts:98` (also freight, rush surcharge, tax, total — lines 99-104) |
| Payment terms | ✅ | `invoice-pdf.ts:106-113` — "Paid in full" or "Payment due `<date>` — Net `<N>` terms" |

**Material/gauge detail:** `order_line_items` (SCHEMA.md TABLE 19) has no
`material_id`/`gauge_id` columns — this is confirmed by
`invoice-pdf.ts:47-53`'s own comment, which is accurate. Material and gauge
are folded into the free-text `description` field at the point a quote is
built, by an identical `describeItem()` helper duplicated in three places:
`components/admin/QuoteEstimatorForm.tsx:41-46`,
`app/api/admin/quote-requests/[id]/send/route.ts:41-46`, and
`app/api/admin/command-center/approve-quote-request/route.ts:46-51` — each
does `[profileType, material, gauge].join(' — ')`. That string is what
`order_line_items.description` stores, and it's what renders on the invoice
at `invoice-pdf.ts:88`. So material/gauge **do** show up on the invoice today,
but only as embedded text inside the description line, not as their own
labeled columns — functionally present, structurally not what "include
material/gauge" might imply if a reviewer expects a dedicated column.

**Conclusion for §2: content requirements are met.** The material/gauge
point is worth knowing but is not a gap — it's a direct, documented
consequence of the schema, and it already works correctly for every order
that goes through the quote → order pipeline (all of them; there is no
order-creation path that bypasses `describeItem()`).

---

## 3. "Real invoices DB record" — does NOT exist, by design, with one real bug

**There is no `invoices` table.** SCHEMA.md's 41-table inventory has none,
and `lib/data/invoices.ts:38-39` says so explicitly in its own comment:
*"SCHEMA.md has no standalone `invoices` table — every order already carries
AFS-set pricing, so an invoice is derived 1:1 from its order."*
`toInvoiceRow()` (lines 43-57) computes an `InvoiceRow` on every call from
`orders` columns (`order_number`, `total`, `payment_method`, `net_terms`,
`created_at`) — there is no persisted invoice number, no persisted invoice
status, nothing to query for "show me this invoice" other than the order
itself. This is an intentional architecture choice that predates this audit,
not something this audit is flagging as missing.

**What *is* persisted:** a `notifications` row per send attempt
(`channel: 'email'`, `type: 'invoice_sent'`, `status: 'sent'|'failed'`,
`recipient`, `error`, `sent_at`) — written from both
`invoice-email.ts:92-100` (real send) and the two failure paths
(`invoice-email.ts:45-53`, `62-70`). This is a real audit trail of *that an
email was attempted*, but it captures none of the invoice's actual
content/amount at send time — only the order id. If the order's line items
or total are edited after the invoice email goes out, there is no way to
recover what the customer was actually shown; regenerating from
`generateInvoicePDF()` later will reflect the *current* order state, not the
sent one.

**The real bug — invoice status ignores `orders.invoice_paid_at` outside the
CRM tab:**

- Migration `009_command_center_crm.sql:36` adds
  `orders.invoice_paid_at TIMESTAMPTZ`, written by
  `app/api/admin/invoices/[id]/mark-paid/route.ts:27-30` when an admin marks
  an invoice paid from the CRM Invoices tab.
- `lib/data/command-center-crm.ts:174-185` (the CRM tab's own status
  calculation, a **second, separate** implementation) correctly checks it:
  `if (o.invoice_paid_at) { status = 'paid'; }` (lines 177-178) before
  falling back to due/overdue/sent/draft logic.
- **`lib/data/invoices.ts`'s `computeStatus()` (lines 27-35) and its
  `OrderInvoiceSource` interface (lines 18-25) never reference
  `invoice_paid_at` at all** — it only branches on `payment_method`/
  `net_terms`/`created_at`. Every caller of this file's `toInvoiceRow()` —
  `invoice-pdf.ts:59` (both the emailed PDF and the customer download route),
  `invoice-email.ts:42` (the "Status" line isn't in the email body, but the
  PDF attached to it is), and `app/account/invoices/page.tsx` (via
  `getInvoiceRows`) — will keep showing **"Due" / "Overdue"** and printing
  **"Payment due `<date>` — Net `<N>` terms"** on the PDF even after an admin
  has marked the invoice paid, because none of the four `orders` `.select()`
  calls that feed `toInvoiceRow()` even fetch the `invoice_paid_at` column
  (`invoice-pdf.ts:136-138`, `invoice-email.ts:28`,
  `app/api/invoices/[id]/pdf/route.ts:19-21`, `lib/data/invoices.ts:66`).
  Net effect: the admin-facing CRM tab and the customer-facing PDF/email/
  account page can permanently disagree about whether an invoice is paid.

---

## 4. What the next prompt should build

1. **Fix the paid-status bug (§3).** In `lib/data/invoices.ts`:
   - Add `invoice_paid_at: string | null` to `OrderInvoiceSource` (line
     18-25).
   - In `computeStatus()` (lines 27-35), check `order.invoice_paid_at` first
     and short-circuit to `{ status: 'paid', dueDate: null }` — mirror
     `command-center-crm.ts:177-178`'s precedence exactly so the two
     implementations can't drift again.
   - Update every `.select()` that feeds `toInvoiceRow()` to include
     `invoice_paid_at`: `lib/data/invoices.ts:66`, `invoice-pdf.ts:136-138`
     (`generateInvoicePDF`'s admin query — also add it to the
     `InvoiceOrderRecord` interface at lines 11-23), `invoice-email.ts:28`
     (add to whatever local type backs `orderRaw`), and
     `app/api/invoices/[id]/pdf/route.ts:19-21` (the customer download
     route's session-scoped query).
   - Consider collapsing `command-center-crm.ts`'s duplicate status logic
     (lines 174-185) to call the fixed `computeStatus()`/`toInvoiceRow()`
     instead of re-implementing it, so there is exactly one place this rule
     lives going forward.

2. **Decide on invoice send history (§3).** Either:
   - (a) explicitly accept the current model — derived-on-demand invoice,
     `notifications` table as the only send log — and document that
     re-sends/PDF downloads always reflect current order state, not a
     point-in-time snapshot; or
   - (b) if AFS needs to know "what did the customer actually see," snapshot
     the rendered invoice (number, line items, amounts, PDF storage key) at
     send time — this would be a new table, a real schema change, and should
     be scoped as its own prompt rather than folded into the status-bug fix
     above.

3. **No action needed on §1 or §2** — dispatch-triggered auto-generation,
   the Resend email with a real attachment, and the required PDF content
   (including material/gauge via the existing `describeItem()` text) all
   already work correctly.

---

*INVOICE_AUDIT.md | AFS | Reid Whitesides | July 2026*
