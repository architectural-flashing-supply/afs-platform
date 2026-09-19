import Link from 'next/link';
import type { SVGProps } from 'react';
import InstallFieldAppButton from './InstallFieldAppButton';

function ContractorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function ArchitectIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21 12 3l9 18" />
      <path d="M7.5 12h9" />
      <path d="M4.5 18h15" />
    </svg>
  );
}

function PurchasingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 14 2 12l7-2" />
      <path d="M9 14v6l7-2v-6" />
      <path d="M9 8V2l7 2v6" />
      <path d="M16 8 9 6" />
      <path d="M16 14 9 12" />
    </svg>
  );
}

// Routes resolved against SITEMAP.md and a direct read of app/, not
// invented -- same standard applied by hp-005/006/008's home components.
// /field/contractor: real, already-shipped anonymous camera-to-quote
// route (app/field/contractor/page.tsx -> ContractorCameraQuoteForm),
// already linked from FieldAppStory.tsx (hp-005) and DesignStudioHub.tsx
// (hp-006) for the same reason -- SITEMAP.md itself is stale here (no
// /field/** entry at all), so app/ is the source of truth per this
// prompt's own instruction.
// /architects: real portal landing (app/(public)/architects/page.tsx),
// per SPEC_ARCHITECT_PORTAL.md section 2 -- links out to spec-writer,
// cad-library, and finish-palette, all confirmed real files.
// /account/credit-application: real, auth-required route
// (app/account/credit-application/page.tsx -> CreditApplicationForm),
// per SPEC_ONLINE_CREDIT_APPLICATION.md.
interface Pathway {
  key: string;
  role: string;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  valueLine: string;
  bullets: string[];
  ctaLabel: string;
  href: string;
}

const PATHWAYS: Pathway[] = [
  {
    key: 'contractors',
    role: 'Contractors',
    Icon: ContractorIcon,
    valueLine: 'Snap a photo on the jobsite and get a formal quote back — no CAD file needed.',
    bullets: [
      'AI identifies the profile type and material from a jobsite photo',
      'No AFS account required — submit as a guest with just an email',
      'Install as an app on your phone for one-tap access on-site',
    ],
    ctaLabel: 'Install Field App',
    href: '/field/contractor',
  },
  {
    key: 'architects',
    role: 'Architects',
    Icon: ArchitectIcon,
    valueLine: 'Everything needed to specify AFS products in your drawings, generated on demand.',
    bullets: [
      'AI-generated CSI Division 07 spec sections in minutes',
      'DWG, DXF, and Revit families for every profile',
      'Digital finish palette and material data sheets',
    ],
    ctaLabel: 'Visit the Architect Portal',
    href: '/architects',
  },
  {
    key: 'purchasing',
    role: 'Purchasing',
    Icon: PurchasingIcon,
    valueLine: 'Apply for net terms and keep every order tied to the right team member and PO.',
    bullets: [
      'Apply online for net-30 or net-60 credit terms',
      'Add teammates with their own account roles and access',
      'Every quote and order carries your purchase order number',
    ],
    ctaLabel: 'Apply for Credit Terms',
    href: '/account/credit-application',
  },
];

export default function CustomerPathways() {
  return (
    <section className="bg-afs-bg-light py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl md:text-6xl">
            Built for How You Work
          </h2>
          <p className="mt-4 font-body text-base text-afs-ink-700 md:text-lg">
            Whichever seat you're in, there's a real path from here to a formal AFS quote.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PATHWAYS.map((pathway) => (
            <div
              key={pathway.key}
              className="flex flex-col rounded border border-afs-border-light bg-afs-bg-light-raised p-8 metal-edge"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-afs-crimson text-afs-crimson">
                <pathway.Icon className="h-6 w-6" aria-hidden="true" />
              </span>

              <h3 className="mt-6 font-heading text-2xl font-semibold text-afs-ink-900">
                {pathway.role}
              </h3>
              <p className="mt-2 font-body text-base text-afs-ink-700">{pathway.valueLine}</p>

              <ul className="mt-6 flex flex-col gap-3">
                {pathway.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 font-body text-sm text-afs-ink-700">
                    <span className="mt-2 h-1 w-1 flex-none rounded-full bg-afs-crimson" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
              </ul>

              {pathway.key === 'contractors' ? (
                <InstallFieldAppButton className="mt-8 inline-block rounded bg-afs-crimson px-6 py-3 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover" />
              ) : (
                <Link
                  href={pathway.href}
                  className="mt-8 inline-block rounded bg-afs-crimson px-6 py-3 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
                >
                  {pathway.ctaLabel}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
