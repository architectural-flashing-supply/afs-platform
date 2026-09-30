import type { SourceIconKey } from '@/lib/data/quote-request-source-tool';

/**
 * The three source marks a Workbench card can draw, copied from the approved
 * prototype's own `ICON` set (envelope / drawn polyline / camera).
 *
 * `aria-hidden` on the glyph: every caller renders the real words next to it
 * ("From FlashDraft"), so announcing the icon as well would read the source
 * twice.
 */
export default function SourceIcon({ icon }: { icon: SourceIconKey }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (icon === 'flashdraft') {
    return (
      <svg {...common}>
        <path d="M4 18l6-10 4 6 6-8" />
      </svg>
    );
  }
  if (icon === 'photo') {
    return (
      <svg {...common}>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}
