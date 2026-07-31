import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogProduct, StockType } from './catalog';

interface LiveStockRow {
  sku: string;
  stock_type: StockType;
  lead_time_days: number;
}

/**
 * Overlays live products.stock_type / lead_time_days (SPEC_LIVE_INVENTORY.md) onto
 * the static catalog fixtures in lib/data/catalog.ts, matched by SKU. products is
 * the real source of truth once a row exists, but the catalog itself is still
 * static content (blocked on CLAUDE.md Data Blockers #12-21) — most SKUs have no
 * matching row yet, so those products keep their static fallback values unchanged.
 */
export async function withLiveStock<T extends CatalogProduct>(
  supabase: SupabaseClient,
  products: T[]
): Promise<T[]> {
  const skus = products.map((p) => p.sku).filter((sku): sku is string => sku != null);
  if (skus.length === 0) return products;

  const { data } = await supabase.from('products').select('sku, stock_type, lead_time_days').in('sku', skus);
  const rows = (data ?? []) as LiveStockRow[];
  if (rows.length === 0) return products;

  const bySku = new Map(rows.map((r) => [r.sku, r]));
  return products.map((p) => {
    const live = p.sku ? bySku.get(p.sku) : undefined;
    if (!live) return p;
    return { ...p, stockType: live.stock_type, leadTimeDays: live.lead_time_days };
  });
}

export interface ProductStockRow {
  productId: string;
  sku: string | null;
  productName: string;
  materialName: string | null;
  stockType: StockType;
  leadTimeDays: number;
}

interface ProductStockSource {
  id: string;
  sku: string | null;
  name: string;
  stock_type: StockType;
  lead_time_days: number;
  materials: { name: string } | null;
}

/**
 * Admin-facing rows for ProductStockTable (SPEC_LIVE_INVENTORY.md §3). Reads the
 * real products table directly — empty today for the same reason as
 * lib/data/pricing.ts's getPricingRulesRows, until real product rows exist.
 */
export async function getProductStockRows(supabase: SupabaseClient): Promise<ProductStockRow[]> {
  const { data } = await supabase
    .from('products')
    .select('id, sku, name, stock_type, lead_time_days, materials(name)')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return ((data ?? []) as unknown as ProductStockSource[]).map((row) => ({
    productId: row.id,
    sku: row.sku,
    productName: row.name,
    materialName: row.materials?.name ?? null,
    stockType: row.stock_type,
    leadTimeDays: row.lead_time_days,
  }));
}
