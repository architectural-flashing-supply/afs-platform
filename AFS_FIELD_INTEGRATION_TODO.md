# AFS_FIELD_INTEGRATION_TODO.md
## Monday Integration Handoff — afs-fl-005

This is a punch list, not a discovery task. Every item below names the exact
file, function, and (where useful) line range where the relevant code
currently sits — Monday's work is filling in each one, not finding it. Every
citation was re-read directly from disk while writing this doc (afs-fl-000
through afs-fl-004, commits `dbf3af8`..`3a43282`), not reconstructed from
memory of those prompts.

---

## 1. Resend API key + verified sender domain

**What's needed:** a real `RESEND_API_KEY` and a verified sending domain so
the completion-flow email can actually be sent, and `completion_events.
email_sent` can flip from its default `false` to `true`.

**Exact stub location:** `app/api/field/shop/[id]/complete/route.ts`, the
`POST` handler (the file's only exported function, lines 23–109). The
"Write 2 of 2" block at lines 65–92 inserts the `completion_events` row and
explicitly never calls Resend — see the comment directly above it:

> "Never call Resend/Twilio/any external API here — that is explicitly out
> of scope for this prompt."

The `.insert({...})` call at lines 74–79 sets only `shop_profile_library_id`,
`order_number`, and `completed_at`. It does not pass `status`,
`email_sent`, `delivery_scheduled`, or `invoice_generated`, so all four sit
at the column defaults declared in `supabase/migrations/020_completion_
events.sql` lines 25–28 (`status` = `'pending_integration'`, the three
booleans = `false`). There is no other write path to this table today — this
is the one function to extend once Resend is wired: send the email, then
`UPDATE completion_events SET email_sent = true, status = ...` for that row.

---

## 2. Delivery-scheduling logic — OPEN QUESTION, not guessed at here

**This is genuinely undecided and this doc does not attempt to decide it.**
`completion_events.delivery_scheduled` defaults to `false`
(`020_completion_events.sql` line 26) and nothing in afs-fl-003 or afs-fl-004
ever sets it to `true` — same insert call cited in item 1 above
(`app/api/field/shop/[id]/complete/route.ts` lines 74–79) leaves it
untouched. There is no code anywhere in this queue that reads shop capacity,
a customer-requested date, or an admin action to decide when a completed job
is actually scheduled for delivery.

**Question for Reid:** what should actually drive `delivery_scheduled` going
from `false` to `true`? Candidates, none chosen:
- Shop capacity / a scheduling algorithm run against completed jobs
- The customer's originally requested delivery date
  (`quote_requests.requested_delivery`, `shop_profile_library.due_date`)
  auto-applied once a job completes
- A manual admin step (an admin explicitly picks/confirms a delivery date
  in Command Center)

And where should that logic live — a new admin UI, a new API route, or a
scheduled job? None of this is implied by the existing schema or code; it
needs Reid's decision before any code gets written here.

---

## 3. Invoice amount source — CONFIRMED queryable, but not directly, and not via `order_number`

**Directly verified by reading the schema and the actual admin quote-send
code** — an approved quote's dollar amount is real, admin-entered data and
is reachable, but only by joining through `quote_request_id`, not through
`shop_profile_library.order_number` (that column is never populated on the
path that creates these shop-floor rows — see below).

**The queryable path:**
1. `completion_events.shop_profile_library_id` →
2. `shop_profile_library.quote_request_id` (set at `app/api/admin/
   command-center/approve-quote-request/route.ts` line 554, inside the
   `insertShopProfileLibraryRecord(...)` call at lines 553–577) →
3. `quote_requests.quote_id` (set at `app/api/admin/quote-requests/[id]/
   send/route.ts` line 182, the `POST` handler's `quote_requests` update
   after the quote is created) →
4. `quotes.id` / `quotes.total` — a real `DECIMAL(10,2) NOT NULL` column
   (`supabase/migrations/001_initial_schema.sql` line 481), computed from
   admin-entered line-item unit prices at `app/api/admin/quote-requests/
   [id]/send/route.ts` lines 127–130 (`subtotal` = sum of
   `computeLineTotal(...)` per line item, `total` = `subtotal + freight`)
   and inserted into `quotes` at lines 135–152.

**Caveat worth flagging to Reid directly:** `shop_profile_library.
order_number` (the column `completion_events.order_number` is copied from,
per `app/api/field/shop/[id]/complete/route.ts` line 77) is declared in
`supabase/migrations/016_source_tool_and_shop_profile_library.sql` line 35
but is never set by the only insert path that creates these rows —
`insertShopProfileLibraryRecord` in `lib/data/shop-profile-library.ts`
(lines 114–159) writes `order_number: input.orderNumber ?? null` at line
126, and the caller at `app/api/admin/command-center/approve-quote-
request/route.ts` lines 553–577 never passes `orderNumber` in that call. So
`order_number` is `null` for every job created through this flow today —
any invoice-amount lookup must join through `quote_request_id` (step 2
above), not `order_number`.

---

## 4. Twilio SMS — optional, not wired to anything

Reid has not confirmed he wants SMS on this flow. **There is no existing
stub to point to for this** — no Twilio import, no SMS-send call, and no
placeholder anywhere in `app/api/field/**` or `components/field/**`. If
Reid wants a completion or delivery SMS, that's new code, not a fill-in.
This item exists on the list only so it isn't silently dropped, not because
anything is half-built.

---

## 5. Google Business Profile — finish the existing integration, don't build a new one

**afs-fl-004's delivery-photo button already queues correctly into the real
pipeline. There is no separate afs-field GBP stub to fill in.**
`components/field/DeliveryPhotoCapture.tsx` uploads to the same
`gbp-photos` Storage bucket and calls the same `POST /api/gbp/queue`
(`app/api/gbp/queue/route.ts`) that the Employee PWA's
`EmployeePhotoUploader.tsx` already uses in production — the only addition
is passing `shopProfileLibraryId` through, which lands in the new nullable
`gbp_photo_queue.shop_profile_library_id` column (migration 021). The photo
enters the exact same `pending_review` → admin-reviewed → `POST /api/gbp/
post/[id]` pipeline every other GBP photo already goes through. Confirmed
by reading `components/field/DeliveryPhotoCapture.tsx` in full and
`app/api/gbp/queue/route.ts` in full.

**The only remaining GBP work is provisioning real credentials / building
the OAuth flow** — this is shared infrastructure with the existing Employee
PWA's GBP posting, not something specific to `/field`. The exact gap, cited
directly from `lib/integrations/google-business.ts`'s own header comment
(lines 12–21), its own **DEVIATION FLAGGED (d-007)**:

> "a CLIENT_ID/SECRET pair is an OAuth *app* credential, not a bearer access
> token — actually calling the v4 Media API needs a per-request OAuth
> access token, which only exists once a real authorization-code exchange +
> refresh-token flow is built behind `/admin/settings/integrations` (not
> built). Until then, `GOOGLE_BUSINESS_ACCESS_TOKEN` is a manual stand-in
> env var (paste a token obtained via Google's OAuth Playground or a one-off
> script) — `isGbpConfigured()` intentionally does NOT check for it..."

Concretely: `isGbpConfigured()` (`lib/integrations/google-business.ts`
lines 33–39) only checks `GOOGLE_BUSINESS_CLIENT_ID` /
`GOOGLE_BUSINESS_CLIENT_SECRET` / `GOOGLE_BUSINESS_LOCATION_ID`. Actually
posting a photo (`postPhotoToGbp()`, lines 47–80) additionally requires
`GOOGLE_BUSINESS_ACCESS_TOKEN` (checked at lines 52–59), which today is only
ever a manually pasted token, not a real OAuth flow. Fixing this means
either (a) provisioning a long-lived manual token as a stopgap, or (b)
building the real authorization-code + refresh-token flow behind
`/admin/settings/integrations` (not built anywhere in this codebase). Either
fix benefits the Employee PWA's existing GBP posting too — it is the same
code path, not a duplicate.

---

## Migrations still pending manual Supabase Dashboard application

Apply in this order (both are additive, neither has been applied to the
live Supabase project as of this doc):

1. `supabase/migrations/020_completion_events.sql` — creates
   `completion_events` (afs-fl-003).
2. `supabase/migrations/021_gbp_photo_queue_shop_job_link.sql` — adds the
   nullable `gbp_photo_queue.shop_profile_library_id` column (afs-fl-004).

**Neither needs elevated review beyond the normal pending-apply process.**
Both are read directly, in full, as part of writing this doc:
`020_completion_events.sql` only creates a new table with its own RLS
policy (`admin_all_completion_events`, mirroring `shop_profile_library`'s
existing admin policy); `021_gbp_photo_queue_shop_job_link.sql` only adds
one nullable FK column and an index to the existing `gbp_photo_queue`
table, explicitly relying on that table's existing RLS policies (see the
migration's own comment, lines 32–36) rather than adding new ones. Unlike
an earlier, discarded design for this feature, **neither migration alters
`profiles` or any other table afs-website's existing production code
depends on for its security model.**

---

*AFS_FIELD_INTEGRATION_TODO.md | AFS — Architectural Flashing Supply | Reid Whitesides | August 2026*
