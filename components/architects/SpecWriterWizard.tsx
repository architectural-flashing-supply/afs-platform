'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArchitectEyebrow } from '@/components/layout/ArchitectShell';
import SpecPreview from '@/components/architects/SpecPreview';
import { PRODUCTS, ALL_MATERIALS } from '@/lib/data/catalog';
import type { SpecSection } from '@/lib/anthropic/spec';

type Step = 1 | 2 | 3 | 4;

const CSI_SECTIONS = [
  { code: '07 61 00', title: 'Sheet Metal Roofing' },
  { code: '07 62 00', title: 'Sheet Metal Flashing and Trim' },
  { code: '07 65 00', title: 'Flexible Flashing' },
  { code: '07 72 00', title: 'Roof Accessories' },
] as const;

const PROJECT_TYPES = ['Commercial', 'Healthcare', 'Education', 'Residential', 'Government'] as const;

const AFS_PROFILES = Array.from(new Set(PRODUCTS.map((p) => p.name))).sort();

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'CSI Section' },
  { n: 2, label: 'Profiles & Materials' },
  { n: 3, label: 'Project Context' },
  { n: 4, label: 'Generate' },
];

interface WizardState {
  csiSection: string;
  csiTitle: string;
  profiles: string[];
  materials: string[];
  projectType: string;
  climateZone: string;
  soleSource: boolean;
}

const EMPTY_STATE: WizardState = {
  csiSection: '',
  csiTitle: '',
  profiles: [],
  materials: [],
  projectType: '',
  climateZone: '',
  soleSource: false,
};

export default function SpecWriterWizard() {
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<WizardState>(EMPTY_STATE);
  const [spec, setSpec] = useState<SpecSection | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const toggleListValue = (field: 'profiles' | 'materials', value: string) => {
    setState((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));
  };

  const step1Valid = state.csiSection !== '';
  const step2Valid = state.profiles.length > 0 && state.materials.length > 0;
  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : true;

  const goNext = () => {
    if (canProceed && step < 4) setStep((step + 1) as Step);
  };
  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleGenerate = async () => {
    if (!step1Valid || !step2Valid) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csiSection: state.csiSection,
          csiTitle: state.csiTitle,
          profiles: state.profiles,
          materials: state.materials,
          projectType: state.projectType || null,
          climateZone: state.climateZone.trim() || null,
          soleSource: state.soleSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? 'Generation failed. Please try again.');
        return;
      }
      setSpec(data.spec as SpecSection);
    } catch {
      setGenError('Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const startOver = () => {
    setSpec(null);
    setState(EMPTY_STATE);
    setStep(1);
    setGenError(null);
  };

  const selectedCsi = useMemo(
    () => CSI_SECTIONS.find((s) => s.code === state.csiSection),
    [state.csiSection]
  );

  if (spec) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6">
        <div className="mb-10 text-center">
          <ArchitectEyebrow>AI Spec Writer</ArchitectEyebrow>
          <h1 className="font-display text-6xl text-afs-chrome-high leading-none mb-4">SPECIFICATION READY</h1>
        </div>
        <SpecPreview spec={spec} isSoleSource={state.soleSource} onStartOver={startOver} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <div className="mb-10 text-center">
        <ArchitectEyebrow>AI Spec Writer</ArchitectEyebrow>
        <h1 className="font-display text-6xl text-afs-chrome-high leading-none mb-4">WRITE YOUR SPEC</h1>
        <p className="font-body text-afs-chrome-mid text-base max-w-xl mx-auto">
          Complete CSI Division 07 specification sections for AFS products — generated in minutes, editable, and
          downloadable as DOCX.
        </p>
      </div>

      <div className="flex items-center justify-center mb-12 bg-afs-bg-raised rounded p-6 flex-wrap gap-y-4">
        {STEPS.map((s, idx) => (
          <Fragment key={s.n}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-data text-sm border-2 ${
                  step === s.n
                    ? 'border-afs-copper bg-afs-copper text-white'
                    : step > s.n
                    ? 'border-afs-chrome-base bg-afs-bg-surface text-afs-chrome-high'
                    : 'border-afs-chrome-dim text-afs-chrome-dim'
                }`}
              >
                {step > s.n ? '✓' : s.n}
              </div>
              <span
                className={`font-label text-xs uppercase tracking-wide text-center ${
                  step >= s.n ? 'text-afs-chrome-high' : 'text-afs-chrome-dim'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-10 md:w-16 mx-2 mb-6 ${step > s.n ? 'bg-afs-chrome-base' : 'bg-afs-chrome-dim'}`} />
            )}
          </Fragment>
        ))}
      </div>

      <div className="bg-afs-bg-overlay border border-afs-chrome-dim rounded p-8 md:p-10">
        {step === 1 && (
          <div>
            <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Select a CSI Section</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CSI_SECTIONS.map((section) => (
                <button
                  key={section.code}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, csiSection: section.code, csiTitle: section.title }))}
                  className={`text-left rounded border p-5 transition-colors ${
                    state.csiSection === section.code
                      ? 'bg-afs-copper border-afs-copper text-white'
                      : 'bg-afs-bg-surface border-afs-border text-afs-chrome-high hover:border-afs-copper'
                  }`}
                >
                  <p className="font-data text-sm mb-1 opacity-80">{section.code}</p>
                  <p className="font-heading text-lg">{section.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Profiles &amp; Materials</h2>

            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">
              AFS Profiles to Specify
            </span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {AFS_PROFILES.map((profile) => (
                <label
                  key={profile}
                  className={`flex items-center gap-2 font-label text-sm px-4 py-3 rounded border cursor-pointer transition-colors ${
                    state.profiles.includes(profile)
                      ? 'bg-afs-copper border-afs-copper text-white'
                      : 'bg-afs-bg-surface text-afs-chrome-high border-afs-border hover:border-afs-copper'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-afs-copper"
                    checked={state.profiles.includes(profile)}
                    onChange={() => toggleListValue('profiles', profile)}
                  />
                  {profile}
                </label>
              ))}
            </div>

            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">Materials</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ALL_MATERIALS.map((material) => (
                <label
                  key={material}
                  className={`flex items-center gap-2 font-label text-sm px-4 py-3 rounded border cursor-pointer transition-colors ${
                    state.materials.includes(material)
                      ? 'bg-afs-copper border-afs-copper text-white'
                      : 'bg-afs-bg-surface text-afs-chrome-high border-afs-border hover:border-afs-copper'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-afs-copper"
                    checked={state.materials.includes(material)}
                    onChange={() => toggleListValue('materials', material)}
                  />
                  {material}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-heading text-2xl text-afs-chrome-high mb-2">Project Context</h2>
            <p className="font-body text-sm text-afs-chrome-mid mb-6">
              Optional — improves generated output, but not required.
            </p>

            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">Project Type</span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, projectType: prev.projectType === type ? '' : type }))}
                  className={`font-label text-sm px-4 py-3 rounded border transition-colors ${
                    state.projectType === type
                      ? 'bg-afs-copper border-afs-copper text-white'
                      : 'bg-afs-bg-surface text-afs-chrome-high border-afs-border hover:border-afs-copper'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <label className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block" htmlFor="climateZone">
              Climate Zone / Exposure <span className="normal-case text-afs-chrome-dim">(optional)</span>
            </label>
            <input
              id="climateZone"
              type="text"
              value={state.climateZone}
              onChange={(e) => setState((prev) => ({ ...prev, climateZone: e.target.value }))}
              placeholder="e.g. Coastal, high-wind, freeze-thaw"
              className="w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-copper transition-colors mb-8"
            />

            <span className="font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block">Sole Source</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, soleSource: true }))}
                className={`font-label text-sm px-4 py-3 rounded border text-left transition-colors ${
                  state.soleSource
                    ? 'bg-afs-copper border-afs-copper text-white'
                    : 'bg-afs-bg-surface text-afs-chrome-high border-afs-border hover:border-afs-copper'
                }`}
              >
                Specify AFS exclusively
              </button>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, soleSource: false }))}
                className={`font-label text-sm px-4 py-3 rounded border text-left transition-colors ${
                  !state.soleSource
                    ? 'bg-afs-copper border-afs-copper text-white'
                    : 'bg-afs-bg-surface text-afs-chrome-high border-afs-border hover:border-afs-copper'
                }`}
              >
                Allow substitutions (or-equal)
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Review &amp; Generate</h2>

            <dl className="space-y-3 mb-8 font-body text-sm">
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-chrome-mid">CSI Section</dt>
                <dd className="text-afs-chrome-high">
                  {selectedCsi ? `${selectedCsi.code} — ${selectedCsi.title}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-chrome-mid">Profiles</dt>
                <dd className="text-afs-chrome-high text-right">{state.profiles.join(', ') || '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-chrome-mid">Materials</dt>
                <dd className="text-afs-chrome-high text-right">{state.materials.join(', ') || '—'}</dd>
              </div>
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-chrome-mid">Project Type</dt>
                <dd className="text-afs-chrome-high">{state.projectType || 'Not specified'}</dd>
              </div>
              <div className="flex justify-between border-b border-afs-chrome-dim pb-2">
                <dt className="text-afs-chrome-mid">Climate Zone</dt>
                <dd className="text-afs-chrome-high">{state.climateZone || 'Not specified'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-afs-chrome-mid">Sole Source</dt>
                <dd className="text-afs-chrome-high">{state.soleSource ? 'AFS exclusive' : 'Or-equal'}</dd>
              </div>
            </dl>

            {genError && <p className="font-body text-sm text-afs-crimson mb-6">{genError}</p>}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-4 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {generating ? 'Generating Specification… (10–30 seconds)' : 'Generate Specification'}
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={goBack}
          disabled={step === 1}
          className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors disabled:opacity-0 disabled:pointer-events-none"
        >
          Back
        </button>

        {step < 4 && (
          <button
            onClick={goNext}
            disabled={!canProceed}
            className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
