import { randomUUID } from 'node:crypto';
import type { AttachmentTakeoffPatch, EmailStore, NewQuoteRequest, StoredAttachment, StoredMessage } from '@/lib/email-intake/store';
import type { InboundAttachment, InboundEmail } from '@/lib/email-intake/types';

/** In-memory EmailStore: used by unit tests and by `pnpm email:sim` so the whole pipeline runs with no database. */
export class MemoryEmailStore implements EmailStore {
  messages = new Map<string, StoredMessage & { dedupeKey: string; intent?: string; intentReason?: string; error?: string | null; sentAt?: Date | null }>();
  attachments = new Map<string, StoredAttachment & { messageId: string; bytes: Buffer; patch?: AttachmentTakeoffPatch }>();
  quoteRequests: (NewQuoteRequest & { id: string; requestNumber: string })[] = [];
  private seq = 0;

  async insertMessage({ email, dedupeKey }: { email: InboundEmail; dedupeKey: string }) {
    for (const m of this.messages.values()) if (m.dedupeKey === dedupeKey) return { id: m.id, duplicate: true };
    const id = randomUUID();
    this.messages.set(id, {
      id,
      dedupeKey,
      provider: email.provider,
      internetMessageId: email.internetMessageId,
      conversationId: email.conversationId,
      inReplyTo: email.inReplyTo,
      from: email.from,
      subject: email.subject,
      textBody: email.textBody,
      htmlBody: email.htmlBody,
      status: 'received',
      quoteRequestId: null,
      attachments: [],
    });
    return { id, duplicate: false };
  }

  async saveAttachment(messageId: string, a: InboundAttachment, sha256: string): Promise<StoredAttachment> {
    const id = randomUUID();
    const stored: StoredAttachment = {
      id,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.content.length,
      storagePath: `email-attachments/${messageId}/${id}-${a.filename}`,
      sha256,
      isInline: a.isInline,
    };
    this.attachments.set(id, { ...stored, messageId, bytes: a.content });
    this.messages.get(messageId)?.attachments.push(stored);
    return stored;
  }

  async loadMessage(id: string) {
    return this.messages.get(id) ?? null;
  }

  async downloadAttachment(storagePath: string) {
    for (const a of this.attachments.values()) if (a.storagePath === storagePath) return a.bytes;
    throw new Error('attachment not found');
  }

  async updateMessage(id: string, patch: Parameters<EmailStore['updateMessage']>[1]) {
    const m = this.messages.get(id);
    if (!m) return;
    if (patch.status) m.status = patch.status;
    if (patch.quoteRequestId !== undefined) m.quoteRequestId = patch.quoteRequestId;
    if (patch.intent) m.intent = patch.intent;
    if (patch.intentReason) m.intentReason = patch.intentReason;
    if (patch.error !== undefined) m.error = patch.error;
  }

  async updateAttachment(id: string, patch: AttachmentTakeoffPatch) {
    const a = this.attachments.get(id);
    if (a) a.patch = patch;
  }

  async findThreadQuoteRequest({ conversationId, inReplyTo, excludeMessageId }: { conversationId: string | null; inReplyTo: string | null; excludeMessageId: string }) {
    for (const m of this.messages.values()) {
      if (m.id === excludeMessageId || !m.quoteRequestId || m.status === 'attached_to_thread') continue;
      if ((conversationId && m.conversationId === conversationId) || (inReplyTo && m.internetMessageId === inReplyTo)) return m.quoteRequestId;
    }
    return null;
  }

  async createQuoteRequest(q: NewQuoteRequest) {
    const id = randomUUID();
    const requestNumber = `AFS-QR-TEST-${String(++this.seq).padStart(5, '0')}`;
    this.quoteRequests.push({ ...q, id, requestNumber });
    return { id, requestNumber };
  }
}
