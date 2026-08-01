'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type BusinessType = 'sole_proprietorship' | 'partnership' | 'corporation' | 'other';
type AnnualRevenue = '<500k' | '500k-2m' | '2m-10m' | '10m+';
type RequestedTerms = 15 | 30 | 60;
type PoRequired = 'yes' | 'no';

interface AddressForm {
  street: string;
  cityStateZip: string;
}

interface TradeReferenceForm {
  businessName: string;
  address: string;
  cityStateZip: string;
  phone: string;
  fax: string;
  email: string;
  accountType: string;
}

interface SignatureBlock {
  name: string;
  title: string;
  signatureTyped: string;
}

interface CreditApplicationFormProps {
  defaultAuthorizedName: string;
}

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'other', label: 'Other' },
];

const REVENUE_BANDS: { value: AnnualRevenue; label: string }[] = [
  { value: '<500k', label: 'Under $500K' },
  { value: '500k-2m', label: '$500K – $2M' },
  { value: '2m-10m', label: '$2M – $10M' },
  { value: '10m+', label: '$10M+' },
];

const TERMS_OPTIONS: RequestedTerms[] = [15, 30, 60];

const EMPTY_ADDRESS: AddressForm = { street: '', cityStateZip: '' };
const EMPTY_REFERENCE: TradeReferenceForm = {
  businessName: '',
  address: '',
  cityStateZip: '',
  phone: '',
  fax: '',
  email: '',
  accountType: '',
};
const EMPTY_SIGNATURE: SignatureBlock = { name: '', title: '', signatureTyped: '' };

// Terms composed from the specific clauses AFS's real paper credit application
// requires (net-30, 1.5%/month late charge, lien/collection/attorney-fees
// responsibility, 7-working-day claims window, bank + trade reference
// inquiry authorization) — see CREDIT_APP_GAPS.md §4. AGREEMENT_TERMS_VERSION
// is stored alongside certificationAccepted so AFS can prove which text a
// customer agreed to if the wording is ever revised.
const AGREEMENT_TERMS_VERSION = 'afs-credit-agreement-2026-07';
const AGREEMENT_TEXT = `By signing below, the undersigned applicant agrees to the following terms and conditions of this Application for Credit with Architectural Flashing Supply ("AFS"):

1. Payment Terms. Invoices are due net 30 days from the invoice date unless other terms are approved in writing by AFS.

2. Late Charges. Any invoice not paid within its terms is subject to a late charge of 1.5% per month (18% per annum) on the unpaid balance, or the maximum rate permitted by law, whichever is less.

3. Collection Costs and Lien Rights. In the event of default, the undersigned agrees to be responsible for all costs of collection, including reasonable attorney's fees and court costs, and for all costs associated with the filing, perfection, and enforcement of any mechanic's or materialman's lien AFS may file against the project for which materials were supplied.

4. Claims. Any claim regarding shortage, damage, defect, or other discrepancy in materials delivered must be made to AFS in writing within 7 working days of delivery. Claims made after this period are waived.

5. Authorization to Verify. The undersigned authorizes AFS to contact and obtain information from the banking and trade references supplied on this application, and from any other source AFS deems necessary, to verify the information provided and evaluate this application.

6. Certification. The undersigned certifies that the information provided on this application is true, complete, and accurate, and that the undersigned is authorized to sign this application on behalf of, and bind, the applicant business to these terms.`;

const STEP_LABELS = ['Business Info', 'Business & Bank', 'Trade References', 'Credit Request', 'Agreement', 'Signatures'];

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 text-sm text-afs-chrome-high focus:border-afs-crimson outline-none font-body';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid block mb-1.5';
const optionalTag = <span className="normal-case text-afs-chrome-dim">(optional)</span>;

export default function CreditApplicationForm({ defaultAuthorizedName }: CreditApplicationFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Section 1: Business Contact Information
  const [poRequired, setPoRequired] = useState<PoRequired | ''>('');
  const [legalBusinessName, setLegalBusinessName] = useState('');
  const [dbaName, setDbaName] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState<AddressForm>({ ...EMPTY_ADDRESS });
  const [dateCommenced, setDateCommenced] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType | ''>('');
  const [taxId, setTaxId] = useState('');
  const [annualRevenue, setAnnualRevenue] = useState<AnnualRevenue | ''>('');

  // Step 2 — Section 2: Business and Credit Information (address + bank)
  const [primaryAddress, setPrimaryAddress] = useState<AddressForm>({ ...EMPTY_ADDRESS });
  const [timeAtAddress, setTimeAtAddress] = useState('');
  const [businessTelephone, setBusinessTelephone] = useState('');
  const [businessFax, setBusinessFax] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAddress, setBankAddress] = useState('');
  const [bankCityStateZip, setBankCityStateZip] = useState('');
  const [bankPhone, setBankPhone] = useState('');
  const [savingsAccountNumber, setSavingsAccountNumber] = useState('');
  const [checkingAccountNumber, setCheckingAccountNumber] = useState('');
  const [otherAccountNumber, setOtherAccountNumber] = useState('');

  // Step 3 — Section 3: Trade References
  const [tradeReferences, setTradeReferences] = useState<TradeReferenceForm[]>([
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
  ]);

  // Step 4 — Credit Request
  const [requestedCreditLimit, setRequestedCreditLimit] = useState('');
  const [requestedTerms, setRequestedTerms] = useState<RequestedTerms | ''>('');

  // Step 5 — Section 4: Agreement
  const [certificationAccepted, setCertificationAccepted] = useState(false);

  // Step 6 — Section 5: Signatures (two blocks)
  const [signerOne, setSignerOne] = useState<SignatureBlock>({ ...EMPTY_SIGNATURE, name: defaultAuthorizedName });
  const [signerTwo, setSignerTwo] = useState<SignatureBlock>({ ...EMPTY_SIGNATURE });

  function updateReference(index: number, field: keyof TradeReferenceForm, value: string) {
    setTradeReferences((prev) => prev.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref)));
  }

  function addReference() {
    setTradeReferences((prev) => [...prev, { ...EMPTY_REFERENCE }]);
  }

  function removeReference(index: number) {
    setTradeReferences((prev) => (prev.length <= 3 ? prev : prev.filter((_, i) => i !== index)));
  }

  function isCompleteReference(r: TradeReferenceForm): boolean {
    return Boolean(
      r.businessName.trim() && r.address.trim() && r.cityStateZip.trim() && r.phone.trim() && r.email.trim() && r.accountType.trim()
    );
  }

  function isCompleteSignature(s: SignatureBlock): boolean {
    return Boolean(s.name.trim() && s.title.trim() && s.signatureTyped.trim());
  }

  function validateStep(current: number): string | null {
    if (current === 1) {
      if (!poRequired) return 'Select whether a Purchase Order is required.';
      if (!legalBusinessName.trim()) return 'Company name is required.';
      if (!phone.trim()) return 'Phone is required.';
      if (!email.trim()) return 'Email is required.';
      if (!registeredAddress.street.trim() || !registeredAddress.cityStateZip.trim()) {
        return 'Registered company address is required.';
      }
      if (!dateCommenced) return 'Enter the date business commenced.';
      if (!businessType) return 'Select a business type.';
      if (!taxId.trim()) return 'EIN / Tax ID is required.';
      if (!annualRevenue) return 'Select an annual revenue range.';
      return null;
    }
    if (current === 2) {
      if (!primaryAddress.street.trim() || !primaryAddress.cityStateZip.trim()) {
        return 'Primary business address is required.';
      }
      if (!timeAtAddress.trim()) return 'Enter how long you have been at this address.';
      if (!businessTelephone.trim()) return 'Business telephone is required.';
      if (!businessEmail.trim()) return 'Business email is required.';
      if (!bankName.trim()) return 'Bank name is required.';
      if (!bankAddress.trim() || !bankCityStateZip.trim()) return 'Bank address is required.';
      if (!bankPhone.trim()) return 'Bank phone is required.';
      return null;
    }
    if (current === 3) {
      const complete = tradeReferences.filter(isCompleteReference);
      if (complete.length < 3) return 'At least 3 complete trade references are required.';
      return null;
    }
    if (current === 4) {
      if (!requestedCreditLimit || Number(requestedCreditLimit) <= 0) return 'Enter a requested credit limit.';
      if (!requestedTerms) return 'Select requested payment terms.';
      return null;
    }
    if (current === 5) {
      if (!certificationAccepted) return 'You must agree to the terms above to continue.';
      return null;
    }
    if (current === 6) {
      if (!isCompleteSignature(signerOne)) return 'The first signature block is incomplete.';
      if (!isCompleteSignature(signerTwo)) return 'The second signature block is incomplete.';
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
    setStep((s) => Math.min(STEP_LABELS.length, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validateStep(STEP_LABELS.length);
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
          poRequired: poRequired === 'yes',
          legalBusinessName,
          dbaName: dbaName || null,
          phone,
          fax: fax || null,
          email,
          registeredAddress,
          dateCommenced,
          businessType,
          taxId,
          annualRevenue,
          primaryAddress,
          timeAtAddress,
          businessTelephone,
          businessFax: businessFax || null,
          businessEmail,
          bankName,
          bankAddress,
          bankCityStateZip,
          bankPhone,
          bankAccounts: {
            savingsAccountNumber: savingsAccountNumber || null,
            checkingAccountNumber: checkingAccountNumber || null,
            otherAccountNumber: otherAccountNumber || null,
          },
          tradeReferences: tradeReferences.filter(isCompleteReference),
          requestedCreditLimit: Number(requestedCreditLimit),
          requestedTerms,
          certificationAccepted,
          agreementTermsVersion: AGREEMENT_TERMS_VERSION,
          signerOne,
          signerTwo,
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
        <h2 className="font-heading text-2xl text-afs-chrome-high mb-3">Application Submitted</h2>
        <p className="font-body text-sm text-afs-chrome-mid mb-6 max-w-md mx-auto">
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
                      ? 'border-afs-crimson text-afs-chrome-high'
                      : 'border-afs-chrome-dim text-afs-chrome-dim'
                  }`}
                >
                  {complete ? '✓' : n}
                </div>
                <span
                  className={`font-label text-xs mt-2 text-center ${
                    active || complete ? 'text-afs-chrome-high' : 'text-afs-chrome-dim'
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
            <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Business Contact Information</h2>
            <div>
              <span className={labelClass}>Purchase Order Required?</span>
              <div className="grid grid-cols-2 gap-3">
                {(['yes', 'no'] as PoRequired[]).map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center justify-center gap-2 border rounded px-3 py-3 cursor-pointer font-data text-sm transition-colors ${
                      poRequired === opt
                        ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                        : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="poRequired"
                      value={opt}
                      checked={poRequired === opt}
                      onChange={() => setPoRequired(opt)}
                      className="accent-afs-crimson"
                    />
                    {opt === 'yes' ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="legal-business-name">
                  Company Name
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
                  DBA Name {optionalTag}
                </label>
                <input id="dba-name" type="text" value={dbaName} onChange={(e) => setDbaName(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone
                </label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label className={labelClass} htmlFor="fax">
                  Fax {optionalTag}
                </label>
                <input id="fax" type="tel" value={fax} onChange={(e) => setFax(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="registered-address-street">
                  Registered Company Address
                </label>
                <input
                  id="registered-address-street"
                  type="text"
                  value={registeredAddress.street}
                  onChange={(e) => setRegisteredAddress((a) => ({ ...a, street: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="registered-address-csz">
                  City / State / ZIP
                </label>
                <input
                  id="registered-address-csz"
                  type="text"
                  value={registeredAddress.cityStateZip}
                  onChange={(e) => setRegisteredAddress((a) => ({ ...a, cityStateZip: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="date-commenced">
                  Date Business Commenced
                </label>
                <input
                  id="date-commenced"
                  type="date"
                  value={dateCommenced}
                  onChange={(e) => setDateCommenced(e.target.value)}
                  className={`${inputClass} font-data`}
                  required
                />
              </div>
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
            <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Business and Credit Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="primary-address-street">
                  Primary Business Address
                </label>
                <input
                  id="primary-address-street"
                  type="text"
                  value={primaryAddress.street}
                  onChange={(e) => setPrimaryAddress((a) => ({ ...a, street: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="primary-address-csz">
                  City / State / ZIP
                </label>
                <input
                  id="primary-address-csz"
                  type="text"
                  value={primaryAddress.cityStateZip}
                  onChange={(e) => setPrimaryAddress((a) => ({ ...a, cityStateZip: e.target.value }))}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass} htmlFor="time-at-address">
                  How Long at This Address
                </label>
                <input
                  id="time-at-address"
                  type="text"
                  value={timeAtAddress}
                  onChange={(e) => setTimeAtAddress(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 6 years"
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="business-telephone">
                  Telephone
                </label>
                <input
                  id="business-telephone"
                  type="tel"
                  value={businessTelephone}
                  onChange={(e) => setBusinessTelephone(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="business-fax">
                  Fax {optionalTag}
                </label>
                <input
                  id="business-fax"
                  type="tel"
                  value={businessFax}
                  onChange={(e) => setBusinessFax(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="business-email">
                Email
              </label>
              <input
                id="business-email"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="h-px bg-afs-chrome-dim my-1" />
            <h3 className="font-label text-sm uppercase tracking-wide text-afs-chrome-high">Bank Reference</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="bank-name">
                  Bank Name
                </label>
                <input
                  id="bank-name"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="bank-phone">
                  Bank Phone
                </label>
                <input
                  id="bank-phone"
                  type="tel"
                  value={bankPhone}
                  onChange={(e) => setBankPhone(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="bank-address">
                  Bank Address
                </label>
                <input
                  id="bank-address"
                  type="text"
                  value={bankAddress}
                  onChange={(e) => setBankAddress(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="bank-csz">
                  City / State / ZIP
                </label>
                <input
                  id="bank-csz"
                  type="text"
                  value={bankCityStateZip}
                  onChange={(e) => setBankCityStateZip(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div>
              <span className={labelClass}>Account Numbers {optionalTag}</span>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  value={savingsAccountNumber}
                  onChange={(e) => setSavingsAccountNumber(e.target.value)}
                  placeholder="Savings"
                  className={`${inputClass} font-data`}
                />
                <input
                  type="text"
                  value={checkingAccountNumber}
                  onChange={(e) => setCheckingAccountNumber(e.target.value)}
                  placeholder="Checking"
                  className={`${inputClass} font-data`}
                />
                <input
                  type="text"
                  value={otherAccountNumber}
                  onChange={(e) => setOtherAccountNumber(e.target.value)}
                  placeholder="Other"
                  className={`${inputClass} font-data`}
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl text-afs-chrome-high">Business/Trade References</h2>
              <button type="button" onClick={addReference} className="font-label text-xs text-afs-crimson hover:text-afs-crimson-hover">
                + Add Reference
              </button>
            </div>
            <p className="font-body text-sm text-afs-chrome-mid -mt-2">Provide at least 3 suppliers or vendors you have an account with.</p>
            {tradeReferences.map((ref, index) => (
              <div key={index} className="border border-afs-chrome-dim rounded p-4" data-testid="trade-reference-row">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim">Reference {index + 1}</span>
                  {tradeReferences.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeReference(index)}
                      className="font-label text-xs text-afs-chrome-dim hover:text-afs-crimson"
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
                    placeholder="Company Name"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={ref.address}
                    onChange={(e) => updateReference(index, 'address', e.target.value)}
                    placeholder="Address"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={ref.cityStateZip}
                    onChange={(e) => updateReference(index, 'cityStateZip', e.target.value)}
                    placeholder="City / State / ZIP"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={ref.accountType}
                    onChange={(e) => updateReference(index, 'accountType', e.target.value)}
                    placeholder="Type of Account"
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
                    type="tel"
                    value={ref.fax}
                    onChange={(e) => updateReference(index, 'fax', e.target.value)}
                    placeholder="Fax (optional)"
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={ref.email}
                    onChange={(e) => updateReference(index, 'email', e.target.value)}
                    placeholder="Email"
                    className={`${inputClass} col-span-2`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Credit Request</h2>
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
                        ? 'border-afs-crimson bg-[var(--afs-crimson-ghost)] text-afs-chrome-high'
                        : 'border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface'
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

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Agreement</h2>
            <div className="bg-afs-bg-overlay border border-afs-border rounded p-4 max-h-80 overflow-y-auto">
              <p className="font-body text-xs text-afs-chrome-mid whitespace-pre-line leading-relaxed">{AGREEMENT_TEXT}</p>
            </div>
            <label className="flex items-start gap-3 font-body text-sm text-afs-chrome-mid mt-2">
              <input
                type="checkbox"
                checked={certificationAccepted}
                onChange={(e) => setCertificationAccepted(e.target.checked)}
                className="accent-afs-crimson mt-0.5"
                required
              />
              I have read and agree to the terms and conditions above, and I certify that the information provided in
              this application is true and accurate.
            </label>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-6">
            <h2 className="font-heading text-xl text-afs-chrome-high mb-1">Signatures</h2>
            {([
              { label: 'Signature 1', state: signerOne, setState: setSignerOne, idPrefix: 'signer-one' },
              { label: 'Signature 2', state: signerTwo, setState: setSignerTwo, idPrefix: 'signer-two' },
            ] as const).map(({ label, state, setState, idPrefix }) => (
              <div key={idPrefix} className="border border-afs-chrome-dim rounded p-4 flex flex-col gap-3">
                <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim">{label}</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor={`${idPrefix}-name`}>
                      Name
                    </label>
                    <input
                      id={`${idPrefix}-name`}
                      type="text"
                      value={state.name}
                      onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`${idPrefix}-title`}>
                      Title
                    </label>
                    <input
                      id={`${idPrefix}-title`}
                      type="text"
                      value={state.title}
                      onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
                      className={inputClass}
                      placeholder="Owner, CFO, Controller…"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor={`${idPrefix}-signature`}>
                    Type Full Name to Sign
                  </label>
                  <input
                    id={`${idPrefix}-signature`}
                    type="text"
                    value={state.signatureTyped}
                    onChange={(e) => setState((s) => ({ ...s, signatureTyped: e.target.value }))}
                    className={`${inputClass} italic`}
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="font-body text-xs text-afs-crimson mt-4">{error}</p>}

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-afs-chrome-dim">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 1}
            className="border border-afs-border text-afs-chrome-mid hover:bg-afs-bg-surface font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          {step < STEP_LABELS.length ? (
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
