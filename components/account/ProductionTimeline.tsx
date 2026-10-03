// THE shared production-status timeline — SPEC_PRODUCTION_TIMELINE.md §1's
// "shared across three surfaces", now actually shared:
//
//   customer  app/account/orders/[id]/page.tsx     signed-in order detail
//   admin     app/admin/orders/[id]/page.tsx       beside StatusAdvancer
//   public    components/track/OrderStatusLookup.tsx  anonymous /order-status
//
// The `variant` prop is REQUIRED and has no default. An earlier pass deleted
// the admin and public branches because neither had a call site
// (PRODUCTION_QUEUE_AUDIT.md §2b); they are back because all three now do, and
// a default would be the quiet way back to showing customer prose to the shop.
//
// EVERY PRESENTATION DECISION IS MADE IN lib/production/timeline-view.ts and
// every label in lib/admin/orderStages.ts. This file is the translation of that
// view model into JSX and nothing else — no stage list, no variant conditional
// beyond rendering what the model says is there, no label text. Stage labels
// stay placeholders pending checklist #39, and when it lands the edit is to the
// config module alone.
//
// Stays free of `'use client'`, state and effects so it renders from a server
// component on two pages and from inside a client component on the third,
// without a second implementation. The one interactive part — the pre-ship
// photo's lightbox — is its own client child.
//
// COLOURS. This component is rendered on /admin/orders/[id], which is inside
// scripts/audit/contrast-check.mjs's build gate (CLAUDE.md rule #28), so every
// pair here must clear WCAG AA on gunmetal. Three corrections were needed and
// are recorded in STATE_OF_THE_BUILD.md: afs-chrome-dim measured 2.88:1 on
// afs-bg-raised and is now afs-chrome-silver (7.13:1, rule #18);
// afs-chrome-base measured 4.26:1 as body text and is now afs-chrome-mid
// (5.99:1); and afs-crimson as TEXT is 1.42:1 on gunmetal, so the tracking
// link and the in-progress eyebrow use afs-danger-on-dark (rule #29). The old
// `bg-[var(--afs-crimson-ghost)]` was also removed — an arbitrary colour value
// raises the gate's `unresolved` count, which rule #28 defines as the gate
// getting blinder.
import {
  TIMELINE_ERROR_BODY,
  TIMELINE_ERROR_HEADLINE,
  TIMELINE_LOADING_LABEL,
  buildTimelineView,
  type StageVisualState,
  type StatusHistoryEntry,
  type TimelineVariant,
} from '@/lib/production/timeline-view';
import {
  CANCELLED_LABEL,
  ORDER_STAGES,
  POST_PRODUCTION_LABEL,
  type OrderStageKey,
  type OrderStatus,
} from '@/lib/admin/orderStages';
import PreShipPhotoThumb from '@/components/account/PreShipPhotoThumb';

export type { OrderStatus, OrderStageKey, TimelineVariant };

/**
 * Customer-facing label for any value `orders.status` can hold — used by the
 * order-detail header's Badge, which sits outside this component. Built from
 * the config module so it cannot drift from the timeline below it.
 */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(ORDER_STAGES.map((s) => [s.key, s.customerLabel])),
  ...POST_PRODUCTION_LABEL,
  cancelled: CANCELLED_LABEL,
};

/** Re-exported under the name the existing call sites import. */
export type StatusHistoryItem = StatusHistoryEntry;

/** `ready` renders the timeline; the other two are the surfaces' own states. */
export type TimelineLoadState = 'ready' | 'loading' | 'error';

export interface ProductionTimelineProps {
  currentStatus: string;
  statusHistory: StatusHistoryItem[];
  variant: TimelineVariant;
  estimatedShipDate?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  shopPhotoUrl?: string | null;
  loadState?: TimelineLoadState;
  /** Shown instead of the generic body when the caller knows something more useful. */
  errorMessage?: string | null;
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

function Dot({ state }: { state: StageVisualState }) {
  if (state === 'pending') {
    return (
      <span
        aria-hidden="true"
        className="relative z-10 shrink-0 w-3 h-3 rounded-full border-2 border-afs-chrome-base bg-afs-bg-base"
      />
    );
  }
  return (
    <span aria-hidden="true" className="relative z-10 flex h-3 w-3 shrink-0">
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
      aria-hidden="true"
      className={`w-0 flex-1 mt-1 border-l-2 ${dashed ? 'border-dashed border-afs-chrome-base' : 'border-afs-crimson'}`}
      style={{ minHeight: '1.75rem' }}
    />
  );
}

/**
 * The gutter every row shares: the dot, and the connector down to the next row.
 * The photo slot reuses it with an invisible dot so its content lines up with
 * the stage text rather than with the rail.
 */
function Rail({ state, showConnector, invisibleDot = false }: { state: StageVisualState; showConnector: boolean; invisibleDot?: boolean }) {
  return (
    <div className="flex flex-col items-center mr-4">
      {invisibleDot ? <span aria-hidden="true" className="w-3 h-3 shrink-0" /> : <Dot state={state} />}
      {showConnector && <Connector dashed={state === 'pending'} />}
    </div>
  );
}

function TimelineShell({ children, busy = false }: { children: React.ReactNode; busy?: boolean }) {
  return (
    <div data-testid="production-timeline" aria-busy={busy ? 'true' : undefined} className="flex flex-col">
      {children}
    </div>
  );
}

export default function ProductionTimeline({
  currentStatus,
  statusHistory,
  variant,
  estimatedShipDate = null,
  trackingNumber = null,
  carrier = null,
  shopPhotoUrl = null,
  loadState = 'ready',
  errorMessage = null,
}: ProductionTimelineProps) {
  if (loadState === 'loading') {
    // Nine skeleton rows, because nine is what will arrive — a spinner of a
    // different shape makes the panel jump when the data lands.
    return (
      <TimelineShell busy>
        <p data-testid="production-timeline-loading" className="font-body text-sm text-afs-chrome-mid mb-4">
          {TIMELINE_LOADING_LABEL}
        </p>
        <div className="flex flex-col gap-4" aria-hidden="true">
          {ORDER_STAGES.map((stage) => (
            <div key={stage.key} className="flex items-center gap-4">
              <span className="shrink-0 w-3 h-3 rounded-full border-2 border-afs-chrome-base" />
              <span className="h-3 w-40 rounded bg-afs-bg-overlay animate-pulse" />
            </div>
          ))}
        </div>
      </TimelineShell>
    );
  }

  if (loadState === 'error') {
    // CLAUDE.md rule #30: no blame, no stack trace, and say what did NOT
    // happen. Here that is "only this display failed" — the order has not moved.
    return (
      <TimelineShell>
        <div
          data-testid="production-timeline-error"
          role="alert"
          className="bg-afs-bg-overlay border border-afs-crimson rounded px-4 py-3"
        >
          <p className="font-heading text-base text-afs-chrome-high">{TIMELINE_ERROR_HEADLINE}</p>
          {/*
            afs-chrome-silver, not afs-chrome-mid: this panel's surface is
            afs-bg-overlay (#4E5568), the lightest gunmetal, where chrome-mid
            measures 4.04:1 — the contrast gate caught it on /admin/orders/[id].
            chrome-silver is 4.80:1 there (CLAUDE.md rule #18's surface-by-surface
            point, one surface further along).
          */}
          <p className="font-body text-sm text-afs-chrome-silver mt-1">{errorMessage ?? TIMELINE_ERROR_BODY}</p>
        </div>
      </TimelineShell>
    );
  }

  const view = buildTimelineView({
    currentStatus,
    statusHistory,
    variant,
    estimatedShipDate,
    trackingNumber,
    carrier,
    shopPhotoUrl,
  });

  return (
    <TimelineShell>
      {view.banner && (
        <div
          data-testid={`timeline-banner-${view.banner.kind}`}
          className={`flex items-center gap-2 mb-6 rounded px-4 py-3 ${
            view.banner.kind === 'cancelled'
              ? 'bg-afs-bg-overlay border border-afs-crimson'
              : 'bg-afs-bg-overlay border border-afs-border'
          }`}
        >
          {view.banner.kind === 'cancelled' && (
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-afs-danger-on-dark shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <p className="font-label text-sm text-afs-chrome-high">
            {view.banner.text}
            {view.banner.at ? ` (${formatDateTime(view.banner.at)})` : ''}
          </p>
        </div>
      )}

      {/*
        Progress semantics. The visible line and the accessible value are the
        same element, so a screen reader and a sighted user are told the same
        thing — `aria-valuetext` is what a progressbar announces, and "stage 4
        of 9 — Cutting" is more use than "44%".
      */}
      <div
        data-testid="timeline-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={view.progress.totalStages}
        aria-valuenow={view.progress.stagesReached}
        aria-valuetext={view.progress.valueText}
        aria-label="Production progress"
        className="font-data text-xs text-afs-chrome-mid mb-4"
      >
        {view.progress.valueText}
      </div>

      {view.estimatedShipDate && (
        <p data-testid="timeline-estimated-ship" className="font-body text-xs text-afs-chrome-mid mb-6">
          Estimated ship date:{' '}
          <span className="font-data text-afs-chrome-high">{formatDateTime(view.estimatedShipDate)}</span>
        </p>
      )}

      {view.isEmpty && view.emptyMessage && (
        <p data-testid="production-timeline-empty" className="font-body text-sm text-afs-chrome-mid mb-6">
          {view.emptyMessage}
        </p>
      )}

      {/*
        `role="list"` is set explicitly even though <ol> carries it implicitly:
        Safari drops list semantics from an element whose list-style is none,
        which `list-none` sets. The stages are an ordered sequence, so <ol>
        rather than <ul>.
      */}
      <ol role="list" className="list-none m-0 p-0" data-testid="timeline-stages">
        {view.rows.map((row, idx) => {
          const isLastRow = idx === view.rows.length - 1;
          return (
            <li key={row.key} className="list-none">
              <div
                className="relative flex"
                data-testid={`stage-${row.key}`}
                data-state={row.state}
                data-active={row.state === 'active' ? 'true' : 'false'}
                aria-current={row.isCurrent ? 'step' : undefined}
              >
                <Rail state={row.state} showConnector={!isLastRow || row.showPhoto} />
                <div className="pb-8 flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <span
                      className={`font-heading text-base ${row.struckThrough ? 'line-through' : ''} ${
                        row.state === 'pending' ? 'text-afs-chrome-silver' : 'text-afs-chrome-high'
                      }`}
                    >
                      {row.label}
                    </span>
                    {row.timestamp && (
                      <span className="font-data text-xs text-afs-chrome-mid shrink-0">{formatDateTime(row.timestamp)}</span>
                    )}
                  </div>

                  {row.description && <p className="font-body text-sm text-afs-chrome-mid mt-1">{row.description}</p>}

                  {row.state === 'active' && (
                    <p className="font-label uppercase tracking-wide text-xs text-afs-danger-on-dark mt-1">In progress</p>
                  )}

                  {row.note && (
                    <p data-testid={`stage-note-${row.key}`} className="font-body text-sm text-afs-chrome-mid mt-1">
                      {row.note}
                    </p>
                  )}

                  {row.changedByName && (
                    <p className="font-body text-xs text-afs-chrome-mid mt-1">by {row.changedByName}</p>
                  )}

                  {row.showTracking && view.tracking && (
                    <div className="mt-2" data-testid="timeline-tracking">
                      {view.tracking.url ? (
                        <a
                          href={view.tracking.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-data text-xs text-afs-danger-on-dark hover:text-afs-chrome-high underline"
                        >
                          Track shipment: {view.tracking.trackingNumber}
                          {view.tracking.carrier ? ` (${view.tracking.carrier})` : ''}
                        </a>
                      ) : (
                        <p className="font-data text-xs text-afs-chrome-mid">
                          Tracking: {view.tracking.trackingNumber}
                          {view.tracking.carrier ? ` · ${view.tracking.carrier}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {row.showPhoto && view.photo && (
                <div className="relative flex" data-testid="pre-ship-photo-slot">
                  <Rail state="completed" showConnector={!isLastRow} invisibleDot />
                  <div className="pb-8 flex-1 min-w-0">
                    <PreShipPhotoThumb url={view.photo.url} caption={view.photo.caption} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </TimelineShell>
  );
}
