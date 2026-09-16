import Image from 'next/image';

// afs-logo-512.png is the mark alone (no text baked in) -- afs-logo.png is
// a full lockup with "ARCHITECTURAL FLASHING SUPPLY" already flattened
// into the image, which can't be restyled or resized independently of the
// mark. Composing the mark image + live "AFS" text here instead means both
// stay legible (and independently styleable) at the header's small size.
const MARK_SRC = '/afs-logo-512.png';

export default function AfsLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-row items-center space-x-3 ${className}`}>
      <Image src={MARK_SRC} alt="" width={64} height={64} className="object-contain" />
      <span className="font-display text-3xl font-bold text-afs-chrome-high">AFS</span>
    </div>
  );
}
