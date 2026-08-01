import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBidDocument } from '@/lib/data/bid-documents';
import BidBuilder from '@/components/admin/BidBuilder';

/**
 * requireAdminUser-style auth but checking role IN ('operator','admin')
 * (BID_DOCUMENT_SCOPE.md §7.1) — mirrors requireOperatorApi's check, in the
 * server-component redirect shape app/employee/layout.tsx already uses,
 * since this is a page, not a route handler.
 *
 * Known gap, not fixed here: middleware.ts's isAdminRoute branch redirects
 * any non-'admin' role away from every /admin/** route, including this one
 * — an operator like Steve currently cannot reach this page at all despite
 * this check and every RLS policy on the bid_documents tables being
 * operator-inclusive. This is a pre-existing gap (the same one already
 * affects the GBP Photos CRM tab) wider than this feature's own scope —
 * see STATE_OF_THE_BUILD.md.
 */
export default async function BidDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  if (profile?.role !== 'operator' && profile?.role !== 'admin') redirect('/login');

  const bid = await getBidDocument(supabase, params.id);
  if (!bid) notFound();

  return (
    <BidBuilder
      bid={bid}
      currentUserId={user.id}
      currentUserName={(profile.full_name as string | undefined) ?? user.email ?? 'You'}
    />
  );
}
