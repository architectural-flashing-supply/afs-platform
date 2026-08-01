# BID_DOCUMENT_SCOPE.md
## Project-level bid documents — data model decision + exact build scope
**Investigation and decision record only. No code or migrations written in this pass.**

---

## 0. WHAT WAS READ

ARCHITECTURE.md §6 (order lifecycle) and §11 (machine bridge, as a second
precedent for a "separate lifecycle, same repo" pattern); SCHEMA.md TABLE
15–17 (`quote_requests`/`quotes`/`quote_line_items`) and the MACHINE BRIDGE
TABLES section; SPEC_QUOTE_BUILDER.md in full; `app/api/admin/quote-requests/
[id]/send/route.ts`; `components/admin/GbpPhotosTab.tsx` +
`app/api/admin/gbp/[id]/{approve,reject}/route.ts`; `ORDER_LIFECYCLE_
DECISION.md`; `lib/data/command-center-dashboard.ts`; `components/admin/
ProductionQueueRealtime.tsx`; `components/track/DeliveryTrackingMap.tsx`
(the actual Realtime-subscription precedent — see §4); `lib/auth/require-
operator.ts`; `app/employee/layout.tsx`; `supabase/migrations/
007_delivery_tracking.sql` and `010_bid_monitor.sql`; `lib/admin/pricing.ts`;
`components/admin/PendingQuoteRequestCard.tsx`; `components/layout/
AdminShell.tsx`; `app/admin/command-center/page.tsx`.

Two things found while reading that change the design and are called out
up front rather than buried:

1. **`bid_projects`/`bid_sources` already exist** (migration
   `010_bid_monitor.sql`) — a *different* feature ("Bid Monitor") that
   scrapes public procurement portals for opportunities AFS might want to
   chase. It is not the feature this document scopes. New table names below
   deliberately avoid colliding with it (`bid_documents`, not `bids`), and
   §2 defines an optional FK from the new feature into the old one, because
   a bid document AFS submits to a GC often *originates* from an
   opportunity Bid Monitor already surfaced.
2. **Steve — one of the two named pricing staff — is not necessarily an
   `admin`.** `app/employee/layout.tsx` (lines 16–24) and `lib/auth/
   require-operator.ts` both gate on `role IN ('operator','admin')`
   specifically because Steve's account is scoped as `operator`, and the
   comment in `007_delivery_tracking.sql` (line 31: "Steve and Christian
   both need to see and act on each other's queued photos") confirms
   Steve does real work on this system under the `operator` role, not
   `admin`. If bid-document auth followed the `send/route.ts` /
   `pricing_rules` precedent (`role !== 'admin'` → 403), Steve would be
   locked out of a feature he is named as one of exactly two users of.
   **Every RLS policy and API auth check in this design uses the
   `requireOperatorApi` pattern (`role IN ('operator','admin')`), not the
   admin-only pattern** — this is the load-bearing reason, not a stylistic
   choice.

---

## 1. DECISION: new parallel tables, not an extension of quote_requests/quotes

**Build `bid_documents` / `bid_document_sections` / `bid_document_line_items`
as new tables. Do not add a `type` column to `quote_requests` or `quotes`.**

### 1.1 The line-item shape genuinely does not fit

`quote_requests.line_items` (JSONB) and `quote_line_items` (real columns)
are both shaped around **one flashing profile per line**: `profileId`,
`materialId`, `gaugeId`, `finishId`, `width_in`/`height_in`/`leg_a_in`/
`leg_b_in`, `length_ft`, `quantity`, `unit`. Every column and every UI in
SPEC_QUOTE_BUILDER.md exists to drive the flashing configurator
(`ProfileTypeSelector` → `MaterialSelector` → `GaugeSelector` →
dimension inputs keyed off `product_profiles.min_*`/`max_*`).

The real AFS bid document (NBISD Long Creek Ph 1 / Omega Waterproofing)
has a different shape entirely:

```
AFS header (logo/address/phone)
Project name · GC/contact name · date
─── repeating ───
  Work description (free text, e.g. "Coping Cap — North Parapet")
    qty │ dimension/spec string (free text) │ unit price │ extended price
    qty │ dimension/spec string (free text) │ unit price │ extended price
    ...
─── /repeating ───
Disclaimers: price validity window, delivery terms, tax exclusion
Free-text note to customer
```

The "dimension/spec" cell is a **free-text string** written by Trica/Steve
by hand (e.g. `24 GA GALV, 12" girth, mill finish`) — there is no
`profileId`/`materialId`/gauge selection anywhere in the source document,
and no reason to force one: these are manually-priced bid line items, not
configurator output. Coercing this into `quote_line_items`' typed
`width_in`/`leg_a_in`/etc. columns would leave every one of those columns
null and stuff the actual content into a column that doesn't exist there.
The grouping level itself is different too — a bid document groups line
items under a **work-description heading** (`bid_document_sections`),
which `quote_line_items` has no equivalent of at all — a quote is a flat
list of line items with no section headers, because a flashing order
doesn't need one.

### 1.2 The lifecycle and audience are different, not just the shape

- `quote_requests`/`quotes` are always tied to `profiles.id` (`user_id`),
  because the flow's whole point is a *registered AFS customer* who logs
  into `/account/quotes/[id]` to view and approve. A bid document goes to
  a **GC**, who is very often not an AFS platform account holder at all —
  `gc_name`/`gc_contact_email` need to be free text, the same way
  `bid_projects.agency` (migration 010) already is, not a FK into
  `profiles`/`companies`.
- A quote is priced once, atomically, in a single `send/route.ts` POST
  (§ read above — the whole `lineItems` array arrives with every
  `unitPrice` already filled in, computed client-side in one form
  submission). A bid document is priced **incrementally, by hand, over
  what can be an extended work session**, which is exactly why claim-lock,
  autosave, and multi-viewer presence (§3) are requirements here and have
  never been a requirement anywhere in the quote flow — nothing in
  `quote_requests`/`quotes` has ever needed a "someone else is editing
  this" concept, because nothing else in this schema is hand-edited by
  staff over time before being sent.
- `quotes.status` (`draft/sent/approved/expired/converted/cancelled`) is
  wired end-to-end into Stripe/checkout/`orders` (ARCHITECTURE.md §6). A
  bid document's real-world outcome is **won or lost against other
  bidders**, which has no equivalent anywhere in the quote→order pipeline
  and must not be modeled as if it were one (see §5 for what happens if a
  bid is won — explicitly out of scope here, not silently assumed).
- RLS: every `quote_requests`/`quotes` policy is customer-scoped
  (`auth.uid() = user_id`) plus an admin-all policy. A bid document is
  **never** customer-visible — the GC receives it as a printed/emailed
  document, not a portal login — so it only ever needs the single
  operator/admin policy described in §2, with no customer-facing branch
  at all.

### 1.3 What *is* reused

- `computeLineTotal`/`round2`-style helpers in `lib/admin/pricing.ts` —
  extended, not duplicated (§6).
- `profiles` for `claimed_by`/`created_by` — same FK pattern as
  `quotes.created_by`.
- `bid_projects.id` — optional FK, so a bid document created from a Bid
  Monitor opportunity keeps that link (nullable; most bid documents will
  have no monitored opportunity behind them, e.g. a GC calling AFS
  directly).
- The Command Center CRM-tab pattern (`CustomersCrmTab`/`OrdersCrmTab`/
  `InvoicesCrmTab`/`GbpPhotosTab`) — extended with one more tab, not a new
  top-level admin section (§5).
- The Realtime `postgres_changes`-over-a-real-table pattern from
  `ProductionQueueRealtime.tsx` and `DeliveryTrackingMap.tsx`'s
  `useLiveDriverLocation` — reused as-is for both claim-state and presence
  (§3, §4). No Supabase Presence-channel API is introduced — grepping the
  whole repo for `.channel(` turns up exactly `ProductionQueueRealtime.tsx`,
  `OrderRealtimeListener.tsx`, and `DeliveryTrackingMap.tsx`, and all three
  use plain `postgres_changes` subscriptions over a real table, never the
  ephemeral Presence API. Introducing Presence here would be a second,
  parallel realtime idiom in a codebase that has consistently used one.

---

## 2. EXACT NEW TABLES (migration `013_bid_documents.sql` — next free number;
`012_machine_jobs_fallback_geometry.sql` is the highest that exists on disk)

Four tables. RLS on all four is the **operator/admin** pattern (§0.2), not
the admin-only pattern `quotes`/`pricing_rules` use — this is the one
deliberate deviation from those tables' precedent, and it's deliberate for
the reason given in §0.2, not an oversight.

```sql
CREATE TABLE bid_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_number         TEXT UNIQUE NOT NULL,       -- AFS-BID-2026-XXXXX
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','awarded','lost','expired','withdrawn')),
  project_name       TEXT NOT NULL,
  gc_name            TEXT NOT NULL,               -- free text, e.g. "Omega Waterproofing"
  gc_contact_name    TEXT,
  gc_contact_email   TEXT,
  gc_contact_phone   TEXT,
  project_location   TEXT,
  bid_project_id     UUID REFERENCES bid_projects(id),  -- optional link to a Bid Monitor opportunity
  price_valid_until  DATE,
  delivery_terms     TEXT,
  tax_note           TEXT NOT NULL DEFAULT 'Price excludes applicable sales tax.',
  customer_note      TEXT,                        -- free-text note to the GC, printed on the document
  subtotal           DECIMAL(10,2),                -- NULL until first line item exists; sum of line extended_price
  claimed_by         UUID REFERENCES profiles(id),
  claimed_at         TIMESTAMPTZ,
  last_activity_at   TIMESTAMPTZ,                  -- heartbeat; drives auto-release (§3)
  created_by         UUID NOT NULL REFERENCES profiles(id),
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bid_documents_status ON bid_documents(status);
CREATE INDEX idx_bid_documents_claimed_by ON bid_documents(claimed_by);

ALTER TABLE bid_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_documents" ON bid_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

CREATE TABLE bid_document_sections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id            UUID NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
  work_description  TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_bid_document_sections_bid ON bid_document_sections(bid_id);

ALTER TABLE bid_document_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_document_sections" ON bid_document_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

CREATE TABLE bid_document_line_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id     UUID NOT NULL REFERENCES bid_document_sections(id) ON DELETE CASCADE,
  quantity       DECIMAL(10,2) NOT NULL,
  spec_text      TEXT NOT NULL,       -- free-text dimension/spec, e.g. `24 GA GALV, 12" girth`
  unit           TEXT NOT NULL DEFAULT 'LF',
  unit_price     DECIMAL(10,4) NOT NULL,
  extended_price DECIMAL(10,2) NOT NULL,   -- server-computed = round2(quantity * unit_price), never client-trusted
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_bid_document_line_items_section ON bid_document_line_items(section_id);

ALTER TABLE bid_document_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_document_line_items" ON bid_document_line_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );

-- Presence table — see §3.4. Ephemeral by design: rows are upserted on a
-- heartbeat and deleted on unmount, exactly like driver_locations rows are
-- append-only pings, not a durable record.
CREATE TABLE bid_document_viewers (
  bid_id        UUID NOT NULL REFERENCES bid_documents(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bid_id, user_id)
);

CREATE INDEX idx_bid_document_viewers_bid ON bid_document_viewers(bid_id);

ALTER TABLE bid_document_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator_all_bid_document_viewers" ON bid_document_viewers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('operator','admin'))
  );
```

`bid_number` sequence: identical pattern to `send/route.ts`'s
`nextQuoteNumber()` (lines 48–64) — prefix `AFS-BID-{year}-`, zero-padded
5-digit sequence, computed by querying the max existing `bid_number` for
the current year. No new sequence table needed, same as quotes.

---

## 3. CLAIM-LOCK MECHANISM

### 3.1 What it is: a soft, advisory lock — not a security boundary

Every eligible user (`role IN ('operator','admin')`) already has full RLS
read/write access to every `bid_documents` row. The claim is a **UI
coordination signal** ("someone else is actively working on this"), not an
access-control gate — nothing in this design returns 403 for touching a
bid someone else has claimed. This is what requirement (b)'s "mutual
override, not admin-gated" means in practice: overriding an existing claim
is not a privileged action requiring a permission tier above ordinary
claim-eligibility. Given the eligible set is just {Trica, Steve} (today),
"mutual override" and "no extra gate" collapse to the same rule: **the
claim POST always succeeds and always overwrites whoever currently holds
it.** There is no 409/"already claimed" error response anywhere in this
design.

### 3.2 Columns (already defined in §2)

- `claimed_by` (nullable FK) — who currently holds the claim.
- `claimed_at` — when the current claim started (display: "Claimed 12 min ago").
- `last_activity_at` — heartbeat, bumped by (a) any successful PATCH to the
  bid or its sections/line items, and (b) an idle heartbeat ping from the
  builder page every 2 minutes while it's open (§3.5). This is the single
  timestamp both the auto-release rule (3.3) and the presence display
  (3.4) key off of — no second "presence" timestamp is needed on
  `bid_documents` itself, because `bid_document_viewers.last_seen_at`
  already covers per-viewer liveness separately (multiple people can be
  *viewing* without any of them holding the *claim*).

### 3.3 Auto-release on inactivity (requirement c)

A single exported constant, `CLAIM_INACTIVITY_TIMEOUT_MINUTES = 30`, lives
in `lib/data/bid-documents.ts` next to a helper:

```typescript
export function isClaimActive(claimedBy: string | null, lastActivityAt: string | null): boolean {
  if (!claimedBy || !lastActivityAt) return false;
  return Date.now() - new Date(lastActivityAt).getTime() < CLAIM_INACTIVITY_TIMEOUT_MINUTES * 60_000;
}
```

This is computed **lazily at read time**, exactly the way
`MachineBridgeStatusDot.tsx` (lines 39–40) computes `connected` by
comparing `lastPingAt` against `CHECK_INTERVAL_MS` — no cron job, no
scheduled task clearing the columns. A bid whose claim has gone stale
simply reads as unclaimed everywhere in the UI (list tab, detail page)
without any row ever being written to mark it so; the columns get
physically cleared the next time *anyone* successfully claims it (§3.1 —
claim always overwrites). This satisfies "an incapacitated claimant can
never permanently block a bid" without inventing a new background-job
mechanism this codebase doesn't otherwise have for this kind of thing.

### 3.4 API routes (bid-doc-002 — see §6)

- `POST /api/admin/bid-documents/[id]/claim` — `requireOperatorApi`;
  unconditionally sets `claimed_by = self`, `claimed_at = now()`,
  `last_activity_at = now()`. Called automatically when the builder page
  loads on a bid that reads as unclaimed (§3.1's "any staff member
  claiming an unclaimed bid" — no explicit click needed for the common
  case), and called explicitly by a "Take Over" button when the bid reads
  as actively claimed by someone else.
- `POST /api/admin/bid-documents/[id]/release` — `requireOperatorApi`;
  unconditionally clears `claimed_by`/`claimed_at`/`last_activity_at` to
  `NULL`. Any eligible user can release any claim, not just their own —
  same "not admin-gated" reasoning as claim.
- `POST /api/admin/bid-documents/[id]/heartbeat` — `requireOperatorApi`;
  if `claimed_by === self`, sets `last_activity_at = now()` and returns
  `{ stillClaimed: true }`. If someone else now holds the claim (another
  tab took over since this page loaded), makes no write and returns
  `{ stillClaimed: false, claimedBy: <name> }` — the client uses this to
  flip the builder into read-only mode without waiting for the realtime
  subscription (belt-and-suspenders; §3.6 covers the realtime path too).

### 3.5 Client heartbeat

The builder page (bid-doc-003) runs a `setInterval` at 2 minutes, matching
`MachineBridgeStatusDot`'s own `setInterval(check, CHECK_INTERVAL_MS)`
precedent, calling the heartbeat route while mounted and claimed by self.
No Page Visibility API, no `sendBeacon` — kept to the same simplicity level
as the one existing polling precedent in this codebase.

### 3.6 Claim-state realtime (requirement b's live reclaim, and d's context)

A client component, `BidDocumentRealtime.tsx`, mounted only on the
detail/builder page, subscribed exactly like `ProductionQueueRealtime.tsx`:

```typescript
supabase
  .channel(`bid-document-${bidId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bid_documents', filter: `id=eq.${bidId}` },
    () => router.refresh())
  .subscribe();
```

Any claim change (including a peer's override) triggers a server refetch,
so a user mid-edit sees the page flip to "Claimed by Steve" / read-only
the moment Steve takes over — no manual reload, matching the "live" bar
set by the delivery-tracking dot and the production queue.

### 3.7 Presence — "who is currently viewing" (requirement d)

Backed by `bid_document_viewers` (§2), not the Presence API, per §1.3's
reasoning. Flow:

1. On mount, the builder page calls `POST /api/admin/bid-documents/[id]/
   viewer-ping` — an upsert (`INSERT ... ON CONFLICT (bid_id, user_id) DO
   UPDATE SET last_seen_at = now()`), `requireOperatorApi`. Repeats every
   20 seconds while mounted (same `setInterval` pattern as the heartbeat).
   Best-effort `DELETE` of the row in the unmount cleanup — best-effort
   because a closed tab won't always fire it, which is why staleness
   filtering (next step) is the real mechanism, not row deletion.
2. `GET /api/admin/bid-documents/[id]/viewers` returns viewer rows joined
   to `profiles.full_name`, filtered server-side to `last_seen_at` within
   60 seconds — anyone whose ping has gone stale (tab closed, laptop
   asleep) simply stops appearing, no cleanup job required.
3. A second small client component, `BidDocumentViewers.tsx`, subscribes
   the same way as `useLiveDriverLocation` (`DeliveryTrackingMap.tsx`
   lines 61–88) — `postgres_changes` with `event: '*'` on
   `bid_document_viewers` filtered by `bid_id=eq.[id]` — and on every
   event, re-calls the `GET /viewers` route and re-renders the list
   (mirroring that hook's "any change → refetch" shape; it does not try to
   reconstruct viewer state from the raw payload the way `driver_locations`
   doesn't either — it just triggers a fresh read).
4. Renders as a small row of name chips ("Also viewing: Steve") next to
   the claim badge — excludes the current user and the claimant (already
   shown separately) from the list.

---

## 4. WHERE THIS SURFACES IN COMMAND CENTER

**New tab in the existing CRM tab strip — not a new top-level page, not an
extension of an existing tab.** `app/admin/command-center/page.tsx`'s
`CrmTab` type (line 31) and `CRM_TABS` array (line 40) already hold
`customers`/`orders`/`invoices`/`gbp`; add a fifth: `{ value: 'bids',
label: 'Bids' }`. This is a one-line extension of an established, working
pattern (four tabs already follow this exact shape), not a new mechanism.

The list view (`BidsCrmTab.tsx`) follows `GbpPhotosTab.tsx`'s shape (a
`'use client'` component taking server-fetched initial data, no page-level
data fetching of its own) but as a table/card list, not a photo grid:
`bid_number`, `project_name`, `gc_name`, status badge (`Badge` component;
`draft`→`chrome`, `sent`→`info`, `awarded`→`success`, `lost`/`expired`→
`error`, `withdrawn`→`chrome`), claim badge ("Unclaimed" / "Claimed by
{name} · {relative time}" / "Claimed by you"), each row linking to
`/admin/command-center/bids/[id]`. A "+ New Bid" control opens a two-field
form (`project_name`, `gc_name` — the only two `NOT NULL` columns besides
system-generated ones), posts to `POST /api/admin/bid-documents`, then
navigates to the new bid's detail page.

Also add one `AdminShell.tsx` nav shortcut, matching the existing
`🚚 Deliveries` → `/admin/command-center?tab=orders` and `📸 GBP Photos` →
`/admin/command-center?tab=gbp` entries already in `NAV_SECTIONS`'
`Operations` section (lines 26–30): `📋 Bids` →
`/admin/command-center?tab=bids`. Same precedent, same one-line diff.

---

## 5. OUT OF SCOPE — explicitly, so it isn't silently assumed by whoever builds this

**What happens when a bid is awarded/won is not designed here.** Nothing
in this document creates an `orders`, `quotes`, or `quote_requests` row
from a `bid_documents` row, and bid-doc-002/003 must not either. Marking a
bid `awarded` is just a status update — turning a won bid into an actual
production order is a separate, real business decision (does it go through
the customer portal at all, given the GC may have no AFS account? does
Trica/Steve manually re-key it into a quote?) that should get its own
scoping pass once this base feature exists, the same way
`ORDER_LIFECYCLE_DECISION.md` treated Command Center's machine-approval
step as deliberately separate from order creation rather than blurring the
two.

---

## 6. EXACTLY WHAT bid-doc-002 SHOULD BUILD

1. `supabase/migrations/013_bid_documents.sql` — the four tables, indexes,
   and RLS policies exactly as written in §2. Nothing else in this
   migration file.
2. SCHEMA.md — add a "BID DOCUMENT TABLES (migration
   013_bid_documents.sql)" section after "MACHINE BRIDGE TABLES", same
   format/tone as that section, cross-referencing this document instead of
   re-deriving the reasoning.
3. `lib/data/bid-documents.ts`:
   - Types: `BidDocumentRow` (list shape), `BidDocumentDetail` (list shape
     + nested `sections: (BidDocumentSection & { lineItems:
     BidDocumentLineItem[] })[]`).
   - `getBidDocuments(supabase): Promise<BidDocumentRow[]>` — all bids,
     newest first, with `claimedByName` resolved via a `profiles` join
     (pattern: `getRecentQuoteRequests`'s manual `profiles.select('id,
     full_name').in('id', ...)` join, `command-center-dashboard.ts` lines
     88–92).
   - `getBidDocument(supabase, id): Promise<BidDocumentDetail | null>`.
   - `nextBidNumber(supabase): Promise<string>` — same shape as
     `send/route.ts`'s `nextQuoteNumber`.
   - `CLAIM_INACTIVITY_TIMEOUT_MINUTES` constant and `isClaimActive()`
     helper, exactly as in §3.3 — the single source of truth both API
     routes and list/detail rendering import, so the threshold can never
     drift between the two.
4. `app/api/admin/bid-documents/route.ts` — `POST` only. `requireOperatorApi`.
   Body: `{ projectName: string, gcName: string }`, both required
   non-empty. Generates `bid_number` via `nextBidNumber`, inserts with
   `status: 'draft'`, `created_by: self`. Returns `{ bidId, bidNumber }`.
5. `app/api/admin/bid-documents/[id]/claim/route.ts`,
   `.../release/route.ts`, `.../heartbeat/route.ts` — exactly as specified
   in §3.4.
6. `app/admin/command-center/page.tsx` — extend `CrmTab`/`CRM_TABS` per
   §4; wire `getBidDocuments(supabase)` into the existing `activeTab ===
   'bids' ? ... : Promise.resolve([])` `Promise.all` block, following the
   exact shape already used for `crmCustomers`/`crmInvoices`/`crmGbpPhotos`
   in that same function (lines 189–196).
7. `components/admin/BidsCrmTab.tsx` — per §4.
8. `components/layout/AdminShell.tsx` — one-line nav entry, per §4.
9. Governance update per CLAUDE.md rule 8 (STATE_OF_THE_BUILD.md /
   SESSION_STATE.md from a live audit).

**Explicitly not in bid-doc-002:** the detail/builder page, line-item
CRUD, presence, and document output — all of §7.

## 7. EXACTLY WHAT bid-doc-003 SHOULD BUILD

1. `app/admin/command-center/bids/[id]/page.tsx` — server component,
   `requireAdminUser`-style auth but checking `role IN ('operator','admin')`
   (mirror `requireOperatorApi`'s check, server-component form — i.e. the
   same redirect-on-fail shape `app/employee/layout.tsx` uses, not the API
   401/403 JSON shape, since this is a page not a route handler). 404 (via
   `notFound()`) if `getBidDocument` returns null. Renders
   `BidBuilder` with the initial detail payload.
2. `components/admin/BidBuilder.tsx` (`'use client'`):
   - On mount: if `!isClaimActive(...)`, immediately call the claim route
     (silent auto-claim — §3.1/§3.4). If claimed by someone else and
     active, render in read-only mode with a "Take Over" button.
   - Header fields (`project_name`, `gc_name`, `gc_contact_name`,
     `gc_contact_email`, `gc_contact_phone`, `project_location`,
     `price_valid_until`, `delivery_terms`, `tax_note`, `customer_note`) —
     debounced autosave via `PATCH /api/admin/bid-documents/[id]` (new
     route, this prompt's scope). Every successful PATCH bumps
     `last_activity_at` server-side in the same handler — no separate
     heartbeat call needed for active editing, only for idle-but-open time
     (§3.5).
   - Section/line-item builder: "+ Add Work Description" →
     `POST /api/admin/bid-documents/[id]/sections`; "+ Add Line" within a
     section → `POST /api/admin/bid-documents/[id]/sections/[sectionId]/
     line-items`, body `{ quantity, specText, unit, unitPrice }`. Server
     computes `extended_price` (new helper, §8) and recomputes
     `bid_documents.subtotal` as the sum across all line items in the same
     request — same "server computes the number that matters" discipline
     `send/route.ts` already applies to `subtotal`/`total`, never
     client-trusted.
   - Claim banner + Release button; heartbeat interval (§3.5);
     `BidDocumentRealtime.tsx` (§3.6) and `BidDocumentViewers.tsx` (§3.7)
     both mounted here only.
   - Status buttons: "Mark as Sent" (`draft`→`sent`, sets `sent_at`),
     "Won" / "Lost" / "Withdrawn" / "Expired" (simple status PATCH) —
     these only ever change `bid_documents.status`; per §5, none of them
     touch `orders`/`quotes`/`quote_requests`.
3. `app/admin/command-center/bids/[id]/print/page.tsx` — a print-formatted
   render of the same data (AFS header/logo, project/GC/date, each
   section's work description followed by its line items in a
   qty/spec/unit-price/extended-price table, then price-validity/
   delivery-terms/tax-note/customer-note). Lives under `/admin/**` (already
   excluded from public `NavBar`/`Footer`/`ChatWidget` by `AppChrome`'s
   `PORTAL_PREFIXES` — no chrome change needed) and reached through
   `AdminShell`'s layout like every other `/admin` page. **Decision:** hide
   the sidebar with print CSS (`@media print { aside { display: none } }`
   scoped to this page, plus `main` losing its `ml-[240px]` at print time)
   rather than moving this route outside `/admin` — this avoids standing
   up a second, non-`/admin`-prefixed auth boundary for a single page.
   Staff use the browser's native print-to-PDF; **no PDF library is added**
   — nothing in this repo generates PDFs today (confirmed: no `jspdf`/
   `pdfkit`/`puppeteer`/`react-pdf` anywhere in the codebase, only a
   mention in `SPEC_INVOICE_PORTAL.md` that was never built), so adding one
   here would be new infrastructure this task doesn't need to justify.
4. `app/api/admin/bid-documents/[id]/viewer-ping/route.ts` and
   `.../viewers/route.ts` — per §3.7.

**Explicitly not in bid-doc-003:** anything that creates an
`orders`/`quotes`/`quote_requests` row from an awarded bid (§5); any
change to `quote_requests`/`quotes`/`quote_line_items` (§1); any Bid
Monitor (`bid_projects`/`bid_sources`) code changes — `bid_project_id` is
read-only context here, not a feature this prompt extends.

---

*BID_DOCUMENT_SCOPE.md | AFS | Reid Whitesides | Decision record | 2026-07-31*
