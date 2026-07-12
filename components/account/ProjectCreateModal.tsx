'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectCreateModalProps {
  triggerClassName?: string;
  triggerLabel?: string;
}

interface CreateProjectResponse {
  id: string;
}
interface ErrorResponse {
  error: string;
}

export default function ProjectCreateModal({ triggerClassName, triggerLabel = 'Create Project' }: ProjectCreateModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobsiteAddress, setJobsiteAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setOpen(false);
    setName('');
    setDescription('');
    setJobsiteAddress('');
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
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, jobsiteAddress }),
      });
      const data = (await res.json()) as CreateProjectResponse | ErrorResponse;
      if (!res.ok) {
        setError('error' in data ? data.error : 'Could not create project.');
        setLoading(false);
        return;
      }
      resetAndClose();
      router.refresh();
    } catch {
      setError('Could not create project. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="create-project-button"
        className={
          triggerClassName ??
          'bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors'
        }
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--afs-bg-modal)] px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[480px] bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-afs-chrome-high">Create Project</h2>
              <button
                type="button"
                onClick={resetAndClose}
                className="text-afs-chrome-mid hover:text-afs-chrome-high"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="project-name"
                  className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5"
                >
                  Project Name
                </label>
                <input
                  id="project-name"
                  name="name"
                  type="text"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                  placeholder="Riverside Commons Phase 2"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="project-description"
                  className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="project-description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body resize-y"
                  placeholder="Optional project notes"
                />
              </div>
              <div>
                <label
                  htmlFor="project-address"
                  className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5"
                >
                  Jobsite Address
                </label>
                <input
                  id="project-address"
                  name="jobsiteAddress"
                  type="text"
                  value={jobsiteAddress}
                  onChange={(e) => setJobsiteAddress(e.target.value)}
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
                  placeholder="Optional — pre-fills delivery in the quote wizard"
                />
              </div>

              {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
