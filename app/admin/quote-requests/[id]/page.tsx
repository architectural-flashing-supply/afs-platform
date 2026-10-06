import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/admin/auth';
import Badge from '@/components/ui/Badge';
import ColorSwatchChip from '@/components/quote/ColorSwatchChip';
import QuoteEstimatorForm, { type EstimatorLineItem } from '@/components/admin/QuoteEstimatorForm';
import JobIdentityEditorForm from '@/components/admin/JobIdentityEditorForm';
import QuoteRequestAttachmentCard from '@/components/admin/QuoteRequestAttachmentCard';
import { estimateShipmentWeight, type WeightReferenceGauge } from '@/lib/admin/pricing';
import { sourceToolLabel } from '@/lib/data/quote-request-source-tool';

const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 900; // 15 minutes — matches lib/data/orders.ts getOrderAttachments

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
  // McElroy/PAC-CLAD color name selected by the customer when their
  // material required one (afs-cv-002). Null for bare/mill-finish materials
  // and for requests submitted before this column existed.
  color: string | null;
  // Required Anodized/Painted choice for an 'aluminum' category request
  // (afs-jf-002, supersedes afs-cv-002's "aluminum always means PAC-CLAD"
  // ruling). Null for every other material category and for requests
  // submitted before this column existed.
  finish: string | null;
  // Job-identity intake fields (migration 018, afs-jf-000) — optional on
  // every submission surface (afs-jf-003), editable here before approval
  // via JobIdentityEditorForm below.
  client_business_name: string | null;
  client_name: string | null;
  requested_by: string | null;
  user_id: string | null;
  guest_email: string | null;
  quote_id: string | null;
  source_tool: string | null;
  // Links to takeoff_uploads for either flow that can attach a file to a
  // quote request — the Blueprint Takeoff drawing upload and the
  // field_photo_quote jobsite photo (afs-fl-008). Null for requests
  // submitted without an attachment.
  upload_id: string | null;
  // Set when the request was drafted by AI from an inbound email (migration 050).
  source_email_id: string | null;
  intake_status: 'draft_from_email' | 'needs_manual_takeoff' | null;
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
      'id, request_number, status, submitted_at, line_items, jobsite_address, po_number, is_rush, notes, color, finish, client_business_name, client_name, requested_by, user_id, guest_email, quote_id, source_tool, upload_id, source_email_id, intake_status, profiles(full_name, company, phone, email)'
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

  // Attachment (afs-fl-008) — the Blueprint Takeoff and field_photo_quote
  // flows both write an upload_id into quote_requests, but this detail view
  // never surfaced it. storage_key's first path segment is always the
  // bucket name by convention (e.g. 'blueprints/...' in app/api/upload/route.ts,
  // 'documents/field-photos/...' in app/api/field/photo-upload/route.ts), so
  // the bucket can be derived rather than needing its own column. Uses the
  // service-role admin client for the signed URL, same as
  // getOrderAttachments (lib/data/orders.ts) and getGbpPhotos
  // (lib/data/command-center-crm.ts) — full original resolution, no
  // downscaled thumbnail is generated.
  let attachment: { fileName: string; fileType: string; signedUrl: string | null } | null = null;
  if (request.upload_id) {
    const { data: uploadRow } = await supabase
      .from('takeoff_uploads')
      .select('storage_key, file_name, file_type')
      .eq('id', request.upload_id)
      .maybeSingle();

    if (uploadRow) {
      const bucket = uploadRow.storage_key.split('/')[0];
      const admin = createAdminClient();
      const { data: signed } = await admin.storage
        .from(bucket)
        .createSignedUrl(uploadRow.storage_key, ATTACHMENT_SIGNED_URL_TTL_SECONDS);
      attachment = {
        fileName: uploadRow.file_name,
        fileType: uploadRow.file_type,
        signedUrl: signed?.signedUrl ?? null,
      };
    }
  }

  const items = request.line_items ?? [];
  const customerName = request.profiles?.company || request.profiles?.full_name || request.guest_email || 'Guest';
  const jobsiteAddress = typeof request.jobsite_address === 'string' ? request.jobsite_address : null;

  const { data: gaugeRows } = await supabase
    .from('gauges')
    .select('label, weight_lbs_sqft, materials(name)')
    .eq('is_active', true);

  const weightReference: WeightReferenceGauge[] = (gaugeRows ?? [])
    .filter(
      (row): row is { label: string; weight_lbs_sqft: number; materials: { name: string }[] } =>
        row.weight_lbs_sqft != null && row.materials != null && row.materials[0] != null
    )
    .map((row) => ({
      materialName: row.materials[0].name,
      gaugeLabel: row.label,
      weightLbsPerSqft: row.weight_lbs_sqft,
    }));

  const weightEstimate = estimateShipmentWeight(items, weightReference);
  // AI-drafted items whose length or piece count could not be read stay blank (never guessed); count them for the banner.
  const needsInput = (request.line_items ?? []).filter((i) => !(Number(i.lengthFt) > 0) || !(Number(i.quantity) > 0)).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <Link href="/admin/quote-requests" className="font-label text-xs text-afs-chrome-mid hover:text-afs-crimson">
            ← Back to Quote Requests
          </Link>
          <h1 className="font-data text-3xl text-afs-chrome-high mt-2">{request.request_number}</h1>
          <p className="font-body text-sm text-afs-chrome-mid mt-1">Submitted {formatDate(request.submitted_at)}</p>
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
          <Badge variant="chrome" size="md">
            {sourceToolLabel(request.source_tool)}
          </Badge>
        </div>
      </div>

      {request.source_email_id && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded border border-afs-border bg-afs-bg-raised p-4" data-testid="email-draft-banner">
          <p className="font-body text-sm text-afs-chrome-high">
            {request.intake_status === 'needs_manual_takeoff'
              ? 'This job came from an email the AI could not read. Nothing was dropped - open the source and enter the items by hand.'
              : `Drafted by AI from an email. ${needsInput} item${needsInput === 1 ? '' : 's'} still need a length or piece count before this can be priced. Nothing has been sent to the customer.`}
          </p>
          <Link href={`/admin/quote-requests/${request.id}/source`} className="rounded bg-afs-crimson px-4 py-2 font-label text-sm text-white">
            View Source
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Customer</h2>
          <dl className="flex flex-col gap-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Name</dt>
              <dd className="text-afs-chrome-high">{customerName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Email</dt>
              <dd className="text-afs-chrome-high">{request.profiles?.email ?? request.guest_email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Phone</dt>
              <dd className="text-afs-chrome-high">{request.profiles?.phone ?? '—'}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
          <h2 className="font-heading text-lg text-afs-chrome-high mb-3">Project Details</h2>
          <dl className="flex flex-col gap-1.5 font-body text-sm">
            <div className="flex justify-between">
              <dt className="text-afs-chrome-mid">Jobsite Address</dt>
              <dd className="text-afs-chrome-high text-right">{jobsiteAddress ?? '—'}</dd>
            </div>
            {request.finish && (
              <div className="flex justify-between items-center">
                <dt className="text-afs-chrome-mid">Finish</dt>
                <dd className="text-afs-chrome-high text-right">
                  <Badge variant="chrome">{request.finish}</Badge>
                </dd>
              </div>
            )}
            {request.color && (
              <div className="flex justify-between items-center">
                <dt className="text-afs-chrome-mid">Color</dt>
                <dd className="text-afs-chrome-high text-right">
                  <ColorSwatchChip color={request.color} />
                </dd>
              </div>
            )}
            {request.notes && (
              <div className="flex flex-col gap-1 pt-1 border-t border-afs-border mt-1">
                <dt className="text-afs-chrome-mid">Customer Notes</dt>
                <dd className="text-afs-chrome-high whitespace-pre-line">{request.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {attachment && (
        <div className="mb-6">
          <QuoteRequestAttachmentCard
            fileName={attachment.fileName}
            fileType={attachment.fileType}
            signedUrl={attachment.signedUrl}
          />
        </div>
      )}

      {/* Job-identity intake fields (migration 018, afs-jf-000) — view and
          edit before approval (afs-jf-003). Replaces the prior static
          read-only "PO Number" row in the Project Details panel above,
          which this editable form now owns instead. */}
      <div className="mb-6">
        <JobIdentityEditorForm
          requestId={request.id}
          initial={{
            clientBusinessName: request.client_business_name,
            clientName: request.client_name,
            poNumber: request.po_number,
            requestedBy: request.requested_by,
          }}
        />
      </div>

      <div className="bg-afs-bg-raised border border-afs-border rounded overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-afs-border">
          <span className="font-heading text-sm text-afs-chrome-mid uppercase tracking-wide">
            Submitted Specification
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-afs-bg-surface border-b border-afs-border">
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Profile
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Material / Gauge
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Dimensions
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Length
              </th>
              <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-afs-border last:border-b-0">
                <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{item.profileType}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm text-afs-chrome-high">
                      {[item.material, item.gauge].filter(Boolean).join(', ') || '—'}
                    </span>
                    {request.finish && <Badge variant="chrome">{request.finish}</Badge>}
                    {request.color && <ColorSwatchChip color={request.color} />}
                  </div>
                </td>
                <td className="font-data text-xs text-afs-chrome-mid px-4 py-3">{formatDimensions(item)}</td>
                <td className="font-data text-sm text-afs-chrome-high px-4 py-3">{item.lengthFt} ft</td>
                <td className="font-data text-sm text-afs-chrome-high px-4 py-3">
                  {item.quantity} {item.unit ?? 'LF'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {request.status === 'quoted' ? (
        <div className="bg-[var(--afs-crimson-ghost)] border border-afs-success rounded px-6 py-4">
          <p className="font-body text-sm text-afs-chrome-high">
            This request has already been quoted{linkedQuoteNumber ? ` as ${linkedQuoteNumber}` : ''}.
          </p>
        </div>
      ) : request.status === 'cancelled' || request.status === 'expired' ? (
        <div className="bg-afs-bg-surface border border-afs-border rounded px-6 py-4">
          <p className="font-body text-sm text-afs-chrome-mid">
            This request is {request.status} and can no longer be quoted.
          </p>
        </div>
      ) : !request.user_id ? (
        <div className="bg-afs-bg-surface border border-afs-border rounded px-6 py-4">
          <p className="font-body text-sm text-afs-chrome-mid">
            This was submitted as a guest ({request.guest_email}). The customer needs an AFS account before a formal
            quote can be delivered to a portal.
          </p>
        </div>
      ) : (
        <QuoteEstimatorForm
          requestId={request.id}
          items={items}
          jobsiteAddress={jobsiteAddress}
          weightEstimate={weightEstimate}
        />
      )}
    </div>
  );
}
