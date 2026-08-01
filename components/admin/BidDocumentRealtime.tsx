'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Invisible listener, mounted only on the bid detail/builder page. Any
 * change to this bid_documents row — including a peer's claim override —
 * refreshes the server-rendered detail so claim state, status, and
 * subtotal stay live (BID_DOCUMENT_SCOPE.md §3.6), matching
 * ProductionQueueRealtime.tsx's own plain postgres_changes idiom.
 */
export default function BidDocumentRealtime({ bidId }: { bidId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bid-document-${bidId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bid_documents', filter: `id=eq.${bidId}` },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bidId, router]);

  return null;
}
