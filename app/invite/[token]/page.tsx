import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import AuthShell from '@/components/layout/AuthShell';
import InviteAcceptForm from '@/components/account/InviteAcceptForm';

interface InvitationRow {
  id: string;
  company_id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
}

function InvalidInvite({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center">
      <h1 className="font-heading text-2xl font-bold text-afs-ink-900 mb-3">{title}</h1>
      <p className="font-body text-sm text-afs-ink-700 mb-8">{description}</p>
      <Link
        href="/login"
        className="inline-block bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm rounded px-6 py-3 transition-colors"
      >
        Go to Sign In
      </Link>
    </div>
  );
}

export default async function InvitePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from('team_invitations')
    .select('id, company_id, email, role, status, expires_at')
    .eq('token', params.token)
    .single<InvitationRow>();

  if (!invitation) {
    return (
      <AuthShell>
        <InvalidInvite title="Invitation Not Found" description="This invitation link is invalid. Ask your team admin to resend it." />
      </AuthShell>
    );
  }

  if (invitation.status === 'accepted') {
    return (
      <AuthShell>
        <InvalidInvite title="Already Joined" description="This invitation has already been accepted. Sign in to access your account." />
      </AuthShell>
    );
  }

  const isExpired = invitation.status === 'expired' || (invitation.status === 'pending' && new Date(invitation.expires_at) < new Date());
  if (invitation.status === 'revoked' || isExpired) {
    return (
      <AuthShell>
        <InvalidInvite title="Invitation Expired" description="This invitation link has expired or been cancelled. Ask your team admin to send a new one." />
      </AuthShell>
    );
  }

  const { data: company } = await admin.from('companies').select('name').eq('id', invitation.company_id).single();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell>
      <InviteAcceptForm
        token={params.token}
        email={invitation.email}
        role={invitation.role}
        companyName={company?.name ?? 'the team'}
        isLoggedIn={Boolean(user)}
        loggedInEmail={user?.email ?? null}
      />
    </AuthShell>
  );
}
