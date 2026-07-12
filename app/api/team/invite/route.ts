import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/lib/utils/validation';
import { type CompanyRole, isCompanyRole } from '@/lib/data/team';

const INVITE_EXPIRY_DAYS = 7;

interface InviteCreateBody {
  email?: string;
  role?: string;
  message?: string;
}

interface AcceptBody {
  token?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as InviteCreateBody | null;
    const email = body?.email?.trim().toLowerCase() ?? '';
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (!isCompanyRole(body?.role)) {
      return NextResponse.json({ error: 'Select a valid team role.' }, { status: 400 });
    }
    const role = body!.role as CompanyRole;
    const message = body?.message?.trim() || null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, company, company_id, company_role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const admin = createAdminClient();
    let companyId = profile.company_id as string | null;
    let companyName: string;

    if (!companyId) {
      const { data: company, error: companyError } = await admin
        .from('companies')
        .insert({
          name: profile.company?.trim() || `${profile.full_name}'s Team`,
          primary_user_id: user.id,
        })
        .select('id, name')
        .single();

      if (companyError || !company) {
        console.error('[Team Invite] Company create failed', companyError);
        return NextResponse.json({ error: 'Could not create your company account.' }, { status: 500 });
      }

      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({ company_id: company.id, company_role: 'owner' })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error('[Team Invite] Profile update failed', profileUpdateError);
        return NextResponse.json({ error: 'Could not set up your company account.' }, { status: 500 });
      }

      companyId = company.id;
      companyName = company.name;
    } else {
      if (!profile.company_role || !['owner', 'admin'].includes(profile.company_role)) {
        return NextResponse.json(
          { error: 'Only company owners and admins can invite team members.' },
          { status: 403 }
        );
      }
      const { data: company } = await admin.from('companies').select('name').eq('id', companyId).single();
      companyName = company?.name ?? 'your company';
    }

    const { data: existingMember } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ error: 'This person is already on your team.' }, { status: 400 });
    }

    const { data: existingInvite } = await admin
      .from('team_invitations')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation is already pending for this email.' }, { status: 400 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: insertError } = await admin
      .from('team_invitations')
      .insert({
        company_id: companyId,
        email,
        role,
        token,
        message,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (insertError || !invitation) {
      console.error('[Team Invite] Insert failed', insertError);
      return NextResponse.json({ error: 'Could not send invitation. Please try again.' }, { status: 500 });
    }

    const inviteUrl = `${request.nextUrl.origin}/invite/${token}`;
    return NextResponse.json({ id: invitation.id, inviteUrl, companyName });
  } catch (error) {
    console.error('[Team Invite Error]', error);
    return NextResponse.json({ error: 'Could not send invitation. Please try again.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as AcceptBody | null;
    const token = body?.token?.trim() ?? '';
    if (!token) {
      return NextResponse.json({ error: 'Missing invitation token.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: invitation } = await admin
      .from('team_invitations')
      .select('id, company_id, email, role, status, expires_at')
      .eq('token', token)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: 'This invitation link is invalid.' }, { status: 404 });
    }
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used or revoked.' }, { status: 400 });
    }
    if (new Date(invitation.expires_at) < new Date()) {
      await admin.from('team_invitations').update({ status: 'expired' }).eq('id', invitation.id);
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 400 });
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address. Sign in with that account.' },
        { status: 403 }
      );
    }

    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ company_id: invitation.company_id, company_role: invitation.role })
      .eq('id', user.id);

    if (profileUpdateError) {
      console.error('[Team Invite Accept] Profile update failed', profileUpdateError);
      return NextResponse.json({ error: 'Could not join the company. Please try again.' }, { status: 500 });
    }

    await admin
      .from('team_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq('id', invitation.id);

    const { data: company } = await admin.from('companies').select('name').eq('id', invitation.company_id).single();

    return NextResponse.json({ companyName: company?.name ?? 'the team' });
  } catch (error) {
    console.error('[Team Invite Accept Error]', error);
    return NextResponse.json({ error: 'Could not join the company. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing invitation id.' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, company_role')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id || !['owner', 'admin'].includes(profile.company_role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('team_invitations')
      .update({ status: 'revoked' })
      .eq('id', id)
      .eq('company_id', profile.company_id);

    if (error) {
      console.error('[Team Invite Cancel] Update failed', error);
      return NextResponse.json({ error: 'Could not cancel invitation.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Team Invite Cancel Error]', error);
    return NextResponse.json({ error: 'Could not cancel invitation.' }, { status: 500 });
  }
}
