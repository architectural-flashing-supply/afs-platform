import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCreditApplications } from '@/lib/data/credit';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import CreditApplicationRowActions from '@/components/admin/CreditApplicationRowActions';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  denied: 'Denied',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  submitted: 'warning',
  under_review: 'info',
  approved: 'success',
  denied: 'error',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AdminCreditApplicationsPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const rows = await getCreditApplications(supabase);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-chrome-high">Credit Applications</h1>
        <p className="font-body text-sm text-afs-chrome-mid mt-1">Net-terms applications submitted by customers.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No applications yet" description="Submitted credit applications will appear here." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Company
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                  Requested
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Status
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Submitted
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                  <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.companyName}</td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                    {row.requestedLimit != null ? `$${row.requestedLimit.toLocaleString()}` : '—'}
                    {row.requestedTerms != null ? ` @ Net ${row.requestedTerms}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'chrome'}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
                  </td>
                  <td className="font-data text-xs text-afs-chrome-dim px-4 py-3">{formatDate(row.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <CreditApplicationRowActions application={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
