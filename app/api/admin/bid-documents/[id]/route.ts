import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireOperatorApi } from '@/lib/auth/require-operator';

// 'sent' is deliberately excluded — that transition now only happens through
// POST .../send (real Resend delivery + PDF attachment), never a bare status
// flip, so "sent" always means the GC actually received the document.
const STATUS_OPTIONS = ['draft', 'awarded', 'lost', 'expired', 'withdrawn'];

interface PatchBody {
  projectName?: string;
  gcName?: string;
  gcContactName?: string | null;
  gcContactEmail?: string | null;
  gcContactPhone?: string | null;
  projectLocation?: string | null;
  priceValidUntil?: string | null;
  deliveryTerms?: string | null;
  taxNote?: string;
  customerNote?: string | null;
  status?: string;
}

/**
 * Single write route for the builder page (BID_DOCUMENT_SCOPE.md §7.2):
 * header-field debounced autosave AND the status buttons (Won / Lost /
 * Withdrawn / Expired) both PATCH here — every successful call bumps
 * last_activity_at, which is what both the claim-staleness check and the
 * "still claimed" heartbeat read. Not gated on who currently holds the
 * claim — the claim is advisory only (§3.1), every operator/admin already
 * has full RLS write access to this row.
 *
 * draft → sent is deliberately NOT one of this route's statuses — that
 * transition only happens through POST .../send, which generates the PDF
 * and actually emails it via Resend before flipping status. See
 * lib/utils/bid-document-email.ts.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const auth = await requireOperatorApi(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' }, { status: auth.status });
    }

    const { data: existing } = await supabase.from('bid_documents').select('id, status').eq('id', params.id).maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Bid document not found.' }, { status: 404 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as PatchBody;
    const update: Record<string, unknown> = { last_activity_at: new Date().toISOString() };

    if (body.projectName !== undefined) {
      const value = body.projectName.trim();
      if (!value) return NextResponse.json({ error: 'Project name cannot be empty.' }, { status: 400 });
      update.project_name = value;
    }
    if (body.gcName !== undefined) {
      const value = body.gcName.trim();
      if (!value) return NextResponse.json({ error: 'GC name cannot be empty.' }, { status: 400 });
      update.gc_name = value;
    }
    if (body.gcContactName !== undefined) update.gc_contact_name = body.gcContactName?.trim() || null;
    if (body.gcContactEmail !== undefined) update.gc_contact_email = body.gcContactEmail?.trim() || null;
    if (body.gcContactPhone !== undefined) update.gc_contact_phone = body.gcContactPhone?.trim() || null;
    if (body.projectLocation !== undefined) update.project_location = body.projectLocation?.trim() || null;
    if (body.priceValidUntil !== undefined) update.price_valid_until = body.priceValidUntil || null;
    if (body.deliveryTerms !== undefined) update.delivery_terms = body.deliveryTerms?.trim() || null;
    if (body.taxNote !== undefined) {
      const value = body.taxNote.trim();
      update.tax_note = value || 'Price excludes applicable sales tax.';
    }
    if (body.customerNote !== undefined) update.customer_note = body.customerNote?.trim() || null;

    if (body.status !== undefined) {
      if (!STATUS_OPTIONS.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
      }
      update.status = body.status;
    }

    const { error } = await supabase.from('bid_documents').update(update).eq('id', params.id);
    if (error) {
      console.error('[Bid Document Patch Error]', error);
      return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Bid Document Patch Error]', error);
    return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
  }
}
