import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeProfiles } from './quotes';

export interface KPIStat {
  count: number;
  rush: number;
}

export interface DashboardKPIs {
  todayOrders: KPIStat;
  inProduction: KPIStat;
  readyToShip: KPIStat;
  pendingQuotes: KPIStat;
}

function summarizeRushRows(rows: { is_rush: boolean | null }[] | null): KPIStat {
  const list = rows ?? [];
  return { count: list.length, rush: list.filter((r) => r.is_rush).length };
}

export async function getDashboardKPIs(supabase: SupabaseClient): Promise<DashboardKPIs> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayOrders, inProduction, readyToShip, pendingQuotes] = await Promise.all([
    supabase.from('orders').select('is_rush').gte('created_at', startOfToday.toISOString()),
    supabase.from('orders').select('is_rush').in('status', ['cutting', 'bending', 'qc']),
    supabase.from('orders').select('is_rush').eq('status', 'ready'),
    supabase.from('quote_requests').select('is_rush').eq('status', 'submitted'),
  ]);

  return {
    todayOrders: summarizeRushRows(todayOrders.data),
    inProduction: summarizeRushRows(inProduction.data),
    readyToShip: summarizeRushRows(readyToShip.data),
    pendingQuotes: summarizeRushRows(pendingQuotes.data),
  };
}

export interface DashboardAlerts {
  marginRiskCount: number;
  overdueInvoicesCount: number;
  pendingCreditApps: number;
}

interface NetTermsOrderSource {
  created_at: string;
  net_terms: number;
}

export async function getDashboardAlerts(supabase: SupabaseClient): Promise<DashboardAlerts> {
  const [marginRisk, netTermsOrders, creditApps] = await Promise.all([
    supabase.from('pricing_trend_analysis').select('id').eq('margin_risk_flag', true),
    supabase.from('orders').select('created_at, net_terms').eq('payment_method', 'net_terms').gt('net_terms', 0),
    supabase.from('credit_applications').select('id').eq('status', 'submitted'),
  ]);

  const now = Date.now();
  const overdueInvoicesCount = ((netTermsOrders.data ?? []) as NetTermsOrderSource[]).filter((order) => {
    const due = new Date(order.created_at);
    due.setDate(due.getDate() + order.net_terms);
    return now > due.getTime();
  }).length;

  return {
    marginRiskCount: marginRisk.data?.length ?? 0,
    overdueInvoicesCount,
    pendingCreditApps: creditApps.data?.length ?? 0,
  };
}

export interface QuoteRequestQueueRow {
  id: string;
  requestNumber: string;
  customerName: string;
  profileSummary: string;
  submittedAt: string;
  isRush: boolean;
}

interface QuoteRequestQueueSource {
  id: string;
  request_number: string;
  guest_email: string | null;
  is_rush: boolean;
  submitted_at: string;
  line_items: unknown;
  profiles: { full_name: string; company: string | null } | null;
}

export async function getQuoteRequestQueue(
  supabase: SupabaseClient,
  limit = 5
): Promise<QuoteRequestQueueRow[]> {
  const { data } = await supabase
    .from('quote_requests')
    .select('id, request_number, guest_email, is_rush, submitted_at, line_items, profiles(full_name, company)')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as QuoteRequestQueueSource[]).map((row) => ({
    id: row.id,
    requestNumber: row.request_number,
    customerName: row.profiles?.company || row.profiles?.full_name || row.guest_email || 'Guest',
    profileSummary: summarizeProfiles(row.line_items),
    submittedAt: row.submitted_at,
    isRush: row.is_rush,
  }));
}

export type QuoteRequestStatusFilter = 'all' | 'submitted' | 'reviewing' | 'quoted';

export interface QuoteRequestListRow {
  id: string;
  requestNumber: string;
  customerName: string;
  profileSummary: string;
  submittedAt: string;
  isRush: boolean;
  status: string;
}

interface QuoteRequestListSource {
  id: string;
  request_number: string;
  guest_email: string | null;
  is_rush: boolean;
  submitted_at: string;
  status: string;
  line_items: unknown;
  profiles: { full_name: string; company: string | null } | null;
}

/**
 * Full admin queue behind /admin/quote-requests. Rush orders always sort to
 * top per SPEC_PRODUCTION_QUEUE.md section 3; within each group, oldest-submitted
 * is prioritized first since that request has been waiting longest.
 */
export async function getQuoteRequestsQueue(
  supabase: SupabaseClient,
  statusFilter: QuoteRequestStatusFilter
): Promise<QuoteRequestListRow[]> {
  let query = supabase
    .from('quote_requests')
    .select('id, request_number, guest_email, is_rush, submitted_at, status, line_items, profiles(full_name, company)')
    .order('is_rush', { ascending: false })
    .order('submitted_at', { ascending: true });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data } = await query;

  return ((data ?? []) as unknown as QuoteRequestListSource[]).map((row) => ({
    id: row.id,
    requestNumber: row.request_number,
    customerName: row.profiles?.company || row.profiles?.full_name || row.guest_email || 'Guest',
    profileSummary: summarizeProfiles(row.line_items),
    submittedAt: row.submitted_at,
    isRush: row.is_rush,
    status: row.status,
  }));
}

export interface RecentOrderActivityRow {
  id: string;
  orderNumber: string;
  status: string;
  changedByName: string | null;
  createdAt: string;
}

interface RecentOrderActivitySource {
  id: string;
  status: string;
  created_at: string;
  orders: { order_number: string } | null;
  profiles: { full_name: string } | null;
}

export async function getRecentOrderActivity(
  supabase: SupabaseClient,
  limit = 10
): Promise<RecentOrderActivityRow[]> {
  const { data } = await supabase
    .from('order_status_history')
    .select('id, status, created_at, orders(order_number), profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown as RecentOrderActivitySource[]).map((row) => ({
    id: row.id,
    orderNumber: row.orders?.order_number ?? 'Unknown',
    status: row.status,
    changedByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
  }));
}
