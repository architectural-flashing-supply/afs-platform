// Trim Length Optimizer — SPEC_TRIM_LENGTH_OPTIMIZER.md §2 (unchanged algorithm).
// Pure function of neededLf + stockLengthFt, same pattern as lib/utils/material-calc.ts:
// no API route, no pricing, just linear-footage/cut-list math.
//
// THIS IS THE CONTINUOUS-RUN QUESTION: "how much stock does this many LINEAR
// FEET consume?" — the right question for a lapped run of coping or drip edge,
// and the one the customer's quote form prints
// (components/quote/TrimLengthOptimizerSection.tsx).
//
// The DISCRETE question — "which finished pieces come off which stock piece?",
// with per-piece lengths, quantities and an explicit answer when a piece is
// longer than any stock — is lib/trim-optimizer/'s, and it is a different
// question rather than a better version of this one. See that directory's
// types.ts header. Neither is implemented in terms of the other.

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

export function optimizeTrimLength(
  neededLf: number,
  stockLengthFt: number,
  kerfAllowanceFt: number = DEFAULT_KERF_ALLOWANCE_FT
): StockCutResult {
  const usableLengthFt = stockLengthFt - kerfAllowanceFt;

  // NOTHING TO CUT, SAID EXPLICITLY. Without this, a stock length equal to the
  // blade allowance makes `neededLf / 0` Infinity, `Math.ceil` Infinity, and the
  // loop below unbounded — a frozen browser tab. A stock length BELOW the blade
  // allowance makes the count negative and the cut list silently empty while the
  // totals report nonsense. The live component guards `stockLengthFt > 0`, which
  // does not cover 0 < stockLengthFt <= kerf.
  //
  // Every input that produces a cut list today produces the same cut list still:
  // this returns early only for inputs that could not produce a correct one.
  if (
    !Number.isFinite(neededLf) ||
    neededLf <= 0 ||
    !Number.isFinite(stockLengthFt) ||
    !Number.isFinite(kerfAllowanceFt) ||
    kerfAllowanceFt < 0 ||
    usableLengthFt <= 0
  ) {
    return {
      stockLengthFt,
      piecesOrdered: 0,
      totalStockFt: 0,
      cutList: [],
      wastePercent: 0,
      wasteLinearFt: 0,
    };
  }

  const piecesNeeded = Math.ceil(neededLf / usableLengthFt);
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
