import type { EmailAddress, InboundAttachment, InboundEmail } from '@/lib/email-intake/types';

/**
 * Microsoft Graph (Outlook) source. DORMANT until the Entra app registration + admin consent exist
 * (PHASE 4 spec §2.4). Everything here is real logic; only the credentials are missing, so "turning Outlook on"
 * is: set the env vars below, then POST a Graph subscription pointing at /api/outlook/webhook.
 *
 * Env: OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_MAILBOX (Steve's address),
 *      OUTLOOK_WEBHOOK_CLIENT_STATE (random string; Graph echoes it on every notification and we verify it).
 */

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
  clientState: string;
}

export function readGraphConfig(env: NodeJS.ProcessEnv = process.env): GraphConfig | null {
  const c = {
    tenantId: env.OUTLOOK_TENANT_ID,
    clientId: env.OUTLOOK_CLIENT_ID,
    clientSecret: env.OUTLOOK_CLIENT_SECRET,
    mailbox: env.OUTLOOK_MAILBOX,
    clientState: env.OUTLOOK_WEBHOOK_CLIENT_STATE,
  };
  if (!c.tenantId || !c.clientId || !c.clientSecret || !c.mailbox || !c.clientState) return null;
  return c as GraphConfig;
}

export interface GraphAddress { emailAddress?: { name?: string; address?: string } }
export interface GraphMessage {
  id: string;
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  from?: GraphAddress;
  toRecipients?: GraphAddress[];
  ccRecipients?: GraphAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  body?: { contentType?: string; content?: string };
  hasAttachments?: boolean;
  internetMessageHeaders?: { name: string; value: string }[];
}
export interface GraphAttachmentMeta {
  id: string;
  name: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
  '@odata.type'?: string;
}

function mapAddr(a: GraphAddress | undefined): EmailAddress | null {
  const e = a?.emailAddress;
  return e?.address ? { name: e.name || null, address: e.address.toLowerCase() } : null;
}
function mapAddrs(l: GraphAddress[] | undefined): EmailAddress[] {
  return (l ?? []).map(mapAddr).filter((x): x is EmailAddress => x !== null);
}

/** Pure mapping, fully unit-tested: a Graph message + its downloaded attachments -> InboundEmail. */
export function mapGraphMessage(msg: GraphMessage, attachments: InboundAttachment[]): InboundEmail {
  const isHtml = (msg.body?.contentType ?? '').toLowerCase() === 'html';
  const inReplyTo = msg.internetMessageHeaders?.find((h) => h.name.toLowerCase() === 'in-reply-to')?.value?.replace(/^<|>$/g, '') ?? null;
  return {
    provider: 'graph',
    providerMessageId: msg.id,
    internetMessageId: msg.internetMessageId?.replace(/^<|>$/g, '') ?? null,
    conversationId: msg.conversationId ?? null,
    inReplyTo,
    from: mapAddr(msg.from),
    to: mapAddrs(msg.toRecipients),
    cc: mapAddrs(msg.ccRecipients),
    subject: msg.subject ?? '',
    sentAt: msg.sentDateTime || msg.receivedDateTime ? new Date((msg.sentDateTime ?? msg.receivedDateTime) as string) : null,
    htmlBody: isHtml ? msg.body?.content ?? null : null,
    textBody: isHtml ? null : msg.body?.content ?? null,
    attachments,
  };
}

/** A change notification as Graph posts it to the webhook. */
export interface GraphNotification {
  subscriptionId?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  resourceData?: { id?: string };
}

/** Constant-time-ish clientState check. A notification with the wrong/missing state is dropped. */
export function verifyNotification(n: GraphNotification, expected: string): boolean {
  if (!n.clientState || n.clientState.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= n.clientState.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export interface GraphClient {
  getMessage(id: string): Promise<GraphMessage>;
  listAttachments(id: string): Promise<GraphAttachmentMeta[]>;
  /** $value endpoint: raw bytes, so large attachments never go through inline base64 contentBytes. */
  getAttachmentBytes(messageId: string, attachmentId: string): Promise<Buffer>;
}

export function createGraphClient(cfg: GraphConfig, fetchImpl: typeof fetch = fetch): GraphClient {
  let token: { value: string; exp: number } | null = null;
  async function bearer(): Promise<string> {
    if (token && token.exp > Date.now() + 60_000) return token.value;
    const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) throw new Error(`Graph token request failed (${res.status})`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    return token.value;
  }
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}`;
  async function get(path: string): Promise<Response> {
    const res = await fetchImpl(`${base}${path}`, { headers: { authorization: `Bearer ${await bearer()}` } });
    if (!res.ok) throw new Error(`Graph ${path.split('?')[0]} failed (${res.status})`);
    return res;
  }
  return {
    async getMessage(id) {
      return (await (await get(`/messages/${encodeURIComponent(id)}?$select=id,internetMessageId,conversationId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,hasAttachments,internetMessageHeaders`)).json()) as GraphMessage;
    },
    async listAttachments(id) {
      const j = (await (await get(`/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline`)).json()) as { value: GraphAttachmentMeta[] };
      return j.value ?? [];
    },
    async getAttachmentBytes(messageId, attachmentId) {
      return Buffer.from(await (await get(`/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`)).arrayBuffer());
    },
  };
}

/** Fetches a notified message end to end and maps it. Item attachments / reference attachments are skipped. */
export async function fetchGraphEmail(client: GraphClient, messageId: string): Promise<InboundEmail> {
  const msg = await client.getMessage(messageId);
  const attachments: InboundAttachment[] = [];
  if (msg.hasAttachments) {
    for (const meta of await client.listAttachments(messageId)) {
      if (meta['@odata.type'] && !meta['@odata.type'].endsWith('fileAttachment')) continue;
      attachments.push({
        filename: meta.name,
        contentType: meta.contentType ?? 'application/octet-stream',
        content: await client.getAttachmentBytes(messageId, meta.id),
        isInline: Boolean(meta.isInline),
      });
    }
  }
  return mapGraphMessage(msg, attachments);
}
