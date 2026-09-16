import Image from 'next/image';

type AfsLogoVariant = 'sidebar' | 'compact';

// afs-logo-512.png is the mark alone (no text baked in) -- afs-logo.png is
// a full lockup with "ARCHITECTURAL FLASHING SUPPLY" already flattened
// into the image, which can't be restyled or resized independently of the
// mark. Composing the mark image + live "AFS" text + live tagline text
// here instead means both stay legible (and independently styleable) at
// the small sizes the sidebar rail and mobile header actually render at.
const MARK_SRC = '/afs-logo-512.png';

export default function AfsLogo({
  variant = 'compact',
  className = '',
}: {
  variant?: AfsLogoVariant;
  className?: string;
}) {
  if (variant === 'sidebar') {
    return (
      <div className={`flex flex-col items-center justify-start space-y-3 px-4 py-6 text-center ${className}`}>
        <Image src={MARK_SRC} alt="" width={60} height={60} className="object-contain" />
        <span className="font-display text-xl text-afs-chrome-high">AFS</span>
        <span className="font-label text-[10px] leading-tight tracking-widest text-afs-chrome-dim">
          ARCHITECTURAL FLASHING SUPPLY
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-row items-center space-x-2 ${className}`}>
      <Image src={MARK_SRC} alt="" width={32} height={32} className="object-contain" />
      <span className="font-display text-xl text-afs-chrome-high">AFS</span>
    </div>
  );
}
