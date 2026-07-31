/**
 * Stage labels are placeholders pending exact shop language from the AFS shop
 * manager (checklist #39 — see SPEC_PRODUCTION_TIMELINE.md §2). The key order
 * below IS the production sequence and drives QuickAdvanceButton, the status
 * dropdown, and backward-move detection — do not reorder without updating all three.
 *
 * This is the single source of truth for the fabrication stage list — both
 * the admin production queue and the customer ProductionTimeline
 * (components/account/ProductionTimeline.tsx) import ORDER_STAGES from here
 * rather than keeping their own copies (PRODUCTION_QUEUE_AUDIT.md §2h).
 */
export const ORDER_STAGES = [
  {
    key: 'submitted',
    label: 'Order Received',
    adminLabel: 'Submitted',
    description: 'Your order is confirmed and in our system.',
  },
  {
    key: 'received',
    label: 'Acknowledged',
    adminLabel: 'Acknowledged',
    description: 'Our team has reviewed your order details.',
  },
  {
    key: 'in_queue',
    label: 'In Production Queue',
    adminLabel: 'In Queue',
    description: 'Scheduled for fabrication.',
  },
  {
    key: 'cutting',
    label: 'Cutting',
    adminLabel: 'Cutting',
    description: 'Your material is being cut to specification.',
  },
  {
    key: 'bending',
    label: 'Forming',
    adminLabel: 'Bending/Forming',
    description: 'Profiles are being bent and formed.',
  },
  {
    key: 'qc',
    label: 'Quality Check',
    adminLabel: 'QC',
    description: 'Final inspection before packaging.',
  },
  {
    key: 'ready',
    label: 'Ready',
    adminLabel: 'Ready to Ship',
    description: 'Your order is packaged and ready.',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    adminLabel: 'Shipped',
    description: 'On its way to you.',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    adminLabel: 'Delivered',
    description: 'Order complete.',
  },
] as const;

export type OrderStageKey = (typeof ORDER_STAGES)[number]['key'];

/**
 * Employee PWA / delivery-tracking statuses (SPEC_DELIVERY_TRACKING_AND_EMPLOYEE_PWA.md
 * §3) — widened onto orders.status by supabase/migrations/007_delivery_tracking.sql
 * §6a. Deliberately NOT part of ORDER_STAGES: they are a coarser, independent
 * vocabulary driven by the Employee PWA (packaged/dispatch routes,
 * lib/data/orders.ts's getEmployeeOrderQueue), not the admin fabrication
 * queue's granular stage sequence — see that migration's own comment
 * ("reconciling in_production with the existing granular admin stages is
 * out of scope here"). PRODUCTION_QUEUE_AUDIT.md §2a's fix keeps that
 * separation but makes sure both surfaces still recognize and correctly
 * label/display orders sitting in one of these statuses instead of silently
 * dropping them (admin queue) or rendering an all-pending timeline (customer).
 */
export const POST_PRODUCTION_STATUSES = ['in_production', 'packaged', 'out_for_delivery'] as const;
export type PostProductionStatus = (typeof POST_PRODUCTION_STATUSES)[number];

export type OrderStatus = OrderStageKey | 'cancelled' | PostProductionStatus;

export const ACTIVE_ORDER_STATUSES: OrderStageKey[] = ORDER_STAGES.filter((s) => s.key !== 'delivered').map(
  (s) => s.key
);

/** Stages that fire a customer notification per SPEC_PRODUCTION_TIMELINE.md §7. */
export const NOTIFICATION_STAGES: OrderStatus[] = ['submitted', 'in_queue', 'cutting', 'ready', 'shipped', 'delivered'];

export function isOrderStatus(value: string): value is OrderStatus {
  return (
    value === 'cancelled' ||
    ORDER_STAGES.some((s) => s.key === value) ||
    (POST_PRODUCTION_STATUSES as readonly string[]).includes(value)
  );
}

export function stageIndex(status: string): number {
  return ORDER_STAGES.findIndex((s) => s.key === status);
}

export function getStage(status: string) {
  return ORDER_STAGES.find((s) => s.key === status) ?? null;
}

export function getNextStage(status: string) {
  const idx = stageIndex(status);
  if (idx === -1 || idx === ORDER_STAGES.length - 1) return null;
  return ORDER_STAGES[idx + 1];
}

/** True when `to` is earlier in the sequence than `from` — used to require a note. */
export function isBackwardMove(from: string, to: string): boolean {
  const a = stageIndex(from);
  const b = stageIndex(to);
  if (a === -1 || b === -1) return false;
  return b < a;
}

export const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(ORDER_STAGES.map((s) => [s.key, s.adminLabel])),
  in_production: 'In Production',
  packaged: 'Packaged',
  out_for_delivery: 'Out for Delivery',
  cancelled: 'Cancelled',
};

export type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'chrome' | 'info';

export const STATUS_VARIANT: Record<string, StatusBadgeVariant> = {
  submitted: 'info',
  received: 'info',
  in_queue: 'warning',
  cutting: 'warning',
  bending: 'warning',
  qc: 'warning',
  ready: 'success',
  in_production: 'warning',
  packaged: 'success',
  shipped: 'success',
  out_for_delivery: 'success',
  delivered: 'chrome',
  cancelled: 'error',
};
