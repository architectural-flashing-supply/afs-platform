import Link from 'next/link';
import PhoneMockupVideo from './PhoneMockupVideo';

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
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2 md:gap-16">
        <div className="order-2 flex w-full justify-center md:order-1">
          <PhoneMockupVideo />
        </div>

        <div className="order-1 text-center md:order-2 md:text-left">
          <h2 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl">
            Photo to Quote from the jobsite
          </h2>

          <ol className="mx-auto mt-10 flex max-w-md flex-col gap-6 text-left md:mx-0">
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
      </div>
    </section>
  );
}
