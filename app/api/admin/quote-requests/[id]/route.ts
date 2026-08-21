import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

interface JobIdentityUpdateInput {
  clientBusinessName?: string | null;
  clientName?: string | null;
  poNumber?: string | null;
  requestedBy?: string | null;
}

/**
 * Command Center quote-request detail page (afs-jf-003) — lets Steve view
 * and edit the four job-identity intake fields (migration 018,
 * client_business_name / client_name / po_number / requested_by) before
 * approval, in case the customer didn't fill them in (or filled them in
 * wrong) on the submission surface. Same single-PATCH-route-per-resource
 * pattern already used by app/api/admin/orders/[id]/crm/route.ts and
 * app/api/admin/customers/[id]/route.ts. All four fields are optional
 * strings — an empty/whitespace-only value clears the column to null
 * rather than storing an empty string.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw: unknown = await request.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const body = raw as JobIdentityUpdateInput;

    const { data: existing } = await supabase.from('quote_requests').select('id').eq('id', params.id).maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: 'Quote request not found.' }, { status: 404 });
    }

    function normalize(value: unknown): string | null | undefined {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }

    const update: Record<string, unknown> = {};
    if ('clientBusinessName' in body) update.client_business_name = normalize(body.clientBusinessName);
    if ('clientName' in body) update.client_name = normalize(body.clientName);
    if ('poNumber' in body) update.po_number = normalize(body.poNumber);
    if ('requestedBy' in body) update.requested_by = normalize(body.requestedBy);

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided.' }, { status: 400 });
    }

    const { error: updateError } = await supabase.from('quote_requests').update(update).eq('id', params.id);
    if (updateError) {
      console.error('[Quote Request Job-Identity Update Error]', updateError);
      return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: 'update_quote_request_job_identity',
      resourceType: 'quote_request',
      resourceId: params.id,
      afterValue: update,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Quote Request Job-Identity Route Error]', error);
    return NextResponse.json({ error: 'Could not save changes. Please try again.' }, { status: 500 });
  }
}
