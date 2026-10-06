import { createAdminClient } from '@/lib/supabase/admin';
import type { AttachmentTakeoffPatch, EmailStore, NewQuoteRequest, StoredAttachment, StoredMessage } from '@/lib/email-intake/store';
import type { EmailAddress, InboundAttachment, InboundEmail } from '@/lib/email-intake/types';

const BUCKET = 'email-attachments';

function safeName(n: string): string {
  return n.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file';
}
const addrJson = (l: EmailAddress[]) => l.map((a) => ({ name: a.name, address: a.address }));

async function nextRequestNumber(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const prefix = `AFS-QR-${new Date().getFullYear()}-`;
  const { data } = await admin.from('quote_requests').select('request_number').like('request_number', `${prefix}%`).order('request_number', { ascending: false }).limit(1);
  const last = data?.[0]?.request_number as string | undefined;
  const lastSeq = last ? parseInt(last.slice(prefix.length), 10) : 0;
  return `${prefix}${String((Number.isFinite(lastSeq) ? lastSeq : 0) + 1).padStart(5, '0')}`;
}

/** Production EmailStore: service-role Supabase client + the private `email-attachments` bucket. Server-only. */
export function createSupabaseEmailStore(admin = createAdminClient()): EmailStore {
  return {
    async insertMessage({ email, dedupeKey }) {
      const row = {
        provider: email.provider,
        provider_message_id: email.providerMessageId,
        internet_message_id: email.internetMessageId,
        conversation_id: email.conversationId,
        in_reply_to: email.inReplyTo,
        dedupe_key: dedupeKey,
        from_address: email.from?.address ?? null,
        from_name: email.from?.name ?? null,
        to_addresses: addrJson(email.to),
        cc_addresses: addrJson(email.cc),
        subject: email.subject,
        sent_at: email.sentAt ? email.sentAt.toISOString() : null,
        html_body: email.htmlBody,
        text_body: email.textBody,
        status: 'received',
      };
      const { data, error } = await admin.from('email_messages').insert(row).select('id').single();
      if (!error && data) return { id: data.id as string, duplicate: false };
      // 23505 = unique_violation on dedupe_key: the same email delivered twice (or two workers racing).
      if (error?.code === '23505') {
        const { data: existing } = await admin.from('email_messages').select('id').eq('dedupe_key', dedupeKey).single();
        if (existing) return { id: existing.id as string, duplicate: true };
      }
      throw new Error(`Could not store email: ${error?.message ?? 'unknown error'}`);
    },

    async saveAttachment(messageId, a: InboundAttachment, sha256): Promise<StoredAttachment> {
      const id = crypto.randomUUID();
      const storagePath = `${BUCKET}/${messageId}/${id}-${safeName(a.filename)}`;
      const up = await admin.storage.from(BUCKET).upload(storagePath, a.content, { contentType: a.contentType, upsert: false });
      if (up.error) throw new Error(`Could not store attachment ${a.filename}: ${up.error.message}`);
      const { error } = await admin.from('email_attachments').insert({
        id,
        email_message_id: messageId,
        filename: a.filename,
        content_type: a.contentType,
        size_bytes: a.content.length,
        storage_path: storagePath,
        sha256,
        is_inline: a.isInline,
      });
      if (error) throw new Error(`Could not record attachment ${a.filename}: ${error.message}`);
      return { id, filename: a.filename, contentType: a.contentType, sizeBytes: a.content.length, storagePath, sha256, isInline: a.isInline };
    },

    async loadMessage(id) {
      const { data: m } = await admin.from('email_messages').select('*').eq('id', id).maybeSingle();
      if (!m) return null;
      const { data: atts } = await admin.from('email_attachments').select('*').eq('email_message_id', id).order('created_at');
      return {
        id: m.id,
        provider: m.provider,
        internetMessageId: m.internet_message_id,
        conversationId: m.conversation_id,
        inReplyTo: m.in_reply_to ?? null,
        from: m.from_address ? { name: m.from_name, address: m.from_address } : null,
        subject: m.subject ?? '',
        textBody: m.text_body,
        htmlBody: m.html_body,
        status: m.status,
        quoteRequestId: m.quote_request_id,
        attachments: (atts ?? []).map((a) => ({
          id: a.id,
          filename: a.filename,
          contentType: a.content_type ?? 'application/octet-stream',
          sizeBytes: Number(a.size_bytes ?? 0),
          storagePath: a.storage_path,
          sha256: a.sha256 ?? '',
          isInline: Boolean(a.is_inline),
        })),
      } satisfies StoredMessage;
    },

    async downloadAttachment(storagePath) {
      const { data, error } = await admin.storage.from(BUCKET).download(storagePath);
      if (error || !data) throw new Error(`Could not read stored attachment: ${error?.message ?? 'missing'}`);
      return Buffer.from(await data.arrayBuffer());
    },

    async updateMessage(id, patch) {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.intent !== undefined) row.intent = patch.intent;
      if (patch.intentConfidence !== undefined) row.intent_confidence = patch.intentConfidence;
      if (patch.intentReason !== undefined) row.intent_reason = patch.intentReason;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.quoteRequestId !== undefined) row.quote_request_id = patch.quoteRequestId;
      if (patch.error !== undefined) row.error = patch.error;
      await admin.from('email_messages').update(row).eq('id', id);
    },

    async updateAttachment(id, p: AttachmentTakeoffPatch) {
      await admin
        .from('email_attachments')
        .update({
          takeoff_status: p.takeoffStatus,
          takeoff_result: p.takeoffResult ?? null,
          takeoff_error: p.takeoffError ?? null,
          ...(p.pageCount !== undefined ? { page_count: p.pageCount } : {}),
        })
        .eq('id', id);
    },

    async findThreadQuoteRequest({ conversationId, inReplyTo, excludeMessageId }) {
      if (conversationId) {
        const { data } = await admin
          .from('email_messages')
          .select('quote_request_id')
          .eq('conversation_id', conversationId)
          .neq('id', excludeMessageId)
          .not('quote_request_id', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1);
        if (data?.[0]?.quote_request_id) return data[0].quote_request_id as string;
      }
      if (inReplyTo) {
        const { data } = await admin.from('email_messages').select('quote_request_id').eq('internet_message_id', inReplyTo).not('quote_request_id', 'is', null).limit(1);
        if (data?.[0]?.quote_request_id) return data[0].quote_request_id as string;
      }
      return null;
    },

    async createQuoteRequest(q: NewQuoteRequest) {
      const requestId = crypto.randomUUID();
      let uploadId: string | null = null;
      if (q.primaryTakeoff) {
        const t = q.primaryTakeoff;
        uploadId = crypto.randomUUID();
        // Same table the Job screen's "What the AI read" and the Pending Approval attachment read. The first path
        // segment is the bucket name (existing readers derive the bucket from it).
        const { error } = await admin.from('takeoff_uploads').insert({
          id: uploadId,
          user_id: null,
          storage_key: t.storagePath,
          file_name: t.fileName,
          file_type: t.fileType,
          file_size_bytes: t.fileSizeBytes,
          status: 'complete',
          result_items: t.items,
          overall_confidence: t.overallConfidence,
          processing_notes: t.processingNotes,
          email_attachment_id: t.emailAttachmentId,
        });
        if (error) uploadId = null; // the job is still created; the source is reachable via View Source
      }
      // Retry on the (unlocked max+1) request-number race: the unique constraint makes the loser retry.
      for (let attempt = 0; attempt < 5; attempt++) {
        const requestNumber = await nextRequestNumber(admin);
        const { error } = await admin.from('quote_requests').insert({
          id: requestId,
          request_number: requestNumber,
          user_id: null,
          guest_email: q.guestEmail,
          project_id: null,
          line_items: q.lineItems,
          jobsite_address: null,
          rush_source: null,
          upload_id: uploadId,
          notes: q.notes,
          client_business_name: q.clientBusinessName,
          client_name: q.clientName,
          po_number: null,
          job_name: q.jobName,
          status: 'submitted',
          source_tool: 'email_inbound',
          job_stage: 'new',
          stage_changed_at: new Date().toISOString(),
          source_email_id: q.sourceEmailId,
          intake_status: q.intakeStatus,
        });
        if (!error) return { id: requestId, requestNumber };
        if (error.code !== '23505') throw new Error(`Could not create quote request: ${error.message}`);
      }
      throw new Error('Could not allocate a request number');
    },
  };
}
