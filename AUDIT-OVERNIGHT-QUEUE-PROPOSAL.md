# AUDIT-OVERNIGHT-QUEUE-PROPOSAL.md
## AFS — Ranked Build Queue for Unattended Overnight Runs

**Item:** `01-audit` · **Prompt ID:** `EES-OVN.01` (companion document)
**Date:** 2026-10-03 · **Branch:** `ovn/01-audit` · **HEAD:** `75118cb`
**Companion:** `AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md` — every classification,
path and measurement cited here is established there. This document does not
re-derive evidence; it ranks and specifies.

**Mode:** READ-ONLY. This document proposes work. It performs none.

---

# 1. WHAT THIS DOCUMENT RANKS, AND BY WHAT

Every **MISSING** and **PARTIAL** item in the registry matrix, plus the nine
additional findings (F-01…F-09) and the five failing Playwright tests, is a
candidate here. **29 candidates, Q-01 to Q-29.**

The brief asked for a ranking as *"a candidate for an unattended overnight
build"*. That is a different ordering from business value, and the difference
matters: Stage C (moving invoice creation to shop-finish) is probably the
highest-business-value gap in the platform and is simultaneously one of the
**worst** overnight candidates, because it is a live-money migration whose
failure mode is billing a customer wrongly with nobody awake.

**The ranking function, stated so it can be argued with:**

| Factor | Weight | Why |
|---|---|---|
| **Decision-free** | gate | If Reid must choose first, no amount of value makes it tonight's work. A run that guesses a product decision produces work that must be thrown away. |
| **Self-contained blast radius** | heavy | Does it touch money, auth, `middleware.ts`, outbound customer communication, or the PathfinderEdge single door? Each is a place where a wrong unattended change is expensive and slow to notice. |
| **Verifiable without a human** | heavy | Is there an existing harness — a unit suite, a static test, a build gate — that can prove the result? Work whose only proof is "it looks right" fails this project's own verification standard anyway. |
| **No external key, no Steve's data** | gate | A run that ends "blocked, waiting for a credential" has produced nothing. |
| **Bounded** | moderate | S fits comfortably in a run with full gates; L risks the half-finished state the standing instruction forbids. |
| **Value** | moderate | Applied last, as a tie-break among items that already pass the gates above. |

**Size.** **S** = one or two files, no migration, under ~300 lines changed.
**M** = several files, possibly one additive migration, a new route or
component, new tests. **L** = a new subsystem: migration plus schema plus UI
plus tests, or a change to an existing money/machine path.

**Risk flags.** `$` money · `A` auth/RLS · `@` outbound customer email or SMS ·
`MW` would need `middleware.ts` (**forbidden**) · `DB` needs a migration ·
`MACHINE` interacts with the PathfinderEdge single door (rule #14).

---

# 2. THE RANKING AT A GLANCE

## Tier 1 — build tonight, no decision needed (Q-01 … Q-09)

| # | Item | Size | Risk | Keys? | Steve's data? | Reid? |
|---|---|---|---|---|---|---|
| Q-01 | Regenerate `SITEMAP.md` from the filesystem | S | — | no | no | **no** |
| Q-02 | Send the team-invitation email | S/M | `@` | no | no | **no** |
| Q-03 | Complete `UNLINKED_ADMIN_ROUTES` (documentation half only) | S | — | no | no | **no** |
| Q-04 | Build `SPEC_AI_ORDER_VALIDATOR` | M | — | no | no | **no** |
| Q-05 | Estimate copy to the office when a quote is sent (gap item 6) | S/M | `@` | no | no | **no** |
| Q-06 | Rebuild the credit application against the real paper form | M/L | `A` | no | no | **no** |
| Q-07 | Promote the email template library + the 3 remaining templates | M | `@` | no | no | **no** |
| Q-08 | `/studio/hem-debug` — gate or remove the public debug route | S | — | no | no | **no** |
| Q-09 | Spec-file hygiene: the duplicate pricing specs + `CLAUDE.md`'s spec paths | S | — | no | no | **no** |

## Tier 2 — good overnight work, one caveat each (Q-10 … Q-14)

| # | Item | Size | Risk | Keys? | Steve's data? | Reid? |
|---|---|---|---|---|---|---|
| Q-10 | Architectural Resource Center CMS | L | `A` `DB` | no | no (content yes, CMS no) | **no** |
| Q-11 | Freight estimator — the ungated code half | M | `$`(internal only) | no | partly | **no** |
| Q-12 | Customer-facing delivery request | M | `DB` | no | partly | soft |
| Q-13 | `.gitattributes` / CRLF portability (F-01) | S | — | no | no | **no**, but see the renormalisation hazard |
| Q-14 | Re-verify `INVOICE_AUDIT.md`'s paid-flag bug against the real `invoices` table | S | `$` | no | no | **no** |

## Tier 3 — DECISION REQUIRED before any build (Q-15 … Q-21)

| # | Item | Size | Risk | What Reid must decide |
|---|---|---|---|---|
| Q-15 | The orphaned production queue (2 red tests + 3 dead components) | M | — | Delete it, or restore it at a new URL? |
| Q-16 | FlashDraft modified-profile `revision` semantics (1 red test) | S | — | Does "revision" mean lineage depth or this row's edit count? |
| Q-17 | Hero secondary CTA target (1 red test) | S | — | `/about/services` or `/design-studio` — and does `/design-studio` survive at all? |
| Q-18 | "Photo to Quote" false door | S or L | — | Repoint the tab honestly, or build the photo mode? |
| Q-19 | Stage C — invoice at shop-finish + reconciliation | L | `$` `@` `DB` | Move billing, or keep it at approval and add reconciliation only? |
| Q-20 | Stage F part 1 — change orders before the machine | L | `$` `@` `DB` `MACHINE` | Void semantics vs the single-door guard |
| Q-21 | Stage F part 2 — addenda after the job started | L | `$` `@` `DB` | Schema shape, shop visibility, invoice line type |

## Tier 4 — BLOCKED; do not queue until the blocker clears (Q-22 … Q-29)

| # | Item | Blocked on |
|---|---|---|
| Q-22 | TaxJar | Nexus states (checklist #31) **and** `TAXJAR_API_KEY` |
| Q-23 | Stripe ACH | Reid's decision + Stripe account capability |
| Q-24 | Google Maps key TODO | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the deployment |
| Q-25 | Product catalog content | Reid: 26 flagged manifest entries, 2 category questions, no copy |
| Q-26 | Auto material calculator §2.2 / §2.3 | Accessory + stock-length product data |
| Q-27 | Finish palette, CAD/BIM library, material spec sheets, installation guides | Client content (#14, #57–62) |
| Q-28 | Privacy Policy (launch blocker) | Legal text (#65) |
| Q-29 | Workbench Outlook rail + mail parser | Microsoft 365 tenant consent |

---

# 3. TIER 1 — BUILD TONIGHT

## Q-01 · Regenerate `SITEMAP.md` from the filesystem

**Size S · Risk: none · No keys · No Steve's data · No decision**

**Why first.** It is the cheapest high-value item in the list and it makes every
later run cheaper. `SITEMAP.md` under-reports the app by 96 files and documents
seven routes that were deliberately deleted — including two PathfinderEdge push
endpoints removed to establish rule #14's single door. A future agent reading it
would believe there are three ways to reach the bending machine. Nothing depends
on it, nothing can break, and the result is mechanically verifiable.

> **Prompt skeleton.** Regenerate `SITEMAP.md` entirely from the filesystem, not
> from the existing document. Enumerate `find app -name page.tsx` and `find app
> -name route.ts`, convert each to its URL (stripping the `(public)` and `(auth)`
> route groups), and rebuild the ROUTE TREE, the ROUTE PROTECTION MATRIX and the
> PAGE + ROUTE COUNT from that enumeration. The protection column must be derived
> from real code — `middleware.ts`'s matcher and role gate, each page's
> `requireAdminUser` / `requireOperator` call, and `lib/machine-bridge/auth.ts`
> for the bridge routes — never from the old document. Delete the seven
> never-existing routes listed in `AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md` §5.2 and
> add the ~28 undocumented pages in §5.3. Keep the URL NAMING CONVENTIONS section
> as-is. Preserve the document's existing "routes described in earlier drafts
> that were never built" convention, but repopulate it from this run's own
> existence checks. Add a short note recording that the previous counts (111/112)
> were measured on 2026-07-14 and were wrong by 96 files as of this run. **Add a
> unit test** — `lib/data/sitemap-accuracy.test.ts` — that walks `app/`, derives
> the route list, parses the route list back out of `SITEMAP.md`, and fails on any
> difference in either direction, so the document cannot silently go stale again.
> That test is the acceptance criterion; no browser check is needed. Do not touch
> any application code.

## Q-02 · Send the team-invitation email

**Size S/M · Risk `@` · No keys · No Steve's data · No decision**

**Why.** `app/api/team/invite/route.ts` creates the `team_invitations` row and
`/invite/[token]` accepts it, but **nothing mails the link** — verified: that
route contains no `sendEmail`, no `sendTrackedEmail`, no `subject`. The feature
is unusable without someone reading a token out of the database.
`SPEC_EMAIL_TEMPLATES` names `team-invitation` as template 14. The `@` risk is
real but contained: `lib/email/outbound.ts` already captures rather than sends
for a job carrying the `E2E-TEST-` prefix (rule #21) and already records every
attempt in `outbound_emails`, so an unattended run can prove the send path
without a message leaving the building.

> **Prompt skeleton.** Add the team-invitation email to
> `app/api/team/invite/route.ts`. Compose it with `baseEmailTemplate()` and
> `ctaButton()` from `lib/resend/templates/base.ts` and send it through
> `sendTrackedEmail` in `lib/email/outbound.ts` — do **not** add a second sender,
> a second template file or a second test-mode switch (rule #25). The CTA points
> at `${getSiteUrl()}/invite/${token}` via `lib/site-url.ts`; never a hardcoded
> host (rule #9). The invitation row must be written **before** the send, and a
> send failure must not roll back the invitation nor return a 500 — report it to
> the caller as "the invitation was created but the email could not be sent", with
> the `outbound_emails` row recording the real reason, because Resend is
> unconfigured on alpha and an honest degraded message is the behaviour
> `lib/delivery/notify.ts` already establishes. Add unit tests for the template
> body (company name, inviter name, absolute URL, expiry) and a Playwright test
> that creates an invitation under an `E2E-TEST-` prefixed name, asserts an
> `outbound_emails` row with `status='captured_test_mode'`, asserts **no**
> `notifications` row (rule #25: a captured message gets none, because the status
> CHECK has no honest value for it), and deletes every row it created.

## Q-03 · Complete `UNLINKED_ADMIN_ROUTES` (documentation half only)

**Size S · Risk: none · No keys · No Steve's data · No decision**

**Why.** `lib/data/admin-nav.ts` keeps a deliberate, unit-tested record of admin
routes that exist but are intentionally not in the nav — "kept as data so the
reason is recorded next to the decision instead of only in a commit message". It
names two. At least four more qualify: `/admin/orders-crm`,
`/admin/quote-requests`, `/admin/quickbooks`, `/admin/shop-library`. The
structure's value is that it is exhaustive; today it is not.

**Scope boundary that keeps this decision-free:** *record* the four, do not
*delete* or *re-link* anything. Whether `/admin/orders-crm` should survive at all
is Q-15's decision, and this item must not pre-empt it.

> **Prompt skeleton.** Extend `UNLINKED_ADMIN_ROUTES` in `lib/data/admin-nav.ts`
> with every admin page that exists under `app/admin/**` and appears in neither
> `TOP_LEVEL_NAV` nor `MORE_NAV`, each with a one-line `why` written from the
> page's own header comment. Then add a test to `lib/data/admin-nav.test.ts` that
> walks `app/admin/**/page.tsx`, derives each route, and asserts that every one is
> either in a nav list or in `UNLINKED_ADMIN_ROUTES` — so a future unlinked page
> fails the suite instead of going quiet. Change no nav entry, delete no route,
> add no link. If the test reveals a page whose reason for being unlinked cannot
> be determined from its own source, record it with
> `why: 'UNEXPLAINED — see AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md §5.4'` rather than
> inventing a rationale.

## Q-04 · Build `SPEC_AI_ORDER_VALIDATOR`

**Size M · Risk: none of the flagged kinds · No keys beyond the configured
`ANTHROPIC_API_KEY` · No Steve's data · No decision**

**Why.** It is the largest spec in the project with **zero** implementing code,
and it is the rare gap that is genuinely unblocked: it catches impossible
dimensions and incompatible material/gauge/profile combinations before
submission, which is geometry and compatibility logic the repo already
understands (`lib/flashdraft/geometry.ts`, `lib/utils/gauge-thickness.ts`,
`lib/data/material-color-requirement.ts`, `lib/data/catalog.ts`'s
`GAUGES_BY_MATERIAL`). It touches no money, no auth boundary, no email and no
machine path. Most of it should be **pure functions**, which is exactly what an
unattended run can prove.

> **Prompt skeleton.** Read `specs/SPEC_AI_ORDER_VALIDATOR.md` in full and
> implement it. Put the deterministic rules in a new pure module,
> `lib/validation/order-validator.ts`, with no I/O: dimension bounds (a blank
> wider than 48 in or a piece longer than 10 ft already fails loudly in
> `lib/pricing/quote-math.ts` under rule #19 — reuse those limits rather than
> restating them), material/gauge compatibility from `GAUGES_BY_MATERIAL`,
> material/finish compatibility from `lib/data/material-color-requirement.ts`, and
> bend/leg geometry sanity through `lib/flashdraft/geometry.ts`'s existing
> `signedInteriorAngleDeg` contract — **do not write a second geometry
> implementation** (rule #12). Only where the spec asks for judgement that no rule
> can express should an AI pass exist, and it must go through a new
> `app/api/validate-order/route.ts` using `claude-sonnet-4-6` with a validated
> response shape — never a client-side call (rule #5), never a cast
> (`lib/integrations/pathfinder-response.ts` is the parsing pattern to copy).
> Reuse the `high | medium | low` confidence vocabulary from
> `lib/ai/takeoff-confidence.ts`; **do not define a second one** (rule #17). The
> validator **advises and never blocks** a submission, and it must never compute,
> imply or display a price. Surface it in the Quote Wizard (`app/quote/page.tsx`)
> and at checkout as a warning panel with the project's existing empty/loading/
> error states. Acceptance: unit tests covering every rule's happy path, error
> path and boundary (null, zero, max, the exact 48 in and 10 ft limits), at least
> 80% line coverage on the new module measured not estimated, plus one Playwright
> test that an impossible dimension raises a visible warning and that submission
> is still permitted.

## Q-05 · Estimate copy to the office when a quote is sent (gap item 6)

**Size S/M · Risk `@`, money-adjacent · No keys · No Steve's data · No decision**

**Why.** This is the *only* gap in the v7 audit's own phase plan described as
"the only gap where the business is currently missing information it should
have", and the gap audit put it first for that reason. It is small:
`app/api/admin/command-center/send-quote/route.ts` already builds the quote,
already sends the customer's copy with the single-use Approve link, and already
moves the job to Quoted. It needs one additional send. Every piece of plumbing
exists — `officeInvoiceEmail()` in `lib/data/office.ts`, `sendTrackedEmail`,
`outbound_emails`, `lib/resend/templates/base.ts`.

**One design question the run must answer in code, not ask about:** v7 expects
the office copy to move from "pending approval" to "approved". The gap audit
offers a small status column or an `outbound_emails` convention. **Prefer the
`outbound_emails` convention** — it needs no migration, and `outbound_emails`
already exists precisely to record what was sent and when. Record the choice.

> **Prompt skeleton.** Add an office copy of the estimate to
> `app/api/admin/command-center/send-quote/route.ts`. The address comes from
> `officeInvoiceEmail()` in `lib/data/office.ts` and from nowhere else — never a
> literal, and the spelling is `trica@` (rule #21: do **not** "correct" it). Send
> through `sendTrackedEmail`, so the `E2E-TEST-` capture rule and the
> `outbound_emails` record both apply automatically. The body carries the quote
> number, the customer, the line items and the total — the same figures the
> customer's copy carries, read from the same snapshot, never recomputed from the
> price book (the price book may move; rule #21's reasoning for invoices applies
> identically here). Mark the copy as *pending customer approval*, and when
> `app/api/quote-approve/[token]/route.ts` later fires, record the transition to
> approved **via `outbound_emails`**, not via a new column — state that choice and
> its reason in the governance append. This route must remain **not** a door to
> the machine: import nothing from `lib/integrations/pathfinder-edge.ts`, change
> neither `status` nor `job_stage` beyond what it already changes, and leave the
> static single-door test untouched and passing. A failed office send must not
> fail the customer send, must not roll back the stage change, and must be visible
> — one `outbound_emails` row with the real reason. Acceptance: a Playwright test
> that sends a quote for an `E2E-TEST-` prefixed job, asserts **two** captured
> `outbound_emails` rows (customer and office), asserts the office row names the
> address from `officeInvoiceEmail()`, and deletes everything it created.

## Q-06 · Rebuild the credit application against the real paper form

**Size M/L · Risk `A` (it collects financial identity) · No keys · No Steve's
data · No decision**

**Why.** `CREDIT_APP_GAPS.md` is already a field-by-field specification against
the real AFS fillable PDF, and its verdict is blunt: the live form "is a
plausible-looking generic credit app invented from the spec's TypeScript
interface — it was never built against the actual paper form." Two whole
sections are missing and only 4 of 7 trade-reference fields are collected. **No
migration is needed** — `application_data` is JSONB and already accommodates
every field. The spec is written, the schema is ready, the decision is made. That
combination is rare in this backlog.

**The `A` flag is about data sensitivity, not about changing the auth model.**
The route is already authenticated; this run must not alter that.

> **Prompt skeleton.** Rebuild `components/account/CreditApplicationForm.tsx`,
> the input type in `app/api/credit/apply/route.ts`, and the admin display in
> `components/admin/CreditApplicationReviewModal.tsx` to match **every** field of
> the real form as enumerated section by section in `CREDIT_APP_GAPS.md`. Add the
> two missing sections (business and bank address information; the real legal
> agreement text) and all seven trade-reference fields. **No migration** —
> everything lands in `credit_applications.application_data` (JSONB), as that
> document establishes. Validate at the boundary in the route, never only in the
> browser, and keep the existing authentication and `company_id`-from-session
> behaviour exactly as it is — do not widen, narrow or restructure it. The legal
> agreement text must be reproduced verbatim from `CREDIT_APP_GAPS.md`; **if that
> document does not contain the full text, stop and record it as a GAP rather than
> drafting legal language.** Net-terms options remain checklist #34 — render
> whatever the existing code renders and invent no new option. Acceptance: a unit
> test asserting the submitted payload shape contains every field the document
> lists (so a dropped field fails rather than going quiet), a boundary test for
> each required/optional field, and a Playwright test that submits a complete
> application under an `E2E-TEST-` prefixed business name, asserts the admin
> review modal displays every section, and deletes the row.

## Q-07 · Promote the email template library, and add the three remaining templates

**Size M · Risk `@` · No keys · No Steve's data · No decision**

**Why.** `SPEC_EMAIL_TEMPLATES` specifies 14 templates and a library.
`lib/resend/templates/` contains exactly one file — a shell and a button — and
every subject line is composed inline at its call site, which is how
`order-confirmation`, `pre-ship-photo` and `admin-new-order` came to not exist at
all while three separate status emails collapsed into one generic
`"Order #… Update: {stageLabel}"`. Consolidating is low-risk and makes the
remaining three cheap.

**Sequence this after Q-02**, so the team-invitation template is written once, in
the new library, rather than written inline and then moved.

> **Prompt skeleton.** Create `lib/resend/templates/` modules — one exported
> function per template ID in `specs/SPEC_EMAIL_TEMPLATES.md`'s inventory table —
> each returning a subject and an HTML body built on the existing
> `baseEmailTemplate()` and `ctaButton()`. Move every existing inline composition
> onto its module **without changing a single subject line or body**: this half is
> a refactor, and a unit test must assert the rendered output of each moved
> template matches the string the old call site produced. Then add the three
> absent templates: `order-confirmation` (fired from
> `app/api/webhooks/stripe/route.ts` on payment success — idempotent, because
> Stripe retries, so key it to the order and refuse a second send),
> `pre-ship-photo` (fired from `app/api/admin/orders/[id]/photos/route.ts`, which
> currently writes only a `notifications` row) and `admin-new-order` (to the
> address `lib/data/office.ts` names, never a literal). `account-confirmation` and
> `password-reset` stay with Supabase Auth and get **no** module — record that as
> a deliberate deviation from the spec's count of 14 rather than building a second
> auth mailer. Whether the three collapsed status emails (`order-in-queue`,
> `fabrication-started`, `order-ready`) should separate is **blocked on the shop's
> real stage names, checklist #39** — leave the generic sender in place and record
> it as a GAP. Everything sends through `sendTrackedEmail`. Acceptance: a unit
> test per template (subject, CTA href absolute via `getSiteUrl()`, required
> fields present), an idempotency test for `order-confirmation` proving a repeated
> webhook sends once, and a Playwright test over an `E2E-TEST-` prefixed order
> asserting captured `outbound_emails` rows and deleting them.

## Q-08 · `/studio/hem-debug` — gate or remove the public debug route

**Size S · Risk: none · No keys · No Steve's data · No decision**

**Why.** `app/studio/hem-debug/page.tsx` is a developer canvas that renders hem
glyphs at 15× scale. Its own header says "Reach this at /studio/hem-debug". It
sits under `/studio`, which `SITEMAP.md`'s protection matrix marks "No auth", so
it is anonymously reachable in production with no `noindex`. The project already
has the right pattern for exactly this: `/admin/geometry-test` is a
developer-only tool, admin-gated twice, `robots: { index: false }`, and recorded
in `UNLINKED_ADMIN_ROUTES`.

**Why it is decision-free:** the precedent exists and is documented. Applying it
is not a product choice.

> **Prompt skeleton.** Bring `app/studio/hem-debug/page.tsx` in line with the
> `/admin/geometry-test` precedent recorded in `lib/data/admin-nav.ts`: add
> `export const metadata = { robots: { index: false, follow: false } }` and an
> admin-role server check, or — if the page is a client component and cannot take
> a server check in place — move it under `app/admin/` so the existing
> `middleware.ts` admin gate covers it, update the one reference in its own header
> comment, and record it in `UNLINKED_ADMIN_ROUTES` with the reason. **Do not
> modify `middleware.ts`.** Do not change `drawHemGlyph` or anything it calls —
> the page's value is that it renders the exact same function as the real canvas,
> and that must stay true. Acceptance: a Playwright test asserting an anonymous
> request to the route does not render the debug canvas, and the existing
> FlashDraft hem regression tests still pass unchanged.

## Q-09 · Spec-file hygiene

**Size S · Risk: none · No keys · No Steve's data · No decision**

**Why.** Three `SPEC_PRICING_ADMIN` files exist — a 126-line one that `CLAUDE.md`
names, and two byte-identical 223-line copies with `(1)` and `(2)` in their
filenames. Two sources of truth for pricing administration is precisely the
"contradictory sources of truth" the Canonical Laws prohibit. Separately,
`CLAUDE.md` lists ~52 specs by bare filename with no directory — they are in
`specs/` — and omits two specs that describe shipped subsystems (HailView, the
delivery-tracking/employee PWA).

**One caveat that keeps it decision-free:** *do not delete* either duplicate. A
223-line revision that was never promoted may be the better document. Mark, do
not destroy.

> **Prompt skeleton.** Do not delete any spec file. Add a short `## STATUS` block
> at the top of `specs/SPEC_PRICING_ADMIN (1).md` and `(2).md` recording that they
> are byte-identical to each other, that they are a 223-line revision of the
> 126-line `SPEC_PRICING_ADMIN.md` that `CLAUDE.md` names as canonical, that the
> promotion decision is **PENDING REID**, and that until he decides, the 126-line
> file governs. Then correct `CLAUDE.md`'s SPEC DOCUMENTS section: prefix every
> entry with `specs/`, and add the two root-level specs it never lists —
> `SPEC_HAILVIEW.md` and `SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md` — in a
> clearly-labelled "shipped, previously unlisted" group. Change no rule, no
> numbered item and no other prose in `CLAUDE.md`. Add a test that every filename
> `CLAUDE.md` names in that section resolves to a file that exists, and that every
> `SPEC_*.md` on disk appears in that section — so the list cannot drift again.

---

# 4. TIER 2 — GOOD OVERNIGHT WORK, ONE CAVEAT EACH

## Q-10 · Architectural Resource Center CMS

**Size L · Risk `A` `DB` · No keys · The CMS is not blocked on Steve's data; the
content is · No decision**

**Caveat:** the run delivers an admin authoring surface that will be empty until
content arrives. That is the correct outcome under the no-shells rule — a fully
working CMS with zero articles is honest; a hardcoded empty array pretending to
be CMS-driven is not — but Reid should expect no visible change on
`/architects/guides` the next morning.

> **Prompt skeleton.** `app/(public)/architects/guides/page.tsx` declares itself
> CMS-driven and is not: its articles are `const ARTICLES: Record<Category,
> never[]>`. Build the CMS the spec describes. Additive migration (next free
> number, after 038) creating `resource_articles` with
> `category text CHECK (category IN ('standards','installation','specification','faq'))`,
> `slug` UNIQUE, `title`, `body`, `published boolean NOT NULL DEFAULT false`,
> `published_at`, `author_id`, timestamps — RLS enabled, admin full access, public
> SELECT **only where `published = true`**, following the pattern migration 033
> established for `building_code_jurisdictions`. **Write the migration FILE only;
> do not apply it**, and print the SQL and its down-migration in the report. Add
> admin CRUD at `/admin/resources` (admin-gated server-side, inside
> `LightWorkingArea`, in v7's markup per rule #33 — and run the v7 pixel gate
> before finishing), and point the public page at the table, keeping its existing
> four-tab layout and `EmptyState`. Invent **no** article content: ship zero rows.
> Acceptance: unit tests for the data module's published/unpublished filtering and
> slug uniqueness; a Playwright test proving an unpublished article is invisible to
> an anonymous reader and visible to an admin — that is the RLS data-leak test and
> it is mandatory; and the public page still rendering its empty state with zero
> rows.

## Q-11 · Freight estimator — the ungated code half

**Size M · Risk `$` (internal estimator only; customers never see it) · No keys ·
Partly Steve's data · No decision**

**Caveat:** `FREIGHT_ESTIMATOR_SCOPE.md` already did the hard thinking and split
this "cleanly down the middle" — part is genuinely blocked on carrier data, part
is buildable today. **The run must build only the second part**, and the
temptation to fill the gap with a plausible rate is exactly what
`lib/pricing/quote-math.ts:236` refuses to do.

> **Prompt skeleton.** Read `FREIGHT_ESTIMATOR_SCOPE.md` and build **only** the
> portion it identifies as an ungated code gap. `getFreightClass()` already exists
> in `lib/admin/pricing.ts:35` and `components/admin/QuoteEstimatorForm.tsx`
> already takes a typed freight amount; extend from there. **Invent no rate, no
> carrier, no origin ZIP and no fuel surcharge** — the AFS origin is checklist #5
> and the rates are #80–82. Where a number is needed and not supplied, the
> behaviour is the one rule #19 establishes for an unset price: render a marked
> "Not set" state and refuse, naming what is missing, rather than defaulting to
> zero. Distance, if the scope document calls for it, uses the existing
> `haversineDistance` in `lib/utils/distance.ts`. This is **admin-only** — no
> freight figure may reach a customer-facing surface before the formal quote. Keep
> the calculation in a pure module with unit tests covering every boundary
> (zero-length piece, the longest class break, a missing rate, a missing origin),
> and list in the report exactly which spec sections remain blocked and on which
> checklist number.

## Q-12 · Customer-facing delivery request

**Size M · Risk `DB` · No keys · Partly Steve's data · Soft decision**

**Caveat and why it is only "soft".** The admin half shipped in v2-04: the
`deliveries` table, the four window keys in `lib/delivery/windows.ts`, business-day
scheduling in `lib/delivery/business-days.ts`. What is absent is the customer
side — `SPEC_DELIVERY_SCHEDULER`'s `/account/delivery` does not exist and
checkout offers no date. **Minimum advance notice is checklist #85 and is
genuinely unknown**, so a run must model a *request*, not a booking. That framing
is itself a mild product judgement; it is the conservative one, and it is
consistent with the RFQ model where AFS sets the terms.

> **Prompt skeleton.** Let a customer **request** a preferred delivery day and
> window from the order detail page, in the same place
> `components/account/PickupScheduler.tsx` already handles the pickup case —
> reuse that component's shape rather than inventing a second scheduler UI. The
> four windows come from `lib/delivery/windows.ts` and nowhere else (rule #24: the
> key is stored, the English lives in that module). A request is **not** a
> booking: it records what the customer would like, surfaces it on the admin
> Deliveries screen, and the shop still schedules — because the minimum advance
> notice is checklist #85 and inventing one would put a guess in the code. Weekend
> dates are rejected through `lib/delivery/business-days.ts`, never through a new
> date rule. Additive migration (file only, not applied; SQL and down-migration in
> the report) adding the request fields to `deliveries`, or a nullable
> `requested_*` pair — choose one and state why. `deliveries.shop_job_id` stays
> UNIQUE; a repeated request is an UPDATE of one row. Acceptance: unit tests for
> weekend rejection and window-key validity; a Playwright test that a request
> appears on the admin Deliveries screen and that a rush job's requested Thursday
> does **not** become a Tuesday stop (rule #15 — Deliveries is not a shop queue);
> every row deleted afterwards.

## Q-13 · `.gitattributes` / CRLF portability (F-01)

**Size S · Risk: none to runtime, real to the working tree · No keys · No data ·
No decision**

**Caveat — and it is the reason this is Tier 2 rather than Tier 1.** Adding a
`.gitattributes` with `* text=auto eol=lf` causes git to **renormalise the whole
repository** on the next checkout. That is a very large diff, it is easy to
confuse with real work, and doing it unattended on a branch that also carries
feature work would make review impossible. It should be its own run, its own
commit, and nothing else.

> **Prompt skeleton.** Make the repository check out identically on Windows and
> on CI. Add a `.gitattributes` pinning text files to LF — at minimum
> `app/styles/command-center-v7.generated.css`, `docs/design/command-center-v7/*`
> and every `*.css`, `*.ts`, `*.tsx`, `*.mjs`, `*.sql`, `*.md`, because
> `lib/design/v7-css.test.ts` compares the generated stylesheet byte-for-byte
> against the output of a transform that reads several of those files. **This
> commit does nothing else.** Run `git add --renormalize .` and commit the
> normalisation separately from the `.gitattributes` addition itself, so the two
> are reviewable apart. Verify by running `pnpm test:unit` on a clean checkout
> **without** running `pnpm build` first, and paste the real output: the
> acceptance criterion is 485/485 from a tree that has never been built, which is
> not currently achievable (today it is 484/485 — see
> `AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md` §2.1). Do not change the test, do not
> relax its `.toBe()` to a normalised comparison, and do not add a
> line-ending-stripping helper — the byte-exactness is the point of the gate.

## Q-14 · Re-verify `INVOICE_AUDIT.md`'s paid-flag bug

**Size S · Risk `$` (read-only investigation) · No keys · No data · No decision**

**Caveat:** this may be a no-op. `INVOICE_AUDIT.md` is from 2026-07-31 and
describes an invoice path that migration 035 and `lib/invoices/create.ts`
replaced wholesale. The bug may have been fixed incidentally, may have survived,
or may no longer be meaningful. **The deliverable is an answer**, and a fix only
if one is needed.

> **Prompt skeleton.** `INVOICE_AUDIT.md` (2026-07-31) reports that "invoice
> status ignores the 'paid' flag everywhere except the admin CRM tab". That audit
> predates migration 035's `invoices` table and `lib/invoices/create.ts` by two
> months. Determine whether the defect still exists: trace `invoices.paid_at` and
> `invoices.status` from `lib/data/invoices.ts` through every consumer —
> `/account/invoices`, `app/api/invoices/[id]/pdf`, `components/admin/InvoicesCrmTab.tsx`,
> `app/api/admin/invoices/[id]/mark-paid`, and the Job screen's approved checklist
> in `components/admin/JobActionPanel.tsx`. If it survives, fix it at the root —
> one place that decides what "paid" means, consumed everywhere — and add the unit
> test that would have caught it. If it does not, append a dated correction to
> `INVOICE_AUDIT.md` saying so with the evidence, and change no code. Either way
> this touches real billing display: do not alter how an invoice total is computed
> or copied (rule #21 — the invoice copies the quote and recomputes nothing), and
> do not add a second place that derives payment state.

---

# 5. TIER 3 — DECISION REQUIRED BEFORE ANY BUILD

**None of these may be queued for an unattended run until Reid answers.** Each
is stated as the single question that unblocks it.

## Q-15 · The orphaned production queue — 2 red tests, 3 dead components

**Size M · Risk: none · Decision required**

> **THE QUESTION.** `/admin/orders` was rebuilt in v7 Phase 2 as the office list.
> `ProductionQueueTable.tsx`, `ProductionQueueRealtime.tsx` and
> `QuickAdvanceButton.tsx` are now reachable from nothing, and
> `tests/e2e/production-queue.spec.ts` (4 tests, 2 currently failing) still points
> at them. Is Shop View (`/admin/shop-view`) now the whole answer for the shop —
> in which case the three components and that spec should be **deleted** — or does
> the office still need a fabrication-stage queue, in which case it needs a new
> URL and a nav entry?

**If "delete":** size S. Remove the three components, delete
`tests/e2e/production-queue.spec.ts`, retarget any surviving assertions at
`tests/e2e/shop-deliveries.spec.ts`, correct the now-misleading comment at
`app/admin/orders/page.tsx:24`, and update `SPEC_PRODUCTION_QUEUE`'s header to
record that Shop View supersedes it.

**If "restore":** size M. New route (`/admin/production-queue`), nav entry in
`lib/data/admin-nav.ts`, v7 markup (rule #33) and the pixel gate, and the four
tests repointed. Note it would then be the **fourth** orders-shaped admin view
alongside `/admin/orders`, `/admin/orders-crm` and `/admin/shop-view`, and
Q-15's answer should settle `/admin/orders-crm`'s fate at the same time.

## Q-16 · FlashDraft modified-profile `revision` semantics

**Size S · Risk: none · Decision required**

> **THE QUESTION.** When a locked profile at revision 4 is opened with
> `?modifyProfile=`, the banner says "rev 5" (`app/studio/draft/page.tsx:3470`)
> and the saved row records `revision: 1` (`:2835`, because `loadForModify`
> deliberately nulls `savedProfileId` so the first save cannot overwrite the
> locked original). Does `revision` count **lineage depth** — how many
> modifications deep this profile is from its root — or **this row's own edit
> count**?

Whichever is chosen, the fix is small and fully testable: make the banner and the
written value agree, and update `tests/e2e/modify-in-flashdraft.spec.ts:179`'s
expectation to match the decision. **Do not let a run guess** — guessing writes a
wrong number onto a saved profile that the shop may later read.

## Q-17 · Hero secondary CTA target

**Size S · Risk: none · Decision required**

> **THE QUESTION.** `tests/e2e/homepage.spec.ts:238` expects the hero's "View Our
> Work" to point at `/about/services`; `app/components/hero/HeroSection.tsx:83`
> points it at `/design-studio`. Which is right — and does `/design-studio`
> survive at all? `SITEMAP.md`'s own protection matrix calls it "a second,
> un-reconciled 'Design Studio' destination alongside `/studio`".

Fixing only the test would cement a duplication the sitemap already flags.
Bundle this with the `/studio` vs `/design-studio` reconciliation; the pair is
one S-sized run once decided.

## Q-18 · "Photo to Quote" is a false door

**Size S (repoint) or L (build it) · Risk: none · Decision required**

> **THE QUESTION.** `/studio`'s "Photo to Quote" tab promises "Photograph
> existing flashing in the field. AI identifies profile type and material", with
> a CTA reading "Upload Photos" — and its `ctaHref` is `/upload`, byte-identical
> to the "Scan to Quote" tab above it. `app/upload/page.tsx` has **no photo
> mode**. Meanwhile the real mobile photo intake is `/field/contractor`, and
> `STATE_OF_THE_BUILD.md` (2026-10-03) records that field submissions carry
> `line_items: []` by design and that zero `field_photo_quote` rows exist. Should
> the tab point at `/field/contractor`, should `/upload` gain a genuine
> `?mode=photo` branch per `SPEC_PHOTO_TO_QUOTE_AI`, or should the tab be removed
> until one of those is true?

This question is the same one the 2026-10-03 entry raised as the "field-app gap"
and left PENDING REID: a field photograph carries nothing a machine can bend, and
closing that gap means either the field app gains a drawing step or an AI takeoff
pass writes `takeoff_uploads.result_items`. **Answer the field-app gap and this
tab's fate together** — they are one decision wearing two hats.

## Q-19 · Stage C — invoice at shop-finish + reconciliation

**Size L · Risk `$` `@` `DB` · Decision required · POOR overnight candidate even
once decided**

> **THE QUESTION.** v7 creates the invoice at **shop-finish** with a
> reconciliation (estimate vs final vs difference) to the office;
> `app/api/quote-approve/[token]/route.ts:210` creates it at **customer
> approval**. Move billing to shop-finish, or keep it where it is and add only the
> reconciliation?

**Why it is a poor unattended candidate regardless.** It is a live-money
migration that must be consistent for jobs already approved under the old
behaviour. `STATE_OF_THE_BUILD.md:16908` already declined to start it for exactly
this reason: "Starting it without finishing it would leave the billing path
half-moved, and the standing instruction is that the app stays usable at every
commit." If it is queued, it should be **supervised**, and split so that the
reconciliation (additive, no behaviour moved) ships first and alone.

## Q-20 · Stage F part 1 — change orders before the machine

**Size L · Risk `$` `@` `DB` `MACHINE` · Decision required**

> **THE QUESTION.** v7 re-quotes, emails a **revised quote v2** with a new
> Approve link, **voids the earlier approval**, and returns the job to Quoted. The
> void is the problem: `CLAUDE.md` rule #14's guard reads a database-verified
> approval before anything reaches PathfinderEdge catalog 20115, which feeds the
> physical Thalmann. What are the exact void semantics, and what must happen to a
> job whose approval the guard has **already** read?

**The highest-risk item in the entire backlog.** It needs `quotes.revision`,
supersede/void semantics and a new route — and it touches the one path in this
codebase where a mistake produces metal. The v7 gap audit flags it as
highest-risk too. It should be supervised, and the static single-door test must
be left untouched and passing throughout.

## Q-21 · Stage F part 2 — addenda after the job started

**Size L · Risk `$` `@` `DB` · Decision required · Depends on Q-20**

> **THE QUESTION.** v7 adds an addendum "A1" to the same job: the customer
> approves it, the shop sees a note reading "do not run it yet", it becomes its
> own invoice line, and it feeds the reconciliation. Is an addendum a row in a new
> `addenda` table, or a typed row in a `quote_revisions` table shared with Q-20's
> change orders? And where does the shop's "do not run it yet" flag live —
> `shop_profile_library`, the shop queue, or the Job?

Only the fixture types exist today (`lib/fixtures/command-center-v7.ts:218`,
`V7Addendum`). Sequence this strictly after Q-20; sharing a revision table is
likely the right answer and cannot be chosen independently.

---

# 6. TIER 4 — BLOCKED. DO NOT QUEUE.

Each entry names the single thing that must arrive, so the item can be promoted
the moment it does.

| # | Item | Blocked on | Promotes to |
|---|---|---|---|
| Q-22 | **TaxJar** (`SPEC_TAXJAR_INTEGRATION`) — nothing exists but an env-presence card on `/admin/settings`; `lib/invoices/create.ts:123` hardcodes `tax_cents: 0` | **Tax nexus states** (checklist #31) **and** `TAXJAR_API_KEY`. Both. | Tier 2, size M, risk `$` |
| Q-23 | **Stripe ACH** — `create-intent/route.ts:136` passes no `payment_method_types`; `CLAUDE.md`'s stack line claims ACH | Reid confirming ACH is wanted, **and** the Stripe account having `us_bank_account` enabled | Tier 3 then Tier 2, size M, risk `$` |
| Q-24 | **Google Maps key** — `components/track/DeliveryTrackingMap.tsx:361` carries a live `TODO` about the missing env var, in a file with five consumers | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` present in the deployment | Tier 1, size S |
| Q-25 | **Product catalog content** — `/products` renders 734 lines of static fixtures in `lib/data/catalog.ts`; the rebuilt manifest lives on branches `products-manifest` / `products-page`, not on main | Reid: the 26 flagged manifest entries, the two category-vocabulary questions (Roofing Panels vs Standing Seam; whether Trim & Closures exists), and the fact that there is still no product copy at all | Tier 3 then a supervised run, size L |
| Q-26 | **Auto material calculator §2.2 / §2.3** — accessories and stock length; the module's own header says so | Accessory and stock-length product data (checklist #12–21) | Tier 2, size M |
| Q-27 | **Finish palette · CAD/BIM library · material spec sheets · installation guides** — all four pages are built, correct, and render empty states | Client content: finish codes (#14, #62), CAD files (#60–61), data sheets and ASTM refs (#58–59), guides and photography (#57, #9, #10). **Note:** real colour data already exists in `lib/data/metal-colors.ts` from the McElroy and PAC-CLAD PDFs — if Reid accepts those names as the finish library, Q-27's finish half promotes to Tier 1, size S, immediately | Tier 1, size S each (data entry, not code) |
| Q-28 | **Privacy Policy** — `app/(public)/legal/privacy/page.tsx` renders "Privacy Policy coming soon"; `CLAUDE.md` and `SITEMAP.md` both mark it a **LAUNCH BLOCKER** | Legal text (#65). **An agent must not draft this.** | Tier 1, size S |
| Q-29 | **Workbench Outlook rail + mail parser** — the one Microsoft-dependent feature; no Graph code exists | Microsoft 365 admin consent / tenant separation. `pricing_ledger` is already prepared for it: `source='mail_parser'` with `uq_pricing_ledger_external_ref` for idempotency | Tier 3, size L |

---

# 7. A SUGGESTED FIRST QUEUE

Six prompts, ordered so that nothing depends on a decision and each ends on a
gate that can be proven without a human. Total: roughly one long night.

| Order | Item | Size | Why here |
|---|---|---|---|
| 1 | **Q-01** Regenerate `SITEMAP.md` | S | Cheapest, highest leverage, zero blast radius. Makes every later run read a true map. |
| 2 | **Q-03** Complete `UNLINKED_ADMIN_ROUTES` | S | Same character; same file neighbourhood as Q-01's protection matrix. |
| 3 | **Q-08** Gate `/studio/hem-debug` | S | Small, precedented, closes a live exposure. |
| 4 | **Q-02** Team-invitation email | S/M | First behavioural change. Fixes a flow that cannot complete today. Must precede Q-07 so the template is written once. |
| 5 | **Q-05** Estimate copy to the office | S/M | The business is currently missing information it should have. Small, and the plumbing all exists. |
| 6 | **Q-04** AI Order Validator | M | The largest truly-unblocked gap. Mostly pure functions, so mostly unit-testable. Put it last: if the night runs short, it is the one that can be halved cleanly along its own module boundary. |

**Deliberately not in the first queue:** Q-06 (credit application) and Q-07
(template library) are both good and both M/L — they belong in the *second*
queue, once the first has proven the run shape. Q-13 (`.gitattributes`) must be
its own run with its own commit, for the renormalisation reason above.

**Every prompt in any queue must carry, verbatim, the standing constraints this
repository already enforces:** `pnpm` only · `pnpm tsc --noEmit` exits 0 · no
`middleware.ts` change · no deploy, no merge, no production migration · migration
**files** only, next free number after 038, SQL and down-migration printed in the
report · no customer-facing price before the formal quote · `afs-*` tokens only
(or v7's own classes on a Command Center screen, rule #33) · TypeScript strict,
zero `any` · RLS on every new table plus a cross-company data-leak test · nothing
added to the PathfinderEdge single-door allow-list and
`lib/integrations/pathfinder-single-door.test.ts` left untouched · the office
address read from `officeInvoiceEmail()` and spelled `trica@` · governance
appended, never rewritten · the item marked **UNVERIFIED** until Reid has looked
at it in a browser.

---

# 8. SELF-AUDIT

Performed as a second pass against this document, not against the registry.

**Defects found in the first draft and corrected:**

1. The first draft ranked Stage C second, on business value. That is the wrong
   ranking function for the question asked — it is a live-money migration with
   nobody awake. Re-ranked to Tier 3 with the reasoning stated, and the ranking
   function written out in §1 so the ordering can be argued with rather than
   taken on trust.
2. The first draft put `.gitattributes` in Tier 1 as a trivial fix. Adding it
   renormalises the whole repository; that belongs in its own run, and the
   skeleton now says so explicitly.
3. The first draft's Q-03 proposed deleting `/admin/orders-crm`. That pre-empts
   Q-15's decision. Narrowed to the documentation half, which is genuinely
   decision-free, with the boundary stated in the entry.
4. The first draft asserted Q-27's finish-palette half was wholly blocked.
   `lib/data/metal-colors.ts` already holds real colour names from the two
   source PDFs, which makes it a **question for Reid rather than a hard
   blocker** — corrected in the Tier 4 table.
5. Several prompt skeletons initially said "add tests". Each now names the test
   classes, the specific boundaries, and the acceptance threshold, because
   "add tests" is exactly the unverifiable instruction LAW 5 prohibits.

| Dimension | Max | Score | Reasoning |
|---|---|---|---|
| Technical correctness | 15 | 15 | Every candidate traces to a classification evidenced in the companion document; every risk flag maps to a real code path. |
| Completeness | 15 | 15 | All 14 MISSING/PARTIAL specs, all 9 findings, all 5 failing tests, all Command Center gaps — 29 candidates, none dropped. |
| Repository grounding | 10 | 10 | Every skeleton names the real module, rule number and test file the work must reuse or leave alone. |
| Architectural consistency | 10 | 10 | Each skeleton restates the `CLAUDE.md` rules that constrain *that* item specifically, rather than a generic preamble. |
| Requirement clarity | 10 | 10 | Size, five risk flags, two independent blockers and the decision gate are given per item on a single stated scale. |
| Acceptance-test quality | 10 | 9 | Each skeleton names its acceptance, but a skeleton is by design not a full AC matrix — the implementing EES must still write one. Marked down honestly rather than claimed. |
| Edge-case / failure coverage | 10 | 10 | The renormalisation hazard, the Q-20 single-door interaction, the Q-14 possible no-op and the Q-10 "empty CMS is the correct outcome" caveat are all stated rather than discovered later. |
| Security / data integrity | 5 | 5 | Every `A`/`DB` item carries an explicit RLS + data-leak-test requirement; every `MACHINE` item carries the rule #14 constraint; no item proposes touching `middleware.ts`. |
| Implementation executability | 10 | 10 | Tier 1 is executable tonight with no further input; Tier 3 states the single blocking question per item; Tier 4 states the single artefact that promotes each. |
| Reviewability / evidence quality | 5 | 5 | The ranking function is written out and falsifiable; every claim defers to a cited section of the companion document rather than restating it. |
| **Total** | **100** | **99** | |

**Critical defects remaining:** none. No item is proposed whose requirements are
materially ambiguous, no destructive migration is proposed without its
down-migration, no decision is made on Reid's behalf, and the first queue is
executable without further input.

**Self-Audit Status: PASS (99/100, minimum 95).**

---

# 9. PHASE COMPLETION REPORT (Canonical Laws, Part XI)

**Identifier:** EES-OVN.01 — item `01-audit`.

**Documents generated:**

| Document | Word count |
|---|---|
| `AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md` | 10530 |
| `AUDIT-OVERNIGHT-QUEUE-PROPOSAL.md` | 8349 |

**Proficiency score:** 99/100 (registry) and 99/100 (queue proposal); minimum 95.

**Unresolved issues:** 8, listed as U-01…U-08 in the companion document §9.1.
The materially blocking ones are U-01 (the live database was not reachable from
this session, so every seed-data judgement rests on migration files) and U-05
through U-07 (three product decisions that gate three of the five red tests).

**Discrepancies:** 14, listed in the companion document §8. Two are High
severity: `SITEMAP.md`'s counts are wrong by 96 files, and it documents seven
routes that do not exist — including two PathfinderEdge push endpoints that were
deliberately deleted to establish the single-door rule.

**Required decisions:** 7, Q-15 through Q-21, each stated as a single question.
Three of them (Q-15, Q-16, Q-17) each gate one or two of the five failing
Playwright tests, so **the red suite cannot be made green without Reid**.

**Sequencing:** valid. Tier 1 has no internal dependencies except Q-02 before
Q-07. Tier 2's Q-12 is independent. Tier 3's Q-21 depends on Q-20. Tier 4 is
gated externally.

**Readiness:** **READY.** The suggested first queue (§7) is six prompts, none of
which requires a decision, an external key, or data that has not arrived.

---

## ENGINEERING COMPLETION RECORD

Prompt ID: EES-OVN.01
Prompt Name: Overnight Registry-versus-Code Audit — Queue Proposal
Word Count: 8349
Engineering Proficiency Score: 99/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES

---

*AUDIT-OVERNIGHT-QUEUE-PROPOSAL.md | AFS — Architectural Flashing Supply |
item 01-audit | branch `ovn/01-audit` @ `75118cb` | 2026-10-03 | READ-ONLY —
this document proposes work and performs none.*
