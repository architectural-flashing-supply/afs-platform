import Image from 'next/image';

interface SectionImageBreakProps {
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
}

// A lightweight full-bleed photo band dropped between homepage sections --
// not a feature section (no heading, no copy block), just a real-photo
// breather to interrupt the long run of gunmetal-gray/crimson UI sections
// with actual AFS shop/field imagery. Deliberately short (h-[280..440px],
// not a full viewport section) so it reads as a transition, not a stop.
export default function SectionImageBreak({
  src,
  alt,
  caption,
  objectPosition = 'center',
}: SectionImageBreakProps) {
  return (
    <div className="relative h-[280px] w-full overflow-hidden sm:h-[360px] md:h-[440px]">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-afs-bg-dim/85 via-transparent to-transparent" />
      <p className="absolute bottom-5 left-6 font-label text-xs font-semibold uppercase tracking-widest text-afs-chrome-high drop-shadow-lg md:left-10">
        {caption}
      </p>
    </div>
  );
}
