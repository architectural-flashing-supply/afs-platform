/**
 * AUTO MATERIAL CALCULATOR — the library's public surface.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md, all three calculations, composed into one
 * pure deterministic function. "Pure" is enforced rather than claimed:
 * calculate-materials.test.ts walks every file in this directory and fails if one
 * of them reaches for fetch, a Supabase client, Date.now, new Date or
 * Math.random. Nothing here touches the network, the clock, the database or a
 * random source, so the same input always produces the same output.
 *
 * QUANTITIES ONLY — no field in anything exported from here is money
 * (CLAUDE.md rule #1), and a unit test asserts that too.
 *
 * §2.3 is NOT reimplemented. lib/utils/trim-optimizer.ts already owns the
 * stock-length formula for SPEC_TRIM_LENGTH_OPTIMIZER.md, it is already wired into
 * the quote wizard, and its formula is the one §2.3 specifies. It is imported, so
 * there is still exactly one of it in the repository.
 */

import { optimizeTrimLength } from '@/lib/utils/trim-optimizer';
import { MATERIAL_CALCULATOR_CONFIG } from './config';
import { calculateAccessories } from './accessories';
import { assertValidMaterialCalcInput } from './validate';
import { calculateWasteAdjustedQuantity } from './waste';
import type { MaterialCalcInput, MaterialCalcResult } from './types';

export function calculateMaterials(input: MaterialCalcInput): MaterialCalcResult {
  assertValidMaterialCalcInput(input);

  const waste = calculateWasteAdjustedQuantity(
    input.lengthFt,
    input.quantity,
    input.wasteFactorMultiplier
  );

  // §2.2 runs on the BILLED footage. §2.2's own parameter is named
  // `orderedQtyLf` and §2.1 defines the ordered (billed) quantity as the
  // waste-adjusted one, so sealant for 110 LF of installed flashing is sealant
  // for 110 LF — not for the 100 LF that was typed in.
  const accessories = calculateAccessories({
    orderedQtyLf: waste.adjustedQtyLf,
    orderedPieces: input.quantity,
    accessories: input.accessories ?? [],
  });

  // §2.3 runs on the RAW footage, matching the already-shipped
  // components/quote/TrimLengthOptimizerSection.tsx, which passes
  // lengthFt * quantity. The spec says `orderedLf` for both §2.2 and §2.3
  // without distinguishing them; cutting for the waste-adjusted figure instead
  // would change the numbers on a screen that is already live, which is outside
  // this item's scope. Recorded as EES deviation D-2 / UNRESOLVED-3.
  const stockOptimization =
    input.stockLengthFt === undefined || input.stockLengthFt === null
      ? null
      : optimizeTrimLength(
          waste.rawQtyLf,
          input.stockLengthFt,
          MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt
        );

  return { waste, accessories, stockOptimization };
}

export { MATERIAL_CALCULATOR_CONFIG, DEFAULT_WASTE_FACTOR_MULTIPLIER, isSupportedCalcMethod } from './config';
export type {
  CalcMethod,
  MaterialCalculatorConfig,
  RoundingMode,
  SupportedCalcMethod,
} from './config';

export { applyWasteFactor, calculateWasteAdjustedQuantity } from './waste';
export { calculateAccessories, calculateAccessoryQuantity } from './accessories';
export type { AccessoryCalculationInput } from './accessories';
export {
  MaterialCalcInputError,
  assertValidMaterialCalcInput,
  validateMaterialCalcInput,
} from './validate';
export { resolveProduct } from './resolve-product';
export { isMaterialCalculatorEnabled, MATERIAL_CALCULATOR_FLAG } from './feature-flag';

export type {
  AccessoryCalculation,
  AccessoryRequirement,
  CalculatorProductCandidate,
  MaterialCalcErrorBody,
  MaterialCalcInput,
  MaterialCalcInputErrorDetail,
  MaterialCalcRequestBody,
  MaterialCalcResponseBody,
  MaterialCalcResult,
  MaterialCalcValidation,
  ProductAccessory,
  ProductLabels,
  ProductResolution,
  ProductResolutionResult,
  UncalculableAccessory,
  WasteAdjustedQuantity,
} from './types';
