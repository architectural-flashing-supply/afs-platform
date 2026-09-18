'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import CanonicalProfileDiagram from '@/components/studio/CanonicalProfileDiagram';
import ProfilePreviewModal from '@/components/profile-passport/ProfilePreviewModal';
import { DISPLAY_PREF_KEY, type DisplayPreference } from '@/components/profile-passport/SettingsTab';
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

export default function ProfilesTab({ initialProfiles, role, isCompanyAccount }: ProfilesTabProps) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [page, setPage] = useState(1);
  // "Profile Display Preference" (Settings tab) — thumbnails always show
  // inline instead of only on hover. Read directly from localStorage
  // (SettingsTab's own persistence) rather than threaded through props,
  // since the two tabs render on separate page loads/searchParams values,
  // not as siblings that could share state directly.
  const [showThumbnailsAlways, setShowThumbnailsAlways] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const canEdit = role === 'admin' || role === 'editor';
  const canDelete = role === 'admin';

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISPLAY_PREF_KEY) as DisplayPreference | null;
      setShowThumbnailsAlways(stored === 'thumbnails');
    } catch {
      // Best-effort — browser may be blocking local storage.
    }
  }, []);

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
        <Link
          href="/studio/draft"
          className="inline-block bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
        >
          Open FlashDraft
        </Link>
      </div>
    );
  }

  const previewProfile = previewId ? profiles.find((p) => p.id === previewId) : null;

  return (
    <div>
      {rowError && <p className="font-body text-sm text-afs-crimson mb-3">{rowError}</p>}
      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => changeSort('name')}
                  className={`font-heading text-xs uppercase tracking-wide transition-colors ${sortKey === 'name' ? 'text-afs-crimson' : 'text-afs-chrome-mid hover:text-afs-chrome-high'}`}
                >
                  Name
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => changeSort('created')}
                  className={`font-heading text-xs uppercase tracking-wide transition-colors ${sortKey === 'created' ? 'text-afs-crimson' : 'text-afs-chrome-mid hover:text-afs-chrome-high'}`}
                >
                  Date Created
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => changeSort('jobName')}
                  className={`font-heading text-xs uppercase tracking-wide transition-colors ${sortKey === 'jobName' ? 'text-afs-crimson' : 'text-afs-chrome-mid hover:text-afs-chrome-high'}`}
                >
                  Job Name
                </button>
              </th>
              {isCompanyAccount && (
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Saved By</th>
              )}
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((profile) => (
              <tr key={profile.id} className="border-b border-afs-border last:border-0 hover:bg-afs-bg-surface transition-colors">
                <td className="px-4 py-3 relative" onMouseEnter={() => setHoveredId(profile.id)} onMouseLeave={() => setHoveredId((id) => (id === profile.id ? null : id))}>
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
                        className="bg-afs-bg-overlay border border-afs-border rounded px-2 py-1 font-body text-sm text-afs-chrome-high focus:outline-none focus:border-afs-crimson"
                      />
                      <button
                        type="button"
                        onClick={() => submitRename(profile.id)}
                        disabled={busyId === profile.id}
                        className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/studio/draft?loadPassport=${profile.id}`}
                      className="font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors"
                    >
                      {profile.name}
                      {profile.isLocked && <span className="ml-2 font-label text-[10px] text-afs-accent-green">LOCKED</span>}
                    </Link>
                  )}
                  {showThumbnailsAlways && renamingId !== profile.id && (
                    <button
                      type="button"
                      onClick={() => setPreviewId(profile.id)}
                      aria-label={`Preview ${profile.name}`}
                      className="mt-2 block w-24 h-20 bg-afs-bg-overlay border border-afs-chrome-dim rounded p-1 hover:border-afs-crimson transition-colors"
                    >
                      {profile.thumbnailImage ? (
                        <img src={profile.thumbnailImage} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <CanonicalProfileDiagram points={profile.points} width={88} height={72} />
                      )}
                    </button>
                  )}
                  {!showThumbnailsAlways && hoveredId === profile.id && renamingId !== profile.id && (
                    <button
                      type="button"
                      onClick={() => setPreviewId(profile.id)}
                      aria-label={`Preview ${profile.name}`}
                      className="absolute left-0 top-full mt-1 z-10 w-36 h-28 bg-afs-bg-overlay border border-afs-chrome-dim rounded shadow-xl p-1 hover:border-afs-crimson transition-colors"
                    >
                      {profile.thumbnailImage ? (
                        <img src={profile.thumbnailImage} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <CanonicalProfileDiagram points={profile.points} width={136} height={104} />
                      )}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 font-data text-xs text-afs-chrome-mid whitespace-nowrap">{formatDate(profile.createdAt)}</td>
                <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid">{profile.jobName || '—'}</td>
                {isCompanyAccount && <td className="px-4 py-3 font-body text-sm text-afs-chrome-mid">{profile.ownerName}</td>}
                <td className="px-4 py-3 text-right relative">
                  <button
                    type="button"
                    onClick={() => setPreviewId(profile.id)}
                    aria-label={`Expand ${profile.name}`}
                    className="text-afs-chrome-mid hover:text-afs-chrome-high mr-3"
                    title="Full-size preview"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 inline" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuOpenId((id) => (id === profile.id ? null : profile.id))}
                    aria-label={`Actions for ${profile.name}`}
                    className="text-afs-chrome-mid hover:text-afs-chrome-high"
                  >
                    ⋮
                  </button>
                  {menuOpenId === profile.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                      <div className="absolute right-4 top-full mt-1 z-20 w-44 bg-afs-bg-raised border border-afs-chrome-dim rounded shadow-xl py-1">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="font-body text-xs text-afs-chrome-dim">
            Page {page} of {totalPages} · {sorted.length} profiles
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="font-label text-xs text-afs-chrome-mid hover:text-afs-chrome-high disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {previewProfile && (
        <ProfilePreviewModal
          profileId={previewProfile.id}
          name={previewProfile.name}
          points={previewProfile.points}
          thumbnailImage={previewProfile.thumbnailImage}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
