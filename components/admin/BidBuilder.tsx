'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { isClaimActive, formatClaimAge, type BidDocumentDetail, type BidDocumentStatus } from '@/lib/data/bid-documents';
import BidDocumentRealtime from '@/components/admin/BidDocumentRealtime';
import BidDocumentViewers from '@/components/admin/BidDocumentViewers';

interface BidBuilderProps {
  bid: BidDocumentDetail;
  currentUserId: string;
  currentUserName: string;
}

const HEARTBEAT_INTERVAL_MS = 2 * 60_000;
const AUTOSAVE_DEBOUNCE_MS = 800;

const STATUS_VARIANT: Record<BidDocumentStatus, BadgeVariant> = {
  draft: 'chrome',
  sent: 'info',
  awarded: 'success',
  lost: 'error',
  expired: 'error',
  withdrawn: 'chrome',
};

const STATUS_LABEL: Record<BidDocumentStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  awarded: 'Awarded',
  lost: 'Lost',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body disabled:opacity-60 disabled:cursor-not-allowed';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';

interface HeaderFields {
  projectName: string;
  gcName: string;
  gcContactName: string;
  gcContactEmail: string;
  gcContactPhone: string;
  projectLocation: string;
  priceValidUntil: string;
  deliveryTerms: string;
  taxNote: string;
  customerNote: string;
}

function toHeaderFields(bid: BidDocumentDetail): HeaderFields {
  return {
    projectName: bid.projectName,
    gcName: bid.gcName,
    gcContactName: bid.gcContactName ?? '',
    gcContactEmail: bid.gcContactEmail ?? '',
    gcContactPhone: bid.gcContactPhone ?? '',
    projectLocation: bid.projectLocation ?? '',
    priceValidUntil: bid.priceValidUntil ?? '',
    deliveryTerms: bid.deliveryTerms ?? '',
    taxNote: bid.taxNote,
    customerNote: bid.customerNote ?? '',
  };
}

interface AddLineItemFormState {
  quantity: string;
  specText: string;
  unit: string;
  unitPrice: string;
}

const EMPTY_LINE_ITEM_FORM: AddLineItemFormState = { quantity: '', specText: '', unit: 'LF', unitPrice: '' };

export default function BidBuilder({ bid, currentUserId, currentUserName }: BidBuilderProps) {
  const router = useRouter();

  const active = isClaimActive(bid.claimedBy, bid.lastActivityAt);
  const isSelf = bid.claimedBy === currentUserId;
  const readOnly = active && !isSelf;

  // Silent auto-claim on mount when the bid reads as unclaimed
  // (BID_DOCUMENT_SCOPE.md §3.4) — guarded so it fires at most once even
  // under React Strict Mode's double-invoked dev effects.
  const autoClaimedRef = useRef(false);
  useEffect(() => {
    if (autoClaimedRef.current || active) return;
    autoClaimedRef.current = true;
    fetch(`/api/admin/bid-documents/${bid.id}/claim`, { method: 'POST' })
      .catch(() => {})
      .finally(() => router.refresh());
  }, [active, bid.id, router]);

  // Heartbeat every 2 minutes while claimed by self and mounted (§3.5).
  useEffect(() => {
    if (!isSelf) return;
    const interval = setInterval(() => {
      fetch(`/api/admin/bid-documents/${bid.id}/heartbeat`, { method: 'POST' })
        .then((res) => res.json())
        .then((data: { stillClaimed: boolean }) => {
          if (!data.stillClaimed) router.refresh();
        })
        .catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSelf, bid.id, router]);

  const [takingOver, setTakingOver] = useState(false);
  async function handleTakeOver() {
    setTakingOver(true);
    try {
      await fetch(`/api/admin/bid-documents/${bid.id}/claim`, { method: 'POST' });
      router.refresh();
    } finally {
      setTakingOver(false);
    }
  }

  const [releasing, setReleasing] = useState(false);
  async function handleRelease() {
    setReleasing(true);
    try {
      await fetch(`/api/admin/bid-documents/${bid.id}/release`, { method: 'POST' });
      router.refresh();
    } finally {
      setReleasing(false);
    }
  }

  // Seeded once on mount, not resynced from props on every refresh — a
  // refresh triggered by our own autosave (or a peer's presence ping)
  // must not clobber text the claimant is mid-typing. Read-only viewers
  // never use this state at all; they render bid.* directly (see below),
  // which stays fresh on every refresh.
  const [fields, setFields] = useState<HeaderFields>(() => toHeaderFields(bid));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const skipNextAutosave = useRef(true);

  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (readOnly) return;
    const timer = setTimeout(() => {
      setSaveState('saving');
      fetch(`/api/admin/bid-documents/${bid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
        .then((res) => setSaveState(res.ok ? 'saved' : 'error'))
        .catch(() => setSaveState('error'));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function updateField<K extends keyof HeaderFields>(key: K, value: HeaderFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const [newSectionText, setNewSectionText] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function handleAddSection() {
    const workDescription = newSectionText.trim();
    if (!workDescription) return;
    setAddingSection(true);
    setSectionError(null);
    try {
      const res = await fetch(`/api/admin/bid-documents/${bid.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workDescription }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSectionError(data.error ?? 'Could not add this section.');
        return;
      }
      setNewSectionText('');
      router.refresh();
    } catch {
      setSectionError('Network error. Please try again.');
    } finally {
      setAddingSection(false);
    }
  }

  const [statusBusy, setStatusBusy] = useState(false);
  async function handleStatusChange(status: BidDocumentStatus) {
    setStatusBusy(true);
    try {
      await fetch(`/api/admin/bid-documents/${bid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setStatusBusy(false);
    }
  }

  // "Once a claimed bid has pricing entered" (BID_DOCUMENT_SCOPE.md's
  // approval step) — subtotal is only non-null once at least one line item
  // exists (013_bid_documents.sql), so this single check covers both.
  const hasPricing = bid.subtotal != null && bid.sections.some((section) => section.lineItems.length > 0);
  const canSend = hasPricing && !!bid.gcContactEmail && bid.status === 'draft';

  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  async function handleSend() {
    setSendBusy(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/admin/bid-documents/${bid.id}/send`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSendError(data.error ?? 'Could not send this bid.');
        return;
      }
      router.refresh();
    } catch {
      setSendError('Network error. Please try again.');
    } finally {
      setSendBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BidDocumentRealtime bidId={bid.id} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-label text-afs-crimson text-xs tracking-widest uppercase mb-2">
            <Link href="/admin/command-center?tab=bids" className="hover:underline">
              Bids
            </Link>{' '}
            / {bid.bidNumber}
          </p>
          <h1 className="font-heading text-3xl text-afs-chrome-high">{bid.projectName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={STATUS_VARIANT[bid.status]}>{STATUS_LABEL[bid.status]}</Badge>
            <BidDocumentViewers bidId={bid.id} currentUserId={currentUserId} claimedBy={bid.claimedBy} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {readOnly && (
            <div className="flex items-center gap-3">
              <span className="font-body text-xs text-afs-chrome-mid">
                Claimed by {bid.claimedByName ?? 'someone'}
                {bid.claimedAt ? ` · ${formatClaimAge(bid.claimedAt)}` : ''} — read-only
              </span>
              <button
                type="button"
                disabled={takingOver}
                onClick={handleTakeOver}
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              >
                {takingOver ? 'Taking Over…' : 'Take Over'}
              </button>
            </div>
          )}
          {isSelf && (
            <div className="flex items-center gap-3">
              <span className="font-body text-xs text-afs-success">Claimed by you</span>
              <button
                type="button"
                disabled={releasing}
                onClick={handleRelease}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              >
                {releasing ? 'Releasing…' : 'Release Claim'}
              </button>
            </div>
          )}
          {!readOnly && !isSelf && <span className="font-body text-xs text-afs-chrome-dim">Claiming…</span>}
        </div>
      </div>

      {/* Header fields */}
      <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg text-afs-chrome-high">Bid Details</h2>
          {!readOnly && (
            <span className="font-body text-xs text-afs-chrome-dim">
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'saved' && 'Saved'}
              {saveState === 'error' && <span className="text-afs-crimson">Could not save</span>}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass} htmlFor="project-name">
              Project Name
            </label>
            <input
              id="project-name"
              type="text"
              disabled={readOnly}
              value={readOnly ? bid.projectName : fields.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-name">
              GC Name
            </label>
            <input
              id="gc-name"
              type="text"
              disabled={readOnly}
              value={readOnly ? bid.gcName : fields.gcName}
              onChange={(e) => updateField('gcName', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-contact-name">
              GC Contact Name
            </label>
            <input
              id="gc-contact-name"
              type="text"
              disabled={readOnly}
              value={readOnly ? (bid.gcContactName ?? '') : fields.gcContactName}
              onChange={(e) => updateField('gcContactName', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-contact-email">
              GC Contact Email
            </label>
            <input
              id="gc-contact-email"
              type="email"
              disabled={readOnly}
              value={readOnly ? (bid.gcContactEmail ?? '') : fields.gcContactEmail}
              onChange={(e) => updateField('gcContactEmail', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="gc-contact-phone">
              GC Contact Phone
            </label>
            <input
              id="gc-contact-phone"
              type="tel"
              disabled={readOnly}
              value={readOnly ? (bid.gcContactPhone ?? '') : fields.gcContactPhone}
              onChange={(e) => updateField('gcContactPhone', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="project-location">
              Project Location
            </label>
            <input
              id="project-location"
              type="text"
              disabled={readOnly}
              value={readOnly ? (bid.projectLocation ?? '') : fields.projectLocation}
              onChange={(e) => updateField('projectLocation', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="price-valid-until">
              Price Valid Until
            </label>
            <input
              id="price-valid-until"
              type="date"
              disabled={readOnly}
              value={readOnly ? (bid.priceValidUntil ?? '') : fields.priceValidUntil}
              onChange={(e) => updateField('priceValidUntil', e.target.value)}
              className={`${inputClass} font-data`}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="delivery-terms">
              Delivery Terms
            </label>
            <input
              id="delivery-terms"
              type="text"
              disabled={readOnly}
              value={readOnly ? (bid.deliveryTerms ?? '') : fields.deliveryTerms}
              onChange={(e) => updateField('deliveryTerms', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="tax-note">
              Tax Note
            </label>
            <input
              id="tax-note"
              type="text"
              disabled={readOnly}
              value={readOnly ? bid.taxNote : fields.taxNote}
              onChange={(e) => updateField('taxNote', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="customer-note">
              Note to Customer
            </label>
            <textarea
              id="customer-note"
              rows={1}
              disabled={readOnly}
              value={readOnly ? (bid.customerNote ?? '') : fields.customerNote}
              onChange={(e) => updateField('customerNote', e.target.value)}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      </div>

      {/* Sections + line items */}
      <div className="bg-afs-bg-raised border border-afs-border rounded p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg text-afs-chrome-high">Line Items</h2>
          <span className="font-data text-lg text-afs-crimson">
            {bid.subtotal != null ? currency.format(bid.subtotal) : '—'}
          </span>
        </div>

        {bid.sections.length === 0 && (
          <p className="font-body text-sm text-afs-chrome-mid mb-4">
            No work descriptions yet. Add one below to start pricing line items.
          </p>
        )}

        <div className="flex flex-col gap-6">
          {bid.sections.map((section) => (
            <div key={section.id}>
              <h3 className="font-heading text-sm text-afs-chrome-high uppercase tracking-wide mb-2">
                {section.workDescription}
              </h3>
              {section.lineItems.length > 0 && (
                <table className="w-full text-sm mb-2">
                  <thead>
                    <tr className="border-b border-afs-border">
                      <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-2 py-2 w-20">
                        Qty
                      </th>
                      <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-2 py-2">
                        Spec
                      </th>
                      <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-left px-2 py-2 w-16">
                        Unit
                      </th>
                      <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-2 py-2 w-28">
                        Unit Price
                      </th>
                      <th className="font-heading text-xs uppercase tracking-wide text-afs-chrome-mid text-right px-2 py-2 w-28">
                        Extended
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-afs-border last:border-b-0">
                        <td className="font-data text-sm text-afs-chrome-high text-right px-2 py-2">{item.quantity}</td>
                        <td className="font-body text-sm text-afs-chrome-high px-2 py-2">{item.specText}</td>
                        <td className="font-data text-xs text-afs-chrome-mid px-2 py-2">{item.unit}</td>
                        <td className="font-data text-sm text-afs-chrome-high text-right px-2 py-2">
                          {currency.format(item.unitPrice)}
                        </td>
                        <td className="font-data text-sm text-afs-chrome-high text-right px-2 py-2">
                          {currency.format(item.extendedPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!readOnly && <AddLineItemRow bidId={bid.id} sectionId={section.id} onAdded={() => router.refresh()} />}
            </div>
          ))}
        </div>

        {!readOnly && (
          <div className="mt-6 pt-6 border-t border-afs-border flex items-end gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="new-section">
                Add Work Description
              </label>
              <input
                id="new-section"
                type="text"
                value={newSectionText}
                onChange={(e) => setNewSectionText(e.target.value)}
                placeholder="Coping Cap — North Parapet"
                className={inputClass}
              />
            </div>
            <button
              type="button"
              disabled={addingSection || !newSectionText.trim()}
              onClick={handleAddSection}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              {addingSection ? 'Adding…' : '+ Add Work Description'}
            </button>
          </div>
        )}
        {sectionError && <p className="font-body text-xs text-afs-crimson mt-2">{sectionError}</p>}
      </div>

      {/* Approval — generate the PDF for review, then send (BID_DOCUMENT_SCOPE.md's approval step) */}
      {!readOnly && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6 flex items-center gap-4 flex-wrap">
          <h2 className="font-heading text-lg text-afs-chrome-high mr-2">Approval</h2>
          {!hasPricing && (
            <span className="font-body text-xs text-afs-chrome-mid">
              Add at least one priced line item before generating a PDF or sending this bid.
            </span>
          )}
          {hasPricing && (
            <a
              href={`/api/admin/bid-documents/${bid.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2 rounded transition-colors"
            >
              Preview PDF
            </a>
          )}
          {bid.status === 'draft' && (
            <button
              type="button"
              disabled={!canSend || sendBusy}
              onClick={handleSend}
              title={hasPricing && !bid.gcContactEmail ? 'Add a GC contact email before sending.' : undefined}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
            >
              {sendBusy ? 'Sending…' : 'Send to Customer'}
            </button>
          )}
          {sendError && <p className="font-body text-xs text-afs-crimson w-full">{sendError}</p>}
        </div>
      )}

      {/* Status */}
      {!readOnly && (
        <div className="bg-afs-bg-raised border border-afs-border rounded p-6 flex items-center gap-3 flex-wrap">
          <h2 className="font-heading text-lg text-afs-chrome-high mr-4">Status</h2>
          <button
            type="button"
            disabled={statusBusy || bid.status === 'awarded'}
            onClick={() => handleStatusChange('awarded')}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            Won
          </button>
          <button
            type="button"
            disabled={statusBusy || bid.status === 'lost'}
            onClick={() => handleStatusChange('lost')}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            Lost
          </button>
          <button
            type="button"
            disabled={statusBusy || bid.status === 'withdrawn'}
            onClick={() => handleStatusChange('withdrawn')}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            Withdrawn
          </button>
          <button
            type="button"
            disabled={statusBusy || bid.status === 'expired'}
            onClick={() => handleStatusChange('expired')}
            className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label text-sm px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            Expired
          </button>
        </div>
      )}

      <p className="font-body text-xs text-afs-chrome-dim">
        Signed in as {currentUserName}. Awarding a bid here only updates its status — it does not create an order,
        quote, or quote request.
      </p>
    </div>
  );
}

function AddLineItemRow({
  bidId,
  sectionId,
  onAdded,
}: {
  bidId: string;
  sectionId: string;
  onAdded: () => void;
}) {
  const [form, setForm] = useState<AddLineItemFormState>(EMPTY_LINE_ITEM_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    if (!form.specText.trim()) {
      setError('Spec text is required.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Unit price must be a non-negative number.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bid-documents/${bidId}/sections/${sectionId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          specText: form.specText.trim(),
          unit: form.unit.trim() || 'LF',
          unitPrice,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not add this line item.');
        return;
      }
      setForm(EMPTY_LINE_ITEM_FORM);
      onAdded();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-20">
          <label className={labelClass}>Qty</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
            className={`${inputClass} font-data`}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className={labelClass}>Spec</label>
          <input
            type="text"
            placeholder={'24 GA GALV, 12" girth, mill finish'}
            value={form.specText}
            onChange={(e) => setForm((prev) => ({ ...prev, specText: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="w-20">
          <label className={labelClass}>Unit</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="w-28">
          <label className={labelClass}>Unit Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
            className={`${inputClass} font-data`}
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleAdd}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold text-xs px-3 py-2 rounded transition-colors disabled:opacity-50"
        >
          {busy ? 'Adding…' : '+ Add Line'}
        </button>
      </div>
      {error && <p className="font-body text-xs text-afs-crimson mt-1">{error}</p>}
    </div>
  );
}
