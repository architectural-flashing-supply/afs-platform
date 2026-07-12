'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type BusinessType = 'corporation' | 'llc' | 'partnership' | 'sole_proprietor';
type AnnualRevenue = '<500k' | '500k-2m' | '2m-10m' | '10m+';
type RequestedTerms = 15 | 30 | 60;

interface TradeReferenceForm {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
}

interface CreditApplicationFormProps {
  defaultAuthorizedName: string;
}

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'corporation', label: 'Corporation' },
  { value: 'llc', label: 'LLC' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
];

const REVENUE_BANDS: { value: AnnualRevenue; label: string }[] = [
  { value: '<500k', label: 'Under $500K' },
  { value: '500k-2m', label: '$500K – $2M' },
  { value: '2m-10m', label: '$2M – $10M' },
  { value: '10m+', label: '$10M+' },
];

const TERMS_OPTIONS: RequestedTerms[] = [15, 30, 60];

const EMPTY_REFERENCE: TradeReferenceForm = { businessName: '', contactName: '', phone: '', email: '' };

const STEP_LABELS = ['Business Info', 'Trade References', 'Credit Request', 'Authorization'];

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-ink-900 focus:border-afs-crimson outline-none font-body';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-1.5';

export default function CreditApplicationForm({ defaultAuthorizedName }: CreditApplicationFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [legalBusinessName, setLegalBusinessName] = useState('');
  const [dbaName, setDbaName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [annualRevenue, setAnnualRevenue] = useState<AnnualRevenue | ''>('');

  // Step 2
  const [tradeReferences, setTradeReferences] = useState<TradeReferenceForm[]>([
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
  ]);

  // Step 3
  const [requestedCreditLimit, setRequestedCreditLimit] = useState('');
  const [requestedTerms, setRequestedTerms] = useState<RequestedTerms | ''>('');

  // Step 4
  const [authorizedName, setAuthorizedName] = useState(defaultAuthorizedName);
  const [authorizedTitle, setAuthorizedTitle] = useState('');
  const [signatureTyped, setSignatureTyped] = useState('');
  const [certificationAccepted, setCertificationAccepted] = useState(false);

  function updateReference(index: number, field: keyof TradeReferenceForm, value: string) {
    setTradeReferences((prev) => prev.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref)));
  }

  function addReference() {
    setTradeReferences((prev) => [...prev, { ...EMPTY_REFERENCE }]);
  }

  function removeReference(index: number) {
    setTradeReferences((prev) => (prev.length <= 3 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!legalBusinessName.trim()) return 'Legal business name is required.';
      if (!taxId.trim()) return 'EIN / Tax ID is required.';
      if (!yearsInBusiness || Number(yearsInBusiness) < 0) return 'Enter years in business.';
      if (!businessType) return 'Select a business type.';
      if (!annualRevenue) return 'Select an annual revenue range.';
      return null;
    }
    if (current === 2) {
      const complete = tradeReferences.filter((r) => r.businessName.trim() && r.contactName.trim() && r.phone.trim());
      if (complete.length < 3) return 'At least 3 complete trade references are required.';
      return null;
    }
    if (current === 3) {
      if (!requestedCreditLimit || Number(requestedCreditLimit) <= 0) return 'Enter a requested credit limit.';
      if (!requestedTerms) return 'Select requested payment terms.';
      return null;
    }
    if (current === 4) {
      if (!authorizedName.trim()) return 'Enter the authorized signer name.';
      if (!authorizedTitle.trim()) return 'Enter the authorized signer title.';
      if (!signatureTyped.trim()) return 'Type your name to sign.';
      if (!certificationAccepted) return 'You must certify this application is accurate.';
      return null;
    }
    return null;
  }

  function goNext() {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validateStep(4);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/credit/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalBusinessName,
          dbaName: dbaName || null,
          taxId,
          yearsInBusiness: Number(yearsInBusiness),
          businessType,
          annualRevenue,
          tradeReferences: tradeReferences.filter((r) => r.businessName.trim() && r.contactName.trim() && r.phone.trim()),
          requestedCreditLimit: Number(requestedCreditLimit),
          requestedTerms,
          authorizedName,
          authorizedTitle,
          signatureTyped,
          certificationAccepted,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not submit application. Please try again.');
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not submit application. Please try again.');
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
        <h2 className="font-heading text-2xl text-afs-ink-900 mb-3">Application Submitted</h2>
        <p className="font-body text-sm text-afs-ink-700 mb-6 max-w-md mx-auto">
          Thanks — your credit application has been sent to AFS accounting. Review typically takes 3–5 business days.
          We&apos;ll email you once a decision has been made.
        </p>
        <button
          type="button"
          onClick={() => router.push('/account')}
          className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="flex items-center justify-between mb-8" data-testid="credit-app-steps">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const complete = n < step;
          return (
            <div key={label} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-data text-xs border ${
                    complete
                      ? 'bg-afs-crimson border-afs-crimson text-white'
                      : active
                      ? 'border-afs-crimson text-afs-ink-900'
                      : 'border-afs-chrome-dim text-afs-ink-700'
                  }`}
                >
                  {complete ? '✓' : n}
                </div>
                <span
                  className={`font-label text-xs mt-2 text-center ${
                    active || complete ? 'text-afs-ink-900' : 'text-afs-ink-700'
                  }`}
                >
                  {label}
                </span>
              </div>
              {n < STEP_LABELS.length && <div className={`h-px flex-1 mx-1 mb-5 ${complete ? 'bg-afs-crimson' : 'bg-afs-chrome-dim'}`} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-xl text-afs-ink-900 mb-1">Business Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="legal-business-name">
                  Legal Business Name
                </label>
                <input
                  id="legal-business-name"
                  type="text"
                  value={legalBusinessName}
                  onChange={(e) => setLegalBusinessName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="dba-name">
                  DBA Name <span className="normal-case text-afs-crimson">(optional)</span>
                </label>
                <input id="dba-name" type="text" value={dbaName} onChange={(e) => setDbaName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="tax-id">
                  EIN / Tax ID
                </label>
                <input
                  id="tax-id"
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className={`${inputClass} font-data`}
                  placeholder="XX-XXXXXXX"
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="years-in-business">
                  Years in Business
                </label>
                <input
                  id="years-in-business"
                  type="number"
                  min="0"
                  step="1"
                  value={yearsInBusiness}
                  onChange={(e) => setYearsInBusiness(e.target.value)}
                  className={`${inputClass} font-data`}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="business-type">
                  Business Type
                </label>
                <select
                  id="business-type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="annual-revenue">
                  Annual Revenue
                </label>
                <select
                  id="annual-revenue"
                  value={annualRevenue}
                  onChange={(e) => setAnnualRevenue(e.target.value as AnnualRevenue)}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {REVENUE_BANDS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl text-afs-ink-900">Trade References</h2>
              <button type="button" onClick={addReference} className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
                + Add Reference
              </button>
            </div>
            <p className="font-body text-sm text-afs-ink-700 -mt-2">Provide at least 3 suppliers or vendors you have an account with.</p>
            {tradeReferences.map((ref, index) => (
              <div key={index} className="border border-afs-chrome-dim rounded p-4" data-testid="trade-reference-row">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-label text-xs uppercase tracking-wide text-afs-crimson">Reference {index + 1}</span>
                  {tradeReferences.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeReference(index)}
                      className="font-label text-xs text-afs-ink-700 hover:text-afs-crimson"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={ref.businessName}
                    onChange={(e) => updateReference(index, 'businessName', e.target.value)}
                    placeholder="Business Name"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={ref.contactName}
                    onChange={(e) => updateReference(index, 'contactName', e.target.value)}
                    placeholder="Contact Name"
                    className={inputClass}
                  />
                  <input
                    type="tel"
                    value={ref.phone}
                    onChange={(e) => updateReference(index, 'phone', e.target.value)}
                    placeholder="Phone"
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={ref.email}
                    onChange={(e) => updateReference(index, 'email', e.target.value)}
                    placeholder="Email (optional)"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-xl text-afs-ink-900 mb-1">Credit Request</h2>
            <div>
              <label className={labelClass} htmlFor="requested-limit">
                Requested Credit Limit
              </label>
              <input
                id="requested-limit"
                type="number"
                min="0"
                step="100"
                value={requestedCreditLimit}
                onChange={(e) => setRequestedCreditLimit(e.target.value)}
                className={`${inputClass} font-data`}
                placeholder="25000"
                required
              />
            </div>
            <div>
              <span className={labelClass}>Requested Payment Terms</span>
              <div className="grid grid-cols-3 gap-3">
                {TERMS_OPTIONS.map((terms) => (
                  <label
                    key={terms}
                    className={`flex items-center justify-center gap-2 border rounded px-3 py-3 cursor-pointer font-data text-sm transition-colors ${
                      requestedTerms === terms
                        ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-ink-900'
                        : 'border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="requestedTerms"
                      value={terms}
                      checked={requestedTerms === terms}
                      onChange={() => setRequestedTerms(terms)}
                      className="accent-afs-crimson"
                    />
                    Net {terms}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-xl text-afs-ink-900 mb-1">Authorization</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="authorized-name">
                  Authorized Name
                </label>
                <input
                  id="authorized-name"
                  type="text"
                  value={authorizedName}
                  onChange={(e) => setAuthorizedName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="authorized-title">
                  Title
                </label>
                <input
                  id="authorized-title"
                  type="text"
                  value={authorizedTitle}
                  onChange={(e) => setAuthorizedTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Owner, CFO, Controller…"
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="signature-typed">
                Type Your Full Name to Sign
              </label>
              <input
                id="signature-typed"
                type="text"
                value={signatureTyped}
                onChange={(e) => setSignatureTyped(e.target.value)}
                className={`${inputClass} italic`}
                required
              />
            </div>
            <label className="flex items-start gap-3 font-body text-sm text-afs-ink-700 mt-2">
              <input
                type="checkbox"
                checked={certificationAccepted}
                onChange={(e) => setCertificationAccepted(e.target.checked)}
                className="accent-afs-crimson mt-0.5"
                required
              />
              I certify that the information provided in this application is true and accurate, and I authorize AFS
              to verify this information and the trade references listed.
            </label>
          </div>
        )}

        {error && <p className="font-body text-xs text-afs-crimson mt-4">{error}</p>}

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-afs-chrome-dim">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className="border border-afs-border text-afs-ink-700 hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
