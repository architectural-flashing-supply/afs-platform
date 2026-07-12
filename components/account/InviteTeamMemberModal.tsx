'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanyRole } from '@/lib/data/team';

const ROLE_OPTIONS: { value: CompanyRole; label: string }[] = [
  { value: 'admin', label: 'Admin — everything except billing' },
  { value: 'estimator', label: 'Estimator — create and view quote requests' },
  { value: 'pm', label: 'PM — view and track orders' },
  { value: 'accounting', label: 'Accounting — invoices and statements' },
  { value: 'viewer', label: 'Viewer — read-only orders and tracking' },
];

interface InviteResponse {
  inviteUrl: string;
}
interface ErrorResponse {
  error: string;
}

export default function InviteTeamMemberModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CompanyRole>('estimator');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function resetAndClose() {
    setOpen(false);
    setEmail('');
    setRole('estimator');
    setMessage('');
    setError(null);
    setInviteUrl(null);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, message }),
      });
      const data = (await res.json()) as InviteResponse | ErrorResponse;
      if (!res.ok) {
        setError('error' in data ? data.error : 'Could not send invitation.');
        setLoading(false);
        return;
      }
      setInviteUrl('inviteUrl' in data ? data.inviteUrl : null);
      router.refresh();
    } catch {
      setError('Could not send invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    resetAndClose();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="invite-team-member-button"
        className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
      >
        Invite Team Member
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--afs-bg-modal)] px-4 py-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[520px] bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-afs-ink-900">Invite Team Member</h2>
              <button
                type="button"
                onClick={resetAndClose}
                className="text-afs-ink-700 hover:text-afs-ink-900"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {inviteUrl ? (
              <div className="flex flex-col gap-4" data-testid="invite-success">
                <p className="font-body text-sm text-afs-ink-700">
                  Invitation created. Share this link with them to join your team — it expires in 7 days.
                </p>
                <div className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-xs text-afs-ink-900 break-all">
                  {inviteUrl}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleDone}
                    className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="invite-email" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
                    Email
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
                    placeholder="teammate@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="invite-role" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as CompanyRole)}
                    className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="invite-message" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
                    Personal Message <span className="normal-case text-afs-crimson">(optional)</span>
                  </label>
                  <textarea
                    id="invite-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body resize-y"
                  />
                </div>

                {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={resetAndClose}
                    className="border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
