/**
 * THE VENDOR'S RESPONSE IS VALIDATED, NOT CAST.
 *
 * Deliberately the same shape of module as lib/integrations/pathfinder-response.ts,
 * for the same reason stated at length there: a cast is erased at runtime and
 * asserts nothing. If TaxJar renames a field, wraps the body in an envelope, or
 * returns an error object with a 200, then
 *
 *     const data = (await res.json()) as { tax: { amount_to_collect: number } };
 *
 * succeeds, and the wrongness surfaces later as `undefined` arithmetic — which
 * for this subsystem means `NaN` cents, or worse a plausible-looking number, on
 * a document AFS has to stand behind.
 *
 * THAT RISK IS HIGHER HERE THAN IT WAS FOR PATHFINDEREDGE. This codebase has
 * never made a live TaxJar call: there is no API key, and the response shape
 * below is taken from specs/SPEC_TAXJAR_INTEGRATION.md §3's own field names
 * (`response.tax.amount_to_collect`, `response.tax.rate`), which were written
 * against the real SDK. That is corroboration, not verification — EES-OVN.08
 * records it as assumption A-1 and UNRESOLVED-01. A validating parser is
 * precisely what makes an unverified contract safe to ship: if the shape is
 * different, the caller gets a reported problem and a logged payload, which is a
 * `failed` outcome flagged for a human — never a wrong figure.
 *
 * A PARSER DOES THREE THINGS AND NOTHING ELSE: it checks the shape it was
 * promised, it returns a typed value or a list of plain-English problems, and it
 * NEVER THROWS. A bad shape is a degraded read, not a 500.
 */

import type { ProviderTaxFigures, TaxJurisdictions } from './types';

export interface ShapeOk<T> {
  ok: true;
  value: T;
}

export interface ShapeBad {
  ok: false;
  /** Plain English, one per thing that is wrong. Capped — see MAX_PROBLEMS. */
  problems: string[];
}

export type ShapeResult<T> = ShapeOk<T> | ShapeBad;

/** A body can be wrong in many ways at once; the first few are the diagnosis. */
const MAX_PROBLEMS = 5;

/** How much of a bad payload gets logged. Enough to recognise, not enough to flood. */
const MAX_LOGGED_PAYLOAD_CHARS = 600;

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function collect(problems: string[], message: string): void {
  if (problems.length < MAX_PROBLEMS) problems.push(message);
}

/**
 * DOLLARS TO CENTS, IN EXACTLY ONE PLACE.
 *
 * TaxJar reports decimal dollars (`amount_to_collect: 82.5`); this codebase is
 * integer cents everywhere (migration 035's money columns, lib/pricing/*). The
 * conversion is a 100x error waiting to happen, so it lives in one function that
 * one test pins — EES-OVN.08 assumption A-2.
 *
 * `Math.round` is half-up on positives, which is the convention the rest of this
 * codebase already uses for money (`lib/pricing/quote-math.ts`'s `cents`,
 * `parseDollarsToCents`). A negative amount never reaches here: the caller
 * rejects it as a shape problem first, because a negative sales tax is not a
 * thing and `Math.round(-0.5)` rounding toward zero would quietly mask it.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

function readJurisdictions(raw: unknown): TaxJurisdictions | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return {
    country: str(r.country),
    state: str(r.state),
    county: str(r.county),
    city: str(r.city),
  };
}

/**
 * `POST /v2/taxes` → `{ tax: { amount_to_collect, rate, … } }`.
 *
 * WHAT IS FATAL: a non-object body; no `tax` object; an `amount_to_collect` that
 * is absent, non-numeric, non-finite or negative; a `rate` that is present but
 * non-numeric, non-finite or negative.
 *
 * WHAT IS NOT FATAL, AND WHY EACH ONE IS TOLERATED:
 *   - `rate` ABSENT → 0. The amount is what gets collected; the rate is reported
 *     for an admin's benefit, and refusing a usable amount because its rate was
 *     missing would discard a good answer.
 *   - `has_nexus` ABSENT → `null`, NOT `false`. This is the important one.
 *     Defaulting it to `false` would make every response without the field look
 *     like the vendor denying nexus, which calculate.ts escalates as a conflict —
 *     turning a silent field rename into a stream of false alarms. `null` means
 *     "the vendor did not say", and only an EXPLICIT `false` is a conflict.
 *   - `taxable_amount` / `freight_taxable` / `jurisdictions` absent → null. All
 *     three are reporting detail.
 */
export function parseTaxForOrderResponse(raw: unknown): ShapeResult<ProviderTaxFigures> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      problems: [
        `TaxJar returned ${describe(raw)} where the tax response should be an object.`,
      ],
    };
  }

  const body = raw as Record<string, unknown>;
  const taxRaw = body.tax;

  if (!taxRaw || typeof taxRaw !== 'object' || Array.isArray(taxRaw)) {
    // An error object returned with a 200 lands here, so say so: it is by far
    // the most likely cause and naming it saves the reader a round trip.
    const hint =
      typeof body.error === 'string'
        ? ` The body carries an error instead: "${body.error}"${typeof body.detail === 'string' ? ` — ${body.detail}` : ''}.`
        : '';
    return {
      ok: false,
      problems: [
        `TaxJar's response has no "tax" object (got ${describe(taxRaw)}).${hint}`,
      ],
    };
  }

  const tax = taxRaw as Record<string, unknown>;
  const problems: string[] = [];

  // ---- amount_to_collect: the one field nothing can proceed without ---------
  const amountRaw = tax.amount_to_collect;
  let amountCents: number | null = null;
  if (typeof amountRaw !== 'number') {
    collect(
      problems,
      `TaxJar's tax.amount_to_collect is ${describe(amountRaw)} (${JSON.stringify(amountRaw)}), not a number. ` +
        'Nothing can be collected from a value that is not a number.'
    );
  } else if (!Number.isFinite(amountRaw)) {
    collect(problems, `TaxJar's tax.amount_to_collect is not finite (got ${String(amountRaw)}).`);
  } else if (amountRaw < 0) {
    collect(
      problems,
      `TaxJar's tax.amount_to_collect is negative (${amountRaw}). A negative sales tax is not a thing, ` +
        'so this response is not trusted.'
    );
  } else {
    amountCents = dollarsToCents(amountRaw);
  }

  // ---- rate: tolerated when absent, validated when present -----------------
  const rateRaw = tax.rate;
  let rate = 0;
  if (rateRaw !== undefined && rateRaw !== null) {
    if (typeof rateRaw !== 'number' || !Number.isFinite(rateRaw)) {
      collect(
        problems,
        `TaxJar's tax.rate is ${describe(rateRaw)} (${JSON.stringify(rateRaw)}), not a finite number.`
      );
    } else if (rateRaw < 0) {
      collect(problems, `TaxJar's tax.rate is negative (${rateRaw}).`);
    } else {
      rate = rateRaw;
    }
  }

  // ---- reporting detail: never fatal --------------------------------------
  const taxableRaw = tax.taxable_amount;
  const taxableAmountCents =
    typeof taxableRaw === 'number' && Number.isFinite(taxableRaw) && taxableRaw >= 0
      ? dollarsToCents(taxableRaw)
      : null;

  // `null` not `false` — see the function comment. This distinction is the
  // difference between one real conflict alert and a flood of false ones.
  const hasNexus = typeof tax.has_nexus === 'boolean' ? tax.has_nexus : null;
  const freightTaxable = typeof tax.freight_taxable === 'boolean' ? tax.freight_taxable : null;

  if (problems.length > 0 || amountCents === null) {
    return {
      ok: false,
      problems:
        problems.length > 0
          ? problems
          : ['TaxJar\'s response did not carry a usable tax amount.'],
    };
  }

  return {
    ok: true,
    value: {
      amountCents,
      rate,
      taxableAmountCents,
      hasNexus,
      freightTaxable,
      jurisdictions: readJurisdictions(tax.jurisdictions),
    },
  };
}

/**
 * THE SERVER-SIDE RECORD OF A CHANGED VENDOR PAYLOAD.
 *
 * One `console.error` line — a real, searchable runtime log on Vercel — carrying
 * the endpoint, every problem found, and a TRUNCATED copy of what actually
 * arrived. The truncated payload is what makes the log actionable: "tax.rate is
 * not a finite number" is the symptom and the 600 characters under it are the
 * diagnosis.
 *
 * IT LOGS THE RESPONSE AND NEVER THE REQUEST. A tax request body carries a
 * customer's shipping address; a response does not. The asymmetry is deliberate
 * and must survive any edit to this function.
 *
 * Returns the line it logged so a test can assert on the real string rather than
 * on a spy's arguments. It never throws: a logging failure must not be able to
 * turn a degraded read into a broken one.
 */
export function logTaxShapeProblem(endpoint: string, problems: string[], raw: unknown): string {
  let payload: string;
  try {
    payload = typeof raw === 'string' ? raw : JSON.stringify(raw);
  } catch {
    payload = '<payload could not be serialised>';
  }
  if (payload === undefined) payload = String(raw);
  const truncated =
    payload.length > MAX_LOGGED_PAYLOAD_CHARS
      ? `${payload.slice(0, MAX_LOGGED_PAYLOAD_CHARS)}… (${payload.length} chars total)`
      : payload;

  const line = `[TAX_SHAPE] ${endpoint} returned a payload that does not match the expected shape. ${problems.join(' ')} Payload: ${truncated}`;
  try {
    console.error(line);
  } catch {
    /* a broken console must never break a read */
  }
  return line;
}

/** Exported for the test that pins the truncation boundary. */
export const TAX_SHAPE_LOG_LIMITS = { MAX_PROBLEMS, MAX_LOGGED_PAYLOAD_CHARS } as const;
