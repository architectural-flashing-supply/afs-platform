'use client';

import { useState } from 'react';
import Link from 'next/link';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import DocumentDownloadButton from './DocumentDownloadButton';
import DocumentDeleteButton from './DocumentDeleteButton';
import { ORDER_STATUS_LABEL, type OrderStatus } from './ProductionTimeline';
import { QUOTE_STATUS_LABEL, type QuoteRow, type QuoteRowStatus } from '@/lib/data/quotes';

const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  submitted: 'info',
  received: 'chrome',
  in_queue: 'warning',
  cutting: 'warning',
  bending: 'warning',
  qc: 'warning',
  ready: 'success',
  in_production: 'warning',
  packaged: 'success',
  shipped: 'success',
  out_for_delivery: 'success',
  delivered: 'chrome',
  cancelled: 'error',
};

const QUOTE_STATUS_VARIANT: Record<QuoteRowStatus, BadgeVariant> = {
  pending: 'warning',
  ready: 'success',
  quoted: 'chrome',
  expired: 'chrome',
  cancelled: 'error',
};

export interface ProjectOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
}

export interface ProjectDocumentRow {
  id: string;
  filename: string;
  fileType: string;
  fileSizeBytes: number;
  createdAt: string;
}

export interface ProjectTeamRow {
  id: string;
  fullName: string;
  email: string;
  companyRole: string | null;
}

interface ProjectTabsProps {
  orders: ProjectOrderRow[];
  quotes: QuoteRow[];
  documents: ProjectDocumentRow[];
  team: ProjectTeamRow[] | null;
}

type TabKey = 'orders' | 'quotes' | 'documents' | 'team';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectTabs({ orders, quotes, documents, team }: ProjectTabsProps) {
  const [tab, setTab] = useState<TabKey>('orders');

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'orders', label: 'Orders', count: orders.length },
    { key: 'quotes', label: 'Quotes', count: quotes.length },
    { key: 'documents', label: 'Documents', count: documents.length },
    { key: 'team', label: 'Team', count: team?.length ?? 0 },
  ];

  return (
    <div data-testid="project-tabs">
      <div className="flex gap-6 border-b border-afs-chrome-dim mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            data-testid={`project-tab-${t.key}`}
            className={`font-label text-sm pb-3 border-b-2 transition-colors ${
              tab === t.key
                ? 'border-afs-crimson text-afs-chrome-high'
                : 'border-transparent text-afs-chrome-mid hover:text-afs-chrome-high'
            }`}
          >
            {t.label} <span className="font-data text-xs text-afs-chrome-dim">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'orders' &&
        (orders.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No orders linked to this project yet.</p>
        ) : (
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Order #
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Date
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Status
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-4 py-3">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/account/orders/${order.id}`} className="font-data text-sm text-afs-crimson hover:text-afs-crimson-hover">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="font-data text-sm text-afs-chrome-mid px-4 py-3">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? 'chrome'}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                    </td>
                    <td className="font-data text-sm text-afs-chrome-high text-right px-4 py-3">{currency.format(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'quotes' &&
        (quotes.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No quote requests linked to this project yet.</p>
        ) : (
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-afs-bg-surface border-b border-afs-chrome-dim">
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Request #
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Profiles
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Submitted
                  </th>
                  <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((row) => (
                  <tr key={row.id} className="border-b border-afs-chrome-dim last:border-b-0 hover:bg-afs-bg-surface transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/account/quotes/${row.id}`} className="font-data text-sm text-afs-crimson hover:text-afs-crimson-hover">
                        {row.quoteNumber ?? row.requestNumber}
                      </Link>
                    </td>
                    <td className="font-body text-sm text-afs-chrome-high px-4 py-3">{row.profilesSummary}</td>
                    <td className="font-data text-sm text-afs-chrome-mid px-4 py-3">{formatDate(row.submittedAt)}</td>
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
        ))}

      {tab === 'documents' &&
        (documents.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No documents in this project yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-chrome-dim rounded px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-body text-sm text-afs-chrome-high truncate">{doc.filename}</p>
                  <p className="font-data text-xs text-afs-chrome-dim">
                    {doc.fileType.replace('.', '').toUpperCase()} · {formatFileSize(doc.fileSizeBytes)} · {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <DocumentDownloadButton documentId={doc.id} />
                  <DocumentDeleteButton documentId={doc.id} filename={doc.filename} />
                </div>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'team' &&
        (team === null ? (
          <p className="font-body text-sm text-afs-chrome-mid">
            Team accounts aren&apos;t set up for your profile yet. Contact AFS to enable a company team.
          </p>
        ) : team.length === 0 ? (
          <p className="font-body text-sm text-afs-chrome-mid">No team members yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {team.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-4 bg-afs-bg-raised border border-afs-chrome-dim rounded px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-body text-sm text-afs-chrome-high truncate">{member.fullName}</p>
                  <p className="font-data text-xs text-afs-chrome-dim truncate">{member.email}</p>
                </div>
                {member.companyRole && (
                  <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid shrink-0">
                    {member.companyRole}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
