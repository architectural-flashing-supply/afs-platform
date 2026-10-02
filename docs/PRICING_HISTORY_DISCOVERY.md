# PRICING_HISTORY_DISCOVERY.md
## AFS — Historical Pricing Data Discovery (sanitized summary)

**Run date:** 2026-10-02 · **Branch:** `pricing-history` · **Mandate:** discovery only.

**Nothing was imported.** No Supabase call, no migration, no database write, no macro
executed, no file content sent to any external service, no source file modified.

**The data itself lives OUTSIDE this repository and stays there** —
`C:\Users\manag\Documents\afs-historical-data\` (see CLAUDE.md rule #34). This
file is the only artifact of the run that enters the repo, and it carries
**structure and aggregates only**: no customer names, no personal data, no dollar
figure attributable to a named customer. The full report, the per-file inventory
and the per-file classification stay in
`C:\Users\manag\Documents\afs-historical-data\_work\`:

```
REPORT_spreadsheet_discovery.md    the full findings
REPORT_spreadsheet_discovery.docx  same, Word format
inventory.csv                      535 rows: path, hash, sheets, dims, macros
classification.csv                 535 rows: class, subclass, confidence, cues
manifest_before.csv / _after.csv   the read-only proof
```

---

## WHAT WAS EXAMINED

535 spreadsheet and Word files copied from the owner's laptop: 419 `.xlsm`,
62 `.xlsx`, 26 `.docx`, 17 `.doc`, 8 `.xls`, 3 `.xlsb`. **534 parsed; 1 could
not**, and the reason is a finding — one file carrying an `.xlsx` extension is
actually a 1-page PDF (magic bytes `%PDF-1.7`). A magic-byte sniff of all 535
found that to be the only extension/content mismatch.

Extraction used a pinned virtualenv (`openpyxl 3.1.5`, `xlrd 2.0.2`,
`pyxlsb 1.0.10`, `python-docx 1.2.0`) outside the repo. Every `.xlsx`/`.xlsm` was
read twice — formulas and Excel's cached values — giving **1,876,898 non-empty
cells, 366,252 of them formulas (19.5%)**. The 28 legacy files were **copied**
and LibreOffice converted the copies; originals were never opened by a
converting application. Macro presence was detected by looking for
`vbaProject.bin` in the OOXML zip, never by opening the VBA project.

**Read-only, verified rather than asserted.** A SHA-256 manifest of all 535
files was taken before anything was opened and re-taken afterwards. Both files
hash to `bfbcc268de03137d251bf8dbeb9dd60a880aca25e0d32c47d5917dd97b7ec090`;
**all 535 source files are byte-for-byte unchanged.**

---

## THE SIX FINDINGS THAT AFFECT THE BUILD

### 1. Two thirds of the corpus is a different business

| Class | Files | Share |
|---|---|---|
| `OTHER` | 392 | 73.3% |
| `AFS_ESTIMATE` | 59 | 11.0% |
| `AFS_QUOTE_OUT` | 52 | 9.7% |
| `INVOICE` | 11 | 2.1% |
| `PERSONAL_NON_AFS` | 9 | 1.7% |
| `PRICE_LIST` | 6 | 1.1% |
| `TEMPLATE` | 6 | 1.1% |
| **Total** | **535** | **100%** |

Confidence: **453 high, 70 medium, 12 low**. Within `OTHER`, **350 files are
Austin Roofing & Siding / Aztec Roofing roofing-system estimates** — the owner's
roofing business, not architectural flashing fabrication. Only **111 files (21%)
carry AFS pricing**.

**The AFS/ARS line cannot be drawn from sheet names or from the address.** A
sheet called `Metal` is usually a metal-ROOF installation bid on roofing
letterhead. And `P.O. Box 328 * Burnet, TX 78611` is the **shared premises**,
appearing on roofing covers too — using it as an AFS marker mislabelled 119
roofing estimates as AFS work. What does discriminate, read per sheet, is the
company **name** (four spellings in use, including `Architectural Flasing Inc`)
and the AFS-only phone `512.372.4900`, verified to appear in 13 files with no AFS
name and **zero** files carrying any roofing-business marker.

### 2. AFS fabrication was quoted inside the roofing company's estimating workbook

423 of 535 files are one inherited workbook (`Call In`, `Cover`, `Sketch`,
`Inspection`, `M Refrences`, `C Refrences`, plus per-scope `* Budget` / `* Bid`
tabs). AFS fabrication appears as **extra tabs added per job** — `Coping Cap Bid`,
`Fabrication Bid`, `Metal Quote Galvalume`, `Metal Quote Color`,
`Coping Cap Fab Bid`, `Roof top Curb PO`. **There was never a separate AFS
estimating tool.**

Each job was made by copying the previous job's workbook: 231 distinct layout
fingerprints, all variations on one skeleton, and a `Compatibility Report` sheet
propagated into 423 files.

### 3. THERE IS NO AFS PRICE BOOK IN THESE FILES

Checked exhaustively, and this is the finding that most constrains the import:

- No AFS-authored price table — no price sheet, no hidden pricing tab, no named
  range, no lookup.
- **Every AFS unit price is a hand-typed constant.**
- The lookup census is decisive: 747 `VLOOKUP` + 1,779 `INDIRECT` calls exist,
  and lookup-family usage is concentrated in exactly **4 files, every one of them
  supplier-supplied** (two IB Roof Systems order forms, two copies of a New Tech
  Machinery coil calculator).
- 615 hidden sheets exist but **423 are the `Compatibility Report` artifact**; the
  rest are superseded copies of visible scopes. The only interesting hidden
  sheets belong to the supplier order forms.
- `M Refrences` (in 419 files) reads like "Material References" and is **not** a
  price table — it is a list of past customers used as sales references. It was
  the first candidate checked and it is a dead end.

### 4. The per-bend formula exists — and it belongs to a supplier

`Q2_2023_IBRoofSystemsOrderFormandPriceSheet.xlsm`, sheet `Metal Edge`, rates on
a hidden `data` sheet:

```
price = (girth_inches × rate_per_inch) + (bend_count × rate_per_bend) + setup_fee
```

In the sheet's own words: *"White: 3.13 per inch + #bends*2"*. The rate table
(a **supplier's** published 2023 sell prices, 26 ga, not AFS costs):

| Product | $/inch | $/bend | fee |
|---|---|---|---|
| Custom Drip Edge / Gravel Stop, white | 3.31 | 2.00 | 5.00 |
| Custom Drip Edge / Gravel Stop, colour | 3.38 | 2.00 | 5.00 |
| Custom Drip Edge / Gravel Stop, stainless | 8.27 | 2.00 | 5.00 |
| Custom Galvanized Cleat | 1.83 | 2.00 | 5.00 |
| Custom Stainless Cleat | 8.27 | 2.00 | 5.00 |

The same workbook carries a bend-angle calculator
(`rise`/`run` → `=DEGREES(ACOS(...))` → "Angle to bend", "Angle off 90") and a
kick option code `(KO, KI, NK)` — the same vocabulary FlashDraft uses. **This is
the most valuable artifact found: a working, industry-standard implementation of
exactly the model rule #19 describes.** It is a design reference, not a source of
AFS numbers.

### 5. The 4 ft × 10 ft sheet is a purchased input, not a quoting basis

`Premium/Standard/Drexlume Flats 48x120` appear as material lines with a
per-sheet cost — **2,016 observations**. Aggregate medians only:

| Year | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| median $/sheet | 39.40 | 39.40 | 39.40 | 41.60 | 39.40 | 34.15 | 41.60 | 44.80 | 44.80 | 44.80 | 44.80 | 44.80 |
| n | 51 | 132 | 119 | 108 | 45 | 260 | 330 | 255 | 225 | 160 | 204 | 127 |

Read the median only — the min/max are contaminated because the same row label is
reused for other materials in some workbooks.

**What is NOT there:** no formula anywhere divides a 48″ sheet into strips,
computes `floor(48 / blank_width)`, counts bends against a sheet, or applies a
waste factor. **`price_book_versions` has no historical counterpart to import
into.** Only `sheet_cost_cents` has even an approximate antecedent, and it is a
*purchase cost*, not a quoting basis. Per rule #19 these stay blank until Steve
fills them in — the series above is evidence to show him, not a value to write.

### 6. The roofing pricing logic, reconstructed and algebraically verified

The `* Budget` sheets (1,700 instances, uniform layout `A1:R42`) build cost and
then mark it up:

```
extended        F = qty × unit_cost + tax          (tax rate at E6; 0.0825 or 0)
total_cost      H = material + labour + shared consumables pool
bid_rate        I = H × 100 / 67 / squares          ← the markup dial
bid             J = I × squares + L                 (or without L)
liability_ins   L = J × 0.044                       ← 4.4%
profit          M = J − H − L
realized_margin K = M / J
```

The algebra closes exactly, which is how we know the reading is right. With
`J = H/0.67 + 0.044J`: `J = H/0.64052`, `M = 0.49253·H`, so
`K = 0.49253 × 0.64052 = `**`0.31548`** — exactly the value stored in column `K`
across the corpus. A 33% gross margin on sell price, 49.25% markup on cost,
31.548% realized after insurance.

**The divisor is a hand-edited dial, not a constant.** Measured over 4,148 priced
alternative rows: `67` in 2,900 rows (33% margin), then `64` (284), `71` (166),
`62` (93), `60` (78), `70` (63), `75` (37), `85` (28), `73`/`80`/`78` (25/24/13).
One workbook uses `/67` and `/71` in adjacent rows of the same sheet.

**Two bid formulas coexist:** `J = I×squares + L` in 1,699 rows, `J = I×squares`
in 1,436, and **1,013 rows match neither** (stale cached values, typed-over
results, or rows sitting on a `#DIV/0!`). **Any import must read the stored total
and never recompute it.**

These are **roofing** figures, measured per-square on installed roofing. They are
not AFS fabrication margin targets and must not be seeded into `pricing_rules` as
if they were.

---

## WHAT COULD NOT BE DETERMINED

Stated plainly rather than guessed:

1. **AFS's own per-bend and per-hem rates** — not present in any form in any file.
2. **How an AFS unit price was arrived at.** One template is explicit about the
   method: a line priced as `=<total>/<qty>`, a known total back-divided by
   quantity. The total came from outside the workbook.
3. **Whether AFS applied the 0.67 divisor to fabrication.** The AFS fabrication
   tabs are **cost-only** — Quantity / Description / Unit Cost / Ext. Cost /
   SubTotal / Tax / Total, with no markup row at all.
4. **Blank/girth width as a field** — present only inside description prose
   (`8.5" Girth`, `8" Blank`), never as a column.
5. **Quote outcomes** — no accepted/declined/expired status, no decision date, no
   reason anywhere. `pricing_ledger.outcome` has nothing to import.
6. **Rush** — no rush flag, surcharge or lead-time field anywhere in the corpus.
   Consistent with rule #15: rush is never inferred, and there is nothing here to
   infer it from.
7. **Supplier identity on cost lines** — brand names appear in descriptions, but
   no supplier field, invoice reference or effective date.
8. **Dates for 62 files** — no usable internal date; mtime reflects the laptop
   copy, not authorship.

---

## COVERAGE

**2015-09-29 → 2026-10-01.** Date basis is recorded per file: internal
recalculation stamp (425), ordinary date cell (20), filesystem mtime for the 28
legacy conversions, none (62).

| Year | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| all files | 14 | 34 | 34 | 32 | 19 | 47 | 69 | 43 | 54 | 61 | 67 | 61 |
| AFS pricing | — | — | 2 | — | 2 | 19 | 8 | 8 | 11 | 10 | 21 | 30 |

**Gaps:** 2015–2016 contain no AFS pricing at all — the flashing business either
did not exist or was not quoted in spreadsheets. AFS pricing history effectively
starts **2017** and becomes substantial only from **2020**. 2019 is thin
throughout. **AFS volume is rising sharply — 2025–2026 hold 51 of the 111 AFS
pricing files (46%)**, so the most relevant prices are also the best covered.

This is a laptop snapshot, not an archive: 489 of 535 files sit under `Desktop`,
and folder names do not reliably indicate year.

**264 distinct customer/job identifiers** (counted from hashes; no name recorded
here or in the repo).

**Materials**, by mentions in costed line descriptions — note the top two are
**brands, not materials**, so a mapping table is required, and one entry is a
coating recorded where a substrate is expected:

| Mentions | 1,755 | 1,427 | 116 | 86 | 62 | 59 | 53 | 42 | 34 |
|---|---|---|---|---|---|---|---|---|---|
| Term | Drexel* | Drexlume* | Stainless | Copper | Steel | Galvalume | Galvanized | Kynar† | Aluminum |

\* brand · † a finish, not a substrate

**Gauges / thicknesses:** `24 ga` (1,919), `20 ga` (236), `22 ga` (90), `26 ga`
(42), `18 ga` (3), `16 ga` (1); decimals `.040` (27), `.080` (5), `.032` (3),
`.0625`/`.050`/`.125`/`.250` (1 each). **Both conventions are in use in the same
corpus and sometimes the same description** — `.0625` and `16 ga` are the same
thickness, so `gauges` needs its decimal-inch column populated before either can
resolve to one row.

---

## DATA QUALITY

| Finding | Count | Severity |
|---|---|---|
| Files with ≥1 formula error | **422 of 535 (79%)** | High |
| `#DIV/0!` cells | 15,310 | High |
| `#VALUE!` cells | 992 | Medium |
| `#REF!` cells — broken references | **447** | High |
| Near-duplicate job versions | 76 files / 33 jobs | High |
| Exact duplicate files | 12 files / 4 groups (all vendor literature) | Low |
| Bid rows matching neither documented formula | 1,013 of 4,148 | High |
| AFS quote files with no machine-readable priced lines | **25 of 52** | High |
| Budget sheets whose subtotal ≠ its own line sum | 11 of 1,700 | Medium |
| Type/extension mismatch | 1 (PDF as `.xlsx`) | Low |
| Cross-workbook external references | 310 files | Medium |

**The arithmetic is trustworthy; the structure is not.** 1,689 of 1,700 budget
sheets reconcile exactly, 438 of 441 priced line items satisfy
`extended = qty × unit_price`, and 4,131 of 4,148 rows satisfy
`profit = bid − cost − insurance`. The problems are structural, not computational.

**No AFS estimate is byte-identical to another**, so the 33 near-duplicate job
clusters (up to 6 versions each) are genuine revisions and must be de-duplicated
by judgement, not by hash. The naming conventions that produce them: `Copy of`,
`Copy of Copy of`, `(version 1)`, `(002)`, `(Autosaved)`, `Final`, `Revised`, and
the double extension `.xlsb.xlsm`.

**25 of 52 AFS quote files cannot be parsed into line items** — the prices are
prose inside merged cells, or a single total with no itemisation. **Roughly half
the AFS quote history needs human transcription, not parsing.**

### Two measurement errors found and corrected mid-run

Recorded because both first produced confident, wrong numbers:

- **The 2007 fossil.** Taking the earliest date cell dated **420 of 535 files to
  2007**. Cause: `'Call In'!B36` holds a hardcoded `=DATE(2007,8,14)` that every
  copy of the template inherited. Dates now come from cached `=TODAY()`/`=NOW()`
  values, which Excel refreshes at save.
- **A self-inflicted artifact.** LibreOffice *recalculates on load*, so three
  `.xlsb` files read via conversion had `TODAY()` rewritten to the conversion
  date. All 28 converted files now fall back to mtime, labelled as such.

### Checkpoints

| Checkpoint | Result |
|---|---|
| After inventory — 535 files accounted for | **PASS (535/535)** |
| After classification — 535 classified, exactly one class each | **PASS (535/535)** |
| After anatomy — 10 random estimates recomputed vs stored totals | **PASS (10/10)** |

The spot-check is reproducible (`_work\spotcheck.py`, seed `20261002`); the
sample spanned 2017–2026 and both workbook estimates and letterhead quotes, and
every stored subtotal and line extension reconciled to within $0.02.

---

## SECURITY FINDING — ACTION REQUIRED

**`Documents/afs api's.docx` in the historical-data folder contains live
production credentials for this platform.** It was classified and flagged; its
contents were **not transcribed** into the report, into this file, or anywhere
else. Credential **types** present (no values recorded anywhere):

Supabase **service-role key** (bypasses all RLS), Supabase publishable/anon keys
and project URL, Supabase **database password**, a GitHub **personal access
token**, a Vercel **token** plus org/project/user ids, a Stripe **secret key**
(test mode) and publishable key, Twilio account code and compliance profile id,
and a Metals.dev API key.

**Recommendation: rotate all of them**, service-role key, database password,
GitHub token and Vercel token first. The file sat in a laptop `Documents` folder
and has now also been copied to this machine, so rotation is the only safe
assumption. Separately worth resolving: the Vercel project id in that file
matches **neither** project recorded in CLAUDE.md rule #9.

---

## SCHEMA MAPPING — PROPOSAL ONLY

### Non-negotiable requirements for any import built from this

1. **Every imported price carries provenance** — source file **SHA-256**, sheet
   name and cell range, for every value. The hashes already exist in
   `inventory.csv` / `classification.csv`.
2. **Everything lands `unverified`, pending owner review.** No historical price is
   authoritative until Steve confirms it. **A blank stays blank** — per rule #19 a
   blank is never a zero, and nothing here justifies inventing one.
3. **Stored totals are imported as found, never recomputed** — 1,013 of 4,148 bid
   rows already disagree with their own formulas.
4. **`import_batch_id` on every row**, per `pricing_ledger`'s CHECK, so a bad
   batch is identifiable and superseded rather than deleted (it cannot be
   deleted — rule #20).
5. **Money in cents.** These workbooks hold floats with up to 13 decimal places;
   rounding to cents is an explicit, recorded decision.
6. **Roofing data is excluded by default** — a different business with a different
   cost structure, and 350 of 535 files. Importing it would swamp the dataset
   dynamic pricing is meant to learn from. Behind an explicit flag if ever wanted.
7. **Personal and credential files are never read by the importer** — excluded by
   hash.

### Destination per table

| Table | Verdict |
|---|---|
| **`pricing_ledger`** (`source='import'`) | **Primary destination.** Maps `occurred_at`, `customer_label`, `material`, `gauge`, `quantity`, `amount_cents`, `note`; `external_ref` as `sha256[:16]/sheet/cell` makes re-import idempotent via `uq_pricing_ledger_external_ref`. `price_book_version_ids` left blank — this history predates the price book, exactly as SCHEMA.md anticipates. `is_rush`, `outcome`, `outcome_reason`, `time_to_decision_seconds` have **nothing to map**. |
| **`supplier_price_history`** | **The one clean source** — the 6 `PRICE_LIST` files give supplier name, effective period, and the per-inch + per-bend rate schedule. `material_id` still needs a brand→material mapping decision. |
| `quotes` / `quote_line_items` | **Do not import.** Mappable in shape, but every row would be history with no `user_id` and no `request_id` — rows no customer owns, in live RLS-keyed transactional tables. The history belongs in `pricing_ledger`, which exists for it. |
| `pricing_rules` | **Do not seed.** The 0.67 divisor and 4.4% adder are roofing figures. Record as a documented observation. |
| `commodity_prices` | **Nothing to import** — no commodity index, no $/lb, no market data anywhere. |
| `price_book_items` / `price_book_versions` | **No clean source.** `per_bend_cents` / `per_hem_cents` / `extras_cents` have no antecedent at all; `sheet_cost_cents` has only a purchase cost. Stays blank per rule #19. |

### Fields with no home — additive migrations that would be needed

All additive, all nullable, none touching an existing constraint:

| Need | Proposed shape on `pricing_ledger` |
|---|---|
| Per-value provenance | `source_file_sha256 text`, `source_sheet text`, `source_cell_range text` |
| Owner verification state | `verification_status text CHECK (IN ('unverified','confirmed','rejected')) DEFAULT 'unverified'`, `verified_by uuid`, `verified_at timestamptz` |
| Which business a row came from | `originating_entity text CHECK (IN ('afs','ars'))` — so roofing data can never be mistaken for AFS data |
| The unparsed original | `source_description_raw text` — keep the prose beside the parsed fields so a bad parse is recoverable |
| Date trustworthiness | `occurred_at_basis text CHECK (IN ('recalc_stamp','date_cell','file_mtime','unknown'))` |
| Brand → material mapping | a small `material_aliases` table |
| Gauge ↔ decimal equivalence | populate `gauges`' decimal-inch column |

### The structural gap the import has to solve

Everything the platform treats as a typed column lives in one free-text string:

```
"3.5" X 6.5" w/.75 Kick and Hem .040 Aluminum"
"8.5" Girth .040 Aluminum"
"1" Snap Lock, 17" Pan Galvalume"
```

Material, gauge or decimal thickness, finish, girth, profile, hem and kick are
all recoverable — but it **is** parsing, with a review step, not a column
mapping.

### Honest assessment of import value

| Source | Files | Value |
|---|---|---|
| Supplier price sheets | 6 | **High** — clean tables, real dates, a real per-bend formula |
| AFS letterhead quotes, parsable | 27 | **High** — real AFS sell prices with dates |
| AFS in-workbook fabrication bids | 59 | **Medium-high** — clean grid, cost-only |
| AFS letterhead quotes, prose-only | 25 | **Medium** — needs human transcription |
| AFS proposal letters (`.docx`) | 6 | **Low-medium** — totals only, fabricate-and-install |
| Flat-sheet cost series | 2,016 obs | **Medium** — trend evidence, aggregate only |
| Roofing estimates | 350 | **Excluded by default** |
| Invoices / pay applications | 11 | **Low** — AIA progress billing, not unit pricing |
| Personal / credentials | 10 | **Never** |

**Realistic expectation: on the order of 90–110 AFS pricing documents yielding a
few hundred priced line items, roughly half needing human transcription.** Useful
for calibrating a price book and for showing Steve what he used to charge. **Not**
a dataset that can reconstruct an AFS price book automatically, because AFS never
had one in a file.

---

## OPEN QUESTIONS FOR THE OWNER

Each answerable in one sentence.

1. There is no AFS price book in any of these 535 files — when a flashing was
   quoted per piece by girth, where did that number come from?
2. Should the 350 Austin Roofing & Siding roofing estimates be imported at all,
   or excluded as a different business?
3. What are the current per-bend and per-hem charges? (Nothing in the corpus
   states them; the only per-bend rate found is a supplier's $2.00/bend.)
4. One template prices a line as `=<total>/<qty>` — where was that total worked
   out?
5. Is the 0.67 divisor (33% gross margin) still the target, and does it apply to
   flashing fabrication as well as roofing?
6. The `Flats 48x120` sheet cost moved $39.40 → $41.60 → $44.80 over ten years —
   is $44.80 still current, and for which material and gauge?
7. `Drexel` and `Drexlume` appear 3,182 times as if they were materials — which
   `materials` row should each map to?
8. Of the 33 jobs existing in 2–6 versions each, is the newest file always the one
   that was sent, or should we ask per job?
9. The 1.55 GB `backup.pst` beside this data was not opened — does it hold the
   sent quotes, customer acceptances and supplier price-increase notices missing
   from the spreadsheets?
10. Nothing records whether a quote was accepted, declined or expired — were
    outcomes tracked anywhere?
11. `afs api's.docx` holds live Supabase, GitHub, Vercel and Stripe credentials —
    may we rotate all of them now?

---

## NEXT STEP

**The import prompt.** It must be written against the requirements in the schema
section above — provenance on every value, everything `unverified`, stored totals
never recomputed, `import_batch_id` always set, roofing data excluded by default,
personal and credential files excluded by hash — and it should not be written
until questions 1, 2, 3 and 11 are answered, because those four change what gets
imported and whether the platform's credentials are still sound.

---

*PRICING_HISTORY_DISCOVERY.md | AFS | discovery run 2026-10-02 | branch `pricing-history`*
*Nothing imported. No database write. No source file modified — verified by matched SHA-256 manifests.*
