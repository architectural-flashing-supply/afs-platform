import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/ui/EmptyState';
import UseTemplateButton from '@/components/account/UseTemplateButton';
import TemplateCreateModal from '@/components/account/TemplateCreateModal';

interface TemplateItem {
  profileType: string;
}

interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_company_shared: boolean;
  items: TemplateItem[] | null;
  use_count: number;
  updated_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AccountTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();

  const { data: ownRaw } = await supabase
    .from('quote_templates')
    .select('id, user_id, name, description, is_company_shared, items, use_count, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  let sharedRaw: TemplateRow[] = [];
  if (profile?.company_id) {
    const { data } = await supabase
      .from('quote_templates')
      .select('id, user_id, name, description, is_company_shared, items, use_count, updated_at')
      .eq('company_id', profile.company_id)
      .eq('is_company_shared', true)
      .neq('user_id', user.id);
    sharedRaw = (data ?? []) as TemplateRow[];
  }

  const templates = [...((ownRaw ?? []) as TemplateRow[]), ...sharedRaw];

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Saved Templates</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            Reuse standard flashing packages instead of re-entering the same specification every job.
          </p>
        </div>
        <TemplateCreateModal hasCompany={Boolean(profile?.company_id)} />
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No saved templates yet"
          description="Save a quote request as a template, or build one from scratch, to reorder the same package with near-zero friction."
          actionLabel="Request a Quote"
          actionHref="/quote"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((template) => {
            const itemCount = template.items?.length ?? 0;
            return (
              <div
                key={template.id}
                className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-5 flex flex-col gap-3"
                data-testid="template-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-heading text-lg text-afs-chrome-high leading-tight">{template.name}</h2>
                  {template.is_company_shared && (
                    <span className="font-label text-xs uppercase tracking-wide text-afs-copper border border-afs-copper rounded px-2 py-0.5 shrink-0">
                      Company
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="font-body text-sm text-afs-chrome-mid line-clamp-2">{template.description}</p>
                )}
                <div className="flex items-center gap-3 font-data text-xs text-afs-chrome-dim">
                  <span>
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span>
                    Used {template.use_count} time{template.use_count === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="font-data text-xs text-afs-chrome-dim">Last updated {formatDate(template.updated_at)}</p>
                <div className="mt-auto pt-3 border-t border-afs-chrome-dim">
                  <UseTemplateButton templateId={template.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
