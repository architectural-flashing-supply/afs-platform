'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MATERIAL_STOCK_STATUS } from '@/lib/data/catalog';
import MaterialRecommendationPanel from '@/components/quote/MaterialRecommendationPanel';
import WasteFactorDisplay from '@/components/quote/WasteFactorDisplay';
import TrimLengthOptimizerSection from '@/components/quote/TrimLengthOptimizerSection';
import CrossSellPanel from '@/components/ai/CrossSellPanel';
import {
  getProfileStockLengths,
  resolveStockLengthByQuoteLabel,
  type ProfileStockLength,
} from '@/lib/data/product-profiles';

type Step = 1 | 2 | 3 | 4;
type SubmitState = 'idle' | 'submitting' | 'submitted';

interface QuoteFormData {
  profileType:     string;
  material:        string;
  gauge:           string;
  width:           string;
  height:          string;
  legA:            string;
  legB:            string;
  lengthFt:        string;
  quantity:        string;
  projectName:     string;
  jobsiteAddress:  string;
  poNumber:        string;
  rush:            boolean;
  notes:           string;
}

const EMPTY_FORM: QuoteFormData = {
  profileType:    '',
  material:       '',
  gauge:          '',
  width:          '',
  height:         '',
  legA:           '',
  legB:           '',
  lengthFt:       '',
  quantity:       '',
  projectName:    '',
  jobsiteAddress: '',
  poNumber:       '',
  rush:           false,
  notes:          '',
};

const PROFILE_TYPES = [
  'Coping Cap',
  'Base Flashing',
  'Counter Flashing',
  'Step Flashing',
  'Drip Edge',
  'Gravel Stop',
  'Fascia',
  'Valley Flashing',
  'Scupper',
  'Conductor Head',
  'Downspout',
  'Expansion Joint Cover',
  'Reglet',
  'Window / Door Flashing',
  'Wall Panel / Cladding',
  'Standing Seam Roofing Panel',
  'Custom Profile',
];

const MATERIALS = [
  'Galvanized Steel',
  'Galvanized Galvalume',
  'Copper',
  'Lead Coated Copper',
  'Anodized Aluminum',
  'Stainless Steel',
  'Zinc',
  'Kynar 500 (Painted Steel)',
  'Vintage Steel',
];

const GAUGES: Record<string, string[]> = {
  'Galvanized Steel':           ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Galvanized Galvalume':       ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Copper':                     ['16 oz', '20 oz'],
  'Lead Coated Copper':         ['16 oz', '18 ga'],
  'Anodized Aluminum':          ['0.032"', '0.040"', '0.050"', '0.063"', '18 ga'],
  'Stainless Steel':            ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Zinc':                       ['0.7mm', '0.8mm', '1.0mm', '1.5mm'],
  'Kynar 500 (Painted Steel)':  ['26 ga', '24 ga', '22 ga'],
  'Vintage Steel':              ['26 ga', '24 ga'],
};

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Profile' },
  { n: 2, label: 'Dimensions' },
  { n: 3, label: 'Project' },
  { n: 4, label: 'Review' },
];

interface QuoteRequestItemInput {
  profileType: string;
  material?: string | null;
  gauge?: string | null;
  width?: number | null;
  height?: number | null;
  legA?: number | null;
  legB?: number | null;
  lengthFt: number;
  quantity: number;
  unit?: string;
}

interface QuoteRequestSuccessResponse {
  requestId: string;
  requestNumber: string;
}

interface QuoteRequestErrorResponse {
  error: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toNumberOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isPositiveNumber(v: string): boolean {
  if (v.trim() === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function isValidOptionalPositive(v: string): boolean {
  if (v.trim() === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none';

const selectClass =
  'w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-4 py-3 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none';

const optionClass = 'bg-afs-bg-overlay text-afs-chrome-high';

const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block';

export default function QuotePage() {
  const [step, setStep]         = useState<Step>(1);
  const [form, setForm]         = useState<QuoteFormData>(EMPTY_FORM);
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [profileStockLengths, setProfileStockLengths] = useState<ProfileStockLength[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    getProfileStockLengths(supabase).then(setProfileStockLengths);
  }, []);

  const updateField = (field: Exclude<keyof QuoteFormData, 'rush'>, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectMaterial = (material: string) => {
    setForm(prev => ({ ...prev, material, gauge: '' }));
  };

  const toggleRush = () => {
    setForm(prev => ({ ...prev, rush: !prev.rush }));
  };

  const gaugeOptions = form.material ? GAUGES[form.material] ?? [] : [];

  const step1Valid = form.profileType !== '' && form.material !== '' && form.gauge !== '';
  const step2Valid =
    isPositiveNumber(form.lengthFt) &&
    isPositiveNumber(form.quantity) &&
    isValidOptionalPositive(form.width) &&
    isValidOptionalPositive(form.height) &&
    isValidOptionalPositive(form.legA) &&
    isValidOptionalPositive(form.legB);
  const step3Valid = form.projectName.trim() !== '' && form.jobsiteAddress.trim() !== '';

  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : true;

  const goNext = () => { if (canProceed && step < 4) setStep((step + 1) as Step); };
  const goBack = () => { if (step > 1) setStep((step - 1) as Step); };
  const goToStep = (s: Step) => setStep(s);

  const buildItems = useCallback((): QuoteRequestItemInput[] => {
    if (form.profileType.trim() === '' || form.material.trim() === '' || !isPositiveNumber(form.lengthFt)) {
      return [];
    }
    return [{
      profileType: form.profileType,
      material:    form.material,
      gauge:       form.gauge || null,
      width:       toNumberOrNull(form.width),
      height:      toNumberOrNull(form.height),
      legA:        toNumberOrNull(form.legA),
      legB:        toNumberOrNull(form.legB),
      lengthFt:    Number(form.lengthFt),
      quantity:    isPositiveNumber(form.quantity) ? Number(form.quantity) : 1,
      unit:        'LF',
    }];
  }, [form]);

  const submitQuoteRequest = useCallback(async (email?: string) => {
    const items = buildItems();
    if (items.length === 0) {
      setSubmitError('Add a profile type, material, and length before submitting.');
      return;
    }

    setSubmitError(null);
    setSubmitState('submitting');

    const notes = [
      form.projectName.trim() ? `Project: ${form.projectName.trim()}` : null,
      selectedAccessories.length > 0 ? `Requested accessories: ${selectedAccessories.join(', ')}` : null,
      form.notes.trim() || null,
    ].filter(Boolean).join('\n\n') || null;

    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          jobsiteAddress: form.jobsiteAddress.trim() || null,
          poNumber: form.poNumber.trim() || null,
          isRush: form.rush,
          notes,
          guestEmail: email,
        }),
      });
      const data = (await res.json()) as QuoteRequestSuccessResponse | QuoteRequestErrorResponse;
      if (!res.ok) {
        setSubmitError('error' in data ? data.error : 'Submission failed. Please try again.');
        setSubmitState('idle');
        return;
      }
      const success = data as QuoteRequestSuccessResponse;
      setRequestNumber(success.requestNumber);
      setShowEmailCapture(false);
      setSubmitState('submitted');
    } catch {
      setSubmitError('Submission failed. Please try again.');
      setSubmitState('idle');
    }
  }, [buildItems, form, selectedAccessories]);

  const handleSubmit = () => {
    if (buildItems().length === 0) {
      setSubmitError('Add a profile type, material, and length before submitting.');
      return;
    }
    if (isAuthenticated) {
      submitQuoteRequest();
    } else {
      setSubmitError(null);
      setShowEmailCapture(true);
    }
  };

  const handleGuestSubmit = () => {
    const trimmed = guestEmail.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setSubmitError('Enter a valid email address.');
      return;
    }
    submitQuoteRequest(trimmed);
  };

  const startOver = () => {
    setForm(EMPTY_FORM);
    setStep(1);
    setSubmitState('idle');
    setSubmitError(null);
    setRequestNumber(null);
    setShowEmailCapture(false);
    setGuestEmail('');
    setSelectedAccessories([]);
  };

  const dimensionSummary = [
    form.width ? `W: ${form.width}"` : null,
    form.height ? `H: ${form.height}"` : null,
    form.legA ? `Leg A: ${form.legA}"` : null,
    form.legB ? `Leg B: ${form.legB}"` : null,
  ].filter(Boolean).join('   ·   ');

  if (submitState === 'submitted') {
    return (
      <main className="min-h-screen bg-afs-bg-base py-16 px-6">
        <div className="max-w-lg mx-auto">
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded p-12 text-center">
            <div className="w-14 h-14 rounded-full border-2 border-afs-success flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-afs-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-heading text-3xl text-afs-chrome-high mb-3">Quote Request Submitted</h2>
            {requestNumber && (
              <p className="font-data text-sm text-afs-crimson mb-3">{requestNumber}</p>
            )}
            <p className="font-body text-sm text-afs-chrome-mid mb-8">
              We&apos;ve received your request
              {form.projectName ? (
                <>
                  {' '}for <span className="text-afs-chrome-high">{form.projectName}</span>
                </>
              ) : null}. Our team will follow up with a formal quote within 1–2 business days.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="/account/quotes"
                className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
              >
                View My Requests
              </a>
              <button
                onClick={startOver}
                className="border border-afs-border bg-afs-bg-overlay text-afs-chrome-high hover:bg-afs-bg-surface font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
              >
                Submit Another
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-afs-bg-base py-16 px-6">
      <div className="max-w-3xl mx-auto" style={{ backgroundColor: '#B8BEC8' }}>

        <div className="mb-10 text-center">
          <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-4">
            REQUEST A QUOTE
          </p>
          <h1 className="font-display text-6xl text-afs-crimson font-bold leading-none mb-4">
            BUILD YOUR QUOTE
          </h1>
          <p className="font-body text-black font-bold text-base max-w-xl mx-auto">
            Tell us what you need fabricated and we&apos;ll follow up with formal pricing.
          </p>
        </div>

        <div className="flex items-center justify-center mb-12 bg-afs-bg-raised rounded p-6">
          {STEPS.map((s, idx) => (
            <Fragment key={s.n}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-data text-sm border-2 ${
                    step === s.n
                      ? 'border-afs-crimson bg-afs-crimson text-white'
                      : step > s.n
                      ? 'border-afs-chrome-base bg-afs-bg-surface text-afs-chrome-high'
                      : 'border-afs-chrome-dim text-afs-chrome-dim'
                  }`}
                >
                  {step > s.n ? '✓' : s.n}
                </div>
                <span
                  className={`font-label text-xs uppercase tracking-wide ${
                    step >= s.n ? 'text-afs-chrome-high' : 'text-afs-chrome-dim'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-px w-14 md:w-24 mx-2 mb-6 ${
                    step > s.n ? 'bg-afs-chrome-base' : 'bg-afs-chrome-dim'
                  }`}
                />
              )}
            </Fragment>
          ))}
        </div>

        <div className="bg-afs-bg-overlay border border-afs-chrome-dim rounded p-8 md:p-10">

          {step === 1 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Profile &amp; Material</h2>

              <span className={labelClass}>Profile Type</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {PROFILE_TYPES.map(p => {
                  const active = form.profileType === p || hoveredProfile === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateField('profileType', p)}
                      onMouseEnter={() => setHoveredProfile(p)}
                      onMouseLeave={() => setHoveredProfile(null)}
                      className={`font-label text-sm px-4 py-3 rounded border text-left transition-colors ${active ? 'bg-afs-crimson text-white border-afs-crimson' : 'bg-afs-bg-overlay text-white border-afs-border'}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass} htmlFor="material">Material</label>
                  <select
                    id="material"
                    className={selectClass}
                    value={form.material}
                    onChange={(e) => selectMaterial(e.target.value)}
                  >
                    <option value="" disabled className={optionClass}>Select material</option>
                    {MATERIALS.map(m => <option key={m} value={m} className={optionClass}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="gauge">Gauge / Thickness</label>
                  <select
                    id="gauge"
                    className={selectClass}
                    value={form.gauge}
                    disabled={!form.material}
                    onChange={(e) => updateField('gauge', e.target.value)}
                  >
                    <option value="" disabled className={optionClass}>
                      {form.material ? 'Select gauge' : 'Select a material first'}
                    </option>
                    {gaugeOptions.map(g => <option key={g} value={g} className={optionClass}>{g}</option>)}
                  </select>
                </div>
              </div>

              {form.material && (
                <MaterialRecommendationPanel
                  material={form.material}
                  profileType={form.profileType}
                  stockStatus={MATERIAL_STOCK_STATUS[form.material] ?? 'fabricated'}
                  onSelectAlternative={selectMaterial}
                />
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Dimensions &amp; Quantity</h2>

              <p className="font-body text-xs text-afs-chrome-mid mb-6">
                Enter the dimensions in inches. Leave leg measurements blank if this profile is flat or
                single-plane.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className={labelClass} htmlFor="width">Width (in)</label>
                  <input id="width" type="number" min="0" step="0.0625" className={inputClass}
                    value={form.width} onChange={(e) => updateField('width', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="height">Height (in)</label>
                  <input id="height" type="number" min="0" step="0.0625" className={inputClass}
                    value={form.height} onChange={(e) => updateField('height', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="legA">Leg A (in)</label>
                  <input id="legA" type="number" min="0" step="0.0625" className={inputClass}
                    value={form.legA} onChange={(e) => updateField('legA', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="legB">Leg B (in)</label>
                  <input id="legB" type="number" min="0" step="0.0625" className={inputClass}
                    value={form.legB} onChange={(e) => updateField('legB', e.target.value)} placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass} htmlFor="lengthFt">Length (ft)</label>
                  <input id="lengthFt" type="number" min="0" step="0.5" className={inputClass}
                    value={form.lengthFt} onChange={(e) => updateField('lengthFt', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="quantity">Quantity</label>
                  <input id="quantity" type="number" min="1" step="1" className={inputClass}
                    value={form.quantity} onChange={(e) => updateField('quantity', e.target.value)} placeholder="1" />
                </div>
              </div>

              <WasteFactorDisplay
                lengthFt={isPositiveNumber(form.lengthFt) ? Number(form.lengthFt) : 0}
                quantity={isPositiveNumber(form.quantity) ? Number(form.quantity) : 0}
              />
              <TrimLengthOptimizerSection
                lengthFt={isPositiveNumber(form.lengthFt) ? Number(form.lengthFt) : 0}
                quantity={isPositiveNumber(form.quantity) ? Number(form.quantity) : 0}
                stockLengthFt={resolveStockLengthByQuoteLabel(profileStockLengths, form.profileType)}
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Project Details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className={labelClass} htmlFor="projectName">Project Name</label>
                  <input id="projectName" type="text" className={inputClass}
                    value={form.projectName} onChange={(e) => updateField('projectName', e.target.value)}
                    placeholder="e.g. Riverside Office Tower" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="poNumber">PO Number (optional)</label>
                  <input id="poNumber" type="text" className={inputClass}
                    value={form.poNumber} onChange={(e) => updateField('poNumber', e.target.value)}
                    placeholder="e.g. PO-10234" />
                </div>
              </div>

              <div className="mb-6">
                <label className={labelClass} htmlFor="jobsiteAddress">Jobsite Address</label>
                <textarea id="jobsiteAddress" rows={2} className={inputClass}
                  value={form.jobsiteAddress} onChange={(e) => updateField('jobsiteAddress', e.target.value)}
                  placeholder="Street address, city, state, ZIP" />
              </div>

              <div className="mb-6">
                <span className={labelClass}>Rush Order</span>
                <button
                  type="button"
                  onClick={toggleRush}
                  className={`flex items-center gap-3 border rounded px-4 py-3 transition-colors ${
                    form.rush ? 'bg-afs-crimson border-afs-crimson' : 'bg-afs-bg-surface border-afs-border hover:bg-afs-bg-overlay'
                  }`}
                >
                  <span
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      form.rush ? 'bg-afs-crimson' : 'bg-afs-bg-overlay border border-afs-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        form.rush ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                  <span className="font-label text-sm text-afs-chrome-high">
                    {form.rush ? 'Rush requested' : 'Standard timeline'}
                  </span>
                </button>
              </div>

              <div>
                <label className={labelClass} htmlFor="notes">Notes (optional)</label>
                <textarea id="notes" rows={4} className={inputClass}
                  value={form.notes} onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Anything else we should know about this project?" />
              </div>

              <CrossSellPanel
                profileTypes={[form.profileType].filter(Boolean)}
                materials={[form.material].filter(Boolean)}
                onSelectionChange={setSelectedAccessories}
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Review Your Request</h2>

              <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded overflow-hidden mb-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-afs-chrome-dim">
                  <span className="font-heading text-sm text-afs-chrome-mid uppercase tracking-wide">
                    Profile Specification
                  </span>
                  <button onClick={() => goToStep(1)} className="font-body text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors">
                    Edit
                  </button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3 w-40">Profile Type</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.profileType}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Material</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.material}</td>
                    </tr>
                    <tr>
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Gauge / Thickness</td>
                      <td className="font-data text-afs-chrome-high px-4 py-3">{form.gauge}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded overflow-hidden mb-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-afs-chrome-dim">
                  <span className="font-heading text-sm text-afs-chrome-mid uppercase tracking-wide">
                    Dimensions &amp; Quantity
                  </span>
                  <button onClick={() => goToStep(2)} className="font-body text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors">
                    Edit
                  </button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3 w-40">Dimensions</td>
                      <td className="font-data text-afs-chrome-high px-4 py-3">{dimensionSummary || '—'}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Length</td>
                      <td className="font-data text-afs-chrome-high px-4 py-3">{form.lengthFt} ft</td>
                    </tr>
                    <tr>
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Quantity</td>
                      <td className="font-data text-afs-chrome-high px-4 py-3">{form.quantity}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded overflow-hidden mb-8">
                <div className="flex items-center justify-between px-4 py-3 border-b border-afs-chrome-dim">
                  <span className="font-heading text-sm text-afs-chrome-mid uppercase tracking-wide">
                    Project Details
                  </span>
                  <button onClick={() => goToStep(3)} className="font-body text-xs text-afs-chrome-mid hover:text-afs-crimson transition-colors">
                    Edit
                  </button>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3 w-40">Project Name</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.projectName}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Jobsite Address</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3 whitespace-pre-line">{form.jobsiteAddress}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">PO Number</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.poNumber || '—'}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Rush</td>
                      <td className="px-4 py-3">
                        <span className={`font-label text-xs border px-2 py-0.5 rounded ${
                          form.rush ? 'text-afs-crimson border-afs-crimson' : 'text-afs-chrome-mid border-afs-chrome-dim'
                        }`}>
                          {form.rush ? 'RUSH REQUESTED' : 'STANDARD'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Notes</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3 whitespace-pre-line">{form.notes || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="font-body text-xs text-afs-chrome-mid mb-2">
                Pricing is not shown here — our team will follow up with a formal quote.
              </p>

              {showEmailCapture && (
                <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-6 mt-6">
                  <label className={labelClass} htmlFor="guestEmail">Email Address</label>
                  <p className="font-body text-xs text-afs-chrome-mid mb-3">
                    Sign in for full account access, or submit this request as a guest with your email.
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <input
                      id="guestEmail"
                      type="email"
                      className={`${inputClass} flex-1 min-w-[240px]`}
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <button
                      type="button"
                      onClick={handleGuestSubmit}
                      disabled={submitState === 'submitting'}
                      className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {submitState === 'submitting' ? 'Submitting…' : 'Submit as Guest'}
                    </button>
                  </div>
                </div>
              )}

              {submitError && (
                <p className="font-body text-sm text-afs-crimson mt-4">{submitError}</p>
              )}
            </div>
          )}

        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={goBack}
            disabled={step === 1}
            className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitState === 'submitting' || showEmailCapture}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitState === 'submitting' ? 'Submitting…' : 'Submit Quote Request'}
            </button>
          )}
        </div>

      </div>
    </main>
  );
}
