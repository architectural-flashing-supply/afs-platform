# BEHAVIOR_MAP.md
## Prototype v7's JavaScript → the ported React, function by function

**Branch `cc-v7-pixel`. 2026-10-02.**

v7 is a single page that re-renders itself from one in-memory `S` object. The
Command Center is a routed server-rendered app. So "port the behaviour" cannot
mean "copy the function" — most of v7's actions are a mutation of `S` followed
by `render()`, and the honest equivalent is usually a URL, sometimes a client
handler, and occasionally a route that already exists and does the real thing
v7 only mimes.

This table says which, for every function in v7's `A` action table and every
input/change handler beside it. **Three outcomes**, and the third is the one
worth reading:

- **URL** — v7 kept the state in `S`; the port keeps it in the query string, so
  the screen is a server component and every state is a shareable link.
- **Handler** — a React handler doing the same thing in the same place.
- **Real route** — v7 fakes it; the app already has the real one, and the port
  keeps the real one. These are the places where the port deliberately does NOT
  look like v7, and each is listed again in `docs/design/V7_PIXEL_REPORT.md`.

---

## Navigation and the shell

| v7 | What it does | Port | Where |
|---|---|---|---|
| `go(page, id)` | sets `S.route`, re-renders, scrolls to top | **URL** — `next/link` to the route | every screen |
| `header()` `nv()` | nav item, `.on` for the current page | **Handler** — `usePathname()` + `isActivePath` | `components/layout/AdminTopBar.tsx` |
| `A.more` | toggles `#mm` hidden | **Handler** — `moreOpen` state, outside-click and Escape | `AdminTopBar.tsx` |
| `A.logout` | toasts "nothing to sign out of" | **Real route** — `supabase.auth.signOut()` then a hard redirect | `AdminTopBar.tsx` |
| `A.newQuote` | `go('newquote')` | **URL** — `NEW_QUOTE_HREF` | `lib/data/admin-nav.ts` |
| `hqShow(v)` | builds the type-ahead from `searchRows` | **Real route** — debounced fetch of `/api/admin/command-center/typeahead`, with the in-flight request abandoned | `AdminTopBar.tsx` |
| `A.hqRow` / `A.hqAll` / `A.hqQuote` | jump to a job, to Search, or to a new quote | **URL** — each dropdown row is a link | `AdminTopBar.tsx` |
| `A.reset` | reseeds `S` | **Not ported.** It resets the prototype's demo data; there is no demo data to reset. |
| `A.line` | toggles the drawing stroke between black and red | **Not ported.** Part of v7's review banner, which is prototype scaffolding — see `stripPrototypeChrome` in the pixel harness. |

## Workbench

| v7 | What it does | Port | Where |
|---|---|---|---|
| `pageWorkbench()` | five lanes, four chips, three rail panels | **URL** — server-rendered from `getWorkbench` | `components/admin/v7/V7Workbench.tsx` |
| `A.toLane` | `scrollIntoView` on a lane | **URL** — the chip is an anchor to `#lane-<key>`; works without JavaScript and is keyboard-reachable | `V7Workbench.tsx` |
| `A.toInbox` | scrolls to the inbox panel | **URL** — anchor to `#inbox` | `V7Workbench.tsx` |
| `A.machine` | `toMachine(j)` — sets lane, invents a profile number, toasts | **Real route** — POST `/api/admin/command-center/approve-quote-request`. This is **the one door** (CLAUDE.md rule #14): a verified approval in the database is what reaches catalog 20115. Untouched by this run. | `V7Workbench.tsx` |
| `A.open` | `go('job', n)` | **URL** — the card and its thumbnail link to the Job screen | `V7Workbench.tsx` |
| `A.reorder` / `A.reorderRow` | `makeJob(...)` from a past job | **Real route** — `/api/orders/[id]/reorder` on the New quote screen | `app/admin/quotes/new/page.tsx` |
| `A.checkMail`, `A.mailOpen`, `A.mailGo` | the Outlook inbox rail | **Not ported — honest empty state.** There is no Microsoft Graph code in this repo (`COMMAND_CENTER_V2_SPEC.md` §2.4) and the Entra registration is pending. The panel renders in v7's markup and says it is not connected. | `V7Workbench.tsx` |
| polling | v7 never polls; it is one page | **Handler** — 60s `router.refresh()`, torn down on `visibilitychange` so a Workbench left on a shop monitor stops querying | `V7Workbench.tsx` |

## Quotes, Orders and Search

| v7 | What it does | Port | Where |
|---|---|---|---|
| `pageList(kind)` / `listRows` | filter, sort, render | **URL** — `parseListQuery` + `applyListQuery`, both pure and unit-tested, unchanged by this run | `app/admin/quotes|orders/page.tsx` |
| `input [data-in=lq]` | filters as you type | **Handler** — debounced `router.replace` (200 ms), so a fast typist makes one navigation | `components/admin/v7/V7FilterBar.tsx` |
| `change [data-in=ls]` | filters on change | **Handler** — `router.replace` on change. **There is no Apply button**; the previous build had one and v7 does not. | `V7FilterBar.tsx` |
| `listAct(j)` | one button per row, by stage | **URL** — every list action is a link to the Job screen or Shop View | `lib/data/v7-view/from-live-lists.ts` |
| `.lr` row click (`data-go`) | opens the job | **Handler** — `V7RowLink`, which ignores clicks that land on a real control. Deliberately not focusable: the `.c6` button is the keyboard path, exactly as in v7. | `components/admin/v7/V7RowLink.tsx` |
| `pageSearch()` / `searchRows` | the same rows over every stage | **URL** — `parseSearchQuery` + `applySearchQuery`, unchanged | `app/admin/search/page.tsx` |
| `A.clearPid` | drops the profile filter | **Not applicable.** v7's profile filter belongs to the PROFILE search, which is a different screen (rule #27). The chip is never rendered rather than rendered inert. | `from-live-lists.ts` |

## Shop View

| v7 | What it does | Port | Where |
|---|---|---|---|
| `pageShop()` | the queue table, Finished today, Next up | **URL** — `getShopQueue`, unchanged | `components/admin/v7/V7ShopBoard.tsx` |
| `A.start` / `A.finish` | flips `j.shop` in memory | **Real route** — PATCH `/api/admin/shop-library/[id]`, which really advances the job, really auto-schedules the delivery on the next business day (rule #24) and really notifies the customer (rule #25) | `V7ShopBoard.tsx` |
| `A.openop` | opens the operator screen | **Not ported.** v7's take-over-the-screen operator view has no live route; see the report. |
| `A.opFull` | fullscreen | **Not ported** — same reason. |
| `A.addNote` | appends to `j.notes` | **Not ported.** The live queue card carries shop-floor instructions rather than a message thread. |
| polling | n/a | **Handler** — 30s, torn down on `visibilitychange`; and the drawings are never in the poll (rule #26) | `V7ShopBoard.tsx` |

## The Job screen

| v7 | What it does | Port | Where |
|---|---|---|---|
| `pageJob()`, `requestPane`, `profilePane` | the two left columns | **URL** — `getJobScreen`, unchanged | `app/admin/command-center/job/[id]/page.tsx` |
| `stagePane(j)` ×5 | a different right-hand pane per stage | **Real route** — `JobActionPanel`, which actually sends the quote, records a phone approval and opens the one door | `components/admin/JobActionPanel.tsx` |
| `A.sendQuote` | sets `j.lane='quoted'`, toasts | **Real route** — `/api/admin/command-center/send-quote`, which builds the signed single-use Approve link and emails it (rule #21) | `JobActionPanel.tsx` |
| `A.phoneOk` | `approve(j,'by phone')` | **Real route** — `/api/admin/command-center/approve-by-phone`, which writes the approval record the single-door guard reads and deliberately leaves `status='submitted'` alone (rule #14) | `JobActionPanel.tsx` |
| `A.simApprove` | **"Pretend Mike clicked Approve"** | **Deliberately not ported.** It is a review affordance for a prototype. The real path is the customer clicking Approve in their email. |
| `A.confirmColor` | sets `j.colorOk` | **Not ported.** The live reading comes from `lib/ai/takeoff-confidence.ts`, which has its own one confidence vocabulary (rule #17). |
| `A.useEng`, `A.loadEx` | fills a price from v7's calculator | **Not ported.** Prices come from the versioned price book (rules #19, #20), never from a calculator in the browser. |
| `A.fd`, `A.fdAdj`, `A.fdSave`, `A.fdReset`, `A.fdApply` | v7's FlashDraft modal | **Real route** — FlashDraft is a separate real application at `/studio/draft`, not a modal. The canonical-points handoff is untouched. |
| `A.docq`, `A.doci` | the quote/invoice paper modal | **Not ported.** See the report. |
| `A.chg1*`, `A.chg2*`, `A.addApprove` | change orders and addenda | **Not ported** — gap-audit items 8 and 9; neither concept exists in the schema. |

## Deliveries

| v7 | What it does | Port | Where |
|---|---|---|---|
| `pageDeliveries()` | the split view | **URL** — `?full=list` / `?full=map` / `?day=` | `app/admin/deliveries/page.tsx` |
| `A.dvFull` | expands one half | **URL** | same |
| `A.dvDay` | switches the map's day | **URL** | same |
| `A.dvSel` | selects a stop | **Not ported.** v7 highlights a marker on a schematic map; the live map is the real tracking map. |
| `A.sched`, `A.mDay`, `A.mWin`, `A.schedOk` | the scheduling modal | **Real route** — inline rescheduling in `DeliveriesWeek`, against `lib/delivery/business-days.ts` (rule #24, weekends and the shop's own time zone) |
| `A.delivered` | sets the lane to done | **Real route** — `/api/admin/command-center/mark-delivered` |
| `mapSVG(day)` | a hardcoded schematic | **Real route** — `DeliveryTrackPanel` renders the real map the customer already sees. The schematic is transliterated in `lib/design/v7-delivery-map.ts` **for the pixel gate only**, because its fallback for an unknown company is a hash of its name. |

## New quote, Customers, Pricing, Settings

| v7 | What it does | Port | Where |
|---|---|---|---|
| `A.nqPick`, `A.nqBlank` | pick a customer / start blank | **URL** — `?customer=`, `?new=1` | `app/admin/quotes/new/page.tsx` |
| `input [data-in=nq]` | filters the customer rail | **URL** — `?q=`, so the search box works with no JavaScript |
| `A.nqCreate` | pushes onto `CUSTS` | **Not built, and says so on the form.** Creating a customer means creating an auth account. |
| `A.nqDraw`, `A.selectProf` | start a quote from a profile | **Real route** — the existing FlashDraft studio |
| `A.custPick` | selects a customer | **URL** — `?c=` | `app/admin/customers/page.tsx` |
| `A.editContact`, `A.saveContact` | the inline contact editor | **Real route** — a contact is edited on the account's own record at `/admin/customers/[id]`, where the rest of the account and its audit trail are. A second writer to the same row is not added. |
| `A.setSec` | switches the Settings section | **URL** — `?section=` | `app/admin/settings/page.tsx` |
| `A.tg` | flips a settings toggle | **Not built.** Each needs a settings table and a writer; a switch that flips and is forgotten on reload is worse than none on a screen whose settings decide whether a customer gets an email. |
| `A.addMat`, `A.delMat`, `A.clearEng`, `input [data-in=eng]` | edit the pricing engine | **Real route** — the versioned price book at `/admin/settings/price-book`. An edit INSERTS a version; the database refuses an update (rules #19, #20). |

## Things with no counterpart, in either direction

- **`showPeek` / `hidePeek` / `peekData`** — v7's hover-enlarge overlay. Not
  ported, and deliberately excluded from the manifest: it is reachable only by a
  real pointer and positioned from the hovered element's viewport rectangle, so
  it is not a reproducible screen. The app has its own hover-intent module with
  tested timings (`lib/ui/hover-intent.ts`, rule #27) on the profile rail.
- **`toast()`** — a 6.5-second overlay. The port reports results in place, in
  the card or panel the action belongs to, which survives being looked away from.
- **Credit Applications, Bid Monitor, Find a past profile** — three live screens
  v7 has no equivalent for at all. They keep their own behaviour.

---

*docs/design/command-center-v7/BEHAVIOR_MAP.md · branch `cc-v7-pixel`*
