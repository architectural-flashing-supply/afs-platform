import type { RawTakeoffItem } from '@/lib/ai/takeoff-run';
import type { TakeoffConfidence } from '@/lib/ai/takeoff-confidence';
import type { EmailAddress, EmailIntent, EmailProvider, EmailStatus, InboundAttachment, InboundEmail } from '@/lib/email-intake/types';

/**
 * Persistence seam for the intake pipeline. The Supabase implementation is production; the in-memory one
 * (store-memory.ts) lets every pipeline rule be unit-tested with no database, no mailbox and no AI key.
 */

export interface StoredAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  sha256: string;
  isInline: boolean;
}

export interface StoredMessage {
  id: string;
  provider: EmailProvider;
  internetMessageId: string | null;
  conversationId: string | null;
  inReplyTo: string | null;
  from: EmailAddress | null;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  status: EmailStatus;
  quoteRequestId: string | null;
  attachments: StoredAttachment[];
}

export interface AttachmentTakeoffPatch {
  takeoffStatus: 'complete' | 'partial' | 'failed' | 'skipped';
  takeoffResult?: { items: RawTakeoffItem[]; overallConfidence: TakeoffConfidence; processingNotes: string | null } | null;
  takeoffError?: string | null;
  pageCount?: number | null;
}

export interface NewQuoteRequest {
  guestEmail: string;
  clientName: string | null;
  clientBusinessName: string | null;
  jobName: string | null;
  notes: string | null;
  lineItems: Record<string, unknown>[];
  intakeStatus: 'draft_from_email' | 'needs_manual_takeoff';
  sourceEmailId: string;
  /** The attachment whose read is shown in the Job screen's "What the AI read" panel. */
  primaryTakeoff: {
    emailAttachmentId: string;
    storagePath: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    items: RawTakeoffItem[];
    overallConfidence: TakeoffConfidence;
    processingNotes: string | null;
  } | null;
}

export interface EmailStore {
  /** Inserts the message row. Returns duplicate:true (and the existing id) if the dedupe key already exists. */
  insertMessage(m: {
    email: InboundEmail;
    dedupeKey: string;
  }): Promise<{ id: string; duplicate: boolean }>;
  saveAttachment(messageId: string, a: InboundAttachment, sha256: string): Promise<StoredAttachment>;
  loadMessage(id: string): Promise<StoredMessage | null>;
  downloadAttachment(storagePath: string): Promise<Buffer>;
  updateMessage(
    id: string,
    patch: Partial<{
      intent: EmailIntent;
      intentConfidence: number;
      intentReason: string;
      status: EmailStatus;
      quoteRequestId: string | null;
      error: string | null;
    }>,
  ): Promise<void>;
  updateAttachment(id: string, patch: AttachmentTakeoffPatch): Promise<void>;
  /** A job already linked to this conversation / parent message, if any. */
  findThreadQuoteRequest(args: { conversationId: string | null; inReplyTo: string | null; excludeMessageId: string }): Promise<string | null>;
  createQuoteRequest(q: NewQuoteRequest): Promise<{ id: string; requestNumber: string }>;
}
