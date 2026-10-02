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

/**
 * v7's `.pstrip` notice and `.dcard` stop, per state. Maps to the WHOLE
 * className rather than templates: the contrast gate expands class maps but
 * counts a runtime template as `unresolved` (CLAUDE.md rule #28).
 */
const RESULT_CLASS: Record<'ok' | 'info' | 'error', string> = {
  ok: 'pstrip green',
  info: 'pstrip amber',
  error: 'pstrip red',
};

const STOP_CLASS: Record<'delivered' | 'scheduled', string> = {
  delivered: 'dcard done',
  scheduled: 'dcard',
};

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
    <div className="dlist">
      {result && (
        <p
          role="status"
          data-testid="deliveries-result"
          className={RESULT_CLASS[result.tone]}
        >
          {result.message}
        </p>
      )}

      <div className="dlist">
        {/* ---------------- THE WEEK ---------------- */}
        <div>
          <div className="dgrid" data-testid="delivery-week">
            {view.days.map((d) => (
              <section
                key={d.date}
                data-testid="delivery-day"
                data-date={d.date}
                className="day"
              >
                {/* v7's `.dh` day header: the name, then the sub-line. */}
                <div className="dh">
                  <div className="dn">{d.heading}</div>
                </div>
                {d.stops.length === 0 ? (
                  <p className="hint">No deliveries</p>
                ) : (
                  d.stops.map((s) => <Stop key={s.deliveryId} stop={s} busy={busy} onMark={post} onChange={openScheduler} />)
                )}
              </section>
            ))}
          </div>

          {view.beyondWeek.count > 0 && (
            <p data-testid="beyond-week" className="hint">
              {view.beyondWeek.count === 1
                ? `1 more delivery is booked beyond this week, the next on ${view.beyondWeek.earliestHeading}.`
                : `${view.beyondWeek.count} more deliveries are booked beyond this week, the next on ${view.beyondWeek.earliestHeading}.`}
            </p>
          )}
        </div>

        {/* ---------------- NOT SCHEDULED YET ---------------- */}
        <section
          data-testid="not-scheduled"
          className="day"
        >
          <h2>Not scheduled yet</h2>
          {view.unscheduled.length === 0 ? (
            <p className="hint">
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
          className="modal-bg"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Schedule delivery"
            data-testid="schedule-modal"
            className="modal"
          >
            <h2>
              {target.currentDate ? 'Change the delivery day' : 'Schedule delivery'}
            </h2>
            <p>
              <b>{target.customer}</b>, {target.item}
              {target.quantity ? ` × ${target.quantity}` : ''}
            </p>

            <div className="dgrid">
              <div className="fld">
                <label htmlFor="delivery-day">
                  Day
                </label>
                <select
                  id="delivery-day"
                  data-testid="delivery-day-select"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="f"
                >
                  {dayOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="delivery-window">
                  Time window
                </label>
                <select
                  id="delivery-window"
                  data-testid="delivery-window-select"
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className="f"
                >
                  {DELIVERY_WINDOW_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="chk">
              <input
                type="checkbox"
                data-testid="delivery-notify"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="w-5 h-5"
              />
              Text and email the customer a tracking link
            </label>

            <div className="actions">
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="btn slate"
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
                className="btn green"
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
      className={STOP_CLASS[delivered ? 'delivered' : 'scheduled']}
    >
      {/* v7 `dcard()` (line 1812): `.cr` the customer row, `.cd` the item,
          `.win` the time-window pill, `.drow` the buttons. Without these the
          children are inline siblings and run together — which is exactly how
          it rendered before. */}
      <div className="cr">
        <div>
          <b>{stop.customer}</b>
        </div>
        {stop.isRush && <span className="pill a">Rush</span>}
      </div>
      <div className="cd">
        <span className="ci2">
          {stop.item}
          {stop.quantity ? ` × ${stop.quantity}` : ''}
        </span>
      </div>
      <span className="win">
        {stop.timeWindowLabel}
        {stop.autoScheduled ? ' · set by the shop' : ''}
      </span>
      <div className="drow">
      {delivered ? (
        <span className="live">✓ Delivered</span>
      ) : (
        <>
          <button
            type="button"
            data-testid="mark-delivered"
            disabled={busy !== null}
            onClick={() =>
              onMark('delivered', '/api/admin/deliveries/mark-delivered', { deliveryId: stop.deliveryId })
            }
            className="btn green"
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
            className="btn slate sm"
          >
            Change day
          </button>
        </>
      )}
      </div>
      {stop.notifyNote && <p className="cap">{stop.notifyNote}</p>}
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
      className="dcard"
    >
      <div className="cr">
        <div>
          <b>{job.customer}</b>
        </div>
        {job.isRush && <span className="pill a">Rush</span>}
      </div>
      <div className="cd">
        <span className="ci2">
          {job.item}
          {job.quantity ? ` × ${job.quantity}` : ''}
        </span>
        <span className="cap">
          {job.jobStage === 'done' ? 'Job is Done' : 'Finished at the machine'}
        </span>
      </div>
      <div className="drow">
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
        className="btn red"
      >
        Schedule delivery
      </button>
      </div>
    </div>
  );
}
