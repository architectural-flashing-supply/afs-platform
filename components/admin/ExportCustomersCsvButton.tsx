'use client';

import type { CustomerListRow } from '@/lib/data/customers';

interface ExportCustomersCsvButtonProps {
  rows: CustomerListRow[];
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExportCustomersCsvButton({ rows }: ExportCustomersCsvButtonProps) {
  function handleExport() {
    const header = ['Name', 'Company', 'Email', 'Role', 'Pricing Tier', 'Total Orders', 'Last Order'];
    const lines = rows.map((row) =>
      [row.fullName, row.company ?? '', row.email, row.role, row.pricingTier, String(row.totalOrders), formatDate(row.lastOrderAt)]
        .map(csvEscape)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `afs-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Export CSV
    </button>
  );
}
