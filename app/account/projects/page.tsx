import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import ProjectCreateModal from '@/components/account/ProjectCreateModal';

type ProjectStatus = 'active' | 'completed' | 'archived';
type FilterTab = 'active' | 'all' | 'archived';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'all', label: 'All' },
  { key: 'archived', label: 'Archived' },
];

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

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  jobsite_address: string | null;
  created_at: string;
}

function buildTabHref(tab: FilterTab): string {
  return tab === 'active' ? '/account/projects' : `/account/projects?filter=${tab}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AccountProjectsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeTab: FilterTab = searchParams.filter === 'all' || searchParams.filter === 'archived' ? searchParams.filter : 'active';

  let query = supabase
    .from('projects')
    .select('id, name, description, status, jobsite_address, created_at')
    .eq('user_id', user.id);

  if (activeTab === 'active') query = query.eq('status', 'active');
  else if (activeTab === 'archived') query = query.eq('status', 'archived');

  const { data: projectsRaw } = await query.order('created_at', { ascending: false });
  const projects = (projectsRaw ?? []) as ProjectRow[];

  const orderCounts = new Map<string, number>();
  if (projects.length > 0) {
    const { data: ordersRaw } = await supabase
      .from('orders')
      .select('project_id')
      .eq('user_id', user.id)
      .in(
        'project_id',
        projects.map((p) => p.id)
      );
    for (const row of (ordersRaw ?? []) as { project_id: string | null }[]) {
      if (!row.project_id) continue;
      orderCounts.set(row.project_id, (orderCounts.get(row.project_id) ?? 0) + 1);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-ink-900">My Projects</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">
            Organize quote requests, orders, and documents by job.
          </p>
        </div>
        <ProjectCreateModal />
      </div>

      <div className="flex gap-2 mb-6" data-testid="project-filter-tabs">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={buildTabHref(tab.key)}
            className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
              activeTab === tab.key
                ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
                : 'border-afs-chrome-dim text-afs-ink-700 hover:bg-afs-bg-surface'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
          <h3 className="font-heading text-xl text-afs-ink-900 mb-2">No projects yet</h3>
          <p className="font-body text-sm text-afs-ink-700 mb-6 max-w-md mx-auto">
            Create a project to organize quote requests, orders, and documents by job.
          </p>
          <div className="flex justify-center">
            <ProjectCreateModal />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/account/projects/${project.id}`}
              className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-5 hover:border-afs-crimson transition-colors flex flex-col gap-3"
              data-testid="project-card"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-heading text-lg text-afs-ink-900 leading-tight">{project.name}</h2>
                <Badge variant={STATUS_VARIANT[project.status]}>{STATUS_LABEL[project.status]}</Badge>
              </div>
              {project.description && (
                <p className="font-body text-sm text-afs-ink-700 line-clamp-2">{project.description}</p>
              )}
              {project.jobsite_address && (
                <p className="font-data text-xs text-afs-ink-700 truncate">{project.jobsite_address}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-afs-chrome-dim">
                <span className="font-data text-xs text-afs-ink-700">
                  {orderCounts.get(project.id) ?? 0} order{(orderCounts.get(project.id) ?? 0) === 1 ? '' : 's'}
                </span>
                <span className="font-data text-xs text-afs-ink-700">Created {formatDate(project.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
