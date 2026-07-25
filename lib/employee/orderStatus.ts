import type { BadgeVariant } from '@/components/ui/Badge';

// Not lib/admin/orderStages.ts's STATUS_LABEL/STATUS_VARIANT — that module's
// OrderStageKey union deliberately excludes the Employee-PWA-only statuses
// (packaged/out_for_delivery/in_production, added by
// supabase/migrations/007_delivery_tracking.sql §6a), matching the same
// precedent already set by app/track/[orderId]/page.tsx's own local map.
export const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  in_production: 'In Production',
  ready: 'Ready',
  packaged: 'Packaged',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
};

export const EMPLOYEE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  in_production: 'warning',
  ready: 'success',
  packaged: 'success',
  out_for_delivery: 'info',
  delivered: 'chrome',
};
