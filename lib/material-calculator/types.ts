/**
 * AUTO MATERIAL CALCULATOR — shared types.
 *
 * QUANTITIES ONLY. There is deliberately no price, cost, cents, rate-in-dollars
 * or total-amount field anywhere in this file, and a unit test asserts that
 * (CLAUDE.md rule #1 — AFS is an RFQ platform and the customer sees no dollar
 * amount before AFS issues the formal quote). `calcRate` is a quantity rate —
 * "one tube per 20 LF" — never money.
 */

import type { CalcMethod } from './config';
import type { StockCutResult } from '@/lib/utils/trim-optimizer';

/**
 * One product_accessories row joined to its accessories row, flattened.
 * Mirrors migration 001 lines 238-255 field for field.
 */
export interface ProductAccessory {
  accessoryId: string;
  accessoryName: string;
  sku: string | null;
  unit: string;
  calcMethod: CalcMethod;
  /** product_accessories.calc_rate — DECIMAL(8,4). A quantity rate, not money. */
  calcRate: number;
  isRequired: boolean;
}

/**
 * SPEC_AUTO_MATERIAL_CALCULATOR.md §2.2's own interface, field for field, with
 * `calculatedQty` guaranteed finite and >= 0 — a rule that cannot produce such a
 * number yields an UncalculableAccessory instead.
 */
export interface AccessoryRequirement {
  accessoryId: string;
  accessoryName: string;
  sku: string | null;
  calcMethod: CalcMethod;
  calculatedQty: number;
  unit: string;
  isRequired: boolean;
}

/**
 * An accessory this calculator refuses to quantify, with the reason in plain
 * English. It is listed rather than dropped: a contractor needs to know the
 * accessory applies even when AFS has to supply the count.
 */
export interface UncalculableAccessory {
  accessoryId: string;
  accessoryName: string;
  sku: string | null;
  calcMethod: CalcMethod;
  unit: string;
  isRequired: boolean;
  reason: string;
}

/** §2.1's output. */
export interface WasteAdjustedQuantity {
  rawQtyLf: number;
  wasteFactorPct: number;
  wasteQtyLf: number;
  adjustedQtyLf: number;
  /**
   * True while the waste factor is the documented 1.10 default rather than a
   * real per-product pricing_rules.waste_factor. §3 prints "(estimated)" from
   * this, so it must describe the data and never be hardcoded.
   */
  isEstimated: boolean;
}

/** §2.2's output, split the way §3's UI consumes it. */
export interface AccessoryCalculation {
  required: AccessoryRequirement[];
  optional: AccessoryRequirement[];
  uncalculable: UncalculableAccessory[];
}

export interface MaterialCalcInput {
  lengthFt: number;
  /** Piece count. Must be a positive integer — half a piece is not orderable. */
  quantity: number;
  /** Omitted means "use the documented default and report it as estimated". */
  wasteFactorMultiplier?: number | null;
  /** Omitted or null means the profile has no standard stock length (§2.3 hidden). */
  stockLengthFt?: number | null;
  accessories?: readonly ProductAccessory[];
}

export interface MaterialCalcResult {
  waste: WasteAdjustedQuantity;
  accessories: AccessoryCalculation;
  /** §2.3. null when no stock length was supplied — the section hides. */
  stockOptimization: StockCutResult | null;
}

/** Why a product could not be identified from the wizard's free-text labels. */
export type ProductResolution = 'resolved' | 'none' | 'ambiguous' | 'not_attempted';

/** One candidate row for the pure product matcher, already flattened. */
export interface CalculatorProductCandidate {
  productId: string;
  profileName: string;
  profileSlug: string;
  materialName: string;
  /** gauges.label, e.g. '24 ga'. null for a gauge-agnostic product. */
  gaugeLabel: string | null;
}

export interface ProductLabels {
  profileLabel: string | null;
  materialLabel: string | null;
  gaugeLabel: string | null;
}

export type ProductResolutionResult =
  | { status: 'resolved'; productId: string }
  | { status: 'none' }
  | { status: 'ambiguous'; matchCount: number };

/** One rejected field, named, so a 400 says which input was wrong. */
export interface MaterialCalcInputErrorDetail {
  field: string;
  message: string;
}

export type MaterialCalcValidation =
  | { ok: true }
  | { ok: false; errors: MaterialCalcInputErrorDetail[] };

/** POST /api/calculator/materials — request. See EES deviations D-3 and D-4. */
export interface MaterialCalcRequestBody {
  productId?: string | null;
  profileLabel?: string | null;
  materialLabel?: string | null;
  gaugeLabel?: string | null;
  lengthFt: number;
  pieces: number;
  stockLengthFt?: number | null;
}

/** POST /api/calculator/materials — response. See EES deviation D-5. */
export interface MaterialCalcResponseBody {
  rawQtyLf: number;
  adjustedQtyLf: number;
  wasteFactorPct: number;
  wasteQtyLf: number;
  isWasteEstimated: boolean;
  requiredAccessories: AccessoryRequirement[];
  optionalAccessories: AccessoryRequirement[];
  uncalculableAccessories: UncalculableAccessory[];
  stockOptimization: StockCutResult | null;
  productResolution: ProductResolution;
}

export interface MaterialCalcErrorBody {
  error: string;
  details?: MaterialCalcInputErrorDetail[];
}
