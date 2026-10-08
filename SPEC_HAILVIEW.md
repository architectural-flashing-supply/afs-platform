# SPEC_HAILVIEW.md
## AFS — HailView: Multi-Material Hail/Wind Replacement-Probability Tool
**Owner:** Reid Whitesides | Visual AI Method
**Status:** BUILT. **Section 5 SUPERSEDED — see SPEC_HAILVIEW_V2.md.**
**Location:** New section within the existing `afs-website` Next.js codebase

---

> ## ⚠ SECTION 5 IS SUPERSEDED BY SPEC_HAILVIEW_V2.md (2026-10-08)
>
> **`SPEC_HAILVIEW_V2.md` is the authority on all scoring.** Section 5 below —
> the four per-material `HAIL_TIERS` point tables and their age curves — is kept
> for provenance and must NOT be implemented. `lib/hailview/replacement-score.ts`,
> which implemented it, has been deleted. The engine is now `lib/hailview/v2/**`.
>
> **WHY.** A real test at one Burnet, TX address scored a 16-year-old asphalt
> shingle roof **60** and a 24 ga standing seam metal roof **81** on identical
> hail. That is backwards, and it had six distinct causes, all in Section 5's
> design: the four point tables were never on a common scale; an additive age
> term contributed ~25 points with **zero** hail; there was no cosmetic-versus-
> functional distinction and no claims logic at all; `metalGauge` was collected
> and never used; reports were treated as point facts with no spatial reasoning,
> event grouping, uncertainty or claim window; and nothing tested cross-material
> rationality. Full analysis: SPEC_HAILVIEW_V2.md §0.
>
> ### What REMAINS BINDING from this document
>
> - **§1 and §6 — the determinism contract.** Unchanged and still the one
>   non-negotiable rule. V2 is built to protect it: the number comes from pure,
>   auditable code with no model call and no clock read inside scoring, and the
>   agent receives an already-final result. V2 adds `guard.ts`, a deterministic
>   invariant re-check that can only ever ANNOTATE a result, never alter it.
> - **§2 — the excluded scope.** No Facebook/social data source, no geographic
>   triangulation of social mentions, no inferred-address campaigns. Untouched.
>   (V2's "triangulation" is of NWS storm reports around one address the user
>   typed in themselves — a different thing entirely from §2's exclusion.)
> - **§4 — the data sources**, with one change: §4.2's ~1-mile radius is now the
>   **display** radius for the raw report timeline. The engine queries **12
>   miles**, because V2 estimates the hail size AT the address and that needs
>   reports on more than one side of it. Measured live 2026-10-08 at Burnet: 12
>   hail reports within 1 mile over 5 years against 102 within 15 miles — the
>   narrow radius was discarding nearly all the evidence. §4.2's never-cap-hail
>   fix is preserved. §4.3's unresolved Open-Meteo commercial-licensing question
>   is still unresolved, and wind is still context only, never a scoring input.
> - **§7 and §8 — the UI and the consent-based email capture.** Both still apply;
>   both were extended in V2 (probability with range, evidence-grade badge,
>   per-storm table, claim-window labels, sensitivity note, uncalibrated
>   disclosure, and a `cosmeticExclusion` control).
>
> ### ⚠ §5.2's "flat 1.5 in metal onset, confirmed by Reid" — REPLACED, NEEDS SIGN-OFF
>
> §5.2 recorded a **flat 1.5 in cosmetic-damage onset for metal, confirmed
> directly by Reid from field experience**, and stated that gauge is display-only
> and never modulates severity. V1 then scored that 1.5 in figure as though it
> were a **replacement** threshold, which is the single most direct cause of the
> reversal above: a dent in a watertight metal panel counted as replacement-worthy.
>
> V2 replaces it with a **cosmetic/functional split**:
>
> - Reid's 1.5 in is **kept**, re-anchored as the **50 % point of the COSMETIC
>   (denting) curve** — "the size at which a metal roof visibly dents" reads as a
>   half-damage figure, not a first-possible-damage figure.
> - **FUNCTIONAL** failure of a metal panel (fracture, puncture, seam or fastener
>   failure that breaches water-shedding) is modelled separately and much higher:
>   expert onsets of 1.75 in (R-panel) and 2.00 in (standing seam) at 26 ga.
> - Cosmetic damage contributes to the claim probability **only when the policy
>   does not exclude it**, and the default for metal is that it **does** —
>   cosmetic-exclusion endorsements are near-standard on metal roofs.
> - **Gauge now IS a scoring input**, contrary to §5.2, via a monotonic
>   threshold factor (29ga 0.92 → 22ga 1.12).
>
> **NO PUBLISHED METAL HAIL-DAMAGE THRESHOLD WAS FOUND, so every metal constant
> in V2 is tagged `expert` and NEEDS REID'S FIELD VALIDATION.** The re-anchoring
> of his own confirmed 1.5 in figure is an interpretive change to a number he
> personally supplied, and it **needs his explicit sign-off** before the metal
> results are relied on. SPEC_HAILVIEW_V2.md §7.2 and §12.
>
> Published anchors that V2 does rest on: **IIBEC / Smith (2013)** — smallest
> hail capable of functional damage is 1.0 in for 3-tab and 1.25 in for laminated
> asphalt, and granule loss alone is **not** functional damage; and **Haag
> Engineering**'s graduated wood-shake damage rates, which §5.4 already cited.

---

## 1. PROVENANCE & IP STATUS

Reid personally built and owns the original implementation of this concept at
e4roofing.com. He has explicitly authorized reuse of that code's **logic and
architecture** in AFS's own codebase. He has explicitly **excluded** reuse of
that project's video and image assets — HailView uses only original visuals,
built from AFS's own design tokens (per `DESIGN_TOKENS.md`).

The original implementation's own code comments describe a deliberate design
principle that this spec preserves throughout: **the numeric score is
entirely deterministic and auditable — no model/agent call is ever permitted
inside the scoring path itself.** This is a defensibility requirement, not a
style preference, and every phase below is written to protect it.

---

## 2. EXPLICIT OUT OF SCOPE

Two things Reid originally envisioned are **not** part of this build, for
reasons established during scoping and confirmed via direct research —
documented here so they are not silently reconsidered later:

1. **Any Facebook/social-media data source.** Meta fully deprecated
   third-party Facebook Groups API access in 2024 (Graph API v19.0, all
   Groups permissions removed within a 90-day sunset). There is no
   legitimate API path to scanning Groups content for address/street/hail
   mentions. Scraping Facebook against its Terms of Service is a real legal
   and account-suspension risk to AFS, not a technical detail to route
   around, and is explicitly excluded.
2. **Geographic triangulation of social mentions and automated targeted
   email campaigns built from inferred addresses.** Independent of the
   Facebook API issue above, this raises real CAN-SPAM consent questions and
   reputational risk that need dedicated legal review before any code is
   written. Not scoped here, not stubbed, not hinted at in the UI.

What **is** in scope, and is a genuinely strong, real, differentiated
product: an address-based lookup tool where a homeowner or PM/GC enters
their own address and receives a data-backed replacement-probability score
for their own roof, with an option to have their own result emailed to
them (consent-based, single-user — not a marketing list).

---

## 3. ARCHITECTURE OVERVIEW

```
User enters address + material type + material sub-details
        |
        v
[Geocode]  --- Nominatim (OpenStreetMap) ---> lat/lon
        |
        v
[Storm/Hail History]  --- IEM Local Storm Reports feed ---> hail + wind events, 5yr, ~1mi radius
        |
        v
[Wind Detail]  --- Open-Meteo Historical Weather API ---> hourly wind speed + direction
        |
        v
[DETERMINISTIC SCORING ENGINE]  (per material type — see Section 5)
        |
        v  (score + tier + sub-factors, already final and immutable)
        v
[AGENTIC SYNTHESIS LAYER]  (writes the explanation ONLY — see Section 6)
        |
        v
[UI: score, tier, storm timeline, written explanation]
        |
        v (optional, consent-based)
[Email-me-my-results capture]  --- Resend, if configured ---> user's own inbox
```

---

## 4. DATA SOURCES — EXACT TECHNICAL DETAIL

### 4.1 Geocoding — OpenStreetMap Nominatim

- **Endpoint:** `https://nominatim.openstreetmap.org/search`
- **Params:** `q=<address>`, `format=json`, `limit=1`, `countrycodes=us`
- **Required header:** a descriptive `User-Agent` per Nominatim's usage
  policy (`https://operations.osmfoundation.org/policies/nominatim/`) — not
  a secret, but a policy requirement. Use something like
  `AFS-HailView/1.0 (https://architecturalflashingsupply.com)` — do NOT
  reuse the old e4roofing User-Agent string.
- **Rate limit:** Nominatim's public instance is limited to roughly 1
  request/second per the same usage policy — HailView's expected query
  volume is far under this, but the build should not remove this
  consideration if caching/retry logic is added later.
- **Response shape:** array of results; take `[0].lat`, `[0].lon`,
  `[0].display_name`.

### 4.2 Storm/Hail History — Iowa Environmental Mesonet Local Storm Reports

- **Endpoint:** `https://mesonet.agron.iastate.edu/geojson/lsr.py`
- **Params:** `west`, `east`, `north`, `south` (bounding box), `sts`, `ets`
  (ISO start/end timestamps)
- **Radius:** ~1 mile around the geocoded point, longitude-corrected for
  latitude (`lonDelta = radiusMiles / (69 * cos(lat_in_radians))`,
  `latDelta = radiusMiles / 69`). This is deliberately narrow — hail cores
  are often under a mile wide at peak intensity, so a wider radius pulls in
  unrelated storms and produces a less trustworthy score.
- **Lookback:** 5 years.
- **Report type filter:** `HAIL`, `TSTM WND GST`, `TSTM WND DMG`,
  `NON-TSTM WND GST`, `NON-TSTM WND DMG`, `TORNADO`. Excludes flood/
  snow/lightning report types the same feed also carries.
- **CRITICAL — a real, already-discovered bug to not regress:** non-hail
  reports (routine wind gusts) vastly outnumber hail reports in a typical
  window. If the combined, recency-sorted report list is naively sliced to
  the most-recent N, wind gusts can crowd genuinely significant older hail
  events entirely out of the response. Fix: hail reports are NEVER capped;
  only the non-hail remainder is capped (at 150), so total payload size
  stays bounded without ever excluding real hail history.
- **Response fields used:** `typetext`, `magnitude`, `unit`, `valid`
  (timestamp), `city`, `county`, `state`, `remark`, `lat`, `lon`.

### 4.3 Wind Speed + Direction — Open-Meteo Historical Weather API

- **Endpoint:** Open-Meteo's historical/archive API (verify the exact
  current path against their live docs at build time — their
  forecast API is `https://api.open-meteo.com/v1/forecast`; historical
  data has historically lived at a separate `archive-api.open-meteo.com`
  host. Do not hardcode from this document without confirming live.)
- **Expected params:** `latitude`, `longitude`, `start_date`, `end_date`,
  `hourly=windspeed_10m,winddirection_10m`.
- **Cost/licensing — UNRESOLVED, MUST BE VERIFIED BEFORE USE:** Open-Meteo's
  published terms describe no-authentication access as being for
  non-commercial use. AFS is a commercial entity. Before this integration
  ships, confirm directly against Open-Meteo's current terms/pricing page
  whether their free tier's usage terms actually cover a commercial site's
  usage pattern, or whether their paid commercial tier is genuinely
  required. Do not assume either answer — check and document what was
  found.
- **Data coverage:** hourly resolution, available from 1940 onward,
  reanalysis-based (blends station, radar, satellite data — not a single
  point sensor), CC BY 4.0 licensed data.

---

## 5. SCORING ENGINE — PER MATERIAL, WITH REAL CITED THRESHOLDS

All four scoring functions must remain independently deterministic and
auditable. No model call inside any of these functions.

### 5.1 Asphalt Shingle (3-Tab / Architectural) — REUSE UNCHANGED

Reuse Reid's existing formula from the e4roofing codebase verbatim,
including:
- `HAIL_TIERS` size-based point table (0.75"→0.5pt, 1.0"→1.5pt,
  1.25"→4pt, 1.75"→7pt, unbounded→12pt)
- Typical lifespan: 3-tab 17.5yr, architectural 27.5yr
- 3-tab flat risk bonus: +8 points (greater brittleness at equal age)
- Age-adjusted severity multiplier (1.0x under 10yr, 1.2x at 10-15yr,
  1.45x at 15-20yr, 1.7x at 20yr+, plus up to +0.3 bonus once past typical
  lifespan ratio, capped at 2.0x total)
- Escalating qualifying-event weight once age ≥10yr (+15% per additional
  qualifying event, capped at 2.5x)
- Final formula: age subscore (0-56, additive) + shingle bonus (0 or 8) +
  hail severity subscore (0-60, age-multiplied) + frequency subscore
  (0-20) = raw score, capped at 100.
- Tiers: Low <35, Moderate 35-64, High ≥65.

### 5.2 Metal Roofing (R-Panel / Standing Seam)

**Cosmetic damage onset: flat 1.5" hail diameter, NOT gauge-scaled.**
Confirmed directly by Reid from field experience — gauge affects which
dropdown option is selected and displayed, but does not modulate score
severity in this version.

**Sub-type inputs (dropdown, display/record-keeping only, not a severity
multiplier per the above):**
| Sub-type | Gauge options | Basis |
|---|---|---|
| R-Panel (exposed fastener) | 29ga, 26ga, 24ga | Standard industry convention for residential through heavy-duty commercial — flag as convention, not a single official spec, in case Reid's own field experience differs once reviewed |
| Standing Seam | 26ga (residential), 24ga (commercial), 22ga (heavy-duty commercial) | Reid's own stated values |

**Formula:** binary/step function — any qualifying hail event ≥1.5" sets a
base severity score; age still applies as an additive factor (a 25-year-old
metal roof is not equivalent to a 2-year-old one even at identical hail
exposure) but does NOT use the shingle-specific age-multiplier curve, since
metal's failure mode (denting, not granule loss/mat fracture) is physically
different. Recommend a simpler, separately-derived age curve for metal
specifically — do not port the shingle age curve unmodified.

### 5.3 TPO / PVC Commercial Membrane

**Cosmetic/functional damage onset: 1.75" hail diameter.** Cross-referenced
across five independent industry sources, consistent with the UL 2218
Class 4 impact resistance test standard.

**Modulating factor: membrane thickness (45 / 60 / 80 mil dropdown).**
Thinner membranes fail at smaller hail sizes than the 1.75" baseline;
thicker membranes hold up better. Age also matters independently — aged,
UV-degraded membranes lose flexibility and can fail at hail sizes well
under 1.75" (multiple sources describe a 10-year-old membrane fracturing
under hail a new one would survive).

**Formula:** onset threshold (1.75") adjusted by a thickness modifier
(thinner = lower effective threshold, thicker = higher) and an age
modifier (older = lower effective threshold), analogous in structure to
the shingle age-multiplier but with TPO/PVC-specific curve shape — do not
assume the shingle curve's exact numbers transfer.

### 5.4 Wood Shake — GRADUATED TIER TABLE (real graduated data, not a single threshold)

Based on actual Haag Engineering forensic testing (a named, credible
source, not a marketing claim):

| Hail diameter | Real-world finding |
|---|---|
| ~1.25" | Hairline fractures begin |
| ~1.5" | ~50% of tested heavy cedar shake panels showed damage |
| ~1.75"+ | ~90% of tested heavy cedar shake panels showed damage |

**Formula:** build this as a `HAIL_TIERS`-style array (matching the
existing shingle implementation's pattern), NOT a single if/else threshold
— e.g. `{max: 1.25, points: X}, {max: 1.5, points: Y}, {max: 1.75,
points: Z}, {max: Infinity, points: W}`, with actual point values chosen
so the resulting 0-100 score reflects the real ~50%/~90% damage-rate
jumps at those breakpoints. Age modulates this the same conceptual way as
shingles (older wood is more brittle, documented across multiple sources).

---

## 6. AGENTIC SYNTHESIS LAYER

**Strict separation of concerns — this is the one non-negotiable rule of
the entire system:**

> The agent NEVER decides, computes, or alters the numeric score or tier.
> It only receives an already-final score/tier/sub-factor breakdown and
> writes a coherent, readable explanation from it.

- **Model:** `claude-sonnet-4-6`, per this project's existing AI-call
  convention (see `SPEC_AI_CHATBOT.md` / existing chatbot integration for
  the established pattern of calling this model in this codebase).
- **Input contract:** the deterministic score, tier, material type and
  sub-details, the real storm event list (dates, sizes), wind
  speed/direction context from Open-Meteo, and the roof age.
- **Output contract:** a written explanation only — no numeric fields in
  the agent's response should ever be read back into the score. Enforce
  this in code, not just by convention (e.g. the agent's response type
  should not even have a numeric field available to accidentally wire up).
- **Purpose of using an agent here at all, rather than a template string:**
  synthesizing genuinely variable real-world narratives (which storms
  mattered most, how wind direction affected exposure, how the specific
  material's failure mode explains the risk) reads far better than a
  fixed template, without sacrificing the auditability of the number
  itself.

---

## 7. UI/UX

- New route inside the existing `afs-website` app router (e.g.
  `app/hailview/page.tsx`), using this project's existing design tokens
  (`afs-crimson`, `afs-chrome-*`, `afs-bg-*` per `DESIGN_TOKENS.md`) — no
  visual assets from e4roofing.
- Flow: address input → material type selector → conditional sub-inputs
  (gauge dropdown for metal, mil dropdown for TPO/PVC, roof age for all) →
  results view (score, tier, storm history timeline, written explanation).
- No stock photography or ported video — visual treatment should match
  this codebase's existing clean, data-driven presentation style (e.g. the
  dimension-callout visual language already used in FlashDraft).

---

## 8. EMAIL-ME-MY-RESULTS CAPTURE (legitimate, consent-based — distinct from the excluded lead-gen concept)

A simple, single-purpose form: the user types their own email address to
receive a copy of their own lookup result. This is NOT the excluded
social-media-inferred marketing list from Section 2 — the user is
explicitly requesting their own data, a completely standard and low-risk
pattern. Uses this project's existing Resend integration if configured; if
Resend isn't live yet (per this project's known Phase 4 status), this
feature should degrade gracefully — report that email delivery isn't
available yet without breaking the rest of the tool.

---

## 9. PHASED BUILD PLAN

Given how much genuinely new surface area this system covers (three
external API integrations, four independently-correct scoring formulas, an
agentic layer, a full UI, and an email feature), this is built as a real
sequence of independently verified phases — not one prompt. This mirrors
the lesson already learned tonight on a much smaller feature (the 3D
paint-face bug took three separate attempts when it was treated as "one
fix"); a system this size deserves proper phasing from the start, not
after something goes wrong.

**Phase 1 — Data Pipeline Only.** Geocoding + IEM storm data + Open-Meteo
wind data, wired to a bare internal test endpoint (no scoring, no UI, no
agent). Success criterion: a real address produces real, correct
geocoded coordinates, a real storm event list, and real wind data,
independently verified against each source's own raw response — not
assumed working because the code compiles.

**Phase 2 — Scoring Engine, All Four Materials.** Built and tested against
Phase 1's real data, with unit-level verification that each material
produces a genuinely distinct, correctly-tiered score against the same
storm history — not just that the code runs without throwing.

**Phase 3 — UI.** Wires Phases 1-2 into the actual page, using real data
end-to-end, no agent yet (a plain, temporary text summary can stand in for
the explanation at this stage).

**Phase 4 — Agentic Synthesis Layer.** Replaces the temporary summary with
the real agent-generated explanation, with explicit verification that the
agent never overrides the deterministic score.

**Phase 5 — Email Capture.** Added last, since it depends on nothing else
being uncertain.

Each phase gets its own FORGE prompt and its own live verification before
the next phase begins.

---

*SPEC_HAILVIEW.md | AFS — Architectural Flashing Supply | Reid Whitesides | Draft*
