import Image from 'next/image';

// afs-logo.png is the complete branded lockup (mark + wordmark + tagline,
// all baked in as a single image). Used by Footer.tsx. NavBar.tsx renders
// the same /afs-logo.png asset but via its own separate inline <Image>
// call (a pre-existing duplication, not introduced or fixed here -- see
// STATE_OF_THE_BUILD.md). Do not add a second logo asset or improvise text
// overlays; extend this component instead.
const LOGO_SRC = '/afs-logo.png';

export default function AfsLogo({ className = '' }: { className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Architectural Flashing Supply"
      width={200}
      height={96}
      className={`object-contain ${className}`}
      priority
    />
  );
}
