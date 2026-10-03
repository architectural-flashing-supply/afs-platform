'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCents, parseDollarsToCents } from '@/lib/pricing/quote-math';
import { describeBand, validateBandCoverage } from '@/lib/freight/bands';
import {
  FREIGHT_SURCHARGE_FIELDS,
  FREIGHT_SURCHARGE_LABELS,
  type FreightRateTable,
  type FreightSurchargeField,
  type ResolvedFreightBand,
} from '@/lib/freight/types';

/**
 * THE FREIGHT RATE TABLE, editable by an AFS admin at any time.
 *
 * ================== IT SHIPS EMPTY, AND SAYS SO ==================
 *
 * AFS's carrier and its rate structures are checklist #27-28; the residential
 * surcharge is #29, the free-freight threshold #30, the liftgate upcharge #88.
 * None has arrived. So migration 039 seeds NOTHING and this screen's first job
 * is to say that plainly rather than to look broken — and to make clear that
 * freight can still be typed by hand on any quote, which is what has always
 * happened and is `SPEC_FREIGHT_ESTIMATOR.md` §3's own documented interim
 * behaviour.
 *
 * ================== THREE EMPTY-LOOKING STATES, ALL DIFFERENT ==================
 *
 * Collapsing any two of these produces a screen that lies about why it is empty:
 *
 *  - NOT INSTALLED — migration 039 has not been applied, so the tables are not
 *    there. Nothing on this screen can save. It says which migration, and that
 *    manual entry is unaffected.
 *  - NO ZONES — installed, nothing entered. Shows the add-a-zone form.
 *  - ZONES WITH BLANK RATES — the structure is there and the money is not. Each
 *    blank is marked individually, so the estimator knows which row to fill in
 *    rather than being told the whole thing is empty.
 *
 * ================== A BLANK IS A BLANK ==================
 *
 * An unfilled rate renders as the words "Not set" on amber, with a
 * screen-reader label that says so — NOT as "$0.00", not as an empty cell
 * somebody could read as free freight, and not as a placeholder number.
 * Clearing a box and saving stores NULL again. Same reasoning, same markup, as
 * `PriceBookEditor`: "0" and "blank" are different facts about money.
 *
 * ================== EVERY SAVE IS A NEW VERSION ==================
 *
 * Saving does not overwrite. It writes a new rate with a START DATE — today by
 * default, or a date the admin picks, so the carrier's announced increase can be
 * entered now and start then. Every quote already sent keeps the freight it was
 * built on. The panel says so above the button, because a non-technical reader
 * has no reason to assume it.
 *
 * ================== COVERAGE WARNINGS BELONG HERE ==================
 *
 * A zone whose bands overlap or leave a gap makes the estimator REFUSE at quote
 * time (`lib/freight/estimate.ts`). The person who can fix that is the one
 * looking at this screen, so the faults are listed here, per zone, in the same
 * words — rather than being discovered later by somebody trying to send a quote.
 *
 * ================== CONTRAST ==================
 *
 * Light working area, CLAUDE.md rule #18. Body text is afs-ink-900 (18.9:1 on
 * afs-bg-card) and afs-ink-700 (10.3:1); control borders are afs-line-strong
 * (3.1:1, the 3:1 rule for UI components); the "Not set" marker is afs-amber-ink
 * on afs-amber-bg (7.1:1).
 *
 * PLACEHOLDER TEXT HERE IS afs-ink-700, NOT afs-chrome-silver — rule #23. On
 * this white card chrome-silver measures 1.55:1, which is worse than the 1.94:1
 * failure rule #18 exists to fix. The surface decides the token.
 */

interface FreightRateEditorProps {
  /** `null` when migration 039 has not been applied on this deployment. */
  table: FreightRateTable | null;
  /** Why it is null, in words, when it is. */
  notInstalledReason: string | null;
  /** Resolved on the server so a new rate's default start date is the shop's. */
  today: string;
}

type Tone = 'ok' | 'error';

const inputClass =
  'min-h-11 rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-data px-3 placeholder:text-afs-ink-700';
const labelClass = 'font-label text-sm font-bold text-afs-ink-900';
const primaryButtonClass =
  'min-h-11 px-4 rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-70';
const secondaryButtonClass =
  'min-h-11 px-4 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised disabled:opacity-60';
const linkButtonClass =
  'min-h-11 px-4 rounded-lg font-label text-afs-ink-700 hover:text-afs-ink-900 underline disabled:opacity-60';

/** Dollars from cents for an input box, or an empty box for a blank. */
function dollarsOrBlank(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

export default function FreightRateEditor({
  table,
  notInstalledReason,
  today,
}: FreightRateEditorProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);

  const [newZoneName, setNewZoneName] = useState('');
  const [newBandZoneId, setNewBandZoneId] = useState<string | null>(null);
  const [newBandMin, setNewBandMin] = useState('');
  const [newBandMax, setNewBandMax] = useState('');

  const [openRateBandId, setOpenRateBandId] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState<{ amount: string; effectiveFrom: string } | null>(null);

  const [surchargeDraft, setSurchargeDraft] = useState<
    (Record<FreightSurchargeField, string> & { effectiveFrom: string }) | null
  >(null);

  async function post(label: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/freight-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (res.ok && data.ok === true) {
        setMessage({ tone: 'ok', text: typeof data.message === 'string' ? data.message : 'Saved.' });
        router.refresh();
        return true;
      }
      setMessage({ tone: 'error', text: typeof data.error === 'string' ? data.error : 'That did not save.' });
      return false;
    } catch {
      setMessage({ tone: 'error', text: 'The connection dropped, so nothing was changed.' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  // ---- NOT INSTALLED -----------------------------------------------------
  // Migration 039 is written and deliberately unapplied, so this is the state
  // of every deployment today. Nothing below would be able to save, so nothing
  // below is rendered: controls that look real and cannot work are worse than
  // an honest sentence.
  if (table === null) {
    return (
      <div
        data-testid="freight-not-installed"
        className="bg-afs-bg-card border border-afs-line-strong rounded-xl p-5 flex flex-col gap-3"
      >
        <h2 className="font-heading text-xl text-afs-ink-900">The freight rate table is not set up yet</h2>
        <p className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded-lg p-3">
          {notInstalledReason ?? 'The freight rate tables are not available on this deployment.'}
        </p>
        <p className="font-body text-[15px] text-afs-ink-700">
          Nothing is broken and no quote is blocked. Freight is typed in by hand on each quote, which
          is how it has always worked here — this screen is where the rates will live once AFS&apos;s
          carrier and its rate structure are known.
        </p>
      </div>
    );
  }

  const liveZones = table.zones.filter((zone) => zone.retiredAt === null);
  const retiredZones = table.zones.filter((zone) => zone.retiredAt !== null);

  const allBands = liveZones.flatMap((zone) => table.bandsByZone[zone.id] ?? []);
  const liveBands = allBands.filter((entry) => entry.band.retiredAt === null);
  const unpricedBands = liveBands.filter((entry) => !entry.isPriced).length;

  const surcharges = table.surcharges;
  const blankSurcharges = FREIGHT_SURCHARGE_FIELDS.filter(
    (field) => surcharges === null || surcharges[field] === null
  );

  function saveRate(entry: ResolvedFreightBand) {
    if (!rateDraft) return;
    const parsed = parseDollarsToCents(rateDraft.amount);
    if (parsed === 'invalid') {
      setMessage({
        tone: 'error',
        text:
          'The freight rate needs to be a dollar amount like 185 or 185.50 — or left empty to keep it blank.',
      });
      return;
    }
    void post(`rate-${entry.band.id}`, {
      action: 'set-rate',
      bandId: entry.band.id,
      // null reaches the server as null and is stored as a blank. This is the
      // line that keeps "blank" from becoming "zero".
      rateCents: parsed,
      effectiveFrom: rateDraft.effectiveFrom,
    }).then((saved) => {
      if (saved) {
        setOpenRateBandId(null);
        setRateDraft(null);
      }
    });
  }

  function saveSurcharges() {
    if (!surchargeDraft) return;
    const body: Record<string, unknown> = {
      action: 'set-surcharges',
      effectiveFrom: surchargeDraft.effectiveFrom,
    };
    for (const field of FREIGHT_SURCHARGE_FIELDS) {
      const parsed = parseDollarsToCents(surchargeDraft[field]);
      if (parsed === 'invalid') {
        setMessage({
          tone: 'error',
          text:
            `${FREIGHT_SURCHARGE_LABELS[field]} needs to be a dollar amount like 75 or 75.50 — or left ` +
            `empty to keep it blank.`,
        });
        return;
      }
      body[field] = parsed;
    }
    void post('surcharges', body).then((saved) => {
      if (saved) setSurchargeDraft(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- what this screen is ---------------------------------------- */}
      <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-2">
        <p className="font-body text-[15px] text-afs-ink-900">
          A freight zone for each destination you bill by, weight bands inside it, and what each band
          costs. The estimator on a quote picks the zone; the weight and the freight class come from
          the job itself.
        </p>
        <p className="font-body text-[15px] text-afs-ink-700">
          Saving never overwrites an old rate — it starts a new one from the date you choose.{' '}
          <strong className="text-afs-ink-900">
            Quotes you have already sent keep the freight they were built on.
          </strong>
        </p>
        {unpricedBands > 0 && (
          <p
            data-testid="freight-unpriced-count"
            className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded-lg p-3"
          >
            {unpricedBands} of {liveBands.length} weight bands still have a rate to fill in. A job
            landing in one of those cannot be estimated until it is filled in — a blank is never
            treated as zero.
          </p>
        )}
      </div>

      {message && (
        <p
          role="status"
          data-testid="freight-message"
          className={`font-body text-[15px] rounded-lg p-3 ${
            message.tone === 'error'
              ? 'bg-afs-bg-light-raised text-afs-crimson'
              : 'bg-afs-green-soft text-afs-green-ink'
          }`}
        >
          {message.text}
        </p>
      )}

      {/* ---- NO ZONES: installed, nothing entered ----------------------- */}
      {liveZones.length === 0 ? (
        <div
          data-testid="freight-empty-state"
          className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3"
        >
          <h3 className="font-heading text-xl text-afs-ink-900">No freight zones yet</h3>
          <p className="font-body text-[15px] text-afs-ink-700">
            Add the zones your carrier actually bills, then the weight bands inside each one. Nothing
            here is filled in for you:{' '}
            <strong className="text-afs-ink-900">
              a guessed freight rate would end up on a customer&apos;s quote
            </strong>
            , so every figure on this screen has to come from you. Until then, freight is typed by
            hand on each quote.
          </p>
        </div>
      ) : (
        liveZones.map((zone) => {
          const bands = (table.bandsByZone[zone.id] ?? []).filter(
            (entry) => entry.band.retiredAt === null
          );
          const retiredBands = (table.bandsByZone[zone.id] ?? []).filter(
            (entry) => entry.band.retiredAt !== null
          );
          const coverage = validateBandCoverage(bands.map((entry) => entry.band));

          return (
            <section
              key={zone.id}
              data-testid="freight-zone"
              data-zone-name={zone.name}
              className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-heading text-xl text-afs-ink-900">{zone.name}</h3>
                  {zone.note && <p className="font-body text-[13px] text-afs-ink-700 mt-1">{zone.note}</p>}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void post(`retire-zone-${zone.id}`, {
                      action: 'retire-zone',
                      zoneId: zone.id,
                      retired: true,
                    })
                  }
                  className={linkButtonClass}
                >
                  Retire this zone
                </button>
              </div>

              {/* Coverage faults, in the estimator's own words, on the screen
                  where they can actually be fixed. */}
              {coverage.length > 0 && (
                <div
                  data-testid="freight-coverage-warning"
                  className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded-lg p-3 flex flex-col gap-1.5"
                >
                  <strong>These bands do not fit together, so a quote using this zone will refuse:</strong>
                  <ul className="flex flex-col gap-1 list-disc pl-5">
                    {coverage.map((problem, index) => (
                      <li key={`${problem.kind}-${index}`}>{problem.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {bands.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[520px]">
                    <caption className="sr-only">Weight bands and rates for {zone.name}</caption>
                    <thead>
                      <tr className="border-b border-afs-line-strong">
                        <th scope="col" className={`${labelClass} text-left p-3`}>
                          Weight band
                        </th>
                        <th scope="col" className={`${labelClass} text-right p-3 whitespace-nowrap`}>
                          Freight rate
                        </th>
                        <th scope="col" className={`${labelClass} text-right p-3 whitespace-nowrap`}>
                          In force from
                        </th>
                        <th scope="col" className={`${labelClass} text-right p-3`}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bands.map((entry) => {
                        const isOpen = openRateBandId === entry.band.id;
                        return (
                          <tr
                            key={entry.band.id}
                            data-testid="freight-band-row"
                            data-band={describeBand(entry.band)}
                            data-priced={entry.isPriced ? 'true' : 'false'}
                            className="border-b border-afs-border-light align-top"
                          >
                            <td className="font-body text-[15px] text-afs-ink-900 p-3 whitespace-nowrap">
                              {describeBand(entry.band)}
                            </td>
                            <td className="p-3 text-right">
                              {isOpen && rateDraft ? (
                                <>
                                  <label className="sr-only" htmlFor={`rate-${entry.band.id}`}>
                                    Freight rate for {describeBand(entry.band)} in {zone.name}
                                  </label>
                                  <input
                                    id={`rate-${entry.band.id}`}
                                    data-testid="freight-rate-input"
                                    type="text"
                                    inputMode="decimal"
                                    value={rateDraft.amount}
                                    onChange={(e) => setRateDraft({ ...rateDraft, amount: e.target.value })}
                                    placeholder="Leave blank"
                                    className={`${inputClass} w-32 text-right`}
                                  />
                                </>
                              ) : (
                                <RateCell
                                  cents={entry.version?.rateCents ?? null}
                                  bandLabel={describeBand(entry.band)}
                                  zoneName={zone.name}
                                />
                              )}
                            </td>
                            <td className="p-3 text-right font-data text-[15px] text-afs-ink-700 whitespace-nowrap">
                              {isOpen && rateDraft ? (
                                <>
                                  <label className="sr-only" htmlFor={`rate-from-${entry.band.id}`}>
                                    This rate starts on
                                  </label>
                                  <input
                                    id={`rate-from-${entry.band.id}`}
                                    data-testid="freight-rate-effective-from"
                                    type="date"
                                    value={rateDraft.effectiveFrom}
                                    onChange={(e) =>
                                      setRateDraft({ ...rateDraft, effectiveFrom: e.target.value })
                                    }
                                    className={inputClass}
                                  />
                                </>
                              ) : (
                                entry.version?.effectiveFrom ?? '—'
                              )}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              {isOpen ? (
                                <span className="inline-flex gap-2">
                                  <button
                                    type="button"
                                    data-testid="freight-rate-save"
                                    disabled={busy !== null}
                                    onClick={() => saveRate(entry)}
                                    className={primaryButtonClass}
                                  >
                                    {busy === `rate-${entry.band.id}` ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() => {
                                      setOpenRateBandId(null);
                                      setRateDraft(null);
                                    }}
                                    className={secondaryButtonClass}
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <span className="inline-flex gap-2">
                                  <button
                                    type="button"
                                    data-testid="freight-rate-edit"
                                    onClick={() => {
                                      setOpenRateBandId(entry.band.id);
                                      setRateDraft({
                                        amount: dollarsOrBlank(entry.version?.rateCents ?? null),
                                        effectiveFrom: today,
                                      });
                                      setMessage(null);
                                    }}
                                    className={secondaryButtonClass}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy !== null}
                                    onClick={() =>
                                      void post(`retire-band-${entry.band.id}`, {
                                        action: 'retire-band',
                                        bandId: entry.band.id,
                                        retired: true,
                                      })
                                    }
                                    className={linkButtonClass}
                                  >
                                    Retire
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {bands.length === 0 && (
                <p data-testid="freight-zone-no-bands" className="font-body text-[15px] text-afs-ink-700">
                  No weight bands in this zone yet, so a quote using it cannot be estimated. Add the
                  bands your carrier bills — for example 0 to 500 lb, 500 to 1,000 lb, then 1,000 lb
                  with the upper weight left empty to catch everything heavier.
                </p>
              )}

              {retiredBands.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="font-label text-sm font-bold text-afs-ink-900">Retired bands</p>
                  <ul className="flex flex-col gap-2">
                    {retiredBands.map((entry) => (
                      <li key={entry.band.id} className="flex items-center justify-between gap-4">
                        <span className="font-body text-[15px] text-afs-ink-700">
                          {describeBand(entry.band)}
                        </span>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void post(`unretire-band-${entry.band.id}`, {
                              action: 'retire-band',
                              bandId: entry.band.id,
                              retired: false,
                            })
                          }
                          className={secondaryButtonClass}
                        >
                          Bring it back
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ---- add a band to this zone ------------------------------ */}
              {newBandZoneId === zone.id ? (
                <div className="flex flex-wrap gap-3 items-end border-t border-afs-border-light pt-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`band-min-${zone.id}`} className={labelClass}>
                      From (lb)
                    </label>
                    <input
                      id={`band-min-${zone.id}`}
                      data-testid="freight-band-min"
                      type="text"
                      inputMode="numeric"
                      value={newBandMin}
                      onChange={(e) => setNewBandMin(e.target.value)}
                      placeholder="0"
                      className={`${inputClass} w-28`}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`band-max-${zone.id}`} className={labelClass}>
                      Up to (lb)
                    </label>
                    <input
                      id={`band-max-${zone.id}`}
                      data-testid="freight-band-max"
                      type="text"
                      inputMode="numeric"
                      value={newBandMax}
                      onChange={(e) => setNewBandMax(e.target.value)}
                      placeholder="Leave blank for the top band"
                      className={`${inputClass} w-64`}
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="freight-band-add"
                    disabled={busy !== null || newBandMin.trim() === ''}
                    onClick={async () => {
                      const min = Number(newBandMin.trim());
                      const maxRaw = newBandMax.trim();
                      if (!Number.isInteger(min) || min < 0) {
                        setMessage({
                          tone: 'error',
                          text: 'The lower weight must be a whole number of pounds at or above zero.',
                        });
                        return;
                      }
                      if (maxRaw !== '') {
                        const max = Number(maxRaw);
                        if (!Number.isInteger(max) || max < 0) {
                          setMessage({
                            tone: 'error',
                            text:
                              'The upper weight must be a whole number of pounds, or left empty to make ' +
                              'this the top band.',
                          });
                          return;
                        }
                      }
                      const added = await post(`band-${zone.id}`, {
                        action: 'add-band',
                        zoneId: zone.id,
                        minWeightLbs: min,
                        maxWeightLbs: maxRaw === '' ? null : Number(maxRaw),
                      });
                      if (added) {
                        setNewBandMin('');
                        setNewBandMax('');
                        setNewBandZoneId(null);
                      }
                    }}
                    className={primaryButtonClass}
                  >
                    {busy === `band-${zone.id}` ? 'Adding…' : 'Add this band'}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setNewBandZoneId(null);
                      setNewBandMin('');
                      setNewBandMax('');
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                  <p className="font-body text-[13px] text-afs-ink-700 basis-full">
                    A band runs from its lower weight up to, but not including, its upper weight — so
                    0 to 500 and 500 to 1,000 meet exactly, and a 500 lb shipment belongs to the
                    second one. Leave the upper weight empty for the band that catches everything
                    heavier.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="freight-band-open"
                  disabled={busy !== null}
                  onClick={() => {
                    setNewBandZoneId(zone.id);
                    setMessage(null);
                  }}
                  className={`${secondaryButtonClass} self-start`}
                >
                  Add a weight band
                </button>
              )}
            </section>
          );
        })
      )}

      {/* ---- add a zone -------------------------------------------------- */}
      <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3">
        <h3 className="font-heading text-xl text-afs-ink-900">Add a freight zone</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-zone-name" className={labelClass}>
              Zone name
            </label>
            <input
              id="new-zone-name"
              data-testid="freight-zone-name"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder="Central Texas"
              className={`${inputClass} w-72 font-body`}
            />
          </div>
          <button
            type="button"
            data-testid="freight-zone-add"
            disabled={busy !== null || newZoneName.trim() === ''}
            onClick={async () => {
              const added = await post('add-zone', { action: 'add-zone', name: newZoneName.trim() });
              if (added) setNewZoneName('');
            }}
            className={`${secondaryButtonClass} border-2`}
          >
            {busy === 'add-zone' ? 'Adding…' : 'Add this zone'}
          </button>
        </div>
        <p className="font-body text-[13px] text-afs-ink-700">
          A new zone starts with no weight bands and no rates, ready for you to fill in.
        </p>
      </div>

      {/* ---- surcharges and the threshold -------------------------------- */}
      <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-xl text-afs-ink-900">Surcharges and free freight</h3>
          <p className="font-body text-[15px] text-afs-ink-700 mt-1">
            These apply across every zone. Leave one blank and it stays blank — a quote that needs it
            will ask you for the amount rather than quietly leaving it off.
          </p>
        </div>

        {blankSurcharges.length > 0 && (
          <p
            data-testid="freight-surcharge-blanks"
            className="font-body text-[15px] text-afs-amber-ink bg-afs-amber-bg rounded-lg p-3"
          >
            {blankSurcharges.map((field) => FREIGHT_SURCHARGE_LABELS[field]).join(', ')}{' '}
            {blankSurcharges.length === 1 ? 'is' : 'are'} not set.{' '}
            {blankSurcharges.includes('freeFreightThresholdCents')
              ? 'With no threshold set, the free freight rule is simply not applied. '
              : ''}
            A job ticked for a surcharge that is blank will refuse to estimate and ask you for the
            figure.
          </p>
        )}

        {surchargeDraft === null ? (
          <>
            <dl className="flex flex-col gap-3">
              {FREIGHT_SURCHARGE_FIELDS.map((field) => (
                <div key={field} className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="font-body text-[15px] text-afs-ink-900">
                    {FREIGHT_SURCHARGE_LABELS[field]}
                  </dt>
                  <dd>
                    <SurchargeCell cents={surcharges === null ? null : surcharges[field]} field={field} />
                  </dd>
                </div>
              ))}
            </dl>
            {surcharges !== null && (
              <p className="font-body text-[13px] text-afs-ink-700">
                In force from {surcharges.effectiveFrom}.
              </p>
            )}
            <button
              type="button"
              data-testid="freight-surcharge-edit"
              onClick={() => {
                setSurchargeDraft({
                  residentialCents: dollarsOrBlank(surcharges?.residentialCents ?? null),
                  liftgateCents: dollarsOrBlank(surcharges?.liftgateCents ?? null),
                  freeFreightThresholdCents: dollarsOrBlank(
                    surcharges?.freeFreightThresholdCents ?? null
                  ),
                  effectiveFrom: today,
                });
                setMessage(null);
              }}
              className={`${secondaryButtonClass} self-start`}
            >
              Edit these
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              {FREIGHT_SURCHARGE_FIELDS.map((field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <label htmlFor={`surcharge-${field}`} className={labelClass}>
                    {FREIGHT_SURCHARGE_LABELS[field]} ($)
                  </label>
                  <input
                    id={`surcharge-${field}`}
                    data-testid={`freight-surcharge-${field}`}
                    type="text"
                    inputMode="decimal"
                    value={surchargeDraft[field]}
                    onChange={(e) => setSurchargeDraft({ ...surchargeDraft, [field]: e.target.value })}
                    placeholder="Leave blank"
                    className={`${inputClass} w-44 text-right`}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="surcharge-from" className={labelClass}>
                  These start on
                </label>
                <input
                  id="surcharge-from"
                  data-testid="freight-surcharge-effective-from"
                  type="date"
                  value={surchargeDraft.effectiveFrom}
                  onChange={(e) =>
                    setSurchargeDraft({ ...surchargeDraft, effectiveFrom: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="freight-surcharge-save"
                disabled={busy !== null}
                onClick={saveSurcharges}
                className={primaryButtonClass}
              >
                {busy === 'surcharges' ? 'Saving…' : 'Save these'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setSurchargeDraft(null)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- retired zones ----------------------------------------------- */}
      {retiredZones.length > 0 && (
        <div className="bg-afs-bg-card border border-afs-border-light rounded-xl p-5 flex flex-col gap-3">
          <h3 className="font-heading text-xl text-afs-ink-900">Retired zones</h3>
          <p className="font-body text-[15px] text-afs-ink-700">
            These cannot price new work. Nothing was deleted — every quote that used them is
            untouched, and bringing one back restores its bands and rates.
          </p>
          <ul className="flex flex-col gap-2">
            {retiredZones.map((zone) => (
              <li key={zone.id} className="flex items-center justify-between gap-4">
                <span className="font-body text-[15px] text-afs-ink-900">{zone.name}</span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void post(`unretire-zone-${zone.id}`, {
                      action: 'retire-zone',
                      zoneId: zone.id,
                      retired: false,
                    })
                  }
                  className={secondaryButtonClass}
                >
                  Bring it back
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A filled rate, or a clearly marked blank. Never "$0.00" for an empty cell. */
function RateCell({
  cents,
  bandLabel,
  zoneName,
}: {
  cents: number | null;
  bandLabel: string;
  zoneName: string;
}) {
  if (cents === null) {
    return (
      <span
        data-testid="freight-rate-blank"
        className="inline-block font-label text-sm font-bold text-afs-amber-ink bg-afs-amber-bg rounded px-2 py-1 whitespace-nowrap"
      >
        <span aria-hidden="true">Not set</span>
        <span className="sr-only">
          The freight rate for {bandLabel} in {zoneName} is not set yet
        </span>
      </span>
    );
  }
  return <span className="font-data text-[15px] text-afs-ink-900">{formatCents(cents)}</span>;
}

/** The same marker for a surcharge that has never been filled in. */
function SurchargeCell({ cents, field }: { cents: number | null; field: FreightSurchargeField }) {
  if (cents === null) {
    return (
      <span
        data-testid="freight-surcharge-blank"
        data-field={field}
        className="inline-block font-label text-sm font-bold text-afs-amber-ink bg-afs-amber-bg rounded px-2 py-1 whitespace-nowrap"
      >
        <span aria-hidden="true">Not set</span>
        <span className="sr-only">{FREIGHT_SURCHARGE_LABELS[field]} is not set yet</span>
      </span>
    );
  }
  return <span className="font-data text-[15px] text-afs-ink-900">{formatCents(cents)}</span>;
}
