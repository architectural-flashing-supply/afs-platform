import { createHash, randomUUID } from 'node:crypto';
import { runTakeoff, type RawTakeoffItem, type TakeoffModel } from '@/lib/ai/takeoff-run';
import type { TakeoffConfidence } from '@/lib/ai/takeoff-confidence';
import { classifyEmail, isLikelyDecoration, isTakeoffCandidate, stripTags, type IntentClassifier } from '@/lib/email-intake/classify';
import { buildDraftItems, toQuoteRequestLineItem } from '@/lib/email-intake/line-items';
import type { EmailStore, StoredAttachment, StoredMessage } from '@/lib/email-intake/store';
import type { DraftLineItem, InboundEmail, PipelineOutcome } from '@/lib/email-intake/types';

/**
 * Inbound email -> draft quote request.
 *
 * Two phases so a webhook can answer in milliseconds:
 *   1. ingestEmail()   stores the message and every attachment, idempotently. Cheap, no AI.
 *   2. processMessage() classifies, runs the existing takeoff, drafts the quote request. Re-runnable (retry).
 *
 * Invariants (tested): the same email never creates two jobs; nothing that arrives is dropped (a failed or empty
 * takeoff still creates a `needs_manual_takeoff` job); the AI never sets a price; a blank stays blank.
 */

export interface PipelineDeps {
  store: EmailStore;
  model: TakeoffModel;
  classifier?: IntentClassifier | null;
  newId?: () => string;
}

export function dedupeKeyFor(email: InboundEmail): string {
  if (email.internetMessageId) return `mid:${email.internetMessageId.toLowerCase()}`;
  const h = createHash('sha256');
  h.update(`${email.from?.address ?? ''}|${email.sentAt?.toISOString() ?? ''}|${email.subject}|${email.textBody ?? email.htmlBody ?? ''}`);
  for (const a of email.attachments) h.update(createHash('sha256').update(a.content).digest());
  return `sha:${h.digest('hex')}`;
}

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export async function ingestEmail(email: InboundEmail, store: EmailStore): Promise<{ id: string; duplicate: boolean }> {
  const { id, duplicate } = await store.insertMessage({ email, dedupeKey: dedupeKeyFor(email) });
  if (duplicate) return { id, duplicate: true };
  for (const a of email.attachments) await store.saveAttachment(id, a, sha256(a.content));
  return { id, duplicate: false };
}

const MAX_ATTACHMENTS_TO_READ = 12;
const MEDIA: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

function mediaTypeFor(filename: string, contentType: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (MEDIA[ext]) return MEDIA[ext];
  return Object.values(MEDIA).includes(contentType.toLowerCase()) ? contentType.toLowerCase() : null;
}

function worstConfidence(list: TakeoffConfidence[]): TakeoffConfidence {
  if (list.includes('low')) return 'low';
  if (list.includes('medium')) return 'medium';
  return list.length ? 'high' : 'low';
}

interface AttachmentRead {
  att: StoredAttachment;
  status: 'complete' | 'partial' | 'failed' | 'skipped';
  items: RawTakeoffItem[];
  draft: DraftLineItem[];
  confidence: TakeoffConfidence;
  notes: string | null;
  error?: string;
}

export async function processMessage(messageId: string, deps: PipelineDeps, opts: { forceOrder?: boolean } = {}): Promise<PipelineOutcome> {
  const { store, model } = deps;
  const newId = deps.newId ?? randomUUID;
  const msg = await store.loadMessage(messageId);
  if (!msg) return { status: 'failed', emailMessageId: null, error: 'Message not found' };
  // Idempotent: a message that already produced a job is never processed again.
  if (msg.quoteRequestId && (msg.status === 'drafted' || msg.status === 'needs_manual_takeoff' || msg.status === 'attached_to_thread')) {
    return { status: msg.status === 'attached_to_thread' ? 'attached_to_thread' : (msg.status as 'drafted' | 'needs_manual_takeoff'), emailMessageId: msg.id, quoteRequestId: msg.quoteRequestId, itemCount: 0 } as PipelineOutcome;
  }
  try {
    await store.updateMessage(msg.id, { status: 'processing', error: null });

    const asEmail = toInboundShell(msg);
    const verdict = opts.forceOrder
      ? { intent: 'order_or_rfq' as const, confidence: 1, reason: 'Marked as an order by an admin', method: 'heuristic' as const }
      : await classifyEmail(asEmail, deps.classifier);
    await store.updateMessage(msg.id, { intent: verdict.intent, intentConfidence: verdict.confidence, intentReason: verdict.reason });

    // A reply in an existing thread attaches to that job instead of creating a new one.
    const threadQr = await store.findThreadQuoteRequest({ conversationId: msg.conversationId, inReplyTo: msg.inReplyTo, excludeMessageId: msg.id });
    // Anything in a known job's thread belongs to that job, except clearly automated mail (bounces, auto-replies).
    const clearlyAutomated = verdict.intent === 'other' && verdict.confidence >= 0.8;
    if (threadQr && !clearlyAutomated) {
      await store.updateMessage(msg.id, { status: 'attached_to_thread', quoteRequestId: threadQr });
      return { status: 'attached_to_thread', emailMessageId: msg.id, quoteRequestId: threadQr };
    }
    if (verdict.intent !== 'order_or_rfq') {
      await store.updateMessage(msg.id, { status: 'ignored' });
      return { status: 'ignored', emailMessageId: msg.id, intent: verdict.intent, reason: verdict.reason };
    }

    // ---- takeoff on each drawing / photo attachment ----
    const reads: AttachmentRead[] = [];
    const candidates = msg.attachments.filter(
      (a) => !isLikelyDecoration({ filename: a.filename, contentType: a.contentType, isInline: a.isInline, size: a.sizeBytes }),
    );
    for (const att of candidates.slice(0, MAX_ATTACHMENTS_TO_READ)) {
      if (!isTakeoffCandidate(att.filename, att.contentType)) {
        const note = `${att.filename}: this file type cannot be read by the AI yet - needs a manual look.`;
        await store.updateAttachment(att.id, { takeoffStatus: 'skipped', takeoffError: note });
        reads.push({ att, status: 'skipped', items: [], draft: [], confidence: 'low', notes: null, error: note });
        continue;
      }
      const mediaType = mediaTypeFor(att.filename, att.contentType)!;
      const buffer = await store.downloadAttachment(att.storagePath);
      const run = await runTakeoff({ kind: 'file', buffer, mediaType, filename: att.filename }, model, { email: true });
      if (!run.ok) {
        await store.updateAttachment(att.id, { takeoffStatus: 'failed', takeoffError: run.error ?? 'Takeoff failed' });
        reads.push({ att, status: 'failed', items: [], draft: [], confidence: 'low', notes: null, error: `${att.filename}: ${run.error ?? 'takeoff failed'}` });
        continue;
      }
      const draft = buildDraftItems(run.items, { kind: 'attachment', emailMessageId: msg.id, emailAttachmentId: att.id }, newId);
      const status = draft.length > 0 ? 'complete' : 'partial';
      await store.updateAttachment(att.id, {
        takeoffStatus: status,
        takeoffResult: { items: run.items, overallConfidence: run.overallConfidence, processingNotes: run.processingNotes },
      });
      reads.push({ att, status, items: run.items, draft, confidence: run.overallConfidence, notes: run.processingNotes });
    }

    // ---- takeoff on typed body text (an order written only in the email) ----
    const bodyText = (msg.textBody ?? (msg.htmlBody ? stripTags(msg.htmlBody) : '')).trim();
    let bodyDraft: DraftLineItem[] = [];
    let bodyNotes: string | null = null;
    let bodyConfidence: TakeoffConfidence = 'low';
    let bodyError: string | undefined;
    const attachmentItemCount = reads.reduce((n, r) => n + r.draft.length, 0);
    if (attachmentItemCount === 0 && bodyText.length >= 20) {
      const run = await runTakeoff({ kind: 'text', text: bodyText.slice(0, 20_000) }, model, { email: true });
      if (run.ok) {
        bodyDraft = buildDraftItems(run.items, { kind: 'body', emailMessageId: msg.id, textBody: msg.textBody ?? bodyText }, newId);
        bodyNotes = run.processingNotes;
        bodyConfidence = run.overallConfidence;
      } else {
        bodyError = `Email text: ${run.error ?? 'takeoff failed'}`;
      }
    }

    const allDraft = [...reads.flatMap((r) => r.draft), ...bodyDraft];
    const failures = [...reads.filter((r) => r.error).map((r) => r.error as string), ...(bodyError ? [bodyError] : [])];
    const notes = [
      `Drafted from email: "${msg.subject}"`,
      ...failures.map((f) => `NOT READ - ${f}`),
      ...reads.filter((r) => r.notes).map((r) => `${r.att.filename}: ${r.notes}`),
      ...(bodyNotes ? [`Email text: ${bodyNotes}`] : []),
    ].join('\n');

    // Primary takeoff = the attachment that yielded the most items (shown in the Job screen's "What the AI read").
    const primary = [...reads].filter((r) => r.draft.length > 0).sort((a, b) => b.draft.length - a.draft.length)[0] ?? null;
    const senderAddr = msg.from?.address ?? 'unknown-sender@email-intake.invalid';
    const intakeStatus = allDraft.length > 0 ? ('draft_from_email' as const) : ('needs_manual_takeoff' as const);

    const qr = await store.createQuoteRequest({
      guestEmail: senderAddr,
      clientName: msg.from?.name ?? null,
      clientBusinessName: null,
      jobName: msg.subject ? msg.subject.slice(0, 120) : null,
      notes,
      lineItems: allDraft.map(toQuoteRequestLineItem),
      intakeStatus,
      sourceEmailId: msg.id,
      primaryTakeoff: primary
        ? {
            emailAttachmentId: primary.att.id,
            storagePath: primary.att.storagePath,
            fileName: primary.att.filename,
            fileType: '.' + (primary.att.filename.split('.').pop()?.toLowerCase() ?? 'pdf'),
            fileSizeBytes: primary.att.sizeBytes,
            items: primary.items,
            overallConfidence: worstConfidence([primary.confidence, ...primary.draft.map((d) => d.confidence)]),
            processingNotes: primary.notes,
          }
        : null,
    });
    void bodyConfidence;
    await store.updateMessage(msg.id, { status: intakeStatus === 'draft_from_email' ? 'drafted' : 'needs_manual_takeoff', quoteRequestId: qr.id });
    return { status: intakeStatus === 'draft_from_email' ? 'drafted' : 'needs_manual_takeoff', emailMessageId: msg.id, quoteRequestId: qr.id, itemCount: allDraft.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Processing failed';
    await store.updateMessage(msg.id, { status: 'failed', error }).catch(() => undefined);
    return { status: 'failed', emailMessageId: msg.id, error };
  }
}

/** Convenience: store + process in one call (used by the admin .eml intake and the generic webhook). */
export async function receiveEmail(email: InboundEmail, deps: PipelineDeps): Promise<PipelineOutcome> {
  const stored = await ingestEmail(email, deps.store);
  if (stored.duplicate) return { status: 'duplicate', emailMessageId: stored.id };
  return processMessage(stored.id, deps);
}

function toInboundShell(m: StoredMessage): InboundEmail {
  return {
    provider: m.provider,
    providerMessageId: null,
    internetMessageId: m.internetMessageId,
    conversationId: m.conversationId,
    inReplyTo: m.inReplyTo,
    from: m.from,
    to: [],
    cc: [],
    subject: m.subject,
    sentAt: null,
    htmlBody: m.htmlBody,
    textBody: m.textBody,
    attachments: m.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      // Classification only needs names, types and sizes; bytes are fetched lazily by the takeoff step.
      content: Buffer.alloc(0),
      size: a.sizeBytes,
      isInline: a.isInline,
    })),
  };
}
