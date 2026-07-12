'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { computeBilledQuantity, computeLineTotal, round2, DEFAULT_WASTE_FACTOR } from '@/lib/admin/pricing';

export interface EstimatorLineItem {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  finish?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
  unit?: string;
}

interface QuoteEstimatorFormProps {
  requestId: string;
  items: EstimatorLineItem[];
  jobsiteAddress: string | null;
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data text-right';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function describeItem(item: EstimatorLineItem): string {
  const parts = [item.profileType];
  if (item.material) parts.push(item.material);
  if (item.gauge) parts.push(item.gauge);
  return parts.join(' — ');
}

function formatDimensions(item: EstimatorLineItem): string {
  const parts: string[] = [];
  if (item.width) parts.push(`W: ${item.width}"`);
  if (item.height) parts.push(`H: ${item.height}"`);
  if (item.legA) parts.push(`Leg A: ${item.legA}"`);
  if (item.legB) parts.push(`Leg B: ${item.legB}"`);
  return parts.length ? parts.join('   ') : '—';
}

export default function QuoteEstimatorForm({ requestId, items, jobsiteAddress }: QuoteEstimatorFormProps) {
  const router = useRouter();
  const [unitPrices, setUnitPrices] = useState<string[]>(() => items.map(() => ''));
  const [freight, setFreight] = useState('');
  const [estimatorNotes, setEstimatorNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ quoteNumber: string } | null>(null);

  const lineTotals = useMemo(
    () =>
      items.map((item, i) => {
        const price = Number(unitPrices[i]);
        if (!Number.isFinite(price) || price <= 0) return 0;
        return computeLineTotal(price, item.quantity, item.lengthFt);
      }),
    [items, unitPrices]
  );

  const subtotal = useMemo(() => round2(lineTotals.reduce((sum, t) => sum + t, 0)), [lineTotals]);
  const freightAmount = Number(freight);
  const hasValidFreight = freight.trim() !== '' && Number.isFinite(freightAmount) && freightAmount >= 0;
  const total = round2(subtotal + (hasValidFreight ? freightAmount : 0));

  const allPricesValid = items.every((_, i) => {
    const price = Number(unitPrices[i]);
    return Number.isFinite(price) && price > 0;
  });

  function updatePrice(index: number, value: string) {
    setUnitPrices((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  async function handleSend() {
    if (!allPricesValid) {
      setError('Every line item needs a unit price greater than $0.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quote-requests/${requestId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: items.map((item, i) => ({
            profileType: item.profileType,
            material: item.material ?? null,
            gauge: item.gauge ?? null,
            width: item.width ?? null,
            height: item.height ?? null,
            legA: item.legA ?? null,
            legB: item.legB ?? null,
            lengthFt: item.lengthFt,
            quantity: item.quantity,
            unit: item.unit ?? 'LF',
            unitPrice: Number(unitPrices[i]),
          })),
          freight: hasValidFreight ? freightAmount : null,
          estimatorNotes: estimatorNotes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; quoteNumber?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not send this quote. Please try again.');
        setSubmitting(false);
        return;
      }
      setSuccess({ quoteNumber: data.quoteNumber ?? '' });
      router.refresh();
    } catch {
      setError('Could not send this quote. Please try again.');
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-afs-bg-raised border border-afs-success rounded p-8 text-center">
        <h2 className="font-heading text-xl text-afs-chrome-high mb-2">Quote Sent</h2>
        <p className="font-body text-sm text-afs-chrome-mid mb-4">
          {success.quoteNumber} has been delivered to the customer&apos;s account.
        </p>
        <button
          type="button"
          onClick={() => router.push('/admin/quote-requests')}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
        >
          Back to Queue
        </button>
      </div>
    );
  }

  return (
    <div data-testid="estimator-form" className="flex flex-col gap-6">
      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-afs-border flex items-center justify-between">
          <span className="font-heading text-sm text-afs-chrome-mid uppercase tracking-wide">Enter Pricing</span>
          <span className="font-body text-xs text-afs-chrome-dim">
            Waste factor: {Math.round((DEFAULT_WASTE_FACTOR - 1) * 100)}% (standard AFS allowance)
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Item
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Dimensions
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                Ordered
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                Billed (w/ waste)
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3 w-36">
                Unit Price ($/LF)
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const orderedLf = round2(item.quantity * item.lengthFt);
              const billedLf = computeBilledQuantity(item.quantity, item.lengthFt);
              return (
                <tr key={i} className="border-b border-afs-border last:border-b-0">
                  <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{describeItem(item)}</td>
                  <td className="font-data text-xs text-afs-chrome-mid px-4 py-3">{formatDimensions(item)}</td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                    {item.quantity} pc &middot; {orderedLf} LF
                  </td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">{billedLf} LF</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrices[i]}
                      onChange={(e) => updatePrice(i, e.target.value)}
                      placeholder="0.00"
                      data-testid={`unit-price-${i}`}
                      className={inputClass}
                    />
                  </td>
                  <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">
                    {lineTotals[i] > 0 ? currency.format(lineTotals[i]) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h3 className="font-heading text-lg text-afs-chrome-high mb-4">Freight</h3>
          <div className="mb-4">
            <span className={labelClass}>Destination</span>
            <p className="font-body text-sm text-afs-chrome-high whitespace-pre-line">
              {jobsiteAddress || '—'}
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="freight-amount">
              Freight Amount ($)
            </label>
            <input
              id="freight-amount"
              type="number"
              min="0"
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
              placeholder="0.00"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-data"
            />
          </div>
        </div>

        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h3 className="font-heading text-lg text-afs-chrome-high mb-4">Estimator Notes</h3>
          <textarea
            value={estimatorNotes}
            onChange={(e) => setEstimatorNotes(e.target.value)}
            rows={4}
            placeholder="Notes the customer will see on their formal quote (lead times, substitutions, etc.)"
            className="w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body resize-y"
          />
        </div>
      </div>

      <div className="bg-afs-bg-raised border border-afs-border rounded p-6 flex items-center justify-between">
        <dl className="flex items-center gap-8 font-body text-sm">
          <div>
            <dt className="text-afs-chrome-mid">Subtotal</dt>
            <dd className="font-data text-lg text-afs-chrome-high">{currency.format(subtotal)}</dd>
          </div>
          <div>
            <dt className="text-afs-chrome-mid">Freight</dt>
            <dd className="font-data text-lg text-afs-chrome-high">
              {hasValidFreight ? currency.format(freightAmount) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-afs-chrome-mid">Total</dt>
            <dd className="font-data text-xl text-afs-crimson">{currency.format(total)}</dd>
          </div>
        </dl>
        <div className="flex flex-col items-end gap-2">
          {error && <p className="font-body text-xs text-afs-crimson">{error}</p>}
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting || !allPricesValid}
            data-testid="send-quote-button"
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Send Quote to Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
