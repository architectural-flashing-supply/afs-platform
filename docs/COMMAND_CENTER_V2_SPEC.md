# COMMAND CENTER V2 — BUILD SPEC

**Status:** Phase 0 complete (read-only audit + spec). No application code or database was changed to produce this document.
**Date:** 2026-09-30
**Approved design:** `docs/design/command-center-v2-prototype.html` — copied verbatim from Reid's approved prototype (50,097 bytes). That file is the UX specification; where this document and the prototype disagree, the prototype wins.

---

## 1. THE APPROVED UX (from the prototype)

### Navigation — ONE level
Top bar: **Workbench · Shop View · Deliveries · Search**, then **More →** Customers, Settings. Gunmetal header retained; the working area is light. The current **two-level** nav is removed (see §2.1).

### Workbench — five lanes, left to right

| Lane | key | Sub-label | Card action |
|---|---|---|---|
| New | `new` | Needs a quote | **Start quote** |
| Quoted | `quoted` | Waiting on the customer | **Follow up** (only when stale) |
| Approved | `approved` | Ready for the machine | **Send to machine** (pulsing green, `.approved.beacon`) |
| In the shop | `shop` | At the Thalmann | **Schedule delivery** (if unscheduled) |
| Done | `done` | Delivered | — auto-archives after 14 days; Search still finds it |

Prototype: `STAGES` at line 226; lane rendering 289–293; `.lanes{grid-template-columns:repeat(5,...)}` line 90.

**Every incoming request becomes ONE Job card regardless of source.** Sources are `email`, `flashdraft`, `photo` (field app), labelled "From email" / "From FlashDraft" / "From the field app" (`SRC_LABEL`, line 225).

### Job screen — three columns, left to right
1. **The request** — exactly as it arrived (email body / FlashDraft drawing + note / field photos + note) **and "What the AI read"** as a definition list, with fields the AI is unsure about highlighted (`.unsure`), plus the line "Highlighted items are ones the AI is less sure about. Check them before sending." (`requestPanel`, lines 319–327)
2. **The profile** — the drawing, item + spec, **Open in FlashDraft**, and **this customer's past profiles** as clickable thumbnails (`profilePanel`, 329–338)
3. **The stage-specific action** (`actionPanel`, 347–375):
   - `new` → quote table (editable qty), "Priced from your price book: per bend, cut from 10 × 4 ft sheets", pre-written email preview noting an **Approve button**, **Send quote** + Save as draft
   - `quoted` → "Quote emailed …, waiting for X to click Approve", **Follow up** + **Customer approved by phone**
   - `approved` → green checklist: customer clicked Approve · invoice created from the quote · **invoice emailed to Tricia** · then **Send to machine**
   - `shop` → "Sent to the machine as profile #<id>", live shop status, delivery block (auto-schedules on finish, or set now)
   - `done` → delivered + invoice-emailed checks, **Start a reorder**

A stage stepper (`steps()`, line 314) shows progress across all five.

### Shop View (operator tablet)
Queue in order with position number, large drawing, item × qty, spec, customer, machine profile #, status. **Start bending** → **Mark finished**. Marking finished auto-schedules delivery. (`shopView`, 406–414)

### Deliveries
Five-day week view with per-day stops (customer, item × qty, window, **Mark delivered**) plus a "Not scheduled yet" panel with **Schedule delivery**. Manual schedule/change via a day + time-window modal; windows are 8–10 AM, 10 AM–12 PM, 1–3 PM, 3–5 PM. (`deliveriesView` 415–425; modal 467+)

### Search
One input + **Search in** selector (Everything / Profile name / Company / Person / Profile type) + **Material** filter. Results are a single **vertical rail of thumbnails**; hovering one previews it large beside the rail with customer, person, type, material, last made, and a **Select** button. A "Same shape used N×" badge appears when N > 1. (`searchView`, 386–404)

### Customers
List (customer, contact, open jobs) → detail with a Jobs table and Profiles thumbnails. (`customersView`, 427–440)

### Settings
- **Price book** — one row per material + gauge with **Sheet cost (10 × 4 ft)**, **Per bend**, **Per hem**. Ten seeded rows (`settingsView`, line 442).
- **Email** — connected-to-Outlook state for `steve@architecturalflashingsupply.com`; toggles: turn order/reorder emails into New jobs · move a job to Approved when the customer approves by email · text me when an approval comes in
- **Invoices** — "Email every approved invoice to Tricia automatically", showing the address
- **Coming soon** — Dynamic pricing, QuickBooks (non-functional cards)

### Removed entirely
- The **Profile Library built from the 911 AI-read profiles** of the old Thalmann (geometrically invalid — see §2.8)
- The **second navigation level**

### SETTLED — Tricia's address
**`trica@architecturalflashingsupply.com`.** **REVERSED 2026-10-01 — read this carefully.** This section previously recorded the opposite: that `tricia@` was correct and the prototype's `TRICIA` constant was a misspelling, and prompt `v2-01` rewrote 31 occurrences across code, docs and tests on that basis. **Reid confirmed on 2026-10-01 that `trica@` is the real mailbox and the 2026-09-30 decision was wrong.** The prototype was right all along. Every occurrence has been put back to `trica@`. A wrong auto-invoice address is a live-money error in either direction, so the address is named once, in `lib/data/office.ts`, and that file's comment carries the same warning.

---

## 2. AUDIT — WHAT EXISTS TODAY

### 2.1 Current Command Center routes and nav
20 admin pages exist. `app/admin/command-center/page.tsx` (190 lines) is a **dashboard** when `?tab` is absent, plus three machine tabs and one hidden tab:

| ?tab | Source | Notes |
|---|---|---|
| (none) | `CommandCenterDashboard` + 9 dashboard queries (`page.tsx:70-88`) | KPIs, pipeline, pending actions |
| `pending` | `getPendingQuoteRequests` → `quote_requests` where `status='submitted'` (`lib/data/pending-quote-requests.ts:94-98`) | renders `PendingQuoteRequestCard` |
| `sent` | `getMachineJobs` → `machine_jobs` in `('approved_for_machine','staged_for_review','sent_to_machine')` (`lib/data/machine-jobs.ts:12,81`) | `CommandCenterJobCard` |
| `completed` | `machine_jobs` where `status='completed'` | |
| `bids` | `getBidDocuments` | reachable by direct URL only (`page.tsx:24-38`) |

**Nav is two levels** (`components/layout/AdminTopBar.tsx`): level 1 `TOP_BAR_TABS` = Dashboard, Quote Requests, Production, Orders, Customers, Shop View, FlashDraft (lines 20–42); level 2 = a gear menu with QuickBooks, Pricing, Settings (lines 126–147). Both collapse into V2's single bar.

Existing Command Center API routes: `approve-quote-request`, `approve`, `cancel-quote-request`, `mark-delivered`, `reject`, `request-changes`, `profile-search`, `profile-thumbnail/[id]`.

### 2.2 Data model and the ONE Job stage model

Live status distributions (read-only, 2026-09-30):

| Table | Rows | Statuses |
|---|---|---|
| `quote_requests` | 64 | `reviewing` 41, `cancelled` 15, `submitted` 8 |
| `machine_jobs` | 34 | `approved_for_machine` 17, `sent_to_machine` 14, `staged_for_review` 3 |
| `orders` | **0** | — |
| `invoices` | **TABLE DOES NOT EXIST** | — |
| `shop_profile_library` | 20 | `queued` 12, `complete` 8 |

**`invoices` does not exist as a table.** `app/account/invoices/page.tsx`, `app/api/invoices/[id]/pdf`, `.../send`, `app/api/invoices/statement` and `app/api/admin/invoices/[id]/mark-paid` all exist as routes — so the invoice surface is built against a relation that was never created. This is the biggest gap behind the prototype's invoice flow.

**Proposed Job stage model — ONE stage enum, minimal schema change.**

`quote_requests` becomes the **Job** record. It is already what every source creates, and it already carries `source_tool`, `line_items` (with geometry), `job_name`, `color`, `finish` and the job-identity fields. Add ONE column:

```sql
ALTER TABLE quote_requests
  ADD COLUMN job_stage text
  CHECK (job_stage IN ('new','quoted','approved','shop','done'));
```

Mapping from today's data so no row is orphaned:

| V2 `job_stage` | Derived from today |
|---|---|
| `new` | `quote_requests.status='submitted'` (8 rows) |
| `quoted` | no equivalent today — quotes are not sent from the app yet |
| `approved` | `status='reviewing'` **and** a `machine_jobs` row at `approved_for_machine` |
| `shop` | linked `machine_jobs.status IN ('staged_for_review','sent_to_machine')` |
| `done` | linked `machine_jobs.status='completed'` |
| (archive) | `status='cancelled'` (15 rows) stays cancelled, off the Workbench |

`machine_jobs` remains the machine-side record (one per pushed item) and keeps its own statuses; V2 reads them to derive shop sub-state ("Queued at the Thalmann" / "Bending now" / "Finished"). **Minimal change: one column plus a backfill. No table renames, no data loss.**

It also fixes the defect diagnosed 2026-09-30: today a successful approval sets `quote_requests.status='reviewing'`, which no longer satisfies `approve-quote-request/route.ts:450`'s own `status === 'submitted'` entry check, so a second click returns **409 "Quote request is not pending approval."** and reads as a failure. An explicit `job_stage` makes already-sent detectable and lets Phase 2 answer in plain English.

### 2.3 AI extraction — what is reusable

| Asset | In | Prompt / schema | Confidence | Reusable for email parsing? |
|---|---|---|---|---|
| `app/api/takeoff/route.ts` | uploaded drawing (PDF/image) | `buildTakeoffSystemPrompt(scopeDirective)`, model **claude-sonnet-4-6**, `max_tokens: 8000`, "RETURN ONLY valid JSON" (line 84), per-item `confidence: high/medium/low` + `aiNote`, plus `overallConfidence` (lines 99–170, 280–329) | **YES — real, per-field, three-level, with an explicit note field** | **Pattern: YES. Prompt: NO.** |
| `app/api/field/photo-upload/route.ts` | field photos | photo-to-quote | same shape | same |
| `lib/anthropic/client.ts` | — | thin `new Anthropic({...})` wrapper only | n/a | yes, unchanged |

**Verdict.** The *architecture* of photo-to-quote is exactly what the "What the AI read" panel needs and should be reused wholesale: a single JSON-only system prompt, a typed result schema, **per-field `confidence` + `aiNote`**, and an `overallConfidence`. The prototype's `.unsure` highlighting maps directly onto `confidence !== 'high'`. The model choice and the "RETURN ONLY valid JSON, no prose, no markdown, no code fences" discipline carry over as-is.

**New, with no existing code:**
- **Intent classification** — new order / reorder / approval / question / noise. Nothing classifies email today.
- **Customer matching** — sender address → customer record. No matcher exists.
- **Past-job matching** — "same as last time" → a prior `quote_requests` row. Partially served by `geometry_fingerprint` (migration 028) for *shape* matching, but there is no text→job matcher.
- **Quote matching** — tie an inbound approval to the quote it answers; needs Phase 4's approve token.
- **Threading** — Graph `conversationId` / `internetMessageId` handling.

### 2.4 Email today — and the Outlook gap

**Outbound: Resend only.** `lib/resend/client.ts`, `lib/resend/send.ts`, `lib/resend/templates/base.ts` (`baseEmailTemplate`). Senders are inline and scattered — e.g. `approve-quote-request/route.ts` sends "Your AFS Quote Request Has Been Approved" (~line 650). One template file; no per-message templates.

**Inbound: NOTHING.** No inbound route, no parser, no webhook.
**Microsoft Graph / Outlook: NOTHING.** `grep -rln "graph.microsoft|microsoftonline|Mail.Read|msal" app lib` returns **zero files**. Entirely greenfield.

**What the Outlook integration needs — Reid does this once:**

1. **Microsoft Entra ID app registration** — portal.azure.com → Entra ID → App registrations → New registration. Single tenant is sufficient.
2. **Redirect URI** (Web): `https://afs-website-alpha.vercel.app/api/outlook/callback` — plus the production alias if it differs.
3. **API permissions — Microsoft Graph, DELEGATED** (so mail sends *as Steve* and lands in *his* Sent Items):
   - `Mail.Read` — read his mailbox to detect order/approval mail
   - `Mail.ReadWrite` — mark read / move / categorize processed mail
   - `Mail.Send` — send quotes and follow-ups as him
   - `offline_access` — refresh tokens so the connection survives
   - `User.Read` — identify the connected account

   Then **Grant admin consent** for the tenant.

   *Application (app-only) permissions are rejected:* they would send on behalf of a service identity, and the requirement is that replies stay in Steve's own Sent folder and thread.
4. **Client secret** (or certificate) → `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`, `MS_GRAPH_TENANT_ID` in Vercel env. Never in the repo.
5. **Token storage** — a new `outlook_connections` table: `user_id`, `access_token`, `refresh_token`, `expires_at`, `scope`, `connected_email`. RLS owner-only; tokens read server-side only and never returned to a client.
6. **Change notifications, not polling** — Graph `POST /subscriptions` on `/me/mailFolders('Inbox')/messages` delivered to `/api/outlook/webhook`, with `clientState` validated on every delivery. Mail subscriptions expire in roughly 3 days, so a renewal job is required. A polling fallback (`/me/messages?$filter=receivedDateTime gt …`) is the degraded mode when a subscription lapses.
7. **Staying in the thread** — reply via `POST /me/messages/{id}/createReply` then send the draft, or `POST /me/sendMail` carrying `conversationId`. Sending through Graph as the user puts the message in **his Sent Items automatically**; Resend cannot do this at all, which is why quote mail moves to Graph while transactional customer mail (notifications, tracking links) stays on Resend.

### 2.5 Quotes and invoices today
- Quote *requests* exist; **quotes as a priced document do not**. No quote table, no quote PDF, no quote email with an Approve action.
- `app/api/admin/quote-requests/[id]/send/route.ts` exists — the closest precedent for sending something about a request.
- **Invoices:** routes exist (`app/api/invoices/[id]/pdf`, `/send`, `/statement`, `app/api/admin/invoices/[id]/mark-paid`, `app/account/invoices/page.tsx`) but **no `invoices` table**. Whatever afs-fl-014 built for "invoice email with tracking link" is therefore either unreachable or backed by another table. Phase 3 must reconcile the routes against a real schema before building on them.

### 2.6 Pricing today
`PRICING_ENGINE.md` (17.7 KB) describes a commodity-indexed engine. In code: the `pricing_rules` table (SCHEMA.md TABLE 9, line 372; migration 003 adds `cost_notes`), `app/admin/pricing/page.tsx`, `app/api/admin/pricing/rules/[productId]/route.ts`. `pricing_rules` is keyed **per product** with multipliers — *not* per material+gauge, and with no concept of a bend, a hem or a sheet. **The prototype's price book is a new table, not a reshape of `pricing_rules`.**

Proposed `price_book`:

```
material text, gauge text,            -- composite key
sheet_cost_cents int,                 -- one 10 x 4 ft sheet
per_bend_cents int,
per_hem_cents int,
extras_cents int default 0,
effective_from date, updated_by uuid
UNIQUE (material, gauge, effective_from)
```

Strips per sheet are **derived, not stored**: `floor(48 / blank_width_in)` from the profile's real blank width (48 in = the 4 ft dimension; 10 ft is the strip length). Quote line = `sheet_cost/strips_per_sheet × qty + per_bend × bends × qty + per_hem × hems × qty + extras`. Keeping `effective_from` is what later feeds "Dynamic pricing" — the Settings card already promises it "uses the history your price book is collecting now".

### 2.7 Shop View, deliveries, notifications
- **Shop View exists**: `app/admin/shop-view/page.tsx`, admin-gated, linked from `AdminTopBar.tsx:35`. The prototype's queue-order + Start bending / Mark finished actions need verifying against it.
- **Delivery**: `machine_jobs.delivery_method`, `app/api/admin/command-center/mark-delivered/route.ts`, `SPEC_DELIVERY_SCHEDULER.md`. There is **no week view** and no schedule/reschedule UI.
- **Notifications**: `notifications` table (58 rows); Resend wired; Twilio present in env per CLAUDE.md, but the "text me when an approval comes in" toggle has no implementation.

### 2.8 The 911-profile library — removal plan

| Object | Rows / location |
|---|---|
| `machine_profiles` | **911** |
| `machine_profile_bends` | **4,537** (FK `profile_id`) |
| `machine_profile_categories` | 46 (FK `category_id`) |
| `app/admin/shop-library/page.tsx` | UI |
| `app/api/admin/shop-library/[id]/route.ts`, `.../reorder/route.ts` | routes |
| `scripts/import-machine-profiles.ts`, `import-additional-profiles.ts`, `fix-profile-names.ts`, `translate-profile-names.ts` | importers |
| `machine-data/` (gitignored) | `AFS_Profile_A-Profiles.ds1`, `AFS_Profile_Breast_plates.ds1`, `DS2801Profile_A-Profiles_001.ds1`, `DS2801Profile_Breast_plates_001.ds1`, `afs-additional-profiles.json`, `ds2801db.bdb` |

**Removal is safe — verified.** `machine_jobs.machine_profile_id` is **NULL on all 34 rows** (`select count(*) total, count(machine_profile_id) with_profile from machine_jobs` → `{total:34, with_profile:0}`), so no job depends on the library. The only FKs into it are its own bends and categories.

Safe removal order:
1. Copy `machine-data/` to an archive **outside the repo** (`C:\Users\manag\Documents\afs-archive\machine-data-2026-09-30\`) and verify byte counts. These are the only copies of the old machine's raw database.
2. `pg_dump` the three tables into that same archive folder.
3. Delete UI + routes + importers; drop `machine_profile_bends`, then `machine_profiles`, then `machine_profile_categories`.
4. **Never touch `shop_profile_library`** (20 rows) — real send history to the *current* Thalmann, including `pathfinder_profile_id`, and the source of "sent to machine" status in §2.2. Also keep `canonical_profiles` (25 rows) — the hand-authored starter library, a different thing entirely.

### 2.9 Test-data inventory (read-only — nothing deleted)

| Table | Rows | By owner |
|---|---|---|
| `machine_profile_bends` | 4,537 | (library) |
| `machine_profiles` | 911 | (library) |
| `admin_audit_log` | 118 | — |
| `bid_sources` | 81 | — |
| `quote_requests` | 64 | steve@ 45, guest/null 18, reid@ 1 |
| `notifications` | 58 | steve@ 42, null 14, reid@ 2 |
| `takeoff_uploads` | 58 | steve@ 35, null 23 |
| `machine_profile_categories` | 46 | (library) |
| `machine_jobs` | 34 | — |
| `bid_keywords` | 30 | — |
| `canonical_profiles` | 25 | (keep) |
| `gauges` | 24 | (reference) |
| `chat_conversations` | 22 | — |
| `shop_profile_library` | 20 | (keep — send history) |
| `saved_configurations` | 18 | steve@ 14, reid@ 4 |
| `product_profiles` | 12 | (reference) |
| `materials` | 9 | (reference) |
| `profiles` | 4 | steve@ (admin), e2e-forge@ (admin), reid@, hem-e2e-admin@ |
| `machine_bridge_status` | 1 | (retired bridge) |

The e2e test user `e2e-forge@architecturalflashingsupply.com` currently owns **zero** rows in these tables (cleared 2026-09-29).

**OPEN DECISION — PENDING REID.** Almost all remaining data belongs to `steve@architecturalflashingsupply.com` (45 quote requests, 14 saved profiles, 35 takeoff uploads). From the data alone that is indistinguishable between real customer work and Steve's own testing. **A backup-then-wipe step cannot be specified until Reid says which of Steve's rows are real.** Nothing will be deleted before that answer.

---

## 3. PROTOTYPE → CODE MAP (exists / partial / missing)

| Prototype screen / action | Status | Evidence |
|---|---|---|
| One-level top nav | **MISSING** | two levels exist: `AdminTopBar.tsx:20-42` + gear menu `:126-147` |
| Gunmetal header, light work area | **PARTIAL** | header exists; admin body is dark (`DESIGN_TOKENS.md`) |
| Workbench 5 lanes | **MISSING** | today: 3 tabs + dashboard, `app/admin/command-center/page.tsx:43-47` |
| One Job card per request, any source | **PARTIAL** | `quote_requests.source_tool` distinguishes flashdraft/field/quote-builder; email source does not exist |
| Lane: New | **PARTIAL** | `getPendingQuoteRequests` = `status='submitted'`, `lib/data/pending-quote-requests.ts:96` |
| Lane: Quoted | **MISSING** | no quote-sent state anywhere |
| Lane: Approved (pulsing) | **PARTIAL** | `machine_jobs.status='approved_for_machine'` exists; no lane, no pulse |
| Lane: In the shop | **PARTIAL** | `machine_jobs` `staged_for_review`/`sent_to_machine`, `lib/data/machine-jobs.ts:12` |
| Lane: Done + 14-day archive | **MISSING** | `completed` status exists; no archive rule |
| Job screen 3-column layout | **MISSING** | today `PendingQuoteRequestCard` / `CommandCenterJobCard` |
| "The request as sent" | **PARTIAL** | request data stored; no email body (no inbound mail) |
| "What the AI read" + unsure highlight | **PARTIAL** | confidence + `aiNote` exist in takeoff (`app/api/takeoff/route.ts:99-170`); no Job-screen panel |
| Profile + past profiles + Open in FlashDraft | **PARTIAL** | `profile-search` route + `?modifyProfile=` (Part 1, `716b3fb`); no panel |
| Quote builder + price book | **MISSING** | `pricing_rules` is per-product, not per material+gauge/bend/hem |
| Pre-written quote email + **Approve button** | **MISSING** | no quote email, no approve token |
| Send quote / follow up | **MISSING** | — |
| Approved checklist + Send to machine | **PARTIAL** | push exists and is guarded (`pushProfileToPathfinder`, CLAUDE.md rule #14); checklist/feedback missing |
| Approval → invoice → auto-email Tricia | **MISSING** | **no `invoices` table** |
| Shop View: queue, Start bending, Mark finished | **PARTIAL** | `app/admin/shop-view/page.tsx` exists |
| Mark finished auto-schedules delivery | **MISSING** | — |
| Deliveries week view / schedule / Mark delivered | **PARTIAL** | `mark-delivered` route exists; no week view, no scheduler UI |
| Search + field selector + material filter | **PARTIAL** | route + SQL function done (`1646746`); **no UI** |
| Thumbnail rail + hover preview + Select | **MISSING** | server contract ready and tested |
| "Same shape used N×" | **PARTIAL** | `geometry_fingerprint` + counts done (028); no UI |
| Customers list / detail | **EXISTS** | `app/admin/customers/page.tsx`, `[id]/page.tsx` |
| Settings: price book | **MISSING** | — |
| Settings: Outlook toggles | **MISSING** | no Graph code at all |
| Settings: auto-invoice to Tricia | **MISSING** | — |
| Settings: Coming soon cards | **MISSING** | `app/admin/quickbooks/page.tsx` exists as a real page |
| Remove 911-profile library | **NOT STARTED** | §2.8 |
| Remove second nav level | **NOT STARTED** | §2.1 |
| Single door to PathfinderEdge | **EXISTS — KEEP** | CLAUDE.md rule #14; `lib/integrations/pathfinder-edge.ts` `ApprovalContext` guard |

---

## 4. PHASED BUILD PLAN

Every phase: `pnpm tsc --noEmit` 0, `pnpm test:unit` green, migrations idempotent and verified via `information_schema`, RLS on every new table, and the PathfinderEdge single door untouched.

### Phase 1 — Foundation + cleanup (S/M)
**Scope:** collapse nav to one level (Workbench, Shop View, Deliveries, Search, More→Customers/Settings); light working area; archive `machine-data/` outside the repo and remove the 911-profile library (tables, UI, routes, importers) per §2.8; keep `shop_profile_library` and `canonical_profiles`.
**Schema:** drop `machine_profile_bends`, `machine_profiles`, `machine_profile_categories` (after archive + `pg_dump`); drop the `machine_jobs.machine_profile_id` FK.
**Tests:** a static test that no route or component references the removed tables; nav renders exactly the V2 items.
**Acceptance:** archive verified byte-for-byte outside the repo; `git grep` clean; `shop_profile_library` count still 20.

### Phase 2 — Workbench + Job screen (L)
**Scope:** five lanes; one Job card per source; the three-column Job screen with "What the AI read" (`confidence !== 'high'` → `.unsure`); stage stepper; 14-day auto-archive of Done. **Plus the three pending fixes:** clear approval feedback ("Sent to PathfinderEdge — profile #<id>"; already-sent → plain-English message, not an error; send failure → visible "Send failed — retry" + audit row); the rush rule (`is_rush` true only from an explicit customer checkbox or an admin toggle — no note parsing); ordering (newest arrival first everywhere, rush pinned above only in the machine and production queues).
**Schema:** `quote_requests.job_stage` + backfill (§2.2); `is_rush` semantics documented.
**Tests:** stage-transition unit tests; already-sent returns a message not a 409; ordering tests for all three lists; rush badge only on the real flag.
**Acceptance:** every existing row lands in a lane; no row orphaned.

### Phase 3 — Price book + quotes + invoices + auto-invoice (L)
**Scope:** `price_book` (§2.6) + Settings editor; quote builder computing from it (strips-per-sheet derived from real blank width); quote → invoice on approval; auto-email the invoice to Tricia. **Reconcile the existing invoice routes against a real `invoices` table first** (§2.5).
**Schema:** `price_book`, `quotes`, `invoices` (the last genuinely new).
**Tests:** pricing-maths unit tests including strips-per-sheet edge cases (a blank width > 48 in must fail loudly, not silently yield 0 strips).
**Acceptance:** a quote total is reproducible by hand from the price book.
**BLOCKED ON:** Tricia's real address (§1).

### Phase 4 — Outlook send + Approve button + mail parser (L/XL)
**Scope:** Entra app + OAuth connect flow; `outlook_connections`; send quotes via Graph as Steve (stays in his Sent and in-thread); signed Approve link → `approved`; Graph change-notification webhook + renewal; inbound classifier (intent, customer match, past-job match, quote match, threading) reusing the takeoff prompt architecture (§2.3).
**Schema:** `outlook_connections`, `email_messages`, `quote_approval_tokens`.
**Tests:** token signing/expiry/replay; parser fixtures per intent; webhook `clientState` rejection; **no live mailbox in CI.**
**Acceptance:** a real quote to Reid's own address, approved from the email, lands in Approved; the sent copy is in Steve's Sent folder and thread.
**BLOCKED ON:** Reid completing §2.4 steps 1–4.

### Phase 5 — Shop View + Deliveries (M)
**Scope:** operator tablet queue order, Start bending, Mark finished → auto-schedule delivery; Deliveries week view, manual schedule/change, Mark delivered; customer notification with tracking link.
**Schema:** `deliveries` (day, window, status) or columns on `machine_jobs`.
**Tests:** auto-schedule on finish; reschedule; delivered → `done`.

### Phase 6 — Search UI (M)
**Scope:** the thumbnail rail + hover-intent preview (≈150 ms in, ≈300 ms grace, pointer-safe corridor, no close button, swap on move, Select loads as a new linked draft, auto-save unsaved canvas work first with a toast), "/" focus, keyboard arrows/Enter/Esc, touch tap-then-Select, Recent (last 10) and Pinned when the box is empty.
**Schema:** `admin_recent_profiles`, `admin_pinned_profiles`.
**Tests:** the E2E interaction set already specified.
**Note:** the server side is DONE and tested (`1646746`) — this is UI only.

**Rough sizes:** S ≈ half a session, M ≈ one, L ≈ two, XL ≈ three or more. Phase 4 is the largest and the only one with an external dependency.

---

## 5. TOP RISKS

1. **`invoices` has routes but no table.** Five files are built against a relation that does not exist. Phase 3 must reconcile before extending, or the auto-invoice flow is built on sand.
2. **Phase 4 depends on Reid's Entra work and admin consent.** Delegated `Mail.Send` is the only way sent mail stays in Steve's own Sent folder; nothing in Phase 4 can be verified end-to-end until consent is granted.
3. ~~**Which of Steve's 45 quote requests are real?**~~ **RESOLVED 2026-09-30:** none of them are. The backup-then-wipe ran in prompt `v2-01`; the Workbench starts empty.
4. ~~**Tricia's address is misspelled in the prototype.**~~ **RESOLVED, THEN REVERSED.** 2026-09-30 ruled the prototype wrong and rewrote everything to `tricia@`; 2026-10-01 Reid confirmed the prototype was right and `trica@architecturalflashingsupply.com` is the real mailbox. All 31 occurrences are back to `trica@`. Auto-emailing invoices to a wrong address is a live-money error in either direction.
5. **Deleting 911 profiles + 4,537 bends is irreversible.** Mitigated by archive + `pg_dump` outside the repo, and by the verified fact that no `machine_jobs` row references them — but the raw `.ds1`/`.bdb` files in `machine-data/` are the only copies of the old machine's database.
6. **The single door must survive the rewrite.** V2 adds email-driven approval; the guard requires a verified in-database approval record before any push (CLAUDE.md rule #14). An email Approve click must *create* that record, not bypass it.
7. **Graph subscriptions expire (~3 days).** Without a renewal job, inbound mail silently stops becoming jobs — the exact failure class that looks like "nothing arrived today".
8. **Removing the second nav level orphans real tools.** `bid-monitor`, `building-codes`, `credit-applications`, `gbp-photos`, `geometry-test`, `quickbooks`, `pricing`, `shop-library`, `orders-crm` are all real pages. V2's nav lists none of them; each needs a home under More or a documented direct-URL-only status (the `?tab=bids` precedent, `page.tsx:24-38`).
