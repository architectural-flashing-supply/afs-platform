// Stage labels are PLACEHOLDERS pending exact shop language from AFS (checklist #39).
// See SPEC_PRODUCTION_TIMELINE.md §2.
//
// Only the customer-facing render path is implemented here — this component
// used to accept a `variant` prop with 'admin'/'public' branches, but neither
// was ever rendered anywhere in the app (PRODUCTION_QUEUE_AUDIT.md §2b): the
// admin order detail page uses the purpose-built StatusAdvancer instead, and
// the public order tracker at app/track/[orderId]/page.tsx is a separate,
// hand-rolled live-delivery-map page with its own status vocabulary. Those
// branches were removed rather than built out further — see
// SPEC_PRODUCTION_TIMELINE.md §1 for the documented decision.
import {
  ORDER_STAGES,
  POST_PRODUCTION_STATUSES,
  stageIndex,
  type OrderStageKey,
  type OrderStatus,
} from '@/lib/admin/orderStages';

export type { OrderStatus, OrderStageKey };

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ...(Object.fromEntries(ORDER_STAGES.map((s) => [s.key, s.label])) as Record<OrderStageKey, string>),
  in_production: 'In Production',
  packaged: 'Packaged',
  out_for_delivery: 'Out for Delivery',
  cancelled: 'Cancelled',
};

export interface StatusHistoryItem {
  status: string;
  changedAt: string;
  note?: string | null;
}

export interface ProductionTimelineProps {
  currentStatus: OrderStatus;
  statusHistory: StatusHistoryItem[];
  estimatedShipDate?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  shopPhotoUrl?: string | null;
}

const CARRIER_TRACKING_URLS: Record<string, (trackingNumber: string) => string> = {
  ups: (n) => `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(n)}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
};

function resolveTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  if (!carrier || !trackingNumber) return null;
  const key = carrier.trim().toLowerCase().replace(/[^a-z]/g, '');
  const resolver = CARRIER_TRACKING_URLS[key];
  return resolver ? resolver(trackingNumber) : null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type StageVisualState = 'completed' | 'active' | 'pending';

function Dot({ state }: { state: StageVisualState }) {
  if (state === 'pending') {
    return <span className="relative z-10 shrink-0 w-3 h-3 rounded-full border-2 border-afs-chrome-dim bg-afs-bg-base" />;
  }
  return (
    <span className="relative z-10 flex h-3 w-3 shrink-0">
      {state === 'active' && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-afs-crimson opacity-75" />
      )}
      <span className="relative inline-flex h-3 w-3 rounded-full bg-afs-crimson" />
    </span>
  );
}

function Connector({ dashed }: { dashed: boolean }) {
  return (
    <div
      className={`w-0 flex-1 mt-1 border-l-2 ${dashed ? 'border-dashed border-afs-chrome-dim' : 'border-afs-crimson'}`}
      style={{ minHeight: '1.75rem' }}
    />
  );
}

// PRODUCTION_QUEUE_AUDIT.md §2a — orders.status accepts three Employee PWA /
// delivery-tracking values (in_production, packaged, out_for_delivery) that
// aren't part of the ORDER_STAGES fabrication sequence. Without this, an
// order sitting in one of these statuses has no match in ORDER_STAGES
// (currentIndex === -1), so every stage below rendered as 'pending' — the
// timeline looked like nothing had happened yet for an order that had
// actually left the shop floor. Each is mapped to the fabrication stage it
// is closest to/past, so the timeline still shows real progress, plus an
// explicit banner naming the real status.
const POST_PRODUCTION_EQUIVALENT_STAGE: Record<string, OrderStageKey> = {
  in_production: 'ready',
  packaged: 'ready',
  out_for_delivery: 'shipped',
};

export default function ProductionTimeline({
  currentStatus,
  statusHistory,
  estimatedShipDate = null,
  trackingNumber = null,
  carrier = null,
  shopPhotoUrl = null,
}: ProductionTimelineProps) {
  const isCancelled = currentStatus === 'cancelled';
  const isPostProduction = (POST_PRODUCTION_STATUSES as readonly string[]).includes(currentStatus);
  const equivalentStage = POST_PRODUCTION_EQUIVALENT_STAGE[currentStatus];
  const currentIndex = equivalentStage ? stageIndex(equivalentStage) : ORDER_STAGES.findIndex((s) => s.key === currentStatus);

  const historyByStage = new Map<string, StatusHistoryItem>();
  for (const item of [...statusHistory].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  )) {
    historyByStage.set(item.status, item);
  }

  const lastReachedIndex = isCancelled
    ? ORDER_STAGES.reduce(
        (acc, stage, idx) => (historyByStage.has(stage.key) ? idx : acc),
        -1
      )
    : currentIndex;

  const cancelledEntry = statusHistory.find((h) => h.status === 'cancelled') ?? null;
  const trackingUrl = resolveTrackingUrl(carrier, trackingNumber);
  const showTrackingBlock =
    Boolean(trackingNumber) && (currentStatus === 'shipped' || currentStatus === 'delivered' || currentStatus === 'out_for_delivery');

  return (
    <div data-testid="production-timeline" className="flex flex-col">
      {isCancelled && (
        <div className="flex items-center gap-2 mb-6 bg-[var(--afs-crimson-ghost)] border border-afs-crimson rounded px-4 py-3">
          <svg className="w-4 h-4 text-afs-crimson shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="font-label text-sm text-afs-chrome-high">
            This order was cancelled{cancelledEntry ? ` on ${formatDateTime(cancelledEntry.changedAt)}` : ''}.
          </p>
        </div>
      )}

      {!isCancelled && isPostProduction && (
        <div className="flex items-center gap-2 mb-6 bg-afs-bg-overlay border border-afs-border rounded px-4 py-3">
          <p className="font-label text-sm text-afs-chrome-high">
            Current status: <span className="text-afs-crimson">{ORDER_STATUS_LABEL[currentStatus]}</span>
          </p>
        </div>
      )}

      {!isCancelled && estimatedShipDate && currentStatus !== 'shipped' && currentStatus !== 'delivered' && (
        <p className="font-body text-xs text-afs-chrome-mid mb-6">
          Estimated ship date: <span className="font-data text-afs-chrome-high">{formatDateTime(estimatedShipDate)}</span>
        </p>
      )}

      {ORDER_STAGES.map((stage, idx) => {
        const state: StageVisualState = isCancelled
          ? idx <= lastReachedIndex
            ? 'completed'
            : 'pending'
          : idx < currentIndex
          ? 'completed'
          : idx === currentIndex
          ? 'active'
          : 'pending';

        const history = historyByStage.get(stage.key) ?? null;
        const isLast = idx === ORDER_STAGES.length - 1;
        const struckThrough = isCancelled && state === 'pending';

        return (
          <div key={stage.key}>
            <div className="relative flex" data-testid={`stage-${stage.key}`} data-active={state === 'active' ? 'true' : 'false'}>
              <div className="flex flex-col items-center mr-4">
                <Dot state={state} />
                {!isLast && <Connector dashed={state === 'pending'} />}
              </div>
              <div className="pb-8 flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <span
                    className={`font-heading text-base ${struckThrough ? 'line-through' : ''} ${
                      state === 'pending' ? 'text-afs-chrome-dim' : 'text-afs-chrome-high'
                    }`}
                  >
                    {stage.label}
                  </span>
                  {history && (
                    <span className="font-data text-xs text-afs-chrome-base shrink-0">
                      {formatDateTime(history.changedAt)}
                    </span>
                  )}
                </div>
                {state !== 'pending' && (
                  <p className="font-body text-sm text-afs-chrome-mid mt-1">{stage.description}</p>
                )}
                {state === 'active' && !isPostProduction && (
                  <p className="eyebrow-label text-xs tracking-wide mt-1">In progress</p>
                )}
                {stage.key === 'shipped' && showTrackingBlock && (
                  <div className="mt-2">
                    {trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-data text-xs text-afs-crimson hover:text-afs-crimson-hover underline"
                      >
                        Track shipment: {trackingNumber}
                        {carrier ? ` (${carrier})` : ''}
                      </a>
                    ) : (
                      <p className="font-data text-xs text-afs-chrome-mid">
                        Tracking: {trackingNumber}
                        {carrier ? ` · ${carrier}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {stage.key === 'qc' && shopPhotoUrl && (
              <div className="relative flex" data-testid="pre-ship-photo-slot">
                <div className="flex flex-col items-center mr-4">
                  <span className="w-3 h-3 shrink-0" />
                  <Connector dashed={false} />
                </div>
                <div className="pb-8 flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shopPhotoUrl}
                    alt="Your completed order — ready to ship"
                    className="rounded border border-afs-chrome-dim max-w-xs"
                  />
                  <p className="font-body text-xs text-afs-chrome-mid mt-2">Your completed order — ready to ship</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
