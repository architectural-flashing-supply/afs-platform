'use client';

import { useState } from 'react';
import { COMPANY_ROLES, type CompanyRole } from '@/lib/data/team';

export interface TeamMemberSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
}

interface ManageTeamModalProps {
  members: TeamMemberSummary[];
  onClose: () => void;
}

const ROLE_LABEL: Record<CompanyRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  estimator: 'Estimator',
  pm: 'PM',
  accounting: 'Accounting',
  viewer: 'Viewer',
};

/**
 * Extends the existing Team Accounts system (profiles.company_role,
 * /api/team/invite, /api/team/members/[userId] — added this same phase)
 * rather than a parallel add/remove/change-role implementation. Invite
 * still goes through app/account/team's full page (linked below) since
 * that flow already handles the "no company yet" bootstrap case
 * (auto-creating a companies row on first invite) that would otherwise
 * need duplicating here.
 */
export default function ManageTeamModal({ members: initialMembers, onClose }: ManageTeamModalProps) {
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(userId: string, role: CompanyRole) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/team/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not update role.');
        return;
      }
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)));
    } catch {
      setError('Network error.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm('Remove this person from the team?')) return;
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/team/members/${userId}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not remove team member.');
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch {
      setError('Network error.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6" onClick={onClose}>
      <div
        className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-lg w-full max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl text-afs-chrome-high">Manage Team</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-afs-chrome-mid hover:text-afs-chrome-high">
            ✕
          </button>
        </div>

        {error && <p className="font-body text-sm text-afs-crimson mb-3">{error}</p>}

        <div className="flex flex-col gap-2 mb-4">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3 bg-afs-bg-surface rounded px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-body text-sm text-afs-chrome-high truncate">
                  {member.name} {member.isSelf && <span className="font-label text-xs text-afs-chrome-dim">(You)</span>}
                </p>
                <p className="font-data text-xs text-afs-chrome-mid truncate">{member.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={member.role}
                  disabled={member.isSelf || busyId === member.id}
                  onChange={(e) => changeRole(member.id, e.target.value as CompanyRole)}
                  className="bg-afs-bg-overlay border border-afs-border rounded px-2 py-1.5 font-body text-xs text-afs-chrome-high focus:outline-none focus:border-afs-crimson disabled:opacity-50"
                >
                  {COMPANY_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
                {!member.isSelf && (
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    disabled={busyId === member.id}
                    className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <a href="/account/team" className="font-label text-sm text-afs-crimson hover:text-afs-crimson-hover transition-colors">
          Invite a new team member →
        </a>
      </div>
    </div>
  );
}
