import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/admin/auth';
import { sanitizeEmailHtml } from '@/lib/email-intake/sanitize';
import SourceViewer, { type SvAttachment, type SvCorrection, type SvItem } from '@/components/admin/email-intake/SourceViewer';

export const dynamic = 'force-dynamic';

/**
 * View Source: the original email exactly as received (sanitized) beside the AI takeoff, with click-to-source in
 * both directions and append-only corrections (PHASE4_ADDENDUM §3). Admin only.
 */
export default async function QuoteRequestSourcePage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  await requireAdminUser(supabase);
  const admin = createAdminClient();

  const { data: qr } = await admin
    .from('quote_requests')
    .select('id, request_number, line_items, intake_status, source_email_id, notes')
    .eq('id', params.id)
    .maybeSingle();
  if (!qr || !qr.source_email_id) notFound();

  const [{ data: msg }, { data: atts }, { data: corr }] = await Promise.all([
    admin.from('email_messages').select('*').eq('id', qr.source_email_id).maybeSingle(),
    admin.from('email_attachments').select('id, filename, content_type, size_bytes, takeoff_status, takeoff_error').eq('email_message_id', qr.source_email_id).order('created_at'),
    admin.from('takeoff_corrections').select('id, line_item_id, field, old_value, new_value, created_at, reason').eq('quote_request_id', params.id).order('created_at', { ascending: false }).limit(200),
  ]);
  if (!msg) notFound();

  const attachments: SvAttachment[] = (atts ?? [])
    .filter((a) => !a.filename.match(/^(image\d{3}|outlook-)/i))
    .map((a) => ({ id: a.id, filename: a.filename, contentType: a.content_type ?? '', sizeBytes: Number(a.size_bytes ?? 0), takeoffStatus: a.takeoff_status, takeoffError: a.takeoff_error }));

  const items = ((qr.line_items as SvItem[] | null) ?? []).map((i) => ({ ...i, flags: Array.isArray(i.flags) ? i.flags : [], source_ref: i.source_ref ?? null }));

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/admin/quote-requests/${qr.id}`} className="text-sm text-blue-700 underline">← {qr.request_number}</Link>
          <h1 className="text-2xl font-semibold">View Source</h1>
          <p className="text-sm text-neutral-600">
            {qr.intake_status === 'needs_manual_takeoff'
              ? 'The AI could not read this email. Nothing was dropped: the original is on the left. Enter the items by hand on the quote request.'
              : 'Drafted by AI from this email. Nothing has been sent to the customer. Check highlighted items, correct anything wrong, then send from the quote request.'}
          </p>
        </div>
      </div>
      <SourceViewer
        quoteRequestId={qr.id}
        email={{
          fromName: msg.from_name,
          fromAddress: msg.from_address,
          subject: msg.subject ?? '',
          sentAt: msg.sent_at,
          textBody: msg.text_body,
          safeHtml: msg.html_body ? sanitizeEmailHtml(msg.html_body) : null,
          safeHtmlImages: msg.html_body ? sanitizeEmailHtml(msg.html_body, { loadImages: true }) : null,
        }}
        attachments={attachments}
        initialItems={items}
        corrections={(corr ?? []) as SvCorrection[]}
      />
    </main>
  );
}
