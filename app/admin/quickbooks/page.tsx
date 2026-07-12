import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getConnectionStatus } from '@/lib/integrations/quickbooks';
import Badge from '@/components/ui/Badge';

const SYNC_FEATURES = [
  {
    name: 'Invoices',
    detail: 'Push AFS invoices to QuickBooks Online when payment is confirmed or a net-terms order is created.',
  },
  {
    name: 'Customers',
    detail: 'Match or create QuickBooks customer records from AFS profile and company data.',
  },
  {
    name: 'Payments',
    detail: 'Reference AFS payment records against synced QuickBooks invoices for reconciliation.',
  },
];

export default async function AdminQuickBooksPage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const status = await getConnectionStatus();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-ink-900">QuickBooks</h1>
        <p className="font-body text-sm text-afs-ink-700 mt-1">
          Sync invoices, customers, and payments to QuickBooks Online.
        </p>
      </div>

      <section className="mb-8">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="font-heading text-base text-afs-ink-900">Connection Status</p>
              <p className="font-body text-xs text-afs-ink-700 mt-1">{status.message}</p>
            </div>
            <Badge variant="chrome">{status.status === 'connected' ? 'Connected' : 'Not Connected'}</Badge>
          </div>
          <button
            type="button"
            disabled
            title="QuickBooks OAuth connect — see SPEC_QUICKBOOKS_INTEGRATION.md"
            className="font-label text-sm text-afs-ink-700 border border-afs-border rounded px-4 py-2.5 cursor-not-allowed inline-flex items-center gap-2"
          >
            Connect QuickBooks
            <Badge variant="chrome">Coming Soon</Badge>
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg text-afs-ink-900 mb-4">What Will Sync</h2>
        <div className="flex flex-col gap-3">
          {SYNC_FEATURES.map((feature) => (
            <div key={feature.name} className="bg-afs-bg-raised border border-afs-border rounded p-5">
              <p className="font-heading text-base text-afs-ink-900 mb-1">{feature.name}</p>
              <p className="font-body text-xs text-afs-ink-700">{feature.detail}</p>
            </div>
          ))}
        </div>
        <p className="font-body text-xs text-afs-ink-700 mt-4">
          Conditional build — blocked on client confirmation of QuickBooks subscription, sync scope, and
          connection ownership. See SPEC_QUICKBOOKS_INTEGRATION.md.
        </p>
      </section>
    </div>
  );
}
