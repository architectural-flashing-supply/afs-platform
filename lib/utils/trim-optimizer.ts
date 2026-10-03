// Trim Length Optimizer — SPEC_TRIM_LENGTH_OPTIMIZER.md §2 (unchanged algorithm).
// Pure function of neededLf + stockLengthFt, same pattern as lib/material-calculator/waste.ts:
// no API route, no pricing, just linear-footage/cut-list math.

export interface CutPiece {
  pieceNumber: number;
  lengthFt: number;
  remainderFt: number;
  cuttingInstructions: string;
}

export interface StockCutResult {
  stockLengthFt: number;
  piecesOrdered: number;
  totalStockFt: number;
  cutList: CutPiece[];
  wastePercent: number;
  wasteLinearFt: number;
}

const DEFAULT_KERF_ALLOWANCE_FT = 0.0208; // ~1/4 inch blade width

/**
 * How many sticks of stock a run takes. Extracted from optimizeTrimLength (which
 * still uses it, so the arithmetic is unchanged) because the Auto Material
 * Calculator's validator has to know the piece count BEFORE the cut list is built:
 * the list allocates one object per piece, and POST /api/calculator/materials is a
 * public route whose inputs are attacker-controlled. Two copies of this expression
 * would be two answers to the same question.
 */
export function stockPiecesNeeded(
  neededLf: number,
  stockLengthFt: number,
  kerfAllowanceFt: number = DEFAULT_KERF_ALLOWANCE_FT
): number {
  return Math.ceil(neededLf / (stockLengthFt - kerfAllowanceFt));
}

export function optimizeTrimLength(
  neededLf: number,
  stockLengthFt: number,
  kerfAllowanceFt: number = DEFAULT_KERF_ALLOWANCE_FT
): StockCutResult {
  const usableLengthFt = stockLengthFt - kerfAllowanceFt;
  const piecesNeeded = stockPiecesNeeded(neededLf, stockLengthFt, kerfAllowanceFt);
  const totalStockFt = piecesNeeded * stockLengthFt;
  const wasteLinearFt = totalStockFt - neededLf;
  const wastePercent = (wasteLinearFt / totalStockFt) * 100;

  // Build cut list — simple sequential assignment
  let remainingNeeded = neededLf;
  const cutList: CutPiece[] = [];
  for (let i = 0; i < piecesNeeded; i++) {
    const thisLength = Math.min(remainingNeeded, usableLengthFt);
    const remainder = usableLengthFt - thisLength;
    cutList.push({
      pieceNumber: i + 1,
      lengthFt: Math.round(thisLength * 100) / 100,
      remainderFt: Math.round(remainder * 100) / 100,
      cuttingInstructions:
        remainder > 0.5
          ? `Cut to ${thisLength.toFixed(2)} ft — ${remainder.toFixed(2)} ft remainder`
          : 'Full length',
    });
    remainingNeeded -= thisLength;
  }

  return { stockLengthFt, piecesOrdered: piecesNeeded, totalStockFt, cutList, wastePercent, wasteLinearFt };
}
