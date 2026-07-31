// Auto Material Calculator — SPEC_AUTO_MATERIAL_CALCULATOR.md §2.1 only.
// §2.2 (accessories) and §2.3 (stock length) are blocked on real product
// data — see MATERIAL_CALC_SCOPE.md.

// Default until pricing_rules.waste_factor has real per-product data
// (checklist #37) — always shown to the user as "estimated".
export const DEFAULT_WASTE_FACTOR_MULTIPLIER = 1.1;

export function applyWasteFactor(
  rawQuantityLf: number,
  wasteFactorMultiplier: number = DEFAULT_WASTE_FACTOR_MULTIPLIER
): number {
  // Always round UP — never under-order
  return Math.ceil(rawQuantityLf * wasteFactorMultiplier);
}

export interface WasteAdjustedQuantity {
  rawQtyLf: number;
  wasteFactorPct: number;
  wasteQtyLf: number;
  adjustedQtyLf: number;
  isEstimated: boolean;
}

export function calculateWasteAdjustedQuantity(
  lengthFt: number,
  quantity: number,
  wasteFactorMultiplier: number = DEFAULT_WASTE_FACTOR_MULTIPLIER
): WasteAdjustedQuantity {
  const rawQtyLf = lengthFt * quantity;
  const adjustedQtyLf = applyWasteFactor(rawQtyLf, wasteFactorMultiplier);

  return {
    rawQtyLf,
    wasteFactorPct: Math.round((wasteFactorMultiplier - 1) * 100),
    wasteQtyLf: adjustedQtyLf - rawQtyLf,
    adjustedQtyLf,
    isEstimated: true,
  };
}
