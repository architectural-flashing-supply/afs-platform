'use client';

import { useState } from 'react';
import type { SVGProps } from 'react';
import PhoneMockupVideo from './PhoneMockupVideo';
import InstallFieldAppButton from './InstallFieldAppButton';
import RevealOnScroll from './RevealOnScroll';

function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function DesignIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 20 1-4L17 4l3 3L8 19z" />
      <path d="m13.5 6.5 4 4" />
      <path d="M3 3h4v4H3z" />
    </svg>
  );
}

function TruckIcon(props: SVGProps<SVGSVGElement>) {
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

const STEPS = [
  {
    number: '1',
    text: 'Take a photo of your profile',
    Icon: CameraIcon,
  },
  {
    number: '2',
    text: 'AFS designs the profile',
    Icon: DesignIcon,
  },
  {
    number: '3',
    text: 'Fabrication & Job Site Delivery',
    Icon: TruckIcon,
  },
];

export default function FieldAppStory() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="relative overflow-hidden bg-afs-bg-light py-20 md:py-28">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="text-center font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl">
          Photo to Quote from the jobsite
        </h2>

        {/* Reveal group's children are the two grid columns (phone, steps/CTA)
            -- not the STEPS <ol> below, whose <li> elements already carry
            their own inline opacity for the active-step highlight; an
            inline style would win the cascade over .reveal-group's CSS
            opacity, silently breaking the entrance fade for those. */}
        <RevealOnScroll className="mt-16 grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="flex w-full justify-center">
            <PhoneMockupVideo onActiveStepChange={setActiveStep} />
          </div>

          <div className="text-center md:text-left">
            <ol className="mx-auto flex max-w-md flex-col gap-8 text-left md:mx-0">
              {STEPS.map((step, index) => {
                const isActive = index === activeStep;
                return (
                  <li
                    key={step.number}
                    className="flex items-center gap-5 transition-opacity duration-300"
                    style={{ opacity: isActive ? 1 : 0.45 }}
                  >
                    <span className="flex flex-none items-center gap-3">
                      <span
                        className={`font-display leading-none text-afs-crimson transition-transform duration-300 ${
                          isActive
                            ? 'scale-110 text-5xl drop-shadow-[0_0_12px_theme(colors.afs.crimson/50%)] sm:text-6xl'
                            : 'text-5xl sm:text-6xl'
                        }`}
                      >
                        {step.number}
                      </span>
                      <step.Icon className="h-8 w-8 flex-none text-afs-crimson" aria-hidden="true" />
                    </span>
                    <span className="font-body text-lg text-afs-ink-700 md:text-xl">
                      {step.text}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* The Field App is a real installable PWA (app/field/contractor
                and app/field/layout.tsx's own manifest/service-worker shell),
                not a native app published to an app store -- there is no
                real Apple App Store or Google Play listing to link to.
                InstallFieldAppButton (2026-09-19 revision, item 4) handles
                the platform split internally (native install prompt on
                Android/Chrome, an instructional sheet on iOS, a QR modal
                on desktop) instead of this being two differently-labeled
                Link variants. */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 md:justify-start">
              <InstallFieldAppButton className="rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover" />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
