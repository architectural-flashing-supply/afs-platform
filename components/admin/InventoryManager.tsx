'use client';

import { useCallback, useMemo, useState } from 'react';
import { mcelroy, pacclad, pacclad_anodized } from '@/lib/data/metal-colors';
import type { InventoryAdjustmentRow, InventoryItemRow, MaterialOption } from '@/lib/data/inventory';
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_KIND_LABEL,
  STOCK_LEVEL_LABEL,
  STOCK_UNITS,
  STOCK_UNIT_LABEL,
  formatQty,
  type AdjustmentKind,
  type StockLevel,
  type StockUnit,
} from '@/lib/inventory/stock-math';

/**
 * LIVE INVENTORY — the admin screen (SPEC_LIVE_INVENTORY.md, queue item 09).
 *
 * ADMIN ONLY. No quantity on this screen is ever shown to a customer: the spec
 * lets a customer see the three-value stock SIGNAL and a lead-time range, and
 * lets them see no quantity at all.
 *
 * ================ EVERY NUMBER HERE IS DERIVED, NOT DECIDED ================
 *
 * This component does NO arithmetic and holds NO thresholds. `available` and
 * `level` arrive already computed by `lib/inventory/stock-math.ts` through
 * `lib/data/inventory.ts`, and every refusal message comes back from the API
 * carrying that same module's own sentence. A `<=` comparison in here would be
 * a second source of truth for what counts as low, and the two would drift.
 *
 * ================ A BLANK IS NEVER A ZERO ================
 *
 * `onHand === null` means nobody has counted this item, and it prints as
 * "Not counted" on amber — never as 0. `reorderPoint === null` means nobody has
 * said what low means, and it prints as "Not set". Both are CLAUDE.md rule #19
 * applied to quantities: a zero is a measurement, and a made-up one.
 *
 * Colours: light working area, so text is the dark `afs-ink-*` family and
 * fields take the same `afs-line-strong` boundary `PriceBookEditor` uses
 * (CLAUDE.md rule #23 — `afs-chrome-*` and the `*-on-dark` tokens measure
 * 1.3-1.6:1 on a white card and must not appear here).
 */

interface InventoryManagerProps {
  initialItems: InventoryItemRow[];
  materials: MaterialOption[];
}

/* ------------------------------------------------------------ shared styles */

const FIELD =
  'min-h-11 w-full rounded-lg border border-afs-line-strong bg-afs-bg-card text-afs-ink-900 font-body px-3 placeholder:text-afs-ink-700';
const PRIMARY_BUTTON =
  'min-h-11 px-4 rounded-lg font-label font-bold bg-afs-green-deep text-afs-chrome-high hover:brightness-95 disabled:opacity-70';
const SECONDARY_BUTTON =
  'min-h-11 px-4 rounded-lg font-label font-bold bg-afs-bg-card border border-afs-line-strong text-afs-ink-900 hover:bg-afs-bg-light-raised disabled:opacity-70';
const DANGER_BUTTON =
  'min-h-11 px-4 rounded-lg font-label font-bold bg-afs-crimson text-afs-chrome-high hover:brightness-95 disabled:opacity-70';
const LABEL = 'font-label text-sm font-bold text-afs-ink-900 mb-1 block';
const CARD = 'bg-afs-bg-card border border-afs-border-light rounded-xl';

/**
 * Every printed colour name AFS orders against, offered as a `<datalist>` so
 * the common case is a pick and an unusual finish is still typeable.
 *
 * `lib/data/metal-colors.ts` states that the NAME is the source of truth for
 * fabrication and ordering, which is why the field stores a name and not an id
 * into some colour table — there is no such table, and a database CHECK over
 * two vendor charts would go stale and then silently refuse real stock.
 */
const FINISH_SUGGESTIONS: string[] = Array.from(
  new Set([...mcelroy, ...pacclad, ...pacclad_anodized].map((c) => c.name))
).sort();

/** The chip classes per level. Light-surface tokens only. */
const LEVEL_CHIP: Record<StockLevel, string> = {
  uncounted: 'bg-afs-amber-bg text-afs-amber-ink',
  out: 'bg-afs-crimson text-afs-chrome-high',
  low: 'bg-afs-amber-bg text-afs-amber-ink',
  no_threshold: 'bg-afs-bg-band text-afs-ink-700',
  ok: 'bg-afs-green-soft text-afs-green-ink',
};

function unitLabel(unit: StockUnit): string {
  return STOCK_UNIT_LABEL[unit].many;
}

/** A quantity, or the honest statement that there is not one. */
function quantityText(value: number | null, unit: StockUnit, blank: string): string {
  if (value === null) return blank;
  return formatQty(value, unit);
}

function itemTitle(item: InventoryItemRow): string {
  const parts = [item.materialName, item.gaugeLabel];
  if (item.finish) parts.push(item.finish);
  if (item.coilWidthIn !== null) parts.push(`${item.coilWidthIn}" wide`);
  return parts.join(' · ');
}

/* ----------------------------------------------------------------- the view */

type RowMode = 'closed' | 'adjust' | 'edit' | 'history';

interface RowUi {
  mode: RowMode;
  busy: boolean;
  error: string | null;
  notice: string | null;
  history: InventoryAdjustmentRow[] | null;
  historyTruncated: boolean;
}

const CLOSED_ROW: RowUi = {
  mode: 'closed',
  busy: false,
  error: null,
  notice: null,
  history: null,
  historyTruncated: false,
};

export default function InventoryManager({ initialItems, materials }: InventoryManagerProps) {
  const [items, setItems] = useState<InventoryItemRow[]>(initialItems);
  const [rowUi, setRowUi] = useState<Record<string, RowUi>>({});
  const [creating, setCreating] = useState(false);

  const ui = useCallback((id: string): RowUi => rowUi[id] ?? CLOSED_ROW, [rowUi]);

  const patchUi = useCallback((id: string, patch: Partial<RowUi>) => {
    setRowUi((prev) => ({ ...prev, [id]: { ...(prev[id] ?? CLOSED_ROW), ...patch } }));
  }, []);

  const replaceItem = useCallback((item: InventoryItemRow) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }, []);

  const attention = useMemo(() => items.filter((i) => i.level === 'out' || i.level === 'low'), [items]);
  const uncounted = useMemo(() => items.filter((i) => i.level === 'uncounted'), [items]);

  return (
    <div className="flex flex-col gap-6">
      <section className={`${CARD} p-5 flex flex-col gap-2`}>
        <p className="font-body text-[15px] text-afs-ink-900">
          What metal is actually in the shop. This is <strong className="text-afs-ink-900">yours only</strong> — a
          customer never sees a quantity, only whether a product fabricates fast or needs a special order.
        </p>
        <p className="font-body text-[15px] text-afs-ink-700">
          A quantity changes in one way: you record an adjustment, and it is written down with your reason and your
          name. Nothing in that history can be edited or deleted afterwards, by anyone.
        </p>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-1">
            <p
              data-testid="inventory-attention-count"
              className={`font-body text-[15px] rounded-lg px-3 py-2 ${
                attention.length > 0 ? 'bg-afs-amber-bg text-afs-amber-ink' : 'bg-afs-green-soft text-afs-green-ink'
              }`}
            >
              {attention.length === 0
                ? 'Nothing is low or out.'
                : `${attention.length} ${attention.length === 1 ? 'item needs' : 'items need'} reordering.`}
            </p>
            {uncounted.length > 0 && (
              <p
                data-testid="inventory-uncounted-count"
                className="font-body text-[15px] rounded-lg px-3 py-2 bg-afs-amber-bg text-afs-amber-ink"
              >
                {uncounted.length} {uncounted.length === 1 ? 'item has' : 'items have'} never been counted. Nothing is
                assumed about {uncounted.length === 1 ? 'it' : 'them'}.
              </p>
            )}
          </div>
        )}
      </section>

      <CreateItemForm
        materials={materials}
        busy={creating}
        setBusy={setCreating}
        onCreated={(item) => setItems((prev) => [...prev, item])}
      />

      {items.length === 0 ? (
        <section data-testid="inventory-empty" className={`${CARD} p-12 text-center`}>
          <h2 className="font-heading text-xl text-afs-ink-900 mb-2">Nothing is being tracked yet</h2>
          <p className="font-body text-[15px] text-afs-ink-700 max-w-xl mx-auto">
            Add the first material above — a coil or a stack of sheets you really keep. Nothing is filled in for you
            and no quantity is assumed: a new item reads &ldquo;Not counted&rdquo; until you walk out and count it.
          </p>
        </section>
      ) : (
        <section className={`${CARD} overflow-x-auto`}>
          <table className="w-full border-collapse min-w-[900px]">
            <caption className="sr-only">Shop material inventory, one row per stocked item</caption>
            <thead>
              <tr className="border-b border-afs-line-strong">
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  Material
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  Counted in
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                  On hand
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                  Reserved
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                  Available
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                  Reorder at
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-3">
                  Status
                </th>
                <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const state = ui(item.id);
                return (
                  <ItemRows
                    key={item.id}
                    item={item}
                    state={state}
                    patchUi={patchUi}
                    replaceItem={replaceItem}
                    removeItem={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                  />
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- one item */

interface ItemRowsProps {
  item: InventoryItemRow;
  state: RowUi;
  patchUi: (id: string, patch: Partial<RowUi>) => void;
  replaceItem: (item: InventoryItemRow) => void;
  removeItem: (id: string) => void;
}

function ItemRows({ item, state, patchUi, replaceItem, removeItem }: ItemRowsProps) {
  const toggle = (mode: RowMode) => {
    patchUi(item.id, { mode: state.mode === mode ? 'closed' : mode, error: null, notice: null });
    if (mode === 'history' && state.history === null) void loadHistory();
  };

  async function loadHistory() {
    patchUi(item.id, { busy: true, error: null });
    try {
      const res = await fetch(`/api/admin/inventory/items/${item.id}/adjustments`);
      const data = (await res.json().catch(() => ({}))) as {
        state?: string;
        adjustments?: InventoryAdjustmentRow[];
        truncated?: boolean;
        error?: string;
      };
      if (!res.ok || data.state === 'error') {
        patchUi(item.id, { busy: false, error: data.error ?? 'Could not read this history. Nothing was changed.' });
        return;
      }
      patchUi(item.id, {
        busy: false,
        history: data.adjustments ?? [],
        historyTruncated: data.truncated === true,
        notice:
          data.state === 'not_provisioned'
            ? 'The inventory tables have not been created in this database yet, so there is no history to read.'
            : null,
      });
    } catch {
      patchUi(item.id, { busy: false, error: 'Could not read this history. Nothing was changed.' });
    }
  }

  async function retire() {
    patchUi(item.id, { busy: true, error: null, notice: null });
    try {
      const res = await fetch(`/api/admin/inventory/items/${item.id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        patchUi(item.id, { busy: false, error: data.error ?? 'Could not retire this item. Nothing was changed.' });
        return;
      }
      removeItem(item.id);
    } catch {
      patchUi(item.id, { busy: false, error: 'Could not retire this item. Nothing was changed.' });
    }
  }

  return (
    <>
      <tr className="border-b border-afs-border-light align-top">
        <td className="font-body text-[15px] text-afs-ink-900 p-3">{itemTitle(item)}</td>
        <td className="font-body text-[15px] text-afs-ink-700 p-3">{unitLabel(item.stockUnit)}</td>
        <td data-testid={`on-hand-${item.id}`} className="font-data text-[15px] text-afs-ink-900 text-right p-3 whitespace-nowrap">
          {quantityText(item.onHand, item.stockUnit, 'Not counted')}
        </td>
        <td className="font-data text-[15px] text-afs-ink-900 text-right p-3 whitespace-nowrap">
          {formatQty(item.reserved, item.stockUnit)}
        </td>
        <td className="font-data text-[15px] text-afs-ink-900 text-right p-3 whitespace-nowrap">
          {quantityText(item.available, item.stockUnit, '—')}
          {item.available !== null && item.available < 0 && (
            <span className="block font-body text-sm text-afs-amber-ink">
              More is reserved than is on hand.
            </span>
          )}
        </td>
        <td className="font-data text-[15px] text-afs-ink-700 text-right p-3 whitespace-nowrap">
          {item.reorderPoint === null ? 'Not set' : formatQty(item.reorderPoint, item.stockUnit)}
        </td>
        <td className="p-3">
          <span
            data-testid={`level-${item.id}`}
            className={`inline-block rounded-lg px-3 py-1 font-label text-sm font-bold ${LEVEL_CHIP[item.level]}`}
          >
            {STOCK_LEVEL_LABEL[item.level]}
          </span>
        </td>
        <td className="p-3 text-right whitespace-nowrap">
          <span className="inline-flex gap-2 flex-wrap justify-end">
            <button type="button" onClick={() => toggle('adjust')} className={SECONDARY_BUTTON} disabled={state.busy}>
              {state.mode === 'adjust' ? 'Cancel' : 'Adjust'}
            </button>
            <button type="button" onClick={() => toggle('edit')} className={SECONDARY_BUTTON} disabled={state.busy}>
              {state.mode === 'edit' ? 'Cancel' : 'Edit'}
            </button>
            <button type="button" onClick={() => toggle('history')} className={SECONDARY_BUTTON} disabled={state.busy}>
              {state.mode === 'history' ? 'Hide history' : 'History'}
            </button>
          </span>
        </td>
      </tr>

      {(state.error || state.notice) && (
        <tr className="border-b border-afs-border-light">
          <td colSpan={8} className="px-3 pb-3">
            {state.error && (
              <p className="font-body text-[15px] rounded-lg p-3 bg-afs-amber-bg text-afs-amber-ink">{state.error}</p>
            )}
            {state.notice && !state.error && (
              <p className="font-body text-[15px] rounded-lg p-3 bg-afs-bg-band text-afs-ink-700">{state.notice}</p>
            )}
          </td>
        </tr>
      )}

      {state.mode === 'adjust' && (
        <tr className="border-b border-afs-border-light bg-afs-bg-lane">
          <td colSpan={8} className="p-3">
            <AdjustForm
              item={item}
              busy={state.busy}
              onBusy={(busy) => patchUi(item.id, { busy })}
              onError={(error) => patchUi(item.id, { error })}
              onApplied={(updated, message) => {
                if (updated) replaceItem(updated);
                patchUi(item.id, { busy: false, error: null, notice: message, history: null });
              }}
            />
          </td>
        </tr>
      )}

      {state.mode === 'edit' && (
        <tr className="border-b border-afs-border-light bg-afs-bg-lane">
          <td colSpan={8} className="p-3">
            <EditForm
              item={item}
              busy={state.busy}
              onBusy={(busy) => patchUi(item.id, { busy })}
              onError={(error) => patchUi(item.id, { error })}
              onSaved={(updated) => {
                replaceItem(updated);
                patchUi(item.id, { mode: 'closed', busy: false, error: null, notice: 'Saved.' });
              }}
              onRetire={retire}
            />
          </td>
        </tr>
      )}

      {state.mode === 'history' && (
        <tr className="border-b border-afs-border-light bg-afs-bg-lane">
          <td colSpan={8} className="p-3">
            <HistoryPanel item={item} rows={state.history} busy={state.busy} truncated={state.historyTruncated} />
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------ adjust form */

interface AdjustFormProps {
  item: InventoryItemRow;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (error: string) => void;
  onApplied: (item: InventoryItemRow | null, message: string) => void;
}

function AdjustForm({ item, busy, onBusy, onError, onApplied }: AdjustFormProps) {
  const [kind, setKind] = useState<AdjustmentKind>('count');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  async function apply() {
    const parsed = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(parsed)) {
      onError('Enter an amount as a number.');
      return;
    }
    if (reason.trim().length < 3) {
      onError('Say why, in a few words. Every adjustment records a reason.');
      return;
    }

    onBusy(true);
    try {
      const res = await fetch(`/api/admin/inventory/items/${item.id}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount: parsed,
          reason: reason.trim(),
          // A ONE-TIME ID PER SUBMISSION. Every kind but `count` is a DELTA, so
          // a double click would otherwise record a receipt of 40 sheets as 80.
          // The server returns the original row for a repeat and says so.
          clientRequestId: crypto.randomUUID(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        item?: InventoryItemRow | null;
        alreadyApplied?: boolean;
        message?: string;
      };
      if (!res.ok) {
        onBusy(false);
        onError(data.error ?? 'Could not apply this adjustment. Nothing was changed.');
        return;
      }
      setAmount('');
      setReason('');
      onApplied(
        data.item ?? null,
        data.alreadyApplied
          ? (data.message ?? 'This adjustment had already been applied. Nothing was applied again.')
          : 'Applied, and written into the history.'
      );
    } catch {
      onBusy(false);
      onError('Could not apply this adjustment. Nothing was changed.');
    }
  }

  const amountHelp =
    kind === 'count'
      ? `The number you counted, in ${unitLabel(item.stockUnit)}. This replaces what is on hand.`
      : `How much, in ${unitLabel(item.stockUnit)}. Always a positive number — the kind above decides which way it goes.`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-start">
        <div className="min-w-[220px]">
          <label className={LABEL} htmlFor={`kind-${item.id}`}>
            What happened
          </label>
          <select
            id={`kind-${item.id}`}
            value={kind}
            onChange={(e) => setKind(e.target.value as AdjustmentKind)}
            className={FIELD}
          >
            {ADJUSTMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ADJUSTMENT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className={LABEL} htmlFor={`amount-${item.id}`}>
            Amount
          </label>
          <input
            id={`amount-${item.id}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`in ${unitLabel(item.stockUnit)}`}
            className={FIELD}
          />
        </div>
        <div className="min-w-[280px] grow">
          <label className={LABEL} htmlFor={`reason-${item.id}`}>
            Why
          </label>
          <input
            id={`reason-${item.id}`}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Counted the rack / arrived from the supplier / held for a job"
            className={FIELD}
          />
        </div>
        <div className="self-end">
          <button type="button" onClick={apply} disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
      <p className="font-body text-sm text-afs-ink-700">{amountHelp}</p>
      {item.onHand === null && (
        <p className="font-body text-[15px] rounded-lg p-3 bg-afs-amber-bg text-afs-amber-ink">
          This item has never been counted, so the only adjustment it will accept is a physical count. Nothing is
          assumed about how much is there.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- edit form */

interface EditFormProps {
  item: InventoryItemRow;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (error: string) => void;
  onSaved: (item: InventoryItemRow) => void;
  onRetire: () => void;
}

function EditForm({ item, busy, onBusy, onError, onSaved, onRetire }: EditFormProps) {
  const [finish, setFinish] = useState(item.finish ?? '');
  const [coilWidth, setCoilWidth] = useState(item.coilWidthIn === null ? '' : String(item.coilWidthIn));
  const [reorderPoint, setReorderPoint] = useState(item.reorderPoint === null ? '' : String(item.reorderPoint));
  const [confirmRetire, setConfirmRetire] = useState(false);

  const unitIsLocked = item.onHand !== null || item.reserved !== 0;

  async function save() {
    const coil = coilWidth.trim() === '' ? null : Number(coilWidth);
    if (coil !== null && (!Number.isFinite(coil) || coil <= 0)) {
      onError('Coil width must be a measurement greater than zero, or left blank.');
      return;
    }
    const reorder = reorderPoint.trim() === '' ? null : Number(reorderPoint);
    if (reorder !== null && (!Number.isFinite(reorder) || reorder < 0)) {
      onError('The reorder point must be zero or more, or left blank.');
      return;
    }

    onBusy(true);
    try {
      const res = await fetch(`/api/admin/inventory/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finish: finish.trim() === '' ? null : finish.trim(),
          coilWidthIn: coil,
          reorderPoint: reorder,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: InventoryItemRow };
      if (!res.ok || !data.item) {
        onBusy(false);
        onError(data.error ?? 'Could not save this item. Nothing was changed.');
        return;
      }
      onSaved(data.item);
    } catch {
      onBusy(false);
      onError('Could not save this item. Nothing was changed.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-body text-sm text-afs-ink-700">
        The material and gauge of an item never change — that is what it <em>is</em>. Quantities change through an
        adjustment, so they are not here either.
      </p>
      <div className="flex flex-wrap gap-3 items-start">
        <div className="min-w-[260px] grow">
          <label className={LABEL} htmlFor={`finish-${item.id}`}>
            Finish or colour
          </label>
          <input
            id={`finish-${item.id}`}
            type="text"
            list="afs-finish-names"
            value={finish}
            onChange={(e) => setFinish(e.target.value)}
            placeholder="Leave blank for mill finish"
            className={FIELD}
          />
        </div>
        <div className="min-w-[160px]">
          <label className={LABEL} htmlFor={`coil-${item.id}`}>
            Coil width (inches)
          </label>
          <input
            id={`coil-${item.id}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={coilWidth}
            onChange={(e) => setCoilWidth(e.target.value)}
            placeholder="Blank for sheets"
            className={FIELD}
          />
        </div>
        <div className="min-w-[180px]">
          <label className={LABEL} htmlFor={`reorder-${item.id}`}>
            Reorder at ({unitLabel(item.stockUnit)})
          </label>
          <input
            id={`reorder-${item.id}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
            placeholder="Blank for no alert"
            className={FIELD}
          />
        </div>
        <div className="self-end flex gap-2">
          <button type="button" onClick={save} disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {unitIsLocked && (
        <p className="font-body text-sm text-afs-ink-700">
          Counted in {unitLabel(item.stockUnit)}, and that cannot change now: every number on this item and in its
          history is in {unitLabel(item.stockUnit)}, so switching would quietly make all of them wrong. Add a separate
          item for another unit.
        </p>
      )}

      <div className="border-t border-afs-border-light pt-3">
        {confirmRetire ? (
          <div className="flex flex-wrap gap-2 items-center">
            <p className="font-body text-[15px] text-afs-ink-900 grow min-w-[280px]">
              Retire this item? It leaves the list, and its history is kept — nothing is deleted.
            </p>
            <button type="button" onClick={onRetire} disabled={busy} className={DANGER_BUTTON}>
              {busy ? 'Retiring…' : 'Yes, retire it'}
            </button>
            <button type="button" onClick={() => setConfirmRetire(false)} disabled={busy} className={SECONDARY_BUTTON}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmRetire(true)} disabled={busy} className={SECONDARY_BUTTON}>
            Retire this item
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- history panel */

function HistoryPanel({
  item,
  rows,
  busy,
  truncated,
}: {
  item: InventoryItemRow;
  rows: InventoryAdjustmentRow[] | null;
  busy: boolean;
  truncated: boolean;
}) {
  if (busy && rows === null) {
    return <p className="font-body text-[15px] text-afs-ink-700">Reading the history…</p>;
  }
  if (rows === null) {
    return <p className="font-body text-[15px] text-afs-ink-700">No history has been read yet.</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="font-body text-[15px] text-afs-ink-700">
        Nothing has been recorded against this item yet. The first adjustment you make appears here, permanently.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full border-collapse">
        <caption className="sr-only">Adjustment history for {itemTitle(item)}</caption>
        <thead>
          <tr className="border-b border-afs-line-strong">
            <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-2">
              When
            </th>
            <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-2">
              What
            </th>
            <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-2">
              Change
            </th>
            <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-right p-2">
              On hand after
            </th>
            <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-2">
              Why
            </th>
            <th scope="col" className="font-label text-sm font-bold text-afs-ink-900 text-left p-2">
              Who
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-afs-border-light">
              <td className="font-data text-sm text-afs-ink-700 p-2 whitespace-nowrap">
                {new Date(row.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </td>
              <td className="font-body text-[15px] text-afs-ink-900 p-2">{ADJUSTMENT_KIND_LABEL[row.kind]}</td>
              <td className="font-data text-[15px] text-afs-ink-900 text-right p-2 whitespace-nowrap">
                {describeChange(row, item.stockUnit)}
              </td>
              <td className="font-data text-[15px] text-afs-ink-900 text-right p-2 whitespace-nowrap">
                {quantityText(row.onHandAfter, item.stockUnit, '—')}
              </td>
              <td className="font-body text-[15px] text-afs-ink-900 p-2">{row.reason}</td>
              <td className="font-body text-[15px] text-afs-ink-700 p-2">{row.adjustedByName ?? 'Unknown'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-body text-sm text-afs-ink-700">
        {truncated
          ? `Showing the most recent ${rows.length} of a longer history. Nothing here can be edited or deleted, by anyone.`
          : 'Nothing here can be edited or deleted, by anyone. That is enforced by the database.'}
      </p>
    </div>
  );
}

/**
 * How one ledger row reads. A count prints the absolute value it set; a delta
 * prints with its sign, which is the sign the database stored.
 */
function describeChange(row: InventoryAdjustmentRow, unit: StockUnit): string {
  if (row.countedOnHand !== null) return `counted ${formatQty(row.countedOnHand, unit)}`;
  if (row.deltaOnHand !== null) {
    const sign = row.deltaOnHand > 0 ? '+' : '−';
    return `${sign}${formatQty(Math.abs(row.deltaOnHand), unit)} on hand`;
  }
  if (row.deltaReserved !== null) {
    const sign = row.deltaReserved > 0 ? '+' : '−';
    return `${sign}${formatQty(Math.abs(row.deltaReserved), unit)} reserved`;
  }
  // Unreachable while migration 039's shape CHECK holds — every row carries
  // exactly one of the three. Said plainly rather than rendered as "undefined".
  return 'no change recorded';
}

/* ------------------------------------------------------------ create form */

interface CreateItemFormProps {
  materials: MaterialOption[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCreated: (item: InventoryItemRow) => void;
}

function CreateItemForm({ materials, busy, setBusy, onCreated }: CreateItemFormProps) {
  const [open, setOpen] = useState(false);
  const [materialId, setMaterialId] = useState('');
  const [gaugeId, setGaugeId] = useState('');
  const [finish, setFinish] = useState('');
  const [coilWidth, setCoilWidth] = useState('');
  const [stockUnit, setStockUnit] = useState<StockUnit>('sheet');
  const [reorderPoint, setReorderPoint] = useState('');
  const [error, setError] = useState<string | null>(null);

  const gauges = useMemo(() => materials.find((m) => m.id === materialId)?.gauges ?? [], [materials, materialId]);

  if (materials.length === 0) {
    return (
      <section className={`${CARD} p-5`}>
        <h2 className="font-heading text-xl text-afs-ink-900 mb-2">Add material</h2>
        <p className="font-body text-[15px] text-afs-ink-700">
          There are no materials with an active gauge in this database yet, so there is nothing to add inventory
          against. An inventory item is always a real material and a real gauge — never a name typed in by hand.
        </p>
      </section>
    );
  }

  async function create() {
    setError(null);
    if (!materialId) {
      setError('Choose a material.');
      return;
    }
    if (!gaugeId) {
      setError('Choose a gauge.');
      return;
    }
    const coil = coilWidth.trim() === '' ? null : Number(coilWidth);
    if (coil !== null && (!Number.isFinite(coil) || coil <= 0)) {
      setError('Coil width must be a measurement greater than zero, or left blank.');
      return;
    }
    const reorder = reorderPoint.trim() === '' ? null : Number(reorderPoint);
    if (reorder !== null && (!Number.isFinite(reorder) || reorder < 0)) {
      setError('The reorder point must be zero or more, or left blank.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          gaugeId,
          finish: finish.trim() === '' ? null : finish.trim(),
          coilWidthIn: coil,
          stockUnit,
          reorderPoint: reorder,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; item?: InventoryItemRow };
      setBusy(false);
      if (!res.ok || !data.item) {
        setError(data.error ?? 'Could not create the item. Nothing was saved.');
        return;
      }
      onCreated(data.item);
      setFinish('');
      setCoilWidth('');
      setReorderPoint('');
      setOpen(false);
    } catch {
      setBusy(false);
      setError('Could not create the item. Nothing was saved.');
    }
  }

  return (
    <section className={`${CARD} p-5 flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl text-afs-ink-900">Add material</h2>
        <button type="button" onClick={() => setOpen(!open)} className={SECONDARY_BUTTON}>
          {open ? 'Cancel' : 'Add an item'}
        </button>
      </div>

      {open && (
        <>
          <div className="flex flex-wrap gap-3 items-start">
            <div className="min-w-[200px]">
              <label className={LABEL} htmlFor="new-material">
                Material
              </label>
              <select
                id="new-material"
                value={materialId}
                onChange={(e) => {
                  setMaterialId(e.target.value);
                  setGaugeId('');
                }}
                className={FIELD}
              >
                <option value="">Choose…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className={LABEL} htmlFor="new-gauge">
                Gauge
              </label>
              <select
                id="new-gauge"
                value={gaugeId}
                onChange={(e) => setGaugeId(e.target.value)}
                className={FIELD}
                disabled={gauges.length === 0}
              >
                <option value="">{materialId ? 'Choose…' : 'Pick a material first'}</option>
                {gauges.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] grow">
              <label className={LABEL} htmlFor="new-finish">
                Finish or colour
              </label>
              <input
                id="new-finish"
                type="text"
                list="afs-finish-names"
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                placeholder="Leave blank for mill finish"
                className={FIELD}
              />
            </div>
            <div className="min-w-[150px]">
              <label className={LABEL} htmlFor="new-unit">
                Counted in
              </label>
              <select
                id="new-unit"
                value={stockUnit}
                onChange={(e) => setStockUnit(e.target.value as StockUnit)}
                className={FIELD}
              >
                {STOCK_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {STOCK_UNIT_LABEL[u].many}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[150px]">
              <label className={LABEL} htmlFor="new-coil">
                Coil width (inches)
              </label>
              <input
                id="new-coil"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={coilWidth}
                onChange={(e) => setCoilWidth(e.target.value)}
                placeholder="Blank for sheets"
                className={FIELD}
              />
            </div>
            <div className="min-w-[160px]">
              <label className={LABEL} htmlFor="new-reorder">
                Reorder at
              </label>
              <input
                id="new-reorder"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                placeholder="Blank for no alert"
                className={FIELD}
              />
            </div>
            <div className="self-end">
              <button type="button" onClick={create} disabled={busy} className={PRIMARY_BUTTON}>
                {busy ? 'Adding…' : 'Add item'}
              </button>
            </div>
          </div>

          <p className="font-body text-sm text-afs-ink-700">
            No quantity here on purpose. A new item reads &ldquo;Not counted&rdquo; until you record a physical count,
            because a count is what writes the history — and a zero would be a measurement nobody took.
          </p>

          {error && <p className="font-body text-[15px] rounded-lg p-3 bg-afs-amber-bg text-afs-amber-ink">{error}</p>}
        </>
      )}

      {/* One datalist for every finish field on the page. The NAME is what AFS
          orders against (lib/data/metal-colors.ts), so this suggests rather
          than restricts — an unlisted finish is still typeable. */}
      <datalist id="afs-finish-names">
        {FINISH_SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </section>
  );
}
