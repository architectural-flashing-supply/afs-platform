/**
 * THE PRODUCTION TIMELINE'S VIEW MODEL. One function decides everything the
 * timeline shows, for all three audiences, and `components/account/
 * ProductionTimeline.tsx` is a direct translation of what this returns into
 * JSX — it makes no presentation decision of its own.
 *
 * WHY THIS IS A SEPARATE MODULE. The same timeline is rendered on a signed-in
 * customer's order detail, on the admin order detail, and on the anonymous
 * public order-status lookup. Three audiences means three sets of "show this,
 * hide that" rules, and those rules are the part that can be WRONG in a way
 * nobody notices — an internal note reaching an anonymous visitor, a customer
 * being shown "Ready" for an order that was cancelled, a status outside the
 * fabrication sequence rendering as a timeline where nothing has happened yet
 * (the real bug PRODUCTION_QUEUE_AUDIT.md §2a found). Those rules therefore
 * live in a pure module with exact unit tests rather than inside JSX.
 *
 * Labels are NOT decided here. Every one comes from `stageLabel()` in
 * lib/admin/orderStages.ts, which is the single config module (CLAUDE.md's
 * checklist #39 blocker: renaming a stage must stay a one-file edit).
 *
 * PURE. No `Date.now()`, no locale formatting, no I/O — a timestamp leaves here
 * as the ISO string it arrived as, and the component formats it. Two calls with
 * the same input return deeply equal output, which is what makes the tests
 * assertions rather than approximations.
 */
import {
  ORDER_STAGES,
  POST_PRODUCTION_STATUSES,
  TIMELINE_POST_PRODUCTION_STAGE,
  stageIndex,
  stageLabel,
  type OrderStageKey,
  type PostProductionStatus,
  type TimelineVariant,
} from '@/lib/admin/orderStages';

export type { TimelineVariant };

/** How one stage's dot and connector are drawn. */
export type StageVisualState = 'completed' | 'active' | 'pending';

export interface StatusHistoryEntry {
  status: string;
  /** ISO 8601. */
  changedAt: string;
  note?: string | null;
  /** Who made the change. Admin variant only — never shown to a customer. */
  changedByName?: string | null;
}

export interface TimelineRowView {
  key: OrderStageKey;
  /** Already resolved for the variant — the component never picks a field. */
  label: string;
  /** `null` when this variant/state does not show prose. */
  description: string | null;
  state: StageVisualState;
  /** Cancelled orders strike through the stages they never reached. */
  struckThrough: boolean;
  /** ISO 8601 from status history, or `null` if this stage has no entry. */
  timestamp: string | null;
  /** Admin variant only. */
  note: string | null;
  /** Admin variant only. */
  changedByName: string | null;
  /** Exactly one row carries `aria-current="step"` — or none. */
  isCurrent: boolean;
  /** The tracking block hangs off this row. */
  showTracking: boolean;
  /** The pre-ship photo slot renders immediately after this row. */
  showPhoto: boolean;
}

export type TimelineBannerKind = 'cancelled' | 'post_production' | 'unknown';

export interface TimelineBannerView {
  kind: TimelineBannerKind;
  /** Plain text. The component supplies the icon and the tokens. */
  text: string;
  /** ISO 8601, when the banner has a time to name. */
  at: string | null;
}

export interface TimelineTrackingView {
  trackingNumber: string;
  carrier: string | null;
  /** `null` for a carrier with no known tracking URL — rendered as plain text, never a dead link. */
  url: string | null;
}

export interface TimelinePhotoView {
  url: string;
  caption: string;
}

export interface TimelineProgressView {
  /** `aria-valuenow` — how many of the fabrication stages this order has reached. */
  stagesReached: number;
  /** `aria-valuemax`. */
  totalStages: number;
  /** `aria-valuetext`, and the visible progress line. */
  valueText: string;
}

export interface TimelineView {
  variant: TimelineVariant;
  banner: TimelineBannerView | null;
  /** ISO 8601, only when this variant and this status show it. */
  estimatedShipDate: string | null;
  rows: TimelineRowView[];
  photo: TimelinePhotoView | null;
  tracking: TimelineTrackingView | null;
  progress: TimelineProgressView;
  /** True when no status change has ever been recorded for this order. */
  isEmpty: boolean;
  /** What to say in that case — `null` when there is history. */
  emptyMessage: string | null;
}

export interface BuildTimelineViewInput {
  currentStatus: string;
  statusHistory: StatusHistoryEntry[];
  variant: TimelineVariant;
  estimatedShipDate?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  shopPhotoUrl?: string | null;
}

/**
 * Error wording, per CLAUDE.md rule #30: never blame the user, never show a
 * stack trace, and always say what did NOT happen. On a platform where the next
 * screen along reaches a bending machine, "your order is unaffected" is the
 * message — this panel is a status DISPLAY failing, and nothing about the order
 * itself has moved.
 *
 * Exported as constants so the sentence is asserted by a test rather than
 * trusted to survive an edit.
 */
export const TIMELINE_ERROR_HEADLINE = 'Production status could not be loaded.';
export const TIMELINE_ERROR_BODY =
  'Nothing about your order has changed — only this status display failed. Reload the page to try again.';
export const TIMELINE_LOADING_LABEL = 'Loading production status…';

/** The spec's own caption for the pre-ship photo (SPEC_PRODUCTION_TIMELINE.md §5). */
export const PRE_SHIP_PHOTO_CAPTION = 'Your completed order — ready to ship';

/** Where the pre-ship photo sits: immediately after QC, before Ready. */
export const PHOTO_SLOT_AFTER_STAGE: OrderStageKey = 'qc';

/** The stage the tracking block hangs off. */
export const TRACKING_ROW_STAGE: OrderStageKey = 'shipped';

/**
 * Statuses for which a tracking number is meaningful. Before an order ships, a
 * tracking number on the row would claim a shipment that has not happened.
 */
const TRACKING_STATUSES: readonly string[] = ['shipped', 'delivered', 'out_for_delivery'];

/**
 * Carriers whose public tracking URL is known. An unknown carrier deliberately
 * resolves to `null` so the number renders as text — guessing a URL format
 * produces a link that 404s, which is worse than no link.
 */
const CARRIER_TRACKING_URLS: Record<string, (trackingNumber: string) => string> = {
  ups: (n) => `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(n)}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
};

/**
 * Normalises a carrier string to a lookup key: lower-cased, with everything
 * that is not a letter removed, so `"FedEx"`, `"fed-ex"` and `"Fed Ex "` all
 * reach the same entry. A human types this field.
 */
export function resolveTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined
): string | null {
  if (!carrier || !trackingNumber) return null;
  const key = carrier.trim().toLowerCase().replace(/[^a-z]/g, '');
  const resolver = CARRIER_TRACKING_URLS[key];
  return resolver ? resolver(trackingNumber) : null;
}

/** Human-readable name for a status outside the fabrication sequence. */
const POST_PRODUCTION_LABEL: Record<PostProductionStatus, string> = {
  in_production: 'In Production',
  packaged: 'Packaged',
  out_for_delivery: 'Out for Delivery',
};

function isPostProduction(status: string): status is PostProductionStatus {
  return (POST_PRODUCTION_STATUSES as readonly string[]).includes(status);
}

/**
 * WHAT EACH VARIANT SHOWS. Stated as data so the matrix is one readable table
 * and so a test can assert it directly (EES-OVN.06 R2 / AC-08).
 *
 * - `description`: customer prose. The admin variant never shows it — shop
 *   staff get the history note instead, and customer wording is not shop
 *   language. `public` is specified as the MINIMAL variant, so it shows the
 *   prose only for the stage the order is on right now.
 * - `note` / `changedByName`: internal. Admin only, always. A note written for
 *   the office must never reach an anonymous visitor.
 * - `estimatedShipDate` / `photo`: hidden on admin because the admin order
 *   detail already has its own Delivery & Payment panel and its own
 *   PreShipPhotoSection; repeating them inside the timeline would be two
 *   sources of the same fact on one screen.
 * - `tracking`: shown to everyone. It is the one field that is equally
 *   operational and customer-facing.
 */
interface VariantRules {
  descriptions: 'completed-and-active' | 'active-only' | 'never';
  notes: boolean;
  estimatedShipDate: boolean;
  photo: boolean;
  tracking: boolean;
}

export const VARIANT_RULES: Record<TimelineVariant, VariantRules> = {
  customer: {
    descriptions: 'completed-and-active',
    notes: false,
    estimatedShipDate: true,
    photo: true,
    tracking: true,
  },
  admin: {
    descriptions: 'never',
    notes: true,
    estimatedShipDate: false,
    photo: false,
    tracking: true,
  },
  public: {
    descriptions: 'active-only',
    notes: false,
    estimatedShipDate: true,
    photo: true,
    tracking: true,
  },
};

/** The empty-state sentence, per audience. */
const EMPTY_MESSAGE: Record<TimelineVariant, string> = {
  customer: 'No production updates have been recorded yet. This page updates as your order moves through the shop.',
  admin: 'No status changes recorded yet.',
  public: 'No production updates have been recorded yet.',
};

/**
 * Latest history entry per stage key. Sorts ascending by `changedAt` first, so
 * an unsorted input is handled, and the LAST entry wins — a stage re-entered
 * after a correction shows when it was last entered, not the first time.
 */
function latestHistoryByStage(history: StatusHistoryEntry[]): Map<string, StatusHistoryEntry> {
  const byStage = new Map<string, StatusHistoryEntry>();
  const sorted = [...history].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  for (const entry of sorted) byStage.set(entry.status, entry);
  return byStage;
}

export function buildTimelineView(input: BuildTimelineViewInput): TimelineView {
  const { currentStatus, variant } = input;
  const rules = VARIANT_RULES[variant];
  const history = input.statusHistory ?? [];
  const historyByStage = latestHistoryByStage(history);

  const isCancelled = currentStatus === 'cancelled';
  const postProduction = isPostProduction(currentStatus);

  // Which stage index the order is "at". A post-production status is resolved
  // to the fabrication stage it is past (SPEC_PRODUCTION_TIMELINE.md §10) so
  // the drawn timeline still shows real progress; the banner names the real
  // status so no customer reads a stage label that misstates what happened.
  const sequenceIndex = postProduction
    ? stageIndex(TIMELINE_POST_PRODUCTION_STAGE[currentStatus])
    : stageIndex(currentStatus);

  // A cancelled order's progress is however far it actually got, read off the
  // history, because `cancelled` is not a point in the sequence.
  const lastReachedIndex = isCancelled
    ? ORDER_STAGES.reduce((acc, stage, idx) => (historyByStage.has(stage.key) ? idx : acc), -1)
    : sequenceIndex;

  // Only a real, in-sequence status makes a stage ACTIVE. A cancelled order has
  // stopped, and a post-production order has left the sequence — in both cases
  // "this is being worked on right now" would be a false claim, so the banner
  // carries the truth instead.
  const activeIndex = !isCancelled && !postProduction ? sequenceIndex : -1;

  const trackingNumber = input.trackingNumber?.trim() ? input.trackingNumber : null;
  const showTrackingBlock =
    rules.tracking && trackingNumber !== null && TRACKING_STATUSES.includes(currentStatus) && !isCancelled;

  const shopPhotoUrl = input.shopPhotoUrl?.trim() ? input.shopPhotoUrl : null;
  const showPhoto = rules.photo && shopPhotoUrl !== null && !isCancelled;

  const rows: TimelineRowView[] = ORDER_STAGES.map((stage, idx) => {
    // `lastReachedIndex` is the furthest stage this order got to. The stage the
    // order is ON is `active` when there is one (a live, in-sequence status) and
    // `completed` otherwise — a cancelled or post-production order has reached
    // that stage but is not working on it.
    const state: StageVisualState =
      idx === activeIndex ? 'active' : idx <= lastReachedIndex ? 'completed' : 'pending';

    const entry = historyByStage.get(stage.key) ?? null;
    const showDescription =
      rules.descriptions === 'completed-and-active'
        ? state !== 'pending'
        : rules.descriptions === 'active-only'
        ? state === 'active'
        : false;

    return {
      key: stage.key,
      label: stageLabel(stage, variant),
      description: showDescription ? stage.description : null,
      state,
      struckThrough: isCancelled && state === 'pending',
      timestamp: entry?.changedAt ?? null,
      note: rules.notes ? entry?.note ?? null : null,
      changedByName: rules.notes ? entry?.changedByName ?? null : null,
      isCurrent: idx === activeIndex,
      showTracking: showTrackingBlock && stage.key === TRACKING_ROW_STAGE,
      showPhoto: showPhoto && stage.key === PHOTO_SLOT_AFTER_STAGE,
    };
  });

  let banner: TimelineBannerView | null = null;
  if (isCancelled) {
    const cancelledEntry = historyByStage.get('cancelled') ?? null;
    banner = {
      kind: 'cancelled',
      text: 'This order was cancelled.',
      at: cancelledEntry?.changedAt ?? null,
    };
  } else if (postProduction) {
    banner = {
      kind: 'post_production',
      text: `Current status: ${POST_PRODUCTION_LABEL[currentStatus]}`,
      at: historyByStage.get(currentStatus)?.changedAt ?? null,
    };
  } else if (sequenceIndex === -1) {
    // A status the fabrication sequence does not contain and the
    // post-production set does not either — a widened database CHECK, a hand
    // edit, a future stage. Say so. Rendering nine pending stages with no
    // explanation is the failure PRODUCTION_QUEUE_AUDIT.md §2a describes.
    banner = {
      kind: 'unknown',
      text: `Current status: ${currentStatus}`,
      at: historyByStage.get(currentStatus)?.changedAt ?? null,
    };
  }

  const hasShipped = currentStatus === 'shipped' || currentStatus === 'delivered';
  const estimatedShipDate =
    rules.estimatedShipDate && !isCancelled && !hasShipped && input.estimatedShipDate?.trim()
      ? input.estimatedShipDate
      : null;

  const stagesReached = lastReachedIndex + 1;
  const currentRowLabel = activeIndex >= 0 ? rows[activeIndex].label : null;
  const valueText = isCancelled
    ? stagesReached > 0
      ? `Cancelled after ${rows[lastReachedIndex].label} — ${stagesReached} of ${ORDER_STAGES.length} stages completed`
      : `Cancelled before fabrication started — 0 of ${ORDER_STAGES.length} stages completed`
    : banner !== null
    ? `${banner.text.replace(/^Current status: /, '')} — ${stagesReached} of ${ORDER_STAGES.length} fabrication stages reached`
    : currentRowLabel !== null
    ? `${currentRowLabel} — stage ${stagesReached} of ${ORDER_STAGES.length}`
    : `0 of ${ORDER_STAGES.length} stages reached`;

  return {
    variant,
    banner,
    estimatedShipDate,
    rows,
    photo: showPhoto && shopPhotoUrl !== null ? { url: shopPhotoUrl, caption: PRE_SHIP_PHOTO_CAPTION } : null,
    tracking:
      showTrackingBlock && trackingNumber !== null
        ? {
            trackingNumber,
            carrier: input.carrier?.trim() ? input.carrier : null,
            url: resolveTrackingUrl(input.carrier, trackingNumber),
          }
        : null,
    progress: {
      stagesReached: Math.max(0, stagesReached),
      totalStages: ORDER_STAGES.length,
      valueText,
    },
    isEmpty: history.length === 0,
    emptyMessage: history.length === 0 ? EMPTY_MESSAGE[variant] : null,
  };
}
