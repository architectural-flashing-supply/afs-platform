# V7_PIXEL_REPORT.md
## The whole-screen pixel gate: what it measures, what it found, and what still does not match

**Branch `cc-v7-pixel`, cut from `command-center-v7`. 2026-10-02.**
**UI layer only. No route behaviour, no `lib/data/*` signature, no migration,
no deploy.**

---

## WHY THE OLD GATE HAD TO BE REPLACED

The owner's report was **"nothing matches."** The existing style gate
(`tests/visual/v7-style-gate.spec.ts`) was passing 31 of 32, then 66 of 66.

Both were true, and the reason is structural rather than anybody's mistake.
That gate compares **66 hand-picked element pairs** on a list of properties
somebody thought to list — font, size, weight, colour, padding, radius. It can
tell you `.card` has the right padding. It cannot tell you:

- that every card was missing its **profile drawing**, which is 90–100px of ink
  on each one;
- that every card was missing the **profile-state pill** v7 puts on all of them;
- that the Workbench rail had **two panels where v7 has three**;
- that the header logo was a **different crop at a different aspect ratio**, so
  every element to its right sat 35px off **on every screen in the app**;
- that Customers was **a different screen entirely** — a flat directory where v7
  has a master-detail.

Every one of those passed a property-by-property comparison, because each
compared property really did match. **A gate that only looks where it is pointed
cannot find what nobody pointed it at.**

The replacement diffs the **whole screen**. Anything visible that differs lands
in the number.

---

## 1. EVERY MANIFEST SCREEN, BEFORE AND AFTER

`before` is the code at commit `feccdc4` — the harness landed, nothing rebuilt —
measured with the **final** harness so the two columns are comparable.
`after` is `65985a0`.

**Pass rule: at most 1.5% of pixels differ.** Not loosened at any point.

| # | id | screen | before | after | structure (missing/extra/reordered) | iterations | status |
|---|---|---|---|---|---|---|---|
| 1 | `workbench` | Workbench — five lanes, chips, three rail panels | **31.79%** | **0.47%** | 0 / 0 / 0 | 4 | **MATCHING** |
| 2 | `shell-more-menu` | Header — More menu open | **32.04%** | **0.75%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 3 | `shell-typeahead` | Header — type-ahead dropdown | **31.58%** | **0.43%** | 0 / 0 / 0 | 3 | **MATCHING** |
| 4 | `quotes` | Quotes list | **12.38%** | **0.40%** | 0 / 0 / 0 | 3 | **MATCHING** |
| 5 | `quotes-stage-new` | Quotes — stage "Needs a quote" | **11.39%** | **0.31%** | 0 / 0 / 0 | 3 | **MATCHING** |
| 6 | `orders` | Orders list | **12.54%** | **0.44%** | 0 / 0 / 0 | 3 | **MATCHING** |
| 7 | `orders-sort-val` | Orders — sort "Highest value" | **12.63%** | **0.44%** | 0 / 0 / 0 | 3 | **MATCHING** |
| 8 | `shop` | Shop View | **54.43%** | **0.59%** | 0 / 0 / 0 | 3 | **MATCHING** |
| 9 | `job-new` | Job — New, change asked for (412) | **404** ‡ | **0.70%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 10 | `job-new-nodraw` | Job — New, no saved profile (413) | **404** ‡ | **0.48%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 11 | `job-new-fieldapp` | Job — New, field-app photo (414) | **404** ‡ | **0.51%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 12 | `job-quoted` | Job — Quoted (409) | **404** ‡ | **1.37%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 13 | `job-approved` | Job — Approved (405) | **404** ‡ | **0.42%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 14 | `job-shop` | Job — bending now (398) | **404** ‡ | **0.43%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 15 | `job-shop-finished` | Job — finished, invoiced (402) | **404** ‡ | **0.57%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 16 | `job-done` | Job — Delivered (399) | **404** ‡ | **0.53%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 17 | `deliveries` | Deliveries — split view | **20.82%** | **0.20%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 18 | `deliveries-full-list` | Deliveries — schedule full page | **63.22%** | **0.18%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 19 | `deliveries-full-map` | Deliveries — map full page | **14.71%** | **0.21%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 20 | `deliveries-day-fri` | Deliveries — Friday tab | **20.91%** | **0.56%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 21 | `newquote` | New quote — nobody picked | **13.48%** | **0.40%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 22 | `newquote-customer` | New quote — customer picked | **22.25%** | **0.54%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 23 | `newquote-blank` | New quote — new customer form | **18.06%** | **0.43%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 24 | `search` | Search — all quotes and orders | **76.87%** | **0.33%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 25 | `search-query` | Search — a query | **8.69%** | **0.38%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 26 | `search-pid` | Search — one profile, with the chip | **9.09%** | **0.39%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 27 | `search-empty` | Search — nothing matches | **8.26%** | **0.18%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 28 | `customers` | Customers — master-detail | **18.20%** | **0.15%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 29 | `customers-edit` | Customers — contact editor | **18.32%** | **0.14%** | 0 / 0 / 0 | 2 | **MATCHING** |
| 30 | `pricing` | Pricing engine — empty | **27.60%** | **0.59%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 31 | `pricing-filled` | Pricing engine — example numbers | **29.40%** | **0.57%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 32 | `settings-email` | Settings — Email | **95.73%** | **0.27%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 33 | `settings-inv` | Settings — Invoices | **95.80%** | **0.31%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 34 | `settings-docs` | Settings — Documents | **96.04%** | **0.28%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 35 | `settings-soon` | Settings — Coming soon | **95.93%** | **0.26%** | 0 / 0 / 0 | 1 | **MATCHING** |
| 36 | `source-sketch` | Email source — sketch tab | — | — | — | 0 | **NO LIVE ROUTE** |
| 37 | `source-photo` | Email source — photo tab | — | — | — | 0 | **NO LIVE ROUTE** |
| 38 | `op-bending` | Operator screen — bending | — | — | — | 0 | **NO LIVE ROUTE** |
| 39 | `op-queued` | Operator screen — queued | — | — | — | 0 | **NO LIVE ROUTE** |
| 40 | `op-finished` | Operator screen — finished | — | — | — | 0 | **NO LIVE ROUTE** |
| 41 | `op-full` | Operator screen — expanded | — | — | — | 0 | **NO LIVE ROUTE** |
| 42 | `modal-doc-quote` | Modal — quote document | — | — | — | 0 | **NO LIVE ROUTE** |
| 43 | `modal-doc-invoice` | Modal — invoice document | — | — | — | 0 | **NO LIVE ROUTE** |
| 44 | `modal-fd-change` | Modal — FlashDraft, change asked | — | — | — | 0 | **NO LIVE ROUTE** |
| 45 | `modal-fd-new` | Modal — FlashDraft, new profile | — | — | — | 0 | **NO LIVE ROUTE** |
| 46 | `modal-mail-order` | Modal — email, new order | — | — | — | 0 | **NO LIVE ROUTE** |
| 47 | `modal-mail-notice` | Modal — email, supplier notice | — | — | — | 0 | **NO LIVE ROUTE** |
| 48 | `modal-sched` | Modal — schedule delivery | — | — | — | 0 | **NO LIVE ROUTE** |
| 49 | `modal-follow` | Modal — follow-up draft | — | — | — | 0 | **NO LIVE ROUTE** |
| 50 | `modal-chg1` | Modal — customer changed the order | — | — | — | 0 | **NO LIVE ROUTE** |
| 51 | `modal-chg2` | Modal — add an addendum | — | — | — | 0 | **NO LIVE ROUTE** |
| 52 | `credit-applications` | Credit Applications | — | — | — | 0 | **LIVE-ONLY** |
| 53 | `bid-monitor` | Bid Monitor | — | — | — | 0 | **LIVE-ONLY** |
| 54 | `profile-search` | Find a past profile | — | — | — | 0 | **LIVE-ONLY** |

**AFTER: 35 MATCHING · 0 NOT MATCHING · 16 with no live route · 3 live-only.**
**BEFORE: 0 MATCHING · 35 NOT MATCHING** (27 measured between **8.26%** and
**96.04%**; 8 could not be measured at all — see ‡).

**‡ The eight Job screens did not render in the before run.** The route guards
`/^[0-9a-f-]{36}$/` and calls `notFound()`, so v7's small-integer job ids 404'd.
That is reported as `error`, which the gate fails rather than skipping — a side
that cannot be reached is not a screen that matches. The live UUID guard is
unchanged; the fixture branch simply runs before it.

**The before run is the honest one.** It was taken by checking the whole UI back
out at `feccdc4` — the commit where the harness landed and nothing had been
rebuilt — and measuring it with the FINAL harness, so every improvement in the
`after` column is the port changing and not the gate changing. The first attempt
at this measurement was discarded because screens were edited while it ran.

### What "NO LIVE ROUTE" means, and why it is not a pass

Sixteen v7 states have **no counterpart in the live app at all**. The gate
reports each by name rather than skipping it, because a gate that quietly omits
a screen is how "nothing matches" survives a green run. They fall into four
groups, and every one is a pre-existing gap that this run did not create and did
not close:

| Group | Screens | Why there is no route |
|---|---|---|
| **The operator screen** (4) | `op-*` | v7's take-over-the-screen operator view. Shop View renders the queue; the single-job full-screen view has never been built. |
| **The email source split** (2) | `source-*` | v7's "original email beside the parser's reading" two-pane view. The live Job screen has one request pane. |
| **Document modals** (2) | `modal-doc-*` | The quote/invoice "paper" preview. |
| **FlashDraft modals** (2) | `modal-fd-*` | FlashDraft is a **separate real application** at `/studio/draft`, not a modal. This is a deliberate architectural difference, not a gap. |
| **Outlook modals** (2) | `modal-mail-*` | The one Microsoft-dependent feature. No Graph code exists (`COMMAND_CENTER_V2_SPEC.md` §2.4); the Entra registration is pending. |
| **Change orders and addenda** (2) | `modal-chg1`, `modal-chg2` | Gap-audit items 8 and 9. Neither concept exists in the schema. |
| **Scheduling and follow-up modals** (2) | `modal-sched`, `modal-follow` | The live equivalents are inline on Deliveries and in `JobActionPanel`. |

---

## 2. MASKS USED

**None. Zero masks, on every screen.**

The harness supports them (`SCREEN_MASKS` in `tests/visual/v7-pixel-harness.ts`,
budget 2% of the screen, each requiring a written justification) and **not one
was needed**, because the clock and the random source are frozen before any page
script runs and the fixture makes both sides render the same rows.

That matters: a mask is the easiest way to make a gate stop looking, and the
budget exists so that adding one is a visible decision rather than a quiet one.
`SCREEN_MASKS` is an empty object today, and anything added to it will appear
here with its reason and its measured area.

---

## 3. FEATURES RENDERED AS AN HONEST EMPTY STATE IN LIVE MODE

v7 is a prototype with complete sample data, so every slot on every screen is
full. The live app has slots it genuinely cannot fill. **Each is an explicit
absence rather than an invention**, because this is a platform where the next
button along reaches a physical bending machine.

| What v7 shows | What live shows, and why |
|---|---|
| **A profile drawing on every card, list row, search row and type-ahead row** | **An empty box in v7's own `.np` state.** The Workbench, list and type-ahead queries deliberately select **no geometry at all** — CLAUDE.md rule #26, because `geometry_svg` is a base64 PNG measured at 70KB–786KB a row and a lane board would pull megabytes on a 60-second poll. Inventing a shape would be drawing a profile nobody specified. |
| **The Outlook inbox rail** — six messages, "Connected to Outlook · read 20 sec ago", a Check now button | **"Not connected to Outlook yet. When it is, new orders and approvals appear here."** in v7's own panel, at v7's own size, so the rail's layout is unchanged. There is no Microsoft Graph code in this repo. |
| **The header's "N new emails" count** | **"Email not connected"** rather than a `0`, which would read as "no new mail" when the truth is "nothing is being read". |
| **Profile dimensions and bend count on a list row** (three lines) | **The profile name only.** Same reason as the drawing: the list query carries no geometry. The other two lines are empty rather than filled with a guess. |
| **"Past profile + change asked" and "New version saved" pills** | **Only "Past profile" and "New profile, needs drawing".** The other two states belong to v7's change-order model — gap-audit items 8 and 9 — which does not exist. The live mapping never claims a state nothing behind it can support. |
| **A note-count pill on a Shop View row** ("1 note") | **Omitted.** The live queue card carries the shop-floor instructions themselves rather than a count of messages, so there is nothing honest to count. |
| **A customer's jobs and saved profiles in the Customers detail pane** | **A line saying where they are, and a link.** Both need a per-customer read this page does not do, and adding profile thumbnails would be a third mount point for the one profile panel rule #27 allows. |
| **"Create customer and continue"** on New quote | **Rendered as v7 draws it, and plainly not working.** Creating a customer means creating an auth account, which needs a schema change or an invite flow. The form says so rather than discarding what is typed into it. |
| **The `.foot` sentence "Customer names, numbers and prices on this screen are sample data"** | **Not rendered in live mode.** It is true in fixture mode and would be a false statement over real customer names. |

---

## 4. SCREENS THAT RENDER v7 IN FIXTURE MODE ONLY — DELIBERATE DIVERGENCES

Four screens render v7's layout **for the gate** while the live screen keeps
something different. These are not shortcuts. CLAUDE.md rule #33's own carve-out
is "existing code wins only where it supplies real data or API behaviour that v7
only fakes", and each of these is that case. **They are listed here so the owner
can overrule any of them.**

| Screen | What live keeps | Why v7's version must not replace it |
|---|---|---|
| **The Job screen's action pane** | `JobActionPanel` | It really sends a quote, really records a phone approval, and really opens **the one door** to the machine — rule #14, where a verified admin approval is the only thing that reaches catalog 20115 and a physical Thalmann collects whatever lands there. v7's equivalent pane has a button reading **"Pretend Mike clicked Approve"**. |
| **Deliveries' map** | `DeliveryTrackPanel` → the real tracking map the customer already sees | v7's map is a hardcoded schematic of eleven sample companies, and its fallback for anyone else is **a hash of the company name**. Pointing that at a real stop would draw a customer somewhere they are not. v7's own caption says the real build uses the customer-facing map. |
| **Pricing** | The versioned price-book editor | v7's six free-text rate boxes live in browser memory. This app's numbers live in an **append-only, versioned** price book that Postgres refuses to update in place (rules #19, #20), where a blank is never a zero. Giving Steve v7's controls over that data would be the wrong screen however faithfully drawn. |
| **Settings** | Live integration status, product stock, the supplier price-change form | None of it exists in v7 and none of it is cosmetic — it is how somebody finds out Resend is unconfigured, the same fact rule #25 already makes Deliveries say out loud. v7's six toggles are **not** built as controls: each needs a settings table and a writer, and a switch that flips and is forgotten on reload is worse than none on a screen whose settings decide whether a customer gets an email. |

**Customers went the other way.** It was a flat account directory; the diff
scored it at 22% with 20 landmarks missing and 15 extra, which is not styling —
it is a different screen. It is v7's master-detail now, and the directory's
three real features (role filter, tier filter, CSV export) moved **into** v7's
own `.bar` and page-action slot rather than being dropped.

---

## 5. THE DEFECTS THE WHOLE-SCREEN DIFF FOUND THAT THE PAIR GATE COULD NOT

Recorded because they are the argument for the new gate.

1. **The header logo was the wrong image on every screen in the app.** v7 embeds
   a 342×134 logo (aspect 2.552); `/afs-logo.png` is 1536×1024 (aspect 1.500) —
   a different crop of the same mark. v7 sizes it by HEIGHT, so at 34px tall the
   two are 86.8px and 51.2px wide, and **every header element to the right of
   the brand sat 35px off, everywhere**. A pair comparison cannot see it: both
   are "the logo", at the same height, and every compared property matches.
   Fixing it roughly halved three screens at once.

2. **`V7Drawing` wrapped the `<svg>` in a `<span>`** — the obvious way to inject
   markup from React. v7 sizes a drawing with `.plate svg{width:100%}`, a
   descendant selector, so it still matched: 100% of an inline span that shrinks
   to its content, not 100% of the plate. Every plate and thumbnail in the app
   came out slightly wrong, visible as a dimension label reading `1 1/2"` where
   the prototype read `11/2"` on the same drawing.

3. **"See all N results" was a link.** v7 styles `.hsall` with `width:100%` and
   `height:38px` and no `display` — which works on a `<button>` (inline-block)
   and does nothing on an `<a>` (inline). It rendered as a small outlined word
   where v7 has a full-width dark bar.

4. **Every short page was 65px taller than v7's**, because the light working
   area was `min-h-screen` — 100vh applied to an element below a 65px header.
   The Quotes list was at 8.23% on that alone.

5. **Missing elements, on nearly every screen**: the profile drawing on every
   card and row, the profile-state pill on every card, the material colour chip,
   the third rail panel, the inbox panel's "Check now" row (which moved both
   panels below it by 25px), and an "Apply" button in the filter bar that v7
   does not have.

### And two the gate made *while* it was being built, which it then caught itself

6. **Making `<main>` a flex item without `w-full`** let v7's own
   `margin: 0 auto` act as a **cross-axis auto margin**, which cancels
   `align-items: stretch`. `<main>` shrank to 795px on a 1440 viewport and the
   Workbench went from 0.94% to **75.38%** on the next run — caught within a
   minute of the change.

7. **The harness's own driver left a focus ring** on the prototype's search box
   that the live side, reached by URL, can never have; and later **filled the
   live search box before React had hydrated**, so the dropdown never opened and
   the screen read 8.55% with eight landmarks missing. Both are artifacts of how
   the gate drives the two sides, and both were fixed in the harness rather than
   masked.

---

## 5b. TEST FAILURES: WHAT THE REBUILD BROKE, AND WHAT IT DID NOT

The full Playwright suite found **13 regressions** from the rebuild. Every one
was an attribute or a name removed without noticing — not a behaviour change —
and all are fixed:

| What broke | Why |
|---|---|
| `input[name="q"]`, `select[name="stage"]`, `getByRole('searchbox')` | `V7FilterBar`'s controls had no `name` and the text field was not `type="search"`. v7 identifies its controls with `data-in`/`data-k`; both are kept now. |
| Every selector that picks a lane's cards | The Workbench card's `data-stage` was being set to the card's KEY rather than its stage, and `data-request-number` was gone. |
| The Workbench greeting assertion | The h1 lost the `title` attribute that carries it. |
| `section[aria-labelledby="lane-new"]` | The lane was labelled `lane-h-<key>`. The id is back on the h2, which is both the thing being named and the right scroll target. |
| Following a job through the shop | The Shop View row lost `data-state`, and its button lost the `start-bending` / `mark-finished` ids. |

**Two assertions were STALE rather than broken**, and both were corrected rather
than deleted, with the reason written into the test:

- One clicked an **"Apply" button** in the filter bar. v7 has none — it filters
  as you type and on change — so the button was removed and the assertion
  followed it.
- One asserted a **"N jobs in the shop" chip**. v7's four chips are approvals,
  to-quote, **email**, deliveries-today; the shop chip was the previous build's
  own invention.

**And one failure was a real UX problem the test was right to catch.** Advancing
a job in Shop View is a round trip of about three seconds — it writes the shop
row, auto-schedules the delivery and notifies the customer — and the screen said
nothing for the whole of it. On a tablet beside a bending machine that is how a
button gets pressed twice. The result strip now appears immediately reading
"Starting…" and its text is replaced by the outcome.

### The verification state at the end of the run

| Gate | Result |
|---|---|
| `pnpm tsc --noEmit` | clean |
| `pnpm build` (runs `css:v7` + the contrast gate as `prebuild`) | **exit 0** · 24 screens · 248 colour pairs · **0 unresolved · 0 below threshold** |
| Vitest | **468 / 468** |
| **The pixel gate** | **35 MATCHING · 0 failures · 0.14 % – 1.37 %** |
| The style gate (secondary) | 66 pairs · **63 pass · 0 fail · 0 uncovered** · 1 live-only · 2 no-data |
| Playwright `tests/e2e` | **152 passed · 5 failed · 3 skipped** |

### Remaining failures: the 5 known pre-existing ones

| Test | Status |
|---|---|
| `homepage.spec.ts:238` hero dual CTAs resolve to /quote and /about/services | Pre-existing |
| `homepage.spec.ts:253` header logo height / tagline | Pre-existing |
| `modify-in-flashdraft.spec.ts:179` saving a modified draft | Pre-existing |
| `production-queue.spec.ts:22` quick advance updates order status | Pre-existing |
| `production-queue.spec.ts:50` rush orders appear at top of queue | Pre-existing |

None of the five is touched by this run: two are the public homepage, one is
FlashDraft's save path, two are the production queue, and this run changed no
route behaviour and no data module.

**There are no new failures.** The thirteen the rebuild caused are all fixed
above, and the Shop View end-to-end — which failed for a real reason, the
three-second silence after pressing a button — passes.

**Two environmental things worth knowing about, because they cost this run
hours and will cost the next one the same if nobody writes them down.**

1. **`auth.setup.ts` intermittently times out waiting for the login form**, and
   when it fails outright the whole suite reports "164 did not run". It is a
   cold `next dev` compile of `/login` against the 30s setup budget, not a code
   failure — hitting `/login` once before the run makes it reliable.

2. **A long-running `next dev` degrades, and when it does the suite's results
   are not evidence of anything.** One run of this suite took **1.2 hours** (the
   same suite takes about 22 minutes on a fresh server) and reported **50
   failures spread across specs this branch cannot touch** — `/about/services`,
   the quote-request wizard, the configurator redirects, the WebGL fallback,
   homepage link integrity. Restarting the dev server and clearing `.next` put
   the pixel gate back to **35/35 in 2.2 minutes** and the style gate to 63 pass
   / 0 fail / 0 uncovered in 45 seconds.

   **If a run shows failures scattered across unrelated specs, restart the dev
   server before believing any of it.** A 50-failure run and a 6-failure run of
   the same commit are not two opinions; one of them is a measurement and the
   other is a tired server.

---

## 6. ONE THING THE GATE STILL CANNOT SEE — LOOK AT THE SCREENSHOTS

A pixel diff reports *that* two screens differ, in a percentage. It does not say
*what* in words. That is what the **structure gate** is for — it compares the
ordered sequence of visible landmarks and names what is missing, extra or
reordered — and what the **side-by-side PNG** is for.

Both are produced for every screen, in `test-results/v7-pixel/`:
`<id>-baseline.png`, `<id>-live.png`, `<id>-diff.png`, `<id>-side-by-side.png`.

Three of the seven defects above were found by *looking at the side-by-side*,
not by reading the number. Keep doing that.

---

## 6b. THE GATE MEASURES THE FIXTURE SCREENS, SO IT CANNOT SEE A LIVE-ONLY CHANGE

**Added 2026-10-03, branch `cc-flashdraft-handoff`. This is a coverage boundary,
not a defect, and it is written down so nobody mistakes a green run for coverage
it does not have.**

`app/admin/command-center/job/[id]/page.tsx` branches on `isFixtureMode` **before**
it loads anything: in fixture mode it renders `V7Job`, and the live three-column
screen below that branch is never reached. The same split exists on every screen
fixture mode substitutes data for. The pixel gate always runs in fixture mode —
it has to, or the diff would be measuring the database against a demo (rule #34) —
so **a change that only touches the live branch moves no pixel the gate looks at.**

That is exactly what the job -> FlashDraft handoff was. It added a red
**Design in FlashDraft** button to the live Job screen's header, its profile pane
and its parser-takeoff pane, and the gate came back:

```
35 MATCHING · 0 NOT MATCHING · 16 no live route · 3 live-only
```

— byte-identical to the baseline. **No baseline was updated, because no baseline
moved.** A run that changes a live-only branch should expect exactly this, and
should NOT go looking for a screen to re-baseline to prove it did something.

**What covers the live branch instead:** `tests/e2e/flashdraft-job-handoff.spec.ts`
(7 tests, real rows, real browser), the `prebuild` contrast gate — which reads the
JSX directly and therefore DOES see live-only markup — and
`tests/e2e/contrast-live.spec.ts`.

**The corollary matters more than the observation.** The fixture Job screen's own
FlashDraft buttons still point at a bare `/studio/draft`, because they belong to v7
and a fixture job is not a real quote request. Pressing one on `?fixture=v7` will
look exactly as unhelpful as it did before. That is correct for a prototype port and
wrong as a demonstration of the feature — **demonstrate it on a live job.**

---

## 7. THE GATE'S OWN RULES, SO A FUTURE RUN CANNOT QUIETLY WEAKEN IT

- **The baseline comes only from the untouched prototype**, re-rendered every
  run. There is no "update baselines" mode, because a baseline is not an
  expectation that can drift — it is a render of a committed file.
- **A size mismatch COUNTS as difference.** Both images are composited onto a
  canvas of the union size over a sentinel magenta, so a page that renders half
  of v7's content cannot score well by being short.
- **Five outcomes, one of which passes.** `pass`, `fail`, `missing` (a v7 state
  with no live route — named, never waved through), `live-only`, and `error`
  (a side that could not be reached — fails, because a gate must not pass by
  failing to look).
- **The manifest and the drivers are forced to agree**, in both directions. A
  state added to one and not the other fails the run.
- **Only v7's own review banner is removed from a baseline** (`.proto`,
  `#gpeek`, `#toast`), identified by its own class and ids. It is a static block
  that would offset every screen past any possible budget, and removing it can
  only make the prototype side *more* like a shipped page.
- **Fixture mode takes three locks**: `CC_FIXTURE=1`, a non-production build,
  and `?fixture=v7` on the URL. `lib/fixtures/mode.test.ts` asserts each
  independently, including the one combination that could happen by accident.
  It replaces **data only** — never authentication.
- **The baselines are gitignored.** They are re-rendered from the committed
  prototype on every run, so committing them would add several megabytes of
  churn per run for no gain. The canonical truth is the prototype HTML, which
  **is** committed.

### The contrast gate caught this run, and it was right

`pnpm build` runs `scripts/audit/contrast-check.mjs` as `prebuild` (rule #28),
and the first build after the rebuild reported **65 unresolved** where the
previous state had **0**. Nothing was below threshold, so the build still
passed — but rule #28 is explicit that *"if a change makes that number rise, the
gate got blinder, not the code safer."*

The cause was mine: the new components built class names as runtime templates —
`` `pill ${tone}` ``, `` `pstrip ${tone}` ``, `` `step ${state}` `` — which the
contrast gate cannot read, so 65 colour pairs stopped being measured at all.
They are whole-className **maps** now (`PILL_CLASS`, `PSTRIP_CLASS`,
`STEP_CLASS`, `TAG_CLASS`, `INBOX_CLASS`, `TRACK_PILL_CLASS`, `STATE_CLASS`,
`MARK_CLASS`), which the gate expands and measures.

**Back to `24 screens · 248 colour pairs · 0 unresolved · 0 below threshold`.**

Worth recording because it is the same failure mode as the style gate, one layer
down: a gate that silently stops looking at something still reports PASS.

### One thing to know about running it

**Give `next dev` a moment after a large file change before trusting a run.**
The first full run after checking the whole UI back out reported the Workbench
and the two header states as failing with *real customer data in the
screenshots* — a stale compiled route, not a regression. Re-running those three
on a settled server put them at 0.47%, 0.75% and 0.43%. If a screen fails and
the live screenshot is showing the database instead of v7's samples, that is
what happened; re-run before investigating anything else.

---

## 8. FOR THE OWNER

```
pnpm dev
```

Then open these two side by side:

- **the app** — `http://localhost:3000/admin/command-center?fixture=v7`
- **the prototype** — `docs/design/command-center-v7/AFS_Command_Center_Prototype_v7.html`

Both will be showing the **same sample data**, so anything that differs is the
port. Click through: Quotes, Orders, Shop View, Deliveries, Customers, Pricing,
Search, New quote, Settings, and any job card.

Drop `?fixture=v7` and the same screens show real data in the same layout.

**Your own confirmation is still required.** Every number in this document is
this session's own measurement. The project's verification standard
(STATE_OF_THE_BUILD.md) is explicit that a session's own evidence — a passing
gate, a screenshot diff — is evidence to bring to you, not a substitute for your
having looked. Thirty-five screens measuring under 1.5% is a much stronger piece
of evidence than the old gate's 66/66 was, and it is still not you looking at it.

---

*docs/design/V7_PIXEL_REPORT.md · branch `cc-v7-pixel` · 2026-10-02*
