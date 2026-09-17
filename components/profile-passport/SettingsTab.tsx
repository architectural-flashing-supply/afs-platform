'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PassportRole } from '@/lib/data/team';

export const DISPLAY_PREF_KEY = 'afs-passport-display-pref';
export type DisplayPreference = 'thumbnails' | 'list';

interface SettingsTabProps {
  role: PassportRole;
}

const DELETE_CONFIRM_PHRASE = 'DELETE';

export default function SettingsTab({ role }: SettingsTabProps) {
  const [displayPref, setDisplayPref] = useState<DisplayPreference>('list');
  const [shareNotifications, setShareNotifications] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISPLAY_PREF_KEY);
      if (stored === 'thumbnails' || stored === 'list') setDisplayPref(stored);
    } catch {
      // Best-effort — browser may be blocking local storage.
    }
  }, []);

  function updateDisplayPref(pref: DisplayPreference) {
    setDisplayPref(pref);
    try {
      window.localStorage.setItem(DISPLAY_PREF_KEY, pref);
    } catch {
      // Best-effort — browser may be blocking local storage.
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/profile-passport/account/delete', { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(data.error ?? 'Could not delete account.');
        setDeleting(false);
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch {
      setDeleteError('Network error.');
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Profile Display Preference</h2>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-5 flex items-center gap-2">
          {(['list', 'thumbnails'] as DisplayPreference[]).map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => updateDisplayPref(pref)}
              className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
                displayPref === pref
                  ? 'border-afs-crimson bg-afs-crimson/10 text-afs-crimson'
                  : 'border-afs-border text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {pref === 'list' ? 'Show List' : 'Show Thumbnails'}
            </button>
          ))}
        </div>
        <p className="font-body text-xs text-afs-chrome-mid mt-2">Applies to how your saved profiles display on the Profiles tab.</p>
      </section>

      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Notifications</h2>
        <label className="flex items-center gap-3 bg-afs-bg-raised border border-afs-border rounded p-5 opacity-60 cursor-not-allowed">
          <input type="checkbox" checked={shareNotifications} onChange={() => setShareNotifications((v) => !v)} disabled className="accent-afs-crimson" />
          <span className="font-body text-sm text-afs-chrome-high">Email me when a profile is shared with me</span>
          <span className="font-label text-[10px] text-afs-chrome-dim border border-afs-border rounded px-1.5 py-0.5 ml-auto">Coming Soon</span>
        </label>
      </section>

      {role === 'admin' && (
        <section>
          <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Export</h2>
          <div className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-border rounded p-5 opacity-60">
            <div>
              <p className="font-body text-sm text-afs-chrome-high">Export All Profiles</p>
              <p className="font-body text-xs text-afs-chrome-mid mt-1">Download all saved profiles as a ZIP file.</p>
            </div>
            <span className="font-label text-[10px] text-afs-chrome-dim border border-afs-border rounded px-1.5 py-0.5 shrink-0">Coming Soon</span>
          </div>
        </section>
      )}

      {role === 'admin' && (
        <section>
          <h2 className="font-heading text-lg text-afs-crimson mb-4">Danger Zone</h2>
          <div className="border border-afs-crimson/40 bg-[var(--afs-crimson-ghost)] rounded p-5">
            <p className="font-body text-sm text-afs-chrome-high mb-1">Delete Account</p>
            <p className="font-body text-xs text-afs-chrome-mid mb-4">
              Permanently deletes your login and profile. This does not delete your order or quote history, and cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-2 border-afs-crimson text-afs-crimson hover:bg-afs-crimson hover:text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
            >
              Delete Account
            </button>
          </div>
        </section>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div className="bg-afs-bg-raised border border-afs-crimson rounded p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-xl text-afs-crimson mb-3">Delete Account?</h3>
            <p className="font-body text-sm text-afs-chrome-mid mb-4">
              This permanently deletes your login. Type <span className="font-data text-afs-chrome-high">{DELETE_CONFIRM_PHRASE}</span> to
              confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson mb-4"
            />
            {deleteError && <p className="font-body text-sm text-afs-crimson mb-4">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={confirmText !== DELETE_CONFIRM_PHRASE || deleting}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
