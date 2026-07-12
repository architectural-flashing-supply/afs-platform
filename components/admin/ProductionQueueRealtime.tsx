'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Invisible listener — any order status change (from this admin or another)
 * refreshes the server-rendered queue so row status, tab counts, and
 * QuickAdvanceButton labels stay live (SPEC_PRODUCTION_QUEUE.md §4).
 */
export default function ProductionQueueRealtime() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('production-queue')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
