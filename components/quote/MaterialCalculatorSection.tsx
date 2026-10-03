'use client';

/**
 * AUTO MATERIAL CALCULATOR — SPEC_AUTO_MATERIAL_CALCULATOR.md §3's panel.
 *
 * "MaterialCalculatorSection (collapsible accordion, expanded by default)", with
 * the quantity breakdown, then REQUIRED WITH THIS ORDER, then ALSO COMMONLY
 * ORDERED. Required accessories arrive checked and can be unchecked; optional ones
 * arrive unchecked and can be added.
 *
 * NO PRICES. Not a column, not a label, not a tooltip (CLAUDE.md rule #1 — the
 * customer sees no dollar amount before AFS issues the formal quote). §3's own
 * layout note says the same: "No prices on any accessory".
 *
 * GATED, AND OFF BY DEFAULT. With NEXT_PUBLIC_AFS_MATERIAL_CALCULATOR unset this
 * renders nothing, so /quote Step 3 is byte-identical to what it was before this
 * file existed.
 *
 * THE QUANTITY BREAKDOWN IS COMPUTED LOCALLY, EVERY RENDER. calculateMaterials is
 * pure and synchronous, so the waste figures are right before the fetch resolves
 * and stay right if the fetch fails. The request only ever UPGRADES them — a real
 * per-product waste factor, accessory rows, a cut list. That is why the error state
 * can say "your quantity and waste factor above are unaffected" and mean it.
 *
 * Tokens are afs-* only (rule #4), reusing the pairs WasteFactorDisplay.tsx and
 * TrimLengthOptimizerSection.tsx already use on this surface, so this section
 * cannot introduce a new contrast pair to /quote.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  MaterialCalcInputError,
  calculateMaterials,
  isMaterialCalculatorEnabled,
  validateMaterialCalcInput,
} from '@/lib/material-calculator';
import type {
  AccessoryRequirement,
  MaterialCalcResponseBody,
  UncalculableAccessory,
} from '@/lib/material-calculator';

interface MaterialCalculatorSectionProps {
  lengthFt: number;
  quantity: number;
  profileType: string;
  material: string;
  gauge: string;
  stockLengthFt: number | null;
  /**
   * Receives one "<name> - <qty> <unit>" string per ticked accessory. The quote
   * wizard folds these into the request's notes — the same mechanism CrossSellPanel's
   * selections already travel by, so adding this section changed no payload shape.
   */
  onSelectionChange: (selected: string[]) => void;
}

type FetchState = 'idle' | 'loading' | 'loaded' | 'error';

/** Milliseconds of quiet before asking the server, matching CrossSellPanel. */
const DEBOUNCE_MS = 400;

/**
 * Stable identities, so `?? EMPTY` does not hand a fresh array to a dependency array
 * on every render — which would make the selection effect re-fire forever.
 */
const NO_REQUIREMENTS: readonly AccessoryRequirement[] = [];
const NO_REFUSALS: readonly UncalculableAccessory[] = [];

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function accessoryLabel(accessory: AccessoryRequirement): string {
  return `${accessory.accessoryName} - ${formatQty(accessory.calculatedQty)} ${accessory.unit}`;
}

const rowClass = 'flex items-center justify-between gap-4';
const termClass = 'font-body text-sm text-afs-chrome-mid';
const valueClass = 'font-data text-sm text-afs-chrome-high';
const groupHeadingClass =
  'font-label text-xs uppercase tracking-wide text-afs-chrome-high block mb-2';
const accessoryRowClass =
  'flex items-center gap-3 bg-afs-bg-raised border border-afs-chrome-dim rounded px-3 py-2 cursor-pointer hover:border-afs-chrome-base transition-colors';
/**
 * No text colour here on purpose. Two competing `text-*` utilities on one element are
 * resolved by the order the rules appear in the generated stylesheet, NOT by the order
 * they are written in the className — so each notice below sets its own colour and none
 * of them stack a second one on top.
 */
const noticeClass = 'font-body text-sm pt-3 border-t border-afs-chrome-dim';

export default function MaterialCalculatorSection({
  lengthFt,
  quantity,
  profileType,
  material,
  gauge,
  stockLengthFt,
  onSelectionChange,
}: MaterialCalculatorSectionProps) {
  // §3: "collapsible accordion, expanded by default".
  const [isOpen, setIsOpen] = useState(true);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [serverResult, setServerResult] = useState<MaterialCalcResponseBody | null>(null);
  // §3: required rows are checked and the user may uncheck; optional rows start
  // unchecked and the user may add. Tracking the EXCEPTIONS in each direction means a
  // newly-arrived required row is already checked without an effect going to tick it.
  const [unchecked, setUnchecked] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const enabled = isMaterialCalculatorEnabled();

  // Nothing entered yet: the customer has not filled Step 2's quantity fields, or has
  // cleared them. Not an error — the same guard shape the two Step 2 panels already use.
  const hasEnteredQuantities = lengthFt > 0 && quantity > 0;

  const validation = useMemo(
    () => validateMaterialCalcInput({ lengthFt, quantity, stockLengthFt }),
    [lengthFt, quantity, stockLengthFt]
  );
  const shouldCalculate = enabled && hasEnteredQuantities && validation.ok;

  /**
   * The local, synchronous §2.1 + §2.3 breakdown. Wrapped in a try because
   * `validation` and `calculateMaterials` must never disagree about what is
   * acceptable; if they somehow do, this renders nothing rather than taking the step
   * down with it.
   */
  const localResult = useMemo(() => {
    if (!shouldCalculate) return null;
    try {
      return calculateMaterials({ lengthFt, quantity, stockLengthFt });
    } catch (error) {
      if (error instanceof MaterialCalcInputError) return null;
      throw error;
    }
  }, [shouldCalculate, lengthFt, quantity, stockLengthFt]);

  useEffect(() => {
    if (!shouldCalculate) {
      setFetchState('idle');
      setServerResult(null);
      return;
    }

    // Cancellation-safe and supersede-safe, the pattern CrossSellPanel already uses on
    // this page: a stale response must never overwrite a newer one, and an unmounted
    // component must set no state.
    let cancelled = false;
    setFetchState('loading');

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch('/api/calculator/materials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lengthFt,
              pieces: quantity,
              stockLengthFt,
              profileLabel: profileType || null,
              materialLabel: material || null,
              gaugeLabel: gauge || null,
            }),
          });
          if (cancelled) return;
          if (!res.ok) {
            setFetchState('error');
            setServerResult(null);
            return;
          }
          const data = (await res.json()) as MaterialCalcResponseBody;
          if (cancelled) return;
          setServerResult(data);
          setFetchState('loaded');
        } catch {
          if (!cancelled) {
            setFetchState('error');
            setServerResult(null);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shouldCalculate, lengthFt, quantity, stockLengthFt, profileType, material, gauge]);

  const required = serverResult?.requiredAccessories ?? NO_REQUIREMENTS;
  const optional = serverResult?.optionalAccessories ?? NO_REQUIREMENTS;
  const refused = serverResult?.uncalculableAccessories ?? NO_REFUSALS;

  const selectedLabels = useMemo(
    () =>
      [
        ...required.filter((a) => !unchecked[a.accessoryId]),
        ...optional.filter((a) => added[a.accessoryId]),
      ].map(accessoryLabel),
    [required, optional, unchecked, added]
  );

  /**
   * Reported on CONTENT change, not on identity change. The quote wizard holds the
   * result in its own state, so firing on every render would loop; keying on the
   * serialised labels means a changed quantity updates what is in the request while an
   * unchanged selection reports nothing. JSON rather than a joined string because an
   * accessory name contains spaces and must survive the round trip intact.
   */
  const selectionKey = JSON.stringify(selectedLabels);
  useEffect(() => {
    onSelectionChange(JSON.parse(selectionKey) as string[]);
  }, [selectionKey, onSelectionChange]);

  // THE DISABLED STATE: nothing at all, so Step 3 is byte-identical with the gate off.
  if (!enabled) return null;
  if (!hasEnteredQuantities) return null;

  // OUT OF RANGE. The wizard's number fields accept anything typed into them, and a
  // request of a million linear feet is refused by the library's resource guards — so
  // say so, rather than letting the panel silently vanish.
  if (!validation.ok) {
    return (
      <section className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mt-6">
        <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2">
          Auto Material Calculator
        </p>
        <p className="font-body text-sm text-afs-chrome-high">{validation.errors[0].message}</p>
      </section>
    );
  }

  if (!localResult) return null;

  const waste = serverResult
    ? {
        rawQtyLf: serverResult.rawQtyLf,
        wasteFactorPct: serverResult.wasteFactorPct,
        wasteQtyLf: serverResult.wasteQtyLf,
        adjustedQtyLf: serverResult.adjustedQtyLf,
        isEstimated: serverResult.isWasteEstimated,
      }
    : localResult.waste;

  const stock = serverResult ? serverResult.stockOptimization : localResult.stockOptimization;
  const hasAnyAccessoryRow = required.length > 0 || optional.length > 0 || refused.length > 0;

  return (
    <section
      className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mt-6"
      aria-labelledby="material-calculator-heading"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <span
          id="material-calculator-heading"
          className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid"
        >
          Auto Material Calculator
        </span>
        <span
          className={`shrink-0 text-afs-danger-on-dark transition-transform ${isOpen ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          <div className="space-y-1.5">
            <div className={rowClass}>
              <span className={termClass}>Your quantity</span>
              <span className={valueClass}>{formatQty(waste.rawQtyLf)} LF</span>
            </div>
            <div className={rowClass}>
              <span className={termClass}>
                + Waste factor ({waste.wasteFactorPct}%{waste.isEstimated ? ', estimated' : ''})
              </span>
              <span className={valueClass}>+{formatQty(waste.wasteQtyLf)} LF</span>
            </div>
            <div className={`${rowClass} pt-1.5 border-t border-afs-chrome-dim`}>
              <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-high">
                Total ordered
              </span>
              {/* afs-danger-on-dark, NOT afs-crimson. Measured against this panel's own
                  afs-bg-surface, crimson as TEXT is 1.42:1 — precisely the failure
                  CLAUDE.md rule #29 names, and on a dark surface there is no darker red
                  that helps. danger-on-dark is 5.64:1 here and still reads as red.
                  WasteFactorDisplay.tsx and TrimLengthOptimizerSection.tsx both still use
                  crimson for this; that is a pre-existing defect reported with this item,
                  not one to copy. */}
              <span className="font-data text-sm font-semibold text-afs-danger-on-dark">
                {formatQty(waste.adjustedQtyLf)} LF
              </span>
            </div>
            <p className="font-body text-xs text-afs-chrome-mid pt-1">
              Total ordered is the billed quantity. AFS sets the price on your formal quote.
            </p>
          </div>

          {stock !== null && (
            <div className="space-y-1.5 pt-3 border-t border-afs-chrome-dim">
              <span className={groupHeadingClass}>Stock lengths</span>
              <div className={rowClass}>
                <span className={termClass}>
                  {stock.piecesOrdered} {stock.piecesOrdered === 1 ? 'piece' : 'pieces'} x{' '}
                  {formatQty(stock.stockLengthFt)} ft stock
                </span>
                <span className={valueClass}>{formatQty(stock.totalStockFt)} ft</span>
              </div>
              <div className={rowClass}>
                <span className={termClass}>Off-cut</span>
                <span className={valueClass}>{formatQty(stock.wasteLinearFt)} LF</span>
              </div>
            </div>
          )}

          {/* LOADING — labelled, not a bare spinner, so it says what is happening. */}
          {fetchState === 'loading' && (
            <p className={`${noticeClass} text-afs-chrome-mid`} role="status">
              Checking which accessories this order needs...
            </p>
          )}

          {/* ERROR — says what did NOT happen (CLAUDE.md rule #30's wording rule). */}
          {fetchState === 'error' && (
            <p className={`${noticeClass} text-afs-chrome-high`} role="alert">
              Accessory quantities could not be loaded. Your quantity and waste factor above are
              unaffected, and nothing about your quote request has changed — AFS will confirm
              accessories on your quote.
            </p>
          )}

          {/* EMPTY — the honest state while product_accessories has no rows. Never an
              empty box, and never a fabricated list. */}
          {fetchState === 'loaded' && !hasAnyAccessoryRow && (
            <p className={`${noticeClass} text-afs-chrome-mid`}>
              No accessory quantities are on file for this profile and material yet. AFS will
              confirm the accessories this order needs on your formal quote.
            </p>
          )}

          {required.length > 0 && (
            <div className="pt-3 border-t border-afs-chrome-dim">
              <span className={groupHeadingClass}>Required with this order</span>
              <div className="space-y-2">
                {required.map((accessory) => (
                  <label key={accessory.accessoryId} className={accessoryRowClass}>
                    <input
                      type="checkbox"
                      checked={!unchecked[accessory.accessoryId]}
                      onChange={() =>
                        setUnchecked((prev) => ({
                          ...prev,
                          [accessory.accessoryId]: !prev[accessory.accessoryId],
                        }))
                      }
                      className="accent-afs-crimson"
                    />
                    <span className="font-body text-sm text-afs-chrome-high flex-1">
                      {accessory.accessoryName}
                    </span>
                    <span className={valueClass}>
                      {formatQty(accessory.calculatedQty)} {accessory.unit}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {optional.length > 0 && (
            <div className="pt-3 border-t border-afs-chrome-dim">
              <span className={groupHeadingClass}>Also commonly ordered</span>
              <div className="space-y-2">
                {optional.map((accessory) => (
                  <label key={accessory.accessoryId} className={accessoryRowClass}>
                    <input
                      type="checkbox"
                      checked={Boolean(added[accessory.accessoryId])}
                      onChange={() =>
                        setAdded((prev) => ({
                          ...prev,
                          [accessory.accessoryId]: !prev[accessory.accessoryId],
                        }))
                      }
                      className="accent-afs-crimson"
                    />
                    <span className="font-body text-sm text-afs-chrome-high flex-1">
                      {accessory.accessoryName}
                    </span>
                    <span className={valueClass}>
                      {formatQty(accessory.calculatedQty)} {accessory.unit}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Listed, not dropped: the contractor still needs to know the accessory
              applies even when AFS has to supply the count. */}
          {refused.length > 0 && (
            <div className="pt-3 border-t border-afs-chrome-dim">
              <span className={groupHeadingClass}>AFS will confirm the quantity</span>
              <ul className="space-y-2">
                {refused.map((accessory) => (
                  <li key={accessory.accessoryId}>
                    <span className="font-body text-sm text-afs-chrome-high block">
                      {accessory.accessoryName}
                    </span>
                    <span className="font-body text-xs text-afs-chrome-mid">
                      {accessory.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
