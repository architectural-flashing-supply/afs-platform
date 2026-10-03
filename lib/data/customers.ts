import type { SupabaseClient } from '@supabase/supabase-js';

export interface CustomerListRow {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  role: string;
  pricingTier: string;
  totalOrders: number;
  lastOrderAt: string | null;
}

export interface CustomerListFilters {
  search: string;
  role: string;
  tier: string;
}

interface CustomerListSource {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  role: string;
  pricing_tier: string;
}

/**
 * Order count and last-order-date are aggregated in JS rather than a SQL GROUP BY —
 * matches the aggregation style already used in lib/data/admin.ts (getDashboardAlerts)
 * and is fine at AFS's expected admin-customer scale.
 */
export async function getCustomersList(
  supabase: SupabaseClient,
  filters: CustomerListFilters
): Promise<CustomerListRow[]> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, company, email, role, pricing_tier')
    .order('created_at', { ascending: false });

  if (filters.role !== 'all') {
    query = query.eq('role', filters.role);
  }
  if (filters.tier !== 'all') {
    query = query.eq('pricing_tier', filters.tier);
  }
  if (filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`full_name.ilike.${term},company.ilike.${term},email.ilike.${term}`);
  }

  const { data } = await query;
  const profiles = (data ?? []) as CustomerListSource[];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: orderRows } = await supabase.from('orders').select('user_id, created_at').in('user_id', ids);

  const ordersByUser = new Map<string, { count: number; last: string | null }>();
  for (const row of (orderRows ?? []) as { user_id: string; created_at: string }[]) {
    const entry = ordersByUser.get(row.user_id) ?? { count: 0, last: null };
    entry.count += 1;
    if (!entry.last || row.created_at > entry.last) entry.last = row.created_at;
    ordersByUser.set(row.user_id, entry);
  }

  return profiles.map((p) => {
    const agg = ordersByUser.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      company: p.company,
      email: p.email,
      role: p.role,
      pricingTier: p.pricing_tier,
      totalOrders: agg?.count ?? 0,
      lastOrderAt: agg?.last ?? null,
    };
  });
}

/**
 * The `companies` row this customer belongs to, when they belong to one.
 *
 * `profiles.company` is a free-text string the customer typed at sign-up;
 * `profiles.company_id` is a real FK to a `companies` row, set only by the Team
 * Accounts flow. They are different things and must not be conflated: the
 * PO requirement is a column on the real row, so a customer with a `company`
 * string but no `company_id` has nowhere to put one.
 */
export interface CustomerCompany {
  id: string;
  name: string;
  /** `companies.require_po` — SPEC_PURCHASE_ORDER_INTEGRATION.md §3. */
  requirePo: boolean;
}

export interface CustomerDetail {
  id: string;
  fullName: string;
  company: string | null;
  email: string;
  phone: string | null;
  role: string;
  pricingTier: string;
  netTerms: number;
  creditLimit: number | null;
  taxExempt: boolean;
  createdAt: string;
  internalNotes: string | null;
  /** null when this customer has no `companies` row behind them. */
  companyAccount: CustomerCompany | null;
}

interface CustomerDetailSource {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  role: string;
  pricing_tier: string;
  net_terms: number;
  credit_limit: number | null;
  tax_exempt: boolean;
  created_at: string;
  internal_notes: string | null;
  company_id: string | null;
}

interface CompanyAccountSource {
  id: string;
  name: string;
  require_po: boolean;
}

export async function getCustomerDetail(supabase: SupabaseClient, id: string): Promise<CustomerDetail | null> {
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, full_name, company, email, phone, role, pricing_tier, net_terms, credit_limit, tax_exempt, created_at, internal_notes, company_id'
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  const row = data as CustomerDetailSource;

  // A SECOND QUERY, NOT A POSTGREST EMBED: `profiles` and `companies` are
  // joined by two foreign keys (profiles.company_id -> companies.id and
  // companies.primary_user_id -> profiles.id), so an embedded select is
  // ambiguous and would need an explicit constraint-name hint.
  //
  // Callers of this function are already admin-gated (app/admin/customers/[id]
  // runs requireAdminUser; the API route checks profiles.role), and the
  // companies "admin_all_companies" policy covers the read.
  let companyAccount: CustomerCompany | null = null;
  if (row.company_id) {
    const { data: companyRaw } = await supabase
      .from('companies')
      .select('id, name, require_po')
      .eq('id', row.company_id)
      .maybeSingle();
    if (companyRaw) {
      const companyRow = companyRaw as CompanyAccountSource;
      companyAccount = {
        id: companyRow.id,
        name: companyRow.name,
        requirePo: companyRow.require_po === true,
      };
    }
  }

  return {
    id: row.id,
    fullName: row.full_name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    role: row.role,
    pricingTier: row.pricing_tier,
    netTerms: row.net_terms,
    creditLimit: row.credit_limit,
    taxExempt: row.tax_exempt,
    createdAt: row.created_at,
    internalNotes: row.internal_notes,
    companyAccount,
  };
}

export interface CustomerOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

export async function getCustomerOrders(supabase: SupabaseClient, userId: string): Promise<CustomerOrderRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, total, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return ((data ?? []) as { id: string; order_number: string; status: string; total: number; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      total: row.total,
      createdAt: row.created_at,
    })
  );
}

export interface CustomerNote {
  text: string;
  author: string;
  at: string;
}

/**
 * profiles has no notes column, so AdminNotesLog reuses admin_audit_log the same
 * way order-detail notes reuse the orders.admin_notes JSON pattern — every note is
 * an append-only 'add_customer_note' audit entry keyed to this profile.
 */
export async function getCustomerNotes(supabase: SupabaseClient, customerId: string): Promise<CustomerNote[]> {
  const { data } = await supabase
    .from('admin_audit_log')
    .select('after_value, created_at, profiles(full_name)')
    .eq('resource_type', 'profile')
    .eq('resource_id', customerId)
    .eq('action', 'add_customer_note')
    .order('created_at', { ascending: false });

  return (
    (data ?? []) as unknown as {
      after_value: { note?: string } | null;
      created_at: string;
      profiles: { full_name: string } | null;
    }[]
  ).map((row) => ({
    text: row.after_value?.note ?? '',
    author: row.profiles?.full_name ?? 'Admin',
    at: row.created_at,
  }));
}
