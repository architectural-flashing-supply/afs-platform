// Names only, no logos -- avoids any trademark/logo-usage risk while still
// naming real, confirmed AFS client relationships (confirmed directly by
// Reid, 2026-09-15 -- see the NASA Johnson Space Center credential already
// live in CaseStudies.tsx for independent corroboration of at least that one).
// Selective brand-flavored accents on 8 names, approximated with afs-*
// tokens rather than each brand's literal hex (CLAUDE.md rule 4: no
// hardcoded hex in JSX) -- afs-crimson stands in for NASA/Tesla red,
// afs-accent-blue for Samsung/Facebook blue, afs-copper for Canyon Ranch's
// warm tan/brown, afs-amber/afs-accent-green fill out Google's per-letter
// scheme. Everyone else stays afs-ink-900 (plain "gunmetal" text on white).
const DEFAULT_CLASS = 'text-afs-ink-900';

const CLIENTS: { name: string; className: string }[] = [
  { name: 'NASA', className: 'text-afs-crimson' },
  { name: 'Samsung', className: 'text-afs-accent-blue' },
  { name: 'Tesla', className: 'text-afs-crimson' },
  { name: 'Google', className: '' }, // rendered per-letter, see GOOGLE_LETTER_CLASSES below
  { name: 'Facebook', className: 'text-afs-accent-blue' },
  { name: 'Baylor Scott & White', className: DEFAULT_CLASS },
  { name: 'University Hospital', className: DEFAULT_CLASS },
  { name: 'Hays ISD', className: DEFAULT_CLASS },
  { name: 'TopGolf', className: DEFAULT_CLASS },
  { name: 'Bugmaster', className: DEFAULT_CLASS },
  { name: 'Manor Medical', className: DEFAULT_CLASS },
  { name: 'UT San Antonio', className: 'text-afs-accent-orange' },
  { name: 'Seton Round Rock', className: DEFAULT_CLASS },
  { name: 'Midland Memorial Hospital System', className: DEFAULT_CLASS },
  { name: 'Canyon Ranch', className: 'text-afs-copper' },
  { name: 'DPR', className: 'text-afs-ink-700' },
];

// Google's classic per-letter color sequence (blue/red/yellow/blue/green/red),
// built entirely from existing/added afs-* tokens -- no literal hex.
const GOOGLE_LETTER_CLASSES = [
  'text-afs-accent-blue',
  'text-afs-crimson',
  'text-afs-amber',
  'text-afs-accent-blue',
  'text-afs-accent-green',
  'text-afs-crimson',
];

// Pure CSS marquee -- no client-side JS/state needed. The track is the
// client list rendered twice back to back; animating it from 0 to -50%
// (exactly one copy's width) and looping produces a seamless infinite
// scroll, and "pause on hover" is a plain :hover rule on the wrapper, not a
// mouseenter/mouseleave handler. 14s per full cycle -- slow enough to
// actually read each name, still continuously moving.
const ANIMATION_DURATION_S = 14;

// Just the text/letters, no sizing or layout classes -- callers (marquee vs.
// mobile stack) wrap this in their own <span> with context-appropriate size/
// whitespace handling.
function NameContent({ name, className }: { name: string; className: string }) {
  if (name === 'Google') {
    return (
      <>
        {name.split('').map((letter, i) => (
          <span key={i} className={GOOGLE_LETTER_CLASSES[i % GOOGLE_LETTER_CLASSES.length]}>
            {letter}
          </span>
        ))}
      </>
    );
  }

  return <span className={className}>{name}</span>;
}

function MarqueeName({ name, className, ariaHidden }: { name: string; className: string; ariaHidden?: boolean }) {
  return (
    <span aria-hidden={ariaHidden} className="flex-none whitespace-nowrap font-display text-4xl leading-none">
      <NameContent name={name} className={className} />
    </span>
  );
}

export default function ClientCarousel() {
  return (
    <section
      aria-label="Trusted clients carousel"
      role="region"
      // py-8 (was py-12): the hero above this was also shortened (700px ->
      // 560px) since the two changes together are what actually gets this
      // band showing above the fold on a typical ~900px viewport -- a
      // padding trim on this section alone can't undo the hero's own height.
      className="w-full bg-white py-8"
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
            <MarqueeName key={client.name} name={client.name} className={client.className} />
          ))}
          {CLIENTS.map((client) => (
            <MarqueeName key={`${client.name}-repeat`} name={client.name} className={client.className} ariaHidden />
          ))}
        </div>
      </div>

      {/* Mobile: vertical stack, no scroll/animation needed -- text-3xl (not
          the marquee's text-4xl) and no forced nowrap, so the longest names
          (e.g. "Midland Memorial Hospital System") can wrap instead of
          overflowing the viewport width. */}
      <div className="mt-10 flex flex-col items-center gap-6 px-6 md:hidden">
        {CLIENTS.map((client) => (
          <span key={client.name} className="text-center font-display text-3xl leading-none">
            <NameContent name={client.name} className={client.className} />
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
