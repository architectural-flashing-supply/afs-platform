/**
 * AUTO MATERIAL CALCULATOR — THE ONE CONFIG OBJECT.
 *
 * SPEC_AUTO_MATERIAL_CALCULATOR.md defines three calculations and leaves four
 * numbers undefined. Every one of them lives here, named, with its provenance
 * written beside it, so "where did 0.0208 come from?" has an answer that is not
 * "somebody typed it into a formula".
 *
 * Nothing else in lib/material-calculator/ may contain a numeric literal with
 * business meaning. A number that is part of arithmetic itself (dividing by 12
 * to turn inches into feet, multiplying by 100 to turn a ratio into a
 * percentage) is not a business number and does not belong here.
 *
 * SPEC-DEFINED values carry no assumption id — the spec states them outright.
 * ASSUMPTION values carry A-01 … A-04 and are listed for Steve to confirm in
 * EES-OVN.03-AUTO-MATERIAL-CALCULATOR.md's ASSUMPTIONS table. Correcting one is
 * a one-line change here and nowhere else.
 */

/** How a computed accessory quantity is turned into an orderable number. */
export type RoundingMode = 'ceil' | 'exact';

/**
 * product_accessories.calc_method — the exact four values migration 001's CHECK
 * constraint permits. Kept as a union so a fifth value arriving from the
 * database is a type error at the boundary rather than a silent fall-through.
 */
export type CalcMethod = 'per_lf' | 'per_piece' | 'per_sqft' | 'fixed';

/** A calc_method this calculator can turn into a quantity. */
export type SupportedCalcMethod = Exclude<CalcMethod, 'per_sqft'>;

export interface MaterialCalculatorConfig {
  /** SPEC §2.1: "Default until data received: 1.10 (10%)". */
  readonly defaultWasteFactorMultiplier: number;

  /**
   * SPEC §2.1 + §5: the waste factor is shown to the customer as "estimated"
   * until pricing_rules.waste_factor carries real per-product data
   * (CLAUDE.md data-blocker checklist #37). This is the value used when the
   * default multiplier was applied; a real per-product multiplier reports
   * false instead.
   */
  readonly wasteFactorIsEstimatedUntilDataReceived: boolean;

  /**
   * DERIVED, not assumed. §2.1's "Always round UP — never under-order" makes a
   * multiplier below 1 a contradiction: it would bill less than was asked for.
   */
  readonly minimumWasteFactorMultiplier: number;

  /**
   * ASSUMPTION A-01. The spec gives no upper bound. 2.0 means "100% waste",
   * past which a value is far likelier to be a data-entry slip (110 typed for
   * 1.10) than a real waste factor. Values above it are rejected and the
   * default is used instead of quietly doubling a customer's order.
   * TO CONFIRM: is there a real profile whose waste factor exceeds 2.0?
   */
  readonly maximumWasteFactorMultiplier: number;

  /**
   * ASSUMPTION A-02, pre-existing. §2.3 names `kerfAllowance` and gives no
   * value. lib/utils/trim-optimizer.ts has shipped 0.0208 ft (about 1/4 inch of
   * blade width) since the Trim Length Optimizer was built; this re-states the
   * same number so it is auditable in one place rather than hidden in a default
   * parameter. The shipped behaviour is unchanged.
   * TO CONFIRM: the actual blade width of the shop's cut-off saw.
   */
  readonly kerfAllowanceFt: number;

  /**
   * ASSUMPTION A-03. §2.2's prose says `per_piece: orderedPieces * calcRate`
   * while its own code says `Math.ceil(orderedPieces * acc.calc_rate)`. The
   * code wins — it is the more specific source, and `ceil` is the only reading
   * consistent with §2.1's "never under-order". Half a box of screws is not
   * orderable.
   * TO CONFIRM: that a fractional per-piece count always rounds up.
   */
  readonly perPieceRoundingMode: RoundingMode;

  /**
   * SPEC §2.2: `fixed: calcRate` — "always exactly this quantity".
   * calc_rate is DECIMAL(8,4), so a fractional fixed quantity is representable
   * and is passed through unrounded rather than silently inflated.
   */
  readonly fixedRoundingMode: RoundingMode;

  /** The three calc_methods §2.2's switch statement actually handles. */
  readonly supportedCalcMethods: readonly SupportedCalcMethod[];

  /**
   * ASSUMPTION A-04. `per_sqft` is permitted by product_accessories'
   * calc_method CHECK and is listed in §2.2's AccessoryRequirement interface,
   * but §2.2's switch statement OMITS it — so a per_sqft row would fall through
   * to the spec's `let qty = 1` and put a fabricated quantity in front of a
   * customer. There is also no area anywhere in §4's request body: length and
   * piece count alone cannot produce square feet without deciding what area is
   * meant (blank width? covered roof area?), which is a business decision and
   * not one to invent here.
   *
   * So it is refused: the row is listed without a quantity and AFS confirms it
   * on the formal quote.
   * TO CONFIRM: what area a per_sqft calc_rate is measured against. Once that
   * is known, per_sqft moves to supportedCalcMethods.
   */
  readonly uncalculableCalcMethods: readonly CalcMethod[];
}

export const MATERIAL_CALCULATOR_CONFIG: MaterialCalculatorConfig = {
  defaultWasteFactorMultiplier: 1.1,
  wasteFactorIsEstimatedUntilDataReceived: true,
  minimumWasteFactorMultiplier: 1.0,
  maximumWasteFactorMultiplier: 2.0,
  kerfAllowanceFt: 0.0208,
  perPieceRoundingMode: 'ceil',
  fixedRoundingMode: 'exact',
  supportedCalcMethods: ['per_lf', 'per_piece', 'fixed'],
  uncalculableCalcMethods: ['per_sqft'],
};

/**
 * Kept for the one consumer that predates this module
 * (components/quote/WasteFactorDisplay.tsx reads the default through
 * calculateWasteAdjustedQuantity, but the named constant was part of the
 * previous module's public surface and is still the clearest way to refer to
 * the spec's 1.10).
 */
export const DEFAULT_WASTE_FACTOR_MULTIPLIER =
  MATERIAL_CALCULATOR_CONFIG.defaultWasteFactorMultiplier;

/** True when `method` is one this calculator can turn into a quantity. */
export function isSupportedCalcMethod(method: CalcMethod): method is SupportedCalcMethod {
  return (MATERIAL_CALCULATOR_CONFIG.supportedCalcMethods as readonly CalcMethod[]).includes(method);
}
