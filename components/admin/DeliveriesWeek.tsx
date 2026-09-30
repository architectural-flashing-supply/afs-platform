'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DeliveriesView, DeliveryStop, UnscheduledJob } from '@/lib/data/deliveries';
import { DELIVERY_WINDOW_OPTIONS, DEFAULT_DELIVERY_WINDOW } from '@/lib/delivery/windows';
import { formatDayHeading } from '@/lib/delivery/business-days';

/**
 * DELIVERIES — the five-day week, the stops on each day, the "Not scheduled
 * yet" panel, and the day + time-window window, exactly as the approved
 * prototype draws them (`deliveriesView` and the `schedule` modal).
 *
 * TWO ACTIONS, AND NEITHER IS AMBIGUOUS. A stop offers **Mark delivered**. An
 * unscheduled job offers **Schedule delivery**, and a scheduled stop offers
 * **Change day** — the same window, the same route, because scheduling and
 * rescheduling are one thing from the user's side.
 *
 * The scheduling window offers the next ten business days rather than a free
 * date field. A weekday picker with four named windows cannot produce a
 * Saturday, a typo, or a date in 1970, so the server's refusals
 * (app/api/admin/deliveries/schedule) exist as a second line and not as the
 * only one.
 *
 * NO POLLING HERE. This is an office screen somebody opens, acts on, and
 * leaves — unlike the shop tablet. `router.refresh()` after a write is the
 * whole refresh story, so there is no interval to pause.
 */

type Result = { tone: 'ok' | 'info' | 'error'; message: string } | null;

interface ScheduleTarget {
  shopJobId: string;
  customer: string;
  item: string;
  quantity: number | null;
  currentDate: string | null;
  currentWindow: string | null;
}

export default function DeliveriesWeek({
  view,
  pickerDays,
}: {
  view: DeliveriesView;
  /** The next ten business days, computed on the server in the shop's zone. */
  pickerDays: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [target, setTarget] = useState<ScheduleTarget | null>(null);
  const [day, setDay] = useState<string>(pickerDays[0] ?? '');
  // Named timeWindow, not `window` — shadowing the global in a client
  // component is a trap waiting for the first person who needs it.
  const [timeWindow, setTimeWindow] = useState<string>(DEFAULT_DELIVERY_WINDOW);
  const [notify, setNotify] = useState<boolean>(true);

  const dayOptions = useMemo(
    () => pickerDays.map((d) => ({ value: d, label: formatDayHeading(d) })),
    [pickerDays]
  );

  function openScheduler(t: ScheduleTarget) {
    setTarget(t);
    setDay(t.currentDate && pickerDays.includes(t.currentDate) ? t.currentDate : (pickerDays[0] ?? ''));
    setTimeWindow(t.currentWindow ?? DEFAULT_DELIVERY_WINDOW);
    setNotify(true);
    setResult(null);
  }

  async function post(label: string, url: string, body: Record<string, unknown>) {
    setBusy(label);
    setResult(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setResult({
          tone: data.alreadyDelivered === true ? 'info' : 'ok',
          message: typeof data.message === 'string' ? data.message : 'Done.',
        });
        setTarget(null);
        router.refresh();
      } else {
        setResult({
          tone: 'error',
          message: typeof data.error === 'string' ? data.error : 'That did not go through.',
        });
      }
    } catch {
      setResult({ tone: 'error', message: 'The connection dropped, so nothing was changed.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {result && (
        <p
          role="status"
          data-testid="deliveries-result"
          className={`font-body text-[17px] rounded-lg p-3.5 ${
            result.tone === 'error'
              ? 'bg-afs-bg-card border border-afs-line-strong text-afs-crimson'
              : result.tone === 'info'
                ? 'bg-afs-amber-bg text-afs-amber-ink'
                : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {result.message}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[3fr_1fr] grid-cols-1">
        {/* ---------------- THE WEEK ---------------- */}
        <div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3 xl:grid-cols-5" data-testid="delivery-week">
            {view.days.map((d) => (
              <section
                key={d.date}
                data-testid="delivery-day"
                data-date={d.date}
                className="bg-afs-bg-card border border-afs-border-light rounded-xl p-3.5 flex flex-col gap-2.5"
              >
                <h2 className="font-heading text-xl text-afs-ink-900 m-0">{d.heading}</h2>
                {d.stops.length === 0 ? (
                  <p className="font-body text-[15px] text-afs-ink-700 m-0">No deliveries</p>
                ) : (
                  d.stops.map((s) => <Stop key={s.deliveryId} stop={s} busy={busy} onMark={post} onChange={openScheduler} />)
                )}
              </section>
            ))}
          </div>

          {view.beyondWeek.count > 0 && (
            <p data-testid="beyond-week" className="font-body text-[15px] text-afs-ink-700 mt-3">
              {view.beyondWeek.count === 1
                ? `1 more delivery is booked beyond this week, the next on ${view.beyondWeek.earliestHeading}.`
                : `${view.beyondWeek.count} more deliveries are booked beyond this week, the next on ${view.beyondWeek.earliestHeading}.`}
            </p>
          )}
        </div>

        {/* ---------------- NOT SCHEDULED YET ---------------- */}
        <section
          data-testid="not-scheduled"
          className="bg-afs-bg-card border border-afs-border-light rounded-xl p-4 flex flex-col gap-2.5 self-start"
        >
          <h2 className="font-heading text-xl text-afs-ink-900 m-0">Not scheduled yet</h2>
          {view.unscheduled.length === 0 ? (
            <p className="font-body text-[15px] text-afs-ink-700 m-0">
              Everything the machine has finished has a delivery day.
            </p>
          ) : (
            view.unscheduled.map((u) => (
              <Unscheduled key={u.shopJobId} job={u} busy={busy} onSchedule={openScheduler} />
            ))
          )}
        </section>
      </div>

      {/* ---------------- THE DAY + WINDOW WINDOW ---------------- */}
      {target && (
        <div
          className="fixed inset-0 z-50 bg-afs-bg-overlay/80 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Schedule delivery"
            data-testid="schedule-modal"
            className="bg-afs-bg-card rounded-xl p-5 w-full max-w-lg flex flex-col gap-3.5"
          >
            <h2 className="font-heading text-2xl text-afs-ink-900 m-0">
              {target.currentDate ? 'Change the delivery day' : 'Schedule delivery'}
            </h2>
            <p className="font-body text-[17px] text-afs-ink-900 m-0">
              <b>{target.customer}</b>, {target.item}
              {target.quantity ? ` × ${target.quantity}` : ''}
            </p>

            <div className="grid gap-3 sm:grid-cols-2 grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="delivery-day" className="font-label text-[15px] font-bold text-afs-ink-900">
                  Day
                </label>
                <select
                  id="delivery-day"
                  data-testid="delivery-day-select"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="min-h-12 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body text-[17px] px-3"
                >
                  {dayOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="delivery-window" className="font-label text-[15px] font-bold text-afs-ink-900">
                  Time window
                </label>
                <select
                  id="delivery-window"
                  data-testid="delivery-window-select"
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className="min-h-12 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body text-[17px] px-3"
                >
                  {DELIVERY_WINDOW_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 font-label text-[17px] font-bold text-afs-ink-900 min-h-12 cursor-pointer">
              <input
                type="checkbox"
                data-testid="delivery-notify"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="w-5 h-5"
              />
              Text and email the customer a tracking link
            </label>

            <div className="flex gap-2.5 justify-end flex-wrap">
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="min-h-12 px-5 rounded-lg font-label text-[17px] font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-schedule"
                disabled={busy !== null || day === ''}
                onClick={() =>
                  post('schedule', '/api/admin/deliveries/schedule', {
                    shopJobId: target.shopJobId,
                    scheduledDate: day,
                    timeWindow,
                    notify,
                  })
                }
                className="min-h-12 px-5 rounded-lg font-label text-[17px] font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-60"
              >
                {busy === 'schedule' ? 'Saving…' : target.currentDate ? 'Move the delivery' : 'Schedule delivery'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stop({
  stop,
  busy,
  onMark,
  onChange,
}: {
  stop: DeliveryStop;
  busy: string | null;
  onMark: (label: string, url: string, body: Record<string, unknown>) => void;
  onChange: (t: ScheduleTarget) => void;
}) {
  const delivered = stop.status === 'delivered';
  return (
    <div
      data-testid="delivery-stop"
      data-delivery-id={stop.deliveryId}
      data-status={stop.status}
      className={`rounded-lg p-3 flex flex-col gap-1.5 ${
        delivered ? 'bg-afs-green-soft' : 'bg-afs-bg-light-raised'
      }`}
    >
      <b className="font-label text-[17px] text-afs-ink-900">
        {stop.customer}
        {stop.isRush && (
          <span className="ml-2 font-label text-[13px] font-bold uppercase tracking-wide bg-afs-amber-bg text-afs-amber-ink rounded px-1.5 py-0.5">
            Rush
          </span>
        )}
      </b>
      <span className="font-body text-[15px] text-afs-ink-900">
        {stop.item}
        {stop.quantity ? ` × ${stop.quantity}` : ''}
      </span>
      <span className="font-body text-[15px] text-afs-ink-700">
        {stop.timeWindowLabel}
        {stop.autoScheduled ? ' · set by the shop' : ''}
      </span>
      {delivered ? (
        <span className="font-label text-[15px] font-bold text-afs-green-ink">✓ Delivered</span>
      ) : (
        <>
          <button
            type="button"
            data-testid="mark-delivered"
            disabled={busy !== null}
            onClick={() =>
              onMark('delivered', '/api/admin/deliveries/mark-delivered', { deliveryId: stop.deliveryId })
            }
            className="min-h-12 rounded-lg font-label text-[17px] font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-60"
          >
            {busy === 'delivered' ? 'Saving…' : 'Mark delivered'}
          </button>
          <button
            type="button"
            data-testid="change-day"
            disabled={busy !== null}
            onClick={() =>
              onChange({
                shopJobId: stop.shopJobId,
                customer: stop.customer,
                item: stop.item,
                quantity: stop.quantity,
                currentDate: stop.scheduledDate,
                currentWindow: stop.timeWindow,
              })
            }
            className="min-h-12 rounded-lg font-label text-[15px] font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised disabled:opacity-60"
          >
            Change day
          </button>
        </>
      )}
      {stop.notifyNote && (
        <span className="font-body text-[13px] text-afs-ink-700">{stop.notifyNote}</span>
      )}
    </div>
  );
}

function Unscheduled({
  job,
  busy,
  onSchedule,
}: {
  job: UnscheduledJob;
  busy: string | null;
  onSchedule: (t: ScheduleTarget) => void;
}) {
  return (
    <div
      data-testid="unscheduled-job"
      data-shop-job-id={job.shopJobId}
      data-rush={job.isRush ? 'true' : 'false'}
      className="bg-afs-bg-light-raised rounded-lg p-3 flex flex-col gap-1.5"
    >
      <b className="font-label text-[17px] text-afs-ink-900">
        {job.customer}
        {job.isRush && (
          <span className="ml-2 font-label text-[13px] font-bold uppercase tracking-wide bg-afs-amber-bg text-afs-amber-ink rounded px-1.5 py-0.5">
            Rush
          </span>
        )}
      </b>
      <span className="font-body text-[15px] text-afs-ink-900">
        {job.item}
        {job.quantity ? ` × ${job.quantity}` : ''}
      </span>
      <span className="font-body text-[13px] text-afs-ink-700">
        {job.jobStage === 'done' ? 'Job is Done' : 'Finished at the machine'}
      </span>
      <button
        type="button"
        data-testid="schedule-delivery"
        disabled={busy !== null}
        onClick={() =>
          onSchedule({
            shopJobId: job.shopJobId,
            customer: job.customer,
            item: job.item,
            quantity: job.quantity,
            currentDate: null,
            currentWindow: null,
          })
        }
        className="min-h-12 rounded-lg font-label text-[17px] font-bold bg-afs-crimson text-afs-chrome-high hover:brightness-95 disabled:opacity-60"
      >
        Schedule delivery
      </button>
    </div>
  );
}
