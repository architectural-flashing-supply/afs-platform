'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import type { ProductionQueueRow } from '@/lib/data/orders';
import { EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUS_VARIANT } from '@/lib/employee/orderStatus';

const PULL_THRESHOLD_PX = 70;

interface EmployeeOrdersListProps {
  orders: ProductionQueueRow[];
}

export default function EmployeeOrdersList({ orders }: EmployeeOrdersListProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: React.TouchEvent) {
    if ((containerRef.current?.scrollTop ?? 0) > 0) {
      touchStartY.current = null;
      return;
    }
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta, 120));
  }

  function handleTouchEnd() {
    if (pullDistance >= PULL_THRESHOLD_PX) {
      setRefreshing(true);
      router.refresh();
      // No onRefreshComplete signal from router.refresh() itself — this
      // just gives the pull indicator a moment to display before the fresh
      // server-rendered props replace it.
      setTimeout(() => setRefreshing(false), 600);
    }
    setPullDistance(0);
    touchStartY.current = null;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="overflow-y-auto"
    >
      {(refreshing || pullDistance > 0) && (
        <div
          className="flex items-center justify-center text-afs-chrome-mid font-label text-xs uppercase tracking-wide transition-all"
          style={{ height: refreshing ? 40 : pullDistance }}
        >
          {refreshing ? 'Refreshing…' : pullDistance >= PULL_THRESHOLD_PX ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState title="No active orders assigned" description="Check back once new orders enter production or delivery." />
      ) : (
        <div className="flex flex-col gap-3 pb-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/employee/orders/${order.id}`}
              className="bg-afs-bg-raised border border-afs-border rounded p-4 flex flex-col gap-2 active:bg-afs-bg-surface transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-data text-sm text-afs-chrome-high">#{order.orderNumber}</span>
                <Badge variant={EMPLOYEE_STATUS_VARIANT[order.status] ?? 'chrome'}>
                  {EMPLOYEE_STATUS_LABEL[order.status] ?? order.status}
                </Badge>
              </div>
              <p className="font-body text-base text-afs-chrome-high">{order.customerName}</p>
              <p className="font-body text-sm text-afs-chrome-mid">{order.profileSummary}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
