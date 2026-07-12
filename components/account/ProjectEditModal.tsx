'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectEditModalProps {
  projectId: string;
  initialName: string;
  initialDescription: string;
  initialJobsiteAddress: string;
}

export default function ProjectEditModal({
  projectId,
  initialName,
  initialDescription,
  initialJobsiteAddress,
}: ProjectEditModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [jobsiteAddress, setJobsiteAddress] = useState(initialJobsiteAddress);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, jobsiteAddress }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Could not update project.');
        setLoading(false);
        return;
      }
      close();
      router.refresh();
    } catch {
      setError('Could not update project. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-4 py-2 rounded text-sm transition-colors"
      >
        Edit
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--afs-bg-modal)] px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[480px] bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-afs-chrome-high">Edit Project</h2>
              <button
                type="button"
                onClick={close}
                className="text-afs-chrome-mid hover:text-afs-chrome-high"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="edit-project-name"
                  className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5"
                >
                  Project Name
                </label>
                <input
                  id="edit-project-name"
                  type="text"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="edit-project-description"
                  className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="edit-project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body resize-y"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-project-address"
                  className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5"
                >
                  Jobsite Address
                </label>
                <input
                  id="edit-project-address"
                  type="text"
                  value={jobsiteAddress}
                  onChange={(e) => setJobsiteAddress(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                />
              </div>

              {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={close}
                  className="border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
