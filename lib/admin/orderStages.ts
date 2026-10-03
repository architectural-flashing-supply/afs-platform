/**
 * Stage labels are placeholders pending exact shop language from the AFS shop
 * manager (checklist #39 — see SPEC_PRODUCTION_TIMELINE.md §2). The key order
 * below IS the production sequence and drives QuickAdvanceButton, the status
 * dropdown, and backward-move detection — do not reorder without updating all three.
 *
 * THIS FILE IS THE ONLY PLACE A STAGE LABEL IS WRITTEN, for every audience and
 * every surface. The admin production queue, the status-change email, and all
 * three variants of ProductionTimeline (components/account/ProductionTimeline.tsx
 * — customer, admin, public) read their label from here, so when checklist #39
 * lands, renaming a stage is an edit to this file and nothing else
 * (PRODUCTION_QUEUE_AUDIT.md §2h, EES-OVN.06 R1).
 *
 * The field names say who the label is for: `customerLabel` is the
 * customer-facing wording (it was called `label` until EES-OVN.06, which was
 * ambiguous once a third audience existed), `adminLabel` is the shop/office
 * wording, and `description` is the one-line customer explanation. Which field
 * a given surface reads is decided in ONE function, `stageLabel()` below —
 * never by a caller picking a field itself.
 */
export const ORDER_STAGES = [
  {
    key: 'submitted',
    customerLabel: 'Order Received',
    adminLabel: 'Submitted',
    description: 'Your order is confirmed and in our system.',
  },
  {
    key: 'received',
    customerLabel: 'Acknowledged',
    adminLabel: 'Acknowledged',
    description: 'Our team has reviewed your order details.',
  },
  {
    key: 'in_queue',
    customerLabel: 'In Production Queue',
    adminLabel: 'In Queue',
    description: 'Scheduled for fabrication.',
  },
  {
    key: 'cutting',
    customerLabel: 'Cutting',
    adminLabel: 'Cutting',
    description: 'Your material is being cut to specification.',
  },
  {
    key: 'bending',
    customerLabel: 'Forming',
    adminLabel: 'Bending/Forming',
    description: 'Profiles are being bent and formed.',
  },
  {
    key: 'qc',
    customerLabel: 'Quality Check',
    adminLabel: 'QC',
    description: 'Final inspection before packaging.',
  },
  {
    key: 'ready',
    customerLabel: 'Ready',
    adminLabel: 'Ready to Ship',
    description: 'Your order is packaged and ready.',
  },
  {
    key: 'shipped',
    customerLabel: 'Shipped',
    adminLabel: 'Shipped',
    description: 'On its way to you.',
  },
  {
    key: 'delivered',
    customerLabel: 'Delivered',
    adminLabel: 'Delivered',
    description: 'Order complete.',
  },
] as const;

export type OrderStageKey = (typeof ORDER_STAGES)[number]['key'];

/** One entry of ORDER_STAGES, widened off the `as const` tuple. */
export type OrderStage = (typeof ORDER_STAGES)[number];

/**
 * The three audiences ProductionTimeline is rendered for
 * (SPEC_PRODUCTION_TIMELINE.md §1): the signed-in customer's order detail, the
 * admin order detail, and the anonymous public order-status lookup.
 */
export const TIMELINE_VARIANTS = ['customer', 'admin', 'public'] as const;
export type TimelineVariant = (typeof TIMELINE_VARIANTS)[number];

/**
 * THE one decision about which label a surface shows. `admin` is the only
 * audience that reads shop wording; the public tracker shows the customer's
 * wording because an anonymous visitor is a customer who is not signed in, not
 * a third vocabulary.
 */
export function stageLabel(stage: OrderStage, variant: TimelineVariant): string {
  return variant === 'admin' ? stage.adminLabel : stage.customerLabel;
}

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

/**
 * Where each post-production status sits in the FABRICATION sequence, for the
 * purpose of drawing a timeline. Moved here from ProductionTimeline in
 * EES-OVN.06 so the stage vocabulary and its aliases live in one file; the
 * values are unchanged, and SPEC_PRODUCTION_TIMELINE.md §10 states them.
 *
 * DO NOT MERGE THIS WITH `POST_PRODUCTION_STAGE_EQUIVALENT` IN
 * lib/data/command-center-dashboard.ts. The two deliberately disagree: that one
 * maps `in_production` to `qc`, this one to `ready`. Which is right is a
 * question for Reid (recorded UNRESOLVED in EES-OVN.06 §3.3 D4), and the
 * dashboard's value feeds a frozen Command Center v7 screen whose displayed
 * percentage would change if it were altered. Unifying them is a visual change
 * to v7, not a cleanup.
 */
export const TIMELINE_POST_PRODUCTION_STAGE: Record<PostProductionStatus, OrderStageKey> = {
  in_production: 'ready',
  packaged: 'ready',
  out_for_delivery: 'shipped',
};

/**
 * Human wording for the three post-production statuses. Written ONCE here, for
 * the same reason the stage labels are: `STATUS_LABEL` below, the timeline's
 * banner text and the customer-facing `ORDER_STATUS_LABEL` all need it, and
 * three hand-kept copies of "Out for Delivery" is three places a rename has to
 * land. Unlike a fabrication stage these statuses read the same to the shop and
 * to the customer, so there is one string each rather than a pair.
 */
export const POST_PRODUCTION_LABEL: Record<PostProductionStatus, string> = {
  in_production: 'In Production',
  packaged: 'Packaged',
  out_for_delivery: 'Out for Delivery',
};

/** Shown wherever a cancelled order's status is named. */
export const CANCELLED_LABEL = 'Cancelled';

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

/** Admin/shop wording for every value `orders.status` can hold. */
export const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(ORDER_STAGES.map((s) => [s.key, s.adminLabel])),
  ...POST_PRODUCTION_LABEL,
  cancelled: CANCELLED_LABEL,
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
