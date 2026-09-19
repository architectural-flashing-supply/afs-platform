import Link from 'next/link';

const ITEMS: { label: string; href: string }[] = [
  { label: '4 Ways to Start', href: '#design-studio' },
  { label: '9 Materials', href: '/architects/finish-palette' },
  { label: 'Custom Profiles', href: '#profile-passport' },
  { label: 'SMACNA Standards Compliant', href: '/architects/guides' },
  { label: 'Nationwide Delivery', href: '#nationwide' },
];

export default function CredibilityStrip() {
  return (
    <nav aria-label="Key capabilities" className="border-y border-afs-border-light bg-afs-bg-light">
      <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-6 py-6 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:gap-y-0">
        {ITEMS.map((item, index) => (
          <li
            key={item.label}
            className={`flex items-center justify-center text-center ${
              index === ITEMS.length - 1 ? 'col-span-2' : ''
            }`}
          >
            <Link
              href={item.href}
              className="font-heading text-xs font-semibold uppercase tracking-wider text-afs-ink-700 transition-colors hover:text-afs-ink-900 sm:text-sm"
            >
              {item.label}
            </Link>
            {index < ITEMS.length - 1 && (
              <span className="mx-3 hidden text-afs-ink-700/50 sm:inline" aria-hidden="true">
                &middot;
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
