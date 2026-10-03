import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeLineTotal, round2 } from '@/lib/admin/pricing';
import { logAdminAction } from '@/lib/admin/audit';
import { estimateFreight } from '@/lib/freight/estimate';
import { getFreightRateTable } from '@/lib/freight/db';
import { auditDelta, buildFreightEstimateRecord, finalCentsToQuoteDollars } from '@/lib/freight/override';
import type { FreightInput } from '@/lib/freight/types';

interface SendLineItemInput {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

interface QuoteRequestSource {
  id: string;
  request_number: string;
  status: string;
  user_id: string | null;
}

function isValidLineItem(item: unknown): item is SendLineItemInput {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.profileType === 'string' &&
    i.profileType.trim().length > 0 &&
    typeof i.lengthFt === 'number' &&
    i.lengthFt > 0 &&
    typeof i.quantity === 'number' &&
    i.quantity > 0 &&
    typeof i.unitPrice === 'number' &&
    i.unitPrice > 0
  );
}

function describeItem(item: SendLineItemInput): string {
  const parts = [item.profileType];
  if (item.material) parts.push(item.material);
  if (item.gauge) parts.push(item.gauge);
  return parts.join(' — ');
}

/**
 * THE FREIGHT OVERRIDE, IN CENTS, FROM THE REQUEST.
 *
 * Prefers the explicit `freightCents` the current client sends, and falls back
 * to converting the long-standing `freight` dollar field, so a cached bundle
 * still works. Returns `null` for an empty box — which is NOT zero: an empty
 * box means "no freight on this quote", and a typed 0 means "freight waived",
 * and `buildFreightEstimateRecord` records those as different facts.
 */
function overrideCentsFromBody(body: Record<string, unknown>): number | null {
  const cents = body.freightCents;
  if (typeof cents === 'number' && Number.isFinite(cents) && Number.isInteger(cents) && cents >= 0) {
    return cents;
  }
  const dollars = body.freight;
  if (typeof dollars === 'number' && Number.isFinite(dollars) && dollars >= 0) {
    return Math.round(dollars * 100);
  }
  return null;
}

/**
 * THE FREIGHT ESTIMATOR'S INPUTS, FROM THE REQUEST.
 *
 * Note what is NOT read here: any computed freight total. The client sends the
 * inputs it was given and the figure in the box; this route re-reads the rate
 * table and re-computes the estimate itself. A client-supplied total accepted
 * as "what the rate table said" would let a crafted request write a rate the
 * table never contained into `freight_estimates`, which is append-only and is
 * meant to be the honest record of how freight was priced.
 *
 * Every field is defaulted conservatively rather than rejected, because freight
 * must never be the reason a quote cannot be sent: a missing zone or weight
 * simply produces a refusal, and the figure in the box carries the quote.
 */
function freightInputFromBody(body: Record<string, unknown>, subtotalCents: number): FreightInput {
  const raw = body.freightInputs;
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
  const count = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;

  return {
    zoneId: typeof source.zoneId === 'string' && source.zoneId !== '' ? source.zoneId : null,
    weightLbs: num(source.weightLbs),
    weightMatchedItems: count(source.weightMatchedItems),
    weightTotalItems: count(source.weightTotalItems),
    longestPieceFt: num(source.longestPieceFt),
    isResidential: source.isResidential === true,
    requiresLiftgate: source.requiresLiftgate === true,
    // Taken from the line items this route just priced, NEVER from the body:
    // the free-freight threshold is decided by the real merchandise subtotal,
    // and a client that could set it could waive its own freight.
    merchandiseSubtotalCents: subtotalCents,
  };
}

async function nextQuoteNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AFS-Q-${year}-`;

  const { data } = await supabase
    .from('quotes')
    .select('quote_number')
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1);

  const last = data?.[0]?.quote_number as string | undefined;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  const nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;
    const rawItems = body.lineItems;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 });
    }
    if (!rawItems.every(isValidLineItem)) {
      return NextResponse.json(
        { error: 'Every line item needs a unit price greater than $0.' },
        { status: 400 }
      );
    }
    const lineItems = rawItems as SendLineItemInput[];

    const estimatorNotes = typeof body.estimatorNotes === 'string' ? body.estimatorNotes : null;

    const { data: requestRaw, error: requestError } = await supabase
      .from('quote_requests')
      .select('id, request_number, status, user_id')
      .eq('id', params.id)
      .maybeSingle();

    if (requestError || !requestRaw) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }
    const quoteRequest = requestRaw as QuoteRequestSource;

    if (quoteRequest.status === 'quoted') {
      return NextResponse.json({ error: 'This request has already been quoted.' }, { status: 409 });
    }
    if (quoteRequest.status === 'cancelled' || quoteRequest.status === 'expired') {
      return NextResponse.json({ error: 'This request can no longer be quoted.' }, { status: 409 });
    }
    if (!quoteRequest.user_id) {
      return NextResponse.json(
        { error: 'This request was submitted as a guest and has no account to receive a formal quote.' },
        { status: 400 }
      );
    }

    const subtotal = round2(
      lineItems.reduce((sum, item) => sum + computeLineTotal(item.unitPrice, item.quantity, item.lengthFt), 0)
    );

    // ---- FREIGHT, DECIDED HERE AND NOT BY THE CLIENT ----------------------
    //
    // The client sends the estimator's INPUTS and the figure in the freight
    // box. This route re-reads the rate table and re-computes the estimate
    // itself, so `computed_cents` in the audit row is always this server's own
    // arithmetic over the rate table as it stands right now. See
    // `freightInputFromBody` for why that matters.
    //
    // Freight must never be the reason a quote cannot be sent: if the table is
    // not installed, or cannot price the job, or the box is empty, the quote
    // still goes out — with the figure that was typed, or with no freight line
    // at all, exactly as it did before any of this existed.
    const overrideCents = overrideCentsFromBody(body);
    const freightInput = freightInputFromBody(body, Math.round(subtotal * 100));

    const freightTableResult = await getFreightRateTable(supabase).catch((tableError: unknown) => {
      // A rate table that cannot be read is not a reason to block a quote. The
      // figure in the box still carries it, and the failure is logged rather
      // than swallowed silently.
      console.error('[Admin Send Quote Freight Table Error]', tableError);
      return null;
    });

    const freightEstimate =
      freightTableResult !== null && freightTableResult.installed
        ? estimateFreight(freightInput, freightTableResult.table)
        : null;

    const freightRecord =
      freightEstimate === null
        ? null
        : buildFreightEstimateRecord({
            result: freightEstimate,
            input: freightInput,
            overrideCents,
          });

    // What actually goes on the quote, in the dollars `quotes.freight` holds.
    // When the rate table is absent the typed figure is used directly — which
    // is the whole of the old behaviour, preserved.
    const freight: number | null =
      freightRecord !== null && freightRecord.ok
        ? finalCentsToQuoteDollars(freightRecord.record.finalCents)
        : overrideCents !== null
          ? finalCentsToQuoteDollars(overrideCents)
          : null;

    const total = round2(subtotal + (freight ?? 0));

    const quoteNumber = await nextQuoteNumber(supabase);
    const now = new Date().toISOString();

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        request_id: quoteRequest.id,
        user_id: quoteRequest.user_id,
        status: 'sent',
        subtotal,
        freight,
        rush_surcharge: 0,
        tax: null,
        total,
        estimator_notes: estimatorNotes,
        created_by: user.id,
        sent_at: now,
      })
      .select('id, quote_number')
      .single();

    if (quoteError || !quote) {
      console.error('[Admin Send Quote Error]', quoteError);
      return NextResponse.json({ error: 'Could not create the quote. Please try again.' }, { status: 500 });
    }

    const quoteLineItems = lineItems.map((item, index) => ({
      quote_id: quote.id,
      description: describeItem(item),
      width_in: item.width ?? null,
      height_in: item.height ?? null,
      leg_a_in: item.legA ?? null,
      leg_b_in: item.legB ?? null,
      length_ft: item.lengthFt,
      quantity: item.quantity,
      unit: item.unit ?? 'LF',
      unit_price: item.unitPrice,
      line_total: computeLineTotal(item.unitPrice, item.quantity, item.lengthFt),
      sort_order: index,
    }));

    const { error: lineItemsError } = await supabase.from('quote_line_items').insert(quoteLineItems);
    if (lineItemsError) {
      console.error('[Admin Send Quote Line Items Error]', lineItemsError);
      return NextResponse.json({ error: 'Could not save quote line items. Please try again.' }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from('quote_requests')
      .update({ status: 'quoted', quoted_at: now, quote_id: quote.id })
      .eq('id', quoteRequest.id);
    if (updateError) {
      console.error('[Admin Send Quote Request Update Error]', updateError);
    }

    /**
     * THE FREIGHT AUDIT TRAIL — one append-only `freight_estimates` row, plus
     * one `admin_audit_log` entry.
     *
     * WRAPPED SO IT CANNOT BLOCK THE QUOTE, for the same reason the
     * notification below is (ARCHITECTURE.md section 9): an audit write failing
     * must not strand a customer's quote. The figure itself is already safe on
     * `quotes.freight`, so nothing is lost if this row does not land — only the
     * explanation of how it was arrived at, and the failure is logged.
     *
     * Skipped entirely when there is nothing to record: no rate table and no
     * typed figure means the quote simply has no freight line, and inventing a
     * row to say so would be a record of a decision nobody made.
     */
    if (freightRecord !== null && freightRecord.ok) {
      const record = freightRecord.record;
      try {
        // Service role: freight_estimates has SELECT and INSERT policies only
        // (migration 039 §7), and the insert is the authoritative record rather
        // than something the acting session should be able to shape.
        const admin = createAdminClient();
        const { error: freightAuditError } = await admin.from('freight_estimates').insert({
          quote_id: quote.id,
          quote_request_id: quoteRequest.id,
          zone_id: record.zoneId,
          zone_name: record.zoneName,
          weight_lbs: Number.isFinite(record.weightLbs) ? record.weightLbs : null,
          weight_lbs_matched: record.weightMatchedItems,
          weight_lbs_total_items: record.weightTotalItems,
          longest_piece_ft: Number.isFinite(record.longestPieceFt) ? record.longestPieceFt : null,
          freight_class: record.freightClass,
          is_residential: record.isResidential,
          requires_liftgate: record.requiresLiftgate,
          merchandise_subtotal_cents: record.merchandiseSubtotalCents,
          basis: record.basis,
          computed_cents: record.computedCents,
          override_cents: record.overrideCents,
          final_cents: record.finalCents,
          band_id: record.bandId,
          rate_version_ids: record.rateVersionIds.length > 0 ? record.rateVersionIds : null,
          surcharge_version_id: record.surchargeVersionId,
          breakdown: record.breakdown,
          refusals: record.refusals,
          notes: record.notes.length > 0 ? record.notes.join(' ') : null,
          override_reason: record.overrideReason,
          actor_id: user.id,
          actor_email: user.email ?? null,
        });
        if (freightAuditError) {
          console.error('[Admin Send Quote Freight Audit Error]', freightAuditError);
        }

        await logAdminAction({
          adminId: user.id,
          action: 'quote_freight_set',
          resourceType: 'quote',
          resourceId: quote.id,
          beforeValue: auditDelta(record).old,
          afterValue: auditDelta(record).new,
        });
      } catch (freightAuditError) {
        console.error('[Admin Send Quote Freight Audit Error]', freightAuditError);
      }
    }

    // Notification failure must never block the quote from being sent (ARCHITECTURE.md section 9).
    try {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', quoteRequest.user_id)
        .single();
      await supabase.from('notifications').insert({
        user_id: quoteRequest.user_id,
        channel: 'email',
        type: 'quote_sent',
        recipient: (customerProfile?.email as string | undefined) ?? '',
        status: 'sent',
      });
    } catch (notifyError) {
      console.error('[Admin Send Quote Notification Error]', notifyError);
    }

    return NextResponse.json({ quoteId: quote.id, quoteNumber: quote.quote_number });
  } catch (error) {
    console.error('[Admin Send Quote Error]', error);
    return NextResponse.json({ error: 'Could not send this quote. Please try again.' }, { status: 500 });
  }
}
