# CADLIB_AUDIT.md
## Audit of `/architects/cad-library` — real code vs. placeholder vs. data blocker

**Scope:** `app/(public)/architects/cad-library/page.tsx`,
`components/architects/CADFileCard.tsx`,
`components/architects/CADLibraryBrowser.tsx`, `app/api/documents/download/route.ts`,
`specs/SPEC_CAD_BIM_LIBRARY.md`, `supabase/migrations/001_initial_schema.sql`,
`supabase/README.md`.

---

## Verdict, up front

**The code is real. The content is not, and that is a genuine DATA BLOCKER,
not a code gap.** This is a different situation from `/admin/cad-library`
(SITEMAP.md / afs-048's changelog note referenced in the task) — that admin
route was *documented but never built* and its nav link was removed. The
customer-facing `/architects/cad-library` route, by contrast, **was built**:
it is wired end-to-end against live Supabase tables and a real signed-URL
download flow. It has zero rows to display because no CAD files have been
received from the client, and it correctly falls back to `EmptyState` in
that case rather than faking content.

---

## What's real

**`app/(public)/architects/cad-library/page.tsx`** — a real server component,
not a stub:
- Queries `product_profiles` (`is_active = true`) for filter options — live table.
- Queries `cad_library_files` joined to `product_profiles(id, name)` — live table, live join, `.eq('is_active', true)`.
- Queries `products` joined to `materials(name)` to build a profile→materials map for the material filter — live table.
- Maps real rows into a typed `CADFile[]` (no mock array, no hardcoded sample files).
- Conditionally renders `EmptyState` when `files.length === 0`, or `CADLibraryBrowser` when files exist. This is correct, honest handling of an empty real dataset — not a placeholder standing in for missing functionality.
- `isAuthenticated={Boolean(user)}` is threaded through from a real `supabase.auth.getUser()` call, driving the sign-in-gated download button.

**`components/architects/CADFileCard.tsx`** — fully implemented, not a shell:
- Renders real per-file metadata (format badge, Revit version, file size formatted from real bytes, version, live `downloadCount`).
- `handleDownload()` calls the real `/api/documents/download` route with the file's real `id`, opens the returned signed URL in a new tab.
- Unauthenticated users see a real sign-in/create-account prompt (`/login?redirect=/architects/cad-library`, `/register`), not a dead button.
- Error state is real (failed fetch → user-visible message), not swallowed.

**`components/architects/CADLibraryBrowser.tsx`** — fully implemented:
- Real client-side filtering by profile, format (with `rfa`/`rvt` correctly grouped under "Revit"), and material, all driven by the real props passed down from the page.
- `ProductFilterPanel` integration mirrors the same filter-panel pattern used elsewhere in the product catalog — not a one-off mock.
- `hasRevitFiles` (derived from real data) correctly drives the "Revit Families — Coming Soon" note per `SPEC_CAD_BIM_LIBRARY.md`'s explicit instruction for when no Revit families exist.

**`app/api/documents/download/route.ts`** — fully implemented, not a stub:
- Requires a real authenticated session (401 if not).
- Looks up the requested file in `cad_library_files` (`is_active = true`) via the real Supabase client.
- Generates a real signed URL from the **`cad-library` Supabase Storage bucket** via `createAdminClient().storage.from('cad-library').createSignedUrl(...)`, 15-minute TTL.
- Logs the download to `cad_download_log` and increments `cad_library_files.download_count` — both real writes.
- This is a distinct, correctly-scoped route from `/api/documents/[id]/download` (vault documents), per its own comment.

**Schema** — `cad_library_files` and `cad_download_log` are real tables
defined in `supabase/migrations/001_initial_schema.sql` (TABLE 25), with RLS:
authenticated read of active rows, admin-only write. Per `supabase/README.md`'s
current apply-status note (only migrations 007–009 are called out as not yet
applied to the live project), migration 001 — and therefore these two tables —
appears to be live. Note this is a step ahead of what `SCHEMA.md` itself says
(it's dated 2026-07-13 and claims 001–003 are *not* applied); `supabase/README.md`
is the more current source here and should be trusted over `SCHEMA.md` for
apply status, but neither document was confirmed against the live database
console/API for this audit — if it matters for a decision, verify directly in
the Supabase dashboard rather than trusting either doc.

---

## What's placeholder / missing

**Nothing in the code is placeholder.** The only gap is content:

- **Zero rows in `cad_library_files`.** `supabase/README.md`'s "What is NOT
  seeded" section explicitly lists `cad_library_files, spec_templates —
  architect-facing CAD/CSI content` alongside `pricing_rules`, `commodity_prices`,
  `finishes`, `products`, `accessories` — all acknowledged, intentional gaps
  tied to data not yet received from the client, exactly parallel to how
  `SPEC_CAD_BIM_LIBRARY.md` describes the empty state as the expected v1
  behavior ("CAD library being populated... Request specific details via
  consultation").
- **No `cad-library` Storage bucket provisioned anywhere in the repo.** There
  is no migration, setup script, or README instruction that creates the
  `cad-library` Storage bucket the download route reads from
  (`admin.storage.from('cad-library')`). Searched `supabase/README.md` and the
  whole repo for `cad-library` bucket setup — none found. This has to be
  created manually in the Supabase dashboard (or via a setup script that
  doesn't yet exist) before any file could actually be downloaded, even if a
  row existed.
- **Revit families**: `SPEC_CAD_BIM_LIBRARY.md` flags Revit family creation
  (`.rfa`) as "a separate deliverable outside this build scope... confirm
  with client before building." No Revit files exist or are expected to be
  produced by this codebase.

---

## Do real CAD file assets exist anywhere to populate this?

**No — checked both places, found nothing usable.**

1. **This repo:** No `.dwg`, `.dxf`, `.rfa`, or `.rvt` files exist anywhere in
   the tracked or untracked working tree (searched by extension/pattern —
   zero hits outside `node_modules`/`.git` internals, which are irrelevant
   binary hashes, not real matches).
2. **`machine-data/` (gitignored):** Contains `ds2801db.bdb` /
   `ds2801ldb.bdb` / `ds2801wdb.bdb` and sample `.ds1` files — this is the
   **Thalmann DS2801 bending machine's own database**, feeding the
   `machine_profiles` / FlashDraft bend-geometry library (SCHEMA.md's
   "MACHINE INTEGRATION TABLES", migration 004). It is shop job history for
   the *bending machine's* internal bend-sequence format, not architectural
   CAD/BIM drawing files (DWG/DXF/Revit) suitable for an architect to drop
   into a drawing set. These are unrelated datasets that happen to both be
   about "profiles" — do not conflate them. Nothing in `machine-data/` can
   populate `cad_library_files`.
3. **Supabase Storage:** Not checked directly against the live project
   console for this audit (no MCP/dashboard access exercised) — but given
   there are zero `cad_library_files` rows (per `supabase/README.md`'s own
   seed-status note) and no bucket-provisioning code anywhere in the repo,
   there is no code-side evidence any files were ever uploaded. If certainty
   is needed, check the `cad-library` bucket in the Supabase dashboard
   directly rather than trusting this inference.

---

## Bottom line

- **Code:** Complete. Real queries, real RLS-protected tables, real signed-URL
  download flow with logging and count increment, real empty-state handling,
  real auth-gating. Nothing to build here.
- **Content:** Zero. This is a **genuine DATA BLOCKER** — CAD/BIM files
  (DWG/DXF/Revit) have not been received from the client, exactly as
  `CLAUDE.md`'s Data Blockers table and `supabase/README.md`'s seed-status
  note both already say. Do not build placeholder/sample CAD files to fill
  this — per `SPEC_CAD_BIM_LIBRARY.md`, the correct v1 behavior *is* the
  empty state pointing architects to request a consultation instead.
- **One actionable gap that is a code/ops task, not a data blocker:** the
  `cad-library` Storage bucket itself has no provisioning path in this repo.
  Worth creating a short setup step (dashboard bucket + RLS policy, or a
  documented manual step in `supabase/README.md`) so that the day real files
  arrive, there's a bucket ready to receive them.
