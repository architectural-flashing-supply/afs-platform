import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCustomersList, type CustomerListFilters } from '@/lib/data/customers';
import ExportCustomersCsvButton from '@/components/admin/ExportCustomersCsvButton';
import LightWorkingArea from '@/components/admin/LightWorkingArea';

const ROLE_OPTIONS = ['all', 'admin', 'contractor', 'architect', 'customer'];
const TIER_OPTIONS = ['all', 'standard', 'contractor', 'preferred', 'wholesale'];

/**
 * v7's own pill modifiers (`.pill.r/.a/.g/.b/.v`), as a map to the WHOLE
 * className. The contrast gate expands class maps but counts a runtime template
 * as `unresolved` — CLAUDE.md rule #28.
 */
const ROLE_PILL: Record<string, string> = {
  admin: 'pill r',
  architect: 'pill b',
  contractor: 'pill',
  customer: 'pill',
};

const TIER_PILL: Record<string, string> = {
  wholesale: 'pill g',
  preferred: 'pill b',
  contractor: 'pill',
  standard: 'pill',
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
    // STAGE G — Customers in v7's look. `.greet`, `.bar`/`.fld` filters and a
    // bare <table> inside a `.panel`, all of which v7 styles itself.
    //
    // ONE DELIBERATE DEPARTURE FROM v7's LAYOUT, recorded rather than hidden.
    // v7's `pageCustomers()` (line 1519) is a master-detail: a `.cgrid` with a
    // customer list on the left and, on the right, that customer's contact
    // details, their jobs and their saved profiles. This page is an ACCOUNT
    // DIRECTORY — every registered account, filtered by role and pricing tier,
    // with CSV export — and none of those three things exist in v7, which has
    // no roles, no tiers and no export. Rendering a directory as a
    // master-detail would mean either dropping real features or inventing
    // per-customer queries nobody asked for. So the DATA and the ACTIONS are
    // kept and v7's own components carry them. The per-customer detail view
    // v7 shows on the right already exists here as its own route,
    // /admin/customers/[id], which each name links to.
    <LightWorkingArea>
      <div className="greet">
        <div>
          <h1 className="t">Customers</h1>
          <p className="sub">Every registered account — contractors, architects, and customers.</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <ExportCustomersCsvButton rows={rows} />
        </div>
      </div>

      {/* Command Center V2 (prompt v2-01, step 5): Customers ABSORBS the
          orders CRM. The one-level nav has no separate "Orders" slot, and
          the CRM view (customer record, dispatch, invoicing) is a customer
          view, so this is where it belongs. */}
      <Link href="/admin/orders-crm" className="rl">
        <div className="tx">
          <b>Orders &amp; invoicing</b>
          <span>Order records, dispatch and invoicing, by customer.</span>
        </div>
        <span className="btn slate sm">Open &rarr;</span>
      </Link>

      <form method="GET" className="bar">
        <label className="fld q">
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Search name, company, or email…"
            autoComplete="off"
          />
        </label>
        <label className="fld">
          Role
          <select name="role" defaultValue={filters.role}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="fld">
          Tier
          <select name="tier" defaultValue={filters.tier}>
            {TIER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All Tiers' : t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn red">
          Filter
        </button>
        {(filters.search || filters.role !== 'all' || filters.tier !== 'all') && (
          <Link href="/admin/customers" className="linkbtn">
            Clear all
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="none">No customers match this filter. Try a different search term or clear the filters.</div>
      ) : (
        <section className="panel">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Tier</th>
                  <th className="n">Orders</th>
                  <th>Last Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/customers/${row.id}`} className="linkcell">
                        {row.fullName}
                      </Link>
                    </td>
                    <td>{row.company ?? '—'}</td>
                    <td>{row.email}</td>
                    <td>
                      <span className={ROLE_PILL[row.role] ?? 'pill'}>{row.role}</span>
                    </td>
                    <td>
                      <span className={TIER_PILL[row.pricingTier] ?? 'pill'}>{row.pricingTier}</span>
                    </td>
                    <td className="n">{row.totalOrders}</td>
                    <td>{formatDate(row.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </LightWorkingArea>
  );
}
