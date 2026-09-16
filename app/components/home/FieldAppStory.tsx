'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SVGProps } from 'react';
import PhoneMockupVideo from './PhoneMockupVideo';

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
    text: 'Snap a photo of the detail',
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
    <section className="relative overflow-hidden bg-afs-bg-base py-20 md:py-28">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="text-center font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl">
          Photo to Quote from the jobsite
        </h2>

        <div className="mt-16 grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
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
                    <span className="font-body text-lg text-afs-chrome-mid md:text-xl">
                      {step.text}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* The Field App is a real installable PWA (app/field/contractor
                and app/field/layout.tsx's own manifest/service-worker shell),
                not a native app published to an app store -- there is no
                real Apple App Store or Google Play listing to link to, so
                both breakpoints link to the same real route; only the label
                changes to match how each surface actually gets you there. */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 md:justify-start">
              <Link
                href="/field/contractor"
                className="hidden rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover md:inline-flex"
              >
                Open the Field App
              </Link>
              <Link
                href="/field/contractor"
                className="rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover md:hidden"
              >
                Install App
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
