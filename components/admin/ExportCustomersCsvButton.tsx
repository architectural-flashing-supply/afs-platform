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
      // v7's own secondary button. This was a gunmetal control
      // (bg-afs-bg-overlay + afs-chrome-high) and stayed one when Customers
      // moved into the light working area, leaving near-black inherited text on
      // a dark fill at 2.51:1 — caught by tests/e2e/contrast-live.spec.ts,
      // which measures real computed styles and is the half of rule #28 the
      // static gate cannot replace.
      className="btn slate"
    >
      Export CSV
    </button>
  );
}
