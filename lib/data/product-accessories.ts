/**
 * AUTO MATERIAL CALCULATOR — the only database access it has.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §2.2's source is the `product_accessories`
 * table and §2.1's is `pricing_rules.waste_factor`. Both already exist with RLS,
 * from migration 001 — this item adds no table and no migration.
 *
 * EVERY FUNCTION TAKES THE CALLER'S SupabaseClient, exactly as
 * lib/data/product-profiles.ts does, for two reasons. The library stays pure
 * (lib/material-calculator/ imports nothing from here). And the ROUTE decides
 * which client, which means POSTGRES decides what the caller may read:
 *
 *   - `accessories` / `product_accessories` are readable by any authenticated
 *     user (`auth.uid() IS NOT NULL`). A guest on the public /quote page has no
 *     uid, so RLS returns nothing and the accessory section hides — which is
 *     exactly the behaviour SPEC §5 already prescribes, not a bug.
 *   - `pricing_rules` is ADMIN ONLY (`admin_only_pricing_rules`). CLAUDE.md
 *     Pillar 4 says customers never see the pricing layer. So the waste factor is
 *     attempted with the caller's own client and simply comes back empty for
 *     everyone who is not an admin, who then get the documented 1.10 default
 *     marked "estimated". One code path, no branch on role, and the database
 *     rather than this file enforces the boundary.
 *
 * NOTHING HERE MAY IMPORT lib/supabase/admin.ts. The service-role client would
 * bypass all of the above, and a static test in lib/material-calculator/
 * calculate-materials.test.ts fails if the route ever reaches for it.
 *
 * A FAILED READ IS AN EMPTY READ, NEVER A THROW. The waste-factor calculation is
 * pure arithmetic that cannot fail; a catalog table being unreachable must not
 * take it down with it. Each function returns its own empty value and the route
 * composes whatever succeeded.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { MATERIAL_CALCULATOR_CONFIG } from '@/lib/material-calculator';
import type {
  CalcMethod,
  CalculatorProductCandidate,
  ProductAccessory,
} from '@/lib/material-calculator';

/** PostgREST nests an embedded resource as an object (or null when absent). */
interface ProductCandidateRow {
  id: string;
  product_profiles: { name: string; slug: string } | null;
  materials: { name: string } | null;
  gauges: { label: string } | null;
}

interface ProductAccessoryRow {
  accessory_id: string;
  calc_method: string;
  calc_rate: number | string | null;
  is_required: boolean | null;
  accessories: { name: string; sku: string | null; unit: string | null } | null;
}

interface PricingRuleWasteRow {
  waste_factor: number | string | null;
}

const CALC_METHODS: readonly CalcMethod[] = ['per_lf', 'per_piece', 'per_sqft', 'fixed'];

function isCalcMethod(value: string): value is CalcMethod {
  return (CALC_METHODS as readonly string[]).includes(value);
}

/**
 * Postgres DECIMAL arrives from PostgREST as a string often enough that casting
 * it to `number` and trusting the cast is how a row renders "NaN". Parsed
 * explicitly; anything that does not parse to a finite number is treated as
 * missing, which the accessory calculation already handles by refusing to
 * quantify that row rather than inventing one.
 */
function parseDecimal(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Every active, online-quotable product with its profile, material and gauge
 * labels — the candidate set lib/material-calculator/resolve-product.ts's pure
 * matcher narrows against the wizard's free-text labels.
 *
 * `products` is unseeded today (no INSERT INTO products exists anywhere in this
 * repo), so this returns [] and the matcher answers 'none'. That is the correct
 * current behaviour and it needs no code change on the day the catalog is seeded.
 */
export async function getCalculatorProductCandidates(
  supabase: SupabaseClient
): Promise<CalculatorProductCandidate[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, product_profiles(name, slug), materials(name), gauges(label)')
    .eq('is_active', true)
    .eq('online_quotable', true);

  if (error || !data) return [];

  return (data as unknown as ProductCandidateRow[])
    .map((row): CalculatorProductCandidate | null => {
      // A product whose profile or material join came back empty cannot be
      // matched on a label, so it is excluded rather than matched on ''.
      if (!row.product_profiles || !row.materials) return null;
      return {
        productId: row.id,
        profileName: row.product_profiles.name,
        profileSlug: row.product_profiles.slug,
        materialName: row.materials.name,
        gaugeLabel: row.gauges?.label ?? null,
      };
    })
    .filter((candidate): candidate is CalculatorProductCandidate => candidate !== null);
}

/**
 * The accessory rows for one product, flattened to the shape §2.2's calculation
 * takes. Only active accessories; ordered by name so the result is stable before
 * calculateAccessories sorts it again.
 */
export async function getProductAccessories(
  supabase: SupabaseClient,
  productId: string
): Promise<ProductAccessory[]> {
  const { data, error } = await supabase
    .from('product_accessories')
    .select('accessory_id, calc_method, calc_rate, is_required, accessories!inner(name, sku, unit)')
    .eq('product_id', productId)
    .eq('accessories.is_active', true)
    .order('accessory_id', { ascending: true });

  if (error || !data) return [];

  return (data as unknown as ProductAccessoryRow[])
    .map((row): ProductAccessory | null => {
      if (!row.accessories) return null;
      if (!isCalcMethod(row.calc_method)) return null;
      return {
        accessoryId: row.accessory_id,
        accessoryName: row.accessories.name,
        sku: row.accessories.sku,
        // accessories.unit is NOT NULL DEFAULT 'EA' in migration 001; the
        // fallback is for a projection that selected it as null, not an invented
        // business value.
        unit: row.accessories.unit ?? 'EA',
        calcMethod: row.calc_method,
        // A missing or unparseable rate becomes NaN on purpose: the accessory
        // calculation refuses to quantify it and says so, rather than guessing.
        calcRate: parseDecimal(row.calc_rate) ?? Number.NaN,
        isRequired: row.is_required === true,
      };
    })
    .filter((accessory): accessory is ProductAccessory => accessory !== null);
}

/**
 * pricing_rules.waste_factor for one product, or null.
 *
 * null for every one of: no row, an RLS denial (the caller is not an admin), an
 * unparseable decimal, or a value outside the config's accepted band. That last
 * one matters — a stored 110 (someone meaning 1.10) would otherwise multiply a
 * customer's order by a hundred. Out-of-band is a data error, and falling back to
 * the documented default marked "estimated" is safer than propagating it.
 */
export async function getProductWasteFactorMultiplier(
  supabase: SupabaseClient,
  productId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('waste_factor')
    .eq('product_id', productId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const multiplier = parseDecimal((data as PricingRuleWasteRow).waste_factor);
  if (multiplier === null) return null;

  const { minimumWasteFactorMultiplier: min, maximumWasteFactorMultiplier: max } =
    MATERIAL_CALCULATOR_CONFIG;
  if (multiplier < min || multiplier > max) return null;

  return multiplier;
}
