import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import ProjectEditModal from '@/components/account/ProjectEditModal';
import ProjectStatusActions from '@/components/account/ProjectStatusActions';
import ProjectTabs, {
  type ProjectDocumentRow,
  type ProjectOrderRow,
  type ProjectTeamRow,
} from '@/components/account/ProjectTabs';
import { getQuoteRows } from '@/lib/data/quotes';
import type { OrderStatus } from '@/components/account/ProductionTimeline';

type ProjectStatus = 'active' | 'completed' | 'archived';

const STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  active: 'success',
  completed: 'chrome',
  archived: 'chrome',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

interface ProjectDetailRow {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  jobsite_address: string | null;
  created_at: string;
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: projectRaw } = await supabase
    .from('projects')
    .select('id, name, description, status, jobsite_address, created_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!projectRaw) notFound();
  const project = projectRaw as ProjectDetailRow;

  const { data: ordersRaw } = await supabase
    .from('orders')
    .select('id, order_number, status, total, created_at')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const orders: ProjectOrderRow[] = (
    (ordersRaw ?? []) as { id: string; order_number: string; status: OrderStatus; total: number; created_at: string }[]
  ).map((o) => ({ id: o.id, orderNumber: o.order_number, status: o.status, total: o.total, createdAt: o.created_at }));

  const quotes = await getQuoteRows(supabase, user.id, undefined, project.id);

  const { data: documentsRaw } = await supabase
    .from('vault_documents')
    .select('id, filename, file_type, file_size_bytes, created_at')
    .eq('project_id', project.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const documents: ProjectDocumentRow[] = (
    (documentsRaw ?? []) as { id: string; filename: string; file_type: string; file_size_bytes: number; created_at: string }[]
  ).map((d) => ({
    id: d.id,
    filename: d.filename,
    fileType: d.file_type,
    fileSizeBytes: d.file_size_bytes,
    createdAt: d.created_at,
  }));

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

  let team: ProjectTeamRow[] | null = null;
  if (profile?.company_id) {
    const { data: membersRaw } = await supabase
      .from('profiles')
      .select('id, full_name, email, company_role')
      .eq('company_id', profile.company_id);
    team = (
      (membersRaw ?? []) as { id: string; full_name: string; email: string; company_role: string | null }[]
    ).map((m) => ({ id: m.id, fullName: m.full_name, email: m.email, companyRole: m.company_role }));
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <Link href="/account/projects" className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson">
        ← Back to My Projects
      </Link>

      <div className="flex items-start justify-between gap-6 mt-2 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-heading text-3xl text-afs-ink-900">{project.name}</h1>
            <Badge variant={STATUS_VARIANT[project.status]} size="md">
              {STATUS_LABEL[project.status]}
            </Badge>
          </div>
          {project.description && <p className="font-body text-sm text-afs-ink-700 mb-1 max-w-xl">{project.description}</p>}
          {project.jobsite_address && (
            <p className="font-data text-xs text-afs-ink-700">{project.jobsite_address}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3">
            <ProjectEditModal
              projectId={project.id}
              initialName={project.name}
              initialDescription={project.description ?? ''}
              initialJobsiteAddress={project.jobsite_address ?? ''}
            />
            <ProjectStatusActions projectId={project.id} status={project.status} />
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <Link
          href={`/quote?project=${project.id}`}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
        >
          New Quote Request for This Project
        </Link>
        <Link
          href={`/upload?project=${project.id}`}
          className="border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
        >
          Upload Drawing
        </Link>
      </div>

      <ProjectTabs orders={orders} quotes={quotes} documents={documents} team={team} />
    </div>
  );
}
