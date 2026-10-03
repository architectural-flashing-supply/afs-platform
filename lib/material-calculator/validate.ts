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

import { stockPiecesNeeded } from '@/lib/utils/trim-optimizer';
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

  // RESOURCE GUARDS. Everything above is a business rule; these two are not, and
  // they exist because POST /api/calculator/materials is PUBLIC and unauthenticated
  // (the quote wizard supports guest submission), so its inputs are
  // attacker-controlled. They run only once the fields they combine are known-good,
  // so a bad length is reported as a bad length rather than as an oversized order.
  if (errors.length === 0) {
    const rawQtyLf = input.lengthFt * input.quantity;

    if (rawQtyLf > MATERIAL_CALCULATOR_CONFIG.maxRawQuantityLf) {
      errors.push({
        field: 'quantity',
        message:
          `Length x quantity comes to ${rawQtyLf} LF, beyond the ` +
          `${MATERIAL_CALCULATOR_CONFIG.maxRawQuantityLf} LF this calculator handles. ` +
          `Contact AFS directly for an order this size.`,
      });
    } else if (input.stockLengthFt !== undefined && input.stockLengthFt !== null) {
      // optimizeTrimLength pushes one object per piece, so the piece count is an
      // allocation size and has to be known BEFORE the list is built. stockPiecesNeeded
      // is the very function optimizeTrimLength uses, imported rather than copied, so
      // the check and the thing it is checking cannot disagree.
      const piecesNeeded = stockPiecesNeeded(
        rawQtyLf,
        input.stockLengthFt,
        MATERIAL_CALCULATOR_CONFIG.kerfAllowanceFt
      );

      if (piecesNeeded > MATERIAL_CALCULATOR_CONFIG.maxStockPieces) {
        errors.push({
          field: 'stockLengthFt',
          message:
            `Cutting ${rawQtyLf} LF from ${input.stockLengthFt} ft stock would take ` +
            `${piecesNeeded} pieces, beyond the ${MATERIAL_CALCULATOR_CONFIG.maxStockPieces} ` +
            `this calculator lists.`,
        });
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Throws MaterialCalcInputError when `input` is not valid. Returns nothing. */
export function assertValidMaterialCalcInput(input: MaterialCalcInput): void {
  const validation = validateMaterialCalcInput(input);
  if (!validation.ok) throw new MaterialCalcInputError(validation.errors);
}
