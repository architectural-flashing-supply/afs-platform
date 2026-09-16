'use client';

import { useState, type SVGProps } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

function SubmittalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  );
}

function FabricationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </svg>
  );
}

function EstimatingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 17 17 3l4 4L7 21H3z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

function RollFormingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 17h1a2 2 0 0 0 2-2v-2a1 1 0 0 1 1-1h6l4 4h3a1 1 0 0 1 1 1v0" />
      <path d="M14 17H9" />
      <circle cx="6.5" cy="17.5" r="1.5" />
      <circle cx="17.5" cy="17.5" r="1.5" />
      <path d="M3 6h8v6H3z" />
    </svg>
  );
}

function DesignSupportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 20 1-4L17 4l3 3L8 19z" />
      <path d="m13.5 6.5 4 4" />
      <path d="M3 3h4v4H3z" />
    </svg>
  );
}

interface ProcessStep {
  title: string;
  description: string;
}

interface ServiceDetail {
  key: string;
  title: string;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  cardDescription: string;
  fullDescription: string;
  benefits: string[];
  process: ProcessStep[];
  ctaLabel: string;
  ctaHref: string;
  learnMoreHref?: string;
}

const SERVICES: ServiceDetail[] = [
  {
    key: 'submittal',
    title: 'Submittal Services',
    Icon: SubmittalIcon,
    cardDescription: 'Complete project submittal packages tailored to your requirements.',
    fullDescription:
      'AFS provides comprehensive project submittal packages for commercial, architectural, and large-scale construction projects. Depending on project requirements, submittals may include custom profile samples, finish and color samples, product specifications, drawings, technical documentation, material selections, labeling, organization, and other project-specific documentation required for review and approval.',
    benefits: [
      'Comprehensive documentation for architect/engineer review',
      'Custom samples prepared to your exact specifications',
      'Professional organization and labeling',
      'Expert coordination throughout submittal process',
    ],
    process: [
      { title: 'Submit Project Requirements', description: 'Provide your project specifications, drawings, and submittal needs.' },
      { title: 'AFS Reviews & Plans Submittal Package', description: 'Our team designs the submittal package and fabricates samples.' },
      { title: 'Samples Fabricated & Tested', description: 'Every profile is inspected and quality-checked before packaging.' },
      { title: 'Documentation Prepared & Organized', description: 'Specs, finishes, and labeling are compiled into one package.' },
      { title: 'Delivery to Project Site', description: 'The complete submittal package ships to your project site or office.' },
    ],
    ctaLabel: 'Request a Submittal Quote',
    ctaHref: '/contact?service=submittal',
    learnMoreHref: '/about/services/submittal',
  },
  {
    key: 'fabrication',
    title: 'Custom Fabrication',
    Icon: FabricationIcon,
    cardDescription: 'Unlimited custom profiles fabricated to your exact specifications.',
    fullDescription:
      'AFS fabricates custom architectural flashing profiles in-house on our own Thalmann CNC folder -- no outsourced runs, no subcontracted brakes. Whatever the profile geometry, material, or gauge your project calls for, our shop builds it to exact spec rather than picking the closest match from a fixed catalog.',
    benefits: [
      'No profile is off the table -- built to your exact geometry',
      'Five materials: copper, aluminum, galvanized steel, stainless, Galvalume',
      'Every run folded in-house, never subcontracted',
      'Same shop that quotes it is the shop that builds it',
    ],
    process: [
      { title: 'Submit Your Profile', description: 'Draw it in FlashDraft, upload a drawing, or describe what you need.' },
      { title: 'AFS Reviews & Quotes', description: 'An estimator confirms the spec and issues a formal quote.' },
      { title: 'Fabrication', description: 'Your order is cut, bent, and formed to exact spec on our shop floor.' },
      { title: 'Quality Control', description: 'Every run is inspected against the confirmed specification.' },
      { title: 'Delivery', description: 'Shipped nationwide, or scheduled for local pickup.' },
    ],
    ctaLabel: 'Start a Custom Fabrication Quote',
    ctaHref: '/contact?service=fabrication',
  },
  {
    key: 'estimating',
    title: 'Estimating & Takeoffs',
    Icon: EstimatingIcon,
    cardDescription: 'Precision estimates and material takeoffs for your projects.',
    fullDescription:
      'AFS estimators review submitted drawings and project scope to produce accurate material takeoffs and pricing ahead of fabrication. Every submission is checked by a real estimator before a formal quote is issued -- never an automated guess.',
    benefits: [
      'Estimates grounded in real drawings, not rough guesses',
      'Every submission reviewed by an AFS estimator',
      'Material and blank-width takeoffs included with each quote',
      'Fast turnaround so your bid schedule stays on track',
    ],
    process: [
      { title: 'Submit Drawings or Scope', description: 'Upload plans or describe the project scope for takeoff.' },
      { title: 'AFS Prepares the Takeoff', description: 'Material quantities and profile counts are calculated.' },
      { title: 'Estimate Reviewed', description: 'An AFS estimator checks the takeoff against the drawings.' },
      { title: 'Formal Quote Issued', description: 'A detailed, priced quote is delivered to your account.' },
    ],
    ctaLabel: 'Request an Estimate',
    ctaHref: '/contact?service=estimating',
  },
  {
    key: 'roll-forming',
    title: 'On-Site Roll Forming',
    Icon: RollFormingIcon,
    cardDescription: 'Mobile fabrication bringing custom metal work directly to your jobsite.',
    fullDescription:
      'For projects where long, continuous runs are impractical to ship, AFS can bring roll-forming capability directly to the jobsite -- producing long-length panels and profiles on site, reducing seams and handling damage on large-scale installations.',
    benefits: [
      'Long, continuous runs formed without shipping-length limits',
      'Fewer field seams on large roofing and wall panel runs',
      'Reduced handling damage versus shipped long-length stock',
      'Scheduled around your project timeline',
    ],
    process: [
      { title: 'Submit Project Requirements', description: 'Share project scope, run lengths, and site access details.' },
      { title: 'AFS Plans the Mobile Run', description: 'Our team schedules equipment and material for your site.' },
      { title: 'On-Site Fabrication', description: 'Panels and profiles are roll-formed on site to length.' },
      { title: 'Quality Check', description: 'Formed material is inspected against spec before installation.' },
    ],
    ctaLabel: 'Ask About On-Site Roll Forming',
    ctaHref: '/contact?service=roll-forming',
  },
  {
    key: 'design-support',
    title: 'Design/Specification Support',
    Icon: DesignSupportIcon,
    cardDescription: 'Expert guidance from concept through final specification.',
    fullDescription:
      'AFS works with architects and design teams from early concept through final CSI Division 07 specification -- profile geometry, finish selection, and material data sheets, so AFS products are specified correctly the first time.',
    benefits: [
      'CSI Division 07 spec sections written for your project',
      'Finish palette and material data sheets provided',
      'CAD/BIM details available for every profile',
      'Direct coordination with the fabricating shop, not a reseller',
    ],
    process: [
      { title: 'Share Design Intent', description: 'Tell us the detail, finish, and performance requirements.' },
      { title: 'AFS Drafts Specification Support', description: 'Spec sections, finishes, and CAD details are prepared.' },
      { title: 'Review & Revise', description: 'Your team reviews and requests any adjustments.' },
      { title: 'Final Specification Delivered', description: 'Finalized documentation is ready to enter your project set.' },
    ],
    ctaLabel: 'Talk to AFS About Your Project',
    ctaHref: '/contact?service=design-support',
  },
];

export default function ServicesPage() {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const expanded = SERVICES.find((s) => s.key === expandedKey) ?? null;

  const toggleExpanded = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <main className="bg-afs-bg-base">
      {/* Hero */}
      <section className="bg-gradient-to-br from-afs-bg-dim to-afs-bg-base px-6 pb-16 pt-20 text-center">
        <h1 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
          Services Built for Your Project
        </h1>
        <p className="mx-auto mt-6 max-w-2xl font-body text-lg text-afs-chrome-mid">
          From submittal to on-site, AFS handles custom metal fabrication for every
          application.
        </p>
      </section>

      {/* 5-card grid: 2 top / 2 middle / 1 bottom centered */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          {SERVICES.map((service, index) => {
            const isLast = index === SERVICES.length - 1;
            return (
              <div
                key={service.key}
                className={`flex flex-col border border-afs-border bg-afs-bg-surface p-8 metal-edge transition-colors hover:border-afs-crimson hover:shadow-md ${
                  isLast ? 'sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-[calc(50%-1rem)]' : ''
                }`}
              >
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-afs-crimson text-afs-crimson">
                  <service.Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="mt-6 font-heading text-lg font-semibold text-afs-chrome-high">
                  {service.title}
                </h2>
                <p className="mt-2 flex-1 font-body text-sm text-afs-chrome-mid">
                  {service.cardDescription}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-6 self-start"
                  aria-expanded={expandedKey === service.key}
                  onClick={() => toggleExpanded(service.key)}
                >
                  {expandedKey === service.key ? 'Show Less' : 'Learn More'}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Expanded details -- a single shared panel below the grid, driven
            by whichever card's "Learn More" was last clicked (not a
            per-card inline expansion). grid-rows-[0fr]->[1fr] is a pure-CSS
            smooth height transition that doesn't need a measured pixel
            height from JS. */}
        <div
          className={`mt-8 grid transition-[grid-template-rows] duration-300 ease-out ${
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            {expanded && (
              <div className="border border-afs-border bg-afs-bg-raised p-8 metal-edge md:p-10">
                <h3 className="font-heading text-2xl font-semibold text-afs-chrome-high">
                  {expanded.title}
                </h3>
                <p className="mt-4 max-w-3xl font-body text-base text-afs-chrome-mid">
                  {expanded.fullDescription}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div>
                    <h4 className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
                      Key Benefits
                    </h4>
                    <ul className="mt-4 flex flex-col gap-3">
                      {expanded.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-start gap-3 font-body text-sm text-afs-chrome-mid">
                          <span className="mt-2 h-1 w-1 flex-none rounded-full bg-afs-crimson" aria-hidden="true" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
                      Process Steps
                    </h4>
                    <ol className="mt-4 flex flex-col gap-4">
                      {expanded.process.map((step, i) => (
                        <li key={step.title} className="flex items-start gap-3">
                          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-afs-crimson font-data text-xs font-semibold text-white">
                            {i + 1}
                          </span>
                          <span className="font-body text-sm text-afs-chrome-mid">
                            <span className="font-semibold text-afs-chrome-high">{step.title}</span>
                            {' — '}
                            {step.description}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href={expanded.ctaHref}
                    className="rounded bg-afs-crimson px-6 py-3 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
                  >
                    {expanded.ctaLabel}
                  </Link>
                  {expanded.learnMoreHref && (
                    <Link
                      href={expanded.learnMoreHref}
                      className="font-label text-sm font-semibold text-afs-chrome-mid underline underline-offset-4 transition-colors hover:text-afs-chrome-high"
                    >
                      Full Submittal Services page →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bottom CTA band */}
      <section className="bg-afs-crimson py-16 text-center text-white">
        <h2 className="font-display text-3xl leading-none sm:text-4xl">
          Ready to Get Started?
        </h2>
        <p className="mx-auto mt-4 max-w-xl font-body text-base text-white/90">
          Contact AFS for a free consultation on your next project.
        </p>
        <Link
          href="/contact"
          className="mt-8 inline-block rounded bg-white px-8 py-4 font-label text-sm font-semibold text-afs-crimson transition-colors hover:bg-white/90"
        >
          Get Started
        </Link>
      </section>
    </main>
  );
}
