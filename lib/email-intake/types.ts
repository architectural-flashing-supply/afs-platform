/**
 * Inbound order email -> AI takeoff -> draft quote request.
 * Spec: PHASE4_ADDENDUM_EMAIL_TO_ESTIMATE (project docs). The pipeline never sends anything to a customer and
 * never lets the AI set a price; it produces a draft in the Workbench New lane for a human to review.
 */
import type { TakeoffConfidence } from '@/lib/ai/takeoff-confidence';

export type EmailProvider = 'eml_upload' | 'webhook' | 'graph';
export type EmailIntent = 'order_or_rfq' | 'approval' | 'question' | 'other';
export type EmailStatus =
  | 'received'
  | 'ignored'
  | 'processing'
  | 'drafted'
  | 'needs_manual_takeoff'
  | 'attached_to_thread'
  | 'failed';

export interface EmailAddress {
  name: string | null;
  address: string;
}

/** A provider-neutral inbound email. Every source (eml, webhook, Graph) is mapped into this one shape. */
export interface InboundEmail {
  provider: EmailProvider;
  providerMessageId: string | null;
  /** RFC Message-ID header, angle brackets stripped. The primary idempotency key. */
  internetMessageId: string | null;
  conversationId: string | null;
  inReplyTo: string | null;
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  sentAt: Date | null;
  htmlBody: string | null;
  textBody: string | null;
  attachments: InboundAttachment[];
}

export interface InboundAttachment {
  filename: string;
  contentType: string;
  /** Raw bytes. Never base64 inline from Graph: large files come through the $value endpoint. */
  content: Buffer;
  isInline: boolean;
  /** Real size in bytes when `content` is a placeholder (stored messages are classified without loading bytes). */
  size?: number;
}

export interface ClassificationResult {
  intent: EmailIntent;
  confidence: number;
  reason: string;
  /** 'heuristic' when no AI was available or it failed; the result is still a decision, never a silent drop. */
  method: 'ai' | 'heuristic';
}

/** Where a line item was read from. Written for EVERY item; an item without one is flagged "source unknown". */
export interface SourceRef {
  emailMessageId: string;
  /** Attachment-sourced: which file, which page (1-based), and an approximate normalized box (0..1). */
  emailAttachmentId?: string;
  page?: number | null;
  region?: { x: number; y: number; w: number; h: number } | null;
  /** Body-sourced: character range into email_messages.text_body, computed by locating the AI's verbatim quote. */
  bodySpan?: { start: number; end: number } | null;
}

export interface DraftLineItem {
  /** Stable id so corrections can name the item. */
  id: string;
  profileType: string;
  material: string | null;
  gauge: string | null;
  finish: string | null;
  width: number | null;
  height: number | null;
  legA: number | null;
  legB: number | null;
  /** null = the AI could not read it. Blank and flagged, never guessed or defaulted. */
  lengthFt: number | null;
  quantity: number | null;
  unit: string | null;
  confidence: TakeoffConfidence;
  aiNote: string | null;
  /** Extra things a person must confirm (e.g. "quantity equals length"). Rendered as flags in View Source. */
  flags: string[];
  sourceRef: SourceRef | null;
}

export type PipelineOutcome =
  | { status: 'duplicate'; emailMessageId: string }
  | { status: 'ignored'; emailMessageId: string; intent: EmailIntent; reason: string }
  | { status: 'attached_to_thread'; emailMessageId: string; quoteRequestId: string }
  | { status: 'drafted' | 'needs_manual_takeoff'; emailMessageId: string; quoteRequestId: string; itemCount: number }
  | { status: 'failed'; emailMessageId: string | null; error: string };
