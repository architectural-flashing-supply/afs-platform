import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getQuoteRows, QUOTE_STATUS_LABEL, type QuoteRowStatus } from '@/lib/data/quotes';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const QUOTE_STATUS_VARIANT: Record<QuoteRowStatus, BadgeVariant> = {
  pending: 'warning',
  ready: 'success',
  quoted: 'chrome',
  expired: 'chrome',
  cancelled: 'error',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function AccountQuotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const quoteRows = await getQuoteRows(supabase, user.id);

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-afs-ink-900">My Quotes</h1>
        <p className="font-body text-sm text-afs-ink-700 mt-1">
          Quote requests you&apos;ve submitted and formal quotes from AFS.
        </p>
      </div>

      {quoteRows.length === 0 ? (
        <EmptyState
          title="No quote requests yet"
          description="Submit a drawing or build a quote request to get started."
          actionLabel="Request a Quote"
          actionHref="/quote"
          secondaryLabel="Upload a Drawing"
          secondaryHref="/upload"
        />
      ) : (
        <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Request #
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Profiles
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Submitted
                </th>
                <th className="font-heading text-xs uppercase tracking-wide text-afs-ink-700 text-left px-4 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {quoteRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/account/quotes/${row.id}`}
                      className="font-data text-sm text-afs-crimson hover:text-afs-crimson-hover"
                    >
                      {row.quoteNumber ?? row.requestNumber}
                    </Link>
                  </td>
                  <td className="font-body text-sm text-afs-ink-900 px-4 py-3">{row.profilesSummary}</td>
                  <td className="font-data text-sm text-afs-ink-700 px-4 py-3">{formatDate(row.submittedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={QUOTE_STATUS_VARIANT[row.status]} pulse={row.status === 'ready'}>
                      {QUOTE_STATUS_LABEL[row.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
