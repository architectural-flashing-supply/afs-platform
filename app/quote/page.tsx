'use client';

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MATERIAL_STOCK_STATUS } from '@/lib/data/catalog';
import {
  colorPaletteForMaterial,
  requiresFinishChoice,
  isColorRequirementSatisfied,
  colorRequirementErrorMessage,
  type AluminumFinish,
} from '@/lib/data/material-color-requirement';
import MaterialRecommendationPanel from '@/components/quote/MaterialRecommendationPanel';
import ColorField from '@/components/quote/ColorField';
import FinishColorField from '@/components/quote/FinishColorField';
import WasteFactorDisplay from '@/components/quote/WasteFactorDisplay';
import TrimLengthOptimizerSection from '@/components/quote/TrimLengthOptimizerSection';
import CrossSellPanel from '@/components/ai/CrossSellPanel';
import {
  constraintsForQuoteLabels,
  getProfileConstraints,
  getProfileStockLengths,
  resolveStockLengthByQuoteLabel,
  type ProfileStockLength,
} from '@/lib/data/product-profiles';
// THE ORDER VALIDATOR (SPEC_AI_ORDER_VALIDATOR.md). The same pure engine runs
// here, live as the customer types, and again server-side at Step 2 -> Next and
// on submit — so the three can never disagree about the same dimensions. The
// client half is instant and needs no request; the server half is authoritative
// and is the only one that can read the catalog's dimension ranges for a GUEST,
// whose session cannot pass product_profiles' RLS.
import {
  findingsForAudience,
  validateOrder,
  worstFindingForField,
  type ProfileConstraints,
  type ValidationField,
} from '@/lib/order-validator';
import type { ValidationMessage, ValidationResponse } from '@/lib/order-validator/api-shape';
import {
  FieldValidationMessage,
  ValidationErrorBanner,
  ValidationInfoNotes,
  ValidationWarningBanner,
  fieldBorderClass,
} from '@/components/quote/OrderValidationMessages';

type Step = 1 | 2 | 3 | 4;
type SubmitState = 'idle' | 'submitting' | 'submitted';

interface QuoteFormData {
  profileType:     string;
  material:        string;
  gauge:           string;
  color:           string;
  finish:          AluminumFinish | '';
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
  // Job-identity intake fields (migration 018, afs-jf-000) — all optional,
  // never block submit (afs-jf-003). clientBusinessName/clientName/
  // requestedBy are new here; poNumber above already existed.
  clientBusinessName: string;
  clientName:         string;
  requestedBy:        string;
}

const EMPTY_FORM: QuoteFormData = {
  profileType:    '',
  material:       '',
  gauge:          '',
  color:          '',
  finish:         '',
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
  clientBusinessName: '',
  clientName:         '',
  requestedBy:        '',
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
  'Galvalume',
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
  'Galvalume':                 ['26 ga', '24 ga', '22 ga', '20 ga', '18 ga'],
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
  /**
   * The server-side validator's view of what was accepted. Optional because the
   * field is additive on a route that has always answered without it — see
   * app/api/quote-requests/route.ts. Errors are deliberately not included: by
   * this point the submission is in, and an impossible dimension printed on a
   * confirmation screen is not something the customer can act on.
   */
  validation?: {
    counts: { error: number; warn: number; info: number };
    notes: { field: string; message: string }[];
  };
}

/** Every step-2 input, so an edit to any of them can clear an acknowledgement. */
const STEP_2_FIELDS: readonly (keyof QuoteFormData)[] = [
  'width',
  'height',
  'legA',
  'legB',
  'lengthFt',
  'quantity',
];

/**
 * The four dimension inputs the validator decorates individually, and their
 * labels. These are the only fields a customer can both see and fix from step 2,
 * which is why they are also the only ones that gate Next locally.
 */
const DECORATED_FIELDS = ['width', 'height', 'legA', 'legB'] as const;
type DecoratedField = (typeof DECORATED_FIELDS)[number];
const DECORATED_FIELD_LABELS: Record<DecoratedField, string> = {
  width: 'Width (in)',
  height: 'Height (in)',
  legA: 'Leg A (in)',
  legB: 'Leg B (in)',
};

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

  // --- Order validator state (SPEC_AI_ORDER_VALIDATOR.md §5) ---
  const [profileConstraints, setProfileConstraints] = useState<ProfileConstraints[]>([]);
  const [serverValidation, setServerValidation] = useState<ValidationResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  // Acknowledged warnings, keyed by their own message. The spec requires each
  // warning to be acknowledged explicitly; keying by message means an
  // acknowledgement cannot survive a change to the wording it referred to.
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [submitValidation, setSubmitValidation] =
    useState<QuoteRequestSuccessResponse['validation']>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    getProfileStockLengths(supabase).then(setProfileStockLengths);
  }, []);

  // The dimension ranges, for the live per-keystroke pass. A GUEST gets none of
  // these — `product_profiles` RLS is `auth.uid() IS NOT NULL` — and that is
  // handled rather than worked around: the engine simply does not run its range
  // rules without them, and the server pass at Next catches a range violation
  // for everyone. Failing silently to an empty list is correct here; the
  // alternative is a page that cannot render because a reference table did not
  // answer.
  useEffect(() => {
    const supabase = createClient();
    getProfileConstraints(supabase)
      .then(setProfileConstraints)
      .catch(() => setProfileConstraints([]));
  }, []);

  const updateField = (field: Exclude<keyof QuoteFormData, 'rush'>, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // AN EDIT INVALIDATES WHAT WAS ACKNOWLEDGED AND WHAT THE SERVER SAID.
    // Without this, a customer could accept "a 24 inch span in 26 ga is at the
    // limit", change the width to 40 inches, and walk past a warning about the
    // new number that they never saw.
    if (STEP_2_FIELDS.includes(field)) {
      setAcknowledged([]);
      setServerValidation(null);
    }
  };

  const isAluminum = form.material ? requiresFinishChoice(form.material) : false;
  const colorPalette = form.material ? colorPaletteForMaterial(form.material, form.finish || null) : null;

  const selectMaterial = (material: string) => {
    setForm(prev => ({ ...prev, material, gauge: '', color: '', finish: '' }));
  };

  const toggleRush = () => {
    setForm(prev => ({ ...prev, rush: !prev.rush }));
  };

  const gaugeOptions = form.material ? GAUGES[form.material] ?? [] : [];

  const colorSatisfied = isColorRequirementSatisfied(form.material, form.finish || null, form.color);
  const step1Valid = form.profileType !== '' && form.material !== '' && form.gauge !== '' && colorSatisfied;
  const step2Valid =
    isPositiveNumber(form.lengthFt) &&
    isPositiveNumber(form.quantity) &&
    isValidOptionalPositive(form.width) &&
    isValidOptionalPositive(form.height) &&
    isValidOptionalPositive(form.legA) &&
    isValidOptionalPositive(form.legB);
  const step3Valid = form.projectName.trim() !== '' && form.jobsiteAddress.trim() !== '';

  // --- The live validator pass ---
  // One item, built from the form exactly as it stands, including blanks: the
  // engine treats an absent dimension as absent rather than as zero, which is
  // what lets it report on a half-filled form without inventing failures.
  const liveFindings = useMemo(() => {
    const constraints = [
      ...profileConstraints,
      ...constraintsForQuoteLabels(profileConstraints, form.profileType ? [form.profileType] : []),
    ];
    const result = validateOrder({
      items: [
        {
          profileType: form.profileType || null,
          material: form.material || null,
          gauge: form.gauge || null,
          width: toNumberOrNull(form.width),
          height: toNumberOrNull(form.height),
          legA: toNumberOrNull(form.legA),
          legB: toNumberOrNull(form.legB),
          lengthFt: toNumberOrNull(form.lengthFt),
          quantity: toNumberOrNull(form.quantity),
        },
      ],
      constraints,
    });
    return findingsForAudience(result.findings, 'customer');
  }, [form, profileConstraints]);

  /** The live message for one input, or null. Errors outrank warnings. */
  const fieldFinding = (field: ValidationField): ValidationMessage | null => {
    const found = worstFindingForField(liveFindings, 0, field);
    if (!found) return null;
    return {
      field: found.field,
      severity: found.severity,
      message: found.message,
      itemIndex: found.itemIndex,
      fromAi: false,
    };
  };

  // Only the four decorated dimension inputs gate Next locally. A customer
  // cannot see or fix anything else from this step, and disabling Next over a
  // message that is not on screen is how a form becomes unexplainable.
  const liveStep2Blocked = DECORATED_FIELDS.some(
    (field) => worstFindingForField(liveFindings, 0, field)?.severity === 'error'
  );

  const outstandingWarnings = (serverValidation?.warnings ?? []).filter(
    (warning) => !acknowledged.includes(warning.message)
  );
  const serverErrors = serverValidation?.errors ?? [];

  const canProceed =
    step === 1
      ? step1Valid
      : step === 2
        ? step2Valid && !liveStep2Blocked && !isChecking
        : step === 3
          ? step3Valid
          : true;

  /**
   * SPEC §5's Step 2 -> Next gate.
   *
   * 1. The live pass has already blocked a dimension error (canProceed above).
   * 2. The server pass is authoritative — "do not trust client", and it is the
   *    only one that can read the dimension ranges for a guest.
   * 3. Errors block. Warnings need an explicit acknowledgement. Neither
   *    advances.
   *
   * IF THE CHECK ITSELF FAILS, THE CUSTOMER ADVANCES. A network error, a
   * non-OK response or an unreadable body all fall through to the next step: the
   * submit route runs the same engine server-side anyway, and a validator that
   * is down must not trap a customer on step 2 with no way forward.
   */
  const runServerCheck = async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/quote-requests/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              profileType: form.profileType || null,
              material: form.material || null,
              gauge: form.gauge || null,
              width: toNumberOrNull(form.width),
              height: toNumberOrNull(form.height),
              legA: toNumberOrNull(form.legA),
              legB: toNumberOrNull(form.legB),
              lengthFt: toNumberOrNull(form.lengthFt),
              quantity: toNumberOrNull(form.quantity),
            },
          ],
        }),
      });
      if (!res.ok) return true;
      const data = (await res.json()) as ValidationResponse;
      if (!Array.isArray(data.errors) || !Array.isArray(data.warnings)) return true;
      setServerValidation(data);
      return data.errors.length === 0 && data.warnings.length === 0;
    } catch {
      return true;
    } finally {
      setIsChecking(false);
    }
  };

  const goNext = async () => {
    if (!canProceed || step >= 4) return;
    if (step === 2) {
      // An already-acknowledged set of warnings must not be re-fetched and
      // re-shown: the customer has answered them, and the acknowledgement is
      // cleared the moment any step-2 field changes.
      const alreadyCleared =
        serverValidation !== null && serverErrors.length === 0 && outstandingWarnings.length === 0;
      if (!alreadyCleared) {
        const clear = await runServerCheck();
        if (!clear) return;
      }
    }
    setStep((step + 1) as Step);
  };
  const goBack = () => { if (step > 1) setStep((step - 1) as Step); };
  const goToStep = (s: Step) => setStep(s);

  const acknowledgeWarnings = () => {
    setAcknowledged((prev) => [...prev, ...outstandingWarnings.map((warning) => warning.message)]);
  };

  /** SPEC §5: "[Revise Dimensions] — returns focus to the relevant input". */
  const focusField = (field: ValidationField) => {
    if (typeof document === 'undefined') return;
    const input = document.getElementById(field);
    if (input instanceof HTMLElement) {
      input.focus();
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

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
    if (!colorSatisfied) {
      setSubmitError(colorRequirementErrorMessage(form.material, form.finish || null));
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
          clientBusinessName: form.clientBusinessName.trim() || null,
          clientName: form.clientName.trim() || null,
          requestedBy: form.requestedBy.trim() || null,
          isRush: form.rush,
          notes,
          color: form.color.trim() || null,
          finish: isAluminum ? (form.finish || null) : null,
          guestEmail: email,
          sourceTool: 'afs-quote-builder',
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
      // The authoritative server-side pass over what was actually stored. Shown
      // on the confirmation screen so a customer is told plainly that AFS will
      // be in touch about the points it raised, rather than finding out in a
      // phone call days later.
      setSubmitValidation(success.validation);
      setShowEmailCapture(false);
      setSubmitState('submitted');
    } catch {
      setSubmitError('Submission failed. Please try again.');
      setSubmitState('idle');
    }
  }, [buildItems, form, selectedAccessories, colorSatisfied, isAluminum]);

  const handleSubmit = () => {
    if (buildItems().length === 0) {
      setSubmitError('Add a profile type, material, and length before submitting.');
      return;
    }
    if (!colorSatisfied) {
      setSubmitError(colorRequirementErrorMessage(form.material, form.finish || null));
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
    setServerValidation(null);
    setAcknowledged([]);
    setSubmitValidation(undefined);
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

            {/*
              What the server-side validator raised about the request that was
              just stored. Warnings and notes only — an error is not shown here
              because the submission has already been accepted and there is
              nothing the customer can do about it from this screen, so it would
              be alarm without an action. Those are logged for the estimator and
              shown on the admin review screen instead.
            */}
            {submitValidation && submitValidation.notes.length > 0 && (
              <div
                className="bg-[var(--afs-amber-ghost)] border border-afs-warning rounded px-4 py-3 mb-8 text-left"
                data-testid="order-validator-submit-notes"
              >
                <p className="font-heading text-sm uppercase tracking-wide text-afs-chrome-high mb-2">
                  AFS will confirm these with you
                </p>
                <ul className="flex flex-col gap-2">
                  {submitValidation.notes.map((note, index) => (
                    <li key={`${note.field}-${index}`} className="font-body text-sm text-afs-chrome-high">
                      {note.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

              {colorPalette === 'mcelroy' && (
                <div className="mt-6 max-w-sm">
                  <ColorField
                    palette="mcelroy"
                    value={form.color || null}
                    onChange={(name) => setForm(prev => ({ ...prev, color: name }))}
                    error={form.color.trim() === '' ? `Required for ${form.material} — select a color before continuing.` : null}
                  />
                </div>
              )}

              {isAluminum && (
                <div className="mt-6 max-w-sm">
                  <FinishColorField
                    material={form.material}
                    finish={form.finish || null}
                    onFinishChange={(finish) => setForm(prev => ({ ...prev, finish, color: '' }))}
                    color={form.color}
                    onColorChange={(name) => setForm(prev => ({ ...prev, color: name }))}
                  />
                </div>
              )}

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

              {/*
                SPEC §2's UI behaviour: "Red border on input + error message
                below input". The border and the message both come from the live
                engine pass, so they cannot disagree with the Next button, which
                is gated by the same findings.
              */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                {DECORATED_FIELDS.map((field) => {
                  const finding = fieldFinding(field);
                  return (
                    <div key={field}>
                      <label className={labelClass} htmlFor={field}>{DECORATED_FIELD_LABELS[field]}</label>
                      <input
                        id={field}
                        type="number"
                        min="0"
                        step="0.0625"
                        className={`${inputClass} ${fieldBorderClass(finding?.severity ?? null)}`}
                        aria-invalid={finding?.severity === 'error' ? true : undefined}
                        aria-describedby={finding ? `${field}-validation` : undefined}
                        value={form[field]}
                        onChange={(e) => updateField(field, e.target.value)}
                        placeholder="0.00"
                      />
                      <div id={`${field}-validation`}>
                        <FieldValidationMessage finding={finding} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={labelClass} htmlFor="lengthFt">Length (ft)</label>
                  <input id="lengthFt" type="number" min="0" step="0.5"
                    className={`${inputClass} ${fieldBorderClass(fieldFinding('lengthFt')?.severity ?? null)}`}
                    value={form.lengthFt} onChange={(e) => updateField('lengthFt', e.target.value)} placeholder="0" />
                  <FieldValidationMessage finding={fieldFinding('lengthFt')} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="quantity">Quantity</label>
                  <input id="quantity" type="number" min="1" step="1" className={inputClass}
                    value={form.quantity} onChange={(e) => updateField('quantity', e.target.value)} placeholder="1" />
                </div>
              </div>

              {/*
                SPEC §5's two banners. The error banner blocks and offers
                [Revise Dimensions]; the warning banner offers [Acknowledge and
                Continue]. Both only ever appear after the server pass at Next —
                a banner that appeared mid-keystroke would shout at a customer
                who is halfway through typing a number.
              */}
              <ValidationErrorBanner findings={serverErrors} onRevise={focusField} />
              <ValidationWarningBanner findings={outstandingWarnings} onAcknowledge={acknowledgeWarnings} />
              <ValidationInfoNotes findings={serverValidation?.infos ?? []} />

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
                <div>
                  <label className={labelClass} htmlFor="clientBusinessName">Business Name (optional)</label>
                  <input id="clientBusinessName" type="text" className={inputClass}
                    value={form.clientBusinessName} onChange={(e) => updateField('clientBusinessName', e.target.value)}
                    placeholder="Company name" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="clientName">Client Name (optional)</label>
                  <input id="clientName" type="text" className={inputClass}
                    value={form.clientName} onChange={(e) => updateField('clientName', e.target.value)}
                    placeholder="Contact name" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="requestedBy">Requested By (optional)</label>
                  <input id="requestedBy" type="text" className={inputClass}
                    value={form.requestedBy} onChange={(e) => updateField('requestedBy', e.target.value)}
                    placeholder="Who is requesting this?" />
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
                    <tr className={(colorPalette || isAluminum) ? 'border-b border-afs-chrome-dim' : ''}>
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Gauge / Thickness</td>
                      <td className="font-data text-afs-chrome-high px-4 py-3">{form.gauge}</td>
                    </tr>
                    {isAluminum && (
                      <tr className="border-b border-afs-chrome-dim">
                        <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Finish</td>
                        <td className="font-body text-afs-chrome-high px-4 py-3">{form.finish || '—'}</td>
                      </tr>
                    )}
                    {(colorPalette || isAluminum) && (
                      <tr>
                        <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Color</td>
                        <td className="font-body text-afs-chrome-high px-4 py-3">{form.color || '—'}</td>
                      </tr>
                    )}
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
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Business Name</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.clientBusinessName || '—'}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Client Name</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.clientName || '—'}</td>
                    </tr>
                    <tr className="border-b border-afs-chrome-dim">
                      <td className="font-label text-xs uppercase text-afs-chrome-mid px-4 py-3">Requested By</td>
                      <td className="font-body text-afs-chrome-high px-4 py-3">{form.requestedBy || '—'}</td>
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
              onClick={() => { void goNext(); }}
              disabled={!canProceed}
              className="bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {/* SPEC §5: "Show loading state on [Next] button". */}
              {isChecking ? 'Checking…' : 'Next'}
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
