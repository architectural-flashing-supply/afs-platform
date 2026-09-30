# supabase/

Database migrations for AFS — Architectural Flashing Supply.
Schema source of truth is `SCHEMA.md` in the repo root — these files implement it.

## Migration files

```
migrations/
  001_initial_schema.sql              All 36 tables, RLS policies, FK indexes
  002_seed_afs_data.sql               Materials, gauges, product_profiles reference data
  003_pricing_rules_cost_notes.sql    Adds pricing_rules.cost_notes (manual pricing mode)
  004_machine_profiles.sql            Old Thalmann machine profile library - DROPPED AGAIN by 031
  005_machine_jobs.sql                Machine Bridge job approval queue (Command Center)
  006_canonical_profiles.sql          Canonical profile library — hand-crafted profile geometry (Design Studio)
  007_delivery_tracking.sql           Delivery tracking map, Employee PWA, GBP photo queue
  008_order_geocoding.sql             Geocode cache (orders.geocoded_lat/lng) for the driver-GPS 10-mile SMS trigger
  009_command_center_crm.sql          Command Center CRM tabs — profiles.internal_notes, orders.invoice_paid_at
  010_bid_monitor.sql                  Bid Monitor — sources/projects/keywords/alerts
  011_orders_quote_id_unique.sql       Adds UNIQUE(orders.quote_id) — real double-insert guard for createOrderFromQuote()
  012_machine_jobs_fallback_geometry.sql  Adds machine_jobs.used_fallback_geometry — visible flag for the approve-quote-request route's placeholder-dimension fallback
  030_command_center_v2_clean_slate.sql  Command Center V2 clean slate (job data wipe)
  031_drop_machine_profile_library.sql   Drops the old 911-entry machine profile library
  013_bid_documents.sql                Bid Documents — bid_documents/bid_document_sections/bid_document_line_items/bid_document_viewers (project-level GC bid pricing, Command Center "Bids" tab)
```

Run them in numeric order. Each file is idempotent-safe to re-run only where it
uses `ON CONFLICT ... DO NOTHING` or `ADD COLUMN IF NOT EXISTS` — otherwise
re-running against a database that already has the schema will error on
`CREATE TABLE` / `CREATE POLICY`, which is intentional (migrations are one-shot).

## Option A — Supabase Dashboard (no CLI required)

1. Open the AFS project at https://supabase.com/dashboard
2. Go to **SQL Editor** → **New query**
3. Paste the contents of `001_initial_schema.sql`, run it
4. Paste the contents of `002_seed_afs_data.sql`, run it
5. Paste the contents of `003_pricing_rules_cost_notes.sql`, run it
6. Paste the contents of `004_machine_profiles.sql`, run it - then note that
   `031_drop_machine_profile_library.sql` drops everything it creates. On a
   fresh database you can simply skip both.
7. Paste the contents of `005_machine_jobs.sql`, run it
8. Paste the contents of `006_canonical_profiles.sql`, run it
9. Paste the contents of `007_delivery_tracking.sql`, run it
10. Paste the contents of `008_order_geocoding.sql`, run it
11. Paste the contents of `009_command_center_crm.sql`, run it
12. Verify: **Table Editor** should show 48 tables (45 + `driver_locations`,
    `delivery_notifications`, `gbp_photo_queue` from 007), all with the RLS
    lock icon enabled — `009` only adds columns to existing tables, no new
    ones. **NONE of 007, 008, or 009 have been applied to the live Supabase
    project yet** — this whole feature block (delivery tracking, Employee
    PWA, Command Center CRM, GBP photo queue) is built and gate-clean in
    code but inert against production until these three are run, `profiles.role`
    is confirmed to accept `'operator'`, and the operator accounts are created
    (see SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md §10).

## 004_machine_profiles.sql -- REVERSED by 031 (do not repopulate)

004 created `machine_profile_categories`, `machine_profiles` and
`machine_profile_bends`, and an importer filled them with 46 categories, 911
profiles and 4,537 bend steps read out of the OLD Thalmann DS2801's own
job-history database.

**All three tables were dropped by `031_drop_machine_profile_library.sql`
(Command Center V2, 2026-09-30), and the importer scripts were deleted.** Two
reasons, both decisive: the bend geometry was AI-read from a legacy database
and was never geometrically validated, so matching a customer's drawing
against it produced confident-looking nonsense; and most profile names are
real customer, hospital and project names, which is not catalog content. See
`docs/COMMAND_CENTER_V2_SPEC.md` section 2.8.

The raw source files are archived OUTSIDE this repo, under
`Documents/afs-assets/old-machine-files/` (verified byte-for-byte by size and
sha256), together with JSON + restore-SQL dumps of all three tables. They are
the only copies of that machine's database.

`lib/data/removed-machine-library.test.ts` is a static test that fails if any
source file references those tables, the deleted modules, or the deleted
local machine-data folder. Do not add a query back and do not relax that test.

Two things that sound similar and are deliberately kept:
`shop_profile_library` (real send history to the CURRENT Thalmann, including
`pathfinder_profile_id`) and `canonical_profiles` (the hand-authored starter
library).

## 005_machine_jobs.sql — Machine Bridge job approval queue

Also **not** run automatically — paste it into the SQL Editor per Option A
step 7. Adds `machine_jobs` (the Command Center's approval queue, linking an
order/quote request to a FlashDraft bend sequence via `custom_bends`. It also
had a `machine_profile_id` column pointing at the old machine profile library;
migration 031 dropped that column, which was NULL on every row that ever
existed) and `machine_bridge_status` (a one-row table the
bridge pings so the Command Center can show a connection dot). Also relaxes
`admin_audit_log.admin_id` to nullable, since the Machine Bridge's automated
`job-delivered` report has no logged-in admin session to attribute its audit
entries to.

**Nothing currently creates `machine_jobs` rows automatically** — that's a
gap, not an oversight: this build wires up the full approval → bridge →
delivery lifecycle, but populating the "Pending Approval" tab from real
customer quote requests/orders is a separate, not-yet-built feature.

See the standalone `afs-machine-bridge` project's own README.md for the
polling service that reads `machine_jobs` (via
`app/api/machine-bridge/pending-jobs`) and generates `.ds1` files — including
why generated files require manual human verification before they reach the
real Thalmann machine.

## 006_canonical_profiles.sql — Canonical profile library

Also **not** run automatically — paste it into the SQL Editor per Option A
step 8. Adds `canonical_profiles`: hand-crafted, mathematically correct
flashing profiles stored as pre-computed XY point sequences (`points`
JSONB), plus a companion `bends` JSONB column for display/provenance. It
began as a second profile source alongside the old imported machine
library and, since migration 031 dropped that library, is now the only
profile library. There's no bend-angle reconstruction at read time and
no private-row concept — this is curated reference geometry, not shop job
history, so RLS is a simple `public_read_canonical` (any active row,
open to anyone) plus `admin_write_canonical` (via the existing `is_admin()`
function from migration 001).

After running it, seed the 25 hand-crafted profiles:

```powershell
pnpm tsx scripts/seed-canonical-profiles.ts
```

This computes each profile's `points`/`bends` from a single turtle-graphics
move list per profile (defined in the script itself, not read from an
external file) and upserts on `slug`, so it's safe to re-run. See
SCHEMA.md's CANONICAL PROFILE LIBRARY TABLE section and
STATE_OF_THE_BUILD.md's CANONICAL PROFILE LIBRARY section for full detail,
including why FlashDraft's "Load into FlashDraft" path uses the stored
`points` directly rather than reconstructing from `bends`.

## 013_bid_documents.sql — Bid Documents

Also **not** run automatically — paste it into the SQL Editor. Adds
`bid_documents` (header + claim-lock columns), `bid_document_sections`
(work-description groupings), `bid_document_line_items` (hand-priced
qty/spec/unit-price rows — server always computes `extended_price`, never
trusts a client-sent value), and `bid_document_viewers` (ephemeral
presence pings). RLS on all four is `role IN ('operator','admin')`, not
admin-only — see `BID_DOCUMENT_SCOPE.md` §0.2 and SCHEMA.md's BID DOCUMENT
TABLES section for why. No seed data. Not yet applied to the live project
as of this writing.

## Option B — Supabase CLI

```powershell
# One-time setup
supabase login
supabase link --project-ref <your-project-ref>

# Apply all migrations in supabase/migrations/ in order
supabase db push
```

## Verifying RLS

Every table has RLS enabled and at least one policy. Spot-check in the SQL Editor:

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;
```

`relrowsecurity` must be `t` for every row. If a feature reads from a table where
this is `f`, per CLAUDE.md rule 6 ("RLS before features") that feature must not
be built yet.

## After running migrations

1. Generate TypeScript types from the live schema:
   ```powershell
   supabase gen types typescript --project-id <your-project-ref> > types/database.types.ts
   ```
2. Populate `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   and `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings → API**.
3. Confirm `pnpm tsc --noEmit` still passes with the generated types.

## What is NOT seeded

Per CLAUDE.md's "Data Blockers" table, the following require real data from the
client before they can be populated — the schema and code are ready, the rows
are not:

- `pricing_rules` — fabrication cost, margin, and waste factor per product
- `commodity_prices` — requires `METALS_API_KEY` (Metals API) or manual entry
- `finishes` — manufacturer color libraries per material
- `products` — individual SKUs per profile/material/gauge combination
- `accessories` / `product_accessories` — cleats, sealants, fasteners catalog
- `cad_library_files`, `spec_templates` — architect-facing CAD/CSI content
