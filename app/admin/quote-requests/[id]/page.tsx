import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdminUser } from '@/lib/admin/auth';
import Badge from '@/components/ui/Badge';
import QuoteEstimatorForm, { type EstimatorLineItem } from '@/components/admin/QuoteEstimatorForm';

interface QuoteRequestDetailRow {
  id: string;
  request_number: string;
  status: string;
  submitted_at: string;
  line_items: EstimatorLineItem[] | null;
  jobsite_address: unknown;
  po_number: string | null;
  is_rush: boolean;
  notes: string | null;
  user_id: string | null;
  guest_email: string | null;
  quote_id: string | null;
  profiles: { full_name: string; company: string | null; phone: string | null; email: string } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDimensions(item: EstimatorLineItem): string {
  const parts: string[] = [];
  if (item.width) parts.push(`W: ${item.width}"`);
  if (item.height) parts.push(`H: ${item.height}"`);
  if (item.legA) parts.push(`Leg A: ${item.legA}"`);
  if (item.legB) parts.push(`Leg B: ${item.legB}"`);
  return parts.length ? parts.join('   ') : '—';
}

export default async function AdminQuoteRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);

  const { data: requestRaw } = await supabase
    .from('quote_requests')
    .select(
      'id, request_number, status, submitted_at, line_items, jobsite_address, po_number, is_rush, notes, user_id, guest_email, quote_id, profiles(full_name, company, phone, email)'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!requestRaw) notFound();
  let request = requestRaw as unknown as QuoteRequestDetailRow;

  // Mirrors the estimator workflow in ARCHITECTURE.md section 6: opening a
  // submitted request in the admin portal moves it into active review.
  if (request.status === 'submitted') {
    await supabase
      .from('quote_requests')
      .update({ status: 'reviewing', reviewed_at: new Date().toISOString() })
      .eq('id', request.id);
    request = { ...request, status: 'reviewing' };
  }

  let linkedQuoteNumber: string | null = null;
  if (request.status === 'quoted' && request.quote_id) {
    const { data: linkedQuote } = await supabase
      .from('quotes')
      .select('quote_number')
      .eq('id', request.quote_id)
      .maybeSingle();
    linkedQuoteNumber = (linkedQuote?.quote_number as string | undefined) ?? null;
  }

  const items = request.line_items ?? [];
  const customerName = request.profiles?.company || request.profiles?.full_name || request.guest_email || 'Guest';
  const jobsiteAddress = typeof request.jobsite_address === 'string' ? request.jobsite_address : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <Link href="/admin/quote-requests" className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson">
            ← Back to Quote Requests
          </Link>
          <h1 className="font-data text-3xl text-afs-ink-900 mt-2">{request.request_number}</h1>
          <p className="font-body text-sm text-afs-ink-700 mt-1">Submitted {formatDate(request.submitted_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {request.is_rush && (
            <span className="bg-afs-crimson text-white font-label text-xs font-bold px-2 py-1 rounded">RUSH</span>
          )}
          <Badge
            variant={request.status === 'quoted' ? 'success' : request.status === 'reviewing' ? 'info' : 'warning'}
            size="md"
          >
            {request.status === 'quoted' ? 'Quoted' : request.status === 'reviewing' ? 'Reviewing' : 'Submitted'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-ink-900 mb-3">Customer</h2>
          <dl className="flex flex-col gap-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-ink-700">Name</dt>
              <dd className="text-afs-ink-900">{customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-ink-700">Email</dt>
              <dd className="text-afs-ink-900">{request.profiles?.email ?? request.guest_email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-ink-700">Phone</dt>
              <dd className="text-afs-ink-900">{request.profiles?.phone ?? '—'}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-ink-900 mb-3">Project Details</h2>
          <dl className="flex flex-col gap-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-ink-700">Jobsite Address</dt>
              <dd className="text-afs-ink-900 text-right">{jobsiteAddress ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-ink-700">PO Number</dt>
              <dd className="text-afs-ink-900">{request.po_number ?? '—'}</dd>
            </div>
            {request.notes && (
              <div className="flex flex-col gap-1 pt-1 border-t border-afs-border mt-1">
                <dt className="text-afs-ink-700">Customer Notes</dt>
                <dd className="text-afs-ink-900 whitespace-pre-line">{request.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-afs-border">
          <span className="font-heading text-sm text-afs-ink-700 uppercase tracking-wide">
            Submitted Specification
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Profile
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                Material / Gauge
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
              <tr key={idx} className="border-b border-afs-border last:border-b-0">
                <td className="font-body text-sm text-afs-ink-900 px-4 py-3">{item.profileType}</td>
                <td className="font-body text-sm text-afs-ink-900 px-4 py-3">
                  {[item.material, item.gauge].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="font-data text-xs text-afs-ink-700 px-4 py-3">{formatDimensions(item)}</td>
                <td className="font-data text-sm text-afs-ink-900 px-4 py-3">{item.lengthFt} ft</td>
                <td className="font-data text-sm text-afs-ink-900 px-4 py-3">
                  {item.quantity} {item.unit ?? 'LF'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {request.status === 'quoted' ? (
        <div className="bg-[var(--afs-crimson-ghost)] border border-afs-success rounded px-6 py-4">
          <p className="font-body text-sm text-afs-ink-900">
            This request has already been quoted{linkedQuoteNumber ? ` as ${linkedQuoteNumber}` : ''}.
          </p>
        </div>
      ) : request.status === 'cancelled' || request.status === 'expired' ? (
        <div className="bg-afs-bg-surface border border-afs-border rounded px-6 py-4">
          <p className="font-body text-sm text-afs-ink-700">
            This request is {request.status} and can no longer be quoted.
          </p>
        </div>
      ) : !request.user_id ? (
        <div className="bg-afs-bg-surface border border-afs-border rounded px-6 py-4">
          <p className="font-body text-sm text-afs-ink-700">
            This was submitted as a guest ({request.guest_email}). The customer needs an AFS account before a formal
            quote can be delivered to a portal.
          </p>
        </div>
      ) : (
        <QuoteEstimatorForm requestId={request.id} items={items} jobsiteAddress={jobsiteAddress} />
      )}
    </div>
  );
}
