'use client';

// HailView Phase 4 (afs-hv-004) — real UI wired to the real, already-committed
// Phase 1 (afs-hv-001) data pipeline, Phase 2 (afs-hv-002) scoring engine, and
// Phase 3 (afs-hv-003) results page.
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
// deterministic string from the same score/tier/factors data that is already
// rendered elsewhere on this page — nothing about the fallback can affect the
// score either.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import type { HailViewLookupResponse } from '@/app/api/hailview/storm-history/route';
import type { MaterialCategory, MembraneMilThickness, MetalGauge, ReplacementTier } from '@/lib/hailview/types';

// afs-hv-006 — Leaflet touches window/document at import time, so the map
// is loaded client-only via next/dynamic({ ssr: false }); Next's SSR pass
// would otherwise throw trying to evaluate the leaflet module on the server.
const HailViewMap = dynamic(() => import('@/components/hailview/HailViewMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[420px] rounded border border-afs-border bg-afs-bg-overlay animate-pulse" />,
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
// template string built from the same score/tier/factors data already shown
// elsewhere on this page, so the tool degrades gracefully instead of ever
// showing a blank explanation panel.
function buildFallbackExplanation(result: HailViewLookupResponse): string {
  const { score, tier, factors, hailEvents, nonHailEventCount } = result;
  const qualifying = factors.qualifyingEventCount;
  const eventWord = qualifying === 1 ? 'event' : 'events';

  const sentences: string[] = [
    `Your roof scored ${score} (${tier}), based on ${qualifying} qualifying hail ${eventWord} over the last 5 years within 1 mile of this address.`,
  ];

  if (factors.largestQualifyingEvent) {
    const e = factors.largestQualifyingEvent;
    sentences.push(`The largest qualifying event was ${e.sizeIn}" hail recorded on ${e.validAt.slice(0, 10)}.`);
  } else {
    sentences.push('No hail events at or above this material’s damage-onset size were found for this address.');
  }

  const breakdown: string[] = [
    `hail severity ${factors.hailSeveritySubscore.toFixed(1)} pts`,
    `frequency ${factors.frequencySubscore.toFixed(1)} pts`,
  ];
  if (factors.ageSubscore > 0) breakdown.push(`age ${factors.ageSubscore.toFixed(1)} pts`);
  if (factors.metalAgeSubscore > 0) breakdown.push(`age-related wear ${factors.metalAgeSubscore.toFixed(1)} pts`);
  if (factors.materialBonus > 0) breakdown.push(`${factors.materialBonusLabel ?? 'material bonus'} +${factors.materialBonus} pts`);
  sentences.push(`Score breakdown: ${breakdown.join(', ')}.`);

  sentences.push(
    `${hailEvents.length} hail report(s) and ${nonHailEventCount} other storm report(s) were found in this radius over the same period.`
  );

  return sentences.join(' ');
}

interface HailViewRequestBody {
  address: string;
  material: MaterialCategory;
  roofAgeYears?: number;
  metalGauge?: MetalGauge;
  membraneMilThickness?: MembraneMilThickness;
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
  const [roofAgeYears, setRoofAgeYears] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HailViewLookupResponse | null>(null);

  const [reportEmail, setReportEmail] = useState('');
  const [emailReportStatus, setEmailReportStatus] = useState<EmailReportStatus>('idle');
  const [emailReportError, setEmailReportError] = useState<string | null>(null);
  const [emailReportMessage, setEmailReportMessage] = useState<string | null>(null);

  const gaugeOptions = metalSubtype === 'metal_standing_seam' ? STANDING_SEAM_GAUGES : R_PANEL_GAUGES;

  function selectMaterialType(value: TopLevelMaterial) {
    setMaterialType(value);
    setMetalGauge('');
    setMembraneMilThickness('');
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
      metalGauge: materialType === 'metal' && metalGauge ? metalGauge : undefined,
      membraneMilThickness:
        materialType === 'tpo_pvc_membrane' && membraneMilThickness !== '' ? membraneMilThickness : undefined,
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
    <div className="min-h-screen bg-afs-bg-base px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <p className="font-label text-xs tracking-widest uppercase text-afs-crimson mb-2">HailView</p>
        <h1 className="font-heading text-4xl font-bold text-afs-chrome-high mb-2">Roof Replacement-Probability Lookup</h1>
        <p className="font-body text-sm text-afs-chrome-dim mb-8">
          Enter your address and roofing material to see a data-backed replacement-probability score, built from real
          storm history near your property.
        </p>

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
            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge-red p-6">
              <p className="font-body text-sm text-afs-chrome-dim mb-4">{result.address}</p>
              <p className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-1">
                {MATERIAL_DISPLAY_LABELS[result.material]}
              </p>
              <div className="flex items-end gap-4 mb-2">
                <span className="font-display text-8xl leading-none text-afs-chrome-high" data-testid="hailview-score">
                  {result.score}
                </span>
                <span className="font-body text-sm text-afs-chrome-dim mb-2">/ 100</span>
              </div>
              <Badge variant={TIER_BADGE_VARIANT[result.tier]} size="md">
                <span data-testid="hailview-tier">{result.tier} Replacement Probability</span>
              </Badge>
            </div>

            <div className="bg-afs-bg-raised border border-afs-border rounded metal-edge p-6">
              <h2 className="font-heading text-2xl font-semibold text-afs-chrome-high mb-4">Storm Map</h2>
              <HailViewMap address={result.address} lat={result.lat} lon={result.lon} hailEvents={result.hailEvents} />
            </div>

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
