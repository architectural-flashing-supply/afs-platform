# COMMAND CENTER V8 — PHASE 0 AUDIT

**Branch `feat/command-center-v8`. Not merged, not deployed.**
**Written 2026-10-08 from reading the code and running the gates in this session. Nothing here is from memory.**

Phase 0 built the enforcement harness and this audit. **It built and restyled no
screen.** Every screen listed below is in the state it was in before this run.

---

## VERIFICATION STANDARD APPLIED TO THIS DOCUMENT

This project's governance standard (STATE_OF_THE_BUILD.md, SESSION_STATE.md) is
that a session's own testing is **evidence to bring to Reid, not a substitute
for his confirmation**. So:

- **VERIFIED** below means: read in the source in this session, or measured by a
  gate that ran in this session, with the output quoted.
- **UNVERIFIED** means: not checked against a live system, a live mailbox, a
  live database, or Reid's own eyes. Anything about how a screen *looks* or
  *feels* is UNVERIFIED by definition — no screenshot was taken of a real
  Command Center screen in this run, because no screen was touched.

Nothing in this document is marked done.

---

## 1. THE HEADLINE FINDING, AND IT IS NOT WHAT THE BRIEF ASSUMED

The brief's premise is that admin screens draw profiles from a parametric
`kind + d` table and should be switched to real geometry. That premise is
**half right, and the wrong half matters.**

**VERIFIED: in LIVE mode, the V7 Command Center screens set `drawing: null` and
show no profile drawing at all.** The parametric `kind + d` drawings exist only
in **fixture mode** (`CC_FIXTURE=1` *and* a non-production build *and*
`?fixture=v7` — `lib/fixtures/mode.ts`), which is the mode the pixel gate
measures.

Evidence, by line:

| Live view builder | Line | What it sets |
|---|---|---|
| `lib/data/v7-view/from-live.ts` | 129, 180, 189 | `drawing: null` |
| `lib/data/v7-view/from-live-lists.ts` | 101, 161 | `drawing: null` |
| `lib/data/v7-view/shop.ts` → `liveShopView` | 113, 148, 168 | `drawing: null`, plus `hasLazyDrawing` |
| `lib/data/v7-view/customers.ts` → `liveCustomers` | 184 | `profiles: null`, with a note pointing at profile search |

The `kind + d` assignments are all in **fixture** builders:
`lib/data/v7-view/job.ts:482,534`, `shop.ts:51,73,86`, `deliveries.ts:85`,
`customers.ts:122`, `new-quote.ts:115`.

`components/admin/v7/V7Primitives.tsx` already documents this choice and the
reason, and the reason is sound: "Rather than invent a shape — which would be a
drawing of something nobody designed, on a screen that sends work to a bending
machine — the `.pl` span is rendered empty."

**So the V8 problem is not "the wrong drawing is shown." It is "no drawing is
shown, or a thumbnail-resolution one with no numbers on it."** That changes what
each phase has to do: there is almost nothing to *replace* and a great deal to
*supply*.

Where a live screen does show a drawing, it is one of three things — all real
geometry, none of them readable as a shop instruction:

1. **A base64 PNG snapshot** of FlashDraft's own canvas
   (`saved_configurations.thumbnail_image`, or
   `shop_profile_library.geometry_svg`, which despite its name holds a PNG).
   Right shape, right numbers — **captured once at thumbnail resolution.** It
   cannot be enlarged and read off, which is exactly what the V8 full-size view
   is for.
2. **`pointsToSvgPath`** (`lib/data/job-screen.ts:557`) — a scale-to-fit
   polyline from the real saved points. Right shape; **no bend angles, no
   segment lengths, no hems, no painted side.** Its own comment says it is
   deliberately not FlashDraft's renderer and that "Open in FlashDraft is one
   click away."
3. **Nothing** — v7's empty `.np` box.

---

## 2. EVERY ADMIN SCREEN THAT SHOWS (OR SHOULD SHOW) A PROFILE DRAWING

Measured by `scripts/audit/single-drawing-path.mjs` in this session:
**107 files scanned · 18 with drawings outside ProfileViewer · 29 calls · 0 unreadable.**

| # | Screen | Route | Component / file | LIVE drawing source | FIXTURE drawing source | Phase | What switching to `ProfileViewer` takes |
|---|---|---|---|---|---|---|---|
| 1 | Workbench | `/admin/command-center` | `components/admin/v7/V7Workbench.tsx:294,433` (`V7Thumb`) | **None** — `drawing: null` (`from-live.ts:129`) | parametric `kind+d` | 1 | A saved-profile id on each card. `V7Card` has no such field; `quote_requests.line_items[]` carries the geometry but only *some* jobs also have a `saved_configurations` row. See §4 (a). |
| 2 | Job screen | `/admin/command-center/job/[id]` | `app/admin/command-center/job/[id]/page.tsx:202-206, 320-323` (`pointsToSvgPath`), `:389` (`PastProfileThumb`); fixture path `components/admin/v7/V7Job.tsx:141` (`V7Plate`), `:221` (`V7Drawing`) | inline `<svg>` from `pointsToSvgPath` — real points, **no numbers**; past profiles as base64 PNGs | parametric `kind+d` | 1 | The live Job screen already holds the real points. Lowest-friction conversion of the lot: pass the profile id (or the geometry via `initialData`) and delete the inline `<svg>`. |
| 3 | Shop View queue + job + overlay | `/admin/shop-view` | `components/admin/v7/V7ShopBoard.tsx:237,337,355` (`V7Drawing`), `:249,346,363` (`ShopJobDrawing`); `components/admin/ShopQueueBoard.tsx` (×2, `ShopJobDrawing`) | base64 PNG, lazily fetched per card via `/api/admin/shop-queue/drawing/[id]` (rule #26) | parametric `kind+d` | 2 | `shop_profile_library` has no `saved_configurations` FK. Needs a join from the shop row back to the saved profile, or the geometry copied onto the shop row. **The one screen where a wrong number reaches the machine — see §4 (b).** |
| 4 | Email two-pane | *no live route* | — | **Does not exist** | — | 3 | The screen itself has to be built. **And the contract mounts no drawing on it** — see §3. |
| 5 | Deliveries | `/admin/deliveries` | `components/admin/v7/V7Deliveries.tsx:167` (`V7Thumb`) — **fixture pane only** | **None.** The live pane is `DeliveriesWeek` / `DeliveryTrackPanel`, which carry real scheduling behaviour and draw no profile | parametric `kind+d` | 4 | Add a thumbnail to the live stop row. A delivery row's job → its profile is a new read; `deliveries.shop_job_id` is the hop. |
| 6 | Customers | `/admin/customers` | `components/admin/v7/V7Customers.tsx:124` (`V7Drawing`) — fixture only | **None** — `profiles: null`, with a note | parametric `kind+d` | 4 | `liveCustomers` does not read profiles at all today. Needs a per-customer `saved_configurations` read, then ids straight into the viewer. |
| 7 | Quotes list | `/admin/quotes` | `components/admin/v7/V7List.tsx:87` (`V7Drawing`) — fixture only; live thumbs via `components/admin/QuoteOrderList.tsx:186` (`LazyProfileThumb`) | base64 PNG where `row.profileId` exists, else nothing | parametric `kind+d` | 4 | `row.profileId` already exists — a near drop-in. Watch egress: the list must keep passing an **id**, never an image (rule #26). |
| 8 | Orders list | `/admin/orders` | same `V7List.tsx:87`; same `QuoteOrderList.tsx:186` | as Quotes | parametric `kind+d` | 4 | As Quotes. |
| 9 | Search (quotes/orders) | `/admin/search` | `components/admin/v7/V7Search.tsx:75` (`V7Drawing`) — fixture only | **None** — `liveSearch` (`from-live-lists.ts:181`) sets `drawing: null` | parametric `kind+d` | 5 | Same id-plumbing as the lists. |
| 10 | Profile search | `/admin/search/profiles` | `components/admin/ProfileSearchPanel.tsx` (×2, `LazyProfileThumb`) | base64 PNG, lazily per visible row | n/a (live only) | 5 | Already has the ids and the lazy pattern. The enlarged preview here is rule #27's hover-intent panel — **two zoom interactions would then exist** (hover-intent and the V8 click/double-click). Reconciling them is a design decision, not a port. **PENDING REID.** |
| 11 | New quote | `/admin/quotes/new` | `components/admin/v7/V7NewQuote.tsx:148` (`V7Drawing`) — fixture; live via `app/admin/quotes/new/page.tsx` (`LazyProfileThumb`) | base64 PNG | parametric `kind+d` | 4 | As Quotes. |
| 12 | Pricing / price book | `/admin/pricing`, `/admin/settings/price-book` | `components/admin/v7/V7Pricing.tsx:184` (`V7Drawing`, `dims: true`) | **not checked in this session** | parametric `kind+d` | — | **UNVERIFIED.** Not named in the brief's screen list and not traced. A price-book row is a material+gauge, not a job, so a *category* drawing may be legitimate here. Needs a decision before it is counted as a violation to burn. |
| 13 | Shop library (send history) | `/admin/shop-library` | `components/admin/ProfileLibraryTable.tsx` | base64 PNG, full row (correct — one screen on demand, rule #26) | n/a | — | **Not in scope.** This is the send-history table rule #26 explicitly sanctions reading the full row for. |
| 14 | Geometry test page | `/admin/geometry-test` | `app/admin/geometry-test/page.tsx` | **not a Command Center screen** | n/a | — | Zero gate hits (it uses neither primitive). Left alone. |

Shared primitives counted by the gate, not screens of their own:
`components/admin/v7/V7Primitives.tsx:136,183` (`V7Thumb`/`V7Plate` internals),
`components/admin/v7/V7Drawing.tsx:66` (`drawInner`),
`components/admin/LazyProfileThumb.tsx:77` (`pointsToSvgPath` fallback),
`components/admin/PastProfileThumb.tsx` (wraps `LazyProfileThumb`).

### No photo sources found masquerading as drawings

**VERIFIED:** the live Job screen distinguishes a photo source and does **not**
draw a profile for it (`isPhotoSource` guard, `page.tsx:202`). The field app
saves no geometry by design (`app/api/field/quote-request` inserts
`line_items: []`) — recorded in SESSION_STATE.md 2026-10-03 and unchanged. A
photo is never promoted to geometry anywhere.

---

## 3. WHAT THE CONTRACT ITSELF SAYS — INCLUDING ONE THING IT DOES NOT

The three approved files are frozen in `docs/design/command-center-v8/` and
hash-verified on every build. **VERIFIED in this session:** all three hashes
matched the hashes in the instruction before copying, and
`scripts/audit/contract-check.mjs` reports `3 verified · 0 problems · 0 ungoverned`.

**All three carry a byte-identical zoom-handler block and a byte-identical
`META` table** (asserted by `tests/visual/v8-interaction-gate.spec.ts` and
`lib/ui/zoom-intent.test.ts`). So there is one interaction contract, not three.

### The email two-pane mounts no drawing at all

**VERIFIED.** `Workbench_C-inbox-first.html` contains the complete zoom
apparatus — the `.zoom` CSS, the `#pop` / `#full` / `#scrim` overlays, the
`META` table, the five-colour legend and the identical handlers — and **zero
`.zoom` elements.** Mount counts, printed by the gate:

```
V8 contract zoom mounts
    8  Workbench_B-stage-strip-table.html
    0  Workbench_C-inbox-first.html
    9  Workbench_E-shop-view.html
```

In the approved design the email pane shows the attachment as a text chip
(`📄 Bldg4-flashing.pdf (p.1)`), not as a drawing. The gate records this as
`apparatus-only` and a separate test forbids *every* file being like that, so
the clause cannot go vacuous.

**Open question, PENDING REID:** should the email two-pane show the drawing the
AI read the takeoff from? The contract says no. The AI takeoff panel is the one
place a wrong reading could be caught against a picture, which is an argument
for yes. **Not decided, and not built.**

### What the full-size view must carry, as measured

Derived from the contract's own `META` and asserted per profile:

- interior-angle labels `=` bends — 2, 2, 4, 3, 2, 3, 2, 2 across the eight profiles
- `"… hem"` labels `=` hems — 0, 1, 2, 1, 0, 1, 1, 0
- length labels `=` drawn segments + hem segments
- one dashed painted-side marker per leg
- developed width in the overlay meta line: `Developed width 11 in · 4 bends · 2 hems`
- Steve's red shop note on **2 of 8** profiles (`zbar`, `coping`) — so the gate
  also asserts at least one exists

---

## 4. CONFLICTS BETWEEN THE CONTRACT AND THE ONE RENDERER

These are the things that will make a later phase's gate fail, listed now so
nobody discovers them as a surprise. **None was fixed in Phase 0** — each either
changes FlashDraft's own editing canvas, which is Reid's daily tool, or changes a
number the pricing engine divides by.

### (a) The hem label says different things — **the most likely phase-2 blocker**

**VERIFIED by reading `lib/flashdraft/draw-profile-scene.ts:502,518,534`.**

| | What it prints |
|---|---|
| FlashDraft (the one renderer) | `OPEN 3/16" gap`, `TEARDROP`, `SMASHED` |
| V8 contract | `0.5" hem` |

Neither is a superset. The contract's label does not say which *kind* of hem it
is; FlashDraft's does not say how far it *folds back*. **The shop needs both.**

`tests/visual/v8-interaction-gate.spec.ts` already demands the contract's form
and **will fail on the live screen until this is closed. That failure is the
gate working — do not relax it.** The current behaviour is pinned in
`lib/flashdraft/viewer-scene.test.ts` with an assertion that no hem label
carries its fold length, so whoever adds it is forced to update that test.

### (b) The drawing palette differs

**VERIFIED.**

| | Segments | Hems | Angles | Label ink | Ground |
|---|---|---|---|---|---|
| FlashDraft | `#C0001A` crimson | `#C0001A` | `#C0001A` | `#111111` | `#C4C4C4` |
| V8 contract | `#1553B3` blue | `#C26A00` amber | `#17703A` green | `#101C2C` | white |

`drawProfileScene` takes the palette as a parameter, so this is reconcilable in
one line. The contract's palette is recorded as
`V8_CONTRACT_DRAWING_COLORS` in `lib/flashdraft/viewer-scene.ts` and is
**deliberately not passed anywhere.** The question — does the Command Center
viewer adopt the contract's palette while the FlashDraft editor keeps crimson, or
do both move? — is **PENDING REID.** A unit test asserts the two palettes still
differ, so the question cannot be closed by an edit instead of a decision.

### (c) Developed width and the quote's blank width disagree — **a pricing finding**

**VERIFIED.** FlashDraft's own on-screen blank width adds each hem's allowance
(`app/studio/draft/page.tsx:1791, 3878`, via `hemAllowanceIn`).
`lib/pricing/quote-inputs.ts:92` sets a job's `blankWidthIn` from
`blankWidthInFromPoints` **alone, with no hem allowance.**

So a hemmed profile's **quoted** blank is narrower than its **drawn** blank by up
to `2 × lengthIn + gapIn` per end — for a 1/2 in open hem at both ends, about
1 3/8 in of girth. Rule #19 divides a 48 in sheet by the blank width to get
strips per sheet, so a narrower blank yields *more* strips per sheet and a
*lower* material cost.

**This is a pricing question, not a rendering one, and it was not changed.**
`developedWidthIn` in `lib/flashdraft/viewer-scene.ts` matches **FlashDraft's**
number (hems included), because the viewer's job is to show what the person who
drew it saw. **PENDING REID.**

### (d) `defaultBendRadiusIn` does not recognise the British spelling

**VERIFIED.** The regex is `/aluminu?m/i`, which matches `aluminum` and
`aluminm` but **not `aluminium`** — that spelling falls through to the 0.5 in
default instead of aluminium's 0.375 in. `lib/data/catalog.ts` uses the American
spelling, so **no catalogue material hits it today**; a hand-typed or imported
material could. Asserted as it behaves; **not changed**, because a default bend
radius is part of what the machine is told to do.

---

## 5. MAIL: WHAT EXISTS AND WHAT IS MISSING

### Mail parser — **LIVE, for two of three sources**

**VERIFIED.**

| Piece | Status | Evidence |
|---|---|---|
| Schema | **EXISTS** | `supabase/migrations/050_email_intake.sql` — `email_messages`, `email_attachments`, `quote_requests.source_email_id`, `intake_status` |
| Pipeline | **EXISTS** | `lib/email-intake/pipeline.ts` — classify → takeoff → draft quote request; re-runnable |
| `.eml` upload | **LIVE** | `/admin/email-intake` + `components/admin/email-intake/EmlUploader.tsx` |
| Generic webhook ingest | **LIVE** | `app/api/email-intake/ingest/route.ts` |
| Idempotency | **EXISTS** | `email_messages.dedupe_key` UNIQUE — Message-ID, else a sha256 of from+date+subject+body |
| Intent classification | **EXISTS** | `lib/email-intake/classify.ts`, heuristic + `anthropicIntentClassifier()` |
| Admin visibility + retry | **EXISTS** | `/admin/email-intake`, `RetryButton`, per-message status and error |
| **Microsoft Graph source** | **DORMANT** | `lib/email-intake/sources/graph.ts` — real logic, `readGraphConfig()` returns `null` without the five `OUTLOOK_*` env vars |
| **Graph webhook endpoint** | **EXISTS, DORMANT** | `app/api/outlook/webhook/route.ts` — answers the validation handshake with no credentials, returns **503** for real notifications so nothing is half-processed |

**UNVERIFIED:** whether the `OUTLOOK_*` variables are set in Vercel. Not checked
in this session. The admin page prints the answer live
(`data-testid="outlook-status"`), so this is one page-load to settle.

### Graph subscription creation and renewal — **MISSING ENTIRELY**

**VERIFIED by searching `app/`, `lib/` and `vercel.json`.**

- **No code creates a Graph subscription.** `graph.ts`'s own header states the
  manual step: "POST a Graph subscription pointing at `/api/outlook/webhook`".
  Nothing in the repo does it.
- **No code renews one.** A Graph mail subscription's maximum lifetime is about
  three days, so **an unrenewed subscription stops delivering mail silently** —
  the webhook simply stops being called. There is no `expirationDateTime`
  handling, no renewal route, and no record of a subscription id anywhere in the
  schema.
- **No cron.** `vercel.json` declares **no `crons` array at all** and there is
  no `app/api/cron/` directory.

This is the single largest gap in the mail story: the parser works, the webhook
is ready, and **there is no mechanism to keep mail arriving.** It needs a
subscription record, a renewal job, and — because a silent stop is the failure
mode — an alert when the subscription is near expiry or mail has not arrived.
**Phase 3.**

### AI reply drafting — **PARTIAL, AND NOT WHAT THE CONTRACT SHOWS**

**VERIFIED.**

- **EXISTS:** `app/api/admin/command-center/draft-followup/route.ts` +
  `lib/data/followup-draft.ts` — drafts a *chase* message for a quote the
  customer has not answered, stores it on the job so it survives a reload, and
  **does not send.** Its own header explains why: quote mail is specified to go
  out through Graph **as Steve**, so it lands in his Sent Items and stays in the
  customer's thread; pushing it through Resend instead would put it outside both.
- **MISSING:** the contract's email two-pane drafts a **reply to an inbound
  email** — "AI-drafted reply" with a **Send through Outlook** button
  (`Workbench_C`, the `question` sample). **Nothing in the repo drafts a reply to
  an inbound message.** `lib/email-intake/pipeline.ts` drafts a *quote request*,
  not an email. `classify.ts` classifies intent only.
- **MISSING:** **no code sends mail through Outlook/Graph at all.** A search for
  `sendMail`, `send through Outlook` and `sendThroughOutlook` across `app/` and
  `lib/` returns nothing. Outbound mail today is Resend
  (`lib/email/outbound.ts`), which is the wrong channel for this by the spec's
  own reasoning.
- **UNVERIFIED:** whether Resend is configured on any deployment. Rule #25
  records it as unconfigured and the honest degrade in place; not re-checked.

The contract's third sample (`approval` — "Approval detected", linked to the sent
quote, with **Send to machine**) also has no live counterpart in the mail path.
Note that an approval arriving by email already has a sanctioned route to the
machine gate — `app/api/quote-approve/[token]` writes the approval record the
single-door guard reads (rules #14, #21) — so this must be wired **to that**, not
to a new door.

### View Source linking — **ONE REAL ROUTE, ONE DANGLING LINK**

**VERIFIED.**

- **EXISTS:** `app/admin/quote-requests/[id]/source/page.tsx` renders
  `components/admin/email-intake/SourceViewer.tsx` — the original email beside
  what was read from it. Linked from `/admin/email-intake`
  (`page.tsx:62`), from `/admin/quote-requests/[id]` (`page.tsx:193`) and from
  `EmlUploader.tsx:58`.
- **BROKEN:** `lib/data/v7-view/job.ts:524` sets
  `sourceHref: /admin/command-center/job/${j.n}/source?fixture=v7`.
  **That route does not exist** — `find app -type d -name "source*"` returns only
  `app/admin/quote-requests/[id]/source`. `components/admin/v7/V7Job.tsx:108-110`
  renders it as a blue button. It is reachable only in fixture mode, so it is a
  dead link on a demo screen rather than on a customer-facing one — but it is
  dead, and SESSION_STATE.md recorded it as unfixed on 2026-10-03. Still unfixed.

The fix is a decision rather than a patch: either point the Job screen's button
at the real `/admin/quote-requests/[id]/source`, or build the v7 side-by-side
screen `SCREEN_MANIFEST.json` lists as `liveRoute: null`. **Phase 3.**

---

## 6. WHAT PHASE 0 BUILT

| File | What it is |
|---|---|
| `docs/design/command-center-v8/` + `CONTRACT_MANIFEST.json` | The three approved files, byte-for-byte, with their hashes, states and the interaction contract |
| `scripts/audit/contract-check.mjs` | Build gate: re-hashes every contract file; also fails on an **ungoverned** `.html` in the folder — the one way to defeat a hash check without changing a hash |
| `scripts/design/rebaseline-v8-contract.mjs` | The only writer of those hashes. Refuses without `CONTRACT_APPROVED_BY_REID=1`, which **no Claude Code session may set** |
| `scripts/audit/single-drawing-path.mjs` + allowlist | Build gate: every admin profile drawing goes through `ProfileViewer`. Counts are exact in **both** directions, so a conversion must be written down |
| `tests/visual/v8-contract.ts` | The contract as the test suite sees it; re-verifies the hashes itself rather than assuming prebuild ran |
| `tests/visual/v8-baselines.spec.ts` | Five full-page baselines at 1440×900, re-derived from the committed HTML every run. **No update mode, and there must never be one** — and `tests/visual/v8-baselines/` is **gitignored**, like v7's, so a PNG cannot start looking like an expectation a session could refresh |
| `tests/visual/v8-interaction-gate.spec.ts` | The gesture gate. Written against the contract first; becomes the gate for each screen as its phase lands |
| `components/admin/v8/ProfileViewer.tsx` | Thumbnail + enlarge + full size, from saved geometry only, through FlashDraft's renderer |
| `lib/flashdraft/viewer-scene.ts` | The camera, material facts and palette for a non-interactive render — **moved out of `app/studio/draft/page.tsx`, which now imports them back** |
| `lib/data/v8-profile-geometry.ts` | Saved geometry, parsed strictly: real geometry or an explicit absence with a reason, never a repaired guess |
| `app/api/admin/v8/profile-geometry/[id]/route.ts` | That read, admin-guarded, numbers only |
| `lib/ui/zoom-intent.ts` | The 230 ms, asserted equal to the frozen contract's own `setTimeout` line |

### The baselines captured

```
workbench-b          1440x1073     127016 bytes   Workbench_B-stage-strip-table.html
email-two-pane       1440x900       93653 bytes   Workbench_C-inbox-first.html
shop-view-queue      1440x900       90880 bytes   Workbench_E-shop-view.html
shop-view-job        1440x900       76624 bytes   Workbench_E-shop-view.html
shop-view-full       1440x900       48076 bytes   Workbench_E-shop-view.html
```

### A defect found at commit time THAT WOULD HAVE BROKEN THE GATE ON EVERY FRESH WINDOWS CLONE

**A hash-frozen file needs `.gitattributes -text`, or git redefines the design
with a line-ending conversion.** This repo has `core.autocrlf=true` and had **no
`.gitattributes` at all.** The contract files are stored with LF. Measured, not
reasoned about — the file was deleted and `git checkout`ed:

```
expected c99244c31ee31ef9e7805f05f654288835dc2b56576fcc0a960381986d83c30f
actual   dd6546531de26e2c141f1a3b85192a1d6b01478fa3a5b402a97d69a37081c27d
V8 CONTRACT CHECK — FAILED
```

Anyone cloning this branch on Windows would get a **failing build on an
unmodified contract**, and the obvious-looking fix would be to re-baseline the
hashes — which is exactly what rule #36 forbids. The approved design would have
been silently redefined by a CRLF conversion.

`.gitattributes` now marks the contract `-text` (never convert, either
direction, any platform). Proved by the same round trip: delete, `git checkout`,
re-hash → `c99244c3…c30f`, `3 verified · 0 problems`.

**AND IT HAD ALREADY HAPPENED TO v7, UNNOTICED.** Rule #33 records the
prototype's sha256 as `37f9c4d6…112a63`. On this machine the working copy had
been converted to CRLF by an earlier checkout and hashed `28a5e741…`, so **rule
#33's own recorded hash could not be verified here at all.** `37f9c4d6…` is the
LF hash — the index blob. Restoring the file to LF brings it back to
`37f9c4d69aaa2f1f2bb2944e33a4bf5ef7c9dcc9833ed3c8e1b3c6e79f112a63` exactly, which
is rule #33's value to the last character.

Fixing that surfaced two more files in the same chain, both of which were
passing their tests only by accident of this machine's conversion state:

- **`v7.css`.** `lib/design/v7-css.test.ts` asserts it CONTAINS each of the
  prototype's four `<style>` blocks VERBATIM — a byte comparison across two
  files. With the prototype LF and `v7.css` CRLF, all four blocks failed, even
  though both are LF in the index and both pass on a Linux clone.
- **`command-center-v7.generated.css`** and the four other CSS inputs
  (`v7-deviations`, `v7-fonts`, `v7-preflight-reset`, `v7-real-data`). The
  generator concatenates its inputs, so its output took their line endings and
  the "is exactly what the transform produces right now" assertion compared a
  CRLF regeneration against an LF checkout.

All of them are `-text` now, restored to LF, and `pnpm css:v7` reproduces the
committed generated file byte-for-byte (`git diff` empty).
`lib/design/v7-css.test.ts` + `v7-deviations.test.ts`: **20 passed.**

The point is not the line endings. It is that **three governance hashes and two
byte-comparison tests meant different things on Windows and on Linux**, and
every one of them was green on the machine that mattered least. `.gitattributes`
is scoped to those files only — a repo-wide eol policy would rewrite every file
in the project, which is a separate decision and not this run's to make.

### The allowlist to burn to zero

**29 drawing calls across 18 files**, by primitive:

```
V7Drawing=11  LazyProfileThumb=5  ShopJobDrawing=5  V7Thumb=3
pointsToSvgPath=2  V7Plate=1  PastProfileThumb=1  drawInner=1
```

`pointsToSvgPath` was **missed by the first draft of that gate** and added before
the baseline was committed. It was found by reading the live Job screen, not by a
search — which is the argument for the pattern list being an inventory of what
this codebase really does rather than a guess at it.

---

## 7. REMAINING PHASES

Each phase must bring its screen under **both** gates — the interaction gate (by
giving its live surface a route in `SURFACES` and bumping `EXPECTED_PORTED`) and
the drawing-path gate (by lowering its allowlist count) — **in the same commit.**

| Phase | Scope | Carries from this audit |
|---|---|---|
| **1 — Workbench (B)** | Port `Workbench_B` to `/admin/command-center`; cards through `ProfileViewer` | §2 row 1: cards have no profile id today. §2 row 2: the Job screen is the easiest first conversion |
| **2 — Shop View (E)** | Queue board, job screen, full-size overlay | §4 (a) the hem label **will fail the gate** until the fold length is added. §2 row 3: no FK from `shop_profile_library` to the saved profile |
| **3 — Email two-pane + mail go-live** | Build the screen; Graph subscription **creation, renewal and expiry alerting**; AI reply drafting; send through Outlook; fix the dangling View Source link | §5 in full. An email approval must go through `quote-approve`'s existing record, **never a new door** (rules #14, #21) |
| **4 — Deliveries, Customers, Quotes, Orders** | Thumbnails through `ProfileViewer` | §2 rows 5-8, 11. Quotes/Orders already have `row.profileId`. Keep passing ids, never images (rule #26) |
| **5 — Search** | Search results + profile search | §2 rows 9-10. **Two zoom interactions would coexist** — rule #27's hover-intent panel and V8's click/double-click. PENDING REID |
| **6 — Allowlist to zero** | Retire the last entries; delete what nothing renders | Decide §2 row 12 (Pricing): is a *category* drawing legitimate on a price-book row? |

---

## 8. OPEN QUESTIONS — PENDING REID

1. **The drawing palette.** Contract blue/amber/green vs FlashDraft crimson. Does
   the Command Center viewer adopt the contract's palette while the FlashDraft
   editor keeps its own, or do both move? §4 (b).
2. **The hem label.** The shop needs the hem's type *and* its fold length. Adding
   the fold length changes what FlashDraft's own canvas draws. §4 (a).
3. **Quoted blank width excludes hem allowance.** A real pricing discrepancy of
   up to ~1 3/8 in of girth on a double-hemmed profile. §4 (c).
4. **Should the email two-pane show the drawing?** The contract says no; it is the
   one place a wrong AI reading could be caught against a picture. §3.
5. **Two zoom interactions on the profile-search rail.** Rule #27's hover-intent
   preview and V8's click/double-click. §2 row 10.
6. **Is a category drawing legitimate on a price-book row?** §2 row 12,
   UNVERIFIED.
7. **Are the `OUTLOOK_*` variables set in Vercel?** UNVERIFIED; one page-load to
   settle. §5.

---

## 9. WHAT THIS AUDIT DID NOT CHECK

Listed so the gaps are known rather than assumed closed:

- **No live screen was opened.** Nothing about how any Command Center screen
  looks today was verified in this session.
- ~~**No live database query was run.**~~ **CLOSED 2026-10-09.** Measured:
  `saved_configurations` has **2** rows, `quote_requests` **18** of which **5**
  carry geometry, `shop_profile_library` **22** of which **19** hold a PNG. The
  Profile Passport having two rows means phase 1 cannot be id-plumbing and phase
  2 has at most 5 of 22 rows it could ever join back. See
  STATE_OF_THE_BUILD.md's 2026-10-09 follow-up entry.
- **No deployment environment was inspected.** Vercel env vars, Resend
  configuration and Graph credentials are **UNVERIFIED**.
- ~~**`ProfileViewer` has not been rendered in a browser.**~~ **CLOSED
  2026-10-09, and it was visibly wrong.** Rendered at `/studio/v8-viewer-debug`
  against real saved geometry, it cropped every thumbnail, clipped `3 15/16"`
  in the enlarged view, drew editor grab rings on a read-only view, and hung a
  teardrop hem 8.4px outside the canvas — with the entire unit suite green. One
  root cause (the fit measured the points and ignored everything drawn in fixed
  screen pixels around them), four fixes, and a new bounds test that would have
  caught it. Full account in STATE_OF_THE_BUILD.md's 2026-10-09 entry.
  **Its pixel fidelity against the contract is still UNVERIFIED**, and Reid has
  still not looked at it.
- **`/admin/pricing`'s drawing was not traced** to live or fixture. §2 row 12.

---

*docs/COMMAND_CENTER_V8_AUDIT.md · AFS — Architectural Flashing Supply · Command Center V8 phase 0 · 2026-10-08*
