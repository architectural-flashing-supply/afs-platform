import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPassportAccountInfo, getPassportUserContext } from '@/lib/data/profile-passport';

interface UpdateCompanyBody {
  company_name?: string;
  phone?: string;
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const account = await getPassportAccountInfo(supabase, context.userId);
  if (!account) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  return NextResponse.json({
    company_name: account.companyName,
    contact_email: account.contactEmail,
    role: account.role,
    team_members: account.teamMembers,
  });
}

/** "Edit Company Info" (Account tab, Admin only) — Contact Email is deliberately not editable here; the spec has it read-only from auth.email. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const context = await getPassportUserContext(supabase);
  if (!context) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  if (context.role !== 'admin') {
    return NextResponse.json({ error: 'Only Admins can edit company info.' }, { status: 403 });
  }
  if (!context.companyId) {
    return NextResponse.json({ error: 'No company account to edit.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as UpdateCompanyBody | null;
  const companyName = body?.company_name?.trim();
  if (!companyName) {
    return NextResponse.json({ error: 'company_name is required.' }, { status: 400 });
  }

  // companies' own RLS (SCHEMA.md TABLE 2) only grants company members
  // SELECT — UPDATE is admin_all_companies (platform-role admin) only, by
  // design (billing/credit terms live on this same row and stay
  // AFS-controlled). The company_role admin check above is the real
  // authorization; the admin client here is what makes the write possible
  // at all, matching the identical pattern already used in
  // app/api/team/invite/route.ts for the same table.
  const admin = createAdminClient();
  const { error } = await admin
    .from('companies')
    .update({ name: companyName, phone: body?.phone?.trim() || null })
    .eq('id', context.companyId);

  if (error) {
    console.error('[Profile Passport Company Update Error]', error);
    return NextResponse.json({ error: 'Could not update company info.' }, { status: 500 });
  }

  return NextResponse.json({ company_name: companyName });
}
