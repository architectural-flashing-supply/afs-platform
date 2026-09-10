import Link from 'next/link';

// Routes resolved against a direct read of app/, not invented -- same
// standard applied by CustomerPathways.tsx (hp-008) and NationwideMap.tsx
// (hp-013). /hailview: real, already-shipped route (app/hailview/page.tsx).
// /contact: real route (app/(public)/contact/page.tsx) -- the footer
// contact-anchor fallback this prompt allowed for wasn't needed.
interface CTAAction {
  key: string;
  label: string;
  href: string;
  primary?: boolean;
}

const ACTIONS: CTAAction[] = [
  { key: 'quote', label: 'Start a Quote', href: '/design-studio', primary: true },
  { key: 'profiles', label: 'Explore Profiles', href: '#profile-explorer' },
  { key: 'hail', label: 'Check Hail Impact', href: '/hailview' },
  { key: 'contact', label: 'Talk to AFS', href: '/contact' },
];

export default function FinalCTA() {
  return (
    <section className="w-full bg-afs-bg-dim py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <h2 className="font-display text-4xl leading-none text-afs-chrome-high sm:text-5xl md:text-6xl">
          Ready When You Are
        </h2>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {ACTIONS.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              className={
                action.primary
                  ? 'flex items-center justify-center rounded border border-transparent bg-afs-crimson px-6 py-5 text-center font-label text-sm font-semibold tracking-wide text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover'
                  : 'flex items-center justify-center rounded border border-[var(--afs-border)] bg-transparent px-6 py-5 text-center font-label text-sm font-semibold tracking-wide text-afs-chrome-mid transition-colors hover:bg-afs-bg-surface hover:text-afs-chrome-high'
              }
            >
              {action.label}
            </Link>
          ))}
        </div>

        <p className="mt-12 font-heading text-lg font-medium tracking-[0.08em] text-afs-chrome-mid md:text-xl">
          Texas Crafted. Nationally Delivered.
        </p>
      </div>
    </section>
  );
}
