# SPEC_HAILVIEW_V2.md
## AFS — HailView Logic Engine V2
**Owner:** Reid Whitesides | Visual AI Method
**Status:** Phase 1 BUILT (IEM Local Storm Reports only), UNCALIBRATED
**Model version:** `v2.0-uncalibrated`
**Supersedes:** `SPEC_HAILVIEW.md` §5 (the per-material point tables) for all scoring.
**Still binding from SPEC_HAILVIEW.md:** §1 and §6 (the determinism contract),
§2 (the excluded Facebook/lead-gen scope), §4 (the data sources), §7–§8 (UI and
email capture).

---

## 0. WHY V2 EXISTS

A real test at one Burnet, TX address produced this:

| Roof | V1 score |
|---|---|
| 16-year-old asphalt shingle | 60 |
| 24 ga standing seam metal | **81** |

That is backwards. A standing-seam metal roof is far less likely to be replaced
on an insurer's money than a 16-year-old shingle roof under the same hail.

Every line of `lib/hailview/replacement-score.ts` was read, and the reversal had
six distinct causes — not one bug:

| # | Root cause | Where V2 fixes it |
|---|---|---|
| 1 | **Point tables not on a common scale.** 2.0 in hail was worth ~12 pts × an age multiplier on asphalt and a flat 54 pts on metal. Cross-material comparison was meaningless. | `damage.ts` — ONE impact-energy scale (d⁴) for every material |
| 2 | **Age dominated additively.** ~25 pts at 16 years with ZERO hail, so hail barely moved the number. | `claims.ts` — age alone is not an insurance event; no-hail is 0 |
| 3 | **No cosmetic/functional split and no claims logic.** Metal's "onset 1.5 in" treated a dent as replacement-worthy. | `damage.ts` splits the two curves; `claims.ts` applies `cosmeticExclusion` |
| 4 | **`metalGauge` and panel type collected and unused.** The route did not even pass `metalGauge` to the scorer. | `METAL_GAUGE_THRESHOLD_FACTOR`, passed through the route |
| 5 | **Reports treated as point facts.** No spatial reasoning, no event grouping, no uncertainty, no time/claim window. | `cluster.ts`, `swath.ts`, `claims.ts` |
| 6 | **No cross-material or monotonicity tests.** | `engine.test.ts`, `guard.ts`, `golden.test.ts` |

**After V2, on identical bracketed evidence at age 16:**

| hail | V1 shingle | V1 metal 24 ga | V2 shingle | V2 metal 24 ga (excl.) | V2 metal (covered) |
|---|---|---|---|---|---|
| 1.00″ | 51 | 11 | 12 | 0 | 0 |
| 1.50″ | 62 | **86** | 38 | 0 | 6 |
| 1.75″ | 75 | **86** | 55 | 0 | 17 |
| 2.00″ | 97 | 86 | 68 | 1 | 24 |
| 2.50″ | 97 | 86 | 76 | 9 | 30 |
| none, 16 yr | 25 | 11 | **0** | **0** | **0** |

---

## 1. WHAT THE NUMBER MEANS

> **The probability that an insurer pays for a FULL ROOF REPLACEMENT.**

Not the probability the roof is damaged. Not a condition rating. Not a points
total. The UI label says this in words, and so does the emailed report.

The legacy `score` (0–100) and `tier` fields are retained so nothing downstream
breaks, but they are now `round(probability × 100)` and the V1 cut points
(Low ≤ 34, Moderate 35–64, High ≥ 65) applied to that.

### The determinism contract is unchanged

`SPEC_HAILVIEW.md` §1 and §6 still hold, and V2 is built to protect them:

- The number comes from pure, synchronous, auditable code. `evidence.ts` is the
  ONLY module in `lib/hailview/v2/` that performs I/O; everything downstream of
  it is pure.
- **No clock read inside scoring.** The caller passes `nowUtc`. One request pins
  one `nowUtc` for the whole pipeline.
- No model call inside scoring. The agent (`explanation.ts`) runs strictly after
  the number is final, writes prose and advisory `auditFlags`, and its return
  type has no numeric field to wire back.
- `guard.ts` re-checks the invariants and can only ever **annotate** — it never
  edits the number.

---

## 2. PIPELINE

```
address + material + roof details + cosmeticExclusion
        |
        v
[A evidence.ts]   EvidenceSource interface; IEM LSR adapter (Phase 1 ONLY)
        |         -> HailObservation[] {lat, lon, timeUtc, sizeIn, sizeBasis, source, quality}
        v
[B cluster.ts]    convective day (12Z-12Z) -> storm occurrences. ONE DATE = ONE EVENT.
        |
        v
[C swath.ts]      triangulate size AT THE ADDRESS per event
        |         -> P(>=1in), p10/p25/p50/p75/p90, bracketed, nearest, measured mix
        v
[D damage.ts]     ONE energy scale (d^4) -> P(cosmetic), P(functional) per event
        |         integrated over the size distribution by 5-point quadrature
        v
[E claims.ts]     -> P(insurer pays FULL REPLACEMENT); claim window; date of loss
        |
        v
[F engine.ts]     range, evidence grade A-D, per-event audit, sensitivity, provenance
        |
        v
[G guard.ts]      re-check invariants -> guardFlags (never alters the number)
        |
        v
[H explanation.ts]  narrative + advisory auditFlags  (ADVISORY ONLY, fails open)
```

---

## 3. THE TRIANGULATION MATH (`swath.ts`)

### 3.1 The problem

V1 asked "did a report land inside a 1-mile box". A report 0.9 mi away counted
exactly as much as one in the driveway, and nothing outside the box existed at
all. Measured live at Burnet on 2026-10-08: **12 hail reports within 1 mile over
5 years, 102 within 15 miles.** V1 was discarding almost all the evidence that
makes triangulation possible.

V2's evidence radius is **12 miles** (`V2_EVIDENCE_RADIUS_MI`), ≈ 4 kernel
bandwidths. Beyond that a report carries essentially no weight.

### 3.2 Kernel weighting

Each observation *i* gets a weight about the address:

```
w_i = K(d_i) · basis_i · quality_i

ISOTROPIC (default):
  K(d) = exp( -d² / (2 h²) )                h = SWATH_BANDWIDTH_MI = 3 mi

ANISOTROPIC (only when a storm-motion bearing θ can be fitted):
  rotate into the storm frame —
    along = x·sinθ + y·cosθ
    cross = x·cosθ − y·sinθ
  K = exp( -½ [ (along/h_along)² + (cross/h_cross)² ] )
    h_along = h · 2.0 = 6.0 mi
    h_cross = h · 0.5 = 1.5 mi

basis_i   = 1.5 for a MEASURED report, 1.0 for an estimated one
quality_i = reporter-class weight, 0.70 (public) .. 1.00 (trained spotter / NWS)
```

**The two anisotropy factors are reciprocal (2.0 × 0.5 = 1), so the kernel
covers the same effective AREA as the isotropic one and only redistributes it.**
Without that, "we found a storm direction" would silently widen or narrow total
support as a side effect. A unit test asserts the product is 1.

Hail swaths are long and narrow — commonly 1–3 mi wide at damaging intensity —
so a report 5 mi *up-track* is far more informative about this address than one
5 mi to the *side*.

**Storm motion is falsifiable, not assumed.** `fitStormMotion` regresses x and y
on time in a local miles plane and accepts the fit only if: ≥ 3 observations,
≥ 3 **distinct** timestamps, span ≥ 10 minutes, and fitted speed in
**5–80 mph**. A "motion" of 3 mph or 300 mph is a fit to coordinate
quantization noise, not to a storm. Otherwise the kernel is isotropic.

### 3.3 The estimate — precision-weighted (Gaussian conjugate) update

Each observation is a noisy reading *of the size at this address*:

```
σ_obs,i² = σ_report,i² + ( SIGMA_PER_MILE_IN · d_i · extrapolationFactor )²

  σ_report = 0.15 in (measured)  |  0.35 in (estimated)
  SIGMA_PER_MILE_IN = 0.09 in/mi
  extrapolationFactor = 1.0 if bracketed, else 1.6

τ_i = w_i / σ_obs,i²                     (precision contributed)
τ_0 = 1 / PRIOR_SIGMA_IN²                (prior precision)

precision = τ_0 + Σ τ_i
central   = ( τ_0·PRIOR_SIZE_IN + Σ τ_i·sizeIn_i ) / precision
σ         = max( SIGMA_FLOOR_IN, 1 / sqrt(precision) )
```

**`PRIOR_SIGMA_IN` is therefore a CEILING on the reported uncertainty, and that
is the point.** An earlier revision added distance noise without bound, which
made a far-away report produce a posterior **vaguer than the prior** —
incoherent (observing something cannot leave you less certain than you began),
and it inflated the upper tail so badly that *a single 3″ report 10 miles away
scored P(≥1″) = 0.43*. Precision only ever adds, so that cannot recur.

This is what delivers the three properties the engine needs, as consequences
rather than as tuning:

| Required behaviour | Why it falls out |
|---|---|
| A single **distant** report → LOW exceedance, WIDE interval, never a confident size | w = exp(−½(10/3)²) ≈ 0.004 **and** σ_obs grows with the same distance, so τ ≈ 0.001 against τ₀ ≈ 4.94. Posterior ≈ the prior: central ≈ 0.60″, σ ≈ 0.45″, P(≥1″) ≈ 0.19 |
| **Bracketed** beats unbracketed on interval width | `extrapolationFactor` 1.6 inflates σ_obs, lowering the precision each report contributes |
| Two **nearby** reports interpolate between their sizes | At short range their precision swamps the prior's; the posterior mean is their precision-weighted average |

### 3.4 Quantiles and exceedance

```
p10 = max(0.25, central − 1.2816 σ)      p25 = max(0.25, central − 0.6745 σ)
p50 = central                            p75 = max(0.25, central + 0.6745 σ)
p90 = max(0.25, central + 1.2816 σ)

P(size >= t) = 1 − Φ( (t − central) / σ )
```

Φ is the standard normal CDF via the Abramowitz & Stegun 7.1.26 approximation
(max abs error 1.5e-7) — written out rather than imported, to keep the scoring
path free of new dependencies. Quantiles are floored at
`MIN_PHYSICAL_SIZE_IN = 0.25 in` (pea size — the smallest an LSR is written for).

### 3.5 Bracketing

Bearings from the address to every report within `BRACKET_RADIUS_MI = 6`
(2 bandwidths) are sorted; `angularSpan = 360 − largestGap`.

**Bracketed ⟺ `angularSpan >= 180 − 0.5°`.** The comparison is `>=`, and the
boundary case is why: at exactly 180° the reports are diametrically opposite and
the address lies **on the segment joining them** — one-dimensional
interpolation, the clearest possible case of being bracketed. Two reports can
never *exceed* 180° (two directions cannot strictly enclose a point in the
plane), so a strict `>` would mean "reports on opposing sides" — the canonical
example — never qualified, and nothing with only two reports ever could.

The 0.5° tolerance exists because **the IEM feed rounds positions to 0.01°**
(≈ 0.6 mi at this latitude), so a genuinely straddling pair lands a fraction of
a degree short. Without it the flag would flicker on coordinate rounding.

### 3.6 Absence of reports is weak evidence, not proof

Small towns generate fewer reports than cities. Every coverage note and the
grade-D reason say so in words. The engine never reports "no hail fell" — only
"no hail was reported".

---

## 4. ONE PHYSICAL DAMAGE SCALE (`damage.ts`)

### 4.1 Impact energy

```
E(d) ∝ d⁴          mass ∝ d³ ,  terminal velocity ∝ √d ,  E = ½mv²
energyIndex(d) = (d / 1.00 in)⁴
```

This is the common scale root cause #1 was missing. "Twice as damaging" now
means the same thing on a shingle roof and a standing-seam roof.

### 4.2 Curve shape — a logistic in log-energy, pinned by two real anchors

```
P(d) = 1 / ( 1 + exp( −k · (ln E(d) − ln E_half) ) )
     = 1 / ( 1 + exp( −4k · ln(d / d_half) ) )

k is SOLVED from two anchor points, not chosen:
  k = [ logit(P_onset) − logit(P_half) ] / [ 4 · ln(d_onset / d_half) ]
```

Smooth, strictly monotonic in diameter, bounded in (0,1), **no breakpoints** —
V1's step tables jumped discontinuously as hail crossed a tier edge.

Pinning by two anchors means every number in §7's table is a statement about the
world ("at this size, this fraction of roofs of this type are damaged") rather
than a tuning parameter.

**Sanity check that the shape is right:** wood shake's curve is fitted to Haag's
real 50 % @ 1.5″ and 90 % @ 1.75″ figures, and then *independently* predicts
≈ 7 % at 1.25″ — which is Haag's own third finding, "hairline fractures begin".
The functional form was not chosen to produce that.

### 4.3 Cosmetic vs functional

| | Meaning |
|---|---|
| **Cosmetic** | The roof *looks* hit. Dents in metal, granule scouring on asphalt. The published anchor is explicit that **granule loss alone is NOT functional damage**. |
| **Functional** | Water-shedding is compromised: mat fracture, puncture, splits, seam or fastener failure. |

Functional is a **subset** of cosmetic, and `damageForEvent` clamps to make that
true rather than assumed — a negative "cosmetic only" would otherwise *subtract*
from the claim probability. `pCosmeticOnly = max(0, pCosmetic − pFunctional)`.

Both curves are scaled by the **same** age × thickness factor, so a thicker
gauge resists denting as well as fracture and the two curves can never cross.

### 4.4 Age and thickness

```
ageThresholdFactor   = 1 − perYear · min(age, capYears)       always in (0, 1]
thicknessFactor      = METAL_GAUGE_THRESHOLD_FACTOR | MEMBRANE_MIL_THRESHOLD_FACTOR | 1
thresholdFactor      = ageThresholdFactor · thicknessFactor   (applied to both curves)
```

**METAL'S AGE EMBRITTLEMENT IS DELIBERATELY ZERO**, and that is load-bearing
rather than lazy. Metal fails by plastic deformation from a single impact; a
20-year-old 24 ga panel dents at the same hail size a new one does. Fasteners
and sealants do age, but that is a wind/thermal-cycling leak risk, not a
hail-impact threshold. Giving metal an embrittlement term would also quietly
re-create root cause #2 — a score that climbs with age when no hail ever fell.
`guard.ts` therefore asserts metal is **flat** in age, not increasing.

### 4.5 Integrating over the size distribution

```
P_event = Σ_q  w_q · P(d_q)        over q ∈ {p10, p25, p50, p75, p90}
w = { 0.175, 0.200, 0.250, 0.200, 0.175 }     (midpoint rule, sums to exactly 1)
```

Integrating rather than evaluating at the median **is the point, not a
refinement**: the curves are steeply convex near onset, so a median of 0.9″ with
real probability mass at 1.4″ carries a materially higher damage chance than a
*certain* 0.9″ does, and the median alone cannot see that. This is how the swath
layer's honest uncertainty actually reaches the number.

### 4.6 Combining events

```
P = 1 − Π_i ( 1 − p_i )           independent hazards
```

Independence is an approximation, conservative in the right direction: two
storms a year apart really are close to independent, and the formula **cannot
exceed 1** however many events pile up. V1's additive tables could, and
saturated at an arbitrary 60-point cap instead.

---

## 5. CLAIM LOGIC (`claims.ts`)

Three things decide a claim, and V1 had none of them.

### 5.1 Functional damage → replacement

```
P(replace | functional) = base + (eol − base) · min(1, age / ageFull)
```

Rises with age for **repairability** reasons, not physical ones: discontinued
shingle lines cannot be colour-matched, brittle old material cannot be walked or
lifted without further damage, and an old roof with a few damaged slopes is more
often condemned whole. Metal is lower at both ends because individual panels
really can be replaced.

### 5.2 Cosmetic damage → only where the policy covers it

```
contribution = pFunctional · P(replace|functional)
             + [ cosmeticExclusion ? 0 : pCosmeticOnly · P(replace|cosmetic only) ]
```

Within one event, functional and cosmetic-only are **mutually exclusive**
outcomes (by §4.3's definition), so their contributions **add**; across events
they combine as hazards.

`DEFAULT_COSMETIC_EXCLUSION` is **true for metal and membrane**, false for
asphalt and wood shake. Cosmetic-damage exclusion endorsements are near-standard
on metal roofs precisely because metal dents without leaking. **This default is
the single biggest correction in the engine** — under it, a dent contributes
exactly zero.

### 5.3 The claim window

`CLAIM_WINDOW_MONTHS = 12`, provenance **`expert-verify-per-policy`**. Most US
homeowner policies require prompt notice and many carriers apply a one-year
limitation, but the real deadline is a term of the specific policy and varies by
carrier and state.

**Events outside the window are LISTED, NOT DROPPED.** They contribute exactly
zero and come back with `windowStatus: 'outside_window'` and a label the UI and
the email both print. "Your roof was hit by 3.25″ hail, but in 2023, which is
outside the window your policy will pay on" is true and useful; silently
discarding the event would make the engine look as though it had never seen the
storm.

### 5.4 Age alone is never an insurance event

No qualifying hail ⇒ **probability 0**. Not "25 points of age". `engine.test.ts`
asserts P ≤ 0.03 for **every** material at **every** age from 0 to 60 with no
evidence, and exactly 0 for the reported 16-year-old shingle case.

### 5.5 Date of loss

The in-window event with the highest `claimContribution`. `null` when no
in-window event contributes.

---

## 6. OUTPUTS, GRADE AND GUARD

### 6.1 Range and sensitivity

The reported `low`/`high` come from re-running the whole engine with every
event's estimated size shifted by **∓0.25 in**. The dominant uncertainty in this
engine is the size at the address, so a range derived from perturbing that size
is the honest one — **not a confidence interval the model has not earned.**

`sensitivity` also reports the result with `cosmeticExclusion` flipped, and a
plain-English note combining both.

The perturbations reuse the already-computed clusters, so a perturbation changes
only the **sizes** and never the **event set** — which is what "what if the hail
was a quarter-inch bigger" actually means.

### 6.2 Evidence grade

Graded on the evidence **nearest the address**, not on how many reports the
query returned across five years and twelve miles.

| Grade | Condition |
|---|---|
| **A** | nearest ≤ 1 mi, ≥ 3 reports on the best event, bracketed, ≥ 1 measured |
| **B** | nearest ≤ 2 mi, and (bracketed or ≥ 2 reports) |
| **C** | nearest ≤ 6 mi — extrapolated from reports that fell elsewhere in the storm |
| **D** | no reports, or nearest > 6 mi |

Each grade carries a plain-English reason, and D's says that absence of reports
is weak evidence rather than proof.

### 6.3 The guard

`guard.ts` is deterministic — **no LLM**. It re-runs the engine on perturbed
inputs and checks:

- bounds: `probability`, `low`, `high` all in [0,1]
- `low ≤ probability ≤ high`
- `score === round(probability × 100)`
- per event: contribution in [0,1]; **no out-of-window event contributes**;
  `pFunctional ≤ pCosmetic`
- monotone in hail size, both directions (perturbs the **observations**, so the
  whole pipeline is exercised, not just the last stage)
- monotone in roof age for the embrittling materials; **flat** for metal (§4.4)
- covering cosmetic damage never *lowers* the result

A violation returns the result **unchanged** with a visible `guardFlags` entry
and one server log line carrying every violation. **It never silently alters the
number** — an engine that quietly corrected itself when it failed its own
invariant would be strictly less auditable than one that reports the
contradiction, and auditability is the whole reason §1 exists.

### 6.4 The agent is advisory

`explanation.ts` returns `{ narrative, auditFlags }` where each flag is
`{ kind, severity, message }` — **three strings, no numeric field**, so §6 of
SPEC_HAILVIEW.md ("the agent's response type should not even have a numeric
field available to accidentally wire up") is satisfied structurally.

`kind ∈ {source_conflict, data_gap, thin_coverage, outlier}`,
`severity ∈ {info, caution}`. Any unrecognised kind or severity is **dropped,
never coerced** — an invented flag is noise, not advisory information.

**Fails open.** Any throw — network, auth, rate limit, malformed response —
returns `{ narrative: '', auditFlags: [] }` and logs. The caller renders its own
deterministic summary.

The response is parsed by hand rather than with a schema library. `zod` is not a
dependency of this repo, and CLAUDE.md rule #32 already settled this exact
case — "do not add a schema library for two documented shapes", with
`lib/integrations/pathfinder-response.ts` as the pattern.

---

## 7. CONSTANTS TABLE WITH PROVENANCE

**`published` carries a citation. `expert` needs field validation and is never
presented as published.**

### 7.1 The published anchor

> **IIBEC / Smith (2013):** the smallest hail capable of FUNCTIONALLY damaging
> asphalt shingles is **1.0 in for 3-tab** and **1.25 in for laminated
> (architectural)**. Granule loss alone is **not** functional damage — fracture
> or puncture is required.

These are the only hard published thresholds in the engine. Every other
material's constants are expressed relative to a world in which these hold.

### 7.2 Damage thresholds

| Material | Curve | Onset (in) | 50 % (in) | Provenance |
|---|---|---|---|---|
| Asphalt 3-tab | functional | **1.00** | 1.40 | onset **published** (IIBEC/Smith 2013); 50 % expert |
| Asphalt architectural | functional | **1.25** | 1.75 | onset **published** (IIBEC/Smith 2013); 50 % expert |
| Asphalt (either) | cosmetic | 0.75 | 1.05 | expert — granule scouring |
| Wood shake | functional | **1.50 @ 50 %** | **1.75 @ 90 %** | **published** — Haag Engineering, both anchors |
| Wood shake | cosmetic | 1.00 | 1.30 | expert |
| TPO/PVC | functional | **1.75** | 2.45 | onset **published** (five industry sources; UL 2218 Class 4); shape expert |
| TPO/PVC | cosmetic | 1.25 | 1.55 | expert |
| Metal R-panel | functional | 1.75 | 2.45 | **expert — NO PUBLISHED METAL THRESHOLD FOUND** |
| Metal standing seam | functional | 2.00 | 2.80 | **expert — NO PUBLISHED METAL THRESHOLD FOUND** |
| Metal (either) | cosmetic | 1.25 | **1.50** | **expert — Reid's own confirmed figure, RE-ANCHORED. Needs his sign-off.** |

Values shown at the reference gauge/thickness, before age and thickness factors.

### 7.3 Shape and modifier constants

| Constant | Value | Provenance |
|---|---|---|
| `ONSET_ANCHOR_PROBABILITY` | 0.05 | expert — a published "smallest hail that CAN damage" is a first-possible-damage figure, not a 50 % figure. Anchoring it at 0.50 would roughly **double every functional probability in the engine**. |
| `DEFAULT_HALF_TO_ONSET_RATIO` | 1.40 | expert — ≈ 3.8× impact energy between "first roofs fail" and "half have" |
| `METAL_GAUGE_THRESHOLD_FACTOR` | 29ga 0.92 · 26ga 1.00 · 24ga 1.06 · 22ga 1.12 | expert |
| `MEMBRANE_MIL_THRESHOLD_FACTOR` | 45 mil 0.93 · 60 mil 1.00 · 80 mil 1.07 | expert |
| `AGE_EMBRITTLEMENT_PER_YEAR` | asphalt 0.006 (cap 25 yr) · membrane 0.010 (cap 20 yr) · wood 0.005 (cap 30 yr) · **metal 0** | expert; metal's zero is deliberate (§4.4) |

### 7.4 Swath constants

| Constant | Value | Provenance |
|---|---|---|
| `SWATH_BANDWIDTH_MI` | 3 | expert — literature describes swath widths (1–3 mi), not a Gaussian bandwidth |
| `SWATH_ALONG_TRACK_FACTOR` / `CROSS` | 2.0 / 0.5 | expert; **reciprocal by construction** (§3.2) |
| `MEASURED_WEIGHT_BONUS` | 1.5 | expert |
| `PRIOR_SIZE_IN` / `PRIOR_SIGMA_IN` | 0.60 / 0.45 | expert — a real prior would come from a gridded hail climatology (Phase 2) |
| `SIGMA_MEASURED_IN` / `SIGMA_ESTIMATED_IN` | 0.15 / 0.35 | expert |
| `SIGMA_PER_MILE_IN` | 0.09 in/mi | expert |
| `EXTRAPOLATION_SIGMA_FACTOR` | 1.6 | expert |
| `SIGMA_FLOOR_IN` | 0.10 | expert — irreducible noise; an estimate at an address nobody measured is never exact |
| `BRACKET_MIN_ANGULAR_SPAN_DEG` | 180 | **published** — plane geometry, not a tuning constant |
| `MIN_PHYSICAL_SIZE_IN` | 0.25 | **published** — NWS LSR practice starts at pea size |
| `EARTH_RADIUS_MI` | 3958.7613 | **published** — IUGG mean radius |
| Normal CDF | A&S 7.1.26 | **published** — max abs error 1.5e-7 |

### 7.5 Cluster and claim constants

| Constant | Value | Provenance |
|---|---|---|
| `CONVECTIVE_DAY_START_HOUR_UTC` | 12 | **published** — NOAA/SPC convective-day convention |
| `EVENT_LINK_DISTANCE_MI` | 6 | expert — Phase 2 / meteorological-cell use only |
| `CLAIM_OCCURRENCE_LINK_DISTANCE_MI` | ∞ | **derived from insurance semantics** (§9) — what the engine uses |
| `MOTION_MIN_TIME_SAMPLES` / `SPAN` / `SPEED` | 3 / 10 min / 5–80 mph | expert |
| `CLAIM_WINDOW_MONTHS` | 12 | **`expert-verify-per-policy`** |
| `REPLACE_GIVEN_FUNCTIONAL_NEW` → `_AT_EOL` | 0.50–0.60 → 0.80–0.92 by material | expert — **ideally replaced by FITTED values (§8)** |
| `REPLACE_GIVEN_COSMETIC_ONLY` | 0.15–0.25 by material | expert |
| `DEFAULT_COSMETIC_EXCLUSION` | metal ✓ · membrane ✓ · asphalt ✗ · wood ✗ | expert |
| `REPORTER_QUALITY` | 0.70 (public) – 1.00 (trained spotter / NWS) | expert — no source quantifies per-class LSR hail-size error |
| `SENSITIVITY_HAIL_DELTA_IN` | 0.25 | expert |

---

## 8. CALIBRATION HARNESS (`scripts/hailview-calibrate.ts`)

```
npx tsx scripts/hailview-calibrate.ts <outcomes.csv>
npx tsx scripts/hailview-calibrate.ts --self-test
```

**IT FITS NOTHING.** This run only MEASURES. Every constant stays as it is and
the model version stays `v2.0-uncalibrated` until real outcome data exists and
someone decides, with Reid, what to change. A harness that quietly refitted
constants would make the number unauditable.

### 8.1 CSV schema — fixed column order

| # | Column | Notes |
|---|---|---|
| 1 | `case_id` | |
| 2 | `asof_utc` | ISO 8601. **Required** — re-running today's clock against a 2019 claim would put every event outside the window and score the whole dataset at zero. |
| 3 | `lat` | |
| 4 | `lon` | |
| 5 | `material` | one of the five `MaterialCategory` values |
| 6 | `roof_age_years` | blank allowed |
| 7 | `shingle_type` | `3-tab` \| `architectural` \| blank |
| 8 | `metal_gauge` | `29ga` \| `26ga` \| `24ga` \| `22ga` \| blank |
| 9 | `membrane_mil` | `45` \| `60` \| `80` \| blank |
| 10 | `cosmetic_exclusion` | `true` \| `false` \| blank (blank ⇒ material default) |
| 11 | `observations_json` | JSON array of `HailObservation`, CSV-quoted. **The evidence available AT THE TIME**, not a fresh query — a model is calibrated against what it actually saw. |
| 12 | `outcome` | `approved` \| `denied` \| `partial` |

A wrong header order is **rejected** rather than mapped by guess; a malformed
row **throws** rather than being skipped, because a run silently computed over a
subset would report a Brier score for a dataset nobody chose.

### 8.2 Scoring

- **`partial` counts as a MISS (target 0).** The engine predicts P(**full**
  replacement), so a partial payment or repair is by definition not the event
  being predicted. Scoring it 0.5 would score the model against a different
  question than the one it answers.
- Brier score (mean squared error), plus the **base-rate Brier** and a skill
  score, printed together — the model only earns its keep by beating "always
  predict the base rate".
- Reliability table over bands 0–0.1, 0.1–0.2, 0.2–0.4, 0.4–0.6, 0.6–0.8,
  0.8–1.0. The last band is closed at 1.0 so a prediction of exactly 1 lands
  somewhere; the rest are half-open so no case is counted twice.
- Any `guardFlags` raised while re-running the dataset are printed.

### 8.3 BLOCKER — no calibration data exists

**No real claim-outcome dataset has been supplied.** `--self-test` runs three
**synthetic** cases so the harness itself is testable; nothing resembling claim
data is committed, because a plausible-looking fabricated CSV would start
looking like evidence. Until real outcomes arrive, every probability this engine
reports is an uncalibrated model output and the UI says so.

---

## 9. ONE CONVECTIVE DAY IS ONE OCCURRENCE

`cluster.ts` can group spatially (`EVENT_LINK_DISTANCE_MI`), but **the engine
passes `CLAIM_OCCURRENCE_LINK_DISTANCE_MI = ∞`**, so one convective day at one
address is one event.

**This is an insurance fact, not a meteorological one.** A policy pays per
OCCURRENCE, identified by a date of loss: if two separate cells cross the same
roof in one afternoon, the homeowner files one claim for that date, not two.

**It was measured, not assumed.** Against the recorded Burnet fixture at a
12-mile radius, a 6-mile link distance split **8 of 12 convective days** and
turned them into **22 events** — one 2026-05-06 storm date became two hazards,
one 2025-05-16 date became four. Each would then have entered `claims.ts` as an
independent hazard and inflated the probability: root cause #5's over-counting,
reintroduced one level down. `golden.test.ts` pins both numbers.

**Nothing is lost by merging, because distance is already handled, and handled
better.** `swath.ts` weights every report by its distance from the address with
a 3-mile kernel, so a report from the far cell contributes almost nothing to the
estimate at this roof. A hard cluster boundary would be a cruder version of the
same discrimination, applied twice.

---

## 10. TESTS

| File | Covers |
|---|---|
| `lib/hailview/v2/cluster.test.ts` | convective-day boundary, same-day collapse, spatial split, swath chaining, order independence, storm-motion accept/reject bands |
| `lib/hailview/v2/swath.test.ts` | distant-report behaviour, bracketing (geometry isolated from distance), two-report interpolation, measured weighting, anisotropy and its area-neutrality, exceedance monotonicity, quadrature sum, quantile ordering |
| `lib/hailview/v2/engine.test.ts` | determinism, **cross-material rationality**, monotonicity in size/age/gauge/mil, cosmetic toggle, no-hail ≤ 0.03, claim window, range/grade/legacy shape, guard invariants |
| `lib/hailview/v2/golden.test.ts` | the whole pipeline against the **recorded live response** |
| `lib/hailview/v2/calibrate.test.ts` | CSV schema, strict rejection, `partial`-is-a-miss, `asof` honoured, report wording |
| `lib/hailview/explanation.test.ts` | flag validation, invented kinds/severities dropped, no numeric field |

**The fixture:** `lib/hailview/__fixtures__/burnet-tx-lsr.json` — a real IEM LSR
response recorded 2026-10-08 for central Burnet, TX, **coordinates rounded to 2
decimals** (all the feed itself resolves to, and it keeps a specific house out of
a committed file). 67 recorded features → 59 inside the true 12-mile circle → 58
after removing one **byte-identical duplicate row** the feed really served. 12
convective days; largest storm 4.00″ on 2024-04-09. The fixture carries its own
frozen `nowUtc` so the claim-window logic is stable forever.

---

## 11. PHASE 2 — OUT OF SCOPE, DO NOT BUILD YET

Phase 1 implements **one** `EvidenceSource`. The interface exists so these plug
in without reshaping the pipeline.

### 11.1 NOAA MRMS MESH radar swaths — **feasibility spike FIRST**

The highest-value addition by far: gridded radar-derived maximum estimated hail
size, which would replace point reports with actual swath coverage and remove
most of §3's extrapolation uncertainty.

**Two reasons it is not simply queued as a build:**

1. **MESH IS INTENTIONALLY BIASED HIGH.** It is tuned to over-warn, and it
   notably **overestimates 1–2 in hail** — exactly the range where every
   material's functional onset sits, so raw MESH would inflate the number
   precisely where accuracy matters most. **It needs a documented bias
   correction before it may touch scoring**, and that correction needs
   validating against the LSR reports already available.
2. **Archive access and GRIB2 parsing on Vercel are unproven.** MRMS archives
   are large GRIB2 files; decoding them needs a native-ish toolchain, and
   whether that is viable inside a Vercel serverless function (bundle size,
   cold start, memory, execution limit) is **not known**.

**Required spike, before any commitment:** confirm (a) a stable archive
endpoint and its licensing, (b) GRIB2 decode working within Vercel's limits —
or establish that a pre-processing step outside Vercel is needed, and (c) a
bias-correction approach validated against known LSR reports. Report findings;
do not build the integration on the strength of this document.

### 11.2 Also Phase 2, lower risk

- **SPC daily reports** — a second, differently-curated view of the same events.
- **NOAA Storm Events Database** — authoritative, quality-controlled, but
  published on a months-long lag. Good for calibration, not for a live lookup.
- **CoCoRaHS** — volunteer observer network; already appears *inside* the LSR
  feed as a reporter class, so direct integration adds reach, not a new class.
- **Open-Meteo wind in scoring.** Wind is currently **context only** and must
  stay that way until there is a defensible wind-driven-hail model. Note the
  unresolved commercial-licensing question in `lib/hailview/wind.ts`: the free
  tier is non-commercial-use only, so wind context is omitted rather than taken
  from an endpoint AFS is not licensed to use.

---

## 12. OPEN BLOCKERS

| Blocker | Detail |
|---|---|
| **Calibration data** | No real claim-outcome dataset exists. Every probability is an uncalibrated model output; the UI and the email both disclose it. §8.3 |
| **Metal constants need Reid's field validation** | No published metal hail-damage threshold was found. **Every** metal damage threshold is `expert`. Specifically: his confirmed flat 1.5 in figure has been **re-anchored as the COSMETIC 50 % point** rather than a replacement threshold, and that interpretive change **needs his sign-off**. §7.2 |
| **Claim window is a policy term** | `CLAIM_WINDOW_MONTHS = 12` is `expert-verify-per-policy`. Must be verified per carrier/state before anyone relies on it. §5.3 |
| **MRMS feasibility unknown** | §11.1 — spike before building. |
| **Open-Meteo commercial licensing** | Unresolved; wind stays context-only and is omitted when unlicensed. §11.2 |
| **Geocoding gap** | OpenStreetMap/Nominatim does not know every street. Verified 2026-10-08: "209 Surecast Drive, Burnet, TX" returns NO MATCH in every variant tried; "Burnet, TX 78611" resolves to the city centroid (30.7609, −98.2240). A centroid is a legitimate result for a town-scale lookup but is **not** the roof, and at grade A/B the difference matters. |

---

*SPEC_HAILVIEW_V2.md | AFS — Architectural Flashing Supply | Reid Whitesides | Phase 1 built, uncalibrated | 2026-10-08*
