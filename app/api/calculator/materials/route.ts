/**
 * POST /api/calculator/materials — SPEC_AUTO_MATERIAL_CALCULATOR.md §4.
 *
 * QUANTITIES ONLY. Nothing this route returns is money (CLAUDE.md rule #1), and a
 * static unit test asserts the response type carries no price-shaped key.
 *
 * NO AUTH GATE, DELIBERATELY. /quote is a public page that supports guest
 * submission (app/quote/page.tsx's handleGuestSubmit), and the sibling panel on
 * the same step calls /api/recommendations/cross-sell, which has no auth check
 * either. A session requirement here would break the guest RFQ flow the whole
 * platform is built around.
 *
 * INSTEAD, RLS DECIDES. Every read goes through lib/supabase/server.ts — the anon
 * key plus the caller's own cookies — so:
 *   - a guest sees no accessory rows (`authenticated_read_accessories` needs
 *     auth.uid()), gets empty arrays, and the UI says AFS will confirm;
 *   - a signed-in contractor sees the catalog;
 *   - only an admin can see pricing_rules.waste_factor
 *     (`admin_only_pricing_rules`), so the internal pricing layer stays internal
 *     while everyone else gets the documented 1.10 default marked estimated.
 *
 * THIS ROUTE MUST NEVER IMPORT lib/supabase/admin.ts. The service-role client
 * would bypass all three of those. lib/material-calculator/
 * calculate-materials.test.ts is a static test that fails if it ever does.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateMaterials,
  MaterialCalcInputError,
  resolveProduct,
  validateMaterialCalcInput,
} from '@/lib/material-calculator';
import type {
  MaterialCalcErrorBody,
  MaterialCalcInput,
  MaterialCalcRequestBody,
  MaterialCalcResponseBody,
  ProductAccessory,
  ProductResolution,
} from '@/lib/material-calculator';
import {
  getCalculatorProductCandidates,
  getProductAccessories,
  getProductWasteFactorMultiplier,
} from '@/lib/data/product-accessories';

// The answer depends on the caller's cookies, which is what RLS reads. Caching it
// would serve one caller's catalog visibility to another.
export const dynamic = 'force-dynamic';

function asNumber(value: unknown): number {
  // Number.NaN rather than a coercion, so validateMaterialCalcInput's
  // finite-number guard rejects strings, null, objects and undefined by the same
  // rule it rejects NaN — one refusal path, not several.
  return typeof value === 'number' ? value : Number.NaN;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function badRequest(body: MaterialCalcErrorBody): NextResponse<MaterialCalcErrorBody> {
  return NextResponse.json(body, { status: 400 });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<MaterialCalcResponseBody | MaterialCalcErrorBody>> {
  try {
    const raw = (await request.json().catch(() => null)) as MaterialCalcRequestBody | null;
    if (!raw || typeof raw !== 'object') {
      return badRequest({ error: 'Send a JSON body with lengthFt and pieces.' });
    }

    // §4 lists `rawQtyLf` in the request. It is not accepted: it is
    // lengthFt * pieces, so taking it from the client would create a second
    // source of truth for the billed quantity that the client could contradict.
    // EES deviation D-4.
    const input: MaterialCalcInput = {
      lengthFt: asNumber(raw.lengthFt),
      quantity: asNumber(raw.pieces),
      stockLengthFt: raw.stockLengthFt ?? null,
    };

    const validation = validateMaterialCalcInput(input);
    if (!validation.ok) {
      return badRequest({ error: 'Check the quantities and try again.', details: validation.errors });
    }

    const supabase = await createClient();

    const explicitProductId = asTrimmedString(raw.productId);
    const profileLabel = asTrimmedString(raw.profileLabel);
    const materialLabel = asTrimmedString(raw.materialLabel);
    const gaugeLabel = asTrimmedString(raw.gaugeLabel);

    let productId: string | null = explicitProductId;
    let productResolution: ProductResolution = explicitProductId ? 'resolved' : 'not_attempted';

    // §4 takes a productId and the quote wizard has none to give — its profile,
    // material and gauge are free-text labels, not foreign keys
    // (MATERIAL_CALC_SCOPE.md §6). So the labels are resolved server-side, and
    // only when the answer is unambiguous. EES deviation D-3.
    if (!productId && (profileLabel || materialLabel)) {
      const candidates = await getCalculatorProductCandidates(supabase);
      const resolved = resolveProduct(candidates, { profileLabel, materialLabel, gaugeLabel });
      productResolution = resolved.status;
      if (resolved.status === 'resolved') productId = resolved.productId;
    }

    let accessories: ProductAccessory[] = [];
    let wasteFactorMultiplier: number | null = null;

    if (productId) {
      // Independent reads. Neither failure may take the other's result, or the
      // waste-factor arithmetic, down with it — both helpers return their own
      // empty value rather than throwing.
      [accessories, wasteFactorMultiplier] = await Promise.all([
        getProductAccessories(supabase, productId),
        getProductWasteFactorMultiplier(supabase, productId),
      ]);
    }

    const result = calculateMaterials({ ...input, wasteFactorMultiplier, accessories });

    return NextResponse.json({
      rawQtyLf: result.waste.rawQtyLf,
      adjustedQtyLf: result.waste.adjustedQtyLf,
      wasteFactorPct: result.waste.wasteFactorPct,
      wasteQtyLf: result.waste.wasteQtyLf,
      isWasteEstimated: result.waste.isEstimated,
      requiredAccessories: result.accessories.required,
      optionalAccessories: result.accessories.optional,
      uncalculableAccessories: result.accessories.uncalculable,
      stockOptimization: result.stockOptimization,
      productResolution,
    });
  } catch (error) {
    // A validation failure that slipped past the explicit check is still the
    // caller's input problem, not a server fault.
    if (error instanceof MaterialCalcInputError) {
      return badRequest({ error: 'Check the quantities and try again.', details: error.details });
    }
    // Nothing from the database or the stack reaches the client. The sentence says
    // what did not happen, per CLAUDE.md rule #30's wording rule.
    return NextResponse.json(
      {
        error:
          'Material quantities could not be calculated. Nothing about your quote request has changed.',
      },
      { status: 500 }
    );
  }
}
