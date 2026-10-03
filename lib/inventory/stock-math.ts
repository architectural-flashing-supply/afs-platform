/**
 * THE ONE PLACE THAT DECIDES WHAT AN INVENTORY QUANTITY MEANS.
 *
 * What is available, what counts as low, and which adjustments are legal — all
 * three live here and nowhere else. The API routes call it, the admin UI calls
 * it, and `inventory_apply_adjustment()` (migration 039) deliberately does NOT
 * reimplement it in PL/pgSQL: that function is handed the already-computed
 * result and enforces only atomicity, the row lock and the caller's
 * expectation. A second copy of this math in SQL would be a competing source of
 * truth, and the two would drift. The table's CHECK constraints remain the
 * independent backstop — if anything here ever computed a negative quantity,
 * the database refuses to store it.
 *
 * Pure. No I/O, no Supabase, no Date, no randomness, so every rule below is a
 * unit test rather than something only a running database can tell you. See
 * lib/inventory/stock-math.test.ts.
 *
 * ===================== A BLANK IS NEVER A ZERO =====================
 *
 * This is CLAUDE.md rule #19 applied to quantities instead of prices, and it is
 * the reason the feature can ship with an empty table without lying:
 *
 *   onHand       null = NOBODY HAS COUNTED THIS YET. Not zero. Zero is a
 *                measurement, and a made-up one.
 *   reorderPoint null = nobody has said what "low" means for this item, so no
 *                low-stock judgement is made and none is shown. ZERO IS A REAL
 *                THRESHOLD ("tell me when it is out") and is not the same
 *                thing — conflating them is the classic falsy bug, and
 *                `stockLevel` is written to keep them apart.
 *   reserved     always a number. Nothing reserved is a fact, unlike no metal.
 */

/**
 * The unit all three quantities on one item are counted in. Four, and no fifth
 * is guessed: the price book is built on a 10 ft x 4 ft SHEET (CLAUDE.md rule
 * #19), coil is the thing with a width, and coil is bought by the linear foot
 * or by the pound. Mirrors `inventory_items_stock_unit_check` in migration 039.
 */
export type StockUnit = 'sheet' | 'coil' | 'linear_foot' | 'pound';

export const STOCK_UNITS: readonly StockUnit[] = ['sheet', 'coil', 'linear_foot', 'pound'];

/** How a unit is written in the UI, singular and plural. */
export const STOCK_UNIT_LABEL: Record<StockUnit, { one: string; many: string }> = {
  sheet: { one: 'sheet', many: 'sheets' },
  coil: { one: 'coil', many: 'coils' },
  linear_foot: { one: 'linear foot', many: 'linear feet' },
  pound: { one: 'lb', many: 'lbs' },
};

/**
 * The five ways a quantity can change. Mirrors
 * `inventory_adjustments_kind_check` in migration 039.
 *
 *   count       a physical count. Sets on hand ABSOLUTELY.
 *   receipt     material arrived. Adds to on hand.
 *   consumption material used or scrapped. Subtracts from on hand.
 *   reserve     metal promised to a job. Adds to reserved.
 *   release     a promise let go. Subtracts from reserved.
 */
export type AdjustmentKind = 'count' | 'receipt' | 'consumption' | 'reserve' | 'release';

export const ADJUSTMENT_KINDS: readonly AdjustmentKind[] = [
  'count',
  'receipt',
  'consumption',
  'reserve',
  'release',
];

export const ADJUSTMENT_KIND_LABEL: Record<AdjustmentKind, string> = {
  count: 'Physical count',
  receipt: 'Material received',
  consumption: 'Material used',
  reserve: 'Reserve for a job',
  release: 'Release a reservation',
};

/**
 * `uncounted`    there is no number, so nothing downstream can be judged.
 * `out`          available is zero or less. True without needing a threshold.
 * `no_threshold` the quantity is known; what counts as low is not.
 * `low`          at or below the reorder point.
 * `ok`           above it.
 */
export type StockLevel = 'uncounted' | 'out' | 'no_threshold' | 'low' | 'ok';

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  uncounted: 'Not counted',
  out: 'Out of stock',
  no_threshold: 'No reorder point set',
  low: 'Low — reorder',
  ok: 'In stock',
};

export interface StockQuantities {
  /** null means never counted. Never defaulted to 0. */
  onHand: number | null;
  reserved: number;
  /** null means no threshold has been set. 0 is a real threshold. */
  reorderPoint: number | null;
}

export interface AdjustmentRequest {
  kind: AdjustmentKind;
  /**
   * Always a POSITIVE magnitude, whatever the kind. The sign belongs to the
   * kind, not to the number the user typed: "consumption of -5" is a mis-keyed
   * receipt, and asking a person to type a minus sign to use metal is how that
   * mistake gets made. `applyAdjustment` derives the stored sign, and migration
   * 039's `inventory_adjustments_sign` CHECK refuses a row whose sign and kind
   * disagree.
   *
   * For `count` this is the counted amount, which may legitimately be 0 — see
   * `isZeroAllowed`.
   */
  amount: number;
  unit: StockUnit;
}

export type AdjustmentOutcome =
  | {
      ok: true;
      onHandAfter: number;
      reservedAfter: number;
      /** What the ledger row stores, already signed. Exactly one is non-null. */
      deltaOnHand: number | null;
      countedOnHand: number | null;
      deltaReserved: number | null;
    }
  | { ok: false; reason: string };

/**
 * The largest value `numeric(12,2)` can hold. Caught here so an overflow is a
 * sentence the user can read rather than PostgreSQL's `22003`.
 */
export const MAX_QTY = 9_999_999_999.99;

/**
 * Every quantity is `numeric(12,2)` in the database, so every number this
 * module returns is rounded to two decimal places.
 *
 * Without this, `0.1 + 0.2` reaches PostgREST as `0.30000000000000004` and is
 * truncated server-side — so the number the UI showed and the number stored
 * would differ, in a feature whose entire job is being the record of what is
 * really there.
 *
 * WHY NOT `Math.round(value * 100) / 100`. That is the obvious version and it
 * is wrong: `1.005` is really `1.00499999999999989…` as a double, so
 * `1.005 * 100` is `100.49999999999999` and rounds DOWN to `1.00`. A pound of
 * coil quietly disappears. Found by the unit test, not by reading.
 *
 * Re-parsing through the decimal STRING fixes it: `Number('1.005e2')` parses
 * the literal `100.5`, which is exactly representable, so it rounds to `101`
 * and back to `1.01`.
 *
 * Two edge cases the string trick needs help with, both guarded below:
 * exponential notation (`${1e21}` is `"1e+21"`, and `"1e+21e2"` is NaN — a NaN
 * escaping here would sail past the MAX_QTY check, which is a `>` comparison),
 * and negative zero (`Object.is(-0, 0)` is false, so a `-0` leaking out of
 * here would fail an equality assertion somewhere far away for no visible
 * reason).
 */
export function roundQty(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;

  const text = `${value}`;
  if (text.includes('e') || text.includes('E')) {
    // Far outside any legitimate inventory quantity. The plain multiply is
    // exact enough at this magnitude, and the MAX_QTY check refuses it a
    // moment later — what matters is that a finite number stays finite.
    return Math.round(value * 100) / 100;
  }

  const rounded = Number(`${Math.round(Number(`${text}e2`))}e-2`);
  return rounded === 0 ? 0 : rounded;
}

/** Numbers that are safe to do arithmetic on. NaN and Infinity are not. */
function isRealNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * How much is actually free to promise: on hand minus what is already promised.
 *
 * Returns null for a never-counted item — there is no number, and returning 0
 * would be inventing one.
 *
 * MAY BE NEGATIVE, on purpose. A physical count that comes in below what is
 * reserved is a real event (shrinkage, a mis-count, metal that walked), and
 * migration 039 deliberately does not constrain `qty_on_hand >= qty_reserved`
 * because the count is the truth and refusing it would force somebody to record
 * a number they did not measure. The shortfall shows up here, and the UI names
 * it in words.
 */
export function availableQty(q: StockQuantities): number | null {
  if (q.onHand === null) return null;
  return roundQty(q.onHand - q.reserved);
}

/**
 * The low-stock signal. The ONLY place a threshold is compared — no component
 * contains its own `<=`.
 *
 * The precedence below is part of the contract, and each step is there for a
 * reason:
 *
 *   1. uncounted beats everything. With no number, every judgement after this
 *      would be about a quantity nobody has measured.
 *   2. out comes BEFORE no_threshold. "There is none" is a fact that does not
 *      need somebody to have set a threshold first.
 *   3. no_threshold, because the quantity is known and what counts as low is
 *      not. Saying "in stock" here would be a judgement nobody authorised.
 *   4. low uses `<=`, not `<`: AT the reorder point is when you reorder.
 *
 * The comparison is against AVAILABLE, not against on hand. Reserved metal is
 * spoken for, and reporting "in stock" about metal already promised to a job is
 * the more dangerous of the two errors.
 */
export function stockLevel(q: StockQuantities): StockLevel {
  const available = availableQty(q);
  if (available === null) return 'uncounted';
  if (available <= 0) return 'out';
  if (q.reorderPoint === null) return 'no_threshold';
  if (available <= q.reorderPoint) return 'low';
  return 'ok';
}

/** True when the level means somebody needs to do something about it. */
export function needsAttention(level: StockLevel): boolean {
  return level === 'out' || level === 'low';
}

/** "3 sheets", "1 linear foot" — so a refusal can name the real amount. */
export function formatQty(value: number, unit: StockUnit): string {
  const rounded = roundQty(value);
  const label = STOCK_UNIT_LABEL[unit];
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} ${rounded === 1 ? label.one : label.many}`;
}

/** A count of zero is a real measurement; every other kind needs an amount. */
function isZeroAllowed(kind: AdjustmentKind): boolean {
  return kind === 'count';
}

const NEVER_COUNTED_REFUSAL = 'Record a count first — this item has never been counted.';

/**
 * Decide whether one adjustment is legal, and what the item's quantities become
 * if it is.
 *
 * Returns the refusal SENTENCE as well as the verdict, so the message the user
 * reads is written by the module that owns the rule — the API route answers 422
 * carrying this exact string, and the UI prints it. There is no second wording
 * of any of these rules anywhere.
 */
export function applyAdjustment(current: StockQuantities, request: AdjustmentRequest): AdjustmentOutcome {
  const { kind, amount, unit } = request;

  if (!isRealNumber(amount)) {
    return { ok: false, reason: 'Enter an amount as a number.' };
  }
  if (amount < 0) {
    return {
      ok: false,
      reason: 'Enter the amount as a positive number — the kind of adjustment decides which way it goes.',
    };
  }
  if (amount === 0 && !isZeroAllowed(kind)) {
    return { ok: false, reason: 'Enter an amount other than zero.' };
  }

  const magnitude = roundQty(amount);
  const reserved = roundQty(current.reserved);

  if (kind === 'count') {
    if (magnitude > MAX_QTY) return { ok: false, reason: tooLarge() };
    // DELIBERATELY NOT REFUSED when the count comes in below what is reserved.
    // A measurement is a measurement; the shortfall surfaces as a negative
    // available quantity (see availableQty) rather than as a refusal that would
    // force somebody to record a number they did not measure.
    return {
      ok: true,
      onHandAfter: magnitude,
      reservedAfter: reserved,
      deltaOnHand: null,
      countedOnHand: magnitude,
      deltaReserved: null,
    };
  }

  if (kind === 'receipt' || kind === 'consumption') {
    if (current.onHand === null) {
      return { ok: false, reason: NEVER_COUNTED_REFUSAL };
    }
    const onHand = roundQty(current.onHand);
    const signed = kind === 'receipt' ? magnitude : -magnitude;
    const onHandAfter = roundQty(onHand + signed);

    if (onHandAfter > MAX_QTY) return { ok: false, reason: tooLarge() };
    if (onHandAfter < 0) {
      return {
        ok: false,
        reason: `You cannot use more than is on hand — there ${onHand === 1 ? 'is' : 'are'} ${formatQty(onHand, unit)}.`,
      };
    }
    if (kind === 'consumption' && onHandAfter < reserved) {
      return {
        ok: false,
        reason: `That metal is reserved — ${formatQty(reserved, unit)} ${reserved === 1 ? 'is' : 'are'} promised to a job. Release the reservation first.`,
      };
    }

    return {
      ok: true,
      onHandAfter,
      reservedAfter: reserved,
      deltaOnHand: signed,
      countedOnHand: null,
      deltaReserved: null,
    };
  }

  // reserve | release — the reservation math.
  if (current.onHand === null) {
    return { ok: false, reason: NEVER_COUNTED_REFUSAL };
  }
  const onHand = roundQty(current.onHand);
  const available = roundQty(onHand - reserved);

  if (kind === 'reserve') {
    if (available <= 0) {
      return {
        ok: false,
        reason:
          available === 0
            ? 'There is nothing available to reserve — all of it is already reserved.'
            : `There is nothing available to reserve: the count is ${formatQty(onHand, unit)} and ${formatQty(reserved, unit)} are already reserved.`,
      };
    }
    if (magnitude > available) {
      return { ok: false, reason: `Only ${formatQty(available, unit)} ${available === 1 ? 'is' : 'are'} available to reserve.` };
    }
    const reservedAfter = roundQty(reserved + magnitude);
    if (reservedAfter > MAX_QTY) return { ok: false, reason: tooLarge() };
    return {
      ok: true,
      onHandAfter: onHand,
      reservedAfter,
      deltaOnHand: null,
      countedOnHand: null,
      deltaReserved: magnitude,
    };
  }

  // release
  if (reserved === 0) {
    return { ok: false, reason: 'Nothing is reserved on this item.' };
  }
  if (magnitude > reserved) {
    return { ok: false, reason: `Only ${formatQty(reserved, unit)} ${reserved === 1 ? 'is' : 'are'} reserved.` };
  }
  return {
    ok: true,
    onHandAfter: onHand,
    reservedAfter: roundQty(reserved - magnitude),
    deltaOnHand: null,
    countedOnHand: null,
    deltaReserved: -magnitude,
  };
}

function tooLarge(): string {
  return `That is larger than this field can store (the limit is ${MAX_QTY.toLocaleString('en-US')}).`;
}

/** Narrowing guards, used by the API routes to validate a request body. */
export function isStockUnit(value: unknown): value is StockUnit {
  return typeof value === 'string' && (STOCK_UNITS as readonly string[]).includes(value);
}

export function isAdjustmentKind(value: unknown): value is AdjustmentKind {
  return typeof value === 'string' && (ADJUSTMENT_KINDS as readonly string[]).includes(value);
}
