import Image from 'next/image';

// afs-logo.png is the complete branded lockup (mark + wordmark + tagline,
// all baked in as a single image). This is the ONLY logo component in the
// codebase (audited: a single <AfsLogo /> call site in NavBar.tsx, none in
// Footer.tsx, which is text-only branding by design -- see that file's own
// comment). Do not add a second logo component or improvise text overlays;
// extend this one instead.
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
