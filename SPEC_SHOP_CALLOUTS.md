# SPEC_SHOP_CALLOUTS.md
## AFS — Shop Callouts: Steve's arrow and note on a FlashDraft profile

**Status: IMPLEMENTED, UNVERIFIED.** Per this project's verification standard
(STATE_OF_THE_BUILD.md), a session's own testing is evidence to bring to Reid,
not a substitute for his confirmation. **Migration 051 has been applied to a
local PostgreSQL cluster only — application to the live Supabase project is
PENDING REID**, and until then the authoring and display paths cannot store or
read anything. What was proved without it is listed in §9.

Branch: `feat/shop-callouts`. Migration: `051_shop_callouts.sql`.

---

## 1. WHAT THIS IS

Steve double-right-clicks the FlashDraft canvas inside the Command Center. An
arrow appears pointing at the nearest part of the profile and a pop-up opens for
him to type a shop note. When the operator opens that job in Shop View, every
note is visible — the arrow drawn on the profile, the text in RED, numbered, and
labelled SHOP NOTE.

**It is only ever what Steve typed.** Nothing here infers, generates, suggests or
summarises a note. There is no AI in this feature and there must not be one: the
value of a shop note is that a person who knows the job wrote it.

---

## 2. WHERE IT LIVES, AND WHERE IT DOES NOT

| | |
|---|---|
| Authoring | `/studio/draft?admin=1&loadRequest=<id>&item=<n>` — the Command Center's own FlashDraft link (`flashDraftJobHref`) |
| Display | `/admin/shop-view` — the queue the operator reads |
| Customer FlashDraft | `/studio/draft` — **nothing. No code, no data, no network call.** |

`app/studio/draft/page.tsx` is ONE component serving both audiences. That is the
central security fact of this feature and §3 is how it is handled.

---

## 3. GATING — THREE LAYERS, AND ONLY THE INNER TWO ARE SECURITY

**1. The chunk boundary.** The authoring layer is reached only through
`next/dynamic(() => import('@/components/studio/ShopCalloutLayer'), { ssr: false })`.
Its JavaScript is a separate chunk that a customer's browser never fetches.
A static import would put the code in the page every visitor downloads.

**2. The server gate.** The layer mounts only when
`GET /api/admin/shop-callouts?quoteRequestId=…` has already answered **200**.
That route checks `profiles.role = 'admin'` server-side and answers 401/403
otherwise. **`?admin=1` is a URL flag a customer can type and it grants
nothing** — it is a UI hint, exactly as `lib/flashdraft/job-handoff.ts` already
documents. The mount condition is `calloutsEnabled && jobHandoff && canvasMounted`,
where `calloutsEnabled` can only be set by that 200.

**3. The database.** Migration 051's RLS: `admin` full access, `operator` SELECT
only, **no policy at all for contractor / architect / customer / anonymous**, so
those get an empty result from PostgREST regardless of what any route does.

`lib/shop-callouts/isolation.test.ts` asserts all of it statically, plus: no file
outside a named allow-list touches the table; no customer-facing route, email,
invoice, PDF or quote builder mentions callouts; every query names its columns
(no `select('*')`, which is what keeps that claim true as columns are added).

**Known live gap, stated plainly:** `middleware.ts` gates every `/admin/**` PAGE
on `role === 'admin'`, so an `operator`-role account cannot reach Shop View
today. Shop staff currently sign in with admin accounts (see
`app/field/shop/page.tsx`'s own header). The RLS policy and
`app/api/shop-callouts/[shopJobId]` are correct for an operator the day one
exists. **`middleware.ts` was out of scope for this change and was not touched.**

---

## 4. THE GESTURE

| | |
|---|---|
| Place | Two right-clicks within **400 ms** and **8 px** on the canvas |
| Place (fallback) | **"Add Shop Note"** button arms placement; the next single click on the canvas places it |
| Cancel | **Esc** — closes the pop-up if one is open, otherwise disarms placement |
| Save | **Ctrl+Enter**, or the Save button |
| Edit / delete | Click an existing arrow's numbered badge |

The rule is `lib/shop-callouts/gesture.ts` — pure, unit-tested, and holding the
two constants so a future "feels better at 600 ms" is a decision somebody makes
on purpose. A backwards timestamp is refused rather than accepted by the
accident of comparing a negative number against a positive bound. After a
placement the memory is cleared, so three right-clicks place one note, not two.

**A single right-click does exactly what it does today: nothing.** The canvas has
carried `onContextMenu={(e) => e.preventDefault()}` — on the canvas, and only on
the canvas — since long before this feature, and `handlePointerDown` returns
immediately on `e.button !== 0`. This feature adds a second right-click as a
meaning and takes nothing away. **It deliberately does NOT make that existing
`preventDefault` conditional**, which would be a change to customer-facing
behaviour the brief forbids.

**Hit test.** `placementHit` snaps to the nearest point on the nearest segment
within **2 inches — a tolerance in PROFILE UNITS, never pixels**, so it means the
same thing at every zoom. Nothing within tolerance shows the toast **"Click
closer to the profile"** and creates nothing. A callout out in empty space with
an arrow stretching to some leg it never described is worse than no callout.

---

## 5. THE ANCHOR — WHY THERE IS NO `segment_id`

A FlashDraft profile is an ARRAY OF POINTS. Segment *i* is `points[i]` →
`points[i+1]`. Segments have no identity, are never persisted individually, and
**CLAUDE.md rule #13 is explicit that a prepend renumbers every index-keyed piece
of state in lockstep.** A column called `segment_id` would be a fiction.

So the anchor is stored four ways and `resolveCalloutAnchor` uses them in order:

| Stored | Used for | Result |
|---|---|---|
| `segment_index` + `t` | the drawing is unchanged | `exact` |
| `seg_ax/ay/bx/by` | "is this still the same segment?" — a geometric question, not trust in an index | guards the above |
| `anchor_x` / `anchor_y` | re-snap the authored tip to the polyline as it is now, within **0.5 in** | `resnapped` |
| `orphaned` | nothing within tolerance | `orphaned` — **the note is kept**, the arrow is not drawn |

**A callout is NEVER deleted because the drawing changed.** An orphan keeps its
text, shows **"Anchor changed — re-place"** in Steve's view, and is listed with
its text in the Shop View panel. Re-placing it is what clears the flag; nothing
else does.

**Everything is in INCHES.** Not one stored value is a screen pixel, so zoom,
pan, resize and fit-to-view cannot move an arrow. The single screen-space
measurement in the feature is the gesture's 8 px, which is a property of a hand.

**Numbering is DERIVED, not stored.** `numberCallouts()` sorts by `created_at`
then `id` and assigns 1..n, in one function both surfaces call — so the number
beside an arrow and the number beside a note cannot disagree, and deleting
callout 2 leaves 1 and 2 rather than 1 and 3.

---

## 6. THE DATA MODEL

`shop_callouts` (migration 051, additive only — no existing table, column,
constraint or policy is altered).

```
id                 uuid pk
company_id         uuid -> companies(id)      SERVER-SIDE, from the session
quote_request_id   uuid -> quote_requests     the authoring key …
line_item_index    int  not null default 0    … with this
shop_job_id        uuid -> shop_profile_library   the display key
                   CHECK (quote_request_id IS NOT NULL OR shop_job_id IS NOT NULL)
drawing_id         uuid     provenance, when the drawing came from a saved profile
drawing_revision   int      lineage depth (migration 027), not a version of the callout
segment_index      int  not null  CHECK >= 0
segment_count      int  not null  CHECK > 0
t                  numeric not null CHECK (t >= 0 AND t <= 1)
seg_ax/ay/bx/by    numeric not null   the authored segment's own endpoints
anchor_x/anchor_y  numeric not null   the authored tip
tail_dx/tail_dy    numeric not null   the tail, as an offset in INCHES
note               text not null  CHECK (char_length(btrim(note)) BETWEEN 1 AND 280)
orphaned           boolean not null default false
created_by         uuid -> profiles(id)       SERVER-SIDE, from the session
created_at / updated_at / deleted_at
```

Indexes on `shop_job_id`, `(quote_request_id, line_item_index)` and `created_at`.

**`company_id` and `created_by` are never read from a request body.**
`validateCreate` does not parse those names at all, so there is no field for a
forged value to arrive in — the stronger property, because nothing downstream
can later be changed to start honouring a field that was never parsed.

**Delete is a soft delete.** What the shop was told, and when, is part of the
record of how a part came to be bent. `deleted_at IS NULL` lives in exactly one
module, the way `lib/data/shop-library.ts` holds it for `shop_profile_library`.

### How a Shop View row finds its notes

Steve authors against a quote request and a line-item index. The shop reads
`shop_profile_library` rows — one per line item, created in a loop in
`app/api/admin/command-center/approve-quote-request/route.ts` **in item order** —
which carry `quote_request_id` but not the item index. So the index is DERIVED:
the rows of one quote request in `created_at` order are its line items in order.
That is a real property of the insert loop, and it is unit-tested.

**When the derivation cannot be trusted, every note is shown on every row of that
job.** If a callout claims an item index the board has no row for — a row
deleted, a job re-sent — the resolver WIDENS rather than narrows. Showing an
operator a note meant for the other line item costs a question. Hiding one costs
a part.

---

## 7. THE SHOP FLOOR

- **A banner at the top of the board**, and again above the notes:
  *"N shop notes from Steve — read before running"* — Reid's wording, verbatim.
  **Absent at zero.** A banner that says "0 notes" trains people to ignore
  banners.
- **v7's own note pill** (`.pill a`, prototype line 1482) on the queue row, now
  with a real count behind it. It was wired to `null` because there was nothing
  honest to count; there is now.
- **RED IS NOT THE ONLY SIGNAL.** The note text is `afs-crimson` (#C0001A),
  bold, 18px — **6.50:1 on `afs-bg-card` and 5.17:1 on `afs-bg-lane`**, measured
  by `pnpm check:contrast` (CLAUDE.md rule #28), which is a build gate. Every
  note also carries a **numbered badge** and the words **SHOP NOTE**, so it
  survives colour-blindness, a sun-washed tablet and a black-and-white
  photocopy.
- **The arrow is drawn on live geometry**, not on the stored PNG.
  `shop_profile_library.geometry_svg` is a base64 PNG (CLAUDE.md rule #26's
  misnamed column) with no transform relating its pixels to inches, so an anchor
  has nowhere to land on it. `geometry_points` is the same array FlashDraft
  authored against.
- **Click a number to highlight its arrow, and the arrow to highlight the note.**
- **Author and timestamp** on every note, small, ABSOLUTE rather than relative —
  a shop tablet is open all shift and "2 hours ago" rendered once is wrong by
  lunch.
- **Fetched when opened, not polled.** The queue carries a count; the text and
  geometry arrive from `/api/shop-callouts/[shopJobId]` when the panel opens —
  the same lazy pattern rule #26 requires of the drawings on this screen.

### A failed read is NOT an empty list

Found live on 2026-10-06: with the table absent the read failed, returned an
empty list, and every surface rendered a confident *"No shop notes on this job."*
An operator would have run the job believing there was nothing to read.

`ShopCalloutSet.unreadable` now distinguishes the two, and every surface — the
board, the panel and the authoring layer — says so out loud and **never renders
the empty state while it is true**. The message is one constant,
`CALLOUTS_UNREADABLE_MESSAGE`. A static test asserts the panel's empty state is
guarded by it.

Likewise, a failed WRITE no longer shows the database's own words. The same live
pass put *"Could not find the table 'public.shop_callouts' in the schema cache"*
in front of an estimator; it now reads *"The note was not saved. Nothing on this
job was changed — your text is still here."* (CLAUDE.md rule #30), with the real
error logged server-side.

---

## 8. TWO DELIBERATE DIVERGENCES FROM PROTOTYPE v7

CLAUDE.md rule #33 says v7 wins every conflict about appearance. Both of these
are on Reid's explicit instruction in the shop-callouts brief, which is the
owner overruling the prototype rather than a session building from memory.

1. **The note text is RED and bold.** v7's `.nt` is ordinary ink.
2. **The arrows.** v7's notes are text only; an arrow pointing at the part of the
   profile a note is about does not exist in the prototype.

v7's own design is otherwise followed and in two places RESTORED: the note pill
on the queue row (line 1482) and "Notes from Steve" (`notesBox`, line 1513).

**Neither affects the pixel gate (rule #34), and this was measured, not
assumed.** The gate renders `?fixture=v7`; fixture mode substitutes DATA ONLY;
v7's sample notes are not `shop_callouts` rows, so `calloutCount` is 0 on that
path, the banner is absent at zero by design, and the panel is closed. The
`shop` screen measured **0.59%** against a 1.5% budget with these changes in.

**v7's operator screen (`pageOp`) was NOT built.** Its four manifest states
(`op-bending`, `op-queued`, `op-finished`, `op-full`) have `liveRoute: null` and
still do. Building it is a separate piece of work and is the right home for this
feature's display half when somebody does build it.

---

## 9. WHAT WAS PROVED, AND WHAT WAS NOT

**Proved against a real PostgreSQL 18.3 cluster** (evidence:
`docs/verification/shop-callouts-051-local-verify.txt`): the migration
applies; a blank note, a 281-character note, `t > 1`, `segment_count = 0` and a
callout with no subject are each REFUSED by name; 280 characters and a
`shop_job_id`-only subject are accepted; **admin** can select/insert/update,
**operator** can SELECT but its INSERT is refused by RLS and its UPDATE and
DELETE change zero rows, **customer** sees 0 rows and **anonymous** sees 0 rows.

**Proved in a real browser** against the local dev server (§10).

**NOT proved:** the authoring → shop round trip, because `shop_callouts` does not
exist in the live Supabase project. The six e2e tests that need it SKIP with that
exact reason and will run unchanged the moment the migration is applied.

---

## 10. HOW REID CHECKS IT

Apply the migration first — the project's own documented route
(`supabase/README.md` Option A): Supabase Dashboard → SQL Editor → New query →
paste `supabase/migrations/051_shop_callouts.sql` → Run. It is additive; it
creates one table and touches nothing else.

Then:

1. `pnpm dev`, open `/admin/command-center`, click a job that has a drawing,
   press the red **Design in FlashDraft**.
2. **Double-right-click on the profile.** An arrow and a pop-up appear. Type a
   note, Save.
3. Try a double-right-click out in empty space — it must say *"Click closer to
   the profile"* and create nothing.
4. Open `/admin/shop-view`. The red banner, the note pill on the row, the arrow
   on the profile, the note in red with its number and SHOP NOTE.
5. Go back to FlashDraft, drag a leg far away, save. The note must still be
   there, saying **"Anchor changed — re-place"** — never gone.
6. Open `/studio/draft` in a private window (signed out). There must be no
   callout anything.

---

## 11. RECOMMENDED, NOT BUILT

- **Operator "Acknowledge notes"** — who read it and when, shown back to Steve.
  The brief listed it as optional-if-under-an-hour; it is not, because it needs
  its own table, its own RLS, a writer the operator role is allowed to use (it
  holds SELECT only today), and a surface on Steve's side to show it. It is the
  single highest-value follow-up: it is what turns "the note was displayed" into
  "the note was read".
- **v7's operator screen** (`pageOp`) — the proper home for the display half.
- **An `operator` role that can actually reach Shop View** — `middleware.ts`
  gates `/admin/**` on `role === 'admin'` and was not touched.

---

*SPEC_SHOP_CALLOUTS.md | AFS — Architectural Flashing Supply | branch
`feat/shop-callouts` | 2026-10-06*
