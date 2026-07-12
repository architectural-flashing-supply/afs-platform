import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { getInvoiceRows, type InvoiceStatus } from '@/lib/data/invoices';

type FilterTab = 'all' | 'paid' | 'outstanding';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'outstanding', label: 'Outstanding' },
];

const STATUS_VARIANT: Record<InvoiceStatus, BadgeVariant> = {
  paid: 'success',
  due: 'warning',
  overdue: 'error',
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusDisplay(status: InvoiceStatus, dueDate: string | null): string {
  if (status === 'overdue') return 'Overdue';
  if (status === 'due') return `Due ${dueDate ? formatDate(dueDate) : ''}`.trim();
  return 'Paid';
}

function buildTabHref(tab: FilterTab): string {
  return tab === 'all' ? '/account/invoices' : `/account/invoices?filter=${tab}`;
}

export default async function AccountInvoicesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const activeTab: FilterTab = searchParams.filter === 'paid' || searchParams.filter === 'outstanding' ? searchParams.filter : 'all';

  const allInvoices = await getInvoiceRows(supabase, user.id);
  const invoices =
    activeTab === 'paid'
      ? allInvoices.filter((row) => row.status === 'paid')
      : activeTab === 'outstanding'
      ? allInvoices.filter((row) => row.status !== 'paid')
      : allInvoices;

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-ink-900">Invoices</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">
            AFS-generated invoices for every order — download PDFs for job costing and lender documentation.
          </p>
        </div>
        <a
          href="/api/invoices/statement"
          data-testid="download-statement"
          className="border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
        >
          Download Account Statement
        </a>
      </div>

      <div className="flex gap-2 mb-6" data-testid="invoice-filter-tabs">
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

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices appear here once AFS delivers a formal quote and you complete checkout."
          actionLabel="Request a Quote"
          actionHref="/quote"
        />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Invoice #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Order #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Date
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">
                  Amount
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Status
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                  <td className="font-data text-sm text-afs-ink-900 px-4 py-3">{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/account/orders/${invoice.orderId}`}
                      className="font-data text-sm text-afs-crimson hover:text-afs-crimson-hover"
                    >
                      {invoice.orderNumber}
                    </Link>
                  </td>
                  <td className="font-data text-sm text-afs-ink-700 px-4 py-3">{formatDate(invoice.date)}</td>
                  <td className="font-data text-sm text-afs-ink-900 text-right px-4 py-3">{currency.format(invoice.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[invoice.status]}>{statusDisplay(invoice.status, invoice.dueDate)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      data-testid="download-invoice"
                      className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson transition-colors"
                    >
                      Download PDF
                    </a>
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
