
---

# 2026-10-03 — ovn 10-rush-order: THE RUSH POLICY (migration 039, NOT APPLIED)

**MIGRATION FILE WRITTEN, NOT RUN.** `supabase/migrations/` now holds 39 files
and the highest is `039_rush_policy.sql`. It has **not** been applied to the
live database, and that was verified rather than assumed:
`select to_regclass('public.rush_policies') is not null` returns **false** on
the project `.env.local` points at, as of this entry. Every section of this
document describing an existing table therefore remains current, and
`rush_policies` below documents a table that exists only as a file until
somebody applies it.

**Nothing else in the database changed.** No existing table, column,
constraint, index, policy, trigger, view or grant was added, altered or
dropped by this item. In particular `quote_requests` is untouched — `is_rush`,
`rush_source`, `rush_set_by`, `rush_set_at` and `requested_delivery` are all
exactly as TABLE 15 and migration 034 already describe them, and the two
columns this item started WRITING for the first time —
`quotes.rush_surcharge` (migration 001, `DECIMAL(10,2) NOT NULL DEFAULT 0`)
and `quote_requests.requested_delivery` (migration 001, `DATE`) — already
existed.

### TABLE — rush_policies (NEW, migration 039, NOT YET APPLIED)

What a rush job costs, and the shortest notice AFS will take for one.
**Admin-only. A customer can never read it** — a rush rate a customer could
look up is a price before the formal quote, which the business model forbids.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `DEFAULT gen_random_uuid()` |
| `name` | `text NOT NULL` | What Steve calls this policy. Shown on the admin screen and in both history records. |
| `surcharge_type` | `text NOT NULL` | `percent` \| `flat` \| `per_piece` \| `none`. **No `inferred` and no `auto`**, for the same reason `rush_source` has no third value. |
| `surcharge_percent_bp` | `integer` | **Basis points.** 250 = 2.50%. Required for `percent`, refused otherwise. |
| `surcharge_cents` | `bigint` | **Cents.** Required for `flat` and `per_piece`, refused otherwise. |
| `minimum_lead_time_days` | `integer` | **BUSINESS days**, not calendar days. `NULL` = not set, and is never read as 0. |
| `effective_from` | `date NOT NULL` | A policy dated in the future is not in force today. |
| `note` | `text` | Why it changed. |
| `created_by` | `uuid REFERENCES profiles(id)` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | Also the same-day tiebreak — see below. |

**Five CHECK constraints, each one a sentence the database enforces:**

```
rush_policies_surcharge_type_check    surcharge_type IN ('percent','flat','per_piece','none')
rush_policies_value_matches_type      none      -> both value columns NULL
                                      percent   -> surcharge_percent_bp NOT NULL, surcharge_cents NULL
                                      flat |
                                      per_piece -> surcharge_cents NOT NULL, surcharge_percent_bp NULL
rush_policies_percent_range           surcharge_percent_bp IS NULL OR BETWEEN 0 AND 100000
rush_policies_cents_non_negative      surcharge_cents      IS NULL OR >= 0
rush_policies_lead_time_range         minimum_lead_time_days IS NULL OR BETWEEN 0 AND 365
```

**`rush_policies_value_matches_type` is the load-bearing one.** Without it a
`percent` row with a NULL percentage is storable, and everything reading it
then has to choose between refusing to quote forever and treating the blank as
nought. Refusing the shape at the door is better than both. The other half —
a `flat` row also carrying a stray percentage — would be a row with two
answers in it.

**`rush_policies_percent_range`'s upper bound is a TYPO GUARD, not a business
opinion.** 100000 bp is 1000%, so `2500` typed where `25` was meant is
accepted as 25% and nobody is second-guessed, while `250000` — a decimal point
lost twice — is refused. The bound is declared once, as
`MAX_RUSH_PERCENT_BP` in `lib/pricing/rush-policy.ts`, and the API route reads
it from there, so a value the route accepts can never be one the database
refuses.

**NO `UNIQUE (effective_from)`, deliberately unlike
`price_book_versions_item_effective_key`.** Two rows may share a start date and
the later-written one wins, because this table is append-only and correcting a
figure entered wrongly this morning has no other route. That is also what makes
the `created_at` tiebreak inside `versionInForce`
(`lib/pricing/price-book.ts`) **load-bearing here rather than decorative** — on
`price_book_versions` that branch is unreachable, because the UNIQUE constraint
refuses the second same-day row before the resolver ever sees it.

**Index:** `idx_rush_policies_effective_from ON (effective_from DESC, created_at DESC)`
— the order the admin screen's history reads and the resolver's own sort.

**APPEND-ONLY, reusing migration 035's `afs_append_only()` UNCHANGED.**
That function is already column-agnostic (it reads
`to_jsonb(OLD) ->> 'test_tag'`, not `OLD.test_tag`, for the 42703 reason 035
records). `rush_policies` has **no `test_tag` column**, so the expression is
always NULL here and the function's one escape hatch cannot fire: every UPDATE
and every DELETE is refused, including from the service role and the table
owner. Same treatment `price_book_versions` gets, and for the same reason — a
quote already sent must not have its surcharge changed underneath it.

**RLS:** enabled, with exactly one policy —
`admin_all_rush_policies FOR ALL USING (is_admin())`. **There is no customer
policy of any kind and must not be one.**

**NO `company_id`, and the reason is in the file.** This is AFS back-office
configuration, exactly like `price_book_items`, which also has none. A
`company_id` here would imply per-contractor rush pricing — a business decision
nobody has asked for, and not one a schema should invent. The Six Laws'
`company_id` requirement is about customer-scoped data; this row belongs to the
shop.

**SHIPPED EMPTY.** Zero seed rows, zero INSERTs in the file, and no `DEFAULT`
on `surcharge_type`'s value columns or on `minimum_lead_time_days`. The
surcharge percentage (checklist #36) and the rush definition and timing (#32)
are Steve's decisions and are not in the data; a `DEFAULT 0` would be a price,
and a made-up one. `lib/pricing/rush-policy.ts` reports an empty table as
**unpriced** rather than as nought, and `evaluateRushSurcharge` is unit-tested
over a grid of subtotals and piece counts to prove it adds exactly 0 cents —
so applying this migration cannot change the value of a single existing quote.

**DOWN SQL** (for a rollback; never needed for a forward deploy, since this
migration only adds):

```sql
DROP TRIGGER IF EXISTS rush_policies_append_only ON rush_policies;
DROP POLICY  IF EXISTS admin_all_rush_policies   ON rush_policies;
DROP INDEX   IF EXISTS idx_rush_policies_effective_from;
DROP TABLE   IF EXISTS rush_policies;
```

`afs_append_only()` is deliberately NOT dropped by that: migration 035 owns it
and `price_book_versions` and `pricing_ledger` still need it.

### Two EXISTING columns that started being written for the first time

Neither needed a migration; both have existed since `001_initial_schema.sql`.

**`quotes.rush_surcharge`** (`DECIMAL(10,2) NOT NULL DEFAULT 0`, line 479) was
hardcoded to `0` by `lib/quotes/issue.ts` on every quote ever issued. It now
carries the real figure in dollars, and three screens that already displayed it
when non-zero light up as a result: the customer's own quote in their portal
(`app/account/quotes/[id]/page.tsx`), the admin order detail, and the invoice
PDF (`lib/utils/invoice-pdf.ts`).

**`quotes.subtotal_cents` stays the LINES and `quotes.total_cents` now carries
the surcharge.** Their DIFFERENCE is the rush fee, which is precisely why
`invoices` needs **no rush column**: `createInvoiceFromQuote` still copies
`subtotal_cents` and `total_cents` verbatim and recomputes nothing, so the
invoice's own difference carries the same figure, and the row it prints is read
from the quote's `rush_surcharge` rather than worked out again from a policy
that may have moved since.

**`quote_requests.requested_delivery`** (`DATE`, line 441) was already written
by the intake route and already read by `approve-quote-request` to seed
`machine_jobs.due_date`. The Quote Builder now collects it too, so the one
surface with the rush toggle finally has the date beside it. **It is still not
a rush signal**: `is_rush` is set by the customer's checkbox or an admin's
toggle and by nothing else, which migration 034's
`quote_requests_rush_needs_explicit_source` CHECK and
`lib/data/rush-explicit-only.test.ts` both continue to enforce, unmodified.

### Verified read-only against the live database before relying on it

Each of these was queried rather than assumed, because migration 039 and the
new API route depend on all of them:

| Dependency | Found |
|---|---|
| `afs_append_only()` | yes |
| `is_admin()` | yes |
| `gen_random_uuid()` | yes |
| `public.profiles` | yes |
| `pricing_ledger_event_type_check` permits `price_book_change` | yes |
| `quote_requests.requested_delivery` | yes |
| `admin_audit_log.resource_type` has no CHECK (so `'rush_policy'` is storable) | yes |
| `public.rush_policies` | **no — correctly unapplied** |
