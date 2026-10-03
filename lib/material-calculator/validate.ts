/**
 * AUTO MATERIAL CALCULATOR — INPUT VALIDATION.
 *
 * The spec defines no validation at all: §2.1 would happily return
 * `Math.ceil(-50 * 1.1) = -55` LF and §4 would serve it. A negative or zero
 * billed quantity is not a quantity, and a quantity of 2.5 pieces is not
 * orderable. Both are refused here rather than rendered, because a zero that
 * looks like an answer is worse than a refusal that says which field was wrong.
 *
 * This is the library's BOUNDARY. waste.ts stays tolerant arithmetic on purpose
 * (see its header), so calculateMaterials() runs this first and throws before any
 * formula sees a bad number.
 */

import { MATERIAL_CALCULATOR_CONFIG } from './config';
import type {
  MaterialCalcInput,
  MaterialCalcInputErrorDetail,
  MaterialCalcValidation,
} from './types';

/**
 * Rejects NaN, Infinity, -Infinity, null, undefined, strings and every other
 * non-number in one guard, so each caller below only has to express its own
 * business bound.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export class MaterialCalcInputError extends Error {
  readonly details: MaterialCalcInputErrorDetail[];

  constructor(details: MaterialCalcInputErrorDetail[]) {
    super(
      details.length === 1
        ? details[0].message
        : `${details.length} inputs are not valid: ${details.map((d) => d.field).join(', ')}`
    );
    this.name = 'MaterialCalcInputError';
    this.details = details;
  }
}

export function validateMaterialCalcInput(input: MaterialCalcInput): MaterialCalcValidation {
  const errors: MaterialCalcInputErrorDetail[] = [];

  if (!isFiniteNumber(input.lengthFt)) {
    errors.push({ field: 'lengthFt', message: 'Length must be a number.' });
  } else if (input.lengthFt <= 0) {
    errors.push({ field: 'lengthFt', message: 'Length must be greater than zero.' });
  }

  if (!isFiniteNumber(input.quantity)) {
    errors.push({ field: 'quantity', message: 'Quantity must be a number.' });
  } else if (input.quantity <= 0) {
    errors.push({ field: 'quantity', message: 'Quantity must be greater than zero.' });
  } else if (!Number.isInteger(input.quantity)) {
    errors.push({ field: 'quantity', message: 'Quantity must be a whole number of pieces.' });
  }

  if (input.wasteFactorMultiplier !== undefined && input.wasteFactorMultiplier !== null) {
    const { minimumWasteFactorMultiplier: min, maximumWasteFactorMultiplier: max } =
      MATERIAL_CALCULATOR_CONFIG;

    if (!isFiniteNumber(input.wasteFactorMultiplier)) {
      errors.push({
        field: 'wasteFactorMultiplier',
        message: 'Waste factor must be a number.',
      });
    } else if (input.wasteFactorMultiplier < min) {
      errors.push({
        field: 'wasteFactorMultiplier',
        message: `Waste factor must be at least ${min} — a lower factor would bill less than was ordered.`,
      });
    } else if (input.wasteFactorMultiplier > max) {
      errors.push({
        field: 'wasteFactorMultiplier',
        message: `Waste factor must be at most ${max}.`,
      });
    }
  }

  if (input.stockLengthFt !== undefined && input.stockLengthFt !== null) {
    if (!isFiniteNumber(input.stockLengthFt)) {
      errors.push({ field: 'stockLengthFt', message: 'Stock length must be a number.' });
    } else if (input.stockLengthFt <= 0) {
      errors.push({ field: 'stockLengthFt', message: 'Stock length must be greater than zero.' });
    } else if (input.stockLengthFt <= MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt) {
      // optimizeTrimLength divides by (stockLengthFt - kerfAllowanceFt). A stock
      // length at or below the blade width makes that zero or negative, which
      // yields Infinity or a negative piece count rather than an error.
      errors.push({
        field: 'stockLengthFt',
        message: `Stock length must be longer than the saw kerf (${MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt} ft).`,
      });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Throws MaterialCalcInputError when `input` is not valid. Returns nothing. */
export function assertValidMaterialCalcInput(input: MaterialCalcInput): void {
  const validation = validateMaterialCalcInput(input);
  if (!validation.ok) throw new MaterialCalcInputError(validation.errors);
}
