/**
 * THE FOUR DELIVERY WINDOWS — the only place their English lives.
 *
 * The approved prototype offers exactly 8–10 AM, 10 AM–12 PM, 1–3 PM and
 * 3–5 PM (docs/design/command-center-v2-prototype.html, the schedule modal's
 * `wins` array). `deliveries.time_window` stores the KEY, never the label, so
 * rewording a window is a change to this file and not a migration — and so no
 * en dash ever ends up inside a database CHECK constraint.
 *
 * The first window is the default an auto-scheduled delivery gets: a job that
 * came off the machine yesterday afternoon goes out first thing, which is what
 * the shop does anyway. It is a default, not a decision — Deliveries can
 * change it in two taps.
 */

export const DELIVERY_WINDOW_KEYS = ['08-10', '10-12', '13-15', '15-17'] as const;
export type DeliveryWindow = (typeof DELIVERY_WINDOW_KEYS)[number];

const LABELS: Record<DeliveryWindow, string> = {
  '08-10': '8–10 AM',
  '10-12': '10 AM–12 PM',
  '13-15': '1–3 PM',
  '15-17': '3–5 PM',
};

/** What an auto-scheduled delivery gets. First thing in the morning. */
export const DEFAULT_DELIVERY_WINDOW: DeliveryWindow = '08-10';

export function isDeliveryWindow(value: unknown): value is DeliveryWindow {
  return typeof value === 'string' && (DELIVERY_WINDOW_KEYS as readonly string[]).includes(value);
}

/**
 * The window as a person reads it. An unrecognised key — a row written by a
 * future column value this build does not know — reads as plain "Daytime"
 * rather than leaking the raw key onto an operator's screen.
 */
export function deliveryWindowLabel(value: string): string {
  return isDeliveryWindow(value) ? LABELS[value] : 'Daytime';
}

/** Every window, in the order the day runs, for a picker. */
export const DELIVERY_WINDOW_OPTIONS: { key: DeliveryWindow; label: string }[] =
  DELIVERY_WINDOW_KEYS.map((key) => ({ key, label: LABELS[key] }));
