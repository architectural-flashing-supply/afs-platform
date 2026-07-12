import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DocumentUploadForm from '@/components/account/DocumentUploadForm';
import DocumentDownloadButton from '@/components/account/DocumentDownloadButton';
import DocumentDeleteButton from '@/components/account/DocumentDeleteButton';

interface VaultDocumentRow {
  id: string;
  project_id: string | null;
  folder_name: string | null;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildProjectHref(projectId: string): string {
  return projectId ? `/account/documents?project=${projectId}` : '/account/documents';
}

export default async function AccountDocumentsPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: projectsRaw } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true });
  const projects = (projectsRaw ?? []) as ProjectOption[];

  const selectedProjectId = searchParams.project ?? '';

  let query = supabase
    .from('vault_documents')
    .select('id, project_id, folder_name, filename, file_type, file_size_bytes, created_at')
    .eq('user_id', user.id);

  if (selectedProjectId) query = query.eq('project_id', selectedProjectId);

  const { data: documentsRaw } = await query.order('created_at', { ascending: false });
  const documents = (documentsRaw ?? []) as VaultDocumentRow[];

  const folders = new Map<string, VaultDocumentRow[]>();
  for (const doc of documents) {
    const key = doc.folder_name?.trim() || 'Unfiled';
    if (!folders.has(key)) folders.set(key, []);
    folders.get(key)!.push(doc);
  }
  const sortedFolderNames = Array.from(folders.keys()).sort((a, b) =>
    a === 'Unfiled' ? 1 : b === 'Unfiled' ? -1 : a.localeCompare(b)
  );

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-ink-900">Project Documents</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">
            Drawings, specs, submittals, and RFIs — organized by project and folder.
          </p>
        </div>
        <DocumentUploadForm projects={projects} defaultProjectId={selectedProjectId || undefined} />
      </div>

      {projects.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap" data-testid="project-filter">
          <Link
            href={buildProjectHref('')}
            className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
              !selectedProjectId
                ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
                : 'border-afs-chrome-dim text-afs-ink-700 hover:bg-afs-bg-surface'
            }`}
          >
            All Projects
          </Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={buildProjectHref(p.id)}
              className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
                selectedProjectId === p.id
                  ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
                  : 'border-afs-chrome-dim text-afs-ink-700 hover:bg-afs-bg-surface'
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
          <h3 className="font-heading text-xl text-afs-ink-900 mb-2">No documents yet.</h3>
          <p className="font-body text-sm text-afs-ink-700 mb-6 max-w-md mx-auto">
            Upload drawings, specs, and submittals to keep everything organized.
          </p>
          <div className="flex justify-center">
            <DocumentUploadForm projects={projects} defaultProjectId={selectedProjectId || undefined} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {sortedFolderNames.map((folderName) => (
            <div key={folderName}>
              <h2 className="font-heading text-sm uppercase tracking-wide text-afs-ink-700 mb-3">
                {folderName} <span className="font-data text-xs text-afs-ink-700">({folders.get(folderName)!.length})</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {folders.get(folderName)!.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-chrome-dim rounded px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-sm text-afs-ink-900 truncate" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <p className="font-data text-xs text-afs-ink-700">
                        {doc.file_type.replace('.', '').toUpperCase()} · {formatFileSize(doc.file_size_bytes)} ·{' '}
                        {formatDate(doc.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <DocumentDownloadButton documentId={doc.id} />
                      <DocumentDeleteButton documentId={doc.id} filename={doc.filename} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
