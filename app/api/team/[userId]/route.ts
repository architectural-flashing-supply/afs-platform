import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isCompanyRole } from '@/lib/data/team';

interface ChangeRoleBody {
  role?: string;
}

/**
 * Extends the existing Team Accounts feature (app/account/team,
 * app/api/team/invite) with remove-member/change-role — that route only
 * ever covered invite/cancel-invite, nothing edited an already-active
 * member. Added as a sibling dynamic route under /api/team/ (not folded
 * into /api/team/invite's own file) since these operate on real profiles
 * rows, not team_invitations rows, and mixing both resources into one
 * handler would make each method's meaning ambiguous — Next.js resolves
 * the literal /api/team/invite segment ahead of this dynamic [userId] one,
 * so both coexist without conflict. Built for Profile Passport's Account
 * tab (Phase 3, afs-pp-001), but not passport-specific — this is real team
 * management usable from anywhere, matching the explicit decision to reuse
 * rather than fork the team system.
 */
export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as ChangeRoleBody | null;
    if (!isCompanyRole(body?.role)) {
      return NextResponse.json({ error: 'Select a valid team role.' }, { status: 400 });
    }
    const role = body!.role;

    const { data: caller } = await supabase.from('profiles').select('company_id, company_role').eq('id', user.id).single();
    if (!caller?.company_id || !['owner', 'admin'].includes(caller.company_role ?? '')) {
      return NextResponse.json({ error: 'Only company owners and admins can change roles.' }, { status: 403 });
    }

    if (params.userId === user.id && role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'You cannot demote yourself out of an admin role.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: target } = await admin.from('profiles').select('id, company_id').eq('id', params.userId).maybeSingle();
    if (!target || target.company_id !== caller.company_id) {
      return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
    }

    const { error } = await admin.from('profiles').update({ company_role: role }).eq('id', params.userId);
    if (error) {
      console.error('[Team Role Change Error]', error);
      return NextResponse.json({ error: 'Could not update role.' }, { status: 500 });
    }

    return NextResponse.json({ id: params.userId, role });
  } catch (error) {
    console.error('[Team Role Change Error]', error);
    return NextResponse.json({ error: 'Could not update role.' }, { status: 500 });
  }
}

/** Admin-only; a company always needs at least one owner/admin left standing, so removing the caller's own admin seat is refused outright rather than left to accidentally empty the company. */
export async function DELETE(_request: NextRequest, { params }: { params: { userId: string } }): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (params.userId === user.id) {
      return NextResponse.json({ error: 'You cannot remove your own admin access.' }, { status: 400 });
    }

    const { data: caller } = await supabase.from('profiles').select('company_id, company_role').eq('id', user.id).single();
    if (!caller?.company_id || !['owner', 'admin'].includes(caller.company_role ?? '')) {
      return NextResponse.json({ error: 'Only company owners and admins can remove team members.' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: target } = await admin.from('profiles').select('id, company_id').eq('id', params.userId).maybeSingle();
    if (!target || target.company_id !== caller.company_id) {
      return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
    }

    // Removal means leaving the company, not deleting the account — clears
    // company_id/company_role so the ex-member falls back to owning just
    // their own solo profiles/orders again, matching saved_configurations'
    // own company_id IS NULL fallback (024_profile_passport_company_scope.sql).
    const { error } = await admin.from('profiles').update({ company_id: null, company_role: null }).eq('id', params.userId);
    if (error) {
      console.error('[Team Member Remove Error]', error);
      return NextResponse.json({ error: 'Could not remove team member.' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Team Member Remove Error]', error);
    return NextResponse.json({ error: 'Could not remove team member.' }, { status: 500 });
  }
}
