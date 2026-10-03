/**
 * THE DISCRETE CUT PLANNER — public surface.
 *
 * Import from '@/lib/trim-optimizer'. The engine is in ./optimize.ts, its
 * contracts in ./types.ts, and the 1/16-inch grid it computes on in
 * ./sixteenths.ts, each with its own header explaining why it is the way it is.
 *
 * Not to be confused with lib/utils/trim-optimizer.ts, which answers the other
 * cut-list question (continuous linear feet, specs/SPEC_TRIM_LENGTH_OPTIMIZER.md
 * §2) and is what the customer's quote form prints. See ./types.ts's header.
 */

export {
  optimizeCutPlan,
  stockLengthFromFeet,
  DEFAULT_KERF_IN,
  DEFAULT_STRATEGY,
  MAX_TOTAL_PIECES,
} from './optimize';

export { SIXTEENTHS_PER_INCH, feetToInches, fromSixteenths } from './sixteenths';

export type {
  CutAssignment,
  CutPlan,
  CutPlanError,
  CutPlanErrorCode,
  CutPlanErrorDetails,
  CutPlanInput,
  CutPlanResult,
  CutStrategy,
  CutTotals,
  ProfilePlan,
  RequiredPiece,
  ResolvedSettings,
  StockCut,
  StockLength,
  TrimOptimizerSettings,
} from './types';
