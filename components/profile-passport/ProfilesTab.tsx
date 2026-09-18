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
 * Second layout rebuild — back to a full-width table (from the permanent
 * left-sidebar version one turn ago), now with an explicit column order
 * (Name / Job Name / PO / Date / Thumbnail, thumbnail far right) and the
 * actions menu only appearing on row hover rather than always-visible.
 * Sort, pagination, rename/PDF/delete are unchanged in behavior across all
 * three layouts — only presentation has moved. "Saved By" (company
 * accounts) isn't one of the 5 named columns in this pass's spec, so it's
 * a small subtext line under the profile name instead of its own column,
 * rather than silently dropped.
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

  const sortButtonClass = (key: SortKey) =>
    `font-heading text-xs uppercase tracking-wide transition-colors ${
      sortKey === key ? 'text-afs-crimson' : 'text-afs-chrome-mid hover:text-afs-chrome-high'
    }`;

  return (
    <div>
      {rowError && <p className="font-body text-sm text-afs-crimson mb-3">{rowError}</p>}

      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="px-4 py-3">
                <button type="button" onClick={() => changeSort('name')} className={sortButtonClass('name')}>
                  Profile Name
                </button>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => changeSort('jobName')} className={sortButtonClass('jobName')}>
                  Job Name
                </button>
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid px-4 py-3">PO</th>
              <th className="px-4 py-3">
                <button type="button" onClick={() => changeSort('created')} className={sortButtonClass('created')}>
                  Date
                </button>
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid px-4 py-3 text-center">
                Thumbnail
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((profile) => (
              <tr key={profile.id} className="group border-b border-afs-border last:border-0 hover:bg-afs-bg-surface transition-colors">
                <td className="px-4 py-3 align-middle">
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
                        className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPreviewId(profile.id)}
                      className="text-left font-body text-sm text-afs-chrome-high hover:text-afs-crimson transition-colors"
                    >
                      {profile.name}
                      {profile.isLocked && (
                        <span className="ml-2 font-label text-[10px] font-bold text-afs-accent-green border border-afs-accent-green rounded px-1.5 py-0.5 align-middle">
                          LOCKED
                        </span>
                      )}
                    </button>
                  )}
                  {isCompanyAccount && <p className="font-body text-[11px] text-afs-chrome-dim mt-0.5">Saved by {profile.ownerName}</p>}
                </td>
                <td className="px-4 py-3 align-middle font-body text-sm text-afs-chrome-mid">{profile.jobName || '—'}</td>
                <td className="px-4 py-3 align-middle font-data text-sm text-afs-chrome-mid">{profile.poNumber || '—'}</td>
                <td className="px-4 py-3 align-middle font-data text-xs text-afs-chrome-mid whitespace-nowrap">
                  {formatDate(profile.createdAt)}
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-center gap-2 relative">
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

                    {/* Actions menu — only visible on row hover (this pass's
                        own explicit ask; the prior sidebar layout showed it
                        always). */}
                    <button
                      type="button"
                      onClick={() => setMenuOpenId((id) => (id === profile.id ? null : profile.id))}
                      aria-label={`Actions for ${profile.name}`}
                      className={`shrink-0 self-start text-afs-chrome-mid hover:text-afs-chrome-high transition-opacity ${
                        menuOpenId === profile.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      ⋮
                    </button>
                    {menuOpenId === profile.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-afs-bg-raised border border-afs-chrome-dim rounded shadow-xl py-1 text-left">
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
