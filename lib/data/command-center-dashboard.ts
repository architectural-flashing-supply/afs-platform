import type { SupabaseClient } from '@supabase/supabase-js';
import { ORDER_STAGES, STATUS_LABEL, stageIndex, type OrderStageKey } from '@/lib/admin/orderStages';
import { getProductionQueue } from '@/lib/data/orders';
import { getCrmInvoices } from '@/lib/data/command-center-crm';

// Phase 2 (Command Center redesign, afs-cc-001) — this file previously held
// the old dashboard's getOrderStatusCounts/getGbpPendingCount/
// getRecentQuoteRequests. All three had exactly one caller
// (app/admin/command-center/page.tsx), which no longer needs them now that
// the dashboard they fed has been replaced entirely — removed rather than
// left as dead exports. getGbpPhotos (a different function, in
// lib/data/command-center-crm.ts) still powers /admin/gbp-photos and is
// untouched.

const IN_PRODUCTION_STATUSES = ['in_queue', 'cutting', 'bending', 'qc', 'in_production'];
const READY_STATUSES = ['ready', 'packaged'];
const ISSUED_QUOTE_STATUSES = ['sent', 'approved', 'expired', 'converted', 'cancelled'];

function startOfMonth(monthsAgo = 0): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

// ── Metric 1 — Quote-to-Order Conversion ────────────────────────────────────
export interface ConversionMetric {
  ratePct: number; // this (partial) month's conversion rate, 0-100
  trend: number[]; // oldest -> newest, one point per of the last 3 calendar months
  issuedThisMonth: number;
}

/**
 * "Issued" = every quote that actually reached the customer or beyond
 * (quotes.status IN sent/approved/expired/converted/cancelled) — excludes
 * 'draft', which by definition was never sent and can't have converted.
 * "Converted" = status = 'converted' (createOrderFromQuote sets this the
 * moment an order is created — lib/data/orders.ts).
 */
export async function getQuoteToOrderConversion(supabase: SupabaseClient): Promise<ConversionMetric> {
  const since = startOfMonth(2);
  const { data } = await supabase.from('quotes').select('status, created_at').gte('created_at', since.toISOString());
  const rows = (data ?? []) as { status: string; created_at: string }[];

  const trend: number[] = [];
  let issuedThisMonth = 0;
  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    const from = startOfMonth(monthsAgo);
    const to = monthsAgo === 0 ? new Date() : startOfMonth(monthsAgo - 1);
    const bucket = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= from.getTime() && t < to.getTime();
    });
    const issued = bucket.filter((r) => ISSUED_QUOTE_STATUSES.includes(r.status));
    const converted = issued.filter((r) => r.status === 'converted');
    trend.push(issued.length === 0 ? 0 : Math.round((converted.length / issued.length) * 100));
    if (monthsAgo === 0) issuedThisMonth = issued.length;
  }

  return { ratePct: trend[trend.length - 1] ?? 0, trend, issuedThisMonth };
}

// ── Metric 2 — Average Order Value ──────────────────────────────────────────
export interface AverageOrderValueMetric {
  avgThisMonth: number;
  pctChangeVsLastMonth: number | null; // null when last month had zero orders (no baseline to compare against)
  orderCountThisMonth: number;
}

export async function getAverageOrderValue(supabase: SupabaseClient): Promise<AverageOrderValueMetric> {
  const startThis = startOfMonth(0);
  const startLast = startOfMonth(1);
  const { data } = await supabase.from('orders').select('total, created_at').gte('created_at', startLast.toISOString());
  const rows = (data ?? []) as { total: number; created_at: string }[];

  const thisMonth = rows.filter((r) => new Date(r.created_at) >= startThis);
  const lastMonth = rows.filter((r) => new Date(r.created_at) < startThis);

  const avg = (arr: { total: number }[]) => (arr.length === 0 ? 0 : arr.reduce((s, r) => s + r.total, 0) / arr.length);
  const avgThisMonth = avg(thisMonth);
  const avgLastMonth = avg(lastMonth);

  return {
    avgThisMonth,
    pctChangeVsLastMonth: avgLastMonth === 0 ? null : Math.round(((avgThisMonth - avgLastMonth) / avgLastMonth) * 100),
    orderCountThisMonth: thisMonth.length,
  };
}

// ── Metric 3 — Production Cycle Time ────────────────────────────────────────
/**
 * No configured cycle-time target exists anywhere in the schema (no
 * settings table, no admin-editable value) — this is a placeholder pending
 * a real number from Steve, same treatment CLAUDE.md's DATA BLOCKERS table
 * gives other not-yet-provided business inputs. Surfaced as a named
 * constant (not buried in JSX) so it's one edit to correct once he gives us
 * a real target.
 */
export const PRODUCTION_CYCLE_TARGET_DAYS = 3.5;

export interface ProductionCycleTimeMetric {
  avgDays: number | null; // null when there's no delivered order in the sample window to measure
  targetDays: number;
  onTrack: boolean;
  sampleSize: number;
}

/**
 * Measured via order_status_history's own 'delivered' row timestamp minus
 * the order's created_at, NOT orders.delivered_at — that column's live-DB
 * presence is explicitly unconfirmed (MIGRATIONS_STATUS.md), whereas
 * order_status_history is already relied on elsewhere in this codebase
 * (getOrderStatusHistory, the picked-up/delivered routes' own inserts).
 */
export async function getProductionCycleTime(supabase: SupabaseClient): Promise<ProductionCycleTimeMetric> {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data: deliveredOrders } = await supabase
    .from('orders')
    .select('id, created_at')
    .eq('status', 'delivered')
    .gte('created_at', since.toISOString());
  const orders = (deliveredOrders ?? []) as { id: string; created_at: string }[];
  if (orders.length === 0) {
    return { avgDays: null, targetDays: PRODUCTION_CYCLE_TARGET_DAYS, onTrack: true, sampleSize: 0 };
  }

  const orderIds = orders.map((o) => o.id);
  const { data: historyRows } = await supabase
    .from('order_status_history')
    .select('order_id, status, created_at')
    .in('order_id', orderIds)
    .eq('status', 'delivered');
  const deliveredAtByOrder = new Map<string, string>();
  for (const row of (historyRows ?? []) as { order_id: string; created_at: string }[]) {
    // An order can only be marked delivered once in practice, but if a
    // correction ever inserted a second 'delivered' row, keep the earliest.
    const existing = deliveredAtByOrder.get(row.order_id);
    if (!existing || row.created_at < existing) deliveredAtByOrder.set(row.order_id, row.created_at);
  }

  const cycleDays: number[] = [];
  for (const order of orders) {
    const deliveredAt = deliveredAtByOrder.get(order.id);
    if (!deliveredAt) continue;
    cycleDays.push(daysBetween(new Date(order.created_at), new Date(deliveredAt)));
  }
  if (cycleDays.length === 0) {
    return { avgDays: null, targetDays: PRODUCTION_CYCLE_TARGET_DAYS, onTrack: true, sampleSize: 0 };
  }

  const avgDays = cycleDays.reduce((s, d) => s + d, 0) / cycleDays.length;
  return {
    avgDays,
    targetDays: PRODUCTION_CYCLE_TARGET_DAYS,
    onTrack: avgDays <= PRODUCTION_CYCLE_TARGET_DAYS,
    sampleSize: cycleDays.length,
  };
}

// ── Metric 4 — Revenue This Month ───────────────────────────────────────────
/** Same placeholder situation as PRODUCTION_CYCLE_TARGET_DAYS above — no configured monthly revenue goal exists yet. */
export const REVENUE_GOAL_MONTHLY: number = 150_000;

export interface RevenueMetric {
  revenue: number;
  goal: number;
  pctOfGoal: number;
  dailyBreakdown: { date: string; total: number }[];
}

export async function getRevenueThisMonth(supabase: SupabaseClient): Promise<RevenueMetric> {
  const start = startOfMonth(0);
  const { data } = await supabase.from('orders').select('total, created_at').gte('created_at', start.toISOString());
  const rows = (data ?? []) as { total: number; created_at: string }[];

  const byDay = new Map<string, number>();
  let revenue = 0;
  for (const row of rows) {
    revenue += row.total;
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + row.total);
  }
  const dailyBreakdown = Array.from(byDay.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    revenue,
    goal: REVENUE_GOAL_MONTHLY,
    pctOfGoal: REVENUE_GOAL_MONTHLY === 0 ? 0 : Math.round((revenue / REVENUE_GOAL_MONTHLY) * 100),
    dailyBreakdown,
  };
}

// ── Order Pipeline funnel ────────────────────────────────────────────────────
export interface PipelineStage {
  key: 'quotes' | 'orders' | 'in_production' | 'ready' | 'delivered';
  label: string;
  count: number;
  href: string;
}

const PIPELINE_WINDOW_DAYS = 90;

/**
 * "Quotes" counts issued quotes (see ISSUED_QUOTE_STATUSES above) rather
 * than quote_requests — quote_requests is the customer's raw RFQ submission,
 * before AFS has priced anything (CLAUDE.md's business model section); a
 * formal `quotes` row is the actual thing that can "convert" into an order,
 * which is what this funnel is meant to visualize. There is no dedicated
 * admin list page for the quotes table today, so its link falls through to
 * /admin/quote-requests — the closest real destination — documented so a
 * future reader isn't surprised the link doesn't land on a `quotes`-specific
 * page.
 */
export async function getOrderPipeline(supabase: SupabaseClient): Promise<PipelineStage[]> {
  const since = new Date();
  since.setDate(since.getDate() - PIPELINE_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const [quotesRes, ordersRes, inProductionRes, readyRes, deliveredRes] = await Promise.all([
    supabase.from('quotes').select('status, created_at').gte('created_at', sinceIso),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso)
      .in('status', IN_PRODUCTION_STATUSES),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).in('status', READY_STATUSES),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'delivered'),
  ]);

  const quotesIssued = ((quotesRes.data ?? []) as { status: string }[]).filter((q) =>
    ISSUED_QUOTE_STATUSES.includes(q.status)
  ).length;

  return [
    { key: 'quotes', label: 'Quotes', count: quotesIssued, href: '/admin/quote-requests' },
    { key: 'orders', label: 'Orders', count: ordersRes.count ?? 0, href: '/admin/orders-crm' },
    { key: 'in_production', label: 'In Production', count: inProductionRes.count ?? 0, href: '/admin/orders' },
    { key: 'ready', label: 'Ready', count: readyRes.count ?? 0, href: '/admin/orders?status=ready' },
    { key: 'delivered', label: 'Delivered', count: deliveredRes.count ?? 0, href: '/admin/orders?status=delivered' },
  ];
}

// ── Production Status mini table ────────────────────────────────────────────
export type ProductionHealth = 'on_track' | 'at_risk' | 'overdue';

export interface ProductionStatusRow {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  statusLabel: string;
  percentComplete: number;
  eta: string | null;
  health: ProductionHealth;
  isRush: boolean;
}

/** Post-production statuses (afs-jf-* widened set, see lib/admin/orderStages.ts) sit conceptually past a specific ORDER_STAGES entry. */
const POST_PRODUCTION_STAGE_EQUIVALENT: Record<string, OrderStageKey> = {
  in_production: 'qc',
  packaged: 'ready',
  out_for_delivery: 'shipped',
};

function percentForStatus(status: string): number {
  if (status === 'cancelled') return 0;
  const equivalent = POST_PRODUCTION_STAGE_EQUIVALENT[status] ?? status;
  const idx = stageIndex(equivalent);
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / ORDER_STAGES.length) * 100);
}

function computeHealth(eta: string | null, isRush: boolean): ProductionHealth {
  if (!eta) return isRush ? 'at_risk' : 'on_track';
  const daysUntil = daysBetween(new Date(), new Date(eta));
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 1) return 'at_risk';
  return 'on_track';
}

const HEALTH_SEVERITY: Record<ProductionHealth, number> = { overdue: 0, at_risk: 1, on_track: 2 };

/**
 * Reuses getProductionQueue (lib/data/orders.ts) — the same real fabrication
 * data the full /admin/orders page shows — rather than a parallel query,
 * then re-sorts by health severity (overdue/at-risk surface first) so the
 * dashboard's necessarily-short list shows what needs attention, not just
 * the soonest-due orders that happen to already be on track.
 */
export async function getProductionStatusRows(supabase: SupabaseClient, limit = 8): Promise<ProductionStatusRow[]> {
  const rows = await getProductionQueue(supabase, 'all', 'expected');

  const withHealth = rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
    status: r.status,
    statusLabel: STATUS_LABEL[r.status] ?? r.status,
    percentComplete: percentForStatus(r.status),
    eta: r.expectedShipDate,
    health: computeHealth(r.expectedShipDate, r.isRush),
    isRush: r.isRush,
  }));

  return withHealth.sort((a, b) => HEALTH_SEVERITY[a.health] - HEALTH_SEVERITY[b.health]).slice(0, limit);
}

// ── Pending Actions ──────────────────────────────────────────────────────────
export interface PendingActionsSummary {
  quotesAwaitingApproval: number;
  ordersAwaitingPickup: number;
  overdueInvoiceCount: number;
  overdueInvoiceTotal: number;
}

/**
 * "Awaiting Pickup" = orders set up for customer pickup that have reached
 * ready/packaged but haven't been marked delivered yet — matches exactly
 * what app/api/orders/[id]/picked-up/route.ts checks before accepting a
 * pickup confirmation (delivery_method === 'pickup', status not yet
 * 'delivered'/'cancelled'). Overdue-invoice figures reuse getCrmInvoices'
 * already-correct net-terms/due-date derivation rather than recomputing it.
 */
export async function getPendingActions(supabase: SupabaseClient): Promise<PendingActionsSummary> {
  const [quotesRes, pickupRes, invoices] = await Promise.all([
    supabase.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_method', 'pickup')
      .in('status', READY_STATUSES),
    getCrmInvoices(supabase),
  ]);

  const overdue = invoices.filter((inv) => inv.status === 'overdue');

  return {
    quotesAwaitingApproval: quotesRes.count ?? 0,
    ordersAwaitingPickup: pickupRes.count ?? 0,
    overdueInvoiceCount: overdue.length,
    overdueInvoiceTotal: overdue.reduce((sum, inv) => sum + inv.amount, 0),
  };
}

// ── Customer Health ──────────────────────────────────────────────────────────
export interface TopCustomerRow {
  id: string;
  name: string;
  company: string | null;
  email: string;
  orderCount: number;
  valueYtd: number;
  lastOrderAt: string | null;
}

export async function getTopCustomersYtd(supabase: SupabaseClient, limit = 5): Promise<TopCustomerRow[]> {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const { data } = await supabase.from('orders').select('user_id, total, created_at').gte('created_at', startOfYear);
  const rows = (data ?? []) as { user_id: string; total: number; created_at: string }[];
  if (rows.length === 0) return [];

  const byUser = new Map<string, { orderCount: number; valueYtd: number; lastOrderAt: string | null }>();
  for (const row of rows) {
    const entry = byUser.get(row.user_id) ?? { orderCount: 0, valueYtd: 0, lastOrderAt: null };
    entry.orderCount += 1;
    entry.valueYtd += row.total;
    if (!entry.lastOrderAt || row.created_at > entry.lastOrderAt) entry.lastOrderAt = row.created_at;
    byUser.set(row.user_id, entry);
  }

  const topIds = Array.from(byUser.entries())
    .sort((a, b) => b[1].valueYtd - a[1].valueYtd)
    .slice(0, limit)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  const { data: profileRows } = await supabase.from('profiles').select('id, full_name, company, email').in('id', topIds);
  const profileById = new Map(
    ((profileRows ?? []) as { id: string; full_name: string; company: string | null; email: string }[]).map((p) => [
      p.id,
      p,
    ])
  );

  return topIds.map((id) => {
    const agg = byUser.get(id)!;
    const profile = profileById.get(id);
    return {
      id,
      name: profile?.full_name ?? 'Unknown',
      company: profile?.company ?? null,
      email: profile?.email ?? '',
      orderCount: agg.orderCount,
      valueYtd: agg.valueYtd,
      lastOrderAt: agg.lastOrderAt,
    };
  });
}

export interface RecentOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  total: number;
  status: string;
  statusLabel: string;
}

export async function getRecentOrders(supabase: SupabaseClient, limit = 5): Promise<RecentOrderRow[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, total, status, created_at, profiles(full_name, company)')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (
    (data ?? []) as unknown as {
      id: string;
      order_number: string;
      total: number;
      status: string;
      created_at: string;
      profiles: { full_name: string; company: string | null } | null;
    }[]
  ).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.profiles?.company || row.profiles?.full_name || 'Unknown',
    createdAt: row.created_at,
    total: row.total,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
  }));
}
