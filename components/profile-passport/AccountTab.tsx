'use client';

import { useState } from 'react';
import ManageTeamModal, { type TeamMemberSummary } from '@/components/profile-passport/ManageTeamModal';
import type { PassportRole } from '@/lib/data/team';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  estimator: 'Estimator',
  pm: 'PM',
  accounting: 'Accounting',
  viewer: 'Viewer',
};

interface AccountTabProps {
  companyName: string | null;
  contactEmail: string;
  role: PassportRole;
  teamMembers: TeamMemberSummary[];
}

export default function AccountTab({ companyName: initialCompanyName, contactEmail, role, teamMembers }: AccountTabProps) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [showManageTeam, setShowManageTeam] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [editDraft, setEditDraft] = useState(initialCompanyName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === 'admin';

  async function saveCompanyInfo() {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile-passport/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; company_name?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not update company info.');
        return;
      }
      setCompanyName(data.company_name ?? trimmed);
      setShowEditCompany(false);
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-heading text-lg text-afs-chrome-high">Company Info</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditDraft(companyName ?? '');
                setShowEditCompany(true);
              }}
              className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover transition-colors"
            >
              Edit Company Info
            </button>
          )}
        </div>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-5 flex flex-col gap-4">
          <div>
            <p className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim mb-1">Company Name</p>
            <p className="font-body text-sm text-afs-chrome-high">{companyName || '—'}</p>
          </div>
          <div>
            <p className="font-label text-[10px] uppercase tracking-wide text-afs-chrome-dim mb-1">Company Contact Email</p>
            <p className="font-body text-sm text-afs-chrome-high">{contactEmail}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-heading text-lg text-afs-chrome-high">Team Members</h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowManageTeam(true)}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs font-semibold px-4 py-2 rounded transition-colors"
            >
              Manage Team
            </button>
          )}
        </div>
        {teamMembers.length <= 1 ? (
          <p className="font-body text-sm text-afs-chrome-mid">You are the only team member on this account.</p>
        ) : (
          <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
            {teamMembers.map((member, idx) => (
              <div
                key={member.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-afs-border' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-body text-sm text-afs-chrome-high truncate">
                    {member.name} {member.isSelf && <span className="font-label text-xs text-afs-chrome-dim">(You)</span>}
                  </p>
                  <p className="font-data text-xs text-afs-chrome-dim truncate">{member.email}</p>
                </div>
                <p className="font-label text-xs text-afs-chrome-mid shrink-0">{ROLE_LABEL[member.role] ?? member.role}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {showManageTeam && <ManageTeamModal members={teamMembers} onClose={() => setShowManageTeam(false)} />}

      {showEditCompany && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6" onClick={() => setShowEditCompany(false)}>
          <div
            className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl text-afs-chrome-high mb-4">Edit Company Info</h3>
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block" htmlFor="company-name">
              Company Name
            </label>
            <input
              id="company-name"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson mb-4"
            />
            {error && <p className="font-body text-sm text-afs-crimson mb-4">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditCompany(false)}
                disabled={saving}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCompanyInfo}
                disabled={saving}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
