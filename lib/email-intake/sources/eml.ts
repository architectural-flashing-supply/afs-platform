import { simpleParser, type AddressObject } from 'mailparser';
import type { EmailAddress, InboundEmail } from '@/lib/email-intake/types';

function addrs(a: AddressObject | AddressObject[] | undefined): EmailAddress[] {
  if (!a) return [];
  const list = Array.isArray(a) ? a : [a];
  const out: EmailAddress[] = [];
  for (const o of list) for (const v of o.value) if (v.address) out.push({ name: v.name || null, address: v.address.toLowerCase() });
  return out;
}

function stripBrackets(id: string | undefined | null): string | null {
  if (!id) return null;
  return id.replace(/^<|>$/g, '').trim() || null;
}

/** RFC 5322 .eml bytes -> the provider-neutral InboundEmail. Used by the admin .eml intake and the generic webhook. */
export async function parseEml(raw: Buffer, provider: InboundEmail['provider'] = 'eml_upload'): Promise<InboundEmail> {
  const p = await simpleParser(raw);
  const refs = Array.isArray(p.references) ? p.references : p.references ? [p.references] : [];
  const inReplyTo = stripBrackets(p.inReplyTo as string | undefined);
  const messageId = stripBrackets(p.messageId);
  // Thread key: the root of the References chain, else the parent, else this message.
  const conversationId = stripBrackets(refs[0]) ?? inReplyTo ?? messageId;
  const from = addrs(p.from)[0] ?? null;
  return {
    provider,
    providerMessageId: null,
    internetMessageId: messageId,
    conversationId,
    inReplyTo,
    from,
    to: addrs(p.to),
    cc: addrs(p.cc),
    subject: p.subject ?? '',
    sentAt: p.date ?? null,
    htmlBody: typeof p.html === 'string' ? p.html : null,
    textBody: p.text ?? null,
    attachments: (p.attachments ?? []).map((a) => ({
      filename: a.filename || 'attachment',
      contentType: a.contentType || 'application/octet-stream',
      content: a.content,
      isInline: a.contentDisposition === 'inline' || Boolean(a.related),
    })),
  };
}
