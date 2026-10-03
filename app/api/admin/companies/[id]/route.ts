import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

/**
 * ADMIN WRITE FOR A COMPANY-LEVEL SETTING.
 *
 * Today that is exactly one field: `companies.require_po`, the PO requirement
 * SPEC_PURCHASE_ORDER_INTEGRATION.md §3 says an admin sets "per company in
 * /admin/customers/{id}". The column has existed since the initial schema and
 * the only thing that ever wrote it was credit-application approval
 * (app/api/admin/credit-applications/[id]/route.ts), which meant a company that
 * never applied for credit could not be given the requirement at all.
 *
 * DELIBERATELY NARROW. `companies` also holds `pricing_tier`, `net_terms`,
 * `credit_limit` and `billing_address`. This route writes NONE of them — the
 * update statement names `require_po` and nothing else, so a crafted body
 * cannot raise a credit limit through the PO endpoint. Widening it is a
 * decision for whoever specifies company management properly; it is not a
 * convenience to add in passing.
 */
interface CompanyPatchBody {
  requirePo?: unknown;
}

interface CompanySource {
  id: string;
  name: string;
  require_po: boolean;
}

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
    const body = raw as CompanyPatchBody;

    // Strictly boolean. A missing field, a string "false" or a 0 would each
    // coerce to something under Boolean() and quietly write the opposite of
    // what the caller meant — this is a setting that changes whether every
    // future order from every member of the company can be placed.
    if (typeof body.requirePo !== 'boolean') {
      return NextResponse.json(
        { error: 'requirePo must be true or false. Nothing was changed.' },
        { status: 400 }
      );
    }
    const requirePo: boolean = body.requirePo;

    const { data: existingRaw } = await supabase
      .from('companies')
      .select('id, name, require_po')
      .eq('id', params.id)
      .maybeSingle();
    if (!existingRaw) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }
    const existing = existingRaw as CompanySource;

    const { error: updateError } = await supabase
      .from('companies')
      .update({ require_po: requirePo })
      .eq('id', params.id);
    if (updateError) {
      console.error('[Company PO Requirement Update Error]', updateError);
      return NextResponse.json(
        { error: 'Could not save the PO requirement. Nothing was changed — please try again.' },
        { status: 500 }
      );
    }

    // Same audit shape as the credit-application writer, so both ways of
    // setting this field land in one readable trail.
    await logAdminAction({
      adminId: user.id,
      action: 'update_company_po_requirement',
      resourceType: 'company',
      resourceId: params.id,
      beforeValue: { requirePo: existing.require_po === true },
      afterValue: { requirePo },
    });

    return NextResponse.json({ company: { id: existing.id, name: existing.name, requirePo } });
  } catch (error) {
    console.error('[Company PO Requirement Route Error]', error);
    return NextResponse.json(
      { error: 'Could not save the PO requirement. Nothing was changed — please try again.' },
      { status: 500 }
    );
  }
}
