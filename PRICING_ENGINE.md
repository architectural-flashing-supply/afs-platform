# PRICING_ENGINE.md
## AFS — Internal Pricing Engine
**Admin and estimator access only. Never customer-facing.**
**Customers see prices only on formal AFS-generated quotes delivered to their portal.**

---

## 1. WHAT THIS IS

The pricing engine is AFS's internal quoting intelligence. When a quote request
arrives from a customer, an estimator opens it in the admin portal. The engine
pre-populates suggested line item prices based on:

1. Current metal commodity prices (pulled daily from market data feeds)
2. AFS fabrication cost rules per product type
3. Target margin percentages
4. Historical supplier price trend analysis
5. Contractor-specific negotiated rates where applicable

The estimator reviews, adjusts if needed, and approves before the formal quote
is sent to the customer. The customer sees only the final approved price — never
the internal cost breakdown, never the margin, never the commodity data.

---

## 2. COMMODITY DATA FEEDS

Metal prices fluctuate. The engine stays current by pulling commodity close
prices daily after market hours.

```typescript
// Commodities tracked — maps to materials.commodity_key
interface CommodityFeed {
  key:              string;
  displayName:      string;
  currentPriceLb:   number;
  priorDayPriceLb:  number;
  priorWeekPriceLb: number;
  priorMonthPriceLb:number;
  lastUpdated:      string;
  dataSource:       string;
  isManual:         boolean;
}

const COMMODITY_MAP = {
  copper:               { apiSymbol: 'XCU', displayName: 'Copper (COMEX HG)' },
  aluminum:             { apiSymbol: 'ALI', displayName: 'Aluminum (LME)' },
  zinc:                 { apiSymbol: 'ZNC', displayName: 'Zinc (LME)' },
  steel_hrc:            { apiSymbol: 'HRC', displayName: 'Steel HRC (CME)' },
  stainless_surcharge:  { apiSymbol: 'SS_SURCH', displayName: 'Stainless Surcharge' },
  galvalume:            { apiSymbol: 'GAL', displayName: 'Galvalume Composite' },
};
```

**Primary data source:** Metals API (metals-api.com) — covers all required commodities.
**Fallback:** Alpha Vantage commodity endpoint for copper and aluminum.
**Manual entry:** Admin can enter prices manually if API is unavailable.
**Update schedule:** Vercel Cron daily at 5pm CT (after US market close, before next day's shop starts).

---

## 3. PRICE CALCULATION ALGORITHM

```typescript
// lib/pricing/engine.ts — SERVER ONLY

interface PricingInput {
  productId:             string;
  materialId:            string;
  gaugeId:               string | null;
  widthIn:               number | null;
  heightIn:              number | null;
  legAIn:                number | null;
  legBIn:                number | null;
  lengthFt:              number;
  quantity:              number;            // number of pieces
  isRush:                boolean;
  contractorDiscountPct: number;            // 0 for standard accounts
}

interface PricingOutput {
  // What the estimator sees in admin UI:
  developedLengthIn:    number;            // Total metal width consumed per LF
  weightPerLfLbs:       number;            // Weight calculation
  materialCostPerLf:    number;            // Commodity price × weight × multiplier
  fabricationCostPerLf: number;            // Fixed fab cost from pricing_rules
  totalCostPerLf:       number;            // Material + fab + overhead
  suggestedPricePerLf:  number;            // Cost / (1 - margin_pct)
  rushSurcharge:        number;            // 0 if not rush
  contractorDiscount:   number;            // 0 if standard
  finalPricePerLf:      number;            // After all adjustments
  adjustedQuantityLf:   number;            // quantity × lengthFt × wasteFactor
  lineTotal:            number;            // finalPrice × adjustedQty
  actualMarginPct:      number;            // Actual margin at final price
  trendRisk:            'none'|'watch'|'flag';
  trendNote:            string | null;

  // What goes onto the formal quote (customer-visible):
  quotedPricePerLf:     number;            // = finalPricePerLf (estimator approved)
  quotedLineTotal:      number;            // = lineTotal
}

export async function calculateLineItemPrice(
  input: PricingInput,
  supabase: SupabaseClient
): Promise<PricingOutput> {

  // Step 1: Fetch pricing rule for this product
  const { data: rule } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('product_id', input.productId)
    .eq('is_active', true)
    .single();

  if (!rule) throw new Error(`No pricing rule for product ${input.productId}`);

  // Step 2: Fetch today's commodity price for this material
  const { data: material } = await supabase
    .from('materials')
    .select('commodity_key, density_lbs_per_cubic_in')
    .eq('id', input.materialId)
    .single();

  const { data: commodityRow } = await supabase
    .from('commodity_prices')
    .select('price_per_lb')
    .eq('commodity', material.commodity_key)
    .order('price_date', { ascending: false })
    .limit(1)
    .single();

  const commodityPriceLb = commodityRow?.price_per_lb ?? 0;

  // Step 3: Fetch gauge thickness
  let thicknessIn = 0.036; // Default 20ga galvanized
  if (input.gaugeId) {
    const { data: gauge } = await supabase
      .from('gauges')
      .select('thickness_inches')
      .eq('id', input.gaugeId)
      .single();
    thicknessIn = gauge?.thickness_inches ?? thicknessIn;
  }

  // Step 4: Compute developed length
  // Sum of all face dimensions = total flat metal width consumed per linear foot
  const developedLengthIn =
    (input.widthIn  ?? 0) +
    (input.heightIn ?? 0) +
    (input.legAIn   ?? 0) +
    (input.legBIn   ?? 0);

  // Step 5: Weight per linear foot
  // (developed length in feet) × thickness (ft) × density (lbs/ft³ converted)
  const densityLbsPerCubicIn = material.density_lbs_per_cubic_in ?? 0.0975; // aluminum default
  const weightPerLfLbs = (developedLengthIn / 12) * thicknessIn * densityLbsPerCubicIn * 12;

  // Step 6: Material cost per LF
  const materialCostPerLf = weightPerLfLbs * commodityPriceLb * rule.material_cost_multiplier;

  // Step 7: Total cost per LF (material + fabrication + overhead)
  const fabricationCostPerLf = rule.fabrication_cost_lf ?? 0;
  const totalCostPerLf = (materialCostPerLf + fabricationCostPerLf) * (1 + rule.overhead_pct);

  // Step 8: Suggested price at target margin
  let suggestedPricePerLf = totalCostPerLf / (1 - rule.margin_pct);

  // Step 9: Rush surcharge
  const rushSurcharge = input.isRush
    ? suggestedPricePerLf * rule.rush_surcharge_pct
    : 0;

  // Step 10: Volume discount (based on total LF in this line item)
  const totalLf = input.quantity * input.lengthFt;
  const discountPct = resolveVolumeDiscount(totalLf, rule);
  const volumeDiscount = suggestedPricePerLf * discountPct;

  // Step 11: Contractor discount
  const contractorDiscount = suggestedPricePerLf * input.contractorDiscountPct;

  // Step 12: Final price
  const finalPricePerLf = suggestedPricePerLf + rushSurcharge - volumeDiscount - contractorDiscount;

  // Step 13: Adjusted quantity with waste factor
  const adjustedQuantityLf = Math.ceil(totalLf * rule.waste_factor);
  const lineTotal = round2(finalPricePerLf * adjustedQuantityLf);

  // Step 14: Actual margin
  const actualMarginPct = (finalPricePerLf - totalCostPerLf) / finalPricePerLf;

  // Step 15: Trend risk
  const trend = await getLatestTrendAnalysis(input.materialId, supabase);
  const trendRisk = resolveTrendRisk(trend, actualMarginPct, rule.margin_pct);

  return {
    developedLengthIn,
    weightPerLfLbs:    round4(weightPerLfLbs),
    materialCostPerLf: round4(materialCostPerLf),
    fabricationCostPerLf: round4(fabricationCostPerLf),
    totalCostPerLf:    round4(totalCostPerLf),
    suggestedPricePerLf: round4(suggestedPricePerLf),
    rushSurcharge:     round4(rushSurcharge),
    contractorDiscount: round4(contractorDiscount),
    finalPricePerLf:   round4(finalPricePerLf),
    adjustedQuantityLf,
    lineTotal,
    actualMarginPct:   round4(actualMarginPct),
    trendRisk,
    trendNote: trend?.margin_risk_note ?? null,
    quotedPricePerLf:  round4(finalPricePerLf),
    quotedLineTotal:   lineTotal,
  };
}

function resolveVolumeDiscount(totalLf: number, rule: PricingRule): number {
  if (rule.tier_3_qty && totalLf >= rule.tier_3_qty) return rule.tier_3_discount_pct ?? 0;
  if (rule.tier_2_qty && totalLf >= rule.tier_2_qty) return rule.tier_2_discount_pct ?? 0;
  if (rule.tier_1_qty && totalLf >= rule.tier_1_qty) return rule.tier_1_discount_pct ?? 0;
  return 0;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
```

---

## 4. TREND PROJECTION ENGINE

Runs nightly. Compares commodity price movement to historical supplier price
increases. Flags when margin is at risk.

```typescript
// lib/pricing/trends.ts

export async function computeTrendAnalysis(
  materialId: string,
  supabase: SupabaseClient
): Promise<void> {

  // 1. Pull last 365 days of commodity_prices for this material
  // 2. Calculate 30d, 90d, 365d % changes
  // 3. Pull supplier_price_history for this material (last 3 years)
  // 4. Calculate Pearson correlation between supplier prices and commodity prices
  //    over matching date ranges
  // 5. Project supplier cost in 30/60/90 days:
  //    projected_30d = latest_supplier_price * (1 + (commodity_30d_change * correlation))
  // 6. Calculate whether projected cost threatens current margin targets:
  //    margin_risk = (projected_30d > current_supplier_price * 1.05)
  // 7. Set risk level:
  //    'none':  projected change < 3%
  //    'watch': projected change 3–8%
  //    'flag':  projected change > 8%
  // 8. Generate margin_risk_note:
  //    "Copper up 14.2% in 30 days. Historical correlation with supplier costs: 0.87.
  //     Projected supplier cost increase ~12.4% in 30 days.
  //     Current margin 35% → projected 25% if prices hold.
  //     Recommend reviewing quoted prices for copper orders."
  // 9. Upsert pricing_trend_analysis record

}

function resolveTrendRisk(
  trend: PricingTrendAnalysis | null,
  currentMargin: number,
  targetMargin: number
): 'none' | 'watch' | 'flag' {
  if (!trend || !trend.commodity_30d_change_pct) return 'none';
  const abs30d = Math.abs(trend.commodity_30d_change_pct);
  if (abs30d > 0.08 || currentMargin < targetMargin * 0.8) return 'flag';
  if (abs30d > 0.03) return 'watch';
  return 'none';
}
```

---

## 5. ADMIN PRICING DASHBOARD (`/admin/pricing`)

What AFS estimators see when they open the pricing section.

```
Section 1 — Today's Commodity Prices
  Table: Material | Commodity | $/lb today | 24hr Δ | 30d Δ | Trend
  Last updated timestamp
  [Refresh] button → manual trigger of commodity fetch
  [Enter Manually] button → modal for manual price entry

Section 2 — Margin Risk Alerts
  Cards for materials with margin_risk_flag = true
  Red/amber border. Risk note. Recommended action.
  "Dismiss" option (logged in audit)

Section 3 — Pricing Rules Editor
  Per-product editable table:
    Fabrication cost / LF | Overhead % | Target margin % | Waste factor
    Rush surcharge % | Volume tier 1/2/3 qty and discount %
  [Save] → updates pricing_rules + admin_audit_log entry
  Before/after comparison shown on save

Section 4 — Historical Price Chart
  Recharts line chart: commodity $/lb vs average quoted $/LF over time
  Visualizes margin compression or expansion
  Date ranges: 30d / 90d / 1yr

Section 5 — Estimator Quote Queue
  Pending quote_requests with status = 'submitted' or 'reviewing'
  Click any request → opens quote creation flow with engine pre-populated
```

---

## 6. ESTIMATOR QUOTE CREATION FLOW (`/admin/quote-requests/[id]`)

```
Page shows full customer submission — all line items as submitted

"Generate Pricing" button:
  → Engine runs on all line items simultaneously
  → Results appear per line item:

    ┌──────────────────────────────────────────────────────────┐
    │ Item 1: 20ga Galvanized Coping Cap — 12"W×4"H×3"A×3"B  │
    │ 100 LF ordered × 1.10 waste = 110 LF billed             │
    │                                                          │
    │ Material cost:     $0.8420/LF   [Commodity: $0.42/lb]   │
    │ Fabrication cost:  $0.6500/LF                           │
    │ Overhead (25%):    $0.3730/LF                           │
    │ Total cost:        $1.8650/LF                           │
    │ Suggested price:   $2.8692/LF   [Target margin: 35%]    │
    │                                                          │
    │ ⚠ Zinc up 8.2% in 30 days — consider adjustment         │
    │                                                          │
    │ Your price: [  $2.8692  ] /LF    Margin: 35.0%          │
    │             (editable — recalculates margin on change)   │
    └──────────────────────────────────────────────────────────┘

Estimator actions per line item:
  Accept engine suggestion → no change needed
  Override price → type new value, margin label updates live
  Add estimator note → "Lead time on galvanized currently 7 days"

Freight calculation panel:
  Destination ZIP (from customer submission)
  Residential toggle
  Liftgate toggle
  [Calculate Freight] → lib/pricing/freight.ts
  Result shown: "Estimated freight: $185.00 via [Carrier]"
  Editable before sending

"Send Quote to Customer" button:
  Creates quotes record with all approved line item prices
  Creates quote_line_items records
  Sets quote.status = 'sent'
  Customer notification fires (email + SMS if opted in)
  Customer receives: /account/quotes/[id] (shows only final prices, no cost breakdown)
```

---

## 7. FREIGHT CALCULATION (INTERNAL)

```typescript
// lib/pricing/freight.ts — ADMIN CONTEXT ONLY

interface FreightInput {
  destinationZip:   string;
  orderWeightLbs:   number;
  longestPieceFt:   number;
  isResidential:    boolean;
  requiresLiftgate: boolean;
}

interface FreightResult {
  estimatedCost:    number;
  carrier:          string | null;
  freightClass:     string;
  residentialAdder: number;
  liftgateAdder:    number;
  notes:            string | null;
  isManualRequired: boolean;  // True for oversized loads
}

function getFreightClass(longestPieceFt: number): string {
  if (longestPieceFt <= 8)  return '85';
  if (longestPieceFt <= 12) return '92.5';
  if (longestPieceFt <= 16) return '100';
  return '110';
}

// Full carrier integration pending:
// Checklist #27-28: Carrier names and rates
// Checklist #5:     AFS origin ZIP
// Checklist #29:    Residential surcharge amount
// Checklist #30:    Free freight threshold
// Checklist #80-82: Own trucks vs. third-party decision
// Checklist #88:    Liftgate upcharge

// Current: estimator enters freight amount manually
// Future: API call to EasyPost with above data
```

---

## 8. COMMODITY PRICE CRON JOB

```typescript
// app/api/cron/commodity-prices/route.ts
// Secured: verifies Authorization: Bearer {CRON_SECRET} header

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { updated: 0, failed: [] as string[] };

  for (const [commodity, config] of Object.entries(COMMODITY_MAP)) {
    try {
      // Fetch from Metals API
      const response = await fetch(
        `https://metals-api.com/api/latest?access_key=${process.env.METALS_API_KEY}&base=USD&symbols=${config.apiSymbol}`
      );
      const data = await response.json();
      const pricePerOz = data.rates[config.apiSymbol];
      const pricePerLb = pricePerOz / 14.5833; // troy oz to lb conversion

      // Insert to commodity_prices table
      const supabase = createServiceClient();
      await supabase.from('commodity_prices').upsert({
        commodity,
        price_per_lb:  pricePerLb,
        price_date:    new Date().toISOString().split('T')[0],
        data_source:   'metals-api',
        is_manual:     false,
      }, { onConflict: 'commodity,price_date' });

      results.updated++;
    } catch (error) {
      results.failed.push(commodity);
      // Send admin alert email — do not crash the entire job
    }
  }

  // If any failures, send admin alert
  if (results.failed.length > 0) {
    await sendAdminAlert('Commodity price update partial failure', results.failed);
  }

  return Response.json(results);
}
```

---

## 9. DATA REQUIRED TO ACTIVATE ENGINE

The pricing engine is fully architected and will activate when this data is entered
into the system. Nothing blocks building the code — only the data is pending.

| Data Item | How Entered | Status |
|---|---|---|
| Fabrication cost per LF per product | Pricing Admin UI `/admin/pricing` | Pending |
| Target margin % | Pricing Admin UI | Pending |
| Overhead % | Pricing Admin UI | Pending |
| Waste factor per material | Pricing Admin UI | Pending |
| Rush surcharge % | Pricing Admin UI | Pending |
| Volume tier breakpoints | Pricing Admin UI | Pending |
| Historical supplier invoices | `scripts/import-supplier-history.ts` | Pending |
| Metals API key | `.env.local` — self-register at metals-api.com | Pending |

---

*PRICING_ENGINE.md | AFS | Reid Whitesides | June 2026*
*Internal admin tool. Customers never see the pricing engine or its outputs directly.*
