import Link from 'next/link';
import RevealOnScroll from './RevealOnScroll';

// Routes resolved against a direct read of app/, not invented -- same
// standard applied by CustomerPathways.tsx (hp-008) and NationwideMap.tsx
// (hp-013). /hailview: real, already-shipped route (app/hailview/page.tsx).
// /contact: real route (app/(public)/contact/page.tsx) -- the footer
// contact-anchor fallback this prompt allowed for wasn't needed.
// /architects/custom-profiles: real route (app/(public)/architects/
// custom-profiles/page.tsx), retargeted here (hpc-003) now that the
// Explore Our Profiles homepage section it used to point at is gone.
interface CTAAction {
  key: string;
  label: string;
  href: string;
}

const ACTION_CLASS =
  'flex items-center justify-center rounded border border-transparent bg-afs-crimson px-6 py-5 text-center font-label text-sm font-semibold tracking-wide text-white metal-edge-red shadow-crimson transition-colors hover:bg-afs-crimson-hover';

// 'profiles' (Custom Profiles) and 'hail' (Check Hail View) removed
// (2026-09-19 revision pass, item 7) -- HailView now has its own dedicated
// homepage section with a "Check My Address" CTA, and its own top-level
// nav item, making a third entry point here redundant.
const ACTIONS: CTAAction[] = [
  { key: 'quote', label: 'Start a Quote', href: '/design-studio' },
  { key: 'contact', label: 'Talk to AFS', href: '/contact' },
];

export default function FinalCTA() {
  return (
    <section className="w-full bg-afs-bg-light py-24 md:py-32">
      <RevealOnScroll className="mx-auto max-w-5xl px-6 text-center">
        <h2 className="font-display text-4xl leading-none text-afs-ink-900 sm:text-5xl md:text-6xl">
          Ready When You Are
        </h2>

        <div className="mx-auto mt-12 grid max-w-md grid-cols-2 gap-4 md:gap-6">
          {ACTIONS.map((action) => (
            <Link key={action.key} href={action.href} className={ACTION_CLASS}>
              {action.label}
            </Link>
          ))}
        </div>

        <p className="mt-12 font-heading text-lg font-medium tracking-[0.08em] text-afs-ink-700 md:text-xl">
          Texas Crafted. Nationally Delivered.
        </p>
      </RevealOnScroll>
    </section>
  );
}
