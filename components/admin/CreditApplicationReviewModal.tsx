'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreditApplicationRow } from '@/lib/data/credit';

interface CreditApplicationReviewModalProps {
  application: CreditApplicationRow;
  onClose: () => void;
}

const inputClass =
  'w-full bg-afs-bg-light-raised border border-afs-line-strong rounded px-3 py-2.5 text-sm text-afs-v7-ink focus:border-afs-crimson outline-none font-data';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5';
const sectionLabelClass = 'font-label text-xs uppercase tracking-wide text-afs-v7-ink mb-2 pt-4 border-t border-afs-border-light';
const dtClass = 'font-body text-xs text-afs-ink-700';
const ddClass = 'font-body text-sm text-afs-v7-ink';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className={dtClass}>{label}</dt>
      <dd className={ddClass}>{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

export default function CreditApplicationReviewModal({ application, onClose }: CreditApplicationReviewModalProps) {
  const router = useRouter();
  const data = application.applicationData;
  const [approvedLimit, setApprovedLimit] = useState(
    application.requestedLimit != null ? String(application.requestedLimit) : ''
  );
  const [approvedTerms, setApprovedTerms] = useState(String(application.requestedTerms ?? 30));
  const [requirePo, setRequirePo] = useState(data?.poRequired ?? false);
  const [reviewerNotes, setReviewerNotes] = useState(application.reviewerNotes ?? '');
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: 'approve' | 'deny') {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/credit-applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          decision === 'approve'
            ? {
                status: 'approved',
                approvedLimit: Number(approvedLimit),
                approvedTerms: Number(approvedTerms),
                requirePo,
                reviewerNotes: reviewerNotes.trim() || null,
              }
            : { status: 'denied', reviewerNotes: reviewerNotes.trim() || null }
        ),
      });
      const resData = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(resData.error ?? 'Could not save this decision.');
        setSubmitting(null);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError('Could not save this decision.');
      setSubmitting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-afs-bg-modal" onClick={onClose} />
      <div className="relative bg-afs-bg-card border border-afs-border-light rounded max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="font-heading text-xl text-afs-v7-ink mb-1">Review Credit Application</h2>
        <p className="font-body text-sm text-afs-ink-700 mb-4">{application.companyName}</p>

        <dl className="grid grid-cols-2 gap-3 mb-2 font-body text-sm">
          <div>
            <dt className="text-afs-ink-700">Requested Limit</dt>
            <dd className="font-data text-afs-v7-ink">
              {application.requestedLimit != null ? `$${application.requestedLimit.toLocaleString()}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-afs-ink-700">Requested Terms</dt>
            <dd className="font-data text-afs-v7-ink">
              {application.requestedTerms != null ? `Net ${application.requestedTerms}` : '—'}
            </dd>
          </div>
        </dl>

        {data && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className={sectionLabelClass}>Business Contact Information</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="PO Required" value={data.poRequired ? 'Yes' : 'No'} />
                <Field label="Company Name" value={data.legalBusinessName} />
                <Field label="DBA" value={data.dbaName} />
                <Field label="Phone" value={data.phone} />
                <Field label="Fax" value={data.fax} />
                <Field label="Email" value={data.email} />
                <Field label="Registered Address" value={data.registeredAddress?.street} />
                <Field label="City / State / ZIP" value={data.registeredAddress?.cityStateZip} />
                <Field label="Date Commenced" value={data.dateCommenced} />
                <Field label="Business Type" value={data.businessType} />
                <Field label="EIN / Tax ID" value={data.taxId} />
                <Field label="Annual Revenue" value={data.annualRevenue} />
              </dl>
            </div>

            <div>
              <h3 className={sectionLabelClass}>Business and Credit Information</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Primary Business Address" value={data.primaryAddress?.street} />
                <Field label="City / State / ZIP" value={data.primaryAddress?.cityStateZip} />
                <Field label="Time at Address" value={data.timeAtAddress} />
                <Field label="Telephone" value={data.businessTelephone} />
                <Field label="Fax" value={data.businessFax} />
                <Field label="Email" value={data.businessEmail} />
                <Field label="Bank Name" value={data.bankName} />
                <Field label="Bank Phone" value={data.bankPhone} />
                <Field label="Bank Address" value={data.bankAddress} />
                <Field label="Bank City / State / ZIP" value={data.bankCityStateZip} />
                <Field label="Savings Acct #" value={data.bankAccounts?.savingsAccountNumber} />
                <Field label="Checking Acct #" value={data.bankAccounts?.checkingAccountNumber} />
                <Field label="Other Acct #" value={data.bankAccounts?.otherAccountNumber} />
              </dl>
            </div>

            <div>
              <h3 className={sectionLabelClass}>Trade References</h3>
              <div className="flex flex-col gap-2">
                {(data.tradeReferences ?? []).map((ref, i) => (
                  <div key={i} className="border border-afs-border-light rounded p-3">
                    <dl className="grid grid-cols-2 gap-2">
                      <Field label="Company" value={ref.businessName} />
                      <Field label="Type of Account" value={ref.accountType} />
                      <Field label="Address" value={ref.address} />
                      <Field label="City / State / ZIP" value={ref.cityStateZip} />
                      <Field label="Phone" value={ref.phone} />
                      <Field label="Fax" value={ref.fax} />
                      <Field label="Email" value={ref.email} />
                    </dl>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className={sectionLabelClass}>Agreement</h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Certification Accepted" value={data.certificationAccepted ? 'Yes' : 'No'} />
                <Field label="Terms Version" value={data.agreementTermsVersion} />
              </dl>
            </div>

            <div>
              <h3 className={sectionLabelClass}>Signatures</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-afs-border-light rounded p-3">
                  <dl className="grid gap-2">
                    <Field label="Signature 1 — Name" value={data.signerOne?.name} />
                    <Field label="Title" value={data.signerOne?.title} />
                    <Field label="Signed" value={data.signerOne?.signatureTyped} />
                  </dl>
                </div>
                <div className="border border-afs-border-light rounded p-3">
                  <dl className="grid gap-2">
                    <Field label="Signature 2 — Name" value={data.signerTwo?.name} />
                    <Field label="Title" value={data.signerTwo?.title} />
                    <Field label="Signed" value={data.signerTwo?.signatureTyped} />
                  </dl>
                </div>
              </div>
              <p className="font-body text-xs text-afs-ink-700 mt-2">Signed {data.signedAt ?? '—'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-afs-border-light">
          <div>
            <label className={labelClass} htmlFor="approved-limit">
              Approved Limit ($)
            </label>
            <input
              id="approved-limit"
              type="number"
              min="0"
              step="0.01"
              value={approvedLimit}
              onChange={(e) => setApprovedLimit(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="approved-terms">
              Approved Terms
            </label>
            <select
              id="approved-terms"
              value={approvedTerms}
              onChange={(e) => setApprovedTerms(e.target.value)}
              className={inputClass}
            >
              <option value="15">Net 15</option>
              <option value="30">Net 30</option>
              <option value="60">Net 60</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          {application.companyId ? (
            <label className="flex items-center gap-3 font-body text-sm text-afs-ink-700">
              <input
                type="checkbox"
                checked={requirePo}
                onChange={(e) => setRequirePo(e.target.checked)}
                className="accent-afs-crimson"
              />
              Require PO Number on all orders for this company
            </label>
          ) : (
            <p className="font-body text-xs text-afs-ink-700 bg-afs-bg-light-raised border border-afs-border-light rounded p-3">
              No company on file — PO requirement and credit limit must be set manually once this customer has a
              company (via Team Accounts).
            </p>
          )}
        </div>

        <div className="mb-2 mt-4">
          <label className={labelClass} htmlFor="reviewer-notes">
            Reviewer Notes
          </label>
          <textarea
            id="reviewer-notes"
            rows={3}
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Internal notes — reason for the decision"
            className="w-full bg-afs-bg-light-raised border border-afs-border-light rounded px-3 py-2.5 text-sm text-afs-v7-ink focus:border-afs-crimson outline-none font-body resize-y"
          />
        </div>

        {error && <p className="font-body text-xs text-afs-crimson mb-3">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="font-label text-xs text-afs-ink-700 hover:text-afs-v7-ink px-3 py-2"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => submit('deny')}
              disabled={submitting !== null}
              className="bg-afs-crimson-dim hover:bg-afs-crimson text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {submitting === 'deny' ? 'Denying…' : 'Deny'}
            </button>
            <button
              type="button"
              onClick={() => submit('approve')}
              disabled={submitting !== null || approvedLimit.trim() === ''}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {submitting === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
