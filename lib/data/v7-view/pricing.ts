/**
 * THE PRICING ENGINE SCREEN — v7 `pagePricing()` (prototype line 1545) and
 * `calcOut()` (line 1527).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * FIXTURE ONLY, AND FOR A REASON THAT IS NOT ABOUT EFFORT.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * v7's pricing engine is a per-bend / per-hem / markup calculator whose numbers
 * live in browser memory and reset on reload. The live app's pricing is
 * CLAUDE.md rules #19 and #20: a VERSIONED, APPEND-ONLY price book where an
 * edit inserts a new version and never updates one, Postgres refuses the update
 * anyway, a blank is never a zero, and every change is written to an
 * append-only ledger that dynamic pricing will later learn from.
 *
 * Those are not the same screen wearing different paint. Rebuilding
 * /admin/pricing as v7's six free-text rate boxes would mean giving Steve
 * controls that write where the real ones must not, so the LIVE screen keeps
 * the price-book editor it has, and this builds v7's screen for the gate so the
 * layout, the panels and the sticky price-check column are measured rather than
 * left out. Recorded in docs/design/V7_PIXEL_REPORT.md as a deliberate
 * divergence, not a gap.
 */
import { dimTxt, fmtIn, stats, V7_NAMES } from '@/lib/design/v7-draw';
import {
  V7_EXAMPLE_COSTS,
  V7_EXAMPLE_RATES,
  V7_TAX_RATE,
  money,
  num,
  pieces,
  v7EngMaterials,
  v7Fixture,
} from '@/lib/fixtures/command-center-v7';

export interface V7PricingField {
  key: string;
  label: string;
  /** v7 renders a `$` inside a `.prefix` span; `''` means no prefix. */
  prefix: string;
  value: string;
  placeholder: string;
}

export interface V7PricingMaterial {
  id: number;
  name: string;
  cost: string;
}

export interface V7PricingCalcRow {
  label: string;
  value: string;
  /** v7 marks a value it cannot compute with `.miss`. */
  missing: boolean;
  /** v7's `.res` rows — the price each and the quote total. */
  result: boolean;
}

export interface V7PricingView {
  /** v7's "Empty on purpose" banner, shown only when nothing is filled in. */
  fillHint: boolean;
  fields: V7PricingField[];
  materials: V7PricingMaterial[];
  historyRows: { when: string; who: string; what: string }[];
  profileOptions: [string, string][];
  materialOptions: string[];
  selectedProfileId: string;
  selectedMaterial: string;
  quantity: string;
  rush: boolean;
  /** The drawing for the picked profile, drawn in the sticky column. */
  plate: { kind: string; d: number[] } | null;
  calcRows: V7PricingCalcRow[];
  /** v7's "Not priced yet. Still needed: …" line, when anything is missing. */
  notPriced: string | null;
}

/**
 * v7 `eng()` (line 1172) — the calculator, transliterated for the fixture's own
 * numbers. NOT the real pricing maths: that is `lib/pricing/quote-math.ts`,
 * which refuses to issue a quote built on an unset price (rule #19) and must
 * stay the only copy of the formula.
 */
function engine(kind: string, d: number[], spec: string, qty: string, rush: boolean, rates: Record<string, string>, costs: Record<string, string>) {
  const st = stats(kind, d);
  const cost = num(costs[spec] ?? '');
  const miss: string[] = [];
  if (cost <= 0) miss.push(`sheet cost for ${spec}`);
  if (rates.bend === '') miss.push('rate per bend');
  if (st.hems && rates.hem === '') miss.push('rate per hem');
  if (rates.markup === '') miss.push('markup %');

  const W = st.dev;
  const lenIn = 120;
  const strips = Math.floor(48 / W);
  const along = Math.floor(120 / lenIn);
  const pps = strips * along;
  const mat = cost > 0 ? cost / pps : 0;
  const labor = st.bends * num(rates.bend) + st.hems * num(rates.hem);
  const base = mat + labor;
  const mk = base * (num(rates.markup) / 100);
  const sub = base + mk;
  const rushAdd = rush ? sub * (num(rates.rush) / 100) : 0;
  const each = Math.round((sub + rushAdd) * 100) / 100;
  const q = Math.floor(num(qty));
  let line = each * q;
  const minApplied = num(rates.min) > 0 && q > 0 && line < num(rates.min);
  if (minApplied) line = num(rates.min);
  const tax = Math.round(line * V7_TAX_RATE * 100) / 100;
  return { st, dev: W, miss, strips, pps, mat, labor, mk, each, qty: q, line, minApplied, tax, total: line + tax, ok: miss.length === 0 };
}

/** v7 `pagePricing()`. `example` is the state after pressing "Fill example numbers". */
export function fixturePricing(example = false): V7PricingView {
  const f = v7Fixture();
  const rates: Record<string, string> = example
    ? { ...V7_EXAMPLE_RATES, tax: '8.25' }
    : { bend: '', hem: '', markup: '', rush: '', min: '', tax: '8.25' };
  const mats = v7EngMaterials().map((m) =>
    example && V7_EXAMPLE_COSTS[m.name] ? { ...m, cost: String(V7_EXAMPLE_COSTS[m.name]) } : m,
  );
  const costs: Record<string, string> = Object.fromEntries(mats.map((m) => [m.name, m.cost]));

  // v7's calculator defaults: profile #1, its first material, 40 pieces.
  const profile = f.profiles[0];
  const spec = '24 ga Charcoal Kynar';
  const qty = '40';
  const e = engine(profile.kind, profile.d, spec, qty, false, rates, costs);

  const calcRows: V7PricingCalcRow[] = [
    { label: 'Developed width (all segments added up)', value: fmtIn(e.dev), missing: false, result: false },
    { label: `Strips across the 48 in sheet`, value: `${e.strips} strip${e.strips === 1 ? '' : 's'}`, missing: false, result: false },
    { label: 'Pieces from one 10 × 4 ft sheet', value: String(e.pps), missing: false, result: false },
    { label: 'Sheet cost ÷ pieces = material each', value: e.mat ? money(e.mat) : 'needs sheet cost', missing: !e.mat, result: false },
    {
      label:
        `${e.st.bends} bend${e.st.bends === 1 ? '' : 's'} × ${rates.bend === '' ? '?' : money(num(rates.bend))}` +
        (e.st.hems ? ` + ${e.st.hems} hem${e.st.hems === 1 ? '' : 's'} × ${rates.hem === '' ? '?' : money(num(rates.hem))}` : ''),
      value: rates.bend === '' ? 'needs rate' : money(e.labor),
      missing: rates.bend === '',
      result: false,
    },
    {
      label: `Markup ${rates.markup === '' ? '?' : `${num(rates.markup)}%`}`,
      value: rates.markup === '' ? 'needs markup' : money(e.mk),
      missing: rates.markup === '',
      result: false,
    },
  ];
  if (e.ok) {
    calcRows.push({ label: 'Price each', value: money(e.each), missing: false, result: true });
    calcRows.push({
      label: `${e.qty} ${pieces(e.qty)}${e.minApplied ? ` (minimum order ${money(num(rates.min))} applied)` : ''}`,
      value: money(e.line),
      missing: false,
      result: false,
    });
    calcRows.push({ label: `Sales tax ${V7_TAX_RATE * 100}%`, value: money(e.tax), missing: false, result: false });
    calcRows.push({ label: 'Quote total', value: money(e.total), missing: false, result: true });
  }

  return {
    fillHint: !example,
    fields: [
      { key: 'bend', label: 'Per bend', prefix: '$', value: rates.bend, placeholder: '0.00' },
      { key: 'hem', label: 'Per hem', prefix: '$', value: rates.hem, placeholder: '0.00' },
      { key: 'markup', label: 'Markup', prefix: '', value: rates.markup, placeholder: '0' },
      { key: 'rush', label: 'Rush surcharge', prefix: '', value: rates.rush, placeholder: '0' },
      { key: 'min', label: 'Minimum order', prefix: '$', value: rates.min, placeholder: '0.00' },
      { key: 'tax', label: 'Sales tax', prefix: '', value: rates.tax, placeholder: '8.25' },
    ],
    materials: mats,
    // v7's history starts empty and fills as you act. A fresh fixture render is
    // always the empty state, and saying so is the design's own sentence.
    historyRows: example
      ? [{ when: 'Thu, Oct 1, 10:30 AM', who: 'Steve', what: 'Pricing engine: example numbers loaded (demo only)' }]
      : [],
    profileOptions: f.profiles.map(
      (p) => [String(p.id), `#${p.id} ${V7_NAMES[p.kind]} ${dimTxt(p.kind, p.d)} · ${p.cust}`] as [string, string],
    ),
    materialOptions: mats.map((m) => m.name),
    selectedProfileId: String(profile.id),
    selectedMaterial: spec,
    quantity: qty,
    rush: false,
    plate: { kind: profile.kind, d: profile.d },
    calcRows,
    notPriced: e.ok ? null : `Still needed: ${e.miss.join(', ')}.`,
  };
}
