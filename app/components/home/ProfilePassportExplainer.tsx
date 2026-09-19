import Link from 'next/link';
import { Fragment, type SVGProps } from 'react';
import { createClient } from '@/lib/supabase/server';
import RevealOnScroll from './RevealOnScroll';

function DesignIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function PassportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M5 17c.7-1.8 2.2-3 4-3s3.3 1.2 4 3" />
      <path d="M14 9h5" />
      <path d="M14 13h5" />
    </svg>
  );
}

function ReorderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

interface FlowStep {
  key: string;
  title: string;
  description: string;
  Icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

// "Design" route is the profile-building tool linked from DesignStudioHub.tsx
// (hp-006) -- FlashDraft is /studio/draft -- re-confirmed here rather than
// assumed.
//
// The prompt's "(AFS number, material, gauge, finish, drawing, 3D model,
// bend schedule)" field list does not match any real table. SCHEMA.md has
// no `custom_profiles` table at all; the feature this section describes
// is `saved_configurations` (SPEC_CUSTOM_PROFILE_LIBRARY.md's "Saved
// Custom Profile Library"), whose real columns are name, profile_id,
// material_id, gauge_id, finish_id, and a dimensions JSONB blob -- no
// afs_number, drawing, 3d_model, or bend_schedule column exists on it or
// anywhere else in SCHEMA.md. "AFS number" is real, but it belongs to
// `orders.order_number` / `quotes.quote_number` (formats AFS-2026-XXXXX /
// AFS-Q-2026-XXXXX) -- an order/quote identifier, not a saved-profile
// field. Copy below and the passport card's field list use
// saved_configurations' real columns instead of the prompt's invented
// ones, the same correction pattern hp-005/hp-006/hp-008/hp-009 already
// applied against other stale prompt claims.
const STEPS: FlowStep[] = [
  {
    key: 'design',
    title: 'Design',
    description: 'Build your profile in FlashDraft.',
    Icon: DesignIcon,
  },
  {
    key: 'save',
    title: 'Save',
    description:
      'Save it to your Profile Passport — profile type, material, gauge, finish, and dimensions, stored with your account.',
    Icon: PassportIcon,
  },
  {
    key: 'reorder',
    title: 'Reorder',
    description: 'Reorder in one click from your account — no re-entry, no re-explaining the spec.',
    Icon: ReorderIcon,
  },
];

// Passport card field values are illustrative example data (this is a
// marketing section, not a live query against a signed-in user's rows) --
// grounded in real terminology CLAUDE.md and SCHEMA.md already use
// elsewhere (galvanized steel, 24 GA, mill finish; see e.g. SCHEMA.md's
// bid_documents.spec_text example, `24 GA GALV, 12" girth, mill finish`).
const PASSPORT_TITLE = 'Coping Cap — 12" Girth';
const PASSPORT_FIELDS = [
  { label: 'Profile Type', value: 'Coping Cap' },
  { label: 'Material', value: 'Galvanized Steel' },
  { label: 'Gauge', value: '24 GA' },
  { label: 'Finish', value: 'Mill Finish' },
  { label: 'Dimensions', value: '12"W × 4"H' },
];

export default async function ProfilePassportExplainer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /register is the real signup route (app/(auth)/register -- the login
  // page's own "Don't have an account? Create one" link points here).
  // /account/profiles does not exist; the real saved/custom-profile list
  // is /architects/custom-profiles (SITEMAP.md: auth required, any role;
  // SPEC_CUSTOM_PROFILE_LIBRARY.md's "Your Custom Profiles" page).
  const cta = user
    ? { label: 'View My Profiles', href: '/architects/custom-profiles' }
    : { label: 'Create your account', href: '/register' };

  return (
    <section id="profile-passport" className="bg-afs-bg-light py-20 md:py-28">
      <RevealOnScroll className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl md:text-6xl">
            Design it once. Order it whenever you need it.
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {STEPS.map((step, index) => (
            <Fragment key={step.key}>
              <div className="flex flex-col rounded border border-afs-border-light bg-afs-bg-light-raised p-6 metal-edge">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-afs-crimson text-afs-crimson">
                  <step.Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-afs-ink-900">{step.title}</h3>
                <p className="mt-2 font-body text-sm text-afs-ink-700">{step.description}</p>
              </div>
              {index < STEPS.length - 1 && (
                <div className="flex items-center justify-center text-afs-ink-700" aria-hidden="true">
                  <ArrowIcon className="h-6 w-6 rotate-90 md:rotate-0" />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* Stylized passport card -- pure CSS, no image asset. Shows the
            real saved_configurations field labels (via product_profiles /
            materials / gauges / finishes joins), see the STEPS comment
            above for why these replace the prompt's invented field list. */}
        <div className="mx-auto mt-16 max-w-sm">
          <div className="relative overflow-hidden rounded-lg border border-afs-border-light bg-afs-bg-light-raised p-6 shadow-raised metal-edge-red">
            <div className="flex items-center justify-between border-b border-afs-border-light pb-4">
              <div>
                <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-afs-crimson">
                  AFS
                </p>
                <p className="font-label text-xs uppercase tracking-widest text-afs-ink-700">Profile Passport</p>
              </div>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-afs-crimson text-afs-crimson">
                <PassportIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>

            <p className="mt-5 font-heading text-xl font-semibold text-afs-ink-900">{PASSPORT_TITLE}</p>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
              {PASSPORT_FIELDS.map((field) => (
                <div key={field.label}>
                  <dt className="font-label text-[10px] font-semibold uppercase tracking-widest text-afs-ink-700">
                    {field.label}
                  </dt>
                  <dd className="mt-1 font-data text-sm text-afs-ink-900">{field.value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 border-t border-afs-border-light pt-4 font-body text-xs text-afs-ink-700">
              Saved Jan 8, 2026
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href={cta.href}
            className="inline-block rounded bg-afs-crimson px-8 py-3 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
          >
            {cta.label}
          </Link>
        </div>
      </RevealOnScroll>
    </section>
  );
}
