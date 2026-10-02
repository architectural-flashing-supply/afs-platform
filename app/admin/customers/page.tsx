import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { getCustomersList, type CustomerListFilters } from '@/lib/data/customers';
import ExportCustomersCsvButton from '@/components/admin/ExportCustomersCsvButton';
import LightWorkingArea from '@/components/admin/LightWorkingArea';
import V7Customers from '@/components/admin/v7/V7Customers';
import { isFixtureMode, type SearchParamValue } from '@/lib/fixtures/mode';
import { fixtureCustomers, liveCustomers } from '@/lib/data/v7-view/customers';

const ROLE_OPTIONS = ['all', 'admin', 'contractor', 'architect', 'customer'];
const TIER_OPTIONS = ['all', 'standard', 'contractor', 'preferred', 'wholesale'];

function isValidOption(options: string[], value: string | undefined): value is string {
  return typeof value === 'string' && options.includes(value);
}

/**
 * CUSTOMERS — v7 `pageCustomers()` (prototype line 1519).
 *
 * THIS REPLACED A FLAT ACCOUNT DIRECTORY, and the whole-screen pixel gate is
 * what forced the question: the directory scored 22% against v7 with twenty
 * landmarks missing and fifteen extra, which is not a styling difference, it is
 * a different screen. v7's is a master-detail — every company down the left,
 * that company's contact, jobs and saved profiles on the right.
 *
 * THE DIRECTORY'S REAL FEATURES ARE KEPT, in v7's own elements: role and
 * pricing-tier filtering sit in v7's `.bar`, CSV export is a page action, and
 * the full per-account record is still one click away at /admin/customers/[id].
 * CLAUDE.md rule #33's split — v7 wins the layout, existing code wins where it
 * supplies behaviour v7 has no equivalent for. The reasoning, and what the live
 * detail pane honestly cannot show, is in lib/data/v7-view/customers.ts.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; tier?: string; c?: string; edit?: string } & Record<
    string,
    SearchParamValue
  >;
}) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  if (isFixtureMode(searchParams)) {
    const picked = Array.isArray(searchParams.c) ? searchParams.c[0] : searchParams.c;
    return (
      <LightWorkingArea>
        <V7Customers view={fixtureCustomers(picked, searchParams.edit === '1')} />
      </LightWorkingArea>
    );
  }

  const filters: CustomerListFilters = {
    search: searchParams.q ?? '',
    role: isValidOption(ROLE_OPTIONS, searchParams.role) ? searchParams.role : 'all',
    tier: isValidOption(TIER_OPTIONS, searchParams.tier) ? searchParams.tier : 'all',
  };

  const rows = await getCustomersList(supabase, filters);
  const picked = Array.isArray(searchParams.c) ? searchParams.c[0] : searchParams.c;

  return (
    <LightWorkingArea>
      <V7Customers
        view={liveCustomers(rows, filters, picked)}
        exportButton={<ExportCustomersCsvButton rows={rows} />}
      />
    </LightWorkingArea>
  );
}
