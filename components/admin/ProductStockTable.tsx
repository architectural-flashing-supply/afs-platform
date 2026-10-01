'use client';

import { useMemo, useState } from 'react';
import { STOCK_TYPE_LABEL, type StockType } from '@/lib/data/catalog';
import type { ProductStockRow } from '@/lib/data/product-stock';

interface ProductStockTableProps {
  rows: ProductStockRow[];
}

interface RowState {
  stockType: StockType;
  leadTimeDays: string;
  saving: boolean;
  error: string | null;
  saved: boolean;
}

const STOCK_TYPES = Object.keys(STOCK_TYPE_LABEL) as StockType[];

const selectClass =
  'w-full bg-afs-bg-overlay border border-afs-chrome-base rounded px-3 py-2 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body';
const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data text-right';

export default function ProductStockTable({ rows }: ProductStockTableProps) {
  const [state, setState] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const r of rows) {
      initial[r.productId] = {
        stockType: r.stockType,
        leadTimeDays: String(r.leadTimeDays),
        saving: false,
        error: null,
        saved: false,
      };
    }
    return initial;
  });

  const [bulkMaterial, setBulkMaterial] = useState('');
  const [bulkStockType, setBulkStockType] = useState<StockType>('stock');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.materialName) set.add(r.materialName);
    return Array.from(set).sort();
  }, [rows]);

  function update(productId: string, field: 'stockType' | 'leadTimeDays', value: string) {
    setState((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value, saved: false } }));
  }

  async function saveRow(productId: string) {
    const row = state[productId];
    setState((prev) => ({ ...prev, [productId]: { ...prev[productId], saving: true, error: null } }));

    const leadTimeDays = Number(row.leadTimeDays);
    if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0) {
      setState((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], saving: false, error: 'Lead time must be a whole number of days.' },
      }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/inventory/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockType: row.stockType, leadTimeDays }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState((prev) => ({ ...prev, [productId]: { ...prev[productId], saving: false, error: data.error ?? 'Could not save this row.' } }));
        return;
      }
      setState((prev) => ({ ...prev, [productId]: { ...prev[productId], saving: false, saved: true } }));
    } catch {
      setState((prev) => ({ ...prev, [productId]: { ...prev[productId], saving: false, error: 'Could not save this row.' } }));
    }
  }

  async function applyBulk() {
    if (!bulkMaterial) {
      setBulkError('Choose a material first.');
      return;
    }
    setBulkApplying(true);
    setBulkError(null);
    setBulkMessage(null);

    try {
      const res = await fetch('/api/admin/inventory/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material: bulkMaterial, stockType: bulkStockType }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; updated?: number };
      if (!res.ok) {
        setBulkApplying(false);
        setBulkError(data.error ?? 'Could not apply the bulk update.');
        return;
      }

      setState((prev) => {
        const next = { ...prev };
        for (const r of rows) {
          if (r.materialName === bulkMaterial) {
            next[r.productId] = { ...next[r.productId], stockType: bulkStockType, saved: false };
          }
        }
        return next;
      });
      setBulkApplying(false);
      setBulkMessage(`Updated ${data.updated ?? 0} product${data.updated === 1 ? '' : 's'} to "${STOCK_TYPE_LABEL[bulkStockType]}".`);
    } catch {
      setBulkApplying(false);
      setBulkError('Could not apply the bulk update.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {materials.length > 0 && (
        <div className="bg-afs-bg-surface border border-afs-border rounded p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">
              Set all
            </label>
            <select value={bulkMaterial} onChange={(e) => setBulkMaterial(e.target.value)} className={selectClass}>
              <option value="">Choose a material…</option>
              {materials.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1.5 block">
              products to
            </label>
            <select
              value={bulkStockType}
              onChange={(e) => setBulkStockType(e.target.value as StockType)}
              className={selectClass}
            >
              {STOCK_TYPES.map((s) => (
                <option key={s} value={s}>{STOCK_TYPE_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={applyBulk}
            disabled={bulkApplying}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 py-2 rounded text-xs transition-colors disabled:opacity-50"
          >
            {bulkApplying ? 'Applying…' : 'Apply'}
          </button>
          {bulkError && <p className="font-body text-xs text-afs-danger-on-dark w-full">{bulkError}</p>}
          {bulkMessage && !bulkError && <p className="font-body text-xs text-afs-success-on-dark w-full">{bulkMessage}</p>}
        </div>
      )}

      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">SKU</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Product</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">Material</th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3 w-44">
                Stock Status
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3 w-32">
                Lead Time (days)
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rs = state[row.productId];
              return (
                <tr key={row.productId} className="border-b border-afs-border last:border-b-0 align-top">
                  <td className="font-data text-xs text-afs-chrome-silver px-4 py-3">{row.sku ?? '—'}</td>
                  <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.productName}</td>
                  <td className="font-body text-sm text-afs-chrome-mid px-4 py-3">{row.materialName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={rs.stockType}
                      onChange={(e) => update(row.productId, 'stockType', e.target.value)}
                      className={selectClass}
                    >
                      {STOCK_TYPES.map((s) => (
                        <option key={s} value={s}>{STOCK_TYPE_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={rs.leadTimeDays}
                      onChange={(e) => update(row.productId, 'leadTimeDays', e.target.value)}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => saveRow(row.productId)}
                      disabled={rs.saving}
                      className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-4 py-2 rounded text-xs transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {rs.saving ? 'Saving…' : 'Save Row'}
                    </button>
                    {rs.error && <p className="font-body text-xs text-afs-danger-on-dark mt-1.5">{rs.error}</p>}
                    {rs.saved && !rs.error && <p className="font-body text-xs text-afs-success-on-dark mt-1.5">Saved</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
