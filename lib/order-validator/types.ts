/**
 * THE ORDER VALIDATOR'S VOCABULARY. One module, one set of names.
 *
 * SPEC_AI_ORDER_VALIDATOR.md asks for two validation layers over a quote
 * request's line items: a deterministic range/geometry check and an AI
 * impossibility check. This file declares the shape both produce, for the same
 * reason lib/ai/takeoff-confidence.ts declares the confidence vocabulary once
 * (CLAUDE.md rule #17): the producer (the rule engine, the advisory layer) and
 * the consumers (the Quote Builder, the validate route, the admin review panel)
 * all import from here, so there is nowhere for them to drift.
 *
 * A local `type Severity = 'error' | 'warn' | 'info'` anywhere else in the
 * codebase is exactly the drift this prevents.
 */

/**
 * What a finding means for the reader.
 *
 * `error` — cannot be fabricated as specified. Blocks a customer from
 *           advancing past the dimensions step.
 * `warn`  — unusual but possible. The customer must acknowledge it; an
 *           estimator should look at it.
 * `info`  — context. Never blocks, never needs acknowledging.
 */
export type ValidationSeverity = 'error' | 'warn' | 'info';

/**
 * Who may read a finding.
 *
 * `customer` — shown to everyone, customer and admin alike.
 * `admin`    — shown only in admin scope. Used for two kinds of message: one
 *              that is about AFS's own capacity rather than the customer's
 *              drawing (how many strips come off a sheet), and one that tells
 *              the reader the check could not be made (no constraint row for
 *              this profile). Neither is the customer's problem to solve, and
 *              the first is cost-adjacent, which the RFQ model keeps away from
 *              customers entirely (CLAUDE.md, BUSINESS MODEL).
 *
 * There is deliberately no third audience and no customer-only value: admin
 * scope is a superset of customer scope, so an estimator always sees exactly
 * what the customer was told plus the internal detail.
 */
export type ValidationAudience = 'customer' | 'admin';

/** Which layer produced a finding. The AI layer can only ever be advisory. */
export type ValidationSource = 'deterministic' | 'ai';

/**
 * The offending field, as a closed union.
 *
 * The first seven are real `quote_requests.line_items[]` field names, so a UI
 * can point at the input the customer typed into. The last four are DERIVED
 * from FlashDraft's drawn polyline — there is no single typed field to blame
 * for a self-intersection, so the geometry itself is named.
 */
export type ValidationField =
  | 'profileType'
  | 'material'
  | 'gauge'
  | 'width'
  | 'height'
  | 'legA'
  | 'legB'
  | 'lengthFt'
  | 'quantity'
  | 'points'
  | 'blankWidth'
  | 'bendCount'
  | 'hem';

/** Every `ValidationField`, for validating a field name that came from outside. */
export const VALIDATION_FIELDS: readonly ValidationField[] = [
  'profileType',
  'material',
  'gauge',
  'width',
  'height',
  'legA',
  'legB',
  'lengthFt',
  'quantity',
  'points',
  'blankWidth',
  'bendCount',
  'hem',
];

export function isValidationField(value: unknown): value is ValidationField {
  return typeof value === 'string' && (VALIDATION_FIELDS as readonly string[]).includes(value);
}

/**
 * The stable machine code for each rule. Shown to admins, never to customers,
 * and never parsed for meaning — it exists so a finding can be referred to in
 * a bug report or acknowledged by identity without matching on its prose.
 *
 * `OV_AI_ADVISORY` is the one code the advisory layer may produce. It has no
 * rule behind it by design: a model-authored finding is not one of AFS's rules,
 * and giving it a rule's code would dress it up as one.
 */
export type ValidationCode =
  | 'OV_PROFILE_TYPE_MISSING'
  | 'OV_QUANTITY_NOT_POSITIVE'
  | 'OV_LENGTH_NOT_POSITIVE'
  | 'OV_DIMENSION_NOT_POSITIVE'
  | 'OV_DIMENSION_BELOW_MIN'
  | 'OV_DIMENSION_ABOVE_MAX'
  | 'OV_PROFILE_CONSTRAINTS_UNKNOWN'
  | 'OV_PROFILE_MIN_WIDTH'
  | 'OV_FLANGE_TOO_SHORT'
  | 'OV_LENGTH_ABOVE_PROFILE_MAX'
  | 'OV_PIECE_NEEDS_SPLICING'
  | 'OV_COPING_LEGS_EXCEED_WIDTH'
  | 'OV_GAUGE_SPAN_LIGHT'
  | 'OV_MATERIAL_GAUGE_INCOMPATIBLE'
  | 'OV_SEGMENT_ZERO_LENGTH'
  | 'OV_SEGMENT_TOO_SHORT'
  | 'OV_SELF_INTERSECTION'
  | 'OV_BEND_COUNT_HIGH'
  | 'OV_BEND_COUNT_EXCEEDED'
  | 'OV_BLANK_WIDTH_EXCEEDS_SHEET'
  | 'OV_BLANK_WIDTH_ONE_STRIP'
  | 'OV_HEM_FOLD_TOO_SHORT'
  | 'OV_HEM_FOLD_NOT_POSITIVE'
  | 'OV_REQUIRES_CONSULTATION'
  | 'OV_AI_ADVISORY';

/** One thing wrong — or worth knowing — about one line item. */
export interface ValidationFinding {
  code: ValidationCode;
  severity: ValidationSeverity;
  /** The input to point the reader at. */
  field: ValidationField;
  /**
   * Plain English, written for this finding's audience. Never contains a stack
   * trace, a rule code, or a dollar amount — the RFQ model keeps every figure
   * with a currency on it off customer-facing surfaces until AFS has issued a
   * formal quote.
   */
  message: string;
  /** Index into the `items` array that was validated, so a UI can find the row. */
  itemIndex: number;
  audience: ValidationAudience;
  source: ValidationSource;
}

/**
 * A hem as the validator needs to see it. FlashDraft sends
 * `{ type, gapIn, lengthIn, kick }` per free end; only the fold length is a
 * fabricability question, so only it is read here. Deliberately structural
 * rather than importing FlashDraft's own `Hem` type: this module must be able
 * to validate a line item read back out of JSONB, where nothing guarantees the
 * other three fields survived.
 */
export interface ValidatableHem {
  lengthIn?: number | null;
}

/**
 * One line item, as the validator reads it.
 *
 * Structurally compatible with `quote_requests.line_items[]` as all three live
 * writers produce it (the Quote Builder's named dimensions, FlashDraft's
 * `points` + hems, the Blueprint Takeoff extraction's named dimensions), and
 * with `lib/pricing/quote-inputs.ts`'s `JobLineItemGeometry` — which is where
 * the girth, bend count and hem count are actually measured, so the validator
 * and the price book can never disagree about the shape of the same profile.
 *
 * Every field is optional because a line item read back out of JSONB offers no
 * guarantees. An ABSENT dimension is not validated; it is not zero.
 */
export interface OrderValidatorItem {
  profileType?: string | null;
  profileName?: string | null;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt?: number | null;
  quantity?: number | null;
  /** FlashDraft's drawn polyline, in world inches. */
  points?: { x: number; y: number }[] | null;
  hemStart?: ValidatableHem | null;
  hemEnd?: ValidatableHem | null;
}

/**
 * The dimension ranges for one profile, straight off a `product_profiles` row.
 *
 * EVERY BOUND IS INDEPENDENTLY NULLABLE, and that is real twice over.
 *
 * In `supabase/migrations/002_seed_afs_data.sql`, which seeds 12 rows: Fascia
 * has no leg range, Valley Flashing has no height range, and Custom Profile has
 * no ranges at all.
 *
 * And in the LIVE database, far more so. Measured 2026-10-03: all twelve rows
 * have NULL for all EIGHT bounds — migration 002's ranges are not in that
 * database, whatever SCHEMA.md's ledger says about 002 being applied. So the
 * all-NULL case is the normal case today, not an edge case, which is why
 * `OV_PROFILE_CONSTRAINTS_UNKNOWN` reports a row with no ranges as well as a
 * missing row.
 *
 * `null` means NO CONSTRAINT — never zero, and never "use the neighbouring
 * profile's".
 */
export interface ProfileConstraints {
  /** `product_profiles.slug`. */
  slug: string;
  /** `product_profiles.name`, used in messages so they read like the catalog. */
  name: string;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
  minLegA: number | null;
  maxLegA: number | null;
  minLegB: number | null;
  maxLegB: number | null;
  maxLengthFt: number | null;
  requiresConsultation: boolean;
}

/** The four dimensions that have a min/max pair on `product_profiles`. */
export type RangedDimension = 'width' | 'height' | 'legA' | 'legB';

export const RANGED_DIMENSIONS: readonly RangedDimension[] = ['width', 'height', 'legA', 'legB'];

/** How each ranged dimension reads in a sentence. */
export const DIMENSION_LABELS: Record<RangedDimension, string> = {
  width: 'Width',
  height: 'Height',
  legA: 'Leg A',
  legB: 'Leg B',
};

/** What the engine returns for a whole job. */
export interface OrderValidatorResult {
  /** Sorted deterministically — see lib/order-validator/validate.ts. */
  findings: ValidationFinding[];
  counts: { error: number; warn: number; info: number };
  /**
   * True when at least one DETERMINISTIC error exists. The advisory AI layer
   * can never set this — SPEC_AI_ORDER_VALIDATOR.md §5 would have had AI errors
   * block, and that is the one place this build deliberately departs from the
   * spec: unverified model output does not get to refuse a fabricable order.
   */
  blocked: boolean;
  /** True when a blocking error is one the customer can actually see and fix. */
  blockedForCustomer: boolean;
}
