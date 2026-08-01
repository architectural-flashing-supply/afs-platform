import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAdminAction } from '@/lib/admin/audit';

interface CreditDecisionInput {
  status?: 'approved' | 'denied';
  approvedLimit?: number;
  approvedTerms?: number;
  requirePo?: boolean;
  reviewerNotes?: string | null;
}

interface CreditApplicationSource {
  id: string;
  status: string;
  user_id: string;
  company_id: string | null;
}

const APPROVED_TERMS_OPTIONS = [15, 30, 60];

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
    const body = raw as CreditDecisionInput;

    if (body.status !== 'approved' && body.status !== 'denied') {
      return NextResponse.json({ error: 'Status must be approved or denied.' }, { status: 400 });
    }
    if (body.status === 'approved') {
      if (typeof body.approvedLimit !== 'number' || body.approvedLimit <= 0) {
        return NextResponse.json({ error: 'Enter a valid approved credit limit.' }, { status: 400 });
      }
      if (!body.approvedTerms || !APPROVED_TERMS_OPTIONS.includes(body.approvedTerms)) {
        return NextResponse.json({ error: 'Select valid approved terms.' }, { status: 400 });
      }
    }

    const { data: existingRaw } = await supabase
      .from('credit_applications')
      .select('id, status, user_id, company_id')
      .eq('id', params.id)
      .maybeSingle();
    if (!existingRaw) {
      return NextResponse.json({ error: 'Credit application not found.' }, { status: 404 });
    }
    const existing = existingRaw as CreditApplicationSource;

    const update: Record<string, unknown> = {
      status: body.status,
      reviewer_id: user.id,
      reviewer_notes: body.reviewerNotes ?? null,
      reviewed_at: new Date().toISOString(),
    };
    if (body.status === 'approved') {
      update.approved_limit = body.approvedLimit;
      update.approved_terms = body.approvedTerms;
    }

    const { error: updateError } = await supabase.from('credit_applications').update(update).eq('id', params.id);
    if (updateError) {
      console.error('[Credit Application Decision Error]', updateError);
      return NextResponse.json({ error: 'Could not save this decision. Please try again.' }, { status: 500 });
    }

    await logAdminAction({
      adminId: user.id,
      action: body.status === 'approved' ? 'approve_credit_application' : 'deny_credit_application',
      resourceType: 'credit_application',
      resourceId: params.id,
      beforeValue: { status: existing.status },
      afterValue: update,
    });

    // Approval is supposed to set profiles.net_terms + companies.credit_limit/
    // require_po — SPEC_ONLINE_CREDIT_APPLICATION.md §3 calls for this but the
    // route previously only ever touched the credit_applications row itself.
    // No company row exists for applicants who never went through Team
    // Accounts, so the company-level write is skipped (not failed) when
    // company_id is null — the admin review modal surfaces that gap instead.
    if (body.status === 'approved') {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ net_terms: body.approvedTerms, updated_at: new Date().toISOString() })
        .eq('id', existing.user_id);
      if (profileUpdateError) {
        console.error('[Credit Application Profile Update Error]', profileUpdateError);
        return NextResponse.json(
          { error: 'Decision saved, but could not update the customer net terms. Please try again.' },
          { status: 500 }
        );
      }
      await logAdminAction({
        adminId: user.id,
        action: 'update_customer_account_settings',
        resourceType: 'profile',
        resourceId: existing.user_id,
        afterValue: { netTerms: body.approvedTerms },
      });

      if (existing.company_id) {
        const { error: companyUpdateError } = await supabase
          .from('companies')
          .update({ credit_limit: body.approvedLimit, require_po: body.requirePo ?? false })
          .eq('id', existing.company_id);
        if (companyUpdateError) {
          console.error('[Credit Application Company Update Error]', companyUpdateError);
          return NextResponse.json(
            { error: 'Decision saved, but could not update the company credit limit / PO requirement. Please try again.' },
            { status: 500 }
          );
        }
        await logAdminAction({
          adminId: user.id,
          action: 'update_company_credit_terms',
          resourceType: 'company',
          resourceId: existing.company_id,
          afterValue: { creditLimit: body.approvedLimit, requirePo: body.requirePo ?? false },
        });
      }
    }

    return NextResponse.json({ success: true, status: body.status });
  } catch (error) {
    console.error('[Credit Application Route Error]', error);
    return NextResponse.json({ error: 'Could not save this decision. Please try again.' }, { status: 500 });
  }
}
