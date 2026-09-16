import Image from 'next/image';
import Link from 'next/link';

// This section used to also render the phone-mockup video (the drawing/
// draw/shop-floor montage) alongside this text -- that video now lives in
// HeroSection instead (hpd-004's split-screen redesign put it above the
// fold), so duplicating it here as well would show the same clip twice in
// one scroll. See app/components/home/PhoneMockupVideo.tsx, which now owns
// that video and its autoplay/reduced-motion logic. This component keeps
// the "Photo to Quote" explainer and Field App CTA, which are still real,
// separate content from the hero's own headline.
const STEPS = [
  {
    number: '01',
    text: 'Snap a photo of the detail',
  },
  {
    number: '02',
    // AI identifies profile type and material only -- SPEC_PHOTO_TO_QUOTE_AI.md
    // is explicit that dimensions are never extracted from photos and must
    // always be entered from site measurements.
    text: 'AI identifies the profile and material',
  },
  {
    number: '03',
    text: 'Your quote request is submitted to AFS',
  },
];

export default function FieldAppStory() {
  return (
    <section className="relative overflow-hidden bg-afs-bg-base py-20 md:py-28">
      {/* Real jobsite installation detail (flashing-1.jpg, per
          public/legacy-site-photos/MANIFEST.md: "angled receiver/counterflashing
          bracket fastened over a metal roof panel against a stucco wall -- real
          installation detail, not a staged product shot"), used as a low-opacity
          background accent -- the crimson CTA stays the loudest element per
          DESIGN_TOKENS.md's "one loud element per viewport" rule. */}
      <Image
        src="/legacy-site-photos/homepage-categories/flashing-1.jpg"
        alt=""
        fill
        aria-hidden="true"
        className="object-cover opacity-[0.08]"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-afs-bg-base/90" />

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
          Photo to Quote from the jobsite
        </h2>

        <ol className="mx-auto mt-10 flex max-w-md flex-col gap-6 text-left">
          {STEPS.map((step) => (
            <li key={step.number} className="flex items-start gap-4">
              <span className="font-data text-sm font-medium text-afs-crimson">
                {step.number}
              </span>
              <span className="font-body text-lg text-afs-chrome-mid md:text-xl">
                {step.text}
              </span>
            </li>
          ))}
        </ol>

        {/* The Field App is a mobile PWA for on-site contractors (see
            app/field/contractor) -- promoting "install"/"open" on a
            desktop browser doesn't apply, so this CTA row is mobile-only. */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 md:hidden">
          <Link
            href="/field/contractor"
            className="rounded bg-afs-crimson px-8 py-4 font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
          >
            Open the Field App
          </Link>
          <Link
            href="/field/contractor"
            className="font-label text-sm font-semibold text-afs-chrome-mid underline underline-offset-4 transition-colors hover:text-afs-chrome-high"
          >
            Install as an app
          </Link>
        </div>
      </div>
    </section>
  );
}
