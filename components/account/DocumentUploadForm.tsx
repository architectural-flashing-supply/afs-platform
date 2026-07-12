'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface DocumentUploadFormProps {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}

export default function DocumentUploadForm({ projects, defaultProjectId }: DocumentUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
    setLoading(false);
    setFolderName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      setError('Choose at least one file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) formData.append('projectId', projectId);
      if (folderName.trim()) formData.append('folderName', folderName.trim());

      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Failed to upload ${file.name}.`);
        setLoading(false);
        return;
      }
    }

    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="upload-files-button"
        className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
      >
        Upload Files
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--afs-bg-modal)] px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[480px] bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-afs-ink-900">Upload Files</h2>
              <button type="button" onClick={close} className="text-afs-ink-700 hover:text-afs-ink-900" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="doc-files" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
                  Files
                </label>
                <input
                  id="doc-files"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 font-body file:mr-3 file:bg-afs-bg-surface file:border-0 file:rounded file:px-3 file:py-1.5 file:font-label file:text-xs file:text-afs-ink-900"
                />
                <p className="font-body text-xs text-afs-ink-700 mt-1">
                  PDF, DWG, DXF, images, Office docs, CSV, ZIP — up to 100MB each.
                </p>
              </div>

              {projects.length > 0 && (
                <div>
                  <label htmlFor="doc-project" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
                    Project
                  </label>
                  <select
                    id="doc-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="doc-folder" className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5">
                  Folder
                </label>
                <input
                  id="doc-folder"
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. Submittals, RFIs, Change Orders"
                  className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body"
                />
              </div>

              {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={close}
                  className="border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
