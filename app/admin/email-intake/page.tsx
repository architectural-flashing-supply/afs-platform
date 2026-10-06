import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/admin/auth';
import { readGraphConfig } from '@/lib/email-intake/sources/graph';
import EmlUploader from '@/components/admin/email-intake/EmlUploader';
import RetryButton from '@/components/admin/email-intake/RetryButton';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  received: { text: 'Stored, not processed', cls: 'bg-neutral-200 text-neutral-800' },
  processing: { text: 'Processing', cls: 'bg-blue-100 text-blue-900' },
  drafted: { text: 'Draft ready', cls: 'bg-green-100 text-green-900' },
  needs_manual_takeoff: { text: 'Needs manual takeoff', cls: 'bg-amber-200 text-amber-900' },
  attached_to_thread: { text: 'Added to existing job', cls: 'bg-blue-100 text-blue-900' },
  ignored: { text: 'Not an order', cls: 'bg-neutral-200 text-neutral-700' },
  failed: { text: 'Failed - retry', cls: 'bg-red-100 text-red-900' },
};

export default async function EmailIntakePage() {
  const supabase = await createClient();
  await requireAdminUser(supabase);
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('email_messages')
    .select('id, provider, subject, from_address, from_name, sent_at, created_at, status, intent, intent_reason, error, quote_request_id')
    .order('created_at', { ascending: false })
    .limit(100);
  const outlookOn = readGraphConfig() !== null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Email to AI quote</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Orders that arrive by email become a draft quote request in the Workbench New lane. Nothing is ever sent to the customer automatically,
        and the AI never sets a price.
      </p>
      <p className={`mt-3 inline-block rounded px-3 py-1 text-xs ${outlookOn ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`} data-testid="outlook-status">
        {outlookOn ? 'Outlook connection: live' : 'Outlook connection: not configured yet. Use the .eml drop below, or POST to /api/email-intake/ingest.'}
      </p>
      <div className="mt-4"><EmlUploader /></div>

      <h2 className="mt-8 text-lg font-semibold">Recent messages</h2>
      {(rows ?? []).length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">Nothing received yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200 rounded border border-neutral-300 bg-white">
          {(rows ?? []).map((r) => {
            const s = STATUS_LABEL[r.status] ?? { text: r.status, cls: 'bg-neutral-200' };
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs ${s.cls}`}>{s.text}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.subject || '(no subject)'}</p>
                  <p className="truncate text-xs text-neutral-600">
                    {r.from_name ? `${r.from_name} <${r.from_address}>` : r.from_address} · {new Date(r.sent_at ?? r.created_at).toLocaleString()} · via {r.provider}
                    {r.intent_reason ? ` · ${r.intent_reason}` : ''}
                  </p>
                  {r.error && <p className="text-xs text-red-700">{r.error}</p>}
                </div>
                {r.quote_request_id && <Link className="text-blue-700 underline" href={`/admin/quote-requests/${r.quote_request_id}/source`}>View Source</Link>}
                {(r.status === 'failed' || r.status === 'received') && <RetryButton messageId={r.id} label="Retry" />}
                {r.status === 'ignored' && <RetryButton messageId={r.id} label="Treat as order" force />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
