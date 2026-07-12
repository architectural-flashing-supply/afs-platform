'use client';

import { useCallback, useMemo, useState } from 'react';
import ProductFilterPanel, { type FilterSection } from './ProductFilterPanel';
import CategoryCard from './CategoryCard';
import ProductCard from './ProductCard';
import EmptyState from '@/components/ui/EmptyState';
import {
  ALL_MATERIALS,
  STOCK_TYPE_LABEL,
  gaugesForMaterials,
  type CatalogCategory,
  type CatalogProduct,
  type StockType,
} from '@/lib/data/catalog';

type CatalogMode =
  | { mode: 'catalog'; categories: CatalogCategory[] }
  | { mode: 'category'; category: CatalogCategory; products: CatalogProduct[] };

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ProductCatalogBrowser(props: CatalogMode) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedGauges, setSelectedGauges] = useState<string[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockType[]>([]);

  const toggleCategory = useCallback((v: string) => setSelectedCategories((prev) => toggleValue(prev, v)), []);
  const toggleMaterial = useCallback((v: string) => {
    setSelectedMaterials((prev) => toggleValue(prev, v));
    setSelectedGauges([]);
  }, []);
  const toggleGauge = useCallback((v: string) => setSelectedGauges((prev) => toggleValue(prev, v)), []);
  const toggleStock = useCallback(
    (v: string) => setSelectedStock((prev) => toggleValue(prev, v as StockType) as StockType[]),
    []
  );

  const clearAll = useCallback(() => {
    setSelectedCategories([]);
    setSelectedMaterials([]);
    setSelectedGauges([]);
    setSelectedStock([]);
  }, []);

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedMaterials.length > 0 ||
    selectedGauges.length > 0 ||
    selectedStock.length > 0;

  const materialPool = props.mode === 'catalog' ? [...ALL_MATERIALS] : [...props.category.materials];
  const gaugeOptions = useMemo(
    () => gaugesForMaterials(selectedMaterials.length > 0 ? selectedMaterials : materialPool),
    [selectedMaterials, materialPool]
  );

  const filteredCategories = useMemo(() => {
    if (props.mode !== 'catalog') return [];
    return props.categories.filter((c) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(c.slug)) return false;
      if (selectedMaterials.length > 0 && !c.materials.some((m) => selectedMaterials.includes(m))) return false;
      if (selectedGauges.length > 0) {
        const catGauges = gaugesForMaterials(c.materials);
        if (!selectedGauges.some((g) => catGauges.includes(g))) return false;
      }
      return true;
    });
  }, [props, selectedCategories, selectedMaterials, selectedGauges]);

  const filteredProducts = useMemo(() => {
    if (props.mode !== 'category') return [];
    return props.products.filter((p) => {
      if (selectedMaterials.length > 0 && !p.materials.some((m) => selectedMaterials.includes(m))) return false;
      if (selectedGauges.length > 0) {
        const prodGauges = gaugesForMaterials(p.materials);
        if (!selectedGauges.some((g) => prodGauges.includes(g))) return false;
      }
      if (selectedStock.length > 0 && !selectedStock.includes(p.stockType)) return false;
      return true;
    });
  }, [props, selectedMaterials, selectedGauges, selectedStock]);

  const sections: FilterSection[] = [];

  if (props.mode === 'catalog') {
    sections.push({
      key: 'category',
      title: 'Profile Type',
      options: props.categories.map((c) => ({ value: c.slug, label: c.name })),
      selected: selectedCategories,
      onToggle: toggleCategory,
    });
  }

  sections.push({
    key: 'material',
    title: 'Material',
    options: materialPool.map((m) => ({ value: m, label: m })),
    selected: selectedMaterials,
    onToggle: toggleMaterial,
  });

  sections.push({
    key: 'gauge',
    title: 'Gauge',
    options: gaugeOptions.map((g) => ({ value: g, label: g })),
    selected: selectedGauges,
    onToggle: toggleGauge,
  });

  if (props.mode === 'category') {
    sections.push({
      key: 'availability',
      title: 'Availability',
      options: (Object.keys(STOCK_TYPE_LABEL) as StockType[]).map((s) => ({
        value: s,
        label: STOCK_TYPE_LABEL[s],
      })),
      selected: selectedStock,
      onToggle: toggleStock,
    });
  }

  const resultCount = props.mode === 'catalog' ? filteredCategories.length : filteredProducts.length;
  const resultNoun = props.mode === 'catalog' ? 'categories' : 'products';

  return (
    <div className="flex flex-col lg:flex-row gap-8" data-testid="product-grid">
      <ProductFilterPanel
        sections={sections}
        hasActiveFilters={hasActiveFilters}
        onClearAll={clearAll}
        resultCount={resultCount}
        resultNoun={resultNoun}
      />

      <div className="flex-1 min-w-0">
        {props.mode === 'catalog' ? (
          filteredCategories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCategories.map((c) => (
                <CategoryCard key={c.slug} category={c} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No categories match those filters"
              description="Clear your filters, or request a quote for any custom flashing profile."
              actionLabel="Request a Quote"
              actionHref="/quote"
            />
          )
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No products match those filters"
            description="Clear your filters, or request a quote and our team will confirm the right specification."
            actionLabel="Request a Quote"
            actionHref="/quote"
          />
        )}
      </div>
    </div>
  );
}
