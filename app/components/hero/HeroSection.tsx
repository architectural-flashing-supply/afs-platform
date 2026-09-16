import Link from 'next/link';
import PhoneMockupVideo from '@/app/components/home/PhoneMockupVideo';

// Split-screen hero (hpd-004) -- replaces the prior full-bleed
// hero-metal-fabrication.mp4 background hero. The phone-mockup video that
// used to live below the fold in FieldAppStory (hp-005) is now the left
// column here instead; see PhoneMockupVideo.tsx and FieldAppStory.tsx's own
// comment for why that video isn't duplicated in both places.
export default function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-afs-bg-dim to-afs-bg-base">
      <div className="relative mx-auto grid min-h-[600px] max-w-7xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:px-10 md:py-20">
        <div className="flex w-full justify-center">
          <PhoneMockupVideo />
        </div>

        <div className="flex flex-col justify-center gap-8 border-afs-crimson md:border-l-2 md:pl-12">
          <div>
            <p className="font-label text-xs font-semibold uppercase tracking-widest text-afs-chrome-mid">
              Start Your Project
            </p>
            <h1 className="mt-3 font-display leading-none text-afs-chrome-high text-4xl sm:text-5xl md:text-[4rem]">
              Design Your Profile. Get Your Quote. Ship Fast.
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg text-afs-chrome-mid">
              Whether you&apos;re an architect, contractor, or GC — AFS handles custom
              fabrication from concept to delivery.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/studio/draft"
                className="rounded bg-afs-crimson px-8 py-4 text-center font-label text-sm font-semibold text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover"
              >
                Design Your Profile
              </Link>
              <Link
                href="/quote"
                className="rounded border border-afs-border px-8 py-4 text-center font-label text-sm font-semibold text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface"
              >
                Request a Quote
              </Link>
            </div>

            <p className="max-w-md font-body text-sm text-afs-chrome-dim">
              Upload drawings, get real-time estimates, or use our design studio to
              build exactly what you need.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
