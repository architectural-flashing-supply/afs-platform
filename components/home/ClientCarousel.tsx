import type { CSSProperties } from 'react';

// Names only, no logos -- avoids any trademark/logo-usage risk while still
// naming real, confirmed AFS client relationships (confirmed directly by
// Reid, 2026-09-15 -- see the NASA Johnson Space Center credential already
// live in CaseStudies.tsx for independent corroboration of at least that one).
//
// Real per-client brand colors (2026-09-19 revision pass, item 6) -- exact
// hex added as afs-client-* tokens in tailwind.config.js rather than
// hardcoded in this file, per CLAUDE.md rule 4 (no literal hex in JSX
// outside the CANVAS_COLORS exception). NASA/Samsung/Tesla/Google/
// Facebook/Canyon Ranch/UT San Antonio keep their existing afs-* accent
// approximations, unchanged from before this pass.
const DEFAULT_CLASS = 'text-afs-ink-900';

interface NameSegment {
  text: string;
  className: string;
}

interface ClientEntry {
  name: string;
  className?: string; // single-color case
  segments?: NameSegment[]; // multi-color case -- overrides className
  outline?: boolean; // 1px black text-stroke, for legibility on light segments
}

const CLIENTS: ClientEntry[] = [
  { name: 'NASA', className: 'text-afs-crimson' },
  { name: 'Samsung', className: 'text-afs-accent-blue' },
  { name: 'Tesla', className: 'text-afs-crimson' },
  { name: 'Google', className: '' }, // rendered per-letter, see GOOGLE_LETTER_CLASSES below
  { name: 'Facebook', className: 'text-afs-accent-blue' },
  {
    name: 'Baylor Scott & White',
    segments: [
      { text: 'Baylor Scott ', className: 'text-afs-client-baylor-blue' },
      { text: '& White', className: 'text-afs-client-gold-deep' },
    ],
  },
  { name: 'University Hospital', className: 'text-afs-client-orange-burnt' },
  {
    name: 'Hays ISD',
    segments: [
      { text: 'Hays ', className: 'text-afs-client-hays-red' },
      { text: 'ISD', className: 'text-afs-client-hays-blue' },
    ],
  },
  { name: 'TopGolf', className: DEFAULT_CLASS },
  {
    name: 'Bug Master',
    outline: true,
    segments: [
      { text: 'Bug', className: 'text-afs-client-bugmaster-red' },
      { text: ' Master', className: 'text-afs-client-teal' },
    ],
  },
  { name: 'Manor Medical', className: DEFAULT_CLASS },
  { name: 'UT San Antonio', className: 'text-afs-accent-orange' },
  {
    name: 'Seton Round Rock',
    segments: [
      { text: 'Seton ', className: 'text-afs-client-teal' },
      { text: 'Round ', className: 'text-afs-client-seton-purple' },
      { text: 'Rock', className: 'text-afs-client-seton-blue' },
    ],
  },
  { name: 'Midland Memorial Hospital', className: 'text-afs-client-gold-deep' },
  { name: 'Canyon Ranch', className: 'text-afs-copper' },
  { name: 'DPR', className: 'text-afs-client-dpr-blue' },
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

const OUTLINE_STYLE: CSSProperties = {
  WebkitTextStroke: '1px #000000',
  paintOrder: 'stroke fill',
};

// Just the text/letters, no sizing or layout classes -- callers (marquee vs.
// mobile stack) wrap this in their own <span> with context-appropriate size/
// whitespace handling.
function NameContent({ client }: { client: ClientEntry }) {
  if (client.name === 'Google') {
    return (
      <>
        {client.name.split('').map((letter, i) => (
          <span key={i} className={GOOGLE_LETTER_CLASSES[i % GOOGLE_LETTER_CLASSES.length]}>
            {letter}
          </span>
        ))}
      </>
    );
  }

  if (client.segments) {
    return (
      <span style={client.outline ? OUTLINE_STYLE : undefined}>
        {client.segments.map((seg, i) => (
          <span key={i} className={seg.className}>
            {seg.text}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className={client.className} style={client.outline ? OUTLINE_STYLE : undefined}>
      {client.name}
    </span>
  );
}

// Pure CSS marquee -- no client-side JS/state needed. The track is the
// client list rendered twice back to back; animating it from 0 to -50%
// (exactly one copy's width) and looping produces a seamless infinite
// scroll, and "pause on hover" is a plain :hover rule on the wrapper, not a
// mouseenter/mouseleave handler. 14s per full cycle -- slow enough to
// actually read each name, still continuously moving.
const ANIMATION_DURATION_S = 14;

function MarqueeName({ client, ariaHidden }: { client: ClientEntry; ariaHidden?: boolean }) {
  return (
    <span aria-hidden={ariaHidden} className="flex-none whitespace-nowrap font-display text-lg leading-none">
      <NameContent client={client} />
    </span>
  );
}

export default function ClientCarousel() {
  return (
    <section
      aria-label="Trusted clients carousel"
      role="region"
      className="w-full bg-white py-3"
    >
      <p className="text-center font-label text-xs font-semibold uppercase tracking-widest text-afs-ink-700">
        Trusted By Industry Leaders
      </p>

      {/* Desktop: full-width animated marquee. */}
      <div className="client-marquee-wrap mt-4 hidden overflow-hidden md:block">
        <div
          className="client-marquee-track flex w-max items-center gap-8"
          style={{ animationDuration: `${ANIMATION_DURATION_S}s` }}
        >
          {CLIENTS.map((client) => (
            <MarqueeName key={client.name} client={client} />
          ))}
          {CLIENTS.map((client) => (
            <MarqueeName key={`${client.name}-repeat`} client={client} ariaHidden />
          ))}
        </div>
      </div>

      {/* Mobile: vertical stack, no scroll/animation needed -- text-base (not
          the marquee's text-lg) and no forced nowrap, so the longest names
          can wrap instead of overflowing the viewport width. */}
      <div className="mt-4 flex flex-col items-center gap-2 px-6 md:hidden">
        {CLIENTS.map((client) => (
          <span key={client.name} className="text-center font-display text-base leading-none">
            <NameContent client={client} />
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
