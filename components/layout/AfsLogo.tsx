import Image from 'next/image';

type AfsLogoVariant = 'mark' | 'wordmark';

// 'mark' -- the square icon-only mark (public/afs-logo-512.png, 1024x1024),
// used wherever space is narrow and square (the desktop sidebar rail).
// 'wordmark' -- the full lockup (public/afs-logo.png, 1536x1024, 1.5:1),
// used wherever a wider horizontal space is available (mobile header,
// footer). Real pixel dimensions, not assumed -- see afs-logo.png/
// afs-logo-512.png on disk.
const SOURCES: Record<AfsLogoVariant, { src: string; aspectRatio: number }> = {
  mark: { src: '/afs-logo-512.png', aspectRatio: 1 },
  wordmark: { src: '/afs-logo.png', aspectRatio: 1536 / 1024 },
};

export default function AfsLogo({
  variant = 'wordmark',
  size = 80,
  className = '',
}: {
  variant?: AfsLogoVariant;
  /** Rendered height in px -- width is derived from the asset's real aspect ratio. */
  size?: number;
  className?: string;
}) {
  const { src, aspectRatio } = SOURCES[variant];
  return (
    <Image
      src={src}
      alt="AFS Architectural Flashing Supply"
      width={Math.round(size * aspectRatio)}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
