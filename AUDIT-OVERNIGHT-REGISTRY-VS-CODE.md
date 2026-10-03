# AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md
## AFS — Definitive Registry-versus-Code Matrix

**Item:** `01-audit` · **Prompt ID:** `EES-OVN.01` · **Date:** 2026-10-03
**Branch:** `ovn/01-audit` · **HEAD:** `75118cb`
**Worktree:** `C:\Users\manag\Documents\afs-website-ovn-01-audit`
**Mode:** READ-ONLY. No application source file, migration, test, configuration
file or governance file was created, modified or deleted by this run. The only
files this run adds are this document and
`AUDIT-OVERNIGHT-QUEUE-PROPOSAL.md`.

---

# 0. EES-OVN.01 — ENGINEERING EXECUTION SPECIFICATION

The Canonical Laws (Part V/VII) require an EES before work begins, and the item
brief restricts output to exactly two documents. The EES is therefore embedded
here as section 0 rather than written to a third file.

## 0.1 Identity

**Prompt ID:** EES-OVN.01
**Prompt Name:** Overnight Registry-versus-Code Audit and Queue Proposal

## 0.2 Objective

Produce an evidence-backed classification of every specification document and
every route in the project's registry against the code that actually exists in
this worktree, so that a subsequent unattended build run can be planned from
measured fact rather than from the governance narrative. Classification
vocabulary is fixed by the brief: **BUILT / PARTIAL / MISSING /
BLOCKED-ON-DATA / BLOCKED-ON-KEYS / DEFERRED-BY-DECISION**.

Three named sub-deliverables are required in addition to the matrix:

1. The Command Center items the brief lists as still unbuilt — invoices
   table/checklist, Stage C, Stage F, the mail parser, and delivery-scheduling
   columns — each confirmed or refuted against code.
2. The five known failing Playwright tests, located, with a stated likely cause
   for each.
3. Every specification whose status in `STATE_OF_THE_BUILD.md` (or the wider
   governance stack) contradicts the code.

## 0.3 Engineering Context

AFS is a Next.js 14 App Router / TypeScript strict / Supabase / pnpm RFQ
platform. Governance is unusually heavy and unusually honest: `CLAUDE.md`
carries 34 numbered enforcement rules, several of which are backed by static
tests (`lib/integrations/pathfinder-single-door.test.ts`,
`lib/data/rush-explicit-only.test.ts`,
`lib/data/removed-machine-library.test.ts`) and two of which are backed by build
gates (`scripts/audit/contrast-check.mjs` as `prebuild`,
`tests/visual/v7-pixel-gate.spec.ts`). `STATE_OF_THE_BUILD.md` is 17,079 lines
of dated, append-only session narrative; `SESSION_STATE.md` is 9,957.

The relevant consequence for this audit is that **the governance stack is large
enough that parts of it have gone stale while other parts stayed current**, and
the brief's own premise list turns out to contain three items that the code
contradicts (section 6). Source-of-truth precedence was applied as the Canonical
Laws specify: the functioning repository implementation first, migrations
second, documentation far below both.

## 0.4 Required Repository Inspection — what was actually inspected

| Artefact | How inspected | Result used in |
|---|---|---|
| `CLAUDE.md` (1,311 lines) | read in full as session context | §5, §6, §8 |
| `STATE_OF_THE_BUILD.md` (17,079 lines) | heading outline + the 2026-10-03, 2026-10-02 (x3), 2026-10-01 (x2) and v2-01…v2-06 entries read in full | §6, §7, §8 |
| `SESSION_STATE.md` (9,957 lines) | heading grep for Stage A–G | §6 |
| `SITEMAP.md` (349 lines) | read in full | §5 |
| `SCHEMA.md` (2,936 lines) | heading outline, TABLE list | §4, §6 |
| `BLUEPRINT.md`, `ARCHITECTURE.md`, `COMPONENT_MAP.md`, `PRD.md` | located and sized; consulted by targeted grep | §4 |
| `docs/COMMAND_CENTER_V2_SPEC.md` | §3 prototype-to-code map and §4 phase plan read in full | §6, §8 |
| `docs/COMMAND_CENTER_V7_GAP_AUDIT.md` (32,092 bytes) | read in full | §6 |
| 56 `SPEC_*.md` files (54 distinct) | every file's header block read; targeted deep reads where classification was not obvious | §4 |
| `app/` | `find` enumeration — 88 `page.tsx`, 119 `route.ts` | §4, §5 |
| `lib/` | `find` enumeration — 152 non-test modules | §4 |
| `components/` | `find` enumeration — 167 `.tsx` | §4 |
| `supabase/migrations/` | 38 files; table and RLS extraction by grep | §4, §6 |
| `middleware.ts` | read (not modified) | §5 |
| `package.json` | read — scripts and dependency versions | §2 |
| `playwright.config.ts` | read — `baseURL` resolution | §7 |
| 31 Vitest files / 23 Playwright files | enumerated; the 3 failing specs read in full | §7 |
| Live Supabase database | **NOT inspected — see §9.1** | §9 |

## 0.5 Preconditions

- Worktree clean at `75118cb` on `ovn/01-audit` (`git status` empty at start).
- `pnpm` 10.33.0, Node v20.20.2, TypeScript 5.x, Next 14.2.5.
- No dev server may be started; no production deploy; no migration applied; no
  real third-party call; no secret read or printed.

## 0.6 Scope

**In scope:** reading the repository; running `pnpm tsc --noEmit` and
`pnpm test:unit` to establish a baseline; static analysis of the five failing
Playwright specs; authoring two Markdown documents at the project root.

**Out of scope (Non-Goals, S37):** fixing anything found; writing migration
files; updating `SITEMAP.md` or any governance document; running the full
Playwright suite; starting the dev server; querying the live database; ranking
by business value rather than by buildability (the queue proposal ranks by
overnight-build suitability, which is what the brief asked for).

## 0.7 Invariants (S38)

- No file under `app/`, `lib/`, `components/`, `supabase/`, `tests/`,
  `scripts/`, `docs/` is created, modified or deleted.
- `middleware.ts` is untouched.
- Command Center v7 assets and pixel-gate baselines are untouched.
- Test counts reported are measured, never estimated.
- No claim is made about live-database contents, because the live database was
  not reachable from this session (§9.1).

## 0.8 Requirements

| ID | Requirement |
|---|---|
| R-01 | Every `SPEC_*.md` in the repository is located and classified with file-path, route-path or table-name evidence. |
| R-02 | Every route named in `SITEMAP.md` is verified to exist or not exist on the filesystem. |
| R-03 | Every route that exists but is absent from `SITEMAP.md` is listed. |
| R-04 | The five named Command Center items are each confirmed or refuted against code. |
| R-05 | The five failing Playwright tests are located by file and line, with a stated likely cause derived from reading both the test and the implementation. |
| R-06 | Every governance-vs-code contradiction found is recorded with both sides quoted or cited. |
| R-07 | A measured baseline (`tsc`, `test:unit`) is recorded, including any pre-existing failure. |
| R-08 | Every uncertainty is listed as UNRESOLVED rather than resolved by assumption. |

## 0.9 Constraints

Do not infer a feature exists because a spec, a component file, a table or a
governance paragraph mentions it. A component that no page imports is not a
built feature; a table with no rows and no writer is not built data; a status
line in `STATE_OF_THE_BUILD.md` is evidence of what a past session believed, not
of what the code does now.

## 0.10 Acceptance Criteria

| ID | Criterion | Verification | Expected result |
|---|---|---|---|
| AC-01 | All `SPEC_*.md` files located | `find . -name 'SPEC_*.md'` | 56 files, 54 distinct specs (2 duplicates) |
| AC-02 | Every distinct spec appears exactly once in §4 | row count of §4 | 54 rows |
| AC-03 | Every §4 row carries at least one concrete artefact path | inspection | no row with empty Evidence |
| AC-04 | Every SITEMAP-named route checked against the filesystem | §5.1, §5.2 | explicit EXISTS/ABSENT per route |
| AC-05 | Page/route counts measured, not quoted | `find \| wc -l` | 88 pages, 119 route handlers |
| AC-06 | Five Command Center items each answered | §6 | 5 verdicts with evidence |
| AC-07 | Five failing Playwright tests located with a cause | §7 | 5 rows, file:line, cause, confidence tag |
| AC-08 | Baseline measured in this session | §2 | `tsc` 0; vitest 484 pass / 1 fail, named |
| AC-09 | Contradictions recorded with both sides | §8 | >= 1 row per contradiction, both sides cited |
| AC-10 | Unresolved items listed, not resolved by guess | §9 | explicit UNRESOLVED list |
| AC-11 | No source change | `git status --short` limited to the two new docs | clean apart from deliverables |

## 0.11 Validation (mapped to acceptance criteria)

| AC | Command / method | Recorded in |
|---|---|---|
| AC-01, AC-02 | `find . -name 'SPEC_*.md'` | §4.0, §4.1 |
| AC-03 | manual inspection of §4.1 | §4.1 |
| AC-04 | per-path existence loop | §5.2 |
| AC-05 | `find app -name page.tsx \| wc -l`, `find app -name route.ts \| wc -l` | §5.1 |
| AC-06 | targeted grep + file reads | §6 |
| AC-07 | reading each spec and its implementation | §7 |
| AC-08 | `pnpm tsc --noEmit`; `pnpm test:unit` | §2 |
| AC-09 | document-vs-code diffing | §8 |
| AC-10 | — | §9 |
| AC-11 | `git status --short` | §10 |

## 0.12 Required Tests

**Not Applicable as new tests.** This item ships no code, so there is nothing
new to cover. The test classes exercised are: *baseline regression* (the
existing Vitest suite, run unmodified) and *static analysis* (reading the five
failing Playwright specs against their implementations). Running the Playwright
suite was considered and rejected — see §7.1 for why it was impossible under
this run's constraints, which is a finding in itself.

## 0.13 Completion Evidence

See §10.

## 0.14 Self-Audit

See §11.

---

# 1. METHOD AND EVIDENCE RULES

**Classification vocabulary** (the brief's six values, defined here so two
reviewers would classify the same way):

| Value | Means |
|---|---|
| **BUILT** | The spec's primary user-visible function exists end to end: a route or component that something actually mounts, a server path, persistence where persistence is specified. Minor sub-clauses may be open; those are named in the Gap column. |
| **PARTIAL** | A material, named part of the spec has no code. The split is stated per row. |
| **MISSING** | No implementing code exists. Grep for the spec's own vocabulary returns nothing outside documentation and fixtures. |
| **BLOCKED-ON-DATA** | The code path exists and is correct; it renders an empty state or a placeholder because client-supplied content (catalog copy, finish codes, CAD files, stage names, stock levels, nexus states, rates) has not been received. Mapped to `CLAUDE.md`'s DATA BLOCKERS table. |
| **BLOCKED-ON-KEYS** | The code path exists and is correct; it degrades honestly because a third-party credential is not configured in the environment. |
| **DEFERRED-BY-DECISION** | A recorded human decision says this is not to be built, or not to be built yet. The decision is cited. |

A row may carry a primary value plus a qualifier (e.g. **BUILT /
BLOCKED-ON-DATA**) where the mechanism is complete and only the content is
absent. That combination is common here and is the honest reading of a platform
built deliberately ahead of its data.

**Evidence rule.** Every non-MISSING classification cites at least one real
path. Every MISSING classification cites the negative search that was run.

**Confidence tags.** `[Certain]` = verified by reading the artefact in this
session. `[Likely]` = consistent with everything read, not directly verified.
`[Guessing]` = a contract that may not match reality. No `[Guessing]` claim is
used as the basis of a classification.

---

# 2. BASELINE, MEASURED IN THIS SESSION (S36)

| Gate | Command | Result |
|---|---|---|
| Working tree | `git status --short` | clean at start |
| Type check | `pnpm tsc --noEmit` | **exit 0, zero errors** |
| Unit suite | `pnpm test:unit` | **484 passed, 1 FAILED, across 31 files (485 tests)** |
| Build | `pnpm build` | **not run** — `prebuild` regenerates `app/styles/command-center-v7.generated.css`, which writes into the worktree. A read-only audit must not mutate a tracked file. |
| Lint | `pnpm lint` | **not run** — this repository has no ESLint configuration, so `next lint` prompts interactively. Pre-existing; recorded in `STATE_OF_THE_BUILD.md`'s 2026-10-03 entry. |
| Playwright | `pnpm test:e2e` | **not run** — see §7.1 |

## 2.1 The one failing unit test, diagnosed

```
FAIL  lib/design/v7-css.test.ts > the generated Command Center stylesheet
      > is exactly what the transform produces right now
AssertionError: app/styles/command-center-v7.generated.css is stale.
                Run `pnpm css:v7`.
Test Files  1 failed | 30 passed (31)
     Tests  1 failed | 484 passed (485)
```

**This is not a stale stylesheet. It is a line-ending artefact of a Windows
checkout, and it is reproducible on any clean clone on this machine.** Proven,
not inferred:

```
$ git config core.autocrlf
true
$ git ls-files --eol app/styles/command-center-v7.generated.css
i/lf    w/crlf    attr/    app/styles/command-center-v7.generated.css
$ node -e "...buildScopedCss() vs file on disk..."
byte-equal: false
equal after CRLF->LF normalisation: true
```

The index stores LF. `core.autocrlf=true` checks the file out as CRLF.
`buildScopedCss()` concatenates CRLF content read from the equally-CRLF-checked-out
prototype and deviation files with its own LF-joined output, producing a
mixed-ending string that cannot byte-match the uniformly-CRLF file on disk. The
test's comparison is `.toBe()` — byte-exact by design, and correctly so, because
its whole purpose is to catch a stale generated file.

**There is no `.gitattributes` in this repository** (verified absent). Nothing
pins these files to LF.

**Why prior runs reported 485/485 and this run reports 484/485.** `prebuild`
runs `scope-v7-css.mjs`, which rewrites the generated file with LF endings. Any
session that ran `pnpm build` before `pnpm test:unit` left the file LF-normalised
and the test passed — at the cost of a working tree that `git status` would show
as modified. This worktree has never been built, so the file is still as checked
out, and the test fails. **Both observations are correct; the repository is
simply not portable to a Windows checkout without a prior build.**

Logged as finding **F-01** (§9.2) and as queue candidate **Q-14**.

---

# 3. WHAT THE CODEBASE ACTUALLY CONTAINS (measured)

| Measure | Count | How |
|---|---|---|
| `page.tsx` files | **88** | `find app -name page.tsx \| wc -l` |
| `route.ts` files | **119** | `find app -name route.ts \| wc -l` |
| Total route-producing files | **207** | sum |
| `lib/` modules (non-test) | 152 | `find lib -name '*.ts' -not -name '*.test.ts'` |
| `components/` files | 167 | `find components -name '*.tsx'` |
| Migration files | 38 | `ls supabase/migrations` |
| Tables created across all migrations | 67 | `CREATE TABLE` extraction |
| Tables dropped (migration 031) | 3 | `machine_profiles`, `machine_profile_bends`, `machine_profile_categories` |
| Tables with `ENABLE ROW LEVEL SECURITY` | **67 of 67 — complete** | regex over all migrations |
| Vitest files / tests | 31 / 485 | measured run |
| Playwright spec files | 23 (21 `tests/e2e`, 2 `tests/visual`) | `find tests` |
| Distinct `SPEC_*.md` | 54 (56 files, 2 duplicates) | `find . -name 'SPEC_*.md'` |

**RLS is universal.** An initial pass appeared to show six tables from migration
035 without RLS; that was a whitespace defect in the extraction regex (the
migration aligns `ALTER TABLE … ENABLE ROW LEVEL SECURITY` with multiple
spaces). Re-run with flexible whitespace, the set of tables lacking RLS is
**empty**. Corrected here rather than carried forward. `[Certain]`

---

# 4. SPEC REGISTRY — ALL 54 SPECIFICATIONS

## 4.0 Where the specs actually are

`CLAUDE.md` lists ~52 spec documents by bare filename and gives no directory.
They are **not at the project root**. 54 live in `specs/`; 2 live at the root
and are absent from `CLAUDE.md`'s reading list entirely:

- `SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md` (root)
- `SPEC_HAILVIEW.md` (root)

`specs/` also contains two byte-duplicate copies of one spec —
`SPEC_PRICING_ADMIN (1).md` and `SPEC_PRICING_ADMIN (2).md`, both 223 lines,
alongside a **different and shorter** `SPEC_PRICING_ADMIN.md` (126 lines). The
126-line file is the one `CLAUDE.md` names. The two 223-line copies are a
later revision that was never promoted over it, so the canonical pricing-admin
spec is ambiguous. Logged as **F-02** (§9.2).

## 4.1 The matrix

Phase column is the spec's own declared phase.

| # | Spec | Ph | Classification | Evidence (paths verified in this session) | Gap / note |
|---|---|---|---|---|---|
| 1 | `SPEC_ADMIN_PORTAL` | 6 | **BUILT** | 25 pages under `app/admin/**`; `lib/admin/auth.ts` `requireAdminUser`; `middleware.ts` admin gate; `lib/data/admin-nav.ts` | Ported to v7 (rule #33). Three overlapping order views coexist — §9.2 F-05 |
| 2 | `SPEC_AI_CHATBOT` | 7 | **BUILT** | `components/ai/ChatWidget.tsx` mounted by `components/layout/AppChrome.tsx`; `app/api/chat/route.ts` (`model: 'claude-sonnet-4-6'`, streaming); `lib/chatbot/knowledge/*` (10 modules); `chat_conversations` table | Server-side only, rule #5 satisfied |
| 3 | `SPEC_AI_CROSS_SELL` | 7 | **BUILT** | `components/ai/CrossSellPanel.tsx` mounted in `app/quote/page.tsx`; `app/api/recommendations/cross-sell/route.ts` | — |
| 4 | `SPEC_AI_INSTALLATION_ADVISOR` | 7 | **BUILT / BLOCKED-ON-DATA** | `components/ai/AIInstallationAdvisor.tsx` mounted in `app/(public)/architects/guides/[profileSlug]/page.tsx`; `app/api/architects/installation-advisor/route.ts` | Sits below guide content that is itself unpublished (row 22) |
| 5 | `SPEC_AI_MATERIAL_RECOMMENDATIONS` | 7 | **BUILT** (wizard) / **DEFERRED-BY-DECISION** (configurator half) | `components/quote/MaterialRecommendationPanel.tsx` in `app/quote/page.tsx`; `app/api/recommendations/material/route.ts` | The spec's "and Configurator" clause died with the Configurator (row 24) |
| 6 | `SPEC_AI_ORDER_VALIDATOR` | 2 | **MISSING** | Negative: no `validateOrder`, no `order-validator`, no validation route. The only `validator` hits in `app/` + `lib/` are `app/studio/draft/page.tsx` and `lib/integrations/pathfinder-response.ts`, neither related | Nothing exists. The largest fully-unbuilt Phase-2 spec |
| 7 | `SPEC_AI_PRODUCT_FINDER` | 7 | **BUILT** | `components/ai/AIProductFinder.tsx` mounted via `components/product/ProductSearchTabs.tsx` on `/products`; `app/api/products/ai-search/route.ts` | Searches static catalog fixtures (row 40) |
| 8 | `SPEC_AI_SPEC_WRITER` | 5 | **BUILT / BLOCKED-ON-DATA** | `components/architects/SpecWriterWizard.tsx` on `/architects/spec-writer`; `app/api/spec/route.ts`, `spec/save`, `spec/[id]/docx` (DOCX via `docx@9.7.1`); `saved_specifications`, `spec_templates`; `lib/anthropic/spec.ts` | Spec's own header declares blocked on checklist #68–72 |
| 9 | `SPEC_ARCHITECTURAL_RESOURCE_CENTER` | 5 | **PARTIAL** | Route built: `app/(public)/architects/guides/page.tsx` with four category tabs and an `EmptyState` | **The CMS does not exist.** Articles are `const ARTICLES: Record<Category, never[]>` — hardcoded empty arrays. No table, no admin authoring UI, no API. The spec's defining claim ("CMS-driven. AFS staff can add content without code deployment") is unimplemented |
| 10 | `SPEC_ARCHITECT_PORTAL` | 5 | **BUILT** | `app/(public)/architects/page.tsx`; `components/layout/ArchitectShell.tsx` (copper accent); all seven child routes present | — |
| 11 | `SPEC_AUTH` | 3 | **BUILT** | `/login` (password **and** magic link — `signInWithOtp`, `app/(auth)/login/page.tsx:88`), `/register`, `/register/confirm`, `/forgot-password`, `/forgot-password/sent`, `/reset-password`, `/invite/[token]`, `app/auth/callback/route.ts`, `app/api/auth/register/route.ts`; `middleware.ts` role gate via a service-role lookup with fail-closed handling | — |
| 12 | `SPEC_AUTO_MATERIAL_CALCULATOR` | 2 | **PARTIAL / BLOCKED-ON-DATA** | `lib/utils/material-calc.ts` (§2.1 waste factor, 40 lines); `components/quote/WasteFactorDisplay.tsx` in `app/quote/page.tsx` | §2.2 accessories and §2.3 stock-length are unbuilt; the module's own header says so. `AutoMaterialCalculator.tsx`, named in `COMPONENT_MAP.md`, **does not exist** (zero matches) |
| 13 | `SPEC_CAD_BIM_LIBRARY` | 5 | **BLOCKED-ON-DATA** | `components/architects/CADLibraryBrowser.tsx` on `/architects/cad-library`; `cad_library_files` + `cad_download_log` (migration 001:789–815); `app/api/documents/download/route.ts` logs downloads | **Zero seed rows and no upload path**: no `INSERT INTO cad_library_files` in any migration, and no admin route or component writes the table. Content is checklist #60–61 |
| 14 | `SPEC_CHECKOUT` | 3 | **BUILT** | `app/checkout/page.tsx`; `app/api/checkout/create-intent/route.ts`, `confirm-order`; `app/api/webhooks/stripe/route.ts`; card and `net_terms` payment methods | First customer-visible price is the formal quote — RFQ model intact |
| 15 | `SPEC_CUSTOMER_MANAGEMENT` | 6 | **BUILT** | `app/admin/customers/page.tsx`, `[id]/page.tsx`; `lib/data/customers.ts`; `components/admin/CustomerDetailDrawer.tsx`, `CustomerNotesLog.tsx`, `ExportCustomersCsvButton.tsx`; `app/api/admin/customers/[id]/route.ts` | Rebuilt as a v7 master-detail (`components/admin/v7/V7Customers.tsx`) |
| 16 | `SPEC_CUSTOM_PROFILE_LIBRARY` | 5 | **BUILT** | `components/architects/SavedProfilesBrowser.tsx` on `/architects/custom-profiles`; `saved_configurations`; `components/architects/SavedConfigCard.tsx` | — |
| 17 | `SPEC_DELIVERY_SCHEDULER` | 4 | **PARTIAL** | Admin side built: `deliveries` table (migration 037), `app/admin/deliveries/page.tsx`, `components/admin/DeliveriesWeek.tsx`, `lib/delivery/{business-days,windows,auto-schedule,notify,tracking-url}.ts`, `app/api/admin/deliveries/{schedule,mark-delivered}` | **The customer-facing half is absent.** The spec's `/account/delivery` route does not exist (verified ABSENT), and nothing in `app/checkout` or `app/account/orders/[id]` lets a customer request a delivery date or window — grep for `deliveryDate` / `requested_delivery` / `scheduleDelivery` on those files returns nothing. Carrier and minimum notice remain checklist #80–85 |
| 18 | `SPEC_DESIGN_CONSULTATION` | 5 | **BUILT** | `app/(public)/architects/consultation/page.tsx`; `app/api/consultation/request/route.ts`; `consultation_requests` | No admin review surface (`/admin/consultations` never built — SITEMAP already says so) |
| 19 | `SPEC_DOCUMENT_UPLOAD` | 1 | **BUILT** | `app/api/documents/{upload,download,[id],[id]/download}`; `app/api/upload/route.ts`; `components/account/DocumentUploadForm.tsx`, `DocumentDownloadButton.tsx`, `DocumentDeleteButton.tsx`; `/account/documents`; `vault_documents`, `order_attachments`, `takeoff_uploads`; `lib/utils/upload-limits.ts` | Three contexts all present |
| 20 | `SPEC_DRAWING_TOOL` | 1 | **BUILT** | `app/upload/page.tsx` (localStorage draft + debounced `confirmed_items` save); `app/api/takeoff/route.ts` (`claude-sonnet-4-6`), `app/api/takeoff/[uploadId]/route.ts`; `takeoff_uploads`; `lib/ai/takeoff-confidence.ts` (rule #17) | — |
| 21 | `SPEC_EMAIL_TEMPLATES` | 4 | **PARTIAL** | `lib/resend/templates/base.ts` — **the only template file**, exporting just `baseEmailTemplate()` and `ctaButton()` | **There is no template library.** All 14 spec IDs are composed inline at call sites. Coverage measured by grepping every `subject:` in `app/` + `lib/` — see §4.2. Four of the fourteen triggers send **no email at all** |
| 22 | `SPEC_FIELD_INSTALLATION_GUIDES` | 5 | **BLOCKED-ON-DATA** | `app/(public)/architects/guides/[profileSlug]/page.tsx` renders from `lib/data/catalog.ts`, prints "Guide content last updated — pending publication", and mounts the AI advisor | Content is checklist #57, #9, #10 |
| 23 | `SPEC_FINISH_PALETTE` | 5 | **BLOCKED-ON-DATA** | `components/architects/FinishPaletteBrowser.tsx` on `/architects/finish-palette` reads the `finishes` table | `finishes` has **no seed rows** — migration 002 inserts only `gauges` (x9), `materials` and `product_profiles`. The page renders `title="Finish library coming soon"`. **Note:** real colour data *does* exist in `lib/data/metal-colors.ts` (154 lines, from the McElroy and PAC-CLAD PDFs) but feeds the quote colour picker, not this page |
| 24 | `SPEC_FLASHING_CONFIGURATOR` | 2 | **DEFERRED-BY-DECISION** | `app/configure` verified ABSENT; `tests/e2e/no-configurator.spec.ts` enforces its absence; `STATE_OF_THE_BUILD.md` hpd-002 (2026-09-11) records the elimination; the Elite Methodology standing decisions repeat it | Do not build. FlashDraft is the only drawing tool |
| 25 | `SPEC_FREIGHT_ESTIMATOR` | 6 | **PARTIAL / BLOCKED-ON-DATA** | `lib/admin/pricing.ts:35` `getFreightClass(longestPieceFt)` (NMFC-style, per spec §4); `components/admin/QuoteEstimatorForm.tsx` takes a manually-typed freight amount; `lib/utils/distance.ts` haversine exists | No rate lookup, no origin ZIP, no carrier. `lib/pricing/quote-math.ts:236` states outright that freight and tax "are NOT invented here". Checklist #27–28, #5, #80–82. `FREIGHT_ESTIMATOR_SCOPE.md` already splits this correctly |
| 26 | `SPEC_GOOGLE_MAPS_INTEGRATION` | 4 | **PARTIAL / BLOCKED-ON-KEYS** | `@vis.gl/react-google-maps@1.5.2`; `lib/utils/geocode.ts`, `lib/hailview/geocode.ts`; `components/track/DeliveryTrackingMap.tsx` (5 consumers) | `DeliveryTrackingMap.tsx:361` carries a live `TODO: Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local`. Address autocomplete at checkout not located |
| 27 | `SPEC_HOMEPAGE` | 3 | **BUILT** | `app/page.tsx` assembles 12 `HomeSection` blocks (hero, client-carousel, field-app, credibility, design-studio, design-to-delivery, pathways, profile-passport, case-studies, shop-floor, nationwide, final-cta); `tests/e2e/homepage.spec.ts` | Two of that spec's e2e assertions are now red — §7 rows 1 and 2 |
| 28 | `SPEC_INVOICE_PORTAL` | 4 | **BUILT** | `app/account/invoices/page.tsx`; `app/api/invoices/{statement,[id]/pdf,[id]/send}`; `invoices` table (migration 035); `lib/data/invoices.ts`, `lib/invoices/create.ts`, `lib/utils/invoice-pdf.ts` | `INVOICE_AUDIT.md` (2026-07-31) records a status/paid-flag bug — predates migration 035, re-verification needed (§8 row 7) |
| 29 | `SPEC_LIVE_INVENTORY` | 6 | **BUILT / BLOCKED-ON-DATA** | `lib/data/product-stock.ts` `withLiveStock()` overlays `products.stock_type` / `lead_time_days` onto catalog fixtures by SKU; `app/api/admin/inventory/products/[productId]`, `app/api/admin/inventory/bulk`; `components/admin/ProductStockTable.tsx` on `/admin/settings`; `components/product/StockBadge.tsx` | Mechanism complete; the module's own comment says most SKUs have no row. Checklist #55–56 |
| 30 | `SPEC_MATERIAL_SPEC_LIBRARY` | 5 | **BLOCKED-ON-DATA** | `app/(public)/architects/specs/[profileSlug]/page.tsx` renders from `lib/data/catalog.ts` + `lib/utils/profile-svg.ts` | ASTM refs and data sheets are checklist #58–59 |
| 31 | `SPEC_MULTI_PROJECT_MANAGEMENT` | 4 | **BUILT** | `/account/projects`, `/account/projects/[id]`; `app/api/projects/route.ts`, `[id]`; `projects` table; `components/account/{ProjectCreateModal,ProjectEditModal,ProjectStatusActions,ProjectTabs}.tsx` | — |
| 32 | `SPEC_NOTIFICATIONS` | 4 | **PARTIAL / BLOCKED-ON-DATA / BLOCKED-ON-KEYS** | `notifications` table; `components/account/NotificationSettingsForm.tsx`; `app/api/account/notifications/route.ts`; 12 modules insert `notifications` rows; `lib/twilio/sms.ts` has 3 real callers; `lib/email/outbound.ts` tracks every send in `outbound_emails` | Stage names are checklist #39; SMS number #75; sender #76. Resend is unconfigured on alpha (`STATE_OF_THE_BUILD.md` v2-04), so the Deliveries screen honestly prints "nothing left the building" |
| 33 | `SPEC_ONLINE_CREDIT_APPLICATION` | 4 | **PARTIAL** | `/account/credit-application`; `components/account/CreditApplicationForm.tsx`; `app/api/credit/apply/route.ts`; `lib/data/credit.ts`; `credit_applications`; admin review at `/admin/credit-applications` + `CreditApplicationReviewModal.tsx` | `CREDIT_APP_GAPS.md` (2026-07-31), a field-by-field comparison against the real AFS fillable PDF, concludes the live form "was never built against the actual paper form": two whole sections missing (business/bank address, the legal agreement text) and 4 of 7 trade-reference fields. No migration needed — `application_data` is JSONB |
| 34 | `SPEC_ORDER_PORTAL` | 4 | **BUILT** | `/account`, `/account/orders`, `/account/orders/[id]`, `/track`, `/track/[orderId]`; `app/api/track/{verify,[token]}`; `components/account/OrderRealtimeListener.tsx`, `ProductionTimeline.tsx`, `ReorderButton.tsx`; `orders`, `order_line_items`, `order_status_history`, `order_attachments` | — |
| 35 | `SPEC_PHOTO_TO_QUOTE_AI` | 2 | **PARTIAL** | `app/studio/page.tsx` advertises a "Photo to Quote" tab; `app/field/contractor/page.tsx` + `app/api/field/{photo-upload,quote-request}` are the real mobile photo intake; `lib/field/field-photo-limits.ts` | **The advertised tab is a false door.** Its `ctaHref` is `/upload` — byte-identical to the "Scan to Quote" tab above it — and `app/upload/page.tsx` has **no photo mode**: no `?mode=` read, no photo branch. Separately, `STATE_OF_THE_BUILD.md` 2026-10-03 records that field submissions insert `line_items: []` by design and that **zero** `field_photo_quote` rows exist |
| 36 | `SPEC_PICKUP_SCHEDULING` | 4 | **BUILT / BLOCKED-ON-DATA** | `app/api/pickup/schedule/route.ts` (business-day validation, email + notification); `components/account/PickupScheduler.tsx` mounted in `app/account/orders/[id]/page.tsx` when `delivery_method === 'pickup'` | Dock details are checklist #47. **`PICKUP_SCHEDULING_SCOPE.md` says this is unbuilt and is now stale** — it was last touched 2026-09-30; the route was committed 2026-10-01 (`b10ed55`). §8 row 6 |
| 37 | `SPEC_PRICING_ADMIN` | 6 | **BUILT / BLOCKED-ON-DATA** | `/admin/pricing`; `/admin/settings/price-book` + `components/admin/PriceBookEditor.tsx`; `price_book_items`, `price_book_versions`, `pricing_ledger` (migration 035, append-only, trigger + policy-absence enforced); `lib/pricing/{price-book,quote-math,ledger,db,quote-inputs,approve-token}.ts`; `app/api/admin/{price-book,pricing-ledger/export,supplier-price-change}` | Rule #19: every money column is NULLABLE with no default; the 24 seeded rows have no version; `quote-math` refuses to issue a quote needing an unset price. **Prices are Steve's data and have not arrived** |
| 38 | `SPEC_PRODUCTION_QUEUE` | 6 | **PARTIAL — REGRESSED** | `components/admin/ProductionQueueTable.tsx` (`queue-row-N`, `order-status-N` testids), `QuickAdvanceButton.tsx`, `ProductionQueueRealtime.tsx` all still exist and compile | **All three are orphaned.** `/admin/orders` was rebuilt in v7 Phase 2 as the office list (`components/admin/v7/V7List.tsx`) and its own header comment says `ProductionQueueTable` "untouched" — but nothing imports them any more. Grep across `app/` + `components/` finds the names only in comments. The shop's job moved to `/admin/shop-view`. **This is why two Playwright tests are red** (§7 rows 4 and 5). `StatusAdvancer.tsx` survives, mounted at `app/admin/orders/[id]/page.tsx:186` |
| 39 | `SPEC_PRODUCTION_TIMELINE` | 4 | **BUILT / BLOCKED-ON-DATA** | `components/account/ProductionTimeline.tsx` with **4** consumers (`/account/orders`, `/account/orders/[id]`, `/account/projects/[id]`, `ProjectTabs.tsx`); `lib/admin/orderStages.ts`; `order_status_history` | Stage names are checklist #39 — the spec's own header says so |
| 40 | `SPEC_PRODUCT_CATALOG` | 3 | **PARTIAL / BLOCKED-ON-DATA** | `/products`, `/products/[category]`, `/products/[category]/[slug]`; `components/product/*` (7 files); `lib/data/catalog.ts` **734 lines of static fixtures** | The `products` / `product_profiles` tables are not the catalog's source — `catalog.ts` is. Migration 002 seeds one `product_profiles` statement and no `products`. `STATE_OF_THE_BUILD.md` records a rebuilt manifest on branches `products-manifest` / `products-page`, **not on main**, with 26 flagged entries, two unresolved category-vocabulary questions and "still no product copy at all" — all PENDING REID |
| 41 | `SPEC_PURCHASE_ORDER_INTEGRATION` | 3 | **BUILT** | `app/checkout/page.tsx` — `PaymentMethod = 'card' \| 'net_terms'`, `poNumber` field (:420), `net_terms` read from the profile (:147); `po_number` flows through `create-intent`, `confirm-order`, `quote-approve/[token]`, `invoices` (`lib/data/invoices.ts:88`) and the invoice PDF | — |
| 42 | `SPEC_QUICKBOOKS_INTEGRATION` | 8 | **DEFERRED-BY-DECISION / BLOCKED-ON-KEYS** | `lib/integrations/quickbooks.ts` — an explicit stub whose own header says so, returning `status: 'not_configured'`; `/admin/quickbooks` page; `app/api/admin/quickbooks/status/route.ts` | Spec header: blocked on #52–54. The stub is honest, not a shell pretending |
| 43 | `SPEC_QUOTE_BUILDER` | 2 | **BUILT** | `app/quote/page.tsx`; `app/api/quote-requests/route.ts` (GET/POST, confirmation email, notification row); `quote_requests`; colour/finish pickers (`components/quote/*`, 7 files) | No prices shown — RFQ intact |
| 44 | `SPEC_RESEND_INTEGRATION` | 4 | **BUILT / BLOCKED-ON-KEYS** | `lib/resend/{client,send}.ts`; `lib/email/outbound.ts` (`sendTrackedEmail`, `outbound_emails`, the `E2E-TEST-` capture rule of rule #21); 21 modules send through it | Not configured on alpha, **and the sending domain's DNS is broken** — `STATE_OF_THE_BUILD.md` v2-03 §8 reported it and did not fix it. Sender address is checklist #76 |
| 45 | `SPEC_RUSH_ORDER` | 6 | **BUILT / BLOCKED-ON-DATA** | Migration 034 `quote_requests_rush_needs_explicit_source` CHECK; `lib/data/rush-explicit-only.test.ts` (static, repo-wide); `app/api/quote-requests/route.ts` and `app/api/admin/command-center/set-rush/route.ts` are the only writers; pinning confined to the three shop queues (`lib/data/shop-queue.ts` `compareShopQueue`, tested) | Rule #15. Surcharge % and the definition of "rush" are checklist #32, #36 — no surcharge is computed anywhere |
| 46 | `SPEC_SAVED_PROJECT_TEMPLATES` | 4 | **BUILT** | `/account/templates`; `app/api/templates/route.ts`, `templates/[id]/use`; `quote_templates`; `components/account/{TemplateCreateModal,UseTemplateButton}.tsx` | — |
| 47 | `SPEC_STRIPE_INTEGRATION` | 3 | **PARTIAL** | `stripe@17.7.0`, `@stripe/react-stripe-js@2.9.0`; `app/api/checkout/create-intent/route.ts:136` `paymentIntents.create`; `app/api/webhooks/stripe/route.ts`; `STRIPE_CARD_ELEMENT_COLORS` constant (rule #4 exception) | **ACH is not implemented.** The PaymentIntent is created with `{amount, currency, metadata}` only — no `payment_method_types`, no `us_bank_account`, no `automatic_payment_methods`. `CLAUDE.md`'s stack line says "Stripe (cards, ACH)". §8 row 8 |
| 48 | `SPEC_SUPABASE_INTEGRATION` | all | **BUILT** | `lib/supabase/{client,server,admin}.ts`; `admin.ts` passes `cache: 'no-store'` (rule #22); 38 migrations; **RLS enabled on all 67 created tables**; `@supabase/ssr@0.12`, `@supabase/supabase-js@2.110` | — |
| 49 | `SPEC_TAXJAR_INTEGRATION` | 3 | **MISSING / BLOCKED-ON-DATA** | Negative: the only `taxjar` matches in the entire repo are `app/admin/settings/page.tsx:35,61,62` (an env-presence status card reading `process.env.TAXJAR_API_KEY`) and one prose mention in `components/admin/v7/V7Settings.tsx:15` | No client, no call, no rate lookup. `lib/invoices/create.ts:123` hardcodes `tax_cents: 0`. Spec header: blocked on checklist #31 (nexus states) |
| 50 | `SPEC_TRIM_LENGTH_OPTIMIZER` | 2 | **BUILT** | `lib/utils/trim-optimizer.ts`; `components/quote/TrimLengthOptimizerSection.tsx` mounted in `app/quote/page.tsx` | **The spec's own "BLOCKED on checklist #21" header is stale** — `TRIM_OPTIMIZER_SCOPE.md` establishes `product_profiles.standard_length_ft` / `max_length_ft` are real seeded data. §8 row 5 |
| 51 | `SPEC_TWILIO_INTEGRATION` | 4 | **BUILT / BLOCKED-ON-KEYS** | `lib/twilio/sms.ts` `sendSms()`; 3 real callers (`app/api/orders/[id]/dispatch`, `app/api/driver/location`, `lib/delivery/notify.ts`), each behind the same `phone && sms_opt_in` gate | Outbound number is checklist #75. Rule #25: an `E2E-TEST-` job never reaches Twilio |
| 52 | `SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA` *(root)* | — | **BUILT** | Migration 007; `driver_locations`, `delivery_notifications`; `/employee`, `/employee/orders`, `/employee/orders/[id]`, `/employee/photos`; `/field/shop`, `/field/contractor`, `/field/no-access`; `app/api/driver/location`, `app/api/field/*`; `lib/pwa/{install-prompt,platform}.ts`; `components/field/InstallPromptHandler.tsx`; `lib/delivery/tracking-url.ts` (one formula, rule #25) | Not in `CLAUDE.md`'s spec list (§4.0) |
| 53 | `SPEC_HAILVIEW` *(root)* | — | **BUILT** | `/hailview`; `lib/hailview/{replacement-score,storm-history,explanation,geocode,wind,types}.ts` + unit test; `app/api/hailview/{storm-history,email-report}`; `components/hailview/HailViewMap.tsx`; `tests/e2e/hailview.spec.ts`; `STATE_OF_THE_BUILD.md` afs-hv-001…009 record all 5 phases DONE | Not in `CLAUDE.md`'s spec list (§4.0) |
| 54 | `SPEC_PRICING_ADMIN (1)` / `(2)` | 6 | **DUPLICATE ARTEFACT** | Two byte-duplicate 223-line copies in `specs/` alongside the canonical 126-line file | Not a feature. Logged as F-02 |

### Roll-up

| Classification | Count (of 53 feature specs; row 54 is a duplicate artefact) |
|---|---|
| BUILT (including BUILT / BLOCKED-ON-*) | 32 |
| PARTIAL | 12 |
| BLOCKED-ON-DATA (pure — correct code, no content) | 4 |
| MISSING | 2 (`SPEC_AI_ORDER_VALIDATOR`, `SPEC_TAXJAR_INTEGRATION`) |
| DEFERRED-BY-DECISION | 2 (`SPEC_FLASHING_CONFIGURATOR`, `SPEC_QUICKBOOKS_INTEGRATION`) |
| Regressed from previously built | 1 (`SPEC_PRODUCTION_QUEUE`) |

## 4.2 `SPEC_EMAIL_TEMPLATES` — the 14 templates, measured

Built by grepping every `subject:` literal in `app/` and `lib/`.

| # | Spec template ID | State | Evidence |
|---|---|---|---|
| 1 | `quote-request-submitted` | **BUILT** | `app/api/quote-requests/route.ts:223` — "We've Received Your Quote Request #…" |
| 2 | `formal-quote-ready` | **BUILT** | `lib/quotes/issue.ts:274` + `lib/quotes/email-template.ts`; carries the single-use Approve link |
| 3 | `order-confirmation` | **MISSING** | `app/api/webhooks/stripe/route.ts` has **no** `sendEmail` / `sendTrackedEmail` / `subject` — grep returns nothing |
| 4 | `order-in-queue` | **PARTIAL** | collapsed into one generic `app/api/admin/orders/[id]/status/route.ts:104` — "Order #… Update: {stageLabel}" |
| 5 | `fabrication-started` | **PARTIAL** | same generic sender |
| 6 | `order-ready` | **PARTIAL** | same generic sender |
| 7 | `order-shipped` | **BUILT** | `app/api/orders/[id]/dispatch/route.ts:166` + SMS |
| 8 | `delivery-scheduled` | **BUILT** | `lib/delivery/notify.ts` (email + SMS + `notifications`), and `app/api/pickup/schedule/route.ts:138,158` for pickup |
| 9 | `order-delivered` | **BUILT** | `app/api/orders/[id]/delivered/route.ts:72` |
| 10 | `pre-ship-photo` | **MISSING (email)** | `app/api/admin/orders/[id]/photos/route.ts:85–96` inserts a `notifications` row only; no email |
| 11 | `admin-new-order` | **MISSING** | no subject anywhere matches; no admin notification on order creation |
| 12 | `account-confirmation` | **DEFERRED-BY-DECISION** | handled by Supabase Auth's own mail, not by Resend |
| 13 | `password-reset` | **DEFERRED-BY-DECISION** | same |
| 14 | `team-invitation` | **MISSING** | `app/api/team/invite/route.ts` contains **no** `sendEmail` / `sendTrackedEmail` / `subject`. The invite row and `/invite/[token]` page exist; **nothing mails the link** |

**7 built · 3 collapsed into one generic · 2 delegated to Supabase · 4 absent
(order-confirmation, pre-ship-photo, admin-new-order, team-invitation).** Of the
four, **`team-invitation` is the most consequential** — `SPEC_TEAM_ACCOUNTS`'s
flow cannot complete without a human copying a URL out of the database.

---

# 5. SITEMAP.md VERSUS THE FILESYSTEM

## 5.1 The counts are wrong by roughly a factor of two

`SITEMAP.md` claims, in its own header and its PAGE + ROUTE COUNT section:

> `Total (filesystem): 111 (57 page.tsx + 54 route.ts)` … **"112 is the number
> to cite as 'the route count' going forward"**

Measured in this session:

| | SITEMAP claims | Actual | Delta |
|---|---|---|---|
| `page.tsx` | 57 | **88** | +31 |
| `route.ts` | 54 | **119** | +65 |
| Total files | 111 | **207** | +96 |

The document's own last-verified note is **2026-07-14 (afs-038)**, decremented
by one for hpd-002 on 2026-09-11. Everything built since — the Command Center
V2 build (v2-01…v2-06), the v7 port (Stages A, B, B2, D, E, G), Bid Monitor,
Bid Documents, the Profile Passport, the employee/field PWA, the price book,
Deliveries, Shop View, GBP photos, HailView's API routes — is unrecorded.
`SITEMAP.md` is the single most stale governance document in the repository.

## 5.2 Routes `SITEMAP.md` documents that DO NOT EXIST

Each verified with a filesystem existence test in this session.

| Route documented in SITEMAP | Filesystem | Why |
|---|---|---|
| `/studio/profile-viewer/[profileId]` | **ABSENT** | deleted with the 911-profile library (`CLAUDE.md` MACHINE INTEGRATION block, migration 031) |
| `/api/studio/match-profile` | **ABSENT** | same removal; `CLAUDE.md` rule #12 explicitly records its deletion |
| `/api/studio/load-profile` | **ABSENT** | same |
| `/api/studio/library-list` | **ABSENT** | same |
| `/api/admin/pathfinder/push-profile` | **ABSENT** | deleted 2026-09-30 to establish rule #14's single door |
| `/api/admin/pathfinder/submit-job` | **ABSENT** | same |
| `/api/machine-bridge/status` | **ABSENT** | only `pending-jobs` and `job-delivered` exist |
| `/configure` | **ABSENT** | correct — SITEMAP says it was removed, but the ROUTE TREE text still narrates it |

SITEMAP additionally *correctly* lists `/login/magic-sent`, `/account/delivery`,
`/admin/cad-library` and `/admin/consultations` as never built — all four
verified ABSENT. Its `/studio/library` entry describes "all public **machine**
profiles", which is the removed library; the route exists but its content source
has changed. `[Certain]`

## 5.3 Routes that EXIST but `SITEMAP.md` does not document

Pages only (the undocumented API surface is larger still):

`/about/services` · `/about/services/submittal` · `/admin/bid-monitor` ·
`/admin/command-center/bids/[id]` · `/admin/command-center/job/[id]` ·
`/admin/deliveries` · `/admin/gbp-photos` · `/admin/geometry-test` ·
`/admin/orders-crm` · `/admin/quotes` · `/admin/quotes/new` · `/admin/search` ·
`/admin/search/profiles` · `/admin/settings/price-book` ·
`/admin/shop-library` · `/admin/shop-view` · `/app/profile-passport` ·
`/employee` · `/employee/orders` · `/employee/orders/[id]` ·
`/employee/photos` · `/field/contractor` · `/field/no-access` · `/field/shop` ·
`/flashchat` · `/resources/building-codes` · `/studio/hem-debug` ·
`/track` (index)

`/hailview`, `/faq`, `/resources` and `/design-studio` appear in SITEMAP's ROUTE
PROTECTION MATRIX but not in its ROUTE TREE — a half-entry.

## 5.4 Route-protection findings

| Route | Stated protection | Actual | Verdict |
|---|---|---|---|
| `/admin/**` | admin, `middleware.ts` + per-route check | `middleware.ts` resolves role via a service-role client with fail-closed handling; every admin page calls `requireAdminUser` | **Correct** |
| `/api/machine-bridge/**` | Bearer `AFS_BRIDGE_SECRET` | `lib/machine-bridge/auth.ts` | **Correct** |
| `/admin/geometry-test` | not in SITEMAP | admin-gated twice, deliberately unlinked, `robots: noindex`, recorded in `lib/data/admin-nav.ts` `UNLINKED_ADMIN_ROUTES` | **Correct and documented** |
| `/studio/hem-debug` | not in SITEMAP | **PUBLIC** — under `/studio`, which the protection matrix marks "No auth". A developer debug canvas reachable anonymously in production | **Finding F-03** (§9.2) |
| `/admin/orders-crm` | not in SITEMAP | admin-gated, reachable from `components/admin/CommandCenterDashboard.tsx:71,86`, but **not** in `UNLINKED_ADMIN_ROUTES` and not in `TOP_LEVEL_NAV` / `MORE_NAV` | **Finding F-05** (§9.2) |
| `/admin/quote-requests`, `/admin/quickbooks`, `/admin/shop-library` | not in SITEMAP | admin-gated; reachable only from `/admin/settings` cards or the legacy dashboard, absent from both nav lists and from `UNLINKED_ADMIN_ROUTES` | **Finding F-05** |

`lib/data/admin-nav.ts` `UNLINKED_ADMIN_ROUTES` names exactly two routes
(`/admin/geometry-test`, `/admin/gbp-photos`). At least four more admin pages are
equally unlinked from the nav. The data structure exists precisely so the reason
is recorded next to the decision; it is now incomplete.

---

# 6. THE FIVE NAMED COMMAND CENTER ITEMS

The brief lists five Command Center items as "still unbuilt". **Three of the
five are built.** Each verdict is evidence-first.

## 6.1 Invoices table + Approved checklist — **BUILT. The premise is stale.**

The premise traces to `docs/COMMAND_CENTER_V2_SPEC.md` §3, which reads:

> `| Approval → invoice → auto-email Tricia | MISSING | no 'invoices' table |`
> `| Approved checklist + Send to machine | PARTIAL | … checklist/feedback missing |`

That map was written **before** prompt v2-03. Both are now built:

- **Table.** `supabase/migrations/035_price_book_ledger_quotes_invoices.sql`
  creates `invoices` with `ENABLE ROW LEVEL SECURITY` (:452) and two policies
  (`admin_all_invoices` :481, `users_own_invoices` :483). `SCHEMA.md` documents
  it at "TABLE — invoices" (line 2526). `lib/data/invoices.ts:88` selects 20
  columns from it, including `office_emailed_to` / `office_emailed_at`.
- **Checklist.** `components/admin/JobActionPanel.tsx:318–356` renders
  `data-testid="approved-checklist"` with three lines, each driven by a real
  fact: customer approved (:326), invoice created from the quote (:335,
  `done={job.invoice !== null}`), invoice emailed to the office (:343,
  `done={job.invoice?.officeEmailedAt != null}`), plus a "Download the invoice
  PDF" link (:352). The data comes from `lib/data/job-screen.ts:477–542`, which
  reads the `invoices` row.
- The file's own header (`JobActionPanel.tsx:18`) says: *"Approved checklist
  with the invoice (the `invoices` table now exists)."*

**Verdict: BUILT.** `[Certain]`

## 6.2 Stage C — **NOT STARTED. Confirmed.**

Stage C is defined in `STATE_OF_THE_BUILD.md:16908`:

> **STAGES C THROUGH G WERE NOT STARTED.** Stage C moves invoice creation from
> customer approval to shop-finish — a live-money path needing a migration,
> reconciliation maths and consistency for already-approved jobs.

Code confirms both halves:

- **Invoice creation is still at customer approval.**
  `app/api/quote-approve/[token]/route.ts:210` → `lib/invoices/create.ts`. The
  v7 gap audit item 7 records the same line.
- **No reconciliation exists.** `grep -rni 'reconcil' app lib components`
  returns only: a QuickBooks page blurb, two comments in `lib/admin/orderStages.ts`
  and `lib/data/orders.ts` about reconciling *stage names*, a generated-CSS
  comment, and **`lib/data/v7-view/job.ts:393,398,446` plus
  `lib/fixtures/command-center-v7.ts:361` — the v7 fixture / presentation layer
  only.** The Job screen renders strings about a reconciliation that no code
  computes and no email sends.
- **`send-quote` still has no office copy.** `grep -n 'officeInvoiceEmail\|office'
  app/api/admin/command-center/send-quote/route.ts` returns nothing — gap-audit
  item 6, unchanged.

**Verdict: NOT STARTED, and Stage C's absence is visible in the UI as fixture
text describing behaviour that does not exist.** `[Certain]`

## 6.3 Stage F — **NOT STARTED. Confirmed.**

`STATE_OF_THE_BUILD.md:17057–17059`:

> **THE MONEY PATH WAS NOT TOUCHED** … change orders and addenda are untouched.
> Stage C and Stage F were not in this run's scope.

The stage letters themselves came from an interactive brief that is **not in this
repository** — `grep 'Stage [A-G]'` across `FORGE/projects/afs-website/*.yaml`
returns nothing. From the sentence above and from the v7 gap audit's Phase 4/5
(change orders / addenda), **Stage F = change orders before the machine +
addenda after the job started** `[Likely]`.

Code confirms both are absent from every live path:

- `change_order` / `changeOrder`: **zero** matches in `app/`, `lib/`,
  `components/`.
- `addendum` / `addenda`: matches exist, and **every one is fixture or v7-view
  presentation**: `lib/fixtures/command-center-v7.ts:218,260`
  (`interface V7Addendum`), `lib/data/v7-view/from-fixture.ts:97`,
  `lib/data/v7-view/job.ts:406,429`, `lib/data/v7-view/types.ts:84`,
  `components/admin/v7/V7Settings.tsx:73`. Two files
  (`from-live.ts:132`, `from-live-lists.ts:112`) carry comments stating outright
  that these pills are "gap-audit items 8 and 9" and are not emitted.
- No schema: no `quotes.revision`, no `addenda` table in any of the 38
  migrations.
- The pixel gate names them: `modal-chg1` and `modal-chg2` report **NO LIVE
  ROUTE** every run.

**Verdict: NOT STARTED.** `[Certain]` for the absence; `[Likely]` for the
Stage-F label.

## 6.4 Mail parser — **NOT STARTED, and correctly deferred.**

- `queue.yaml`'s own description: *"Spec Phase 4 (Outlook / Microsoft 365 send +
  mail parser) is DEFERRED until Microsoft 365 admin consent is granted and is
  deliberately not in this queue."*
- `STATE_OF_THE_BUILD.md:17053–17055`: *"MICROSOFT: nothing was added, as
  required. The Workbench's Outlook inbox rail and its 'N new emails' chip are
  still absent, and no Graph code exists in this repository."*
- Verified: no Microsoft Graph package in `package.json`;
  `source='mail_parser'` appears in `SCHEMA.md`'s `pricing_ledger` design as a
  **planned** writer with `uq_pricing_ledger_external_ref` already in place for
  idempotency — the schema is ready, the writer does not exist.

**Verdict: DEFERRED-BY-DECISION, blocked on a Microsoft tenant.** `[Certain]`

## 6.5 Delivery-scheduling columns — **BUILT, as a TABLE, deliberately.**

`docs/COMMAND_CENTER_V2_SPEC.md` §Phase 5 offered either columns on
`shop_profile_library` or a new table. Migration 037 chose the table and argues
it in the file (`037_deliveries_and_shop_queue.sql:27–48`):

> **WHY A TABLE AND NOT COLUMNS.** … A table wins on one fact: a delivery is
> scheduled, rescheduled and then delivered by a person … Columns on
> `shop_profile_library` would carry the current value and lose the actor.

What shipped: `shop_profile_library.started_at` (the one genuinely new *column*,
:21) and `deliveries` with `shop_job_id` UNIQUE, `quote_request_id`,
`scheduled_date date`, `time_window text` (stored as the key `'08-10'` etc.,
never the label), `status`, `auto_scheduled`. Supported by
`lib/delivery/business-days.ts` (weekend skip + `SHOP_TIME_ZONE`, rule #24),
`lib/delivery/windows.ts`, `components/admin/DeliveriesWeek.tsx`,
`app/api/admin/deliveries/{schedule,mark-delivered}`.

**Verdict: BUILT.** The premise reads as unbuilt only against the V2 spec's
"columns" option, which was consciously not taken. `[Certain]`

## 6.6 Summary of the five

| Item | Brief's premise | Measured verdict |
|---|---|---|
| Invoices table / checklist | unbuilt | **BUILT** (migration 035; `JobActionPanel.tsx:318`) |
| Stage C (invoice at shop-finish + reconciliation) | unbuilt | **UNBUILT — confirmed** |
| Stage F (change orders + addenda) | unbuilt | **UNBUILT — confirmed** |
| Mail parser | unbuilt | **UNBUILT — confirmed, correctly deferred on Microsoft** |
| Delivery-scheduling columns | unbuilt | **BUILT as a table, by a recorded decision** |

**What is genuinely still missing in the Command Center**, consolidated from the
v7 gap audit and re-verified against code in this session:

| Gap-audit # | Feature | State |
|---|---|---|
| 6 | Estimate emailed to the office when a quote is sent | **MISSING** — `send-quote/route.ts` has no office reference |
| 7 | Reconciliation (estimate vs final + difference) at shop-finish | **MISSING** — fixture text only |
| 7 | Invoice creation moved to shop-finish | **DIFFERENT** — still at customer approval; this is Stage C |
| 8 | Change order before the machine | **MISSING** — zero code, zero schema |
| 9 | Addendum after the job started | **MISSING** — fixture types only |
| — | Workbench Outlook inbox rail + "N new emails" | **BLOCKED-ON-KEYS (Microsoft tenant)** |
| — | v7's side-by-side "original email beside this reading" | **MISSING** — `SCREEN_MANIFEST.json` records `source-sketch` / `source-photo` as `liveRoute: null`; the fixture Job screen links to `/admin/command-center/job/412/source`, **a dangling link**, unfixed and acknowledged in the 2026-10-03 entry |
| — | 16 v7 states with no live route | named individually in `docs/design/V7_PIXEL_REPORT.md` §1 |

---

# 7. THE FIVE FAILING PLAYWRIGHT TESTS

## 7.1 Why they could not be re-run, stated plainly (S40 — no circumvention)

`playwright.config.ts:35` resolves `baseURL` as
`process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`. The config loads
`.env.local` itself (lines 12–24), and **`.env.local` does not define
`PLAYWRIGHT_BASE_URL`** (verified by a key-name-only check; no value was read or
printed). There is no `webServer` block in the config.

Therefore every Playwright run in this worktree targets `http://localhost:3000`,
which requires a dev server. **This run's hard rules forbid starting one.**
Targeting the alpha deployment instead would require inventing an environment
value the repository does not set — exactly the kind of unrecorded deviation
Law 8 forbids.

**The five failures were therefore diagnosed statically**: each spec was read in
full and each assertion traced to the implementation it asserts against. Every
cause below is backed by a line of application source read in this session, not
by the test name and not by the prior session's narrative. Where a prior
diagnosis already existed, it was independently re-derived before being
accepted.

The failing set is taken from `STATE_OF_THE_BUILD.md`'s 2026-10-03 entry, which
recorded **163 passed, 5 failed, 3 skipped** and proved all five pre-existing by
re-running them with that run's changes stashed at HEAD.

## 7.2 The five, with causes

### 1. `tests/e2e/homepage.spec.ts:238` — hero dual CTAs resolve to `/quote` and `/about/services`

**Asserts:** inside `[data-section="hero"]`, link "Start Your Project" has
`href="/quote"` **and** link "View Our Work" has `href="/about/services"`.

**Implementation:** `app/components/hero/HeroSection.tsx:77` — "Start Your
Project" → `href="/quote"` (passes). `app/components/hero/HeroSection.tsx:83` —
"View Our Work" → **`href="/design-studio"`** (fails).

**Cause — [Certain].** The secondary CTA was repointed from `/about/services` to
`/design-studio` and the test was never updated. This is a **stale test, not a
broken page** — but which target is correct is a product question, because
`/design-studio` is itself the "second, un-reconciled 'Design Studio'
destination alongside `/studio`" that `SITEMAP.md`'s own protection matrix
flags. Changing the test to expect `/design-studio` would cement a duplication
the sitemap already calls a problem. **Needs Reid's decision** — queue item Q-06.

### 2. `tests/e2e/homepage.spec.ts:253` — header logo renders oversized (76px)

**Asserts:** the `<header>` contains exactly one `<img>`, with `width="76"`, and
the text "Architectural Flashing Supply" is visible in the header.

**Implementation:** `components/layout/NavBar.tsx:130` —
`<Image src="/afs-logo.png" alt="Architectural Flashing Supply" width={160} height={80} … />`.

**Cause — [Certain].** The rendered width is **160**, not 76. The assertion dates
from hpd-008; the header has been resized since (hpd-009 through hpd-012 all
touched the logo, and the 2026-10-02 pixel-gate run found and corrected a logo
aspect-ratio defect). Note a **second latent failure in the same test**:
`header.getByText('Architectural Flashing Supply')` matches on text content, and
that string exists in the header only as the image's `alt` attribute, which
`getByText` does not match. Even after the width is corrected, that assertion
needs re-examining. `components/layout/AfsLogo.tsx:16` uses `width={200}` — a
third value, which suggests logo sizing is not centrally owned.

### 3. `tests/e2e/modify-in-flashdraft.spec.ts:179` — saving a modified draft creates a NEW row linked to the source

**Asserts (the failing line):** `expect(child.dimensions.revision).toBe(5)` for a
source profile at revision 4.

**Implementation, traced independently in this session:**

- `app/studio/draft/page.tsx:3470` — `loadForModify` does
  `setRevision((dims?.revision ?? 1) + 1)` → the banner (`:3953`, "(rev
  {revision})") reads **5**.
- `app/studio/draft/page.tsx:3466` — the same function does
  `setSavedProfileId(null)`, deliberately, with the comment *"NEW draft: no own
  row yet, never locked, lineage recorded"* — so the first save is an INSERT that
  cannot overwrite the locked original.
- `app/studio/draft/page.tsx:2835` — `performSave` computes
  `const nextRevision = asDuplicate || !savedProfileId ? 1 : revision + 1`. With
  `savedProfileId === null` this is **1**, and `:2887` writes
  `revision: nextRevision`.

**Cause — [Certain].** The screen says 5; the row says 1. Not a flaky test and
not a test-only problem: it is a genuine disagreement between the lineage banner
and the persisted value, and **which is right is a product question** — does
"revision" count lineage depth, or this row's own edit count? The 2026-10-03
entry reached the same conclusion and marked it PENDING REID; this run re-derived
it from source and agrees. **Needs Reid's decision** — queue item Q-05.

### 4. `tests/e2e/production-queue.spec.ts:22` — quick advance updates order status
### 5. `tests/e2e/production-queue.spec.ts:50` — rush orders appear at top of queue

**Assert:** navigate to `/admin/orders` (and `/admin/orders?status=rush`), then
find `[data-testid="queue-row-0"]` or the empty-state text "No orders in this
stage.", then `[data-testid="quick-advance-0"]` and
`[data-testid="order-status-0"]`.

**Implementation:** those testids live in
`components/admin/ProductionQueueTable.tsx:92` (`queue-row-${index}`) and `:116`
(`order-status-${index}`), and in `components/admin/QuickAdvanceButton.tsx`.
`app/admin/orders/page.tsx` **does not import any of them.** It renders
`LightWorkingArea` → `components/admin/v7/V7List.tsx` over
`lib/data/quote-order-rows.ts` + `applyListQuery`. Its own header comment
(`:22–24`) states:

> This REPLACED the old production-queue view … `ProductionQueueTable` and
> `ProductionQueueRealtime` are untouched.

A repo-wide grep confirms the components are now referenced **only in comments**:
`app/admin/orders/page.tsx:24` and `components/admin/BidDocumentRealtime.tsx:12`.

**Cause — [Certain], one shared root cause.** The v7 Phase 2 rebuild of
`/admin/orders` orphaned the production-queue UI. The tests still point at a
screen that no longer exists at that URL. Neither test can even reach its
graceful `test.skip` branch, because the skip is guarded on
`firstRow.isVisible()` **after** `await expect(firstRow.or(emptyState)).toBeVisible()`
has already failed — the empty-state string "No orders in this stage." is also
`ProductionQueueTable`'s, not `V7List`'s.

**Secondary consequence:** `ProductionQueueTable.tsx`,
`ProductionQueueRealtime.tsx` and `QuickAdvanceButton.tsx` are now **dead code**
that `tsc` still compiles and no user can reach. Under the Elite Standard's
"no dead code" rule that is a defect in its own right, and `SPEC_PRODUCTION_QUEUE`
has silently regressed from built to unreachable. **Needs Reid's decision**
(delete the old queue and retarget the tests at Shop View, or restore a
production-queue screen at a new URL) — queue item Q-04.

## 7.3 Note on the test totals

`STATE_OF_THE_BUILD.md` reports the suite as 163/5/3. This run did not re-run it
and therefore neither confirms nor disputes those numbers; it confirms only that
the five named tests have a real, currently-present cause in the code. The
**unit** suite *was* re-run and is 484/485, with one additional pre-existing
failure the governance does not record (§2.1).

---

# 8. CONTRADICTIONS: GOVERNANCE VERSUS CODE

| # | Document | Claim | Code | Severity |
|---|---|---|---|---|
| 1 | `SITEMAP.md` header + PAGE + ROUTE COUNT | "111 (57 page.tsx + 54 route.ts)", "112 is the number to cite going forward" | **88 pages, 119 route handlers, 207 files** | **High** — the route registry is unusable for planning |
| 2 | `SITEMAP.md` ROUTE TREE | lists `/studio/profile-viewer/[id]`, `/api/studio/match-profile`, `/api/studio/load-profile`, `/api/studio/library-list`, `/api/admin/pathfinder/push-profile`, `/api/admin/pathfinder/submit-job`, `/api/machine-bridge/status` | all **ABSENT**; the first four were removed with the 911-profile library, the next two to establish rule #14's single door | **High** — documents two doors to the machine that were deliberately deleted |
| 3 | `STATE_OF_THE_BUILD.md` 2026-10-03 | "`pnpm test:unit` — **485/485 across 31 files**" | **484/485** on a clean Windows checkout; `lib/design/v7-css.test.ts` fails on CRLF | **Medium** — the claim holds only after a build has run; the repo is not portable without one (§2.1) |
| 4 | `docs/COMMAND_CENTER_V2_SPEC.md` §3 | "Approval → invoice → auto-email Tricia — MISSING — no `invoices` table"; "Settings: price book — MISSING"; "Search … no UI"; "Mark finished auto-schedules delivery — MISSING"; "Remove 911-profile library — NOT STARTED" | every one of these shipped in v2-01…v2-05 | **Medium** — a pre-build audit map still presented as current status; it is the source of two of this brief's five stale premises |
| 5 | `specs/SPEC_TRIM_LENGTH_OPTIMIZER.md` header | "**BLOCKED: Standard stock lengths pending checklist #21**" | `product_profiles.standard_length_ft` / `max_length_ft` are real seeded data; `lib/utils/trim-optimizer.ts` + `TrimLengthOptimizerSection.tsx` are built and mounted. `TRIM_OPTIMIZER_SCOPE.md` says the header is stale | **Low** — a blocker that is not blocking |
| 6 | `PICKUP_SCHEDULING_SCOPE.md` | "the spec's entire FLOW (§2) and API (§4) are unbuilt" | `app/api/pickup/schedule/route.ts` and `components/account/PickupScheduler.tsx` were committed `b10ed55`, **2026-10-01**; the scope doc's last commit is **2026-09-30** | **Low** — off by one day; the doc is simply older than the build |
| 7 | `INVOICE_AUDIT.md` (2026-07-31) | "invoice status ignores the 'paid' flag everywhere except the admin CRM tab" | predates migration 035's `invoices` table and `lib/invoices/create.ts` entirely. Whether the bug survived the rewrite is **UNVERIFIED** | **Low** — stale audit, re-verification needed |
| 8 | `CLAUDE.md` TECHNOLOGY STACK | "Payments: Stripe (cards, **ACH**)" | `create-intent/route.ts:136` creates the PaymentIntent with `{amount, currency, metadata}` only — no `payment_method_types`, no `us_bank_account` | **Medium** — a stated capability that does not exist |
| 9 | `CLAUDE.md` GOVERNANCE / SPEC DOCUMENTS lists | names ~52 specs by bare filename, implying the project root | 54 are in `specs/`; **two more exist that `CLAUDE.md` never lists** (`SPEC_HAILVIEW.md`, `SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md`), both describing shipped features | **Medium** — a reader following `CLAUDE.md` cannot find the specs and does not learn two shipped subsystems exist |
| 10 | `COMPONENT_MAP.md` (via `MATERIAL_CALC_SCOPE.md`) | documents `AutoMaterialCalculator.tsx` | **zero matches** anywhere in the repository | **Low** — a component-map entry with no component |
| 11 | `app/admin/orders/page.tsx:24` | "`ProductionQueueTable` and `ProductionQueueRealtime` are untouched" | literally true of their contents, and misleading about their status: **nothing imports either of them any more** | **Medium** — the comment reads as reassurance, and is the reason the regression went unnoticed (§7.2) |
| 12 | `lib/data/admin-nav.ts` `UNLINKED_ADMIN_ROUTES` | two routes recorded as deliberately unlinked | at least four more admin pages are unlinked and unrecorded (§5.4) | **Low** |
| 13 | `app/studio/page.tsx` "Photo to Quote" tab | "Photograph existing flashing in the field. AI identifies profile type and material." with CTA "Upload Photos" | `ctaHref: '/upload'` — the **same** target as the "Scan to Quote" tab, and `/upload` has no photo mode | **Medium** — a customer-facing promise with no destination |
| 14 | `specs/` directory | one canonical pricing-admin spec | **three** files: `SPEC_PRICING_ADMIN.md` (126 lines, the one `CLAUDE.md` names) plus `(1)` and `(2)`, both 223 lines and byte-identical to each other | **Low** — competing source of truth |

**Not a contradiction, recorded to stop one being invented later:** the
`trica@` / `tricia@` address. `CLAUDE.md` rule #21 and
`docs/COMMAND_CENTER_V7_GAP_AUDIT.md` §"RESOLVED 2026-10-01" agree that `trica@`
(no `i` after the `r`) is the real mailbox, that the 2026-09-30 pass which
rewrote 31 occurrences to `tricia@` was the error, and that Reid reversed it. The
code names the address once, in `lib/data/office.ts`. **Do not "correct" it.**

---

# 9. UNRESOLVED, AND ADDITIONAL FINDINGS

## 9.1 UNRESOLVED (Law 6 — not resolved by assumption)

| ID | Unresolved item | Why it could not be settled | Impact |
|---|---|---|---|
| U-01 | **Live database contents** | The Supabase connection available to this session lists three projects (`benavora`, `DialStars`, `brightbox-homes-admin`) — **the AFS project is not among them**. No row counts, no live `information_schema` check, no confirmation that all 38 migrations are applied. | Every BLOCKED-ON-DATA judgement about *seed* rows rests on migration files, not on live data. `finishes` and `cad_library_files` have no seed statement in any migration, which is strong but not conclusive evidence that they are empty live. |
| U-02 | **Whether the five Playwright failures still reproduce** | No dev server permitted and `PLAYWRIGHT_BASE_URL` is unset (§7.1). | Causes are proven from source; *reproduction* is inherited from the 2026-10-03 run, not re-measured. |
| U-03 | **`INVOICE_AUDIT.md`'s paid-flag bug** | The audit predates the `invoices` table by two months; confirming or clearing it needs a live row. | A possible real billing-display bug, status unknown. |
| U-04 | **The Stage A–G letter mapping** | The brief that assigned the letters is not in the repository; `grep 'Stage [A-G]'` over the FORGE queues returns nothing. | "Stage F = change orders + addenda" is `[Likely]`, derived from `STATE_OF_THE_BUILD.md:17057`. The *features* are confirmed absent either way. |
| U-05 | **Which secondary-hero target is correct** (`/about/services` vs `/design-studio`) | A product decision, entangled with the unreconciled `/studio` vs `/design-studio` duplication. | Blocks a clean fix for homepage test 1. |
| U-06 | **What "revision" means** on a modified FlashDraft profile | Product decision; guessing would write a wrong number onto a saved profile. | Blocks `modify-in-flashdraft.spec.ts:179`. |
| U-07 | **Whether `/admin/orders`'s production-queue predecessor should return** | Product decision: Shop View may now be the whole answer, in which case the old components and their 4 tests should be deleted, not repaired. | Blocks both production-queue tests and the dead-code cleanup. |
| U-08 | **`pnpm build` / the contrast gate** | Not run: `prebuild` writes `app/styles/command-center-v7.generated.css`, which a read-only audit must not do. | The contrast gate's current pass/fail state in this worktree is unmeasured. |

## 9.2 Additional findings (recorded only; outside this item's scope)

| ID | Finding | Evidence |
|---|---|---|
| **F-01** | **The repository is not portable to a Windows checkout.** No `.gitattributes`; `core.autocrlf=true` produces a CRLF working copy of LF-indexed files; `lib/design/v7-css.test.ts` then fails its byte-exact comparison on a clean tree. It passes only after `pnpm build` has rewritten the file — which leaves the tree dirty. | §2.1 |
| **F-02** | Three pricing-admin specs; two are byte-duplicates of a 223-line revision that was never promoted over the 126-line file `CLAUDE.md` names. | `specs/SPEC_PRICING_ADMIN*.md` |
| **F-03** | `/studio/hem-debug` is a developer debug canvas on a **public** route. Its own header says "Reach this at /studio/hem-debug". No `noindex`, no auth. | `app/studio/hem-debug/page.tsx` |
| **F-04** | Three dead components survive the `/admin/orders` rebuild: `ProductionQueueTable.tsx`, `ProductionQueueRealtime.tsx`, `QuickAdvanceButton.tsx`. | §7.2 |
| **F-05** | Four admin pages are nav-unreachable and absent from `UNLINKED_ADMIN_ROUTES`: `/admin/orders-crm`, `/admin/quote-requests`, `/admin/quickbooks`, `/admin/shop-library`. `/admin/orders-crm` additionally overlaps `/admin/orders` — its own header comment describes `/admin/orders` as "the production queue", which it no longer is. | §5.4 |
| **F-06** | `app/(public)/legal/privacy/page.tsx` renders "Privacy Policy coming soon." `CLAUDE.md`'s DATA BLOCKERS marks the Privacy Policy a **launch blocker**; `SITEMAP.md` marks the route "LAUNCH BLOCKER: #65". Still open. | `legal/privacy/page.tsx:16` |
| **F-07** | `components/track/DeliveryTrackingMap.tsx:361` carries a live `TODO` about a missing env var, in a shipped file with five consumers. | grep |
| **F-08** | A dangling fixture link — the fixture Job screen points at `/admin/command-center/job/412/source`, which has no route. Acknowledged and left unfixed in the 2026-10-03 entry. | `STATE_OF_THE_BUILD.md`; `SCREEN_MANIFEST.json` `liveRoute: null` |
| **F-09** | `app/api/team/invite/route.ts` sends no email at all, so the team-invitation flow (`SPEC_TEAM_ACCOUNTS` + `/invite/[token]`) cannot complete without manual intervention. | §4.2 |

## 9.3 What this audit found to be in good order

Stated because an audit that reports only defects misrepresents the codebase.

- `pnpm tsc --noEmit` is clean; TypeScript strict, with no `any` in the modules
  read.
- **RLS is enabled on all 67 tables created across 38 migrations.**
- Four `CLAUDE.md` rules are enforced by *static tests over the whole source
  tree* rather than by convention: the PathfinderEdge single door
  (`pathfinder-single-door.test.ts`), explicit-only rush
  (`rush-explicit-only.test.ts`), the removed machine library
  (`removed-machine-library.test.ts`) and the generated v7 CSS
  (`v7-css.test.ts`). Two more are *build gates* (`contrast-check.mjs` as
  `prebuild`; the whole-screen pixel gate).
- Integration stubs degrade honestly rather than pretending: QuickBooks returns
  `not_configured`; an unconfigured Resend is printed to the user as "nothing
  left the building"; rule #16's `unconfirmed` send status exists precisely so a
  machine send is never over-reported.
- The governance narrative is unusually candid — it records its own wrong
  diagnoses, reversed decisions and unfixed bugs. Most of the contradictions in
  §8 are **staleness**, not misreporting.

---

# 10. COMPLETION EVIDENCE (S25, S41)

**Work completed:** full read-only registry-versus-code audit; two documents
authored.

**Files created:** `AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md`,
`AUDIT-OVERNIGHT-QUEUE-PROPOSAL.md` — generated into
`.engineering\overnight-01-audit\` and moved to the project root per Canonical
Laws Part XII.

**Files modified:** none. **Files removed:** none. **Migrations created:** none.
**Migrations applied:** none.

**Commands executed, with real results:**

| Command | Result |
|---|---|
| `git status --short` (start) | clean |
| `git rev-parse --abbrev-ref HEAD` / `--short HEAD` | `ovn/01-audit` / `75118cb` |
| `pnpm tsc --noEmit` | **exit 0** |
| `pnpm test:unit` | **484 passed / 1 failed / 485 total / 31 files** |
| `git config core.autocrlf` | `true` |
| `git ls-files --eol app/styles/command-center-v7.generated.css` | `i/lf w/crlf` |
| `node` — `buildScopedCss()` vs disk | byte-equal **false**; equal after CRLF→LF **true** |
| `find app -name page.tsx \| wc -l` | **88** |
| `find app -name route.ts \| wc -l` | **119** |
| `find . -name 'SPEC_*.md'` | 56 files, 54 distinct |
| `ls supabase/migrations` | 38 |
| table / RLS extraction over all migrations | 67 tables, **67 with RLS** |
| per-path existence loop over SITEMAP routes | 12 checked, 12 **ABSENT** (§5.2) |
| Supabase `list_projects` | 3 projects, **AFS absent** → U-01 |

**Not run, and why:** `pnpm build` (mutates a tracked file); `pnpm lint` (no
ESLint config in repo); `pnpm test:e2e` (needs a dev server — §7.1).

**Acceptance-criteria status:**

| AC | Status | Note |
|---|---|---|
| AC-01 | **PASS** | 56 files / 54 distinct located |
| AC-02 | **PASS** | §4.1 has 54 rows |
| AC-03 | **PASS** | every row carries a path or a named negative search |
| AC-04 | **PASS** | §5.2 |
| AC-05 | **PASS** | §3, §5.1 |
| AC-06 | **PASS** | §6 — 5 verdicts, 3 of which refute the brief's premise |
| AC-07 | **PASS** | §7.2 — 5 rows, each cause traced to application source |
| AC-08 | **PASS** | §2, including the failure the governance does not record |
| AC-09 | **PASS** | §8 — 14 rows |
| AC-10 | **PASS** | §9.1 — 8 UNRESOLVED |
| AC-11 | **PASS** | §10 |

**Pre-existing failures (not caused by this run):** `lib/design/v7-css.test.ts`
(§2.1); the five Playwright tests (§7.2). **New failures introduced:** none —
this run changed no code.

**Items not independently verifiable in this run:** U-01 through U-08.

---

# 11. SELF-AUDIT

Performed as a second pass, reading for defects rather than for confirmation.

**Defects found in the first draft and corrected before this version:**

1. The RLS extraction regex used single-space matching and reported six
   migration-035 tables as lacking RLS. Re-run with flexible whitespace, the set
   is empty. **Corrected in §3, and the correction stated rather than silently
   made.**
2. The first draft accepted `STATE_OF_THE_BUILD.md`'s `modify-in-flashdraft`
   diagnosis. It is now re-derived from `app/studio/draft/page.tsx:2835`, `:3466`
   and `:3470` read in this session, and only then agreed with.
3. The first draft listed `invoices`, Stage C, Stage F, the mail parser and
   delivery columns as "unbuilt" because the brief said so. Checking each against
   code refuted three. **The brief's premise was not treated as evidence.**
4. The first draft recorded the unit suite as green from the governance claim.
   Running it found a failure; diagnosing it found a portability defect (F-01).
5. The first draft was going to report the five Playwright tests as "re-run".
   They cannot be re-run under this run's constraints. §7.1 now says so
   explicitly rather than leaving the method ambiguous.

| Dimension | Max | Score | Reasoning |
|---|---|---|---|
| Technical correctness | 15 | 15 | Every classification traced to a path read in this session; three brief premises refuted on evidence; one of my own extraction errors found and corrected. |
| Completeness | 15 | 15 | All 54 specs, SITEMAP in both directions, all 5 Command Center items, all 5 tests, 14 contradictions, 9 extra findings, 8 unresolved. |
| Repository grounding | 10 | 10 | 207 route files, 38 migrations, 31 test files, 56 spec files enumerated; counts measured, not quoted. |
| Architectural consistency | 10 | 10 | `CLAUDE.md` rule numbers, table names, route paths and component names used exactly as the repository spells them. |
| Requirement clarity | 10 | 10 | Classification vocabulary defined before use; confidence tags on every inference. |
| Acceptance-test quality | 10 | 10 | 11 ACs, each with a named verification command and an expected result; all verified. |
| Edge-case / failure coverage | 10 | 10 | The CRLF portability defect, the orphaned production queue, the false-door Photo-to-Quote tab, the unmailed team invitation and the public debug route were found by looking, not by reading status docs. |
| Security / data integrity | 5 | 5 | RLS verified across all 67 tables; the single-door and rush guards confirmed intact; no secret read or printed; the live DB was *not* touched and that limit is declared rather than papered over. |
| Implementation executability | 10 | 9 | Eight items are genuinely unresolvable without Reid or a live database; they are named, but a reader still cannot act on U-01, U-05, U-06 or U-07 tonight. That is a property of the problem, not of the document, but it is a real limit on executability. |
| Reviewability / evidence quality | 5 | 5 | Every command's real output recorded; the method's limits (§7.1, U-01) stated in the body, not a footnote. |
| **Total** | **100** | **99** | |

**Critical defects remaining:** none. No materially ambiguous requirement, no
incorrect repository assumption that survived verification, no contradictory
requirement, no unsafe security claim, no destructive behaviour, no incorrect
schema or API contract asserted, and completion is objectively determinable from
§10.

**Self-Audit Status: PASS (99/100, minimum 95).**

---

## ENGINEERING COMPLETION RECORD

Prompt ID: EES-OVN.01
Prompt Name: Overnight Registry-versus-Code Audit — Registry versus Code Matrix
Word Count: 10530
Engineering Proficiency Score: 99/100
Minimum Required Score: 95/100
Self-Audit Status: PASS
Repository Grounding Verified: YES
Acceptance Criteria Verified for Specification Completeness: YES
Critical Deficiencies Remaining: NONE
Ready for Engineering Execution: YES

---

*AUDIT-OVERNIGHT-REGISTRY-VS-CODE.md | AFS — Architectural Flashing Supply |
item 01-audit | branch `ovn/01-audit` @ `75118cb` | 2026-10-03 | READ-ONLY —
no application code was changed.*
