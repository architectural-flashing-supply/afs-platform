// Names only, no logos -- avoids any trademark/logo-usage risk while still
// naming real, confirmed AFS client relationships (confirmed directly by
// Reid, 2026-09-15 -- see the NASA Johnson Space Center credential already
// live in CaseStudies.tsx for independent corroboration of at least that one).
const CLIENTS = [
  'NASA',
  'Samsung',
  'Tesla',
  'Google',
  'Facebook',
  'Baylor Scott & White',
  'University Hospital',
  'Hayes ISD',
  'TopGolf',
  'Bugmaster',
  'Manor Medical',
  'UT San Antonio',
  'Seton Round Rock',
  'Midland Memorial Hospital System',
  'Canyon Ranch',
  'DPR',
] as const;

// Pure CSS marquee -- no client-side JS/state needed. The track is the
// client list rendered twice back to back; animating it from 0 to -50%
// (exactly one copy's width) and looping produces a seamless infinite
// scroll, and "pause on hover" is a plain :hover rule on the wrapper, not a
// mouseenter/mouseleave handler. ~5s per name x 16 names = 80s per full
// pass, per spec.
const ANIMATION_DURATION_S = CLIENTS.length * 5;

function ClientCard({ name, ariaHidden }: { name: string; ariaHidden?: boolean }) {
  return (
    <div
      aria-hidden={ariaHidden}
      className="flex min-w-[200px] flex-none items-center justify-center rounded border border-afs-chrome-dim bg-afs-bg-surface p-6 font-heading text-lg text-afs-chrome-high transition-colors hover:border-afs-crimson hover:text-afs-crimson"
    >
      {name}
    </div>
  );
}

export default function ClientCarousel() {
  return (
    <section
      aria-label="Trusted clients carousel"
      role="region"
      className="bg-afs-bg-base py-16 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center font-label text-xs font-semibold uppercase tracking-widest text-afs-crimson">
          Trusted By Industry Leaders
        </p>

        {/* Desktop: animated marquee, 6ish cards visible at once. */}
        <div className="client-marquee-wrap mt-10 hidden overflow-hidden md:block">
          <div
            className="client-marquee-track flex w-max gap-6"
            style={{ animationDuration: `${ANIMATION_DURATION_S}s` }}
          >
            {CLIENTS.map((name) => (
              <ClientCard key={name} name={name} />
            ))}
            {CLIENTS.map((name) => (
              <ClientCard key={`${name}-repeat`} name={name} ariaHidden />
            ))}
          </div>
        </div>

        {/* Mobile: plain static stack -- no scroll/animation needed. */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
          {CLIENTS.map((name) => (
            <ClientCard key={name} name={name} />
          ))}
        </div>
      </div>

      <style>{`
        .client-marquee-track {
          animation-name: client-marquee-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .client-marquee-wrap:hover .client-marquee-track {
          animation-play-state: paused;
        }
        @keyframes client-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .client-marquee-track {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
