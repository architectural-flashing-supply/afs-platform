import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Badge from '@/components/ui/Badge';

interface QuoteLineItemRow {
  id: string;
  description: string;
  width_in: number | null;
  height_in: number | null;
  leg_a_in: number | null;
  leg_b_in: number | null;
  length_ft: number;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
}

interface FormalQuoteRow {
  id: string;
  quote_number: string;
  status: string;
  subtotal: number;
  freight: number | null;
  rush_surcharge: number;
  tax: number | null;
  total: number;
  valid_until: string | null;
  estimator_notes: string | null;
  sent_at: string | null;
}

interface QuoteRequestRow {
  id: string;
  request_number: string;
  status: string;
  submitted_at: string;
  line_items: RequestLineItem[] | null;
  jobsite_address: unknown;
  po_number: string | null;
  is_rush: boolean;
  notes: string | null;
}

interface RequestLineItem {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
  unit?: string;
}

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDimensions(
  w: number | null | undefined,
  h: number | null | undefined,
  a: number | null | undefined,
  b: number | null | undefined
): string {
  const parts: string[] = [];
  if (w) parts.push(`W: ${w}"`);
  if (h) parts.push(`H: ${h}"`);
  if (a) parts.push(`Leg A: ${a}"`);
  if (b) parts.push(`Leg B: ${b}"`);
  return parts.length ? parts.join('   ·   ') : '—';
}

export default async function AccountQuoteDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // A formal, AFS-approved quote is only visible via RLS once its status is no
  // longer 'draft' — so a hit here means the customer is cleared to see prices.
  const { data: quote } = await supabase
    .from('quotes')
    .select(
      'id, quote_number, status, subtotal, freight, rush_surcharge, tax, total, valid_until, estimator_notes, sent_at'
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (quote) {
    const formalQuote = quote as FormalQuoteRow;

    const { data: lineItemsRaw } = await supabase
      .from('quote_line_items')
      .select(
        'id, description, width_in, height_in, leg_a_in, leg_b_in, length_ft, quantity, unit, unit_price, line_total'
      )
      .eq('quote_id', formalQuote.id)
      .order('sort_order', { ascending: true });
    const lineItems = (lineItemsRaw ?? []) as QuoteLineItemRow[];

    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <Link href="/account/quotes" className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson">
              ← Back to My Quotes
            </Link>
            <h1 className="font-data text-3xl text-afs-ink-900 mt-2">{formalQuote.quote_number}</h1>
            <p className="font-body text-sm text-afs-ink-700 mt-1">
              {formalQuote.sent_at ? `Sent ${formatDate(formalQuote.sent_at)}` : 'Formal quote from AFS'}
              {formalQuote.valid_until ? ` · Valid until ${formatDate(formalQuote.valid_until)}` : ''}
            </p>
          </div>
          <Badge variant="success" size="md" pulse>
            Quote Ready
          </Badge>
        </div>

        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Description
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Dimensions
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Length
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Qty
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">
                  Unit Price
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-right px-4 py-3">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id} className="border-b border-afs-chrome-dim last:border-b-0">
                  <td className="font-body text-sm text-afs-ink-900 px-4 py-3">{item.description}</td>
                  <td className="font-data text-xs text-afs-ink-700 px-4 py-3">
                    {formatDimensions(item.width_in, item.height_in, item.leg_a_in, item.leg_b_in)}
                  </td>
                  <td className="font-data text-sm text-afs-ink-900 px-4 py-3">
                    {item.length_ft} ft
                  </td>
                  <td className="font-data text-sm text-afs-ink-900 px-4 py-3">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="font-data text-sm text-afs-ink-900 text-right px-4 py-3">
                    {currency.format(item.unit_price)}
                  </td>
                  <td className="font-data text-sm text-afs-ink-900 text-right px-4 py-3">
                    {currency.format(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
            <h2 className="font-heading text-lg text-afs-ink-900 mb-4">Payment Summary</h2>
            <dl className="flex flex-col gap-2 font-body text-sm">
              <div className="flex justify-between">
                <dt className="text-afs-ink-700">Subtotal</dt>
                <dd className="font-data text-afs-ink-900">{currency.format(formalQuote.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-afs-ink-700">Freight</dt>
                <dd className="font-data text-afs-ink-900">
                  {formalQuote.freight != null ? currency.format(formalQuote.freight) : '—'}
                </dd>
              </div>
              {formalQuote.rush_surcharge > 0 && (
                <div className="flex justify-between">
                  <dt className="text-afs-ink-700">Rush Surcharge</dt>
                  <dd className="font-data text-afs-ink-900">{currency.format(formalQuote.rush_surcharge)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-afs-ink-700">Tax</dt>
                <dd className="font-data text-afs-ink-900">
                  {formalQuote.tax != null ? currency.format(formalQuote.tax) : '—'}
                </dd>
              </div>
              <div className="flex justify-between border-t border-afs-chrome-dim pt-2 mt-1">
                <dt className="font-label text-afs-ink-900 font-semibold">Total</dt>
                <dd className="font-data text-lg text-afs-crimson">{currency.format(formalQuote.total)}</dd>
              </div>
            </dl>
          </div>

          {formalQuote.estimator_notes && (
            <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
              <h2 className="font-heading text-lg text-afs-ink-900 mb-4">Notes from Your Estimator</h2>
              <p className="font-body text-sm text-afs-ink-700 whitespace-pre-line">
                {formalQuote.estimator_notes}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Link
            href={`/checkout?quote=${formalQuote.id}`}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors"
          >
            Approve &amp; Pay
          </Link>
        </div>
      </div>
    );
  }

  const { data: requestRaw } = await supabase
    .from('quote_requests')
    .select('id, request_number, status, submitted_at, line_items, jobsite_address, po_number, is_rush, notes')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!requestRaw) notFound();

  const request = requestRaw as QuoteRequestRow;
  const items = request.line_items ?? [];

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <Link href="/account/quotes" className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson">
            ← Back to My Quotes
          </Link>
          <h1 className="font-data text-3xl text-afs-ink-900 mt-2">{request.request_number}</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">
            Submitted {formatDate(request.submitted_at)}
          </p>
        </div>
        <Badge variant="warning" size="md">
          Pending Review
        </Badge>
      </div>

      <div className="bg-[var(--afs-crimson-ghost)] border border-afs-crimson rounded px-6 py-4 mb-8">
        <p className="font-body text-sm text-afs-ink-900">
          Your request has been received. Our estimating team is preparing a formal quote — you&apos;ll
          be notified as soon as it&apos;s ready to review.
        </p>
      </div>

      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-afs-chrome-dim">
          <span className="font-heading text-sm text-afs-ink-700 uppercase tracking-wide">
            Submitted Specification
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Profile
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Material
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Gauge
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Dimensions
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Length
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-afs-chrome-dim last:border-b-0">
                <td className="font-body text-sm text-afs-ink-900 px-4 py-3">{item.profileType}</td>
                <td className="font-body text-sm text-afs-ink-900 px-4 py-3">{item.material ?? '—'}</td>
                <td className="font-data text-sm text-afs-ink-900 px-4 py-3">{item.gauge ?? '—'}</td>
                <td className="font-data text-xs text-afs-ink-700 px-4 py-3">
                  {formatDimensions(item.width, item.height, item.legA, item.legB)}
                </td>
                <td className="font-data text-sm text-afs-ink-900 px-4 py-3">{item.lengthFt} ft</td>
                <td className="font-data text-sm text-afs-ink-900 px-4 py-3">
                  {item.quantity} {item.unit ?? 'LF'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-afs-chrome-dim">
          <span className="font-heading text-sm text-afs-ink-700 uppercase tracking-wide">Project Details</span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-afs-chrome-dim">
              <td className="font-label text-xs uppercase text-afs-ink-700 px-4 py-3 w-40">Jobsite Address</td>
              <td className="font-body text-afs-ink-900 px-4 py-3 whitespace-pre-line">
                {typeof request.jobsite_address === 'string' ? request.jobsite_address : '—'}
              </td>
            </tr>
            <tr className="border-b border-afs-chrome-dim">
              <td className="font-label text-xs uppercase text-afs-ink-700 px-4 py-3">PO Number</td>
              <td className="font-body text-afs-ink-900 px-4 py-3">{request.po_number ?? '—'}</td>
            </tr>
            <tr className="border-b border-afs-chrome-dim">
              <td className="font-label text-xs uppercase text-afs-ink-700 px-4 py-3">Rush</td>
              <td className="px-4 py-3">
                <span
                  className={`font-label text-xs border px-2 py-0.5 rounded ${
                    request.is_rush ? 'text-afs-crimson border-afs-crimson' : 'text-afs-ink-700 border-afs-chrome-dim'
                  }`}
                >
                  {request.is_rush ? 'RUSH REQUESTED' : 'STANDARD'}
                </span>
              </td>
            </tr>
            <tr>
              <td className="font-label text-xs uppercase text-afs-ink-700 px-4 py-3">Notes</td>
              <td className="font-body text-afs-ink-900 px-4 py-3 whitespace-pre-line">
                {request.notes ?? '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
