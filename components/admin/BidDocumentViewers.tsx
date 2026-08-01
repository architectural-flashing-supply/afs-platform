'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Viewer {
  userId: string;
  fullName: string;
  lastSeenAt: string;
}

interface BidDocumentViewersProps {
  bidId: string;
  currentUserId: string;
  claimedBy: string | null;
}

const PING_INTERVAL_MS = 20_000;

/**
 * "Who is currently viewing" (BID_DOCUMENT_SCOPE.md §3.7). Backed by
 * bid_document_viewers, not the Presence API — pings every 20s while
 * mounted, subscribes to postgres_changes the same way
 * DeliveryTrackingMap.tsx's useLiveDriverLocation does (any change →
 * refetch, not reconstructing state from the payload), and excludes the
 * current user and the claimant (already shown separately) from the list.
 */
export default function BidDocumentViewers({ bidId, currentUserId, claimedBy }: BidDocumentViewersProps) {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bid-documents/${bidId}/viewers`);
      if (!res.ok) return;
      const data = (await res.json()) as { viewers: Viewer[] };
      setViewers(data.viewers ?? []);
    } catch {
      // Best-effort presence display — never block the page on this.
    }
  }, [bidId]);

  useEffect(() => {
    void refetch();

    const ping = () => {
      fetch(`/api/admin/bid-documents/${bidId}/viewer-ping`, { method: 'POST' }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      fetch(`/api/admin/bid-documents/${bidId}/viewer-ping`, { method: 'DELETE' }).catch(() => {});
    };
  }, [bidId, refetch]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bid-document-viewers-${bidId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bid_document_viewers', filter: `bid_id=eq.${bidId}` },
        () => {
          void refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bidId, refetch]);

  const others = viewers.filter((v) => v.userId !== currentUserId && v.userId !== claimedBy);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-label text-xs text-afs-chrome-dim">Also viewing:</span>
      {others.map((v) => (
        <span
          key={v.userId}
          className="font-label text-xs text-afs-chrome-mid bg-afs-bg-overlay border border-afs-border rounded-full px-2.5 py-0.5"
        >
          {v.fullName}
        </span>
      ))}
    </div>
  );
}
