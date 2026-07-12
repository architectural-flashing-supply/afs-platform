'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type SubmitState = 'idle' | 'submitting' | 'submitted';

const inputClass =
  'w-full bg-afs-bg-overlay border border-afs-border rounded px-4 py-3 font-body text-sm text-afs-chrome-high placeholder:text-afs-chrome-dim focus:outline-none focus:border-afs-crimson transition-colors';

const labelClass = 'font-label text-xs uppercase tracking-wide text-afs-chrome-mid mb-2 block';

function ContactForm() {
  const searchParams = useSearchParams();
  const orderReference = searchParams.get('order');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitState('submitting');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, orderReference }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.');
        setSubmitState('idle');
        return;
      }
      setSubmitState('submitted');
    } catch {
      setError('Submission failed. Please try again.');
      setSubmitState('idle');
    }
  };

  if (submitState === 'submitted') {
    return (
      <div className="metal-edge metal-edge-red bg-afs-bg-raised border border-afs-border rounded p-12 text-center">
        <div className="w-14 h-14 rounded-full border-2 border-afs-success flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7 text-afs-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-heading text-2xl text-afs-chrome-high mb-3">Message Sent</h2>
        <p className="font-body text-sm text-afs-chrome-mid">
          Thanks, {name.split(' ')[0] || 'there'}. AFS will get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-afs-bg-overlay border border-afs-chrome-dim rounded p-8 md:p-10">
      <h2 className="font-heading text-2xl text-afs-chrome-high mb-6">Send a Message</h2>

      {orderReference && (
        <div className="mb-6 flex items-center gap-2 bg-afs-bg-surface border border-afs-border rounded px-4 py-3">
          <span className="font-label text-xs text-afs-chrome-mid uppercase tracking-wide">Order Reference:</span>
          <span className="font-data text-sm text-afs-chrome-high">{orderReference}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className={labelClass} htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            required
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Contractor"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Phone</label>
          <input
            id="phone"
            type="tel"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-0100"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className={labelClass} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
        />
      </div>

      <div className="mb-8">
        <label className={labelClass} htmlFor="message">Project Details</label>
        <textarea
          id="message"
          rows={6}
          required
          className={inputClass}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your project or question."
        />
      </div>

      {error && <p className="font-body text-sm text-afs-crimson mb-4">{error}</p>}

      <button
        type="submit"
        disabled={submitState === 'submitting'}
        className="w-full bg-afs-crimson hover:bg-afs-crimson-hover text-white font-label font-semibold px-8 py-3 rounded text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {submitState === 'submitting' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-afs-bg-base">
      <section className="metal-edge metal-edge-red px-6 pt-20 pb-12 text-center border-b border-afs-border">
        <p className="font-label text-afs-crimson text-sm tracking-widest uppercase mb-3">Contact AFS</p>
        <h1 className="font-display text-6xl md:text-[6rem] text-afs-chrome-high leading-none mb-4">
          GET IN TOUCH
        </h1>
        <p className="font-body text-afs-chrome-mid text-lg max-w-xl mx-auto">
          Questions about a project, an order, or a formal quote? Reach out directly.
        </p>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-5 gap-10">
        <div className="md:col-span-3">
          <Suspense fallback={null}>
            <ContactForm />
          </Suspense>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-afs-bg-raised border border-afs-border rounded p-8">
            <h3 className="font-heading text-lg text-afs-chrome-high mb-4">AFS Headquarters</h3>
            <dl className="space-y-4">
              <div>
                <dt className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Address</dt>
                <dd className="font-body text-sm text-afs-chrome-mid">
                  209 Sure Cast Drive<br />Burnet, Texas 78611
                </dd>
              </div>
              <div>
                <dt className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Phone</dt>
                <dd className="font-data text-sm text-afs-chrome-high">
                  <a href="tel:+15123724900" className="hover:text-afs-crimson transition-colors">
                    (512) 372-4900
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-label text-xs uppercase tracking-wide text-afs-chrome-dim mb-1">Email</dt>
                <dd className="font-body text-sm text-afs-chrome-mid break-all">
                  <a
                    href="mailto:trica@architecturalflashingsupply.com"
                    className="hover:text-afs-crimson transition-colors"
                  >
                    trica@architecturalflashingsupply.com
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div
            className="h-64 rounded border border-afs-border bg-gradient-to-br from-afs-bg-surface via-afs-bg-raised to-afs-bg-dim flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="font-label text-xs text-afs-chrome-dim uppercase tracking-widest text-center px-6">
              Map View &mdash; 209 Sure Cast Drive, Burnet, TX 78611
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
