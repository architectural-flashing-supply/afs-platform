'use client';

// HailView — real UI wired to the real data pipeline and the V2 engine.
//
// hv2-01: the headline number is now a PROBABILITY with a stated meaning —
// the chance an insurer pays for a FULL ROOF REPLACEMENT — produced by the
// deterministic engine in lib/hailview/v2/**. The legacy 0-100 `score` and
// `tier` fields are still returned and still rendered, but they are now
// round(probability * 100) rather than a points total.
//
// WORDING RULE, enforced throughout this file: a hail size at the address is
// ESTIMATED by triangulating nearby reports. It is never described as
// "confirmed", "recorded at" or "measured at" the property. Only a report
// that was itself measured is a measurement, and the per-event panel says
// how many of each a storm rests on.
//
// This calls app/api/hailview/storm-history/route.ts directly. There is no
// separate app/api/hailview/test-pipeline/route.ts — SPEC_HAILVIEW.md Section
// 9 named that as the Phase 1 deliverable, but afs-hv-001 built the real
// production route instead and every phase since has re-confirmed that route
// (not a differently-named one) is the actual, working Phase 1 endpoint. See
// STATE_OF_THE_BUILD.md's HailView entries. Building a wrapper/shim route
// here just to match the spec's original name would be a workaround, not a
// fix — this page calls the real thing.
//
// SPEC_HAILVIEW.md Section 6 scopes the written explanation to the agentic
// synthesis layer, lib/hailview/explanation.ts, called server-side from
// app/api/hailview/storm-history/route.ts. This page now reads
// `result.narrative` (the real agent-generated text) as the primary source.
// buildFallbackExplanation() below is kept as the graceful degrade path —
// used ONLY when `result.narrative` comes back empty (the route's own
// try/catch sets it to '' if the agent call fails for any reason) — so the
// tool never renders a blank explanation panel. It builds a plain
// deterministic string from the same V2 probability/evidence/per-event data
// already rendered elsewhere on this page — nothing about the fallback can
// affect the number either.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import { LOGO_HEIGHT } from '@/components/layout/NavBar';
import type { HailViewLookupResponse } from '@/app/api/hailview/storm-history/route';
import type { MaterialCategory, MembraneMilThickness, MetalGauge, ReplacementTier, ShingleType } from '@/lib/hailview/types';

// afs-hv-006 — Leaflet touches window/document at import time, so the map
// is loaded client-only via next/dynamic({ ssr: false }); Next's SSR pass
// would otherwise throw trying to evaluate the leaflet module on the server.
//
// afs-hv-007 — now mounted once as the page's persistent full-bleed
// background (see the return block below), so the loading fallback also
// fills the viewport rather than a fixed-height card.
const HailViewMap = dynamic(() => import('@/components/hailview/HailViewMap'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-afs-bg-overlay animate-pulse" />,
});

type TopLevelMaterial = 'asphalt_shingle' | 'metal' | 'tpo_pvc_membrane' | 'wood_shake';
type MetalSubtype = 'metal_r_panel' | 'metal_standing_seam';

const MATERIAL_OPTIONS: { value: TopLevelMaterial; label: string }[] = [
  { value: 'asphalt_shingle', label: 'Asphalt Shingle' },
  { value: 'metal', label: 'Metal Roofing' },
  { value: 'tpo_pvc_membrane', label: 'TPO / PVC Membrane' },
  { value: 'wood_shake', label: 'Wood Shake' },
];

// Mirrors the validation arrays in app/api/hailview/storm-history/route.ts —
// that file does not export them, so they're restated here.
const METAL_SUBTYPE_OPTIONS: { value: MetalSubtype; label: string }[] = [
  { value: 'metal_r_panel', label: 'R-Panel (Exposed Fastener)' },
  { value: 'metal_standing_seam', label: 'Standing Seam' },
];
const R_PANEL_GAUGES: MetalGauge[] = ['29ga', '26ga', '24ga'];
const STANDING_SEAM_GAUGES: MetalGauge[] = ['26ga', '24ga', '22ga'];
const MEMBRANE_THICKNESSES: MembraneMilThickness[] = [45, 60, 80];

// Added in hv2-01. The two shingle types have DIFFERENT PUBLISHED damage
// onsets — 1.00 in for 3-tab, 1.25 in for laminated/architectural (IIBEC /
// Smith 2013) — so this is a real scoring input, not a display detail. The
// pre-V2 page never collected it and never sent it, which meant every
// asphalt lookup silently used one curve.
const SHINGLE_TYPE_OPTIONS: { value: ShingleType; label: string }[] = [
  { value: 'architectural', label: 'Architectural / Laminated' },
  { value: '3-tab', label: '3-Tab' },
];

/** Materials whose policies usually carry a cosmetic-damage exclusion. */
const COSMETIC_EXCLUSION_MATERIALS: TopLevelMaterial[] = ['metal', 'tpo_pvc_membrane'];

const EVIDENCE_GRADE_BADGE: Record<'A' | 'B' | 'C' | 'D', BadgeVariant> = {
  A: 'success',
  B: 'success',
  C: 'warning',
  D: 'error',
};

const MATERIAL_DISPLAY_LABELS: Record<MaterialCategory, string> = {
  asphalt_shingle: 'Asphalt Shingle Roofing',
  metal_r_panel: 'Metal Roofing — R-Panel',
  metal_standing_seam: 'Metal Roofing — Standing Seam',
  tpo_pvc_membrane: 'TPO/PVC Commercial Membrane',
  wood_shake: 'Wood Shake Roofing',
};

const TIER_BADGE_VARIANT: Record<ReplacementTier, BadgeVariant> = {
  Low: 'success',
  Moderate: 'warning',
  High: 'error',
};

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none';
const selectClass =
  'w-full bg-afs-bg-overlay text-white border border-afs-border rounded px-4 py-3 font-body text-sm focus:outline-none focus:border-afs-crimson transition-colors disabled:opacity-50 disabled:pointer-events-none';
const optionClass = 'bg-afs-bg-overlay text-afs-chrome-high';
const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block';

// Fallback-only explanation — rendered when `result.narrative` is empty
// (the agent call failed server-side; see file header). A plain deterministic
// template built from the same V2 fields already rendered elsewhere on this
// page, so the tool degrades gracefully instead of ever showing a blank
// explanation panel. Nothing here can affect the number.
function buildFallbackExplanation(result: HailViewLookupResponse): string {
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const sentences: string[] = [
    `Based on the storm history near this address, the estimated chance an insurer would pay for a full roof replacement is ${pct(result.probability)} (range ${pct(result.low)} to ${pct(result.high)}).`,
    `Evidence grade ${result.evidenceGrade}: ${result.evidenceGradeReason}`,
  ];

  const inWindow = result.perEvent.filter((e) => e.windowStatus === 'in_window');
  const outside = result.perEvent.filter((e) => e.windowStatus === 'outside_window');

  if (inWindow.length === 0) {
    sentences.push(
      `No storm inside the typical ${result.claimWindowMonths}-month claim window produced hail likely to have functionally damaged this roof.`
    );
  } else {
    const driver = inWindow.reduce((a, b) => (b.claimContribution > a.claimContribution ? b : a));
    sentences.push(
      `The storm carrying the most weight is ${driver.convectiveDayUtc}, with hail estimated at ${driver.estimatedSizeIn.toFixed(2)} inches at your address (${driver.estimatedSizeLowIn.toFixed(2)}–${driver.estimatedSizeHighIn.toFixed(2)} inches), ${driver.interpolation} from ${driver.reportCount} nearby report(s).`
    );
  }

  if (outside.length > 0) {
    sentences.push(
      `${outside.length} earlier storm(s) were found but fall outside the typical claim window, so they add nothing to this result even where the hail was larger.`
    );
  }

  sentences.push(result.sensitivity.note);
  return sentences.join(' ');
}

interface HailViewRequestBody {
  address: string;
  material: MaterialCategory;
  roofAgeYears?: number;
  shingleType?: ShingleType;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
  /**
   * Whether the policy excludes cosmetic damage. Sent explicitly rather than
   * left to the engine's per-material default, so the number always matches
   * the control the user can actually see.
   */
  cosmeticExclusion?: boolean;
}

// SPEC_HAILVIEW.md Section 8 — consent-based "email me my own result" capture.
// Posts to app/api/hailview/email-report/route.ts, which has existed since
// afs-hv-001 and already implements this exact contract (email + the
// already-computed score/tier/narrative for this one lookup, nothing else).
// That route calls lib/resend/send.ts's sendEmail(), which returns
// { success: false, error: 'Resend is not configured.' } instead of throwing
// when RESEND_API_KEY/RESEND_FROM_EMAIL are unset — the route reflects that
// as reason:'not_configured' in a normal 200 response. This form renders
// whichever real outcome comes back; it does not assume either one.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailReportStatus = 'idle' | 'sending' | 'sent' | 'not_configured' | 'error';

interface EmailReportResponse {
  sent?: boolean;
  reason?: 'not_configured' | 'send_failed';
  message?: string;
  error?: string;
}

export default function HailViewPage() {
  const [address, setAddress] = useState('');
  const [materialType, setMaterialType] = useState<TopLevelMaterial | ''>('');
  const [metalSubtype, setMetalSubtype] = useState<MetalSubtype>('metal_r_panel');
  const [metalGauge, setMetalGauge] = useState<MetalGauge | ''>('');
  const [membraneMilThickness, setMembraneMilThickness] = useState<MembraneMilThickness | ''>('');
  const [shingleType, setShingleType] = useState<ShingleType>('architectural');
  // Defaults ON, matching DEFAULT_COSMETIC_EXCLUSION in lib/hailview/v2/claims.ts:
  // cosmetic-damage exclusion endorsements are near-standard on metal roofs.
  const [cosmeticExclusion, setCosmeticExclusion] = useState(true);
  const [roofAgeYears, setRoofAgeYears] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HailViewLookupResponse | null>(null);

  const [reportEmail, setReportEmail] = useState('');
  const [emailReportStatus, setEmailReportStatus] = useState<EmailReportStatus>('idle');
  const [emailReportError, setEmailReportError] = useState<string | null>(null);
  const [emailReportMessage, setEmailReportMessage] = useState<string | null>(null);

  const gaugeOptions = metalSubtype === 'metal_standing_seam' ? STANDING_SEAM_GAUGES : R_PANEL_GAUGES;
  const showsCosmeticToggle =
    materialType !== '' && COSMETIC_EXCLUSION_MATERIALS.includes(materialType);

  function selectMaterialType(value: TopLevelMaterial) {
    setMaterialType(value);
    setMetalGauge('');
    setMembraneMilThickness('');
    // Re-assert the per-material default whenever the material changes, so
    // a toggle left on from a previous selection cannot carry over into a
    // material it does not apply to.
    setCosmeticExclusion(COSMETIC_EXCLUSION_MATERIALS.includes(value));
  }

  function selectMetalSubtype(value: MetalSubtype) {
    setMetalSubtype(value);
    setMetalGauge('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!address.trim()) {
      setError('Enter an address to look up.');
      return;
    }
    if (!materialType) {
      setError('Select a roofing material type.');
      return;
    }

    const material: MaterialCategory = materialType === 'metal' ? metalSubtype : materialType;
    const parsedAge = roofAgeYears.trim() === '' ? undefined : Number(roofAgeYears);
    if (parsedAge !== undefined && !Number.isFinite(parsedAge)) {
      setError('Roof age must be a number.');
      return;
    }

    const body: HailViewRequestBody = {
      address: address.trim(),
      material,
      roofAgeYears: parsedAge,
      shingleType: materialType === 'asphalt_shingle' ? shingleType : undefined,
      metalGauge: materialType === 'metal' && metalGauge ? metalGauge : undefined,
      membraneMilThickness:
        materialType === 'tpo_pvc_membrane' && membraneMilThickness !== '' ? membraneMilThickness : undefined,
      cosmeticExclusion: showsCosmeticToggle ? cosmeticExclusion : undefined,
    };

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/hailview/storm-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === 'string' && data.error) || 'Could not complete the lookup.');
        return;
      }
      setResult(data as HailViewLookupResponse);
    } catch {
      setError('Could not reach HailView right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function startNewLookup() {
    setResult(null);
    setError(null);
    setReportEmail('');
    setEmailReportStatus('idle');
    setEmailReportError(null);
    setEmailReportMessage(null);
  }

  async function handleEmailReport(e: React.FormEvent) {
    e.preventDefault();
    setEmailReportError(null);

    if (!result) return;
    const trimmedEmail = reportEmail.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailReportError('Enter a valid email address.');
      return;
    }

    setEmailReportStatus('sending');
    try {
      const res = await fetch('/api/hailview/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          address: result.address,
          material: result.material,
          score: result.score,
          tier: result.tier,
          narrative: result.narrative || buildFallbackExplanation(result),
          // hv2-01 — the emailed report carries the same V2 context the page
          // shows, so a forwarded copy cannot read as a bare score again.
          probability: result.probability,
          low: result.low,
          high: result.high,
          evidenceGrade: result.evidenceGrade,
          evidenceGradeReason: result.evidenceGradeReason,
          modelVersion: result.modelVersion,
          claimWindowMonths: result.claimWindowMonths,
          cosmeticExclusion: result.cosmeticExclusion,
          sensitivityNote: result.sensitivity.note,
          perEvent: result.perEvent,
        }),
      });
      const data = (await res.json().catch(() => null)) as EmailReportResponse | null;
      if (!res.ok) {
        setEmailReportStatus('error');
        setEmailReportError((data && data.error) || 'Could not send the report. Please try again.');
        return;
      }
      if (data?.sent) {
        setEmailReportStatus('sent');
        return;
      }
      setEmailReportStatus(data?.reason === 'not_configured' ? 'not_configured' : 'error');
      setEmailReportMessage(data?.message ?? null);
    } catch {
      setEmailReportStatus('error');
      setEmailReportError('Could not reach the server right now. Try again shortly.');
    }
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 overflow-hidden bg-afs-bg-base"
      style={{ top: LOGO_HEIGHT }}
    >
      {/* afs-hv-007 — persistent full-bleed map background. Mounted once with
          no address, showing HailViewMap's own default service-area view;
          once `result` exists, the real geocoded address + real storm event
          markers are passed straight through and the same live map instance
          re-fits to them (components/hailview/HailViewMap.tsx's already-
          verified afs-hv-006 FitToMarkers logic, untouched). */}
      {/* isolate — Leaflet's own CSS gives .leaflet-container `position:
          relative` with no z-index, so it never forms its own stacking
          context; its internal panes/controls (tile/marker/popup panes,
          zoom control) carry z-index values up to 1000 that would otherwise
          leak past this wrapper and paint over the z-10 overlay panel below.
          `isolate` contains them so the overlay panel's z-10 wins as
          expected. */}
      <div className="absolute inset-0 isolate">
        <HailViewMap
          address={result?.address}
          lat={result?.lat}
          lon={result?.lon}
          hailEvents={result?.hailEvents}
        />
      </div>

      {/* Floating overlay panel — docked left, fixed width on sm+, full width
          (minus margins) on mobile. Scrolls internally so a long results
          panel never pushes past the viewport or grows the (non-scrolling)
          page underneath it. */}
      <div className="absolute top-4 bottom-4 left-4 right-4 sm:right-auto sm:w-[420px] z-10 overflow-y-auto space-y-6">
        <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-4">
          <p className="font-label text-xs tracking-widest uppercase text-afs-crimson mb-2">HailView</p>
          <h1 className="font-heading text-2xl font-bold text-afs-chrome-high mb-2">Roof Replacement-Probability Lookup</h1>
          <p className="font-body text-sm text-afs-chrome-dim">
            Enter your address and roofing material to see a data-backed replacement-probability score, built from real
            storm history near your property.
          </p>
        </div>

        {!result && (
          <form
            onSubmit={handleSubmit}
            className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6 space-y-6"
          >
            <Input
              id="hailview-address"
              label="Property Address"
              placeholder="123 Main St, City, TX"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-testid="hailview-address-input"
            />

            <div>
              <label className={labelClass} htmlFor="hailview-material">
                Roofing Material
              </label>
              <select
                id="hailview-material"
                className={selectClass}
                value={materialType}
                onChange={(e) => selectMaterialType(e.target.value as TopLevelMaterial)}
                data-testid="hailview-material-select"
              >
                <option value="" className={optionClass}>
                  Select a material&hellip;
                </option>
                {MATERIAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className={optionClass}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {materialType === 'asphalt_shingle' && (
              <div>
                <label className={labelClass} htmlFor="hailview-shingle-type">
                  Shingle Type
                </label>
                <select
                  id="hailview-shingle-type"
                  className={selectClass}
                  value={shingleType}
                  onChange={(e) => setShingleType(e.target.value as ShingleType)}
                  data-testid="hailview-shingle-type-select"
                >
                  {SHINGLE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className={optionClass}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="font-body text-xs text-afs-chrome-silver mt-2">
                  3-tab shingles are damaged by smaller hail than architectural
                  (laminated) shingles &mdash; 1.00&Prime; against 1.25&Prime;.
                </p>
              </div>
            )}

            {materialType === 'metal' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="hailview-metal-subtype">
                    Panel Type
                  </label>
                  <select
                    id="hailview-metal-subtype"
                    className={selectClass}
                    value={metalSubtype}
                    onChange={(e) => selectMetalSubtype(e.target.value as MetalSubtype)}
                    data-testid="hailview-metal-subtype-select"
                  >
                    {METAL_SUBTYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className={optionClass}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="hailview-metal-gauge">
                    Gauge
                  </label>
                  <select
                    id="hailview-metal-gauge"
                    className={selectClass}
                    value={metalGauge}
                    onChange={(e) => setMetalGauge(e.target.value as MetalGauge)}
                    data-testid="hailview-metal-gauge-select"
                  >
                    <option value="" className={optionClass}>
                      Select gauge&hellip;
                    </option>
                    {gaugeOptions.map((g) => (
                      <option key={g} value={g} className={optionClass}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {materialType === 'tpo_pvc_membrane' && (
              <div>
                <label className={labelClass} htmlFor="hailview-mil">
                  Membrane Thickness (mil)
                </label>
                <select
                  id="hailview-mil"
                  className={selectClass}
                  value={membraneMilThickness}
                  onChange={(e) => setMembraneMilThickness(Number(e.target.value) as MembraneMilThickness)}
                  data-testid="hailview-mil-select"
                >
                  <option value="" className={optionClass}>
                    Select thickness&hellip;
                  </option>
                  {MEMBRANE_THICKNESSES.map((mil) => (
                    <option key={mil} value={mil} className={optionClass}>
                      {mil} mil
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showsCosmeticToggle && (
              <div className="border border-afs-border rounded p-4 bg-afs-bg-overlay">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cosmeticExclusion}
                    onChange={(e) => setCosmeticExclusion(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-afs-crimson"
                    data-testid="hailview-cosmetic-exclusion-toggle"
                  />
                  <span>
                    <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-high block mb-1">
                      Policy excludes cosmetic damage
                    </span>
                    <span className="font-body text-xs text-afs-chrome-silver">
                      Most metal-roof policies carry a cosmetic-damage exclusion: dents that do not
                      let water in are not paid. Leave this on unless you have checked your policy
                      and know otherwise. With it on, denting alone adds nothing to the result.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {materialType && (
              <Input
                id="hailview-roof-age"
                type="number"
                min={0}
                max={100}
                label="Roof Age (years)"
                placeholder="e.g. 15"
                value={roofAgeYears}
                onChange={(e) => setRoofAgeYears(e.target.value)}
                data-testid="hailview-roof-age-input"
              />
            )}

            {error && <p className="font-body text-sm text-afs-crimson">{error}</p>}

            <Button type="submit" disabled={loading} data-testid="hailview-submit" className="w-full">
              {loading ? 'Looking up your roof…' : 'Get My Score'}
            </Button>
          </form>
        )}

        {result && (
          <div className="space-y-6">
            {/* HEADLINE. The number has ONE stated meaning and the label
                says it: the chance an insurer pays for a FULL ROOF
                REPLACEMENT. Pre-V2 this read "Replacement Probability" over
                a points total that was not a probability of anything. */}
            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge-red p-6">
              <p className="font-body text-sm text-afs-chrome-silver mb-4">{result.address}</p>
              <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">
                {MATERIAL_DISPLAY_LABELS[result.material]}
              </p>
              <div className="flex items-end gap-3 mb-1">
                <span className="font-display text-8xl leading-none text-afs-chrome-high" data-testid="hailview-score">
                  {result.score}
                </span>
                <span className="font-body text-2xl text-afs-chrome-mid mb-2">%</span>
              </div>
              <p className="font-body text-sm text-afs-chrome-high mb-1">
                estimated chance an insurer pays for a <strong>full roof replacement</strong>
              </p>
              <p className="font-data text-xs text-afs-chrome-silver mb-4" data-testid="hailview-range">
                Range {Math.round(result.low * 100)}%&ndash;{Math.round(result.high * 100)}%
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={TIER_BADGE_VARIANT[result.tier]} size="md">
                  <span data-testid="hailview-tier">{result.tier}</span>
                </Badge>
                <Badge variant={EVIDENCE_GRADE_BADGE[result.evidenceGrade]} size="md">
                  <span data-testid="hailview-evidence-grade">Evidence {result.evidenceGrade}</span>
                </Badge>
              </div>
              <p className="font-body text-xs text-afs-chrome-silver mt-3" data-testid="hailview-evidence-reason">
                {result.evidenceGradeReason}
              </p>

              {/* UNCALIBRATED DISCLOSURE. Reads the real modelVersion rather
                  than a hardcoded label, so it cannot drift from the engine. */}
              <p
                className="font-label text-xs uppercase tracking-wide text-afs-warning-on-dark mt-4"
                data-testid="hailview-uncalibrated-disclosure"
              >
                Uncalibrated model &mdash; {result.modelVersion}
              </p>
              <p className="font-body text-xs text-afs-chrome-silver mt-1">
                This model has not yet been fitted against real claim outcomes. Treat it as a
                data-backed indication, not a prediction of what your carrier will decide.
              </p>
            </div>

            {/* GUARD FLAGS. The deterministic reviewer never edits the
                number — a failed invariant is shown, not hidden. */}
            {result.guardFlags.length > 0 && (
              <div
                className="bg-afs-bg-raised border border-afs-crimson rounded p-6"
                data-testid="hailview-guard-flags"
              >
                <h2 className="font-heading text-lg font-semibold text-afs-danger-on-dark mb-2">
                  Internal consistency check failed
                </h2>
                <p className="font-body text-xs text-afs-chrome-silver mb-3">
                  The number above was produced as shown and has not been altered. These checks did
                  not hold, so treat the result with caution and report it.
                </p>
                <ul className="space-y-2">
                  {result.guardFlags.map((flag) => (
                    <li key={flag} className="font-body text-sm text-afs-chrome-high">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* PER-STORM TABLE. Every size here is ESTIMATED AT THE ADDRESS
                by triangulation from nearby reports — never described as
                confirmed or measured at the property. */}
            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6">
              <h2 className="font-heading text-2xl font-semibold text-afs-chrome-high mb-1">Storms Considered</h2>
              <p className="font-body text-xs text-afs-chrome-silver mb-4">
                One row per storm, not per report. Hail sizes are{' '}
                <strong>estimated at your address</strong> by triangulating nearby storm-spotter
                reports &mdash; they are not measurements taken at your property.
              </p>

              {result.perEvent.length === 0 ? (
                <p className="font-body text-sm text-afs-chrome-silver" data-testid="hailview-no-events">
                  No hail-producing storms were found near this address in the search window. Small
                  towns generate fewer reports than cities, so this is weak evidence of no hail
                  rather than proof of it.
                </p>
              ) : (
                <ul className="space-y-4" data-testid="hailview-per-event">
                  {result.perEvent.map((event) => (
                    <li key={event.eventId} className="border-b border-afs-border pb-4 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-body text-sm text-afs-chrome-high">{event.convectiveDayUtc}</p>
                        <span className="font-data text-sm text-afs-chrome-high whitespace-nowrap">
                          ~{event.estimatedSizeIn.toFixed(2)}&Prime; estimated
                        </span>
                      </div>
                      <p className="font-data text-xs text-afs-chrome-silver mb-2">
                        {event.estimatedSizeLowIn.toFixed(2)}&Prime;&ndash;
                        {event.estimatedSizeHighIn.toFixed(2)}&Prime; at your address &middot;{' '}
                        {event.interpolation === 'interpolated'
                          ? 'between reports on opposing sides'
                          : 'extrapolated from one side'}{' '}
                        &middot; largest reported anywhere in this storm {event.maxReportedSizeIn}&Prime;
                      </p>
                      <p className="font-body text-xs text-afs-chrome-silver mb-2">
                        {event.reportCount} report{event.reportCount === 1 ? '' : 's'} (
                        {event.measuredCount} measured, {event.estimatedCount} spotter-estimated)
                        {Number.isFinite(event.nearestReportMi)
                          ? `, nearest ${event.nearestReportMi.toFixed(1)} mi away`
                          : ''}{' '}
                        &middot; functional damage {Math.round(event.pFunctional * 100)}%, cosmetic{' '}
                        {Math.round(event.pCosmetic * 100)}%
                      </p>
                      <p
                        className={
                          event.windowStatus === 'in_window'
                            ? 'font-label text-xs uppercase tracking-wide text-afs-success-on-dark'
                            : 'font-label text-xs uppercase tracking-wide text-afs-warning-on-dark'
                        }
                      >
                        {event.windowLabel}
                      </p>
                      {event.cosmeticSuppressed && (
                        <p className="font-body text-xs text-afs-chrome-silver mt-1">
                          Cosmetic damage from this storm adds nothing, because the policy setting
                          above excludes it.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {result.bestDateOfLoss && (
                <p className="font-body text-sm text-afs-chrome-high mt-4" data-testid="hailview-best-date-of-loss">
                  Most likely date of loss to cite: <strong>{result.bestDateOfLoss.convectiveDayUtc}</strong>
                </p>
              )}
            </div>

            {/* SENSITIVITY — deterministic, from re-running the engine. */}
            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6">
              <h2 className="font-heading text-lg font-semibold text-afs-chrome-high mb-2">
                What Moves This Number
              </h2>
              <p className="font-body text-sm text-afs-chrome-high" data-testid="hailview-sensitivity">
                {result.sensitivity.note}
              </p>
              <p className="font-body text-xs text-afs-chrome-silver mt-3">
                {result.constantsProvenanceSummary.summary}
              </p>
            </div>

            {/* ADVISORY AUDIT FLAGS. Written by the agentic layer; they
                comment on the DATA and can never change the number. */}
            {result.auditFlags.length > 0 && (
              <div
                className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6"
                data-testid="hailview-audit-flags"
              >
                <h2 className="font-heading text-lg font-semibold text-afs-chrome-high mb-1">Data Notes</h2>
                <p className="font-body text-xs text-afs-chrome-silver mb-3">
                  Observations about the underlying storm data. Advisory only &mdash; these do not
                  change the result above.
                </p>
                <ul className="space-y-2">
                  {result.auditFlags.map((flag, i) => (
                    <li key={`${flag.kind}-${i}`} className="font-body text-sm text-afs-chrome-high">
                      <span
                        className={
                          flag.severity === 'caution'
                            ? 'font-label text-xs uppercase tracking-wide text-afs-warning-on-dark mr-2'
                            : 'font-label text-xs uppercase tracking-wide text-afs-info-on-dark mr-2'
                        }
                      >
                        {flag.kind.replace(/_/g, ' ')}
                      </span>
                      {flag.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6">
              <h2 className="font-heading text-2xl font-semibold text-afs-chrome-high mb-4">Storm History Timeline</h2>
              {result.hailEvents.length === 0 ? (
                <p className="font-body text-sm text-afs-chrome-dim">No hail events recorded within 1 mile over the last 5 years.</p>
              ) : (
                <ul className="space-y-3" data-testid="hailview-storm-timeline">
                  {result.hailEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between border-b border-afs-border pb-3 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <p className="font-body text-sm text-afs-chrome-high">{event.validAt.slice(0, 10)}</p>
                        <p className="font-body text-xs text-afs-chrome-dim">
                          {[event.city, event.state].filter(Boolean).join(', ') || 'Location unavailable'} &middot;{' '}
                          {event.distanceMi.toFixed(2)} mi away
                        </p>
                      </div>
                      <span className="font-data text-sm text-afs-crimson">{event.sizeIn}&Prime; hail</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="font-body text-xs text-afs-chrome-dim mt-4">
                {result.nonHailEventCount} other (non-hail) storm report(s) were also found in this radius over the same
                period.
              </p>
            </div>

            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading text-2xl font-semibold text-afs-chrome-high">Explanation</h2>
                {!result.narrative && (
                  <span
                    className="font-label text-xs uppercase tracking-wide text-afs-amber"
                    data-testid="hailview-explanation-fallback-label"
                  >
                    Automated summary &mdash; written explanation unavailable
                  </span>
                )}
              </div>
              <p className="font-body text-sm leading-relaxed text-afs-chrome-mid whitespace-pre-line" data-testid="hailview-explanation">
                {result.narrative || buildFallbackExplanation(result)}
              </p>
            </div>

            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6">
              <h2 className="font-heading text-2xl font-semibold text-afs-chrome-high mb-2">Email Me This Result</h2>
              <p className="font-body text-sm text-afs-chrome-dim mb-4">
                Send a copy of this lookup to your own inbox. We only use this to deliver your result.
              </p>

              {emailReportStatus === 'sent' ? (
                <p className="font-body text-sm text-afs-accent-green" data-testid="hailview-email-report-sent">
                  Sent — check {reportEmail.trim()} for your report.
                </p>
              ) : emailReportStatus === 'not_configured' ? (
                <p className="font-body text-sm text-afs-amber" data-testid="hailview-email-report-not-configured">
                  {emailReportMessage ??
                    "Your email was received, but delivery isn't live yet — you can screenshot or print this page to save your results."}
                </p>
              ) : (
                <form onSubmit={handleEmailReport} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      id="hailview-email"
                      type="email"
                      placeholder="you@example.com"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      disabled={emailReportStatus === 'sending'}
                      data-testid="hailview-email-input"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={emailReportStatus === 'sending'}
                    data-testid="hailview-email-submit"
                  >
                    {emailReportStatus === 'sending' ? 'Sending…' : 'Email My Result'}
                  </Button>
                </form>
              )}

              {emailReportError && (
                <p className="font-body text-sm text-afs-crimson mt-3" data-testid="hailview-email-report-error">
                  {emailReportError}
                </p>
              )}
              {emailReportStatus === 'error' && emailReportMessage && (
                <p className="font-body text-sm text-afs-crimson mt-3" data-testid="hailview-email-report-error">
                  {emailReportMessage}
                </p>
              )}
            </div>

            <Button variant="secondary" onClick={startNewLookup} data-testid="hailview-new-lookup" className="w-full">
              New Lookup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
