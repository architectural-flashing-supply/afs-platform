'use client';

import { useMemo, useState } from 'react';
import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';
import FullPageProfileModal from '@/components/profile-passport/FullPageProfileModal';
import type { PassportRole } from '@/lib/data/team';
import type { PassportProfileRow } from '@/lib/data/profile-passport';

const PAGE_SIZE = 10;
type SortKey = 'created' | 'name' | 'jobName';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ProfilesTabProps {
  initialProfiles: PassportProfileRow[];
  role: PassportRole;
  isCompanyAccount: boolean;
}

/**
 * Rebuilt as a permanent left-sidebar thumbnail strip (a follow-up request
 * to the original table layout) — sort, pagination, and the per-profile
 * actions menu (Edit Name/Download PDF/Delete) are unchanged in behavior,
 * just re-laid-out into a single scrollable column instead of a wide table
 * (per Reid's explicit "keep sort/pagination/actions, restyle as sidebar"
 * direction, not the request's own literal wording, which didn't mention
 * any of those three at all). The "Saved By" company-account column
 * becomes a line under the job name instead of its own table column, for
 * the same reason. The sidebar is permanent for the DURATION of the
 * Profiles tab being active — not literally present on the Account/
 * Settings tabs too, which would be a much bigger, unrequested layout
 * change to the whole page.
 */
export default function ProfilesTab({ initialProfiles, role, isCompanyAccount }: ProfilesTabProps) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [page, setPage] = useState(1);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const canEdit = role === 'admin' || role === 'editor';
  const canDelete = role === 'admin';

  const sorted = useMemo(() => {
    const copy = [...profiles];
    if (sortKey === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
    if (sortKey === 'jobName') return copy.sort((a, b) => (a.jobName ?? '').localeCompare(b.jobName ?? ''));
    return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [profiles, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeSort(key: SortKey) {
    setSortKey(key);
    setPage(1);
  }

  async function submitRename(id: string) {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/profile-passport/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_name: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRowError(data.error ?? 'Could not rename profile.');
        return;
      }
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
      setRenamingId(null);
    } catch {
      setRowError('Network error.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProfile(id: string) {
    if (!window.confirm('Delete this profile? This cannot be undone.')) return;
    setBusyId(id);
    setRowError(null);
    try {
      const res = await fetch(`/api/profile-passport/profiles/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRowError(data.error ?? 'Could not delete profile.');
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setRowError('Network error.');
    } finally {
      setBusyId(null);
      setMenuOpenId(null);
    }
  }

  if (profiles.length === 0) {
    return (
      <div className="bg-afs-bg-raised border border-afs-border rounded p-12 text-center">
        <p className="font-body text-sm text-afs-chrome-mid mb-4">
          No saved profiles yet. Create one from FlashDraft and lock it to save.
        </p>
        <a
          href="/studio/draft"
          className="inline-block bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
        >
          Open FlashDraft
        </a>
      </div>
    );
  }

  const previewProfile = previewId ? profiles.find((p) => p.id === previewId) : null;

  return (
    <div className="flex gap-6">
      {/* LEFT SIDEBAR — fixed width, dark background, permanent (never
          collapses/closes), scrollable. */}
      <aside className="w-[300px] shrink-0 bg-afs-bg-raised border border-afs-border rounded flex flex-col max-h-[75vh]">
        <div className="flex items-center gap-1 px-3 py-2.5 border-b border-afs-border shrink-0 overflow-x-auto">
          {(['created', 'name', 'jobName'] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => changeSort(key)}
              className={`font-label text-[10px] uppercase tracking-wide px-2 py-1 rounded whitespace-nowrap transition-colors ${
                sortKey === key ? 'text-afs-crimson bg-afs-crimson/10' : 'text-afs-chrome-mid hover:text-afs-chrome-high'
              }`}
            >
              {key === 'created' ? 'Date' : key === 'name' ? 'Name' : 'Job'}
            </button>
          ))}
        </div>

        {rowError && <p className="font-body text-xs text-afs-crimson px-3 pt-2">{rowError}</p>}

        <div className="flex-1 overflow-y-auto">
          {pageRows.map((profile) => (
            <div key={profile.id} className="flex gap-3 p-3 border-b border-afs-border last:border-0 relative">
              <button
                type="button"
                onClick={() => setPreviewId(profile.id)}
                aria-label={`Preview ${profile.name}`}
                className="shrink-0 w-[120px] h-[120px] bg-afs-bg-overlay border border-afs-chrome-dim rounded overflow-hidden hover:border-afs-crimson transition-colors cursor-pointer"
              >
                {profile.thumbnailImage ? (
                  <img src={profile.thumbnailImage} alt="" className="w-full h-full object-contain" />
                ) : (
                  <CanonicalProfileDiagram points={profile.points} width={118} height={118} />
                )}
              </button>

              <div className="flex-1 min-w-0 flex flex-col gap-1">
                {renamingId === profile.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(profile.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="w-full bg-afs-bg-overlay border border-afs-border rounded px-2 py-1 font-body text-xs text-afs-chrome-high focus:outline-none focus:border-afs-crimson"
                    />
                    <button
                      type="button"
                      onClick={() => submitRename(profile.id)}
                      disabled={busyId === profile.id}
                      className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover shrink-0"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewId(profile.id)}
                    className="text-left font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors truncate"
                  >
                    {profile.name}
                  </button>
                )}
                {profile.isLocked && (
                  <span className="self-start font-label text-[10px] font-bold text-afs-accent-green border border-afs-accent-green rounded px-1.5 py-0.5">
                    LOCKED
                  </span>
                )}
                <p className="font-data text-xs text-afs-chrome-dim">{formatDate(profile.createdAt)}</p>
                <p className="font-body text-xs text-afs-chrome-mid truncate">{profile.jobName || '—'}</p>
                {isCompanyAccount && <p className="font-body text-[11px] text-afs-chrome-dim truncate">Saved by {profile.ownerName}</p>}
              </div>

              <button
                type="button"
                onClick={() => setMenuOpenId((id) => (id === profile.id ? null : profile.id))}
                aria-label={`Actions for ${profile.name}`}
                className="shrink-0 self-start text-afs-chrome-mid hover:text-afs-chrome-high"
              >
                ⋮
              </button>
              {menuOpenId === profile.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                  <div className="absolute right-2 top-8 z-20 w-44 bg-afs-bg-raised border border-afs-chrome-dim rounded shadow-xl py-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(profile.id);
                          setNameDraft(profile.name);
                          setMenuOpenId(null);
                        }}
                        className="w-full text-left px-3 py-2 font-body text-sm text-afs-chrome-high hover:bg-afs-bg-surface transition-colors"
                      >
                        Edit Name
                      </button>
                    )}
                    <a
                      href={`/api/profile-passport/profiles/${profile.id}/pdf`}
                      onClick={() => setMenuOpenId(null)}
                      className="block w-full text-left px-3 py-2 font-body text-sm text-afs-chrome-high hover:bg-afs-bg-surface transition-colors"
                    >
                      Download PDF
                    </a>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deleteProfile(profile.id)}
                        disabled={busyId === profile.id}
                        className="w-full text-left px-3 py-2 font-body text-sm text-afs-crimson hover:bg-afs-bg-surface transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-afs-border shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="font-label text-[10px] text-afs-chrome-mid hover:text-afs-chrome-high disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <p className="font-body text-[10px] text-afs-chrome-dim">
              {page} / {totalPages}
            </p>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="font-label text-[10px] text-afs-chrome-mid hover:text-afs-chrome-high disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </aside>

      {/* Main area — empty in this redesign except for the full-page modal
          (FullPageProfileModal) that takes over the ENTIRE viewport
          (including this sidebar) once a thumbnail is clicked. */}
      <div className="flex-1 flex items-center justify-center min-h-[75vh]">
        <p className="font-body text-sm text-afs-chrome-dim">Select a profile to view it full-size.</p>
      </div>

      {previewProfile && (
        <FullPageProfileModal
          name={previewProfile.name}
          points={previewProfile.points}
          thumbnailImage={previewProfile.thumbnailImage}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
