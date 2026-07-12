/**
 * Stage labels are placeholders pending exact shop language from the AFS shop
 * manager (checklist #39 — see SPEC_PRODUCTION_TIMELINE.md §2). The key order
 * below IS the production sequence and drives QuickAdvanceButton, the status
 * dropdown, and backward-move detection — do not reorder without updating all three.
 */
export const ORDER_STAGES = [
  { key: 'submitted', label: 'Order Received', adminLabel: 'Submitted' },
  { key: 'received', label: 'Acknowledged', adminLabel: 'Acknowledged' },
  { key: 'in_queue', label: 'In Production Queue', adminLabel: 'In Queue' },
  { key: 'cutting', label: 'Cutting', adminLabel: 'Cutting' },
  { key: 'bending', label: 'Forming', adminLabel: 'Bending/Forming' },
  { key: 'qc', label: 'Quality Check', adminLabel: 'QC' },
  { key: 'ready', label: 'Ready', adminLabel: 'Ready to Ship' },
  { key: 'shipped', label: 'Shipped', adminLabel: 'Shipped' },
  { key: 'delivered', label: 'Delivered', adminLabel: 'Delivered' },
] as const;

export type OrderStageKey = (typeof ORDER_STAGES)[number]['key'];
export type OrderStatus = OrderStageKey | 'cancelled';

export const ACTIVE_ORDER_STATUSES: OrderStageKey[] = ORDER_STAGES.filter((s) => s.key !== 'delivered').map(
  (s) => s.key
);

/** Stages that fire a customer notification per SPEC_PRODUCTION_TIMELINE.md §7. */
export const NOTIFICATION_STAGES: OrderStatus[] = ['submitted', 'in_queue', 'cutting', 'ready', 'shipped', 'delivered'];

export function isOrderStatus(value: string): value is OrderStatus {
  return value === 'cancelled' || ORDER_STAGES.some((s) => s.key === value);
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
  shipped: 'success',
  delivered: 'chrome',
  cancelled: 'error',
};
