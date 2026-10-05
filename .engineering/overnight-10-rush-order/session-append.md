
---

## 2026-10-03 — ovn 10-rush-order (branch `ovn/10-rush-order`, worktree)

**SPEC_RUSH_ORDER.md. Built the mechanism, built none of the numbers.**
Full detail in STATE_OF_THE_BUILD.md's 2026-10-03 entry; the schema in
SCHEMA.md's; the contract in `EES-OVN.10-RUSH-ORDER.md`.
**UNVERIFIED pending Reid's own confirmation in a browser.**

### Baseline, measured before any edit

| | |
|---|---|
| working tree | clean |
| `pnpm tsc --noEmit` | exit 0 |
| `pnpm test:unit` | **484 passed, 1 failed** (31 files) |
| `node scripts/audit/contrast-check.mjs` | PASS — 24 screens, 248 pairs, 0 unresolved, 0 below |

**The 1 failing test was already failing on a clean tree** and is still
failing: `lib/design/v7-css.test.ts`. It is **not** stale CSS — see the
compliance report below.

### Final gates

| | |
|---|---|
| `pnpm tsc --noEmit` | exit 0, zero errors |
| `pnpm test:unit` | **580 passed, 1 failed** (32 files) — the same one, no new failure |
| `pnpm build` | exit 0, with the full `prebuild` chain (`css:v7` + contrast) |
| contrast gate | PASS — **25 screens · 261 pairs · 0 unresolved · 0 below** |
| `playwright tests/e2e/rush-order.spec.ts` | **9 passed** |

New tests: `lib/delivery/business-days.test.ts` 43 (was 21), 
`lib/pricing/rush-policy.test.ts` 76, `tests/e2e/rush-order.spec.ts` 9.
**Net +96 unit tests, +9 e2e, and no test anywhere was skipped, weakened or
deleted.**

### COMPLIANCE REPORT — violations found, and what happened to each

**1. A badge assertion that was confidently wrong.** The first version of
`rush-order.spec.ts` asserted the Workbench rush pill as the literal text
`Rush`, sourced from `components/admin/WorkbenchLanes.tsx:234`. It FAILED.
`/admin/command-center` mounts `V7Workbench` in **live mode as well as fixture
mode**, fed by `lib/data/v7-view/from-live.ts:135`, whose pill text is `'RUSH'`;
`WorkbenchLanes` is not what that route renders. **Fixed at the root** — the
assertion now matches case-insensitively, because what this item requires is
that the badge is visible, not its casing — and the mistake is recorded in the
file's own comment so the next reader does not repeat it. *This is also a
caution about `RUSH_ORDER_AUDIT.md`: it cites `WorkbenchLanes` and friends from
July, and the v7 port has moved what is mounted where.*

**2. `appendLedger` does not throw, and the route was written as though it
did.** `app/api/admin/rush-policy/route.ts` had a `try/catch` around it. The
function returns `{ ok, count, error }` and handles its own failure
(`lib/pricing/ledger.ts:190`), so the catch was dead code that would never fire
and the ledger's real failure would have gone unreported. **Fixed at the root**
by reading the returned `.ok` — so a ledger failure now produces the sentence
*"the policy itself is saved"* instead of silence or a misleading 500.

**3. Two parsers were stranded where they could not be tested.**
`parsePercentToBasisPoints` and `parseLeadDays` were first written inside
`components/admin/RushPolicyEditor.tsx`. `vitest.config.mts` collects only
`lib/**/*.test.ts`, so a parser in a `.tsx` is a parser nobody can check.
**Moved into `lib/pricing/rush-policy.ts`** — the same reasoning that put
`parseDollarsToCents` in `quote-math.ts` — and they now carry 10 tests,
including the two that matter: an empty box is `null` and a typed `0` is `0`.

**4. A hydration mismatch, caught before it shipped.** The Quote Builder's date
picker needs a `min` of today. Computing that in the render body or in a
`useState` initialiser runs it once on the server (UTC) and again in the browser
(the customer's zone), and the two can disagree by a day — React reports that as
a hydration mismatch. **Moved into a `useEffect`**: the bound arrives one tick
late, which is invisible on a convenience bound and cannot be wrong.

**5. Nothing was weakened to make anything pass.** No threshold relaxed, no
skip list added, no assertion loosened, no `any` introduced, no `@ts-ignore`,
no test skipped. The contrast gate's `0 unresolved` is unchanged and its screen
count went **up** by one, because `/admin/settings/rush-policy` came under it
automatically — which is rule #28 working as designed.

### THE PRE-EXISTING FAILURE, DIAGNOSED RATHER THAN INHERITED

`lib/design/v7-css.test.ts` reports *"app/styles/command-center-v7.generated.css
is stale. Run `pnpm css:v7`"*. **It is not stale.** Running `pnpm css:v7`
produces a file whose `git diff` is **empty** — byte-identical content, only the
line endings differ. The committed file carries **1081 CRLF and 0 LF-only**
endings, this worktree has `core.autocrlf=true`, and the generator emits LF, so
the test's exact string comparison cannot pass on Windows with that setting.

**Left untouched on purpose.** Fixing it means editing a v7 artefact, adding a
`.gitattributes` rule, or changing the test — all three outside this item, and
the run's hard rules forbid touching v7 artefacts. The regenerated file was
reverted (`git checkout --`) after `pnpm build` wrote it, so the commit contains
no v7 change at all. **Recorded as an unrelated finding, not absorbed.**

### HARD RULES, EACH CHECKED AGAINST `git diff --name-only`

`middleware.ts` **not touched**. `docs/design/command-center-v7/**` **not
touched**. `components/admin/v7/**` **not touched**.
`app/styles/command-center-v7.generated.css` **not touched**.
`SCREEN_MANIFEST.json` **not touched**. `tests/visual/**` **not touched**.
No deploy, no merge, no push to `main`. **No migration applied** — verified by
query: `to_regclass('public.rush_policies')` is **NULL** on the live project.
No real email, SMS or charge: `RESEND_API_KEY` is absent from this
environment's `.env.local` **and** every e2e job name carries the reserved
`E2E-TEST-` prefix, so `lib/email/outbound.ts` captures rather than sends. No
secret was read, printed or copied — the one env check performed listed **key
names only**.

### CLEANUP, PROVEN RATHER THAN ASSERTED

`rush-order.spec.ts` deletes every job it creates and then reads the table back:
`select count(*) from quote_requests where job_name like 'E2E-TEST-RUSH-ORDER%'`
returns **0**. Independently re-checked after the run: **0**.

### SCOPE DISCIPLINE

Five things were deliberately **not** done and are listed as PENDING REID in
STATE_OF_THE_BUILD.md: the surcharge figure and lead time themselves (checklist
#36 / #32); whether a too-soon date should refuse rather than warn;
`pricing_rules.rush_surcharge_pct`'s seeded, unread `DEFAULT 0.25`; the two
Settings sub-pages missing from `LIGHT_WORKING_AREA_SCREENS`; and three
remaining SPEC_RUSH_ORDER.md items (the admin rush notification email, the
`StatusAdvancer` banner, a rush-only queue filter). Two unrelated findings are
recorded there too — the CRLF test above, and the intake route storing
`requestedDelivery` into a `DATE` column with no format validation.
