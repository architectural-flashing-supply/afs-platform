'use client';

import { useMemo, useRef, useState } from 'react';
import {
  optimizeCutPlan,
  DEFAULT_KERF_IN,
  type CutPlanErrorCode,
  type CutPlanInput,
  type CutStrategy,
  type RequiredPiece,
} from '@/lib/trim-optimizer';
import type { ProfileStockLength } from '@/lib/data/product-profiles';
import { formatInches } from '@/lib/utils/format-inches';

/**
 * THE CUT PLAN WORKBENCH — internal fabrication tool, quantities only.
 *
 * Nowhere in this component is there a price, a rate or a dollar amount, and
 * there must never be: AFS is an RFQ platform and specs/
 * SPEC_TRIM_LENGTH_OPTIMIZER.md §1 is explicit that this feature carries "no
 * pricing involved".
 *
 * All of the arithmetic is lib/trim-optimizer/'s, called synchronously in a
 * useMemo. There is no API route because there is nothing to hide and nothing
 * to fetch: the engine is a pure function, so the plan can be computed in the
 * browser as the estimator types.
 *
 * Why the profile field is a text input with a datalist rather than a select:
 * it has to keep working when the catalog read comes back empty or fails, and
 * two different controls for the same field (a select when rows exist, a text
 * box when they do not) is two code paths and two sets of states to get right.
 */

interface CutPlanWorkbenchProps {
  profiles: ProfileStockLength[];
  /** True when the catalog read failed, as opposed to finding nothing. */
  catalogFailed: boolean;
}

interface PieceRow {
  /** Stable within a session and used as the engine's piece id. */
  key: string;
  profile: string;
  lengthIn: string;
  quantity: string;
}

/**
 * Two kinds of "no plan". A missing input is not a refusal — it is a form that
 * is not finished — and dressing it in the same red as "this piece cannot be
 * cut from stock at all" trains the reader to ignore both.
 */
const UNFINISHED_CODES: ReadonlySet<CutPlanErrorCode> = new Set<CutPlanErrorCode>([
  'no_stock_lengths',
  'invalid_piece',
  'invalid_kerf',
  'invalid_stock_length',
]);

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-chrome-base rounded px-3 py-2 text-sm text-afs-chrome-high placeholder:text-afs-chrome-silver focus:border-afs-crimson outline-none font-body';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';
const cardClass = 'bg-afs-bg-raised border border-afs-border rounded p-5';

function emptyRow(key: string): PieceRow {
  return { key, profile: '', lengthIn: '', quantity: '1' };
}

/** The distinct standard stock lengths the catalog actually carries, ascending. */
function catalogStockLengthsFt(profiles: ProfileStockLength[]): number[] {
  const lengths = profiles
    .map((profile) => profile.standardLengthFt)
    .filter((length): length is number => length !== null && Number.isFinite(length) && length > 0);
  return [...new Set(lengths)].sort((a, b) => a - b);
}

function oneDecimal(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export default function CutPlanWorkbench({ profiles, catalogFailed }: CutPlanWorkbenchProps) {
  const catalogLengthsFt = useMemo(() => catalogStockLengthsFt(profiles), [profiles]);

  // Row keys come from a counter, never a clock or a random number: the plan is
  // keyed by them, and the engine's determinism promise is only worth having if
  // the ids feeding it are stable too.
  const nextKey = useRef(2);
  const [rows, setRows] = useState<PieceRow[]>([emptyRow('piece-1')]);

  const [selectedLengthsFt, setSelectedLengthsFt] = useState<number[]>(
    catalogLengthsFt.length > 0 ? [catalogLengthsFt[0]] : []
  );
  const [extraLengthsFt, setExtraLengthsFt] = useState<number[]>([]);
  const [extraLengthDraft, setExtraLengthDraft] = useState('');
  const [extraLengthProblem, setExtraLengthProblem] = useState<string | null>(null);
  const [kerfIn, setKerfIn] = useState(String(DEFAULT_KERF_IN));
  const [strategy, setStrategy] = useState<CutStrategy>('best-fit-decreasing');

  const stockLengthsFt = useMemo(
    () => [...new Set([...selectedLengthsFt, ...extraLengthsFt])].sort((a, b) => a - b),
    [selectedLengthsFt, extraLengthsFt]
  );

  const result = useMemo(() => {
    const pieces: RequiredPiece[] = rows
      // A row nobody has filled in yet is not an invalid piece — it is an empty
      // row, and the form must not shout at the estimator for having one open.
      .filter((row) => row.profile.trim() !== '' || row.lengthIn.trim() !== '')
      .map((row) => ({
        id: row.key,
        profile: row.profile.trim(),
        lengthIn: Number(row.lengthIn),
        quantity: Number(row.quantity),
      }));

    const input: CutPlanInput = {
      pieces,
      stockLengths: stockLengthsFt.map((feet) => ({
        lengthIn: feet * 12,
        label: `${feet} ft`,
      })),
      settings: { kerfIn: Number(kerfIn), strategy },
    };

    return optimizeCutPlan(input);
  }, [rows, stockLengthsFt, kerfIn, strategy]);

  const hasAnyPiece = rows.some((row) => row.profile.trim() !== '' || row.lengthIn.trim() !== '');

  function updateRow(key: string, field: keyof Omit<PieceRow, 'key'>, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    const key = `piece-${nextKey.current}`;
    nextKey.current += 1;
    setRows((current) => [...current, emptyRow(key)]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? [emptyRow(current[0].key)] : current.filter((row) => row.key !== key)));
  }

  function toggleCatalogLength(feet: number) {
    setSelectedLengthsFt((current) =>
      current.includes(feet) ? current.filter((value) => value !== feet) : [...current, feet]
    );
  }

  function addExtraLength() {
    const feet = Number(extraLengthDraft);
    if (!Number.isFinite(feet) || feet <= 0) {
      setExtraLengthProblem('Enter a stock length in feet, greater than zero. Nothing was added.');
      return;
    }
    if (stockLengthsFt.includes(feet)) {
      setExtraLengthProblem(`${feet} ft is already in the list. Nothing was added.`);
      return;
    }
    setExtraLengthsFt((current) => [...current, feet]);
    setExtraLengthDraft('');
    setExtraLengthProblem(null);
  }

  return (
    <div className="space-y-6">
      {catalogFailed && (
        <div
          role="status"
          className="bg-afs-bg-raised border border-afs-border rounded p-4 font-body text-sm text-afs-warning-on-dark"
        >
          The profile catalog could not be read, so no standard stock lengths are listed below.
          Nothing was lost — type the stock length you are cutting from and the plan will be the
          same.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ------------------------------------------------ stock + settings */}
        <div className={`${cardClass} space-y-5`}>
          <div>
            <h2 className="font-label text-xs uppercase tracking-wide text-afs-chrome-high mb-3">
              Stock lengths
            </h2>

            {catalogLengthsFt.length === 0 ? (
              <p className="font-body text-sm text-afs-chrome-mid">
                {catalogFailed
                  ? 'None could be loaded.'
                  : 'No stocked profile in the catalog carries a standard length yet.'}{' '}
                Add the length you are cutting from below.
              </p>
            ) : (
              <ul className="space-y-2">
                {catalogLengthsFt.map((feet) => (
                  <li key={feet}>
                    <label className="flex items-center gap-2.5 font-body text-sm text-afs-chrome-mid cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLengthsFt.includes(feet)}
                        onChange={() => toggleCatalogLength(feet)}
                        className="accent-afs-crimson"
                      />
                      <span>
                        {feet} ft{' '}
                        <span className="font-data text-afs-chrome-mid">
                          ({formatInches(feet * 12)})
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {extraLengthsFt.length > 0 && (
            <ul className="space-y-2">
              {extraLengthsFt.map((feet) => (
                <li
                  key={feet}
                  className="flex items-center justify-between font-body text-sm text-afs-chrome-mid"
                >
                  <span>
                    {feet} ft{' '}
                    <span className="font-data text-afs-chrome-mid">({formatInches(feet * 12)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExtraLengthsFt((current) => current.filter((v) => v !== feet))}
                    aria-label={`Remove the ${feet} ft stock length`}
                    className="font-label text-xs uppercase tracking-wide text-afs-danger-on-dark"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className={labelClass} htmlFor="extra-stock-length">
              Add a stock length (ft)
            </label>
            <div className="flex gap-2">
              <input
                id="extra-stock-length"
                type="number"
                min="0"
                step="0.5"
                className={inputClass}
                placeholder="e.g. 16"
                value={extraLengthDraft}
                onChange={(event) => setExtraLengthDraft(event.target.value)}
              />
              <button
                type="button"
                onClick={addExtraLength}
                className="shrink-0 bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label text-xs uppercase tracking-wide px-4 rounded transition-colors"
              >
                Add
              </button>
            </div>
            {extraLengthProblem && (
              <p role="alert" className="font-body text-xs text-afs-danger-on-dark mt-2">
                {extraLengthProblem}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="kerf">
              Blade width / kerf (in)
            </label>
            <input
              id="kerf"
              type="number"
              min="0"
              step="0.0625"
              className={`${inputClass} font-data`}
              value={kerfIn}
              onChange={(event) => setKerfIn(event.target.value)}
            />
            <p className="font-body text-xs text-afs-chrome-mid mt-1.5">
              Reserved between adjacent cuts, and once more to sever an off-cut. Rounded up to the
              nearest sixteenth.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="strategy">
              Packing
            </label>
            <select
              id="strategy"
              className={inputClass}
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as CutStrategy)}
            >
              <option className="bg-afs-bg-overlay" value="best-fit-decreasing">
                Best fit, longest first
              </option>
              <option className="bg-afs-bg-overlay" value="first-fit-decreasing">
                First fit, longest first
              </option>
            </select>
          </div>
        </div>

        {/* ----------------------------------------------------- piece table */}
        <div className={`${cardClass} lg:col-span-2 space-y-4`}>
          <h2 className="font-label text-xs uppercase tracking-wide text-afs-chrome-high">
            Required pieces
          </h2>

          <datalist id="cut-plan-profiles">
            {profiles.map((profile) => (
              <option key={profile.slug} value={profile.name} />
            ))}
          </datalist>

          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-6">
                  <label className={labelClass} htmlFor={`${row.key}-profile`}>
                    Profile {index + 1}
                  </label>
                  <input
                    id={`${row.key}-profile`}
                    type="text"
                    list="cut-plan-profiles"
                    className={inputClass}
                    placeholder="e.g. Coping Cap"
                    value={row.profile}
                    onChange={(event) => updateRow(row.key, 'profile', event.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <label className={labelClass} htmlFor={`${row.key}-length`}>
                    Length (in)
                  </label>
                  <input
                    id={`${row.key}-length`}
                    type="number"
                    min="0"
                    step="0.0625"
                    className={`${inputClass} font-data`}
                    placeholder="0.00"
                    value={row.lengthIn}
                    onChange={(event) => updateRow(row.key, 'lengthIn', event.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass} htmlFor={`${row.key}-quantity`}>
                    Qty
                  </label>
                  <input
                    id={`${row.key}-quantity`}
                    type="number"
                    min="0"
                    step="1"
                    className={`${inputClass} font-data`}
                    value={row.quantity}
                    onChange={(event) => updateRow(row.key, 'quantity', event.target.value)}
                  />
                </div>
                <div className="col-span-1">
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Clear piece ${index + 1}`}
                    className="w-full py-2 font-label text-xs uppercase tracking-wide text-afs-danger-on-dark"
                  >
                    Clear
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addRow}
            className="bg-afs-btn-secondary hover:bg-afs-bg-overlay text-afs-chrome-high font-label text-xs uppercase tracking-wide px-4 py-2 rounded transition-colors"
          >
            Add a piece
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------- the plan */}
      {!result.ok ? (
        <div
          role="alert"
          className={`${cardClass} ${
            UNFINISHED_CODES.has(result.error.code) ? '' : 'border-afs-crimson'
          }`}
        >
          <p
            className={`font-label text-xs uppercase tracking-wide mb-2 ${
              UNFINISHED_CODES.has(result.error.code)
                ? 'text-afs-warning-on-dark'
                : 'text-afs-danger-on-dark'
            }`}
          >
            {UNFINISHED_CODES.has(result.error.code) ? 'Not enough to plan yet' : 'Cannot be planned'}
          </p>
          <p className="font-body text-sm text-afs-chrome-mid">{result.error.message}</p>
        </div>
      ) : result.plan.profiles.length === 0 ? (
        <div className={cardClass}>
          <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-high mb-2">
            No cut plan yet
          </p>
          <p className="font-body text-sm text-afs-chrome-mid">
            {hasAnyPiece
              ? 'Every piece on the list has a quantity of zero, so there is nothing to cut.'
              : 'Add a profile, a finished length and a quantity, and the cut plan appears here as you type.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className={`${cardClass} grid grid-cols-2 md:grid-cols-5 gap-4`}>
            <Figure label="Stock pieces" value={String(result.plan.totals.stockPieceCount)} />
            <Figure
              label="Stock used"
              value={formatInches(result.plan.totals.totalStockLengthIn)}
            />
            <Figure label="Finished" value={formatInches(result.plan.totals.requiredLengthIn)} />
            <Figure label="Off-cut + blade" value={formatInches(result.plan.totals.wasteLengthIn)} />
            <Figure
              label="Waste"
              value={`${oneDecimal(result.plan.totals.wastePercent)}%`}
              emphasis
            />
          </div>

          {result.plan.profiles.map((profilePlan) => (
            <div key={profilePlan.profile} className={`${cardClass} space-y-3`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-heading text-lg text-afs-chrome-high">{profilePlan.profile}</h3>
                <p className="font-data text-sm text-afs-chrome-mid">
                  {profilePlan.totals.stockPieceCount}{' '}
                  {profilePlan.totals.stockPieceCount === 1 ? 'stock piece' : 'stock pieces'} ·{' '}
                  {profilePlan.stockLengthsUsedIn.map((length) => formatInches(length)).join(' + ')}{' '}
                  · {oneDecimal(profilePlan.totals.wastePercent)}% waste
                </p>
              </div>

              <ul className="divide-y divide-afs-border">
                {profilePlan.stockPieces.map((stockPiece) => (
                  <li key={stockPiece.index} className="py-2.5 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="font-data text-sm text-afs-chrome-mid w-14 shrink-0">
                      #{stockPiece.index}
                    </span>
                    <span className="font-body text-sm text-afs-chrome-high grow">
                      {stockPiece.cuttingInstructions}
                    </span>
                    <span className="font-data text-sm text-afs-chrome-mid">
                      {oneDecimal(stockPiece.utilizationPercent)}% used
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="font-body text-xs text-afs-chrome-mid">
            Packing is a heuristic, not a proof of the fewest possible stock pieces. The waste
            figure is there to be compared: change the stock lengths or the packing and see whether
            it improves.
          </p>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">{label}</p>
      <p
        className={`font-data text-xl ${emphasis ? 'text-afs-warning-on-dark' : 'text-afs-chrome-high'}`}
      >
        {value}
      </p>
    </div>
  );
}
