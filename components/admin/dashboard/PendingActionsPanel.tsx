import Link from 'next/link';
import type { PendingActionsSummary } from '@/lib/data/command-center-dashboard';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface ActionPill {
  key: string;
  count: number;
  label: (count: number) => string;
  href: string;
}

interface PendingActionsPanelProps {
  summary: PendingActionsSummary;
}

export default function PendingActionsPanel({ summary }: PendingActionsPanelProps) {
  const pills: ActionPill[] = [
    {
      key: 'quotes',
      count: summary.quotesAwaitingApproval,
      label: (n) => `Quotes Awaiting Approval (${n})`,
      href: '/admin/command-center?tab=pending',
    },
    {
      key: 'pickup',
      count: summary.ordersAwaitingPickup,
      label: (n) => `Orders Awaiting Material Pickup (${n})`,
      href: '/admin/orders-crm',
    },
    {
      key: 'invoices',
      count: summary.overdueInvoiceCount,
      label: (n) => `Invoices Past 30 Days (${n}) — ${currency.format(summary.overdueInvoiceTotal)} overdue`,
      href: '/admin/orders-crm?view=invoices',
    },
  ];

  const active = pills.filter((p) => p.count > 0);

  if (active.length === 0) {
    return <p className="font-body text-sm text-afs-chrome-mid">Nothing needs your attention right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {active.map((pill) => (
        <Link
          key={pill.key}
          href={pill.href}
          className="flex items-center gap-3 rounded border border-afs-crimson/40 bg-[var(--afs-crimson-ghost)] px-4 py-3 hover:border-afs-crimson transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-afs-crimson shrink-0" />
          <span className="font-body text-sm text-afs-chrome-high">{pill.label(pill.count)}</span>
        </Link>
      ))}
    </div>
  );
}
