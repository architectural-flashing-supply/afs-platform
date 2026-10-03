/**
 * "TEST A CALCULATION" — the admin-only tax preview.
 *
 * ================== WHY THIS ROUTE EXISTS ==================
 *
 * The tax engine is deliberately not wired to any customer-facing figure
 * (EES-OVN.08 §8 — the specs disagree about whether tax belongs on the quote or
 * is added at payment, and `create-intent` charges `quote.total`). Without this
 * route, the whole engine would be unreachable code until somebody wires it,
 * which is the worst moment to discover that the cache, the review queue or the
 * configuration reporting was never run end to end.
 *
 * So an admin can ask the real engine a real question, against the real nexus
 * table, and see the real outcome — with no customer, no quote, no order and no
 * charge anywhere near it.
 *
 * ================== WHAT IT CANNOT DO ==================
 *
 * It writes no quote, no invoice and no order. It takes no customer id, so it
 * cannot bill anybody. The exemption flag is a plain checkbox the admin ticks to
 * SEE the exempt branch — it is not read from, and cannot write to, any
 * customer's `profiles.tax_exempt`.
 *
 * With nothing configured — which is today's state, since there is no TaxJar key
 * and no nexus state list — the honest answer is "not configured", and that is
 * exactly what it returns. It does not return $0.00.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateTaxForOrder } from '@/lib/tax/service';
import { collectableTaxCents, TAX_OUTCOME_LABELS } from '@/lib/tax/types';
import { normalizeStateCode } from '@/lib/tax/nexus';

/** A dollar string to integer cents. Mirrors lib/pricing/quote-math.ts's parser. */
function parseDollarsToCents(raw: unknown): number | 'invalid' {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return 'invalid';
    return Math.round(raw * 100);
  }
  if (typeof raw !== 'string') return 'invalid';
  const trimmed = raw.trim().replace(/^\$/, '').replace(/,/g, '');
  if (trimmed === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid';
  return Math.round(Number(trimmed) * 100);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Same two-step auth as the configuration route: the session, then the role.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to test a tax calculation.' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if ((adminProfile as { role?: string } | null)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only an administrator can test a tax calculation.' },
        { status: 403 }
      );
    }

    const raw: unknown = await request.json().catch(() => null);
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

    const toState = normalizeStateCode(typeof body.toState === 'string' ? body.toState : null);
    if (toState === null) {
      return NextResponse.json(
        { error: 'Enter a two-letter ship-to state, for example TX. Nothing was calculated.' },
        { status: 400 }
      );
    }

    const toZip = typeof body.toZip === 'string' ? body.toZip.trim() : '';
    if (toZip === '') {
      return NextResponse.json(
        { error: 'Enter a ship-to ZIP code. Nothing was calculated.' },
        { status: 400 }
      );
    }

    const subtotalCents = parseDollarsToCents(body.subtotal);
    if (subtotalCents === 'invalid') {
      return NextResponse.json(
        { error: 'The amount must be a dollar figure like 1000 or 1000.50. Nothing was calculated.' },
        { status: 400 }
      );
    }

    const shippingCents = parseDollarsToCents(body.shipping ?? '');
    if (shippingCents === 'invalid') {
      return NextResponse.json(
        { error: 'The freight amount must be a dollar figure, or left blank. Nothing was calculated.' },
        { status: 400 }
      );
    }

    // A plain checkbox so the admin can see the exempt branch. NOT a customer's
    // real flag — this route takes no customer at all.
    const customerTaxExempt = body.customerTaxExempt === true;

    const admin = createAdminClient();
    const result = await calculateTaxForOrder(admin, {
      request: { toState, toZip, subtotalCents, shippingCents },
      customerTaxExempt,
      actorId: user.id,
      // No quote and no order: this is a preview, and the recorded row says so by
      // carrying neither link.
      quoteId: null,
      quoteRequestId: null,
    });

    const outcome = result.outcome;
    const amountCents = collectableTaxCents(outcome);

    return NextResponse.json({
      ok: true,
      kind: outcome.kind,
      label: TAX_OUTCOME_LABELS[outcome.kind],
      reason: outcome.reason,
      // NULL, NOT 0, when there is no figure. The API surface keeps the same
      // promise the type does: a non-answer is never dressed up as a zero.
      amountCents,
      rate: outcome.kind === 'calculated' ? outcome.rate : null,
      isAuthoritative: outcome.isAuthoritative,
      provider: outcome.provider,
      requiresAdminReview: outcome.kind === 'failed',
      problems: outcome.kind === 'failed' ? outcome.problems : [],
      fromCache: result.fromCache,
      request: { toState, toZip, subtotalCents, shippingCents, customerTaxExempt },
    });
  } catch (error) {
    console.error('[Tax Preview Error]', error);
    return NextResponse.json(
      { error: 'The test calculation could not be run. Nothing was changed.' },
      { status: 500 }
    );
  }
}
