/**
 * THE ORDER VALIDATOR'S PUBLIC SURFACE.
 *
 * Everything a caller needs, in one import — the engine, the vocabulary, the
 * audience filter and the limits table's provenance (which the admin panel
 * renders so an estimator knows which thresholds are still unconfirmed).
 *
 * TWO THINGS ARE DELIBERATELY NOT RE-EXPORTED HERE:
 *
 *   - `./anthropic-advisor-client`, because it imports the Anthropic SDK and
 *     therefore the API key. A barrel that pulled it in would make every
 *     importer of this module server-only, including the Quote Builder client
 *     component that runs the engine live as the customer types (CLAUDE.md
 *     rule #5). The API route imports that file directly.
 *   - `./fixtures`, which is test data and has no business in an application
 *     bundle.
 */

export {
  DIMENSION_LABELS,
  RANGED_DIMENSIONS,
  VALIDATION_FIELDS,
  isValidationField,
  type OrderValidatorItem,
  type OrderValidatorResult,
  type ProfileConstraints,
  type RangedDimension,
  type ValidatableHem,
  type ValidationAudience,
  type ValidationCode,
  type ValidationField,
  type ValidationFinding,
  type ValidationSeverity,
  type ValidationSource,
} from './types';

export {
  DEFAULT_ORDER_VALIDATOR_LIMITS,
  LIMIT_PROVENANCE,
  assumedLimitKeys,
  gaugeNumberOf,
  profileLabelKey,
  resolveLimits,
  type GaugeSpanLimit,
  type LimitProvenance,
  type LimitProvenanceEntry,
  type MaterialGaugeIncompatibility,
  type OrderValidatorLimits,
  type ProfileDimensionMinimum,
} from './limits';

export { ALL_RULES, type RuleContext, type ValidationRule } from './rules';

export {
  acknowledgeableFindings,
  blockingFindings,
  findingsForAudience,
  findingsForItem,
  informationalFindings,
  validateOrder,
  withAdvisories,
  worstFindingForField,
  type OrderValidatorInput,
} from './validate';

export {
  ADVISOR_MODEL,
  ADVISOR_TIMEOUT_MS,
  AI_ADVISOR_ENV_FLAG,
  MAX_ADVISORIES,
  isAiAdvisorEnabled,
  parseAdvisories,
  requestAdvisories,
  type AdvisoryClient,
  type AdvisoryOptions,
} from './ai-advisor';

export { findSelfIntersections, findZeroLengthSegments, segmentLengthsIn } from './geometry-checks';
