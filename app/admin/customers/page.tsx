import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCustomersList, type CustomerListFilters } from '@/lib/data/customers';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ExportCustomersCsvButton from '@/components/admin/ExportCustomersCsvButton';

const ROLE_OPTIONS = ['all', 'admin', 'contractor', 'architect', 'customer'];
const TIER_OPTIONS = ['all', 'standard', 'contractor', 'preferred', 'wholesale'];

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  admin: 'error',
  architect: 'info',
  contractor: 'chrome',
  customer: 'chrome',
};

const TIER_VARIANT: Record<string, BadgeVariant> = {
  wholesale: 'success',
  preferred: 'info',
  contractor: 'chrome',
  standard: 'chrome',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isValidOption(options: string[], value: string | undefined): value is string {
  return typeof value === 'string' && options.includes(value);
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; tier?: string };
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const filters: CustomerListFilters = {
    search: searchParams.q ?? '',
    role: isValidOption(ROLE_OPTIONS, searchParams.role) ? searchParams.role : 'all',
    tier: isValidOption(TIER_OPTIONS, searchParams.tier) ? searchParams.tier : 'all',
  };

  const rows = await getCustomersList(supabase, filters);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl text-afs-chrome-high">Customers</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">
            Every registered account — contractors, architects, and customers.
          </p>
        </div>
        <ExportCustomersCsvButton rows={rows} />
      </div>

      <form method="GET" className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={filters.search}
          placeholder="Search name, company, or email…"
          className="flex-1 min-w-[240px] bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        />
        <select
          name="role"
          defaultValue={filters.role}
          className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <select
          name="tier"
          defaultValue={filters.tier}
          className="bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body"
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All Tiers' : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors"
        >
          Filter
        </button>
        {(filters.search || filters.role !== 'all' || filters.tier !== 'all') && (
          <Link href="/admin/customers" className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson">
            Clear all
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No customers match this filter" description="Try a different search term or clear the filters." />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-border">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Name</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Company
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Email</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Role</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Tier</th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                  Orders
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                  Last Order
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-afs-border last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${row.id}`} className="font-body text-sm text-afs-chrome-high hover:text-afs-crimson">
                      {row.fullName}
                    </Link>
                  </td>
                  <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{row.company ?? '—'}</td>
                  <td className="font-data text-xs text-afs-chrome-mid px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_VARIANT[row.role] ?? 'chrome'}>{row.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={TIER_VARIANT[row.pricingTier] ?? 'chrome'}>{row.pricingTier}</Badge>
                  </td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">{row.totalOrders}</td>
                  <td className="font-data text-xs text-afs-chrome-dim px-4 py-3">{formatDate(row.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
