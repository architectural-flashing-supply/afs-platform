'use client';

import { useEffect, useRef, useState, type SVGProps } from 'react';

interface Step {
  key: string;
  title: string;
  description: [string, string];
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 16V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ConvertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.94 15.5a2 2 0 0 0-1.44-1.44L2.36 12.48a.5.5 0 0 1 0-.96l6.14-1.58a2 2 0 0 0 1.44-1.44l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function VerifyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function FabricateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TrackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

// Grounded in the real platform flow, not generic copy: this section is
// specifically about blueprints/specifications (SPEC_DOCUMENT_UPLOAD.md) --
// the jobsite-photo flow (SPEC_PHOTO_TO_QUOTE_AI.md, app/field/contractor)
// is FieldAppStory.tsx's own "Photo to Quote" section above, so no photo/
// camera reference belongs here. Verify and Fabricate reflect the estimator
// review + Thalmann DS2801 shop floor described in CLAUDE.md's Pillar 1 and
// the MACHINE INTEGRATION section. Track reflects Pillar 3 (production
// stage updates, pre-ship photos, delivery) as built in
// SPEC_PRODUCTION_TIMELINE.md.
const STEPS: Step[] = [
  {
    key: 'capture',
    title: 'Upload Blueprints & Specifications',
    description: [
      'Upload your blueprints, drawings, or project specifications directly to AFS.',
      'No finished CAD file required to get started.',
    ],
    Icon: UploadIcon,
  },
  {
    key: 'convert',
    title: 'AFS Reviews Specifications & Creates Quote',
    description: [
      'AFS reads the submission and drafts a structured takeoff of profile and material.',
      'Dimensions are always confirmed by you, never guessed from a drawing.',
    ],
    Icon: ConvertIcon,
  },
  {
    key: 'verify',
    title: 'Verify',
    description: [
      'AFS estimators review every submission before it enters the fabrication queue.',
      'A formal quote is issued once your specification is confirmed.',
    ],
    Icon: VerifyIcon,
  },
  {
    key: 'fabricate',
    title: 'Fabricate',
    description: [
      'Your order is cut, bent, and formed on our shop floor to exact spec.',
      'Cutting, forming, and QC stages update automatically as they happen.',
    ],
    Icon: FabricateIcon,
  },
  {
    key: 'track',
    title: 'Track Production & Delivery Status in Real Time',
    description: [
      'Watch production status and pre-ship photos update live in your account.',
      'Delivery scheduling and tracking, start to finish, with no phone call.',
    ],
    Icon: TrackIcon,
  },
];

export default function DesignToDelivery() {
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyPreference = (reduceMotion: boolean) => {
      setReducedMotion(reduceMotion);
      if (reduceMotion) setVisibleCount(STEPS.length);
    };

    applyPreference(motionQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => applyPreference(e.matches);
    motionQuery.addEventListener('change', handleChange);
    return () => motionQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.stepIndex);
          setVisibleCount((prev) => Math.max(prev, index + 1));
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [reducedMotion]);

  const fillPercent = (visibleCount / STEPS.length) * 100;

  return (
    <section className="bg-afs-bg-light py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
          How It Works
        </p>
        <h2 className="mt-3 font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl">
          From capture to delivery
        </h2>

        <div className="relative mt-16 md:mt-24">
          {/* Vertical rail track + fill -- mobile */}
          <div
            className="absolute left-5 top-5 bottom-5 w-px bg-afs-border-light md:hidden"
            aria-hidden="true"
          >
            <div
              className="w-full bg-afs-crimson transition-[height] duration-700 ease-out"
              style={{ height: `${fillPercent}%` }}
            />
          </div>

          {/* Horizontal rail track + fill -- desktop */}
          <div
            className="absolute left-5 right-5 top-5 hidden h-px bg-afs-border-light md:block"
            aria-hidden="true"
          >
            <div
              className="h-full bg-afs-crimson transition-[width] duration-700 ease-out"
              style={{ width: `${fillPercent}%` }}
            />
          </div>

          <ol className="relative flex flex-col gap-12 md:flex-row md:gap-6">
            {STEPS.map((step, index) => {
              const isActive = index < visibleCount;
              return (
                <li
                  key={step.key}
                  ref={(el) => {
                    stepRefs.current[index] = el;
                  }}
                  data-step-index={index}
                  className="relative flex gap-5 md:flex-1 md:flex-col md:items-center md:gap-5 md:text-center"
                >
                  <span
                    className={`relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                      isActive
                        ? 'border-afs-crimson bg-afs-crimson text-white'
                        : 'border-afs-border-light bg-afs-bg-light-raised text-afs-ink-700'
                    }`}
                  >
                    <step.Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-afs-ink-900">
                      {step.title}
                    </h3>
                    <p className="mt-1 font-body text-sm text-afs-ink-700">
                      {step.description[0]}
                    </p>
                    <p className="mt-1 font-body text-sm text-afs-ink-700">
                      {step.description[1]}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
