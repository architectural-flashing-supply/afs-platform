import type { SupabaseClient } from '@supabase/supabase-js';

export interface PricingRuleRow {
  productId: string;
  productName: string;
  materialName: string | null;
  costNotes: string | null;
  targetMarginPct: number | null;
  wasteFactor: number | null;
  rushSurchargePct: number | null;
}

interface PricingRuleSource {
  id: string;
  name: string;
  materials: { name: string } | null;
  pricing_rules: { cost_notes: string | null; margin_pct: number; waste_factor: number; rush_surcharge_pct: number }[] | null;
}

/**
 * Reads from the real products/pricing_rules tables per SPEC_PRICING_ADMIN.md manual
 * mode. Empty today — products is blocked on catalog data (CLAUDE.md data blockers
 * #12-21) — the table renders an EmptyState until that data lands, same "build the
 * architecture now" pattern used across the pricing engine.
 */
export async function getPricingRulesRows(supabase: SupabaseClient): Promise<PricingRuleRow[]> {
  const { data } = await supabase
    .from('products')
    .select('id, name, materials(name), pricing_rules(cost_notes, margin_pct, waste_factor, rush_surcharge_pct)')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return ((data ?? []) as unknown as PricingRuleSource[]).map((row) => {
    const rule = row.pricing_rules?.[0] ?? null;
    return {
      productId: row.id,
      productName: row.name,
      materialName: row.materials?.name ?? null,
      costNotes: rule?.cost_notes ?? null,
      targetMarginPct: rule?.margin_pct ?? null,
      wasteFactor: rule?.waste_factor ?? null,
      rushSurchargePct: rule?.rush_surcharge_pct ?? null,
    };
  });
}
