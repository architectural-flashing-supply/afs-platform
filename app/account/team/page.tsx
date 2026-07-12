import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import InviteTeamMemberModal from '@/components/account/InviteTeamMemberModal';
import CancelInvitationButton from '@/components/account/CancelInvitationButton';

type CompanyRole = 'owner' | 'admin' | 'estimator' | 'pm' | 'accounting' | 'viewer';
type MemberStatus = 'active' | 'invited';

const ROLE_LABEL: Record<CompanyRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  estimator: 'Estimator',
  pm: 'PM',
  accounting: 'Accounting',
  viewer: 'Viewer',
};

const STATUS_VARIANT: Record<MemberStatus, BadgeVariant> = {
  active: 'success',
  invited: 'warning',
};

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  status: MemberStatus;
  isSelf: boolean;
}

interface PendingInvitationRow {
  id: string;
  email: string;
  role: CompanyRole;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AccountTeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, company_id, company_role')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  let members: MemberRow[] = [
    {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      role: (profile.company_role as CompanyRole | null) ?? 'owner',
      status: 'active',
      isSelf: true,
    },
  ];
  let pendingInvitations: PendingInvitationRow[] = [];
  let companyName: string | null = null;
  const canManage = !profile.company_id || ['owner', 'admin'].includes(profile.company_role ?? '');

  if (profile.company_id) {
    const { data: company } = await supabase.from('companies').select('name').eq('id', profile.company_id).single();
    companyName = company?.name ?? null;

    const { data: memberRows } = await supabase
      .from('profiles')
      .select('id, full_name, email, company_role')
      .eq('company_id', profile.company_id)
      .order('full_name', { ascending: true });

    members = ((memberRows ?? []) as { id: string; full_name: string; email: string; company_role: CompanyRole | null }[]).map(
      (row) => ({
        id: row.id,
        name: row.full_name,
        email: row.email,
        role: row.company_role ?? 'viewer',
        status: 'active',
        isSelf: row.id === user.id,
      })
    );

    const { data: inviteRows } = await supabase
      .from('team_invitations')
      .select('id, email, role, created_at')
      .eq('company_id', profile.company_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    pendingInvitations = ((inviteRows ?? []) as { id: string; email: string; role: CompanyRole; created_at: string }[]).map(
      (row) => ({ id: row.id, email: row.email, role: row.role, createdAt: row.created_at })
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-ink-900">Team</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">
            {companyName
              ? `Manage who at ${companyName} has AFS access.`
              : 'Invite teammates to give your company shared access to quotes, orders, and tracking.'}
          </p>
        </div>
        {canManage && <InviteTeamMemberModal />}
      </div>

      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">Name</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">Email</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">Role</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">Status</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors" data-testid="member-row">
                <td className="font-body text-sm text-afs-ink-900 px-4 py-3">
                  {member.name}
                  {member.isSelf && <span className="font-label text-xs text-afs-ink-700 ml-2">(You)</span>}
                </td>
                <td className="font-data text-sm text-afs-ink-700 px-4 py-3">{member.email}</td>
                <td className="font-body text-sm text-afs-ink-700 px-4 py-3">{ROLE_LABEL[member.role]}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT.active}>Active</Badge>
                </td>
                <td className="px-4 py-3 text-right font-body text-xs text-afs-ink-700">—</td>
              </tr>
            ))}
            {pendingInvitations.map((invite) => (
              <tr key={invite.id} className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors" data-testid="pending-invitation-row">
                <td className="font-body text-sm text-afs-ink-700 px-4 py-3 italic">Pending</td>
                <td className="font-data text-sm text-afs-ink-700 px-4 py-3">{invite.email}</td>
                <td className="font-body text-sm text-afs-ink-700 px-4 py-3">{ROLE_LABEL[invite.role]}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT.invited}>Invited {formatDate(invite.createdAt)}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && <CancelInvitationButton invitationId={invite.id} email={invite.email} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
