'use client';

import { useState } from 'react';
import type { PricingRuleRow } from '@/lib/data/pricing';

interface PricingRulesEditorTableProps {
  rows: PricingRuleRow[];
}

interface RowState {
  costNotes: string;
  targetMarginPct: string;
  wasteFactor: string;
  rushSurchargePct: string;
  saving: boolean;
  error: string | null;
  saved: boolean;
}

type EditableField = 'costNotes' | 'targetMarginPct' | 'wasteFactor' | 'rushSurchargePct';

function toPercentString(fraction: number | null): string {
  return fraction == null ? '' : String(Math.round(fraction * 10000) / 100);
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-data';

export default function PricingRulesEditorTable({ rows }: PricingRulesEditorTableProps) {
  const [state, setState] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const r of rows) {
      initial[r.productId] = {
        costNotes: r.costNotes ?? '',
        targetMarginPct: toPercentString(r.targetMarginPct),
        wasteFactor: r.wasteFactor != null ? String(r.wasteFactor) : '',
        rushSurchargePct: toPercentString(r.rushSurchargePct),
        saving: false,
        error: null,
        saved: false,
      };
    }
    return initial;
  });

  function update(productId: string, field: EditableField, value: string) {
    setState((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value, saved: false } }));
  }

  async function saveRow(productId: string) {
    const row = state[productId];
    setState((prev) => ({ ...prev, [productId]: { ...prev[productId], saving: true, error: null } }));

    try {
      const body: Record<string, unknown> = { costNotes: row.costNotes.slice(0, 200) };
      if (row.targetMarginPct.trim() !== '') body.targetMarginPct = Number(row.targetMarginPct) / 100;
      if (row.wasteFactor.trim() !== '') body.wasteFactor = Number(row.wasteFactor);
      if (row.rushSurchargePct.trim() !== '') body.rushSurchargePct = Number(row.rushSurchargePct) / 100;

      const res = await fetch(`/api/admin/pricing/rules/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  return (
    <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-afs-bg-surface border-b border-afs-border">
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">Product</th>
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">Material</th>
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3 w-56">
              Cost Notes
            </th>
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3 w-32">
              Target Margin %
            </th>
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3 w-28">
              Waste Factor
            </th>
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3 w-24">
              Rush %
            </th>
            <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3 w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rs = state[row.productId];
            return (
              <tr key={row.productId} className="border-b border-afs-border last:border-b-0 align-top">
                <td className="font-body text-sm text-afs-ink-900 px-4 py-3">{row.productName}</td>
                <td className="font-body text-sm text-afs-ink-700 px-4 py-3">{row.materialName ?? '—'}</td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    maxLength={200}
                    value={rs.costNotes}
                    onChange={(e) => update(row.productId, 'costNotes', e.target.value)}
                    placeholder="e.g. $0.85/LF material + $0.65/LF fab"
                    className={`${inputClass} font-body`}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={rs.targetMarginPct}
                    onChange={(e) => update(row.productId, 'targetMarginPct', e.target.value)}
                    placeholder="35"
                    className={`${inputClass} text-right`}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={rs.wasteFactor}
                    onChange={(e) => update(row.productId, 'wasteFactor', e.target.value)}
                    placeholder="1.10"
                    className={`${inputClass} text-right`}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={rs.rushSurchargePct}
                    onChange={(e) => update(row.productId, 'rushSurchargePct', e.target.value)}
                    placeholder="25"
                    className={`${inputClass} text-right`}
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
                  {rs.error && <p className="font-body text-xs text-afs-crimson mt-1.5">{rs.error}</p>}
                  {rs.saved && !rs.error && <p className="font-body text-xs text-afs-success mt-1.5">Saved</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
