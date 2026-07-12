'use client';

import { Fragment, useState } from 'react';
import ArchitectShell, { ArchitectEyebrow } from '@/components/layout/ArchitectShell';

type Step = 1 | 2 | 3 | 4;
type SubmitState = 'idle' | 'submitting' | 'submitted';

const TOPICS = ['Custom Profile', 'Material Selection', 'Spec Review', 'Budget Estimate', 'Other'] as const;
const PREFERRED_CONTACTS = ['Phone', 'Email', 'Video call'] as const;
const PREFERRED_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const PREFERRED_TIMES = ['Morning', 'Afternoon'] as const;
const ACCEPTED_EXTENSIONS = ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', '.tiff', '.tif'];
const MAX_FILES = 3;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Contact & Project' },
  { n: 2, label: 'What You Need' },
  { n: 3, label: 'Files' },
  { n: 4, label: 'Scheduling' },
];

interface FormState {
  name: string;
  firmName: string;
  email: string;
  phone: string;
  projectName: string;
  projectType: string;
  projectLocation: string;
  estimatedBidDate: string;
  topic: string;
  description: string;
  preferredContact: string;
  timeZone: string;
  preferredDays: string[];
  preferredTimes: string[];
}

const EMPTY_FORM: FormState = {
  name: '',
  firmName: '',
  email: '',
  phone: '',
  projectName: '',
  projectType: '',
  projectLocation: '',
  estimatedBidDate: '',
  topic: '',
  description: '',
  preferredContact: '',
  timeZone: '',
  preferredDays: [],
  preferredTimes: [],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-ink-900 placeholder:text-afs-ink-700 focus:outline-none focus:border-afs-copper transition-colors';

const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-ink-700 mb-2 block';

export default function ConsultationPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleListValue = (field: 'preferredDays' | 'preferredTimes', value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleFileSelect = (selected: FileList | null) => {
    if (!selected) return;
    setFileError(null);
    const incoming = Array.from(selected);
    const combined = [...files, ...incoming];

    if (combined.length > MAX_FILES) {
      setFileError(`Upload at most ${MAX_FILES} files.`);
      return;
    }
    for (const file of incoming) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setFileError(`${ext.toUpperCase()} is not supported. Accepted: PDF, DWG, DXF, PNG, JPG, TIFF.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} exceeds the 25MB limit.`);
        return;
      }
    }
    setFiles(combined);
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const step1Valid = form.name.trim() !== '' && EMAIL_PATTERN.test(form.email);
  const step2Valid = TOPICS.includes(form.topic as (typeof TOPICS)[number]) && form.description.trim() !== '';
  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : true;

  const goNext = () => {
    if (canProceed && step < 4) setStep((step + 1) as Step);
  };
  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };
  const goToStep = (s: Step) => setStep(s);

  const handleSubmit = async () => {
    if (!step1Valid || !step2Valid) {
      setSubmitError('Complete the required fields before submitting.');
      return;
    }
    setSubmitError(null);
    setSubmitState('submitting');

    const body = new FormData();
    body.append('name', form.name.trim());
    body.append('firmName', form.firmName.trim());
    body.append('email', form.email.trim());
    body.append('phone', form.phone.trim());
    body.append('projectName', form.projectName.trim());
    body.append('projectType', form.projectType.trim());
    body.append('projectLocation', form.projectLocation.trim());
    body.append('estimatedBidDate', form.estimatedBidDate);
    body.append('topic', form.topic);
    body.append('description', form.description.trim());
    body.append('preferredContact', form.preferredContact);
    body.append('timeZone', form.timeZone.trim());
    body.append('preferredDays', JSON.stringify(form.preferredDays));
    body.append('preferredTimes', JSON.stringify(form.preferredTimes));
    files.forEach((file) => body.append('files', file));

    try {
      const res = await fetch('/api/consultation/request', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Submission failed. Please try again.');
        setSubmitState('idle');
        return;
      }
      setSubmitState('submitted');
    } catch {
      setSubmitError('Submission failed. Please try again.');
      setSubmitState('idle');
    }
  };

  if (submitState === 'submitted') {
    return (
      <ArchitectShell>
        <div className="max-w-lg mx-auto py-24 px-6">
          <div className="metal-edge metal-edge-copper bg-afs-bg-raised border border-afs-border rounded p-12 text-center">
            <div className="w-14 h-14 rounded-full border-2 border-afs-success flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-afs-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-heading text-3xl text-afs-ink-900 mb-3">Request Sent</h2>
            <p className="font-body text-sm text-afs-ink-700 mb-8">
              We&apos;ll reach out within 1 business day to discuss{' '}
              {form.projectName ? <span className="text-afs-ink-900">{form.projectName}</span> : 'your project'}.
            </p>
            <a
              href="/architects"
              className="inline-block bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-6 py-3 rounded text-sm transition-colors"
            >
              Back to Architect Portal
            </a>
          </div>
        </div>
      </ArchitectShell>
    );
  }

  return (
    <ArchitectShell>
      <div className="max-w-3xl mx-auto py-16 px-6">
        <div className="mb-10 text-center">
          <ArchitectEyebrow>Design Consultation</ArchitectEyebrow>
          <h1 className="font-display text-6xl text-afs-ink-900 leading-none mb-4">TALK TO OUR TEAM</h1>
          <p className="font-body text-afs-ink-700 text-base max-w-xl mx-auto">
            For projects that need more than a self-service quote — custom profiles, spec review, or budget
            estimates. We&apos;ll follow up within 1 business day.
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
                      ? 'border-afs-chrome-base bg-afs-bg-surface text-afs-ink-900'
                      : 'border-afs-chrome-dim text-afs-ink-700'
                  }`}
                >
                  {step > s.n ? '✓' : s.n}
                </div>
                <span
                  className={`font-label text-xs uppercase tracking-wide text-center ${
                    step >= s.n ? 'text-afs-ink-900' : 'text-afs-ink-700'
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
              <h2 className="font-heading text-2xl text-afs-ink-900 mb-6">Contact &amp; Project</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className={labelClass} htmlFor="name">Name</label>
                  <input id="name" type="text" className={inputClass} value={form.name}
                    onChange={(e) => updateField('name', e.target.value)} placeholder="Jane Architect" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="firmName">Firm Name</label>
                  <input id="firmName" type="text" className={inputClass} value={form.firmName}
                    onChange={(e) => updateField('firmName', e.target.value)} placeholder="Studio Name" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="email">Email</label>
                  <input id="email" type="email" className={inputClass} value={form.email}
                    onChange={(e) => updateField('email', e.target.value)} placeholder="you@firm.com" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="phone">Phone</label>
                  <input id="phone" type="tel" className={inputClass} value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)} placeholder="(555) 555-0100" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className={labelClass} htmlFor="projectName">Project Name</label>
                  <input id="projectName" type="text" className={inputClass} value={form.projectName}
                    onChange={(e) => updateField('projectName', e.target.value)} placeholder="e.g. Riverside Office Tower" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="projectType">Project Type</label>
                  <input id="projectType" type="text" className={inputClass} value={form.projectType}
                    onChange={(e) => updateField('projectType', e.target.value)} placeholder="e.g. Mixed-use, 6 story" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass} htmlFor="projectLocation">Project Location</label>
                  <input id="projectLocation" type="text" className={inputClass} value={form.projectLocation}
                    onChange={(e) => updateField('projectLocation', e.target.value)} placeholder="City, State" />
                </div>
                <div>
                  <label className={labelClass} htmlFor="estimatedBidDate">Estimated Bid Date <span className="normal-case text-afs-crimson">(optional)</span></label>
                  <input id="estimatedBidDate" type="date" className={inputClass} value={form.estimatedBidDate}
                    onChange={(e) => updateField('estimatedBidDate', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-ink-900 mb-6">What You Need Help With</h2>
              <span className={labelClass}>Topic</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => updateField('topic', topic)}
                    className={`font-label text-sm px-4 py-3 rounded border text-left transition-colors ${
                      form.topic === topic
                        ? 'bg-afs-copper border-afs-copper text-white'
                        : 'bg-afs-bg-overlay text-afs-ink-700 border-afs-border hover:bg-afs-bg-surface'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
              <label className={labelClass} htmlFor="description">
                What do you need our team&apos;s help with?
              </label>
              <textarea id="description" rows={6} className={inputClass} value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe the profile, material, or spec question you need help with." />
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-ink-900 mb-2">Upload Plans or Sketches</h2>
              <p className="font-body text-sm text-afs-ink-700 mb-6">
                Optional. Upload plans, sketches, or existing specs. Up to {MAX_FILES} files, 25MB each.
                Accepted: PDF, DWG, DXF, images.
              </p>

              <label className="metal-edge metal-edge-copper flex flex-col items-center justify-center gap-3 border-2 border-dashed border-afs-border rounded p-10 cursor-pointer hover:border-afs-copper transition-colors">
                <svg className="w-8 h-8 text-afs-copper" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3" />
                </svg>
                <span className="font-label text-sm text-afs-ink-900">Click to upload or drag files here</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept={ACCEPTED_EXTENSIONS.join(',')}
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </label>

              {fileError && <p className="font-body text-sm text-afs-crimson mt-3">{fileError}</p>}

              {files.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {files.map((file) => (
                    <li
                      key={file.name}
                      className="flex items-center justify-between bg-afs-bg-surface border border-afs-chrome-dim rounded px-4 py-3"
                    >
                      <span className="font-body text-sm text-afs-ink-900 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.name)}
                        className="font-label text-xs text-afs-ink-700 hover:text-afs-copper transition-colors ml-4"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-heading text-2xl text-afs-ink-900 mb-6">Scheduling Preference</h2>

              <span className={labelClass}>Preferred Contact</span>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {PREFERRED_CONTACTS.map((contact) => (
                  <button
                    key={contact}
                    type="button"
                    onClick={() => updateField('preferredContact', contact)}
                    className={`font-label text-sm px-4 py-3 rounded border transition-colors ${
                      form.preferredContact === contact
                        ? 'bg-afs-copper border-afs-copper text-white'
                        : 'bg-afs-bg-overlay text-afs-ink-700 border-afs-border hover:bg-afs-bg-surface'
                    }`}
                  >
                    {contact}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <label className={labelClass} htmlFor="timeZone">Time Zone</label>
                <input id="timeZone" type="text" className={inputClass} value={form.timeZone}
                  onChange={(e) => updateField('timeZone', e.target.value)} placeholder="e.g. Central Time" />
              </div>

              <span className={labelClass}>Preferred Days</span>
              <div className="flex gap-2 mb-6 flex-wrap">
                {PREFERRED_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleListValue('preferredDays', day)}
                    className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
                      form.preferredDays.includes(day)
                        ? 'bg-afs-copper border-afs-copper text-white'
                        : 'bg-afs-bg-overlay text-afs-ink-700 border-afs-border hover:bg-afs-bg-surface'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <span className={labelClass}>Preferred Times</span>
              <div className="flex gap-2 mb-2 flex-wrap">
                {PREFERRED_TIMES.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => toggleListValue('preferredTimes', time)}
                    className={`font-label text-sm px-4 py-2 rounded border transition-colors ${
                      form.preferredTimes.includes(time)
                        ? 'bg-afs-copper border-afs-copper text-white'
                        : 'bg-afs-bg-overlay text-afs-ink-700 border-afs-border hover:bg-afs-bg-surface'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>

              {submitError && <p className="font-body text-sm text-afs-crimson mt-6">{submitError}</p>}
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

          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitState === 'submitting'}
              className="bg-afs-copper hover:bg-afs-copper-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitState === 'submitting' ? 'Submitting…' : 'Submit Request'}
            </button>
          )}
        </div>

        {step === 4 && (
          <div className="flex justify-center mt-4">
            <button type="button" onClick={() => goToStep(2)} className="font-body text-xs text-afs-ink-700 hover:text-afs-copper transition-colors">
              Edit topic &amp; description
            </button>
          </div>
        )}
      </div>
    </ArchitectShell>
  );
}
