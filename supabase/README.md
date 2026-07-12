# supabase/

Database migrations for AFS — Architectural Flashing Supply.
Schema source of truth is `SCHEMA.md` in the repo root — these files implement it.

## Migration files

```
migrations/
  001_initial_schema.sql              All 36 tables, RLS policies, FK indexes
  002_seed_afs_data.sql               Materials, gauges, product_profiles reference data
  003_pricing_rules_cost_notes.sql    Adds pricing_rules.cost_notes (manual pricing mode)
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
6. Verify: **Table Editor** should show 36 tables, all with the RLS lock icon enabled

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
