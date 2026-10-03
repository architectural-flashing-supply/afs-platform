/**
 * THE DETERMINISTIC RULES, AS AN ORDERED LIST OF DATA.
 *
 * Each rule is an object with a stable code and a `run` that returns findings,
 * rather than a branch inside one long function, for three reasons that all
 * matter to a validator sitting in front of a bending machine:
 *
 *   1. THE EVALUATION ORDER IS INSPECTABLE. `ALL_RULES` is the order, so
 *      "which message does the customer see first" is a visible property of
 *      this file and not an accident of control flow.
 *   2. THE TEST CAN ITERATE THE RULES. lib/order-validator/rules.test.ts walks
 *      `ALL_RULES` and fails if a declared `ValidationCode` has no rule behind
 *      it, so a code cannot be declared and quietly never implemented.
 *   3. A RULE CAN BE READ ON ITS OWN. Every one is a pure function of
 *      (item, constraints, limits) and nothing else.
 *
 * MESSAGES ARE WRITTEN FOR THE READER, NOT THE DEVELOPER. A customer-audience
 * message says what is wrong and what the limit is, in inches written the way
 * the shop writes them (`lib/utils/format-inches.ts` — fractional sixteenths,
 * the same formatter FlashDraft's canvas and the 3D viewer use). It never
 * contains a rule code, a field name as typed in TypeScript, or any figure with
 * a currency on it: AFS is an RFQ platform and a customer sees no money before
 * a formal quote (CLAUDE.md, BUSINESS MODEL).
 *
 * WHAT IS NOT HERE, and why:
 *   - SPEC section 3's "Counter Flashing: Height must be greater than Lap". There is
 *     no `lap` field on a line item, in `product_profiles`, or on any input
 *     surface in this repository. Inferring one from `legA` would be inventing a
 *     dimension the customer never gave. Recorded UNRESOLVED in
 *     EES-OVN.04-ORDER-VALIDATOR.md.
 */

import { bendCountFromPoints, blankWidthInFromPoints } from '@/lib/pricing/quote-inputs';
import { stripsPerSheet } from '@/lib/pricing/quote-math';
import { materialCategoryForLabel } from '@/lib/data/material-color-requirement';
import { formatInches } from '@/lib/utils/format-inches';
import { findSelfIntersections, findZeroLengthSegments, segmentLengthsIn } from './geometry-checks';
import {
  gaugeNumberOf,
  profileLabelKey,
  type OrderValidatorLimits,
} from './limits';
import {
  DIMENSION_LABELS,
  RANGED_DIMENSIONS,
  type OrderValidatorItem,
  type ProfileConstraints,
  type RangedDimension,
  type ValidationCode,
  type ValidationFinding,
} from './types';

export interface RuleContext {
  item: OrderValidatorItem;
  itemIndex: number;
  /** Resolved from `product_profiles`, or null when this profile has no row. */
  constraints: ProfileConstraints | null;
  limits: OrderValidatorLimits;
}

export interface ValidationRule {
  code: ValidationCode;
  run(context: RuleContext): ValidationFinding[];
}

// ---------------------------------------------------------------------------
// Reading an untrusted line item
// ---------------------------------------------------------------------------

interface SuppliedNumber {
  /** The customer gave a value for this field — even if the value is nonsense. */
  supplied: boolean;
  /** NaN when something was supplied that is not a usable number. */
  value: number;
}

/**
 * ABSENT IS NOT ZERO, and a nonsense value is not absent.
 *
 * `null`/`undefined` means the field was left blank — the Quote Builder's
 * `toNumberOrNull` sends exactly that for an empty input, and FlashDraft never
 * sets the named dimensions at all. A blank field is not validated: there is
 * nothing to be wrong about, and treating it as 0 would report every optional
 * dimension as impossible.
 *
 * Anything else counts as SUPPLIED. A number is taken as given (it may still be
 * 0, negative, NaN or Infinity, each of which the structural rule reports); a
 * non-number — a stray string from a hand-rolled client — becomes NaN and is
 * reported too, rather than silently skipped.
 */
function readNumber(raw: unknown): SuppliedNumber {
  if (raw === null || raw === undefined) return { supplied: false, value: Number.NaN };
  if (typeof raw === 'number') return { supplied: true, value: raw };
  return { supplied: true, value: Number.NaN };
}

/** A supplied value that is a real, positive measurement. */
function isUsable(read: SuppliedNumber): boolean {
  return read.supplied && Number.isFinite(read.value) && read.value > 0;
}

function dimensionOf(item: OrderValidatorItem, dimension: RangedDimension): SuppliedNumber {
  return readNumber(item[dimension]);
}

function minBound(constraints: ProfileConstraints, dimension: RangedDimension): number | null {
  switch (dimension) {
    case 'width':
      return constraints.minWidth;
    case 'height':
      return constraints.minHeight;
    case 'legA':
      return constraints.minLegA;
    case 'legB':
      return constraints.minLegB;
  }
}

function maxBound(constraints: ProfileConstraints, dimension: RangedDimension): number | null {
  switch (dimension) {
    case 'width':
      return constraints.maxWidth;
    case 'height':
      return constraints.maxHeight;
    case 'legA':
      return constraints.maxLegA;
    case 'legB':
      return constraints.maxLegB;
  }
}

/** How a line reads in a message when there are several items on one request. */
function profileNameFor(context: RuleContext): string {
  const named = typeof context.item.profileName === 'string' ? context.item.profileName.trim() : '';
  if (named !== '') return named;
  const type = typeof context.item.profileType === 'string' ? context.item.profileType.trim() : '';
  if (type !== '') return type;
  return context.constraints?.name ?? 'this profile';
}

function finding(
  context: RuleContext,
  partial: Omit<ValidationFinding, 'itemIndex' | 'source'>
): ValidationFinding {
  return { ...partial, itemIndex: context.itemIndex, source: 'deterministic' };
}

// ---------------------------------------------------------------------------
// The rules, in evaluation order
// ---------------------------------------------------------------------------

/**
 * A line item with no profile type cannot be quoted or fabricated — nobody
 * knows what it is. `app/api/quote-requests/route.ts` already refuses a
 * submission whose items all lack one; this reports it per item so a UI can
 * point at the row.
 */
const profileTypeMissing: ValidationRule = {
  code: 'OV_PROFILE_TYPE_MISSING',
  run(context) {
    const type = typeof context.item.profileType === 'string' ? context.item.profileType.trim() : '';
    if (type !== '') return [];
    return [
      finding(context, {
        code: 'OV_PROFILE_TYPE_MISSING',
        severity: 'error',
        field: 'profileType',
        audience: 'customer',
        message: 'Choose a profile type so AFS knows what to fabricate.',
      }),
    ];
  },
};

const quantityNotPositive: ValidationRule = {
  code: 'OV_QUANTITY_NOT_POSITIVE',
  run(context) {
    const quantity = readNumber(context.item.quantity);
    if (isUsable(quantity)) return [];
    return [
      finding(context, {
        code: 'OV_QUANTITY_NOT_POSITIVE',
        severity: 'error',
        field: 'quantity',
        audience: 'customer',
        message: 'Enter how many you need — it has to be more than zero.',
      }),
    ];
  },
};

const lengthNotPositive: ValidationRule = {
  code: 'OV_LENGTH_NOT_POSITIVE',
  run(context) {
    const length = readNumber(context.item.lengthFt);
    if (isUsable(length)) return [];
    return [
      finding(context, {
        code: 'OV_LENGTH_NOT_POSITIVE',
        severity: 'error',
        field: 'lengthFt',
        audience: 'customer',
        message: 'Enter the finished length in feet — it has to be more than zero.',
      }),
    ];
  },
};

/**
 * A dimension the customer filled in that cannot be a measurement: zero,
 * negative, or not a number. One finding per offending field, so each input gets
 * its own message rather than one banner naming four fields.
 */
const dimensionNotPositive: ValidationRule = {
  code: 'OV_DIMENSION_NOT_POSITIVE',
  run(context) {
    const findings: ValidationFinding[] = [];
    for (const dimension of RANGED_DIMENSIONS) {
      const read = dimensionOf(context.item, dimension);
      if (!read.supplied || isUsable(read)) continue;
      findings.push(
        finding(context, {
          code: 'OV_DIMENSION_NOT_POSITIVE',
          severity: 'error',
          field: dimension,
          audience: 'customer',
          message: `${DIMENSION_LABELS[dimension]} has to be a measurement greater than zero. Leave it blank if this profile does not have one.`,
        })
      );
    }
    return findings;
  },
};

const dimensionBelowMin: ValidationRule = {
  code: 'OV_DIMENSION_BELOW_MIN',
  run(context) {
    const { constraints } = context;
    if (!constraints) return [];
    const findings: ValidationFinding[] = [];
    for (const dimension of RANGED_DIMENSIONS) {
      const read = dimensionOf(context.item, dimension);
      if (!isUsable(read)) continue;
      const min = minBound(constraints, dimension);
      if (min === null || read.value >= min) continue;
      findings.push(
        finding(context, {
          code: 'OV_DIMENSION_BELOW_MIN',
          severity: 'error',
          field: dimension,
          audience: 'customer',
          message: `The smallest ${DIMENSION_LABELS[dimension].toLowerCase()} AFS fabricates for a ${constraints.name} is ${formatInches(min)}. You entered ${formatInches(read.value)}.`,
        })
      );
    }
    return findings;
  },
};

const dimensionAboveMax: ValidationRule = {
  code: 'OV_DIMENSION_ABOVE_MAX',
  run(context) {
    const { constraints } = context;
    if (!constraints) return [];
    const findings: ValidationFinding[] = [];
    for (const dimension of RANGED_DIMENSIONS) {
      const read = dimensionOf(context.item, dimension);
      if (!isUsable(read)) continue;
      const max = maxBound(constraints, dimension);
      if (max === null || read.value <= max) continue;
      findings.push(
        finding(context, {
          code: 'OV_DIMENSION_ABOVE_MAX',
          severity: 'error',
          field: dimension,
          audience: 'customer',
          message: `The largest ${DIMENSION_LABELS[dimension].toLowerCase()} AFS fabricates for a ${constraints.name} is ${formatInches(max)}. You entered ${formatInches(read.value)}.`,
        })
      );
    }
    return findings;
  },
};

/**
 * ADMIN ONLY, and it is the honest half of this validator: it says the range
 * check did not happen.
 *
 * Five Quote Builder labels have no `product_profiles` row — Step Flashing,
 * Conductor Head, Downspout, Reglet, Wall Panel / Cladding — and FlashDraft's
 * 'Custom FlashDraft Profile' has none either. For those, no min/max exists to
 * check against, and a silent pass would be indistinguishable from a pass that
 * checked something. The customer is not told, because "AFS holds no dimension
 * data for this profile" is AFS's business, not a defect in their drawing.
 */
const profileConstraintsUnknown: ValidationRule = {
  code: 'OV_PROFILE_CONSTRAINTS_UNKNOWN',
  run(context) {
    if (context.constraints) return [];
    const type = typeof context.item.profileType === 'string' ? context.item.profileType.trim() : '';
    if (type === '') return [];
    return [
      finding(context, {
        code: 'OV_PROFILE_CONSTRAINTS_UNKNOWN',
        severity: 'info',
        field: 'profileType',
        audience: 'admin',
        message: `No dimension ranges are on file for "${type}", so width, height and leg limits were not checked on this line. Geometry and sheet-size checks still ran.`,
      }),
    ];
  },
};

/**
 * A per-profile minimum that has no `product_profiles` row behind it.
 *
 * SPEC section 3 states one: "Step Flashing: Width should be at least 4 inches for
 * standard shingle coverage." It is a `warn`, not an `error`, because the spec
 * says "should", and a narrower step flashing is fabricable — it just will not
 * cover a standard shingle course.
 */
const profileMinWidth: ValidationRule = {
  code: 'OV_PROFILE_MIN_WIDTH',
  run(context) {
    const key = profileLabelKey(context.item.profileType);
    if (key === '') return [];
    const findings: ValidationFinding[] = [];
    for (const minimum of context.limits.profileMinimums) {
      if (profileLabelKey(minimum.profileLabel) !== key) continue;
      const read = dimensionOf(context.item, minimum.dimension);
      if (!isUsable(read) || read.value >= minimum.minIn) continue;
      findings.push(
        finding(context, {
          code: 'OV_PROFILE_MIN_WIDTH',
          severity: 'warn',
          field: minimum.dimension,
          audience: 'customer',
          message: `A ${minimum.profileLabel.toLowerCase()} is normally at least ${formatInches(minimum.minIn)} ${DIMENSION_LABELS[minimum.dimension].toLowerCase()} to cover a standard shingle course. You entered ${formatInches(read.value)} — AFS will confirm this is what you want.`,
        })
      );
    }
    return findings;
  },
};

/**
 * A leg too short to form on a brake. Separate from
 * `OV_DIMENSION_NOT_POSITIVE` because a 1/8" leg is a real measurement the
 * customer meant, and the message has to say what the minimum is.
 *
 * The threshold is an ASSUMPTION (see lib/order-validator/limits.ts) and is set
 * permissively on purpose.
 */
const flangeTooShort: ValidationRule = {
  code: 'OV_FLANGE_TOO_SHORT',
  run(context) {
    const findings: ValidationFinding[] = [];
    for (const dimension of ['legA', 'legB'] as const) {
      const read = dimensionOf(context.item, dimension);
      if (!isUsable(read) || read.value >= context.limits.minFlangeLengthIn) continue;
      findings.push(
        finding(context, {
          code: 'OV_FLANGE_TOO_SHORT',
          severity: 'error',
          field: dimension,
          audience: 'customer',
          message: `${DIMENSION_LABELS[dimension]} is ${formatInches(read.value)}, which is shorter than the ${formatInches(context.limits.minFlangeLengthIn)} AFS needs to form a leg.`,
        })
      );
    }
    return findings;
  },
};

const lengthAboveProfileMax: ValidationRule = {
  code: 'OV_LENGTH_ABOVE_PROFILE_MAX',
  run(context) {
    const { constraints } = context;
    if (!constraints || constraints.maxLengthFt === null) return [];
    const read = readNumber(context.item.lengthFt);
    if (!isUsable(read) || read.value <= constraints.maxLengthFt) return [];
    return [
      finding(context, {
        code: 'OV_LENGTH_ABOVE_PROFILE_MAX',
        severity: 'error',
        field: 'lengthFt',
        audience: 'customer',
        message: `The longest single piece AFS fabricates for a ${constraints.name} is ${constraints.maxLengthFt} ft. You entered ${read.value} ft — split the run into shorter pieces.`,
      }),
    ];
  },
};

/**
 * ADMIN ONLY. A piece longer than one sheet is fabricable — it is spliced, and
 * `product_profiles.max_length_ft` is the real limit (12 ft for most profiles,
 * 20 ft for an expansion joint, 40 ft for standing seam) — but it is not one
 * strip off one sheet, which is what the shop needs to know before it plans the
 * work. Kept away from the customer because it is production detail, and
 * production detail here is cost-adjacent.
 */
const pieceNeedsSplicing: ValidationRule = {
  code: 'OV_PIECE_NEEDS_SPLICING',
  run(context) {
    const read = readNumber(context.item.lengthFt);
    if (!isUsable(read) || read.value <= context.limits.maxPieceLengthFt) return [];
    const max = context.constraints?.maxLengthFt;
    // Already refused by OV_LENGTH_ABOVE_PROFILE_MAX — do not also note it.
    if (max !== null && max !== undefined && read.value > max) return [];
    return [
      finding(context, {
        code: 'OV_PIECE_NEEDS_SPLICING',
        severity: 'info',
        field: 'lengthFt',
        audience: 'admin',
        message: `${profileNameFor(context)} is ${read.value} ft per piece, longer than the ${context.limits.maxPieceLengthFt} ft a single sheet yields. It will need splicing.`,
      }),
    ];
  },
};

/**
 * SPEC section 3: "Coping Cap: Leg A + Leg B must be less than Width (legs fold down
 * from the cap)." The two drip legs are folded down out of the same flat blank
 * as the cap, so if they add up to the cap's width there is no cap left between
 * them.
 *
 * Fires only when all three are real measurements — a coping cap submitted with
 * no legs at all is not this error.
 */
const copingLegsExceedWidth: ValidationRule = {
  code: 'OV_COPING_LEGS_EXCEED_WIDTH',
  run(context) {
    if (profileLabelKey(context.item.profileType) !== profileLabelKey('Coping Cap')) return [];
    const width = dimensionOf(context.item, 'width');
    const legA = dimensionOf(context.item, 'legA');
    const legB = dimensionOf(context.item, 'legB');
    if (!isUsable(width) || !isUsable(legA) || !isUsable(legB)) return [];
    const legs = legA.value + legB.value;
    if (legs < width.value) return [];
    return [
      finding(context, {
        code: 'OV_COPING_LEGS_EXCEED_WIDTH',
        severity: 'error',
        field: 'legA',
        audience: 'customer',
        message: `Leg A plus Leg B is ${formatInches(legs)}, which is not less than the ${formatInches(width.value)} width. The legs fold down from the cap, so together they have to fit inside it.`,
      }),
    ];
  },
};

/**
 * SPEC section 3's gauge-versus-width rule: "Very wide spans in light gauges will not
 * hold shape — flag if Width > 24" and gauge is > 22ga galvanized."
 *
 * Gauge numbers run backwards, so "> 22ga" means THINNER than 22 GA. Compared as
 * a number parsed from the label the customer chose, which keeps this rule pure
 * — see `gaugeNumberOf` in lib/order-validator/limits.ts for why thickness is
 * deliberately not looked up.
 */
const gaugeSpanLight: ValidationRule = {
  code: 'OV_GAUGE_SPAN_LIGHT',
  run(context) {
    const width = dimensionOf(context.item, 'width');
    if (!isUsable(width)) return [];
    const gaugeNumber = gaugeNumberOf(context.item.gauge);
    if (gaugeNumber === null) return [];
    const category = materialCategoryForLabel(context.item.material ?? '');
    const gaugeLabel = (context.item.gauge ?? '').trim();

    const findings: ValidationFinding[] = [];
    for (const limit of context.limits.gaugeSpanLimits) {
      if (limit.materialCategory !== null && limit.materialCategory !== category) continue;
      if (width.value < limit.minWidthIn) continue;
      if (gaugeNumber <= limit.lighterThanGaugeNumber) continue;
      findings.push(
        finding(context, {
          code: 'OV_GAUGE_SPAN_LIGHT',
          severity: 'warn',
          field: 'gauge',
          audience: 'customer',
          message: `A ${formatInches(width.value)} span in ${gaugeLabel} is at the limit of what that gauge holds without oil-canning. A heavier gauge is steadier over this width — AFS will confirm your choice either way.`,
        })
      );
    }
    return findings;
  },
};

/**
 * A material and gauge pairing AFS will not fabricate.
 *
 * The default list is EMPTY and will stay empty until checklist #38
 * (fabrication constraints) arrives — see `incompatibleCombinations` in
 * lib/order-validator/limits.ts. The rule is real and tested against an
 * explicit configuration; what is missing is the data, not the code.
 */
const materialGaugeIncompatible: ValidationRule = {
  code: 'OV_MATERIAL_GAUGE_INCOMPATIBLE',
  run(context) {
    if (context.limits.incompatibleCombinations.length === 0) return [];
    const gaugeNumber = gaugeNumberOf(context.item.gauge);
    if (gaugeNumber === null) return [];
    const category = materialCategoryForLabel(context.item.material ?? '');
    if (category === null) return [];

    const findings: ValidationFinding[] = [];
    for (const combination of context.limits.incompatibleCombinations) {
      if (combination.materialCategory !== category) continue;
      if (combination.gaugeNumber !== gaugeNumber) continue;
      findings.push(
        finding(context, {
          code: 'OV_MATERIAL_GAUGE_INCOMPATIBLE',
          severity: 'error',
          field: 'gauge',
          audience: 'customer',
          message: combination.reason,
        })
      );
    }
    return findings;
  },
};

const segmentZeroLength: ValidationRule = {
  code: 'OV_SEGMENT_ZERO_LENGTH',
  run(context) {
    const zero = findZeroLengthSegments(context.item.points, context.limits.zeroLengthEpsilonIn);
    if (zero.length === 0) return [];
    return [
      finding(context, {
        code: 'OV_SEGMENT_ZERO_LENGTH',
        severity: 'error',
        field: 'points',
        audience: 'customer',
        message:
          zero.length === 1
            ? 'Two points on the drawing sit on top of each other, so one leg has no length. Move or delete one of them.'
            : `${zero.length} legs on the drawing have no length because their end points sit on top of each other. Move or delete the duplicated points.`,
      }),
    ];
  },
};

const segmentTooShort: ValidationRule = {
  code: 'OV_SEGMENT_TOO_SHORT',
  run(context) {
    const { minFlangeLengthIn, zeroLengthEpsilonIn } = context.limits;
    const lengths = segmentLengthsIn(context.item.points);
    const tooShort = lengths.filter((length) => length > zeroLengthEpsilonIn && length < minFlangeLengthIn);
    if (tooShort.length === 0) return [];
    const shortest = Math.min(...tooShort);
    return [
      finding(context, {
        code: 'OV_SEGMENT_TOO_SHORT',
        severity: 'error',
        field: 'points',
        audience: 'customer',
        message: `The drawing has a leg of ${formatInches(shortest)}, which is shorter than the ${formatInches(minFlangeLengthIn)} AFS needs to form one. Lengthen it or remove the bend.`,
      }),
    ];
  },
};

const selfIntersection: ValidationRule = {
  code: 'OV_SELF_INTERSECTION',
  run(context) {
    const crossings = findSelfIntersections(context.item.points, context.limits.zeroLengthEpsilonIn);
    if (crossings.length === 0) return [];
    return [
      finding(context, {
        code: 'OV_SELF_INTERSECTION',
        severity: 'error',
        field: 'points',
        audience: 'customer',
        message:
          'The drawn profile crosses over itself, so the metal would have to pass through itself to be folded into that shape. Adjust the bends so no two legs overlap.',
      }),
    ];
  },
};

const bendCountHigh: ValidationRule = {
  code: 'OV_BEND_COUNT_HIGH',
  run(context) {
    const bends = bendCountFromPoints(context.item.points);
    const { maxBendCountWarn, maxBendCountError } = context.limits;
    if (bends <= maxBendCountWarn || bends > maxBendCountError) return [];
    return [
      finding(context, {
        code: 'OV_BEND_COUNT_HIGH',
        severity: 'warn',
        field: 'bendCount',
        audience: 'customer',
        message: `This profile has ${bends} bends, more than the ${maxBendCountWarn} AFS forms without checking the setup first. It can probably be made — AFS will confirm before quoting.`,
      }),
    ];
  },
};

const bendCountExceeded: ValidationRule = {
  code: 'OV_BEND_COUNT_EXCEEDED',
  run(context) {
    const bends = bendCountFromPoints(context.item.points);
    if (bends <= context.limits.maxBendCountError) return [];
    return [
      finding(context, {
        code: 'OV_BEND_COUNT_EXCEEDED',
        severity: 'error',
        field: 'bendCount',
        audience: 'customer',
        message: `This profile has ${bends} bends, more than the ${context.limits.maxBendCountError} AFS can form in one piece. Split it into two profiles that join on site.`,
      }),
    ];
  },
};

/**
 * The flat blank — the profile unfolded — has to fit across a sheet.
 *
 * Girth comes from `blankWidthInFromPoints` in lib/pricing/quote-inputs.ts, the
 * same measurement the Command Center's approval route uses to build
 * `machine_jobs.blank_width_mm`, so the number the validator refuses on and the
 * number sent to the Thalmann cannot disagree (CLAUDE.md rule #19).
 */
const blankWidthExceedsSheet: ValidationRule = {
  code: 'OV_BLANK_WIDTH_EXCEEDS_SHEET',
  run(context) {
    const girth = blankWidthInFromPoints(context.item.points);
    if (girth === null || girth <= context.limits.maxBlankWidthIn) return [];
    return [
      finding(context, {
        code: 'OV_BLANK_WIDTH_EXCEEDS_SHEET',
        severity: 'error',
        field: 'blankWidth',
        audience: 'customer',
        message: `Unfolded, this profile is ${formatInches(girth)} across, and AFS cuts it from a sheet ${formatInches(context.limits.maxBlankWidthIn)} wide. It cannot be made from one piece at this size.`,
      }),
    ];
  },
};

/**
 * ADMIN ONLY, and cost-adjacent on purpose: a blank wide enough that only one
 * strip comes off a sheet is the shop's problem to know about, not the
 * customer's to be told about. `stripsPerSheet` is the real derived formula from
 * lib/pricing/quote-math.ts; it throws above the sheet width, which the rule
 * above has already refused, so it is only called on a width that fits.
 */
const blankWidthOneStrip: ValidationRule = {
  code: 'OV_BLANK_WIDTH_ONE_STRIP',
  run(context) {
    const girth = blankWidthInFromPoints(context.item.points);
    if (girth === null || girth > context.limits.maxBlankWidthIn) return [];
    if (stripsPerSheet(girth) !== 1) return [];
    return [
      finding(context, {
        code: 'OV_BLANK_WIDTH_ONE_STRIP',
        severity: 'info',
        field: 'blankWidth',
        audience: 'admin',
        message: `${profileNameFor(context)} unfolds to ${formatInches(girth)}, so only one strip comes off each sheet.`,
      }),
    ];
  },
};

function hemEntries(item: OrderValidatorItem): { label: string; lengthIn: unknown }[] {
  const entries: { label: string; lengthIn: unknown }[] = [];
  if (item.hemStart) entries.push({ label: 'start', lengthIn: item.hemStart.lengthIn });
  if (item.hemEnd) entries.push({ label: 'end', lengthIn: item.hemEnd.lengthIn });
  return entries;
}

const hemFoldNotPositive: ValidationRule = {
  code: 'OV_HEM_FOLD_NOT_POSITIVE',
  run(context) {
    const findings: ValidationFinding[] = [];
    for (const hem of hemEntries(context.item)) {
      const read = readNumber(hem.lengthIn);
      if (!read.supplied || isUsable(read)) continue;
      findings.push(
        finding(context, {
          code: 'OV_HEM_FOLD_NOT_POSITIVE',
          severity: 'error',
          field: 'hem',
          audience: 'customer',
          message: `The hem at the ${hem.label} of the profile has no fold length. Give it a length or remove the hem.`,
        })
      );
    }
    return findings;
  },
};

const hemFoldTooShort: ValidationRule = {
  code: 'OV_HEM_FOLD_TOO_SHORT',
  run(context) {
    const findings: ValidationFinding[] = [];
    for (const hem of hemEntries(context.item)) {
      const read = readNumber(hem.lengthIn);
      if (!isUsable(read) || read.value >= context.limits.minHemFoldLengthIn) continue;
      findings.push(
        finding(context, {
          code: 'OV_HEM_FOLD_TOO_SHORT',
          severity: 'error',
          field: 'hem',
          audience: 'customer',
          message: `The hem at the ${hem.label} of the profile folds back ${formatInches(read.value)}, shorter than the ${formatInches(context.limits.minHemFoldLengthIn)} AFS needs to form a hem.`,
        })
      );
    }
    return findings;
  },
};

/**
 * `product_profiles.requires_consultation` is real seeded data: Scupper,
 * Expansion Joint, Standing Seam Roofing and Custom Profile all carry it. An
 * `info` for the customer, because it changes nothing they need to fix — it
 * tells them an engineer will look at the request before a quote comes back.
 */
const requiresConsultation: ValidationRule = {
  code: 'OV_REQUIRES_CONSULTATION',
  run(context) {
    if (!context.constraints?.requiresConsultation) return [];
    return [
      finding(context, {
        code: 'OV_REQUIRES_CONSULTATION',
        severity: 'info',
        field: 'profileType',
        audience: 'customer',
        message: `A ${context.constraints.name} is reviewed by AFS engineering before it is quoted, so this request may take a little longer to come back.`,
      }),
    ];
  },
};

/**
 * THE EVALUATION ORDER. Structural problems first (there is no point telling
 * someone their width is out of range when they have not said what they are
 * ordering), then ranges, then the profile-specific geometry rules, then the
 * drawn-geometry rules, then the sheet-fit rules, then context.
 *
 * There is deliberately no rule about how MANY hems a profile has: at most one
 * per free end is all FlashDraft can produce (CLAUDE.md rule #13), so the count
 * has nothing to be wrong about. Only each fold's length does.
 */
export const ALL_RULES: readonly ValidationRule[] = [
  profileTypeMissing,
  quantityNotPositive,
  lengthNotPositive,
  dimensionNotPositive,
  dimensionBelowMin,
  dimensionAboveMax,
  profileConstraintsUnknown,
  profileMinWidth,
  flangeTooShort,
  lengthAboveProfileMax,
  pieceNeedsSplicing,
  copingLegsExceedWidth,
  gaugeSpanLight,
  materialGaugeIncompatible,
  segmentZeroLength,
  segmentTooShort,
  selfIntersection,
  bendCountHigh,
  bendCountExceeded,
  blankWidthExceedsSheet,
  blankWidthOneStrip,
  hemFoldNotPositive,
  hemFoldTooShort,
  requiresConsultation,
];
