# NOTIFICATION_AUDIT.md
## Customer email wiring — actual vs. claimed, verified against source

Scope: the 6 order/quote lifecycle transitions that should send a customer
email via `lib/resend/send.ts`'s `sendEmail()`. For each: is it wired today,
and if not, exactly what needs to change (real file/line).

Reference files read: `lib/resend/client.ts`, `lib/resend/send.ts`,
`lib/resend/templates/base.ts`, and every route under `app/api/orders/[id]/**`
(`delivered`, `dispatch`, `packaged`, `picked-up`, `reorder`), plus the routes
that actually own the other 4 transitions (found via grep, since none of them
live under `app/api/orders/[id]/**`).

**Pattern to recognize:** a route that inserts a `notifications` row with
`status: 'sent'` is not evidence of an email being sent — `lib/resend/client.ts`
lines 6-11 note this was the codebase-wide stub pattern before `lib/resend/send.ts`
existed, and two of the six transitions below still do exactly this: fabricate
a "sent" log row without ever calling `sendEmail()`.

---

## Summary table

| # | Transition | Wired to `sendEmail()`? | Owning file |
|---|---|---|---|
| 1 | Quote request received | ❌ No — no notification code at all | `app/api/quote-requests/route.ts` |
| 2 | Job approved | ❌ No — no notification code at all | `app/api/admin/command-center/approve-quote-request/route.ts` |
| 2 | In production (`in_queue`/`cutting`/`bending`/`qc`) | ❌ No — fabricates a `notifications` row instead | `app/api/admin/orders/[id]/status/route.ts` |
| 3 | Order ready (`ready`) | ❌ No — same fabricated-row code path as above | `app/api/admin/orders/[id]/status/route.ts` |
| 4 | Dispatched / on the way | ✅ Yes | `app/api/orders/[id]/dispatch/route.ts` |
| 5 | Invoice attached | ✅ Yes | `lib/utils/invoice-email.ts` (`sendInvoiceEmail`), called from `dispatch/route.ts` and `app/api/invoices/[id]/send/route.ts` |
| 6 | Delivered confirmation | ❌ No — no notification code at all | `app/api/orders/[id]/delivered/route.ts` and `app/api/orders/[id]/picked-up/route.ts` |

4 of 6 are silent no-ops. Only dispatch and invoice-attached actually call Resend.

---

## 1. Quote request received — NOT WIRED

**File:** `app/api/quote-requests/route.ts`, `POST` handler.

The insert into `quote_requests` happens at lines 106-117:

```
106	    const { error: insertError } = await admin.from('quote_requests').insert({
...
117	    });
```

There is no `import` of `sendEmail` or `baseEmailTemplate` anywhere in this
file, and no `notifications` table insert either — not even a fake one. The
customer (or guest) who just submitted a request gets nothing.

**What needs to call what:** after the insert succeeds (after line 117, before
building `response` at line 124), resolve a recipient address —
`user?.email` if authenticated (the route already has `user` from line 87,
but only fetches `auth.getUser()`, not the profile row — would need a
`profiles.email` lookup by `user.id`, or fall back to `guestEmail` at line 89
for guest submissions) — then:

```ts
import { sendEmail } from '@/lib/resend/send';
import { baseEmailTemplate } from '@/lib/resend/templates/base';
```

and call `sendEmail({ to, subject: \`We've Received Your Quote Request #${requestNumber}\`, html: baseEmailTemplate(...) })`, followed by a `notifications` insert using the *real* `result.success` value (mirror the pattern already used correctly in `app/api/orders/[id]/dispatch/route.ts` lines 162-176).

---

## 2. Job approved / in production — NOT WIRED (two separate gaps)

This transition maps to two different pieces of code in this repo, both unwired:

### 2a. Job approved

**File:** `app/api/admin/command-center/approve-quote-request/route.ts`, `POST` handler, lines 202-245.

This inserts a `machine_jobs` row (`status: 'approved_for_machine'`, lines
202-225) and updates `quote_requests.status` to `'reviewing'` (lines 228-237).
No `sendEmail` import, no `notifications` insert — nothing. The customer whose
job just moved into production has no idea.

**What needs to call what:** after the `quote_requests` update succeeds (after
line 237, before `logAdminAction` at line 239), fetch `qr.user_id`'s profile
email and call `sendEmail()` with a "your job has been approved and moved to
production" template, then insert a `notifications` row (`type:
'job_approved'`) with the real send result.

### 2b. In production (`in_queue` / `cutting` / `bending` / `qc`)

**File:** `app/api/admin/orders/[id]/status/route.ts`, lines 81-100:

```
81	    // Notification failure must never block the status change (ARCHITECTURE.md §9).
82	    if (NOTIFICATION_STAGES.includes(newStatus)) {
83	      try {
84	        const { data: customerProfile } = await supabase
85	          .from('profiles')
86	          .select('email')
87	          .eq('id', order.user_id)
88	          .single();
89	        await supabase.from('notifications').insert({
90	          order_id: order.id,
91	          user_id: order.user_id,
92	          channel: 'email',
93	          type: 'order_status_changed',
94	          recipient: (customerProfile?.email as string | undefined) ?? '',
95	          status: 'sent',
96	        });
97	      } catch (notifyError) {
98	        console.error('[Order Status Notification Error]', notifyError);
99	      }
100	    }
```

`NOTIFICATION_STAGES` (`lib/admin/orderStages.ts` line 27) is
`['submitted', 'in_queue', 'cutting', 'ready', 'shipped', 'delivered']` — so
this block is the intended trigger for the "in production" and "ready"
transitions (and for `submitted`/`shipped`/`delivered` too, which overlap with
findings #1, #3, and #6 below). It looks up the customer's email correctly,
then **hardcodes `status: 'sent'` at line 95 without ever calling
`sendEmail()`**. This is the exact fabricated-log pattern
`lib/resend/client.ts`'s header comment warns about — it was apparently never
updated after `lib/resend/send.ts` was built.

**What needs to call what:** import `sendEmail`/`baseEmailTemplate`, build a
status-specific template keyed on `newStatus` (or a shared generic "your order
status changed to X" template), call `sendEmail({ to: customerProfile.email,
... })` before the `notifications` insert, and set `status:
emailResult.success ? 'sent' : 'failed'` (and `error: emailResult.error`) at
line 95 instead of the current hardcoded literal.

Note `bending` and `qc` are *not* in `NOTIFICATION_STAGES`, so even after this
fix, those two intermediate stages still won't email — that's a scope
decision already encoded in `orderStages.ts`, not a separate bug, but worth
confirming is intentional.

---

## 3. Order ready — NOT WIRED

Same code path and same fix as 2b: `'ready'` is in `NOTIFICATION_STAGES`
(`lib/admin/orderStages.ts` line 27), so it flows through
`app/api/admin/orders/[id]/status/route.ts` lines 81-100 above and hits the
same hardcoded `status: 'sent'` at line 95. No separate route owns "ready".

---

## 4. Dispatched / on the way — WIRED

**File:** `app/api/orders/[id]/dispatch/route.ts`, lines 137-177.

Real call:

```
162	      const emailResult = await sendEmail({
163	        to: email,
164	        subject: `Your AFS Order #${order.order_number} Is On The Way`,
165	        html,
166	      });
167	      emailSent = emailResult.success;
168	      await admin.from('notifications').insert({
...
174	        status: emailResult.success ? 'sent' : 'failed',
175	        error: emailResult.success ? null : emailResult.error,
176	      });
```

This is the correct pattern — actually calls `sendEmail()` and logs the real
result. Also sends SMS (lines 115-130, gated on `sms_opt_in`) and triggers
the invoice email (line 180, see #5).

---

## 5. Invoice attached — WIRED

**File:** `lib/utils/invoice-email.ts`, `sendInvoiceEmail()`, lines 85-100.

```
85	  const result = await sendEmail({
86	    to: profile.email,
87	    subject: `Your AFS Invoice #${invoice.invoiceNumber}`,
88	    html,
89	    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
90	  });
```

Called automatically from `app/api/orders/[id]/dispatch/route.ts` line 180
(bundled into dispatch), and separately from `app/api/invoices/[id]/send/route.ts`
for manual resend from the CRM Invoices tab. Correctly logs real
success/failure to `notifications` (lines 92-100).

---

## 6. Delivered confirmation — NOT WIRED

**File:** `app/api/orders/[id]/delivered/route.ts`, entire `POST` handler
(lines 7-70).

The `orders` select at lines 17-21 only fetches `id, status` — there isn't
even a `user_id` or `order_number` in scope to email with. The handler updates
`orders.status` (lines 33-40), inserts `order_status_history` (lines 42-47),
and calls `logAdminAction` (lines 56-63) — no `sendEmail` import, no
`notifications` insert anywhere in the file.

**File:** `app/api/orders/[id]/picked-up/route.ts` — the pickup counterpart,
which per its own comment (lines 14-21) reuses the same `'delivered'` status.
Same gap: the select at lines 33-37 (`id, status, delivery_method,
delivery_address`) also omits `user_id`, and there is no `sendEmail` import or
`notifications` insert in this file either.

**What needs to call what:** in both files, widen the `orders` select to
include `user_id` and `order_number`, then after the `order_status_history`
insert and before `logAdminAction`, fetch the customer's `profiles.email` /
`full_name` and call `sendEmail()` with a "your order has been delivered"
template (`delivered/route.ts`) or a "picked up" variant
(`picked-up/route.ts`), followed by a `notifications` insert with the real
result — same shape as `dispatch/route.ts` lines 162-176.

---

## Related finding outside the requested 6 (same root cause)

**File:** `app/api/admin/quote-requests/[id]/send/route.ts`, lines 188-204 —
the "formal quote sent to customer" transition (distinct from "quote request
received," #1 above) has the identical hardcoded-`status: 'sent'`-without-
`sendEmail()` pattern as #2b/#3. Not one of the six transitions in scope for
this audit, but it's the same bug and likely wants the same fix pass.
