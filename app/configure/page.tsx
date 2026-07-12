'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { generateProfileSVG, type ProfileType } from '@/lib/utils/profile-svg';

type SubmitState = 'idle' | 'submitting' | 'submitted';
type DimField = 'width' | 'height' | 'legA' | 'legB';

interface ConfiguratorForm {
  material: string;
  gauge: string;
  width: string;
  height: string;
  legA: string;
  legB: string;
  lengthFt: string;
  quantity: string;
  notes: string;
}

interface QueuedItem {
  key: string;
  profileType: ProfileType;
  material: string;
  gauge: string;
  width: number | null;
  height: number | null;
  legA: number | null;
  legB: number | null;
  lengthFt: number;
  quantity: number;
}

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

const EMPTY_FORM: ConfiguratorForm = {
  material: '',
  gauge: '',
  width: '',
  height: '',
  legA: '',
  legB: '',
  lengthFt: '',
  quantity: '1',
  notes: '',
};

const PROFILE_OPTIONS: { value: ProfileType; label: string }[] = [
  { value: 'coping-cap', label: 'Coping Cap' },
  { value: 'base-flashing', label: 'Base Flashing' },
  { value: 'drip-edge', label: 'Drip Edge' },
  { value: 'gravel-stop', label: 'Gravel Stop' },
  { value: 'fascia', label: 'Fascia' },
];

const PROFILE_DIMS: Record<ProfileType, DimField[]> = {
  'coping-cap': ['width', 'height', 'legA', 'legB'],
  'base-flashing': ['height', 'legA', 'legB'],
  'drip-edge': ['legA', 'legB'],
  'gravel-stop': ['height', 'legA'],
  fascia: ['height', 'legA'],
};

const DIM_LABELS: Record<DimField, string> = {
  width: 'Width (W)',
  height: 'Height (H)',
  legA: 'Leg A',
  legB: 'Leg B',
};

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
  'Galvanized Steel':          ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Galvanized Galvalume':      ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Copper':                    ['16 oz', '20 oz'],
  'Lead Coated Copper':        ['16 oz', '18 ga'],
  'Anodized Aluminum':         ['0.032"', '0.040"', '0.050"', '0.063"', '18 ga'],
  'Stainless Steel':           ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
  'Zinc':                      ['0.7mm', '0.8mm', '1.0mm', '1.5mm'],
  'Kynar 500 (Painted Steel)': ['26 ga', '24 ga', '22 ga'],
  'Vintage Steel':             ['26 ga', '24 ga'],
};

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
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-body text-sm text-afs-ink-900 placeholder:text-afs-ink-700 focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-40 disabled:pointer-events-none';

const dataInputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-3 py-2.5 font-data text-sm text-afs-ink-900 placeholder:text-afs-ink-700 focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-40 disabled:pointer-events-none';

const selectClass =
  'w-full bg-afs-bg-overlay text-afs-ink-900 border border-afs-border rounded px-3 py-2.5 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-40 disabled:pointer-events-none';

const optionClass = 'bg-afs-bg-overlay text-afs-ink-900';

const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-ink-700 mb-1.5 block';

export default function ConfiguratorPage() {
  const [profileType, setProfileType] = useState<ProfileType | ''>('');
  const [form, setForm] = useState<ConfiguratorForm>(EMPTY_FORM);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedItem[]>([]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  const activeDims = useMemo(
    () => (profileType ? PROFILE_DIMS[profileType] : []),
    [profileType]
  );

  useEffect(() => {
    if (!profileType) {
      setSvgMarkup(null);
      return;
    }
    const handle = setTimeout(() => {
      setSvgMarkup(
        generateProfileSVG({
          profileType,
          width: activeDims.includes('width') ? toNumberOrNull(form.width) : null,
          height: activeDims.includes('height') ? toNumberOrNull(form.height) : null,
          legA: activeDims.includes('legA') ? toNumberOrNull(form.legA) : null,
          legB: activeDims.includes('legB') ? toNumberOrNull(form.legB) : null,
        })
      );
    }, 150);
    return () => clearTimeout(handle);
  }, [profileType, form.width, form.height, form.legA, form.legB, activeDims]);

  const selectProfile = (p: ProfileType) => {
    setProfileType(p);
    setForm(prev => ({ ...prev, width: '', height: '', legA: '', legB: '' }));
  };

  const updateField = (field: keyof ConfiguratorForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const selectMaterial = (material: string) => {
    setForm(prev => ({ ...prev, material, gauge: '' }));
  };

  const gaugeOptions = form.material ? GAUGES[form.material] ?? [] : [];

  const currentItemValid =
    profileType !== '' &&
    form.material !== '' &&
    form.gauge !== '' &&
    isPositiveNumber(form.lengthFt) &&
    isPositiveNumber(form.quantity) &&
    isValidOptionalPositive(form.width) &&
    isValidOptionalPositive(form.height) &&
    isValidOptionalPositive(form.legA) &&
    isValidOptionalPositive(form.legB);

  const buildCurrentItem = useCallback((): QueuedItem | null => {
    if (!currentItemValid || !profileType) return null;
    return {
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      profileType,
      material: form.material,
      gauge: form.gauge,
      width: activeDims.includes('width') ? toNumberOrNull(form.width) : null,
      height: activeDims.includes('height') ? toNumberOrNull(form.height) : null,
      legA: activeDims.includes('legA') ? toNumberOrNull(form.legA) : null,
      legB: activeDims.includes('legB') ? toNumberOrNull(form.legB) : null,
      lengthFt: Number(form.lengthFt),
      quantity: Number(form.quantity),
    };
  }, [currentItemValid, profileType, form, activeDims]);

  const addToQuoteRequest = () => {
    const item = buildCurrentItem();
    if (!item) {
      setSubmitError('Complete the profile, material, gauge, and length before adding.');
      return;
    }
    setSubmitError(null);
    setQueue(prev => [...prev, item]);
    setForm(prev => ({ ...prev, width: '', height: '', legA: '', legB: '', lengthFt: '', quantity: '1' }));
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  const removeQueuedItem = (key: string) => {
    setQueue(prev => prev.filter(i => i.key !== key));
  };

  const allItemsForSubmit = useCallback((): QuoteRequestItemInput[] => {
    const items: QuoteRequestItemInput[] = queue.map(i => ({
      profileType: PROFILE_OPTIONS.find(p => p.value === i.profileType)?.label ?? i.profileType,
      material: i.material,
      gauge: i.gauge,
      width: i.width,
      height: i.height,
      legA: i.legA,
      legB: i.legB,
      lengthFt: i.lengthFt,
      quantity: i.quantity,
      unit: 'LF',
    }));
    const current = buildCurrentItem();
    if (current) {
      items.push({
        profileType: PROFILE_OPTIONS.find(p => p.value === current.profileType)?.label ?? current.profileType,
        material: current.material,
        gauge: current.gauge,
        width: current.width,
        height: current.height,
        legA: current.legA,
        legB: current.legB,
        lengthFt: current.lengthFt,
        quantity: current.quantity,
        unit: 'LF',
      });
    }
    return items;
  }, [queue, buildCurrentItem]);

  const submitQuoteRequest = useCallback(async (email?: string) => {
    const items = allItemsForSubmit();
    if (items.length === 0) {
      setSubmitError('Configure at least one profile before submitting.');
      return;
    }

    setSubmitError(null);
    setSubmitState('submitting');

    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          notes: form.notes.trim() || null,
          isRush: false,
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
  }, [allItemsForSubmit, form.notes]);

  const handleSubmit = () => {
    if (allItemsForSubmit().length === 0) {
      setSubmitError('Configure at least one profile before submitting.');
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
    setProfileType('');
    setForm(EMPTY_FORM);
    setQueue([]);
    setSvgMarkup(null);
    setSubmitState('idle');
    setSubmitError(null);
    setRequestNumber(null);
    setShowEmailCapture(false);
    setGuestEmail('');
  };

  const specSummary = useMemo(() => {
    if (!profileType) return null;
    const label = PROFILE_OPTIONS.find(p => p.value === profileType)?.label ?? profileType;
    const dims = activeDims
      .map(d => {
        const raw = form[d];
        return raw ? `${DIM_LABELS[d].split(' ')[0].toUpperCase()}: ${raw}"` : null;
      })
      .filter(Boolean)
      .join('   ·   ');
    return {
      label,
      material: form.material || '—',
      gauge: form.gauge || '—',
      dims: dims || '—',
      lengthFt: form.lengthFt || '—',
      quantity: form.quantity || '—',
    };
  }, [profileType, activeDims, form]);

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
            <h2 className="font-heading text-3xl text-afs-ink-900 mb-3">Quote Request Submitted</h2>
            {requestNumber && (
              <p className="font-data text-sm text-afs-crimson mb-3">{requestNumber}</p>
            )}
            <p className="font-body text-sm text-afs-ink-700 mb-8">
              AFS will review your custom specification and follow up with a formal quote.
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
                className="border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
              >
                Configure Another
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-afs-bg-base">
      <div className="px-6 pt-10 pb-4 text-center">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">
          CUSTOM FLASHING CONFIGURATOR
        </p>
        <h1 className="font-display text-5xl text-afs-ink-900 leading-none mb-2">
          CONFIGURE YOUR PROFILE
        </h1>
        <p className="font-body text-afs-ink-700 text-sm max-w-xl mx-auto">
          Specify exact dimensions and see a live diagram update as you type. No prices shown —
          AFS follows up with a formal quote.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-6 pb-10 max-w-[1400px] mx-auto">

        {/* LEFT — CONTROLS */}
        <div className="w-full lg:w-[420px] lg:shrink-0 bg-afs-bg-raised border border-afs-chrome-dim rounded p-6">

          <span className={labelClass}>Profile Type</span>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {PROFILE_OPTIONS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => selectProfile(p.value)}
                className={`font-label text-sm px-3 py-2.5 rounded border text-left transition-colors ${
                  profileType === p.value
                    ? 'bg-afs-crimson text-white border-afs-crimson'
                    : 'bg-afs-bg-overlay text-afs-ink-900 border-afs-border'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className={labelClass} htmlFor="material">Material</label>
              <select
                id="material"
                className={selectClass}
                value={form.material}
                onChange={(e) => selectMaterial(e.target.value)}
              >
                <option value="" disabled className={optionClass}>Select</option>
                {MATERIALS.map(m => <option key={m} value={m} className={optionClass}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="gauge">Gauge</label>
              <select
                id="gauge"
                className={selectClass}
                value={form.gauge}
                disabled={!form.material}
                onChange={(e) => updateField('gauge', e.target.value)}
              >
                <option value="" disabled className={optionClass}>
                  {form.material ? 'Select' : '—'}
                </option>
                {gaugeOptions.map(g => <option key={g} value={g} className={optionClass}>{g}</option>)}
              </select>
            </div>
          </div>

          <span className={labelClass}>Dimensions (inches)</span>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {(['width', 'height', 'legA', 'legB'] as DimField[]).map(dim => {
              const active = activeDims.includes(dim);
              return (
                <div key={dim}>
                  <label className={labelClass} htmlFor={dim}>{DIM_LABELS[dim]}</label>
                  <input
                    id={dim}
                    type="number"
                    min="0"
                    step="0.0625"
                    className={dataInputClass}
                    value={form[dim]}
                    disabled={!profileType || !active}
                    onChange={(e) => updateField(dim, e.target.value)}
                    placeholder={active ? '0.0000' : 'n/a'}
                  />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className={labelClass} htmlFor="lengthFt">Length (ft)</label>
              <input id="lengthFt" type="number" min="0" step="0.5" className={dataInputClass}
                value={form.lengthFt} onChange={(e) => updateField('lengthFt', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={labelClass} htmlFor="quantity">Quantity</label>
              <input id="quantity" type="number" min="1" step="1" className={dataInputClass}
                value={form.quantity} onChange={(e) => updateField('quantity', e.target.value)} placeholder="1" />
            </div>
          </div>

          <div className="mb-6">
            <label className={labelClass} htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" rows={3} className={inputClass}
              value={form.notes} onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Anything else we should know?" />
          </div>

          {queue.length > 0 && (
            <div className="mb-6 bg-afs-bg-surface border border-afs-chrome-dim rounded overflow-hidden">
              <div className="px-3 py-2 border-b border-afs-chrome-dim">
                <span className="font-label text-xs uppercase tracking-wide text-afs-ink-700">
                  Quote Items ({queue.length})
                </span>
              </div>
              <ul>
                {queue.map(item => (
                  <li key={item.key} className="flex items-center justify-between px-3 py-2 border-b border-afs-chrome-dim last:border-b-0">
                    <span className="font-body text-xs text-afs-ink-900">
                      {PROFILE_OPTIONS.find(p => p.value === item.profileType)?.label} — {item.material}, {item.lengthFt} ft × {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeQueuedItem(item.key)}
                      className="font-body text-xs text-afs-ink-700 hover:text-afs-crimson transition-colors ml-2 shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {submitError && (
            <p className="font-body text-sm text-afs-crimson mb-4">{submitError}</p>
          )}

          {addedNotice && (
            <p className="font-body text-sm text-afs-success mb-4">Added to your quote request.</p>
          )}

          {showEmailCapture && (
            <div className="bg-afs-bg-surface border border-afs-chrome-dim rounded p-4 mb-4">
              <label className={labelClass} htmlFor="guestEmail">Email Address</label>
              <p className="font-body text-xs text-afs-ink-700 mb-3">
                Sign in for full account access, or submit as a guest with your email.
              </p>
              <div className="flex gap-2 flex-wrap">
                <input
                  id="guestEmail"
                  type="email"
                  className={`${inputClass} flex-1 min-w-[180px]`}
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  onClick={handleGuestSubmit}
                  disabled={submitState === 'submitting'}
                  className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitState === 'submitting' ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitState === 'submitting' || showEmailCapture}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitState === 'submitting' ? 'Submitting…' : 'Submit for Quote'}
            </button>
            <button
              type="button"
              onClick={addToQuoteRequest}
              disabled={!currentItemValid || submitState === 'submitting'}
              className="border border-afs-border bg-afs-bg-overlay text-afs-ink-900 hover:bg-afs-bg-surface font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Add to Quote Request
            </button>
            <button
              type="button"
              onClick={startOver}
              disabled={submitState === 'submitting'}
              className="font-label text-sm text-afs-ink-700 hover:text-afs-crimson transition-colors px-6 py-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              Start Over
            </button>
          </div>
        </div>

        {/* RIGHT — PREVIEW */}
        <div className="flex-1 min-w-0">
          <div className="bg-afs-bg-raised border border-afs-chrome-dim rounded metal-edge p-6 min-h-[440px] flex items-center justify-center">
            {svgMarkup ? (
              <div
                className="w-full max-w-[440px] aspect-square"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
            ) : (
              <div className="text-center px-6">
                <p className="font-heading text-xl text-afs-ink-700 mb-2">
                  Select a Profile Type
                </p>
                <p className="font-body text-sm text-afs-ink-700 max-w-xs mx-auto">
                  Choose a profile from the left to see a live diagram update as you enter dimensions.
                </p>
              </div>
            )}
          </div>

          {specSummary && (
            <div className="mt-4 bg-afs-bg-surface border border-afs-chrome-dim rounded p-5">
              <span className="font-label text-xs uppercase tracking-wide text-afs-ink-700 block mb-3">
                Spec Summary
              </span>
              <div className="font-data text-sm text-afs-ink-900 space-y-1.5">
                <p>{specSummary.label.toUpperCase()}</p>
                <p className="text-afs-ink-700">{specSummary.material} — {specSummary.gauge}</p>
                <p className="text-afs-crimson">{specSummary.dims}</p>
                <p className="text-afs-ink-700">{specSummary.lengthFt} FT × QTY {specSummary.quantity}</p>
              </div>
            </div>
          )}

          <p className="font-body text-xs text-afs-ink-700 mt-4 text-center">
            Estimated CAD preview — for reference only. No prices shown here; AFS delivers a
            formal quote after review.
          </p>
        </div>
      </div>
    </main>
  );
}
