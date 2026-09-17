import type {
  AverageOrderValueMetric,
  ConversionMetric,
  PendingActionsSummary,
  PipelineStage,
  ProductionCycleTimeMetric,
  ProductionStatusRow,
  RecentOrderRow,
  RevenueMetric,
  TopCustomerRow,
} from '@/lib/data/command-center-dashboard';
import MetricCard from '@/components/admin/dashboard/MetricCard';
import OrderPipelineFunnel from '@/components/admin/dashboard/OrderPipelineFunnel';
import ProductionStatusTable from '@/components/admin/dashboard/ProductionStatusTable';
import PendingActionsPanel from '@/components/admin/dashboard/PendingActionsPanel';
import CustomerHealthSection from '@/components/admin/dashboard/CustomerHealthSection';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

interface CommandCenterDashboardProps {
  conversion: ConversionMetric;
  averageOrderValue: AverageOrderValueMetric;
  productionCycleTime: ProductionCycleTimeMetric;
  revenue: RevenueMetric;
  pipeline: PipelineStage[];
  productionStatusRows: ProductionStatusRow[];
  pendingActions: PendingActionsSummary;
  topCustomers: TopCustomerRow[];
  recentOrders: RecentOrderRow[];
}

export default function CommandCenterDashboard({
  conversion,
  averageOrderValue,
  productionCycleTime,
  revenue,
  pipeline,
  productionStatusRows,
  pendingActions,
  topCustomers,
  recentOrders,
}: CommandCenterDashboardProps) {
  const aovSublabel =
    averageOrderValue.pctChangeVsLastMonth === null
      ? 'No orders last month to compare'
      : `${averageOrderValue.pctChangeVsLastMonth >= 0 ? '↑' : '↓'} ${Math.abs(averageOrderValue.pctChangeVsLastMonth)}% vs last month`;

  const cycleTimeSublabel =
    productionCycleTime.avgDays === null
      ? 'No deliveries in the last 90 days'
      : `${productionCycleTime.avgDays.toFixed(1)} days avg · target ${productionCycleTime.targetDays}`;

  return (
    <div className="flex flex-col gap-12">
      {/* KEY METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-afs-border border border-afs-border rounded">
        <MetricCard
          label="Quote-to-Order Conversion"
          value={`${conversion.ratePct}%`}
          sublabel={`${conversion.issuedThisMonth} quotes issued this month`}
          trend={conversion.trend}
          href="/admin/quote-requests"
        />
        <MetricCard
          label="Average Order Value"
          value={currency.format(averageOrderValue.avgThisMonth)}
          sublabel={aovSublabel}
          sublabelStatus={
            averageOrderValue.pctChangeVsLastMonth === null ? 'neutral' : averageOrderValue.pctChangeVsLastMonth >= 0 ? 'success' : 'warning'
          }
          href="/admin/orders-crm"
        />
        <MetricCard
          label="Production Cycle Time"
          value={productionCycleTime.avgDays === null ? '—' : `${productionCycleTime.avgDays.toFixed(1)}d`}
          sublabel={cycleTimeSublabel}
          sublabelStatus={productionCycleTime.avgDays === null ? 'neutral' : productionCycleTime.onTrack ? 'success' : 'error'}
          href="/admin/orders?sort=expected"
        />
        <MetricCard
          label="Revenue This Month"
          value={currency.format(revenue.revenue)}
          sublabel={`${revenue.pctOfGoal}% of ${currency.format(revenue.goal)} goal`}
          sublabelStatus={revenue.pctOfGoal >= 100 ? 'success' : revenue.pctOfGoal >= 70 ? 'neutral' : 'warning'}
          progressPct={revenue.pctOfGoal}
          href="/admin/orders-crm"
        />
      </div>

      {/* ORDER PIPELINE */}
      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Order Pipeline</h2>
        <OrderPipelineFunnel stages={pipeline} />
      </section>

      {/* PRODUCTION STATUS */}
      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Production Status</h2>
        <ProductionStatusTable rows={productionStatusRows} />
      </section>

      {/* PENDING ACTIONS */}
      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Pending Actions</h2>
        <PendingActionsPanel summary={pendingActions} />
      </section>

      {/* CUSTOMER HEALTH */}
      <section>
        <h2 className="font-heading text-lg text-afs-chrome-high mb-4">Customer Health</h2>
        <CustomerHealthSection topCustomers={topCustomers} recentOrders={recentOrders} />
      </section>
    </div>
  );
}
