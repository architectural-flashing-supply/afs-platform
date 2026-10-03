/**
 * THE RUSH POLICY — WHAT A RUSH JOB COSTS, AND HOW MUCH NOTICE THE SHOP NEEDS.
 *
 * Pure: no database, no network, no clock beyond the date that is handed in. So
 * every boundary below is a unit test rather than something only a live quote
 * could reveal. The one file that reads `rush_policies` out of Postgres is
 * `lib/pricing/db.ts`, which is this directory's existing rule.
 *
 * ================== THE MECHANISM, NOT THE NUMBERS ==================
 *
 * SPEC_RUSH_ORDER.md marks the surcharge percentage (checklist #36) and the
 * rush definition and timing (#32) BLOCKED, and CLAUDE.md's DATA BLOCKERS table
 * still lists both. `rush_policies` therefore ships EMPTY (migration 039), and
 * the only honest answer this module can give for an empty table is "nobody has
 * decided yet" — which is what it returns, in those words, rather than nought.
 *
 * ================== A BLANK IS NEVER A ZERO ==================
 *
 * CLAUDE.md rule #19, applied one table along. There are FOUR distinct states
 * and conflating any two of them is the bug this file exists to prevent:
 *
 *   not rush            -> no surcharge, and nothing to say about it
 *   rush, no policy     -> UNPRICED. Not nought: nobody has decided.
 *   rush, blank value   -> UNPRICED. A policy exists but the figure it needs is
 *                          missing, which is a different thing to fix.
 *   rush, type 'none'   -> APPLIED, nought pounds. An explicit decision that
 *                          rush costs nothing extra.
 *
 * The last two look identical if you only look at the number. `unpriced` says
 * "do not treat this as priced"; `applied` with `0` says "it is priced, and the
 * price is nothing". Only one of them should make an estimator go and fill
 * something in.
 *
 * ================== RUSH IS STILL NEVER INFERRED ==================
 *
 * CLAUDE.md rule #15. NOTHING here decides whether a job is rush. `isRush`
 * arrives as a boolean that `quote_requests.is_rush` already holds, set by the
 * customer's own checkbox or an admin's own toggle and guarded by Postgres. The
 * requested-by date is read ONLY to answer "is that enough notice" — it never
 * feeds back into whether the job is urgent, and it cannot: this module writes
 * nothing.
 *
 * ================== WHY A SURCHARGE IS NOT A LINE ITEM ==================
 *
 * It is deliberately NOT folded into `quoteFromPriceBook`'s lines.
 * `lib/pricing/types.ts`'s `QuoteLine` requires a material, a blank width, a
 * strips-per-sheet and a price-book version id — a rush fee has none of those,
 * and inventing them would put fabricated geometry on a customer's quote and
 * then copy it onto their invoice. The surcharge is a separate figure that
 * lands in `quotes.rush_surcharge` (a column that already exists) and in the
 * total.
 */
import { versionInForce } from './price-book';
import { formatCents } from './quote-math';
import {
  addBusinessDays,
  businessDaysBetween,
  isDateOnly,
  type DateOnly,
} from '@/lib/delivery/business-days';

// ---------------------------------------------------------------------------
// The policy
// ---------------------------------------------------------------------------

/**
 * How a rush surcharge is worked out.
 *
 * `'none'` is a DECISION, not an absence — see the header. There is deliberately
 * no `'inferred'` and no `'auto'`, matching migration 039's CHECK and
 * `quote_requests.rush_source`'s refusal to have a third value.
 */
export type RushSurchargeType = 'percent' | 'flat' | 'per_piece' | 'none';

export const RUSH_SURCHARGE_TYPES: readonly RushSurchargeType[] = [
  'percent',
  'flat',
  'per_piece',
  'none',
] as const;

/** Plain English, used by the admin editor and by every message below. */
export const RUSH_SURCHARGE_TYPE_LABELS: Record<RushSurchargeType, string> = {
  percent: 'A percentage of the job',
  flat: 'One flat fee per job',
  per_piece: 'A fee for every piece',
  none: 'No extra charge for rush',
};

/**
 * 100000 basis points is 1000%. The same bound migration 039's
 * `rush_policies_percent_range` CHECK uses, declared once here so the route and
 * the database cannot drift apart. It is a typo guard, not a business opinion:
 * 2500 entered where 25 was meant still works out as 25%, while a decimal point
 * lost twice is refused.
 */
export const MAX_RUSH_PERCENT_BP = 100_000;

/** Matches `rush_policies_lead_time_range`. A year is the outer sane bound. */
export const MAX_RUSH_LEAD_TIME_DAYS = 365;

/** One basis point is one hundredth of a percent, so a percent is 100 of them. */
const BP_PER_WHOLE = 10_000;

export function isRushSurchargeType(value: unknown): value is RushSurchargeType {
  return typeof value === 'string' && (RUSH_SURCHARGE_TYPES as readonly string[]).includes(value);
}

/** A `rush_policies` row, in this codebase's camelCase. */
export interface RushPolicy {
  id: string;
  name: string;
  surchargeType: RushSurchargeType;
  /** Basis points. 250 = 2.50%. Non-null only for `'percent'`. */
  surchargePercentBp: number | null;
  /** Cents. Non-null only for `'flat'` and `'per_piece'`. */
  surchargeCents: number | null;
  /** BUSINESS days. `null` means not set — never read as 0. */
  minimumLeadTimeDays: number | null;
  /** YYYY-MM-DD. */
  effectiveFrom: string;
  note: string | null;
  createdBy: string | null;
  /** ISO instant. Breaks a same-day tie; see `rushPolicyInForce`. */
  createdAt: string;
}

/**
 * The policy in force on `asOf`, or `null` when none is.
 *
 * DELEGATES to `versionInForce`, which is the one implementation of
 * "effective-dated, latest start wins, same-day correction decided by
 * `createdAt`" in this codebase — CLAUDE.md rule #19 forbids a second copy of
 * the version resolution, and this is what keeps it to one.
 *
 * Unlike `price_book_versions`, `rush_policies` has no UNIQUE on
 * `effective_from`, so the same-day branch really fires here: the table is
 * append-only, so correcting a policy entered with the wrong figure is a second
 * row on the same date and nothing else.
 */
export function rushPolicyInForce(
  policies: readonly RushPolicy[],
  asOf: string
): RushPolicy | null {
  return versionInForce(policies, asOf);
}

// ---------------------------------------------------------------------------
// The surcharge
// ---------------------------------------------------------------------------

/** The facts about a quote that a surcharge could be worked out from. */
export interface RushSurchargeInput {
  /** `quote_requests.is_rush`. Decided elsewhere; never derived here. */
  isRush: boolean;
  /** The quote's line subtotal, in cents, BEFORE any surcharge. */
  subtotalCents: number;
  /** Total pieces across every quoted line. Only `'per_piece'` reads it. */
  pieceCount: number;
}

export type RushSurcharge =
  | {
      kind: 'not-rush';
      surchargeCents: 0;
      policyId: null;
      /** What a customer would read on the quote. `null` when there is none. */
      customerLabel: null;
      /** What an admin reads in the Command Center. `null` when there is none. */
      adminBasis: null;
    }
  | {
      kind: 'unpriced';
      /**
       * `no-policy`    — the table has nothing in force. Nobody has decided.
       * `blank-value`  — a policy is in force but the figure its type needs is
       *                  missing, or the subtotal/piece count handed in is not
       *                  a usable number.
       * Two different things to go and fix, so two different words.
       */
      reason: 'no-policy' | 'blank-value';
      /** Nought is what gets ADDED, which is not the same as a price of nought. */
      surchargeCents: 0;
      policyId: string | null;
      customerLabel: null;
      adminBasis: null;
      /** One sentence, for an admin. Never shown to a customer. */
      message: string;
    }
  | {
      kind: 'applied';
      /** May legitimately be 0, for an explicit `'none'` policy. */
      surchargeCents: number;
      policyId: string;
      customerLabel: string;
      adminBasis: string;
    };

/**
 * WHAT A CUSTOMER READS, and it is SPEC_RUSH_ORDER.md §4's own wording.
 *
 * Deliberately carries no rate and no basis: the customer is shown the amount
 * AFS decided, on the formal quote, not the formula that produced it. Exposing
 * "2.5% of your subtotal" invites arithmetic on a document whose only authority
 * is the number AFS put on it.
 */
export const RUSH_SURCHARGE_CUSTOMER_LABEL = 'Rush fabrication — priority scheduling';

/**
 * Works out the rush surcharge for one quote.
 *
 * ROUNDED ONCE, AT THE END, ON THE WHOLE SUBTOTAL — never per line. Rounding a
 * percentage line by line and adding the results drifts away from the
 * percentage of the total, which is the figure the policy actually names. Same
 * principle as `quote-math.ts` rounding once per line rather than once per
 * piece, applied one level up.
 *
 * `Math.round` is half-up, so a surcharge of exactly half a cent goes to the
 * cent. That is asserted rather than left to the reader.
 */
export function evaluateRushSurcharge(
  input: RushSurchargeInput,
  policy: RushPolicy | null
): RushSurcharge {
  if (!input.isRush) {
    return { kind: 'not-rush', surchargeCents: 0, policyId: null, customerLabel: null, adminBasis: null };
  }

  if (policy === null) {
    return {
      kind: 'unpriced',
      reason: 'no-policy',
      surchargeCents: 0,
      policyId: null,
      customerLabel: null,
      adminBasis: null,
      message:
        'This is a rush job, and no rush policy has been set, so no surcharge was added. ' +
        'Set one under Settings → Rush policy, or price the rush by hand.',
    };
  }

  const blank = (what: string): RushSurcharge => ({
    kind: 'unpriced',
    reason: 'blank-value',
    surchargeCents: 0,
    policyId: policy.id,
    customerLabel: null,
    adminBasis: null,
    message:
      `The rush policy "${policy.name}" ${what}, so no surcharge was added. ` +
      'A blank is never treated as zero — fill it in under Settings → Rush policy.',
  });

  // The subtotal and the piece count come from the priced quote, so a bad value
  // here means something upstream is wrong. Refusing is right either way: a
  // surcharge computed from NaN would render as "$NaN" on a customer's quote.
  if (!Number.isFinite(input.subtotalCents) || input.subtotalCents < 0) {
    return blank('was given a subtotal that is not a usable amount');
  }
  if (!Number.isFinite(input.pieceCount) || input.pieceCount < 0) {
    return blank('was given a piece count that is not a usable number');
  }

  switch (policy.surchargeType) {
    case 'none':
      // A DECISION, not a blank. `applied` with nought, so nothing asks anybody
      // to go and fill it in.
      return {
        kind: 'applied',
        surchargeCents: 0,
        policyId: policy.id,
        customerLabel: RUSH_SURCHARGE_CUSTOMER_LABEL,
        adminBasis: `${policy.name} — no extra charge for rush`,
      };

    case 'percent': {
      // DEFENCE IN DEPTH. Migration 039's `rush_policies_value_matches_type`
      // CHECK already refuses a 'percent' row with a NULL percentage, and the
      // API route refuses it before that. This third refusal is here anyway,
      // because (a) the migration is not applied yet so the CHECK is not
      // protecting anything, and (b) `?? 0` is the exact mistake rule #19
      // exists to prevent, and the way to not make it is to not have a path
      // that could.
      if (policy.surchargePercentBp === null || !Number.isFinite(policy.surchargePercentBp)) {
        return blank('is set to a percentage but has no percentage filled in');
      }
      if (policy.surchargePercentBp < 0) {
        return blank('has a negative percentage, which would be a discount');
      }
      const cents = Math.round((input.subtotalCents * policy.surchargePercentBp) / BP_PER_WHOLE);
      return {
        kind: 'applied',
        surchargeCents: cents,
        policyId: policy.id,
        customerLabel: RUSH_SURCHARGE_CUSTOMER_LABEL,
        adminBasis: `${formatPercentBp(policy.surchargePercentBp)} of ${formatCents(input.subtotalCents)}`,
      };
    }

    case 'flat': {
      if (policy.surchargeCents === null || !Number.isFinite(policy.surchargeCents)) {
        return blank('is set to a flat fee but has no amount filled in');
      }
      if (policy.surchargeCents < 0) {
        return blank('has a negative fee, which would be a discount');
      }
      return {
        kind: 'applied',
        surchargeCents: Math.round(policy.surchargeCents),
        policyId: policy.id,
        customerLabel: RUSH_SURCHARGE_CUSTOMER_LABEL,
        adminBasis: `${formatCents(policy.surchargeCents)} flat`,
      };
    }

    case 'per_piece': {
      if (policy.surchargeCents === null || !Number.isFinite(policy.surchargeCents)) {
        return blank('is set to a fee per piece but has no amount filled in');
      }
      if (policy.surchargeCents < 0) {
        return blank('has a negative fee, which would be a discount');
      }
      const pieces = Math.round(input.pieceCount);
      return {
        kind: 'applied',
        surchargeCents: Math.round(policy.surchargeCents) * pieces,
        policyId: policy.id,
        customerLabel: RUSH_SURCHARGE_CUSTOMER_LABEL,
        adminBasis: `${formatCents(policy.surchargeCents)} × ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`,
      };
    }
  }
}

/** "2.5%" from 250. Trailing zeros trimmed, so 1000 reads "10%" and not "10.00%". */
export function formatPercentBp(bp: number): string {
  const percent = bp / 100;
  return `${Number.isInteger(percent) ? percent.toString() : percent.toFixed(2).replace(/0$/, '')}%`;
}

// ---------------------------------------------------------------------------
// The lead time
// ---------------------------------------------------------------------------

/** What a quote needs to know to check the notice it was given. */
export interface RushLeadTimeInput {
  isRush: boolean;
  /** `quote_requests.requested_delivery`. `null` when the customer gave none. */
  requestedDelivery: string | null;
  /** Today, IN THE SHOP'S OWN TIME ZONE. `YYYY-MM-DD`. */
  today: DateOnly;
}

export type RushLeadTime =
  | { status: 'not-rush' }
  | { status: 'no-policy' }
  /** A policy is in force but nobody has said how much notice a rush needs. */
  | { status: 'not-set'; policyId: string }
  /** The customer did not give a date, so there is nothing to check against. */
  | { status: 'no-date'; policyId: string; minimumDays: number }
  | {
      status: 'meets' | 'too-soon';
      policyId: string;
      minimumDays: number;
      /** Working days of notice the customer actually gave. May be negative. */
      businessDays: number;
      requestedDate: DateOnly;
      /** The first date that WOULD meet the minimum, from today. */
      earliest: DateOnly;
      /** One sentence, for an admin. */
      message: string;
    };

/**
 * Does the requested-by date give the shop the notice the rush policy asks for?
 *
 * WARNS, NEVER REFUSES. AFS decides what work it will take on, and the moment
 * to decide is when an estimator is looking at the job — so `too-soon` is a
 * sentence on the Job screen and not a blocked quote. Recorded as an open
 * question for Reid in the EES; if he wants it to refuse, the refusal belongs
 * in the route that issues the quote, not in here.
 *
 * A MALFORMED DATE IS `no-date`, NOT AN ERROR. `requested_delivery` is a
 * `date` column so a stored value is well-formed, but this function is also
 * handed values straight off a request body. A throw here would take out the
 * whole Job screen over a typo, and the honest reading of an unusable date is
 * that there is no usable one.
 */
export function evaluateRushLeadTime(
  input: RushLeadTimeInput,
  policy: RushPolicy | null
): RushLeadTime {
  if (!input.isRush) return { status: 'not-rush' };
  if (policy === null) return { status: 'no-policy' };
  if (policy.minimumLeadTimeDays === null || !Number.isFinite(policy.minimumLeadTimeDays)) {
    return { status: 'not-set', policyId: policy.id };
  }

  const minimumDays = Math.max(0, Math.round(policy.minimumLeadTimeDays));
  const requested = (input.requestedDelivery ?? '').slice(0, 10);
  if (!isDateOnly(requested) || !isDateOnly(input.today)) {
    return { status: 'no-date', policyId: policy.id, minimumDays };
  }

  const businessDays = businessDaysBetween(input.today, requested);
  const earliest = addBusinessDays(input.today, minimumDays);
  const meets = businessDays >= minimumDays;

  return {
    status: meets ? 'meets' : 'too-soon',
    policyId: policy.id,
    minimumDays,
    businessDays,
    requestedDate: requested,
    earliest,
    message: meets
      ? `They asked for ${formatShortDate(requested)}, which is ${describeDays(businessDays)}. ` +
        `A rush job needs ${describeDays(minimumDays)}, so that works.`
      : `They asked for ${formatShortDate(requested)}, which is only ${describeDays(businessDays)}. ` +
        `A rush job needs ${describeDays(minimumDays)}, so the earliest is ${formatShortDate(earliest)}.`,
  };
}

/** "5 working days", "1 working day", "0 working days". Never "-1 working days". */
function describeDays(days: number): string {
  if (days < 0) return `${Math.abs(days)} working ${Math.abs(days) === 1 ? 'day' : 'days'} in the past`;
  return `${days} working ${days === 1 ? 'day' : 'days'}`;
}

/**
 * "Oct 12" from "2026-10-12".
 *
 * Rendered in UTC from a date-only string on purpose, exactly as
 * `formatDayHeading` is: the string carries no time, so asking any other zone
 * to render it is how "Oct 12" becomes "Oct 11".
 */
export function formatShortDate(date: DateOnly): string {
  if (!isDateOnly(date)) return date;
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Validating what an admin typed
// ---------------------------------------------------------------------------

/** A policy ready to be INSERTED. Exactly the columns migration 039 declares. */
export interface RushPolicyDraft {
  name: string;
  surchargeType: RushSurchargeType;
  surchargePercentBp: number | null;
  surchargeCents: number | null;
  minimumLeadTimeDays: number | null;
  effectiveFrom: string;
  note: string | null;
}

export type RushPolicyParse =
  | { ok: true; draft: RushPolicyDraft }
  /** One sentence naming the field to go and fix. Never an error code. */
  | { ok: false; error: string };

/** Longer than this is a paste, not a name, and it would wreck every list. */
export const MAX_RUSH_POLICY_NAME_LENGTH = 120;

/**
 * "2.5" as typed in a box -> 250 basis points. `null` for an empty box;
 * `'invalid'` for anything that is not a rate.
 *
 * It lives here rather than in the editor component for one reason: the editor
 * is a `.tsx` client component and the unit-test harness only collects
 * `lib/**\/*.test.ts`, so a parser left in there could not be tested. The same
 * reasoning put `parseDollarsToCents` in `quote-math.ts`, and this is its
 * sibling — a percentage typed by a person, turned into the integer the
 * database holds.
 *
 * TWO DECIMAL PLACES AND NO MORE, because two decimal places of a percent IS
 * one basis point. The regex restricts the input to that precision, so the
 * `Math.round` can only ever be removing float representation error, never
 * silently discarding a figure Steve meant.
 */
export function parsePercentToBasisPoints(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim().replace(/%$/, '').trim();
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid';
  const bp = Math.round(Number(trimmed) * 100);
  return bp > MAX_RUSH_PERCENT_BP ? 'invalid' : bp;
}

/**
 * "5" as typed in a box -> 5 business days. `null` for an empty box, which
 * means "no minimum set" and NEVER nought days of notice; `'invalid'` for
 * anything that is not a whole number of days within the database's bound.
 */
export function parseLeadDays(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d+$/.test(trimmed)) return 'invalid';
  const days = Number(trimmed);
  return days > MAX_RUSH_LEAD_TIME_DAYS ? 'invalid' : days;
}

/**
 * Turns a request body into a policy, or into the one sentence that says why it
 * is not one.
 *
 * PURE, AND THAT IS THE POINT: every refusal below is a unit test rather than a
 * live HTTP call against a table that does not exist yet. The rules here mirror
 * migration 039's CHECK constraints exactly, and both sides read their bounds
 * from `MAX_RUSH_PERCENT_BP` / `MAX_RUSH_LEAD_TIME_DAYS` so they cannot drift.
 *
 * A BLANK WHERE A VALUE IS REQUIRED IS A REFUSAL, NOT A STORED NULL. The admin
 * screen must not be able to create an unpriced policy — "I have chosen a
 * percentage" and "I have not said what it is" is a half-made decision, and
 * `evaluateRushSurcharge` would then have to report it as unpriced forever
 * while looking, on the Settings screen, as though a policy existed.
 */
export function parseRushPolicyInput(
  body: Record<string, unknown>,
  today: string
): RushPolicyParse {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name === '') {
    return { ok: false, error: 'Give the policy a name, so you can tell it apart from the next one.' };
  }
  if (name.length > MAX_RUSH_POLICY_NAME_LENGTH) {
    return {
      ok: false,
      error: `That name is ${name.length} characters. Keep it under ${MAX_RUSH_POLICY_NAME_LENGTH}.`,
    };
  }

  if (!isRushSurchargeType(body.surchargeType)) {
    return {
      ok: false,
      error:
        'Choose how the rush charge works: a percentage of the job, one flat fee, a fee for every ' +
        'piece, or no extra charge.',
    };
  }
  const surchargeType: RushSurchargeType = body.surchargeType;

  /** A whole number, or a named refusal. `undefined`/null/'' count as absent. */
  function wholeNumber(
    value: unknown,
    label: string,
    max: number
  ): number | null | { error: string } {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { error: `${label} must be a number.` };
    }
    if (!Number.isInteger(value)) {
      return { error: `${label} must be a whole number — ${value} is not.` };
    }
    if (value < 0) return { error: `${label} cannot be negative. A negative charge is a discount.` };
    if (value > max) return { error: `${label} cannot be more than ${max}.` };
    return value;
  }

  const percentParsed = wholeNumber(body.surchargePercentBp, 'The percentage', MAX_RUSH_PERCENT_BP);
  if (percentParsed !== null && typeof percentParsed === 'object') return { ok: false, error: percentParsed.error };
  const centsParsed = wholeNumber(body.surchargeCents, 'The amount', Number.MAX_SAFE_INTEGER);
  if (centsParsed !== null && typeof centsParsed === 'object') return { ok: false, error: centsParsed.error };
  const leadParsed = wholeNumber(body.minimumLeadTimeDays, 'The minimum notice', MAX_RUSH_LEAD_TIME_DAYS);
  if (leadParsed !== null && typeof leadParsed === 'object') return { ok: false, error: leadParsed.error };

  let surchargePercentBp: number | null = percentParsed;
  let surchargeCents: number | null = centsParsed;

  // The value the type needs must be there, and the one it does not need is
  // DROPPED rather than refused — switching the dropdown from percent to flat
  // and saving should not fail because the percent box still had a number in
  // it. A stored row carrying both would be a row with two answers.
  if (surchargeType === 'percent') {
    if (surchargePercentBp === null) {
      return { ok: false, error: 'Fill in the percentage. A blank is never treated as zero.' };
    }
    surchargeCents = null;
  } else if (surchargeType === 'flat' || surchargeType === 'per_piece') {
    if (surchargeCents === null) {
      return { ok: false, error: 'Fill in the amount. A blank is never treated as zero.' };
    }
    surchargePercentBp = null;
  } else {
    // 'none' — an explicit decision that rush costs nothing extra, so neither
    // value belongs on the row.
    surchargePercentBp = null;
    surchargeCents = null;
  }

  const rawDate = typeof body.effectiveFrom === 'string' ? body.effectiveFrom.trim() : '';
  const effectiveFrom = rawDate === '' ? today : rawDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return { ok: false, error: 'The start date needs to be a real date.' };
  }

  return {
    ok: true,
    draft: {
      name,
      surchargeType,
      surchargePercentBp,
      surchargeCents,
      minimumLeadTimeDays: leadParsed,
      effectiveFrom,
      note: typeof body.note === 'string' && body.note.trim() !== '' ? body.note.trim() : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Saying it in words
// ---------------------------------------------------------------------------

/**
 * THE ONE PLACE A RUSH POLICY IS DESCRIBED TO AN ADMIN.
 *
 * Three sentences for three different facts, which the admin screen and the Job
 * screen both need and must not word differently:
 *   the table is not there yet  -> name the migration
 *   the table is there, empty   -> nobody has decided; nothing is being added
 *   a policy is in force        -> what it is, and how much notice it needs
 */
export function formatRushPolicySentence(
  policy: RushPolicy | null,
  unavailable: string | null
): string {
  if (unavailable !== null) return unavailable;
  if (policy === null) {
    return 'No rush policy has been set, so no rush surcharge is added to any quote.';
  }

  const charge =
    policy.surchargeType === 'none'
      ? 'no extra charge'
      : policy.surchargeType === 'percent' && policy.surchargePercentBp !== null
        ? `${formatPercentBp(policy.surchargePercentBp)} of the job`
        : policy.surchargeType === 'flat' && policy.surchargeCents !== null
          ? `${formatCents(policy.surchargeCents)} per job`
          : policy.surchargeType === 'per_piece' && policy.surchargeCents !== null
            ? `${formatCents(policy.surchargeCents)} per piece`
            : 'an amount that has not been filled in yet';

  const lead =
    policy.minimumLeadTimeDays === null
      ? 'No minimum notice has been set.'
      : `A rush job needs ${describeDays(policy.minimumLeadTimeDays)} of notice.`;

  return `${policy.name}: ${charge}. ${lead}`;
}
