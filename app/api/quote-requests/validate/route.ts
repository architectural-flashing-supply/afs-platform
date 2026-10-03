/**
 * POST /api/quote-requests/validate — SPEC_AI_ORDER_VALIDATOR.md section 6.
 *
 * The authoritative check behind the Quote Builder's Step 2 -> Next gate. The
 * page runs the same engine live as the customer types, but "do not trust the
 * client" is the spec's own instruction, and the client genuinely cannot do the
 * whole job: `product_profiles` RLS requires a session, so a GUEST browser
 * cannot read a single dimension range. Here the ranges are read with the
 * service role, and a guest gets the same validation a signed-in contractor
 * does.
 *
 * THREE THINGS THIS ROUTE WILL NOT DO:
 *
 *   1. IT WILL NOT FAIL A SUBMISSION BECAUSE IT FAILED ITSELF. A reference read
 *      that does not come back, or any unexpected throw, answers 200 with an
 *      explicitly empty, non-blocking result. SPEC section 6 says "fall through to
 *      valid if API slow"; the same posture applies to every failure mode,
 *      because a safeguard in front of a quote request must not take the quote
 *      request down with it.
 *   2. IT WILL NOT CALL A MODEL UNLESS ASKED. The advisory layer needs
 *      AFS_ORDER_VALIDATOR_AI=1; with the flag off, the SDK adapter is never
 *      even constructed.
 *   3. IT WILL NOT RETURN AN ADMIN-SCOPE FINDING. Everything is filtered through
 *      `findingsForAudience(..., 'customer')` and stripped of its rule code
 *      before serialising.
 *
 * AUTHENTICATION: deliberately none, matching `POST /api/quote-requests` itself,
 * which accepts a guest submission with an email address. Requiring a session
 * here would mean a guest could submit a quote request but not have it checked,
 * which is the wrong way round. The route reads no user data and writes nothing;
 * the only database access is two REFERENCE tables' worth of catalog dimensions,
 * which the public product catalog already shows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { constraintsForQuoteLabels, getProfileConstraints } from '@/lib/data/product-profiles';
import {
  MAX_ITEMS_PER_VALIDATION,
  emptyValidationResponse,
  toValidationMessage,
  type ValidationErrorResponse,
  type ValidationResponse,
} from '@/lib/order-validator/api-shape';
import {
  MAX_POINTS_PER_ITEM,
  countOversizedPolylines,
  profileLabelsOf,
  readOrderValidatorItems,
} from '@/lib/order-validator/request-items';
import {
  acknowledgeableFindings,
  blockingFindings,
  findingsForAudience,
  informationalFindings,
  validateOrder,
  withAdvisories,
} from '@/lib/order-validator/validate';
import { assumedLimitKeys } from '@/lib/order-validator/limits';
import { isAiAdvisorEnabled, requestAdvisories } from '@/lib/order-validator/ai-advisor';
import type { OrderValidatorItem, ProfileConstraints } from '@/lib/order-validator/types';

/**
 * Reads the catalog's dimension ranges, aliased to the labels this request
 * actually used.
 *
 * Returns `[]` rather than throwing when the read fails. The engine's own rules
 * degrade correctly without ranges (it reports to the admin that the range check
 * did not run), so a reference-data outage costs the range rules and keeps the
 * geometry, sheet-fit and bend-count rules — which is a far better answer than
 * no validation at all.
 */
async function loadConstraints(items: readonly OrderValidatorItem[]): Promise<ProfileConstraints[]> {
  try {
    const admin = createAdminClient();
    const catalog = await getProfileConstraints(admin);
    if (catalog.length === 0) return [];
    // The catalog first, then the alias entries, so an exact catalog match wins
    // and only a label that differs from every catalog name falls through to its
    // alias. See constraintsForQuoteLabels for why the aliasing lives there.
    return [...catalog, ...constraintsForQuoteLabels(catalog, profileLabelsOf(items))];
  } catch (error) {
    console.error('[Order Validator] could not read product_profiles ranges', error);
    return [];
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ValidationResponse | ValidationErrorResponse>> {
  try {
    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const body = raw as Record<string, unknown>;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required.' }, { status: 400 });
    }
    if (body.items.length > MAX_ITEMS_PER_VALIDATION) {
      return NextResponse.json(
        { error: `A quote request can be checked up to ${MAX_ITEMS_PER_VALIDATION} items at a time.` },
        { status: 400 }
      );
    }

    // The self-intersection check compares every non-adjacent segment pair, so
    // its cost is quadratic in the point count and this route is
    // unauthenticated. Refused explicitly rather than silently losing the
    // geometry checks on an over-long polyline — no real drawing is close to
    // this, so a caller that hits it has a bug or worse and should be told.
    if (countOversizedPolylines(body.items) > 0) {
      return NextResponse.json(
        { error: `A drawn profile can carry up to ${MAX_POINTS_PER_ITEM} points.` },
        { status: 400 }
      );
    }

    const items = readOrderValidatorItems(body.items);
    if (items.length === 0) {
      return NextResponse.json({ error: 'No readable items were supplied.' }, { status: 400 });
    }

    const constraints = await loadConstraints(items);
    let result = validateOrder({ items, constraints });

    // The advisory layer, if and only if it has been switched on. It is given
    // what the customer has already been told so it neither rediscovers it nor
    // pads its list by repeating it, and it can never change `blocked`.
    if (isAiAdvisorEnabled()) {
      const { createAnthropicAdvisoryClient } = await import('@/lib/order-validator/anthropic-advisor-client');
      const alreadyFlagged = findingsForAudience(result.findings, 'customer').map((finding) => finding.message);
      const advisories = await requestAdvisories(items, createAnthropicAdvisoryClient(), {}, alreadyFlagged);
      result = withAdvisories(result, advisories);
    }

    const visible = findingsForAudience(result.findings, 'customer');
    const errors = blockingFindings(visible).map(toValidationMessage);
    const warnings = acknowledgeableFindings(visible).map(toValidationMessage);
    const infos = informationalFindings(visible).map(toValidationMessage);

    const response: ValidationResponse = {
      // SPEC section 6's own definition of valid: nothing to show the customer that
      // needs their attention. An information note does not make a request
      // invalid.
      valid: errors.length === 0 && warnings.length === 0,
      blocked: result.blockedForCustomer,
      errors,
      warnings,
      infos,
      counts: result.counts,
      hasAssumedLimits: assumedLimitKeys().length > 0,
    };
    return NextResponse.json(response);
  } catch (error) {
    // Deliberately 200 with an empty result rather than 500. A customer pressing
    // Next must not be stopped by a fault in the thing that was meant to help
    // them, and the submit route runs the same engine server-side anyway.
    console.error('[Order Validator] validation failed', error);
    return NextResponse.json(emptyValidationResponse());
  }
}
