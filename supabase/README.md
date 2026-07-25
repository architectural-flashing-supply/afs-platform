# supabase/

Database migrations for AFS — Architectural Flashing Supply.
Schema source of truth is `SCHEMA.md` in the repo root — these files implement it.

## Migration files

```
migrations/
  001_initial_schema.sql              All 36 tables, RLS policies, FK indexes
  002_seed_afs_data.sql               Materials, gauges, product_profiles reference data
  003_pricing_rules_cost_notes.sql    Adds pricing_rules.cost_notes (manual pricing mode)
  004_machine_profiles.sql            Thalmann DS2801 machine profile library (Design Studio)
  005_machine_jobs.sql                Machine Bridge job approval queue (Command Center)
  006_canonical_profiles.sql          Canonical profile library — hand-crafted profile geometry (Design Studio)
  007_delivery_tracking.sql           Delivery tracking map, Employee PWA, GBP photo queue
  008_order_geocoding.sql             Geocode cache (orders.geocoded_lat/lng) for the driver-GPS 10-mile SMS trigger
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
6. Paste the contents of `004_machine_profiles.sql`, run it
7. Paste the contents of `005_machine_jobs.sql`, run it
8. Paste the contents of `006_canonical_profiles.sql`, run it
9. Paste the contents of `007_delivery_tracking.sql`, run it
10. Paste the contents of `008_order_geocoding.sql`, run it
11. Verify: **Table Editor** should show 45 tables, all with the RLS lock icon enabled

## 004_machine_profiles.sql — Design Studio machine profile library

This migration was **not** run automatically — paste it into the SQL Editor
yourself per Option A step 6 above, or apply it via `supabase db push` (Option
B) once you've reviewed it. It adds three tables (`machine_profile_categories`,
`machine_profiles`, `machine_profile_bends`) that back the Design Studio /
FlashDraft profile-matching feature.

After running it, populate the tables from the Thalmann DS2801 bending
machine's own database:

```powershell
pnpm run import:machine-profiles
```

This reads `machine-data/ds2801db.bdb` (a Microsoft Jet/Access database — the
script uses the `mdb-reader` npm package rather than the system `mdbtools`
CLI, since this repo's dev environment has no apt-get/mdbtools available),
translates German category and profile names to English trade terminology,
and upserts everything via the Supabase service role client (`.env.local`
must have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set — the
script loads `.env.local` itself, no extra flags needed). It's safe to re-run;
every table has a natural-key unique constraint the script upserts against.

**Read before running:** the source database is the shop's actual job
history, not a clean generic catalog — most category and profile names are
real customer/project names. Only categories 23 (Rheinzink-Profile) and 42-61
(the numbered "00"-"19" series) are imported as `is_public = true`; everything
else is imported `is_public = false` for admin/internal reference only. Within
those public categories, any individual profile whose name doesn't resolve to
a recognized generic term is also forced private as a safety net. See the
comments at the top of `scripts/import-machine-profiles.ts` and the
`004_machine_profiles.sql` migration for the full reasoning.

## 005_machine_jobs.sql — Machine Bridge job approval queue

Also **not** run automatically — paste it into the SQL Editor per Option A
step 7. Adds `machine_jobs` (the Command Center's approval queue, linking an
order/quote request to either a `machine_profiles` library entry or a custom
FlashDraft bend sequence) and `machine_bridge_status` (a one-row table the
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
step 8. Adds `canonical_profiles`: a second, independent profile source
alongside `machine_profiles` — hand-crafted, mathematically correct
flashing profiles stored as pre-computed XY point sequences (`points`
JSONB), plus a companion `bends` JSONB column for display/provenance. Unlike
`machine_profiles`, there's no bend-angle reconstruction at read time and
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
