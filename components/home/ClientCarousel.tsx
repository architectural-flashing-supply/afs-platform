// Names only, no logos -- avoids any trademark/logo-usage risk while still
// naming real, confirmed AFS client relationships (confirmed directly by
// Reid, 2026-09-15 -- see the NASA Johnson Space Center credential already
// live in CaseStudies.tsx for independent corroboration of at least that one).
// afs-ink-900/afs-crimson (not the chrome-* tokens, which are near-white and
// meant for the dark gunmetal backgrounds used elsewhere on this page) are
// the afs-* tokens built for text on a light/white surface -- see this
// band's bg-white below.
const CLIENTS = [
  { name: 'NASA', accent: true },
  { name: 'Samsung', accent: false },
  { name: 'Tesla', accent: true },
  { name: 'Google', accent: false },
  { name: 'Facebook', accent: true },
  { name: 'Baylor Scott & White', accent: false },
  { name: 'University Hospital', accent: true },
  { name: 'Hayes ISD', accent: false },
  { name: 'TopGolf', accent: true },
  { name: 'Bugmaster', accent: false },
  { name: 'Manor Medical', accent: true },
  { name: 'UT San Antonio', accent: false },
  { name: 'Seton Round Rock', accent: true },
  { name: 'Midland Memorial Hospital System', accent: false },
  { name: 'Canyon Ranch', accent: true },
  { name: 'DPR', accent: false },
] as const;

// Pure CSS marquee -- no client-side JS/state needed. The track is the
// client list rendered twice back to back; animating it from 0 to -50%
// (exactly one copy's width) and looping produces a seamless infinite
// scroll, and "pause on hover" is a plain :hover rule on the wrapper, not a
// mouseenter/mouseleave handler. 5s per full cycle, per spec.
const ANIMATION_DURATION_S = 5;

function ClientName({ name, accent, ariaHidden }: { name: string; accent: boolean; ariaHidden?: boolean }) {
  return (
    <span
      aria-hidden={ariaHidden}
      className={`flex-none whitespace-nowrap font-display text-4xl leading-none ${
        accent ? 'text-afs-crimson' : 'text-afs-ink-900'
      }`}
    >
      {name}
    </span>
  );
}

export default function ClientCarousel() {
  return (
    <section
      aria-label="Trusted clients carousel"
      role="region"
      className="w-full bg-white py-12"
    >
      <p className="text-center font-label text-xs font-semibold uppercase tracking-widest text-afs-ink-700">
        Trusted By Industry Leaders
      </p>

      {/* Desktop: full-width animated marquee. */}
      <div className="client-marquee-wrap mt-10 hidden overflow-hidden md:block">
        <div
          className="client-marquee-track flex w-max items-center gap-12"
          style={{ animationDuration: `${ANIMATION_DURATION_S}s` }}
        >
          {CLIENTS.map((client) => (
            <ClientName key={client.name} name={client.name} accent={client.accent} />
          ))}
          {CLIENTS.map((client) => (
            <ClientName key={`${client.name}-repeat`} name={client.name} accent={client.accent} ariaHidden />
          ))}
        </div>
      </div>

      {/* Mobile: vertical stack, no scroll/animation needed. */}
      <div className="mt-10 flex flex-col items-center gap-6 md:hidden">
        {CLIENTS.map((client) => (
          <span
            key={client.name}
            className={`text-center font-display text-3xl leading-none ${
              client.accent ? 'text-afs-crimson' : 'text-afs-ink-900'
            }`}
          >
            {client.name}
          </span>
        ))}
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
